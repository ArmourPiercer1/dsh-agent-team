/**
 * Low-level string rules shared by the identity modules.
 *
 * These are the vNext boundary rules for values that originate outside the
 * Team contract (upstream DSH session ids, blueprint identifiers, labels,
 * workspace paths). They reject structurally unusable strings (empty,
 * control characters, over-length) without inventing an upstream format:
 * the upstream DSH session id is an opaque branded string minted as
 * `session-<n>` by the session store, so no charset beyond the rules here is
 * assumed or required.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/ids/common
 */

import { teamContractError } from '../errors.js'
import type { TeamContractErrorCode } from '../errors.js'
import { toRemoteSafeDetail } from '../remote-safe.js'

/** Rejects ASCII control characters and DEL (0x00-0x1F, 0x7F). */
export function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/** Rejects any Unicode whitespace character. */
export function hasWhitespace(value: string): boolean {
  return /\s/.test(value)
}

/**
 * Assert `raw` is a string and return it.
 * @param raw - the unknown input.
 * @param field - the field name, used in the error.
 * @param code - the contract error code to throw.
 * @returns the input as a string.
 * @throws the given `code` when the input is not a string.
 */
export function assertIsString(
  raw: unknown,
  field: string,
  code: TeamContractErrorCode,
): string {
  if (typeof raw !== 'string') {
    throw teamContractError(
      code,
      `${field} must be a string, got ${typeof raw}`,
      { field },
    )
  }
  return raw
}

/**
 * Apply the shared structural string rules: non-empty, at most `maxLength`
 * characters, no control characters, and (optionally) no whitespace.
 * @param value - the string to check (already asserted to be a string).
 * @param options - `field` (error field name), `code` (error code), `maxLength`, and `allowWhitespace` (default false).
 * @throws the given `code` with a truncated preview of the value.
 */
export function assertStringRules(
  value: string,
  options: {
    field: string
    code: TeamContractErrorCode
    maxLength: number
    allowWhitespace?: boolean
  },
): void {
  const { field, code, maxLength, allowWhitespace = false } = options
  const preview = value.length > 64 ? `${value.slice(0, 64)}...` : value
  if (value.length === 0) {
    throw teamContractError(code, `${field} must not be empty`, { field })
  }
  if (value.length > maxLength) {
    throw teamContractError(
      code,
      `${field} exceeds max length ${maxLength} (got ${value.length})`,
      { field, length: value.length, maxLength },
    )
  }
  if (hasControlChars(value)) {
    throw teamContractError(
      code,
      `${field} must not contain control characters (preview: ${JSON.stringify(preview)})`,
      { field },
    )
  }
  if (!allowWhitespace && hasWhitespace(value)) {
    throw teamContractError(
      code,
      `${field} must not contain whitespace (preview: ${JSON.stringify(preview)})`,
      { field },
    )
  }
}

/**
 * Assert `raw` is a positive integer >= 1 (safe integer range).
 * @param raw - the unknown input.
 * @param field - the field name, used in the error.
 * @throws `MALFORMED_DTO` when the input is not a positive integer.
 */
export function assertPositiveInteger(raw: unknown, field: string): number {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || !Number.isSafeInteger(raw)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `${field} must be a positive integer, got ${JSON.stringify(raw)}`,
      { field, value: toRemoteSafeDetail(raw) },
    )
  }
  return raw
}
