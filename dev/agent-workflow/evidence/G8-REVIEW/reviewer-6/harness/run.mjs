#!/usr/bin/env node
/**
 * run.mjs — G8-REVIEW reviewer-6 (N=6, round R61) pristine-host, browserless
 * remote e2e driver.
 *
 * Boots a REAL DSH test instance (test-use tree @ cd5ef814, `apps/cli/lib/bin.js
 * web --port 3186 --no-open`) under a FRESH DSH_HOME
 * (`references/.dsh-test-g8-r6`, workspace-internal, gitignored), mounts the
 * single harness row (`plugin.mjs`) through the public profile-patch seam
 * (`<DSH_HOME>/profiles/web/cordis.patch.yml` — the ONLY allowed seam), and
 * drives the real remote seam end to end through the six scenarios:
 *
 *   E1  initial connect + pull: frame apply, full provenance, 9-field
 *       projection, member rows (leader WITHOUT childSessionId — invariant
 *       14), bonus success RPCs (catalog.list / intent.probe / legacy.inspect)
 *   E2  process restart (boot 2, SAME DSH_HOME): fresh client re-pulls, FULL
 *       deep-equality of the whole projection (deterministic clock C0 makes
 *       generatedAt identical) — proves reconnect round-trip AND real
 *       durability of the persisted TeamDomain
 *   E3  stale response ignored: durable fact advances the generation, a
 *       scripted stale (old-generation) getProjection response is served to
 *       the push client, which must verdict `stale`, keep its applied state,
 *       and recover to the new generation on the next real sync
 *   E4  ledger pagination stable: page(0,2) -> growth -> re-fetch of the
 *       consumed anchor is rejected `anchor-mismatch` by the tracker (cursor
 *       never moves on a stale in-flight page) while the RAW same-anchor RPC
 *       still returns the identical entries (server-side stable slice) with a
 *       total that only moves up; then page(2,2) walks to the tail
 *   E5  typed error / envelope discipline: TEAM_SESSION_NOT_FOUND (direct +
 *       through the push client as rpc-error), contract-version-unsupported,
 *       INSTANCE_NOT_FOUND pass-through with details.cause, malformed-request
 *       for an unknown envelope field, and full provenance on a success
 *   E6  wire auth / content-type / routing: no cookie -> 401, wrong
 *       content-type -> 415, wire method != URL endpoint -> 200 bad-request
 *       ("does not match endpoint"), unknown endpoint -> 200 unknown-method
 *
 * Pristine self-checks: test-use `git status --porcelain` captured before and
 * after (must be identical; the two pre-existing deletions are recorded
 * baseline dirt, not this run's), :3080 probed (read-only GET) before and
 * after (must be 200), external lockfile `references/.dsh-test-g8.lock`
 * (marker `G8-R6 <ISO>`, full retry loop <= 75 x 20 s, stale >= 10 min removed)
 * guards the shared test infrastructure.
 *
 * Exit codes: 0 = all scenarios pass; 2 = scenario failure or preflight
 * failure; 3 = lock timeout (e2e NOT-RUN). A transient env failure (boot
 * failure, row setup-failed, network loss) triggers cleanup + exactly ONE
 * retry, recorded in summary.concerns (does not fail a criterion by itself).
 *
 * Outputs (all under the reviewer-6 evidence dir):
 *   e2e-run.log, harness-output/summary.json, harness-output/g8r6-obs.json,
 *   harness-output/dump-config-boot{1,2}.txt, harness-output/logs/*.log,
 *   setup-failure.json (only on row setup failure).
 *
 * No subagents, no workflow, no ralph — plain driver in one process.
 */
import { register } from 'node:module'
import { spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

import {
  DshInstance,
  ensureProfile,
  ensureProbeResolution,
} from '../../../../../../tests/characterization/lib/instance.mjs'
import { portInUse, waitForPortFree } from '../../../../../../tests/characterization/lib/util.mjs'

// The TS resolution hook must be registered BEFORE the first dynamic import
// of a worktree .ts module (Node 24 native type-stripping loads the .ts).
register(new URL('./ts-loader.mjs', import.meta.url), import.meta.url)

const remoteMod = await import('../../../../../../packages/remote/src/index.js')
const clientMod = await import('../../../../../../packages/remote/test/p8t4-test-client.js')

// ── paths & constants ──────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url))
const EV = resolve(HERE, '..')
const OUT = join(EV, 'harness-output')
const WORKTREE = resolve(HERE, '..', '..', '..', '..', '..', '..')
const REPO_ROOT = resolve(WORKTREE, '..', '..')
const REFS = join(REPO_ROOT, 'references')
const TEST_USE = join(REFS, 'deepseek-harness-test-use')
const DSH_HOME = join(REFS, '.dsh-test-g8-r6')
const LOCK = join(REFS, '.dsh-test-g8.lock')

const PORT = 3186
const DEV_URL = 'http://127.0.0.1:3080/'
const CLIENT_COMMIT_HASH = 'cd5ef814'

// Fixture contract (must match plugin.mjs exactly).
const TEAM_ID = 'session-g8r6-team'
const LEADER_ID = 'inst-leader'
const WORKER_ID = 'inst-g8r6worker'
const LEADER_TEMPLATE = 'tpl-g8r6-leader'
const WORKER_CHILD = 'session-g8r6-child-worker'
const WORKER_WORKSPACE = 'C:/g8r6/work/worker'
const DEFAULT_WORKSPACE = 'C:/g8r6/work'
const BP_ID = 'g8r6.team'
const C0 = '2026-08-31T09:00:00.000Z'

const COOKIE_RE = /^dsh-auth-[A-Za-z0-9_-]{43}=v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const COMPAT_STATUS_VOCAB = ['OPEN', 'BLOCKED_WARNING', 'BLOCKED_FATAL', 'DEGRADED_ACKNOWLEDGED']
const LEGACY_STATUS_VOCAB = ['legacy-team', 'native-fallback']
const BACKOFF = { baseMs: 20, factor: 2, maxMs: 10_000 }

const ZOD_DIR = join(TEST_USE, 'node_modules', '.pnpm', 'zod@4.4.3', 'node_modules', 'zod')
const YAML_DIR = join(TEST_USE, 'node_modules', '.pnpm', 'yaml@2.9.0', 'node_modules', 'yaml')

const LOCK_MARKER = `G8-R6 ${new Date().toISOString()}`
const LOG_PATH = join(EV, 'e2e-run.log')
const ROW = { id: 'g8r6-remote-seam', name: pathToFileURL(join(HERE, 'plugin.mjs')).href }
const ROW_HEADER = [
  'g8r6 reviewer-6 remote e2e row (pristine host; the ONLY mounted row; public profile-patch seam)',
]
const KNOWN_PRE_EXISTING_DIRT = [
  ' D vendor/cordis/LICENSE',
  ' D vendor/cordis/bin.js',
]

// ── logging + summary state ────────────────────────────────────────────────

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  try {
    mkdirSync(EV, { recursive: true })
    writeFileSync(LOG_PATH, `${line}\n`, { flag: 'a' })
  } catch {
    /* logging must never kill the run */
  }
  console.log(line)
}

