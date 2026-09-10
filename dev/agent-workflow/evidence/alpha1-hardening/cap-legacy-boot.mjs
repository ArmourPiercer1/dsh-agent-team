#!/usr/bin/env node
/**
 * cap-legacy-boot.mjs — the R1 legacy-regression live-host boot.
 *
 * Boots the INSTALLED task/alpha1-hardening bundle (cap-legacy-setup.mjs
 * world) on the real production DSH host. Same gates as cap-boot.mjs, but the
 * world uses the BUNDLE layer's shipped default (the `my-team-bp-1` inline
 * blueprint, the legacy default with NO capabilities field) — NO user-layer
 * override. No MCP server (the shipped default has `mcpServer: null`).
 *
 * Verifies the R1 legacy regression: the legacy full-10-catalog still works
 * (no per-teammate capability selection) after the alpha.1 changes.
 *
 * Subcommands: node cap-legacy-boot.mjs boot|status|stop
 * Usage env: CAP_HOME (optional; default = newest .dsh-test-caplegacy-*).
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

function findMainRepoRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, '.worktrees', 'RC1', 'tests', 'characterization', 'lib', 'instance.mjs'))
      && existsSync(join(dir, 'references', 'deepseek-harness-test-use'))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} carries .worktrees/RC1 + references/deepseek-harness-test-use`)
    dir = parent
  }
}
const MAIN_REPO = findMainRepoRoot(dirname(fileURLToPath(import.meta.url)))
const { DshInstance, ensureProfile } = await import(
  pathToFileURL(join(MAIN_REPO, '.worktrees', 'RC1', 'tests', 'characterization', 'lib', 'instance.mjs')).href
)
const { logTail, portInUse, waitForLogLine, waitForPortFree } = await import(
  pathToFileURL(join(MAIN_REPO, '.worktrees', 'RC1', 'tests', 'characterization', 'lib', 'util.mjs')).href
)
const { startMockModel } = await import(
  pathToFileURL(join(MAIN_REPO, '.worktrees', 'RC1', 'packages', 'tools', 'harness', 'mock-deepseek.mjs')).href
)

const EV = dirname(fileURLToPath(import.meta.url))
const REPO = MAIN_REPO
const HOST_TREE = join(REPO, 'references', 'deepseek-harness-test-use')
const P6T6_URL = pathToFileURL(join(REPO, 'packages', 'tools', 'harness', 'plugin.mjs')).href

function resolveHome() {
  if (process.env.CAP_HOME) return resolve(process.env.CAP_HOME)
  const dirs = readdirSync(join(REPO, 'references'))
    .filter((n) => n.startsWith('.dsh-test-caplegacy-') && existsSync(join(REPO, 'references', n)))
    .sort()
  if (dirs.length === 0) throw new Error('no .dsh-test-caplegacy-* world under references — run cap-legacy-setup.mjs first')
  return join(REPO, 'references', dirs[dirs.length - 1])
}
const HOME = resolveHome()
const PROFILE_DIR = join(HOME, 'profiles', 'web')
const PKG_DIR = join(PROFILE_DIR, 'node_modules', 'dsh-agent-team')

const PORT = 3180
const MOCK_PORT = 3493
const CLIENT_COMMIT_HASH = '76fda72979'
const ROOT_SESSION_ID = 'team-root' // the shipped default's root session
const LEGACY_BLUEPRINT_ID = 'my-team-bp-1' // the shipped default blueprint
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/
const STAMP = process.env.CAP_STAMP ?? HOME.match(/\.dsh-test-caplegacy-([^.]+)$/)?.[1] ?? 'unknown'

const BOOT_LOG = join(EV, `cap-legacy-boot-${STAMP}.log`)
const STATE_FILE = join(EV, `cap-legacy-state-${STAMP}.json`)
const log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}`
  appendFileSync(BOOT_LOG, stamped + '\n')
  console.log(stamped)
}
function die(msg) {
  log(`FAIL — ${msg}`)
  if (_instancePid !== null) {
    try { process.kill(_instancePid); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2500) } catch { /* already dead */ }
  }
  process.exit(1)
}
let _instancePid = null

async function fetchJson(url, init, timeoutMs = 30_000) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    const text = await res.text()
    let body
    try { body = JSON.parse(text) } catch { body = text }
    return { status: res.status, body, text }
  } catch (e) {
    return { status: null, body: { readError: String(e?.message ?? e) } }
  }
}
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) throw new Error(`dsh web authentication returned HTTP ${res.status} (expected 303 + set-cookie)`)
  return setCookie.split(';', 1)[0]
}
async function remoteCall(origin, cookie, method, params) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie === null ? {} : { cookie }) },
    body: JSON.stringify({ type: 'client-request', rpcId: `caplg-${Date.now().toString(16)}${Math.floor(Math.random() * 1e6).toString(16)}`, method, payload: { version: 1, params } }),
  }, 60_000)
}
async function p6t6Health(port) { return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000) }

