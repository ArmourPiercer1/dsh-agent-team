#!/usr/bin/env node
/**
 * r8-boot.mjs — issue #1 (R8 live-host final acceptance) boot.
 *
 * Boots the INSTALLED task/issue1-async-delegation bundle (r8-setup.mjs
 * world) on the real production DSH host:
 *
 *   - host on port 3182 (3180/3181 are taken by other work; NEVER 3080),
 *   - the REAL mock model (the RC1 T12-V mock-deepseek.mjs, SPEC-STRICT)
 *     on port 3495, driven by a SCRIPTED decide (the T12 makeDecide
 *     pattern: identity by the persona marker in the system prompt,
 *     deterministic tool-result turn chain by prior tool-call id),
 *   - a thin MOCK-PROXY on port 3494 in front of the mock: it forwards
 *     every /chat/completions request unchanged, but DELAYS the response
 *     for the two member identities by R8_MEMBER_DELAY_MS (default
 *     20000 ms) — the "~20 s task" of the plan §29 acceptance. The
 *     decide callback itself must stay synchronous (the mock-deepseek
 *     contract — a Promise return would 500), so the delay lives in the
 *     proxy, not in decide. The leader's requests are forwarded with
 *     zero added delay.
 *
 * The DEEPSEEK_BASE_URL env of the host child points at the PROXY
 * (127.0.0.1:3494); the deepseek-official adapter resolves every agent's
 * staticModel through it.
 *
 * Scripted drill (leader, ONE model turn via team.admitInitialWork):
 *   1. team_delegate inst-r8a (async: true)      — call id r8L-delA
 *   2. on delA's receipt → team_delegate inst-r8b (async: true)
 *                                          — call id r8L-delB
 *   3. on delB's receipt → team_collect [tokA, tokB]  — call id r8L-col1
 *      (the IN-FLIGHT collect — both works are still running)
 *   4. on col1's result → final text LEADER-DONE
 *
 * If the old sync-blocking behavior were in force, step 2 could not
 * happen until member A's ~20 s turn finished — the chain would take
 * ≥40 s and t_delB_issued > t_ma_done. The repair is PROVEN when the
 * chain completes with t_delB_issued < t_ma_done (the r8-check.mjs
 * asserts).
 *
 * Members (worker-a / worker-b): every work turn → a single text reply
 * MEMBER-<X>-DONE-TURN<n> (n = per-identity turn counter); the ~20 s
 * span is the proxy's response delay.
 *
 * Extra mock-log lines (parsed by r8-check.mjs):
 *   r8 receipt-delA=<full tool-result JSON>   (the delA admission receipt)
 *   r8 receipt-delB=<full tool-result JSON>   (the delB admission receipt)
 *   r8 collect1-result=<full tool-result JSON>(the in-flight collect)
 *
 * Subcommands:
 *   node r8-boot.mjs boot   — instance start + gates; STAYS ALIVE
 *                             (background job) holding the child + mock + proxy.
 *   node r8-boot.mjs stop   — kill the instance child, verify ports free,
 *                             stamp state.
 *
 * Usage env: R8_STAMP (defaults to the newest .dsh-test-issue1-* world).
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createServer, request as httpRequest } from 'node:http'
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
const WORLD_PREFIX = '.dsh-test-issue1-'
let STAMP = process.env.R8_STAMP
let HOME = STAMP
  ? join(REPO, 'references', WORLD_PREFIX + STAMP)
  : null
if (HOME === null) {
  const dirs = readdirSync(join(REPO, 'references'))
    .filter((n) => n.startsWith(WORLD_PREFIX))
    .sort()
  if (dirs.length === 0) throw new Error(`no ${WORLD_PREFIX}* world under references — run r8-setup.mjs first`)
  const newest = dirs[dirs.length - 1]
  STAMP = newest.slice(WORLD_PREFIX.length)
  HOME = join(REPO, 'references', newest)
}
const PROFILE_DIR = join(HOME, 'profiles', 'web')
const PKG_DIR = join(PROFILE_DIR, 'node_modules', 'dsh-agent-team')

const PORT = 3182
const PROXY_PORT = 3494
const MOCK_PORT = 3495
const MEMBER_DELAY_MS = Number(process.env.R8_MEMBER_DELAY_MS ?? 20_000)
const CLIENT_COMMIT_HASH = 'a66e470204' // test-use official release(dsh) 0.1.2-rc.1 checkout (the d28a662 pin)
const ROOT_SESSION_ID = 'issue1-root'
const EXPECTED_BLUEPRINT = 'team.issue1'
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

const BOOT_LOG = join(EV, `r8-boot-${STAMP}.log`)
const STATE_FILE = join(EV, `r8state-${STAMP}.json`)
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
      rpcId: `r8-${Date.now().toString(16)}${Math.floor(Math.random() * 1e6).toString(16)}`,
      method,
      payload: { version, params },
    }),
  }, 120_000)
}
async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}

// ── the scripted mock decide (SYNCHRONOUS — the mock-deepseek contract) ─────
const LEADER_PERSONA = 'You are the leader of the issue1 async delegation test team.'
const WORKER_A_PERSONA = 'You are member worker-a of the issue1 async delegation test team.'
const WORKER_B_PERSONA = 'You are member worker-b of the issue1 async delegation test team.'
const MEMBER_DELAY_IDENTITY = { 'worker-a': WORKER_A_PERSONA, 'worker-b': WORKER_B_PERSONA }

// Per-identity turn counters (member text = MEMBER-<X>-DONE-TURN<n>).
const turnCounters = { 'worker-a': 0, 'worker-b': 0 }
// The leader's extracted work tokens (from the admission receipts).
const workTokens = { A: null, B: null }

const DELEGATE_A = {
  id: 'r8L-delA',
  name: 'team_delegate',
  arguments: {
    rootSessionId: ROOT_SESSION_ID,
    requestToken: 'r8L-delA',
    delegationInstanceId: 'inst-r8a',
    label: 'r8 task A',
    prompt: 'TASK-A: process the r8 async workload slice A and report back.',
    async: true,
  },
}
const DELEGATE_B = {
  id: 'r8L-delB',
  name: 'team_delegate',
  arguments: {
    rootSessionId: ROOT_SESSION_ID,
    requestToken: 'r8L-delB',
    delegationInstanceId: 'inst-r8b',
    label: 'r8 task B',
    prompt: 'TASK-B: process the r8 async workload slice B and report back.',
    async: true,
  },
}

function extractRequestToken(content) {
  if (typeof content !== 'string') return null
  try {
    const obj = JSON.parse(content)
    if (obj && typeof obj === 'object') {
      if (typeof obj.requestToken === 'string') return obj.requestToken
      if (obj.effect && typeof obj.effect.requestToken === 'string') return obj.effect.requestToken
    }
  } catch { /* not JSON — fall through */ }
  const m = content.match(/"requestToken"\s*:\s*"([^"]+)"/)
  return m ? m[1] : null
}

