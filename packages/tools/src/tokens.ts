/**
 * P6-T6 — the tool argument boundary: request-token validation and the
 * per-tool argument field readers (fail closed, closed error codes).
 *
 * `requestToken` is REQUIRED on every tool: it is the caller's stable
 * logical-operation token (stable across retries of the same logical
 * operation; distinct per logical operation — the facade's idempotency /
 * audit identity, and the control plane's correlation identity). An empty
 * or over-long token is rejected BEFORE any runtime call (zero side
 * effects).
 *
 * @module @dsh-agent-team/tools/tokens
 */

/**
 * The maximum request-token length the tool layer accepts: the tightest
 * documented bound in the runtime (the activity ledger's
 * `ACTIVITY_REQUEST_TOKEN_MAX_LENGTH`); every satellite the tool layer
 * drives accepts a token within this bound.
 */
export const TEAM_TOOL_REQUEST_TOKEN_MAX_LENGTH = 128

/** The closed tool-layer argument error code. */
export const TEAM_TOOL_BAD_ARGUMENTS = 'TEAM_TOOL_BAD_ARGUMENTS'

/** The closed tool-layer caller-resolution error code. */
export const TEAM_TOOL_CALLER_UNRESOLVED = 'TEAM_TOOL_CALLER_UNRESOLVED'

/**
 * The fail-closed tool-layer argument error (one of the closed rejection
 * codes the result union maps to `status: 'rejected'`).
 */
export class TeamToolArgsError extends Error {
  /** The stable closed error code. */
  readonly code: string = TEAM_TOOL_BAD_ARGUMENTS
  /** Stable, lossless-JSON diagnostic details (optional). */
  readonly details?: Record<string, unknown>

  constructor(message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'TeamToolArgsError'
    if (details !== undefined) {
      this.details = details
    }
  }
}

/** Type guard: is `value` a {@link TeamToolArgsError}? */
export function isTeamToolArgsError(value: unknown): value is TeamToolArgsError {
  return value instanceof TeamToolArgsError
}

/** Type guard: is `value` a JSON object usable as tool arguments? */
export function isArgsRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Read one string field of the arguments object.
 * @param args - the raw tool arguments (the host guarantees a JSON value).
 * @param field - the field name.
 * @returns the string, or `undefined` when the field is absent.
 * @throws {@link TeamToolArgsError} when the arguments are not an object
 *   or the field is present but not a string.
 */
export function readStringField(args: unknown, field: string): string | undefined {
  if (typeof args !== 'object' || args === null) {
    throw new TeamToolArgsError('team-tools: the tool arguments must be a JSON object')
  }
  const value = (args as Record<string, unknown>)[field]
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    throw new TeamToolArgsError(`team-tools: argument '${field}' must be a string`, { field })
  }
  return value
}

/**
 * Read one REQUIRED string field (present, non-empty, length-bounded).
 * @param args - the raw tool arguments.
 * @param field - the field name.
 * @param maxLength - the maximum accepted length.
 * @throws {@link TeamToolArgsError} on missing / empty / over-long / non-string.
 */
export function requireStringField(args: unknown, field: string, maxLength: number): string {
  const value = readStringField(args, field)
  if (value === undefined) {
    throw new TeamToolArgsError(`team-tools: required argument '${field}' is missing`, { field })
  }
  if (value.length === 0) {
    throw new TeamToolArgsError(`team-tools: argument '${field}' must be non-empty`, { field })
  }
  if (value.length > maxLength) {
    throw new TeamToolArgsError(
      `team-tools: argument '${field}' exceeds ${maxLength} characters`,
      { field, maxLength, length: value.length },
    )
  }
  return value
}

/**
 * Read one OPTIONAL string field; an empty string is treated as ABSENT
 * (documented: optional fields carry no empty values).
 * @param args - the raw tool arguments.
 * @param field - the field name.
 * @param maxLength - the maximum accepted length.
 * @returns the string, or `undefined` when absent or empty.
 */
export function optionalStringField(args: unknown, field: string, maxLength: number): string | undefined {
  const value = readStringField(args, field)
  if (value === undefined || value.length === 0) return undefined
  if (value.length > maxLength) {
    throw new TeamToolArgsError(
      `team-tools: argument '${field}' exceeds ${maxLength} characters`,
      { field, maxLength, length: value.length },
    )
  }
  return value
}

/**
 * Validate the per-call logical-operation token (required, non-empty,
 * length-bounded to {@link TEAM_TOOL_REQUEST_TOKEN_MAX_LENGTH}).
 * @param args - the raw tool arguments.
 * @param field - the field name (default `requestToken`).
 * @returns the validated token.
 */
export function validateRequestToken(args: unknown, field = 'requestToken'): string {
  return requireStringField(args, field, TEAM_TOOL_REQUEST_TOKEN_MAX_LENGTH)
}
