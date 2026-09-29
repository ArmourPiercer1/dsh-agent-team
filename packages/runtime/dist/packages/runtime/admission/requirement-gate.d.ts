/**
 * pre-alpha3 PR-E (plan §E.4/§E.7/§E.8/§E.10) — the LIVE requirement gate:
 * the NEW WORK admission gate of the requirement/recovery model that
 * REPLACES the P6-T2 compatibility gate at the router's step 5 (the old
 * `enforceCompatibilityGate` is superseded — the `requirements/` module is
 * authoritative, not dormant).
 *
 * What changed versus the old gate (the product-semantics switch):
 *
 * - The gate evaluates EVERY scope the bound blueprint declares (the Team
 *   scope through the SAME single compatibility authority chain — fresh
 *   facts → fingerprint → freshness re-probe → durable state → ack
 *   validity — and each v2 template scope with a FRESH engine evaluation:
 *   template-scope readiness has no durable generation of its own and
 *   resets on restart, exactly like the derived recovery state);
 * - FATAL (a required requirement down) = a BLOCKED scope. Normal work
 *   that depends on it is BLOCKED — but recovery work (the
 *   human-reviewed dispatch, plan §E.9) is ALLOWED on the reduced original
 *   authority (the gate returns `recoveryAllowed` + the recovery scopes;
 *   the router performs the Control coupling);
 * - WARNING (an optional requirement down) = a DEGRADED scope. Normal
 *   work CONTINUES (auto-degraded — the old gate's
 *   `COMPATIBILITY_BLOCKED_WARNING` throw is gone; the durable consent
 *   records the human's acknowledgement but is not a gate precondition);
 * - a chain failure (facts-unavailable / reprobe-failed / no-state /
 *   state-mismatch) still fails CLOSED — invariant 50 is unchanged: a
 *   compatibility failure is never an admission;
 * - the closed error code stays `COMPATIBILITY_BLOCKED` (the frozen router
 *   vocabulary; the FATAL path's observable contract is preserved —
 *   `details.status: 'BLOCKED_FATAL'` + the blocking requirement ids),
 *   only the DECISION semantics moved (warning → auto-degraded) and the
 *   typed details gained the recovery-model fields.
 *
 * Durable requirement facts (the frozen `compatibility` ledger category):
 *
 * - `recovery-incident-opened` — written when the gate ALLOWS recovery work
 *   for a blocked scope that has no OPEN incident (open = an opened fact
 *   without a subsequent closed fact for the same scope);
 * - `recovery-incident-closed` — written when a scope with an OPEN
 *   incident is no longer blocked on the fresh evaluation (the plan §E.10
 *   exit record — the exit itself is the derived state flipping; NO
 *   durable recovery flag is ever written);
 * - `optional-requirement-accepted` / `template-availability-set` — READ
 *   here (they are written by the creation preflight, plan §E.6, and the
 *   compatibility-ack channel; both survive restart — authority negative
 *   #10).
 *
 * I/O only through the injected TeamDomain repositories + the
 * environment-facts port; no `node:` builtins, no upstream imports.
 * @module @dsh-agent-team/runtime/admission/requirement-gate
 */
import type { CompatibilityResult, EnvironmentFact } from '../../domain/compatibility/src/index.js';
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js';
import type { TeamDomainRepositories } from '../../storage/repositories/index.js';
import type { ActionImpact, DegradationConsent, GateDecision, RecoveryState, RequirementScope, RequirementVerdict, ScopeVerdict, TemplateAvailability } from '../requirements/types.js';
/** The outcome of one requirement-gate passage (allowed only — blocks throw). */
export interface RequirementGateOutcome {
    /** The closed gate reason (`allowed` / `recoveryAllowed` / `alwaysAllowed`). */
    readonly reason: GateDecision['reason'];
    /** Present when the action is allowed AS RECOVERY WORK: the blocked
     *   scopes the recovery work repairs (the caller runs it on the REDUCED
     *   original authority, plan §E.9). */
    readonly recoveryScopes?: readonly RequirementScope[];
    /** The fresh per-scope verdicts (deterministic; for the caller's typed
     *   response / telemetry). */
    readonly scopeVerdicts: readonly ScopeVerdict[];
    /** The DERIVED recovery state of the fresh evaluation (never stored as a
     *   flag — recomputed on every passage). */
    readonly recovery: RecoveryState;
}
/** The dependencies of one requirement-gate consultation (all injected). */
export interface RequirementGateOptions {
    /** The TeamDomain repositories (durable compat state + the requirement
     *   facts in the frozen `compatibility` ledger category). */
    readonly repositories: TeamDomainRepositories;
    /** The bound blueprint (immutable durable snapshot). */
    readonly blueprint: TeamBlueprint;
    /** The root session id (the team). */
    readonly rootSessionId: string;
    /** The environment-facts port (a FRESH read on every consultation — the
     *   authority's inline re-probe re-reads the same port, the same logical
     *   moment). */
    readonly environmentFacts: () => Promise<readonly EnvironmentFact[]>;
    /** The deterministic ISO-8601 clock (defaults to the authority clock). */
    readonly now?: () => string;
    /** The epoch-ms clock for the requirement fact payloads (defaults to
     *   `Date.now` — facts are provenance, never a token input). */
    readonly nowMs?: () => number;
}
/** One open recovery incident (derived from the durable fact history). */
export interface OpenIncident {
    readonly scopeKey: string;
    readonly requirementIds: readonly string[];
    readonly openedAt: number;
}
/**
 * Read the durable requirement facts of one team from the ledger (the
 * frozen `compatibility` category): the degradation consents, the template
 * availability set (latest wins per template), and the OPEN recovery
 * incidents (an opened fact without a subsequent closed fact for the same
 * scope — the append-only ledger has no delete primitive).
 *
 * A malformed durable row is a state anomaly — the read fails CLOSED (the
 * consumer must not admit on an unverifiable fact line).
 */
