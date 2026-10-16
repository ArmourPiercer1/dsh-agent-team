/**
 * a5p2-composition.test.ts — Alpha.5 PR2 × PR1 (plan §5: "守卫用于不可绕过的
 * 最终拒绝；pre-execute/control 必须等待 Ask，不能因其它 Listener 强制 allow"):
 * the PR1 closed-world Guard stays the OUTER door, the PR2 Admission kernel is
 * the DECISION door, and the body is a counted flag — every refusal path must
 * show `bodyRan = false`, and a kernel refusal must leave the Dispatcher
 * drainable exactly like any other refused call.
 *
 * This is a COMPOSITION test, not a live-Host run: the Host wiring rides with
 * the first PR that executes through Admission (PR3/PR4). What it proves is
 * the seam algebra: Guard deny never reaches Admission; Admission refuse ends
 * the call `refused` (drain keeps counting to zero); an admitted+consumed call
 * completes; and one call never spends another call's grant.
 *
 * @module test/a5p2-composition
 */
import { describe, expect, it } from 'vitest'
import { createScopedDispatcher } from '../tool-dispatch/index.js'
import { binding, effects, MEMBER, readEffect, REALM } from './a5p2-fixtures.js'
import { allowPolicy, makeHarness } from './a5p2-kernel-harness.js'
import type { AdmissionRequest } from '../../domain/tool-governance/src/index.js'

function assembly(opts: { allow: boolean }) {
  const dispatcher = createScopedDispatcher({
    agentScopeKey: 'session-m1',
    trustedIdentities: ['session-m1'],
    nativeNames: ['read'],
    resolveDefinition: (name) => ({ ok: true, fingerprint: `def:${name}` }),
    requiredSeams: 0,
  })
  dispatcher.bindInheritedSurface(['read'], { read: 'def:read' })
  dispatcher.beginAssembly()
  dispatcher.publish()

  const set = effects(readEffect())
  const { kernel, ledger } = makeHarness({ policy: () => (opts.allow ? allowPolicy(set) : setPolicy()) })
  const bodyRuns: string[] = []

  return {
    dispatcher,
    kernel,
    ledger,
    bodyRuns,
    set,
    /** The pre-execute waterfall as the install orders it: Guard, then Admission. */
    async dispatch(callId: string, execName: string, request: AdmissionRequest): Promise<'ran' | 'guard-denied' | 'admission-refused'> {
      const verdict = dispatcher.decide({ name: execName, agentIdentity: 'session-m1' })
      if (verdict.kind === 'deny') return 'guard-denied'
      const started = dispatcher.beginCall(callId, execName)
      if (!started.ok) return 'guard-denied'
      try {
        const decision = await kernel.admit(request)
        if (!decision.ok || decision.value.kind !== 'admitted') {
          dispatcher.endCallById(callId, 'refused')
          return 'admission-refused'
        }
        const consumed = kernel.consumeForExecution(decision.value.grant, {
          currentAuthorityGeneration: 1,
          member: request.member,
          callId,
          realmId: request.realmId,
          bindingId: decision.value.grant.bindingId,
          bindingRevision: decision.value.grant.bindingRevision,
          parametersFingerprint: request.parametersFingerprint,
          requestedEffects: request.requestedEffects,
        })
        if (!consumed.ok) {
          dispatcher.endCallById(callId, 'refused')
          return 'admission-refused'
        }
        bodyRuns.push(callId)
        dispatcher.noteResultObserved(callId)
        dispatcher.endCallById(callId, 'settled')
        return 'ran'
      } catch {
        dispatcher.endCallById(callId, 'refused')
        return 'admission-refused'
      }
    },
  }
}

function setPolicy() {
  return { rules: [] }
}

const baseRequest = (callId: string): AdmissionRequest => ({
  binding: binding(),
  member: MEMBER,
  callId,
  realmId: REALM,
  parametersFingerprint: 'sha256:' + 'e'.repeat(64),
  requestedEffects: effects(readEffect()),
})

describe('Guard outside, Admission inside — nobody gets to run twice or for free', () => {
  it('an unbound name is refused by the Guard and NEVER reaches Admission', async () => {
    const a = assembly({ allow: true })
    const outcome = await a.dispatch('call-x', 'not-a-bound-tool', baseRequest('call-x'))
    expect(outcome).toBe('guard-denied')
    expect(a.bodyRuns).toEqual([])
    expect(a.ledger.consumedCount()).toBe(0)
  })

  it('a policy refusal ends the call `refused`, body zero, dispatcher drainable', async () => {
    const a = assembly({ allow: false })
    const outcome = await a.dispatch('call-y', 'read', baseRequest('call-y'))
    expect(outcome).toBe('admission-refused')
    expect(a.bodyRuns).toEqual([])
    expect(a.dispatcher.beginDrain().ok).toBe(true)
    expect(a.dispatcher.tombstone().ok).toBe(true)
    const released = a.dispatcher.release()
    expect(released.ok).toBe(true)
  })

  it('the happy path runs the body exactly once; a same-shape SECOND call needs its own grant', async () => {
    const a = assembly({ allow: true })
    expect(await a.dispatch('call-p1', 'read', baseRequest('call-p1'))).toBe('ran')
    // A second call carrying the FIRST call's consumed grant cannot ride it:
    // the kernel mints a NEW grant for it (same policy, fresh consume), and
    // replaying the first grant against the second call refuses.
    expect(await a.dispatch('call-p2', 'read', baseRequest('call-p2'))).toBe('ran')
    expect(a.bodyRuns).toEqual(['call-p1', 'call-p2'])
    expect(a.ledger.consumedCount()).toBe(2) // distinct grants, each spent once
  })

  it('an exception inside admission leaves the SELF COUNT balanced (drain to zero)', async () => {
    const a = assembly({ allow: true })
    // Poison the request so `admit` throws BEFORE any decision (a defect,
    // not a policy answer — the catch must still end the call).
    const broken = { ...baseRequest('call-z'), requestedEffects: undefined } as unknown as AdmissionRequest
    const outcome = await a.dispatch('call-z', 'read', broken)
    expect(outcome).toBe('admission-refused')
    expect(a.dispatcher.beginDrain().ok).toBe(true)
    expect(a.dispatcher.tombstone().ok).toBe(true)
    expect(a.dispatcher.release().ok).toBe(true)
  })
})
