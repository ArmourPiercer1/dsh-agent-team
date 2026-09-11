/**
 * bp1-blueprint-registry — the `blueprint_registry` store (TeamDomain v2,
 * issue #2 blueprint-loading parallel repair, plan BP2): the durable,
 * append-only registry of frozen Blueprint snapshot identities.
 *
 * Proves the BP2 contract over an in-memory seam:
 *
 * - `freeze` APPENDS an absent identity (one durable write) and stores the
 *   IMMUTABLE SOURCE TEXT (not just the hash — the runtime authority for a
 *   frozen revision whose source file was deleted);
 * - an identical `freeze` (same identity, same contentHash) is IDEMPOTENT
 *   (the stored row is returned, no extra write);
 * - a `freeze` with a DIFFERENT contentHash for a frozen identity fails
 *   LOUD with `RECORD_DUPLICATE` (problem `blueprint-revision-frozen`)
 *   naming BOTH hashes — never last-write-wins;
 * - `get`/`list` round-trip the canonical rows (`list` sorted by the
 *   `blueprintId@revision` key; `get` on an absent identity → undefined);
 * - malformed identities and malformed stored rows fail typed (the
 *   contracts id codes are preserved through `normalizeValidationError`);
 * - the row key agrees with the contracts `blueprintSnapshotKey` display
 *   form (`AIUED-ALGO@17`) and round-trips through
 *   `parseBlueprintSnapshotKey`;
 * - the repository surface is read + freeze ONLY (no put/update/delete/
 *   unfreeze/replace — the base write primitives stay private).
 *
 * The record `schemaVersion` follows the TeamDomain L3 row-stamp
 * discipline (every storage-level row carries the domain schema version
 * that shaped it): v2 rows carry `2`, and a row stamped `1` is rejected —
 * the same loud-fail behavior as the other six storage-level record types.
 *
 * Top-level-await pattern; the `it` bodies are synchronous; only the
 * plain-node shim matchers (toBe / toEqual / toThrow, + .not) are used.
 *
 * @module @dsh-agent-team/storage/test/bp1-blueprint-registry
 */

import { describe, expect, it } from 'vitest'

import {
  blueprintSnapshotKey,
  createBlueprintSnapshotRef,
  isTeamContractError,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseBlueprintSnapshotKey,
} from '../../contracts/src/index.js'
import { TEAM_DOMAIN_NAME } from '../schema/index.js'
import {
  blueprintRegistryKey,
  createBlueprintRegistryRecord,
  parseBlueprintRegistryRecord,
  serializeBlueprintRegistryRecord,
} from '../schema/index.js'
import { createTeamDomain } from '../repositories/index.js'
import { InMemoryStorageSeam, asTeamDomainError, capture, detail } from './p4-helpers.js'

const BP_ALPHA = parseBlueprintId('bp-alpha')
const BP_BETA = parseBlueprintId('bp-beta')
const REV_1 = parseBlueprintRevision('1')
const REV_2 = parseBlueprintRevision('2')
const HASH_A = parseBlueprintContentHash('sha256-' + 'a'.repeat(32))
const HASH_B = parseBlueprintContentHash('sha256-' + 'b'.repeat(32))
const SOURCE_A = '---\nblueprintId: bp-alpha\nrevision: "1"\n---\nalpha source text v1\n'
const SOURCE_B = '---\nblueprintId: bp-alpha\nrevision: "1"\n---\nalpha source text v1 (tampered)\n'
const FROZEN_AT = '2026-08-29T12:00:00Z'

/* ---- world 1: the append / idempotency / conflict surface ------------- */

const seam = new InMemoryStorageSeam()
const domain = await createTeamDomain(seam)
const registry = domain.repositories.blueprintRegistry

const rAlpha1 = await registry.freeze({
  blueprintId: String(BP_ALPHA),
  revision: String(REV_1),
  contentHash: String(HASH_A),
  source: SOURCE_A,
  frozenAt: FROZEN_AT,
})
const writesAfterAppend = seam.writeLog.length

const idem = await capture(() =>
  registry.freeze({
    blueprintId: String(BP_ALPHA),
    revision: String(REV_1),
    contentHash: String(HASH_A),
    source: SOURCE_A,
    frozenAt: FROZEN_AT,
  }),
)
const writesAfterIdem = seam.writeLog.length

const conflict = await capture(() =>
  registry.freeze({
    blueprintId: String(BP_ALPHA),
    revision: String(REV_1),
    contentHash: String(HASH_B),
    source: SOURCE_B,
    frozenAt: FROZEN_AT,
  }),
)

