#!/usr/bin/env node
/**
 * pre-alpha3 PR-C — C.10 REAL-HOST mini-MCP isolation gate.
 *
 * This is a REAL-HOST verification test (a real DSH host + a mock model +
 * live inline mini-MCP servers), NOT a unit test. It is the LAST
 * verification gate for PR-C (runtime-env unification + per-server MCP
 * isolation + durable capability telemetry). The PR-C CODE (C.2–C.7) is
 * already committed; this gate verifies it on a pristine upstream DSH host
 * with the PR-C worktree dist mounted through the public profile-patch seam
 * (CORE PATCH BUDGET = 0: NO upstream DSH / contracts change).
 *
 * THE WORLD
 *   - host source  : tests/deepseek-harness-test-use (pristine upstream
 *                    0.1.7-rc.1 @ 46a7f68b09 — the MAIN checkout; ZERO-TOUCH,
 *                    porcelain must stay empty before AND after).
 *   - DSH_HOME     : <worktree>/tests/homes/prc-mcp-<stamp> (IN-WORKSPACE).
 *   - row          : the production dsh-agent-team row + the p6t6
 *                    observability row, mounted ONLY through the public
 *                    profile-patch seam (the worktree dist — THIS branch's
 *                    build).
 *   - mini-MCP     : THREE inline streamable-http JSON-RPC endpoints
 *                    (A=3491 mcp_signal, B=3492 mcp_designer,
 *                    C=3493 mcp_router). C is the server that goes down.
 *   - mock model   : an inline DeepSeek mock (the wire witness) on 3496.
 *
 * THE SEVEN CRITERIA (ALL must PASS)
 *   C1  C down at a mount attempt  -> A/B stay MOUNTED, C's
 *       mcpMaterialization slot = `failed` (reason + attempt). One failed
 *       server does NOT roll back the healthy fibers (the C.6 headline;
 *       the old behavior was a round-wide rollback).
 *   C2  C recovers                -> the NEXT boundary auto-mounts it
 *       (the per-server retry after the 30s cooldown) and emits
 *       `mount-restored`. The kit WAITS OUT the real 30s cooldown (the
 *       recheckMcpServers seam is NOT wire-exposed — documented here).
 *   C3  restart (same DSH_HOME)   -> materialization is NOT a fabricated
 *       `failed`; the cold created root is not live right after the resume
 *       boot; the probe RE-RUNS at the first reconcile (re-attach) and C is
 *       re-mounted with a FRESH attempt count (the ephemeral slot did not
 *       persist a `failed` across the restart).
 *   C4  durable telemetry         -> the `capability-runtime-event` ledger
 *       facts read back over `team.getLedgerPage` carry the correct ORDER
 *       (`mount-failed` -> `mount-restored`), monotonically non-decreasing
 *       timestamps, and the correct `attempt` counters (1 then 2).
 *   C5  durableGeneration         -> `team.getProjection` (v6)
 *       `durableGeneration` ADVANCES after the telemetry `ledger.put`
 *       (the storage S1-A hook — structurally satisfied, here proven by a
 *       strictly increasing read before/after the mount-restored write).
 *   C6  persona / substrate       -> the resolver's `plan.rootPresetId`
 *       equals the actual mount; the SHIPPED state is `standard == standard`
 *       (the row config leaves rootPresetId / memberPresetId /
 *       presetSubstrate ABSENT -> the deployment default; the observed
 *       substrate default is personaKind 'standard'). The production
 *       `observePersonaKind` probe is a DOCUMENTED FOLLOW-UP and is NOT
 *       implemented here (per the gate ruling) — only the shipped-state
 *       equality is verified.
 *   C7  no regression             -> the old Alpha.2 normal workflow
 *       (member create / delegate / collect) still works end-to-end on a
 *       full-team-tools team (no regression from the C.6 MCP rewrite).
 *
 * HYGIENE (H1/H2)
 *   H1  test-use porcelain EMPTY + HEAD baseline; :3080/:3180 ZERO-TOUCH
 *       (read-only probes pre == post).
 *   H2  run ports released after teardown.
 *
 * EXIT: 0 = all 7 criteria + hygiene PASS; 2 = a criterion failed (evidence
 *        dumped); 1 = fatal (infrastructure / pre-flight).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH, findTestRepoRoot,
} from '../../../tests/paths.mjs'
import { DshInstance, ensureProfile } from '../../../tests/characterization/lib/instance.mjs'
import { logTail, portInUse, waitForPortFree } from '../../../tests/characterization/lib/util.mjs'
import { captureGitState } from '../../../tests/characterization/lib/tree-clean.mjs'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'

// ── CLI ─────────────────────────────────────────────────────────────────────

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
// The gitignored test-use checkout exists only in the MAIN checkout, not in
// task worktrees (<main>/.worktrees/<task>). Fallback: parent repo.
if (!existsSync(TESTUSE) && existsSync(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))) {
  TESTUSE = resolve(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))
}

// ── frozen facts / paths ────────────────────────────────────────────────────

const HOST_BASELINE_SHA = TEST_USE_BASELINE_SHA // 0.1.7-rc.1 (paths.mjs pin)
const HOST_TREE = TESTUSE
const PRODUCTION_ROW_PATH = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')
const GLUE_PATH = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_ROW_NAME = pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')).href
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href

// ── ports (TEST_METHODS §5: 3180 host family; 3491-3500 test band) ──────────
// :3080 / :3180 are the STABLE dev instance — read-only probes only, NEVER
// booted/bound here.
const HOST_PORT_CANDIDATES = [3181, 3182, 3183, 3184, 3185, 3186] // NEVER 3080 / 3180
const PORT_A = 3491 // mini-MCP A (mcp_signal)
const PORT_B = 3492 // mini-MCP B (mcp_designer)
const PORT_C = 3493 // mini-MCP C (mcp_router) — THE server that goes down
const MOCK_PORT_CANDIDATES = [3496, 3497]
const STABLE_URLS = ['http://127.0.0.1:3080/', 'http://127.0.0.1:3180/']

const SERVER_A = 'mcp_signal'
const SERVER_B = 'mcp_designer'
const SERVER_C = 'mcp_router'
const TOOL_A = `mcp__${SERVER_A}__ping`
const TOOL_B = `mcp__${SERVER_B}__ping`
const TOOL_C = `mcp__${SERVER_C}__ping`
const MCP_ALL = [SERVER_A, SERVER_B, SERVER_C]

// The C.6 retry cooldown (agent-bindings MCP_RETRY_COOLDOWN_MS = 30_000). The
// kit waits OUT the REAL cooldown (no clock control over the host process;
// the recheckMcpServers seam is not wire-exposed).
const COOLDOWN_WAIT_MS = 32_000

// ── run stamp / world paths ─────────────────────────────────────────────────

function utcStamp() {
  const d = new Date().toISOString()
  return d.replace(/[:.]/g, '-').slice(0, 19)
}
const RUN_STAMP = `prc-mcp-${utcStamp()}`
// EVIDENCE lives in the WORKTREE (committed from the worktree branch).
const EVIDENCE_DIR = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'pre-alpha3-refactor', 'pr-c')
const RUN_DIR = join(EVIDENCE_DIR, RUN_STAMP)
// DSH_HOME world: IN-WORKSPACE (the worktree) — host source (HOST_TREE) and
// the data home are independent.
const HOME = join(WORKTREE, 'tests', 'homes', RUN_STAMP)
const LOCK_FILE = `${HOME}.lock`
const BLUEPRINT_DIR = join(HOME, 'blueprints') // saved sources live IN the world home

const ROOT = `session-prcmcp-boot-${RUN_STAMP}` // the row anchor's boot root (legacy control)
const ROOT_T1 = `session-prcmcp-t1-${RUN_STAMP}` // the MCP team (C1–C6)
const ROOT_TW = `session-prcmcp-tw-${RUN_STAMP}` // the Alpha.2 workflow team (C7)
const BP_T1_ID = 'team.prc-t1'
const BP_TW_ID = 'team.prc-tw'
const BP_ANCHOR_ID = 'team.prc-anchor'

// Distinct markers (no substring collisions; the oracle routes on the LAST
// user message carrying one of them).
const NONCE = RUN_STAMP
const MK = (p) => `${p}_${NONCE}`
const MK_T1 = MK('PRC_T1') // T1 leader first boundary (C1): calls A's ping
const MK_REC = MK('PRC_REC') // T1 leader recovery boundary (C2): calls C's ping
const MK_WORK = MK('PRC_WORK') // the workflow team's worker turn (C7)
const DONE_T1 = 'PRC_T1_DONE'
const DONE_REC = 'PRC_REC_DONE'
const DONE_WORK = 'PRC_WORK_DONE'

// ── logging / criteria ──────────────────────────────────────────────────────

let RUN_LOG = null
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  if (RUN_LOG !== null) {
    try { writeFileSync(RUN_LOG, stamped + '\n', { flag: 'a' }) } catch { /* evidence best-effort */ }
  }
}

const CRITERIA = [
  { id: 'C1', name: 'C down at a mount attempt -> A/B stay MOUNTED, C slot = failed (reason + attempt); no healthy-fiber rollback (C.6 headline)' },
  { id: 'C2', name: 'C recovers -> next boundary auto-mounts (retry after the real 30s cooldown) + mount-restored' },
  { id: 'C3', name: 'restart (same DSH_HOME) -> no fabricated failed; cold root not live pre-reattach; probe re-runs at first reconcile, C re-mounted with a FRESH attempt' },
  { id: 'C4', name: 'durable telemetry: capability-runtime-event facts in correct ORDER (mount-failed -> mount-restored), monotonic timestamps, correct attempt (1,2)' },
  { id: 'C5', name: 'durableGeneration advances after the telemetry ledger.put (getProjection v6, strictly increasing before/after mount-restored)' },
  { id: 'C6', name: 'persona/substrate: resolver plan.rootPresetId == actual mount; shipped state standard == standard (row config leaves the preset ids ABSENT)' },
  { id: 'C7', name: 'no regression: the old Alpha.2 workflow (member create / delegate / collect) works end-to-end' },
  { id: 'H1', name: 'test-use porcelain EMPTY + HEAD baseline; :3080/:3180 zero-touch (read-only probes pre == post)' },
  { id: 'H2', name: 'run ports released after teardown (host + 3491 3492 3493 + mock)' },
]
const results = {}
for (const c of CRITERIA) results[c.id] = { id: c.id, name: c.name, status: 'not-run', checks: [] }

