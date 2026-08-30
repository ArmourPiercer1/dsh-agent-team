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

import {
  TEAM_CONTRACT_SCHEMA_VERSION,
  canonicalJsonStringify,
} from '../../../contracts/src/index.js'
import type { TeamContractSchemaVersion } from '../../../contracts/src/index.js'
import type { RequirementType } from './requirement.js'
import type { WarningAcknowledgement } from './acknowledgement.js'

/** The three per-requirement compatibility outcomes (Architecture §27.2). */
export const REQUIREMENT_OUTCOMES = {
  PASS: 'PASS',
  WARNING: 'WARNING',
  FATAL: 'FATAL',
} as const

/** A per-requirement outcome from the closed §27.2 set. */
export type RequirementOutcome = (typeof REQUIREMENT_OUTCOMES)[keyof typeof REQUIREMENT_OUTCOMES]

/** The logical admission states (Architecture §28; semantics fixed). */
export const COMPATIBILITY_STATUS = {
  OPEN: 'OPEN',
  BLOCKED_WARNING: 'BLOCKED_WARNING',
  BLOCKED_FATAL: 'BLOCKED_FATAL',
  DEGRADED_ACKNOWLEDGED: 'DEGRADED_ACKNOWLEDGED',
} as const

/** A logical admission state the result classifies into. */
export type CompatibilityStatus = (typeof COMPATIBILITY_STATUS)[keyof typeof COMPATIBILITY_STATUS]

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
} as const

/** A reason code from the closed vocabulary. */
export type CompatibilityReasonCode =
  (typeof COMPATIBILITY_REASON_CODES)[keyof typeof COMPATIBILITY_REASON_CODES]

/** Every reason-code value, for membership checks and closed-set tests. */
export const COMPATIBILITY_REASON_CODE_VALUES: readonly string[] = Object.values(
  COMPATIBILITY_REASON_CODES,
)

/** How an acknowledgement applies to the WARNING it targets (Architecture §27.3). */
export const ACK_STATUSES = {
  /** Bound to this exact mismatch/environment generation —satisfies the warning. */
  VALID: 'VALID',
  /** Once bound, but the mismatch or environment generation drifted —no longer covers. */
  STALE: 'STALE',
  /** No acknowledgement targets this warning. */
  MISSING: 'MISSING',
} as const

/** An acknowledgement applicability status. */
export type AckStatus = (typeof ACK_STATUSES)[keyof typeof ACK_STATUSES]

/** The applicability of an acknowledgement to one WARNING outcome. */
export interface WarningAcknowledgementRef {
  readonly status: AckStatus
  /** The ack object when status is VALID or STALE; `null` when MISSING. */
  readonly acknowledgement: WarningAcknowledgement | null
}

/** The typed per-requirement outcome. */
export interface RequirementResult {
  readonly requirementId: string
  readonly type: RequirementType
  /** Whether the requirement carried `complete:true`. */
  readonly complete: boolean
  readonly outcome: RequirementOutcome
  readonly reasonCode: CompatibilityReasonCode
  /** Deterministic, human-readable explanation (no timestamps). */
  readonly detail: string
  /** Typed detail: the subjects that were unavailable (empty for PASS). */
  readonly unavailableSubjects: readonly string[]
  /** Mismatch fingerprint of this outcome; `null` for PASS (nothing to bind an ack to). */
  readonly mismatchFingerprint: string | null
  /** Ack applicability; only present for WARNING outcomes. */
  readonly acknowledgement: WarningAcknowledgementRef | null
}

/** Aggregate counters of one result (stable order, all plain numbers). */
export interface CompatibilityResultCounts {
  readonly pass: number
  readonly warning: number
  readonly fatal: number
  /** WARNINGs without a VALID ack (MISSING or STALE) —these block admission. */
  readonly unackedWarning: number
  /** WARNINGs whose ack is STALE (drifted). */
  readonly staleAcknowledgement: number
}

/** The stable typed compatibility result of one evaluation. */
export interface CompatibilityResult {
  /** Stamped with the contracts v1 schema version (this result travels with v1 vocabulary). */
  readonly schemaVersion: TeamContractSchemaVersion
  /** Fingerprint of the relevant environment facts this result was computed from. */
  readonly environmentFingerprint: string
  /** The logical admission state (§28) derived from the outcomes. */
  readonly status: CompatibilityStatus
  /** One typed outcome per requirement, in input order. */
  readonly requirements: readonly RequirementResult[]
  readonly counts: CompatibilityResultCounts
  /** Acks that did not apply to any WARNING (duplicate, or targeting PASS/FATAL) —reported, never acted on. */
  readonly unappliedAcknowledgements: readonly WarningAcknowledgement[]
}

/**
 * Serialize a compatibility result to canonical JSON (stable key order,
 * byte-identical for equal results).
 * @param result - the result to serialize.
 * @returns the canonical JSON text.
 */
export function serializeCompatibilityResult(result: CompatibilityResult): string {
  return canonicalJsonStringify(result)
}

/** Re-export for consumers that stamp results with the contract version. */
export { TEAM_CONTRACT_SCHEMA_VERSION }
