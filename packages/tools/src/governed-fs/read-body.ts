/**
 * Bounded READ pilot — the single-fd execution core.
 *
 * Laws (B-READ-PILOT-DESIGN.md §2 + root BLOCK order @f13707e8 ①-④):
 *  1. SINGLE-FD EXECUTION — after verification, bytes are read through the
 *     verified fd only; no pathname reopen of the target exists here.
 *  2. NO REOPEN AFTER VERIFY — the trusted-dirfd chain resolves one component
 *     at a time beneath an anchored parent fd (O_NOFOLLOW per step).
 *  3. FLAG DISCIPLINE — O_RDONLY only; O_NONBLOCK on the final open bounds
 *     the FIFO/device window; no write/trunc constant exists in this file.
 *  4. (BLOCK ①) FD HYGIENE — every dirfd the chain opens is closed on both
 *     success and failure paths; only the FINAL handle (plus the parent dirfd
 *     it was opened through, kept ONLY for the effect-time recheck) outlives
 *     openVerifiedChain, and execute() closes both. Tests assert
 *     /proc/self/fd deltas equal zero.
 *  5. (BLOCK ②) EFFECT-TIME RECHECK — admission/revocation/generation is
 *     re-read IMMEDIATELY BEFORE the read effect; a fresh revocation or
 *     generation flip refuses typed with ZERO bytes read.
 *  6. (BLOCK ③) HANDLE RETARGET GUARD — before the read effect the final
 *     component is re-opened THROUGH THE PARENT FD and its (dev,ino) must
 *     match the verified snapshot; a retarget refuses (GOV_STALE_HANDLE),
 *     deterministically (the seam runs synchronously between verify and
 *     effect — no racing).
 *  7. (BLOCK ④) ROOT ANCHOR IDENTITY — the trusted root dirfd, once opened
 *     by absolute path, is fstat-verified against the caller-supplied
 *     expected dir identity (dev+ino); a symlinked or swapped ancestor
 *     refuses (GOV_FOREIGN_ROOT). The final-vs-root dev check does NOT
 *     cover this hole.
 *
 * Reuses (does not reinvent) the proven controlled-fs law: verifyOpenedHandle
 * (open-at-exec.ts: dev/ino drift), bindAdmissionRecheck (admission-binding.ts:
 * divergence refuses BEFORE the port), ARBITRARY_TREE_PROFILE_PUBLISHED=false
 * (fail closed). openat2 is unavailable on node — the dirfd chain is the
 * honest form; no openat2 claim is made.
 *
 * No per-call state is stored: the admission binding arrives per execute().
 *
 * @module evidence-governed-fs/read-body
 */
import { constants, closeSync, fstatSync, lstatSync, openSync, readSync } from 'node:fs'
import { isAbsolute, resolve as resolvePath } from 'node:path'
import { GovernedFsError } from './errors.js'

const O_RDONLY = constants.O_RDONLY
// BLOCK ⑧ (root review @f13707e8): a missing resolve-sensitive flag must NEVER
// default to 0 (silently disabling the law). Absence fails CLOSED: the factory
// refuses to serve when REQUIRED_FLAGS are not all present.
const O_NOFOLLOW = constants.O_NOFOLLOW
const O_DIRECTORY = constants.O_DIRECTORY
const O_NONBLOCK = constants.O_NONBLOCK
// O_CLOEXEC is an inheritance-hygiene flag, not a resolve-law flag: presence
// is optional, absence changes no security property (disclosed, not silent).
const O_CLOEXEC = (constants as unknown as { O_CLOEXEC?: number }).O_CLOEXEC ?? 0
/** True when every resolve-law flag exists on this platform (BLOCK ⑧ gate). */
export const FLAGS_SUPPORTED = typeof O_NOFOLLOW === 'number' && O_NOFOLLOW !== 0 &&
  typeof O_DIRECTORY === 'number' && O_DIRECTORY !== 0 &&
  typeof O_NONBLOCK === 'number' && O_NONBLOCK !== 0
// safe invariants for the code paths below (checked at the factory gate)
const NOFOLLOW_F = typeof O_NOFOLLOW === 'number' ? O_NOFOLLOW : 0
const DIRECTORY_F = typeof O_DIRECTORY === 'number' ? O_DIRECTORY : 0
const NONBLOCK_F = typeof O_NONBLOCK === 'number' ? O_NONBLOCK : 0

