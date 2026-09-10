/**
 * A2 (alpha.2, plan §7.5) — the operation-permission error vocabulary:
 * the closed fail-closed contract of canonicalization.
 *
 * Every rejection produced by {@link canonicalizeOperation} is an
 * {@link OperationPermissionError} with the stable closed code
 * {@link OPERATION_PERMISSION_ERROR_CODES.OPERATION_CANONICALIZATION_FAILED}
 * and lossless-JSON `details` carrying the closed
 * {@link CanonicalizationFailureReason}. Branch on `code` +
 * `details.reason` — never on the message text.
 *
 * Fail-closed contract (plan §7.5): a supported tool whose canonical
 * resource (or a security-relevant argument) cannot be canonicalized
 * THROWS this typed error — it must NEVER resolve to a pass-through
 * (`next()`). The A5 adapter maps the error to a `deny` PreToolDecision.
 * Canonicalization has zero side effects of its own: no durable write,
 * no state mutation (the injected resolver may perform the backend's
 * own read-only I/O — resolution is an identity lookup, not a mutation).
 *
 * `details.tool` is always the closed tool name; `details.reason` is
 * always one of the closed reasons below; `details.value` /
 * `details.resolverError` carry lossless-JSON context only (a
 * `toRemoteSafeDetail`-style coercion — never a live object).
 *
 * @module @dsh-agent-team/runtime/operation-permission/errors
 */
import type { RemoteSafeJsonValue } from '../../contracts/src/index.js';
/** The closed operation-permission error codes. */
export declare const OPERATION_PERMISSION_ERROR_CODES: {
    /**
     * A supported tool's canonical resource or a security-relevant
     * argument could not be canonicalized (see the closed
     * {@link CanonicalizationFailureReason} in `details.reason`). Fail
     * closed: the A5 adapter denies the call.
     */
    readonly OPERATION_CANONICALIZATION_FAILED: "OPERATION_CANONICALIZATION_FAILED";
};
/** One of the closed operation-permission error codes. */
export type OperationPermissionErrorCode = (typeof OPERATION_PERMISSION_ERROR_CODES)[keyof typeof OPERATION_PERMISSION_ERROR_CODES];
/** Every operation-permission error code value, for membership checks. */
export declare const OPERATION_PERMISSION_ERROR_CODE_VALUES: readonly string[];
/**
 * The closed canonicalization-failure reasons (`details.reason`).
 *
 * Argument-shape reasons: a supported tool's arguments are malformed in
 * a way the tool itself would reject BEFORE executing (mirroring the
 * upstream tools' own validation — `parseReadArgs` / `parseWriteArgs` /
 * `parseEditArgs` / `parseLspArgs`), so the call has no well-formed
 * "effective" projection and must not be authorized:
 * - file_path / write content / edit strings: missing, non-string, or
 *   (where the tool rejects it) empty / equal;
 * - read offset/limit: present but not a positive integer;
 * - lsp operation/line/character: unknown operation, or a coordinate
 *   that is not a positive one-based integer.
 *
 * Resolver reasons: the injected seam failed
 * - `resolver-threw` — the resolver rejected (backend typed error,
 *   abort, IO);
 * - `resolver-key-empty` — the resolver resolved but produced an empty
 *   (or non-string) key;
 * - `resolver-result-malformed` — the resolver result is not a plain
 *   `{ key, display }` pair of strings (an adapter bug, not a backend
 *   condition).
 *
 * `tool-unsupported` — the tool name is outside the closed permission
 * vocabulary (a programming error if reached through the A5
 * classification; canonicalization of an unsupported tool is a failure,
 * never a pass-through).
 */
export type CanonicalizationFailureReason = 'tool-unsupported' | 'file-path-missing' | 'file-path-not-a-string' | 'file-path-empty' | 'read-offset-invalid' | 'read-limit-invalid' | 'write-content-missing' | 'write-content-not-a-string' | 'edit-old-string-missing' | 'edit-new-string-missing' | 'edit-string-not-a-string' | 'edit-old-string-empty' | 'edit-old-equals-new' | 'edit-replace-all-not-boolean' | 'lsp-operation-missing' | 'lsp-operation-unknown' | 'lsp-line-invalid' | 'lsp-character-invalid' | 'resolver-threw' | 'resolver-key-empty' | 'resolver-result-malformed';
/** The closed canonicalization-failure reason values, for membership checks. */
export declare const CANONICALIZATION_FAILURE_REASONS: readonly CanonicalizationFailureReason[];
/**
 * One rejection of the operation-permission canonicalization boundary.
 */
export declare class OperationPermissionError extends Error {
    /** The stable closed error code (branch on this, never the message). */
    readonly code: OperationPermissionErrorCode;
    /**
     * Lossless-JSON details: `{ tool, reason }` always; plus the
     * failure-specific context (see {@link CanonicalizationFailureReason}).
     */
    readonly details?: Record<string, unknown>;
    constructor(code: OperationPermissionErrorCode, message: string, details?: Record<string, unknown>);
}
/** Type guard: is `value` an {@link OperationPermissionError}? */
export declare function isOperationPermissionError(value: unknown): value is OperationPermissionError;
/**
 * Raise one closed canonicalization failure (the module-internal
 * constructor — production code raises failures ONLY through this).
 * @param tool - the closed tool name the failure belongs to.
 * @param reason - the closed failure reason.
 * @param context - optional extra lossless-JSON context (coerced).
 */
export declare function canonicalizationFailed(tool: string, reason: CanonicalizationFailureReason, context?: Record<string, unknown>): OperationPermissionError;
/**
 * Coerce one unknown detail value to lossless JSON (the public helper
 * re-exported for the A5 adapter's error mapping).
 * @param value - the unknown value.
 * @returns a lossless-JSON representation (never throws).
 */
export declare function toCanonicalizationDetail(value: unknown): RemoteSafeJsonValue;
//# sourceMappingURL=errors.d.ts.map