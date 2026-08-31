/**
 * seam.mjs — the REAL StorageDomainSeam over the DSH public `storageDomain`
 * service (G8-R6 reviewer-6 harness; the P5-T5 factory verbatim, with one
 * resolution adjustment):
 *
 *   StorageDomainSeam.open(spec)    -> Promise<StorageDomainHandle>
 *   StorageDomainSeam.closeAll()    -> Promise<void>
 *
 * where `spec` is the repository's `StorageDomainSpec`
 * `{ name, version, tables: string[] }` and the handle is
 * `{ name, table(n), close() }` with KvTables carrying the public
 * `get/entries/keys/size/put/delete/update` members.
 *
 * The translation happens at `open`: the repository's table-name list becomes
 * the upstream `defineDomain` declaration with EVERY table typed
 * `domainTable(z.string())` — TeamDomain rows are canonical JSON strings
 * (packages/storage/repositories/base.ts enforces the string invariant and
 * (de)serializes records itself), so `z.string()` is the exact value schema
 * for all logical stores.
 *
 * RESOLUTION (zero writes to the test-use tree): the test-use package
 * `packages/storage/storage-domain` carries a BUILT, gitignored `lib/`
 * (built by an earlier G8 reviewer round from the identical src at the
 * pinned commit; lib mtimes postdate src). Its package.json root export
 * maps `.` to `./lib/index.js`, so the seam loads the compiled plain JS —
 * no Node type-stripping is involved (the src uses parameter properties,
 * which strip-only mode rejects). Runtime deps of the lib
 * (`@deepseek-ai/schemastery` → zod 4.4.3, `@deepseek-ai/dsh-storage`)
 * resolve from the pinned test-use tree's node_modules; the cordis /
 * dsh-invariants imports are type-only and erased. Nothing under the
 * test-use tree is written.
 *
 * Single-open-per-domain-name is enforced by the upstream facility
 * (`already-open` rejection) — boot 1 opens `team_domain` through
 * `createTeamDomain`, the process exits, boot 2 reopens the persisted unit
 * through `openTeamDomain` (fresh process, name freed).
 *
 * Plain .mjs (harness plumbing); the bare specifiers
 * `@deepseek-ai/dsh-storage-domain` (root export → built lib) and `zod`
 * resolve through the harness's gitignored node_modules junction farm
 * (run.mjs, ensureProbeResolution from the pinned test-use tree). No global
 * is declared.
 * @module g8r6-harness/seam
 */
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'

/**
 * Build the real StorageDomainSeam bound to one live `storageDomain`
 * service (the DSH DomainFacility: `open(spec)` / `closeAll()`).
 *
 * @param {object} storageDomain - the public DSH storageDomain service.
 * @returns {{ open: (spec: {name: string, version: number, tables: string[]}) => Promise<object>, closeAll: () => Promise<void> }}
 *   a StorageDomainSeam.
 */
export function createRealStorageDomainSeam(storageDomain) {
  if (storageDomain === null || typeof storageDomain !== 'object' ||
      typeof storageDomain.open !== 'function' || typeof storageDomain.closeAll !== 'function') {
    throw new TypeError('createRealStorageDomainSeam: storageDomain must expose open() and closeAll()')
  }
  return {
    /**
     * Open one repository-domain spec against the real backend.
     * @param {{name: string, version: number, tables: string[]}} spec - the StorageDomainSpec.
     * @returns the StorageDomainHandle over the opened upstream Domain.
     */
    async open(spec) {
      const domain = await storageDomain.open(defineDomain({
        name: spec.name,
        version: spec.version,
        tables: Object.fromEntries(spec.tables.map((tableName) => [tableName, domainTable(z.string())])),
      }))
      return {
        name: domain.name,
        table: (tableName) => domain.table(tableName),
        close: () => domain.close(),
      }
    },
    /** Close every domain this facility has open (idempotent upstream). */
    async closeAll() {
      await storageDomain.closeAll()
    },
  }
}
