/**
 * The policy-resolver bridge of the capability overlay (TaskDoc §11.5
 * P5-T4; DevPlan §18.1).
 *
 * This module is the "resolved" half of the capability adapter: it derives
 * the `teamResolved` SOURCE SET of a facet from the Team-domain policy
 * through the PURE policy resolver (the P3-T4 `resolveEffectivePolicy`,
 * Architecture §19.6 stage 1). The policy resolver is the P5-T4 ALLOWED
 * dependency ("policy resolver + public seams only"); this module is the
 * ONLY place the capability overlay touches it.
 *
 * Mapping (facet → policy capability domains):
 *
 * - `tools-permissions` → the `tools` + `permissions` cells;
 * - `skills` → the `skills` cell;
 * - `mcp` → the `mcp` cell;
 * - `pre-step-pre-execute` → NO policy domain (the guard facet is an
 *   admission-control surface, not a policy cell; its `teamResolved` set
 *   is injected directly).
 *
 * Semantics (frozen, mirroring the policy resolver):
 *
 * - the `teamResolved` set for a facet is the UNION of the stage-1 Team
 *   resolution winner VALUE (`cell.team.value`) of the facet's domains,
 *   restricted to `allow` entries (their item lists). A `deny` winner or an
 *   `unspecified` cell (no Team layer granted the cell — the Team domain
 *   fails closed) contributes NOTHING (the Team denies that domain);
 * - the resolver runs in the Team domain BEFORE materialization (invariant
 *   33); this bridge never re-resolves or overrides the external stage —
 *   the `externalHard` set is the caller's explicit source (the host
 *   ceiling), intersected by the core formula, never bypassed;
 * - the derivation is PURE and deterministic (a function of the policy
 *   input); no I/O, no ambient state.
 *
 * Pure module: no I/O, no live Agent, no `node:` builtin.
 * @module @dsh-agent-team/runtime/agent-setup/capability/policy-sources
 */
import type { CapabilityName, EffectivePolicyInput } from '../../../domain/policy/src/index.js';
import type { CapabilityFacet } from './types.js';
/**
 * The policy capability domains each facet resolves over (the facet →
 * domain map). The guard facet maps to NO domain (it is not a policy cell).
 */
export declare const FACET_POLICY_DOMAINS: Record<CapabilityFacet, readonly CapabilityName[]>;
/**
 * Derive the `teamResolved` SOURCE SET of one facet from the Team-domain
 * policy (via the policy resolver's stage-1 resolution).
 *
 * @param input - the complete pure-resolver input (one member of one
 *   TeamSession; the policy resolver is pure and stateless).
 * @param facet - the facet whose `teamResolved` set is derived.
 * @returns the facet's `teamResolved` item set (the union of the stage-1
 *   `allow` winner values of the facet's domains, in canonical domain
 *   order, deduplicated). Empty when the facet has no policy domain
 *   (the guard facet) or the Team policy denies / leaves unspecified every
 *   one of the facet's domains.
 */
export declare function deriveTeamResolved(input: EffectivePolicyInput, facet: CapabilityFacet): string[];
//# sourceMappingURL=policy-sources.d.ts.map