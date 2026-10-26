/**
 * world-kinds.mjs — the TestWorldFactory's World-kind registry, collected by
 * ENUMERATION (u7-w0, 2026-10-26).
 *
 * Until u7-w0 every C2 lane that needed its own World shape edited FOUR
 * places in lib/world-factory.mjs: the createWorld destructure + validation +
 * mutual-exclusion list, the TestWorld constructor (spec field, ledger and
 * marker paths), the startHost env set/clear block, and the patch-layer
 * if/else chain. 2 of the 7 merged U7 PRs did exactly that, and it was a
 * conflict site every time. A lane now ADDS ONE FILE,
 * `tests/world-factory/world-kinds/<NNN>-<kind>.mjs`, whose default export is:
 *
 *   {
 *     option: 'u7Foo',                // the createWorld option + TestWorld field
 *     probe: { src, rowId, fileName } | null,   // a test-only row copied beside
 *                                     // the profile patch and mounted first
 *     paths: { <worldProp>: ['home' | 'workspace', '<name>'] },  // OWNED paths
 *     ledgerRows: { <methodName>: '<worldProp>' },   // JSONL readers on the World
 *     envKeys: ['U7FOO_…', …],        // every key this kind may set (cleared on
 *                                     // every boot of every World)
 *     env: ({ world, factory }) => ({ U7FOO_…: '…' }),   // set on THIS kind's boots
 *     patchHeader: ['…', …],          // the profile-patch layer's comment lines
 *   }
 *
 * The factory keeps every law it had, now stated ONCE over the registry:
 *   - `createWorld({..., <option>: {rows: [...]}})` validates the spec shape
 *     and refuses two kind options on one World (mutually exclusive — both
 *     would race for the same profile patch file);
 *   - an option no kind declares is REFUSED (before u7-w0 an unknown key was
 *     silently ignored by the destructure — a removed kind module would have
 *     booted a plain canary World and judged it; now it is a typed refusal);
 *   - every declared path lives under the World's owned home (the FIX-T T3
 *     owned-path guard extends over every kind's paths, not three names);
 *   - env: every kind's envKeys are cleared on every boot, then ONLY the
 *     active kind's env is set — the same end state the per-kind
 *     set-or-delete blocks produced (the ARC-D block's re-pin of the two
 *     U6ARC_* seam URLs is now simply part of its own env).
 *
 * Order: files sort by name (the numeric prefix). With mutual exclusion the
 * order is not semantic; it is fixed only so error messages and the registry
 * listing are deterministic.
 */
import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const WORLD_KINDS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'world-kinds')
const FILE_NAME = /^\d{3}-[a-z0-9][a-z0-9-]*\.mjs$/
/** createWorld options that belong to the factory itself, never to a kind. */
export const CORE_WORLD_OPTIONS = Object.freeze(['line', 'visible', 'badMount', 'restartIndex', 'extContributors', 'centerAssembly'])

/**
 * Load and validate every kind module (sorted). FAIL-CLOSED: a mis-named
 * file, a malformed descriptor, a duplicate option, a clash with a core
 * option, a duplicate World property/method, or a path rooted anywhere but
 * the World's home/workspace throws.
 * @param {string} [dir]
 */
export async function loadWorldKinds(dir = WORLD_KINDS_DIR) {
  // EVERY entry is enumerated (u7-w0 review R1 F-1): a subdirectory, dotfile or
  // other extension refuses by name instead of being silently skipped.
  const entries = readdirSync(dir, { withFileTypes: true })
  const stray = entries.filter((e) => !e.isFile() || !FILE_NAME.test(e.name)).map((e) => `${e.name}${e.isDirectory() ? '/' : ''}`).sort()
  if (stray.length > 0) throw new Error(`world-kinds: stray-entry ${stray.join(', ')} (world-kinds modules are <NNN>-<kind>.mjs)`)
  const files = entries.map((e) => e.name).sort()
  const kinds = []
  const options = new Set(CORE_WORLD_OPTIONS)
  const members = new Set()
  for (const file of files) {
    if (!FILE_NAME.test(file)) throw new Error(`world-kinds: ${file}: kind modules are <NNN>-<kind>.mjs (the prefix is the order)`)
    const mod = await import(pathToFileURL(join(dir, file)).href)
    const k = mod.default
    const where = `world-kinds/${file}`
    if (k === null || typeof k !== 'object') throw new Error(`${where}: default export must be a kind descriptor object`)
    if (typeof k.option !== 'string' || !/^[a-z][A-Za-z0-9]*$/.test(k.option)) throw new Error(`${where}: option must be a camelCase identifier`)
    if (options.has(k.option)) throw new Error(`${where}: option ${k.option} is already declared (by a core option or another kind)`)
    options.add(k.option)
    if (k.probe !== null && !(typeof k.probe?.src === 'string' && typeof k.probe?.rowId === 'string' && typeof k.probe?.fileName === 'string' && /^[a-z0-9.-]+\.mjs$/.test(k.probe.fileName))) {
      throw new Error(`${where}: probe must be null or {src, rowId, fileName: '<name>.mjs'}`)
    }
    for (const [prop, spec] of Object.entries(k.paths ?? {})) {
      if (!Array.isArray(spec) || spec.length !== 2 || !['home', 'workspace'].includes(spec[0]) || !/^[a-z0-9][a-z0-9.-]*$/.test(String(spec[1]))) {
        throw new Error(`${where}: paths.${prop} must be ['home' | 'workspace', '<bare name>'] (owned paths only)`)
      }
      if (members.has(prop)) throw new Error(`${where}: World property ${prop} is already declared by another kind`)
      members.add(prop)
    }
    for (const [method, prop] of Object.entries(k.ledgerRows ?? {})) {
      if (!(prop in (k.paths ?? {}))) throw new Error(`${where}: ledgerRows.${method} names ${String(prop)}, which is not one of this kind's paths`)
      if (members.has(method)) throw new Error(`${where}: World member ${method} is already declared by another kind`)
      members.add(method)
    }
    if (!Array.isArray(k.envKeys) || k.envKeys.some((e) => typeof e !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(e))) throw new Error(`${where}: envKeys must be a list of ENV_NAMES`)
    if (typeof k.env !== 'function') throw new Error(`${where}: env must be a function ({world, factory}) => ({...})`)
    if (!Array.isArray(k.patchHeader) || k.patchHeader.length === 0) throw new Error(`${where}: patchHeader must be a non-empty list of comment lines`)
    kinds.push(Object.freeze({ ...k, file }))
  }
  return Object.freeze(kinds)
}

/** Validate one kind option value: `{rows: [...]}` or null (the original law). */
export function validateKindSpec(kind, value) {
  if (value !== null && !(typeof value === 'object' && Array.isArray(value.rows))) {
    throw new Error(`invalid ${kind.option} (expected {rows: [...]} | null)`)
  }
}

/** The env a boot must carry for `activeKind` (null = no kind): every kind's keys cleared, then the active kind's set. */
export function applyKindEnv({ kinds, activeKind, world, factory, env = process.env }) {
  for (const k of kinds) for (const key of k.envKeys) delete env[key]
  if (activeKind === null) return {}
  const values = activeKind.env({ world, factory })
  for (const [key, value] of Object.entries(values)) {
    if (!activeKind.envKeys.includes(key)) throw new Error(`world-kinds/${activeKind.file}: env sets ${key}, which its envKeys do not declare (it would never be cleared)`)
    env[key] = String(value)
  }
  return values
}