const summary = {
  reviewer: 'g8r6',
  gate: 'G8-REVIEW',
  round: 'R61',
  phase: 'P8 (int/P8-remote-projection @ 3fa4c1f27ed1e8903c131dadc9aafe536ed9eb86)',
  node: process.version,
  port: PORT,
  teamSessionId: TEAM_ID,
  startedAt: null,
  finishedAt: null,
  testUse: { dir: TEST_USE, baselinePorcelain: null, afterPorcelain: null, dirtyDelta: null },
  devUrl: { before: null, after: null },
  lock: null,
  boots: {},
  compatProbeStatus: null,
  legacyInspectStatus: null,
  postStop: null,
  scenarios: {},
  concerns: [],
  outcome: null,
  allPass: false,
  exitCode: null,
}

class EnvError extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const truncate = (s, n) => (s.length > n ? `${s.slice(0, n)} …(+${s.length - n})` : s)

// ── small utilities ────────────────────────────────────────────────────────

function gitStatusLines(cwd) {
  // FILE-FD stdio (not pipes): piped stdio is EPERM-denied in this
  // Windows sandbox (the same reason the boot chain uses file stdio).
  const outFile = join(EV, `.git-status-tmp-${process.pid}.txt`)
  const fd = openSync(outFile, 'w')
  let cp
  try {
    cp = spawnSync('git', ['status', '--porcelain'], { cwd, stdio: ['ignore', fd, fd], timeout: 60_000 })
  } finally {
    closeSync(fd)
  }
  const text = readFileSync(outFile, 'utf8')
  rmSync(outFile, { force: true })
  if (cp.error !== undefined || cp.status !== 0) {
    throw new EnvError(
      `git status failed in ${cwd}: ${cp.error?.message ?? `exit ${cp.status}`}\n${text}`,
    )
  }
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0).sort()
}

async function probeUrl(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) })
    await res.body?.cancel().catch(() => {})
    return { status: res.status }
  } catch (error) {
    return { status: null, error: String(error?.message ?? error) }
  }
}

function deepDetail(a, b) {
  if (isDeepStrictEqual(a, b)) return ''
  const ja = JSON.stringify(a) ?? String(a)
  const jb = JSON.stringify(b) ?? String(b)
  let i = 0
  while (i < ja.length && i < jb.length && ja[i] === jb[i]) i += 1
  return `first diff @${i}: a=${truncate(ja.slice(Math.max(0, i - 60), i + 140), 220)} b=${truncate(jb.slice(Math.max(0, i - 60), i + 140), 220)}`
}

// ── assertion machinery ────────────────────────────────────────────────────

let currentScenario = null

function beginScenario(name, note) {
  currentScenario = { name, note, checks: [], pass: true, error: null }
  log(`── scenario ${name}${note ? ` — ${note}` : ''}`)
}

function check(name, cond, detail = '') {
  const ok = cond === true
  if (currentScenario === null) throw new Error(`check outside a scenario: ${name}`)
  currentScenario.checks.push({ name, pass: ok, detail: truncate(String(detail), 1500) })
  if (!ok) currentScenario.pass = false
  log(`   ${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` — ${truncate(String(detail), 600)}`}`)
}

async function runScenario(name, note, fn) {
  const earlierFailed = Object.values(summary.scenarios).some((s) => s.pass === false)
  if (earlierFailed) {
    summary.scenarios[name] = { name, note, checks: [], pass: null, error: 'not-run (earlier scenario failed)', notRun: true }
    log(`── scenario ${name} NOT RUN (earlier scenario failed)`)
    return
  }
  beginScenario(name, note)
  await fn()
  summary.scenarios[name] = currentScenario
  log(`── scenario ${name} ${currentScenario.pass ? 'PASS' : 'FAIL'} (${currentScenario.checks.length} checks)`)
  currentScenario = null
}

// ── wire primitives (the driver's own seam client) ─────────────────────────

let cookie = null
let staleScript = null        // RemoteResponse served to the next pull (E3)
let lastGetProjection = null  // last ok team.getProjection RemoteResponse captured
let directRpcCounter = 1000

/**
 * The p8t4 push client's transport: real HTTP over the public seam channel.
 * Non-200 / non-JSON / network -> PushTransportLossError (the closed
 * transport-loss signal the client engine understands).
 */
const transport = {
  async send(request) {
    if (staleScript !== null) {
      return { rpcId: request.rpcId, result: staleScript }
    }
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/team-remote/${encodeURIComponent(request.method)}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(cookie !== null ? { cookie } : {}),
        },
        // Seam boundary: the seam contract (SeamClientRequest.rpcId) is a
        // number; the host Connection envelope (clientRequestSchema) requires
        // a string RpcId. The transport converts in both directions.
        body: JSON.stringify({
          type: 'client-request',
          rpcId: String(request.rpcId),
          method: request.method,
          payload: request.payload,
        }),
        signal: AbortSignal.timeout(30_000),
      })
      const text = await res.text()
      if (res.status !== 200) {
        throw new remoteMod.PushTransportLossError(`http ${res.status} on ${request.method}: ${text.slice(0, 300)}`)
      }
      let body
      try {
        body = JSON.parse(text)
      } catch {
        throw new remoteMod.PushTransportLossError(`non-JSON 200 on ${request.method}: ${text.slice(0, 300)}`)
      }
      if (body === null || typeof body !== 'object' || body.type !== 'server-response') {
        throw new remoteMod.PushTransportLossError(`unexpected wire body on ${request.method}: ${text.slice(0, 300)}`)
      }
      // Reverse conversion of the seam boundary. The host always answers with
      // the string RpcId it parsed (or 'invalid-request' for a broken
      // envelope); Number() maps a correlated answer back to the numeric seam
      // id, and a mismatched one to NaN — which the client engine's own
      // correlation check then reports as 'inconsistent'. No echo fallback:
      // echoing request.rpcId would mask every host-level rejection.
      const response = {
        rpcId: Number(body.rpcId),
        result: body.result,
      }
      if (request.method === 'team.getProjection' && body.result !== null && typeof body.result === 'object' && body.result.ok === true) {
        lastGetProjection = body.result
      }
      return response
    } catch (error) {
      if (error instanceof remoteMod.PushTransportLossError) throw error
      throw new remoteMod.PushTransportLossError(`transport loss on ${request.method}: ${error?.message ?? error}`)
    }
  },
}

