/**
 * Alpha.6 PR4′ — the review-wake defer lane: types and vocabulary.
 *
 * WHAT THIS LANE IS. A pre-kernel gate that answers one question about one wake: *deliver this Leader
 * notification now, or hold it until a floor instant has passed*. It exists because the wake trigger is
 * unconditional — `packages/runtime/control/service.ts:2535` calls the notification port for every created
 * `leader-approval` request, and the real deliverer
 * (`packages/runtime/src/plugin/live/agent-bindings.mjs`, `deliverRootControlNotification`) documents itself
 * as "at-least-once — NO dedupe here". A Team that has switched the plane flag on can therefore say "do not
 * wake the Leader about this case until T", and every failure mode is an EXTRA wake rather than a lost one.
 *
 * WHAT THIS LANE IS NOT, stated in the order the mistakes would be made:
 *
 *  1. **Not a scheduler, and no replay — ever.** Nothing here wakes anybody. A defer raises a floor on a wake
 *     that would otherwise happen anyway: it declines the wakes that arrive WHILE IT STANDS and it never
 *     re-delivers a wake that already fired. Re-arming a wake at the floor is the wake kernel's job (PR-I2),
 *     and a lane that re-fired a notification itself would be a second scheduler wearing a smaller hat. There is no timer, no
 *     queue, no retry loop, and no wall-clock timer scheduled from this directory, because a second scheduler driving review
 *     wakes would be a second scheduler, and the single scheduler is a phase law.
 *  2. **Not a second approval ledger.** A defer row stores a case id, a leg ordinal, an instant and a reason
 *     code. It stores no decision, no authority, no EffectSet and no grant, and it is not durable: it lives
 *     in one process's memory and is gone on restart. The authoritative record of what is pending remains the
 *     control-request pending list, and the authoritative record of what was decided remains the one
 *     ControlService write path. If a defer is ever made durable it must be booked through that path, not
 *     beside it.
 *  3. **Not a dedupe.** "The same wake" is not a concept this lane owns; the wake kernel owns it, and the
 *     kernel is not even reachable from here (see the import law in `a6-pr4-lane-hygiene.test.ts`). The lane
 *     suppresses a delivery, not a wake, and it never claims a wake was delivered exactly once.
 *  4. **Not the mutex.** PR-I2 owns the one chooser between this notifier and the real
 *     `deliverReviewWake`. THIS PR BUILDS NO CHOOSER: nothing in `packages/runtime/src` or `packages/tools`
 *     imports this lane (a hygiene leg walks it from disk), because a switch wired to a wake source that
 *     cannot re-fire is a control that does nothing — the round-1 blocker on #509. `root.ts` is named in this
 *     lane's docs as the intended single consumer and the negative legs in
 *     `a6-pr4-mutex-negative.test.ts` exist so that when the wiring arrives it arrives once.
 *  5. **Not an authority.** Refusals here refuse an *operation on a defer*, never a review, and a decision
 *     here never approves or denies anything. A suppressed notification leaves the request exactly as it was:
 *     pending, visible in the pending list, and answerable.
 *  6. **WHAT A QUIET CAN SUPPRESS TODAY, stated exactly (the round-1 blocker on #509, verified in the kernel).**
 *     The notification port has ONE caller, `control/service.ts:2536`, and it fires only when
 *     `outcome.created` is true. An idempotent retry returns the existing row and the kernel says so in its own
 *     comment — "An existing row NEVER re-notifies … the pending-list tool is the recovery path" — a risen leg
 *     is deliberately never notified (`control/leader-notification.ts`, "WHY NO NOTIFICATION EXISTS FOR A RISEN
 *     LEG"), and `approvalCaseId` is minted at creation from the request's correlation identity. So in this
 *     tree a quiet can never be standing on a key before that key's only wake has already fired: **a quiet
 *     filed today suppresses nothing.** That is why this PR ships the lane dark and ships NO model-facing
 *     tool: a `team_review_defer` that answered `accepted: true` while suppressing zero wakes would be a tool
 *     whose result is a lie, and a model would change its behaviour on it. The tool, the plane flag and the
 *     `root.ts` wiring belong in the change that supplies the re-firing wake source (PR-I2's
 *     `deliverReviewWake`), where "held until T" becomes observable — and until then the pending list stays the
 *     recovery path, which is the kernel's own law rather than this lane's invention.
 *
 * WHY THE KEY IS `(approvalCaseId, legOrdinal)` AND WHY A CASE-LESS ROW IS NEVER DEFERRED. The record that
 * reaches the notification port is a `ControlRequestRecord`; its `approvalCaseId` is documented as "Present ⇒
 * the row is an Alpha.4 LEG row", so its ABSENCE means the old path. Suppressing a wake we cannot attribute to
 * a case would mean a defer set for one case could silence another, and the lane's whole justification is
 * that it only ever silences the thing it was pointed at. So an unidentified wake is delivered, always — the
 * same answer the pre-Alpha.6 code gives, which is also what keeps every Team that has not opted in
 * byte-identical.
 *
 * THE IMPORT LAW. This directory imports nothing but its own siblings (and `node`-free types from
 * `../../contracts/src/index.js` when it needs one). It does NOT reach into the control lane's own type module, even though
 * `ControlRequestRecord` is the input in practice: `packages/runtime/control/` is inside the ARC-A protected
 * centre, and a lane that depends on the protected centre cannot be reviewed as a separate seam. The record is
 * therefore described structurally by `ReviewWakeCandidate` below, and a leg in the mutex spec proves that a
 * real `ControlRequestRecord` is assignable to it — the compatibility is asserted, not assumed.
 */

