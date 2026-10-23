/**
 * tests/kits/lib/world-safety.mjs — entry-safety law for test-world kits.
 *
 * ROOT CAUSE CLASS (2026-10-23 incident, entry-level): a kit entry that
 * (a) executes main on IMPORT, (b) defaults HOME to REPO when the world arg
 * is missing/invalid, and (c) lets any cleanup/teardown resolve against
 * HOME (or worse, fall back to a parent directory when a precondition such
 * as a disk check misreads) can recursively delete the repository, worktrees
 * or HOME. This module is the single choke point that makes all three
 * impossible for the kit entries that adopt it:
 *
 *   L1  PARSE LAW   — parseWorldArg(): the world must be a single safe
 *                     basename under tests/homes (legacy 'tests/homes/x' and
 *                     'homes/x' prefixes accepted for compatibility).
 *                     Anything else (empty, '.', '..', absolute, traversal,
 *                     homesRoot itself, repo root, cwd, $HOME, fs root,
 *                     anything under a '.worktrees' segment, symlinked world)
 *                     THROWS before the caller touches the filesystem.
 *   L2  REGISTER    — the ONLY path a later cleanup may delete under is the
 *                     exact realpath returned by parseWorldArg, carried by the
 *                     caller as the registered target.
 *   L3  RE-ASSERT   — assertCleanupTarget() re-validates the registered path
 *                     at delete time (symlink swaps / TOCTOU). ANY failure
 *                     throws; there is NO fallback to a parent directory,
 *                     ever. rm -rf of anything else is not reachable through
 *                     this module.
 *
 * Zero filesystem side effects here (reads/stat only); zero dependencies.
 */
import { lstatSync, realpathSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve, sep, join } from 'node:path'

export class WorldSafetyError extends Error {}

const BAD = (msg) => { throw new WorldSafetyError(`world-safety: ${msg}`) }

function realpathSafe(p) {
  try { return realpathSync(p) } catch { return null }
}

/** Realpath-or-null set of paths a world/cleanup target must never be or contain. */
function forbiddenSet({ repoRoot, homesRoot, cwd }) {
  const out = new Set()
  for (const p of [repoRoot, homesRoot, cwd, homedir(), resolve(sep)]) {
    if (typeof p === 'string' && p.length > 0) {
      out.add(resolve(p))
      const rp = realpathSafe(p)
      if (rp !== null) out.add(rp)
    }
  }
  return out
}

function hasWorktreesSegment(p) {
  return p.split(sep).filter(Boolean).includes('.worktrees')
}

/**
 * L1+L2. Validate --world and return { home, homeReal }.
 * @param {object} opts
 * @param {string} opts.repoRoot  - resolved repository root
 * @param {string} opts.homesRoot - resolved tests/homes root
 * @param {string|null} opts.worldArg - raw --world value
 * @param {string} [opts.cwd]
 */
