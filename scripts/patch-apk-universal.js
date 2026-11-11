'use strict';

// Build one universal AK Sale APK. The signed-in Firebase account role controls access;
// the server-side role claims and shop isolation remain authoritative.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'www', 'index.html');
const configPath = path.join(root, 'capacitor.config.json');
if (!fs.existsSync(htmlPath) || !fs.existsSync(configPath)) {
  throw new Error('APK bundle or Capacitor config is missing. Run npm run copy-web first.');
}
let html = fs.readFileSync(htmlPath, 'utf8');
if (!html.includes('/* AK_APK_POS_ONLY_MARKET_ISOLATION_V5 */') ||
    !html.includes('const publicMode=false;')) {
  throw new Error('APK Market isolation must be applied before creating the universal APK.');
}
if (html.includes('AK_APK_UNIVERSAL_V1')) {
  throw new Error('Universal APK patch has already been applied.');
}
function replaceExactly(oldText, newText, expected = 1) {
  const count = html.split(oldText).length - 1;
  if (count !== expected) throw new Error('Expected ' + expected + ' occurrence(s), found ' + count + ': ' + oldText.slice(0, 100));
  html = html.replace(oldText, newText);
}
const rootTag = '<html lang="my" class="ak-apk-pos-only">';
replaceExactly(rootTag, '<html lang="my" class="ak-apk-pos-only" data-ak-apk-edition="universal">');

// Keep the staff Merchant Code login mode in the POS login panel, never in the public Market.
replaceExactly(
  '<div class="panel" style="margin:10px 0"><label for="akLoginMode">',
  '<div class="panel" id="akMerchantJoinPanel" style="margin:10px 0"><label for="akLoginMode">'
);

// Remove unsupported AI panels from the APK while preserving ordinary ad sharing.
for (const token of ['<h3>AI ကြော်ငြာစာသား</h3>', '<h2>AI လုံခြုံရေးစစ်ဆေးမှု</h2>']) {
  const lines = html.split('\n');
  const matches = lines.filter(line => line.includes(token)).length;
  if (matches > 1) throw new Error('Expected at most one APK AI panel line for ' + token + ', found ' + matches);
  if (matches === 1) {
    const index = lines.findIndex(line => line.includes(token));
    lines[index] = '  <!-- Universal APK: unsupported AI feature removed -->';
    html = lines.join('\n');
  }
}

// Role is determined from verified Firebase identity and server-issued custom claims.
// A non-platform account can see the Merchant Code join field; platform owner does not need it.
const roleAnchor = 'akApplyRoleNavigation();\n console.log("AK account role:",role,';
const roleReplacement = 'akApplyRoleNavigation();\n const merchantJoin=document.getElementById("akMerchantJoinPanel");if(merchantJoin)merchantJoin.style.display=role==="platform-owner"?"none":"";\n console.log("AK account role:",role,';
replaceExactly(roleAnchor, roleReplacement);

const style = [
  '<style id="ak-apk-universal-v1">',
  '/* AK_APK_UNIVERSAL_V1 · one APK, role-based access */',
  'html.ak-apk-pos-only body.ak-license-locked main>#account #akFirebasePanel { display:block!important; }',
  'html.ak-apk-pos-only body.ak-license-locked main>#payment #akAccessRequestPanel { display:block!important; }',

  'html.ak-apk-pos-only #akMerchantJoinPanel { display:block; }',
  '</style>'
].join('\n');
const headEnd = html.indexOf('</head>');
if (headEnd < 0) throw new Error('HTML head closing tag not found.');
html = html.slice(0, headEnd) + style + '\n' + html.slice(headEnd);

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
config.appId = 'com.ak.hardware.sales';
config.appName = 'AK Sale Software';
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
fs.writeFileSync(htmlPath, html);
console.log('Universal AK Sale APK ready:', config.appId, '| Platform Owner + Shop Owner + Staff | role-based permissions | Market isolated.');
