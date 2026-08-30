/**
 * P3-T4 — EXPLAINABILITY + PROVENANCE tests for the pure policy resolver.
 *
 * Implements the TaskDoc P3-T4 acceptance criterion "every effective value
 * is explainable" and the 实现要点 "output provenance; separate leader
 * autonomy from human override". Every value in the effective policy must
 * carry first-class provenance (which layer, which origin, which record,
 * what was overridden, what the external stage removed), and each capability
 * cell must render a deterministic one-line explanation that pins the exact
 * string format.
 *
 * Coverage:
 * - **Exact explanation strings** for every single winner layer (the 6 Team
 *   layers) — pins the deterministic report format.
 * - **Multi-layer provenance** — winner + the full `overriddenLower` list in
 *   ascending order (layer/origin/recordId/value of each loser).
 * - **Leader autonomy vs human override separation** — a leader-origin
 *   autonomy overlay and a human override are distinct provenance records:
 *   the human override wins with origin `human` while the leader's
 *   contribution is preserved in `overriddenLower` with origin `leader`
 *   (never conflated, never re-labelled).
 * - **Fail-closed unspecified** — a cell no Team layer granted renders the
 *   explicit `none(origin=static) deny (fail-closed: ...)` line.
 * - **External-stage explainability** — hard removal, hard deny, and
 *   capability-missing each render their removed-item list and note.
 * - **Suppression explainability** — a stored-but-suppressed overlay is
 *   preserved non-destructively (value intact) and rendered in the line.
 * - **Structural invariant** — for EVERY capability of EVERY resolution,
 *   the explanation line begins with the capability and states the exact
 *   effective entry (the value is literally explained by the string).
 *
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
  PolicyEntry,
  TeamLayer,
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

/** An agreeing blueprint/template envelope granting exactly the items. */
function envelopeFor(cap: CapabilityName, items: string[]): {
  blueprint: { autonomyEnvelope: Partial<Record<CapabilityName, PolicyEntry>> }
  template: { mutationEnvelope: Partial<Record<CapabilityName, PolicyEntry>> }
} {
  return {
    blueprint: { autonomyEnvelope: { [cap]: allow(items) } },
    template: { mutationEnvelope: { [cap]: allow(items) } },
  }
}

/** The renderer the resolver uses for one entry (pinned for assertions). */
function fmtEntry(entry: PolicyEntry): string {
  return entry.kind === 'deny' ? 'deny' : `allow[${entry.items.join(',')}]`
}

/** One layer's single-capability contribution (overlays stay in-envelope). */
function soloLayerInput(
  layer: TeamLayer,
  cap: CapabilityName,
  entry: PolicyEntry,
): EffectivePolicyInput {
  const items = entry.kind === 'allow' ? entry.items : []
  const env = envelopeFor(cap, [...items, 'spare'])
  switch (layer) {
    case 'blueprint':
      return baseInput({ blueprint: { values: { [cap]: entry } } })
    case 'policyState':
      return baseInput({ policyState: { stateId: 'default', cells: { [cap]: { value: entry } } } })
    case 'template':
      return baseInput({ template: { values: { [cap]: entry } } })
    case 'templateOverlay':
      return baseInput({
        blueprint: env.blueprint,
        template: env.template,
        templateOverlay: { overlayId: 'ov-tpl-1', kind: 'template', origin: 'leader', values: { [cap]: entry } },
      })
    case 'instanceOverlay':
      return baseInput({
        blueprint: env.blueprint,
        template: env.template,
        instanceOverlay: { overlayId: 'ov-ins-1', kind: 'instance', origin: 'member', values: { [cap]: entry } },
      })
    case 'humanOverride':
      return baseInput({
        humanOverride: { overrideId: 'ovh-1', scope: 'team', values: { [cap]: entry } },
      })
    default: {
      const exhaustive: never = layer
      throw new Error(`unhandled layer ${String(exhaustive)}`)
    }
  }
}

