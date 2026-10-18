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
 *     A8. THE UNIFIED OUTPUT LAW — THERE IS NO DATA-SHAPED OUTPUT CHANNEL.
 *         A7 closed the byte streams; the enumeration data could still leave
 *         through WORDS: a refusal detail that quotes the entry it refused, the
 *         walker's stderr text pasted into `failure.detail`, a provider message
 *         echoed on a spawn refusal, an exception string. Every one of those is
 *         the attacker's own text, read back to them, and a refusal is exactly
 *         when that matters. So the rule is now structural, not per-arm:
 *           (1) an observable failure is a CLOSED CODE, a FAMILY word and
 *               FINITE INTEGERS (`GLOB_REFUSAL_TEXT` / `GLOB_REFUSAL_FAMILIES` /
 *               `counts`).
 *               No call site may build a detail string — the helper takes a
 *               code and looks the prose up in a frozen table, so a new arm
 *               cannot invent a channel by accident;
 *           (2) an observable success is the admitted array only (A6/A7);
 *           (3) `observe` (the audit line face) carries codes, families, call
 *               ids and arithmetic — never an entry, path or foreign message;
 *           (4) an unexpected fault is `internal-error` + arithmetic, and
 *               `run()` NEVER throws, so no exception string is a channel;
 *           (5) rich post-mortem text exists ONLY on the internal face
 *               (`internalLog`), DEFAULT OFF, and that face is NOT an output
 *               channel: the plane must never wire it to a tool result, a spill
 *               or anything model-visible (README states this for the mount).
 *         The proofs, one per clause: X5 is the STATIC form of (1) (one `detail:`
 *         assignment in this file, a table lookup, and every code literal at a
 *         call site is a table key) plus of (5) (`internalLog` is opt-in in the
 *         source); X7 is the behavioural wire sweep of (1)+(2); X8 the
 *         grammar sweep of (3); X9 the never-throws sweep of (4); X10 the
 *         default-off proof of (5); X11 emits the source x sink matrix this law
 *         is derived from. The live attacker (adversarial leg A5) then probes
 *         EVERY one of these channels, with the internal face deliberately
 *         OPENED, on each of its real rg walks.
 *   The kernel confine is the layer under that. Its two dimensions are MEASURED,
 *   per host, by leg L3 — and only one of them is stable enough to rely on:
 *     - BYTES: reading a file outside the root is refused inside the confined
 *       child (observed as the denial on the child's stderr; the launcher does
 *       NOT propagate the inner exit status, so an exit code is not the signal —
 *       L3 pins the byte and the "not a successful-looking empty answer" instead).
 *     - NAMES: whether an outside directory can be LISTED is NOT a stable kernel
 *       property. The same host reported both shapes (visible when the suite ran
 *       as a whole, kernel-denied when the leg ran alone), and the CI kernel
 *       reported a third — the recorded "listing SUCCEEDS" claim was a leg-order
 *       artifact, not a law (evidence/alpha5/glob-backend/census-round-20261018.md §7).
 *   So this row never cites the sandbox as protection against path-NAME
 *   disclosure in either direction: A4/A6/A8 are what make the row's ANSWER safe,
 *   in every name shape the kernel happens to have today.
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
export // Upper bound on waiting for the child's streams AFTER it exited (drain, not
// lifetime): long enough for a late stderr note, short enough to be nothing
// a walk could confuse with its own timeout budget.
const GLOB_STDERR_DRAIN_MS = 250
const GLOB_MAX_STDERR_BYTES = 8 * 1024

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

/**
 * THE SAFE-CODE LAW (A8) — an OBSERVABLE failure is a closed code, a family
 * word, and NUMBERS. Nothing else. Never an entry name, never a path, never a
 * walker byte, never a foreign error string: those are untrusted enumeration
 * data, and a refusal is exactly the moment an attacker most wants their own
 * names read back to them. Semantics stay legible because they live in the
 * code + family + counts (`walker-exit` + `exit=2`, `walk-contaminated` +
 * `entries=N`, `walk-too-large` + `bytes=N`), not in prose that echoes data.
 *
 * Rich text (which component, which errno, what ripgrep said) still exists for
 * whoever assembles this row, but it goes ONLY to the internal debug face
 * (`internalLog`, DEFAULT OFF) and never into a returned value.
 */
