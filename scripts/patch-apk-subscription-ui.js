'use strict';

// APK-only subscription onboarding. Website source and Market remain unchanged.
const fs = require('fs');
const path = require('path');
const target = path.resolve(__dirname, '..', 'www', 'index.html');
if (!fs.existsSync(target)) throw new Error('APK web bundle missing: run npm run copy-web first.');
let html = fs.readFileSync(target, 'utf8');
const marker = '/* AK_APK_SUBSCRIPTION_UI_V2 */';
if (html.includes(marker)) { console.log('APK subscription onboarding already applied.'); process.exit(0); }

const required = [
  'function submitPaymentRequest()',
  'function loadPaymentAccountSettings()',
  'function loadAdminPaymentRequests()',
  'function adminApproveRequest(requestId)',
  'function adminRejectRequest(requestId)',
  'function akIsPlatformOwner(user=fbUser)',
  'const AK_PLAN_AMOUNTS={30:30000,90:90000,180:180000,365:360000};',
  'async function firebaseGoogleLogin()'
];
for (const item of required) if (!html.includes(item)) throw new Error('Required existing payment/auth logic missing: ' + item);
for (const id of ['payPlan','payMethod','payReference','payScreenshot','paymentAccountInfo','paymentAmountLabel','licenseStatus','adminPaymentRows','adminStatus','paymentOwnerSettings','ownerPaymentSettingsStatus','akOnboardingGoogleButton']) {
  if (html.includes('id="' + id + '"')) throw new Error('Unexpected existing payment UI ID: ' + id);
}

