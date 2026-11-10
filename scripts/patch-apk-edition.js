'use strict';

// Produce three APK editions from the same POS source without changing the Market website.
const fs = require('fs');
const path = require('path');

const edition = String(process.env.AK_APK_EDITION || process.argv[2] || '').trim().toLowerCase();
const editions = {
  'platform-owner': { appId: 'com.ak.hardware.sales', appName: 'AK Platform Owner' },
  'shop-owner': { appId: 'com.ak.hardware.sales.shop', appName: 'AK Sale Shop Owner' },
  'staff': { appId: 'com.ak.hardware.sales.staff', appName: 'AK Sale Staff' }
};
if (!Object.prototype.hasOwnProperty.call(editions, edition)) {
  throw new Error('AK_APK_EDITION must be platform-owner, shop-owner, or staff.');
}

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'www', 'index.html');
const configPath = path.join(root, 'capacitor.config.json');
if (!fs.existsSync(htmlPath) || !fs.existsSync(configPath)) {
  throw new Error('APK bundle or Capacitor config is missing. Run npm run copy-web first.');
}
let html = fs.readFileSync(htmlPath, 'utf8');
if (!html.includes('/* AK_APK_POS_ONLY_MARKET_ISOLATION_V5 */') ||
    !html.includes('const publicMode=false;')) {
  throw new Error('APK Market isolation must be applied before selecting an edition.');
}
if (html.includes('AK_APK_EDITION_V1')) {
  throw new Error('An APK edition patch is already present.');
}

function replaceExactly(oldText, newText, expected = 1) {
  const count = html.split(oldText).length - 1;
  if (count !== expected) {
    throw new Error('Expected ' + expected + ' occurrence(s), found ' + count + ': ' + oldText.slice(0, 110));
  }
  html = html.replace(oldText, newText);
}

const rootTag = '<html lang="my" class="ak-apk-pos-only">';
replaceExactly(rootTag, '<html lang="my" class="ak-apk-pos-only" data-ak-apk-edition="' + edition + '">');

// Keep the Merchant Code control in a named, edition-controlled panel.
replaceExactly(
  '<div class="notice" style="margin-top:10px"><b>ဝန်ထမ်း Merchant Code ဖြင့် ဆိုင်ချိတ်ရန်</b>',
  '<div class="notice" id="akMerchantJoinPanel" style="margin-top:10px"><b>ဝန်ထမ်း Merchant Code ဖြင့် ဆိုင်ချိတ်ရန်</b>'
);

// Remove AI controls from the APK editions; ordinary social sharing remains available.
for (const token of ['<h3>AI ကြော်ငြာစာသား</h3>', '<h2>AI လုံခြုံရေးစစ်ဆေးမှု</h2>']) {
  const lines = html.split('\n');
  const matches = lines.filter(line => line.includes(token)).length;
  if (matches !== 1) throw new Error('Expected one APK AI panel line for ' + token + ', found ' + matches);
  const index = lines.findIndex(line => line.includes(token));
  lines[index] = '  <!-- APK edition: AI feature removed -->';
  html = lines.join('\n');
}

// Enforce edition-specific account roles in the Firebase auth-state callback.
const authAnchor = 'checkUserRole(user);if(akIsPlatformOwner(user)){';
const roleGuard =
  'checkUserRole(user);if(user){' +
  'const edition=document.documentElement.getAttribute("data-ak-apk-edition");' +
  'const role=String(akUserRole||"").toLowerCase();' +
  'const staffRole=["manager","cashier","employee"].includes(role);' +
  'let denied="";' +
  'if(edition==="platform-owner"&&!akIsPlatformOwner(user))denied="ဤ APK သည် Platform Owner အကောင့်အတွက်သာ ဖြစ်သည်။";' +
  'if(edition==="shop-owner"&&(akIsPlatformOwner(user)||staffRole))denied="ဤ APK သည် ဆိုင်ရှင်အကောင့်အတွက်သာ ဖြစ်သည်။ Staff APK ကို အသုံးပြုပါ။";' +
  'if(edition==="staff"){' +
    'if(akIsPlatformOwner(user)||(akUserClaims.shopId&&!staffRole))denied="ဤ APK သည် Merchant Code ဖြင့် ချိတ်ထားသော ဝန်ထမ်းအကောင့်အတွက်သာ ဖြစ်သည်။";' +
    'if(!denied&&!akUserClaims.shopId&&!akIsPlatformOwner(user)){' +
      'const ownLicenseSnap=await fbStore.collection("licenses").doc(user.uid).get();' +
      'const ownLicense=ownLicenseSnap.exists?ownLicenseSnap.data()||{}:{};' +
      'const ownExpiry=ownLicense.expiresAt&&typeof ownLicense.expiresAt.toMillis==="function"?ownLicense.expiresAt.toMillis():new Date(ownLicense.expiresAt||0).getTime();' +
      'if(ownLicense.status==="active"&&Number.isFinite(ownExpiry)&&ownExpiry>Date.now())denied="ဤ Gmail သည် ဆိုင်ရှင် Subscription အကောင့်ဖြစ်နေသည်။ Shop Owner APK ကို အသုံးပြုပါ။";' +
    '}' +
  '}' +
  'if(denied){await fbAuth.signOut();$("fbStatus").textContent=denied;return;}' +
  '}if(akIsPlatformOwner(user)){';
