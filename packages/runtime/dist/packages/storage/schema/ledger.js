/**
 * LedgerEntry — the `ledger` store record
 * (Architecture §14.3 category G, storage-level v1).
 *
 * The durable append-only fact ledger of a TeamSession: a strictly
 * increasing sequence of facts, each with its own fact type and
 * lossless-JSON payload. The ledger is the audit trail the recovery
 * protocol (roll-forward, never rollback) reconciles against: gaps in
 * the sequence are diagnosable, and a crashed write leaves a gap that a
 * later write can fill.
 *
 * Invariants enforced here:
 *
 * - `sequence` is a positive integer; the row key is `String(sequence)`;
 * - `factType` discriminates the fact family (1..128, no control
 *   chars/whitespace); semantic validation of the payload belongs to the
 *   domain that produced the fact;
 * - `operationId` (when present) links the fact to the operation that
 *   produced it, and must match the frozen operation id pattern.
 *
 * The sequence allocation itself (the counter row and its atomic
 * increment) is implemented by the repository over the public seam's
 * `update`; this module only fixes the row shapes.
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/storage/schema/ledger
 */
import { assertNoLegacyFields, assertRemoteSafeJsonValue, canonicalJsonStringify, deepFreeze, parseRootSessionId, } from '../../contracts/src/index.js';
import { assertFieldPresent, assertNoUnknownFields, assertPlainRecord, parseIso8601TimestampField } from '../../contracts/src/dto/common.js';
import { teamDomainError } from './errors.js';
import { FIELD_ID_MAX_LENGTH, assertHygienicStringField, assertPositiveIntField } from './field-rules.js';
import { OPERATION_ID_PATTERN } from './operation.js';
import { TEAM_DOMAIN_SCHEMA_VERSION } from './stores.js';
/** The reserved row key of the ledger sequence counter (not a fact row). */
export const LEDGER_SEQUENCE_COUNTER_KEY = '__ledger_sequence_counter';
/** The frozen discriminator of the counter row value. */
export const LEDGER_SEQUENCE_COUNTER_KIND = 'ledger-sequence-counter';
/** The exact frozen fields of a LedgerSequenceCounter (v1). */
export const LEDGER_SEQUENCE_COUNTER_FIELDS = ['schemaVersion', 'kind', 'value'];
/** The exact frozen fields of a LedgerEntry (v1). */
export const LEDGER_ENTRY_FIELDS = [
    'schemaVersion',
    'sequence',
    'rootSessionId',
    'factType',
    'payload',
    'operationId',
    'createdAt',
];
/**
 * Parse and validate the ledger sequence counter row.
 * @param value - the unknown input.
 * @returns the frozen counter.
 * @throws `RECORD_INVALID` for any rule violation.
 */
export function parseLedgerSequenceCounter(value) {
    const record = assertPlainRecord(value, 'LedgerSequenceCounter');
    assertNoLegacyFields(record, 'LedgerSequenceCounter');
    assertNoUnknownFields(record, LEDGER_SEQUENCE_COUNTER_FIELDS, 'LedgerSequenceCounter');
    for (const field of LEDGER_SEQUENCE_COUNTER_FIELDS)
        assertFieldPresent(record, field, 'LedgerSequenceCounter');
    if (record['schemaVersion'] !== TEAM_DOMAIN_SCHEMA_VERSION) {
        throw teamDomainError('RECORD_INVALID', `LedgerSequenceCounter schemaVersion must be ${TEAM_DOMAIN_SCHEMA_VERSION}, got ${JSON.stringify(record['schemaVersion'])}`, { field: 'schemaVersion', expected: TEAM_DOMAIN_SCHEMA_VERSION, found: record['schemaVersion'] });
    }
    if (record['kind'] !== LEDGER_SEQUENCE_COUNTER_KIND) {
        throw teamDomainError('RECORD_INVALID', `LedgerSequenceCounter kind must be '${LEDGER_SEQUENCE_COUNTER_KIND}', got ${JSON.stringify(record['kind'])}`, { field: 'kind', problem: 'bad-kind' });
    }
    const valueNum = record['value'];
    if (typeof valueNum !== 'number' || !Number.isInteger(valueNum) || valueNum < 0 || !Number.isSafeInteger(valueNum)) {
        throw teamDomainError('RECORD_INVALID', `LedgerSequenceCounter value must be a non-negative safe integer, got ${JSON.stringify(valueNum)}`, { field: 'value', problem: 'not-a-non-negative-integer' });
    }
    const result = {
        schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
        kind: LEDGER_SEQUENCE_COUNTER_KIND,
        value: valueNum,
    };
    return deepFreeze(result);
}
/**
 * Serialize the counter to its stable canonical JSON form.
 * @param counter - the counter.
 * @returns the canonical JSON text.
 */
