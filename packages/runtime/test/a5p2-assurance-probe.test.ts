/**
 * a5p2-assurance-probe.test.ts — Alpha.5 PR2 HARD CLAUSE H2 (user verbatim
 * 05:4x/07:0xZ): "assurance 运行时校验先于 hard-profile — a level must never
 * redeem a capability alone; runtime consumption of assurance must require
 * evidence/realmId/trustRoot to carry REAL values CONSISTENT with the probe
 * record; `enforced` + `null` mechanism = REFUSAL. Until PR4 the probe is an
 * injectable stub; the stub semantics live in the lane README."
 *
 * PR0 M-1 named the hole exactly: the schema can RECORD `enforced` with null
 * mechanism/evidence and pass. This file pins that the RUNTIME refuses it, in
 * both directions (level-sufficiency stays an honest capability answer;
 * level-claims need proof), and that the check happens BEFORE any mint —
 * the probe answers, then the ledger ever hears of the call.
 *
 * @module test/a5p2-assurance-probe
 */
import { describe, expect, it } from 'vitest'
import {
  createStubAssuranceProbe,
  verifyAssuranceForHardProfile,
  type AssuranceProbe,
} from '../tool-admission/assurance-runtime.js'
import { assuranceContract, binding, dimensionRecord, observed } from './a5p2-fixtures.js'

const HARD_READ = { 'content-read': 'hard' } as const
const AUTHORITATIVE_READ = { 'content-read': 'authoritative' } as const

function enforcedContract() {
  return assuranceContract({ 'content-read': dimensionRecord('enforced') })
}

describe('H2: the level never redeems a capability by itself', () => {
  it('enforced + full record + matching probe → verified', () => {
    const r = verifyAssuranceForHardProfile(enforcedContract(), HARD_READ, createStubAssuranceProbe({ 'content-read': observed() }), binding())
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.verified.map((v) => v.dimension)).toEqual(['content-read'])
      expect(r.value.verified[0]?.evidence).toBe('evidence/a5p4/probe.json')
    }
  })

  it('enforced + null mechanism → TOOL_BINDING_UNVERIFIED (the H2 example, verbatim)', () => {
    const contract = assuranceContract({ 'content-read': dimensionRecord('enforced', { mechanism: null }) })
    const r = verifyAssuranceForHardProfile(contract, HARD_READ, createStubProbeAllReal(), binding())
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('TOOL_BINDING_UNVERIFIED')
      expect(r.error.message).toContain('enforced+null')
    }
  })

  it('enforced + null trustRoot and enforced + null evidence refuse the same way', () => {
    for (const field of ['trustRoot', 'evidence'] as const) {
      const contract = assuranceContract({ 'content-read': dimensionRecord('enforced', { [field]: null }) })
      const r = verifyAssuranceForHardProfile(contract, HARD_READ, createStubProbeAllReal(), binding())
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.code).toBe('TOOL_BINDING_UNVERIFIED')
    }
  })

  it('a probe that cannot observe refuses the claim (an unevidenced enforced is not a maybe)', () => {
    const r = verifyAssuranceForHardProfile(enforcedContract(), HARD_READ, createStubAssuranceProbe({}), binding())
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('TOOL_BINDING_UNVERIFIED')
      expect(r.error.message).toContain('probe cannot observe')
    }
  })

  it('a claim that CONTRADICTS the probe refuses (any field, realmId included)', () => {
    for (const over of [
      { mechanism: 'seccomp-user-notify' },
      { trustRoot: 'os:kernel-6.6' },
      { evidence: 'evidence/a5p4/probe-old.json' },
      { realmId: 'realm-B' },
    ]) {
      const r = verifyAssuranceForHardProfile(enforcedContract(), HARD_READ, createStubAssuranceProbe({ 'content-read': observed(over) }), binding())
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.error.code).toBe('TOOL_BINDING_UNVERIFIED')
        expect(r.error.message).toContain('DIFFERENT record')
      }
    }
  })

  it('a level BELOW the demand is the honest capability answer, not a verification failure', () => {
    const contract = assuranceContract({ 'content-read': dimensionRecord('partial') })
    const r = verifyAssuranceForHardProfile(contract, HARD_READ, createStubProbeAllReal(), binding())
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('IO_POLICY_UNSUPPORTED')
      expect(r.error.message).toContain("'partial'")
    }
    // author-trusted satisfies `authoritative` but NEVER `hard` (PR0 law).
    const authorTrusted = assuranceContract({ 'content-read': dimensionRecord('author-trusted') })
    const hardAgainstAuthor = verifyAssuranceForHardProfile(authorTrusted, HARD_READ, createStubProbeAllReal(), binding())
    expect(hardAgainstAuthor.ok).toBe(false)
    if (!hardAgainstAuthor.ok) expect(hardAgainstAuthor.error.code).toBe('IO_POLICY_UNSUPPORTED')
    const authoritativeOk = verifyAssuranceForHardProfile(authorTrusted, AUTHORITATIVE_READ, createStubProbeAllReal(), binding())
    expect(authoritativeOk.ok).toBe(true)
  })

  it('reports EVERY failing demanded dimension, not the first (PR0 precedent)', () => {
    const contract = assuranceContract({
      'content-read': dimensionRecord('enforced', { mechanism: null }),
      write: dimensionRecord('untested'),
    })
    const r = verifyAssuranceForHardProfile(contract, { 'content-read': 'hard', write: 'hard' }, createStubAssuranceProbe({}), binding())
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.details?.dimensions).toBe('content-read,write')
      expect(r.error.message).toContain('2 demanded dimension(s)')
    }
  })
})

describe('H2: the stub probe is fail-closed by construction (README §stub)', () => {
  it('an unobserved dimension answers "no observation", and that REFUSES', () => {
    const stub = createStubAssuranceProbe({})
    const answer = stub(binding(), 'content-read')
    expect(answer.ok).toBe(false)
    if (!answer.ok) expect(answer.detail).toContain('no observation')
  })

  it('the stub reports EXACTLY what it was given — never an embellished record', () => {
    const stub = createStubAssuranceProbe({ 'content-read': observed({ mechanism: 'fixture-only' }) })
    const answer = stub(binding(), 'content-read')
    expect(answer.ok).toBe(true)
    if (answer.ok) expect(answer.mechanism).toBe('fixture-only')
  })

  it('the probe is consulted PER CALL with the binding in hand (the PR4 replacement contract)', () => {
    const seen: string[] = []
    const spy: AssuranceProbe = (b, d) => {
      seen.push(`${b.bindingId}:${d}`)
      return { ok: true, ...observed() }
    }
    const r = verifyAssuranceForHardProfile(enforcedContract(), HARD_READ, spy, binding())
    expect(r.ok).toBe(true)
    expect(seen).toEqual(['bind-bash-1:content-read'])
  })
})

function createStubProbeAllReal(): AssuranceProbe {
  return (_b, _d) => ({ ok: true, ...observed() })
}
