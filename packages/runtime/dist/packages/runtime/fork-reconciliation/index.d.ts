/**
 * Fork reconciliation (P7-T4): the lazy root-fork sidecar.
 *
 * One observed native DSH Session fork (public lineage/parent information,
 * Architecture §35.2) is reconciled against the durable TeamDomain sidecar
 * (invariant 41) with the frozen DevPlan §20.4 semantics:
 *
 * - **Root fork**: a NEW TeamSession for the fork child with the SAME
 *   immutable Blueprint snapshot (invariant 10) and EMPTY MemberInstances;
 *   `session.fork` is never patched (zero-core, Architecture §35.2) — the
 *   sidecar is the only vNext effect, created in the crash-safe order
 *   (record first, `team-root` binding second) and idempotent on re-runs.
 * - **Member fork**: the child stays an ordinary independent AgentSession
 *   (invariant 62); no Team binding is ever inferred.
 * - **Ordinary fork**: the parent carries no Team binding; the sidecar is
 *   untouched.
 *
 * Public facade: the reconciler, the closed error channel, the frozen
 * outcome vocabulary, and the real repository adapter.
 *
 * @module @dsh-agent-team/runtime/fork-reconciliation
 */
export { FORK_RECONCILIATION_ERROR_CODES, FORK_RECONCILIATION_ERROR_CODE_VALUES, ForkReconciliationError, isForkReconciliationError, } from './errors.js';
export type { ForkReconciliationErrorCode } from './errors.js';
export { createTeamDomainForkPort } from './adapter.js';
export { reconcileForkSidecar } from './reconciler.js';
export type { ForkReconciliationInput, ForkReconciliationPorts, ForkReconciliationResult, ForkReconciliationTeamDomain, } from './types.js';
//# sourceMappingURL=index.d.ts.map