// G1-R2 V11: hunk-level equivalence for MIXED files (downstream must equal non-TEAM legacy hunks)
import { readFileSync } from 'node:fs';
const log = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G1-R2/dev/g1-review/G1-R2/';
const files = [
  { i: 1, p: 'docs/subsystems/README.md', keep: [2] },
  { i: 2, p: 'docs/subsystems/README.zh.md', keep: [2] },
  { i: 3, p: 'packages/core/session/src/known-event-types.ts', keep: [1] },
  { i: 4, p: 'scripts/gen-cordis-catalog.ts', keep: [4], note: 'h1 is one-hunk-both-kinds (partial transplant expected)' },
  { i: 5, p: 'scripts/gen-doc-graphs.ts', keep: [2] },
  { i: 6, p: 'scripts/gen-tool-catalog.ts', keep: [3, 4, 7] },
  { i: 7, p: 'tsconfig.base.json', keep: [4, 6] },
  { i: 8, p: 'website/docs.ts', keep: [2] },
];
function parseHunks(text) {
  text = text.replace(/\r/g, '');
  const lines = text.split('\n');
  const hunks = [];
  let cur = null;
  for (const line of lines) {
    if (line.startsWith('@@')) {
      if (cur) hunks.push(cur);
      const m = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
      cur = { oldStart: +m[1], oldCount: m[2] === undefined ? 1 : +m[2], newStart: +m[3], newCount: m[4] === undefined ? 1 : +m[4], body: [] };
    } else if (cur && (line.startsWith('+') || line.startsWith('-') || line === '')) {
      if (line !== '') cur.body.push(line);
    }
  }
  if (cur) hunks.push(cur);
  return hunks;
}
for (const f of files) {
  const leg = parseHunks(readFileSync(log + `v11-hunk-leg-${f.i}.txt`, 'utf8'));
  const down = parseHunks(readFileSync(log + `v11-hunk-down-${f.i}.txt`, 'utf8'));
  const want = f.keep.map((k) => leg[k - 1]);
  console.log(`\n== ${f.p} (${f.note || ''})`);
  console.log(`   legacy hunks=${leg.length} keep=${f.keep.join(',')} downstream hunks=${down.length} expected=${want.length}`);
  if (down.length !== want.length) {
    console.log(`   COUNT MISMATCH (down=${down.length} want=${want.length}) — needs manual review`);
  }
  for (let k = 0; k < Math.max(down.length, want.length); k++) {
    const d = down[k], w = want[k];
    if (!w) { console.log(`   hunk ${k + 1}: EXTRA in downstream: @@ -${d.oldStart},${d.oldCount} +${d.newStart},${d.newCount} @@`); d.body.slice(0, 6).forEach((l) => console.log('      ' + l.slice(0, 100))); continue; }
    if (!d) { console.log(`   hunk ${k + 1}: MISSING in downstream (wanted legacy hunk ${f.keep[k]}): @@ -${w.oldStart},${w.oldCount}`); continue; }
    const oldSame = d.oldStart === w.oldStart && d.oldCount === w.oldCount;
    const bodySame = d.body.length === w.body.length && d.body.every((l, j) => l === w.body[j]);
    console.log(`   hunk ${k + 1}: oldSide=${oldSame ? 'SAME' : `DIFF down(-${d.oldStart},${d.oldCount}) want(-${w.oldStart},${w.oldCount})`} body=${bodySame ? 'SAME' : 'DIFF'}`);
    if (!bodySame) {
      const n = Math.max(d.body.length, w.body.length);
      for (let j = 0; j < n; j++) {
        const a = d.body[j] ?? '<none>', b = w.body[j] ?? '<none>';
        if (a !== b) console.log(`      down: ${a.slice(0, 110)}\n      want: ${b.slice(0, 110)}`);
      }
    }
  }
}
