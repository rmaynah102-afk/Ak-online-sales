'use strict';
const fs=require('fs');
const html=fs.readFileSync('v2/index.html','utf8');
const checks=[
 ['Business-specific category presets exist for the supported shop industries',/const PRODUCT_CATEGORY_PRESETS=\{[\s\S]*?hardware:[\s\S]*?grocery:[\s\S]*?electronics:[\s\S]*?mobile:[\s\S]*?pharmacy:[\s\S]*?fashion:[\s\S]*?stationery:[\s\S]*?general:/.test(html)],
 ['Shop license industry type is applied before product category rendering',html.includes('activeIndustryType=String(lic.data().industryType||"general")')&&html.includes('renderProductCategoryOptions();\n await loadShopProfile();')],
 ['Product category filter and low-stock filter are available',html.includes('id="productCategoryFilter"')&&html.includes('id="productLowStockOnly"')],
 ['Catalog search covers name, SKU, barcode, category and unit',html.includes('p.nameLower,p.sku,p.skuLower,p.barcode,p.category,p.categoryLower,p.unit')],
 ['Catalog category filter and low-stock filter are applied together',html.includes('matchesText&&matchesCategory&&matchesStock')],
 ['New product records store normalized search keys and business type',html.includes('nameLower:name.toLowerCase(),sku,skuLower:sku.toLowerCase(),category,categoryLower:category.toLowerCase(),industryType:activeIndustryType')],
 ['Bulk product import stores normalized search keys and business type',html.includes('nameLower:x.name.toLowerCase(),sku:x.sku,skuLower:x.sku.toLowerCase(),category:x.category,categoryLower:x.category.toLowerCase(),industryType:activeIndustryType')],
 ['Sale cart checks quantity against available stock before checkout',html.includes('if(qty+already>Number(p.stock||0))')],
 ['Sale checkout re-reads product documents and checks stock inside transaction',html.includes('await db.runTransaction(async tx=>{\n  const snapshots=[];for(const line of lines)')&&html.includes('if(line.qty>stock)throw Error("လက်ကျန်မလုံလောက်ပါ: "+line.name')],
 ['Sale checkout records payment type, paid amount and outstanding balance',html.includes('payment:payType,createdAt:firebase.firestore.FieldValue.serverTimestamp()')&&html.includes('due:total-paid')],
 ['Successful sale refreshes inventory and attempts receipt printing',html.includes('saleCart=[];$("salePaid").value="0"')&&html.includes('await window.printSaleReceipt(saleRef.id)')]
];
for(const [name,ok] of checks)console.log((ok?'PASS ':'FAIL ')+name);
const failed=checks.filter(([,ok])=>!ok).map(([name])=>name);
if(failed.length)throw new Error('Catalog/Sales workflow validation failed: '+failed.join('; '));
console.log('Catalog and sales workflow checks passed.');
