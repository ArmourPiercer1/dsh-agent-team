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
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

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
  PREFLIGHT_CHECK_IDS,
  runZeroBootPreflight,
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
 * THE BOOT-2 LIVE STREAM (2026-11-04T08:19Z), FROZEN — `fixtures/
 * a5sf-boot2-row6-sample.json`. The file is extracted verbatim from the
 * committed `oracle-samples.json` row-6 sample (the 10 facts the driver actually
 * judged) and split at the `run-record.json` stop instant:
 *
 *   - `factsAtStop` (8) — byte-identical to the committed `consultations.jsonl`
 *     (the stop-time sink). Rows 1–4a's facts are in here.
 *   - `probeFacts` (2) — the `stat`/deny/binding facts the row's OWN post-stop
 *     probes (`postArchiveRead` + `postDropRead` of b.txt) appended. Boot 2 fed
 *     them to the temporal bound as if the product had emitted them; that is
 *     the defect-A repair (README §12.8.1).
 *
 * WHY A FROZEN FIXTURE AND NOT `consultations.jsonl`: the evidence file is
 * rewritten by every live run, so pinning tests to it made the suite red as soon
 * as boot 2 landed (C1/C5/C9/C15 failed on 2026-11-04). The regression stream
 * must not move under the suite. The fixture's provenance names the evidence it
 * was extracted from.
 */
const BOOT2 = JSON.parse(readFileSync(new URL('./fixtures/a5sf-boot2-row6-sample.json', import.meta.url), 'utf8'))
const LIVE_CONSULTATIONS = BOOT2.factsAtStop
const LIVE_PROBE_FACTS = BOOT2.probeFacts
const LIVE_STOP_INSTANT = BOOT2.stopInstant
const LIVE_B_LOCATOR = LIVE_CONSULTATIONS.find((fact) => String(fact.locator).endsWith('/axis/b.txt'))?.locator ?? ''
const LIVE_A_LOCATOR = LIVE_CONSULTATIONS.find((fact) => String(fact.locator).endsWith('/axis/allow/a.txt'))?.locator ?? ''
const liveFactsAt = (locator) => LIVE_CONSULTATIONS.filter((fact) => fact.locator === locator)
/**
 * The live row-4 refusal, VERBATIM from `run-record.json` of the FIRST run: the
 * Host file sandbox denied the write because the deployment root
 * (`process.cwd()` of the `dsh web` process) did not cover the World home. It is
 * not the Team lanes and not the read coupling; row 4b must not credit it as
 * either.
 */
const LIVE_ROW4_SANDBOX_DENIAL = 'Error: [sandbox: file access denied under workspace-write mode]\n'
  + '[sandbox: escalation available — retry this exact operation once with sandbox permissions '
  + '(the narrowest wider mode that suffices) + justification; the approval prompt asks the user]'
/**
 * The boot-2 row-4b outcome, VERBATIM from `run-record.json`: the guard ALLOWED
 * the write on the ceiling realm and the write reached the confined provider;
 * the refusal is the Host's read-before-write policy. It is NOT a lane refusal
 * and NOT the Team write⇒read coupling.
 */
