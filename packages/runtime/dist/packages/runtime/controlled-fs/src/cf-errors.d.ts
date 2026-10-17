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
import type { GovernanceError, GovernanceResult } from '../../../domain/tool-governance/src/index.js';
/** The closed C-FS error classes (exactly three). */
export declare const CF_ERROR_CLASSES: readonly ["denied", "hidden", "undetermined"];
export type CfErrorClass = (typeof CF_ERROR_CLASSES)[number];
/** Closed reason sets, partitioned by class. */
export declare const CF_DENIED_REASONS: readonly ["path-rejected", "realm-mismatch", "effect-outside-grant", "authority-generation-stale", "grant-expired", "grant-consumed", "outside-anchor", "symlink-alias", "denied-inode", "exec-time-escape", "fd-closed", "fd-recycled", "window-rejected", "not-a-file", "not-a-directory"];
export declare const CF_HIDDEN_REASONS: readonly ["hidden-read", "hidden-write"];
export declare const CF_UNDETERMINED_REASONS: readonly ["exec-time-identity-drift", "write-side-effect-unconfirmed"];
export type CfDenyReason = (typeof CF_DENIED_REASONS)[number];
export type CfHiddenReason = (typeof CF_HIDDEN_REASONS)[number];
export type CfUndeterminedReason = (typeof CF_UNDETERMINED_REASONS)[number];
export type CfReason = CfDenyReason | CfHiddenReason | CfUndeterminedReason;
/** Total lookup over the closed reason set; an unknown reason is a bug. */
export declare function cfsErrorClassOfReason(reason: CfReason): CfErrorClass;
/** A `denied` result (never silent, never retryable by implication). */
export declare function cfsDenial(reason: CfDenyReason, message: string): {
    ok: false;
    error: GovernanceError;
};
/**
 * A `hidden` access result: typed denial + REQUIRED diagnostic line.
 * An empty or blank diagnostic cannot be constructed (throws) — the
 * "hidden-read 永不静默" law is enforced by the constructor itself.
 */
export declare function cfsHidden(reason: CfHiddenReason, message: string, diagnostic: string): {
    ok: false;
    error: GovernanceError;
};
/**
 * An `undetermined` result. `sideEffectPossible` is the caller's honest
 * statement (a raced WRITE may have landed; a verified-before-read never
 * did) and is mirrored into the frozen `sideEffectUnknown` field.
 */
export declare function cfsUndetermined(reason: CfUndeterminedReason, message: string, opts: {
    readonly sideEffectPossible: boolean;
}): {
    ok: false;
    error: GovernanceError;
};
/** Narrowing helper for the implementation. */
export declare function isFailure<T>(r: GovernanceResult<T>): r is {
    ok: false;
    error: GovernanceError;
};
//# sourceMappingURL=cf-errors.d.ts.map