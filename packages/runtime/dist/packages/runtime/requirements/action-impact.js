/**
 * pre-alpha3 PR-E (plan §E.7) — the action-impact metadata builders.
 *
 * Gating keys on the action's IMPACT class + the scopes its work depends on
 * — NEVER on the coarse `ActionCategory` alone. The per-action-name → impact
 * class table lives with the actions (`packages/runtime/admission/actions.ts`
 * `ACTION_REQUIREMENT_IMPACT`), which is where the closed action vocabulary
 * is defined; this module provides the pure builders that turn a class + the
 * action's target scopes into the {@link ActionImpact} the gate consumes.
 *
 * Pure module: no I/O, no `node:` builtins.
 * @module @dsh-agent-team/runtime/requirements/action-impact
 */
import { ACTION_IMPACT_CLASSES, isActionImpactClass, teamScope, } from './types.js';
import { REQUIREMENT_ERROR_CODES, RequirementError } from './errors.js';
/**
 * Build an {@link ActionImpact} from a closed impact class + the scopes the
 * action's work depends on.
 *
 * @param impactClass - the closed impact class.
 * @param scopeRefs - the scopes the work depends on (deduped; the Team scope
 *   for team-level work, the target template for per-member work). Empty for
 *   pure coordination / diagnostic actions.
 * @throws {@link RequirementError} `UNKNOWN_ACTION` when the class is not in
 *   the closed set.
 */
export function impactFor(impactClass, scopeRefs = []) {
    if (!isActionImpactClass(impactClass)) {
        throw new RequirementError(REQUIREMENT_ERROR_CODES.UNKNOWN_ACTION, `unknown action-impact class '${impactClass}'`, { impact: impactClass });
    }
    return { impact: impactClass, scopeRefs: [...scopeRefs] };
}
/** A normal-work impact (a model turn / follow-up / delegated task body). */
export function normalWorkImpact(scopeRefs = [teamScope()]) {
    return impactFor(ACTION_IMPACT_CLASSES.normalWork, scopeRefs);
}
/**
 * A recovery-work impact (work performed to RESTORE a downed requirement).
 * Runs on the REDUCED original authority when the scope is blocked (§E.9).
 */
export function recoveryWorkImpact(scopeRefs = [teamScope()]) {
    return impactFor(ACTION_IMPACT_CLASSES.recoveryWork, scopeRefs);
}
/** A control-plane impact (request / resolve control). Always allowed. */
export function controlImpact(scopeRefs = []) {
    return impactFor(ACTION_IMPACT_CLASSES.control, scopeRefs);
}
/** A pure read / diagnostic impact (inspect config, work status). Always allowed. */
export function diagnosticImpact(scopeRefs = []) {
    return impactFor(ACTION_IMPACT_CLASSES.diagnostic, scopeRefs);
}
/** A lifecycle impact (create-member / archive / restore / dispose). Always allowed. */
export function lifecycleImpact(scopeRefs = []) {
    return impactFor(ACTION_IMPACT_CLASSES.lifecycle, scopeRefs);
}
/** A pure coordination impact (list, follow-up message, progress). Always allowed. */
export function coordinationImpact(scopeRefs = []) {
    return impactFor(ACTION_IMPACT_CLASSES.coordination, scopeRefs);
}
/**
 * pre-alpha3 W3-D (review fix F9, guide §8) — a cross-agent execution
 * trigger impact. The action delivers input to another agent (the recipient
 * is woken / handed work). The gate consults EVERY scope the triggering
 * action was evaluated against and blocks if ANY is down — the trigger
 * would deliver work a downed scope cannot serve. The scopeRefs are the
 * SAME refs the action was admitted with (the gate's evaluated scopes), NOT
 * a new reference set.
 */
export function crossAgentTriggerImpact(scopeRefs = []) {
    return impactFor(ACTION_IMPACT_CLASSES.crossAgentTrigger, scopeRefs);
}
//# sourceMappingURL=action-impact.js.map