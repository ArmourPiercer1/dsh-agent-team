/**
 * Alpha.5 PD-13 — the confined TERMINAL face.
 *
 * WHY THIS EXISTS. The product debt register's PD-13 is the measured fact that
 * a Member's shell had **no read axis**: its `bash` was the preset's inherited
 * persistent PTY, the governed realm was never on the path, and a `cat` of a
 * file the compiled read lane denies returned the file's bytes with exit 0 and
 * ZERO guard facts. The confined `subprocess` face refuses that read on the
 * read axis (`IO_READ_DENIED`, 0 provider calls, 0 bytes) — the machinery
 * worked; it was simply not on the terminal path.
 *
 * WHAT THIS FACE IS. A `terminals` service, mounted on the SAME isolated Member
 * scope as the confined `fs`/`subprocess` faces, whose sessions execute each
 * command as a CONFINED CHILD of the confined `subprocess` face on that scope
 * (never a PTY: a PTY cannot ride the Landlock execution profile — see
 * `subprocess.ts#spawnTerminal`). Because the service answers the pinned
 * `terminals` shape (`spawn`/`startSend`/`read`/`signal`/`kill`/`list`), a
 * routed native shell module that injects `terminals` resolves THIS face
 * instead of the inherited host service.
 *
 * THE READ AXIS (the point of the face). Before a command runs, its body is
 * lexically attributed: every path-shaped token the command names (an absolute
 * path, or a token that already exists relative to the session cwd) is a
 * DECLARED READ and is consulted against the Member's effective read lane
 * through the SAME guard the `fs` face uses. A denied read therefore:
 *   - produces exactly ONE guard-consult fact (`method: 'shellRead'`,
 *     `decision: 'deny'`, `decidedBy: 'IO_READ_DENIED'`) naming the locator;
 *   - returns ZERO bytes (the command never runs);
 *   - fails with the typed `TeamIoDenied` code `IO_READ_DENIED` on the send's
 *     `done` promise (the caller sees a typed refusal, not an empty success).
 * The admission runs BEFORE the confined `subprocess` face is called, so the
 * provider is called zero times for a denied command.
 *
 * WHAT THIS FACE DOES NOT DO (stated so the fix cannot be read as more):
 *   - it is not an OS-level claim. A command that IS admitted runs under the
 *     confined `subprocess` face's execution profile; the kernel is the
 *     boundary for everything the admission did not name;
 *   - a DYNAMIC read (`$(...)`, backticks, a path assembled from variables) is
 *     not lexically attributable and is NOT refused at admission. That is a
 *     disclosed weakness (see the evidence README) and the reason the OS
 *     profile stays load-bearing;
 *   - the body's WRITE axis is not lexically attributed here: a redirection
 *     target is deliberately not a read intent, so the read axis is the only
 *     axis this face adds;
 *   - there is no persistent shell STATE: every command is a fresh confined
 *     child, so `cd`/`export` do not carry across commands and there is no
 *     interactive stdin. That is the capability cost of a governed terminal on
 *     a host whose PTY cannot be confined (disclosed, not hidden).
 *
 * CORE PATCH BUDGET = 0: this is our package's module, mounted through the
 * existing public seam. No upstream source is touched.
 *
 * @module @dsh-agent-team/runtime/team-services/terminal
 */

import { existsSync } from 'node:fs'
import { basename, isAbsolute, resolve as resolvePath } from 'node:path'
import type { EffectiveIoPolicy } from '../../member-io-policy/src/types.js'
import type { FsGuard } from './fs.js'
import type { ConfinedShellClassAdmission } from './subprocess.js'

/** The guard method this face consults its lane under (the fact's `method`). */
export const TERMINAL_GUARD_METHOD = 'shellRead'

/** The backend types this face answers (the preset's `shell` alias included). */
export const CONFINED_TERMINAL_BACKENDS: readonly string[] = Object.freeze(['confined-shell', 'shell'])

