#!/usr/bin/env node
/**
 * issue2-boot.mjs — I2 (issue #2, line B) B2 live-world boot.
 *
 * H6-kit-derived (a2permhf-boot.mjs) with the H3/H6 hostile machinery
 * removed (DSH_HARDENING_PROBE NOT set) and the drill reduced to ONE
 * scripted text turn per identity: the B2 evidence is the model-facing
 * tool SURFACE (req.tools) each agent sees plus the direct-dispatch and
 * state assertions the check script runs — no tool-call chains.
 *
 * Mechanism (unchanged from H6 — sandbox-legal, TEST_METHODS §5):
 *   - host child: DshInstance (FILE-FD stdio spawn — no piped-stdio spawn);
 *   - launch: `node apps/cli/lib/bin.js web --port 3181 --no-open` with
 *     DSH_HOME = the world home + DSH_CLIENT_COMMIT_HASH (skips the
 *     in-build git spawn);
 *   - mock model: in-process on 3493 (startMockModel), DEEPSEEK_BASE_URL
 *     env for the host child;
 *   - gates: boot marker → 401 auth gate → row health (toolCount=10) →
 *     live-session set → dump-config rows → catalog.list carries
 *     team.issue2.
 *
 * I2_PHASE=resume re-boots the SAME world home with bootPhase rewritten
 * create→resume in the user-layer patch (the cold-resume leg, §8.7).
 *
 * Usage: node issue2-boot.mjs boot|stop
 * Env:   I2_STAMP / I2_HOME (world selection, as H6 A2_STAMP/A2_HOME)
 *        I2_PHASE (create | resume; default create)
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

function findMainRepoRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, '.worktrees', 'RC1')) && existsSync(join(dir, 'references', 'deepseek-harness-test-use'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} carries .worktrees/RC1 + references/deepseek-harness-test-use`)
    dir = parent
  }
}
const MAIN_REPO = findMainRepoRoot(dirname(fileURLToPath(import.meta.url)))
const HOST_TREE = join(MAIN_REPO, 'references', 'deepseek-harness-test-use')

// MY worktree (the harness plugin.mjs the p6t6 row loads).
function findWorktree(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'packages', 'tools', 'harness', 'plugin.mjs')) && existsSync(join(dir, 'dev', 'agent-workflow', 'graph.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} is a dsh-agent-team worktree root`)
    dir = parent
  }
}
const WORKTREE = findWorktree(dirname(fileURLToPath(import.meta.url)))
const { DshInstance, ensureProfile } = await import(
  pathToFileURL(join(MAIN_REPO, '.worktrees', 'RC1', 'tests', 'characterization', 'lib', 'instance.mjs')).href
)
const { logTail, portInUse, waitForLogLine, waitForPortFree } = await import(
  pathToFileURL(join(MAIN_REPO, '.worktrees', 'RC1', 'tests', 'characterization', 'lib', 'util.mjs')).href
)
const { startMockModel } = await import(pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')).href)

const EV = dirname(fileURLToPath(import.meta.url))
const P6T6_URL = pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')).href

const WORLD = 'issue2'
const WORLD_PREFIX = '.dsh-test-i2-'
let STAMP = process.env.I2_STAMP
let HOME = process.env.I2_HOME
  ? resolve(process.env.I2_HOME)
  : STAMP
    ? join(MAIN_REPO, 'references', WORLD_PREFIX + STAMP)
    : null
if (HOME === null) {
  const dirs = readdirSync(join(MAIN_REPO, 'references'))
    .filter((n) => n.startsWith(WORLD_PREFIX))
    .sort()
  if (dirs.length === 0) throw new Error(`no ${WORLD_PREFIX}* world under references — run issue2-setup.mjs first`)
  const newest = dirs[dirs.length - 1]
  STAMP = newest.slice(WORLD_PREFIX.length)
  HOME = join(MAIN_REPO, 'references', newest)
}
const PROFILE_DIR = join(HOME, 'profiles', 'web')
const PKG_DIR = join(PROFILE_DIR, 'node_modules', 'dsh-agent-team')

const PORT = 3181
const MOCK_PORT = 3493
const CLIENT_COMMIT_HASH = 'a66e470204'
const ROOT_SESSION_ID = 'i2root'
const EXPECTED_BLUEPRINT = 'team.issue2'
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/
const EXPECTED_LIVE = ['i2root', 'session-i2e', 'session-i2r']

const BOOT_LOG = join(EV, `issue2-boot-${STAMP}.log`)
const STATE_FILE = join(EV, `issue2state-${STAMP}.json`)
const log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}`
  appendFileSync(BOOT_LOG, stamped + '\n')
  console.log(stamped)
}
function die(msg) {
  log(`FAIL — ${msg}`)
  if (_instancePid !== null) {
    try {
      process.kill(_instancePid)
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2500)
    } catch { /* already dead */ }
  }
  process.exit(1)
}
let _instancePid = null

