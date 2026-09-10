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
import { toRemoteSafeDetail } from '../../contracts/src/index.js';
/** The closed operation-permission error codes. */
export const OPERATION_PERMISSION_ERROR_CODES = {
    /**
     * A supported tool's canonical resource or a security-relevant
     * argument could not be canonicalized (see the closed
     * {@link CanonicalizationFailureReason} in `details.reason`). Fail
     * closed: the A5 adapter denies the call.
     */
    OPERATION_CANONICALIZATION_FAILED: 'OPERATION_CANONICALIZATION_FAILED',
};
/** Every operation-permission error code value, for membership checks. */
export const OPERATION_PERMISSION_ERROR_CODE_VALUES = Object.values(OPERATION_PERMISSION_ERROR_CODES);
/** The closed canonicalization-failure reason values, for membership checks. */
export const CANONICALIZATION_FAILURE_REASONS = [
    'tool-unsupported',
    'file-path-missing',
    'file-path-not-a-string',
    'file-path-empty',
    'read-offset-invalid',
    'read-limit-invalid',
    'write-content-missing',
    'write-content-not-a-string',
    'edit-old-string-missing',
    'edit-new-string-missing',
    'edit-string-not-a-string',
    'edit-old-string-empty',
    'edit-old-equals-new',
    'edit-replace-all-not-boolean',
    'lsp-operation-missing',
    'lsp-operation-unknown',
    'lsp-line-invalid',
    'lsp-character-invalid',
    'resolver-threw',
    'resolver-key-empty',
    'resolver-result-malformed',
];
/**
 * One rejection of the operation-permission canonicalization boundary.
 */
export class OperationPermissionError extends Error {
    /** The stable closed error code (branch on this, never the message). */
    code;
    /**
     * Lossless-JSON details: `{ tool, reason }` always; plus the
     * failure-specific context (see {@link CanonicalizationFailureReason}).
     */
    details;
    constructor(code, message, details) {
        super(message);
        this.name = 'OperationPermissionError';
        this.code = code;
        if (details !== undefined) {
            this.details = details;
        }
    }
}
/** Type guard: is `value` an {@link OperationPermissionError}? */
export function isOperationPermissionError(value) {
    return value instanceof OperationPermissionError;
}
/**
 * Raise one closed canonicalization failure (the module-internal
 * constructor — production code raises failures ONLY through this).
 * @param tool - the closed tool name the failure belongs to.
 * @param reason - the closed failure reason.
 * @param context - optional extra lossless-JSON context (coerced).
 */
export function canonicalizationFailed(tool, reason, context) {
    const details = {
        tool: toRemoteSafeDetail(tool),
        reason: toRemoteSafeDetail(reason),
    };
    if (context !== undefined) {
        for (const [key, item] of Object.entries(context)) {
            details[key] = toRemoteSafeDetail(item);
        }
    }
    const message = reason === 'resolver-threw' && context?.resolverError !== undefined
        ? `canonicalization failed for tool "${tool}": ${reason} (${String(context.resolverError)})`
        : `canonicalization failed for tool "${tool}": ${reason}`;
    return new OperationPermissionError(OPERATION_PERMISSION_ERROR_CODES.OPERATION_CANONICALIZATION_FAILED, message, details);
}
/**
 * Coerce one unknown detail value to lossless JSON (the public helper
 * re-exported for the A5 adapter's error mapping).
 * @param value - the unknown value.
 * @returns a lossless-JSON representation (never throws).
 */
export function toCanonicalizationDetail(value) {
    return toRemoteSafeDetail(value);
}
//# sourceMappingURL=errors.js.map