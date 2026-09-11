/**
 * BlueprintAuthority — the live per-host authority over every Blueprint
 * identity the runtime can see (issue #2 blueprint-loading parallel
 * repair, plan BP4).
 *
 * The authority is the single owner of the LIVE union:
 *
 *   1. the FROZEN registry rows (TeamDomain `blueprint_registry` store —
 *      immutable, authoritative for their `(blueprintId, revision)`);
 *   2. the SAVED sources of the `blueprintDir` (the stateless filesystem
 *      index, plan BP3 — mutable, rescan-per-request);
 *   3. the INLINE bootstrap anchor (`config.blueprintSource` — the
 *      bootstrap/compatibility source, required, parsed once at
 *      construction; mutable in the catalog sense but constant per host).
 *
 * Every method call observes the CURRENT state (no install-lifetime
 * snapshot, no cache): a saved source added after boot is listed on the
 * next call; a deleted mutable source disappears (a frozen revision never
 * does — the registry row keeps it resolvable after deletion, plan §7.3).
 *
 * Resolve precedence (plan §8, frozen):
 *
 *   registry contains id@rev
 *       => strong-parse the registry row's stored SOURCE TEXT
 *       => the parsed contentHash MUST equal the row's contentHash
 *          (row integrity — a tampered row fails loudly)
 *       => return the frozen Blueprint
 *   else
 *       => read the CURRENT mutable source (bootstrap anchor or the single
 *          saved file with that identity — fresh read, never cached)
 *       => strong `parseBlueprint()`
 *       => return
 *
 * `freezeSnapshot(ref)` (the BP6 barrier's port):
 *
 *   registry row exists + same contentHash  => idempotent success (no-op)
 *   registry row exists + different hash    => fail loud
 *       `TEAM_BLUEPRINT_REVISION_FROZEN` (a frozen revision is immutable —
 *       publish a NEW revision)
 *   registry row absent
 *       => RE-RESOLVE the current mutable source NOW (fresh read + strong
 *          parse) — the TOCTOU fence (plan §8): if the file changed between
 *          the `team.create` resolve and this freeze, the freshly parsed
 *          hash disagrees with `ref.contentHash` and the freeze fails loud
 *          `TEAM_BLUEPRINT_SNAPSHOT_MISMATCH` instead of freezing other
 *          content
 *       => append the registry row with the exact source text that was
 *          parsed (the registry, not the disk, is the authority of a
 *          frozen revision — a later deletion of the file cannot orphan a
 *          bound TeamSession)
 *
 * Identity-level scanning only (plan §7.4): listing NEVER strong-parses
 * saved sources (one logically broken saved Blueprint must not take down
 * the catalog — it is listed by identity and fails only when RESOLVED);
 * a saved file whose IDENTITY itself is unusable (broken YAML, missing id)
 * carries no identity and is absent from the listing, like any
 * non-Blueprint file. SHADOW precedence (plan §7.3 registry-wins, extended
 * to the pinned anchor — the RED-1 contract): a saved file carrying the
 * same identity as a frozen registry row OR the bootstrap anchor is
 * shadowed (listed once, under the shadowing source — a saved copy of the
 * anchor is NOT a duplicate); only two plain SAVED sources with the same
 * `(blueprintId, revision)` fail loud `TEAM_BLUEPRINT_REVISION_DUPLICATE`.
 *
 * Strong-parse failures propagate as the domain's `TeamContractError`
 * (annotated with the source name, the static catalog's established
 * convention); I/O, duplicate, integrity and fence failures are
 * `TeamPluginError` with the closed `TEAM_BLUEPRINT_*` codes.
 *
 * @module @dsh-agent-team/runtime/src/plugin/blueprint-authority
 */
import type { TeamBlueprint } from '../../../domain/blueprint/src/index.js';
import type { BlueprintSnapshotRef } from '../../../contracts/src/index.js';
import type { BlueprintSourceIndex } from './blueprint-source-index.js';
/**
 * The registry seam the authority crosses (structural): the production
 * implementation is the storage `BlueprintRegistryRepository` (plan BP2);
 * tests may substitute an in-memory row store. The row view carries the
 * stored SOURCE TEXT (the runtime authority of a frozen revision, not just
 * the hash).
 */
