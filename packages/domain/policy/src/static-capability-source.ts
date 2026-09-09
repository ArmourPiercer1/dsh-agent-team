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

import type {
  BlueprintTemplate,
  TeamBlueprint,
} from '../../blueprint/src/types.js'

import type { PolicyEntry, TemplatePolicy } from './types.js'

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
} as const

/**
 * Static template capabilities extracted from a blueprint template.
 *
 * When the template has no `capabilities` field, this returns a legacy
 * mode marker. When present, it returns the selective mode with all four
 * sub-fields mapped to the resolver's vocabulary.
 */
export type StaticTemplateCapabilities =
  | { mode: 'legacy' }
  | {
      mode: 'selective'
      teamTools: PolicyEntry
      builtinToolDeny: readonly string[]
      skills: PolicyEntry
      mcp: PolicyEntry
    }

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
export function staticCapabilitiesOf(
  _blueprint: TeamBlueprint,
  memberTemplate: BlueprintTemplate,
): StaticTemplateCapabilities {
  const caps = memberTemplate.capabilities
  if (caps === undefined) {
    return { mode: 'legacy' }
  }
  return {
    mode: 'selective' as const,
    teamTools: caps.teamTools as PolicyEntry,
    builtinToolDeny: caps.builtinToolDeny,
    skills: caps.skills as PolicyEntry,
    mcp: caps.mcp as PolicyEntry,
  }
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
export function selectiveToTemplatePolicyValues(
  capabilities: StaticTemplateCapabilities,
): TemplatePolicy['values'] {
  if (capabilities.mode === 'legacy') {
    return undefined
  }
  const values: Record<string, PolicyEntry> = {}
  if (capabilities.teamTools.kind === 'allow' && capabilities.teamTools.items.length > 0) {
    values[CAPABILITY_MAP.TEAM_TOOLS] = capabilities.teamTools
  } else if (capabilities.teamTools.kind === 'deny') {
    values[CAPABILITY_MAP.TEAM_TOOLS] = capabilities.teamTools
  }
  if (capabilities.skills.kind === 'allow' && capabilities.skills.items.length > 0) {
    values[CAPABILITY_MAP.SKILLS] = capabilities.skills
  } else if (capabilities.skills.kind === 'deny') {
    values[CAPABILITY_MAP.SKILLS] = capabilities.skills
  }
  if (capabilities.mcp.kind === 'allow' && capabilities.mcp.items.length > 0) {
    values[CAPABILITY_MAP.MCP] = capabilities.mcp
  } else if (capabilities.mcp.kind === 'deny') {
    values[CAPABILITY_MAP.MCP] = capabilities.mcp
  }
  return Object.keys(values).length > 0 ? values : undefined
}
