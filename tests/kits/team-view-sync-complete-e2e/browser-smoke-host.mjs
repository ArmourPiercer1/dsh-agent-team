#!/usr/bin/env node
/**
 * browser-smoke-host.mjs — the SERVED-BUNDLE browser smoke host
 * (PR #35 follow-up, guide §11 E1–E5 / Step H): boots the SAME proven
 * world as the spill E2E kit (seed from the retained mpr smoke world,
 * row patch retargeted to the task worktree dist) and KEEPS it running
 * so a real browser can drive the served client bundle. The seeded mpr
 * world carries only the HOST row (host.js) — the profile gets a second
 * CLIENT row appended (the S8 pattern): the composition-shim package
 * (inert node half + package.json manifest) whose `./client` export IS
 * the built client-bundle.js; without it the dynamic cordis runner never
 * loads the team client half in a browser tab (no 团队 tab, zero
 * /team-remote traffic — the negative result of attempt 1).
 *
 *   E1 — cold member ownership (open the member child fresh;
 *        getReadState(child) = team-member → getProjection(root) —
 *        no prior root visit)
 *   E2 — ordinary session (getReadState = none; NO periodic
 *        getProjection for the ordinary session id)
 *   E3 — lightweight polling (stable team page, ~10s: getReadState
 *        at cadence; getProjection ONLY the cold read)
 *   E4/E5 — live-only / manual-ledger semantics (the browser drives
 *        the UI; the network evidence is the acceptance)
 *
 * The browser leg is driven by the AGENT (browser_* tools) against the
 * printed token URL; this script only owns the host lifecycle:
 *
 *   node browser-smoke-host.mjs --worktree <wt> [--testuse <testuse>]
 *
 * writes smoke-host.json (origin / tokenUrl / world / facts — the
 * launch token is scrubbed BEFORE any retained copy) and prints
 *   READY <tokenUrl>
 * when the route is ready; stays alive until SIGTERM/SIGINT, then
 * tears down (host + mock) and writes teardown.json (stable probes
 * pre==post, ports released, test-use porcelain still empty).
 *
 * PORTS: host = first free of 3181..3186; mock = 3496 (fallback 3497).
 * :3080/:3180 are NEVER bound — read-only probes pre and post.
 */

import { spawn, spawnSync } from 'node:child_process'
import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync,
  readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import net from 'node:net'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'

