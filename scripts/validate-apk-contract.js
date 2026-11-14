'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'apk', 'pos-app.html'), 'utf8');
const functionsSource = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
const printerSource = fs.readFileSync(path.join(__dirname, '..', 'native', 'android', 'AkPrinterPlugin.java'), 'utf8');
const firebaseConfigSource = fs.readFileSync(path.join(__dirname, '..', 'firebase-config.js'), 'utf8');
const storageRules = fs.readFileSync(path.join(__dirname, '..', 'storage.rules'), 'utf8');
const firebaseManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'));
const capacitorConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'capacitor.config.json'), 'utf8'));
const googleServices = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'google-services.json'), 'utf8'));
const apkUniversalPatch = fs.readFileSync(path.join(__dirname, 'patch-apk-universal.js'), 'utf8');
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

const ownerEmail = 'painglin102@gmail.com';
const androidClient = (googleServices.client || []).find(client =>
  client.client_info?.android_client_info?.package_name === 'com.ak.hardware.sales'
);
const androidOAuth = (androidClient?.oauth_client || []).find(client =>
  client.client_type === 1 && client.android_info?.package_name === 'com.ak.hardware.sales'
);
const proofStart = storageRules.indexOf('match /paymentProofs/{userId}/{fileName} {');
const proofEnd = storageRules.indexOf('\n    match ', proofStart + 1);
const proofRule = proofStart >= 0 ? storageRules.slice(proofStart, proofEnd > proofStart ? proofEnd : undefined) : '';
if (!html.includes('const OWNER_EMAIL="painglin102@gmail.com"') ||
    !functionsSource.includes('const OWNER_EMAIL = "painglin102@gmail.com";') ||
    !rules.includes("request.auth.token.email == 'painglin102@gmail.com'") ||
    !storageRules.includes("request.auth.token.email == 'painglin102@gmail.com'") ||
    [html, functionsSource, rules, storageRules].some(source => source.includes('sannnlinpaing@gmail.com'))) {
  console.error('Platform Owner must be the single verified Gmail painglin102@gmail.com.');
  process.exitCode = 1;
}
if (capacitorConfig.appId !== 'com.ak.hardware.sales' ||
    googleServices.project_info?.project_id !== 'ak-onlin-sales' ||
    !androidClient || !androidOAuth ||
    !/^[a-f0-9]{40}$/i.test(String(androidOAuth.android_info?.certificate_hash || '')) ||
    firebaseManifest.storage?.rules !== 'storage.rules') {
  console.error('Capacitor package, Firebase Android OAuth client, Firebase project, or Storage rules config does not match.');
  process.exitCode = 1;
}
if (!capacitorConfig.plugins?.FirebaseAuthentication?.providers?.includes('google.com') ||
    !capacitorConfig.plugins?.FirebaseAuthentication?.providers?.includes('phone') ||
    !html.includes('PhoneAuthProvider') || !html.includes('signInWithPhoneNumber')) {
  console.error('Google/Gmail and Phone OTP authentication must remain configured.');
  process.exitCode = 1;
}
if (!proofRule.includes('request.auth.uid == userId') ||
    !proofRule.includes('request.resource.size < 4 * 1024 * 1024') ||
    !proofRule.includes("request.resource.contentType.matches('image/(jpeg|png|webp)')") ||
    !proofRule.includes("request.auth.token.email == 'painglin102@gmail.com'")) {
  console.error('Payment screenshot Storage rules must restrict uploads to the account UID and reads to that UID or verified Platform Owner.');
  process.exitCode = 1;
}
if (!functionsSource.includes('const SHOP_STAFF_ROLES = ["manager", "cashier", "employee"];') ||
    !functionsSource.includes('24 * 60 * 60 * 1000') ||
    !functionsSource.includes('exports.setShopStaffPrintPermission =') ||
    !html.includes('httpsCallable("setShopStaffPrintPermission")') ||
    !html.includes('canPrint')) {
  console.error('Merchant Code expiry, staff roles, or per-staff print permissions are missing.');
  process.exitCode = 1;
}
for (const marker of ['facebook:"https://www.facebook.com/"','telegram:"https://t.me/share/url?url="','viber:"viber://forward?text="']) {
  if (!html.includes(marker)) { console.error('Product share route missing:', marker); process.exitCode = 1; }
}
if (!html.includes('id="purchaseForm"') || !html.includes('id="saleLines"') || !html.includes('function akCheckSubscriptionExpiry()')) {
  console.error('POS purchases, sales, or expiry lock UI is missing.');
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
const inviteRule = rules.match(/match \/shopInvites\/\{code\} \{([\s\S]*?)\n\s*\}/);
const slotRule = rules.match(/match \/shopStaffSlots\/\{slotId\} \{([\s\S]*?)\n\s*\}/);
if (!staffRule ||
    !staffRule[1].includes('request.auth.uid == memberUid') ||
    !staffRule[1].includes('request.auth.token.email_verified == true') ||
    !staffRule[1].includes("request.resource.data.role in ['manager','cashier','employee']") ||
    !staffRule[1].includes('request.resource.data.inviteCode.size() == 32') ||
    !staffRule[1].includes("affectedKeys().hasOnly(['canPrint','status','revokedAt'])") ||
    !inviteRule ||
    !inviteRule[1].includes("request.resource.data.expiresAt <= request.time + duration.value(24, 'h')") ||
    !inviteRule[1].includes('code.size() == 32') ||
    !inviteRule[1].includes("request.resource.data.role in ['manager','cashier','employee']") ||
    !inviteRule[1].includes("request.resource.data.status == 'open'") ||
    !inviteRule[1].includes("affectedKeys().hasOnly(['status','claimedBy','claimedAt'])") ||
    !slotRule ||
    !slotRule[1].includes('request.resource.data.slot in [1,2,3]') ||
    !slotRule[1].includes('request.auth.uid == request.resource.data.shopId')) {
  console.error('Staff membership rules must enforce verified one-time 24-hour invite claims, role limits, three slots and restricted print-permission updates.');
  process.exitCode = 1;
}
if (!/request\.auth\.uid == uid/.test(rules)) {
  console.error('Private shop access must be bound to the authenticated UID.');
  process.exitCode = 1;
}
if (!/id="ownerDashboard"[^>]*class="[^"]*shop-owner-only[^"]*"/.test(html) ||
    !html.includes('id="akOwnerStaffPanel"') ||
    !/akWorkspaceMode\s*=\s*false/.test(html) ||
    !html.includes('httpsCallable("loadShopWorkspace")') ||
    !html.includes('httpsCallable("saveShopWorkspace")') ||
    !apkUniversalPatch.includes('akWorkspaceMode=true') ||
    !apkUniversalPatch.includes('akLoadShopWorkspaceForCurrentUser') ||
    !apkUniversalPatch.includes('expectedRevision:0')) {
  console.error('APK must activate isolated shop workspaces and copy-migrate legacy owner data without changing Web source.');
  process.exitCode = 1;
}
if (!functionsSource.includes('async function workspaceIdentity(context)') ||
    !functionsSource.includes('const identity=await workspaceIdentity(context)') ||
    !functionsSource.includes('ဝန်ထမ်းသည် Gmail ကို အရင် Email အတည်ပြုထားရန် လိုအပ်သည်။') ||
    !functionsSource.includes('လက်ကျန်ပမာဏသာ အရောင်းနှင့်အတူ ပြောင်းနိုင်သည်။') ||
    !rules.includes('canReadShopWorkspaceMeta(shopId)')) {
  console.error('Shop workspace must enforce owner/staff roles, verified email and stock-only staff product changes.');
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
if (!html.includes('batch.set(referenceRef') || !html.includes('batch.set(requestRef') ||
    !html.includes('paymentRequests").where("status","==","pending")') ||
    !html.includes('onSnapshot(()=>{void loadAdminPaymentRequests()}')) {
  console.error('Payment requests must be submitted atomically to Firestore and delivered to the Owner through the live pending-payment queue.');
  process.exitCode = 1;
}
// Client and server must enforce the same owner-approved subscription prices.
const expectedPlanMap = '{ 30: 30000, 90: 90000, 180: 180000, 365: 360000 }';
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
if (!html.includes('const AK_PLAN_AMOUNTS={30:30000,90:90000,180:180000,365:360000};') ||
    (functionsSource.match(/const expectedAmounts = \{ 30: 30000, 90: 90000, 180: 180000, 365: 360000 \};/g) || []).length !== 2) {
  console.error('Subscription pricing must match: 1 month 30000, 3 months 90000, 6 months 180000, 1 year 360000 MMK.');
  process.exitCode = 1;
}
if (!html.includes('if(!user){akWorkspaceMode=false;akWorkspaceShopId="";akWorkspaceRevision=0;checkUserRole(null);akSetLicenseGate(false') ||
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
    !apkSubscriptionPatch.includes('AK_APK_SUBSCRIPTION_UI_V3') ||
    !apkSubscriptionPatch.includes('nativePromise("FirebaseAuthentication","signInWithGoogle"') ||
    !apkSubscriptionPatch.includes('document.body.classList.add("ak-license-locked")')) {
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
const paymentRuleStart = rules.indexOf('match /paymentRequests/{requestId} {');
const paymentRuleEnd = rules.indexOf('\n    match /paymentReferences', paymentRuleStart);
const paymentRule = paymentRuleStart >= 0 ? rules.slice(paymentRuleStart, paymentRuleEnd > paymentRuleStart ? paymentRuleEnd : undefined) : '';
if (!paymentRule ||
    !paymentRule.includes('request.resource.data.uid == request.auth.uid') ||
    !paymentRule.includes('allow read: if isVerifiedOwner()') ||
    !paymentRule.includes('allow update: if isVerifiedOwner()') ||
    !paymentRule.includes("request.resource.data.status == 'pending'") ||
    !paymentRule.includes('existsAfter(/databases/$(database)/documents/paymentReferences/')) {
  console.error('Payment requests must be owner-visible, customer-owned, pending-only on create, and protected by an atomic reference reservation.');
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
