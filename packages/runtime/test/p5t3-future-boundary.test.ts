/**
 * p5t3-future-boundary — TaskDoc §11.5 must-test group 1: the DevPlan
 * §18.4 frozen model-selection sequence (all green, mock-first, real P4
 * repositories + FileStorageSeam as the durable truth, verified THROUGH
 * the binder's fresh paths — the overlay is never unit-tested in
 * isolation).
 *
 * The frozen sequence (DevPlan §18.4, verbatim):
 *
 * ```text
 * request N = model A
 * concurrent override -> B
 * request N remains A
 * request N+1 uses B
 * ```
 *
 * - the effective selection resolves at REQUEST time (`beginRequest`
 *   captures the source's current value): the concurrent override is a
 *   future-boundary mutation — it never changes the in-flight request N,
 *   and request N+1 resolves the source afresh;
 * - the bind (the slot's `install`) performs NO resolution and NO source
 *   effect: no pre-resolved selection can go stale across a restart
 *   (ruling R30);
 * - the negative group pins the fail-closed posture: a slot `apply` fault
 *   is a binder-level `BINDER_OVERLAY_FAILED` (no later slot, no
 *   admission, target not registered) with retry convergence; a source
 *   fault at request time propagates with no capture registered;
 *   completion is idempotent; the ordinary agent is unaffected.
 *
 * @module @dsh-agent-team/runtime/test/p5t3-future-boundary
 */

import { describe, expect, it } from 'vitest'

import {
  ADMISSION_OPEN_CODE,
  AGENT_SETUP_EVENT_NAMES,
  TEAM_AGENT_BINDER_ERROR_CODES,
  isTeamAgentBinderError,
} from '../agent-setup/binder/index.js'
import { TeamModelOverlaySlot } from '../agent-setup/model/index.js'
import {
  destroyDir,
  FakeAgentSetupSurface,
  readHandleFor,
  seedTeamWorld,
} from './p5t1-helpers.js'
import {
  FaultModelAdapter,
  FakeModelSelectionSource,
  P5T3_MODEL_A,
  P5T3_MODEL_B,
  binderWithModelSlot,
  createModelOverlay,
} from './p5t3-helpers.js'

/** The full fresh-path effect set of one bound session (the binder's events). */
function expectFreshEvents(surface: FakeAgentSetupSurface, sessionId: string): void {
  expect(surface.countCalls('installOverlay', sessionId)).toBe(3)
  expect(surface.eventsFor(sessionId)).toEqual([
    { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'persona' },
    { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'model' },
    { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'capability' },
    { name: AGENT_SETUP_EVENT_NAMES.admissionDecided, detail: ADMISSION_OPEN_CODE },
  ])
}

// ---------------------------------------------------------------------------
// World A — the full durable world (root + member + ordinary).
// ---------------------------------------------------------------------------

const worldA = await seedTeamWorld('p5t3-fb-a')

