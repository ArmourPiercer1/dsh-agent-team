/**
 * p5t1-fresh-cold-paths — TaskDoc §11.5 must-test group 2: FRESH/COLD MOCK
 * FOUR PATHS (all green, mock-first, real P4 repositories + FileStorageSeam
 * as the durable truth).
 *
 * - FRESH = first-install full effects: the three overlay slots are applied
 *   in the frozen order (persona → model → capability), each through
 *   `installOverlay`, each with its `agent-setup/overlay-installed` event,
 *   then the admission decision;
 * - COLD = rehydrate from the durable TeamDomain records (the P4 storage
 *   repositories over the testkit file seam — including across a seam
 *   restart, the process-restart model): ONE `restoreScope` with the full
 *   slot set, ZERO fresh-time side effects (no slot `apply`, no
 *   `installOverlay`);
 * - the error paths (missing record, terminal member, record conflict) are
 *   fail-closed with zero surface effects.
 *
 * @module @dsh-agent-team/runtime/test/p5t1-fresh-cold-paths
 */

import { describe, expect, it } from 'vitest'

import {
  ADMISSION_OPEN_CODE,
  AGENT_SETUP_EVENT_NAMES,
  OVERLAY_SLOT_ORDER,
  TEAM_AGENT_BINDER_ERROR_CODES,
  TeamAgentBinder,
  isTeamAgentBinderError,
} from '../agent-setup/binder/index.js'
import {
  destroyDir,
  FakeAgentSetupSurface,
  readHandleFor,
  recordingSlot,
  restartTeamWorld,
  seedPartialWorld,
  seedTeamWorld,
} from './p5t1-helpers.js'

/** The ordered slot-install assertions of one fresh path. */
function expectFreshEffects(surface: FakeAgentSetupSurface, sessionId: string): void {
  const installs = surface.calls
    .filter((call) => call.method === 'installOverlay' && call.sessionId === sessionId)
    .map((call) => call.slot)
  expect(installs).toEqual(['persona', 'model', 'capability'])
  expect(surface.countCalls('restoreScope', sessionId)).toBe(0)
  expect(surface.eventsFor(sessionId)).toEqual([
    { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'persona' },
    { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'model' },
    { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: 'capability' },
    { name: AGENT_SETUP_EVENT_NAMES.admissionDecided, detail: ADMISSION_OPEN_CODE },
  ])
}

// ---------------------------------------------------------------------------
// World A — the full world: both fresh paths.
// ---------------------------------------------------------------------------

const worldA = await seedTeamWorld('p5t1-fc-a')

