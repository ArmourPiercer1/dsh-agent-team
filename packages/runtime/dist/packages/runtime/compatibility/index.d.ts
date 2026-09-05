/**
 * @dsh-agent-team/runtime/compatibility — probe generation, warning ACK
 * fingerprint, and capability drift → new work admission (P7-T1).
 *
 * The runtime half of the Architecture §27/§28 + Development Plan §20.1
 * contract, composed over the pure P3 compatibility engine
 * (`@dsh-agent-team/domain/compatibility`) and the durable TeamDomain
 * `compatibility` store (`@dsh-agent-team/storage`):
 *
 * - **probe generation** — the five frozen re-probe triggers (DevPlan
 *   §20.1) each run a fresh facts read + engine evaluation and replace the
 *   durable state at generation + 1, bound to the new environment
 *   fingerprint;
 * - **warning ACK fingerprint** (Architecture §27.3) — an acknowledgement
 *   binds to the CURRENT mismatch + environment fingerprint pair; drift
 *   invalidates it (the engine re-classifies VALID/STALE/MISSING on every
 *   evaluation); FATAL is never ack-able (§27.2);
 * - **drift → new work admission** (DevPlan §20.1, Architecture §28.1/
 *   §28.2/§41.7) — a stale/absent generation forces a re-probe before new
 *   work is admitted; BLOCKED_WARNING / BLOCKED_FATAL block NEW work;
 *   already admitted work may still settle (the settle path never reads
 *   the compatibility state).
 *
 * This module only classifies and gates — it never starts, admits, or
 * cancels any model/tool operation itself; the admission pipeline
 * consumes `enforceNewWorkAdmission` / `admitNewWork` as its
 * compatibility check-point (the P6 admission hand-off contract).
 *
 * @module @dsh-agent-team/runtime/compatibility
 */
export { COMPATIBILITY_ERROR_CODES, CompatibilityError, isCompatibilityError, } from './errors.js';
export { BLUEPRINT_DOMAIN_TO_REQUIREMENT_TYPE, compatibilityRequirementsOf, } from './blueprint.js';
export { classifyDrift } from './drift.js';
export { createCompatibilityProber } from './probe.js';
export type { CompatibilityProberDeps } from './probe.js';
export { createCompatibilityAuthority, REPROBE_REASONS, } from './authority.js';
export type { BlockingRequirementSummary, CompatibilityAdmissionDecision, CompatibilityAdmit, CompatibilityAuthority, CompatibilityAuthorityAdmitOptions, CompatibilityAuthorityOptions, CompatibilityBlock, CompatibilityReprobe, ReprobeReason, } from './authority.js';
export { DRIFT_KINDS, PROBE_TRIGGERS, PROBE_TRIGGER_VALUES, } from './types.js';
export type { AcknowledgeInput, AdmittedWork, CompatibilityProber, CompatibilityVerdict, DriftKind, DriftObservation, NewWorkDecision, ProbeOutcome, ProbeTrigger, SettleRecord, } from './types.js';
//# sourceMappingURL=index.d.ts.map