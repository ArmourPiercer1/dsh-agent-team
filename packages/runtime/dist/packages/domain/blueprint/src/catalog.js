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
import { parseBlueprintId, parseBlueprintRevision, teamContractError, TeamContractError, } from '../../../contracts/src/index.js';
import { parseBlueprint } from './validate.js';
import { toBlueprintSnapshotRef } from './snapshot.js';
/** A revision that is exactly one or more ASCII digits. */
const DIGIT_REVISION = /^\d+$/;
/**
 * The catalog revision order: digit revisions numerically ascending
 * (compared by length, then lexicographically — exact for arbitrary-length
 * digit strings, no `Number` precision loss), then non-digit revisions
 * lexicographically ascending.
 */
function compareRevisions(a, b) {
    const aNumeric = DIGIT_REVISION.test(a);
    const bNumeric = DIGIT_REVISION.test(b);
    if (aNumeric && bNumeric) {
        if (a.length !== b.length)
            return a.length - b.length;
        return a < b ? -1 : a > b ? 1 : 0;
    }
    if (aNumeric)
        return -1;
    if (bNumeric)
        return 1;
    return a < b ? -1 : a > b ? 1 : 0;
}
function notFound(blueprintId) {
    throw teamContractError('MALFORMED_DTO', `blueprint not found in catalog: ${blueprintId}`, { blueprintId, reason: 'blueprint-not-found' });
}
function buildCatalog(entries) {
    const byId = new Map();
    for (const blueprint of entries) {
        const id = blueprint.blueprintId;
        let revisions = byId.get(id);
        if (revisions === undefined) {
            revisions = new Map();
            byId.set(id, revisions);
        }
        if (revisions.has(blueprint.revision)) {
            throw teamContractError('MALFORMED_DTO', `catalog contains duplicate (blueprintId, revision) pair: ${id}@${blueprint.revision}`, {
                blueprintId: id,
                revision: blueprint.revision,
                reason: 'duplicate-blueprint-revision',
            });
        }
        revisions.set(blueprint.revision, blueprint);
    }
    const resolvePair = (rawId, rawRevision) => {
        const id = parseBlueprintId(rawId);
        const revision = parseBlueprintRevision(rawRevision);
        const blueprint = byId.get(id)?.get(revision);
        if (blueprint === undefined)
            notFound(id);
        return blueprint;
    };
    const catalog = {
        blueprintIds: Object.freeze([...byId.keys()].sort()),
        hasBlueprint: (rawId) => byId.has(parseBlueprintId(rawId)),
        listRevisions: (rawId) => {
            const id = parseBlueprintId(rawId);
            const revisions = byId.get(id);
            if (revisions === undefined)
                notFound(id);
            return Object.freeze([...revisions.keys()].sort(compareRevisions));
        },
        resolve: resolvePair,
        resolveLatest: (rawId) => {
            const id = parseBlueprintId(rawId);
            const revisions = byId.get(id);
            if (revisions === undefined)
                notFound(id);
            const ordered = [...revisions.keys()].sort(compareRevisions);
            const latest = ordered[ordered.length - 1];
            if (latest === undefined)
                notFound(id);
            return resolvePair(id, latest);
        },
        snapshotOf: (rawId, rawRevision) => toBlueprintSnapshotRef(resolvePair(rawId, rawRevision)),
    };
    return Object.freeze(catalog);
}
/**
 * Build a read-only catalog from already-parsed blueprints.
 * @throws `MALFORMED_DTO` (`reason: duplicate-blueprint-revision`) when the
 *   same `(blueprintId, revision)` pair appears twice.
 */
export function createBlueprintCatalog(entries) {
    return buildCatalog(entries);
}
/**
 * Parse one named source document, annotating any contract error with the
 * source name so multi-source catalogs stay diagnosable.
 */
function parseNamedSource(source, name) {
    const text = source.readSource(name);
    try {
        return parseBlueprint(text);
    }
    catch (error) {
        if (error instanceof TeamContractError) {
            throw teamContractError(error.code, `${error.message} (source: ${name})`, {
                ...(error.details ?? {}),
                sourceName: name,
            });
        }
        throw error;
    }
}
/**
 * Build a read-only catalog by reading and parsing every source from a
 * `BlueprintCatalogSource`.
 * @throws `TeamContractError` — the parse error of the offending source
 *   (annotated with `details.sourceName`), or `duplicate-blueprint-revision`
 *   when two sources declare the same `(blueprintId, revision)` pair.
 */
export function createBlueprintCatalogFromSource(source) {
    const entries = source.listSources().map((name) => parseNamedSource(source, name));
    return buildCatalog(entries);
}
//# sourceMappingURL=catalog.js.map