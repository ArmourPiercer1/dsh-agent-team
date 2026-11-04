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
  ACCEPTANCE_CASE_IDS,
  AcceptanceRootMismatch,
  IO_WRITE_REQUIRES_READ,
  P2_01_ACCEPTANCE_ROOTS,
  WRITE_PATH_METHODS,
  acceptanceRootIdentity,
  assertAcceptanceRootWiring,
  classifyDisposeFaults,
  classifyObservation,
  isReadPathConsultation,
  isWritePathConsultation,
  judgeAcceptanceRow,
  judgePrecondition,
  judgeRow1,
  judgeRow2,
  judgeRow3,
  judgeRow4a,
  judgeRow4b,
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
  // precondition + SEVEN rows: row 4 was split into 4a (allowed) and 4b (refused).
  assert.equal(ACCEPTANCE_CASES.length, 8)
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
const WRITE_4A = 'A5SF_ACC_WRITE_4A_world\n'
const ORIG_4A = 'A5SF_ACC_WRITE4A_ORIG_world\n'

/**
 * THE REAL LIVE STREAM (session 2026-11-04T07:28Z, the first six-row run):
 * `dev/agent-workflow/evidence/a5sf-preflight/consultations.jsonl`, copied
 * verbatim by the driver from the World sink. It is the fixture the previous
 * round should have used: the synthetic C9 stream contained a `readText` deny,
 * which the product never emits (the `read` tool STATS first and the denied
 * target never reaches `readText`), so the oracle was pinned against a stream
 * the World cannot produce.
 */
const LIVE_CONSULTATIONS = readFileSync(
  new URL('../../dev/agent-workflow/evidence/a5sf-preflight/consultations.jsonl', import.meta.url),
  'utf8',
).split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line))
const LIVE_B_LOCATOR = LIVE_CONSULTATIONS.find((fact) => String(fact.locator).endsWith('/axis/b.txt'))?.locator ?? ''
const LIVE_A_LOCATOR = LIVE_CONSULTATIONS.find((fact) => String(fact.locator).endsWith('/axis/allow/a.txt'))?.locator ?? ''
const liveFactsAt = (locator) => LIVE_CONSULTATIONS.filter((fact) => fact.locator === locator)
/** The archive instant of that run (`run.log` @ 1465d3ef7: `07:28:28.916Z`). */
const LIVE_STOP_INSTANT = '2026-11-04T07:28:28.916Z'
/**
 * The live row-4 refusal, VERBATIM from `run-record.json` of that run: the Host
 * file sandbox denied the write because the deployment root (`process.cwd()` of
 * the `dsh web` process) did not cover the World home. It is NOT the product's
 * write⇒read refusal, and row 4b must refuse to credit it.
 */
const LIVE_ROW4_SANDBOX_DENIAL = 'Error: [sandbox: file access denied under workspace-write mode]\n'
  + '[sandbox: escalation available — retry this exact operation once with sandbox permissions '
  + '(the narrowest wider mode that suffices) + justification; the approval prompt asks the user]'

