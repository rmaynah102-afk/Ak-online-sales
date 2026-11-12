'use strict';
const fs = require('fs');
const path = require('path');
const sourcePath = path.join(__dirname, '..', 'apk', 'app.html');
const targetPath = path.join(__dirname, '..', 'www', 'index.html');
if (!fs.existsSync(sourcePath) || !fs.existsSync(path.dirname(targetPath))) {
  throw new Error('APK source or prepared www directory is missing. Run npm run copy-web first.');
}
let html = fs.readFileSync(sourcePath, 'utf8');
function replaceExactly(oldText, newText, expected = 1) {
  const count = html.split(oldText).length - 1;
  if (count !== expected) throw new Error('Expected ' + expected + ' occurrence(s), found ' + count + ': ' + oldText.slice(0, 120));
  html = html.replace(oldText, newText);
}
const root = '<html lang="my">';
if (!html.startsWith('<!DOCTYPE html>\n' + root)) throw new Error('Unexpected APK HTML root; refusing to patch the wrong source.');
html = html.replace(root, '<html lang="my" class="ak-apk-pos-only">');
replaceExactly('<title>AK Sale Software | Hardware & Electrical POS</title>', '<title>AK Sale Software · Hardware & Electrical POS</title>');
replaceExactly('const publicMode=params.get("market")==="1" && params.get("app")!=="1";', 'const publicMode=false; /* APK POS edition: public Market is website-only. */');
replaceExactly('if(new URLSearchParams(location.search).get("market")==="1")document.documentElement.classList.add("ak-public-market");', '/* APK POS edition: ignore public Market query parameters. */');
replaceExactly('const publicViews=["backup","market","account","payment","staffJoin"];', 'const publicViews=["backup","account","payment","staffJoin"];');
replaceExactly('  id="market";', '  id="account";');
replaceExactly('s.src="https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js";s.async=true;', 's.src="./vendor/zxing.min.js";s.async=true;');
const css = `<style id="ak-apk-pos-only">
html.ak-apk-pos-only #market,
html.ak-apk-pos-only #nav button[data-view="market"],
html.ak-apk-pos-only #akMarketReportsPanel,
html.ak-apk-pos-only #akPublicSponsoredSection,
html.ak-apk-pos-only #akPublicShopsPanel {display:none!important}
html.ak-apk-pos-only main>#market.view {display:none!important}
</style>`;
const headClose = html.indexOf('</head>');
if (headClose < 0) throw new Error('HTML head closing tag not found.');
html = html.slice(0, headClose) + css + html.slice(headClose);
if (!html.includes('const OWNER_EMAIL="painglin102@gmail.com";')) throw new Error('Platform Owner allowlist is not painglin102@gmail.com.');
if (!html.includes('data-view="ownerDashboard"') || !html.includes('id="akOwnerStaffPanel"')) throw new Error('Owner Dashboard or shop staff management is missing.');
fs.writeFileSync(targetPath, html, 'utf8');
console.log('Prepared APK-only POS source from apk/app.html; Market is disabled and website source is untouched.');
