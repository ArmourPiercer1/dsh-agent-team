/**
 * P3-T3 — contextPolicy + delegation resolution tests
 * (Architecture §11.2/§11.3, §17, §21.6, §24.1).
 *
 * TaskDoc §11.4 P3-T3 required: "fresh_per_delegation semantic tests".
 *
 * The frozen semantics under test:
 *  - `fresh_per_delegation` is an INSTANCE-CREATION strategy: every new
 *    delegation to the template creates a new MemberInstance with a new
 *    child Session and independent context — it is NEVER a context reset of
 *    an existing instance (§11.3, §41.4);
 *  - an EXPLICIT instance address always continues that instance, under
 *    either policy (§11.3, §24.1 — instance-first addressing);
 *  - `persistent` (default): template-level work continues the unique
 *    work-accepting instance of the template in the team; creates when none;
 *    refuses — without inventing a selection rule — when several are
 *    work-accepting (invariant 19);
 *  - contextPolicy is frozen at creation (§21.6) and survives every
 *    lifecycle transition.
 *
 * Pure test: no I/O, no Agent/Session handle.
 * @module domain/test/t3-member-context-policy
 */

import { describe, expect, it } from 'vitest'

import { MEMBER_LIFECYCLE_STATES } from '../../contracts/src/index.js'
import type { MemberInstanceRecordDto } from '../../contracts/src/index.js'
import {
  CONTEXT_POLICY_VALUES,
  CONTEXT_POLICIES,
  DEFAULT_CONTEXT_POLICY,
  WORK_ACCEPTING_STATES,
  createMemberInstance,
  isContextPolicy,
  isMemberDomainError,
  resolveDelegationTarget,
  transitionInstance,
} from '../member/src/index.js'
import type {
  CreateMemberInstanceInput,
  MemberInstance,
} from '../member/src/index.js'
import { LIFECYCLE_OPERATIONS, isLifecycleTransitionError } from '../lifecycle/src/index.js'
import {
  capture,
  expectContractCode,
  expectMemberCode,
  expectThrows,
  instanceId,
  makeMemberRecord,
  rootSessionId,
  templateId,
} from './t3-helpers.js'

const { CREATED, RUNNING, SETTLED, ARCHIVED, DISPOSED } = MEMBER_LIFECYCLE_STATES

const ROOT = rootSessionId('session-root-p3t3-ctx')
const ROOT_OTHER = rootSessionId('session-root-p3t3-ctx-other')
const TEMPLATE = templateId('researcher')

const INST_A = instanceId('inst-ctxa')
const INST_B = instanceId('inst-ctxb')
const INST_C = instanceId('inst-ctxc')
const INST_D = instanceId('inst-ctxd')

type State = (typeof MEMBER_LIFECYCLE_STATES)[keyof typeof MEMBER_LIFECYCLE_STATES]

/** Fixture record with an explicit lifecycle (and optionally team/template). */
function record(
  inst: typeof INST_A,
  lifecycle: State,
  root: typeof ROOT = ROOT,
  templateIdOverride: string | undefined = undefined,
): MemberInstanceRecordDto {
  return makeMemberRecord(root, inst, { lifecycle, templateId: templateIdOverride })
}

function freshInput(inst: typeof INST_A, contextPolicy: unknown, childSession: string): CreateMemberInstanceInput {
  return {
    rootSessionId: ROOT,
    instanceId: inst,
    templateId: TEMPLATE,
    label: 'Fourier',
    childSessionId: childSession,
    contextPolicy,
    createdAt: '2026-08-29T12:00:00Z',
  }
}

