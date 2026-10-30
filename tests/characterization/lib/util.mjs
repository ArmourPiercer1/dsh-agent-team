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
import { createConnection, createServer } from 'node:net'
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
 * True when something is already listening on 127.0.0.1:<port>.
 *
 * CLASSIFICATION — three outcomes, the third one resolved, never guessed:
 *   connect answers  → TRUE   (a real listener accepted: the fast path)
 *   connect errors   → FALSE  (ECONNREFUSED etc. — the stack said "nobody home")
 *   connect TIMEOUT  → INCONCLUSIVE → decided by a one-shot BIND probe
 *                      (`net.createServer().listen(port,'127.0.0.1')`):
 *                      EADDRINUSE → TRUE, bind succeeds → close → FALSE.
 *
 * WHY THE TIMEOUT IS NO LONGER CALLED "IN USE" (dated 2026-10-30 real UTC;
 * the measurements below are reproduced in this tree at
 * dev/agent-workflow/evidence/a5w-portprobe-20261030/
 * rca1-portprobe-verification.md — the upstream boot-wave RCA-1 it confirms
 * lives on branch task/a5w-bootwave-20261030, not here). On this executor —
 * WSL "mirrored" networking — a SYN to a CLOSED loopback port is black-holed
 * instead of answered with a RST, so
 * the connect leg times out for EVERY free port in the sanctioned bands
 * (measured: 3491/3493/13050/13099 all "timed out" at 1500ms while an
 * `/proc/net/tcp` state-0A census showed zero listeners, while a connect to
 * the real :3080 listener completed in 2ms). Calling that timeout "in use"
 * made `acquirePortLease`'s second guard (tests/world-factory/lib/
 * port-lease.mjs) refuse the entire mock band 3491..13099 with EXTERNAL_BIND
 * and kill every World boot BEFORE spawn — two boot waves, zero real starts.
 * A bind probe answers the same question from the local kernel rather than
 * from the network path, so it is conclusive on this box (measured: bind-ok
 * 3493/13055 in ~6ms, EADDRINUSE on the real :3080 listener in 4ms) — the
 * same probe the boot dry-run already used, which is why the dry-run could
 * say "3491 free" while the connect probe said "busy".
 *
 * DISCLOSED RESIDUAL WINDOW. A listener bound ONLY to a non-loopback
 * interface whose backlog never answers a loopback SYN would bind successfully
 * here and be reported FREE — no probe distinguishes it from a black-holed
 * closed port. No such listener exists on this box (RCA-1 census: the only
 * listeners were :3080, :53 ×3), and ordinary listeners — including
 * 0.0.0.0-bound ones — are still caught by the connect fast path, which
 * answers before the bind probe is ever reached. Bind failures that prove
 * nothing about a listener (EACCES/EPERM, or the probe never answering) stay
 * FAIL-CLOSED: reported IN USE, so a caller never takes a port we cannot
 * prove free.
 *
 * Side effect, disclosed: on the inconclusive path only, this function really
 * binds the port for a few milliseconds before closing it.
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
    setTimeout(() => {
      if (settled) return
      // Inconclusive: freeze the connect verdict, let the kernel arbitrate.
      settled = true
      socket.destroy()
      bindProbeInUse(port, timeoutMs).then(resolve)
    }, timeoutMs)
  })
}

/**
 * The tie-breaker for an inconclusive connect probe: try to own the port.
 * TRUE = the port is taken (EADDRINUSE) or we cannot prove otherwise
 * (any other bind error, or the bind never answering — fail-closed);
 * FALSE = we bound it and gave it back.
 */
function bindProbeInUse(port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const probe = createServer()
    let settled = false
    let listening = false
    const finish = (value) => {
      if (settled) return
      settled = true
      clearTimeout(watchdog)
      if (!listening) {
        resolve(value)
        return
      }
      listening = false
      try {
        probe.close(() => resolve(value))
      } catch {
        resolve(value)
      }
    }
    // The bind leg is local and answers in single-digit ms; it gets a FLOOR of
    // its own so a caller's tiny connect timeout can never preempt the answer
    // (a preempted probe would fail closed to "in use" on every free port).
    const watchdog = setTimeout(() => finish(true), Math.max(timeoutMs, 1000))
    probe.once('error', () => finish(true)) // EADDRINUSE = held; anything else proves nothing
    probe.once('listening', () => {
      listening = true
      finish(false)
    })
    try {
      probe.listen(port, '127.0.0.1')
    } catch {
      finish(true) // synchronous throw: cannot prove free — fail closed
    }
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
