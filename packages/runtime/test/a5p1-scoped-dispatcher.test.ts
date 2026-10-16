/**
 * a5p1-scoped-dispatcher.test.ts — Alpha.5 PR1 (plan §4, design §4.1/§4.2):
 * the STABLE SCOPED DISPATCHER's assembly machine, its self-counted leases,
 * and the ordered teardown that NEG-1 was recorded against.
 *
 * THE HAZARD THIS PINS (PoC `01-routing/p01-runner.mjs` L3-hazard, result
 * `native=1`): the ordinary disposer habit — lift `restrict`, then drop the
 * adapter — let the registry's late dispatch re-resolution fall back to the
 * NATIVE BODY while an in-flight call was still parked at the pre-execute
 * fence. The control arm (drop the adapter, keep the mask) measured
 * `native=0`. So the laws here are: refuse new calls FIRST, keep the mask for
 * the whole drain, and reach RELEASED only on the Dispatcher's OWN zero.
 *
 * @module test/a5p1-scoped-dispatcher
 */
import { describe, expect, it } from 'vitest'
import { BINDING_STATES } from '../../domain/tool-governance/src/index.js'
import { createScopedDispatcher, type DispatcherObservation } from '../tool-dispatch/index.js'

const NATIVES = ['read', 'bash']
/** The machine under test here is the STATE MACHINE, with no Host ctx in the
 *  room: no public seams exist to arm, so it asks for none (`requiredSeams: 0`),
 *  and the two facts an inherited native needs — the trusted native list and
 *  the definition pinned at the public seam — are supplied by hand.
 *  `a5p1-guard-install.test.ts` covers the same machine with the seams armed. */
function makeDispatcher() {
  const observations: DispatcherObservation[] = []
  const dispatcher = createScopedDispatcher({
    agentScopeKey: 'session-m1',
    trustedIdentities: ['session-m1'],
    nativeNames: NATIVES,
    resolveDefinition: (name) => ({ ok: true, fingerprint: `def:${name}` }),
    requiredSeams: 0,
    onObserve: (row) => observations.push(row),
  })
  // THREE facts now earn a native Binding (R-a): the trusted list, the identity
  // THIS scope resolves, and the identity the TRUSTED global view resolves. This
  // fixture's two views agree, so the third argument is the same pin — the test
  // says so out loud instead of the API quietly assuming it.
  dispatcher.bindInheritedSurface(
    NATIVES,
    Object.fromEntries(NATIVES.map((n) => [n, `def:${n}`])),
    Object.fromEntries(NATIVES.map((n) => [n, `def:${n}`])),
  )
  return { dispatcher, observations }
}

/** Drive the machine to ACTIVE the way the assembly does. */
function toActive(dispatcher: ReturnType<typeof makeDispatcher>['dispatcher']) {
  expect(dispatcher.beginAssembly().ok).toBe(true)
  expect(dispatcher.publish().ok).toBe(true)
  expect(dispatcher.state()).toBe('ACTIVE')
}