function makeDecide(mockLogPath) {
  return ({ seq, req }) => {
    const msgs = Array.isArray(req?.messages) ? req.messages : []
    const sys = msgs.map((m) => (typeof m?.content === 'string' ? m.content : '')).join('\n')
    let identity = 'unknown'
    if (sys.includes(LEADER_PERSONA)) identity = 'leader'
    else if (sys.includes(WORKER_A_PERSONA)) identity = 'worker-a'
    else if (sys.includes(WORKER_B_PERSONA)) identity = 'worker-b'

    const last = [...msgs].reverse().find((m) => m && (m.role === 'user' || m.role === 'tool'))
    let step
    let trigger
    if (last?.role === 'tool' && typeof last?.tool_call_id === 'string') {
      trigger = `tool:${last.tool_call_id}`
      const resultContent = typeof last?.content === 'string' ? last.content : ''
      // The receipt / in-flight-collect evidence lines (full content — the
      // standard log line truncates at 400).
      if (identity === 'leader') {
        if (last.tool_call_id === 'r8L-delA') {
          workTokens.A = extractRequestToken(resultContent)
          appendFileSync(mockLogPath, `[${new Date().toISOString()}] r8 receipt-delA=${resultContent}\n`)
        } else if (last.tool_call_id === 'r8L-delB') {
          workTokens.B = extractRequestToken(resultContent)
          appendFileSync(mockLogPath, `[${new Date().toISOString()}] r8 receipt-delB=${resultContent}\n`)
        } else if (last.tool_call_id === 'r8L-col1') {
          appendFileSync(mockLogPath, `[${new Date().toISOString()}] r8 collect1-result=${resultContent}\n`)
        }
      }
      switch (identity) {
        case 'leader':
          if (last.tool_call_id === 'r8L-delA') {
            step = { kind: 'tool-call', toolCalls: [DELEGATE_B] }
          } else if (last.tool_call_id === 'r8L-delB') {
            if (workTokens.A === null || workTokens.B === null) {
              step = { kind: 'text', content: 'R8-TOKEN-EXTRACTION-FAILED' }
              break
            }
            step = {
              kind: 'tool-call',
              toolCalls: [{
                id: 'r8L-col1',
                name: 'team_collect',
                arguments: {
                  rootSessionId: ROOT_SESSION_ID,
                  requestToken: 'r8L-col1',
                  requestTokens: [workTokens.A, workTokens.B],
                },
              }],
            }
          } else if (last.tool_call_id === 'r8L-col1') {
            step = { kind: 'text', content: 'LEADER-DONE' }
          } else {
            step = undefined
          }
          break
        case 'worker-a':
        case 'worker-b':
          turnCounters[identity] += 1
          step = { kind: 'text', content: `MEMBER-${identity === 'worker-a' ? 'A' : 'B'}-DONE-TURN${turnCounters[identity]}` }
          break
        default:
          step = undefined
      }
    } else {
      trigger = 'user'
      if (identity === 'leader') {
        step = { kind: 'tool-call', toolCalls: [DELEGATE_A] }
      } else if (identity === 'worker-a' || identity === 'worker-b') {
        turnCounters[identity] += 1
        step = { kind: 'text', content: `MEMBER-${identity === 'worker-a' ? 'A' : 'B'}-DONE-TURN${turnCounters[identity]}` }
      } else {
        step = undefined
      }
    }
    const action = step === undefined
      ? 'text-fallback'
      : step.kind === 'text' ? `text:${String(step.content).slice(0, 40)}` : `tool-call:${step.toolCalls.map((t) => `${t.id}:${t.name}`).join(',')}`
    appendFileSync(mockLogPath, `[${new Date().toISOString()}] mock seq=${seq} identity=${identity} trigger=${trigger} → ${action}\n`)
    if (step !== undefined) return step
    return { kind: 'text', content: `${identity}-drill-fallback ok` }
  }
}

