/**
 * pre-alpha3 PR-A — the closed type surface of the production GOVERNANCE
 * MUTATION AUTHORITY (plan: `dsh-agent-team-pre-alpha3-refactor-plan`
 * PR-A "Governance convergence", ADR-03).
 *
 * This is the single production write authority for the two durable
 * governance truths of a TeamDomain:
 *
 * - the `overrides` store (durable governance overrides — the
 *   `override.set` / `override.reset` remote commands and the dev-harness
 *   row's HTTP route), and
 * - the PolicyState transitions (the `policyState.set` remote command) —
 *   the durable `ledger` fact rows plus the in-memory read cache.
 *
 * Every write path in the production composition is
 * `remote / tool -> GovernanceMutationService -> the shared per-team
 * operation chain -> TeamDomain`. The old forked authority surfaces
 * (the remote-side direct `admitGovernanceOverride` glue, the remote-side
 * reset delete, the production `MutationService` instance) are demoted:
 * `persistGovernanceOverride` (mutation/override-admission) is a narrow
 * persistence primitive, and the `MutationService` class stays a pure
 * kernel of the P7-T2 test worlds — neither is a production authority.
 *
 * The module is PURE with respect to the ports (no node: builtins, no
 * storage import, no DSH imports): the durable homes are injected (the
 * `overrides` repository, the `ledger` writer, the read-cache store), so
 * the concurrency / idempotence / authority tests run against in-memory
 * fakes and the production wiring is a thin adapter.
 *
 * @module @dsh-agent-team/runtime/governance/types
 */
export {};
//# sourceMappingURL=types.js.map