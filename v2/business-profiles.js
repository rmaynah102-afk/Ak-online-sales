/* Additive V3 business profile catalog.
 * Loaded as a classic script by the V2/V3 web shell when profile UI is integrated.
 * Does not alter existing data, auth, or transaction behavior.
 */
(function (root) {
  "use strict";
  const profiles = [
    { id:"hardware", name:"ကုန်မာနှင့် လျှပ်စစ်", modules:["inventory","units","priceTiers","barcodeAliases","reorder"] },
    { id:"grocery", name:"ကုန်စုံနှင့် Mini Mart", modules:["inventory","barcode","weightedItems","expiry","batches","quickCheckout"] },
    { id:"wholesale", name:"လက်ကားနှင့် ဖြန့်ချိရေး", modules:["inventory","priceLists","bulkPricing","warehouses","delivery"] },
    { id:"fashion", name:"အဝတ်အထည်နှင့် ဖက်ရှင်", modules:["inventory","variants","sizeColor","exchanges"] },
    { id:"electronics", name:"ဖုန်းနှင့် အီလက်ထရွန်းနစ်", modules:["inventory","serialNumbers","imei","warranty","repairs"] },
    { id:"restaurant", name:"စားသောက်ဆိုင်", modules:["menu","tables","orders","kitchenTickets","splitBills"] },
    { id:"cafe", name:"ကော်ဖီဆိုင်နှင့် Bakery", modules:["menu","recipes","ingredients","production","modifiers"] },
    { id:"pharmacy", name:"ဆေးဆိုင်", modules:["inventory","batches","expiry","supplierLots","regulatedStockReview"] },
    { id:"salon", name:"အလှပြင်နှင့် ဆံပင်ညှပ်", modules:["services","appointments","staffCommission","customerVisits"] },
    { id:"books", name:"စာအုပ်နှင့် စာရေးကိရိယာ", modules:["inventory","isbn","barcode","bundles"] },
    { id:"automotive", name:"ကား/ဆိုင်ကယ် အပိုပစ္စည်းနှင့် ပြုပြင်ရေး", modules:["inventory","vehicleCompatibility","jobCards","laborCharges"] },
    { id:"agriculture", name:"စိုက်ပျိုးရေးနှင့် မွေးမြူရေး", modules:["inventory","units","batches","expiry","priceTiers"] },
    { id:"general", name:"အထွေထွေ လက်လီဆိုင်", modules:["inventory","barcode","basicReports"] }
  ];
  const sharedModules = [
    "sales","purchases","customers","suppliers","expenses","receivables",
    "payables","receipts","receiptBranding","staffPermissions","auditLog",
    "branches","stockTransfers","cashClosing","returns","backup","offlineSync"
  ];
  root.AK_BUSINESS_PROFILES = Object.freeze({
    schemaVersion: 1,
    profiles: Object.freeze(profiles.map(p => Object.freeze({
      id: p.id, name: p.name, modules: Object.freeze(p.modules.slice())
    }))),
    sharedModules: Object.freeze(sharedModules.slice()),
    get: function (id) { return profiles.find(p => p.id === id) || profiles.find(p => p.id === "general"); },
    list: function () { return profiles.map(p => ({ id:p.id, name:p.name })); }
  });
})(window);
