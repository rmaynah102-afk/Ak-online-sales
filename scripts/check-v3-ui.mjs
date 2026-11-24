import fs from "node:fs";
const html=fs.readFileSync("v2/index.html","utf8");
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if(!scripts.length)throw new Error("No inline application script found");
new Function(scripts.at(-1)[1]);
const required=["AK POS 3.5 Professional","tab-shopprofile","profileShopName","saveShopProfile","shopProfileRef","receiptShopName","AK POS 3.5"];
for(const value of required)if(!html.includes(value))throw new Error("Missing required UI feature: "+value);
console.log("AK POS 3.5 UI syntax and required shop profile/receipt controls passed.");
