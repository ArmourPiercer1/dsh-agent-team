/**
 * p5t4-helpers — shared fixtures and fakes for the P5-T4 (capability /
 * guard adapters) tests (TaskDoc §11.5 must-test groups: tighten /
 * external hard / capability disappear / cold resume).
 *
 * Contents:
 *
 * - {@link RecordingSeam} — the mock-first `CapabilityFacetSeam`: records
 *   every `install` call (the public-seam effect evidence); `available`
 *   flags the G2 state of the facet's public seam (a G2-not-passed seam is
 *   constructed with `available: false` — the fail-closed case);
 * - {@link P5T4_BASE_SOURCES} — the fixture three-source sets per facet
 *   (the `available` order is the canonical intersection order; each set
 *   carries at least one item that is missing on the other sides, so the
 *   three-way intersection is observable, not a pass-through);
 * - {@link makeCapabilityConfig} — builds a fresh
 *   {@link CapabilityOverlayConfig} + its recording seams (with per-facet
 *   source overrides and/or G2-unexposed facets);
 * - {@link makePolicyInput} — the baseline pure policy-resolver input
 *   (frozen contracts v1 branded ids, matching the P5-T1 fixture);
 * - {@link bindCapabilityWorld} — seeds one durable TeamDomain world and
 *   wires the capability slot into a NEW `TeamAgentBinder` over a NEW
 *   `FakeAgentSetupSurface` (the overlay behavior is always verified
 *   THROUGH the binder, fresh or cold — never as an isolated slot unit).
 *
 * Test-only module (no `.test.ts` suffix): never imported by production
 * code. No live Agent, no port, no `node:` builtin (ruling: mock-first).
 * @module @dsh-agent-team/runtime/test/p5t4-helpers
 */

import { TeamAgentBinder } from '../agent-setup/binder/index.js'
import type { OverlaySlotName, RestoredScope } from '../agent-setup/binder/index.js'
import {
  createCapabilityOverlaySlot,
  facetConfig,
  CAPABILITY_FACETS,
  type CapabilityFacet,
  type CapabilityFacetSeam,
  type CapabilityFacetSources,
  type CapabilityOverlayConfig,
  type CapabilityOverlaySlot,
} from '../agent-setup/capability/index.js'
import {
  createMemberIdentity,
  parseInstanceId,
  parseRootSessionId,
  parseTeamSessionId,
  type BlueprintPolicyEnvelope,
  type EffectivePolicyInput,
  type ExternalPolicyFacts,
  type PolicyStateView,
  type TemplatePolicy,
} from '../../domain/policy/src/index.js'
import {
  FakeAgentSetupSurface,
  P5T1_FIXTURE,
  readHandleFor,
  seedTeamWorld,
  type P5T1World,
} from './p5t1-helpers.js'
import { destroyDir } from '../../testkit/fault-injection/file-seam.mjs'

/**
 * The mock-first `CapabilityFacetSeam` (ruling R28: mock-first): records
 * every `install` call in `installed` (a call that throws is not recorded
 * — the effect did not happen); `available` flags the G2 state of the
 * facet's public seam (the G2-not-passed case is `available: false`).
 */
export class RecordingSeam implements CapabilityFacetSeam {
  readonly available: boolean
  /** Every completed `install` call, in order (the seam-effect evidence). */
  readonly installed: string[][] = []

  constructor(available: boolean = true) {
    this.available = available
  }

  install(items: readonly string[]): void {
    this.installed.push([...items])
  }
}

/**
 * The fixture three-source sets per facet. Each facet's sets are DELIBERATELY
 * distinct: the `available` side carries an item the Team policy did not
 * grant, the `teamResolved` side carries an item the substrate does not
 * provide (or the host ceiling removed), so the effective set is the real
 * three-way intersection (never a copy of any single side).
 */
