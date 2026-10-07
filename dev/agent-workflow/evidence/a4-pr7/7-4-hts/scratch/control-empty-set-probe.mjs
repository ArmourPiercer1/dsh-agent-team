// What does the hardened report-shape control do on a hypothetical EMPTY dirty set?
// (The coordinator's D3 question, RE-RUN against the reviewer's hardened leg rather
// than left as an answer to the leg it was first asked about — an empty-set claim about
// a program that no longer exists is worth nothing.)
//
// Answer, executed rather than asserted: build the same ScanRun the wrapper reads, but
// with `dirty: []` (every other class kept, so the scan still "ran"), format it with the
// real `formatReport`, and run the leg's own parse-and-compare over the result.
import { formatReport } from '../../../../../../scripts/verify-blueprint-version-clean.mjs'

const synthetic = {
  ran: true,
  reason: null,
  scopeFiles: 744,
  blindKeyHalf: 36,
  blindNonTyped: 2,
  blindDocMarked: 0,
  ledgerFile: 'dev/agent-workflow/evidence/a4-pr7/scan-scope/unknown-adjudications.json',
  ledgerCount: 24,
  dirty: [],
  advisory: [{ path: 'packages/x/test/y.test.ts', line: 80, version: 2, why: 'code-position' }],
  unknown: [],
  refused: [
    { path: 'packages/x/test/z.test.ts', line: 96, version: 1, ns: 'projection-envelope', why: 'x' },
  ],
  prose: [{ path: 'packages/x/test/w.test.ts', line: 12, version: 2 }],
  adjudicated: [],
}

const report = formatReport(synthetic)
const run = { dirty: synthetic.dirty }
const dirtyPaths = [...new Set(run.dirty.map((site) => site.path))].sort()

// ↓ the leg as it now stands in the wrapper test (per-path EXACT multiset).
const printed = new Map()
for (const line of report.split('\n')) {
  const off = /^OFFENDING (.+?) :: (.*)$/.exec(line)
  const offPath = off?.[1]
  const offSites = off?.[2]
  if (offPath !== undefined && offSites !== undefined) {
    const toks = offSites
      .split(', ')
      .map((t) => t.trim())
      .filter((t) => t !== '')
    printed.set(offPath, [...(printed.get(offPath) ?? []), ...toks])
  }
}
let comparisons = 0
for (const path of dirtyPaths) {
  const expected = run.dirty
    .filter((s) => s.path === path)
    .map((s) => `L${String(s.line)}=v${String(s.version)}`)
    .sort()
  comparisons += 1
  if (JSON.stringify([...(printed.get(path) ?? [])].sort()) !== JSON.stringify(expected)) {
    throw new Error('would fail on ' + path)
  }
}
// ↑ end of the leg.

console.log(
  JSON.stringify(
    {
      dirtyPaths: dirtyPaths.length,
      exactMultisetComparisons: comparisons,
      reportHasAnyOffendingLine: /^OFFENDING /m.test(report),
      reportDirtyTallyLine: /^RESULT dirty\(.*$/m.exec(report)?.[0] ?? null,
      reportVerdict: /^RESULT verdict: .*$/m.exec(report)?.[0] ?? null,
      tallyAssertionPasses: report.includes(
        `RESULT dirty(${String(dirtyPaths.length)} files, ${String(run.dirty.length)} sites)`,
      ),
      literalArchetypeAssertionPasses: report.includes(
        'OFFENDING packages/domain/blueprint/testdata/fixtures.ts :: ',
      ),
    },
    null,
    2,
  ),
)
