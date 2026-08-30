/**
 * P3-T6 / G3 criterion 4 — "policy precedence exhaustive tests".
 *
 * Cross-module precedence suite for the pure policy resolver, composed
 * against contracts-v1 member identities (the mirror-vs-contracts
 * identity check ties the self-contained policy module back to the frozen
 * contracts). Coverage:
 *
 * 1. solo winner — every Team layer × every capability as the ONLY
 *    contributor: winner layer, origin, record id, effective value;
 * 2. origin/scope variants — instance overlay in both origins
 *    (member / leader-authorized), human override in both scopes
 *    (team / instance);
 * 3. pairwise conflict — all 15 ordered layer pairs × 5 capabilities,
 *    both allow: higher wins, lower recorded in `overriddenLower` with
 *    full provenance (ascending);
 * 4. deny above — higher deny beats lower allow;
 * 5. relaxation — higher allow lawfully relaxes lower deny (invariant 34:
 *    no monotonic restriction materialization);
 * 6. full six-layer stack — humanOverride wins, all five lower layers
 *    recorded in ascending order;
 * 7. external stage un-bypassable (invariant 35) — capability missing,
 *    hard deny, hard allow subset, hard allow disjoint, team deny;
 * 8. fail-closed — no candidates ⇒ deny with `unspecified` provenance;
 * 9. determinism + explainability + deep freezing;
 * 10. identity scope (IDENTITY_SCOPE_MISMATCH, single error family) and
 *     mirror-vs-contracts identity equality for the same (root, instance).
 */

import { describe, expect, it } from 'vitest'

import { canonicalJsonStringify, createMemberIdentity } from '../../contracts/src/index.js'
import { parseInstanceId as contractsParseInstanceId, parseRootSessionId as contractsParseRootSessionId } from '../../contracts/src/index.js'
import {
  CAPABILITY_NAME_VALUES,
  TEAM_LAYER_ORDER,
  isPolicyResolutionError,
  resolveEffectivePolicy,
} from '../../domain/policy/src/index.js'
import type {
  CapabilityName,
  EffectivePolicy,
  EffectivePolicyInput,
  PolicyEntry,
  TeamLayer,
  TeamValueOrigin,
} from '../../domain/policy/src/index.js'
import {
  createMemberIdentity as mirrorCreateMemberIdentity,
  parseInstanceId as mirrorParseInstanceId,
  parseRootSessionId as mirrorParseRootSessionId,
  parseTeamSessionId as mirrorParseTeamSessionId,
} from '../../domain/policy/src/index.js'
import { hasCode, isDeepFrozen, mulberry32, expectSingleFamily } from './t6-helpers.js'

// --- fixtures (mirror the t4 idiom) ---------------------------------------------

const ROOT = mirrorParseRootSessionId('session-root-1')
const TEAM = mirrorParseTeamSessionId('session-root-1')
const MEMBER = mirrorCreateMemberIdentity(ROOT, mirrorParseInstanceId('inst-a'))

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

/** The distinct item a layer contributes (keeps winners distinct). */
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
 * an agreeing blueprint/template envelope granting exactly the contributed
 * items (+ one spare), so every contribution stays in-envelope.
 */
