/**
 * glob-backend.mjs — the anchored, CONFINED real-ripgrep `glob` effect backend.
 *
 * WHAT THIS IS: the effect body the governed tool plane's `team_glob` row needs
 * (the PR5 commitment: `docs/plans/memo/alpha5-tool-io-governance/`
 * `alpha5-s0-pr0-pr8-implementation-plan.md:33` names grep/glob R3 as PR5
 * scope, `:128` names the public package-root helpers verbatim, `:132` demands
 * a native-vs-Team rg regression, and `architecture.md:234` requires a
 * "Confined Spawn around the actual rg process — no post-filter as substitute
 * for read isolation"). The walk is the REAL packaged `rg --files` process,
 * executed INSIDE the confined process provider, so the read scope is kernel
 * enforced: no pattern can read outside the governed root.
 *
 * SELF-CONTAINED ON PURPOSE: the anchoring law below is implemented HERE, not
 * borrowed from `plane-effect-backends.mjs` (that row stays untouched — the
 * integration owner owns it). It follows the controlled-fs lane's open-at-exec
 * law (`packages/runtime/controlled-fs/src/open-at-exec.ts`: an OPENED HANDLE
 * is re-read at exec time; `readlink /proc/self/fd/<n>` outside the anchor is
 * `escape`, an identity mismatch is `drift`, no /proc view is
 * `undeterminable`) but does not import that lane, so this file can be mounted
 * independently and reviewed on its own.
 *
 * THE ANCHOR LAW (why a realpath check is not enough here):
 *   realpath-then-spawn has a window — the path can be renamed and replaced by
 *   a symlink between the check and the walk. This backend closes it the way
 *   the C-FS lane does, with OPEN-TIME handles instead of a path snapshot:
 *     A1. every path component is opened `O_NOFOLLOW | O_DIRECTORY` starting at
 *         the governed root (a symlinked component is ELOOP → refused BEFORE
 *         any process exists);
 *     A2. each opened fd is re-read through `/proc/self/fd/<n>` and must land
 *         at-or-below the real root (the escape/drift words of the C-FS law);
 *     A3. the accepted WALK ROOT handle stays OPEN for the whole run and its
 *         identity (dev, ino) is re-checked at result-verification time — the
 *         anchor that produced the answer is still the anchor being verified;
 *         the verifier then re-walks every emitted path from
 *         `/proc/self/fd/<that fd>` (the handle's own /proc view) under A1/A2
 *         again, so an anchor that was unlinked or swapped away fails the
 *         identity/`/proc` re-read instead of silently verifying "something
 *         under that name";
 *     A4. nothing is returned unless every emitted path is PROVEN at
 *         verification time to be a real non-symlink file inside the pinned
 *         anchor inode (a symlinked directory component, an escaping symlink,
 *         a bind/mount alias outside the root, or an entry that cannot be
 *         opened at all refuses the WHOLE walk — typed, never a silent drop:
 *         the C-FS law says a hidden leg is still typed).
 *     A5. OUTPUT FRAMING IS NUL, NOT NEWLINE. The row appends exactly one
 *         token to the host's argv (`--null`, `GLOB_OUTPUT_PROTOCOL_ARGV`): it
 *         changes how records are DELIMITED, never what the walk selects
 *         (measured on one fixture: identical set, identical mtime order). The
 *         reason is a forgery class: a file named `README.md\ndocs/guide.md`
 *         is ONE object but TWO newline records, and both halves can be real
 *         files — so A4 would wave through paths the governed tree does not
 *         contain. A NUL byte cannot exist in a filename, so NUL framing is
 *         injective: one record, one object. See `parseWalkOutput`.
 *     A6. SINGLE PRODUCER OF PRESENTED PATHS. `verifyGlobResultsBeneath`
 *         returns the array that the outcome presents; the only string
 *         operation between verification and presentation happens inside it,
 *         from `anchor.walkRel` (fixed when the anchor was taken, never from
 *         the walker's bytes). After that return the caller takes an array
 *         WINDOW for the inline cap and does nothing else — no second parse,
 *         no re-split, no re-join, no re-resolution. Attribution is therefore
 *         handle-based end to end: each entry was opened under the pinned
 *         anchor fd (`/proc/self/fd/<n>`, an inode-bound view) before its
 *         string was allowed into that array.
 *     A7. NO UNVERIFIED BYTE REACHES ANY CHANNEL. A walk touches five channels
 *         and each is closed BEFORE the verdict, not after:
 *           C-STREAM  the child's stdout is BUFFERED here (bounded by the
 *                     assembly's narrowed buffer, ceiling GLOB_MAX_WALK_BYTES);
 *                     the data handler holds no channel object at all — no
 *                     sink, no `io`, no log call carrying rows.
 *           C-SPILL   `io.sink` is written EXACTLY ONCE per call, after the
 *                     verdict, from the admitted array only (`files.join(NUL)`
 *                     plus a terminator). A refused walk writes zero bytes; an
 *                     admitted one writes precisely what it presents, in the
 *                     walker's own framing. The pre-fix shape — writing the
 *                     stream as it arrived — let a walk refused a moment later
 *                     leak its raw rows into spill, which is what this law is
 *                     for (the refusal class is leg X1: a listed object that
 *                     cannot be opened at verification time, i.e. AFTER the
 *                     child has already streamed everything).
 *           C-RESULT  the returned outcome is built from `verdict.entries`
 *                     only (A6); the refusal arms return code + detail and
 *                     echo no rows.
 *           C-STDERR  stderr is a DIAGNOSTIC and never a channel: bounded by
 *                     GLOB_MAX_STDERR_BYTES, carried only as `failure.detail`
 *                     on an error arm, never to the sink, never inside an
 *                     `ok:true` result.
 *           C-TIMEOUT the cancelled arm settles `settlement:'cancelled'` with
 *                     an empty outcome and writes nothing.
 *         Legs X1-X6 are the behavioural per-channel evidence, leg X5 the
 *         mechanical static one (one write site, after the verdict; the stream
 *         handler mentions no channel; stderr never reaches a channel).
 *   The kernel confine is the layer under that, and its measured shape is
 *   asymmetric: inside the confined child, reading a file outside the root is
 *   EACCES while LISTING a directory outside the root SUCCEEDS (leg L3). So the
 *   confine protects BYTES and cannot be cited as protection against path-NAME
 *   disclosure — A4/A6 are what make the row's ANSWER safe, not the sandbox.
 *
 * HONEST RESIDUA (disclosed, not hidden):
 *   - A `/proc/self/fd/<n>` view is re-resolved BY PATH at each open (it is a
 *     magic link, not an inode pin). What actually blocks an escape is A1
 *     (`O_NOFOLLOW` on EVERY component, so no symlink is ever followed) plus
 *     A2 (each opened object is re-read and must be at-or-below the real
 *     root). The measured residual after that is a same-root substitution — an
 *     attacker who can rename a directory inside the governed root may make one
 *     entry resolve to a DIFFERENT real file that is still inside the root;
 *     it cannot make an entry resolve outside it. No claim is made past that.
 *   - Between result verification and a later READ the world may change again.
 *     This backend proves containment of what it RETURNS; the read of those
 *     bytes is the controlled-fs read lane's own commit (same open-at-exec law
 *     at open time). No claim is made past the returned list.
 *   - The newline-protocol hole that used to end such a walk TYPED is CLOSED
 *     by A5 (NUL framing): a filename carrying a newline is now walked,
 *     verified and returned under its true name. The remaining disclosure is
 *     downstream of this row: the presented name still CONTAINS a newline, so
 *     whoever renders it must not re-frame it by line (the row's own outcome is
 *     a string array and needs no framing at all).
 *   - rg lists a symlink as a file entry. An entry whose own target lands
 *     INSIDE the pinned anchor is kept (it is genuinely in scope); a target
 *     outside refuses the whole walk (A4).
 *   - The network dimension makes NO claim (same PoC-4b honesty as the shell
 *     row): no `networkProfile` is asserted, the walk needs no sockets.
 *
 * Fail-closed law (shared with the plane): every refusal is the CLOSED
 * `BackendFailure` triad (`denied` / `hidden` / `undetermined`, the a5p5
 * `SPILL_ERROR_CLASSES`) with a stable code — this file never throws out of
 * `run()`, and a pre-execute refusal never increments `execCount()`.
 *
 * @module packages/runtime/src/plugin/live/glob-backend
 */