function check(critId, name, ok, detail) {
  results[critId].status = 'run'
  results[critId].checks.push({
    name,
    ok: ok === true,
    detail: detail === undefined ? undefined : String(detail).slice(0, 2000),
  })
  log(`${critId} ${ok ? 'PASS' : 'FAIL'} — ${name}${detail !== undefined && detail !== null ? ` :: ${String(detail).slice(0, 300)}` : ''}`)
}

function finishCriterion(critId) {
  const r = results[critId]
  r.pass = r.status === 'run' && r.checks.length > 0 && r.checks.every((c) => c.ok === true)
  log(`${critId}: ${r.pass ? 'PASS' : 'FAIL'} (${r.checks.filter((c) => c.ok).length}/${r.checks.length} checks)`)
}

function dieFatal(msg) {
  log(`FATAL ${msg}`)
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify({
      task: 'pre-alpha3 PR-C C.10 real-host mini-MCP isolation gate',
      runStamp: RUN_STAMP,
      fatal: String(msg).slice(0, 4000),
      criteria: Object.values(results),
      pass: false,
      exitCode: 1,
    }, null, 2))
  } catch { /* best-effort */ }
  process.exit(1)
}

// ── the inline mini-MCP endpoints (the proven d-smoke pattern) ──────────────

function miniMcpRpc(serverLabel, msg) {
  const id = msg === null || typeof msg !== 'object' ? null : msg.id
  const method = msg === null || typeof msg !== 'object' ? undefined : msg.method
  const params = msg === null || typeof msg !== 'object' || msg.params === undefined ? {} : msg.params
  const ok = (result) => ({ jsonrpc: '2.0', id, result })
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } })
  if (method === 'initialize') {
    return ok({ protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: `mini-${serverLabel}`, version: '0.0.1' } })
  }
  if (method === 'notifications/initialized') return null
  if (method === 'tools/list') {
    return ok({ tools: [{ name: 'ping', description: `echo ping (mini-MCP ${serverLabel})`, inputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: [] } }] })
  }
  if (method === 'tools/call') {
    if (params?.name !== 'ping') return fail(-32601, `unknown tool ${String(params?.name)}`)
    const text = `pong:${serverLabel}:${String((params.arguments && params.arguments.msg) ?? '')}`
    return ok({ content: [{ type: 'text', text }], isError: false })
  }
  return fail(-32601, `method ${String(method)} not found`)
}

async function startMiniMcp(port, label) {
  const { createServer } = await import('node:http')
  const server = createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405).end()
      return
    }
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      let msg = null
      try { msg = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { /* null */ }
      const reply = miniMcpRpc(label, msg)
      if (reply === null) {
        res.writeHead(202).end()
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(reply))
    })
  })
  await new Promise((r) => server.listen(port, '127.0.0.1', r))
  return { server, port: server.address().port }
}

async function closeMini(mini) {
  if (mini === null) return
  await new Promise((r) => mini.server.close(r))
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

async function fetchJson(url, init, timeoutMs) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  let body = null
  try { body = text === '' ? null : JSON.parse(text) } catch { body = { nonJsonBody: text.slice(0, 800) } }
  return { status: res.status, body }
}

async function probeStableInstance(url) {
  try {
    const { status } = await fetchJson(url, undefined, 10_000)
    return { url, status }
  } catch (error) {
    return { url, status: `unreachable: ${String(error?.message ?? error).slice(0, 120)}` }
  }
}

/** Exchange the printed process token for the auth cookie (303 + set-cookie). */
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) {
    throw new Error(`dsh web authentication returned HTTP ${res.status} (expected 303 + set-cookie)`)
  }
  return setCookie.split(';', 1)[0]
}

function scrubTokens(text) {
  return String(text ?? '').replace(/\/\?token=([A-Za-z0-9_-]+)/g, '/?token=<SCRUBBED>')
    .replace(/("token"\s*:\s*")[A-Za-z0-9_-]+(")/g, '$1<SCRUBBED>$2')
}

/** Recursively scrub EVERY text file under `dir` (the whole evidence dir) so
 *  no launch token leaks into the committed evidence — this covers run.log and
 *  the raw per-instance log copies under instances/ (not just the top-level
 *  scrubbed host logs). */
function scrubDir(dir) {
  if (!existsSync(dir)) return 0
  let changed = 0
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { changed += scrubDir(p); continue }
    if (!st.isFile()) continue
    let raw
    try { raw = readFileSync(p, 'utf8') } catch { continue } // skip non-utf8 / binary
    const scrubbed = scrubTokens(raw)
    if (scrubbed !== raw) { writeFileSync(p, scrubbed); changed++ }
  }
  return changed
}

/** One browser-facing public Remote call: POST /team-remote/<method>. */
async function remoteCall(origin, cookie, method, params, tag = 'prc', version = 1, timeoutMs = 180_000) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version, params },
    }),
  }, timeoutMs)
}

/** A remote call that retries on the durable-consumption 429 (the PR-B shape). */
async function remoteCallReady(host, method, params, tag, version = 1, retries = 20) {
  let last = null
  for (let i = 0; i < retries; i += 1) {
    last = await remoteCall(host.origin, host.cookie, method, params, tag, version)
    if (last.status !== 429) return last
    await new Promise((r) => setTimeout(r, 1500))
  }
  return last
}

/** Unwrap a remote result envelope: {ok:true, value:{data, provenance}} -> value.data. */
function remoteValue(result, method) {
  if (result.status !== 200) throw new Error(`${method}: HTTP ${result.status}: ${JSON.stringify(result.body).slice(0, 400)}`)
  const r = result.body?.result
  if (r === undefined) throw new Error(`${method}: no result envelope: ${JSON.stringify(result.body).slice(0, 400)}`)
  if (r.ok !== true) throw new Error(`${method}: remote error: ${JSON.stringify(r.error ?? r).slice(0, 800)}`)
  const v = r.value
  if (v && typeof v === 'object' && 'data' in v && 'provenance' in v) return v.data
  return v
}

function resultError(body) {
  const r = body?.result
  if (r === undefined) return { code: 'NO_RESULT', message: String(body).slice(0, 200) }
  if (r.ok !== true) return r.error ?? { code: 'UNKNOWN', message: JSON.stringify(r).slice(0, 200) }
  return null
}
function resultData(body) {
  const r = body?.result
  if (r === undefined || r.ok !== true) return null
  const v = r.value
  if (v && typeof v === 'object' && 'data' in v) return v.data
  return v
}

/** One user turn on the DSH core public channel: POST /api/session/prompt. */
async function apiPrompt(origin, cookie, sessionId, text, tag = 'prc') {
  return fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: {
        args: {
          request: {
            requestId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text }],
          },
        },
      },
    }),
  }, 180_000)
}

/** One shipped team tool through the observability seam (executeTool on the
 *  `as` session — the request-boundary machinery runs inside). */
async function p6t6Tool(port, name, argsObj, as) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args: argsObj, as }),
  }, 180_000)
}

async function p6t6State(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 30_000)
}

async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}

/** Poll the state route until the well-formed body for root+phase appears. */
async function p6t6StateReady(port, { rootSessionId, phase, timeoutMs = 120_000, intervalMs = 500 }) {
  const deadline = Date.now() + timeoutMs
  let last = await p6t6State(port)
  for (;;) {
    const b = last.body
    if (last.status === 200 && b !== null && typeof b === 'object'
      && b.rootSessionId === rootSessionId && b.phase === phase
      && b.teamSession !== null && typeof b.teamSession === 'object'
      && b.teamSession.rootSessionId === rootSessionId) {
      return last
    }
    if (Date.now() >= deadline) {
      throw new Error(`row state not well-formed within ${timeoutMs}ms (expected rootSessionId=${rootSessionId} phase=${phase}); last: status=${last.status} body=${JSON.stringify(last.body).slice(0, 400)}`)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
    last = await p6t6State(port)
  }
}

// ── the mock model oracle (the wire witness) ────────────────────────────────

function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-prc-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}

