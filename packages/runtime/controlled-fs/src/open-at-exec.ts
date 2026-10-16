/**
 * Open-at-exec — the exec-time RE-READ seam (INTERFACES-v1 C-FS, plan §6).
 *
 * Two independent laws run at the moment of the real open:
 *
 *  1. POLICY RE-READ (this module's seam, `AdmissionRecheck`): the decision
 *     taken at check time is re-confirmed at exec time. INTEGRATION NOTE
 *     (C-ADM freeze, do not live-wire before PR2 merges): this is exactly
 *     where the PR1 fingerprint law re-attaches — the recheck must present
 *     the SAME `parametersFingerprint` the Guard saw pre-call, so a
 *     re-resolved definition cannot exec under another call's fingerprint.
 *     Until the integration owner wires it, the seam runs with the honest
 *     `noRecheck` default, and README §2 records this as a pre-freeze
 *     deviation, NOT as if the recheck existed.
 *
 *  2. OBJECT RE-READ (implemented here, real syscalls): the opened FD is
 *     matched against the check-time snapshot —
 *       - `readlink /proc/self/fd/<n>` must resolve at-or-below the instance
 *         anchor (a directory swapped to an outside symlink mid-flight is
 *         caught here, AFTER the OS open and BEFORE any byte is read);
 *       - `fstat` (dev, ino) must equal the pre-open `lstat` snapshot; any
 *         drift is `undetermined` (identity cannot be established) — never
 *         silently "close enough".
 *
 * The kernel-grade guarantee (openat2 + RESOLVE_BENEATH/RESOLVE_IN_ROOT on
 * a trusted directory FD) is declared as the `OpenAtPort` seam below: a
 * native helper lands it at integration time; this file keeps the honest
 * node:fs fallback and its documented residual windows (README §3).
 *
 * @module packages/runtime/controlled-fs/src/open-at-exec
 */

import { readlinkSync, realpathSync } from 'node:fs'
import type { FileHandle } from 'node:fs/promises'
import * as path from 'node:path'

/** The object identity captured at check time and re-read at exec time. */
export interface IdentitySnapshot {
  readonly dev: number
  readonly ino: number
  readonly size: number
  readonly mtimeMs: number
}

/** Exec-time verdict on an already-opened handle (bytes not yet read). */
export type ExecTimeVerdict =
  | { readonly verdict: 'confirmed'; readonly identity: IdentitySnapshot }
  | { readonly verdict: 'escape'; readonly resolvedPath: string }
  | { readonly verdict: 'drift'; readonly snapshot: IdentitySnapshot; readonly actual: IdentitySnapshot }
  | { readonly verdict: 'undeterminable'; readonly detail: string }

/** Is `candidate` at-or-below `anchor` (both real, canonical paths)? */
export function isBeneath(anchor: string, candidate: string): boolean {
  const rel = path.relative(anchor, candidate)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function snapshotOf(stats: { dev: number; ino: number; size: number; mtimeMs: number }): IdentitySnapshot {
  return { dev: Number(stats.dev), ino: Number(stats.ino), size: stats.size, mtimeMs: stats.mtimeMs }
}

/**
 * Re-read the ACTUAL opened object. Order matters: escape first (active
 * knowledge of a foreign object → denied), drift second (identity cannot be
 * established → undetermined).
 */
export async function verifyOpenedHandle(
  handle: FileHandle,
  anchorReal: string,
  snapshot: IdentitySnapshot | null,
): Promise<ExecTimeVerdict> {
  let resolved: string
  try {
    resolved = readlinkSync(`/proc/self/fd/${handle.fd}`)
  } catch {
    return { verdict: 'undeterminable', detail: 'no /proc view for the opened fd' }
  }
  let canonical: string
  try {
    canonical = realpathSync(resolved)
  } catch {
    canonical = resolved
  }
  if (!isBeneath(anchorReal, canonical)) {
    return { verdict: 'escape', resolvedPath: canonical }
  }
  const stats = await handle.stat({ bigint: false })
  const actual = snapshotOf(stats)
  if (snapshot !== null && (actual.dev !== snapshot.dev || actual.ino !== snapshot.ino)) {
    return { verdict: 'drift', snapshot, actual }
  }
  return { verdict: 'confirmed', identity: actual }
}

/**
 * The exec-time policy re-read seam. INTEGRATION (C-ADM freeze): swap the
 * default for the PR2 `OperationAdmission` recheck bound to the PR1
 * canonical `parametersFingerprint` of THIS call.
 */
export interface AdmissionRecheck {
  /** Re-ask admission for the exact call about to effect. */
  readonly recheck: (intent: {
    readonly op: string
    readonly canonicalLocator: string
    readonly parametersFingerprint: string | null
  }) => Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string }>
}

/** Pre-freeze default: no external recheck (recorded deviation, README §2). */
export const NO_RECHECK: AdmissionRecheck = Object.freeze({
  recheck: async () => ({ ok: true as const }),
})

/**
 * The kernel-safe-open port (plan §6 candidate: `openat2` +
 * `RESOLVE_BENEATH`/`RESOLVE_IN_ROOT` + `RESOLVE_NO_MAGICLINKS` on a trusted
 * directory FD). No native helper is wired in this lane; the fallback
 * (segment lstat walk + O_NOFOLLOW + exec-time re-read) carries the
 * documented residual window and its `undetermined` honesty instead of a
 * false "proven" claim.
 */
export interface OpenAtPort {
  readonly openBeneath: (anchorDirFd: number, relPath: string, flags: number) => Promise<number>
}
