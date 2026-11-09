'use strict';

// APK-only POS edition. This patches generated www/index.html only.
const fs = require('fs');
const path = require('path');
const target = path.resolve(__dirname, '..', 'www', 'index.html');
if (!fs.existsSync(target)) throw new Error('APK web bundle missing: run npm run copy-web first.');
let html = fs.readFileSync(target, 'utf8');
const marker = '/* AK_APK_POS_ONLY_MARKET_ISOLATION_V4 */';
if (html.includes(marker)) { console.log('APK POS-only isolation already applied.'); process.exit(0); }

function replaceExactly(oldText, newText, expected = 1) {
  const count = html.split(oldText).length - 1;
  if (count !== expected) throw new Error('Expected ' + expected + ' occurrence(s), found ' + count + ': ' + oldText.slice(0, 100));
  html = html.replace(oldText, newText);
}

if (!/<html\s+lang="my">/i.test(html)) throw new Error('HTML root language tag not found.');
html = html.replace(/<html\s+lang="my">/i, '<html lang="my" class="ak-apk-pos-only">');
replaceExactly('const publicViews=["backup","market"];', 'const publicViews=["backup"];');
replaceExactly('if(new URLSearchParams(location.search).get("market")==="1")document.documentElement.classList.add("ak-public-market");','/* APK POS-only: public Market URL mode disabled. */');
replaceExactly('id="market";', 'id="backup";');
replaceExactly('name:"Ak shopping markets"','name:"AK Hardware & Electrical"');
replaceExactly(
  'if(typeof loadSponsoredAds==="function")void loadSponsoredAds();if(typeof loadPublicShops==="function")void loadPublicShops();if(typeof loadMyMarketListings==="function")void loadMyMarketListings();',
  '/* APK POS-only: Marketplace background loaders disabled. */'
);
replaceExactly('<button type="button" class="alt" onclick="akSendProductToMarket()">Market ကြော်ငြာတင်ရန်</button>', '');
replaceExactly('Viber ကိုနှိပ်လျှင် ပုံနှင့်စာကို Share Menu မှတစ်ဆင့် ကိုယ့် Channel သို့ ရွေးပို့နိုင်သည်။ Market ကိုနှိပ်လျှင် အချက်အလက်များကို အလိုအလျောက်ဖြည့်ပေးမည်။','Viber ကိုနှိပ်လျှင် ပုံနှင့်စာကို Share Menu မှတစ်ဆင့် ကိုယ့် Channel သို့ ရွေးပို့နိုင်သည်။');
replaceExactly('Myanmar shop POS, inventory, wholesale, retail, sales records and AK Shopping Markets.','Myanmar shop POS, inventory, wholesale, retail and sales records.');
replaceExactly('AK Sale Software · AK Shopping Markets','AK Sale Software · Shop POS');
replaceExactly('ဆိုင်အရောင်း၊ ကုန်ပစ္စည်း၊ စာရင်းနှင့် မြန်မာ့အွန်လိုင်းဈေးကွက်','ဆိုင်အရောင်း၊ ကုန်ပစ္စည်း၊ စာရင်းနှင့် အမြတ်အရှုံး စီမံခန့်ခွဲမှု');
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
/* AK_APK_POS_ONLY_MARKET_ISOLATION_V4 */
html.ak-apk-pos-only #market,
html.ak-apk-pos-only #nav button[data-view="market"],
html.ak-apk-pos-only #akFirebasePanel { display:none!important; }
html.ak-apk-pos-only body.ak-license-locked #nav { display:none!important; }
html.ak-apk-pos-only body.ak-license-locked main>#backup>.panel:not(#akPaywallNotice):not(#akSubscriptionPayment):not(#akLicensePanel) {
  display:none!important;
}
html.ak-apk-pos-only body.ak-license-locked main>#backup>#akPaywallNotice { display:block!important; order:0; }
html.ak-apk-pos-only body.ak-license-locked main>#backup>#akSubscriptionPayment { display:block!important; order:1; }
html.ak-apk-pos-only #akSubscriptionPayment .ak-plan-option { min-height:64px; white-space:normal; }
html.ak-apk-pos-only #akSubscriptionPayment #akPaymentProofStep { margin-top:14px; }
</style>
`;
const headEnd = html.lastIndexOf('</head>');
if (headEnd < 0) throw new Error('HTML head closing tag not found.');
html = html.slice(0, headEnd) + css + '\n' + html.slice(headEnd);
fs.writeFileSync(target, html);
console.log('APK POS-only isolation V4 applied: Market removed; locked app shows only package/Gmail/payment onboarding; POS stays locked until server-approved license.');
