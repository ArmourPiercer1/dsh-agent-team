/**
 * The typed compatibility result.
 *
 * The engine's output is a stable, closed, canonical-JSON-serializable
 * record (TaskDoc §11.4 P3-T5 acceptance: "兼容性输出稳定typed result").
 * It is plain lossless-JSON data —deep-frozen on construction —so it can
 * cross package/wire/storage boundaries unchanged and later be persisted by
 * TeamDomain (Architecture §14.3 E: current compatibility facts/fingerprint,
 * warning acknowledgement, acknowledgement provenance, staleness/generation).
 *
 * **Admission classification** (Architecture §28): the result carries the
 * logical Admission State with the frozen semantics (names per §28, which
 * allows implementation-adjusted enum names but fixed semantics):
 *
 * ```text
 * OPEN                    —no warning, no fatal
 * BLOCKED_WARNING         —at least one WARNING not validly acknowledged
 * BLOCKED_FATAL           —at least one FATAL (never ack-able, §27.2)
 * DEGRADED_ACKNOWLEDGED   —warnings only, every one validly acknowledged
 * ```
 *
 * The engine only classifies: it never starts, admits, or cancels any work
 * (Architecture §28.2/§28.3 gate enforcement belongs to the runtime).
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/compatibility/result
 */
import { TEAM_CONTRACT_SCHEMA_VERSION, canonicalJsonStringify, } from '../../../contracts/src/index.js';
/** The three per-requirement compatibility outcomes (Architecture §27.2). */
export const REQUIREMENT_OUTCOMES = {
    PASS: 'PASS',
    WARNING: 'WARNING',
    FATAL: 'FATAL',
};
/** The logical admission states (Architecture §28; semantics fixed). */
export const COMPATIBILITY_STATUS = {
    OPEN: 'OPEN',
    BLOCKED_WARNING: 'BLOCKED_WARNING',
    BLOCKED_FATAL: 'BLOCKED_FATAL',
    DEGRADED_ACKNOWLEDGED: 'DEGRADED_ACKNOWLEDGED',
};
/**
 * The closed reason-code vocabulary of per-requirement outcomes.
 *
 * `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` is the architecture-named code
 * frozen in contracts v1 (Architecture §13.5: AgentPreset effective persona
 * `complete:true` => structural FATAL); the engine reports it verbatim.
 */
export const COMPATIBILITY_REASON_CODES = {
    /** All required subjects available. */
    SATISFIED: 'SATISFIED',
    /** Ordinary capability mismatch (tool/skill/MCP/model route unavailable) —WARNING. */
    CAPABILITY_UNAVAILABLE: 'CAPABILITY_UNAVAILABLE',
    /** Structural Team capability missing (persistence, lifecycle seam, Leader/Member surface) —FATAL. */
    STRUCTURAL_CAPABILITY_MISSING: 'STRUCTURAL_CAPABILITY_MISSING',
    /** Persona/runtime-context compatibility cannot be established safely —FATAL. */
    PERSONA_INCOMPATIBLE: 'PERSONA_INCOMPATIBLE',
    /** AgentPreset effective persona is complete:true —structural FATAL (frozen contracts v1 code). */
    TEAM_PERSONA_COMPLETE_PRESET_CONFLICT: 'TEAM_PERSONA_COMPLETE_PRESET_CONFLICT',
    /** Any other complete:true requirement unmet —mandatory FATAL, no downgrade. */
    COMPLETE_REQUIREMENT_NOT_MET: 'COMPLETE_REQUIREMENT_NOT_MET',
};
/** Every reason-code value, for membership checks and closed-set tests. */
export const COMPATIBILITY_REASON_CODE_VALUES = Object.values(COMPATIBILITY_REASON_CODES);
/** How an acknowledgement applies to the WARNING it targets (Architecture §27.3). */
export const ACK_STATUSES = {
    /** Bound to this exact mismatch/environment generation —satisfies the warning. */
    VALID: 'VALID',
    /** Once bound, but the mismatch or environment generation drifted —no longer covers. */
    STALE: 'STALE',
    /** No acknowledgement targets this warning. */
    MISSING: 'MISSING',
};
/**
 * Serialize a compatibility result to canonical JSON (stable key order,
 * byte-identical for equal results).
 * @param result - the result to serialize.
 * @returns the canonical JSON text.
 */
export function serializeCompatibilityResult(result) {
    return canonicalJsonStringify(result);
}
/** Re-export for consumers that stamp results with the contract version. */
export { TEAM_CONTRACT_SCHEMA_VERSION };
//# sourceMappingURL=result.js.map