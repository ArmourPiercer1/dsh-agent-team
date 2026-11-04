/**
 * a5sf-acceptance-preflight.test.mjs — the HOST-FREE proof for the P2-01
 * six-row preflight (zero boots, zero ports, no DSH_HOME, no pristine writes).
 *
 * WHAT IT PINS, and why each pin is a defect class from #575:
 *
 *   A. ROOT IDENTITY — the exact object `run-boot.mjs` imports has ONE root
 *      value at creation/state/tool/archive/oracle. The #575 driver created the
 *      Team on one root and observed another; a mismatch must throw before a
 *      grant, and the negative control here uses the #575 literals verbatim.
 *   B. DISPOSE-FAULT IDENTITY — the classifier never counts a non-fault
 *      observation, matches identity-bearing faults by EXACT session id, and
 *      treats another session's fault as foreign. The #575 strings are the
 *      fixtures (`agent=session-a5sf-acceptance-team` was the false positive).
 *   C. THREE-WAY ORACLE — for EVERY case (precondition + six rows) the judge
 *      must answer PROVEN / REFUTED / NOT_REACHED on the three synthetic
 *      samples, and a `NOT_REACHED` input must NEVER come back PROVEN. This is
 *      the #575-shaped hole: six rows reported numbers off `null` inputs.
 *
 * Run: node --test tests/world-factory/a5sf-acceptance-preflight.test.mjs
 *      (or `pnpm test:node`, which discovers every tests/world-factory test)
 *
 * @module tests/world-factory/a5sf-acceptance-preflight.test
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ACCEPTANCE_CASES,
  AcceptanceRootMismatch,
  P2_01_ACCEPTANCE_ROOTS,
  acceptanceRootIdentity,
  assertAcceptanceRootWiring,
  classifyDisposeFaults,
  classifyObservation,
  judgeAcceptanceRow,
  judgePrecondition,
  judgeRow1,
  judgeRow2,
  judgeRow3,
  judgeRow4,
  judgeRow5,
  judgeRow6,
  toRunVerdict,
} from './lib/a5sf-acceptance-preflight.mjs'

// ─────────────────────────────────────────────────────────────────────────────
// A. the root identity contract
// ─────────────────────────────────────────────────────────────────────────────

test('A1 the driver root constant is ONE value across every observation seam', () => {
  const roots = P2_01_ACCEPTANCE_ROOTS
  const wired = assertAcceptanceRootWiring(roots)
  assert.equal(wired.ok, true)
  assert.equal(wired.root, 'session-a5sf-acceptance-team')
  // The boot root is the ANCHOR team's root; it is a different session and is
  // not an observation root for the acceptance rows.
  assert.equal(wired.bootRoot, 'session-a5sf-acceptance-root')
  assert.notEqual(wired.bootRoot, wired.root)
  assert.equal(wired.rootsCoincide, false)
  for (const seam of ['createRoot', 'stateQueryRoot', 'toolRouteRoot', 'archiveRoot', 'oracleRoot', 'directiveRoot']) {
    assert.equal(roots[seam], roots.teamRoot, `${seam} must address the root the Team is created on`)
  }
})

test('A2 the #575 split wiring is REFUSED with the typed code, before any boot', () => {
  // The exact shape #575 ran: create on `…-team`, observe `…-root`.
  const split = {
    bootRoot: 'session-a5sf-acceptance-root',
    teamRoot: 'session-a5sf-acceptance-team',
    createRoot: 'session-a5sf-acceptance-team',
    stateQueryRoot: 'session-a5sf-acceptance-root',
    toolRouteRoot: 'session-a5sf-acceptance-root',
    archiveRoot: 'session-a5sf-acceptance-root',
    oracleRoot: 'session-a5sf-acceptance-root',
    directiveRoot: 'session-a5sf-acceptance-root',
  }
  assert.throws(
    () => assertAcceptanceRootWiring(split),
    (error) => {
      assert.equal(error instanceof AcceptanceRootMismatch, true)
      assert.equal(error.code, 'ACCEPTANCE_ROOT_MISMATCH')
      assert.match(error.detail, /session-a5sf-acceptance-root/)
      assert.match(error.detail, /#575/)
      return true
    },
  )
})

test('A3 acceptanceRootIdentity exposes exactly one team root and rejects blanks', () => {
  const roots = acceptanceRootIdentity({ bootRoot: 'boot', teamRoot: 'team' })
  assert.deepEqual(
    ['createRoot', 'stateQueryRoot', 'toolRouteRoot', 'archiveRoot', 'oracleRoot', 'directiveRoot'].map((key) => roots[key]),
    ['team', 'team', 'team', 'team', 'team', 'team'],
  )
  assert.throws(() => acceptanceRootIdentity({ bootRoot: 'boot', teamRoot: '   ' }), AcceptanceRootMismatch)
  assert.throws(() => assertAcceptanceRootWiring({ createRoot: 'team' }), AcceptanceRootMismatch)
})

test('A4 the verdict vocabulary maps 1:1 onto the run record and is total', () => {
  assert.deepEqual(ACCEPTANCE_CASES.length, 7)
  assert.equal(toRunVerdict('PROVEN'), 'PASS')
  assert.equal(toRunVerdict('REFUTED'), 'FAIL')
  assert.equal(toRunVerdict('NOT_REACHED'), 'NOT_REACHED')
  assert.throws(() => toRunVerdict('FAIL'), /not an acceptance verdict/)
})

// ─────────────────────────────────────────────────────────────────────────────
// B. the dispose-fault identity classifier
// ─────────────────────────────────────────────────────────────────────────────

/** The #575 observation stream, verbatim in shape. */
const OBSERVATIONS_575 = [
  'a5p1-guard: guard-installed agent=session-a5sf-acceptance-team',
  'a5p1-guard: guard-installed agent=session-a5sf-acceptance-root',
  'a5sf: native tool shadow INVALIDATED (a5sf-native-invalidation/1): a managed native tool is no longer shadowed',
  "p6t6: residency dispose failed for 'session-a5sf-acceptance-team': durable handle drain timed out",
  "p6t6: residency dispose failed for 'session-some-other-world': transient",
  'a5sf: realm dispose failed: disposer rejected: boom',
]

