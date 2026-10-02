/**
 * PermissionOverlayRepository — the durable, append-only store of
 * PermissionOverlaySnapshots (Alpha.3 PR1; ADR §1/§2, design §2).
 *
 * Design §2 assigns exactly three roles to this component:
 *
 *   - durable storage;
 *   - append-only snapshot management;
 *   - generation lookup;
 *
 * and exactly three NON-responsibilities, which this class enforces by
 * construction rather than by comment alone:
 *
 *   - no authorization (it never looks at `provenance.actor` to decide
 *     whether a write may happen);
 *   - no envelope validation (no `MutationEnvelope` term exists anywhere in
 *     this package — ADR §6 is PR3);
 *   - no actor checking.
 *
 * ADR §1 also forbids it to bypass mutation serialization or become an
 * alternative write path. Concretely: the ONLY way a row appears is
 * {@link PermissionOverlayRepository.append}, there is no update / delete /
 * overwrite / replay member on the surface, and appends are serialized on
 * this instance so two in-process writers cannot interleave a
 * read-check-put. `permission-overlay-port-surface.test.ts` pins the surface
 * and the import graph; `permission-overlay-history-immutability.test.ts`
 * pins that no write-bypass verb exists.
 *
 * ## The durable write path stays single (PR1)
 *
 * Production gets NO new permission write path from this PR. The future
 * `GovernanceMutationService` (Alpha.3 PR3) remains the SOLE permission
 * mutation authority (ADR §1: Leader/Human request → GovernanceMutationService
 * → PermissionOverlayRepository → durable store); nothing wires this
 * repository to a tool, a remote method, a control request or a lifecycle
 * transition, so nothing outside that future authority can reach it. PR1
 * makes the durable foundation exist and be tested; it does not enable
 * runtime dynamic permission execution.
 *
 * ## Generation CAS at the persistence boundary
 *
 * `append` commits generation `g` for one (TeamSession, MemberInstance) and
 * refuses, as a TYPED `RECORD_DUPLICATE` conflict, every case where the
 * caller's view of the chain is not the durable chain:
 *
 * | `details.problem`             | case                                          |
 * | ----------------------------- | --------------------------------------------- |
 * | `generation-conflict`         | row `g` already durable with DIFFERENT bytes  |
 * | `previous-snapshot-id-mismatch` | `previousSnapshotId` does not name `g - 1`, or the durable head is not `g - 1` |
 * | `predecessor-not-durable`     | `previousSnapshotId` names `g - 1` but that row was never written (no gaps) |
 *
 * Re-appending the byte-identical snapshot at `g` is an idempotent no-op
 * (the TeamDomain idempotency rule), never a second row. An occupied
 * generation is NEVER overwritten, and rows are never deleted.
 *
 * The public seam has no atomic put-if-absent, so append runs its
 * read-check-put inside this instance's serialized append chain — the same
 * discipline `blueprint_registry` documents, strengthened by the chain. A
 * cross-PROCESS writer is exactly the case ADR §1 reserves for
 * `GovernanceMutationService`'s mutation serialization, which is why this
 * repository is a port, not an entry point.
 *
 * ## Durable placement (the TeamDomain tenth store)
 *
 * `permission_overlays` is the TENTH declared table of `team_domain`
 * (coordinator ruling 2026-10-01; the store name is declared once, in
 * `schema/stores.ts`). So this store shares the domain's L1 seam version,
 * its write chain, and its `schema_meta` L2 stamps, and
 * {@link openPermissionOverlayStore} gets its verification from the
 * PRODUCTION TeamDomain entry (`createOrOpenTeamDomain`): the nine baseline
 * stamps verified, the tenth bootstrapped when the medium predates the
 * store, corruption rejected. No stamp logic is duplicated here.
 *
 * This repository deliberately does NOT join the `TeamDomainRepositories`
 * facade: Alpha.3 PR1 ships the persistence layer with zero production-path
 * imports of the overlay capability (the intended consumer is PR3's
 * `GovernanceMutationService`). It takes the very same
 * `StorageDomainHandle` the facade is built on, so PR3 can compose a single
 * open without changing anything in this module.
 *
 * @module @dsh-agent-team/storage/repositories/permission-overlays
 */
import type { PermissionOverlaySnapshot, PermissionOverlaySnapshotInput } from '../schema/permission-overlay.js';
import type { StorageDomainHandle, StorageDomainSeam } from '../schema/index.js';
/** The closed set of append-conflict `details.problem` tags. */
export declare const PERMISSION_OVERLAY_CONFLICT_PROBLEMS: readonly ["generation-conflict", "previous-snapshot-id-mismatch", "predecessor-not-durable"];
/** One append-conflict tag. */
export type PermissionOverlayConflictProblem = (typeof PERMISSION_OVERLAY_CONFLICT_PROBLEMS)[number];
/**
 * The append-only snapshot repository of one open overlay store.
 *
 * Surface: `store`, `append`, `latest`, `history`, `at` — and nothing else.
 * The seam handle is held in a PRIVATE field, so no caller can reach the raw
 * table (and therefore `put`/`delete`/`update`) through this object.
 */
