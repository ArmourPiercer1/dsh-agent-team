/**
 * Characterization harness — public exports surface resolver.
 *
 * Builds the public-surface whitelist of the pinned upstream tree: every
 * non-node_modules package.json maps its package name to its `exports`
 * surface. This is the C4b-equivalent of scripts/verify-zero-core.mjs
 * (P1-T5), re-implemented self-contained because the harness must stand
 * alone (task P2-T1: "harness must be self-contained"); the independent
 * machine check that the two stay semantically aligned is the
 * verify-zero-core C4 run over the harness source (see README).
 *
 * Surface forms (same semantics as verify-zero-core buildPublicSurface):
 *   - `unrestricted` — no `exports` field: legacy resolution admits every
 *     subpath;
 *   - `root-only`    — `exports` is a string: only the package root;
 *   - `map`          — `exports` is an object: only the declared keys
 *     (including `*` wildcards) are public;
 *   - `invalid`      — `exports` is an array (invalid per Node): nothing is
 *     admitted.
 */
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { walk } from './util.mjs'

const SKIP_DIRS = new Set(['node_modules', '.git'])

/**
 * Collect every non-ignored package.json of the host tree.
 * @returns {Array<{path: string, dir: string, name: string, version: string|undefined, raw: object}>}
 */
export function collectPackages(hostTree) {
  const packages = []
  for (const item of walk(hostTree, SKIP_DIRS)) {
    if (item.name !== 'package.json') continue
    let parsed
    try {
      parsed = JSON.parse(readFileSync(item.path, 'utf8'))
    } catch {
      continue
    }
    if (typeof parsed.name !== 'string') continue
    packages.push({
      path: item.path,
      dir: dirname(item.path),
      name: parsed.name,
      version: typeof parsed.version === 'string' ? parsed.version : undefined,
      raw: parsed,
    })
  }
  return packages
}

/**
 * Build the public surface: package name -> { dir, version, form, exportsKeys,
 * rootTarget, exports }. `exportsKeys` is the sorted key list (or [''] for
 * root-only, [] for unrestricted/invalid) — the whitelist itself.
 * `rootTarget` is the file the package root points at (the "key entry name"),
 * best-effort across ESM conditions.
 *
 * @returns {Map<string, {dir: string, version: string|undefined, form: string, exportsKeys: string[], rootTarget: string|undefined, exports: unknown}>}
 */
export function buildPublicSurface(hostTree) {
  const surface = new Map()
  for (const pkg of collectPackages(hostTree)) {
    surface.set(pkg.name, normalizeSurface(pkg))
  }
  return surface
}

/** Normalize one package's exports manifest into the surface record. */
export function normalizeSurface(pkg) {
  const exports = pkg.raw.exports
  let form
  let exportsKeys
  if (exports === undefined) {
    form = 'unrestricted'
    exportsKeys = []
  } else if (typeof exports === 'string') {
    form = 'root-only'
    exportsKeys = ['']
  } else if (Array.isArray(exports)) {
    form = 'invalid'
    exportsKeys = []
  } else {
    form = 'map'
    exportsKeys = [...Object.keys(exports)].sort()
  }
  return {
    dir: pkg.dir,
    version: pkg.version,
    form,
    exportsKeys,
    rootTarget: rootTargetOf(exports),
    exports,
  }
}

/** Best-effort file target of the package root export ('.'). */
function rootTargetOf(exports) {
  if (typeof exports === 'string') return exports
  if (exports === undefined || Array.isArray(exports) || typeof exports !== 'object') return undefined
  const root = exports['.']
  if (typeof root === 'string') return root
  if (root === undefined || typeof root !== 'object') return undefined
  for (const condition of ['default', 'import', 'require']) {
    const target = root[condition]
    if (typeof target === 'string') return target
  }
  return undefined
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Whether a subpath is admitted by a package's exports surface (same
 * semantics as verify-zero-core exportsAdmits, including `*` wildcards).
 * `subpath` is the part after the package name ('' for the package root).
 */
export function exportsAdmits(surfaceEntry, subpath) {
  const { form, exportsKeys } = surfaceEntry
  if (form === 'unrestricted') return true
  if (subpath === '') return form === 'root-only' || form === 'map' && exportsKeys.includes('.')
  if (form === 'root-only' || form === 'invalid') return false
  const norm = subpath.startsWith('./') ? subpath : `./${subpath.replace(/^\/+/, '')}`
  if (exportsKeys.includes(norm)) return true
  for (const key of exportsKeys) {
    if (!key.includes('*')) continue
    const pattern = `^${key.split('*').map(escapeRegExp).join('.*')}$`
    if (new RegExp(pattern).test(norm)) return true
  }
  return false
}

/**
 * Longest-surface-name match for a bare specifier (same resolution order as
 * verify-zero-core C4): the spec must equal a package name or start with
 * `name + '/'`.
 */
export function matchPackageName(spec, surface) {
  let best
  for (const name of surface.keys()) {
    if (spec === name || spec.startsWith(`${name}/`)) {
      if (best === undefined || name.length > best.length) best = name
    }
  }
  return best
}

/**
 * Check one bare specifier against the surface.
 * @returns {admitted: boolean, package: string|undefined, subpath: string, reason: string}
 */
export function checkSpecifier(spec, surface) {
  const best = matchPackageName(spec, surface)
  if (best === undefined) {
    return { admitted: true, package: undefined, subpath: spec, reason: 'third-party (not a host-tree package)' }
  }
  const subpath = best === spec ? '' : spec.slice(best.length)
  const entry = surface.get(best)
  const admitted = exportsAdmits(entry, subpath)
  return {
    admitted,
    package: best,
    subpath,
    reason: admitted
      ? `admitted by ${best} exports (${entry.form})`
      : `subpath "${subpath === '' ? '.' : subpath}" is not in the ${entry.form} exports surface of ${best}`,
  }
}