export const P5T4_BASE_SOURCES: Record<CapabilityFacet, CapabilityFacetSources> = {
  'tools-permissions': {
    available: [
      'tool-read',
      'tool-write',
      'tool-search',
      'perm-fs-workspace',
      'perm-net-web',
      'tool-ghost',
    ],
    teamResolved: [
      'tool-read',
      'tool-write',
      'tool-search',
      'perm-fs-workspace',
      'perm-net-web',
      'perm-ghost',
    ],
    externalHard: [
      'tool-read',
      'tool-write',
      'tool-search',
      'perm-fs-workspace',
      'perm-net-web',
    ],
  },
  'skills': {
    available: ['skill-review', 'skill-test', 'skill-ghost'],
    teamResolved: ['skill-review', 'skill-test'],
    externalHard: ['skill-review', 'skill-test'],
  },
  'mcp': {
    available: ['mcp-streamable-http', 'mcp-sse'],
    teamResolved: ['mcp-streamable-http'],
    externalHard: ['mcp-streamable-http', 'mcp-sse'],
  },
  'pre-step-pre-execute': {
    available: ['guard-pre-step', 'guard-pre-execute'],
    teamResolved: ['guard-pre-step', 'guard-pre-execute'],
    externalHard: ['guard-pre-step', 'guard-pre-execute'],
  },
}

/** Per-facet source overrides (a facet left out keeps its base sources). */
export type FacetSourcesOverride = Partial<Record<CapabilityFacet, CapabilityFacetSources>>

export interface CapabilityConfigBundle {
  /** The built config (a fresh seam instance per facet). */
  readonly config: CapabilityOverlayConfig
  /** The fresh recording seams, keyed by facet (the effect evidence). */
  readonly seams: Record<CapabilityFacet, RecordingSeam>
}

/**
 * Build a fresh capability overlay config + its recording seams.
 *
 * @param overrides - per-facet replacement source sets (default: the base
 *   fixture sets).
 * @param unexposed - the facets whose G2 public seam is NOT exposed in the
 *   substrate (`seam.available === false` → the fail-closed case).
 */
export function makeCapabilityConfig(
  overrides: FacetSourcesOverride = {},
  unexposed: readonly CapabilityFacet[] = [],
): CapabilityConfigBundle {
  const seams = {} as Record<CapabilityFacet, RecordingSeam>
  const facets = {} as CapabilityOverlayConfig['facets']
  for (const facet of CAPABILITY_FACETS) {
    const sources = overrides[facet] ?? P5T4_BASE_SOURCES[facet]
    const seam = new RecordingSeam(!unexposed.includes(facet))
    seams[facet] = seam
    facets[facet] = facetConfig(seam, sources)
  }
  return { config: { facets }, seams }
}

export interface PolicyInputOverrides {
  readonly blueprint?: Partial<BlueprintPolicyEnvelope>
  readonly template?: Partial<TemplatePolicy>
  readonly policyState?: Partial<PolicyStateView>
  readonly external?: Partial<ExternalPolicyFacts>
}

/**
 * The baseline pure policy-resolver input (one member of the P5-T1 fixture
 * TeamSession): the blueprint grants tools + permissions + skills + MCP
 * (the `teamResolved` derivation's happy path). The member identity is the
 * frozen contracts v1 branded ids (parsed at the policy boundary).
 */
export function makePolicyInput(overrides: PolicyInputOverrides = {}): EffectivePolicyInput {
  const rootSessionId = parseRootSessionId(String(P5T1_FIXTURE.rootSessionId))
  return {
    teamSessionId: parseTeamSessionId(String(P5T1_FIXTURE.rootSessionId)),
    member: createMemberIdentity(rootSessionId, parseInstanceId(String(P5T1_FIXTURE.instanceId))),
    blueprint: {
      values: {
        tools: { kind: 'allow', items: ['tool-read', 'tool-write', 'tool-search'] },
        permissions: { kind: 'allow', items: ['perm-fs-workspace', 'perm-net-web'] },
        skills: { kind: 'allow', items: ['skill-review', 'skill-test'] },
        mcp: { kind: 'allow', items: ['mcp-streamable-http'] },
      },
      ...(overrides.blueprint ?? {}),
    },
    template: { ...(overrides.template ?? {}) },
    policyState: { stateId: 'default', ...(overrides.policyState ?? {}) },
    external: { hard: {}, capabilityExists: {}, ...(overrides.external ?? {}) },
  }
}

