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
} as const

/** A requirement-declaration level. */
export type RequirementLevel = (typeof REQUIREMENT_LEVELS)[keyof typeof REQUIREMENT_LEVELS]

/** Every level value, for closed-set membership tests. */
export const REQUIREMENT_LEVEL_VALUES: readonly string[] = Object.values(REQUIREMENT_LEVELS)

/**
 * A requirement scope: the Team, or one named template. A Team scope key
 * omits `templateId`; a template scope key carries it.
 */
export interface RequirementScope {
  readonly level: RequirementLevel
  /** Present (and non-empty) only when `level === 'template'`. */
  readonly templateId?: string
}

/** Build a Team scope key. */
export function teamScope(): RequirementScope {
  return { level: REQUIREMENT_LEVELS.team }
}

/** Build a template scope key. */
export function templateScope(templateId: string): RequirementScope {
  if (templateId.length === 0) throw new Error('templateScope: templateId must be non-empty')
  return { level: REQUIREMENT_LEVELS.template, templateId }
}

/** The stable string identity of a scope (used as a map key / in facts). */
export function scopeKey(scope: RequirementScope): string {
  return scope.level === REQUIREMENT_LEVELS.team ? 'team' : `template:${scope.templateId}`
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
} as const

/** A closed per-requirement outcome. */
export type RequirementOutcome = (typeof REQUIREMENT_OUTCOMES)[keyof typeof REQUIREMENT_OUTCOMES]

/** Every outcome value, for closed-set membership tests. */
export const REQUIREMENT_OUTCOME_VALUES: readonly string[] = Object.values(REQUIREMENT_OUTCOMES)

/** Guard: is `value` a closed requirement outcome? */
export function isRequirementOutcome(value: unknown): value is RequirementOutcome {
  return typeof value === 'string' && (REQUIREMENT_OUTCOME_VALUES as readonly string[]).includes(value)
}

/**
 * One requirement's classified outcome as the authority consumes it. This is
 * the PROJECTION of the compatibility engine's `RequirementResult` onto the
 * fields the recovery model reads (the engine still owns the classification;
 * the authority never re-derives PASS/WARNING/FATAL).
 */
export interface RequirementVerdict {
  /** The requirement's stable identity (the engine's binding key). */
  readonly requirementId: string
  /** Whether the requirement carried `complete:true` (structural / required). */
  readonly complete: boolean
  /** The classified outcome (PASS / WARNING / FATAL). */
  readonly outcome: RequirementOutcome
  /** The subjects that were unavailable (empty for PASS). */
  readonly unavailableSubjects: readonly string[]
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
} as const

/** A closed scope-level requirement state. */
export type ScopeState = (typeof SCOPE_STATES)[keyof typeof SCOPE_STATES]

/** Every scope-state value, for closed-set membership tests. */
export const SCOPE_STATE_VALUES: readonly string[] = Object.values(SCOPE_STATES)

/** Guard: is `value` a closed scope state? */
export function isScopeState(value: unknown): value is ScopeState {
  return typeof value === 'string' && (SCOPE_STATE_VALUES as readonly string[]).includes(value)
}

/** The aggregate requirement state of one scope. */
export interface ScopeVerdict {
  /** The scope this verdict is about. */
  readonly scope: RequirementScope
  /** The closed scope state (ready / degraded / blocked). */
  readonly state: ScopeState
  /** The FATAL (required) verdicts in the scope (empty unless blocked). */
  readonly fatal: readonly RequirementVerdict[]
  /** The WARNING (optional-unmet) verdicts in the scope (empty unless degraded or blocked-with-optional). */
  readonly warnings: readonly RequirementVerdict[]
  /** The count of PASS verdicts in the scope. */
  readonly passCount: number
}

// ---------------------------------------------------------------------------
// degradation consent (durable; NOT a governance allow)
// ---------------------------------------------------------------------------

/**
 * A durable human consent to run DEGRADED with one OPTIONAL requirement
 * unmet (plan §E.6 "optional missing → Human consent"). Persisted so it
 * SURVIVES restart (authority negative #10), but it is orthogonal to the
 * governance policy: a consented optional requirement still does not ALLOW a
 * denied/ask operation (authority negative #8: consent ≠ governance allow).
 *
 * Finding J (2026-10-01, ADR-12) — the consent KEY is the immutable
 * (scope, blueprint content hash, requirementId) triple: a consent binds to
 * the EXACT scope + blueprint content hash it was granted for. A different
 * scope or a different hash means NOT consented (no blanket approve). The
 * key fields are ADDITIVE: a legacy row written before the keying carries
 * neither, and a keyed evaluation treats such a row as NOT consented
 * (fail-closed — it must be re-granted).
 */
