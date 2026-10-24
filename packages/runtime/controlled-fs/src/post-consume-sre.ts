/**
 * A5-M2 B-SRE family — THE str_replace_editor execution closure (root
 * FS-EDIT card 2026-10-25: "FOUR branches view/create/replace/insert per
 * the fixed-639 public schema — each branch governed (the create/insert
 * branches interact with your just-landed create law; view/replace are
 * edits - read effect required)").
 *
 * Branch law, each clause carried from the shipped family law it reuses
 * (the reviewed write/create/edit closures; the native bodies at
 * tool-str-replace-editor/src/index.ts @639ed01539):
 *  - construction is pure validation, single flight (P3), zero arguments
 *    at the call (P1); ANCHOR before anything; the frozen-real + relative
 *    MAPPING; the parent path law;
 *  - `view` (effects I + R(exact file)): existence required; a DIRECTORY
 *    answers the native 2-level listing (hidden / node_modules /
 *    __pycache__ filtered, codepoint-sorted, view_range forbidden there);
 *    a FILE answers the native numbered view (`formatFileView`: prompt
 *    line, 6-wide line numbers, view_range validation messages, truncation
 *    at maxOutputChars default 16000 with the surrogate-safe cut and the
 *    host TRUNCATED_MESSAGE suffix). Read through ONE bound O_RDONLY|
 *    O_NOFOLLOW fd verified inside the anchor — the governed read leg, no
 *    weak read face; ZERO mutation is structural here;
 *  - `create` (I + F(create exact file)): DELEGATES to the shipped
 *    post-consume-create law verbatim (final-parent fd-bound O_EXCL
 *    create, EEXIST loses with zero bytes, NO directory creation);
 *    a present target answers the native "File already exists" law;
 *  - `str_replace` (I + R + F): the shipped post-consume-edit law carried
 *    item for item on this branch — the native unique law (0 refuses
 *    "did not appear verbatim", >1 refuses with the line list) and the
 *    first-occurrence replacement; `new_str: null` is the native typed
 *    refusal (enforced at construction);
 *  - `insert` (I + R + F): the native line law (insert_line an INTEGER in
 *    [0, lineCount] — the exact bounds message; lines spliced at the
 *    index), the same bound-fd verify-before-truncate + write-loop law;
 *  - cancellation: before the branch runs (zero, never a mutation),
 *    before the truncate (zero), and per write chunk (post-truncate =
 *    write-side-effect-unconfirmed + sideEffectPossible true). The view
 *    branch mutates nothing by construction.
 *
 * The receipt carries {canonicalLocator, rendered} plus the branch's
 * truth fields; the before/after echo rides ONLY on branches whose
 * approval carried the paired READ effect (view/str_replace/insert —
 * M-02's pre-booked "edit/replace 另需 read effect" line).
 *
 * @module packages/runtime/controlled-fs/src/post-consume-sre
 */

import { constants as fsConstants, lstatSync, readdirSync, realpathSync } from 'node:fs'
import { open as fsOpen, type FileHandle } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

import { cfsDenial, cfsUndetermined } from './cf-errors.js'
import { isBeneath, verifyOpenedHandle } from './open-at-exec.js'
import { createPostConsumeCreateClosure } from './post-consume-create.js'

export type SreCommand = 'view' | 'create' | 'str_replace' | 'insert'

export interface PostConsumeSrePlan {
  readonly approvedRootLexical: string
  readonly approvedRootReal: string
  readonly approvedLocator: string
  readonly command: SreCommand
  readonly fileText: string | null
  readonly oldStr: string | null
  readonly newStr: string | null
  readonly insertLine: number | null
  readonly viewRange: readonly number[] | null
  readonly planFingerprint: string
}

export interface PostConsumeSreCallContext {
  readonly parametersFingerprint?: string
  readonly signal?: { readonly aborted?: boolean }
}

export interface PostConsumeSreConfig {
  readonly instanceRootDir: string
  readonly maxOutputChars?: number
}

