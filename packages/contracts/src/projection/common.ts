/**
 * Shared strict-validation helpers for the projection DTO family (P8-T1).
 *
 * The projection family (TeamProjectionDto and the records it embeds) reuses
 * the shared DTO pipeline (../dto/common.js) and adds the two projection-local
 * helpers that have no place in the P3-T1-frozen shared modules:
 *
 * - non-negative safe-integer assertions, for counters that may legitimately
 *   be zero (ledger entry counts, creation budget consumed) — the shared
 *   `assertPositiveInteger` rejects 0 by design of the record family;
 * - a bounded opaque-string parser, for fingerprint / correlation fields that
 *   are opaque to the contract (no charset beyond the structural rules is
 *   assumed or required, mirroring the session-id boundary discipline).
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/projection/common
 */

import { hasControlChars } from '../ids/common.js'
import { teamContractError } from '../errors.js'
import { toRemoteSafeDetail } from '../remote-safe.js'
import type { RemoteSafeRecord } from '../remote-safe.js'

/**
 * Copy a producer input value into a plain record for the validation
 * pipeline (the single lossless-JSON trust point of the `create*` paths).
 *
 * Inputs to the `create*` functions are contract values: branded ids,
 * strings, numbers, `null`, nested plain records, and arrays of them —
 * never class instances, `Date`, `Map`/`Set`, or functions. The cast
 * erases only the interface types; the SAME validation pipeline as
 * `parse*` then re-validates every field (structure, field set, types,
 * invariants) before anything is returned, so an input that violates the
 * discipline still fails with a contract error.
 * @param value - the producer input value (a plain contract value).
 * @returns a fresh plain record for the validation pipeline.
 */
export function toRecord(value: object): RemoteSafeRecord {
  return { ...value } as RemoteSafeRecord
}

/**
 * Assert `raw` is a non-negative safe integer (>= 0) and return it.
 * @param raw - the raw field value.
 * @param field - the field name, used in the error.
 * @returns the validated number.
 * @throws `MALFORMED_DTO` when the value is not a non-negative safe integer.
 */
export function assertNonNegativeInteger(raw: unknown, field: string): number {
  if (
    typeof raw !== 'number' ||
    !Number.isInteger(raw) ||
    raw < 0 ||
    !Number.isSafeInteger(raw)
  ) {
    throw teamContractError(
      'MALFORMED_DTO',
      `${field} must be a non-negative safe integer, got ${JSON.stringify(raw)}`,
      { field, value: toRemoteSafeDetail(raw) },
    )
  }
  return raw
}

/**
 * Validate an opaque bounded string field (fingerprint, correlation id):
 * non-empty, no control characters, <= `max` chars. The contract does not
 * interpret the value; the structural rules only keep it usable across the
 * wire and in storage.
 * @param raw - the raw field value.
 * @param field - the field name, used in the error.
 * @param max - the max length.
 * @returns the validated string.
 * @throws `MALFORMED_DTO` when the value is not a valid opaque string.
 */
export function parseOpaqueField(raw: unknown, field: string, max: number): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > max) {
    throw teamContractError(
      'MALFORMED_DTO',
      `${field} must be a non-empty string of at most ${max} chars`,
      { field },
    )
  }
  if (hasControlChars(raw)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `${field} must not contain control characters`,
      { field },
    )
  }
  return raw
}
