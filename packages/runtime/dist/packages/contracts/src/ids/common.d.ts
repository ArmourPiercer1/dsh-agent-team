/**
 * Low-level string rules shared by the identity modules.
 *
 * These are the vNext boundary rules for values that originate outside the
 * Team contract (upstream DSH session ids, blueprint identifiers, labels,
 * workspace paths). They reject structurally unusable strings (empty,
 * control characters, over-length) without inventing an upstream format:
 * the upstream DSH session id is an opaque branded string minted as
 * `session-<n>` by the session store, so no charset beyond the rules here is
 * assumed or required.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/ids/common
 */
import type { TeamContractErrorCode } from '../errors.js';
/** Rejects ASCII control characters and DEL (0x00-0x1F, 0x7F). */
export declare function hasControlChars(value: string): boolean;
/** Rejects any Unicode whitespace character. */
export declare function hasWhitespace(value: string): boolean;
/**
 * Assert `raw` is a string and return it.
 * @param raw - the unknown input.
 * @param field - the field name, used in the error.
 * @param code - the contract error code to throw.
 * @returns the input as a string.
 * @throws the given `code` when the input is not a string.
 */
export declare function assertIsString(raw: unknown, field: string, code: TeamContractErrorCode): string;
/**
 * Apply the shared structural string rules: non-empty, at most `maxLength`
 * characters, no control characters, and (optionally) no whitespace.
 * @param value - the string to check (already asserted to be a string).
 * @param options - `field` (error field name), `code` (error code), `maxLength`, and `allowWhitespace` (default false).
 * @throws the given `code` with a truncated preview of the value.
 */
export declare function assertStringRules(value: string, options: {
    field: string;
    code: TeamContractErrorCode;
    maxLength: number;
    allowWhitespace?: boolean;
}): void;
/**
 * Assert `raw` is a positive integer >= 1 (safe integer range).
 * @param raw - the unknown input.
 * @param field - the field name, used in the error.
 * @throws `MALFORMED_DTO` when the input is not a positive integer.
 */
export declare function assertPositiveInteger(raw: unknown, field: string): number;
//# sourceMappingURL=common.d.ts.map