/**
 * Characterization harness — shared low-level helpers.
 *
 * Everything in this file runs under plain Node with ZERO third-party
 * dependencies and respects the workspace-write sandbox matrix
 * (TEST_METHODS §5): the only spawn mechanism used anywhere in the harness
 * is file-fd stdio (an fs.openSync() fd passed as a stdio entry), which the
 * P2-T1 spawn probe (tests/characterization/spawn-probe.mjs, P2/P4) proved
 * works in-sandbox. Piped-stdio spawn is EPERM and never used.
 */
import { closeSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'
import { join } from 'node:path'

/** Read-only recursive file walker (skips the given directory basenames). */
export function* walk(root, skipNames) {
  const skip = skipNames instanceof Set ? skipNames : new Set(skipNames ?? [])
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        if (!skip.has(entry.name)) stack.push(full)
      } else if (st.isFile()) {
        yield { path: full, name: entry.name }
      }
    }
  }
}

/**
 * Spawn `command args` with stdout+stderr redirected to `logPath` via file
 * fds (the sandbox-legal mechanism). Resolves with a plain-data result —
 * never a child-process handle — so callers cannot leak live handles.
 *
 * @returns {Promise<{ok: boolean, exitCode: number|null, error: string, text: string}>}
 */
export function spawnToLog(command, args, options) {
  const { cwd, env = {}, logPath, timeoutMs = 60_000 } = options
  return new Promise((resolve) => {
    writeFileSync(logPath, '', { flag: 'w' })
    let outFd
    let errFd
    let child
    let settled = false
    let watchdog
    let fdsClosed = false
    const closeFds = () => {
      // Idempotent: a failed spawn fires both 'error' and 'close', and the
      // watchdog path may race either; double closeSync throws EBADF.
      if (fdsClosed) return
      fdsClosed = true
      try {
        closeSync(outFd)
      } catch {
        /* already closed */
      }
      try {
        closeSync(errFd)
      } catch {
        /* already closed */
      }
    }
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(watchdog)
      let text = ''
      try {
        text = readFileSync(logPath, 'utf8')
      } catch {
        text = '<log unreadable>'
      }
      resolve({ ...result, text })
    }
    try {
      outFd = openSync(logPath, 'a')
      errFd = openSync(logPath, 'a')
    } catch (error) {
      return finish({ ok: false, exitCode: null, error: `openSync failed: ${error.message}` })
    }
    try {
      child = spawn(command, args, {
        stdio: ['ignore', outFd, errFd],
        cwd,
        env: { ...process.env, ...env },
      })
    } catch (error) {
      closeFds()
      return finish({ ok: false, exitCode: null, error: `spawn threw: ${error.message}` })
    }
    child.on('error', (error) => {
      closeFds()
      finish({ ok: false, exitCode: null, error: `spawn error: ${error.code ?? ''} ${error.message}`.trim() })
    })
    child.on('close', (code, signal) => {
      closeFds()
      finish({ ok: code === 0, exitCode: code, error: signal ? `terminated by signal ${signal}` : '' })
    })
    watchdog = setTimeout(() => {
      try {
        child.kill()
      } catch {
        /* already gone */
      }
      finish({ ok: false, exitCode: null, error: `timeout after ${timeoutMs}ms` })
    }, timeoutMs)
  })
}

/**
 * True when something is already listening on 127.0.0.1:<port>. Uses a plain
 * TCP connect (no spawn, no bind). A connect timeout is treated
 * conservatively as "in use".
 */
export function portInUse(port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' })
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(value)
    }
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    setTimeout(() => finish(true), timeoutMs)
  })
}

/** Wait until the port stops answering, up to `timeoutMs`. */
export async function waitForPortFree(port, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (!(await portInUse(port))) return true
    if (Date.now() >= deadline) return false
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
}

/** Tail of a log file (up to `lines` last lines) — for failure reports. */
export function logTail(logPath, lines = 12) {
  try {
    const text = readFileSync(logPath, 'utf8')
    return text.split('\n').slice(-lines).join('\n')
  } catch {
    return '<log unreadable>'
  }
}

/**
 * Poll `logPath` until `pattern` matches its content or `deadline` passes.
 * Returns the matched line (or null).
 */
export async function waitForLogLine(logPath, pattern, timeoutMs = 60_000, alive = () => true) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      const text = readFileSync(logPath, 'utf8')
      for (const line of text.split('\n')) {
        if (pattern.test(line)) return line
      }
    } catch {
      /* not written yet */
    }
    if (Date.now() >= deadline || !alive()) return null
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}
