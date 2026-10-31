/**
 * Alpha.6 PR4′ — the defer store: the only mutable state in the lane, and the reason the lane can be
 * reasoned about at all.
 *
 * PROCESS-LOCAL ON PURPOSE. This is a `Map` in one Node process, built by whoever wires the plane — in the
 * intended wiring, one instance per team root in `root.ts`, handed to the gate and to the tool port by
 * reference. Nothing builds one today. It is not a ledger, not durable, and not replicated. The
 * consequence is stated rather than hidden: **a restart forgets every defer, and a forgotten defer produces an
 * early wake.** An early wake is a liveness event — the Leader looks at a case that is genuinely still pending
 * — while a lost wake is an authority event, because a case nobody is told about stops being reviewable. Every
 * possible failure of this store is therefore on the safe side of that line, and `a6-pr4-mutex-negative.test.ts`
 * asserts the ordering by emptying the store and requiring delivery.
 *
 * WHY THERE IS NO DURABLE VERSION YET. `review-assignment/index.ts` states the law for this phase's review
 * lanes: there is no sanctioned durable writer until PR-I1 supplies `allocateSequence()` + `put` behind the
 * team lock. Writing a defer row beside that seam would create the second ledger this phase forbids, and the
 * notification wrapper runs AFTER the control service released the team lock (`control/service.ts:2510-2513`),
 * so a defer committed there is an unlocked fresh read racing the very request that triggered it. A racing
 * defer loses, and loses safely: the notification goes out.
 *
 * SWEEP ON EVERY TOUCH. Expiry is evaluated against the caller's `nowIso` at every entry point — set, cancel,
 * decide, list — so an expired entry is indistinguishable from an absent one without anyone having to run a
 * reaper. There is no reaper, and there must not be one: a timer that wakes cases is the second scheduler this
 * phase already refused.
 *
 * NO CLOCK, NO I/O. Every function takes the instant it needs; the only time operation below is `Date.parse` on a
 * value the caller supplied, which is the same distinction `review-wake/slot.ts` draws when it floors a backoff
 * from `ctx.nowIso`. No `Date` is constructed here, so no read of the wall clock enters through this file. A
 * hygiene leg greps the lane for the direct spellings of that clock and of timers and I/O; it is a token screen,
 * so an alias would walk past it, and the leg's own comment says that out loud instead of letting this sentence
 * claim the screen is a proof (round-4 finding R4-4 on #509).
 */

import {
  REVIEW_DEFER_DEFAULT_LIMITS,
  REVIEW_DEFER_REASON_CODES,
  type ReviewDeferEntry,
  type ReviewDeferKey,
  type ReviewDeferLimits,
  type ReviewDeferReasonCode,
  type ReviewDeferRefusal,
  type ReviewDeferResult,
  type ReviewWakeCandidate,
} from './types.js'

/**
 * The platform's identifier shape, restated rather than imported. `review-assignment/types.ts` has the same
 * pattern, and importing it would put a dependency edge from PR4′ into PR2′'s lane — which is legal only if
 * PR2′'s dormancy ledger is amended to admit this consumer, and a wake gate that cannot be reviewed without
 * the assignment lane is a worse seam than one duplicated regular expression.
 */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

export interface ReviewDeferStore {
  readonly limits: ReviewDeferLimits
  readonly entries: Map<string, ReviewDeferEntry>
}

function accept<T>(value: T): ReviewDeferResult<T> {
  return { ok: true, value }
}

function refuse<T>(refusal: ReviewDeferRefusal, detail: string): ReviewDeferResult<T> {
  return { ok: false, refusal, detail }
}

