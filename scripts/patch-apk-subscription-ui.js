'use strict';

// APK-only compatibility stamp for source version 2.1.317.
// Subscription/license controls remain owner-managed; no payment proof or checkout UI is injected.
const fs = require('fs');
const path = require('path');
const target = path.resolve(__dirname, '..', 'www', 'index.html');
if (!fs.existsSync(target)) throw new Error('APK web bundle missing: run npm run copy-web first.');
let html = fs.readFileSync(target, 'utf8');
const marker = '/* AK_APK_SUBSCRIPTION_UI_V3 */';
if (!html.includes(marker)) {
  const bodyEnd = html.lastIndexOf('</body>');
  if (bodyEnd < 0) throw new Error('HTML body closing tag not found.');
  html = html.slice(0, bodyEnd) + '<script>' + marker + '/* No checkout/proof panel injected. */</script>\n' + html.slice(bodyEnd);
  fs.writeFileSync(target, html);
}
console.log('APK subscription compatibility marker applied without injecting checkout/payment-proof UI.');
