/**
 * CompatibilityStateRecord — the `compatibility` store record
 * (Architecture §14.3 category E, storage-level v1).
 *
 * The durable compatibility verdict of a TeamSession: the requirement
 * outcomes evaluated by the P3 policy domain, the fingerprint of the
 * checked environment/inputs, and the explicit human acknowledgements
 * that allow DEGRADED_ACKNOWLEDGED states. The vocabulary is aligned
 * with the frozen P3 policy domain:
 *
 * - status `OPEN` — no blocking requirement mismatch;
 * - `BLOCKED_WARNING` — warnings present, not blocking;
 * - `BLOCKED_FATAL` — a fatal mismatch blocks further progress;
 * - `DEGRADED_ACKNOWLEDGED` — a mismatch was explicitly acknowledged
 *   (one acknowledgement per requirement+fingerprint pair).
 *
 * Storage validates the closed shape only: `outcomes` is a lossless-JSON
 * record of requirement outcomes (semantic evaluation stays in the P3
 * domain). Acknowledgements carry their own fingerprints so an
 * acknowledgement cannot silently survive an environment change.
 *
 * The store key is the root session id: exactly one durable
 * compatibility state per TeamSession.
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/storage/schema/compatibility
 */

import {
  assertNoLegacyFields,
  assertRemoteSafeJsonValue,
  canonicalJsonStringify,
  deepFreeze,
  parseRootSessionId,
} from '../../contracts/src/index.js'
import type { RemoteSafeJsonValue, RemoteSafeRecord, RootSessionId } from '../../contracts/src/index.js'
import { assertFieldPresent, assertNoUnknownFields, assertPlainRecord, parseIso8601TimestampField } from '../../contracts/src/dto/common.js'
import { teamDomainError } from './errors.js'
import { FIELD_ID_MAX_LENGTH, FINGERPRINT_MAX_LENGTH, FIELD_TEXT_MAX_LENGTH, assertHygienicStringField, assertPositiveIntField, assertTextStringField } from './field-rules.js'
import { TEAM_DOMAIN_SCHEMA_VERSION } from './stores.js'

/** The four frozen compatibility statuses (P3 policy-domain aligned). */
export const COMPATIBILITY_STATUS = {
  /** No blocking requirement mismatch. */
  OPEN: 'OPEN',
  /** Warnings present; not blocking. */
  BLOCKED_WARNING: 'BLOCKED_WARNING',
  /** A fatal mismatch blocks further progress. */
  BLOCKED_FATAL: 'BLOCKED_FATAL',
  /** A mismatch explicitly acknowledged by a human. */
  DEGRADED_ACKNOWLEDGED: 'DEGRADED_ACKNOWLEDGED',
} as const

/** One of the four frozen compatibility statuses. */
export type CompatibilityStatus = (typeof COMPATIBILITY_STATUS)[keyof typeof COMPATIBILITY_STATUS]

/** The frozen statuses (for validation and iteration). */
export const COMPATIBILITY_STATUS_VALUES: readonly CompatibilityStatus[] = [
  COMPATIBILITY_STATUS.OPEN,
  COMPATIBILITY_STATUS.BLOCKED_WARNING,
  COMPATIBILITY_STATUS.BLOCKED_FATAL,
  COMPATIBILITY_STATUS.DEGRADED_ACKNOWLEDGED,
]

/** The exact frozen fields of a CompatibilityAcknowledgement (v1). */
export const COMPATIBILITY_ACKNOWLEDGEMENT_FIELDS: readonly string[] = [
  'requirementId',
  'mismatchFingerprint',
  'environmentFingerprint',
  'acknowledgedBy',
  'acknowledgedAt',
  'note',
]

/** The exact frozen fields of a CompatibilityStateRecord (v1). */
export const COMPATIBILITY_FIELDS: readonly string[] = [
  'schemaVersion',
  'rootSessionId',
  'status',
  'fingerprint',
  'generation',
  'outcomes',
  'acknowledgements',
  'computedAt',
]

/**
 * A durable, explicit human acknowledgement of one compatibility
 * mismatch (required for DEGRADED_ACKNOWLEDGED).
 */
export interface CompatibilityAcknowledgement {
  /** The requirement the acknowledgement applies to. */
  readonly requirementId: string
  /** Fingerprint of the mismatch that was acknowledged. */
  readonly mismatchFingerprint: string
  /** Fingerprint of the environment the mismatch was evaluated in. */
  readonly environmentFingerprint: string
  /** The human identity that acknowledged. */
  readonly acknowledgedBy: string
  /** Acknowledgement time, ISO-8601. */
  readonly acknowledgedAt: string
  /** Optional free-text note (whitespace allowed, no control characters). */
  readonly note?: string
}

/**
 * The `compatibility` store record: the durable compatibility state of
 * one TeamSession (keyed by root session id).
 */
export interface CompatibilityStateRecord {
  /** Record shape version; v1 records carry `1`. */
  readonly schemaVersion: number
  /** The TeamSession (root session id) this state belongs to. */
  readonly rootSessionId: RootSessionId
  /** The frozen compatibility status. */
  readonly status: CompatibilityStatus
  /** Fingerprint of the checked environment/inputs. */
  readonly fingerprint: string
  /** Record version/generation counter (starts at 1). */
  readonly generation: number
  /** The lossless-JSON requirement outcomes (semantic values owned by the P3 domain). */
  readonly outcomes: RemoteSafeRecord
  /** The durable explicit acknowledgements. */
  readonly acknowledgements: readonly CompatibilityAcknowledgement[]
  /** Last evaluation time, ISO-8601. */
  readonly computedAt: string
}

