/**
 * storage-seam.mjs — the REAL StorageDomainSeam over the DSH public
 * `storageDomain` service (P8-S5 production live layer; moved verbatim
 * from the P5-T5 harness `root-binding/harness/seam.mjs`).
 *
 * Contract implemented (packages/storage/schema/seam.ts):
 *
 *   StorageDomainSeam.open(spec)    -> Promise<StorageDomainHandle>
 *   StorageDomainSeam.closeAll()    -> Promise<void>
 *
 * where `spec` is the repository's `StorageDomainSpec`
 * `{ name, version, tables: string[] }` and the handle is
 * `{ name, table(n), close() }` with KvTables carrying the public
 * `get/entries/keys/size/put/delete/update` members.
 *
 * The translation happens at `open`: the repository's table-name list
 * becomes the upstream `defineDomain` declaration with EVERY table typed
 * `domainTable(z.string())` — TeamDomain rows are canonical JSON strings
 * (packages/storage/repositories/base.ts enforces the string invariant and
 * (de)serializes records itself), so `z.string()` is the exact value
 * schema for all eight logical stores. No global is declared.
 *
 * Single-open-per-domain-name is enforced by the upstream facility
 * (`already-open` rejection) — boot 1 opens `team_domain` through
 * `createTeamDomain`, the process exits, boot 2 reopens the persisted unit
 * through `openTeamDomain` (fresh process, name freed).
 *
 * LIVE-WORLD MODULE: this file carries the bare specifiers
 * `@deepseek-ai/dsh-storage-domain` and `zod`. It is loaded ONLY through
 * the dynamic `import()` in `host.ts` (the real DSH world, where the
 * harness node_modules junction farm resolves them); the sanctioned test
 * chain never loads it (T1 injects a fake storage seam). Its type surface
 * is the sibling `storage-seam.d.mts`.
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
      const tables = {}
      for (const name of spec.tables) {
        tables[name] = domainTable(z.string())
      }
      const domain = await storageDomain.open(
        defineDomain({ name: spec.name, version: spec.version, tables }),
      )
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
