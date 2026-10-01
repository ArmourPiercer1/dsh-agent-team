/**
 * a3p1-seam-additive-tables — the SANCTIONED test seam doubles now match the
 * pinned upstream behavior for a SAME-VERSION table-set ADDITION.
 *
 * Upstream at the pinned baseline `46a7f68b0922371ce7144b668b90e377d8e799f4`
 * treats a same-version table-set growth as additive:
 *  - storage-json `format.ts` L77-85 — while iterating the DECLARED tables, a
 *    table absent from the persisted document becomes an EMPTY table
 *    (`records === undefined → state.tables.set(table, new Map())`); there is
 *    no table-set equality check anywhere in the backend:
 *    https://github.com/deepseek-ai/deepseek-harness/blob/46a7f68b0922371ce7144b668b90e377d8e799f4/packages/storage/storage-json/src/format.ts#L77-L85
 *  - storage-sqlite `index.ts` L110-131 — every declared table is opened with
 *    `CREATE TABLE IF NOT EXISTS`, inside one version:
 *    https://github.com/deepseek-ai/deepseek-harness/blob/46a7f68b0922371ce7144b668b90e377d8e799f4/packages/storage/storage-sqlite/src/index.ts#L110-L131
 *
 * This repo's two seam doubles were STRICTER: the file-backed double rejected
 * a declared table whose file was absent (`malformed-medium`) and the
 * in-memory fake rejected ANY table-set change at the same version. That
 * divergence — not the backend — is what an earlier design round reasoned
 * from, so the doubles are aligned here.
 *
 * THE ALIGNED RULE (both doubles, documented in their own headers):
 *
 *   A same-version table-set change is legal exactly when the persisted
 *   table set is a canonical PREFIX of the declared set. The missing trailing
 *   tables are initialized EMPTY (infrastructure, not a KvTable durable
 *   write). Anything else — an undeclared/ghost table file, a HOLE in the
 *   prefix (a store whose file vanished), a removed table, a foreign
 *   version — stays `malformed-medium` / `version-mismatch`.
 *
 * Why the prefix condition is kept instead of upstream's total silence: the
 * doubles store ONE FILE PER TABLE, so "one table vanished" is a corruption
 * this layout CAN express while the real per-document/per-database layout
 * cannot. Upstream has no signal to reject it with; the doubles do, and the
 * canonical-order law (a same-version additive store is appended LAST — the
 * `blueprint_registry` precedent) is exactly what distinguishes a legal
 * addition from a hole. This retained strictness is a documented deviation,
 * not a claim about upstream.
 *
 * @module @dsh-agent-team/testkit/test/a3p1-seam-additive-tables
 */

import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { FileStorageSeam, destroyDir, readText, scratchDir, writeText } from '../fault-injection/file-seam.mjs'
import { InMemoryStorageSeam } from '../../storage/test/p4-helpers.js'
import { TEAM_DOMAIN_NAME, TEAM_DOMAIN_SCHEMA_VERSION, createTeamDomainSeamSpec } from '../../storage/schema/index.js'

/** The nine pre-existing stores, inline (this spec describes a pre-existing world). */
const NINE = [
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

const TENTH = 'permission_overlays'

const TEN_TABLE_SPEC = createTeamDomainSeamSpec()

/** The nine-table spec of the world BEFORE the additive store existed. */
function nineTableSpec(): { name: string; version: number; tables: string[] } {
  return { name: TEAM_DOMAIN_NAME, version: TEAM_DOMAIN_SCHEMA_VERSION, tables: [...NINE] }
}

/** A scratch dir holding a nine-table v2 domain with one row in one store. */
function nineTableWorld(basename: string): string {
  const dir = scratchDir(basename)
  destroyDir(dir)
  writeText(join(dir, `${TEAM_DOMAIN_NAME}.meta.json`), JSON.stringify({ version: TEAM_DOMAIN_SCHEMA_VERSION }))
  for (const table of NINE) {
    writeText(join(dir, TEAM_DOMAIN_NAME, `${table}.json`), table === 'team_sessions' ? '{"session-root-1":"row"}' : '{}')
  }
  return dir
}

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
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : undefined
}

