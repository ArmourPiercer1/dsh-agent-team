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
import { isTeamContractError, parseInstanceId, parseRootSessionId } from '../../contracts/src/index.js';
import { PERMISSION_OVERLAY_SCHEMA_VERSION, PERMISSION_OVERLAY_STORE, createPermissionOverlaySnapshot, deserializePermissionOverlaySnapshot, permissionOverlaySnapshotKey, serializePermissionOverlaySnapshot, } from '../schema/permission-overlay.js';
import { TEAM_DOMAIN_NAME, createTeamDomainSeamSpec, isTeamDomainError, normalizeSeamError, normalizeValidationError, teamDomainError, } from '../schema/index.js';
import { createOrOpenTeamDomain } from './team-domain.js';
/** The closed set of append-conflict `details.problem` tags. */
export const PERMISSION_OVERLAY_CONFLICT_PROBLEMS = [
    'generation-conflict',
    'previous-snapshot-id-mismatch',
    'predecessor-not-durable',
];
/**
 * The append-only snapshot repository of one open overlay store.
 *
 * Surface: `store`, `append`, `latest`, `history`, `at` — and nothing else.
 * The seam handle is held in a PRIVATE field, so no caller can reach the raw
 * table (and therefore `put`/`delete`/`update`) through this object.
 */