/**
 * The single derivation of a store slot from a key. Exported because the gate reads the same slots the writer
 * writes, and a second copy of this expression in the gate would be a bug waiting to diverge: a gate that
 * computes a different slot than the tool writes never sees the defer, which fails open and therefore fails
 * silently. `a6-pr4-review-defer.test.ts` pins that a set and a decide agree on one key without going through
 * either caller.
 *
 * The root session id is part of the slot even though production creates one store per team root. A slot that
 * named only `(case, leg)` would make that containment the whole isolation story, so a store ever shared or
 * reused between roots would let a defer filed for one team session mute another.
 *
 * The segments are LENGTH-PREFIXED, and that is a fix rather than a style choice (round-1 finding F-6 on
 * #509): the id alphabet this lane accepts permits `:`, so a plain join would NOT be injective — root `a::b`
 * with case `c` and root `a` with case `b::c` produce the same string, which is a cross-root mute built out of
 * two legitimate ids. Minted ids never contain `:`, so nothing in this tree reaches it, but a claim of
 * "unrepresentable" has to survive the alphabet it states, and a length prefix makes it true for every input
 * the pattern accepts. `a6-pr4-review-defer.test.ts` pins the reviewer's collision pair to two distinct slots.
 */
export function reviewDeferEntryId(key: ReviewDeferKey): string {
  const segment = (value: string): string => `${String(value.length)}:${value}`
  return `${segment(key.rootSessionId)}|${segment(key.approvalCaseId)}#${String(key.legOrdinal)}`
}

function keyOf(key: ReviewDeferKey): string {
  return reviewDeferEntryId(key)
}

/** How many milliseconds an instant is from `nowIso`. Negative when it lies in the past, NaN when either side cannot be read. */
function deltaMs(nowIso: string, instantIso: string): number {
  return Date.parse(instantIso) - Date.parse(nowIso)
}

/**
 * Has this floor been reached? Unreadable on either side counts as REACHED.
 *
 * This is the fail-open law applied to the one comparison the lane makes, and it is the part the round-1
 * review proved the earlier version did not do: a NaN comparison is false, so a garbage floor used to answer
 * "defer" forever and an unreadable clock answered "defer" too — a quiet that cannot be read is a courtesy
 * nobody can honour, and the direction of the error was the forbidden one.
 */
export type ReviewDeferFloorState = 'pending' | 'passed' | 'unreadable'

/**
 * The ONE comparison this lane makes, in three states. `unreadable` means the floor, the caller's instant, or
 * both cannot be read as times; the answer it must produce is the fail-open one, and it is reported as itself
 * rather than folded into `passed`, because "the courtesy expired" and "the courtesy was illegible" are two
 * facts a reader of a log needs to tell apart.
 */
export function floorStateOf(nowIso: string, instantIso: string): ReviewDeferFloorState {
  const remaining = deltaMs(nowIso, instantIso)
  if (!Number.isFinite(remaining)) return 'unreadable'
  return remaining <= 0 ? 'passed' : 'pending'
}

function floorReached(nowIso: string, instantIso: string): boolean {
  return floorStateOf(nowIso, instantIso) !== 'pending'
}

/**
 * Derive the deferrable identity of a wake, or refuse with the reason it is not deferrable.
 *
 * The asymmetry is the point: a record without `approvalCaseId` is a perfectly ordinary pre-Alpha.4 row and
 * the gate must deliver it, so this function's refusal is NOT an error signal for a caller that is deciding
 * whether to notify. `decideReviewWake` therefore handles the unidentified case itself and only calls this for
 * rows that name a case.
 */
export function reviewDeferKeyOf(
  rootSessionId: string,
  candidate: ReviewWakeCandidate,
): ReviewDeferResult<ReviewDeferKey> {
  if (!isMintedId(rootSessionId) || !isMintedId(candidate.requestId)) {
    return refuse('REVIEW_DEFER_ID_MALFORMED', 'rootSessionId / requestId failed hygiene')
  }
  const caseId = candidate.approvalCaseId
  if (caseId === undefined || caseId === '') {
    return refuse('REVIEW_DEFER_CASE_UNIDENTIFIED', 'the record carries no approvalCaseId (pre-Alpha.4 row)')
  }
  if (!isMintedId(caseId)) {
    return refuse('REVIEW_DEFER_ID_MALFORMED', 'approvalCaseId failed hygiene')
  }
  const leg = candidate.legOrdinal
  if (typeof leg !== 'number' || !Number.isSafeInteger(leg) || leg < 1) {
    return refuse('REVIEW_DEFER_LEG_MALFORMED', `a case-scoped defer needs legOrdinal >= 1, got ${displayValue(leg)}`)
  }
  return accept(Object.freeze({ rootSessionId, approvalCaseId: caseId, legOrdinal: leg }))
}

