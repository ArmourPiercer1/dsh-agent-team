/**
 * a5p2-grant-oneshot.test.ts — Alpha.5 PR2 (plan §5): the ExecutionGrant is
 * SINGLE-USE: no replay, no cross-Member theft, no standing permission. The
 * refusal precedence and every reason→§5-code mapping are PR0's frozen ones
 * (`grantRefusalErrorCode`) — this file pins that PR2 REUSES them, and adds
 * the one-shot EDGE: validate-then-mark in one synchronous step, so two
 * interleaved async consumers produce exactly ONE winner.
 *
 * @module test/a5p2-grant-oneshot
 */
import { describe, expect, it } from 'vitest'
import { grantRefusalErrorCode, parseOperationGrant, type GrantCallContext, type OperationGrant } from '../../domain/tool-governance/src/index.js'
import { createGrantLedger, grantIdForCall, mintOperationGrant } from '../tool-admission/index.js'
import { binding, effects, MEMBER, readEffect, REALM, writeEffect } from './a5p2-fixtures.js'

const FP_A = 'sha256:' + 'a'.repeat(64)
const FP_B = 'sha256:' + 'b'.repeat(64)

function minted(over: Partial<Parameters<typeof mintOperationGrant>[0]> = {}): OperationGrant {
  const r = mintOperationGrant({
    grantId: 'grant-1',
    member: MEMBER,
    callId: 'call-1',
    realmId: REALM,
    bindingId: 'bind-bash-1',
    bindingRevision: 1,
    authorityGeneration: 1,
    parametersFingerprint: FP_A,
    effects: effects(readEffect()),
    issuedAt: 1000,
    expiresAt: null,
    ...over,
  })
  if (!r.ok) throw new Error(`fixture mint rejected: ${r.error.message}`)
  return r.value
}

function callOf(grant: OperationGrant, over: Partial<GrantCallContext> = {}): GrantCallContext {
  return {
    currentAuthorityGeneration: grant.authorityGeneration,
    member: grant.member,
    callId: grant.callId,
    realmId: grant.realmId,
    bindingId: grant.bindingId,
    bindingRevision: grant.bindingRevision,
    parametersFingerprint: grant.parametersFingerprint,
    requestedEffects: grant.effects,
    now: 1500,
    ...over,
  }
}

