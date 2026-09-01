/**
 * storage-seam.d.mts — the type surface of `storage-seam.mjs` (the live
 * world module; loaded only through the dynamic `import()` in `host.ts`).
 *
 * The handle shape mirrors `StorageDomainHandle`
 * (packages/storage/schema/seam.ts) structurally: `{ name, table(n),
 * close() }`.
 */

interface LiveStorageDomainHandle {
  readonly name: string
  table(tableName: string): unknown
  close(): Promise<void>
}

interface LiveStorageDomainSeam {
  open(spec: {
    readonly name: string
    readonly version: number
    readonly tables: readonly string[]
  }): Promise<LiveStorageDomainHandle>
  closeAll(): Promise<void>
}

/**
 * Build the real StorageDomainSeam bound to one live DSH `storageDomain`
 * service (`open(spec)` / `closeAll()`).
 * @param storageDomain - the public DSH storageDomain service (the Domain
 *   facility shape).
 */
export declare function createRealStorageDomainSeam(
  storageDomain: {
    readonly open: (declaration: unknown) => Promise<LiveStorageDomainHandle>
    readonly closeAll: () => Promise<void>
  },
): LiveStorageDomainSeam
