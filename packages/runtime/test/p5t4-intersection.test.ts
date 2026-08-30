/**
 * p5t4-intersection — TaskDoc §11.5 must-test groups: the CORE FORMULA
 * (effective capability = available ∩ teamResolved ∩ externalHard) plus
 * tighten / external hard / capability disappear / G2 fail-closed, all
 * verified THROUGH the binder's fresh path (the P5-T1 TeamAgentBinder —
 * never isolated slot unit tests; the slot's pure resolution functions are
 * additionally exercised at unit level for their exact set semantics).
 *
 * Mock-first (ruling R28): the capability seams are {@link RecordingSeam}
 * fakes (the G2 public seam effect), the Agent setup surface is the
 * {@link FakeAgentSetupSurface} fake, the durable truth is the real P4
 * repositories over the testkit FileStorageSeam. No live Agent, no port,
 * no `node:` builtin.
 *
 * @module @dsh-agent-team/runtime/test/p5t4-intersection
 */

import { describe, expect, it } from 'vitest'

import {
  ADMISSION_OPEN_CODE,
  AGENT_SETUP_EVENT_NAMES,
  TeamAgentBinder,
} from '../agent-setup/binder/index.js'
import {
  readHandleFor,
  seedTeamWorld,
  type FakeAgentSetupSurface,
} from './p5t1-helpers.js'
import {
  CAPABILITY_FACETS,
  createCapabilityOverlaySlot,
  deriveTeamResolved,
  intersectThreeSets,
  type CapabilityFacetSources,
  type CapabilityOverlayConfig,
} from '../agent-setup/capability/index.js'
import {
  destroyDir,
  installedSlotsFor,
  makeCapabilityConfig,
  makePolicyInput,
  P5T4_BASE_SOURCES,
  wireCapabilityBinder,
  type FacetSourcesOverride,
} from './p5t4-helpers.js'

// ---------------------------------------------------------------------------
// Worlds (top-level seed; read-only to the binder; destroyed at teardown).
// ---------------------------------------------------------------------------

const worldCore = await seedTeamWorld('p5t4-core')
const worldPolicy = await seedTeamWorld('p5t4-policy')
const worldExternal = await seedTeamWorld('p5t4-external')
const worldDisappear = await seedTeamWorld('p5t4-disappear')
const worldMisc = await seedTeamWorld('p5t4-misc')

/** The base-config intersection expectations (the core-formula fixture). */
const TOOLS_EXPECTED = [
  'tool-read',
  'tool-write',
  'tool-search',
  'perm-fs-workspace',
  'perm-net-web',
]
const SKILLS_EXPECTED = ['skill-review', 'skill-test']
const MCP_EXPECTED = ['mcp-streamable-http']
const GUARDS_EXPECTED = ['guard-pre-step', 'guard-pre-execute']

/** The full fresh-path effect profile of one session (T1 contract). */
function expectFreshEffects(surface: FakeAgentSetupSurface, sessionId: string): void {
  expect(installedSlotsFor(surface, sessionId)).toEqual(['persona', 'model', 'capability'])
  expect(surface.eventsFor(sessionId)).toEqual([
    { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'persona' },
    { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'model' },
    { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'capability' },
    { name: AGENT_SETUP_EVENT_NAMES.admissionDecided, detail: ADMISSION_OPEN_CODE },
  ])
}

