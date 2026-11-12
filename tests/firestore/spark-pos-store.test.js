const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("apk/spark-pos-store.js", "utf8");
const sandbox = {};
vm.runInNewContext(source, sandbox, { filename: "spark-pos-store.js" });
const { splitSensitive, mergeSensitive } = sandbox.AKSparkPosInternals;
const SparkStore = sandbox.AKSparkPosStore;
for (const method of ["createInvite", "claimInvite", "listStaff", "setStaffPrintPermission", "revokeStaff", "migrateLegacyWorkspace", "loadWorkspace", "saveWorkspace", "upsert"]) {
  assert.equal(typeof SparkStore.prototype[method], "function", "missing adapter method: " + method);
}

const legacyProduct = {
  id: "p_1", name: "Hammer", price: 5000, stock: 4,
  costPrice: 3200, margin: 1800,
  photo: "data:image/png;base64,AAAA"
};
const productParts = splitSensitive(legacyProduct);
assert.equal(productParts.base.costPrice, undefined);
assert.equal(productParts.base.margin, undefined);
assert.equal(productParts.costs.costPrice, 3200);
assert.equal(productParts.costs.margin, 1800);
assert.deepEqual(JSON.parse(JSON.stringify(mergeSensitive(productParts.base, productParts.costs))), legacyProduct);

const legacySale = {
  id: "s_1", total: 10000, paid: 10000,
  lines: [
    { productId: "p_1", qty: 2, price: 5000, unitCost: 3200, profit: 3600 },
    { productId: "p_2", qty: 1, price: 2000, purchaseCost: 1200 }
  ]
};
const saleParts = splitSensitive(legacySale);
assert.equal(saleParts.base.lines[0].unitCost, undefined);
assert.equal(saleParts.base.lines[0].profit, undefined);
assert.equal(saleParts.base.lines[1].purchaseCost, undefined);
assert.deepEqual(JSON.parse(JSON.stringify(mergeSensitive(saleParts.base, saleParts.costs))), legacySale);

function hasSensitive(value) {
  if (Array.isArray(value)) return value.some(hasSensitive);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) =>
    ["cost", "costPrice", "unitCost", "purchaseCost", "profit", "grossProfit", "margin"].includes(key) || hasSensitive(child)
  );
}
assert.equal(hasSensitive(productParts.base), false);
assert.equal(hasSensitive(saleParts.base), false);

const appHtml = fs.readFileSync("app.html", "utf8");
const apkHtml = fs.readFileSync("apk/app.html", "utf8");
assert.match(appHtml, /<script src="\.\/spark-pos-store\.js"><\/script>/);
assert.match(apkHtml, /<script src="\.\/spark-pos-store\.js"><\/script>/);
// The APK shell must call the Spark staff adapter rather than Cloud Functions for staff lifecycle.
assert.match(apkHtml, /sparkStore\.claimInvite\(code\)/);
assert.match(apkHtml, /sparkStore\.createInvite\(role\)/);
assert.match(apkHtml, /akShopStaffCache=await sparkStore\.listStaff\(\)/);
assert.match(apkHtml, /sparkStore\.setStaffPrintPermission\(uid,canPrint\)/);
assert.match(apkHtml, /sparkStore\.revokeStaff\(uid\)/);
assert.match(apkHtml, /akSparkStore\.saveWorkspace\(workspaceData\)/);
assert.match(apkHtml, /akSparkStore\.migrateLegacyWorkspace\(remote\.data\)/);
assert.equal((apkHtml.match(/httpsCallable\("loadShopWorkspace"\)/g) || []).length, 0);
assert.equal((apkHtml.match(/httpsCallable\("saveShopWorkspace"\)/g) || []).length, 0);
assert.equal((source.match(/this\.db\.FieldValue/g) || []).length, 0);

assert.match(apkHtml, /shopMembers["']\)\.doc\(user\.uid\)\.get\(\)/);

// Parse every inline APK script so a syntactically broken UI cannot pass adapter tests.
for (const match of apkHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
  const script = match[1].trim();
  if (script) new vm.Script(script, { filename: "apk/app.html:inline-script" });
}
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.match(packageJson.scripts["copy-web"], /spark-pos-store\.js/);

const schema = sandbox.AKSparkPosSchema;
assert.deepEqual(JSON.parse(JSON.stringify(schema.roleCollections.cashier)), ["products", "sales", "people", "payments"]);
assert.equal(schema.roleCollections.employee.includes("expenses"), false);
assert.equal(schema.roleCollections.manager.includes("productCosts"), true);
console.log("AK Spark POS adapter: 9 checks passed");
