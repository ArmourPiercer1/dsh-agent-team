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
