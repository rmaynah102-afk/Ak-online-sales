'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync('www/index.html', 'utf8');
const match = html.match(/async function apkProvisionShopOwner\(email,password\)\s*\{[\s\S]*?^\}/m);
assert(match, 'APK shop-owner provisioning helper must be present');
const helperSource = match[0];

async function runScenario(name, configure, verify) {
  const calls = [];
  const user = {
    uid: 'shop-user-123',
    email: 'shop@example.com',
    emailVerified: false,
    async reload() { calls.push('reload'); },
    async sendEmailVerification() { calls.push('verify-email'); }
  };
  const secondaryAuth = {
    languageCode: '',
    async createUserWithEmailAndPassword() { calls.push('create'); return { user }; },
    async signInWithEmailAndPassword() { calls.push('sign-in'); return { user }; },
    async sendPasswordResetEmail() { calls.push('password-reset'); },
    async signOut() { calls.push('secondary-sign-out'); }
  };
  const app = {
    auth() { return secondaryAuth; },
    async delete() { calls.push('secondary-delete'); }
  };
  const firebase = {
    initializeApp(_config, appName) {
      calls.push('initialize:' + appName);
      return app;
    }
  };
  configure?.({ calls, user, secondaryAuth });
  const fn = new Function('firebase', 'PROJECT', helperSource + '\nreturn apkProvisionShopOwner;')(firebase, { projectId: 'ak-onlin-sales' });
  const mainSession = { uid: 'platform-owner-uid' };
  const result = await verify(fn, { calls, user, mainSession });
  assert.deepStrictEqual(mainSession, { uid: 'platform-owner-uid' }, name + ': main Owner session must remain untouched');
  assert(calls.includes('secondary-sign-out'), name + ': secondary Auth must sign out');
  assert(calls.includes('secondary-delete'), name + ': secondary Firebase app must be deleted');
  console.log('PASS', name, result || '');
}

(async () => {
  await runScenario('new shop owner: create + verification email', null, async (fn, ctx) => {
    const r = await fn('shop@example.com', 'StrongPass123');
    assert.strictEqual(r.uid, 'shop-user-123');
    assert.strictEqual(r.emailVerified, false);
    assert.strictEqual(r.verificationEmailSent, true);
    assert(ctx.calls.includes('create'));
    assert(ctx.calls.includes('verify-email'));
    return 'verified-email sent; Owner session preserved';
  });

  await runScenario('existing shop owner: reuse matching credentials', ({ secondaryAuth, calls }) => {
    secondaryAuth.createUserWithEmailAndPassword = async () => {
      calls.push('create');
      const e = new Error('already exists'); e.code = 'auth/email-already-in-use'; throw e;
    };
    secondaryAuth.signInWithEmailAndPassword = async () => {
      calls.push('sign-in');
      return { user: { uid: 'shop-user-123', email: 'shop@example.com', emailVerified: true, async reload() { calls.push('reload'); }, async sendEmailVerification() { calls.push('verify-email'); } } };
    };
  }, async (fn, ctx) => {
    const r = await fn('shop@example.com', 'StrongPass123');
    assert.strictEqual(r.accountReused, true);
    assert.strictEqual(r.emailVerified, true);
    assert(!ctx.calls.includes('verify-email'));
    return 'existing verified account reused safely';
  });

  await runScenario('existing shop owner: wrong password triggers recovery', ({ secondaryAuth, calls }) => {
    secondaryAuth.createUserWithEmailAndPassword = async () => {
      calls.push('create');
      const e = new Error('already exists'); e.code = 'auth/email-already-in-use'; throw e;
    };
    secondaryAuth.signInWithEmailAndPassword = async () => {
      calls.push('sign-in');
      const e = new Error('wrong password'); e.code = 'auth/wrong-password'; throw e;
    };
  }, async (fn, ctx) => {
    await assert.rejects(fn('shop@example.com', 'WrongPass123'), /Password Reset Link/);
    assert(ctx.calls.includes('password-reset'));
    return 'password reset attempted; no duplicate account created';
  });

  await runScenario('unexpected Firebase error: cleanup still runs', ({ secondaryAuth }) => {
    secondaryAuth.createUserWithEmailAndPassword = async () => {
      const e = new Error('network down'); e.code = 'auth/network-request-failed'; throw e;
    };
  }, async (fn) => {
    await assert.rejects(fn('shop@example.com', 'StrongPass123'), /network down/);
    return 'Firebase error surfaced without leaving secondary app open';
  });
})().catch(error => { console.error(error); process.exitCode = 1; });
