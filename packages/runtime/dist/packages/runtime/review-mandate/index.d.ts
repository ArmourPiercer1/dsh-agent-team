/**
 * Alpha.6 PR0 (Lane 2) — the review-delegation vocabulary lane: barrel.
 *
 * THREE EXPORTS AND NO MORE: the closed vocabulary ({@link ./types}), the
 * fail-closed plan parser ({@link ./plan}) and the admission check
 * ({@link ./mandate}). The lane holds no state, performs no I/O and imports
 * nothing from the ARC-A protected center; the single authoritative decision
 * entrance will consume it from inside that center (Lane-plan PR-I1), not the
 * other way round.
 *
 * Production consumers as of PR0: NONE (declared dormant — see
 * `docs/plans/memo/alpha6-review-separation/alpha6-lane2-execution-plan-20261030.md`
 * §1 PR0/PR-I1 and gate G-5). No reviewer decision is wired to `allow` until
 * the Center-Interface PR and its safety gate pass. The lane is shipped dark so
 * the law and its negative controls can be reviewed before anything can act on
 * them.
 *
 * @module review-mandate
 */
export * from './types.js';
export * from './plan.js';
export * from './mandate.js';
//# sourceMappingURL=index.d.ts.map