const LIVE_ROW4B_HOST_POLICY_REFUSAL = 'Error: cannot modify "<world>/workspace/axis/b.txt": file has not been read — read the file, then retry'
/** The Team read-coupling refusal the FIRST row 4b demanded (a different answer). */
const TEAM_READ_COUPLING_REFUSAL = "Error: native writeText must read '/w/b.txt' before rewriting it, but the Member read axis does not cover it; write does not imply read"

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
    // THE BOOT-2 LIVE ANSWER, verbatim in shape: the guard admitted the write on
    // the CEILING realm, the confined provider received it, and the HOST's own
    // read-before-write policy refused it downstream.
    result: result(LIVE_ROW4B_HOST_POLICY_REFUSAL, true),
    plantedContent: `${CLAIM_B}\n`,
    disk: `${CLAIM_B}\n`,
    // The ceiling ALLOW is the row's first clause (the binding lane's read
    // restriction is not a write restriction); the read lane must not gain one.
    facts: [writeFact('member', 'allow')],
    // REPORTED, not checked: the live counter recorded the write reaching the
    // confined provider (writeText, instance fs-4) before the Host policy refused.
    counterRows: [{ leg: 'write-call', isBase: false, instance: 'fs-4' }],
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
    // The stop-time sink (8 facts, the ones actually judged against the bound)...
    facts: LIVE_CONSULTATIONS,
    // ...and the 2 facts the row's own post-stop probes appended (must be denials).
    probeFacts: LIVE_PROBE_FACTS,
    stopInstant: LIVE_STOP_INSTANT,
    // The old rule's input: the count grew by the 2 probe facts INSIDE the
    // window. It is reported, never checked.
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
  // Asked and answered by the TEAM read coupling — the answer the boot-2 row
  // must NOT be credited for: it means the guard refused the write on the read
  // axis, i.e. the ceiling did NOT admit it.
  [ACCEPTANCE_CASE_IDS.row4b]: {
    ...PASS.row4b,
    result: result(TEAM_READ_COUPLING_REFUSAL, true),
  },
  [ACCEPTANCE_CASE_IDS.row5]: {
    ...PASS.row5,
    postRead: { status: 200, body: { ok: true, value: { text: CLAIM_B } } },
  },
  [ACCEPTANCE_CASE_IDS.row6]: {
    ...PASS.row6,
    // ONE fact 1 s after the stop, in the STOP-TIME set: the temporal bound must
    // refute it.
    facts: [...LIVE_CONSULTATIONS, { ...LIVE_CONSULTATIONS[0], observedAt: new Date(Date.parse(LIVE_STOP_INSTANT) + 1000).toISOString(), locator: '/w/late-fact.txt' }],
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
  // The fixture is the boot-2 stop-time sink (8 facts, extracted verbatim from
  // the committed `consultations.jsonl` / oracle sample), not a synthetic stream:
  // the old clause counted `method === 'readText'` facts and this stream has
  // NONE (the denied target is refused at `stat`), which is how the live row 2
  // was reported FAIL while the product had refused correctly.
  assert.equal(LIVE_CONSULTATIONS.length, 8, 'the boot-2 stop-time sink carried eight facts')
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

  // 4b: the CEILING admits a write the binding lane cannot read, and the bytes do
  // not land. Two claims, two clauses — neither is a claim about the Team lanes.
  const fourB = judgeRow4b(PASS.row4b)
  assert.equal(fourB.verdict, 'PROVEN', JSON.stringify(fourB))
  assert.equal(fourB.reason, 'CEILING_WRITE_ALLOWED_READ_NOT_IMPLIED')
  assert.equal(fourB.detail.checks.ceilingWriteAllowed, true, 'the guard ALLOWED the write (ceiling realm)')
  assert.equal(fourB.detail.checks.noReadLaneWriteAllow, true)
  assert.equal(fourB.detail.writeDecisions.length, 1, 'the ceiling allow is the row FIRST clause, not a violation')
  assert.equal(fourB.detail.writeDecisions[0].realm, 'member')
  assert.equal(fourB.detail.providerWrote, true, 'the write reached the confined provider — REPORTED, not checked')
  // The TEAM read coupling is a DIFFERENT answer: the guard refused on the read
  // axis, i.e. the ceiling did NOT admit the write. This is what the retired row
  // demanded and what boot 2 refuted.
  const coupled = judgeRow4b(REFUTED_SAMPLES[ACCEPTANCE_CASE_IDS.row4b])
  assert.equal(coupled.verdict, 'REFUTED')
  assert.equal(coupled.detail.checks.ceilingWriteAllowed, true, 'the ceiling fact was there...')
  assert.equal(coupled.detail.checks.noReadLaneWriteAllow, true, '...and no write crossed to the read lane...')
  assert.equal(coupled.detail.checks.notReadCouplingRefusal, false, '...but the answer is the other contract, so it is not this row')
  // A Team LANE refusal is not the answer either: it means the guard denied it.
  const laneRefused = judgeRow4b({ ...PASS.row4b, result: result('read refused: path is outside every allow subtree of the lane', true) })
  assert.equal(laneRefused.verdict, 'REFUTED')
  assert.equal(laneRefused.detail.checks.notTeamLaneRefusal, false)
  // nor is an A5SF_* typed admission refusal
  const typed = judgeRow4b({ ...PASS.row4b, result: result('a5sf: A5SF_NATIVE_SHADOW_INVALIDATED refused', true) })
  assert.equal(typed.verdict, 'REFUTED')
  assert.equal(typed.detail.checks.notTeamLaneRefusal, false)
  // no ceiling allow fact = the guard did not allow the write = clause 1 fails
  const noCeiling = judgeRow4b({ ...PASS.row4b, facts: [] })
  assert.equal(noCeiling.verdict, 'REFUTED')
  assert.equal(noCeiling.detail.checks.ceilingWriteAllowed, false)
  // the OLD first-run refusal (Host sandbox before the pin) is also not the answer
  assert.equal(judgeRow4b({ ...PASS.row4b, result: result(LIVE_ROW4_SANDBOX_DENIAL, true) }).verdict, 'PROVEN',
    'a host-side error that is neither a lane nor a read-coupling refusal is exactly the observed shape')
  // a write that CHANGED the file is REFUTED even with a non-lane error
  assert.equal(judgeRow4b({ ...PASS.row4b, disk: WRITE_B }).verdict, 'REFUTED')
  // returned planted bytes are a leak
  assert.equal(judgeRow4b({ ...PASS.row4b, result: result(`${CLAIM_B}\n then: cannot modify`, true) }).verdict, 'REFUTED')
  // an unplanted target is an ABSENCE (the "unchanged" claim has no baseline)
  assert.equal(judgeRow4b({ ...PASS.row4b, plantedContent: '' }).reason, 'NO_PLANTED_B')
  // a laundered allow on the read lane is REFUTED
  assert.equal(judgeRow4b({ ...PASS.row4b, facts: [writeFact('member', 'allow'), writeFact('binding', 'allow')] }).verdict, 'REFUTED')

  // the split is COMPLETE: no case id or judge from the retired single row survives
  assert.equal(judgeRow4a({}).verdict, 'NOT_REACHED')
  assert.equal(judgeRow4b({}).verdict, 'NOT_REACHED')
  assert.equal(Object.values(ACCEPTANCE_CASE_IDS).some((id) => /row4-write-b/.test(id)), false)
})

