/**
 * C-FS error closed set — the three-way split (INTERFACES-v1 C-FS):
 *
 *   denied       — the policy KNOWS and says no (scope, alias, fd, window);
 *   hidden       — observation policy withholds existence; a hidden READ or
 *                  WRITE is a typed error that MUST carry a non-empty
 *                  diagnostic line (hidden-read 永不静默); a hidden STAT is
 *                  the honest `withheld: true` observation, never silence;
 *   undetermined — the mediator cannot establish what the open actually hit
 *                  (exec-time identity drift, unconfirmed write side effect).
 *                  `sideEffectUnknown` is stated by the caller's honesty and
 *                  never implied.
 *
 * NO LANE-INVENTED CODES: every error keeps a frozen PR0 §5 `code`; the
 * C-FS class and the closed reason ride in `details` (`cfClass`,
 * `cfReason`, `cfDiagnostic?`). The class→code mapping is this lane's
 * contract table (README §2):
 *
 *   denied / hidden         → TOOL_BINDING_UNVERIFIED   (effect outside what
 *                             the verified grant+policy covers — PR0's own
 *                             `effect-outside-grant` precedent)
 *   grant staleness reasons → APPROVAL_STALE            (PR0 grant.ts map)
 *   identity undetermined   → IO_POLICY_UNSUPPORTED     (the strict profile
 *                             cannot PROVE the guarantee here — plan §6)
 *   unconfirmed write race  → EXECUTION_TERMINATION_UNCONFIRMED + sideEffectUnknown
 *
 * @module packages/runtime/controlled-fs/src/cf-errors
 */
/** The closed C-FS error classes (exactly three). */
export const CF_ERROR_CLASSES = ['denied', 'hidden', 'undetermined'];
/** Closed reason sets, partitioned by class. */
export const CF_DENIED_REASONS = [
    'path-rejected',
    'realm-mismatch',
    'effect-outside-grant',
    'authority-generation-stale',
    'grant-expired',
    'grant-consumed',
    'outside-anchor',
    'symlink-alias',
    'denied-inode',
    'exec-time-escape',
    'fd-closed',
    'fd-recycled',
    'window-rejected',
    'not-a-file',
    'not-a-directory',
];
export const CF_HIDDEN_REASONS = ['hidden-read', 'hidden-write'];
export const CF_UNDETERMINED_REASONS = [
    'exec-time-identity-drift',
    'write-side-effect-unconfirmed',
];
const CLASS_OF = Object.freeze({
    'path-rejected': 'denied',
    'realm-mismatch': 'denied',
    'effect-outside-grant': 'denied',
    'authority-generation-stale': 'denied',
    'grant-expired': 'denied',
    'grant-consumed': 'denied',
    'outside-anchor': 'denied',
    'symlink-alias': 'denied',
    'denied-inode': 'denied',
    'exec-time-escape': 'denied',
    'fd-closed': 'denied',
    'fd-recycled': 'denied',
    'window-rejected': 'denied',
    'not-a-file': 'denied',
    'not-a-directory': 'denied',
    'hidden-read': 'hidden',
    'hidden-write': 'hidden',
    'exec-time-identity-drift': 'undetermined',
    'write-side-effect-unconfirmed': 'undetermined',
});
/** Total lookup over the closed reason set; an unknown reason is a bug. */
export function cfsErrorClassOfReason(reason) {
    const cls = CLASS_OF[reason];
    if (cls === undefined)
        throw new Error(`cfs: reason outside the closed set: ${String(reason)}`);
    return cls;
}
/** Frozen §5 code per reason (the lane's contract table). */
const CODE_OF = Object.freeze({
    'path-rejected': 'TOOL_BINDING_UNVERIFIED',
    'realm-mismatch': 'TOOL_BINDING_UNVERIFIED',
    'effect-outside-grant': 'TOOL_BINDING_UNVERIFIED',
    'authority-generation-stale': 'APPROVAL_STALE',
    'grant-expired': 'APPROVAL_STALE',
    'grant-consumed': 'APPROVAL_STALE',
    'outside-anchor': 'TOOL_BINDING_UNVERIFIED',
    'symlink-alias': 'TOOL_BINDING_UNVERIFIED',
    'denied-inode': 'TOOL_BINDING_UNVERIFIED',
    'exec-time-escape': 'TOOL_BINDING_UNVERIFIED',
    'fd-closed': 'TOOL_BINDING_UNVERIFIED',
    'fd-recycled': 'TOOL_BINDING_UNVERIFIED',
    'window-rejected': 'TOOL_BINDING_UNVERIFIED',
    'not-a-file': 'TOOL_BINDING_UNVERIFIED',
    'not-a-directory': 'TOOL_BINDING_UNVERIFIED',
    'hidden-read': 'TOOL_BINDING_UNVERIFIED',
    'hidden-write': 'TOOL_BINDING_UNVERIFIED',
    'exec-time-identity-drift': 'IO_POLICY_UNSUPPORTED',
    'write-side-effect-unconfirmed': 'EXECUTION_TERMINATION_UNCONFIRMED',
});
function baseError(reason, message, extra) {
    return Object.freeze({
        code: CODE_OF[reason],
        message,
        ...(extra?.['sideEffectUnknown'] === true ? { sideEffectUnknown: true } : {}),
        details: Object.freeze({
            cfClass: CLASS_OF[reason],
            cfReason: reason,
            ...extra,
            ...(extra?.['sideEffectUnknown'] === true ? { sideEffectUnknown: true } : {}),
        }),
    });
}
/** A `denied` result (never silent, never retryable by implication). */
export function cfsDenial(reason, message) {
    return { ok: false, error: baseError(reason, message) };
}
/**
 * A `hidden` access result: typed denial + REQUIRED diagnostic line.
 * An empty or blank diagnostic cannot be constructed (throws) — the
 * "hidden-read 永不静默" law is enforced by the constructor itself.
 */
export function cfsHidden(reason, message, diagnostic) {
    if (typeof diagnostic !== 'string' || diagnostic.trim().length === 0) {
        throw new Error('cfs: a hidden-access refusal REQUIRES a non-empty diagnostic line (hidden-read is never silent)');
    }
    return {
        ok: false,
        error: baseError(reason, `${message} [diagnostic] ${diagnostic.trim()}`, { cfDiagnostic: diagnostic.trim() }),
    };
}
/**
 * An `undetermined` result. `sideEffectPossible` is the caller's honest
 * statement (a raced WRITE may have landed; a verified-before-read never
 * did) and is mirrored into the frozen `sideEffectUnknown` field.
 */
export function cfsUndetermined(reason, message, opts) {
    return {
        ok: false,
        error: baseError(reason, message, { sideEffectUnknown: opts.sideEffectPossible }),
    };
}
/** Narrowing helper for the implementation. */
export function isFailure(r) {
    return r.ok === false;
}
//# sourceMappingURL=cf-errors.js.map