describe('the assembly machine is the design §4.1 machine', () => {
  it('D1 the states and the legal path are the frozen ones', () => {
    expect(BINDING_STATES).toEqual(['UNBOUND', 'PREPARING', 'ACTIVE', 'DRAINING', 'TOMBSTONED', 'RELEASED'])
    const { dispatcher } = makeDispatcher()
    expect(dispatcher.state()).toBe('UNBOUND')
    expect(dispatcher.beginAssembly().ok).toBe(true)
    expect(dispatcher.state()).toBe('PREPARING')
    expect(dispatcher.publish().ok).toBe(true)
    expect(dispatcher.beginDrain().ok).toBe(true)
    expect(dispatcher.tombstone().ok).toBe(true)
    expect(dispatcher.release().ok).toBe(true)
    expect(dispatcher.state()).toBe('RELEASED')
  })

  it('D2 every illegal order is a typed refusal, never a throw and never silent', () => {
    const { dispatcher } = makeDispatcher()
    // Published without assembling.
    expect(dispatcher.publish().ok).toBe(false)
    expect(dispatcher.beginDrain().ok).toBe(false)
    expect(dispatcher.state()).toBe('UNBOUND')

    toActive(dispatcher)
    // No way back to PREPARING, no way to skip the drain, no re-activation.
    expect(dispatcher.beginAssembly().ok).toBe(false)
    expect(dispatcher.tombstone().ok).toBe(false)
    expect(dispatcher.release().ok).toBe(false)
    expect(dispatcher.state()).toBe('ACTIVE')

    expect(dispatcher.beginDrain().ok).toBe(true)
    expect(dispatcher.publish().ok).toBe(false)
    expect(dispatcher.beginAssembly().ok).toBe(false)
    expect(dispatcher.state()).toBe('DRAINING')
  })

  it('D3 an assembly failure un-publishes: PREPARING → UNBOUND is the only back-edge', () => {
    const { dispatcher, observations } = makeDispatcher()
    expect(dispatcher.beginAssembly().ok).toBe(true)
    expect(dispatcher.failAssembly('the required Provider service is absent').ok).toBe(true)
    expect(dispatcher.state()).toBe('UNBOUND')
    // An unpublished Agent is not callable: every name — even a bound one —
    // is refused, which is "装配失败不发布" as an execution fact.
    expect(dispatcher.decide({ name: 'read', agentIdentity: 'session-m1' }).kind).toBe('deny')
    expect(observations.some((o) => o.event === 'dispatcher-assembly-failed' && o.published === false)).toBe(true)
  })

  it('D4 while PREPARING nothing dispatches, and publishing is the only door', () => {
    const { dispatcher } = makeDispatcher()
    expect(dispatcher.beginAssembly().ok).toBe(true)
    expect(dispatcher.active()).toBe(false)
    expect(dispatcher.guard({ name: 'read', agentIdentity: 'session-m1' })).toContain('not ACTIVE')
    expect(dispatcher.beginCall('c1', 'read').ok).toBe(false)
  })
})

describe('teardown: refuse → drain (mask kept) → tombstone → release on the SELF count', () => {
  it('D5 beginDrain refuses new calls and new Asks from the first instant', () => {
    const { dispatcher } = makeDispatcher()
    toActive(dispatcher)
    expect(dispatcher.beginDrain().ok).toBe(true)
    expect(dispatcher.beginCall('late', 'read').ok).toBe(false)
    expect(dispatcher.decide({ name: 'read', agentIdentity: 'session-m1' }).kind).toBe('deny')
  })

  it('D6 the mask is NOT liftable until RELEASED (NEG-1 order law)', () => {
    const { dispatcher } = makeDispatcher()
    toActive(dispatcher)
    expect(dispatcher.maskMayLift()).toBe(false)
    dispatcher.beginDrain()
    expect(dispatcher.maskMayLift()).toBe(false)
    dispatcher.tombstone()
    expect(dispatcher.maskMayLift()).toBe(false)
    expect(dispatcher.release().ok).toBe(true)
    expect(dispatcher.maskMayLift()).toBe(true)
  })

  it('D7 draining requests cancellation of the in-flight calls it handed out', () => {
    const { dispatcher } = makeDispatcher()
    toActive(dispatcher)
    const begun = dispatcher.beginCall('call-1', 'read')
    expect(begun.ok).toBe(true)
    if (!begun.ok) return
    expect(begun.value.cancellationRequested).toBe(false)
    dispatcher.beginDrain()
    expect(begun.value.cancellationRequested).toBe(true)
    expect(dispatcher.inFlight()).toBe(1)
  })

  it('D8 RELEASED needs the self-count at zero — a returned dispose is not evidence', () => {
    const { dispatcher, observations } = makeDispatcher()
    toActive(dispatcher)
    const begun = dispatcher.beginCall('call-1', 'read')
    if (!begun.ok) throw new Error('beginCall should succeed at ACTIVE')
    dispatcher.noteHostDisposeReturned()

    dispatcher.beginDrain()
    dispatcher.tombstone()
    const blocked = dispatcher.release()
    expect(blocked.ok).toBe(false)
    if (blocked.ok) return
    expect(blocked.error.code).toBe('EXECUTION_TERMINATION_UNCONFIRMED')
    expect(blocked.error.sideEffectUnknown).toBe(true)
    expect(blocked.error.message).toContain('host dispose RETURNED')
    expect(dispatcher.state()).toBe('TOMBSTONED')
    expect(dispatcher.maskMayLift()).toBe(false)

    // The late callback shape: a tombstoned Dispatcher keeps refusing.
    expect(dispatcher.guard({ name: 'read', agentIdentity: 'session-m1' })).toContain('not ACTIVE')

    if (begun.value.cancellationRequested !== true) throw new Error('the drain must have requested cancellation')
    dispatcher.endCall(begun.value)
    expect(dispatcher.inFlight()).toBe(0)
    expect(dispatcher.release().ok).toBe(true)
    expect(observations.some((o) => o.event === 'dispatcher-release-refused')).toBe(true)
  })

  it('D9 a callId is entered once (no double lease, no phantom zero)', () => {
    const { dispatcher } = makeDispatcher()
    toActive(dispatcher)
    expect(dispatcher.beginCall('dup', 'read').ok).toBe(true)
    const second = dispatcher.beginCall('dup', 'read')
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.error.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(dispatcher.inFlight()).toBe(1)
    expect(dispatcher.outstandingCallIds()).toEqual(['dup'])
  })

  it('D10 a token that is not the one in force never decrements the count', () => {
    const { dispatcher } = makeDispatcher()
    toActive(dispatcher)
    const real = dispatcher.beginCall('c1', 'read')
    if (!real.ok) throw new Error('setup')
    dispatcher.endCall({ callId: 'c1', toolName: 'read', cancellationRequested: false })
    expect(dispatcher.inFlight()).toBe(1)
    dispatcher.endCall(real.value)
    expect(dispatcher.inFlight()).toBe(0)
  })
})

