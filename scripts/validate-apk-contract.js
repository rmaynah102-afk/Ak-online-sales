'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'app.html'), 'utf8');
const functionsSource = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
const printerSource = fs.readFileSync(path.join(__dirname, '..', 'native', 'android', 'AkPrinterPlugin.java'), 'utf8');
const firebaseConfigSource = fs.readFileSync(path.join(__dirname, '..', 'firebase-config.js'), 'utf8');
if (!html.includes('<script src="./firebase-config.js"></script>')) {
  console.error('Firebase public client config must be loaded before the app starts.');
  process.exitCode = 1;
}
try {
  const sandbox = { window: {} };
  new vm.Script(firebaseConfigSource, { filename: 'firebase-config.js' }).runInNewContext(sandbox);
  const config = sandbox.window.AK_FIREBASE_PUBLIC_CONFIG || {};
  for (const key of ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']) {
    if (typeof config[key] !== 'string' || !config[key].trim()) {
      console.error('Firebase Web App config is missing:', key);
      process.exitCode = 1;
    }
  }
  if (config.projectId !== 'ak-onlin-sales') {
    console.error('Firebase Web App config projectId does not match ak-onlin-sales.');
    process.exitCode = 1;
  }
} catch (error) {
  console.error('Firebase Web App config JavaScript is invalid:', error.message);
  process.exitCode = 1;
}
for (const [label, marker] of [
  ['Bluetooth Classic SPP socket', 'createRfcommSocketToServiceRecord'],
  ['Wi-Fi RAW TCP printer', 'printWifi(PluginCall call)'],
  ['Local network printer address restriction', 'isSiteLocalAddress'],
  ['ESC/POS raster receipt renderer', 'function akBuildReceiptEscPos'],
  ['Direct printer send bridge', 'window.akPrintRawToDefault']
]) {
  const source = label.includes('Bluetooth') || label.includes('Wi-Fi') || label.includes('network') ? printerSource : html;
  if (!source.includes(marker)) {
    console.error('Native printer integration check failed:', label);
    process.exitCode = 1;
  }
}


const clientCallables = new Set(
  [...html.matchAll(/httpsCallable\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)/g)].map(match => match[1])
);
const serverCallables = new Set(
  [...functionsSource.matchAll(/exports\.([A-Za-z0-9_]+)\s*=/g)]
    .filter(match => {
      const start = match.index;
      const next = functionsSource.indexOf('\nexports.', start + 1);
      const declaration = functionsSource.slice(start, next < 0 ? undefined : next);
      return declaration.includes('.https.onCall(') || declaration.includes('.https.onCall (');
    })
    .map(match => match[1])
);

const missing = [...clientCallables].filter(name => !serverCallables.has(name));
if (missing.length) {
  console.error('Client calls missing Firebase callable exports:', missing.join(', '));
  process.exitCode = 1;
} else {
  console.log('Firebase callable contract OK:', clientCallables.size, 'client callables matched server exports.');
}

const privateRule = rules.match(/match \/users\/\{userId\}\/private\/\{document=\*\*\} \{([\s\S]*?)\n\s*\}/);
if (!privateRule || !/allow read, write: if hasActiveLicense\(userId\)/.test(privateRule[1])) {
  console.error('Private shop data must remain protected by the owner UID/license rule.');
  process.exitCode = 1;
}
function extractRuleBlock(marker) {
  const start = rules.indexOf(marker);
  if (start < 0) return '';
  const next = rules.indexOf('\n    match ', start + marker.length);
  return rules.slice(start, next < 0 ? undefined : next);
}
// Marketplace-specific rules are intentionally excluded from APK validation.
const staffRule = rules.match(/match \/shopMembers\/\{memberUid\} \{([\s\S]*?)\n\s*\}/);
if (!staffRule || !/allow write: if false/.test(staffRule[1])) {
  console.error('Staff membership documents must only be writable by trusted Cloud Functions.');
  process.exitCode = 1;
}
if (!/request\.auth\.uid == uid/.test(rules)) {
  console.error('Private shop access must be bound to the authenticated UID.');
  process.exitCode = 1;
}
const cloudSyncStart = html.indexOf('function startAkCloudSync()');
const cloudSyncEnd = html.indexOf('async function cloudLoad()', cloudSyncStart);
const cloudSyncSource = cloudSyncStart >= 0 ? html.slice(cloudSyncStart, cloudSyncEnd) : '';
for (const required of [
  'revision:committedRevision',
  'current!==expectedRevision',
  'akCloudConflict',
  'if(akLocalDirty)',
  'akCloudSaveInFlight'
]) {
  if (!cloudSyncSource.includes(required)) {
    console.error('Cloud sync must protect against silent concurrent-device overwrites; missing:', required);
    process.exitCode = 1;
  }
}
if (!cloudSyncSource.includes('tx.set(ref') || !cloudSyncSource.includes('runTransaction')) {
  console.error('Cloud saves must use a Firestore transaction with a revision check.');
  process.exitCode = 1;
}
if (!html.includes('const authGeneration=++akAuthGeneration')) {
  console.error('Authentication callbacks must ignore stale async work after account switching.');
  process.exitCode = 1;
}
if (!html.includes('akCloudRevision=snap.exists&&Number.isSafeInteger(snap.data().revision)')) {
  console.error('Initial Cloud load must initialize the revision before enabling synchronization.');
  process.exitCode = 1;
}
if (!html.includes('akCloudConflict=false;akLocalDirty=false;')) {
  console.error('Explicit Cloud Load must clear conflict state only after replacing local data.');
  process.exitCode = 1;
}
if (!serverCallables.has('createPaymentRequest') || !clientCallables.has('createPaymentRequest')) {
  console.error('Payment submissions must use the trusted createPaymentRequest callable.');
  process.exitCode = 1;
}

