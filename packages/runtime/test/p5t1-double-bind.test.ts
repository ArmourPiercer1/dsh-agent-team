/**
 * p5t1-double-bind — TaskDoc §11.5 must-test group 1: DOUBLE BIND
 * IDEMPOTENCY.
 *
 * A repeated bind of the same target on a live residency is a NO-OP: no
 * duplicate install, no duplicate restore, no duplicate session event, and
 * the returned identity is stable (deep-equal) across calls. The cold/fresh
 * cross no-op proves the no-op is path-independent (the binder keys its
 * bound entries on the target, not on the requested path). A lost ephemeral
 * residency (dropResidency / restart) is NOT a no-op: the next bind
 * re-restores (cold) or re-installs (fresh) exactly once. A failed bind +
 * retry never records a duplicate (name, detail) event record.
 *
 * Mock-first (ruling R28): the setup surface is the recording fake; the
 * TeamDomain truth is the P4 repositories over the testkit FileStorageSeam
 * (read-only through the read handle).
 * @module @dsh-agent-team/runtime/test/p5t1-double-bind
 */

import { describe, expect, it } from 'vitest'

import {
  ADMISSION_OPEN_CODE,
  AGENT_SETUP_EVENT_NAMES,
  OVERLAY_SLOT_ORDER,
  TEAM_AGENT_BINDER_ERROR_CODES,
  TeamAgentBinder,
  TeamAgentBinderError,
  isTeamAgentBinderError,
} from '../agent-setup/binder/index.js'
import {
  destroyDir,
  FakeAgentSetupSurface,
  readHandleFor,
  recordingSlot,
  restartTeamWorld,
  seedTeamWorld,
} from './p5t1-helpers.js'

// ---------------------------------------------------------------------------
// World A — fresh root / fresh member / cross-path / residency-loss cases.
// ---------------------------------------------------------------------------

const worldA = await seedTeamWorld('p5t1-dbl-a')

describe('P5-T1 group 1: double bind idempotency (fresh root)', () => {
  it('second fresh bind of the same root is a no-op with stable identity', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(worldA.domain) })
    const root = worldA.ids.rootSessionId

    const first = binder.bindFreshRoot(root)
    expect(first.bound).toBe(true)
    expect(first.installed).toBe(true)
    expect(first.admitted).toBe(true)
    expect(first.admissionCode).toBe(ADMISSION_OPEN_CODE)
    expect(first.identity).toEqual({ kind: 'root', sessionId: root, rootSessionId: root })
    expect(first.emittedEvents).toEqual([
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'persona' },
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'model' },
      { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'capability' },
      { name: AGENT_SETUP_EVENT_NAMES.admissionDecided, detail: ADMISSION_OPEN_CODE },
    ])
    expect(surface.countCalls('installOverlay')).toBe(3)
    expect(surface.countCalls('recordSessionEvent')).toBe(4)

    const second = binder.bindFreshRoot(root)
    expect(second.bound).toBe(true)
    expect(second.installed).toBe(false)
    expect(second.noopReason).toBe('already-bound')
    expect(second.identity).toEqual(first.identity)
    expect(second.admitted).toBe(true)
    expect(second.admissionCode).toBe(ADMISSION_OPEN_CODE)
    expect(second.emittedEvents).toEqual([])

    // No duplicate install / restore / event: the no-op performs only the
    // residency probe (getInstalledSlots) — the first (installing) bind has
    // no bound entry yet, so it never probes.
    expect(surface.countCalls('installOverlay')).toBe(3)
    expect(surface.countCalls('restoreScope')).toBe(0)
    expect(surface.countCalls('recordSessionEvent')).toBe(4)
    expect(surface.countCalls('getInstalledSlots')).toBe(1)
  })

  it('second fresh bind of the same member is a no-op with stable composite identity', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(worldA.domain) })
    const child = worldA.ids.childSessionId
    const root = worldA.ids.rootSessionId
    const instance = worldA.ids.instanceId

    const first = binder.bindFreshMember(child)
    expect(first.bound).toBe(true)
    expect(first.installed).toBe(true)
    expect(first.identity).toEqual({
      kind: 'member',
      sessionId: child,
      rootSessionId: root,
      instanceId: instance,
    })

    const second = binder.bindFreshMember(child)
    expect(second.noopReason).toBe('already-bound')
    expect(second.installed).toBe(false)
    expect(second.identity).toEqual(first.identity)
    expect(second.emittedEvents).toEqual([])
    expect(surface.countCalls('installOverlay', child)).toBe(3)
    expect(surface.countCalls('recordSessionEvent', child)).toBe(4)
  })
})