describe('P5-T4 core formula: effective = available ∩ teamResolved ∩ externalHard (binder fresh path)', () => {
  it('fresh root installs the three-set intersection per facet', () => {
    const { config } = makeCapabilityConfig()
    const wired = wireCapabilityBinder(worldCore, config)
    const root = worldCore.ids.rootSessionId

    const result = wired.binder.bindFreshRoot(root)

    expect(result.bound).toBe(true)
    expect(result.installed).toBe(true)
    expect(result.identity?.kind).toBe('root')
    expectFreshEffects(wired.surface, root)
    // The core formula, facet by facet: an item is effective only when it
    // is present in ALL THREE explicit source sets.
    expect(wired.seams['tools-permissions'].installed.length).toBe(1)
    expect(wired.seams['tools-permissions'].installed[0]).toEqual(TOOLS_EXPECTED)
    expect(wired.seams['skills'].installed.length).toBe(1)
    expect(wired.seams['skills'].installed[0]).toEqual(SKILLS_EXPECTED)
    expect(wired.seams['mcp'].installed.length).toBe(1)
    expect(wired.seams['mcp'].installed[0]).toEqual(MCP_EXPECTED)
    expect(wired.seams['pre-step-pre-execute'].installed.length).toBe(1)
    expect(wired.seams['pre-step-pre-execute'].installed[0]).toEqual(GUARDS_EXPECTED)
    // The slot's resolution records the same effective sets (no fault).
    const resolution = wired.slot.lastResolution
    expect(resolution === null).toBe(false)
    if (resolution !== null) {
      expect(resolution['tools-permissions'].effective).toEqual(TOOLS_EXPECTED)
      expect(resolution['mcp'].failClosed).toBe(null)
      expect(resolution['pre-step-pre-execute'].seamPassedG2).toBe(true)
    }
    expect(wired.slot.applied.length).toBe(1)
  })

  it('fresh member installs the same effective capability on the child session', () => {
    const { config } = makeCapabilityConfig()
    const wired = wireCapabilityBinder(worldCore, config)
    const child = worldCore.ids.childSessionId

    const result = wired.binder.bindFreshMember(child)

    expect(result.bound).toBe(true)
    expect(result.installed).toBe(true)
    expect(result.identity?.kind).toBe('member')
    expect(result.identity?.instanceId).toBe(worldCore.ids.instanceId)
    expectFreshEffects(wired.surface, child)
    expect(wired.seams['tools-permissions'].installed.length).toBe(1)
    expect(wired.seams['tools-permissions'].installed[0]).toEqual(TOOLS_EXPECTED)
    expect(wired.seams['pre-step-pre-execute'].installed[0]).toEqual(GUARDS_EXPECTED)
  })

  it('the intersection is order/dedup-stable and never a copy of any single side (unit)', () => {
    // available order is the output order; duplicates deduped.
    expect(intersectThreeSets(['b', 'a', 'b', 'c'], ['c', 'a', 'b'], ['a', 'b', 'c'])).toEqual(['b', 'a', 'c'])
    // an item present on exactly TWO sides is NOT effective.
    expect(intersectThreeSets(['x', 'y'], ['x'], ['y'])).toEqual([])
    // any empty side empties the intersection.
    expect(intersectThreeSets([], ['a'], ['a'])).toEqual([])
    expect(intersectThreeSets(['a'], [], ['a'])).toEqual([])
    expect(intersectThreeSets(['a'], ['a'], [])).toEqual([])
    // the fixture side-sets really are distinct (no pass-through):
    expect(P5T4_BASE_SOURCES['tools-permissions'].available).not.toEqual(TOOLS_EXPECTED)
    expect(P5T4_BASE_SOURCES['tools-permissions'].teamResolved).not.toEqual(TOOLS_EXPECTED)
  })
})

