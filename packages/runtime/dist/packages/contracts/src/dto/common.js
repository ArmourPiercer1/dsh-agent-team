/**
 * Shared strict-validation pipeline for versioned DTO records.
 *
 * Every vNext DTO is a CLOSED, lossless-JSON record: plain object only, no
 * legacy-forbidden fields, no unknown fields (frozen shape — unknown
 * fields mean the value comes from a different schema generation or a
 * foreign vocabulary), schema version stamped and checked, every field
 * individually validated, result deeply frozen.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/dto/common
 */
import { teamContractError } from '../errors.js';
/** Structural max length of a workspace path field. */
export const WORKSPACE_PATH_MAX_LENGTH = 1024;
/** Structural max length of a human-facing label field. */
export const LABEL_MAX_LENGTH = 128;
/** Structural max length of the opaque groupId field. */
export const GROUP_ID_MAX_LENGTH = 128;
/** ISO-8601 timestamp form accepted in `createdAt` fields (second precision + optional 1..6 fractional digits + UTC offset). */
export const ISO_8601_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
/**
 * Assert `value` is a plain record (object, not array, prototype
 * `Object.prototype` or null) — the container every DTO must be.
 * @param value - the unknown input.
 * @param dtoName - the DTO name, used in the error message.
 * @returns the input as a plain record.
 * @throws `MALFORMED_DTO` when the input is not a plain record.
 */
export function assertPlainRecord(value, dtoName) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw teamContractError('MALFORMED_DTO', `${dtoName} must be a plain object, got ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`, {});
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
        throw teamContractError('MALFORMED_DTO', `${dtoName} must be a plain object (class instances are not lossless JSON)`, {});
    }
    return value;
}
/**
 * Reject fields not in the frozen field set of the DTO.
 * @param record - the plain record to check.
 * @param allowedFields - the exact frozen field names.
 * @param dtoName - the DTO name, used in the error message.
 * @throws `MALFORMED_DTO` when unknown fields are present (with the list).
 */
export function assertNoUnknownFields(record, allowedFields, dtoName) {
    const unknown = Object.keys(record).filter((key) => !allowedFields.includes(key));
    if (unknown.length > 0) {
        throw teamContractError('MALFORMED_DTO', `${dtoName} has unknown fields: ${unknown.sort().join(', ')}`, { unknownFields: [...unknown] });
    }
}
/**
 * Require the presence of a field on the record.
 * @param record - the plain record to check.
 * @param field - the required field name.
 * @param dtoName - the DTO name, used in the error message.
 * @throws `MALFORMED_DTO` when the field is absent.
 */
export function assertFieldPresent(record, field, dtoName) {
    if (!Object.hasOwn(record, field) || record[field] === undefined) {
        throw teamContractError('MALFORMED_DTO', `${dtoName} is missing required field '${field}'`, { field });
    }
}
/**
 * Validate an optional workspace path field: absent is fine; present it
 * must be a non-empty string without control characters, <= 1024 chars.
 *
 * Workspace paths never define Team identity (invariant 27); they are
 * carried as plain strings only.
 * @param raw - the raw field value.
 * @param field - the field name, used in the error.
 * @returns the path string, or `undefined` when the field is absent.
 * @throws `MALFORMED_DTO` when the present value is invalid.
 */
export function parseWorkspaceField(raw, field) {
    if (raw === undefined)
        return undefined;
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > WORKSPACE_PATH_MAX_LENGTH) {
        throw teamContractError('MALFORMED_DTO', `${field} must be a non-empty string of at most ${WORKSPACE_PATH_MAX_LENGTH} chars`, { field });
    }
    for (let i = 0; i < raw.length; i++) {
        const code = raw.charCodeAt(i);
        if (code < 0x20 || code === 0x7f) {
            throw teamContractError('MALFORMED_DTO', `${field} must not contain control characters`, { field });
        }
    }
    return raw;
}
/**
 * Validate a human-facing label / opaque groupId field: non-empty string,
 * no control characters, <= 128 chars. Neither value is an identity
 * (invariant 19 / invariant 20).
 * @param raw - the raw field value.
 * @param field - the field name, used in the error.
 * @param max - the max length (LABEL_MAX_LENGTH or GROUP_ID_MAX_LENGTH).
 * @returns the validated string.
 * @throws `MALFORMED_DTO` when the value is invalid.
 */
export function parseLabelLikeField(raw, field, max) {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > max) {
        throw teamContractError('MALFORMED_DTO', `${field} must be a non-empty string of at most ${max} chars`, { field });
    }
    for (let i = 0; i < raw.length; i++) {
        const code = raw.charCodeAt(i);
        if (code < 0x20 || code === 0x7f) {
            throw teamContractError('MALFORMED_DTO', `${field} must not contain control characters`, { field });
        }
    }
    return raw;
}
/**
 * Validate a `createdAt` field: ISO-8601 timestamp (second precision,
 * optional 1..6 fractional digits, explicit UTC offset).
 * @param raw - the raw field value.
 * @returns the timestamp string.
 * @throws `MALFORMED_DTO` when the value is not a valid ISO-8601 timestamp.
 */
export function parseIso8601TimestampField(raw) {
    if (typeof raw !== 'string' ||
        !ISO_8601_TIMESTAMP_PATTERN.test(raw) ||
        Number.isNaN(Date.parse(raw))) {
        throw teamContractError('MALFORMED_DTO', `createdAt must be an ISO-8601 timestamp (e.g. 2026-08-29T12:00:00Z), got ${JSON.stringify(raw)}`, { field: 'createdAt' });
    }
    return raw;
}
//# sourceMappingURL=common.js.map