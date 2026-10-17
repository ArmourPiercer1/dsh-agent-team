/**
 * a5p4-phases — C-PROC phase closed set `probe → prepare → execute → terminate`
 * (INTERFACES-v1 C-PROC: 阶段闭集) and the `terminate ≠ cancel` law (aligned
 * with the C-GW cancellation boundary and the PR0 lease law).
 *
 * RED-first: written before `../sandbox-provider/phases.ts` existed.
 *
 * @module packages/runtime/test/a5p4-phases.test
 */

import { describe, expect, it } from 'vitest'
import {
  advancePhase,
  LEASE_STATUS_MIRROR,
  PROVIDER_PHASES,
  settleTermination,
} from '../sandbox-provider/phases.js'

describe('a5p4 phase closed set (C-PROC)', () => {
  it('states the closed set verbatim and in contract order', () => {
    expect([...PROVIDER_PHASES]).toEqual(['probe', 'prepare', 'execute', 'terminate'])
  })

  it('legal moves: probe→prepare, prepare→execute, execute→terminate, probe→probe (re-probe)', () => {
    for (const [from, to] of [
      ['probe', 'prepare'],
      ['prepare', 'execute'],
      ['execute', 'terminate'],
      ['probe', 'probe'],
    ] as const) {
      const r = advancePhase(from, to)
      expect(r, `${from}->${to}`).toEqual({ ok: true, phase: to })
    }
  })

  it('abort-before-exec: prepare→terminate is legal and is the ZERO-PROCESS leg (no execute phase was entered)', () => {
    const r = advancePhase('prepare', 'terminate')
    expect(r.ok).toBe(true)
  })

  it('refuses skipping a phase: probe→execute, probe→terminate, prepare→probe', () => {
    for (const [from, to] of [
      ['probe', 'execute'],
      ['probe', 'terminate'],
      ['prepare', 'probe'],
    ] as const) {
      const r = advancePhase(from, to)
      expect(r.ok, `${from}->${to}`).toBe(false)
      if (!r.ok) expect(r.problems.some((p) => p.code === 'phase-skipped'), `${from}->${to}`).toBe(true)
    }
  })

  it('terminate is absorbing: every move out of it is refused (phase-absorbed)', () => {
    for (const to of PROVIDER_PHASES) {
      const r = advancePhase('terminate', to)
      expect(r.ok, `terminate->${to}`).toBe(false)
      if (!r.ok) expect(r.problems.some((p) => p.code === 'phase-absorbed'), `terminate->${to}`).toBe(true)
    }
  })

  it('a name outside the closed set is a value-outside-closed-set refusal, never an implicit accept', () => {
    const r = advancePhase('probe', 'spawn-now' as never)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problems.some((p) => p.code === 'value-outside-closed-set'), 'unknown phase').toBe(true)
  })
})

describe('a5p4 terminate ≠ cancel (C-GW boundary)', () => {
  it('the lease-status mirror names cancelling BETWEEN active and the terminal', () => {
    expect([...LEASE_STATUS_MIRROR]).toEqual(['active', 'cancelling', 'termination-unconfirmed', 'terminated'])
  })

  it('a confirmed settlement yields terminated with sideEffectUnknown false', () => {
    const s = settleTermination(true)
    expect(s).toEqual({ settlement: 'settled-confirmed', leaseStatus: 'terminated', sideEffectUnknown: false })
  })

  it('an unconfirmed settlement yields termination-unconfirmed, carries the §5 code and sideEffectUnknown true', () => {
    const s = settleTermination(false)
    expect(s.settlement).toBe('settled-unconfirmed')
    expect(s.leaseStatus).toBe('termination-unconfirmed')
    expect(s.sideEffectUnknown).toBe(true)
    expect(s.errorCode).toBe('EXECUTION_TERMINATION_UNCONFIRMED')
  })

  it('cancel is a REQUEST on the lease, never a phase and never a settlement: the closed sets keep them apart', () => {
    // The phase set has no 'cancel'; the lease statuses carry 'cancelling'.
    expect(PROVIDER_PHASES).not.toContain('cancel' as never)
    expect(LEASE_STATUS_MIRROR).toContain('cancelling')
    // And 'terminated' is reachable only through a settlement, never through the request itself.
    expect(advancePhase('execute', 'terminate').ok).toBe(true)
    const unconfirmed = settleTermination(false)
    expect(unconfirmed.leaseStatus).not.toBe('terminated')
  })
})