// --- identity -----------------------------------------------------------------------------------------

/**
 * The part of a control-request record this lane is allowed to know about. Structural on purpose (see the
 * import law in the module doc): the real producer is `ControlRequestRecord`, and `approvalCaseId` being
 * absent is load-bearing, so it is optional here rather than defaulted.
 */
export interface ReviewWakeCandidate {
  readonly requestId: string
  readonly rootSessionId: string
  /** Absent on a pre-Alpha.4 row. Absent ⇒ never deferred. */
  readonly approvalCaseId?: string | undefined
  /** Absent together with a case id on a malformed row; a defer needs the leg as well as the case. */
  readonly legOrdinal?: number | undefined
}

/** The addressable identity a defer is filed against: one leg of one case. */
export interface ReviewDeferKey {
  readonly rootSessionId: string
  readonly approvalCaseId: string
  readonly legOrdinal: number
}

// --- decisions ----------------------------------------------------------------------------------------

/**
 * The two answers the gate gives. There is no third: "drop the wake" is not an option, because dropping a
 * notification with nothing scheduled to replace it turns a liveness signal into a silent case. `defer`
 * means *this delivery is skipped*; the request stays pending and stays visible.
 */
export const REVIEW_DEFER_DECISIONS = ['deliver', 'defer'] as const

export type ReviewDeferDecisionKind = (typeof REVIEW_DEFER_DECISIONS)[number]

/**
 * Why a gate answered the way it did. Closed, and every member is produced — the reachability leg in
 * `a6-pr4-review-defer.test.ts` checks both directions, because a code no path can produce is a lie about
 * the machine and a produced code that is undeclared is the same lie sideways.
 */
export const REVIEW_DEFER_WAKE_REASONS = [
  /** No defer is standing on this key. The ordinary answer, and the only answer in a Team that never opted in. */
  'WAKE_NOT_DEFERRED',
  /** A defer existed and its floor has passed: deliver, and retire the defer while we are here. */
  'WAKE_DEFER_FLOOR_PASSED',
  /** A defer is standing on this key with a floor in the future: decline this delivery, nothing more. */
  'WAKE_DEFER_PENDING',
  /**
   * A defer is standing but a time involved cannot be read — its own floor, or the instant the caller was
   * given. Delivering is the fail-open answer, and it gets its OWN reason so that "the plan expired" and
   * "the plan was unreadable" are never reported as the same fact by a metric that cannot tell them apart.
   */
  'WAKE_DEFER_UNREADABLE',
  /** The decision itself could not be computed. Deliver, and say so: a fail-open path nobody can see is a
   *  fail-open path nobody fixes. */
  'WAKE_DECISION_FAILED',
  /** The record carries no readable case. Deliver — the old path — because an unattributable wake is nobody's
   *  to mute. "No readable case" rather than "names no case": a case id that is present but not an id the
   *  platform would mint lands here too, and the sentence has to cover that. */
  'WAKE_CASE_UNIDENTIFIED',
  /** A case IS named and the leg is not. Attributable enough to notice, not attributable enough to mute. */
  'WAKE_LEG_UNIDENTIFIED',
] as const

export type ReviewDeferWakeReason = (typeof REVIEW_DEFER_WAKE_REASONS)[number]

export interface ReviewDeferWakeDecision {
  readonly decision: ReviewDeferDecisionKind
  readonly reason: ReviewDeferWakeReason
  /** The standing floor, when there was one. Carried so a caller can log or re-arm without a second read. */
  readonly notBeforeIso: string | null
  /** The key the decision was taken for, or null for an unidentifiable wake. */
  readonly key: ReviewDeferKey | null
}

// --- refusals -----------------------------------------------------------------------------------------

/**
 * Every refusal this lane can answer with. A refusal refuses an *operation on a defer* — setting one,
 * cancelling one, reading one. It never refuses a review, a wake, or a decision, and nothing in this list
 * is a permission denial: the only enforcement in this lane is the enforcement of its own input contract.
 */
