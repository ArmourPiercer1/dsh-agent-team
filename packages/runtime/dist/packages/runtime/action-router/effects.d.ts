/**
 * P6-T2 — step 6 of the documented enforcement order: durable effects.
 *
 * Every durable write flows ONLY through the injected TeamDomain
 * repositories (invariant 41) — no other write path exists in this module.
 *
 * Durable write boundary (documented ruling): the facade's OWN durable
 * writes are the TeamLedger admission/coordination facts. The facade NEVER
 * rewrites `member_instances` records: the store is append-only per record
 * (P4: a different record at an occupied key is a conflict), member records
 * are written exactly once by the ActivationProvider (invariant 26;
 * CREATED at creation), and the durable commit of lifecycle transitions —
 * including the Architecture §30 quiesce-then-commit procedures — is the
 * P7-T3 lifecycle module's surface (TaskDoc P7-T3: "quiescence 与 durable
 * lifecycle一致"). The facade therefore:
 *
 * - validates every transition with the domain/lifecycle FSM (pure, no
 *   writes) — illegal pairs fail closed with LIFECYCLE_TRANSITION_REJECTED;
 * - commits the transition ONLY through the injected
 *   `LifecycleCommitPort`; without a port (the P6-T2 default wiring)
 *   lifecycle actions fail closed with LIFECYCLE_COMMIT_UNAVAILABLE and
 *   ZERO durable writes, while work admission still commits its evidence
 *   fact and reports `lifecycleCommitted: false`;
 * - keeps STATE FIRST, EVIDENCE SECOND for two-write effects: the port
 *   commit (state) precedes the ledger fact (evidence). A fault between
 *   the two leaves the committed state change without its fact —
 *   detectable and repairable; the inverse order (a fact claiming a change
 *   that never happened) would be false evidence and is avoided by
 *   construction. A fault surfaces as DURABLE_WRITE_FAILED with the exact
 *   downstream fault in `details`.
 *
 * Per-team serialization: all effects of one team are serialized behind a
 * per-team promise chain (the same pattern as the P6-T1 ActivationProvider
 * `withTeamLock`): concurrent actions of the same team see each other's
 * committed state (fresh views), and racing non-creation actions cannot
 * interleave durable writes. Creation actions additionally run inside the
 * provider's own per-team lock (the quota/instance-id protocol), which is
 * nested inside the router lock — no deadlock (the provider never calls
 * back into the router).
 */
import type { MemberInstanceRecordDto } from '../../contracts/src/index.js';
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js';
import type { ExternalPolicyFacts } from '../../domain/policy/src/index.js';
import type { ActivationProvider } from '../activation/index.js';
import type { TeamDomainRepositories } from '../../storage/repositories/index.js';
import type { ActionSpec } from '../admission/actions.js';
import type { ResolvedCaller } from '../admission/resolve.js';
import type { LifecycleCommitPort, RuntimeActionEffect, TeamRuntimeActionRequest, WorkActivityPort, WorkDeliveryPort } from '../admission/types.js';
import type { LifecyclePorts } from '../lifecycle/types.js';
/** Everything one effect execution needs (all read-phase outputs). */
export interface EffectContext {
    readonly repositories: TeamDomainRepositories;
    readonly activationProvider: ActivationProvider;
    readonly externalPolicyFacts: () => Promise<ExternalPolicyFacts>;
    readonly now: () => string;
    readonly spec: ActionSpec;
    readonly request: TeamRuntimeActionRequest;
    readonly rootSessionId: string;
    readonly caller: ResolvedCaller;
    readonly blueprint: TeamBlueprint;
    /** The injected lifecycle transition commit port (absent in the P6-T2
     *  default wiring — see the module docs). */
    readonly lifecycleCommit?: LifecycleCommitPort;
    /** The model-visible work delivery port (P8-S3 work chain; absent in the
     *  P6-T2 default wiring). */
    readonly workDelivery?: WorkDeliveryPort;
    /** The in-facade activity interval writer (P8-S3 work chain; absent in
     *  the P6-T2 default wiring). */
    readonly workActivity?: WorkActivityPort;
    /** The P7-T3 lifecycle step ports (P8-S3 R7/CR-9): router lifecycle
     *  actions run the P7-T3 step ordering through these ports. */
    readonly lifecyclePorts?: LifecyclePorts;
    /** The read-phase target (instance-targeted actions; re-read fresh in the
     *  effect — the fresh view is authoritative). */
    readonly target?: MemberInstanceRecordDto;
}
/**
 * Execute the action's effect under the per-team lock.
 *
 * @param teamLocks - the per-team promise-chain map (owned by the runtime).
 * @param ctx - the effect context.
 * @returns the durable effect (lossless JSON).
 */
export declare function executeEffect(teamLocks: Map<string, Promise<unknown>>, ctx: EffectContext): Promise<RuntimeActionEffect>;
/**
 * Execute the action's effect WITHOUT acquiring the per-team lock — the
 * caller must already hold this runtime's team chain for
 * `ctx.rootSessionId` (P8-S5B: the new-work admission path holds the chain
 * across the compatibility gate AND the effect in one acquisition, so the
 * effect itself must not re-acquire it — chains are not re-entrant).
 *
 * @param ctx - the effect context.
 * @returns the durable effect (lossless JSON).
 */
export declare function executeEffectLocked(ctx: EffectContext): Promise<RuntimeActionEffect>;
/** The per-team promise chain (the P6-T1 lock pattern, reused). */
export declare function withTeamLock<T>(teamLocks: Map<string, Promise<unknown>>, rootSessionId: string, work: () => Promise<T>): Promise<T>;
/**
 * Commit one durable fact (the evidence half of a two-write effect, or the
 * whole effect for coordination actions). The sequence is ALLOCATED through
 * the ledger's atomic counter (the repository rejects unallocated or
 * above-counter sequences — `RECORD_INVALID`).
 */
/**
 * Commit one durable fact to the TeamLedger (the evidence half of a
 * two-write effect, or the whole effect for coordination actions). The
 * sequence is ALLOCATED through the ledger's atomic counter (the
 * repository rejects unallocated or above-counter sequences —
 * `RECORD_INVALID`); a durable fault surfaces as
 * `DURABLE_WRITE_FAILED` with the downstream cause in `details`.
 *
 * Exported (P8-S3): the work chain (`work-execution.ts`) commits its
 * admission/settlement facts through the SAME protocol from the same
 * module — one sequence-allocation owner, one fault mapping. The caller
 * must already hold the router's per-team lock for the root session.
 */
export declare function commitDurableFact(repositories: TeamDomainRepositories, rootSessionId: string, now: () => string, factType: string, payload: Record<string, unknown>): Promise<number>;
//# sourceMappingURL=effects.d.ts.map