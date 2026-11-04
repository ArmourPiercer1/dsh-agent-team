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
import { readFileSync } from 'node:fs'

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
  normalizeObservation,
  REALM_INVALIDATED_CODE,
  toRunVerdict,
} from './lib/a5sf-acceptance-preflight.mjs'

/** The REAL #575 stream, extracted from the committed `teardown.json` (read-only
 *  fixture: that boot cannot be re-run). Review B4: a synthetic 6-line stream
 *  cannot prove the classifier against the stream that actually fooled #575. */
const FIXTURE_575 = JSON.parse(readFileSync(new URL('./fixtures/a5sf-575-teardown-observations.json', import.meta.url), 'utf8'))

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
  for (const seam of ['createRoot', 'stateQueryRoot', 'archiveRoot', 'oracleRoot', 'directiveRoot']) {
    assert.equal(roots[seam], roots.teamRoot, `${seam} must address the root the Team is created on`)
  }
  // `toolRouteRoot` is a LABEL: the tool route dispatches by the member child
  // session, so it is not counted as evidence in the assertion.
  assert.equal(roots.toolRouteRoot, roots.teamRoot)
  assert.equal(roots.toolRouteRootIsLabel, true)
  assert.equal(wired.toolRouteRootIsLabel, true)
  assert.equal(wired.productionRowRootChecked, false, 'the plain call does not claim to have checked the row config')
  assert.equal(wired.directiveRootChecked, false)
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

test('A5 the production row root is asserted, so anchoring it on the acceptance root is REFUSED', () => {
  const roots = P2_01_ACCEPTANCE_ROOTS
  const ok = assertAcceptanceRootWiring(roots, { productionRowRoot: roots.bootRoot, directiveRoot: roots.teamRoot })
  assert.equal(ok.ok, true)
  assert.equal(ok.productionRowRootChecked, true)
  assert.equal(ok.directiveRootChecked, true)

  // review B3: this passed the old guard and died at team.create on the live path.
  assert.throws(
    () => assertAcceptanceRootWiring(roots, { productionRowRoot: roots.teamRoot, directiveRoot: roots.teamRoot }),
    (error) => error instanceof AcceptanceRootMismatch && /production team row/.test(error.detail) && /TEAM_CREATE_BLUEPRINT_MISMATCH|anchor team/.test(error.detail),
  )
})

