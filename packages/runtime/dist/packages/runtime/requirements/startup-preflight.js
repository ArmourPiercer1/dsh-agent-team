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
import { PREFLIGHT_OUTCOMES, scopeKey, SCOPE_STATES, } from './types.js';
import { evaluateScopes } from './evaluator.js';
/**
 * Run the startup preflight over the bound blueprint's requirement verdicts.
 * @param input - the scope verdicts + durable consents + template availability.
 * @returns the closed {@link PreflightResult}.
 */
/**
 * Finding J (2026-10-01, ADR-12) — whether one durable consent COVERS one
 * unmet optional requirement in one scope. The consent key is the immutable
 * (scope, blueprint content hash, requirementId) triple:
 *
 * - `requirementId` must equal the warning's requirementId;
 * - the consent's `scopeKey` must equal the warning's scope key — a consent
 *   granted for the Team scope does NOT cover a same-id warning in a
 *   template scope (or vice versa);
 * - the consent's `contentHash` must equal the evaluation's bound blueprint
 *   content hash — a consent granted against rev1 does NOT cover rev2 (a
 *   stale-blueprint consent is not inherited).
 *
 * Compatibility (disclosed migration behavior): a LEGACY consent row
 * (written before the keying — neither key field present) is honored ONLY by
 * a LEGACY evaluation (no `blueprintContentHash` modeled — the pre-J unit
 * face, where the match is the byte-identical requirementId-only semantics).
 * A KEYED evaluation (the production creation preflight always models the
 * hash) fails CLOSED on a legacy row: it is never treated as consented, and
 * the human must re-grant. There is no blanket approve.
 */
function consentCovers(consent, requirementId, warningScopeKey, currentContentHash) {
    if (consent.requirementId !== requirementId)
        return false;
    const legacy = currentContentHash === undefined;
    // Scope part: a keyed consent must name the warning's scope; a legacy
    // (unkeyed) consent matches only in a legacy evaluation.
    const scopeOk = consent.scopeKey === undefined ? legacy : consent.scopeKey === warningScopeKey;
    // Hash part: a keyed consent must bind the current blueprint hash; a
    // legacy (unkeyed) consent matches only in a legacy evaluation.
    const hashOk = consent.contentHash === undefined ? legacy : consent.contentHash === currentContentHash;
    return scopeOk && hashOk;
}
export function startupPreflight(input) {
    const scopes = evaluateScopes(input);
    const availability = new Map((input.availability ?? []).map((a) => [a.templateId, a.available]));
    const consents = input.consents ?? [];
    const currentHash = input.blueprintContentHash;
    const team = scopes.find((s) => s.scope.level === 'team');
    const templates = scopes.filter((s) => s.scope.level === 'template');
    // 1. Team-level required down → FATAL (cannot be bypassed by a disable).
    if (team !== undefined && team.state === SCOPE_STATES.blocked) {
        return {
            outcome: PREFLIGHT_OUTCOMES.fatal,
            scopes,
            consentRequiredRequirementIds: [],
            fixOrDisableRequirementIds: [],
            fatalRequirementIds: team.fatal.map((v) => v.requirementId),
        };
    }
    // 2. A required template down that is NOT disabled → fix-or-disable.
    const unresolvedBlocked = templates.filter((s) => s.state === SCOPE_STATES.blocked &&
        s.scope.templateId !== undefined &&
        availability.get(s.scope.templateId) !== false);
    if (unresolvedBlocked.length > 0) {
        return {
            outcome: PREFLIGHT_OUTCOMES.fixOrDisable,
            scopes,
            consentRequiredRequirementIds: [],
            fixOrDisableRequirementIds: unresolvedBlocked.flatMap((s) => s.fatal.map((v) => v.requirementId)),
            fatalRequirementIds: [],
        };
    }
    // 3. An optional requirement unmet and NOT consented → consent required.
    // Finding J (2026-10-01, ADR-12): a warning is covered only by a consent
    // whose KEY matches it (scope + bound blueprint content hash +
    // requirementId) — see {@link consentCovers}.
    const unconsented = scopes.flatMap((s) => s.warnings
        .filter((w) => !consents.some((c) => consentCovers(c, w.requirementId, scopeKey(s.scope), currentHash)))
        .map((w) => w.requirementId));
    if (unconsented.length > 0) {
        return {
            outcome: PREFLIGHT_OUTCOMES.consentRequired,
            scopes,
            consentRequiredRequirementIds: unconsented,
            fixOrDisableRequirementIds: [],
            fatalRequirementIds: [],
        };
    }
    // 4. All clear (or resolved via disable / consent) → proceed.
    return {
        outcome: PREFLIGHT_OUTCOMES.proceed,
        scopes,
        consentRequiredRequirementIds: [],
        fixOrDisableRequirementIds: [],
        fatalRequirementIds: [],
    };
}
/**
 * The scopes a `fixOrDisable` outcome leaves for the human to act on (the
 * non-disabled blocked templates).
 */
export function fixOrDisableTargets(result) {
    if (result.outcome !== PREFLIGHT_OUTCOMES.fixOrDisable)
        return [];
    return result.scopes.filter((s) => s.state === SCOPE_STATES.blocked).map((s) => s.scope);
}
//# sourceMappingURL=startup-preflight.js.map