/**
 * P3-T6 (G3-7) — fresh_per_delegation is an instance-CREATION policy:
 * cross-module property evidence.
 *
 * The frozen Architecture reads `fresh_per_delegation` as "a new delegation
 * to the template creates a NEW MemberInstance with a new child Session"
 * (§11.3, §41.4) — it is NOT a context reset on an existing instance, and an
 * explicitly addressed instance is always continued under either policy
 * (§11.3/§24.1, invariant 18). This file property-tests that reading across
 * the blueprint → member → lifecycle module boundary, and contrasts it with
 * the `persistent` default.
 *
 * Authority: Architecture §11.2 (persistent default), §11.3/§41.4
 * (fresh_per_delegation), §21.6 (contextPolicy frozen at creation), §24.1
 * (instance-first addressing), §29.5 (DISPOSED never accepts new work);
 * Development Plan §16.4 G3-7.
 */

import { describe, expect, it } from 'vitest'

import {
  createMemberIdentity,
  createMemberInstanceRecord,
  parseChildSessionId,
  parseInstanceId,
} from '../../contracts/src/index.js'
import type {
  InstanceId,
  MemberInstanceRecordDto,
  RootSessionId,
  TemplateId,
} from '../../contracts/src/index.js'
import { parseBlueprint } from '../../domain/blueprint/src/index.js'
import {
  CONTEXT_POLICIES,
  DEFAULT_CONTEXT_POLICY,
  createMemberInstance,
  instancesForTemplate,
  resolveDelegationTarget,
  transitionInstance,
} from '../../domain/member/src/index.js'
import {
  LIFECYCLE_OPERATIONS,
  applyLifecycleOperation,
} from '../../domain/lifecycle/src/index.js'
import type { LifecycleOperation } from '../../domain/lifecycle/src/index.js'
import {
  T6_CREATED_AT,
  T6_DEFAULT_LABEL,
  T6_DEFAULT_TEMPLATE_ID,
  T6_ROOT_SESSION_ID,
  t6ChildSessionIdAt,
  t6InstanceIdAt,
} from '../domain/src/index.js'
import { expectSingleFamily } from './t6-helpers.js'

/**
 * A blueprint whose member template declares `contextPolicy:
 * fresh_per_delegation` (invariant 29: frozen at instance creation).
 */
const T6_FRESH_BLUEPRINT_SOURCE: string = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.t6-fresh',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "Lead."',
  'members:',
  '  - templateId: researcher',
  '    persona: "Researcher."',
  '    contextPolicy: fresh_per_delegation',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

/** The five durable lifecycle states, used to vary the roster. */
const STATE_SCRIPTS: readonly (readonly LifecycleOperation[])[] = [
  [], // CREATED
  [LIFECYCLE_OPERATIONS.ADMIT_WORK], // RUNNING
  [LIFECYCLE_OPERATIONS.ADMIT_WORK, LIFECYCLE_OPERATIONS.SETTLE], // SETTLED
  [LIFECYCLE_OPERATIONS.ADMIT_WORK, LIFECYCLE_OPERATIONS.SETTLE, LIFECYCLE_OPERATIONS.ARCHIVE], // ARCHIVED
  [LIFECYCLE_OPERATIONS.ADMIT_WORK, LIFECYCLE_OPERATIONS.SETTLE, LIFECYCLE_OPERATIONS.DISPOSE], // DISPOSED
]

/** Create a durable member record of `templateId` at `index` and drive it to `stateIndex`. */
function recordInState(
  rootSessionId: RootSessionId,
  index: number,
  templateId: TemplateId,
  stateIndex: number,
): MemberInstanceRecordDto {
  const script = STATE_SCRIPTS[stateIndex]
  if (script === undefined) throw new Error(`unknown state index ${stateIndex}`)
  let record = createMemberInstanceRecord({
    rootSessionId,
    instanceId: parseInstanceId(t6InstanceIdAt(index)),
    templateId,
    label: T6_DEFAULT_LABEL,
    childSessionId: parseChildSessionId(t6ChildSessionIdAt(index)),
    lifecycle: 'CREATED',
    createdAt: T6_CREATED_AT,
    activityVersion: 1,
  })
  for (const operation of script) {
    record = applyLifecycleOperation(record, operation)
  }
  return record
}

