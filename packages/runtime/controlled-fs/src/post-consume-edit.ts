/**
 * A5-M2 B-EDIT family — THE edit execution closure (root FS-EDIT card
 * 2026-10-25: the M-02 pre-booked law "`edit`/`replace` 另需 read effect"
 * is the approval this closure answers; the arm ships the read effect).
 *
 * THE EDIT LAW (the reviewed write family's law class, item for item):
 *  - construction is pure validation (typed plan frozen at classify; a
 *    violation is a TypeError, zero FS); single flight (P3): in-flight AND
 *    settled repeats are refused with zero FS; the closure is called with
 *    NO arguments (P1 — nothing post-approval crosses into it);
 *  - ANCHOR before anything: the instance root must still resolve at the
 *    FROZEN approved real identity; the working spelling is the reviewed
 *    MAPPING (rel = relative(rootLexical, locator) onto the frozen real
 *    root, post-consume-write.ts:213-221 — a stable trusted root symlink
 *    answers normally; child-path symlinks stay STRICT);
 *  - the parent rides the reviewed path law (lstat symlink refuses
 *    `symlink-alias`, absent answers `not-a-directory`);
 *  - THE EDIT NEVER CREATES: an absent target refuses `not-a-file` with
 *    zero creation (the native `edit` has no create face — the create
 *    spelling belongs to `write`/`str_replace_editor.create`, and the
 *    existence-honest law-facts say so in the approval);
 *  - BEFORE any byte-changing step the target is opened `O_RDWR |
 *    O_NOFOLLOW` and verified INSIDE the anchor (`verifyOpenedHandle`,
 *    snapshot null — the opened fd is its own identity; drift/undeterminable
 *    refuses with sideEffectPossible FALSE because nothing has changed),
 *    must be a regular file, and is READ THROUGH THAT FD with strict UTF-8
 *    (the READ half of the approved `I + R(read exact file) + F(write exact
 *    file)` set — no new effect kind, matrix M-02 wording);
 *  - the replacement is the native literal law: `old_string` must appear
 *    (0 occurrences refuses "did not appear verbatim"), and unless
 *    `replace_all` it must appear EXACTLY ONCE (multiple occurrences
 *    refuse with the 1-based line numbers — the native FS_AMBIGUOUS_EDIT
 *    face); `replace_all` replaces every occurrence;
 *  - cancellation is checked BEFORE the open (zero), AFTER the read and
 *    BEFORE the truncate (zero — nothing has changed yet), and BEFORE every
 *    write chunk; after the truncate any failure or stall is
 *    `write-side-effect-unconfirmed` with sideEffectPossible true (the r16
 *    loop law verbatim) — never a success report, never "zero side effect";
 *  - the receipt {canonicalLocator, before, after}: the before/after echo
 *    rides ONLY here — under the paired READ effect on this exact locator
 *    (M-02 pre-booked law, verbatim: "`edit`/`replace` 另需 read effect";
 *    D-C2-1's no-echo rule governs WRITE receipts and the host before/after
 *    face was ruled lawful ONLY as the paired-read increment). A write-only
 *    grant never carries these bytes.
 *
 * @module packages/runtime/controlled-fs/src/post-consume-edit
 */

import { constants as fsConstants, lstatSync, realpathSync } from 'node:fs'
import { open as fsOpen, type FileHandle } from 'node:fs/promises'
import path from 'node:path'

import { cfsDenial, cfsUndetermined } from './cf-errors.js'
import { isBeneath, verifyOpenedHandle } from './open-at-exec.js'

/** The frozen edit plan the B-EDIT arm freezes at classify. */
export interface PostConsumeEditPlan {
  readonly approvedRootLexical: string
  readonly approvedRootReal: string
  readonly approvedLocator: string
  readonly oldString: string
  readonly newString: string
  readonly replaceAll: boolean
  readonly planFingerprint: string
}

export interface PostConsumeEditCallContext {
  readonly parametersFingerprint?: string
  readonly signal?: { readonly aborted?: boolean }
}

export interface PostConsumeEditConfig {
  readonly instanceRootDir: string
}

/** The edit receipt: the paired-read-covered echo pair + the canonical
 *  locator (the native `edit` output face {path,before,after}). */
export interface FsEditReceipt {
  readonly canonicalLocator: string
  readonly before: string
  readonly after: string
}