// ── HTTP helpers ────────────────────────────────────────────────────────────
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
  if (res.status !== 303 || setCookie === null) {
    throw new Error(`dsh web authentication returned HTTP ${res.status} (expected 303 + set-cookie)`)
  }
  return setCookie.split(';', 1)[0]
}
async function remoteCall(origin, cookie, method, params, version = 1) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie === null ? {} : { cookie }) },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `i2-${Date.now().toString(16)}${Math.floor(Math.random() * 1e6).toString(16)}`,
      method,
      payload: { version, params },
    }),
  }, 120_000)
}
async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}

// ── the minimal scripted mock (B2: one text turn per identity) ─────────────
const LEADER_PERSONA = 'You are the leader of the issue2 permission test team.'
const EXPERT_PERSONA = 'You are member expert of the issue2 permission test team.'
const RESEARCHER_PERSONA = 'You are member researcher of the issue2 permission test team.'

function identityOf(req) {
  const msgs = Array.isArray(req?.messages) ? req.messages : []
  const sys = msgs.map((m) => (typeof m?.content === 'string' ? m.content : '')).join('\n')
  if (sys.includes(LEADER_PERSONA)) return 'leader'
  if (sys.includes(EXPERT_PERSONA)) return 'expert'
  if (sys.includes(RESEARCHER_PERSONA)) return 'researcher'
  return 'unknown'
}

// The B2 evidence line per request: the MODEL-FACING tool surface
// (req.tools) — the names the model could call. JSON array so the check
// script can parse it byte-exactly (no whitespace inside).
const mockLogPath = () => join(EV, `issue2-mock-${STAMP}.log`)
function makeDecide() {
  return ({ seq, req }) => {
    const identity = identityOf(req)
    const tools = Array.isArray(req?.tools)
      ? req.tools.map((t) => (t?.function?.name ?? t?.name ?? '?')).sort()
      : []
    appendFileSync(
      mockLogPath(),
      `[${new Date().toISOString()}] MOCK seq=${seq} identity=${identity} tools=${JSON.stringify(tools)}\n`,
    )
    return { kind: 'text', content: `${identity}-i2-turn-ok` }
  }
}

// ── health gate ─────────────────────────────────────────────────────────────
async function healthReady() {
  const deadline = Date.now() + 240_000
  let last = null
  for (;;) {
    const hb = await p6t6Health(PORT)
    last = { status: hb.status, body: hb.body }
    if (hb.status === 200 && hb.body?.ok === true && hb.body?.toolCount === 10) return last
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      // The B2 RED signal (production shape): the row setup threw — the
      // exact error text is the defect record. Do not retry; the world is
      // dead at setup.
      throw new Error(`row setup failed (definitive): ${JSON.stringify(hb.body).slice(0, 1200)}`)
    }
    if (Date.now() >= deadline) throw new Error(`row health not ready in 240s — ${JSON.stringify(hb.body).slice(0, 400)}`)
    await new Promise((r) => setTimeout(r, 1000))
  }
}