/** Per-call admission evidence supplied at execute() time — never cached. */
export interface CallAdmission {
  readonly bindingRevision: number
  readonly generation: number
  readonly canonicalLocator: string
  readonly parametersFingerprint: string
  /** REQUIRED: an existing trusted grant this call rides (no grant is ever
   * minted here; no one-shot semantics are claimed — root review ⑥). */
  readonly grantId: string
  readonly revoked?: boolean
}

/** Expected-identity view (assembled by the caller's binding layer). */
export interface AdmissionExpectation {
  readonly bindingRevision: number
  readonly generation: number
  readonly canonicalLocator: string
  readonly parametersFingerprint: string
}

/** Live policy view re-read AT THE EFFECT (BLOCK ②). */
export interface AdmissionLiveState {
  readonly revoked: boolean
  readonly generation: number
  readonly bindingRevision: number
  readonly grantId?: string
}

/** Same law as controlled-fs bindAdmissionRecheck; used pre-chain (full) … */
export function verifyCallAdmission (expected: AdmissionExpectation, binding: CallAdmission | undefined): void {
  if (binding === undefined) throw new GovernedFsError('GOV_ADMISSION_MISSING', 'read refused: no per-call admission binding supplied (undefined rejects)')
  if (binding.revoked === true) throw new GovernedFsError('GOV_ABANDONED_REVOKED', 'read refused: admission binding revoked')
  if (binding.bindingRevision !== expected.bindingRevision) throw new GovernedFsError('GOV_ADMISSION_DIVERGENT', `read refused: binding revision mismatch (${String(expected.bindingRevision)} expected)`)
  if (binding.generation !== expected.generation) throw new GovernedFsError('GOV_ADMISSION_DIVERGENT', `read refused: authority generation mismatch (${String(expected.generation)} expected)`)
  if (binding.canonicalLocator !== expected.canonicalLocator) throw new GovernedFsError('GOV_ADMISSION_DIVERGENT', 'read refused: canonical locator mismatch')
  if (binding.parametersFingerprint !== expected.parametersFingerprint) throw new GovernedFsError('GOV_ADMISSION_DIVERGENT', 'read refused: parameters fingerprint divergence')
}

/** … and AGAIN at the effect boundary against the CURRENT state (BLOCK ②). */
export function verifyLiveAdmission (binding: CallAdmission, live: AdmissionLiveState): void {
  if (live.grantId !== undefined && live.grantId !== binding.grantId) throw new GovernedFsError('GOV_ADMISSION_DIVERGENT', 'read refused at effect boundary: the grant consumed is not the current grant')
  if (live.revoked) throw new GovernedFsError('GOV_ABANDONED_REVOKED', 'read refused at effect boundary: admission revoked before the read effect')
  if (live.generation !== binding.generation) throw new GovernedFsError('GOV_ADMISSION_DIVERGENT', `read refused at effect boundary: generation moved (${String(binding.generation)} bound, ${String(live.generation)} current)`)
  if (live.bindingRevision !== binding.bindingRevision) throw new GovernedFsError('GOV_ADMISSION_DIVERGENT', 'read refused at effect boundary: binding revision moved before the read effect')
}

export interface DirIdentity { readonly dev: number, readonly ino: number }

export interface GovernedReadCaps {
  /** Absolute trusted root; the chain anchors on its dirfd. */
  readonly rootDir: string
  /** BLOCK ④ — expected identity of the trusted root dir; mismatch refuses. */
  readonly expectedRootIdentity: DirIdentity
  /** Bytes cap for the whole verified read (fail-closed before reading more). */
  readonly maxSizeBytes: number
  /** Reject nlink>1 (hardlink) targets by default (design §3 hardlink row). */
  readonly rejectHardlinks: boolean
}

/** Observation seam for tests: counts every open AND every read syscall. */
export interface OpenObserver {
  onOpen (path: string, flags: number): void
  onStat? (path: string): void
  onRead? (): void
}

