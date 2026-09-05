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
/**
 * Is `value` a plain record (object with prototype `Object.prototype` or
 * `null`) —the same plainness discipline as contracts remote-safe values?
 * @param value - the value to check.
 * @returns `true` iff `value` is a plain record.
 */
export declare function isPlainRecord(value: unknown): value is Record<string, unknown>;
/**
 * Reject a value that carries keys outside the frozen field set.
 * @param record - the record to check.
 * @param fields - the exact allowed field names.
 * @param name - the value's display name, for error messages.
 * @param path - pointer used in the error details.
 * @throws `MALFORMED_DTO` on the first unknown field.
 */
export declare function assertNoUnknownFields(record: Record<string, unknown>, fields: readonly string[], name: string, path: string): void;
/**
 * Read a required non-empty string field.
 * @param record - the record.
 * @param field - the field name.
 * @param path - pointer used in the error details.
 * @returns the string value.
 * @throws `MALFORMED_DTO` when missing or not a non-empty string.
 */
export declare function readNonEmptyString(record: Record<string, unknown>, field: string, path: string): string;
/**
 * Read a required boolean field.
 * @param record - the record.
 * @param field - the field name.
 * @param path - pointer used in the error details.
 * @returns the boolean value.
 * @throws `MALFORMED_DTO` when missing or not a boolean.
 */
export declare function readBoolean(record: Record<string, unknown>, field: string, path: string): boolean;
/**
 * Read a required non-negative integer field.
 * @param record - the record.
 * @param field - the field name.
 * @param path - pointer used in the error details.
 * @returns the integer value.
 * @throws `MALFORMED_DTO` when missing or not a non-negative integer.
 */
export declare function readNonNegativeInteger(record: Record<string, unknown>, field: string, path: string): number;
//# sourceMappingURL=common.d.ts.map