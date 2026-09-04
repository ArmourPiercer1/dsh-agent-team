/**
 * Identity parsing at the Remote contract v1 boundary.
 *
 * Value-level mirror of the P3 ID rules in `packages/contracts/src/ids/*`
 * (frozen contracts v1 — the authority): every DSH session id is an opaque
 * branded string; the vNext boundary rules reject structurally unusable
 * values without inventing an upstream format:
 *
 * - non-empty string;
 * - at most 255 characters;
 * - no ASCII control characters (0x00–0x1F, 0x7F);
 * - no whitespace characters.
 *
 * The WIRE CODES are the exact frozen P3 values (design note, deviation
 * D-1): a TeamSessionId violation surfaces as `INVALID_ROOT_SESSION_ID`
 * (invariant 9: `TeamSessionId = RootSessionId`, and the frozen
 * `parseTeamSessionId` delegates to `parseRootSessionId`), an InstanceId
 * violation as `INVALID_INSTANCE_ID`, and so on — so a client matching the
 * P3 contract vocabulary sees the frozen codes on the Remote wire.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment assumptions.
 * @module @dsh-agent-team/remote/contracts/ids
 */

import { remoteContractError } from './errors.js'

/** Maximum structural length of any id parsed at the remote boundary. */
export const REMOTE_ID_MAX_LENGTH = 255

/**
 * The mirrored frozen P3 ID error codes (exact values of
 * `packages/contracts/src/ids/*` — `TeamContractErrorCode` subset).
 */
export const REMOTE_ID_ERROR_CODES = {
  /** A generic DSH session id violates the rule. */
  INVALID_SESSION_ID: 'INVALID_SESSION_ID',
  /** A root / team session id violates the rule (invariant 9: same value). */
  INVALID_ROOT_SESSION_ID: 'INVALID_ROOT_SESSION_ID',
  /** A member child session id violates the rule. */
  INVALID_CHILD_SESSION_ID: 'INVALID_CHILD_SESSION_ID',
  /** A member instance id violates the rule. */
  INVALID_INSTANCE_ID: 'INVALID_INSTANCE_ID',
  /** A member template id violates the rule. */
  INVALID_TEMPLATE_ID: 'INVALID_TEMPLATE_ID',
  /** A blueprint id violates the rule. */
  INVALID_BLUEPRINT_ID: 'INVALID_BLUEPRINT_ID',
} as const

/**
 * Format an unknown raw value for an error message (never throws; never
 * leaks a live object — only its structural JSON form or a kind marker).
 */
function formatRaw(raw: unknown): string {
  try {
    const text = JSON.stringify(raw)
    if (text !== undefined) return text
  } catch {
    /* circular / unsafe — fall through to the kind marker */
  }
  if (raw === null) return 'null'
  return typeof raw
}

/** Rejects ASCII control characters and DEL (0x00-0x1F, 0x7F). */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/** Rejects any whitespace character (Unicode `\s`). */
function hasWhitespace(value: string): boolean {
  return /\s/.test(value)
}

/**
 * Assert `raw` is a string satisfying the structural ID rule.
 * @param raw - the unknown input.
 * @param field - the field name, used in the error message/detail.
 * @param code - the (mirrored frozen P3) code to throw.
 * @returns the input as a plain string.
 * @throws {RemoteContractError} the given `code` on any violation.
 */
function assertRemoteIdValue(raw: unknown, field: string, code: string): string {
  if (typeof raw !== 'string') {
    throw remoteContractError(code, `${field} must be a string, got ${formatRaw(raw)}`, { field })
  }
  if (raw.length === 0) {
    throw remoteContractError(code, `${field} must not be empty`, { field })
  }
  if (raw.length > REMOTE_ID_MAX_LENGTH) {
    throw remoteContractError(
      code,
      `${field} must be at most ${REMOTE_ID_MAX_LENGTH} characters (got ${raw.length})`,
      { field, length: raw.length },
    )
  }
  if (hasControlChars(raw)) {
    throw remoteContractError(code, `${field} must not contain control characters`, { field })
  }
  if (hasWhitespace(raw)) {
    throw remoteContractError(code, `${field} must not contain whitespace`, { field })
  }
  return raw
}

/**
 * Parse and validate a TeamSession id (== the root session id, invariant 9).
 * @throws `INVALID_ROOT_SESSION_ID` on any rule violation (frozen P3 value).
 */
export function parseRemoteTeamSessionId(raw: unknown, field = 'teamSessionId'): string {
  return assertRemoteIdValue(raw, field, REMOTE_ID_ERROR_CODES.INVALID_ROOT_SESSION_ID)
}

/**
 * Parse and validate a root session id (team.create input).
 * @throws `INVALID_ROOT_SESSION_ID` on any rule violation (frozen P3 value).
 */
export function parseRemoteRootSessionId(raw: unknown, field = 'rootSessionId'): string {
  return assertRemoteIdValue(raw, field, REMOTE_ID_ERROR_CODES.INVALID_ROOT_SESSION_ID)
}

/**
 * Parse and validate a generic DSH session id (e.g. a handoff source).
 * @throws `INVALID_SESSION_ID` on any rule violation (frozen P3 value).
 */
export function parseRemoteSessionId(raw: unknown, field = 'sourceSessionId'): string {
  return assertRemoteIdValue(raw, field, REMOTE_ID_ERROR_CODES.INVALID_SESSION_ID)
}

/**
 * Parse and validate a member instance id (instance-first addressing).
 * @throws `INVALID_INSTANCE_ID` on any rule violation (frozen P3 value).
 */
export function parseRemoteInstanceId(raw: unknown, field = 'instanceId'): string {
  return assertRemoteIdValue(raw, field, REMOTE_ID_ERROR_CODES.INVALID_INSTANCE_ID)
}

/**
 * Parse and validate a member template id.
 * @throws `INVALID_TEMPLATE_ID` on any rule violation (frozen P3 value).
 */
export function parseRemoteTemplateId(raw: unknown, field = 'templateId'): string {
  return assertRemoteIdValue(raw, field, REMOTE_ID_ERROR_CODES.INVALID_TEMPLATE_ID)
}

/**
 * Parse and validate a blueprint id.
 * @throws `INVALID_BLUEPRINT_ID` on any rule violation (frozen P3 value).
 */
export function parseRemoteBlueprintId(raw: unknown, field = 'blueprintId'): string {
  return assertRemoteIdValue(raw, field, REMOTE_ID_ERROR_CODES.INVALID_BLUEPRINT_ID)
}

/**
 * Parse and validate a blueprint revision (positive safe integer).
 * @throws `INVALID_BLUEPRINT_REVISION` on any violation (frozen P3 value).
 */
export function parseRemoteBlueprintRevision(raw: unknown, field = 'blueprintRevision'): number {
  if (
    typeof raw !== 'number' ||
    !Number.isInteger(raw) ||
    raw < 1 ||
    !Number.isSafeInteger(raw)
  ) {
    throw remoteContractError(
      'INVALID_BLUEPRINT_REVISION',
      `${field} must be a positive integer, got ${formatRaw(raw)}`,
      { field },
    )
  }
  return raw
}
