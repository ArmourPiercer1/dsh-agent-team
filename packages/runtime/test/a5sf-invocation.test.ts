/**
 * a5sf-invocation — Alpha.5 P1-04 (Gate G1.4, part 1/2).
 *
 * The Invocation Binder mints ONE non-transferable call capability for the
 * tuple `memberIdentity / callId / policyRevision / toolBindingIdentity` and
 * pins every law the phase plan names: single use (no replay), one winner
 * under concurrent consumption, no transfer across member/tool/revision/call,
 * revocation, cold start (epoch bump) and a deterministic caller-supplied
 * lease. The capability is NOT a grant: it is the per-call binding reference
 * that carries the Alpha.4 `approvedOnce` input forward for audit.
 *
 * RED-first: every case here fails before `invocation.ts` exists.
 *
 * @module test/a5sf-invocation
 */
import { describe, expect, it } from 'vitest'
import {
  bindInvocation,
  bumpInvocationEpoch,
  consumeInvocation,
  createInvocationBinder,
  revokeInvocation,
  toInvocationAuthority,
} from '../member-io-policy/src/invocation.js'
import type {
  BindInvocationInput,
  InvocationBinder,
  InvocationCapability,
  InvocationConsumeRequest,
  TrustedMemberIdentity,
} from '../member-io-policy/src/types.js'

// --- fixtures ----------------------------------------------------------------

const TEAM = 'team.a5sf.p104'

function member(memberInstanceId: string): TrustedMemberIdentity {
  return { teamId: TEAM, memberInstanceId, templateId: 'alpha', instanceGeneration: 3 }
}

function bindInput(over: Partial<BindInvocationInput> = {}): BindInvocationInput {
  return {
    member: member('mi-alpha-1'),
    callId: 'call-1',
    policyRevision: 'rev-1',
    toolBindingIdentity: 'dsh.shell/bash',
    approvedOnce: true,
    lease: null,
    ...over,
  }
}

function useRequest(over: Partial<InvocationConsumeRequest> = {}): InvocationConsumeRequest {
  return {
    memberIdentity: 'mi-alpha-1',
    callId: 'call-1',
    policyRevision: 'rev-1',
    toolBindingIdentity: 'dsh.shell/bash',
    ...over,
  }
}

function expectRefusal(result: { ok: true } | { ok: false; code: string }, code: string): void {
  if (result.ok) throw new Error(`expected refusal ${code}, got an accepted result`)
  expect(result.code).toBe(code)
}

function bound(binder: InvocationBinder, input: BindInvocationInput = bindInput()): InvocationCapability {
  const result = binder.bind(input)
  if (!result.ok) throw new Error(`expected a capability, got ${result.code}: ${result.detail}`)
  return result.value
}

// --- P1-04 RED laws: single use / concurrency --------------------------------

