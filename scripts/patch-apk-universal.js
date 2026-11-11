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

// Keep the staff Merchant Code control in the POS login panel, never in the public Market.
// Match the actual current login panel in app.html, then activate the APK-only join control.
replaceExactly(
  '<div class="notice" style="margin-top:10px"><b>ဝန်ထမ်း Merchant Code</b><p>အခမဲ့ဗားရှင်းတွင် Cloud Functions မသုံးသဖြင့် ဝန်ထမ်းအကောင့်ချိတ်ဆက်မှုကို ယာယီပိတ်ထားသည်။ လုံခြုံရေးအတွက် Owner Gmail Password ကို ဝန်ထမ်းနှင့် မမျှဝေပါနှင့်။</p><div class="actions"><input id="akMerchantJoinCode" maxlength="10" placeholder="ယာယီပိတ်ထားသည်" style="flex:1;text-transform:uppercase" disabled><button type="button" disabled>မရသေးပါ</button></div></div>',
  '<div class="notice" id="akMerchantJoinPanel" style="margin-top:10px"><b>ဝန်ထမ်း Merchant Code</b><p>ဆိုင်ရှင်ထံမှ ရရှိသော Code ကို ကိုယ်ပိုင် Gmail ဖြင့် Login ဝင်ပြီး ထည့်ပါ။ Owner Password ကို မျှဝေရန် မလိုပါ။</p><div class="actions"><input id="akMerchantJoinCode" maxlength="10" placeholder="Owner ထံမှရရှိသော Code" style="flex:1;text-transform:uppercase"><button type="button" onclick="akClaimMerchantCode()">ဆိုင်နှင့် ချိတ်ရန်</button></div><small class="muted">ဤလုပ်ဆောင်ချက်အတွက် Firebase Cloud Functions ကို Deploy လုပ်ထားရန် လိုအပ်သည်။</small></div>'
);

// Enable the shop-owner controls in the APK bundle only.
replaceExactly(
  '<button type="button" disabled>Merchant Code ထုတ်ပေးမှု မရသေး</button><button type="button" class="alt" disabled>ဝန်ထမ်းစာရင်း မရသေး</button>',
  '<button type="button" onclick="akCreateMerchantCode()">Merchant Code ထုတ်ပေးရန်</button><button type="button" class="alt" onclick="akLoadStaff()">ဝန်ထမ်းစာရင်း ပြန်ဖတ်ရန်</button>'
);
replaceExactly(
  '<p class="muted">ဝန်ထမ်းအကောင့်နှင့် Merchant Code လုပ်ဆောင်ချက်များကို ယာယီပိတ်ထားသည်။</p>',
  '<p class="muted">ဝန်ထမ်းအများဆုံး ၃ ဦးအထိ ကိုယ်ပိုင် Gmail နှင့် ချိတ်နိုင်သည်။ Cloud Functions မရသေးပါက Backend Setup လိုအပ်ကြောင်း ပြမည်။</p>'
);
replaceExactly(
  '<p class="notice">ဝန်ထမ်း Role-based access ကို အခမဲ့ Cloud Functions မရှိသေးသဖြင့် မဖွင့်ထားပါ။</p>',
  '<p class="notice">ဝန်ထမ်းတစ်ဦးချင်းစီ၏ Role နှင့် Print ခွင့်ကို Server က စစ်ဆေးသည်။ Cloud Functions Deploy မလုပ်ရသေးလျှင် ဤစနစ် မလည်ပတ်နိုင်သေးပါ။</p>'
);

