// G1-R2 V11: pnpm-lock.yaml analysis — importers & team-name scan (base vs downstream vs legacy)
import { execSync } from 'node:child_process';
// node spawn of git is blocked in sandbox (EPERM on piped stdio), so we pass pre-dumped files instead.
import { readFileSync } from 'node:fs';
const down = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P1-int-downstream';
const log = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G1-R2/dev/g1-review/G1-R2/';
// lockfile text via git show (dumped by pwsh): provided as argv files
function importersOf(text) {
  const set = new Set();
  let inImporters = false;
  for (const line of text.split('\n')) {
    if (/^importers:\s*$/.test(line)) { inImporters = true; continue; }
    if (inImporters && /^[a-z]/.test(line)) { inImporters = false; }
    if (inImporters) {
      const m = line.match(/^  ([A-Za-z0-9@/_\-.]+):\s*$/);
      if (m) set.add(m[1]);
    }
  }
  return set;
}
const baseText = readFileSync(log + 'v11-lock-base.txt', 'utf8');
const downText = readFileSync(log + 'v11-lock-down.txt', 'utf8');
const legText = readFileSync(log + 'v11-lock-legacy.txt', 'utf8');
const B = importersOf(baseText), D = importersOf(downText), L = importersOf(legText);
console.log('importers: base=%d downstream=%d legacy=%d', B.size, D.size, L.size);
const added = [...D].filter((x) => !B.has(x)).sort();
const removed = [...B].filter((x) => !D.has(x)).sort();
console.log('downstream = base + %d - %d', added.length, removed.length);
console.log('ADDED importers:'); for (const x of added) console.log('  + ' + x);
console.log('REMOVED importers:'); for (const x of removed) console.log('  - ' + x);
// does downstream == base + (legacy generic importers minus team importers)?
const legNew = [...L].filter((x) => !B.has(x)).sort();
console.log('legacy-added importers (%d):', legNew.length); for (const x of legNew) console.log('  L+' + x);
const missingVsExpected = legNew.filter((x) => !D.has(x));
console.log('legacy-added NOT in downstream:', missingVsExpected.length); for (const x of missingVsExpected) console.log('  MISS ' + x);
// team name scan in downstream lockfile
const teamRe = /dsh-team|team-|tool-team|teamRegistry|agent-team/i;
const hits = [];
downText.split('\n').forEach((l, i) => { if (teamRe.test(l) && !/^\s*#/.test(l)) hits.push(`${i + 1}: ${l.trim().slice(0, 120)}`); });
console.log('team-name hits in downstream lockfile:', hits.length);
for (const h of hits.slice(0, 30)) console.log('  ' + h);
// deletions present in the diff?
const delLines = readFileSync(log + 'v11-lockfile-diff.txt', 'utf8').split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---'));
console.log('diff lines removed:', delLines.length);
for (const l of delLines.slice(0, 20)) console.log('  DEL ' + l);