test('C15 row 6 temporal bound over the REAL boot-2 stream: stop-time facts, probe delta, refuting twin', () => {
  // THE LIVE STREAM. Boot 2 judged 10 facts: 8 at or before the stop instant
  // (08:19:27.285Z; newest 08:19:25.470Z) and 2 AFTER it (08:19:27.332Z and
  // .385Z) — both `stat`/deny/binding at b.txt, appended by the row's own
  // post-stop probes (`postArchiveRead`, `postDropRead`). The frozen fixture is
  // that stream, split the way the repaired driver now splits it.
  assert.equal(LIVE_CONSULTATIONS.length, 8, 'the stop-time sink')
  assert.equal(LIVE_PROBE_FACTS.length, 2, 'the probe-added facts')
  const stopMs = Date.parse(LIVE_STOP_INSTANT)
  assert.equal(LIVE_CONSULTATIONS.every((fact) => Date.parse(fact.observedAt) < stopMs), true, 'every stop-time fact precedes the stop')
  assert.equal(LIVE_PROBE_FACTS.every((fact) => Date.parse(fact.observedAt) > stopMs), true, 'every probe fact follows it')
  assert.equal(LIVE_PROBE_FACTS.every((fact) => fact.decision === 'deny' && String(fact.locator).endsWith('/axis/b.txt')), true,
    'each probe was a refused read of the probe target')
  assert.equal(LIVE_PROBE_FACTS.every((fact) => fact.method === 'stat' && fact.realm === 'binding'), true,
    'the refusal is recorded where the product records it: the binding stat')

  const live = judgeRow6(PASS.row6)
  assert.equal(live.verdict, 'PROVEN', JSON.stringify(live))
  assert.equal(live.detail.checks.noFactAfterStop, true)
  assert.equal(live.detail.checks.probeFactsAreRefusals, true)
  assert.equal(live.detail.factsObserved, 8)
  assert.equal(live.detail.probeFactsObserved, 2)
  assert.deepEqual(live.detail.factsAfterStop, [])
  assert.equal(live.detail.stopInstant, LIVE_STOP_INSTANT)

  // THE BOOT-2 FAIL, REPRODUCED: hand the SAME 10 facts to the bound as one
  // array (what the driver did) and the row refutes itself on its own stimulus.
  const unsplit = judgeRow6({
    ...PASS.row6,
    facts: [...LIVE_CONSULTATIONS, ...LIVE_PROBE_FACTS],
    probeFacts: [],
  })
  assert.equal(unsplit.verdict, 'REFUTED', JSON.stringify(unsplit))
  assert.deepEqual(unsplit.detail.failed, ['noFactAfterStop'])
  assert.equal(unsplit.detail.factsAfterStop.length, 2)
  assert.equal(unsplit.detail.factsAfterStop[0].locator, LIVE_PROBE_FACTS[0].locator)
  assert.equal(unsplit.detail.factsAfterStop[1].observedAt, LIVE_PROBE_FACTS[1].observedAt)

  // The old count input is CARRIED but not checked: the verdict is unchanged for
  // sinkDelta 0 and 2 on the same stream.
  assert.equal(PASS.row6.sinkDelta, 2, 'the old window input, as measured live')
  assert.equal(judgeRow6({ ...PASS.row6, sinkDelta: 2 }).verdict, 'PROVEN')
  assert.equal(judgeRow6({ ...PASS.row6, sinkDelta: 0 }).verdict, 'PROVEN')

  // The refuting twin: ONE fact with a LATER observedAt, in the stop-time set.
  const injectedAt = new Date(Date.parse(LIVE_STOP_INSTANT) + 1000).toISOString()
  const injected = judgeRow6({
    ...PASS.row6,
    facts: [...LIVE_CONSULTATIONS, { ...LIVE_CONSULTATIONS[0], method: 'writeText', locator: '/w/after-stop.txt', observedAt: injectedAt }],
  })
  assert.equal(injected.verdict, 'REFUTED')
  assert.equal(injected.reason, 'ROW6_CLAUSE_FAILED')
  assert.deepEqual(injected.detail.failed, ['noFactAfterStop'])
  assert.equal(injected.detail.factsAfterStop.length, 1)
  assert.equal(injected.detail.factsAfterStop[0].observedAt, injectedAt)
  assert.equal(injected.detail.factsAfterStop[0].locator, '/w/after-stop.txt')

  // A fact AT the stop instant is not "after" it (the bound is strict).
  assert.equal(judgeRow6({ ...PASS.row6, facts: [...LIVE_CONSULTATIONS, { ...LIVE_CONSULTATIONS[0], observedAt: LIVE_STOP_INSTANT }] }).verdict, 'PROVEN')
  // A fact with NO parseable observedAt cannot be proven to precede the stop.
  const undated = judgeRow6({ ...PASS.row6, facts: [...LIVE_CONSULTATIONS, { ...LIVE_CONSULTATIONS[0], observedAt: null }] })
  assert.equal(undated.verdict, 'REFUTED')
  assert.deepEqual(undated.detail.failed, ['factsAreTimestamped'])
  // No stop instant = the row is unanswerable (the driver must record it).
  const noStop = judgeRow6({ ...PASS.row6, stopInstant: null })
  assert.equal(noStop.verdict, 'NOT_REACHED')
  assert.equal(noStop.reason, 'NO_STOP_INSTANT')
  // A probe fact that is an ALLOW means the stopped Member was SERVED — the
  // second repaired clause is load-bearing.
  const served = judgeRow6({ ...PASS.row6, probeFacts: [...LIVE_PROBE_FACTS, { ...LIVE_PROBE_FACTS[0], decision: 'allow' }] })
  assert.equal(served.verdict, 'REFUTED')
  assert.deepEqual(served.detail.failed, ['probeFactsAreRefusals'])
  assert.equal(served.detail.probeFactsObserved, 3)
  // A probe fact with no decision is not a proven refusal either (fail-closed).
  assert.equal(judgeRow6({ ...PASS.row6, probeFacts: [{ ...LIVE_PROBE_FACTS[0], decision: null }] }).verdict, 'REFUTED')
  // The other clauses are unchanged and still fire.
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

// ─────────────────────────────────────────────────────────────────────────────
// D. THE SHARED ZERO-BOOT PREFLIGHT (2026-11-06 owner reorganisation)
//
// The negative control the directive asks for is D2: a deliberately aliased
// two-case fixture must produce a RED preflight. D3–D12 are the mutation
// controls that make each check load-bearing — a check whose fact can be
// broken without turning it red is decoration.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_DIR = new URL('./fixtures/', import.meta.url)
const CLEAN_FIXTURE = new URL('a5sf-zero-boot-preflight-clean.json', FIXTURE_DIR)
const ALIASED_FIXTURE = new URL('a5sf-zero-boot-preflight-aliased-two-case.json', FIXTURE_DIR)
const CLEAN = JSON.parse(readFileSync(CLEAN_FIXTURE, 'utf8'))
const ALIASED = JSON.parse(readFileSync(ALIASED_FIXTURE, 'utf8'))
/** The fixture's native modules are real files in the pristine host checkout;
 *  this suite is host-free by law, so existence is stubbed to "present" and the
 *  assembly check is exercised on the probe path it will use in production. */
const PRESENT = { fileExists: () => true }
const ABSENT = { fileExists: () => false }
const codesOf = (result) => result.findings.map((f) => f.code)
const mutate = (bundle, fn) => { const copy = structuredClone(bundle); fn(copy); return runZeroBootPreflight(copy, PRESENT) }

test('D1 the clean plan passes every check', () => {
  const result = runZeroBootPreflight(CLEAN, PRESENT)
  assert.equal(result.verdict, 'PASS')
  assert.deepEqual(result.findings, [])
  assert.equal(result.checks.length, PREFLIGHT_CHECK_IDS.length)
  assert.deepEqual(result.checks.map((c) => c.id), [...PREFLIGHT_CHECK_IDS])
  assert.equal(result.summary, `PASS ${PREFLIGHT_CHECK_IDS.length}/${PREFLIGHT_CHECK_IDS.length} checks`)
})

test('D2 NEGATIVE CONTROL: the aliased two-case fixture is RED, for the alias and nothing else', () => {
  const result = runZeroBootPreflight(ALIASED, PRESENT)
  assert.equal(result.verdict, 'FAIL')
  // The red is ATTRIBUTABLE: the alias is the only defect, so exactly one check
  // is red and it carries exactly the two alias codes. If collateral findings
  // appeared, an operator could not tell whether the alias or the plan was at
  // fault — the confusing failure allocation #1 actually produced.
  const failed = result.checks.filter((c) => c.verdict === 'FAIL')
  assert.equal(failed.length, 1)
  assert.equal(failed[0].id, 'cases.isolation')
  const codes = codesOf(result).sort()
  assert.deepEqual(codes, ['CASE_GUARD_KEY_ALIASED', 'CASE_LOCATOR_ALIASED'])
  // The two cases named are the two that aliased, and the locator is the one
  // from the real allocation-#1 fixture.
  const alias = result.findings.find((f) => f.code === 'CASE_LOCATOR_ALIASED')
  assert.deepEqual(alias.cases, ['read-b', 'search-row3'])
  assert.equal(alias.locator, '/w/workspace/lane/outside-restriction.txt')
  assert.match(alias.detail, /candidate-1 allocation #1/)
})

test('D3 case isolation also refuses a duplicated id and a case with no locator', () => {
  const dup = mutate(CLEAN, (b) => { b.cases[1].id = b.cases[0].id })
  assert.ok(codesOf(dup).includes('CASE_ID_DUPLICATED'))
  const noLoc = mutate(CLEAN, (b) => { delete b.cases[0].locator })
  assert.ok(codesOf(noLoc).includes('CASE_LOCATOR_MISSING'))
  const none = runZeroBootPreflight({ ...structuredClone(CLEAN), cases: [] }, PRESENT)
  assert.ok(codesOf(none).includes('CASE_LIST_EMPTY'))
})

test('D4 assembly: a missing dist face, a missing native module and a broken row handoff are each red', () => {
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.assembly.distFaces.subprocess = false })).includes('ASSEMBLY_DIST_FACE_MISSING'))
  const absent = runZeroBootPreflight(CLEAN, ABSENT)
  assert.ok(codesOf(absent).includes('ASSEMBLY_HOST_MODULE_MISSING'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.assembly.rowHandoff.worldRowIds = ['only-the-health-row'] })).includes('ASSEMBLY_ROW_HANDOFF_MISSING'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.assembly.rowHandoff.usesHandOverRows = false })).includes('ASSEMBLY_ROW_HANDOFF_MISSING'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.assembly.rowHandoff.beforeBoot = false })).includes('ASSEMBLY_ROW_HANDOFF_MISSING'))
})

