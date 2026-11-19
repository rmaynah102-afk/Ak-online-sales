'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'apk', 'pos-app.html');
const targetDir = path.join(root, 'www');
if (!fs.existsSync(sourcePath)) {
  throw new Error('APK-only POS source apk/pos-app.html is missing.');
}
let html = fs.readFileSync(sourcePath, 'utf8');
if (!html.startsWith('<!DOCTYPE html>') ||
    !html.includes('<html lang="my">') ||
    !html.includes('const OWNER_EMAIL="painglin102@gmail.com";') ||
    !html.includes('id="saleLines"') ||
    !html.includes('id="purchaseForm"')) {
  throw new Error('apk/pos-app.html is not the expected AK Sale POS source.');
}
if (!html.includes('<script src="./firebase-config.js"></script>')) {
  throw new Error('APK POS source must load the public Firebase client configuration.');
}
const marker = '<!-- AK_APK_SOURCE: apk/pos-app.html -->';
if (html.includes(marker)) throw new Error('APK source marker already exists; refusing to prepare a previously patched bundle.');
const head = '<head>';
if (!html.includes(head)) throw new Error('APK POS source head element is missing.');
html = html.replace(head, head + '\n' + marker);
fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(path.join(targetDir, 'index.html'), html, 'utf8');
fs.writeFileSync(path.join(targetDir, 'app.html'), html, 'utf8');
const requiredAssets = ['firebase-config.js', 'ak-logo.svg'];
for (const file of requiredAssets) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) throw new Error('Required APK asset is missing: ' + file);
  fs.copyFileSync(source, path.join(targetDir, file));
}
const optionalAssets = [
  'download.html',
  'USER-GUIDE-MY.md',
  'USER-GUIDE-EN.md',
  'BUSINESS-GUIDE-MY.md',
  'BUSINESS-GUIDE-EN.md',
  'PRINTER-SETUP-MY.md'
];
for (const file of optionalAssets) {
  const source = path.join(root, file);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(targetDir, file));
}
console.log('Prepared APK bundle exclusively from apk/pos-app.html; Web app.html, index.html, Marketplace and GitHub Pages were not read or modified.');
