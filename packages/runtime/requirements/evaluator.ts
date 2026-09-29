/**
 * pre-alpha3 PR-E (plan §E.4/§E.7/§E.8) — the RequirementAuthority
 * evaluator: the product-semantics switch from the old compatibility model
 * to the new requirement / recovery model.
 *
 * The evaluator READS the compatibility engine's per-requirement outcomes
 * (it never re-derives PASS/WARNING/FATAL — the engine owns the
 * classification, §27.2) and re-interprets them in the recovery model:
 *
 * - **scope state** (plan §E.8): a scope is `blocked` when a REQUIRED
 *   (complete / structural) requirement is unmet (a FATAL outcome);
 *   `degraded` when only OPTIONAL requirements are unmet (WARNINGs);
 *   `ready` otherwise.
 * - **recovery** (plan §E.8/§E.9/§E.10): DERIVED from the blocked scopes
 *   (never a stored flag): `open` iff at least one scope is blocked.
 * - **action gating** (plan §E.7/§E.8): keys on the action's IMPACT class +
 *   the scopes its work depends on, NEVER on the coarse `ActionCategory`:
 *   - normal work is BLOCKED when a required scope it depends on is down;
 *   - recovery work is ALLOWED (on the reduced original authority) when a
 *     required scope is down;
 *   - control / diagnostic / lifecycle / coordination are ALWAYS allowed;
 *   - an OPTIONAL-unmet (degraded) scope does NOT block normal work
 *     (auto-degraded, §E.8).
 *
 * Pure module: no I/O, no `node:` builtins.
 * @module @dsh-agent-team/runtime/requirements/evaluator
 */

import {
  ACTION_IMPACT_CLASSES,
  GATE_REASONS,
  SCOPE_STATES,
  teamScope,
  type ActionImpact,
  type DegradationConsent,
  type GateDecision,
  type RecoveryState,
  type RequirementScope,
  type RequirementVerdict,
  type ScopeVerdict,
  type TemplateAvailability,
} from './types.js'
import { REQUIREMENT_ERROR_CODES, RequirementError } from './errors.js'
import { scopeKey } from './types.js'

/**
 * The input to one evaluation: the per-scope requirement verdicts (keyed by
 * {@link scopeKey}) + the durable degradation consents + the durable template
 * availability. The verdicts are the projection of the compatibility engine's
 * `RequirementResult[]` (see the module README / the runtime wiring).
 */
export interface EvaluationInput {
  /** Per-scope requirement verdicts, keyed by scope key (e.g. `team`, `template:x`). */
  readonly scopeVerdicts: Readonly<Record<string, readonly RequirementVerdict[]>>
  /** The durable degradation consents (optional-unmet coverage). */
  readonly consents?: readonly DegradationConsent[]
  /** The durable template availability (disable/enable). */
  readonly availability?: readonly TemplateAvailability[]
}

/** Classify one scope's verdicts into its closed scope state. */
export function classifyScope(scope: RequirementScope, verdicts: readonly RequirementVerdict[]): ScopeVerdict {
  const fatal = verdicts.filter((v) => v.outcome === 'fatal')
  const warnings = verdicts.filter((v) => v.outcome === 'warning')
  const passCount = verdicts.filter((v) => v.outcome === 'pass').length
  const state =
    fatal.length > 0 ? SCOPE_STATES.blocked : warnings.length > 0 ? SCOPE_STATES.degraded : SCOPE_STATES.ready
  return {
    scope,
    state,
    fatal,
    warnings,
    passCount,
  }
}

/** Classify every scope in the input into a {@link ScopeVerdict}. */
export function evaluateScopes(input: EvaluationInput): readonly ScopeVerdict[] {
  return Object.entries(input.scopeVerdicts).map(([key, verdicts]) => {
    const scope = parseScopeKey(key)
    return classifyScope(scope, verdicts)
  })
}

/**
 * Parse a scope key back into a {@link RequirementScope}.
 * @throws {@link RequirementError} `MALFORMED_SCOPE` when the key is malformed.
 */
export function parseScopeKey(key: string): RequirementScope {
  if (key === 'team') return teamScope()
  if (key.startsWith('template:')) {
    const templateId = key.slice('template:'.length)
    if (templateId.length === 0) {
      throw new RequirementError(
        REQUIREMENT_ERROR_CODES.MALFORMED_SCOPE,
        `malformed scope key '${key}' (empty templateId)`,
        { key },
      )
    }
    return { level: 'template', templateId }
  }
  throw new RequirementError(
    REQUIREMENT_ERROR_CODES.MALFORMED_SCOPE,
    `malformed scope key '${key}' (expected 'team' or 'template:<id>')`,
    { key },
  )
}

/**
 * Derive the recovery state from the scope verdicts (plan §E.8/§E.10). The
 * state is DERIVED, never stored: `open` iff at least one scope is blocked.
 */