describe('P5-T3 group 1: DevPlan §18.4 frozen sequence (request-time resolution, future-boundary mutation)', () => {
  it('fresh root: request N = model A; concurrent override -> B; request N remains A; request N+1 uses B', () => {
    const surface = new FakeAgentSetupSurface()
    const fakeSource = new FakeModelSelectionSource(P5T3_MODEL_A)
    const { adapter, slot } = createModelOverlay(fakeSource)
    const binder = binderWithModelSlot(surface, readHandleFor(worldA.domain), slot)
    const root = worldA.ids.rootSessionId

    const bind = binder.bindFreshRoot(root)
    expect(bind.bound).toBe(true)
    expect(bind.installed).toBe(true)
    expect(bind.admitted).toBe(true)
    expect(bind.admissionCode).toBe(ADMISSION_OPEN_CODE)
    // the overlay is installed through the binder's fresh effect (fixed order)
    expectFreshEvents(surface, root)
    expect(adapter.installed(root)).toBe(true)
    // install performs NO resolution and NO source effect (ruling R30: nothing
    // pre-resolved can go stale)
    expect(fakeSource.currentReads).toBe(0)
    expect(fakeSource.selects).toEqual([])

    // request N = model A
    const requestN = adapter.beginRequest(root)
    expect(requestN.selection).toEqual(P5T3_MODEL_A)
    expect(adapter.inFlight(root)).toBe(1)

    // concurrent override -> B
    fakeSource.select(P5T3_MODEL_B)

    // request N remains A (the in-flight request is never rewritten)
    expect(requestN.selection).toEqual(P5T3_MODEL_A)
    expect(requestN.selection?.provider).toBe('provider-a')
    expect(adapter.inFlight(root)).toBe(1)

    requestN.complete()
    expect(adapter.inFlight(root)).toBe(0)

    // request N+1 uses B (the future-boundary mutation takes effect now)
    const requestN1 = adapter.beginRequest(root)
    expect(requestN1.selection).toEqual(P5T3_MODEL_B)
    requestN1.complete()
    expect(adapter.inFlight(root)).toBe(0)
  })

  it('fresh member: the same frozen sequence on the member child session', () => {
    const surface = new FakeAgentSetupSurface()
    const fakeSource = new FakeModelSelectionSource(P5T3_MODEL_A)
    const { adapter, slot } = createModelOverlay(fakeSource)
    const binder = binderWithModelSlot(surface, readHandleFor(worldA.domain), slot)
    const child = worldA.ids.childSessionId

    const bind = binder.bindFreshMember(child)
    expect(bind.bound).toBe(true)
    expect(bind.installed).toBe(true)
    expect(bind.identity?.kind).toBe('member')
    expect(bind.identity?.sessionId).toBe(child)
    expectFreshEvents(surface, child)
    expect(adapter.installed(child)).toBe(true)

    // request N = model A; concurrent override -> B
    const requestN = adapter.beginRequest(child)
    expect(requestN.selection).toEqual(P5T3_MODEL_A)
    fakeSource.select(P5T3_MODEL_B)

    // request N remains A; request N+1 uses B
    expect(requestN.selection).toEqual(P5T3_MODEL_A)
    requestN.complete()
    const requestN1 = adapter.beginRequest(child)
    expect(requestN1.selection).toEqual(P5T3_MODEL_B)
    requestN1.complete()
    expect(adapter.inFlight(child)).toBe(0)
  })

  it('concurrent in-flight requests: N keeps A, M begins on B, bookkeeping converges', () => {
    const surface = new FakeAgentSetupSurface()
    const fakeSource = new FakeModelSelectionSource(P5T3_MODEL_A)
    const { adapter, slot } = createModelOverlay(fakeSource)
    const binder = binderWithModelSlot(surface, readHandleFor(worldA.domain), slot)
    const root = worldA.ids.rootSessionId
    binder.bindFreshRoot(root)

    const requestN = adapter.beginRequest(root) // A
    fakeSource.select(P5T3_MODEL_B) // concurrent override
    const requestM = adapter.beginRequest(root) // B, while N is still in flight

    expect(requestN.selection).toEqual(P5T3_MODEL_A)
    expect(requestM.selection).toEqual(P5T3_MODEL_B)
    expect(adapter.inFlight(root)).toBe(2)

    requestN.complete()
    expect(requestN.selection).toEqual(P5T3_MODEL_A) // the capture is immutable after completion
    expect(adapter.inFlight(root)).toBe(1)
    requestM.complete()
    expect(adapter.inFlight(root)).toBe(0)
  })

  it('an absent selection is losslessly carried as undefined, never defaulted', () => {
    const surface = new FakeAgentSetupSurface()
    const fakeSource = new FakeModelSelectionSource() // no selection set
    const { adapter, slot } = createModelOverlay(fakeSource)
    const binder = binderWithModelSlot(surface, readHandleFor(worldA.domain), slot)
    const root = worldA.ids.rootSessionId
    binder.bindFreshRoot(root)

    const requestN = adapter.beginRequest(root)
    expect(requestN.selection).toBe(undefined)
    fakeSource.select(P5T3_MODEL_A)
    const requestN1 = adapter.beginRequest(root)
    expect(requestN1.selection).toEqual(P5T3_MODEL_A)
    requestN.complete()
    requestN1.complete()
  })

  it('a double bind on a live residency is a no-op and never clears an in-flight capture', () => {
    const surface = new FakeAgentSetupSurface()
    const fakeSource = new FakeModelSelectionSource(P5T3_MODEL_A)
    const { adapter, slot } = createModelOverlay(fakeSource)
    const binder = binderWithModelSlot(surface, readHandleFor(worldA.domain), slot)
    const root = worldA.ids.rootSessionId
    binder.bindFreshRoot(root)

    const requestN = adapter.beginRequest(root)
    const second = binder.bindFreshRoot(root)
    expect(second.bound).toBe(true)
    expect(second.installed).toBe(false)
    expect(second.noopReason).toBe('already-bound')
    expect(second.emittedEvents).toEqual([])
    // the residency is alive: no duplicate install, no in-flight clear
    expect(surface.countCalls('installOverlay', root)).toBe(3)
    expect(adapter.inFlight(root)).toBe(1)
    requestN.complete()
    expect(adapter.inFlight(root)).toBe(0)
  })
})

