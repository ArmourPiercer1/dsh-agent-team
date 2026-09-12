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
 * `parseEditArgs` / `parseLspArgs` / the shell class `validateBashArgs`
 * / `validatePwshArgs`), so the call has no well-formed "effective"
 * projection and must not be authorized:
 * - file_path / write content / edit strings: missing, non-string, or
 *   (where the tool rejects it) empty / equal;
 * - shell-class command (`bash` / `pwsh`): missing, non-string, or
 *   whitespace-only (each upstream shell tool rejects all three before
 *   execution — H2 P1-2: the command is the security-relevant field for
 *   the shell class, so a call without a well-formed command cannot be
 *   authorized; A2C-1 mirrors the per-tool reasons: `bash-command-*`
 *   over `tool-bash` `validateBashArgs`, `pwsh-command-*` over
 *   `tool-pwsh` `validatePwshArgs`);
 * - shell-class effect fields (H5 P1-B, A2C-1: the execution effect of a
 *   shell call — WHERE it runs, foreground vs detached, the explicit
 *   timeout, and the requested sandbox mode — are security-relevant too,
 *   and the upstream materialization feeds them to the pre-execute
 *   waterfall UNVALIDATED — `validateBashArgs` / `validatePwshArgs` run
 *   inside `execute`, after the gate — so a malformed effect shape has
 *   no well-formed "effective" projection and fails closed BEFORE the
 *   resolver call; the reasons are per-tool-mirrored, one family per
 *   upstream shell tool):
 *   - `bash-workdir-not-a-string` / `pwsh-workdir-not-a-string` —
 *     `workdir` present and not a string (omitted / empty-string is
 *     LEGITIMATE — normalized to the session cwd, the tool's own
 *     defaulting);
 *   - `bash-run-in-background-not-boolean` /
 *     `pwsh-run-in-background-not-boolean` — `run_in_background`
 *     present and not a boolean;
 *   - `bash-timeout-ms-invalid` / `pwsh-timeout-ms-invalid` —
 *     `timeoutMs` present and not a finite number > 0 (mirrors the
 *     upstream `validateBashArgs` / `validatePwshArgs` check);
 *   - `bash-sandbox-permissions-not-a-string` /
 *     `pwsh-sandbox-permissions-not-a-string` — `sandbox_permissions`
 *     present and not a string (any string — including `''` — is its
 *     own value: mode LEGALITY is the upstream authority at execution,
 *     and the escalation pairing with `justification` stays upstream's);
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
export type CanonicalizationFailureReason = 'tool-unsupported' | 'file-path-missing' | 'file-path-not-a-string' | 'file-path-empty' | 'read-offset-invalid' | 'read-limit-invalid' | 'write-content-missing' | 'write-content-not-a-string' | 'edit-old-string-missing' | 'edit-new-string-missing' | 'edit-string-not-a-string' | 'edit-old-string-empty' | 'edit-old-equals-new' | 'edit-replace-all-not-boolean' | 'lsp-operation-missing' | 'lsp-operation-unknown' | 'lsp-line-invalid' | 'lsp-character-invalid' | 'bash-command-missing' | 'bash-command-not-a-string' | 'bash-command-empty' | 'bash-workdir-not-a-string' | 'bash-run-in-background-not-boolean' | 'bash-timeout-ms-invalid' | 'bash-sandbox-permissions-not-a-string' | 'pwsh-command-missing' | 'pwsh-command-not-a-string' | 'pwsh-command-empty' | 'pwsh-workdir-not-a-string' | 'pwsh-run-in-background-not-boolean' | 'pwsh-timeout-ms-invalid' | 'pwsh-sandbox-permissions-not-a-string' | 'resolver-threw' | 'resolver-key-empty' | 'resolver-result-malformed';
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
/**
 * The closed install-time error codes of the A5 pre-execute adapter.
 *
 * These mirror the A6 glue's kebab-case `alpha2-permission-*` install
 * failure codes (V1-1 `alpha2-permission-fs-unavailable`,
 * `alpha2-permission-control-unavailable`): the same shape — a plain
 * `Error` with a stable `.code` and a message carrying the code — so
 * the glue's existing install-failure handling (rejection out of
 * AgentSetup → rollback of the unpublished agent) applies unchanged: a
 * permissions agent never runs unguarded.
 */
export declare const PRE_EXECUTE_INSTALL_ERROR_CODES: {
    /**
     * The agent ctx is missing the `tools.guard` seam (a broken host, or
     * an upstream without the monotonic guard stage): the end-cap guard
     * cannot be registered. Installing the waterfall listener WITHOUT the
     * guard would leave the parameter permission pipeline bypassable by a
     * hostile `tools/pre-execute` listener, so the install FAILS CLOSED
     * before ANY registration (zero partial state).
     */
    readonly ALPHA2_PERMISSION_GUARD_UNAVAILABLE: "alpha2-permission-guard-unavailable";
};
/** One of the closed A5 install-time error codes. */
export type PreExecuteInstallErrorCode = (typeof PRE_EXECUTE_INSTALL_ERROR_CODES)[keyof typeof PRE_EXECUTE_INSTALL_ERROR_CODES];
/**
 * One rejection of the A5 install factory: the agent ctx lacks the
 * `tools.guard` seam the monotonic end-cap guard requires (H1, the P0
 * fix). Thrown synchronously at install, BEFORE the `tools/pre-execute`
 * listener is registered (zero partial state — nothing to dispose).
 * Branch on {@link code}, never the message.
 */
export declare class PermissionGuardUnavailableError extends Error {
    /** The stable closed error code (branch on this, never the message). */
    readonly code: PreExecuteInstallErrorCode;
    constructor(message: string);
}
/** Type guard: is `value` a {@link PermissionGuardUnavailableError}? */
export declare function isPermissionGuardUnavailableError(value: unknown): value is PermissionGuardUnavailableError;
//# sourceMappingURL=errors.d.ts.map