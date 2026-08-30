/**
 * p5t3-restart — TaskDoc §11.5 must-test group 2: the restart boundary
 * (ruling R30: in-flight state does not leak across a restart; the first
 * request after a restart uses the CURRENT source value — no stale A).
 *
 * Three worlds, all verified THROUGH the binder:
 *
 * - World B — same process: the ephemeral residency is dropped (DevPlan
 *   §18.5) while request N (model A) is in flight and the source has been
 *   overridden to B; the residency is re-created and the SAME binder
 *   re-drives the fresh path; the first request after the restart resolves
 *   B (no stale A);
 * - World C — same process: the residency is dropped while request N (A) is
 *   in flight (source overridden to B); the SAME binder COLD-rehydrates the
 *   member (restoreScope, zero fresh-time effects); the first request
 *   resolves B;
 * - World D — full process restart: `restartTeamWorld` re-opens the durable
 *   world on a new seam; a FRESH surface/binder/adapter/source (the
 *   durable selection state survives as B) cold-rehydrates the root; the
 *   new adapter has zero in-flight state and the first request resolves B.
 *
 * @module @dsh-agent-team/runtime/test/p5t3-restart
 */

import { describe, expect, it } from 'vitest'

import { ADMISSION_OPEN_CODE, AGENT_SETUP_EVENT_NAMES } from '../agent-setup/binder/index.js'
import {
  destroyDir,
  FakeAgentSetupSurface,
  readHandleFor,
  restartTeamWorld,
  seedTeamWorld,
} from './p5t1-helpers.js'
import {
  FakeModelSelectionSource,
  P5T3_MODEL_A,
  P5T3_MODEL_B,
  binderWithModelSlot,
  createModelOverlay,
} from './p5t3-helpers.js'

// ---------------------------------------------------------------------------
// Worlds B / C / D — independent durable worlds (unique scratch dirs).
// ---------------------------------------------------------------------------

const worldB = await seedTeamWorld('p5t3-rs-b')
const worldC = await seedTeamWorld('p5t3-rs-c')
const worldD = await seedTeamWorld('p5t3-rs-d')
// the post-restart world: the SAME durable dir re-opened on a NEW seam
// (top-level await — the plain-node runner does not support async `it`)
const worldD2 = await restartTeamWorld(worldD.scratchDir)

describe('P5-T3 group 2: restart — the same process (ephemeral residency drop, durable session survives)', () => {
  it('root: residency drop + fresh rebind — the first request after the restart uses the CURRENT source (B), no stale A', () => {
    const surface = new FakeAgentSetupSurface()
    const fakeSource = new FakeModelSelectionSource(P5T3_MODEL_A)
    const { adapter, slot } = createModelOverlay(fakeSource)
    const binder = binderWithModelSlot(surface, readHandleFor(worldB.domain), slot)
    const root = worldB.ids.rootSessionId

    binder.bindFreshRoot(root)
    const requestN = adapter.beginRequest(root)
    expect(requestN.selection).toEqual(P5T3_MODEL_A)
    // the override lands while N is in flight
    fakeSource.select(P5T3_MODEL_B)
    expect(requestN.selection).toEqual(P5T3_MODEL_A)

    // the restart boundary: the EPHEMERAL residency is gone (DevPlan §18.5)
    // and the adapter's restart hook clears the in-flight captures
    surface.dropResidency(root)
    adapter.drop(root)
    expect(adapter.inFlight(root)).toBe(0)
    // the overlay is session-scoped: the installed marker persists
    expect(adapter.installed(root)).toBe(true)
    // the dead handle keeps its OWN immutable capture (no session leak)
    expect(requestN.selection).toEqual(P5T3_MODEL_A)

    // the residency is (re)created: the SAME binder re-drives the fresh path
    const rebind = binder.bindFreshRoot(root)
    expect(rebind.bound).toBe(true)
    expect(rebind.installed).toBe(true)
    expect(rebind.admitted).toBe(true)
    // no duplicate events (binder dedup across the rebind)
    expect(rebind.emittedEvents).toEqual([])
    expect(surface.countCalls('installOverlay', root)).toBe(6)

    // first request after the restart: the CURRENT source value (B), no stale A
    const request1 = adapter.beginRequest(root)
    expect(request1.selection).toEqual(P5T3_MODEL_B)
    request1.complete()
    expect(adapter.inFlight(root)).toBe(0)
  })

  it('member: residency drop + cold rehydrate — zero fresh-time effects, the first request uses the CURRENT source (B)', () => {
    const surface = new FakeAgentSetupSurface()
    const fakeSource = new FakeModelSelectionSource(P5T3_MODEL_A)
    const { adapter, slot } = createModelOverlay(fakeSource)
    const binder = binderWithModelSlot(surface, readHandleFor(worldC.domain), slot)
    const child = worldC.ids.childSessionId

    binder.bindFreshMember(child)
    const requestN = adapter.beginRequest(child)
    expect(requestN.selection).toEqual(P5T3_MODEL_A)
    fakeSource.select(P5T3_MODEL_B)
    expect(requestN.selection).toEqual(P5T3_MODEL_A)

    surface.dropResidency(child)
    adapter.drop(child)
    expect(adapter.inFlight(child)).toBe(0)

    // cold rehydrate on the SAME binder (the restored scope carries the full
    // slot set — no slot is applied on the cold path)
    const cold = binder.rehydrateColdMember(child)
    expect(cold.bound).toBe(true)
    expect(cold.installed).toBe(true)
    // zero fresh-time effects: only the FIRST bind's installs, one restore
    expect(surface.countCalls('installOverlay', child)).toBe(3)
    expect(surface.countCalls('restoreScope', child)).toBe(1)
    // the admission event is deduped; only scope-restored is new
    expect(cold.emittedEvents).toEqual([
      { name: AGENT_SETUP_EVENT_NAMES.scopeRestored, detail: 'member' },
    ])
    expect(surface.eventsFor(child)).toEqual([
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'persona' },
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'model' },
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'capability' },
      { name: AGENT_SETUP_EVENT_NAMES.admissionDecided, detail: ADMISSION_OPEN_CODE },
      { name: AGENT_SETUP_EVENT_NAMES.scopeRestored, detail: 'member' },
    ])

    // first request after the restart: the CURRENT source value (B), no stale A
    const request1 = adapter.beginRequest(child)
    expect(request1.selection).toEqual(P5T3_MODEL_B)
    request1.complete()
    expect(adapter.inFlight(child)).toBe(0)
  })
})