const paywallAnchor = '<div class="panel"><h2>AI လုံခြုံရေးစစ်ဆေးမှု</h2>';
if (html.split(paywallAnchor).length !== 2) throw new Error('Unique subscription insertion point not found.');
const customerPanel = `<div class="panel" id="akSubscriptionPayment">
  <h2>AK Sale Software · အသုံးပြုခွင့်</h2>
  <p>အောက်ပါအဆင့် ၃ ဆင့်ပြီးမှ ဆိုင် POS ကို ဖွင့်ပေးမည်။ Owner အတည်ပြုချက်မရမချင်း ဆိုင်စာရင်းများကို ဝင်မရပါ။</p>
  <div class="notice"><b>အဆင့် ၁ · Package ရွေးပါ</b></div>
  <div class="grid" id="akPlanButtons">
    <button type="button" class="ak-plan-option" data-days="30" onclick="selectAkPlan(30)">၁ လ · ၃၀,၀၀၀ ကျပ်</button>
    <button type="button" class="ak-plan-option alt" data-days="90" onclick="selectAkPlan(90)">၃ လ · ၉၀,၀၀၀ ကျပ်</button>
    <button type="button" class="ak-plan-option alt" data-days="180" onclick="selectAkPlan(180)">၆ လ · ၁၈၀,၀၀၀ ကျပ်</button>
    <button type="button" class="ak-plan-option alt" data-days="365" onclick="selectAkPlan(365)">၁ နှစ် · ၃၆၀,၀၀၀ ကျပ်</button>
  </div>
  <select id="payPlan" aria-label="Package" style="display:none">
    <option value="" selected disabled>Package ရွေးပါ</option><option value="30">၁ လ</option><option value="90">၃ လ</option><option value="180">၆ လ</option><option value="365">၁ နှစ်</option>
  </select>
  <p id="paymentAmountLabel" class="pill">Package အရင်ရွေးပါ</p>
  <div class="notice"><b>အဆင့် ၂ · Gmail ချိတ်ပါ</b><p>Google ဖြင့် မိမိ Gmail ကိုရွေးပါ။ အကောင့်တစ်ခုလျှင် ဆိုင်ဒေတာတစ်ခု သီးသန့်သိမ်းမည်။</p>
    <button type="button" id="akOnboardingGoogleButton" onclick="akStartSubscriptionGoogleLogin()" disabled>Package ရွေးပြီးမှ Google ချိတ်နိုင်သည်</button>
    <p id="akOnboardingStatus" class="muted">Package ရွေးပြီး Google ချိတ်ပါ။</p>
  </div>
  <div id="akPaymentProofStep" style="display:none">
    <div class="notice"><b>အဆင့် ၃ · ငွေလွှဲပြီး အထောက်အထားတင်ပါ</b><p>Owner အကောင့်ထဲသို့ KBZPay ဖြင့် ငွေလွှဲပြီး Transaction ID နှင့် Screenshot တင်ပါ။</p></div>
    <div class="notice" id="paymentAccountInfo">KBZPay အကောင့်အချက်အလက်ကို ဖတ်နေသည်...</div>
    <div class="grid">
      <div><label for="payMethod">ငွေပေးချေမှု</label><select id="payMethod"><option value="KBZPay">KBZPay</option></select></div>
      <div><label for="payReference">KBZPay Transaction ID</label><input id="payReference" type="text" maxlength="100" autocomplete="off" placeholder="Transaction ID ထည့်ပါ"></div>
    </div>
    <label for="payScreenshot">ငွေလွှဲ Screenshot · JPG / PNG / WEBP · 2MB အောက်</label>
    <input id="payScreenshot" type="file" accept="image/jpeg,image/png,image/webp">
    <div class="actions"><button type="button" onclick="submitPaymentRequest()">ငွေလွှဲအထောက်အထား တင်မည်</button><button type="button" class="alt" onclick="loadPaymentAccountSettings()">KPay အချက်အလက် ပြန်ဖတ်မည်</button></div>
    <p id="licenseStatus" class="muted">ငွေပေးချေမှု မတင်ရသေးပါ။</p><button type="button" class="alt" id="akReLoginAfterApproval" onclick="akReLoginAfterApproval()">Owner အတည်ပြုပြီးပြီ · Login ပြန်ဝင်မည်</button>
  </div>
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
const authPatch = 'checkUserRole(user);const akPaymentPanel=document.getElementById("akSubscriptionPayment"),akProofStep=document.getElementById("akPaymentProofStep"),akOnboardingStatus=document.getElementById("akOnboardingStatus");if(akPaymentPanel)akPaymentPanel.style.display=akIsPlatformOwner(user)?"none":"";if(akProofStep)akProofStep.style.display=user&&!akIsPlatformOwner(user)?"block":"none";if(akOnboardingStatus)akOnboardingStatus.textContent=user?(akIsPlatformOwner(user)?"Owner Gmail ချိတ်ပြီးပါပြီ။ Owner Dashboard မှ ငွေလွှဲတောင်းဆိုချက်များကို စစ်ဆေးပါ။":"Gmail ချိတ်ပြီးပါပြီ။ အဆင့် ၃ တွင် ငွေလွှဲအထောက်အထားတင်ပါ။"):"Package ရွေးပြီး Google ချိတ်ပါ။";if(user){void loadPaymentAccountSettings();if(akIsPlatformOwner(user))void loadAdminPaymentRequests();}if(typeof loadSponsoredAds==="function")void loadSponsoredAds();';
html = html.replace(authAnchor, authPatch);

const helperAnchor = 'const AK_PLAN_AMOUNTS={30:30000,90:90000,180:180000,365:360000};';
if (html.split(helperAnchor).length !== 2) throw new Error('Unique plan pricing declaration not found.');
const helper = `const akSelectPlanOriginal=selectAkPlan;selectAkPlan=function(days){if(!Object.prototype.hasOwnProperty.call(AK_PLAN_AMOUNTS,Number(days)))return;akSelectPlanOriginal(Number(days));localStorage.setItem("ak_selected_plan_days",String(days));const button=document.getElementById("akOnboardingGoogleButton");if(button){button.disabled=false;button.textContent="Google ဖြင့် Gmail ချိတ်မည်";}};function akStartSubscriptionGoogleLogin(){const days=Number(document.getElementById("payPlan")?.value||0);if(!Object.prototype.hasOwnProperty.call(AK_PLAN_AMOUNTS,days)){const status=document.getElementById("akOnboardingStatus");if(status)status.textContent="Google မချိတ်မီ Package ကို အရင်ရွေးပါ။";return;}try{localStorage.setItem("ak_selected_plan_days",String(days));const status=document.getElementById("akOnboardingStatus");if(status)status.textContent="Google Login ဖွင့်နေသည်...";const button=document.getElementById("akOnboardingGoogleButton");if(button){button.disabled=true;button.textContent="Google ချိတ်ဆက်နေသည်...";}Promise.resolve(firebaseGoogleLogin()).then(()=>{if(!fbAuth?.currentUser&&status){const fbStatus=document.getElementById("fbStatus");status.textContent=fbStatus?.textContent||"Google Login ပြီးဆုံးရန် စောင့်နေသည်...";}}).catch(error=>{if(status)status.textContent="Google Login မအောင်မြင်: "+(error.message||error)}).finally(()=>{if(button){button.disabled=false;button.textContent="Google ဖြင့် Gmail ချိတ်မည်";}})}catch(e){const status=document.getElementById("akOnboardingStatus");if(status)status.textContent="မအောင်မြင်ပါ: "+e.message}}async function akReLoginAfterApproval(){const button=document.getElementById("akReLoginAfterApproval"),status=document.getElementById("licenseStatus");try{if(!fbAuth?.currentUser)throw Error("Gmail ကို အရင်ချိတ်ပါ။");if(button){button.disabled=true;button.textContent="Owner အတည်ပြုမှု စစ်ဆေးနေသည်...";}const active=await refreshLicense();if(!active||!currentLicense||currentLicense.status!=="active")throw Error("Owner အတည်ပြုချက် မရသေးပါ။ KBZPay ထဲ ငွေဝင်မှုကို စစ်ပြီး Owner Approve လုပ်ပြီးမှ ပြန်နှိပ်ပါ။");await fbAuth.signOut();await firebaseGoogleLogin();if(status)status.textContent="Login ပြန်ဝင်နေပါပြီ။ Subscription နှင့် Cloud ဒေတာစစ်ဆေးပြီးမှ POS ဖွင့်မည်။";}catch(e){if(status)status.textContent=e.message||String(e);}finally{if(button){button.disabled=false;button.textContent="Owner အတည်ပြုပြီးပြီ · Login ပြန်ဝင်မည်";}}}`;
html = html.replace(helperAnchor, helper + helperAnchor);
const bodyEnd = html.lastIndexOf('</body>');
if (bodyEnd < 0) throw new Error('HTML body closing tag not found.');
html = html.slice(0, bodyEnd) + '<script>/* AK_APK_SUBSCRIPTION_UI_V2 */</script>\n' + html.slice(bodyEnd);
fs.writeFileSync(target, html);
console.log('APK onboarding V3 applied: explicit package selection -> native Google Gmail -> payment proof -> owner approval -> re-login -> POS.');
