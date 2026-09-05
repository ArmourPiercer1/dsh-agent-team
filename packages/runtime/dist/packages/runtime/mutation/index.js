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
export { MUTATION_ACTOR_KINDS, MUTATION_RECORD_KINDS, CREATION_FIELDS, } from './types.js';
export { MutationService, mapFrozenError, activePolicyState, } from './service.js';
export { memberEnvelopeItems, teamEnvelopeItems, checkAgainstEnvelope, } from './envelope.js';
// P8-S4B — the §18.3 backend-truth cell provenance: a pure derivation of
// the six fields (effective / source / suppressed / unavailable / deniedBy
// / pendingNextBoundary) from the frozen resolver output plus the durable
// override records.
export { cellProvenance, recordAdmitsCapability, } from './cell-provenance.js';
// P8-S4B — the governance override admission authority (§20.3/§20.4):
// validates the acting authority, re-issues the full slot value set (the
// frozen one-record-per-slot ruling), and persists through an injected
// store port.
export { admitGovernanceOverride, selectSlotWinner, } from './override-admission.js';
//# sourceMappingURL=index.js.map