/** The closed refusal vocabulary of THIS face (never a bare `Error`). */
export const CONFINED_TERMINAL_REFUSAL_CODES = [
  /** The caller presented no owner with a usable identity. */
  'TERMINALS_OWNER_UNTRUSTED',
  /** The requested backend type is not one this face serves. */
  'TERMINALS_NO_BACKEND',
  /** The session id is unknown (never opened, or already closed). */
  'TERMINALS_NO_SESSION',
  /** The session belongs to a different owner (the ownership fence). */
  'TERMINALS_FOREIGN_SESSION',
  /** The session is closing/closed; a command after close is a typed refusal. */
  'TERMINALS_SESSION_CLOSED',
  /** A send is already in flight on this session (one at a time, pinned law). */
  'TERMINALS_SEND_ACTIVE',
  /** The session has no absolute working directory to run a command in. */
  'TERMINALS_CWD_UNRESOLVED',
  /** The declared shell program is not admitted by the realm's shell class. */
  'TERMINALS_PROGRAM_NOT_ADMITTED',
  /** The send was cancelled by the caller before it settled. */
  'TERMINALS_COMMAND_CANCELLED',
] as const

export type ConfinedTerminalRefusalCode = (typeof CONFINED_TERMINAL_REFUSAL_CODES)[number]

/** A typed refusal from the confined terminal face. */
export class ConfinedTerminalRefusal extends Error {
  readonly code: ConfinedTerminalRefusalCode
  readonly detail: string

  constructor(code: ConfinedTerminalRefusalCode, detail: string) {
    super(`${code}: ${detail}`)
    this.name = 'ConfinedTerminalRefusal'
    this.code = code
    this.detail = detail
  }
}

/** The status shape the pinned terminal contract reports. */
export type ConfinedTerminalStatus =
  | { readonly kind: 'running' }
  | { readonly kind: 'exited'; readonly exitCode: number | null; readonly signal: string | null }

/** One owner-visible session snapshot (the pinned `list`/`spawn` answer). */
export interface ConfinedTerminalSnapshot {
  readonly sessionId: string
  readonly type: string
  readonly pid?: number
  readonly status: ConfinedTerminalStatus
  readonly motd?: string
}

/** What a caller asks the face to run. */
export interface ConfinedTerminalSendRequest {
  readonly text: string
  readonly signal?: AbortSignal | undefined
}

/** The additive exit information this face reports on a settled send. */
export interface ConfinedTerminalSendOutcome {
  readonly viewport: string
  readonly waitReason: 'inferred_idle'
  readonly sessionStatus: ConfinedTerminalStatus
  readonly truncated: boolean
  /** ADDITIVE (this face): the confined child's exit code (`null` on a signal). */
  readonly exitCode: number | null
  /** ADDITIVE (this face): the terminating signal name, if any. */
  readonly signal: string | null
  /** Whether the caller's `cancel()` terminated the command. */
  readonly cancelled: boolean
  /** ADDITIVE (this face): the confined child's stdout (bounded). */
  readonly stdout: string
  /** ADDITIVE (this face): the confined child's stderr (bounded). */
  readonly stderr: string
}

/** The operation handle `startSend` returns (pinned contract + additive fields). */
export interface ConfinedTerminalOperation {
  readonly done: Promise<ConfinedTerminalSendOutcome>
  readOutput(): { readonly delta: string; readonly truncated: boolean }
  cancel(): boolean
}

/** The `terminals` service surface this face provides (structural). */
export interface ConfinedTerminalSurface {
  listBackends(): readonly string[]
  spawn(owner: unknown, request: { readonly type?: string; readonly cwd?: string; readonly name?: string }, signal?: AbortSignal): Promise<ConfinedTerminalSnapshot>
  startSend(owner: unknown, sessionId: string, request: ConfinedTerminalSendRequest): ConfinedTerminalOperation
  read(owner: unknown, sessionId: string, request?: { readonly offset?: number; readonly lines?: number }): {
    readonly text: string
    readonly totalLines: number
    readonly lineBegin: number
    readonly lineEnd: number
    readonly truncated: boolean
  }
  signal(owner: unknown, sessionId: string, signal: string): Promise<{ readonly delivered: boolean; readonly targetPgid: number | null }>
  kill(owner: unknown, sessionId: string, reason?: string): Promise<boolean>
  list(owner: unknown): readonly ConfinedTerminalSnapshot[]
  /** Teardown of every session this face owns (the mount's disposal path). */
  disposeAll(): Promise<void>
}