/** The exact explanation line a single-winner cell must render. */
function soloLine(layer: TeamLayer, cap: CapabilityName, entry: PolicyEntry): string {
  const layerPart =
    layer === 'templateOverlay'
      ? 'templateOverlay(origin=leader, ov-tpl-1)'
      : layer === 'instanceOverlay'
        ? 'instanceOverlay(origin=member, ov-ins-1)'
        : layer === 'humanOverride'
          ? 'humanOverride(origin=human, ovh-1)'
          : `${layer}(origin=static)`
  return `${cap}: effective ${fmtEntry(entry)}; team ${layerPart} ${fmtEntry(entry)}; external exists=yes, hard=unspecified`
}

// --- 1. exact single-winner explanation strings ----------------------------------

describe('P3-T4 explain: exact single-winner explanation strings', () => {
  it('each of the 6 layers alone renders its pinned explanation line (x 5 capabilities)', () => {
    for (const layer of TEAM_LAYER_ORDER) {
      for (const cap of CAPABILITY_NAME_VALUES) {
        const entry = allow([`v-${layer}`])
        const out = resolveEffectivePolicy(soloLayerInput(layer, cap, entry))
        expect(out.cells[cap].explanation).toBe(soloLine(layer, cap, entry))
      }
    }
  })

  it('a deny winner renders "deny" verbatim in both the effective and team parts', () => {
    const cap: CapabilityName = 'tools'
    const out = resolveEffectivePolicy(soloLayerInput('blueprint', cap, deny()))
    expect(out.cells[cap].explanation).toBe(
      'tools: effective deny; team blueprint(origin=static) deny; external exists=yes, hard=unspecified',
    )
  })
})

// --- 2. multi-layer provenance -----------------------------------------------------

describe('P3-T4 explain: multi-layer provenance (overriddenLower)', () => {
  it('all 6 layers on one cell: winner humanOverride + 5 losers in ascending order with full provenance', () => {
    const cap: CapabilityName = 'tools'
    const env = envelopeFor(cap, ['ovt-item', 'ovi-item', 'spare'])
    const input = baseInput({
      blueprint: { values: { [cap]: allow(['bp-item']) }, autonomyEnvelope: env.blueprint.autonomyEnvelope },
      template: { values: { [cap]: allow(['tpl-item']) }, mutationEnvelope: env.template.mutationEnvelope },
      policyState: { stateId: 'default', cells: { [cap]: { value: allow(['st-item']) } } },
      templateOverlay: { overlayId: 'ovt-1', kind: 'template', origin: 'leader', values: { [cap]: allow(['ovt-item']) } },
      instanceOverlay: { overlayId: 'ovi-1', kind: 'instance', origin: 'member', values: { [cap]: allow(['ovi-item']) } },
      humanOverride: { overrideId: 'ovh-9', scope: 'team', values: { [cap]: allow(['ovh-item']) } },
    })
    const out = resolveEffectivePolicy(input)
    const cell = out.cells[cap]
    expect(cell.effective).toEqual(allow(['ovh-item']))
    expect(cell.team.layer).toBe('humanOverride')
    expect(cell.team.origin).toBe('human')
    expect(cell.team.recordId).toBe('ovh-9')
    expect(cell.team.value).toEqual(allow(['ovh-item']))
    expect(cell.team.overriddenLower).toEqual([
      { layer: 'blueprint', origin: 'static', recordId: null, value: allow(['bp-item']) },
      { layer: 'policyState', origin: 'static', recordId: null, value: allow(['st-item']) },
      { layer: 'template', origin: 'static', recordId: null, value: allow(['tpl-item']) },
      { layer: 'templateOverlay', origin: 'leader', recordId: 'ovt-1', value: allow(['ovt-item']) },
      { layer: 'instanceOverlay', origin: 'member', recordId: 'ovi-1', value: allow(['ovi-item']) },
    ])
    expect(cell.explanation).toBe(
      'tools: effective allow[ovh-item]; team humanOverride(origin=human, ovh-9) allow[ovh-item]; external exists=yes, hard=unspecified',
    )
  })

  it('a mid-layer winner keeps every lower loser and drops no higher layer (policyState winner)', () => {
    const cap: CapabilityName = 'model'
    const input = baseInput({
      blueprint: { values: { [cap]: allow(['bp-item']) } },
      policyState: { stateId: 'default', cells: { [cap]: { value: allow(['st-item']) } } },
    })
    const out = resolveEffectivePolicy(input)
    const cell = out.cells[cap]
    expect(cell.effective).toEqual(allow(['st-item']))
    expect(cell.team.layer).toBe('policyState')
    expect(cell.team.overriddenLower).toEqual([
      { layer: 'blueprint', origin: 'static', recordId: null, value: allow(['bp-item']) },
    ])
    expect(cell.explanation).toBe(
      'model: effective allow[st-item]; team policyState(origin=static) allow[st-item]; external exists=yes, hard=unspecified',
    )
  })
})