export function parseWorldArg({ repoRoot, homesRoot, worldArg, cwd = process.cwd() }) {
  if (typeof worldArg !== 'string' || worldArg.trim() === '') BAD('--world is REQUIRED (no default; refusing to derive a world)')
  if (worldArg.includes('\0') || worldArg.startsWith('-')) BAD(`--world rejected (control character or flag-shaped): ${JSON.stringify(worldArg)}`)
  if (worldArg.startsWith('/') || /^[A-Za-z]:[\\/]/.test(worldArg) || worldArg.startsWith('\\\\')) BAD(`--world must be relative to the repo homes root (absolute refused): ${worldArg}`)

  // Compatibility: accept the documented 'tests/homes/<name>' / 'homes/<name>' forms;
  // everything else must already be a single bare name.
  let name = worldArg
  for (const prefix of ['tests/homes/', 'homes/', 'tests\\homes\\', 'homes\\']) {
    if (name.startsWith(prefix)) { name = name.slice(prefix.length); break }
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._@-]*$/.test(name)) BAD(`--world must be ONE safe basename under tests/homes (got ${JSON.stringify(worldArg)}; traversal, dot-names, nested paths and dot-dot are refused)`)

  const forbidden = forbiddenSet({ repoRoot, homesRoot, cwd })
  const home = resolve(homesRoot, name)
  if (home === resolve(homesRoot)) BAD('--world must not be the homes root itself')
  // Worlds legitimately live INSIDE the repo — danger is EQUALITY with, or CONTAINMENT of,
  // a protected root (deleting the world would destroy it), never mere ancestry.
  for (const f of forbidden) if (home === f || f.startsWith(home + sep)) BAD(`--world equals or contains a protected root (${f}): ${home}`)
  if (hasWorktreesSegment(home)) BAD(`--world must never be under a .worktrees segment: ${home}`)

  if (existsSync(home)) {
    const st = lstatSync(home)
    if (st.isSymbolicLink()) BAD(`world directory must not be a symlink: ${home}`)
    const homeReal = realpathSafe(home)
    if (homeReal === null) BAD(`cannot resolve realpath of world: ${home}`)
    const homesReal = realpathSafe(homesRoot) ?? resolve(homesRoot)
    if (!homeReal.startsWith(homesReal + sep) || homeReal === homesReal) BAD(`world realpath escapes the homes root: ${homeReal}`)
    for (const f of forbidden) if (homeReal === f || f.startsWith(homeReal + sep)) BAD(`world realpath equals or contains a protected root (${f}): ${homeReal}`)
    return { home, homeReal }
  }
  return { home, homeReal: home } // not yet created: no symlink possible yet
}

/**
 * L3. Re-validate a registered cleanup target immediately BEFORE any delete.
 * @param {object} opts
 * @param {string} opts.registered - the homeReal returned by parseWorldArg (exact value carried by the caller)
 * @param {string} opts.target     - the path about to be removed (must equal the registered world or live strictly under it)
 * plus the same repoRoot/homesRoot/cwd context as parseWorldArg.
 * @returns {string} the validated target — or THROWS (never falls back).
 */
export function assertCleanupTarget({ registered, target, repoRoot, homesRoot, cwd = process.cwd() }) {
  if (typeof registered !== 'string' || registered === '') BAD('no registered world — cleanup is not authorized (fail closed, no fallback)')
  const forbidden = forbiddenSet({ repoRoot, homesRoot, cwd })
  const homesReal = realpathSafe(homesRoot) ?? resolve(homesRoot)
  if (registered === homesReal || !registered.startsWith(homesReal + sep)) BAD(`registered world is not strictly under the homes root: ${registered}`)
  for (const f of forbidden) if (registered === f || f.startsWith(registered + sep)) BAD(`registered world equals or contains a protected root (${f})`)
  const t = resolve(target)
  if (t !== registered && !t.startsWith(registered + sep)) BAD(`cleanup target not inside the registered world (no parent fallback): ${t}`)
  if (existsSync(t)) {
    const st = lstatSync(t)
    if (st.isSymbolicLink()) BAD(`cleanup target is a symlink (refusing to follow): ${t}`)
    const tReal = realpathSafe(t)
    if (tReal === null) BAD(`cannot resolve realpath of cleanup target: ${t}`)
    if (!tReal.startsWith(registered) && !tReal.startsWith(homesReal + sep)) BAD(`cleanup realpath escapes the registered world: ${tReal}`)
    if (tReal === homesReal || tReal === (realpathSafe(repoRoot) ?? repoRoot)) BAD(`cleanup realpath would touch homes root or repo root: ${tReal}`)
    if (hasWorktreesSegment(tReal)) BAD(`cleanup realpath is under a .worktrees segment: ${tReal}`)
  }
  return t
}

/**
 * Entry guard: true only when this file is the process entry (direct run).
 * Importing a kit module must NEVER execute its main().
 */
export function isDirectEntry(importMetaUrl, argv1) {
  if (typeof argv1 !== 'string' || argv1 === '') return false
  try {
    const self = realpathSync(new URL(importMetaUrl).pathname)
    const entry = realpathSync(resolve(argv1))
    return self === entry
  } catch { return false }
}
