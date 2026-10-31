/**
 * Alpha.6 PR4′ — public surface of the review-wake defer lane.
 *
 * The seam is three things and nothing else: a gate that implements the control notification port and decides
 * deliver-or-hold from a process-local floor, a port the model-facing tool is injected with so it writes into
 * the SAME store the gate reads, and the vocabulary the refusals and decisions are drawn from. Everything below
 * is pure or single-process state; there is no I/O, no clock, no timer, and no durable row in this lane.
 *
 * DORMANCY. Nothing in this repository imports this directory except `packages/runtime/src/plugin/root.ts`,
 * which builds the gate ONLY when the row config says `config.teamToolPlane.reviewDeferEnabled === true`, and
 * which otherwise passes the untouched deliverer to the untouched notifier. That claim is a walk in
 * `a6-pr4-lane-hygiene.test.ts`, not a sentence here, and the walk's allow-list is exactly that one file.
 */

export {
  REVIEW_DEFER_DECISIONS,
  REVIEW_DEFER_DEFAULT_LIMITS,
  REVIEW_DEFER_REASON_CODES,
  REVIEW_DEFER_REFUSALS,
  REVIEW_DEFER_WAKE_REASONS,
  type ReviewDeferDecisionKind,
  type ReviewDeferEntry,
  type ReviewDeferKey,
  type ReviewDeferLimits,
  type ReviewDeferReasonCode,
  type ReviewDeferRefusal,
  type ReviewDeferResult,
  type ReviewDeferWakeDecision,
  type ReviewDeferWakeReason,
  type ReviewWakeCandidate,
} from './types.js'
export {
  cancelReviewDefer,
  createReviewDeferStore,
  listReviewDefers,
  reviewDeferEntryId,
  reviewDeferKeyOf,
  setReviewDefer,
  sweepReviewDefers,
  type ReviewDeferStore,
} from './store.js'
export {
  createReviewDeferGate,
  createReviewDeferPort,
  decideReviewWake,
  type ReviewDeferGate,
  type ReviewDeferObserver,
  type ReviewDeferPort,
  type WrappedLeaderNotifier,
} from './gate.js'