describe('P1-04 · one frozen capability for exactly one audited tuple', () => {
  it('carries the full tuple plus epoch, lease and the Alpha.4 approval input', () => {
    const binder = createInvocationBinder()
    const capability = bound(binder, bindInput({ lease: { expiresAt: 5_000 } }))

    expect(capability).toEqual({
      memberIdentity: 'mi-alpha-1',
      callId: 'call-1',
      policyRevision: 'rev-1',
      toolBindingIdentity: 'dsh.shell/bash',
      epoch: 1,
      memberEpoch: 0,
      approvedOnce: true,
      singleUse: true,
      lease: { expiresAt: 5_000 },
    })
    expect(Object.isFrozen(capability)).toBe(true)
    expect(Object.isFrozen(capability.lease)).toBe(true)
  })

  it('a one-shot capability is consumed exactly once; the replay is typed', () => {
    const binder = createInvocationBinder()
    const capability = bound(binder)

    const first = binder.consume(capability, useRequest({ now: 100 }))
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.value).toEqual({
      memberIdentity: 'mi-alpha-1',
      callId: 'call-1',
      policyRevision: 'rev-1',
      toolBindingIdentity: 'dsh.shell/bash',
      epoch: 1,
      memberEpoch: 0,
      approvedOnce: true,
      consumedAt: 100,
    })
    expect(Object.isFrozen(first.value)).toBe(true)

    expectRefusal(binder.consume(capability, useRequest({ now: 101 })), 'CAPABILITY_CONSUMED')
  })

  it('two concurrent consumes produce exactly ONE winner (no check-then-mark window)', async () => {
    const binder = createInvocationBinder()
    const capability = bound(binder)

    const results = await Promise.all([
      Promise.resolve().then(() => binder.consume(capability, useRequest({ now: 10 }))),
      Promise.resolve().then(() => binder.consume(capability, useRequest({ now: 10 }))),
    ])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    const loser = results[0]?.ok ? results[1] : results[0]
    if (loser === undefined || loser.ok) throw new Error('expected one losing consume')
    expect(loser.code).toBe('CAPABILITY_CONSUMED')
  })

  it('projection refuses a CONSUMED capability (no replay into another compile)', () => {
    const binder = createInvocationBinder()
    const capability = bound(binder)
    expect(toInvocationAuthority(capability, binder).ok).toBe(true)
    expect(binder.consume(capability, useRequest({ now: 1 })).ok).toBe(true)
    expect(toInvocationAuthority(capability, binder)).toMatchObject({ ok: false, code: 'CAPABILITY_CONSUMED' })
  })

  it('projection requires and checks the caller clock for a leased capability', () => {
    const binder = createInvocationBinder()
    const capability = bound(binder, bindInput({ lease: { expiresAt: 100 } }))
    expect(toInvocationAuthority(capability, binder)).toMatchObject({ ok: false, code: 'CAPABILITY_LEASE_UNVERIFIED' })
    expect(toInvocationAuthority(capability, binder, 50).ok).toBe(true)
    expect(toInvocationAuthority(capability, binder, 101)).toMatchObject({ ok: false, code: 'CAPABILITY_LEASE_EXPIRED' })
  })

  it('the module-level binder API exists and is one-shot too', () => {
    const minted = bindInvocation(bindInput({ callId: 'call-module-1' }))
    expect(minted.ok).toBe(true)
    if (!minted.ok) return
    const first = consumeInvocation(minted.value, useRequest({ callId: 'call-module-1' }))
    expect(first.ok).toBe(true)
    const replay = consumeInvocation(minted.value, useRequest({ callId: 'call-module-1' }))
    expectRefusal(replay, 'CAPABILITY_CONSUMED')
  })
})

// --- P1-04 RED laws: non-transferability -------------------------------------

describe('P1-04 · a capability never transfers', () => {
  it('refuses another member, another tool binding, another revision and another call', () => {
    const binder = createInvocationBinder()
    const capability = bound(binder)

    expectRefusal(binder.consume(capability, useRequest({ memberIdentity: 'mi-beta-1' })), 'CAPABILITY_MEMBER_MISMATCH')
    expectRefusal(binder.consume(capability, useRequest({ toolBindingIdentity: 'dsh.fs/read' })), 'CAPABILITY_BINDING_MISMATCH')
    expectRefusal(binder.consume(capability, useRequest({ policyRevision: 'rev-2' })), 'CAPABILITY_REVISION_MISMATCH')
    expectRefusal(binder.consume(capability, useRequest({ callId: 'call-2' })), 'CAPABILITY_CALL_MISMATCH')

    // A refused transfer never burns the legitimate call.
    expect(binder.consume(capability, useRequest()).ok).toBe(true)
  })

  it('a consumed capability is never reusable for another call', () => {
    const binder = createInvocationBinder()
    const capability = bound(binder)
    expect(binder.consume(capability, useRequest()).ok).toBe(true)

    expectRefusal(binder.consume(capability, useRequest({ callId: 'call-other' })), 'CAPABILITY_CALL_MISMATCH')
    expectRefusal(binder.consume(capability, useRequest({ memberIdentity: 'mi-beta-1' })), 'CAPABILITY_MEMBER_MISMATCH')
  })

  it('is unforgeable by shape alone and frozen against mutation', () => {
    const binder = createInvocationBinder()
    const capability = bound(binder)

    // A structurally identical copy (spread / JSON clone) is NOT a capability.
    const copy = { ...capability }
    expectRefusal(binder.consume(copy, useRequest()), 'CAPABILITY_UNKNOWN')
    const clone = JSON.parse(JSON.stringify(capability)) as InvocationCapability
    expectRefusal(binder.consume(clone, useRequest()), 'CAPABILITY_UNKNOWN')
    expectRefusal(binder.consume({ ...capability, memberIdentity: 'mi-beta-1' }, useRequest()), 'CAPABILITY_UNKNOWN')

    // The forged attempts did not consume the real one.
    expect(binder.consume(capability, useRequest()).ok).toBe(true)

    // Frozen: mutation throws in strict mode.
    const mutable = capability as unknown as { memberIdentity: string }
    expect(() => {
      mutable.memberIdentity = 'mi-beta-1'
    }).toThrow(TypeError)
    expect(capability.memberIdentity).toBe('mi-alpha-1')
  })

  it('a binder never honours a capability minted by ANOTHER binder', () => {
    const binderA = createInvocationBinder()
    const binderB = createInvocationBinder()
    const capability = bound(binderA)

    expectRefusal(binderB.consume(capability, useRequest()), 'CAPABILITY_UNKNOWN')
    expect(binderA.consume(capability, useRequest()).ok).toBe(true)
  })
})

