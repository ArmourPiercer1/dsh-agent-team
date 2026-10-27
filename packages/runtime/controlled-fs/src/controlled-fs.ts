/**
 * ControlledFs — the trusted-Host FS mediator (A5-PR3, Lane B).
 *
 * Implements the frozen PR0 `ControlledFs` interface against the REAL
 * `node:fs` behind registered instance roots, plus two lane extensions
 * (`resolveDescriptor`, `readDescriptor`) for the C-FS {fs,path,fd?}
 * descriptor surface. DORMANT by construction: nothing here is wired into
 * the live composition (no barrel/registry/tsconfig touched — the
 * integration owner wires after C-ADM freeze, README §4).
 *
 * ORDER OF LAW (every operation, checks BEFORE the open):
 *   clock finite → realm + anchor containment → grant re-validation
 *   (expiry/generation/consumption via PR0 validateGrantForCall + the
 *   lane's subtree scope law) → exec-time admission recheck SEAM →
 *   observation policy (hidden is typed here, never silent) → window law
 *   → alias walk (lstat per segment, symlinks refused before any open) →
 *   [probe-seam hook] → open with O_NOFOLLOW → fd registry + ledger →
 *   EXEC-TIME OBJECT RE-READ (proc path under anchor; fstat identity equals
 *   the snapshot) → only then read/write bytes → close fd (no standing fd
 *   across calls).
 *
 * @module packages/runtime/controlled-fs/src/controlled-fs
 */

import { createHash } from 'node:crypto'
import {
  constants as fsConstants,
  lstat,
  readdir,
  readlinkSync,
  realpathSync,
  type Dirent,
  type Stats,
} from 'node:fs'
import { open as fsOpen, type FileHandle } from 'node:fs/promises'
import { promisify } from 'node:util'
import * as path from 'node:path'

import {
  EFFECT_REQUIRED_RIGHT,
  validateGrantForCall,
  type ControlledFs,
  type FsObservation,
  type FsReadWindow,
  type FsTextContent,
  type FsWriteReceipt,
  type GovernanceError,
  type GovernanceResult,
  type MemberRef,
  type OperationGrant,
  type ResourceEffect,
  type ResourceRef,
} from '../../../domain/tool-governance/src/index.js'

import type { SubtreeContains } from '../../../domain/authority-envelope/src/index.js'

import {
  descriptorToResourceRef,
  resourceRefToDescriptor,
  type FsInstanceBinding,
  type FsResourceDescriptor,
} from './cf-descriptor.js'
import { cfsDenial, cfsHidden, cfsUndetermined, type CfDenyReason } from './cf-errors.js'
import { isBeneath, NO_RECHECK, recheckSingleLink, verifyOpenedHandle, type AdmissionRecheck, type IdentitySnapshot } from './open-at-exec.js'

const lstatAsync = promisify(lstat)
const readdirAsync = promisify(readdir)

// ---------------------------------------------------------------------------
// Config + ledger surface
// ---------------------------------------------------------------------------

export interface ControlledFsInstance {
  readonly fs: string
  readonly rootDir: string
  readonly realmId: string
  readonly kind: 'absolute-path'
}

export interface LaneHooks {
  /**
   * PoC3 PROBE SEAM (test-only): fires after the check-time snapshot and
   * BEFORE the open — the fixture's deterministic "attacker window".
   */
  readonly onAfterPreCheckBeforeOpen?: (info: { readonly op: string; readonly locator: string }) => void | Promise<void>
  /** Fires with the kernel fd of every successful lane-internal open. */
  readonly onFdOpened?: (info: { readonly op: string; readonly fd: number; readonly locator: string }) => void
  /**
   * u7-r4091 PROBE SEAM (test-only): fires on the VERIFIED write fd of
   * `writeText` between the exec-time re-read and the first write — the
   * fixture's deterministic second attacker window (R-409-1 re-check). No
   * sanctioned wiring passes hooks at all; the seam itself changes no law.
   */
  readonly onAfterVerifiedBeforeWrite?: (info: { readonly op: string; readonly fd: number; readonly locator: string }) => void | Promise<void>
}

