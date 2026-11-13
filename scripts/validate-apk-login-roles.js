'use strict';
const fs = require('fs');
const html = fs.readFileSync('www/index.html', 'utf8');
const sparkStore = fs.readFileSync('www/spark-pos-store.js', 'utf8');
const functions = fs.readFileSync('functions/index.js', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');
const printer = fs.readFileSync('native/android/AkPrinterPlugin.java', 'utf8');
const config = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8'));
const owner = 'painglin102@gmail.com';
const health = fs.readFileSync('www/ak-health-monitor.js', 'utf8');
const checks = [
 ['APK-only source marker', html.includes('class="ak-apk-pos-only"')],
 ['AI diagnostics module bundled in APK', html.includes('ak-health-monitor.js') && health.includes('window.AKHealthMonitor')],
 ['AI diagnostics screen is owner-restricted', health.includes('view.id="aiMonitor"') && html.includes('data-view="aiMonitor"') && html.includes('shop-owner-only")') && html.includes('id==="aiMonitor"')],
 ['AI diagnostics never edits POS records or licenses', !health.includes('fbStore.collection') && !health.includes('firebase.firestore') && !health.includes('setDoc(') && health.includes('ငွေစာရင်း') && health.includes('လိုင်စင်')],
 ['Platform Owner Gmail in APK', html.includes('const OWNER_EMAIL="'+owner+'";')],
 ['Platform Owner Login option', html.includes('<option value="owner">Platform Owner Login')],
 ['Shop Owner Login option', html.includes('<option value="shop" selected>ဆိုင်ရှင် Login')],\n ['Shop owner login requires Firebase email verification', html.includes('if(!credential.user.emailVerified)') && html.includes('Verification Link ကိုနှိပ်ပြီး ပြန် Login ဝင်ပါ။')],
 ['Staff Login option', html.includes('<option value="staff">ဝန်ထမ်း Login')],
 ['Owner email restricted to Owner mode', html.includes('mode==="owner"&&email!==ownerEmail')],
 ['Shop Owner cannot use Platform Owner Gmail', html.includes('mode==="shop"&&email===ownerEmail')],
 ['Staff cannot use Platform Owner Gmail', html.includes('mode==="staff"&&email===ownerEmail')],
 ['Staff Merchant Code claim flow uses Spark invite claim', html.includes('sparkStore.claimInvite(code)') && html.includes('[A-F0-9]{32}')],
 ['Owner identity requires verified email', html.includes('emailVerified===true')],
 ['Owner Gmail uses Google verification without password entry', html.includes('id="akOwnerGoogleLoginBtn"') && html.includes('async function akOwnerGoogleLogin()') && html.includes('if(mode==="owner")throw Error("Platform Owner သည် Google ဖြင့်သာ Login ဝင်ပါ။");') && html.includes('passwordWrap.classList.toggle("hidden",ownerMode)')],
 ['Role-based navigation', html.includes('function akApplyRoleNavigation()')],
 ['Employee navigation is read-only and excludes sales entry', html.includes('akUserRole==="employee"?["home"]') && html.includes('const allowed=role==="employee"?["home"]')],
 ['Shop owner staff management panel', html.includes('id="akOwnerStaffPanel"')],
 ['Separate Market website mode disabled', html.includes('const publicMode=false;') && !html.includes('document.documentElement.classList.add("ak-public-market");')],
 ['Market navigation hidden in APK', html.includes('html.ak-apk-pos-only #nav button[data-view="market"]')],
 ['Scanner uses bundled ZXing', html.includes('s.src="./vendor/zxing.min.js";s.async=true;') && fs.existsSync('www/vendor/zxing.min.js')],
 ['Firebase Functions owner matches APK', functions.includes('const OWNER_EMAIL = "'+owner+'";')],
 ['Firestore rules owner matches APK', rules.includes("request.auth.token.email == '"+owner+"'")],
 ['Native printer plugin source present', printer.includes('class AkPrinterPlugin') && printer.includes('public void shareReceiptImage(PluginCall call)')],
 ['Native file sharing restricts exports to safe document MIME types', printer.includes('mimeType.equals("text/csv")') && printer.includes('mimeType.equals("text/plain")') && printer.includes('5 * 1024 * 1024')],
 ['APK does not call account-provisioning or login-verification Functions', !html.includes('httpsCallable("createShopOwnerAccount")') && !html.includes('httpsCallable("verifyShopOwnerLogin")')],
 ['Platform Owner capacity is 100 shops', rules.includes('get(/databases/$(database)/documents/platformMeta/shopCapacity).data.activeShopCount < 100') && rules.includes('request.resource.data.activeShopCount <= 100') && html.includes('activeShopCount:count+1')],
 ['In-app payment collection endpoints are absent', !['createPaymentRequest','getPaymentAccountSettings','setPaymentAccountSettings','listPendingPayments','rejectPaymentRequest','approveSubscription'].some(name => functions.includes('exports.'+name+' =')) && !functions.includes('AK_KPAY_ACCOUNT')],
 ['External payment is handled by manual Owner subscription grants', functions.includes('exports.grantSubscription') && functions.includes('Payments are handled outside')],
 ['One-time five-day trial is tied to a Gmail claim', html.includes('freeTrialClaims') && html.includes('plan:"free-trial"') && html.includes('5*86400000')],
 ['Trial automatically locks after five days', html.includes('akFreeTrialExpiryTimer') && html.includes('clearTimeout(akFreeTrialExpiryTimer)') && html.includes('Trial သက်တမ်းကုန်ဆုံးသွားပါပြီ')],
 ['Firestore rules enforce five-day trial expiry', rules.includes("duration.value(5, 'd')") && rules.includes('freeTrialClaims') && rules.includes('request.auth.token.email == email')],
 ['Platform Owner account list reads Spark licenses directly', html.includes('fbStore.collection("licenses").limit(100).get()')],
 ['Platform Owner issues new shop licenses with a transactional capacity counter', html.includes('activeShopCount:count+1') && html.includes('tx.update(counterRef') && rules.includes('lastIssuedUid')],
 ['Paid and trial accounts share the 100-shop limit', functions.includes('trialQuery = db.collection("freeBetaUsers")') && functions.includes('activeUids.size >= 100')],
 ['APK shows 100-shop platform capacity', html.includes('အများဆုံး ၁၀၀ ဆိုင်')],
 ['Login sessions persist across app restarts', html.includes('fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)')],
 ['No in-app KBZPay or payment screenshot form in APK', !html.includes('KBZPay') && !html.includes('paymentProofs') && html.includes('App အတွင်း ငွေပေးချေမှု')],
 ['Trial expiry is not bypassed by a permanent-free plan flag', !html.includes('isFreeBeta') && html.includes('!currentLicense.expiresAt')],
 ['Expired five-day trials cannot be reactivated by client controls', rules.includes("get(/databases/$(database)/documents/freeBetaUsers/$(uid)).data.createdAt + duration.value(5, 'd') > request.time") && rules.includes('freeTrialClaims') && html.includes('akFreeTrialExpiryTimer') && html.includes('5 ရက် Trial')],
 ['No malformed literal newline in Owner trial controls', !html.includes('if(target.plan==="free-trial"){\\n')],


 ['Owner password never stored in Firestore', functions.includes('Passwords are sent only to') && !functions.includes('password: password') && !functions.includes('passwordConfigured: password')],
 ['Owner assigns package and expiry', functions.includes('planDays, priceMMK: planPrices[planDays]') && functions.includes('expiresAt, emailVerified: true')],
 ['Shop owner login uses Firestore license gate without callable Functions', html.includes('Spark mode: Firestore license gate') && !html.includes('httpsCallable("verifyShopOwnerLogin")({})') && !html.includes('akLoginPackage')],
 ['Owner Dashboard becomes visible when selected', html.includes('x.classList.toggle("hidden",!active)') && html.includes('id="ownerDashboard" class="view shop-owner-only hidden"')],
 ['Platform Owner dashboard has real account summary and management entry points', html.includes('id="akOwnerOverviewPanel"') && html.includes('id="akOwnerTotalShops"') && html.includes('id="akOwnerActiveShops"') && html.includes('function akLoadOwnerDashboard()') && html.includes('loadAdminAccessRequests()')],
 ['Owner dashboard does not show false zero counts before account list loads', html.includes('let akPlatformUserListLoaded=false,akPlatformUserListError="";') && html.includes('loaded?rows.length:"—"') && html.includes('akPlatformUserListError=String(e?.message||e')],
 ['Owner dashboard surfaces unavailable account-list backend errors', html.includes('Subscription စာရင်းဖတ်မရပါ:') && html.includes('id="akPlatformUserStatus"') && html.includes('akPlatformUserListError=String(e?.message')],
 ['Owner customer license changes use protected Spark Firestore rules', html.includes('fbStore.collection("licenses").doc(uid).update') && html.includes('akGrantRequestSubscription') && rules.includes('allow create: if isVerifiedOwner()') && rules.includes('allow update: if isVerifiedOwner()')],
 ['Platform Owner opens directly in normal POS User View and can return to Owner Mode', html.includes('function akEnterOwnerPosMode()') && (html.match(/akEnterOwnerPosMode\(\)/g)||[]).length>=5 && html.includes('document.body.classList.add("ak-owner-user-preview")') && html.includes('go("home")') && html.includes('Owner Mode သို့ပြန်ရန်')],
 ['Owner User View preserves shop-owner features and hides only platform controls', html.includes('body.ak-owner-user-preview .owner-only,body.ak-owner-user-preview #nav button[data-view="ownerDashboard"]') && !html.includes('body.ak-owner-user-preview .shop-owner-only') && html.includes('go(enabled?"home":"ownerDashboard")') && html.includes('akUserRole==="platform-owner"&&document.body.classList.contains("ak-owner-user-preview")')],
 ['Platform license and ad controls are hidden from Shop Owner and Owner User View', html.includes('<div class="panel owner-only" id="akLicensePanel">') && html.includes('id="akPlatformShopProvisionPanel"') && html.includes('class="panel owner-only" id="akOwnerOverviewPanel"') && html.includes('<div class="panel owner-only" id="akOwnerAdManager"')],
 ['CSV export can be shared through Android native file share', html.includes('akShareCsvToViber') && html.includes('AkPrinter?.shareFile') && printer.includes('public void shareFile(PluginCall call)')],
 ['Report can be shared through Viber share sheet', html.includes('akShareReportToViber') && html.includes('AK-Sales-Report.txt')],
 ['Platform Owner shop-account creation panel is present', html.includes('id="akPlatformShopProvisionPanel"') && html.includes('async function akProvisionShopOwner()')],
 ['Owner account list shows sequential numbers', html.includes('id="akOwnerShopRows"') && html.includes('function akRenderOwnerShopRows()')],
 ['Shop owners can self-register; Platform Owner cannot register a shop', html.includes('reg.style.display=ownerMode?"none":""') && html.includes('async function firebaseRegister()')],
 ['Platform Owner creates shop-owner Auth accounts through the protected Cloudflare Worker', html.includes('https://ak-sale-backend.painglin102.workers.dev/owner/provision') && html.includes('fbAuth.currentUser.getIdToken(true)') && html.includes('provisionData.uid') && html.includes('platform_owner_verification_failed')],
 ['Duplicate shop-owner Gmail is blocked by the Platform Owner backend', html.includes('shop_owner_email_already_registered') && html.includes('apiKey:cfg.apiKey')],
 ['Shop-owner and staff registration use a separate Auth session and preserve the signed-in Owner', html.includes('const appName="AKAccountRegistration"') && html.includes('registrationAuth.createUserWithEmailAndPassword(email,pass)') && html.includes('Owner Login ကို ထိခိုက်မထားပါ။')],
 ['Existing staff Gmail is directed to Staff Login and Merchant Code claim', html.includes('Staff Login ကိုရွေးပြီး မူလ Password နှင့် Merchant Code ထည့်ပါ။')],

 ['Owner provisions shop-owner Auth and Spark license without storing the password', html.includes('activeShopCount:count+1') && html.includes('emailVerified:false,status:"active"') && html.includes('Verification Link')],
 ['License package pricing is represented in Spark grant flow', html.includes('prices={30:30000,90:90000,180:180000,365:360000}') && html.includes('plans={30:"30-days",90:"90-days",180:"180-days",365:"365-days"}')],
 ['Shop-owner self-registration is activated only by an Owner-issued license', html.includes('createUserWithEmailAndPassword(email,pass)') && html.includes('subscriptionAccessRequests') && html.includes('fbStore.collection("licenses").doc(uid)')],
 ['Merchant Code is generated from the shop-owner Spark workspace', html.includes('async function akCreateStaffInvite()') && html.includes('sparkStore.createInvite(role)') && html.includes('sparkStore.listStaff()')],
 ['Merchant Code is 128-bit random, one-time and expires after 24 hours', sparkStore.includes('cryptoApi.getRandomValues(bytes)') && sparkStore.includes('new Uint8Array(16)') && rules.includes("code.size() == 32") && rules.includes("request.resource.data.expiresAt <= request.time + duration.value(24, 'h')") && rules.includes("request.resource.data.status == 'claimed'")],
 ['Staff must use a verified personal Gmail and valid Merchant Code', html.includes('async function firebaseRegister()') && html.includes('type==="staff"') && html.includes('mode==="staff"') && html.includes('sparkStore.claimInvite(code)') && rules.includes('request.auth.token.email_verified == true')],
 ['Staff membership is limited to three accounts per shop', rules.includes("request.resource.data.shopId + '_1'") && rules.includes("request.resource.data.shopId + '_2'") && rules.includes("request.resource.data.shopId + '_3'") && html.includes('ဝန်ထမ်းအကောင့်အများဆုံး ၃ ခု')],
 ['Staff role and shop identity are enforced by Firestore membership rules', rules.includes('match /shopMembers/{memberUid}') && rules.includes('hasShopMemberRole(shopId, roles)') && html.includes('shopMembers").doc(user.uid).get()')],
 ['Staff workspace access is tenant-scoped and role-restricted', functions.includes('async function verifyWorkspaceMember(context, identity)') && functions.includes('member.data().shopId!==identity.shopId') && functions.includes('function workspaceCanRead(role,key)') && functions.includes('function workspaceCanWrite(role,key)')],
 ['Shop Owner and Platform Owner manage Merchant staff through Spark Firestore', html.includes('id="akOwnerStaffPanel"') && html.includes('function akLoadStaff()') && html.includes('sparkStore.listStaff()') && html.includes('sparkStore.setStaffPrintPermission(uid,canPrint)') && html.includes('sparkStore.revokeStaff(uid)')],
 ['Android package name stable', config.appId === 'com.ak.hardware.sales']
];
for (const [label, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + label);
const failed = checks.filter(([,ok]) => !ok).map(([label]) => label);
if (failed.length) throw new Error('AK APK role/login validation failed: ' + failed.join('; '));
console.log('Validated', checks.length, 'APK role/security checks. Inline JavaScript syntax is checked against apk/app.html before packaging.');
