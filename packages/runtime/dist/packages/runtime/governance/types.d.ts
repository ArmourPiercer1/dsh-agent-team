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
import type { MemberIdentity, PolicyEntry, PolicyStateView } from '../../domain/policy/src/index.js';
import type { AdmittedGovernanceOverride, MutationAuthority, OverrideRecordView, OverrideStorePort } from '../mutation/override-admission.js';
import type { MutationActor, PolicyReader, PolicyStateTransitionRecord } from '../mutation/types.js';
/**
 * The per-team serialization seam the service serializes every mutation
 * through (the production wiring passes the shared
 * {@link TeamOperationCoordinator.run} — the ONE per-team chain the P8-S5B
 * coordination module owns; tests may pass any same-shaped chain).
 */
export interface GovernanceChainPort {
    /**
     * Run one unit of work serialized per root session id. A failing unit
     * never poisons the chain for later work.
     * @param rootSessionId - the team (root) session id.
     * @param work - the serialized unit of work.
     */
    run<T>(rootSessionId: string, work: () => Promise<T>): Promise<T>;
}
/**
 * The transition read/write seam the service consumes (pre-alpha3 PR-B,
 * plan §B.2): the READ is the durable ledger rows in COMMIT order (the
 * production wiring reads the ledger directly — the process-local cache is
 * no longer the read source of any production decision; the test worlds
 * pass their in-memory store), and the APPEND mirrors an admitted
 * transition into the process-local view (sync; the durable row was
 * already written by the commit port — commit-before-ack).
 */
export interface GovernanceTransitionCache {
    /** Mirror one admitted transition into the process-local view (sync). */
    appendTransition(teamSessionId: string, transition: PolicyStateTransitionRecord): void;
    /** The admitted transitions of one team, in COMMIT order. */
    listTransitions(teamSessionId: string): readonly PolicyStateTransitionRecord[];
}
/**
 * The durable PolicyState commit port (commit-before-ack): the service
 * AWAITs this write before it returns, so a durable transition fact is
 * stored before any caller observes the ack (the R2-1 fire-and-schedule
 * window is closed).
 */
export interface GovernanceTransitionCommit {
    /**
     * Durably write one admitted transition (one `ledger` fact row).
     * @param rootSessionId - the ADDRESSED TeamSession the switch targeted;
     *   the durable row is stamped with THIS root (the durable read is
     *   root-keyed — stamping the row's own boot root instead would make the
     *   committed state invisible to the addressed team and leak it to a
     *   foreign root; the overrides lane stamps `args.rootSessionId` the same
     *   way, service.ts:266/283).
     * @param transition - the admitted transition record (the payload is
     *   mirrored verbatim into the durable row).
     */
    commit(rootSessionId: string, transition: PolicyStateTransitionRecord): Promise<void>;
}
/**
 * The static policy reader the service consumes for the write-time checks
 * (the SAME port the P7-T2 mutation kernel uses — the bound Blueprint
 * snapshot's envelope, the member's template policy, the external hard
 * facts). Reused verbatim: the production root already builds one
 * (`policyReader` in root.ts).
 */
export type GovernancePolicyReader = PolicyReader;
/** The service dependencies (every durable home injected). */
export interface GovernanceMutationServiceDeps {
    /** The shared per-team operation chain (serialization authority). */
    readonly chain: GovernanceChainPort;
    /** The durable `overrides` store (the team_domain repository). */
    readonly overrides: OverrideStorePort;
    /** The transition read seam (production: the durable ledger rows in
     *  commit order; the service's no-change check reads through it). */
    readonly transitions: GovernanceTransitionCache;
    /** The durable transition commit (commit-before-ack). */
    readonly transitionCommit: GovernanceTransitionCommit;
    /** The static policy facts (envelope / template / external hard). */
    readonly policy: GovernancePolicyReader;
    /**
     * The registered member instances of one team (the leader envelope
     * intersection needs the full roster; the production wiring reads the
     * durable `member-instances` rows).
     * @param rootSessionId - the team to roster.
     */
    readonly registeredMembers: (rootSessionId: string) => Promise<readonly MemberIdentity[]>;
    /**
     * The bound blueprint's CLOSED PolicyState set for one team (the
     * `default` id plus every declared state id, declaration order).
     * @param rootSessionId - the team whose bound blueprint is read.
     */
    readonly policyStates: (rootSessionId: string) => readonly string[];
    /** The write clock (injected; ISO-8601 strings). */
    readonly now: () => string;
}
/**
 * One requested durable override mutation (a SET of cells for one policy
 * slot). The authority is the §20.3/§20.4 channel (derived server-side
 * from the authenticated principal, never from payload claims); the slot
 * is CLOSED by the authority (see the module doc of {@link slot}):
 * leader -> team-scope autonomy overlay, member -> own instance-scope
 * autonomy overlay, operator -> human override (team or instance scope).
 */
