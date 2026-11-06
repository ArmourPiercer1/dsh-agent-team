/**
 * confined-bash-tool.mjs — the model-visible `bash` tool, served by the
 * Member's CONFINED `subprocess` face.
 *
 * WHY THIS EXISTS (PD-12, 2026-11-10). The register's hole: a Member whose
 * compiled ceiling declares `network: deny` could still run a shell command
 * through the model-visible `bash` tool, because that tool was the preset's
 * shipped `@deepseek-ai/dsh-tool-bash` row resolving the inherited
 * `ctx.shell` -> base `subprocess` (`SandboxBashExecutor`). The confined face
 * was never called, so the ceiling's network term was never consulted: the
 * ceiling is compiled per FACE, and the ToolRestriction bound `bash` to an
 * executor that never enters that face.
 *
 * HOW IT IS SERVED. This module is a NATIVE tool module in the route-C sense
 * (the same seam `read`/`write`/`grep`/`glob` use): the realm row re-mounts it
 * INSIDE the Member's isolated scope, AFTER the capability deny lane, so the
 * definition the agent resolves is this one and `ctx.subprocess` below is the
 * CONFINED face mounted on that scope — not the inherited base service. The
 * tool body builds the one argv shape the face admits (`<program> -c <body>`)
 * and declares the invocation's roots (the resolved working directory on both
 * the read and the write axis), so the face consults the compiled lane and —
 * for `network: deny` — its own capability probe BEFORE any provider call.
 *
 * WHAT THIS DOES NOT DO (stated so the fix cannot be read as more):
 *   - it does not add network isolation. The confined provider's probe still
 *     reports `unsupported` on this host, so a `network: deny` lane is an
 *     ADMISSION REFUSAL (`NETWORK_UNCONFINED_REALM`) with zero processes, not
 *     an OS-level denial;
 *   - it does not statically attribute what the shell BODY reads or writes.
 *     The declared roots are the only attributable input; the OS execution
 *     profile remains the boundary for the body (the same disclosure BL-17
 *     carries).
 *
 * CORE PATCH BUDGET = 0: no upstream source is touched. This is our package's
 * module, mounted through the existing public route-C seam.
 *
 * @module @dsh-agent-team/runtime/plugin/live/confined-bash-tool
 */
import { isAbsolute, join } from 'node:path'

export const name = 'a5sf-confined-bash'

/**
 * `subprocess` is the CONFINED face the realm mounts on the isolated scope.
 * The mount seam refuses a `subprocess`-consuming module on a realm that owns
 * no such face (`SUBPROCESS_UNCONFINED_REALM`) instead of letting it resolve
 * the inherited base service.
 */
export const inject = ['tools', 'subprocess']

const MAX_BYTES = 1 << 18
const DEFAULT_TIMEOUT_MS = 60_000
/** The admitted shell program: absolute, because the face refuses a PATH name. */
const DEFAULT_PROGRAM = '/bin/bash'

const DESCRIPTION =
  'Execute a bash command (`bash -c`) through this Member\'s confined subprocess face and return its '
  + 'stdout/stderr. Each call runs in a fresh shell; pass `workdir` instead of using `cd`. '
  + 'The command is admitted against the compiled lane before any process starts; a refused call '
  + 'names the typed refusal code in its error.'

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
 * fallback. `undefined` is a typed refusal at the face (`cwd` must be
 * absolute), never a silent process cwd.
 */
export function resolveBashCwd(args, exec, fallback) {
  const sessionCwd = exec?.agent?.session?.header?.cwd
  const base = typeof sessionCwd === 'string' && sessionCwd !== '' ? sessionCwd : fallback
  const modelWorkdir = typeof args?.workdir === 'string' && args.workdir !== '' ? args.workdir : undefined
  if (modelWorkdir === undefined) return base
  if (isAbsolute(modelWorkdir)) return modelWorkdir
  if (typeof base === 'string' && base !== '') return join(base, modelWorkdir)
  return modelWorkdir
}