describe('P3-T3 member: contextPolicy vocabulary (§11.2/§21.6)', () => {
  it('the frozen vocabulary is exactly {persistent, fresh_per_delegation}', () => {
    expect(CONTEXT_POLICIES.PERSISTENT).toBe('persistent')
    expect(CONTEXT_POLICIES.FRESH_PER_DELEGATION).toBe('fresh_per_delegation')
    expect(CONTEXT_POLICY_VALUES).toEqual(['persistent', 'fresh_per_delegation'])
  })

  it('persistent is the default (§11.2)', () => {
    expect(DEFAULT_CONTEXT_POLICY).toBe('persistent')
  })

  it('isContextPolicy accepts exactly the two vocabulary values', () => {
    expect(isContextPolicy('persistent')).toBe(true)
    expect(isContextPolicy('fresh_per_delegation')).toBe(true)
    for (const bad of ['reset_context', 'Persistent', 'PERSISTENT', '', 'fresh', 'fresh_per_delegation ', 42, null, undefined, {}]) {
      expect(isContextPolicy(bad)).toBe(false)
    }
  })

  it('work-accepting states are exactly CREATED, RUNNING, SETTLED (M5)', () => {
    expect(WORK_ACCEPTING_STATES).toEqual([CREATED, RUNNING, SETTLED])
  })
})

describe('P3-T3 member: fresh_per_delegation is instance CREATION, never a context reset (§11.3, §41.4)', () => {
  it('delegation #1 and #2 to the template each CREATE a new instance; an explicit follow-up continues', () => {
    const members: MemberInstanceRecordDto[] = []

    // delegation 1: no instances exist → create (fresh strategy)
    const target1 = resolveDelegationTarget(ROOT, CONTEXT_POLICIES.FRESH_PER_DELEGATION, { templateId: TEMPLATE }, members)
    expect(target1).toEqual({ kind: 'create', reason: 'fresh_per_delegation', contextPolicy: 'fresh_per_delegation' })

    // the ActivationProvider (§17) commits instance A
    const a = createMemberInstance(freshInput(INST_A, CONTEXT_POLICIES.FRESH_PER_DELEGATION, 'session-500-a'), members)
    members.push(a.record)

    // delegation 2: A exists and is work-accepting, but fresh_per_delegation
    // ALWAYS creates a new instance (§41.4: "NEW delegation → inst-B")
    const target2 = resolveDelegationTarget(ROOT, CONTEXT_POLICIES.FRESH_PER_DELEGATION, { templateId: TEMPLATE }, members)
    expect(target2).toEqual({ kind: 'create', reason: 'fresh_per_delegation', contextPolicy: 'fresh_per_delegation' })

    const b = createMemberInstance(freshInput(INST_B, CONTEXT_POLICIES.FRESH_PER_DELEGATION, 'session-500-b'), members)
    members.push(b.record)

    // two fresh instances coexist: independent context, distinct child sessions
    expect(members.filter((m) => m.instanceId === INST_A).length).toBe(1)
    expect(members.filter((m) => m.instanceId === INST_B).length).toBe(1)
    expect(a.record.childSessionId).not.toBe(b.record.childSessionId)

    // explicit follow-up to A (under the fresh policy) CONTINUES A —
    // the explicit address is not a new delegation (§11.3, §24.1)
    const target3 = resolveDelegationTarget(ROOT, CONTEXT_POLICIES.FRESH_PER_DELEGATION, { explicitInstanceId: INST_A }, members)
    expect(target3).toEqual({ kind: 'continue', instanceId: INST_A })

    // even with A running, a template-level delegation creates yet another
    const membersWithARunning: MemberInstanceRecordDto[] = [
      record(INST_A, RUNNING),
      b.record,
    ]
    const target4 = resolveDelegationTarget(ROOT, CONTEXT_POLICIES.FRESH_PER_DELEGATION, { templateId: TEMPLATE }, membersWithARunning)
    expect(target4).toEqual({ kind: 'create', reason: 'fresh_per_delegation', contextPolicy: 'fresh_per_delegation' })
  })
})