describe('P5-T3 group 2: restart — the full process restart (fresh runtime, durable world re-opens)', () => {
  it('root: a fresh runtime cold-rehydrates the root — zero in-flight state, the first request uses the durable CURRENT source (B)', () => {
    // the first runtime (pre-restart): bind, a request in flight on A, and
    // the override landing before the restart
    const surface = new FakeAgentSetupSurface()
    const fakeSource = new FakeModelSelectionSource(P5T3_MODEL_A)
    const { adapter, slot } = createModelOverlay(fakeSource)
    const binder = binderWithModelSlot(surface, readHandleFor(worldD.domain), slot)
    const root = worldD.ids.rootSessionId
    binder.bindFreshRoot(root)
    const requestN = adapter.beginRequest(root)
    expect(requestN.selection).toEqual(P5T3_MODEL_A)
    fakeSource.select(P5T3_MODEL_B)
    expect(adapter.inFlight(root)).toBe(1)

    // the process restarts: the ENTIRE ephemeral runtime is gone (residency,
    // adapter, binder); the durable world re-opens on a new seam (worldD2 —
    // opened at module level, the plain-node shim is synchronous in `it`)
    const surface2 = new FakeAgentSetupSurface()
    // the durable selection state survived the restart as B
    const durableSource = new FakeModelSelectionSource(P5T3_MODEL_B)
    const { adapter: adapter2, slot: slot2 } = createModelOverlay(durableSource)
    const binder2 = binderWithModelSlot(surface2, readHandleFor(worldD2), slot2)

    const cold = binder2.rehydrateColdRoot(root)
    expect(cold.bound).toBe(true)
    expect(cold.installed).toBe(true)
    // zero fresh-time effects on the cold path (no slot is applied, nothing
    // is installed on the surface)
    expect(surface2.countCalls('installOverlay', root)).toBe(0)
    expect(surface2.countCalls('restoreScope', root)).toBe(1)
    expect(cold.emittedEvents).toEqual([
      { name: AGENT_SETUP_EVENT_NAMES.scopeRestored, detail: 'root' },
      { name: AGENT_SETUP_EVENT_NAMES.admissionDecided, detail: ADMISSION_OPEN_CODE },
    ])
    // the new adapter has NO in-flight state across the restart
    expect(adapter2.inFlight(root)).toBe(0)
    expect(durableSource.currentReads).toBe(0) // no resolution happened yet

    // first request after the restart: the durable CURRENT source (B), no stale A
    const request1 = adapter2.beginRequest(root)
    expect(request1.selection).toEqual(P5T3_MODEL_B)
    expect(durableSource.currentReads).toBe(1)
    request1.complete()
    expect(adapter2.inFlight(root)).toBe(0)
  })
})

destroyDir(worldB.scratchDir)
destroyDir(worldC.scratchDir)
destroyDir(worldD.scratchDir)
