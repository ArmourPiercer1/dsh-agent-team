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
 * ({@link ./cell-provenance.js}) and the durable governance override
 * persistence primitive ({@link ./override-admission.js}) — demoted by
 * pre-alpha3 PR-A from the production admission authority to the narrow
 * full-slot re-issue + `put` kernel (the production authority is now
 * {@link @dsh-agent-team/runtime/governance}).
 *
 * @module @dsh-agent-team/runtime/mutation
 */
export { MutationError, MUTATION_ERROR_CODES, MUTATION_ERROR_CODE_VALUES, isMutationError, } from './errors.js';
export { MUTATION_ACTOR_KINDS, MUTATION_RECORD_KINDS, CREATION_FIELDS, } from './types.js';
export { MutationService, mapFrozenError, activePolicyState, 
// pre-alpha3 PR-A — the exported pure kernels the production governance
// authority (packages/runtime/governance) reuses:
normalizePolicyEntry, normalizeStateView, checkExternalHardFacts, } from './service.js';
export { memberEnvelopeItems, teamEnvelopeItems, checkAgainstEnvelope, } from './envelope.js';
// P8-S4B — the §18.3 backend-truth cell provenance: a pure derivation of
// the six fields (effective / source / suppressed / unavailable / deniedBy
// / pendingNextBoundary) from the frozen resolver output plus the durable
// override records.
export { cellProvenance, recordAdmitsCapability, } from './cell-provenance.js';
// P8-S4B (demoted by pre-alpha3 PR-A, ADR-03) — the NARROW persistence
// primitive of the durable governance overrides: the full slot re-issue
// (the frozen one-record-per-slot ruling) + the optimistic generation
// guard + the durable `put`. The production write authority is the
// governance mutation service (packages/runtime/governance); this
// primitive is the persistence kernel it composes (and the direct test
// seam).
export { persistGovernanceOverride, selectSlotWinner, } from './override-admission.js';
//# sourceMappingURL=index.js.map