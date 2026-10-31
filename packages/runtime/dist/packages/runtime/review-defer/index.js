/**
 * Alpha.6 PR4′ — public surface of the review-wake defer lane.
 *
 * The seam is three things and nothing else: a gate that implements the control notification port and decides
 * deliver-or-hold from a process-local floor, a port that a tool must be INJECTED with so it writes into the
 * SAME store the gate reads, and the vocabulary the refusals and decisions are drawn from. Everything below is
 * pure or single-process state; there is no I/O, no clock, no timer, and no durable row in this lane.
 *
 * DORMANCY, IN FULL: no PRODUCTION file imports this directory — the three `a6-pr4-*.test.ts` specs are its only
 * importers, and the walk below deliberately skips `test/` so it measures the product rather than its own tests. That is not an oversight and it
 * is not a lane waiting for its plumbing to be noticed — the round-1 review of #509 measured the only wake
 * source this tree has (`control/service.ts:2536`, `created: true` only; an existing row never re-notifies; a
 * risen leg is never notified; `approvalCaseId` is minted at creation) and concluded that a quiet can never be
 * standing when its key's only wake fires, so a flag, a gate installation, or a `team_review_defer` tool shipped
 * today would be a control with nothing on the other end and a tool whose `accepted: true` is a lie. Law 6 in
 * `types.ts` states that in full; PR-I2 ships the tool, the flag and the single `root.ts` chooser together with
 * the wake source that makes "held until T" observable. The claim above is a walk in
 * `a6-pr4-lane-hygiene.test.ts`, not a sentence here, and the walk's allow-list is EMPTY (which is a statement
 * about `packages/**` outside any `test/` directory, and is worded that way on purpose).
 */
export { REVIEW_DEFER_DECISIONS, REVIEW_DEFER_DEFAULT_LIMITS, REVIEW_DEFER_REASON_CODES, REVIEW_DEFER_REFUSALS, REVIEW_DEFER_WAKE_REASONS, } from './types.js';
export { cancelReviewDefer, createReviewDeferStore, listReviewDefers, reviewDeferEntryId, reviewDeferKeyOf, setReviewDefer, sweepReviewDefers, } from './store.js';
export { createReviewDeferGate, createReviewDeferPort, decideReviewWake, } from './gate.js';
//# sourceMappingURL=index.js.map