// Replace the placeholder loader with the server-backed staff list; errors remain visible if Functions are not deployed.
replaceExactly(
  'async function akLoadStaff(){const status=$("akStaffStatus");if(status)status.textContent="အခမဲ့စနစ်တွင် သီးခြားဝန်ထမ်းအကောင့်နှင့် Merchant Code မဖွင့်ထားပါ။";const rows=$("akStaffRows");if(rows)rows.innerHTML=\'<tr><td colspan="4">ဝန်ထမ်းစနစ် မဖွင့်ထားပါ။</td></tr>\';const count=$("akOwnerStaffCount");if(count)count.textContent="မဖွင့်သေး";}',
  'async function akLoadStaff(){const status=$("akStaffStatus"),rows=$("akStaffRows"),count=$("akOwnerStaffCount");if(status)status.textContent="ဝန်ထမ်းစာရင်း ဖတ်နေသည်...";if(rows)rows.innerHTML=\'<tr><td colspan="4">ဖတ်နေသည်...</td></tr>\';try{if(!fbAuth?.currentUser)throw Error("ဆိုင်ရှင် Gmail ဖြင့် Login ဝင်ပါ။");const result=await firebase.functions().httpsCallable("listShopStaff")({}),data=result.data||{},members=Array.isArray(data.members)?data.members:[];if(rows)rows.innerHTML=members.length?members.map(member=>{const uid=String(member.uid||"").replace(/[^A-Za-z0-9_-]/g,""),canPrint=member.canPrint===true;return \'<tr><td>\'+esc(member.email||"")+"</td><td>"+esc(member.role||"employee")+"</td><td><button type=\"button\" class=\"alt\" onclick=\"akSetStaffPrint(\'"+uid+"\',"+(!canPrint)+")\">"+(canPrint?"ပိတ်ရန်":"ခွင့်ပြုရန်")+"</button></td><td><button type=\"button\" class=\"red\" onclick=\"akRemoveStaff(\'"+uid+"\')\">ဖယ်ရှားရန်</button></td></tr>"}).join(""):\'<tr><td colspan="4">ဝန်ထမ်းမရှိသေးပါ။</td></tr>\';if(count)count.textContent=String(data.totalAccounts||1)+" / "+String(1+(data.maxStaff||3))+" အကောင့်";if(status)status.textContent="ဝန်ထမ်းစာရင်း ဖတ်ပြီးပါပြီ။ "+members.length+" ဦး";}catch(e){if(rows)rows.innerHTML=\'<tr><td colspan="4">Cloud Functions မရနိုင်ပါ။ Firebase Functions Deploy နှင့် Billing Setup ကို စစ်ပါ။</td></tr>\';if(status)status.textContent="ဝန်ထမ်းစာရင်း မဖတ်နိုင်ပါ: "+(e.message||e);if(count)count.textContent="မသိရသေး";}}'
);


// APK payment gate: require a real uploaded transfer proof, never silently submit a reference-only request.
replaceExactly(
  '<div><label>ငွေလွှဲ Screenshot (အခမဲ့စနစ်တွင် Cloud Storage မပါသဖြင့် Upload မရသေးပါ)</label><input id="payScreenshot" type="file" accept="image/jpeg,image/png,image/webp" disabled></div>',
  '<div><label>ငွေလွှဲ Screenshot (မဖြစ်မနေ · JPG / PNG / WEBP · 2MB အောက်)</label><input id="payScreenshot" type="file" accept="image/jpeg,image/png,image/webp" required></div>'
);
replaceExactly(
  '  const file=$("payScreenshot").files[0];\n  if(!validateAndSubmitKPay({method,amount,reference},file))return;\n  if(file){\n   try{\n    uploadedPath="paymentProofs/"+uid+"/"+Date.now()+"_"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");\n    const upload=await firebase.storage().ref(uploadedPath).put(file);\n    screenshotUrl=await upload.ref.getDownloadURL();\n   }catch(storageError){\n    console.warn("AK payment screenshot storage is not configured; submitting transaction reference without image.",storageError);\n    uploadedPath="";\n    screenshotUrl="";\n   }\n  }',
  '  const file=$("payScreenshot").files[0];\n  if(!file)throw Error("ငွေလွှဲ Screenshot ကို မဖြစ်မနေတင်ပါ။");\n  if(!validateAndSubmitKPay({method,amount,reference},file))return;\n  if(!firebase.storage)throw Error("Firebase Storage SDK မရနိုင်ပါ။");\n  uploadedPath="paymentProofs/"+uid+"/"+Date.now()+"_"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");\n  const upload=await firebase.storage().ref(uploadedPath).put(file);\n  screenshotUrl=await upload.ref.getDownloadURL();\n  if(!screenshotUrl)throw Error("ငွေလွှဲ Screenshot URL မရပါ။");'
);

