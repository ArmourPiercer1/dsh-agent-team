/**
 * P3-T4 — EXHAUSTIVE precedence matrix for the pure policy resolver.
 *
 * Implements the TaskDoc P3-T4 "must test: precedence exhaustive matrix":
 *
 * 1. **Solo winner** — every Team layer ({@link TEAM_LAYER_ORDER}:
 *    blueprint < policyState < template < templateOverlay < instanceOverlay
 *    < humanOverride) × every capability, as the ONLY layer with a value:
 *    assert the winner layer, its provenance origin, its record id, and the
 *    effective value. Human override is exercised in BOTH scopes
 *    (`team`, `instance`); the instance overlay in BOTH origins
 *    (`member`, leader-authorized `leader`).
 * 2. **Pairwise conflict** — every ordered layer pair (hi > lo) × every
 *    capability, both layers `allow`: the higher layer wins and the lower
 *    one is recorded in `overriddenLower` with full provenance.
 * 3. **Deny above** — every pair × every capability: a higher `deny` beats
 *    a lower `allow` (deny wins from above).
 * 4. **Relaxation** — every pair × every capability: a higher `allow`
 *    lawfully RELAXES a lower `deny` (§19.6 anti-pattern: no monotonic
 *    restriction materialization; invariant 34).
 * 5. **External hard** — every capability × the external fact combinations
 *    (hard unspecified / deny / allow-subset / allow-disjoint, capability
 *    missing, missing+deny note precedence, team-deny): the external stage
 *    is un-bypassable — even the strongest Team layer (the human override)
 *    cannot win against it (invariant 34, invariant 35, §25.4).
 *
 * All agent overlays are kept in-envelope here (escalation failures are
 * the negative-test file's concern); this file isolates PRECEDENCE.
 * Self-contained: only the audited shim surface (toBe / toEqual /
 * toBeGreaterThan / toThrow + .not).
 */

import { describe, expect, it } from 'vitest'

import {
  createMemberIdentity,
  parseInstanceId,
  parseRootSessionId,
  parseTeamSessionId,
} from '../policy/src/contracts-mirror.js'
import {
  CAPABILITY_NAME_VALUES,
  TEAM_LAYER_ORDER,
  resolveEffectivePolicy,
} from '../policy/src/index.js'
import type {
  CapabilityName,
  EffectivePolicy,
  EffectivePolicyInput,
  ExternalCellFacts,
  OverriddenTeamLayer,
  PolicyEntry,
  TeamLayer,
  TeamLayerOrUnspecified,
  TeamValueOrigin,
} from '../policy/src/index.js'

// --- fixtures ------------------------------------------------------------------

const ROOT = parseRootSessionId('session-root-1')
const TEAM = parseTeamSessionId('session-root-1')
const MEMBER = createMemberIdentity(ROOT, parseInstanceId('inst-a'))

function allow(items: string[]): PolicyEntry {
  return { kind: 'allow', items }
}
function deny(): PolicyEntry {
  return { kind: 'deny' }
}

/** The default (empty) resolver input; callers override per case. */
function baseInput(partial: Partial<EffectivePolicyInput> = {}): EffectivePolicyInput {
  return {
    teamSessionId: TEAM,
    member: MEMBER,
    blueprint: {},
    template: {},
    policyState: { stateId: 'default' },
    external: { hard: {}, capabilityExists: {} },
    ...partial,
  }
}

interface LayerOptions {
  /** Overlay origin (overlay layers only). Defaults: leader / member. */
  origin?: 'leader' | 'member'
  /** Human override scope (humanOverride layer only). Default: team. */
  scope?: 'team' | 'instance'
}

/** The distinct item a layer contributes (keeps pairwise winners distinct). */
function itemFor(layer: TeamLayer): string {
  return `item-${layer}`
}

/** Expected provenance origin for a layer's contribution (with defaults). */
function originFor(layer: TeamLayer, options: LayerOptions = {}): TeamValueOrigin {
  switch (layer) {
    case 'blueprint':
    case 'policyState':
    case 'template':
      return 'static'
    case 'templateOverlay':
      return options.origin ?? 'leader'
    case 'instanceOverlay':
      return options.origin ?? 'member'
    case 'humanOverride':
      return 'human'
    default: {
      const exhaustive: never = layer
      throw new Error(`unhandled layer ${String(exhaustive)}`)
    }
  }
}