export interface BlueprintRegistryRecordView {
    readonly schemaVersion: number;
    readonly blueprintId: string;
    readonly revision: string;
    readonly contentHash: string;
    /** The immutable source text the row was frozen from. */
    readonly source: string;
    readonly frozenAt: string;
}
export interface BlueprintRegistryPort {
    get(blueprintId: string, revision: string): BlueprintRegistryRecordView | undefined;
    list(): readonly BlueprintRegistryRecordView[];
    freeze(input: {
        readonly blueprintId: string;
        readonly revision: string;
        readonly contentHash: string;
        readonly source: string;
        readonly frozenAt: string;
    }): Promise<BlueprintRegistryRecordView>;
}
/** Where one current identity comes from (the listing never needs more). */
export type BlueprintIdentityOrigin = 'frozen' | 'bootstrap' | 'saved';
/**
 * One current identity (plan §8 `listIdentities`). For frozen and
 * bootstrap identities the `contentHash` is known (the registry row / the
 * strong-parsed anchor); for a MUTABLE saved source it is unknown until a
 * strong parse (plan §7.4 — the listing must not strong-parse the whole
 * catalog).
 */
export interface BlueprintIdentity {
    readonly blueprintId: string;
    readonly revision: string;
    readonly contentHash?: string;
    readonly origin: BlueprintIdentityOrigin;
    /** The saved file name (present for `origin: 'saved'` only). */
    readonly sourceFile?: string;
}
/**
 * The narrow live authority (plan §8). Every call queries the current
 * state; `freezeSnapshot` is the durable append (the only write path).
 */
export interface BlueprintAuthority {
    /**
     * The current union of identities (frozen registry rows + saved source
     * identities + the bootstrap anchor), sorted by blueprintId then the
     * catalog revision order. A saved file duplicating a frozen row or the
     * bootstrap anchor is shadowed (listed under the shadowing source); two
     * saved files with the same identity fail loud.
     * @throws `TEAM_BLUEPRINT_REVISION_DUPLICATE` for two saved sources
     *   with the same `(blueprintId, revision)`; `TEAM_BLUEPRINT_DIR_UNREADABLE`
     *   when the configured directory scan fails.
     */
    listIdentities(): readonly BlueprintIdentity[];
    /**
     * Resolve one exact `(blueprintId, revision)` — registry precedence,
     * then the current mutable source.
     * @param blueprintId - the id (grammar-validated).
     * @param revision - the revision; OMIT for the latest under the catalog
     *   order (the live `resolveLatest`).
     * @throws `MALFORMED_DTO` `blueprint-not-found` (the static catalog's
     *   closed wording); the strong parse's `TeamContractError` (annotated
     *   with the source name) for a broken saved source;
     *   `TEAM_BLUEPRINT_SNAPSHOT_MISMATCH` for a registry-row integrity
     *   break; `TEAM_BLUEPRINT_FILE_UNREADABLE` for a vanished file.
     */
    resolve(blueprintId: string, revision?: string): TeamBlueprint;
    /**
     * Resolve and VERIFY a snapshot ref: the freshly parsed contentHash must
     * equal `ref.contentHash` (the read-path TOCTOU guard).
     * @throws `TEAM_BLUEPRINT_SNAPSHOT_MISMATCH` with both hashes on a
     *   mismatch; otherwise as {@link resolve}.
     */
    resolveSnapshot(ref: BlueprintSnapshotRef): TeamBlueprint;
    /**
     * The freeze barrier's port (plan §8 freezeSnapshot): idempotent for an
     * already-frozen same-hash identity; loud for a different-hash frozen
     * identity; re-resolves the current mutable source (TOCTOU fence) and
     * appends the registry row with the exact parsed source text otherwise.
     * @throws `TEAM_BLUEPRINT_REVISION_FROZEN` / `TEAM_BLUEPRINT_SNAPSHOT_MISMATCH`
     *   (both hashes in `detail`); the registry's own typed error when the
     *   append races another freeze landing between the pre-read and the
     *   durable put.
     */
    freezeSnapshot(ref: BlueprintSnapshotRef): Promise<void>;
}
export interface CreateBlueprintAuthorityOptions {
    /**
     * The INLINE bootstrap anchor source (required, the strong parse runs at
     * construction — a broken anchor fails host construction loud, exactly
     * like today's root does).
     */
    readonly bootstrapSource: string;
    /** The stateless saved-source index (plan BP3; disabled when no dir). */
    readonly sourceIndex: BlueprintSourceIndex;
    /** The durable registry seam (the TeamDomain `blueprint_registry` row). */
    readonly registry: BlueprintRegistryPort;
    /** The `frozenAt` clock (injectable for deterministic tests). */
    readonly now?: () => string;
}
/**
 * Create the live authority over the frozen registry, the saved sources
 * and the bootstrap anchor.
 * @throws `TeamContractError` (the strong parser's own) when the bootstrap
 *   anchor source does not strong-parse (host construction is fail-closed).
 */
export declare function createBlueprintAuthority(options: CreateBlueprintAuthorityOptions): BlueprintAuthority;
//# sourceMappingURL=blueprint-authority.d.ts.map