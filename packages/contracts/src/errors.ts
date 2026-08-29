/**
 * Contract error codes and the shared error object for @dsh-agent-team/contracts.
 *
 * `TeamContractErrorCode` is a CLOSED vocabulary as of contract v1. Adding or
 * renaming a code is a contract change: it requires a new version (see
 * CHANGELOG.md freeze rule), never a silent v1 edit.
 *
 * Producers outside this package (domain / runtime / remote tasks) MUST throw
 * `TeamContractError` with one of these codes when a contract rule is
 * violated; consumers MUST branch on `code`, never on message text.
 *
 * Authority: Architecture §42 invariants (identity, binding, legacy
 * vocabulary, schema), Development Plan §9.1 (error codes live in contracts).
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/errors
 */

import type { RemoteSafeRecord } from './remote-safe.js'

/** Closed set of v1 contract error codes. */
export const TeamContractErrorCode = {
  /** A DSH session id (generic context, e.g. an `ordinary` session binding) violates the session id rule. */
  INVALID_SESSION_ID: 'INVALID_SESSION_ID',
  /** A root session id — which is the TeamSessionId, Architecture invariant 9 — violates the session id rule. */
  INVALID_ROOT_SESSION_ID: 'INVALID_ROOT_SESSION_ID',
  /** A member child session id (a durable DSH Session bound to a MemberInstance) violates the session id rule. */
  INVALID_CHILD_SESSION_ID: 'INVALID_CHILD_SESSION_ID',
  /** An instance id violates the `inst-<1..32 lowercase alphanumerics>` rule. */
  INVALID_INSTANCE_ID: 'INVALID_INSTANCE_ID',
  /** A template id (static identity of a Leader/MemberTemplate) violates the slug rule. */
  INVALID_TEMPLATE_ID: 'INVALID_TEMPLATE_ID',
  /** A blueprint id (stable logical identity) violates the blueprint id rule. */
  INVALID_BLUEPRINT_ID: 'INVALID_BLUEPRINT_ID',
  /** A blueprint revision (human-readable) violates the revision rule. */
  INVALID_BLUEPRINT_REVISION: 'INVALID_BLUEPRINT_REVISION',
  /** A blueprint content hash (machine content identity) violates the content hash rule. */
  INVALID_BLUEPRINT_CONTENT_HASH: 'INVALID_BLUEPRINT_CONTENT_HASH',
  /** A member identity is used outside the TeamSession it belongs to (cross-scope confusion). */
  IDENTITY_SCOPE_MISMATCH: 'IDENTITY_SCOPE_MISMATCH',
  /** The same instance id is used twice inside one TeamSession (violates §10.2 uniqueness). */
  DUPLICATE_INSTANCE_ID: 'DUPLICATE_INSTANCE_ID',
  /** A second TeamSession would be bound to a root session that already has one (invariant 8). */
  DUPLICATE_TEAM_SESSION: 'DUPLICATE_TEAM_SESSION',
  /** A child session that is already bound to a member would be bound again (invariant 23). */
  SESSION_ALREADY_BOUND: 'SESSION_ALREADY_BOUND',
  /** A roster lookup found no member with the given (rootSessionId, instanceId) identity. */
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  /** A value carries the legacy `memberId` field, the forbidden legacy identity authority. */
  LEGACY_MEMBER_ID_REJECTED: 'LEGACY_MEMBER_ID_REJECTED',
  /** A value uses a legacy Team SessionEvent name (vNext has no Team SessionEvents, invariant 42). */
  LEGACY_TEAM_SESSION_EVENT_REJECTED: 'LEGACY_TEAM_SESSION_EVENT_REJECTED',
  /** A record carries a schema version different from the version the consumer expects. */
  SCHEMA_VERSION_MISMATCH: 'SCHEMA_VERSION_MISMATCH',
  /** A record carries a schema version outside the supported range (older or from the future). */
  SCHEMA_VERSION_UNSUPPORTED: 'SCHEMA_VERSION_UNSUPPORTED',
  /** A DTO value failed structural validation (wrong type, missing/unknown field, bad lifecycle state, ...). */
  MALFORMED_DTO: 'MALFORMED_DTO',
  /** A value crossing a boundary is not a lossless-JSON (remote-safe) value. */
  REMOTE_VALUE_NOT_JSON: 'REMOTE_VALUE_NOT_JSON',
  /**
   * Architecture §13.5: the root AgentPreset's effective persona is
   * `complete:true`, so the Blueprint persona cannot be composed without a
   * core seam. Structural FATAL compatibility outcome; frozen here so the
   * P3-T5 compatibility engine reports the exact architecture-named code.
   */
  TEAM_PERSONA_COMPLETE_PRESET_CONFLICT: 'TEAM_PERSONA_COMPLETE_PRESET_CONFLICT',
} as const

/** The closed v1 error-code type. */
export type TeamContractErrorCode =
  (typeof TeamContractErrorCode)[keyof typeof TeamContractErrorCode]

/** Every v1 code value, for membership checks and closed-set tests. */
export const TEAM_CONTRACT_ERROR_CODE_VALUES: readonly string[] = Object.values(
  TeamContractErrorCode,
)

/**
 * The single error object thrown by contract violations.
 *
 * `code` is the stable machine contract; `message` is a human-readable
 * summary (never branch on it); `details` is an optional lossless-JSON
 * record with structured context (e.g. the offending field path or value).
 */
export class TeamContractError extends Error {
  /** Stable machine-readable contract error code. */
  readonly code: TeamContractErrorCode
  /** Optional structured context; must be a lossless-JSON record. */
  readonly details?: RemoteSafeRecord

  constructor(code: TeamContractErrorCode, message: string, details?: RemoteSafeRecord) {
    super(message)
    this.name = 'TeamContractError'
    this.code = code
    if (details !== undefined) this.details = details
  }
}

/**
 * Build a `TeamContractError`.
 * @param code - the contract error code.
 * @param message - human-readable summary.
 * @param details - optional lossless-JSON structured context.
 * @returns the error instance (callers throw it).
 */
export function teamContractError(
  code: TeamContractErrorCode,
  message: string,
  details?: RemoteSafeRecord,
): TeamContractError {
  return new TeamContractError(code, message, details)
}

/**
 * Type guard: is `value` a `TeamContractError` carrying a known v1 code?
 * @param value - the value to check.
 * @returns `true` iff `value` is an `Error` whose `code` is a v1 contract code.
 */
export function isTeamContractError(value: unknown): value is TeamContractError {
  if (!(value instanceof Error)) return false
  const code = (value as { code?: unknown }).code
  return typeof code === 'string' && TEAM_CONTRACT_ERROR_CODE_VALUES.includes(code)
}
