import { readFileSync, writeFileSync } from "node:fs";
const html = readFileSync("v2/index.html", "utf8");
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(source => source.trim());
if (!scripts.length) throw new Error("No inline JavaScript found in v2/index.html");
writeFileSync("/tmp/ak-pos-v2-inline.js", scripts.join("\n;\n"));
console.log("Extracted", scripts.length, "inline script block(s)");
