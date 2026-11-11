'use strict';

// APK-only startup guard. This patches generated www/index.html after copy-web
// and never edits the isolated Android source or the website source.
const fs = require('fs');
const path = require('path');
const target = path.resolve(__dirname, '..', 'www', 'index.html');
if (!fs.existsSync(target)) throw new Error('APK web bundle missing: run npm run copy-web first.');
let html = fs.readFileSync(target, 'utf8');
const marker = '/* AK_APK_CLOUD_STARTUP_GUARD_V2 */';
if (html.includes(marker)) { console.log('APK Cloud startup guard already applied.'); process.exit(0); }

const privateRead = 'const privateSnap=await privateRef.get();';
const privatePatch = 'const privateSnap=await Promise.race([privateRef.get(),new Promise((_,reject)=>setTimeout(()=>reject(new Error("APK ဆိုင် Cloud ဒေတာဖတ်ရန် ၁၈ စက္ကန့်ကျော်နေပါသည်။ Internet ပြန်စစ်ပြီး ပြန်ဝင်ပါ။")),18000))]);';
if (html.split(privateRead).length !== 2) {
  throw new Error('Expected exactly one primary private shop-data read; refusing unsafe APK patch.');
}
html = html.replace(privateRead, privatePatch);

const centerReady = html.includes('Center cloud load did not block Owner Dashboard:');
if (!centerReady) {
  throw new Error('Owner Dashboard must already use the verified non-blocking center-data load before APK packaging.');
}
const bodyEnd = html.lastIndexOf('</body>');
if (bodyEnd < 0) throw new Error('HTML body closing tag not found.');
html = html.slice(0, bodyEnd) + '<script>/* AK_APK_CLOUD_STARTUP_GUARD_V2 */</script>\\n' + html.slice(bodyEnd);
fs.writeFileSync(target, html);
console.log('APK-only Cloud startup guard V2 applied: 18s private shop-data deadline; Owner center loading remains non-blocking.');
