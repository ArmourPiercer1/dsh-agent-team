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
 *         silently "close enough";
 *       - a regular file must carry exactly ONE link (`nlink === 1`): a
 *         hardlink's in-root name passes both checks above while its inode
 *         is also named outside the anchor (`hardlinkAliasVerdict`).
 *         Write-class paths re-ask THIS law on the SAME fd immediately
 *         before their first byte-changing step (`recheckSingleLink`,
 *         residual R-409-1 from PR #409's merge ruling) — the open-time
 *         observation alone leaves a verify→truncate TOCTOU window.
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
  | { readonly verdict: 'hardlink-alias'; readonly nlink: number; readonly detail: string }
  | { readonly verdict: 'undeterminable'; readonly detail: string }

/**
 * The link-count law, stated ONCE here so no caller re-derives it.
 *
 * `/proc/self/fd/<n>` answers with the PATH the descriptor was opened
 * through, and `fstat` identity answers with (dev, ino). A HARDLINK defeats
 * both: the second name can sit inside the governed root while the first
 * name is an outside file, the /proc view then reports the IN-ROOT spelling
 * and the snapshot of the in-root name is the very same inode. Containment
 * plus identity therefore cannot distinguish "this inode lives here" from
 * "this inode is also named here".
 *
 * What a name CAN prove is that it is the object's only name: a regular file
 * with `nlink === 1` has no second name anywhere, so its bytes have no
 * outside spelling to be disclosed through. `nlink > 1` is refused — not
 * because multi-link files are illegitimate (package managers' content-
 * addressed stores and `git` worktree/`cp -l` layouts do hardlink), but
 * because an alias cannot be PROVEN to stay inside the root, and a
 * governance boundary that cannot prove containment must fail closed.
 * Directories are exempt by construction: their `nlink` counts subdirectory
 * entries, never file aliases, and the lane never reads directory bytes.
 *
 * Post-merge #405 review HIGH (finding F-405-R2-1): this refusal existed
 * only on the create path before; it now lives in the shared exec-time law,
 * so every read, image, skill, present, search, write and edit caller of
 * `verifyOpenedHandle` inherits it with no per-family rule of its own.
 */
export function hardlinkAliasVerdict(nlink: number): { readonly verdict: 'hardlink-alias'; readonly nlink: number; readonly detail: string } {
  // ≤ 200 chars on purpose: every family caller slices `detail` to 200, and
  // the WHY plus the remedy must survive that slice verbatim.
  return {
    verdict: 'hardlink-alias',
    nlink,
    detail: `hardlink-alias: the file has ${String(nlink)} hard links, so a name outside the governed root may share it; containment is unprovable, refused before any byte. Use a single-link copy.`,
  }
}

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
 * established → undetermined), link count third (a regular file with a
 * second name cannot be proven to live only here → `hardlink-alias`, see
 * `hardlinkAliasVerdict`). All three answer BEFORE any byte is read.
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
  if (stats.isFile() && stats.nlink !== 1) {
    return hardlinkAliasVerdict(stats.nlink)
  }
  return { verdict: 'confirmed', identity: actual }
}

/**
 * The outcome of the pre-first-byte-change link-count re-check: `confirmed`
 * (single-link regular file, or the by-construction directory exemption),
 * `hardlink-alias` (the SAME verdict shape `verifyOpenedHandle` answers, via
 * the SAME `hardlinkAliasVerdict` wording), or `undeterminable` (fstat could
 * not be answered on the fd — the link count cannot be re-established, so
 * the byte-changing step must not run).
 */
export type SingleLinkRecheck =
  | { readonly verdict: 'confirmed' }
  | { readonly verdict: 'hardlink-alias'; readonly nlink: number; readonly detail: string }
  | { readonly verdict: 'undeterminable'; readonly detail: string }

/**
 * Re-observe the link-count law on an ALREADY-VERIFIED fd, immediately
 * BEFORE the first byte-changing step (truncate / first write) of a
 * write-class path — the second observation of `nlink === 1` on the SAME fd
 * (residual R-409-1, LOW, recorded on PR #409's merge ruling).
 *
 * `verifyOpenedHandle` proves the law once at open time; between that
 * observation and the truncate/write an attacker can still plant a second
 * name for the verified inode (u7-r4091 RED: the late alias mutated through
 * untouched). One cheap `fstat` on the same fd, answered at the point of no
 * return, shrinks the TOCTOU window to a single syscall — the same law,
 * stated ONCE here and reused by every write-class caller (no per-family
 * copies, exactly like `hardlinkAliasVerdict` above). It never re-states the
 * containment or identity laws: those were the open-time check's job; this
 * is the link count, re-asked where the bytes actually change.
 */
export async function recheckSingleLink(handle: FileHandle): Promise<SingleLinkRecheck> {
  let stats
  try {
    stats = await handle.stat({ bigint: false })
  } catch {
    return { verdict: 'undeterminable', detail: 'fstat on the verified fd failed — the link count cannot be re-established before the first byte change' }
  }
  // The directory exemption of `hardlinkAliasVerdict` applies verbatim: a
  // directory's nlink counts subdirectory entries, never file aliases.
  if (stats.isFile() && stats.nlink !== 1) {
    return hardlinkAliasVerdict(stats.nlink)
  }
  return { verdict: 'confirmed' }
}

/**
 * The exec-time policy re-read seam. INTEGRATION (C-ADM freeze — LANDED in
 * the wiring round): the PR2-admission binding lives in `admission-binding.ts`
 * (`bindAdmissionRecheck` presents the bound PR1 canonical
 * `parametersFingerprint` of THIS call; `createAdmissionGatedControlledFs` is
 * the sanctioned wiring entry). The `NO_RECHECK` default below stays a
 * LANE-INTERNAL pre-freeze deviation only — the wiring face never uses it
 * (unbound there is a typed refusal, pinned by the a5w suite).
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