export const REVIEW_DEFER_REFUSALS = [
  /** A root session id, case id or request id that is not the shape the platform uses. */
  'REVIEW_DEFER_ID_MALFORMED',
  /** `legOrdinal` missing, negative, or not a safe integer. */
  'REVIEW_DEFER_LEG_MALFORMED',
  /**
   * An instant that is not an ISO string that parses. Nothing here accepts a millisecond number: two ways to
   * say a time is two ways to disagree about one.
   */
  'REVIEW_DEFER_INSTANT_MALFORMED',
  /**
   * A reason code outside `REVIEW_DEFER_REASON_CODES`. It is NOT an instant problem: the caller's instant may
   * be perfect and its reason nonsense, and a refusal that blamed the clock would send whoever read the log to
   * the wrong file. (Round-1 finding F-5 on #509.)
   */
  'REVIEW_DEFER_REASON_UNKNOWN',
  /** A floor at or before the caller's `nowIso`. "Defer until the past" means "do not defer", and a lane */
  /** that silently accepted it would report a defer that suppresses nothing. */
  'REVIEW_DEFER_NOT_IN_FUTURE',
  /** A floor beyond the plane's horizon. A Leader can be kept away from a case for a bounded time only. */
  'REVIEW_DEFER_HORIZON_EXCEEDED',
  /**
   * A cancel naming a key with nothing standing on it. Expiry is not a second answer — the sweep runs first,
   * so a floor that has passed is simply gone, and the detail says which of the two the caller met.
   */
  'REVIEW_DEFER_NO_ACTIVE_DEFER',
  /**
   * The store is at capacity. Refusing a NEW defer is the only honest overflow: evicting a standing defer to
   * make room would silently un-mute a case somebody asked to have left alone.
   */
  'REVIEW_DEFER_STORE_SATURATED',
  /**
   * A wake with no `approvalCaseId`: not an error, but not deferrable either. Reported so a caller never
   * concludes "deferred" from the absence of a delivered notification.
   */
  'REVIEW_DEFER_CASE_UNIDENTIFIED',
] as const

export type ReviewDeferRefusal = (typeof REVIEW_DEFER_REFUSALS)[number]

export type ReviewDeferResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly refusal: ReviewDeferRefusal; readonly detail: string }

// --- the durable-enough shape -------------------------------------------------------------------------

/** Why a defer was filed. Closed, because a free-text reason is where a policy engine hides. */
export const REVIEW_DEFER_REASON_CODES = [
  /** The plan the case would be reviewed under is not in force yet. */
  'PLAN_NOT_IN_FORCE',
  /** The mandated reviewer instance is not reachable right now; a wake would only be refused on arrival. */
  'OFFICER_UNAVAILABLE',
  /** The case's own evidence is expected to change before the floor. */
  'AWAITING_EVIDENCE',
  /** The Leader asked for the quiet directly, through the tool that PR-I2 will mount. */
  'LEADER_REQUESTED',
] as const

export type ReviewDeferReasonCode = (typeof REVIEW_DEFER_REASON_CODES)[number]

/** One standing defer. Flat scalars only, so a future durable booking is a copy, not a redesign. */
export interface ReviewDeferEntry {
  readonly key: ReviewDeferKey
  /** When the floor passes. Strictly after the `nowIso` that filed it. */
  readonly notBeforeIso: string
  readonly reasonCode: ReviewDeferReasonCode
  /** The `nowIso` that filed it, recorded rather than read: nothing in this lane owns a clock. */
  readonly setAtIso: string
}

export interface ReviewDeferLimits {
  /** Longest floor the plane will honour, in milliseconds from the filing instant. */
  readonly horizonMs: number
  /** Most defers standing at once. Oldest-expiry entries are NOT evicted to make room; see the refusal. */
  readonly maxEntries: number
}

// Frozen, unlike the closed lists above: this object is handed out BY REFERENCE as the default for every store
// the plane builds, so a mutation of one caller's horizon would silently become every store's horizon. The
// vocabulary lists follow the repository convention instead (`as const` in `review-mandate` and `review-wake`),
// where readonly is enforced on TypeScript consumers; the values that cross this lane's boundary — keys,
// entries, decisions — are frozen at runtime, which is where a mutated value could be mistaken for a decision.
export const REVIEW_DEFER_DEFAULT_LIMITS: ReviewDeferLimits = Object.freeze({
  // One hour: long enough to cover a plan epoch rolling or an officer finishing a turn, short enough that a
  // forgotten defer cannot strand a case for a working day. The control-plane pending list remains the
  // recovery path for anything longer, which is the point — this is a courtesy to the Leader's attention,
  // not a queue.
  horizonMs: 60 * 60 * 1000,
  // One per leg of one case at a time, and a Team's review cases are bounded by its own quotas; 64 is well
  // past any legitimate shape and small enough that a runaway writer cannot grow the map without bound.
  maxEntries: 64,
})
