// AK Sale Cloudflare gateway for AK Sale POS 2.0 and the legacy Firebase callable backend.
// Owner provisioning authorization and email validation hardened: 2026-11-13.
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
  if (!callerResponse.ok || !caller || String(caller.email || "").toLowerCase() !== "painglin102@gmail.com") {
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


const STAFF_EMAIL_DOMAIN = "akstaff.app";

function bearerToken(request) {
  const match = (request.headers.get("Authorization") || "").match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : "";
}
async function verifyShopOwner(request, body, origin) {
  const idToken = bearerToken(request);
  const apiKey = String(body.apiKey || "");
  if (!idToken) return { response: json({ ok:false, error:"unauthenticated" },401,origin) };
  if (!apiKey || apiKey.length > 200) return { response: json({ ok:false, error:"firebase_api_key_required" },400,origin) };
  const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+encodeURIComponent(apiKey), {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({idToken})
  });
  const payload = await response.json().catch(()=>({}));
  const user = payload.users && payload.users[0];
  if (!response.ok || !user || user.emailVerified !== true || !user.localId ||
      !String(user.email||"").includes("@") || String(user.email).toLowerCase() === "painglin102@gmail.com") {
    return { response: json({ok:false,error:"verified_shop_owner_required"},403,origin) };
  }
  return { idToken, apiKey, shopId:user.localId, email:String(user.email).toLowerCase() };
}
function firestoreDocUrl(path) {
  return "https://firestore.googleapis.com/v1/projects/"+PROJECT_ID+"/databases/(default)/documents/"+path;
}
async function firestoreGet(path, idToken) {
  const response=await fetch(firestoreDocUrl(path),{headers:{Authorization:"Bearer "+idToken}});
  const data=await response.json().catch(()=>({}));
  return {response,data};
}
async function verifyActiveShopLicense(shopId,idToken) {
  const {response,data}=await firestoreGet("licenses/"+encodeURIComponent(shopId),idToken);
  if(!response.ok)return false;
  const fields=data.fields||{};
  const expiry=Date.parse(fields.expiresAt?.timestampValue||"");
  return fields.status?.stringValue==="active" && Number.isFinite(expiry) && expiry>Date.now();
}
function randomMerchantCode() {
  const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);
  return Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();
}
async function firebaseCreateStaff(apiKey,code,password,name) {
  const email="staff."+code.toLowerCase()+"@"+STAFF_EMAIL_DOMAIN;
  const create=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key="+encodeURIComponent(apiKey),{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password,displayName:name,returnSecureToken:true})
  });
  const created=await create.json().catch(()=>({}));
  if(!create.ok||!created.localId||!created.idToken) {
    const reason=String(created.error?.message||"staff_account_create_failed");
    throw new Error(reason==="EMAIL_EXISTS"?"merchant_code_collision":reason.slice(0,120));
  }
  const verified=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:update?key="+encodeURIComponent(apiKey),{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:created.idToken,emailVerified:true,returnSecureToken:true})
  });
  const verification=await verified.json().catch(()=>({}));
  if(!verified.ok||verification.emailVerified!==true) {
    await fetch("https://identitytoolkit.googleapis.com/v1/accounts:delete?key="+encodeURIComponent(apiKey),{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:created.idToken})
    }).catch(()=>{});
    throw new Error("staff_email_verification_setup_failed");
  }
  return {uid:created.localId,email,createdToken:created.idToken};
}
async function cleanupStaffAuth(apiKey,idToken) {
  if(!idToken)return;
  await fetch("https://identitytoolkit.googleapis.com/v1/accounts:delete?key="+encodeURIComponent(apiKey),{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken})
  }).catch(()=>{});
}
async function staffProvision(request,origin) {
  let body;try{body=await request.json()}catch{return json({ok:false,error:"invalid_json"},400,origin)}
  const owner=await verifyShopOwner(request,body,origin);if(owner.response)return owner.response;
  const name=String(body.name||"").trim().slice(0,80),role=String(body.role||"cashier").toLowerCase(),password=String(body.password||"");
  if(name.length<2)return json({ok:false,error:"staff_name_required"},400,origin);
  if(!["manager","cashier","employee"].includes(role))return json({ok:false,error:"invalid_staff_role"},400,origin);
  if(password.length<8||password.length>128)return json({ok:false,error:"password_must_be_8_to_128_characters"},400,origin);
  if(!await verifyActiveShopLicense(owner.shopId,owner.idToken))return json({ok:false,error:"active_shop_license_required"},403,origin);
  const slots=await Promise.all([1,2,3].map(async slot=>{
    const result=await firestoreGet("shopStaffSlots/"+encodeURIComponent(owner.shopId+"_"+slot),owner.idToken);
    if(result.response.status===404)return slot;
    if(!result.response.ok)throw new Error("staff_slot_read_failed");
    return null;
  }));
  const slot=slots.find(x=>x!==null);
  if(!slot)return json({ok:false,error:"staff_limit_3_reached"},409,origin);
  let created;
  try {
    let lastError;
    for(let attempt=0;attempt<4;attempt++){
      const code=randomMerchantCode();
      try{created=await firebaseCreateStaff(owner.apiKey,code,password,name);created.code=code;break}
      catch(e){lastError=e;if(e.message!=="merchant_code_collision")throw e}
    }
    if(!created)throw lastError||new Error("staff_account_create_failed");
    const now=new Date().toISOString(),slotId=owner.shopId+"_"+slot;
    const memberPath="projects/"+PROJECT_ID+"/databases/(default)/documents/shopMembers/"+created.uid;
    const slotPath="projects/"+PROJECT_ID+"/databases/(default)/documents/shopStaffSlots/"+slotId;
    const hashBytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(created.code));
    const codeHash=Array.from(new Uint8Array(hashBytes),x=>x.toString(16).padStart(2,"0")).join("");
    const commit=await fetch("https://firestore.googleapis.com/v1/projects/"+PROJECT_ID+"/databases/(default)/documents:commit",{
      method:"POST",headers:{"Authorization":"Bearer "+owner.idToken,"Content-Type":"application/json"},
      body:JSON.stringify({writes:[
        {update:{name:memberPath,fields:{
          shopId:{stringValue:owner.shopId},role:{stringValue:role},status:{stringValue:"active"},
          email:{stringValue:created.email},createdAt:{timestampValue:now},createdBy:{stringValue:owner.shopId},
          merchantStaff:{booleanValue:true},name:{stringValue:name},merchantCodeHash:{stringValue:codeHash},
          slotId:{stringValue:slotId},canPrint:{booleanValue:false}
        }},currentDocument:{exists:false}},
        {update:{name:slotPath,fields:{
          shopId:{stringValue:owner.shopId},uid:{stringValue:created.uid},slot:{integerValue:String(slot)},
          createdAt:{timestampValue:now},merchantStaff:{booleanValue:true}
        }},currentDocument:{exists:false}}
      ]})
    });
    const result=await commit.json().catch(()=>({}));
    if(!commit.ok)throw new Error(String(result.error?.message||"staff_membership_write_failed").slice(0,180));
    return json({ok:true,uid:created.uid,code:created.code,name,role,slot},200,origin);
  } catch(e) {
    if(created)await cleanupStaffAuth(owner.apiKey,created.createdToken);
    const reason=String(e.message||"staff_provision_failed");
    const status=reason.includes("ALREADY_EXISTS")||reason.includes("FAILED_PRECONDITION")?409:400;
    return json({ok:false,error:reason},status,origin);
  }
}
async function staffList(request,origin) {
  let body;try{body=await request.json()}catch{return json({ok:false,error:"invalid_json"},400,origin)}
  const owner=await verifyShopOwner(request,body,origin);if(owner.response)return owner.response;
  if(!await verifyActiveShopLicense(owner.shopId,owner.idToken))return json({ok:false,error:"active_shop_license_required"},403,origin);
  const response=await fetch("https://firestore.googleapis.com/v1/projects/"+PROJECT_ID+"/databases/(default)/documents:runQuery",{
    method:"POST",headers:{"Authorization":"Bearer "+owner.idToken,"Content-Type":"application/json"},
    body:JSON.stringify({structuredQuery:{from:[{collectionId:"shopMembers"}],where:{fieldFilter:{
      field:{fieldPath:"shopId"},op:"EQUAL",value:{stringValue:owner.shopId}
    }}}})
  });
  const data=await response.json().catch(()=>[]);
  if(!response.ok)return json({ok:false,error:"staff_list_failed"},response.status,origin);
  const members=(Array.isArray(data)?data:[]).filter(x=>x.document).map(x=>{
    const d=x.document,fields=d.fields||{};
    return {uid:d.name.split("/").pop(),name:fields.name?.stringValue||"",role:fields.role?.stringValue||"",
      status:fields.status?.stringValue||"",merchantStaff:fields.merchantStaff?.booleanValue===true};
  }).filter(x=>x.merchantStaff);
  return json({ok:true,maxStaff:3,members},200,origin);
}
async function staffRevoke(request,origin) {
  let body;try{body=await request.json()}catch{return json({ok:false,error:"invalid_json"},400,origin)}
  const owner=await verifyShopOwner(request,body,origin);if(owner.response)return owner.response;
  if(!await verifyActiveShopLicense(owner.shopId,owner.idToken))return json({ok:false,error:"active_shop_license_required"},403,origin);
  const uid=String(body.memberUid||"").trim();
  if(!/^[A-Za-z0-9_-]{10,128}$/.test(uid)||uid===owner.shopId)return json({ok:false,error:"invalid_staff_uid"},400,origin);
  const {response,data}=await firestoreGet("shopMembers/"+encodeURIComponent(uid),owner.idToken);
  if(!response.ok)return json({ok:false,error:"staff_not_found"},404,origin);
  const fields=data.fields||{};
  if(fields.shopId?.stringValue!==owner.shopId||fields.merchantStaff?.booleanValue!==true)
    return json({ok:false,error:"staff_not_found"},404,origin);
  const slotId=fields.slotId?.stringValue,now=new Date().toISOString();
  const memberPath="projects/"+PROJECT_ID+"/databases/(default)/documents/shopMembers/"+uid;
  const writes=[{update:{name:memberPath,fields:{...fields,status:{stringValue:"suspended"},revokedAt:{timestampValue:now}}},updateMask:{fieldPaths:["status","revokedAt"]}}];
  if(slotId&&slotId.startsWith(owner.shopId+"_")){
    writes.push({delete:"projects/"+PROJECT_ID+"/databases/(default)/documents/shopStaffSlots/"+slotId});
  }
  const commit=await fetch("https://firestore.googleapis.com/v1/projects/"+PROJECT_ID+"/databases/(default)/documents:commit",{
    method:"POST",headers:{"Authorization":"Bearer "+owner.idToken,"Content-Type":"application/json"},body:JSON.stringify({writes})
  });
  if(!commit.ok){const error=await commit.json().catch(()=>({}));return json({ok:false,error:String(error.error?.message||"staff_revoke_failed").slice(0,180)},400,origin)}
  return json({ok:true},200,origin);
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
    if (url.pathname === "/staff/provision" && request.method === "POST") return staffProvision(request, origin);
    if (url.pathname === "/staff/list" && request.method === "POST") return staffList(request, origin);
    if (url.pathname === "/staff/revoke" && request.method === "POST") return staffRevoke(request, origin);

    if (url.pathname === "/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "ak-sale-gateway",
        status: "owner-and-staff-provision-ready",
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
