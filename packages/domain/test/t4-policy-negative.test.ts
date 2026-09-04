/**
 * P3-T4 — NEGATIVE tests for the pure policy resolver.
 *
 * Implements the TaskDoc P3-T4 "must test: deny/tightening/escalation
 * negative tests" and the acceptance criteria:
 *
 * - **Member self-escalation fails (typed error)** — a member-origin
 *   autonomy overlay granting items outside the Team autonomy envelope
 *   (blueprint ∩ template, §19.3) fails the WHOLE resolution with
 *   `MEMBER_SELF_ESCALATION` (invariant 37). The envelope is an
 *   INTERSECTION: an item allowed by the template but not the blueprint is
 *   still outside; an absent/deny envelope is empty (fail-closed).
 * - **Leader out-of-envelope fails (typed error)** — a leader-origin
 *   overlay (template overlay, or a leader-authorized instance overlay)
 *   outside the envelope fails with `LEADER_OUT_OF_ENVELOPE`
 *   (invariant 36).
 * - **Fail-closed, never resolved around** — a violating overlay makes the
 *   whole resolution throw even when a higher layer (the human override)
 *   would grant the same items.
 * - **Tightening** — a locked PolicyState cell SUPPRESSES a stored allow
 *   overlay ("stored but suppressed", §19.4): non-destructive, recorded in
 *   provenance, and it never loosens (a suppressed overlay cannot widen
 *   the effective value). Locking never suppresses a `deny` overlay and
 *   never suppresses the human override (§19.5). External hard and
 *   higher-layer deny tighten the effective value with exact removed-item
 *   provenance.
 * - **Malformed input** — every structural violation fails with
 *   `MALFORMED_POLICY_INPUT` (closed capability set, strict entry shape,
 *   slot/kind agreement, closed origin/scope, required capability-exists
 *   facts).
 * - **Identity boundary errors** — invalid ids fail with
 *   `MALFORMED_POLICY_INPUT`; a cross-scope member identity fails with
 *   `IDENTITY_SCOPE_MISMATCH` (the contracts-v1 code string, thrown as the
 *   policy's own error type by `src/contracts-mirror.js`).
 * - **Deterministic seeded fuzz** — a fixed-seed LCG (mulberry32) drives
 *   300 positive inputs (invariants on the external intersection and the
 *   closed provenance vocabulary) and 200 escalation inputs (origin-
 *   matching typed failure every time).
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
  TEAM_LAYER_OR_UNSPECIFIED_VALUES,
  TEAM_VALUE_ORIGIN_VALUES,
  isPolicyResolutionError,
  resolveEffectivePolicy,
} from '../policy/src/index.js'
import type {
  CapabilityName,
  EffectivePolicyInput,
  ExternalPolicyFacts,
  PolicyEntry,
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

// --- error-capture helpers --------------------------------------------------------

function capture(fn: () => unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  try {
    return { ok: true, value: fn() }
  } catch (error) {
    return { ok: false, error }
  }
}

/** Assert the failure carries the expected policy-semantic code; return it. */
function expectPolicyCode(error: unknown, code: string): { code: string; message: string; details?: Record<string, unknown> } {
  if (!isPolicyResolutionError(error)) {
    throw new Error(
      `expected PolicyResolutionError '${code}', got: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
    )
  }
  if (error.code !== code) {
    throw new Error(`expected policy code '${code}', got '${error.code}' (${error.message})`)
  }
  return { code: error.code, message: error.message, details: error.details }
}

function expectOneOf(value: string, values: readonly string[], label: string): void {
  if (!values.includes(value)) {
    throw new Error(`${label}: '${value}' is not in the closed set [${values.join(', ')}]`)
  }
}

// --- member self-escalation --------------------------------------------------------

describe('P3-T4 negative: member self-escalation (invariant 37)', () => {
  it('member overlay outside the envelope fails the whole resolution with MEMBER_SELF_ESCALATION', () => {
    const cap: CapabilityName = 'tools'
    const env = envelopeFor(cap, ['a', 'b'])
    const input = baseInput({
      ...env,
      instanceOverlay: {
        overlayId: 'ov-ins-esc',
        kind: 'instance',
        origin: 'member',
        values: { [cap]: allow(['b', 'zz']) },
      },
    })
    const result = capture(() => resolveEffectivePolicy(input))
    if (result.ok) throw new Error('expected MEMBER_SELF_ESCALATION, but the resolution succeeded')
    const err = expectPolicyCode(result.error, 'MEMBER_SELF_ESCALATION')
    expect(err.details?.['capability']).toBe(cap)
    expect(err.details?.['overlayId']).toBe('ov-ins-esc')
    expect(err.details?.['origin']).toBe('member')
    expect(err.details?.['outOfEnvelopeItems']).toEqual(['zz'])
    expect(err.details?.['envelopeItems']).toEqual(['a', 'b'])
    expect(err.message.length).toBeGreaterThan(0)
  })

  it('the envelope is an INTERSECTION: template-allowed but blueprint-forbidden is outside', () => {
    const cap: CapabilityName = 'skills'
    const input = baseInput({
      blueprint: { autonomyEnvelope: { [cap]: allow(['a']) } },
      template: { mutationEnvelope: { [cap]: allow(['a', 'b']) } },
      instanceOverlay: {
        overlayId: 'ov-ins-x',
        kind: 'instance',
        origin: 'member',
        values: { [cap]: allow(['b']) },
      },
    })
    const result = capture(() => resolveEffectivePolicy(input))
    if (result.ok) throw new Error('expected MEMBER_SELF_ESCALATION, but the resolution succeeded')
    const err = expectPolicyCode(result.error, 'MEMBER_SELF_ESCALATION')
    expect(err.details?.['outOfEnvelopeItems']).toEqual(['b'])
    expect(err.details?.['envelopeItems']).toEqual(['a'])
  })

  it('an absent envelope is EMPTY: any member allow fails (fail-closed boundary)', () => {
    const cap: CapabilityName = 'mcp'
    const input = baseInput({
      instanceOverlay: {
        overlayId: 'ov-ins-y',
        kind: 'instance',
        origin: 'member',
        values: { [cap]: allow(['a']) },
      },
    })
    const result = capture(() => resolveEffectivePolicy(input))
    if (result.ok) throw new Error('expected MEMBER_SELF_ESCALATION, but the resolution succeeded')
    const err = expectPolicyCode(result.error, 'MEMBER_SELF_ESCALATION')
    expect(err.details?.['envelopeItems']).toEqual([])
  })
})

// --- leader out-of-envelope ---------------------------------------------------------

describe('P3-T4 negative: leader out-of-envelope (invariant 36)', () => {
  it('leader template overlay outside the envelope fails with LEADER_OUT_OF_ENVELOPE', () => {
    const cap: CapabilityName = 'permissions'
    const env = envelopeFor(cap, ['a'])
    const input = baseInput({
      ...env,
      templateOverlay: {
        overlayId: 'ov-tpl-lead',
        kind: 'template',
        origin: 'leader',
        values: { [cap]: allow(['zz']) },
      },
    })
    const result = capture(() => resolveEffectivePolicy(input))
    if (result.ok) throw new Error('expected LEADER_OUT_OF_ENVELOPE, but the resolution succeeded')
    const err = expectPolicyCode(result.error, 'LEADER_OUT_OF_ENVELOPE')
    expect(err.details?.['origin']).toBe('leader')
    expect(err.details?.['overlayId']).toBe('ov-tpl-lead')
  })

  it('a leader-authorized instance overlay is bound by the SAME envelope', () => {
    const cap: CapabilityName = 'mcp'
    const env = envelopeFor(cap, ['a'])
    const input = baseInput({
      ...env,
      instanceOverlay: {
        overlayId: 'ov-ins-lead',
        kind: 'instance',
        origin: 'leader',
        values: { [cap]: allow(['zz']) },
      },
    })
    const result = capture(() => resolveEffectivePolicy(input))
    if (result.ok) throw new Error('expected LEADER_OUT_OF_ENVELOPE, but the resolution succeeded')
    const err = expectPolicyCode(result.error, 'LEADER_OUT_OF_ENVELOPE')
    expect(err.details?.['origin']).toBe('leader')
  })
})

describe('P3-T4 negative: fail-closed, never resolved around', () => {
  it('a violating member overlay throws even when the human override grants the same items', () => {
    const cap: CapabilityName = 'tools'
    const env = envelopeFor(cap, ['a'])
    const input = baseInput({
      ...env,
      instanceOverlay: {
        overlayId: 'ov-ins-fc',
        kind: 'instance',
        origin: 'member',
        values: { [cap]: allow(['zz']) },
      },
      humanOverride: {
        overrideId: 'ovh-fc',
        scope: 'team',
        values: { [cap]: allow(['a', 'zz']) },
      },
    })
    const result = capture(() => resolveEffectivePolicy(input))
    if (result.ok) throw new Error('expected the violating overlay to fail the resolution')
    expectPolicyCode(result.error, 'MEMBER_SELF_ESCALATION')
  })
})

// --- tightening --------------------------------------------------------------------

describe('P3-T4 negative: tightening (deny / lock / external)', () => {
  it('a locked state SUPPRESSES a stored allow overlay (S19.4): effective falls back, provenance preserves it', () => {
    const cap: CapabilityName = 'tools'
    const env = envelopeFor(cap, ['a', 'b', 'c'])
    const input = baseInput({
      ...env,
      template: { values: { [cap]: allow(['a', 'b']) }, mutationEnvelope: env.template.mutationEnvelope },
      policyState: { stateId: 'locked-validation', cells: { [cap]: { locked: true } } },
      instanceOverlay: {
        overlayId: 'ov-ins-sup',
        kind: 'instance',
        origin: 'member',
        values: { [cap]: allow(['c']) },
      },
    })
    const out = resolveEffectivePolicy(input)
    const cell = out.cells[cap]
    expect(cell.effective).toEqual(allow(['a', 'b']))
    expect(cell.team.layer).toBe('template')
    expect(cell.team.origin).toBe('static')
    expect(cell.team.recordId).toBe(null)
    expect(cell.team.suppressed).toEqual([
      {
        capability: cap,
        overlayId: 'ov-ins-sup',
        layer: 'instanceOverlay',
        origin: 'member',
        value: allow(['c']),
        reason: 'policyStateLocked',
        policyStateId: 'locked-validation',
      },
    ])
    expect(out.suppressed).toEqual(cell.team.suppressed)
    if (!cell.explanation.includes('; suppressed=[ov-ins-sup]')) {
      throw new Error(`explanation missing the suppressed marker: ${cell.explanation}`)
    }
    expect(out.policyStateId).toBe('locked-validation')
  })

  it('suppression never LOOSENS: the suppressed overlay cannot widen the effective value', () => {
    const cap: CapabilityName = 'model'
    const env = envelopeFor(cap, ['a', 'b'])
    const input = baseInput({
      ...env,
      template: { values: { [cap]: allow(['a']) }, mutationEnvelope: env.template.mutationEnvelope },
      policyState: { stateId: 'locked-validation', cells: { [cap]: { locked: true } } },
      instanceOverlay: {
        overlayId: 'ov-ins-widen',
        kind: 'instance',
        origin: 'member',
        values: { [cap]: allow(['a', 'b']) },
      },
    })
    const out = resolveEffectivePolicy(input)
    const cell = out.cells[cap]
    expect(cell.effective).toEqual(allow(['a']))
    expect(cell.team.suppressed[0]?.['overlayId']).toBe('ov-ins-widen')
  })

  it('a locked state does NOT suppress the human override (S19.5: override is not state-gated)', () => {
    const cap: CapabilityName = 'permissions'
    const env = envelopeFor(cap, ['a'])
    const input = baseInput({
      ...env,
      policyState: { stateId: 'locked-validation', cells: { [cap]: { locked: true } } },
      instanceOverlay: {
        overlayId: 'ov-ins-lk',
        kind: 'instance',
        origin: 'member',
        values: { [cap]: allow(['a']) },
      },
      humanOverride: {
        overrideId: 'ovh-lk',
        scope: 'team',
        values: { [cap]: allow(['z']) },
      },
    })
    const out = resolveEffectivePolicy(input)
    const cell = out.cells[cap]
    // The in-envelope member overlay IS suppressed by the lock, but the
    // human override is NOT state-gated and wins the cell.
    expect(cell.effective).toEqual(allow(['z']))
    expect(cell.team.layer).toBe('humanOverride')
    expect(cell.team.origin).toBe('human')
    expect(cell.team.recordId).toBe('ovh-lk')
    expect(cell.team.suppressed).toEqual([
      {
        capability: cap,
        overlayId: 'ov-ins-lk',
        layer: 'instanceOverlay',
        origin: 'member',
        value: allow(['a']),
        reason: 'policyStateLocked',
        policyStateId: 'locked-validation',
      },
    ])
  })

  it('a locked state does NOT suppress a deny overlay (suppression must never loosen)', () => {
    const cap: CapabilityName = 'skills'
    const input = baseInput({
      blueprint: { values: { [cap]: allow(['a']) } },
      policyState: { stateId: 'locked-validation', cells: { [cap]: { locked: true } } },
      instanceOverlay: {
        overlayId: 'ov-ins-deny',
        kind: 'instance',
        origin: 'member',
        values: { [cap]: deny() },
      },
    })
    const out = resolveEffectivePolicy(input)
    const cell = out.cells[cap]
    expect(cell.effective).toEqual(deny())
    expect(cell.team.layer).toBe('instanceOverlay')
    expect(cell.team.origin).toBe('member')
    expect(cell.team.suppressed).toEqual([])
    expect(out.suppressed).toEqual([])
  })

  it('external hard allow tightens the strongest team layer with exact removed-item provenance', () => {
    const cap: CapabilityName = 'tools'
    const input = baseInput({
      humanOverride: {
        overrideId: 'ovh-th',
        scope: 'team',
        values: { [cap]: allow(['a', 'b', 'c']) },
      },
      external: { hard: { [cap]: allow(['b']) }, capabilityExists: {} },
    })
    const out = resolveEffectivePolicy(input)
    const cell = out.cells[cap]
    expect(cell.effective).toEqual(allow(['b']))
    expect(cell.team.layer).toBe('humanOverride')
    expect(cell.external.removedItems).toEqual(['a', 'c'])
    expect(cell.external.note).toBe('none')
  })

  it('a higher-layer deny tightens a lower-layer allow (human deny over blueprint allow)', () => {
    const cap: CapabilityName = 'model'
    const input = baseInput({
      blueprint: { values: { [cap]: allow(['a', 'b']) } },
      humanOverride: {
        overrideId: 'ovh-hd',
        scope: 'team',
        values: { [cap]: deny() },
      },
    })
    const out = resolveEffectivePolicy(input)
    const cell = out.cells[cap]
    expect(cell.effective).toEqual(deny())
    expect(cell.team.layer).toBe('humanOverride')
    expect(cell.team.overriddenLower).toEqual([
      { layer: 'blueprint', origin: 'static', recordId: null, value: allow(['a', 'b']) },
    ])
  })
})

// --- malformed input -----------------------------------------------------------------

describe('P3-T4 negative: malformed input (MALFORMED_POLICY_INPUT)', () => {
  function malformedError(mutate: (input: EffectivePolicyInput) => void): unknown {
    const input = baseInput()
    mutate(input)
    const result = capture(() => resolveEffectivePolicy(input))
    if (result.ok) throw new Error('expected MALFORMED_POLICY_INPUT, but the resolution succeeded')
    return result.error
  }
  const asMap = (value: unknown): Partial<Record<CapabilityName, PolicyEntry>> =>
    value as Partial<Record<CapabilityName, PolicyEntry>>

  it('rejects an unknown capability key in blueprint.values (closed set)', () => {
    expectPolicyCode(
      malformedError((input) => {
        input.blueprint = { values: asMap({ mcp2: deny() }) }
      }),
      'MALFORMED_POLICY_INPUT',
    )
  })

  it('rejects an unknown capability key in external.hard', () => {
    expectPolicyCode(
      malformedError((input) => {
        input.external = { hard: asMap({ quota: deny() }), capabilityExists: {} }
      }),
      'MALFORMED_POLICY_INPUT',
    )
  })

  it('rejects an unknown capability key in external.capabilityExists', () => {
    expectPolicyCode(
      malformedError((input) => {
        input.external = { hard: {}, capabilityExists: { quota: true } as unknown as Record<CapabilityName, boolean> }
      }),
      'MALFORMED_POLICY_INPUT',
    )
  })

  it('rejects an empty allow-list (use kind deny)', () => {
    expectPolicyCode(
      malformedError((input) => {
        input.blueprint = { values: asMap({ model: { kind: 'allow', items: [] } }) }
      }),
      'MALFORMED_POLICY_INPUT',
    )
  })

  it('rejects duplicate items in an allow-list', () => {
    expectPolicyCode(
      malformedError((input) => {
        input.blueprint = { values: asMap({ model: { kind: 'allow', items: ['a', 'a'] } }) }
      }),
      'MALFORMED_POLICY_INPUT',
    )
  })

  it('rejects an empty-string item', () => {
    expectPolicyCode(
      malformedError((input) => {
        input.blueprint = { values: asMap({ model: { kind: 'allow', items: [''] } }) }
      }),
      'MALFORMED_POLICY_INPUT',
    )
  })

  it('rejects extra fields on a deny entry', () => {
    expectPolicyCode(
      malformedError((input) => {
        input.blueprint = { values: asMap({ model: { kind: 'deny', items: ['a'] } }) }
      }),
      'MALFORMED_POLICY_INPUT',
    )
  })

  it('rejects an unknown entry kind', () => {
    expectPolicyCode(
      malformedError((input) => {
        input.blueprint = { values: asMap({ model: { kind: 'maybe' } }) }
      }),
      'MALFORMED_POLICY_INPUT',
    )
  })

  it('rejects an overlay kind that does not match its slot (templateOverlay must be kind template)', () => {
    expectPolicyCode(
      malformedError((input) => {
        input.templateOverlay = {
          overlayId: 'ov-1',
          kind: 'instance',
          origin: 'leader',
          values: { tools: allow(['a']) },
        }
      }),
      'MALFORMED_POLICY_INPUT',
    )
  })

  it('rejects an overlay kind that does not match its slot (instanceOverlay must be kind instance)', () => {
    expectPolicyCode(
      malformedError((input) => {
        input.instanceOverlay = {
          overlayId: 'ov-1',
          kind: 'template',
          origin: 'member',
          values: { tools: allow(['a']) },
        }
      }),
      'MALFORMED_POLICY_INPUT',
    )
  })

  it('rejects a human override as an overlay origin (human authority is not an overlay origin)', () => {
    expectPolicyCode(
      malformedError((input) => {
        input.templateOverlay = {
          overlayId: 'ov-1',
          kind: 'template',
          origin: 'human' as 'leader',
          values: { tools: allow(['a']) },
        }
      }),
      'MALFORMED_POLICY_INPUT',
    )
  })

  it('rejects an empty overlay id', () => {
    expectPolicyCode(
      malformedError((input) => {
        input.templateOverlay = {
          overlayId: '',
          kind: 'template',
          origin: 'leader',
          values: { tools: allow(['a']) },
        }
      }),
      'MALFORMED_POLICY_INPUT',
    )
  })

  it('rejects an unknown human override scope', () => {
    expectPolicyCode(
      malformedError((input) => {
        input.humanOverride = {
          overrideId: 'ovh-1',
          scope: 'global' as 'team',
          values: { tools: allow(['a']) },
        }
      }),
      'MALFORMED_POLICY_INPUT',
    )
  })

  it('rejects a non-boolean capabilityExists value', () => {
    expectPolicyCode(
      malformedError((input) => {
        input.external = { hard: {}, capabilityExists: { model: 'yes' as unknown as boolean } }
      }),
      'MALFORMED_POLICY_INPUT',
    )
  })

  it('rejects a missing external.capabilityExists record (it is required, possibly empty)', () => {
    expectPolicyCode(
      malformedError((input) => {
        input.external = { hard: {} } as unknown as ExternalPolicyFacts
      }),
      'MALFORMED_POLICY_INPUT',
    )
  })

  it('rejects a whitespace-bearing policyState.stateId', () => {
    expectPolicyCode(
      malformedError((input) => {
        input.policyState = { stateId: 'bad state' }
      }),
      'MALFORMED_POLICY_INPUT',
    )
  })

  it('rejects extra fields on a policyState cell', () => {
    expectPolicyCode(
      malformedError((input) => {
        input.policyState = {
          stateId: 'default',
          cells: { model: { locked: true, extra: 1 } as { locked: boolean } },
        }
      }),
      'MALFORMED_POLICY_INPUT',
    )
  })
})

// --- identity boundary errors ---------------------------------------------------

describe('P3-T4 negative: identity boundary errors (contracts-v1 mirror)', () => {
  it('a cross-scope member identity fails with IDENTITY_SCOPE_MISMATCH (policy error)', () => {
    const otherRoot = parseRootSessionId('session-root-2')
    const otherMember = createMemberIdentity(otherRoot, parseInstanceId('inst-a'))
    const result = capture(() => resolveEffectivePolicy(baseInput({ member: otherMember })))
    if (result.ok) throw new Error('expected IDENTITY_SCOPE_MISMATCH, but the resolution succeeded')
    const info = expectPolicyCode(result.error, 'IDENTITY_SCOPE_MISMATCH')
    expect(info.details).toEqual({
      field: 'member',
      identityRootSessionId: 'session-root-2',
      teamSessionId: 'session-root-1',
      instanceId: 'inst-a',
    })
  })

  it('an invalid team session id fails with MALFORMED_POLICY_INPUT', () => {
    const result = capture(() =>
      resolveEffectivePolicy(baseInput({ teamSessionId: 'not a valid team session id' as typeof TEAM })),
    )
    if (result.ok) throw new Error('expected MALFORMED_POLICY_INPUT, but the resolution succeeded')
    const info = expectPolicyCode(result.error, 'MALFORMED_POLICY_INPUT')
    expect(info.details?.field).toBe('teamSessionId')
  })

  it('an invalid instance id fails with MALFORMED_POLICY_INPUT', () => {
    const badMember = createMemberIdentity(ROOT, 'INST-BAD' as ReturnType<typeof parseInstanceId>)
    const result = capture(() => resolveEffectivePolicy(baseInput({ member: badMember })))
    if (result.ok) throw new Error('expected MALFORMED_POLICY_INPUT, but the resolution succeeded')
    const info = expectPolicyCode(result.error, 'MALFORMED_POLICY_INPUT')
    expect(info.details?.field).toBe('instanceId')
  })
})

// --- deterministic seeded fuzz -----------------------------------------------------------

/** mulberry32 — a tiny deterministic 32-bit LCG (fixed seed: reproducible). */
function mulberry32(seed: number): () => number {
  let a = seed | 0
  return (): number => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FUZZ_POOL = ['a', 'b', 'c', 'd']
const FUZZ_ENVELOPE_ITEMS = ['a', 'b', 'c', 'd', 'e']

/** A random non-empty subset of the pool. */
function randomItems(rng: () => number): string[] {
  const items: string[] = []
  for (const item of FUZZ_POOL) {
    if (rng() < 0.5) items.push(item)
  }
  if (items.length === 0) items.push(FUZZ_POOL[0]!)
  return items
}

function fullEnvelope(): {
  blueprint: { autonomyEnvelope: Partial<Record<CapabilityName, PolicyEntry>> }
  template: { mutationEnvelope: Partial<Record<CapabilityName, PolicyEntry>> }
} {
  const envelope = allow([...FUZZ_ENVELOPE_ITEMS])
  const per = {} as Partial<Record<CapabilityName, PolicyEntry>>
  for (const cap of CAPABILITY_NAME_VALUES) per[cap] = envelope
  return {
    blueprint: { autonomyEnvelope: per },
    template: { mutationEnvelope: per },
  }
}

function randomExternal(rng: () => number): ExternalPolicyFacts {
  const hard: Partial<Record<CapabilityName, PolicyEntry>> = {}
  const capabilityExists: Partial<Record<CapabilityName, boolean>> = {}
  for (const cap of CAPABILITY_NAME_VALUES) {
    const roll = rng()
    if (roll < 0.2) hard[cap] = deny()
    else if (roll < 0.5) hard[cap] = allow(randomItems(rng))
    const existsRoll = rng()
    if (existsRoll < 0.15) capabilityExists[cap] = false
    else if (existsRoll < 0.25) capabilityExists[cap] = true
  }
  return { hard, capabilityExists }
}

describe('P3-T4 negative: deterministic seeded fuzz (mulberry32)', () => {
  it('300 positive inputs: external invariants + closed provenance vocabulary always hold', () => {
    const rng = mulberry32(0x5eed)
    for (let i = 0; i < 300; i++) {
      const envelope = fullEnvelope()
      let input = baseInput({
        blueprint: envelope.blueprint,
        template: envelope.template,
        external: randomExternal(rng),
      })
      // Random layer contributions (overlays stay in-envelope by construction).
      for (const cap of CAPABILITY_NAME_VALUES) {
        for (const layer of TEAM_LAYER_ORDER) {
          if (rng() < 0.3) {
            const entry = allow(randomItems(rng))
            if (layer === 'blueprint') input = { ...input, blueprint: { ...input.blueprint, values: { ...input.blueprint.values, [cap]: entry } } }
            else if (layer === 'policyState') input = { ...input, policyState: { stateId: 'default', cells: { ...input.policyState.cells, [cap]: { value: entry } } } }
            else if (layer === 'template') input = { ...input, template: { ...input.template, values: { ...input.template.values, [cap]: entry } } }
            else if (layer === 'templateOverlay') input = { ...input, templateOverlay: { overlayId: `ov-t-${i}`, kind: 'template', origin: rng() < 0.5 ? 'leader' : 'member', values: { [cap]: entry } } }
            else if (layer === 'instanceOverlay') input = { ...input, instanceOverlay: { overlayId: `ov-i-${i}`, kind: 'instance', origin: rng() < 0.5 ? 'leader' : 'member', values: { [cap]: entry } } }
            else if (layer === 'humanOverride') input = { ...input, humanOverride: { overrideId: `ovh-${i}`, scope: rng() < 0.5 ? 'team' : 'instance', values: { [cap]: entry } } }
          }
        }
      }

      const out = resolveEffectivePolicy(input)
      for (const cap of CAPABILITY_NAME_VALUES) {
        const cell = out.cells[cap]
        const hardEntry = input.external.hard[cap]
        const exists = input.external.capabilityExists[cap]

        expectOneOf(cell.team.layer, TEAM_LAYER_OR_UNSPECIFIED_VALUES, 'team.layer')
        expectOneOf(cell.team.origin, TEAM_VALUE_ORIGIN_VALUES, 'team.origin')
        expectOneOf(cell.external.note, ['none', 'capabilityMissing', 'externalHardDeny', 'externalHardRemovedAll'], 'external.note')

        if (cell.effective.kind === 'allow') {
          expect(cell.effective.items.length).toBeGreaterThan(0)
          if (hardEntry !== undefined && hardEntry.kind === 'allow') {
            const hardSet = new Set(hardEntry.items)
            for (const item of cell.effective.items) {
              if (!hardSet.has(item)) throw new Error(`fuzz: effective item '${item}' escapes the external hard allow on '${cap}'`)
            }
          }
          if (exists === false || (hardEntry !== undefined && hardEntry.kind === 'deny')) {
            throw new Error(`fuzz: capability missing / hard deny must deny '${cap}'`)
          }
        } else {
          if (cell.external.note === 'capabilityMissing') expect(exists).toBe(false)
          else if (cell.external.note === 'externalHardDeny') {
            expect(hardEntry?.kind).toBe('deny')
            expect(exists).not.toBe(false)
          } else if (cell.external.note === 'externalHardRemovedAll') {
            expect(hardEntry?.kind).toBe('allow')
          }
        }
      }
    }
  })

  it('200 escalation inputs: an out-of-envelope overlay ALWAYS fails with the origin-matching code', () => {
    const rng = mulberry32(0xf12e)
    for (let i = 0; i < 200; i++) {
      const envelope = fullEnvelope()
      const input: EffectivePolicyInput = {
        ...baseInput({
          blueprint: envelope.blueprint,
          template: envelope.template,
          external: randomExternal(rng),
        }),
      }
      const cap = CAPABILITY_NAME_VALUES[Math.floor(rng() * CAPABILITY_NAME_VALUES.length)]!
      const origin = rng() < 0.5 ? 'member' : 'leader'
      const badItems = ['zz', ...randomItems(rng)] // 'zz' is outside the envelope
      if (rng() < 0.5) {
        input.templateOverlay = { overlayId: `ov-t-${i}`, kind: 'template', origin, values: { [cap]: allow(badItems) } }
      } else {
        input.instanceOverlay = { overlayId: `ov-i-${i}`, kind: 'instance', origin, values: { [cap]: allow(badItems) } }
      }
      const result = capture(() => resolveEffectivePolicy(input))
      if (result.ok) throw new Error(`fuzz run ${i}: expected an escalation failure, but the resolution succeeded`)
      expectPolicyCode(result.error, origin === 'member' ? 'MEMBER_SELF_ESCALATION' : 'LEADER_OUT_OF_ENVELOPE')
      const details = isPolicyResolutionError(result.error) ? result.error.details : undefined
      expect(details?.['origin']).toBe(origin)
      expect(details?.['capability']).toBe(cap)
    }
  })
})