describe('P3-T3 member: persistent template delegation (M3/M4/M5)', () => {
  it('no work-accepting instance → create with reason no_active_instance', () => {
    const none: MemberInstanceRecordDto[] = []
    expect(resolveDelegationTarget(ROOT, CONTEXT_POLICIES.PERSISTENT, { templateId: TEMPLATE }, none)).toEqual({
      kind: 'create',
      reason: 'no_active_instance',
      contextPolicy: 'persistent',
    })
  })

  it('exactly one work-accepting instance → continue it, in any of the three work-accepting states', () => {
    for (const lifecycle of [CREATED, RUNNING, SETTLED]) {
      const members = [record(INST_A, lifecycle)]
      expect(resolveDelegationTarget(ROOT, CONTEXT_POLICIES.PERSISTENT, { templateId: TEMPLATE }, members)).toEqual({
        kind: 'continue',
        instanceId: INST_A,
      })
    }
  })

  it('two work-accepting instances → DELEGATION_TARGET_AMBIGUOUS with the exact candidates (no selection rule invented)', () => {
    const members = [record(INST_A, CREATED), record(INST_B, RUNNING)]
    const { code, details } = expectMemberCode(
      () => resolveDelegationTarget(ROOT, CONTEXT_POLICIES.PERSISTENT, { templateId: TEMPLATE }, members),
      'DELEGATION_TARGET_AMBIGUOUS',
    )
    expect(code).toBe('DELEGATION_TARGET_AMBIGUOUS')
    expect(details.candidateInstanceIds).toEqual([INST_A, INST_B])
    expect(details.templateId).toBe(TEMPLATE)
  })

  it('DISPOSED / ARCHIVED instances are not work-accepting and do not create ambiguity', () => {
    const activePlusDisposed = [record(INST_A, RUNNING), record(INST_B, DISPOSED)]
    expect(resolveDelegationTarget(ROOT, CONTEXT_POLICIES.PERSISTENT, { templateId: TEMPLATE }, activePlusDisposed)).toEqual({
      kind: 'continue',
      instanceId: INST_A,
    })
    const activePlusArchived = [record(INST_A, SETTLED), record(INST_B, ARCHIVED)]
    expect(resolveDelegationTarget(ROOT, CONTEXT_POLICIES.PERSISTENT, { templateId: TEMPLATE }, activePlusArchived)).toEqual({
      kind: 'continue',
      instanceId: INST_A,
    })
    // only non-work-accepting instances exist → create
    const noneActive = [record(INST_A, ARCHIVED), record(INST_B, DISPOSED)]
    expect(resolveDelegationTarget(ROOT, CONTEXT_POLICIES.PERSISTENT, { templateId: TEMPLATE }, noneActive)).toEqual({
      kind: 'create',
      reason: 'no_active_instance',
      contextPolicy: 'persistent',
    })
  })

  it('other templates and other teams do not count toward resolution (invariant 18 scoping)', () => {
    const otherTemplate = [record(INST_A, RUNNING, ROOT, 'writer')]
    expect(resolveDelegationTarget(ROOT, CONTEXT_POLICIES.PERSISTENT, { templateId: TEMPLATE }, otherTemplate)).toEqual({
      kind: 'create',
      reason: 'no_active_instance',
      contextPolicy: 'persistent',
    })
    const otherTeam = [record(INST_A, RUNNING, ROOT_OTHER)]
    expect(resolveDelegationTarget(ROOT, CONTEXT_POLICIES.PERSISTENT, { templateId: TEMPLATE }, otherTeam)).toEqual({
      kind: 'create',
      reason: 'no_active_instance',
      contextPolicy: 'persistent',
    })
  })
})

