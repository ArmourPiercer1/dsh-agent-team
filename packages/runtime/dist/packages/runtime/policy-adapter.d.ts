/**
 * P7-T2 — the runtime-side policy adapter: assemble the FROZEN resolver's
 * `EffectivePolicyInput` from the mutation store + the static policy
 * reader, as of one step boundary.
 *
 * This module is the single seam between the runtime's append-only durable
 * records and the P3-T4 resolver: the resolver is reused VERBATIM (never
 * re-implemented); the adapter only selects WHICH stored records are
 * effective at the given step and maps them onto the frozen input shape:
 *
 * - `policyState` — the LATEST admitted PolicyState transition with
 *   `effectiveFromStep <= atStep` (future boundary), else the implicit
 *   `{ stateId: 'default' }` (Architecture §20.3 simple blueprints);
 * - `templateOverlay` — the latest TEMPLATE_OVERLAY record per capability
 *   effective at `atStep` (leader origin, team-scoped);
 * - `instanceOverlay` — the latest INSTANCE_OVERLAY record per capability
 *   of the member, effective at `atStep` (member origin, instance-scoped);
 * - `humanOverride` — per capability: the latest instance-scoped HUMAN
 *   override record of the member effective at `atStep` when present,
 *   else the latest team-scoped record (the caller-selection rule the
 *   frozen `HumanOverrideRecord` doc states);
 * - `blueprint` / `template` / `external` — the static facts from the
 *   reader (bound Blueprint snapshot + host facts).
 *
 * Record selection is pure: latest = LAST in the store's admission order
 * among the records effective at the step (admission order is monotone in
 * `requestedAtStep` within one service lifetime, so "last admitted" is
 * "latest"). The assembled overlay/override record id is the
 * `recordId` of the LATEST contributing durable record — the per-capability
 * precise record mapping lives in the provenance ledger (the service's
 * `contributions`), which the card acceptance reads for the source chain.
 *
 * @module @dsh-agent-team/runtime/policy-adapter
 */
import type { AutonomyOverlayRecord, EffectivePolicyInput, HumanOverrideRecord, InstanceId, MemberIdentity, PolicyStateView, TeamSessionId } from '../domain/policy/src/index.js';
import type { MutationRecordKind, MutationStore, PolicyReader, PolicyStateTransitionRecord, StoredMutationRecord } from './mutation/types.js';
/** The arguments of {@link assembleEffectivePolicyInput}. */
export interface AssembleEffectivePolicyInputArgs {
    /** The TeamSession being resolved (the member's root, invariant 9). */
    readonly teamSessionId: TeamSessionId;
    /** The member being resolved (the service validated it is in-team). */
    readonly member: MemberIdentity;
    /** The step boundary the input is assembled for. */
    readonly atStep: number;
    /** The durable config store (records + transitions). */
    readonly store: MutationStore;
    /** The static policy reader (blueprint envelope / template / external). */
    readonly policy: PolicyReader;
}
/**
 * Assemble the frozen resolver input for one member at one step. The
 * caller (the service) has already validated `teamSessionId` / `member`
 * (identity boundary) — this function is pure assembly.
 */
export declare function assembleEffectivePolicyInput(args: AssembleEffectivePolicyInputArgs): EffectivePolicyInput;
/** The latest record effective at `atStep` (last in admission order). */
export declare function latestEffective<T extends {
    readonly effectiveFromStep: number;
}>(records: readonly T[], effectiveFromStepOf: (record: T) => number, atStep: number): T | undefined;
/**
 * Assemble the frozen {@link AutonomyOverlayRecord} for one slot from the
 * store's durable records: per capability, the latest record of the slot
 * effective at `atStep`; `undefined` when no record of the slot is
 * effective. `instanceId` restricts the slot to one instance (the
 * instance overlay); `undefined` keeps the team-scoped slot.
 */
export declare function assembleOverlay(records: readonly StoredMutationRecord[], kind: MutationRecordKind, atStep: number, instanceId?: InstanceId): AutonomyOverlayRecord | undefined;
/**
 * Assemble the frozen {@link HumanOverrideRecord} for one member from the
 * store's durable records: per capability, the latest instance-scoped
 * record of the member effective at `atStep` when present, else the
 * latest team-scoped record (the frozen caller-selection rule). The
 * assembled `scope` is `'instance'` when any instance-scoped record won a
 * capability, else `'team'`; the id is the latest contributing durable
 * record (last in admission order).
 */
export declare function assembleHumanOverride(records: readonly StoredMutationRecord[], instanceId: InstanceId, atStep: number): HumanOverrideRecord | undefined;
/**
 * The policy-state transition selection (exported for the service's
 * suppression bookkeeping and for tests).
 */
export declare function activePolicyState(transitions: readonly PolicyStateTransitionRecord[], atStep: number): PolicyStateView;
//# sourceMappingURL=policy-adapter.d.ts.map