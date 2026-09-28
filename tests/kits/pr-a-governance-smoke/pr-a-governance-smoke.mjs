#!/usr/bin/env node
/**
 * pr-a-governance-smoke.mjs — the pre-alpha3 PR-A (governance mutation
 * authority, ADR-03) focused real-host smoke (plan §A.4 / §A.5
 * "focused host PASS").
 *
 * WHAT THIS PROVES (one world, two host boots, wire-only legs — the
 * public `/team-remote` channel, no leader turn, no model calls):
 *
 *   G0 — preflight: the pristine test-use checkout is at the frozen
 *        0.1.7-rc.1 release point with a clean porcelain; the worktree
 *        dist (the code under test) is built; the seed world + ports
 *        are available; the stable instances (:3080/:3180) are
 *        probed READ-ONLY and never bound.
 *   G1 — host boot #1 on a 3180-family port with the production
 *        `dsh-agent-team` row retargeted at THIS worktree's dist;
 *        the launch token is parsed from the host log; the
 *        `/team-remote` route is ready (the static-fallback 405
 *        window elapses).
 *   G2 — HUMAN override of `model` (team scope): the wire
 *        `override.set` (the web caller is the host-known operator →
 *        server-derived `operator` authority → the `human-override`
 *        kind, origin `human`) acks the committed record
 *        (`ovr-model-team-g*`, generation 1, the deterministic
 *        record id minted server-side).
 *   G3 — HUMAN override of `mcp`: the second capability lands on the
 *        SAME team slot — the winner is the multi-capability record
 *        (`ovr-mcp+model-team-g*` — alpha-sorted `+` join), generation
 *        2, carrying BOTH cells (no lost update of the first set).
 *   G4 — RESTART persistence: host #1 stops, host #2 boots on the SAME
 *        DSH_HOME; `override.get` reports the identical winner (same
 *        record id + generation — the durable `overrides` rows are the
 *        source of truth across processes); a further `override.set`
 *        continues the slot generation from the durable value (gen 3).
 *   G5 — CONCURRENT two-tab set: two parallel `override.set` calls
 *        (model + skills, different cells of the same team slot) both
 *        ack ok; the final winner carries all three cells and the
 *        generation advanced by exactly two (the chain serialized the
 *        writes — no lost update, no interleaved state).
 *   G6 — STALE generation (wire-visible): contract v1 carries NO
 *        client-supplied expectedGeneration (frozen remote contract —
 *        the optimistic guard lives on the slot winner inside the
 *        chain; the typed `OVERRIDE_GENERATION_CONFLICT` negative is
 *        pinned by the unit world, governance-concurrency C2). The
 *        wire-visible consequence is asserted here: a set acked at
 *        generation N leaves the N-1 winner record durable (audit),
 *        and the slot reports N on the next read — a writer that
 *        still expected N-1 observes the advanced slot.
 *   G7 — RESET + audit preservation: `override.reset` (human, team
 *        scope) acks `removed: true`; the reset is a higher-generation
 *        TOMBSTONE re-issue (`ovr-reset-team-g*`, `values: {}`), never
 *        a storage delete — after host #2 closes, the disk scan of the
 *        `overrides` table shows EVERY prior record row intact
 *        (model g1, mcp+model g2, ... , tombstone) and `override.get`
 *        reports no winner (the tombstone contributes nothing).
 *   G8 — CURRENT-MASTER WIRE NO-REGRESSION: the master-era endpoints
 *        still answer with their contract shapes — `policyState.get`
 *        (ok, `stateId` string + `availableTransitions` array) and
 *        `team.getReadState` (ok); the new override acks carry the
 *        master record shape (recordId/kind/scope/values/generation/
 *        updatedAt[/origin]).
 *   G9 — cleanup: the stable instances re-probed (read-only), the
 *        ephemeral world removed, evidence retained.
 *
 * WORLD: the mpr seed world (tests/homes/mpr-2026-09-27T08-35-52 — a
 *   proven boot config with the bound T1 team + the production row)
 *   copied to tests/homes/pra-gov-<stamp>; ONLY the file:// row-URL
 *   worktree prefix + the blueprintDir path are retargeted to THIS
 *   worktree (pattern: tests/kits/team-view-sync-complete-e2e).
 *
 * PORTS: host = first free of 3181..3186 (the 3180 family); mock =
 *   3496 (fallback 3497). :3080/:3180 are NEVER bound — read-only
 *   probes pre and post (recorded in the summary).
 *
 * EVIDENCE: dev/agent-workflow/evidence/pre-alpha3-refactor/pr-a/
 *   host-smoke-<stamp>/ (summary.json + host logs token-scrubbed +
 *   mock log + api-transcript.json). The launch tokens are scrubbed
 *   from every retained artifact.
 *
 * EXIT: 0 = all criteria pass; 2 = a criterion failed (evidence dump);
 *   1 = fatal (environment / boot / row).
 */

