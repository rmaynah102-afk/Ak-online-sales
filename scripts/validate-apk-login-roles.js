'use strict';
const fs = require('fs');
const html = fs.readFileSync('www/index.html', 'utf8');
const functions = fs.readFileSync('functions/index.js', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');
const printer = fs.readFileSync('native/android/AkPrinterPlugin.java', 'utf8');
const config = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8'));
const owner = 'painglin102@gmail.com';
const checks = [
 ['APK-only source marker', html.includes('class="ak-apk-pos-only"')],
 ['Platform Owner Gmail in APK', html.includes('const OWNER_EMAIL="'+owner+'";')],
 ['Platform Owner Login option', html.includes('<option value="owner">Platform Owner Login')],
 ['Shop Owner Login option', html.includes('<option value="shop" selected>ဆိုင်ရှင် Login')],
 ['Staff Login option', html.includes('<option value="staff">ဝန်ထမ်း Login')],
 ['Owner email restricted to Owner mode', html.includes('mode==="owner"&&email!==ownerEmail')],
 ['Shop Owner cannot use Platform Owner Gmail', html.includes('mode==="shop"&&email===ownerEmail')],
 ['Staff cannot use Platform Owner Gmail', html.includes('mode==="staff"&&email===ownerEmail')],
 ['Staff Merchant Code claim flow', html.includes('httpsCallable("claimShopInviteCode")')],
 ['Owner identity requires verified email', html.includes('emailVerified===true')],
 ['Role-based navigation', html.includes('function akApplyRoleNavigation()')],
 ['Shop owner staff management panel', html.includes('id="akOwnerStaffPanel"')],
 ['Separate Market website mode disabled', html.includes('const publicMode=false;') && !html.includes('document.documentElement.classList.add("ak-public-market");')],
 ['Market navigation hidden in APK', html.includes('html.ak-apk-pos-only #nav button[data-view="market"]')],
 ['Scanner uses bundled ZXing', html.includes('s.src="./vendor/zxing.min.js";s.async=true;') && fs.existsSync('www/vendor/zxing.min.js')],
 ['Firebase Functions owner matches APK', functions.includes('const OWNER_EMAIL = "'+owner+'";')],
 ['Firestore rules owner matches APK', rules.includes("request.auth.token.email == '"+owner+"'")],
 ['Native printer plugin source present', printer.includes('class AkPrinterPlugin')],
 ['Owner account provisioning callable', functions.includes('exports.createShopOwnerAccount') && functions.includes('exports.verifyShopOwnerLogin')],
 ['Owner password never stored in Firestore', functions.includes('Passwords are sent only to') && !functions.includes('password: password') && !functions.includes('passwordConfigured: password')],
 ['Owner assigns package and expiry', functions.includes('planDays, priceMMK: planPrices[planDays]') && functions.includes('expiresAt, emailVerified: true')],
 ['Shop owner login checks assigned package', html.includes('httpsCallable("verifyShopOwnerLogin")') && html.includes('id="akLoginPackage"')],
 ['Owner dashboard Gmail/password/verify form', html.includes('id="akProvisionEmail"') && html.includes('id="akProvisionPassword"') && html.includes('id="akProvisionVerifyButton"')],
 ['Owner account list shows sequential numbers', html.includes('id="akOwnerShopRows"') && html.includes('function akRenderOwnerShopRows()')],
 ['Shop owner self-registration hidden', html.includes('reg.style.display=mode==="staff"?"":"none"')],
 ['Android package name stable', config.appId === 'com.ak.hardware.sales']
];
for (const [label, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + label);
const failed = checks.filter(([,ok]) => !ok).map(([label]) => label);
if (failed.length) throw new Error('AK APK role/login validation failed: ' + failed.join('; '));
console.log('Validated', checks.length, 'APK role/security checks. Inline JavaScript syntax is checked against apk/app.html before packaging.');