export declare function readRequirementFacts(repositories: TeamDomainRepositories, rootSessionId: string): {
    readonly consents: readonly DegradationConsent[];
    readonly availability: readonly TemplateAvailability[];
    readonly openIncidents: readonly OpenIncident[];
};
/**
 * Evaluate EVERY scope of the bound blueprint against ONE fresh environment
 * facts read (plan §E.4): the Team scope through the single compatibility
 * authority chain (durable, fresh, re-probed as needed) and each v2
 * template scope with a fresh engine evaluation (no durable generation —
 * template-scope readiness resets on restart).
 *
 * @throws {@link TeamRuntimeError} COMPATIBILITY_BLOCKED (fail-closed) when
 *   the facts port fails or the authority chain cannot produce a verdict.
 */
export declare function evaluateAllScopes(repositories: TeamDomainRepositories, blueprint: TeamBlueprint, rootSessionId: string, environmentFacts: () => Promise<readonly EnvironmentFact[]>, now?: () => string): Promise<{
    /** The raw per-scope requirement verdicts (keyed by scope key) — the
     *   `EvaluationInput.scopeVerdicts` shape. */
    readonly scopeVerdicts: Readonly<Record<string, readonly RequirementVerdict[]>>;
    /** The classified scope verdicts (ready / degraded / blocked). */
    readonly scopeStates: readonly ScopeVerdict[];
    readonly teamResult: CompatibilityResult;
    readonly facts: readonly EnvironmentFact[];
}>;
/**
 * Step 4a (PR-E) — the requirement gate for NEW WORK (invariant 50).
 *
 * Consumes the full scope evaluation (every declared scope, one fresh facts
 * read) + the durable requirement facts, gates the action on its
 * requirement IMPACT (never the coarse category alone), performs the
 * incident bookkeeping (open on the first allowed recovery passage; close
 * on the blocked→ready transition — the §E.10 exit record), and throws
 * `COMPATIBILITY_BLOCKED` (fail-closed) when the action is blocked.
 *
 * @param options - the injected repositories / blueprint / facts port.
 * @param impact - the action's requirement-impact metadata (the closed
 *   impact class + the scopes the action's work depends on).
 * @returns the allowed outcome (the recovery scopes when allowed AS
 *   recovery work).
 * @throws {@link TeamRuntimeError} COMPATIBILITY_BLOCKED (blocked /
 *   fail-closed).
 */
export declare function enforceRequirementGate(options: RequirementGateOptions, impact: ActionImpact): Promise<RequirementGateOutcome>;
/**
 * Build the requirement IMPACT of one named action for the gate (plan §E.7):
 * the closed impact class of the action (the static `ACTION_REQUIREMENT_IMPACT`
 * map) + the scopes the action's work depends on (the Team scope always,
 * plus the targeted template scope when the action names one). The
 * `recoveryWork` / `control` classes are never static: a recovery operation
 * is the caller-context choice (the human-reviewed dispatch — `recovery`
 * true) and a control operation is the Control surface itself.
 *
 * @param actionName - the closed action name.
 * @param targetTemplateId - the template the action's work targets (the
 *   follow-up/delegate/create-member addressing), or `undefined` when the
 *   action names no template (the Team scope only).
 * @param recovery - whether this attempt is the reviewed recovery dispatch
 *   (the normal-work actions become `recoveryWork` for the blocked scopes).
 * @returns the frozen {@link ActionImpact}.
 */
export declare function actionImpactOf(actionName: string, targetTemplateId: string | undefined, recovery: boolean): ActionImpact;
//# sourceMappingURL=requirement-gate.d.ts.map