// ── the mock proxy (3494 → 3495; the member response delay) ─────────────────
function startMockProxy({ port, upstreamPort, memberDelayMs, proxyLogPath }) {
  const upstreamRequest = (method, path, headers, body) =>
    new Promise((resolveReq, rejectReq) => {
      const up = httpRequest({ host: '127.0.0.1', port: upstreamPort, method, path, headers }, (r) => resolveReq(r))
      up.on('error', rejectReq)
      up.write(body)
      up.end()
    })
  return new Promise((resolveProxy, rejectProxy) => {
    const server = createServer((req, res) => {
      let body = ''
      req.on('data', (c) => { body += c })
      req.on('end', async () => {
        try {
          let delay = 0
          let identity = 'other'
          try {
            const parsed = body === '' ? null : JSON.parse(body)
            const msgs = Array.isArray(parsed?.messages) ? parsed.messages : []
            const sys = msgs.map((m) => (typeof m?.content === 'string' ? m.content : '')).join('\n')
            if (sys.includes(WORKER_A_PERSONA)) { identity = 'worker-a'; delay = memberDelayMs }
            else if (sys.includes(WORKER_B_PERSONA)) { identity = 'worker-b'; delay = memberDelayMs }
            else if (sys.includes(LEADER_PERSONA)) identity = 'leader'
          } catch { /* unparseable — forward undelayed */ }
          const t0 = Date.now()
          // Forward to the upstream mock; BUFFER the (small) SSE response,
          // send headers immediately, flush the body after the delay.
          // NOTE: upstreamRequest resolves to the IncomingMessage — it is
          // a PROMISE, not the response (the first R8 run called .on on
          // the promise, TypeError'd, and 502'd every request: proxy log
          // mock-proxy-2026-09-11T17-26-41.log).
          const upstream = await (async () => {
            const up = await upstreamRequest('POST', '/chat/completions', {
              'content-type': 'application/json',
              authorization: req.headers['authorization'] ?? 'Bearer r8-mock-key',
              accept: 'text/event-stream',
            }, body)
            return await new Promise((resolveUp, rejectUp) => {
              let chunks = []
              up.on('data', (c) => chunks.push(c))
              up.on('end', () => resolveUp({ status: up.statusCode, headers: up.headers, chunks }))
              up.on('error', rejectUp)
            })
          })()
          const tUp = Date.now()
          if (!res.headersSent) {
            res.writeHead(upstream.status, {
              'content-type': upstream.headers['content-type'] ?? 'text/event-stream',
              'cache-control': 'no-cache',
              connection: 'keep-alive',
            })
          }
          const tHeaders = Date.now()
          const flush = () => {
            for (const c of upstream.chunks) {
              try { res.write(c) } catch { /* client gone */ }
            }
            try { res.end() } catch { /* client gone */ }
            appendFileSync(proxyLogPath,
              `[${new Date().toISOString()}] proxy identity=${identity} delay=${delay}ms received=${t0} upstreamDone=${tUp} headersSent=${tHeaders} flushed=${Date.now()} upstreamStatus=${upstream.status}\n`)
          }
          if (delay > 0) setTimeout(flush, delay)
          else flush()
        } catch (err) {
          appendFileSync(proxyLogPath, `[${new Date().toISOString()}] proxy ERROR: ${String(err?.stack ?? err)}\n`)
          if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' })
          try { res.end(JSON.stringify({ error: { message: `proxy error: ${String(err?.message ?? err)}`, type: 'proxy_error', code: 'proxy' } })) } catch { /* client gone */ }
        }
      })
    })
    server.once('error', rejectProxy)
    server.listen(port, '127.0.0.1', () => resolveProxy(server))
  })
}

