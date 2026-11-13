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
let cachedGoogleToken = null;
function b64url(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decodePem(pem) {
  const body = String(pem || "").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const raw = atob(body);
  return Uint8Array.from(raw, ch => ch.charCodeAt(0));
}
async function getGoogleAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedGoogleToken && cachedGoogleToken.exp > now + 60) return cachedGoogleToken.token;
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("firebase_service_account_secret_missing");
  let service;
  try { service = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON); } catch { throw new Error("firebase_service_account_secret_invalid_json"); }
  if (service.project_id !== PROJECT_ID || !service.client_email || !service.private_key || !service.token_uri) throw new Error("firebase_service_account_project_or_fields_invalid");
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: service.client_email, scope: "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore", aud: service.token_uri, iat: now, exp: now + 3600 }));
  const unsigned = header + "." + claims;
  const key = await crypto.subtle.importKey("pkcs8", decodePem(service.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = unsigned + "." + b64url(new Uint8Array(signature));
  const response = await fetch(service.token_uri, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error("google_service_token_exchange_failed");
  cachedGoogleToken = { token: data.access_token, exp: now + Number(data.expires_in || 3600) };
  return cachedGoogleToken.token;
}
async function firebaseAdminRequest(path, token, body, apiKey) {
  if (!apiKey) throw new Error("firebase_api_key_missing");
  const endpoint = "https://identitytoolkit.googleapis.com/v1/" + path + "?key=" + encodeURIComponent(apiKey);
  const response = await fetch(endpoint, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error && data.error.message ? String(data.error.message).slice(0, 120) : "firebase_admin_request_failed");
    error.status = response.status;
    throw error;
  }
  return data;
}
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
  const callerResponse = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(apiKey), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: auth[1] }) });
  const callerData = await callerResponse.json().catch(() => ({}));
  const caller = callerData.users && callerData.users[0];
  if (!callerResponse.ok || !caller || String(caller.email || "").toLowerCase() !== "painglin102@gmail.com" || caller.emailVerified !== true) return json({ ok: false, error: "platform_owner_verification_failed" }, 403, origin);
  try {
    const token = await getGoogleAccessToken(env);
    const lookup = await firebaseAdminRequest("projects/" + PROJECT_ID + "/accounts:lookup", token, { email: [email] }, apiKey);
    const existing = lookup.users && lookup.users[0];
    let uid;
    if (existing) {
      let claims = {};
      try { claims = JSON.parse(existing.customAttributes || "{}"); } catch {}
      if (claims.platformAdmin || claims.shopId) return json({ ok: false, error: "target_account_is_reserved" }, 409, origin);
      uid = existing.localId;
      await firebaseAdminRequest("projects/" + PROJECT_ID + "/accounts:update", token, { localId: uid, password, emailVerified: true, disableUser: false }, apiKey);
    } else {
      const created = await firebaseAdminRequest("projects/" + PROJECT_ID + "/accounts", token, { email, password, emailVerified: true, disabled: false }, apiKey);
      uid = created.localId;
    }
    if (!uid) throw new Error("firebase_uid_missing");
    return json({ ok: true, uid, email, emailVerified: true, credentialManagedBy: "platform-owner" }, 200, origin);
  } catch (error) {
    const status = Number(error.status) >= 400 && Number(error.status) < 500 ? Number(error.status) : 502;
    return json({ ok: false, error: String(error.message || "owner_provision_failed").slice(0, 160) }, status, origin);
  }
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
        serviceAccountConfigured: Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON),
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
