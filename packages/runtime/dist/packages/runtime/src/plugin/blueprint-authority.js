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
import { compareBlueprintRevisions, parseBlueprint, toBlueprintSnapshotRef, } from '../../../domain/blueprint/src/index.js';
import { parseBlueprintId, parseBlueprintRevision, teamContractError, TeamContractError, } from '../../../contracts/src/index.js';
import { TeamPluginError } from './types.js';
const identityKey = (blueprintId, revision) => `${blueprintId}@${revision}`;
/** Strong-parse with the static catalog's source-name annotation. */
function parseNamedSource(text, name) {
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
 * Create the live authority over the frozen registry, the saved sources
 * and the bootstrap anchor.
 * @throws `TeamContractError` (the strong parser's own) when the bootstrap
 *   anchor source does not strong-parse (host construction is fail-closed).
 */
export function createBlueprintAuthority(options) {
    const now = options.now ?? (() => new Date().toISOString());
    const sourceIndex = options.sourceIndex;
    const registry = options.registry;
    // The bootstrap anchor: the one strong parse at construction (the
    // inline source is constant per host — today's root already parses it
    // once per construction).
    const bootstrap = parseBlueprint(options.bootstrapSource);
    const bootstrapRef = toBlueprintSnapshotRef(bootstrap);
    /**
     * The current identity union (fresh scan). Frozen rows first (they win
     * over any disk file of the same identity), then the bootstrap anchor,
     * then the saved files in the index's stable name order.
     */
    const scanIdentities = () => {
        const map = new Map();
        for (const row of registry.list()) {
            map.set(identityKey(row.blueprintId, row.revision), {
                blueprintId: row.blueprintId,
                revision: row.revision,
                contentHash: row.contentHash,
                origin: 'frozen',
            });
        }
        const bKey = identityKey(bootstrap.blueprintId, bootstrap.revision);
        if (!map.has(bKey)) {
            map.set(bKey, {
                blueprintId: bootstrap.blueprintId,
                revision: bootstrap.revision,
                contentHash: bootstrapRef.contentHash,
                origin: 'bootstrap',
            });
        }
        for (const name of sourceIndex.listSourceFiles()) {
            const inspection = sourceIndex.inspectSource(name);
            if (inspection.status === 'rejected')
                continue; // no identity → not listed (plan §7.4)
            const { blueprintId, revision } = inspection.identity;
            const key = identityKey(blueprintId, revision);
            const existing = map.get(key);
            if (existing !== undefined) {
                // SHADOW, not a duplicate: the frozen registry row AND the pinned
                // bootstrap anchor (the row's pinned source) both WIN over a disk
                // file of the same identity (plan §7.3 registry-wins, extended to
                // the anchor — the RED-1 contract: a saved copy of the anchor is
                // listed once, under the anchor). Only two plain SAVED sources
                // with the same identity are the loud duplicate.
                if (existing.origin === 'frozen' || existing.origin === 'bootstrap')
                    continue;
                throw new TeamPluginError('TEAM_BLUEPRINT_REVISION_DUPLICATE', `two mutable Blueprint sources declare the same (blueprintId, revision): ${key} (existing saved source '${existing.sourceFile}', incoming saved source '${name}') — delete or re-revision one of them`, {
                    blueprintId,
                    revision,
                    reason: 'duplicate-mutable-source',
                    existing: existing.sourceFile,
                    incoming: name,
                });
            }
            map.set(key, { blueprintId, revision, origin: 'saved', sourceFile: name });
        }
        return map;
    };
    /** The latest revision of an id under the catalog order, or undefined. */
    const latestRevisionOf = (blueprintId) => {
        const revisions = [];
        for (const identity of scanIdentities().values()) {
            if (identity.blueprintId === blueprintId)
                revisions.push(identity.revision);
        }
        if (revisions.length === 0)
            return undefined;
        revisions.sort(compareBlueprintRevisions);
        return revisions[revisions.length - 1];
    };
    const resolveExact = (rawId, rawRevision) => {
        const blueprintId = parseBlueprintId(rawId);
        const revision = parseBlueprintRevision(rawRevision);
        const key = identityKey(blueprintId, revision);
        const identity = scanIdentities().get(key);
        if (identity === undefined) {
            throw teamContractError('MALFORMED_DTO', `blueprint not found in catalog: ${blueprintId}`, { blueprintId, reason: 'blueprint-not-found' });
        }
        if (identity.origin === 'frozen') {
            // Fresh row read (never a stale listing), then strong-parse the
            // stored source text; the hash MUST match the row (integrity).
            const row = registry.get(blueprintId, revision);
            if (row === undefined) {
                throw new TeamPluginError('TEAM_BLUEPRINT_SNAPSHOT_MISMATCH', `frozen registry row vanished between scan and resolve: ${key}`, { blueprintId, revision, reason: 'registry-row-vanished' });
            }
            const blueprint = parseNamedSource(row.source, `blueprint_registry:${key}`);
            if (blueprint.contentHash !== row.contentHash) {
                throw new TeamPluginError('TEAM_BLUEPRINT_SNAPSHOT_MISMATCH', `frozen registry row integrity broken for ${key}: stored contentHash ${row.contentHash} does not match the stored source text's hash ${blueprint.contentHash}`, {
                    blueprintId,
                    revision,
                    reason: 'registry-row-integrity',
                    expectedContentHash: row.contentHash,
                    foundContentHash: blueprint.contentHash,
                });
            }
            return blueprint;
        }
        if (identity.origin === 'bootstrap') {
            return bootstrap;
        }
        const sourceFile = identity.sourceFile;
        if (sourceFile === undefined) {
            throw new TeamPluginError('TEAM_BLUEPRINT_FILE_UNREADABLE', `saved source identity lost its file name: ${key}`, { blueprintId, revision, reason: 'saved-identity-missing-file' });
        }
        return parseNamedSource(sourceIndex.readSource(sourceFile), sourceFile);
    };
    const authority = {
        listIdentities: () => {
            const ids = [];
            for (const identity of scanIdentities().values())
                ids.push(identity);
            ids.sort((a, b) => {
                if (a.blueprintId !== b.blueprintId)
                    return a.blueprintId < b.blueprintId ? -1 : 1;
                return compareBlueprintRevisions(a.revision, b.revision);
            });
            return Object.freeze(ids);
        },
        resolve: (rawId, rawRevision) => {
            const blueprintId = parseBlueprintId(rawId);
            if (rawRevision === undefined) {
                const latest = latestRevisionOf(blueprintId);
                if (latest === undefined) {
                    throw teamContractError('MALFORMED_DTO', `blueprint not found in catalog: ${blueprintId}`, { blueprintId, reason: 'blueprint-not-found' });
                }
                return resolveExact(blueprintId, latest);
            }
            return resolveExact(blueprintId, rawRevision);
        },
        resolveSnapshot: (ref) => {
            const blueprint = resolveExact(ref.blueprintId, ref.revision);
            if (blueprint.contentHash !== ref.contentHash) {
                throw new TeamPluginError('TEAM_BLUEPRINT_SNAPSHOT_MISMATCH', `snapshot ref content mismatch for ${identityKey(ref.blueprintId, ref.revision)}: the ref carries ${ref.contentHash} but the current content parses to ${blueprint.contentHash} — re-resolve before using the ref`, {
                    blueprintId: ref.blueprintId,
                    revision: ref.revision,
                    reason: 'snapshot-content-mismatch',
                    expectedContentHash: ref.contentHash,
                    foundContentHash: blueprint.contentHash,
                });
            }
            return blueprint;
        },
        freezeSnapshot: async (ref) => {
            const blueprintId = ref.blueprintId;
            const revision = ref.revision;
            const key = identityKey(blueprintId, revision);
            const existing = registry.get(blueprintId, revision);
            if (existing !== undefined) {
                if (existing.contentHash === ref.contentHash)
                    return; // idempotent
                throw new TeamPluginError('TEAM_BLUEPRINT_REVISION_FROZEN', `cannot freeze ${key} from different content: the revision is already frozen with contentHash ${existing.contentHash} (requested ${ref.contentHash}) — publish a NEW revision instead`, {
                    blueprintId,
                    revision,
                    reason: 'blueprint-revision-frozen',
                    expectedContentHash: ref.contentHash,
                    foundContentHash: existing.contentHash,
                });
            }
            // TOCTOU fence (plan §8): re-resolve the CURRENT mutable source NOW
            // (fresh read + strong parse). A file rewritten between the
            // team.create resolve and this freeze parses to a different hash and
            // the freeze fails — it never freezes other content.
            const identity = scanIdentities().get(key);
            if (identity === undefined || identity.origin === 'frozen') {
                throw new TeamPluginError('TEAM_BLUEPRINT_SNAPSHOT_MISMATCH', `cannot freeze ${key}: no mutable source carries that identity`, { blueprintId, revision, reason: 'freeze-source-missing' });
            }
            let sourceText;
            let sourceName;
            if (identity.origin === 'bootstrap') {
                sourceText = options.bootstrapSource;
                sourceName = 'bootstrap anchor';
            }
            else {
                const sourceFile = identity.sourceFile;
                if (sourceFile === undefined) {
                    throw new TeamPluginError('TEAM_BLUEPRINT_SNAPSHOT_MISMATCH', `cannot freeze ${key}: the saved source identity lost its file name`, { blueprintId, revision, reason: 'freeze-source-missing-file' });
                }
                sourceText = sourceIndex.readSource(sourceFile);
                sourceName = sourceFile;
            }
            const blueprint = parseNamedSource(sourceText, sourceName);
            if (blueprint.contentHash !== ref.contentHash) {
                throw new TeamPluginError('TEAM_BLUEPRINT_SNAPSHOT_MISMATCH', `cannot freeze ${key}: the current source content parses to ${blueprint.contentHash} but the requested snapshot carries ${ref.contentHash} — the source changed after the snapshot was taken`, {
                    blueprintId,
                    revision,
                    reason: 'freeze-source-changed',
                    expectedContentHash: ref.contentHash,
                    foundContentHash: blueprint.contentHash,
                });
            }
            await registry.freeze({
                blueprintId,
                revision,
                contentHash: ref.contentHash,
                source: sourceText,
                frozenAt: now(),
            });
        },
    };
    return Object.freeze(authority);
}
//# sourceMappingURL=blueprint-authority.js.map