// Client and server must enforce the same owner-approved subscription prices.
const expectedPlanMap = '{ 30: 30000, 90: 90000, 180: 180000, 365: 360000 }';
if (!html.includes('const AK_PLAN_AMOUNTS={30:30000,90:90000,180:180000,365:360000};') ||
    (functionsSource.match(/const expectedAmounts = \{ 30: 30000, 90: 90000, 180: 180000, 365: 360000 \};/g) || []).length !== 2) {
  console.error('Subscription pricing must match: 1 month 30000, 3 months 90000, 6 months 180000, 1 year 360000 MMK.');
  process.exitCode = 1;
}
if (!html.includes('if(!user){checkUserRole(null);akSetLicenseGate(false') ||
    html.includes('akSetLicenseGate(true,"Offline Local Mode') ||
    !html.includes('Cloud / License စစ်ဆေးမှု မအောင်မြင်ပါ')) {
  console.error('POS must remain locked until Gmail login and an owner-approved active subscription are verified online.');
  process.exitCode = 1;
}
// APK onboarding is injected into www/index.html by the APK-only build patch.
const apkSubscriptionPatch = fs.readFileSync(path.join(__dirname, 'patch-apk-subscription-ui.js'), 'utf8');
if (!apkSubscriptionPatch.includes('id="akPlanButtons"') ||
    !apkSubscriptionPatch.includes('id="akOnboardingGoogleButton"') ||
    !apkSubscriptionPatch.includes('id="akPaymentProofStep"') ||
    !apkSubscriptionPatch.includes('function akStartSubscriptionGoogleLogin()') ||
    !apkSubscriptionPatch.includes('AK_APK_SUBSCRIPTION_UI_V2')) {
  console.error('APK subscription onboarding patch must include Package -> Google Gmail -> payment proof.');
  process.exitCode = 1;
}
if (!functionsSource.includes('!screenshotUrl') || !html.includes('function validateAndSubmitKPay(paymentData,screenshotFile)')) {
  console.error('Payment proof validation must remain present in client and trusted server.');
  process.exitCode = 1;
}
if (!functionsSource.includes('paymentReferences') ||
    !functionsSource.includes('status: "pending"') ||
    !functionsSource.includes('paymentRequestId: requestRef.id')) {
  console.error('Payment submission must atomically reserve a unique transaction reference.');
  process.exitCode = 1;
}
if ((functionsSource.match(/update\("KBZPay:" \+ normalizedReference\)/g) || []).length < 2 ||
    !functionsSource.includes('replace(/\\s+/g, "").toUpperCase()')) {
  console.error('KBZPay references must use the same whitespace/case normalization at submission and approval.');
  process.exitCode = 1;
}
const paymentRule = rules.match(/match \/paymentRequests\/\{requestId\} \{([\s\S]*?)\n\s*\}/);
if (!paymentRule || !/allow create, update, delete: if false/.test(paymentRule[1])) {
  console.error('Clients must not write payment requests directly.');
  process.exitCode = 1;
}
const invoiceChecks = [
  ['multi-line sales invoice UI', 'id="saleLines"'],
  ['multi-line sales payload', 'lines,productId:first.productId'],
  ['aggregate stock validation', 'const quantities={}'],
  ['multi-line receipt rendering', 'Array.isArray(s.lines)&&s.lines.length'],
  ['invoice-linked debt payment', 'invoiceId:invoice?invoice.id:""'],
  ['invoice balance reduction', 'invoice.due=Math.max(0,Number(invoice.total)-invoice.paid)'],
  ['invoice party validation', 'Invoice အမည်နှင့် ငွေပေးသူအမည် မကိုက်ညီပါ']
];
for (const [label, marker] of invoiceChecks) {
  if (!html.includes(marker)) {
    console.error('Sales/debt regression check failed:', label);
    process.exitCode = 1;
  }
}
if (!process.exitCode) console.log('Multi-item invoice, stock, receipt and linked-payment checks OK.');

if (!process.exitCode) console.log('Firestore owner-only private data and trusted staff membership guards OK.');

if (!functionsSource.includes('paymentReferences') || !functionsSource.includes('tx.create(referenceRef')) {
  console.error('Subscription approval must prevent reuse of a KBZPay transaction reference.');
  process.exitCode = 1;
}
const restoreStart = functionsSource.indexOf('exports.restoreCloudBackup =');
const restoreEnd = functionsSource.indexOf('exports.publishGlobalAnnouncement =', restoreStart);
const restoreSource = restoreStart >= 0 ? functionsSource.slice(restoreStart, restoreEnd > restoreStart ? restoreEnd : undefined) : '';
if (!restoreSource.includes('db.runTransaction') ||
    !restoreSource.includes('tx.set(appRef') ||
    !restoreSource.includes('tx.delete(centerRef')) {
  console.error('Cloud restore must atomically restore appData and remove stale center data when absent.');
  process.exitCode = 1;
}
