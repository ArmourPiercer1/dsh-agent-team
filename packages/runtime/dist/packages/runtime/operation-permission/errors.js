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
    'bash-command-missing',
    'bash-command-not-a-string',
    'bash-command-empty',
    'bash-workdir-not-a-string',
    'bash-run-in-background-not-boolean',
    'bash-timeout-ms-invalid',
    'bash-sandbox-permissions-not-a-string',
    'pwsh-command-missing',
    'pwsh-command-not-a-string',
    'pwsh-command-empty',
    'pwsh-workdir-not-a-string',
    'pwsh-run-in-background-not-boolean',
    'pwsh-timeout-ms-invalid',
    'pwsh-sandbox-permissions-not-a-string',
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
// ---------------------------------------------------------------------------
// A5 install-time error vocabulary (the monotonic end-cap guard seam, H1).
// ---------------------------------------------------------------------------
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
export const PRE_EXECUTE_INSTALL_ERROR_CODES = {
    /**
     * The agent ctx is missing the `tools.guard` seam (a broken host, or
     * an upstream without the monotonic guard stage): the end-cap guard
     * cannot be registered. Installing the waterfall listener WITHOUT the
     * guard would leave the parameter permission pipeline bypassable by a
     * hostile `tools/pre-execute` listener, so the install FAILS CLOSED
     * before ANY registration (zero partial state).
     */
    ALPHA2_PERMISSION_GUARD_UNAVAILABLE: 'alpha2-permission-guard-unavailable',
};
/**
 * One rejection of the A5 install factory: the agent ctx lacks the
 * `tools.guard` seam the monotonic end-cap guard requires (H1, the P0
 * fix). Thrown synchronously at install, BEFORE the `tools/pre-execute`
 * listener is registered (zero partial state — nothing to dispose).
 * Branch on {@link code}, never the message.
 */
export class PermissionGuardUnavailableError extends Error {
    /** The stable closed error code (branch on this, never the message). */
    code;
    constructor(message) {
        super(message);
        this.name = 'PermissionGuardUnavailableError';
        this.code = PRE_EXECUTE_INSTALL_ERROR_CODES.ALPHA2_PERMISSION_GUARD_UNAVAILABLE;
    }
}
/** Type guard: is `value` a {@link PermissionGuardUnavailableError}? */
export function isPermissionGuardUnavailableError(value) {
    return value instanceof PermissionGuardUnavailableError;
}
// ---------------------------------------------------------------------------
// A2C-2 (alpha.2, plan §7.4) — the Permission Coverage Gate error:
// the typed setup/compatibility failure of a strict
// (capabilities.permissions) agent whose FINAL model-facing tool surface
// carries a KNOWN_SENSITIVE_UNMANAGED or UNKNOWN_UNMANAGED tool.
//
// The detail is DETERMINISTIC (the unmanaged tool names sorted — see
// `buildPermissionCoverageErrorDetail` in `permission-coverage.ts`):
// `instanceId` + `presetId` + `unmanagedTools[{name, classification,
// reason, remediation}]`. Branch on {@link code} + {@link detail},
// never on the message text (the existing failure surface — the
// AgentSetup rejection rolling the unpublished agent back — displays the
// typed diagnostic; this round adds no dedicated UI, plan §7.4).
// ---------------------------------------------------------------------------
/** The closed Permission Coverage Gate error codes (A2C-2, plan §7.4). */
export const PERMISSION_COVERAGE_ERROR_CODES = {
    /**
     * The final surface of a strict agent carries a tool with no reviewed
     * authority owner (a KNOWN_SENSITIVE_UNMANAGED or an UNKNOWN_UNMANAGED
     * entry in `detail.unmanagedTools`). The setup FAILS LOUDLY — NO
     * auto-hide (the gate never `restrict()`s a discovered tool) and NO
     * acknowledgement escape hatch (plan §7.5 / §7.3-F).
     */
    ALPHA2_PERMISSION_COVERAGE_UNMANAGED: 'alpha2-permission-coverage-unmanaged-tools',
};
/**
 * One rejection of a strict setup by the Permission Coverage Gate
 * (A2C-2, plan §7.4): the final model-facing surface carries an
 * unmanaged (known-sensitive or unknown) tool. Thrown at the verified
 * insertion point (after the MCP reconcile, before the
 * parameter-permission listener — plan §7.2); the rejection propagates
 * out of the AgentSetup callback and rolls the unpublished agent back
 * (the AgentSetup contract) — the strict agent never runs on a surface
 * the gate did not verify. Branch on {@link code} + {@link detail},
 * never the message.
 */
