'use strict';

// APK-only subscription purchase and owner payment review UI.
// Runs on generated www/index.html; does not modify website source or Firebase backend.
const fs = require('fs');
const path = require('path');
const target = path.resolve(__dirname, '..', 'www', 'index.html');
if (!fs.existsSync(target)) throw new Error('APK web bundle missing: run npm run copy-web first.');
let html = fs.readFileSync(target, 'utf8');
const marker = '/* AK_APK_SUBSCRIPTION_UI_V1 */';
if (html.includes(marker)) {
  console.log('APK subscription UI already applied.');
  process.exit(0);
}
const required = [
  'function submitPaymentRequest()',
  'function loadPaymentAccountSettings()',
  'function loadAdminPaymentRequests()',
  'function adminApproveRequest(requestId)',
  'function adminRejectRequest(requestId)',
  'function akIsPlatformOwner(user=fbUser)',
  'const AK_PLAN_AMOUNTS={30:30000,90:90000,180:180000,365:360000};'
];
for (const item of required) if (!html.includes(item)) throw new Error('Required existing payment logic missing: ' + item);
for (const id of ['payPlan','payMethod','payReference','payScreenshot','paymentAccountInfo','paymentAmountLabel','licenseStatus','adminPaymentRows','adminStatus','paymentOwnerSettings','ownerPaymentSettingsStatus']) {
  if (html.includes('id="' + id + '"')) throw new Error('Unexpected existing payment UI ID: ' + id);
}
const paywallAnchor = '<div class="panel"><h2>AI လုံခြုံရေးစစ်ဆေးမှု</h2>';
if (html.split(paywallAnchor).length !== 2) throw new Error('Unique subscription insertion point not found.');
const customerPanel = `<div class="panel" id="akSubscriptionPayment">
  <h2>AK Sale ဆိုင်အသုံးပြုခွင့် Package</h2>
  <p>၁ လအသုံးပြုခ ၃၀,၀၀၀ ကျပ်။ KBZPay သို့ ငွေလွှဲပြီး Transaction ID နှင့် Screenshot တင်ပါ။ Owner က ငွေဝင်မှုကို စစ်ဆေးအတည်ပြုပြီးမှ Subscription ဖွင့်ပေးမည်။</p>
  <div class="grid">
    <div><label for="payPlan">Package ရွေးချယ်ရန်</label><select id="payPlan" onchange="updatePaymentAmount()">
      <option value="30">၁ လ · ၃၀,၀၀၀ ကျပ်</option>
      <option value="90">၃ လ · ၉၀,၀၀၀ ကျပ်</option>
      <option value="180">၆ လ · ၁၈၀,၀၀၀ ကျပ်</option>
      <option value="365">၁ နှစ် · ၃၆၀,၀၀၀ ကျပ်</option>
    </select></div>
    <div><label>ပေးချေရမည့်ငွေ</label><p id="paymentAmountLabel" class="pill">ပေးချေရမည့်ငွေ: ၃၀,၀၀၀ MMK</p></div>
  </div>
  <div class="notice" id="paymentAccountInfo">KBZPay အကောင့်အချက်အလက်ကို ဖတ်နေသည်...</div>
  <div class="grid">
    <div><label for="payMethod">ငွေပေးချေမှု</label><select id="payMethod"><option value="KBZPay">KBZPay</option></select></div>
    <div><label for="payReference">KBZPay Transaction ID</label><input id="payReference" type="text" maxlength="100" autocomplete="off" placeholder="Transaction ID ထည့်ပါ"></div>
  </div>
  <label for="payScreenshot">ငွေလွှဲ Screenshot · JPG / PNG / WEBP · 2MB အောက်</label>
  <input id="payScreenshot" type="file" accept="image/jpeg,image/png,image/webp">
  <div class="actions"><button type="button" onclick="submitPaymentRequest()">ငွေလွှဲအထောက်အထား တင်မည်</button><button type="button" class="alt" onclick="loadPaymentAccountSettings()">KPay အချက်အလက် ပြန်ဖတ်မည်</button></div>
  <p id="licenseStatus" class="muted">ငွေပေးချေမှု မတင်ရသေးပါ။</p>
</div>
`;
html = html.replace(paywallAnchor, customerPanel + paywallAnchor);
const ownerAnchor = '<div class="panel" id="akFirebasePanel">';
if (html.split(ownerAnchor).length !== 2) throw new Error('Unique owner dashboard insertion point not found.');
const ownerPanel = `<div class="panel owner-only" id="akOwnerPaymentReview">
  <h2>Owner · Subscription ငွေလက်ခံမှု</h2>
  <p>KBZPay ထဲတွင် ငွေဝင်မှု၊ ပမာဏနှင့် Transaction ID ကို ကိုယ်တိုင်စစ်ပြီးမှ Approve လုပ်ပါ။ Screenshot တစ်ခုတည်းဖြင့် ငွေလက်ခံပြီးဟု မသတ်မှတ်ပါနှင့်။</p>
  <div class="actions"><button type="button" onclick="loadAdminPaymentRequests()">Pending ငွေပေးချေမှုစာရင်း ဖတ်မည်</button></div>
  <p id="adminStatus" class="muted">စာရင်း မဖတ်ရသေးပါ။</p>
  <div class="tablewrap"><table><thead><tr><th>ရက်စွဲ</th><th>Gmail</th><th>Package / ငွေ</th><th>Transaction / Screenshot</th><th>အခြေအနေ</th><th>ဆုံးဖြတ်ချက်</th></tr></thead><tbody id="adminPaymentRows"><tr><td colspan="6">စာရင်း မဖတ်ရသေးပါ။</td></tr></tbody></table></div>
  <div id="paymentOwnerSettings" class="hidden"><p id="ownerPaymentSettingsStatus" class="muted">KBZPay လက်ခံအကောင့်အချက်အလက်ကို Server မှသာ ထိန်းချုပ်သည်။</p></div>
</div>
`;
html = html.replace(ownerAnchor, ownerPanel + ownerAnchor);
const authAnchor = 'checkUserRole(user);if(typeof loadSponsoredAds==="function")void loadSponsoredAds();';
if (html.split(authAnchor).length !== 2) throw new Error('Unique auth-state payment initialization point not found.');
const authPatch = 'checkUserRole(user);const akPaymentPanel=document.getElementById("akSubscriptionPayment");if(akPaymentPanel)akPaymentPanel.style.display=akIsPlatformOwner(user)?"none":"";if(user){void loadPaymentAccountSettings();if(akIsPlatformOwner(user))void loadAdminPaymentRequests();}if(typeof loadSponsoredAds==="function")void loadSponsoredAds();';
html = html.replace(authAnchor, authPatch);
const bodyEnd = html.lastIndexOf('</body>');
if (bodyEnd < 0) throw new Error('HTML body closing tag not found.');
html = html.slice(0, bodyEnd) + '<script>/* AK_APK_SUBSCRIPTION_UI_V1 */</script>\n' + html.slice(bodyEnd);
fs.writeFileSync(target, html);
console.log('APK-only subscription UI applied: packages, KBZPay proof upload, owner payment review and server-verified approval/rejection.');
