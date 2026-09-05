/**
 * P7-T2 — runtime mutation/provenance vocabulary and port surface
 * (TaskDoc §11.8 P7-T2; Development Plan §20.2; Architecture §19.4/§19.5/
 * §20/§21).
 *
 * The frozen DevPlan §20.2 "Runtime mutation" contract:
 *
 * ```text
 * model future step
 * permission/tool future operation
 * skills/MCP future operation
 * human override
 * Autonomy Overlay
 * PolicyState suppression/provenance
 *
 * 所有 effective config 都必须可解释 provenance.
 * ```
 *
 * This module implements the RUNTIME half of that contract as a PURE
 * service over four injected ports (no I/O, no DSH imports, no ambient
 * state — the established wave-1 runtime pattern):
 *
 * - {@link StepClock} — the step-boundary clock: the mutation plane reads
 *   `currentStep()`; every admitted mutation takes effect at the NEXT step
 *   boundary (`effectiveFromStep = requestedAtStep + 1`), and already
 *   captured (in-flight) work keeps its step's resolution unchanged
 *   (Architecture §21.3–§21.5: the in-flight request is never re-pointed
 *   at a concurrent override; the change affects FUTURE operations);
 * - {@link MutationStore} — the durable config store of the TeamSession's
 *   mutation records (PolicyState transitions, autonomy overlay records,
 *   human override records, per-instance creation fields, the append-only
 *   provenance ledger and the append-only suppression records). Tests run
 *   an in-memory implementation; the durable binding is a later
 *   integration concern (allowed dependencies: policy + binder adapters);
 * - {@link PolicyReader} — the static reads of the bound Blueprint
 *   snapshot: the Team policy envelope, the member template policy, and
 *   the external hard facts (host ceiling + capability existence).
 *
 * What this module does NOT do:
 *
 * - it never re-implements policy resolution. Stage 1 (Team-domain
 *   precedence) and stage 2 (external intersection) are computed by the
 *   FROZEN P3-T4 resolver (`resolveEffectivePolicy`,
 *   `packages/domain/policy`); {@link ../policy-adapter.js} assembles its
 *   input from the store + reader;
 * - it never invents a parallel origin/provenance taxonomy: every origin,
 *   layer, record, and suppression type reuses the frozen domain
 *   vocabulary (`TeamValueOrigin`, `OverlayOrigin`, `TeamLayer`,
 *   `SuppressedOverlayRecord`, `SuppressionReason`, the two record types
 *   `AutonomyOverlayRecord` / `HumanOverrideRecord`).
 *
 * The closed five capability domains are the frozen policy domains
 * (`model` / `tools` / `permissions` / `skills` / `mcp`) — this module
 * adds no sixth.
 *
 * @module @dsh-agent-team/runtime/mutation/types
 */
import type { CapabilityName, HumanOverrideRecord, InstanceId, MemberIdentity, PolicyEntry, PolicyStateView, SuppressedOverlayRecord, TeamSessionId, TeamValueOrigin } from '../../domain/policy/src/index.js';
/**
 * The closed mutation-actor kinds. Agent autonomy (leader / member) is
 * kept strictly separate from explicit human authority — the same split as
 * the frozen domain's two record types (Architecture §19.4/§19.5).
 */
export declare const MUTATION_ACTOR_KINDS: {
    /** Explicit human authority (UI/API) — produces a HumanOverrideRecord. */
    readonly HUMAN: "human";
    /** The TeamSession's authorized leader — produces a template-scoped
     *  AutonomyOverlayRecord (leader origin). */
    readonly LEADER: "leader";
    /** A member (leader-authorized request, §25.1) — produces an
     *  instance-scoped AutonomyOverlayRecord (member origin). */
    readonly MEMBER: "member";
};
/** One of the closed mutation-actor kinds. */
export type MutationActorKind = (typeof MUTATION_ACTOR_KINDS)[keyof typeof MUTATION_ACTOR_KINDS];
/**
 * One mutation actor. `member` carries the composite identity (invariant
 * 18); `leader` / `human` are TeamSession-level authorities.
 */
export interface MutationActor {
    readonly kind: MutationActorKind;
    /** Required (and checked) when `kind` is `'member'`. */
    readonly member?: MemberIdentity;
}
/**
 * One capability mutation request: change the Team-owned value of ONE
 * capability cell for a TeamSession (agent origins) or for a TeamSession /
 * one instance (human origin).
 *
 * Admitted requests are FUTURE-BOUNDARY mutations: they take effect from
 * the next step boundary; in-flight (already captured) work is unaffected
 * (see the module doc).
 */
