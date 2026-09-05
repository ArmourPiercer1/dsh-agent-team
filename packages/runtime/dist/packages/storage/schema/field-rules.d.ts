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
/** Structural max length of storage-level id-like fields (recordId, factType, requirementId, ...). */
export declare const FIELD_ID_MAX_LENGTH = 128;
/** Structural max length of fingerprint fields. */
export declare const FINGERPRINT_MAX_LENGTH = 256;
/** Structural max length of free-text diagnostic/note fields. */
export declare const FIELD_TEXT_MAX_LENGTH = 4096;
/**
 * Assert `raw` is a positive integer >= 1 (safe integer range).
 * @param raw - the unknown field value.
 * @param field - the field name, used in the error.
 * @returns the value as a number.
 * @throws `RECORD_INVALID` (problem `not-a-positive-integer`).
 */
export declare function assertPositiveIntField(raw: unknown, field: string): number;
/**
 * Assert `raw` is a non-empty string of at most `maxLength` chars with no
 * control characters and no whitespace (id-like field).
 * @param raw - the unknown field value.
 * @param field - the field name, used in the error.
 * @param maxLength - the structural max length.
 * @returns the value as a string.
 * @throws `RECORD_INVALID` (problem `bad-string` or `control-or-whitespace`).
 */
export declare function assertHygienicStringField(raw: unknown, field: string, maxLength: number): string;
/**
 * Assert `raw` is a non-empty string of at most `maxLength` chars with no
 * control characters (whitespace allowed — free-text diagnostic/note).
 * @param raw - the unknown field value.
 * @param field - the field name, used in the error.
 * @param maxLength - the structural max length.
 * @returns the value as a string.
 * @throws `RECORD_INVALID` (problem `bad-string` or `control-characters`).
 */
export declare function assertTextStringField(raw: unknown, field: string, maxLength: number): string;
//# sourceMappingURL=field-rules.d.ts.map