describe('P3-T6 G3-7 fresh_per_delegation = new-instance policy (cross-module)', () => {
  it('the fresh blueprint source declares the member contextPolicy and parse preserves it', () => {
    const bp = parseBlueprint(T6_FRESH_BLUEPRINT_SOURCE)
    const member = bp.members.find((entry) => entry.templateId === 'researcher')
    if (member === undefined) throw new Error('researcher member template missing from parsed blueprint')
    expect(member.contextPolicy).toBe('fresh_per_delegation')
    expect(member.contextPolicy).toBe(CONTEXT_POLICIES.FRESH_PER_DELEGATION)
    expect(bp.blueprintId).toBe('team.t6-fresh')
  })

  it('property: a fresh_per_delegation template ALWAYS resolves create/fresh_per_delegation, for any roster size and state mix', () => {
    const counts = [0, 1, 2, 3, 5, 8]
    for (const count of counts) {
      const members: MemberInstanceRecordDto[] = []
      for (let i = 1; i <= count; i++) {
        members.push(recordInState(T6_ROOT_SESSION_ID, i, T6_DEFAULT_TEMPLATE_ID, (i - 1) % 5))
      }
      const target = resolveDelegationTarget(
        T6_ROOT_SESSION_ID,
        CONTEXT_POLICIES.FRESH_PER_DELEGATION,
        { templateId: T6_DEFAULT_TEMPLATE_ID },
        members,
      )
      expect(target).toEqual({
        kind: 'create',
        reason: 'fresh_per_delegation',
        contextPolicy: 'fresh_per_delegation',
      })
    }
  })

  it('contrast: persistent continues the unique work-accepting instance, creates when none, and refuses when several', () => {
    const oneActive = [recordInState(T6_ROOT_SESSION_ID, 1, T6_DEFAULT_TEMPLATE_ID, 1)] // RUNNING
    expect(
      resolveDelegationTarget(T6_ROOT_SESSION_ID, DEFAULT_CONTEXT_POLICY, { templateId: T6_DEFAULT_TEMPLATE_ID }, oneActive),
    ).toEqual({ kind: 'continue', instanceId: 'inst-m01' })

    const noneActive = [
      recordInState(T6_ROOT_SESSION_ID, 1, T6_DEFAULT_TEMPLATE_ID, 3), // ARCHIVED
      recordInState(T6_ROOT_SESSION_ID, 2, T6_DEFAULT_TEMPLATE_ID, 4), // DISPOSED
    ]
    expect(
      resolveDelegationTarget(T6_ROOT_SESSION_ID, DEFAULT_CONTEXT_POLICY, { templateId: T6_DEFAULT_TEMPLATE_ID }, noneActive),
    ).toEqual({ kind: 'create', reason: 'no_active_instance', contextPolicy: 'persistent' })

    const twoActive = [
      recordInState(T6_ROOT_SESSION_ID, 1, T6_DEFAULT_TEMPLATE_ID, 0), // CREATED
      recordInState(T6_ROOT_SESSION_ID, 2, T6_DEFAULT_TEMPLATE_ID, 1), // RUNNING
    ]
    expectSingleFamily(
      () =>
        resolveDelegationTarget(T6_ROOT_SESSION_ID, DEFAULT_CONTEXT_POLICY, { templateId: T6_DEFAULT_TEMPLATE_ID }, twoActive),
      'member',
      'DELEGATION_TARGET_AMBIGUOUS',
    )
  })

  it('explicit addressing always continues the addressed instance, even under the fresh policy (ARCHIVED resolves to itself)', () => {
    const members = [
      recordInState(T6_ROOT_SESSION_ID, 1, T6_DEFAULT_TEMPLATE_ID, 0), // CREATED
      recordInState(T6_ROOT_SESSION_ID, 2, T6_DEFAULT_TEMPLATE_ID, 3), // ARCHIVED
    ]
    const first = resolveDelegationTarget(
      T6_ROOT_SESSION_ID,
      CONTEXT_POLICIES.FRESH_PER_DELEGATION,
      { explicitInstanceId: parseInstanceId('inst-m01') },
      members,
    )
    expect(first).toEqual({ kind: 'continue', instanceId: 'inst-m01' })
    const archived = resolveDelegationTarget(
      T6_ROOT_SESSION_ID,
      CONTEXT_POLICIES.FRESH_PER_DELEGATION,
      { explicitInstanceId: parseInstanceId('inst-m02') },
      members,
    )
    expect(archived).toEqual({ kind: 'continue', instanceId: 'inst-m02' })
  })

  it('delegation loop: 3 sequential delegations to the fresh template yield 3 distinct instances carrying the frozen policy', () => {
    let members: MemberInstanceRecordDto[] = []
    const createdPolicies: string[] = []
    const instanceIds: InstanceId[] = []
    for (let i = 1; i <= 3; i++) {
      const target = resolveDelegationTarget(
        T6_ROOT_SESSION_ID,
        CONTEXT_POLICIES.FRESH_PER_DELEGATION,
        { templateId: T6_DEFAULT_TEMPLATE_ID },
        members,
      )
      if (target.kind !== 'create' || target.reason !== 'fresh_per_delegation') {
        throw new Error(`delegation ${i}: expected create/fresh_per_delegation, got ${target.kind}`)
      }
      const instance = createMemberInstance(
        {
          rootSessionId: T6_ROOT_SESSION_ID,
          instanceId: parseInstanceId(t6InstanceIdAt(i)),
          templateId: T6_DEFAULT_TEMPLATE_ID,
          label: T6_DEFAULT_LABEL,
          childSessionId: parseChildSessionId(t6ChildSessionIdAt(i)),
          contextPolicy: target.contextPolicy,
          createdAt: T6_CREATED_AT,
        },
        members,
      )
      members = [...members, instance.record]
      createdPolicies.push(instance.contextPolicy)
      instanceIds.push(instance.record.instanceId)
    }
    expect(new Set(instanceIds).size).toBe(3)
    for (const policy of createdPolicies) {
      expect(policy).toBe('fresh_per_delegation')
    }
    expect(instancesForTemplate(members, T6_ROOT_SESSION_ID, T6_DEFAULT_TEMPLATE_ID).length).toBe(3)
    // Each created identity is a valid (rootSessionId, instanceId) pair (invariant 18).
    for (const instanceId of instanceIds) {
      const identity = createMemberIdentity(T6_ROOT_SESSION_ID, instanceId)
      expect(identity.instanceId).toBe(instanceId)
    }
  })

  it('contextPolicy is frozen at creation and survives every lifecycle transition (I3); the default is persistent', () => {
    const fresh = createMemberInstance(
      {
        rootSessionId: T6_ROOT_SESSION_ID,
        instanceId: parseInstanceId('inst-m01'),
        templateId: T6_DEFAULT_TEMPLATE_ID,
        label: T6_DEFAULT_LABEL,
        childSessionId: parseChildSessionId('session-child-1-01'),
        contextPolicy: CONTEXT_POLICIES.FRESH_PER_DELEGATION,
        createdAt: T6_CREATED_AT,
      },
      [],
    )
    expect(fresh.record.lifecycle).toBe('CREATED')
    const running = transitionInstance(fresh, LIFECYCLE_OPERATIONS.ADMIT_WORK)
    expect(running.contextPolicy).toBe('fresh_per_delegation')
    expect(running.hasEnteredRunning).toBe(true)
    const settled = transitionInstance(running, LIFECYCLE_OPERATIONS.SETTLE)
    expect(settled.contextPolicy).toBe('fresh_per_delegation')
    expect(settled.record.lifecycle).toBe('SETTLED')
    // The original is untouched (transitions return new frozen objects).
    expect(fresh.record.lifecycle).toBe('CREATED')
    // Contrast: omitting the policy freezes the persistent default (§11.2).
    const defaulted = createMemberInstance(
      {
        rootSessionId: T6_ROOT_SESSION_ID,
        instanceId: parseInstanceId('inst-m02'),
        templateId: T6_DEFAULT_TEMPLATE_ID,
        label: T6_DEFAULT_LABEL,
        childSessionId: parseChildSessionId('session-child-1-02'),
        createdAt: T6_CREATED_AT,
      },
      [fresh.record],
    )
    expect(defaulted.contextPolicy).toBe(DEFAULT_CONTEXT_POLICY)
    expect(defaulted.contextPolicy).toBe('persistent')
  })
})
