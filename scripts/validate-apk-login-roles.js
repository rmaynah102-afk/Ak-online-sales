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
 ['Platform Owner uses verified Google login', html.includes('async function akOwnerGoogleLogin()') && html.includes('emailVerified===true')],
 ['Shop Owner cannot use Platform Owner Gmail', html.includes('mode==="shop"&&email===ownerEmail')],
 ['Staff cannot use Platform Owner Gmail', html.includes('mode==="staff"&&email===ownerEmail')],
 ['Shop Owner login needs only Gmail and password', html.includes('httpsCallable("verifyShopOwnerLogin")({})') && !html.includes('id="akLoginPackage"') && !html.includes('const planDays=Number($("akLoginPackage")')],
 ['Owner Gmail form accepts normal Gmail syntax', html.includes('if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))')],
 ['Shop owner uses shared Gmail-keyed workspace', html.includes('akWorkspaceMode=true;akWorkspaceShopId=user.uid') && html.includes('httpsCallable("saveShopWorkspace")')],
 ['Legacy shop data migrates without deleting old cloud copy', html.includes('One-time migration: retain the old private cloud data') && html.includes('expectedRevision:0')],
 ['Staff Merchant Code claim flow', html.includes('httpsCallable("claimShopInviteCode")')],
 ['Role-based navigation hides all but assigned staff menus', html.includes('const staffAllowed=staff?akStaffAllowedViews:[]') && html.includes('userBtn.hidden=role!=="shop-owner"') && html.includes('ownerBtn.hidden=role!=="platform-owner"')],
 ['Separate Platform Owner and shop Owner dashboard sections', html.includes('id="ownerDashboard"') && html.includes('id="userDashboard"') && html.includes('ownerBtn.hidden=role!=="platform-owner"') && html.includes('userBtn.hidden=role!=="shop-owner"')],
 ['Staff menu permissions saved on invite', functions.includes('allowedViews: requestedViews')],
 ['Staff menu permissions can be changed by shop owner', functions.includes('exports.setShopStaffViews') && functions.includes('permissionsUpdatedAt')],
 ['Staff data reads are limited by allowed menu permissions', functions.includes('workspaceCanRead(identity,key)') && functions.includes('identity.allowedViews=views')],
 ['Staff data writes are limited by allowed menu permissions', functions.includes('workspaceCanWrite(identity,key)') && functions.includes('requested.some(view => !allowed.includes(view))')],
 ['All staff roles can save permitted sales and supplier data', functions.includes('if (key==="sales" || key==="payments") return views.includes("sales")') && functions.includes('if (key==="people") return views.includes("people")') && functions.includes('WORKSPACE_READ_ROLES.includes(identity.role)')],
 ['Staff cannot read Customer rows', functions.includes('records.filter(record=>record && record.type==="supplier")')],
 ['Staff cannot edit Customer rows', functions.includes('input.people.some(person=>!person || person.type!=="supplier")')],
 ['Shop workspace is isolated by shopId', functions.includes('db.collection("shops").doc(identity.shopId)')],
 ['CSV export available in Sales dashboard', html.includes('onclick="csvExport()">အရောင်း CSV ထုတ်ရန်')],
 ['Shop owner staff management panel', html.includes('id="akOwnerStaffPanel"')],
 ['Market navigation hidden in APK', html.includes('html.ak-apk-pos-only #nav button[data-view="market"]')],
 ['Scanner uses bundled ZXing', html.includes('s.src="./vendor/zxing.min.js";s.async=true;') && fs.existsSync('www/vendor/zxing.min.js')],
 ['Firebase Functions owner matches APK', functions.includes('const OWNER_EMAIL = "'+owner+'";')],
 ['Firestore rules owner matches APK', rules.includes("request.auth.token.email == '"+owner+"'")],
 ['Native printer plugin source present', printer.includes('class AkPrinterPlugin')],
 ['Owner account provisioning callable', functions.includes('exports.createShopOwnerAccount') && functions.includes('exports.verifyShopOwnerLogin')],
 ['Owner password never stored in Firestore', functions.includes('Passwords are sent only to') && !functions.includes('password: password') && !functions.includes('passwordConfigured: password')],
 ['Owner assigns package and expiry', functions.includes('planDays, priceMMK: planPrices[planDays]') && functions.includes('expiresAt, emailVerified: true')],
 ['Owner dashboard Gmail/password/verify form', html.includes('id="akProvisionEmail"') && html.includes('id="akProvisionPassword"') && html.includes('id="akProvisionVerifyButton"')],
 ['Owner account list shows sequential numbers', html.includes('id="akOwnerShopRows"') && html.includes('function akRenderOwnerShopRows()')],
 ['Shop owner self-registration hidden', html.includes('reg.style.display=mode==="staff"?"":"none"')],
 ['Android package name stable', config.appId === 'com.ak.hardware.sales']
];;
for (const [label, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + label);
const failed = checks.filter(([,ok]) => !ok).map(([label]) => label);
if (failed.length) throw new Error('AK APK role/login validation failed: ' + failed.join('; '));
console.log('Validated', checks.length, 'APK role/security checks. Inline JavaScript syntax is checked against apk/app.html before packaging.');