import { constants as fsConstants, lstatSync, readlinkSync, realpathSync } from 'node:fs'
import { open as fsOpen } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { setTimeout as sleepTimer } from 'node:timers'
import { buildGlobCommand, GLOB_MAX_RESULTS, parseGlobArgs as parseHostGlobArgs, resolveRgPath } from '@deepseek-ai/dsh-tool-fs-search'
import { createConfinedProcessProvider } from '../../../sandbox-provider/index.js'

/** Stable backend identity (the plane/audit reports this name, never a anonymous one). */
export const GLOB_BACKEND_ID = 'a5glb-anchored-confined-rg-glob'

/** Cooperative walk budget: past it the child is terminated and the leg settles cancelled. */
export const GLOB_WALK_TIMEOUT_MS = 60_000

/** Upper bound an assembly may raise the inline cap to (a widening, never a silent one). */
export const GLOB_MAX_RESULTS_CEILING = 10_000

/** A walk may not stream more than this many bytes of path list into the parent. */
export const GLOB_MAX_WALK_BYTES = 8 * 1024 * 1024
/** The diagnostic channel is bounded too (A7): an error arm carries a snippet. */
export const GLOB_MAX_STDERR_BYTES = 8 * 1024

/** System paths a confined native binary needs to boot (rx only, never writable). */
const SYSTEM_RX = (path) => ({ path, accessBits: { execute: true, readFile: true, readDir: true } })