export interface MutationRequest {
    readonly teamSessionId: TeamSessionId;
    readonly capability: CapabilityName;
    readonly value: PolicyEntry;
    readonly actor: MutationActor;
    /**
     * Human-origin only: the override scope. `'team'` (default) applies to
     * every member; `'instance'` applies to one MemberInstance (the actor's
     * scope selection the frozen resolver expects from its caller: the
     * instance-scoped record when present, else the team-scoped one).
     * Ignored (and rejected) for agent origins — their scopes are fixed by
     * the actor kind (leader → template, member → instance).
     */
    readonly scope?: 'team' | 'instance';
    /**
     * Human-origin + `scope: 'instance'` ONLY: the target MemberInstance the
     * instance-scoped override applies to. Malformed when absent for that
     * combination, or present for any other combination (agent scopes are
     * fixed by the actor kind; team-scoped human overrides carry none).
     */
    readonly targetMember?: MemberIdentity;
}
/** The closed creation-field names (Architecture §21.2/§21.6). */
export declare const CREATION_FIELDS: {
    /** §21.2: creation-mutable, immutable after first RUNNING. */
    readonly WORKSPACE: "workspace";
    /** §21.6: immutable after MemberInstance creation. */
    readonly CONTEXT_POLICY: "contextPolicy";
};
/** One of the closed creation-field names. */
export type CreationFieldName = (typeof CREATION_FIELDS)[keyof typeof CREATION_FIELDS];
/**
 * One illegal post-creation change attempt of a creation field. Rejected
 * with `IMMUTABLE_CREATION_FIELD` per the frozen §21.2/§21.6 rules; the
 * only admitted window is a workspace change BEFORE the instance's first
 * RUNNING (creation-mutable).
 */
export interface CreationFieldMutationRequest {
    readonly teamSessionId: TeamSessionId;
    readonly member: MemberIdentity;
    readonly field: CreationFieldName;
    readonly value: string;
}
/**
 * One explicit PolicyState transition (Architecture §20.4, invariant 40:
 * ONLY explicit human / authorized-leader transitions exist in vNext).
 * The transition is itself a future-boundary mutation: it takes effect
 * from the next step boundary; in-flight captures keep the previous
 * state's resolution.
 */
export interface PolicyStateTransitionRequest {
    readonly teamSessionId: TeamSessionId;
    /** The target state (validated against the frozen state shape). */
    readonly target: PolicyStateView;
    readonly actor: MutationActor;
}
/**
 * The closed durable record kinds. Agent autonomy is ONE record family
 * ({@link StoredMutationRecord} with the two overlay kinds — the frozen
 * `AutonomyOverlayRecord` shape); human authority is the separate
 * family (the frozen `HumanOverrideRecord` shape).
 */
export declare const MUTATION_RECORD_KINDS: {
    /** Leader-origin, template-scoped (TeamSession-wide) overlay. */
    readonly TEMPLATE_OVERLAY: "templateOverlay";
    /** Member-origin, instance-scoped overlay. */
    readonly INSTANCE_OVERLAY: "instanceOverlay";
    /** Human-origin override (team- or instance-scoped). */
    readonly HUMAN_OVERRIDE: "humanOverride";
};
/** One of the closed durable mutation record kinds. */
export type MutationRecordKind = (typeof MUTATION_RECORD_KINDS)[keyof typeof MUTATION_RECORD_KINDS];
/**
 * The durable record of one admitted mutation: the latest-wins value row
 * for its (record kind, scope) slot as of `effectiveFromStep`, plus the
 * step provenance. Append-only: a later mutation of the same cell creates
 * a NEW record; the adapter picks the latest one effective at a step.
 *
 * The provenance origin reuses the frozen `TeamValueOrigin` (leader /
 * member / human — never conflate agent autonomy with human authority).
 */
export interface StoredMutationRecord {
    /** Stable id of the durable record (auditable; becomes the domain
     *  record's `overlayId` / `overrideId` in the adapter). */
    readonly recordId: string;
    readonly kind: MutationRecordKind;
    /** The override/overlay scope (`'team'` for template overlays and
     *  team-scoped human overrides; `'instance'` otherwise). */
    readonly scope: 'team' | 'instance';
    /** The instance scope holder (present iff `scope` is `'instance'`;
     *  `null` for team-scoped records — team-scoped template overlays and
     *  team-scoped human overrides carry no instance. Stored as `null`,
     *  never `undefined`: the record is deep-frozen, which requires
     *  lossless-JSON values). */
    readonly member: MemberIdentity | null;
    readonly origin: TeamValueOrigin;
    /** The per-cell values the record claims (its capability cell is
     *  updated by later same-slot records — never here). */
    readonly values: Partial<Record<CapabilityName, PolicyEntry>>;
    /** The step at which the mutation was admitted. */
    readonly requestedAtStep: number;
    /** The first step at which this record is effective (future boundary). */
    readonly effectiveFromStep: number;
}
/** The durable record of one explicit PolicyState transition. */
export interface PolicyStateTransitionRecord {
    /** Stable id of the ledger entry this transition produced. */
    readonly entryId: string;
    readonly origin: TeamValueOrigin;
    readonly state: PolicyStateView;
    readonly requestedAtStep: number;
    readonly effectiveFromStep: number;
}
/**
 * The per-MemberInstance creation fields (Architecture §11/§21.2/§21.6):
 * registered once at creation; `contextPolicy` is immutable from that
 * moment, `workspace` is mutable until the instance's first RUNNING.
 */