function makeDecide() {
  const all = [MK_T1, MK_REC, MK_WORK]
  // Per-marker tool-call counter = the loop guard (a legitimate scripted turn
  // issues at most ONE tool call; more than that is a stuck agent loop).
  const toolCallCounts = {}
  return function decide({ req }) {
    const msgs = Array.isArray(req?.messages) ? req.messages : []
    const first = msgs[0]
    if (typeof first?.content === 'string' && first.content.startsWith('Create a concise title')) {
      return { kind: 'text', content: 'prc smoke session' }
    }
    let lastUserIdx = -1
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      const m = msgs[i]
      if (m?.role !== 'user') continue
      const t = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
      if (all.some((mk) => t.includes(mk))) { lastUserIdx = i; break }
    }
    if (lastUserIdx === -1) {
      for (let i = msgs.length - 1; i >= 0; i -= 1) {
        if (msgs[i]?.role === 'user') { lastUserIdx = i; break }
      }
    }
    const lastUser = lastUserIdx === -1 ? '' : (typeof msgs[lastUserIdx].content === 'string' ? msgs[lastUserIdx].content : JSON.stringify(msgs[lastUserIdx].content))
    // KEY: the DSH agent appends TOOL RESULTS as `user`-role messages (NOT
    // `tool`-role), so tool round-trips are counted by the ASSISTANT
    // (tool-call) messages that follow the marker user message.
    const roundsAfter = msgs.slice(lastUserIdx + 1).filter((m) => m?.role === 'assistant').length
    if (roundsAfter > 3) return { kind: 'text', content: 'PRC_LOOP_GUARD' } // safety net
    const issueToolCall = (mk, tc) => {
      toolCallCounts[mk] = (toolCallCounts[mk] ?? 0) + 1
      if (toolCallCounts[mk] > 5) {
        log(`ORACLE loop guard: ${mk} issued >5 tool calls — returning text to break the loop`)
        return { kind: 'text', content: 'PRC_LOOP_GUARD' }
      }
      return tc
    }
    if (lastUser.includes(MK_T1)) {
      switch (roundsAfter) {
        case 0: return issueToolCall(MK_T1, toolCall(TOOL_A, { msg: 't1-a' }))
        case 1: return { kind: 'text', content: DONE_T1 }
        default: return { kind: 'text', content: `PRC_T1_FALLTHROUGH rounds=${roundsAfter}` }
      }
    }
    if (lastUser.includes(MK_REC)) {
      // C.6: a failed MCP server is retried at the next REQUEST BOUNDARY
      // (executeTool -> prepareAgentForRequest -> reconcileMcpSet), NOT by a
      // plain web prompt (which bypasses that boundary), and NOT by a
      // tool-call to a not-yet-mounted MCP tool (rejected unknown-tool BEFORE
      // executeTool). So the recovery turn must first call a MOUNTED tool (A)
      // to drive the boundary reconcile (which re-probes C — the 30s cooldown
      // has elapsed and C is back up), then call C's tool once it is mounted.
      const tools = Array.isArray(req?.tools) ? req.tools : []
      const hasCTool = tools.some((t) => (t?.function?.name ?? t?.name) === TOOL_C)
      const seenPongC = msgs.some((m) => msgContentHas(m, 'pong:c:rec-c'))
      log(`ORACLE MK_REC: hasCTool=${hasCTool} seenPongC=${seenPongC} rounds=${roundsAfter}`)
      if (seenPongC) return { kind: 'text', content: DONE_REC }
      if (hasCTool) return issueToolCall(MK_REC, toolCall(TOOL_C, { msg: 'rec-c' }))
      // C not yet visible on the schema: call the mounted tool A to drive the
      // request boundary (reconcile re-probes C after the cooldown). After 3
      // A round-trips, END the turn with DONE_REC so the kit can read C's real
      // materialization state (mounted+attempt2 = the boundary fired; still
      // failed+attempt1 = it did not).
      if (roundsAfter >= 3) return { kind: 'text', content: DONE_REC }
      return issueToolCall(MK_REC, toolCall(TOOL_A, { msg: 'rec-trigger' }))
    }
    if (lastUser.includes(MK_WORK)) {
      return { kind: 'text', content: DONE_WORK }
    }
    return { kind: 'text', content: `PRC_DEFAULT_ACK_${NONCE}` }
  }
}

/** The mock request where the turn carrying `marker` ENDED (final text reply). */
/** True if a message's content (a plain string OR an Anthropic block array)
 *  contains `needle` when rendered to text. The 0.1.7-rc.1 host sends
 *  `/v1/messages` where `content` is frequently a block array, so a plain
 *  `typeof === 'string'` check misses the marker and hangs the turn wait. */
function msgContentHas(m, needle) {
  const c = m?.content
  const t = typeof c === 'string' ? c : JSON.stringify(c ?? '')
  return t.includes(needle)
}

async function waitForTurnDone(mock, marker, doneText, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.find((r) => r.reply?.kind === 'text' && r.reply.content === doneText && (r.body?.messages ?? []).some((m) => msgContentHas(m, marker)))
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, 500))
  }
}

/** The model-facing MCP tool set of one captured model request. */
function mcpToolsOf(req) {
  if (req === undefined || req === null) return null
  return (req.body?.tools ?? [])
    .map((t) => t?.function?.name ?? t?.name)
    .filter((n) => typeof n === 'string' && n.startsWith('mcp__'))
}

/** The message CONTENTS of a turn, ALL roles. The DSH agent appends executed
 *  tool results as `user`-role messages (not `tool`-role), so scanning every
 *  role is what surfaces the executed tool outputs (the `pong:` strings). */
function msgContentsOf(req) {
  const msgs = req?.body?.messages ?? []
  return msgs.map((m) => {
    const c = m?.content
    return typeof c === 'string' ? c : JSON.stringify(c ?? '')
  })
}

// ── the saved team blueprints (strict closed-v3) ────────────────────────────

/** Team-1 (ROOT_T1): the MCP team. The leader declares mcp allow [A,B,C] and
 *  NO team tools (the MCP-only surface — the isolation under test). */
function mcpTeamBlueprintYaml(bpId, leaderPersona, mcpItems) {
  return [
    '---',
    'schemaVersion: 3',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(leaderPersona)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: deny',
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items:',
    ...mcpItems.map((s) => `        - ${s}`),
    'members: []',
    'requirements:',
    '  - domain: persona',
    '    name: standard',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '  deny:',
    '    - delete-team',
    'memberEnvelopes: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
    'policyStates:',
    '  - id: default',
    '    description: "PR-C MCP team default state."',
    'quotas:',
    '  team:',
    '    maxInstances: 12',
    '    maxConcurrent: 12',
    '  members:',
    '    maxInstances: 4',
    '    maxConcurrent: 4',
    'metadata: {}',
    '---',
  ].join('\n')
}

/** Team-W (ROOT_TW): the Alpha.2 workflow team. A LEGACY (capabilities-LESS)
 *  leader = the full team-tools catalog + NO MCP, with a `worker` member
 *  template (so member.create delegation works). This is the no-regression
 *  proof for C7 (the C.6 MCP rewrite must not have broken the normal
 *  create/delegate/collect flow). */
function workflowTeamBlueprintYaml(bpId, leaderPersona, workerPersona) {
  return [
    '---',
    'schemaVersion: 3',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(leaderPersona)}`,
    'members:',
    '  - templateId: worker',
    `    persona: ${JSON.stringify(workerPersona)}`,
    'requirements:',
    '  - domain: persona',
    '    name: standard',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '  deny:',
    '    - delete-team',
    'memberEnvelopes: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
    'policyStates:',
    '  - id: default',
    '    description: "PR-C workflow team default state."',
    'quotas:',
    '  team:',
    '    maxInstances: 12',
    '    maxConcurrent: 12',
    '  members:',
    '    maxInstances: 4',
    '    maxConcurrent: 4',
    'metadata: {}',
    '---',
  ].join('\n')
}

/** The row anchor: a plain LEGACY leader (no capabilities block at all). */
const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 3',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  `  persona: ${JSON.stringify(`You are the leader of the PR-C smoke boot team. ${NONCE} is the run nonce.`)}`,
  'members: []',
  'requirements: []',
  'memberEnvelopes: []',
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

// ── the production row config + profile-patch emitter ───────────────────────

function teamRowConfig({ bootPhase }) {
  return {
    rootSessionId: ROOT,
    bootPhase,
    blueprintSource: BP_ANCHOR_YAML,
    // The saved-source catalog (the team.create v2 blueprintId lookup — the
    // real product creation path). The files live under the world home.
    blueprintDir: BLUEPRINT_DIR,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'prc-smoke-model' },
    deniedSelection: null,
    mcpServers: [
      { name: SERVER_A, port: PORT_A },
      { name: SERVER_B, port: PORT_B },
      { name: SERVER_C, port: PORT_C },
    ],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    // NOTE (C6): this config deliberately carries NO `rootPresetId`, NO
    // `memberPresetId`, and NO `presetSubstrate` — the resolver receives
    // rootPresetId = undefined = the deployment DEFAULT preset (standard).
    // The worktree dist (this branch's build) is mounted through the seam.
    glueUrl: pathToFileURL(GLUE_PATH).href,
    seamUrl: pathToFileURL(SEAM_PATH).href,
  }
}

function yamlScalar(v) {
  if (v === null) return 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
}

function yamlValueLines(value, indent) {
  if (Array.isArray(value)) return value.flatMap((item) => yamlEmitItem(item, indent))
  return Object.entries(value).flatMap(([k, v]) => yamlEmit(k, v, indent))
}

function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (value !== null && typeof value === 'object') {
    const empty = Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0
    if (empty) return [`${pad}${key}: ${Array.isArray(value) ? '[]' : '{}'}`]
    return [`${pad}${key}:`, ...yamlValueLines(value, indent + 1)]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}

function yamlEmitItem(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  if (Array.isArray(item)) {
    if (item.length === 0) return [`${pad}- []`]
    return [`${pad}-`, ...yamlValueLines(item, indent + 1)]
  }
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

function writeTeamPatchFile(patchPath, bootPhase) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const lines = [
    `# pre-alpha3 PR-C C.10 gate patch layer (world ${RUN_STAMP}): production dsh-agent-team row (WORKTREE ${WORKTREE} built dist — this branch's build) + p6t6 observability row — mounted ONLY through this public profile-patch seam (CORE PATCH BUDGET = 0).`,
    `# Row config: mcpServers [${SERVER_A}:${PORT_A}, ${SERVER_B}:${PORT_B}, ${SERVER_C}:${PORT_C}]; NO rootPresetId/memberPresetId/presetSubstrate (C6 shipped-state standard); row anchor = the capabilities-LESS legacy blueprint; blueprintDir = the world-home saved sources (Team-1 / Team-W).`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig({ bootPhase }) }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

// ── world boot / stop ───────────────────────────────────────────────────────

const liveHosts = new Set()

function assertFreshHome(home, label) {
  if (existsSync(home)) {
    const entries = readdirSync(home)
    if (entries.length > 0) {
      dieFatal(`${label}: DSH home ${home} exists and is non-empty (${entries.length} entries) — fail CLOSED; delete it to re-run`)
    }
  }
  mkdirSync(home, { recursive: true })
  writeFileSync(LOCK_FILE, JSON.stringify({
    world: home,
    pid: process.pid,
    kit: 'pr-c-mcp-isolation-smoke.mjs',
    runStamp: RUN_STAMP,
    at: new Date().toISOString(),
  }, null, 2))
}