/** `/lib64` is absent on some hosts; a confined allow-entry for a missing path would refuse. */
let lib64Present = null
function hasLib64() {
  if (lib64Present === null) {
    try {
      lib64Present = realpathSync('/lib64').length > 0
    } catch {
      lib64Present = false
    }
  }
  return lib64Present
}

/** The closed failure shape (a5p5 `BackendFailure`; the class set is CLOSED). */
const failure = (cls, code, detail) => ({ ok: false, failure: { class: cls, code, detail: String(detail).slice(0, 400) } })

// ---------------------------------------------------------------------------
// A1/A2 — the anchor: component-wise O_NOFOLLOW opens + exec-time handle re-read
// ---------------------------------------------------------------------------

/** Is `candidate` at-or-below `anchor` (both already canonical, absolute)? */
export function globIsBeneath(anchor, candidate) {
  const rel = relative(anchor, candidate)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** What a failed component open actually hit (diagnostic naming only — the refusal is the open's verdict). */
function kindOfComponent(p) {
  try {
    const st = lstatSync(p)
    if (st.isSymbolicLink()) return 'symlink'
    if (st.isDirectory()) return 'directory'
    return 'other'
  } catch {
    return 'missing'
  }
}

/** The `/proc` view of an open fd (the C-FS lane's exec-time re-read primitive). */
function fdPath(fd) {
  return readlinkSync(`/proc/self/fd/${String(fd)}`)
}

/** Canonicalize without throwing (a deleted/magic link keeps its own spelling). */
function canonicalOrSelf(p) {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}

/** The open flags this law needs; absent on a platform without them → no walk. */
const OPEN_DIR_NOFOLLOW = (fsConstants.O_RDONLY ?? 0) | (fsConstants.O_DIRECTORY ?? 0) | (fsConstants.O_NOFOLLOW ?? 0)
const OPEN_FILE_NOFOLLOW = (fsConstants.O_RDONLY ?? 0) | (fsConstants.O_NOFOLLOW ?? 0)

/**
 * Open the walk root for one parsed glob target, ANCHORED at `rootDir`.
 *
 * Returns the accepted, still-open directory handle plus the identity the
 * verifier pins to, or a typed refusal code. Never reads a byte of payload.
 */
export async function openAnchoredWalkRoot(rootDir, target) {
  if (fsConstants.O_NOFOLLOW === undefined || fsConstants.O_DIRECTORY === undefined) {
    return failure('undetermined', 'anchor-law-unavailable', 'this platform exposes no O_NOFOLLOW/O_DIRECTORY, so the anchored open law cannot be honored')
  }
  if (target === null || typeof target !== 'object' || typeof target.locator !== 'string') {
    return failure('denied', 'locator-rejected', 'a glob target is {placement, locator}')
  }
  const locator = target.locator
  if (locator.trim().length === 0) return failure('denied', 'locator-rejected', 'the glob path must be a non-empty string')
  if (locator.includes('://')) return failure('denied', 'locator-rejected', 'a filesystem locator never wears a URI scheme')
  if (locator.startsWith('\\\\')) return failure('denied', 'locator-rejected', 'UNC/leading-backtick targets are refused')
  if (locator.includes('\0')) return failure('denied', 'locator-rejected', 'a locator may not carry a NUL byte')

  // The GOVERNED ROOT ITSELF is opened under the same law (measured, leg A3 of
  // the adversarial suite: an anchor taken from `realpath(rootDir)` alone walks
  // the OUTSIDE tree the moment someone swaps the root path to a symlink,
  // because realpath happily follows it). So the root is opened
  // O_DIRECTORY|O_NOFOLLOW, its /proc view is the anchor, and its (dev, ino)
  // is carried into the result verifier — a root that moves, is swapped, or is
  // exiled between the anchor and the answer is refused, not followed.
  let rootHandle
  try {
    rootHandle = await fsOpen(rootDir, OPEN_DIR_NOFOLLOW)
  } catch (error) {
    const code = String(error?.code ?? '')
    const kind = kindOfComponent(String(rootDir))
    if (kind === 'symlink') return failure('denied', 'root-symlink-alias', `the governed root path is a symlink (${code}): ${String(rootDir)}`)
    if (kind === 'missing') return failure('denied', 'root-unavailable', `the governed root does not exist: ${String(rootDir)}`)
    return failure('denied', 'root-unavailable', `the governed root could not be opened (${code || 'open-failed'}): ${String(rootDir)}`)
  }
  let rootReal
  let rootIdentity
  try {
    rootReal = canonicalOrSelf(fdPath(rootHandle.fd))
    const rs = await rootHandle.stat({ bigint: false })
    rootIdentity = { dev: Number(rs.dev), ino: Number(rs.ino) }
  } catch (error) {
    await rootHandle.close().catch(() => undefined)
    return failure('undetermined', 'root-unavailable', `the governed root has no verifiable view: ${String(error?.code ?? error)}`)
  }
  await rootHandle.close().catch(() => undefined)

  const absolute = locator.startsWith('/') || /^[A-Za-z]:[\\/]/.test(locator)
  if (absolute && target.placement !== 'absolute-path') {
    return failure('denied', 'placement-mismatch', 'an absolute locator must be classified as absolute-path')
  }
  const lex = absolute ? resolve(locator) : resolve(rootReal, locator)
  if (!globIsBeneath(rootReal, lex)) {
    return failure('denied', 'target-outside-governed-root', `target lexically escapes the governed root (${String(target.placement)}: ${locator})`)
  }

  const rel = relative(rootReal, lex)
  const components = rel.length === 0 ? [] : rel.split(sep).filter((c) => c.length > 0 && c !== '.')
  let handle = null
  let cursor = rootReal
  for (let i = 0; i <= components.length; i++) {
    // i === 0 opens the root itself; every later step opens one more component.
    if (handle !== null) await handle.close().catch(() => undefined)
    try {
      handle = await fsOpen(cursor, OPEN_DIR_NOFOLLOW)
    } catch (error) {
      const code = String(error?.code ?? '')
      if (code === 'ELOOP' || code === 'ENOTDIR' || code === 'ENOENT' || code === 'ENOTLNK') {
        // The refusal is already decided by the failed O_NOFOLLOW open; the
        // lstat below only NAMES the reason (a symlink must never be reported
        // as "not a directory" — the reviewer's threat model reads these codes).
        const kind = kindOfComponent(cursor)
        if (kind === 'symlink') return failure('denied', 'symlink-alias', `a path component is a symlink — refused at open time (${code}): ${cursor}`)
        if (kind === 'missing') return failure('denied', 'target-unresolvable', `path does not exist at open time (${code}): ${cursor}`)
        if (code === 'ENOENT') return failure('denied', 'target-unresolvable', `path does not exist at open time: ${cursor}`)
        return failure('denied', 'not-a-directory', `a path component is not a directory (${code}): ${cursor}`)
      }
      return failure('undetermined', 'anchor-open-failed', `${code || 'open-failed'} at ${cursor}`)
    }
    // A2: the OPENED object, not the path, is what gets judged.
    let opened
    try {
      opened = fdPath(handle.fd)
    } catch {
      await handle.close().catch(() => undefined)
      return failure('undetermined', 'anchor-unverifiable', 'no /proc view for the opened anchor fd')
    }
    if (!globIsBeneath(rootReal, canonicalOrSelf(opened))) {
      await handle.close().catch(() => undefined)
      return failure('denied', 'exec-time-escape', `opened handle resolves outside the governed root: ${opened}`)
    }
    if (i === components.length) break
    cursor = join(cursor, components[i] ?? '')
  }
  const stats = await handle.stat({ bigint: false })
  const pinned = fdPath(handle.fd)
  return {
    ok: true,
    handle,
    rootDir,
    rootReal,
    anchorPath: lex,
    anchorReal: canonicalOrSelf(pinned),
    walkRel: components.join('/'),
    identity: { dev: Number(stats.dev), ino: Number(stats.ino) },
    rootIdentity,
  }
}

// ---------------------------------------------------------------------------
// A4 — the result law: every returned path is proven inside the PINNED handle
// ---------------------------------------------------------------------------

/**
 * Prove that every emitted walk entry lives inside the pinned anchor inode as a
 * real, non-symlink file (a symlink entry is kept only when its OWN target is
 * proven inside the anchor). Directory prefixes are checked once and cached.
 *
 * The base is `/proc/self/fd/<anchor fd>`, i.e. the handle A3 kept open — a
 * later rename of the original path cannot move what is being verified.
 */
export async function verifyGlobResultsBeneath(anchor, entries) {
  if (anchor?.ok !== true || anchor.handle === undefined) {
    return failure('undetermined', 'anchor-unverifiable', 'result verification needs an accepted anchor')
  }
  const anchorHandle = anchor.handle
  const rootReal = anchor.rootReal
  const base = `/proc/self/fd/${String(anchorHandle.fd)}`
  let anchorNow
  try {
    anchorNow = fdPath(anchorHandle.fd)
  } catch {
    return failure('undetermined', 'anchor-unverifiable', 'the pinned anchor fd has no /proc view at result-verification time')
  }
  if (!globIsBeneath(rootReal, canonicalOrSelf(anchorNow))) {
    return failure('denied', 'anchor-drift', `the pinned anchor resolves outside the governed root at verification time: ${anchorNow}`)
  }
  if (anchor.rootIdentity !== undefined) {
    // The root the anchor was taken under must STILL be the same object —
    // otherwise the walk answered for a directory that is no longer governed.
    let rootNow = null
    try {
      rootNow = await fsOpen(anchor.rootDir ?? anchor.rootReal, OPEN_DIR_NOFOLLOW)
      const rs = await rootNow.stat({ bigint: false })
      if (Number(rs.dev) !== anchor.rootIdentity.dev || Number(rs.ino) !== anchor.rootIdentity.ino) {
        return failure('denied', 'root-drift', 'the governed root was swapped or replaced after the anchor was taken')
      }
    } catch (error) {
      const kind = kindOfComponent(anchor.rootDir ?? anchor.rootReal)
      if (kind === 'symlink') {
        return failure('denied', 'root-symlink-alias', 'the governed root became a symlink after the anchor was taken')
      }
      return failure('undetermined', 'root-drift', `the governed root is not verifiable at result time (${String(error?.code ?? 'open-failed')})`)
    } finally {
      await rootNow?.close().catch(() => undefined)
    }
  }
  if (anchor.identity !== undefined) {
    // A3: the answer was produced under THIS inode; verify under the same one.
    const now = await anchorHandle.stat({ bigint: false })
    if (Number(now.dev) !== anchor.identity.dev || Number(now.ino) !== anchor.identity.ino) {
      return failure('undetermined', 'anchor-drift', `the anchor inode changed after the walk (${String(anchor.identity.dev)}:${String(anchor.identity.ino)} -> ${String(Number(now.dev))}:${String(Number(now.ino))})`)
    }
  }
  const dirOk = new Map([['', { ok: true }]])
  const checked = []
  for (const entry of entries) {
    const parts = String(entry).split('/')
    if (parts.some((p) => p === '..') || isAbsolute(String(entry)) || String(entry).includes('\0')) {
      return failure('denied', 'walk-contaminated', `a walk entry is not root-relative: ${JSON.stringify(String(entry)).slice(0, 120)}`)
    }
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1
      const dirKey = parts.slice(0, isLast ? i + 1 : i).join('/')
      const seen = dirOk.get(dirKey)
      if (seen !== undefined && (seen.ok === true || !isLast)) {
        if (seen.ok !== true) return failure(seen.class, seen.code, seen.detail)
        if (!isLast) continue
      }
      const target = join(base, ...parts.slice(0, i + 1))
      let handle = null
      try {
        handle = await fsOpen(target, isLast ? OPEN_FILE_NOFOLLOW : OPEN_DIR_NOFOLLOW)
      } catch (error) {
        const code = String(error?.code ?? '')
        if (code === 'ELOOP' && isLast) {
          // rg lists symlinks as entries: keep it only when its own target is
          // inside the pinned anchor; an escaping target refuses the walk.
          let linkTarget
          try {
            linkTarget = readlinkSync(target)
          } catch {
            return failure('denied', 'walk-contaminated', `a walk entry is an unreadable symlink: ${entry}`)
          }
          const resolved = canonicalOrSelf(isAbsolute(linkTarget) ? linkTarget : join(dirname(target), linkTarget))
          if (!globIsBeneath(rootReal, resolved)) {
            return failure('denied', 'walk-contaminated', `a walk entry resolves outside the governed root: ${entry}`)
          }
          dirOk.set(dirKey, { ok: true })
          break
        }
        const verdict = code === 'ELOOP'
          ? failure('denied', 'walk-contaminated', `a walk entry crosses a symlinked directory: ${dirKey || entry}`)
          : code === 'ENOENT'
            ? failure('denied', 'walk-unverifiable', `a walk entry does not exist at verification time: ${entry}`)
            : code === 'ENOTDIR'
              ? failure('denied', 'walk-contaminated', `a walk entry is not a directory where one is required: ${dirKey || entry}`)
              : failure('undetermined', 'walk-unverifiable', `${code || 'open-failed'} verifying ${entry}`)
        if (isLast) return verdict
        dirOk.set(dirKey, verdict)
        return verdict
      }
      try {
        const stats = await handle.stat({ bigint: false })
        const opened = fdPath(handle.fd)
        if (!globIsBeneath(rootReal, canonicalOrSelf(opened))) {
          const verdict = failure('denied', 'walk-contaminated', `a walk entry resolves through an alias outside the governed root: ${opened}`)
          if (isLast) return verdict
          dirOk.set(dirKey, verdict)
          return verdict
        }
        if (isLast && !stats.isFile()) {
          return failure('denied', 'walk-contaminated', `a walk entry is not a regular file: ${entry}`)
        }
        if (!isLast && !stats.isDirectory()) {
          const verdict = failure('denied', 'walk-contaminated', `a walk entry is not a directory: ${dirKey}`)
          dirOk.set(dirKey, verdict)
          return verdict
        }
        if (isLast) checked.push(entry)
        if (!isLast) dirOk.set(dirKey, { ok: true })
      } finally {
        await handle.close().catch(() => undefined)
      }
    }
  }
  // A6 THE SINGLE-PRODUCER LAW: the array below is the SAME array the outcome
  // presents. The one and only string operation between verification and
  // presentation happens HERE, from data the ANCHOR owns (`walkRel`, fixed when
  // the anchor was taken — never derived from the walker's bytes), applied to
  // entries that were each just opened under the pinned anchor fd. There is no
  // second parse, no re-split, no re-join and no path re-resolution anywhere
  // after this return: the caller slices this array for the inline cap and
  // nothing else (an array window is not a string operation, and leg P10 pins
  // that slicing preserves order).
  const prefix = typeof anchor.walkRel === 'string' && anchor.walkRel.length > 0 ? `${anchor.walkRel}/` : ''
  const presented = prefix.length === 0 ? checked : checked.map((entry) => `${prefix}${entry}`)
  return { ok: true, verified: checked.length, entries: presented }
}

// ---------------------------------------------------------------------------
// the argv / outcome face (host PUBLIC package root + the lane's own outcome)
// ---------------------------------------------------------------------------

/**
 * The ONE argv this backend ever builds: the host's public package-root
 * `buildGlobCommand` (plan :128 names it verbatim), with the search root
 * deliberately ABSENT — the walk rides the confined child's cwd, which is the
 * anchored directory, so no swappable path string ever reaches rg.
 *
 * The row's only addition to the host's argv is the framing token below,
 * appended at the spawn site (`GLOB_OUTPUT_PROTOCOL_ARGV`), so `globArgv()`
 * stays byte-comparable with the native oracle leg for leg.
 */
export function globArgv(parsed) {
  return buildGlobCommand({ pattern: parsed.pattern })
}

/** The framing addition (see the output framing law A5). Selection-neutral. */
export const GLOB_OUTPUT_PROTOCOL_ARGV = Object.freeze(['--null'])

/**
 * THE OUTPUT FRAMING LAW (A5): records are separated by NUL, never by newline.
 *
 * `--null` is appended to the host's argv at the spawn site, and that is the
 * ONLY addition to it — it changes how records are DELIMITED, never what the
 * walk selects (measured, same fixture: identical set, identical mtime order).
 * The reason is a forgery class, not tidiness: a file literally named
 * `README.md\ndocs/guide.md` is ONE object and, under newline framing, TWO
 * root-relative records — and both of those records can be real files, so the
 * per-entry law (A4) waves them through and the walk presents paths the
 * governed tree does not contain. A NUL byte cannot appear in a filename at
 * all, so NUL framing is INJECTIVE: one record is one filesystem object, and
 * an embedded newline is ordinary data inside it. This removes the newline
 * hole the row used to end on TYPED instead of answering (`walk-unverifiable`):
 * the protocol can now carry the true name, so it does.
 *
 * An empty record that is NOT the trailing one is a protocol break (the walker
 * did not emit what the framing promises) and is reported as such — a typed
 * refusal, never a silently dropped row.
 */
export function parseWalkOutput(stdout) {
  const records = String(stdout).split('\0')
  if (records.length > 0 && records[records.length - 1] === '') records.pop()
  const entries = []
  for (const record of records) {
    if (record.length === 0) {
      return { ok: false, code: 'walk-protocol-error', detail: 'the walker emitted an empty NUL-delimited record mid-stream' }
    }
    entries.push(record.startsWith('./') ? record.slice(2) : record)
  }
  return { ok: true, entries }
}

/**
 * Build the glob effect backend.
 *
 * @param options {
 *   realmId: string,                        // the realm the confined provider scopes to
 *   rootDir: string,                        // the governed controlled-fs instance root
 *   confined: { trustRoot, scratchRoot, runnerCommand?, assembly? }, // provider entries (never defaulted to a wider face)
 *   templateId?: string, instanceId?: string,
 *   maxResults?: number,                    // inline cap; default GLOB_MAX_RESULTS, ceiling GLOB_MAX_RESULTS_CEILING
 *   timeoutMs?: number,                     // cooperative walk budget
 *   observe?: (line: string) => void,
 * }
 */
export function createAnchoredGlobBackend(options) {
  const {
    realmId,
    rootDir,
    confined,
    templateId = 'plane',
    instanceId = 'member',
    maxResults = GLOB_MAX_RESULTS,
    timeoutMs = GLOB_WALK_TIMEOUT_MS,
    // NARROWING ONLY: an assembly may shrink the walk buffer (it can never
    // enlarge GLOB_MAX_WALK_BYTES), which also makes the overflow arm of the
    // channel audit reachable by a test instead of only by 8 MB of filenames.
    maxWalkBytes = GLOB_MAX_WALK_BYTES,
    observe = () => {},
  } = options ?? {}
  if (typeof realmId !== 'string' || realmId.length === 0) throw new TypeError('glob backend: realmId is required')
  if (typeof rootDir !== 'string' || rootDir.length === 0) throw new TypeError('glob backend: rootDir is required')
  if (!Number.isInteger(maxResults) || maxResults <= 0 || maxResults > GLOB_MAX_RESULTS_CEILING) {
    throw new TypeError(`glob backend: maxResults must be a positive integer <= ${String(GLOB_MAX_RESULTS_CEILING)}`)
  }
  // NARROWING ONLY, like the result ceiling: an assembly may shrink the walk
  // buffer, never grow it past GLOB_MAX_WALK_BYTES.
  const walkBufferBytes = Number.isInteger(maxWalkBytes) && maxWalkBytes > 0 && maxWalkBytes < GLOB_MAX_WALK_BYTES
    ? maxWalkBytes
    : GLOB_MAX_WALK_BYTES
  const provider = createConfinedProcessProvider({
    realmId,
    trustRoot: confined?.trustRoot ?? null,
    // The provider writes its scratch PARENT-side; rooted inside the governed
    // root it would show up in every walk result, so it is refused here.
    scratchRoot: typeof confined?.scratchRoot === 'string' && confined.scratchRoot.length > 0 ? confined.scratchRoot : '',
    ...(confined?.runnerCommand === undefined ? {} : { runnerCommand: confined.runnerCommand }),
    assembly: confined?.assembly ?? {},
  })
  let probed = null
  let rgPath = null
  let executed = 0
  let trace = []
  const lastRuns = []

  return {
    backendId: GLOB_BACKEND_ID,
    get lastStageTrace() { return trace },
    execCount: () => executed,
    /** Diagnostics for the reviewer's own runs (never part of the compared value). */
    lastRuns,

    async run(call, io) {
      const parsed = call?.parsedArgs
      if (parsed?.tool !== 'glob') {
        return failure('denied', 'wrong-tool-for-backend', 'the glob backend got a non-glob call')
      }
      // The host's own public argument law runs as a SECOND gate (the lane
      // already parsed strictly; this keeps the vocabulary single-owned).
      try {
        parseHostGlobArgs({ pattern: parsed.pattern })
      } catch (error) {
        return failure('denied', 'pattern-invalid', String(error?.message ?? error))
      }
      if (rgPath === null) {
        try {
          rgPath = await resolveRgPath()
        } catch (error) {
          return failure('undetermined', 'rg-unavailable', String(error?.message ?? error))
        }
      }
      trace = ['probe']
      if (probed === null) {
        probed = await provider.probe()
        if (probed.ok !== true) {
          trace = ['probe', 'terminate']
          observe(`anchored-glob capability REFUSED realm=${realmId} code=${String(probed.error?.code ?? 'probe-refused')}`)
          return failure('denied', `confined-unavailable:${String(probed.error?.code ?? 'probe-refused')}`, String(probed.error?.message ?? 'the confined provider refused its capability probe'))
        }
        observe(`anchored-glob capability OK realm=${realmId} legs=${String(probed.value.length)}`)
      }

      // A1 + A2: anchor BEFORE the child exists; on refusal no process and no
      // byte of payload is ever produced.
      const anchor = await openAnchoredWalkRoot(rootDir, parsed.target)
      if (anchor.ok !== true) {
        trace = ['probe', 'anchor-refused']
        observe(`anchored-glob refused ${anchor.failure.code} call=${String(call.callId)} realm=${realmId}`)
        return anchor
      }
      trace = ['probe', 'prepare', 'execute']
      const rgBinDir = rgPath.slice(0, rgPath.lastIndexOf('/'))
      const request = {
        grantFingerprint: `a5glb:${realmId}:${templateId}:${String(call.callId)}`,
        realmId,
        bindingId: `a5glb-glob:${templateId}`,
        memberScope: instanceId,
        argv: [rgPath, ...globArgv(parsed), ...GLOB_OUTPUT_PROTOCOL_ARGV],
        // The anchored directory. The walk root itself is the child's cwd, so
        // argv carries no path element (a swappable string never reaches rg).
        cwd: anchor.anchorPath,
        env: [['PATH', '/usr/bin:/bin']],
        allowPaths: [
          SYSTEM_RX('/bin'), SYSTEM_RX('/usr'), SYSTEM_RX('/lib'),
          ...(hasLib64() ? [SYSTEM_RX('/lib64')] : []),
          SYSTEM_RX(rgBinDir),
          { path: anchor.rootReal, accessBits: { readFile: true, readDir: true } },
        ],
      }
      let handle
      try {
        handle = await provider.spawnStreaming(request)
      } catch (error) {
        await anchor.handle.close().catch(() => undefined)
        trace = [...trace, 'terminate']
        return failure('undetermined', 'spawn-failed', String(error?.message ?? error))
      }
      if (handle.ok !== true) {
        await anchor.handle.close().catch(() => undefined)
        trace = ['probe', 'prepare', 'terminate']
        observe(`anchored-glob spawn REFUSED realm=${realmId} code=${String(handle.error?.code ?? 'spawn-refused')}`)
        return failure('denied', `confined-refused:${String(handle.error?.code ?? 'spawn-refused')}`, String(handle.error?.message ?? 'the confined spawn was refused'))
      }
      executed += 1
      const child = handle.value
      // The pinned anchor handle MUST outlive every path the walk produced:
      // A4 verifies against it, so it closes only after the verdict exists.
      try {
        let stdout = ''
        let stderr = ''
        let overflow = false
        child.stdout.on('data', (chunk) => {
          // NO CHANNEL IS WRITTEN HERE. The bytes arriving from the child are
          // UNVERIFIED until the verdict below admits them, and the spill
          // channel is a channel like any other: writing it as it arrives (the
          // shape this row had) means a walk that is refused a moment later has
          // already leaked its raw bytes into spill. So the stream is buffered
          // (bounded by GLOB_MAX_WALK_BYTES, whose refusal is unchanged) and the
          // ONLY sink write in this module happens after the verdict, from the
          // admitted array. See the channel audit in the header.
          const text = String(chunk)
          if (stdout.length + text.length <= walkBufferBytes) {
            stdout += text
          } else {
            overflow = true
          }
        })
        child.stderr.on('data', (chunk) => {
          // Bounded, like every other buffer: the diagnostic channel cannot be
          // turned into a memory channel by a chatty walker.
          if (stderr.length < GLOB_MAX_STDERR_BYTES) stderr += String(chunk)
        })
        const exit = await Promise.race([
          child.exited,
          new Promise((r) => sleepTimer(() => r({ timedOut: true }), timeoutMs).unref?.()),
        ])
        await child.terminate() // the frozen lease arm settles exactly once per path
        trace = [...trace, 'terminate']
        if (exit?.timedOut === true) {
          observe(`anchored-glob TIMEOUT realm=${realmId} call=${String(call.callId)} pid=${String(child.pid)}`)
          return {
            ok: true,
            outcome: { outputMode: 'files_with_matches', matches: [], counts: [], files: [], totalMatches: 0, truncated: false },
            settlement: { kind: 'cancelled', event: 'glob-walk-terminated-after-timeout' },
          }
        }
        const code = typeof exit?.code === 'number' ? exit.code : null
        const stderrText = stderr.trim().slice(0, GLOB_MAX_STDERR_BYTES)
        if (overflow) {
          return failure('undetermined', 'walk-too-large', `the walk streamed more than ${String(walkBufferBytes)} bytes; it was not parsed, and nothing was written to any channel`)
        }
        if (code !== 0 && code !== 1) {
          observe(`anchored-glob ERROR realm=${realmId} call=${String(call.callId)} exit=${String(code)}`)
          return failure('undetermined', code === null ? 'rg-exit-unobserved' : `rg-exit-${String(code)}`, stderrText || 'ripgrep reported an error')
        }
        if (stderrText.length > 0) {
          // MEASURED on this host (evidence/alpha5/glob-backend): the streaming
          // arm can report a hard walker error's exit code as 0 while stderr
          // carries the walker's words (invalid glob, unreadable root). So the
          // walker's SPEECH, not the code, is the discriminator: a walk that
          // ends quietly has an empty stderr; one that spoke is an ERROR leg
          // and lands TYPED — never an empty list pretending the subtree clean.
          // This cannot false-refuse on the noise a bare rg makes in a nested
          // repo: the governed argv carries --no-ignore, so the walker runs no
          // upward ignore-discovery and never touches a parent .git (measured:
          // without --no-ignore, a confined walk in this repo does emit a
          // `.git: Permission denied` line; with it, stderr stays empty).
          observe(`anchored-glob walker-error realm=${realmId} call=${String(call.callId)} (exit read as ${String(code)}; stderr carried it)`)
          return failure('undetermined', 'rg-walker-error', stderrText)
        }
        const framed = parseWalkOutput(stdout)
        if (framed.ok !== true) {
          // The framing promise broke (an empty record mid-stream): the walk's
          // output is not attributable to objects, so nothing is presented.
          observe(`anchored-glob PROTOCOL-BREAK ${framed.code} call=${String(call.callId)}`)
          return failure('undetermined', framed.code, framed.detail)
        }
        const records = framed.entries
        // A4: no path is returned unless every one of them is proven inside the
        // pinned anchor inode at this moment.
        const verdict = await verifyGlobResultsBeneath(anchor, records)
        if (verdict.ok !== true) {
          observe(`anchored-glob RESULT-REFUSED ${verdict.failure.code} call=${String(call.callId)} entries=${String(records.length)}`)
          return verdict
        }
        // A6 (single producer): `verdict.entries` is the verified array with the
        // anchor's own prefix already applied — no string work happens between
        // verification and presentation. The ONLY thing done to it here is the
        // inline cap, an array window that preserves order (pinned by leg P10).
        const files = verdict.entries.slice(0, maxResults)
        // THE ONE SINK WRITE IN THIS MODULE (channel audit, header A7): after the
        // verdict, from the admitted array only. Spill therefore carries exactly
        // what is presented, in the walker's own NUL framing — never more, never
        // less, and never a byte of a refused walk.
        if (io?.sink && files.length > 0) io.sink.write(`${files.join('\0')}\0`)
        lastRuns.push({ callId: call?.callId, pid: child.pid, exit: code, total: verdict.entries.length, capped: verdict.entries.length > files.length })
        observe(`anchored-glob ran realm=${realmId} call=${String(call.callId)} pid=${String(child.pid)} files=${String(verdict.entries.length)} capped=${String(verdict.entries.length > files.length)}`)
        return {
          ok: true,
          outcome: {
            outputMode: 'files_with_matches',
            matches: [],
            counts: [],
            files,
            totalMatches: verdict.entries.length,
            truncated: verdict.entries.length > files.length,
          },
          settlement: { kind: 'completed' },
        }
      } finally {
        await anchor.handle.close().catch(() => undefined)
      }
    },
  }
}
