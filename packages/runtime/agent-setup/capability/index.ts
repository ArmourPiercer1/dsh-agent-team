/**
 * The capability overlay facet facade (TaskDoc §11.5 P5-T4).
 *
 * Public surface of `packages/runtime/agent-setup/capability`:
 *
 * - the facet / seam / source-set / resolution types (the core formula's
 *   vocabulary);
 * - the pure core-formula functions (the three-set intersection, the
 *   per-facet resolver with the G2 fail-closed gate, the full overlay
 *   resolver, the config helper);
 * - the policy-resolver integration (the `teamResolved` set derived from
 *   the T5-bound stage-1 team policy cell via the allowed policy
 *   resolver dependency);
 * - the `capability` overlay slot factory (the T1 slot-contract
 *   replacement for the identity default, the fresh-path installer the
 *   binder drives through `OverlaySlot.apply`).
 *
 * No TeamDomain contact and no session-event emission in this module —
 * the binder owns those (single-emitter / single-writer discipline).
 * @module @dsh-agent-team/runtime/agent-setup/capability
 */

export {
  CAPABILITY_FACETS,
  type CapabilityFacet,
  type CapabilityFacetSeam,
  type CapabilityFacetSources,
  type CapabilityFailClosedReason,
  type CapabilityFacetResolution,
  type CapabilityFacetConfig,
  type CapabilityOverlayConfig,
  type CapabilityOverlayResolution,
} from './types.js'

export {
  intersectThreeSets,
  resolveFacet,
  resolveCapabilityOverlay,
  facetConfig,
} from './resolve.js'

export { FACET_POLICY_DOMAINS, deriveTeamResolved } from './policy-sources.js'

export {
  createCapabilityOverlaySlot,
  type CapabilityOverlaySlot,
  type CapabilityOverlaySlotOptions,
} from './slot.js'

// P8-S4B — the durable CONSUMPTION of the MCP facet: the mount decision
// the live agent applies at every boundary, re-read from the durable
// governance overrides (backend truth) — fail-closed, restart-effective
// (DevPlan P8-S §18.1/§18.2).
export {
  MCP_FACET_WILDCARD,
  mcpFacetView,
  resolveDurableMcpFacet,
  type DurableMcpFacet,
  type DurableMcpFacetArgs,
  type McpFacetView,
} from './mcp-facet.js'

// T3 — Team skill catalog + adapter (plan §8/§8.1): minimal in-memory
// catalog, policy-driven skill registration with composite disposer.
export {
  InMemorySkillCatalog,
  type TeamSkillCatalog,
  type TeamSkillDefinition,
} from './skill-catalog.js'

export {
  registerTeamSkills,
  type SkillRegistrationDisposer,
  type SkillAgentContext,
} from './skill-adapter.js'

// T3 — MCP adapter (plan §9): filter configured servers against policy.
// (The dead mountAllowedMcpServers helper + its interfaces were removed in
// the alpha.1 hardening P2.1 — the production mount is the live glue's
// reconcileMcp over the real agentCtx.plugin(mcpClient, config) seam.)
export { filterMcpServers } from './mcp-adapter.js'
