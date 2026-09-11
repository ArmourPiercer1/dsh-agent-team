/**
 * p4-01 — schema_meta store + create/open lifecycle + layered version policy.
 *
 * Proves the L2/L3 policy surfaces: create stamps all nine stores (schema
 * version 2) with canonical bytes; open verifies the seam (L1) and the
 * per-store stamps (L2) and fails loudly with the exact store/version on
 * mismatch; a crash between stamp writes leaves a partial domain whose
 * diagnosis is stable across re-opens (roll-forward, never rollback).
 *
 * Note (issue #2 blueprint-loading plan BP2): the domain moved v1 → v2
 * (the ninth store `blueprint_registry` was appended in canonical
 * order); the L1/L2 mismatch worlds below seed versions the v2 domain
 * does NOT support (3 = a future version), and the v1-medium-under-v2
 * open is itself the loud `SCHEMA_VERSION_MISMATCH` by design (no
 * migration, ever).
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
  ['blueprintRegistry', reopened.repositories.blueprintRegistry.size],
]
await reopened.close()

const createAgain = await capture(() => createTeamDomain(seam))

const seamL1 = new InMemoryStorageSeam()
// version 3: a FUTURE version the v2 domain does not support (the v1→v2
// loud mismatch is the SAME seam path: a persisted-at-1 domain under a
// v2 open is rejected by the identical version check, plan BP2).
seamL1.seedDomainVersion(TEAM_DOMAIN_NAME, 3, [...P4_STORES])
const l1Mismatch = await capture(() => openTeamDomain(seamL1))

// plan BP2: a v1 MEDIUM under a v2 open — the loud mismatch by design
// (no v1→v2 migration, ever; the world is simply not openable).
const seamV1 = new InMemoryStorageSeam()
seamV1.seedDomainVersion(TEAM_DOMAIN_NAME, 1, [...P4_STORES])
const v1Mismatch = await capture(() => openTeamDomain(seamV1))

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
// A hand-built canonical stamp row with store version 3 (schemaVersion stays
// at the supported 2, so the failure is exactly the L2 version check).
seamTamper
  .rawRows(TEAM_DOMAIN_NAME, 'schema_meta')
  .set('operations', '{"schemaVersion":2,"stampedAt":"2026-08-29T12:00:00.000Z","store":"operations","version":3}')
const tamperOpen = await capture(() => openTeamDomain(seamTamper))

const seamCorrupt = new InMemoryStorageSeam()
const corruptDomain = await createTeamDomain(seamCorrupt)
await corruptDomain.close()
seamCorrupt.rawRows(TEAM_DOMAIN_NAME, 'schema_meta').set('team_sessions', 42)
const corruptOpen = await capture(() => openTeamDomain(seamCorrupt))

describe('p4-01 schema_meta / create-open lifecycle / version policy', () => {
  it('create stamps all nine stores at schema version 2 with canonical bytes', () => {
    expect(domain.name).toBe(TEAM_DOMAIN_NAME)
    expect(stamps.size).toBe(9)
    for (const store of P4_STORES) {
      const stamp = stamps.get(store)
      expect(stamp === undefined).toBe(false)
      const raw = rawStamps.get(store)
      expect(typeof raw).toBe('string')
      expect(raw).toBe(serializeSchemaMetaStamp(stamp!))
      expect(stamp!.schemaVersion).toBe(2)
      expect(stamp!.version).toBe(2)
      expect(stamp!.store).toBe(store)
    }
  })

  it('openTeamDomain re-opens a closed domain and hands out all nine repositories', () => {
    expect(reopenedName).toBe(TEAM_DOMAIN_NAME)
    expect(reopenedStampCount).toBe(9)
    expect(reopenedStoreSizes.length).toBe(8)
    for (const [, size] of reopenedStoreSizes) {
      expect(size).toBe(0)
    }
  })

  it('L1: a domain persisted at version 3 is rejected at open with SCHEMA_VERSION_MISMATCH', () => {
    expect(l1Mismatch.ok).toBe(false)
    const error = asTeamDomainError(l1Mismatch.error)
    expect(error.code).toBe('SCHEMA_VERSION_MISMATCH')
    expect(detail(error, 'expected')).toBe(2)
    expect(detail(error, 'found')).toBe(3)
    expect(detail(error, 'seamCode')).toBe('version-mismatch')
  })

  it('L1 (plan BP2): a v1 MEDIUM under a v2 open is rejected loud (no migration, ever)', () => {
    expect(v1Mismatch.ok).toBe(false)
    const error = asTeamDomainError(v1Mismatch.error)
    expect(error.code).toBe('SCHEMA_VERSION_MISMATCH')
    expect(detail(error, 'expected')).toBe(2)
    expect(detail(error, 'found')).toBe(1)
    expect(detail(error, 'seamCode')).toBe('version-mismatch')
  })

  it('createTeamDomain on an already stamped domain raises TEAM_DOMAIN_EXISTS', () => {
    expect(createAgain.ok).toBe(false)
    const error = asTeamDomainError(createAgain.error)
    expect(error.code).toBe('TEAM_DOMAIN_EXISTS')
    expect(detail(error, 'store')).toBe('schema_meta')
    expect(detail(error, 'size')).toBe(9)
  })

  it('openTeamDomain on an empty seam raises SCHEMA_STAMP_MISSING for the first store', () => {
    expect(emptyOpen.ok).toBe(false)
    const error = asTeamDomainError(emptyOpen.error)
    expect(error.code).toBe('SCHEMA_STAMP_MISSING')
    expect(detail(error, 'store')).toBe('schema_meta')
    expect(detail(error, 'expected')).toBe(2)
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
    expect(detail(error, 'expected')).toBe(2)
    expect(detail(error, 'found')).toBe(3)
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
      parseSchemaMetaStamp({ schemaVersion: 2, store: 'ledger', stampedAt: '2026-08-29T12:00:00Z', version: 2, extra: 1 }),
    ).toThrow()
    expect(() => parseSchemaMetaStamp({ store: 'ledger', stampedAt: '2026-08-29T12:00:00Z', version: 2 })).toThrow()
  })

  it('the version policy accepts only the supported version and fails loudly otherwise', () => {
    expect(assertSupportedTeamDomainSchemaVersion(2, 'ledger')).toBe(2)
    expect(() => assertSupportedTeamDomainSchemaVersion(1, 'ledger')).toThrow()
    expect(isSupportedTeamDomainSchemaVersion(2)).toBe(true)
    expect(isSupportedTeamDomainSchemaVersion(1)).toBe(false)
  })
})
