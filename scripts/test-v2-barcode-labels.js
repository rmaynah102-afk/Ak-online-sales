'use strict';
const fs=require('fs');
const vm=require('vm');
const html=fs.readFileSync('v2/index.html','utf8');
const checks=[
 ['Barcode Label panel is inside the existing printer details',html.indexOf('id="akV2LabelStudio"')>html.indexOf('id="printerInline"')&&html.indexOf('id="akV2LabelStudio"')<html.indexOf('</details>',html.indexOf('id="printerInline"'))],
 ['Product selector and refresh control exist',html.includes('id="akV2LabelProduct"')&&html.includes('akRefreshV2LabelProducts()')],
 ['Label size, columns, copies and alignment controls exist',['akV2LabelSize','akV2LabelColumns','akV2LabelCopies','akV2LabelAlign'].every(x=>html.includes('id="'+x+'"'))],
 ['Barcode label supports SKU / barcode fields',html.includes('p.sku||p.barcode||"No barcode"')&&html.includes('p.sku||p.barcode||"")')],
 ['Code 39 SVG renderer exists',html.includes('function code39Svg(value)')&&html.includes('window.akPrintV2Labels=function()')],
 ['Print output uses physical millimetre dimensions',html.includes("grid-auto-rows:'+h+'mm")&&html.includes("repeat('+columns+', '+w+'mm")],
 ['Product list refresh is connected to V2 renderAll',/renderProductTable\(\);\s*refreshTransactionProductOptions\(\);\s*window\.akRefreshV2LabelProducts\?\.\(\);/.test(html)],
 ['Print action opens Android/browser print dialog',html.includes('window.open("","_blank")')&&html.includes('win.print()')]
];
for(const [name,ok] of checks)console.log((ok?'PASS ':'FAIL ')+name);
const start=html.indexOf('// AK V2 Barcode Label / Sticker Printer.');
const end=html.indexOf('\n</script>',start);
if(start<0||end<0)throw new Error('Barcode label script block not found');
try{new vm.Script(html.slice(start,end),{filename:'v2-barcode-labels.js'});console.log('PASS Barcode Label JavaScript syntax')}catch(e){console.error('FAIL Barcode Label JavaScript syntax',e.message);process.exitCode=1}
const failed=checks.filter(([,ok])=>!ok).map(([name])=>name);
if(failed.length)throw new Error('Barcode Label validation failed: '+failed.join('; '));
console.log('Barcode Label / Sticker validation passed.');