export function serializeLedgerSequenceCounter(counter) {
    return canonicalJsonStringify(counter);
}
/**
 * Deserialize the counter row from canonical JSON.
 * @param json - the canonical JSON text.
 * @returns the parsed counter.
 * @throws `RECORD_INVALID` (problem `malformed-json`) when the text is not
 *   valid JSON, plus the validation codes a malformed row triggers.
 */
export function deserializeLedgerSequenceCounter(json) {
    let value;
    try {
        value = JSON.parse(json);
    }
    catch (error) {
        throw teamDomainError('RECORD_INVALID', `LedgerSequenceCounter JSON is not valid: ${error instanceof Error ? error.message : String(error)}`, { problem: 'malformed-json' });
    }
    return parseLedgerSequenceCounter(value);
}
/**
 * Parse and validate a ledger entry from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen entry.
 * @throws `RECORD_INVALID` (storage-level) or contracts codes for
 *   malformed root session ids (preserved via `normalizeValidationError`).
 */
export function parseLedgerEntry(value) {
    const record = assertPlainRecord(value, 'LedgerEntry');
    assertNoLegacyFields(record, 'LedgerEntry');
    assertNoUnknownFields(record, LEDGER_ENTRY_FIELDS, 'LedgerEntry');
    for (const field of LEDGER_ENTRY_FIELDS) {
        if (field !== 'operationId')
            assertFieldPresent(record, field, 'LedgerEntry');
    }
    if (record['schemaVersion'] !== TEAM_DOMAIN_SCHEMA_VERSION) {
        throw teamDomainError('RECORD_INVALID', `LedgerEntry schemaVersion must be ${TEAM_DOMAIN_SCHEMA_VERSION}, got ${JSON.stringify(record['schemaVersion'])}`, { field: 'schemaVersion', expected: TEAM_DOMAIN_SCHEMA_VERSION, found: record['schemaVersion'] });
    }
    const operationId = record['operationId'];
    if (operationId !== undefined && (typeof operationId !== 'string' || !OPERATION_ID_PATTERN.test(operationId))) {
        throw teamDomainError('RECORD_INVALID', `LedgerEntry operationId must match ${OPERATION_ID_PATTERN}, got ${JSON.stringify(operationId)}`, { field: 'operationId', problem: 'bad-operation-id' });
    }
    const result = {
        schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
        sequence: assertPositiveIntField(record['sequence'], 'sequence'),
        rootSessionId: parseRootSessionId(record['rootSessionId']),
        factType: assertHygienicStringField(record['factType'], 'factType', FIELD_ID_MAX_LENGTH),
        payload: assertPlainRecord(record['payload'], 'payload'),
        createdAt: parseIso8601TimestampField(record['createdAt']),
    };
    if (operationId !== undefined)
        result['operationId'] = operationId;
    assertRemoteSafeJsonValue(result);
    return deepFreeze(result);
}
/**
 * Serialize an entry to its stable canonical JSON form (sorted keys).
 * @param entry - the entry.
 * @returns the canonical JSON text.
 */
export function serializeLedgerEntry(entry) {
    return canonicalJsonStringify(entry);
}
/**
 * Deserialize canonical JSON back into a validated, frozen entry.
 * @param json - the canonical JSON text.
 * @returns the parsed entry.
 * @throws `RECORD_INVALID` (problem `malformed-json`) when the text is not
 *   valid JSON, plus the validation codes a malformed entry triggers.
 */
export function deserializeLedgerEntry(json) {
    let value;
    try {
        value = JSON.parse(json);
    }
    catch (error) {
        throw teamDomainError('RECORD_INVALID', `LedgerEntry JSON is not valid: ${error instanceof Error ? error.message : String(error)}`, { problem: 'malformed-json' });
    }
    return parseLedgerEntry(value);
}
//# sourceMappingURL=ledger.js.map