// G1-R2 V11 (fixed): classify downstream tree vs manifest replay rules (blob-level, CRLF-safe)
import { readFileSync } from 'node:fs';
const log = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G1-R2/dev/g1-review/G1-R2/';
const manifest = JSON.parse(readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G1-R2/dev/agent-workflow/evidence/provenance/file-manifest.json', 'utf8'));
function parseTree(p) {
  const map = new Map();
  const text = readFileSync(p, 'utf8').replace(/\r/g, '');
  for (const line of text.split('\n')) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) { continue; }
    const meta = line.slice(0, tab).split(' ');
    const path = line.slice(tab + 1);
    map.set(path, { type: meta[1], sha: meta[2], mode: meta[0] });
  }
  return map;
}
const base = parseTree(log + 'v11-tree-base.txt');
const down = parseTree(log + 'v11-tree-downstream.txt');
const leg = parseTree(log + 'v11-tree-legacy.txt');
console.log(`trees: base=${base.size} downstream=${down.size} legacy=${leg.size}`);
console.log('sanity: .gitignore in all three:', base.has('.gitignore'), down.has('.gitignore'), leg.has('.gitignore'));
const same = (a, b) => a && b && a.type === b.type && a.sha === b.sha && a.mode === b.mode;
const issues = [];
const okCount = {};
const bump = (k) => { okCount[k] = (okCount[k] || 0) + 1; };
let hunkCheck = 0;
for (const f of manifest.files) {
  const P = f.path;
  const d = down.get(P), b = base.get(P), l = leg.get(P);
  let expect;
  if (f.classification === 'UNRELATED_FORK_FEATURE' || (f.classification === 'GENERIC_FORK_CAPABILITY' && f.disposition === 'KEEP')) expect = 'legacy';
  else if (f.classification === 'GENERIC_FORK_CAPABILITY' && f.disposition === 'SPLIT' && (f.mixed_hunks || []).length === 0) expect = 'legacy';
  else if (f.classification === 'MIXED') expect = 'hunk';
  else if (f.disposition === 'REFERENCE_ONLY' && f.classification === 'GENERIC_FORK_CAPABILITY') expect = 'base';
  else if (f.classification === 'TEAM_OWNED' || f.classification === 'GENERATED_FROM_TEAM') expect = 'base';
  else { issues.push(`UNKNOWN RULE: ${f.classification}/${f.disposition} ${P}`); continue; }
  if (expect === 'hunk') {
    hunkCheck++;
    const hunks = f.mixed_hunks || [];
    const allTeam = hunks.length > 0 && hunks.every((h) => h.kind === 'TEAM');
    if (allTeam) {
      if (b === undefined) { if (d === undefined) bump('MIXED all-TEAM absent-as-base'); else issues.push(`MIXED all-TEAM absent in base but PRESENT in downstream: ${P}`); }
      else if (d === undefined) issues.push(`MIXED all-TEAM present in base but ABSENT in downstream: ${P}`);
      else if (same(d, b)) bump('MIXED all-TEAM unchanged');
      else issues.push(`MIXED all-TEAM changed vs base: ${P} (down=${d.sha} base=${b.sha})`);
    } else if (d && b && same(d, b)) {
      issues.push(`MIXED has non-TEAM hunks but downstream == base (no replay?): ${P}`);
    } else if (d && l && same(d, l)) {
      issues.push(`MIXED downstream == legacy (Team hunks may have been replayed!): ${P}`);
    } else bump('MIXED pending-hunkcheck');
    continue;
  }
  const want = expect === 'legacy' ? l : b;
  if (want === undefined) {
    if (d === undefined) bump(`${expect}:absent`);
    else issues.push(`${expect} (absent in want) but PRESENT in downstream: ${P}`);
  } else if (d === undefined) {
    issues.push(`${expect} present but MISSING in downstream: ${P}`);
  } else if (same(d, want)) {
    bump(`${expect}:identical`);
  } else {
    issues.push(`${expect} MISMATCH: ${P}\n  down=${d.type}:${d.sha}@${d.mode}\n  want=${want.type}:${want.sha}@${want.mode}\n  base=${b ? b.sha : '-'} legacy=${l ? l.sha : '-'}`);
  }
}
console.log(`\nmanifest entries: ${manifest.files.length}, hunk-check deferred: ${hunkCheck}`);
console.log('OK breakdown:', JSON.stringify(okCount, null, 1));
console.log(`ISSUES: ${issues.length}`);
for (const i of issues) console.log('ISSUE: ' + i);
const mp = new Set(manifest.files.map((f) => f.path));
const extraAdded = [], extraDeleted = [], extraChanged = [];
for (const [P, d] of down) if (!base.has(P) && !mp.has(P)) extraAdded.push(P);
for (const [P, b] of base) if (!down.has(P) && !mp.has(P)) extraDeleted.push(P);
for (const [P, d] of down) if (base.has(P) && !same(d, base.get(P)) && !mp.has(P)) extraChanged.push(P);
console.log(`\nextra (not in manifest): added=${extraAdded.length} deleted=${extraDeleted.length} changed=${extraChanged.length}`);
for (const p of extraAdded) console.log('EXTRA-ADD: ' + p);
for (const p of extraDeleted) console.log('EXTRA-DEL: ' + p);
for (const p of extraChanged) console.log('EXTRA-CHG: ' + p);
