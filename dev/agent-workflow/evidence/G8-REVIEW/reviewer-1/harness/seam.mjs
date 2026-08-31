/**
 * seam.mjs — G8-R1 reviewer e2e harness: the REAL StorageDomainSeam over the
 * DSH public `storageDomain` service.
 *
 * Self-contained copy of the tracked P5-T5 harness adapter
 * (packages/runtime/root-binding/harness/seam.mjs at review SHA
 * 93d2a96e) — copied (not imported) so the row's bare specifiers resolve
 * through THIS directory's node_modules junction farm (the tracked copy
 * resolves through the P5-T5 harness directory's farm, which does not exist
 * in this worktree). Logic is byte-equivalent to the tracked adapter.
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
 * The translation happens at `open`: the repository's table-name list becomes
 * the upstream `defineDomain` declaration with EVERY table typed
 * `domainTable(z.string())` — TeamDomain rows are canonical JSON strings
 * (packages/storage/repositories/base.ts enforces the string invariant and
 * (de)serializes records itself), so `z.string()` is the exact value schema
 * for all eight logical stores. No global is declared.
 *
 * Plain .mjs (harness plumbing); the bare specifiers
 * `@deepseek-ai/dsh-storage-domain` and `zod` resolve through the harness's
 * gitignored node_modules junction farm (boot-g8.mjs, ensureProbeResolution).
 * @module @dsh-agent-team/g8r1-evidence/harness/seam
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
