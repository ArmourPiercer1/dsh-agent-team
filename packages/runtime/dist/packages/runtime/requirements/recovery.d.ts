/**
 * pre-alpha3 PR-E (plan §E.8/§E.9/§E.10) — the DERIVED recovery behavior.
 *
 * Recovery is DERIVED from the current scope verdicts (never a stored
 * "recovery" flag — the §E.10 exit is a fresh evaluation PASS, and a restart
 * RESETS readiness to `unknown`). This module provides:
 *
 * - **reduced original authority** (plan §E.9): recovery work runs on the
 *   REDUCED original authority — the downed capability is `unavailable`, and
 *   every OTHER operation keeps its ORIGINAL policy decision UNCHANGED.
 *   Recovery NEVER upgrades a decision (authority negatives #2/#3: recovery
 *   does not turn bash `ask`→`allow`, and does not turn write `deny`→`ask`).
 *   The external-hard constraint stays ABSOLUTE (#4).
 * - **recovery exit** (plan §E.10): recovery exits when a FRESH requirement
 *   evaluation PASSES (no scope blocked) AND the applicable capabilities that
 *   require materialization are successfully mounted; normal work resumes from
 *   the NEXT boundary. No durable recovery flag is written.
 *
 * Pure module: no I/O, no `node:` builtins.
 * @module @dsh-agent-team/runtime/requirements/recovery
 */
import { type ScopeVerdict } from './types.js';
/** The closed per-operation policy decisions (the effective-policy plane). */
export declare const POLICY_DECISIONS: {
    readonly allow: "allow";
    readonly ask: "ask";
    readonly deny: "deny";
};
/** A closed per-operation policy decision. */
export type PolicyDecision = (typeof POLICY_DECISIONS)[keyof typeof POLICY_DECISIONS];
/** The closed recovery policy-decision vocabulary (the original set + unavailable). */
export declare const RECOVERY_DECISIONS: {
    readonly allow: "allow";
    readonly ask: "ask";
    readonly deny: "deny";
    /** The operation's capability is downed — it cannot be used in recovery. */
    readonly unavailable: "unavailable";
};
/** A closed recovery policy decision. */
export type RecoveryDecision = (typeof RECOVERY_DECISIONS)[keyof typeof RECOVERY_DECISIONS];
/**
 * Compute the RECOVERY policy decision for one operation (plan §E.9).
 *
 * The downed capability is `unavailable`; every other operation keeps its
 * ORIGINAL decision UNCHANGED (recovery never upgrades: `ask` stays `ask`,
 * `deny` stays `deny`, `allow` stays `allow` — authority negatives #2/#3).
 *
 * @param original - the operation's original (pre-recovery) policy decision.
 * @param capabilityDown - whether the operation's capability is the downed one.
 * @returns the closed recovery decision.
 */
export declare function recoveryPolicyDecision(original: PolicyDecision, capabilityDown: boolean): RecoveryDecision;
/**
 * The external-hard constraint (authority negative #4): an external-hard
 * operation is ABSOLUTELY forbidden in EVERY state — normal, degraded, and
 * recovery alike. Recovery never relaxes it.
 * @returns always `false` (an external-hard operation is never allowed).
 */
export declare function externalHardAllowed(): boolean;
/** The input to the recovery-exit check (plan §E.10). */
export interface RecoveryExitInput {
    /** The FRESH scope verdicts (the re-evaluation after the repair attempt). */
    readonly scopeVerdicts: readonly ScopeVerdict[];
    /**
     * Whether every applicable capability that requires materialization is
     * successfully mounted (`true` when there is nothing to materialize, or
     * everything required is mounted). `false` when a required capability is
     * still `pending` / `failed` / `not-applicable`-when-resident.
     */
    readonly materializationSatisfied: boolean;
}
/** The recovery-exit outcome (plan §E.10). */
export interface RecoveryExitResult {
    /** Whether recovery can exit (fresh evaluation PASS + materialization OK). */
    readonly canExit: boolean;
    /** The deterministic reason (no timestamps). */
    readonly reason: string;
    /** Normal work resumes from the NEXT boundary (never mid-turn). */
    readonly resumeAt: 'next-boundary';
}
/**
 * Determine whether recovery can EXIT (plan §E.10): a FRESH requirement
 * evaluation PASSES (no scope is blocked) AND the applicable capabilities
 * that require materialization are successfully mounted. Normal work resumes
 * from the NEXT boundary. NO durable recovery flag is written — the exit is
 * the derived state flipping to "no blocked scope".
 */
export declare function recoveryExitReady(input: RecoveryExitInput): RecoveryExitResult;
//# sourceMappingURL=recovery.d.ts.map