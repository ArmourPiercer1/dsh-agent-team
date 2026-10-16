/**
 * a5p2-admission-clock.test.ts — Alpha.5 PR2 HARD CLAUSE H1 (user verbatim
 * 05:4x/07:0xZ): "Admission 负责可信 clock 有限性 — any clock input entering
 * an authorization/expiry decision must be verified finite; NaN/±∞ → typed
 * fail-closed AND body=0 (zero call side effects); the expiry stays PR0's
 * strict `>`; the responsible layer is Admission, pinned by tests."
 *
 * The PR0 pair (`a5p0-grant-replay`) records what the `>` OPERATOR does with
 * a non-finite input (NaN/−∞ pass, +∞ "expires") — a defect record and the
 * precondition for this law, NOT a contract. This file pins the LAW:
 *
 *  1. the gate itself refuses every non-finite (and every non-number);
 *  2. the kernel refuses BEFORE anything side-effecting runs: no assurance
 *     probe, no approval plan, no mint, no ledger touch — the denial is the
 *     only event in the room (body = 0);
 *  3. the gate also stands at the consumption edge (the expiry leg): a NaN
 *     consumption refuses AND does not spend the grant;
 *  4. finite values (zero, negative, MAX_SAFE_INTEGER) pass the gate — the
 *     refusal is about FINITENESS, not plausibility;
 *  5. PR0's strict `>` expiry semantics survive unchanged (equal instant is
 *     NOT expired; one microsecond past IS).
 *
 * @module test/a5p2-admission-clock
 */
import { describe, expect, it } from 'vitest'
import { validateGrantForCall, type GrantConsumptionLedgerView } from '../../domain/tool-governance/src/index.js'
import { classifyClock, requireFiniteClock } from '../tool-admission/clock.js'
import { binding, effects, MEMBER, readEffect, REALM } from './a5p2-fixtures.js'
import { allowPolicy, makeHarness, recordPorts } from './a5p2-kernel-harness.js'

function requestOf(callId = 'call-h1') {
  return {
    binding: binding(),
    member: MEMBER,
    callId,
    realmId: REALM,
    parametersFingerprint: 'sha256:' + 'a'.repeat(64),
    requestedEffects: effects(readEffect()),
  }
}

describe('H1: the finite-clock gate (clock.ts)', () => {
  it('classifies every non-finite shape and accepts every finite one', () => {
    expect(classifyClock(Number.NaN)).toBe('nan')
    expect(classifyClock(Number.POSITIVE_INFINITY)).toBe('positive-infinity')
    expect(classifyClock(Number.NEGATIVE_INFINITY)).toBe('negative-infinity')
    expect(classifyClock('1737000000000')).toBe('not-a-number')
    expect(classifyClock(undefined)).toBe('not-a-number')
    expect(classifyClock(null)).toBe('not-a-number')
    expect(classifyClock(Date.now())).toBeNull()
    expect(classifyClock(0)).toBeNull()
    expect(classifyClock(-1)).toBeNull()
    expect(classifyClock(Number.MAX_SAFE_INTEGER)).toBeNull()
  })

  it('refuses non-finite with a typed APPROVAL_STALE error naming the leg', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, undefined, '123']) {
      const r = requireFiniteClock(bad, 'test')
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.error.code).toBe('APPROVAL_STALE')
        expect(r.error.details?.refusal).toBe('clock-not-finite')
        expect(r.error.sideEffectUnknown).toBeUndefined()
      }
    }
  })

  it('passes the SAME finite value back (a gate, not a converter)', () => {
    const r = requireFiniteClock(1737000000000, 'test')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(1737000000000)
  })
})

