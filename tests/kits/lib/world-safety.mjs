/**
 * tests/kits/lib/world-safety.mjs — entry-safety law for test-world kits (v2).
 *
 * ROOT CAUSE CLASS (2026-10-23 incident): import executed main; missing/invalid
 * world arg defaulted HOME to REPO; a cleanup then recursively deleted under a
 * misderived path. v1 of this guard was BLOCKed by an independent narrow review
 * (root 1805) for four defects, all closed here and sentinel-proven:
 *   - AND-joined containment let ANY sibling under homes pass; realpath checks
 *     now require EXACT equality with the registered world or registered+SEP
 *     (no prefix-boundary leak: /homes/w-10 is not inside /homes/w-1).
 *   - registration records the REAL identity (dev/ino) and cleanup re-checks
 *     path identity (symlink swap AND directory-replacement swap throw).
 *   - existsSync cannot see DANGLING symlinks; every path component check now
 *     goes through lstat (dangling, symlink-to-outside, file-in-the-way all
 *     throw), including the whole ancestor chain from the target up to the
 *     registered world.
 *   - the '.worktrees' segment refusal applies to the real home path as well
 *     (lexical AND realpath).
 *
 * LAW:
 *   L1 PARSE     — parseWorldArg(): single safe basename under tests/homes
 *                  (legacy 'tests/homes/'/'homes/' prefixes accepted).
 *                  Empty / '.' / '..' / absolute / traversal / homes-root /
 *                  equality-or-containment of a protected root (repo, cwd,
 *                  $HOME, fs root) / '.worktrees' anywhere / symlinked or
 *                  dangling or non-directory world  ->  THROW before any touch.
 *   L2 REGISTER  — the ONLY deletable region is the EXACT registered world
 *                  (path + dev/ino identity) carried by the caller.
 *   L3 RE-ASSERT — assertCleanupTarget() re-validates identity, symlink/dangling
 *                  ancestor chain, strict containment, protected roots,
 *                  .worktrees. ANY failure throws. NO parent fallback. Ever.
 *
 * Zero filesystem writes here (stat/lstat/realpath reads only); zero deps.
 */
import { lstatSync, realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve, sep, dirname } from 'node:path'

export class WorldSafetyError extends Error {}

const BAD = (msg) => { throw new WorldSafetyError(`world-safety: ${msg}`) }

const realpathSafe = (p) => { try { return realpathSync(p) } catch { return null } }
const lstatSafe = (p) => { try { return lstatSync(p) } catch { return null } }

function protectedRoots({ repoRoot, homesRoot, cwd }) {
  const out = new Set()
  for (const p of [repoRoot, homesRoot, cwd, homedir(), resolve(sep)]) {
    if (typeof p !== 'string' || p === '') continue
    out.add(resolve(p))
    const rp = realpathSafe(p)
    if (rp !== null) out.add(rp)
  }
  return out
}
const hasWorktrees = (p) => p.split(sep).filter(Boolean).includes('.worktrees')
/** candidate equals a protected root or CONTAINS one (deleting it would destroy it) */
const hitsProtected = (candidate, roots) => {
  for (const f of roots) if (candidate === f || f.startsWith(candidate + sep)) return f
  return null
}

/** Reject a candidate world path for ANY existing filesystem obstacle that is
 *  not a real directory (symlink — including dangling — or plain file). */
function assertRealDir(p, what) {
  const st = lstatSafe(p)
  if (st === null) return null // does not exist (also: NOT a dangling symlink)
  if (st.isSymbolicLink()) BAD(`${what} is a symlink (dangling or not) — refusing to derive a world through it: ${p}`)
  if (!st.isDirectory()) BAD(`${what} exists but is not a directory: ${p}`)
  return st
}

/**
 * L1+L2. Validate --world. Returns { home, homeReal, identity|null }.
 * identity = {dev,ino,ctimeMs,size} of the existing world dir — register it and
 * pass it to assertCleanupTarget at delete time. ctimeMs+size make inode-reuse
 * (filesystems DO recycle inodes) detectable: a replacement dir cannot match all four.
 */