export const GLOB_REFUSAL_TEXT = Object.freeze({
  'anchor-law-unavailable': 'this platform cannot honor the anchored open law',
  'locator-rejected': 'the target locator is not a filesystem locator',
  'root-symlink-alias': 'the governed root path is an alias, not a directory',
  'root-unavailable': 'the governed root could not be opened or verified',
  'placement-mismatch': 'the target placement does not match its locator form',
  'target-outside-governed-root': 'the target is outside the governed root',
  'symlink-alias': 'a path component of the target is an alias',
  'target-unresolvable': 'the target does not exist as an openable directory',
  'not-a-directory': 'a path component of the target is not a directory',
  'anchor-open-failed': 'the anchored open of the target failed',
  'anchor-unverifiable': 'the opened anchor could not be re-read for verification',
  'exec-time-escape': 'an opened handle resolved outside the governed root',
  'anchor-drift': 'the pinned anchor is not the object the walk ran under',
  'root-drift': 'the governed root changed after the anchor was taken',
  'walk-contaminated': 'a walk entry was proven not to belong inside the pinned anchor',
  'walk-unverifiable': 'a walk entry could not be proven either way at verification time',
  'walk-protocol-error': 'the walker broke the NUL output protocol',
  'walker-exit': 'the walker process reported a nonzero exit',
  'walker-error': 'the walker process reported an error on its diagnostic stream',
  'walk-too-large': 'the walk exceeded the buffered output budget and was not parsed',
  'wrong-tool-for-backend': 'this backend does not serve that tool',
  'pattern-invalid': 'the host argument law rejected the glob pattern',
  'rg-unavailable': 'the walker binary could not be resolved',
  'spawn-failed': 'the confined spawn could not be created',
  'confined-refused': 'the confined process plane refused the spawn',
  'confined-unavailable': 'the confined process plane is unavailable on this host',
  'internal-error': 'an unexpected internal fault stopped the walk',
})

/** The families are the wire-facing words: they group codes without carrying data. */
export const GLOB_REFUSAL_FAMILIES = Object.freeze({
  'anchor-law-unavailable': 'a5glb-refused/anchor-law',
  'locator-rejected': 'a5glb-refused/request',
  'root-symlink-alias': 'a5glb-refused/anchor-identity',
  'root-unavailable': 'a5glb-refused/anchor-identity',
  'placement-mismatch': 'a5glb-refused/request',
  'target-outside-governed-root': 'a5glb-refused/request',
  'symlink-alias': 'a5glb-refused/anchor-identity',
  'target-unresolvable': 'a5glb-refused/request',
  'not-a-directory': 'a5glb-refused/request',
  'anchor-open-failed': 'a5glb-refused/anchor-law',
  'anchor-unverifiable': 'a5glb-refused/anchor-law',
  'exec-time-escape': 'a5glb-refused/anchor-identity',
  'anchor-drift': 'a5glb-refused/anchor-identity',
  'root-drift': 'a5glb-refused/anchor-identity',
  'walk-contaminated': 'a5glb-refused/walk-attribution',
  'walk-unverifiable': 'a5glb-refused/walk-attribution',
  'walk-protocol-error': 'a5glb-refused/walk-protocol',
  'walker-exit': 'a5glb-refused/walker-error',
  'walker-error': 'a5glb-refused/walker-error',
  'walk-too-large': 'a5glb-refused/cap',
  'wrong-tool-for-backend': 'a5glb-refused/request',
  'pattern-invalid': 'a5glb-refused/request',
  'rg-unavailable': 'a5glb-refused/walker-setup',
  'spawn-failed': 'a5glb-refused/confined-plane',
  'confined-refused': 'a5glb-refused/confined-plane',
  'confined-unavailable': 'a5glb-refused/confined-plane',
  'internal-error': 'a5glb-refused/internal',
})