/** Expected record id for a layer's contribution (static layers: null). */
function recordIdFor(layer: TeamLayer): string | null {
  switch (layer) {
    case 'templateOverlay':
      return 'ov-tpl-1'
    case 'instanceOverlay':
      return 'ov-ins-1'
    case 'humanOverride':
      return 'ovh-1'
    case 'blueprint':
    case 'policyState':
    case 'template':
      return null
    default: {
      const exhaustive: never = layer
      throw new Error(`unhandled layer ${String(exhaustive)}`)
    }
  }
}

/**
 * One layer's contribution to the input. Overlay contributions also carry
 * a agreeing blueprint/template envelope that grants exactly the
 * contributed items (+ one spare), so every contribution stays in-envelope.
 */
function layerContribution(
  layer: TeamLayer,
  cap: CapabilityName,
  entry: PolicyEntry,
  options: LayerOptions = {},
): Partial<EffectivePolicyInput> {
  const items = entry.kind === 'allow' ? entry.items : []
  const envelopeEntry = allow([...items, 'envelope-spare'])
  switch (layer) {
    case 'blueprint':
      return { blueprint: { values: { [cap]: entry } } }
    case 'policyState':
      return { policyState: { stateId: 'default', cells: { [cap]: { value: entry } } } }
    case 'template':
      return { template: { values: { [cap]: entry } } }
    case 'templateOverlay':
      return {
        blueprint: { autonomyEnvelope: { [cap]: envelopeEntry } },
        template: { mutationEnvelope: { [cap]: envelopeEntry } },
        templateOverlay: {
          overlayId: 'ov-tpl-1',
          kind: 'template',
          origin: options.origin ?? 'leader',
          values: { [cap]: entry },
        },
      }
    case 'instanceOverlay':
      return {
        blueprint: { autonomyEnvelope: { [cap]: envelopeEntry } },
        template: { mutationEnvelope: { [cap]: envelopeEntry } },
        instanceOverlay: {
          overlayId: 'ov-ins-1',
          kind: 'instance',
          origin: options.origin ?? 'member',
          values: { [cap]: entry },
        },
      }
    case 'humanOverride':
      return {
        humanOverride: {
          overrideId: 'ovh-1',
          scope: options.scope ?? 'team',
          values: { [cap]: entry },
        },
      }
    default: {
      const exhaustive: never = layer
      throw new Error(`unhandled layer ${String(exhaustive)}`)
    }
  }
}

/**
 * Union-merge two per-capability envelope maps (both layers' overlays must
 * stay in-envelope when both are overlays on the same capability).
 */
function mergeEnvelopeMap(
  base: Partial<Record<CapabilityName, PolicyEntry>> | undefined,
  partial: Partial<Record<CapabilityName, PolicyEntry>> | undefined,
): Partial<Record<CapabilityName, PolicyEntry>> | undefined {
  if (base === undefined && partial === undefined) return undefined
  const out: Partial<Record<CapabilityName, PolicyEntry>> = { ...(base ?? {}) }
  for (const [cap, entry] of Object.entries(partial ?? {})) {
    const existing = out[cap as CapabilityName]
    if (entry !== undefined && entry.kind === 'allow' && existing !== undefined && existing.kind === 'allow') {
      const items = [...existing.items]
      for (const item of entry.items) {
        if (!items.includes(item)) items.push(item)
      }
      out[cap as CapabilityName] = { kind: 'allow', items }
    } else if (entry !== undefined) {
      out[cap as CapabilityName] = entry
    }
  }
  return out
}

/** Merge one layer contribution into an input (per-layer field merge). */
function withContribution(
  base: EffectivePolicyInput,
  partial: Partial<EffectivePolicyInput>,
): EffectivePolicyInput {
  return {
    ...base,
    blueprint: {
      values: { ...base.blueprint.values, ...partial.blueprint?.values },
      autonomyEnvelope: mergeEnvelopeMap(base.blueprint.autonomyEnvelope, partial.blueprint?.autonomyEnvelope),
    },
    template: {
      values: { ...base.template.values, ...partial.template?.values },
      mutationEnvelope: mergeEnvelopeMap(base.template.mutationEnvelope, partial.template?.mutationEnvelope),
    },
    policyState:
      partial.policyState === undefined
        ? base.policyState
        : { stateId: partial.policyState.stateId, cells: { ...base.policyState.cells, ...partial.policyState.cells } },
    templateOverlay: partial.templateOverlay ?? base.templateOverlay,
    instanceOverlay: partial.instanceOverlay ?? base.instanceOverlay,
    humanOverride: partial.humanOverride ?? base.humanOverride,
    external: partial.external ?? base.external,
  }
}

