'use strict';

// Adds the subscription purchase and owner payment-review screens to the APK bundle only.
// Runs after copy-web and never edits app.html, website source, Firebase rules, or backend data.
const fs = require('fs');
const path = require('path');
const target = path.resolve(__dirname, '..', 'www', 'index.html');
if (!fs.existsSync(target)) throw new Error('APK web bundle missing: run npm run copy-web first.');
let html = fs.readFileSync(target, 'utf8');
const marker = '/* AK_APK_SUBSCRIPTION_UI_V1 */';
if (html.includes(marker)) {
  console.log('APK subscription purchase UI already applied.');
  process.exit(0);
}
for (const required of [
  'function submitPaymentRequest()',
  'function loadPaymentAccountSettings()',
  'function loadAdminPaymentRequests()',
  'function adminApproveRequest(requestId)',
  'function adminRejectRequest(requestId)',
  'function akIsPlatformOwner(',
  'const AK_PLAN_AMOUNTS={30:30000,90:90000,180:180000,365:360000};'
]) {
  if (!html.includes(required)) throw new Error('Required subscription/payment logic missing: ' + required);
}
const paywallAnchor = '</div>\n<div class="panel"><h2>AI လုံခြုံရေးစစ်ဆေးမှု</h2>';
if (html.split(paywallAnchor).length !== 2) {
  throw new Error('Could not find unique paywall insertion point; refusing unsafe APK patch.');
}
if (html.includes('id="payPlan"') || html.includes('id="adminPaymentRows"')) {
  throw new Error('Payment UI element IDs already exist without APK patch marker.');
}
const customerPanel = `</div>
<div class="panel" id="akSubscriptionPayment">
  <h2>AK Sale ဆိုင်အသုံးပြုခွင့် Package</h2>
  <p>လစဉ်အသုံးပြုခ ၃၀,၀၀၀ ကျပ်ဖြစ်သည်။ ငွေလွှဲပြီး Transaction ID နှင့် Screenshot တင်ပါ။ Owner က KBZPay ထဲတွင် ငွေဝင်မှုကို စစ်ဆေးအတည်ပြုပြီးမှ အသုံးပြုခွင့်ဖွင့်ပေးမည်။</p>
  <div class="grid">
    <div><label for="payPlan">အသုံးပြုမည့် Package</label><select id="payPlan" onchange="updatePaymentAmount()">
      <option value="30">၁ လ · ၃၀,၀၀၀ ကျပ်</option>
      <option value="90">၃ လ · ၉၀,၀၀၀ ကျပ်</option>
      <option value="180">၆ လ · ၁၈၀,၀၀၀ ကျပ်</option>
      <option value="365">၁ နှစ် · ၃၆၀,၀၀၀ ကျပ်</option>
    </select></div>
    <div><label>ပေးချေရမည့်ငွေ</label><p id="paymentAmountLabel" class="pill">၃၀,၀၀၀ MMK</p></div>
  </div>
  <div class="notice" id="paymentAccountInfo">KBZPay အကောင့်အမည်: NiNiWin<br>KBZPay ဖုန်းနံပါတ်: 09774033661</div>
  <div class="grid">
    <div><label for="payMethod">ငွေပေးချေမှုနည်းလမ်း</label><select id="payMethod"><option value="KBZPay">KBZPay</option></select></div>
    <div><label for="payReference">KBZPay Transaction ID</label><input id="payReference" type="text" maxlength="100" autocomplete="off" placeholder="ငွေလွှဲ Transaction ID ထည့်ပါ"></div>
  </div>
  <label for="payScreenshot">ငွေလွှဲ Screenshot (JPG / PNG / WEBP · 2MB အောက်)</label>
  <input id="payScreenshot" type="file" accept="image/jpeg,image/png,image/webp">
  <div class="actions"><button type="button" onclick="submitPaymentRequest()">ငွေလွှဲအထောက်အထား တင်မည်</button><button type="button" class="alt" onclick="loadPaymentAccountSettings()">KPay အကောင့် ပြန်ဖတ်မည်</button></div>
  <p id="licenseStatus" class="muted">Package ရွေးပြီး ငွေလွှဲအထောက်အထား တင်ပါ။ Owner အတည်ပြုပြီးမှ POS ဖွင့်ပေးမည်။</p>
</div>
<div class="panel"><h2>AI လုံခြုံရေးစစ်ဆေးမှု</h2>`;
html = html.replace(paywallAnchor, customerPanel);
const ownerAnchor = '<div class="panel" id="akFirebasePanel">';
if (html.split(ownerAnchor).length !== 2) {
  throw new Error('Could not find unique owner dashboard insertion point; refusing unsafe APK patch.');
}
const ownerPanel = `<div class="panel owner-only" id="akOwnerPaymentReview">
  <h2>Owner · Subscription ငွေလက်ခံမှု</h2>
  <p>KBZPay ထဲတွင် ငွေဝင်မှုနှင့် Transaction ID ကို ကိုယ်တိုင်စစ်ဆေးပြီးမှ Approve လုပ်ပါ။ Screenshot တစ်ခုတည်းဖြင့် အတည်မပြုပါနှင့်။</p>
  <div class="actions"><button type="button" onclick="loadAdminPaymentRequests()">ငွေပေးချေမှု Pending စာရင်းဖတ်မည်</button></div>
  <p id="adminStatus" class="muted">Pending စာရင်း မဖတ်ရသေးပါ။</p>
  <div class="tablewrap"><table><thead><tr><th>ရက်စွဲ</th><th>ဆိုင်အကောင့်</th><th>Package / ငွေ</th><th>ငွေလွှဲအချက်အလက်</th><th>အခြေအနေ</th><th>လုပ်ဆောင်ချက်</th></tr></thead><tbody id="adminPaymentRows"><tr><td colspan="6">စာရင်းမဖတ်ရသေးပါ။</td></tr></tbody></table></div>
</div>
<div class="panel" id="akFirebasePanel">`;
html = html.replace(ownerAnchor, ownerPanel);
const authAnchor = 'fbUser=user||null;akUserClaims={};';
const authPatch = 'fbUser=user||null;const akPaymentPanel=document.getElementById("akSubscriptionPayment");if(akPaymentPanel)akPaymentPanel.style.display=akIsPlatformOwner(user)?"none":"";akUserClaims={};';
if (html.split(authAnchor).length !== 2) {
  throw new Error('Could not find unique auth-state insertion point; refusing unsafe APK patch.');
}
html = html.replace(authAnchor, authPatch);
const loadAnchor = 'if(typeof loadMyMarketListings==="function")void loadMyMarketListings();if(window.cmLoadLocal)window.cmLoadLocal();';
const loadPatch = 'if(typeof loadMyMarketListings==="function")void loadMyMarketListings();if(user){void loadPaymentAccountSettings();if(akIsPlatformOwner(user))void loadAdminPaymentRequests();}if(window.cmLoadLocal)window.cmLoadLocal();';
if (html.split(loadAnchor).length !== 2) {
  throw new Error('Could not find unique payment-screen initialization point; refusing unsafe APK patch.');
}
html = html.replace(loadAnchor, loadPatch);
html = html.replace('</body>', '<script>/* AK_APK_SUBSCRIPTION_UI_V1 */</script>\n</body>');
fs.writeFileSync(target, html);
console.log('APK-only subscription UI applied: MMK packages, KBZPay proof submission, owner pending-payment review and approval/rejection.');