test('B1 a non-fault observation containing the managed session NAME is not a fault', () => {
  const guard = classifyObservation('a5p1-guard: guard-installed agent=session-a5sf-acceptance-team')
  assert.equal(guard.fault, false)
  assert.equal(guard.liveSurfaceChange, false)
})

test('B2 identity-bearing faults match by EXACT session id; another session is foreign', () => {
  const result = classifyDisposeFaults({
    observations: OBSERVATIONS_575,
    managed: { sessionId: 'session-a5sf-acceptance-team', instanceId: 'inst-1' },
    duringManagedDisposal: true,
    managedRealmCount: 1,
  })
  // exactly the two faults for THIS member: the residency fault naming it and
  // the identity-less realm-dispose fault inside its disposal window.
  assert.equal(result.managed.length, 2)
  assert.deepEqual(result.managed.map((entry) => entry.kind).sort(), ['realm-dispose', 'residency-dispose'])
  assert.equal(result.foreign.length, 1, 'the other session’s residency fault is foreign, never counted')
  assert.equal(result.foreign[0].sessionId, 'session-some-other-world')
  assert.equal(result.ignoredNonFaultCount, 2, 'the two guard-installed lines are not faults')
  assert.equal(result.liveSurfaceChanges.length, 1, 'the invalidation line is row-5 evidence, not a dispose fault')
})

test('B3 the identity-less realm fault is only attributed inside the managed window AND with one realm', () => {
  const outsideWindow = classifyDisposeFaults({
    observations: OBSERVATIONS_575,
    managed: { sessionId: 'session-a5sf-acceptance-team' },
    duringManagedDisposal: false,
    managedRealmCount: 1,
  })
  assert.equal(outsideWindow.managed.length, 1, 'only the exact-session residency fault is attributable')
  assert.equal(outsideWindow.unattributed.length, 1)

  const twoRealms = classifyDisposeFaults({
    observations: OBSERVATIONS_575,
    managed: { sessionId: 'session-a5sf-acceptance-team' },
    duringManagedDisposal: true,
    managedRealmCount: 2,
  })
  assert.equal(twoRealms.managed.length, 1)
  assert.equal(twoRealms.unattributed.length, 1, 'an identity-less fault cannot be pinned when two realms exist')
})

test('B4 an identity-bearing fault is managed regardless of the window; the window only gates the identity-less one', () => {
  // The exact session id IS the identity proof, so the residency fault is
  // counted even when the caller has not opened a disposal window.
  const withoutWindow = classifyDisposeFaults({
    observations: ["p6t6: residency dispose failed for 's-managed': x"],
    managed: { sessionId: 's-managed' },
    duringManagedDisposal: false,
  })
  assert.equal(withoutWindow.managed.length, 1)
  assert.equal(withoutWindow.managed[0].attribution, 'exact-session-id')

  // The realm fault has no identity: without the window it is NOT counted.
  const realmWithoutWindow = classifyDisposeFaults({
    observations: ['a5sf: realm dispose failed: boom'],
    managed: { sessionId: 's-managed' },
    duringManagedDisposal: false,
  })
  assert.equal(realmWithoutWindow.managed.length, 0)
  assert.equal(realmWithoutWindow.unattributed.length, 1)
})