describe('a stable shape with immutable revisions, and a change channel that grants nothing', () => {
  it('D11 a binding change is an immutable revision; the name is never unloaded', () => {
    const { dispatcher, observations } = makeDispatcher()
    toActive(dispatcher)
    const before = dispatcher.surface.entryOf('read')
    expect(dispatcher.revise('read', { policyGeneration: 1 }).ok).toBe(true)
    const after = dispatcher.surface.entryOf('read')
    expect(after?.revision).toBe((before?.revision ?? 0) + 1)
    expect(after?.binding.bindingId).toBe(before?.binding.bindingId)
    expect(dispatcher.surface.names()).toContain('read')
    // And the call still verifies — against the NEW generation only.
    expect(dispatcher.decide({ name: 'read', agentIdentity: 'session-m1' }).kind).toBe('abstain')
    expect(observations.some((o) => o.event === 'dispatcher-binding-revised' && o.unloaded === false)).toBe(true)
  })

  it('D12 revise of an un-governed name is refused (it is not a bind door)', () => {
    const { dispatcher } = makeDispatcher()
    toActive(dispatcher)
    const outcome = dispatcher.revise('a5p1_dyn_probe', { policyGeneration: 1 })
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error.code).toBe('TEAM_TOOL_UNGOVERNED')
  })

  it('D13 tools/change revalidation diagnoses the delta and governs NOTHING', () => {
    const { dispatcher, observations } = makeDispatcher()
    toActive(dispatcher)
    // A hot registration appears (the dyn probe) and one name disappears.
    const diff = dispatcher.revalidateSurface(['bash', 'a5p1_dyn_probe'])
    expect(diff.added).toEqual(['a5p1_dyn_probe'])
    expect(diff.removed).toEqual(['read'])
    // The added name is NOT bound: it stays outside the closed world.
    expect(dispatcher.surface.entryOf('a5p1_dyn_probe')).toBeUndefined()
    expect(dispatcher.guard({ name: 'a5p1_dyn_probe', agentIdentity: 'session-m1' })).toContain('no Team Tool Binding')
    // The removed name stays governed — dropping it from the visible surface
    // must never re-admit a native body for a name that has a Binding.
    expect(dispatcher.surface.entryOf('read')).toBeDefined()
    expect(observations.some((o) => o.event === 'dispatcher-surface-revalidated')).toBe(true)
  })

  it('D14 the guard is a string-or-undefined monotonic surface (host ToolGuard shape)', () => {
    const { dispatcher } = makeDispatcher()
    expect(typeof dispatcher.guard({ name: 'read', agentIdentity: 'session-m1' })).toBe('string')
    toActive(dispatcher)
    expect(dispatcher.guard({ name: 'read', agentIdentity: 'session-m1' })).toBeUndefined()
    expect(typeof dispatcher.guard({ name: 'ghost', agentIdentity: 'session-m1' })).toBe('string')
  })
})


