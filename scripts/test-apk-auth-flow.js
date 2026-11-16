'use strict';
const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('www/index.html', 'utf8');
const match = html.match(/async function apkProvisionShopOwner\([^)]*\)\s*\{[\s\S]*?^\}/m);
assert(match, 'APK must use the Gmail-only Admin-backed invitation helper');
const helperSource = match[0];

async function runScenario(name, configure, verify) {
  const calls = [];
  const auth = {
    async sendSignInLinkToEmail(email, settings) {
      calls.push({ type: 'email-link', email, settings });
      if (configure?.throwEmailError) throw configure.throwEmailError;
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
  assert(!calls.some(x => x.type === 'payload' && ('password' in x.payload || 'gmailPassword' in x.payload)), name + ': must not send any password');
  console.log('PASS', name, r || '');
}

(async () => {
  await runScenario('new owner invitation: Gmail only', null, async (fn, ctx) => {
    const r = await fn('shop@example.com', '2026-12-31', 'AK Hardware', 'hardware');
    const payload = ctx.calls.find(x => x.type === 'payload').payload;
    assert.deepStrictEqual(payload, { email: 'shop@example.com', expiresOn: '2026-12-31', shopName: 'AK Hardware', industryType: 'hardware' });
    const link = ctx.calls.find(x => x.type === 'email-link');
    assert.strictEqual(link.email, 'shop@example.com');
    assert.deepStrictEqual(link.settings, { url: 'https://example.com/pos/', handleCodeInApp: true });
    return 'Owner creates pending invite and sends passwordless Gmail sign-in link';
  });

  await runScenario('Admin invitation errors are surfaced', { throwError: new Error('permission-denied') }, async (fn) => {
    await assert.rejects(fn('shop@example.com', '2026-12-31', 'AK Hardware', 'hardware'), /permission-denied/);
    return 'server authorization errors surfaced';
  });

  await runScenario('email delivery errors are surfaced', { throwEmailError: new Error('auth/unauthorized-continue-uri') }, async (fn) => {
    await assert.rejects(fn('shop@example.com', '2026-12-31', 'AK Hardware', 'hardware'), /unauthorized-continue-uri/);
    return 'Firebase email-link configuration errors surfaced';
  });
})().catch(error => { console.error(error); process.exitCode = 1; });
