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
import { type ActionImpact, type ActionImpactClass, type RequirementScope } from './types.js';
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
export declare function impactFor(impactClass: ActionImpactClass, scopeRefs?: readonly RequirementScope[]): ActionImpact;
/** A normal-work impact (a model turn / follow-up / delegated task body). */
export declare function normalWorkImpact(scopeRefs?: readonly RequirementScope[]): ActionImpact;
/**
 * A recovery-work impact (work performed to RESTORE a downed requirement).
 * Runs on the REDUCED original authority when the scope is blocked (§E.9).
 */
export declare function recoveryWorkImpact(scopeRefs?: readonly RequirementScope[]): ActionImpact;
/** A control-plane impact (request / resolve control). Always allowed. */
export declare function controlImpact(scopeRefs?: readonly RequirementScope[]): ActionImpact;
/** A pure read / diagnostic impact (inspect config, work status). Always allowed. */
export declare function diagnosticImpact(scopeRefs?: readonly RequirementScope[]): ActionImpact;
/** A lifecycle impact (create-member / archive / restore / dispose). Always allowed. */
export declare function lifecycleImpact(scopeRefs?: readonly RequirementScope[]): ActionImpact;
/** A pure coordination impact (list, follow-up message, progress). Always allowed. */
export declare function coordinationImpact(scopeRefs?: readonly RequirementScope[]): ActionImpact;
//# sourceMappingURL=action-impact.d.ts.map