// ── boot ────────────────────────────────────────────────────────────────────
async function boot() {
  log(`world: ${HOME}`)
  log(`install dir: ${PKG_DIR}`)
  if (!existsSync(PKG_DIR)) die(`installed package missing: ${PKG_DIR} (run issue2-setup.mjs first)`)
  const setupAssertFile = readdirSync(EV).filter((f) => f.startsWith('issue2-assertions-') && f.endsWith('.json'))
    .map((f) => join(EV, f))
    .find((f) => JSON.parse(readFileSync(f, 'utf8')).worldHome === HOME)
  if (!setupAssertFile) die(`no issue2-assertions-* file for this world (${HOME}) — run issue2-setup.mjs first`)
  const setup = JSON.parse(readFileSync(setupAssertFile, 'utf8'))
  log(`setup: ${setupAssertFile} (branch=${setup.branch} tip=${setup.artifactIdentity?.branchTip ?? '?'})`)

  for (const [label, p] of [
    ['host.js (dist entry)', join(PKG_DIR, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')],
    ['agent-bindings.mjs (dist glue mirror)', join(PKG_DIR, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')],
    ['p6t6 harness (my worktree)', join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')],
    ['user-layer patch', join(PROFILE_DIR, 'cordis.patch.yml')],
  ]) {
    if (!existsSync(p)) die(`missing boot artifact ${label}: ${p}`)
  }
  let patchText = readFileSync(join(PROFILE_DIR, 'cordis.patch.yml'), 'utf8')
  if (!patchText.includes(EXPECTED_BLUEPRINT)) die(`user-layer patch does not carry ${EXPECTED_BLUEPRINT}: ${patchText.slice(0, 300)}`)
  if (await portInUse(PORT)) die(`port ${PORT} is in use`)
  if (await portInUse(MOCK_PORT)) die(`port ${MOCK_PORT} is in use`)

  const phase = process.env.I2_PHASE === 'resume' ? 'resume' : 'create'
  if (phase === 'resume') {
    if (!patchText.includes('bootPhase: "create"')) die('resume boot: the user-layer patch has no bootPhase: "create" to rewrite')
    patchText = patchText.replace('bootPhase: "create"', 'bootPhase: "resume"')
    writeFileSync(join(PROFILE_DIR, 'cordis.patch.yml'), patchText)
    log('user-layer patch rewritten: bootPhase "create" → "resume" (cold resume)')
  }
  const directive = {
    boot: 1,
    phase,
    reportDir: EV,
    runStamp: STAMP,
    rootSessionId: ROOT_SESSION_ID,
  }
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify(directive, null, 2))
  log(`p6t6 directive written (boot=1 phase=${phase} rootSessionId=${ROOT_SESSION_ID})`)

  // Mock model (in-process; the deepseek-official adapter resolves via the
  // DEEPSEEK_BASE_URL env var). DSH_HARDENING_PROBE deliberately NOT set
  // (no hostile seam in this world).
  const mock = await startMockModel({ port: MOCK_PORT, decide: makeDecide(), log: (l) => appendFileSync(mockLogPath(), `[${new Date().toISOString()}] ${l}\n`) })
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${mock.port}`
  process.env.DEEPSEEK_API_KEY = 'i2-mock-key'
  log(`mock DeepSeek endpoint up at 127.0.0.1:${mock.port} (in-process)`)

  const logDir = join(EV, 'instances')
  mkdirSync(logDir, { recursive: true })
  const instance = new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port: PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir })
  const profile = await ensureProfile({ instance, log, timeoutMs: 90_000 })
  log(`profile ${profile.created ? 'created via throwaway boot' : 'already initialized (issue2-setup)'}`)
  if (profile.created) die('profile was NOT pre-created by issue2-setup — the world is not the git-install world (abort)')

  // Boot the production instance.
  const started = await instance.start({ timeoutMs: 240_000 })
  _instancePid = instance.child?.pid ?? null
  const markerLine = await waitForLogLine(started.logPath, BOOT_MARKER, 60_000)
  if (markerLine === null) throw new Error(`boot marker not found in ${started.logPath}`)
  const token = markerLine.slice(markerLine.indexOf('token=') + 6).trim()
  const origin = `http://127.0.0.1:${PORT}`
  log(`booted at ${origin}; boot line: ${markerLine.trim()}`)
  const cookie = await authenticate(origin, token)
  log(`auth cookie exchanged (${cookie.slice(0, 12)}…); instance pid ${instance.child?.pid ?? 'unknown'}`)

  // Gate 1 — row health (toolCount=10 = the full team-tool catalog the
  // factory creates; the preset tool surface is asserted by the check).
  const health = await healthReady()
  log(`row ready — health=${JSON.stringify(health.body).slice(0, 400)}`)
  const live = health.body?.liveSessions ?? []
  if (JSON.stringify(live) !== JSON.stringify(EXPECTED_LIVE)) {
    die(`live sessions mismatch: expected ${JSON.stringify(EXPECTED_LIVE)} got ${JSON.stringify(live)}`)
  }
  log(`live sessions = ${JSON.stringify(live)} (expected set)`)

  // Gate 2 — the 401 gate.
  let unauth = null
  for (let i = 0; i < 20; i++) {
    unauth = await remoteCall(origin, null, 'catalog.list', {})
    if (unauth.status === 401 || unauth.status === 403) break
    await new Promise((r) => setTimeout(r, 500))
  }
  if (!(unauth.status === 401 || unauth.status === 403)) {
    die(`401 gate failed: unauthenticated catalog.list returned ${unauth.status} (expected 401/403): ${JSON.stringify(unauth.body).slice(0, 200)}`)
  }
  log(`401 gate: unauthenticated catalog.list → HTTP ${unauth.status}`)

  // Gate 3 — dump-config: the rows present.
  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  const dumpPath = join(EV, `dump-config-${WORLD}-${STAMP}-${phase}.txt`)
  writeFileSync(dumpPath, dump.text)
  const rows = {
    'dsh-agent-team (host row)': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: 'dsh-agent-team/host' }),
    'dsh-agent-team-client (client row)': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team-client', name: 'dsh-agent-team' }),
    'p6t6-team-tools (harness row, file URL)': DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: P6T6_URL }),
  }
  log(`dump-config → ${dumpPath}; rows=${JSON.stringify(rows)}`)
  if (Object.values(rows).some((v) => !v)) die(`dump-config row check failed: ${JSON.stringify(rows)}`)

  // Gate 4 — live remote channel: catalog.list carries the expected blueprint.
  const catalog = await remoteCall(origin, cookie, 'catalog.list', {})
  writeFileSync(join(EV, `catalog-list-${WORLD}-${STAMP}-${phase}.json`), JSON.stringify({ status: catalog.status, body: catalog.body }, null, 2))
  if (catalog.status !== 200) die(`catalog.list with cookie returned ${catalog.status}`)
  if (!JSON.stringify(catalog.body).includes(EXPECTED_BLUEPRINT)) {
    die(`catalog.list does not carry ${EXPECTED_BLUEPRINT}`)
  }
  log(`catalog.list carries ${EXPECTED_BLUEPRINT} (user-layer override in force)`)

  const state = {
    world: WORLD,
    stamp: STAMP,
    home: HOME,
    port: PORT,
    mockPort: mock.port,
    origin,
    token,
    cookie,
    rootSessionId: ROOT_SESSION_ID,
    instancePid: instance.child?.pid ?? null,
    bootJobPid: process.pid,
    logPath: started.logPath,
    mockLogPath: mockLogPath(),
    dumpPath,
    installDir: PKG_DIR,
    spec: setup.spec,
    branch: setup.branch,
    branchTip: setup.artifactIdentity?.branchTip ?? null,
    installedGlueSha256: setup.artifactIdentity?.installedGlueSha256 ?? null,
    phase,
    startedAt: new Date().toISOString(),
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  log(`state.json → ${STATE_FILE}`)
  log('I2-READY')
  console.log('I2-READY')

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
  instance.child?.on('exit', (code) => {
    log(`instance child exited (code=${code}) — boot job shutting down`)
    void shutdown('instance child exit')
  })
  await new Promise(() => {}) // idle until exit
}

// ── stop ────────────────────────────────────────────────────────────────────
async function stop() {
  if (!existsSync(STATE_FILE)) die(`no state.json at ${STATE_FILE}`)
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  if (state.instancePid !== null && state.instancePid !== undefined) {
    try {
      process.kill(state.instancePid)
      log(`stop: instance pid ${state.instancePid} signaled`)
    } catch (e) { log(`stop: instance pid kill note: ${String(e?.message ?? e).slice(0, 200)}`) }
  } else {
    log('stop: no instancePid in state.json (already stopped?)')
  }
  const p1 = await waitForPortFree(PORT, 60_000)
  const p2 = await waitForPortFree(state.mockPort ?? MOCK_PORT, 60_000)
  log(`stop: ports free — ${PORT}:${p1} ${state.mockPort ?? MOCK_PORT}:${p2}`)
  if (!p1 || !p2) die('ports not free after stop — manual cleanup required')
  const tail = logTail(state.logPath, 15)
  appendFileSync(BOOT_LOG, `stop: instance log tail:\n${tail}\n`)
  if (state.stoppedAt === undefined) {
    state.stoppedAt = new Date().toISOString()
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  }
  log('I2-STOPPED')
}

const [, , cmd] = process.argv
if (cmd === 'boot') await boot()
else if (cmd === 'stop') await stop()
else { console.error('usage: node issue2-boot.mjs boot|stop'); process.exit(2) }
