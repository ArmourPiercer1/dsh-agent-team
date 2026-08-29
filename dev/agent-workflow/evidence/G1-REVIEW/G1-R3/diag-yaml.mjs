import { readFileSync } from "node:fs";
const p = "scripts/fixtures/zero-core/pnpm-workspace.yaml";
const buf = readFileSync(p);
console.log("first bytes:", [...buf.subarray(0, 4)].map((b) => b.toString(16)).join(" "));
const text = readFileSync(p, "utf8");
const lines = text.split("\n");
let inBlock = false;
for (const line of lines) {
  if (/^patchedDependencies:\s*(#.*)?$/.test(line)) {
    inBlock = true;
    console.log("BLOCK START on:", JSON.stringify(line));
    continue;
  }
  if (inBlock) {
    const m = line.match(/^\s{2,}([^:\s][^:]*):\s*(.*)$/);
    if (m === null) {
      console.log("nonmatch line:", JSON.stringify(line));
      if (/^\S/.test(line)) inBlock = false;
      continue;
    }
    console.log("KEY:", JSON.stringify(m[1].trim().replace(/^['"]|['"]$/g, "")));
  }
}