function layerContribution(
  layer: TeamLayer,
  cap: CapabilityName,
  entry: PolicyEntry,
  options: LayerOptions = {},
): Partial<EffectivePolicyInput> {
  // The envelope is the Team-level boundary; an overlay's own entry only tells
  // us which items that overlay grants. A deny overlay grants nothing, yet it
  // must not collapse the boundary for sibling overlays, so a deny entry
  // contributes the permissive spare-only envelope instead of an empty deny.
  const envelopeEntry: PolicyEntry =
    entry.kind === 'allow' ? allow([...entry.items, 'envelope-spare']) : allow(['envelope-spare'])
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
 * Union the items of every `allow` entry; `deny` entries contribute nothing
 * (the engine always admits deny overlays, so they need no envelope items).
 * Returns `undefined` when no entry was given, and `deny()` when entries were
 * given but contribute no items (a collapsed boundary).
 */
function unionAllowEntries(...entries: Array<PolicyEntry | undefined>): PolicyEntry | undefined {
  const items = new Set<string>()
  let any = false
  for (const entry of entries) {
    if (entry === undefined) continue
    any = true
    if (entry.kind === 'allow') {
      for (const item of entry.items) items.add(item)
    }
  }
  if (!any) return undefined
  if (items.size === 0) return deny()
  return { kind: 'allow', items: [...items].sort() }
}

/**
 * Merge two contributions to one Team policy layer (blueprint or template):
 * value fields come from the later contribution, but the envelope map
 * (`autonomyEnvelope` / `mutationEnvelope`) becomes the union of the
 * per-capability allow items, so an overlay granted by any lower contribution
 * stays inside the boundary when a higher contribution adds its own overlay.
 */
function mergeLayerContributionEnvelope<T extends object>(
  base: T,
  partial: T | undefined,
  envelopeKey: 'autonomyEnvelope' | 'mutationEnvelope',
): T {
  if (partial === undefined) return base
  const baseAny = base as Record<string, unknown>
  const partialAny = partial as Record<string, unknown>
  const baseEnv = baseAny[envelopeKey] as Partial<Record<CapabilityName, PolicyEntry>> | undefined
  const partialEnv = partialAny[envelopeKey] as Partial<Record<CapabilityName, PolicyEntry>> | undefined
  const merged: Record<string, unknown> = { ...baseAny, ...partialAny }
  if (baseEnv === undefined && partialEnv === undefined) {
    delete merged[envelopeKey]
    return merged as T
  }
  const caps = new Set<CapabilityName>([
    ...(baseEnv === undefined ? [] : (Object.keys(baseEnv) as CapabilityName[])),
    ...(partialEnv === undefined ? [] : (Object.keys(partialEnv) as CapabilityName[])),
  ])
  const env: Record<string, PolicyEntry> = {}
  for (const cap of caps) {
    const union = unionAllowEntries(
      baseEnv === undefined ? undefined : baseEnv[cap],
      partialEnv === undefined ? undefined : partialEnv[cap],
    )
    if (union !== undefined) env[cap] = union
  }
  if (Object.keys(env).length === 0) {
    delete merged[envelopeKey]
  } else {
    merged[envelopeKey] = env
  }
  return merged as T
}

function withContribution(
  base: EffectivePolicyInput,
  partial: Partial<EffectivePolicyInput>,
): EffectivePolicyInput {
  return {
    ...base,
    blueprint: mergeLayerContributionEnvelope(base.blueprint, partial.blueprint, 'autonomyEnvelope'),
    template: mergeLayerContributionEnvelope(base.template, partial.template, 'mutationEnvelope'),
    policyState: { ...base.policyState, ...partial.policyState },
    ...(partial.templateOverlay !== undefined ? { templateOverlay: partial.templateOverlay } : {}),
    ...(partial.instanceOverlay !== undefined ? { instanceOverlay: partial.instanceOverlay } : {}),
    ...(partial.humanOverride !== undefined ? { humanOverride: partial.humanOverride } : {}),
    external: { ...base.external, ...partial.external },
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

function fullStackInput(cap: CapabilityName): EffectivePolicyInput {
  let input = baseInput()
  for (const layer of TEAM_LAYER_ORDER) {
    input = withContribution(input, layerContribution(layer, cap, allow([itemFor(layer)])))
  }
  return input
}

interface CellExpectation {
  layer: TeamLayer | 'unspecified'
  origin: TeamValueOrigin
  recordId: string | null
  entry: PolicyEntry
  teamValue?: PolicyEntry
  overriddenLower?: readonly {
    layer: TeamLayer
    origin: TeamValueOrigin
    recordId: string | null
    value: PolicyEntry
  }[]
  note?: string
  removedItems?: string[]
  capabilityExists?: boolean
}

function lowerRecord(layer: TeamLayer, entry: PolicyEntry) {
  return { layer, origin: originFor(layer), recordId: recordIdFor(layer), value: entry }
}

/** Assert one resolved cell against the full expectation. */
function expectCell(out: EffectivePolicy, cap: CapabilityName, exp: CellExpectation): void {
  const cell = out.cells[cap]
  expect(cell.capability).toBe(cap)
  expect(cell.effective).toEqual(exp.entry)
  expect(cell.team.layer).toBe(exp.layer)
  expect(cell.team.origin).toBe(exp.origin)
  expect(cell.team.recordId).toBe(exp.recordId)
  expect(cell.team.value).toEqual(exp.teamValue ?? (exp.layer === 'unspecified' ? deny() : exp.entry))
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
}

describe('P3-T6 G3-4: policy precedence exhaustive', () => {
  it('solo winner: every layer alone wins its cell (6 layers x 5 capabilities)', () => {
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
        })
      }
    }
  })

  it('origin/scope variants: instance overlay in both origins, human override in both scopes', () => {
    for (const origin of ['member', 'leader'] as const) {
      for (const cap of CAPABILITY_NAME_VALUES) {
        const entry = allow([`ins-${origin}`])
        const out = resolveEffectivePolicy(soloInput('instanceOverlay', cap, entry, { origin }))
        expectCell(out, cap, { layer: 'instanceOverlay', origin, recordId: 'ov-ins-1', entry })
      }
    }
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

  it('pairwise: higher allow beats lower allow, lower recorded with provenance (15 pairs x 5 caps)', () => {
    let pairs = 0
    for (let hi = 1; hi < TEAM_LAYER_ORDER.length; hi++) {
      for (let lo = 0; lo < hi; lo++) {
        const hiLayer = TEAM_LAYER_ORDER[hi]
        const loLayer = TEAM_LAYER_ORDER[lo]
        if (hiLayer === undefined || loLayer === undefined) continue
        for (const cap of CAPABILITY_NAME_VALUES) {
          pairs++
          const hiEntry = allow([itemFor(hiLayer)])
          const loEntry = allow([itemFor(loLayer)])
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
    expect(pairs).toBe(15 * CAPABILITY_NAME_VALUES.length)
  })

  it('deny above: a higher deny beats a lower allow (15 pairs x 5 capabilities)', () => {
    for (let hi = 1; hi < TEAM_LAYER_ORDER.length; hi++) {
      for (let lo = 0; lo < hi; lo++) {
        const hiLayer = TEAM_LAYER_ORDER[hi]
        const loLayer = TEAM_LAYER_ORDER[lo]
        if (hiLayer === undefined || loLayer === undefined) continue
        for (const cap of CAPABILITY_NAME_VALUES) {
          const out = resolveEffectivePolicy(pairInput(hiLayer, loLayer, cap, deny(), allow([itemFor(loLayer)])))
          expectCell(out, cap, {
            layer: hiLayer,
            origin: originFor(hiLayer),
            recordId: recordIdFor(hiLayer),
            entry: deny(),
            overriddenLower: [lowerRecord(loLayer, allow([itemFor(loLayer)]))],
          })
        }
      }
    }
  })

  it('relaxation: a higher allow lawfully relaxes a lower deny (15 pairs x 5 capabilities, inv 34)', () => {
    for (let hi = 1; hi < TEAM_LAYER_ORDER.length; hi++) {
      for (let lo = 0; lo < hi; lo++) {
        const hiLayer = TEAM_LAYER_ORDER[hi]
        const loLayer = TEAM_LAYER_ORDER[lo]
        if (hiLayer === undefined || loLayer === undefined) continue
        for (const cap of CAPABILITY_NAME_VALUES) {
          const hiEntry = allow([itemFor(hiLayer)])
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

  it('full six-layer stack: humanOverride wins, all five lower layers recorded ascending (5 caps)', () => {
    for (const cap of CAPABILITY_NAME_VALUES) {
      const out = resolveEffectivePolicy(fullStackInput(cap))
      const below = TEAM_LAYER_ORDER.filter((layer) => layer !== 'humanOverride')
      expectCell(out, cap, {
        layer: 'humanOverride',
        origin: 'human',
        recordId: 'ovh-1',
        entry: allow([itemFor('humanOverride')]),
        overriddenLower: below.map((layer) => lowerRecord(layer, allow([itemFor(layer)]))),
      })
    }
  })

  it('external stage is un-bypassable: even the strongest Team layer cannot win (5 caps x 5 combos)', () => {
    for (const cap of CAPABILITY_NAME_VALUES) {
      const teamEntry = allow([`team-${cap}`])

      const missing = resolveEffectivePolicy(
        withContribution(soloInput('humanOverride', cap, teamEntry), {
          external: { hard: {}, capabilityExists: { [cap]: false } },
        }),
      )
      expectCell(missing, cap, {
        layer: 'humanOverride',
        origin: 'human',
        recordId: 'ovh-1',
        entry: deny(),
        teamValue: teamEntry,
        note: 'capabilityMissing',
        removedItems: [`team-${cap}`],
        capabilityExists: false,
      })

      const hardDeny = resolveEffectivePolicy(
        withContribution(soloInput('humanOverride', cap, teamEntry), {
          external: { hard: { [cap]: deny() }, capabilityExists: {} },
        }),
      )
      expectCell(hardDeny, cap, {
        layer: 'humanOverride',
        origin: 'human',
        recordId: 'ovh-1',
        entry: deny(),
        teamValue: teamEntry,
        note: 'externalHardDeny',
        removedItems: [`team-${cap}`],
        capabilityExists: true,
      })

      const subset = resolveEffectivePolicy(
        withContribution(soloInput('humanOverride', cap, teamEntry), {
          external: { hard: { [cap]: allow([`team-${cap}`]) }, capabilityExists: {} },
        }),
      )
      expectCell(subset, cap, {
        layer: 'humanOverride',
        origin: 'human',
        recordId: 'ovh-1',
        entry: allow([`team-${cap}`]),
        note: 'none',
        removedItems: [],
        capabilityExists: true,
      })

      const disjoint = resolveEffectivePolicy(
        withContribution(soloInput('humanOverride', cap, teamEntry), {
          external: { hard: { [cap]: allow([`other-${cap}`]) }, capabilityExists: {} },
        }),
      )
      expectCell(disjoint, cap, {
        layer: 'humanOverride',
        origin: 'human',
        recordId: 'ovh-1',
        entry: deny(),
        teamValue: teamEntry,
        note: 'externalHardRemovedAll',
        removedItems: [`team-${cap}`],
        capabilityExists: true,
      })

      const teamDeny = resolveEffectivePolicy(
        withContribution(soloInput('blueprint', cap, deny()), {
          external: { hard: { [cap]: allow([`team-${cap}`]) }, capabilityExists: {} },
        }),
      )
      expectCell(teamDeny, cap, {
        layer: 'blueprint',
        origin: 'static',
        recordId: null,
        entry: deny(),
        note: 'none',
        removedItems: [],
        capabilityExists: true,
      })
    }
  })

  it('fail-closed: no candidates resolves deny with unspecified static provenance (5 caps)', () => {
    for (const cap of CAPABILITY_NAME_VALUES) {
      const out = resolveEffectivePolicy(baseInput())
      expectCell(out, cap, {
        layer: 'unspecified',
        origin: 'static',
        recordId: null,
        entry: deny(),
        teamValue: deny(),
        overriddenLower: [],
        note: 'none',
        removedItems: [],
        capabilityExists: true,
      })
    }
  })

  it('determinism + explainability: double run byte-identical, explanation non-empty, output deeply frozen', () => {
    const rand = mulberry32(640001)
    const cap = CAPABILITY_NAME_VALUES[Math.floor(rand() * CAPABILITY_NAME_VALUES.length)]
    expect(cap !== undefined).toBe(true)
    const input = fullStackInput(cap as CapabilityName)
    const first = resolveEffectivePolicy(input)
    const second = resolveEffectivePolicy(input)
    expect(canonicalJsonStringify(first)).toBe(canonicalJsonStringify(second))
    expect(typeof first.explanation).toBe('string')
    expect(first.explanation.length).toBeGreaterThan(0)
    expect(first.policyStateId).toBe('default')
    expect(isDeepFrozen(first)).toBe(true)
  })

  it('identity scope: a foreign-root identity is rejected (policy family, single class)', () => {
    const foreignRoot = mirrorParseRootSessionId('session-root-2')
    const foreignMember = mirrorCreateMemberIdentity(foreignRoot, mirrorParseInstanceId('inst-a'))
    const input = baseInput({ member: foreignMember })
    const error = expectSingleFamily(
      () => resolveEffectivePolicy(input),
      'policy',
      'foreign-root identity',
    )
    expect(hasCode(error, 'IDENTITY_SCOPE_MISMATCH')).toBe(true)
    expect(isPolicyResolutionError(error)).toBe(true)
  })

  it('mirror-vs-contracts: the same (root, instance) yields equal identities in both realms', () => {
    const contractsRoot = contractsParseRootSessionId('session-root-1')
    const contractsIdentity = createMemberIdentity(contractsRoot, contractsParseInstanceId('inst-a'))
    const mirrorIdentity = mirrorCreateMemberIdentity(ROOT, mirrorParseInstanceId('inst-a'))
    expect(contractsIdentity.rootSessionId).toBe(mirrorIdentity.rootSessionId)
    expect(contractsIdentity.instanceId).toBe(mirrorIdentity.instanceId)
    expect(contractsIdentity).toEqual(mirrorIdentity)
  })
})
