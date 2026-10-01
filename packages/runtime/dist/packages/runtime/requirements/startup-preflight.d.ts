/**
 * pre-alpha3 PR-E (plan §E.6) — the startup preflight: evaluate ALL Team +
 * Leader + MemberTemplate requirements BEFORE the Team is created, and
 * classify the outcome.
 *
 * The classification (plan §E.6), in priority order:
 *
 * 1. **Team-level required down** → `fatal`. A Team-level required
 *    requirement that is unmet CANNOT be bypassed by disabling a template
 *    (the Team itself cannot run). (authority: "Team-level required missing
 *    不允许通过 disable 某 template 绕过".)
 * 2. **Required TEMPLATE down (not disabled)** → `fixOrDisable`. The human
 *    must fix the requirement + recheck, OR disable the template. A template
 *    that is ALREADY disabled is RESOLVED (its required work will not start),
 *    so it does not trigger `fixOrDisable`.
 * 3. **Optional missing (not consented)** → `consentRequired`. An OPTIONAL
 *    requirement that is unmet and has no durable consent requires the human
 *    to consent to run degraded. A consented optional is RESOLVED.
 * 4. otherwise → `proceed`.
 *
 * The preflight is PURE: it reads the scope verdicts (the compatibility
 * engine's outcomes, projected) + the durable consents + the durable template
 * availability, and produces a closed {@link PreflightResult}. No I/O.
 * @module @dsh-agent-team/runtime/requirements/startup-preflight
 */
import { type PreflightResult, type RequirementScope } from './types.js';
import { type EvaluationInput } from './evaluator.js';
export declare function startupPreflight(input: EvaluationInput): PreflightResult;
/**
 * The scopes a `fixOrDisable` outcome leaves for the human to act on (the
 * non-disabled blocked templates).
 */
export declare function fixOrDisableTargets(result: PreflightResult): readonly RequirementScope[];
//# sourceMappingURL=startup-preflight.d.ts.map