'use strict';

// APK-only startup guard. This patches www/index.html after APK-only source preparation and never reads or edits Web app.html.
const fs = require('fs');
const path = require('path');
const target = path.resolve(__dirname, '..', 'www', 'index.html');
if (!fs.existsSync(target)) throw new Error('APK web bundle missing: run npm run copy-web first.');
let html = fs.readFileSync(target, 'utf8');
const marker = '/* AK_APK_CLOUD_STARTUP_GUARD_V1 */';
if (html.includes(marker)) { console.log('APK Cloud startup guard already applied.'); process.exit(0); }
const mainRead = 'const result=await firebase.functions().httpsCallable("loadShopWorkspace")({});';
const mainPatch = 'const result=await Promise.race([firebase.functions().httpsCallable("loadShopWorkspace")({}),new Promise((_,reject)=>setTimeout(()=>reject(new Error("APK ဆိုင် Cloud ဒေတာဖတ်ရန် ၁၈ စက္ကန့်ကျော်နေပါသည်။ Internet ပြန်စစ်ပြီး ပြန်ဝင်ပါ။")),18000))]);';
const mainReadCount = html.split(mainRead).length - 1;
if (mainReadCount !== 2) throw new Error('Expected exactly two shop workspace reads, found ' + mainReadCount + '; refusing unsafe APK patch.');
html = html.split(mainRead).join(mainPatch);
const centerRead = 'if(window.cmCloudLoad)await window.cmCloudLoad();';
const centerPatch = 'if(window.cmCloudLoad){const akCenterTask=Promise.resolve().then(()=>window.cmCloudLoad());const akCenterReady=await Promise.race([akCenterTask.then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),7000))]);if(!akCenterReady){console.warn("APK center-management Cloud read exceeded 7 seconds; continuing POS startup while it completes in background.");const akStatus=document.getElementById("fbStatus");if(akStatus)akStatus.textContent+=" · စင်တာ Cloud ဒေတာဖတ်ချိန်ကြာနေသဖြင့် နောက်ကွယ်တွင် ဆက်ဖတ်နေသည်။";akCenterTask.catch(error=>console.warn("APK center Cloud background read failed",error));}}';
const centerAlreadyNonBlocking = html.includes('Center cloud load did not block Owner Dashboard:');
if (html.includes(centerRead)) {
  if (html.split(centerRead).length !== 2) throw new Error('Expected exactly one center Cloud read; refusing unsafe APK patch.');
  html = html.replace(centerRead, centerPatch);
} else if (!centerAlreadyNonBlocking) {
  throw new Error('Center Cloud read sequence is neither the known original nor the verified non-blocking Owner Dashboard sequence; refusing unsafe APK patch.');
}
const bodyEnd = html.lastIndexOf('</body>');
if (bodyEnd < 0) throw new Error('HTML body closing tag not found.');
html = html.slice(0, bodyEnd) + '<script>/* AK_APK_CLOUD_STARTUP_GUARD_V1 */</script>\n' + html.slice(bodyEnd);
fs.writeFileSync(target, html);
console.log('APK-only Cloud startup guard applied: 18s fail-closed shop workspace deadline; 7s non-blocking center data deadline.');
