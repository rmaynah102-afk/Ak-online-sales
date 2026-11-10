'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'www', 'index.html'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
const checks = [
  ['single universal APK marker', html.includes('data-ak-apk-edition="universal"')],
  ['single stable Android package', config.appId === 'com.ak.hardware.sales'],
  ['single launcher name', config.appName === 'AK Sale Software'],
  ['Market disabled inside APK', html.includes('const publicMode=false;') && html.includes('if(!publicMode)return;')],
  ['Market login relocation disabled', !html.includes('marketForm.parentElement.before(authPanel)')],
  ['Merchant Code panel exists only in POS login', html.includes('id="akMerchantJoinPanel"')],
  ['role determined from Firebase identity', html.includes('function checkUserRole(user)') && html.includes('claims.shopId?String(claims.shopRole||"staff").toLowerCase():"shop-owner"')],
  ['role-based navigation exists', html.includes('function akApplyRoleNavigation()')],
  ['Platform Owner email gate exists', html.includes('function akIsPlatformOwner(user=fbUser)')],
  ['staff Merchant Code callable exists', html.includes('httpsCallable("claimShopInviteCode")')],
  ['shop owner staff management exists', html.includes('httpsCallable("createShopInviteCode")') && html.includes('httpsCallable("listShopStaff")')],
  ['AI ad composer removed', !html.includes('<h3>AI ကြော်ငြာစာသား</h3>')],
  ['AI security panel removed', !html.includes('<h2>AI လုံခြုံရေးစစ်ဆေးမှု</h2>')],
  ['local ZXing scanner bundled', fs.existsSync(path.join(root, 'www', 'vendor', 'zxing.min.js')) && html.includes('s.src="./vendor/zxing.min.js";s.async=true;')],
  ['Thermer receipt sharing present', html.includes('Thermer / Printer App သို့ပို့') && html.includes('chooserTitle')],
  ['native printer plugin installed', fs.existsSync(path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'ak', 'hardware', 'sales', 'AkPrinterPlugin.java'))]
];
const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
for (const [name, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + name);
if (failed.length) throw new Error('Universal APK validation failed: ' + failed.join('; '));
console.log('Universal APK validation passed. Shop isolation and permissions remain enforced by Firebase rules and callable backend.');
