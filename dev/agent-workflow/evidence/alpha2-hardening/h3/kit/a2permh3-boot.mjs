#!/usr/bin/env node
/**
 * a2permh3-boot.mjs — H3 (alpha.2 hardening closure) live-host boot.
 *
 * H3 variant of the V1 a2perm-boot.mjs (the V1 file is kept as-is in
 * alpha2-permission/v1/). Deltas:
 *   - worlds .dsh-test-a2permh3-<stamp> / ...a2permh3legacy-<stamp>;
 *   - the p6t6 harness artifact check points at the H3 WORKTREE's
 *     plugin.mjs (the hostile-seam copy);
 *   - the host child is spawned with DSH_HARDENING_PROBE=1 (inherited
 *     through DshInstance's process.env spread) so the test-only
 *     /__hardening/hostile-prepend seam answers; without it the seam
 *     503s (the gate negative is unit-pinned in
 *     packages/tools/test/h3-hostile-seam.test.ts);
 *   - the worker-a script gains the H3-PTC-TRIGGER user-turn (one model
 *     response carrying TWO managed read tool calls — the live
 *     parallel-tool-call shape for the review §14 A10/A11 leg);
 *   - evidence file names carry the h3 marker (a2permh3-*).
 *
 * Boots the INSTALLED task/alpha2-v1-verification bundle (a2perm-setup.mjs
 * world) on the real production DSH host and runs the S8-READY-equivalent
 * gates. Mirrors cap-boot.mjs (the same RC1 characterization lib +
 * in-process mock model) with V1 differences:
 *
 *   - port 3181 (the alpha.2 V1 allocation; the user's tsx on 3180 is
 *     NEVER touched) + mock model on 3493;
 *   - two worlds: `a2perm` (the permission capability world,
 *     rootSessionId a2root) and `legacy` (the shipped my-team-bp-1 row,
 *     rootSessionId team-root) — selected by A2_WORLD;
 *   - NO MCP server (the a2perm row config is mcpServer: null);
 *   - the mock decide is SCRIPTED per agent identity (the persona marker
 *     in the system prompt) and per prior tool-call id (the deterministic
 *     tool-result turn chain — the T12 makeDecide pattern), driving the
 *     leader (6 steps) / worker-a (4 steps) / worker-b (3 steps) drills;
 *   - A2_PHASE=resume re-boots the SAME a2perm world (cold resume): it
 *     rewrites the user-layer patch `bootPhase: "create"` → `"resume"`
 *     BEFORE the boot (the hardening6 method) and writes the p6t6
 *     directive phase=resume.
 *
 * Subcommands:
 *   node a2perm-boot.mjs boot   — instance start + gates; STAYS ALIVE
 *                                 (background job) holding the instance
 *                                 child + mock.
 *   node a2perm-boot.mjs stop   — kill the instance child, verify ports
 *                                 free, stamp state.
 *
 * Usage env: A2_STAMP, A2_WORLD=a2perm|legacy (default a2perm),
 *            A2_PHASE=create|resume (default create; a2perm world only).
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
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

// The H3 WORKTREE (the checkout carrying the hostile-seam plugin.mjs the
// harness row loads) — walk up from EV to the dsh-agent-team worktree root.
function findH3Worktree(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'packages', 'tools', 'harness', 'plugin.mjs')) && existsSync(join(dir, 'dev', 'agent-workflow', 'graph.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} is the H3 worktree root`)
    dir = parent
  }
}
const H3_WORKTREE = findH3Worktree(dirname(fileURLToPath(import.meta.url)))
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

const WORLD = process.env.A2_WORLD === 'legacy' ? 'legacy' : 'a2perm'
const WORLD_PREFIX = WORLD === 'legacy' ? '.dsh-test-a2permh3legacy-' : '.dsh-test-a2permh3-'
let STAMP = process.env.A2_STAMP
let HOME = process.env.A2_HOME
  ? resolve(process.env.A2_HOME)
  : STAMP
    ? join(REPO, 'references', WORLD_PREFIX + STAMP)
    : null
if (HOME === null) {
  const dirs = readdirSync(join(REPO, 'references'))
    .filter((n) => n.startsWith(WORLD_PREFIX))
    .sort()
  if (dirs.length === 0) throw new Error(`no ${WORLD_PREFIX}* world under references — run a2perm-setup.mjs first`)
  const newest = dirs[dirs.length - 1]
  STAMP = newest.slice(WORLD_PREFIX.length)
  HOME = join(REPO, 'references', newest)
}
const PROFILE_DIR = join(HOME, 'profiles', 'web')
const PKG_DIR = join(PROFILE_DIR, 'node_modules', 'dsh-agent-team')

const PORT = 3181
const MOCK_PORT = 3493
const CLIENT_COMMIT_HASH = '76fda72979' // test-use client commit label (the cap kit's)
const ROOT_SESSION_ID = WORLD === 'legacy' ? 'team-root' : 'a2root'
const EXPECTED_BLUEPRINT = WORLD === 'legacy' ? 'my-team-bp-1' : 'team.a2perm'
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

const BOOT_LOG = join(EV, `a2permh3-boot-${WORLD}-${STAMP}.log`)
const STATE_FILE = join(EV, `a2stateh3-${WORLD}-${STAMP}.json`)
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
      rpcId: `a2-${Date.now().toString(16)}${Math.floor(Math.random() * 1e6).toString(16)}`,
      method,
      payload: { version, params },
    }),
  }, 120_000)
}
async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}

// ── the scripted mock decide (a2perm world) ─────────────────────────────────
// Identity: the persona marker in the system prompt. Turn: the LAST user or
// tool message — a tool message carries the prior tool-call id (the
// deterministic chain, the T12 makeDecide pattern), a user message starts
// the drill for that identity.
const LEADER_PERSONA = 'You are the leader of the alpha.2 permission test team.'
const WORKER_A_PERSONA = 'You are member worker-a of the alpha.2 permission test team.'
const WORKER_B_PERSONA = 'You are member worker-b of the alpha.2 permission test team.'

// V1 kit fixes (2026-09-10, parent ruling on the v12 live run):
// (a) the read-perm-c steps (a2L-readC / a2A-readC) satisfy the upstream
//     write tool's read-before-overwrite rule (per-session read tracking)
//     BEFORE the ask-lane writes of perm-c — v12 seq=5: the allowed writeC1
//     re-executed but returned `cannot overwrite existing "…perm-c.txt"
//     without reading it first` (an await-bridge PASS; the fs precondition
//     then applied). readC is itself an ask-lane proof (no rule → default
//     ask; leader → user-approval, member → leader-approval).
// (b) The drill still chains INSIDE one model turn per identity (each tool
//     result triggers the next scripted call) — `team.admitInitialWork`
//     carries AT MOST ONE initial-work slot per creation
//     (root-initial-work.ts: ANY other token's root fact →
//     INITIAL_WORK_ALREADY_ADMITTED), so the leader has no second user-turn
//     route. The parent's equivalent fix therefore applies on the KIT side:
//     the allow/deny zero-request asserts are scoped to the READ
//     OPERATIONS of the lane under test (the chain may already have opened
//     the readC ask — a different operation — by the time the kit samples;
//     v12 race: writeC1 dispatched 20:15:48.588, L1 assert ran :48.749).
const STEPS = {
  leader: {
    first: { kind: 'tool-call', toolCalls: [{ id: 'a2L-readA', name: 'read', arguments: { file_path: 'perm-a.txt' } }] },
    byToolCall: {
      'a2L-readA': { kind: 'tool-call', toolCalls: [{ id: 'a2L-readB', name: 'read', arguments: { file_path: 'perm-b.txt' } }] },
      'a2L-readB': { kind: 'tool-call', toolCalls: [{ id: 'a2L-readC', name: 'read', arguments: { file_path: 'perm-c.txt' } }] },
      'a2L-readC': { kind: 'tool-call', toolCalls: [{ id: 'a2L-writeC1', name: 'write', arguments: { file_path: 'perm-c.txt', content: 'leader-payload-1' } }] },
      'a2L-writeC1': { kind: 'tool-call', toolCalls: [{ id: 'a2L-writeC2', name: 'write', arguments: { file_path: 'perm-c.txt', content: 'leader-payload-2' } }] },
      'a2L-writeC2': { kind: 'text', content: 'LEADER-DONE' },
    },
  },
  'worker-a': {
    first: { kind: 'tool-call', toolCalls: [{ id: 'a2A-readA', name: 'read', arguments: { file_path: 'perm-a.txt' } }] },
    byToolCall: {
      'a2A-readA': { kind: 'tool-call', toolCalls: [{ id: 'a2A-readB', name: 'read', arguments: { file_path: 'perm-b.txt' } }] },
      'a2A-readB': { kind: 'tool-call', toolCalls: [{ id: 'a2A-readC', name: 'read', arguments: { file_path: 'perm-c.txt' } }] },
      'a2A-readC': { kind: 'tool-call', toolCalls: [{ id: 'a2A-writeC1', name: 'write', arguments: { file_path: 'perm-c.txt', content: 'member-a-payload-1' } }] },
      'a2A-writeC1': { kind: 'tool-call', toolCalls: [{ id: 'a2A-readD', name: 'read', arguments: { file_path: 'perm-d.txt' } }] },
      'a2A-readD': { kind: 'text', content: 'MEMBER-A-DONE' },
      // H3 hostile PTC leg (review §14 A10 strict): the serialized-mode
      // continuation — if the agent loop executes the two PTC calls
      // one-at-a-time, ptc1's result re-emits ptc2 (both still denied by
      // the end-cap; the parallel-mode branch is covered by the
      // H3-PTC-TRIGGER step below emitting both in one response).
      // ptc2 = read perm-b (the leader/member STATIC-DENY lane) — the
      // A10 shape: under the hostile prepend its denial must carry the
      // END-CAP reason, not the policy-deny reason.
      'h3A-ptc1': { kind: 'tool-call', toolCalls: [{ id: 'h3A-ptc2', name: 'read', arguments: { file_path: 'perm-b.txt' } }] },
      'h3A-ptc2': { kind: 'text', content: 'H3-PTC-DONE' },
    },
  },
  'worker-b': {
    first: { kind: 'tool-call', toolCalls: [{ id: 'a2B-readE', name: 'read', arguments: { file_path: 'perm-e.txt' } }] },
    byToolCall: {
      'a2B-readE': { kind: 'tool-call', toolCalls: [{ id: 'a2B-writeE', name: 'write', arguments: { file_path: 'perm-e.txt', content: 'member-b-payload' } }] },
      'a2B-writeE': { kind: 'text', content: 'MEMBER-B-DONE' },
    },
  },
}

function identityOf(req) {
  const msgs = Array.isArray(req?.messages) ? req.messages : []
  const sys = msgs.map((m) => (typeof m?.content === 'string' ? m.content : '')).join('\n')
  if (sys.includes(LEADER_PERSONA)) return 'leader'
  if (sys.includes(WORKER_A_PERSONA)) return 'worker-a'
  if (sys.includes(WORKER_B_PERSONA)) return 'worker-b'
  return 'unknown'
}

function makeDecide(mockLogPath) {
  return ({ seq, req }) => {
    const identity = identityOf(req)
    const msgs = Array.isArray(req?.messages) ? req.messages : []
    const last = [...msgs].reverse().find((m) => m && (m.role === 'user' || m.role === 'tool'))
    let step
    let trigger
    if (last?.role === 'tool' && typeof last?.tool_call_id === 'string') {
      trigger = `tool:${last.tool_call_id}`
      step = STEPS[identity]?.byToolCall?.[last.tool_call_id]
    } else {
      trigger = 'user'
      step = STEPS[identity]?.first
      // H3 hostile PTC leg (review §14 A10 strict): an explicit worker-a
      // user turn carrying the trigger marker emits TWO managed read tool
      // calls in ONE model response (the live parallel-tool-call shape):
      // read perm-a (allow lane) + read perm-b (static-DENY lane). Under
      // the hostile prepend-allow BOTH must be end-cap-denied with ZERO
      // control rows — and ptc2's reason must be the END-CAP reason, not
      // the static policy-deny reason (the A10 discriminator; the no-
      // hostile V1 M2 leg pins the policy-deny reason on the same
      // operation earlier in the same world).
      if (identity === 'worker-a' && typeof last?.content === 'string' && last.content.includes('H3-PTC-TRIGGER')) {
        trigger = 'user:h3-ptc'
        step = {
          kind: 'tool-call',
          toolCalls: [
            { id: 'h3A-ptc1', name: 'read', arguments: { file_path: 'perm-a.txt' } },
            { id: 'h3A-ptc2', name: 'read', arguments: { file_path: 'perm-b.txt' } },
          ],
        }
      }
    }
    const action = step === undefined
      ? 'text-fallback'
      : step.kind === 'text' ? `text:${String(step.content).slice(0, 40)}` : `tool-call:${step.toolCalls.map((t) => `${t.id}:${t.name}`).join(',')}`
    // the tool-result content (truncated at 400 — v12's 160 cut the
    // `<content>` payload of a successful read mid-line, so the kit's
    // "executed with content" assertion could not see the file text) — the
    // evidence that a tool EXECUTED (its result carries the payload) versus
    // a pre-execute DENY (an error text).
    const resultContent = last?.role === 'tool' ? ` result=${String(last?.content ?? '').slice(0, 400).replace(/\n/g, '\\n')}` : ''
    appendFileSync(mockLogPath, `[${new Date().toISOString()}] mock seq=${seq} identity=${identity} trigger=${trigger}${resultContent} → ${action}\n`)
    if (step !== undefined) return step
    return { kind: 'text', content: `${identity}-drill-fallback ok` }
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
      throw new Error(`row setup failed (definitive): ${JSON.stringify(hb.body).slice(0, 600)}`)
    }
    if (Date.now() >= deadline) throw new Error(`row health not ready in 240s — ${JSON.stringify(hb.body).slice(0, 400)}`)
    await new Promise((r) => setTimeout(r, 1000))
  }
}

// ── boot ────────────────────────────────────────────────────────────────────
async function boot() {
  log(`world (${WORLD}): ${HOME}`)
  log(`install dir: ${PKG_DIR}`)
  if (!existsSync(PKG_DIR)) die(`installed package missing: ${PKG_DIR} (run a2perm-setup.mjs first)`)
  const assertName = WORLD === 'legacy' ? 'a2permh3legacy-assertions-' : 'a2permh3-assertions-'
  const setupAssertFile = readdirSync(EV).filter((f) => f.startsWith(assertName) && f.endsWith('.json'))
    .map((f) => join(EV, f))
    .find((f) => JSON.parse(readFileSync(f, 'utf8')).worldHome === HOME)
  if (!setupAssertFile) die(`no ${assertName}* file for this world (${HOME}) — run a2perm-setup.mjs first`)
  const setup = JSON.parse(readFileSync(setupAssertFile, 'utf8'))
  log(`setup: ${setupAssertFile} (branch=${setup.branch})`)

  for (const [label, p] of [
    ['host.js (dist entry)', join(PKG_DIR, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')],
    ['agent-bindings.mjs (dist glue mirror)', join(PKG_DIR, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')],
    ['p6t6 harness (H3 worktree, hostile seam)', join(H3_WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')],
    ['user-layer patch', join(PROFILE_DIR, 'cordis.patch.yml')],
  ]) {
    if (!existsSync(p)) die(`missing boot artifact ${label}: ${p}`)
  }
  const patchText = readFileSync(join(PROFILE_DIR, 'cordis.patch.yml'), 'utf8')
  if (!patchText.includes(EXPECTED_BLUEPRINT)) die(`user-layer patch does not carry ${EXPECTED_BLUEPRINT}: ${patchText.slice(0, 300)}`)
  if (await portInUse(PORT)) die(`port ${PORT} is in use`)
  if (await portInUse(MOCK_PORT)) die(`port ${MOCK_PORT} is in use`)

  const logDir = join(EV, 'instances')
  mkdirSync(logDir, { recursive: true })
  const instance = new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port: PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir })
  const profile = await ensureProfile({ instance, log, timeoutMs: 90_000 })
  log(`profile ${profile.created ? 'created via throwaway boot' : 'already initialized (a2perm-setup)'}`)
  if (profile.created) die('profile was NOT pre-created by a2perm-setup — the world is not the git-install world (abort)')

  // A2_PHASE=resume (a2perm world only): the hardening6 method — patch
  // bootPhase=resume + p6t6 directive phase=resume, SAME world home.
  const phase = WORLD === 'a2perm' && process.env.A2_PHASE === 'resume' ? 'resume' : 'create'
  if (phase === 'resume') {
    if (!patchText.includes('bootPhase: "create"')) die('resume boot: the user-layer patch has no bootPhase: "create" to rewrite')
    writeFileSync(join(PROFILE_DIR, 'cordis.patch.yml'), patchText.replace('bootPhase: "create"', 'bootPhase: "resume"'))
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
  // DEEPSEEK_BASE_URL env var).
  const mockLogPath = join(EV, `mock-model-${WORLD}-${STAMP}.log`)
  const decide = WORLD === 'legacy'
    ? ({ seq, req }) => {
      appendFileSync(mockLogPath, `[${new Date().toISOString()}] mock seq=${seq} identity=${identityOf(req)} → text-fallback\n`)
      return { kind: 'text', content: 'legacy-drill ok' }
    }
    : makeDecide(mockLogPath)
  const mock = await startMockModel({ port: MOCK_PORT, decide, log: (l) => appendFileSync(mockLogPath, `[${new Date().toISOString()}] ${l}\n`) })
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${mock.port}`
  process.env.DEEPSEEK_API_KEY = 'a2-mock-key'
  // H3: the host child inherits this (DshInstance spreads process.env),
  // arming the test-only /__hardening/hostile-prepend seam in the H3
  // worktree's plugin.mjs (review §21 adversarial probe; the seam 503s
  // without the env — the gate negative is unit-pinned).
  process.env.DSH_HARDENING_PROBE = '1'
  log(`mock DeepSeek endpoint up at 127.0.0.1:${mock.port} (in-process); DSH_HARDENING_PROBE=1 (hostile seam armed)`)

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

  // Gate 1 — row health (toolCount=10 = the full ten-tool catalog the
  // factory creates; capability selection is asserted by a2perm-check).
  const health = await healthReady()
  log(`row ready — health=${JSON.stringify(health.body).slice(0, 300)}`)
  const expectedLive = WORLD === 'legacy' ? ['team-root'] : ['a2root', 'session-a2a-a', 'session-a2b-b']
  const live = health.body?.liveSessions ?? []
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
  const dumpPath = join(EV, `dump-config-${WORLD}-${STAMP}.txt`)
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
  writeFileSync(join(EV, `catalog-list-${WORLD}-${STAMP}.json`), JSON.stringify({ status: catalog.status, body: catalog.body }, null, 2))
  log(`catalog.list with cookie: HTTP ${catalog.status}`)
  if (catalog.status !== 200) die(`catalog.list with cookie returned ${catalog.status}`)
  const catalogText = JSON.stringify(catalog.body)
  if (!catalogText.includes(EXPECTED_BLUEPRINT)) {
    die(`catalog.list does not carry ${EXPECTED_BLUEPRINT}: ${catalogText.slice(0, 400)}`)
  }
  log(`catalog.list carries ${EXPECTED_BLUEPRINT} (${WORLD === 'legacy' ? 'shipped row in force' : 'user-layer override in force'})`)

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
    mockLogPath,
    dumpPath,
    installDir: PKG_DIR,
    spec: setup.spec,
    branch: setup.branch,
    phase,
    startedAt: new Date().toISOString(),
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  log(`state.json → ${STATE_FILE}`)
  log('A2-READY')
  console.log('A2-READY')

  // Stay alive (hold the instance child + mock).
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
  log('A2-STOPPED')
}

const [, , cmd] = process.argv
if (cmd === 'boot') await boot()
else if (cmd === 'stop') await stop()
else { console.error('usage: node a2perm-boot.mjs boot|stop'); process.exit(2) }
