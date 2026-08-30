/**
 * p5t1-ordinary-noop — TaskDoc §11.5 must-test group 3: ORDINARY AGENT
 * NO-OP.
 *
 * A non-team target (an `ordinary`-bound session, or a session with no
 * TeamDomain binding at all) yields a SUCCESSFUL no-effect result for all
 * four bind methods: zero surface calls, zero session events, zero record
 * writes. A team target asked through the wrong path fails-closed with
 * `BINDER_TARGET_KIND_MISMATCH` (also with zero surface effects). Across
 * ALL FOUR team bind paths the binder writes NOTHING to TeamDomain: it
 * holds only the read-only handle, and the seam write log stays invariant.
 *
 * @module @dsh-agent-team/runtime/test/p5t1-ordinary-noop
 */

import { describe, expect, it } from 'vitest'

import {
  TEAM_AGENT_BINDER_ERROR_CODES,
  TeamAgentBinder,
  isTeamAgentBinderError,
} from '../agent-setup/binder/index.js'
import {
  destroyDir,
  FakeAgentSetupSurface,
  readHandleFor,
  seedTeamWorld,
  type P5T1World,
} from './p5t1-helpers.js'

const world = await seedTeamWorld('p5t1-noop')

/** The ordinary no-op result contract (all four methods, both targets). */
function expectOrdinaryNoop(result: ReturnType<TeamAgentBinder['bindFreshRoot']>, requested: string): void {
  expect(result.requested).toBe(requested)
  expect(result.bound).toBe(false)
  expect(result.installed).toBe(false)
  expect(result.noopReason).toBe('ordinary')
  expect(result.identity).toBe(undefined)
  expect(result.admitted).toBe(undefined)
  expect(result.emittedEvents).toEqual([])
}

function snapshotWrites(worldRef: P5T1World): readonly unknown[] {
  return [...worldRef.seam.writeLog]
}

describe('P5-T1 group 3: ordinary agent no-op', () => {
  it('all four methods on an ordinary-bound session are zero-effect no-ops', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(world.domain) })
    const ordinary = world.ids.ordinarySessionId
    const writesBefore = snapshotWrites(world)

    expectOrdinaryNoop(binder.bindFreshRoot(ordinary), 'fresh-root')
    expectOrdinaryNoop(binder.bindFreshMember(ordinary), 'fresh-member')
    expectOrdinaryNoop(binder.rehydrateColdRoot(ordinary), 'cold-root')
    expectOrdinaryNoop(binder.rehydrateColdMember(ordinary), 'cold-member')

    // Zero surface calls of any kind, zero record writes.
    expect(surface.calls.length).toBe(0)
    expect(world.seam.writeLog).toEqual(writesBefore)
    expect(world.seam.writeCount).toBe(world.seam.writeLog.length)
  })

  it('all four methods on a session with no TeamDomain binding at all are zero-effect no-ops', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(world.domain) })
    const unbound = 'session-unbound-p5t1'
    const writesBefore = snapshotWrites(world)

    expectOrdinaryNoop(binder.bindFreshRoot(unbound), 'fresh-root')
    expectOrdinaryNoop(binder.bindFreshMember(unbound), 'fresh-member')
    expectOrdinaryNoop(binder.rehydrateColdRoot(unbound), 'cold-root')
    expectOrdinaryNoop(binder.rehydrateColdMember(unbound), 'cold-member')

    expect(surface.calls.length).toBe(0)
    expect(world.seam.writeLog).toEqual(writesBefore)
  })
})

describe('P5-T1 group 3: kind mismatch (fail-closed, zero effects)', () => {
  it('a root path on a team-member session is BINDER_TARGET_KIND_MISMATCH with zero surface calls', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(world.domain) })
    const child = world.ids.childSessionId

    let thrown: unknown
    try {
      binder.bindFreshRoot(child)
    } catch (error) {
      thrown = error
    }
    expect(thrown !== undefined).toBe(true)
    expect(isTeamAgentBinderError(thrown)).toBe(true)
    if (!isTeamAgentBinderError(thrown)) throw new Error('unreachable')
    expect(thrown.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_TARGET_KIND_MISMATCH)
    expect(thrown.details['expectedKind']).toBe('team-root')
    expect(thrown.details['foundKind']).toBe('team-member')
    expect(surface.calls.length).toBe(0)
  })

  it('a member path on a team-root session is BINDER_TARGET_KIND_MISMATCH with zero surface calls', () => {
    const surface = new FakeAgentSetupSurface()
    const binder = new TeamAgentBinder({ surface, teamDomain: readHandleFor(world.domain) })
    const root = world.ids.rootSessionId

    let thrown: unknown
    try {
      binder.rehydrateColdMember(root)
    } catch (error) {
      thrown = error
    }
    expect(thrown !== undefined).toBe(true)
    expect(isTeamAgentBinderError(thrown)).toBe(true)
    if (!isTeamAgentBinderError(thrown)) throw new Error('unreachable')
    expect(thrown.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_TARGET_KIND_MISMATCH)
    expect(thrown.details['expectedKind']).toBe('team-member')
    expect(thrown.details['foundKind']).toBe('team-root')
    expect(surface.calls.length).toBe(0)
  })
})

describe('P5-T1 group 3: the binder never writes TeamDomain (zero-write proof)', () => {
  it('all four team bind paths leave the seam write log invariant', () => {
    const writesBefore = snapshotWrites(world)
    const root = world.ids.rootSessionId
    const child = world.ids.childSessionId

    // Process 1: the two FRESH paths (full effects on the surface).
    const surface1 = new FakeAgentSetupSurface()
    const binder1 = new TeamAgentBinder({ surface: surface1, teamDomain: readHandleFor(world.domain) })
    expect(binder1.bindFreshRoot(root).installed).toBe(true)
    expect(binder1.bindFreshMember(child).installed).toBe(true)

    // Process 2: the two COLD paths (a fresh binder, empty bound state).
    const surface2 = new FakeAgentSetupSurface()
    const binder2 = new TeamAgentBinder({ surface: surface2, teamDomain: readHandleFor(world.domain) })
    expect(binder2.rehydrateColdRoot(root).installed).toBe(true)
    expect(binder2.rehydrateColdMember(child).installed).toBe(true)

    // The durable write log is EXACTLY the seeding writes: the binder wrote
    // nothing (it holds only the read-only handle).
    expect(world.seam.writeLog).toEqual(writesBefore)
    expect(world.seam.writeCount).toBe(world.seam.writeLog.length)
  })
})

destroyDir(world.scratchDir)
