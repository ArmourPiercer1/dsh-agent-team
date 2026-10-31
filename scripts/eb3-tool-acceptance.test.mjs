/**
 * eb3-tool-acceptance.test.mjs — mutation negative controls for the RUN_PROVEN /
 * CASE_PROVEN proof levels and the DISCLOSED source-verbatim law (law ①,
 * ACCEPT_DISCLOSED_UNSOURCED) of scripts/eb3-tool-acceptance.mjs (remediation
 * R-ACCEPT-RUN-1; the law-① trio below closes the gap booked by sync17 F-1 / #528:
 * C20(d) in eb3-ci-negative-controls.mjs stages only empty-reason→UNREASONED, so
 * until (m)–(o) below, weakening containsVerbatim to always-true left CI green).
 * Host-free: it calls checkToolAcceptance with synthetic in-memory ledgers and
 * records, never the real ledger or git.
 *
 * Each enforcement axis must be able to FAIL, and the two compliant shapes
 * (RUN_PROVEN and CASE_PROVEN) must stay green:
 *   (a) RUN_PROVEN on a record whose overall != PASS   → ACCEPT_PROVEN_NOT_PASS_OVERALL
 *   (b) RUN_PROVEN on a mock-marked record             → ACCEPT_PROVEN_MOCK_OR_OFFLINE
 *   (c) RUN_PROVEN with a wrong --candidate-sha        → ACCEPT_PROVEN_CANDIDATE_MISMATCH
 *   (d) RUN_PROVEN without host provenance             → ACCEPT_PROVEN_NO_HOST_PROVENANCE
 *   (e) RUN_PROVEN on a FAIL case                      → ACCEPT_PROVEN_UNBACKED
 *   (f) CASE_PROVEN without disclosure                 → ACCEPT_CASE_PROVEN_UNDISCLOSED
 *   (g) CASE_PROVEN on L4-positive                     → ACCEPT_CASE_PROVEN_ON_L4
 *   (h) compliant RUN_PROVEN + compliant CASE_PROVEN   → no findings
 *   (i) RUN_PROVEN with a matching --candidate-sha     → no findings
 *   (j) CASE_PROVEN with missing failedScope           → ACCEPT_CASE_PROVEN_UNDISCLOSED
 *   (k) CASE_PROVEN with a non-verbatim runOverall     → ACCEPT_CASE_PROVEN_UNDISCLOSED
 *   (l) unknown proof value (proof:'CASEE')            → ACCEPT_SCHEMA
 *   (m) DISCLOSED whose named source lacks the reason verbatim → ACCEPT_DISCLOSED_UNSOURCED
 *   (n) DISCLOSED whose reason matches the source only after whitespace normalisation → green
 *   (o) self-proof for (m): a temp COPY of the checker with containsVerbatim weakened to
 *       always-true turns (m)'s fixture green while the UNREASONED law next door still
 *       fires — so (m) really depends on law ①, not on decoration. The real checker file
 *       is never modified: ESM export bindings are read-only and the checker calls
 *       containsVerbatim as a local function, so an in-memory monkeypatch cannot reach
 *       the call site and the checker exposes no injection env — hence the temp copy.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { checkToolAcceptance } from './eb3-tool-acceptance.mjs'

const SCHEMA = 'u7-tool-acceptance/1'
const TOOL = 'team_synth'
const FAMILY = 'dsh.synth-family'
const CASE = 'ac:case'

function runRecord(overrides = {}) {
  return {
    schema: 'u5-run-record/1',
    runId: 'synth-run',
    suite: 'synth',
    overall: 'PASS',
    finishedAt: '2026-10-27T00:00:00.000Z',
    cases: [{ id: CASE, verdict: 'PASS' }],
    bindings: { teamSha: 'team-1', hostSha: 'host-1' },
    ...overrides,
  }
}

const NV = { status: 'NOT_VERIFIED', note: 'n/a' }
function row(overrides = {}) {
  return {
    tool: TOOL,
    familyId: FAMILY,
    'L1-definition': { ...NV },
    'L2-mounted': { ...NV },
    'L3-refusal': { ...NV },
    'L4-positive': { ...NV },
    ...overrides,
  }
}
const PROVEN = (record, cas) => ({ status: 'PROVEN', evidence: { record, case: cas } })

/** Grade synthetic rows against in-memory records; optional candidateSha.
 *  String record values are passed through verbatim — a law-① fixture's
 *  `source` is a prose file, and JSON.stringify would eat its line breaks. */