// --- 3. leader autonomy vs human override separation --------------------------------

describe('P3-T4 explain: leader autonomy vs human override (separated in model AND provenance)', () => {
  it('leader overlay alone: origin is leader (not human), record is the overlay id', () => {
    const cap: CapabilityName = 'tools'
    const out = resolveEffectivePolicy(soloLayerInput('templateOverlay', cap, allow(['ld-item'])))
    const cell = out.cells[cap]
    expect(cell.team.layer).toBe('templateOverlay')
    expect(cell.team.origin).toBe('leader')
    expect(cell.team.recordId).toBe('ov-tpl-1')
    expect(cell.explanation).toBe(
      'tools: effective allow[ld-item]; team templateOverlay(origin=leader, ov-tpl-1) allow[ld-item]; external exists=yes, hard=unspecified',
    )
  })

  it('leader overlay + human override on the same cell: human wins; the leader record stays origin=leader', () => {
    const cap: CapabilityName = 'permissions'
    const env = envelopeFor(cap, ['ld-item', 'spare'])
    const input = baseInput({
      blueprint: env.blueprint,
      template: env.template,
      templateOverlay: { overlayId: 'ov-ld', kind: 'template', origin: 'leader', values: { [cap]: allow(['ld-item']) } },
      humanOverride: { overrideId: 'ovh-hu', scope: 'team', values: { [cap]: allow(['hum-item']) } },
    })
    const out = resolveEffectivePolicy(input)
    const cell = out.cells[cap]
    expect(cell.effective).toEqual(allow(['hum-item']))
    expect(cell.team.layer).toBe('humanOverride')
    expect(cell.team.origin).toBe('human')
    expect(cell.team.recordId).toBe('ovh-hu')
    // The leader's autonomy contribution is preserved, labelled leader.
    expect(cell.team.overriddenLower).toEqual([
      { layer: 'templateOverlay', origin: 'leader', recordId: 'ov-ld', value: allow(['ld-item']) },
    ])
    const lower = cell.team.overriddenLower[0]!
    expect(lower.origin).toBe('leader')
    expect(lower.recordId).toBe('ov-ld')
    expect(cell.explanation).toBe(
      'permissions: effective allow[hum-item]; team humanOverride(origin=human, ovh-hu) allow[hum-item]; external exists=yes, hard=unspecified',
    )
  })

  it('two cells side by side: one leader-only, one leader+human — provenance never conflated', () => {
    const tools: CapabilityName = 'tools'
    const permissions: CapabilityName = 'permissions'
    const envT = envelopeFor(tools, ['ld-t', 'spare'])
    const envP = envelopeFor(permissions, ['ld-p', 'spare'])
    const input = baseInput({
      blueprint: { autonomyEnvelope: { ...envT.blueprint.autonomyEnvelope, ...envP.blueprint.autonomyEnvelope } },
      template: { mutationEnvelope: { ...envT.template.mutationEnvelope, ...envP.template.mutationEnvelope } },
      templateOverlay: {
        overlayId: 'ov-ld',
        kind: 'template',
        origin: 'leader',
        values: { [tools]: allow(['ld-t']), [permissions]: allow(['ld-p']) },
      },
      humanOverride: {
        overrideId: 'ovh-hu',
        scope: 'team',
        values: { [permissions]: allow(['hum-p']) },
      },
    })
    const out = resolveEffectivePolicy(input)
    expect(out.cells[tools].team.origin).toBe('leader')
    expect(out.cells[tools].team.layer).toBe('templateOverlay')
    expect(out.cells[permissions].team.origin).toBe('human')
    expect(out.cells[permissions].team.layer).toBe('humanOverride')
    expect(out.cells[permissions].team.overriddenLower[0]!.origin).toBe('leader')
  })

  it('the human override RELAXES a lower Team deny (S19.6; invariant 34) — provenance shows the deny loser', () => {
    const cap: CapabilityName = 'skills'
    const input = baseInput({
      blueprint: { values: { [cap]: deny() } },
      humanOverride: { overrideId: 'ovh-relax', scope: 'team', values: { [cap]: allow(['re-granted']) } },
    })
    const out = resolveEffectivePolicy(input)
    const cell = out.cells[cap]
    expect(cell.effective).toEqual(allow(['re-granted']))
    expect(cell.team.layer).toBe('humanOverride')
    expect(cell.team.overriddenLower).toEqual([
      { layer: 'blueprint', origin: 'static', recordId: null, value: deny() },
    ])
    expect(cell.explanation).toBe(
      'skills: effective allow[re-granted]; team humanOverride(origin=human, ovh-relax) allow[re-granted]; external exists=yes, hard=unspecified',
    )
  })
})