describe('the mint runs through the frozen grammar before anyone holds it', () => {
  it('a minted grant re-parses (PR0 grammar is the only grant shape)', () => {
    const grant = minted()
    const reparsed = parseOperationGrant(grant)
    expect(reparsed.ok).toBe(true)
    expect(grant.singleUse).toBe(true)
    expect(Object.isFrozen(grant)).toBe(true)
  })

  it('a mint the parser refuses never happens (typed refusal, nothing registered)', () => {
    const r = mintOperationGrant({
      grantId: 'grant-bad',
      member: MEMBER,
      callId: 'call-1',
      realmId: REALM,
      bindingId: 'b',
      bindingRevision: 1,
      authorityGeneration: 1,
      parametersFingerprint: 'nope',
      effects: effects(readEffect()),
      issuedAt: 1000,
      expiresAt: null,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.details?.refusal).toBe('mint-rejected')
  })
})

describe('the one-shot consumption edge', () => {
  it('happy path: consume once, and it is spent', () => {
    const ledger = createGrantLedger()
    const grant = minted()
    expect(ledger.register(grant).ok).toBe(true)
    const first = ledger.consume(grant.grantId, callOf(grant))
    expect(first.ok).toBe(true)
    const second = ledger.consume(grant.grantId, callOf(grant))
    expect(second.ok).toBe(false)
    if (!second.ok) {
      expect(second.reason).toBe('grant-consumed')
      expect(second.errorCode).toBe('APPROVAL_STALE')
    }
    expect(ledger.consumedCount()).toBe(1)
  })

  it('a consumed grant never re-opens via a DIFFERENT call identity either', async () => {
    const ledger = createGrantLedger()
    const grant = minted()
    ledger.register(grant)
    expect(ledger.consume(grant.grantId, callOf(grant)).ok).toBe(true)
    // even a call that now "matches better" cannot spend it again — and the
    // PR0 precedence is intact: the fingerprint leg fires BEFORE consumption
    const other = ledger.consume(grant.grantId, callOf(grant, { parametersFingerprint: FP_B }))
    expect(other.ok).toBe(false)
    if (!other.ok) expect(other.reason).toBe('parameters-fingerprint-mismatch')
  })

  it('cross-Member theft refuses with the frozen mapping (TOOL_BINDING_UNVERIFIED)', () => {
    const ledger = createGrantLedger()
    const grant = minted()
    ledger.register(grant)
    const thief = ledger.consume(grant.grantId, callOf(grant, { member: { teamSessionId: 'ts-1', instanceId: 'inst-THIEF' } }))
    expect(thief.ok).toBe(false)
    if (!thief.ok) {
      expect(thief.reason).toBe('member-mismatch')
      expect(thief.errorCode).toBe(grantRefusalErrorCode('member-mismatch'))
    }
    // the real call can still spend it (the theft changed nothing)
    expect(ledger.consume(grant.grantId, callOf(grant)).ok).toBe(true)
  })

  it('cross-realm and stale-generation calls refuse with the frozen codes', () => {
    const ledger = createGrantLedger()
    const grant = minted()
    ledger.register(grant)
    const cross = ledger.consume(grant.grantId, callOf(grant, { realmId: 'realm-z' }))
    expect(!cross.ok && cross.errorCode).toBe('TOOL_BINDING_UNVERIFIED')
    const staleGen = ledger.consume(grant.grantId, callOf(grant, { currentAuthorityGeneration: 2 }))
    expect(!staleGen.ok && staleGen.errorCode).toBe('APPROVAL_STALE')
    const staleFp = ledger.consume(grant.grantId, callOf(grant, { parametersFingerprint: FP_B }))
    expect(!staleFp.ok && staleFp.errorCode).toBe('APPROVAL_STALE')
  })

  it('an effect OUTSIDE the granted set is the frozen TOOL_BINDING_UNVERIFIED (H3 mapping kept)', () => {
    const ledger = createGrantLedger()
    const grant = minted()
    ledger.register(grant)
    const wider = effects(readEffect(), writeEffect())
    const r = ledger.consume(grant.grantId, callOf(grant, { requestedEffects: wider }))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('effect-outside-grant')
      expect(r.errorCode).toBe('TOOL_BINDING_UNVERIFIED')
    }
  })

  it('a NaN now refuses the consumption EDGE before validation, spending nothing (H1 at the ledger)', () => {
    const ledger = createGrantLedger()
    const grant = minted()
    ledger.register(grant)
    const bad = ledger.consume(grant.grantId, callOf(grant, { now: Number.NaN }))
    expect(bad.ok).toBe(false)
    if (!bad.ok) {
      expect(bad.reason).toBe('clock-not-finite')
      expect(bad.errorCode).toBe('APPROVAL_STALE')
    }
    expect(ledger.consumedCount()).toBe(0)
    expect(ledger.consume(grant.grantId, callOf(grant)).ok).toBe(true)
  })

  it('two interleaved async consumers: exactly ONE winner (the race is decided, not deferred)', async () => {
    const ledger = createGrantLedger()
    const grant = minted()
    ledger.register(grant)
    const results = await Promise.all([
      (async () => ledger.consume(grant.grantId, callOf(grant, { now: 1500 })))(),
      (async () => {
        await Promise.resolve()
        return ledger.consume(grant.grantId, callOf(grant, { now: 1501 }))
      })(),
    ])
    const winners = results.filter((r) => r.ok)
    expect(winners).toHaveLength(1)
    const losers = results.filter((r) => !r.ok) as Array<{ ok: false; reason: string }>
    expect(losers[0]?.reason).toBe('grant-consumed')
  })

  it('a grantId is never re-issued: registering a DIFFERENT grant under a live id is refused', () => {
    const ledger = createGrantLedger()
    const grant = minted()
    ledger.register(grant)
    const twin = minted({ callId: 'call-EVIL', parametersFingerprint: FP_B })
    const r = ledger.register(twin) // same 'grant-1' id, different grant
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.details?.refusal).toBe('grant-id-reuse')
  })

  it('an unregistered grant refuses (a grant never spends through a stranger ledger)', () => {
    const ledger = createGrantLedger()
    const strangerLedger = createGrantLedger()
    const grant = minted()
    strangerLedger.register(grant)
    const r = ledger.consume(grant.grantId, callOf(grant))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('unknown-grant')
  })
})

describe('grantIdForCall: deterministic, call-bound, generation-bound', () => {
  it('the same call mints the same id; every identity leg moves it', () => {
    const request = {
      binding: binding(),
      member: MEMBER,
      callId: 'call-9',
      realmId: REALM,
      parametersFingerprint: FP_A,
      requestedEffects: effects(readEffect()),
    }
    const id1 = grantIdForCall(request, 1)
    const id2 = grantIdForCall({ ...request, binding: binding() }, 1)
    expect(id1).toBe(id2)
    expect(grantIdForCall({ ...request, callId: 'call-10' }, 1)).not.toBe(id1)
    expect(grantIdForCall({ ...request, parametersFingerprint: FP_B }, 1)).not.toBe(id1)
    expect(grantIdForCall(request, 2)).not.toBe(id1)
  })
})
