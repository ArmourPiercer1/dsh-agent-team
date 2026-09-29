/**
 * pre-alpha3 PR-E (plan §E.4) — the RequirementAuthority type surface: the
 * product-semantics switch from the old compatibility model to the new
 * requirement / recovery model.
 *
 * This module is the DURABLE + DERIVED vocabulary the runtime enforces:
 *
 * - **scope** — WHERE a requirement is declared (the §E.2 levels): the Team
 *   itself, or one template (the Leader or one MemberTemplate). A requirement
 *   is bound to exactly one scope; its unmet-ness blocks exactly that scope's
 *   work (and, for the Team scope, all work).
 * - **requirement verdict** — the per-requirement outcome the compatibility
 *   engine already classifies (PASS / WARNING / FATAL); the authority READS
 *   the outcome and re-interprets it in the recovery model.
 * - **degradation consent** — the durable human consent to run DEGRADED with
 *   an OPTIONAL requirement unmet (it is NOT a governance allow — see
 *   authority negative #8).
 * - **template availability** — the durable template disable/enable state
 *   (disable is NOT a policy deny — see authority negative #9).
 * - **recovery state** — DERIVED (never persisted as a flag): which scopes are
 *   in recovery and why (the §E.10 exit is a fresh evaluation PASS, not a
 *   stored "recovered" bit).
 * - **action impact** — the §E.7 closed impact class + the scopes an action
 *   depends on, so gating keys on IMPACT, never on the coarse
 *   `ActionCategory` alone.
 *
 * Pure vocabulary: no I/O, no `node:` builtins.
 * @module @dsh-agent-team/runtime/requirements/types
 */
// ---------------------------------------------------------------------------
// scope: where a requirement is declared (§E.2 levels)
// ---------------------------------------------------------------------------
/** The closed requirement-declaration levels (plan §E.2). */
export const REQUIREMENT_LEVELS = {
    /** The Team itself (the TeamDomain): a Team-level requirement. */
    team: 'team',
    /** One template (the Leader or one MemberTemplate): a template-level requirement. */
    template: 'template',
};
/** Every level value, for closed-set membership tests. */
export const REQUIREMENT_LEVEL_VALUES = Object.values(REQUIREMENT_LEVELS);
/** Build a Team scope key. */
export function teamScope() {
    return { level: REQUIREMENT_LEVELS.team };
}
/** Build a template scope key. */
export function templateScope(templateId) {
    if (templateId.length === 0)
        throw new Error('templateScope: templateId must be non-empty');
    return { level: REQUIREMENT_LEVELS.template, templateId };
}
/** The stable string identity of a scope (used as a map key / in facts). */
export function scopeKey(scope) {
    return scope.level === REQUIREMENT_LEVELS.team ? 'team' : `template:${scope.templateId}`;
}
// ---------------------------------------------------------------------------
// per-requirement verdict (read from the compatibility engine's outcome)
// ---------------------------------------------------------------------------
/**
 * The closed per-requirement outcomes (Architecture §27.2). Re-declared here
 * (not imported) so the authority's vocabulary is self-contained and the
 * mapping from the engine's `RequirementResult` is explicit at the boundary.
 */
