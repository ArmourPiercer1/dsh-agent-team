/**
 * Bounded READ pilot — the single-fd execution core.
 *
 * Three laws (B-READ-PILOT-DESIGN.md §2, root supplementary constraints):
 *  1. SINGLE-FD EXECUTION — after verification, bytes are read through the
 *     verified fd only; a pathname reopen after verify is a design violation
 *     (there is no code path here that reopens).
 *  2. NO REOPEN AFTER VERIFY — the trusted-dirfd chain resolves one component
 *     at a time beneath an anchored parent fd; every step re-opens through the
 *     PARENT FD with O_NOFOLLOW, so a mid-chain symlink or retarget cannot
 *     escape the anchor; a retarget between steps yields a typed reject or the
 *     OLD fd's bytes — never a mixed outcome.
 *  3. FLAG DISCIPLINE — O_RDONLY only; no O_TRUNC/O_*WRITE constant exists in
 *     this file. `openat2(RESOLVE_*)` is NOT available on node — this is the
 *     honest dirfd-chain form, reusing the law already proven in
 *     packages/runtime/controlled-fs (open-at-exec.ts `verifyOpenedHandle`:
 *     readlink-under-anchor + fstat(dev,ino) drift check; and
 *     admission-binding.ts `bindAdmissionRecheck`: fingerprint-divergence
 *     refusal BEFORE touching the port). ARBITRARY_TREE_PROFILE_PUBLISHED is
 *     false there — an arbitrary mutable-tree profile must fail closed here
 *     (U1) exactly as it does there.
 *
 * This module performs NO per-call state storage: the admission binding is
 * supplied per execute() call by the caller (exec.admissionBinding). A
 * "current grant" shared across calls is impossible by construction.
 *
 * @module evidence-governed-fs/read-body
 */
import { constants, closeSync, fstatSync, openSync, readSync } from 'node:fs'
import { isAbsolute, resolve as resolvePath } from 'node:path'
import { GovernedFsError } from './errors.js'

const O_RDONLY = constants.O_RDONLY
const O_NOFOLLOW = constants.O_NOFOLLOW ?? 0
const O_DIRECTORY = constants.O_DIRECTORY ?? 0
const O_CLOEXEC = (constants as unknown as { O_CLOEXEC?: number }).O_CLOEXEC ?? 0
// O_NONBLOCK on the FINAL open: without it, opening a FIFO (or a device) blocks
// the caller until a writer appears — the design's bounded-time guard law.
const O_NONBLOCK = constants.O_NONBLOCK ?? 0

/** Per-call admission evidence supplied at execute() time — never cached. */
export interface CallAdmission {
  readonly bindingRevision: number
  readonly generation: number
  readonly canonicalLocator: string
  readonly parametersFingerprint: string
  readonly grantId?: string
  readonly revoked?: boolean
}

/** Expected-identity view (assembled by the caller's binding layer). */
export interface AdmissionExpectation {
  readonly bindingRevision: number
  readonly generation: number
  readonly canonicalLocator: string
  readonly parametersFingerprint: string
}

/**
 * Same law as controlled-fs `bindAdmissionRecheck` (admission-binding.ts):
 * null or divergent fingerprint/identity refuses BEFORE any filesystem
 * touch. Re-implemented locally with citation because the read pilot must
 * not import runtime internals across package seams in the pilot phase.
 */
export function verifyCallAdmission (expected: AdmissionExpectation, binding: CallAdmission | undefined): void {
  if (binding === undefined) throw new GovernedFsError('GOV_ADMISSION_MISSING', 'read refused: no per-call admission binding supplied (undefined rejects)')
  if (binding.revoked === true) throw new GovernedFsError('GOV_ABANDONED_REVOKED', 'read refused: admission binding revoked')
  if (binding.bindingRevision !== expected.bindingRevision) throw new GovernedFsError('GOV_ADMISSION_DIVERGENT', `read refused: binding revision mismatch (${String(expected.bindingRevision)} expected)`)
  if (binding.generation !== expected.generation) throw new GovernedFsError('GOV_ADMISSION_DIVERGENT', `read refused: authority generation mismatch (${String(expected.generation)} expected)`)
  if (binding.canonicalLocator !== expected.canonicalLocator) throw new GovernedFsError('GOV_ADMISSION_DIVERGENT', 'read refused: canonical locator mismatch')
  if (binding.parametersFingerprint !== expected.parametersFingerprint) throw new GovernedFsError('GOV_ADMISSION_DIVERGENT', 'read refused: parameters fingerprint divergence')
}

export interface GovernedReadCaps {
  /** Absolute trusted root; the chain anchors on its dirfd. */
  readonly rootDir: string
  /** Bytes cap for the whole verified read (fail-closed before reading more). */
  readonly maxSizeBytes: number
  /** Reject nlink>1 (hardlink) targets by default (design §3 hardlink row). */
  readonly rejectHardlinks: boolean
}

/** Observation seam for tests: counts and inspects every open this core does. */
export interface OpenObserver {
  onOpen (path: string, flags: number): void
}

interface ChainStep { fd: number, name: string }