describe('P5-T1 group 2: fresh paths (full effects, fixed order)', () => {
  it('fresh root installs the three slots in persona → model → capability order', () => {
    const surface = new FakeAgentSetupSurface()
    const persona = recordingSlot('persona')
    const model = recordingSlot('model')
    const capability = recordingSlot('capability')
    const binder = new TeamAgentBinder({
      surface,
      teamDomain: readHandleFor(worldA.domain),
      slots: { persona, model, capability },
    })
    const root = worldA.ids.rootSessionId

    const result = binder.bindFreshRoot(root)
    expect(result.bound).toBe(true)
    expect(result.installed).toBe(true)
    expect(result.requested).toBe('fresh-root')
    expect(result.identity).toEqual({ kind: 'root', sessionId: root, rootSessionId: root })
    expect(result.admitted).toBe(true)
    expect(result.admissionCode).toBe(ADMISSION_OPEN_CODE)
    expectFreshEffects(surface, root)

    // Every slot applied exactly once, with the binder's step context
    // (target + durable record + path) — the slot contract.
    expect(persona.applied.length).toBe(1)
    expect(model.applied.length).toBe(1)
    expect(capability.applied.length).toBe(1)
    const personaContext = persona.applied[0]
    expect(personaContext === undefined).toBe(false)
    if (personaContext !== undefined) {
      expect(personaContext.target).toEqual({ kind: 'root', sessionId: root, rootSessionId: root })
      expect(personaContext.path).toBe('fresh-root')
    }
    expect(persona.applied.length).toBe(model.applied.length)
  })

  it('fresh member installs the full effect profile on the child session with the composite identity', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(worldA.domain) })
    const child = worldA.ids.childSessionId
    const root = worldA.ids.rootSessionId
    const instance = worldA.ids.instanceId

    const result = binder.bindFreshMember(child)
    expect(result.bound).toBe(true)
    expect(result.installed).toBe(true)
    expect(result.requested).toBe('fresh-member')
    expect(result.identity).toEqual({
      kind: 'member',
      sessionId: child,
      rootSessionId: root,
      instanceId: instance,
    })
    expectFreshEffects(surface, child)
    // The effects land on the member CHILD session (invariant 23).
    expect(surface.countCalls('installOverlay', child)).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// World B — the restart world: both cold paths (no fresh-time effects).
// ---------------------------------------------------------------------------

const worldB = await seedTeamWorld('p5t1-fc-b')
const reopenedB = await restartTeamWorld(worldB.scratchDir)

describe('P5-T1 group 2: cold paths (durable rehydrate, zero fresh-time side effects)', () => {
  it('cold root restores the scope once from the durable record (after a restart)', () => {
    const surface = new FakeAgentSetupSurface()
    const persona = recordingSlot('persona')
    const model = recordingSlot('model')
    const capability = recordingSlot('capability')
    const binder = new TeamAgentBinder({
      surface,
      teamDomain: readHandleFor(reopenedB),
      slots: { persona, model, capability },
    })
    const root = worldB.ids.rootSessionId

    const result = binder.rehydrateColdRoot(root)
    expect(result.bound).toBe(true)
    expect(result.installed).toBe(true)
    expect(result.requested).toBe('cold-root')
    // The identity comes from the DURABLE record and equals the identity a
    // fresh bind of the same target returns.
    expect(result.identity).toEqual({ kind: 'root', sessionId: root, rootSessionId: root })
    expect(result.admitted).toBe(true)

    // ZERO fresh-time side effects: no slot apply, no installOverlay.
    expect(persona.applied.length).toBe(0)
    expect(model.applied.length).toBe(0)
    expect(capability.applied.length).toBe(0)
    expect(surface.countCalls('installOverlay')).toBe(0)

    // Exactly ONE restoreScope with the full slot set, then the events.
    expect(surface.countCalls('restoreScope', root)).toBe(1)
    const restoreCalls = surface.calls.filter((call) => call.method === 'restoreScope')
    const firstRestore = restoreCalls[0]
    const scope = firstRestore === undefined ? undefined : firstRestore.scope
    expect(scope).toEqual({ kind: 'root', rootSessionId: root, slots: OVERLAY_SLOT_ORDER })
    expect(surface.eventsFor(root)).toEqual([
      { name: AGENT_SETUP_EVENT_NAMES.scopeRestored, detail: 'root' },
      { name: AGENT_SETUP_EVENT_NAMES.admissionDecided, detail: ADMISSION_OPEN_CODE },
    ])
  })

  it('cold member restores the member scope (kind + instanceId) with zero fresh-time side effects', () => {
    const surface = new FakeAgentSetupSurface()
    const persona = recordingSlot('persona')
    const binder = new TeamAgentBinder({
      surface,
      teamDomain: readHandleFor(reopenedB),
      slots: { persona },
    })
    const child = worldB.ids.childSessionId
    const root = worldB.ids.rootSessionId
    const instance = worldB.ids.instanceId

    const result = binder.rehydrateColdMember(child)
    expect(result.bound).toBe(true)
    expect(result.installed).toBe(true)
    expect(result.requested).toBe('cold-member')
    expect(result.identity).toEqual({
      kind: 'member',
      sessionId: child,
      rootSessionId: root,
      instanceId: instance,
    })
    expect(persona.applied.length).toBe(0)
    expect(surface.countCalls('installOverlay')).toBe(0)
    expect(surface.countCalls('restoreScope', child)).toBe(1)
    const restoreCalls = surface.calls.filter((call) => call.method === 'restoreScope')
    const firstRestore = restoreCalls[0]
    const scope = firstRestore === undefined ? undefined : firstRestore.scope
    expect(scope).toEqual({
      kind: 'member',
      rootSessionId: root,
      instanceId: instance,
      slots: OVERLAY_SLOT_ORDER,
    })
    expect(surface.eventsFor(child)).toEqual([
      { name: AGENT_SETUP_EVENT_NAMES.scopeRestored, detail: 'member' },
      { name: AGENT_SETUP_EVENT_NAMES.admissionDecided, detail: ADMISSION_OPEN_CODE },
    ])
  })
})

// ---------------------------------------------------------------------------
// Worlds C–F — the fail-closed error paths (zero surface effects).
// ---------------------------------------------------------------------------

const worldC = await seedPartialWorld('p5t1-fc-c', { teamSession: false })
const worldD = await seedPartialWorld('p5t1-fc-d', { memberInstance: false })
const worldE = await seedPartialWorld('p5t1-fc-e', { memberLifecycle: 'DISPOSED' })
const worldF = await seedPartialWorld('p5t1-fc-f', {
  memberChildSessionId: 'session-child-p5t1conflict',
})

describe('P5-T1 group 2: fail-closed error paths (zero surface effects)', () => {
  it('a team-root binding without the TeamSession record is BINDER_TARGET_NOT_FOUND', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(worldC.domain) })
    const root = worldC.ids.rootSessionId

    let thrown: unknown
    try {
      binder.bindFreshRoot(root)
    } catch (error) {
      thrown = error
    }
    expect(thrown !== undefined).toBe(true)
    expect(isTeamAgentBinderError(thrown)).toBe(true)
    if (!isTeamAgentBinderError(thrown)) throw new Error('unreachable')
    expect(thrown.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_TARGET_NOT_FOUND)
    expect(surface.countCalls('installOverlay')).toBe(0)
    expect(surface.countCalls('restoreScope')).toBe(0)
    expect(surface.countCalls('recordSessionEvent')).toBe(0)
  })

  it('a team-member binding without the MemberInstance record is BINDER_TARGET_NOT_FOUND', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(worldD.domain) })
    const child = worldD.ids.childSessionId

    let thrown: unknown
    try {
      binder.rehydrateColdMember(child)
    } catch (error) {
      thrown = error
    }
    expect(thrown !== undefined).toBe(true)
    expect(isTeamAgentBinderError(thrown)).toBe(true)
    if (!isTeamAgentBinderError(thrown)) throw new Error('unreachable')
    expect(thrown.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_TARGET_NOT_FOUND)
    expect(surface.countCalls('installOverlay')).toBe(0)
    expect(surface.countCalls('restoreScope')).toBe(0)
  })

  it('a terminal (DISPOSED) member is BINDER_MEMBER_DISPOSED', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(worldE.domain) })
    const child = worldE.ids.childSessionId

    let thrown: unknown
    try {
      binder.bindFreshMember(child)
    } catch (error) {
      thrown = error
    }
    expect(thrown !== undefined).toBe(true)
    expect(isTeamAgentBinderError(thrown)).toBe(true)
    if (!isTeamAgentBinderError(thrown)) throw new Error('unreachable')
    expect(thrown.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_MEMBER_DISPOSED)
    expect(thrown.details['instanceId']).toBe(worldE.ids.instanceId)
    expect(surface.countCalls('installOverlay')).toBe(0)
    expect(surface.countCalls('restoreScope')).toBe(0)
  })

  it('a binding/record child-session conflict is BINDER_RECORD_CONFLICT', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(worldF.domain) })
    const child = worldF.ids.childSessionId

    let thrown: unknown
    try {
      binder.bindFreshMember(child)
    } catch (error) {
      thrown = error
    }
    expect(thrown !== undefined).toBe(true)
    expect(isTeamAgentBinderError(thrown)).toBe(true)
    if (!isTeamAgentBinderError(thrown)) throw new Error('unreachable')
    expect(thrown.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_RECORD_CONFLICT)
    expect(thrown.details['bindingChildSessionId']).toBe(child)
    expect(thrown.details['recordChildSessionId']).toBe('session-child-p5t1conflict')
    expect(surface.countCalls('installOverlay')).toBe(0)
    expect(surface.countCalls('restoreScope')).toBe(0)
  })
})

destroyDir(worldA.scratchDir)
destroyDir(worldB.scratchDir)
destroyDir(worldC.scratchDir)
destroyDir(worldD.scratchDir)
destroyDir(worldE.scratchDir)
destroyDir(worldF.scratchDir)
