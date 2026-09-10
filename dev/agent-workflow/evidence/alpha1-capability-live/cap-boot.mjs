#!/usr/bin/env node
/**
 * cap-boot.mjs — 0.1.1-alpha.1 capability-wiring live-host boot.
 *
 * Boots the INSTALLED int/alpha1-capability-wiring bundle (cap-setup.mjs
 * world) on the real production DSH host and runs the S8-READY-equivalent
 * gates. Derived from the PBA kit's pba-boot.mjs (the same RC1
 * characterization lib + in-process mock model), with capability-specific
 * differences:
 *
 *   - world prefix `.dsh-test-cap-*`; rootSessionId `cap-root` (the
 *     capability leader); the CAPABILITY user-layer patch is ALREADY written
 *     by cap-setup.mjs (this boot never writes product rows).
 *   - a minimal in-process MCP server on port 3494 (the `cap-mcp` the
 *     capability Blueprint's mcp entry references) — streamable-HTTP
 *     JSON-RPC (initialize / tools/list / tools/call).
 *   - the p6t6 directive's rootSessionId is `cap-root`.
 *
 * Subcommands:
 *   node cap-boot.mjs boot   — instance start + gates (boot line, 401, dump
 *                             rows, health ready, catalog.list carries the
 *                             capability blueprint); STAYS ALIVE (background
 *                             job) holding the instance child + mock + MCP.
 *   node cap-boot.mjs status — re-probe health/catalog from state.json.
 *   node cap-boot.mjs stop   — verify teardown (ports free) + stamp state.
 *
 * Usage env: CAP_HOME (optional; default = newest .dsh-test-cap-*).
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
import { createServer } from 'node:http'

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
    .filter((n) => n.startsWith('.dsh-test-cap-') && existsSync(join(REPO, 'references', n)))
    .sort()
  if (dirs.length === 0) throw new Error('no .dsh-test-cap-* world under references — run cap-setup.mjs first')
  return join(REPO, 'references', dirs[dirs.length - 1])
}
const HOME = resolveHome()
const PROFILE_DIR = join(HOME, 'profiles', 'web')
const PKG_DIR = join(PROFILE_DIR, 'node_modules', 'dsh-agent-team')

const PORT = 3180
const MOCK_PORT = 3493
const MCP_PORT = 3494
const CLIENT_COMMIT_HASH = '76fda72979' // test-use client commit label (the pba kit's)
const ROOT_SESSION_ID = 'cap-root' // the capability leader's root session
const CAP_BLUEPRINT_ID = 'cap-bp-1' // the capability Blueprint in the user-layer patch
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/
const STAMP = process.env.CAP_STAMP ?? HOME.match(/\.dsh-test-cap-([^.]+)$/)?.[1] ?? 'unknown'

const BOOT_LOG = join(EV, `cap-boot-${STAMP}.log`)
const STATE_FILE = join(EV, `cap-state-${STAMP}.json`)
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const normLF = (buf) => buf.toString('utf8').replace(/\r\n/g, '\n')
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
    } catch (e) { /* already dead */ }
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
async function remoteCall(origin, cookie, method, params) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie === null ? {} : { cookie }) },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `cap-${Date.now().toString(16)}${Math.floor(Math.random() * 1e6).toString(16)}`,
      method,
      payload: { version: 1, params },
    }),
  }, 60_000)
}
async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}
async function p6t6State(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 15_000)
}
async function p6t6Tool(port, name, args, as, callId) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args, as, callId }),
  }, 30_000)
}

