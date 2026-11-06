/**
 * a5sf-bl17-bash-probe-tool.mjs — the ONE model-visible tool this run adds to a
 * governed Member realm: `bash_probe`.
 *
 * WHAT IT IS. A THIN caller of the realm's confined `subprocess` face. It runs
 * EXACTLY `<declared shell> -c <body>` and forwards the call's declared
 * read/write/chmod roots to `spec.shell`. It contains NO policy decision, NO
 * argv allow-list (BL-41 forbids a second static gate), NO path algebra and NO
 * process launch of its own: admission, the lane consult, the OS profile and
 * the child process are the SHIPPED confined face's.
 *
 * WHY IT EXISTS. No shipped product tool runs a shell body through the confined
 * `subprocess` face: the native persistent `bash` consumes `terminals` (refused
 * on a governed realm), and the search tool's argv is `rg`'s. The row's live
 * half therefore needs a composition-provided caller — this file, declared in
 * `a5sfNativeToolModules` and mounted by the same product row a real native
 * module rides. It is TEST COMPOSITION and gets no credit of its own; every
 * property measured belongs to the face it calls.
 *
 * WHAT IT RECORDS. Every attempt appends one JSON row to `config.ledgerPath`
 * (test instrumentation): the argv, the declared roots, the outcome, the typed
 * refusal code, the exit code and the captured bytes' length. The ledger is
 * written BEFORE the error is rethrown, so the typed code survives the tool
 * runtime's wrapping and the World teardown.
 *
 * @module dev/agent-workflow/evidence/a5sf-bl17-live/a5sf-bl17-bash-probe-tool
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export const name = 'a5sf-bl17-bash-probe'
/** The confined face is the service under test; `tools` hosts the definition. */
export const inject = ['tools', 'subprocess']

const MAX_BYTES = 65536
const GRACE_MS = 10_000

function stringsOf(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string' && entry.trim() !== '') : []
}

function ledgerWriter(path) {
  return (row) => {
    if (typeof path !== 'string' || path === '') return
    try {
      mkdirSync(dirname(path), { recursive: true })
      appendFileSync(path, `${JSON.stringify({ at: new Date().toISOString(), ...row })}\n`)
    } catch {
      /* instrumentation never changes the call it observes */
    }
  }
}

export function apply(ctx, config) {
  const record = ledgerWriter(typeof config?.ledgerPath === 'string' ? config.ledgerPath : '')
  const program = typeof config?.program === 'string' && config.program.trim() !== '' ? config.program.trim() : '/bin/bash'

  ctx.tools.register({
    name: 'bash_probe',
    description: 'Run ONE bash body through the confined subprocess face, declaring the roots the body touches.',
    parameters: {
      type: 'object',
      properties: {
        body: { type: 'string', description: 'the bash body, passed as the single -c operand' },
        cwd: { type: 'string', description: 'absolute working directory (must be inside the effective read lane)' },
        reads: { type: 'array', items: { type: 'string' }, description: 'roots the command declares it will READ' },
        writes: { type: 'array', items: { type: 'string' }, description: 'roots the command declares it will CREATE/MODIFY/REMOVE' },
        chmod: { type: 'array', items: { type: 'string' }, description: 'paths whose MODE the command declares it will change' },
      },
      required: ['body'],
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(raw) {
      const args = raw !== null && typeof raw === 'object' ? raw : {}
      const body = typeof args.body === 'string' ? args.body : ''
      const cwd = typeof args.cwd === 'string' && args.cwd.trim() !== '' ? args.cwd : undefined
      const reads = stringsOf(args.reads)
      const writes = stringsOf(args.writes)
      const chmod = stringsOf(args.chmod)
      const subprocess = ctx.subprocess
      const declaration = {
        program,
        ...(reads.length > 0 ? { reads } : {}),
        ...(writes.length > 0 ? { writes } : {}),
        ...(chmod.length > 0 ? { chmod } : {}),
      }
      const base = { tool: 'bash_probe', program, body, cwd: cwd ?? null, reads, writes, chmod }
      let handle
      try {
        handle = subprocess.spawn({
          argv: [program, '-c', body],
          cwd,
          stdio: {
            stdin: 'ignore',
            stdout: { maxBytes: MAX_BYTES },
            stderr: { maxBytes: MAX_BYTES },
          },
          graceMs: GRACE_MS,
          shell: declaration,
        })
      } catch (error) {
        record({ ...base, stage: 'spawn-throw', code: error?.code ?? null, name: error?.name ?? null, message: String(error?.message ?? error) })
        throw error
      }
      try {
        const outcome = await handle.done
        const stdout = handle.collected?.stdout?.finalize() ?? { text: '', truncated: false }
        const stderr = handle.collected?.stderr?.finalize() ?? { text: '', truncated: false }
        record({
          ...base,
          stage: 'completed',
          exitCode: outcome?.exitCode ?? null,
          signal: outcome?.signal ?? null,
          stdoutBytes: Buffer.byteLength(stdout.text ?? ''),
          stderrBytes: Buffer.byteLength(stderr.text ?? ''),
          stdoutTruncated: stdout.truncated === true,
        })
        return JSON.stringify({
          ok: true,
          exitCode: outcome?.exitCode ?? null,
          signal: outcome?.signal ?? null,
          stdout: stdout.text ?? '',
          stderr: stderr.text ?? '',
          truncated: stdout.truncated === true || stderr.truncated === true,
        })
      } catch (error) {
        record({ ...base, stage: 'done-rejected', code: error?.code ?? null, name: error?.name ?? null, message: String(error?.message ?? error) })
        throw error
      }
    },
  })
}
