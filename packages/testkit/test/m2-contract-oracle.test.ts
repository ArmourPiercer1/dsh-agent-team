/**
 * TINF M2 — contract oracle negative controls.
 *
 * Each test is a minimal red/green pair around one rule: a trace-only claim is
 * never enough, a DENIED row plus a real effect is a violation, a blind domain
 * or a broken sequence cannot be graded clean, and a cross-actor authority
 * reference fails the identity rule.
 */
import { describe, expect, it } from 'vitest'

import { judgeContract } from '../src/index.js'
import type { EffectDomain, TraceEvent, WitnessObservation } from '../src/index.js'

const ALL_DOMAINS: EffectDomain[] = ['filesystem', 'process', 'network']

/** A fully instrumented witness that saw nothing anywhere. */
function fullyInstrumentedNoEffect(): WitnessObservation[] {
  return ALL_DOMAINS.map((domain) => ({ domain, observed: false, evidence: [] }))
}

/**
 * The M2 filesystem witness shape: it sees filesystem and honestly reports
 * process/network as blind.
 */
function fsWitness(observed: boolean, evidence: string[] = []): WitnessObservation[] {
  return [
    { domain: 'filesystem', observed, evidence },
    { domain: 'process', observed: false, evidence: ['not instrumented by the filesystem witness'] },
    { domain: 'network', observed: false, evidence: ['not instrumented by the filesystem witness'] },
  ]
}

const M2_BLIND: EffectDomain[] = ['process', 'network']

/** A DENIED row whose authority names the same actor. */
function denied(seq = 1): TraceEvent {
  return {
    schema: 'agent-execution-event/1',
    event_seq: seq,
    event_type: 'tool.execution.denied',
    actor_id: 'member',
    execution_id: 'exec-1',
    authority_ref: 'member',
    outcome: 'DENIED',
    effect_id: null,
  }
}

describe('TINF M2 contract oracle: SATISFIED only with independent corroboration', () => {
  it('no effect + DENIED + full instrumentation is SATISFIED', () => {
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      events: [denied()],
      witness: fullyInstrumentedNoEffect(),
      blindDomains: [],
      requiredEffectDomains: ALL_DOMAINS,
    })

    expect(judgement.verdict).toBe('SATISFIED')
    expect(judgement.reasons.join(' ')).toMatch(/no effect/)
    expect(judgement.limitations.join(' ')).toMatch(/no effect domain was declared blind/)
  })

  it('the M2 filesystem witness can corroborate a filesystem-only contract and names the blind domains', () => {
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      events: [denied()],
      witness: fsWitness(false),
      blindDomains: M2_BLIND,
      requiredEffectDomains: ['filesystem'],
    })

    expect(judgement.verdict).toBe('SATISFIED')
    expect(judgement.limitations.join(' ')).toMatch(/not instrumented: process, network/)
  })
})

describe('TINF M2 contract oracle: VIOLATED', () => {
  it('DENIED plus a real effect is VIOLATED', () => {
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      events: [denied()],
      witness: fsWitness(true, ['outside/forbidden.txt']),
      blindDomains: M2_BLIND,
      requiredEffectDomains: ['filesystem'],
    })

    expect(judgement.verdict).toBe('VIOLATED')
    expect(judgement.reasons.join(' ')).toMatch(/DENIED/)
    expect(judgement.reasons.join(' ')).toMatch(/filesystem/)
  })

  it('a DISPATCHED event with null authority_ref while effects were observed is VIOLATED', () => {
    const events: TraceEvent[] = [
      {
        event_seq: 1,
        event_type: 'tool.authority.computed',
        actor_id: 'member',
        authority_ref: 'member',
        outcome: 'COMPUTED',
      },
      {
        event_seq: 2,
        event_type: 'tool.execution.dispatched',
        actor_id: 'member',
        authority_ref: null,
        outcome: 'DISPATCHED',
      },
    ]
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      events,
      witness: fsWitness(true, ['outside/forbidden.txt']),
      blindDomains: M2_BLIND,
      requiredEffectDomains: ['filesystem'],
    })

    expect(judgement.verdict).toBe('VIOLATED')
    expect(judgement.reasons.join(' ')).toMatch(/no authority_ref/)
  })

  it('a wrong-actor authority_ref is VIOLATED', () => {
    const events: TraceEvent[] = [
      denied(1),
      {
        event_seq: 2,
        event_type: 'tool.authority.computed',
        actor_id: 'member',
        authority_ref: 'officer',
        outcome: 'COMPUTED',
      },
    ]
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      events,
      witness: fsWitness(false),
      blindDomains: M2_BLIND,
      requiredEffectDomains: ['filesystem'],
    })

    expect(judgement.verdict).toBe('VIOLATED')
    expect(judgement.reasons.join(' ')).toMatch(/different actor/)
    expect(judgement.reasons.join(' ')).toMatch(/officer/)
    expect(judgement.reasons.join(' ')).toMatch(/member/)
  })
})

