/**
 * Static capability source derived from Blueprint template capabilities (T1).
 *
 * Bridges the blueprint-level {@link TemplateCapabilities} to the policy
 * resolver's {@link TemplatePolicy} value layer. The blueprint declares
 * static per-template capability policies in its `capabilities` field;
 * this module extracts them into the shape the resolver expects.
 *
 * Two modes:
 * - **legacy** — the template has no `capabilities` field; the resolver
 *   falls back to its default (fail-closed / unspecified);
 * - **selective** — the template declares `capabilities`; all four sub-
 *   fields are present and map to the resolver's capability cells.
 *
 * Pure module: no I/O, no DSH imports, no ambient state.
 * @module @dsh-agent-team/domain/policy/static-capability-source
 */
/**
 * The capability domains that map directly from blueprint TemplateCapabilities
 * to the policy resolver's capability cells.
 */
const CAPABILITY_MAP = {
    /** teamTools → tools cell */
    TEAM_TOOLS: 'tools',
    /** skills → skills cell */
    SKILLS: 'skills',
    /** mcp → mcp cell */
    MCP: 'mcp',
};
/**
 * Extract the static capabilities from a blueprint template.
 *
 * @param blueprint - the validated TeamBlueprint (used to locate the
 *        template when a templateId is given; here we pass the template
 *        directly for clarity).
 * @param memberTemplate - the specific BlueprintTemplate to extract
 *        capabilities from.
 * @returns a {@link StaticTemplateCapabilities} in legacy or selective mode.
 */
export function staticCapabilitiesOf(_blueprint, memberTemplate) {
    const caps = memberTemplate.capabilities;
    if (caps === undefined) {
        return { mode: 'legacy' };
    }
    return {
        mode: 'selective',
        teamTools: caps.teamTools,
        builtinToolDeny: caps.builtinToolDeny,
        skills: caps.skills,
        mcp: caps.mcp,
    };
}
/**
 * Map a selective {@link StaticTemplateCapabilities} into the
 * {@link TemplatePolicy['values']} shape the policy resolver consumes.
 *
 * The mapping:
 * - `teamTools` → `values['tools']`
 * - `skills` → `values['skills']`
 * - `mcp` → `values['mcp']`
 * - `builtinToolDeny` does NOT produce a values cell; it is consumed
 *   separately by the runtime when materializing the agent's composition
 *   (the resolver has no "negative tool cell" — the deny list is applied
 *   after resolution, not as a precedence value).
 *
 * @param capabilities - the static capabilities (must be selective mode).
 * @returns a partial record mapping capability names to their PolicyEntry
 *          values, suitable for `TemplatePolicy.values`.
 */
export function selectiveToTemplatePolicyValues(capabilities) {
    if (capabilities.mode === 'legacy') {
        return undefined;
    }
    // P1 (hardening §6): when the template capabilities are SELECTIVE, all
    // three capability cells (teamTools / skills / mcp) enter
    // TemplatePolicy.values EXPLICITLY — including `allow(items: [])`. An
    // explicit empty allow is a DISTINCT policy value (deny everything), NOT
    // "unspecified" — omitting it (the previous `items.length > 0` guard) let
    // a lower-priority Blueprint / PolicyState win the precedence. Only a
    // true legacy template (no capabilities field) returns undefined template
    // authority.
    return {
        [CAPABILITY_MAP.TEAM_TOOLS]: capabilities.teamTools,
        [CAPABILITY_MAP.SKILLS]: capabilities.skills,
        [CAPABILITY_MAP.MCP]: capabilities.mcp,
    };
}
//# sourceMappingURL=static-capability-source.js.map