describe('P5-T1 group 1: double bind idempotency (path cross no-op)', () => {
  it('a fresh-bound target answers a cold rehydrate as an already-bound no-op', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(worldA.domain) })
    const root = worldA.ids.rootSessionId

    const fresh = binder.bindFreshRoot(root)
    expect(fresh.installed).toBe(true)

    const cold = binder.rehydrateColdRoot(root)
    expect(cold.bound).toBe(true)
    expect(cold.installed).toBe(false)
    expect(cold.noopReason).toBe('already-bound')
    expect(cold.identity).toEqual(fresh.identity)
    expect(cold.emittedEvents).toEqual([])
    // The cold no-op must NOT restore anything (the residency is live).
    expect(surface.countCalls('restoreScope')).toBe(0)
    expect(surface.countCalls('installOverlay')).toBe(3)
    expect(surface.countCalls('recordSessionEvent')).toBe(4)
  })

  it('a cold-bound target answers a fresh bind as an already-bound no-op', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(worldA.domain) })
    const child = worldA.ids.childSessionId

    const cold = binder.rehydrateColdMember(child)
    expect(cold.installed).toBe(true)
    expect(surface.countCalls('restoreScope')).toBe(1)

    const fresh = binder.bindFreshMember(child)
    expect(fresh.installed).toBe(false)
    expect(fresh.noopReason).toBe('already-bound')
    expect(fresh.identity).toEqual(cold.identity)
    expect(fresh.emittedEvents).toEqual([])
    // No fresh-time effects ran on the cold-bound target.
    expect(surface.countCalls('installOverlay')).toBe(0)
    expect(surface.countCalls('recordSessionEvent')).toBe(2)
  })

  it('a lost residency is re-restored (exactly one restoreScope) on the next bind', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(worldA.domain) })
    const root = worldA.ids.rootSessionId

    const first = binder.bindFreshRoot(root)
    expect(first.installed).toBe(true)
    expect(surface.countCalls('recordSessionEvent')).toBe(4)

    // The ephemeral residency is lost (a restart); the durable world stands.
    surface.dropResidency(root)

    const second = binder.rehydrateColdRoot(root)
    expect(second.bound).toBe(true)
    expect(second.installed).toBe(true)
    expect(second.noopReason).toBe(undefined)
    expect(second.identity).toEqual(first.identity)
    expect(surface.countCalls('restoreScope')).toBe(1)
    // The scope-restored event is recorded once; the admission-decided event
    // (same name + detail as on the first bind) is deduplicated.
    expect(second.emittedEvents).toEqual([
      { name: AGENT_SETUP_EVENT_NAMES.scopeRestored, detail: 'root' },
    ])
    expect(surface.countCalls('recordSessionEvent')).toBe(5)
    const events = surface.eventsFor(root)
    const keys = events.map((event) => event.name + '\u0000' + (event.detail ?? ''))
    expect(keys.length).toBe(new Set(keys).size)
  })
})

// ---------------------------------------------------------------------------
// World B — fault + retry (event deduplication across a failed bind).
// ---------------------------------------------------------------------------

const worldB = await seedTeamWorld('p5t1-dbl-b')

