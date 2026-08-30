/**
 * p5t1-overlay-slots — the P5-T1 overlay SLOT contract + the admission
 * DECISION POINT (ruling R28: "T1 只定义槽位契约 + 恒等默认实现"; "T1 只留
 * 决策点与错误码通道").
 *
 * - the T1 identity (no-op) defaults make the skeleton fully orchestratable
 *   (all four paths run end-to-end with NO slot overrides);
 * - the slot contract: `apply(context)` receives the binder's step context
 *   (target + durable record + path) and runs in the frozen
 *   persona → model → capability order; a throwing `apply` is a FATAL
 *   `BINDER_OVERLAY_FAILED` (fail-closed: no later slot, no admission
 *   decision, no registration — a retry re-drives, it never no-ops);
 * - the surface effects (`installOverlay` / `restoreScope` /
 *   `recordSessionEvent`) are fail-closed too, with the failing origin in
 *   the error details;
 * - the admission decision point (fail-closed): the default guard admits
 *   with `ADMISSION_OPEN`; a rejecting guard surfaces `admitted: false` +
 *   its closed code through the result AND the `admission-decided` event
 *   detail; a THROWING guard is a rejection with `ADMISSION_GUARD_ERROR`
 *   (a guard fault never admits, and never crashes the bind caller);
 * - admission is decided AFTER the install effects (call-order proof);
 * - every emitted event name is one of the closed `agent-setup/*` values.
 *
 * @module @dsh-agent-team/runtime/test/p5t1-overlay-slots
 */

import { describe, expect, it } from 'vitest'

import {
  ADMISSION_GUARD_ERROR_CODE,
  ADMISSION_OPEN_CODE,
  AGENT_SETUP_EVENT_NAMES,
  TEAM_AGENT_BINDER_ERROR_CODES,
  TeamAgentBinder,
  isTeamAgentBinderError,
} from '../agent-setup/binder/index.js'
import type { OverlaySlot } from '../agent-setup/binder/index.js'
import {
  destroyDir,
  FakeAgentSetupSurface,
  readHandleFor,
  rejectingGuard,
  recordingSlot,
  seedTeamWorld,
  throwingGuard,
} from './p5t1-helpers.js'

const world = await seedTeamWorld('p5t1-slots')

const KNOWN_EVENT_NAMES: readonly string[] = [
  AGENT_SETUP_EVENT_NAMES.overlayInstalled,
  AGENT_SETUP_EVENT_NAMES.scopeRestored,
  AGENT_SETUP_EVENT_NAMES.admissionDecided,
]

/** Assert every surface-recorded event name is in the closed `agent-setup/*` set. */
function expectEventNamesClosed(surface: FakeAgentSetupSurface): void {
  for (const event of surface.calls.filter((call) => call.method === 'recordSessionEvent')) {
    const name = event.event === undefined ? '' : event.event.name
    expect(KNOWN_EVENT_NAMES.includes(name)).toBe(true)
  }
}

describe('P5-T1 overlay slots: T1 identity defaults', () => {
  it('the four paths run end-to-end with zero slot overrides (identity defaults)', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(world.domain) })
    const root = world.ids.rootSessionId
    const child = world.ids.childSessionId

    expect(binder.bindFreshRoot(root).installed).toBe(true)
    expect(binder.bindFreshMember(child).installed).toBe(true)
    // The identity slots do nothing public: the surface effects are the
    // only observable effects, in the frozen order.
    expect(surface.countCalls('installOverlay', root)).toBe(3)
    expect(surface.countCalls('installOverlay', child)).toBe(3)
    expectEventNamesClosed(surface)
  })
})

