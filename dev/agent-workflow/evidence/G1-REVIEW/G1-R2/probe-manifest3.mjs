// G1-R2 V11 probe: classification x disposition + per-file disposition lists for UNRELATED/GENERIC/MIXED
import { readFileSync } from 'node:fs';
const p = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G1-R2/dev/agent-workflow/evidence/provenance/file-manifest.json';
const m = JSON.parse(readFileSync(p, 'utf8'));
const files = m.files;
const by = {};
for (const f of files) {
  by[f.classification] = by[f.classification] || {};
  by[f.classification][f.disposition] = (by[f.classification][f.disposition] || 0) + 1;
}
console.log('== classification x disposition ==');
console.log(JSON.stringify(by, null, 1));
for (const cat of ['UNRELATED_FORK_FEATURE', 'GENERIC_FORK_CAPABILITY', 'MIXED']) {
  const list = files.filter((f) => f.classification === cat);
  console.log(`== ${cat} (${list.length}) ==`);
  for (const f of list) {
    const hunks = (f.mixed_hunks || []).map((h) => `h${h.hunk}:${h.kind}`).join(' ');
    console.log(`${f.disposition}\t${f.path}\t[${hunks}]`);
  }
}