// ─────────────────────────────────────────────────────────────────────────────
// C. the three-way oracle
// ─────────────────────────────────────────────────────────────────────────────

const CLAIM_A = 'A5SF_ACC_A_world'
const CLAIM_B = 'A5SF_ACC_B_world'
const CLAIM_C = 'A5SF_ACC_C_world'
const WRITE_B = 'A5SF_ACC_WRITE_world\n'

const readCall = (path) => ({ callId: `call-${path}`, name: 'read', args: { file_path: path } })
const result = (text, isError = false) => ({ isError, text })

/** Failing/passing samples are DERIVED from one passing base per row, so a
 *  mutation of the base cannot make the "pass" sample silently weaker. */
const PASS = {
  precondition: {
    hostAlive: true,
    memberRequest: {
      readSchemas: 1,
      surfaceSize: 24,
      duplicateNames: false,
      systemPromptReadMentions: 0,
      systemPromptReadSectionMentions: 0,
    },
    discovery: { readSchemas: 1, readMentions: 0, readSectionMentions: 0 },
    readCalls: 3,
  },
  row1: {
    call: readCall('/w/a.txt'),
    result: result(`${CLAIM_A}\n`),
    claim: CLAIM_A,
    allowFacts: [{ realm: 'binding', decision: 'allow' }],
    bindingAllowFacts: [{ realm: 'binding', decision: 'allow', toolBindingIdentity: 'dsh.fs/read' }],
    counterRows: [{ leg: 'read-call', isBase: false, instance: 'fs-1' }],
  },
  row2: {
    call: readCall('/w/b.txt'),
    result: result('read refused: path is outside every allow subtree of the lane', true),
    claim: CLAIM_B,
    writeContent: WRITE_B,
    facts: [{ realm: 'binding', decision: 'deny', toolBindingIdentity: 'dsh.fs/read' }],
    bindingDenyFacts: [{ realm: 'binding', decision: 'deny', toolBindingIdentity: 'dsh.fs/read' }],
    counterRows: [],
  },
  row3: {
    call: readCall('/outside/c.txt'),
    result: result('read refused: path is outside every allow subtree of the lane', true),
    claim: CLAIM_C,
    denyFacts: [{ realm: 'binding', decision: 'deny' }],
    bindingDenyFacts: [{ realm: 'binding', decision: 'deny' }],
    counterRows: [],
    probeC: { locator: '/outside/c.txt', ceilingRead: 'deny', restrictionRead: 'allow', effectiveRead: 'deny' },
    laneReport: { effective: { read: { allow: ['/w/axis/allow'] } } },
  },
  row4: {
    call: { callId: 'call-write-b', name: 'write', args: { file_path: '/w/b.txt' } },
    result: result('wrote 18 bytes'),
    expectedContent: WRITE_B,
    disk: WRITE_B,
    writeFacts: [{ realm: 'member', toolBindingIdentity: null, method: 'write', decision: 'allow' }],
    ceilingFacts: [{ realm: 'member', toolBindingIdentity: null, method: 'write', decision: 'allow' }],
    readLaneWriteFacts: [],
    counterRows: [{ leg: 'write-call', isBase: false }],
  },
  row5: {
    member: { instanceId: 'inst-1', templateId: 'worker', childSessionId: 'session-child-1' },
    lateTrigger: { status: 200, ok: true },
    lateReport: { registered: true },
    invalidationLine: 'a5sf: native tool shadow INVALIDATED (a5sf-native-invalidation/1): uncovered=["read"]',
    postRead: {
      status: 200,
      body: {
        ok: false,
        error: { message: 'refused', info: { code: 'A5SF_NATIVE_SHADOW_INVALIDATED', name: 'A5sfNativeShadowInvalidatedError' } },
      },
    },
    inLaneRead: {
      status: 200,
      body: { ok: false, error: { message: 'refused', info: { code: 'A5SF_NATIVE_SHADOW_INVALIDATED' } } },
    },
    forbiddenClaim: CLAIM_B,
    sinkDelta: 0,
    counterDelta: 0,
  },
  row6: {
    member: { instanceId: 'inst-1', templateId: 'worker', childSessionId: 'session-child-1' },
    archive: { status: 200, body: { ok: true } },
    membersAfter: [{ templateId: 'worker', lifecycle: 'ARCHIVED', childSessionId: 'session-child-1' }],
    observations: [
      'a5p1-guard: guard-installed agent=session-child-1',
      'd1v3: base-tool preset mount skipped for \'session-child-1\' (fresh-member) — the agent is already joined to a preset',
    ],
    managed: { sessionId: 'session-child-1', instanceId: 'inst-1' },
    duringManagedDisposal: true,
    managedRealmCount: 1,
    postStopDispatches: [
      { status: 422, body: { error: "no live agent for 'session-child-1'" } },
      { status: 200, body: { ok: false, error: { message: 'refused', info: { code: 'A5SF_NATIVE_SHADOW_INVALIDATED' } } } },
    ],
    residencyDrop: { status: 200, body: { ok: true, dropped: true } },
    forbiddenClaim: CLAIM_B,
    sinkDelta: 0,
    healthStatus: 200,
    hostAlive: true,
  },
}