const readCall = (path) => ({ callId: `call-${path}`, name: 'read', args: { file_path: path } })
const writeCall = (path) => ({ callId: `call-${path}-write`, name: 'write', args: { file_path: path } })
const result = (text, isError = false) => ({ isError, text })
const writeFact = (realm, decision, method = 'writeText') => ({ realm, toolBindingIdentity: realm === 'binding' ? 'dsh.fs/read' : null, method, decision })
const readFact = (method, decision) => ({ realm: 'binding', toolBindingIdentity: 'dsh.fs/read', method, decision })

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
    // THE LIVE SHAPE: the `read` tool stats B, the binding lane denies the stat,
    // and `readText` is never reached. Plus the row-4 ceiling write fact at the
    // same locator, which must stay visible and uncounted.
    facts: [
      readFact('stat', 'deny'),
      writeFact('member', 'allow'),
    ],
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
  row4a: {
    call: writeCall('/w/axis/allow/w4a.txt'),
    result: result('wrote 22 bytes'),
    expectedContent: WRITE_4A,
    disk: WRITE_4A,
    facts: [writeFact('member', 'allow')],
    counterRows: [{ leg: 'write-call', isBase: false, instance: 'fs-2' }],
  },
  row4b: {
    call: writeCall('/w/b.txt'),
    result: result("Error: native writeText must read '/w/b.txt' before rewriting it, but the Member read axis does not cover it; write does not imply read", true),
    plantedContent: `${CLAIM_B}\n`,
    disk: `${CLAIM_B}\n`,
    // The ceiling admit is expected here (measured live): the refusal comes from
    // the write tool's read coupling, AFTER the ceiling lane allowed the write.
    facts: [writeFact('member', 'allow')],
    counterRows: [],
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
    facts: LIVE_CONSULTATIONS,
    stopInstant: LIVE_STOP_INSTANT,
    // The old rule's input: TWO facts sit inside the window, both from BEFORE
    // the archive. It is reported, never checked.
    sinkDelta: 2,
    healthStatus: 200,
    hostAlive: true,
  },
}

/** The `PASS` key for every case id (row4a/row4b are not `row<digit>`). */
const PASS_KEY = {
  [ACCEPTANCE_CASE_IDS.precondition]: 'precondition',
  [ACCEPTANCE_CASE_IDS.row1]: 'row1',
  [ACCEPTANCE_CASE_IDS.row2]: 'row2',
  [ACCEPTANCE_CASE_IDS.row3]: 'row3',
  [ACCEPTANCE_CASE_IDS.row4a]: 'row4a',
  [ACCEPTANCE_CASE_IDS.row4b]: 'row4b',
  [ACCEPTANCE_CASE_IDS.row5]: 'row5',
  [ACCEPTANCE_CASE_IDS.row6]: 'row6',
}

/** The three samples each case MUST distinguish. */
const NOT_REACHED_SAMPLES = {
  [ACCEPTANCE_CASE_IDS.precondition]: { hostAlive: true, memberRequest: null, discovery: null, readCalls: 0 },
  [ACCEPTANCE_CASE_IDS.row1]: { call: null, result: null, claim: CLAIM_A },
  [ACCEPTANCE_CASE_IDS.row2]: { call: readCall('/w/b.txt'), result: null, claim: CLAIM_B },
  [ACCEPTANCE_CASE_IDS.row3]: { call: null, result: null, claim: CLAIM_C },
  [ACCEPTANCE_CASE_IDS.row4a]: { call: null, result: null, expectedContent: WRITE_4A },
  [ACCEPTANCE_CASE_IDS.row4b]: { call: null, result: null, plantedContent: `${CLAIM_B}\n` },
  [ACCEPTANCE_CASE_IDS.row5]: { member: null, forbiddenClaim: CLAIM_B },
  [ACCEPTANCE_CASE_IDS.row6]: { member: null, archive: null, forbiddenClaim: CLAIM_B },
}

