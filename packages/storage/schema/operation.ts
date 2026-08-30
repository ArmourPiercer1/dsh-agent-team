/**
 * OperationRecord — the `operations` store record
 * (Architecture §14.3 category F, storage-level v1).
 *
 * The durable operation journal row of the TeamDomain: one intent, one
 * idempotency key, one phase. This is the PREPARED→effects→COMMITTED
 * journal that P4-T2 will drive; the storage layer fixes the row shape
 * and the identity/idempotency rules, not the protocol.
 *
 * Invariants enforced here:
 *
 * - `operationId` is the row key: `/^op-[a-z0-9]{1,32}$/`;
 * - `idempotencyKey` identifies the caller's logical operation across
 *   retries; the same key may be re-put with a strictly higher
 *   generation while the operation is non-terminal;
 * - `phase` is `PREPARED` | `COMMITTED` | `FAILED`;
 * - `failureDiagnostic` is required exactly when the phase is `FAILED`
 *   and forbidden otherwise (a COMMITTED operation carries no failure
 *   text; a PREPARED one has not failed yet);
 * - `childSessionId` (when present) must be a valid member child session
 *   id — the operation may reference its target member.
 *
 * The put-time conflict semantics (terminal immutability,
 * idempotency-key agreement, generation monotonicity) live in the
 * repository, which has access to the existing row.
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/storage/schema/operation
 */

import {
  assertNoLegacyFields,
  assertRemoteSafeJsonValue,
  canonicalJsonStringify,
  deepFreeze,
  parseChildSessionId,
} from '../../contracts/src/index.js'
import type { ChildSessionId, RemoteSafeJsonValue, RemoteSafeRecord } from '../../contracts/src/index.js'
import { assertFieldPresent, assertNoUnknownFields, assertPlainRecord, parseIso8601TimestampField } from '../../contracts/src/dto/common.js'
import { teamDomainError } from './errors.js'
import { FIELD_ID_MAX_LENGTH, FIELD_TEXT_MAX_LENGTH, assertHygienicStringField, assertPositiveIntField, assertTextStringField } from './field-rules.js'
import { TEAM_DOMAIN_SCHEMA_VERSION } from './stores.js'

/** The frozen operation id pattern (row key). */
export const OPERATION_ID_PATTERN = /^op-[a-z0-9]{1,32}$/

/** The frozen operation phases. */
export const OPERATION_PHASES = {
  /** The operation was prepared; effects may not be committed yet. */
  PREPARED: 'PREPARED',
  /** The operation's effects are durably committed (terminal). */
  COMMITTED: 'COMMITTED',
  /** The operation failed (terminal). */
  FAILED: 'FAILED',
} as const

/** One of the three frozen operation phases. */
export type OperationPhase = (typeof OPERATION_PHASES)[keyof typeof OPERATION_PHASES]

/** The terminal phases (immutability boundary). */
export const OPERATION_TERMINAL_PHASES: readonly OperationPhase[] = [
  OPERATION_PHASES.COMMITTED,
  OPERATION_PHASES.FAILED,
]

/** The exact frozen fields of an OperationIntent (v1). */
export const OPERATION_INTENT_FIELDS: readonly string[] = ['type', 'payload']

/** The exact frozen fields of an OperationRecord (v1). */
export const OPERATION_FIELDS: readonly string[] = [
  'schemaVersion',
  'operationId',
  'idempotencyKey',
  'intent',
  'phase',
  'childSessionId',
  'failureDiagnostic',
  'updatedAt',
  'generation',
]

/** The durable operation intent: a typed payload. */
export interface OperationIntent {
  /** The intent type discriminator (1..128, no control chars/whitespace). */
  readonly type: string
  /** The lossless-JSON intent payload. */
  readonly payload: RemoteSafeRecord
}

/**
 * The `operations` store record: one durable operation row
 * (keyed by operation id).
 */
export interface OperationRecord {
  /** Record shape version; v1 records carry `1`. */
  readonly schemaVersion: number
  /** The operation id (row key), `/^op-[a-z0-9]{1,32}$/`. */
  readonly operationId: string
  /** The caller's logical operation identity (idempotency key). */
  readonly idempotencyKey: string
  /** The typed intent. */
  readonly intent: OperationIntent
  /** The operation phase. */
  readonly phase: OperationPhase
  /** The target member child session (when the operation acts on one). */
  readonly childSessionId?: ChildSessionId
  /** The failure diagnostic; present exactly when the phase is `FAILED`. */
  readonly failureDiagnostic?: string
  /** Last modification time, ISO-8601. */
  readonly updatedAt: string
  /** Record version/generation counter (starts at 1; must increase on re-put). */
  readonly generation: number
}

function isOperationPhase(value: unknown): value is OperationPhase {
  return value === OPERATION_PHASES.PREPARED || value === OPERATION_PHASES.COMMITTED || value === OPERATION_PHASES.FAILED
}

