/**
 * P3-T3 — Template → N Instance tests (Architecture §10, invariant 17).
 *
 * TaskDoc §11.4 P3-T3 acceptance: "same template yields N instances".
 *
 * Covers roster rules R1–R4:
 *  - R1 creation mints a durable record in state CREATED with
 *    `activityVersion = 1` and `hasEnteredRunning = false`;
 *  - R2 runtime identity is the composite (rootSessionId, instanceId)
 *    (invariant 18): the same template — even with the same label — yields
 *    any number of distinct MemberInstances in one TeamSession;
 *  - R3/R4 the v1 DTO carries no contextPolicy / first-RUNNING facts, so the
 *    domain wrapper freezes them at creation (persistent default, §11.2).
 *
 * Also: team-scoped instanceId uniqueness (DUPLICATE_INSTANCE_ID), global
 * child-session uniqueness (SESSION_ALREADY_BOUND, invariant 23), the
 * reserved leader id (INSTANCE_ID_RESERVED), contract validation pass-through,
 * and the absence of any per-template cap (quota is a separate concern,
 * Architecture §32 — deliberately NOT enforced here).
 *
 * Pure test: no I/O, no Agent/Session handle.
 * @module domain/test/t3-member-n-instances
 */

import { describe, expect, it } from 'vitest'

import { MEMBER_LIFECYCLE_STATES } from '../../contracts/src/index.js'
import type { MemberInstanceRecordDto } from '../../contracts/src/index.js'
import {
  CONTEXT_POLICIES,
  createMemberInstance,
  findMemberRecord,
  instanceCountForTemplate,
  instancesForTemplate,
} from '../member/src/index.js'
import type { CreateMemberInstanceInput, MemberInstance } from '../member/src/index.js'
import {
  expectContractCode,
  expectMemberCode,
  rootSessionId,
  templateId,
} from './t3-helpers.js'

const ROOT_A = 'session-root-p3t3-ninst-a'
const ROOT_B = 'session-root-p3t3-ninst-b'

const TEMPLATE = 'researcher'
const LABEL = 'Fourier'
const CREATED_AT = '2026-08-29T12:00:00Z'

function inputFor(root: string, i: number, overrides: Partial<CreateMemberInstanceInput> = {}): CreateMemberInstanceInput {
  return {
    rootSessionId: root,
    instanceId: `inst-a${i}`,
    templateId: TEMPLATE,
    label: LABEL,
    childSessionId: `session-300-${i}`,
    createdAt: CREATED_AT,
    ...overrides,
  }
}

describe('P3-T3 member: same template yields N instances (acceptance)', () => {
  it('50 distinct instances of one template coexist in one TeamSession (no per-template cap)', () => {
    const existing: MemberInstanceRecordDto[] = []
    const members: MemberInstance[] = []
    for (let i = 0; i < 50; i += 1) {
      const created = createMemberInstance(inputFor(ROOT_A, i), existing)
      existing.push(created.record)
      members.push(created)
    }
    // all 50 are distinct members of the one team under the one template
    const rootA = rootSessionId(ROOT_A)
    const template = templateId(TEMPLATE)
    expect(instanceCountForTemplate(existing, rootA, template)).toBe(50)
    const ofTemplate = instancesForTemplate(existing, rootA, template)
    expect(ofTemplate.length).toBe(50)
    const seenIds = new Set<string>()
    for (const m of ofTemplate) {
      expect(m.rootSessionId).toBe(rootA)
      expect(m.templateId).toBe(template)
      expect(seenIds.has(m.instanceId)).toBe(false)
      seenIds.add(m.instanceId)
    }
    expect(seenIds.size).toBe(50)
    // every one of them is a fresh, never-run CREATED instance (R1)
    for (const m of members) {
      expect(m.record.lifecycle).toBe(MEMBER_LIFECYCLE_STATES.CREATED)
      expect(m.record.activityVersion).toBe(1)
      expect(m.hasEnteredRunning).toBe(false)
      expect(m.record.label).toBe(LABEL)
    }
    // 50 already exist and a 51st is still allowed: 0..N, no cap here
    const fiftyOne = createMemberInstance(inputFor(ROOT_A, 50), existing)
    expect(fiftyOne.record.instanceId).toBe('inst-a50')
    expect(instanceCountForTemplate([...existing, fiftyOne.record], rootA, template)).toBe(51)
  })
})