export interface CreationFieldRecord {
    readonly instanceId: InstanceId;
    readonly workspace: string;
    readonly contextPolicy: string;
    /** Whether the instance has reached first RUNNING (workspace locked). */
    readonly running: boolean;
}
/**
 * One APPEND-ONLY provenance ledger entry: an admitted mutation (or state
 * transition) with its full source — who (origin), which durable record /
 * state (recordId / stateId), which cell (capability), which value, and
 * the step boundary at which it took effect. Together with the frozen
 * resolver's per-cell provenance (`layer` / `origin` / `recordId` /
 * `explanation`) this satisfies the card acceptance: every effective
 * configuration item resolves to an explainable source chain
 * (blueprint/template → policy state → autonomy overlay → human override).
 */
export interface MutationLedgerEntry {
    /** Stable id of the ledger entry. */
    readonly entryId: string;
    readonly teamSessionId: TeamSessionId;
    /** The affected cell (absent for state transitions and creation-field
     *  changes). */
    readonly capability?: CapabilityName;
    /** The durable record kind, or `'policyStateTransition'`, or
     *  `'creationField'` (an admitted pre-first-RUNNING workspace change). */
    readonly recordKind: MutationRecordKind | 'policyStateTransition' | 'creationField';
    readonly origin: TeamValueOrigin;
    /** The admitted value (absent for state transitions and creation-field
     *  changes). */
    readonly value?: PolicyEntry;
    /** The state id (present for state transitions). */
    readonly stateId?: string;
    /** The durable record the entry produced (absent for transitions). */
    readonly recordId?: string;
    /** The creation field (present for `'creationField'` entries). */
    readonly field?: CreationFieldName;
    /** The instance the entry applies to (present for `'creationField'`
     *  entries). */
    readonly instanceId?: InstanceId;
    /** The admitted string value (present for `'creationField'` entries). */
    readonly fieldValue?: string;
    readonly requestedAtStep: number;
    readonly effectiveFromStep: number;
}
/**
 * One recorded suppression (the frozen `SuppressedOverlayRecord` plus the
 * step at which the service first observed it). A suppressed overlay is
 * NEVER destructively deleted (§19.4 "stored but suppressed"): the durable
 * record stays in the store, and a later relaxing state makes it effective
 * again; this record is the audit trail of WHY it was suppressed.
 */
export type SuppressionRecord = SuppressedOverlayRecord & {
    /** The step at which the service first recorded this suppression. */
    readonly recordedAtStep: number;
};
/**
 * The EFFECTIVE CONFIGURATION of one member at one step: the frozen
 * resolver's fully-explained `EffectivePolicy` (every cell carries
 * `layer` / `origin` / `recordId` / `explanation` + the stage-2 external
 * facts) plus this module's source chain — every provenance ledger entry
 * in force at that step (the `recordId` → who/when mapping) and the
 * stored-but-suppressed overlays (reasons preserved).
 */
export interface EffectiveConfiguration {
    readonly teamSessionId: TeamSessionId;
    readonly member: MemberIdentity;
    /** The step the configuration was resolved for. */
    readonly step: number;
    /** The frozen resolver output (deep-frozen, deterministic). */
    readonly policy: EffectivePolicyLike;
    /** Every provenance ledger entry with `effectiveFromStep <= step`,
     *  in (requestedAtStep, entryId) order. */
    readonly contributions: readonly MutationLedgerEntry[];
    /** The stored-but-suppressed overlays as of this step (frozen domain
     *  records; empty when nothing is suppressed). */
    readonly suppressed: readonly SuppressedOverlayRecord[];
}
/**
 * The in-flight CAPTURE of one admitted step: the effective configuration
 * resolved at the step boundary. In-flight work holds this object — it is
 * a frozen value that later mutations NEVER touch (the DevPlan §20.2 /
 * §18.4 future-boundary contract generalized to all five domains);
 * `release()` marks the step's work as settled.
 */