// Bring the latest APK-only barcode label studio into the universal bundle.
// The build normally starts from app.html (the Web source), so apk/app.html is the
// authoritative source for this APK-only feature; only its label UI and logic are copied.
const apkSourcePath = path.join(root, 'apk', 'app.html');
if (!fs.existsSync(apkSourcePath)) throw new Error('APK-specific source apk/app.html is missing.');
const apkSource = fs.readFileSync(apkSourcePath, 'utf8');
const labelMarkupStart = apkSource.indexOf('<div class="panel" id="akLabelStudio"');
const labelMarkupEnd = apkSource.indexOf('\\n<p class="muted">Bluetooth သည် Classic SPP', labelMarkupStart);
if (labelMarkupStart < 0 || labelMarkupEnd < 0) throw new Error('Could not isolate Barcode Label / Sticker Printer panel from apk/app.html.');
const labelMarkup = apkSource.slice(labelMarkupStart, labelMarkupEnd);
const printerStatusAnchor = '<p class="muted" id="akPrinterStatus">Printer Profile ကို ဒီဖုန်းထဲတွင် သိမ်းထားသည်။ APK မှ Bluetooth Classic ESC/POS နှင့် Wi-Fi RAW TCP 9100 တိုက်ရိုက်ပို့နိုင်သည်။ Website မှာ Android/System Print ကို သုံးပါ။</p>';
replaceExactly(printerStatusAnchor, printerStatusAnchor + '\\n' + labelMarkup);
const labelCodeStart = apkSource.indexOf(' const code39={');
const labelCodeEnd = apkSource.indexOf(' window.akPrinterTypeChanged();', labelCodeStart);
if (labelCodeStart < 0 || labelCodeEnd < 0) throw new Error('Could not isolate Barcode Label JavaScript from apk/app.html.');
let labelScript = apkSource.slice(labelCodeStart, labelCodeEnd)
  .replace(/\\bescP\\b/g, 'esc')
  .replace('window.money?window.money(p.retail??p.price):String(p.retail??p.price??0)', 'money(p.retail??p.price)');
if (!labelScript.includes('window.akRefreshLabelProducts=function()') ||
    !labelScript.includes('window.akPrintLabels=function()')) {
  throw new Error('Barcode Label JavaScript is incomplete.');
}
replaceExactly(
  '  renderAll();if(fbUser){akLocalDirty=true;',
  '  renderAll();window.akRefreshLabelProducts?.();if(fbUser){akLocalDirty=true;'
);
const labelScriptTag = '<script id="ak-apk-label-studio">\\n' + labelScript +
  '\\nif(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>window.akRefreshLabelProducts());else window.akRefreshLabelProducts();\\n</script>\\n';
const labelBodyEnd = html.lastIndexOf('</body>');
if (labelBodyEnd < 0) throw new Error('HTML body closing tag not found for Barcode Label JavaScript.');
html = html.slice(0, labelBodyEnd) + labelScriptTag + html.slice(labelBodyEnd);

// Remove unsupported AI panels from the APK while preserving ordinary ad sharing.
for (const token of ['<h3>AI ကြော်ငြာစာသား</h3>', '<h2>AI လုံခြုံရေးစစ်ဆေးမှု</h2>']) {
  const lines = html.split('\n');
  const matches = lines.filter(line => line.includes(token)).length;
  if (matches !== 1) throw new Error('Expected one APK AI panel line for ' + token + ', found ' + matches);
  const index = lines.findIndex(line => line.includes(token));
  lines[index] = '  <!-- Universal APK: unsupported AI feature removed -->';
  html = lines.join('\n');
}

// Role is determined from verified Firebase identity and server-issued custom claims.
// A non-platform account can see the Merchant Code join field; platform owner does not need it.
const roleAnchor = 'akApplyRoleNavigation();\n console.log("AK account role:",role,';
const roleReplacement = 'akApplyRoleNavigation();\n const merchantJoin=document.getElementById("akMerchantJoinPanel");if(merchantJoin)merchantJoin.style.display=role==="platform-owner"?"none":"";\n console.log("AK account role:",role,';
replaceExactly(roleAnchor, roleReplacement);

const style = [
  '<style id="ak-apk-universal-v1">',
  '/* AK_APK_UNIVERSAL_V1 · one APK, role-based access */',
  'html.ak-apk-pos-only body.ak-license-locked main>#backup>#akFirebasePanel { display:block!important; }',
  'html.ak-apk-pos-only body.ak-license-locked main>#backup>#akPaywallNotice,',
  'html.ak-apk-pos-only body.ak-license-locked main>#backup>#akSubscriptionPayment { display:block!important; }',
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
