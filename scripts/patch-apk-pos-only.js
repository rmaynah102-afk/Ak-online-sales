'use strict';

// APK-only POS edition. This patches generated www/index.html only.
const fs = require('fs');
const path = require('path');
const target = path.resolve(__dirname, '..', 'www', 'index.html');
if (!fs.existsSync(target)) throw new Error('APK web bundle missing: run npm run copy-web first.');
let html = fs.readFileSync(target, 'utf8');
const marker = '/* AK_APK_POS_ONLY_MARKET_ISOLATION_V5 */';
if (html.includes(marker)) { console.log('APK POS-only isolation already applied.'); process.exit(0); }

function replaceExactly(oldText, newText, expected = 1) {
  const count = html.split(oldText).length - 1;
  if (count !== expected) throw new Error('Expected ' + expected + ' occurrence(s), found ' + count + ': ' + oldText.slice(0, 100));
  html = html.replace(oldText, newText);
}

if (!html.includes('<html lang="my">')) throw new Error('HTML root language tag not found.');
html = html.replace('<html lang="my">', '<html lang="my" class="ak-apk-pos-only">');
replaceExactly('const publicViews=["backup","market","account","payment","staffJoin"];', 'const publicViews=["backup","account","payment","staffJoin"];');
replaceExactly('const publicMode=params.get("market")==="1" && params.get("app")!=="1";', 'const publicMode=false; /* APK: never move login or Merchant Code into Market. */');
replaceExactly('if(new URLSearchParams(location.search).get("market")==="1")document.documentElement.classList.add("ak-public-market");','/* APK POS-only: public Market URL mode disabled. */');
replaceExactly('s.src="https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js";s.async=true;','s.src="./vendor/zxing.min.js";s.async=true;');
// Keep the real Marketplace section ID unchanged. Rewriting it to "backup" created duplicate IDs and exposed Market inside the APK login/backup view.
replaceExactly('name:"Ak shopping markets"','name:"AK Hardware & Electrical"');
// Subscription onboarding patch already removes public shop/listing loaders from the APK auth listener.
replaceExactly(
  'if(typeof loadSponsoredAds==="function")void loadSponsoredAds();',
  '/* APK POS-only: sponsored-ad and Marketplace loaders disabled. */'
);
replaceExactly('<button type="button" class="alt" onclick="akSendProductToMarket()">Market ကြော်ငြာတင်ရန်</button>', '');
replaceExactly('Viber ကိုနှိပ်လျှင် ပုံနှင့်စာကို Share Menu မှတစ်ဆင့် ကိုယ့် Channel သို့ ရွေးပို့နိုင်သည်။ Market ကိုနှိပ်လျှင် အချက်အလက်များကို အလိုအလျောက်ဖြည့်ပေးမည်။','Viber ကိုနှိပ်လျှင် ပုံနှင့်စာကို Share Menu မှတစ်ဆင့် ကိုယ့် Channel သို့ ရွေးပို့နိုင်သည်။');
replaceExactly('<meta name="description" content="AK Market — မြန်မာနိုင်ငံတစ်ဝန်း ပစ္စည်းဝယ်ယူရောင်းချရန် အခမဲ့ Online Marketplace။ ပစ္စည်းပုံ၊ ကျပ်ဈေးနှုန်း၊ မြို့နယ်နှင့် ဖုန်း/Viber ဆက်သွယ်ရန် တစ်နေရာတည်း။">','<meta name="description" content="AK Sale Software — Hardware & Electrical ဆိုင်များအတွက် အရောင်း၊ ကုန်ပစ္စည်း၊ အကြွေးနှင့် အမြတ်စာရင်း စီမံခန့်ခွဲမှု။">');
replaceExactly('<meta name="application-name" content="AK Market">','<meta name="application-name" content="AK Sale Software">');
replaceExactly('<meta property="og:title" content="AK Market | မြန်မာ့ Online Shopping ဈေးကွက်">','<meta property="og:title" content="AK Sale Software | Hardware & Electrical POS">');
replaceExactly('<meta property="og:description" content="ပစ္စည်းကြော်ငြာ အခမဲ့တင်ပါ။ မြို့နယ်အလိုက် ရှာဖွေပါ။ ဆိုင်နှင့် ရောင်းသူကို ဖုန်း/Viber ဖြင့် တိုက်ရိုက်ဆက်သွယ်ပါ။">','<meta property="og:description" content="Hardware & Electrical ဆိုင်များအတွက် အရောင်း၊ ကုန်ပစ္စည်း၊ အကြွေးနှင့် အမြတ်စာရင်း စီမံခန့်ခွဲမှု။">');
replaceExactly('<title>AK Market | မြန်မာ့ Online Shopping ဈေးကွက်</title>','<title>AK Sale Software | Hardware & Electrical POS</title>');
replaceExactly('<footer>Ak shopping markets · Myanmar Retail & Market Platform</footer>','<footer>AK Sale Software · Hardware & Electrical Shop POS</footer>');
replaceExactly('ဆိုင်သုံး POS ကို အသုံးပြုရန် Login နှင့် အသုံးပြုခွင့်လိုအပ်သည်။ AK Market၊ အတည်ပြုဆိုင်စာရင်းနှင့် ကြော်ငြာများကို အများပြည်သူ ကြည့်ရှုနိုင်သည်။','ဆိုင်သုံး POS ကို အသုံးပြုရန် Gmail Login နှင့် အသုံးပြုခွင့်လိုအပ်သည်။ Package ရွေးချယ်ပြီး ငွေပေးချေမှု တင်ပြနိုင်ပါသည်။');
replaceExactly('if(typeof loadMarket==="function")await loadMarket()', '/* APK POS-only: do not load public Marketplace listings. */', 2);
replaceExactly('applyAkTheme();renderAll();loadMarket();', 'applyAkTheme();renderAll();');
replaceExactly('connectPublicCatalog();', '/* APK POS-only: public catalog listener disabled. */');
replaceExactly(
  'if(!akLiveRefreshTimer)akLiveRefreshTimer=setInterval(()=>{if(fbStore&&document.visibilityState==="visible"&&document.visibilityState!=="hidden")loadMarket(true)},300000);',
  '/* APK POS-only: Marketplace polling disabled. */'
);

