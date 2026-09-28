/**
 * team-view-sync-complete (frozen decision 1) — the ONE durable session-
 * affiliation resolver behind `team.getReadState` (the remote contract
 * v6 read-state query).
 *
 * Coverage (the frozen fail-closed semantics): the durable rows are the
 * SOLE authority — `team-root` / `team-member` ONLY on a durable claim
 * (a binding row, or the crash-window durable corroboration); `none`
 * ONLY on a positively confirmed no-affiliation (an `ordinary` binding
 * row, or a COMPLETED scan that found no claim); a DISPOSED member STILL
 * resolves as `team-member` with `disposed: true`; EVERY storage /
 * integrity failure fails CLOSED as a typed error and NEVER a `none`
 * (a throwing `get` / `list` propagates unchanged; an unfinished scan is
 * not a scan result; an absent generation / lifecycle carrier is the
 * typed TEAM_READ_STATE_* code, not a guess).
 *
 * Pure spec: the repositories are in-memory doubles (the structural
 * projection the resolver touches — the real `TeamDomain.repositories`
 * satisfies the same shape).
 */
import { describe, expect, it } from 'vitest'
import {
  resolveSessionReadState,
  TEAM_READ_STATE_ERROR_CODES,
  type TeamReadStateDomain,
} from '../src/plugin/team-read-state.js'
import { TeamPluginError } from '../src/plugin/types.js'

// ---------------------------------------------------------------------------
// In-memory repository doubles
// ---------------------------------------------------------------------------

interface TeamRow {
  rootSessionId: string
  generation: number
}
interface MemberRow {
  rootSessionId: string
  instanceId: string
  childSessionId?: string
  lifecycle: string
}
interface BindingRow {
  kind: 'ordinary' | 'team-root' | 'team-member'
  sessionId: string
  rootSessionId?: string
  instanceId?: string
}

interface World {
  bindings: Map<string, BindingRow>
  teams: Map<string, TeamRow>
  members: Map<string, MemberRow[]> // rootSessionId → rows
  faults: {
    bindingGet?: (sid: string) => void
    teamGet?: (sid: string) => void
    teamList?: () => void
    memberGet?: (root: string, id: string) => void
    memberList?: (root: string) => void
  }
}

function makeWorld(world: World): TeamReadStateDomain {
  // The doubles carry the STRUCTURAL cells the resolver reads (the
  // documented type lie of the member listing is exercised on purpose —
  // a v2 leader row without childSessionId / lifecycle). The boundary
  // cast is the test-double edge (the same pattern d1-s6-remote-v3 uses
  // for its trip-wire repositories).
  return {
    repositories: {
      sessionBindings: {
        get(sessionId: string) {
          if (world.faults.bindingGet !== undefined) world.faults.bindingGet(sessionId)
          return world.bindings.get(sessionId) as never
        },
      },
      teamSessions: {
        get(rootSessionId: string) {
          if (world.faults.teamGet !== undefined) world.faults.teamGet(rootSessionId)
          return world.teams.get(rootSessionId) as never
        },
        list() {
          if (world.faults.teamList !== undefined) world.faults.teamList()
          return [...world.teams.values()] as never
        },
      },
      memberInstances: {
        get(rootSessionId: string, instanceId: string) {
          if (world.faults.memberGet !== undefined) world.faults.memberGet(rootSessionId, instanceId)
          const rows = world.members.get(rootSessionId) ?? []
          return rows.find((row) => row.instanceId === instanceId) as never
        },
        list(rootSessionId: string) {
          if (world.faults.memberList !== undefined) world.faults.memberList(rootSessionId)
          return (world.members.get(rootSessionId) ?? []) as never
        },
      },
    },
  }
}

const BOOT = 'root-boot'

function expectCode(error: unknown, code: string): void {
  if (!(error instanceof TeamPluginError)) {
    throw new Error(`expected a TeamPluginError, got ${String(error)}`)
  }
  if (error.code !== code) {
    throw new Error(`expected code ${code}, got ${error.code}`)
  }
}