test('D5 identity: the #575 create-root ≠ observe-root defect is refused, and blueprints/member bindings are graded', () => {
  const roots = mutate(CLEAN, (b) => { b.identity.createRoot = 'session-a5sf-acceptance-team' })
  assert.ok(codesOf(roots).includes('IDENTITY_ROOT_MISMATCH'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.identity.blueprints[0].members = 0 })).includes('IDENTITY_BLUEPRINT_INVALID'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.identity.memberBindings = b.identity.memberBindings.filter((x) => x.caseId !== 'read-a') })).includes('IDENTITY_MEMBER_BINDING_MISSING'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.identity.memberBindings[0].toolBindingIdentity = '' })).includes('IDENTITY_MEMBER_BINDING_INVALID'))
})

test('D6 identity.authority: an observed pointer that is not the named snapshot is red', () => {
  const result = mutate(CLEAN, (b) => { b.runRecord.bindings.authority.pointer.content_digest = 'sha256:0000000000000000000000000000000000000000000000000000000000000000' })
  assert.ok(codesOf(result).includes('IDENTITY_AUTHORITY_MISMATCH'))
})

test('D7 native.module-config: the two BL-16 attempt defects (empty config, missing key) are red', () => {
  const empty = mutate(CLEAN, (b) => { b.nativeModules[0].config = {} })
  assert.ok(codesOf(empty).includes('NATIVE_MODULE_CONFIG_EMPTY'))
  const missing = mutate(CLEAN, (b) => { delete b.nativeModules[0].config.sampleOverCapGlobResults })
  assert.ok(codesOf(missing).includes('NATIVE_MODULE_CONFIG_EMPTY'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.nativeModules[0].inject = [] })).includes('NATIVE_MODULE_INJECT_EMPTY'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.nativeModules = [] })).includes('NATIVE_MODULE_UNDECLARED'))
})