const css = `
<style id="ak-apk-pos-only">
/* AK_APK_POS_ONLY_MARKET_ISOLATION_V5 */
html.ak-apk-pos-only #market,
html.ak-apk-pos-only #nav button[data-view="market"],
html.ak-apk-pos-only #akOwnerPromoPanel,
html.ak-apk-pos-only #akMarketReportsPanel,
html.ak-apk-pos-only #akPublicSponsoredSection { display:none!important; }
html.ak-apk-pos-only body.ak-license-locked main>#backup>.panel:not(#akPaywallNotice):not(#akSubscriptionPayment):not(#akLicensePanel):not(#akFirebasePanel) {
  display:none!important;
}
html.ak-apk-pos-only body.ak-license-locked main>#backup>#akPaywallNotice { display:block!important; order:0; }
html.ak-apk-pos-only body.ak-license-locked main>#backup>#akSubscriptionPayment { display:block!important; order:1; }
html.ak-apk-pos-only body.ak-license-locked main>#backup>#akFirebasePanel { display:block!important; order:1; }
html.ak-apk-pos-only #akSubscriptionPayment .ak-plan-option { min-height:64px; white-space:normal; }
html.ak-apk-pos-only #akSubscriptionPayment #akPaymentProofStep { margin-top:14px; }
</style>
`;
const headEnd = html.indexOf('</head>');
if (headEnd < 0) throw new Error('HTML head closing tag not found.');
html = html.slice(0, headEnd) + css + '\n' + html.slice(headEnd);
fs.writeFileSync(target, html);
console.log('APK POS-only isolation V4 applied: Market removed; locked app shows only package/Gmail/payment onboarding; POS stays locked until server-approved license.');