describe('P5-T1 overlay slots: slot failure is fatal before work', () => {
  it('a persistently throwing persona slot fails both attempts; the target is never registered', () => {
    const surface = new FakeAgentSetupSurface()
    let applyCount = 0
    const brokenPersona: OverlaySlot = {
      name: 'persona',
      apply(): void {
        applyCount += 1
        throw new Error('persona always broken')
      },
    }
    const model = recordingSlot('model')
    const binder = new TeamAgentBinder({
      surface,
      teamDomain: readHandleFor(world.domain),
      slots: { persona: brokenPersona, model },
    })
    const root = world.ids.rootSessionId

    let first: unknown
    try {
      binder.bindFreshRoot(root)
    } catch (error) {
      first = error
    }
    expect(isTeamAgentBinderError(first)).toBe(true)
    if (!isTeamAgentBinderError(first)) throw new Error('unreachable')
    expect(first.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_OVERLAY_FAILED)
    expect(first.details['origin']).toBe('persona')
    expect(first.details['path']).toBe('fresh-root')
    // The original error is preserved on `cause` (details stay lossless-JSON).
    expect(first.cause !== undefined).toBe(true)
    const causeMessage = first.cause instanceof Error ? first.cause.message : String(first.cause)
    expect(first.details['causeMessage']).toBe(causeMessage)

    // FATAL before work: no later slot ran, no surface effect ran, no event.
    expect(model.applied.length).toBe(0)
    expect(surface.countCalls('installOverlay')).toBe(0)
    expect(surface.countCalls('recordSessionEvent')).toBe(0)
    expectEventNamesClosed(surface)

    // A retry RE-DRIVES (the failed bind registered nothing): the slot
    // applies a second time and fails again.
    let second: unknown
    try {
      binder.bindFreshRoot(root)
    } catch (error) {
      second = error
    }
    expect(isTeamAgentBinderError(second)).toBe(true)
    if (!isTeamAgentBinderError(second)) throw new Error('unreachable')
    expect(second.details['origin']).toBe('persona')
    expect(applyCount).toBe(2)
    expect(surface.countCalls('installOverlay')).toBe(0)
  })

  it('an installOverlay fault on the persona slot stops the later slots (origin = the slot)', () => {
    const surface = new FakeAgentSetupSurface()
    surface.failNextInstall(new Error('install fault (one-shot)'))
    const persona = recordingSlot('persona')
    const model = recordingSlot('model')
    const capability = recordingSlot('capability')
    const binder = new TeamAgentBinder({
      surface,
      teamDomain: readHandleFor(world.domain),
      slots: { persona, model, capability },
    })
    const root = world.ids.rootSessionId

    let thrown: unknown
    try {
      binder.bindFreshRoot(root)
    } catch (error) {
      thrown = error
    }
    expect(isTeamAgentBinderError(thrown)).toBe(true)
    if (!isTeamAgentBinderError(thrown)) throw new Error('unreachable')
    expect(thrown.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_OVERLAY_FAILED)
    expect(thrown.details['origin']).toBe('persona')
    // The persona slot applied; its install failed (not recorded as a
    // successful call); model/capability never ran.
    expect(persona.applied.length).toBe(1)
    expect(model.applied.length).toBe(0)
    expect(capability.applied.length).toBe(0)
    expect(surface.countCalls('installOverlay')).toBe(0)
    expect(surface.countCalls('recordSessionEvent')).toBe(0)
  })

  it('a restoreScope fault on the cold path fails-closed (origin = restore) and re-drives on retry', () => {
    const surface = new FakeAgentSetupSurface()
    surface.failNextRestore(new Error('restore fault (one-shot)'))
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(world.domain) })
    const child = world.ids.childSessionId

    let first: unknown
    try {
      binder.rehydrateColdMember(child)
    } catch (error) {
      first = error
    }
    expect(isTeamAgentBinderError(first)).toBe(true)
    if (!isTeamAgentBinderError(first)) throw new Error('unreachable')
    expect(first.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_OVERLAY_FAILED)
    expect(first.details['origin']).toBe('restore')
    // No admission decision ran (no admission-decided event).
    expect(surface.countCalls('recordSessionEvent')).toBe(0)

    // The retry re-drives the cold path (one-shot fault already consumed):
    // exactly one successful restoreScope is recorded in total.
    const retry = binder.rehydrateColdMember(child)
    expect(retry.installed).toBe(true)
    expect(surface.countCalls('restoreScope')).toBe(1)
    expect(surface.eventsFor(child)).toEqual([
      { name: AGENT_SETUP_EVENT_NAMES.scopeRestored, detail: 'member' },
      { name: AGENT_SETUP_EVENT_NAMES.admissionDecided, detail: ADMISSION_OPEN_CODE },
    ])
  })
})

