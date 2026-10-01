/**
 * a3p1-team-domain-tenth-store — the Alpha.3 PR1 PermissionOverlay store is
 * the TENTH store of the existing `team_domain`, added ADDITIVELY at schema
 * version 2 (no version bump, no migration, no world reset).
 *
 * WHY ADDITIVE (and why the earlier v2→v3 plan was withdrawn): the pinned
 * upstream backend treats a same-version table-set GROWTH as additive and
 * initializes a declared-but-missing table EMPTY. That is upstream source, at
 * the pinned baseline `46a7f68b0922371ce7144b668b90e377d8e799f4`:
 *  - storage-json  https://github.com/deepseek-ai/deepseek-harness/blob/46a7f68b0922371ce7144b668b90e377d8e799f4/packages/storage/storage-json/src/format.ts#L77-L85
 *    (`records === undefined` → `state.tables.set(table, new Map())`)
 *  - storage-sqlite https://github.com/deepseek-ai/deepseek-harness/blob/46a7f68b0922371ce7144b668b90e377d8e799f4/packages/storage/storage-sqlite/src/index.ts#L110-L131
 *    (`CREATE TABLE IF NOT EXISTS` per declared table, same version)
 * The `malformed-medium` rejection this repo used to reason from came from
 * this repo's STRICTER test seam double, not from the backend; the double is
 * aligned to upstream by this batch (see
 * `a3p1-seam-additive-tables.test.ts`), and its corruption rejections stay
 * strict.
 *
 * WHAT THIS SPEC PINS:
 *  1. placement: `permission_overlays` is the tenth declared store, appended
 *     last in canonical order, and `TEAM_DOMAIN_SCHEMA_VERSION` is UNCHANGED;
 *  2. the compatibility open: a stamped nine-store v2 medium opens under the
 *     tenth-store spec, the nine existing tables stay BYTE-IDENTICAL, the new
 *     table is empty and gets exactly one L2 stamp row;
 *  3. idempotence: the stamp bootstrap happens once; a later open writes
 *     nothing at all;
 *  4. the strictness that must SURVIVE the alignment: a non-empty un-stamped
 *     new table, a missing/foreign pre-existing stamp, a foreign domain
 *     version, and an undeclared or missing table file all still fail loudly
 *     with zero writes (a partial or corrupt domain is never "fresh");
 *  5. the overlay store itself now lives on `team_domain`'s tenth table and
 *     keeps its append/restart semantics.
 *
 * Everything runs on the real file-backed seam double over a scratch dir:
 * no host, no port, no model, no network, no user world.
 *
 * @module @dsh-agent-team/testkit/test/a3p1-team-domain-tenth-store
 */

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { FileStorageSeam, copyFixtureIntoScratch, destroyDir, readText, scratchDir, writeText } from '../fault-injection/file-seam.mjs'
import { createTeamDomain, createOrOpenTeamDomain, openTeamDomain } from '../../storage/repositories/index.js'
import { openPermissionOverlayStore } from '../../storage/repositories/permission-overlays.js'
import {
  SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS,
  TEAM_DOMAIN_NAME,
  TEAM_DOMAIN_SCHEMA_VERSION,
  TEAM_DOMAIN_STORES,
  createSchemaMetaStamp,
  createTeamDomainSeamSpec,
  serializeSchemaMetaStamp,
} from '../../storage/schema/index.js'
import { snapshotInput } from '../../runtime/test/permission-overlay-helpers.js'

/** The nine stores that existed before Alpha.3 (inline on purpose: this spec
 * must be able to describe a PRE-existing world without importing the list it
 * is testing). */
const NINE_STORE_V2_TABLES = [
  'schema_meta',
  'team_sessions',
  'member_instances',
  'session_bindings',
  'overrides',
  'compatibility',
  'operations',
  'ledger',
  'blueprint_registry',
] as const

/** The tenth store, written literally here (the placement under test). */
const TENTH_STORE = 'permission_overlays'

/** Every durable file of a world, keyed by path relative to its root. */
function treeSnapshot(root: string): Record<string, string> {
  const files: Record<string, string> = {}
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), rel)
      } else if (entry.isFile()) {
        files[rel] = readText(join(dir, entry.name))
      }
    }
  }
  walk(root, '')
  return files
}

/**
 * The parsed rows of one durable table file. A table the world never wrote
 * has no file yet (the seam materializes an additive table on its first
 * write, like upstream), which reads as an empty row set.
 */
