/**
 * P7-T1 — the blueprint → typed-requirements bridge of the runtime
 * compatibility module.
 *
 * Mirrors the P6-T1 activation bridge (`toActivationRequirements`,
 * `packages/runtime/activation/checks.ts`) VERBATIM in semantics —the
 * same closed domain mapping, the same `requirementId` derivation, the
 * same `optional → complete` ruling —so that a probe run by this module
 * and a live evaluation run by the activation gate classify the same
 * blueprint identically (no fork of semantics).
 *
 * - the closed bridge (P3-T6 composition pipeline, extended by P6-T1):
 *   `tool`→tool, `skill`→skill, `mcp`/`mcpServer`→mcpServer,
 *   `model`/`modelRoute`→modelRoute, `persona`→persona,
 *   `teamStructure`→teamStructure;
 * - `optional: true` → `complete: false` (unmet → ack-able WARNING);
 *   required → `complete: true` (unmet → FATAL, no downgrade, §13.5);
 * - `teamStructure` / `persona` are FATAL at the engine level regardless
 *   of `complete`;
 * - a domain outside the closed bridge fails loud
 *   (Architecture §27.1: unknown requirement domain is a validation
 *   error; an unprobeable requirement cannot be admitted).
 *
 * Pure mapping: no I/O, no evaluation (the engine evaluates).
 * @module @dsh-agent-team/runtime/compatibility/blueprint
 */
import { CompatibilityError, COMPATIBILITY_ERROR_CODES } from './errors.js';
/**
 * The closed bridge from the blueprint's lowercase-slug requirement
 * domains to the compatibility engine's closed §27.1 requirement-type
 * vocabulary (identical to the P6-T1 `BLUEPRINT_DOMAIN_TO_REQUIREMENT_TYPE`).
 */
export const BLUEPRINT_DOMAIN_TO_REQUIREMENT_TYPE = {
    tool: 'tool',
    skill: 'skill',
    mcp: 'mcpServer',
    mcpServer: 'mcpServer',
    model: 'modelRoute',
    modelRoute: 'modelRoute',
    persona: 'persona',
    teamStructure: 'teamStructure',
};
/**
 * Map the bound blueprint's capability requirements to the compatibility
 * engine's typed requirement inputs.
 *
 * @param blueprint - the resolved bound blueprint (immutable snapshot).
 * @returns the typed requirement inputs (stable order: blueprint order).
 * @throws {@link CompatibilityError} `UNBRIDGEABLE_REQUIREMENT` when the
 *   blueprint declares a requirement domain outside the closed bridge.
 */
export function compatibilityRequirementsOf(blueprint) {
    const inputs = [];
    for (const requirement of blueprint.requirements) {
        const type = BLUEPRINT_DOMAIN_TO_REQUIREMENT_TYPE[requirement.domain];
        if (type === undefined) {
            throw new CompatibilityError(COMPATIBILITY_ERROR_CODES.UNBRIDGEABLE_REQUIREMENT, `compatibility: blueprint requirement domain '${requirement.domain}' is not in the closed probeable-domain bridge (fail loud, Architecture §27.1)`, { domain: requirement.domain, name: requirement.name });
        }
        inputs.push({
            requirementId: `req-${requirement.domain}-${requirement.name}`,
            type,
            subjects: [requirement.name],
            complete: requirement.optional !== true,
        });
    }
    return inputs;
}
//# sourceMappingURL=blueprint.js.map