function grade(records, rows, candidateSha) {
  const readFile = (rel) => (rel in records ? (typeof records[rel] === 'string' ? records[rel] : JSON.stringify(records[rel])) : null)
  const isTracked = (rel) => rel in records
  const claims = new Map([[TOOL, { familyId: FAMILY }]])
  return checkToolAcceptance({
    ledger: { schema: SCHEMA, rows },
    claims,
    readFile,
    isTracked,
    candidateSha,
  })
}

const has = (out, code) => out.findings.some((f) => f.code === code)

test('(a) RUN_PROVEN refuses a record whose overall is not PASS', () => {
  const out = grade({ 'r.json': runRecord({ overall: 'REFUSED' }) }, [row({ 'L2-mounted': PROVEN('r.json', CASE) })])
  assert.ok(has(out, 'ACCEPT_PROVEN_NOT_PASS_OVERALL'), JSON.stringify(out.findings))
})

test('(b) RUN_PROVEN refuses every implemented mock/offline marker (5 axes)', () => {
  const markers = [
    { mode: 'mock' },
    { bootStarted: false },
    { offlineJudge: 'offline re-grade narration' },
    { mock: true },
    { offline: true },
  ]
  for (const m of markers) {
    const out = grade({ 'r.json': runRecord(m) }, [row({ 'L2-mounted': PROVEN('r.json', CASE) })])
    assert.ok(has(out, 'ACCEPT_PROVEN_MOCK_OR_OFFLINE'), `marker ${JSON.stringify(m)}: ${JSON.stringify(out.findings)}`)
  }
})

test('(c) RUN_PROVEN refuses a wrong --candidate-sha binding', () => {
  const out = grade({ 'r.json': runRecord() }, [row({ 'L2-mounted': PROVEN('r.json', CASE) })], 'other-sha')
  assert.ok(has(out, 'ACCEPT_PROVEN_CANDIDATE_MISMATCH'), JSON.stringify(out.findings))
})

test('(d) RUN_PROVEN refuses a record with no host provenance (empty or blank)', () => {
  for (const hostSha of ['', '   ']) {
    const out = grade({ 'r.json': runRecord({ bindings: { teamSha: 'team-1', hostSha } }) }, [row({ 'L2-mounted': PROVEN('r.json', CASE) })])
    assert.ok(has(out, 'ACCEPT_PROVEN_NO_HOST_PROVENANCE'), `hostSha=${JSON.stringify(hostSha)}: ${JSON.stringify(out.findings)}`)
  }
})

test('(e) RUN_PROVEN refuses a FAIL case', () => {
  const out = grade({ 'r.json': runRecord({ overall: 'FAIL', cases: [{ id: CASE, verdict: 'FAIL' }] }) }, [row({ 'L2-mounted': PROVEN('r.json', CASE) })])
  assert.ok(has(out, 'ACCEPT_PROVEN_UNBACKED'), JSON.stringify(out.findings))
})

test('(f) CASE_PROVEN without disclosure is refused', () => {
  const level = { status: 'PROVEN', proof: 'CASE', evidence: { record: 'r.json', case: CASE } }
  const out = grade({ 'r.json': runRecord({ overall: 'REFUSED' }) }, [row({ 'L2-mounted': level })])
  assert.ok(has(out, 'ACCEPT_CASE_PROVEN_UNDISCLOSED'), JSON.stringify(out.findings))
})

