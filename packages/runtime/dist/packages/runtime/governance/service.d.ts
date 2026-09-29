/**
 * pre-alpha3 PR-A — the production GOVERNANCE MUTATION AUTHORITY (ADR-03):
 * the single production write path for the two durable governance truths
 * of a TeamDomain — the `overrides` store and the PolicyState transitions
 * — with every mutation serialized on the shared per-team operation chain
 * (the P8-S5B coordinator) and committed durably BEFORE the ack.
 *
 * Why this module exists — the PR-A target: before this PR, the
 * production write paths were FORKED:
 *
 * - `override.set` ran a remote-side slot scan + the
 *   `admitGovernanceOverride` glue (no envelope check, no external-hard
 *   check, NOT serialized on the shared chain — a lost-update race on
 *   the same slot);
 * - `override.reset` deleted the durable row directly (a member could
 *   revoke the TEAM-scoped slot — the authority hole), bypassing the
 *   generation guard and the chain;
 * - `policyState.set` ran the pure `MutationService` (synchronous,
 *   process-local store) whose durable write was fire-and-schedule — the
 *   ack could return before the ledger row was durable.
 *
 * This service is the ONE authority all of them converge to:
 *
 * ```
 * remote / tool -> GovernanceMutationService
 *                      -> the shared per-team operation chain
 *                      -> TeamDomain (overrides repository / ledger)
 * ```
 *
 * Semantics (the full rule set lives in the pure slot kernel —
 * {@link module:./slot}): slot closure by authority (leader -> team
 * scope; member -> own instance; operator -> human override), closed
 * cell vocabulary, write-time envelope (agent origins; deny always
 * passes), write-time external hard facts (EVERY origin — the
 * absolute ceiling), the `expectedGeneration` guard, the desired-state
 * no-op, the full-slot re-issue, the reset tombstone, and the
 * commit-before-ack durable write for both the override records and the
 * PolicyState transitions.
 *
 * The old surfaces are demoted, not forked further:
 * `persistGovernanceOverride` (mutation/override-admission) is a narrow
 * persistence primitive the tests exercise directly, and the
 * `MutationService` class stays a pure kernel of the P7-T2 test worlds —
 * NEITHER is a production authority after this PR.
 *
 * Pure with respect to the ports: no node: builtins, no storage import,
 * no DSH imports — the durable homes are injected (see
 * {@link GovernanceMutationServiceDeps}).
 *
 * @module @dsh-agent-team/runtime/governance/service
 */
import type { GovernanceMutationService, GovernanceMutationServiceDeps } from './types.js';
/**
 * Create the production governance mutation authority for one root.
 *
 * @param deps - the injected durable homes (chain / overrides store /
 *   transition cache + commit / policy facts / member roster / closed
 *   state set / clock).
 * @returns the service surface ({@link GovernanceMutationService}).
 */
export declare function createGovernanceMutationService(deps: GovernanceMutationServiceDeps): GovernanceMutationService;
//# sourceMappingURL=service.d.ts.map