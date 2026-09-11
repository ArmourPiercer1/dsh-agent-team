/**
 * Blueprint catalog: an in-memory, read-only index of parsed blueprints,
 * keyed by the `(blueprintId, revision)` pair.
 *
 * The domain package owns no I/O: a catalog is built from already-parsed
 * blueprints (`createBlueprintCatalog`) or from a caller-supplied
 * `BlueprintCatalogSource` seam (`createBlueprintCatalogFromSource`), which
 * keeps all file/network access outside this package.
 *
 * Revision ordering (catalog "latest" rule): all-digit revisions first,
 * ascending numerically; then non-digit revisions, ascending
 * lexicographically. `resolveLatest` returns the last revision under this
 * order. Duplicates of a `(blueprintId, revision)` pair fail loudly at
 * construction; resolving a missing id/revision fails loudly at query time.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/blueprint/catalog
 */
import type { BlueprintSnapshotRef } from '../../../contracts/src/index.js';
import type { TeamBlueprint } from './types.js';
/**
 * A read-only source of blueprint source documents. This is the only seam
 * the catalog crosses to reach raw text; it performs no I/O itself.
 */
export interface BlueprintCatalogSource {
    /** The names of all available sources (order not significant). */
    listSources(): readonly string[];
    /** The raw source text of one source. */
    readSource(name: string): string;
}
/**
 * A read-only catalog of parsed blueprints.
 */
export interface BlueprintCatalog {
    /** Every blueprint id in the catalog, sorted lexicographically. */
    readonly blueprintIds: readonly string[];
    /** Whether a blueprint id is present in the catalog. */
    hasBlueprint(blueprintId: string): boolean;
    /** The revisions of one blueprint, oldest to latest under the catalog order. */
    listRevisions(blueprintId: string): readonly string[];
    /** Resolve one exact `(blueprintId, revision)` pair. */
    resolve(blueprintId: string, revision: string): TeamBlueprint;
    /** Resolve the latest revision under the catalog order. */
    resolveLatest(blueprintId: string): TeamBlueprint;
    /** The snapshot ref of one exact `(blueprintId, revision)` pair. */
    snapshotOf(blueprintId: string, revision: string): BlueprintSnapshotRef;
}
/**
 * The catalog revision order: digit revisions numerically ascending
 * (compared by length, then lexicographically — exact for arbitrary-length
 * digit strings, no `Number` precision loss), then non-digit revisions
 * lexicographically ascending.
 *
 * Exported (issue #2 blueprint-loading, plan BP4): the runtime's live
 * catalog authority must order the SAME union of frozen + saved + bootstrap
 * identities under this exact rule (one source of truth for the "latest"
 * semantics — no re-implementation drift).
 */
export declare function compareBlueprintRevisions(a: string, b: string): number;
/**
 * The catalog not-found failure: `MALFORMED_DTO` with
 * `reason: blueprint-not-found` (the closed wording every catalog surface
 * shares — exported for the runtime live facade, plan BP4).
 * @param blueprintId - the missing id.
 */
export declare function blueprintNotFound(blueprintId: string): never;
/**
 * Build a read-only catalog from already-parsed blueprints.
 * @throws `MALFORMED_DTO` (`reason: duplicate-blueprint-revision`) when the
 *   same `(blueprintId, revision)` pair appears twice.
 */
export declare function createBlueprintCatalog(entries: readonly TeamBlueprint[]): BlueprintCatalog;
/**
 * Build a read-only catalog by reading and parsing every source from a
 * `BlueprintCatalogSource`.
 * @throws `TeamContractError` — the parse error of the offending source
 *   (annotated with `details.sourceName`), or `duplicate-blueprint-revision`
 *   when two sources declare the same `(blueprintId, revision)` pair.
 */
export declare function createBlueprintCatalogFromSource(source: BlueprintCatalogSource): BlueprintCatalog;
//# sourceMappingURL=catalog.d.ts.map