export function apply(ctx, config) {
  const program = typeof config?.program === 'string' && config.program.startsWith('/')
    ? config.program
    : DEFAULT_PROGRAM
  const fallbackCwd = typeof config?.workspace === 'string' && config.workspace !== '' ? config.workspace : undefined
  const defaultTimeoutMs = Number.isFinite(config?.timeoutMs) && config.timeoutMs > 0
    ? config.timeoutMs
    : DEFAULT_TIMEOUT_MS

  ctx.tools.register({
    name: 'bash',
    description: DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The bash command to execute.' },
        description: {
          type: 'string',
          description: 'Clear, concise description of what this command does in active voice, 5-10 words (shown in the UI).',
        },
        timeoutMs: { type: 'number', description: 'Timeout in milliseconds; the process is terminated on expiry.' },
        workdir: {
          type: 'string',
          description: 'Working directory for this command. Defaults to the session workspace; a relative path is resolved against it.',
        },
      },
      required: ['command', 'description'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(args, exec) {
      const command = typeof args?.command === 'string' ? args.command : ''
      if (command.trim() === '') throw new Error('invalid command: expected a non-empty string')
      if (typeof args?.description !== 'string' || args.description.trim() === '') {
        throw new Error('invalid description: expected a non-empty string')
      }
      const timeoutMs = Number.isFinite(args?.timeoutMs) && args.timeoutMs > 0 ? args.timeoutMs : defaultTimeoutMs
      const cwd = resolveBashCwd(args, exec, fallbackCwd)
      if (typeof cwd !== 'string' || !isAbsolute(cwd)) {
        throw new Error('bash: no absolute working directory for this call; pass an absolute `workdir`')
      }
      // The closed argv shape the confined face admits (`<program> -c <body>`),
      // and the ONLY statically attributable input a shell body has: the
      // declared roots. The body is not attributed; the OS profile is the
      // boundary for everything these roots do not name (BL-17 disclosure).
      const spec = {
        argv: [program, '-c', command],
        cwd,
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: MAX_BYTES },
          stderr: { maxBytes: MAX_BYTES },
        },
        graceMs: 5_000,
        signal: exec?.signal,
        shell: { program, reads: [cwd], writes: [cwd] },
      }
      let handle
      try {
        handle = ctx.subprocess.spawn(spec)
      } catch (error) {
        throw refusalError(error)
      }
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        try { handle.terminate() } catch { /* the refusal below is the outcome */ }
      }, timeoutMs)
      if (typeof timer.unref === 'function') timer.unref()
      let outcome
      try {
        outcome = await handle.done
      } catch (error) {
        clearTimeout(timer)
        throw refusalError(error)
      }
      clearTimeout(timer)
      const stdout = textOfReader(handle?.collected?.stdout)
      const stderr = textOfReader(handle?.collected?.stderr)
      const record = {
        kind: 'confined',
        exitCode: outcome?.exitCode ?? null,
        signal: outcome?.signal ?? null,
        timedOut,
        aborted: exec?.signal?.aborted === true,
        stdout,
        stderr,
      }
      // Exit status is DATA here (the face's payload passthrough records it);
      // a non-zero command is a normal tool result, only a REFUSAL is an error.
      return JSON.stringify(record)
    },
  })
}

/**
 * A typed admission refusal must reach the model as the code the face chose
 * (`NETWORK_UNCONFINED_REALM`, `IO_READ_DENIED`, `SUBPROCESS_SHELL_*`, …), not
 * as an anonymous tool crash. The code is preserved on the thrown error and
 * named in its message.
 */
function refusalError(error) {
  const code = typeof error?.code === 'string' && error.code !== '' ? error.code : 'SUBPROCESS_REFUSED'
  const message = String(error?.message ?? error)
  const wrapped = new Error(`${code}: ${message}`)
  wrapped.code = code
  wrapped.cause = error
  return wrapped
}