describe('H1: the kernel runs the gate FIRST with zero side effects (body=0)', () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'admit() with clock %s denies typed and touches nothing',
    async (badClock) => {
      const ports = recordPorts()
      const set = effects(readEffect())
      // Even a policy that WOULD allow everything and a probe that WOULD
      // answer cannot be reached: the clock gate precedes every leg.
      const { kernel } = makeHarness({
        clock: () => badClock,
        ports,
        policy: () => allowPolicy(set),
        requiredAssurance: () => ({ 'content-read': 'hard' }),
      })
      const decision = await kernel.admit(requestOf())
      expect(decision.ok).toBe(true)
      if (!decision.ok) return
      expect(decision.value.kind).toBe('denied')
      if (decision.value.kind !== 'denied') return
      expect(decision.value.error.code).toBe('APPROVAL_STALE')
      expect(decision.value.error.details?.refusal).toBe('clock-not-finite')
      // ZERO side effects: the probe never ran, nothing minted, the ledger
      // never saw the call, no approval was planned.
      expect(ports.probeCalls).toBe(0)
      expect(ports.registrations).toBe(0)
      expect(ports.consumptions).toBe(0)
      expect(ports.sequence).toEqual([])
    },
  )

  it('the consumption edge is gated too: a NaN now refuses and does NOT spend the grant', async () => {
    const set = effects(readEffect())
    const ledgerHarness = makeHarness({ policy: () => allowPolicy(set) })
    const decision = await ledgerHarness.kernel.admit(requestOf('call-h1b'))
    expect(decision.ok && decision.value.kind === 'admitted').toBe(true)
    if (!decision.ok || decision.value.kind !== 'admitted') return
    const grant = decision.value.grant
    const callFields = {
      currentAuthorityGeneration: 1,
      member: MEMBER,
      callId: 'call-h1b',
      realmId: REALM,
      bindingId: grant.bindingId,
      bindingRevision: grant.bindingRevision,
      parametersFingerprint: 'sha256:' + 'a'.repeat(64),
      requestedEffects: set,
    }
    // Same ledger, hostile clock: refuse BEFORE the PR0 validation runs.
    const ports2 = recordPorts()
    const hostile = makeHarness({ clock: () => Number.NaN, ports: ports2, ledger: ledgerHarness.ledger, policy: () => allowPolicy(set) })
    const refused = hostile.kernel.consumeForExecution(grant, callFields)
    expect(refused.ok).toBe(false)
    if (!refused.ok) {
      expect(refused.error.code).toBe('APPROVAL_STALE')
      expect(refused.error.details?.refusal).toBe('clock-not-finite')
    }
    expect(ports2.consumptions).toBe(0)
    // The NaN did NOT spend the grant: a finite clock still consumes it.
    const ok = ledgerHarness.kernel.consumeForExecution(grant, callFields)
    expect(ok.ok).toBe(true)
    expect(ledgerHarness.ledger.consumedCount()).toBe(1)
  })
})

describe('H1/P0-pin: PR0 strict `>` expiry semantics are unchanged', () => {
  const ledger: GrantConsumptionLedgerView = { isConsumed: () => false }
  const baseCall = {
    currentAuthorityGeneration: 1,
    member: MEMBER,
    callId: 'c',
    realmId: REALM,
    bindingId: 'b',
    bindingRevision: 1,
    parametersFingerprint: 'sha256:' + 'c'.repeat(64),
    requestedEffects: effects(readEffect()),
  }
  const grant = {
    grantId: 'g-1',
    member: MEMBER,
    callId: 'c',
    realmId: REALM,
    bindingId: 'b',
    bindingRevision: 1,
    authorityGeneration: 1,
    parametersFingerprint: baseCall.parametersFingerprint,
    effects: baseCall.requestedEffects,
    singleUse: true as const,
    issuedAt: 1000,
    expiresAt: 5000,
  }
  it('now === expiresAt is NOT expired (strict >, PR0-pinned)', () => {
    expect(validateGrantForCall(grant, { ...baseCall, now: 5000 }, ledger)).toEqual({ ok: true })
  })
  it('now > expiresAt is expired', () => {
    const r = validateGrantForCall(grant, { ...baseCall, now: 5001 }, ledger)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('grant-expired')
  })
})
