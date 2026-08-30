/**
 * P3-T3 — workspace creation semantics tests (Architecture §21.2, §31).
 *
 * The frozen semantics under test:
 *  - W1: the effective workspace is the instance's explicit workspace, else
 *    the TeamSession's `defaultWorkspace`, else unspecified (undefined);
 *  - W2: the workspace is CREATION-MUTABLE — while the instance has never
 *    entered RUNNING it may be set or cleared (clear reverts to team-default
 *    inheritance); every change is one durable record change
 *    (`activityVersion + 1`, W4);
 *  - W3: the workspace is IMMUTABLE after the first RUNNING — the
 *    §21.2 lock is for-life (it keys on the durable `hasEnteredRunning`
 *    fact, not the current state); a new route means a NEW MemberInstance,
 *    which coexists with the old one;
 *  - the lock is about durable state, not residency (§31: an archived,
 *    never-resident instance still cannot be re-rooted).
 *
 * Pure test: no I/O, no Agent/Session handle.
 * @module domain/test/t3-member-workspace
 */

import { describe, expect, it } from 'vitest'

import { MEMBER_LIFECYCLE_STATES } from '../../contracts/src/index.js'
import {
  createMemberInstance,
  resolveEffectiveWorkspace,
  setWorkspace,
  transitionInstance,
} from '../member/src/index.js'
import type { CreateMemberInstanceInput, MemberInstance } from '../member/src/index.js'
import { LIFECYCLE_OPERATIONS } from '../lifecycle/src/index.js'
import {
  expectContractCode,
  expectMemberCode,
  makeTeamSessionRecord,
  rootSessionId,
  templateId,
} from './t3-helpers.js'

const { CREATED, RUNNING, SETTLED, ARCHIVED, DISPOSED } = MEMBER_LIFECYCLE_STATES

const ROOT = rootSessionId('session-root-p3t3-ws')
const TEMPLATE = templateId('researcher')

const TEAM_WITH_DEFAULT = makeTeamSessionRecord(ROOT, { defaultWorkspace: '/team/default-route' })
const TEAM_WITHOUT_DEFAULT = makeTeamSessionRecord(ROOT)

function input(instSuffix: string, childSession: string, overrides: Partial<CreateMemberInstanceInput> = {}): CreateMemberInstanceInput {
  return {
    rootSessionId: ROOT,
    instanceId: `inst-${instSuffix}`,
    templateId: TEMPLATE,
    label: 'Fourier',
    childSessionId: childSession,
    createdAt: '2026-08-29T12:00:00Z',
    ...overrides,
  }
}

function freshMember(instSuffix: string, childSession: string, workspace: unknown = undefined): MemberInstance {
  return createMemberInstance(input(instSuffix, childSession, workspace === undefined ? {} : { workspace }), [])
}

describe('P3-T3 member: W1 — effective workspace resolution', () => {
  it('explicit workspace wins over the team default', () => {
    const m = freshMember('wsexplicit', 'session-600-1', '/member/own-route')
    expect(resolveEffectiveWorkspace(m.record, TEAM_WITH_DEFAULT)).toBe('/member/own-route')
  })

  it('absent explicit workspace inherits the team default', () => {
    const m = freshMember('wsinherit', 'session-600-2')
    expect(resolveEffectiveWorkspace(m.record, TEAM_WITH_DEFAULT)).toBe('/team/default-route')
    // and the record itself carries no explicit field (inheritance is by absence)
    expect('workspace' in m.record).toBe(false)
  })

  it('neither explicit nor team default → unspecified (undefined)', () => {
    const m = freshMember('wsnone', 'session-600-3')
    expect(resolveEffectiveWorkspace(m.record, TEAM_WITHOUT_DEFAULT)).toBe(undefined)
  })

  it('explicit workspace with no team default → the explicit value', () => {
    const m = freshMember('wsonly', 'session-600-4', '/member/only-route')
    expect(resolveEffectiveWorkspace(m.record, TEAM_WITHOUT_DEFAULT)).toBe('/member/only-route')
  })
})

