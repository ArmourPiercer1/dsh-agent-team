/**
 * CompatibilitySummaryDto — the TeamSession compatibility/admission summary
 * carried by the projection root (UI §18.1 admission + compatibility card).
 *
 * Design facts (frozen 20260829 plan docs):
 *
 * - `status` is the frozen four-state admission vocabulary (Architecture
 *   §28, states.ts): the compatibility card of the UI is a rendering of
 *   the same state — no second vocabulary.
 * - `probeGeneration` is the P7-T1 compatibility probe generation: a
 *   monotonically increasing positive integer (the projection itself is
 *   re-stamped with its own generation; the probe generation records the
 *   probe facts the summary was built from).
 * - The two fingerprints are opaque strings (requirement fingerprint of the
 *   bound blueprint snapshot, environment fingerprint of the probed
 *   environment): the contract does not interpret them.
 * - `acknowledgedWarningCount` is bounded by `warningCount` (validated at
 *   parse: you cannot acknowledge more warnings than exist).
 * - `lastProbedAt` is a DURATIONAL-optional field: the KEY is absent when
 *   the summary was built without a probe timestamp (never an own
 *   `undefined` key).
 *
 * The summary is an embedded value: the enclosing projection record owns
 * the schema version, so the summary carries none of its own.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/projection/compatibility
 */
import { assertFieldPresent, assertNoUnknownFields, assertPlainRecord, parseIso8601TimestampField, } from '../dto/common.js';
import { assertPositiveInteger } from '../ids/common.js';
import { teamContractError } from '../errors.js';
import { deepFreeze } from '../remote-safe.js';
import { parseOpaqueField, assertNonNegativeInteger } from './common.js';
import { parseAdmissionStateField } from './states.js';
/** Max length of a compatibility fingerprint (opaque string). */
export const COMPATIBILITY_FINGERPRINT_MAX_LENGTH = 128;
/** The exact frozen fields of a CompatibilitySummaryDto. */
export const COMPATIBILITY_SUMMARY_FIELDS = [
    'status',
    'probeGeneration',
    'requirementFingerprint',
    'environmentFingerprint',
    'warningCount',
    'fatalCount',
    'acknowledgedWarningCount',
    'lastProbedAt',
];
/**
 * Parse and validate a CompatibilitySummaryDto from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen summary.
 * @throws `MALFORMED_DTO` for a malformed container, field set, field value,
 *   or a `acknowledgedWarningCount > warningCount` violation.
 */
export function parseCompatibilitySummary(value) {
    const record = assertPlainRecord(value, 'CompatibilitySummary');
    assertNoUnknownFields(record, COMPATIBILITY_SUMMARY_FIELDS, 'CompatibilitySummary');
    for (const field of COMPATIBILITY_SUMMARY_FIELDS) {
        if (field !== 'lastProbedAt') {
            assertFieldPresent(record, field, 'CompatibilitySummary');
        }
    }
    const status = parseAdmissionStateField(record['status'], 'status');
    const probeGeneration = assertPositiveInteger(record['probeGeneration'], 'probeGeneration');
    const warningCount = assertNonNegativeInteger(record['warningCount'], 'warningCount');
    const fatalCount = assertNonNegativeInteger(record['fatalCount'], 'fatalCount');
    const acknowledgedWarningCount = assertNonNegativeInteger(record['acknowledgedWarningCount'], 'acknowledgedWarningCount');
    if (acknowledgedWarningCount > warningCount) {
        throw teamContractError('MALFORMED_DTO', `acknowledgedWarningCount (${acknowledgedWarningCount}) must not exceed warningCount (${warningCount})`, { reason: 'ACKNOWLEDGED_COUNT_EXCEEDS_WARNING_COUNT' });
    }
    const base = {
        status,
        probeGeneration,
        requirementFingerprint: parseOpaqueField(record['requirementFingerprint'], 'requirementFingerprint', COMPATIBILITY_FINGERPRINT_MAX_LENGTH),
        environmentFingerprint: parseOpaqueField(record['environmentFingerprint'], 'environmentFingerprint', COMPATIBILITY_FINGERPRINT_MAX_LENGTH),
        warningCount,
        fatalCount,
        acknowledgedWarningCount,
    };
    return deepFreeze(record['lastProbedAt'] === undefined
        ? base
        : {
            ...base,
            lastProbedAt: parseIso8601TimestampField(record['lastProbedAt']),
        });
}
//# sourceMappingURL=compatibility.js.map