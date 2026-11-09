'use strict';

// APK-only POS edition. This patches generated www/index.html only.
// It deliberately leaves app.html (the public website / Marketplace) untouched.
const fs = require('fs');
const path = require('path');
const target = path.resolve(__dirname, '..', 'www', 'index.html');
if (!fs.existsSync(target)) throw new Error('APK web bundle missing: run npm run copy-web first.');
let html = fs.readFileSync(target, 'utf8');
const marker = '/* AK_APK_POS_ONLY_MARKET_ISOLATION_V1 */';
if (html.includes(marker)) { console.log('APK POS-only isolation already applied.'); process.exit(0); }

function replaceExactly(oldText, newText, expected = 1) {
  const count = html.split(oldText).length - 1;
  if (count !== expected) throw new Error('Expected ' + expected + ' occurrence(s), found ' + count + ': ' + oldText.slice(0, 100));
  html = html.replace(oldText, newText);
}

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
/* AK_APK_POS_ONLY_MARKET_ISOLATION_V1 */
#market,
#nav button[data-view="market"],
body.ak-license-locked main>#market.view.active,
body.ak-license-locked #nav button[data-view="market"] {
  display: none !important;
}
</style>
`;
if (!html.includes('</head>')) throw new Error('HTML head closing tag not found.');
html = html.replace('</head>', css + '\\n</head>');
html = html.replace('</body>', '<script>/* AK_APK_POS_ONLY_MARKET_ISOLATION_V1 */</script>\\n</body>');
fs.writeFileSync(target, html);
console.log('APK POS-only isolation applied: Marketplace tab hidden, locked-user route redirected to subscription panel, public catalog startup/listeners/polling disabled. Website source remains unchanged.');
