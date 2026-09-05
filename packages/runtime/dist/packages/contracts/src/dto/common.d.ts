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
import type { RemoteSafeRecord } from '../remote-safe.js';
/** Structural max length of a workspace path field. */
export declare const WORKSPACE_PATH_MAX_LENGTH = 1024;
/** Structural max length of a human-facing label field. */
export declare const LABEL_MAX_LENGTH = 128;
/** Structural max length of the opaque groupId field. */
export declare const GROUP_ID_MAX_LENGTH = 128;
/** ISO-8601 timestamp form accepted in `createdAt` fields (second precision + optional 1..6 fractional digits + UTC offset). */
export declare const ISO_8601_TIMESTAMP_PATTERN: RegExp;
/**
 * Assert `value` is a plain record (object, not array, prototype
 * `Object.prototype` or null) — the container every DTO must be.
 * @param value - the unknown input.
 * @param dtoName - the DTO name, used in the error message.
 * @returns the input as a plain record.
 * @throws `MALFORMED_DTO` when the input is not a plain record.
 */
export declare function assertPlainRecord(value: unknown, dtoName: string): RemoteSafeRecord;
/**
 * Reject fields not in the frozen field set of the DTO.
 * @param record - the plain record to check.
 * @param allowedFields - the exact frozen field names.
 * @param dtoName - the DTO name, used in the error message.
 * @throws `MALFORMED_DTO` when unknown fields are present (with the list).
 */
export declare function assertNoUnknownFields(record: RemoteSafeRecord, allowedFields: readonly string[], dtoName: string): void;
/**
 * Require the presence of a field on the record.
 * @param record - the plain record to check.
 * @param field - the required field name.
 * @param dtoName - the DTO name, used in the error message.
 * @throws `MALFORMED_DTO` when the field is absent.
 */
export declare function assertFieldPresent(record: RemoteSafeRecord, field: string, dtoName: string): void;
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
export declare function parseWorkspaceField(raw: unknown, field: string): string | undefined;
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
export declare function parseLabelLikeField(raw: unknown, field: string, max: number): string;
/**
 * Validate a `createdAt` field: ISO-8601 timestamp (second precision,
 * optional 1..6 fractional digits, explicit UTC offset).
 * @param raw - the raw field value.
 * @returns the timestamp string.
 * @throws `MALFORMED_DTO` when the value is not a valid ISO-8601 timestamp.
 */
export declare function parseIso8601TimestampField(raw: unknown): string;
//# sourceMappingURL=common.d.ts.map