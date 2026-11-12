// AK Sale Cloudflare gateway for the existing Firebase callable backend.
// This is a restricted proxy, NOT a replacement for Firebase Functions.
// Keep Firebase Auth, Admin SDK checks, Firestore transactions and licenses in Firebase.
const PROJECT_ID = "ak-onlin-sales";
const REGION = "us-central1";
const ALLOWED_FUNCTIONS = new Set([
  "claimShopDevice",
  "listShopDevices",
  "revokeShopDevice",
  "syncPublicShopProfile",
  "listPendingShopProfiles",
  "reviewShopProfile",
  "listPendingAds",
  "reviewSponsoredAd",
  "createShopOwnerAccount",
  "verifyShopOwnerLogin",
  "listPlatformUsers",
  "requestSubscriptionAccess",
  "grantSubscription",
  "setPlatformUserAccess",
  "assignShopStaffRole",
  "createShopInviteCode",
  "claimShopInviteCode",
  "listShopStaff",
  "setShopStaffPrintPermission",
  "publishShopAnnouncement",
  "listShopAnnouncements",
  "removeShopStaff",
  "createCloudBackup",
  "listCloudBackups",
  "restoreCloudBackup",
  "publishGlobalAnnouncement",
  "listGlobalAnnouncements",
  "loadShopWorkspace",
  "saveShopWorkspace",
  "akAiGenerateAd",
  "akAiSecurityReview"
]);

function corsHeaders(origin) {
  // The native Android app and GitHub Pages site both call this gateway.
  // Authentication and authorization remain enforced by Firebase upstream.
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Firebase-AppCheck, X-Firebase-GMPID",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "ak-sale-gateway",
        status: "proxy-ready",
        upstream: "Firebase Functions",
        project: PROJECT_ID,
        region: REGION,
        allowedCallableFunctions: ALLOWED_FUNCTIONS.size,
        note: "Firebase remains the authoritative backend; this Worker only forwards allowlisted callable requests."
      }, 200, origin);
    }

    const match = url.pathname.match(/^\/call\/([A-Za-z0-9_]+)$/);
    if (!match) return json({ ok: false, error: "not_found" }, 404, origin);
    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405, origin);
    }

    const functionName = match[1];
    if (!ALLOWED_FUNCTIONS.has(functionName)) {
      return json({ ok: false, error: "function_not_allowed" }, 404, origin);
    }

    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return json({ ok: false, error: "json_required" }, 415, origin);
    }

    // Do not accept unauthenticated requests at the edge. Firebase verifies
    // the forwarded ID token and performs the actual per-function authorization.
    const authorization = request.headers.get("Authorization");
    if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
      return json({ ok: false, error: "unauthenticated" }, 401, origin);
    }

    const upstream = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${functionName}`;
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.set("Authorization", authorization);
    const appCheck = request.headers.get("X-Firebase-AppCheck");
    if (appCheck) headers.set("X-Firebase-AppCheck", appCheck);
    const gmpid = request.headers.get("X-Firebase-GMPID");
    if (gmpid) headers.set("X-Firebase-GMPID", gmpid);

    try {
      const upstreamResponse = await fetch(upstream, {
        method: "POST",
        headers,
        body: await request.arrayBuffer(),
        redirect: "manual"
      });
      const responseHeaders = new Headers(corsHeaders(origin));
      responseHeaders.set("Content-Type", upstreamResponse.headers.get("Content-Type") || "application/json");
      responseHeaders.set("Cache-Control", "no-store");
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders
      });
    } catch {
      return json({ ok: false, error: "upstream_unavailable" }, 502, origin);
    }
  }
};
