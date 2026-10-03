import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Guards for `bounded-run.mjs`, the lifetime/ownership wrapper used in front of
 * every bounded harness run on this branch. These tests never boot a host: they
 * prove the three properties a bounded run depends on BEFORE any host is started.
 *
 *   1. it refuses to start outside the sanctioned port ranges (nothing spawned),
 *   2. when the lifetime cap expires it kills the group it OWNS — including a
 *      descendant that ignores SIGTERM — while an unrelated process in another
 *      group survives (so cleanup is by ownership, never a port scan or pattern
 *      match that could hit someone else's instance),
 *   3. the child's own exit status is passed through, and no watchdog survives it.
 */

const WRAPPER = new URL('./bounded-run.mjs', import.meta.url).pathname
const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const runWrapper = (args) => spawnSync(process.execPath, [WRAPPER, ...args], { encoding: 'utf8' })

/** A leader that ignores SIGTERM and keeps a stubborn descendant alive in its group. */
const STUB = `
const { spawn } = require('node:child_process');
const fs = require('node:fs');
process.on('SIGTERM', () => {});
const kid = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], { stdio: 'ignore' });
fs.writeFileSync(process.env.STUB_PID_FILE, JSON.stringify({ leader: process.pid, kid: kid.pid }));
setInterval(() => {}, 1000);
`

const dir = mkdtempSync(join(tmpdir(), 'bounded-run-guard-'))
test.after(() => rmSync(dir, { recursive: true, force: true }))

test('a port outside the sanctioned test ranges is refused before anything spawns', () => {
  const logPath = join(dir, 'refused.log')
  const res = runWrapper(['--port', '9999', '--max-child-lifetime-ms', '5000', '--log', logPath, '--', process.execPath, '-e', 'void 0'])
  assert.equal(res.status, 3, `expected refusal exit 3, got ${res.status}: ${res.stderr}`)
  const report = JSON.parse(res.stdout)
  assert.equal(report.stage, 'validate')
  assert.match(report.reason, /sanctioned test ranges/)
  assert.equal(existsSync(logPath), false, 'a refused invocation must not even create its log file')
})

test('the lifetime cap kills the owned group, not a bystander', async () => {
  const pidFile = join(dir, 'stub-pids.json')
  const decoy = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' })
  try {
    const started = Date.now()
    const res = spawnSync(process.execPath, [
      WRAPPER, '--port', '3491', '--max-child-lifetime-ms', '1500',
      '--', process.execPath, '-e', STUB,
    ], { encoding: 'utf8', env: { ...process.env, STUB_PID_FILE: pidFile } })
    const elapsed = Date.now() - started

    assert.equal(res.status, 2, `watchdog expiry must exit 2, got ${res.status}: ${res.stderr}`)
    const report = JSON.parse(res.stdout)
    assert.equal(report.watchdogFired, true, 'the independent watchdog must be the cause')
    assert.equal(report.groupEscalatedToKill, true, 'a group that ignores SIGTERM must be escalated to SIGKILL')
    assert.equal(report.port, 3491)
    assert.ok(elapsed < 60_000, `the cap must converge, took ${elapsed}ms`)

    const stub = JSON.parse(readFileSync(pidFile, 'utf8'))
    assert.equal(alive(stub.kid), false, 'a SIGTERM-ignoring descendant inside our group must be reaped')
    assert.equal(alive(stub.leader), false, 'the owned leader must be reaped')
    assert.equal(alive(decoy.pid), true, 'a process in another group must survive — cleanup is by ownership, not by scanning')
  } finally {
    decoy.kill('SIGKILL')
  }
})

test('a child failure passes its status through and leaves no watchdog behind', () => {
  const logPath = join(dir, 'fail.log')
  writeFileSync(logPath, '')
  const res = runWrapper([
    '--port', '3492', '--max-child-lifetime-ms', '5000', '--log', logPath,
    '--', process.execPath, join(dir, 'no-such-script.mjs'),
  ])
  assert.notEqual(res.status, 0, 'a failing child must not be reported as success')
  const report = JSON.parse(res.stdout)
  assert.equal(report.stage, 'done')
  assert.equal(report.watchdogFired, false, 'an ordinary failure is not a lifetime violation')
  assert.notEqual(report.exitCode, 0)
  assert.equal(report.ok, false)
})