describe('P3-T3 member: W2/W4 — creation-phase mutation (before first RUNNING)', () => {
  it('setting the workspace produces a NEW frozen instance with activityVersion + 1', () => {
    const m = freshMember('wsmut', 'session-600-5')
    const before = m.record.activityVersion
    const next = setWorkspace(m, '/member/new-route')
    expect(next).not.toBe(m)
    expect(next.record.workspace).toBe('/member/new-route')
    expect(next.record.activityVersion).toBe(before + 1)
    expect(Object.isFrozen(next)).toBe(true)
    expect(Object.isFrozen(next.record)).toBe(true)
    // identity + creation facts preserved; input never mutated
    expect(next.record.instanceId).toBe(m.record.instanceId)
    expect(next.record.rootSessionId).toBe(m.record.rootSessionId)
    expect(next.record.templateId).toBe(m.record.templateId)
    expect(next.record.childSessionId).toBe(m.record.childSessionId)
    expect(next.record.createdAt).toBe(m.record.createdAt)
    expect(next.record.lifecycle).toBe(m.record.lifecycle)
    expect(m.record.workspace).toBe(undefined)
    expect(m.record.activityVersion).toBe(before)
    expect(m.hasEnteredRunning).toBe(false)
    expect(next.hasEnteredRunning).toBe(false)
  })

  it('clearing the explicit workspace reverts the instance to team-default inheritance', () => {
    const m = freshMember('wsclear', 'session-600-6', '/member/old-route')
    expect(resolveEffectiveWorkspace(m.record, TEAM_WITH_DEFAULT)).toBe('/member/old-route')
    const cleared = setWorkspace(m, undefined)
    expect('workspace' in cleared.record).toBe(false)
    expect(resolveEffectiveWorkspace(cleared.record, TEAM_WITH_DEFAULT)).toBe('/team/default-route')
    expect(cleared.record.activityVersion).toBe(m.record.activityVersion + 1)
  })

  it('repeated changes each bump activityVersion by exactly 1 (W4)', () => {
    const m0 = freshMember('wsmulti', 'session-600-7')
    const m1 = setWorkspace(m0, '/a')
    const m2 = setWorkspace(m1, '/b')
    const m3 = setWorkspace(m2, '/a') // re-setting the same value is still one durable change
    const m4 = setWorkspace(m3, undefined)
    expect(m1.record.activityVersion).toBe(m0.record.activityVersion + 1)
    expect(m2.record.activityVersion).toBe(m0.record.activityVersion + 2)
    expect(m3.record.activityVersion).toBe(m0.record.activityVersion + 3)
    expect(m4.record.activityVersion).toBe(m0.record.activityVersion + 4)
    expect(resolveEffectiveWorkspace(m4.record, TEAM_WITH_DEFAULT)).toBe('/team/default-route')
  })

  it('structurally invalid workspace values are rejected with MALFORMED_DTO (even pre-RUNNING)', () => {
    const m = freshMember('wsbad', 'session-600-8')
    expectContractCode(() => setWorkspace(m, ''), 'MALFORMED_DTO')
    expectContractCode(() => setWorkspace(m, 42), 'MALFORMED_DTO')
    expectContractCode(() => setWorkspace(m, null), 'MALFORMED_DTO')
    expectContractCode(() => setWorkspace(m, 'w'.repeat(1025)), 'MALFORMED_DTO')
    expectContractCode(() => setWorkspace(m, '/bad\u0001control'), 'MALFORMED_DTO')
    // the instance is untouched by the rejections
    expect(m.record.activityVersion).toBe(1)
    expect('workspace' in m.record).toBe(false)
  })
})

