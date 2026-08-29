#!/usr/bin/env node
/**
 * spawn-probe — minimal empirical probe of the workspace-write sandbox's
 * child-process stdio restrictions (P2-T1).
 *
 * TEST_METHODS §5 records (measured 2026-08-29):
 *   (b) any node-initiated piped-stdio child spawn -> EPERM errno -4048
 *       (node->node, node->git, esbuild all hit);
 *   `stdio: 'inherit'` spawns work (upstream scripts/build.ts precedent);
 *   (c) pwsh-layer spawns are unrestricted.
 * Unmeasured before this task: file-fd stdio (pass an fs.openSync() fd as a
 * stdio entry). This probe measures four variants so the characterization
 * harness can pick its instance-lifecycle mechanism on evidence:
 *
 *   P1  node child, stdio 'pipe'             (documented expectation: EPERM)
 *   P2  node child, stdio [ignore, fd, fd]   fd = fs.openSync(log, 'a')
 *   P3  node child, stdio 'inherit'          (documented-working baseline)
 *   P4  git child,  stdio [ignore, fd, fd]   (in-process git snapshots)
 *
 * Plain Node ESM, zero dependencies; every attempt is wrapped so one failure
 * never aborts the probe. Output: one line per probe with an OK/DENIED verdict
 * and a `VERDICT:` summary. Exit 0 = probe completed (regardless of which
 * variants succeeded); exit 2 = internal error.
 *
 * Run: node tests/characterization/spawn-probe.mjs [outDir]
 */
import { spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'

const outRoot = resolve(process.argv[2] || '.')
const probeDir = join(outRoot, `spawn-probe-${new Date().toISOString().replace(/[:.]/g, '-')}`)
mkdirSync(probeDir, { recursive: true })
rmSync(probeDir, { recursive: true, force: true })
mkdirSync(probeDir, { recursive: true })

const verdicts = {}

/**
 * Run one spawn attempt with a 10s watchdog. `build` receives the log path and
 * returns the child (or throws); the child's own fds, if any, must already be
 * closed by the caller before resolve (the watchdog is the only remaining
 * timer). `readLog` lets callers report what the child wrote to its log file.
 */
function attempt(label, build, readLog) {
  const logPath = join(probeDir, `${label}.log`)
  writeFileSync(logPath, '')
  return new Promise((resolveResult) => {
    let settled = false
    const finish = (ok, detail) => {
      if (settled) return
      settled = true
      clearTimeout(watchdog)
      let logged = ''
      try {
        logged = readLog(logPath)
      } catch {
        logged = '<log unreadable>'
      }
      verdicts[label] = ok
      console.log(`${label.padEnd(16)} : ${ok ? 'OK    ' : 'DENIED'} — ${detail}${logged ? ` ; log=${JSON.stringify(logged)}` : ''}`)
      resolveResult(ok)
    }
    let watchdog
    let child
    try {
      child = build(logPath)
      watchdog = setTimeout(() => finish(false, 'probe timeout (10s)'), 10_000)
    } catch (error) {
      return finish(false, `spawn() threw synchronously: ${error instanceof Error ? error.message : String(error)}`)
    }
    child.on('error', (error) => finish(false, `spawn error event: ${error instanceof Error ? `${error.code ?? ''} ${error.message}`.trim() : String(error)}`))
    child.on('close', (code, signal) => finish(code === 0, `exit ${code}${signal ? ` signal ${signal}` : ''}`))
  })
}

const readLog = (logPath) => readFileSync(logPath, 'utf8')

async function main() {
  const childCode = 'process.stdout.write("probe-child-ok\\n")'

  // P1 — piped stdio (the documented EPERM case).
  await attempt(
    'P1-piped-node',
    () => spawn(process.execPath, ['-e', childCode], { stdio: ['ignore', 'pipe', 'pipe'], cwd: probeDir }),
    readLog,
  )

  // P2 — node child with file-fd stdio (stdout+stderr -> log file).
  await attempt(
    'P2-filefd-node',
    (logPath) => {
      const fd = openSync(logPath, 'a')
      const child = spawn(process.execPath, ['-e', childCode], { stdio: ['ignore', fd, fd], cwd: probeDir })
      child.once('error', () => closeSync(fd))
      child.once('close', () => closeSync(fd))
      return child
    },
    readLog,
  )

  // P3 — inherit stdio (documented-working baseline; child output lands on the
  // probe's own stdout and is NOT capturable — that asymmetry is the point).
  await attempt(
    'P3-inherit-node',
    () => spawn(process.execPath, ['-e', childCode], { stdio: 'inherit', cwd: probeDir }),
    () => '<inherit: not captured>',
  )

  // P4 — git child with file-fd stdio (decides whether run.mjs can take git
  // snapshots itself, in one command, in the sandbox).
  await attempt(
    'P4-filefd-git',
    (logPath) => {
      const outFd = openSync(logPath, 'a')
      const errFd = openSync(logPath, 'a')
      const child = spawn('git', ['status', '--porcelain'], { stdio: ['ignore', outFd, errFd], cwd: process.cwd() })
      child.once('error', () => { closeSync(outFd); closeSync(errFd) })
      child.once('close', () => { closeSync(outFd); closeSync(errFd) })
      return child
    },
    readLog,
  )

  console.log('')
  const line = (label) => `${label}=${verdicts[label] ? 'ok' : 'denied'}`
  console.log(`VERDICT: ${['P1-piped-node', 'P2-filefd-node', 'P3-inherit-node', 'P4-filefd-git'].map(line).join(' ')}`)
  console.log(`PROBE-DIR: ${probeDir}`)
  return 0
}

main().then(
  (code) => { process.exitCode = code },
  (error) => {
    console.error(`probe internal error: ${error instanceof Error ? error.stack : String(error)}`)
    process.exitCode = 2
  },
)