describe('the change channel has live callers (PR1 Gate R2: revise() was dead code)', () => {
  it('D15 a definition drift revises the Binding down through the public change channel', () => {
    let fingerprint = 'def:read'
    const observations: DispatcherObservation[] = []
    const dispatcher = createScopedDispatcher({
      agentScopeKey: 'session-m1',
      trustedIdentities: ['session-m1'],
      nativeNames: ['read'],
      resolveDefinition: (name) => ({ ok: true, fingerprint: name === 'read' ? fingerprint : `def:${name}` }),
      requiredSeams: 0,
      onObserve: (row) => observations.push(row),
    })
    dispatcher.bindInheritedSurface(['read'], { read: 'def:read' }, { read: 'def:read' })
    expect(dispatcher.beginAssembly().ok).toBe(true)
    expect(dispatcher.publish().ok).toBe(true)
    expect(dispatcher.guard({ name: 'read', agentIdentity: 'session-m1' })).toBeUndefined()
    expect(dispatcher.surface.entryOf('read')).toMatchObject({ verified: true, revision: 1 })

    // Same Scope, same name, a DIFFERENT body.
    fingerprint = 'def:read:swapped'
    const denial = dispatcher.guard({ name: 'read', agentIdentity: 'session-m1' })
    expect(String(denial)).toContain('definition')
    // The withdrawal travelled the public change channel: revision 2, same
    // bindingId family, verification gone.
    expect(dispatcher.surface.entryOf('read')).toMatchObject({ verified: false, revision: 2 })
    expect(dispatcher.surface.entryOf('read')?.binding.bindingId).toBe('native:read')
    expect(observations.some((o) => o.event === 'dispatcher-binding-revised')).toBe(true)

    // Refused ever after, until the trusted assembly re-binds it for real — and
    // "for real" means pinning the Body it actually inspected this time, not
    // re-stamping `verified: true` onto the stale pin.
    // The withdrawal states WHAT moved (a drifted Binding is no longer the same
    // refusal as an unattributed one: PR1-residual R-a made the reasons precise).
    expect(String(dispatcher.guard({ name: 'read', agentIdentity: 'session-m1' }))).toContain('different ToolDefinition')
    const staleRetry = dispatcher.bind({
      name: 'read',
      origin: 'inherited-native',
      binding: { ...dispatcher.surface.entryOf('read')!.binding, revision: 3 },
      verified: true,
    })
    expect(staleRetry.ok).toBe(true)
    expect(String(dispatcher.guard({ name: 'read', agentIdentity: 'session-m1' }))).toContain('definition')
    // Each drifting call is its own immutable revision (a refusal that also
    // withdraws is still a state change the machine records), so the re-bind
    // takes the revision actually in force and re-pins the inspected body.
    const inForce = dispatcher.surface.entryOf('read')!
    expect(inForce.revision).toBeGreaterThan(3)
    const rebound = dispatcher.bind({
      name: 'read',
      origin: 'inherited-native',
      binding: { ...inForce.binding, revision: inForce.revision + 1, definitionIdentity: 'def:read:swapped' },
      verified: true,
    })
    expect(rebound.ok).toBe(true)
    expect(dispatcher.guard({ name: 'read', agentIdentity: 'session-m1' })).toBeUndefined()
  })

  it('D16 revalidation with identities revises drifted names; without them it stays a name diff', () => {
    const { dispatcher } = makeDispatcher()
    expect(dispatcher.beginAssembly().ok).toBe(true)
    expect(dispatcher.publish().ok).toBe(true)

    // No identities supplied: diagnosis only (the pre-R2 shape, still honest).
    const nameOnly = dispatcher.revalidateSurface(['read', 'bash'])
    expect(nameOnly.drifted).toEqual([])

    // Identities supplied and one of them is a different body: that name is
    // revised down, reported, and refused from now on.
    const swapped = dispatcher.revalidateSurface(['read', 'bash'], { read: 'def:read:other', bash: 'def:bash' })
    expect(swapped.drifted).toEqual(['read'])
    expect(swapped.unverified).toEqual(['read'])
    expect(dispatcher.surface.entryOf('read')?.verified).toBe(false)
    // The withdrawal states WHAT moved (a drifted Binding is no longer the same
    // refusal as an unattributed one: PR1-residual R-a made the reasons precise).
    expect(String(dispatcher.guard({ name: 'read', agentIdentity: 'session-m1' }))).toContain('different ToolDefinition')
    expect(dispatcher.guard({ name: 'bash', agentIdentity: 'session-m1' })).toBeUndefined()
  })
})
