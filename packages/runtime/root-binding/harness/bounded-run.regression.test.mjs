import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TEST_PORT_RANGES, isSanctionedTestPort } from '../../../../tests/paths.mjs'

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

/**
 * PORT LEDGER. The pre-flight for the first bounded harness run found the
 * root-binding harness binding its mini-MCP server on 3481-3485 — outside this
 * repo's own documented policy (docs/TEST_METHODS.md: 3180-3186 / 3491-3500,
 * never :3080). Nothing would have failed had it stayed there; the run would just
 * have bound a port nobody sanctioned. So the ranges moved to tests/paths.mjs and
 * this ledger checks every live runner that reaches for a port. Historical
 * evidence scripts under dev/agent-workflow/evidence are deliberately out of
 * scope: they are records, not entry points we launch.
 */
const RUNNERS = [
  'packages/runtime/root-binding/harness/run.mjs',
  'packages/runtime/member-residency/harness/run.mjs',
  'packages/tools/harness/t12-vertical.mjs',
  'tests/kits/f15-mcp-live-loss-smoke/f15-mcp-live-loss-smoke.mjs',
]
const REPO_ROOT = new URL('../../../../', import.meta.url).pathname

/**
 * Resolve a port candidate — a literal, an array, or a chain of consts
 * (`mcpCandidates` → `args.mcpPorts ?? DEFAULT_MCP_PORT_CANDIDATES`) — to every
 * number it can bind. Unresolvable is a FAILURE, not a skip: a ledger that
 * quietly ignores what it cannot parse is exactly how 3481 survived.
 * @returns {number[]}
 */
function resolvePorts(src, token, hops = 0) {
  if (/^\d+$/.test(token)) return [Number(token)]
  if (token.startsWith('[')) {
    return token.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean)
      .flatMap((x) => resolvePorts(src, x, hops + 1))
  }
  if (hops > 3) return []
  const decl = new RegExp(`(?:const|let)\\s+${token}\\s*=([^;\\n]*)`).exec(src)
  const expr = (decl?.[1] ?? '').trim()
  if (expr === '') return []
  const arrayLiteral = /(?:Object\.freeze\(\s*)?\[([^\]]*)\]/.exec(expr)
  if (arrayLiteral) {
    return arrayLiteral[1].split(',').map((x) => x.trim()).filter(Boolean).map(Number)
  }
  const tail = (expr.split('??').pop() ?? '').trim()
  if (/^\d+$/.test(tail)) return [Number(tail)]
  const next = /^[A-Za-z_$][\w$]*$/.test(tail) ? tail : null
  return next ? resolvePorts(src, next, hops + 1) : []
}

test('every mini-MCP port a live runner can bind is inside the sanctioned ranges', () => {
  const found = []
  for (const rel of RUNNERS) {
    const src = readFileSync(join(REPO_ROOT, rel), 'utf8')
    // Both the direct call and the retry helper the f15 kit uses. A `function`
    // definition line is skipped: its `candidates` parameter carries no port —
    // the caller does, and the caller is matched separately below.
    const sites = [...src.matchAll(/start(?:MiniMcpServer|MiniMcpWithRetry)\(\s*(\[[^\]]*\]|[A-Za-z_$][\w$]*)/g)]
      .filter((site) => !/function\s*$/.test(src.slice(Math.max(0, site.index - 20), site.index)))
    assert.ok(sites.length >= 1, `${rel}: no port-taking call site found — update RUNNERS or the ledger is lying`)
    for (const site of sites) {
      // A call inside a helper may pass its own parameter (`startMiniMcpServer
      // (candidates)` inside `startMiniMcpWithRetry(candidates, …)`). That name
      // carries no port here — its caller does, and the caller is a separate
      // matched site. Any OTHER unresolvable name is still a hard failure.
      const head = src.slice(Math.max(0, site.index - 600), site.index)
      const params = [...head.matchAll(/function\s+\w*\s*\(([^)]*)\)/g)].pop()?.[1] ?? ''
      if (/^[A-Za-z_$][\w$]*$/.test(site[1]) && params.split(',').map((p) => p.trim()).includes(site[1])) continue
      const ports = resolvePorts(src, site[1])
      assert.ok(ports.length >= 1, `${rel}: cannot resolve the port candidate "${site[1]}" — the ledger must not skip what it cannot parse`)
      for (const port of ports) {
        assert.ok(Number.isInteger(port), `${rel}: non-numeric port candidate in "${site[1]}"`)
        assert.equal(isSanctionedTestPort(port), true, `${rel}: mini-MCP candidate ${port} is outside TEST_PORT_RANGES ${JSON.stringify(TEST_PORT_RANGES)}`)
        found.push(`${rel}:${port}`)
      }
    }
  }
  assert.ok(found.length >= 12, `expected every candidate of every known list, got ${JSON.stringify(found)}`)
})

test('the ledger detects the drift it exists for (negative control)', () => {
  // The real 3481-3485 list, as it was written before this fix. If the resolver
  // cannot see it, the ledger above is vacuous and says nothing about safety.
  const drifted = 'const mini = await startMiniMcpServer([3481, 3482, 3483, 3484, 3485])'
  const ports = resolvePorts(drifted, '[3481, 3482, 3483, 3484, 3485]')
  assert.deepEqual(ports, [3481, 3482, 3483, 3484, 3485])
  assert.equal(ports.some((p) => !isSanctionedTestPort(p)), true, 'the drifted list must be flagged')
  // And an indirection chain resolves to the sanctioned default, not to nothing.
  const fixed = `
    const DEFAULT_MCP_PORT_CANDIDATES = Object.freeze([3496, 3497, 3498, 3499, 3500])
    const mcpCandidates = args.mcpPorts ?? DEFAULT_MCP_PORT_CANDIDATES
    const mini = await startMiniMcpServer(mcpCandidates)
  `
  assert.deepEqual(resolvePorts(fixed, 'mcpCandidates'), [3496, 3497, 3498, 3499, 3500])
})

test('the harness itself refuses a port outside the sanctioned ranges before binding', () => {
  const res = spawnSync(process.execPath, [
    join(REPO_ROOT, 'packages/runtime/root-binding/harness/run.mjs'),
    '--report-dir', join(dir, 'unused'), '--scenarios', 'S1', '--port', '3481',
  ], { encoding: 'utf8' })
  assert.notEqual(res.status, 0, 'an unsanctioned port must not be accepted')
  assert.match(`${res.stderr}${res.stdout}`, /sanctioned test ranges/)
})

