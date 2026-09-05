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
 * Structural type guard: does `value` look like a StorageDomainSeam
 * (both methods present)?
 * @param value - the unknown value to check.
 * @returns `true` when the value carries `open` and `closeAll` functions.
 */
export function isStorageDomainSeam(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    return typeof candidate['open'] === 'function' && typeof candidate['closeAll'] === 'function';
}
//# sourceMappingURL=seam.js.map