/**
 * The confined process surface this face executes through — a structural
 * subset of the confined `subprocess` service mounted on the SAME Member
 * scope. The face never resolves that service itself: the install passes the
 * surface it just mounted, so a "missing face" becomes an install-time refusal
 * instead of a late, silent inheritance.
 */
export interface ConfinedTerminalProcessSurface {
  spawn(spec: {
    readonly argv: readonly string[]
    readonly cwd: string
    readonly stdio: {
      readonly stdin: 'ignore'
      readonly stdout: { readonly maxBytes: number }
      readonly stderr: { readonly maxBytes: number }
    }
    readonly graceMs: number
    readonly signal?: AbortSignal | undefined
    readonly shell: { readonly program: string; readonly reads: readonly string[]; readonly writes: readonly string[] }
  }): {
    readonly collected: {
      readonly stdout?: { readFrom(fromByte: number): { readonly text: string } } | undefined
      readonly stderr?: { readFrom(fromByte: number): { readonly text: string } } | undefined
    }
    readonly done: Promise<{ readonly exitCode: number | null; readonly signal: string | null }>
    terminate(): void
  }
}

/** What the install hands the face. */
export interface ConfinedTerminalFaceOptions {
  readonly effective: EffectiveIoPolicy
  /** The admitted shell program (absolute; the realm's declared shell class covers it). */
  readonly program: string
  /** The realm's declared shell class — the composition's, never the Member's. */
  readonly shellClass: ConfinedShellClassAdmission
  /** The SAME observed guard the confined `fs` face consults. */
  readonly guard: FsGuard
  /** The confined process surface mounted on this realm (never the base service). */
  readonly subprocess: ConfinedTerminalProcessSurface
  readonly maxOutputBytes?: number
  readonly graceMs?: number
  readonly motd?: string
}

// ---------------------------------------------------------------------------
// Lexical read attribution — the read axis's only statically attributable input
// ---------------------------------------------------------------------------

/** True for a token that is an ENV assignment / a shell keyword, never a path. */
function isShellWord(token: string): boolean {
  if (token === '') return true
  // `-flag` is never a path operand in the shipped shell vocabulary.
  if (token.startsWith('-')) return true
  // `NAME=value` is an assignment; the value may be a path, but it is not a
  // read the command performs by naming it.
  if (/^[A-Za-z_][A-Za-z0-9_]*=/u.test(token)) return true
  return false
}

/** Characters that END a token (unquoted shell control operators). */
const TOKEN_BREAK = new Set([' ', '\t', '\n', '\r', ';', '|', '&', '(', ')', '<', '>'])

/**
 * Tokenise a command body WITHOUT executing it: quotes are honoured (a quoted
 * path with spaces stays one token), backslash escapes the next character, and
 * unquoted control operators end a token. Redirect operators are reported so
 * their target can be skipped (a redirection target is a WRITE, not a read).
 *
 * @param {string} command - the command body.
 * @returns {readonly { token: string, redirect: boolean }[]} in source order.
 */