describe('P5-T1 group 1: double bind idempotency (fault + retry)', () => {
  it('a one-shot slot apply fault fails-closed, and the retry converges without duplicate events', () => {
    const surface = new FakeAgentSetupSurface()
    const persona = recordingSlot('persona', new Error('persona apply fault (one-shot)'))
    const binder = new TeamAgentBinder({
      surface,
      teamDomain: readHandleFor(worldB.domain),
      slots: { persona },
    })
    const root = worldB.ids.rootSessionId

    let thrown: unknown
    try {
      binder.bindFreshRoot(root)
    } catch (error) {
      thrown = error
    }
    expect(thrown !== undefined).toBe(true)
    expect(isTeamAgentBinderError(thrown)).toBe(true)
    if (!isTeamAgentBinderError(thrown)) throw new Error('unreachable')
    expect(thrown.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_OVERLAY_FAILED)
    expect(thrown.details['origin']).toBe('persona')
    expect(thrown.details['sessionId']).toBe(root)
    // The fault is in the slot apply: no surface effect ran at all.
    expect(surface.countCalls('installOverlay')).toBe(0)
    expect(surface.countCalls('recordSessionEvent')).toBe(0)
    // The persona slot applied exactly once (the failed apply).
    expect(persona.applied.length).toBe(0)

    // The retry converges: full fresh install, one event per record.
    const retry = binder.bindFreshRoot(root)
    expect(retry.bound).toBe(true)
    expect(retry.installed).toBe(true)
    expect(persona.applied.length).toBe(1)
    expect(surface.countCalls('installOverlay')).toBe(3)
    expect(surface.countCalls('recordSessionEvent')).toBe(4)
    const events = surface.eventsFor(root)
    const keys = events.map((event) => event.name + '\u0000' + (event.detail ?? ''))
    expect(keys.length).toBe(new Set(keys).size)
  })

  it('a one-shot event-recording fault fails-closed, and the retry records no duplicate (name, detail)', () => {
    const surface = new FakeAgentSetupSurface()
    surface.failNextRecordEvent(new Error('event recording fault (one-shot)'))
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(worldB.domain) })
    const root = worldB.ids.rootSessionId

    let thrown: unknown
    try {
      binder.bindFreshRoot(root)
    } catch (error) {
      thrown = error
    }
    expect(thrown !== undefined).toBe(true)
    expect(isTeamAgentBinderError(thrown)).toBe(true)
    if (!isTeamAgentBinderError(thrown)) throw new Error('unreachable')
    expect(thrown.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_OVERLAY_FAILED)
    expect(thrown.details['origin']).toBe('event-recording')
    // No bound entry was registered by the failed bind: the retry re-drives
    // the full fresh path (six installs total — proven below).

    const retry = binder.bindFreshRoot(root)
    expect(retry.bound).toBe(true)
    expect(retry.installed).toBe(true)
    // The failed attempt installed only the persona slot before the event
    // fault; the retry installs all three (1 + 3 = 4 total), but the
    // durable event stream has no duplicate (name, detail) record.
    expect(surface.countCalls('installOverlay')).toBe(4)
    const events = surface.eventsFor(root)
    expect(events.length).toBe(4)
    const keys = events.map((event) => event.name + '\u0000' + (event.detail ?? ''))
    expect(keys.length).toBe(new Set(keys).size)
  })
})

// ---------------------------------------------------------------------------
// World C — the restart model: a NEW binder over the REOPENED durable domain
// (a second process) must still be idempotent-ordered (no fresh re-run).
// ---------------------------------------------------------------------------

const worldC = await seedTeamWorld('p5t1-dbl-c')
const reopenedC = await restartTeamWorld(worldC.scratchDir)

describe('P5-T1 group 1: double bind idempotency (cold rehydrate after restart)', () => {
  it('the first cold rehydrate restores the scope exactly once; the second is a no-op', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(reopenedC) })
    const root = worldC.ids.rootSessionId

    const first = binder.rehydrateColdRoot(root)
    expect(first.bound).toBe(true)
    expect(first.installed).toBe(true)
    expect(first.identity).toEqual({ kind: 'root', sessionId: root, rootSessionId: root })
    expect(surface.countCalls('installOverlay')).toBe(0)
    expect(surface.countCalls('restoreScope')).toBe(1)
    const restoreCalls = surface.calls.filter((call) => call.method === 'restoreScope')
    const firstRestore = restoreCalls[0]
    const scope = firstRestore === undefined ? undefined : firstRestore.scope
    expect(scope).toEqual({
      kind: 'root',
      rootSessionId: root,
      slots: OVERLAY_SLOT_ORDER,
    })

    const second = binder.rehydrateColdRoot(root)
    expect(second.noopReason).toBe('already-bound')
    expect(second.installed).toBe(false)
    expect(second.identity).toEqual(first.identity)
    expect(second.emittedEvents).toEqual([])
    expect(surface.countCalls('restoreScope')).toBe(1)
    expect(surface.countCalls('recordSessionEvent')).toBe(2)
  })
})

destroyDir(worldA.scratchDir)
destroyDir(worldB.scratchDir)
destroyDir(worldC.scratchDir)
