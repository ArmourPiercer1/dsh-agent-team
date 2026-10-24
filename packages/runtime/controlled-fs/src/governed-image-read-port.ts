/**
 * THE production readBounded port for the governed B-IMAGE arm (root ruling:
 * a CENTER-owned FS-PROC port, built on the M1-verified read binary boundary
 * — this module is the production leg the arm's header disclosed as
 * NOT_VERIFIED-in-lane).
 *
 * Law carried (each clause VERBATIM from the M1-verified governed read row,
 * plane-effect-backends.mjs — the recipe is copied, not re-invented):
 *  - the approved fact is a REALPATH AGREEMENT: the resolved real target
 *    must equal the approved lexical target or the call is STALE
 *    (`ANCHOR-DRIFT`, zero bytes);
 *  - the check-time path string NEVER carries the open: O_RDONLY|O_NOFOLLOW
 *    (ELOOP = symlink-alias refusal) and the ACTUAL fd is re-read by
 *    `verifyOpenedHandle` (/proc/self/fd containment + fstat-vs-snapshot
 *    drift) BEFORE any byte is read — bytes come from the verified handle,
 *    never from the path;
 *  - ONE close owner: every post-open outcome exits through the same finally;
 *  - the cap lives on the READ itself (bounded-bytes-read.ts, cap+1 stop on
 *    the SAME fd): the port passes the byteLength FACT through (it may
 *    answer maxBytes+1) — the ARM refuses over-cap with the measured fact;
 *  - cancellation is answered inside the read by THROWING an AbortError (the
 *    arm's documented CANCELLED edge: commit never started, zero writes).
 *
 * Port protocol (the arm's contract, image.mjs):
 *   port({ grant, realmId, canonicalLocator }, { maxBytes, signal? })
 *     -> { ok: true, value: { observedKind, byteLength, bytes } }
 *     -> { ok: false, code, detail }            (refusals, passed verbatim)
 *     -> throws AbortError on cancellation.
 * The `grant` is the REAL execution credential of the call (minted durable
 * grant, or the trusted face's policy-admitted grant): its PRESENCE is
 * required at the boundary (arm law "there is NO third shape" is enforced
 * where the bytes are fetched, not only where they were promised); the port
 * never interprets its contents — the durable ledger owns that check.
 *
 * @module packages/runtime/controlled-fs/src/governed-image-read-port
 */
import { constants as fsConstants, realpathSync, lstatSync, readlinkSync } from 'node:fs'
import { open as fsOpen } from 'node:fs/promises'
import path from 'node:path'
import { verifyOpenedHandle, isBeneath } from './open-at-exec.js'
import { readBoundedBytes } from './bounded-bytes-read.js'

export interface GovernedImageReadInput {
  readonly grant: unknown
  readonly realmId?: string
  readonly canonicalLocator: string
}

export interface GovernedImageReadPort {
  (input: GovernedImageReadInput, opts: { readonly maxBytes: number; readonly signal?: { readonly aborted?: boolean } }): Promise<
    | { ok: true; value: { observedKind: 'file'; byteLength: number; bytes: Uint8Array } }
    | { ok: false; code: string; detail: string }
  >
}

function refused(code: string, detail: string): { ok: false; code: string; detail: string } {
  return { ok: false, code, detail }
}

function abortError(): Error {
  const error = new Error('the governed image read was cancelled inside the port')
  error.name = 'AbortError'
  return error
}

/**
 * Bind a port to ONE governed namespace root (the same root the arm anchors
 * against — the port re-anchors independently; a port without a root cannot
 * be constructed).
 */
