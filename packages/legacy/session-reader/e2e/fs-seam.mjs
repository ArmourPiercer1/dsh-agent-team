/**
 * fs-seam.mjs — the real-FS LegacyHomePort for the P7-T7 real-instance
 * harness (the read-only side of the seam between the session reader and
 * the booted host's DSH_HOME).
 *
 * The port exposes exactly the two read operations the reader's
 * LegacyHomePort contract declares (`listDir` / `readFile`), resolved
 * strictly INSIDE `process.env.DSH_HOME`: an absent path, a directory
 * where a file is expected, or any path escaping the home root yields
 * `undefined` — the reader's "absent" signal (the reader degrades
 * best-effort on absence; it never throws for a missing file). There is
 * no write surface here at all: the harness proves end to end that the
 * reader cannot mutate the home it inspects.
 *
 * The reader passes absolute, forward-slash-joined paths
 * (`joinPath` in inspect.ts); Node's fs accepts forward slashes on
 * Windows, so in-home values pass through unchanged.
 *
 * @module @dsh-agent-team/legacy/session-reader/e2e/fs-seam
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'

/**
 * The home root (DSH_HOME of the host process; set by the harness boot
 * driver). Read at call time so the port always sees the live value.
 * @returns {string} the DSH_HOME value, trailing separators stripped.
 */
function homeRoot() {
  const home = process.env.DSH_HOME
  if (typeof home !== 'string' || home.length === 0) {
    throw new Error('p7t7 fs-seam: DSH_HOME is not set in the host process environment')
  }
  return home.replace(/[\\/]+$/, '')
}

/**
 * Resolve a reader path strictly inside the home root.
 * @param {string} home - the home root (no trailing separator).
 * @param {string} p - the reader's path (absolute, forward slashes).
 * @returns {string|null} the path, or null when malformed/outside.
 */
function insideHome(home, p) {
  if (typeof p !== 'string' || p.length === 0) return null
  if (p.split('/').includes('..')) return null
  const homeLower = home.toLowerCase()
  const pLower = p.toLowerCase()
  if (pLower !== homeLower && !pLower.startsWith(`${homeLower}/`) && !pLower.startsWith(`${homeLower}\\`)) {
    return null
  }
  return p
}

/**
 * One read-only real-FS home port (the LegacyHomePort contract).
 * @returns {{
 *   listDir: (path: string) => Array<{name: string, kind: 'file'|'dir'}>|undefined,
 *   readFile: (path: string) => string|undefined,
 * }}
 */
export function createRealFsHomePort() {
  return {
    /**
     * List one directory directly under the home.
     * @param {string} path - the absolute directory path.
     * @returns the sorted entries, or undefined when absent/not a dir.
     */
    listDir(path) {
      const abs = insideHome(homeRoot(), path)
      if (abs === null || !existsSync(abs)) return undefined
      let st
      try {
        st = statSync(abs)
      } catch {
        return undefined
      }
      if (!st.isDirectory()) return undefined
      let entries
      try {
        entries = readdirSync(abs, { withFileTypes: true })
      } catch {
        return undefined
      }
      return entries
        .map((entry) => ({ name: entry.name, kind: entry.isDirectory() ? 'dir' : 'file' }))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    },
    /**
     * Read one file directly under the home.
     * @param {string} path - the absolute file path.
     * @returns the UTF-8 content, or undefined when absent/not a file.
     */
    readFile(path) {
      const abs = insideHome(homeRoot(), path)
      if (abs === null || !existsSync(abs)) return undefined
      let st
      try {
        st = statSync(abs)
      } catch {
        return undefined
      }
      if (!st.isFile()) return undefined
      try {
        return readFileSync(abs, 'utf8')
      } catch {
        return undefined
      }
    },
  }
}