function parseOperationIntent(value: unknown): OperationIntent {
  const record = assertPlainRecord(value, 'OperationIntent')
  assertNoUnknownFields(record, OPERATION_INTENT_FIELDS, 'OperationIntent')
  assertFieldPresent(record, 'type', 'OperationIntent')
  assertFieldPresent(record, 'payload', 'OperationIntent')
  const result: RemoteSafeRecord = {
    type: assertHygienicStringField(record['type'], 'type', FIELD_ID_MAX_LENGTH),
    payload: assertPlainRecord(record['payload'], 'payload'),
  }
  assertRemoteSafeJsonValue(result)
  return deepFreeze(result) as unknown as OperationIntent
}

/**
 * Parse and validate an operation record from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen record.
 * @throws `RECORD_INVALID` (storage-level) or contracts codes for
 *   malformed child session ids (preserved via `normalizeValidationError`).
 */
export function parseOperationRecord(value: unknown): OperationRecord {
  const record = assertPlainRecord(value, 'OperationRecord')
  assertNoLegacyFields(record, 'OperationRecord')
  assertNoUnknownFields(record, OPERATION_FIELDS, 'OperationRecord')
  for (const field of OPERATION_FIELDS) {
    if (field !== 'childSessionId' && field !== 'failureDiagnostic') assertFieldPresent(record, field, 'OperationRecord')
  }
  if (record['schemaVersion'] !== TEAM_DOMAIN_SCHEMA_VERSION) {
    throw teamDomainError(
      'RECORD_INVALID',
      `OperationRecord schemaVersion must be ${TEAM_DOMAIN_SCHEMA_VERSION}, got ${JSON.stringify(record['schemaVersion'])}`,
      { field: 'schemaVersion', expected: TEAM_DOMAIN_SCHEMA_VERSION, found: record['schemaVersion'] },
    )
  }
  const operationId = record['operationId']
  if (typeof operationId !== 'string' || !OPERATION_ID_PATTERN.test(operationId)) {
    throw teamDomainError(
      'RECORD_INVALID',
      `OperationRecord operationId must match ${OPERATION_ID_PATTERN}, got ${JSON.stringify(operationId)}`,
      { field: 'operationId', problem: 'bad-operation-id' },
    )
  }
  const phase = record['phase']
  if (!isOperationPhase(phase)) {
    throw teamDomainError(
      'RECORD_INVALID',
      `OperationRecord phase must be one of ${Object.values(OPERATION_PHASES).join(', ')}, got ${JSON.stringify(phase)}`,
      { field: 'phase', problem: 'bad-phase' },
    )
  }
  let failureDiagnostic: string | undefined
  if (phase === OPERATION_PHASES.FAILED) {
    if (record['failureDiagnostic'] === undefined) {
      throw teamDomainError(
        'RECORD_INVALID',
        "OperationRecord in phase 'FAILED' requires failureDiagnostic",
        { field: 'failureDiagnostic', problem: 'failureDiagnostic-required-for-failed' },
      )
    }
    failureDiagnostic = assertTextStringField(record['failureDiagnostic'], 'failureDiagnostic', FIELD_TEXT_MAX_LENGTH)
  } else if (record['failureDiagnostic'] !== undefined) {
    throw teamDomainError(
      'RECORD_INVALID',
      "OperationRecord in a non-FAILED phase must not carry failureDiagnostic",
      { field: 'failureDiagnostic', problem: 'failureDiagnostic-forbidden-outside-failed' },
    )
  }
  const result: RemoteSafeRecord = {
    schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
    operationId,
    idempotencyKey: assertHygienicStringField(record['idempotencyKey'], 'idempotencyKey', FIELD_TEXT_MAX_LENGTH),
    intent: parseOperationIntent(record['intent']) as unknown as RemoteSafeJsonValue,
    phase,
    updatedAt: parseIso8601TimestampField(record['updatedAt']),
    generation: assertPositiveIntField(record['generation'], 'generation'),
  }
  if (record['childSessionId'] !== undefined) {
    result['childSessionId'] = parseChildSessionId(record['childSessionId'])
  }
  if (failureDiagnostic !== undefined) result['failureDiagnostic'] = failureDiagnostic
  assertRemoteSafeJsonValue(result)
  return deepFreeze(result) as unknown as OperationRecord
}

/**
 * Serialize a record to its stable canonical JSON form (sorted keys).
 * @param record - the record.
 * @returns the canonical JSON text.
 */
export function serializeOperationRecord(record: OperationRecord): string {
  return canonicalJsonStringify(record)
}

/**
 * Deserialize canonical JSON back into a validated, frozen record.
 * @param json - the canonical JSON text.
 * @returns the parsed record.
 * @throws `RECORD_INVALID` (problem `malformed-json`) when the text is not
 *   valid JSON, plus the validation codes a malformed record triggers.
 */
export function deserializeOperationRecord(json: string): OperationRecord {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch (error) {
    throw teamDomainError(
      'RECORD_INVALID',
      `OperationRecord JSON is not valid: ${error instanceof Error ? error.message : String(error)}`,
      { problem: 'malformed-json' },
    )
  }
  return parseOperationRecord(value)
}
