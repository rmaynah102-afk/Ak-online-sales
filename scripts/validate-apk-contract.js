'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'apk', 'app.html'), 'utf8');
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
if (!html.includes('signInWithEmailAndPassword(email,pass)') ||
    html.includes('firebaseGoogleLogin') || html.includes('firebaseSendPhoneOtp') || html.includes('firebaseVerifyPhoneOtp') ||
    !html.includes('async function akOwnerChangePassword()') ||
    !html.includes('async function akCreateStaffInvite()') ||
    !html.includes('ak-staff-financial-privacy')) {
  console.error('APK must require Email/Password, support password changes and Merchant Code onboarding, and hide staff cost/profit.');
  process.exitCode = 1;
}
if (!functionsSource.includes('function akStripStaffFinancialFields(record)') ||
    !functionsSource.includes('const safeProducts=input.products.map(product=>') ||
    !functionsSource.includes('const totalCost=lines.reduce')) {
  console.error('Server must strip staff cost/profit data, preserve Owner costs, and calculate staff sale COGS securely.');
  process.exitCode = 1;
}
if (!html.includes('id="ownerDashboard" class="view shop-owner-only hidden"') ||
    !html.includes('id="akOwnerStaffPanel"') ||
    !html.includes('httpsCallable("loadShopWorkspace")') ||
    !html.includes('httpsCallable("saveShopWorkspace")') ||
    !html.includes('async function firebaseLogin()') ||
    !html.includes('fbAuth.signInWithEmailAndPassword(email,pass)') ||
    !html.includes('async function akOwnerChangePassword()') ||
    !html.includes('async function akCreateStaffInvite()')) {
  console.error('Owner/User/Staff login, password management and Merchant workspace integration must be present in the APK source.');
  process.exitCode = 1;
}
if (!functionsSource.includes('async function workspaceIdentity(context)') ||
    !functionsSource.includes('const identity=await workspaceIdentity(context)') ||
    !functionsSource.includes('async function verifyWorkspaceMember(context, identity)') ||
    !functionsSource.includes('member.data().shopId!==identity.shopId') ||
    !functionsSource.includes('function workspaceCanWrite(role,key)') ||
    !functionsSource.includes('function akStripStaffFinancialFields(record)') ||
    !functionsSource.includes('ဝန်ထမ်းသည် ရှိပြီးသားပစ္စည်း၏ အချက်အလက်/ဈေးနှုန်းကို မပြင်နိုင်ပါ။') ||
    !rules.includes('canReadShopWorkspaceMeta(shopId)')) {
  console.error('Shop workspace must enforce owner/staff roles, verified membership, restricted product edits and staff financial-field stripping.');
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
if (!html.includes('akWorkspaceRevision=Number(ws.revision||0)') ||
    !html.includes('httpsCallable("loadShopWorkspace")')) {
  console.error('Initial shop workspace load must initialize its revision before enabling synchronization.');
  process.exitCode = 1;
}
if (!html.includes('akCloudConflict=false;akLocalDirty=false;')) {
  console.error('Explicit Cloud Load must clear conflict state only after replacing local data.');
  process.exitCode = 1;
}
// The initial release is capped at 30 shops and three staff accounts per shop.
if (!functionsSource.includes('db.collection("platformControls").doc("shopCapacity")') ||
    !functionsSource.includes('activeOwners.length >= 30') ||
    !functionsSource.includes('db.collection("shops").doc(ownerUid).collection("controls").doc("staff")') ||
    !functionsSource.includes('staffLimit: 3') ||
    !functionsSource.includes('membersSnap.size >= 3') ||
    !functionsSource.includes('members.size >= 3') ||
    !functionsSource.includes('maxStaff: 3')) {
  console.error('Backend must serialize the 30-shop capacity limit and three-staff-per-shop limit.');
  process.exitCode = 1;
}
if (!html.includes('Thermer / Printer App သို့ပို့') ||
    !html.includes('chooserTitle') ||
    !printerSource.includes('Intent.createChooser(sendIntent, chooserTitle)')) {
  console.error('Receipt sharing must offer the Thermer / external printer-app chooser.');
  process.exitCode = 1;
}
if (!html.includes('if(!user){akWorkspaceMode=false;akWorkspaceShopId="";akWorkspaceRevision=0;checkUserRole(null);akSetLicenseGate(false') ||
    html.includes('akSetLicenseGate(true,"Offline Local Mode') ||
    !html.includes('Cloud / License စစ်ဆေးမှု မအောင်မြင်ပါ')) {
  console.error('POS must remain locked until Gmail login and an owner-approved active subscription are verified online.');
  process.exitCode = 1;
}
const obsoletePaymentMarkers = [
  'id="akCustomerPaymentPanel"', 'id="akOwnerPaymentQueue"', 'id="payScreenshot"',
  'function submitPaymentRequest()', 'paymentRequests', 'paymentReferences',
  'KBZPay', 'validateAndSubmitKPay'
];
for (const marker of obsoletePaymentMarkers) {
  if (html.includes(marker) || functionsSource.includes(marker) || rules.includes(marker)) {
    console.error('Obsolete in-app payment flow must be removed:', marker);
    process.exitCode = 1;
  }
}
if (!html.includes('id="akAccessRequestPanel"') ||
    !html.includes('async function akRequestSubscriptionAccess()') ||
    !html.includes('async function akGrantCustomerSubscription(uid)')) {
  console.error('Package access request and Owner manual activation flow must remain available.');
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

const restoreStart = functionsSource.indexOf('exports.restoreCloudBackup =');
const restoreEnd = functionsSource.indexOf('exports.publishGlobalAnnouncement =', restoreStart);
const restoreSource = restoreStart >= 0 ? functionsSource.slice(restoreStart, restoreEnd > restoreStart ? restoreEnd : undefined) : '';
if (!restoreSource.includes('db.runTransaction') ||
    !restoreSource.includes('tx.set(appRef') ||
    !restoreSource.includes('tx.delete(centerRef')) {
  console.error('Cloud restore must atomically restore appData and remove stale center data when absent.');
  process.exitCode = 1;
}