describe('P5-T3 group 1 (negative): fail-closed posture through the binder', () => {
  it('a model slot apply fault is BINDER_OVERLAY_FAILED (no later slot, no admission) and the retry converges', () => {
    const surface = new FakeAgentSetupSurface()
    const fault = new Error('model seam fault')
    const binder = binderWithModelSlot(
      surface,
      readHandleFor(worldA.domain),
      new TeamModelOverlaySlot(new FaultModelAdapter(fault)),
    )
    const root = worldA.ids.rootSessionId

    let firstError: unknown
    try {
      binder.bindFreshRoot(root)
    } catch (error) {
      firstError = error
    }
    expect(isTeamAgentBinderError(firstError)).toBe(true)
    if (isTeamAgentBinderError(firstError)) {
      expect(firstError.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_OVERLAY_FAILED)
      expect(firstError.details.origin).toBe('model')
    }
    // fail-closed: persona installed; the model effect, capability, and
    // admission did NOT run; the target is not registered
    expect(surface.countCalls('installOverlay', root)).toBe(1)
    expect(surface.eventsFor(root)).toEqual([
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'persona' },
    ])

    // the retry re-drives the full path and converges (slot idempotency):
    // no duplicate events (binder dedup); the fresh effect runs all three
    // slots again (1 persona install from the failed attempt + 3 on the
    // retry)
    const retry = binder.bindFreshRoot(root)
    expect(retry.bound).toBe(true)
    expect(retry.installed).toBe(true)
    expect(retry.admitted).toBe(true)
    expect(retry.emittedEvents).toEqual([
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'model' },
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'capability' },
      { name: AGENT_SETUP_EVENT_NAMES.admissionDecided, detail: ADMISSION_OPEN_CODE },
    ])
    expect(surface.countCalls('installOverlay', root)).toBe(4)
  })

  it('a source fault at request time propagates fail-closed with no capture registered', () => {
    const surface = new FakeAgentSetupSurface()
    // the injected seam faults at request time (install never reads the
    // source, so the bind itself still succeeds)
    const faultOverlay = createModelOverlay({
      current(): never {
        throw new Error('source fault')
      },
      select(): void {
        /* the fault world never selects */
      },
    })
    const binder = binderWithModelSlot(surface, readHandleFor(worldA.domain), faultOverlay.slot)
    const root = worldA.ids.rootSessionId
    binder.bindFreshRoot(root)
    expect(faultOverlay.adapter.inFlight(root)).toBe(0)

    expect(() => faultOverlay.adapter.beginRequest(root)).toThrow('source fault')
    expect(faultOverlay.adapter.inFlight(root)).toBe(0)
  })

  it('request completion is idempotent (the in-flight count never goes negative)', () => {
    const surface = new FakeAgentSetupSurface()
    const fakeSource = new FakeModelSelectionSource(P5T3_MODEL_A)
    const { adapter, slot } = createModelOverlay(fakeSource)
    const binder = binderWithModelSlot(surface, readHandleFor(worldA.domain), slot)
    const root = worldA.ids.rootSessionId
    binder.bindFreshRoot(root)

    const requestN = adapter.beginRequest(root)
    requestN.complete()
    requestN.complete() // idempotent
    expect(adapter.inFlight(root)).toBe(0)
    expect(requestN.selection).toEqual(P5T3_MODEL_A) // the capture survives completion
  })

  it('the ordinary agent is unaffected: no overlay effect on an ordinary session', () => {
    const surface = new FakeAgentSetupSurface()
    const fakeSource = new FakeModelSelectionSource(P5T3_MODEL_A)
    const { adapter, slot } = createModelOverlay(fakeSource)
    const binder = binderWithModelSlot(surface, readHandleFor(worldA.domain), slot)
    const ordinary = worldA.ids.ordinarySessionId

    const result = binder.bindFreshRoot(ordinary)
    expect(result.bound).toBe(false)
    expect(result.installed).toBe(false)
    expect(result.noopReason).toBe('ordinary')
    expect(result.emittedEvents).toEqual([])
    expect(surface.countCalls('installOverlay')).toBe(0)
    expect(surface.countCalls('restoreScope')).toBe(0)
    expect(adapter.installed(ordinary)).toBe(false)
    expect(adapter.inFlight(ordinary)).toBe(0)
    expect(fakeSource.currentReads).toBe(0)
  })
})

destroyDir(worldA.scratchDir)
