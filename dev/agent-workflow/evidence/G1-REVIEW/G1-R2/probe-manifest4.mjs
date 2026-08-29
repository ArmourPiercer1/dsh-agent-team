// G1-R2 V11 probe: manifest schema + sample entries per classification
import { readFileSync } from 'node:fs';
const p = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G1-R2/dev/agent-workflow/evidence/provenance/file-manifest.json';
const m = JSON.parse(readFileSync(p, 'utf8'));
console.log('top-level keys:', Object.keys(m).join(', '));
for (const k of Object.keys(m)) {
  if (k !== 'files') console.log(`  ${k} =`, JSON.stringify(m[k]).slice(0, 300));
}
console.log('files count:', m.files.length);
const seen = new Set();
for (const f of m.files) {
  if (seen.has(f.classification)) continue;
  seen.add(f.classification);
  console.log(`\n-- sample ${f.classification}:`);
  console.log(JSON.stringify(f, null, 1).slice(0, 900));
}
// any entries with non-array extra keys?
const keysets = new Set();
for (const f of m.files) keysets.add(Object.keys(f).sort().join('|'));
console.log('\nentry key shapes:', [...keysets].join(' || '));
// rename-ish fields?
const ren = m.files.filter((f) => f.old_path || f.renamed_from || f.from);
console.log('entries with rename-ish fields:', ren.length);
