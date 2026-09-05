/**
 * Shared strict field rules for the storage-level TeamDomain records
 * (schema-meta, governance overrides, compatibility state, operations,
 * ledger entries).
 *
 * These rules cover the NEW storage-level vocabulary that has no frozen
 * contracts v1 DTO: record ids, fingerprints, fact types, and diagnostic
 * strings. They reuse the contracts string hygiene predicates
 * (`hasControlChars` / `hasWhitespace`) and raise `RECORD_INVALID`
 * `TeamDomainError`s — identity rules (session/instance/template ids) are
 * NOT covered here; those stay with the contracts parsers.
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/storage/schema/field-rules
 */
import { hasControlChars, hasWhitespace } from '../../contracts/src/ids/common.js';
import { teamDomainError } from './errors.js';
/** Structural max length of storage-level id-like fields (recordId, factType, requirementId, ...). */
export const FIELD_ID_MAX_LENGTH = 128;
/** Structural max length of fingerprint fields. */
export const FINGERPRINT_MAX_LENGTH = 256;
/** Structural max length of free-text diagnostic/note fields. */
export const FIELD_TEXT_MAX_LENGTH = 4096;
/**
 * Assert `raw` is a positive integer >= 1 (safe integer range).
 * @param raw - the unknown field value.
 * @param field - the field name, used in the error.
 * @returns the value as a number.
 * @throws `RECORD_INVALID` (problem `not-a-positive-integer`).
 */
export function assertPositiveIntField(raw, field) {
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || !Number.isSafeInteger(raw)) {
        throw teamDomainError('RECORD_INVALID', `${field} must be a positive integer, got ${JSON.stringify(raw)}`, { field, problem: 'not-a-positive-integer' });
    }
    return raw;
}
/**
 * Assert `raw` is a non-empty string of at most `maxLength` chars with no
 * control characters and no whitespace (id-like field).
 * @param raw - the unknown field value.
 * @param field - the field name, used in the error.
 * @param maxLength - the structural max length.
 * @returns the value as a string.
 * @throws `RECORD_INVALID` (problem `bad-string` or `control-or-whitespace`).
 */
export function assertHygienicStringField(raw, field, maxLength) {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > maxLength) {
        throw teamDomainError('RECORD_INVALID', `${field} must be a non-empty string of at most ${maxLength} chars`, { field, problem: 'bad-string' });
    }
    if (hasControlChars(raw) || hasWhitespace(raw)) {
        throw teamDomainError('RECORD_INVALID', `${field} must not contain control characters or whitespace`, { field, problem: 'control-or-whitespace' });
    }
    return raw;
}
/**
 * Assert `raw` is a non-empty string of at most `maxLength` chars with no
 * control characters (whitespace allowed — free-text diagnostic/note).
 * @param raw - the unknown field value.
 * @param field - the field name, used in the error.
 * @param maxLength - the structural max length.
 * @returns the value as a string.
 * @throws `RECORD_INVALID` (problem `bad-string` or `control-characters`).
 */
export function assertTextStringField(raw, field, maxLength) {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > maxLength) {
        throw teamDomainError('RECORD_INVALID', `${field} must be a non-empty string of at most ${maxLength} chars`, { field, problem: 'bad-string' });
    }
    if (hasControlChars(raw)) {
        throw teamDomainError('RECORD_INVALID', `${field} must not contain control characters`, { field, problem: 'control-characters' });
    }
    return raw;
}
//# sourceMappingURL=field-rules.js.map