/** A token from OUTSIDE this module (a provider code) may only ever be a token. */
const safeToken = (value) => {
  const text = String(value ?? '')
  return /^[A-Za-z0-9._:-]{1,40}$/.test(text) ? text : 'unspecified'
}

/**
 * Build an OBSERVABLE refusal. `counts` is filtered to finite integers, so the
 * only dynamic content a refusal can ever carry is arithmetic. `debugText` is
 * handed to the internal face (if one is assembled) and dropped otherwise.
 */
const failure = (cls, code, counts = {}, debug = undefined, debugText = '') => {
  const safeCounts = {}
  for (const [key, value] of Object.entries(counts)) {
    if (typeof value === 'number' && Number.isFinite(value)) safeCounts[key] = Math.trunc(value)
  }
  if (debug !== undefined && debugText.length > 0) emitDebug(debug, code, debugText)
  return {
    ok: false,
    failure: {
      class: cls,
      code,
      family: GLOB_REFUSAL_FAMILIES[code] ?? 'a5glb-refused/unclassified',
      detail: GLOB_REFUSAL_TEXT[code] ?? 'the walk was refused; the reason is carried by the code, not by echoed data',
      counts: safeCounts,
    },
  }
}

/** The internal face is called through here so a throwing sink cannot change a verdict. */
function emitDebug(debug, code, text) {
  try {
    debug(`${code} ${String(text).slice(0, 2000)}`)
  } catch {
    /* a debug face is never allowed to alter an outcome */
  }
}

/** No debug face: the default. OFF means OFF — nothing is retained anywhere. */
const NO_DEBUG = () => {}

/**
 * The placements this row's own law can interpret. Anything else is refused.
 * PROVENANCE, because there is no host enum to cite: the host glob argument law
 * (`parseGlobArgs`) carries no placement at all, so `placement` is a LANE word,
 * and these are the three this lane's callers actually send (relative targets as
 * `workspace`, and a target given as an absolute path inside the root as
 * `absolute-path`; `relative` is the same law under its other name). A word
 * outside this set used to be silently treated as a relative target — the
 * never-throws sweep (leg X9) caught that, and the row now refuses to guess.
 */