describe('P5-T1 admission decision point (fail-closed)', () => {
  it('the default guard admits with ADMISSION_OPEN (the result + event channels agree)', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(world.domain) })
    const result = binder.bindFreshRoot(world.ids.rootSessionId)
    expect(result.admitted).toBe(true)
    expect(result.admissionCode).toBe(ADMISSION_OPEN_CODE)
    expect(result.emittedEvents.at(-1)).toEqual({
      name: AGENT_SETUP_EVENT_NAMES.admissionDecided,
      detail: ADMISSION_OPEN_CODE,
    })
  })

  it('a rejecting guard surfaces admitted:false + its closed code through the result and the event', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({
      surface,
      teamDomain: readHandleFor(world.domain),
      admissionGuard: rejectingGuard('PERSONA_CONFLICT_PRESET', 'conflicting preset bound'),
    })
    const root = world.ids.rootSessionId

    const result = binder.bindFreshRoot(root)
    // The effects still ran (the admission decision is the LAST step): the
    // caller gates any Team work on `admitted`.
    expect(result.bound).toBe(true)
    expect(result.installed).toBe(true)
    expect(result.admitted).toBe(false)
    expect(result.admissionCode).toBe('PERSONA_CONFLICT_PRESET')
    expect(surface.countCalls('installOverlay', root)).toBe(3)
    expect(surface.eventsFor(root).at(-1)).toEqual({
      name: AGENT_SETUP_EVENT_NAMES.admissionDecided,
      detail: 'PERSONA_CONFLICT_PRESET',
    })
  })

  it('a throwing guard is a rejection with ADMISSION_GUARD_ERROR (no crash, fail-closed)', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({
      surface,
      teamDomain: readHandleFor(world.domain),
      admissionGuard: throwingGuard(new Error('guard exploded')),
    })
    const root = world.ids.rootSessionId

    const result = binder.bindFreshRoot(root)
    expect(result.bound).toBe(true)
    expect(result.installed).toBe(true)
    expect(result.admitted).toBe(false)
    expect(result.admissionCode).toBe(ADMISSION_GUARD_ERROR_CODE)
    expect(surface.eventsFor(root).at(-1)).toEqual({
      name: AGENT_SETUP_EVENT_NAMES.admissionDecided,
      detail: ADMISSION_GUARD_ERROR_CODE,
    })
  })

  it('the admission decision is made AFTER all install effects (call-order proof)', () => {
    const surface = new FakeAgentSetupSurface()
    let installCountAtDecide = -1
    const guard = {
      decide(): { status: 'admitted' } {
        installCountAtDecide = surface.countCalls('installOverlay', world.ids.rootSessionId)
        return { status: 'admitted' }
      },
    }
    const binder = new TeamAgentBinder({
      surface,
      teamDomain: readHandleFor(world.domain),
      admissionGuard: guard,
    })
    const root = world.ids.rootSessionId

    const result = binder.bindFreshRoot(root)
    expect(result.admitted).toBe(true)
    // At the moment of the decision, all three slot installs had already run.
    expect(installCountAtDecide).toBe(3)
    // And the admission-decided event was recorded after the decision.
    const events = surface.eventsFor(root)
    expect(events.at(-1)?.name).toBe(AGENT_SETUP_EVENT_NAMES.admissionDecided)
    expectEventNamesClosed(surface)
  })
})

destroyDir(world.scratchDir)
