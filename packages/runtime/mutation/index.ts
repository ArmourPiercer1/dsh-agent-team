/**
 * P7-T2 — the runtime mutation/provenance module (public surface;
 * reshaped by pre-alpha3 PR-F, plan §F.2).
 *
 * What the PUBLIC surface carries after PR-F:
 *
 * - the frozen mutation/provenance VOCABULARY ({@link ./types.js}): the
 *   record families (PolicyState transitions, Autonomy Overlay, Explicit
 *   Human Override, creation fields, the append-only provenance ledger
 *   and suppression records) and the injected port shapes
 *   (`MutationStore`, `PolicyReader` — the ports the PRODUCTION
 *   governance authority and the canonical policy read consume);
 * - the exported PURE KERNELS ({@link ./service.js}) the production
 *   governance authority ({@link @dsh-agent-team/runtime/governance})
 *   reuses — one closed error surface for intake + durable write;
 * - the §18.3 backend-truth cell provenance derivation
 *   ({@link ./cell-provenance.js});
 * - the narrow durable-governance-override persistence primitive
 *   ({@link ./override-admission.js}) — demoted by pre-alpha3 PR-A from
 *   the production admission authority to the full-slot re-issue +
 *   `put` kernel (the production write authority is the governance
 *   mutation service).
 *
 * What the public surface NO LONGER carries (PR-F): the
 * `MutationService` class, the `StepClock` port, the step-boundary
 * policy assembly, and the frozen-error mapper — all of it moved to the
 * INTERNAL test-world kernel
 * ({@link ./internal/mutation-service.js} +
 * {@link ./internal/policy-adapter.js}); the only consumers are the
 * P7-T2 test family and the legacy integrated admission test world. No
 * production module imports the internal kernel.
 *
 * Pure module: no I/O, no DSH imports, no ambient state.
 *
 * @module @dsh-agent-team/runtime/mutation
 */

export {
  MutationError,
  MUTATION_ERROR_CODES,
  MUTATION_ERROR_CODE_VALUES,
  isMutationError,
} from './errors.js'
export type { MutationErrorCode } from './errors.js'

export {
  MUTATION_ACTOR_KINDS,
  MUTATION_RECORD_KINDS,
  CREATION_FIELDS,
} from './types.js'
export type {
  MutationActor,
  MutationActorKind,
  MutationRequest,
  CreationFieldName,
  CreationFieldMutationRequest,
  PolicyStateTransitionRequest,
  MutationRecordKind,
  StoredMutationRecord,
  PolicyStateTransitionRecord,
  CreationFieldRecord,
  MutationLedgerEntry,
  SuppressionRecord,
  EffectiveConfiguration,
  EffectiveConfigCapture,
  MutationStore,
  PolicyReader,
  BlueprintEnvelopeLike,
  TemplatePolicyLike,
  ExternalFactsLike,
  EffectivePolicyLike,
  HumanOverrideLike,
} from './types.js'

// The frozen-domain vocabulary the module reuses (single source:
// packages/domain/policy) — re-exported so consumers import one place.
export type {
  CapabilityName,
  InstanceId,
  MemberIdentity,
  PolicyEntry,
  PolicyStateView,
  SuppressedOverlayRecord,
  TeamSessionId,
  TeamValueOrigin,
} from '../../domain/policy/src/index.js'

// pre-alpha3 PR-A (the exported pure kernels the production governance
// authority, packages/runtime/governance, reuses) — the ONLY production
// surface of the mutation module after PR-F. The `MutationService` class,
// `MutationServiceDeps`, `mapFrozenError`, and `activePolicyState` moved
// to the INTERNAL test-world kernel ({@link ./internal/mutation-service.js}
// + {@link ./internal/policy-adapter.js}).
export {
  normalizePolicyEntry,
  normalizeStateView,
  checkExternalHardFacts,
} from './service.js'

export {
  memberEnvelopeItems,
  teamEnvelopeItems,
  checkAgainstEnvelope,
} from './envelope.js'

// P8-S4B — the §18.3 backend-truth cell provenance: a pure derivation of
// the six fields (effective / source / suppressed / unavailable / deniedBy
// / pendingNextBoundary) from the frozen resolver output plus the durable
// override records.
export {
  cellProvenance,
  recordAdmitsCapability,
} from './cell-provenance.js'
export type {
  CellDeniedBy,
  CellProvenance,
  CellProvenanceOptions,
  CellSource,
  DurableOverrideRef,
  PendingBoundaryRecord,
} from './cell-provenance.js'

// P8-S4B (demoted by pre-alpha3 PR-A, ADR-03) — the NARROW persistence
// primitive of the durable governance overrides: the full slot re-issue
// (the frozen one-record-per-slot ruling) + the optimistic generation
// guard + the durable `put`. The production write authority is the
// governance mutation service (packages/runtime/governance); this
// primitive is the persistence kernel it composes (and the direct test
// seam).
export {
  persistGovernanceOverride,
  selectSlotWinner,
} from './override-admission.js'
export type {
  AdmittedGovernanceOverride,
  PersistGovernanceOverrideArgs,
  GovernanceOverrideKindView,
  GovernanceOverrideScopeView,
  MutationAuthority,
  OverlayOriginView,
  OverrideRecordView,
  OverrideStorePort,
  SlotIdentity,
} from './override-admission.js'