test('(g) CASE_PROVEN on L4-positive is refused', () => {
  const level = { status: 'PROVEN', proof: 'CASE', runOverall: 'PASS', failedScope: ['x'], caseIndependence: 'y', evidence: { record: 'r.json', case: CASE } }
  const out = grade({ 'r.json': runRecord() }, [row({ 'L4-positive': level })])
  assert.ok(has(out, 'ACCEPT_CASE_PROVEN_ON_L4'), JSON.stringify(out.findings))
})

test('(h) compliant RUN_PROVEN and compliant CASE_PROVEN are green', () => {
  const caseLevel = {
    status: 'PROVEN',
    proof: 'CASE',
    runOverall: 'REFUSED',
    failedScope: ['ac:enumerate-governed', 'ac:spawn-failclosed', 'old teamSha 0ea0848acd'],
    caseIndependence: 'ac:case PASS asserts its own effect independently of the run-level REFUSED',
    evidence: { record: 'case.json', case: CASE },
  }
  const out = grade(
    { 'run.json': runRecord(), 'case.json': runRecord({ overall: 'REFUSED' }) },
    [row({ 'L2-mounted': PROVEN('run.json', CASE), 'L3-refusal': caseLevel })],
  )
  assert.equal(out.findings.length, 0, JSON.stringify(out.findings))
  assert.equal(out.caseProofs, 1)
})

test('(i) RUN_PROVEN with a matching --candidate-sha is green', () => {
  const out = grade({ 'r.json': runRecord() }, [row({ 'L2-mounted': PROVEN('r.json', CASE) })], 'team-1')
  assert.equal(out.findings.length, 0, JSON.stringify(out.findings))
})

test('(j) CASE_PROVEN with missing failedScope is refused', () => {
  const level = { status: 'PROVEN', proof: 'CASE', runOverall: 'REFUSED', caseIndependence: 'y', evidence: { record: 'r.json', case: CASE } }
  const out = grade({ 'r.json': runRecord({ overall: 'REFUSED' }) }, [row({ 'L2-mounted': level })])
  assert.ok(has(out, 'ACCEPT_CASE_PROVEN_UNDISCLOSED'), JSON.stringify(out.findings))
})

test('(k) CASE_PROVEN with a non-verbatim runOverall is refused', () => {
  const level = { status: 'PROVEN', proof: 'CASE', runOverall: 'pass', failedScope: ['x'], caseIndependence: 'y', evidence: { record: 'r.json', case: CASE } }
  const out = grade({ 'r.json': runRecord({ overall: 'PASS' }) }, [row({ 'L2-mounted': level })])
  assert.ok(has(out, 'ACCEPT_CASE_PROVEN_UNDISCLOSED'), JSON.stringify(out.findings))
})

test('(l) unknown proof value (proof:\'CASEE\') is refused', () => {
  const level = { status: 'PROVEN', proof: 'CASEE', evidence: { record: 'r.json', case: CASE } }
  const out = grade({ 'r.json': runRecord() }, [row({ 'L2-mounted': level })])
  assert.ok(has(out, 'ACCEPT_SCHEMA'), JSON.stringify(out.findings))
})

// ── Law ① ACCEPT_DISCLOSED_UNSOURCED (checker `source` branch) — sync17 F-1 / #528.
// A DISCLOSED level may name a `source`; when it does, the reason must be findable
// in that file word for word (line breaks forgiven). No fixture below touches the
// real ledger: every source file is a synthetic string in the records map.

const UNSOURCED_REASON = 'the suite refuses every write outside the workspace root'
const discRow = (reason, source) => row({ 'L3-refusal': { status: 'DISCLOSED', reason, pr: '#528', source } })