replaceExactly(authAnchor, roleGuard);

// The base package is registered for native Google Sign-In. The two customer
// editions use Firebase Email/Password plus verified Gmail with unique package IDs.
if (edition !== 'platform-owner') {
  html = html.replace(
    'Gmail / Email နှင့် Password ဖြင့် အကောင့်ဖွင့်ပြီး Login ဝင်ပါ။ Google ဖြင့်လည်း ဝင်နိုင်သည်။ ဖုန်း OTP မလိုအပ်ပါ။ Subscription ဝယ်ယူပြီး Owner အတည်ပြုပြီးမှ Cloud POS အသုံးပြုခွင့်ရမည်။',
    'Gmail / Email နှင့် Password ဖြင့် အကောင့်ဖွင့်ပြီး Email ကို အတည်ပြုပါ။ ဖုန်း OTP မလိုအပ်ပါ။'
  );
  html = html.replace(
    '<b>အဆင့် ၂ · Gmail ချိတ်ပါ</b><p>Google ဖြင့် မိမိ Gmail ကိုရွေးပါ။ အကောင့်တစ်ခုလျှင် ဆိုင်ဒေတာတစ်ခု သီးသန့်သိမ်းမည်။</p>',
    '<b>အဆင့် ၂ · Gmail အကောင့်ဝင်ပါ</b><p>အောက်ပါ Email / Password နေရာတွင် အကောင့်ဖွင့်ပါ သို့မဟုတ် Login ဝင်ပါ။ Gmail ကို အတည်ပြုပြီးမှ ဆိုင်ဒေတာ သီးသန့်ချိတ်ဆက်မည်။</p>'
  );
}

const editionCss = [
  '<style id="ak-apk-edition-v1">',
  '/* AK_APK_EDITION_V1 · separate role-specific APK experiences */',
  'html.ak-apk-pos-only[data-ak-apk-edition="platform-owner"] body.ak-license-locked main>#backup>#akFirebasePanel,',
  'html.ak-apk-pos-only[data-ak-apk-edition="shop-owner"] body.ak-license-locked main>#backup>#akFirebasePanel,',
  'html.ak-apk-pos-only[data-ak-apk-edition="staff"] body.ak-license-locked main>#backup>#akFirebasePanel { display:block!important; }',
  'html.ak-apk-pos-only[data-ak-apk-edition="platform-owner"] body.ak-license-locked main>#backup>#akPaywallNotice,',
  'html.ak-apk-pos-only[data-ak-apk-edition="platform-owner"] body.ak-license-locked main>#backup>#akSubscriptionPayment,',
  'html.ak-apk-pos-only[data-ak-apk-edition="platform-owner"] #akMerchantJoinPanel { display:none!important; }',
  'html.ak-apk-pos-only[data-ak-apk-edition="shop-owner"] #akMerchantJoinPanel,',
  'html.ak-apk-pos-only[data-ak-apk-edition="shop-owner"] #akFirebasePanel button[onclick="firebaseGoogleLogin()"],',
  'html.ak-apk-pos-only[data-ak-apk-edition="shop-owner"] #akOnboardingGoogleButton,',
  'html.ak-apk-pos-only[data-ak-apk-edition="staff"] #akFirebasePanel button[onclick="firebaseGoogleLogin()"],',
  'html.ak-apk-pos-only[data-ak-apk-edition="staff"] #akOnboardingGoogleButton { display:none!important; }',
  'html.ak-apk-pos-only[data-ak-apk-edition="staff"] body.ak-license-locked #nav { display:none!important; }',
  'html.ak-apk-pos-only[data-ak-apk-edition="staff"] body.ak-license-locked main>.view:not(#backup) { display:none!important; }',
  'html.ak-apk-pos-only[data-ak-apk-edition="staff"] body.ak-license-locked main>#backup>.panel:not(#akFirebasePanel) { display:none!important; }',
  'html.ak-apk-pos-only[data-ak-apk-edition="staff"] body.ak-license-locked main>#backup>#akPaywallNotice,',
  'html.ak-apk-pos-only[data-ak-apk-edition="staff"] body.ak-license-locked main>#backup>#akSubscriptionPayment,',
  'html.ak-apk-pos-only[data-ak-apk-edition="staff"] body.ak-license-locked main>#backup>#akLicensePanel { display:none!important; }',
  'html.ak-apk-pos-only[data-ak-apk-edition="staff"] #akMerchantJoinPanel { display:block!important; }',
  'html.ak-apk-pos-only[data-ak-apk-edition="platform-owner"] #akSubscriptionPayment,',
  'html.ak-apk-pos-only[data-ak-apk-edition="staff"] #akSubscriptionPayment { display:none!important; }',
  '</style>'
].join('\n');

const headEnd = html.indexOf('</head>');
if (headEnd < 0) throw new Error('HTML head closing tag not found.');
html = html.slice(0, headEnd) + editionCss + '\n' + html.slice(headEnd);

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const selected = editions[edition];
config.appId = selected.appId;
config.appName = selected.appName;
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
fs.writeFileSync(htmlPath, html);

console.log('APK edition ready:', edition, '| appId:', config.appId, '| AI removed | Market isolated | Merchant Code:', edition === 'staff' ? 'staff-only' : 'hidden');
