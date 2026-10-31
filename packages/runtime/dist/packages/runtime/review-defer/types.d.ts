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
/**
 * The part of a control-request record this lane is allowed to know about. Structural on purpose (see the
 * import law in the module doc): the real producer is `ControlRequestRecord`, and `approvalCaseId` being
 * absent is load-bearing, so it is optional here rather than defaulted.
 */
export interface ReviewWakeCandidate {
    readonly requestId: string;
    readonly rootSessionId: string;
    /** Absent on a pre-Alpha.4 row. Absent ⇒ never deferred. */
    readonly approvalCaseId?: string | undefined;
    /** Absent together with a case id on a malformed row; a defer needs the leg as well as the case. */
    readonly legOrdinal?: number | undefined;
}
/** The addressable identity a defer is filed against: one leg of one case. */
export interface ReviewDeferKey {
    readonly rootSessionId: string;
    readonly approvalCaseId: string;
    readonly legOrdinal: number;
}
/**
 * The two answers the gate gives. There is no third: "drop the wake" is not an option, because dropping a
 * notification with nothing scheduled to replace it turns a liveness signal into a silent case. `defer`
 * means *this delivery is skipped*; the request stays pending and stays visible.
 */
export declare const REVIEW_DEFER_DECISIONS: readonly ["deliver", "defer"];
export type ReviewDeferDecisionKind = (typeof REVIEW_DEFER_DECISIONS)[number];
/**
 * Why a gate answered the way it did. Closed, and every member is produced — the reachability leg in
 * `a6-pr4-review-defer.test.ts` checks both directions, because a code no path can produce is a lie about
 * the machine and a produced code that is undeclared is the same lie sideways.
 */
export declare const REVIEW_DEFER_WAKE_REASONS: readonly ["WAKE_NOT_DEFERRED", "WAKE_DEFER_FLOOR_PASSED", "WAKE_DEFER_PENDING", "WAKE_DEFER_UNREADABLE", "WAKE_DECISION_FAILED", "WAKE_CASE_UNIDENTIFIED", "WAKE_LEG_UNIDENTIFIED"];
export type ReviewDeferWakeReason = (typeof REVIEW_DEFER_WAKE_REASONS)[number];
export interface ReviewDeferWakeDecision {
    readonly decision: ReviewDeferDecisionKind;
    readonly reason: ReviewDeferWakeReason;
    /** The standing floor, when there was one. Carried so a caller can log or re-arm without a second read. */
    readonly notBeforeIso: string | null;
    /** The key the decision was taken for, or null for an unidentifiable wake. */
    readonly key: ReviewDeferKey | null;
}
/**
 * Every refusal this lane can answer with. A refusal refuses an *operation on a defer* — setting one,
 * cancelling one, reading one. It never refuses a review, a wake, or a decision, and nothing in this list
 * is a permission denial: the only enforcement in this lane is the enforcement of its own input contract.
 */
export declare const REVIEW_DEFER_REFUSALS: readonly ["REVIEW_DEFER_ID_MALFORMED", "REVIEW_DEFER_LEG_MALFORMED", "REVIEW_DEFER_INSTANT_MALFORMED", "REVIEW_DEFER_REASON_UNKNOWN", "REVIEW_DEFER_NOT_IN_FUTURE", "REVIEW_DEFER_HORIZON_EXCEEDED", "REVIEW_DEFER_NO_ACTIVE_DEFER", "REVIEW_DEFER_STORE_SATURATED", "REVIEW_DEFER_CASE_UNIDENTIFIED"];
export type ReviewDeferRefusal = (typeof REVIEW_DEFER_REFUSALS)[number];
export type ReviewDeferResult<T> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly refusal: ReviewDeferRefusal;
    readonly detail: string;
};
/** Why a defer was filed. Closed, because a free-text reason is where a policy engine hides. */
export declare const REVIEW_DEFER_REASON_CODES: readonly ["PLAN_NOT_IN_FORCE", "OFFICER_UNAVAILABLE", "AWAITING_EVIDENCE", "LEADER_REQUESTED"];
export type ReviewDeferReasonCode = (typeof REVIEW_DEFER_REASON_CODES)[number];
/** One standing defer. Flat scalars only, so a future durable booking is a copy, not a redesign. */
export interface ReviewDeferEntry {
    readonly key: ReviewDeferKey;
    /** When the floor passes. Strictly after the `nowIso` that filed it. */
    readonly notBeforeIso: string;
    readonly reasonCode: ReviewDeferReasonCode;
    /** The `nowIso` that filed it, recorded rather than read: nothing in this lane owns a clock. */
    readonly setAtIso: string;
}
export interface ReviewDeferLimits {
    /** Longest floor the plane will honour, in milliseconds from the filing instant. */
    readonly horizonMs: number;
    /** Most defers standing at once. Oldest-expiry entries are NOT evicted to make room; see the refusal. */
    readonly maxEntries: number;
}
export declare const REVIEW_DEFER_DEFAULT_LIMITS: ReviewDeferLimits;
//# sourceMappingURL=types.d.ts.map