/** The three samples each case MUST distinguish. */
const NOT_REACHED_SAMPLES = {
  'live:composition-precondition-read-surface': { hostAlive: true, memberRequest: null, discovery: null, readCalls: 0 },
  'live:row1-read-a-inside-both-allowed': { call: null, result: null, claim: CLAIM_A },
  'live:row2-read-b-binding-deny-exactly-one-fact': { call: readCall('/w/b.txt'), result: null, claim: CLAIM_B },
  'live:row3-read-c-refused-no-widening': { call: null, result: null, claim: CLAIM_C },
  'live:row4-write-b-ceiling-allowed-no-read-lane-fact': { call: null, result: null, expectedContent: WRITE_B },
  'live:row5-post-invalidation-refused-shadow-invalidated': { member: null, forbiddenClaim: CLAIM_B },
  'live:row6-teardown-no-usable-unconstrained-shadow': { member: null, archive: null, forbiddenClaim: CLAIM_B },
}

const REFUTED_SAMPLES = {
  'live:composition-precondition-read-surface': {
    ...PASS.precondition,
    memberRequest: { ...PASS.precondition.memberRequest, readSchemas: 2 },
  },
  'live:row1-read-a-inside-both-allowed': { ...PASS.row1, result: result('permission denied', true) },
  'live:row2-read-b-binding-deny-exactly-one-fact': {
    ...PASS.row2,
    facts: [...PASS.row2.facts, { realm: 'member', decision: 'allow' }],
  },
  'live:row3-read-c-refused-no-widening': {
    ...PASS.row3,
    probeC: { ...PASS.row3.probeC, effectiveRead: 'allow' },
  },
  'live:row4-write-b-ceiling-allowed-no-read-lane-fact': {
    ...PASS.row4,
    readLaneWriteFacts: [{ realm: 'binding', toolBindingIdentity: 'dsh.fs/read', method: 'write', decision: 'allow' }],
  },
  'live:row5-post-invalidation-refused-shadow-invalidated': {
    ...PASS.row5,
    postRead: { status: 200, body: { ok: true, value: { text: CLAIM_B } } },
  },
  'live:row6-teardown-no-usable-unconstrained-shadow': {
    ...PASS.row6,
    observations: [
      ...PASS.row6.observations,
      'a5sf: realm dispose failed: disposer rejected: boom',
    ],
  },
}

test('C0 every case has all three samples and every NOT_REACHED sample answers NOT_REACHED', () => {
  assert.deepEqual(Object.keys(NOT_REACHED_SAMPLES).sort(), [...ACCEPTANCE_CASES].sort())
  assert.deepEqual(Object.keys(REFUTED_SAMPLES).sort(), [...ACCEPTANCE_CASES].sort())
  for (const caseId of ACCEPTANCE_CASES) {
    const judged = judgeAcceptanceRow(caseId, NOT_REACHED_SAMPLES[caseId])
    assert.equal(judged.verdict, 'NOT_REACHED', `${caseId}: a missing observable must never produce ${judged.verdict}`)
    assert.match(judged.reason, /^[A-Z0-9_]+$/)
  }
})