function isCompatibilityStatus(value: unknown): value is CompatibilityStatus {
  return (COMPATIBILITY_STATUS_VALUES as readonly string[]).includes(value as string)
}

/**
 * Parse and validate one compatibility acknowledgement.
 * @param value - the unknown input.
 * @returns the frozen acknowledgement.
 * @throws `RECORD_INVALID` for any rule violation.
 */
export function parseCompatibilityAcknowledgement(value: unknown): CompatibilityAcknowledgement {
  const record = assertPlainRecord(value, 'CompatibilityAcknowledgement')
  assertNoLegacyFields(record, 'CompatibilityAcknowledgement')
  assertNoUnknownFields(record, COMPATIBILITY_ACKNOWLEDGEMENT_FIELDS, 'CompatibilityAcknowledgement')
  for (const field of COMPATIBILITY_ACKNOWLEDGEMENT_FIELDS) {
    if (field !== 'note') assertFieldPresent(record, field, 'CompatibilityAcknowledgement')
  }
  const result: RemoteSafeRecord = {
    requirementId: assertHygienicStringField(record['requirementId'], 'requirementId', FIELD_ID_MAX_LENGTH),
    mismatchFingerprint: assertHygienicStringField(record['mismatchFingerprint'], 'mismatchFingerprint', FINGERPRINT_MAX_LENGTH),
    environmentFingerprint: assertHygienicStringField(record['environmentFingerprint'], 'environmentFingerprint', FINGERPRINT_MAX_LENGTH),
    acknowledgedBy: assertHygienicStringField(record['acknowledgedBy'], 'acknowledgedBy', FIELD_ID_MAX_LENGTH),
    acknowledgedAt: parseIso8601TimestampField(record['acknowledgedAt']),
  }
  if (record['note'] !== undefined) {
    result['note'] = assertTextStringField(record['note'], 'note', FIELD_TEXT_MAX_LENGTH)
  }
  return deepFreeze(result) as unknown as CompatibilityAcknowledgement
}

/**
 * Parse and validate a compatibility state record from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen record.
 * @throws `RECORD_INVALID` (storage-level) or contracts codes for
 *   malformed ids (preserved via `normalizeValidationError`).
 */
export function parseCompatibilityState(value: unknown): CompatibilityStateRecord {
  const record = assertPlainRecord(value, 'CompatibilityState')
  assertNoLegacyFields(record, 'CompatibilityState')
  assertNoUnknownFields(record, COMPATIBILITY_FIELDS, 'CompatibilityState')
  for (const field of COMPATIBILITY_FIELDS) assertFieldPresent(record, field, 'CompatibilityState')
  if (record['schemaVersion'] !== TEAM_DOMAIN_SCHEMA_VERSION) {
    throw teamDomainError(
      'RECORD_INVALID',
      `CompatibilityState schemaVersion must be ${TEAM_DOMAIN_SCHEMA_VERSION}, got ${JSON.stringify(record['schemaVersion'])}`,
      { field: 'schemaVersion', expected: TEAM_DOMAIN_SCHEMA_VERSION, found: record['schemaVersion'] },
    )
  }
  const status = record['status']
  if (!isCompatibilityStatus(status)) {
    throw teamDomainError(
      'RECORD_INVALID',
      `CompatibilityState status must be one of ${COMPATIBILITY_STATUS_VALUES.join(', ')}, got ${JSON.stringify(status)}`,
      { field: 'status', problem: 'bad-status' },
    )
  }
  const acknowledgementsRaw = record['acknowledgements']
  if (!Array.isArray(acknowledgementsRaw)) {
    throw teamDomainError(
      'RECORD_INVALID',
      'CompatibilityState acknowledgements must be an array',
      { field: 'acknowledgements', problem: 'not-an-array' },
    )
  }
  const result: RemoteSafeRecord = {
    schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
    rootSessionId: parseRootSessionId(record['rootSessionId']),
    status,
    fingerprint: assertHygienicStringField(record['fingerprint'], 'fingerprint', FINGERPRINT_MAX_LENGTH),
    generation: assertPositiveIntField(record['generation'], 'generation'),
    outcomes: assertPlainRecord(record['outcomes'], 'outcomes'),
    acknowledgements: acknowledgementsRaw.map((item) => parseCompatibilityAcknowledgement(item)) as unknown as RemoteSafeJsonValue[],
    computedAt: parseIso8601TimestampField(record['computedAt']),
  }
  assertRemoteSafeJsonValue(result)
  return deepFreeze(result) as unknown as CompatibilityStateRecord
}

/**
 * Serialize a record to its stable canonical JSON form (sorted keys).
 * @param record - the record.
 * @returns the canonical JSON text.
 */
export function serializeCompatibilityState(record: CompatibilityStateRecord): string {
  return canonicalJsonStringify(record)
}

/**
 * Deserialize canonical JSON back into a validated, frozen record.
 * @param json - the canonical JSON text.
 * @returns the parsed record.
 * @throws `RECORD_INVALID` (problem `malformed-json`) when the text is not
 *   valid JSON, plus the validation codes a malformed record triggers.
 */
export function deserializeCompatibilityState(json: string): CompatibilityStateRecord {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch (error) {
    throw teamDomainError(
      'RECORD_INVALID',
      `CompatibilityState JSON is not valid: ${error instanceof Error ? error.message : String(error)}`,
      { problem: 'malformed-json' },
    )
  }
  return parseCompatibilityState(value)
}