const REFUTED_SAMPLES = {
  [ACCEPTANCE_CASE_IDS.precondition]: {
    ...PASS.precondition,
    memberRequest: { ...PASS.precondition.memberRequest, readSchemas: 2 },
  },
  [ACCEPTANCE_CASE_IDS.row1]: { ...PASS.row1, result: result('permission denied', true) },
  // A read-path ALLOW at B contradicts the row (the decision, not the count).
  [ACCEPTANCE_CASE_IDS.row2]: {
    ...PASS.row2,
    facts: [{ ...readFact('stat', 'allow') }, writeFact('member', 'allow')],
  },
  [ACCEPTANCE_CASE_IDS.row3]: {
    ...PASS.row3,
    probeC: { ...PASS.row3.probeC, effectiveRead: 'allow' },
  },
  // The write CROSSED channels: a write allow appeared on the read lane.
  [ACCEPTANCE_CASE_IDS.row4a]: {
    ...PASS.row4a,
    facts: [writeFact('member', 'allow'), writeFact('binding', 'allow')],
  },
  // Asked and answered, but not by the read coupling: the live sandbox denial.
  [ACCEPTANCE_CASE_IDS.row4b]: {
    ...PASS.row4b,
    result: result(LIVE_ROW4_SANDBOX_DENIAL, true),
  },
  [ACCEPTANCE_CASE_IDS.row5]: {
    ...PASS.row5,
    postRead: { status: 200, body: { ok: true, value: { text: CLAIM_B } } },
  },
  [ACCEPTANCE_CASE_IDS.row6]: {
    ...PASS.row6,
    facts: [...LIVE_CONSULTATIONS, { ...LIVE_CONSULTATIONS[0], observedAt: '2026-11-04T07:28:29.500Z', locator: '/w/late-fact.txt' }],
  },
}

test('C0 every case has all three samples and every NOT_REACHED sample answers NOT_REACHED', () => {
  assert.equal(ACCEPTANCE_CASES.length, 8, 'precondition + SEVEN rows (4a and 4b are separate cases)')
  for (const caseId of ACCEPTANCE_CASES) assert.equal(PASS_KEY[caseId] !== undefined, true, `${caseId} has no PASS key`)
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
    const passSample = PASS[PASS_KEY[caseId]]
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
  const noSink = judgeRow2({ ...PASS.row2, facts: [] })
  assert.equal(noSink.verdict, 'REFUTED', 'a refused read that recorded NO read-path fact is not evidence')
  assert.equal(noSink.detail.checks.readPathConsulted, false)
  // A deny recorded by the WRONG realm cannot be credited to the binding lane.
  const wrongLane = judgeRow2({ ...PASS.row2, facts: [writeFact('member', 'deny')] })
  assert.equal(wrongLane.verdict, 'REFUTED')
  assert.equal(wrongLane.detail.checks.everyReadPathFactOnBindingLane, false)
  assert.equal(wrongLane.detail.checks.bindingDenyOnReadPath, false)
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
    const judged = judgeAcceptanceRow(caseId, PASS[PASS_KEY[caseId]])
    assert.match(judged.reason, /^[A-Z0-9_]+$/)
    assert.equal(judged.detail.reason, judged.reason)
  }
})

