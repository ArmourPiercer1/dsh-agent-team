/**
 * BlueprintRegistryRepository — the `blueprint_registry` store: the
 * durable, immutable registry of frozen Blueprint snapshot identities
 * (schema version 2, issue #2 blueprint-loading parallel repair, plan
 * BP2).
 *
 * The surface is read + freeze-only, by plan: `get(blueprintId,
 * revision)`, `list()`, `freeze(record)`. There is NO update, NO delete,
 * NO unfreeze, NO replace — the base write primitives that could do
 * otherwise (`deleteRow`, `updateRaw`) are deliberately never exposed.
 * A revision, once frozen, stays frozen for the life of the medium; a
 * new revision of the same blueprint is a NEW row
 * (`blueprintId@revision` key), never a rewrite of the old one.
 *
 * `freeze` semantics (the put-if-absent / re-read discipline, plan BP2 —
 * never last-write-wins):
 *
 *   - absent identity → APPEND the row (single-write durable put);
 *   - present identity with the SAME `contentHash` → IDEMPOTENT no-op
 *     (the snapshot is already frozen; the stored row is returned);
 *   - present identity with a DIFFERENT `contentHash` → LOUD typed
 *     failure: `RECORD_DUPLICATE` with `details.problem =
 *     'blueprint-revision-frozen'` and both hashes — a revision may not
 *     be re-frozen from different content (the crash rule then applies:
 *     the already-frozen row stays).
 *
 * The write-time re-read (the `putRecord` conflict path) covers the
 * window between the pre-read and the durable put: a concurrent freeze
 * of the same identity that lands in that window is refused loudly
 * rather than overwritten — the single-freezer invariant (the host is
 * the only writer, serialized on the domain write chain) is protected
 * by loud failure, the established TeamDomain philosophy (the same
 * shape as `TeamSessionsRepository.advanceGeneration`'s missing-team
 * ruling).
 *
 * @module @dsh-agent-team/storage/repositories/blueprint-registry
 */
import type { BlueprintRegistryRecord } from '../schema/index.js';
import type { StorageDomainHandle } from '../schema/index.js';
import { BaseRepository } from './base.js';
/**
 * The `blueprint_registry` repository.
 */
export declare class BlueprintRegistryRepository extends BaseRepository {
    /**
     * @param handle - the open `team_domain` handle.
     */
    constructor(handle: StorageDomainHandle);
    /**
     * Durably freeze one Blueprint snapshot identity from its source.
     *
     * The input is the snapshot identity + the IMMUTABLE source text + the
     * freeze time; the record is built (and its identity parsed through
     * the contracts grammar) here, keyed by `blueprintId@revision`.
     *
     * @param input - the frozen snapshot (identity + source + frozenAt).
     * @returns the frozen registry record (the STORED row when the identity
     *   was already frozen with the same content hash — idempotency).
     * @throws `RECORD_INVALID` for a malformed input; `RECORD_DUPLICATE`
     *   (problem `blueprint-revision-frozen`) when the identity is already
     *   frozen with a different content hash.
     */
    freeze(input: {
        readonly blueprintId: string;
        readonly revision: string;
        readonly contentHash: string;
        readonly source: string;
        readonly frozenAt: string;
    }): Promise<BlueprintRegistryRecord>;
    /**
     * Read one frozen registry record by snapshot identity.
     * @param blueprintId - the blueprint id (plain string, parsed).
     * @param revision - the revision (plain string, parsed).
     * @returns the frozen record, or `undefined` when the identity is not
     *   frozen.
     * @throws `RECORD_INVALID` (contracts code preserved) for a malformed
     *   identity component, or a malformed/non-canonical stored row.
     */
    get(blueprintId: string, revision: string): BlueprintRegistryRecord | undefined;
    /**
     * List every frozen registry record, sorted by the row key
     * (`blueprintId@revision`, byte order).
     */
    list(): BlueprintRegistryRecord[];
    /** Parse one identity pair and derive its durable row key. */
    private keyOf;
    /** The typed loud failure for a revision frozen from different content. */
    private blueprintRevisionFrozen;
}
//# sourceMappingURL=blueprint-registry.d.ts.map