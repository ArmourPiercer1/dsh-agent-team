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

import { readdirSync, readFileSync } from 'fs'

import { inspectBlueprintSource } from '../../../domain/blueprint/src/index.js'
import type { BlueprintInspectionResult } from '../../../domain/blueprint/src/index.js'

import { TeamPluginError } from './types.js'

/** A resolved (or absent) saved-source directory. */
interface SourceIndexState {
  /** The resolved absolute directory, or undefined when the catalog is disabled. */
  readonly dir: string | undefined
}

/**
 * The stateless filesystem index of saved Blueprint sources (one instance
 * per host; every call observes the CURRENT directory state).
 */
export interface BlueprintSourceIndex {
  /**
   * The resolved directory (absolute), or `undefined` when the filesystem
   * catalog is disabled (no `blueprintDir` configured).
   */
  readonly dir: string | undefined

  /**
   * The candidate saved-source file NAMES (regular files,
   * `*.yaml`/`*.yml`, drafts excluded), stable-sorted by name. Rescanned
   * on every call. Empty when the catalog is disabled or the directory is
   * absent at scan time.
   * @throws `TEAM_BLUEPRINT_DIR_UNREADABLE` for a present-but-unreadable
   *   directory.
   */
  listSourceFiles(): readonly string[]

  /**
   * The CURRENT raw source text of one saved source (fresh read, never
   * cached).
   * @param name - the file name (no path separators).
   * @throws `TEAM_BLUEPRINT_FILE_UNREADABLE` when the file cannot be read.
   */
  readSource(name: string): string

  /**
   * The IDENTITY-level inspection of one saved source (plan §7.4: the
   * weaker sibling of the strong parse — a logically broken document can
   * still be listed; it fails only when RESOLVED).
   * @param name - the file name (no path separators).
   */
  inspectSource(name: string): BlueprintInspectionResult
}

/**
 * True for a path that is absolute on POSIX or Windows (leading `/`, a
 * drive prefix `X:\` or `X:/`, or a UNC prefix `\\`).
 */
function isAbsoluteDir(dir: string): boolean {
  return /^(?:[A-Za-z]:[\\/]|\\|\/)/.test(dir)
}

/** Join the host cwd with a relative dir (no `path` module dependency). */
function resolveAgainstCwd(dir: string, cwd: string): string {
  const sep = cwd.includes('\\') ? '\\' : '/'
  const base = cwd.endsWith('/') || cwd.endsWith('\\') ? cwd : cwd + sep
  return base + dir
}

/** Plain file name fence: no path separators, no dot names. */
function assertSourceName(name: unknown): string {
  if (typeof name !== 'string' || name.length === 0 || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
    throw new TeamPluginError(
      'TEAM_BLUEPRINT_FILE_UNREADABLE',
      `blueprint source name must be a plain file name (no path separators): ${JSON.stringify(name)}`,
      { reason: 'invalid-source-name', name: String(name) },
    )
  }
  return name
}

function errorCodeOf(error: unknown): string | undefined {
  const code = (error as { code?: unknown })?.code
  return typeof code === 'string' ? code : undefined
}

/** A saved source name (case-insensitive extension match). */
function isCandidateSourceName(name: string): boolean {
  const lower = name.toLowerCase()
  if (lower.endsWith('.draft.yaml') || lower.endsWith('.draft.yml')) return false
  return lower.endsWith('.yaml') || lower.endsWith('.yml')
}

/**
 * Create the stateless saved-source index.
 * @param options - `blueprintDir` (absolute or relative to the host cwd);
 *   absent → the filesystem catalog is disabled.
 */
export function createBlueprintSourceIndex(options: {
  readonly blueprintDir?: string
  readonly cwd?: () => string
}): BlueprintSourceIndex {
  const cwdOf = options.cwd ?? (() => process.cwd())
  let dir: string | undefined
  if (options.blueprintDir !== undefined) {
    if (typeof options.blueprintDir !== 'string' || options.blueprintDir.length === 0) {
      throw new TeamPluginError(
        'TEAM_PLUGIN_CONFIG_INVALID',
        `blueprintDir must be a non-empty path string when present, got ${JSON.stringify(options.blueprintDir)}`,
        { field: 'blueprintDir' },
      )
    }
    dir = isAbsoluteDir(options.blueprintDir) ? options.blueprintDir : resolveAgainstCwd(options.blueprintDir, cwdOf())
  }
  const state: SourceIndexState = { dir }

  const scan = (): string[] => {
    if (state.dir === undefined) return []
    let entries
    try {
      entries = readdirSync(state.dir, { withFileTypes: true })
    } catch (error) {
      const code = errorCodeOf(error)
      if (code === 'ENOENT' || code === 'ENOTDIR') return [] // absent dir = the documented disabled state
      throw new TeamPluginError(
        'TEAM_BLUEPRINT_DIR_UNREADABLE',
        `blueprintDir scan failed: ${error instanceof Error ? error.message : String(error)}`,
        { dir: state.dir, reason: 'dir-unreadable', code },
      )
    }
    return entries
      .filter((entry) => entry.isFile() && isCandidateSourceName(entry.name))
      .map((entry) => entry.name)
      .sort()
  }

  const read = (name: string): string => {
    if (state.dir === undefined) {
      throw new TeamPluginError(
        'TEAM_BLUEPRINT_FILE_UNREADABLE',
        `cannot read saved source '${name}': the filesystem catalog is disabled (no blueprintDir configured)`,
        { reason: 'catalog-disabled', name },
      )
    }
    assertSourceName(name)
    const sep = state.dir.includes('\\') && !state.dir.startsWith('/') ? '\\' : '/'
    const full = state.dir.endsWith('/') || state.dir.endsWith('\\') ? state.dir + name : state.dir + sep + name
    try {
      return readFileSync(full, 'utf8')
    } catch (error) {
      const code = errorCodeOf(error)
      throw new TeamPluginError(
        'TEAM_BLUEPRINT_FILE_UNREADABLE',
        `cannot read saved source '${name}': ${error instanceof Error ? error.message : String(error)}`,
        { name, reason: 'file-unreadable', code },
      )
    }
  }

  const index: BlueprintSourceIndex = {
    dir: state.dir,
    listSourceFiles: () => scan(),
    readSource: read,
    inspectSource: (name: string) => inspectBlueprintSource(read(name)),
  }
  return index
}
