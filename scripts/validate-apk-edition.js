'use strict';
const fs = require('fs');
const path = require('path');
const edition = String(process.env.AK_APK_EDITION || '').trim().toLowerCase();
const expected = {
  'platform-owner': { appId: 'com.ak.hardware.sales', appName: 'AK Platform Owner' },
  'shop-owner': { appId: 'com.ak.hardware.sales.shop', appName: 'AK Sale Shop Owner' },
  'staff': { appId: 'com.ak.hardware.sales.staff', appName: 'AK Sale Staff' }
}[edition];
if (!expected) throw new Error('Unknown APK edition: ' + edition);
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'www', 'index.html'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
const failures = [];
for (const [label, condition] of [
  ['edition marker', html.includes('data-ak-apk-edition="' + edition + '"')],
  ['correct Android package ID', config.appId === expected.appId],
  ['correct launcher app name', config.appName === expected.appName],
  ['public Market mode hard-disabled', html.includes('const publicMode=false;')],
  ['Market mode returns before moving login panel', html.includes('const publicMode=false;') && html.includes('if(!publicMode)return;')],
  ['Merchant Code panel isolated by ID', html.includes('id="akMerchantJoinPanel"')],
  ['edition role guard', html.includes('const edition=document.documentElement.getAttribute("data-ak-apk-edition")')],
  ['AI ad composer removed', !html.includes('<h3>AI ကြော်ငြာစာသား</h3>')],
  ['AI security panel removed', !html.includes('<h2>AI လုံခြုံရေးစစ်ဆေးမှု</h2>')],
  ['local ZXing bundle exists', fs.existsSync(path.join(root, 'www', 'vendor', 'zxing.min.js'))],
  ['local ZXing used by APK scanner', html.includes('s.src="./vendor/zxing.min.js";s.async=true;')]
]) {
  if (!condition) failures.push(label);
}
if (edition === 'staff' && !html.includes('data-ak-apk-edition="staff"] #akMerchantJoinPanel { display:block!important;')) {
  failures.push('Merchant Code is visible only in Staff edition');
}
if (edition !== 'staff' && !html.includes('id="akMerchantJoinPanel"')) failures.push('Merchant Code panel markup');
if (failures.length) throw new Error('APK edition validation failed: ' + failures.join('; '));
console.log('APK edition validated:', edition, '| package:', config.appId, '| Market isolated | Merchant Code edition scoped | AI removed | local ZXing ready');
