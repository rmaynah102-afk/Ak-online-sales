import fs from "node:fs";
const html=fs.readFileSync("v2/index.html","utf8");
const start=html.lastIndexOf("<script>");
const end=html.indexOf("</script>",start);
if(start<0||end<0)throw new Error("No inline application script found");
new Function(html.slice(start+8,end));
const required=["AK POS 3.5 Professional","tab-shopprofile","profileShopName","saveShopProfile","shopProfileRef","receiptShopName","AK POS 3.5"];
for(const value of required)if(!html.includes(value))throw new Error("Missing required UI feature: "+value);
console.log("AK POS 3.5 UI syntax and required shop profile/receipt controls passed.");
