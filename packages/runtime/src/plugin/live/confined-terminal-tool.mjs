/**
 * confined-terminal-tool.mjs — the model-visible `bash` tool, served by the
 * Member's CONFINED `terminals` face (PD-13).
 *
 * WHY THIS EXISTS (PD-13, 2026-11-11). The register's hole: a Member's shell
 * had no READ axis. Its `bash` was the preset's inherited persistent PTY
 * (`/dev/pts/N`, one shell across commands, `0` confined spawns, `0` guard
 * facts), and a `cat` of a file the compiled read lane denies returned the
 * file's bytes with exit 0. The confined machinery already refused that read —
 * it was not on the terminal path.
 *
 * HOW IT IS SERVED. This module is a NATIVE tool module in the route-C sense
 * (the same seam `read`/`write`/`grep`/`glob` and PD-12's `bash` shadow use):
 * the realm row re-mounts it INSIDE the Member's isolated scope, AFTER the
 * capability deny lane, so the definition the agent resolves is this one and
 * `ctx.terminals` below is the CONFINED terminal face mounted on that scope —
 * not the inherited host `dsh-terminal`. The tool opens a confined session,
 * sends the command, reads the settled output and closes the session. Every
 * command's lexically named reads are admitted against the compiled lane by the
 * face BEFORE the confined process face is asked to spawn; a denied read comes
 * back as a typed `IO_READ_DENIED` error with zero bytes.
 *
 * WHAT THIS DOES NOT DO (stated so the fix cannot be read as more):
 *   - it is not a PTY: a PTY cannot ride the confined execution profile, so
 *     each command is a fresh confined child. `cd`/`export` do NOT carry
 *     across calls and there is no interactive stdin (the capability cost of a
 *     governed shell, disclosed in the evidence README);
 *   - it does not add OS-level isolation beyond what the confined `subprocess`
 *     face measures, and it claims no process group;
 *   - a DYNAMIC read (`$(...)`, backticks) is not lexically attributable: it is
 *     not refused at admission and the OS profile is its boundary.
 *
 * CORE PATCH BUDGET = 0: our package's module, mounted through the existing
 * public route-C seam.
 *
 * @module @dsh-agent-team/runtime/plugin/live/confined-terminal-tool
 */
import { isAbsolute, join } from 'node:path'
import { clearTimeout, setTimeout } from 'node:timers'
// The repo's ESLint config declares no Node globals; import the ones used.
import { cwd } from 'node:process'

export const name = 'a5sf-confined-terminal-bash'

/**
 * `terminals` is the CONFINED terminal face the realm mounts on the isolated
 * scope. The mount seam refuses a `terminals`-consuming module on a realm that
 * owns no such face (`TERMINALS_LEGACY_PTY_REFUSED`) instead of letting it
 * resolve the inherited legacy PTY service.
 */
export const inject = ['tools', 'terminals']

const DEFAULT_TIMEOUT_MS = 60_000

const DESCRIPTION =
  'Execute a bash command through this Member\'s confined terminal face and return its stdout/stderr. '
  + 'Each call runs in a fresh confined shell; pass `workdir` instead of using `cd`. '
  + 'Every path the command names is admitted against the compiled read lane before the shell starts; '
  + 'a refused read returns no bytes and names the typed refusal code in its error.'

function textOfReader(reader) {
  try {
    return String(reader?.readFrom(0)?.text ?? '')
  } catch {
    return ''
  }
}

/**
 * Resolve the call's working directory: the model's `workdir` (absolute, or
 * relative to the session cwd) else the session cwd else the module's declared
 * fallback. `undefined` is a typed refusal at the face, never a silent process
 * cwd.
 */
export function resolveTerminalCwd(args, exec, fallback) {
  const sessionCwd = exec?.agent?.session?.header?.cwd
  const base = typeof sessionCwd === 'string' && sessionCwd !== '' ? sessionCwd : fallback
  const modelWorkdir = typeof args?.workdir === 'string' && args.workdir !== '' ? args.workdir : undefined
  if (modelWorkdir === undefined) return base
  if (isAbsolute(modelWorkdir)) return modelWorkdir
  if (typeof base === 'string' && base !== '') return join(base, modelWorkdir)
  return modelWorkdir
}

export function apply(ctx, config = {}) {
  const fallbackCwd = String(config?.cwd ?? cwd())
  const timeoutMs = Number.isFinite(config?.timeoutMs) && config.timeoutMs > 0 ? config.timeoutMs : DEFAULT_TIMEOUT_MS
  ctx.tools.register({
    name: 'bash',
    description: DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The bash command line to run (`bash -c`).' },
        description: { type: 'string', description: 'One short sentence describing what the command does.' },
        workdir: { type: 'string', description: 'Optional working directory; absolute, or relative to the session cwd.' },
      },
      required: ['command', 'description'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(args, exec) {
      const owner = exec?.agent
      if (owner === undefined || owner === null) {
        throw new Error('bash requires an owning agent session (the confined terminal face is owner-scoped)')
      }
      const command = String(args?.command ?? '')
      const cwd = resolveTerminalCwd(args, exec, fallbackCwd)
      const session = await ctx.terminals.spawn(owner, { type: 'confined-shell', cwd }, exec?.signal)
      let timedOut = false
      let timer
      try {
        const operation = ctx.terminals.startSend(owner, session.sessionId, { text: command })
        if (exec?.signal !== undefined && exec.signal.aborted === true) {
          operation.cancel()
          const aborted = new Error('TERMINALS_COMMAND_CANCELLED: the call was aborted before the command settled')
          aborted.code = 'TERMINALS_COMMAND_CANCELLED'
          throw aborted
        }
        timer = setTimeout(() => {
          timedOut = true
          // The close is the timeout's enforcement: the face terminates the
          // confined child and the settled send reports a signal outcome.
          void ctx.terminals.kill(owner, session.sessionId, 'command timed out')
        }, timeoutMs)
        let outcome
        try {
          outcome = await operation.done
        } catch (error) {
          // An admission refusal reaches the model as the code the face chose
          // (`IO_READ_DENIED`, `SUBPROCESS_*`, `NETWORK_UNCONFINED_REALM`, …),
          // never as an anonymous tool crash and never as an empty success.
          throw refusalError(error)
        }
        const page = ctx.terminals.read(owner, session.sessionId, {})
        const record = {
          kind: 'confined-terminal',
          sessionId: session.sessionId,
          exitCode: timedOut ? null : (outcome?.exitCode ?? null),
          signal: outcome?.signal ?? null,
          timedOut,
          aborted: exec?.signal?.aborted === true,
          cancelled: outcome?.cancelled === true,
          stdout: outcome?.stdout ?? textOfReader(undefined),
          stderr: outcome?.stderr ?? '',
          scrollback: page?.text ?? '',
        }
        return JSON.stringify(record)
      } finally {
        if (timer !== undefined) clearTimeout(timer)
        try {
          await ctx.terminals.kill(owner, session.sessionId, 'command complete')
        } catch {
          // A close failure must not replace the command's own outcome.
        }
      }
    },
  })
}

/**
 * A typed admission refusal must reach the model as the code the face chose,
 * not as an anonymous tool crash. The code is preserved on the thrown error and
 * named in its message.
 */
function refusalError(error) {
  const code = typeof error?.code === 'string' && error.code !== '' ? error.code : 'TERMINALS_REFUSED'
  const message = String(error?.message ?? error)
  const wrapped = new Error(`${code}: ${message}`)
  wrapped.code = code
  wrapped.cause = error
  return wrapped
}