function openBeneath (parentFd: number, comp: string, observer: OpenObserver | undefined, final: boolean): number {
  const via = `/proc/self/fd/${String(parentFd)}/${comp}`
  // BLOCK ⑨ — BEFORE opening, lstat the component through the SAME anchor fd:
  // symlinks refuse as links, and special files (fifo/socket/device) refuse
  // BEFORE any O_RDONLY open could touch them (order self-evidence: the
  // observer records onStat strictly before onOpen for each component).
  // Residual window (lstat→open swap to a special file) is bounded by
  // O_NONBLOCK + the post-open fstat law; a full close needs openat2, which
  // node lacks — disclosed here, never claimed closed.
  try {
    observer?.onStat?.(via)
    const lst = lstatSync(via)
    if (lst.isSymbolicLink()) throw new GovernedFsError('GOV_ELOOP', `read refused: symlink component "${comp}" (pre-open lstat law)`)
    if (final) {
      if (!lst.isFile()) throw new GovernedFsError('GOV_NOT_REGULAR', `read refused: "${comp}" is not a regular file (pre-open lstat law: fifo/socket/device never opened)`)
    } else if (!lst.isDirectory()) {
      throw new GovernedFsError('GOV_NOT_REGULAR', `read refused: chain step "${comp}" is not a directory (pre-open lstat law)`)
    }
  } catch (err) {
    if (err instanceof GovernedFsError) throw err
    const e = err as NodeJS.ErrnoException
    if (e.code === 'ENOENT') throw new GovernedFsError('GOV_NOT_FOUND', `read refused: component "${comp}" not found (pre-open lstat)`)
    throw new GovernedFsError('GOV_IO', `read refused: pre-open lstat failed at component "${comp}" (${String(e.code ?? 'ERR')})`)
  }
  const flags = O_RDONLY | NOFOLLOW_F | O_CLOEXEC | (final ? NONBLOCK_F : DIRECTORY_F)
  observer?.onOpen(via, flags)
  try {
    return openSync(via, flags)
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'ELOOP') throw new GovernedFsError('GOV_ELOOP', `read refused: symlink component "${comp}" (O_NOFOLLOW law)`)
    if (e.code === 'ENOENT') throw new GovernedFsError('GOV_NOT_FOUND', `read refused: component "${comp}" not found`)
    if (e.code === 'ENOTDIR') throw new GovernedFsError('GOV_NOT_REGULAR', `read refused: component "${comp}" is not a directory (O_NOFOLLOW|O_DIRECTORY answers ENOTDIR for symlinks)`)
    if (e.code === 'EACCES' || e.code === 'EPERM') throw new GovernedFsError('GOV_IO', `read refused: permission denied at component "${comp}"`)
    throw new GovernedFsError('GOV_IO', `read refused: open failed at component "${comp}" (${String(e.code ?? 'ERR')})`)
  }
}

export interface VerifiedHandle {
  readonly fd: number
  /** The dirfd the final component was opened through — effect-recheck only. */
  readonly parentFd: number
  readonly finalComponent: string
  readonly size: number
  readonly dev: number
  readonly ino: number
  readonly nlink: number
}

/**
 * Anchor law + BLOCK ①/④: open the root dirfd by absolute path, VERIFY its
 * identity against the expected anchor, walk one component at a time beneath
 * the parent fd, and on success close every dirfd except the final handle
 * and the parent dirfd it was opened through (execute() closes both).
 */