// --- 4. fail-closed unspecified ------------------------------------------------------

describe('P3-T4 explain: fail-closed unspecified cell', () => {
  it('a cell no Team layer granted renders the explicit fail-closed line', () => {
    const out = resolveEffectivePolicy(baseInput())
    for (const cap of CAPABILITY_NAME_VALUES) {
      expect(out.cells[cap].effective).toEqual(deny())
      expect(out.cells[cap].team.layer).toBe('unspecified')
      expect(out.cells[cap].team.origin).toBe('static')
      expect(out.cells[cap].team.recordId).toBe(null)
      expect(out.cells[cap].explanation).toBe(
        `${cap}: effective deny; team none(origin=static) deny (fail-closed: no team layer grants this cell); external exists=yes, hard=unspecified`,
      )
    }
    expect(out.explanation.split('\n').length).toBe(5)
  })
})

// --- 5. external-stage explainability --------------------------------------------------

describe('P3-T4 explain: external stage (removed items and notes in the line)', () => {
  it('hard allow-subset: removed items rendered with the note-free line', () => {
    const cap: CapabilityName = 'mcp'
    const input = baseInput({
      humanOverride: { overrideId: 'ovh-1', scope: 'team', values: { [cap]: allow(['a', 'b', 'c']) } },
      external: { hard: { [cap]: allow(['b']) }, capabilityExists: {} },
    })
    const out = resolveEffectivePolicy(input)
    const cell = out.cells[cap]
    expect(cell.effective).toEqual(allow(['b']))
    expect(cell.external.removedItems).toEqual(['a', 'c'])
    expect(cell.external.note).toBe('none')
    expect(cell.explanation).toBe(
      'mcp: effective allow[b]; team humanOverride(origin=human, ovh-1) allow[a,b,c]; external exists=yes, hard=allow[b], removed=[a,c]',
    )
  })

  it('hard deny: the line states the denial with every removed item', () => {
    const cap: CapabilityName = 'permissions'
    const input = baseInput({
      humanOverride: { overrideId: 'ovh-1', scope: 'team', values: { [cap]: allow(['p1', 'p2']) } },
      external: { hard: { [cap]: deny() }, capabilityExists: {} },
    })
    const out = resolveEffectivePolicy(input)
    const cell = out.cells[cap]
    expect(cell.effective).toEqual(deny())
    expect(cell.external.note).toBe('externalHardDeny')
    expect(cell.explanation).toBe(
      'permissions: effective deny; team humanOverride(origin=human, ovh-1) allow[p1,p2]; external exists=yes, hard=deny, removed=[p1,p2]',
    )
  })

  it('capability missing: the line states exists=no and the removed claim (invariant 35)', () => {
    const cap: CapabilityName = 'model'
    const input = baseInput({
      humanOverride: { overrideId: 'ovh-1', scope: 'team', values: { [cap]: allow(['x']) } },
      external: { hard: {}, capabilityExists: { [cap]: false } },
    })
    const out = resolveEffectivePolicy(input)
    const cell = out.cells[cap]
    expect(cell.effective).toEqual(deny())
    expect(cell.external.capabilityExists).toBe(false)
    expect(cell.external.note).toBe('capabilityMissing')
    // The human CLAIM is preserved in provenance even though it cannot win.
    expect(cell.team.layer).toBe('humanOverride')
    expect(cell.team.value).toEqual(allow(['x']))
    expect(cell.explanation).toBe(
      'model: effective deny; team humanOverride(origin=human, ovh-1) allow[x]; external exists=no, hard=unspecified, removed=[x]',
    )
  })
})