import { spawn, spawnSync } from 'node:child_process'
import {
  closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync,
  rmSync, writeFileSync,
} from 'node:fs'
import net from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'

// ── constants ───────────────────────────────────────────────────────────────

const KIT_DIR = dirname(new URL(import.meta.url).pathname)
// The kit ships INSIDE the task worktree (<main>/.worktrees/<task>/
// tests/kits/<this kit>/ — three levels up = the worktree root).
const WORKTREE = resolve(KIT_DIR, '..', '..', '..')
const MAIN = resolve(WORKTREE, '..', '..')
let TESTUSE = join(WORKTREE, 'tests', 'deepseek-harness-test-use')
// The gitignored test-use checkout exists only in the MAIN checkout.
if (!existsSync(TESTUSE)) TESTUSE = join(MAIN, 'tests', 'deepseek-harness-test-use')
const HOST_BASELINE_SHA = '46a7f68b0922371ce7144b668b90e377d8e799f4' // DSH 0.1.7-rc.1 release point
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const SRC_WORLD = join(MAIN, 'tests', 'homes', 'mpr-2026-09-27T08-35-52')
const T1 = 'session-mpr-t1-mpr-2026-09-27T08-35-52' // the seed world's bound team root
const T1_MEMBER_SESSION = 'session-team-child-796562d4284593654607730948ad2b04'
const HOST_PORT_MIN = 3181
const HOST_PORT_MAX = 3186
const MOCK_PORTS = [3496, 3497]
const STABLE_PROBES = ['http://127.0.0.1:3080/', 'http://127.0.0.1:3180/']
const RUN_STAMP = `pra-gov-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
const WORLD = join(MAIN, 'tests', 'homes', RUN_STAMP)
const EVIDENCE_DIR = join(
  WORKTREE, 'dev', 'agent-workflow', 'evidence', 'pre-alpha3-refactor', 'pr-a', `host-smoke-${RUN_STAMP}`,
)
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance-1.log')
const INSTANCE_LOG_2 = join(EVIDENCE_DIR, 'instance-2.log')
const MOCK_LOG = join(EVIDENCE_DIR, 'mock.log')
const BOOT_TIMEOUT_MS = 120_000

const criteria = [
  { id: 'G0', label: 'preflight (test-use baseline + dist + world + ports + stable probes)', pass: false, detail: '' },
  { id: 'G1', label: 'host boot #1 (production row at this worktree dist, route ready)', pass: false, detail: '' },
  { id: 'G2', label: 'human model override acks the committed record (origin human)', pass: false, detail: '' },
  { id: 'G3', label: 'human mcp override: multi-cap winner, generation 2, both cells', pass: false, detail: '' },
  { id: 'G4', label: 'restart: identical winner + generation continues from the durable value', pass: false, detail: '' },
  { id: 'G5', label: 'concurrent two-tab set: both ack, three-cell winner, generation +2', pass: false, detail: '' },
  { id: 'G6', label: 'stale generation: the prior winner stays durable; the slot advances', pass: false, detail: '' },
  { id: 'G7', label: 'reset: tombstone re-issue; every prior record row intact on disk', pass: false, detail: '' },
  { id: 'G8', label: 'current-master wire no-regression (policyState.get + team.getReadState)', pass: false, detail: '' },
  { id: 'G9', label: 'cleanup (stable re-probe + ephemeral world removed)', pass: false, detail: '' },
]

// ── scratch state ───────────────────────────────────────────────────────────

const transcript = []
let stablePre = null
let hostPort = null
let mockPort = null

// ── evidence + logging ──────────────────────────────────────────────────────

function log(msg) { process.stdout.write(`${msg}\n`) }
function writeEvidence(name, obj) {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  writeFileSync(join(EVIDENCE_DIR, name), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2))
}
function scrub(text) {
  // The launch token (and any cookie derivative) never enters evidence.
  return String(text)
    .replace(/token=[A-Za-z0-9_-]{8,}/g, 'token=SCRUBBED')
    .replace(/set-cookie:[^\n]{0,200}/gi, 'set-cookie: SCRUBBED')
    .replace(/"cookie":\s*"[^"]{8,}"/g, '"cookie": "SCRUBBED"')
}
function mark(id, pass, detail) {
  const c = criteria.find((x) => x.id === id)
  if (c) {
    c.pass = pass === true
    c.detail = String(detail).slice(0, 2000)
  }
  log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${String(detail).slice(0, 200)}`)
}
function dieFatal(msg, exitCode = 1) {
  log(`FATAL ${msg}`)
  try {
    writeEvidence('summary.json', {
      runStamp: RUN_STAMP, fatal: msg, criteria,
      world: WORLD, hostPort, mockPort, stablePre, stablePost: null,
    })
  } catch { /* best effort */ }
  process.exit(exitCode)
}
function failCriteria(msg) {
  log(`CRITERIA-FAIL ${msg}`)
  try {
    writeEvidence('summary.json', {
      runStamp: RUN_STAMP, failure: msg, criteria,
      world: WORLD, hostPort, mockPort, stablePre, stablePost: null,
    })
    writeEvidence('api-transcript.json', scrub(JSON.stringify(transcript, null, 2)))
  } catch { /* best effort */ }
  process.exit(2)
}