export interface EffectiveConfigCapture {
    readonly teamSessionId: TeamSessionId;
    readonly member: MemberIdentity;
    readonly step: number;
    readonly policy: EffectivePolicyLike;
    readonly contributions: readonly MutationLedgerEntry[];
    /** Settle the step's in-flight work (idempotent). */
    release(): void;
}
/**
 * The STEP-BOUNDARY clock. The mutation plane never advances it (steps are
 * driven by the harness / admission pipeline — a later integration
 * concern); it only reads it. `0` = before the first step.
 */
export interface StepClock {
    /** The step currently in progress (0 before the first step). */
    currentStep(): number;
}
/**
 * The Durable CONFIG STORE port: the TeamSession's mutation records,
 * creation fields, and the two append-only provenance logs. Implementations
 * must be deterministic and lossless-JSON clean; this module never inspects
 * the backing medium.
 */
export interface MutationStore {
    /** All PolicyState transitions of the session, in admission order. */
    listTransitions(teamSessionId: TeamSessionId): readonly PolicyStateTransitionRecord[];
    appendTransition(teamSessionId: TeamSessionId, transition: PolicyStateTransitionRecord): void;
    /** All durable mutation records, in admission order. */
    listRecords(teamSessionId: TeamSessionId): readonly StoredMutationRecord[];
    appendRecord(teamSessionId: TeamSessionId, record: StoredMutationRecord): void;
    /** The registered creation fields of one instance (undefined when the
     *  instance was never registered). */
    getCreationFields(teamSessionId: TeamSessionId, instanceId: InstanceId): CreationFieldRecord | undefined;
    registerCreationFields(teamSessionId: TeamSessionId, member: MemberIdentity, fields: {
        readonly workspace: string;
        readonly contextPolicy: string;
    }): void;
    /** A pre-first-RUNNING workspace change (the admitted creation-mutable
     *  window, §21.2). */
    setWorkspace(teamSessionId: TeamSessionId, instanceId: InstanceId, workspace: string): void;
    /** Whether the instance reached first RUNNING (workspace locked). */
    isRunning(teamSessionId: TeamSessionId, instanceId: InstanceId): boolean;
    /** Mark first RUNNING (idempotent). */
    markRunning(teamSessionId: TeamSessionId, instanceId: InstanceId): void;
    /** The instance ids with registered creation fields (stable order). */
    listInstances(teamSessionId: TeamSessionId): readonly InstanceId[];
    /** The append-only provenance ledger, in admission order. */
    listLedger(teamSessionId: TeamSessionId): readonly MutationLedgerEntry[];
    appendLedger(teamSessionId: TeamSessionId, entry: MutationLedgerEntry): void;
    /** The append-only suppression records, in first-observation order. */
    listSuppressions(teamSessionId: TeamSessionId): readonly SuppressionRecord[];
    appendSuppression(teamSessionId: TeamSessionId, record: SuppressionRecord): void;
}
/**
 * The STATIC POLICY READER port: the bound Blueprint snapshot's Team policy
 * envelope, the member's template policy, and the external hard facts
 * (host ceiling + capability-existence probe). Reading the facts is the
 * compatibility engine's job (P3-T5); this module consumes what it is
 * given (Architecture §19.2/§19.6 stage 2).
 */
export interface PolicyReader {
    /** The bound Blueprint snapshot's Team-level policy envelope. */
    readBlueprintEnvelope(teamSessionId: TeamSessionId): BlueprintEnvelopeLike;
    /** The resolved member's template policy. */
    readTemplatePolicy(teamSessionId: TeamSessionId, member: MemberIdentity): TemplatePolicyLike;
    /** The external hard facts for the TeamSession. */
    readExternalFacts(teamSessionId: TeamSessionId): ExternalFactsLike;
}
/** The frozen policy state view (re-exported for port consumers). */
export type { CapabilityName, InstanceId, MemberIdentity, PolicyEntry, PolicyStateView, SuppressedOverlayRecord, TeamSessionId, TeamValueOrigin, } from '../../domain/policy/src/index.js';
/** The frozen blueprint envelope shape (alias keeps port docs local). */
export type BlueprintEnvelopeLike = import('../../domain/policy/src/index.js').BlueprintPolicyEnvelope;
/** The frozen template policy shape. */
export type TemplatePolicyLike = import('../../domain/policy/src/index.js').TemplatePolicy;
/** The frozen external hard facts shape. */
export type ExternalFactsLike = import('../../domain/policy/src/index.js').ExternalPolicyFacts;
/** The frozen resolver output shape (the provenance-rich effective policy). */
export type EffectivePolicyLike = import('../../domain/policy/src/index.js').EffectivePolicy;
/** The frozen human override record (the adapter's output row). */
export type HumanOverrideLike = HumanOverrideRecord;
//# sourceMappingURL=types.d.ts.map