// --- 6. suppression explainability ------------------------------------------------------

describe('P3-T4 explain: stored-but-suppressed overlays (S19.4)', () => {
  it('a suppressed overlay is preserved non-destructively and rendered in the line', () => {
    const cap: CapabilityName = 'tools'
    const env = envelopeFor(cap, ['a', 'b', 'c'])
    const input = baseInput({
      blueprint: env.blueprint,
      template: { values: { [cap]: allow(['a', 'b']) }, mutationEnvelope: env.template.mutationEnvelope },
      policyState: { stateId: 'locked-validation', cells: { [cap]: { locked: true } } },
      instanceOverlay: { overlayId: 'ov-sup', kind: 'instance', origin: 'member', values: { [cap]: allow(['c']) } },
    })
    const out = resolveEffectivePolicy(input)
    const cell = out.cells[cap]
    expect(cell.effective).toEqual(allow(['a', 'b']))
    // Non-destructive preservation: the overlay's value is still there.
    expect(out.suppressed).toEqual([
      {
        capability: cap,
        overlayId: 'ov-sup',
        layer: 'instanceOverlay',
        origin: 'member',
        value: allow(['c']),
        reason: 'policyStateLocked',
        policyStateId: 'locked-validation',
      },
    ])
    expect(cell.explanation).toBe(
      'tools: effective allow[a,b]; team template(origin=static) allow[a,b]; suppressed=[ov-sup]; external exists=yes, hard=unspecified',
    )
  })
})

// --- 7. structural explainability invariant -----------------------------------------------

describe('P3-T4 explain: every effective value is literally explained', () => {
  it('each cell line begins with the capability and states the exact effective entry (all 5 cells x several resolutions)', () => {
    const cases: EffectivePolicyInput[] = [
      baseInput(),
      baseInput({ blueprint: { values: { model: allow(['m1']) } } }),
      baseInput({
        humanOverride: { overrideId: 'ovh-1', scope: 'team', values: { tools: allow(['a', 'b']) } },
        external: { hard: { tools: allow(['a']) }, capabilityExists: {} },
      }),
      baseInput({
        templateOverlay: {
          overlayId: 'ov-1',
          kind: 'template',
          origin: 'leader',
          values: { skills: allow(['s1']) },
        },
        blueprint: envelopeFor('skills', ['s1', 'spare']).blueprint,
        template: envelopeFor('skills', ['s1', 'spare']).template,
      }),
    ]
    for (const input of cases) {
      const out: EffectivePolicy = resolveEffectivePolicy(input)
      const lines = out.explanation.split('\n')
      expect(lines.length).toBe(5)
      for (const cap of CAPABILITY_NAME_VALUES) {
        const cell = out.cells[cap]
        const line = lines[CAPABILITY_NAME_VALUES.indexOf(cap)]!
        expect(line).toBe(cell.explanation)
        expect(line.startsWith(`${cap}: effective ${fmtEntry(cell.effective)}; `)).toBe(true)
        if (!line.includes('team ')) throw new Error(`explanation missing the team part: ${line}`)
        if (!line.includes('external exists=')) throw new Error(`explanation missing the external part: ${line}`)
      }
    }
  })

  it('the resolution is deterministic: the same input renders byte-identical explanations', () => {
    const env = envelopeFor('tools', ['ld', 'spare'])
    const input = baseInput({
      blueprint: { values: { tools: allow(['bp']) }, autonomyEnvelope: env.blueprint.autonomyEnvelope },
      template: { mutationEnvelope: env.template.mutationEnvelope },
      templateOverlay: { overlayId: 'ov-1', kind: 'template', origin: 'leader', values: { tools: allow(['ld']) } },
      humanOverride: { overrideId: 'ovh-1', scope: 'team', values: { tools: allow(['hu']) } },
    })
    const first = resolveEffectivePolicy(input)
    const second = resolveEffectivePolicy(input)
    expect(first).toEqual(second)
    expect(first.explanation).toBe(second.explanation)
  })
})