describe('P3-T3 member: instance creation invariants (R1–R4)', () => {
  it('R1: creation mints CREATED with activityVersion 1, hasEnteredRunning false', () => {
    const created = createMemberInstance(inputFor(ROOT_A, 0), [])
    expect(created.record.lifecycle).toBe(MEMBER_LIFECYCLE_STATES.CREATED)
    expect(created.record.activityVersion).toBe(1)
    expect(created.hasEnteredRunning).toBe(false)
    expect(created.record.schemaVersion).toBe(1)
    expect(Object.isFrozen(created)).toBe(true)
    expect(Object.isFrozen(created.record)).toBe(true)
  })

  it('R2: same template + same label → distinct instances, identity is (root, instanceId)', () => {
    const existing: MemberInstanceRecordDto[] = []
    const a = createMemberInstance(inputFor(ROOT_A, 0), existing)
    existing.push(a.record)
    const b = createMemberInstance(inputFor(ROOT_A, 1), existing)
    existing.push(b.record)
    // same template, same label, same team — two different members
    expect(b.record.templateId).toBe(a.record.templateId)
    expect(b.record.label).toBe(a.record.label)
    expect(b.record.rootSessionId).toBe(a.record.rootSessionId)
    expect(b.record.instanceId).not.toBe(a.record.instanceId)
    expect(b.record.childSessionId).not.toBe(a.record.childSessionId)
    // §24.1 instance-first addressing finds each by its identity alone
    expect(findMemberRecord(existing, a.record.rootSessionId, a.record.instanceId)?.instanceId).toBe(a.record.instanceId)
    expect(findMemberRecord(existing, a.record.rootSessionId, b.record.instanceId)?.instanceId).toBe(b.record.instanceId)
    expect(findMemberRecord(existing, a.record.rootSessionId, b.record.instanceId)).not.toBe(
      findMemberRecord(existing, a.record.rootSessionId, a.record.instanceId),
    )
  })

  it('the same instanceId under two different teams is two different members (invariant 18)', () => {
    const existing: MemberInstanceRecordDto[] = []
    const inA = createMemberInstance(
      inputFor(ROOT_A, 7, { instanceId: 'inst-shared', childSessionId: 'session-400-shared-a' }),
      existing,
    )
    existing.push(inA.record)
    const inB = createMemberInstance(
      inputFor(ROOT_B, 7, { instanceId: 'inst-shared', childSessionId: 'session-400-shared-b' }),
      existing,
    )
    existing.push(inB.record)
    expect(inA.record.rootSessionId).not.toBe(inB.record.rootSessionId)
    expect(inA.record.instanceId).toBe(inB.record.instanceId)
    // addressing by identity stays team-scoped
    expect(findMemberRecord(existing, inA.record.rootSessionId, inA.record.instanceId)?.rootSessionId).toBe(inA.record.rootSessionId)
    expect(findMemberRecord(existing, inB.record.rootSessionId, inB.record.instanceId)?.rootSessionId).toBe(inB.record.rootSessionId)
  })

  it('R3/R4: contextPolicy is frozen at creation — persistent by default, fresh on request', () => {
    const existing: MemberInstanceRecordDto[] = []
    const def = createMemberInstance(inputFor(ROOT_A, 0), existing)
    existing.push(def.record)
    const fresh = createMemberInstance(
      inputFor(ROOT_A, 1, { contextPolicy: CONTEXT_POLICIES.FRESH_PER_DELEGATION }),
      existing,
    )
    expect(def.contextPolicy).toBe(CONTEXT_POLICIES.PERSISTENT)
    expect(fresh.contextPolicy).toBe(CONTEXT_POLICIES.FRESH_PER_DELEGATION)
    // the v1 DTO itself carries no contextPolicy field (contract v1: invariant
    // 29 is carried by later contract versions) — the wrapper owns it
    expect('contextPolicy' in def.record).toBe(false)
    expect('hasEnteredRunning' in def.record).toBe(false)
  })
})