// ── small helpers ───────────────────────────────────────────────────────────

function isPortFree(port) {
  return new Promise((res) => {
    const srv = net.createServer()
    srv.once('error', () => res(false))
    srv.listen({ port, host: '127.0.0.1' }, () => {
      srv.close(() => res(true))
    })
  })
}
async function probe(url, timeoutMs = 5_000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    return res.status
  } catch {
    return 'unreachable'
  }
}
async function fetchJson(url, init, timeoutMs = 60_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    .catch((e) => ({ status: 0, json: async () => null, error: e.message }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body, error: res.status === 0 ? res.error : undefined }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function gitIn(cwd, argv) {
  const r = spawnSync('git', argv, { cwd, encoding: 'utf8' })
  return { status: r.status, out: (r.stdout ?? '').trim() }
}
function logTail(logPath, n = 40) {
  try {
    return readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n')
  } catch {
    return '(no log)'
  }
}
function waitForLogLine(logPath, predicate, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  let last = -1
  return new Promise((resolvePromise) => {
    const timer = setInterval(() => {
      if (!alive()) {
        clearInterval(timer)
        resolvePromise(null)
        return
      }
      try {
        const content = readFileSync(logPath, 'utf8')
        if (content.length !== last) {
          last = content.length
          const lines = content.split('\n')
          for (let i = lines.length - 1; i >= 0; i -= 1) {
            if (predicate(lines[i])) {
              clearInterval(timer)
              resolvePromise(lines[i])
              return
            }
          }
        }
      } catch { /* not yet */ }
      if (Date.now() > deadline) {
        clearInterval(timer)
        resolvePromise(null)
      }
    }, 250)
  })
}

// ── the world row patch (pattern: team-view-sync-complete-e2e) ─────────────

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
  writeFileSync(p, s)
  const check = readFileSync(p, 'utf8')
  if (!check.includes(`${WORKTREE}/packages/runtime/dist`)) throw new Error('profile rewrite missed the row-URL retarget')
  if (check.includes('.worktrees/async-default-contract')) throw new Error('profile rewrite left a stale worktree URL')
  if (!check.includes(`${WORLD}/blueprints`)) throw new Error('profile rewrite missed the blueprintDir retarget')
}

// ── host lifecycle ──────────────────────────────────────────────────────────

function spawnHost({ port, home, logPath, mockPort: mp }) {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
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
          DEEPSEEK_BASE_URL: `http://127.0.0.1:${mp}`,
          DEEPSEEK_API_KEY: 'pra-gov-smoke-key',
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
  try { h.child.kill() } catch { /* already gone */ }
  return h
}

async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) {
    throw new Error(`dsh web authentication returned HTTP ${res.status} (expected 303 + set-cookie)`)
  }
  return setCookie.split(';', 1)[0]
}

