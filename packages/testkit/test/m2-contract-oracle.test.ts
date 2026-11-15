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
  return ALL_DOMAINS.map((domain) => ({ domain, observed: false, instrumented: true, evidence: [] }))
}

/**
 * The M2 filesystem witness shape: it sees filesystem and honestly reports
 * process/network as blind.
 */
function fsWitness(observed: boolean, evidence: string[] = []): WitnessObservation[] {
  return [
    { domain: 'filesystem', observed, instrumented: true, evidence },
    { domain: 'process', observed: false, instrumented: false, evidence: ['not instrumented by the filesystem witness'] },
    { domain: 'network', observed: false, instrumented: false, evidence: ['not instrumented by the filesystem witness'] },
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
    authority_ref: 'decision-4711',
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
        authority_ref: 'decision-4711',
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

  it('a decision issued for another actor is VIOLATED', () => {
    // authority_ref is a DECISION id (design memo 05 §6), so the identity check
    // compares the decision's own subject (authority_actor_id), never the id.
    const events: TraceEvent[] = [
      denied(1),
      {
        event_seq: 2,
        event_type: 'tool.authority.computed',
        actor_id: 'member',
        authority_ref: 'decision-4711',
        authority_actor_id: 'officer',
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
    expect(judgement.reasons.join(' ')).toMatch(/another identity/)
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
          authority_ref: 'decision-4711',
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
          authority_ref: 'decision-4711',
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
      witness: ALL_DOMAINS.map((domain) => ({ domain, observed: false, instrumented: false, evidence: ['instrument disabled'] })),
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
      witness: ALL_DOMAINS.map((domain) => ({ domain, observed: false, instrumented: false, evidence: [] })),
      blindDomains: ALL_DOMAINS,
      requiredEffectDomains: ['filesystem'],
    })

    expect(judgement.verdict).toBe('INCONCLUSIVE')
    // Declared-blind is checked before the instrument flag: either way, a
    // trace-only judgement cannot be SATISFIED.
    expect(judgement.reasons.join(' ')).toMatch(/declared blind|cannot see them/)
  })
})

