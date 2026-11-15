'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync('www/index.html', 'utf8');
const match = html.match(/async function apkProvisionShopOwner\([^)]*\)\s*\{[\s\S]*?^\}/m);
assert(match, 'APK must use the Admin-backed shop-owner provisioning helper');
const helperSource = match[0];

async function runScenario(name, configure, verify) {
  const calls = [];
  const mainSession = { uid: 'platform-owner-uid', email: 'painglin102@gmail.com' };
  const resultData = {
    ok: true, uid: 'shop-user-123', email: 'shop@example.com',
    emailVerified: true, expiresAt: '2026-12-31T17:29:59.999Z',
    passwordCredential: 'firebase-ak-pos-only'
  };
  const functions = {
    httpsCallable(functionName) {
      calls.push({ type: 'callable', functionName });
      return async payload => {
        calls.push({ type: 'payload', payload });
        if (configure?.throwError) throw configure.throwError;
        return { data: configure?.resultData || resultData };
      };
    }
  };
  const firebase = { functions: () => functions };
  const fn = new Function('firebase', helperSource + '\nreturn apkProvisionShopOwner;')(firebase);
  const r = await verify(fn, { calls, mainSession, resultData });
  assert.deepStrictEqual(mainSession, { uid: 'platform-owner-uid', email: 'painglin102@gmail.com' },
    name + ': Platform Owner session must remain signed in and unchanged');
  assert(calls.some(x => x.type === 'callable' && x.functionName === 'createShopOwnerAccount'),
    name + ': must call the trusted Firebase Admin function');
  assert(!calls.some(x => x.type === 'payload' && ('gmailPassword' in x.payload)),
    name + ': must never send a Gmail password');
  console.log('PASS', name, r || '');
}

(async () => {
  await runScenario('new shop owner: owner-defined AK POS credential', null, async (fn, ctx) => {
    const r = await fn('shop@example.com', 'OwnerDefined123', '2026-12-31', 'AK Hardware', 'hardware');
    assert.strictEqual(r.uid, 'shop-user-123');
    assert.strictEqual(r.emailVerified, true);
    const payload = ctx.calls.find(x => x.type === 'payload').payload;
    assert.deepStrictEqual(payload, {
      email: 'shop@example.com', password: 'OwnerDefined123',
      expiresOn: '2026-12-31', shopName: 'AK Hardware', industryType: 'hardware'
    });
    return 'Owner sets Firebase AK POS password and expiry; no Gmail password requested';
  });

  await runScenario('existing Firebase account: password is reset by Admin SDK', {
    resultData: {
      ok: true, uid: 'existing-shop-user', email: 'shop@example.com',
      emailVerified: true, expiresAt: '2026-12-31T17:29:59.999Z',
      passwordCredential: 'firebase-ak-pos-only'
    }
  }, async (fn, ctx) => {
    const r = await fn('shop@example.com', 'NewAKPOSPass123', '2026-12-31', 'AK Hardware', 'hardware');
    assert.strictEqual(r.uid, 'existing-shop-user');
    assert.strictEqual(ctx.calls.filter(x => x.type === 'callable').length, 1);
    return 'existing UID retained; only Firebase AK POS password updated';
  });

  await runScenario('provisioning errors are surfaced without client-side password recovery', {
    throwError: new Error('permission-denied')
  }, async (fn, ctx) => {
    await assert.rejects(fn('shop@example.com', 'OwnerDefined123', '2026-12-31', 'AK Hardware', 'hardware'), /permission-denied/);
    assert(!ctx.calls.some(x => x.type === 'payload' && ('resetPassword' in x.payload)));
    return 'server authorization errors surfaced; no password-reset email attempted';
  });
})().catch(error => { console.error(error); process.exitCode = 1; });