export const REQUIREMENT_OUTCOMES = {
    /** All required subjects available. */
    pass: 'pass',
    /** An optional requirement is unmet — WARNING (ack-able / consent-able). */
    warning: 'warning',
    /** A required (complete) or structural requirement is unmet — FATAL, no downgrade. */
    fatal: 'fatal',
};
/** Every outcome value, for closed-set membership tests. */
export const REQUIREMENT_OUTCOME_VALUES = Object.values(REQUIREMENT_OUTCOMES);
/** Guard: is `value` a closed requirement outcome? */
export function isRequirementOutcome(value) {
    return typeof value === 'string' && REQUIREMENT_OUTCOME_VALUES.includes(value);
}
// ---------------------------------------------------------------------------
// scope verdict: the aggregate state of one scope
// ---------------------------------------------------------------------------
/** The closed scope-level requirement states (the recovery model's core). */
export const SCOPE_STATES = {
    /** Every requirement in the scope is satisfied. */
    ready: 'ready',
    /** Only OPTIONAL requirements are unmet (warnings) — degraded, recoverable by consent. */
    degraded: 'degraded',
    /** A REQUIRED (complete / structural) requirement is unmet — the scope's normal work is blocked; recovery is allowed. */
    blocked: 'blocked',
};
/** Every scope-state value, for closed-set membership tests. */
export const SCOPE_STATE_VALUES = Object.values(SCOPE_STATES);
/** Guard: is `value` a closed scope state? */
export function isScopeState(value) {
    return typeof value === 'string' && SCOPE_STATE_VALUES.includes(value);
}
// ---------------------------------------------------------------------------
// action impact (§E.7)
// ---------------------------------------------------------------------------
/**
 * The closed action-impact classes (plan §E.7). Gating keys on this class
 * (never on the coarse `ActionCategory` alone):
 *
 * - `normalWork` — ordinary member work (a model turn, follow-up, or the
 *   delegated task body). BLOCKED when a required scope it depends on is down.
 * - `recoveryWork` — work performed to RESTORE a downed requirement
 *   (diagnose/repair the service). ALLOWED even when the scope is down
 *   (on the reduced original authority).
 * - `control` — a Control-plane request (request/resolve control). ALLOWED.
 * - `diagnostic` — pure read/diagnostic (inspect config, work status). ALLOWED.
 * - `lifecycle` — create-member / archive / restore / dispose. ALLOWED (the
 *   lifecycle seam is structural, not requirement-gated).
 * - `coordination` — pure coordination (list, follow-up message, progress). ALLOWED.
 */
export const ACTION_IMPACT_CLASSES = {
    normalWork: 'normalWork',
    recoveryWork: 'recoveryWork',
    control: 'control',
    diagnostic: 'diagnostic',
    lifecycle: 'lifecycle',
    coordination: 'coordination',
};
/** Every impact-class value, for closed-set membership tests. */
export const ACTION_IMPACT_CLASS_VALUES = Object.values(ACTION_IMPACT_CLASSES);
/** Guard: is `value` a closed action-impact class? */
export function isActionImpactClass(value) {
    return typeof value === 'string' && ACTION_IMPACT_CLASS_VALUES.includes(value);
}
// ---------------------------------------------------------------------------
// gate reason (closed)
// ---------------------------------------------------------------------------
/** The closed gate-reason vocabulary. */
export const GATE_REASONS = {
    /** The action may proceed (no relevant requirement is down). */
    allowed: 'allowed',
    /** A required scope the action depends on is down; normal work is blocked. */
    requiredScopeDown: 'requiredScopeDown',
    /** A required scope is down but the action is recovery work — allowed on reduced authority. */
    recoveryAllowed: 'recoveryAllowed',
    /** The action is control / diagnostic / lifecycle / coordination — always allowed. */
    alwaysAllowed: 'alwaysAllowed',
    /** The template the action targets is disabled (availability, not policy). */
    templateDisabled: 'templateDisabled',
};
/** Every gate-reason value, for closed-set membership tests. */
export const GATE_REASON_VALUES = Object.values(GATE_REASONS);
/** Guard: is `value` a closed gate reason? */
export function isGateReason(value) {
    return typeof value === 'string' && GATE_REASON_VALUES.includes(value);
}
// ---------------------------------------------------------------------------
// startup preflight (§E.6)
// ---------------------------------------------------------------------------
/** The closed startup-preflight outcomes (plan §E.6). */
export const PREFLIGHT_OUTCOMES = {
    /** Every requirement is satisfied (or a template is disabled) — proceed. */
    proceed: 'proceed',
    /** An OPTIONAL requirement is unmet — the human must consent to run degraded. */
    consentRequired: 'consentRequired',
    /** A REQUIRED TEMPLATE requirement is unmet — the human must fix+recheck OR disable the template. */
    fixOrDisable: 'fixOrDisable',
    /** A TEAM-LEVEL required requirement is unmet — FATAL; it CANNOT be bypassed by disabling a template. */
    fatal: 'fatal',
};
/** Every preflight-outcome value, for closed-set membership tests. */
export const PREFLIGHT_OUTCOME_VALUES = Object.values(PREFLIGHT_OUTCOMES);
//# sourceMappingURL=types.js.map