/**
 * @dsh-agent-team/storage — TeamDomain, the durable control-plane authority.
 *
 * Responsibility (TaskDoc §11 package boundary): TeamDomain — the
 * Team-owned durable sidecar store and the **sole persistent control-plane
 * authority**, built over the public DSH StorageDomain seam. TeamSession /
 * MemberInstance records and the Team ledger live here, never in DSH
 * SessionEvents (zero-core: no Team event vocabulary enters the host).
 *
 * Skeleton status (P1-T4): this entrypoint exports the package identity
 * marker only; the real storage domain lands in the P4 TeamDomain work.
 * @module @dsh-agent-team/storage
 */

/**
 * Stable identity marker of the storage package.
 *
 * Placeholder until the P4 TeamDomain work replaces it; its value is
 * asserted by the package unit test and is part of the skeleton contract.
 */
export const PACKAGE_ID = 'storage'