// --- P1-04 RED laws: revocation / cold start ---------------------------------

describe('P1-04 · revocation and cold start invalidate outstanding capabilities', () => {
  it('revoke(member) refuses every outstanding capability for that member only', () => {
    const binder = createInvocationBinder()
    const alphaOne = bound(binder, bindInput({ callId: 'call-a1' }))
    const alphaTwo = bound(binder, bindInput({ callId: 'call-a2' }))
    const beta = bound(binder, bindInput({ member: member('mi-beta-1'), callId: 'call-b1' }))

    const revoked = binder.revoke('mi-alpha-1')
    expect(revoked).toEqual({ ok: true, memberIdentity: 'mi-alpha-1', memberEpoch: 1, binderEpoch: 1 })

    expectRefusal(binder.consume(alphaOne, useRequest({ callId: 'call-a1' })), 'CAPABILITY_MEMBER_REVOKED')
    expectRefusal(binder.consume(alphaTwo, useRequest({ callId: 'call-a2' })), 'CAPABILITY_MEMBER_REVOKED')
    // Member-scoped: another member's capability survives.
    expect(binder.consume(beta, useRequest({ memberIdentity: 'mi-beta-1', callId: 'call-b1' })).ok).toBe(true)
  })

  it('binding after revoke is allowed only under the NEW member epoch', () => {
    const binder = createInvocationBinder()
    const stale = bound(binder, bindInput({ callId: 'call-old' }))
    binder.revoke('mi-alpha-1')

    const fresh = bound(binder, bindInput({ callId: 'call-new' }))
    expect(fresh.memberEpoch).toBe(1)
    expect(fresh.epoch).toBe(1)
    expectRefusal(binder.consume(stale, useRequest({ callId: 'call-old' })), 'CAPABILITY_MEMBER_REVOKED')
    expect(binder.consume(fresh, useRequest({ callId: 'call-new' })).ok).toBe(true)
  })

  it('a cold start / epoch bump invalidates capabilities minted in the previous epoch', () => {
    const binder = createInvocationBinder()
    const alpha = bound(binder, bindInput({ callId: 'call-a' }))
    const beta = bound(binder, bindInput({ member: member('mi-beta-1'), callId: 'call-b' }))

    const bumped = binder.bumpEpoch()
    expect(bumped).toEqual({ ok: true, epoch: 2 })

    expectRefusal(binder.consume(alpha, useRequest({ callId: 'call-a' })), 'CAPABILITY_EPOCH_STALE')
    expectRefusal(
      binder.consume(beta, useRequest({ memberIdentity: 'mi-beta-1', callId: 'call-b' })),
      'CAPABILITY_EPOCH_STALE',
    )

    const fresh = bound(binder, bindInput({ callId: 'call-a' }))
    expect(fresh.epoch).toBe(2)
    expect(binder.consume(fresh, useRequest({ callId: 'call-a' })).ok).toBe(true)
  })

  it('module-level revoke / bump helpers act on the module binder', () => {
    const minted = bindInvocation(bindInput({ callId: 'call-module-revoke' }))
    expect(minted.ok).toBe(true)
    if (!minted.ok) return
    expect(revokeInvocation('mi-alpha-1')).toEqual({
      ok: true,
      memberIdentity: 'mi-alpha-1',
      memberEpoch: 1,
      binderEpoch: 1,
    })
    expectRefusal(
      consumeInvocation(minted.value, useRequest({ callId: 'call-module-revoke' })),
      'CAPABILITY_MEMBER_REVOKED',
    )
    expect(bumpInvocationEpoch()).toEqual({ ok: true, epoch: 2 })
  })
})

// --- P1-04 RED laws: deterministic lease -------------------------------------

