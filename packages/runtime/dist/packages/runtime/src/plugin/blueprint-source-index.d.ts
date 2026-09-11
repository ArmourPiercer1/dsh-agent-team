/**
 * BlueprintSourceIndex — the filesystem index of SAVED Blueprint sources
 * (issue #2 blueprint-loading parallel repair, plan BP3).
 *
 * The domain package owns no I/O; this host-side module is the only place
 * the runtime reads the saved-source directory. It is deliberately NARROW
 * and STATELESS: every method call rescans the current directory state —
 * there is no install-lifetime snapshot, no watcher, no cache (plan §7.3:
 * "scan every request"). A source added after boot is visible on the next
 * catalog query; a source deleted disappears from the next query (unless
 * its revision is frozen — the registry, not this index, keeps it).
 *
 * Path semantics (plan §7.2 — documented, no row-location guessing):
 *
 *   - absolute `blueprintDir` → as-is;
 *   - relative `blueprintDir` → resolved against the HOST `process.cwd()`;
 *   - absent `blueprintDir`   → the filesystem catalog is DISABLED (every
 *     scan returns empty; the behavior degrades to the legacy "inline
 *     bootstrap Blueprint only").
 *
 * File rules (plan §7.3):
 *
 *   - `*.yaml` / `*.yml`            → candidate saved source;
 *   - `*.draft.yaml` / `*.draft.yml` → IGNORED (the authoring staging
 *     surface — drafts are never part of the catalog, never a duplicate);
 *   - anything else                 → ignored.
 *
 * Scan behavior: one `readdir` per call (regular files only), stable sort
 * by file name, IDENTITY-level inspection of each candidate via the
 * domain's `inspectBlueprintSource` (plan §7.4: NEVER a whole-catalog
 * strong parse — one logically broken saved Blueprint must not take down
 * the catalog; a file whose identity itself is unusable simply carries no
 * identity and is absent from the listing, like any non-Blueprint file).
 *
 * Fail-closed I/O: a directory that does not exist is the documented
 * "disabled" state (ENOENT → empty, no error); every OTHER scan error
 * (EACCES/ENOTDIR/...) raises `TEAM_BLUEPRINT_DIR_UNREADABLE`; a file that
 * cannot be read raises `TEAM_BLUEPRINT_FILE_UNREADABLE`. Source names are
 * plain file names — a name with path separators is rejected (traversal
 * fence; the index never escapes its own directory).
 *
 * @module @dsh-agent-team/runtime/src/plugin/blueprint-source-index
 */
import type { BlueprintInspectionResult } from '../../../domain/blueprint/src/index.js';
/**
 * The stateless filesystem index of saved Blueprint sources (one instance
 * per host; every call observes the CURRENT directory state).
 */
export interface BlueprintSourceIndex {
    /**
     * The resolved directory (absolute), or `undefined` when the filesystem
     * catalog is disabled (no `blueprintDir` configured).
     */
    readonly dir: string | undefined;
    /**
     * The candidate saved-source file NAMES (regular files,
     * `*.yaml`/`*.yml`, drafts excluded), stable-sorted by name. Rescanned
     * on every call. Empty when the catalog is disabled or the directory is
     * absent at scan time.
     * @throws `TEAM_BLUEPRINT_DIR_UNREADABLE` for a present-but-unreadable
     *   directory.
     */
    listSourceFiles(): readonly string[];
    /**
     * The CURRENT raw source text of one saved source (fresh read, never
     * cached).
     * @param name - the file name (no path separators).
     * @throws `TEAM_BLUEPRINT_FILE_UNREADABLE` when the file cannot be read.
     */
    readSource(name: string): string;
    /**
     * The IDENTITY-level inspection of one saved source (plan §7.4: the
     * weaker sibling of the strong parse — a logically broken document can
     * still be listed; it fails only when RESOLVED).
     * @param name - the file name (no path separators).
     */
    inspectSource(name: string): BlueprintInspectionResult;
}
/**
 * Create the stateless saved-source index.
 * @param options - `blueprintDir` (absolute or relative to the host cwd);
 *   absent → the filesystem catalog is disabled.
 */
export declare function createBlueprintSourceIndex(options: {
    readonly blueprintDir?: string;
    readonly cwd?: () => string;
}): BlueprintSourceIndex;
//# sourceMappingURL=blueprint-source-index.d.ts.map