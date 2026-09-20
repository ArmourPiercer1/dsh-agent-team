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
import type { BlueprintTemplate, TeamBlueprint } from '../../blueprint/src/types.js';
import type { PolicyEntry, TemplatePolicy } from './types.js';
/**
 * Static template capabilities extracted from a blueprint template.
 *
 * When the template has no `capabilities` field, this returns a legacy
 * mode marker. When present, it returns the selective mode with all four
 * sub-fields mapped to the resolver's vocabulary.
 */
export type StaticTemplateCapabilities = {
    mode: 'legacy';
} | {
    mode: 'selective';
    teamTools: PolicyEntry;
    builtinToolDeny: readonly string[];
    skills: PolicyEntry;
    mcp: PolicyEntry;
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
export declare function staticCapabilitiesOf(_blueprint: TeamBlueprint, memberTemplate: BlueprintTemplate): StaticTemplateCapabilities;
/**
 * The bound template's INITIAL static MCP governance grant — the SINGLE
 * derivation shared by every consumer of the template layer (the MCP live
 * consumption derivation, `team_inspect_config`, and the activation
 * step-8 policy resolution; PR #23 review fix):
 *
 * - only an EXPLICIT `allow` that NAMES at least one server produces a
 *   grant (an `allow(items: [])` normalizes to NO grant — the frozen
 *   resolver rejects empty allow items as malformed, and the cell stays
 *   unspecified / fail-closed, never a deny-everything surprise);
 * - a `deny`, a future `ask`, any other non-allow state, and a legacy
 *   (capabilities-less) template contribute NOTHING — they are never
 *   auto-converted into a grant (fail-closed or dynamically governed in
 *   Alpha.3+);
 * - the result sits at the resolver's `template` value layer (provenance
 *   template/static, no record id): above the PolicyState, below the
 *   record-backed overlays and the external hard facts; no synthetic
 *   durable record is ever created.
 *
 * @param capabilities - the static template capabilities (legacy or selective).
 * @returns the `mcp` PolicyEntry to feed the resolver's `templateValues.mcp`,
 *          or `undefined` when the template declares no initial MCP grant.
 */
export declare function initialMcpGrantOf(capabilities: StaticTemplateCapabilities): PolicyEntry | undefined;
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
export declare function selectiveToTemplatePolicyValues(capabilities: StaticTemplateCapabilities): TemplatePolicy['values'];
//# sourceMappingURL=static-capability-source.d.ts.map