/**
 * Create the one store a team root shares between its wake gate and whatever files quiets.
 *
 * In this PR nothing calls it from production: the lane ships dark until a wake source can re-fire (see law 6
 * in `types.ts`). When PR-I2 wires it, the rule this signature encodes is the one that matters — ONE store per
 * team root, handed by reference to both the gate and the tool port.
 */
export function createReviewDeferStore(limits: ReviewDeferLimits = REVIEW_DEFER_DEFAULT_LIMITS): ReviewDeferStore {
  // Round-4 finding R4-1 on #509: freezing the limits and handing out a live store object closed the value and
  // left the slot. `store.limits = { horizonMs: Infinity, maxEntries: Infinity }` did not throw, and because
  // every bound is read through `store.limits` at call time (see `setReviewDefer`), the replacement re-armed
  // R2-1 exactly — a probe against the built lane accepted a ten-year floor and filed 300 entries into a store
  // declared at one hour and sixty-four. Freezing the store closes that slot; the Map stays mutable, because
  // hydration and sweep mutate it and `Object.freeze` freezes references, not contents.
  return Object.freeze({
    limits: Object.freeze({ ...usableLimits(limits) }),
    entries: new Map<string, ReviewDeferEntry>(),
  })
}

/**
 * A limit that cannot bound anything is not a limit (round-2 finding R2-1 on #509).
 *
 * `NaN` and `Infinity` both disarm this lane's two stated bounds by arithmetic rather than by malice:
 * `remaining > NaN` is false, so every floor fits the horizon, and `size >= NaN` is false, so the capacity never
 * refuses — a probe against the shipped lane filed a ten-year floor and 300 entries into a store declared at one
 * hour and sixty-four. Nothing can reach that today, because nothing constructs a store; `createReviewDeferStore`
 * takes caller limits, and PR-I2 is exactly the change that will feed plane config into it. So each bound is
 * judged on its own and an unusable one falls back to the default FOR THAT FIELD. It is a substitution rather
 * than a throw on purpose: this lane's posture is that confusion produces an EXTRA wake, and a store that refuses
 * to exist is a store somebody will wrap in a `try` and then build unbounded.
 *
 * TWO CORRECTIONS FROM ROUND-3 REVIEW OF THIS FUNCTION ITSELF:
 *
 * (1) Per field, not per object. The first version replaced the WHOLE object, which silently LOOSENS the bound
 * that suppresses — `{horizonMs: 60_000, maxEntries: 2.5}` became a one-hour horizon because a *different* field
 * was unusable, a 60× longer silence than the operator configured, in the one direction this lane forbids.
 *
 * (2) `>= 0`, not `> 0`. Zero on either bound is not garbage, it is the safest configuration this lane can be
 * given: a zero horizon refuses every floor (`HORIZON_EXCEEDED`) and a zero cap refuses every new key
 * (`STORE_SATURATED`), so both mean "no quiets, ever" — pure fail-open. Rejecting it turned the safest setting
 * into a live 64-entry suppressing plane.
 *
 * A finite-but-absurd value (`horizonMs: 100 years`) is TRUSTED, and that is deliberate: it is a limit somebody
 * wrote down, and this lane has no authority to overrule plane policy — its authority is over garbage, not
 * choices. What is NOT trusted, after R3-1, is the caller's object: the store keeps a frozen COPY, because a
 * config object that is read, mutated and re-read is the normal shape of plane config, and validating at
 * construction while holding the caller's reference meant `myLimits.horizonMs = NaN` re-armed the exact bug this
 * function was written to close. Legs pin all of it, measured: per-field preservation, zero semantics, one read
 * per bound (a getter that changes its answer cannot diverge validation from capture), and — after R4-1 — a frozen
 * store object, because a frozen limit inside an unfrozen store is a bound somebody can swap out.
 */
