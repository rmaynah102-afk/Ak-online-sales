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

test("creates a shop owner only after verified Platform Owner lookup", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return new Response(JSON.stringify({ users: [{ email: "painglin102@gmail.com", emailVerified: true }] }), { status: 200 });
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