export const GLOB_PLACEMENTS = Object.freeze(['workspace', 'relative', 'absolute-path'])

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
export async function openAnchoredWalkRoot(rootDir, target, debug = NO_DEBUG) {
  if (fsConstants.O_NOFOLLOW === undefined || fsConstants.O_DIRECTORY === undefined) {
    return failure('undetermined', 'anchor-law-unavailable', {}, debug, 'O_NOFOLLOW/O_DIRECTORY absent from this platform')
  }
  if (target === null || typeof target !== 'object' || typeof target.locator !== 'string') {
    return failure('denied', 'locator-rejected', { reason: 1 }, debug, 'target is not a {placement, locator} object')
  }
  const locator = target.locator
  if (locator.trim().length === 0) return failure('denied', 'locator-rejected', { reason: 2 }, debug, 'locator is empty')
  if (locator.includes('://')) return failure('denied', 'locator-rejected', { reason: 3 }, debug, 'locator carries a URI scheme')
  if (locator.startsWith('\\\\')) return failure('denied', 'locator-rejected', { reason: 4 }, debug, 'locator is a UNC path')
  if (locator.includes('\0')) return failure('denied', 'locator-rejected', { reason: 5 }, debug, 'locator carries a NUL byte')

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
    if (kind === 'symlink') return failure('denied', 'root-symlink-alias', {}, debug, `root path is an alias errno=${safeToken(code)} root=${String(rootDir)}`)
    if (kind === 'missing') return failure('denied', 'root-unavailable', { reason: 1 }, debug, `root path absent root=${String(rootDir)}`)
    return failure('denied', 'root-unavailable', { reason: 2 }, debug, `root open failed errno=${safeToken(code)} root=${String(rootDir)}`)
  }
  let rootReal
  let rootIdentity
  try {
    rootReal = canonicalOrSelf(fdPath(rootHandle.fd))
    const rs = await rootHandle.stat({ bigint: false })
    rootIdentity = { dev: Number(rs.dev), ino: Number(rs.ino) }
  } catch (error) {
    await rootHandle.close().catch(() => undefined)
    return failure('undetermined', 'root-unavailable', { reason: 3 }, debug, `root has no /proc view errno=${safeToken(error?.code)}`)
  }
  await rootHandle.close().catch(() => undefined)

  const absolute = locator.startsWith('/') || /^[A-Za-z]:[\\/]/.test(locator)
  // A8 also closes a SILENT-ACCEPT arm the never-throws sweep found: a
  // placement word this row cannot interpret used to be ignored, so a call
  // classified as something unknown was walked as if it were a plain relative
  // target. The row's law can interpret exactly three placements; anything else
  // is refused rather than guessed at. (Anchoring would have held either way —
  // this is about not answering a question that was not asked.)
  const placement = String(target.placement ?? '')
  if (!GLOB_PLACEMENTS.includes(placement)) {
    return failure('denied', 'placement-mismatch', {}, debug, `placement=${safeToken(placement)}`)
  }
  if (absolute && placement !== 'absolute-path') {
    return failure('denied', 'placement-mismatch', {}, debug, `absolute locator under placement=${safeToken(placement)}`)
  }
  const lex = absolute ? resolve(locator) : resolve(rootReal, locator)
  if (!globIsBeneath(rootReal, lex)) {
    return failure('denied', 'target-outside-governed-root', {}, debug, `placement=${safeToken(target.placement)} locator=${locator}`)
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
        // The refusal is decided by the failed open; the reason goes to the
        // internal face only — a component path is enumeration-shaped data and
        // the wire answer is the code.
        if (kind === 'symlink') return failure('denied', 'symlink-alias', { depth: i }, debug, `alias component errno=${safeToken(code)} depth=${String(i)} at=${cursor}`)
        if (kind === 'missing') return failure('denied', 'target-unresolvable', { depth: i, reason: 4 }, debug, `missing component errno=${safeToken(code)} depth=${String(i)} at=${cursor}`)
        if (code === 'ENOENT') return failure('denied', 'target-unresolvable', { depth: i, reason: 5 }, debug, `ENOENT depth=${String(i)} at=${cursor}`)
        return failure('denied', 'not-a-directory', { depth: i }, debug, `ENOTDIR errno=${safeToken(code)} depth=${String(i)} at=${cursor}`)
      }
      return failure('undetermined', 'anchor-open-failed', { depth: i }, debug, `open failed errno=${safeToken(code)} depth=${String(i)} at=${cursor}`)
    }
    // A2: the OPENED object, not the path, is what gets judged.
    let opened
    try {
      opened = fdPath(handle.fd)
    } catch {
      await handle.close().catch(() => undefined)
      return failure('undetermined', 'anchor-unverifiable', { depth: i }, debug, 'no /proc view for the opened anchor fd')
    }
    if (!globIsBeneath(rootReal, canonicalOrSelf(opened))) {
      await handle.close().catch(() => undefined)
      return failure('denied', 'exec-time-escape', { depth: i }, debug, `opened handle outside governed root at depth=${String(i)} view=${opened}`)
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
export async function verifyGlobResultsBeneath(anchor, entries, debug = NO_DEBUG) {
  if (anchor?.ok !== true || anchor.handle === undefined) {
    return failure('undetermined', 'anchor-unverifiable', { reason: 1 }, debug, 'result verification needs an accepted anchor')
  }
  // A8: an entry name is UNTRUSTED ENUMERATION DATA. It may decide a verdict
  // and it may reach the internal debug face; it never reaches the returned
  // failure. So every refusal below reports WHERE (index, depth) and WHY (a
  // reason number + errno-as-token), never WHICH name.
  let position = -1
  const anchorHandle = anchor.handle
  const rootReal = anchor.rootReal
  const base = `/proc/self/fd/${String(anchorHandle.fd)}`
  let anchorNow
  try {
    anchorNow = fdPath(anchorHandle.fd)
  } catch {
    return failure('undetermined', 'anchor-unverifiable', { reason: 2 }, debug, 'the pinned anchor fd has no /proc view at result-verification time')
  }
  if (!globIsBeneath(rootReal, canonicalOrSelf(anchorNow))) {
    return failure('denied', 'anchor-drift', { entries: entries.length }, debug, `pinned anchor resolves outside the governed root at result time view=${anchorNow}`)
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
      return failure('undetermined', 'root-drift', {}, debug, `governed root not verifiable at result time errno=${safeToken(error?.code)}`)
    } finally {
      await rootNow?.close().catch(() => undefined)
    }
  }
  if (anchor.identity !== undefined) {
    // A3: the answer was produced under THIS inode; verify under the same one.
    const now = await anchorHandle.stat({ bigint: false })
    if (Number(now.dev) !== anchor.identity.dev || Number(now.ino) !== anchor.identity.ino) {
      return failure('undetermined', 'anchor-drift', { entries: entries.length }, debug, `anchor inode changed after the walk ${String(anchor.identity.dev)}:${String(anchor.identity.ino)} -> ${String(Number(now.dev))}:${String(Number(now.ino))}`)
    }
  }
  const dirOk = new Map([['', { ok: true }]])
  const checked = []
  for (const entry of entries) {
    position += 1
    const parts = String(entry).split('/')
    if (parts.some((p) => p === '..') || isAbsolute(String(entry)) || String(entry).includes('\0')) {
      return failure('denied', 'walk-contaminated', { entries: entries.length, at: position, reason: 1 }, debug, `entry is not root-relative at=${String(position)} entry=${JSON.stringify(String(entry)).slice(0, 200)}`)
    }
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1
      const dirKey = parts.slice(0, isLast ? i + 1 : i).join('/')
      const seen = dirOk.get(dirKey)
      if (seen !== undefined && (seen.ok === true || !isLast)) {
        if (seen.ok !== true) return seen
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
            return failure('denied', 'walk-contaminated', { entries: entries.length, at: position, depth: i, reason: 2 }, debug, `unreadable symlink entry at=${String(position)} depth=${String(i)} entry=${entry}`)
          }
          const resolved = canonicalOrSelf(isAbsolute(linkTarget) ? linkTarget : join(dirname(target), linkTarget))
          if (!globIsBeneath(rootReal, resolved)) {
            return failure('denied', 'walk-contaminated', { entries: entries.length, at: position, depth: i, reason: 3 }, debug, `entry resolves outside the governed root at=${String(position)} depth=${String(i)} entry=${entry}`)
          }
          dirOk.set(dirKey, { ok: true })
          break
        }
        const verdict = code === 'ELOOP'
          ? failure('denied', 'walk-contaminated', { entries: entries.length, at: position, depth: i, reason: 4 }, debug, `entry crosses a symlinked directory at=${String(position)} depth=${String(i)} at_path=${dirKey || entry}`)
          : code === 'ENOENT'
            ? failure('denied', 'walk-unverifiable', { entries: entries.length, at: position, depth: i, reason: 1 }, debug, `entry absent at verification time at=${String(position)} depth=${String(i)} entry=${entry}`)
            : code === 'ENOTDIR'
              ? failure('denied', 'walk-contaminated', { entries: entries.length, at: position, depth: i, reason: 5 }, debug, `directory required at=${String(position)} depth=${String(i)} at_path=${dirKey || entry}`)
              : failure('undetermined', 'walk-unverifiable', { entries: entries.length, at: position, depth: i, reason: 2 }, debug, `verifying open failed errno=${safeToken(code)} at=${String(position)} depth=${String(i)} entry=${entry}`)
        if (isLast) return verdict
        dirOk.set(dirKey, verdict)
        return verdict
      }
      try {
        const stats = await handle.stat({ bigint: false })
        const opened = fdPath(handle.fd)
        if (!globIsBeneath(rootReal, canonicalOrSelf(opened))) {
          const verdict = failure('denied', 'walk-contaminated', { entries: entries.length, at: position, depth: i, reason: 6 }, debug, `entry resolves through an alias outside the governed root at=${String(position)} depth=${String(i)} view=${opened}`)
          if (isLast) return verdict
          dirOk.set(dirKey, verdict)
          return verdict
        }
        if (isLast && !stats.isFile()) {
          return failure('denied', 'walk-contaminated', { entries: entries.length, at: position, depth: i, reason: 7 }, debug, `entry is not a regular file at=${String(position)} entry=${entry}`)
        }
        if (!isLast && !stats.isDirectory()) {
          const verdict = failure('denied', 'walk-contaminated', { entries: entries.length, at: position, depth: i, reason: 8 }, debug, `prefix is not a directory at=${String(position)} depth=${String(i)} at_path=${dirKey}`)
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
      // No `detail` here either (A8): the parser reports the CODE, and the only
      // prose for it is the table's. The stream snippet stays out of the verdict.
      return { ok: false, code: 'walk-protocol-error' }
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
 *   observe?: (line: string) => void,           // audit lines: codes + arithmetic only (A8)
 *   internalLog?: (line: string) => void,       // INTERNAL FACE, default OFF; not an output channel (A8)
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
    // THE INTERNAL FACE (A8) — NOT AN OUTPUT CHANNEL. Default OFF: nothing is
    // retained or emitted anywhere. An assembly that wants post-mortem detail
    // supplies its own sink, and owns keeping it off every model-visible and
    // user-visible surface; this module never routes it to `io`, to a result, or
    // to `observe` (which is itself restricted to codes and arithmetic).
    internalLog,
  } = options ?? {}
  const debug = typeof internalLog === 'function' ? internalLog : NO_DEBUG
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
      // A8: THIS METHOD NEVER THROWS, and a fault never becomes a string
      // channel either — an unexpected internal fault is a code plus
      // arithmetic like any other refusal, and its text goes to the internal
      // face (default off) rather than into an answer.
      try {
        return await runGoverned(call, io)
      } catch (error) {
        trace = [...trace, 'internal-fault']
        observe(`anchored-glob INTERNAL-FAULT realm=${realmId} call=${String(call?.callId)}`)
        return failure('undetermined', 'internal-error', {}, debug, `unexpected fault code=${safeToken(error?.code)} ${String(error?.stack ?? error?.message ?? error)}`)
      }
    },
  }

  /** The governed walk itself, kept whole so `run` can wrap it without gaps. */
  async function runGoverned(call, io) {
        const parsed = call?.parsedArgs
        if (parsed?.tool !== 'glob') {
          return failure('denied', 'wrong-tool-for-backend', {}, debug, `tool=${safeToken(parsed?.tool)}`)
        }
        // The host's own public argument law runs as a SECOND gate (the lane
        // already parsed strictly; this keeps the vocabulary single-owned).
        try {
          parseHostGlobArgs({ pattern: parsed.pattern })
        } catch (error) {
          // The walker's own words are foreign text: internal face only.
          return failure('denied', 'pattern-invalid', {}, debug, String(error?.message ?? error))
        }
        if (rgPath === null) {
          try {
            rgPath = await resolveRgPath()
          } catch (error) {
            return failure('undetermined', 'rg-unavailable', {}, debug, String(error?.message ?? error))
          }
        }
        trace = ['probe']
        if (probed === null) {
          probed = await provider.probe()
          if (probed.ok !== true) {
            trace = ['probe', 'terminate']
            observe(`anchored-glob capability REFUSED realm=${realmId} code=${safeToken(probed.error?.code)}`)
            return failure('denied', 'confined-unavailable', {}, debug, `capability probe refused code=${safeToken(probed.error?.code)} ${String(probed.error?.message ?? '')}`)
          }
          observe(`anchored-glob capability OK realm=${realmId} legs=${String(probed.value.length)}`)
        }

        // A1 + A2: anchor BEFORE the child exists; on refusal no process and no
        // byte of payload is ever produced.
        const anchor = await openAnchoredWalkRoot(rootDir, parsed.target, debug)
        if (anchor.ok !== true) {
          trace = ['probe', 'anchor-refused']
          observe(`anchored-glob refused code=${anchor.failure.code} family=${anchor.failure.family} call=${String(call.callId)} realm=${realmId}`)
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
          return failure('undetermined', 'spawn-failed', {}, debug, String(error?.message ?? error))
        }
        if (handle.ok !== true) {
          await anchor.handle.close().catch(() => undefined)
          trace = ['probe', 'prepare', 'terminate']
          observe(`anchored-glob spawn REFUSED realm=${realmId} code=${safeToken(handle.error?.code)}`)
          return failure('denied', 'confined-refused', {}, debug, `spawn refused code=${safeToken(handle.error?.code)} ${String(handle.error?.message ?? '')}`)
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
          // g6b-flake: the settlement MUST NOT read stderr before the stream has
          // ended. This row's discriminator is the walker's SPEECH (see the
          // walker-error arm below), and Node can resolve `child.exited` while
          // stderr 'data' callbacks are still pending — under CI's 9-root
          // concurrency that window is real: a walker that DID speak (invalid
          // glob, exit reported 0 by the streaming arm) is judged quiet, and the
          // leg returns an empty list instead of the typed walker error. Drain
          // both streams first, bounded so a stalled stream can never outlive the
          // walk's own timeout budget.
          const streamsEnded = new Promise((resolve) => {
            let pending = 2
            const done = () => { pending -= 1; if (pending === 0) resolve(true) }
            child.stdout.once('end', done)
            child.stderr.once('end', done)
          })
          const exit = await Promise.race([
            child.exited,
            new Promise((r) => sleepTimer(() => r({ timedOut: true }), timeoutMs).unref?.()),
          ])
          if (exit?.timedOut !== true) {
            await Promise.race([
              streamsEnded,
              new Promise((r) => sleepTimer(() => r(false), GLOB_STDERR_DRAIN_MS).unref?.()),
            ])
          }
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
            return failure('undetermined', 'walk-too-large', { budget: walkBufferBytes }, debug, `walk exceeded the buffered budget budget=${String(walkBufferBytes)}`)
          }
          if (code !== 0 && code !== 1) {
            observe(`anchored-glob ERROR realm=${realmId} call=${String(call.callId)} exit=${String(code ?? -1)}`)
            // A foreign program's stderr is enumeration data: the wire gets the
            // code and the exit NUMBER, the internal face may see the text.
            return failure('undetermined', 'walker-exit', { exit: code ?? -1, stderrBytes: stderrText.length }, debug, `walker exit ${String(code)} stderr=${stderrText}`)
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
            observe(`anchored-glob walker-error realm=${realmId} call=${String(call.callId)} exit=${String(code ?? -1)} stderrBytes=${String(stderrText.length)}`)
            return failure('undetermined', 'walker-error', { exit: code ?? -1, stderrBytes: stderrText.length }, debug, `walker diagnostic stream non-empty exit=${String(code)} stderr=${stderrText}`)
          }
          const framed = parseWalkOutput(stdout)
          if (framed.ok !== true) {
            // The framing promise broke (an empty record mid-stream): the walk's
            // output is not attributable to objects, so nothing is presented.
            observe(`anchored-glob PROTOCOL-BREAK code=${framed.code} call=${String(call.callId)}`)
            return failure('undetermined', framed.code, { records: records.length }, debug, framed.detail)
          }
          const records = framed.entries
          // A4: no path is returned unless every one of them is proven inside the
          // pinned anchor inode at this moment.
          const verdict = await verifyGlobResultsBeneath(anchor, records, debug)
          if (verdict.ok !== true) {
            observe(`anchored-glob RESULT-REFUSED code=${verdict.failure.code} family=${verdict.failure.family} call=${String(call.callId)} entries=${String(records.length)}`)
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
  }
}
