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
/** The closed requirement-declaration levels (plan §E.2). */
export declare const REQUIREMENT_LEVELS: {
    /** The Team itself (the TeamDomain): a Team-level requirement. */
    readonly team: "team";
    /** One template (the Leader or one MemberTemplate): a template-level requirement. */
    readonly template: "template";
};
/** A requirement-declaration level. */
export type RequirementLevel = (typeof REQUIREMENT_LEVELS)[keyof typeof REQUIREMENT_LEVELS];
/** Every level value, for closed-set membership tests. */
export declare const REQUIREMENT_LEVEL_VALUES: readonly string[];
/**
 * A requirement scope: the Team, or one named template. A Team scope key
 * omits `templateId`; a template scope key carries it.
 */
export interface RequirementScope {
    readonly level: RequirementLevel;
    /** Present (and non-empty) only when `level === 'template'`. */
    readonly templateId?: string;
}
/** Build a Team scope key. */
export declare function teamScope(): RequirementScope;
/** Build a template scope key. */
export declare function templateScope(templateId: string): RequirementScope;
/** The stable string identity of a scope (used as a map key / in facts). */
export declare function scopeKey(scope: RequirementScope): string;
/**
 * The closed per-requirement outcomes (Architecture §27.2). Re-declared here
 * (not imported) so the authority's vocabulary is self-contained and the
 * mapping from the engine's `RequirementResult` is explicit at the boundary.
 */
export declare const REQUIREMENT_OUTCOMES: {
    /** All required subjects available. */
    readonly pass: "pass";
    /** An optional requirement is unmet — WARNING (ack-able / consent-able). */
    readonly warning: "warning";
    /** A required (complete) or structural requirement is unmet — FATAL, no downgrade. */
    readonly fatal: "fatal";
};
/** A closed per-requirement outcome. */
export type RequirementOutcome = (typeof REQUIREMENT_OUTCOMES)[keyof typeof REQUIREMENT_OUTCOMES];
/** Every outcome value, for closed-set membership tests. */
export declare const REQUIREMENT_OUTCOME_VALUES: readonly string[];
/** Guard: is `value` a closed requirement outcome? */
export declare function isRequirementOutcome(value: unknown): value is RequirementOutcome;
/**
 * One requirement's classified outcome as the authority consumes it. This is
 * the PROJECTION of the compatibility engine's `RequirementResult` onto the
 * fields the recovery model reads (the engine still owns the classification;
 * the authority never re-derives PASS/WARNING/FATAL).
 */
export interface RequirementVerdict {
    /** The requirement's stable identity (the engine's binding key). */
    readonly requirementId: string;
    /** Whether the requirement carried `complete:true` (structural / required). */
    readonly complete: boolean;
    /** The classified outcome (PASS / WARNING / FATAL). */
    readonly outcome: RequirementOutcome;
    /** The subjects that were unavailable (empty for PASS). */
    readonly unavailableSubjects: readonly string[];
}
/** The closed scope-level requirement states (the recovery model's core). */
export declare const SCOPE_STATES: {
    /** Every requirement in the scope is satisfied. */
    readonly ready: "ready";
    /** Only OPTIONAL requirements are unmet (warnings) — degraded, recoverable by consent. */
    readonly degraded: "degraded";
    /** A REQUIRED (complete / structural) requirement is unmet — the scope's normal work is blocked; recovery is allowed. */
    readonly blocked: "blocked";
};
/** A closed scope-level requirement state. */
export type ScopeState = (typeof SCOPE_STATES)[keyof typeof SCOPE_STATES];
/** Every scope-state value, for closed-set membership tests. */
export declare const SCOPE_STATE_VALUES: readonly string[];
/** Guard: is `value` a closed scope state? */
export declare function isScopeState(value: unknown): value is ScopeState;
/** The aggregate requirement state of one scope. */
export interface ScopeVerdict {
    /** The scope this verdict is about. */
    readonly scope: RequirementScope;
    /** The closed scope state (ready / degraded / blocked). */
    readonly state: ScopeState;
    /** The FATAL (required) verdicts in the scope (empty unless blocked). */
    readonly fatal: readonly RequirementVerdict[];
    /** The WARNING (optional-unmet) verdicts in the scope (empty unless degraded or blocked-with-optional). */
    readonly warnings: readonly RequirementVerdict[];
    /** The count of PASS verdicts in the scope. */
    readonly passCount: number;
}
/**
 * A durable human consent to run DEGRADED with one OPTIONAL requirement
 * unmet (plan §E.6 "optional missing → Human consent"). Persisted so it
 * SURVIVES restart (authority negative #10), but it is orthogonal to the
 * governance policy: a consented optional requirement still does not ALLOW a
 * denied/ask operation (authority negative #8: consent ≠ governance allow).
 */