describe('P5-T4 must-test: tighten (the teamResolved side shrinks)', () => {
  it('tightening the Team policy (PolicyState pin) shrinks the effective set on re-bind', () => {
    const full = makeCapabilityConfig()
    const wired = wireCapabilityBinder(worldPolicy, full.config)
    const root = worldPolicy.ids.rootSessionId

    const e1 = wired.binder.bindFreshRoot(root)
    expect(e1.installed).toBe(true)
    expect(wired.seams['tools-permissions'].installed.length).toBe(1)
    expect(wired.seams['tools-permissions'].installed[0]).toEqual(TOOLS_EXPECTED)

    // The Agent residency is lost in-process (the durable world is intact);
    // the PolicyState then tightens: the tools cell is pinned (layer above
    // the blueprint) to `tool-read` only.
    wired.surface.dropResidency(root)
    const tightenedInput = makePolicyInput({
      policyState: {
        stateId: 'locked-validation',
        cells: { tools: { value: { kind: 'allow', items: ['tool-read'] } } },
      },
    })
    const tightenedTeam = deriveTeamResolved(tightenedInput, 'tools-permissions')
    expect(tightenedTeam).toEqual(['tool-read', 'perm-fs-workspace', 'perm-net-web'])
    const tightened = makeCapabilityConfig({
      'tools-permissions': { ...P5T4_BASE_SOURCES['tools-permissions'], teamResolved: tightenedTeam },
    })
    const slot2 = createCapabilityOverlaySlot({ config: tightened.config })
    const binder2 = new TeamAgentBinder({
      surface: wired.surface,
      teamDomain: readHandleFor(worldPolicy.domain),
      slots: { capability: slot2 },
    })

    const e2 = binder2.bindFreshRoot(root)

    expect(e2.installed).toBe(true)
    expect(tightened.seams['tools-permissions'].installed.length).toBe(1)
    expect(tightened.seams['tools-permissions'].installed[0]).toEqual([
      'tool-read',
      'perm-fs-workspace',
      'perm-net-web',
    ])
    expect(tightened.seams['tools-permissions'].installed[0]?.includes('tool-write')).toBe(false)
    expect(tightened.seams['tools-permissions'].installed[0]?.includes('tool-search')).toBe(false)
    // The tightening is scoped to the tools domain: the other facets keep
    // their full effective sets.
    expect(tightened.seams['skills'].installed[0]).toEqual(SKILLS_EXPECTED)
    expect(slot2.lastResolution?.['tools-permissions'].effective).toEqual([
      'tool-read',
      'perm-fs-workspace',
      'perm-net-web',
    ])
  })

  it('a Team deny winner contributes nothing: the facet effective set empties, no install', () => {
    // The template layer (above the blueprint) denies skills: the stage-1
    // winner is a deny — it contributes no allow items to teamResolved.
    const denyInput = makePolicyInput({ template: { values: { skills: { kind: 'deny' } } } })
    expect(deriveTeamResolved(denyInput, 'skills')).toEqual([])
    const { config } = makeCapabilityConfig({
      skills: { ...P5T4_BASE_SOURCES['skills'], teamResolved: [] },
    })
    const wired = wireCapabilityBinder(worldPolicy, config)

    const result = wired.binder.bindFreshRoot(worldPolicy.ids.rootSessionId)

    expect(result.installed).toBe(true)
    expect(wired.seams['skills'].installed.length).toBe(0)
    expect(wired.seams['tools-permissions'].installed[0]).toEqual(TOOLS_EXPECTED)
    expect(wired.slot.lastResolution?.['skills'].effective).toEqual([])
  })
})

describe('P5-T4 must-test: external hard (the host ceiling removes items)', () => {
  it('removing an item from the external hard ceiling removes it from effective', () => {
    const { config } = makeCapabilityConfig({
      'tools-permissions': {
        ...P5T4_BASE_SOURCES['tools-permissions'],
        externalHard: ['tool-read', 'tool-write', 'tool-search', 'perm-fs-workspace'],
      },
    })
    const wired = wireCapabilityBinder(worldExternal, config)

    const result = wired.binder.bindFreshRoot(worldExternal.ids.rootSessionId)

    expect(result.installed).toBe(true)
    expect(wired.seams['tools-permissions'].installed.length).toBe(1)
    expect(wired.seams['tools-permissions'].installed[0]).toEqual([
      'tool-read',
      'tool-write',
      'tool-search',
      'perm-fs-workspace',
    ])
    expect(wired.seams['tools-permissions'].installed[0]?.includes('perm-net-web')).toBe(false)
    expect(wired.seams['skills'].installed[0]).toEqual(SKILLS_EXPECTED)
  })

  it('an empty external hard ceiling empties the facet; the bind still succeeds', () => {
    const { config } = makeCapabilityConfig({
      'tools-permissions': { ...P5T4_BASE_SOURCES['tools-permissions'], externalHard: [] },
    })
    const wired = wireCapabilityBinder(worldExternal, config)

    const result = wired.binder.bindFreshRoot(worldExternal.ids.rootSessionId)

    expect(result.installed).toBe(true)
    expect(wired.seams['tools-permissions'].installed.length).toBe(0)
    expect(wired.seams['mcp'].installed[0]).toEqual(MCP_EXPECTED)
    expect(wired.slot.lastResolution?.['tools-permissions'].effective).toEqual([])
  })
})

