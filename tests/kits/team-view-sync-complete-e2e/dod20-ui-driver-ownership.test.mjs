/**
 * dod20-ui-driver-ownership.test.mjs — OFFLINE focused tests for the live lane's BROWSER
 * OWNERSHIP boundary (node --test; no browser, no host, no network, no ports).
 *
 *   node --test tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-ownership.test.mjs
 *
 * Why this file exists: the live lane used to identify "its" Chrome by diffing a snapshot of
 * every /proc cmdline containing the --chrome path, and its teardown SIGKILLed every pid in that
 * list. A Chrome the operator (or a parallel session) started after the snapshot was therefore
 * claimable and killable by this run. The lane now owns exactly one handle — the ChildProcess that
 * `chromium.launchServer({ host: '127.0.0.1', port: 0, … }).process()` returned — and reaches it
 * only through `browser.close()` (our connection), `server.close()` (graceful) and `server.kill()`
 * (forced). These tests pin that boundary:
 *   1. identity of the owned handle (exact exe + real argv + pipe transport, no CDP port, no weak
 *      flags) — a failed identity is fatal, there is no negative-then-continue path;
 *   2. the Playwright control server is provably bound to a loopback LITERAL (the endpoint string
 *      is composed from the actual bound address — see coreBundle.js:9640-9662), recorded only as a
 *      redacted shape;
 *   3. teardown reports graceful and forced separately, and a hung `close()` escalates to `kill()`;
 *   4. a CONCURRENT unrelated process (a real decoy child of this test) is never touched by
 *      teardown, in either the graceful or the forced path;
 *   5. a source-level lock: the snapshot-claim and list-kill code is gone for good.
 * Everything here is pure/unit level. It does NOT replace the live Chrome acceptance run; it only
 * proves the ownership boundary cannot reach a process this run did not launch.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
  browserHandleIdentity,
  browserServerEndpointGuard,
  teardownBrowserHandle,
} from './dod20-ui-driver.mjs'

const CHROME = '/opt/google/chrome/chrome'
// Faithful sample of the argv the owned main process exposes (the recorded live-run shape:
// real Chrome path, pipe transport, headless, NO weak flags, NO CDP port).
const GOOD_ARGV = [
  CHROME,
  '--remote-debugging-pipe',
  '--headless=new',
  '--disable-background-networking',
  '--user-data-dir=/srv/workspace/dsh-plugins/dsh-agent-team/.private-raw-evidence/ui-gate-2/x/home/.dsh-ui-profile',
  'about:blank',
]
const goodIdentity = (over = {}) => browserHandleIdentity({
  pid: 4242, exeReal: CHROME, argv: GOOD_ARGV.slice(), chromeReal: CHROME, ...over,
})

// ── 1. owned-handle identity ────────────────────────────────────────────────────────────────
test('identity: the owned handle passes and reports the pipe transport', () => {
  const r = goodIdentity()
  assert.deepEqual(r.problems, [], r.problems.join(';'))
  assert.equal(r.ok, true)
  assert.deepEqual(r.weakFlagsFound, [])
  assert.deepEqual(r.pipeTransport, { remoteDebuggingPipe: true, remoteDebuggingPort: false })
})

test('identity: a weak flag on the owned handle is a hard failure', () => {
  for (const weak of ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu-sandbox', '--disable-web-security', '--disable-seccomp-filter-sandbox']) {
    const r = goodIdentity({ argv: GOOD_ARGV.concat(weak) })
    assert.equal(r.ok, false, weak + ' must not pass')
    assert.ok(r.problems.some((p) => p.startsWith('browser-weak-flags:')), r.problems.join(';'))
    assert.deepEqual(r.weakFlagsFound, [weak])
  }
})

test('identity: a CDP debug port on the owned handle is a hard failure (pipe is the only transport)', () => {
  const r = goodIdentity({ argv: GOOD_ARGV.concat('--remote-debugging-port=9222') })
  assert.equal(r.ok, false)
  assert.ok(r.problems.includes('browser-remote-debugging-port-present'))
  assert.equal(r.pipeTransport.remoteDebuggingPort, true)
})

test('identity: no pipe transport, unreadable argv/exe, or a different executable is a hard failure', () => {
  assert.ok(goodIdentity({ argv: GOOD_ARGV.filter((a) => a !== '--remote-debugging-pipe') }).problems.includes('browser-remote-debugging-pipe-absent'))
  assert.ok(goodIdentity({ argv: [] }).problems.includes('browser-handle-argv-unreadable'))
  assert.ok(goodIdentity({ exeReal: '' }).problems.includes('browser-handle-exe-unreadable'))
  const mismatch = goodIdentity({ exeReal: '/home/attacker/chrome' })
  assert.equal(mismatch.ok, false)
  assert.ok(mismatch.problems.some((p) => p.startsWith('browser-handle-exe-mismatch:')))
  for (const pid of [null, 0, 1, '123', undefined]) {
    assert.ok(goodIdentity({ pid }).problems.includes('browser-handle-pid-invalid'), `pid ${String(pid)} must be invalid`)
  }
})

// ── 2. the control server is loopback-bound ─────────────────────────────────────────────────
test('control server: a loopback-literal endpoint passes and is recorded as a redacted shape', () => {
  const r = browserServerEndpointGuard('ws://127.0.0.1:41234/5f2c1a9b-7788-4a0e-9d1f-0a1b2c3d4e5f')
  assert.equal(r.ok, true, r.problems.join(';'))
  assert.equal(r.host, '127.0.0.1')
  assert.equal(r.port, 41234)
  assert.equal(r.shape, 'ws://127.0.0.1:41234/<redacted-guid>')
  assert.ok(!r.shape.includes('5f2c1a9b'), 'the session guid must never be recordable')
  assert.equal(browserServerEndpointGuard('ws://[::1]:41234/abc').ok, true, 'IPv6 loopback literal is loopback')
})

test('control server: hostname, wildcard, or routable bind is a hard failure', () => {
  for (const ep of [
    'ws://localhost:41234/abc',        // a name, not a literal: resolution decides the interface
    'ws://0.0.0.0:41234/abc',          // all interfaces — would also disable Host/Origin checks
    'ws://192.168.1.20:41234/abc',     // the LAN
    'ws://10.0.0.5:41234/abc',
    'ws://[::]:41234/abc',             // IPv6 wildcard
    'http://127.0.0.1:41234/abc',      // not ws:
    'ws://127.0.0.1/abc',              // no port => cannot assert the bind
    '', null, undefined, 'garbage',
  ]) {
    const r = browserServerEndpointGuard(ep)
    assert.equal(r.ok, false, `${String(ep)} must not pass`)
    assert.ok(r.problems.length > 0)
  }
})

// ── 3/4. teardown: graceful vs forced, and a concurrent process stays untouched ─────────────
const fakeServer = ({ pid = 4242, closeBehaviour = 'resolves', alive = () => false } = {}) => {
  const calls = []
  return {
    calls,
    process: () => ({ pid }),
    wsEndpoint: () => 'ws://127.0.0.1:41234/guid',
    close: async () => {
      calls.push('close')
      if (closeBehaviour === 'hangs') return new Promise(() => {})
      if (closeBehaviour === 'throws') throw new Error('close exploded')
      if (closeBehaviour === 'resolves-but-alive') return   // claims success while the process lives
      alive.dead = true
    },
    kill: async () => { calls.push('kill'); alive.dead = true },
  }
}
const aliveState = (live) => {
  const st = { dead: !live }
  return { st, isAlive: () => !st.dead }
}
// The driver's real sleep is `(ms) => new Promise(r => setTimeout(r, ms))`, and the tests use the
// same shape so the grace window means what it says: a zero-delay fake would report the deadline as
// expired before the graceful close could settle, which is a fake artifact and not the product path.
const realSleep = (ms) => new Promise((r) => setTimeout(r, ms))
const GRACE = 40

test('teardown: graceful close of the owned handle only — no kill, and a decoy survives', async () => {
  const decoy = spawn('sleep', ['5'], { stdio: 'ignore' })
  try {
    const { st, isAlive } = aliveState(true)
    const server = fakeServer({ alive: st })
    const closed = []
    const rep = await teardownBrowserHandle({
      server, browser: { close: async () => {} },
      contexts: [{ close: async () => { closed.push(1) } }, { close: async () => { closed.push(1) } }],
      sleep: realSleep, isAlive, graceMs: GRACE,
    })
    assert.equal(rep.closePath, 'graceful', JSON.stringify(rep))
    assert.equal(rep.killCalled, false)
    assert.equal(rep.contextsClosed, 2)
    assert.deepEqual(server.calls, ['close'], 'only the owned handle may be signalled')
    assert.equal(rep.aliveAfter, false)
    assert.deepEqual(rep.errors, [])
    assert.equal(decoy.exitCode, null, 'a concurrent unrelated process must still be running')
  } finally { decoy.kill('SIGKILL') }
})

test('teardown: a hung graceful close escalates to kill on the same handle (forced), decoy survives', async () => {
  const decoy = spawn('sleep', ['5'], { stdio: 'ignore' })
  try {
    const { st, isAlive } = aliveState(true)
    const server = fakeServer({ closeBehaviour: 'hangs', alive: st })
    const rep = await teardownBrowserHandle({ server, browser: null, sleep: realSleep, isAlive, graceMs: GRACE })
    assert.equal(rep.closePath, 'forced-after-timeout', JSON.stringify(rep))
    assert.equal(rep.killCalled, true)
    assert.deepEqual(server.calls, ['close', 'kill'], 'graceful first, then force — same handle only')
    assert.equal(rep.aliveAfter, false)
    assert.equal(decoy.exitCode, null, 'a concurrent unrelated process must still be running')
  } finally { decoy.kill('SIGKILL') }
})

test('teardown: close() that throws, or reports success while the process lives, still forces and reports both paths', async () => {
  const throwing = fakeServer({ closeBehaviour: 'throws', alive: { dead: true } })
  const repThrow = await teardownBrowserHandle({ server: throwing, sleep: realSleep, isAlive: () => true, graceMs: GRACE })
  assert.equal(repThrow.killCalled, true)
  assert.ok(repThrow.errors.some((e) => e.startsWith('server-close:')), repThrow.errors.join(';'))
  assert.ok(repThrow.closePath.startsWith('forced-after-failed'), repThrow.closePath)

  const alive = { dead: false }
  const liars = fakeServer({ closeBehaviour: 'resolves-but-alive', alive })
  const repAlive = await teardownBrowserHandle({ server: liars, sleep: realSleep, isAlive: () => !alive.dead, graceMs: GRACE })
  assert.equal(repAlive.closePath, 'graceful-then-not-dead-killed', repAlive.closePath)
  assert.deepEqual(liars.calls, ['close', 'kill'])
})

test('teardown: no handle means nothing to signal — reported, never guessed at', async () => {
  const rep = await teardownBrowserHandle({ server: null, browser: null, sleep: realSleep })
  assert.equal(rep.closePath, 'no-handle')
  assert.equal(rep.killCalled, false)
})

// ── 5. source lock: the snapshot-claim / list-kill mechanism must not come back ──────────────
test('source: the live lane contains no machine-wide Chrome enumeration and no list-based kill', () => {
  const src = readFileSync(new URL('./dod20-ui-driver.mjs', import.meta.url), 'utf8')
  const live = src.slice(src.indexOf('export async function runLiveDriver'))
  for (const forbidden of [
    'listChrome', 'baseline', 'chromeTree', 'mainProc',
    "process.kill(p, 'SIGKILL')", 'readdirSync(\'/proc\')',
  ]) {
    assert.ok(!live.includes(forbidden), `the live lane must not contain ${forbidden} again`)
  }
  assert.ok(live.includes('launchServer('), 'the lane must own the documented BrowserServer handle')
  assert.ok(live.includes('.process()'), 'the lane must take the pid from the handle, not from a scan')
  assert.ok(live.includes("host: '127.0.0.1'"), 'the control server bind must be explicit')
  assert.ok(!/launch\(\{/.test(live), 'plain launch() (no handle) must not return')
})

// ── 6. source lock: the SHARED tests/homes world is provisioned, not overwritten ──────────────
test('source: the shared test home is provisioned exclusively and an existing world is never deleted', () => {
  const host = readFileSync(new URL('./browser-smoke-host.mjs', import.meta.url), 'utf8')
  // Comments may name the retired hazard; the lock applies to executable lines.
  const code = host.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
  assert.ok(!/rmSync\(\s*WORLD/.test(code), 'nothing may rm a world directory: a colliding run used to lose its live world')
  assert.match(code, /function provisionWorldDir /, 'exclusive provisioning must exist')
  assert.match(code, /mkdirSync\(dir\)/, 'provisioning must be an atomic non-recursive mkdirSync')
  assert.match(code, /e && e\.code === 'EEXIST'/, 'an existing name must be refused and fallen forward from, never removed')
  assert.match(code, /refusing to seed a directory this run did not exclusively create/, 'seeding must require our own still-empty directory')
  assert.ok(code.includes('${SRC_WORLD}/.'), 'the copy must write CONTENTS into the empty directory, not nest a subdir')
  assert.ok(!/spawnSync\('cp', \['-r', SRC_WORLD, WORLD\]/.test(code), 'the nested-copy form must be gone')
  assert.match(code, /worldProvision: WORLD_PROVISION/, 'the provisioning decision must be recorded in smoke-host.json')
})