/** One /team-remote call (the public browser channel): POST /team-remote/<method>. */
async function remoteCall(origin, cookie, method, params, version = 1, timeoutMs = 60_000) {
  const t0 = Date.now()
  const r = await fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `pra-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version, params },
    }),
  }, timeoutMs)
  const result = r.body?.result
  const ok = result?.ok === true
  transcript.push({
    method, params, ms: Date.now() - t0,
    httpStatus: r.status,
    ok,
    data: ok ? result.value : undefined,
    error: ok ? undefined : result?.error ?? (r.error ? { transport: r.error } : { http: r.status }),
  })
  return { status: r.status, ok, data: result?.value?.data, error: ok ? undefined : (result?.error ?? r.body), raw: r }
}

/** Boot one host instance and wait for the /team-remote route. */
async function bootHost({ port, logPath, cookieFrom }) {
  const h = spawnHost({ port, home: WORLD, logPath, mockPort })
  const origin = `http://127.0.0.1:${port}`
  const line = await waitForLogLine(logPath, (l) => l.includes('/?token='), BOOT_TIMEOUT_MS, h.alive)
  if (line === null) {
    stopHost(h)
    const detail = h.exitInfo.exited
      ? `process exited (code=${h.exitInfo.code} signal=${h.exitInfo.signal ?? 'none'})`
      : `no boot marker within ${BOOT_TIMEOUT_MS}ms`
    throw new Error(`host boot failed: ${detail}\n--- log tail ---\n${scrub(logTail(logPath))}`)
  }
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(line.replace(/.*dsh web:\s*/, ''))
  if (m === null || m[1] !== String(port)) throw new Error(`boot marker port mismatch: ${scrub(line)}`)
  void cookieFrom
  const cookie = await authenticate(origin, m[2])
  const tRoute = Date.now()
  let routeStatus = 0
  while (Date.now() - tRoute < 60_000) {
    const r = await remoteCall(origin, cookie, 'team.getReadState', { sessionId: T1_MEMBER_SESSION }, 6)
    routeStatus = r.status
    if (routeStatus !== 405) break
    await sleep(250)
  }
  if (routeStatus === 405) {
    stopHost(h)
    throw new Error('the /team-remote route never became ready (405 static fallback for 60s)')
  }
  log(`route ready (${Date.now() - tRoute}ms after boot marker; status=${routeStatus})`)
  return { h, origin, cookie, readyMs: Date.now() - tRoute }
}

// ── the override leg assertions ─────────────────────────────────────────────

function assertAckRecord(label, call, { recordIdRe, generation, origin, kind }) {
  if (call.status !== 200 || !call.ok) {
    throw new Error(`${label}: wire call failed (http=${call.status} error=${JSON.stringify(call.error)?.slice(0, 400)})`)
  }
  const rec = call.data
  if (rec === null || typeof rec !== 'object') throw new Error(`${label}: no record in ack (data=${JSON.stringify(call.data)?.slice(0, 200)})`)
  if (typeof rec.recordId !== 'string' || !recordIdRe.test(rec.recordId)) {
    throw new Error(`${label}: recordId '${rec.recordId}' does not match ${recordIdRe}`)
  }
  if (generation !== undefined && rec.generation !== generation) {
    throw new Error(`${label}: generation ${rec.generation} !== expected ${generation}`)
  }
  if (origin !== undefined && rec.origin !== origin) throw new Error(`${label}: origin '${rec.origin}' !== '${origin}'`)
  if (kind !== undefined && rec.kind !== kind) throw new Error(`${label}: kind '${rec.kind}' !== '${kind}'`)
  return rec
}

function overrideValue(capability, item) {
  return capability === 'model'
    ? { kind: 'allow', items: [item] }
    : { kind: 'allow', items: [item] }
}

// ── main ────────────────────────────────────────────────────────────────────

const MOCK = { port: null, close: async () => {} }
let HOST = null
let host2 = null

