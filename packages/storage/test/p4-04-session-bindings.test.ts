/**
 * p4-04 — session_bindings store: the three binding kinds (team-member,
 * team-root, ordinary) round-trip at the sessionId key; a child session
 * can be bound exactly once (contracts SESSION_ALREADY_BOUND preserved for
 * team-member, typed cross-kind conflict otherwise); legacy fields and bad
 * kinds are rejected; listByKind filters and sorts.
 *
 * @module @dsh-agent-team/storage/test/p4-04-session-bindings
 */

import { describe, expect, it } from 'vitest'

import { assertChildSessionBindingUnique, parseChildSessionId, serializeSessionBinding } from '../../contracts/src/index.js'
import { TEAM_DOMAIN_NAME } from '../schema/index.js'
import { createTeamDomain } from '../repositories/index.js'
import {
  InMemoryStorageSeam,
  P4_FIXTURE,
  asTeamDomainError,
  capture,
  detail,
  ordinaryBinding,
  teamMemberBinding,
  teamRootBinding,
} from './p4-helpers.js'

const seam = new InMemoryStorageSeam()
const domain = await createTeamDomain(seam)
const repo = domain.repositories.sessionBindings
const root = P4_FIXTURE.rootSessionId
const otherRoot = P4_FIXTURE.otherRootSessionId
const raw = seam.rawRows(TEAM_DOMAIN_NAME, 'session_bindings')

const memberBinding = await repo.put(teamMemberBinding(String(root), 'inst-alpha', String(P4_FIXTURE.childSessionId)))
const rootBinding = await repo.put(teamRootBinding(String(root)))
const ordinary = await repo.put(ordinaryBinding('session-ordinary-1'))

const rebindMember = await capture(() =>
  repo.put(teamMemberBinding(String(otherRoot), 'inst-beta', String(P4_FIXTURE.childSessionId))),
)
const rebindOrdinary = await capture(() => repo.put(ordinaryBinding(String(P4_FIXTURE.childSessionId))))

const missingInstance = await capture(() =>
  repo.put({
    kind: 'team-member',
    rootSessionId: String(root),
    schemaVersion: 1,
    sessionId: String(parseChildSessionId('session-child-3')),
  }),
)
const legacyBinding = await capture(() =>
  repo.put({ ...teamMemberBinding(String(root), 'inst-gamma', String(parseChildSessionId('session-child-4'))), memberId: 'legacy-1' }),
)

const byKind = repo.listByKind('team-member')
const badKind = await capture(() => repo.listByKind('bogus'))

describe('p4-04 session_bindings store', () => {
  it('a team-member binding round-trips at the child sessionId key', () => {
    expect(repo.get(String(P4_FIXTURE.childSessionId))).toEqual(memberBinding)
    expect(raw.get(String(P4_FIXTURE.childSessionId))).toBe(serializeSessionBinding(memberBinding))
  })

  it('a team-root binding round-trips at the root sessionId key', () => {
    expect(repo.get(String(root))).toEqual(rootBinding)
  })

  it('an ordinary binding round-trips at its sessionId key', () => {
    expect(repo.get('session-ordinary-1')).toEqual(ordinary)
  })

  it('rebinding an already bound child as team-member raises SESSION_ALREADY_BOUND', () => {
    expect(rebindMember.ok).toBe(false)
    const error = asTeamDomainError(rebindMember.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'contractsCode')).toBe('SESSION_ALREADY_BOUND')
  })

  it('rebinding an already bound child under a different kind raises a typed cross-kind conflict', () => {
    expect(rebindOrdinary.ok).toBe(false)
    const error = asTeamDomainError(rebindOrdinary.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'problem')).toBe('session-already-bound')
    expect(detail(error, 'existingKind')).toBe('team-member')
    expect(detail(error, 'newKind')).toBe('ordinary')
  })

  it('a team-member binding without instanceId is rejected with INVALID_INSTANCE_ID', () => {
    expect(missingInstance.ok).toBe(false)
    const error = asTeamDomainError(missingInstance.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'contractsCode')).toBe('INVALID_INSTANCE_ID')
  })

  it('a legacy memberId field is rejected with LEGACY_MEMBER_ID_REJECTED', () => {
    expect(legacyBinding.ok).toBe(false)
    const error = asTeamDomainError(legacyBinding.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'contractsCode')).toBe('LEGACY_MEMBER_ID_REJECTED')
  })

  it('listByKind filters and sorts; the unique-child assertion passes for a fresh child and throws for a bound one', () => {
    expect(byKind.length).toBe(1)
    expect(byKind[0]?.kind).toBe('team-member')
    expect(badKind.ok).toBe(false)
    expect(asTeamDomainError(badKind.error).code).toBe('RECORD_INVALID')
    expect(detail(asTeamDomainError(badKind.error), 'problem')).toBe('bad-binding-kind')
    expect(() => assertChildSessionBindingUnique(P4_FIXTURE.secondChildSessionId, byKind)).not.toThrow()
    expect(() => assertChildSessionBindingUnique(P4_FIXTURE.childSessionId, byKind)).toThrow()
  })
})
