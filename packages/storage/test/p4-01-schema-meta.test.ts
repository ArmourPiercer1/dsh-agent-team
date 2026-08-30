/**
 * p4-01 — schema_meta store + create/open lifecycle + layered version policy.
 *
 * Proves the L2/L3 policy surfaces: create stamps all eight stores with
 * canonical bytes; open verifies the seam (L1) and the per-store stamps
 * (L2) and fails loudly with the exact store/version on mismatch; a crash
 * between stamp writes leaves a partial domain whose diagnosis is stable
 * across re-opens (roll-forward, never rollback).
 *
 * @module @dsh-agent-team/storage/test/p4-01-schema-meta
 */

import { describe, expect, it } from 'vitest'

import { TEAM_DOMAIN_NAME, serializeSchemaMetaStamp } from '../schema/index.js'
import { isSupportedTeamDomainSchemaVersion, assertSupportedTeamDomainSchemaVersion, parseSchemaMetaStamp } from '../schema/index.js'
import { createTeamDomain, openTeamDomain } from '../repositories/index.js'
import { InMemoryStorageSeam, P4_STORES, asTeamDomainError, capture, detail } from './p4-helpers.js'

const seam = new InMemoryStorageSeam()
const domain = await createTeamDomain(seam)
const stamps = domain.repositories.schemaMeta.listStamps()
const rawStamps = seam.rawRows(TEAM_DOMAIN_NAME, 'schema_meta')

await domain.close()
const reopened = await openTeamDomain(seam)
const reopenedName = reopened.name
const reopenedStampCount = reopened.repositories.schemaMeta.listStamps().size
const reopenedStoreSizes: Array<[string, number]> = [
  ['teamSessions', reopened.repositories.teamSessions.size],
  ['memberInstances', reopened.repositories.memberInstances.size],
  ['sessionBindings', reopened.repositories.sessionBindings.size],
  ['overrides', reopened.repositories.overrides.size],
  ['compatibility', reopened.repositories.compatibility.size],
  ['operations', reopened.repositories.operations.size],
  ['ledger', reopened.repositories.ledger.size],
]
await reopened.close()

const createAgain = await capture(() => createTeamDomain(seam))

const seamL1 = new InMemoryStorageSeam()
seamL1.seedDomainVersion(TEAM_DOMAIN_NAME, 2, [...P4_STORES])
const l1Mismatch = await capture(() => openTeamDomain(seamL1))

const emptyOpen = await capture(() => openTeamDomain(new InMemoryStorageSeam()))

const seamPartial = new InMemoryStorageSeam()
seamPartial.setCrashAfterWrites(5)
const partialCreate = await capture(() => createTeamDomain(seamPartial))
seamPartial.clearCrash()
const partialOpen1 = await capture(() => openTeamDomain(seamPartial))
const partialOpen2 = await capture(() => openTeamDomain(seamPartial))

const seamTamper = new InMemoryStorageSeam()
const tamperDomain = await createTeamDomain(seamTamper)
await tamperDomain.close()
// A hand-built canonical stamp row with store version 2 (schemaVersion stays
// at the supported 1, so the failure is exactly the L2 version check).
seamTamper
  .rawRows(TEAM_DOMAIN_NAME, 'schema_meta')
  .set('operations', '{"schemaVersion":1,"stampedAt":"2026-08-29T12:00:00.000Z","store":"operations","version":2}')
const tamperOpen = await capture(() => openTeamDomain(seamTamper))

const seamCorrupt = new InMemoryStorageSeam()
const corruptDomain = await createTeamDomain(seamCorrupt)
await corruptDomain.close()
seamCorrupt.rawRows(TEAM_DOMAIN_NAME, 'schema_meta').set('team_sessions', 42)
const corruptOpen = await capture(() => openTeamDomain(seamCorrupt))