test('D8 policy.paths: an allow outside the lane, a deny inside it, and a deny inside the runtime allowance are red', () => {
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.cases[0].locator = '/w/elsewhere/needle.txt' })).includes('POLICY_EXPECTATION_CONTRADICTS_LANE'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.policy.effectiveReadAllow.push('/w/ceiling-outside') })).includes('POLICY_EXPECTATION_CONTRADICTS_LANE'))
  const allowance = mutate(CLEAN, (b) => {
    b.cases[1].locator = '/etc/passwd'
    b.policy.dispositions['read-b'] = { ceiling: 'allow', restriction: 'deny', effective: 'deny' }
  })
  assert.ok(codesOf(allowance).includes('POLICY_ROOT_INSIDE_RUNTIME_ALLOWANCE'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.cases[1].deniedBy = 'ceiling' })).includes('POLICY_AXIS_ATTRIBUTION_WRONG'))
})

test('D9 policy.fifo: the BL-16 attempt-6 defect (FIFO outside the lane) is red', () => {
  const result = mutate(CLEAN, (b) => { b.policy.fifo = '/w/ceiling-outside/blocking.fifo' })
  assert.ok(codesOf(result).includes('POLICY_FIFO_OUTSIDE_LANE'))
  assert.equal(result.checks.find((c) => c.id === 'policy.fifo').verdict, 'FAIL')
})