function soloInput(layer: TeamLayer, cap: CapabilityName, entry: PolicyEntry, options?: LayerOptions): EffectivePolicyInput {
  return withContribution(baseInput(), layerContribution(layer, cap, entry, options))
}

function pairInput(
  hi: TeamLayer,
  lo: TeamLayer,
  cap: CapabilityName,
  hiEntry: PolicyEntry,
  loEntry: PolicyEntry,
): EffectivePolicyInput {
  return withContribution(
    withContribution(baseInput(), layerContribution(lo, cap, loEntry)),
    layerContribution(hi, cap, hiEntry),
  )
}

// --- assertion helpers -----------------------------------------------------------

interface CellExpectation {
  layer: TeamLayerOrUnspecified
  origin: TeamValueOrigin
  recordId: string | null
  /** The expected effective entry (stage 2 result). */
  entry: PolicyEntry
  /** The expected team-winner CLAIM (defaults to `entry`; stage 2 may reduce it). */
  teamValue?: PolicyEntry
  /** Exact overriddenLower (ascending), asserted when provided. */
  overriddenLower?: OverriddenTeamLayer[]
  note?: ExternalCellFacts['note']
  removedItems?: string[]
  capabilityExists?: boolean
  hard?: ExternalCellFacts['hard']
}

/** Assert one resolved cell against the full expectation. */
function expectCell(out: EffectivePolicy, cap: CapabilityName, exp: CellExpectation): void {
  const cell = out.cells[cap]
  expect(cell.capability).toBe(cap)
  expect(cell.effective).toEqual(exp.entry)
  expect(cell.team.layer).toBe(exp.layer)
  expect(cell.team.origin).toBe(exp.origin)
  expect(cell.team.recordId).toBe(exp.recordId)
  expect(cell.team.value).toEqual(exp.teamValue ?? (exp.layer === 'unspecified' ? { kind: 'deny' } : exp.entry))
  expect(cell.team.suppressed).toEqual([])
  if (exp.overriddenLower !== undefined) {
    expect(cell.team.overriddenLower).toEqual(exp.overriddenLower)
  }
  if (exp.note !== undefined) {
    expect(cell.external.note).toBe(exp.note)
  }
  if (exp.removedItems !== undefined) {
    expect(cell.external.removedItems).toEqual(exp.removedItems)
  }
  if (exp.capabilityExists !== undefined) {
    expect(cell.external.capabilityExists).toBe(exp.capabilityExists)
  }
  if (exp.hard !== undefined) {
    expect(cell.external.hard).toEqual(exp.hard)
  }
  expect(cell.explanation.length).toBeGreaterThan(0)
}

/** The losing record of a lower layer in a two-layer cell. */
function lowerRecord(layer: TeamLayer, entry: PolicyEntry): OverriddenTeamLayer {
  return { layer, origin: originFor(layer), recordId: recordIdFor(layer), value: entry }
}

// --- 1. solo winner matrix -------------------------------------------------------

describe('P3-T4 matrix: solo winner (layer x capability)', () => {
  it('every layer alone wins its cell with the right provenance (6 layers x 5 capabilities)', () => {
    for (const layer of TEAM_LAYER_ORDER) {
      for (const cap of CAPABILITY_NAME_VALUES) {
        const entry = allow([itemFor(layer)])
        const out = resolveEffectivePolicy(soloInput(layer, cap, entry))
        expectCell(out, cap, {
          layer,
          origin: originFor(layer),
          recordId: recordIdFor(layer),
          entry,
          overriddenLower: [],
          note: 'none',
          removedItems: [],
          capabilityExists: true,
          hard: 'unspecified',
        })
      }
    }
  })

  it('human override wins in BOTH scopes (team and instance) x 5 capabilities', () => {
    for (const scope of ['team', 'instance'] as const) {
      for (const cap of CAPABILITY_NAME_VALUES) {
        const entry = allow([`human-${scope}`])
        const out = resolveEffectivePolicy(soloInput('humanOverride', cap, entry, { scope }))
        expectCell(out, cap, {
          layer: 'humanOverride',
          origin: 'human',
          recordId: 'ovh-1',
          entry,
          overriddenLower: [],
        })
      }
    }
  })

  it('instance overlay wins in BOTH origins (member and leader) x 5 capabilities', () => {
    for (const origin of ['member', 'leader'] as const) {
      for (const cap of CAPABILITY_NAME_VALUES) {
        const entry = allow([`instance-${origin}`])
        const out = resolveEffectivePolicy(soloInput('instanceOverlay', cap, entry, { origin }))
        expectCell(out, cap, {
          layer: 'instanceOverlay',
          origin,
          recordId: 'ov-ins-1',
          entry,
          overriddenLower: [],
        })
      }
    }
  })
})