export interface ControlledFsLaneConfig {
  readonly instances: readonly ControlledFsInstance[]
  /** Injected clock (the lane owns no clock). Non-finite ⇒ typed refusal. */
  readonly now?: () => number
  readonly currentAuthorityGeneration?: number
  /** PR2 ledger VIEW (read-only; consumption stays PR2's durable law). */
  readonly consumed?: (grantId: string) => boolean
  /** Observation policy seam: what this member may even see. */
  readonly visibility?: (member: MemberRef, desc: FsResourceDescriptor) => 'visible' | 'hidden'
  /** Exec-time admission recheck seam (default = honest no-recheck pre-freeze;
   *  the WIRED face never uses this default — see `admission-binding.ts`). */
  readonly recheck?: AdmissionRecheck
  /**
   * G-d C1 (integration wiring): when the consumer wires the planes together
   * it injects the authority-envelope `SubtreeContains` here, and directory
   * coverage is decided by the planes' OWN containment law. Absent, the lane
   * keeps its deliberately narrower identity + prefix rule (zero behaviour
   * change for lane-local consumers).
   */
  readonly subtreeContains?: SubtreeContains
  readonly hooks?: LaneHooks
}

export interface LedgerEntry {
  readonly seq: number
  readonly op: string
  readonly member: string
  readonly locator: string
  readonly stage: string
  readonly diagnostic?: string
}

export interface TrustedControlledFs extends ControlledFs {
  /** Lane extension: the C-FS descriptor view (never carries a standing fd). */
  readonly resolveDescriptor: (
    grant: OperationGrant,
    ref: ResourceRef,
  ) => Promise<GovernanceResult<FsResourceDescriptor>>
  /** Lane extension: fd-carrying descriptor read — the fd is verified, never trusted. */
  readonly readDescriptor: (
    grant: OperationGrant,
    desc: FsResourceDescriptor,
    window: FsReadWindow,
  ) => Promise<GovernanceResult<FsTextContent>>
}

export interface ControlledFsLane {
  readonly fs: TrustedControlledFs
  /** Append-only decision ledger (open-issued/refused/withheld/fd lines). */
  readonly ledger: readonly LedgerEntry[]
}

type Failure = { readonly ok: false; readonly error: GovernanceError }
const FAIL = (f: { ok: false; error: GovernanceError }): Failure => f

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface ResolvedTarget {
  readonly instance: ControlledFsInstance
  readonly binding: FsInstanceBinding
  readonly desc: FsResourceDescriptor
  readonly locator: string
  readonly absPath: string
  readonly anchorReal: string
}

const MAX_WINDOW_BYTES = 1 << 20 // bounded read (1 MiB)