test('(m) DISCLOSED whose source does not contain the reason verbatim is refused', () => {
  const out = grade(
    { 'disclosure.md': 'The lane was exercised offline; the reviewer accepted the re-grade narration.' },
    [discRow(UNSOURCED_REASON, 'disclosure.md')],
  )
  const hit = out.findings.find((f) => f.code === 'ACCEPT_DISCLOSED_UNSOURCED')
  assert.ok(hit !== undefined, JSON.stringify(out.findings))
  assert.ok(hit.detail.includes('does not contain the reason verbatim'), `wrong branch: ${hit.detail}`)
  assert.equal(out.findings.length, 1, JSON.stringify(out.findings))
})

test('(n) DISCLOSED with a line-wrapped verbatim reason is green (normalisation branch enforced)', () => {
  // Direct `includes` CANNOT match here — the sentence is re-wrapped and
  // re-indented — so this fixture only stays green via the whitespace
  // normalisation half of containsVerbatim; tightening it would turn (n) red.
  const out = grade(
    { 'disclosure.md': 'Booked at review:\n  the suite refuses   every\n    write outside the workspace root, per the transcript.\n' },
    [discRow(UNSOURCED_REASON, 'disclosure.md')],
  )
  assert.equal(out.findings.length, 0, JSON.stringify(out.findings))
})

test('(o) self-proof: weakening containsVerbatim to always-true breaks (m) — the red really depends on law ①', async () => {
  // Injection is impossible in-place (see file header), so the mutation runs on a
  // temp copy of the checker; the real scripts/eb3-tool-acceptance.mjs is read
  // only, never modified. Fail-closed on the anchor: if the checker is refactored
  // away from this spelling, the control goes RED and must move with it — a
  // silently vacuous negative control is exactly what (o) exists to prevent.
  const real = readFileSync(new URL('./eb3-tool-acceptance.mjs', import.meta.url), 'utf8')
  const ANCHOR = 'export function containsVerbatim(haystack, needle) {'
  assert.ok(real.includes(ANCHOR), 'mutation anchor is gone — update this control WITH the checker, never drop it silently')
  const mutantSrc = real.replace(ANCHOR, `${ANCHOR}\n  return true // MUTANT: law ① verifier weakened`)
  assert.notEqual(mutantSrc, real, 'mutation was a no-op')
  const dir = mkdtempSync(join(tmpdir(), 'eb3-law1-mutant-'))
  try {
    const file = join(dir, 'eb3-tool-acceptance-mutant.mjs')
    writeFileSync(file, mutantSrc)
    const mod = await import(pathToFileURL(file).href)
    const records = { 'disclosure.md': 'The lane was exercised offline; the reviewer accepted the re-grade narration.' }
    const mutantGrade = (rows) => mod.checkToolAcceptance({
      ledger: { schema: SCHEMA, rows },
      claims: new Map([[TOOL, { familyId: FAMILY }]]),
      readFile: (rel) => (rel in records ? records[rel] : null),
      isTracked: (rel) => rel in records,
    })
    // (m)'s exact fixture goes green under the mutant — the assertion in (m)
    // fails there, which is what proves (m) is law-① enforcement, not prose.
    const underMutant = mutantGrade([discRow(UNSOURCED_REASON, 'disclosure.md')])
    assert.deepEqual(underMutant.findings, [], 'the mutant still refused the unsourced reason — (m) is not grading the branch it claims to')
    // Canary: the mutant is alive, not inert — the UNREASONED law next door still fires.
    const canary = mutantGrade([discRow('   ', 'disclosure.md')])
    assert.ok(canary.findings.some((f) => f.code === 'ACCEPT_DISCLOSED_UNREASONED'), JSON.stringify(canary.findings))
    // Differential in one place: the REAL module still refuses the same fixture.
    const underReal = grade(records, [discRow(UNSOURCED_REASON, 'disclosure.md')])
    assert.ok(underReal.findings.some((f) => f.code === 'ACCEPT_DISCLOSED_UNSOURCED'), JSON.stringify(underReal.findings))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