export function parseWorldArg({ repoRoot, homesRoot, worldArg, cwd = process.cwd() }) {
  if (typeof worldArg !== 'string' || worldArg.trim() === '') BAD('--world is REQUIRED (no default; refusing to derive a world)')
  if (worldArg.includes('\0') || worldArg.startsWith('-')) BAD(`--world rejected (control character or flag-shaped): ${JSON.stringify(worldArg)}`)
  if (worldArg.startsWith('/') || /^[A-Za-z]:[\\/]/.test(worldArg) || worldArg.startsWith('\\\\')) BAD(`--world must be relative to the repo homes root (absolute refused): ${worldArg}`)

  let name = worldArg
  for (const prefix of ['tests/homes/', 'homes/', 'tests\\homes\\', 'homes\\']) {
    if (name.startsWith(prefix)) { name = name.slice(prefix.length); break }
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._@-]*$/.test(name)) BAD(`--world must be ONE safe basename under tests/homes (got ${JSON.stringify(worldArg)}; traversal, dot-names, nested paths and dot-dot are refused)`)

  const roots = protectedRoots({ repoRoot, homesRoot, cwd })
  const home = resolve(homesRoot, name)
  if (home === resolve(homesRoot)) BAD('--world must not be the homes root itself')
  const hit = hitsProtected(home, roots)
  if (hit !== null) BAD(`--world equals or contains a protected root (${hit}): ${home}`)
  if (hasWorktrees(home)) BAD(`--world must never be under a .worktrees segment: ${home}`)

  const st = assertRealDir(home, 'world')
  if (st === null) return { home, homeReal: home, identity: null } // not yet created — cannot be a symlink

  const homeReal = realpathSafe(home)
  if (homeReal === null) BAD(`cannot resolve realpath of world: ${home}`)
  const homesReal = realpathSafe(homesRoot) ?? resolve(homesRoot)
  if (homeReal !== homesRoot && homeReal !== homesReal && !(homeReal.startsWith(homesReal + sep) && homeReal !== homesReal)) BAD(`world realpath is not strictly under the homes root: ${homeReal}`)
  if (homeReal === homesReal) BAD('--world realpath is the homes root itself')
  const hitReal = hitsProtected(homeReal, roots)
  if (hitReal !== null) BAD(`world realpath equals or contains a protected root (${hitReal}): ${homeReal}`)
  if (hasWorktrees(homeReal)) BAD(`world realpath is under a .worktrees segment: ${homeReal}`)
  return { home, homeReal, identity: { dev: st.dev, ino: st.ino, ctimeMs: Number(st.ctimeMs), size: st.size } }
}

/**
 * L3. Re-validate a REGISTERED cleanup target immediately BEFORE any delete.
 * @param {object} opts { registered, identity|null, target, repoRoot, homesRoot, cwd }
 * @returns {string} validated target — or THROWS (never falls back).
 */
export function assertCleanupTarget({ registered, identity = null, target, repoRoot, homesRoot, cwd = process.cwd() }) {
  if (typeof registered !== 'string' || registered === '') BAD('no registered world — cleanup is not authorized (fail closed, no fallback)')
  const roots = protectedRoots({ repoRoot, homesRoot, cwd })
  const homesReal = realpathSafe(homesRoot) ?? resolve(homesRoot)

  // registered identity re-check (swap detection)
  if (registered === homesReal || !registered.startsWith(homesReal + sep)) BAD(`registered world is not strictly under the homes root: ${registered}`)
  if (hasWorktrees(registered)) BAD(`registered world is under a .worktrees segment: ${registered}`)
  const regHit = hitsProtected(registered, roots)
  if (regHit !== null) BAD(`registered world equals or contains a protected root (${regHit})`)
  const regSt = assertRealDir(registered, 'registered world')
  if (regSt !== null) {
    const regReal = realpathSafe(registered)
    if (regReal !== registered) BAD(`registered world realpath drifted (swap?): ${registered} -> ${regReal}`)
    if (identity !== null && (regSt.dev !== identity.dev || regSt.ino !== identity.ino || Number(regSt.ctimeMs) !== identity.ctimeMs || regSt.size !== identity.size)) BAD(`registered world identity drift (replaced dir?): ${regSt.dev}/${regSt.ino}/${Number(regSt.ctimeMs)}/${regSt.size} != registered ${identity.dev}/${identity.ino}/${identity.ctimeMs}/${identity.size}`)
  }

  // lexical strict containment (prefix-boundary: registered or registered+SEP)
  const t = resolve(target)
  if (t !== registered && !t.startsWith(registered + sep)) BAD(`cleanup target not inside the registered world (no parent fallback, no prefix match): ${t}`)

  // ancestor chain from target up to registered: NO symlink at ANY existing level (covers dangling + cross-sibling ancestor)
  for (let c = t; c.length >= registered.length; c = dirname(c)) {
    const st = lstatSafe(c)
    if (st !== null && st.isSymbolicLink()) BAD(`cleanup path component is a symlink (dangling or not): ${c}`)
    if (c === registered) break
  }

  if (lstatSafe(t) !== null) {
    const tReal = realpathSafe(t)
    if (tReal === null) BAD(`cannot resolve realpath of cleanup target: ${t}`)
    // strict real containment — EXACT equality or registered+sep (sibling worlds and prefix lookalikes throw)
    if (!(tReal === registered || tReal.startsWith(registered + sep))) BAD(`cleanup realpath escapes the registered world (strict): ${tReal}`)
    const tHit = hitsProtected(tReal, roots)
    if (tHit !== null) BAD(`cleanup realpath equals or contains a protected root (${tHit}): ${tReal}`)
    if (hasWorktrees(tReal)) BAD(`cleanup realpath is under a .worktrees segment: ${tReal}`)
  }
  return t
}

/** Entry guard: true only when this file is the process entry (direct run). */
export function isDirectEntry(importMetaUrl, argv1) {
  if (typeof argv1 !== 'string' || argv1 === '') return false
  try {
    return realpathSync(new URL(importMetaUrl).pathname) === realpathSync(resolve(argv1))
  } catch { return false }
}
