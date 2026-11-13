// AK Sale Cloudflare gateway for the existing Firebase callable backend.
// Deployment smoke-test revision: 2026-11-13.
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


const ALLOWED_ORIGINS = new Set(["https://rmaynah102-afk.github.io","capacitor://localhost","https://localhost","http://localhost","http://localhost:8100"]);
async function provisionShopOwner(request, env, origin) {
  const auth = (request.headers.get("Authorization") || "").match(/^Bearer\s+(\S+)$/i);
  if (!auth) return json({ ok: false, error: "unauthenticated" }, 401, origin);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400, origin); }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const apiKey = String(body.apiKey || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email === "painglin102@gmail.com") return json({ ok: false, error: "invalid_shop_owner_email" }, 400, origin);
  if (password.length < 8 || password.length > 128) return json({ ok: false, error: "password_must_be_8_to_128_characters" }, 400, origin);
  if (!apiKey || apiKey.length > 200) return json({ ok: false, error: "firebase_api_key_required" }, 400, origin);

  // Verify the caller against Firebase Auth; never trust client-supplied role fields.
  const callerResponse = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(apiKey), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: auth[1] })
  });
  const callerData = await callerResponse.json().catch(() => ({}));
  const caller = callerData.users && callerData.users[0];
  if (!callerResponse.ok || !caller || String(caller.email || "").toLowerCase() !== "painglin102@gmail.com" || caller.emailVerified !== true) {
    return json({ ok: false, error: "platform_owner_verification_failed" }, 403, origin);
  }

  // Create only new accounts through Firebase's public Identity Toolkit endpoint.
  // The endpoint is protected by the verified Platform Owner ID token above.
  const createResponse = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + encodeURIComponent(apiKey), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const created = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok || !created.localId || !created.idToken) {
    const message = String(created.error && created.error.message || "shop_owner_create_failed");
    const reason = message === "EMAIL_EXISTS" ? "shop_owner_email_already_registered" : message.slice(0, 120);
    return json({ ok: false, error: reason }, message === "EMAIL_EXISTS" ? 409 : 400, origin);
  }

  // Send the standard Firebase email-verification message to the new shop owner.
  const verifyResponse = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=" + encodeURIComponent(apiKey), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestType: "VERIFY_EMAIL", idToken: created.idToken })
  });
  const verification = await verifyResponse.json().catch(() => ({}));
  return json({
    ok: true, uid: created.localId, email, emailVerified: false,
    verificationEmailSent: verifyResponse.ok,
    verificationError: verifyResponse.ok ? undefined : String(verification.error && verification.error.message || "verification_email_send_failed").slice(0, 100),
    credentialManagedBy: "platform-owner"
  }, 200, origin);
}

function corsHeaders(origin) {
  // The native Android app and GitHub Pages site both call this gateway.
  // Authentication and authorization remain enforced by Firebase upstream.
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "null",
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
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ ok: false, error: "origin_not_allowed" }, 403, null);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/owner/provision" && request.method === "POST") return provisionShopOwner(request, env, origin);

    if (url.pathname === "/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "ak-sale-gateway",
        status: "owner-provision-ready",
        serviceAccountConfigured: false,
        serviceAccountRequired: false,
        upstream: "Cloudflare Worker Firebase Admin REST",
        firebaseCallableProxy: "legacy-only; still requires Firebase Functions",
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