const rAlpha2 = await registry.freeze({
  blueprintId: String(BP_ALPHA),
  revision: String(REV_2),
  contentHash: String(HASH_A),
  source: SOURCE_A,
  frozenAt: FROZEN_AT,
})
const rBeta1 = await registry.freeze({
  blueprintId: String(BP_BETA),
  revision: String(REV_1),
  contentHash: String(HASH_B),
  source: SOURCE_A,
  frozenAt: FROZEN_AT,
})

const listed = registry.list()
const gotAlpha1 = registry.get(String(BP_ALPHA), String(REV_1))
const gotAbsent = registry.get('bp-zeta', String(REV_1))

const badIdGet = await capture(() => registry.get('bad id', String(REV_1)))
const badRevGet = await capture(() => registry.get(String(BP_ALPHA), 'at@sign'))

const raw = seam.rawRows(TEAM_DOMAIN_NAME, 'blueprint_registry')
const storedRaw = raw.get(blueprintRegistryKey(String(BP_ALPHA), String(REV_1)))

/* ---- world 2: malformed rows, parse-level rejections, no write surface - */

const seam2 = new InMemoryStorageSeam()
const domain2 = await createTeamDomain(seam2)
const registry2 = domain2.repositories.blueprintRegistry

const baseInput = {
  blueprintId: String(BP_ALPHA),
  revision: String(REV_1),
  contentHash: String(HASH_A),
  source: SOURCE_A,
  frozenAt: FROZEN_AT,
}

const baseRecord = createBlueprintRegistryRecord(baseInput)

const badVersion = await capture(() =>
  parseBlueprintRegistryRecord({ ...baseRecord, schemaVersion: 1 }),
)
const unknownField = await capture(() => parseBlueprintRegistryRecord({ ...baseRecord, extra: 'x' }))
const missingField = await capture(() => {
  const { frozenAt: _drop, ...rest } = baseRecord
  return parseBlueprintRegistryRecord(rest)
})
const legacyField = await capture(() => parseBlueprintRegistryRecord({ ...baseRecord, memberId: 'm-1' }))
const emptySource = await capture(() => createBlueprintRegistryRecord({ ...baseInput, source: '' }))
const badHash = await capture(() => registry2.freeze({ ...baseInput, contentHash: 'has space' }))

// a stored row with the wrong domain stamp must fail the READ loudly
const raw2 = seam2.rawRows(TEAM_DOMAIN_NAME, 'blueprint_registry')
raw2.set(blueprintRegistryKey(String(BP_ALPHA), String(REV_1)), serializeBlueprintRegistryRecord({ ...baseRecord, schemaVersion: 1 }))
const badStampRead = await capture(() => registry2.get(String(BP_ALPHA), String(REV_1)))

const noPut = typeof (registry2 as unknown as { put?: unknown }).put
const noUpdate = typeof (registry2 as unknown as { update?: unknown }).update
const noDelete = typeof (registry2 as unknown as { delete?: unknown }).delete
const noUnfreeze = typeof (registry2 as unknown as { unfreeze?: unknown }).unfreeze

