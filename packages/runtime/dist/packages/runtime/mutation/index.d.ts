/**
 * P7-T2 — the runtime mutation/provenance module (public surface).
 *
 * The runtime half of the frozen DevPlan §20.2 "Runtime mutation"
 * contract: future-boundary mutation of the five capability domains
 * (model / tools / permissions / skills / mcp), PolicyState transitions
 * with lazy non-destructive suppression, the Autonomy Overlay and
 * Explicit Human Override record families, and fully-explained effective
 * configuration (every item resolves to a source chain — the frozen
 * P3-T4 resolver's per-cell provenance plus this module's provenance
 * ledger).
 *
 * Pure module: no I/O, no DSH imports, no ambient state. The service is
 * constructed over injected ports (clock / store / reader) — see
 * {@link ./service.js} and {@link ./types.js}.
 *
 * P8-S4B additions: the §18.3 backend-truth cell provenance derivation
 * ({@link ./cell-provenance.js}) and the governance override admission
 * authority — the backend writer the frozen policy layer re-reads at every
 * future Agent request boundary ({@link ./override-admission.js}).
 *
 * @module @dsh-agent-team/runtime/mutation
 */
export { MutationError, MUTATION_ERROR_CODES, MUTATION_ERROR_CODE_VALUES, isMutationError, } from './errors.js';
export type { MutationErrorCode } from './errors.js';
export { MUTATION_ACTOR_KINDS, MUTATION_RECORD_KINDS, CREATION_FIELDS, } from './types.js';
export type { MutationActor, MutationActorKind, MutationRequest, CreationFieldName, CreationFieldMutationRequest, PolicyStateTransitionRequest, MutationRecordKind, StoredMutationRecord, PolicyStateTransitionRecord, CreationFieldRecord, MutationLedgerEntry, SuppressionRecord, EffectiveConfiguration, EffectiveConfigCapture, StepClock, MutationStore, PolicyReader, BlueprintEnvelopeLike, TemplatePolicyLike, ExternalFactsLike, EffectivePolicyLike, HumanOverrideLike, } from './types.js';
export type { CapabilityName, InstanceId, MemberIdentity, PolicyEntry, PolicyStateView, SuppressedOverlayRecord, TeamSessionId, TeamValueOrigin, } from '../../domain/policy/src/index.js';
export { MutationService, mapFrozenError, activePolicyState, } from './service.js';
export type { MutationServiceDeps } from './service.js';
export { memberEnvelopeItems, teamEnvelopeItems, checkAgainstEnvelope, } from './envelope.js';
export { cellProvenance, recordAdmitsCapability, } from './cell-provenance.js';
export type { CellDeniedBy, CellProvenance, CellProvenanceOptions, CellSource, DurableOverrideRef, PendingBoundaryRecord, } from './cell-provenance.js';
export { admitGovernanceOverride, selectSlotWinner, } from './override-admission.js';
export type { AdmittedGovernanceOverride, AdmitGovernanceOverrideArgs, GovernanceOverrideKindView, GovernanceOverrideScopeView, MutationAuthority, OverlayOriginView, OverrideRecordView, OverrideStorePort, SlotIdentity, } from './override-admission.js';
//# sourceMappingURL=index.d.ts.map