describe('P3-T3 member: explicit (instance-first) addressing (M1/M2, §24.1)', () => {
  it('an unknown explicit address is a contract roster-lookup failure (MEMBER_NOT_FOUND)', () => {
    const members = [record(INST_A, CREATED)]
    expectContractCode(
      () =>
        resolveDelegationTarget(ROOT, CONTEXT_POLICIES.PERSISTENT, { explicitInstanceId: instanceId('inst-ghost') }, members),
      'MEMBER_NOT_FOUND',
    )
  })

  it('an explicit address to a DISPOSED instance is rejected (DELEGATION_TARGET_DISPOSED, §29.5)', () => {
    const members = [record(INST_A, DISPOSED)]
    const { code, details } = expectMemberCode(
      () => resolveDelegationTarget(ROOT, CONTEXT_POLICIES.PERSISTENT, { explicitInstanceId: INST_A }, members),
      'DELEGATION_TARGET_DISPOSED',
    )
    expect(code).toBe('DELEGATION_TARGET_DISPOSED')
    expect(details.instanceId).toBe(INST_A)
    expect(details.lifecycle).toBe(DISPOSED)
  })

  it('an explicit address to an ARCHIVED instance continues it (the caller Restores first, §30.2)', () => {
    const members = [record(INST_A, ARCHIVED)]
    expect(resolveDelegationTarget(ROOT, CONTEXT_POLICIES.PERSISTENT, { explicitInstanceId: INST_A }, members)).toEqual({
      kind: 'continue',
      instanceId: INST_A,
    })
    // and after the Restore the instance is work-accepting again
    const restored = [record(INST_A, SETTLED)]
    expect(resolveDelegationTarget(ROOT, CONTEXT_POLICIES.PERSISTENT, { explicitInstanceId: INST_A }, restored)).toEqual({
      kind: 'continue',
      instanceId: INST_A,
    })
  })

  it('the explicit address resolves by identity alone — even under fresh_per_delegation', () => {
    const members = [record(INST_A, RUNNING)]
    expect(
      resolveDelegationTarget(ROOT, CONTEXT_POLICIES.FRESH_PER_DELEGATION, { explicitInstanceId: INST_A }, members),
    ).toEqual({ kind: 'continue', instanceId: INST_A })
  })

  it('M1: the request shape is exactly one of the two addressing forms', () => {
    const members = [record(INST_A, CREATED)]
    // both forms at once
    const both = capture(() =>
      resolveDelegationTarget(ROOT, CONTEXT_POLICIES.PERSISTENT, { explicitInstanceId: INST_A, templateId: TEMPLATE }, members),
    )
    expect(isMemberDomainError(both)).toBe(true)
    expect((both as { code: string }).code).toBe('DELEGATION_TARGET_INVALID')
    // neither form
    const neither = capture(() => resolveDelegationTarget(ROOT, CONTEXT_POLICIES.PERSISTENT, {}, members))
    expect(isMemberDomainError(neither)).toBe(true)
    expect((neither as { code: string }).code).toBe('DELEGATION_TARGET_INVALID')
  })
})

describe('P3-T3 member: contextPolicy is immutable across the full lifecycle path (§21.6)', () => {
  it('the frozen policy survives CREATED→RUNNING→SETTLED→ARCHIVED→SETTLED→RUNNING→SETTLED→DISPOSED', () => {
    const inst = createMemberInstance(freshInput(INST_C, CONTEXT_POLICIES.FRESH_PER_DELEGATION, 'session-500-c'), [])
    expect(inst.contextPolicy).toBe('fresh_per_delegation')
    let cur: MemberInstance = inst
    for (const op of [
      LIFECYCLE_OPERATIONS.ADMIT_WORK,
      LIFECYCLE_OPERATIONS.SETTLE,
      LIFECYCLE_OPERATIONS.ARCHIVE,
      LIFECYCLE_OPERATIONS.RESTORE,
      LIFECYCLE_OPERATIONS.ADMIT_WORK,
      LIFECYCLE_OPERATIONS.SETTLE,
      LIFECYCLE_OPERATIONS.DISPOSE,
    ]) {
      cur = transitionInstance(cur, op)
      expect(cur.contextPolicy).toBe('fresh_per_delegation')
    }
    expect(cur.record.lifecycle).toBe(DISPOSED)
  })

  it('a persistent instance defaults to the policy and keeps it (including after a rejected transition)', () => {
    const inst = createMemberInstance(freshInput(INST_D, undefined, 'session-500-d'), [])
    expect(inst.contextPolicy).toBe(DEFAULT_CONTEXT_POLICY)
    // ARCHIVE from CREATED is rejected — nothing changes, policy included
    const threw = expectThrows(
      () => transitionInstance(inst, LIFECYCLE_OPERATIONS.ARCHIVE),
      isLifecycleTransitionError,
      'ARCHIVE from CREATED',
    )
    expect((threw as { code: string }).code).toBe('LIFECYCLE_ILLEGAL_TRANSITION')
    expect(inst.contextPolicy).toBe('persistent')
    expect(inst.record.lifecycle).toBe(CREATED)
    // …and a committed path keeps it too
    const settled = transitionInstance(transitionInstance(inst, LIFECYCLE_OPERATIONS.ADMIT_WORK), LIFECYCLE_OPERATIONS.SETTLE)
    expect(settled.contextPolicy).toBe('persistent')
    expect(settled.hasEnteredRunning).toBe(true)
  })
})