function sha256Hex(text: string): string {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`
}

/**
 * Scope law: identity, plus a `directory` effect covering paths below it.
 *
 * G-d C1 (integration wiring landed): when the wiring consumer injects the
 * authority-envelope `SubtreeContains` (via config), the SUBTREE arm is the
 * planes' own containment law — this module decides nothing scope-shaped on
 * its own in that mode. Without the injection the narrower lane rule below
 * stays exactly as Lane B shipped it (identity + directory-prefix), so
 * lane-local behaviour is byte-identical to the pre-wiring DORMANT round.
 */
function effectCovers(
  opKind: ResourceEffect['kind'],
  target: ResourceRef,
  grant: OperationGrant,
  subtreeContains?: SubtreeContains,
): boolean {
  const need = EFFECT_REQUIRED_RIGHT[opKind]
  for (const effect of grant.effects.effects) {
    if (effect.kind !== opKind || effect.resource === null) continue
    const res: ResourceRef = effect.resource
    if (res.realmId !== target.realmId) continue
    if (need !== undefined && !res.rights.includes(need)) continue
    if (res.canonicalLocator === target.canonicalLocator) return true
    if (res.kind === 'directory') {
      if (subtreeContains !== undefined) {
        // C1: the injected containment answers for the pair, as-is.
        if (subtreeContains(res.canonicalLocator, target.canonicalLocator)) return true
      } else {
        const root = res.canonicalLocator.replace(/\/+$/, '')
        if (target.canonicalLocator.startsWith(`${root}/`)) return true
      }
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// The lane factory
// ---------------------------------------------------------------------------

export function createControlledFsLane(config: ControlledFsLaneConfig): ControlledFsLane {
  const now = config.now ?? Date.now
  const generation = config.currentAuthorityGeneration ?? 1
  const ledgerView = { isConsumed: config.consumed ?? (() => false) }
  const visibility = config.visibility ?? (() => 'visible' as const)
  const recheck = config.recheck ?? NO_RECHECK
  const hooks = config.hooks ?? {}

  const entries: LedgerEntry[] = []
  let seq = 0
  const record = (op: string, member: string, locator: string, stage: string, diagnostic?: string): void => {
    entries.push(diagnostic === undefined
      ? { seq: ++seq, op, member, locator, stage }
      : { seq: ++seq, op, member, locator, stage, diagnostic })
  }
  const memberKey = (grant: OperationGrant): string => `${grant.member.teamSessionId}/${grant.member.instanceId}`

  /** fd registry: live lane-held handles only (none survive a call). */
  const fdRegistry = new Map<number, { fs: string; path: string; identity: IdentitySnapshot }>()

  const refused = (op: string, grant: OperationGrant, locator: string, fail: Failure): Failure => {
    record(op, memberKey(grant), locator, `refused:${String(fail.error.details?.['cfClass'] ?? '?')}:${String(fail.error.details?.['cfReason'] ?? '?')}`)
    return fail
  }

  // -- stage 1: clock + realm + anchor ----------------------------------------
  function bindTarget(op: string, grant: OperationGrant, ref: ResourceRef): { ok: true; target: ResolvedTarget } | Failure {
    if (!Number.isFinite(now())) {
      return refused(op, grant, ref.canonicalLocator,
        FAIL(cfsDenial('grant-expired', 'admission refused: the injected clock is not finite (H1: typed refusal before anything)')))
    }
    const instance = config.instances.find((i) => i.realmId === ref.realmId)
    if (instance === undefined || ref.realmId !== grant.realmId) {
      return refused(op, grant, ref.canonicalLocator,
        FAIL(cfsDenial('realm-mismatch', 'admission refused: realm mismatch between grant, ref, and registered instances')))
    }
    const binding: FsInstanceBinding = { realmId: instance.realmId, rootLocator: instance.rootDir }
    const mapped = resourceRefToDescriptor(ref, instance.fs, binding)
    if (!mapped.ok) {
      return refused(op, grant, ref.canonicalLocator,
        FAIL(cfsDenial('outside-anchor', 'admission refused: locator is outside every registered instance root')))
    }
    const anchorReal = realpathSync(instance.rootDir)
    const absPath = mapped.value.path === '.' ? anchorReal : path.join(anchorReal, mapped.value.path)
    if (!isBeneath(anchorReal, absPath)) {
      return refused(op, grant, ref.canonicalLocator,
        FAIL(cfsDenial('outside-anchor', 'admission refused: resolved path escapes the instance anchor')))
    }
    return { ok: true, target: { instance, binding, desc: mapped.value, locator: ref.canonicalLocator, absPath, anchorReal } }
  }

  // -- stage 2: grant re-validation + scope ------------------------------------
  function revalidateGrant(op: string, grant: OperationGrant, ref: ResourceRef, kind: ResourceEffect['kind']): { ok: true } | Failure {
    const selfCheck = validateGrantForCall(grant, {
      now: now(),
      currentAuthorityGeneration: generation,
      member: grant.member,
      callId: grant.callId,
      realmId: grant.realmId,
      bindingId: grant.bindingId,
      bindingRevision: grant.bindingRevision,
      parametersFingerprint: grant.parametersFingerprint,
      // self-subset by construction; the SCOPE law is effectCovers below
      // (identity-subset is too strict for directory effects — lane subtree).
      requestedEffects: grant.effects,
    }, ledgerView)
    if (!selfCheck.ok) {
      const map: Partial<Record<typeof selfCheck.reason, CfDenyReason>> = {
        'grant-expired': 'grant-expired',
        'grant-consumed': 'grant-consumed',
        'authority-generation-stale': 'authority-generation-stale',
        'realm-mismatch': 'realm-mismatch',
      }
      const reason: CfDenyReason = map[selfCheck.reason] ?? 'effect-outside-grant'
      return refused(op, grant, ref.canonicalLocator,
        FAIL(cfsDenial(reason, `admission refused at FS: grant re-validation failed (${selfCheck.reason})`)))
    }
    if (!effectCovers(kind, ref, grant, config.subtreeContains)) {
      return refused(op, grant, ref.canonicalLocator,
        FAIL(cfsDenial('effect-outside-grant', `admission refused at FS: no grant effect covers a ${kind} on this resource`)))
    }
    return { ok: true }
  }

  // -- stage 3: window law (A2C-5) ----------------------------------------------
  function checkWindow(window: FsReadWindow): Failure | null {
    const offsetOk = typeof window.offset === 'number' && Number.isSafeInteger(window.offset) && window.offset >= 0
    const limitOk = window.limit === null || (typeof window.limit === 'number' && Number.isSafeInteger(window.limit) && window.limit > 0)
    if (!offsetOk || !limitOk) {
      return FAIL(cfsDenial('window-rejected', 'read window rejected: offset is a non-negative integer; limit is null (to-EOF, bounded) or a positive integer'))
    }
    return null
  }

  // -- stage 4: alias walk (symlink refusal BEFORE any open) --------------------
  async function aliasWalk(op: string, grant: OperationGrant, target: ResolvedTarget): Promise<{ ok: true; stats: Stats | null } | Failure> {
    let cursor = target.anchorReal
    try {
      const segments = target.desc.path === '.' ? [] : target.desc.path.split('/')
      for (const segment of segments) {
        cursor = path.join(cursor, segment)
        const st = await lstatAsync(cursor)
        if (st.isSymbolicLink()) {
          return refused(op, grant, target.locator,
            FAIL(cfsDenial('symlink-alias', `refused before open: path component is a symlink (${segment})`)))
        }
      }
      const final = await lstatAsync(target.absPath)
      if (final.isSymbolicLink()) {
        return refused(op, grant, target.locator,
          FAIL(cfsDenial('symlink-alias', 'refused before open: the target itself is a symlink alias')))
      }
      return { ok: true, stats: final }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return { ok: true, stats: null } // absent: exec-time judges what appears
      return refused(op, grant, target.locator, FAIL(cfsDenial('path-rejected', `path check failed before open (${String(code)})`)))
    }
  }

  // -- stage 5: open + exec-time object re-read ----------------------------------
  type Opened = { ok: true; handle: FileHandle; identity: IdentitySnapshot }
  async function safeOpen(
    op: string,
    grant: OperationGrant,
    target: ResolvedTarget,
    flags: number,
    stats: Stats | null,
    destructive: boolean,
  ): Promise<Opened | Failure> {
    let handle: FileHandle
    try {
      // Node/libuv opens CLOEXEC by default (no O_CLOEXEC constant on this
      // platform's typings; FD inheritance hardening is PR4's launcher law).
      handle = await fsOpen(target.absPath, flags | fsConstants.O_NOFOLLOW)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ELOOP') return refused(op, grant, target.locator, FAIL(cfsDenial('symlink-alias', 'the OS refused the open (ELOOP): symlink alias')))
      if (code === 'ENOENT') return refused(op, grant, target.locator, FAIL(cfsDenial('not-a-file', 'the object does not exist at open time')))
      if (code === 'EISDIR') return refused(op, grant, target.locator, FAIL(cfsDenial('not-a-file', 'target is a directory')))
      if (code === 'ENOTDIR') return refused(op, grant, target.locator, FAIL(cfsDenial('not-a-directory', 'a path component is not a directory')))
      return refused(op, grant, target.locator, FAIL(cfsDenial('path-rejected', `open failed (${String(code)})`)))
    }
    record(op, memberKey(grant), target.locator, 'open-issued')
    hooks.onFdOpened?.({ op, fd: handle.fd, locator: target.locator })
    const snapshot: IdentitySnapshot | null = stats === null
      ? null
      : { dev: Number(stats.dev), ino: Number(stats.ino), size: stats.size, mtimeMs: stats.mtimeMs }
    const verdict = await verifyOpenedHandle(handle, target.anchorReal, snapshot)
    if (verdict.verdict === 'confirmed') {
      fdRegistry.set(handle.fd, { fs: target.instance.fs, path: target.desc.path, identity: verdict.identity })
      return { ok: true, handle, identity: verdict.identity }
    }
    await handle.close().catch(() => undefined)
    if (verdict.verdict === 'escape' && !destructive) {
      record(op, memberKey(grant), target.locator, 'exec-refused:exec-time-escape', `fd resolved to ${verdict.resolvedPath}`)
      return refused(op, grant, target.locator,
        FAIL(cfsDenial('exec-time-escape', 'exec-time re-read: the open landed OUTSIDE the instance anchor; zero bytes disclosed')))
    }
    if (verdict.verdict === 'hardlink-alias' && !destructive) {
      record(op, memberKey(grant), target.locator, 'exec-refused:hardlink-alias', `nlink=${String(verdict.nlink)}`)
      return refused(op, grant, target.locator, FAIL(cfsDenial('hardlink-alias', verdict.detail)))
    }
    // drift / undeterminable / destructive-escape / destructive-hardlink:
    // identity (and for writes, the landed side effect) cannot be
    // established — the honest third class.
    const detail = verdict.verdict === 'drift'
      ? `snapshot ${verdict.snapshot.dev}:${verdict.snapshot.ino} != actual ${verdict.actual.dev}:${verdict.actual.ino}`
      : verdict.verdict === 'escape'
        ? `destructive open resolved to ${verdict.resolvedPath}`
        : verdict.detail
    if (destructive) {
      record(op, memberKey(grant), target.locator, 'exec-refused:write-side-effect-unconfirmed', detail)
      return FAIL(cfsUndetermined('write-side-effect-unconfirmed',
        'exec-time re-read failed AFTER a destructive open: the write side effect cannot be bounded', { sideEffectPossible: true }))
    }
    record(op, memberKey(grant), target.locator, 'exec-refused:exec-time-identity-drift', detail)
    return FAIL(cfsUndetermined('exec-time-identity-drift',
      'exec-time re-read: the opened object is not the snapshotted object; identity undetermined; zero bytes disclosed', { sideEffectPossible: false }))
  }

  async function closeAndForget(handle: FileHandle, op: string, grant: OperationGrant, target: ResolvedTarget): Promise<void> {
    fdRegistry.delete(handle.fd)
    await handle.close().catch(() => undefined)
    record(op, memberKey(grant), target.locator, 'fd-closed')
  }

  // -- shared pre-open admission -------------------------------------------------
  async function admit(op: string, grant: OperationGrant, ref: ResourceRef, kind: ResourceEffect['kind']): Promise<{ ok: true; target: ResolvedTarget } | Failure> {
    const bound = bindTarget(op, grant, ref)
    if (!bound.ok) return bound
    const validated = revalidateGrant(op, grant, ref, kind)
    if (!validated.ok) return validated
    const again = await recheck.recheck({ op, canonicalLocator: ref.canonicalLocator, parametersFingerprint: grant.parametersFingerprint })
    if (!again.ok) {
      return refused(op, grant, ref.canonicalLocator,
        FAIL(cfsDenial('effect-outside-grant', `exec-time admission recheck refused (${again.reason})`)))
    }
    return bound
  }

  // -- observation policy -----------------------------------------------------------
  function hiddenCheck(op: string, grant: OperationGrant, target: ResolvedTarget, hiddenReason: 'hidden-read' | 'hidden-write'): Failure | null {
    if (visibility(grant.member, target.desc) === 'hidden') {
      const diagnostic = `${op} refused: path is WITHHELD by the observation policy for member ${memberKey(grant)} (withheld is NOT absent); object never opened`
      const fail = FAIL(cfsHidden(hiddenReason, 'observation policy withholds this path from this member', diagnostic))
      return refused(op, grant, target.locator, fail)
    }
    return null
  }

  // -- descriptor bridge --------------------------------------------------------------
  function bindTargetFromDescriptor(op: string, grant: OperationGrant, desc: FsResourceDescriptor): { ok: true; ref: ResourceRef } | Failure {
    const instance = config.instances.find((i) => i.fs === desc.fs)
    if (instance === undefined || instance.realmId !== grant.realmId) {
      return refused(op, grant, `${desc.fs}:${desc.path}`, FAIL(cfsDenial('realm-mismatch', 'descriptor names an instance outside the grant realm')))
    }
    const binding: FsInstanceBinding = { realmId: instance.realmId, rootLocator: instance.rootDir }
    const ref = descriptorToResourceRef(desc, binding, ['read'])
    if (!ref.ok) return refused(op, grant, `${desc.fs}:${desc.path}`, FAIL(cfsDenial('path-rejected', 'descriptor does not map to a legal resource')))
    return { ok: true, ref: ref.value }
  }

  // -- the read pipeline -----------------------------------------------------------------
  async function readViaRef(op: string, grant: OperationGrant, ref: ResourceRef, window: FsReadWindow): Promise<GovernanceResult<FsTextContent>> {
    const admitted = await admit(op, grant, ref, 'read')
    if (!admitted.ok) return admitted
    const { target } = admitted
    const hidden = hiddenCheck(op, grant, target, 'hidden-read')
    if (hidden !== null) return hidden
    const badWindow = checkWindow(window)
    if (badWindow !== null) return refused(op, grant, ref.canonicalLocator, badWindow)
    const walked = await aliasWalk(op, grant, target)
    if (!walked.ok) return walked
    if (walked.stats === null) return refused(op, grant, ref.canonicalLocator, FAIL(cfsDenial('not-a-file', 'the object does not exist')))
    if (!walked.stats.isFile()) return refused(op, grant, ref.canonicalLocator, FAIL(cfsDenial('not-a-file', 'the object is not a regular file')))
    await hooks.onAfterPreCheckBeforeOpen?.({ op, locator: ref.canonicalLocator })
    const opened = await safeOpen(op, grant, target, fsConstants.O_RDONLY, walked.stats, false)
    if (!opened.ok) return opened
    try {
      const size = Math.max(0, Math.min(opened.identity.size - window.offset, window.limit ?? MAX_WINDOW_BYTES))
      const buffer = Buffer.alloc(size)
      let read = 0
      while (read < size) {
        const n = await opened.handle.read(buffer, read, size - read, window.offset + read)
        if (n.bytesRead === 0) break
        read += n.bytesRead
      }
      const text = buffer.toString('utf8', 0, read)
      return {
        ok: true,
        value: Object.freeze({ canonicalLocator: ref.canonicalLocator, text, contentFingerprint: sha256Hex(text) }),
      }
    } finally {
      await closeAndForget(opened.handle, op, grant, target)
    }
  }

  // ---------------------------------------------------------------------------
  // The ControlledFs surface
  // ---------------------------------------------------------------------------

  const api: TrustedControlledFs = {
    async resolve(grant, ref) {
      const admitted = await admit('resolve', grant, ref, 'meta')
      if (!admitted.ok) return admitted
      if (visibility(grant.member, admitted.target.desc) === 'hidden') {
        return refused('resolve', grant, ref.canonicalLocator,
          FAIL(cfsHidden('hidden-read', 'resolve withheld', `resolve refused: path withheld for member ${memberKey(grant)}`)))
      }
      return { ok: true, value: ref }
    },

    async resolveDescriptor(grant, ref) {
      const admitted = await admit('resolveDescriptor', grant, ref, 'meta')
      if (!admitted.ok) return admitted
      // No standing fd across calls: the descriptor NEVER arrives with one.
      return { ok: true, value: Object.freeze({ fs: admitted.target.instance.fs, path: admitted.target.desc.path }) }
    },

    async stat(grant, ref) {
      const admitted = await admit('stat', grant, ref, 'meta')
      if (!admitted.ok) return admitted
      const { target } = admitted
      if (visibility(grant.member, target.desc) === 'hidden') {
        // honest withheld observation: never silent absence, never a lie
        record('stat', memberKey(grant), ref.canonicalLocator, 'withheld-stat', `existence withheld for member ${memberKey(grant)} — withheld is NOT absent`)
        return { ok: true, value: Object.freeze<FsObservation>({ exists: false, kind: 'unknown', withheld: true }) }
      }
      const walked = await aliasWalk('stat', grant, target)
      if (!walked.ok) return walked
      if (walked.stats === null) {
        return { ok: true, value: Object.freeze<FsObservation>({ exists: false, kind: 'unknown', withheld: false }) }
      }
      const kind: FsObservation['kind'] = walked.stats.isFile() ? 'file' : walked.stats.isDirectory() ? 'directory' : 'unknown'
      return { ok: true, value: Object.freeze<FsObservation>({ exists: true, kind, withheld: false }) }
    },

    async readText(grant, ref, window) {
      return readViaRef('readText', grant, ref, window)
    },

    async readDescriptor(grant, desc, window) {
      // A presented fd is a CLAIM, never authority: it must be a handle the
      // lane still holds FOR THIS DESCRIPTOR, or it is refused by name.
      if (desc.fd !== undefined) {
        const entry = fdRegistry.get(desc.fd)
        const claimed = entry !== undefined && entry.fs === desc.fs && entry.path === desc.path
        if (!claimed) {
          let procTarget: string | null = null
          try {
            procTarget = readlinkSync(`/proc/self/fd/${desc.fd}`)
          } catch {
            procTarget = null
          }
          const diagnostic = `readDescriptor refused: fd ${desc.fd} is not a lane-held handle for ${desc.fs}:${desc.path}; /proc view: ${procTarget ?? 'no such fd'} (a closed fd is refused; a recycled number is never trusted)`
          const mapped = bindTargetFromDescriptor('readDescriptor', grant, desc)
          const locator = mapped.ok ? mapped.ref.canonicalLocator : `${desc.fs}:${desc.path}`
          return refused('readDescriptor', grant, locator, procTarget === null
            ? FAIL(cfsDenial('fd-closed', diagnostic))
            : FAIL(cfsDenial('fd-recycled', diagnostic)))
        }
      }
      const bound = bindTargetFromDescriptor('readDescriptor', grant, desc)
      if (!bound.ok) return bound
      return readViaRef('readDescriptor', grant, bound.ref, window)
    },

    async list(grant, dirRefArg) {
      const admitted = await admit('list', grant, dirRefArg, 'list')
      if (!admitted.ok) return admitted
      const { target } = admitted
      const walked = await aliasWalk('list', grant, target)
      if (!walked.ok) return walked
      let dirents: Dirent[]
      try {
        dirents = await readdirAsync(target.absPath, { withFileTypes: true })
      } catch {
        return refused('list', grant, dirRefArg.canonicalLocator, FAIL(cfsDenial('not-a-directory', 'the listed resource is not a readable directory')))
      }
      const out: ResourceRef[] = []
      for (const entry of dirents) {
        const childPath = target.desc.path === '.' ? entry.name : `${target.desc.path}/${entry.name}`
        const childDesc: FsResourceDescriptor = { fs: target.instance.fs, path: childPath }
        if (visibility(grant.member, childDesc) === 'hidden') continue // invisible in listing; EXPLICIT access is the typed path
        const ref = descriptorToResourceRef(childDesc, target.binding, ['meta'])
        if (ref.ok) out.push(ref.value)
      }
      return { ok: true, value: out }
    },

    async writeText(grant, ref, content) {
      const admitted = await admit('writeText', grant, ref, 'write')
      if (!admitted.ok) return admitted
      const { target } = admitted
      const hidden = hiddenCheck('writeText', grant, target, 'hidden-write')
      if (hidden !== null) return hidden
      const walked = await aliasWalk('writeText', grant, target)
      if (!walked.ok) return walked
      if (walked.stats !== null && !walked.stats.isFile()) {
        return refused('writeText', grant, ref.canonicalLocator, FAIL(cfsDenial('not-a-file', 'the write target is not a regular file')))
      }
      await hooks.onAfterPreCheckBeforeOpen?.({ op: 'writeText', locator: ref.canonicalLocator })
      const opened = await safeOpen(
        'writeText', grant, target,
        fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_TRUNC,
        walked.stats,
        true,
      )
      if (!opened.ok) return opened
      try {
        // Lane-internal probe seam (test-only; never passed by the wiring).
        await hooks.onAfterVerifiedBeforeWrite?.({ op: 'writeText', fd: opened.handle.fd, locator: ref.canonicalLocator })
        // R-409-1 defence-in-depth: the SAME-fd link-count re-check
        // immediately before the first write on this verified fd
        // (open-at-exec.ts `recheckSingleLink`). A second name planted after
        // the open-time observation is caught here; the refusal is the
        // existing `hardlink-alias` denial and writes ZERO content bytes.
        // The O_TRUNC of the destructive open is the EXISTING disclosed lane
        // law (it lands before any verification can run) — stated honestly
        // in the message, never papered over.
        const link = await recheckSingleLink(opened.handle)
        if (link.verdict === 'hardlink-alias') {
          return refused('writeText', grant, ref.canonicalLocator, FAIL(cfsDenial(
            'hardlink-alias',
            `${link.detail}; the second name appeared after the open-time verification — refused before the first content byte (the O_TRUNC of the destructive open at open time stands as the lane's disclosed effect)`,
          )))
        }
        if (link.verdict !== 'confirmed') {
          // Post-destructive-open the truncate already landed, so any
          // unbounded re-check rides the EXISTING destructive branch
          // (write-side-effect-unconfirmed, sideEffectPossible true).
          record('writeText', memberKey(grant), ref.canonicalLocator, 'exec-refused:write-side-effect-unconfirmed', link.detail)
          return FAIL(cfsUndetermined('write-side-effect-unconfirmed',
            `exec-time re-read failed BEFORE the first content byte of a destructive open: ${link.detail}; the write side effect cannot be bounded`, { sideEffectPossible: true }))
        }
        await opened.handle.write(content)
        // The receipt is {canonicalLocator, writtenFingerprint} ONLY — old
        // content never travels back (no diff-reading, M-02).
        return {
          ok: true,
          value: Object.freeze<FsWriteReceipt>({ canonicalLocator: ref.canonicalLocator, writtenFingerprint: sha256Hex(content) }),
        }
      } catch (err) {
        return FAIL(cfsUndetermined('write-side-effect-unconfirmed',
          `write may have partially landed (${String((err as NodeJS.ErrnoException).code)})`, { sideEffectPossible: true }))
      } finally {
        await closeAndForget(opened.handle, 'writeText', grant, target)
      }
    },
  }

  return { fs: api, ledger: entries }
}
