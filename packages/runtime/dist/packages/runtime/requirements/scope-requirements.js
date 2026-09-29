/**
 * pre-alpha3 PR-E (plan §E.4/§E.6) — the scope requirement extraction: the
 * PURE bridge from a bound blueprint (schema v1 or v2) to the per-SCOPE
 * requirement inputs the compatibility engine consumes, plus the projection
 * of one engine {@link CompatibilityResult} into the authority's per-scope
 * {@link RequirementVerdict} list.
 *
 * Scope layout (plan §E.2):
 *
 * - **Team scope** — the v1 flat `requirements` list (the frozen v1 shape:
 *   in a v2 document it is the LEGACY team-level mechanism) bridged through
 *   the SAME closed domain mapping as the runtime compatibility bridge
 *   (`compatibilityRequirementsOf` — no fork of semantics), PLUS the v2
 *   structured `teamRequirements` (already in the engine's requirement
 *   vocabulary: explicit `requirementId` / `type` / `subjects` / `complete`);
 * - **Leader scope** — the bound `leader.requirements` (v2 only; ABSENT in
 *   v1 documents — v1 carries no per-template requirements);
 * - **MemberTemplate scopes** — each bound `members[i].requirements`
 *   (v2 only).
 *
 * The extraction is DETERMINISTIC and version-aware: a v1 blueprint yields
 * EXACTLY the team scope (the v1 flat list) and NO template scopes — the
 * v1 world is byte-identical to the pre-PR-E compatibility bridge (the
 * frozen v1 reader is untouched; no v2 rule leaks into v1).
 *
 * Pure module: no I/O, no `node:` builtins.
 * @module @dsh-agent-team/runtime/requirements/scope-requirements
 */
import { compatibilityRequirementsOf } from '../compatibility/blueprint.js';
import { parseScopeKey } from './evaluator.js';
import { scopeKey, teamScope, templateScope, } from './types.js';
/**
 * The Team scope's engine inputs — the EXACT `compatibilityRequirementsOf`
 * bridge (closed domain mapping + `optional → complete` inversion +
 * `req-<domain>-<name>` identity derivation, extended by PR-E for the v2
 * structured `teamRequirements`), reused verbatim so the gate's scope view
 * and the authority chain's team evaluation are the SAME inputs (no fork of
 * semantics; the v1 world is byte-identical to pre-PR-E).
 */
function teamRequirementInputsOf(blueprint) {
    return compatibilityRequirementsOf(blueprint);
}
/**
 * Extract the per-scope requirement inputs of one bound blueprint (plan §E.2).
 *
 * @param blueprint - the resolved bound blueprint (immutable snapshot).
 * @returns the frozen per-scope inputs + the scope list.
 * @throws {@link CompatibilityError} `UNBRIDGEABLE_REQUIREMENT` when the v1
 *   flat list carries a domain outside the closed bridge.
 */
export function scopeRequirementInputsOf(blueprint) {
    // Team scope: the v1 flat list (both versions) + the v2 structured
    // teamRequirements (v2 documents; ABSENT in v1) — the EXACT inputs the
    // compatibility authority chain evaluates for the Team scope (the
    // extended `compatibilityRequirementsOf` bridge; no second copy, no
    // fork).
    const team = teamRequirementInputsOf(blueprint);
    // Template scopes: v2 only (v1 documents carry no per-template
    // requirements — the frozen v1 reader is untouched).
    const templates = {};
    const scopes = [];
    if (team.length > 0)
        scopes.push(teamScope());
    if (blueprint.schemaVersion === 2) {
        const templateEntries = [
            { templateId: blueprint.leader.templateId, requirements: blueprint.leader.requirements },
            ...blueprint.members.map((member) => ({
                templateId: member.templateId,
                requirements: member.requirements,
            })),
        ];
        for (const entry of templateEntries) {
            if (entry.requirements === undefined || entry.requirements.length === 0)
                continue;
            templates[entry.templateId] = entry.requirements.map((requirement) => ({
                requirementId: requirement.requirementId,
                type: requirement.type,
                subjects: [...requirement.subjects],
                complete: requirement.complete,
            }));
            scopes.push(templateScope(entry.templateId));
        }
    }
    return Object.freeze({
        team: Object.freeze(team),
        templates: Object.freeze(templates),
        scopes: Object.freeze(scopes),
    });
}
/**
 * Project one engine {@link CompatibilityResult} (one scope's inputs) into
 * the authority's per-scope {@link RequirementVerdict} list (plan §E.4:
 * the authority READS the engine's outcomes and re-interprets them in the
 * recovery model — the mapping from the engine's closed
 * `PASS/WARNING/FATAL` outcomes to the authority's `pass/warning/fatal`
 * vocabulary is explicit at this boundary).
 *
 * @param result - the engine result of ONE scope's evaluation.
 * @returns the frozen verdict list (same order as the engine's rows).
 */
export function projectVerdicts(result) {
    return result.requirements.map((row) => Object.freeze({
        requirementId: row.requirementId,
        complete: row.complete,
        outcome: row.outcome === 'PASS'
            ? 'pass'
            : row.outcome === 'WARNING'
                ? 'warning'
                : 'fatal',
        unavailableSubjects: [...row.unavailableSubjects],
    }));
}
/**
 * The environment facts relevant to the persona domain of one scope's
 * requirement inputs (plan §E.3: the persona requirement's subject is the
 * persona KIND; the world facts are the observed kind facts). Used by the
 * live gate to keep the persona lane world-driven without re-reading the
 * probe world.
 *
 * @param facts - the full environment facts of one probe world.
 * @param requirementInputs - the scope's requirement inputs.
 * @returns the facts relevant to the scope's probeable (type, subject) pairs.
 */
export function relevantFacts(facts, requirementInputs) {
    const keys = new Set(requirementInputs.flatMap((input) => input.subjects.map((subject) => `${input.type}\u0000${subject}`)));
    return facts.filter((fact) => keys.has(`${fact.domain}\u0000${fact.subject}`));
}
/**
 * The scope keys present in a scope-requirement extraction (for durable
 * fact + incident bookkeeping).
 *
 * @param inputs - the extraction.
 * @returns the deterministic scope key list.
 */
export function scopeKeysOf(inputs) {
    return inputs.scopes.map((scope) => scopeKey(scope));
}
/**
 * Resolve a scope key back to a scope (re-export of the evaluator's parser
 * for the live wiring's incident bookkeeping).
 */
export { parseScopeKey };
//# sourceMappingURL=scope-requirements.js.map