function rawTable(dir: string, table: string): Record<string, string> {
  const path = join(dir, TEAM_DOMAIN_NAME, `${table}.json`)
  if (!existsSync(path)) return {}
  return JSON.parse(readText(path)) as Record<string, string>
}

/** The committed nine-store v2 world, copied into a scratch dir. */
function legacyWorld(basename: string): string {
  const dir = scratchDir(basename)
  destroyDir(dir)
  return copyFixtureIntoScratch('committed-world', basename)
}

/** Run `fn`, capturing success or the thrown error. */
/** The outcome of a call expected to reject (or resolve) — recorded, not thrown. */
type Captured<T> = { ok: true; value: T } | { ok: false; error: unknown }

/** The rejection of a captured call; a resolved call fails the test loudly. */
function failureOf<T>(result: Captured<T>): unknown {
  if (result.ok) throw new Error('expected the call to reject, but it resolved')
  return result.error
}

async function capture<T>(fn: () => Promise<T>): Promise<Captured<T>> {
  try {
    return { ok: true, value: await fn() }
  } catch (error) {
    return { ok: false, error }
  }
}

function codeOf(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined
}

function detailOf(error: unknown): Record<string, unknown> | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const candidate = error as { details?: unknown; detail?: unknown }
  const value = candidate['details'] ?? candidate['detail']
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined
}

