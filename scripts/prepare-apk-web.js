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
replaceExactly('<title>AK Market | မြန်မာ့ Online Shopping ဈေးကွက်</title>', '<title>AK Sale Software · Hardware & Electrical POS</title>');
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

/* AK Sale POS brand system: Navy + Gold. Keep the existing dark mode intact. */
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) {
  --g:#0b1f46; --g2:#1457bd; --bg:#f3f6fb; --line:#dce5f1;
  --gold:#fff3d2; --ink:#172943; --muted:#66778e;
  --accent:#f4bd4f;
}
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) body {
  background:linear-gradient(180deg,#eaf0fa 0,#f3f6fb 260px)!important;
  color:#172943!important;
}
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) header {
  background:linear-gradient(110deg,#07152e,#164b91)!important;
  color:#fff!important; border-bottom:3px solid #f4bd4f!important;
  box-shadow:0 8px 26px #07152e22;
}
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) nav {
  background:#f3f6fb!important;
}
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) nav button,
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) button:not(.alt):not(.red),
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) .btn {
  background:linear-gradient(110deg,#164b91,#2474df)!important;
  color:#fff!important; border:1px solid #f0c35d!important;
  border-radius:11px!important; font-weight:700;
}
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) button.alt {
  background:#eaf1fb!important;color:#17457f!important;border:1px solid #d5e1f1!important;
}
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) .panel {
  background:#fff!important;border:1px solid #dce5f1!important;
  border-radius:15px!important;box-shadow:0 7px 22px #142b4a0b;
}
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) h2,
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) h3 {color:#0b1f46!important}
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) .stat {color:#1457bd!important}
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) th {
  background:#eaf0fa!important;color:#17365f!important;
}
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) input,
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) select,
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) textarea {
  border-color:#cbd7e7!important;border-radius:10px!important;
}
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) .notice {
  background:#fff5dc!important;color:#684b0b!important;border:1px solid #f0d58d;
}
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) #nav button.active,
html.ak-apk-pos-only:not(.ak-dark):not([data-theme="dark"]) #nav button[aria-current="page"] {
  background:linear-gradient(110deg,#f4bd4f,#f8d98b)!important;color:#10264b!important;
  border:1px solid #d8a43c!important;
}
</style>`;
const headClose = html.indexOf('</head>');
if (headClose < 0) throw new Error('HTML head closing tag not found.');
html = html.slice(0, headClose) + css + html.slice(headClose);
if (!html.includes('const OWNER_EMAIL="painglin102@gmail.com";')) throw new Error('Platform Owner allowlist is not painglin102@gmail.com.');
if (!html.includes('data-view="ownerDashboard"') || !html.includes('id="akOwnerStaffPanel"')) throw new Error('Owner Dashboard or shop staff management is missing.');
fs.writeFileSync(targetPath, html, 'utf8');
console.log('Prepared APK-only POS source from apk/app.html; Market is disabled and website source is untouched.');
