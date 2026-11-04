/**
 * a5sf-search-live.mjs — the HOST-FREE oracle of the P2-03 / BL-16 live half
 * (the Search vertical: native `grep` and `glob` measured through a real Host).
 *
 * WHY THIS MODULE EXISTS. BL-16 (`evidence/a5sf-bl16-grep/`) confined the
 * Member's `subprocess` axis and measured it through the product seam, but it
 * declared `V@B = no` for one stated reason: no Host was booted, so nobody had
 * observed a *Member's tool call* reaching the native search module through the
 * isolated realm. The external review named the same gap — "does the live
 * preset actually supply a confined `subprocess` face to the Member realm?"
 *
 * This module is the ONE place the six-row contract lives, so the boot driver
 * and a plain `node --test` suite share it. Every judge is THREE-WAY:
 *
 *   NOT_REACHED  the observable the row asserts was never produced (the drive
 *                never arrived at the asserted step, or the evidence channel
 *                that carries it never existed);
 *   REFUTED      the observable exists and CONTRADICTS the row's claim;
 *   PROVEN       the observable exists and satisfies every clause.
 *
 * A row whose "pass" could be produced by `null` inputs is impossible: each
 * judge's first branch is the reachability predicate, and every clause carries
 * a name so a failure names a *decision*, never a count.
 *
 * WHAT IS PRODUCT AND WHAT IS COMPOSITION (stated so it cannot be read as
 * more than it is):
 *   - the experiment (which file, which pattern, which lane) is composed by the
 *     evidence provider row — no product v3 blueprint field bridges a blueprint
 *     to a compiled ceiling/restriction at this base;
 *   - the lane ALGEBRA (`intersectPathRuleSets` / `matchLocator`), the guard,
 *     the confined `subprocess` class, the OS profile and the routed native
 *     module are SHIPPED code;
 *   - the sink is the product's own `a5sf-guard-consult/1` transport.
 *
 * The oracle asserts the product's answers only. It never decides what the
 * lane "should" be; it compares the shipped decisions against the row's claim.
 *
 * @module tests/world-factory/lib/a5sf-search-live
 */
import { classifyDisposeFaults } from './a5sf-acceptance-preflight.mjs'
import { overallVerdict } from './run-record.mjs'

/** The one fact schema the Member realm's guard transport emits. */
export const GUARD_FACT_SCHEMA = 'a5sf-guard-consult/1'
/** The guard method the confined `subprocess` face consults under (BL-16). */
export const SUBPROCESS_GUARD_METHOD = 'spawn'
/** The typed denial code of an out-of-lane read (the SAME code the fs face uses). */
export const READ_DENIED = 'IO_READ_DENIED'

/**
 * The named case list. A driver that indexes a positional list would renumber
 * itself on a split; the BL-16 host-free round already renamed row 2/4 twice
 * for exactly that reason. The six ids are the contract.
 */
export const SEARCH_CASE_IDS = Object.freeze({
  row1: 'live:search-row1-grep-in-lane-allowed',
  row2: 'live:search-row2-grep-outside-ceiling-refused',
  row3: 'live:search-row3-grep-outside-restriction-refused',
  row4: 'live:search-row4-cancelled-search-settles-cancelled',
  row5: 'live:search-row5-invalid-pattern-is-error',
  row6: 'live:search-row6-teardown-no-callable-shadow',
})

export const SEARCH_CASES = Object.freeze(Object.values(SEARCH_CASE_IDS))

/** Oracle verdict → RUN verdict. A `NOT_REACHED` never counts as PASS. */
const RUN_VERDICT = Object.freeze({ PROVEN: 'PASS', REFUTED: 'FAIL', NOT_REACHED: 'NOT_REACHED' })

export function toRunVerdict(verdict) {
  const mapped = RUN_VERDICT[verdict]
  if (mapped === undefined) throw new Error(`not a search-live verdict: ${JSON.stringify(verdict)}`)
  return mapped
}

// ─────────────────────────────────────────────────────────────────────────────
// small, shared predicates
// ─────────────────────────────────────────────────────────────────────────────

const isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
const list = (v) => (Array.isArray(v) ? v : [])
const norm = (v) => String(v ?? '').replace(/\/+$/u, '')
const textOfResult = (result) => String(result?.text ?? '')

/** Every guard fact in a stream (the sink is append-only, so callers may pass all of it). */
export function guardFacts(facts) {
  return list(facts).filter((fact) => fact !== null && fact !== undefined && fact.schema === GUARD_FACT_SCHEMA)
}

function factsAt(facts, locator) {
  return guardFacts(facts).filter((fact) => norm(fact.locator) === norm(locator))
}

function spawnRecords(records) {
  return list(records).filter((row) => row !== null && row !== undefined && row.leg === 'confined-spawn')
}
function exitRecords(records) {
  return list(records).filter((row) => row !== null && row !== undefined && row.leg === 'confined-exit')
}
function baseSpawnRecords(records) {
  return list(records).filter((row) => row !== null && row !== undefined && row.leg === 'base-spawn')
}
function argvHas(record, token) {
  const argv = list(record?.argv)
  return argv.some((arg) => String(arg).includes(String(token)))
}