// ── health gate ─────────────────────────────────────────────────────────────
async function healthReady() {
  const deadline = Date.now() + 240_000
  for (;;) {
    const hb = await p6t6Health(PORT)
    if (hb.status === 200 && hb.body?.ok === true && hb.body?.toolCount === 11) return hb.body
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
  if (!existsSync(PKG_DIR)) die(`installed package missing: ${PKG_DIR} (run r8-setup.mjs first)`)
  const setupAssertFile = readdirSync(EV).filter((f) => f.startsWith('r8-assertions-') && f.endsWith('.json'))
    .map((f) => join(EV, f))
    .find((f) => JSON.parse(readFileSync(f, 'utf8')).worldHome === HOME)
  if (!setupAssertFile) die(`no r8-assertions-* file for this world (${HOME}) — run r8-setup.mjs first`)
  const setup = JSON.parse(readFileSync(setupAssertFile, 'utf8'))
  log(`setup: ${setupAssertFile} (branch=${setup.branch} expectedVersion=${setup.expectedVersion})`)

  const p6t6Url = setup.p6t6Url
  for (const [label, p] of [
    ['host.js (dist entry)', join(PKG_DIR, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')],
    ['agent-bindings.mjs (dist glue mirror)', join(PKG_DIR, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')],
    ['p6t6 harness (task worktree)', fileURLToPath(p6t6Url)],
    ['user-layer patch', join(PROFILE_DIR, 'cordis.patch.yml')],
  ]) {
    if (!existsSync(p)) die(`missing boot artifact ${label}: ${p}`)
  }
  const patchText = readFileSync(join(PROFILE_DIR, 'cordis.patch.yml'), 'utf8')
  if (!patchText.includes(EXPECTED_BLUEPRINT)) die(`user-layer patch does not carry ${EXPECTED_BLUEPRINT}: ${patchText.slice(0, 300)}`)
  if (await portInUse(PORT)) die(`port ${PORT} is in use`)
  if (await portInUse(PROXY_PORT)) die(`port ${PROXY_PORT} is in use`)
  if (await portInUse(MOCK_PORT)) die(`port ${MOCK_PORT} is in use`)

  const logDir = join(EV, 'instances')
  mkdirSync(logDir, { recursive: true })
  const instance = new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port: PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir })
  const profile = await ensureProfile({ instance, log, timeoutMs: 90_000 })
  log(`profile ${profile.created ? 'created via throwaway boot' : 'already initialized (r8-setup)'}`)
  if (profile.created) die('profile was NOT pre-created by r8-setup — the world is not the git-install world (abort)')

  const directive = {
    boot: 1,
    phase: 'create',
    reportDir: EV,
    runStamp: STAMP,
    rootSessionId: ROOT_SESSION_ID,
  }
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify(directive, null, 2))
  log(`p6t6 directive written (boot=1 phase=create rootSessionId=${ROOT_SESSION_ID})`)

  // Real mock on 3495 (scripted, synchronous decide).
  const mockLogPath = join(EV, `mock-model-${STAMP}.log`)
  const mock = await startMockModel({ port: MOCK_PORT, decide: makeDecide(mockLogPath), log: (l) => appendFileSync(mockLogPath, `[${new Date().toISOString()}] ${l}\n`) })
  log(`real mock up at 127.0.0.1:${mock.port}`)

  // Mock proxy on 3494 (the member ~20 s delay).
  const proxyLogPath = join(EV, `mock-proxy-${STAMP}.log`)
  const proxyServer = await startMockProxy({ port: PROXY_PORT, upstreamPort: MOCK_PORT, memberDelayMs: MEMBER_DELAY_MS, proxyLogPath })
  log(`mock proxy up at 127.0.0.1:${PROXY_PORT} (member delay ${MEMBER_DELAY_MS}ms) → real mock ${mock.port}`)

  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${PROXY_PORT}`
  process.env.DEEPSEEK_API_KEY = 'r8-mock-key'
  log(`DEEPSEEK_BASE_URL → proxy ${PROXY_PORT} (the host child inherits this env)`)

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

  // Gate 1 — row health (toolCount=11 = the full eleven-tool catalog with
  // the new team_collect — the R8 row gate).
  const health = await healthReady()
  log(`row ready — health=${JSON.stringify(health).slice(0, 300)}`)
  const expectedLive = [ROOT_SESSION_ID, 'session-r8a-a', 'session-r8b-b']
  const live = health.liveSessions ?? []
  if (JSON.stringify(live) !== JSON.stringify(expectedLive)) {
    die(`live sessions mismatch: expected ${JSON.stringify(expectedLive)} got ${JSON.stringify(live)}`)
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
  const dumpPath = join(EV, `dump-config-${STAMP}.txt`)
  writeFileSync(dumpPath, dump.text)
  const rows = {
    'dsh-agent-team (host row)': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: 'dsh-agent-team/host' }),
    'dsh-agent-team-client (client row)': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team-client', name: 'dsh-agent-team' }),
    'p6t6-team-tools (harness row, file URL)': DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: p6t6Url }),
  }
  log(`dump-config → ${dumpPath}; rows=${JSON.stringify(rows)}`)
  if (Object.values(rows).some((v) => !v)) die(`dump-config row check failed: ${JSON.stringify(rows)}`)

  // Gate 4 — live remote channel: catalog.list carries the blueprint.
  const catalog = await remoteCall(origin, cookie, 'catalog.list', {})
  writeFileSync(join(EV, `catalog-list-${STAMP}.json`), JSON.stringify({ status: catalog.status, body: catalog.body }, null, 2))
  log(`catalog.list with cookie: HTTP ${catalog.status}`)
  if (catalog.status !== 200) die(`catalog.list with cookie returned ${catalog.status}`)
  if (!JSON.stringify(catalog.body).includes(EXPECTED_BLUEPRINT)) {
    die(`catalog.list does not carry ${EXPECTED_BLUEPRINT}: ${JSON.stringify(catalog.body).slice(0, 400)}`)
  }
  log(`catalog.list carries ${EXPECTED_BLUEPRINT} (user-layer override in force)`)

  const state = {
    stamp: STAMP,
    home: HOME,
    port: PORT,
    proxyPort: PROXY_PORT,
    mockPort: mock.port,
    origin,
    token,
    cookie,
    rootSessionId: ROOT_SESSION_ID,
    memberDelayMs: MEMBER_DELAY_MS,
    instancePid: instance.child?.pid ?? null,
    bootJobPid: process.pid,
    logPath: started.logPath,
    mockLogPath,
    proxyLogPath,
    dumpPath,
    installDir: PKG_DIR,
    spec: setup.spec,
    branch: setup.branch,
    startedAt: new Date().toISOString(),
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  log(`state.json → ${STATE_FILE}`)
  log('R8-READY')
  console.log('R8-READY')

  // Stay alive (hold the instance child + mock + proxy).
  let shuttingDown = false
  const shutdown = async (label) => {
    if (shuttingDown) return
    shuttingDown = true
    log(`shutdown: ${label}`)
    try { await instance.stop({ timeoutMs: 20_000 }) } catch (e) { log(`shutdown: instance.stop note: ${String(e?.message ?? e).slice(0, 200)}`) }
    try { await proxyServer.close() } catch { /* already closed */ }
    try { await mock.close() } catch { /* already closed */ }
    const p1 = await waitForPortFree(PORT, 20_000)
    const p2 = await waitForPortFree(PROXY_PORT, 20_000)
    const p3 = await waitForPortFree(MOCK_PORT, 20_000)
    log(`shutdown: ports free — ${PORT}:${p1} ${PROXY_PORT}:${p2} ${MOCK_PORT}:${p3}`)
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
    log(`stop: no instancePid in state.json (already stopped?)`)
  }
  const p1 = await waitForPortFree(PORT, 60_000)
  const p2 = await waitForPortFree(state.proxyPort ?? PROXY_PORT, 60_000)
  const p3 = await waitForPortFree(state.mockPort ?? MOCK_PORT, 60_000)
  log(`stop: ports free — ${PORT}:${p1} ${state.proxyPort ?? PROXY_PORT}:${p2} ${state.mockPort ?? MOCK_PORT}:${p3}`)
  if (!p1 || !p2 || !p3) die('ports not free after stop — manual cleanup required')
  const tail = logTail(state.logPath, 15)
  appendFileSync(BOOT_LOG, `stop: instance log tail:\n${tail}\n`)
  if (state.stoppedAt === undefined) {
    state.stoppedAt = new Date().toISOString()
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  }
  log('R8-STOPPED')
}

const [, , cmd] = process.argv
if (cmd === 'boot') await boot()
else if (cmd === 'stop') await stop()
else { console.error('usage: node r8-boot.mjs boot|stop'); process.exit(2) }