describe('P3-T3 member: roster queries', () => {
  it('instancesForTemplate / instanceCountForTemplate scope by (team, template)', () => {
    const existing: MemberInstanceRecordDto[] = []
    for (let i = 0; i < 3; i += 1) {
      const m = createMemberInstance(inputFor(ROOT_A, i), existing)
      existing.push(m.record)
    }
    const other = createMemberInstance(inputFor(ROOT_A, 10, { templateId: 'writer' }), existing)
    existing.push(other.record)
    // index 50 keeps the foreign instanceId ('inst-a50') distinct from every team-A id in this fixture
    const foreign = createMemberInstance(inputFor(ROOT_B, 50, { childSessionId: 'session-310-0' }), existing)
    existing.push(foreign.record)

    const rootA = rootSessionId(ROOT_A)
    const rootB = rootSessionId(ROOT_B)
    const template = templateId(TEMPLATE)

    // team A, template 'researcher': exactly the 3 minted instances
    const ofTemplateA = instancesForTemplate(existing, rootA, template)
    expect(ofTemplateA.length).toBe(3)
    expect(instanceCountForTemplate(existing, rootA, template)).toBe(3)
    // team A, other template: none of the researcher instances
    const ofWriter = instancesForTemplate(existing, rootA, templateId('writer'))
    expect(ofWriter.length).toBe(1)
    expect(instanceCountForTemplate(existing, rootA, templateId('writer'))).toBe(1)
    // team B, same template name: only team B's own instance
    const ofTemplateB = instancesForTemplate(existing, rootB, template)
    expect(ofTemplateB.length).toBe(1)
    expect(ofTemplateB[0]?.rootSessionId).toBe(rootB)
    expect(ofTemplateB[0]?.instanceId).toBe(foreign.record.instanceId)
    // findMemberRecord is team-scoped by the composite key
    const firstA = ofTemplateA[0]
    if (firstA === undefined) throw new Error('fixture invariant: team A must have 3 researcher instances')
    expect(findMemberRecord(existing, rootA, firstA.instanceId)?.instanceId).toBe(firstA.instanceId)
    expect(findMemberRecord(existing, rootB, firstA.instanceId)).toBe(undefined)
  })
})

describe('P3-T3 member: uniqueness and reserved-id rules', () => {
  it('DUPLICATE_INSTANCE_ID: the same instanceId twice in one TeamSession is rejected (contract code)', () => {
    const existing: MemberInstanceRecordDto[] = []
    const first = createMemberInstance(inputFor(ROOT_A, 0), existing)
    existing.push(first.record)
    const clash = inputFor(ROOT_A, 1, { instanceId: 'inst-a0' })
    expectContractCode(() => createMemberInstance(clash, existing), 'DUPLICATE_INSTANCE_ID')
  })

  it('SESSION_ALREADY_BOUND: a child session is never shared — within a team and across teams (invariant 23)', () => {
    const existing: MemberInstanceRecordDto[] = []
    const first = createMemberInstance(inputFor(ROOT_A, 0), existing)
    existing.push(first.record)
    // same team, different instance, same child session
    const clashSameTeam = inputFor(ROOT_A, 1, { childSessionId: 'session-300-0' })
    expectContractCode(() => createMemberInstance(clashSameTeam, existing), 'SESSION_ALREADY_BOUND')
    // different team, same child session
    const clashOtherTeam = inputFor(ROOT_B, 0, { childSessionId: 'session-300-0' })
    expectContractCode(() => createMemberInstance(clashOtherTeam, existing), 'SESSION_ALREADY_BOUND')
  })

  it('INSTANCE_ID_RESERVED: inst-leader cannot be minted by the member creation path', () => {
    const { code, details } = expectMemberCode(
      () => createMemberInstance(inputFor(ROOT_A, 0, { instanceId: 'inst-leader' }), []),
      'INSTANCE_ID_RESERVED',
    )
    expect(code).toBe('INSTANCE_ID_RESERVED')
    expect(details.instanceId).toBe('inst-leader')
    expect(details.rootSessionId).toBe(ROOT_A)
  })
})

