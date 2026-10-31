/**
 * Alpha.6 PR2′ (Lane 2) — handoff, and the boundary that a handoff is not an escalation.
 *
 * PR #319 §7 states the boundary as a test requirement, and this file exists to make it unmissable:
 *
 *   - An Officer decides the case needs the Leader's global information → `handoff`. The TARGET becomes
 *     the Leader. The leg's `reviewAuthority` and the current leg itself are untouched, because nothing
 *     about *what may be approved* changed — only about *who is looking*.
 *   - The current leg's approval authority is genuinely insufficient → only the existing
 *     `escalateApprovalLeg` (`control/service.ts`) may create a higher-rung leg. A handoff may not be
 *     used to raise authority, and this module cannot even express that: there is no rung field, no leg
 *     field and no decision field anywhere in `ReviewHandoffPlan`.
 *
 * So the boundary is three facts a reviewer can check in order: (1) the output type has no authority
 * vocabulary; (2) `controlServiceEffects` is the empty array, typed as `readonly []`, so "it triggers
 * nothing in the control plane" is a type, not a promise; (3) the only row a handoff produces is
 * `review-assignment-transferred`, whose payload the facts layer refuses the moment it carries an
 * authority-bearing key. `a6-pr2-assignment-kernel.test.ts` asserts all three, plus the positive
 * control that escalation is a different operation entirely: it is not implemented here, and no import
 * of this lane reaches it.
 *
 * The CAS discipline is the same as everywhere else in the lane: a handoff states the epoch it
 * replaces, and a handoff that lost the race changes nothing.
 */
import { type ReviewAssignmentPayload } from './facts.js';
import { type ReviewAssignmentResult, type ReviewAssignmentState, type ReviewHandoffPlan } from './types.js';
/** The trusted-side request to hand a case up to the Leader. No authority field exists in it (A-6). */
export interface ReviewHandoffRequest {
    readonly rootSessionId: string;
    readonly approvalCaseId: string;
    readonly currentLegRequestId: string;
    readonly basedOnCaseVersion: string;
    /** Why the Leader is needed. Audit prose with a shape; never interpreted by this lane. */
    readonly reasonCode: string;
    /** The durable ref of the actor handing off — the Officer's own ref in the normal case. */
    readonly actorCallerRef: string;
}
/** What a caller needs to write the fact: the fact type, the payload, and the plan it came from. */
export interface ReviewPreparedFact {
    readonly factType: string;
    readonly payload: ReviewAssignmentPayload;
    readonly plan: ReviewHandoffPlan;
}
/**
 * Prepare the handoff fact for a case the Officer can no longer usefully hold.
 *
 * Refusals are the family's own: nothing to hand off (`…_NO_ACTIVE_ASSIGNMENT`), already with the
 * Leader (`…_TARGET_UNCHANGED`), or a CAS miss against the folded state (`…_EPOCH_CONFLICT`). None of
 * them writes anything; all of them are the caller's signal to re-read.
 */
export declare function planHandoff(state: ReviewAssignmentState, request: ReviewHandoffRequest): ReviewAssignmentResult<ReviewPreparedFact>;
/**
 * Prepare the retirement of a case's assignment: the Officer is done with it (closed, decided elsewhere,
 * disposed) and nobody is expected to look. After this row the case has no current handler, and the
 * retired target is refused by `maySubmitFor` — A-3, the same law a handoff relies on.
 */
export declare function planRetirement(state: ReviewAssignmentState, request: ReviewHandoffRequest): ReviewAssignmentResult<ReviewPreparedFact>;
//# sourceMappingURL=handoff.d.ts.map