export interface DegradationConsent {
    /** The OPTIONAL requirementId the consent covers (complete must be false). */
    readonly requirementId: string;
    /** The environment generation the consent was given against (drift detection). */
    readonly generation: number;
    /** The epoch-ms the human consented (deterministic ordering, no wall-clock in facts). */
    readonly consentedAt: number;
    /** The human principal who consented (opaque). */
    readonly consentedBy: string;
}
/**
 * The durable availability of one template (plan §E.6: a required template
 * that is down → "fix + recheck OR disable template"). `available: false`
 * means the template is DISABLED (its required work cannot start, but its
 * policy is UNCHANGED — authority negative #9: disable ≠ policy deny).
 * Persisted so it SURVIVES restart (authority negative #10).
 */
export interface TemplateAvailability {
    readonly templateId: string;
    /** `false` = the template is disabled (excluded from normal work start). */
    readonly available: boolean;
}
/**
 * The DERIVED recovery state (plan §E.8/§E.9/§E.10). This is recomputed from
 * the current scope verdicts on every evaluation — it is NEVER stored as a
 * durable "recovery" flag (the §E.10 exit is a fresh evaluation PASS, and a
 * restart RESETS readiness to `unknown`). `open: true` iff at least one scope
 * is `blocked` (a required requirement is down) AND recovery work is
 * permitted to proceed.
 */
export interface RecoveryState {
    /** Whether recovery is active (at least one scope is blocked). */
    readonly open: boolean;
    /** The blocked scopes (those with an unmet required requirement). */
    readonly blockedScopes: readonly RequirementScope[];
    /** The requirementIds that are FATAL in the blocked scopes. */
    readonly fatalRequirementIds: readonly string[];
    /** A deterministic, human-readable explanation (no timestamps). */
    readonly reason: string;
}
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
export declare const ACTION_IMPACT_CLASSES: {
    readonly normalWork: "normalWork";
    readonly recoveryWork: "recoveryWork";
    readonly control: "control";
    readonly diagnostic: "diagnostic";
    readonly lifecycle: "lifecycle";
    readonly coordination: "coordination";
};
/** A closed action-impact class. */
export type ActionImpactClass = (typeof ACTION_IMPACT_CLASSES)[keyof typeof ACTION_IMPACT_CLASSES];
/** Every impact-class value, for closed-set membership tests. */
export declare const ACTION_IMPACT_CLASS_VALUES: readonly string[];
/** Guard: is `value` a closed action-impact class? */
export declare function isActionImpactClass(value: unknown): value is ActionImpactClass;
/**
 * The requirement-impact metadata of one action (plan §E.7). This is what
 * the gate consumes — the IMPACT class + the scopes the action depends on.
 * It is deliberately NOT the `ActionCategory`: two actions in the same
 * category can have different requirement impacts (e.g. `delegate` to an
 * affected member vs. `follow-up` on a healthy one).
 */