describe('TINF M2 contract oracle: fail-closed states', () => {
  it('a missing required domain is INCONCLUSIVE', () => {
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      events: [denied()],
      witness: fsWitness(false),
      blindDomains: M2_BLIND,
      requiredEffectDomains: ['filesystem', 'network'],
    })

    expect(judgement.verdict).toBe('INCONCLUSIVE')
    expect(judgement.reasons.join(' ')).toMatch(/network/)
  })

  it('a sequence regression is INSTRUMENT_ERROR', () => {
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      events: [denied(2), denied(1)],
      witness: fsWitness(false),
      blindDomains: M2_BLIND,
      requiredEffectDomains: ['filesystem'],
    })

    expect(judgement.verdict).toBe('INSTRUMENT_ERROR')
    expect(judgement.reasons.join(' ')).toMatch(/strictly increasing/)
  })

  it('an empty witness is INSTRUMENT_ERROR', () => {
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      events: [denied()],
      witness: [],
      blindDomains: [],
      requiredEffectDomains: ['filesystem'],
    })

    expect(judgement.verdict).toBe('INSTRUMENT_ERROR')
    expect(judgement.reasons.join(' ')).toMatch(/witness is empty/)
  })

  it('a trace with no computed/denied event is INCONCLUSIVE', () => {
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      events: [
        {
          event_seq: 1,
          event_type: 'tool.execution.dispatched',
          actor_id: 'member',
          authority_ref: 'member',
          outcome: 'DISPATCHED',
        },
      ],
      witness: fsWitness(false),
      blindDomains: M2_BLIND,
      requiredEffectDomains: ['filesystem'],
    })

    expect(judgement.verdict).toBe('INCONCLUSIVE')
    expect(judgement.reasons.join(' ')).toMatch(/no computed\/denied event/)
  })
})

describe('TINF M2 contract oracle: log text is not evidence', () => {
  it('a deny contract without a DENIED event is INCONCLUSIVE, not SATISFIED', () => {
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      events: [
        {
          event_seq: 1,
          event_type: 'tool.authority.computed',
          actor_id: 'member',
          authority_ref: 'member',
          outcome: 'COMPUTED',
        },
      ],
      witness: fsWitness(false),
      blindDomains: M2_BLIND,
      requiredEffectDomains: ['filesystem'],
    })

    expect(judgement.verdict).toBe('INCONCLUSIVE')
    expect(judgement.reasons.join(' ')).toMatch(/requires a DENIED event/)
  })

  it('all domains blind can never be SATISFIED', () => {
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      // The trace says everything a passing test would want to hear.
      events: [denied()],
      witness: ALL_DOMAINS.map((domain) => ({ domain, observed: false, evidence: ['instrument disabled'] })),
      blindDomains: ALL_DOMAINS,
      requiredEffectDomains: ALL_DOMAINS,
    })

    expect(judgement.verdict).not.toBe('SATISFIED')
    expect(judgement.verdict).toBe('INCONCLUSIVE')
  })

  it('a trace-only input (witness reports everything blind) is INCONCLUSIVE', () => {
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      events: [denied()],
      witness: ALL_DOMAINS.map((domain) => ({ domain, observed: false, evidence: [] })),
      blindDomains: ALL_DOMAINS,
      requiredEffectDomains: ['filesystem'],
    })

    expect(judgement.verdict).toBe('INCONCLUSIVE')
    expect(judgement.reasons.join(' ')).toMatch(/not instrumented/)
  })
})
