/**
 * Alpha.6 PR2′ (Lane 2) — the review router and its non-authorizing assignment facts.
 *
 * Read `types.ts` first: it states the eight laws (A-1…A-8) the rest of the lane is an argument for.
 * The short version for a reader who only wants the shape of the risk:
 *
 *  - **Nothing here grants anything.** `facts.ts` refuses a payload key that claims authority, and the
 *    family books its frozen ledger category as `team` and never `control`.
 *  - **Nothing here is wired.** PR-I1a supplied the durable writer `writer.ts` promised by A-8 — one module,
 *    one entry point, no second approval ledger — and NOTHING calls it: `ALLOWED_CONSUMERS` is still empty and
 *    the hygiene spec proves no production file imports any of this lane. A writer with no caller cannot write;
 *    the sentence above it, written when the lane had no writer at all, is kept here in its amended form rather
 *    than silently rewritten, because "the durable append arrives with the named Center-Interface PR" is still
 *    the plan for the caller. The ARC-A center is untouched.
 *  - **Nothing here is wider than PR0.** The router routes a case only when PR0's admission gate admits
 *    the same instance for the same case, plan and mandate, and it fails closed to the Leader — the
 *    pre-Alpha.6 behaviour — whenever a plan, a mandate, a leg, a lifecycle or a snapshot is missing.
 *  - **A handoff is not an escalation.** `handoff.ts` has no rung field to set and returns no
 *    ControlService effects; raising a leg remains the exclusive job of `escalateApprovalLeg`.
 *
 * The interface Alpha.5 and Alpha.6 share is unchanged by this package: it consumes PR0's frozen
 * `ReviewPlan` / `ReviewMandate` / `ReviewCaseView` types and exports no new surface any Alpha.5 module
 * is asked to know about.
 *
 * @module @dsh-agent-team/runtime/review-assignment
 */
export * from './types.js';
export * from './facts.js';
export * from './router.js';
export * from './handoff.js';
export * from './writer.js';
//# sourceMappingURL=index.d.ts.map