describe('bp1 blueprint_registry store (TeamDomain v2)', () => {
  it('freeze appends an absent identity with the immutable source text (one durable write)', () => {
    expect(rAlpha1.schemaVersion).toBe(2)
    expect(rAlpha1.blueprintId).toBe(String(BP_ALPHA))
    expect(rAlpha1.revision).toBe(String(REV_1))
    expect(rAlpha1.contentHash).toBe(String(HASH_A))
    expect(rAlpha1.source).toBe(SOURCE_A)
    expect(rAlpha1.frozenAt).toBe(FROZEN_AT)
    expect(Object.isFrozen(rAlpha1)).toBe(true)
    expect(writesAfterAppend - 9).toBe(1) // 9 = the v2 schema_meta stamp writes
    expect(storedRaw).toBe(serializeBlueprintRegistryRecord(rAlpha1))
  })

  it('an identical freeze is an idempotent no-op returning the STORED row (no extra write)', () => {
    expect(idem.ok).toBe(true)
    expect(writesAfterIdem).toBe(writesAfterAppend)
    if (!idem.ok) return
    expect(idem.value).toEqual(rAlpha1)
    expect(Object.isFrozen(idem.value)).toBe(true)
  })

  it('a different contentHash for a frozen identity fails LOUD (RECORD_DUPLICATE, blueprint-revision-frozen, both hashes)', () => {
    expect(conflict.ok).toBe(false)
    if (conflict.ok) return
    const error = asTeamDomainError(conflict.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'problem')).toBe('blueprint-revision-frozen')
    expect(detail(error, 'store')).toBe('blueprint_registry')
    expect(detail(error, 'key')).toBe(blueprintRegistryKey(String(BP_ALPHA), String(REV_1)))
    expect(detail(error, 'expectedContentHash')).toBe(String(HASH_B))
    expect(detail(error, 'foundContentHash')).toBe(String(HASH_A))
    // the stored row is untouched (crash rule: the frozen row stays)
    expect(registry.get(String(BP_ALPHA), String(REV_1))?.contentHash).toBe(String(HASH_A))
  })

  it('a new revision of the same blueprint is a NEW row (never a rewrite)', () => {
    expect(rAlpha2.blueprintId).toBe(String(BP_ALPHA))
    expect(rAlpha2.revision).toBe(String(REV_2))
    expect(listed.map((record) => blueprintRegistryKey(record.blueprintId, record.revision))).toEqual([
      'bp-alpha@1',
      'bp-alpha@2',
      'bp-beta@1',
    ])
  })

  it('get returns the stored record; an absent identity returns undefined', () => {
    expect(gotAlpha1).toEqual(rAlpha1)
    expect(gotAbsent).toBe(undefined)
  })

  it('list returns the frozen records sorted by the row key (byte order)', () => {
    expect(listed).toEqual([rAlpha1, rAlpha2, rBeta1])
  })

  it('malformed identities fail typed (contracts codes preserved)', () => {
    expect(badIdGet.ok).toBe(false)
    if (!badIdGet.ok) expect(asTeamDomainError(badIdGet.error).code).toBe('RECORD_INVALID')
    expect(badRevGet.ok).toBe(false)
    if (!badRevGet.ok) expect(asTeamDomainError(badRevGet.error).code).toBe('RECORD_INVALID')
  })

  it('the row key agrees with the contracts snapshot display key and round-trips', () => {
    const ref = createBlueprintSnapshotRef({ blueprintId: BP_ALPHA, revision: REV_1, contentHash: HASH_A })
    expect(blueprintRegistryKey(String(BP_ALPHA), String(REV_1))).toBe(blueprintSnapshotKey(ref))
    expect(parseBlueprintSnapshotKey(blueprintRegistryKey(String(BP_ALPHA), String(REV_1)))).toEqual({
      blueprintId: String(BP_ALPHA),
      revision: String(REV_1),
    })
  })

  it('a row stamped at the wrong domain version is rejected by the read (L3 discipline, loud)', () => {
    expect(badVersion.ok).toBe(false)
    if (!badVersion.ok) {
      const error = asTeamDomainError(badVersion.error)
      expect(error.code).toBe('RECORD_INVALID')
      expect(detail(error, 'field')).toBe('schemaVersion')
    }
    expect(badStampRead.ok).toBe(false)
    if (!badStampRead.ok) expect(asTeamDomainError(badStampRead.error).code).toBe('RECORD_INVALID')
  })

  it('parse-level rejections: unknown / missing / legacy fields (the pure module throws contracts errors; the repository boundary normalizes them to RECORD_INVALID)', () => {
    expect(unknownField.ok).toBe(false)
    expect(missingField.ok).toBe(false)
    expect(legacyField.ok).toBe(false)
    if (!unknownField.ok) {
      expect(isTeamContractError(unknownField.error)).toBe(true)
      if (isTeamContractError(unknownField.error)) expect(unknownField.error.code).toBe('MALFORMED_DTO')
    }
    if (!missingField.ok) {
      expect(isTeamContractError(missingField.error)).toBe(true)
      if (isTeamContractError(missingField.error)) expect(missingField.error.code).toBe('MALFORMED_DTO')
    }
    if (!legacyField.ok) {
      expect(isTeamContractError(legacyField.error)).toBe(true)
      if (isTeamContractError(legacyField.error)) expect(legacyField.error.code).toBe('LEGACY_MEMBER_ID_REJECTED')
    }
  })

  it('an empty source and a malformed content hash fail typed at the boundary', () => {
    expect(emptySource.ok).toBe(false)
    if (!emptySource.ok) {
      const error = asTeamDomainError(emptySource.error)
      expect(error.code).toBe('RECORD_INVALID')
      expect(detail(error, 'problem')).toBe('empty-or-non-string-source')
    }
    expect(badHash.ok).toBe(false)
    if (!badHash.ok) expect(asTeamDomainError(badHash.error).code).toBe('RECORD_INVALID')
  })

  it('the repository surface is read + freeze ONLY (no put/update/delete/unfreeze)', () => {
    expect(noPut).toBe('undefined')
    expect(noUpdate).toBe('undefined')
    expect(noDelete).toBe('undefined')
    expect(noUnfreeze).toBe('undefined')
    expect(domain.repositories.blueprintRegistry === registry).toBe(true)
  })
})
