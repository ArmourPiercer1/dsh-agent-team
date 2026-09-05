/**
 * The pure capability resolution (TaskDoc §11.5 P5-T4).
 *
 * `resolveCapabilityOverlay` is the DETERMINISTIC core of the P5-T4
 * capability overlay: for every facet it computes the frozen core formula
 *
 * ```text
 * effective capability = available ∩ teamResolved ∩ externalHard
 * ```
 *
 * — the intersection of the THREE explicit, injectable source sets, each
 * with its own explicit source (the capability-existence probe / the
 * Team-domain policy resolution / the external hard facts, respectively).
 *
 * Semantics (frozen):
 *
 * - **Set intersection** — an item is effective for a facet iff it is
 *   present in ALL THREE sets. Removing an item from ANY ONE side removes
 *   it from `effective` (the acceptance negative: "任一侧移除都改变
 *   effective 集"). The intersection is EMPTY when any side is empty.
 * - **Deterministic order** — `effective` is the `available` set's order
 *   filtered by membership in the other two sets, deduplicated. The order
 *   is stable across calls for a stable config (no ambient state).
 * - **Fail-closed (G2 discipline)** — a facet whose public seam did NOT
 *   pass G2 (`seam.available === false`) resolves to `effective: []` with
 *   `failClosed: 'seam-not-g2'`: the adapter DENIES the whole facet and
 *   NEVER fabricates a private registry or bypass path (TaskDoc §11.5
 *   P5-T4: "任何未通过 G2 的 capability 不得 private workaround";
 *   DevPlan §15.4 G2). A fail-closed facet is a graceful denial — the
 *   resolution itself NEVER throws, so a disappeared / unexposed
 *   capability can never crash the binder (TaskDoc §11.5 P5-T4 must-test
 *   "capability disappear … binder 不崩").
 * - **Capability disappear** — an item the seam no longer provides drops
 *   out of `available` and hence of `effective` (a graceful degradation,
 *   `failClosed: null` — a normal resolution, not a fault).
 *
 * Pure module: no I/O, no ambient state, no live Agent, no `node:`
 * builtin. The resolution is a pure function of the injected config.
 * @module @dsh-agent-team/runtime/agent-setup/capability/resolve
 */
import { type CapabilityFacet, type CapabilityFacetConfig, type CapabilityFacetResolution, type CapabilityFacetSeam, type CapabilityFacetSources, type CapabilityOverlayConfig, type CapabilityOverlayResolution } from './types.js';
/**
 * The three-set intersection of the core formula, in canonical order.
 *
 * @param available - the capability-existence probe (the order source).
 * @param teamResolved - the Team-domain policy resolution.
 * @param externalHard - the external hard facts.
 * @returns the items present in ALL THREE sets, in `available` order,
 *   deduplicated (a plain owned array).
 */
export declare function intersectThreeSets(available: readonly string[], teamResolved: readonly string[], externalHard: readonly string[]): string[];
/**
 * Resolve the effective capability of ONE facet (the core formula + the
 * G2 fail-closed gate).
 *
 * @param facet - the facet being resolved.
 * @param seam - the facet's G2 public seam (its `available` flag is the
 *   G2 gate).
 * @param sources - the facet's three explicit source sets.
 * @returns the facet resolution (never throws; a fail-closed facet
 *   resolves to an empty `effective` set with the `seam-not-g2` reason).
 */
export declare function resolveFacet(facet: CapabilityFacet, seam: CapabilityFacetSeam, sources: CapabilityFacetSources): CapabilityFacetResolution;
/**
 * Resolve the full capability overlay (all four facets, canonical order).
 *
 * @param config - the complete injected capability overlay configuration.
 * @returns the resolved overlay (one facet resolution per facet, always).
 *
 * @throws {TypeError} when a facet configuration is malformed (a
 *   programming error, surfaced fail-fast — the same discipline as the
 *   binder's construction validation).
 */
export declare function resolveCapabilityOverlay(config: CapabilityOverlayConfig): CapabilityOverlayResolution;
/**
 * Build one facet config (the seam + its three source sets). Convenience
 * for constructing a {@link CapabilityOverlayConfig}.
 * @param seam - the facet's G2 public seam.
 * @param sources - the facet's three explicit source sets.
 */
export declare function facetConfig(seam: CapabilityFacetSeam, sources: CapabilityFacetSources): CapabilityFacetConfig;
//# sourceMappingURL=resolve.d.ts.map