export function deriveRecovery(scopeVerdicts: readonly ScopeVerdict[]): RecoveryState {
  const blocked = scopeVerdicts.filter((s) => s.state === SCOPE_STATES.blocked)
  const blockedScopes = blocked.map((s) => s.scope)
  const fatalRequirementIds = blocked.flatMap((s) => s.fatal.map((v) => v.requirementId))
  const open = blockedScopes.length > 0
  const reason = open
    ? `recovery open: ${blockedScopes.map((s) => scopeKey(s)).join(', ')} blocked by ${fatalRequirementIds.join(', ')}`
    : 'no required requirement is down (recovery not open)'
  return { open, blockedScopes, fatalRequirementIds, reason }
}

/**
 * Gate one action against the current scope verdicts (plan §E.7/§E.8).
 *
 * The decision keys on the action's IMPACT class + the scopes its work
 * depends on (never on the coarse `ActionCategory`):
 *
 * - `control` / `diagnostic` / `lifecycle` / `coordination` → always allowed
 *   (these are structural / read / control, not requirement-gated work);
 * - `normalWork` → blocked when ANY required scope it depends on is down
 *   (the Team scope for team-level work, the target template for per-member
 *   work); a `degraded` (optional-unmet) scope does NOT block normal work
 *   (§E.8 auto-degraded);
 * - `recoveryWork` → allowed (on the reduced original authority) when a
 *   required scope it depends on is down; allowed normally otherwise.
 *
 * A template that is DISABLED (availability `available:false`) blocks the
 * normal work that needs it — but as an AVAILABILITY block, never a policy
 * denial (authority negative #9: template disable ≠ policy deny).
 *
 * @param impact - the action's requirement-impact metadata.
 * @param input - the current evaluation (scope verdicts + availability).
 * @returns the closed {@link GateDecision}.
 */
export function gateAction(impact: ActionImpact, input: EvaluationInput): GateDecision {
  const verdictsByScope = new Map<string, ScopeVerdict>()
  for (const [key, verdicts] of Object.entries(input.scopeVerdicts)) {
    verdictsByScope.set(key, classifyScope(parseScopeKey(key), verdicts))
  }

  // The scopes the action's work depends on (deduped by scope key).
  const refKeys = new Set<string>()
  for (const scope of impact.scopeRefs) refKeys.add(scopeKey(scope))
  const refs = [...refKeys].map((k) => verdictsByScope.get(k))

  const blockedRefs = refs.filter((v) => v !== undefined && v.state === SCOPE_STATES.blocked)
  const disabledRefs = refs.filter((v) => {
    if (v === undefined || v.scope.level !== 'template' || v.scope.templateId === undefined) return false
    const entry = (input.availability ?? []).find((a) => a.templateId === v.scope.templateId)
    return entry !== undefined && entry.available === false
  })

  // The impact class decides the gate.
  switch (impact.impact) {
    case ACTION_IMPACT_CLASSES.control:
    case ACTION_IMPACT_CLASSES.diagnostic:
    case ACTION_IMPACT_CLASSES.lifecycle:
    case ACTION_IMPACT_CLASSES.coordination:
      return { allowed: true, reason: GATE_REASONS.alwaysAllowed }

    case ACTION_IMPACT_CLASSES.normalWork:
      // A disabled target template blocks its normal work (availability, not policy).
      if (disabledRefs.length > 0) {
        return {
          allowed: false,
          reason: GATE_REASONS.templateDisabled,
          blockedScopes: disabledRefs.map((v) => v!.scope),
        }
      }
      if (blockedRefs.length > 0) {
        return {
          allowed: false,
          reason: GATE_REASONS.requiredScopeDown,
          blockedScopes: blockedRefs.map((v) => v!.scope),
        }
      }
      return { allowed: true, reason: GATE_REASONS.allowed }

    case ACTION_IMPACT_CLASSES.recoveryWork:
      if (blockedRefs.length > 0) {
        return {
          allowed: true,
          reason: GATE_REASONS.recoveryAllowed,
          recoveryScopes: blockedRefs.map((v) => v!.scope),
        }
      }
      return { allowed: true, reason: GATE_REASONS.allowed }

    case ACTION_IMPACT_CLASSES.crossAgentTrigger:
      // pre-alpha3 W3-D (review fix F9, guide §8): the cross-agent execution
      // trigger blocks if ANY evaluated scope is down (the trigger would
      // deliver work a downed scope cannot serve) — the blocked scopes are
      // ALL of them (the recipient's scope, the team scope, ...). A
      // downed/disabled template is NOT the trigger's concern (the recipient
      // is an instance, not a template); only the blocked (required-down)
      // scopes gate the trigger. In a recovery context the router re-runs
      // the trigger as recovery work (the existing `recovery` marker) and
      // escalates the wake to synchronous Human Review.
      if (blockedRefs.length > 0) {
        return {
          allowed: false,
          reason: GATE_REASONS.requiredScopeDown,
          blockedScopes: blockedRefs.map((v) => v!.scope),
        }
      }
      return { allowed: true, reason: GATE_REASONS.allowed }

    default:
      // Exhaustiveness guard (the closed impact class set).
      throw new RequirementError(
        REQUIREMENT_ERROR_CODES.UNKNOWN_ACTION,
        `unhandled action-impact class '${(impact.impact as string)}'`,
        { impact: impact.impact },
      )
  }
}