// --- 2/3/4. pairwise matrices ----------------------------------------------------

describe('P3-T4 matrix: pairwise conflicts (every ordered pair x capability)', () => {
  it('higher allow beats lower allow: winner + overriddenLower provenance (15 pairs x 5 capabilities)', () => {
    for (let hi = 1; hi < TEAM_LAYER_ORDER.length; hi++) {
      for (let lo = 0; lo < hi; lo++) {
        const hiLayer = TEAM_LAYER_ORDER[hi]!
        const loLayer = TEAM_LAYER_ORDER[lo]!
        const hiEntry = allow([itemFor(hiLayer)])
        const loEntry = allow([itemFor(loLayer)])
        for (const cap of CAPABILITY_NAME_VALUES) {
          const out = resolveEffectivePolicy(pairInput(hiLayer, loLayer, cap, hiEntry, loEntry))
          expectCell(out, cap, {
            layer: hiLayer,
            origin: originFor(hiLayer),
            recordId: recordIdFor(hiLayer),
            entry: hiEntry,
            overriddenLower: [lowerRecord(loLayer, loEntry)],
          })
        }
      }
    }
  })

  it('higher deny beats lower allow: deny wins from above (15 pairs x 5 capabilities)', () => {
    for (let hi = 1; hi < TEAM_LAYER_ORDER.length; hi++) {
      for (let lo = 0; lo < hi; lo++) {
        const hiLayer = TEAM_LAYER_ORDER[hi]!
        const loLayer = TEAM_LAYER_ORDER[lo]!
        const loEntry = allow([itemFor(loLayer)])
        for (const cap of CAPABILITY_NAME_VALUES) {
          const out = resolveEffectivePolicy(pairInput(hiLayer, loLayer, cap, deny(), loEntry))
          expectCell(out, cap, {
            layer: hiLayer,
            origin: originFor(hiLayer),
            recordId: recordIdFor(hiLayer),
            entry: deny(),
            overriddenLower: [lowerRecord(loLayer, loEntry)],
          })
        }
      }
    }
  })

  it('higher allow relaxes lower deny (no monotonic restriction, S19.6; 15 pairs x 5 capabilities)', () => {
    for (let hi = 1; hi < TEAM_LAYER_ORDER.length; hi++) {
      for (let lo = 0; lo < hi; lo++) {
        const hiLayer = TEAM_LAYER_ORDER[hi]!
        const loLayer = TEAM_LAYER_ORDER[lo]!
        const hiEntry = allow([itemFor(hiLayer)])
        for (const cap of CAPABILITY_NAME_VALUES) {
          const out = resolveEffectivePolicy(pairInput(hiLayer, loLayer, cap, hiEntry, deny()))
          expectCell(out, cap, {
            layer: hiLayer,
            origin: originFor(hiLayer),
            recordId: recordIdFor(hiLayer),
            entry: hiEntry,
            overriddenLower: [lowerRecord(loLayer, deny())],
          })
        }
      }
    }
  })
})

// --- 5. external hard matrix -----------------------------------------------------

