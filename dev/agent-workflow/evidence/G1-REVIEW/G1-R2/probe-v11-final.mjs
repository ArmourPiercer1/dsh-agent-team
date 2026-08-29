// G1-R2 V11: final cross-checks — team-name scan parity, REFERENCE_ONLY content scan, doc pages
import { readFileSync } from 'node:fs';
const log = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G1-R2/dev/g1-review/G1-R2/';
const downTree = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P1-int-downstream/';
function treeSet(p) {
  const s = new Set();
  for (const l of readFileSync(p, 'utf8').replace(/\r/g, '').split('\n')) { const i = l.indexOf('\t'); if (i > 0) s.add(l.slice(i + 1)); }
  return s;
}
const D = treeSet(log + 'v11-tree-downstream.txt');
const B = treeSet(log + 'v11-tree-base.txt');
console.log('E) doc pages:');
console.log('  down docs/subsystems/permission.md:', D.has('docs/subsystems/permission.md'), '(base:', B.has('docs/subsystems/permission.md') + ')');
console.log('  down docs/subsystems/team.md:', D.has('docs/subsystems/team.md'));
console.log('  down docs/subsystems/agent-team.md:', D.has('docs/subsystems/agent-team.md'), '(base:', B.has('docs/subsystems/agent-team.md') + ')');
// A') parity scan: same broad regex on base vs downstream lockfiles
const teamRe = /dsh-team|team-|tool-team|agent-team/i;
function scan(p) { const n = []; readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (teamRe.test(l)) n.push(l.trim().slice(0, 100)); }); return n; }
const hb = scan(log + 'v11-lock-base.txt'), hd = scan(log + 'v11-lock-down.txt');
console.log(`A') broad team-name lines: base=${hb.length} downstream=${hd.length}`);
const hbset = new Set(hb);
const extraInDown = hd.filter((l) => !hbset.has(l));
console.log('  lines in downstream not in base:', extraInDown.length);
for (const l of extraInDown.slice(0, 10)) console.log('   + ' + l);
// D) team-content sanity scan of the 13 REFERENCE_ONLY files in downstream
const rel13 = [
  '.agents/notes/implemented/architecture/2026-08-15-layered-rule-loading-and-cold-recovery-snapshot.md',
  '.agents/notes/implemented/architecture/2026-08-15-layered-rule-loading-and-cold-recovery-snapshot.zh.md',
  '.agents/notes/implemented/architecture/2026-08-15-permission-seam-and-mcp-fusion.md',
  '.agents/notes/implemented/architecture/2026-08-15-permission-seam-and-mcp-fusion.zh.md',
  '.agents/notes/implemented/architecture/2026-08-20-tool-permission-guard-resolves-permission-per-call.md',
  '.agents/notes/implemented/architecture/2026-08-20-tool-permission-guard-resolves-permission-per-call.zh.md',
  '.agents/notes/implemented/bug-fix/2026-08-21-base-composition-carries-the-permission-engine.md',
  '.agents/notes/implemented/bug-fix/2026-08-21-base-composition-carries-the-permission-engine.zh.md',
  '.agents/notes/implemented/bug-fix/2026-08-21-permission-rule-matching-aligns-with-harness-tool-calls.md',
  '.agents/notes/implemented/bug-fix/2026-08-21-permission-rule-matching-aligns-with-harness-tool-calls.zh.md',
  '.agents/notes/implemented/feature/2026-08-14-model-picker-family-grouping.md',
  '.agents/notes/implemented/feature/2026-08-14-model-picker-family-grouping.zh.md',
  'apps/web/tests/expected/models-settings/fetch-grouped.expected.md',
];
const wordTeam = /\bteam\b|teammate|team-member|packages\/team|dsh-team/i;
console.log('D) team-word scan of 13 REFERENCE_ONLY downstream files:');
for (const p of rel13) {
  const fp = downTree + p.replace(/\//g, '\\');
  let text;
  try { text = readFileSync(fp, 'utf8'); } catch { console.log('  MISSING: ' + p); continue; }
  const hits = text.split('\n').filter((l) => wordTeam.test(l));
  console.log(`  ${p}: ${hits.length} team-word line(s)`);
  for (const h of hits.slice(0, 4)) console.log('     | ' + h.trim().slice(0, 110));
}
