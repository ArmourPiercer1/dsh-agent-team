// edge-parity.mjs — run from the REPO ROOT (worktree root) after:
//   git show origin/master:scripts/eb3-family-boundaries.mjs > /tmp/eb3-old.mjs
//     (on this platform prefer a workspace path, e.g. .tmp/eb3-old.mjs)
//   node dev/agent-workflow/evidence/u7r3-dynimport-20261029/edge-parity.mjs
// Grades EVERY tracked lane file with an empty edge list (so every real edge
// becomes a finding) under the old raw-regex extractor and under BOTH new
// engines, and diffs the finding multisets per file. 0 diffs = the extractor
// change is behavior-identical for the current tree, edge by edge — stronger
// than two green 0-findings runs, which could hide canceling errors.
const old = await import('../../../../.tmp/eb3-old.mjs')
const next = await import('../../../../scripts/eb3-family-boundaries.mjs')
const { readFileSync } = await import('node:fs')
const paths = next.trackedLanePaths()
const allLaneIds = ['dsh.fs-family', 'dsh.process-family', 'dsh.search-family', 'dsh.u6-probe-family', 'dsh.inspect-family', 'dsh.web-family', 'dsh.agent-control-family', 'dsh.ui-family', 'dsh.agent-state-family']
const none = Object.fromEntries(allLaneIds.map((l) => [l, []]))
let diffs = 0
for (const p of paths) {
  const text = readFileSync(p, 'utf8')
  const files = new Map([[p, text]])
  const o = old.checkFamilyBoundaries({ files, edges: none }).findings.map((f) => f.detail).sort().join('\n')
  for (const engine of ['ast', 'regex']) {
    const n = next.checkFamilyBoundaries({ files, edges: none, engine }).findings.map((f) => f.detail).sort().join('\n')
    if (o !== n) { diffs++; console.log('DIFF', engine, p) }
  }
}
console.log(`per-file edge-parity diffs = ${String(diffs)} over ${String(paths.length)} files x 2 engines (empty-edge-list grading: every real edge is a finding)`)