describe('P3-T4 matrix: external hard intersection (un-bypassable)', () => {
  const HUMAN_ITEMS = ['h1', 'h2', 'h3']

  function humanInput(cap: CapabilityName, external: EffectivePolicyInput['external']): EffectivePolicyInput {
    return baseInput({
      humanOverride: {
        overrideId: 'ovh-1',
        scope: 'team',
        values: { [cap]: allow([...HUMAN_ITEMS]) },
      },
      external,
    })
  }

  it('hard unspecified: the strongest team layer passes through unchanged (5 capabilities)', () => {
    for (const cap of CAPABILITY_NAME_VALUES) {
      const out = resolveEffectivePolicy(humanInput(cap, { hard: {}, capabilityExists: {} }))
      expectCell(out, cap, {
        layer: 'humanOverride',
        origin: 'human',
        recordId: 'ovh-1',
        entry: allow([...HUMAN_ITEMS]),
        capabilityExists: true,
        hard: 'unspecified',
        removedItems: [],
        note: 'none',
      })
    }
  })

  it('hard deny: denies even the human override, items recorded as removed (5 capabilities)', () => {
    for (const cap of CAPABILITY_NAME_VALUES) {
      const out = resolveEffectivePolicy(
        humanInput(cap, { hard: { [cap]: deny() }, capabilityExists: {} }),
      )
      expectCell(out, cap, {
        layer: 'humanOverride',
        origin: 'human',
        recordId: 'ovh-1',
        entry: deny(),
        teamValue: allow([...HUMAN_ITEMS]),
        capabilityExists: true,
        hard: 'deny',
        removedItems: [...HUMAN_ITEMS],
        note: 'externalHardDeny',
      })
    }
  })

  it('hard allow-subset: intersects, removed items recorded exactly (5 capabilities)', () => {
    for (const cap of CAPABILITY_NAME_VALUES) {
      const out = resolveEffectivePolicy(
        humanInput(cap, { hard: { [cap]: allow(['h1', 'h3']) }, capabilityExists: {} }),
      )
      expectCell(out, cap, {
        layer: 'humanOverride',
        origin: 'human',
        recordId: 'ovh-1',
        entry: allow(['h1', 'h3']),
        teamValue: allow([...HUMAN_ITEMS]),
        capabilityExists: true,
        hard: { allowedItems: ['h1', 'h3'] },
        removedItems: ['h2'],
        note: 'none',
      })
    }
  })

  it('hard allow-disjoint: empty intersection denies (5 capabilities)', () => {
    for (const cap of CAPABILITY_NAME_VALUES) {
      const out = resolveEffectivePolicy(
        humanInput(cap, { hard: { [cap]: allow(['x1', 'x2']) }, capabilityExists: {} }),
      )
      expectCell(out, cap, {
        layer: 'humanOverride',
        origin: 'human',
        recordId: 'ovh-1',
        entry: deny(),
        teamValue: allow([...HUMAN_ITEMS]),
        capabilityExists: true,
        hard: { allowedItems: ['x1', 'x2'] },
        removedItems: [...HUMAN_ITEMS],
        note: 'externalHardRemovedAll',
      })
    }
  })

  it('capability missing: denies every layer (invariant 35), even the human override (5 capabilities)', () => {
    for (const cap of CAPABILITY_NAME_VALUES) {
      const out = resolveEffectivePolicy(
        humanInput(cap, { hard: {}, capabilityExists: { [cap]: false } }),
      )
      expectCell(out, cap, {
        layer: 'humanOverride',
        origin: 'human',
        recordId: 'ovh-1',
        entry: deny(),
        teamValue: allow([...HUMAN_ITEMS]),
        capabilityExists: false,
        hard: 'unspecified',
        removedItems: [...HUMAN_ITEMS],
        note: 'capabilityMissing',
      })
    }
  })

  it('note precedence: capabilityMissing outranks externalHardDeny (5 capabilities)', () => {
    for (const cap of CAPABILITY_NAME_VALUES) {
      const out = resolveEffectivePolicy(
        humanInput(cap, { hard: { [cap]: deny() }, capabilityExists: { [cap]: false } }),
      )
      expectCell(out, cap, {
        layer: 'humanOverride',
        origin: 'human',
        recordId: 'ovh-1',
        entry: deny(),
        teamValue: allow([...HUMAN_ITEMS]),
        capabilityExists: false,
        hard: 'deny',
        removedItems: [...HUMAN_ITEMS],
        note: 'capabilityMissing',
      })
    }
  })

  it('team deny + hard allow: the team denial stands; external removes nothing (5 capabilities)', () => {
    for (const cap of CAPABILITY_NAME_VALUES) {
      const out = resolveEffectivePolicy(
        baseInput({
          blueprint: { values: { [cap]: deny() } },
          external: { hard: { [cap]: allow(['h1']) }, capabilityExists: {} },
        }),
      )
      expectCell(out, cap, {
        layer: 'blueprint',
        origin: 'static',
        recordId: null,
        entry: deny(),
        capabilityExists: true,
        hard: { allowedItems: ['h1'] },
        removedItems: [],
        note: 'none',
      })
    }
  })

  it('output passthrough: teamSessionId / member / policyStateId / 5-cell report', () => {
    const out = resolveEffectivePolicy(baseInput())
    expect(out.teamSessionId).toBe(TEAM)
    expect(out.member).toEqual(MEMBER)
    expect(out.policyStateId).toBe('default')
    expect(out.explanation.split('\n').length).toBe(5)
    for (const cap of CAPABILITY_NAME_VALUES) {
      expect(out.cells[cap].capability).toBe(cap)
    }
  })
})