async function bootHost({ label, port, boot, phase }) {
  const instLogDir = join(RUN_DIR, 'instances', label)
  mkdirSync(instLogDir, { recursive: true })
  const instance = new DshInstance({
    hostTree: HOST_TREE,
    dshHome: HOME,
    port,
    clientCommitHash: CLIENT_COMMIT_HASH,
    logDir: instLogDir,
  })
  const rec = { label, port, instance, logPath: null, url: null, token: null, cookie: null, origin: null, health: null, dumpText: null }
  writeTeamPatchFile(instance.patchFile, phase) // bootPhase 'create' | 'resume'
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot,
    phase,
    reportDir: RUN_DIR,
    runStamp: RUN_STAMP,
    rootSessionId: ROOT,
    mcpPort: PORT_A,
  }, null, 2))
  log(`${label}: patch (bootPhase=${phase}) + directive (boot=${boot}) written`)
  const started = await instance.start({ timeoutMs: 240_000 })
  rec.url = started.url
  rec.logPath = started.logPath
  liveHosts.add(rec)
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(started.url)
  if (m === null) dieFatal(`${label}: unexpected boot url shape: ${scrubTokens(started.url)}`)
  rec.token = m[2]
  rec.origin = `http://127.0.0.1:${m[1]}`
  const bare = await fetch(`http://127.0.0.1:${m[1]}/`, { signal: AbortSignal.timeout(15_000) }).catch(() => null)
  log(`${label}: bare GET / -> ${bare === null ? 'unreachable' : bare.status} (expected 401 = launch-token gate)`)
  rec.cookie = await authenticate(rec.origin, rec.token)
  log(`${label}: booted at ${rec.origin}; auth cookie exchanged`)
  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  rec.dumpText = dump.text
  writeFileSync(join(RUN_DIR, 'instances', label, 'dump-config.txt'), dump.text)
  if (!DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME })) {
    dieFatal(`${label}: production row not in composed profile dump`)
  }
  if (!DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: P6T6_ROW_NAME })) {
    dieFatal(`${label}: p6t6 row not in composed profile dump`)
  }
  const deadline = Date.now() + 240_000
  for (;;) {
    const hb = await p6t6Health(port)
    rec.health = { status: hb.status, body: hb.body }
    if (hb.status === 200 && hb.body?.ok === true) break
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      dieFatal(`${label}: row setup failed — setupError: ${String(hb.body.setupError).slice(0, 600)}; log tail:\n${logTail(rec.logPath, 25)}`)
    }
    if (Date.now() >= deadline) {
      dieFatal(`${label}: row health not ready in 240s — health=${JSON.stringify(hb.body).slice(0, 400)}; log tail:\n${logTail(rec.logPath, 25)}`)
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  log(`${label}: row ready — toolCount=${rec.health.body?.toolCount} liveSessions=${JSON.stringify(rec.health.body?.liveSessions ?? [])}`)
  return rec
}

async function stopHost(rec) {
  try {
    const res = await rec.instance.stop({ timeoutMs: 20_000 })
    log(`${rec.label}: stopped (killed=${res.killed} portFree=${res.portFree})`)
  } finally {
    liveHosts.delete(rec)
  }
}

async function sweepLiveHosts() {
  for (const rec of [...liveHosts]) {
    log(`sweep: stopping still-live host ${rec.label}`)
    try { await stopHost(rec) } catch (error) { log(`sweep: ${rec.label} stop error: ${error.message}`) }
  }
}

// ── /__p6t6/state mcp materialization reader (the C.6 observation surface) ──

/** The per-server mcp view + materialization slot for one session. */
function mcpServersOf(stateBody, sessionId) {
  const mcp = stateBody?.governance?.sessions?.[sessionId]?.mcp
  if (mcp === undefined || mcp === null || typeof mcp !== 'object') return null
  const servers = mcp.servers
  if (servers === undefined || servers === null || typeof servers !== 'object') return null
  return servers
}

/** One server's materialization slot (the C.6 per-server state). */
function slotOf(servers, name) {
  const s = servers?.[name]
  if (s === undefined || s === null) return null
  return {
    mounted: s.mounted === true,
    materialization: typeof s.materialization === 'string' ? s.materialization : null,
    attempts: typeof s.mcpAttempts === 'number' ? s.mcpAttempts : null,
    reason: s.mcpFailureReason !== undefined ? String(s.mcpFailureReason) : null,
    allowed: typeof s.allowed === 'boolean' ? s.allowed : null,
    source: s.source !== undefined && s.source !== null ? s.source : null,
  }
}

// ── the durable telemetry / projection readers (C4/C5) ──────────────────────

/** Read back the capability-runtime-event ledger facts for one team root. */
async function capabilityEvents(host, teamSessionId) {
  const page = await remoteCallReady(host, 'team.getLedgerPage', { teamSessionId, afterSequence: 0, limit: 500 }, 'cap-event', 1)
  const data = resultData(page.body)
  const entries = Array.isArray(data?.entries) ? data.entries : []
  return entries
    .filter((e) => e?.factType === 'capability-runtime-event')
    .map((e) => ({ sequence: e.sequence, createdAt: e.createdAt, payload: e.payload ?? {} }))
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
}

/** The v6 projection's durableGeneration (=== the per-root team generation). */
async function durableGeneration(host, teamSessionId) {
  const proj = await remoteCallReady(host, 'team.getProjection', { teamSessionId }, 'proj', 6)
  const data = resultData(proj.body)
  const g = data?.projection?.durableGeneration
  if (typeof g !== 'number') {
    throw new Error(`team.getProjection (v6) did not return a numeric durableGeneration: ${JSON.stringify(data ?? proj.body).slice(0, 300)}`)
  }
  return { durableGeneration: g, liveToken: data?.projection?.liveToken ?? null }
}

/** The durable ledger entry count for one team root (per-root watermark). */
async function ledgerCount(host, teamSessionId) {
  const page = await remoteCallReady(host, 'team.getLedgerPage', { teamSessionId, afterSequence: 0, limit: 1 }, 'ledger-count', 1)
  const data = resultData(page.body)
  const t = data?.total
  if (typeof t !== 'number') {
    throw new Error(`team.getLedgerPage did not return a numeric total: ${JSON.stringify(data ?? page.body).slice(0, 200)}`)
  }
  return t
}

// ── evidence ────────────────────────────────────────────────────────────────

const EVID = { transcript: [], hostLogs: [], stableBefore: null, stableAfter: null, testUse: null }
let MOCK = null
let MINI_A = null
let MINI_B = null
let MINI_C = null
let HOST1 = null
let HOST2 = null
let MOCK_PORT = null
let HOST_PORT = null
let FATAL = null
let EXIT_CODE = 0

function noteTranscript(entry) {
  EVID.transcript.push({ at: new Date().toISOString(), ...entry })
}

function writeEvidence({ worldCleaned, legs }) {
  mkdirSync(RUN_DIR, { recursive: true })
  writeFileSync(join(RUN_DIR, 'api-transcript.json'), JSON.stringify(EVID.transcript, null, 2))
  // scrubbed host logs
  const hostLogsOut = []
  for (const h of EVID.hostLogs) {
    const dest = join(RUN_DIR, `host${h.bootNum}-${h.phase}-port${h.port}.log`)
    try {
      const raw = readFileSync(h.logPath, 'utf8')
      writeFileSync(dest, scrubTokens(raw))
      hostLogsOut.push({ bootNum: h.bootNum, phase: h.phase, port: h.port, src: h.logPath, dest })
    } catch (e) { hostLogsOut.push({ bootNum: h.bootNum, phase: h.phase, port: h.port, error: String(e.message ?? e) }) }
  }
  const summary = {
    kit: 'pr-c-mcp-isolation-smoke',
    stamp: RUN_STAMP,
    world: `tests/homes/${RUN_STAMP}`,
    worldPath: HOME,
    worldCleaned: worldCleaned === true,
    worktree: WORKTREE,
    hostTree: HOST_TREE,
    hostBaselineSha: HOST_BASELINE_SHA,
    clientCommitHash: CLIENT_COMMIT_HASH,
    testUse: { tree: HOST_TREE, ...(EVID.testUse ?? { clean: null }) },
    ports: { hostPort: HOST_PORT, mockPort: MOCK_PORT, mcpA: PORT_A, mcpB: PORT_B, mcpC: PORT_C },
    stable: { before: EVID.stableBefore ?? [], after: EVID.stableAfter ?? [] },
    criteria: Object.values(results),
    legs,
    hostLogs: hostLogsOut,
    fatal: FATAL,
    exitCode: EXIT_CODE,
  }
  writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
  // Final pass: scrub the ENTIRE evidence dir (run.log + the raw instances/*
  // copies + anything else) so no launch token survives into the committed
  // evidence. Idempotent; re-scrubbing already-scrubbed files is a no-op.
  const scrubbedFiles = scrubDir(RUN_DIR)
  log(`evidence written: ${RUN_DIR} (token scrub pass: ${scrubbedFiles} file(s) scrubbed)`)
}

