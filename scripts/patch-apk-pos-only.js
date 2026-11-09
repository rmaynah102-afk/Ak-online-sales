'use strict';

// APK-only POS edition. This patches generated www/index.html only.
// It deliberately leaves app.html (the public website / Marketplace) untouched.
const fs = require('fs');
const path = require('path');
const target = path.resolve(__dirname, '..', 'www', 'index.html');
if (!fs.existsSync(target)) throw new Error('APK web bundle missing: run npm run copy-web first.');
let html = fs.readFileSync(target, 'utf8');
const marker = '/* AK_APK_POS_ONLY_MARKET_ISOLATION_V2 */';
if (html.includes(marker)) { console.log('APK POS-only isolation already applied.'); process.exit(0); }

function replaceExactly(oldText, newText, expected = 1) {
  const count = html.split(oldText).length - 1;
  if (count !== expected) throw new Error('Expected ' + expected + ' occurrence(s), found ' + count + ': ' + oldText.slice(0, 100));
  html = html.replace(oldText, newText);
}

replaceExactly('<html lang="my">', '<html lang="my" class="ak-apk-pos-only">');
replaceExactly('const publicViews=["backup","market"];', 'const publicViews=["backup"];');
replaceExactly('id="market";', 'id="backup";');
replaceExactly(
  'if(typeof loadSponsoredAds==="function")void loadSponsoredAds();if(typeof loadPublicShops==="function")void loadPublicShops();if(typeof loadMyMarketListings==="function")void loadMyMarketListings();',
  '/* APK POS-only: Marketplace background loaders disabled. */'
);
replaceExactly('if(typeof loadMarket==="function")await loadMarket()', '/* APK POS-only: do not load public Marketplace listings. */', 2);
replaceExactly('applyAkTheme();renderAll();loadMarket();', 'applyAkTheme();renderAll();');
replaceExactly('connectPublicCatalog();', '/* APK POS-only: public catalog listener disabled. */');
replaceExactly(
  'if(!akLiveRefreshTimer)akLiveRefreshTimer=setInterval(()=>{if(fbStore&&document.visibilityState==="visible"&&document.visibilityState!=="hidden")loadMarket(true)},300000);',
  '/* APK POS-only: Marketplace polling disabled. */'
);

const css = `
<style id="ak-apk-pos-only">
/* AK_APK_POS_ONLY_MARKET_ISOLATION_V2 */
html.ak-apk-pos-only #market,
html.ak-apk-pos-only #nav button[data-view="market"],
html.ak-apk-pos-only body #market,
html.ak-apk-pos-only body #nav button[data-view="market"] {
  display: none !important;
}
</style>
`;
if (!html.includes('</head>')) throw new Error('HTML head closing tag not found.');
html = html.replace('</head>', css + '\n</head>');
fs.writeFileSync(target, html);
console.log('APK POS-only isolation V2 applied: high-specificity Marketplace hide, route redirect, public catalog startup/listeners/polling disabled. Website source remains unchanged.');