describe('P1-04 · lease expiry is deterministic (no wall clock inside the module)', () => {
  it('expires only after the caller-supplied expiry; the boundary is still valid', () => {
    const binder = createInvocationBinder()
    const before = bound(binder, bindInput({ callId: 'call-before', lease: { expiresAt: 2_000 } }))
    const boundary = bound(binder, bindInput({ callId: 'call-boundary', lease: { expiresAt: 2_000 } }))
    const after = bound(binder, bindInput({ callId: 'call-after', lease: { expiresAt: 2_000 } }))

    expect(binder.consume(before, useRequest({ callId: 'call-before', now: 1_999 })).ok).toBe(true)
    expect(binder.consume(boundary, useRequest({ callId: 'call-boundary', now: 2_000 })).ok).toBe(true)
    expectRefusal(
      binder.consume(after, useRequest({ callId: 'call-after', now: 2_001 })),
      'CAPABILITY_LEASE_EXPIRED',
    )
  })

  it('an explicit expiry without a caller clock is refused (never silently skipped)', () => {
    const binder = createInvocationBinder()
    const capability = bound(binder, bindInput({ lease: { expiresAt: 2_000 } }))

    expectRefusal(binder.consume(capability, useRequest()), 'CAPABILITY_LEASE_UNVERIFIED')
    // The refusal did not consume the capability.
    expect(binder.consume(capability, useRequest({ now: 1_500 })).ok).toBe(true)
  })

  it('a capability without a lease consumes with or without a clock', () => {
    const binder = createInvocationBinder()
    const noClock = bound(binder, bindInput({ callId: 'call-no-clock' }))
    const withClock = bound(binder, bindInput({ callId: 'call-with-clock' }))
    expect(binder.consume(noClock, useRequest({ callId: 'call-no-clock' })).ok).toBe(true)
    expect(binder.consume(withClock, useRequest({ callId: 'call-with-clock', now: 999_999 })).ok).toBe(true)
  })
})

// --- P1-04 RED laws: trusted inputs + authority projection -------------------

describe('P1-04 · binding consumes trusted inputs and never guesses', () => {
  it('refuses an incomplete trusted member identity and blank tuple fields', () => {
    const binder = createInvocationBinder()
    expectRefusal(binder.bind(bindInput({ member: { ...member(''), memberInstanceId: '' } })), 'CAPABILITY_INPUT_INVALID')
    expectRefusal(binder.bind(bindInput({ member: { ...member('mi-alpha-1'), teamId: '' } })), 'CAPABILITY_INPUT_INVALID')
    expectRefusal(binder.bind(bindInput({ callId: '   ' })), 'CAPABILITY_INPUT_INVALID')
    expectRefusal(binder.bind(bindInput({ policyRevision: '' })), 'CAPABILITY_INPUT_INVALID')
    expectRefusal(binder.bind(bindInput({ toolBindingIdentity: '' })), 'CAPABILITY_INPUT_INVALID')
  })

  it('refuses a malformed lease instead of ignoring its expiry', () => {
    const binder = createInvocationBinder()
    expectRefusal(binder.bind(bindInput({ lease: { expiresAt: Number.NaN } })), 'CAPABILITY_INPUT_INVALID')
    expectRefusal(binder.bind(bindInput({ lease: { expiresAt: Number.POSITIVE_INFINITY } })), 'CAPABILITY_INPUT_INVALID')
    expectRefusal(
      binder.bind(bindInput({ lease: {} as unknown as { expiresAt: number } })),
      'CAPABILITY_INPUT_INVALID',
    )
  })

  it('projects the audited tuple into the P1-02 InvocationAuthority input (no grant)', () => {
    const binder = createInvocationBinder()
    const capability = bound(binder, bindInput({ approvedOnce: false }))
    const authority = toInvocationAuthority(capability)

    expect(authority).toEqual({
      ok: true,
      value: {
        memberIdentity: 'mi-alpha-1',
        callId: 'call-1',
        policyRevision: 'rev-1',
        toolBindingIdentity: 'dsh.shell/bash',
        approvedOnce: false,
      },
    })
    if (!authority.ok) return
    expect(Object.isFrozen(authority.value)).toBe(true)

    expectRefusal(toInvocationAuthority({ ...capability }), 'CAPABILITY_UNKNOWN')

    binder.revoke('mi-alpha-1')
    expectRefusal(toInvocationAuthority(capability), 'CAPABILITY_MEMBER_REVOKED')
  })
})