describe('P3-T3 member: W3 — the §21.2 lock after first RUNNING', () => {
  it('once the instance entered RUNNING, setWorkspace is forbidden for-life', () => {
    const m = freshMember('wslock', 'session-600-9', '/member/route')
    const running = transitionInstance(m, LIFECYCLE_OPERATIONS.ADMIT_WORK)
    expect(running.record.lifecycle).toBe(RUNNING)
    const { code, details } = expectMemberCode(
      () => setWorkspace(running, '/member/other-route'),
      'WORKSPACE_MUTATION_FORBIDDEN',
    )
    expect(code).toBe('WORKSPACE_MUTATION_FORBIDDEN')
    expect(details.instanceId).toBe(running.record.instanceId)
    expect(details.lifecycle).toBe(RUNNING)
    // the instance is untouched
    expect(running.record.workspace).toBe('/member/route')
    expect(running.record.activityVersion).toBe(m.record.activityVersion + 1) // only the transition bumped
  })

  it('the lock holds in SETTLED, across archive/restore, and until DISPOSED (hasEnteredRunning never resets)', () => {
    const m = freshMember('wslock2', 'session-600-10')
    const running = transitionInstance(m, LIFECYCLE_OPERATIONS.ADMIT_WORK)
    const settled = transitionInstance(running, LIFECYCLE_OPERATIONS.SETTLE)
    expectMemberCode(() => setWorkspace(settled, '/x'), 'WORKSPACE_MUTATION_FORBIDDEN')
    expect(settled.record.activityVersion).toBe(m.record.activityVersion + 2)

    const archived = transitionInstance(settled, LIFECYCLE_OPERATIONS.ARCHIVE)
    expect(archived.hasEnteredRunning).toBe(true)
    expectMemberCode(() => setWorkspace(archived, '/x'), 'WORKSPACE_MUTATION_FORBIDDEN')
    // §31: lifecycle != residency — the archived (non-resident) instance is still locked

    const restored = transitionInstance(archived, LIFECYCLE_OPERATIONS.RESTORE)
    expectMemberCode(() => setWorkspace(restored, '/x'), 'WORKSPACE_MUTATION_FORBIDDEN')

    const running2 = transitionInstance(restored, LIFECYCLE_OPERATIONS.ADMIT_WORK)
    expectMemberCode(() => setWorkspace(running2, '/x'), 'WORKSPACE_MUTATION_FORBIDDEN')

    const disposed = transitionInstance(transitionInstance(running2, LIFECYCLE_OPERATIONS.SETTLE), LIFECYCLE_OPERATIONS.DISPOSE)
    expect(disposed.record.lifecycle).toBe(DISPOSED)
    expectMemberCode(() => setWorkspace(disposed, '/x'), 'WORKSPACE_MUTATION_FORBIDDEN')
  })

  it('an instance that never entered RUNNING is still mutable in SETTLED-adjacent states it can actually be in (CREATED only, here)', () => {
    // CREATED is the only non-RUNNING state reachable without entering RUNNING
    const m = freshMember('wsnever', 'session-600-11')
    expect(m.hasEnteredRunning).toBe(false)
    const next = setWorkspace(m, '/member/late-but-still-creation')
    expect(next.record.workspace).toBe('/member/late-but-still-creation')
  })

  it('a new route means a NEW instance: it coexists with the locked one, which stays untouched (§21.2)', () => {
    const old = freshMember('wsold', 'session-600-12', '/member/old-route')
    const oldRunning = transitionInstance(old, LIFECYCLE_OPERATIONS.ADMIT_WORK)
    // the locked instance cannot be re-rooted…
    expectMemberCode(() => setWorkspace(oldRunning, '/member/new-route'), 'WORKSPACE_MUTATION_FORBIDDEN')
    // …but a new instance of the same template carries the new route
    const young = createMemberInstance(
      input('wsyoung', 'session-600-13', { workspace: '/member/new-route' }),
      [oldRunning.record],
    )
    expect(young.record.instanceId).not.toBe(oldRunning.record.instanceId)
    expect(young.record.templateId).toBe(oldRunning.record.templateId)
    expect(resolveEffectiveWorkspace(young.record, TEAM_WITH_DEFAULT)).toBe('/member/new-route')
    expect(resolveEffectiveWorkspace(oldRunning.record, TEAM_WITH_DEFAULT)).toBe('/member/old-route')
    expect(oldRunning.record.activityVersion).toBe(old.record.activityVersion + 1)
  })
})

describe('P3-T3 member: workspace creation input validation', () => {
  it('a valid explicit workspace is frozen onto the creation record', () => {
    const m = createMemberInstance(input('wscreate', 'session-600-14', { workspace: '/member/created-route' }), [])
    expect(m.record.workspace).toBe('/member/created-route')
    expect(m.record.activityVersion).toBe(1)
    expect(m.record.lifecycle).toBe(CREATED)
  })

  it('the creation record carries no workspace when the input omitted it', () => {
    const m = createMemberInstance(input('wscreate2', 'session-600-15'), [])
    expect('workspace' in m.record).toBe(false)
  })
})