/**
 * The clause collector. `checks` is an ordered object so a report names the
 * first failing *decision* in row order; every clause is boolean and every
 * `false` is a refutation, never a skip.
 */
function verdictOf({ checks, detail, provenReason, refutedReason }) {
  const failed = Object.entries(checks).filter(([, ok]) => ok !== true).map(([name]) => name)
  if (failed.length > 0) {
    return Object.freeze({
      verdict: 'REFUTED',
      reason: refutedReason,
      failed,
      checks,
      detail,
    })
  }
  return Object.freeze({ verdict: 'PROVEN', reason: provenReason, failed: [], checks, detail })
}

function notReached(reason, detail = {}) {
  return Object.freeze({ verdict: 'NOT_REACHED', reason, failed: [], checks: {}, detail })
}

// ─────────────────────────────────────────────────────────────────────────────
// row 1 — in-lane grep is served, exactly one ALLOW fact on the Member realm
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The row asks: a Member whose effective read lane contains the searched root
 * receives the match, and the product records EXACTLY ONE `allow` consultation
 * for the declared root, method `spawn`.
 *
 * The FACT REALM is reported, not assumed. BL-17 makes a binding-realm
 * `subprocess` face a composition-time refusal (`SUBPROCESS_UNCONFINED_REALM`),
 * and `ConfinedSubprocessRealmSpec` exposes no `toolBindingIdentity` field
 * (BL-16 §6.3(5)) — so the live answer for search is the MEMBER realm with
 * `toolBindingIdentity: null`. The judge accepts that answer and RECORDS it;
 * a reader who expected `realm:'binding'` sees the deviation explicitly rather
 * than a silent reinterpretation (see the README's row-1 section).
 *
 * @param {{result: object|null, facts?: object[], records?: object[], declaredRoot: string, needle: string, fileName: string}} sample
 */
export function judgeRow1(sample = {}) {
  const { result = null, facts = [], records = [], declaredRoot, needle, fileName } = sample
  const relevant = factsAt(facts, declaredRoot)
  const spawns = spawnRecords(records)
  const rowSpawns = spawns.filter((row) => argvHas(row, declaredRoot))
  if (result === null && relevant.length === 0 && rowSpawns.length === 0) {
    return notReached('NO_GREP_CALL_ROW1', { declaredRoot })
  }
  if (result === null) return notReached('NO_GREP_RESULT_ROW1', { declaredRoot, facts: relevant.length, spawns: rowSpawns.length })
  const allowFacts = relevant.filter((fact) => fact.decision === 'allow' && fact.method === SUBPROCESS_GUARD_METHOD)
  const denyFacts = relevant.filter((fact) => fact.decision === 'deny')
  const text = textOfResult(result)
  const checks = {
    resultNotError: result.isError === false,
    matchReturned: text.includes(String(needle)),
    fileNamed: text.includes(String(fileName)),
    exactlyOneAllowFact: allowFacts.length === 1,
    allowDecidedByALLOW: allowFacts.length === 1 && allowFacts[0].decidedBy === 'ALLOW',
    allowLocatorIsDeclaredRoot: allowFacts.length === 1 && norm(allowFacts[0].locator) === norm(declaredRoot),
    noDenyFactOnAdmittedRoot: denyFacts.length === 0,
    // The confined face is a SHADOW: a served in-lane call must not reach the
    // inherited base service (the hole GREP-PRE measures outside the realm).
    noBaseServiceSpawn: baseSpawnRecords(records).length === 0,
    exactlyOneProcess: rowSpawns.length === 1,
  }
  const fact = allowFacts.length === 1 ? allowFacts[0] : null
  return verdictOf({
    checks,
    provenReason: 'IN_LANE_GREP_ALLOWED_AND_CONFINED',
    refutedReason: 'ROW1_CLAUSE_FAILED',
    detail: {
      declaredRoot,
      result: { isError: result.isError ?? null, text: text.slice(0, 400) },
      factCount: relevant.length,
      allowFact: fact === null ? null : { realm: fact.realm, toolBindingIdentity: fact.toolBindingIdentity, method: fact.method, decision: fact.decision, decidedBy: fact.decidedBy, locator: fact.locator },
      factRealm: fact === null ? null : fact.realm,
      toolBindingIdentity: fact === null ? null : fact.toolBindingIdentity,
      confinedSpawns: rowSpawns.length,
      baseSpawns: baseSpawnRecords(records).length,
      note: 'the live search face is the MEMBER realm (BL-17 forbids a binding-realm subprocess face); the law asserted is the product\'s, the realm is reported',
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// row 2 — outside the CEILING: refused before any process, no bytes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The row asks: an out-of-lane search is refused BEFORE any process exists,
 * with exactly one typed deny fact for the declared root and ZERO bytes of the
 * forbidden file anywhere in the model-visible result.
 *
 * The `forbidden` list is compared against the WHOLE rendered result, not one
 * field: the launch failure path could echo stderr, and a substring check over
 * the rendered text is what "no bytes appear anywhere" means at this seam.
 *
 * @param {{result: object|null, facts?: object[], records?: object[], declaredRoot: string, forbidden: string[]}} sample
 */
export function judgeRow2(sample = {}) {
  const { result = null, facts = [], records = [], declaredRoot, forbidden = [] } = sample
  const relevant = factsAt(facts, declaredRoot)
  const spawns = spawnRecords(records).filter((row) => argvHas(row, declaredRoot))
  const baseSpawns = baseSpawnRecords(records).filter((row) => argvHas(row, declaredRoot))
  if (result === null && relevant.length === 0 && spawns.length === 0 && baseSpawns.length === 0) {
    return notReached('NO_GREP_CALL_ROW2', { declaredRoot })
  }
  if (result === null) return notReached('NO_GREP_RESULT_ROW2', { declaredRoot, facts: relevant.length })
  const text = textOfResult(result)
  const denyFacts = relevant.filter((fact) => fact.decision === 'deny')
  const allowFacts = relevant.filter((fact) => fact.decision === 'allow')
  const leaked = list(forbidden).filter((token) => text.includes(String(token)))
  const checks = {
    resultIsError: result.isError === true,
    exactlyOneDenyFact: denyFacts.length === 1,
    denyDecidedByReadDenied: denyFacts.length === 1 && denyFacts[0].decidedBy === READ_DENIED,
    denyLocatorIsDeclaredRoot: denyFacts.length === 1 && norm(denyFacts[0].locator) === norm(declaredRoot),
    noAllowFact: allowFacts.length === 0,
    noConfinedProcess: spawns.length === 0,
    noInheritedBaseProcess: baseSpawns.length === 0,
    noForbiddenBytes: leaked.length === 0,
  }
  const deny = denyFacts.length === 1 ? denyFacts[0] : null
  return verdictOf({
    checks,
    provenReason: 'OUT_OF_LANE_REFUSED_BEFORE_ANY_PROCESS',
    refutedReason: 'ROW2_CLAUSE_FAILED',
    detail: {
      declaredRoot,
      result: { isError: result.isError ?? null, text: text.slice(0, 400) },
      denyFact: deny === null ? null : { realm: deny.realm, toolBindingIdentity: deny.toolBindingIdentity, method: deny.method, decision: deny.decision, decidedBy: deny.decidedBy, locator: deny.locator },
      leakedTokens: leaked,
      confinedSpawns: spawns.length,
      baseSpawns: baseSpawns.length,
      factCount: relevant.length,
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// row 3 — inside the CEILING but outside the narrower RESTRICTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The row asks: the composed effective lane is `ceiling ∩ restriction`, so a
 * root the ceiling allows but the restriction excludes is refused at admission
 * with one deny fact — and the lane report proves the refusal is NOT a widening
 * (the effective lane never allows a locator the ceiling denies).
 *
 * PRECISE LIMIT (recorded, not papered over): the acceptance preset cannot
 * author a binding-scoped restriction for a search tool at this base. There is
 * no v3 blueprint field that compiles to a ToolBinding read restriction, and
 * BL-17 makes a binding-realm `subprocess` face a composition-time refusal.
 * The restriction is therefore COMPOSED by the evidence provider row through
 * the product's own algebra (the live counterpart of the host-free U3 arm, and
 * the same construction the P2-01 read acceptance used for its ceiling). The
 * judge measures the PRODUCT's admission answer on that composed lane and
 * reports `presetExpressesBindingRestriction: false` so the grade cannot be
 * read as "the preset can express this".
 *
 * @param {{result: object|null, facts?: object[], records?: object[], declaredRoot: string, forbidden: string[], laneReport: object|null}} sample
 */
export function judgeRow3(sample = {}) {
  const { result = null, facts = [], records = [], declaredRoot, forbidden = [], laneReport = null } = sample
  const relevant = factsAt(facts, declaredRoot)
  const spawns = spawnRecords(records).filter((row) => argvHas(row, declaredRoot))
  const baseSpawns = baseSpawnRecords(records).filter((row) => argvHas(row, declaredRoot))
  if (result === null && relevant.length === 0 && spawns.length === 0 && baseSpawns.length === 0) {
    return notReached('NO_GREP_CALL_ROW3', { declaredRoot })
  }
  if (result === null) return notReached('NO_GREP_RESULT_ROW3', { declaredRoot, facts: relevant.length })
  const probe = list(laneReport?.probePaths).find((entry) => norm(entry?.locator) === norm(declaredRoot)) ?? null
  if (probe === null) return notReached('NO_LANE_REPORT_ROW3', { declaredRoot, laneReport: laneReport === null ? null : 'present-without-this-probe' })
  const text = textOfResult(result)
  const denyFacts = relevant.filter((fact) => fact.decision === 'deny')
  const allowFacts = relevant.filter((fact) => fact.decision === 'allow')
  const leaked = list(forbidden).filter((token) => text.includes(String(token)))
  const checks = {
    // The row's PREMISE, measured by the product's own `matchLocator`: the
    // target is inside the ceiling, outside the restriction, so the effective
    // intersection must deny. A premise that did not hold is a REFUTATION of
    // the experiment, never a pass.
    premiseCeilingAllows: probe.ceilingRead === 'allow',
    premiseRestrictionDenies: probe.restrictionRead === 'deny',
    premiseEffectiveDenies: probe.effectiveRead === 'deny',
    noWidenedEffectiveDecision: probe.effectiveRead !== 'allow',
    resultIsError: result.isError === true,
    exactlyOneDenyFact: denyFacts.length === 1,
    denyDecidedByReadDenied: denyFacts.length === 1 && denyFacts[0].decidedBy === READ_DENIED,
    denyLocatorIsDeclaredRoot: denyFacts.length === 1 && norm(denyFacts[0].locator) === norm(declaredRoot),
    noAllowFact: allowFacts.length === 0,
    noConfinedProcess: spawns.length === 0,
    noInheritedBaseProcess: baseSpawns.length === 0,
    noForbiddenBytes: leaked.length === 0,
  }
  const deny = denyFacts.length === 1 ? denyFacts[0] : null
  return verdictOf({
    checks,
    provenReason: 'RESTRICTION_NARROWER_THAN_CEILING_REFUSED_AT_ADMISSION',
    refutedReason: 'ROW3_CLAUSE_FAILED',
    detail: {
      declaredRoot,
      laneProbe: probe,
      result: { isError: result.isError ?? null, text: text.slice(0, 400) },
      denyFact: deny === null ? null : { realm: deny.realm, method: deny.method, decision: deny.decision, decidedBy: deny.decidedBy, locator: deny.locator },
      leakedTokens: leaked,
      confinedSpawns: spawns.length,
      baseSpawns: baseSpawns.length,
      presetExpressesBindingRestriction: false,
      presetLimit: 'no v3 blueprint->compiled restriction bridge at this base (preflight §2); BL-17 refuses a binding-realm subprocess face, so the restriction is composed by the evidence provider row through the product algebra (the live U3 counterpart)',
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// row 4 — a cancelled search settles as cancelled
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The row asks: a search cancelled while its process is running does NOT come
 * back as success and does NOT come back as a fabricated "no matches". It
 * settles as cancelled.
 *
 * The cancellation path measured here is the product's own: the module forwards
 * the tool-call `exec.signal` into the confined `spawn`, the confined face's
 * abort listener terminates the child, and the module re-checks
 * `exec.signal.aborted` after the handle settles and throws `SEARCH_ABORTED`.
 * The TRIGGER (an HTTP route that calls the production row's public
 * `teamRoot.live.interrupt`, i.e. `agent.cancel({kind:'user'})`) is test
 * composition, exactly like the preflight's late-tool trigger; the cancellation
 * itself is the product's.
 *
 * Two settlement shapes are accepted, because a cancelled turn may die before
 * the tool result is delivered:
 *   (a) a delivered tool result that is an ERROR and whose text names the
 *       abort/cancellation (never a success, never "No matches found");
 *   (b) NO delivered tool result at all, with the turn definitively aborted
 *       (the interrupt was acknowledged AND the child was terminated by a
 *       signal). Form (b) is not weaker: it is the absence of any settlement
 *       as success, plus positive evidence the process was killed.
 *
 * @param {{result: object|null, facts?: object[], records?: object[], declaredRoot: string, needle: string, interrupt: object|null, transcriptAfterCall?: string}} sample
 */
export function judgeRow4(sample = {}) {
  const { result = null, facts = [], records = [], declaredRoot, needle, interrupt = null, transcriptAfterCall = '' } = sample
  const spawns = spawnRecords(records).filter((row) => argvHas(row, declaredRoot))
  const relevant = factsAt(facts, declaredRoot)
  if (spawns.length === 0 && result === null) {
    return notReached('NO_GREP_CALL_ROW4', { declaredRoot, facts: relevant.length })
  }
  if (spawns.length === 0) return notReached('NO_CONFINED_SPAWN_ROW4', { declaredRoot, result: { isError: result?.isError ?? null } })
  if (interrupt === null || interrupt === undefined) return notReached('NO_INTERRUPT_ROW4', { declaredRoot, spawns: spawns.length })
  const exit = exitRecords(records).find((row) => argvHas(row, declaredRoot)) ?? null
  const abortAcknowledged = interrupt.status === 200 && interrupt.ok === true
  // The launcher reports a payload killed by a signal as `code = 128 + signum`
  // with an EMPTY signal string (provider.ts, StreamingSpawnHandle.exited: "the
  // constructed 128+signum convention for a payload killed by a signal"). So both
  // the OS signal name (when the arm reports one) and the documented convention
  // count as "the child was terminated", and nothing else does.
  const SIGNAL_EXIT = new Map([[128 + 15, 'SIGTERM'], [128 + 9, 'SIGKILL'], [128 + 2, 'SIGINT']])
  const exitCode = exit === null ? null : Number(exit.code)
  const childTerminated = exit !== null
    && (((exit.signal !== null && exit.signal !== undefined && exit.signal !== ''))
      || (Number.isFinite(exitCode) && SIGNAL_EXIT.has(exitCode)))
  const delivered = result !== null && result !== undefined
  const settledAsError = delivered && result.isError === true
  const abortText = /(aborted|cancelled|canceled|SEARCH_ABORTED|tool call aborted)/iu
  const noMatchText = /no matches/iu
  const combined = `${textOfResult(result)}\n${String(transcriptAfterCall ?? '')}`
  const checks = {
    interruptAcknowledged: abortAcknowledged,
    confinedProcessExisted: spawns.length >= 1,
    childTerminatedBySignal: childTerminated,
    // (a) a delivered settlement must be an error that names the abort;
    // (b) an undelivered settlement is accepted ONLY with the positive
    //     termination evidence above, never as a silent green.
    settlementIsCancelled: delivered ? (settledAsError && abortText.test(textOfResult(result))) : childTerminated,
    noSuccessResult: !(delivered && result.isError === false),
    noFabricatedEmptyResult: !noMatchText.test(combined),
    noMatchBytesAfterCancel: needle === undefined || !combined.includes(String(needle)),
  }
  return verdictOf({
    checks,
    provenReason: delivered ? 'CANCELLED_SEARCH_SETTLED_AS_CANCELLED' : 'CANCELLED_SEARCH_ABORTED_WITH_KILLED_CHILD_NO_RESULT',
    refutedReason: 'ROW4_CLAUSE_FAILED',
    detail: {
      declaredRoot,
      delivered,
      result: delivered ? { isError: result.isError ?? null, text: textOfResult(result).slice(0, 300) } : null,
      interrupt: { status: interrupt.status ?? null, ok: interrupt.ok ?? null },
      childExit: exit === null ? null : { code: exit.code ?? null, signal: exit.signal ?? null },
      spawns: spawns.length,
      abortTextObserved: abortText.test(combined),
      note: 'the interrupt trigger is test composition calling the production row\'s public `teamRoot.live.interrupt`; the cancellation and the child termination are the product\'s',
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// row 5 — an invalid pattern is a TOOL ERROR, never "no matches"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The row asks: a pattern ripgrep rejects (exit 2) surfaces as a tool error and
 * is never presented as a successful empty result. This is the failure class
 * BL-16 pinned host-free (`GREP-EXIT2`); the live half asks the same question
 * through the Member's own tool call.
 *
 * The `exitCode === 2` clause is what makes the row discriminating: a tool that
 * swallowed exit 2 into "no matches" and one that mapped it to an error differ
 * by this record, not by the rendered prose.
 *
 * @param {{result: object|null, facts?: object[], records?: object[], declaredRoot: string, pattern: string}} sample
 */
export function judgeRow5(sample = {}) {
  const { result = null, facts = [], records = [], declaredRoot, pattern } = sample
  const spawns = spawnRecords(records).filter((row) => argvHas(row, declaredRoot))
  const relevant = factsAt(facts, declaredRoot)
  if (result === null && relevant.length === 0 && spawns.length === 0) {
    return notReached('NO_GREP_CALL_ROW5', { declaredRoot, pattern })
  }
  if (result === null) return notReached('NO_GREP_RESULT_ROW5', { declaredRoot, pattern })
  const text = textOfResult(result)
  const exit = exitRecords(records).find((row) => argvHas(row, declaredRoot)) ?? null
  const checks = {
    resultIsError: result.isError === true,
    notPresentedAsNoMatches: !/no matches/iu.test(text),
    // rg exit 2 is the invalid-pattern class; the record is the process's own
    // answer, not a string the module produced.
    processExitedTwo: exit !== null && Number(exit.code) === 2,
    admissionAllowedTheProcess: spawns.length >= 1,
    noAllowFactForAFailedSearch: relevant.every((fact) => fact.decision !== 'deny'),
  }
  return verdictOf({
    checks,
    provenReason: 'INVALID_PATTERN_SURFACED_AS_TOOL_ERROR',
    refutedReason: 'ROW5_CLAUSE_FAILED',
    detail: {
      declaredRoot,
      pattern,
      result: { isError: result.isError ?? null, text: text.slice(0, 400) },
      childExit: exit === null ? null : { code: exit.code ?? null, signal: exit.signal ?? null },
      spawns: spawns.length,
      facts: relevant.length,
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// row 6 — teardown: no callable shadow, no orphan, port and home gone
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The row asks, after the Member is stopped and the Host is killed:
 *   - the archive was ACCEPTED and the Member's lifecycle is no longer ACTIVE;
 *   - a post-stop dispatch of `grep` as that Member is refused (no callable
 *     shadow survives the stop), and it appends no `allow` fact;
 *   - NO fact carries an `observedAt` later than the stop instant (the sink is
 *     append-only; a count delta cannot express this);
 *   - no confined or inherited spawn happens after the stop;
 *   - the Host is dead, the port is released, the World home is deleted, and no
 *     process carrying the World's home/scratch identity survives;
 *   - no managed/native-shadow dispose fault is attributed to the stop.
 *
 * Post-stop probe dispatches are the row's own stimulus: they may be consulted
 * (and refused) but must never be SERVED. The temporal bound is judged over the
 * stop-time snapshot, and the probe facts are judged separately as refusals —
 * the boot-2 lesson from the P2-01 acceptance (a count delta refuted a clean
 * teardown).
 *
 * @param {object} sample
 */
export function judgeRow6(sample = {}) {
  const {
    member = null,
    archive = null,
    membersAfter = [],
    postStopDispatches = [],
    facts = [],
    probeFacts = [],
    stopInstant = null,
    observations = [],
    managed = {},
    duringManagedDisposal = false,
    managedRealmCount = 1,
    hostAlive = null,
    portStillListening = null,
    homeDeleted = null,
    orphanPids = [],
    confinedSpawnsAfterStop = [],
    baseSpawnsAfterStop = [],
  } = sample
  const memberSession = isBlank(member?.childSessionId) ? '' : member.childSessionId
  if (memberSession === '') return notReached('NO_MEMBER_TO_STOP')
  if (archive === null || archive === undefined) return notReached('NO_ARCHIVE_DISPATCH')
  if (archive.status !== 200 || archive.body?.ok !== true) {
    return Object.freeze({
      verdict: 'REFUTED',
      reason: 'ARCHIVE_REFUSED',
      failed: ['archiveAccepted'],
      checks: { archiveAccepted: false },
      detail: {
        archive: { status: archive.status ?? null, ok: archive.body?.ok ?? null, error: archive.body?.error ?? null },
        note: 'the archive dispatch was answered and the Member was not stopped; treating this as NOT_REACHED would hide a product refusal',
      },
    })
  }
  if (!Array.isArray(postStopDispatches) || postStopDispatches.length === 0) return notReached('NO_POST_STOP_DISPATCH')
  const stopMs = Date.parse(String(stopInstant ?? ''))
  if (!Number.isFinite(stopMs)) return notReached('NO_STOP_INSTANT', { stopInstant: stopInstant ?? null })
  const dated = list(facts).map((fact) => ({ fact, at: Date.parse(String(fact?.observedAt ?? '')) }))
  const undated = dated.filter((entry) => !Number.isFinite(entry.at))
  const afterStop = dated.filter((entry) => Number.isFinite(entry.at) && entry.at > stopMs)
  const identity = classifyDisposeFaults({ observations, managed, duringManagedDisposal, managedRealmCount })
  const successes = list(postStopDispatches).filter((reply) => reply !== null && reply !== undefined && reply.status === 200 && reply.body?.ok === true)
  const unexplained = list(postStopDispatches).filter((reply) => reply === null || reply === undefined
    || !(reply.status === 422 || (reply.status === 200 && reply.body?.ok === false) || reply.status === 500))
  const archived = list(membersAfter).some((entry) => String(entry?.templateId) === 'worker' && String(entry?.lifecycle) === 'ARCHIVED')
  const noActiveMember = list(membersAfter).every((entry) => String(entry?.instanceId) !== String(member.instanceId) || String(entry?.lifecycle) !== 'ACTIVE')
  const probes = list(probeFacts)
  const checks = {
    archivedLifecycle: archived,
    noActiveMemberLeft: noActiveMember,
    everyDispatchExplained: unexplained.length === 0,
    noSuccessAfterStop: successes.length === 0,
    noCallableShadow: successes.length === 0 && list(postStopDispatches).every((reply) => reply !== null && reply !== undefined),
    noManagedDisposeFault: identity.managed.length === 0,
    noUnattributedRealmFault: identity.unattributed.length === 0,
    factsAreTimestamped: undated.length === 0,
    noFactAfterStop: afterStop.length === 0,
    probeFactsAreRefusals: probes.length === 0 || probes.every((fact) => fact?.decision === 'deny'),
    noProcessAfterStop: list(confinedSpawnsAfterStop).length === 0 && list(baseSpawnsAfterStop).length === 0,
    hostDead: hostAlive === false,
    portReleased: portStillListening === false,
    homeDeleted: homeDeleted === true,
    noOrphanProcess: list(orphanPids).length === 0,
  }
  return verdictOf({
    checks,
    provenReason: 'NO_USABLE_CALLABLE_SHADOW_AFTER_STOP',
    refutedReason: 'ROW6_CLAUSE_FAILED',
    detail: {
      checks,
      identity,
      archive: { status: archive.status, ok: archive.body?.ok ?? null },
      stopInstant: String(stopInstant),
      factsObserved: list(facts).length,
      factsAfterStop: afterStop.map((entry) => ({ method: entry.fact?.method ?? null, locator: entry.fact?.locator ?? null, observedAt: entry.fact?.observedAt ?? null })),
      probeFactsObserved: probes.length,
      probeFacts: probes.map((fact) => ({ method: fact?.method ?? null, locator: fact?.locator ?? null, decision: fact?.decision ?? null, decidedBy: fact?.decidedBy ?? null })),
      postStop: list(postStopDispatches).map((reply) => (reply === null || reply === undefined
        ? null
        : { status: reply.status, ok: reply.body?.ok ?? null, code: reply.body?.error?.info?.code ?? reply.body?.code ?? null })),
      host: { hostAlive, portStillListening, homeDeleted },
      orphanPids: list(orphanPids),
      confinedSpawnsAfterStop: list(confinedSpawnsAfterStop).length,
      baseSpawnsAfterStop: list(baseSpawnsAfterStop).length,
    },
  })
}

/**
 * Dispatch a case id to its judge. ONE switch, so the driver cannot drift from
 * the tested contract and a new id fails loudly.
 *
 * @param {string} caseId one of {@link SEARCH_CASES}
 * @param {object} sample the evidence sample the driver collected
 */
export function judgeSearchRow(caseId, sample = {}) {
  switch (caseId) {
    case SEARCH_CASE_IDS.row1: return judgeRow1(sample)
    case SEARCH_CASE_IDS.row2: return judgeRow2(sample)
    case SEARCH_CASE_IDS.row3: return judgeRow3(sample)
    case SEARCH_CASE_IDS.row4: return judgeRow4(sample)
    case SEARCH_CASE_IDS.row5: return judgeRow5(sample)
    case SEARCH_CASE_IDS.row6: return judgeRow6(sample)
    default: throw new Error(`no search-live judge for ${JSON.stringify(caseId)} (known: ${SEARCH_CASES.join(', ')})`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// the PARTIAL-RUN contract: judge what was measured, and say why
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WHY a case has the verdict it has. The verdict alone cannot distinguish
 * "the product answered wrongly" from "this lane never got there", and the
 * 2026-11-04T19:17Z run paid for that: seven real facts were measured in
 * 400 ms, the run then aborted in the cancellation window, and the driver
 * turned every row into `FAIL / DRIVER_ABORTED` — throwing away observations
 * it had actually made. The correction is NOT "call a missing observation a
 * pass"; it is to keep the two statements separate:
 *
 *   judged          a COMPLETE sample was handed to the row's normal judge, so
 *                   the verdict is the judge's (PASS or FAIL), whatever the run
 *                   did afterwards;
 *   not-reached     the judge ran and its reachability predicate said no: the
 *                   observable was never produced (never a pass);
 *   driver-aborted  the run aborted before this case's evidence channel could
 *                   be complete; the absence belongs to the instrument, not to
 *                   the product, and the case is still NOT_REACHED.
 */
export const CASE_STATUS = Object.freeze({
  JUDGED: 'judged',
  NOT_REACHED: 'not-reached',
  DRIVER_ABORTED: 'driver-aborted',
})

/**
 * The evidence channels a row's claim needs BEFORE any judge has something to
 * judge. This is deliberately NOT "would the judge pass": a complete sample may
 * still refute the row (that is a FAIL, and it must be reported as one). What it
 * excludes is the absent-observable class, which may never become a PASS.
 *
 * Keep this in step with the reachability branch of the matching judge: the two
 * are tested together (see `a5sf-search-live.test.mjs`, "partial run" arms), so a
 * judge that starts needing a new channel fails host-free, not after a boot.
 *
 * @param {string} caseId one of {@link SEARCH_CASES}
 * @param {object|null} sample the sample the driver collected (may be null)
 * @returns {{complete: boolean, missing: string[]}}
 */
export function sampleCompleteness(caseId, sample = null) {
  const missing = []
  if (sample === null || sample === undefined) return Object.freeze({ complete: false, missing: Object.freeze(['sample']) })
  const present = (key) => sample[key] !== null && sample[key] !== undefined
  switch (caseId) {
    case SEARCH_CASE_IDS.row1:
      if (!present('result')) missing.push('result')
      break
    case SEARCH_CASE_IDS.row2:
      if (!present('result')) missing.push('result')
      break
    case SEARCH_CASE_IDS.row3:
      if (!present('result')) missing.push('result')
      if (!Array.isArray(sample.laneReport?.probePaths)) missing.push('laneReport')
      else if (!sample.laneReport.probePaths.some((entry) => norm(entry?.locator) === norm(sample.declaredRoot))) missing.push('laneReportProbe')
      break
    case SEARCH_CASE_IDS.row4:
      if (spawnRecords(sample.records).filter((row) => argvHas(row, sample.declaredRoot)).length === 0) missing.push('confinedSpawn')
      if (!present('interrupt')) missing.push('interrupt')
      break
    case SEARCH_CASE_IDS.row5:
      if (!present('result')) missing.push('result')
      break
    case SEARCH_CASE_IDS.row6:
      if (isBlank(sample.member?.childSessionId)) missing.push('member')
      if (!present('archive')) missing.push('archive')
      if (!Array.isArray(sample.postStopDispatches) || sample.postStopDispatches.length === 0) missing.push('postStopDispatch')
      if (!Number.isFinite(Date.parse(String(sample.stopInstant ?? '')))) missing.push('stopInstant')
      break
    default:
      throw new Error(`no search-live completeness rule for ${JSON.stringify(caseId)} (known: ${SEARCH_CASES.join(', ')})`)
  }
  return Object.freeze({ complete: missing.length === 0, missing: Object.freeze(missing) })
}

/**
 * Judge ONE case and record WHY, under either a completed or an aborted run.
 *
 * The three laws this encodes (each pinned by an arm in the suite):
 *   1. a COMPLETE sample after a later abort is still judged by the normal
 *      judge, and a PROVEN row reports PASS at the CASE level (the RUN stays
 *      FAIL — see {@link summarizeRun});
 *   2. an INCOMPLETE sample after an abort is NOT_REACHED, never PASS, and its
 *      status says `driver-aborted` because the absence is the instrument's;
 *   3. a COMPLETE sample with the WRONG bytes is FAIL, never PASS.
 *
 * @param {string} caseId one of {@link SEARCH_CASES}
 * @param {object|null} sample the evidence sample (or null when none was built)
 * @param {{abortedAt?: string|null, stage?: string|null}} [at] where/whether the run aborted
 */
export function judgeCase(caseId, sample = null, at = {}) {
  const abortedAt = at.abortedAt ?? null
  const stage = at.stage ?? null
  const completeness = sampleCompleteness(caseId, sample)
  if (!completeness.complete) {
    // An incomplete sample may still tell us the judge's own reachability answer
    // ("no call", "no lane report", …); it can never tell us the row passed.
    const judged = sample === null ? notReached('NO_SAMPLE') : judgeSearchRow(caseId, sample)
    return Object.freeze({
      id: caseId,
      verdict: 'NOT_REACHED',
      status: abortedAt === null ? CASE_STATUS.NOT_REACHED : CASE_STATUS.DRIVER_ABORTED,
      reason: judged.verdict === 'NOT_REACHED' ? judged.reason : 'INCOMPLETE_SAMPLE',
      judgeVerdict: judged.verdict,
      failed: Object.freeze([...(judged.failed ?? [])]),
      sampleComplete: false,
      missing: completeness.missing,
      abortedAt,
      stage,
      detail: { ...(judged.detail ?? {}), incompleteSample: true, missing: completeness.missing },
    })
  }
  const judged = judgeSearchRow(caseId, sample)
  return Object.freeze({
    id: caseId,
    verdict: toRunVerdict(judged.verdict),
    status: judged.verdict === 'NOT_REACHED'
      ? (abortedAt === null ? CASE_STATUS.NOT_REACHED : CASE_STATUS.DRIVER_ABORTED)
      : CASE_STATUS.JUDGED,
    reason: judged.reason,
    judgeVerdict: judged.verdict,
    failed: Object.freeze([...(judged.failed ?? [])]),
    sampleComplete: true,
    missing: Object.freeze([]),
    abortedAt,
    stage,
    detail: judged.detail ?? {},
  })
}

/**
 * The RUN-level fold. A case-level PASS is a statement about that CASE; it is
 * never a statement about the run. An aborted run is `FAIL` — unconditionally,
 * even when every case it did observe passed — and it says `partial: true` plus
 * which cases were never observed, so a reader cannot mistake a partial record
 * for a complete one.
 *
 * @param {object[]} cases case records from {@link judgeCase}
 * @param {{abortedAt?: string|null}} [at]
 */
export function summarizeRun(cases, at = {}) {
  const abortedAt = at.abortedAt ?? null
  const list = Array.isArray(cases) ? cases : []
  const folded = overallVerdict(list)
  const neverObserved = list.filter((entry) => entry.verdict === 'NOT_REACHED').map((entry) => entry.id)
  return Object.freeze({
    overall: abortedAt === null ? folded : 'FAIL',
    partial: abortedAt !== null,
    abortedAt,
    judged: list.filter((entry) => entry.status === CASE_STATUS.JUDGED).map((entry) => entry.id),
    passed: list.filter((entry) => entry.verdict === 'PASS').map((entry) => entry.id),
    neverObserved,
    note: abortedAt === null
      ? 'the run completed; overall is the worst case verdict'
      : 'the run aborted, so it is FAIL even where a complete sample passed: a case PASS is not a run PASS, and a NOT_REACHED case is never a pass',
  })
}

/**
 * The NEGATIVE CONTROL is not a Member row: it is the same out-of-lane search
 * executed UNCONFINED (on the anchor leader, before any Member realm exists).
 * It must SUCCEED and LEAK — otherwise row 2 is vacuous (a refusal that would
 * happen on any host proves nothing about the realm).
 *
 * It is judged separately so it can never be aggregated into the six rows.
 *
 * @param {{result: object|null, forbidden: string[], guardFactsBeforeRealm: object[], baseSpawns: object[], confinedSpawns: object[]}} sample
 */
export function judgeNegativeControl(sample = {}) {
  const { result = null, forbidden = [], guardFactsBeforeRealm = [], baseSpawns = [], confinedSpawns = [] } = sample
  if (result === null) return notReached('NO_UNCONFINED_CONTROL_CALL')
  const text = textOfResult(result)
  const leaked = list(forbidden).filter((token) => text.includes(String(token)))
  const checks = {
    controlSucceeded: result.isError === false,
    controlLeaked: leaked.length === list(forbidden).length && leaked.length > 0,
    unconfinedRanOnTheInheritedService: list(baseSpawns).length >= 1,
    noConfinedProcess: list(confinedSpawns).length === 0,
    noGuardFactBeforeRealm: guardFacts(list(guardFactsBeforeRealm)).length === 0,
  }
  return verdictOf({
    checks,
    provenReason: 'UNCONFINED_CONTROL_LEAKS',
    refutedReason: 'NEGATIVE_CONTROL_CLAUSE_FAILED',
    detail: {
      result: { isError: result.isError ?? null, text: text.slice(0, 400) },
      leakedTokens: leaked,
      baseSpawns: list(baseSpawns).length,
      confinedSpawns: list(confinedSpawns).length,
      guardFactsBeforeRealm: guardFacts(guardFactsBeforeRealm).length,
      note: 'this control is what makes row 2 discriminating: the SAME search leaks when nothing confines it',
    },
  })
}