export interface ActionImpact {
    /** The closed impact class. */
    readonly impact: ActionImpactClass;
    /**
     * The scopes the action's WORK depends on (the Team scope for team-level
     * work; the target template scope for per-member work). Empty for pure
     * coordination / diagnostic actions that touch no requirement.
     */
    readonly scopeRefs: readonly RequirementScope[];
}
/**
 * The outcome of gating one action against the current scope verdicts
 * (plan §E.7/§E.8).
 */
export interface GateDecision {
    /** Whether the action may proceed. */
    readonly allowed: boolean;
    /** The closed gate reason (for the typed response / telemetry). */
    readonly reason: GateReason;
    /** Present when the action is blocked: the blocked scopes it depends on. */
    readonly blockedScopes?: readonly RequirementScope[];
    /**
     * Present when the action is allowed AS RECOVERY WORK: the blocked scopes
     * the recovery work is repairing (so the caller runs it on the REDUCED
     * original authority, §E.9).
     */
    readonly recoveryScopes?: readonly RequirementScope[];
}
/** The closed gate-reason vocabulary. */
export declare const GATE_REASONS: {
    /** The action may proceed (no relevant requirement is down). */
    readonly allowed: "allowed";
    /** A required scope the action depends on is down; normal work is blocked. */
    readonly requiredScopeDown: "requiredScopeDown";
    /** A required scope is down but the action is recovery work — allowed on reduced authority. */
    readonly recoveryAllowed: "recoveryAllowed";
    /** The action is control / diagnostic / lifecycle / coordination — always allowed. */
    readonly alwaysAllowed: "alwaysAllowed";
    /** The template the action targets is disabled (availability, not policy). */
    readonly templateDisabled: "templateDisabled";
};
/** A closed gate reason. */
export type GateReason = (typeof GATE_REASONS)[keyof typeof GATE_REASONS];
/** Every gate-reason value, for closed-set membership tests. */
export declare const GATE_REASON_VALUES: readonly string[];
/** Guard: is `value` a closed gate reason? */
export declare function isGateReason(value: unknown): value is GateReason;
/** The closed startup-preflight outcomes (plan §E.6). */
export declare const PREFLIGHT_OUTCOMES: {
    /** Every requirement is satisfied (or a template is disabled) — proceed. */
    readonly proceed: "proceed";
    /** An OPTIONAL requirement is unmet — the human must consent to run degraded. */
    readonly consentRequired: "consentRequired";
    /** A REQUIRED TEMPLATE requirement is unmet — the human must fix+recheck OR disable the template. */
    readonly fixOrDisable: "fixOrDisable";
    /** A TEAM-LEVEL required requirement is unmet — FATAL; it CANNOT be bypassed by disabling a template. */
    readonly fatal: "fatal";
};
/** A closed startup-preflight outcome. */
export type PreflightOutcome = (typeof PREFLIGHT_OUTCOMES)[keyof typeof PREFLIGHT_OUTCOMES];
/** Every preflight-outcome value, for closed-set membership tests. */
export declare const PREFLIGHT_OUTCOME_VALUES: readonly string[];
/**
 * The startup-preflight result (plan §E.6): the classification of ALL Team +
 * Leader + MemberTemplate requirements BEFORE the Team is created.
 */
export interface PreflightResult {
    /** The closed preflight outcome. */
    readonly outcome: PreflightOutcome;
    /** The per-scope verdicts (all scopes, for the UI / command to render). */
    readonly scopes: readonly ScopeVerdict[];
    /** The OPTIONAL-unmet requirementIds needing consent (when outcome is consentRequired). */
    readonly consentRequiredRequirementIds: readonly string[];
    /** The REQUIRED-unmet TEMPLATE requirementIds needing fix-or-disable (when outcome is fixOrDisable). */
    readonly fixOrDisableRequirementIds: readonly string[];
    /** The TEAM-level required-unmet requirementIds (when outcome is fatal). */
    readonly fatalRequirementIds: readonly string[];
}
//# sourceMappingURL=types.d.ts.map