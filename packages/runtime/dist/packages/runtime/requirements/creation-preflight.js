/**
 * pre-alpha3 W3-B (review fix F6/F7, guide §6) — the server-side CREATION
 * preflight authority + the production requirement-fact writers.
 *
 * F6 — the creation preflight. The pure {@link startupPreflight} classifier
 * was PR-E's unit face; this module makes it the PRODUCTION creation
 * authority (guide §6.2): the single choke point every fresh TeamSession
 * mint of the production host entry shares (the `bindFresh` wrapper) runs,
 * BEFORE the registry freeze and BEFORE any durable bind write:
 *
 * ```text
 * resolve Blueprint            (the bound snapshot ref → the full blueprint)
 * → build ALL scopes           (the Team scope + every v2 template scope,
 *                               Leader included — no instance needed)
 * → fresh runtime requirement  (the live provider's per-scope feeds — the
 *   facts                       W3-A authority; NOT the durable
 *                               compatibility chain: a team that has never
 *                               been created has no durable line, and a
 *                               pre-bind probe write would leave a durable
 *                               effect behind a refused creation)
 * → startupPreflight           (the PR-E classifier, unchanged)
 * ```
 *
 * A non-`proceed` outcome is a TYPED fail-closed block with ZERO durable
 * effect (no TeamSession record, no binding row, no leader mint, no
 * consent/availability fact — the human resolves via the F7 writers and
 * re-drives the creation; the idempotent re-drive is the "重新 preflight").
 *
 * F7 — the production writers. The DegradationConsent grant and the
 * template disable/enable are DURABLE human decisions over the frozen
 * `compatibility` ledger category (the PR-E fact model, the
 * commit-before-ack `writeRequirementFact`). The production world exposes
 * them as root-level services (the frozen remote contract v1–v6 gains NO
 * method — the UI flow consumes the typed preflight result and re-drives).
 * Both writers are FAIL-CLOSED:
 *
 * - the consent is validated against a FRESH evaluation (a consent that
 *   targets a required requirement or a satisfied one is refused — the
 *   PR-E `validateConsent` — and a target that is not in the current
 *   evaluation at all is refused: a consent is never minted for a
 *   requirement the blueprint does not declare);
 * - the availability entry is validated against the bound blueprint's
 *   template set (the PR-E `validateTemplateAvailability`);
 * - a single fact per call (one ledger row — no partial write is possible),
 *   and the write COMPLETES before the ack (a write failure propagates;
 *   the caller never observes a success that is not durable);
 * - re-runs converge: a repeated disable/enable appends a new row and the
 *   latest-wins read (the `readRequirementFacts` fold) reports the current
 *   availability; the consent line is a pure history (re-consenting the
 *   same optional requirement appends, never conflicts).
 *
 * Restart semantics (authority negative #10): both facts are durable
 * ledger rows under the team's rootSessionId — they survive a restart;
 * the live readiness (the probe verdicts) resets and is re-probed, the
 * consent/availability stand. A consent is keyed by the team's
 * rootSessionId, and the blueprint is bound INTO the TeamSession identity
 * (invariant 10): a different blueprint (hash/revision) is a different
 * team — the old consent is never inherited across it.
 *
 * I/O only through the injected ports (the facts thunks, the ledger, the
 * clock); no `node:` builtins, no upstream imports.
 * @module @dsh-agent-team/runtime/requirements/creation-preflight
 */
