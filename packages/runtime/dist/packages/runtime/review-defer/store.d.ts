/**
 * Alpha.6 PR4′ — the defer store: the only mutable state in the lane, and the reason the lane can be
 * reasoned about at all.
 *
 * PROCESS-LOCAL ON PURPOSE. This is a `Map` in one Node process, created once per team root in `root.ts` and
 * shared with the tool factory as an injected port. It is not a ledger, not durable, and not replicated. The
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
 * NO CLOCK, NO I/O. Every function takes the instant it needs. `Date.parse` and `new Date(n).toISOString()`
 * appear below; both are pure arithmetic on a supplied value, which is the same distinction `review-wake/slot.ts`
 * draws when it floors a backoff from `ctx.nowIso`.
 */
import { type ReviewDeferEntry, type ReviewDeferKey, type ReviewDeferLimits, type ReviewDeferReasonCode, type ReviewDeferResult, type ReviewWakeCandidate } from './types.js';
export interface ReviewDeferStore {
    readonly limits: ReviewDeferLimits;
    readonly entries: Map<string, ReviewDeferEntry>;
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
 * reused between roots would let a defer filed for one team session mute another. The id makes that
 * unrepresentable instead of merely unintended.
 */
export declare function reviewDeferEntryId(key: ReviewDeferKey): string;
/**
 * Derive the deferrable identity of a wake, or refuse with the reason it is not deferrable.
 *
 * The asymmetry is the point: a record without `approvalCaseId` is a perfectly ordinary pre-Alpha.4 row and
 * the gate must deliver it, so this function's refusal is NOT an error signal for a caller that is deciding
 * whether to notify. `decideReviewWake` therefore handles the unidentified case itself and only calls this for
 * rows that name a case.
 */
export declare function reviewDeferKeyOf(rootSessionId: string, candidate: ReviewWakeCandidate): ReviewDeferResult<ReviewDeferKey>;
/** Create the one store a team root shares between its wake gate and its tool. */
export declare function createReviewDeferStore(limits?: ReviewDeferLimits): ReviewDeferStore;
/**
 * Drop every entry whose floor has passed and report how many went. Called by every entry point, so the count
 * here is bookkeeping for the caller's telemetry rather than a housekeeping chore somebody must remember.
 */
export declare function sweepReviewDefers(store: ReviewDeferStore, nowIso: string): number;
/**
 * File a defer, or explain why there is not one.
 *
 * Re-filing a key that already stands REPLACES its floor: the newest instruction from the Leader is the one
 * that should hold, and a lane that refused the second instruction would leave the first one muting a case
 * nobody asked about. Saturation is the opposite case — a new key when the store is full is refused rather
 * than made room for, because evicting a standing defer un-mutes a case somebody asked to have left alone,
 * and a surprise wake for the wrong case is the failure this lane exists to prevent.
 */
export declare function setReviewDefer(store: ReviewDeferStore, input: {
    readonly rootSessionId: string;
    readonly approvalCaseId: string;
    readonly legOrdinal: number;
    readonly notBeforeIso: string;
    readonly reasonCode: ReviewDeferReasonCode;
}, nowIso: string): ReviewDeferResult<ReviewDeferEntry>;
/**
 * Withdraw a defer. The answer is the entry that was standing, so a caller can report what it undid.
 *
 * A floor that has already passed is not a special case: the sweep runs first, so the honest answer is "there
 * is nothing standing", and the detail says which of the two the caller met. Conflating them would let a caller
 * report "your defer has been lifted" about a defer that had already lifted itself, which is the sort of
 * sentence that teaches an operator to trust a stale answer.
 */
export declare function cancelReviewDefer(store: ReviewDeferStore, key: ReviewDeferKey, nowIso: string): ReviewDeferResult<ReviewDeferEntry>;
/** What is standing right now, in filing order. Read-only, and it sweeps on the way past. */
export declare function listReviewDefers(store: ReviewDeferStore, nowIso: string): readonly ReviewDeferEntry[];
//# sourceMappingURL=store.d.ts.map