describe('a3p1 — the overlay store is the tenth TeamDomain store, added additively at v2', () => {
  it('declares permission_overlays as the tenth store, appended last, with the schema version UNCHANGED', () => {
    expect(TEAM_DOMAIN_SCHEMA_VERSION).toBe(2)
    expect(SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS).toEqual([2])
    expect(TEAM_DOMAIN_STORES.length).toBe(10)
    expect(TEAM_DOMAIN_STORES[9]).toBe(TENTH_STORE)
    // the nine pre-existing stores keep their exact canonical positions
    expect(TEAM_DOMAIN_STORES.slice(0, 9)).toEqual([...NINE_STORE_V2_TABLES])
    expect(createTeamDomainSeamSpec().tables).toEqual([...TEAM_DOMAIN_STORES])
    expect(createTeamDomainSeamSpec().version).toBe(2)
  })

  it('opens a stamped nine-store v2 medium under the tenth-store spec: nine tables byte-identical, the new table empty and stamped', async () => {
    const dir = legacyWorld('a3p1-tenth-compat-open')
    const before = treeSnapshot(dir)
    expect(Object.keys(rawTable(dir, 'schema_meta')).length).toBe(9) // a genuine nine-store world

    const domain = await openTeamDomain(new FileStorageSeam(dir))
    const openSucceeded = domain !== undefined
    await domain.close()

    expect(openSucceeded).toBe(true)
    // (1) every pre-existing table keeps its exact bytes except schema_meta,
    //     which gains exactly one row…
    for (const table of NINE_STORE_V2_TABLES.filter((store) => store !== 'schema_meta')) {
      expect(readText(join(dir, TEAM_DOMAIN_NAME, `${table}.json`))).toBe(before[`team_domain/${table}.json`]!)
    }
    const stampsAfter = rawTable(dir, 'schema_meta')
    const stampsBefore = JSON.parse(before['team_domain/schema_meta.json']!) as Record<string, string>
    const added = Object.keys(stampsAfter).filter((key) => !(key in stampsBefore))
    expect(added).toEqual([TENTH_STORE])
    // …the nine pre-existing stamp rows are byte-identical…
    for (const store of NINE_STORE_V2_TABLES) {
      expect(stampsAfter[store]).toBe(stampsBefore[store]!)
    }
    // …and the new row is a canonical v2 stamp, the same shape the nine
    // pre-existing rows carry.
    const tenthStamp = JSON.parse(stampsAfter[TENTH_STORE] as string) as Record<string, unknown>
    expect(tenthStamp).toMatchObject({
      store: TENTH_STORE,
      version: TEAM_DOMAIN_SCHEMA_VERSION,
      schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
    })
    expect(stampsAfter[TENTH_STORE]).toBe(
      serializeSchemaMetaStamp(
        createSchemaMetaStamp(TENTH_STORE as (typeof TEAM_DOMAIN_STORES)[number], String(tenthStamp['stampedAt'])),
      ),
    )
    // (2) the new store cost NO write of its own: opening a medium that
    //     predates a declared store initializes nothing on disk (upstream
    //     materializes the empty table in memory and serializes the unit on
    //     the first write), so the only new bytes are that one stamp row.
    expect(readdirSync(join(dir, TEAM_DOMAIN_NAME)).sort()).toEqual(
      [...NINE_STORE_V2_TABLES].map((store) => `${store}.json`).sort(),
    )
    // (3) the L1 domain stamp is untouched: still v2, no migration.
    expect(readText(join(dir, `${TEAM_DOMAIN_NAME}.meta.json`))).toBe(before[`${TEAM_DOMAIN_NAME}.meta.json`])
  })

  it('bootstraps the new stamp exactly once — a reopen after the bootstrap writes nothing at all', async () => {
    const dir = legacyWorld('a3p1-tenth-idempotent')
    const opened = await openTeamDomain(new FileStorageSeam(dir))
    await opened.close()
    const afterBootstrap = treeSnapshot(dir)

    const reopened = await openTeamDomain(new FileStorageSeam(dir))
    await reopened.close()

    expect(treeSnapshot(dir)).toEqual(afterBootstrap)
    expect(Object.keys(rawTable(dir, 'schema_meta')).length).toBe(10)
  })

  it('createOrOpenTeamDomain (the production boot entry) adopts a nine-store medium the same way', async () => {
    const dir = legacyWorld('a3p1-tenth-create-or-open')
    const before = treeSnapshot(dir)

    const outcome = await capture(() => createOrOpenTeamDomain(new FileStorageSeam(dir)))

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.value.name).toBe(TEAM_DOMAIN_NAME)
    await outcome.value.close()
    expect(rawTable(dir, TENTH_STORE)).toEqual({})
    // the nine data tables are untouched; only schema_meta gains one row
    expect(readText(join(dir, TEAM_DOMAIN_NAME, 'team_sessions.json'))).toBe(before['team_domain/team_sessions.json'])
    expect(readText(join(dir, TEAM_DOMAIN_NAME, 'ledger.json'))).toBe(before['team_domain/ledger.json'])
    const stamps = Object.keys(rawTable(dir, 'schema_meta'))
    expect(stamps.length).toBe(10)
    expect(stamps).toContain(TENTH_STORE)
  })

  it('a FRESH medium is stamped across all ten stores in canonical order', async () => {
    const dir = scratchDir('a3p1-tenth-fresh-create')
    destroyDir(dir)

    const domain = await createTeamDomain(new FileStorageSeam(dir))
    const stamped = Object.keys(rawTable(dir, 'schema_meta'))
    await domain.close()

    expect(stamped).toEqual([...TEAM_DOMAIN_STORES]) // canonical create order, tenth store last
    expect(rawTable(dir, TENTH_STORE)).toEqual({})
  })

  it('does NOT treat a non-empty un-stamped permission_overlays table as fresh: SCHEMA_STAMP_MISSING, zero writes', async () => {
    const dir = legacyWorld('a3p1-tenth-rows-without-stamp')
    // corruption: the new table already carries data but no L2 stamp row.
    writeText(join(dir, TEAM_DOMAIN_NAME, `${TENTH_STORE}.json`), JSON.stringify({ 'session-root-1#inst-alpha#1': 'GARBAGE' }))
    const before = treeSnapshot(dir)

    const outcome = await capture(() => openTeamDomain(new FileStorageSeam(dir)))

    expect(outcome.ok).toBe(false)
    expect(codeOf(failureOf(outcome))).toBe('SCHEMA_STAMP_MISSING')
    expect(detailOf(failureOf(outcome))?.['store']).toBe(TENTH_STORE)
    // nothing was repaired, deleted, or overwritten
    expect(treeSnapshot(dir)).toEqual(before)
  })

  it('never masks a pre-existing stamp problem: the exact missing store is still named (zero writes)', async () => {
    const dir = legacyWorld('a3p1-tenth-old-stamp-missing')
    const stamps = rawTable(dir, 'schema_meta')
    delete stamps['ledger']
    writeText(join(dir, TEAM_DOMAIN_NAME, 'schema_meta.json'), JSON.stringify(stamps))
    const before = treeSnapshot(dir)

    const outcome = await capture(() => openTeamDomain(new FileStorageSeam(dir)))

    expect(outcome.ok).toBe(false)
    expect(codeOf(failureOf(outcome))).toBe('SCHEMA_STAMP_MISSING')
    expect(detailOf(failureOf(outcome))?.['store']).toBe('ledger')
    expect(treeSnapshot(dir)).toEqual(before)
  })

  it('still rejects tampered versions: an L2 stamp at a foreign version and an L1 domain at a foreign version', async () => {
    const stampWorld = legacyWorld('a3p1-tenth-stamp-tampered')
    const stamps = rawTable(stampWorld, 'schema_meta')
    // a tampered L2 stamp: the canonical row bytes, with the version raised
    stamps['ledger'] = (stamps['ledger'] as string).replace('"version":2', '"version":3')
    writeText(join(stampWorld, TEAM_DOMAIN_NAME, 'schema_meta.json'), JSON.stringify(stamps))
    const l2 = await capture(() => openTeamDomain(new FileStorageSeam(stampWorld)))
    expect(codeOf(failureOf(l2))).toBe('SCHEMA_STAMP_MISMATCH')
    expect(detailOf(failureOf(l2))?.['store']).toBe('ledger')
    expect(detailOf(failureOf(l2))?.['found']).toBe(3)

    const metaWorld = legacyWorld('a3p1-tenth-meta-tampered')
    writeText(join(metaWorld, `${TEAM_DOMAIN_NAME}.meta.json`), '{"version":3}')
    const before = treeSnapshot(metaWorld)
    const l1 = await capture(() => openTeamDomain(new FileStorageSeam(metaWorld)))
    expect(codeOf(failureOf(l1))).toBe('SCHEMA_VERSION_MISMATCH')
    expect(detailOf(failureOf(l1))?.['found']).toBe(3)
    // a foreign-version medium is never migrated and never touched
    expect(treeSnapshot(metaWorld)).toEqual(before)
  })

  it('keeps the seam strict where upstream is silent: an undeclared table file and a MISSING pre-existing table file both stay malformed-medium', async () => {
    const ghostWorld = legacyWorld('a3p1-tenth-undeclared-file')
    writeText(join(ghostWorld, TEAM_DOMAIN_NAME, 'ghost_table.json'), '{}')
    const ghost = await capture(() => openTeamDomain(new FileStorageSeam(ghostWorld)))
    expect(codeOf(failureOf(ghost))).toBe('SEAM_FAILURE')
    expect(detailOf(failureOf(ghost))?.['seamCode']).toBe('malformed-medium')

    // a pre-existing store's file is NEVER lazily recreated: an old table
    // whose file vanished is corruption (upstream would silently hand back an
    // empty table and rewrite it — the double refuses instead).
    const missingWorld = legacyWorld('a3p1-tenth-missing-old-table')
    writeText(join(missingWorld, TEAM_DOMAIN_NAME, 'team_sessions.json'), '')
    const missing = await capture(() => openTeamDomain(new FileStorageSeam(missingWorld)))
    expect(codeOf(failureOf(missing))).toBe('SEAM_FAILURE')
    expect(detailOf(failureOf(missing))?.['seamCode']).toBe('malformed-medium')
  })

  it('appends onto team_domain/permission_overlays.json and survives a restart', async () => {
    const dir = scratchDir('a3p1-tenth-overlay-append')
    destroyDir(dir)

    const first = await openPermissionOverlayStore(new FileStorageSeam(dir))
    expect(first.name).toBe(TEAM_DOMAIN_NAME)
    expect(first.schemaVersion).toBe(TEAM_DOMAIN_SCHEMA_VERSION)
    await first.repository.append(snapshotInput(1))
    await first.repository.append(snapshotInput(2))
    expect(first.repository.latest('session-root-1', 'inst-alpha')?.metadata.generation).toBe(2)
    await first.close()

    // the rows are durable IN the team_domain tenth table (not a separate domain)
    expect(Object.keys(rawTable(dir, TENTH_STORE))).toEqual(['session-root-1#inst-alpha#1', 'session-root-1#inst-alpha#2'])

    const reopened = await openPermissionOverlayStore(new FileStorageSeam(dir))
    expect(reopened.repository.history('session-root-1', 'inst-alpha').map((s) => s.metadata.generation)).toEqual([1, 2])
    await reopened.close()

    // and the domain it opened is a complete ten-store TeamDomain
    expect(Object.keys(rawTable(dir, 'schema_meta')).length).toBe(10)
  })
})
