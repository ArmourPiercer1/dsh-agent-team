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
import { type ActionImpact, type DegradationConsent, type GateDecision, type RecoveryState, type RequirementScope, type RequirementVerdict, type ScopeVerdict, type TemplateAvailability } from './types.js';
/**
 * The input to one evaluation: the per-scope requirement verdicts (keyed by
 * {@link scopeKey}) + the durable degradation consents + the durable template
 * availability. The verdicts are the projection of the compatibility engine's
 * `RequirementResult[]` (see the module README / the runtime wiring).
 */
export interface EvaluationInput {
    /** Per-scope requirement verdicts, keyed by scope key (e.g. `team`, `template:x`). */
    readonly scopeVerdicts: Readonly<Record<string, readonly RequirementVerdict[]>>;
    /** The durable degradation consents (optional-unmet coverage). */
    readonly consents?: readonly DegradationConsent[];
    /** The durable template availability (disable/enable). */
    readonly availability?: readonly TemplateAvailability[];
}
/** Classify one scope's verdicts into its closed scope state. */
export declare function classifyScope(scope: RequirementScope, verdicts: readonly RequirementVerdict[]): ScopeVerdict;
/** Classify every scope in the input into a {@link ScopeVerdict}. */
export declare function evaluateScopes(input: EvaluationInput): readonly ScopeVerdict[];
/**
 * Parse a scope key back into a {@link RequirementScope}.
 * @throws {@link RequirementError} `MALFORMED_SCOPE` when the key is malformed.
 */
export declare function parseScopeKey(key: string): RequirementScope;
/**
 * Derive the recovery state from the scope verdicts (plan §E.8/§E.10). The
 * state is DERIVED, never stored: `open` iff at least one scope is blocked.
 */
export declare function deriveRecovery(scopeVerdicts: readonly ScopeVerdict[]): RecoveryState;
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
export declare function gateAction(impact: ActionImpact, input: EvaluationInput): GateDecision;
//# sourceMappingURL=evaluator.d.ts.map