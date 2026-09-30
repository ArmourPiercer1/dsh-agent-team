/**
 * pre-alpha3 PR-E (plan §E.4) — the RequirementAuthority module: the
 * product-semantics switch from the old compatibility model to the new
 * requirement / recovery model.
 *
 * This is a PURE domain layer (no I/O, no `node:` builtins) that READS the
 * compatibility engine's per-requirement outcomes and re-interprets them in
 * the recovery model:
 *
 * - **scope classification** — a scope is `ready` / `degraded` (optional
 *   unmet) / `blocked` (required unmet) (plan §E.8);
 * - **recovery** — DERIVED from the blocked scopes, never a stored flag
 *   (plan §E.9/§E.10);
 * - **action gating** — keys on the action's IMPACT class + its target
 *   scopes, never the coarse `ActionCategory` (plan §E.7);
 * - **startup preflight** — all-template requirement classification before
 *   Team creation (plan §E.6);
 * - **durable facts** — the consent / availability / recovery-incident
 *   records under the frozen `compatibility` category (plan §E.5).
 *
 * The LIVE enforcement (wiring the gate into `admission/actions.ts`, the
 * member-spawn path, and the recovery-dispatch Control coupling) is the
 * runtime integration layer that consumes this module.
 *
 * @module @dsh-agent-team/runtime/requirements
 */
// types (the closed vocabularies + the data shapes)
export { ACTION_IMPACT_CLASSES, ACTION_IMPACT_CLASS_VALUES, GATE_REASONS, GATE_REASON_VALUES, isActionImpactClass, isGateReason, isRequirementOutcome, isScopeState, PENDING_BLOCK, PREFLIGHT_OUTCOME_VALUES, PREFLIGHT_OUTCOMES, REQUIREMENT_LEVELS, REQUIREMENT_LEVEL_VALUES, REQUIREMENT_OUTCOME_VALUES, REQUIREMENT_OUTCOMES, SCOPE_STATE_VALUES, SCOPE_STATES, scopeKey, teamScope, templateScope, } from './types.js';
// errors
export { isRequirementError, REQUIREMENT_ERROR_CODE_VALUES, REQUIREMENT_ERROR_CODES, RequirementError, } from './errors.js';
// evaluator (scope classification + recovery derivation + action gating)
export { classifyScope, deriveRecovery, evaluateScopes, gateAction, parseScopeKey, } from './evaluator.js';
// action-impact builders (§E.7)
export { controlImpact, coordinationImpact, diagnosticImpact, impactFor, lifecycleImpact, normalWorkImpact, recoveryWorkImpact, } from './action-impact.js';
// startup preflight (§E.6)
export { fixOrDisableTargets, startupPreflight } from './startup-preflight.js';
// creation preflight + production writers (W3-B, review fix F6/F7)
export { blockedScopeKeysOf, evaluateCreationScopes, grantDegradationConsent, runCreationPreflight, setTemplateAvailabilityFact, } from './creation-preflight.js';
// consent (§E.6/§E.11)
export { isConsented, relevantConsents, validateConsent } from './consent.js';
// template availability (§E.6/§E.11)
export { isTemplateAvailable, setTemplateAvailability, validateTemplateAvailability, } from './template-availability.js';
// recovery (§E.8/§E.9/§E.10)
export { externalHardAllowed, POLICY_DECISIONS, recoveryExitReady, recoveryPolicyDecision, RECOVERY_DECISIONS, } from './recovery.js';
// durable facts (§E.5)
export { isRequirementFactType, OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE, OPTIONAL_REQUIREMENT_ACCEPTED_FIELDS, parseOptionalRequirementAccepted, parseRecoveryIncidentClosed, parseRecoveryIncidentOpened, parseTemplateAvailabilitySet, RECOVERY_INCIDENT_CLOSED_FACT_TYPE, RECOVERY_INCIDENT_CLOSED_FIELDS, RECOVERY_INCIDENT_OPENED_FACT_TYPE, RECOVERY_INCIDENT_OPENED_FIELDS, REQUIREMENT_FACT_CATEGORY, REQUIREMENT_FACT_TYPES, REQUIREMENT_FACT_TYPE_VALUES, recoveryIncidentClosedPayload, recoveryIncidentOpenedPayload, optionalRequirementAcceptedPayload, templateAvailabilitySetPayload, TEMPLATE_AVAILABILITY_SET_FACT_TYPE, TEMPLATE_AVAILABILITY_SET_FIELDS, writeRequirementFact, } from './facts.js';
// scope requirement extraction (§E.2/§E.4)
export { projectVerdicts, relevantFacts, scopeKeysOf, scopeRequirementInputsOf, } from './scope-requirements.js';
// persona requirement vocabulary + shipped-state observation (§E.3)
export { isRequiredPersonaKind, REQUIRED_PERSONA_KINDS, REQUIRED_PERSONA_KIND_VALUES, SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID, shippedStatePersonaObserver, } from './observed-persona.js';
//# sourceMappingURL=index.js.map