import { evaluateCompatibility } from '../../domain/compatibility/src/index.js';
import { scopeKey, SCOPE_STATES } from './types.js';
import { evaluateScopes } from './evaluator.js';
import { scopeRequirementInputsOf, projectVerdicts } from './scope-requirements.js';
import { startupPreflight } from './startup-preflight.js';
import { validateConsent } from './consent.js';
import { validateTemplateAvailability } from './template-availability.js';
import { OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE, TEMPLATE_AVAILABILITY_SET_FACT_TYPE, optionalRequirementAcceptedPayload, templateAvailabilitySetPayload, writeRequirementFact, } from './facts.js';
import { REQUIREMENT_ERROR_CODES, RequirementError } from './errors.js';
import { TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError } from '../admission/errors.js';
/**
 * Evaluate EVERY scope of the blueprint against ONE fresh facts read — the
 * creation-time form of the gate's scope evaluation: the Team scope and
 * every v2 template scope go through the PURE engine on their fresh feeds
 * (no durable compatibility authority chain — a pre-bind evaluation must
 * leave NO durable effect, and a never-created team has no durable line to
 * consult; its first evaluation IS the fresh probe).
 *
 * @throws {@link TeamRuntimeError} COMPATIBILITY_BLOCKED (fail-closed) when
 *   a facts port fails (a chain failure is never a creation).
 */
export async function evaluateCreationScopes(options) {
    const { blueprint, environmentFacts, templateEnvironmentFacts } = options;
    const inputs = scopeRequirementInputsOf(blueprint);
    // 1. Team scope — one fresh facts read (a failure is a chain failure).
    let teamFacts;
    try {
        teamFacts = await environmentFacts();
    }
    catch (error) {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, 'TeamRuntime: the environment-facts port failed during the creation preflight — the creation fails closed (zero durable effect)', {
            source: 'creation-preflight',
            reason: 'facts-unavailable',
            cause: error instanceof Error ? error.message : undefined,
        });
    }
    const scopeVerdicts = {
        team: projectVerdicts(evaluateCompatibility({ requirements: inputs.team, environmentFacts: teamFacts })),
    };
    // 2. Template scopes — each on ITS OWN fresh feed (v2 only; the feeds
    //    may not be unioned — (domain, subject) pairs may collide across
    //    scopes, W3-A). A read failure is a chain failure (fail-closed).
    if (blueprint.schemaVersion === 2) {
        for (const [templateId, requirementInputs] of Object.entries(inputs.templates)) {
            let templateFacts;
            if (templateEnvironmentFacts === undefined) {
                templateFacts = teamFacts;
            }
            else {
                try {
                    templateFacts = await templateEnvironmentFacts(templateId);
                }
                catch (error) {
                    throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, `TeamRuntime: the template-environment-facts port failed for template '${templateId}' during the creation preflight — the creation fails closed (zero durable effect)`, {
                        source: 'creation-preflight',
                        reason: 'facts-unavailable',
                        templateId,
                        cause: error instanceof Error ? error.message : undefined,
                    });
                }
            }
            scopeVerdicts[scopeKey({ level: 'template', templateId })] = projectVerdicts(evaluateCompatibility({ requirements: requirementInputs, environmentFacts: templateFacts }));
        }
    }
    return {
        scopeVerdicts,
        scopeStates: evaluateScopes({ scopeVerdicts }),
    };
}
/**
 * Run the creation preflight (guide §6.2): evaluate ALL scopes on fresh
 * runtime facts, fold in the durable consents + template availability, and
 * classify through the PR-E {@link startupPreflight} (the pure classifier,
 * unchanged).
 *
 * @returns the closed {@link PreflightResult} (`proceed` / `consentRequired`
 *   / `fixOrDisable` / `fatal`).
 */
export async function runCreationPreflight(options) {
    const { scopeVerdicts } = await evaluateCreationScopes(options);
    return startupPreflight({
        scopeVerdicts,
        ...(options.consents !== undefined ? { consents: options.consents } : {}),
        ...(options.availability !== undefined ? { availability: options.availability } : {}),
    });
}
/**
 * The blocked scope keys of a creation preflight result (the human-facing
 * "what is down" projection — every scope in a blocked state).
 */