export class PermissionOverlayRepository {
    #handle;
    /** The serialized append chain (see the CAS section of the header). */
    #appendChain = Promise.resolve();
    /**
     * @param handle - the open overlay-domain handle (the injected seam
     *   surface); never stored anywhere reachable from the public API.
     */
    constructor(handle) {
        this.#handle = handle;
    }
    /** The store (table) name this repository manages. */
    get store() {
        return PERMISSION_OVERLAY_STORE;
    }
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
    async append(input) {
        let snapshot;
        try {
            snapshot = createPermissionOverlaySnapshot(input);
        }
        catch (error) {
            throw normalizeValidationError(error, PERMISSION_OVERLAY_STORE);
        }
        return this.#serialized(() => this.#append(snapshot));
    }
    /**
     * The CURRENT AUTHORITY of one identity: the snapshot with the HIGHEST
     * generation (ADR §2). The read is a direct lookup of that row — state is
     * never rebuilt by replaying earlier rows (design §3.3).
     * @param teamSessionId - the TeamSession identity.
     * @param memberInstanceId - the MemberInstance identity.
     * @returns the highest-generation snapshot, or `undefined` when the
     *   identity has no snapshot yet.
     */
    latest(teamSessionId, memberInstanceId) {
        const rows = this.#rowsOf(teamSessionId, memberInstanceId);
        let head;
        for (const snapshot of rows.values()) {
            if (head === undefined || snapshot.metadata.generation > head.metadata.generation)
                head = snapshot;
        }
        return head;
    }
    /**
     * The audit history of one identity: every durable snapshot, ascending by
     * generation. History is AUDIT ONLY (ADR §2) — this read has no effect on
     * what {@link latest} reports, and nothing here folds the rows together.
     * @param teamSessionId - the TeamSession identity.
     * @param memberInstanceId - the MemberInstance identity.
     */
    history(teamSessionId, memberInstanceId) {
        const rows = [...this.#rowsOf(teamSessionId, memberInstanceId).values()];
        rows.sort((left, right) => left.metadata.generation - right.metadata.generation);
        return rows;
    }
    /**
     * Read one snapshot at an exact generation (the durable audit point read).
     * @param teamSessionId - the TeamSession identity.
     * @param memberInstanceId - the MemberInstance identity.
     * @param generation - the generation to read.
     * @returns the snapshot, or `undefined` when that generation is not durable.
     * @throws `RECORD_INVALID` for a malformed identity or generation.
     */
    at(teamSessionId, memberInstanceId, generation) {
        const key = this.#keyOf(teamSessionId, memberInstanceId, generation);
        const raw = this.#readRow(key);
        if (raw === undefined)
            return undefined;
        return this.#verifyRow(key, raw);
    }
    // -------------------------------------------------------------------------
    // internals
    // -------------------------------------------------------------------------
    /** Run `task` at the tail of the serialized append chain. */
    #serialized(task) {
        const run = this.#appendChain.then(task, task);
        this.#appendChain = run.then(() => undefined, () => undefined);
        return run;
    }
    /** The read-check-put critical section of one append. */
    async #append(snapshot) {
        const { teamSessionId, memberInstanceId } = snapshot.identity;
        const generation = snapshot.metadata.generation;
        const key = this.#keyOf(teamSessionId, memberInstanceId, generation);
        // 1. occupied generation: identical bytes are the idempotent no-op, any
        //    other bytes are a conflict that must NOT overwrite.
        const existing = this.#readRow(key);
        const bytes = serializePermissionOverlaySnapshot(snapshot);
        if (existing !== undefined) {
            if (existing === bytes)
                return this.#verifyRow(key, existing);
            throw this.#conflict('generation-conflict', key, snapshot, existing);
        }
        // 2. the chain link must name the generation this snapshot claims.
        if (generation > 1) {
            const expectedPrevious = permissionOverlaySnapshotKey(teamSessionId, memberInstanceId, generation - 1);
            if (snapshot.metadata.previousSnapshotId !== expectedPrevious) {
                throw this.#conflict('previous-snapshot-id-mismatch', key, snapshot, undefined, {
                    expectedPreviousSnapshotId: expectedPrevious,
                    foundPreviousSnapshotId: snapshot.metadata.previousSnapshotId,
                });
            }
            // 3. and that predecessor must actually be durable (gapless chain).
            if (this.#readRow(expectedPrevious) === undefined) {
                throw this.#conflict('predecessor-not-durable', key, snapshot, undefined, {
                    expectedPreviousSnapshotId: expectedPrevious,
                });
            }
        }
        // 4. the durable head must be exactly the generation being replaced.
        const head = this.latest(teamSessionId, memberInstanceId);
        if (head === undefined ? generation !== 1 : head.metadata.generation !== generation - 1) {
            throw this.#conflict('previous-snapshot-id-mismatch', key, snapshot, undefined, {
                expectedHeadGeneration: generation - 1,
                foundHeadGeneration: head?.metadata.generation ?? null,
            });
        }
        await this.#putRow(key, bytes);
        return this.#verifyRow(key, bytes);
    }
    /** Build a typed generation-CAS conflict. */
    #conflict(problem, key, snapshot, existing, extra = {}) {
        const details = {
            store: PERMISSION_OVERLAY_STORE,
            key,
            problem,
            generation: snapshot.metadata.generation,
            teamSessionId: snapshot.identity.teamSessionId,
            memberInstanceId: snapshot.identity.memberInstanceId,
            ...extra,
        };
        if (existing !== undefined) {
            try {
                details['foundSnapshotId'] = deserializePermissionOverlaySnapshot(existing).snapshotId;
                details['foundMutationId'] = deserializePermissionOverlaySnapshot(existing).provenance.mutationId;
            }
            catch {
                details['foundBytesUnparsable'] = true;
            }
        }
        return teamDomainError('RECORD_DUPLICATE', `permission overlay append at generation ${String(snapshot.metadata.generation)} of ${snapshot.identity.teamSessionId}/${snapshot.identity.memberInstanceId} conflicts with the durable chain (${problem})`, details);
    }
    /** Every durable row of one identity, keyed by row key. */
    #rowsOf(teamSessionId, memberInstanceId) {
        let team;
        let instance;
        try {
            team = String(parseRootSessionId(teamSessionId));
            instance = String(parseInstanceId(memberInstanceId));
        }
        catch (error) {
            throw normalizeValidationError(error, PERMISSION_OVERLAY_STORE, teamSessionId);
        }
        const found = new Map();
        for (const [key, raw] of this.#entries()) {
            const snapshot = this.#verifyRow(key, raw);
            if (snapshot.identity.teamSessionId !== team || snapshot.identity.memberInstanceId !== instance)
                continue;
            found.set(key, snapshot);
        }
        return found;
    }
    /** The derived row key of one (identity, generation), arguments validated. */
    #keyOf(teamSessionId, memberInstanceId, generation) {
        try {
            const team = String(parseRootSessionId(teamSessionId));
            const instance = String(parseInstanceId(memberInstanceId));
            return permissionOverlaySnapshotKey(team, instance, generation);
        }
        catch (error) {
            if (isTeamDomainError(error))
                throw error;
            throw normalizeValidationError(error, PERMISSION_OVERLAY_STORE, String(teamSessionId));
        }
    }
    /** The table handle (per call: the handle may be closed between calls). */
    get #table() {
        try {
            return this.#handle.table(PERMISSION_OVERLAY_STORE);
        }
        catch (error) {
            throw normalizeSeamError(error, PERMISSION_OVERLAY_STORE, 'table');
        }
    }
    /** Read one raw row, enforcing the TeamDomain string invariant. */
    #readRow(key) {
        let value;
        try {
            value = this.#table.get(key);
        }
        catch (error) {
            throw normalizeSeamError(error, PERMISSION_OVERLAY_STORE, 'get');
        }
        if (value === undefined)
            return undefined;
        if (typeof value !== 'string') {
            throw teamDomainError('RECORD_INVALID', `row '${key}' of store '${PERMISSION_OVERLAY_STORE}' is not a string (TeamDomain rows are canonical JSON strings)`, { store: PERMISSION_OVERLAY_STORE, key, problem: 'row-not-a-string' });
        }
        return value;
    }
    /** Durably write one raw row (single-write durability before resolve). */
    async #putRow(key, value) {
        try {
            await this.#table.put(key, value);
        }
        catch (error) {
            throw normalizeSeamError(error, PERMISSION_OVERLAY_STORE, 'put');
        }
    }
    /** Snapshot iterator over `[key, raw]`, string-checking every row. */
    *#entries() {
        let iterator;
        try {
            iterator = this.#table.entries();
        }
        catch (error) {
            throw normalizeSeamError(error, PERMISSION_OVERLAY_STORE, 'entries');
        }
        for (const [key, value] of iterator) {
            if (typeof value !== 'string') {
                throw teamDomainError('RECORD_INVALID', `row '${key}' of store '${PERMISSION_OVERLAY_STORE}' is not a string (TeamDomain rows are canonical JSON strings)`, { store: PERMISSION_OVERLAY_STORE, key, problem: 'row-not-a-string' });
            }
            yield [key, value];
        }
    }
    /**
     * Deserialize one row and verify it is what its key claims: canonical
     * bytes, the overlay row version, and a row key that agrees with the
     * stored identity/generation.
     */
    #verifyRow(key, raw) {
        let snapshot;
        try {
            snapshot = deserializePermissionOverlaySnapshot(raw);
        }
        catch (error) {
            if (isTeamDomainError(error) || isTeamContractError(error)) {
                throw normalizeValidationError(error, PERMISSION_OVERLAY_STORE, key);
            }
            throw error;
        }
        if (serializePermissionOverlaySnapshot(snapshot) !== raw) {
            throw teamDomainError('RECORD_INVALID', `row '${key}' of store '${PERMISSION_OVERLAY_STORE}' is not in canonical byte form`, { store: PERMISSION_OVERLAY_STORE, key, problem: 'non-canonical-bytes' });
        }
        const expectedKey = permissionOverlaySnapshotKey(snapshot.identity.teamSessionId, snapshot.identity.memberInstanceId, snapshot.metadata.generation);
        if (expectedKey !== key) {
            throw teamDomainError('RECORD_INVALID', `row '${key}' of store '${PERMISSION_OVERLAY_STORE}' is stored under a key that does not match its identity/generation ('${expectedKey}')`, { store: PERMISSION_OVERLAY_STORE, key, expectedKey, problem: 'row-key-mismatch' });
        }
        return snapshot;
    }
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
export async function openPermissionOverlayStore(seam) {
    const adopted = await createOrOpenTeamDomain(seam);
    await adopted.close();
    let handle;
    try {
        handle = await seam.open(createTeamDomainSeamSpec());
    }
    catch (error) {
        throw normalizeSeamError(error, TEAM_DOMAIN_NAME, 'open');
    }
    return {
        name: TEAM_DOMAIN_NAME,
        // the store's version IS the TeamDomain version: the tenth store joined
        // the declared set additively, at an unchanged schema version.
        schemaVersion: PERMISSION_OVERLAY_SCHEMA_VERSION,
        repository: new PermissionOverlayRepository(handle),
        close: () => handle.close(),
    };
}
//# sourceMappingURL=permission-overlays.js.map