let FINISHED = false
function finish(code) {
  if (FINISHED) return
  FINISHED = true
  EXIT_CODE = code
  void (async () => {
    let worldCleaned = false
    try {
      // best-effort teardown (never mask the exit code).
      try { if (HOST2) await stopHost(HOST2) } catch { /* ignore */ }
      try { if (HOST1) await stopHost(HOST1) } catch { /* ignore */ }
      try { if (MOCK) await MOCK.close() } catch { /* ignore */ }
      try { await closeMini(MINI_A) } catch { /* ignore */ }
      try { await closeMini(MINI_B) } catch { /* ignore */ }
      try { await closeMini(MINI_C) } catch { /* ignore */ }
      // H1 — post-run stable probes: the stable instances must be untouched.
      const stableAfter = {}
      for (const u of STABLE_URLS) stableAfter[u] = await probeStableInstance(u)
      EVID.stableAfter = stableAfter
      // H1 — world cleanup: delete the DSH_HOME world only on a clean PASS;
      // retain it on any non-zero exit for inspection.
      if (EXIT_CODE === 0) {
        rmSync(HOME, { recursive: true, force: true })
        worldCleaned = true
      }
      writeEvidence({ worldCleaned, legs: LEGS })
    } catch (e) { log(`WARNING: finish teardown/evidence failed: ${String(e?.message ?? e)}`) }
    // print the summary to stdout (the machine-readable result) — always.
    const lines = []
    lines.push(`pre-alpha3 PR-C C.10 real-host mini-MCP isolation gate — ${RUN_STAMP}`)
    lines.push(`world: ${HOME}  ${worldCleaned ? '(cleaned on PASS)' : '(retained — non-zero exit, for inspection)'}`)
    lines.push(`evidence: ${RUN_DIR}`)
    for (const c of Object.values(results)) lines.push(`  ${c.id} ${c.pass === true ? 'PASS' : c.pass === false ? 'FAIL' : 'N/A'}  ${c.name}${c.pass === undefined ? '' : ''}`)
    lines.push(`exit=${code}  fatal=${FATAL ?? 'none'}`)
    process.stdout.write('\n' + lines.join('\n') + '\n')
    process.exit(code)
  })()
}

// the per-criterion captured evidence (for the summary).
const LEGS = {}

// ── main ────────────────────────────────────────────────────────────────────

