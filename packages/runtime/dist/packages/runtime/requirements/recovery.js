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
import { SCOPE_STATES } from './types.js';
/** The closed per-operation policy decisions (the effective-policy plane). */
export const POLICY_DECISIONS = {
    allow: 'allow',
    ask: 'ask',
    deny: 'deny',
};
/** The closed recovery policy-decision vocabulary (the original set + unavailable). */
export const RECOVERY_DECISIONS = {
    allow: 'allow',
    ask: 'ask',
    deny: 'deny',
    /** The operation's capability is downed — it cannot be used in recovery. */
    unavailable: 'unavailable',
};
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
export function recoveryPolicyDecision(original, capabilityDown) {
    if (capabilityDown)
        return RECOVERY_DECISIONS.unavailable;
    return original;
}
/**
 * The external-hard constraint (authority negative #4): an external-hard
 * operation is ABSOLUTELY forbidden in EVERY state — normal, degraded, and
 * recovery alike. Recovery never relaxes it.
 * @returns always `false` (an external-hard operation is never allowed).
 */
export function externalHardAllowed() {
    return false;
}
/**
 * Determine whether recovery can EXIT (plan §E.10): a FRESH requirement
 * evaluation PASSES (no scope is blocked) AND the applicable capabilities
 * that require materialization are successfully mounted. Normal work resumes
 * from the NEXT boundary. NO durable recovery flag is written — the exit is
 * the derived state flipping to "no blocked scope".
 */
export function recoveryExitReady(input) {
    const blocked = input.scopeVerdicts.filter((s) => s.state === SCOPE_STATES.blocked);
    if (blocked.length > 0) {
        return {
            canExit: false,
            reason: `recovery not exit-ready: ${blocked.length} scope(s) still blocked`,
            resumeAt: 'next-boundary',
        };
    }
    if (input.materializationSatisfied === false) {
        return {
            canExit: false,
            reason: 'recovery not exit-ready: required materialization not satisfied',
            resumeAt: 'next-boundary',
        };
    }
    return {
        canExit: true,
        reason: 'fresh evaluation PASS + materialization satisfied; normal resumes at the next boundary',
        resumeAt: 'next-boundary',
    };
}
//# sourceMappingURL=recovery.js.map