function usableLimits(limits: ReviewDeferLimits): ReviewDeferLimits {
  // Round-4 finding R4-2 on #509: each bound was read THREE times — twice to validate, once to capture — so a
  // caller whose property is a getter could answer honestly on the validation reads and hand over `NaN` on the
  // capture read. The frozen copy then carried garbage INTO the disarmed state (a probe filed a ten-year floor
  // and 63 further entries), which inverts the rule this function exists for: honest garbage gets substituted,
  // lying garbage gets captured. Reading once and judging the captured value closes the divergence; a getter
  // that throws while being read is the same shape as a value this lane cannot read, so it substitutes too —
  // otherwise the sentence below about substitution rather than throwing is false for that shape.
  //
  // What no reading discipline can defend against is a getter that lies on the FIRST read; that is an active
  // attacker holding the config object, not confusion, and this lane has already decided (see the paragraph
  // above) that it arbitrates garbage rather than choices.
  const horizonMs = readBound(limits, 'horizonMs')
  const maxEntries = readBound(limits, 'maxEntries')
  return {
    horizonMs:
      typeof horizonMs === 'number' && Number.isFinite(horizonMs) && horizonMs >= 0
        ? horizonMs
        : REVIEW_DEFER_DEFAULT_LIMITS.horizonMs,
    maxEntries:
      typeof maxEntries === 'number' && Number.isInteger(maxEntries) && maxEntries >= 0
        ? maxEntries
        : REVIEW_DEFER_DEFAULT_LIMITS.maxEntries,
  }
}

/** One read of one configured bound; a throwing getter is an unreadable value, not an exception to forward. */
function readBound(limits: ReviewDeferLimits, field: keyof ReviewDeferLimits): unknown {
  try {
    return limits[field]
  } catch {
    return Number.NaN
  }
}

/**
 * What a caller handed over, safe to put inside a refusal.
 *
 * Round-4 finding R4-3 on #509: the R3-7 family survived in the one place R3-7 did not look — the refusal
 * MESSAGES. `${String(nowIso)}` on a value with a throwing `toString` turned the act of refusing into a thrown
 * `Error`, which is the same broken promise as R3-7 in a different sentence: a function whose whole contract is
 * "answers a refusal with the refusal, not with a thrown surprise" must not evaluate a caller-controlled
 * `toString` on the way out. Measured before the fix: `set`/`cancel` with such a clock both threw raw, leaving
 * the store intact but the caller with an exception. A non-string is named by its type instead, which is the
 * useful information anyway — nobody debugs a refuse-by-clock from a megabyte of interpolated object.
 */
function displayValue(value: unknown): string {
  return typeof value === 'string' ? value : `a ${typeof value}`
}

/**
 * A minted identifier, or nothing that resembles one.
 *
 * `ID_PATTERN.test` COERCES, and that is a defect rather than a subtlety (round-3 finding R3-7 on #509):
 * `test(undefined)` tests the string "undefined", which passes the pattern, and the value then reaches
 * `reviewDeferEntryId`'s length prefix and throws a `TypeError` out of a function whose whole contract is a
 * refusal; `test(42)` passes too, filing a quiet under a slot no legal string id can ever address. Both need a
 * value the types forbid, and the gate's catch kept every wake flowing — but PR-I2's tool arguments arrive from
 * JSON, which produces exactly these shapes. The instant validation below already does this correctly; the ids
 * were the last place in the lane that tested a pattern without testing the type.
 */
function isMintedId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