function openBeneath (parent: ChainStep | { fd: number }, comp: string, observer: OpenObserver | undefined, final: boolean, dir: boolean): number {
  if (parent.fd < 0) throw new GovernedFsError('GOV_IO', 'chain parent fd invalid')
  const via = `/proc/self/fd/${String(parent.fd)}/${comp}`
  const flags = O_RDONLY | O_NOFOLLOW | O_CLOEXEC | (dir ? O_DIRECTORY : 0) | (final ? O_NONBLOCK : O_DIRECTORY)
  observer?.onOpen(via, flags)
  let fd: number
  try {
    fd = openSync(via, flags)
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'ELOOP') throw new GovernedFsError('GOV_ELOOP', `read refused: symlink component "${comp}" (O_NOFOLLOW law)`)
    if (e.code === 'ENOENT') throw new GovernedFsError('GOV_NOT_FOUND', `read refused: component "${comp}" not found`)
    if (e.code === 'ENOTDIR') throw new GovernedFsError('GOV_NOT_REGULAR', `read refused: component "${comp}" is not a directory`)
    if (e.code === 'EACCES' || e.code === 'EPERM') throw new GovernedFsError('GOV_IO', `read refused: permission denied at component "${comp}"`)
    throw new GovernedFsError('GOV_IO', `read refused: open failed at component "${comp}" (${String(e.code)})`)
  }
  return fd
}

export interface VerifiedHandle {
  readonly fd: number
  readonly size: number
  readonly dev: number
  readonly ino: number
  readonly nlink: number
}

/**
 * Anchor law: open the trusted root dirfd, then walk the RELATIVE path one
 * component at a time beneath the parent fd (never a string-path re-resolve).
 * Escapes ('..', absolute targets outside root) reject before any open.
 */
export function openVerifiedChain (rootDir: string, requestedPath: string, caps: GovernedReadCaps, signal: AbortSignal | undefined, observer?: OpenObserver): VerifiedHandle {
  if (!isAbsolute(rootDir)) throw new GovernedFsError('GOV_BAD_ARGS', 'rootDir must be absolute')
  const abs = isAbsolute(requestedPath) ? resolvePath(requestedPath) : resolvePath(rootDir, requestedPath)
  const rel = abs.startsWith(rootDir + '/') ? abs.slice(rootDir.length + 1) : (abs === rootDir ? '' : (() => { throw new GovernedFsError('GOV_OUTSIDE_ROOT', 'read refused: target outside the trusted root') })())
  if (rel === '') throw new GovernedFsError('GOV_NOT_REGULAR', 'read refused: target is the root itself')
  const comps = rel.split('/').filter((c) => c !== '' && c !== '.')
  if (comps.some((c) => c === '..')) throw new GovernedFsError('GOV_OUTSIDE_ROOT', 'read refused: parent traversal rejected')

  let rootFd = -1
  const openRoot = '/proc/self/fd'
  observer?.onOpen(rootDir, O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_DIRECTORY)
  try { rootFd = openSync(rootDir, O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_DIRECTORY) } catch (e) {
    throw new GovernedFsError('GOV_NO_PROC', `read refused: cannot anchor on the trusted root dirfd (${String((e as NodeJS.ErrnoException).code ?? 'ERR')}) — no string-path fallback exists`)
  }
  void openRoot
  const opened: number[] = [rootFd]
  try {
    const rootStat = fstatSync(rootFd)
    if (!rootStat.isDirectory()) throw new GovernedFsError('GOV_BAD_ARGS', 'rootDir is not a directory')
    let current = { fd: rootFd }
    for (let i = 0; i < comps.length; i += 1) {
      if (signal?.aborted === true) throw new GovernedFsError('GOV_ABORTED', 'read refused: aborted before chain step')
      const comp = comps[i]
      if (comp === undefined) continue
      const final = i === comps.length - 1
      const fd = openBeneath(current, comp, observer, final, false)
      opened.push(fd)
      const st = fstatSync(fd)
      if (final) {
        if (!st.isFile()) throw new GovernedFsError('GOV_NOT_REGULAR', 'read refused: not a regular file (S_ISREG law)')
        if (caps.rejectHardlinks && st.nlink > 1) throw new GovernedFsError('GOV_HARDLINK', 'read refused: hardlink target (nlink>1) rejected by default law')
        if (st.size > caps.maxSizeBytes) throw new GovernedFsError('GOV_TOO_LARGE', `read refused: size ${String(st.size)} exceeds cap ${String(caps.maxSizeBytes)}`)
        if (st.dev !== rootStat.dev) throw new GovernedFsError('GOV_FOREIGN_ROOT', 'read refused: target lives on a different device than the trusted root')
        return { fd, size: st.size, dev: st.dev, ino: st.ino, nlink: st.nlink }
      }
      if (!st.isDirectory()) throw new GovernedFsError('GOV_NOT_REGULAR', `chain step "${comp}" is not a directory`)
      current = { fd }
    }
    throw new GovernedFsError('GOV_IO', 'unreachable')
  } catch (err) {
    for (const fd of opened) { try { closeSync(fd) } catch { /* already closed */ } }
    throw err
  }
}

/** Read the WHOLE verified file through the fd only (capped before read). */
export function readFdBytes (handle: VerifiedHandle, signal: AbortSignal | undefined, observer?: OpenObserver): Buffer {
  if (signal?.aborted === true) throw new GovernedFsError('GOV_ABORTED', 'read refused: aborted before fd read')
  const buf = Buffer.allocUnsafe(handle.size)
  let pos = 0
  while (pos < handle.size) {
    const n = readSync(handle.fd, buf, pos, handle.size - pos, pos)
    if (n <= 0) break
    pos += n
  }
  void observer
  return buf.subarray(0, pos)
}