export interface DegradationConsent {
  /** The OPTIONAL requirementId the consent covers (complete must be false). */
  readonly requirementId: string
  /** The environment generation the consent was given against (drift detection). */
  readonly generation: number
  /** The epoch-ms the human consented (deterministic ordering, no wall-clock in facts). */
  readonly consentedAt: number
  /** The human principal who consented (opaque). */
  readonly consentedBy: string
  /**
   * The scope identity the consent was granted for (the {@link scopeKey} —
   * `team` or `template:<id>`). ABSENT on legacy rows (pre-keying) — a keyed
   * evaluation never treats a legacy row as consented (fail-closed).
   */
  readonly scopeKey?: string
  /**
   * The bound blueprint's content hash the consent was granted against
   * (ADR-12: the consent is durable per Team + immutable Blueprint
   * contentHash + requirement scope). ABSENT on legacy rows — same
   * fail-closed semantics as {@link scopeKey}.
   */
  readonly contentHash?: string
}

// ---------------------------------------------------------------------------
// template availability (durable; disable ≠ policy deny)
// ---------------------------------------------------------------------------

/**
 * The durable availability of one template (plan §E.6: a required template
 * that is down → "fix + recheck OR disable template"). `available: false`
 * means the template is DISABLED (its required work cannot start, but its
 * policy is UNCHANGED — authority negative #9: disable ≠ policy deny).
 * Persisted so it SURVIVES restart (authority negative #10).
 */
export interface TemplateAvailability {
  readonly templateId: string
  /** `false` = the template is disabled (excluded from normal work start). */
  readonly available: boolean
}

// ---------------------------------------------------------------------------
// recovery state (DERIVED — never persisted as a flag)
// ---------------------------------------------------------------------------

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
  readonly open: boolean
  /** The blocked scopes (those with an unmet required requirement). */
  readonly blockedScopes: readonly RequirementScope[]
  /** The requirementIds that are FATAL in the blocked scopes. */
  readonly fatalRequirementIds: readonly string[]
  /** A deterministic, human-readable explanation (no timestamps). */
  readonly reason: string
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
  /**
   * pre-alpha3 W3-D (review fix F9, guide §8): a CROSS-AGENT EXECUTION
   * TRIGGER — an action whose effect is to deliver input to another agent
   * (wake it / hand it work). Classified by EFFECT, not tool name:
   * `team_send_message` triggers the recipient's execution, so the gate
   * consults every scope the TRIGGERING action was evaluated against and
   * blocks if ANY is down (the trigger would deliver work a downed scope
   * cannot serve). In a recovery context a trigger that wakes a recipient
   * escalates to synchronous Human Review (guide §8, recovery case).
   */
  crossAgentTrigger: 'crossAgentTrigger',
} as const

/** A closed action-impact class. */
export type ActionImpactClass = (typeof ACTION_IMPACT_CLASSES)[keyof typeof ACTION_IMPACT_CLASSES]

/** Every impact-class value, for closed-set membership tests. */
export const ACTION_IMPACT_CLASS_VALUES: readonly string[] = Object.values(ACTION_IMPACT_CLASSES)

/** Guard: is `value` a closed action-impact class? */
export function isActionImpactClass(value: unknown): value is ActionImpactClass {
  return typeof value === 'string' && (ACTION_IMPACT_CLASS_VALUES as readonly string[]).includes(value)
}

/**
 * The requirement-impact metadata of one action (plan §E.7). This is what
 * the gate consumes — the IMPACT class + the scopes the action depends on.
 * It is deliberately NOT the `ActionCategory`: two actions in the same
 * category can have different requirement impacts (e.g. `delegate` to an
 * affected member vs. `follow-up` on a healthy one).
 */
export interface ActionImpact {
  /** The closed impact class. */
  readonly impact: ActionImpactClass
  /**
   * The scopes the action's WORK depends on (the Team scope for team-level
   * work; the target template scope for per-member work). Empty for pure
   * coordination / diagnostic actions that touch no requirement.
   */
  readonly scopeRefs: readonly RequirementScope[]
}

/**
 * The outcome of gating one action against the current scope verdicts
 * (plan §E.7/§E.8).
 */
export interface GateDecision {
  /** Whether the action may proceed. */
  readonly allowed: boolean
  /** The closed gate reason (for the typed response / telemetry). */
  readonly reason: GateReason
  /** Present when the action is blocked: the blocked scopes it depends on. */
  readonly blockedScopes?: readonly RequirementScope[]
  /**
   * Present when the action is allowed AS RECOVERY WORK: the blocked scopes
   * the recovery work is repairing (so the caller runs it on the REDUCED
   * original authority, §E.9).
   */
  readonly recoveryScopes?: readonly RequirementScope[]
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
} as const

/** A closed gate reason. */
export type GateReason = (typeof GATE_REASONS)[keyof typeof GATE_REASONS]

/** Every gate-reason value, for closed-set membership tests. */
export const GATE_REASON_VALUES: readonly string[] = Object.values(GATE_REASONS)

/** Guard: is `value` a closed gate reason? */
export function isGateReason(value: unknown): value is GateReason {
  return typeof value === 'string' && (GATE_REASON_VALUES as readonly string[]).includes(value)
}

// ---------------------------------------------------------------------------
// startup preflight (§E.6)
// ---------------------------------------------------------------------------

/** The closed startup-preflight outcomes (plan §E.6; D-3 extends with
 *  `pending`, 2026-09-30 adjudicated). */