const args = process.argv.slice(2)
function argValue(name, dflt) {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = args[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}

const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(KIT_DIR, '..', '..', '..')))
let TESTUSE = resolve(argValue('testuse', join(WORKTREE, 'tests', 'deepseek-harness-test-use')))
if (!existsSync(TESTUSE) && existsSync(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))) {
  TESTUSE = resolve(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))
}
const MAIN = resolve(WORKTREE, '..', '..')
const HOST_BASELINE_SHA = '46a7f68b0922371ce7144b668b90e377d8e799f4' // DSH 0.1.7-rc.1 release point
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const SRC_WORLD = join(MAIN, 'tests', 'homes', 'mpr-2026-09-27T08-35-52')
const HOST_PORT_MIN = 3181
const HOST_PORT_MAX = 3186
const MOCK_PORTS = [3496, 3497]
const STABLE_PROBES = ['http://127.0.0.1:3080/', 'http://127.0.0.1:3180/']
const BOOT_TIMEOUT_MS = 300_000
const RUN_STAMP = `tvs-smoke-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
const WORLD = join(MAIN, 'tests', 'homes', RUN_STAMP)
const EVIDENCE_DIR = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'team-view-sync-complete', `wp9b-browser-smoke-${RUN_STAMP}`)
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')

// The seeded world's fixed durable facts (same as the spill kit).
const T1 = 'session-mpr-t1-mpr-2026-09-27T08-35-52'
const T1_MEMBER_SESSION = 'session-team-child-796562d4284593654607730948ad2b04'
const T1_MEMBER_INSTANCE = 'inst-17legoh0ti27'

function log(msg) { process.stdout.write(`[smoke-host ${new Date().toISOString()}] ${msg}\n`) }
function dieFatal(msg) { log(`FATAL ${msg}`); process.exit(1) }

function gitIn(cwd, argv) {
  const r = spawnSync('git', ['-C', cwd, ...argv], { encoding: 'utf8' })
  return { status: r.status, out: (r.stdout ?? '').trim() }
}
async function isPortFree(port) {
  return new Promise((resolveP) => {
    const s = net.createServer()
    s.once('error', () => resolveP(false))
    s.once('listening', () => s.close(() => resolveP(true)))
    s.listen(port, '127.0.0.1')
  })
}
async function probe(url, timeoutMs = 5_000) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) })
    return res.status
  } catch { return null }
}
function scrub(text) {
  return String(text).replace(/token=[A-Za-z0-9_-]+/g, 'token=SCRUBBED')
}

function waitForLogLine(logPath, predicate, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  let last = -1
  return new Promise((resolveP) => {
    const timer = setInterval(() => {
      if (!alive()) { clearInterval(timer); resolveP(null); return }
      try {
        const content = readFileSync(logPath, 'utf8')
        if (content.length !== last) {
          last = content.length
          const lines = content.split('\n')
          for (let i = lines.length - 1; i >= 0; i -= 1) {
            if (predicate(lines[i])) { clearInterval(timer); resolveP(lines[i]); return }
          }
        }
      } catch { /* not yet */ }
      if (Date.now() > deadline) { clearInterval(timer); resolveP(null) }
    }, 250)
  })
}

/** Retarget the seeded world's profile patch to this worktree (same as the spill kit). */
function rewriteWorldProfile() {
  const p = join(WORLD, 'profiles', 'web', 'cordis.patch.yml')
  let s = readFileSync(p, 'utf8')
  for (const u of [...new Set([...s.matchAll(/file:\/\/\/[^\s"]+/g)].map((m) => m[0]))]) {
    const abs = u.replace(/^file:\/\//, '')
    const idx = abs.indexOf('/packages/')
    if (idx === -1) continue
    const oldRoot = abs.slice(0, idx)
    s = s.split(`${oldRoot}/packages/`).join(`${WORKTREE}/packages/`)
  }
  s = s.split(`${SRC_WORLD}/blueprints`).join(`${WORLD}/blueprints`)
  // The mpr world carries only the HOST row (host.js) — the BROWSER needs the
  // second CLIENT row (the S8 pattern: an inert node half whose package.json
  // manifest serves the `./client` export, the built client-bundle.js, to the
  // dynamic cordis runner). Without it the team client half never loads in a
  // browser tab (no 团队 tab, zero /team-remote traffic).
  //
  // THE ROW GOES IN AN `insert:` LIST. A top-level `- id:`/`- name:` mapping
  // is parsed as a PatchOptions entry TARGETING an (absent) row id and is
  // silently dropped with a per-entry Loader warning — the same
  // "mapping form is silently ignored" trap the mpr profile header warns
  // about (attempts 1+2 of this kit negative-verified it: host inventory
  // lists the row's siblings but never the client row; boot table = 62
  // upstream entries, zero team entries).
  const shimIndex = `${WORKTREE}/packages/client/composition-shim/index.js`
  s += [
    '',
    '# browser client row (S8 pattern — the team client half bundle):',
    '- insert:',
    '    - id: dsh-agent-team-client',
    `      name: "file://${shimIndex}"`,
    '',
  ].join('\n')
  writeFileSync(p, s)
  const check = readFileSync(p, 'utf8')
  if (!check.includes('p6t6-team-tools')) throw new Error('profile rewrite dropped the p6t6 harness row')
  if (!check.includes(`${WORLD}/blueprints`)) throw new Error('profile rewrite missed the blueprintDir retarget')
  if (!check.includes('dsh-agent-team-client')) throw new Error('profile rewrite dropped the client row')
  if (!check.includes(shimIndex)) throw new Error('profile rewrite dropped the client bundle path')
}

function spawnHost({ port, home, logPath, mockPort }) {
  const outFd = openSync(logPath, 'a')
  const errFd = openSync(logPath, 'a')
  let child
  try {
    child = spawn(
      process.execPath,
      [HOST_BIN, 'web', '--port', String(port), '--no-open'],
      {
        cwd: home,
        stdio: ['ignore', outFd, errFd],
        env: {
          ...process.env,
          DSH_HOME: home,
          DSH_CLIENT_COMMIT_HASH: HOST_BASELINE_SHA,
          DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
          DEEPSEEK_API_KEY: 'tvs-smoke-key',
        },
      },
    )
  } catch (error) {
    closeSync(outFd)
    closeSync(errFd)
    throw new Error(`host spawn failed: ${error.message}`)
  }
  const exitInfo = { exited: false, code: undefined, signal: undefined, message: undefined }
  child.on('error', (error) => {
    exitInfo.exited = true
    exitInfo.signal = 'spawn-error'
    exitInfo.message = error.message
  })
  child.on('close', (code, signal) => {
    exitInfo.exited = true
    exitInfo.code = code
    exitInfo.signal = signal
  })
  return { child, exitInfo, alive: () => !exitInfo.exited, logPath }
}

function stopHost(h) {
  if (h.alive()) {
    try { h.child.kill('SIGTERM') } catch { /* already gone */ }
  }
}

async function main() {
  // ── preflight ─────────────────────────────────────────────────────────────
  const head = gitIn(TESTUSE, ['rev-parse', 'HEAD'])
  const porcelain = gitIn(TESTUSE, ['status', '--porcelain'])
  if (head.status !== 0 || head.out !== HOST_BASELINE_SHA) dieFatal(`test-use HEAD mismatch: ${head.out} (want ${HOST_BASELINE_SHA})`)
  if (porcelain.status !== 0 || porcelain.out !== '') dieFatal(`test-use porcelain not empty: ${porcelain.out.slice(0, 80)}`)
  // PR #35 third follow-up P1 (guide §15): the browser evidence is
  // BOUND to the exact tested commit — worktree HEAD + the worktree
  // porcelain as a HARD gate (a dirty working tree cannot prove an
  // immutable commit passed this smoke) + the served client bundle's
  // size + sha256 (which bytes the browser actually loaded). The check
  // runs BEFORE this run creates any artifact (EVIDENCE_DIR is created
  // below the gate): the gate is the strict empty-porcelain form, no
  // self-exclusion needed — an external console redirect must live
  // OUTSIDE the worktree for the same reason.
  const wtHead = gitIn(WORKTREE, ['rev-parse', 'HEAD'])
  const wtPorcelain = gitIn(WORKTREE, ['status', '--porcelain'])
  if (wtHead.status !== 0) dieFatal(`worktree HEAD failed: ${wtHead.out.slice(0, 80)}`)
  if (wtPorcelain.status !== 0 || wtPorcelain.out !== '') dieFatal(`worktree porcelain not empty (the smoke must run on a clean commit): ${wtPorcelain.out.slice(0, 120)}`)
  const BUNDLE_PATH = join(WORKTREE, 'packages', 'client', 'composition-shim', 'client-bundle.js')
  const bundleBytes = readFileSync(BUNDLE_PATH)
  const bundleHash = createHash('sha256').update(bundleBytes).digest('hex')

  mkdirSync(EVIDENCE_DIR, { recursive: true })
  log(`kit: served-bundle browser smoke host`)
  log(`worktree=${WORKTREE} testuse=${TESTUSE}`)
  log(`world=${WORLD} (seed from ${SRC_WORLD})`)
  log(`commit binding: worktree HEAD=${wtHead.out} porcelain='' bundle=${bundleBytes.length}B sha256=${bundleHash.slice(0, 16)}…`)
  const stablePre = {}
  for (const u of STABLE_PROBES) stablePre[u] = await probe(u)
  let hostPort = null
  for (let p = HOST_PORT_MIN; p <= HOST_PORT_MAX; p += 1) {
    if (await isPortFree(p)) { hostPort = p; break }
  }
  let mockPort = null
  for (const p of MOCK_PORTS) {
    if (await isPortFree(p)) { mockPort = p; break }
  }
  if (hostPort === null || mockPort === null) dieFatal('no free port (host 3181..3186 / mock 3496..3497)')
  log(`stable pre=${JSON.stringify(stablePre)} hostPort=${hostPort} mockPort=${mockPort}`)

  // ── seed the world (no spill blueprint — the T1 seed team is enough) ──────
  log(`seeding world ${WORLD} from ${SRC_WORLD}`)
  rmSync(WORLD, { recursive: true, force: true })
  const cp = spawnSync('cp', ['-r', SRC_WORLD, WORLD], { encoding: 'utf8' })
  if (cp.status !== 0) dieFatal(`world seed failed: ${cp.stderr}`)
  const sessionsRoot = join(WORLD, 'sessions')
  for (const top of readdirSync(sessionsRoot)) {
    const dir = join(sessionsRoot, top)
    if (!statSync(dir).isDirectory()) continue
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry)
      if (statSync(p).isDirectory() && existsSync(join(p, 'session.lock'))) {
        rmSync(join(p, 'session.lock'))
        log(`removed stale session.lock: ${join(entry, 'session.lock')}`)
      }
    }
  }
  rewriteWorldProfile()
  log('world seeded (row patch retargeted to this worktree; stale locks cleared)')

  // ── mock model (world fidelity: the boot side-calls need a model) ─────────
  let MOCK = null
  const MOCK_LOG = join(EVIDENCE_DIR, 'mock.log')
  try {
    MOCK = await startMockModel({
      port: mockPort,
      decide: () => ({ kind: 'text', content: 'smoke host: no work expected' }),
      log: (msg) => { try { writeFileSync(MOCK_LOG, `${msg}\n`, { flag: 'a' }) } catch { /* ignore */ } },
    })
  } catch (e) {
    dieFatal(`mock model failed to start: ${e.message}`)
  }
  log(`mock model on 127.0.0.1:${mockPort}`)

  // ── host boot ─────────────────────────────────────────────────────────────
  const h = spawnHost({ port: hostPort, home: WORLD, logPath: INSTANCE_LOG, mockPort })
  const origin = `http://127.0.0.1:${hostPort}`
  let tokenUrl = null
  try {
    const line = await waitForLogLine(INSTANCE_LOG, (l) => l.includes('/?token='), BOOT_TIMEOUT_MS, h.alive)
    if (line === null) dieFatal(`host boot failed: no boot marker within ${BOOT_TIMEOUT_MS}ms${h.exitInfo.exited ? ` (exit code=${h.exitInfo.code})` : ''}`)
    const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(line.replace(/.*dsh web:\s*/, ''))
    if (m === null || m[1] !== String(hostPort)) dieFatal(`boot marker port mismatch: ${scrub(line)}`)
    tokenUrl = `http://127.0.0.1:${hostPort}/?token=${m[2]}`
    // Route-ready wait (the 405 window, same as the spill kit).
    const tRoute = Date.now()
    let routeStatus = 0
    while (Date.now() - tRoute < 60_000) {
      const res = await fetch(`${origin}/team-remote/team.getReadState`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: `smoke-${Date.now()}`,
          method: 'team.getReadState',
          payload: { version: 6, params: { sessionId: T1_MEMBER_SESSION } },
        }),
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null)
      routeStatus = res === null ? -1 : res.status
      if (routeStatus !== 405) break
      await new Promise((r) => setTimeout(r, 250))
    }
    if (routeStatus === 405) dieFatal('the /team-remote route never became ready (405 for 60s)')
    log(`route ready (${Date.now() - tRoute}ms after boot marker; status=${routeStatus})`)
  } catch (e) {
    stopHost(h)
    try { await MOCK.close() } catch { /* ignore */ }
    dieFatal(e.message ?? String(e))
  }

  // The retained evidence NEVER carries the launch token (scrubbed URL).
  writeFileSync(join(EVIDENCE_DIR, 'smoke-host.json'), JSON.stringify({
    runStamp: RUN_STAMP,
    origin,
    tokenUrl: scrub(tokenUrl),
    hostPort,
    mockPort,
    world: WORLD,
    worktree: WORKTREE,
    worktreeHead: wtHead.out,
    worktreePorcelain: wtPorcelain.out,
    clientBundle: { path: 'packages/client/composition-shim/client-bundle.js', sizeBytes: bundleBytes.length, sha256: bundleHash },
    t1: T1,
    t1MemberSession: T1_MEMBER_SESSION,
    t1MemberInstance: T1_MEMBER_INSTANCE,
    stablePre,
  }, null, 2))
  log(`READY ${tokenUrl}`)

  // ── stay alive until the agent tears us down ──────────────────────────────
  let stopping = false
  const stop = async (signal) => {
    if (stopping) return
    stopping = true
    log(`stop (${signal}): tearing down`)
    stopHost(h)
    try { await MOCK.close() } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 500))
    const stablePost = {}
    for (const u of STABLE_PROBES) stablePost[u] = await probe(u)
    const porcelainPost = gitIn(TESTUSE, ['status', '--porcelain'])
    const headPost = gitIn(TESTUSE, ['rev-parse', 'HEAD'])
    const portFreeHost = await isPortFree(hostPort)
    const portFreeMock = await isPortFree(mockPort)
    writeFileSync(join(EVIDENCE_DIR, 'teardown.json'), JSON.stringify({
      stablePost,
      stableUnchanged: JSON.stringify(stablePre) === JSON.stringify(stablePost),
      porcelainPost: porcelainPost.out,
      headPost: headPost.out,
      portFreeHost,
      portFreeMock,
    }, null, 2))
    writeFileSync(join(EVIDENCE_DIR, 'instance.log.scrubbed'), scrub(readFileSync(INSTANCE_LOG, 'utf8')))
    try { if (existsSync(MOCK_LOG)) writeFileSync(join(EVIDENCE_DIR, 'mock.log.scrubbed'), scrub(readFileSync(MOCK_LOG, 'utf8'))) } catch { /* ignore */ }
    log('teardown done')
    process.exit(0)
  }
  process.on('SIGTERM', () => { void stop('SIGTERM') })
  process.on('SIGINT', () => { void stop('SIGINT') })
  // The host dying on its own = an early fatal.
  const watchdog = setInterval(() => {
    if (!h.alive() && !stopping) {
      try { stopHost(h) } catch { /* ignore */ }
      try { void MOCK?.close() } catch { /* ignore */ }
      log(`FATAL host exited early (code=${h.exitInfo.code} signal=${h.exitInfo.signal ?? 'none'}) — log tail: ${scrub(readFileSync(INSTANCE_LOG, 'utf8').split('\n').slice(-20).join(' | '))}`)
      process.exit(1)
    }
  }, 1_000)
  process.on('exit', () => { clearInterval(watchdog) })
}

main().catch((e) => dieFatal(`unhandled: ${e.stack ?? e}`))
