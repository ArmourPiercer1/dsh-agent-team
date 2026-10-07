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
import { BLUEPRINT_VERSION_REFUSAL_CODES, inspectBlueprintSource, RETIRED_BLUEPRINT_DOCUMENT_VERSIONS, SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS, compareBlueprintRevisions, parseBlueprint, toBlueprintSnapshotRef, } from '../../../domain/blueprint/src/index.js';
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
 * Classify the inline bootstrap anchor without throwing on a version refusal.
 *
 * The strong parse is attempted only when the identity-level inspection says the
 * version is runnable; every other failure — bad YAML, a missing id, a
 * semantically broken document — propagates exactly as it does today, because
 * those are configuration faults and not migration states.
 */
export function classifyBlueprintAnchor(source) {
    const inspection = inspectBlueprintSource(source);
    if (inspection.status === 'migration-required') {
        const { identity } = inspection;
        return {
            status: 'refused',
            code: BLUEPRINT_VERSION_REFUSAL_CODES.MIGRATION_REQUIRED,
            headline: `the bootstrap Blueprint ${identity.blueprintId}@${identity.revision} is a schema v${identity.schemaVersion} ` +
                `document; this build runs [${SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.join(', ')}]. The host boots and the catalog ` +
                `lists it with migrationRequired=true; no Team bound to it can start until it is migrated`,
            schemaVersion: identity.schemaVersion,
            migrationRequired: true,
            identity: { blueprintId: identity.blueprintId, revision: identity.revision },
        };
    }
    if (inspection.status === 'rejected' &&
        inspection.diagnostics.some((d) => d.reason === 'schemaVersion-unsupported')) {
        // A version this build does not run and never defined (or a version field
        // that is not a positive integer). Degraded like a migration — because the
        // operator still needs a booting host to fix it — but NOT listed: there is
        // no migration to advertise, and the start refusal says which it is.
        return {
            status: 'refused',
            code: BLUEPRINT_VERSION_REFUSAL_CODES.SCHEMA_VERSION_UNSUPPORTED,
            headline: `the bootstrap Blueprint declares a schema version this build does not run; this build runs ` +
                `[${SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.join(', ')}]. The host boots degraded; no Team bound to it can start`,
            migrationRequired: false,
        };
    }
    return { status: 'runnable', blueprint: parseNamedSourceOrThrow(source) };
}
/** The strong parse, unchanged, for every non-version outcome. */
function parseNamedSourceOrThrow(source) {
    return parseBlueprint(source);
}
/**
 * Does a document on this version need a migration, as opposed to being
 * unreadable or perfectly current?
 *
 * The question is answered by the DOMAIN's derived set
 * (`RETIRED_BLUEPRINT_DOCUMENT_VERSIONS`), never by a local `version < 3`:
 * a threshold here would be a second authority on which versions exist, and it
 * would silently start lying the day a version 4 is defined on the other side of
 * the package boundary.
 */
function migrationRequiredFor(schemaVersion) {
    return RETIRED_BLUEPRINT_DOCUMENT_VERSIONS.includes(schemaVersion);
}
/**
 * The version refusal a resolve/start path owes a document it can name but will
 * not run (ADR A1-21). Two arms, two typed names, because the two operator
 * actions are not the same task:
 *
 *  - a version this product DEFINED and retired → `BLUEPRINT_MIGRATION_REQUIRED`
 *    (the document is the operator's; run the migration);
 *  - a version it never defined → `BLUEPRINT_SCHEMA_VERSION_UNSUPPORTED` (there
 *    is no migration for a shape nobody knows).
 *
 * The order is the contract, not an optimisation. The identity's own
 * `migrationRequired` flag is asked FIRST: that flag is what this same build just
 * advertised on `listIdentities()`, so a resolve that answered "unsupported" (or
 * "not found") for it would contradict its own catalog — and the flag is also the
 * only arm that can know (a saved source is classified by the inspector, which
 * consults the version sets; a frozen row by the retired set directly). Only when
 * the flag is false does the version itself decide: supported → no refusal, and
 * anything else is a version neither runnable nor retired, i.e. one this product
 * never defined.
 *
 * A supported version returns `undefined`: this function only ever names a
 * refusal, and "no refusal" is not a third answer.
 */
