/**
 * legacy-fs-port.mjs — the read-only legacy-home filesystem port over
 * node:fs (P8-S5 production live layer; S1A A29).
 *
 * Implements `LegacyHomePort` (packages/legacy/session-reader/types.ts):
 *
 *   listDir(path)  -> readonly { name, kind: 'file' | 'dir' }[] | undefined
 *   readFile(path) -> string | undefined
 *
 * Best-effort by contract: a missing path returns `undefined` (never
 * throws); the reader degrades around malformed entries. The paths are
 * ABSOLUTE (the reader joins the inspect request's `dshHome` root with
 * the subpath itself), so the port is home-agnostic: it serves whatever
 * legacy instance home the inspect request names (the production default
 * is this instance's own `DSH_HOME`, but the port never assumes it).
 *
 * LIVE-WORLD MODULE: `node:` imports; loaded ONLY through the dynamic
 * `import()` in `host.ts`. Type surface: the sibling `legacy-fs-port.d.mts`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'

/**
 * Build the read-only legacy home port over node:fs.
 *
 * @param {object} [options]
 * @param {string} [options.homeRoot] - optional root guard: when set,
 *   every path is resolved against it and must stay UNDER it (the
 *   production default keeps the reader on this instance's own home).
 *   Absent: the paths are used verbatim (the port stays home-agnostic).
 * @returns {{ listDir: (path: string) => readonly {name: string, kind: 'file'|'dir'}[] | undefined, readFile: (path: string) => string | undefined }}
 *   a LegacyHomePort.
 */
export function buildLegacyHomePort(options = {}) {
  const homeRoot = typeof options.homeRoot === 'string' && options.homeRoot.length > 0
    ? options.homeRoot
    : undefined

  /**
   * Resolve one requested path against the optional root guard.
   * @param {string} path - the requested path (absolute or root-relative).
   * @returns {string | null} the resolved path, or `null` when the guard
   *   rejects it (outside the root).
   */
  function resolvePath(path) {
    if (typeof path !== 'string' || path.length === 0) return null
    if (homeRoot === undefined) return path
    const sep = homeRoot.endsWith('/') ? '' : '/'
    const root = homeRoot + sep
    if (!path.startsWith(root)) return null
    return path
  }

  return {
    /**
     * List one directory (best-effort: `undefined` when absent / not a
     * readable directory).
     * @param {string} path - the directory path.
     * @returns the entries, or `undefined`.
     */
    listDir(path) {
      const resolved = resolvePath(path)
      if (resolved === null) return undefined
      let entries
      try {
        entries = readdirSync(resolved, { withFileTypes: true })
      } catch {
        return undefined
      }
      const out = []
      for (const entry of entries) {
        let kind
        if (entry.isDirectory()) {
          kind = 'dir'
        } else if (entry.isFile()) {
          kind = 'file'
        } else {
          // Symlinks / specials: classify through stat (best-effort).
          try {
            kind = statSync(resolved + '/' + entry.name).isDirectory() ? 'dir' : 'file'
          } catch {
            continue // unreadable special: degrade around it
          }
        }
        out.push({ name: entry.name, kind })
      }
      return out
    },
    /**
     * Read one UTF-8 text file (best-effort: `undefined` when absent /
     * not a readable file).
     * @param {string} path - the file path.
     * @returns the file content, or `undefined`.
     */
    readFile(path) {
      const resolved = resolvePath(path)
      if (resolved === null) return undefined
      try {
        return readFileSync(resolved, 'utf8')
      } catch {
        return undefined
      }
    },
  }
}