describe('p4-01 schema_meta / create-open lifecycle / version policy', () => {
  it('create stamps all eight stores at schema version 1 with canonical bytes', () => {
    expect(domain.name).toBe(TEAM_DOMAIN_NAME)
    expect(stamps.size).toBe(8)
    for (const store of P4_STORES) {
      const stamp = stamps.get(store)
      expect(stamp === undefined).toBe(false)
      const raw = rawStamps.get(store)
      expect(typeof raw).toBe('string')
      expect(raw).toBe(serializeSchemaMetaStamp(stamp!))
      expect(stamp!.schemaVersion).toBe(1)
      expect(stamp!.version).toBe(1)
      expect(stamp!.store).toBe(store)
    }
  })

  it('openTeamDomain re-opens a closed domain and hands out all eight repositories', () => {
    expect(reopenedName).toBe(TEAM_DOMAIN_NAME)
    expect(reopenedStampCount).toBe(8)
    expect(reopenedStoreSizes.length).toBe(7)
    for (const [, size] of reopenedStoreSizes) {
      expect(size).toBe(0)
    }
  })

  it('L1: a domain persisted at version 2 is rejected at open with SCHEMA_VERSION_MISMATCH', () => {
    expect(l1Mismatch.ok).toBe(false)
    const error = asTeamDomainError(l1Mismatch.error)
    expect(error.code).toBe('SCHEMA_VERSION_MISMATCH')
    expect(detail(error, 'expected')).toBe(1)
    expect(detail(error, 'found')).toBe(2)
    expect(detail(error, 'seamCode')).toBe('version-mismatch')
  })

  it('createTeamDomain on an already stamped domain raises TEAM_DOMAIN_EXISTS', () => {
    expect(createAgain.ok).toBe(false)
    const error = asTeamDomainError(createAgain.error)
    expect(error.code).toBe('TEAM_DOMAIN_EXISTS')
    expect(detail(error, 'store')).toBe('schema_meta')
    expect(detail(error, 'size')).toBe(8)
  })

  it('openTeamDomain on an empty seam raises SCHEMA_STAMP_MISSING for the first store', () => {
    expect(emptyOpen.ok).toBe(false)
    const error = asTeamDomainError(emptyOpen.error)
    expect(error.code).toBe('SCHEMA_STAMP_MISSING')
    expect(detail(error, 'store')).toBe('schema_meta')
    expect(detail(error, 'expected')).toBe(1)
    expect(detail(error, 'found')).toBe(null)
  })

  it('a crash between stamp writes leaves a partial domain with a stable diagnosis', () => {
    expect(partialCreate.ok).toBe(false)
    const error = asTeamDomainError(partialCreate.error)
    expect(error.code).toBe('SEAM_FAILURE')
    expect(partialOpen1.ok).toBe(false)
    const openError1 = asTeamDomainError(partialOpen1.error)
    expect(openError1.code).toBe('SCHEMA_STAMP_MISSING')
    expect(detail(openError1, 'store')).toBe('compatibility')
    expect(partialOpen2.ok).toBe(false)
    const openError2 = asTeamDomainError(partialOpen2.error)
    expect(openError2.code).toBe('SCHEMA_STAMP_MISSING')
    expect(detail(openError2, 'store')).toBe('compatibility')
    expect(detail(openError2, 'found')).toBe(null)
  })

  it('a tampered stamp version is rejected with SCHEMA_STAMP_MISMATCH for the exact store', () => {
    expect(tamperOpen.ok).toBe(false)
    const error = asTeamDomainError(tamperOpen.error)
    expect(error.code).toBe('SCHEMA_STAMP_MISMATCH')
    expect(detail(error, 'store')).toBe('operations')
    expect(detail(error, 'expected')).toBe(1)
    expect(detail(error, 'found')).toBe(2)
  })

  it('a non-string stamp row is rejected with RECORD_INVALID row-not-a-string', () => {
    expect(corruptOpen.ok).toBe(false)
    const error = asTeamDomainError(corruptOpen.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'store')).toBe('schema_meta')
    expect(detail(error, 'key')).toBe('team_sessions')
    expect(detail(error, 'problem')).toBe('row-not-a-string')
  })

  it('parseSchemaMetaStamp rejects unknown and missing fields', () => {
    expect(() =>
      parseSchemaMetaStamp({ schemaVersion: 1, store: 'ledger', stampedAt: '2026-08-29T12:00:00Z', version: 1, extra: 1 }),
    ).toThrow()
    expect(() => parseSchemaMetaStamp({ store: 'ledger', stampedAt: '2026-08-29T12:00:00Z', version: 1 })).toThrow()
  })

  it('the version policy accepts only the supported version and fails loudly otherwise', () => {
    expect(assertSupportedTeamDomainSchemaVersion(1, 'ledger')).toBe(1)
    expect(() => assertSupportedTeamDomainSchemaVersion(2, 'ledger')).toThrow()
    expect(isSupportedTeamDomainSchemaVersion(1)).toBe(true)
    expect(isSupportedTeamDomainSchemaVersion(2)).toBe(false)
  })
})
