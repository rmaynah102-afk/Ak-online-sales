const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("v2/index.html","utf8");
const native=fs.readFileSync("native/android/AkPrinterPlugin.java","utf8");
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(([,a])=>!/\bsrc\s*=/.test(a));
if(!scripts.length)throw new Error("No inline app scripts");
scripts.forEach(([, ,code],i)=>new vm.Script(code,{filename:"ak-sale-v2.1.318-"+(i+1)}));
const checks=[
 ["receipt paper selector",'id="receiptPaper"'],
 ["58mm / 80mm support",'value="58mm"'],
 ["copy selector",'id="receiptCopies"'],
 ["receipt print history",'id="receiptHistory"'],
 ["receipt reprint handler","window.printSaleReceipt=async id=>"],
 ["sale discount input",'id="saleDiscount"'],
 ["discount persisted on sale","subtotal,discount,total,paid"],
 ["discount deducted from profit","profit:total-cost*qty"],
 ["employee cashier permission",'staffRole==="cashier"||staffRole==="employee"'],
 ["ESC/POS auto cut bytes","29,86,0"]
];
for(const [label,marker] of checks){if(!(html.includes(marker)||native.includes(marker)))throw new Error("Missing: "+label)}
if(!html.includes('const width=paper==="58mm"?384:576'))throw new Error("ESC/POS paper width selection is missing");
console.log("AK Sale 2.1.318 receipt, discount, printer and staff checks passed; inline JS parsed:",scripts.length);
