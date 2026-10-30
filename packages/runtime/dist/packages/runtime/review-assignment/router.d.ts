/**
 * Alpha.6 PR2′ (Lane 2) — the deterministic review router.
 *
 * WHAT THIS DECIDES: for one case that needs the `leader` rung, whether a bound Approval Officer is the
 * one to look at it, or whether the case stays with the Leader. That is the whole job. It does not
 * decide whether anything is allowed, and PR #319 §7 is explicit about the direction of the failure:
 * 未知/失配/证据不充分时交由 Leader 或合法 Human 路径，绝不对未知资源授予普通 Reviewer 审批能力.
 *
 * THE PROPERTY THAT MATTERS MOST, and the reason this file calls into PR0 rather than re-implementing a
 * check of its own: **the router is never wider than the admission gate.** A case is routed to an
 * instance only if PR0's `evaluateReviewAdmission` would admit that same instance for that same case,
 * plan and mandate, at the epoch and instant supplied. Routing therefore cannot anticipate,
 * pre-empt or smuggle an admission — the strongest statement this lane can make without touching the
 * write path, and it is pinned by a leg that runs adversarial inputs through BOTH functions.
 *
 * Determinism (A-4): the plan binds exactly one officer (`ReviewPlan.reviewerInstanceId` — "Exactly one
 * in Alpha.6"), so there is never a choice between candidates to be clever about. Same inputs in, same
 * decision out, byte for byte; no clock read here, no scoring, no recency, no load. Where the router
 * cannot proceed it says which of its twelve reasons applies, so a mis-routed team is diagnosable from
 * the reason code alone.
 *
 * THE LAW ABOUT HANDOFFS, which is this file's most important non-obvious branch: once a case has been
 * handed off to the Leader, a later wake does NOT pull it back to the Officer. A handoff is a decision
 * that the Leader's global information is needed (PR #319 §7); the router has no basis to overrule it,
 * and re-stealing the case on the next event would silently reverse a coordination decision the Leader
 * made. `LEADER_TOOK_OVER` keeps it.
 */
import { type ReviewCaseView, type ReviewMandate, type ReviewPlan } from '../review-mandate/index.js';
import { type ReviewAssignmentResult, type ReviewAssignmentState, type ReviewRoutingDecision, type ReviewerCandidate } from './types.js';
/** Everything the router reads. Every field is host-derived or folded; none is model-supplied (A-5). */
export interface ReviewRoutingInput {
    readonly rootSessionId: string;
    /** The request id of the leg being routed, from the authoritative fold. */
    readonly currentLegRequestId: string;
    /** The case version the fold reported for this read, recorded into the assignment (not trusted). */
    readonly caseVersion: string;
    readonly caseView: ReviewCaseView;
    /** The live parsed plan, or `null` when this Team has none — the default for every pre-Alpha.6 Team. */
    readonly plan: ReviewPlan | null;
    /** The candidate mandate covering this case+leg, or `null`. */
    readonly mandate: ReviewMandate | null;
    /** The host's snapshot of the instances that exist and their lifecycle. */
    readonly candidates: readonly ReviewerCandidate[];
    /** The folded assignment state for this case, or `null` when the caller has not folded one. */
    readonly current: ReviewAssignmentState | null;
    /** The runtime's current plan epoch, supplied by the caller. */
    readonly currentEpoch: number;
    /** The caller's wall clock as an ISO instant, for the plan's expiry law. No clock is read here. */
    readonly nowIso: string;
    /** True when the plan itself was revoked at the current epoch. */
    readonly planRevoked: boolean;
}
/**
 * Route one case. Pure, total, and closed: it returns either a typed decision or a typed refusal, and
 * the decision is one of assign / keep / leaveWithLeader. No effect, no I/O, no fact construction — the
 * caller turns an `assign` into an encoded fact with `encodeAssignmentFact` and lets PR-I1 write it.
 */
export declare function routeReviewCase(input: ReviewRoutingInput): ReviewAssignmentResult<ReviewRoutingDecision>;
//# sourceMappingURL=router.d.ts.map