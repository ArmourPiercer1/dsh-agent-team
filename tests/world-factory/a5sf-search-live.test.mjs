/**
 * a5sf-search-live.test.mjs — the host-free contract of the P2-03 / BL-16 live
 * half (Search vertical). Zero Host boots, zero ports, no DSH_HOME.
 *
 * WHAT THIS PINS: every judge in `lib/a5sf-search-live.mjs` is THREE-WAY. For
 * each row the suite feeds
 *   - a NOT_REACHED sample (the drive never produced the observable),
 *   - a REFUTED sample (the observable exists and contradicts the claim),
 *   - a PROVEN base,
 * and asserts the three verdicts differ and the expected clause fails. A judge
 * that returned PROVEN on a missing observable fails here, host-free, instead
 * of after a spent boot.
 *
 * It also pins the refutation twins that matter for THIS lane: a leaked outside
 * byte, a process created on a refusal, an ALLOW fact on a denial, a fabricated
 * "No matches found" after a cancel, a swallow of rg exit 2 into a no-match, and
 * a teardown counted by a delta instead of a timestamp.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  READ_DENIED,
  SEARCH_CASES,
  SEARCH_CASE_IDS,
  SUBPROCESS_GUARD_METHOD,
  guardFacts,
  judgeNegativeControl,
  judgeRow1,
  judgeRow2,
  judgeRow3,
  judgeRow4,
  judgeRow5,
  judgeRow6,
  judgeSearchRow,
  toRunVerdict,
} from './lib/a5sf-search-live.mjs'

const ROOT = '/w/lane'
const OUTSIDE = '/h/ceiling-outside/secret.txt'
const RESTRICTED = '/w/lane/outside-restriction.txt'
const FIFO = '/w/lane/blocking.fifo'
const NEEDLE = 'A5SF_SEARCH_NEEDLE'
const SECRET = 'A5SF_SEARCH_OUTSIDE_SECRET'
const RESTRICTED_CLAIM = 'A5SF_SEARCH_RESTRICTION_ONLY'

const fact = (over = {}) => ({
  schema: 'a5sf-guard-consult/1',
  realm: 'member',
  memberIdentity: 'member-search-1',
  toolBindingIdentity: null,
  policyRevision: 'rev-1',
  method: SUBPROCESS_GUARD_METHOD,
  locator: ROOT,
  decision: 'allow',
  decidedBy: 'ALLOW',
  observedAt: '2026-11-04T09:00:00.000Z',
  ...over,
})
const spawn = (argv, over = {}) => ({ leg: 'confined-spawn', argv, cwd: '/w', at: '2026-11-04T09:00:00.000Z', ...over })
const exit = (argv, code, signal, over = {}) => ({ leg: 'confined-exit', argv, code, signal, at: '2026-11-04T09:00:01.000Z', ...over })
const ok = (text) => ({ source: 'model', isError: false, text })

// ── row 1 ────────────────────────────────────────────────────────────────────

const row1Proven = () => ({
  result: ok(`Found 1 match in ${ROOT}/needle.txt\n${ROOT}/needle.txt:1:${NEEDLE}`),
  facts: [fact()],
  records: [spawn(['/rg', '--no-config', '--json', `--regexp=${NEEDLE}`, '--', ROOT])],
  declaredRoot: ROOT,
  needle: NEEDLE,
  fileName: 'needle.txt',
})

test('row 1: an in-lane grep with exactly one ALLOW fact on the declared root is PROVEN', () => {
  const verdict = judgeRow1(row1Proven())
  assert.equal(verdict.verdict, 'PROVEN', JSON.stringify(verdict))
  assert.equal(verdict.reason, 'IN_LANE_GREP_ALLOWED_AND_CONFINED')
  assert.equal(verdict.detail.factRealm, 'member')
  assert.equal(verdict.detail.toolBindingIdentity, null)
})

test('row 1: no call at all is NOT_REACHED, never a pass', () => {
  const verdict = judgeRow1({ declaredRoot: ROOT, needle: NEEDLE, fileName: 'needle.txt' })
  assert.equal(verdict.verdict, 'NOT_REACHED')
  assert.equal(verdict.reason, 'NO_GREP_CALL_ROW1')
})

test('row 1: a call whose result never arrived is NOT_REACHED (NOT_REACHED ≠ fail)', () => {
  const verdict = judgeRow1({ facts: [fact()], declaredRoot: ROOT, needle: NEEDLE, fileName: 'needle.txt' })
  assert.equal(verdict.verdict, 'NOT_REACHED')
  assert.equal(verdict.reason, 'NO_GREP_RESULT_ROW1')
})

test('row 1: a result without the match REFUTES', () => {
  const sample = row1Proven()
  sample.result = ok('Found 0 matches')
  const verdict = judgeRow1(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('matchReturned'))
})

test('row 1: TWO allow facts REFUTE (the row asserts exactly one)', () => {
  const sample = row1Proven()
  sample.facts = [fact(), fact({ observedAt: '2026-11-04T09:00:00.100Z' })]
  const verdict = judgeRow1(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('exactlyOneAllowFact'))
})

test('row 1: an ALLOW recorded on the inherited base service REFUTES (no shadow)', () => {
  const sample = row1Proven()
  sample.records = [{ leg: 'base-spawn', argv: ['/rg'], at: 'x' }]
  const verdict = judgeRow1(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('noBaseServiceSpawn'))
  assert.ok(verdict.failed.includes('exactlyOneProcess'))
})

test('row 1: an allow fact whose locator is a DIFFERENT root REFUTES', () => {
  const sample = row1Proven()
  sample.facts = [fact({ locator: '/w/other' })]
  const verdict = judgeRow1(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('exactlyOneAllowFact'))
})

// ── row 2 ────────────────────────────────────────────────────────────────────

const row2Proven = () => ({
  result: { source: 'model', isError: true, text: 'grep subprocess failed before reporting an outcome (ripgrep provider failure)' },
  facts: [fact({ locator: OUTSIDE, decision: 'deny', decidedBy: READ_DENIED })],
  records: [],
  declaredRoot: OUTSIDE,
  forbidden: [SECRET, 'A5SF_SEARCH_OUTSIDE_SECOND_LINE'],
})

test('row 2: an out-of-lane refusal with one typed deny fact and zero processes is PROVEN', () => {
  const verdict = judgeRow2(row2Proven())
  assert.equal(verdict.verdict, 'PROVEN', JSON.stringify(verdict))
  assert.equal(verdict.reason, 'OUT_OF_LANE_REFUSED_BEFORE_ANY_PROCESS')
})

test('row 2: no call is NOT_REACHED', () => {
  const verdict = judgeRow2({ declaredRoot: OUTSIDE, forbidden: [SECRET] })
  assert.equal(verdict.verdict, 'NOT_REACHED')
  assert.equal(verdict.reason, 'NO_GREP_CALL_ROW2')
})

test('row 2: a refused call that still STARTED a confined process REFUTES ("before any process")', () => {
  const sample = row2Proven()
  sample.records = [spawn(['/rg', '--no-config', '--json', '--regexp=x', '--', OUTSIDE])]
  const verdict = judgeRow2(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('noConfinedProcess'))
})

test('row 2: a leaked outside token REFUTES', () => {
  const sample = row2Proven()
  sample.result = { source: 'model', isError: true, text: `SEARCH_FAILED ${SECRET}` }
  const verdict = judgeRow2(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.deepEqual(verdict.detail.leakedTokens, [SECRET])
  assert.ok(verdict.failed.includes('noForbiddenBytes'))
})

test('row 2: an ALLOW fact on a denial REFUTES', () => {
  const sample = row2Proven()
  sample.facts = [fact({ locator: OUTSIDE, decision: 'allow', decidedBy: 'ALLOW' })]
  const verdict = judgeRow2(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('noAllowFact'))
  assert.ok(verdict.failed.includes('exactlyOneDenyFact'))
})

test('row 2: two deny facts REFUTE (exactly one)', () => {
  const sample = row2Proven()
  sample.facts = [fact({ locator: OUTSIDE, decision: 'deny', decidedBy: READ_DENIED }), fact({ locator: OUTSIDE, decision: 'deny', decidedBy: READ_DENIED })]
  const verdict = judgeRow2(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('exactlyOneDenyFact'))
})

// ── row 3 ────────────────────────────────────────────────────────────────────

const laneReport = () => ({
  probePaths: [
    { locator: RESTRICTED, ceilingRead: 'allow', restrictionRead: 'deny', effectiveRead: 'deny' },
  ],
})
const row3Proven = () => ({
  result: { source: 'model', isError: true, text: 'grep subprocess failed before reporting an outcome (ripgrep provider failure)' },
  facts: [fact({ locator: RESTRICTED, decision: 'deny', decidedBy: READ_DENIED })],
  records: [],
  declaredRoot: RESTRICTED,
  forbidden: [RESTRICTED_CLAIM],
  laneReport: laneReport(),
})

test('row 3: ceiling-allow / restriction-deny / effective-deny with one deny fact is PROVEN', () => {
  const verdict = judgeRow3(row3Proven())
  assert.equal(verdict.verdict, 'PROVEN', JSON.stringify(verdict))
  assert.equal(verdict.reason, 'RESTRICTION_NARROWER_THAN_CEILING_REFUSED_AT_ADMISSION')
  assert.equal(verdict.detail.presetExpressesBindingRestriction, false)
})

test('row 3: a missing lane report is NOT_REACHED (the no-widening claim has no channel)', () => {
  const sample = row3Proven()
  sample.laneReport = null
  const verdict = judgeRow3(sample)
  assert.equal(verdict.verdict, 'NOT_REACHED')
  assert.equal(verdict.reason, 'NO_LANE_REPORT_ROW3')
})

test('row 3: a premise where the CEILING denies is REFUTED (the experiment did not measure the restriction)', () => {
  const sample = row3Proven()
  sample.laneReport = { probePaths: [{ locator: RESTRICTED, ceilingRead: 'deny', restrictionRead: 'deny', effectiveRead: 'deny' }] }
  const verdict = judgeRow3(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('premiseCeilingAllows'))
})

test('row 3: an effective lane that ALLOWS the restricted path REFUTES (widening)', () => {
  const sample = row3Proven()
  sample.laneReport = { probePaths: [{ locator: RESTRICTED, ceilingRead: 'allow', restrictionRead: 'deny', effectiveRead: 'allow' }] }
  const verdict = judgeRow3(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('noWidenedEffectiveDecision'))
})

test('row 3: a process created despite the restriction REFUTES', () => {
  const sample = row3Proven()
  sample.records = [spawn(['/rg', '--no-config', '--json', '--regexp=x', '--', RESTRICTED])]
  const verdict = judgeRow3(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('noConfinedProcess'))
})

// ── row 4 ────────────────────────────────────────────────────────────────────

const row4Proven = () => ({
  result: { source: 'model', isError: true, text: 'grep was aborted before completion (tool timeout or caller cancellation)' },
  facts: [fact({ locator: FIFO })],
  records: [spawn(['/rg', '--no-config', '--json', '--regexp=x', '--', FIFO]), exit(['/rg', '--no-config', '--json', '--regexp=x', '--', FIFO], null, 'SIGTERM')],
  declaredRoot: FIFO,
  needle: NEEDLE,
  interrupt: { status: 200, ok: true },
})

test('row 4: a delivered abort result plus a signal-killed child is PROVEN', () => {
  const verdict = judgeRow4(row4Proven())
  assert.equal(verdict.verdict, 'PROVEN', JSON.stringify(verdict))
  assert.equal(verdict.reason, 'CANCELLED_SEARCH_SETTLED_AS_CANCELLED')
})

test('row 4: no call is NOT_REACHED', () => {
  const verdict = judgeRow4({ declaredRoot: FIFO, needle: NEEDLE })
  assert.equal(verdict.verdict, 'NOT_REACHED')
  assert.equal(verdict.reason, 'NO_GREP_CALL_ROW4')
})

test('row 4: a call that never reached a process is NOT_REACHED (nothing could be cancelled)', () => {
  const verdict = judgeRow4({ result: { isError: true, text: 'aborted' }, declaredRoot: FIFO, needle: NEEDLE, interrupt: { status: 200, ok: true } })
  assert.equal(verdict.verdict, 'NOT_REACHED')
  assert.equal(verdict.reason, 'NO_CONFINED_SPAWN_ROW4')
})

test('row 4: a SUCCESS result REFUTES (a cancelled search must not report success)', () => {
  const sample = row4Proven()
  sample.result = ok('Found 3 matches')
  const verdict = judgeRow4(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('noSuccessResult'))
})

test('row 4: an error that does NOT name the abort REFUTES (a delivered settlement must be the cancellation)', () => {
  const sample = row4Proven()
  sample.result = { source: 'model', isError: true, text: 'grep failed: some unrelated provider error' }
  const verdict = judgeRow4(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('settlementIsCancelled'))
  assert.ok(!verdict.failed.includes('noSuccessResult'))
})

test('row 4: a fabricated "No matches found" REFUTES', () => {
  const sample = row4Proven()
  sample.result = ok('No matches found')
  const verdict = judgeRow4(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('noFabricatedEmptyResult'))
})

test('row 4: an undelivered result is accepted ONLY when the child was signal-killed', () => {
  const sample = row4Proven()
  sample.result = null
  const verdict = judgeRow4(sample)
  assert.equal(verdict.verdict, 'PROVEN')
  assert.equal(verdict.reason, 'CANCELLED_SEARCH_ABORTED_WITH_KILLED_CHILD_NO_RESULT')
  const broken = { ...sample, records: [spawn(['/rg', '--no-config', '--json', '--regexp=x', '--', FIFO])] }
  const refuted = judgeRow4(broken)
  assert.equal(refuted.verdict, 'REFUTED')
  assert.ok(refuted.failed.includes('childTerminatedBySignal'))
})

// ── row 5 ────────────────────────────────────────────────────────────────────

const row5Proven = () => ({
  result: { source: 'model', isError: true, text: 'grep failed (exit code 2): regex parse error: unclosed group' },
  facts: [fact()],
  records: [spawn(['/rg', '--no-config', '--json', '--regexp=A5SF_(', '--', ROOT]), exit(['/rg', '--no-config', '--json', '--regexp=A5SF_(', '--', ROOT], 2, null)],
  declaredRoot: ROOT,
  pattern: 'A5SF_(',
})

test('row 5: rg exit 2 surfaced as a tool error is PROVEN', () => {
  const verdict = judgeRow5(row5Proven())
  assert.equal(verdict.verdict, 'PROVEN', JSON.stringify(verdict))
  assert.equal(verdict.reason, 'INVALID_PATTERN_SURFACED_AS_TOOL_ERROR')
})

test('row 5: no call is NOT_REACHED', () => {
  const verdict = judgeRow5({ declaredRoot: ROOT, pattern: 'A5SF_(' })
  assert.equal(verdict.verdict, 'NOT_REACHED')
  assert.equal(verdict.reason, 'NO_GREP_CALL_ROW5')
})

test('row 5: an invalid pattern presented as "No matches found" REFUTES', () => {
  const sample = row5Proven()
  sample.result = ok('No matches found')
  const verdict = judgeRow5(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('resultIsError'))
  assert.ok(verdict.failed.includes('notPresentedAsNoMatches'))
})

test('row 5: an error without the process exit-2 record REFUTES (prose is not the process answer)', () => {
  const sample = row5Proven()
  sample.records = [spawn(['/rg', '--no-config', '--json', '--regexp=A5SF_(', '--', ROOT])]
  const verdict = judgeRow5(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('processExitedTwo'))
})

// ── row 6 ────────────────────────────────────────────────────────────────────

const STOP = '2026-11-04T09:10:00.000Z'
const row6Proven = () => ({
  member: { instanceId: 'member-search-1', childSessionId: 'session-search-1', templateId: 'worker', lifecycle: 'ACTIVE' },
  archive: { status: 200, body: { ok: true } },
  membersAfter: [{ instanceId: 'member-search-1', templateId: 'worker', lifecycle: 'ARCHIVED' }],
  postStopDispatches: [{ status: 422, body: { error: "no live agent for 'session-search-1'" } }],
  facts: [fact({ observedAt: '2026-11-04T09:09:59.000Z' })],
  probeFacts: [fact({ locator: ROOT, decision: 'deny', decidedBy: READ_DENIED, observedAt: '2026-11-04T09:10:01.000Z' })],
  stopInstant: STOP,
  observations: ['a5p1-guard: guard-installed agent=session-search-1'],
  managed: { sessionId: 'session-search-1', realmLabel: 'member:member-search-1' },
  duringManagedDisposal: true,
  managedRealmCount: 1,
  hostAlive: false,
  portStillListening: false,
  homeDeleted: true,
  orphanPids: [],
  confinedSpawnsAfterStop: [],
  baseSpawnsAfterStop: [],
})

test('row 6: a clean teardown with a refused post-stop dispatch and no fact after the stop is PROVEN', () => {
  const verdict = judgeRow6(row6Proven())
  assert.equal(verdict.verdict, 'PROVEN', JSON.stringify(verdict))
  assert.equal(verdict.reason, 'NO_USABLE_CALLABLE_SHADOW_AFTER_STOP')
})

test('row 6: no archive dispatch is NOT_REACHED', () => {
  const sample = row6Proven()
  sample.archive = null
  const verdict = judgeRow6(sample)
  assert.equal(verdict.verdict, 'NOT_REACHED')
  assert.equal(verdict.reason, 'NO_ARCHIVE_DISPATCH')
})

test('row 6: an ARCHIVE REFUSAL is REFUTED, not NOT_REACHED', () => {
  const sample = row6Proven()
  sample.archive = { status: 200, body: { error: 'refused' } }
  const verdict = judgeRow6(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.equal(verdict.reason, 'ARCHIVE_REFUSED')
})

test('row 6: a post-stop dispatch that SUCCEEDED REFUTES (a callable shadow remained)', () => {
  const sample = row6Proven()
  sample.postStopDispatches = [{ status: 200, body: { ok: true, value: [{ type: 'text', text: 'Found 1 match' }] } }]
  const verdict = judgeRow6(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('noCallableShadow'))
  assert.ok(verdict.failed.includes('noSuccessAfterStop'))
})

test('row 6: a fact with observedAt AFTER the stop REFUTES (the temporal bound, not a count)', () => {
  const sample = row6Proven()
  sample.facts = [fact({ observedAt: '2026-11-04T09:10:00.500Z' })]
  const verdict = judgeRow6(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('noFactAfterStop'))
})

test('row 6: an undated fact REFUTES (cannot be proven to precede the stop)', () => {
  const sample = row6Proven()
  sample.facts = [fact({ observedAt: null })]
  const verdict = judgeRow6(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('factsAreTimestamped'))
})

test('row 6: an ALLOW probe fact after the stop REFUTES (the stopped Member was served)', () => {
  const sample = row6Proven()
  sample.probeFacts = [fact({ decision: 'allow', decidedBy: 'ALLOW' })]
  const verdict = judgeRow6(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('probeFactsAreRefusals'))
})

test('row 6: a surviving process REFUTES (orphan / post-stop spawn)', () => {
  const sample = row6Proven()
  sample.orphanPids = [1234]
  sample.confinedSpawnsAfterStop = [{ leg: 'confined-spawn', argv: ['/rg'] }]
  const verdict = judgeRow6(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('noProcessAfterStop'))
  assert.ok(verdict.failed.includes('noOrphanProcess'))
})

test('row 6: a live port or surviving home REFUTES', () => {
  const sample = row6Proven()
  sample.portStillListening = true
  sample.homeDeleted = false
  const verdict = judgeRow6(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('portReleased'))
  assert.ok(verdict.failed.includes('homeDeleted'))
})

test('row 6: a managed dispose fault attributed to the stop REFUTES', () => {
  const sample = row6Proven()
  sample.observations = ['a5sf: realm dispose failed: EBUSY']
  const verdict = judgeRow6(sample)
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('noManagedDisposeFault'))
})

// ── the negative control ────────────────────────────────────────────────────

test('negative control: the same out-of-lane search UNCONFINED leaks with zero guard facts', () => {
  const verdict = judgeNegativeControl({
    result: ok(`${OUTSIDE}:1:${SECRET}`),
    forbidden: [SECRET],
    guardFactsBeforeRealm: [],
    baseSpawns: [{ leg: 'base-spawn', argv: ['/rg', '--no-config', '--json', '--regexp=x', '--', OUTSIDE] }],
    confinedSpawns: [],
  })
  assert.equal(verdict.verdict, 'PROVEN', JSON.stringify(verdict))
  assert.equal(verdict.reason, 'UNCONFINED_CONTROL_LEAKS')
})

test('negative control: a control that did NOT leak REFUTES (row 2 would be vacuous)', () => {
  const verdict = judgeNegativeControl({
    result: { isError: true, text: 'refused' },
    forbidden: [SECRET],
    baseSpawns: [],
  })
  assert.equal(verdict.verdict, 'REFUTED')
  assert.ok(verdict.failed.includes('controlSucceeded'))
  assert.ok(verdict.failed.includes('controlLeaked'))
})

test('negative control: no control call is NOT_REACHED', () => {
  const verdict = judgeNegativeControl({ forbidden: [SECRET] })
  assert.equal(verdict.verdict, 'NOT_REACHED')
  assert.equal(verdict.reason, 'NO_UNCONFINED_CONTROL_CALL')
})

// ── the closed contract ─────────────────────────────────────────────────────

test('the case list is closed and every id has a judge', () => {
  assert.equal(SEARCH_CASES.length, 6)
  assert.equal(new Set(SEARCH_CASES).size, 6)
  for (const id of SEARCH_CASES) {
    assert.equal(typeof judgeSearchRow(id, {}).verdict, 'string')
  }
  assert.throws(() => judgeSearchRow('live:nope'), /no search-live judge/u)
  assert.equal(toRunVerdict('PROVEN'), 'PASS')
  assert.equal(toRunVerdict('REFUTED'), 'FAIL')
  assert.equal(toRunVerdict('NOT_REACHED'), 'NOT_REACHED')
  assert.throws(() => toRunVerdict('PASS'), /not a search-live verdict/u)
})

test('SEARCH_CASE_IDS is the named contract the driver imports', () => {
  assert.deepEqual(Object.keys(SEARCH_CASE_IDS).sort(), ['row1', 'row2', 'row3', 'row4', 'row5', 'row6'])
  assert.match(SEARCH_CASE_IDS.row1, /grep-in-lane-allowed/u)
  assert.match(SEARCH_CASE_IDS.row2, /outside-ceiling-refused/u)
  assert.match(SEARCH_CASE_IDS.row3, /outside-restriction-refused/u)
  assert.match(SEARCH_CASE_IDS.row4, /cancelled-search-settles-cancelled/u)
  assert.match(SEARCH_CASE_IDS.row5, /invalid-pattern-is-error/u)
  assert.match(SEARCH_CASE_IDS.row6, /teardown-no-callable-shadow/u)
})

test('guardFacts ignores non-fact rows (the sink may carry other schemas)', () => {
  assert.equal(guardFacts([fact(), { schema: 'other/1' }, null, undefined]).length, 1)
})
