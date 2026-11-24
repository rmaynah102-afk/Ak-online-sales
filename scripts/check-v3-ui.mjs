import fs from "node:fs";
const html=fs.readFileSync("v2/index.html","utf8");
const start=html.indexOf("<script>"+String.fromCharCode(10)+"const OWNER");
const end=html.indexOf("</script></body>",start);
if(start<0||end<0)throw new Error("Main application script boundaries not found");
new Function(html.slice(start+8,end));
const required=["AK POS 3.5 Professional","tab-shopprofile","profileShopName","saveShopProfile","shopProfileRef","receiptShopName","AK POS 3.5","if(!snap.exists&&staffRole===\"owner\"&&!isPlatformOwner())","initialName"];
for(const value of required)if(!html.includes(value))throw new Error("Missing required UI feature: "+value);
console.log("AK POS 3.5 UI syntax and required shop profile/receipt controls passed.");
