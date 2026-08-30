/**
 * p4-02 — team_sessions store: canonical round-trip, idempotency, uniqueness
 * (contracts DUPLICATE_TEAM_SESSION preserved), legacy-field rejection,
 * non-canonical byte detection, and NOT_OPEN after close.
 *
 * @module @dsh-agent-team/storage/test/p4-02-team-sessions
 */

import { describe, expect, it } from 'vitest'

import { serializeTeamSessionRecord, parseRootSessionId } from '../../contracts/src/index.js'
import { TEAM_DOMAIN_NAME } from '../schema/index.js'
import { createTeamDomain } from '../repositories/index.js'
import { InMemoryStorageSeam, P4_FIXTURE, asTeamDomainError, capture, detail, teamSessionInput } from './p4-helpers.js'

const seam = new InMemoryStorageSeam()
const domain = await createTeamDomain(seam)
const teamSessions = domain.repositories.teamSessions
const root = P4_FIXTURE.rootSessionId
const root2 = P4_FIXTURE.otherRootSessionId
const root3 = parseRootSessionId('session-root-3')

const record1 = await teamSessions.put(teamSessionInput(root, 1))
const writesBefore = seam.writeLog.length
const putAgain = await capture(() => teamSessions.put(teamSessionInput(root, 1)))
const writesAfterIdem = seam.writeLog.length
const dup = await capture(() => teamSessions.put(teamSessionInput(root, 2)))

await teamSessions.put(teamSessionInput(root2, 1))
await teamSessions.put(teamSessionInput(root3, 1))
const listed = teamSessions.list()

const delTrue = await teamSessions.delete(String(root3))
const delFalse = await teamSessions.delete(String(root3))

const badGet = await capture(() => teamSessions.get('not a session id'))
const legacyInput = { ...teamSessionInput(root2, 1), memberId: 'legacy-1' }
const legacyPut = await capture(() => teamSessions.put(legacyInput))

const raw = seam.rawRows(TEAM_DOMAIN_NAME, 'team_sessions')
const storedRaw = raw.get(String(root))
const getBeforeOverwrite = teamSessions.get(String(root))
const storedObj = JSON.parse(String(storedRaw)) as Record<string, unknown>
const nonCanonical = `{${Object.entries(storedObj)
  .reverse()
  .map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`)
  .join(',')}}`
raw.set(String(root), nonCanonical)
const nonCanonicalGet = await capture(() => teamSessions.get(String(root)))

await domain.close()
const putAfterClose = await capture(() => teamSessions.put(teamSessionInput(root3, 1)))
const getAfterClose = await capture(() => teamSessions.get(String(root3)))

describe('p4-02 team_sessions store', () => {
  it('put stores the canonical record at the rootSessionId key', () => {
    expect(record1.schemaVersion).toBe(1)
    expect(record1.rootSessionId).toBe(String(root))
    expect(storedRaw).toBe(serializeTeamSessionRecord(record1))
    expect(getBeforeOverwrite).toEqual(record1)
  })

  it('an identical put is an idempotent no-op (no write)', () => {
    expect(putAgain.ok).toBe(true)
    expect(writesAfterIdem).toBe(writesBefore)
  })

  it('a second put for the same root raises RECORD_DUPLICATE DUPLICATE_TEAM_SESSION', () => {
    expect(dup.ok).toBe(false)
    const error = asTeamDomainError(dup.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'store')).toBe('team_sessions')
    expect(detail(error, 'contractsCode')).toBe('DUPLICATE_TEAM_SESSION')
  })

  it('list returns every team session sorted by rootSessionId', () => {
    expect(listed.length).toBe(3)
    expect(listed.map((r) => r.rootSessionId)).toEqual([String(root), String(root2), String(root3)])
  })

  it('delete removes the row (true, then false for the absent key)', () => {
    expect(delTrue).toBe(true)
    expect(delFalse).toBe(false)
  })

  it('get with an invalid rootSessionId raises RECORD_INVALID INVALID_ROOT_SESSION_ID', () => {
    expect(badGet.ok).toBe(false)
    const error = asTeamDomainError(badGet.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'contractsCode')).toBe('INVALID_ROOT_SESSION_ID')
  })

  it('a legacy memberId field is rejected with LEGACY_MEMBER_ID_REJECTED', () => {
    expect(legacyPut.ok).toBe(false)
    const error = asTeamDomainError(legacyPut.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'contractsCode')).toBe('LEGACY_MEMBER_ID_REJECTED')
  })

  it('a non-canonical stored row is rejected with non-canonical-bytes', () => {
    expect(nonCanonicalGet.ok).toBe(false)
    const error = asTeamDomainError(nonCanonicalGet.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('non-canonical-bytes')
  })

  it('writes and reads after close raise NOT_OPEN', () => {
    expect(putAfterClose.ok).toBe(false)
    expect(asTeamDomainError(putAfterClose.error).code).toBe('NOT_OPEN')
    expect(getAfterClose.ok).toBe(false)
    expect(asTeamDomainError(getAfterClose.error).code).toBe('NOT_OPEN')
  })
})
