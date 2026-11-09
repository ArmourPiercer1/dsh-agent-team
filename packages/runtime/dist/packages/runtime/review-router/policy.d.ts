/**
 * Alpha.6 PR1 — the ONE shared `BlueprintReviewPolicy`.
 *
 * Both the router (this PR) and the ReviewCapability evaluator (PR2a) read
 * the same `isDelegableOrdinaryToolAsk`. A second copy of this predicate is a
 * second answer to "may an Officer review this ask", which is exactly the
 * drift ADR-A6-1 forbids.
 *
 * The predicate is intentionally data-first: no ControlService, no PA, no
 * Blueprint parser. The caller supplies trusted, normalized facts. A missing
 * or malformed fact fails closed.
 *
 * @module @dsh-agent-team/runtime/review-router/policy
 */
import type { ReviewRouting } from '../../domain/blueprint/src/index.js';
import type { ReviewLeaderException, ReviewToolCoordinate } from '../../domain/blueprint/src/index.js';
import type { OrdinaryToolAskFacts } from './types.js';
/** The immutable policy the router and capability evaluator share. */
export interface BlueprintReviewPolicy {
    readonly officerTemplateId: string;
    readonly ordinaryDefault: 'officer';
    readonly leaderExceptions: readonly ReviewLeaderException[];
    readonly whenOfficerUnavailable: 'hold' | 'leader';
}
/** Build the shared policy from an authored v5 `reviewRouting` block. */
export declare function blueprintReviewPolicyFrom(routing: ReviewRouting | undefined): BlueprintReviewPolicy | null;
/** Is this (actual OperationOwner template, trusted tool) a declared Leader exception? */
export declare function isLeaderException(policy: BlueprintReviewPolicy, operationOwnerTemplateId: string | null, tool: ReviewToolCoordinate | null): boolean;
/**
 * The frozen ordinary-ask closed set.
 *
 * This is an OPERATION CASE, not a mutation case. `requestedEffect` is
 * REQUIRED by Alpha.4's `ApprovalCaseIdentity`; the earlier "no
 * requestedEffect" formulation was a P0 because it excluded every legal
 * operation case. The distinguishing facts are `operationFingerprint`
 * present, `mutationProposalFingerprint` absent, and `authorityScope`
 * present.
 */
export declare function isDelegableOrdinaryToolAsk(facts: OrdinaryToolAskFacts): boolean;
//# sourceMappingURL=policy.d.ts.map