export declare class PermissionOverlayRepository {
    #private;
    /**
     * @param handle - the open overlay-domain handle (the injected seam
     *   surface); never stored anywhere reachable from the public API.
     */
    constructor(handle: StorageDomainHandle);
    /** The store (table) name this repository manages. */
    get store(): string;
    /**
     * Append one full snapshot as the next generation of its identity chain.
     *
     * Structural validation happens first (so a rejected input never touches
     * the medium); the CAS checks then compare the caller's chain view with the
     * durable one. This method performs NO authority, envelope or actor check —
     * by ADR §1 design; the caller is expected to be the future
     * GovernanceMutationService, and refusing is that service's job.
     * @param input - the ADR §2 sections (identity/state/metadata/provenance).
     * @returns the durable snapshot (identical to the input for a fresh append;
     *   the STORED snapshot when the identical row was already durable).
     * @throws `RECORD_INVALID` when the input or a stored row is structurally
     *   invalid; `RECORD_DUPLICATE` with a
     *   {@link PermissionOverlayConflictProblem} `details.problem` on a
     *   generation CAS conflict; `SEAM_FAILURE` / `NOT_OPEN` for seam failures.
     */
    append(input: PermissionOverlaySnapshotInput): Promise<PermissionOverlaySnapshot>;
    /**
     * The CURRENT AUTHORITY of one identity: the snapshot with the HIGHEST
     * generation (ADR §2). The read is a direct lookup of that row — state is
     * never rebuilt by replaying earlier rows (design §3.3).
     * @param teamSessionId - the TeamSession identity.
     * @param memberInstanceId - the MemberInstance identity.
     * @returns the highest-generation snapshot, or `undefined` when the
     *   identity has no snapshot yet.
     */
    latest(teamSessionId: string, memberInstanceId: string): PermissionOverlaySnapshot | undefined;
    /**
     * The audit history of one identity: every durable snapshot, ascending by
     * generation. History is AUDIT ONLY (ADR §2) — this read has no effect on
     * what {@link latest} reports, and nothing here folds the rows together.
     * @param teamSessionId - the TeamSession identity.
     * @param memberInstanceId - the MemberInstance identity.
     */
    history(teamSessionId: string, memberInstanceId: string): readonly PermissionOverlaySnapshot[];
    /**
     * Read one snapshot at an exact generation (the durable audit point read).
     * @param teamSessionId - the TeamSession identity.
     * @param memberInstanceId - the MemberInstance identity.
     * @param generation - the generation to read.
     * @returns the snapshot, or `undefined` when that generation is not durable.
     * @throws `RECORD_INVALID` for a malformed identity or generation.
     */
    at(teamSessionId: string, memberInstanceId: string, generation: number): PermissionOverlaySnapshot | undefined;
}
/** One open overlay store: the repository plus the handle lifecycle. */
export interface PermissionOverlayStore {
    /** The durable domain the store lives in (`team_domain`). */
    readonly name: string;
    /** The append-only snapshot repository. */
    readonly repository: PermissionOverlayRepository;
    /** The row version this store serves (the domain version, L3 per row). */
    readonly schemaVersion: number;
    /** Close the domain (idempotent; the medium keeps its state). */
    close(): Promise<void>;
}
/**
 * Open the overlay store — the restart-safe entry point of the TeamDomain
 * TENTH table.
 *
 * The verification is NOT re-implemented here: the store is opened by the
 * production TeamDomain boot entry `createOrOpenTeamDomain`, which checks L1
 * at the seam, verifies the nine baseline L2 stamps, bootstraps the tenth
 * store's stamp when the medium predates it, and fails loudly on a partial
 * or corrupt domain. That entry owns a handle only for the duration of the
 * create/adopt, so this helper releases it and re-opens the domain for the
 * overlay store's own use — one extra rehydration, zero duplicated policy.
 * (When PR3 composes the `GovernanceMutationService` it can hand this
 * repository the already-open handle instead.)
 *
 * @param seam - the public storage seam (injected; the file-backed seam in
 *   tests, the real `StorageDomain` binding in production).
 * @returns the open store (the team_domain handle stays private to it).
 * @throws `SCHEMA_VERSION_MISMATCH` / `SCHEMA_STAMP_MISSING` /
 *   `SCHEMA_STAMP_MISMATCH` from the TeamDomain boot verification,
 *   `SEAM_FAILURE` for any other seam failure.
 */
export declare function openPermissionOverlayStore(seam: StorageDomainSeam): Promise<PermissionOverlayStore>;
//# sourceMappingURL=permission-overlays.d.ts.map