/**
 * eb3-tool-acceptance.test.mjs — mutation negative controls for the RUN_PROVEN /
 * CASE_PROVEN proof levels of scripts/eb3-tool-acceptance.mjs (remediation
 * R-ACCEPT-RUN-1). Host-free: it calls checkToolAcceptance with synthetic
 * in-memory ledgers and records, never the real ledger or git.
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
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
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

/** Grade synthetic rows against in-memory records; optional candidateSha. */
function grade(records, rows, candidateSha) {
  const readFile = (rel) => (rel in records ? JSON.stringify(records[rel]) : null)
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
