#!/usr/bin/env node
/**
 * bounded-run.mjs — a lifetime/ownership wrapper for ONE bounded harness run.
 *
 * WHY THIS EXISTS. `run.mjs` bounds each step (boot 120s, stop 15s, per-fetch
 * aborts) and stops its instance in a `finally`, but it has no wall-clock cap
 * independent of its own waits and no way to reap descendants: `instance.stop()`
 * kills the direct child only. If the harness itself wedges, nothing releases the
 * host it owns. Rather than invent a second control plane, this wrapper reuses the
 * repo's sanctioned ownership contract (`tests/kits/rc2-real-host-smoke/run-control.mjs`):
 * the wrapper is the OWNER, it binds ONLY its own detached child's POSIX process
 * group, an independent watchdog bounds the lifetime, and every exit path goes
 * through `stopChild()` (SIGTERM the group, then SIGKILL the group). It never kills
 * by port scan or pattern match.
 *
 * Usage:
 *   node bounded-run.mjs --port <3180-3186|3491-3500> \
 *     --max-child-lifetime-ms <n> [--log <file>] -- <command> [args...]
 *
 * stdout carries exactly one JSON result line; the child's own output goes to the
 * log file. Exit status: the child's code, 2 if the watchdog fired, 3 for an
 * invalid invocation (nothing spawned).
 */
import { openSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRunControl } from '../../../../tests/kits/rc2-real-host-smoke/run-control.mjs'

/** Ports this repo's test infrastructure is allowed to bind (TEST_METHODS §2). */
const PORT_RANGES = [[3180, 3186], [3491, 3500]]
const MAX_LIFETIME_MS = 900_000

function parseArgv(argv) {
  const out = { port: null, lifetimeMs: null, logPath: null, cmd: null }
  const i = argv.indexOf('--')
  const flags = i === -1 ? argv : argv.slice(0, i)
  if (i === -1 || i === argv.length - 1) throw new Error('expected "-- <command> [args...]"')
  out.cmd = argv.slice(i + 1)
  for (let k = 0; k < flags.length; k += 2) {
    const key = flags[k]
    const val = flags[k + 1]
    if (val === undefined) throw new Error(`missing value for ${key}`)
    if (key === '--port') out.port = Number(val)
    else if (key === '--max-child-lifetime-ms') out.lifetimeMs = Number(val)
    else if (key === '--log') out.logPath = val
    else throw new Error(`unknown flag: ${key}`)
  }
  if (!Number.isInteger(out.port)) throw new Error('--port must be an integer')
  if (!PORT_RANGES.some(([lo, hi]) => out.port >= lo && out.port <= hi)) {
    throw new Error(`--port ${out.port} is outside the sanctioned test ranges ${JSON.stringify(PORT_RANGES)}`)
  }
  if (!Number.isInteger(out.lifetimeMs) || out.lifetimeMs < 1000 || out.lifetimeMs > MAX_LIFETIME_MS) {
    throw new Error(`--max-child-lifetime-ms must be an integer in 1000..${MAX_LIFETIME_MS}`)
  }
  return out
}

async function main(argv) {
  let args
  try {
    args = parseArgv(argv)
  } catch (error) {
    process.stderr.write(`bounded-run: refusing to start — ${error.message}\n`)
    return { ok: false, stage: 'validate', reason: error.message }
  }
  const startedAt = Date.now()
  const fds = args.logPath
    ? { out: openSync(args.logPath, 'a'), err: openSync(args.logPath, 'a') }
    : undefined
  const rc = createRunControl({
    log: (line) => process.stderr.write(`${line}\n`),
    limits: { childLifetimeMs: args.lifetimeMs },
  })
  rc.installSignalHandlers()
  rc.arm()
  let child
  try {
    child = spawn(args.cmd[0], args.cmd.slice(1), {
      detached: true, // own POSIX group, so the group kill reaches the host it spawns
      stdio: fds ? ['ignore', fds.out, fds.err] : ['ignore', 'ignore', 'ignore'],
    })
  } catch (error) {
    rc.dispose()
    return { ok: false, stage: 'spawn', reason: error.message }
  }
  if (child.pid === undefined) {
    rc.dispose()
    return { ok: false, stage: 'spawn', reason: 'child has no pid (spawn failed)' }
  }
  rc.bindChild(child, { lifetimeMs: args.lifetimeMs, watchdogIntervalMs: 500, processGroup: true })
  const exitInfo = await new Promise((resolveExit) => {
    child.once('exit', (code, signal) => resolveExit({ code, signal }))
    child.once('error', (error) => resolveExit({ code: null, signal: 'spawn-error', message: error.message }))
  })
  // Always run the owned cleanup: the leader can exit while a group descendant
  // (the host it spawned) lives on, and group liveness — not leader exit — decides.
  let stopped = { escalated: false, pid: child.pid }
  try {
    stopped = await rc.stopChild({ graceMs: 2_000, killWaitMs: 10_000 })
  } catch (error) {
    rc.dispose()
    return { ok: false, stage: 'cleanup', reason: error.message, exitCode: exitInfo.code }
  }
  const report = rc.dispose()
  const watchdogFired = report.watchdogFired === true
  return {
    ok: exitInfo.code === 0 && !watchdogFired,
    stage: 'done',
    pid: child.pid,
    exitCode: exitInfo.code,
    signal: exitInfo.signal ?? null,
    watchdogFired,
    groupEscalatedToKill: stopped.escalated === true,
    violation: report.violation?.detail ?? null,
    port: args.port,
    lifetimeCapMs: args.lifetimeMs,
    elapsedMs: Date.now() - startedAt,
    ...(exitInfo.message ? { spawnError: exitInfo.message } : {}),
  }
}

const result = await main(process.argv.slice(2))
process.stdout.write(`${JSON.stringify(result)}\n`)
process.exit(result.ok ? 0 : result.stage === 'validate' ? 3 : result.watchdogFired ? 2 : (result.exitCode ?? 1))