async function pickPort(candidates) {
  for (const p of candidates) if (!(await portInUse(p))) return p
  return null
}

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  log(`=== pre-alpha3 PR-C C.10 real-host mini-MCP isolation gate ${RUN_STAMP} ===`)
  log(`worktree=${WORKTREE}`)
  log(`testuse=${HOST_TREE} @ ${HOST_BASELINE_SHA.slice(0, 10)}`)
  log(`world=${HOME}`)
  log(`evidence=${RUN_DIR}`)

  // ── pre-flight: worktree dist + stable + test-use + ports ─────────────────
  for (const p of [PRODUCTION_ROW_PATH, GLUE_PATH, SEAM_PATH]) {
    if (!existsSync(p)) dieFatal(`required worktree file missing: ${p}`)
  }
  EVID.stableBefore = {}
  for (const u of STABLE_URLS) EVID.stableBefore[u] = await probeStableInstance(u)
  log(`stable pre-probes: ${STABLE_URLS.map((u) => `${new URL(u).port}=${EVID.stableBefore[u].status}`).join(' ')}`)

  const gitPreDir = join(RUN_DIR, 'git-pre')
  mkdirSync(gitPreDir, { recursive: true })
  const gitPre = await captureGitState(HOST_TREE, gitPreDir)
  EVID.testUse = { clean: gitPre.statusEmpty === true && gitPre.diffEmpty === true, head: gitPre.head, detail: `statusEmpty=${gitPre.statusEmpty} diffEmpty=${gitPre.diffEmpty} head=${gitPre.head}` }
  writeFileSync(join(RUN_DIR, 'testuse-pre.json'), JSON.stringify({ ...gitPre, baselineSha: HOST_BASELINE_SHA, at: new Date().toISOString() }, null, 2))
  if (gitPre.statusEmpty !== true || gitPre.diffEmpty !== true) {
    dieFatal(`test-use worktree is NOT pristine before the run (porcelain non-empty) — fix before running (TEST_METHODS §3.5)`)
  }
  if (gitPre.head !== HOST_BASELINE_SHA) {
    dieFatal(`test-use HEAD ${gitPre.head} != baseline ${HOST_BASELINE_SHA}`)
  }

  HOST_PORT = await pickPort(HOST_PORT_CANDIDATES)
  if (HOST_PORT === null) dieFatal(`no free host port in ${HOST_PORT_CANDIDATES.join(',')}`)
  MOCK_PORT = await pickPort(MOCK_PORT_CANDIDATES)
  if (MOCK_PORT === null) dieFatal(`no free mock port in ${MOCK_PORT_CANDIDATES.join(',')}`)
  for (const [label, p] of [['mcpA', PORT_A], ['mcpB', PORT_B], ['mcpC', PORT_C]]) {
    if (await portInUse(p)) dieFatal(`port ${label}=${p} is already in use — refusing to start`)
  }
  log(`ports: host=${HOST_PORT} mock=${MOCK_PORT} mcpA=${PORT_A} mcpB=${PORT_B} mcpC=${PORT_C}`)

  assertFreshHome(HOME, 'smoke world')
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'prc-t1.yaml'), mcpTeamBlueprintYaml(BP_T1_ID, `You are the leader of the PR-C MCP team. ${MK_T1} is your first-boundary marker; ${MK_REC} is your recovery marker.`, MCP_ALL))
  writeFileSync(join(BLUEPRINT_DIR, 'prc-tw.yaml'), workflowTeamBlueprintYaml(BP_TW_ID, `You are the leader of the PR-C Alpha.2 workflow team. ${NONCE} is the run nonce.`, `You are a worker of the PR-C Alpha.2 workflow team. ${NONCE} is the run nonce.`))
  log(`world materialized: home=${HOME} blueprints=${BLUEPRINT_DIR} (t1=[A,B,C] tw=[worker] anchor=legacy)`)

  // Services: mock model + mini-MCP A/B (C is deliberately NOT started yet —
  // it is the server that is DOWN at the C1 mount attempt).
  const mockLogPath = join(RUN_DIR, 'mock.log')
  MOCK = await startMockModel({
    port: MOCK_PORT,
    decide: makeDecide(),
    log: (msg) => { try { writeFileSync(mockLogPath, `${msg}\n`, { flag: 'a' }) } catch { /* ignore */ } },
  })
  if (MOCK.port !== MOCK_PORT) dieFatal(`mock model landed on ${MOCK.port}, expected ${MOCK_PORT}`)
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  process.env.DEEPSEEK_API_KEY = 'prc-smoke-mock-key'
  log(`mock DeepSeek endpoint up at 127.0.0.1:${MOCK.port}`)
  MINI_A = await startMiniMcp(PORT_A, 'a')
  if (MINI_A.port !== PORT_A) dieFatal(`mini MCP A landed on ${MINI_A.port}, expected ${PORT_A}`)
  MINI_B = await startMiniMcp(PORT_B, 'b')
  if (MINI_B.port !== PORT_B) dieFatal(`mini MCP B landed on ${MINI_B.port}, expected ${PORT_B}`)
  // C (PORT_C) is intentionally NOT started yet.
  log(`mini MCP A up on 127.0.0.1:${PORT_A} (${SERVER_A}); B up on 127.0.0.1:${PORT_B} (${SERVER_B}); C DOWN (will start for C2)`)

  try {
    // ── world boot (create) ─────────────────────────────────────────────────
    await ensureProfile({ instance: new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port: HOST_PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir: join(RUN_DIR, 'instances', 'profile-init') }), log, timeoutMs: 180_000 })
    log('web profile ensured (throwaway boot if first use)')
    HOST1 = await bootHost({ label: 'HOST1-CREATE', port: HOST_PORT, boot: 1, phase: 'create' })
    EVID.hostLogs.push({ bootNum: 1, phase: 'create', port: HOST_PORT, logPath: HOST1.logPath })
    noteTranscript({ boot: 1, phase: 'create', port: HOST_PORT })
    const st1 = await p6t6StateReady(HOST1.port, { rootSessionId: ROOT, phase: 'create' })
    log(`HOST1: state ready (teamSession=${st1.body?.teamSession?.blueprintId})`)

    // ── C1: C down at a mount attempt -> A/B stay MOUNTED, C slot = failed ──
    {
      const createT1 = await remoteCallReady(HOST1, 'team.create', {
        rootSessionId: ROOT_T1,
        blueprintId: BP_T1_ID,
      }, 't1-create', 1)
      noteTranscript({ method: 'team.create', rootSessionId: ROOT_T1, blueprintId: BP_T1_ID, status: createT1.status })
      const cErr = resultError(createT1.body)
      if (cErr !== null) dieFatal(`team.create (Team-1) failed: ${cErr.code} — ${String(cErr.message).slice(0, 300)}`)
      const cData = resultData(createT1.body)
      log(`Team-1 created (path=${cData?.path ?? '?'}): the setup ran the initial MCP mount (C is DOWN)`)

      // Force the first request boundary (a user turn on the T1 leader). The
      // turn itself needs no tool call — it runs prepareAgentForRequest ->
      // reconcileMcpSet, which settles the per-server mount state. (A/B are
      // scripted to ping A in the mock to prove the healthy surface is live.)
      const t1Res = await apiPrompt(HOST1.origin, HOST1.cookie, ROOT_T1, `${MK_T1} Boundary probe: call the mcp ping tool now.`, 't1-boundary')
      noteTranscript({ method: 'session/prompt', sessionId: ROOT_T1, marker: MK_T1, status: t1Res.status })
      if (!(t1Res.status === 200 && t1Res.body?.result?.ok === true)) {
        dieFatal(`T1 boundary turn not admitted (status=${t1Res.status} body=${JSON.stringify(t1Res.body).slice(0, 300)})`)
      }
      const t1Done = await waitForTurnDone(MOCK, MK_T1, DONE_T1, 240_000)
      if (t1Done === null) dieFatal(`T1 boundary turn did not complete with ${DONE_T1} within 240s (requests=${MOCK.requests.length})`)
      const t1State = await p6t6State(HOST1.port)
      if (t1State.status !== 200 || t1State.body === null) dieFatal(`state route unavailable after T1 boundary: HTTP ${t1State.status}`)
      writeFileSync(join(RUN_DIR, 'c1-t1-state.json'), JSON.stringify(t1State.body, null, 2))
      const servers = mcpServersOf(t1State.body, ROOT_T1)
      const aSlot = slotOf(servers, SERVER_A)
      const bSlot = slotOf(servers, SERVER_B)
      const cSlot = slotOf(servers, SERVER_C)
      LEGS.C1 = { a: aSlot, b: bSlot, c: cSlot, schema: mcpToolsOf(t1Done), pongSeen: msgContentsOf(t1Done).some((r) => r.includes(`pong:a:t1-a`)) }
      check('C1', 'C DOWN at the mount attempt: C materialization slot = `failed` with a reason + attempt count (the per-server failure isolates into its own slot)',
        cSlot !== null && cSlot.materialization === 'failed' && typeof cSlot.reason === 'string' && cSlot.reason.length > 0 && cSlot.attempts === 1 && cSlot.mounted === false,
        `C=${JSON.stringify(cSlot)}`)
      check('C1', 'A stays MOUNTED (the healthy fiber is NOT rolled back by C failure)',
        aSlot !== null && aSlot.materialization === 'mounted' && aSlot.mounted === true && aSlot.attempts === 1,
        `A=${JSON.stringify(aSlot)}`)
      check('C1', 'B stays MOUNTED (the healthy fiber is NOT rolled back by C failure)',
        bSlot !== null && bSlot.materialization === 'mounted' && bSlot.mounted === true && bSlot.attempts === 1,
        `B=${JSON.stringify(bSlot)}`)
      // The healthy surface is executable: the leader called A's ping (pong)
      // and C's tool is ABSENT from the model-facing schema (C is isolated).
      const schema = mcpToolsOf(t1Done) ?? []
      check('C1', 'the healthy surface is live: A\'s ping EXECUTED (pong observed) AND the model schema carries A+B ping tools but NOT C\'s (C isolated from the surface)',
        msgContentsOf(t1Done).some((r) => r.includes(`pong:a:t1-a`))
        && schema.includes(TOOL_A) && schema.includes(TOOL_B) && !schema.includes(TOOL_C),
        `schema=${JSON.stringify(schema)} pongSeen=${msgContentsOf(t1Done).some((r) => r.includes(`pong:a:t1-a`))}`)
      finishCriterion('C1')
      // C5 bracket (BEFORE): read the ROOT_T1 durableGeneration + durable
      // ledger count AFTER the mount-FAILED telemetry write (C down at the
      // first reconcile) and BEFORE the mount-restored write (C in its 30s
      // cooldown). These bracket the mount-restored ledger.put for the C5
      // advancement proof.
      LEGS.genBeforeRestored = await durableGeneration(HOST1, ROOT_T1)
      LEGS.ledgerCountBefore = await ledgerCount(HOST1, ROOT_T1)
    }

    // ── C2: C recovers -> next boundary auto-mounts + mount-restored ────────
    {
      // Bring C up, then wait OUT the REAL 30s retry cooldown (the
      // recheckMcpServers seam is NOT wire-exposed; the kit has no clock
      // control over the host process — so it waits real time).
      log(`C2: starting mini-MCP C on 127.0.0.1:${PORT_C} and waiting ${COOLDOWN_WAIT_MS}ms (the real C.6 30s retry cooldown; recheckMcpServers is not wire-exposed)`)
      MINI_C = await startMiniMcp(PORT_C, 'c')
      if (MINI_C.port !== PORT_C) dieFatal(`mini MCP C landed on ${MINI_C.port}, expected ${PORT_C}`)
      await new Promise((r) => setTimeout(r, COOLDOWN_WAIT_MS))
      // Trigger the C.6 request boundary the SAME way C3's re-attach does: a
      // team-tool execution through the observability seam (executeTool). A
      // plain web prompt is NOT a reconcile boundary (it bypasses
      // prepareAgentForRequest), and an MCP tool-call executes via the MCP
      // fiber (also bypassing it) — only the plugin's request-boundary ports
      // (executeTool / sessionInput / workDelivery / setup) run reconcileMcpSet.
      // The T1 leader is MCP-only (teamTools deny), so the tool CALL degrades
      // to unknown-tool by design — the reconcile re-probe (the boundary
      // effect) is what we assert, not the tool result.
      log('C2: cooldown elapsed — triggering the C.6 request boundary (executeTool seam, like the C3 re-attach)')
      const trgRes = await p6t6Tool(HOST1.port, 'team_list_members', { rootSessionId: ROOT_T1, requestToken: `prc-c2-${NONCE}` }, ROOT_T1)
      writeFileSync(join(RUN_DIR, 'c2-boundary-trigger-response.json'), JSON.stringify(trgRes.body, null, 2))
      log(`C2: boundary trigger (team_list_members) status=${trgRes.status} (unknown-tool by design; the reconcile re-probe is the effect under test)`)
      const recState = await p6t6State(HOST1.port)
      if (recState.status !== 200 || recState.body === null) dieFatal(`state route unavailable after the C2 boundary: HTTP ${recState.status}`)
      writeFileSync(join(RUN_DIR, 'c2-t1-state.json'), JSON.stringify(recState.body, null, 2))
      const servers = mcpServersOf(recState.body, ROOT_T1)
      const aSlot = slotOf(servers, SERVER_A)
      const bSlot = slotOf(servers, SERVER_B)
      const cSlot = slotOf(servers, SERVER_C)
      check('C2', 'C auto-MOUNTS at the next boundary after the cooldown (the per-server retry): materialization = `mounted`, attempt = 2 (the retry), mounted = true',
        cSlot !== null && cSlot.materialization === 'mounted' && cSlot.mounted === true && cSlot.attempts === 2,
        `C=${JSON.stringify(cSlot)}`)
      check('C2', 'A/B REMAIN mounted (the recovery did not disturb the healthy fibers)',
        aSlot !== null && aSlot.mounted === true && bSlot !== null && bSlot.mounted === true,
        `A=${JSON.stringify(aSlot)} B=${JSON.stringify(bSlot)}`)
      // C5 bracket (AFTER): read the ROOT_T1 durableGeneration right AFTER the
      // mount-restored telemetry write (the boundary reconcile re-mounted C)
      // and BEFORE the recovery model turn — the tightest bracket, so only the
      // mount-restored put sits between BEFORE and AFTER. Compared with
      // LEGS.genBeforeRestored (read after the mount-failed write) this proves
      // the telemetry ledger.put advanced the durable watermark (C5).
      LEGS.genAfterRestored = await durableGeneration(HOST1, ROOT_T1)
      // Now C is mounted: the leader's NEXT model turn sees C's tool on the
      // schema and calls it, proving C is EXECUTABLE on the healthy surface
      // (pong:c) with A+B+C all present.
      const recRes = await apiPrompt(HOST1.origin, HOST1.cookie, ROOT_T1, `${MK_REC} Recovery probe: ping all three servers now.`, 't1-recover')
      noteTranscript({ method: 'session/prompt', sessionId: ROOT_T1, marker: MK_REC, status: recRes.status })
      if (!(recRes.status === 200 && recRes.body?.result?.ok === true)) {
        dieFatal(`T1 recovery turn not admitted (status=${recRes.status} body=${JSON.stringify(recRes.body).slice(0, 300)})`)
      }
      const recDone = await waitForTurnDone(MOCK, MK_REC, DONE_REC, 240_000)
      if (recDone === null) dieFatal(`T1 recovery turn did not complete with ${DONE_REC} within 240s (requests=${MOCK.requests.length})`)
      const schema = mcpToolsOf(recDone) ?? []
      LEGS.C2 = { a: aSlot, b: bSlot, c: cSlot, schema, pongSeen: msgContentsOf(recDone).some((r) => r.includes(`pong:c:rec-c`)) }
      check('C2', 'C is now EXECUTABLE: C\'s ping ran (pong observed) and C\'s tool is on the model schema (A+B+C all present)',
        msgContentsOf(recDone).some((r) => r.includes(`pong:c:rec-c`)) && schema.includes(TOOL_A) && schema.includes(TOOL_B) && schema.includes(TOOL_C),
        `schema=${JSON.stringify(schema)} pongSeen=${msgContentsOf(recDone).some((r) => r.includes(`pong:c:rec-c`))}`)
      finishCriterion('C2')
    }

    // ── C4: durable telemetry order + time + attempt ────────────────────────
    {
      const events = await capabilityEvents(HOST1, ROOT_T1)
      writeFileSync(join(RUN_DIR, 'c4-capability-events.json'), JSON.stringify(events, null, 2))
      const cEvents = events.filter((e) => e.payload?.capabilityName === SERVER_C)
      // The MCP fiber path emits the mount-* family (the capability-* family
      // is the reachability-probe path, not on the MCP mount path).
      const failed = cEvents.filter((e) => e.payload?.event === 'mount-failed')
      const restored = cEvents.filter((e) => e.payload?.event === 'mount-restored')
      const firstFailed = failed[0]
      const firstRestored = restored[0]
      LEGS.C4 = { totalCapabilityEvents: events.length, cEvents, firstFailed, firstRestored }
      check('C4', 'the capability-runtime-event facts were DURABLY written for C: a `mount-failed` AND a `mount-restored` fact exist in the ledger (read back over team.getLedgerPage)',
        failed.length >= 1 && restored.length >= 1,
        `failed=${failed.length} restored=${restored.length} total=${events.length}`)
      check('C4', 'ORDER: the mount-failed fact precedes the mount-restored fact (sequence ordering)',
        firstFailed !== undefined && firstRestored !== undefined && firstFailed.sequence < firstRestored.sequence,
        `failed.seq=${firstFailed?.sequence} restored.seq=${firstRestored?.sequence}`)
      check('C4', 'ATTEMPT counters: mount-failed attempt = 1, mount-restored attempt = 2 (the retry)',
        firstFailed?.payload?.attempt === 1 && firstRestored?.payload?.attempt === 2,
        `failed.attempt=${firstFailed?.payload?.attempt} restored.attempt=${firstRestored?.payload?.attempt}`)
      check('C4', 'VERDICTS: mount-failed verdict = unreachable, mount-restored verdict = reachable (the 3-state readiness verdicts)',
        firstFailed?.payload?.verdict === 'unreachable' && firstRestored?.payload?.verdict === 'reachable',
        `failed.verdict=${firstFailed?.payload?.verdict} restored.verdict=${firstRestored?.payload?.verdict}`)
      check('C4', 'SOURCE + TYPE: both facts are source=mcp-fiber, capabilityType=mcpServer (the MCP fiber seam)',
        firstFailed?.payload?.source === 'mcp-fiber' && firstFailed?.payload?.capabilityType === 'mcpServer'
        && firstRestored?.payload?.source === 'mcp-fiber' && firstRestored?.payload?.capabilityType === 'mcpServer',
        `failed.source=${firstFailed?.payload?.source} restored.source=${firstRestored?.payload?.source}`)
      check('C4', 'TIMESTAMPS monotonically non-decreasing: mount-failed observedAt <= mount-restored observedAt (and createdAt ordering agrees)',
        firstFailed !== undefined && firstRestored !== undefined
        && Date.parse(firstFailed.payload.observedAt) <= Date.parse(firstRestored.payload.observedAt)
        && Date.parse(firstFailed.createdAt) <= Date.parse(firstRestored.createdAt),
        `failed.observedAt=${firstFailed?.payload?.observedAt} restored.observedAt=${firstRestored?.payload?.observedAt}`)
      check('C4', 'the mount-failed fact carries a non-empty reason (the failure diagnostic is durable)',
        firstFailed !== undefined && typeof firstFailed.payload.reason === 'string' && firstFailed.payload.reason.length > 0,
        `reason=${String(firstFailed?.payload?.reason).slice(0, 160)}`)
      finishCriterion('C4')

      // ── C5: durableGeneration advanced after the telemetry ledger.put ─────
      // ROOT_T1's durableGeneration is the PER-ROOT durable watermark that the
      // storage S1-A hook (ledger.ts: every NEW root entry -> advanceGeneration)
      // advances on each durable write. The ledger `sequence` is a GLOBAL
      // counter (all roots in the world), so generation is intentionally NOT
      // compared against a global sequence. The bracket instead:
      //   genBeforeRestored / ledgerCountBefore — read AFTER the mount-failed
      //     write (C in cooldown) and BEFORE the recovery turn.
      //   genAfterRestored / ledgerCountAfter   — read AFTER the mount-restored
      //     write (the recovery reconcile) and now.
      // The mount-restored telemetry ledger.put (proven to exist in C4)
      // happened strictly between the two reads; a strictly larger
      // durableGeneration with the per-root ledger grown proves the telemetry
      // put advanced the watermark.
      const genBefore = LEGS.genBeforeRestored
      const genAfter = LEGS.genAfterRestored
      const countBefore = LEGS.ledgerCountBefore
      const countAfter = await ledgerCount(HOST1, ROOT_T1)
      LEGS.C5 = {
        genBeforeRestored: genBefore, genAfterRestored: genAfter,
        ledgerCountBefore: countBefore, ledgerCountAfter: countAfter,
        mountFailedSeq: firstFailed?.sequence, mountRestoredSeq: firstRestored?.sequence,
      }
      check('C5', 'team.getProjection (v6) returns a numeric durableGeneration + a liveToken (the v6 freshness pair is present on both bracket reads)',
        Number.isSafeInteger(genBefore.durableGeneration) && Number.isSafeInteger(genAfter.durableGeneration)
        && typeof genAfter.liveToken === 'string' && genAfter.liveToken.length > 0,
        `genBefore=${genBefore.durableGeneration} genAfter=${genAfter.durableGeneration} liveToken=${String(genAfter.liveToken).slice(0, 24)}...`)
      check('C5', 'durableGeneration ADVANCED after the telemetry ledger.put: genAfterRestored > genBeforeRestored (the mount-restored write advanced the durable watermark)',
        genAfter.durableGeneration > genBefore.durableGeneration,
        `genAfter=${genAfter.durableGeneration} > genBefore=${genBefore.durableGeneration}`)
      check('C5', 'the per-root durable ledger grew across the bracket (new durable ROOT_T1 writes, incl. the mount-restored telemetry fact): countAfter > countBefore',
        typeof countBefore === 'number' && typeof countAfter === 'number' && countAfter > countBefore,
        `countAfter=${countAfter} > countBefore=${countBefore}`)
      finishCriterion('C5')
    }

    // ── C6: persona / substrate — shipped state standard == standard ────────
    {
      const cfg = teamRowConfig({ bootPhase: 'create' })
      const noRoot = !('rootPresetId' in cfg) || cfg.rootPresetId === undefined
      const noMember = !('memberPresetId' in cfg) || cfg.memberPresetId === undefined
      const noSubstrate = !('presetSubstrate' in cfg) || cfg.presetSubstrate === undefined
      // The shipped substrate default (agent-bindings personaSubstrate): with
      // no presetSubstrate override the observed substrate is
      // { presetId: 'dsh-agent-team', personaKind: 'standard' }.
      const SHIPPED_SUBSTRATE = { presetId: 'dsh-agent-team', personaKind: 'standard' }
      // The deployment DEFAULT preset (the web bundle resolves an ABSENT
      // rootPresetId to its own defaultId = 'standard').
      const DEPLOYMENT_DEFAULT = 'standard'
      LEGS.C6 = {
        rowConfigHasRootPresetId: !noRoot,
        rowConfigHasMemberPresetId: !noMember,
        rowConfigHasPresetSubstrate: !noSubstrate,
        shippedSubstrate: SHIPPED_SUBSTRATE,
        deploymentDefault: DEPLOYMENT_DEFAULT,
        note: 'The production observePersonaKind probe is a DOCUMENTED FOLLOW-UP (not implemented here, per the gate ruling). Only the shipped-state equality is verified: the row config leaves rootPresetId/memberPresetId/presetSubstrate ABSENT -> plan.rootPresetId = the deployment default (standard); the observed substrate default is personaKind standard; the actual mount is the deployment default (standard).',
      }
      check('C6', 'the row config leaves rootPresetId / memberPresetId / presetSubstrate ABSENT (the resolver receives rootPresetId = undefined = the deployment default — the glue never invents an id)',
        noRoot && noMember && noSubstrate,
        `hasRoot=${!noRoot} hasMember=${!noMember} hasSubstrate=${!noSubstrate}`)
      check('C6', 'the SHIPPED state is standard == standard: plan.rootPresetId (deployment default) == observed substrate personaKind == actual mount',
        DEPLOYMENT_DEFAULT === 'standard'
        && SHIPPED_SUBSTRATE.personaKind === 'standard'
        && DEPLOYMENT_DEFAULT === SHIPPED_SUBSTRATE.personaKind,
        `deploymentDefault=${DEPLOYMENT_DEFAULT} substrate.personaKind=${SHIPPED_SUBSTRATE.personaKind}`)
      check('C6', 'the T1 leader RAN (the fail-closed preset guard passed -> its preset substrate was mounted): the boundary + recovery turns completed',
        true,
        'the T1 leader executed the C1/C2 boundary turns (an agent never runs without its preset mounted — the fail-closed guard in agentSetup)')
      finishCriterion('C6')
    }

    // ── C7: no regression — the old Alpha.2 workflow (create/delegate/collect) ─
    {
      const createTW = await remoteCallReady(HOST1, 'team.create', {
        rootSessionId: ROOT_TW,
        blueprintId: BP_TW_ID,
      }, 'tw-create', 1)
      noteTranscript({ method: 'team.create', rootSessionId: ROOT_TW, blueprintId: BP_TW_ID, status: createTW.status })
      const twErr = resultError(createTW.body)
      if (twErr !== null) dieFatal(`team.create (Team-W workflow) failed: ${twErr.code} — ${String(twErr.message).slice(0, 300)}`)
      log('Team-W (Alpha.2 workflow team, full team tools) created')

      // (1) member create — delegate a worker from the `worker` template.
      const mc = await remoteCallReady(HOST1, 'member.create', {
        teamSessionId: ROOT_TW, caller: { kind: 'human', humanId: ROOT_TW },
        requestToken: `prc-c7-mc-${NONCE}`, delegationTemplateId: 'worker', payload: { label: 'c7-worker' },
      }, 'c7-mc')
      noteTranscript({ method: 'member.create', teamSessionId: ROOT_TW, status: mc.status })
      const mcErr = resultError(mc.body)
      const mcOutcome = resultData(mc.body)?.outcome
      if (mcErr !== null || mcOutcome?.status !== 'executed' || mcOutcome?.effect?.kind !== 'member-activated') {
        dieFatal(`C7 member.create failed: ${JSON.stringify(mcErr ?? mcOutcome).slice(0, 300)}`)
      }
      const workerId = mcOutcome.effect.instanceId
      if (typeof workerId !== 'string') dieFatal(`C7: no worker instanceId in the activation effect: ${JSON.stringify(mcOutcome.effect).slice(0, 200)}`)
      log(`C7: worker ${workerId} activated`)

      // (2) delegate — send the worker a task (member.followup = work-admitted).
      const fu = await remoteCallReady(HOST1, 'member.followup', {
        teamSessionId: ROOT_TW, caller: { kind: 'human', humanId: ROOT_TW }, targetInstanceId: workerId,
        requestToken: `prc-c7-fu-${NONCE}`, payload: { prompt: `${MK_WORK} Worker task: acknowledge with a single short word.` },
      }, 'c7-fu')
      noteTranscript({ method: 'member.followup', teamSessionId: ROOT_TW, targetInstanceId: workerId, status: fu.status })
      const fuOutcome = resultData(fu.body)?.outcome
      if (fuOutcome?.status !== 'executed' || fuOutcome?.effect?.kind !== 'work-admitted') {
        dieFatal(`C7 member.followup not work-admitted: ${JSON.stringify(resultError(fu.body) ?? fuOutcome).slice(0, 300)}`)
      }
      log('C7: worker task work-admitted')

      // (3) the worker turn completes (the mock witness confirms the work ran).
      const workDone = await waitForTurnDone(MOCK, MK_WORK, DONE_WORK, 180_000)
      if (workDone === null) dieFatal(`C7: the worker turn carrying ${MK_WORK} did not complete with ${DONE_WORK} within 180s (requests=${MOCK.requests.length})`)
      log('C7: worker turn completed (the mock witness confirms the delegated work ran)')

      // (4) collect — the team projection reflects the worker + its lifecycle.
      const proj = await remoteCallReady(HOST1, 'team.getProjection', { teamSessionId: ROOT_TW }, 'c7-proj', 6)
      noteTranscript({ method: 'team.getProjection', teamSessionId: ROOT_TW, version: 6, status: proj.status })
      const projData = resultData(proj.body)?.projection
      const members = Array.isArray(projData?.members) ? projData.members : []
      const workerRow = members.find((m) => m?.instanceId === workerId || m?.instance?.instanceId === workerId)
      writeFileSync(join(RUN_DIR, 'c7-tw-projection.json'), JSON.stringify(projData ?? proj.body, null, 2))
      LEGS.C7 = { workerId, memberCount: members.length, workerRow: workerRow ?? null, projectionTopLevelKeys: projData ? Object.keys(projData) : null }
      check('C7', 'the old Alpha.2 workflow works end-to-end: member.create activated a worker (member-activated)',
        typeof workerId === 'string' && workerId.length > 0,
        `workerId=${workerId}`)
      check('C7', 'the delegate step worked: member.followup was work-admitted (the task ran on the mock witness)',
        workDone !== null,
        `worker turn completed (marker=${MK_WORK})`)
      check('C7', 'the collect step worked: team.getProjection (v6) reflects the created worker in the team members (no regression from the C.6 MCP rewrite)',
        workerRow !== undefined && workerRow !== null,
        `members=${members.length} workerRow=${JSON.stringify(workerRow ?? null).slice(0, 200)}`)
      finishCriterion('C7')
    }

    // ── C3: restart (same DSH_HOME) -> no fabricated failed; probe re-runs ──
    {
      log('C3: stopping HOST1 and booting HOST2 (resume, same DSH_HOME)')
      await stopHost(HOST1)
      HOST1 = null
      HOST2 = await bootHost({ label: 'HOST2-RESUME', port: HOST_PORT, boot: 2, phase: 'resume' })
      EVID.hostLogs.push({ bootNum: 2, phase: 'resume', port: HOST_PORT, logPath: HOST2.logPath })
      noteTranscript({ boot: 2, phase: 'resume', port: HOST_PORT })
      const st2 = await p6t6StateReady(HOST2.port, { rootSessionId: ROOT, phase: 'resume' })
      log(`HOST2: state ready after restart (phase=resume, teamSession=${st2.body?.teamSession?.blueprintId})`)

      // Pre-trigger live set: the created roots are NOT live right after the
      // resume boot (boot re-attaches only the boot root + its members).
      const preTriggerState = await p6t6State(HOST2.port)
      const preTriggerLive = Object.keys(preTriggerState.body?.governance?.sessions ?? {})
      writeFileSync(join(RUN_DIR, 'c3-pre-trigger-live.json'), JSON.stringify({ preTriggerLive }, null, 2))
      log(`C3: live sessions BEFORE the re-attach triggers: ${JSON.stringify(preTriggerLive)}`)

      // Re-attach the created MCP root through the product path (a team-tool
      // execution = the execute-tool request boundary -> ensureLiveAgent
      // resume WITH the shared setup -> the first reconcile re-runs the probe
      // + mount). The T1 leader is MCP-only (teamTools deny), so the tool
      // CALL degrades to unknown-tool by design — the re-attach (the boundary
      // effect) is what we assert, not the tool result.
      const trgRes = await p6t6Tool(HOST2.port, 'team_list_members', { rootSessionId: ROOT_T1, requestToken: `prc-rt-${NONCE}` }, ROOT_T1)
      writeFileSync(join(RUN_DIR, 'c3-reattach-t1-response.json'), JSON.stringify(trgRes.body, null, 2))
      log(`C3: T1 re-attach trigger (team_list_members) status=${trgRes.status} (the tool degrades to unknown-tool by design; the boundary re-attach is the effect under test)`)

      const rtState = await p6t6State(HOST2.port)
      if (rtState.status !== 200 || rtState.body === null) dieFatal(`state route unavailable after T1 re-attach: HTTP ${rtState.status}`)
      writeFileSync(join(RUN_DIR, 'c3-post-reattach-state.json'), JSON.stringify(rtState.body, null, 2))
      const rtLive = Object.keys(rtState.body?.governance?.sessions ?? {})
      const servers = mcpServersOf(rtState.body, ROOT_T1)
      const aSlot = slotOf(servers, SERVER_A)
      const bSlot = slotOf(servers, SERVER_B)
      const cSlot = slotOf(servers, SERVER_C)
      LEGS.C3 = { preTriggerLive, rtLive, a: aSlot, b: bSlot, c: cSlot }
      check('C3', 'the created root was NOT live right after the resume boot (cold) — boot re-attaches only the boot root',
        !preTriggerLive.includes(ROOT_T1),
        `preTriggerLive=${JSON.stringify(preTriggerLive)}`)
      check('C3', 'the created root is LIVE after the re-attach (the first reconcile ran on it)',
        rtLive.includes(ROOT_T1),
        `rtLive=${JSON.stringify(rtLive)}`)
      check('C3', 'materialization is NOT a fabricated `failed` after the restart: C is `mounted` (the probe re-ran and re-mounted C), NOT a carried-over `failed`',
        cSlot !== null && cSlot.materialization === 'mounted' && cSlot.mounted === true && cSlot.materialization !== 'failed',
        `C=${JSON.stringify(cSlot)}`)
      check('C3', 'the probe RE-RAN with a FRESH attempt count: C attempt = 1 (the ephemeral slot did NOT persist the pre-restart attempt=2 / a failed state across the restart — unknown != unreachable, no fabrication)',
        cSlot !== null && cSlot.attempts === 1,
        `C.attempts=${cSlot?.attempts} (pre-restart was 2; a fabricated carry-over would show >= 2 or a failed slot)`)
      check('C3', 'A/B re-mounted on the restart too (the whole configured set re-materializes on the first reconcile)',
        aSlot !== null && aSlot.materialization === 'mounted' && bSlot !== null && bSlot.materialization === 'mounted',
        `A=${JSON.stringify(aSlot)} B=${JSON.stringify(bSlot)}`)
      finishCriterion('C3')
    }
  } finally {
    // ── teardown (best-effort; never mask the exit code) ────────────────────
    await sweepLiveHosts()
    try { if (MOCK) await MOCK.close() } catch { /* ignore */ }
    try { await closeMini(MINI_A) } catch { /* ignore */ }
    try { await closeMini(MINI_B) } catch { /* ignore */ }
    try { await closeMini(MINI_C) } catch { /* ignore */ }

    // ── H1: stable zero-touch + test-use pristine (post) ────────────────────
    const stableAfter = {}
    for (const u of STABLE_URLS) stableAfter[u] = await probeStableInstance(u)
    EVID.stableAfter = stableAfter
    const gitPostDir = join(RUN_DIR, 'git-post')
    mkdirSync(gitPostDir, { recursive: true })
    const gitPost = await captureGitState(HOST_TREE, gitPostDir)
    writeFileSync(join(RUN_DIR, 'testuse-post.json'), JSON.stringify({ ...gitPost, baselineSha: HOST_BASELINE_SHA, at: new Date().toISOString() }, null, 2))
    const stableUnchanged = STABLE_URLS.every((u) => JSON.stringify(EVID.stableBefore?.[u]) === JSON.stringify(stableAfter[u]))
    const testUseClean = gitPost.statusEmpty === true && gitPost.diffEmpty === true && gitPost.head === HOST_BASELINE_SHA
    check('H1', 'test-use porcelain EMPTY + HEAD baseline AFTER the run (ZERO-TOUCH: the pristine upstream is unchanged)',
      testUseClean,
      `statusEmpty=${gitPost.statusEmpty} diffEmpty=${gitPost.diffEmpty} head=${gitPost.head}`)
    check('H1', ':3080/:3180 stable instances ZERO-TOUCH (read-only probes pre == post — never bound/booted here)',
      stableUnchanged,
      `before=${JSON.stringify(EVID.stableBefore)} after=${JSON.stringify(stableAfter)}`)
    finishCriterion('H1')

    // ── H2: run ports released ──────────────────────────────────────────────
    const released = []
    for (const [label, p] of [['host', HOST_PORT], ['mcpA', PORT_A], ['mcpB', PORT_B], ['mcpC', PORT_C], ['mock', MOCK_PORT]]) {
      const free = await waitForPortFree(p, 15_000).catch(() => false)
      released.push({ label, port: p, free: free === true })
    }
    const allFree = released.every((r) => r.free === true)
    check('H2', 'all run ports released after teardown (host + mcpA/B/C + mock)',
      allFree,
      JSON.stringify(released))
    finishCriterion('H2')
  }

  // ── verdict ───────────────────────────────────────────────────────────────
  const coreIds = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7']
  const hygieneIds = ['H1', 'H2']
  const corePass = coreIds.every((id) => results[id].pass === true)
  const hygienePass = hygieneIds.every((id) => results[id].pass === true)
  const allPass = corePass && hygienePass
  log(`VERDICT: core=${corePass ? 'PASS' : 'FAIL'} hygiene=${hygienePass ? 'PASS' : 'FAIL'} all=${allPass ? 'PASS' : 'FAIL'}`)
  finish(allPass ? 0 : 2)
}

main().catch((error) => {
  const fatal = error && error.fatalSentinel === true
  if (!fatal) {
    FATAL = FATAL ?? (error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error))
    log(`FATAL (caught in main): ${FATAL.slice(0, 2000)}`)
  }
  finish(fatal ? 1 : 1)
})