function versionRefusalOf(identity) {
    const supported = SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.join(', ');
    if (identity.migrationRequired) {
        return {
            code: BLUEPRINT_VERSION_REFUSAL_CODES.MIGRATION_REQUIRED,
            headline: `Blueprint ${identity.blueprintId}@${identity.revision} is a schema v${identity.schemaVersion} document; ` +
                `this build runs [${supported}]. It is listed in the catalog with migrationRequired=true — ` +
                `migrate it (the v3 document requires a teamHardEnvelope authority document) and it will start`,
        };
    }
    if (SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.includes(identity.schemaVersion)) {
        return undefined;
    }
    return {
        code: BLUEPRINT_VERSION_REFUSAL_CODES.SCHEMA_VERSION_UNSUPPORTED,
        headline: `Blueprint ${identity.blueprintId}@${identity.revision} declares schema v${identity.schemaVersion}, ` +
            `a version this build never defined; this build runs [${supported}]`,
    };
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
    // The bootstrap anchor: the one strong parse at construction (the inline
    // source is constant per host — today's root already parses it once per
    // construction).
    //
    // A4-PR7 Task 7.2 (A1-20(c)): that parse is now CONDITIONALLY non-fatal. A
    // VERSION refusal degrades the host instead of killing it — the catalog still
    // shows the anchor (as `migration-required`, when it has an identity), and
    // every Team bound to it is refused by name at start. Any other failure is a
    // configuration fault and still throws here, exactly as before;
    // `classifyBlueprintAnchor` owns that line and nothing here re-derives it.
    const anchor = classifyBlueprintAnchor(options.bootstrapSource);
    const bootstrap = anchor.status === 'runnable' ? anchor.blueprint : undefined;
    const bootstrapRef = bootstrap === undefined ? undefined : toBlueprintSnapshotRef(bootstrap);
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
                schemaVersion: row.schemaVersion,
                migrationRequired: migrationRequiredFor(row.schemaVersion),
            });
        }
        // The anchor arm. Runnable → the parsed identity, unchanged. Refused and
        // RETIRED → STILL listed, from the identity the inspector read before it
        // judged the version: this is the line that makes "the migration surface
        // still sees it" true for the host's own document, and without it the
        // operator's own Blueprint is the one entry the catalog cannot show. Refused
        // and UNIDENTIFIED (a version nobody defined) → not listed, because there is
        // no migration to advertise; the typed start refusal carries that instead.
        if (bootstrap !== undefined) {
            const bKey = identityKey(bootstrap.blueprintId, bootstrap.revision);
            if (!map.has(bKey)) {
                map.set(bKey, {
                    blueprintId: bootstrap.blueprintId,
                    revision: bootstrap.revision,
                    ...(bootstrapRef !== undefined ? { contentHash: bootstrapRef.contentHash } : {}),
                    origin: 'bootstrap',
                    schemaVersion: bootstrap.schemaVersion,
                    migrationRequired: migrationRequiredFor(bootstrap.schemaVersion),
                });
            }
        }
        else if (anchor.status === 'refused' && anchor.identity !== undefined) {
            const bKey = identityKey(anchor.identity.blueprintId, anchor.identity.revision);
            if (!map.has(bKey)) {
                map.set(bKey, {
                    blueprintId: anchor.identity.blueprintId,
                    revision: anchor.identity.revision,
                    origin: 'bootstrap',
                    schemaVersion: anchor.schemaVersion ?? 0,
                    migrationRequired: anchor.migrationRequired,
                });
            }
        }
        for (const name of sourceIndex.listSourceFiles()) {
            const inspection = sourceIndex.inspectSource(name);
            // ONLY `rejected` is dropped (plan §7.4: no identity → nothing to list).
            // `migration-required` is KEPT, and keeping it is Task 7.1's whole point:
            // before this line the two states were one `rejected`, so a Blueprint the
            // operator still has to migrate disappeared from `listIdentities` and from
            // the v8 catalog — the removal made the cutover look finished and left the
            // affected Team with no discoverable cause.
            if (inspection.status === 'rejected')
                continue;
            const { blueprintId, revision, schemaVersion } = inspection.identity;
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
            map.set(key, {
                blueprintId,
                revision,
                origin: 'saved',
                sourceFile: name,
                schemaVersion,
                // The STATUS is the classification, not the version: `ok` on a
                // supported version and `migration-required` on a retired one are read
                // from the same identity shape, and re-deriving it from
                // `RETIRED_BLUEPRINT_DOCUMENT_VERSIONS` here would put a second copy of
                // the rule where the inspector already answered.
                migrationRequired: inspection.status === 'migration-required',
            });
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
        // The version gate runs BEFORE any source is read or strong-parsed, and
        // before the origin branches: a retired document is refused the same way
        // whether it came off disk, out of the registry, or from the pinned anchor.
        // `parseBlueprint` would refuse it too (the same switch governs its set), but
        // with the domain's generic "this document cannot be read" diagnosis —
        // exactly the wording A1-21 forbids here, because the document reads
        // perfectly well and what it needs is a migration. Refusing on the IDENTITY
        // also means no retired source text is ever parsed, hashed, or handed to a
        // snapshot ref on the way to saying no.
        const refusal = versionRefusalOf(identity);
        if (refusal !== undefined) {
            throw new TeamPluginError(refusal.code, refusal.headline, {
                blueprintId,
                revision,
                schemaVersion: identity.schemaVersion,
                origin: identity.origin,
                migrationRequired: identity.migrationRequired,
                supportedVersions: [...SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS],
                ...(identity.sourceFile !== undefined ? { sourceFile: identity.sourceFile } : {}),
            });
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
            if (bootstrap === undefined) {
                // Unreachable by construction: an anchor this build cannot parse is
                // listed ONLY when it is retired, and the version gate above refuses
                // that identity before this arm is ever reached. It is written out
                // anyway because the function's contract is total — a degraded anchor
                // answers with its own typed name, never with `undefined` wearing a
                // `TeamBlueprint`.
                const fallback = versionRefusalOf(identity);
                throw new TeamPluginError(fallback?.code ?? BLUEPRINT_VERSION_REFUSAL_CODES.MIGRATION_REQUIRED, fallback?.headline ??
                    `the bootstrap anchor cannot be resolved: this build cannot parse it and no migration applies`, {
                    blueprintId,
                    revision,
                    origin: 'bootstrap',
                    reason: 'bootstrap-anchor-refused',
                    ...(anchor.status === 'refused' ? { code: anchor.code } : {}),
                });
            }
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
            // A4-PR7 Task 7.2 — the same refusal in front of the same durable write.
            // A frozen row is the registry's promise that this content is a PUBLISHED
            // revision; freezing a document this build will not run would launder an
            // unmigrated Blueprint into "already migrated" — the exact lie the
            // migration surface of Task 7.1 exists to prevent. Read from the identity
            // scan (no strong parse), and read BEFORE the idempotency short-circuit
            // below, so a re-drive of an old freeze attempt cannot slip past on a
            // same-hash match either.
            const frozen = registry.get(blueprintId, revision);
            const listedNow = scanIdentities().get(key);
            if (listedNow !== undefined && listedNow.origin !== 'frozen') {
                const refusal = versionRefusalOf(listedNow);
                if (refusal !== undefined) {
                    throw new TeamPluginError(refusal.code, refusal.headline, {
                        blueprintId,
                        revision,
                        schemaVersion: listedNow.schemaVersion,
                        migrationRequired: listedNow.migrationRequired,
                        reason: 'freeze-version-refused',
                    });
                }
            }
            else if (frozen !== undefined) {
                const refusal = versionRefusalOf({
                    blueprintId,
                    revision,
                    origin: 'frozen',
                    schemaVersion: frozen.schemaVersion,
                    migrationRequired: migrationRequiredFor(frozen.schemaVersion),
                });
                if (refusal !== undefined) {
                    throw new TeamPluginError(refusal.code, refusal.headline, {
                        blueprintId,
                        revision,
                        schemaVersion: frozen.schemaVersion,
                        reason: 'freeze-version-refused',
                    });
                }
            }
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