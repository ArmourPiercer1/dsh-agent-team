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
    /**
     * The document version this identity was read from — for a frozen row the
     * version the ROW carries, for the anchor the parsed anchor's, for a saved
     * source the inspector's. Required, because the operator question "what still
     * needs migrating?" is answered by this number and nothing else.
     */
    readonly schemaVersion: number;
    /**
     * Whether this document's version runs here, is owed a migration, or cannot be
     * read at all — see {@link BlueprintVersionState}. LISTED here whatever it says
     * (a readable identity is listable, and the migration backlog is only a backlog
     * while it is visible); refused at `resolve()` by the same value, under the
     * matching one of A1-21's two names.
     *
     * `schemaVersion` beside it is not a second answer to the same question: the
     * state is WHICH situation this is, the version is the number the operator
     * types into the migration. A document with no readable identity at all is not
     * listable (the inspector's `rejected`) and so never carries either field.
     */
    readonly migrationState: BlueprintVersionState;
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
 * The state of the INLINE bootstrap anchor, classified WITHOUT throwing
 * (A4-PR7 Task 7.2, ADR A1-20(c): "an operator who cannot boot cannot migrate
 * anything").
 *
 * THE ONE BRIGHT LINE: **a document this build cannot run because of its VERSION
 * never kills the host; a document that is not a document at all still does.** A
 * retired anchor is the operator's backlog — the host must come up, show the
 * anchor as `migration-required`, and refuse by name every Team bound to it. A
 * YAML-syntax anchor is a misconfigured plugin row: no migration exists for it,
 * the fail-closed construction throw stays, and silently booting such a host
 * would leave every anchor consumer holding a value nobody parsed.
 */
export type BlueprintAnchorState = {
    readonly status: 'runnable';
    readonly blueprint: TeamBlueprint;
} | {
    readonly status: 'refused';
    /** The typed refusal every start path on this anchor owes (A1-21). */
    readonly code: string;
    /** The operator-facing headline (names the fault and the action). */
    readonly headline: string;
    /** A DEFINED-and-retired anchor: the operator's migration backlog. */
    readonly migrationState: 'migration-required';
    /** The version the migration starts FROM — always readable on this arm. */
    readonly schemaVersion: number;
    /**
     * The anchor's own identity. The inspector read it BEFORE it judged the
     * version (Task 7.1's ordering), which is exactly why a document this build
     * will not run can still be LISTED — and why this arm, and only this arm,
     * has something to list.
     */
    readonly identity: {
        readonly blueprintId: string;
        readonly revision: string;
    };
} | {
    readonly status: 'refused';
    readonly code: string;
    readonly headline: string;
    /**
     * A version this product never defined. NO identity and NO version field
     * here, and that is the point: the inspector hands out no identity for a
     * version it cannot name, so there is nothing to list and no migration to
     * advertise. These two refusals were ONE refused shape with optional
     * `identity?`/`schemaVersion?`, which is how a renderer came to print
     * "listed in the catalog with migrationRequired=false" for the arm with
     * nothing to list — the fields were absent, the sentence was not. Making the
     * pair exist only on the arm that has them is what keeps that sentence from
     * being writable again.
     */
    readonly migrationState: 'unreadable';
};
/**
 * Classify the inline bootstrap anchor without throwing on a version refusal.
 *
 * The strong parse is attempted only when the identity-level inspection says the
 * version is runnable; every other failure — bad YAML, a missing id, a
 * semantically broken document — propagates exactly as it does today, because
 * those are configuration faults and not migration states.
 */
export declare function classifyBlueprintAnchor(source: string): BlueprintAnchorState;
/**
 * What THIS build says about a Blueprint document's declared version (A4-PR7
 * Ruling 1, ADR A1-21). Three values, because "this build will not run it" is TWO
 * different facts with two different operator actions:
 *
 *  - `current` — the version is in `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS`: the
 *    document runs, and nothing is owed to it;
 *  - `migration-required` — the version is in `RETIRED_BLUEPRINT_DOCUMENT_VERSIONS`:
 *    this product DEFINED that version, no longer runs it, and the document is the
 *    operator's to migrate. Listed, and refused at `resolve()` with
 *    `BLUEPRINT_MIGRATION_REQUIRED`;
 *  - `unreadable` — the version is in NEITHER set, so this build cannot tell the
 *    operator anything about that document's migration state, AND no migration is
 *    owed: there is nothing to run for a shape nobody defined. Listed (its identity
 *    is still readable) and refused at `resolve()` with
 *    `BLUEPRINT_SCHEMA_VERSION_UNSUPPORTED`.
 *
 * WHY ONE VALUE AND NOT A BOOLEAN. The deleted `migrationRequired: boolean` had to
 * make `false` mean both "current" and "cannot read that version", so a row on a
 * version nobody defined was advertised as CURRENT while `resolve()` refused it —
 * one component, one identity, two answers, and the surface an operator reads was
 * the wrong one. That is the absent-vs-unavailable fold this phase keeps meeting,
 * one layer up each time.
 *
 * The classification reads the DOMAIN's two derived sets and nothing else, never a
 * local `version < 3`: a threshold would be a second authority on which versions
 * exist, and it would start lying the day a version 4 is defined on the other side
 * of the package boundary.
 */
export type BlueprintVersionState = 'current' | 'migration-required' | 'unreadable';
/**
 * Classify one declared version against the domain's two derived sets: the whole
 * question, in one place, with no comparison operator in it.
 */
export declare function blueprintVersionStateOf(schemaVersion: number): BlueprintVersionState;
/**
 * Create the live authority over the frozen registry, the saved sources
 * and the bootstrap anchor.
 * @throws `TeamContractError` (the strong parser's own) when the bootstrap
 *   anchor source does not strong-parse (host construction is fail-closed).
 */
export declare function createBlueprintAuthority(options: CreateBlueprintAuthorityOptions): BlueprintAuthority;
//# sourceMappingURL=blueprint-authority.d.ts.map