export class PermissionCoverageUnmanagedError extends Error {
    /** The stable closed error code (branch on this, never the message). */
    code;
    /** The deterministic failure detail (plan §7.4). */
    detail;
    constructor(detail) {
        super(permissionCoverageUnmanagedMessage(detail));
        this.name = 'PermissionCoverageUnmanagedError';
        this.code = PERMISSION_COVERAGE_ERROR_CODES.ALPHA2_PERMISSION_COVERAGE_UNMANAGED;
        this.detail = detail;
    }
}
/** Type guard: is `value` a {@link PermissionCoverageUnmanagedError}? */
export function isPermissionCoverageUnmanagedError(value) {
    return value instanceof PermissionCoverageUnmanagedError;
}
/**
 * The deterministic message of one coverage-gate failure (the closed
 * code embedded in the text, the unmanaged names sorted with their
 * class — the existing failure surface displays this diagnostic).
 * @param detail - the deterministic failure detail.
 * @returns the stable message.
 */
function permissionCoverageUnmanagedMessage(detail) {
    const entries = detail.unmanagedTools
        .map((entry) => `${entry.name} (${entry.classification})`)
        .join(', ');
    return (`permission coverage gate failed for instance '${detail.instanceId}': ` +
        `${detail.unmanagedTools.length} unmanaged tool(s) on the final model-facing surface: ${entries} ` +
        `(code: ${PERMISSION_COVERAGE_ERROR_CODES.ALPHA2_PERMISSION_COVERAGE_UNMANAGED})`);
}
// ---------------------------------------------------------------------------
// A4-PR4 lane B (alpha.4 plan Task 4, spec §12.1/§13) — the typed
// capability/environment outcome family.
//
// An external runtime constraint (a host hard cell that refuses the tool,
// an allow-list that does not name it, a `capabilityExists: false`, a
// faulting or malformed facts probe) is an EXECUTION CAPABILITY/ENVIRONMENT
// fact about the host. It is NOT a Team permission outcome: the Team's own
// decision may well be ALLOW, and the call still cannot run. Before this
// family existed the same fact was reported with the permission vocabulary
// (`permission denied: the external hard policy no longer allows …`), which
// tells the caller that some authority refused it and invites an approval
// round that no authority can honor.
//
// The upstream pre-tool carrier has one non-execution shape, so the
// distinction lives in the REASON: a capability denial starts with the
// stable prefix below and embeds the closed code. Branch on the code, never
// on the prose that follows it.
// ---------------------------------------------------------------------------
/** The stable prefix every capability/environment denial reason carries. */
export const PRE_EXECUTE_CAPABILITY_REASON_PREFIX = 'execution unavailable:';
/**
 * The closed capability/environment codes of the pre-execute pipeline
 * (spec §13's typed families, in this repository's existing
 * kebab-case `alpha*-` convention).
 *
 * TWO members, and the omission is deliberate and measured. The frozen
 * read-only external check (`ControlService.checkExternalOperation`) answers
 * `{ allowed: false, reason: <free text> }` and folds EVERY fail-closed case
 * into that one shape — a hard deny, an unnamed allow-list item, an explicit
 * `capabilityExists: false`, a faulting facts probe and a malformed facts
 * shape are indistinguishable through it. Spec §13's third family
 * (`CAPABILITY_UNAVAILABLE`, the host has no such capability) therefore has
 * NO producer that could emit it truthfully, and this PR declares no code no
 * path can return — the same rule `governance/runtime-authority.ts:130-137`
 * states for an unreachable outcome arm. Splitting the two needs a
 * verdict-shape change in `packages/runtime/control/types.ts`, which is
 * outside Task 4's declared files; the gap is reported, not papered over.
 */
export const PRE_EXECUTE_CAPABILITY_ERROR_CODES = {
    /**
     * The host's external hard policy refuses this operation (a hard deny
     * cell, an allow-list that does not name the tool, or the shared check's
     * own fail-closed reading of faulted/malformed external facts).
     */
    EXTERNAL_RUNTIME_RESTRICTION: 'alpha4-external-runtime-restriction',
    /**
     * The environment question could not be asked: the shared external check
     * itself threw, so no verdict about the host is available at all.
     * Fail-closed denial, distinct from a refusal the host actually stated.
     */
    HOST_ENVIRONMENT_UNAVAILABLE: 'alpha4-host-environment-unavailable',
};
/** Every capability/environment code value, for membership checks. */
export const PRE_EXECUTE_CAPABILITY_ERROR_CODE_VALUES = Object.values(PRE_EXECUTE_CAPABILITY_ERROR_CODES);
/**
 * The deterministic reason string of one capability/environment denial: the
 * stable prefix, the closed code in brackets, then the diagnostic. The
 * diagnostic is free text (the frozen check's own fail-closed explanation);
 * the PREFIX and the CODE are the contract.
 * @param code - the closed capability/environment code.
 * @param detail - the diagnostic (never authority data).
 * @returns the stable denial reason.
 */
export function capabilityDenialReason(code, detail) {
    return `${PRE_EXECUTE_CAPABILITY_REASON_PREFIX} [${code}] ${detail}`;
}
//# sourceMappingURL=errors.js.map