test('C9 row 2 replay over the REAL live stream: stat-deny + the later writeText allow at B is PROVEN', () => {
  // The fixture is `consultations.jsonl` from the 2026-11-04T07:28Z run, not a
  // synthetic stream: the old clause counted `method === 'readText'` facts and
  // this stream has NONE (the denied target is refused at `stat`), which is how
  // the live row 2 was reported FAIL while the product had refused correctly.
  assert.equal(LIVE_CONSULTATIONS.length, 5, 'the live sink carried five facts')
  const factsForB = liveFactsAt(LIVE_B_LOCATOR)
  assert.equal(factsForB.length, 2, 'B carries the stat deny AND the row-4 writeText allow')
  const judged = judgeRow2({ ...PASS.row2, facts: factsForB })
  assert.equal(judged.verdict, 'PROVEN', JSON.stringify(judged))
  assert.equal(judged.reason, 'BINDING_DENY_ON_READ_PATH')
  assert.equal(judged.detail.readPathFacts, 1)
  assert.deepEqual(judged.detail.readPathMethods, ['stat'], 'the live read-path consultation IS the stat')
  assert.equal(judged.detail.nonReadPathFacts.length, 1, 'the writeText allow is visible, not counted')
  assert.equal(judged.detail.nonReadPathFacts[0].method, 'writeText')
  // The SAME stream with the live `readText` filter (the replaced rule) counts
  // zero read facts and would refute a correct refusal — the defect, in one line.
  assert.equal(factsForB.filter((fact) => fact.method === 'readText').length, 0)
  // and a stream with no read-path fact at all still refutes (the channel is part of the claim)
  assert.equal(judgeRow2({ ...PASS.row2, facts: [] }).verdict, 'REFUTED')
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

// ─────────────────────────────────────────────────────────────────────────────
// D. the corrections after the FIRST LIVE RUN (2026-11-04T07:28Z)
// ─────────────────────────────────────────────────────────────────────────────

test('C13 row 2 rule for TWO read-path consultations: two denies PROVE, two allows REFUTE, the COUNT is never the failure', () => {
  // THE RULE: the row asserts a DECISION on every read-path consultation for B,
  // not a cardinality. A healthy `read` on an ALLOWED target is stat+readText
  // (two allows, the live A stream); a refused target may be consulted once
  // (stat only, the live B stream) or twice (stat + readText, both denied). None
  // of those shapes is a failure BY ITSELF; only an ALLOW for B is.
  const twoDenies = judgeRow2({
    ...PASS.row2,
    facts: [readFact('stat', 'deny'), readFact('readText', 'deny')],
  })
  assert.equal(twoDenies.verdict, 'PROVEN', JSON.stringify(twoDenies))
  assert.deepEqual(twoDenies.detail.readPathMethods, ['stat', 'readText'])
  assert.deepEqual(twoDenies.detail.failed, [], 'two consultations, both refused: no clause fails')

  // The live A-locator shape (stat allow + readText allow) applied to B: the row
  // is REFUTED because the product SERVED the target — the two-lane allow is the
  // contradiction, never the two facts.
  const twoAllows = judgeRow2({ ...PASS.row2, facts: liveFactsAt(LIVE_A_LOCATOR) })
  assert.equal(twoAllows.verdict, 'REFUTED')
  assert.deepEqual(twoAllows.detail.failed.sort(), ['bindingDenyOnReadPath', 'everyReadPathConsultationDenied'])
  for (const clause of twoAllows.detail.failed) {
    assert.equal(/count|exactly|length/i.test(clause), false, `the failure must be a decision clause, got ${clause}`)
  }
  assert.equal(twoAllows.detail.readPathFacts, 2, 'both consultations are counted and reported, not hidden')

  // A write fact at the same locator neither counts nor rescues the row.
  const writeOnly = judgeRow2({ ...PASS.row2, facts: [writeFact('member', 'allow')] })
  assert.equal(writeOnly.verdict, 'REFUTED')
  assert.equal(writeOnly.detail.readPathFacts, 0)
})

test('C14 rows 4a/4b: the split is two questions, and neither loosens the other', () => {
  // 4a: in-lane readable write, ceiling-only fact, disk matches.
  const fourA = judgeRow4a(PASS.row4a)
  assert.equal(fourA.verdict, 'PROVEN', JSON.stringify(fourA))
  assert.equal(fourA.detail.checks.everyWriteFactOnCeiling, true)
  assert.equal(fourA.detail.readLaneWriteFacts, 0, 'the channel fact is reported: no write fact on the read lane')
  // 4a REFUTES if the write fact crosses into the read lane...
  const crossed = judgeRow4a(REFUTED_SAMPLES[ACCEPTANCE_CASE_IDS.row4a])
  assert.equal(crossed.verdict, 'REFUTED')
  assert.deepEqual(crossed.detail.failed, ['everyWriteFactOnCeiling'], 'the crossing is the ONE failed clause')
  assert.equal(crossed.detail.readLaneWriteFacts, 1)
  // ...or if the disk does not carry the new content...
  assert.equal(judgeRow4a({ ...PASS.row4a, disk: ORIG_4A }).verdict, 'REFUTED')
  // ...or if no confined provider served the call (the base instance would be unguarded).
  assert.equal(judgeRow4a({ ...PASS.row4a, counterRows: [{ leg: 'write-call', isBase: true }] }).verdict, 'REFUTED')
  // ...or if the CONFINED write the product refused is credited as an allow:
  assert.equal(judgeRow4a({ ...PASS.row4a, result: result('permission denied', true) }).verdict, 'REFUTED')

  // 4b: the SAME property (no channel crossing) asserted on the refusal.
  const fourB = judgeRow4b(PASS.row4b)
  assert.equal(fourB.verdict, 'PROVEN', JSON.stringify(fourB))
  assert.equal(fourB.detail.checks.typedReadCouplingRefusal, true)
  assert.equal(fourB.detail.checks.ceilingFactReported, undefined, 'no invented clause')
  assert.equal(fourB.detail.writeDecisions.length, 1, 'the ceiling allow is REPORTED (measured live), not a violation')
  assert.equal(fourB.detail.writeDecisions[0].realm, 'member')
  // the LIVE row-4 refusal (host sandbox, not the read coupling) must NOT be
  // credited to 4b — that is exactly the wrong-question failure being repaired.
  const sandbox = judgeRow4b(REFUTED_SAMPLES[ACCEPTANCE_CASE_IDS.row4b])
  assert.equal(sandbox.verdict, 'REFUTED')
  assert.equal(sandbox.detail.checks.typedReadCouplingRefusal, false)
  assert.equal(sandbox.detail.checks.isError, true, 'it IS an error — just not the one the row asks for')
  // a write that CHANGED the file is REFUTED even with the right prose
  assert.equal(judgeRow4b({ ...PASS.row4b, disk: WRITE_B }).verdict, 'REFUTED')
  // an unplanted target is an ABSENCE (the "unchanged" claim has no baseline)
  assert.equal(judgeRow4b({ ...PASS.row4b, plantedContent: '' }).reason, 'NO_PLANTED_B')
  // a laundered allow on the read lane is REFUTED
  assert.equal(judgeRow4b({ ...PASS.row4b, facts: [writeFact('member', 'allow'), writeFact('binding', 'allow')] }).verdict, 'REFUTED')

  // the split is COMPLETE: no case id or judge from the retired single row survives
  assert.equal(judgeRow4a({}).verdict, 'NOT_REACHED')
  assert.equal(judgeRow4b({}).verdict, 'NOT_REACHED')
  assert.equal(Object.values(ACCEPTANCE_CASE_IDS).some((id) => /row4-write-b/.test(id)), false)
})

test('C15 row 6 temporal bound: PROVEN over the REAL live stream, REFUTED by one later observedAt', () => {
  // The live stream's newest fact is 07:28:27.080Z; the archive was answered at
  // 07:28:28.916Z. NOTHING follows the stop — and the old `sinkDelta === 0`
  // clause reported FAIL on this same stream because two facts from rows 1–2
  // landed inside its "after" window.
  const live = judgeRow6(PASS.row6)
  assert.equal(live.verdict, 'PROVEN', JSON.stringify(live))
  assert.equal(live.detail.checks.noFactAfterStop, true)
  assert.equal(live.detail.factsObserved, 5)
  assert.deepEqual(live.detail.factsAfterStop, [])
  assert.equal(live.detail.stopInstant, LIVE_STOP_INSTANT)
  const newest = Math.max(...LIVE_CONSULTATIONS.map((fact) => Date.parse(fact.observedAt)))
  assert.equal(newest < Date.parse(LIVE_STOP_INSTANT), true, 'every live fact precedes the stop')
  // The replaced rule, evaluated inline: the live run recorded sinkDelta = 2 for
  // this window (both facts from before the archive), so a count-based clause
  // necessarily refuted a clean stream. `PASS.row6.sinkDelta` carries that 2.
  assert.equal(PASS.row6.sinkDelta, 2, 'the old window input, as measured live')
  // The count input is CARRIED but not checked: the same sample with the old
  // sinkDelta (2) still PROVES, which is what makes the fix load-bearing.
  assert.equal(judgeRow6({ ...PASS.row6, sinkDelta: 2 }).verdict, 'PROVEN')
  assert.equal(judgeRow6({ ...PASS.row6, sinkDelta: 0 }).verdict, 'PROVEN')

  // Injected one fact with a LATER observedAt → REFUTED, and the fact is named.
  const injected = judgeRow6({
    ...PASS.row6,
    facts: [...LIVE_CONSULTATIONS, {
      ...LIVE_CONSULTATIONS[0],
      method: 'writeText',
      locator: '/w/after-stop.txt',
      observedAt: '2026-11-04T07:28:29.500Z',
    }],
  })
  assert.equal(injected.verdict, 'REFUTED')
  assert.equal(injected.reason, 'ROW6_CLAUSE_FAILED')
  assert.deepEqual(injected.detail.failed, ['noFactAfterStop'])
  assert.equal(injected.detail.factsAfterStop.length, 1)
  assert.equal(injected.detail.factsAfterStop[0].observedAt, '2026-11-04T07:28:29.500Z')
  assert.equal(injected.detail.factsAfterStop[0].locator, '/w/after-stop.txt')

  // A fact AT the stop instant is not "after" it (boundary is strict).
  assert.equal(judgeRow6({ ...PASS.row6, facts: [...LIVE_CONSULTATIONS, { ...LIVE_CONSULTATIONS[0], observedAt: LIVE_STOP_INSTANT }] }).verdict, 'PROVEN')
  // A fact with NO parseable observedAt cannot be proven to precede the stop.
  const undated = judgeRow6({ ...PASS.row6, facts: [...LIVE_CONSULTATIONS, { ...LIVE_CONSULTATIONS[0], observedAt: null }] })
  assert.equal(undated.verdict, 'REFUTED')
  assert.deepEqual(undated.detail.failed, ['factsAreTimestamped'])
  // No stop instant = the row is unanswerable (the driver must record it).
  const noStop = judgeRow6({ ...PASS.row6, stopInstant: null })
  assert.equal(noStop.verdict, 'NOT_REACHED')
  assert.equal(noStop.reason, 'NO_STOP_INSTANT')
  // The other three clauses are unchanged and still fire.
  assert.equal(judgeRow6({ ...PASS.row6, postStopDispatches: [{ status: 200, body: { ok: true, value: { text: CLAIM_B } } }] }).detail.checks.noSuccessAfterStop, false)
  assert.equal(judgeRow6({ ...PASS.row6, postStopDispatches: [{ status: 200, body: { ok: true, value: { text: CLAIM_B } } }] }).detail.checks.noForbiddenBytesAfterStop, false)
  assert.equal(judgeRow6({ ...PASS.row6, healthStatus: 500 }).detail.checks.hostHealthy, false)
})

test('C16 the read/write method partition is the PRODUCT’s, and an unknown method is counted as a read-path consultation', () => {
  // `dry-run.mjs` binds WRITE_PATH_METHODS to fs.ts; here the ORACLE behaviour
  // is pinned: a method nobody has seen before is NOT ignored (fail-closed).
  assert.deepEqual([...WRITE_PATH_METHODS], ['writeText', 'editText'])
  assert.equal(isWritePathConsultation({ method: 'writeText' }), true)
  assert.equal(isWritePathConsultation({ method: 'editText' }), true)
  assert.equal(isReadPathConsultation({ method: 'stat' }), true)
  assert.equal(isReadPathConsultation({ method: 'readText' }), true)
  assert.equal(isReadPathConsultation({ method: 'aMethodThatDidNotExistYet' }), true)
  assert.equal(isReadPathConsultation({ method: undefined }), true)
  const future = judgeRow2({ ...PASS.row2, facts: [readFact('aMethodThatDidNotExistYet', 'allow')] })
  assert.equal(future.verdict, 'REFUTED', 'a future read method that is ALLOWED must refute, not slip past a name filter')
  assert.equal(IO_WRITE_REQUIRES_READ, 'IO_WRITE_REQUIRES_READ')
})