test('D10 collector.shape: empty corpus, missing return-shape key, no terminate, no archive are red', () => {
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.cases[0].corpus = [] })).includes('COLLECTOR_CORPUS_EMPTY'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.cases[0].returnShape = ['call', 'result'] })).includes('COLLECTOR_RETURN_SHAPE_MISSING'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.cases[0].terminate = false })).includes('COLLECTOR_TERMINATE_MISSING'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.cases[0].archiveBeforeStart = false })).includes('COLLECTOR_ARCHIVE_MISSING'))
})

test('D11 wiring: candidate/grant/run-record/ledger disagreement is red before a start', () => {
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.candidate.head = 'not-a-sha' })).includes('CANDIDATE_SHA_INVALID'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.candidate.baseline = 'a'.repeat(40) })).includes('CANDIDATE_BASELINE_MISMATCH'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.grant.boundCommit = 'b'.repeat(40) })).includes('GRANT_CANDIDATE_MISMATCH'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.grant.maxStarts = 2 })).includes('GRANT_NOT_LARGE_ENOUGH'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.runRecord.teamSha = 'c'.repeat(40) })).includes('RUNRECORD_TEAM_SHA_MISMATCH'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.runRecord.ledger.bootRows = 2 })).includes('LEDGER_ARITHMETIC_MISMATCH'))
  assert.ok(codesOf(mutate(CLEAN, (b) => { b.runRecord.ledger.plannedStarts = 2 })).includes('LEDGER_ARITHMETIC_MISMATCH'))
})

