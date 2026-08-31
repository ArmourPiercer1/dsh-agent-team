/**
 * boot-g8.mjs — G8-REVIEW reviewer-1 pristine-host, browser-less e2e driver.
 *
 * What this file is
 * -----------------
 * A single-process Node driver that (per the G8 brief §4/§5) boots ONE
 * pristine test-use DSH instance on port 3181 with the reviewer row
 * (plugin-g8.mjs) mounted through the public cordis.patch.yml seam, then
 * drives the frozen P8-T4 deterministic test client over the real
 * /team-remote RPC channel — no browser, no stable-instance touch.
 *
 * Serialization (brief): the external lockfile references/.dsh-test-g8.lock
 * is the only mechanism that guarantees one pristine-host harness at a time.
 * Protocol: absent -> write "G8-R1 <ISO>"; present with age < 10min -> poll
 * every 20s (max 75 times); age >= 10min -> remove as stale and retry.
 * Release: removed ONLY when the content still equals this run's marker.
 *
 * Preflight / postflight (brief): test-use tree git-clean before AND after;
 * :3080 answers 200 before AND after; port 3181 free before; fresh
 * workspace-internal DSH_HOME (references/.dsh-test-g8-r1) removed at the
 * end; the lock released at the very end.
 *
 * Scenarios (E1-E6) — see g8-report.md criterion mapping:
 *   E1 projection round-trip (9-field DTO, self-consistent ledger summary,
 *      provenance on the frame);
 *   E2 reconnect round-trip (scripted transport loss -> reconnecting +
 *      backoff; mutation while down; recovery apply at the newer
 *      generation; deep-equal vs a fresh raw pull);
 *   E3 stale responses ignored (captured gen-N frame re-injected after the
 *      client applied gen N+1 -> verdict 'stale', state unchanged);
 *   E4 ledger pagination stable under growth (pageLimit 3 walk; anchor
 *      advance; explicit anchor-0 re-read after an append is the SAME page
 *      with a higher total; the tracker guard rejects the off-anchor page);
 *   E5 typed errors + provenance (INSTANCE_NOT_FOUND pass-through with
 *      cause details; COMPATIBILITY_BLOCKED from the durable BLOCKED_FATAL
 *      state; malformed-params; contract-version-unsupported; unknown-method;
 *      every success carries provenance + requestToken echo);
 *   E6 wire negatives (no cookie -> 401 unauthorized; wrong content-type ->
 *      415; method != endpoint -> 200 bad-request) + the global invariant
 *      that no HTTP 5xx occurs anywhere in the run.
 *
 * Transient environment failure policy (brief): clean the untracked
 * leftovers (instance, DSH_HOME), retry the whole harness ONCE, and record
 * the episode in the summary (reported as a concern).
 *
 * Exit code: 0 = all scenario checks passed and every cleanup assertion
 * green; 1 = any scenario check failed or an unrecoverable environment
 * failure. e2e-run.log + harness-output/summary.json are written in both
 * cases (finally).
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const lines = []
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  lines.push(line)
  console.log(line)
}

// ── repo geometry (derived, never hardcoded) ───────────────────────────────
function findRepoRoot() {
  let dir = HERE
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(join(dir, 'references', 'deepseek-harness-test-use', 'package.json'))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('cannot locate repo root (references/deepseek-harness-test-use marker)')
}
const REPO_ROOT = findRepoRoot()
const WORKTREE = join(REPO_ROOT, '.worktrees', 'G8-R1')
const HOST_TREE = join(REPO_ROOT, 'references', 'deepseek-harness-test-use')
const DSH_HOME = join(REPO_ROOT, 'references', '.dsh-test-g8-r1')
const LOCK_FILE = join(REPO_ROOT, 'references', '.dsh-test-g8.lock')
const OUT_DIR = join(HERE, 'harness-output')
const LOG_FILE = join(HERE, 'e2e-run.log')
const ROW_FILE = join(HERE, 'plugin-g8.mjs')
const ROW_ID = 'g8r1-remote-e2e'
const ROW_URL = pathToFileURL(ROW_FILE).href

const PORT = 3181
const STABLE_URL = 'http://127.0.0.1:3080/'
const CLIENT_COMMIT_HASH = 'cd5ef814'
const TEAM_SESSION_ID = 'session-root-g8r1'
const HUMAN_CALLER = { kind: 'human', humanId: 'g8r1-reviewer' }
const WORKER_ID = 'inst-g8r1w1'
const WORKER_CHILD_SESSION = 'session-child-g8r1w1'
const NOW = '2026-08-30T09:00:00Z' // the row's deterministic harness clock
const PROJECTION_FIELDS = [
  'blueprint',
  'generation',
  'generatedAt',
  'ledger',
  'members',
  'root',
  'schemaVersion',
  'teamSessionId',
  'templates',
].sort()

// The tracked ts-loader hook (packages/runtime/root-binding/harness) rewrites
// relative .js -> .ts for parents under <worktree>/packages; it is REQUIRED
// before importing the worktree TS (p8t4-test-client.ts's relative imports).
register(pathToFileURL(join(WORKTREE, 'packages/runtime/root-binding/harness/ts-loader.mjs')).href, import.meta.url)
const repoTs = (rel) => pathToFileURL(join(WORKTREE, rel)).href

// Characterization harness reusables (committed at the integration SHA in
// the reviewed worktree).
const instanceLib = await import(pathToFileURL(join(WORKTREE, 'tests/characterization/lib/instance.mjs')).href)
const utilLib = await import(pathToFileURL(join(WORKTREE, 'tests/characterization/lib/util.mjs')).href)

// ── result bookkeeping ──────────────────────────────────────────────────────
const checks = []
function check(cond, label, detail) {
  const ok = Boolean(cond)
  checks.push({ ok, label, detail: detail === undefined ? '' : String(detail) })
  log(`${ok ? 'CHECK PASS' : 'CHECK FAIL'}  ${label}${detail !== undefined && !ok ? `  (got: ${String(detail).slice(0, 400)})` : ''}`)
  return ok
}
function deepEqual(a, b) {
  const canon = (v) =>
    JSON.stringify(v, (_, value) =>
      value !== null && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, value[k]]))
        : value,
    )
  return canon(a) === canon(b)
}
const httpLog = []
function trackHttp(where, status) {
  httpLog.push({ where, status })
  if (status >= 500) log(`HTTP 5xx observed at ${where}: ${status}`)
}

// ── git / preflight helpers ─────────────────────────────────────────────────
async function git(args, cwd) {
  const logPath = join(OUT_DIR, 'git-last.log')
  mkdirSync(OUT_DIR, { recursive: true })
  return utilLib.spawnToLog('git', ['-C', cwd, ...args], { cwd: REPO_ROOT, logPath, timeoutMs: 30_000 })
}

async function httpGetOk(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    trackHttp(`GET ${url}`, res.status)
    return res.status === 200
  } catch {
    return false
  }
}

function findZodDir() {
  const pnpm = join(HOST_TREE, 'node_modules', '.pnpm')
  const entry = readdirSync(pnpm)
    .filter((name) => name.startsWith('zod@'))
    .sort()
    .pop()
  if (entry === undefined) throw new Error('no zod@* entry under the test-use .pnpm store')
  const dir = join(pnpm, entry, 'node_modules', 'zod')
  if (!existsSync(dir)) throw new Error(`zod dir missing: ${dir}`)
  return dir
}

// ── lockfile protocol ───────────────────────────────────────────────────────
const MARKER = `G8-R1 ${new Date().toISOString()}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function acquireLock() {
  for (let i = 0; i < 75; i += 1) {
    if (!existsSync(LOCK_FILE)) {
      writeFileSync(LOCK_FILE, MARKER)
      log(`lock: acquired (${i === 0 ? 'immediately' : `after ${i} polls`})`)
      return true
    }
    const ageMs = Date.now() - statSync(LOCK_FILE).mtimeMs
    if (ageMs >= 10 * 60_000) {
      log(`lock: removing stale lock (age ${Math.round(ageMs / 1000)}s, holder: ${readFileSync(LOCK_FILE, 'utf8').trim()})`)
      rmSync(LOCK_FILE)
      continue
    }
    log(`lock: held (age ${Math.round(ageMs / 1000)}s), polling 20s (attempt ${i + 1}/75)`)
    await sleep(20_000)
  }
  log('lock: TIMEOUT after 75 polls (~25min)')
  return false
}
function releaseLock() {
  if (!existsSync(LOCK_FILE)) return
  const content = readFileSync(LOCK_FILE, 'utf8').trim()
  if (content === MARKER.trim()) {
    rmSync(LOCK_FILE)
    log('lock: released (marker matched)')
  } else {
    log(`lock: NOT released (content "${content.slice(0, 60)}..." != my marker)`)
  }
}

// ── one full harness attempt ────────────────────────────────────────────────
async function runOnce(summary) {
  const { DshInstance, ensureProfile, ensureProbeResolution } = instanceLib

  // fresh workspace-internal DSH_HOME
  rmSync(DSH_HOME, { recursive: true, force: true })
  mkdirSync(DSH_HOME, { recursive: true })

  // junction farm for the row's bare upstream imports (P5-T5 pattern)
  ensureProbeResolution({
    probesDir: HERE,
    packages: [
      { name: '@deepseek-ai/dsh-storage-domain', dir: join(HOST_TREE, 'packages', 'storage', 'storage-domain') },
      { name: 'zod', dir: findZodDir() },
    ],
    log,
  })

  // the row reads its configuration from DSH_HOME before the instance boots
  writeFileSync(
    join(DSH_HOME, 'g8-directive.json'),
    JSON.stringify({ worktree: WORKTREE, reportDir: HERE, teamSessionId: TEAM_SESSION_ID }, null, 2),
  )

  const instance = new DshInstance({
    hostTree: HOST_TREE,
    dshHome: DSH_HOME,
    port: PORT,
    clientCommitHash: CLIENT_COMMIT_HASH,
    logDir: OUT_DIR,
  })
  summary.instanceLog = instance.logPath

  try {
    const started = await bootAndMount(instance)
    await runScenarios(started, summary)
  } finally {
    // stop the instance inside the attempt (retries must start clean)
    const stop = await instance.stop()
    summary.lastStop = stop
    if (!stop.portFree) throw new Error(`port ${PORT} did not free after stop`)
    // harvest row-side artifacts before the DSH_HOME is removed
    for (const artifact of ['row-setup.json', 'setup-failure.json']) {
      const src = join(DSH_HOME, 'harness-output', artifact)
      if (existsSync(src)) copyFileSync(src, join(OUT_DIR, artifact))
    }
    rmSync(DSH_HOME, { recursive: true, force: true })
  }
}

async function bootAndMount(instance) {
  log('boot: ensureProfile (throwaway boot on a fresh DSH_HOME when needed)')
  await instanceLib.ensureProfile({ instance, log, timeoutMs: 120_000 })
  instance.mountRows([{ id: ROW_ID, name: ROW_URL }], ['g8-REVIEW reviewer-1: pristine-host e2e row (P8)'])
  log('boot: mounting row ' + ROW_ID + ' via cordis.patch.yml; starting instance (120s budget)')
  const started = await instance.start({ timeoutMs: 120_000 })
  summary.bootUrl = started.url
  log(`boot: marker url ${started.url}`)
  const dump = await instance.dumpConfig()
  writeFileSync(join(OUT_DIR, 'dump-config.txt'), dump.text)
  check(instanceLib.DshInstance.rowInDump(dump.text, { id: ROW_ID, name: ROW_URL }), 'dump-config: row present in the composed profile')
  log('boot: polling /__g8r1/health until the row finishes setup (90s deadline)')
  const health = await pollHealth(90_000)
  summary.healthFinal = health
  if (health === null || health.ready !== true) {
    const failure = existsSync(join(OUT_DIR, 'setup-failure.json'))
      ? readFileSync(join(OUT_DIR, 'setup-failure.json'), 'utf8')
      : '<no setup-failure.json; health>' + JSON.stringify(health)
    throw new Error(`row did not become ready: ${failure.slice(0, 2000)}`)
  }
  log(`boot: row ready (generation ${health.generation}, seeded ${health.seededLedgerEntries} ledger entries)`)
  return started
}

async function pollHealth(deadlineMs) {
  const deadline = Date.now() + deadlineMs
  let last = null
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/__g8r1/health`, { signal: AbortSignal.timeout(3000) })
      trackHttp('GET /__g8r1/health', res.status)
      if (res.status === 200) last = await res.json()
    } catch {
      last = null
    }
    if (last !== null && (last.ready === true || last.error !== null && last.error !== undefined)) return last
    if (Date.now() >= deadline) return last
    await sleep(500)
  }
}

// ── the browser-less client surface ─────────────────────────────────────────
async function runScenarios(started, summary) {
  const { createP8T4TestClient } = await import(repoTs('packages/remote/test/p8t4-test-client.ts'))
  const remoteSrc = await import(repoTs('packages/remote/src/index.ts'))

  // ── cookie mint (P2-T6 wire protocol) ─────────────────────────────────────
  const launch = new URL(started.url)
  const tx = await fetch(`http://127.0.0.1:${PORT}${launch.pathname}${launch.search}`, { redirect: 'manual' })
  trackHttp(`GET launch ${launch.pathname}`, tx.status)
  const setCookies = tx.headers.getSetCookie()
  const cookieLine = (Array.isArray(setCookies) ? setCookies : []).find((c) => c.startsWith('dsh-auth-'))
  check(tx.status === 302 || tx.status === 303, 'auth: launch URL redirects (302/303)', tx.status)
  check(cookieLine !== undefined, 'auth: Set-Cookie mints a dsh-auth-* cookie')
  const cookie = cookieLine === undefined ? '' : String(cookieLine).split(';')[0].trim()
  check(/^dsh-auth-[A-Za-z0-9_-]{43}=v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(cookie), 'auth: cookie shape', cookie.slice(0, 28))
  check(cookieLine !== undefined && cookieLine.includes('HttpOnly') && /SameSite=Strict/i.test(cookieLine), 'auth: cookie HttpOnly + SameSite=Strict')

  // side transport: direct wire calls (rpcPost), independent of the scripted
  // loss/injection state of the test-client transport.
  let sideN = 0
  async function rpcPost(endpoint, opts = {}) {
    sideN += 1
    const headers = { 'content-type': opts.contentType ?? 'application/json' }
    if (opts.auth !== false) headers.cookie = cookie
    const body = JSON.stringify({
      type: 'client-request',
      rpcId: `g8r1-side-${sideN}`,
      method: opts.wireMethod ?? endpoint,
      payload: opts.payload,
    })
    const res = await fetch(`http://127.0.0.1:${PORT}/team-remote/${endpoint}`, { method: 'POST', headers, body })
    trackHttp(`POST /team-remote/${endpoint}`, res.status)
    const text = await res.text()
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = undefined
    }
    if (parsed && parsed.result && parsed.result.ok === false) {
      log(`wire: ${endpoint} (side) -> typed error: ${JSON.stringify(parsed.result.error).slice(0, 500)}`)
    }
    return { status: res.status, body: parsed, text }
  }
  const sendPayload = (n) => ({
    teamSessionId: TEAM_SESSION_ID,
    caller: HUMAN_CALLER,
    recipientInstanceId: WORKER_ID,
    body: `g8r1 e2e message ${n}`,
    subject: `g8r1-e2e-${n}`,
    requestToken: `tok-g8r1-e${n}`,
    // mapping quirk (documented in the report): the real effect reads the
    // recipient/body/subject from `payload`, so a conforming wire client must
    // duplicate the fields there.
    payload: {
      recipientInstanceId: WORKER_ID,
      body: `g8r1 e2e message ${n}`,
      subject: `g8r1-e2e-${n}`,
    },
  })

  // scripted test-client transport (loss flag + stale-frame injection queue)
  const lossFlag = { down: false }
  const injectQueue = []
  const clientTransport = {
    async send(request) {
      if (injectQueue.length > 0) {
        const captured = injectQueue.shift()
        return { rpcId: request.rpcId, result: captured }
      }
      if (lossFlag.down) throw new remoteSrc.PushTransportLossError('g8r1 scripted transport loss (E2)')
      // Wire adaptation (documented, lossless): the seam types the
      // correlation id as a monotonic number (packages/remote/src/push/
      // types.ts:46,56), while the host Connection RPC bridge validates the
      // WIRE rpcId as a string (upstream rpc-schema.ts:7, z.string()) and
      // the frozen P2-T6 characterization mints string wire ids
      // ('p2t6-r<n>', tests/characterization/probes/remote-client/index.mjs:299).
      // The bridge echoes the string it received (rpc-host.ts:232,241), so
      // the binding maps number->string out and verifies the echo back.
      const wireRpcId = `g8r1-seam-${request.rpcId}`
      const res = await fetch(`http://127.0.0.1:${PORT}/team-remote/${request.method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ type: 'client-request', rpcId: wireRpcId, method: request.method, payload: request.payload }),
      })
      trackHttp(`POST /team-remote/${request.method} (client)`, res.status)
      if (res.status !== 200) {
        throw new Error(`unexpected HTTP ${res.status} on ${request.method}`) // -> unexpectedRejections
      }
      const body = await res.json()
      if (body && body.result && body.result.ok === false) {
        log(`wire: ${request.method} -> typed error: ${JSON.stringify(body.result.error).slice(0, 500)}`)
      }
      if (body.type !== 'server-response' || body.rpcId !== wireRpcId) {
        // Uncorrelated wire envelope (e.g. the host 'invalid-request'
        // sentinel) is a transport-level anomaly, not a typed RemoteResponse.
        throw new Error(`g8r1 transport: uncorrelated server-response (rpcId=${JSON.stringify(body && body.rpcId)})`)
      }
      return { rpcId: request.rpcId, result: body.result }
    },
  }

  const sinkLog = []
  const client = createP8T4TestClient({
    teamSessionId: TEAM_SESSION_ID,
    transport: clientTransport,
    backoff: { baseMs: 100, factor: 2, maxMs: 800 },
    pickDelayMs: (capMs) => capMs,
    pageLimit: 3,
    sinks: {
      onConnected: () => sinkLog.push('connected'),
      onStateChange: (s) => sinkLog.push(`state:${s}`),
      onFrameApplied: (f) => sinkLog.push(`frame:${f.projection.generation}`),
      onFrameRejected: (a) => sinkLog.push(`rejected:${a.status}`),
      onPageApplied: (p) => sinkLog.push(`page:${p.entries.length}/${p.total}`),
      onLoss: () => sinkLog.push('loss'),
    },
  })
  summary.sinkLog = sinkLog

  // ═══ E1 — projection round-trip ═══════════════════════════════════════════
  log('E1: start() — first projection pull')
  const a1 = await client.start()
  check(a1.status === 'apply', 'E1: first frame verdict apply', a1.status + (a1.code !== undefined ? ` code=${a1.code}` : ''))
  check(client.lastAppliedGeneration() === 1, 'E1: applied generation 1', client.lastAppliedGeneration())
  check(client.state() === 'connected', 'E1: state connected', client.state())
  const p1 = client.appliedFrame().projection
  check(
    JSON.stringify(Object.keys(p1).sort()) === JSON.stringify(PROJECTION_FIELDS),
    'E1: projection has exactly the nine frozen top-level fields',
    Object.keys(p1).sort(),
  )
  check(p1.schemaVersion === 1, 'E1: schemaVersion 1')
  check(p1.teamSessionId === TEAM_SESSION_ID, 'E1: teamSessionId echoes the root session')
  check(p1.generation === 1, 'E1: generation 1 (seeded)')
  check(p1.generatedAt === NOW, 'E1: generatedAt = the harness clock', p1.generatedAt)
  check(p1.blueprint !== null && typeof p1.blueprint === 'object', 'E1: blueprint snapshot ref present')
  check(String(p1.blueprint?.blueprintId) === 'P6T1-BP' && String(p1.blueprint?.revision) === '1', 'E1: blueprint id/revision', p1.blueprint)
  check(p1.root.compatibility.status === 'BLOCKED_FATAL', 'E1: root compatibility BLOCKED_FATAL (seeded durable state)')
  check(p1.root.admission === 'OPEN', 'E1: root admission OPEN')
  check(p1.root.creationBudgetConsumed === 0, 'E1: creation budget 0')
  check(Array.isArray(p1.templates) && p1.templates.length === 3, 'E1: three templates', p1.templates?.length)
  const templateIds = (p1.templates ?? []).map((t) => `${t.kind}:${t.templateId}`)
  check(
    deepEqual(templateIds, ['leader:leader', 'member:worker', 'member:scout']),
    'E1: template ordering leader/worker/scout',
    templateIds,
  )
  check(Array.isArray(p1.members) && p1.members.length === 2, 'E1: two members (leader + worker)', p1.members?.length)
  const leader = (p1.members ?? []).find((m) => m.instanceId === 'inst-leader')
  const worker = (p1.members ?? []).find((m) => m.instanceId === WORKER_ID)
  check(leader !== undefined && !('childSessionId' in leader), 'E1: leader member row WITHOUT childSessionId (invariant 14)')
  check(
    worker !== undefined && worker.childSessionId === WORKER_CHILD_SESSION,
    'E1: worker member row WITH childSessionId',
    worker,
  )
  check(
    leader !== undefined && worker !== undefined &&
      leader.lifecycle === 'RUNNING' && worker.lifecycle === 'RUNNING',
    'E1: both members RUNNING',
  )
  for (const [label, member] of [['leader', leader], ['worker', worker]]) {
    const ec = member?.effectiveConfig
    check(
      ec !== undefined &&
        typeof ec.model === 'object' && typeof ec.workspace === 'object' &&
        typeof ec.permissions === 'object' && typeof ec.autonomy === 'object',
      `E1: ${label} effectiveConfig carries the four frozen lanes`,
      ec,
    )
  }
  const L1 = p1.ledger
  const catSum = Object.values(L1.byCategory ?? {}).reduce((a, b) => a + b, 0)
  check(L1.latestSequence === 7, 'E1: ledger latestSequence 7 (seeded)', L1.latestSequence)
  check(L1.totalEntries === 7, 'E1: ledger totalEntries 7', L1.totalEntries)
  check(catSum === 7, 'E1: sum(byCategory) === totalEntries', catSum)
  check(
    deepEqual(L1.byCategory, { team: 1, member: 2, lifecycle: 1, message: 1, control: 1, policy: 0, compatibility: 0, progress: 1 }),
    'E1: byCategory matches the seeded facts',
    L1.byCategory,
  )
  check(L1.pendingControlCount === 1, 'E1: pendingControlCount 1 (one request-control, no resolve)', L1.pendingControlCount)
  const prov1 = client.appliedFrame().provenance
  check(
    prov1.origin === 'team-remote' &&
      prov1.method === 'team.getProjection' &&
      prov1.endpoint === 'team.getProjection' &&
      prov1.contractVersion === 1 &&
      prov1.requestToken === null &&
      prov1.projectionGeneration === 1 &&
      prov1.effectSequence === null,
    'E1: frame provenance (origin/method/endpoint/version/token/generation)',
    prov1,
  )

  // ═══ E2 — reconnect round-trip ════════════════════════════════════════════
  log('E2: scripted transport loss, mutation while down, recovery apply')
  lossFlag.down = true
  const a2 = await client.sync()
  check(a2.status === 'transport-loss', 'E2: loss verdict', a2.status)
  check(client.state() === 'reconnecting', 'E2: state reconnecting after loss', client.state())
  check(client.stats().transportLosses === 1, 'E2: transportLosses 1')
  check(client.backoffLog().length === 1 && client.backoffLog()[0].delayMs > 0, 'E2: backoff entry scheduled', client.backoffLog())
  const e2send = await rpcPost('member.send', { payload: { version: 1, params: sendPayload(2) } })
  check(e2send.status === 200 && e2send.body?.type === 'server-response' && e2send.body?.result?.ok === true, 'E2: send while down -> 200 ok (server unaffected)', e2send.status)
  const out2 = e2send.body?.result?.value?.data?.outcome
  check(out2?.status === 'executed' && out2?.action === 'send-message', 'E2: outcome executed send-message', out2)
  check(out2?.callerRole === 'human', 'E2: callerRole human', out2?.callerRole)
  check(out2?.targetInstanceId === WORKER_ID, 'E2: targetInstanceId worker', out2?.targetInstanceId)
  check(out2?.effect?.kind === 'fact-recorded' && out2?.effect?.factType === 'team-coordination-recorded', 'E2: durable effect fact-recorded', out2?.effect)
  check(out2?.effect?.sequence === 8, 'E2: effect sequence 8 (first append)', out2?.effect?.sequence)
  const prov2 = e2send.body?.result?.value?.provenance
  check(
    prov2?.origin === 'team-remote' && prov2?.method === 'member.send' && prov2?.requestToken === 'tok-g8r1-e2',
    'E2: provenance on the admission success (origin/method/requestToken echo)',
    prov2,
  )
  check(prov2?.effectSequence === null, 'E2: provenance.effectSequence null (facade effect carries `sequence`, not factSequence — documented nuance)', prov2?.effectSequence)
  lossFlag.down = false
  await client.advance(1_000_000_000)
  check(client.state() === 'connected', 'E2: state connected after recovery', client.state())
  check(client.lastAppliedGeneration() === 2, 'E2: recovery applied generation 2', client.lastAppliedGeneration())
  check(client.stats().framesApplied === 2, 'E2: framesApplied 2')
  check(client.stats().unexpectedRejections === 0, 'E2: no unexpected rejections', client.stats().unexpectedRejections)
  const raw2 = await rpcPost('team.getProjection', { payload: { version: 1, params: { teamSessionId: TEAM_SESSION_ID } } })
  const fresh2 = raw2.body?.result?.value?.data?.projection
  check(raw2.status === 200 && fresh2?.generation === 2, 'E2: fresh raw pull shows generation 2', fresh2?.generation)
  check(deepEqual(client.appliedFrame().projection, fresh2), 'E2: applied projection deep-equals the fresh raw pull (round-trip)')
  check(client.stats().rpcErrors === 0, 'E2: no rpc-error assessments', client.stats().rpcErrors)

  // ═══ E3 — stale responses ignored ═════════════════════════════════════════
  log('E3: capture gen-2 frame, mutate to gen 3, re-inject the stale frame')
  const rawBefore = await rpcPost('team.getProjection', { payload: { version: 1, params: { teamSessionId: TEAM_SESSION_ID } } })
  const capturedResult = rawBefore.body?.result
  check(rawBefore.status === 200 && capturedResult?.ok === true && capturedResult?.value?.data?.projection?.generation === 2, 'E3: captured gen-2 frame')
  const e3send = await rpcPost('member.send', { payload: { version: 1, params: sendPayload(3) } })
  check(e3send.status === 200 && e3send.body?.result?.ok === true && e3send.body?.result?.value?.data?.outcome?.effect?.sequence === 9, 'E3: second append -> sequence 9', e3send.body?.result?.value?.data?.outcome?.effect)
  const a3 = await client.sync()
  check(a3.status === 'apply' && client.lastAppliedGeneration() === 3, 'E3: sync applies generation 3', `${a3.status}/${client.lastAppliedGeneration()}`)
  injectQueue.push(capturedResult)
  const a4 = await client.sync()
  check(a4.status === 'stale', 'E3: re-injected gen-2 frame verdict stale', a4.status)
  check(client.stats().framesStale === 1, 'E3: framesStale 1')
  check(client.lastAppliedGeneration() === 3, 'E3: applied generation unchanged (still 3)')
  check(client.stats().framesInconsistent === 0, 'E3: rpcId correlation intact (no inconsistent)', client.stats().framesInconsistent)
  check(client.stats().framesApplied === 3, 'E3: framesApplied still 3')

  // ═══ E4 — ledger pagination stable under growth ═══════════════════════════
  log('E4: pageLimit-3 walk over the current ledger, then growth + re-read')
  const nBefore = (client.appliedFrame().projection.ledger ?? {}).totalEntries ?? 9
  log(`E4: ledger total before the E4 append: ${nBefore}`)
  const pg1 = await client.fetchPage()
  check(pg1.ok === true, 'E4: page 1 accepted by the tracker', pg1.reason)
  check(deepEqual((pg1.page?.entries ?? []).map((e) => e.sequence), [1, 2, 3]), 'E4: page 1 = seq 1-3', pg1.page?.entries?.map((e) => e.sequence))
  check(pg1.page?.nextAfterSequence === 3, 'E4: page 1 cursor 3')
  check(pg1.page?.total === nBefore, 'E4: page 1 total = current total', pg1.page?.total)
  check(client.pageAnchor() === 3, 'E4: anchor advanced to 3')
  const pg2 = await client.fetchPage()
  check(pg2.ok === true && deepEqual((pg2.page?.entries ?? []).map((e) => e.sequence), [4, 5, 6]) && pg2.page?.nextAfterSequence === 6, 'E4: page 2 = seq 4-6, cursor 6', pg2.page?.entries?.map((e) => e.sequence))
  check(client.pageAnchor() === 6, 'E4: anchor advanced to 6')
  const pg3 = await client.fetchPage()
  check(pg3.ok === true && deepEqual((pg3.page?.entries ?? []).map((e) => e.sequence), [7, 8, 9]) && pg3.page?.nextAfterSequence === null, 'E4: page 3 = seq 7-9, terminal cursor', pg3.page?.entries?.map((e) => e.sequence))
  check(client.pageAnchor() === 6, 'E4: anchor holds at 6 after the terminal page')
  check(client.stats().pagesApplied === 3 && client.stats().pagesRejected === 0, 'E4: tracker 3 applied / 0 rejected', client.stats())
  const firstPage = pg1.page?.entries
  const e4send = await rpcPost('member.send', { payload: { version: 1, params: sendPayload(4) } })
  check(e4send.status === 200 && e4send.body?.result?.ok === true && e4send.body?.result?.value?.data?.outcome?.effect?.sequence === nBefore + 1, 'E4: growth append -> next sequence', e4send.body?.result?.value?.data?.outcome?.effect?.sequence)
  const pg4 = await client.fetchPage(0)
  check(pg4.ok === false, 'E4: off-anchor explicit re-read rejected by the tracker guard', pg4.reason)
  check(pg4.page !== null && deepEqual(pg4.page.entries, firstPage), 'E4: re-reading anchor 0 after growth yields the SAME page (stable slicer)', pg4.page?.entries?.map((e) => e.sequence))
  check(pg4.page?.total === nBefore + 1, 'E4: total only moves up (append-only)', pg4.page?.total)
  check(client.stats().pagesRejected === 1, 'E4: tracker rejected exactly the off-anchor page')
  const pg5 = await client.fetchPage()
  check(pg5.ok === true && deepEqual((pg5.page?.entries ?? []).map((e) => e.sequence), [7, 8, 9]) && pg5.page?.nextAfterSequence === nBefore, 'E4: cursor continues from anchor 6 and sees the growth page (next = last seq of page, 9)', JSON.stringify(pg5.page))
  check(client.pageAnchor() === 9, 'E4: anchor advanced to 9 with the growth page', client.pageAnchor())
  const pg6 = await client.fetchPage()
  check(pg6.ok === true && deepEqual((pg6.page?.entries ?? []).map((e) => e.sequence), [nBefore + 1]) && pg6.page?.nextAfterSequence === null, 'E4: the growth entry is served as its own terminal page', JSON.stringify(pg6.page))

  // ═══ E5 — typed errors + provenance ═══════════════════════════════════════
  log('E5: typed domain/contract errors with provenance in details')
  const e5a = await rpcPost('member.send', {
    payload: {
      version: 1,
      params: {
        teamSessionId: TEAM_SESSION_ID,
        caller: HUMAN_CALLER,
        recipientInstanceId: 'inst-missing9',
        body: 'x',
        subject: 's',
        requestToken: 'tok-g8r1-err1',
        payload: { recipientInstanceId: 'inst-missing9', body: 'x', subject: 's' },
      },
    },
  })
  const err5a = e5a.body?.result?.error
  check(e5a.status === 200 && e5a.body?.result?.ok === false, 'E5a: 200 with typed error result (no 5xx)', e5a.status)
  check(err5a?.code === 'TEAM_RUNTIME_INSTANCE_NOT_FOUND', 'E5a: pass-through domain code INSTANCE_NOT_FOUND', err5a?.code)
  check(err5a?.details?.cause?.code === 'TEAM_RUNTIME_INSTANCE_NOT_FOUND' && typeof err5a?.details?.cause?.message === 'string', 'E5a: details.cause carries code + message', err5a?.details?.cause)
  check(
    err5a?.details?.cause?.details?.rootSessionId === TEAM_SESSION_ID &&
      err5a?.details?.cause?.details?.instanceId === 'inst-missing9',
    'E5a: source identity under details.cause.details',
    err5a?.details?.cause?.details,
  )
  check(
    err5a?.details?.method === 'member.send' &&
      err5a?.details?.endpoint === 'member.send' &&
      err5a?.details?.contractVersion === 1 &&
      err5a?.details?.requestToken === 'tok-g8r1-err1',
    'E5a: provenance folded into error details (method/endpoint/version/requestToken)',
    err5a?.details,
  )

  const e5b = await rpcPost('member.followup', {
    payload: {
      version: 1,
      params: {
        teamSessionId: TEAM_SESSION_ID,
        caller: HUMAN_CALLER,
        targetInstanceId: WORKER_ID,
        requestToken: 'tok-g8r1-err2',
        payload: { taskSummary: 'g8r1 follow-up attempt' },
      },
    },
  })
  const err5b = e5b.body?.result?.error
  check(e5b.status === 200 && e5b.body?.result?.ok === false, 'E5b: 200 with typed error result', e5b.status)
  check(err5b?.code === 'TEAM_RUNTIME_COMPATIBILITY_BLOCKED', 'E5b: new work (follow-up) blocked by the durable compatibility gate', err5b?.code)
  check(
    err5b?.details?.cause?.details?.status === 'BLOCKED_FATAL' &&
      err5b?.details?.cause?.details?.source === 'durable-state' &&
      err5b?.details?.cause?.details?.fingerprint === 'fp-g8r1-env',
    'E5b: gate reports the durable state (status/source/fingerprint)',
    err5b?.details?.cause?.details,
  )

  const e5c = await rpcPost('team.getProjection', { payload: { version: 1, params: { teamSessionId: 'x'.repeat(300) } } })
  const err5c = e5c.body?.result?.error
  check(e5c.status === 200 && err5c?.code === 'INVALID_ROOT_SESSION_ID' && err5c?.details?.field === 'teamSessionId', 'E5c: over-255 teamSessionId -> mirrored frozen P3 code (INVALID_ROOT_SESSION_ID) with field', JSON.stringify(err5c))

  const e5d = await rpcPost('team.getProjection', { payload: { version: 99, params: { teamSessionId: TEAM_SESSION_ID } } })
  const err5d = e5d.body?.result?.error
  check(e5d.status === 200 && err5d?.code === 'contract-version-unsupported', 'E5d: unsupported contract version', err5d?.code)

  const e5e = await rpcPost('team.nonexistent', {
    wireMethod: 'team.nonexistent',
    payload: { version: 1, params: { teamSessionId: TEAM_SESSION_ID } },
  })
  const err5e = e5e.body?.result?.error
  check(e5e.status === 200 && err5e?.code === 'unknown-method', 'E5e: unknown method (endpoint matches, not in the catalog)', err5e?.code)

  // ═══ E6 — wire negatives (P2-T6 frozen behavior) ══════════════════════════
  log('E6: wire negatives — auth, content-type, method/endpoint mismatch')
  const e6a = await rpcPost('team.getProjection', { auth: false, payload: { version: 1, params: { teamSessionId: TEAM_SESSION_ID } } })
  check(e6a.status === 401 && /unauthorized/i.test(e6a.text), 'E6a: no cookie -> 401 unauthorized', `${e6a.status} ${e6a.text.slice(0, 80)}`)
  const e6b = await rpcPost('team.getProjection', { contentType: 'text/plain', payload: { version: 1, params: { teamSessionId: TEAM_SESSION_ID } } })
  check(e6b.status === 415 && /content type must be application\/json/i.test(e6b.text), 'E6b: wrong content-type -> 415', `${e6b.status} ${e6b.text.slice(0, 80)}`)
  const e6c = await rpcPost('team.getProjection', {
    wireMethod: 'member.send',
    payload: { version: 1, params: { teamSessionId: TEAM_SESSION_ID } },
  })
  check(e6c.status === 200 && e6c.body?.result?.error?.code === 'bad-request', 'E6c: method != endpoint -> 200 bad-request', `${e6c.status} ${e6c.body?.result?.error?.code}`)

  // ── final invariants ──────────────────────────────────────────────────────
  check(httpLog.every((h) => h.status < 500), 'GLOBAL: no HTTP 5xx anywhere in the run', httpLog.filter((h) => h.status >= 500))
  check(client.stats().unexpectedRejections === 0, 'GLOBAL: no unexpected transport rejections', client.stats().unexpectedRejections)

  // final health: every tracked durability promise settled without failure
  const deadline = Date.now() + 15_000
  let finalHealth = null
  for (;;) {
    const res = await fetch(`http://127.0.0.1:${PORT}/__g8r1/health`, { signal: AbortSignal.timeout(3000) })
    trackHttp('GET /__g8r1/health (final)', res.status)
    if (res.status === 200) finalHealth = await res.json()
    if (finalHealth !== null && finalHealth.durability.pending === 0) break
    if (Date.now() >= deadline) break
    await sleep(500)
  }
  summary.healthFinal = finalHealth
  check(finalHealth?.ready === true, 'FINAL: row still ready')
  check(finalHealth?.durability?.failed === 0, 'FINAL: zero failed durability promises on the real host store', finalHealth?.durability)
  check(finalHealth?.durability?.settled > 0, 'FINAL: durability promises settled (real on-disk writes happened)', finalHealth?.durability)
  check(finalHealth?.generation >= 4, 'FINAL: generation advanced with the durable effects (H2)', finalHealth?.generation)

  summary.clientStats = client.stats()
  summary.backoffLog = client.backoffLog()
  summary.stateHistory = client.stateHistory()
  summary.pageAnchor = client.pageAnchor()
}

// ── preflight / postflight ──────────────────────────────────────────────────
async function preflight(summary) {
  const wt = await git(['status', '--porcelain'], WORKTREE)
  // The reviewer's own evidence dir is untracked and expected; everything
  // else must be pristine (no modified/staged files, no other untracked).
  const wtLines = wt.text.trim() === '' ? [] : wt.text.trim().split('\n')
  // Git collapses untracked dirs to their topmost untracked ancestor: the
  // whole G8-REVIEW evidence dir shows as one entry; only that gate evidence
  // root may be untracked (my reviewer-1 sub-dir is the only content in it).
  const unexpectedWt = wtLines.filter((line) => {
    const pathPart = line.slice(3).trim().replace(/^"|"$/g, '')
    return !(line.startsWith('??') && pathPart.startsWith('dev/agent-workflow/evidence/G8-REVIEW'))
  })
  check(wt.ok && unexpectedWt.length === 0, 'preflight: worktree clean (only my untracked evidence dir)', unexpectedWt.slice(0, 5))
  const host = await git(['status', '--porcelain'], HOST_TREE)
  check(host.ok && host.text.trim() === '', 'preflight: test-use tree clean (pristine upstream)', host.text.trim().split('\n').slice(0, 5))
  check(await httpGetOk(STABLE_URL), 'preflight: stable :3080 answers 200 (untouched)')
  const { portInUse } = await import(pathToFileURL(join(WORKTREE, 'tests/characterization/lib/util.mjs')).href)
  check((await portInUse(PORT)) === false, 'preflight: port 3181 free')
}

async function postflight(summary) {
  const host = await git(['status', '--porcelain'], HOST_TREE)
  check(host.ok && host.text.trim() === '', 'postflight: test-use tree still clean', host.text.trim().split('\n').slice(0, 5))
  check(existsSync(DSH_HOME) === false, 'postflight: fresh DSH_HOME removed')
  check(await httpGetOk(STABLE_URL), 'postflight: stable :3080 still 200')
}

// ── main ────────────────────────────────────────────────────────────────────
const summary = {
  ranAt: new Date().toISOString(),
  worktree: WORKTREE,
  hostTree: HOST_TREE,
  port: PORT,
  clientCommitHash: CLIENT_COMMIT_HASH,
  teamSessionId: TEAM_SESSION_ID,
  attempts: 0,
  e2e: null,
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  log('G8-REVIEW reviewer-1 pristine-host e2e (driver boot-g8.mjs)')
  log(`worktree: ${WORKTREE}`)
  const top = await git(['rev-parse', '--show-toplevel'], WORKTREE)
  const head = await git(['rev-parse', 'HEAD'], WORKTREE)
  const hostHead = await git(['rev-parse', '--short', 'HEAD'], HOST_TREE)
  log(`proof: worktree toplevel=${top.text.trim()} HEAD=${head.text.trim()}`)
  log(`proof: test-use tree HEAD=${hostHead.text.trim()} (clientCommitHash=${CLIENT_COMMIT_HASH})`)
  log(`proof: node=${process.version} platform=${process.platform}`)
  summary.worktreeHead = head.text.trim()
  summary.hostTreeHead = hostHead.text.trim()

  await preflight(summary)

  const locked = await acquireLock()
  if (!locked) {
    summary.e2e = 'NOT-RUN(LOCK-TIMEOUT)'
    return
  }
  try {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      summary.attempts = attempt
      try {
        await runOnce(summary)
        await postflight(summary)
        const failed = checks.filter((c) => !c.ok)
        if (failed.length === 0) {
          summary.e2e = 'RUN(PASS)'
        } else {
          summary.e2e = `RUN(${failed.length} scenario failures: ${failed.map((f) => f.label).join(' | ')})`
        }
        return
      } catch (error) {
        const message = error instanceof Error ? error.stack ?? error.message : String(error)
        log(`attempt ${attempt}: environment failure: ${message.slice(0, 1500)}`)
        summary.attemptErrors = summary.attemptErrors ?? []
        summary.attemptErrors.push(String(message).slice(0, 3000))
        if (attempt === 1) {
          log('attempt 1 failed — cleaning leftovers and retrying ONCE (brief: transient env failure policy)')
          try {
            rmSync(DSH_HOME, { recursive: true, force: true })
          } catch {
            /* best effort */
          }
          continue
        }
        summary.e2e = `NOT-RUN(env failure: ${String(error instanceof Error ? error.message : error).slice(0, 200)})`
        return
      }
    }
  } finally {
    releaseLock()
  }
}

try {
  await main()
} catch (error) {
  log(`driver fatal: ${error instanceof Error ? error.stack : String(error)}`)
  summary.e2e = summary.e2e ?? `NOT-RUN(driver fatal: ${String(error instanceof Error ? error.message : error).slice(0, 200)})`
  releaseLock()
}

// ── artifacts ───────────────────────────────────────────────────────────────
const failedChecks = checks.filter((c) => !c.ok)
const summaryJson = {
  ...summary,
  checks: { passed: checks.length - failedChecks.length, total: checks.length, failed: failedChecks.map((f) => f.label) },
  checkDetails: checks,
  httpLog,
}
writeFileSync(join(OUT_DIR, 'summary.json'), JSON.stringify(summaryJson, null, 2))
writeFileSync(LOG_FILE, lines.join('\n') + '\n')
log(`artifacts written: ${LOG_FILE} + ${join(OUT_DIR, 'summary.json')}`)
log(`RESULT: e2e=${summary.e2e} checks=${summaryJson.checks.passed}/${summaryJson.checks.total}`)
process.exitCode = summary.e2e === 'RUN(PASS)' && failedChecks.length === 0 ? 0 : 1