function throwsCode(
  fn: () => unknown,
  code: string,
): void {
  let thrown: unknown
  try {
    fn()
  } catch (error) {
    thrown = error
  }
  if (thrown === undefined) throw new Error(`expected ${code} to be thrown, nothing threw`)
  expectCode(thrown, code)
}

// ---------------------------------------------------------------------------
// (1) the binding row is authoritative
// ---------------------------------------------------------------------------

describe('team-view-sync-complete — the durable read-state resolver (frozen decision 1)', () => {
  it('an ordinary binding is the positively confirmed none (every cell present, nulls typed)', () => {
    const world = makeWorld({
      bindings: new Map([['ordinary-1', { kind: 'ordinary', sessionId: 'ordinary-1' }]]),
      teams: new Map(),
      members: new Map(),
      faults: {},
    })
    const value = resolveSessionReadState(world, BOOT, 'ordinary-1')
    expect(value.relation).toBe('none')
    expect(value.teamSessionId).toBeNull()
    expect(value.memberInstanceId).toBeNull()
    expect(value.disposed).toBe(false)
    expect(value.durableGeneration).toBeNull()
  })

  it('a team-root binding with its team row resolves team-root + the durable generation', () => {
    const world = makeWorld({
      bindings: new Map([
        ['root-a', { kind: 'team-root', sessionId: 'root-a' }],
      ]),
      teams: new Map([['root-a', { rootSessionId: 'root-a', generation: 12 }]]),
      members: new Map(),
      faults: {},
    })
    const value = resolveSessionReadState(world, BOOT, 'root-a')
    expect(value.relation).toBe('team-root')
    expect(value.teamSessionId).toBe('root-a')
    expect(value.memberInstanceId).toBeNull()
    expect(value.disposed).toBe(false)
    expect(value.durableGeneration).toBe(12)
  })

  it('a team-root binding WITHOUT its team row fails closed (TEAM_ROW_ABSENT — never a none)', () => {
    const world = makeWorld({
      bindings: new Map([
        ['root-x', { kind: 'team-root', sessionId: 'root-x' }],
      ]),
      teams: new Map(),
      members: new Map(),
      faults: {},
    })
    throwsCode(
      () => resolveSessionReadState(world, BOOT, 'root-x'),
      TEAM_READ_STATE_ERROR_CODES.TEAM_ROW_ABSENT,
    )
  })

  it('a team-member binding resolves team-member with the instance id + the team generation', () => {
    const world = makeWorld({
      bindings: new Map([
        ['child-1', { kind: 'team-member', sessionId: 'child-1', rootSessionId: 'root-a', instanceId: 'inst-1' }],
      ]),
      teams: new Map([['root-a', { rootSessionId: 'root-a', generation: 7 }]]),
      members: new Map([
        ['root-a', [{ rootSessionId: 'root-a', instanceId: 'inst-1', childSessionId: 'child-1', lifecycle: 'RUNNING' }]],
      ]),
      faults: {},
    })
    const value = resolveSessionReadState(world, BOOT, 'child-1')
    expect(value.relation).toBe('team-member')
    expect(value.teamSessionId).toBe('root-a')
    expect(value.memberInstanceId).toBe('inst-1')
    expect(value.disposed).toBe(false)
    expect(value.durableGeneration).toBe(7)
  })

  it('a DISPOSED member STILL resolves team-member with disposed: true (frozen decision 1 — no historical grant deletion)', () => {
    const world = makeWorld({
      bindings: new Map([
        ['child-2', { kind: 'team-member', sessionId: 'child-2', rootSessionId: 'root-a', instanceId: 'inst-2' }],
      ]),
      teams: new Map([['root-a', { rootSessionId: 'root-a', generation: 3 }]]),
      members: new Map([
        ['root-a', [{ rootSessionId: 'root-a', instanceId: 'inst-2', childSessionId: 'child-2', lifecycle: 'DISPOSED' }]],
      ]),
      faults: {},
    })
    const value = resolveSessionReadState(world, BOOT, 'child-2')
    expect(value.relation).toBe('team-member')
    expect(value.disposed).toBe(true)
    expect(value.memberInstanceId).toBe('inst-2')
    expect(value.durableGeneration).toBe(3)
  })

  it('a team-member binding WITHOUT its member row fails closed (MEMBER_ROW_ABSENT)', () => {
    const world = makeWorld({
      bindings: new Map([
        ['child-3', { kind: 'team-member', sessionId: 'child-3', rootSessionId: 'root-a', instanceId: 'inst-gone' }],
      ]),
      teams: new Map([['root-a', { rootSessionId: 'root-a', generation: 1 }]]),
      members: new Map(),
      faults: {},
    })
    throwsCode(
      () => resolveSessionReadState(world, BOOT, 'child-3'),
      TEAM_READ_STATE_ERROR_CODES.MEMBER_ROW_ABSENT,
    )
  })

  it('a team-member binding whose TEAM row is absent fails closed on the team row FIRST (the generation carrier)', () => {
    const world = makeWorld({
      bindings: new Map([
        ['child-4', { kind: 'team-member', sessionId: 'child-4', rootSessionId: 'root-b', instanceId: 'inst-1' }],
      ]),
      teams: new Map(),
      members: new Map([
        ['root-b', [{ rootSessionId: 'root-b', instanceId: 'inst-1', childSessionId: 'child-4', lifecycle: 'RUNNING' }]],
      ]),
      faults: {},
    })
    throwsCode(
      () => resolveSessionReadState(world, BOOT, 'child-4'),
      TEAM_READ_STATE_ERROR_CODES.TEAM_ROW_ABSENT,
    )
  })

  // ------------------------------------------------------------------
  // (2) no binding row: the crash-window durable corroboration
  // ------------------------------------------------------------------

  it('the boot root ITSELF without a binding row resolves team-root (its own row)', () => {
    const world = makeWorld({
      bindings: new Map(),
      teams: new Map([[BOOT, { rootSessionId: BOOT, generation: 9 }]]),
      members: new Map(),
      faults: {},
    })
    const value = resolveSessionReadState(world, BOOT, BOOT)
    expect(value.relation).toBe('team-root')
    expect(value.teamSessionId).toBe(BOOT)
    expect(value.durableGeneration).toBe(9)
  })

  it('the boot root without a binding row AND without its team row fails closed (no generation carrier)', () => {
    const world = makeWorld({
      bindings: new Map(),
      teams: new Map(),
      members: new Map(),
      faults: {},
    })
    throwsCode(
      () => resolveSessionReadState(world, BOOT, BOOT),
      TEAM_READ_STATE_ERROR_CODES.TEAM_ROW_ABSENT,
    )
  })

  it('a session carrying its OWN team row (a non-boot root) resolves team-root', () => {
    const world = makeWorld({
      bindings: new Map(),
      teams: new Map([
        [BOOT, { rootSessionId: BOOT, generation: 1 }],
        ['root-other', { rootSessionId: 'root-other', generation: 5 }],
      ]),
      members: new Map(),
      faults: {},
    })
    const value = resolveSessionReadState(world, BOOT, 'root-other')
    expect(value.relation).toBe('team-root')
    expect(value.teamSessionId).toBe('root-other')
    expect(value.durableGeneration).toBe(5)
  })

  it('a member CHILD of the boot root (no binding row) resolves team-member (the boot root is traversed first)', () => {
    const world = makeWorld({
      bindings: new Map(),
      teams: new Map([[BOOT, { rootSessionId: BOOT, generation: 4 }]]),
      members: new Map([
        [BOOT, [{ rootSessionId: BOOT, instanceId: 'inst-9', childSessionId: 'child-9', lifecycle: 'RUNNING' }]],
      ]),
      faults: {},
    })
    const value = resolveSessionReadState(world, BOOT, 'child-9')
    expect(value.relation).toBe('team-member')
    expect(value.teamSessionId).toBe(BOOT)
    expect(value.memberInstanceId).toBe('inst-9')
    expect(value.disposed).toBe(false)
    expect(value.durableGeneration).toBe(4)
  })

  it('a member CHILD of a LISTED non-boot team root resolves team-member (the same traversal order the ownership resolver uses)', () => {
    const world = makeWorld({
      bindings: new Map(),
      teams: new Map([
        [BOOT, { rootSessionId: BOOT, generation: 1 }],
        ['root-later', { rootSessionId: 'root-later', generation: 6 }],
      ]),
      members: new Map([
        ['root-later', [{ rootSessionId: 'root-later', instanceId: 'inst-7', childSessionId: 'child-7', lifecycle: 'DISPOSED' }]],
      ]),
      faults: {},
    })
    const value = resolveSessionReadState(world, BOOT, 'child-7')
    expect(value.relation).toBe('team-member')
    expect(value.teamSessionId).toBe('root-later')
    expect(value.memberInstanceId).toBe('inst-7')
    expect(value.disposed).toBe(true)
    expect(value.durableGeneration).toBe(6)
  })

  // ------------------------------------------------------------------
  // (2b) PR #35 follow-up P2: the no-binding ownership scan FAILS CLOSED
  //      on multiple durable claims (never a silent first-wins)
  // ------------------------------------------------------------------

  it('TWO team roots claiming the SAME child session fail closed (TEAM_READ_STATE_OWNERSHIP_CONFLICT — never a first-wins)', () => {
    const world = makeWorld({
      bindings: new Map(),
      teams: new Map([
        [BOOT, { rootSessionId: BOOT, generation: 1 }],
        ['root-a', { rootSessionId: 'root-a', generation: 2 }],
        ['root-b', { rootSessionId: 'root-b', generation: 3 }],
      ]),
      members: new Map([
        ['root-a', [{ rootSessionId: 'root-a', instanceId: 'inst-a', childSessionId: 'child-x', lifecycle: 'RUNNING' }]],
        ['root-b', [{ rootSessionId: 'root-b', instanceId: 'inst-b', childSessionId: 'child-x', lifecycle: 'RUNNING' }]],
      ]),
      faults: {},
    })
    throwsCode(
      () => resolveSessionReadState(world, BOOT, 'child-x'),
      TEAM_READ_STATE_ERROR_CODES.OWNERSHIP_CONFLICT,
    )
  })

  it('TWO member rows UNDER ONE root claiming the SAME child session fail closed (the dedupe is per root, not per claim)', () => {
    const world = makeWorld({
      bindings: new Map(),
      teams: new Map([
        [BOOT, { rootSessionId: BOOT, generation: 1 }],
        ['root-a', { rootSessionId: 'root-a', generation: 2 }],
      ]),
      members: new Map([
        ['root-a', [
          { rootSessionId: 'root-a', instanceId: 'inst-a1', childSessionId: 'child-x', lifecycle: 'RUNNING' },
          { rootSessionId: 'root-a', instanceId: 'inst-a2', childSessionId: 'child-x', lifecycle: 'DISPOSED' },
        ]],
      ]),
      faults: {},
    })
    throwsCode(
      () => resolveSessionReadState(world, BOOT, 'child-x'),
      TEAM_READ_STATE_ERROR_CODES.OWNERSHIP_CONFLICT,
    )
  })

  it('the boot root scanned ONCE: a single claim under the boot root that ALSO appears in the listed rows is NOT a conflict (dedupe boot vs listed root)', () => {
    const world = makeWorld({
      bindings: new Map(),
      // BOOT appears in the listing (as it does in production — the boot
      // root has its own team_sessions row): the scan must count it once.
      teams: new Map([[BOOT, { rootSessionId: BOOT, generation: 4 }]]),
      members: new Map([
        [BOOT, [{ rootSessionId: BOOT, instanceId: 'inst-9', childSessionId: 'child-9', lifecycle: 'RUNNING' }]],
      ]),
      faults: {},
    })
    const value = resolveSessionReadState(world, BOOT, 'child-9')
    expect(value.relation).toBe('team-member')
    expect(value.teamSessionId).toBe(BOOT)
    expect(value.memberInstanceId).toBe('inst-9')
    expect(value.durableGeneration).toBe(4)
  })

  it('a v2 LEADER row under the member listing never matches the scan (no childSessionId) and does not break the clean-scan none', () => {
    const world = makeWorld({
      bindings: new Map(),
      teams: new Map([[BOOT, { rootSessionId: BOOT, generation: 2 }]]),
      members: new Map([
        // The documented type lie: the leader row arrives under the member
        // listing WITHOUT childSessionId / lifecycle cells.
        [BOOT, [{ rootSessionId: BOOT, instanceId: 'inst-leader', lifecycle: 'RUNNING' } as MemberRow]],
      ]),
      faults: {},
    })
    const value = resolveSessionReadState(world, BOOT, 'inst-leader-session')
    expect(value.relation).toBe('none')
  })

  // ------------------------------------------------------------------
  // (3) the COMPLETED clean scan + the fail-closed storage faults
  // ------------------------------------------------------------------

  it('a COMPLETED scan that found no claim is the confirmed none', () => {
    const world = makeWorld({
      bindings: new Map(),
      teams: new Map([[BOOT, { rootSessionId: BOOT, generation: 1 }]]),
      members: new Map([
        [BOOT, [{ rootSessionId: BOOT, instanceId: 'inst-1', childSessionId: 'other-child', lifecycle: 'RUNNING' }]],
      ]),
      faults: {},
    })
    const value = resolveSessionReadState(world, BOOT, 'stranger')
    expect(value.relation).toBe('none')
    expect(value.teamSessionId).toBeNull()
    expect(value.durableGeneration).toBeNull()
  })

  it('a storage failure in the binding READ propagates (fail closed — never a none)', () => {
    const world = makeWorld({
      bindings: new Map(),
      teams: new Map(),
      members: new Map(),
      faults: {
        bindingGet: () => {
          throw new TeamPluginError('RECORD_INVALID', 'corrupt binding row')
        },
      },
    })
    let thrown: unknown
    try {
      resolveSessionReadState(world, BOOT, 'anyone')
    } catch (error) {
      thrown = error
    }
    if (thrown === undefined) throw new Error('expected the storage failure to propagate')
    expectCode(thrown, 'RECORD_INVALID')
  })

  it('a storage failure in the member LISTING mid-scan propagates (an UNFINISHED scan is never a none)', () => {
    const world = makeWorld({
      bindings: new Map(),
      teams: new Map([
        [BOOT, { rootSessionId: BOOT, generation: 1 }],
        ['root-later', { rootSessionId: 'root-later', generation: 2 }],
      ]),
      members: new Map([
        ['root-later', [{ rootSessionId: 'root-later', instanceId: 'inst-1', childSessionId: 'x', lifecycle: 'RUNNING' }]],
      ]),
      faults: {
        memberList: (root) => {
          if (root === 'root-later') throw new TeamPluginError('RECORD_INVALID', 'corrupt member listing')
        },
      },
    })
    throwsCode(
      () => resolveSessionReadState(world, BOOT, 'stranger'),
      'RECORD_INVALID',
    )
  })

  it('a storage failure in the team LISTING propagates (the scan is unfinished)', () => {
    const world = makeWorld({
      bindings: new Map(),
      teams: new Map([[BOOT, { rootSessionId: BOOT, generation: 1 }]]),
      members: new Map(),
      faults: {
        teamList: () => {
          throw new TeamPluginError('RECORD_INVALID', 'corrupt team listing')
        },
      },
    })
    throwsCode(
      () => resolveSessionReadState(world, BOOT, 'stranger'),
      'RECORD_INVALID',
    )
  })
})
