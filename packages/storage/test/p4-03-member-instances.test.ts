/**
 * p4-03 — member_instances store: identity-keyed canonical round-trip,
 * idempotency, per-team uniqueness (contracts DUPLICATE_INSTANCE_ID
 * preserved, scoped by root session), leader instance, validation codes,
 * scoped sorted list, and corruption detection.
 *
 * @module @dsh-agent-team/storage/test/p4-03-member-instances
 */

import { describe, expect, it } from 'vitest'

import {
  createMemberIdentity,
  memberIdentityKey,
  parseInstanceId,
  serializeMemberInstanceRecord,
} from '../../contracts/src/index.js'
import type { InstanceId, MemberLifecycleState } from '../../contracts/src/index.js'
import { TEAM_DOMAIN_NAME } from '../schema/index.js'
import { createTeamDomain } from '../repositories/index.js'
import { InMemoryStorageSeam, P4_FIXTURE, asTeamDomainError, capture, detail, memberInstanceInput } from './p4-helpers.js'

const seam = new InMemoryStorageSeam()
const domain = await createTeamDomain(seam)
const repo = domain.repositories.memberInstances
const root = P4_FIXTURE.rootSessionId
const otherRoot = P4_FIXTURE.otherRootSessionId
const raw = seam.rawRows(TEAM_DOMAIN_NAME, 'member_instances')

const record = await repo.put(memberInstanceInput(root, P4_FIXTURE.instanceId, P4_FIXTURE.childSessionId))
const expectedKey = memberIdentityKey(createMemberIdentity(root, P4_FIXTURE.instanceId))
const storedRaw = raw.get(expectedKey)
const getBefore = repo.get(String(root), String(P4_FIXTURE.instanceId))

const writesBefore = seam.writeLog.length
const putAgain = await capture(() => repo.put(memberInstanceInput(root, P4_FIXTURE.instanceId, P4_FIXTURE.childSessionId)))
const writesAfterIdem = seam.writeLog.length

const dup = await capture(() =>
  repo.put({ ...memberInstanceInput(root, P4_FIXTURE.instanceId, P4_FIXTURE.childSessionId), label: 'other-label' }),
)

await repo.put(memberInstanceInput(otherRoot, P4_FIXTURE.instanceId, P4_FIXTURE.secondChildSessionId))
const otherRootAlpha = repo.get(String(otherRoot), String(P4_FIXTURE.instanceId))
const listedOtherRoot = repo.list(String(otherRoot))

const leader = await repo.put(memberInstanceInput(root, parseInstanceId('inst-leader'), P4_FIXTURE.secondChildSessionId))
const leaderGet = repo.get(String(root), 'inst-leader')

const badLifecycle = await capture(() =>
  repo.put({ ...memberInstanceInput(root, parseInstanceId('inst-gamma'), P4_FIXTURE.childSessionId), lifecycle: 'PROVISIONING_FAILED' as MemberLifecycleState }),
)
const badInstance = await capture(() =>
  repo.put({ ...memberInstanceInput(root, P4_FIXTURE.instanceId, P4_FIXTURE.childSessionId), instanceId: 'Inst_Bad' as InstanceId }),
)

const listedRoot1 = repo.list(String(root))

const omega = parseInstanceId('inst-omega')
const corruptKey = memberIdentityKey(createMemberIdentity(root, omega))
raw.set(corruptKey, 42)
const corruptGet = await capture(() => repo.get(String(root), String(omega)))

describe('p4-03 member_instances store', () => {
  it('put stores the canonical record at the member identity key', () => {
    expect(record.schemaVersion).toBe(1)
    expect(record.instanceId).toBe('inst-alpha')
    expect(storedRaw).toBe(serializeMemberInstanceRecord(record))
    expect(getBefore).toEqual(record)
  })

  it('an identical put is an idempotent no-op (no write)', () => {
    expect(putAgain.ok).toBe(true)
    expect(writesAfterIdem).toBe(writesBefore)
  })

  it('a duplicate instance in the same team raises RECORD_DUPLICATE DUPLICATE_INSTANCE_ID', () => {
    expect(dup.ok).toBe(false)
    const error = asTeamDomainError(dup.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'store')).toBe('member_instances')
    expect(detail(error, 'contractsCode')).toBe('DUPLICATE_INSTANCE_ID')
  })

  it('the same instanceId is allowed in a different team (scoped uniqueness)', () => {
    expect(otherRootAlpha === undefined).toBe(false)
    expect(otherRootAlpha!.rootSessionId).toBe(String(otherRoot))
    expect(listedOtherRoot.length).toBe(1)
  })

  it('the leader instance (inst-leader) round-trips like any member', () => {
    expect(leader.instanceId).toBe('inst-leader')
    expect(leaderGet).toEqual(leader)
  })

  it('an unknown lifecycle is rejected with MALFORMED_DTO', () => {
    expect(badLifecycle.ok).toBe(false)
    const error = asTeamDomainError(badLifecycle.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'contractsCode')).toBe('MALFORMED_DTO')
  })

  it('an invalid instanceId is rejected with INVALID_INSTANCE_ID', () => {
    expect(badInstance.ok).toBe(false)
    const error = asTeamDomainError(badInstance.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'contractsCode')).toBe('INVALID_INSTANCE_ID')
  })

  it('list is scoped by root session and sorted by instanceId', () => {
    expect(listedRoot1.length).toBe(2)
    expect(listedRoot1.map((r) => r.instanceId)).toEqual(['inst-alpha', 'inst-leader'])
  })

  it('a non-string row is rejected with RECORD_INVALID row-not-a-string', () => {
    expect(corruptGet.ok).toBe(false)
    const error = asTeamDomainError(corruptGet.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'key')).toBe(corruptKey)
    expect(detail(error, 'problem')).toBe('row-not-a-string')
  })
})