describe('P3-T3 member: contract validation pass-through', () => {
  it('invalid id shapes are rejected with the contract codes', () => {
    const existing: MemberInstanceRecordDto[] = []
    expectContractCode(
      () => createMemberInstance(inputFor(ROOT_A, 0, { instanceId: 'inst-UPPER' }), existing),
      'INVALID_INSTANCE_ID',
    )
    expectContractCode(
      () => createMemberInstance(inputFor(ROOT_A, 0, { instanceId: 'nope' }), existing),
      'INVALID_INSTANCE_ID',
    )
    expectContractCode(
      () => createMemberInstance(inputFor(ROOT_A, 0, { templateId: 'Bad Template' }), existing),
      'INVALID_TEMPLATE_ID',
    )
    expectContractCode(
      () => createMemberInstance(inputFor(ROOT_A, 0, { childSessionId: 'has space' }), existing),
      'INVALID_CHILD_SESSION_ID',
    )
    expectContractCode(
      () => createMemberInstance(inputFor('bad root with space', 0), existing),
      'INVALID_ROOT_SESSION_ID',
    )
  })

  it('malformed label / groupId / workspace / createdAt are rejected with MALFORMED_DTO', () => {
    const existing: MemberInstanceRecordDto[] = []
    expectContractCode(
      () => createMemberInstance(inputFor(ROOT_A, 0, { label: '' }), existing),
      'MALFORMED_DTO',
    )
    expectContractCode(
      () => createMemberInstance(inputFor(ROOT_A, 0, { label: 'x'.repeat(129) }), existing),
      'MALFORMED_DTO',
    )
    expectContractCode(
      () => createMemberInstance(inputFor(ROOT_A, 0, { label: 42 }), existing),
      'MALFORMED_DTO',
    )
    expectContractCode(
      () => createMemberInstance(inputFor(ROOT_A, 0, { groupId: 'g'.repeat(129) }), existing),
      'MALFORMED_DTO',
    )
    expectContractCode(
      () => createMemberInstance(inputFor(ROOT_A, 0, { workspace: '' }), existing),
      'MALFORMED_DTO',
    )
    expectContractCode(
      () => createMemberInstance(inputFor(ROOT_A, 0, { workspace: 'a\u0001b' }), existing),
      'MALFORMED_DTO',
    )
    expectContractCode(
      () => createMemberInstance(inputFor(ROOT_A, 0, { createdAt: 'yesterday' }), existing),
      'MALFORMED_DTO',
    )
  })

  it('groupId is optional: absent → not on the record; present → preserved verbatim', () => {
    const plain = createMemberInstance(inputFor(ROOT_A, 0), [])
    expect('groupId' in plain.record).toBe(false)
    const grouped = createMemberInstance(inputFor(ROOT_A, 1, { groupId: 'team-alpha' }), [])
    expect(grouped.record.groupId).toBe('team-alpha')
  })

  it('an unknown contextPolicy at creation is a member-domain rejection (CONTEXT_POLICY_UNKNOWN)', () => {
    const { details } = expectMemberCode(
      () => createMemberInstance(inputFor(ROOT_A, 0, { contextPolicy: 'reset_context' }), []),
      'CONTEXT_POLICY_UNKNOWN',
    )
    expect(details.rootSessionId).toBe(ROOT_A)
  })

  it('the input object is never mutated by creation', () => {
    const input = inputFor(ROOT_A, 0, { groupId: 'g1' })
    const before = { ...input }
    createMemberInstance(input, [])
    expect(input).toEqual(before)
  })
})