export const PREFLIGHT_OUTCOMES = {
  /** Every requirement is satisfied (or a template is disabled) — proceed. */
  proceed: 'proceed',
  /** An OPTIONAL requirement is unmet — the human must consent to run degraded. */
  consentRequired: 'consentRequired',
  /** A REQUIRED TEMPLATE requirement is unmet — the human must fix+recheck OR disable the template. */
  fixOrDisable: 'fixOrDisable',
  /** A TEAM-LEVEL required requirement is unmet — FATAL; it CANNOT be bypassed by disabling a template. */
  fatal: 'fatal',
  /**
   * D-3 (2026-09-30, adjudicated product semantics — fail-closed PENDING):
   * a REQUIRED applicable requirement whose LIVE observation is UNKNOWN
   * (materialization slot pending / not yet probed) — the creation is
   * blocked with the typed PENDING outcome (NEVER a seed-filled PASS).
   * Precedence (documented judgment): down-based outcomes (`fatal` /
   * `fixOrDisable` — a confirmed unreachable wins) > `pending` >
   * `consentRequired` > `proceed`. RECHECKABLE by construction: the block
   * is a verdict, not a write; it clears on the next boundary (the
   * re-driven creation re-evaluates on a fresh read) or via the manual
   * `compatibility.reprobe` seam.
   */
  pending: 'pending',
} as const

/** A closed startup-preflight outcome. */
export type PreflightOutcome = (typeof PREFLIGHT_OUTCOMES)[keyof typeof PREFLIGHT_OUTCOMES]

/** Every preflight-outcome value, for closed-set membership tests. */
export const PREFLIGHT_OUTCOME_VALUES: readonly string[] = Object.values(PREFLIGHT_OUTCOMES)

/**
 * The startup-preflight result (plan §E.6): the classification of ALL Team +
 * Leader + MemberTemplate requirements BEFORE the Team is created.
 */
export interface PreflightResult {
  /** The closed preflight outcome. */
  readonly outcome: PreflightOutcome
  /** The per-scope verdicts (all scopes, for the UI / command to render). */
  readonly scopes: readonly ScopeVerdict[]
  /** The OPTIONAL-unmet requirementIds needing consent (when outcome is consentRequired). */
  readonly consentRequiredRequirementIds: readonly string[]
  /** The REQUIRED-unmet TEMPLATE requirementIds needing fix-or-disable (when outcome is fixOrDisable). */
  readonly fixOrDisableRequirementIds: readonly string[]
  /** The TEAM-level required-unmet requirementIds (when outcome is fatal). */
  readonly fatalRequirementIds: readonly string[]
  /**
   * D-3 (2026-09-30) — the REQUIRED live-UNKNOWN (pending) requirementIds
   * (when outcome is `pending`). ABSENT in pre-D-3 results (the legacy
   * classifier never produces `pending`).
   */
  readonly pendingRequirementIds?: readonly string[]
}

/**
 * D-3 (2026-09-30, adjudicated product semantics — fail-closed PENDING) —
 * the closed typed-code family of the PENDING outcome (documented
 * judgment on the adjudicated contract "reuse the existing closed
 * typed-code family"):
 *
 * - the WIRE error code stays `COMPATIBILITY_BLOCKED` (the frozen router
 *   vocabulary — the dispatcher's closed backing set passes it through
 *   unchanged, invariant 4b);
 * - the engine's §28 logical admission states (OPEN / BLOCKED_WARNING /
 *   BLOCKED_FATAL / DEGRADED_ACKNOWLEDGED) are UNTOUCHED — PENDING is a
 *   DECISION-level category, not an engine verdict (Architecture §28.2:
 *   gate enforcement belongs to the runtime);
 * - the evaluator's {@link GATE_REASONS} set is UNTOUCHED — `gateAction`
 *   never returns PENDING; the rule is a decision-level overlay applied
 *   AFTER the 2-state decision (it voids an otherwise-allowed passage,
 *   and reclassifies a no-seed unknown FATAL);
 * - the new category therefore rides the typed details: `status` +
 *   `gateReason` below (+ the `recheck` hint — the block is RECHECKABLE
 *   by construction: it is a verdict, not a write; it clears on the next
 *   boundary or via the manual `compatibility.reprobe` seam — a stuck
 *   slot is honest, not a deadlock).
 *
 * Plan citations: §C.3 "否则 unresolved fail closed；禁止 false OPEN" +
 * E.3 "no false OPEN" + E.11 negative #10 "readiness 重置 unknown"
 * (unknown is first-class) + C.5 (pending is a real materialization
 * state). The static seed remains bootstrap/display only — never a
 * verdict (guide §2.5).
 */
export const PENDING_BLOCK = {
  /** The typed details `status` (mirrors the FATAL path's `BLOCKED_FATAL`). */
  status: 'BLOCKED_PENDING',
  /** The typed details `gateReason`. */
  gateReason: 'requiredScopePending',
  /** The typed details `recheck` hint (recheckable by construction). */
  recheck: 'next-boundary-or-compatibility.reprobe',
} as const