describe('TINF M2 contract oracle: a witness that attests nothing is not evidence', () => {
  it('fabricated rows without instrumented cannot be graded SATISFIED', () => {
    // The reviewer's CASE G: three rows that claim "no effect" but never claim
    // they could see anything. Witness is data; the instrument flag is capability.
    const fabricated: WitnessObservation[] = ALL_DOMAINS.map((domain) => ({
      domain,
      observed: false,
      instrumented: false,
      evidence: [],
    }))
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      events: [denied()],
      witness: fabricated,
      blindDomains: [],
      requiredEffectDomains: ['filesystem'],
    })

    expect(judgement.verdict).toBe('INCONCLUSIVE')
    expect(judgement.verdict).not.toBe('SATISFIED')
    // M7-A correction (blindness precedence): a row that admits `instrumented:
    // false` makes its domain blind even when the caller's list omits it, and
    // that rule fires before the weaker "cannot see them" branch. Either message
    // refuses to grade; the point is that the row can never reach SATISFIED.
    expect(judgement.reasons.join(' ')).toMatch(/declared blind by the witness/)
  })

  it('M7-A blindness precedence: an uninstrumented row is blind even when the caller forgets to list it', () => {
    // The exact shape the reviewer flagged: one row claims to see filesystem
    // while a second row for the SAME domain says `instrumented:false`. The
    // caller's `blindDomains` is empty. The instrument's own admission wins.
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      events: [denied()],
      witness: [
        { domain: 'filesystem', observed: false, instrumented: true, evidence: [] },
        { domain: 'filesystem', observed: false, instrumented: false, evidence: ['cannot see it'] },
      ],
      blindDomains: [],
      requiredEffectDomains: ['filesystem'],
    })
    expect(judgement.verdict).toBe('INCONCLUSIVE')
    expect(judgement.reasons.join(' ')).toMatch(/declared blind by the witness/)
  })

  it('an invented network row cannot cover a blind network domain', () => {
    // The reviewer's CASE H: required=network, the only real channel is
    // filesystem, and the caller adds one plausible-looking network row.
    const judgement = judgeContract({
      contractId: 'ISOLATION-01',
      events: [denied()],
      witness: [
        { domain: 'filesystem', observed: false, instrumented: true, evidence: [] },
        { domain: 'network', observed: false, instrumented: false, evidence: [] },
      ],
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['network'],
    })

    expect(judgement.verdict).toBe('INCONCLUSIVE')
    expect(judgement.reasons.join(' ')).toMatch(/declared blind by the witness: network/)
  })

  it('a DENIED event carrying an effect_id is VIOLATED even with a clean witness', () => {
    const events: TraceEvent[] = [{ ...denied(1), effect_id: 'eff-7' }]
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      events,
      witness: fsWitness(false),
      blindDomains: M2_BLIND,
      requiredEffectDomains: ['filesystem'],
    })

    expect(judgement.verdict).toBe('VIOLATED')
    expect(judgement.reasons.join(' ')).toMatch(/effect_id/)
  })

  it('an effect outside the graded scope is INCONCLUSIVE and named, not dismissed', () => {
    // The reviewer's CASE H (out-of-scope): process observed, contract graded on filesystem only.
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      events: [denied()],
      witness: [
        { domain: 'filesystem', observed: false, instrumented: true, evidence: [] },
        { domain: 'process', observed: true, instrumented: true, evidence: ['pid 4242 appeared'] },
      ],
      blindDomains: ['network'],
      requiredEffectDomains: ['filesystem'],
    })

    expect(judgement.verdict).toBe('INCONCLUSIVE')
    expect(judgement.reasons.join(' ')).toMatch(/outside the graded scope.*process/)
    expect(judgement.limitations.join(' ')).toMatch(/unexplained out-of-scope effect: process/)
  })

  it('a domain declared blind cannot be graded even if a row claims instrumented', () => {
    // Contradictory input is not a pass: the witness says it cannot see
    // filesystem while a row claims it can.
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      events: [denied()],
      witness: fsWitness(false),
      blindDomains: ['filesystem', 'process', 'network'],
      requiredEffectDomains: ['filesystem'],
    })

    expect(judgement.verdict).toBe('INCONCLUSIVE')
    expect(judgement.reasons.join(' ')).toMatch(/declared blind/)
  })

  it('a decision id in authority_ref is not an identity mismatch', () => {
    // Design memo 05 §6: authority_ref is "<decision-or-null>". Comparing it to
    // actor_id would fail every spec-conforming trace.
    const events: TraceEvent[] = [
      { ...denied(1), authority_ref: 'decision-4711' },
      {
        event_seq: 2,
        event_type: 'tool.authority.computed',
        actor_id: 'member',
        authority_ref: 'decision-4711',
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

    expect(judgement.verdict).toBe('SATISFIED')
  })

  // ── M7-A correction: SCOPE is graded, not assumed ──────────────────────────
  /** A filesystem row that watched `watched` and saw `observedPaths`. */
  function fsRow(watched: string[], observedPaths: string[] = []): WitnessObservation {
    return {
      domain: 'filesystem',
      observed: observedPaths.length > 0,
      instrumented: true,
      evidence: observedPaths,
      watchedPaths: watched,
      observedPaths,
    }
  }

  it('M7-A scope control: an effect outside the watched set is not SATISFIED', () => {
    // The reviewer's reproduction: the witness watched /w/one, the contract asks
    // about /w/other, and a file really exists there. A partial watch must answer
    // INCONCLUSIVE — never "no effect in filesystem".
    const judgement = judgeContract({
      contractId: 'SCOPE-01',
      events: [denied()],
      witness: [fsRow(['/w/one'])],
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      requiredEffectScope: ['/w/other/file.txt'],
    })
    expect(judgement.verdict).toBe('INCONCLUSIVE')
    expect(judgement.reasons.join(' ')).toMatch(/required effect scope is not covered by the witness/)
    expect(judgement.reasons.join(' ')).toMatch(/\/w\/other\/file\.txt/)
    expect(judgement.reasons.join(' ')).toMatch(/watched: \/w\/one/)
  })

  it('M7-A scope control: a declared scope with no watch set is INCONCLUSIVE', () => {
    const judgement = judgeContract({
      contractId: 'SCOPE-02',
      events: [denied()],
      witness: [{ domain: 'filesystem', observed: false, instrumented: true, evidence: [] }],
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      requiredEffectScope: ['/w/home'],
    })
    expect(judgement.verdict).toBe('INCONCLUSIVE')
    expect(judgement.reasons.join(' ')).toMatch(/nothing declared/)
  })

  it('M7-A scope control: a watched but UNauthorized effect is VIOLATED and named by path', () => {
    const judgement = judgeContract({
      contractId: 'SCOPE-03',
      events: [denied()],
      witness: [fsRow(['/w/home'], ['/w/home/tmp/escape.txt'])],
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      requiredEffectScope: ['/w/home'],
      authorizedEffectPaths: ['/w/home/workspace'],
    })
    expect(judgement.verdict).toBe('VIOLATED')
    expect(judgement.unauthorizedEffectPaths).toEqual(['/w/home/tmp/escape.txt'])
    expect(judgement.reasons.join(' ')).toMatch(/\/w\/home\/tmp\/escape\.txt/)
  })

  it('M7-A scope control: an AUTHORIZED observed effect is reported and excluded, never dropped', () => {
    const judgement = judgeContract({
      contractId: 'SCOPE-04',
      events: [denied(), { event_seq: 2, event_type: 'tool/result', actor_id: 'a', outcome: 'COMPLETED' }],
      witness: [fsRow(['/w/home'], ['/w/home/workspace/bash-wrote.txt'])],
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      requiredEffectScope: ['/w/home'],
      authorizedEffectPaths: ['/w/home/workspace'],
    })
    expect(judgement.verdict).toBe('SATISFIED')
    expect(judgement.observedEffectPaths).toContain('/w/home/workspace/bash-wrote.txt')
    expect(judgement.authorizedEffectPaths).toEqual(['/w/home/workspace/bash-wrote.txt'])
    expect(judgement.reasons.join(' ')).toMatch(/no effect outside the authorized set/)
    expect(judgement.reasons.join(' ')).toMatch(/bash-wrote\.txt/)
  })

  it('M7-A scope control: without an authorized set, the same observed effect is not a pass', () => {
    const judgement = judgeContract({
      contractId: 'SCOPE-05',
      events: [denied(), { event_seq: 2, event_type: 'tool/result', actor_id: 'a', outcome: 'COMPLETED' }],
      witness: [fsRow(['/w/home'], ['/w/home/workspace/any.txt'])],
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      requiredEffectScope: ['/w/home'],
    })
    expect(judgement.verdict).not.toBe('SATISFIED')
    expect(judgement.verdict).toBe('VIOLATED')
  })

  it('M7-A provenance control: witnessed rows without a declared scope are INSTRUMENT_ERROR', () => {
    const judgement = judgeContract({
      contractId: 'SCOPE-06',
      events: [denied()],
      witness: [fsRow(['/w/home'])],
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      witnessProvenance: 'witnessed',
    })
    expect(judgement.verdict).toBe('INSTRUMENT_ERROR')
    expect(judgement.reasons.join(' ')).toMatch(/declares no requiredEffectScope/)
  })

  it('M7-A scope control: a FORBIDDEN path inside an authorized root is unauthorized (deny beats allow)', () => {
    const judgement = judgeContract({
      contractId: 'SCOPE-07',
      events: [denied()],
      witness: [fsRow(['/w/home'], ['/w/home/tmp/forbidden/leak.txt'])],
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      requiredEffectScope: ['/w/home'],
      authorizedEffectPaths: ['/w/home/tmp'],
      forbiddenEffectPaths: ['/w/home/tmp/forbidden'],
    })
    expect(judgement.verdict).toBe('VIOLATED')
    expect(judgement.unauthorizedEffectPaths).toEqual(['/w/home/tmp/forbidden/leak.txt'])
    expect(judgement.authorizedEffectPaths).toEqual([])
  })

  it('M7-A scope control: an authorized effect elsewhere is still excluded when a sibling is forbidden', () => {
    const judgement = judgeContract({
      contractId: 'SCOPE-08',
      events: [
        denied(),
        { event_seq: 2, event_type: 'tool/result', actor_id: 'a', outcome: 'COMPLETED' },
      ],
      witness: [fsRow(['/w/home'], ['/w/home/tmp/ok/file.txt'])],
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      requiredEffectScope: ['/w/home'],
      authorizedEffectPaths: ['/w/home/tmp'],
      forbiddenEffectPaths: ['/w/home/tmp/forbidden'],
    })
    expect(judgement.verdict).toBe('SATISFIED')
    expect(judgement.authorizedEffectPaths).toEqual(['/w/home/tmp/ok/file.txt'])
  })
})