export function blockedScopeKeysOf(result) {
    return result.scopes
        .filter((scope) => scope.state === SCOPE_STATES.blocked)
        .map((scope) => scopeKey(scope.scope));
}
/**
 * Durably grant ONE degradation consent (the human's `consentRequired`
 * resolution, guide §6.2): validate the target against a FRESH evaluation
 * (required-target / satisfied-target / undeclared-target = typed refusal,
 * ZERO writes), then write the `optional-requirement-accepted` fact
 * (commit-before-ack — the write completes before the ack; a failure
 * propagates, never a lost or partial consent).
 *
 * @throws {@link RequirementError} `CONSENT_TARGET_NOT_OPTIONAL` (the
 *   target is required), `CONSENT_TARGET_SATISFIED` (the target is met —
 *   or not declared at all: a consent is never minted for a requirement
 *   the blueprint does not declare). Durable-write failures propagate
 *   unchanged.
 */
export async function grantDegradationConsent(options) {
    const nowMs = options.nowMs ?? Date.now;
    const evaluation = await evaluateCreationScopes({
        blueprint: options.blueprint,
        environmentFacts: options.environmentFacts,
        ...(options.templateEnvironmentFacts !== undefined
            ? { templateEnvironmentFacts: options.templateEnvironmentFacts }
            : {}),
    });
    const allVerdicts = Object.values(evaluation.scopeVerdicts).flat();
    const verdict = allVerdicts.find((row) => row.requirementId === options.requirementId);
    if (verdict === undefined) {
        // Not declared in ANY scope of the bound blueprint: there is nothing to
        // consent to. `CONSENT_TARGET_SATISFIED` in the closed vocabulary is
        // the code for "not unmet in the current evaluation" — an undeclared
        // target is vacuously not unmet; the detail carries the distinction.
        throw new RequirementError(REQUIREMENT_ERROR_CODES.CONSENT_TARGET_SATISFIED, `consent names requirement '${options.requirementId}' which is not unmet in the current evaluation (the bound blueprint declares no such requirement) — nothing to consent to`, { requirementId: options.requirementId, reason: 'requirement-not-in-evaluation' });
    }
    // The PR-E validation (required-target / satisfied-target = typed).
    validateConsent({
        requirementId: options.requirementId,
        generation: options.generation,
        consentedAt: nowMs(),
        consentedBy: options.consentedBy,
    }, allVerdicts);
    const payload = optionalRequirementAcceptedPayload({
        requirementId: options.requirementId,
        generation: options.generation,
        consentedAt: nowMs(),
        consentedBy: options.consentedBy,
    });
    await writeRequirementFact(options.ledger, options.rootSessionId, OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE, payload, options.now ?? (() => new Date(nowMs()).toISOString()));
    return payload;
}
/**
 * Durably set ONE template's availability (the human's `fixOrDisable`
 * resolution, guide §6.2): validate the template against the bound
 * blueprint's template set (the PR-E `validateTemplateAvailability` —
 * unknown template = typed refusal, ZERO writes), then write the
 * `template-availability-set` fact (commit-before-ack; a failure
 * propagates). A repeated set appends a new row — the latest-wins read
 * fold reports the current availability (re-runs converge, no partial
 * write: the decision is exactly one row).
 *
 * @throws {@link RequirementError} `UNKNOWN_TEMPLATE` (the entry names a
 *   template the bound blueprint does not declare). Durable-write failures
 *   propagate unchanged.
 */
export async function setTemplateAvailabilityFact(options) {
    const knownTemplateIds = [
        options.blueprint.leader.templateId,
        ...options.blueprint.members.map((member) => member.templateId),
    ];
    // The PR-E validation (unknown template = typed, zero writes).
    validateTemplateAvailability([{ templateId: options.templateId, available: options.available }], knownTemplateIds);
    const nowMs = options.nowMs ?? Date.now;
    const payload = templateAvailabilitySetPayload({
        templateId: options.templateId,
        available: options.available,
        at: nowMs(),
    });
    await writeRequirementFact(options.ledger, options.rootSessionId, TEMPLATE_AVAILABILITY_SET_FACT_TYPE, payload, options.now ?? (() => new Date(nowMs()).toISOString()));
    return payload;
}
//# sourceMappingURL=creation-preflight.js.map