export function createGovernedImageReadPort(deps: { readonly namespaceRoot: string }): GovernedImageReadPort {
  const namespaceRoot = deps.namespaceRoot
  if (typeof namespaceRoot !== 'string' || namespaceRoot.length === 0) {
    throw new TypeError('governed-image-read-port: namespaceRoot must be a non-empty string')
  }
  let rootReal: string
  try {
    rootReal = realpathSync(namespaceRoot)
  } catch {
    throw new TypeError(`governed-image-read-port: namespaceRoot does not resolve to a real directory (${namespaceRoot})`)
  }

  return async (input, opts) => {
    // Credential presence at the byte boundary (never interpreted here).
    if (input?.grant === null || input?.grant === undefined) {
      return refused('CREDENTIAL-ABSENT', 'the read was presented without the call\'s real execution credential — no bytes are fetched for an uncredentialed request')
    }
    const maxBytes = opts?.maxBytes
    if (typeof maxBytes !== 'number' || !Number.isSafeInteger(maxBytes) || maxBytes < 0) {
      return refused('CAP-INVALID', 'maxBytes must be a non-negative safe integer (the caller owns the cap; this port never substitutes one)')
    }
    const approved = input.canonicalLocator
    if (typeof approved !== 'string' || approved.length === 0 || !path.isAbsolute(approved)) {
      return refused('ABSOLUTE-ONLY', 'the port accepts only an absolute canonical locator (the arm anchors; the port re-verifies)')
    }
    // REALPATH AGREEMENT + containment (both the root and the target).
    let real: string
    try {
      real = realpathSync(approved)
    } catch {
      return refused('target-unreadable', 'the object does not exist at resolve time')
    }
    if (real !== approved) {
      return refused('ANCHOR-DRIFT', `the resolved real target (${real}) differs from the approved lexical target (${approved}); this call is stale and reads nothing`)
    }
    if (!isBeneath(rootReal, real)) {
      return refused('ANCHOR-ESCAPE', 'the target resolves OUTSIDE the governed namespace root')
    }
    // lstat (not stat): after the realpath AGREEMENT the lexeme IS the
    // resolved object, so lstat answers the same facts as stat — and it is
    // the same call the reviewed post-consume law uses after its own
    // agreement step (the plugin lane's minimal `fs` shim weak-types only
    // statSync; this port stays on the rich face without touching the shim).
    let stat
    try {
      stat = lstatSync(real)
    } catch {
      return refused('target-unreadable', 'the anchored target could not be stat-ed')
    }
    if (!stat.isFile()) return refused('not-a-file', 'the governed image read is a file effect, never a directory walk')
    let handle
    try {
      handle = await fsOpen(real, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
    } catch (error) {
      const code = String((error as { code?: string })?.code ?? '')
      if (code === 'ELOOP') return refused('symlink-alias', 'the OS refused the open (ELOOP): symlink alias')
      if (code === 'ENOENT') return refused('target-unreadable', 'the object does not exist at open time')
      if (code === 'EISDIR') return refused('not-a-file', 'the governed image read is a file effect, never a directory walk')
      return refused('open-failed', code.slice(0, 80))
    }
    // ONE close owner from here on.
    try {
      const snapshot = { dev: Number(stat.dev), ino: Number(stat.ino), size: stat.size, mtimeMs: stat.mtimeMs }
      const recheck = await verifyOpenedHandle(handle, rootReal, snapshot)
      if (recheck.verdict !== 'confirmed') {
        const detail = recheck.verdict === 'escape'
          ? `exec-time re-read: the fd resolved to ${recheck.resolvedPath} — OUTSIDE the governed anchor`
          : recheck.verdict === 'drift'
            ? `snapshot ${String(recheck.snapshot.dev)}:${String(recheck.snapshot.ino)} != opened ${String(recheck.actual.dev)}:${String(recheck.actual.ino)}`
            : recheck.detail
        return refused(`exec-time-${recheck.verdict}`, `${String(detail).slice(0, 200)}; zero bytes disclosed`)
      }
      const read = await readBoundedBytes(handle, { maxBytes, ...(opts.signal === undefined ? {} : { signal: opts.signal }) })
      if (read.ok === false) {
        // Cancellation answered INSIDE the read (the arm's documented
        // AbortError edge: zero attachment writes, commit never started).
        throw abortError()
      }
      // The FACT passes through verbatim: byteLength may be maxBytes+1
      // (the over-cap refusal is the ARM'S, measured on this fact).
      return { ok: true, value: { observedKind: 'file', byteLength: read.byteLength, bytes: read.bytes } }
    } finally {
      await handle.close().catch(() => {})
    }
  }
}

/** Visible for tests that need the containment helper without duplicating it. */
export const __testing = { isBeneath, readlinkSync }
