/**
 * Warning acknowledgement for the compatibility engine.
 *
 * Architecture §27.3: an acknowledgement must correspond to a **specific
 * mismatch / environment generation** —it binds to the requirement's
 * mismatch fingerprint *and* the environment fingerprint of the evaluation
 * it was created from. It is never a permanent "ignore all warnings" flag:
 * when the environment or the selected AgentPreset changes and produces a
 * new mismatch, the old acknowledgement does not cover the new problem.
 *
 * An ack therefore carries provenance (who/when) and both fingerprints; the
 * engine re-derives both fingerprints on every evaluation and classifies the
 * ack VALID / STALE / MISSING. Only VALID acks of a WARNING satisfy it
 * (Team enters the acknowledged-degraded state, §27.2/§28
 * DEGRADED_ACKNOWLEDGED). FATAL outcomes are never ack-able (§27.2: FATAL
 * 不允许Continue Anyway).
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/compatibility/acknowledgement
 */

import { deepFreeze, teamContractError } from '../../../contracts/src/index.js'
import {
  assertNoUnknownFields,
  isPlainRecord,
  readNonEmptyString,
} from './common.js'

/** The exact frozen fields of a warning acknowledgement. */
const ACKNOWLEDGEMENT_FIELDS: readonly string[] = [
  'requirementId',
  'mismatchFingerprint',
  'environmentFingerprint',
  'acknowledgedBy',
  'acknowledgedAt',
  'note',
]

/** Shape accepted as an ISO 8601 timestamp (provenance field). */
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/

/** A user acknowledgement of one specific compatibility WARNING. */
export interface WarningAcknowledgement {
  /** The requirementId of the WARNING being acknowledged. */
  readonly requirementId: string
  /** Mismatch fingerprint of the evaluation the ack was created from. */
  readonly mismatchFingerprint: string
  /** Environment fingerprint of the evaluation the ack was created from. */
  readonly environmentFingerprint: string
  /** Provenance: who acknowledged (Architecture §14.3 E). */
  readonly acknowledgedBy: string
  /** Provenance: when (ISO 8601). */
  readonly acknowledgedAt: string
  /** Optional operator note. */
  readonly note?: string
}

/**
 * Parse and validate one warning acknowledgement.
 * @param value - the raw acknowledgement.
 * @param path - pointer used in the error details (defaults to `$`).
 * @returns the frozen acknowledgement.
 * @throws `MALFORMED_DTO` for any malformed/unknown field or a non-ISO
 *   `acknowledgedAt`.
 */
export function parseWarningAcknowledgement(value: unknown, path = '$'): WarningAcknowledgement {
  if (!isPlainRecord(value)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `acknowledgement must be a plain record at ${path}`,
      { path, problem: 'not a plain record' },
    )
  }
  assertNoUnknownFields(value, ACKNOWLEDGEMENT_FIELDS, 'acknowledgement', path)
  const requirementId = readNonEmptyString(value, 'requirementId', path)
  const mismatchFingerprint = readNonEmptyString(value, 'mismatchFingerprint', path)
  const environmentFingerprint = readNonEmptyString(value, 'environmentFingerprint', path)
  const acknowledgedBy = readNonEmptyString(value, 'acknowledgedBy', path)
  const acknowledgedAt = readNonEmptyString(value, 'acknowledgedAt', path)
  if (!ISO_8601_PATTERN.test(acknowledgedAt)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `acknowledgedAt must be an ISO 8601 timestamp at ${path}.acknowledgedAt`,
      { path: `${path}.acknowledgedAt`, problem: 'not an ISO 8601 timestamp' },
    )
  }
  const note = value['note']
  if (note !== undefined && typeof note !== 'string') {
    throw teamContractError(
      'MALFORMED_DTO',
      `note must be a string at ${path}.note`,
      { path: `${path}.note`, problem: 'note must be a string' },
    )
  }
  const ack: WarningAcknowledgement =
    note === undefined
      ? { requirementId, mismatchFingerprint, environmentFingerprint, acknowledgedBy, acknowledgedAt }
      : { requirementId, mismatchFingerprint, environmentFingerprint, acknowledgedBy, acknowledgedAt, note }
  return deepFreeze(ack)
}

/**
 * Parse and validate an acknowledgement list (order preserved).
 * @param values - the raw array (an empty list is valid).
 * @returns the frozen list.
 * @throws `MALFORMED_DTO` when not an array or for any malformed member.
 */
export function parseWarningAcknowledgements(values: unknown): readonly WarningAcknowledgement[] {
  if (!Array.isArray(values)) {
    throw teamContractError(
      'MALFORMED_DTO',
      'acknowledgements must be an array at $.acknowledgements',
      { path: '$.acknowledgements', problem: 'not an array' },
    )
  }
  return deepFreeze(
    values.map((item, index) => parseWarningAcknowledgement(item, `acknowledgements[${index}]`)),
  )
}