async function healthReady() {
  const deadline = Date.now() + 240_000
  let last = null
  for (;;) {
    const hb = await p6t6Health(PORT)
    last = hb
    if (hb.body?.ok === true && hb.body?.ready === true) return hb
    if (hb.body?.ok === false && hb.body?.setupError) {
      throw new Error(`row setup failed (definitive): ${JSON.stringify(hb.body).slice(0, 600)}`)
    }
    if (Date.now() > deadline) throw new Error(`health gate timed out: ${JSON.stringify(last?.body ?? null).slice(0, 400)}`)
    await new Promise((r) => setTimeout(r, 1000))
  }
}

async function boot() {
  if (!existsSync(PKG_DIR)) die(`installed package missing: ${PKG_DIR} (run cap-legacy-setup.mjs first)`)
  const setupAssertFile = readdirSync(EV).filter((f) => f.startsWith('cap-legacy-assertions-') && f.endsWith('.json'))
    .map((f) => join(EV, f))
    .find((f) => JSON.parse(readFileSync(f, 'utf8')).worldHome === HOME)
  if (!setupAssertFile) die(`no cap-legacy-assertions file for this world (${HOME}) — run cap-legacy-setup.mjs first`)
  const setup = JSON.parse(readFileSync(setupAssertFile, 'utf8'))
  log(`setup: ${setupAssertFile} (branch=${setup.branch})`)

  for (const [label, p] of [
    ['host.js (dist entry)', join(PKG_DIR, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')],
    ['p6t6 harness (main repo)', join(REPO, 'packages', 'tools', 'harness', 'plugin.mjs')],
    ['user-layer legacy patch', join(PROFILE_DIR, 'cordis.patch.yml')],
  ]) {
    if (!existsSync(p)) die(`missing boot artifact ${label}: ${p}`)
  }
  // The legacy patch must NOT carry a dsh-agent-team override (the bundle
  // layer's shipped row stands).
  const patchText = readFileSync(join(PROFILE_DIR, 'cordis.patch.yml'), 'utf8')
  if (patchText.includes('- id: "dsh-agent-team"')) die(`legacy patch should NOT override dsh-agent-team: ${patchText.slice(0, 300)}`)
  if (await portInUse(PORT)) die(`port ${PORT} is in use`)
  if (await portInUse(MOCK_PORT)) die(`port ${MOCK_PORT} is in use`)

  const workspaceDir = join(HOME, 'workspace-legacy')
  mkdirSync(workspaceDir, { recursive: true })
  const logDir = join(EV, 'instances-legacy')
  mkdirSync(logDir, { recursive: true })
  const instance = new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port: PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir })
  const profile = await ensureProfile({ instance, log, timeoutMs: 90_000 })
  log(`profile ${profile.created ? 'created via throwaway boot' : 'already initialized (cap-legacy-setup)'}`)
  if (profile.created) die('profile was NOT pre-created by cap-legacy-setup — the world is not the git-install world (abort)')

  const directive = { boot: 1, phase: 'create', reportDir: EV, runStamp: STAMP, rootSessionId: ROOT_SESSION_ID }
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify(directive, null, 2))
  log(`p6t6 directive written (boot=1 phase=create rootSessionId=${ROOT_SESSION_ID})`)

  const mockLogPath = join(EV, `mock-model-legacy-${STAMP}.log`)
  const mock = await startMockModel({
    port: MOCK_PORT,
    decide: ({ seq: s, req }) => {
      appendFileSync(mockLogPath, `[${new Date().toISOString()}] mock: req ${s} model=${JSON.stringify(req?.model ?? null)}\n`)
      return { kind: 'text', content: `CAPLG-M${s} ok (${req?.model ?? 'unknown-model'}).` }
    },
    log: (l) => appendFileSync(mockLogPath, `[${new Date().toISOString()}] ${l}\n`),
  })
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${mock.port}`
  process.env.DEEPSEEK_API_KEY = 'cap-mock-key'
  log(`mock DeepSeek endpoint up at 127.0.0.1:${mock.port} (in-process)`)

  const started = await instance.start({ timeoutMs: 240_000 })
  _instancePid = instance.child?.pid ?? null
  const markerLine = await waitForLogLine(started.logPath, BOOT_MARKER, 60_000)
  if (markerLine === null) throw new Error(`boot marker not found in ${started.logPath}`)
  const token = markerLine.slice(markerLine.indexOf('token=') + 6).trim()
  const origin = `http://127.0.0.1:${PORT}`
  log(`booted at ${origin}; boot line: ${markerLine.trim()}`)
  const cookie = await authenticate(origin, token)
  log(`auth cookie exchanged (${cookie.slice(0, 12)}…); instance pid ${instance.child?.pid ?? 'unknown'}`)

  const health = await healthReady()
  log(`row ready — health=${JSON.stringify(health.body).slice(0, 300)}`)

  let unauth = null
  for (let i = 0; i < 20; i++) {
    unauth = await remoteCall(origin, null, 'catalog.list', {})
    if (unauth.status === 401 || unauth.status === 403) break
    await new Promise((r) => setTimeout(r, 500))
  }
  if (!(unauth.status === 401 || unauth.status === 403)) die(`401 gate failed: ${JSON.stringify(unauth.body).slice(0, 200)}`)
  log(`401 gate: unauthenticated catalog.list → HTTP ${unauth.status}`)

  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  const dumpPath = join(EV, `dump-config-caplegacy-${STAMP}.txt`)
  writeFileSync(dumpPath, dump.text)
  const rows = {
    'dsh-agent-team (host row, SHIPPED default)': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: 'dsh-agent-team/host' }),
    'dsh-agent-team-client (client row)': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team-client', name: 'dsh-agent-team' }),
    'p6t6-team-tools (harness row, file URL)': DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: P6T6_URL }),
  }
  log(`dump-config → ${dumpPath}; rows=${JSON.stringify(rows)}`)
  if (Object.values(rows).some((v) => !v)) die(`dump-config row check failed: ${JSON.stringify(rows)}`)

  const catalog = await remoteCall(origin, cookie, 'catalog.list', {})
  writeFileSync(join(EV, `catalog-list-caplegacy-${STAMP}.json`), JSON.stringify({ status: catalog.status, body: catalog.body }, null, 2))
  log(`catalog.list with cookie: HTTP ${catalog.status}`)
  if (catalog.status !== 200) die(`catalog.list with cookie returned ${catalog.status}`)
  const catalogText = JSON.stringify(catalog.body)
  if (!catalogText.includes(LEGACY_BLUEPRINT_ID)) {
    die(`catalog.list does not carry the shipped default blueprint ${LEGACY_BLUEPRINT_ID}: ${catalogText.slice(0, 400)}`)
  }
  log(`catalog.list carries the SHIPPED DEFAULT blueprint ${LEGACY_BLUEPRINT_ID} (legacy default in force)`)

  const state = {
    stamp: STAMP, home: HOME, workspaceDir, port: PORT, mockPort: mock.port,
    origin, token, cookie, instancePid: instance.child?.pid ?? null, bootJobPid: process.pid,
    logPath: started.logPath, dumpPath, installDir: PKG_DIR, spec: setup.spec, branch: setup.branch,
    startedAt: new Date().toISOString(),
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  log(`state.json → ${STATE_FILE}`)
  log('CAPLEGACY-READY')
  console.log('CAPLEGACY-READY')

  let shuttingDown = false
  const shutdown = async (label) => {
    if (shuttingDown) return
    shuttingDown = true
    log(`shutdown: ${label}`)
    try { await instance.stop({ timeoutMs: 20_000 }) } catch (e) { log(`shutdown: instance.stop note: ${String(e?.message ?? e).slice(0, 200)}`) }
    try { await mock.close() } catch { /* already closed */ }
    const p1 = await waitForPortFree(PORT, 20_000)
    const p2 = await waitForPortFree(mock.port, 20_000)
    log(`shutdown: ports free — ${PORT}:${p1} ${mock.port}:${p2}`)
    if (existsSync(STATE_FILE)) {
      const st = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
      st.stoppedAt = new Date().toISOString()
      writeFileSync(STATE_FILE, JSON.stringify(st, null, 2))
    }
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
  instance.child?.on('exit', (code) => { log(`instance child exited (code=${code})`); void shutdown('instance child exit') })
  await new Promise(() => {})
}

async function status() {
  if (!existsSync(STATE_FILE)) die(`no state.json at ${STATE_FILE}`)
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  const hb = await p6t6Health(state.port)
  const catalog = await remoteCall(state.origin, state.cookie, 'catalog.list', {})
  log(`status: health=${JSON.stringify(hb.body).slice(0, 200)}; catalog.list HTTP ${catalog.status}`)
}

async function stop() {
  if (!existsSync(STATE_FILE)) die(`no state.json at ${STATE_FILE}`)
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  if (state.instancePid !== null && state.instancePid !== undefined) {
    try { process.kill(state.instancePid); log(`stop: instance pid ${state.instancePid} signaled`) } catch (e) { log(`stop: instance pid kill note: ${String(e?.message ?? e).slice(0, 200)}`) }
  } else { log('stop: no instancePid in state.json (already stopped?)') }
  const p1 = await waitForPortFree(PORT, 60_000)
  const p2 = await waitForPortFree(state.mockPort ?? MOCK_PORT, 60_000)
  log(`stop: ports free — ${PORT}:${p1} ${state.mockPort ?? MOCK_PORT}:${p2}`)
  if (!p1 || !p2) die('ports not free after stop — manual cleanup required')
  const tail = logTail(state.logPath, 15)
  appendFileSync(BOOT_LOG, `stop: instance log tail:\n${tail}\n`)
  if (state.stoppedAt === undefined) { state.stoppedAt = new Date().toISOString(); writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)) }
  log('CAPLEGACY-STOPPED')
}

const [, , cmd] = process.argv
if (cmd === 'boot') await boot()
else if (cmd === 'status') await status()
else if (cmd === 'stop') await stop()
else { console.error('usage: node cap-legacy-boot.mjs boot|status|stop'); process.exit(2) }