test('D12 the run record may name the baseline instead of the candidate head only when every product path is proven equal', () => {
  const proven = mutate(CLEAN, (b) => { b.runRecord.teamSha = b.candidate.baseline })
  assert.equal(proven.verdict, 'PASS', 'a proven-identical tree is allowed')
  const unproven = mutate(CLEAN, (b) => {
    b.runRecord.teamSha = b.candidate.baseline
    b.candidate.productTreeProof[1].equal = false
  })
  assert.ok(codesOf(unproven).includes('RUNRECORD_TEAM_SHA_MISMATCH'))
})

test('D13 a bundle with the wrong schema is refused instead of graded', () => {
  const result = runZeroBootPreflight({ ...structuredClone(CLEAN), schema: 'something/else' }, PRESENT)
  assert.equal(result.verdict, 'FAIL')
  assert.deepEqual(codesOf(result), ['BUNDLE_SCHEMA_MISMATCH'])
})

test('D14 the CLI prints ONE machine-readable verdict and exits non-zero on the aliased fixture', () => {
  const cli = fileURLToPath(new URL('../../scripts/a5sf-preflight.mjs', import.meta.url))
  const bundle = fileURLToPath(ALIASED_FIXTURE)
  const run = spawnSync(process.execPath, [cli, '--bundle', bundle, '--repo', fileURLToPath(new URL('../..', import.meta.url))], { encoding: 'utf8' })
  assert.equal(run.status, 1)
  const lines = run.stdout.trim().split('\n')
  assert.equal(lines.length, 1, `the CLI must print exactly one line (got ${JSON.stringify(lines)})`)
  assert.ok(lines[0].startsWith('DSH-A5SF-PREFLIGHT '))
  const verdict = JSON.parse(lines[0].slice('DSH-A5SF-PREFLIGHT '.length))
  assert.equal(verdict.verdict, 'FAIL')
  assert.ok(verdict.findings.some((f) => f.code === 'CASE_LOCATOR_ALIASED'))
})

test('D15 a run directory without a preflight bundle is REFUSED, never reconstructed from the run output', () => {
  const cli = fileURLToPath(new URL('../../scripts/a5sf-preflight.mjs', import.meta.url))
  const run = spawnSync(process.execPath, [cli, '--run-dir', fileURLToPath(new URL('./fixtures', import.meta.url))], { encoding: 'utf8' })
  assert.equal(run.status, 1)
  const verdict = JSON.parse(run.stdout.trim().slice('DSH-A5SF-PREFLIGHT '.length))
  assert.equal(verdict.verdict, 'FAIL')
  assert.deepEqual(verdict.findings.map((f) => f.code), ['PREFLIGHT_BUNDLE_MISSING'])
})