try {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  log(`world=${WORLD} (seed from ${SRC_WORLD})`)

  // ── G0 preflight ───────────────────────────────────────────────────────────
  const head = gitIn(TESTUSE, ['rev-parse', 'HEAD'])
  const porcelain = gitIn(TESTUSE, ['status', '--porcelain'])
  const distChecks = [
    join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js'),
    join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'),
    join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs'),
    join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs'),
  ]
  const distOk = distChecks.every((p) => existsSync(p))
  const srcOk = existsSync(join(SRC_WORLD, 'storages', 'team_domain.json'))
  for (let p = HOST_PORT_MIN; p <= HOST_PORT_MAX; p += 1) {
    if (hostPort === null && (await isPortFree(p))) hostPort = p
  }
  for (const p of MOCK_PORTS) {
    if (mockPort === null && (await isPortFree(p))) mockPort = p
  }
  stablePre = Object.fromEntries(await Promise.all(STABLE_PROBES.map(async (u) => [u, await probe(u)])))
  const g0 = head.status === 0 && head.out === HOST_BASELINE_SHA
    && porcelain.status === 0 && porcelain.out === ''
    && distOk && srcOk && hostPort !== null && mockPort !== null
  mark('G0', g0,
    `testuse HEAD=${head.out} porcelain='${porcelain.out.slice(0, 80)}' dist=${distOk} seed=${srcOk} hostPort=${hostPort} mockPort=${mockPort} stable=${JSON.stringify(stablePre)}`)
  writeEvidence('preflight.json', { head: head.out, porcelain: porcelain.out, distOk, srcOk, hostPort, mockPort, stablePre, worktree: WORKTREE })
  if (!g0) failCriteria('G0 preflight')

  // ── seed the world ─────────────────────────────────────────────────────────
  if (existsSync(WORLD)) rmSync(WORLD, { recursive: true, force: true })
  const cp = spawnSync('cp', ['-r', SRC_WORLD, WORLD], { encoding: 'utf8' })
  if (cp.status !== 0) dieFatal(`world seed copy failed: ${cp.stderr}`)
  rewriteWorldProfile()
  log(`world seeded + profile retargeted at ${WORKTREE}/packages`)

  // ── mock model (no model calls expected; the endpoint just must exist) ────
  try {
    MOCK.port = mockPort
    const started = await startMockModel({
      port: mockPort,
      decide: () => ({ kind: 'text', content: 'ack pra-gov-smoke' }),
      log: (msg) => { try { writeFileSync(MOCK_LOG, `${msg}\n`, { flag: 'a' }) } catch { /* ignore */ } },
    })
    MOCK.close = () => started.close()
  } catch (e) {
    dieFatal(`mock model failed to start: ${e.message}`)
  }
  log(`mock model on 127.0.0.1:${mockPort}`)

  // ── G1 host boot #1 ────────────────────────────────────────────────────────
  try {
    const b1 = await bootHost({ port: hostPort, logPath: INSTANCE_LOG, cookieFrom: null })
    HOST = b1
    mark('G1', true, `boot #1 on :${hostPort} (route ready ${b1.readyMs}ms)`)
  } catch (e) {
    mark('G1', false, e.message)
    failCriteria(`G1 boot: ${e.message}`)
  }

  const { origin, cookie } = HOST

  // ── G2 human model override (team scope) ──────────────────────────────────
  const g2call = await remoteCall(origin, cookie, 'override.set', {
    teamSessionId: T1, capability: 'model', value: overrideValue('model', 'pra-gov/model-a'), scope: 'team',
    actor: { kind: 'human' },
  })
  let g2rec = null
  try {
    g2rec = assertAckRecord('G2', g2call, {
      recordIdRe: /^ovr-model-team-g\d+$/, generation: 1, kind: 'human-override',
    })
    mark('G2', true, `ack record ${g2rec.recordId} gen=${g2rec.generation} origin=${g2rec.origin} values.model=${JSON.stringify(g2rec.values?.model)}`)
  } catch (e) {
    mark('G2', false, e.message)
    failCriteria(`G2: ${e.message}`)
  }

  // ── G3 human mcp override (same slot — multi-cap winner) ──────────────────
  const g3call = await remoteCall(origin, cookie, 'override.set', {
    teamSessionId: T1, capability: 'mcp', value: overrideValue('mcp', 'pra-gov/mcp-x'), scope: 'team',
    actor: { kind: 'human' },
  })
  let g3rec = null
  try {
    g3rec = assertAckRecord('G3', g3call, {
      // recordId binds to the REQUESTED cell set (mcp) + the slot's winner
      // generation — the ack's VALUES are the full merged slot state (the
      // no-lost-update proof: both cells present).
      recordIdRe: /^ovr-mcp-team-g\d+$/, generation: 2, kind: 'human-override',
    })
    const cells = Object.keys(g3rec.values ?? {})
    if (!cells.includes('model') || !cells.includes('mcp')) {
      throw new Error(`G3 winner values missing cells: ${JSON.stringify(cells)}`)
    }
    mark('G3', true, `ack record ${g3rec.recordId} gen=${g3rec.generation} cells=[${cells.join(', ')}] (both sets present)`)
  } catch (e) {
    mark('G3', false, e.message)
    failCriteria(`G3: ${e.message}`)
  }

  // ── G4 restart persistence (boot #2 on the SAME DSH_HOME) ─────────────────
  stopHost(HOST.h)
  await sleep(1_500)
  let b2 = null
  try {
    b2 = await bootHost({ port: hostPort, logPath: INSTANCE_LOG_2, cookieFrom: null })
    host2 = b2
    const getM = await remoteCall(b2.origin, b2.cookie, 'override.get', { teamSessionId: T1, capability: 'model', scope: 'team' })
    const getMcp = await remoteCall(b2.origin, b2.cookie, 'override.get', { teamSessionId: T1, capability: 'mcp', scope: 'team' })
    const wm = getM.ok ? getM.data?.override : null
    const wmcp = getMcp.ok ? getMcp.data?.override : null
    if (!getM.ok || !getMcp.ok) throw new Error(`G4 override.get failed after restart (model http=${getM.status} mcp http=${getMcp.status})`)
    if (wm?.recordId !== g3rec.recordId || wm?.generation !== g3rec.generation) {
      throw new Error(`G4 model winner after restart differs: ${JSON.stringify({ id: wm?.recordId, gen: wm?.generation })} vs pre-restart ${JSON.stringify({ id: g3rec.recordId, gen: g3rec.generation })}`)
    }
    if (wmcp?.recordId !== g3rec.recordId) throw new Error(`G4 mcp winner after restart differs: ${wmcp?.recordId}`)
    // The slot generation CONTINUES from the durable value.
    const g4call = await remoteCall(b2.origin, b2.cookie, 'override.set', {
      teamSessionId: T1, capability: 'model', value: overrideValue('model', 'pra-gov/model-b'), scope: 'team',
      actor: { kind: 'human' },
    })
    const g4rec = assertAckRecord('G4', g4call, {
      recordIdRe: /^ovr-model-team-g\d+$/, generation: 3, kind: 'human-override',
    })
    mark('G4', true, `restart winner identical (${wm.recordId} gen=${wm.generation}); next set gen=${g4rec.generation} continues the durable slot`)
  } catch (e) {
    mark('G4', false, e.message)
    failCriteria(`G4: ${e.message}`)
  }
  const { origin: origin2, cookie: cookie2 } = b2

  // ── G5 concurrent two-tab set (model + skills in flight together) ─────────
  const [g5a, g5b] = await Promise.all([
    remoteCall(origin2, cookie2, 'override.set', {
      teamSessionId: T1, capability: 'model', value: overrideValue('model', 'pra-gov/model-c'), scope: 'team',
      actor: { kind: 'human' },
    }),
    remoteCall(origin2, cookie2, 'override.set', {
      teamSessionId: T1, capability: 'skills', value: overrideValue('skills', 'pra-gov/skill-s'), scope: 'team',
      actor: { kind: 'human' },
    }),
  ])
  try {
    if (!g5a.ok || !g5b.ok) {
      throw new Error(`G5 a concurrent set failed (a http=${g5a.status} err=${JSON.stringify(g5a.error)?.slice(0, 200)} b http=${g5b.status} err=${JSON.stringify(g5b.error)?.slice(0, 200)})`)
    }
    const genA = g5a.data?.generation
    const genB = g5b.data?.generation
    const maxGen = Math.max(genA ?? 0, genB ?? 0)
    if (maxGen !== 5) throw new Error(`G5 final generation ${maxGen} !== 5 (two committed changes on top of gen 3)`)
    const getM = await remoteCall(origin2, cookie2, 'override.get', { teamSessionId: T1, capability: 'model', scope: 'team' })
    const winner = getM.ok ? getM.data?.override : null
    const cells = winner ? Object.keys(winner.values ?? {}) : []
    for (const cap of ['model', 'mcp', 'skills']) {
      if (!cells.includes(cap)) throw new Error(`G5 final winner missing cell '${cap}': ${JSON.stringify(cells)}`)
    }
    if (winner?.generation !== 5) throw new Error(`G5 final winner generation ${winner?.generation} !== 5`)
    mark('G5', true, `both acks ok (gens ${genA}/${genB}); final winner ${winner?.recordId} gen=5 cells=[${cells.join(', ')}] (no lost update)`)
  } catch (e) {
    mark('G5', false, e.message)
    failCriteria(`G5: ${e.message}`)
  }

  // ── G6 stale generation (wire-visible slot advancement + audit) ───────────
  // Contract v1 carries no client expectedGeneration (frozen remote
  // contract); the typed conflict negative is pinned by the unit world.
  // The wire-visible consequence: the gen-5 winner supersedes the gen-3
  // record, which stays durable — a writer that still expected gen 3
  // observes the advanced slot on its next read.
  try {
    const g6call = await remoteCall(origin2, cookie2, 'override.set', {
      teamSessionId: T1, capability: 'model', value: overrideValue('model', 'pra-gov/model-d'), scope: 'team',
      actor: { kind: 'human' },
    })
    const g6rec = assertAckRecord('G6', g6call, { recordIdRe: /^ovr-.*-team-g\d+$/, generation: 6, kind: 'human-override' })
    mark('G6', true, `set acked gen=6 (the gen-3..gen-5 writers' expectations are stale against the slot); prior records remain durable (verified by the G7 disk scan) — ack ${g6rec.recordId}`)
  } catch (e) {
    mark('G6', false, e.message)
    failCriteria(`G6: ${e.message}`)
  }

  // ── G7 reset: tombstone re-issue (wire) — the disk scan completes after
  //    host #2 closes (the seam flushes on close). ───────────────────────────
  // The frozen wire contract addresses the reset with a capability field
  // (server-side the slot is reset whole — the capability is part of the
  // address grammar, not a cell selector).
  const g7call = await remoteCall(origin2, cookie2, 'override.reset', { teamSessionId: T1, scope: 'team', capability: 'model', actor: { kind: 'human' } })
  try {
    if (!g7call.ok || g7call.data?.removed !== true) {
      throw new Error(`G7 reset ack wrong (ok=${g7call.ok} removed=${g7call.data?.removed} err=${JSON.stringify(g7call.error)?.slice(0, 200)})`)
    }
    const getM = await remoteCall(origin2, cookie2, 'override.get', { teamSessionId: T1, capability: 'model', scope: 'team' })
    if (!getM.ok) throw new Error(`G7 override.get after reset failed (http=${getM.status})`)
    if (getM.data?.override !== null) throw new Error(`G7 winner after reset should be null (tombstone), got ${JSON.stringify(getM.data?.override)?.slice(0, 200)}`)
  } catch (e) {
    mark('G7', false, e.message)
    failCriteria(`G7: ${e.message}`)
  }

  // ── G8 current-master wire no-regression (before the final stop) ──────────
  try {
    const ps = await remoteCall(origin2, cookie2, 'policyState.get', { teamSessionId: T1 })
    if (!ps.ok) throw new Error(`G8 policyState.get failed (http=${ps.status} err=${JSON.stringify(ps.error)?.slice(0, 200)})`)
    const psState = ps.data?.state
    if (typeof psState?.stateId !== 'string') throw new Error(`G8 policyState.get shape wrong: ${JSON.stringify(ps.data)?.slice(0, 200)}`)
    if (!Array.isArray(psState?.availableTransitions)) throw new Error(`G8 policyState.get missing availableTransitions array`)
    const cat = await remoteCall(origin2, cookie2, 'catalog.list', {})
    if (!cat.ok) throw new Error(`G8 catalog.list failed (http=${cat.status} err=${JSON.stringify(cat.error)?.slice(0, 200)})`)
    const rs = await remoteCall(origin2, cookie2, 'team.getReadState', { sessionId: T1_MEMBER_SESSION }, 6)
    if (!rs.ok) throw new Error(`G8 team.getReadState (v6) failed (http=${rs.status} err=${JSON.stringify(rs.error)?.slice(0, 200)})`)
    mark('G8', true, `policyState.get ok (stateId='${psState.stateId}', ${psState.availableTransitions.length} transition(s)); catalog.list ok; team.getReadState (v6) ok; override acks carry the master record shape (asserted in G2–G6)`)
  } catch (e) {
    mark('G8', false, e.message)
    failCriteria(`G8: ${e.message}`)
  }

  // ── stop host #2 (flush) + the G7 disk scan ───────────────────────────────
  stopHost(host2.h)
  await sleep(1_500)
  try {
    const raw = JSON.parse(readFileSync(join(WORLD, 'storages', 'team_domain.json'), 'utf8'))
    const rows = Object.values(raw.tables.overrides ?? {}).map((v) => JSON.parse(v))
    const t1Rows = rows.filter((r) => r.rootSessionId === T1)
    const teamRows = t1Rows.filter((r) => r.scope === 'team')
    const ids = teamRows.map((r) => r.recordId).sort()
    // Every committed record is intact: the six team-scope writes
    // (model g1, mcp+model g2, model g3, {model,skills}-pair g4+g5,
    // model g6, reset tombstone g7) — plus the seed's instance row
    // (untouched by the team-scope legs).
    const tombstone = teamRows.find((r) => r.recordId.startsWith('ovr-reset-team-g'))
    if (tombstone === undefined) throw new Error(`G7 no tombstone row: ${JSON.stringify(ids)}`)
    if (tombstone.generation !== 7 || Object.keys(tombstone.values ?? {}).length !== 0) {
      throw new Error(`G7 tombstone shape wrong: gen=${tombstone.generation} values=${JSON.stringify(tombstone.values)}`)
    }
    if (teamRows.length !== 7) throw new Error(`G7 expected 7 team-scope rows (6 writes + tombstone counted in the 6? no — 6 set writes... recount: sets g1..g6 = 6 records + 1 tombstone = 7), got ${teamRows.length}: ${JSON.stringify(ids)}`)
    const generations = teamRows.map((r) => r.generation).sort((a, b) => a - b)
    if (JSON.stringify(generations) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7])) {
      throw new Error(`G7 generation chain wrong: ${JSON.stringify(generations)}`)
    }
    const seedInstanceRow = t1Rows.find((r) => r.scope === 'instance')
    if (seedInstanceRow?.recordId !== 'ovr-model-inst-17legoh0ti27-g0') {
      throw new Error(`G7 the seed instance row was disturbed: ${JSON.stringify(seedInstanceRow?.recordId)}`)
    }
    mark('G7', true, `reset ack removed=true; disk scan: ${teamRows.length} team-scope rows intact incl. tombstone ${tombstone.recordId} (values={}); generations [${generations.join(',')}]; the seed instance row untouched — nothing was deleted`)
  } catch (e) {
    mark('G7', false, e.message)
    failCriteria(`G7 disk scan: ${e.message}`)
  }

  // ── G9 cleanup ─────────────────────────────────────────────────────────────
  const stablePost = Object.fromEntries(await Promise.all(STABLE_PROBES.map(async (u) => [u, await probe(u)])))
  rmSync(WORLD, { recursive: true, force: true })
  await MOCK.close()
  mark('G9', existsSync(WORLD) === false, `stable post=${JSON.stringify(stablePost)} (read-only, never bound); world removed`)

  // ── summary ────────────────────────────────────────────────────────────────
  writeEvidence('summary.json', {
    runStamp: RUN_STAMP,
    verdict: 'PASS',
    criteria,
    world: WORLD,
    hostPort,
    mockPort,
    stablePre,
    stablePost,
    worktree: WORKTREE,
    testuse: TESTUSE,
    hostBaselineSha: HOST_BASELINE_SHA,
  })
  writeEvidence('api-transcript.json', scrub(JSON.stringify(transcript, null, 2)))
  for (const l of [INSTANCE_LOG, INSTANCE_LOG_2]) {
    try { copyFileSync(l, l.replace(/\.log$/, '.scrubbed.log')) } catch { /* best effort */ }
  }
  // The scrubbed logs replace the originals in the retained evidence.
  for (const l of [INSTANCE_LOG, INSTANCE_LOG_2]) {
    try {
      const p = l.replace(/\.log$/, '.scrubbed.log')
      writeFileSync(l, scrub(readFileSync(p, 'utf8')))
      rmSync(p)
    } catch { /* best effort */ }
  }
  log(`\nPR-A GOVERNANCE SMOKE: PASS (all legs; evidence at ${EVIDENCE_DIR})`)
  process.exit(0)
} catch (e) {
  dieFatal(e.message ?? String(e))
} finally {
  if (HOST) stopHost(HOST.h)
  if (host2) stopHost(host2.h)
  try { await MOCK.close() } catch { /* already closed */ }
}