/**
 * Drop every entry whose floor has passed and report how many went. Called by every entry point, so the count
 * here is bookkeeping for the caller's telemetry rather than a housekeeping chore somebody must remember.
 */
export function sweepReviewDefers(store: ReviewDeferStore, nowIso: string): number {
  // An unreadable CALLER clock retires nothing (round-2 finding R2-2 on #509). The law is about an entry whose
  // FLOOR cannot be read — that one is deleted, because it can never be honoured. A clock that cannot be read is
  // the opposite case: deleting on it throws away every standing quiet on the strength of a value nobody can
  // verify, which is a read that destroys state. The wake path does not need this sweep to fail open —
  // `decideReviewWake` retires an illegible floor itself — so returning 0 here costs nothing and keeps `list`
  // honest: it reports what the store holds instead of emptying it.
  if (typeof nowIso !== 'string' || !Number.isFinite(Date.parse(nowIso))) return 0
  let swept = 0
  for (const [id, entry] of store.entries) {
    // An entry whose floor cannot be read is swept, not kept: keeping it would defer a wake on a value that
    // no caller can verify, which is the one thing a sweep is for.
    if (floorReached(nowIso, entry.notBeforeIso)) {
      store.entries.delete(id)
      swept += 1
    }
  }
  return swept
}

/**
 * File a defer, or explain why there is not one.
 *
 * Re-filing a key that already stands REPLACES its floor: the newest instruction from the Leader is the one
 * that should hold, and a lane that refused the second instruction would leave the first one muting a case
 * nobody asked about. Saturation is the opposite case — a new key when the store is full is refused rather
 * than made room for, because evicting a standing defer un-mutes a case somebody asked to have left alone,
 * and a surprise wake for the wrong case is the failure this lane exists to prevent.
 */
export function setReviewDefer(
  store: ReviewDeferStore,
  input: {
    readonly rootSessionId: string
    readonly approvalCaseId: string
    readonly legOrdinal: number
    readonly notBeforeIso: string
    readonly reasonCode: ReviewDeferReasonCode
  },
  nowIso: string,
): ReviewDeferResult<ReviewDeferEntry> {
  const key: ReviewDeferKey = {
    rootSessionId: input.rootSessionId,
    approvalCaseId: input.approvalCaseId,
    legOrdinal: input.legOrdinal,
  }
  if (!isMintedId(input.rootSessionId) || !isMintedId(input.approvalCaseId)) {
    return refuse('REVIEW_DEFER_ID_MALFORMED', 'rootSessionId / approvalCaseId failed hygiene')
  }
  if (!Number.isSafeInteger(key.legOrdinal) || key.legOrdinal < 1) {
    return refuse('REVIEW_DEFER_LEG_MALFORMED', `legOrdinal must be a safe integer >= 1, got ${displayValue(input.legOrdinal)}`)
  }
  if (typeof nowIso !== 'string' || Number.isNaN(Date.parse(nowIso))) {
    return refuse('REVIEW_DEFER_INSTANT_MALFORMED', `nowIso ${displayValue(nowIso)} does not parse`)
  }
  if (typeof input.notBeforeIso !== 'string' || Number.isNaN(Date.parse(input.notBeforeIso))) {
    return refuse('REVIEW_DEFER_INSTANT_MALFORMED', `notBeforeIso ${displayValue(input.notBeforeIso)} does not parse`)
  }
  if (!REVIEW_DEFER_REASON_CODES.includes(input.reasonCode)) {
    return refuse('REVIEW_DEFER_REASON_UNKNOWN', `unknown reason code ${displayValue(input.reasonCode)}`)
  }
  const remaining = deltaMs(nowIso, input.notBeforeIso)
  if (remaining <= 0) {
    return refuse('REVIEW_DEFER_NOT_IN_FUTURE', 'a floor at or before now defers nothing; cancel instead')
  }
  if (remaining > store.limits.horizonMs) {
    return refuse(
      'REVIEW_DEFER_HORIZON_EXCEEDED',
      `${String(remaining)}ms exceeds the ${String(store.limits.horizonMs)}ms horizon; the pending list is the path for a longer silence`,
    )
  }
  sweepReviewDefers(store, nowIso)
  const id = keyOf(key)
  if (!store.entries.has(id) && store.entries.size >= store.limits.maxEntries) {
    return refuse(
      'REVIEW_DEFER_STORE_SATURATED',
      `${String(store.entries.size)} defers standing at the cap; a standing defer is never evicted to admit another`,
    )
  }
  const entry: ReviewDeferEntry = Object.freeze({
    key,
    notBeforeIso: input.notBeforeIso,
    reasonCode: input.reasonCode,
    setAtIso: nowIso,
  })
  store.entries.set(id, entry)
  return accept(entry)
}