describe('a3p1 — the seam doubles accept a same-version additive table, like upstream does', () => {
  it('file seam: a declared-but-absent TRAILING table opens as an empty table instead of malformed-medium, at zero write cost', async () => {
    const dir = nineTableWorld('a3p1-seam-add-trailing')
    const seam = new FileStorageSeam(dir)

    const handle = await seam.open(TEN_TABLE_SPEC)

    expect(handle.table(TENTH).size).toBe(0)
    expect(handle.table('team_sessions').get('session-root-1')).toBe('row')
    // Upstream fidelity: the empty table lives in the unit state; the medium
    // is serialized when something is WRITTEN. So the addition alone put no
    // file on disk and counted no durable write.
    expect(readdirSync(join(dir, TEAM_DOMAIN_NAME))).not.toContain(`${TENTH}.json`)
    expect(seam.writeCount).toBe(0)

    await handle.table(TENTH).put('k', 'v')
    await handle.close()
    expect(JSON.parse(readText(join(dir, TEAM_DOMAIN_NAME, `${TENTH}.json`)))).toEqual({ k: 'v' })
    expect(existsSync(join(dir, TEAM_DOMAIN_NAME, `${TENTH}.json`))).toBe(true)
  })

  it('file seam: the lazy table initialization is NOT a durable KvTable write (crash-injection write bases are unchanged)', async () => {
    const dir = nineTableWorld('a3p1-seam-add-not-a-write')
    const seam = new FileStorageSeam(dir)
    const handle = await seam.open(TEN_TABLE_SPEC)
    expect(seam.writeCount).toBe(0)

    seam.armCrashAfterWrites(1)
    await handle.table('overrides').put('k', 'v') // the first durable write commits
    const committed = await capture(async () => {
      await handle.table('overrides').put('k2', 'v2')
    })
    expect(committed.ok).toBe(false)
    expect(seam.writeCount).toBe(1)
    seam.clearCrash()
    await handle.close()
  })

  it('file seam: a HOLE in the canonical prefix is still malformed-medium (never lazily recreated)', async () => {
    const dir = nineTableWorld('a3p1-seam-prefix-hole')
    // `team_sessions` sits in the MIDDLE of the canonical order: its file
    // vanishing is a lost store, never an additive upgrade, so the seam must
    // not hand back an empty table for it.
    rmSync(join(dir, TEAM_DOMAIN_NAME, 'team_sessions.json'))
    const seam = new FileStorageSeam(dir)
    const result = await capture(async () => seam.open(TEN_TABLE_SPEC))
    expect(result.ok).toBe(false)
    expect(codeOf(failureOf(result))).toBe('malformed-medium')
  })

  it('file seam: an undeclared table file stays malformed-medium (upstream would silently drop it)', async () => {
    const dir = nineTableWorld('a3p1-seam-ghost-file')
    writeText(join(dir, TEAM_DOMAIN_NAME, 'ghost_table.json'), '{}')
    const seam = new FileStorageSeam(dir)
    const result = await capture(async () => seam.open(TEN_TABLE_SPEC))
    expect(result.ok).toBe(false)
    expect(codeOf(failureOf(result))).toBe('malformed-medium')
  })

  it('file seam: a foreign version is still version-mismatch, never an additive init', async () => {
    const dir = nineTableWorld('a3p1-seam-version')
    const seam = new FileStorageSeam(dir)
    const result = await capture(async () =>
      seam.open({ name: TEAM_DOMAIN_NAME, version: TEAM_DOMAIN_SCHEMA_VERSION + 1, tables: [...TEN_TABLE_SPEC.tables] }),
    )
    expect(result.ok).toBe(false)
    expect(codeOf(failureOf(result))).toBe('version-mismatch')
  })

  it('in-memory fake: the same-version addition opens, the added table starts empty', async () => {
    const seam = new InMemoryStorageSeam()
    const nine = await seam.open(nineTableSpec())
    await nine.table('team_sessions').put('session-root-1', 'row')
    await nine.close()

    const ten = await seam.open(TEN_TABLE_SPEC)

    expect(ten.table(TENTH).size).toBe(0)
    expect(ten.table('team_sessions').get('session-root-1')).toBe('row')
    await ten.close()
  })

  it('in-memory fake: a REMOVED table is still malformed-medium (the prefix rule, both directions)', async () => {
    const seam = new InMemoryStorageSeam()
    const ten = await seam.open(TEN_TABLE_SPEC)
    await ten.close()

    const result = await capture(async () => seam.open(nineTableSpec()))

    expect(result.ok).toBe(false)
    expect(codeOf(failureOf(result))).toBe('malformed-medium')
  })

  it('in-memory fake: a foreign version is still version-mismatch', async () => {
    const seam = new InMemoryStorageSeam()
    const nine = await seam.open(nineTableSpec())
    await nine.close()
    const result = await capture(async () =>
      seam.open({ ...nineTableSpec(), version: TEAM_DOMAIN_SCHEMA_VERSION + 1 }),
    )
    expect(result.ok).toBe(false)
    expect(codeOf(failureOf(result))).toBe('version-mismatch')
  })
})
