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
 ["sale row reprint uses safe data handler","data-sale-receipt"],
 ["sale discount input",'id="saleDiscount"'],
 ["system print shows discount","money(sale.discount||0)"],
 ["discount persisted on sale","subtotal,discount,total,paid"],
 ["discount deducted from profit","profit:total-costTotal"],
 ["employee cashier permission",'staffRole==="cashier"||staffRole==="employee"'],
 ["employee sales and people data loading",'cashier=staffRole==="cashier"||staffRole==="employee"'],
 ["separate receipt settings save button",'id="saveReceiptSettings"'],
 ["system print uses latest receipt",'window.printSaleReceipt(latest.id)'],
 ["bulk CSV product import",'id="importProductsCsv"'],
 ["SKU based bulk price updates",'existing.get(key)'],
 ["large CSV chunk commits",'i+=200'],
 ["CSV handles newline and quoted fields",'function parseProductCsv(text)'],
 ["multi-item sales cart",'id="saleCartRows"'],
 ["cart adds selected products",'$("addSaleItem").onclick'],
 ["transaction persists itemized sale lines",'items:receiptItems'],
 ["ESC/POS itemized receipt",'for(const item of receiptItems)'],
 ["system receipt itemized lines",'const receiptLines='],
 ["ESC/POS auto cut bytes","29,86,0"],
 ["stock adjustment UI",'id="tab-stockAdjustments"'],
 ["stock adjustment product selector",'id="adjustProduct"'],
 ["stock adjustment reason field",'id="adjustReason"'],
 ["stock adjustment manager role",'stockAdjustments:manager'],
 ["stock adjustment audit collection",'col("stockAdjustments").doc()'],
 ["stock adjustment records previous and new quantity",'before,after,delta,reason,note,createdBy'],
 ["stock adjustment backup",'stockAdjustments},null,2)']
];
for(const [label,marker] of checks){if(!(html.includes(marker)||native.includes(marker)))throw new Error("Missing: "+label)}
if(!html.includes('const width=paper==="58mm"?384:576'))throw new Error("ESC/POS paper width selection is missing");

const parserMatch=html.match(/function parseProductCsv\(text\)\{[\s\S]*?\n\}/);
if(!parserMatch)throw new Error("CSV parser is missing");
const csvContext={};vm.runInNewContext(parserMatch[0]+"\nglobalThis.__parse=parseProductCsv",csvContext);
const quoted=csvContext.__parse('name,sku\r\n"bolt, large",A-1\r\n');
if(quoted.length!==2||quoted[1][0]!=="bolt, large")throw new Error("CSV quoted field parsing failed");
const many="name,sku\n"+Array.from({length:1200},(_,i)=>"Product "+i+",SKU-"+i).join("\n");
if(csvContext.__parse(many).length!==1201)throw new Error("CSV parser did not retain 1,200 product rows");


const unitChecks=html.match(/function unitAllowsFraction\(unit\)\{[\s\S]*?\}\nfunction validUnitQuantity\(unit,value\)\{[\s\S]*?\}\nfunction validStockQuantity\(unit,value\)\{[\s\S]*?\}/);
if(!unitChecks)throw new Error("Fractional unit validation helpers are missing");
const unitContext={};vm.runInNewContext(unitChecks[0]+"\nglobalThis.__valid=validUnitQuantity;globalThis.__stock=validStockQuantity",unitContext);
if(!unitContext.__valid("kg",0.25)||!unitContext.__valid("ပေ",1.5)||unitContext.__valid("ခု",1.5)||!unitContext.__stock("kg",0.125)||unitContext.__stock("ဘူး",1.5))throw new Error("Unit quantity validation failed");
for(const [label,marker] of [
 ["product unit input",'id="pUnit"'],
 ["sale and purchase decimal input",'step="any"'],
 ["CSV unit import and export",'const unit=cell(r,"unit")'],
 ["sale transaction stores units",'unit,qty:line.qty'],
 ["purchase transaction stores units",'unit,qty,cost'],
 ["receipt binds licensed shop name",'receiptPref.shopName=String(licenseData.shopName||"")'],
 ["subscription 30-day fee",'value="30-days">၃၀ ရက် — ၃၀,၀၀၀ ကျပ်'],
 ["manual subscription renewal",'window.renewLicense=async id=>'],
 ["CSV template includes unit",'name,sku,category,unit,cost,retail,wholesale,stock,alert']
]) if(!html.includes(marker))throw new Error("Missing: "+label);
const escPos=html.slice(html.indexOf("function buildReceiptEscPos"),html.indexOf("const receiptSettingsKey"));
if(escPos.includes("AK Sale POS")||escPos.includes("AK Hardware & Electrical"))throw new Error("Shared AK branding remains on ESC/POS receipt");
const htmlReceipt=html.slice(html.indexOf("window.printSaleReceipt=async"),html.indexOf('$("testPrinter").onclick'));
if(htmlReceipt.includes('pref.shopName||"AK Hardware & Electrical"')||htmlReceipt.includes("<title>AK Sale Receipt</title>"))throw new Error("Shared AK branding remains on system receipt");

console.log("AK Sale 2.1.318 receipt, discount, printer and staff checks passed; inline JS parsed:",scripts.length);
