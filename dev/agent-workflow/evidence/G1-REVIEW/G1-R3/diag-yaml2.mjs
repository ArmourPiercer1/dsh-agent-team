import { readFileSync } from "node:fs";
const text = readFileSync("scripts/fixtures/zero-core/pnpm-workspace.yaml", "utf8");
const lines = text.split("\n");
const entry = lines.find((l) => l.includes("left-pad"));
console.log("entry JSON:", JSON.stringify(entry));
console.log("entry codepoints:", [...entry].slice(0, 12).map((c) => c.codePointAt(0).toString(16)).join(" "));
const re = /^\s{2,}([^:\s][^:]*):\s*(.*)$/;
console.log("regex test:", re.test(entry));
const m = entry.match(re);
console.log("match:", m ? JSON.stringify(m[1]) : null);
// try with \r stripped
const e2 = entry.replace(/\r$/, "");
const m2 = e2.match(re);
console.log("stripped match:", m2 ? JSON.stringify(m2[1]) : null);
// check what fails: test components
console.log("lead spaces:", /^\s{2,}/.test(entry));
console.log("key part:", /^(\s{2,})([^:\s])/.exec(entry));
// maybe the issue: key contains '@' with version - no. Check the colon position
console.log("colon idx:", entry.indexOf(":"));
const head = entry.slice(0, entry.indexOf(":"));
console.log("head JSON:", JSON.stringify(head), "head re [^:\\s][^:]*:", /^[^:\s][^:]*$/.test(head));
