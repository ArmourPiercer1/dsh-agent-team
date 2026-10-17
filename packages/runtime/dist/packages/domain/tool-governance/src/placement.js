/**
 * The R1 PLACEMENT face of `ToolBinding` (VNEXT-SCHEMA-ADR §1 B1/B2; design
 * `post-poc-technical-design.md` §2 R1 = Scoped Binding route).
 *
 * R1 is a placement FACT, not a config lookup: the entry assembly places a
 * Team-owned Definition under a reserved name and pins THE OBJECT IT PLACED
 * (GLUE-5 #308 shipped that production mechanism — `team-tool-plane.mjs`
 * bindOwnTools placement attribution feeding the admitted-call binding).
 * This module is the TYPE-LEVEL face of that mechanism:
 *
 *  - `PlacedTeamDefinition` — the closed record of one placement fact
 *    (which owner namespace placed which name to which definition object);
 *  - `mintToolBindingFromPlacement` — the placement fact + the trusted
 *    assembly-side facts become a `ToolBinding` THROUGH `parseToolBinding`
 *    itself (pa-CONTRACT §GLUE-5: guard publishes facts, admitCall receives
 *    the binding REBUILT via `parseToolBinding`; there is deliberately no
 *    second construction path — every law the frozen parser enforces,
 *    enforces here);
 *  - `createPlacementComparator` — the per-call comparison hook: an admitted
 *    binding is checked against the CURRENT placement table of the owning
 *    assembly. A name nobody placed, or the same name now resolving to a
 *    DIFFERENT definition object (identity drift), is a typed verdict —
 *    never a throw, never a silent pass.
 *
 * owner ↔ providerId is 1:1 by construction (B2: the placement record IS
 * the provider identity; no separate mapping table may appear).
 *
 * DORMANT like the whole lane: no shipped runtime path is rewired here —
 * the production plane already pins the same facts through its own
 * (behavior-tested) code path; rewiring the live plane to this typed face
 * is a behavior change owned by the effect-queue round, not this one.
 *
 * Purity: no `node:*`, no I/O, no clock.
 *
 * @module @dsh-agent-team/domain/tool-governance/placement
 */
import { closeRecordKeys, finish, isRecord, reqString } from './parse-util.js';
import { parseToolBinding } from './binding.js';
/** The closed record of one placed Team-owned Definition (R1 placement fact). */
export const PLACED_TEAM_DEFINITION_FIELDS = ['owner', 'toolName', 'definitionIdentity'];
/** Strict parse of one placement fact — closed shape, collected problems. */
export function parsePlacedTeamDefinition(raw) {
    const problems = [];
    if (!isRecord(raw)) {
        return { ok: false, problems: [{ code: 'not-a-record', path: '$', detail: 'a placement fact must be a record' }] };
    }
    closeRecordKeys(raw, PLACED_TEAM_DEFINITION_FIELDS, '$', problems);
    const owner = reqString(raw, 'owner', '$', problems);
    const toolName = reqString(raw, 'toolName', '$', problems);
    const definitionIdentity = reqString(raw, 'definitionIdentity', '$', problems);
    // A placement fact is a governance fact: present-but-blank is a lie about
    // who placed what, so it refuses (local law; the frozen parse-util stays).
    for (const [key, value] of [['owner', owner], ['toolName', toolName], ['definitionIdentity', definitionIdentity]]) {
        if (typeof value === 'string' && value.trim() === '') {
            problems.push({ code: 'empty-string', path: `$.${key}`, detail: `'${key}' is present but blank` });
        }
    }
    return finish(problems, () => ({
        owner: owner,
        toolName: toolName,
        definitionIdentity: definitionIdentity,
    }));
}
/**
 * Build the admitted-call `ToolBinding` for a placement — BY DELEGATING to
 * `parseToolBinding` (the frozen parser the production admitCall contract
 * consumes). This is the "reuse, no parallel system" pin: delete this
 * function and the same values must still parse identically.
 */
export function mintToolBindingFromPlacement(placed, facts) {
    return parseToolBinding({
        bindingId: facts.bindingId,
        agentScopeKey: facts.agentScopeKey,
        toolName: placed.toolName,
        definitionIdentity: placed.definitionIdentity,
        providerId: placed.owner,
        implementationOrigin: facts.implementationOrigin,
        executionBoundary: facts.executionBoundary,
        assurance: facts.assurance,
        policyGeneration: facts.policyGeneration,
        authorityGeneration: facts.authorityGeneration,
        revision: facts.revision,
        status: facts.status,
    });
}
/**
 * Build the per-call comparison hook over a placement table. Construction is
 * strict: every row must parse, and one (owner, toolName) may resolve to at
 * most ONE definition object — a table that places a name twice is a
 * construction error (the ambiguity is the incident, not a runtime surprise).
 */
export function createPlacementComparator(placementFacts) {
    const table = new Map();
    for (const [index, raw] of placementFacts.entries()) {
        const parsed = parsePlacedTeamDefinition(raw);
        if (!parsed.ok) {
            throw new TypeError(`placement fact #${String(index)} is invalid: ${JSON.stringify(parsed.problems)}`);
        }
        const key = `${parsed.value.owner}\u0000${parsed.value.toolName}`;
        if (table.has(key)) {
            throw new TypeError(`placement name '${parsed.value.owner}/${parsed.value.toolName}' is placed twice with different definitions`);
        }
        table.set(key, parsed.value);
    }
    return Object.freeze({
        compare(admitted) {
            const placed = table.get(`${admitted.providerId}\u0000${admitted.toolName}`);
            if (placed === undefined) {
                return { ok: false, code: 'definition-not-placed', providerId: admitted.providerId, toolName: admitted.toolName };
            }
            if (placed.definitionIdentity !== admitted.definitionIdentity) {
                return {
                    ok: false,
                    code: 'placement-identity-drift',
                    providerId: admitted.providerId,
                    toolName: admitted.toolName,
                    expected: placed.definitionIdentity,
                    observed: admitted.definitionIdentity,
                };
            }
            return { ok: true, placed };
        },
    });
}
//# sourceMappingURL=placement.js.map