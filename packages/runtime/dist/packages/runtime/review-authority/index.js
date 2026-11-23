/**
 * Alpha.6 PR2a — pure ReviewCapability evaluator.
 *
 * DORMANT: PR2b is the first consumer. No production file imports this lane,
 * and no PA/Control/Grant write path is touched here.
 *
 * @module @dsh-agent-team/runtime/review-authority
 */
export { decisionCapabilityEvidenceFrom, evaluateReviewCapability } from './evaluator.js';
// ROUND 93 (R1, owner ruling on review `20261124-0151` §1): the ONE shared ordinary-ask predicate is
// re-exported here because the ReviewCapability evaluator ALREADY consumes it (`evaluator.ts:146`) and the
// Alpha.6 case producer must judge eligibility with the SAME function, not a copy. Routing the producer's
// import through this lane keeps the review-router lane's single-consumer law (`a6-pr1-lane-hygiene.test.ts`
// "no production importer yet": only review-authority / the alpha6 composition may name it) intact — no
// second policy, no new eligibility rule, and the pin was NOT amended to admit a new importer.
export { isDelegableOrdinaryToolAsk } from '../review-router/index.js';
export { REVIEW_CAPABILITY_ENTRIES, REVIEW_CAPABILITY_REFUSALS, REVIEW_CAPABILITY_SOURCES, ReviewCapabilityCandidate, } from './types.js';
//# sourceMappingURL=index.js.map