export function openVerifiedChain (rootDir: string, requestedPath: string, caps: GovernedReadCaps, signal: AbortSignal | undefined, observer?: OpenObserver): VerifiedHandle {
  if (!isAbsolute(rootDir)) throw new GovernedFsError('GOV_BAD_ARGS', 'rootDir must be absolute')
  const abs = isAbsolute(requestedPath) ? resolvePath(requestedPath) : resolvePath(rootDir, requestedPath)
  // Containment law (native contract shape): resolve against the root, then a
  // LEXICAL check on the normalized path — path.resolve already collapses
  // '..', so the component filter below is defense-in-depth, NOT the actual
  // traversal guard. The real guards are per-component O_NOFOLLOW chain walks
  // (a symlinked hop refuses even when the normalized text stayed inside).
  const rel = abs.startsWith(rootDir + '/') ? abs.slice(rootDir.length + 1) : (() => { throw new GovernedFsError('GOV_OUTSIDE_ROOT', 'read refused: target outside the trusted root') })()
  const comps = rel.split('/').filter((c) => c !== '' && c !== '.')
  if (comps.length === 0 || comps.some((c) => c === '..')) throw new GovernedFsError('GOV_OUTSIDE_ROOT', 'read refused: empty target or parent traversal')

  observer?.onOpen(rootDir, O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_DIRECTORY)
  let rootFd = -1
  try { rootFd = openSync(rootDir, O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_DIRECTORY) } catch (e) {
    throw new GovernedFsError('GOV_NO_PROC', `read refused: cannot anchor on the trusted root dirfd (${String((e as NodeJS.ErrnoException).code ?? 'ERR')}) — no string-path fallback exists`)
  }
  const opened: number[] = [rootFd]
  try {
    const rootStat = fstatSync(rootFd)
    if (!rootStat.isDirectory()) throw new GovernedFsError('GOV_BAD_ARGS', 'rootDir is not a directory')
    // BLOCK ④ — the absolute root open becomes an anchor ONLY after the
    // identity matches; a symlinked or swapped ancestor diverges here.
    if (rootStat.dev !== caps.expectedRootIdentity.dev || rootStat.ino !== caps.expectedRootIdentity.ino) {
      throw new GovernedFsError('GOV_FOREIGN_ROOT', 'read refused: trusted root dirfd identity does not match the expected anchor (dev/ino)')
    }
    let current = rootFd
    for (let i = 0; i < comps.length; i += 1) {
      if (signal?.aborted === true) throw new GovernedFsError('GOV_ABORTED', 'read refused: aborted before chain step')
      const comp = comps[i] ?? ''
      const final = i === comps.length - 1
      const fd = openBeneath(current, comp, observer, final)
      opened.push(fd)
      const st = fstatSync(fd)
      if (final) {
        if (!st.isFile()) throw new GovernedFsError('GOV_NOT_REGULAR', 'read refused: not a regular file (S_ISREG law)')
        if (caps.rejectHardlinks && st.nlink > 1) throw new GovernedFsError('GOV_HARDLINK', 'read refused: hardlink target (nlink>1) rejected by default law')
        if (st.size > caps.maxSizeBytes) throw new GovernedFsError('GOV_TOO_LARGE', `read refused: size ${String(st.size)} exceeds cap ${String(caps.maxSizeBytes)}`)
        if (st.dev !== rootStat.dev) throw new GovernedFsError('GOV_FOREIGN_ROOT', 'read refused: target lives on a different device than the trusted root')
        // BLOCK ① — success path: close every dirfd except the final handle
        // and the parent dirfd (the recheck handle closes with it in execute).
        for (const fdToClose of opened) {
          if (fdToClose !== fd && fdToClose !== current) { try { closeSync(fdToClose) } catch { /* noop */ } }
        }
        return { fd, parentFd: current, finalComponent: comp, size: st.size, dev: st.dev, ino: st.ino, nlink: st.nlink }
      }
      if (!st.isDirectory()) throw new GovernedFsError('GOV_NOT_REGULAR', `chain step "${comp}" is not a directory`)
      current = fd
    }
    throw new GovernedFsError('GOV_IO', 'unreachable')
  } catch (err) {
    for (const fdToClose of opened) { try { closeSync(fdToClose) } catch { /* already closed */ } }
    throw err
  }
}

export function closeHandle (handle: VerifiedHandle): void {
  try { closeSync(handle.fd) } catch { /* already closed */ }
  try { closeSync(handle.parentFd) } catch { /* same fd or already closed */ }
}

/**
 * BLOCK ③/⑥ — retarget guard: re-open the final component THROUGH THE PARENT
 * FD (never the target reopened by string path) and require the SAME
 * (dev,ino) as the verified snapshot before any byte read.
 */
export function recheckHandleIdentity (handle: VerifiedHandle, observer?: OpenObserver): void {
  const probe = openBeneath(handle.parentFd, handle.finalComponent, observer, true)
  try {
    const st = fstatSync(probe)
    if (st.dev !== handle.dev || st.ino !== handle.ino) {
      throw new GovernedFsError('GOV_STALE_HANDLE', 'read refused at effect boundary: the verified handle no longer matches the directory entry (retarget)')
    }
  } finally {
    try { closeSync(probe) } catch { /* noop */ }
  }
}

/** Read the WHOLE verified file through the fd only (capped before reading). */
export function readFdBytes (handle: VerifiedHandle, signal: AbortSignal | undefined, observer?: OpenObserver): Buffer {
  if (signal?.aborted === true) throw new GovernedFsError('GOV_ABORTED', 'read refused: aborted before fd read')
  const buf = Buffer.allocUnsafe(handle.size)
  let pos = 0
  while (pos < handle.size) {
    observer?.onRead?.()
    const n = readSync(handle.fd, buf, pos, handle.size - pos, pos)
    if (n <= 0) break
    pos += n
  }
  return buf.subarray(0, pos)
}