/** Raw RPC with explicit wire knobs (E4 raw slice, E5 errors, E6 wire rules). */
async function rpcDirect({ method, params, version = 1, extraPayload, contentType = 'application/json', urlMethod = method, noCookie = false }) {
  const payload = extraPayload !== undefined ? extraPayload : { version, params }
  const headers = { 'content-type': contentType }
  if (!noCookie && cookie !== null) headers.cookie = cookie
  let res
  try {
    res = await fetch(`http://127.0.0.1:${PORT}/team-remote/${encodeURIComponent(urlMethod)}`, {
      method: 'POST',
      headers,
      // Host envelope requires a string RpcId (same seam-boundary conversion
      // as transport.send); a numeric rpcId would be rejected as an invalid
      // client-request before any endpoint logic runs.
      body: JSON.stringify({ type: 'client-request', rpcId: String(++directRpcCounter), method, payload }),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (error) {
    throw new EnvError(`rpcDirect ${method}: network failure: ${error?.message ?? error}`)
  }
  const text = await res.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    /* non-JSON bodies (401/415) are evidence by status code */
  }
  return { status: res.status, body, rawText: body === null ? text.slice(0, 300) : null }
}

/** Append one durable fact through the harness control route (real ledger put). */
async function postFact(note) {
  let res
  try {
    res = await fetch(`http://127.0.0.1:${PORT}/__g8r6/fact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note }),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (error) {
    throw new EnvError(`postFact '${note}': network failure: ${error?.message ?? error}`)
  }
  const text = await res.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    /* fall through to the status check */
  }
  if (res.status !== 200) {
    throw new EnvError(`postFact '${note}': http ${res.status}: ${text.slice(0, 300)}`)
  }
  return body
}

/** Mint the auth cookie from the launch URL (302/303 + Set-Cookie discipline). */
async function mintCookie(url) {
  let res
  try {
    res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20_000) })
  } catch (error) {
    return { ok: false, status: null, error: String(error?.message ?? error) }
  }
  const status = res.status
  const setCookies = res.headers.getSetCookie()
  await res.body?.cancel().catch(() => {})
  const auth = setCookies.find((c) => c.startsWith('dsh-auth-'))
  const segment = auth === undefined ? null : auth.split(';')[0].trim()
  const regexOk = segment !== null && COOKIE_RE.test(segment)
  return {
    ok: (status === 302 || status === 303) && regexOk,
    status,
    setCookieCount: setCookies.length,
    regexOk,
    segment,
    segmentPrefix: segment === null ? null : `${segment.slice(0, 14)}…`,
  }
}

/** Poll the row's obs file until it reports a terminal phase (or timeout). */
async function pollObs(timeoutMs) {
  const obsPath = join(OUT, 'g8r6-obs.json')
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (existsSync(obsPath)) {
      try {
        const obs = JSON.parse(readFileSync(obsPath, 'utf8'))
        if (obs !== null && typeof obs === 'object' && (obs.phase === 'ready' || obs.phase === 'setup-failed')) {
          return obs
        }
      } catch {
        /* partial write — keep polling */
      }
    }
    if (Date.now() >= deadline) return null
    await sleep(500)
  }
}

function readSetupFailure() {
  const p = join(EV, 'setup-failure.json')
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

function writeDirective(boot) {
  writeFileSync(join(DSH_HOME, 'g8r6-directive.json'), JSON.stringify({ boot, reportDir: EV }, null, 2))
  log(`directive boot=${boot} written to ${join(DSH_HOME, 'g8r6-directive.json')}`)
}

// ── lock ───────────────────────────────────────────────────────────────────

async function acquireLock() {
  for (let i = 1; i <= 75; i += 1) {
    if (!existsSync(LOCK)) {
      try {
        writeFileSync(LOCK, `${LOCK_MARKER}\n`, { flag: 'wx' })
        log(`lock acquired (attempt ${i}, marker '${LOCK_MARKER}')`)
        return true
      } catch {
        /* raced with another reviewer — retry */
      }
    } else {
      let ageMs = null
      let holder = ''
      try {
        ageMs = Date.now() - statSync(LOCK).mtimeMs
        holder = readFileSync(LOCK, 'utf8').trim()
      } catch {
        continue /* vanished between check and read */
      }
      if (ageMs !== null && ageMs >= 10 * 60_000) {
        log(`lock stale (age ${(ageMs / 60_000).toFixed(1)} min, holder '${truncate(holder, 80)}') — removing per policy`)
        try {
          rmSync(LOCK)
        } catch {
          /* raced — retry */
        }
        continue
      }
      log(`lock held (attempt ${i}/75, age ${Math.round(ageMs / 1000)}s, holder '${truncate(holder, 80)}') — waiting 20s`)
      await sleep(20_000)
    }
  }
  return false
}

// ── scenarios ──────────────────────────────────────────────────────────────

let e1Snapshot = null
let client3 = null

async function scenarioE1(e1Gen) {
  const frameSinks = []
  const client1 = clientMod.createP8T4TestClient({
    teamSessionId: TEAM_ID,
    transport,
    backoff: BACKOFF,
    sinks: { onFrameApplied: (frame) => frameSinks.push(frame) },
  })
  const initial = await client1.start()
  check('E1.1 start verdict is apply', initial.status === 'apply', JSON.stringify(initial))
  const applied = client1.appliedFrame()
  check('E1.2 frame applied', applied !== null, 'appliedFrame() is null')
  if (applied === null) return
  const prov = applied.provenance
  check('E1.3 provenance.origin = team-remote', prov.origin === 'team-remote', JSON.stringify(prov))
  check(
    'E1.4 provenance method/endpoint = team.getProjection',
    prov.method === 'team.getProjection' && prov.endpoint === 'team.getProjection',
    JSON.stringify(prov),
  )
  check(
    'E1.5 provenance.contractVersion = REMOTE_CONTRACT_VERSION',
    prov.contractVersion === remoteMod.REMOTE_CONTRACT_VERSION,
    `${prov.contractVersion} vs ${remoteMod.REMOTE_CONTRACT_VERSION}`,
  )
  check('E1.6 provenance.requestToken = null (read pull)', prov.requestToken === null, JSON.stringify(prov.requestToken))
  check(
    'E1.7 provenance.projectionGeneration = received generation',
    prov.projectionGeneration === initial.receivedGeneration,
    `${prov.projectionGeneration} vs ${initial.receivedGeneration}`,
  )
  const proj = applied.projection
  const missing = remoteMod.REMOTE_PROJECTION_FIELDS.filter((f) => !Object.prototype.hasOwnProperty.call(proj, f))
  check(
    'E1.8 projection carries all 9 REMOTE_PROJECTION_FIELDS',
    missing.length === 0,
    `missing ${JSON.stringify(missing)}; keys ${JSON.stringify(Object.keys(proj))}`,
  )
  check('E1.9 teamSessionId matches', proj.teamSessionId === TEAM_ID, proj.teamSessionId)
  check('E1.10 generation matches row obs', proj.generation === e1Gen, `${proj.generation} vs ${e1Gen}`)
  check('E1.11 schemaVersion = 1', proj.schemaVersion === 1, String(proj.schemaVersion))
  check('E1.12 generatedAt deterministic (clock C0)', proj.generatedAt === C0, proj.generatedAt)
  const root = proj.root ?? {}
  check(
    'E1.13 root facts (policyState default / admission OPEN)',
    root.policyState === 'default' && root.admission === 'OPEN',
    JSON.stringify(root),
  )
  const leader = (proj.members ?? []).find((m) => m.instanceId === LEADER_ID)
  const worker = (proj.members ?? []).find((m) => m.instanceId === WORKER_ID)
  check(
    'E1.14 leader row present with the leader template',
    leader !== undefined && leader.templateId === LEADER_TEMPLATE,
    JSON.stringify(leader),
  )
  check(
    'E1.15 leader row carries NO childSessionId key (invariant 14)',
    leader !== undefined && !('childSessionId' in leader),
    JSON.stringify(leader),
  )
  check(
    'E1.16 leader effective workspace = team default',
    leader !== undefined && leader.workspace === DEFAULT_WORKSPACE,
    JSON.stringify(leader?.workspace),
  )
  check(
    'E1.17 worker row present with its childSessionId',
    worker !== undefined && worker.childSessionId === WORKER_CHILD,
    JSON.stringify(worker),
  )
  check(
    'E1.18 worker effective workspace = instance workspace',
    worker !== undefined && worker.workspace === WORKER_WORKSPACE,
    JSON.stringify(worker?.workspace),
  )
  e1Snapshot = structuredClone(applied.projection)

  // Bonus success RPCs over the raw wire (shape + provenance on the wire).
  const catList = await rpcDirect({ method: 'catalog.list', params: {} })
  check('E1.19 catalog.list HTTP 200', catList.status === 200, `status ${catList.status} ${catList.rawText ?? ''}`)
  check(
    'E1.20 catalog.list ok + exact blueprint list',
    catList.body?.result?.ok === true
      && isDeepStrictEqual(catList.body?.result?.value?.data?.blueprints, [{ blueprintId: BP_ID, revisions: [1] }]),
    JSON.stringify(catList.body?.result),
  )
  check(
    'E1.21 catalog.list success carries provenance',
    catList.body?.result?.value?.provenance?.origin === 'team-remote'
      && catList.body?.result?.value?.provenance?.method === 'catalog.list',
    JSON.stringify(catList.body?.result?.value?.provenance),
  )
  const probe = await rpcDirect({ method: 'intent.probe', params: { blueprintId: BP_ID, environmentFacts: [] } })
  check(
    'E1.22 intent.probe ok + compatibility status in the closed vocab',
    probe.status === 200
      && probe.body?.result?.ok === true
      && COMPAT_STATUS_VOCAB.includes(probe.body?.result?.value?.data?.compatibility?.status),
    JSON.stringify(probe.body?.result),
  )
  summary.compatProbeStatus = probe.body?.result?.value?.data?.compatibility?.status
  const legacy = await rpcDirect({ method: 'legacy.inspect', params: { dshHome: DSH_HOME } })
  check(
    'E1.23 legacy.inspect ok + status in the closed vocab',
    legacy.status === 200
      && legacy.body?.result?.ok === true
      && LEGACY_STATUS_VOCAB.includes(legacy.body?.result?.value?.data?.inspection?.status),
    JSON.stringify(legacy.body?.result),
  )
  summary.legacyInspectStatus = legacy.body?.result?.value?.data?.inspection?.status
}

async function scenarioE2(ctx) {
  const stop1 = await ctx.instance.stop()
  check('E2.1 boot1 stop frees the port', stop1.portFree === true, JSON.stringify(stop1))
  rmSync(join(OUT, 'g8r6-obs.json'), { force: true })
  writeDirective(2)
  ctx.instance.mountRows([ROW], ROW_HEADER)
  const started2 = await ctx.instance.start({ timeoutMs: 120_000 })
  summary.boots.boot2 = { url: started2.url, logPath: started2.logPath }
  log(`boot2: ${started2.url}`)
  const dump2 = await ctx.instance.dumpConfig({ timeoutMs: 60_000 })
  writeFileSync(join(OUT, 'dump-config-boot2.txt'), dump2.text)
  const rowMounted2 = DshInstance.rowInDump(dump2.text, ROW)
  summary.boots.boot2.rowMounted = rowMounted2
  if (!rowMounted2) summary.concerns.push('boot2: row missing from dump-config')
  const obs2 = await pollObs(120_000)
  summary.boots.boot2.obs = obs2
  if (obs2 === null || obs2.phase !== 'ready') {
    const sf = readSetupFailure()
    throw new EnvError(`boot2: row not ready: ${JSON.stringify(obs2)}${sf ? ` (setup-failure.json: ${truncate(JSON.stringify(sf), 400)})` : ''}`)
  }
    check('E2.2 boot2 reopens the persisted unit (seeded=false)', obs2.seeded === false, JSON.stringify(obs2))
  const mint2 = await mintCookie(started2.url)
  cookie = mint2.ok ? mint2.segment : null
  check(
    'E2.3 boot2 cookie minted (302/303 + dsh-auth-<43> regex)',
    mint2.ok && cookie !== null,
    JSON.stringify({ status: mint2.status, setCookieCount: mint2.setCookieCount, regexOk: mint2.regexOk, prefix: mint2.segmentPrefix }),
  )
  const client2 = clientMod.createP8T4TestClient({ teamSessionId: TEAM_ID, transport, backoff: BACKOFF, sinks: {} })
  const initial2 = await client2.start()
  check(
    'E2.4 fresh client after process death: apply (never duplicate)',
    initial2.status === 'apply',
    JSON.stringify(initial2),
  )
  const applied2 = client2.appliedFrame()
  check(
    'E2.5 FULL projection deep-equal across the process death',
    applied2 !== null && isDeepStrictEqual(applied2.projection, e1Snapshot),
    deepDetail(applied2?.projection, e1Snapshot),
  )
  check(
    'E2.6 generation unchanged (no durable writes during E1)',
    applied2 !== null && applied2.projection.generation === e1Snapshot.generation,
    `${applied2?.projection?.generation} vs ${e1Snapshot?.generation}`,
  )
}

async function scenarioE3(e1Gen) {
  staleScript = null
  lastGetProjection = null
  const rejected = []
  client3 = clientMod.createP8T4TestClient({
    teamSessionId: TEAM_ID,
    transport,
    backoff: BACKOFF,
    sinks: { onFrameRejected: (assessment) => rejected.push(assessment) },
  })
  const initial3 = await client3.start()
  check(
    'E3.1 start apply at the baseline generation',
    initial3.status === 'apply' && initial3.receivedGeneration === e1Gen,
    JSON.stringify(initial3),
  )
  check(
    'E3.2 transport captured the baseline getProjection response',
    lastGetProjection !== null && lastGetProjection.value?.data?.projection?.generation === e1Gen,
    JSON.stringify(lastGetProjection?.value?.data?.projection?.generation),
  )
  // Keep the baseline (old-generation) frame for the stale replay.
  const baseline3 = structuredClone(lastGetProjection)
  const fact1 = await postFact('e3-activity')
  check(
    'E3.3 durable fact advanced the team generation (seq 3)',
    fact1 !== null && fact1.generation === e1Gen + 1 && fact1.sequence === 3,
    JSON.stringify(fact1),
  )
  const advance = await client3.sync()
  check(
    'E3.4 real sync applied the new generation (client is now ahead)',
    advance.status === 'apply' && advance.receivedGeneration === e1Gen + 1,
    JSON.stringify(advance),
  )
  const preStale = structuredClone(client3.appliedFrame().projection)
  // Replay the OLD (baseline-generation) response: its generation is now
  // strictly below the applied one, so the frozen stale guard rejects it.
  staleScript = baseline3
  const stale = await client3.sync()
  check('E3.5 stale response verdict = stale (response gen < applied gen)', stale.status === 'stale', JSON.stringify(stale))
  check('E3.6 stale assessment receivedGeneration = baseline', stale.receivedGeneration === e1Gen, JSON.stringify(stale))
  const stats3 = client3.stats()
  check('E3.7 stats.framesStale = 1', stats3.framesStale === 1, JSON.stringify(stats3))
  check('E3.8 onFrameRejected fired with the stale assessment', rejected.some((a) => a.status === 'stale'), JSON.stringify(rejected))
  check(
    'E3.9 applied projection UNCHANGED (a stale response never overwrites)',
    isDeepStrictEqual(client3.appliedFrame().projection, preStale),
    deepDetail(client3.appliedFrame()?.projection, preStale),
  )
  staleScript = null
  const heal = await client3.sync()
  check(
    'E3.10 real sync after the stale: duplicate at generation+1 (applied state held)',
    heal.status === 'duplicate' && heal.receivedGeneration === e1Gen + 1,
    JSON.stringify(heal),
  )
  check(
    'E3.11 applied generation still generation+1 after the stale replay',
    client3.lastAppliedGeneration() === e1Gen + 1,
    String(client3.lastAppliedGeneration()),
  )
}

async function scenarioE4(e1Gen) {
  const page1 = await client3.fetchPage(0, 2)
  check('E4.1 page(0,2) ok (fresh anchor)', page1.ok === true, JSON.stringify({ ok: page1.ok, reason: page1.reason }))
  check(
    'E4.2 page1 entries = seq 1,2',
    page1.page !== null && page1.page.entries.map((e) => e.sequence).join(',') === '1,2',
    JSON.stringify(page1.page?.entries?.map((e) => e.sequence)),
  )
  check('E4.3 page1 nextAfterSequence = 2', page1.page?.nextAfterSequence === 2, String(page1.page?.nextAfterSequence))
  check('E4.4 page1 total = 3 (two seed facts + E3 fact)', page1.page?.total === 3, String(page1.page?.total))
  check(
    'E4.5 every entry carries the 7 frozen REMOTE_LEDGER_ENTRY_FIELDS',
    page1.page?.entries?.every((e) => remoteMod.REMOTE_LEDGER_ENTRY_FIELDS.every((f) => Object.prototype.hasOwnProperty.call(e, f))) === true,
    JSON.stringify(page1.page?.entries?.[0]),
  )
  check('E4.6 tracker cursor moved to 2', client3.pageAnchor() === 2, String(client3.pageAnchor()))
  const fact2 = await postFact('e4-growth')
  check('E4.7 growth fact -> generation e1Gen+2, seq 4', fact2 !== null && fact2.generation === e1Gen + 2 && fact2.sequence === 4, JSON.stringify(fact2))
  const refetch = await client3.fetchPage(0, 2)
  check(
    'E4.8 re-fetch of the CONSUMED anchor rejected: anchor-mismatch (tracker guard)',
    refetch.ok === false && refetch.reason === 'anchor-mismatch',
    JSON.stringify({ ok: refetch.ok, reason: refetch.reason }),
  )
  check('E4.9 tracker cursor still 2 (a stale in-flight page never moves it)', client3.pageAnchor() === 2, String(client3.pageAnchor()))
  const raw = await rpcDirect({ method: 'team.getLedgerPage', params: { teamSessionId: TEAM_ID, afterSequence: 0, limit: 2 } })
  const rawPage = raw.body?.result?.value?.data
  check(
    'E4.10 RAW same-anchor slice identical to page1 (server-side stable slice under growth)',
    raw.status === 200 && raw.body?.result?.ok === true && isDeepStrictEqual(rawPage?.entries, page1.page?.entries),
    raw.status === 200 ? deepDetail(rawPage?.entries, page1.page?.entries) : `status ${raw.status} ${raw.rawText ?? ''}`,
  )
  check('E4.11 raw total = 4 (the total only moves up)', rawPage?.total === 4, String(rawPage?.total))
  check('E4.12 raw nextAfterSequence = 2 (same slice, same cursor)', rawPage?.nextAfterSequence === 2, String(rawPage?.nextAfterSequence))
  const page2 = await client3.fetchPage(2, 2)
  check('E4.13 page(2,2) ok (cursor continues)', page2.ok === true, JSON.stringify({ ok: page2.ok, reason: page2.reason }))
  check(
    'E4.14 page2 entries = seq 3,4',
    page2.page !== null && page2.page.entries.map((e) => e.sequence).join(',') === '3,4',
    JSON.stringify(page2.page?.entries?.map((e) => e.sequence)),
  )
  check('E4.15 page2 nextAfterSequence = null (tail reached)', page2.page?.nextAfterSequence === null, String(page2.page?.nextAfterSequence))
  check('E4.16 page2 total = 4', page2.page?.total === 4, String(page2.page?.total))
  // Frozen tracker rule (push/ledger-page.ts): the cursor advances ONLY on a
  // non-null nextAfterSequence. A tail page (null cursor) updates lastTotal
  // but never moves the cursor — end-of-ledger is represented by the null
  // cursor + total, not by the anchor reaching the total.
  check(
    'E4.17 tracker cursor HELD at 2 after the tail page (null cursor never moves it)',
    client3.pageAnchor() === 2,
    String(client3.pageAnchor()),
  )
  // Frozen slicer stability (D-5): re-reading an anchor yields the same page
  // and the total only moves up.
  const reread = await client3.fetchPage(2, 2)
  check(
    'E4.18 stable re-read of the tail anchor: same slice 3,4, null cursor, total 4',
    reread.ok === true
      && reread.page !== null
      && reread.page.entries.map((e) => e.sequence).join(',') === '3,4'
      && reread.page.nextAfterSequence === null
      && reread.page.total === 4,
    JSON.stringify({
      ok: reread.ok,
      reason: reread.reason,
      seqs: reread.page?.entries?.map((e) => e.sequence),
      next: reread.page?.nextAfterSequence,
      total: reread.page?.total,
    }),
  )
}

async function scenarioE5() {
  const absent = await rpcDirect({ method: 'team.getProjection', params: { teamSessionId: 'session-g8r6-absent' } })
  const errA = absent.body?.result
  check('E5.1 absent team: HTTP 200 (typed error, not a 500)', absent.status === 200, `status ${absent.status} ${absent.rawText ?? ''}`)
  check('E5.2 absent team: result.ok = false', errA?.ok === false, JSON.stringify(errA))
  check(
    'E5.3 absent team: typed code TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND',
    errA?.error?.code === 'TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND',
    JSON.stringify(errA?.error),
  )
  check(
    'E5.4 absent team: non-empty message',
    typeof errA?.error?.message === 'string' && errA.error.message.length > 0,
    JSON.stringify(errA?.error?.message),
  )
  check(
    'E5.5 absent team: details carry method + endpoint',
    errA?.error?.details?.method === 'team.getProjection' && errA?.error?.details?.endpoint === 'team.getProjection',
    JSON.stringify(errA?.error?.details),
  )
  const client4 = clientMod.createP8T4TestClient({ teamSessionId: 'session-g8r6-absent', transport, backoff: BACKOFF, sinks: {} })
  const init4 = await client4.start()
  check(
    'E5.6 push client sees rpc-error with the SAME pass-through code',
    init4.status === 'rpc-error' && init4.code === 'TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND',
    JSON.stringify(init4),
  )
  const badVer = await rpcDirect({ method: 'team.getProjection', params: { teamSessionId: TEAM_ID }, version: 2 })
  check(
    'E5.7 contract version 2 -> contract-version-unsupported',
    badVer.status === 200 && badVer.body?.result?.ok === false && badVer.body?.result?.error?.code === 'contract-version-unsupported',
    JSON.stringify(badVer.body?.result),
  )
  const badSend = await rpcDirect({
    method: 'member.send',
    params: {
      teamSessionId: TEAM_ID,
      caller: { kind: 'human', humanId: 'h-g8r6' },
      recipientInstanceId: 'inst-g8r6absent',
      body: 'hello g8r6',
      requestToken: 'tok-g8r6-e5',
    },
  })
  check(
    'E5.8 member.send on an absent instance: typed INSTANCE_NOT_FOUND pass-through',
    badSend.status === 200
      && badSend.body?.result?.ok === false
      && badSend.body?.result?.error?.code === 'TEAM_RUNTIME_INSTANCE_NOT_FOUND',
    JSON.stringify(badSend.body?.result),
  )
  check(
    'E5.9 member.send error details.cause carries the domain code',
    badSend.body?.result?.error?.details?.cause?.code === 'TEAM_RUNTIME_INSTANCE_NOT_FOUND',
    JSON.stringify(badSend.body?.result?.error?.details),
  )
  const badEnv = await rpcDirect({
    method: 'team.getProjection',
    params: { teamSessionId: TEAM_ID },
    extraPayload: { version: 1, params: { teamSessionId: TEAM_ID }, extra: 1 },
  })
  check(
    'E5.10 unknown envelope top-level field -> malformed-request',
    badEnv.status === 200 && badEnv.body?.result?.ok === false && badEnv.body?.result?.error?.code === 'malformed-request',
    JSON.stringify(badEnv.body?.result),
  )
  const success = await rpcDirect({ method: 'team.getProjection', params: { teamSessionId: TEAM_ID } })
  check(
    'E5.11 success carries the full provenance block (origin/method/contractVersion/null token)',
    success.status === 200
      && success.body?.result?.ok === true
      && success.body?.result?.value?.provenance?.origin === 'team-remote'
      && success.body?.result?.value?.provenance?.contractVersion === remoteMod.REMOTE_CONTRACT_VERSION
      && success.body?.result?.value?.provenance?.requestToken === null
      && success.body?.result?.value?.data?.projection !== undefined,
    JSON.stringify(success.body?.result?.value?.provenance),
  )
}

async function scenarioE6() {
  const noCookie = await rpcDirect({ method: 'catalog.list', params: {}, noCookie: true })
  check('E6.1 no cookie -> HTTP 401', noCookie.status === 401, `status ${noCookie.status} ${noCookie.rawText ?? ''}`)
  const badCT = await rpcDirect({ method: 'catalog.list', params: {}, contentType: 'text/plain' })
  check('E6.2 cookie + wrong content-type -> HTTP 415', badCT.status === 415, `status ${badCT.status} ${badCT.rawText ?? ''}`)
  const mismatch = await rpcDirect({ method: 'catalog.list', params: {}, urlMethod: 'catalog.get' })
  check(
    'E6.3 wire method != URL endpoint -> 200 + bad-request',
    mismatch.status === 200 && mismatch.body?.result?.ok === false && mismatch.body?.result?.error?.code === 'bad-request',
    JSON.stringify(mismatch.body?.result),
  )
  check(
    'E6.4 bad-request message names the mismatch',
    typeof mismatch.body?.result?.error?.message === 'string'
      && mismatch.body.result.error.message.includes('does not match endpoint'),
    JSON.stringify(mismatch.body?.result?.error?.message),
  )
  const unknown = await rpcDirect({ method: 'nope.nope', params: {}, urlMethod: 'nope.nope' })
  check(
    'E6.5 unknown endpoint -> 200 + unknown-method',
    unknown.status === 200 && unknown.body?.result?.ok === false && unknown.body?.result?.error?.code === 'unknown-method',
    JSON.stringify(unknown.body?.result),
  )
}

// ── one full boot1->boot2 attempt ──────────────────────────────────────────

async function attemptRun(attempt) {
  const ctx = { instance: null }
  try {
    rmSync(DSH_HOME, { recursive: true, force: true })
    mkdirSync(DSH_HOME, { recursive: true })
    mkdirSync(OUT, { recursive: true })
    rmSync(join(OUT, 'g8r6-obs.json'), { force: true })
    rmSync(join(EV, 'setup-failure.json'), { force: true })
    log(`attempt ${attempt}: fresh DSH_HOME at ${DSH_HOME}`)

    if (!existsSync(ZOD_DIR)) throw new EnvError(`zod farm target missing: ${ZOD_DIR}`)
    if (!existsSync(YAML_DIR)) throw new EnvError(`yaml farm target missing: ${YAML_DIR}`)
    ensureProbeResolution({
      probesDir: HERE,
      packages: [
        { name: '@deepseek-ai/dsh-storage-domain', dir: join(TEST_USE, 'packages', 'storage', 'storage-domain') },
        { name: 'zod', dir: ZOD_DIR },
        { name: 'yaml', dir: YAML_DIR },
      ],
      log: (m) => log(`farm: ${m}`),
    })

    writeDirective(1)
    ctx.instance = new DshInstance({
      hostTree: TEST_USE,
      dshHome: DSH_HOME,
      port: PORT,
      clientCommitHash: CLIENT_COMMIT_HASH,
      logDir: join(OUT, 'logs'),
    })
    const profile1 = await ensureProfile({ instance: ctx.instance, log, timeoutMs: 90_000 })
    log(`boot1: profile ${JSON.stringify(profile1)}`)
    ctx.instance.mountRows([ROW], ROW_HEADER)
    const started1 = await ctx.instance.start({ timeoutMs: 120_000 })
    summary.boots.boot1 = { url: started1.url, logPath: started1.logPath, profile: profile1 }
    log(`boot1: ${started1.url}`)
    const dump1 = await ctx.instance.dumpConfig({ timeoutMs: 60_000 })
    writeFileSync(join(OUT, 'dump-config-boot1.txt'), dump1.text)
    const rowMounted1 = DshInstance.rowInDump(dump1.text, ROW)
    summary.boots.boot1.rowMounted = rowMounted1
    if (!rowMounted1) summary.concerns.push('boot1: row missing from dump-config')
    log(`boot1: rowMounted=${rowMounted1}`)

    const obs1 = await pollObs(120_000)
    summary.boots.boot1.obs = obs1
    if (obs1 === null) throw new EnvError('boot1: g8r6-obs.json never reached a terminal phase within 120s')
    if (obs1.phase !== 'ready') {
      const sf = readSetupFailure()
      throw new EnvError(`boot1: row setup-failed: ${obs1.fatal ?? 'unknown'}${sf ? ` (setup-failure.json: ${truncate(JSON.stringify(sf), 400)})` : ''}`)
    }
    log(`boot1: row ready (teamSessionId ${obs1.teamSessionId}, generation ${obs1.generation}, seeded ${obs1.seeded}, compat ${obs1.compatStatus ?? 'n/a'})`)
    const e1Gen = obs1.generation

    const mint1 = await mintCookie(started1.url)
    cookie = mint1.ok ? mint1.segment : null
    check0(
      'boot1 cookie minted (302/303 + dsh-auth-<43> regex)',
      mint1.ok && cookie !== null,
      JSON.stringify({ status: mint1.status, setCookieCount: mint1.setCookieCount, regexOk: mint1.regexOk, prefix: mint1.segmentPrefix }),
    )
    if (!mint1.ok) throw new EnvError(`boot1: cookie mint failed: status=${mint1.status} setCookies=${mint1.setCookieCount} regexOk=${mint1.regexOk}`)

    await runScenario('E1', 'initial connect + pull + provenance + bonus RPCs', () => scenarioE1(e1Gen))
    await runScenario('E2', 'process restart (boot 2, same DSH_HOME): reconnect + durability', () => scenarioE2(ctx))
    await runScenario('E3', 'stale response ignored; recovery to the new generation', () => scenarioE3(e1Gen))
    await runScenario('E4', 'ledger pagination: anchor guard + stable slice under growth', () => scenarioE4(e1Gen))
    await runScenario('E5', 'typed errors + envelope discipline + success provenance', () => scenarioE5())
    await runScenario('E6', 'wire auth / content-type / routing rules', () => scenarioE6())

    const anyFail = Object.values(summary.scenarios).some((s) => s.pass === false)
    if (anyFail) {
      const failing = Object.values(summary.scenarios).filter((s) => s.pass === false).map((s) => s.name)
      return { kind: 'scenario-fail', reason: `assertion failure(s) in: ${failing.join(', ')}` }
    }

    const stopFinal = await ctx.instance.stop()
    log(`post: final stop ${JSON.stringify(stopFinal)}`)
    summary.postStop = stopFinal
    if (!stopFinal.portFree) {
      const freed = await waitForPortFree(PORT, 20_000)
      log(`post: waitForPortFree(3186) = ${freed}`)
    }
    return { kind: 'pass' }
  } catch (error) {
    const transient = error instanceof EnvError
    log(`${transient ? 'TRANSIENT' : 'FAILURE'} in attempt ${attempt}: ${error?.stack ?? error}`)
    try {
      if (ctx.instance !== null) await ctx.instance.stop()
    } catch {
      /* best effort */
    }
    if (transient) return { kind: 'transient', reason: truncate(String(error?.message ?? error), 800) }
    if (currentScenario !== null) currentScenario.error = truncate(String(error?.message ?? error), 800)
    return { kind: 'scenario-fail', reason: truncate(String(error?.message ?? error), 800) }
  }
}

/** A check recorded outside the six scenarios (boot-level evidence). */
function check0(name, cond, detail) {
  const ok = cond === true
  if (!ok) {
    summary.concerns.push(`boot-level check failed: ${name} — ${truncate(String(detail), 400)}`)
    log(`   FAIL (boot) ${name} — ${truncate(String(detail), 400)}`)
  } else {
    log(`   PASS (boot) ${name}`)
  }
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  summary.startedAt = new Date().toISOString()
  log(`g8r6 e2e driver start (node ${process.version}, port ${PORT}, worktree ${WORKTREE})`)

  // ── preflight ──
  let baseline
  try {
    baseline = gitStatusLines(TEST_USE)
  } catch (error) {
    log(`preflight fatal: ${error.message}`)
    summary.exitCode = 2
    finalize()
    return
  }
  summary.testUse.baselinePorcelain = baseline
  const unexpectedBaseline = baseline.filter((l) => !KNOWN_PRE_EXISTING_DIRT.includes(l))
  if (unexpectedBaseline.length > 0) {
    summary.concerns.push(`test-use baseline differs from the recorded pre-existing dirt: ${JSON.stringify(unexpectedBaseline)}`)
    log(`preflight: UNEXPECTED test-use baseline lines: ${JSON.stringify(unexpectedBaseline)}`)
  } else {
    log(`preflight: test-use baseline = the 2 recorded pre-existing deletions only`)
  }
  summary.devUrl.before = await probeUrl(DEV_URL)
  if (summary.devUrl.before.status !== 200) {
    summary.concerns.push(`:3080 not 200 BEFORE the run (${JSON.stringify(summary.devUrl.before)})`)
  }
  log(`preflight: :3080 before = ${JSON.stringify(summary.devUrl.before)}`)
  const portBusy = await portInUse(PORT)
  if (portBusy) {
    log(`preflight: port ${PORT} already in use — aborting`)
    summary.exitCode = 2
    finalize()
    return
  }
  log(`preflight: port ${PORT} free`)

  // ── lock ──
  const lockAcquired = await acquireLock()
  summary.lock = { acquired: lockAcquired, marker: LOCK_MARKER }

  // ── attempts (transient env failure -> clean + retry ONCE) ──
  let outcome
  if (!lockAcquired) {
    log('e2e: NOT-RUN(LOCK-TIMEOUT)')
    outcome = { kind: 'lock-timeout', reason: 'lock not acquired within 75 x 20s' }
  } else {
    let attempt = 0
    for (;;) {
      attempt += 1
      log(`── attempt ${attempt}/2`)
      outcome = await attemptRun(attempt)
      if (outcome.kind !== 'transient' || attempt >= 2) break
      summary.concerns.push(`transient env failure on attempt ${attempt}: ${outcome.reason} — cleaned and retried ONCE (per brief; does not fail a criterion by itself)`)
      log(`transient env failure (attempt ${attempt}): ${outcome.reason} — cleaning leftovers and retrying ONCE`)
      try {
        rmSync(DSH_HOME, { recursive: true, force: true })
      } catch {
        /* best effort */
      }
    }
  }

  // ── post checks (always) ──
  let after = []
  try {
    after = gitStatusLines(TEST_USE)
  } catch (error) {
    summary.concerns.push(`post git status failed: ${error.message}`)
  }
  summary.testUse.afterPorcelain = after
  const dirtyDelta = after.filter((l) => !baseline.includes(l))
  summary.testUse.dirtyDelta = dirtyDelta
  log(`post: test-use delta vs baseline = ${JSON.stringify(dirtyDelta)}`)
  if (dirtyDelta.length > 0) summary.concerns.push(`test-use tree GAINED lines after the e2e: ${JSON.stringify(dirtyDelta)}`)

  summary.devUrl.after = await probeUrl(DEV_URL)
  log(`post: :3080 after = ${JSON.stringify(summary.devUrl.after)}`)
  if (summary.devUrl.after.status !== 200) summary.concerns.push(`:3080 not 200 AFTER the run (${JSON.stringify(summary.devUrl.after)})`)

  // ── lock release (only when we own it) ──
  try {
    const content = readFileSync(LOCK, 'utf8').trim()
    if (content === LOCK_MARKER) {
      rmSync(LOCK)
      log('lock released (owned marker verified)')
    } else {
      log(`lock NOT released (marker differs: '${truncate(content, 120)}')`)
      summary.concerns.push(`lock marker changed between acquire and release: '${truncate(content, 120)}'`)
    }
  } catch {
    log('lock file absent at release (external cleanup?)')
  }

  // ── outcome ──
  summary.outcome = { kind: outcome.kind, reason: outcome.reason ?? null }
  summary.allPass = outcome.kind === 'pass'
  summary.exitCode = outcome.kind === 'pass' ? 0 : outcome.kind === 'lock-timeout' ? 3 : 2
  finalize()
}

function finalize() {
  try {
    mkdirSync(OUT, { recursive: true })
    summary.finishedAt = new Date().toISOString()
    writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))
  } catch (error) {
    log(`finalize: summary write failed: ${error?.message ?? error}`)
  }
  const label = summary.exitCode === 0 ? 'PASS' : summary.exitCode === 3 ? 'NOT-RUN(LOCK-TIMEOUT)' : 'FAIL'
  log(`g8r6 e2e driver ${label} — exit ${summary.exitCode} — summary: ${join(OUT, 'summary.json')}`)
  process.exit(summary.exitCode)
}

main().catch((error) => {
  log(`driver fatal: ${error?.stack ?? error}`)
  try {
    mkdirSync(OUT, { recursive: true })
    summary.finishedAt = new Date().toISOString()
    summary.exitCode = summary.exitCode ?? 2
    writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))
  } catch {
    /* best effort */
  }
  process.exit(summary.exitCode ?? 2)
})
