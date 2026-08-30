/**
 * TeamDomain error vocabulary — the closed v1 storage-level error set.
 *
 * TeamDomain is the schema write-lock owner of the Team control-plane
 * sidecar (TaskDoc §11.5 P4-T1). Every failure it raises is a
 * `TeamDomainError` with one of the codes below; consumers MUST branch on
 * `code`, never on message text (the same discipline as contracts'
 * `TeamContractError`).
 *
 * Relationship to contracts errors: when a violation originates in a frozen
 * contracts v1 rule (identity parsing, DTO shape, uniqueness), the
 * contracts error is preserved in `details.contractsCode` (and its message
 * is carried over) — identity rules are enforced by the contracts parsers,
 * never re-implemented here.
 *
 * Authority: Architecture §14 (TeamDomain as durable sidecar over the
 * public StorageDomain), Development Plan §17 (crash model, G4 "schema
 * version mismatch fails loudly"), contracts v1 (frozen).
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/storage/schema/errors
 */

import { assertRemoteSafeJsonValue, isTeamContractError } from '../../contracts/src/index.js'

/** Closed set of v1 TeamDomain error codes. */
export const TEAM_DOMAIN_ERROR_CODES = {
  /** `createTeamDomain` found the domain already stamped (it exists). */
  TEAM_DOMAIN_EXISTS: 'TEAM_DOMAIN_EXISTS',
  /** `openTeamDomain` found a store with no schema stamp row. */
  SCHEMA_STAMP_MISSING: 'SCHEMA_STAMP_MISSING',
  /** A schema stamp carries a version this TeamDomain does not support. */
  SCHEMA_STAMP_MISMATCH: 'SCHEMA_STAMP_MISMATCH',
  /** The persisted domain's own schema version (seam level) does not match. */
  SCHEMA_VERSION_MISMATCH: 'SCHEMA_VERSION_MISMATCH',
  /** A write input or a stored row failed validation (details: store, key, problem, contractsCode). */
  RECORD_INVALID: 'RECORD_INVALID',
  /** A different record already occupies the key (details: store, key, contractsCode, problem). */
  RECORD_DUPLICATE: 'RECORD_DUPLICATE',
  /** The domain is closed; the operation was rejected. */
  NOT_OPEN: 'NOT_OPEN',
  /** The storage seam failed in a way TeamDomain could not classify (details: seamCode). */
  SEAM_FAILURE: 'SEAM_FAILURE',
} as const

/** The closed v1 TeamDomain error-code type. */
export type TeamDomainErrorCode = (typeof TEAM_DOMAIN_ERROR_CODES)[keyof typeof TEAM_DOMAIN_ERROR_CODES]

/** Every v1 code value, for membership checks and closed-set tests. */
export const TEAM_DOMAIN_ERROR_CODE_VALUES: readonly string[] = Object.values(TEAM_DOMAIN_ERROR_CODES)

/**
 * The single error object thrown by TeamDomain violations.
 *
 * `code` is the stable machine contract; `message` is a human-readable
 * summary (never branch on it); `details` is an optional lossless-JSON
 * record with structured context (remote-safe, asserted in the
 * constructor).
 */
export class TeamDomainError extends Error {
  /** The stable v1 error code. */
  readonly code: TeamDomainErrorCode
  /** Optional lossless-JSON structured context. */
  readonly details?: Record<string, unknown>

  /**
   * @param code - the stable v1 error code.
   * @param message - human-readable summary.
   * @param details - optional lossless-JSON structured context.
   */
  constructor(code: TeamDomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'TeamDomainError'
    this.code = code
    if (details !== undefined) {
      assertRemoteSafeJsonValue(details)
      this.details = details
    }
  }
}

/** Type guard: is `value` a `TeamDomainError`? */
export function isTeamDomainError(value: unknown): value is TeamDomainError {
  return value instanceof TeamDomainError
}

/**
 * Build a `TeamDomainError` (callers throw it).
 * @param code - the stable v1 error code.
 * @param message - human-readable summary.
 * @param details - optional lossless-JSON structured context.
 */
export function teamDomainError(
  code: TeamDomainErrorCode,
  message: string,
  details?: Record<string, unknown>,
): TeamDomainError {
  return new TeamDomainError(code, message, details)
}

/**
 * Read the string `code` carried by a seam/contracts failure, if any.
 * @param error - the unknown error value.
 * @returns the code string, or `undefined` when absent or not a string.
 */
export function seamErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code = (error as { code?: unknown })['code']
  return typeof code === 'string' ? code : undefined
}

/**
 * Read the error message of an unknown thrown value without assuming a
 * class.
 * @param error - the unknown error value.
 * @returns a safe one-line message.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error)
}

/**
 * Normalize a validation-boundary failure into a `RECORD_INVALID`
 * `TeamDomainError`: a contracts error is preserved via
 * `details.contractsCode`; an already-typed TeamDomain error passes
 * through; anything else is classified as an unclassified error.
 * @param error - the thrown value.
 * @param store - the store the boundary belongs to.
 * @param key - the record key, when known.
 * @param problem - optional storage-level problem tag.
 */
export function normalizeValidationError(
  error: unknown,
  store: string,
  key?: string,
  problem?: string,
): TeamDomainError {
  if (isTeamDomainError(error)) return error
  const details: Record<string, unknown> = { store }
  if (key !== undefined) details['key'] = key
  if (problem !== undefined) details['problem'] = problem
  if (isTeamContractError(error)) {
    details['contractsCode'] = error.code
    return new TeamDomainError('RECORD_INVALID', error.message, details)
  }
  details['problem'] = problem ?? 'unclassified-error'
  return new TeamDomainError('RECORD_INVALID', `unexpected validation error: ${errorMessage(error)}`, details)
}

/**
 * Normalize a seam failure into a `TeamDomainError`: code `closed` maps to
 * `NOT_OPEN`, any other known seam code (and unknown failures) map to
 * `SEAM_FAILURE` with `details.seamCode` when present.
 * @param error - the thrown/rejected value.
 * @param store - the store the operation belonged to.
 * @param op - the operation name (`table`/`get`/`put`/`delete`/`update`/`entries`).
 */
export function normalizeSeamError(error: unknown, store: string, op: string): TeamDomainError {
  if (isTeamDomainError(error)) return error
  const code = seamErrorCode(error)
  if (code === 'closed') {
    return new TeamDomainError(
      'NOT_OPEN',
      `store '${store}' operation '${op}' was rejected: the TeamDomain is closed`,
      { store, op },
    )
  }
  if (code !== undefined) {
    return new TeamDomainError(
      'SEAM_FAILURE',
      `storage seam failure during '${op}' on store '${store}': ${code} — ${errorMessage(error)}`,
      { store, op, seamCode: code },
    )
  }
  return new TeamDomainError(
    'SEAM_FAILURE',
    `storage seam failure during '${op}' on store '${store}': ${errorMessage(error)}`,
    { store, op, problem: 'unclassified-seam-error' },
  )
}