export function tokenizeShellCommand(command: string): readonly { readonly token: string; readonly redirect: boolean }[] {
  const tokens: { token: string; redirect: boolean }[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let pendingRedirect = false
  let index = 0
  const flush = (): void => {
    if (current !== '') {
      tokens.push({ token: current, redirect: pendingRedirect })
      current = ''
      pendingRedirect = false
    }
  }
  while (index < command.length) {
    const char = command[index]
    if (quote !== null) {
      if (char === quote) {
        quote = null
        index += 1
        continue
      }
      if (char === '\\' && quote === '"' && index + 1 < command.length) {
        current += command[index + 1]
        index += 2
        continue
      }
      current += char
      index += 1
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      index += 1
      continue
    }
    if (char === '\\' && index + 1 < command.length) {
      current += command[index + 1]
      index += 2
      continue
    }
    if (char === '<') {
      // `< file` reads the file; `<<`/`<<<` are here-docs / here-strings.
      flush()
      pendingRedirect = command[index + 1] !== '<'
      index += command[index + 1] === '<' ? 2 : 1
      continue
    }
    if (char === '>') {
      // A `>`/`>>`/`&>` target is a WRITE. `>&2`/`2>&1` targets are not paths.
      flush()
      pendingRedirect = true
      index += command[index + 1] === '>' ? 2 : 1
      continue
    }
    if (char !== undefined && TOKEN_BREAK.has(char)) {
      flush()
      index += 1
      continue
    }
    current += char
    index += 1
  }
  flush()
  return Object.freeze(tokens.map((entry) => Object.freeze(entry)))
}

/**
 * The DECLARED read intents of one command body.
 *
 * The rule is deliberately narrow and auditable, and it fails toward REFUSAL,
 * never toward a silent allow:
 *   - a token is a read intent when it is an absolute path, or when it already
 *     exists relative to the session cwd (the same "operand, not a pattern"
 *     rule `readIntentsOf` applies to argv tokens);
 *   - a token that is a redirection TARGET is a write, not a read, and is
 *     skipped (a shell's `> /dev/null` is not a read of `/dev/null`);
 *   - a token that is dynamic (`$…`, a backtick, `$(…)`) is NOT attributable
 *     and is skipped — the disclosed dynamic-read weakness. The command still
 *     runs under the confined process face's OS profile.
 *
 * @param {string} command - the command body.
 * @param {string} cwd - the session's absolute working directory.
 * @param {{ exists?: (path: string) => boolean }} [deps] - existence probe (tests).
 * @returns {readonly string[]} resolved read intents, de-duplicated, in order.
 */
export function shellReadIntentsOf(
  command: string,
  cwd: string,
  deps: { readonly exists?: (path: string) => boolean } = {},
): readonly string[] {
  if (typeof command !== 'string' || command.trim() === '') return Object.freeze([])
  if (typeof cwd !== 'string' || !isAbsolute(cwd)) return Object.freeze([])
  const exists = deps.exists ?? existsSync
  const intents: string[] = []
  // A here-doc separator is data, not a path; the tokenizer already skips `<<`.
  for (const { token, redirect } of tokenizeShellCommand(command)) {
    if (redirect) continue
    if (isShellWord(token)) continue
    if (token.includes('$') || token.includes('`')) continue
    // A pattern (`*.txt`, `lane/*`) is not a path operand.
    if (token.includes('*') || token.includes('?')) continue
    const absolute = isAbsolute(token)
    if (!absolute && !exists(resolvePath(cwd, token))) continue
    const resolved = absolute ? resolvePath(token) : resolvePath(cwd, token)
    if (!intents.includes(resolved)) intents.push(resolved)
  }
  return Object.freeze(intents)
}

// ---------------------------------------------------------------------------
// The face
// ---------------------------------------------------------------------------

interface TerminalSessionRecord {
  readonly id: string
  readonly owner: unknown
  readonly ownerKey: string
  readonly type: string
  readonly cwd: string
  readonly motd: string | undefined
  lines: string[]
  sends: number
  active: { done: Promise<ConfinedTerminalSendOutcome>; cancel: () => boolean; output: () => { delta: string; truncated: boolean } } | undefined
  handle: { terminate(): void } | undefined
  closing: boolean
  closed: boolean
  status: ConfinedTerminalStatus
}

function ownerKeyOf(owner: unknown): string {
  if (owner === null || typeof owner !== 'object') return ''
  const id = (owner as { id?: unknown }).id
  return typeof id === 'string' && id !== '' ? id : ''
}

function ownerCwdOf(owner: unknown): string | undefined {
  if (owner === null || typeof owner !== 'object') return undefined
  const cwd = (owner as { session?: { header?: { cwd?: unknown } } }).session?.header?.cwd
  return typeof cwd === 'string' && cwd !== '' ? cwd : undefined
}

const DEFAULT_MAX_OUTPUT_BYTES = 1 << 18
const DEFAULT_GRACE_MS = 5_000

/**
 * Create the confined terminal face: a Cordis plugin providing the `terminals`
 * service on the context it is mounted on (the Member's isolated scope).
 *
 * @param {ConfinedTerminalFaceOptions} options - the realm's compiled lane, the
 *   admitted program, the realm's shell class, the SAME observed guard the
 *   confined `fs` face uses, and the confined process surface to execute on.
 * @returns {object} the plugin object `mount` passes to `ctx.plugin`.
 */
export function createConfinedTerminalFace(options: ConfinedTerminalFaceOptions): {
  readonly name: string
  apply(ctx: unknown): void
} {
  if (options === undefined || options === null || typeof options !== 'object') {
    throw new TypeError('createConfinedTerminalFace needs its options')
  }
  const { effective, program, shellClass, guard, subprocess } = options
  if (effective === undefined || effective === null || typeof effective !== 'object' || typeof effective.memberIdentity !== 'string') {
    throw new TypeError('createConfinedTerminalFace needs the compiled EffectiveIo policy')
  }
  if (typeof program !== 'string' || !isAbsolute(program)) {
    throw new TypeError('createConfinedTerminalFace needs an ABSOLUTE shell program (the face refuses a PATH name)')
  }
  if (typeof guard !== 'function') {
    throw new TypeError('createConfinedTerminalFace needs the realm\'s guard (the same one the confined fs face consults)')
  }
  if (subprocess === undefined || subprocess === null || typeof subprocess.spawn !== 'function') {
    throw new TypeError('createConfinedTerminalFace needs the realm\'s confined process surface (it never falls back to the base service)')
  }
  if (shellClass === undefined || shellClass === null || !Array.isArray(shellClass.programs)
    || !shellClass.programs.includes(basename(program).toLowerCase())) {
    throw new TypeError(
      `createConfinedTerminalFace needs a declared shell class admitting ${JSON.stringify(basename(program))};`
      + ' a terminal face whose commands the process face would refuse is not a face',
    )
  }
  const maxOutputBytes = Number.isFinite(options.maxOutputBytes) && (options.maxOutputBytes as number) > 0
    ? (options.maxOutputBytes as number)
    : DEFAULT_MAX_OUTPUT_BYTES
  const graceMs = Number.isFinite(options.graceMs) && (options.graceMs as number) > 0
    ? (options.graceMs as number)
    : DEFAULT_GRACE_MS
  const programName = basename(program).toLowerCase()

  const sessions = new Map<string, TerminalSessionRecord>()
  let nextId = 0

  const snapshotOf = (session: TerminalSessionRecord): ConfinedTerminalSnapshot => Object.freeze({
    sessionId: session.id,
    type: session.type,
    status: session.status,
    ...(session.motd === undefined ? {} : { motd: session.motd }),
  })

  const expectOwned = (owner: unknown, sessionId: string): TerminalSessionRecord => {
    const key = ownerKeyOf(owner)
    if (key === '') {
      throw new ConfinedTerminalRefusal('TERMINALS_OWNER_UNTRUSTED', 'the caller presented no owner identity (an owner object with a non-empty `id` is required)')
    }
    const session = sessions.get(sessionId)
    if (session === undefined) {
      throw new ConfinedTerminalRefusal('TERMINALS_NO_SESSION', `unknown confined terminal session ${JSON.stringify(sessionId)}`)
    }
    if (session.ownerKey !== key) {
      throw new ConfinedTerminalRefusal('TERMINALS_FOREIGN_SESSION', `session ${JSON.stringify(sessionId)} belongs to another owner`)
    }
    return session
  }

  const terminate = (session: TerminalSessionRecord): void => {
    const handle = session.handle
    session.handle = undefined
    if (handle !== undefined) {
      try {
        handle.terminate()
      } catch {
        // The refusal/exit that follows is the reported outcome.
      }
    }
  }

  const surface: ConfinedTerminalSurface = {
    listBackends() {
      return CONFINED_TERMINAL_BACKENDS
    },

    async spawn(owner, request, signal) {
      const key = ownerKeyOf(owner)
      if (key === '') {
        throw new ConfinedTerminalRefusal('TERMINALS_OWNER_UNTRUSTED', 'a confined terminal session needs an owner with a non-empty `id`')
      }
      if (signal?.aborted === true) throw new ConfinedTerminalRefusal('TERMINALS_COMMAND_CANCELLED', 'the spawn was aborted before it was published')
      const type = typeof request?.type === 'string' && request.type !== '' ? request.type : 'confined-shell'
      if (!CONFINED_TERMINAL_BACKENDS.includes(type)) {
        throw new ConfinedTerminalRefusal(
          'TERMINALS_NO_BACKEND',
          `no confined terminal backend named ${JSON.stringify(type)} (registered: ${CONFINED_TERMINAL_BACKENDS.join(', ')})`,
        )
      }
      const cwd = typeof request?.cwd === 'string' && request.cwd !== '' ? request.cwd : ownerCwdOf(owner)
      if (typeof cwd !== 'string' || !isAbsolute(cwd)) {
        throw new ConfinedTerminalRefusal('TERMINALS_CWD_UNRESOLVED', 'a confined terminal session needs an absolute working directory')
      }
      nextId += 1
      const id = `confined-pty-${String(nextId)}`
      const session: TerminalSessionRecord = {
        id,
        owner,
        ownerKey: key,
        type,
        cwd: resolvePath(cwd),
        motd: options.motd,
        lines: [],
        sends: 0,
        active: undefined,
        handle: undefined,
        closing: false,
        closed: false,
        status: { kind: 'running' },
      }
      sessions.set(id, session)
      return snapshotOf(session)
    },

    startSend(owner, sessionId, request) {
      const session = expectOwned(owner, sessionId)
      if (session.closing || session.closed) {
        throw new ConfinedTerminalRefusal('TERMINALS_SESSION_CLOSED', `session ${JSON.stringify(sessionId)} is closed`)
      }
      if (session.active !== undefined) {
        throw new ConfinedTerminalRefusal('TERMINALS_SEND_ACTIVE', `session ${JSON.stringify(sessionId)} already has an active send`)
      }
      const text = typeof request?.text === 'string' ? request.text : ''
      if (text.trim() === '') {
        throw new ConfinedTerminalRefusal('TERMINALS_COMMAND_CANCELLED', 'a confined terminal send needs a non-empty command body')
      }
      const callerSignal = request?.signal
      let cancelled = false
      let output = { delta: '', truncated: false }
      const send = (async (): Promise<ConfinedTerminalSendOutcome> => {
        // THE READ AXIS. Every lexically named read is consulted against the
        // Member's effective read lane through the SAME guard the fs face uses;
        // a denial throws the guard's typed TeamIoDenied BEFORE the confined
        // process face is asked to spawn anything, so no provider call and no
        // byte exists for the refused command.
        for (const locator of shellReadIntentsOf(text, session.cwd)) {
          await guard(TERMINAL_GUARD_METHOD, locator)
        }
        if (cancelled) throw new ConfinedTerminalRefusal('TERMINALS_COMMAND_CANCELLED', 'the command was cancelled during admission')
        const handle = subprocess.spawn({
          argv: [program, '-c', text],
          cwd: session.cwd,
          stdio: {
            stdin: 'ignore',
            stdout: { maxBytes: maxOutputBytes },
            stderr: { maxBytes: maxOutputBytes },
          },
          graceMs,
          ...(callerSignal === undefined ? {} : { signal: callerSignal }),
          // The DECLARED invocation the confined process face admits. The body
          // is read-opaque to THAT face; the session cwd is its one declared
          // root. The per-command read attribution is this face's job (above).
          shell: { program: programName, reads: [session.cwd], writes: [session.cwd] },
        })
        session.handle = handle
        let outcome: { exitCode: number | null; signal: string | null }
        try {
          outcome = await handle.done
        } finally {
          session.handle = undefined
        }
        const stdout = safeText(handle.collected.stdout)
        const stderr = safeText(handle.collected.stderr)
        const rendered = `${stdout}${stderr}`
        if (rendered !== '') session.lines.push(...rendered.split('\n').filter((line, at, all) => !(at === all.length - 1 && line === '')))
        output = { delta: rendered, truncated: false }
        session.status = { kind: 'running' }
        return Object.freeze({
          viewport: rendered,
          waitReason: 'inferred_idle' as const,
          sessionStatus: session.status,
          truncated: false,
          exitCode: outcome.exitCode,
          signal: outcome.signal,
          cancelled,
          stdout,
          stderr,
        })
      })()
      const record = {
        done: send,
        cancel: (): boolean => {
          if (session.active !== record) return false
          cancelled = true
          terminate(session)
          return true
        },
        output: () => output,
      }
      session.active = record
      session.sends += 1
      const settle = (): void => {
        if (session.active === record) session.active = undefined
      }
      send.then(settle, settle)
      return Object.freeze({
        done: send,
        readOutput: () => record.output(),
        cancel: () => record.cancel(),
      })
    },

    read(owner, sessionId) {
      const session = expectOwned(owner, sessionId)
      const text = session.lines.join('\n')
      const totalLines = session.lines.length
      return Object.freeze({ text, totalLines, lineBegin: 0, lineEnd: totalLines, truncated: false })
    },

    async signal(owner, sessionId) {
      const session = expectOwned(owner, sessionId)
      if (session.handle === undefined) return Object.freeze({ delivered: false, targetPgid: null })
      terminate(session)
      // NO PROCESS-GROUP CLAIM: this face never created a new process group and
      // never measured one. `targetPgid: null` says exactly that.
      return Object.freeze({ delivered: true, targetPgid: null })
    },

    async kill(owner, sessionId) {
      const session = expectOwned(owner, sessionId)
      if (session.closing) return false
      session.closing = true
      terminate(session)
      const active = session.active
      if (active !== undefined) {
        try {
          await active.done
        } catch {
          // The close is the reported outcome; a refused send is already typed.
        }
      }
      session.closed = true
      session.closing = false
      session.status = { kind: 'exited', exitCode: 0, signal: null }
      sessions.delete(sessionId)
      return true
    },

    list(owner) {
      const key = ownerKeyOf(owner)
      if (key === '') return Object.freeze([])
      return Object.freeze([...sessions.values()].filter((session) => session.ownerKey === key).map(snapshotOf))
    },

    async disposeAll() {
      for (const session of [...sessions.values()]) {
        try {
          await surface.kill(session.owner, session.id, 'confined terminal face disposed')
        } catch {
          // Best-effort teardown: the mount failure is the reported fault.
        }
      }
      sessions.clear()
    },
  }

  return Object.freeze({
    name: 'a5sf-confined-terminal',
    apply(ctx: unknown): void {
      const host = ctx as { provide?: (name: string, value: unknown) => void; effect?: (fn: () => () => void, label?: string) => unknown }
      if (typeof host.provide !== 'function') {
        throw new TypeError('the confined terminal face needs a Cordis Context that can provide a service')
      }
      host.provide('terminals', surface)
      if (typeof host.effect === 'function') {
        host.effect(() => () => {
          void surface.disposeAll()
          return undefined
        }, 'a5sf confined terminal teardown')
      }
    },
  })
}

/** Read one collected stream defensively (a missing reader is empty output). */
function safeText(reader: { readFrom(fromByte: number): { readonly text: string } } | undefined): string {
  try {
    return String(reader?.readFrom(0)?.text ?? '')
  } catch {
    return ''
  }
}