export interface GovernanceOverrideSetArgs {
    /** The acting authority. */
    readonly authority: MutationAuthority;
    /** The owning TeamSession (clean id). */
    readonly rootSessionId: string;
    /**
     * The requested scope (closed by the authority; an operator may choose
     * team or instance, agent origins ignore it and it is rejected when
     * inconsistent with the authority's fixed scope).
     */
    readonly scope: 'team' | 'instance';
    /** Required exactly when scope is 'instance'. */
    readonly instanceId?: string;
    /**
     * The cell changes (non-empty; closed capability vocabulary ->
     * PolicyEntry). Unmentioned capabilities keep the slot winner's
     * current values (full slot re-issue).
     */
    readonly cells: Record<string, PolicyEntry>;
    /**
     * Optional optimistic-concurrency guard: the generation the caller
     * believes is the current slot winner. Mismatch -> typed conflict.
     */
    readonly expectedGeneration?: number;
}
/**
 * The set outcome. `changed: true` — a new full-slot record was durably
 * committed BEFORE the ack (the admitted record, backend truth).
 * `changed: false` — the desired state already holds (the merged slot
 * values equal the current winner's values): NO write, NO generation
 * bump (idempotence); the current winner is reported (null when the slot
 * is empty — an empty-cells request cannot reach this branch).
 */
export type GovernanceOverrideSetResult = {
    readonly changed: true;
    readonly record: AdmittedGovernanceOverride;
} | {
    readonly changed: false;
    readonly reason: 'no-change';
    /** The current slot winner (undefined when the slot is empty). */
    readonly current: OverrideRecordView | undefined;
};
/**
 * One requested durable override RESET (revoke the addressed slot). The
 * reset is a higher-generation TOMBSTONE re-issue (an empty `values`
 * record that wins the slot by generation) — never a storage delete
 * (audit-preserving; the read-side slot selection then contributes
 * nothing for the slot, which is exactly "no override").
 */
export interface GovernanceOverrideResetArgs {
    /** The acting authority (closes the same slot it could set). */
    readonly authority: MutationAuthority;
    /** The owning TeamSession (clean id). */
    readonly rootSessionId: string;
    /** The addressed scope (closed by the authority). */
    readonly scope: 'team' | 'instance';
    /** Required exactly when scope is 'instance'. */
    readonly instanceId?: string;
    /** Optional optimistic-concurrency guard (same semantics as set). */
    readonly expectedGeneration?: number;
}
/**
 * The reset outcome. `removed: true` — a tombstone was durably committed
 * BEFORE the ack. `removed: false` — the slot had no winner (nothing to
 * revoke; no write).
 */
export type GovernanceOverrideResetResult = {
    readonly removed: true;
    readonly tombstone: AdmittedGovernanceOverride;
} | {
    /** No durable write: the slot was empty, or its winner is already a
     *  tombstone (the desired state holds — idempotent reset). */
    readonly removed: false;
    /** Present when the no-op found an already-tombstoned slot (the
     *  standing tombstone record). */
    readonly current?: AdmittedGovernanceOverride;
};
/**
 * One requested explicit PolicyState transition (Architecture §20.4,
 * invariant 40: ONLY explicit human / authorized-leader transitions
 * exist). The target must be in the team's bound blueprint CLOSED state
 * set; a self-transition (target == active state) is a typed no-op.
 */
export interface GovernancePolicyStateSetArgs {
    /** The acting actor (TeamSession-level; member is unauthorized). */
    readonly actor: MutationActor;
    /** The owning TeamSession (clean id). */
    readonly rootSessionId: string;
    /** The target state (closed shape; validated here). */
    readonly target: PolicyStateView;
}
/**
 * The switch outcome. `changed: true` — the durable ledger row was
 * committed BEFORE the ack (commit-before-ack) and the transition record
 * is the admitted fact. `changed: false` — the target state is already
 * the active state (no new row, no write).
 */
export type GovernancePolicyStateSetResult = {
    readonly changed: true;
    readonly transition: PolicyStateTransitionRecord;
} | {
    readonly changed: false;
    readonly reason: 'no-change';
    /** The state already active (the target, validated). */
    readonly state: PolicyStateView;
};
/**
 * The production governance mutation authority (ADR-03): the single
 * write surface for durable governance overrides + PolicyState
 * transitions of one production root. Constructed once per production
 * root (root.ts); the remote ports and the dev-harness row call it —
 * nothing else writes those durable truths.
 */
export interface GovernanceMutationService {
    /**
     * Set (merge) the cells of one policy slot. Serialized per team on the
     * shared chain; validates authority/scope, the closed cell vocabulary,
     * the write-time envelope (agent origins) and the external hard facts
     * (every origin), applies the desired-state no-op, then durably
     * re-issues the full slot (commit-before-ack).
     * @throws {@link MutationError} — see the service module doc for the
     *   closed vocabulary of reachable codes.
     */
    setOverride(args: GovernanceOverrideSetArgs): Promise<GovernanceOverrideSetResult>;
    /**
     * Reset (revoke) the addressed policy slot: a higher-generation
     * tombstone re-issue (commit-before-ack); no-op when the slot is empty.
     * @throws {@link MutationError} — authority/scope/shape failures.
     */
    resetOverride(args: GovernanceOverrideResetArgs): Promise<GovernanceOverrideResetResult>;
    /**
     * Switch the team PolicyState (explicit human / authorized-leader
     * only): closed-set check, self-transition no-op, durable commit
     * BEFORE the ack, then the in-memory cache append.
     * @throws {@link MutationError} — `UNAUTHORIZED_TRANSITION`,
     *   `POLICY_STATE_UNKNOWN`, `MALFORMED_MUTATION_INPUT`.
     */
    switchPolicyState(args: GovernancePolicyStateSetArgs): Promise<GovernancePolicyStateSetResult>;
}
//# sourceMappingURL=types.d.ts.map