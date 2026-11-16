'use strict';
const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('www/index.html', 'utf8');
const functionsSource = fs.readFileSync('functions/index.js', 'utf8');
const match = html.match(/async function apkProvisionShopOwner\([^)]*\)\s*\{[\s\S]*?^\}/m);
assert(match, 'APK must use the Admin-backed Owner invitation helper');
const helperSource = match[0];

async function runScenario(name, configure, verify) {
  const calls = [];
  const auth = {
    async sendSignInLinkToEmail() {
      calls.push({ type: 'email-link' });
      throw new Error('Email link must not be sent');
    }
  };
  const functions = {
    httpsCallable(functionName) {
      calls.push({ type: 'callable', functionName });
      return async payload => {
        calls.push({ type: 'payload', payload });
        if (configure?.throwError) throw configure.throwError;
        return { data: configure?.resultData || { ok: true, email: 'shop@example.com', invitationPending: true, expiresAt: '2026-12-31T17:29:59.999Z' } };
      };
    }
  };
  const fn = new Function('firebase','auth','location',helperSource+'\nreturn apkProvisionShopOwner;')(
    { functions: () => functions }, auth, { origin: 'https://example.com', pathname: '/pos/' }
  );
  const r = await verify(fn, { calls });
  assert(calls.some(x => x.type === 'callable' && x.functionName === 'createShopOwnerAccount'), name + ': must call trusted Firebase Admin invitation function');
  assert(!calls.some(x => x.type === 'email-link'), name + ': must not send Gmail login links');
  assert(!calls.some(x => x.type === 'payload' && ('password' in x.payload || 'gmailPassword' in x.payload)), name + ': must not send any password');
  console.log('PASS', name, r || '');
}

(async () => {
  assert(html.includes('id="customerGoogleBtn"'), 'Shop-owner Google login button is required');
  assert(html.includes('async function signInWithGoogleAccount()'), 'APK must share the native Google sign-in bridge');
  assert(!html.includes('id="sendLoginLinkBtn"'), 'Email-link login button must be removed');
  assert(!html.includes('$("sendLoginLinkBtn").onclick'), 'Removed email-link button must not leave a null DOM listener');
  assert(functionsSource.includes('context.auth.token.firebase?.sign_in_provider !== "google.com"'), 'Backend must require Google provider sign-in');
  await runScenario('new owner invitation: Gmail allowlist only', null, async (fn, ctx) => {
    const r = await fn('shop@example.com', '2026-12-31', 'AK Hardware', 'hardware');
    const payload = ctx.calls.find(x => x.type === 'payload').payload;
    assert.deepStrictEqual(payload, { email: 'shop@example.com', expiresOn: '2026-12-31', shopName: 'AK Hardware', industryType: 'hardware' });
    return 'Owner registers the Gmail in Dashboard; shop owner signs in with Google, no email link';
  });
  await runScenario('Admin invitation errors are surfaced', { throwError: new Error('permission-denied') }, async fn => {
    await assert.rejects(fn('shop@example.com', '2026-12-31', 'AK Hardware', 'hardware'), /permission-denied/);
    return 'server authorization errors surfaced';
  });
})().catch(error => { console.error(error); process.exitCode = 1; });
