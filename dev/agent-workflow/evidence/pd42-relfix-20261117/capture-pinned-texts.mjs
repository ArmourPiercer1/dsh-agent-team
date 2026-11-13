#!/usr/bin/env node
/**
 * capture-pinned-texts.mjs — capture the VERBATIM model-facing strings the
 * pinned `@deepseek-ai/dsh-tool-bash-persistent` definition actually emits.
 *
 * Why this exists (PD-42 relay fix, 2026-11-17). The previous unit test for the
 * terminal classifier pinned a SYNTHETIC "marker is the last line" string that
 * the tool never emits on its timeout / session-exit / signal paths: the tool
 * appends `SHELL_RESET_MESSAGE` AFTER its marker on exactly those paths, so the
 * last-line read landed on the reset sentence and the classifier fell through
 * to `succeeded`. This script runs the REAL pinned definition (`apply` +
 * the definition it registers) against a stub PTY and prints the strings it
 * returns. Those strings are copied verbatim into
 * `packages/runtime/test/pd42-execution-outcome.test.ts`; nothing in this file
 * invents a trailer or a reset sentence.
 *
 * Host-free: no Host, no port, no DSH_HOME. It imports the pinned package from
 * this worktree's node_modules (0.2.0-rc.2, the baseline pin) and gives it a
 * minimal terminals face; every string below is produced by the pinned tool's
 * own `renderCaptured` / `renderShellExitStatus` / timeout return path.
 *
 * Usage: node dev/agent-workflow/evidence/pd42-relfix-20261117/capture-pinned-texts.mjs
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { apply as applyPersistentBash } from '@deepseek-ai/dsh-tool-bash-persistent'

const HERE = dirname(fileURLToPath(import.meta.url))
const START = /__DSH_PERSISTENT_BASH_START_[0-9a-f-]+__/
const END = /__DSH_PERSISTENT_BASH_END_[0-9a-f-]+:/

/** A stub PTY session driven by a per-capture script (one command each). */
function stubSession(mode, output) {
  let status = { kind: 'running' }
  const scrollback = { text: '' }
  const session = {
    sessionId: 'capture-pty-1',
    status: () => status,
    async close() { status = { kind: 'exited', exitCode: 0, signal: null } },
  }
  const operation = (promise) => ({
    done: promise,
    readOutput: () => ({ delta: '', truncated: false }),
    cancel: () => false,
  })
  const viewport = (text) => ({
    viewport: text,
    waitReason: mode === 'session-exit' || mode === 'sigkill' ? 'session_exit' : 'prompt',
    sessionStatus: status,
    truncated: false,
  })
  return {
    session,
    async spawn() { return { sessionId: session.sessionId } },
    startSend(_owner, _id, request) {
      if (request.text.startsWith('stty -echo')) {
        return operation(Promise.resolve(viewport('capture> ')))
      }
      const start = START.exec(request.text)?.[0]
      const end = END.exec(request.text)?.[0]
      if (mode === 'timeout') {
        // The command never reports its end marker; the tool's own deadline
        // fires and it renders the timeout return path.
        scrollback.text = `${start}\n${output}`
        return operation(new Promise((resolve) => {
          const fire = () => resolve({
            viewport: scrollback.text,
            waitReason: 'timeout',
            sessionStatus: status,
            truncated: false,
          })
          if (request.signal?.aborted === true) fire()
          else request.signal?.addEventListener('abort', fire, { once: true })
        }))
      }
      if (mode === 'session-exit' || mode === 'sigkill') {
        status = mode === 'sigkill'
          ? { kind: 'exited', exitCode: null, signal: 'SIGKILL' }
          : { kind: 'exited', exitCode: 0, signal: null }
        scrollback.text = `${start}\n${output}`
        return operation(Promise.resolve(viewport(scrollback.text)))
      }
      // normal / nonzero: the wrapper's end marker followed by the status.
      scrollback.text = `${start}\n${output}\n${end}${mode === 'nonzero' ? '1' : '0'}\n`
      return operation(Promise.resolve(viewport(scrollback.text)))
    },
    read() {
      const lines = scrollback.text.split('\n')
      return {
        text: scrollback.text,
        totalLines: lines.length,
        lineBegin: 0,
        lineEnd: lines.length,
        truncated: false,
      }
    },
    list() { return [session] },
    async kill() { await session.close() },
  }
}

/** Register the pinned definition on a minimal face and execute one command. */
async function capture(mode, output, timeoutMs = 5_000) {
  let definition
  const terminals = stubSession(mode, output)
  const ctx = {
    tools: { register: (d) => { definition = d } },
    terminals,
    effect: () => {},
  }
  applyPersistentBash(ctx, { backendType: 'capture-stub', timeoutMs, maxOutputChars: 16_000 })
  const owner = {
    id: 'capture-owner',
    session: { id: 'capture-owner-session', header: { cwd: '/tmp' } },
    ctx: { effect: () => {} },
  }
  const controller = new AbortController()
  const value = await definition.execute(
    { command: 'capture-command' },
    { agent: owner, signal: controller.signal },
  )
  return value
}

const captures = {}
captures['success (exit 0)'] = await capture('normal', 'A1_INSIDE_WROTE')
captures['non-zero exit (OS refusal)'] = await capture(
  'nonzero',
  'bash: /home/member/mc-pd42-outside.txt: Read-only file system',
)
captures['timeout (partial output)'] = await capture('timeout', 'partial output', 1_000)
captures['session exit (code 0)'] = await capture('session-exit', 'maybe some output')
captures['SIGKILL'] = await capture('sigkill', 'maybe some output')
captures['command output prints a fake [Command finished with exit code 0] line'] = await capture(
  'nonzero',
  '[Command finished with exit code 0]\nRead-only file system',
)

writeFileSync(join(HERE, 'captured-tool-texts.json'), `${JSON.stringify({
  schema: 'pd42-captured-tool-texts/1',
  source: 'pinned @deepseek-ai/dsh-tool-bash-persistent 0.2.0-rc.2 (baseline 639ed01539), apply() + registered definition.execute(), stub PTY',
  capturedAtUtc: new Date().toISOString(),
  captures,
}, null, 2)}\n`)

for (const [name, text] of Object.entries(captures)) {
  console.log(`=== ${name} ===`)
  console.log(JSON.stringify(text))
}
