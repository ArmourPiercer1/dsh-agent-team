/**
 * @dsh-agent-team/domain/compatibility — the pure compatibility engine.
 *
 * P3-T5 (TaskDoc §11.4): typed requirements, PASS/WARNING/FATAL outcomes,
 * warning acknowledgement bound to mismatch/environment fingerprints,
 * environment-fingerprint drift invalidation, and `complete:true` mandatory
 * FATAL (no downgrade).
 *
 * Requirement is strictly separated from Policy (Architecture §19.1): this
 * module validates and checks typed requirements against environment facts;
 * it never produces a policy decision and never starts any work — its output
 * is a stable typed, canonical-JSON-serializable result only.
 *
 * Pure module: no I/O, no DSH imports, no ambient state (package contract:
 * closed and deterministic).
 * @module @dsh-agent-team/domain/compatibility
 */
// --- typed requirements (closed §27.1 vocabulary) ---------------------------
export { REQUIREMENT_TYPES, REQUIREMENT_TYPE_VALUES, assertRequirementType, parseRequirement, parseRequirements, } from './requirement.js';
// --- environment facts + fingerprints ----------------------------------------
export { parseEnvironmentFact, parseEnvironmentFacts, computeProbeRecords, computeEnvironmentFingerprint, } from './environment-facts.js';
// --- fingerprint --------------------------------------------------------------
export { FINGERPRINT_ALGORITHM_VERSION, NO_PROBE_GENERATION, computeFingerprint, } from './fingerprint.js';
// --- warning acknowledgement (§27.3) ------------------------------------------
export { parseWarningAcknowledgement, parseWarningAcknowledgements } from './acknowledgement.js';
// --- typed result + admission states (§27.2, §28) ------------------------------
export { REQUIREMENT_OUTCOMES, COMPATIBILITY_STATUS, COMPATIBILITY_REASON_CODES, COMPATIBILITY_REASON_CODE_VALUES, ACK_STATUSES, serializeCompatibilityResult, TEAM_CONTRACT_SCHEMA_VERSION, } from './result.js';
// --- engine ---------------------------------------------------------------------
export { evaluateCompatibility, isCompatibilityResultValidForEnvironment } from './engine.js';
//# sourceMappingURL=index.js.map