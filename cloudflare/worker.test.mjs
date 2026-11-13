import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const source = await readFile(new URL("./worker.js", import.meta.url), "utf8");
const { default: worker } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

function request(body, authorization = "Bearer owner-id-token") {
  return new Request("https://ak-sale-backend.painglin102.workers.dev/owner/provision", {
    method: "POST",
    headers: {
      "Origin": "https://rmaynah102-afk.github.io",
      "Authorization": authorization,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

test("rejects missing or malformed Bearer authorization before contacting Firebase", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Firebase must not be called"); };
  try {
    const response = await worker.fetch(request({ email: "shop@example.com", password: "password123", apiKey: "test" }, "owner-id-token"), {});
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "unauthenticated");
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("rejects malformed shop-owner email before contacting Firebase", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Firebase must not be called"); };
  try {
    const response = await worker.fetch(request({ email: "not-an-email", password: "password123", apiKey: "test" }), {});
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "invalid_shop_owner_email");
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("creates a shop owner after Platform Owner lookup even if the Owner Gmail is unverified", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return new Response(JSON.stringify({ users: [{ email: "painglin102@gmail.com", emailVerified: false }] }), { status: 200 });
    if (calls.length === 2) return new Response(JSON.stringify({ localId: "shop-uid-123", idToken: "new-shop-token" }), { status: 200 });
    if (calls.length === 3) return new Response(JSON.stringify({ email: "shop@example.com" }), { status: 200 });
    throw new Error("Unexpected Firebase request");
  };
  try {
    const response = await worker.fetch(request({ email: "shop@example.com", password: "password123", apiKey: "test-api-key" }), {});
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.uid, "shop-uid-123");
    assert.equal(body.email, "shop@example.com");
    assert.equal(body.verificationEmailSent, true);
    assert.equal(calls.length, 3);
    assert.match(calls[0].url, /accounts:lookup/);
    assert.match(calls[1].url, /accounts:signUp/);
    assert.match(calls[2].url, /accounts:sendOobCode/);
  } finally { globalThis.fetch = originalFetch; }
});

test("rejects an unverified or non-Platform Owner caller", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ users: [{ email: "someone@example.com", emailVerified: true }] }), { status: 200 });
  };
  try {
    const response = await worker.fetch(request({ email: "shop@example.com", password: "password123", apiKey: "test-api-key" }), {});
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, "platform_owner_verification_failed");
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});


function staffRequest(path, body, authorization = "Bearer shop-owner-id-token") {
  return new Request("https://ak-sale-backend.painglin102.workers.dev"+path, {
    method:"POST",
    headers:{
      "Origin":"https://rmaynah102-afk.github.io",
      "Authorization":authorization,
      "Content-Type":"application/json"
    },
    body:JSON.stringify(body)
  });
}

test("provisions a Merchant Code staff account through Firebase Auth REST and atomic Firestore membership", async () => {
  const originalFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url,options={})=>{
    const u=String(url);calls.push({url:u,options});
    if(u.includes("accounts:lookup"))return new Response(JSON.stringify({users:[{localId:"shop-owner-uid-123",email:"shop@example.com",emailVerified:true}]}),{status:200});
    if(u.includes("/documents/licenses/"))return new Response(JSON.stringify({fields:{status:{stringValue:"active"},expiresAt:{timestampValue:"2099-01-01T00:00:00.000Z"}}}),{status:200});
    if(u.includes("/documents/shopStaffSlots/"))return new Response(JSON.stringify({error:{status:"NOT_FOUND"}}),{status:404});
    if(u.includes("accounts:signUp"))return new Response(JSON.stringify({localId:"staff-user-uid-123",idToken:"staff-created-id-token"}),{status:200});
    if(u.includes("accounts:update"))return new Response(JSON.stringify({emailVerified:true}),{status:200});
    if(u.includes("documents:commit"))return new Response(JSON.stringify({writeResults:[{},{}]}),{status:200});
    throw new Error("Unexpected Firebase request: "+u);
  };
  try{
    const response=await worker.fetch(staffRequest("/staff/provision",{
      apiKey:"test-api-key",name:"Cashier One",role:"cashier",password:"strong-pass-123"
    }),{});
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.ok,true);
    assert.equal(body.uid,"staff-user-uid-123");
    assert.match(body.code,/^[A-F0-9]{12}$/);
    assert.equal(body.slot,1);
    const signUp= calls.find(x=>x.url.includes("accounts:signUp"));
    assert.equal(JSON.parse(signUp.options.body).email,"staff."+body.code.toLowerCase()+"@akstaff.app");
    const update= calls.find(x=>x.url.includes("accounts:update"));
    assert.equal(JSON.parse(update.options.body).emailVerified,true);
    const commit=calls.find(x=>x.url.includes("documents:commit"));
    const writes=JSON.parse(commit.options.body).writes;
    assert.equal(writes.length,2);
    assert.equal(writes[0].update.fields.merchantStaff.booleanValue,true);
    assert.equal(writes[0].update.fields.role.stringValue,"cashier");
    assert.equal(writes[1].update.fields.uid.stringValue,"staff-user-uid-123");
  }finally{globalThis.fetch=originalFetch}
});

test("refuses Merchant Code staff creation when the shop license is inactive", async () => {
  const originalFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url)=>{
    const u=String(url);calls.push(u);
    if(u.includes("accounts:lookup"))return new Response(JSON.stringify({users:[{localId:"shop-owner-uid-123",email:"shop@example.com",emailVerified:true}]}),{status:200});
    if(u.includes("/documents/licenses/"))return new Response(JSON.stringify({fields:{status:{stringValue:"suspended"},expiresAt:{timestampValue:"2099-01-01T00:00:00.000Z"}}}),{status:200});
    throw new Error("No further Firebase call expected");
  };
  try{
    const response=await worker.fetch(staffRequest("/staff/provision",{apiKey:"test-api-key",name:"Cashier",role:"cashier",password:"strong-pass-123"}),{});
    assert.equal(response.status,403);
    assert.equal((await response.json()).error,"active_shop_license_required");
    assert.equal(calls.length,2);
  }finally{globalThis.fetch=originalFetch}
});
