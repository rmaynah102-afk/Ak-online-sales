'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'www', 'index.html'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
const labelScriptMatch=html.match(/<script id="ak-apk-label-studio">([\s\S]*?)<\/script>/);
const workspaceHelperMatch=html.match(/\/\* AK_APK_WORKSPACE_MIGRATION_V1 \*\/([\s\S]*?)\/\* END AK_APK_WORKSPACE_MIGRATION_V1 \*\//);
const workspaceAuthMatch=html.match(/\/\* AK_APK_WORKSPACE_AUTH_V1 \*\/([\s\S]*?)\/\* END AK_APK_WORKSPACE_AUTH_V1 \*\//);
let labelScriptSyntaxValid=false,workspaceHelperSyntaxValid=false,workspaceAuthSyntaxValid=false;
try{if(labelScriptMatch){new vm.Script(labelScriptMatch[1],{filename:'www/index.html:label'});labelScriptSyntaxValid=true;}}catch(error){console.error('APK label script syntax error:',error.message);}
try{if(workspaceHelperMatch){new vm.Script(workspaceHelperMatch[1],{filename:'www/index.html:workspace-helper'});workspaceHelperSyntaxValid=true;}}catch(error){console.error('APK workspace helper syntax error:',error.message);}
try{if(workspaceAuthMatch){new vm.Script('async function __akWorkspaceAuthFragment(){'+workspaceAuthMatch[1]+'}',{filename:'www/index.html:workspace-auth'});workspaceAuthSyntaxValid=true;}}catch(error){console.error('APK workspace auth syntax error:',error.message);}
const checks = [
  ['single universal APK marker', html.includes('data-ak-apk-edition="universal"')],
  ['single stable Android package', config.appId === 'com.ak.hardware.sales'],
  ['single launcher name', config.appName === 'AK Sale Software'],
  ['Market disabled inside APK', html.includes('const publicMode=false;') && html.includes('if(!publicMode)return;')],
  ['Market login relocation disabled by hard guard', html.includes('const publicMode=false;') && html.includes('if(!publicMode)return;')],
  ['Merchant Code panel exists only in POS login', html.includes('id="akMerchantJoinPanel"')],
  ['role determined from Firebase identity', html.includes('function checkUserRole(user)') && html.includes('claims.shopId?String(claims.shopRole||"staff").toLowerCase():"shop-owner"')],
  ['role-based navigation exists', html.includes('function akApplyRoleNavigation()')],
  ['Platform Owner email gate exists', html.includes('function akIsPlatformOwner(user=fbUser)')],
  ['staff Merchant Code callable exists', html.includes('httpsCallable("claimShopInviteCode")')],
  ['shop owner staff management exists', html.includes('httpsCallable("createShopInviteCode")') && html.includes('httpsCallable("listShopStaff")')],
  ['AI ad composer removed', !html.includes('<h3>AI ကြော်ငြာစာသား</h3>')],
  ['AI security panel removed', !html.includes('<h2>AI လုံခြုံရေးစစ်ဆေးမှု</h2>')],
  ['local ZXing scanner bundled', fs.existsSync(path.join(root, 'www', 'vendor', 'zxing.min.js')) && html.includes('s.src="./vendor/zxing.min.js";s.async=true;')],
  ['APK Merchant Code join is enabled', html.includes('id="akMerchantJoinPanel"') && html.includes('onclick="akClaimMerchantCode()"') && !html.includes('placeholder="ယာယီပိတ်ထားသည်"') ],
  ['APK Barcode Label / Sticker panel copied from APK source', html.includes('id="akLabelStudio"') && html.includes('id="akLabelColumns"') && html.includes('id="akLabelOffsetX"')],
  ['APK Barcode Label Code 39 printing is wired', html.includes('window.akPrintLabels=function()') && html.includes('function code39Svg(value)') && html.includes('window.akRefreshLabelProducts?.()')],
  ['APK Barcode Label JavaScript syntax', labelScriptSyntaxValid],
  ['APK Barcode Label uses the existing safe escP helper', html.includes('function escP(') && html.includes('escP(p.id)') && html.includes('escP(p.name)')],
  ['single Platform Owner allowlist retained', html.includes('const OWNER_EMAIL="painglin102@gmail.com"') && !html.includes('sannnlinpaing@gmail.com')],
  ['Google / Gmail and Phone OTP login retained', html.includes('firebaseGoogleLogin') && html.includes('PhoneAuthProvider') && html.includes('signInWithPhoneNumber')],
  ['30 / 90 / 180 / 365-day price map retained', html.includes('const AK_PLAN_AMOUNTS={30:30000,90:90000,180:180000,365:360000};')],
  ['Manager / Cashier / Employee print permission path retained', html.includes('httpsCallable("setShopStaffPrintPermission")') && html.includes('canPrint')],
  ['subscription expiry lock retained', html.includes('function akCheckSubscriptionExpiry()') && html.includes('ak-license-locked')],
  ['sales and purchases screens retained', html.includes('id="saleLines"') && html.includes('id="purchaseForm"')],
  ['Viber / Facebook / Telegram share routes retained', html.includes('facebook:"https://www.facebook.com/"') && html.includes('telegram:"https://t.me/share/url?url="') && html.includes('viber:"viber://forward?text="')],
  ['APK shared shop workspace is enabled', html.includes('akWorkspaceMode=true') && html.includes('akLoadShopWorkspaceForCurrentUser(user,isStaff,authGeneration)')],
  ['APK legacy records are copy-migrated before workspace activation', html.includes('akCloudDataWithoutPhotos(migrationSource)') && html.includes('expectedRevision:0') && html.includes('_pre_workspace_migration')],
  ['APK workspace helper syntax', workspaceHelperSyntaxValid],
  ['APK workspace auth syntax', workspaceAuthSyntaxValid],
  ['staff subscription expiry is server-verified', html.includes('akStaffLicenseCheckInFlight') && html.includes('httpsCallable("loadShopWorkspace")')],
  ['staff cannot load owner center-management data', html.includes('if(!isStaff&&window.cmCloudLoad)')],
  ['APK payment proof upload is enabled', /id="payScreenshot"[^>]*required/.test(html) && !/id="payScreenshot"[^>]*disabled/.test(html)],
  ['APK payment request requires screenshot proof', html.includes('if(!file)throw Error("ငွေလွှဲ Screenshot ကို မဖြစ်မနေတင်ပါ။")') && html.includes('firebase.storage().ref(uploadedPath).put(file)')],
  ['APK owner can create Merchant Codes', html.includes('onclick="akCreateMerchantCode()"')],
  ['APK staff list uses deployed callable', html.includes('httpsCallable("listShopStaff")') && html.includes('async function akLoadStaff()') && !html.includes('ဝန်ထမ်းစနစ် မဖွင့်ထားပါ။')],
  ['Thermer receipt sharing present', html.includes('Thermer / Printer App သို့ပို့') && html.includes('chooserTitle')],
  ['native printer plugin source and installer exist', fs.existsSync(path.join(root, 'native', 'android', 'AkPrinterPlugin.java')) && fs.existsSync(path.join(root, 'scripts', 'install-native-printer.js'))]
];
const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
for (const [name, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + name);
if (failed.length) throw new Error('Universal APK validation failed: ' + failed.join('; '));
console.log('Universal APK validation passed. Shop isolation and permissions remain enforced by Firebase rules and callable backend.');
