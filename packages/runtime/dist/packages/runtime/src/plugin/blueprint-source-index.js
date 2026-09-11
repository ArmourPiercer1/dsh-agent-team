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
import { readdirSync, readFileSync } from 'fs';
import { inspectBlueprintSource } from '../../../domain/blueprint/src/index.js';
import { TeamPluginError } from './types.js';
/**
 * True for a path that is absolute on POSIX or Windows (leading `/`, a
 * drive prefix `X:\` or `X:/`, or a UNC prefix `\\`).
 */
function isAbsoluteDir(dir) {
    return /^(?:[A-Za-z]:[\\/]|\\|\/)/.test(dir);
}
/** Join the host cwd with a relative dir (no `path` module dependency). */
function resolveAgainstCwd(dir, cwd) {
    const sep = cwd.includes('\\') ? '\\' : '/';
    const base = cwd.endsWith('/') || cwd.endsWith('\\') ? cwd : cwd + sep;
    return base + dir;
}
/** Plain file name fence: no path separators, no dot names. */
function assertSourceName(name) {
    if (typeof name !== 'string' || name.length === 0 || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
        throw new TeamPluginError('TEAM_BLUEPRINT_FILE_UNREADABLE', `blueprint source name must be a plain file name (no path separators): ${JSON.stringify(name)}`, { reason: 'invalid-source-name', name: String(name) });
    }
    return name;
}
function errorCodeOf(error) {
    const code = error?.code;
    return typeof code === 'string' ? code : undefined;
}
/** A saved source name (case-insensitive extension match). */
function isCandidateSourceName(name) {
    const lower = name.toLowerCase();
    if (lower.endsWith('.draft.yaml') || lower.endsWith('.draft.yml'))
        return false;
    return lower.endsWith('.yaml') || lower.endsWith('.yml');
}
/**
 * Create the stateless saved-source index.
 * @param options - `blueprintDir` (absolute or relative to the host cwd);
 *   absent → the filesystem catalog is disabled.
 */
export function createBlueprintSourceIndex(options) {
    const cwdOf = options.cwd ?? (() => process.cwd());
    let dir;
    if (options.blueprintDir !== undefined) {
        if (typeof options.blueprintDir !== 'string' || options.blueprintDir.length === 0) {
            throw new TeamPluginError('TEAM_PLUGIN_CONFIG_INVALID', `blueprintDir must be a non-empty path string when present, got ${JSON.stringify(options.blueprintDir)}`, { field: 'blueprintDir' });
        }
        dir = isAbsoluteDir(options.blueprintDir) ? options.blueprintDir : resolveAgainstCwd(options.blueprintDir, cwdOf());
    }
    const state = { dir };
    const scan = () => {
        if (state.dir === undefined)
            return [];
        let entries;
        try {
            entries = readdirSync(state.dir, { withFileTypes: true });
        }
        catch (error) {
            const code = errorCodeOf(error);
            if (code === 'ENOENT' || code === 'ENOTDIR')
                return []; // absent dir = the documented disabled state
            throw new TeamPluginError('TEAM_BLUEPRINT_DIR_UNREADABLE', `blueprintDir scan failed: ${error instanceof Error ? error.message : String(error)}`, { dir: state.dir, reason: 'dir-unreadable', code });
        }
        return entries
            .filter((entry) => entry.isFile() && isCandidateSourceName(entry.name))
            .map((entry) => entry.name)
            .sort();
    };
    const read = (name) => {
        if (state.dir === undefined) {
            throw new TeamPluginError('TEAM_BLUEPRINT_FILE_UNREADABLE', `cannot read saved source '${name}': the filesystem catalog is disabled (no blueprintDir configured)`, { reason: 'catalog-disabled', name });
        }
        assertSourceName(name);
        const sep = state.dir.includes('\\') && !state.dir.startsWith('/') ? '\\' : '/';
        const full = state.dir.endsWith('/') || state.dir.endsWith('\\') ? state.dir + name : state.dir + sep + name;
        try {
            return readFileSync(full, 'utf8');
        }
        catch (error) {
            const code = errorCodeOf(error);
            throw new TeamPluginError('TEAM_BLUEPRINT_FILE_UNREADABLE', `cannot read saved source '${name}': ${error instanceof Error ? error.message : String(error)}`, { name, reason: 'file-unreadable', code });
        }
    };
    const index = {
        dir: state.dir,
        listSourceFiles: () => scan(),
        readSource: read,
        inspectSource: (name) => inspectBlueprintSource(read(name)),
    };
    return index;
}
//# sourceMappingURL=blueprint-source-index.js.map