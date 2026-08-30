/**
 * p4-07 — durability and crash semantics of the TeamDomain sidecar.
 *
 * Proves the public single-write-durability contract end-to-end through
 * the seam fake: every applied write is recorded (writeLog + committed
 * bytes match the stored row); a crashed write is neither applied nor
 * recorded; a crash between two different stores leaves the domain openable
 * with the divergence diagnosable store by store (roll-forward, never
 * rollback); concurrent allocations serialize on the write chain.
 *
 * @module @dsh-agent-team/storage/test/p4-07-durability-crash
 */

import { describe, expect, it } from 'vitest'

import { TEAM_DOMAIN_NAME, createTeamDomainSeamSpec, seamErrorCode } from '../schema/index.js'
import { createTeamDomain, openTeamDomain } from '../repositories/index.js'
import {
  InMemoryStorageSeam,
  P4_FIXTURE,
  asTeamDomainError,
  capture,
  detail,
  memberInstanceInput,
  teamSessionInput,
} from './p4-helpers.js'

const seam = new InMemoryStorageSeam()
const domain = await createTeamDomain(seam)
const stampLog = seam.writeLog.slice()
const stampEvidence = stampLog.map((entry) => ({
  committed: seam.committedRows(TEAM_DOMAIN_NAME, entry.table).get(entry.key),
  raw: seam.rawRows(TEAM_DOMAIN_NAME, entry.table).get(entry.key),
}))

seam.setCrashAfterWrites(seam.writeCount)
const crashPut = await capture(() => domain.repositories.teamSessions.put(teamSessionInput(P4_FIXTURE.otherRootSessionId)))
const rawSessionsAfterCrash = [...seam.rawRows(TEAM_DOMAIN_NAME, 'team_sessions').keys()]
const committedSessionsAfterCrash = [...seam.committedRows(TEAM_DOMAIN_NAME, 'team_sessions').keys()]
seam.clearCrash()

await domain.repositories.teamSessions.put(teamSessionInput(P4_FIXTURE.rootSessionId))
seam.setCrashAfterWrites(seam.writeCount)
const memberCrash = await capture(() =>
  domain.repositories.memberInstances.put(memberInstanceInput(P4_FIXTURE.rootSessionId, P4_FIXTURE.instanceId, P4_FIXTURE.childSessionId)),
)
seam.clearCrash()
await domain.close()
const reopened = await openTeamDomain(seam)
const sessionsAlive = reopened.repositories.teamSessions.get(String(P4_FIXTURE.rootSessionId))
const memberAbsent = reopened.repositories.memberInstances.get(String(P4_FIXTURE.rootSessionId), String(P4_FIXTURE.instanceId))

const concurrentSeqs = (
  await Promise.all(
    Array.from({ length: 8 }, () => reopened.repositories.ledger.allocateSequence()),
  )
).sort((a, b) => a - b)

const seamRaw = new InMemoryStorageSeam()
const rawHandle = await seamRaw.open(createTeamDomainSeamSpec())
const updateMissing = await capture(() => rawHandle.table('ledger').update('no-such-key', (current) => String(current) + 'x'))
await rawHandle.close()
const closedTable = await capture(() => rawHandle.table('ledger'))

const seamPartial = new InMemoryStorageSeam()
seamPartial.setCrashAfterWrites(5)
await capture(() => createTeamDomain(seamPartial))
seamPartial.clearCrash()
const reopen1 = await capture(() => openTeamDomain(seamPartial))
const reopen2 = await capture(() => openTeamDomain(seamPartial))

describe('p4-07 durability and crash semantics', () => {
  it('every applied write is single-write durable (logged, committed, matching the stored row)', () => {
    expect(stampEvidence.length).toBe(8)
    for (const evidence of stampEvidence) {
      expect(typeof evidence.raw).toBe('string')
      expect(evidence.committed).toBe(String(evidence.raw))
    }
    expect(new Set(stampEvidence.map((e) => e.committed)).size).toBe(8)
  })

  it('a crashed write is rejected, not applied, and not recorded', () => {
    expect(crashPut.ok).toBe(false)
    expect(asTeamDomainError(crashPut.error).code).toBe('SEAM_FAILURE')
    expect(rawSessionsAfterCrash).toEqual([])
    expect(committedSessionsAfterCrash).toEqual([])
  })

  it('a crash between two stores leaves the domain openable with a diagnosable divergence', () => {
    expect(memberCrash.ok).toBe(false)
    expect(asTeamDomainError(memberCrash.error).code).toBe('SEAM_FAILURE')
    expect(sessionsAlive === undefined).toBe(false)
    expect(sessionsAlive!.rootSessionId).toBe(String(P4_FIXTURE.rootSessionId))
    expect(memberAbsent).toBe(undefined)
  })

  it('concurrent allocations serialize on the write chain into distinct sequences', () => {
    expect(concurrentSeqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('the raw seam surfaces missing-key for update and closed for table access', () => {
    expect(updateMissing.ok).toBe(false)
    expect(seamErrorCode(updateMissing.error)).toBe('missing-key')
    expect(closedTable.ok).toBe(false)
    expect(seamErrorCode(closedTable.error)).toBe('closed')
  })

  it('a partial create is re-openable with the same stable diagnosis every time', () => {
    expect(reopen1.ok).toBe(false)
    expect(reopen2.ok).toBe(false)
    const error1 = asTeamDomainError(reopen1.error)
    const error2 = asTeamDomainError(reopen2.error)
    expect(error1.code).toBe('SCHEMA_STAMP_MISSING')
    expect(detail(error1, 'store')).toBe('compatibility')
    expect(error2.code).toBe('SCHEMA_STAMP_MISSING')
    expect(detail(error2, 'store')).toBe('compatibility')
    expect(detail(error2, 'found')).toBe(null)
  })
})