export interface P5T4Wire {
  /** The mock-first surface the binder drives (call / event evidence). */
  readonly surface: FakeAgentSetupSurface
  /** The capability slot installed in the binder (observability surface). */
  readonly slot: CapabilityOverlaySlot
  /** The binder (the overlay behavior under test). */
  readonly binder: TeamAgentBinder
  /** The slot's recording seams, keyed by facet. */
  readonly seams: Record<CapabilityFacet, RecordingSeam>
}

/**
 * Wire the capability slot into a FRESH binder over a FRESH mock-first
 * surface (the P5-T1 shared fakes) on top of an already-seeded durable
 * world: the binder is the system under test — every assertion about
 * overlay behavior goes through its four bind paths. A fresh binder +
 * fresh surface per test keeps the tests independent (the world itself is
 * read-only to the binder).
 *
 * @param world - the seeded durable world (the durable truth).
 * @param config - the capability overlay config (its seams are the effect
 *   evidence; pass a {@link makeCapabilityConfig} bundle).
 */
export function wireCapabilityBinder(world: P5T1World, config: CapabilityOverlayConfig): P5T4Wire {
  const surface = new FakeAgentSetupSurface()
  const slot = createCapabilityOverlaySlot({ config })
  const binder = new TeamAgentBinder({
    surface,
    teamDomain: readHandleFor(world.domain),
    slots: { capability: slot },
  })
  const seams = {} as Record<CapabilityFacet, RecordingSeam>
  for (const facet of CAPABILITY_FACETS) {
    const seam = config.facets[facet].seam
    if (!(seam instanceof RecordingSeam)) {
      throw new TypeError('wireCapabilityBinder requires RecordingSeam seams (use makeCapabilityConfig)')
    }
    seams[facet] = seam
  }
  return { surface, slot, binder, seams }
}

export interface P5T4World {
  /** The seeded durable world (destroy `world.scratchDir` at teardown). */
  readonly world: P5T1World
  /** The mock-first surface the binder drives (call / event evidence). */
  readonly surface: FakeAgentSetupSurface
  /** The capability slot installed in the binder (observability surface). */
  readonly slot: CapabilityOverlaySlot
  /** The binder (the overlay behavior under test). */
  readonly binder: TeamAgentBinder
  /** The config the slot was constructed with. */
  readonly config: CapabilityOverlayConfig
  /** The slot's recording seams, keyed by facet. */
  readonly seams: Record<CapabilityFacet, RecordingSeam>
}

/**
 * Seed one durable TeamDomain world and wire the capability slot into a
 * FRESH binder over a FRESH mock-first surface.
 *
 * @param basename - the scratch dir basename (unique per test).
 * @param config - the capability overlay config.
 */
export async function bindCapabilityWorld(
  basename: string,
  config: CapabilityOverlayConfig,
): Promise<P5T4World> {
  const world = await seedTeamWorld(basename)
  const { surface, slot, binder, seams } = wireCapabilityBinder(world, config)
  return { world, surface, slot, binder, config, seams }
}

/** The installed-slot ids recorded for one session (fresh-path installs). */
export function installedSlotsFor(
  surface: FakeAgentSetupSurface,
  sessionId: string,
): readonly OverlaySlotName[] {
  return surface.calls
    .filter((call) => call.method === 'installOverlay' && call.sessionId === sessionId)
    .map((call) => call.slot as OverlaySlotName)
}

/** The restored scopes recorded for one session (cold-path restores). */
export function restoredScopesFor(
  surface: FakeAgentSetupSurface,
  sessionId: string,
): readonly RestoredScope[] {
  return surface.calls
    .filter((call) => call.method === 'restoreScope' && call.sessionId === sessionId)
    .map((call) => call.scope as RestoredScope)
}

export { destroyDir }
