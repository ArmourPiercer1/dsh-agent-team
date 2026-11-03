/**
 * Alpha.6 PR2a — pure ReviewCapability evaluator.
 *
 * DORMANT: PR2b is the first consumer. No production file imports this lane,
 * and no PA/Control/Grant write path is touched here.
 *
 * @module @dsh-agent-team/runtime/review-authority
 */

export { decisionCapabilityEvidenceFrom, evaluateReviewCapability } from './evaluator.js'
export {
  REVIEW_CAPABILITY_ENTRIES,
  REVIEW_CAPABILITY_REFUSALS,
  REVIEW_CAPABILITY_SOURCES,
  ReviewCapabilityCandidate,
} from './types.js'
export type {
  CurrentReviewCase,
  DecisionCapabilityEvidence,
  OperationOwner,
  OperationTool,
  ReviewCallFacts,
  ReviewCapability,
  ReviewCapabilityEntry,
  ReviewCapabilityEvaluation,
  ReviewCapabilityRefusal,
  ReviewCapabilitySource,
  ReviewerMember,
  ReviewLegTransfer,
} from './types.js'