export interface FsSreReceipt {
  readonly canonicalLocator: string
  readonly rendered: string
  readonly before?: string
  readonly after?: string
  readonly writtenFingerprint?: string
  readonly createdNew?: true
  readonly directory?: true
}

export interface PostConsumeSreClosure {
  readonly claimed: () => boolean
  readonly write: () => Promise<
    | { readonly ok: true; readonly value: FsSreReceipt }
    | { readonly ok: false; readonly error: { readonly code: string; readonly message: string; readonly details?: Record<string, unknown> } }
  >
}

const TRUNCATED_MESSAGE = '<response clipped><NOTE>To save on context only part of this file has been shown to you. You should retry this tool after you have searched inside the file with `grep -n` in order to find the line numbers of the file and read only what you need.</NOTE>'

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isAborted(signal: { readonly aborted?: boolean } | undefined): boolean {
  return signal?.aborted === true
}

/** The host's surrogate-safe cut (@deepseek-ai/dsh-output-retention law,
 *  reproduced: never split a surrogate pair at the boundary). */
function truncateWithoutSplittingSurrogatePair(content: string, max: number): string {
  const head = content.slice(0, max)
  const code = head.length > 0 ? head.charCodeAt(head.length - 1) : 0
  if (code >= 0xd800 && code <= 0xdbff) return head.slice(0, -1)
  return head
}

function maybeTruncate(content: string, maxOutputChars: number): string {
  return content.length <= maxOutputChars
    ? content
    : truncateWithoutSplittingSurrogatePair(content, maxOutputChars) + TRUNCATED_MESSAGE
}

function codepointCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/** The native formatFileView law (index.ts:140-185): prompt line, the
 *  view_range validation words, 6-wide numbers, truncation. */
function formatFileView(displayPath: string, content: string, maxOutputChars: number, viewRange: readonly number[] | null): string | { refuse: string } {
  const allLines = content.split('\n')
  let lines = allLines
  let initialLine = 1
  let finalLine: number | undefined
  let prompt = `Here's the content of ${displayPath} with line numbers (which has a total of ${String(allLines.length)} lines)`
  if (viewRange !== null) {
    const [requestedInitial, requestedFinal] = viewRange
    if (
      viewRange.length !== 2
      || requestedInitial === undefined
      || requestedFinal === undefined
      || !viewRange.every(Number.isInteger)
    ) {
      return { refuse: 'Invalid `view_range`. It should be a list of two integers.' }
    }
    initialLine = requestedInitial
    finalLine = requestedFinal
    if (initialLine < 1 || initialLine > allLines.length) {
      return { refuse: `Invalid \`view_range\`: [${viewRange.join(', ')}]. Its first element \`${String(initialLine)}\` should be within the range of lines of the file: [1, ${String(allLines.length)}]` }
    }
    if (finalLine > allLines.length) {
      return { refuse: `Invalid \`view_range\`: [${viewRange.join(', ')}]. Its second element \`${String(finalLine)}\` should be smaller than the number of lines in the file: \`${String(allLines.length)}\`` }
    }
    if (finalLine !== -1 && finalLine < initialLine) {
      return { refuse: `Invalid \`view_range\`: [${viewRange.join(', ')}]. Its second element \`${String(finalLine)}\` should be larger or equal than its first \`${String(initialLine)}\`` }
    }
    lines = finalLine === -1
      ? allLines.slice(initialLine - 1)
      : allLines.slice(initialLine - 1, finalLine)
    prompt += ` with view_range=[${String(initialLine)}, ${String(finalLine)}]`
  }
  const numbered = lines
    .map((line, index) => `${String(initialLine + index).padStart(6, ' ')}  ${line}`)
    .join('\n')
  return maybeTruncate(`${prompt}:\n${numbered}\n`, maxOutputChars)
}

/** The native listDirectory law (index.ts:188-217): 2 levels, hidden /
 *  node_modules / __pycache__ filtered, `t\tpath` rows, codepoint sort. */
