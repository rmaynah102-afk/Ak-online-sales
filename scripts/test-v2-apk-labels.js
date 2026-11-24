'use strict';
const fs=require('fs');
const vm=require('vm');
const html=fs.readFileSync('www/index.html','utf8');
const checks=[
 ['Barcode Label / Sticker panel exists',html.includes('id="akV2LabelStudio"')],
 ['Label product selector exists',html.includes('id="akV2LabelProduct"')],
 ['Label size, columns, copies and alignment controls exist',['akV2LabelSize','akV2LabelColumns','akV2LabelCopies','akV2LabelAlign'].every(x=>html.includes('id="'+x+'"'))],
 ['SKU / barcode product selector is wired',html.includes('p.sku||p.barcode||"No barcode"')],
 ['Code 39 SVG renderer and print action exist',html.includes('function code39Svg(value)')&&html.includes('window.akPrintV2Labels=function()')],
 ['Physical millimetre dimensions are used',html.includes("grid-auto-rows:'+h+'mm")&&html.includes("repeat('+columns+', '+w+'mm")],
 ['Product refresh is connected to renderAll',html.includes('renderProductTable();window.akRefreshV2LabelProducts?.();const opts=products.map(')],
 ['Android/browser print dialog is invoked',html.includes('win.print()')]
];
for(const [name,ok] of checks)console.log((ok?'PASS ':'FAIL ')+name);
const start=html.indexOf('// AK V2 Barcode Label / Sticker Printer.');
const end=html.indexOf('\n</script>',start);
if(start<0||end<0)throw new Error('APK Barcode Label script block not found');
new vm.Script(html.slice(start,end),{filename:'apk-v2-barcode-labels.js'});
console.log('PASS Barcode Label JavaScript syntax');
const failed=checks.filter(([,ok])=>!ok).map(([name])=>name);
if(failed.length)throw new Error('V2 APK Barcode Label regression failed: '+failed.join('; '));
console.log('V2 APK Barcode Label regression passed.');