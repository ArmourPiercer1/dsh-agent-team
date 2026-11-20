/**
 * lane.mjs — the declared I/O lane model shared by the G1-FS prototype and its
 * golden-vector corpus.
 *
 * A "declared lane" is the pair of allow-subtrees an invocation is admitted
 * against (`read`, `write`), expressed as absolute host paths. It is a
 * PROTOTYPE model, not a second policy language: the old path compiles the same
 * two subtrees through the product's P1 compiler, and the corpus records the
 * declared roots verbatim so both sides are compared on the SAME declaration.
 *
 * Containment is `path.relative` based (the same algebra as the host provider's
 * own `contains()`): `child === parent` or a descendant, never a `..` escape.
 *
 * LIMIT (stated here because it is load-bearing): containment is evaluated on a
 * path that has already been resolved to a canonical host path by the provider
 * (`resolve()` realpaths). A lexical path check alone would NOT contain a
 * symlink, so callers must pass the provider-resolved path, never the authored
 * string.
 *
 * @module tests/ute-g1-fs/lib/lane
 */
import { isAbsolute, relative, resolve, sep } from 'node:path'

/**
 * Normalize one axis of allow-subtrees.
 * @param {readonly string[]} roots - absolute or base-relative subtrees.
 * @param {string} base - base for relative roots.
 * @returns {readonly string[]} frozen absolute roots, de-duplicated.
 */
export function normalizeRoots(roots, base) {
  if (!Array.isArray(roots)) throw new TypeError(`lane roots must be an array, got ${typeof roots}`)
  const seen = new Set()
  for (const root of roots) {
    if (typeof root !== 'string' || root.trim().length === 0) {
      throw new TypeError(`lane root must be a non-empty string, got ${JSON.stringify(root)}`)
    }
    const absolute = isAbsolute(root) ? resolve(root) : resolve(base, root)
    seen.add(absolute)
  }
  return Object.freeze([...seen])
}

/**
 * Build a frozen declared lane.
 * @param {{read?: readonly string[], write?: readonly string[], base?: string}} input
 * @returns {Readonly<{read: readonly string[], write: readonly string[]}>}
 */
export function declaredLane({ read = [], write = [], base = process.cwd() } = {}) {
  return Object.freeze({ read: normalizeRoots(read, base), write: normalizeRoots(write, base) })
}

/**
 * Canonical containment: is `hostPath` the root or beneath it?
 * @param {string} root - absolute canonical root.
 * @param {string} hostPath - absolute canonical candidate.
 * @returns {boolean}
 */
export function withinRoot(root, hostPath) {
  const rel = relative(root, hostPath)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

/**
 * Is `hostPath` inside ANY root of the axis?
 * @param {readonly string[]} roots
 * @param {string} hostPath
 * @returns {boolean}
 */
export function withinAny(roots, hostPath) {
  return roots.some((root) => withinRoot(root, hostPath))
}

/**
 * The refusal class vocabulary the corpus compares on. Both paths map their own
 * typed codes onto this closed set; the codes themselves are recorded but never
 * required to be equal across host generations.
 */
export const REFUSAL = Object.freeze({
  LANE_READ: 'lane-read',
  LANE_WRITE: 'lane-write',
  WRITE_REQUIRES_READ: 'write-requires-read',
  STALE_VERSION: 'stale-version',
  /** The routed definition could not resolve a service it needs (route-C `fs`). */
  ROUTE_UNRESOLVED: 'route-unresolved',
  /** The target does not exist at read/stat time. */
  MISSING_PATH: 'missing-path',
  /** The model route does not declare image input, so no image may be read. */
  IMAGE_MODALITY_DENIED: 'image-modality-denied',
  /** The call was cancelled (observed: before dispatch; mid-read would map here too). */
  CANCELLED: 'cancelled',
  /** Genuinely unclassifiable. A corpus vector may NOT rest here silently. */
  OTHER: 'other',
})
