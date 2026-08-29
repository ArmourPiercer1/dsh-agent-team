import { describe, expect, it } from 'vitest'

import {
  LEADER_INSTANCE_ID,
  assertMemberIdentityInTeam,
  createMemberIdentity,
  leaderMemberIdentityOf,
  memberIdentityKey,
  memberIdentitiesEqual,
  parseInstanceId,
  parseMemberIdentityKey,
  parseRootSessionId,
  parseTeamSessionId,
  parseTemplateId,
} from '../src/index.js'
import { expectCode } from './helpers.js'

describe('contracts v1 — composite member runtime identity (invariants 18/19/20)', () => {
  const rootA = parseRootSessionId('session-1')
  const rootB = parseRootSessionId('session-2')
  const instX = parseInstanceId('inst-x')
  const instY = parseInstanceId('inst-y')

  it('createMemberIdentity returns a deep-frozen value bound to exactly (rootSessionId, instanceId)', () => {
    const id = createMemberIdentity(rootA, instX)
    expect(Object.isFrozen(id)).toBe(true)
    expect(Object.keys(id).sort()).toEqual(['instanceId', 'rootSessionId'])
    // label / templateId / groupId are NOT part of the runtime identity
    expect(Object.hasOwn(id, 'label')).toBe(false)
    expect(Object.hasOwn(id, 'templateId')).toBe(false)
    expect(Object.hasOwn(id, 'groupId')).toBe(false)
  })

  it('the canonical identity key is stable across construction order', () => {
    const idA = createMemberIdentity(rootA, instX)
    const idAgain = createMemberIdentity(rootA, instX)
    expect(memberIdentityKey(idAgain)).toBe(memberIdentityKey(idA))
    expect(memberIdentityKey(idA)).toBe('{"instanceId":"inst-x","rootSessionId":"session-1"}')
  })

  it('the same instanceId under different root sessions are different identities', () => {
    const idA = createMemberIdentity(rootA, instX)
    const idB = createMemberIdentity(rootB, instX)
    expect(memberIdentityKey(idA)).not.toBe(memberIdentityKey(idB))
    expect(memberIdentitiesEqual(idA, idB)).toBe(false)
  })

  it('different instanceIds under the same root session are different identities', () => {
    const idA = createMemberIdentity(rootA, instX)
    const idB = createMemberIdentity(rootA, instY)
    expect(memberIdentitiesEqual(idA, idB)).toBe(false)
  })

  it('identical (rootSessionId, instanceId) pairs are equal', () => {
    const idA = createMemberIdentity(rootA, instX)
    const idB = createMemberIdentity(rootA, instX)
    expect(memberIdentitiesEqual(idA, idB)).toBe(true)
    expect(idA).toEqual(idB)
  })

  it('assertMemberIdentityInTeam enforces the scope (cross-scope = IDENTITY_SCOPE_MISMATCH)', () => {
    const idA = createMemberIdentity(rootA, instX)
    const teamA = parseTeamSessionId('session-1')
    const teamB = parseTeamSessionId('session-2')
    expect(() => assertMemberIdentityInTeam(idA, teamA)).not.toThrow()
    expectCode(() => assertMemberIdentityInTeam(idA, teamB), 'IDENTITY_SCOPE_MISMATCH')
  })
})

describe('contracts v1 — identity key round-trip', () => {
  const root = parseRootSessionId('session-9')
  const inst = parseInstanceId('inst-z9')

  it('parseMemberIdentityKey inverts memberIdentityKey', () => {
    const id = createMemberIdentity(root, inst)
    const key = memberIdentityKey(id)
    const back = parseMemberIdentityKey(key)
    expect(back).toEqual(id)
    expect(memberIdentityKey(back)).toBe(key)
  })

  it('rejects non-canonical key order (the key is a frozen byte contract)', () => {
    const unsorted = '{"rootSessionId":"session-9","instanceId":"inst-z9"}'
    expectCode(() => parseMemberIdentityKey(unsorted), 'MALFORMED_DTO')
  })

  it('rejects extra, missing, and malformed key fields', () => {
    expectCode(
      () =>
        parseMemberIdentityKey(
          '{"instanceId":"inst-z9","rootSessionId":"session-9","label":"extra"}',
        ),
      'MALFORMED_DTO',
    )
    expectCode(
      () => parseMemberIdentityKey('{"instanceId":"inst-z9"}'),
      'MALFORMED_DTO',
    )
    expectCode(() => parseMemberIdentityKey('{not json'), 'MALFORMED_DTO')
    expectCode(() => parseMemberIdentityKey('["inst-z9"]'), 'MALFORMED_DTO')
  })
})

describe('contracts v1 — leader instance identity (invariants 13/14)', () => {
  it('LEADER_INSTANCE_ID is the frozen inst-leader constant', () => {
    expect(LEADER_INSTANCE_ID).toBe('inst-leader')
  })

  it('leaderMemberIdentityOf derives the single leader identity for a team', () => {
    const team = parseTeamSessionId('session-7')
    const leader = leaderMemberIdentityOf(team)
    expect(leader.instanceId).toBe(LEADER_INSTANCE_ID)
    expect(leader.rootSessionId).toBe(team)
    expect(memberIdentityKey(leader)).toBe(
      '{"instanceId":"inst-leader","rootSessionId":"session-7"}',
    )
    const back = parseMemberIdentityKey(memberIdentityKey(leader))
    expect(back).toEqual(leader)
  })

  it('template identity does not participate: two members sharing a template are distinct', () => {
    const root = parseRootSessionId('session-3')
    const template = parseTemplateId('researcher')
    void template // the templateId exists as a static identity only
    const a = createMemberIdentity(root, parseInstanceId('inst-a'))
    const b = createMemberIdentity(root, parseInstanceId('inst-b'))
    expect(memberIdentitiesEqual(a, b)).toBe(false)
  })
})