function listDirectory(displayRoot: string, maxOutputChars: number): string {
  function visit(dir: string, depth: number): string[] {
    const rows: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true }).filter((e) =>
      !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '__pycache__')) {
      const entryPath = path.join(dir, entry.name)
      const type = entry.isDirectory() ? 'd' : entry.isFile() ? 'f' : '?'
      rows.push(`${type}\t${entryPath}`)
      if (entry.isDirectory() && depth < 2) rows.push(...visit(entryPath, depth + 1))
    }
    return rows
  }
  const rows = [`d\t${displayRoot}`, ...visit(displayRoot, 1)]
  rows.sort((left, right) => codepointCompare(left.slice(left.indexOf('\t') + 1), right.slice(right.indexOf('\t') + 1)))
  const listing = maybeTruncate(`${rows.join('\n')}\n`, maxOutputChars)
  return `Here're the files and directories up to 2 levels deep in ${displayRoot}, excluding hidden items, node_modules, and Python cache directories:\n${listing}\n`
}

function sha256Fingerprint(text: string): string {
  // the family's spelling: `sha256:<hex>` (the write/edit closures' shape)
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`
}

export function createPostConsumeSreClosure(
  plan: PostConsumeSrePlan,
  ctx?: PostConsumeSreCallContext,
  cfg?: PostConsumeSreConfig,
): PostConsumeSreClosure {
  if (plan === null || typeof plan !== 'object') {
    throw new TypeError('post-consume-sre: the plan must be the frozen typed plan object')
  }
  if (!isNonEmptyString(plan.approvedRootLexical) || !path.isAbsolute(plan.approvedRootLexical)) {
    throw new TypeError('post-consume-sre: approvedRootLexical must be a non-empty absolute path')
  }
  if (!isNonEmptyString(plan.approvedRootReal) || !path.isAbsolute(plan.approvedRootReal)) {
    throw new TypeError('post-consume-sre: approvedRootReal must be a non-empty absolute path')
  }
  if (!isNonEmptyString(plan.approvedLocator) || !path.isAbsolute(plan.approvedLocator)) {
    throw new TypeError('post-consume-sre: approvedLocator must be a non-empty absolute path')
  }
  if (!['view', 'create', 'str_replace', 'insert'].includes(plan.command)) {
    throw new TypeError('post-consume-sre: command must be one of view/create/str_replace/insert (the closed four)')
  }
  if (plan.command === 'create' && typeof plan.fileText !== 'string') {
    throw new TypeError('post-consume-sre: create requires fileText as a string (the empty string is legal)')
  }
  if (plan.command === 'str_replace') {
    if (typeof plan.oldStr !== 'string' || plan.oldStr.length === 0) throw new TypeError('post-consume-sre: str_replace requires a non-empty oldStr')
    if (plan.newStr === null) throw new TypeError('post-consume-sre: str_replace refuses newStr null (the native typed refusal — omitted is legal, null is not)')
  }
  if (plan.command === 'insert') {
    if (typeof plan.newStr !== 'string') throw new TypeError('post-consume-sre: insert requires newStr as a string (the empty string is legal)')
    if (typeof plan.insertLine !== 'number') throw new TypeError('post-consume-sre: insert requires insertLine')
  }
  if (!isNonEmptyString(plan.planFingerprint)) {
    throw new TypeError('post-consume-sre: planFingerprint must be a non-empty string')
  }
  const relTarget = path.relative(plan.approvedRootLexical, plan.approvedLocator)
  if (relTarget.length === 0 || relTarget === '..' || relTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relTarget)) {
    throw new TypeError('post-consume-sre: approvedLocator is not strictly beneath approvedRootLexical (pure-lexical law)')
  }
  const instanceRootDir = cfg?.instanceRootDir
  if (!isNonEmptyString(instanceRootDir)) {
    throw new TypeError('post-consume-sre: instanceRootDir must be a non-empty string')
  }
  const absPath = path.join(plan.approvedRootReal, relTarget)
  if (!isBeneath(plan.approvedRootReal, absPath) || absPath === plan.approvedRootReal) {
    throw new TypeError('post-consume-sre: the approved locator does not resolve beneath the approved root real identity')
  }
  const maxOutputChars = typeof cfg?.maxOutputChars === 'number' && Number.isInteger(cfg.maxOutputChars) && cfg.maxOutputChars > 0
    ? cfg.maxOutputChars
    : 16_000
  const frozenPlan: PostConsumeSrePlan = Object.freeze({ ...plan })
  const signal = ctx?.signal
  let state: 'open' | 'claimed' | 'settled' = 'open'
  const closure: PostConsumeSreClosure = Object.freeze({
    claimed: () => state !== 'open',
    async write() {
      if (state !== 'open') {
        return cfsDenial(
          'grant-consumed',
          `post-consume str_replace_editor refused: this closure was already claimed (state ${state}) — the consumed call gets ONE execution attempt (P3)`,
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
          'post-consume str_replace_editor refused: the call was cancelled before anything ran — a cancelled call produces no effect (zero FS)',
        ))
      }
      let currentRootReal: string
      try {
        currentRootReal = realpathSync(instanceRootDir)
      } catch (err) {
        return settle(cfsDenial(
          'path-rejected',
          `post-consume str_replace_editor refused: the instance root could not be resolved (${String((err as NodeJS.ErrnoException).code)})`,
        ))
      }
      if (currentRootReal !== frozenPlan.approvedRootReal) {
        return settle(cfsDenial(
          'outside-anchor',
          `post-consume str_replace_editor refused: the instance root stands at '${currentRootReal}', not at the approved root real identity '${frozenPlan.approvedRootReal}' (ANCHOR law, before any open)`,
        ))
      }
      // Parent law (the family's law, mapped spelling) — for `create` the
      // delegated create closure re-derives it independently; for the other
      // three branches the parent must exist and stand at the mapped real
      // spelling before anything opens.
      const parentDirLex = path.dirname(absPath)
      if (frozenPlan.command !== 'create') {
        try {
          const parentStats = lstatSync(parentDirLex)
          if (parentStats.isSymbolicLink()) {
            return settle(cfsDenial('symlink-alias', `post-consume str_replace_editor refused: the parent directory '${parentDirLex}' is a symlink alias`))
          }
          if (!parentStats.isDirectory()) {
            return settle(cfsDenial('not-a-directory', `post-consume str_replace_editor refused: the parent '${parentDirLex}' is not a directory`))
          }
          const parentReal = realpathSync(parentDirLex)
          if (parentReal !== parentDirLex || !isBeneath(frozenPlan.approvedRootReal, parentReal)) {
            return settle(cfsDenial('outside-anchor', `post-consume str_replace_editor refused: the parent resolves to '${parentReal}', not the mapped real spelling beneath the approved root (anchor drift)`))
          }
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code
          if (code === 'ENOENT') {
            return settle(cfsDenial('not-a-directory', `post-consume str_replace_editor refused: the parent directory '${parentDirLex}' does not exist`))
          }
          return settle(cfsDenial('path-rejected', `post-consume str_replace_editor refused: the parent could not be examined (${String(code)})`))
        }
      }

      // ── CREATE: delegate to the shipped create law, verbatim ─────────
      if (frozenPlan.command === 'create') {
        const created = createPostConsumeCreateClosure(
          {
            approvedRootLexical: frozenPlan.approvedRootLexical,
            approvedRootReal: frozenPlan.approvedRootReal,
            approvedLocator: frozenPlan.approvedLocator,
            content: frozenPlan.fileText as string,
            planFingerprint: frozenPlan.planFingerprint,
          },
          {
            // THE consumed fingerprint rides the arm path (the pairing law
            // lives there); a direct author-side call without a ctx pairs
            // against the plan's OWN fingerprint — the delegated closure's
            // one-plan-one-spend check then holds plan-invariantly.
            parametersFingerprint: ctx?.parametersFingerprint ?? frozenPlan.planFingerprint,
            signal,
          },
          { instanceRootDir },
        )
        const r = await created.write()
        if (r.ok !== true) {
          // The create law's refusal is the truth (EEXIST races lose with
          // zero bytes — the native "File already exists … Cannot
          // overwrite" law answered by O_EXCL); passed through verbatim.
          return settle(r)
        }
        return settle({
          ok: true as const,
          value: Object.freeze<FsSreReceipt>({
            canonicalLocator: frozenPlan.approvedLocator,
            rendered: `New file created successfully at: ${frozenPlan.approvedLocator}`,
            writtenFingerprint: r.value.writtenFingerprint,
            createdNew: true,
          }),
        })
      }

      // ── VIEW / STR_REPLACE / INSERT share one bound-fd read law ──────
      let handle: FileHandle | undefined
      let isDirView = false
      if (frozenPlan.command === 'view') {
        let st
        try {
          st = lstatSync(absPath)
        } catch {
          return settle(cfsDenial('not-a-file', `post-consume str_replace_editor refused: the path ${absPath} does not exist — please provide a valid path`))
        }
        if (st.isSymbolicLink()) {
          return settle(cfsDenial('symlink-alias', 'post-consume str_replace_editor refused: the target name is a symlink alias'))
        }
        isDirView = st.isDirectory()
        if (!isDirView && !st.isFile()) {
          return settle(cfsDenial('not-a-file', `post-consume str_replace_editor refused: cannot view "${absPath}": not a regular file or directory`))
        }
        if (isDirView && frozenPlan.viewRange !== null) {
          return settle(cfsDenial('path-rejected', 'The `view_range` parameter is not allowed when `path` points to a directory.'))
        }
      }
      if (!isDirView) {
        try {
          handle = await fsOpen(absPath, (frozenPlan.command === 'view' ? fsConstants.O_RDONLY : fsConstants.O_RDWR) | fsConstants.O_NOFOLLOW)
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code
          if (code === 'ENOENT') {
            return settle(cfsDenial('not-a-file', frozenPlan.command === 'view'
              ? `post-consume str_replace_editor refused: the path ${absPath} does not exist — please provide a valid path`
              : 'post-consume str_replace_editor refused: the target does not exist — str_replace/insert never create; zero creation'))
          }
          if (code === 'ELOOP') {
            return settle(cfsDenial('symlink-alias', 'post-consume str_replace_editor refused: the target name is a symlink alias (O_NOFOLLOW)'))
          }
          if (code === 'EISDIR') {
            return settle(cfsDenial('not-a-file', 'post-consume str_replace_editor refused: the target is a directory'))
          }
          return settle(cfsDenial('path-rejected', `post-consume str_replace_editor refused: the open failed (${String(code)})`))
        }
      }
      const openedHandle: FileHandle | undefined = handle
      try {
        if (openedHandle !== undefined) {
          const verdict = await verifyOpenedHandle(openedHandle, frozenPlan.approvedRootReal, null)
          if (verdict.verdict === 'escape') {
            return settle(cfsDenial('exec-time-escape', `post-consume str_replace_editor refused: the open landed OUTSIDE the approved root anchor (${verdict.resolvedPath})`))
          }
          if (verdict.verdict !== 'confirmed') {
            return settle(cfsUndetermined('exec-time-identity-drift', `post-consume str_replace_editor refused: exec-time re-read BEFORE any change — ${verdict.verdict}; nothing was written`, { sideEffectPossible: false }))
          }
          const st = await openedHandle.stat({ bigint: false })
          if (!st.isFile()) {
            return settle(cfsDenial('not-a-file', 'post-consume str_replace_editor refused: the target is not a regular file'))
          }
        }
        if (isDirView) {
          // the directory branch of `view`: the 2-level listing law, pure
          // read, zero mutation (I + R(exact dir) only).
          return settle({
            ok: true as const,
            value: Object.freeze<FsSreReceipt>({
              canonicalLocator: frozenPlan.approvedLocator,
              rendered: listDirectory(absPath, maxOutputChars),
              directory: true,
            }),
          })
        }
        const readHandle = openedHandle as FileHandle
        let before: string
        try {
          const chunks: Buffer[] = []
          const buffer = Buffer.alloc(65536)
          let position = 0
          for (;;) {
            const { bytesRead } = await readHandle.read(buffer, 0, buffer.length, position)
            if (bytesRead === 0) break
            chunks.push(Buffer.from(buffer.subarray(0, bytesRead)))
            position += bytesRead
          }
          before = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
        } catch (err) {
          return settle(cfsDenial('path-rejected', `post-consume str_replace_editor refused: the target is not strict UTF-8 text or the read failed (${String((err as Error).message ?? err).slice(0, 120)})`))
        }

        if (frozenPlan.command === 'view') {
          const view = formatFileView(absPath, before, maxOutputChars, frozenPlan.viewRange)
          if (typeof view !== 'string') {
            return settle(cfsDenial('path-rejected', `post-consume str_replace_editor refused: ${view.refuse}`))
          }
          return settle({
            ok: true as const,
            value: Object.freeze<FsSreReceipt>({ canonicalLocator: frozenPlan.approvedLocator, rendered: view, before }),
          })
        }

        let after: string
        if (frozenPlan.command === 'str_replace') {
          const offsets: number[] = []
          const needle = frozenPlan.oldStr as string
          let from = 0
          for (;;) {
            const at = before.indexOf(needle, from)
            if (at === -1) break
            offsets.push(at)
            from = at + needle.length
          }
          if (offsets.length === 0) {
            return settle(cfsDenial('path-rejected', `post-consume str_replace_editor refused: No replacement was performed, old_str \`${needle}\` did not appear verbatim in ${absPath}`))
          }
          if (offsets.length > 1) {
            const lineList = offsets.map((offset) => {
              let line = 1
              for (let i = 0; i < offset; i += 1) if (before[i] === '\n') line += 1
              return line
            })
            return settle(cfsDenial('path-rejected', `post-consume str_replace_editor refused: Multiple occurrences of old_str \`${needle}\` in lines [${lineList.join(', ')}]. Please ensure it is unique`))
          }
          const at = offsets[0] as number
          after = before.slice(0, at) + (frozenPlan.newStr as string) + before.slice(at + needle.length)
        } else {
          const lines = before.split('\n')
          const insertLine = frozenPlan.insertLine as number
          if (!Number.isInteger(insertLine) || insertLine < 0 || insertLine > lines.length) {
            return settle(cfsDenial('path-rejected', `post-consume str_replace_editor refused: Invalid \`insert_line\` parameter: ${String(insertLine)}. It should be within the range of lines of the file: [0, ${String(lines.length)}]`))
          }
          after = [...lines.slice(0, insertLine), ...(frozenPlan.newStr as string).split('\n'), ...lines.slice(insertLine)].join('\n')
        }

        if (isAborted(signal)) {
          return settle(cfsDenial(
            'effect-outside-grant',
            'post-consume str_replace_editor refused: the call was cancelled after the read but before the truncate — nothing was written',
          ))
        }
        try {
          await readHandle.truncate(0)
        } catch (err) {
          return settle(cfsUndetermined('write-side-effect-unconfirmed', `truncation may have partially landed (${String((err as NodeJS.ErrnoException).code)})`, { sideEffectPossible: true }))
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
            const { bytesWritten } = await readHandle.write(payload, offset, payload.length - offset)
            if (typeof bytesWritten !== 'number' || bytesWritten <= 0) {
              throw Object.assign(new Error('the write made no progress'), { code: 'EIO' })
            }
            offset += bytesWritten
          }
        } catch (err) {
          return settle(cfsUndetermined('write-side-effect-unconfirmed', `write may have partially landed (${String((err as NodeJS.ErrnoException).code)})`, { sideEffectPossible: true }))
        }
        return settle({
          ok: true as const,
          value: Object.freeze<FsSreReceipt>({
            canonicalLocator: frozenPlan.approvedLocator,
            rendered: `The file ${absPath} has been edited successfully.`,
            before,
            after,
            writtenFingerprint: sha256Fingerprint(after),
          }),
        })
      } finally {
        await openedHandle?.close().catch(() => undefined)
      }
    },
  })
  return closure
}
