// What does the rewritten report-shape control do on a hypothetical EMPTY dirty set?
// (Coordinator's question, asked as "prove it can fail — and say what it does when
// there is nothing to fail on".)
//
// Answer, executed rather than asserted: build the same ScanRun the wrapper reads,
// but with `dirty: []` (every other class kept, so the scan still "ran"), format it
// with the real `formatReport`, and run the control's two loops over it.
import { formatReport } from '../../../../../../scripts/verify-blueprint-version-clean.mjs'

const synthetic = {
  ran: true,
  reason: null,
  scopeFiles: 741,
  blindKeyHalf: 36,
  blindNonTyped: 2,
  blindDocMarked: 0,
  ledgerFile: 'dev/agent-workflow/evidence/a4-pr7/scan-scope/unknown-adjudications.json',
  ledgerCount: 24,
  dirty: [],
  advisory: [{ path: 'packages/x/test/y.test.ts', line: 80, version: 2, why: 'code-position' }],
  unknown: [],
  refused: [{ path: 'packages/x/test/z.test.ts', line: 96, version: 1, ns: 'projection-envelope', why: 'x' }],
  prose: [{ path: 'packages/x/test/w.test.ts', line: 12, version: 2 }],
  adjudicated: [],
}

const report = formatReport(synthetic)
const dirtyPaths = [...new Set(synthetic.dirty.map((s) => s.path))].sort()

const printed = new Map()
for (const line of report.split('\n')) {
  const off = /^OFFENDING (.+?) :: (.*)$/.exec(line)
  if (off !== null) printed.set(off[1], new Set(off[2].split(', ').map((t) => t.trim())))
}

let pathLoop = 0
for (const p of dirtyPaths) { pathLoop += 1; if (!printed.has(p)) throw new Error('would fail: ' + p) }
let siteLoop = 0
for (const s of synthetic.dirty) { siteLoop += 1 }

console.log(JSON.stringify({
  dirtyPaths: dirtyPaths.length,
  pathLoopIterations: pathLoop,
  siteLoopIterations: siteLoop,
  reportHasAnyOffendingLine: /^OFFENDING /m.test(report),
  reportDirtyTallyLine: /^RESULT dirty\(.*$/m.exec(report)?.[0] ?? null,
  reportVerdict: /^RESULT verdict: .*$/m.exec(report)?.[0] ?? null,
  literalArchetypeAssertion: report.includes('OFFENDING packages/domain/blueprint/testdata/fixtures.ts :: '),
  tallyAssertionWouldPass: report.includes(`RESULT dirty(${String(dirtyPaths.length)} files`),
}, null, 2))
