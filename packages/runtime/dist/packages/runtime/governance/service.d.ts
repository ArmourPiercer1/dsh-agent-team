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
import type { GovernanceMutationService, GovernanceMutationServiceDeps, PermissionAuthorityCeilingContext } from './types.js';
import type { PermissionRiseCeilingVerdict, PermissionRiseRegion, SubtreeContains } from './permission-mutation.js';
/**
 * Create the production governance mutation authority for one root.
 *
 * @param deps - the injected durable homes (chain / overrides store /
 *   transition cache + commit / policy facts / member roster / closed
 *   state set / clock).
 * @returns the service surface ({@link GovernanceMutationService}).
 */
export declare function createGovernanceMutationService(deps: GovernanceMutationServiceDeps): GovernanceMutationService;
/**
 * THE DUAL-CEILING JUDGE (A4-PR2 lane C): for one rising region, are BOTH
 * authority ceilings at or above the risen effect? Exported because a ceiling law
 * that is only reachable through `mutatePermission` gets tested against a replica
 * of itself, and a replica passes while the real arithmetic is wrong (measured in
 * this PR's mutation proofs: reading `no-authority` as "unrestricted" in THIS
 * function went unnoticed by the first version of the suite).
 *
 * The two planes are computed SEPARATELY and never fused, never min()'d (ADR
 * X7-R5, A1-4, A3-2): the expansion ceiling answers "may this position COMMIT this
 * effect here", the approval ceiling answers "may it GRANT it", and they have
 * opposite no-match semantics on purpose — so one lookup cannot stand in for the
 * other.
 *
 * THE SET OF POINTS ASKED (A4-PR7 §7.5 prerequisite 1): the rise is judged at EVERY
 * matcher it claims — the closed CELL (`region.region`, where the effect actually
 * rose) AND the whole WIDTH of the mutation rule that produced it
 * (`region.mutationMatcher`) — and both ceilings must reach the risen effect at
 * every one of them. The list itself is `permissionRiseClaimedPoints`, shared with
 * the approval-rung pricing in `buildApprovalAsk` for exactly the reason below: the
 * hole is the algebra, and an algebra with two owners drifts.
 *
 * IT IS A SET, NOT A SWAP, AND THAT IS THE POINT. Substituting the wide matcher for
 * the cell would be one line and would LOOSEN the ceiling: a wider question is
 * answered by FEWER rules, so a document that caps the cell (`exact F → ask`) while
 * granting the subtree (`subtree S → allow`) would reach `allow` at the width and no
 * longer at the cell. Measured: asking the width alone commits exactly that rise,
 * which is the widening a deletion-cleanup may never perform. The meet over the
 * candidate set is therefore never wider than either individual evaluation — the same
 * conservative shape the shell-class candidate set uses (plan §7.2 Ruling 4). The
 * cell is asked FIRST, so every refusal this gate issued before this change keeps its
 * plane, its ceiling value and its rung byte-identically; the width can only ever add
 * a refusal.
 *
 * WHY THE WIDTH BELONGS HERE AT ALL: `leaderEnvelopeCoverage` — Alpha.3's
 * whole-matcher coverage law, judged inside `authorizeLeaderPermissionMutation` —
 * used to be the only owner of that width, and A4-PR7 §7.5 DELETED it. The
 * deletion shipped only after the prerequisite law above could say NO on the same
 * rise and after the §7.5 mutation re-measurement confirmed nothing newly commits
 * (`dev/agent-workflow/evidence/a4-pr7/7-5-delete/FINDINGS.md`; the gating
 * prerequisite record is `dev/agent-workflow/evidence/a4-pr7/7-3-prereq/FINDINGS.md`).
 * Pinned by `test/a4p7-carrier-width-under-ceiling.test.ts` (legs 1-2 = the width
 * refusal, now owned by THIS law; legs 3-5 = the meet's shape, leg 5 = the
 * direction a swap gets wrong).
 */
export declare function createPermissionAuthorityCeilingJudge(deps: {
    readonly subtreeContains?: SubtreeContains;
}): (context: PermissionAuthorityCeilingContext, region: PermissionRiseRegion) => PermissionRiseCeilingVerdict;
//# sourceMappingURL=service.d.ts.map