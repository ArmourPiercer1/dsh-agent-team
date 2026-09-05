/**
 * Internal validation helpers for the compatibility engine.
 *
 * The domain package validates raw inputs itself with the same discipline as
 * the contracts package (strict field sets, fail-loud typed
 * `MALFORMED_DTO` errors) while importing only the frozen public contracts
 * surface.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/compatibility/common
 */
import { teamContractError } from '../../../contracts/src/index.js';
/**
 * Is `value` a plain record (object with prototype `Object.prototype` or
 * `null`) —the same plainness discipline as contracts remote-safe values?
 * @param value - the value to check.
 * @returns `true` iff `value` is a plain record.
 */
export function isPlainRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}
/**
 * Reject a value that carries keys outside the frozen field set.
 * @param record - the record to check.
 * @param fields - the exact allowed field names.
 * @param name - the value's display name, for error messages.
 * @param path - pointer used in the error details.
 * @throws `MALFORMED_DTO` on the first unknown field.
 */
export function assertNoUnknownFields(record, fields, name, path) {
    for (const key of Object.keys(record)) {
        if (!fields.includes(key)) {
            throw teamContractError('MALFORMED_DTO', `${name} has unknown field '${key}' at ${path}`, { path, field: key, problem: 'unknown field' });
        }
    }
}
/**
 * Read a required non-empty string field.
 * @param record - the record.
 * @param field - the field name.
 * @param path - pointer used in the error details.
 * @returns the string value.
 * @throws `MALFORMED_DTO` when missing or not a non-empty string.
 */
export function readNonEmptyString(record, field, path) {
    const value = record[field];
    if (typeof value !== 'string' || value.length === 0) {
        throw teamContractError('MALFORMED_DTO', `${field} must be a non-empty string at ${path}`, { path, field, problem: 'missing or non-string field' });
    }
    return value;
}
/**
 * Read a required boolean field.
 * @param record - the record.
 * @param field - the field name.
 * @param path - pointer used in the error details.
 * @returns the boolean value.
 * @throws `MALFORMED_DTO` when missing or not a boolean.
 */
export function readBoolean(record, field, path) {
    const value = record[field];
    if (typeof value !== 'boolean') {
        throw teamContractError('MALFORMED_DTO', `${field} must be a boolean at ${path}`, { path, field, problem: 'missing or non-boolean field' });
    }
    return value;
}
/**
 * Read a required non-negative integer field.
 * @param record - the record.
 * @param field - the field name.
 * @param path - pointer used in the error details.
 * @returns the integer value.
 * @throws `MALFORMED_DTO` when missing or not a non-negative integer.
 */
export function readNonNegativeInteger(record, field, path) {
    const value = record[field];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw teamContractError('MALFORMED_DTO', `${field} must be a non-negative integer at ${path}`, { path, field, problem: 'missing or non-integer field' });
    }
    return value;
}
//# sourceMappingURL=common.js.map