describe('P5-T4 must-test: capability disappear (the available side degrades gracefully)', () => {
  it('a capability that disappears from the substrate drops out of effective (no fault)', () => {
    const { config } = makeCapabilityConfig({
      'tools-permissions': {
        ...P5T4_BASE_SOURCES['tools-permissions'],
        available: ['tool-read', 'tool-write', 'perm-fs-workspace', 'perm-net-web', 'tool-ghost'],
      },
    })
    const wired = wireCapabilityBinder(worldDisappear, config)

    const result = wired.binder.bindFreshRoot(worldDisappear.ids.rootSessionId)

    expect(result.installed).toBe(true)
    expect(wired.seams['tools-permissions'].installed.length).toBe(1)
    expect(wired.seams['tools-permissions'].installed[0]).toEqual([
      'tool-read',
      'tool-write',
      'perm-fs-workspace',
      'perm-net-web',
    ])
    expect(wired.seams['tools-permissions'].installed[0]?.includes('tool-search')).toBe(false)
    // A disappear is a normal resolution, not a fail-closed fault.
    expect(wired.slot.lastResolution?.['tools-permissions'].failClosed).toBe(null)
  })

  it('a facet whose capabilities ALL disappeared installs nothing; the binder does not crash', () => {
    const { config } = makeCapabilityConfig({
      mcp: { ...P5T4_BASE_SOURCES['mcp'], available: [] },
    })
    const wired = wireCapabilityBinder(worldDisappear, config)

    const result = wired.binder.bindFreshRoot(worldDisappear.ids.rootSessionId)

    expect(result.bound).toBe(true)
    expect(result.installed).toBe(true)
    expect(wired.seams['mcp'].installed.length).toBe(0)
    expect(wired.seams['tools-permissions'].installed[0]).toEqual(TOOLS_EXPECTED)
    expect(wired.seams['pre-step-pre-execute'].installed[0]).toEqual(GUARDS_EXPECTED)
    expect(wired.slot.lastResolution?.['mcp'].effective).toEqual([])
  })
})

describe('P5-T4 G2 discipline: a seam that did not pass G2 fails closed (no private workaround)', () => {
  it('a G2-unexposed facet installs nothing (seam never touched) while the bind succeeds', () => {
    // The MCP facet's public seam is NOT exposed in this substrate:
    // `available: false` — the adapter must deny the whole facet and must
    // never fabricate a private registry or bypass path.
    const { config } = makeCapabilityConfig({}, ['mcp'])
    const wired = wireCapabilityBinder(worldDisappear, config)

    const result = wired.binder.bindFreshRoot(worldDisappear.ids.rootSessionId)

    expect(result.bound).toBe(true)
    expect(result.installed).toBe(true)
    // The fail-closed facet: effective empty, nothing installed, no bypass.
    expect(wired.seams['mcp'].installed.length).toBe(0)
    expect(wired.slot.lastResolution?.['mcp'].seamPassedG2).toBe(false)
    expect(wired.slot.lastResolution?.['mcp'].failClosed).toBe('seam-not-g2')
    expect(wired.slot.lastResolution?.['mcp'].effective).toEqual([])
    // The other facets (G2-passed seams) are unaffected: the failure is
    // scoped to the unexposed facet only.
    expect(wired.seams['tools-permissions'].installed[0]).toEqual(TOOLS_EXPECTED)
    expect(wired.seams['skills'].installed[0]).toEqual(SKILLS_EXPECTED)
    expect(wired.seams['pre-step-pre-execute'].installed[0]).toEqual(GUARDS_EXPECTED)
  })
})