export interface PostConsumeEditClosure {
  readonly claimed: () => boolean
  readonly write: () => Promise<
    | { readonly ok: true; readonly value: FsEditReceipt }
    | { readonly ok: false; readonly error: { readonly code: string; readonly message: string; readonly details?: Record<string, unknown> } }
  >
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isAborted(signal: { readonly aborted?: boolean } | undefined): boolean {
  return signal?.aborted === true
}

/** Native matchOffsets law (tool-str-replace-editor/src/index.ts matchOffsets):
 *  literal scan, every start offset, overlapping allowed past each match end. */
function matchOffsets(haystack: string, needle: string): number[] {
  const offsets: number[] = []
  if (needle.length === 0) return offsets
  let from = 0
  for (;;) {
    const at = haystack.indexOf(needle, from)
    if (at === -1) return offsets
    offsets.push(at)
    from = at + needle.length
  }
}

/** Native lineNumbersAt law: 1-based line of each offset. */
function lineNumbersAt(text: string, offsets: readonly number[]): number[] {
  return offsets.map((offset) => {
    let line = 1
    for (let i = 0; i < offset; i += 1) if (text[i] === '\n') line += 1
    return line
  })
}

/**
 * Build the ONE-SHOT edit closure for one frozen, already-approved plan.
 * Same law class as the reviewed write/create closures: the closure is the
 * private executor minted from frozen facts; zero arguments at the call.
 */
export function createPostConsumeEditClosure(
  plan: PostConsumeEditPlan,
  ctx?: PostConsumeEditCallContext,
  cfg?: PostConsumeEditConfig,
): PostConsumeEditClosure {
  if (plan === null || typeof plan !== 'object') {
    throw new TypeError('post-consume-edit: the plan must be the frozen typed plan object')
  }
  if (!isNonEmptyString(plan.approvedRootLexical) || !path.isAbsolute(plan.approvedRootLexical)) {
    throw new TypeError('post-consume-edit: approvedRootLexical must be a non-empty absolute path')
  }
  if (!isNonEmptyString(plan.approvedRootReal) || !path.isAbsolute(plan.approvedRootReal)) {
    throw new TypeError('post-consume-edit: approvedRootReal must be a non-empty absolute path')
  }
  if (!isNonEmptyString(plan.approvedLocator) || !path.isAbsolute(plan.approvedLocator)) {
    throw new TypeError('post-consume-edit: approvedLocator must be a non-empty absolute path')
  }
  if (typeof plan.oldString !== 'string' || plan.oldString.length === 0) {
    throw new TypeError('post-consume-edit: oldString must be a non-empty string (the native parse law)')
  }
  if (typeof plan.newString !== 'string') {
    throw new TypeError('post-consume-edit: newString must be a string (the empty string deletes the match)')
  }
  if (plan.oldString === plan.newString) {
    throw new TypeError('post-consume-edit: oldString and newString must differ (a guaranteed no-op edit never earns an approval)')
  }
  if (typeof plan.replaceAll !== 'boolean') {
    throw new TypeError('post-consume-edit: replaceAll must be a boolean (defaulting is the arm\'s explicit classify step, never hidden here)')
  }
  if (!isNonEmptyString(plan.planFingerprint)) {
    throw new TypeError('post-consume-edit: planFingerprint must be a non-empty string')
  }
  const relTarget = path.relative(plan.approvedRootLexical, plan.approvedLocator)
  if (relTarget.length === 0 || relTarget === '..' || relTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relTarget)) {
    throw new TypeError('post-consume-edit: approvedLocator is not strictly beneath approvedRootLexical (pure-lexical law)')
  }
  const instanceRootDir = cfg?.instanceRootDir
  if (!isNonEmptyString(instanceRootDir)) {
    throw new TypeError('post-consume-edit: instanceRootDir must be a non-empty string')
  }
  // The reviewed MAPPING law (post-consume-write.ts:213-221 / the create
  // closure's P2 fix): the RELATIVE path rides the FROZEN real root.
  const absPath = path.join(plan.approvedRootReal, relTarget)
  if (!isBeneath(plan.approvedRootReal, absPath) || absPath === plan.approvedRootReal) {
    throw new TypeError('post-consume-edit: the approved locator does not resolve beneath the approved root real identity')
  }
  const frozenPlan: PostConsumeEditPlan = Object.freeze({ ...plan })
  const signal = ctx?.signal
  let state: 'open' | 'claimed' | 'settled' = 'open'
  const closure: PostConsumeEditClosure = Object.freeze({
    claimed: () => state !== 'open',
    async write() {
      if (state !== 'open') {
        return cfsDenial(
          'grant-consumed',
          `post-consume edit refused: this closure was already claimed (state ${state}) — the consumed call gets ONE execution attempt; a repeat is effect-outside-grant with zero FS (P3)`,
        )
      }
      state = 'claimed'
      const settle = <T>(r: T): T => {
        state = 'settled'
        return r
      }

      if (isAborted(signal)) {
        return settle(cfsDenial(
          'effect-outside-grant',
          'post-consume edit refused: the call was cancelled before anything ran — a cancelled call produces no effect (zero FS)',
        ))
      }

      let currentRootReal: string
      try {
        currentRootReal = realpathSync(instanceRootDir)
      } catch (err) {
        return settle(cfsDenial(
          'path-rejected',
          `post-consume edit refused: the instance root could not be resolved (${String((err as NodeJS.ErrnoException).code)}) — the approved agreement cannot be answered`,
        ))
      }
      if (currentRootReal !== frozenPlan.approvedRootReal) {
        return settle(cfsDenial(
          'outside-anchor',
          `post-consume edit refused: the instance root stands at '${currentRootReal}', not at the approved root real identity '${frozenPlan.approvedRootReal}' (ANCHOR law, before any open)`,
        ))
      }

      // Parent law (the reviewed module's law, mapped spelling).
      const parentDirLex = path.dirname(absPath)
      try {
        const parentStats = lstatSync(parentDirLex)
        if (parentStats.isSymbolicLink()) {
          return settle(cfsDenial('symlink-alias', `post-consume edit refused: the parent directory '${parentDirLex}' is a symlink alias; nothing was written`))
        }
        if (!parentStats.isDirectory()) {
          return settle(cfsDenial('not-a-directory', `post-consume edit refused: the parent '${parentDirLex}' is not a directory; nothing was written`))
        }
        const parentReal = realpathSync(parentDirLex)
        if (parentReal !== parentDirLex || !isBeneath(frozenPlan.approvedRootReal, parentReal)) {
          return settle(cfsDenial(
            'outside-anchor',
            `post-consume edit refused: the parent directory resolves to '${parentReal}', not the mapped real spelling beneath the approved root (anchor drift); nothing was written`,
          ))
        }
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code
        if (code === 'ENOENT') {
          return settle(cfsDenial('not-a-directory', `post-consume edit refused: the parent directory '${parentDirLex}' does not exist; the edit NEVER creates; nothing was written`))
        }
        return settle(cfsDenial('path-rejected', `post-consume edit refused: the parent directory could not be examined (${String(code)}); nothing was written`))
      }

      if (isAborted(signal)) {
        return settle(cfsDenial(
          'effect-outside-grant',
          'post-consume edit refused: the call was cancelled before the open — a cancelled call produces no effect; nothing was written',
        ))
      }

      // ── open the EXISTING target (the edit never creates) ────────────
      let handle: FileHandle
      try {
        handle = await fsOpen(absPath, fsConstants.O_RDWR | fsConstants.O_NOFOLLOW)
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code
        if (code === 'ENOENT') {
          return settle(cfsDenial(
            'not-a-file',
            'post-consume edit refused: the target does not exist — the governed edit NEVER creates (the create spelling is write / str_replace_editor.create); zero creation',
          ))
        }
        if (code === 'ELOOP') {
          return settle(cfsDenial('symlink-alias', 'post-consume edit refused: the target name is a symlink alias (O_NOFOLLOW); nothing was written'))
        }
        if (code === 'EISDIR') {
          return settle(cfsDenial('not-a-file', 'post-consume edit refused: the target is a directory'))
        }
        return settle(cfsDenial('path-rejected', `post-consume edit refused: the open failed (${String(code)})`))
      }
      try {
        const verdict = await verifyOpenedHandle(handle, frozenPlan.approvedRootReal, null)
        if (verdict.verdict === 'escape') {
          return settle(cfsDenial(
            'exec-time-escape',
            `post-consume edit refused: the open landed OUTSIDE the approved root anchor (${verdict.resolvedPath}); nothing was written`,
          ))
        }
        if (verdict.verdict === 'hardlink-alias') {
          // BEFORE the read half: neither the outside inode's bytes are read
          // nor is anything written through the alias.
          return settle(cfsDenial(
            'hardlink-alias',
            `post-consume edit refused: ${verdict.detail}; nothing was read or written`,
          ))
        }
        if (verdict.verdict !== 'confirmed') {
          const detail = verdict.verdict === 'drift'
            ? `snapshot ${verdict.snapshot.dev}:${verdict.snapshot.ino} != actual ${verdict.actual.dev}:${verdict.actual.ino}`
            : verdict.detail
          return settle(cfsUndetermined(
            'exec-time-identity-drift',
            `post-consume edit refused: exec-time re-read BEFORE any change — ${detail}; identity undetermined; nothing was written`,
            { sideEffectPossible: false },
          ))
        }
        const opened = await handle.stat({ bigint: false })
        if (!opened.isFile()) {
          return settle(cfsDenial('not-a-file', 'post-consume edit refused: the write target is not a regular file'))
        }

        // ── THE READ half (approved R effect): read through THIS fd ────
        let before: string
        try {
          const chunks: Buffer[] = []
          const buffer = Buffer.alloc(65536)
          let position = 0
          for (;;) {
            const { bytesRead } = await handle.read(buffer, 0, buffer.length, position)
            if (bytesRead === 0) break
            chunks.push(Buffer.from(buffer.subarray(0, bytesRead)))
            position += bytesRead
          }
          before = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
        } catch (err) {
          return settle(cfsDenial(
            'path-rejected',
            `post-consume edit refused: the target is not strict UTF-8 text or the read failed (${String((err as Error).message ?? err).slice(0, 120)}); nothing was written`,
          ))
        }

        // ── the native literal replacement law ─────────────────────────
        const offsets = matchOffsets(before, frozenPlan.oldString)
        if (offsets.length === 0) {
          return settle(cfsDenial(
            'path-rejected',
            `post-consume edit refused: old_string did not appear verbatim in ${frozenPlan.approvedLocator}; nothing was written`,
          ))
        }
        if (offsets.length > 1 && !frozenPlan.replaceAll) {
          return settle(cfsDenial(
            'path-rejected',
            `post-consume edit refused: old_string appears ${String(offsets.length)} times (lines [${lineNumbersAt(before, offsets).join(', ')}]) and replace_all is false — the native unique law refuses; nothing was written`,
          ))
        }
        let after: string
        if (frozenPlan.replaceAll) {
          after = before.split(frozenPlan.oldString).join(frozenPlan.newString)
        } else {
          const at = offsets[0] as number
          after = before.slice(0, at) + frozenPlan.newString + before.slice(at + frozenPlan.oldString.length)
        }

        // Cancellation re-check immediately BEFORE the first byte-changing
        // step: after the truncate, bytes may land.
        if (isAborted(signal)) {
          return settle(cfsDenial(
            'effect-outside-grant',
            'post-consume edit refused: the call was cancelled after the read but before the truncate — nothing was written',
          ))
        }

        try {
          await handle.truncate(0)
        } catch (err) {
          return settle(cfsUndetermined(
            'write-side-effect-unconfirmed',
            `truncation may have partially landed (${String((err as NodeJS.ErrnoException).code)})`,
            { sideEffectPossible: true },
          ))
        }
        try {
          const payload = Buffer.from(after, 'utf8')
          let offset = 0
          while (offset < payload.length) {
            if (isAborted(signal)) {
              return settle(cfsUndetermined(
                'write-side-effect-unconfirmed',
                `the call was cancelled mid-write: ${String(offset)} observed bytes may have landed, subsequent chunks were NOT written`,
                { sideEffectPossible: true },
              ))
            }
            const { bytesWritten } = await handle.write(payload, offset, payload.length - offset)
            if (typeof bytesWritten !== 'number' || bytesWritten <= 0) {
              throw Object.assign(new Error('the write made no progress'), { code: 'EIO' })
            }
            offset += bytesWritten
          }
        } catch (err) {
          return settle(cfsUndetermined(
            'write-side-effect-unconfirmed',
            `write may have partially landed (${String((err as NodeJS.ErrnoException).code)})`,
            { sideEffectPossible: true },
          ))
        }
        return settle({
          ok: true as const,
          // The echo pair rides ONLY under the paired READ effect this
          // approval carries (M-02: "edit/replace 另需 read effect").
          value: Object.freeze<FsEditReceipt>({
            canonicalLocator: frozenPlan.approvedLocator,
            before,
            after,
          }),
        })
      } finally {
        await handle.close().catch(() => undefined)
      }
    },
  })
  return closure
}