/**
 * Withdraw a defer. The answer is the entry that was standing, so a caller can report what it undid.
 *
 * A floor that has already passed is not a special case: the sweep runs first, so the honest answer is "there
 * is nothing standing", and the detail says which of the two the caller met. Conflating them would let a caller
 * report "your defer has been lifted" about a defer that had already lifted itself, which is the sort of
 * sentence that teaches an operator to trust a stale answer.
 */
export function cancelReviewDefer(
  store: ReviewDeferStore,
  key: ReviewDeferKey,
  nowIso: string,
): ReviewDeferResult<ReviewDeferEntry> {
  if (!isMintedId(key.rootSessionId) || !isMintedId(key.approvalCaseId)) {
    return refuse('REVIEW_DEFER_ID_MALFORMED', 'rootSessionId / approvalCaseId failed hygiene')
  }
  if (!Number.isSafeInteger(key.legOrdinal) || key.legOrdinal < 1) {
    return refuse('REVIEW_DEFER_LEG_MALFORMED', `legOrdinal must be a safe integer >= 1, got ${displayValue(key.legOrdinal)}`)
  }
  if (typeof nowIso !== 'string' || Number.isNaN(Date.parse(nowIso))) {
    return refuse('REVIEW_DEFER_INSTANT_MALFORMED', `nowIso ${displayValue(nowIso)} does not parse`)
  }
  const had = store.entries.get(keyOf(key))
  sweepReviewDefers(store, nowIso)
  const id = keyOf(key)
  const standing = store.entries.has(id) ? store.entries.get(id) : undefined
  if (standing === undefined) {
    return refuse(
      'REVIEW_DEFER_NO_ACTIVE_DEFER',
      had === undefined ? 'no defer is standing on this key' : 'the floor had already passed; the defer lifted itself',
    )
  }
  store.entries.delete(id)
  return accept(standing)
}

/** What is standing right now, in filing order. Read-only, and it sweeps on the way past. */
export function listReviewDefers(store: ReviewDeferStore, nowIso: string): readonly ReviewDeferEntry[] {
  // With a readable clock this returns exactly the standing quiets, because the sweep has just retired the rest.
  // With an unreadable clock it returns what the store holds, expired-looking entries included, and retires
  // nothing: "I cannot tell you which of these have passed" is a different answer from "you have none", and a
  // caller that gets the second one from a broken clock will conclude nobody asked for a quiet.
  //
  // THE ASYMMETRY THAT REMAINS, stated rather than left to be rediscovered (round-3 finding R3-9 on #509): under
  // an unreadable clock `list` reports an expired quiet as standing while `decideReviewWake` delivers and retires
  // it, so the two disagree — over-reporting a silence, never inventing one, and both sides fail open. Removing
  // it properly means giving `list` a `ReviewDeferResult` so it can say "unreadable clock" instead of picking an
  // answer; that is an API change for the PR that has a caller, so it is booked with PR-I2 rather than made here
  // in the dark. A tool reading this list must not conclude "your quiet stands" without a readable clock.
  sweepReviewDefers(store, nowIso)
  return [...store.entries.values()]
}