test('C1 every case PROVES on the passing sample and REFUTES on the contradicted sample', () => {
  for (const caseId of ACCEPTANCE_CASES) {
    const passKey = caseId === 'live:composition-precondition-read-surface' ? 'precondition'
      : `row${caseId.match(/row(\d)/)[1]}`
    const passSample = PASS[passKey]
    const proven = judgeAcceptanceRow(caseId, passSample)
    assert.equal(proven.verdict, 'PROVEN', `${caseId}: ${JSON.stringify(proven)}`)
    const refuted = judgeAcceptanceRow(caseId, REFUTED_SAMPLES[caseId])
    assert.equal(refuted.verdict, 'REFUTED', `${caseId}: ${JSON.stringify(refuted)}`)
    assert.notEqual(refuted.reason, proven.reason)
  }
})

test('C2 no row can be PROVEN with an absent observable (the #575 hole)', () => {
  // A driver that evaluates a row against `null` inputs must record
  // NOT_REACHED, never PASS. Each judge is called with the emptiest possible
  // sample and must not answer PROVEN.
  const empty = {}
  for (const caseId of ACCEPTANCE_CASES) {
    const judged = judgeAcceptanceRow(caseId, empty)
    assert.notEqual(judged.verdict, 'PROVEN', `${caseId} proved on an empty sample`)
  }
})

test('C3 the row-level reason codes distinguish the two NOT_REACHED shapes #575 conflated', () => {
  // row 5: no member in state vs. a member but no invalidation event.
  const noMember = judgeRow5({ member: null })
  assert.equal(noMember.verdict, 'NOT_REACHED')
  assert.equal(noMember.reason, 'NO_MEMBER_CHILD_SESSION_IN_STATE')
  const noEvent = judgeRow5({
    ...PASS.row5,
    lateTrigger: { status: 200, ok: false },
    lateReport: { registered: false },
  })
  assert.equal(noEvent.verdict, 'NOT_REACHED')
  assert.equal(noEvent.reason, 'INVALIDATION_EVENT_NOT_PRODUCED')
  // row 6: no member vs. a member that was never stopped.
  assert.equal(judgeRow6({ member: null }).reason, 'NO_MEMBER_TO_STOP')
  assert.equal(
    judgeRow6({ ...PASS.row6, archive: { status: 200, body: { ok: false, error: { code: 'TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS' } } } }).reason,
    'MEMBER_NOT_STOPPED',
  )
})

test('C4 row 2 refuses a "pass" produced by a missing sink channel (facts are part of the claim)', () => {
  const noSink = judgeRow2({ ...PASS.row2, facts: [], bindingDenyFacts: [] })
  assert.equal(noSink.verdict, 'REFUTED', 'a call that exists but records no deny fact contradicts "exactly one"')
  const wrongLane = judgeRow2({ ...PASS.row2, bindingDenyFacts: [] })
  assert.equal(wrongLane.verdict, 'REFUTED')
})

test('C5 row 6 does not count a foreign session’s fault nor a name-bearing non-fault line', () => {
  const foreign = judgeRow6({
    ...PASS.row6,
    observations: [
      "p6t6: residency dispose failed for 'session-other': transient",
      'a5p1-guard: guard-installed agent=session-child-1',
    ],
  })
  assert.equal(foreign.verdict, 'PROVEN', JSON.stringify(foreign))
  const managed = judgeRow6({
    ...PASS.row6,
    observations: ["p6t6: residency dispose failed for 'session-child-1': boom"],
  })
  assert.equal(managed.verdict, 'REFUTED')
  assert.equal(managed.detail.failed.includes('noManagedDisposeFault'), true)
})

test('C6 row 3 cannot PASS without the lane report (no-widening is asserted from it)', () => {
  assert.equal(judgeRow3({ ...PASS.row3, laneReport: null }).reason, 'NO_LANE_REPORT_C')
  assert.equal(judgeRow3({ ...PASS.row3, probeC: null }).reason, 'NO_LANE_PROBE_C')
})

test('C7 the precondition requires a member request AND the one-read surface (never a proxy)', () => {
  assert.equal(judgePrecondition({ hostAlive: true, memberRequest: null, discovery: null, readCalls: 0 }).verdict, 'NOT_REACHED')
  assert.equal(
    judgePrecondition({ ...PASS.precondition, memberRequest: { ...PASS.precondition.memberRequest, duplicateNames: true } }).verdict,
    'REFUTED',
  )
})

test('C8 each verdict carries a closed reason code (auditable without prose)', () => {
  for (const caseId of ACCEPTANCE_CASES) {
    const judged = judgeAcceptanceRow(caseId, PASS[caseId === 'live:composition-precondition-read-surface' ? 'precondition' : `row${caseId.match(/row(\d)/)[1]}`])
    assert.match(judged.reason, /^[A-Z0-9_]+$/)
    assert.equal(judged.detail.reason, judged.reason)
  }
})
