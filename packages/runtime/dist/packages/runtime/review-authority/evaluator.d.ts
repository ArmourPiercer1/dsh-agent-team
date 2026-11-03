/**
 * Alpha.6 PR2a — the single pure ReviewCapability evaluator.
 *
 * The evaluator consumes the SAME `BlueprintReviewPolicy` predicates as the
 * router. It never re-implements "ordinary ask" rules and never accepts a
 * model/client-supplied authority claim.
 *
 * @module @dsh-agent-team/runtime/review-authority/evaluator
 */
import { ReviewCapabilityCandidate } from './types.js';
import type { DecisionCapabilityEvidence, ReviewCallFacts, ReviewCapabilityEntry, ReviewCapabilityEvaluation } from './types.js';
/**
 * Evaluate one entry action for the real principal. Native Leader/Human
 * principals keep their existing authority; Member delegation is allowed only
 * through the Blueprint Officer path and the shared ordinary-ask set.
 */
export declare function evaluateReviewCapability(facts: ReviewCallFacts, entry: ReviewCapabilityEntry): ReviewCapabilityEvaluation;
/** Project the candidate onto the same durable decision row's evidence field. */
export declare function decisionCapabilityEvidenceFrom(candidate: ReviewCapabilityCandidate): DecisionCapabilityEvidence;
//# sourceMappingURL=evaluator.d.ts.map