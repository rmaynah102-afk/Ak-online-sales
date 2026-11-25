import { readFileSync, writeFileSync } from "node:fs";
const html = readFileSync("v2/index.html", "utf8");
const scripts = [];
let cursor = 0;
while (true) {
  const open = html.indexOf("<script", cursor);
  if (open < 0) break;
  const start = html.indexOf(">", open);
  if (start < 0) throw new Error("Malformed script tag");
  const end = html.indexOf("</script>", start + 1);
  if (end < 0) throw new Error("Unclosed script tag");
  const tag = html.slice(open, start + 1).toLowerCase();
  const source = html.slice(start + 1, end);
  if (!tag.includes("src=") && source.trim()) scripts.push(source);
  cursor = end + 9;
}
if (!scripts.length) throw new Error("No inline JavaScript found in v2/index.html");
const tabNames = [...html.matchAll(/<button[^>]*data-tab="([^"]+)"/g)].map(match => match[1]);
for (const tab of tabNames) {
  if (!html.includes('id="tab-' + tab + '"')) throw new Error("Missing panel for POS tab: " + tab);
}
if (!html.includes("function switchPosTab(tab)") || !html.includes("switchPosTab(b.dataset.tab)")) throw new Error("POS navigation does not switch all declared tabs");
if (!html.includes('<option value="employee">')) throw new Error("Employee role must be available to staff accounts");
if (!html.includes('staffRole==="owner"&&String(license.email||"").trim().toLowerCase()!==String(user?.email||"").trim().toLowerCase()')) throw new Error("Merchant login must not compare staff @akstaff.app email with the shop-owner license email");
writeFileSync("/tmp/ak-pos-v2-inline.js", scripts.join("\n;\n"));
console.log("Extracted", scripts.length, "inline script block(s)");