// ── minimal in-process MCP server (cap-mcp, streamable-HTTP JSON-RPC) ──────
async function startMiniMcp(port) {
  const server = createServer((req, res) => {
    if (req.method === 'POST' && (req.url === '/mcp' || req.url === '/')) {
      let raw = ''
      req.on('data', (c) => { raw += c })
      req.on('end', () => {
        let msg
        try { msg = JSON.parse(raw || '{}') } catch { msg = null }
        const id = msg?.id ?? null
        const method = msg?.method
        let result
        if (method === 'initialize') {
          result = {
            protocolVersion: '2025-03-26',
            capabilities: { tools: {} },
            serverInfo: { name: 'cap-mcp', version: '1.0.0' },
          }
        } else if (method === 'tools/list') {
          result = { tools: [{ name: 'cap_echo', description: 'cap smoke echo tool', inputSchema: { type: 'object', properties: {} } }] }
        } else if (method === 'tools/call') {
          result = { content: [{ type: 'text', text: `cap-mcp echo of ${JSON.stringify(msg?.params?.arguments ?? {})}` }] }
        } else if (method && method.startsWith('notifications/')) {
          res.writeHead(202, { 'content-type': 'application/json' })
          res.end()
          return
        } else {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${String(method)}` } }))
          return
        }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', id, result }))
      })
      return
    }
    if (req.method === 'GET') {
      // Streamable-HTTP: a GET opens the SSE stream. We have no server
      // notifications to push, so open the stream and keep it (the client
      // only needs the transport to be available).
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
      res.write(':cap-mcp sse open\n\n')
      return
    }
    res.writeHead(405, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: `method ${req.method} not allowed` }))
  })
  await new Promise((r) => server.listen(port, '127.0.0.1', r))
  log(`cap-mcp up at 127.0.0.1:${port}`)
  return { port, close: () => new Promise((r) => server.close(r)) }
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
      throw new Error(`row setup failed (definitive): ${JSON.stringify(hb.body).slice(0, 600)}`)
    }
    if (Date.now() >= deadline) throw new Error(`row health not ready in 240s — ${JSON.stringify(hb.body).slice(0, 400)}`)
    await new Promise((r) => setTimeout(r, 1000))
  }
}

// ── boot ────────────────────────────────────────────────────────────────────
async function boot() {
  log(`world: ${HOME}`)
  log(`install dir: ${PKG_DIR}`)
  if (!existsSync(PKG_DIR)) die(`installed package missing: ${PKG_DIR} (run cap-setup.mjs first)`)
  const setupAssertFile = readdirSync(EV).filter((f) => f.startsWith('cap-assertions-') && f.endsWith('.json'))
    .map((f) => join(EV, f))
    .find((f) => JSON.parse(readFileSync(f, 'utf8')).worldHome === HOME)
  if (!setupAssertFile) die(`no cap-assertions file for this world (${HOME}) — run cap-setup.mjs first`)
  const setup = JSON.parse(readFileSync(setupAssertFile, 'utf8'))
  log(`setup: ${setupAssertFile} (branch=${setup.branch})`)

  for (const [label, p] of [
    ['host.js (dist entry)', join(PKG_DIR, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')],
    ['agent-bindings.mjs (dist glue mirror)', join(PKG_DIR, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')],
    ['p6t6 harness (main repo)', join(REPO, 'packages', 'tools', 'harness', 'plugin.mjs')],
    ['user-layer capability patch', join(PROFILE_DIR, 'cordis.patch.yml')],
  ]) {
    if (!existsSync(p)) die(`missing boot artifact ${label}: ${p}`)
  }
  // The capability patch must carry the capability Blueprint + cap-mcp.
  const patchText = readFileSync(join(PROFILE_DIR, 'cordis.patch.yml'), 'utf8')
  if (!patchText.includes(CAP_BLUEPRINT_ID) || !patchText.includes('cap-mcp')) die(`user-layer patch does not carry the capability Blueprint / cap-mcp: ${patchText.slice(0, 300)}`)
  if (await portInUse(PORT)) die(`port ${PORT} is in use`)
  if (await portInUse(MOCK_PORT)) die(`port ${MOCK_PORT} is in use`)
  if (await portInUse(MCP_PORT)) die(`port ${MCP_PORT} is in use`)

  const workspaceDir = join(HOME, 'workspace-cap')
  mkdirSync(workspaceDir, { recursive: true })

  const logDir = join(EV, 'instances')
  mkdirSync(logDir, { recursive: true })
  const instance = new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port: PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir })
  const profile = await ensureProfile({ instance, log, timeoutMs: 90_000 })
  log(`profile ${profile.created ? 'created via throwaway boot' : 'already initialized (cap-setup)'}`)
  if (profile.created) die('profile was NOT pre-created by cap-setup — the world is not the git-install world (abort)')

  // p6t6 directive (its health gate awaits the production row's ready).
  // CAP_PHASE=resume re-boots the SAME world (cold resume, adopts the durable
  // team_domain via the production root's resume phase); the default 'create'
  // stamps a fresh world (strict).
  const phase = process.env.CAP_PHASE === 'resume' ? 'resume' : 'create'
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
  // DEEPSEEK_BASE_URL env var — the T12 honesty pattern).
  const mockLogPath = join(EV, `mock-model-${STAMP}.log`)
  const mock = await startMockModel({
    port: MOCK_PORT,
    decide: ({ seq: s, req }) => {
      appendFileSync(mockLogPath, `[${new Date().toISOString()}] mock: req ${s} model=${JSON.stringify(req?.model ?? null)}\n`)
      return { kind: 'text', content: `CAP-M${s} ok (${req?.model ?? 'unknown-model'}).` }
    },
    log: (l) => appendFileSync(mockLogPath, `[${new Date().toISOString()}] ${l}\n`),
  })
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${mock.port}`
  process.env.DEEPSEEK_API_KEY = 'cap-mock-key'
  log(`mock DeepSeek endpoint up at 127.0.0.1:${mock.port} (in-process)`)

  // The capability MCP server (cap-mcp).
  const mcp = await startMiniMcp(MCP_PORT)

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

  // Gate 1 — row health (the production row's ready via the p6t6 gate; the
  // toolCount=10 is the FULL ten-tool catalog the factory creates — the
  // capability SELECTION is asserted by cap-check.mjs on the live agents).
  const health = await healthReady()
  log(`row ready — health=${JSON.stringify(health.body).slice(0, 300)}`)

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

  // Gate 3 — dump-config: the rows present (bundle host + client + p6t6).
  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  const dumpPath = join(EV, `dump-config-cap-${STAMP}.txt`)
  writeFileSync(dumpPath, dump.text)
  const rows = {
    'dsh-agent-team (host row)': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: 'dsh-agent-team/host' }),
    'dsh-agent-team-client (client row)': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team-client', name: 'dsh-agent-team' }),
    'p6t6-team-tools (harness row, file URL)': DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: P6T6_URL }),
  }
  log(`dump-config → ${dumpPath}; rows=${JSON.stringify(rows)}`)
  if (Object.values(rows).some((v) => !v)) die(`dump-config row check failed: ${JSON.stringify(rows)}`)

  // Gate 4 — live remote channel: catalog.list carries the CAPABILITY blueprint
  // (proof the user-layer override, not the shipped default, is in force).
  const catalog = await remoteCall(origin, cookie, 'catalog.list', {})
  writeFileSync(join(EV, `catalog-list-cap-${STAMP}.json`), JSON.stringify({ status: catalog.status, body: catalog.body }, null, 2))
  log(`catalog.list with cookie: HTTP ${catalog.status}`)
  if (catalog.status !== 200) die(`catalog.list with cookie returned ${catalog.status}`)
  const catalogText = JSON.stringify(catalog.body)
  if (!catalogText.includes(CAP_BLUEPRINT_ID)) {
    die(`catalog.list does not carry the capability blueprint ${CAP_BLUEPRINT_ID} — user-layer override not in force: ${catalogText.slice(0, 400)}`)
  }
  log(`catalog.list carries the capability blueprint ${CAP_BLUEPRINT_ID} (user-layer override in force)`)

  const state = {
    stamp: STAMP, home: HOME, workspaceDir, port: PORT, mockPort: mock.port, mcpPort: MCP_PORT,
    origin, token, cookie,
    instancePid: instance.child?.pid ?? null,
    bootJobPid: process.pid,
    logPath: started.logPath,
    dumpPath,
    installDir: PKG_DIR,
    spec: setup.spec,
    branch: setup.branch,
    startedAt: new Date().toISOString(),
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  log(`state.json → ${STATE_FILE}`)
  log('CAP-READY')
  console.log('CAP-READY')

  // Stay alive (hold the instance child + mock + MCP).
  let shuttingDown = false
  const shutdown = async (label) => {
    if (shuttingDown) return
    shuttingDown = true
    log(`shutdown: ${label}`)
    try { await instance.stop({ timeoutMs: 20_000 }) } catch (e) { log(`shutdown: instance.stop note: ${String(e?.message ?? e).slice(0, 200)}`) }
    try { await mock.close() } catch { /* already closed */ }
    try { await mcp.close() } catch { /* already closed */ }
    const p1 = await waitForPortFree(PORT, 20_000)
    const p2 = await waitForPortFree(mock.port, 20_000)
    const p3 = await waitForPortFree(MCP_PORT, 20_000)
    log(`shutdown: ports free — ${PORT}:${p1} ${mock.port}:${p2} ${MCP_PORT}:${p3}`)
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

// ── status ──────────────────────────────────────────────────────────────────
async function status() {
  if (!existsSync(STATE_FILE)) die(`no state.json at ${STATE_FILE}`)
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  const hb = await p6t6Health(state.port)
  const catalog = await remoteCall(state.origin, state.cookie, 'catalog.list', {})
  log(`status: health=${JSON.stringify(hb.body).slice(0, 200)}; catalog.list HTTP ${catalog.status}`)
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
  const p3 = await waitForPortFree(MCP_PORT, 60_000)
  log(`stop: ports free — ${PORT}:${p1} ${state.mockPort ?? MOCK_PORT}:${p2} ${MCP_PORT}:${p3}`)
  if (!p1 || !p2 || !p3) die('ports not free after stop — manual cleanup required')
  const tail = logTail(state.logPath, 15)
  appendFileSync(BOOT_LOG, `stop: instance log tail:\n${tail}\n`)
  if (state.stoppedAt === undefined) {
    state.stoppedAt = new Date().toISOString()
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  }
  log('CAP-STOPPED')
}

const [, , cmd] = process.argv
if (cmd === 'boot') await boot()
else if (cmd === 'status') await status()
else if (cmd === 'stop') await stop()
else { console.error('usage: node cap-boot.mjs boot|status|stop'); process.exit(2) }
