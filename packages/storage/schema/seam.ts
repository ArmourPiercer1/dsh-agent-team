/**
 * The narrow typed seam over the public DSH StorageDomain surface.
 *
 * TeamDomain is a Team-owned durable sidecar over the public StorageDomain
 * facility (Architecture §14.1). This module mirrors ONLY the public
 * surface TeamDomain consumes, so that repositories and the facade can be
 * written and tested against the seam contract (with an in-memory fake in
 * `test/p4-helpers.ts`) before the real binding lands (P4-T5/P5):
 *
 *   StorageDomainSeam.open(spec)    ↔ DomainFacility.open(spec): Promise<Domain>
 *   StorageDomainSeam.closeAll()    ↔ DomainFacility.closeAll(): Promise<void>
 *   StorageDomainHandle             ↔ Domain (name, table(name), close())
 *   StorageKvTable                  ↔ KvTable (get, entries, keys, size, put,
 *                                      delete, update)
 *
 * Deliberate narrowing (documented, not an accident):
 *
 * - The spec carries `tables` as plain names and declares NO per-table
 *   `valueSchema` and NO `global` block. The real binding opens the public
 *   domain with a JSON-string value schema for every table; TeamDomain
 *   treats every stored value as a canonical JSON string (see
 *   `repositories/base.ts`) and validates each record itself against the
 *   frozen contracts v1 DTOs — the domain layer's schema validation is
 *   intentionally not relied on for record semantics.
 * - `StorageDomainHandle.global` is omitted: TeamDomain never uses the
 *   domain global singleton; all versioning state lives in the
 *   `schema_meta` table (one stamp row per store).
 * - Values are typed `unknown`: the seam does not promise a value type.
 *   TeamDomain's invariant is that every value it writes is a canonical
 *   JSON string and every value it reads is verified as one.
 *
 * Seam error contract: seam failures surface as `Error` instances carrying
 * a string `code` property — the public DomainError codes
 * (`already-open`, `facet-unsupported`, `invalid-record`, `missing-key`,
 * `closed`) plus the backend pass-through codes (`version-mismatch`,
 * `backend-not-found`, `malformed-medium`). Consumers branch on `closed`
 * and `missing-key` only; anything else is classified as `SEAM_FAILURE`
 * (the facade special-cases `version-mismatch` at open).
 *
 * Pure module: interfaces and one structural type guard, no I/O.
 * @module @dsh-agent-team/storage/schema/seam
 */

/**
 * The spec of one durable domain, as TeamDomain opens it.
 *
 * @see public `DomainSpec` — `name`, `version`, and the declared tables.
 */
export interface StorageDomainSpec {
  /** Durable domain name (public `UNIT_NAME_RE` charset). */
  readonly name: string
  /** Schema version; a persisted domain at a different version rejects open. */
  readonly version: number
  /** The declared table names (each must satisfy the public unit-name rule). */
  readonly tables: readonly string[]
}

/**
 * One declared table of an open domain.
 *
 * @see public `KvTable<K, V>` — same members, values typed `unknown`
 * (TeamDomain stores canonical JSON strings and validates records itself).
 */
export interface StorageKvTable {
  /** Read one record, synchronously from memory; `undefined` when absent. */
  get(key: string): unknown
  /** Snapshot iterator over `[key, value]` pairs. */
  entries(): IterableIterator<[string, unknown]>
  /** Snapshot iterator over keys. */
  keys(): IterableIterator<string>
  /** Current record count. */
  readonly size: number
  /** Insert or overwrite one record durably (single-write durability). */
  put(key: string, value: unknown): Promise<void>
  /** Delete one record durably; `true` when it existed. */
  delete(key: string): Promise<boolean>
  /**
   * Atomic read-modify-write on the domain's write chain; a missing key
   * rejects with the public `missing-key` code.
   * @param fn - synchronous pure transform from current to next value.
   * @returns the stored next value.
   */
  update(key: string, fn: (current: unknown) => unknown): Promise<unknown>
}

/**
 * One open domain, as TeamDomain holds it.
 *
 * @see public `Domain` — `name`, `table(name)`, `close()` (idempotent).
 */
export interface StorageDomainHandle {
  /** Domain name from the spec. */
  readonly name: string
  /**
   * Resolve one declared table handle (handles are stable); rejects
   * synchronously with code `closed` once the domain is closed.
   */
  table(name: string): StorageKvTable
  /** Close the domain (idempotent); the state persists on the medium. */
  close(): Promise<void>
}

/**
 * The durable-domain facility TeamDomain opens through.
 *
 * @see public `DomainFacility` — `open(spec)`, `closeAll()`.
 */
export interface StorageDomainSeam {
  /**
   * Open (or re-open) the named domain. Fails with code `already-open`
   * when the domain is currently open, `version-mismatch` when the
   * persisted schema version differs, and the backend pass-through codes
   * for medium failures.
   */
  open(spec: StorageDomainSpec): Promise<StorageDomainHandle>
  /** Close every domain this facility has open. */
  closeAll(): Promise<void>
}

/**
 * Structural type guard: does `value` look like a StorageDomainSeam
 * (both methods present)?
 * @param value - the unknown value to check.
 * @returns `true` when the value carries `open` and `closeAll` functions.
 */
export function isStorageDomainSeam(value: unknown): value is StorageDomainSeam {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate['open'] === 'function' && typeof candidate['closeAll'] === 'function'
}
