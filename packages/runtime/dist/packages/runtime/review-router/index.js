/**
 * Alpha.6 PR1 — pure Blueprint-first ReviewRouter and the ONE shared policy.
 *
 * DORMANT: no production file imports this package in PR1. PR2a consumes the
 * policy; PR2c/PR4 wire routing and delivery. Nothing here can allow a tool,
 * mint a Grant, or write a Control case.
 *
 * @module @dsh-agent-team/runtime/review-router
 */
export { blueprintReviewPolicyFrom, isDelegableOrdinaryToolAsk, isLeaderException } from './policy.js';
export { routeReview } from './router.js';
//# sourceMappingURL=index.js.map