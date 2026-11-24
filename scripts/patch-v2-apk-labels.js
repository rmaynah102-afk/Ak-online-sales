'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const htmlPath=path.join(root,'www','index.html');
if(!fs.existsSync(htmlPath))throw new Error('Prepared V2 APK bundle is missing: www/index.html');
let html=fs.readFileSync(htmlPath,'utf8');
const panelMarker='id="akV2LabelStudio"';
const scriptMarker='// AK V2 Barcode Label / Sticker Printer.';
if(html.includes(panelMarker)||html.includes(scriptMarker)){
  if(html.includes(panelMarker)&&html.includes(scriptMarker)){console.log('V2 APK barcode label patch already applied.');process.exit(0);}
  throw new Error('Partial V2 APK barcode label patch detected; refusing to continue.');
}
const anchor='<div id="printerRows"></div>\n<div class="card" id="receiptSettings">';
const anchorCount=html.split(anchor).length-1;
if(anchorCount!==1)throw new Error('Expected exactly one V2 printer/receipt insertion anchor; found '+anchorCount);
const markup=fs.readFileSync(path.join(root,'apk','v2-barcode-labels.html'),'utf8').trim();
html=html.replace(anchor,anchor.replace('\n<div class="card" id="receiptSettings">','\n'+markup+'\n<div class="card" id="receiptSettings">'));
const refreshAnchor='renderProductTable();const opts=products.map(';
const refreshCount=html.split(refreshAnchor).length-1;
if(refreshCount!==1)throw new Error('Expected exactly one V2 product refresh anchor; found '+refreshCount);
html=html.replace(refreshAnchor,'renderProductTable();window.akRefreshV2LabelProducts?.();const opts=products.map(');
const scriptAnchor='</script></body></html>';
if(html.split(scriptAnchor).length-1!==1)throw new Error('Expected exactly one final inline-script closing anchor.');
const labelScript=fs.readFileSync(path.join(root,'apk','v2-barcode-labels.js'),'utf8').trim();
html=html.replace(scriptAnchor,labelScript+'\n'+scriptAnchor);
if(!html.includes(panelMarker)||!html.includes(scriptMarker)||!html.includes('window.akPrintV2Labels=function()'))throw new Error('V2 APK barcode label patch verification failed.');
fs.writeFileSync(htmlPath,html);
console.log('Applied APK-only V2 Barcode Label / Sticker patch to generated www/index.html; source v2/index.html was not modified.');