describe('P5-T4 policy integration: teamResolved through the policy resolver (full chain)', () => {
  it('deriveTeamResolved derives the facet sets from the stage-1 Team winner (unit)', () => {
    const input = makePolicyInput()
    // tools-permissions = the union of the tools + permissions domains, in
    // canonical domain order (tools before permissions).
    expect(deriveTeamResolved(input, 'tools-permissions')).toEqual(TOOLS_EXPECTED)
    expect(deriveTeamResolved(input, 'skills')).toEqual(SKILLS_EXPECTED)
    expect(deriveTeamResolved(input, 'mcp')).toEqual(MCP_EXPECTED)
    // The guard facet has NO policy domain: its teamResolved set is
    // injected directly (never derived from policy).
    expect(deriveTeamResolved(input, 'pre-step-pre-execute')).toEqual([])
  })

  it('the policy-derived teamResolved drives the binder fresh install (policy → resolver → formula → seam)', () => {
    const input = makePolicyInput()
    const overrides: FacetSourcesOverride = {}
    for (const facet of CAPABILITY_FACETS) {
      if (facet === 'pre-step-pre-execute') {
        // No policy domain: inject the team admission set directly.
        overrides[facet] = P5T4_BASE_SOURCES[facet]
      } else {
        overrides[facet] = {
          ...P5T4_BASE_SOURCES[facet],
          teamResolved: deriveTeamResolved(input, facet),
        }
      }
    }
    const { config } = makeCapabilityConfig(overrides)
    const wired = wireCapabilityBinder(worldPolicy, config)

    const result = wired.binder.bindFreshRoot(worldPolicy.ids.rootSessionId)

    expect(result.installed).toBe(true)
    expect(wired.seams['tools-permissions'].installed[0]).toEqual(TOOLS_EXPECTED)
    expect(wired.seams['skills'].installed[0]).toEqual(SKILLS_EXPECTED)
    expect(wired.seams['mcp'].installed[0]).toEqual(MCP_EXPECTED)
    expect(wired.seams['pre-step-pre-execute'].installed[0]).toEqual(GUARDS_EXPECTED)
    // The slot resolution records the policy-derived source set verbatim.
    expect(wired.slot.lastResolution?.['tools-permissions'].teamResolved).toEqual(TOOLS_EXPECTED)
    expect(wired.slot.lastResolution?.['mcp'].teamResolved).toEqual(MCP_EXPECTED)
  })
})

describe('P5-T4 binder-level edge behavior (ordinary no-op, idempotent re-drive, fail-fast config)', () => {
  it('an ordinary session is a no-effect no-op (the capability seams are untouched)', () => {
    const { config } = makeCapabilityConfig()
    const wired = wireCapabilityBinder(worldMisc, config)
    const ordinary = worldMisc.ids.ordinarySessionId

    const result = wired.binder.bindFreshRoot(ordinary)

    expect(result.bound).toBe(false)
    expect(result.installed).toBe(false)
    expect(result.noopReason).toBe('ordinary')
    expect(wired.seams['tools-permissions'].installed.length).toBe(0)
    expect(wired.seams['skills'].installed.length).toBe(0)
    expect(wired.seams['mcp'].installed.length).toBe(0)
    expect(wired.seams['pre-step-pre-execute'].installed.length).toBe(0)
    expect(wired.slot.applied.length).toBe(0)
    expect(wired.slot.lastResolution === null).toBe(true)
  })

  it('a re-drive after residency loss converges to the same effective set (idempotent apply)', () => {
    const { config } = makeCapabilityConfig()
    const wired = wireCapabilityBinder(worldMisc, config)
    const root = worldMisc.ids.rootSessionId

    expect(wired.binder.bindFreshRoot(root).installed).toBe(true)
    // The Agent residency is lost; the same binder re-drives the fresh path
    // (same slot, same config): the resolution is a pure function of the
    // config, so the re-install converges to the identical effective set.
    wired.surface.dropResidency(root)
    expect(wired.binder.bindFreshRoot(root).installed).toBe(true)

    const calls = wired.seams['tools-permissions'].installed
    expect(calls.length).toBe(2)
    expect(calls[1]).toEqual(calls[0])
    expect(calls[0]).toEqual(TOOLS_EXPECTED)
    expect(wired.slot.applied.length).toBe(2)
  })

  it('a malformed capability config fails fast at construction (TypeError)', () => {
    const malformed = {} as CapabilityOverlayConfig['facets']
    expect(() => createCapabilityOverlaySlot({ config: { facets: malformed } })).toThrow(TypeError)
    const { config } = makeCapabilityConfig()
    const broken: CapabilityOverlayConfig = {
      facets: {
        ...config.facets,
        skills: {
          seam: config.facets.skills.seam,
          sources: { available: null, teamResolved: [], externalHard: [] } as unknown as CapabilityFacetSources,
        },
      },
    }
    expect(() => createCapabilityOverlaySlot({ config: broken })).toThrow(TypeError)
  })
})

// ---------------------------------------------------------------------------
// Teardown (module level, the p5t1 convention).
// ---------------------------------------------------------------------------

destroyDir(worldCore.scratchDir)
destroyDir(worldPolicy.scratchDir)
destroyDir(worldExternal.scratchDir)
destroyDir(worldDisappear.scratchDir)
destroyDir(worldMisc.scratchDir)