test('A6 the p6t6 directive root is asserted, so a second directive literal is REFUSED', () => {
  const roots = P2_01_ACCEPTANCE_ROOTS
  assert.throws(
    () => assertAcceptanceRootWiring(roots, { productionRowRoot: roots.bootRoot, directiveRoot: roots.bootRoot }),
    (error) => error instanceof AcceptanceRootMismatch && /p6t6 directive/.test(error.detail),
  )
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

test('B5 the REAL #575 stream classifies as non-faults (20 observations / the 27-line old filter result)', () => {
  assert.equal(FIXTURE_575.counts.observations, 20)
  assert.equal(FIXTURE_575.counts.oldFilterFaults, 27)
  assert.ok(FIXTURE_575.counts.oldFilterFaultsNotInObservations > 0, 'the #575 fault list was a different, longer snapshot')

  for (const [label, list] of [['observations', FIXTURE_575.observations], ['old a5sfFaults', FIXTURE_575.a5sfFaultsAsRecordedByTheOldFilter]]) {
    const result = classifyDisposeFaults({
      observations: list,
      managed: { sessionId: 'session-a5sf-acceptance-team', instanceId: 'inst-leader' },
      duringManagedDisposal: true,
      managedRealmCount: 1,
    })
    assert.equal(result.managed.length, 0, `${label}: no managed fault exists in this stream`)
    assert.equal(result.foreign.length, 0, `${label}: no identity-bearing fault exists either`)
    assert.equal(result.ignoredNonFaultCount, list.length, `${label}: every line is a non-fault`)
    assert.equal(result.liveSurfaceChanges.length, 0, `${label}: the invalidation line was not in this snapshot`)
  }
})

test('B6 a prefixed / wrapped REAL fault is still attributed (a fault cannot hide as ignored)', () => {
  const variants = [
    '  p6t6: residency dispose failed for \'session-child-1\': boom',
    '[error] p6t6: residency dispose failed for \'session-child-1\': boom',
    'ERROR: p6t6: residency dispose failed for \'session-child-1\': boom',
    '[warn] p6t6: residency dispose failed for "session-child-1": boom',
    'p6t6: residency dispose failed for session-child-1: boom',
    '"p6t6: residency dispose failed for \'session-child-1\': boom"',
    '[error] a5sf: realm dispose failed: disposer rejected: boom',
    '  " a5sf: realm dispose failed: boom "',
  ]
  for (const line of variants) {
    const parsed = classifyObservation(line)
    assert.equal(parsed.fault, true, `must detect: ${JSON.stringify(line)} -> normalized ${JSON.stringify(normalizeObservation(line))}`)
  }
  const result = classifyDisposeFaults({
    observations: variants,
    managed: { sessionId: 'session-child-1' },
    duringManagedDisposal: true,
    managedRealmCount: 1,
  })
  assert.equal(result.managed.length, 8, 'all eight decorated variants are attributed, none ignored')
  assert.equal(result.ignoredNonFaultCount, 0)
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
    facts: [{ realm: 'binding', decision: 'deny', toolBindingIdentity: 'dsh.fs/read', method: 'readText' }],
    bindingDenyFacts: [{ realm: 'binding', decision: 'deny', toolBindingIdentity: 'dsh.fs/read', method: 'readText' }],
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
    // TWO read facts is the contradiction; a WRITE fact at the same locator is
    // the healthy stream and is pinned by C9.
    facts: [...PASS.row2.facts, { realm: 'binding', decision: 'deny', toolBindingIdentity: 'dsh.fs/read', method: 'readText' }],
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

test('C3 the row-level reason codes distinguish "never asked" from "asked and contradicted"', () => {
  // ROW 5 (review B2). Only a trigger that was NEVER dispatched is NOT_REACHED.
  const noMember = judgeRow5({ member: null })
  assert.equal(noMember.verdict, 'NOT_REACHED')
  assert.equal(noMember.reason, 'NO_MEMBER_CHILD_SESSION_IN_STATE')

  const neverDispatched = judgeRow5({ ...PASS.row5, lateTrigger: null })
  assert.equal(neverDispatched.verdict, 'NOT_REACHED')
  assert.equal(neverDispatched.reason, 'NO_INVALIDATION_TRIGGER')

  // Registered, trigger 200, but the product recorded NO invalidation: the
  // product WAS asked (NoStaleShadow). This used to come back NOT_REACHED.
  const notRaised = judgeRow5({ ...PASS.row5, invalidationLine: null })
  assert.equal(notRaised.verdict, 'REFUTED')
  assert.equal(notRaised.reason, 'INVALIDATION_NOT_RAISED')

  // The trigger itself was rejected by the Host.
  const triggerFailed = judgeRow5({ ...PASS.row5, lateTrigger: { status: 500, body: { ok: false } } })
  assert.equal(triggerFailed.verdict, 'REFUTED')
  assert.equal(triggerFailed.reason, 'INVALIDATION_TRIGGER_FAILED')

  // ROW 6. No archive dispatch is an absence; a REFUSED archive is the product
  // answering, so it is REFUTED.
  assert.equal(judgeRow6({ member: null }).reason, 'NO_MEMBER_TO_STOP')
  const refused = judgeRow6({ ...PASS.row6, archive: { status: 200, body: { ok: false, error: { code: 'TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS' } } } })
  assert.equal(refused.verdict, 'REFUTED')
  assert.equal(refused.reason, 'ARCHIVE_REFUSED')
  assert.equal(judgeRow6({ ...PASS.row6, archive: { status: 500, body: {} } }).reason, 'ARCHIVE_REFUSED')
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

test('C9 row 2 replay: the HEALTHY stream (read-B deny + later write-B allow at the same locator) is PASS', () => {
  // The exact stream the live world produces: the worker reads B (binding deny,
  // readText) and row 4 later writes B (ceiling allow, write). B1: the raw
  // `facts.length === 1` counted both and REFUTED a healthy run.
  const healthy = {
    ...PASS.row2,
    facts: [
      { realm: 'binding', toolBindingIdentity: 'dsh.fs/read', method: 'readText', decision: 'deny', locator: '/w/b.txt' },
      { realm: 'member', toolBindingIdentity: null, method: 'write', decision: 'allow', locator: '/w/b.txt' },
    ],
  }
  const judged = judgeRow2(healthy)
  assert.equal(judged.verdict, 'PROVEN', JSON.stringify(judged))
  assert.equal(judged.detail.readFacts, 1)
  assert.equal(judged.detail.nonReadFacts, 1, 'the write fact is visible, not counted')
  // and no read fact at all still refutes (the sink channel is part of the claim)
  assert.equal(judgeRow2({ ...healthy, facts: [] }).verdict, 'REFUTED')
})

test('C10 row 5 laundering arms: erased invalidation / failed trigger / unregistered tool are REFUTED, never NOT_REACHED', () => {
  const base = PASS.row5
  const cases = [
    ['INVALIDATION_NOT_RAISED', { ...base, invalidationLine: '' }],
    ['INVALIDATION_TRIGGER_FAILED', { ...base, lateTrigger: { status: 502, body: { ok: false } } }],
    ['INVALIDATION_TRIGGER_FAILED', { ...base, lateTrigger: { status: 200, ok: false, body: { ok: false } } }],
    ['INVALIDATION_TOOL_NOT_REGISTERED', { ...base, lateReport: { registered: false } }],
  ]
  for (const [reason, sample] of cases) {
    const judged = judgeRow5(sample)
    assert.equal(judged.verdict, 'REFUTED', `${reason}: ${JSON.stringify(judged)}`)
    assert.equal(judged.reason, reason)
    assert.notEqual(judged.verdict, 'NOT_REACHED')
  }
})

test('C11 row 6 archive-refusal arm: a 200-with-ok:false envelope refusal is REFUTED', () => {
  const judged = judgeRow6({
    ...PASS.row6,
    archive: { status: 200, body: { ok: false, error: { info: { code: 'TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS' }, message: 'refused' } } },
  })
  assert.equal(judged.verdict, 'REFUTED')
  assert.equal(judged.reason, 'ARCHIVE_REFUSED')
  assert.equal(judged.detail.archive.status, 200)
  assert.equal(judged.detail.archive.ok, false)
})

test('C12 row 5 distinguishes the NAME-KEYED invalidation from the blanket realm freeze', () => {
  // The E8 realm-wide freeze (#580) answers `A5SF_MEMBER_REALM_INVALIDATED` for
  // names outside the invalidation set. Row 5's covered name must still get the
  // name-keyed code; blanket-only is a REFUTED with its own reason, because it
  // means "the realm died", not "the right shadow was condemned".
  assert.equal(REALM_INVALIDATED_CODE, 'A5SF_MEMBER_REALM_INVALIDATED')
  const blanket = judgeRow5({
    ...PASS.row5,
    postRead: {
      status: 200,
      body: { ok: false, error: { info: { code: REALM_INVALIDATED_CODE, name: 'A5sfMemberRealmInvalidatedError' }, message: 'realm invalidated' } },
    },
  })
  assert.equal(blanket.verdict, 'REFUTED')
  assert.equal(blanket.reason, 'BLANKET_INVALIDATION_ONLY')
  assert.equal(blanket.detail.expectedCode, 'A5SF_NATIVE_SHADOW_INVALIDATED')
  assert.equal(blanket.detail.observedCode, REALM_INVALIDATED_CODE)
  assert.equal(blanket.detail.checks.typedCode, false)
  assert.equal(blanket.detail.checks.notBlanketFreeze, false)

  // the covered-name PASS still carries the name-keyed code on both reads
  const proven = judgeRow5(PASS.row5)
  assert.equal(proven.verdict, 'PROVEN')
  assert.equal(proven.detail.checks.typedCode, true)
  assert.equal(proven.detail.checks.notBlanketFreeze, true)

  // a blanket code ONLY on the in-lane read is still a failed clause
  const inLaneBlanket = judgeRow5({
    ...PASS.row5,
    inLaneRead: {
      status: 200,
      body: { ok: false, error: { info: { code: REALM_INVALIDATED_CODE, name: 'A5sfMemberRealmInvalidatedError' }, message: 'realm invalidated' } },
    },
  })
  assert.equal(inLaneBlanket.verdict, 'REFUTED')
  assert.equal(inLaneBlanket.detail.check, undefined)
  assert.equal(inLaneBlanket.detail.checks.inLaneAlsoRefused, false)
  assert.equal(inLaneBlanket.detail.inLaneCode, REALM_INVALIDATED_CODE)

  // an unrelated wrong code is neither the right shadow nor the blanket freeze
  const other = judgeRow5({
    ...PASS.row5,
    postRead: { status: 200, body: { ok: false, error: { info: { code: 'A5SF_SOMETHING_ELSE' }, message: 'no' } } },
  })
  assert.equal(other.verdict, 'REFUTED')
  assert.equal(other.reason, 'ROW5_CLAUSE_FAILED')
  assert.equal(other.detail.observedCode, 'A5SF_SOMETHING_ELSE')
})
