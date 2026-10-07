#!/usr/bin/env node
/**
 * F15 — pre-alpha3 F15 MCP Live-Loss Zero-Core Upgrade — REAL-HOST smoke kit.
 *
 * Task: prove the F15 product closure (commits 1-2 of
 * feat/pre-alpha3-f15-mcp-live-loss) on a REAL DSH host — pristine upstream
 * test-use (0.1.7-rc.1 @ 46a7f68b09) + this branch's production build + the
 * REAL mcp-client plugin + a REAL streamable-http mini-MCP server + the real
 * request boundaries + the PUBLIC tool registry. No monkey-patching, no
 * private imports, no internal-client reads (CORE PATCH BUDGET = 0).
 *
 * ══ THE HEADLINE FINDING (parent-ruling 2026-09-28: Option A) ══════════════
 * The pinned 0.1.7-rc.1 mcp-client supervisor does NOT detect a LIVE
 * streamable-http server death: its only entry into the reconnect loop is the
 * SDK Client.onclose hook (connection.ts:279), and the streamable-http
 * transport fires onclose ONLY on explicit close() (SDK index.mjs:5290); a
 * dead SSE stream runs the SDK's own internal stream re-reconnect and on
 * exhaustion fires only transport.onerror (index.mjs:5175). Empirically
 * (scratch probes with the real plugin bundle): kill the server → ZERO
 * supervisor log lines, the registered tools stay on the public surface
 * forever ("ghost tools"), readiness stays reachable, the gate stays open.
 * The stdio transport DOES close→onclose (stdio.mjs:90-93), and the
 * failed-CONNECT path runs the full loop — but the production mount is
 * streamable-http only (agent-bindings.mjs:1685-1687). Consequence for the
 * plan §10 legs (ruling Option A): R1 keeps its spirit with a redefined
 * witness (transparent blip, no false loss); R2 becomes a FIRST-CLASS
 * REAL-HOST FINDING (recorded verbatim with exact wall-clock timings); R3'
 * exercises the mount-time-failure + plugin-cooldown + fresh-remount
 * machinery (the F15 R3 machinery on a real host — the production
 * failOnStartupError:true config makes the upstream loop run a single
 * attempt: apply() throws on the first failed connect → Cordis rolls back
 * the fiber → dispose() clears the reconnect timer, so the 3.5 s upstream
 * budget is NOT exercised on this path — recorded, never equated with the
 * SLO, plan §8.2); R4 + R5 run verbatim per plan §10.
 *
 * ══ LEGS ═══════════════════════════════════════════════════════════════════
 * C0  blueprint preflight: catalog.get resolves the v3 blueprint (with the
 *     complete:true mcpServer teamRequirement) + intent.probe PASSes pre-
 *     create (the row environmentFacts seed feeds the unknown live verdict —
 *     the create-preflight fact source, host.ts:1932-1935).
 * C1  team.create (v1 envelope + initialWork) → path=fresh-root.
 * C2  baseline: the initial work turn DIRECTLY calls mcp__mcp-f15__ping
 *     (pong:alpha), the slot is mounted (attempts=1), the model-facing
 *     surface (the V1 authority: the captured request tools[]) carries the
 *     tool, and ZERO capability-runtime-event facts exist.
 * R1  TRANSIENT BLIP: kill the mini-MCP (T_kill) → wait 1.3 s → restore.
 *     The next turn's tool call succeeds (pong:beta) through the SAME live
 *     fiber. Witness: zero mcp-client log lines in the outage window (the
 *     streamable-http signature: the supervisor is silent), the surface is
 *     visible throughout (the ghost behavior is BENIGN here — the server
 *     came back), the fiber is NOT recycled (attempts=1), zero
 *     capability-lost telemetry, no retirement observation, the next
 *     new-work boundary (team_delegate) is ADMITTED.
 * R2  PERMANENT LOSS — FIRST-CLASS FINDING (recorded verbatim): kill the
 *     mini-MCP, wait ≥4.5 s real (a margin over the 3.5 s upstream budget —
 *     the budget is NOT the detection bound; plan §8.2: wall-clock timings
 *     are recorded and NEVER equated with the SLO), then: (a) a no-tool
 *     leader turn shows the GHOST tool still on the public surface; (b) a
 *     team_delegate boundary is ADMITTED (readiness reachable — the stale
 *     positive persists); (c) a scripted tool call FAILS model-visibly (the
 *     SDK fetch error surfaces as the tool error; exact latency + error
 *     text recorded). Asserts the finding: ZERO supervisor log lines, the
 *     slot still mounted attempts=1, zero capability-lost telemetry, no
 *     retirement — F15's surface-driven confirmed-loss classification
 *     cannot fire because the pinned upstream never withdraws the surface.
 * R4  POLICY DENY IS NOT A LOSS: team-remote override.set {mcp:{kind:'deny'}}
 *     (team scope on the T1 root — the team that HOLDS the fiber; the row
 *     harness mutate route writes the row's anchor-team slot, the wrong
 *     team) → the next boundary disposes the fiber (the intentional-
 *     removal sequence) → the surface is WITHDRAWN (the plugin removes the
 *     tools) → the delegate is STILL ADMITTED (the probe is unknown — no
 *     fiber, the slot is not failed — and the row seed feeds available) →
 *     ZERO new capability-runtime-event facts (no capability-lost, no
 *     mount-*), no MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN anywhere, no
 *     retirement observation (plan §5.2: a plugin-initiated removal emits
 *     no runtime-loss telemetry) → the override is then RESET (world
 *     hygiene: the durable deny must not survive into boot 2, where R3'
 *     needs the template-only target set to produce the mount-time failure).
 * R5  RESTART: boot 2 (resume, the mini-MCP stays DOWN). BEFORE any
 *     boundary: no fabricated mcp slot in the state (the witness + slots
 *     are ephemeral — never persisted), zero new capability facts since the
 *     R4 watermark, no retirement observation.
 * R3' MOUNT-TIME FAILURE → COOLDOWN → FRESH REMOUNT (the F15 R3 machinery
 *     on a real host): first boundary with the server down → the upstream
 *     supervisor runs its single attempt (WARN 'connection attempt
 *     failed' + WARN 'connection failed; retrying in 500ms (attempt 1/3)' —
 *     ctx.logger-only: NO real-host sink exists, so the single-attempt proof
 *     rides the observable channels — slot failed/attempts=1, one
 *     mount-failed telemetry, no "giving up" on any observable channel;
 *     finding F15-LOGSINK-1) → apply() throws (failOnStartupError) → the
 *     plugin records slot failed (attempts=1) + exactly one mount-failed
 *     telemetry → the gate BLOCKS (TEAM_RUNTIME_COMPATIBILITY_BLOCKED,
 *     gateReason requiredScopeDown, source requirement-gate) → the recovery
 *     dispatch opens the human-reviewed control request (correlation
 *     'recovery:*' — read from the TEAM's own ledger) → resolved deny →
 *     typed zero-effect block. Server restored → immediate boundary → the
 *     plugin cooldown SKIPS the failed slot (no new attempt, no new
 *     telemetry — no hot retry loop) → still BLOCKED → resolved deny.
 *     After ≥30 s real (elapsed recorded) → boundary → fresh remount
 *     (attempts=2) → mount-restored EXACTLY ONCE → gate OPEN → delegate
 *     ADMITTED → a final leader ping turn proves pong end-to-end.
 * H1  teardown: every kit port torn down, the stable instances (:3080/:3180)
 *     probed before/after (read-only), git pre/post (test-use MUST be
 *     pristine @ 46a7f68b09 before AND after; the worktree pre/post status
 *     recorded), tokens scrubbed from the whole evidence dir.
 *
 * ══ ENVIRONMENT ════════════════════════════════════════════════════════════
 * Model: the mock Messages API (packages/tools/harness/mock-deepseek.mjs)
 *   on 3497, wired the house way: DEEPSEEK_BASE_URL/DEEPSEEK_API_KEY
 *   exported to the host launches; the row staticModel =
 *   {provider:'deepseek-official', model:'f15-smoke-model'}.
 * MCP: the REAL harness mini-MCP (packages/runtime/root-binding/harness/
 *   mini-mcp.mjs — POST /mcp only, initialize 2025-06-18, listChanged:false,
 *   NO session id, the 'ping' tool → 'pong:<msg>') on 3491; the production
 *   mount target is http://127.0.0.1:3491/mcp (the row config mcpServers).
 * Hosts: 3182 (boot 1, create) / 3183 (boot 2, resume). NEVER 3080/3081/
 *   3180/3181/3496 (existing listeners). Home: tests/homes/<stamp>
 *   (workspace-internal, fail-closed non-empty).
 *
 * USAGE:
 *   node tests/kits/f15-mcp-live-loss-smoke/f15-mcp-live-loss-smoke.mjs \
 *     [--worktree <path>] [--keep]
 *   defaults: --worktree = the repo root containing this kit (3 levels up);
 *   the test-use fallback resolves to the parent repo's checkout (the
 *   gitignored checkout exists only in the main checkout, not in task
 *   worktrees).
 *
 * EXIT: 0 = all criteria pass; 2 = a criterion failed (full evidence dump
 * in the run dir); 1 = fatal (environment/boot/row).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH, findTestRepoRoot } from '../../../tests/paths.mjs'
import { DshInstance, ensureProfile } from '../../../tests/characterization/lib/instance.mjs'
import { logTail, portInUse, waitForPortFree } from '../../../tests/characterization/lib/util.mjs'
import { captureGitState } from '../../../tests/characterization/lib/tree-clean.mjs'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
import { startMiniMcpServer, closeMiniServer } from '../../../packages/runtime/root-binding/harness/mini-mcp.mjs'

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function argValue(name, dflt) {
  const i = args.indexOf(name)
  if (i === -1) return dflt
  return args[i + 1] ?? dflt
}
const FLAG_KEEP = args.includes('--keep')

const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(KIT_DIR, '..', '..', '..')))
function dieLate(msg) {
  console.error(`FATAL: ${msg}`)
  process.exit(1)
}
// The pristine test-use checkout lives in the MAIN repo (gitignored); a task
// worktree has no copy of its own — the pr-c fallback pattern.
const TESTUSE = (() => {
  const inTree = join(WORKTREE, 'tests', 'deepseek-harness-test-use')
  if (existsSync(inTree)) return inTree
  const parent = join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use')
  if (existsSync(parent)) return parent
  dieLate(`test-use checkout not found at ${inTree} or ${parent}`)
  return null
})()

const HOST_BASELINE_SHA = TEST_USE_BASELINE_SHA // generation lives ONLY in tests/paths.mjs; never restate it here
const HOST_TREE = TESTUSE
const PRODUCTION_ROW_PATH = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')
const GLUE_PATH = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_ROW_NAME = pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')).href

// Ruling-fixed ports (parent ruling 2026-09-28): hosts 3182/3183, MCP 3491,
// mock 3497. NEVER 3080/3081/3180/3181/3496.
const HOST1_PORT = 3182
const HOST2_PORT = 3183
const MCP_PORT = 3491
const MOCK_PORT = 3497
const STABLE_URLS = ['http://127.0.0.1:3080/', 'http://127.0.0.1:3180/']

const SERVER = 'mcp-f15'
const TOOL_PING = `mcp__${SERVER}__ping`
const GATE_BLOCKED_CODE = 'TEAM_RUNTIME_COMPATIBILITY_BLOCKED' // admission/errors.ts:94 (verbatim passthrough)

function utcStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}
const RUN_STAMP = `f15-${utcStamp()}`
const EVIDENCE_DIR = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'f15-mcp-live-loss')
const RUN_DIR = join(EVIDENCE_DIR, RUN_STAMP)
const HOST_REPO_ROOT = findTestRepoRoot(WORKTREE) ?? resolve(WORKTREE)
const HOME = join(HOST_REPO_ROOT, 'tests', 'homes', RUN_STAMP) // TEST_METHODS §7 ephemeral form
const LOCK_FILE = `${HOME}.lock`
const BLUEPRINT_DIR = join(HOME, 'blueprints') // saved sources live IN the world home

const ROOT = `session-f15-boot-${RUN_STAMP}` // the row anchor's boot root (the directive root)
const ROOT_T1 = `session-f15-t1-${RUN_STAMP}` // the F15 team root (the leader session)
const BP_F15_ID = 'f15.leader' // the v3 team blueprint (the real team)
const BP_ANCHOR_ID = 'f15.anchor' // the row anchor (legacy, capabilities-LESS)

const NONCE = RUN_STAMP
// Leader turn markers (the mock model keys its scripted replies on them).
const MK1 = `F15_T1_${NONCE}` // initial work: ping alpha
const MK_R1 = `F15_R1_${NONCE}` // R1 post-restore: ping beta
const MK_R2S = `F15_R2S_${NONCE}` // R2 surface check: no tool, "say hi"
const MK_R2P = `F15_R2P_${NONCE}` // R2 ghost ping gamma (the call fails model-visibly)
const MK_R4 = `F15_R4_${NONCE}` // R4 surface check: no tool, "say hi"
const MK_R3F = `F15_R3F_${NONCE}` // R3' final ping delta (end-to-end proof)
// Worker work-unit markers (the delegate prompts).
const WK_R1 = `F15_WKR1_${NONCE}`
const WK_R2 = `F15_WKR2_${NONCE}`
const WK_R4 = `F15_WKR4_${NONCE}`
const WK_R3 = `F15_WKR3_${NONCE}`

// ── criteria / results ──────────────────────────────────────────────────────

let RUN_LOG = null
function log(line) {
  const ts = new Date().toISOString()
  const l = `[${ts}] ${line}`
  console.log(l)
  if (RUN_LOG !== null) {
    try { writeFileSync(RUN_LOG, `${readFileSync(RUN_LOG, 'utf8')}${l}\n`, 'utf8') } catch { /* best effort */ }
  }
}

const CRITERIA = [
  { id: 'PREF', name: 'preflight (dist present, test-use pristine @ baseline, stable probes, ports, fresh home)' },
  { id: 'C0', name: 'blueprint preflight: catalog.get resolves v3 + intent.probe PASS (row seed feeds the unknown verdict)' },
  { id: 'C1', name: 'team.create (v1 envelope + initialWork) → fresh-root' },
  { id: 'C2', name: 'baseline: initial work calls MCP (pong:alpha), slot mounted attempts=1, surface visible, zero capability facts' },
  { id: 'R1', name: 'transient blip: transparent recovery — no false loss, zero capability-lost, fiber not recycled, boundary admitted' },
  { id: 'R2', name: 'PERMANENT LOSS FINDING: supervisor silent, ghost surface retained, readiness reachable, boundary admitted, ghost call fails model-visibly (verbatim + exact timings)' },
  { id: 'R4', name: 'policy deny is not loss: surface withdrawn by the plugin, zero runtime-loss telemetry, delegate still admitted' },
  { id: 'R5', name: 'restart: no fabricated slot, zero new capability facts, no retirement — witness ephemeral' },
  { id: 'R3', name: "mount-time failure → 30 s plugin cooldown (no hot retry) → fresh remount attempts=2 → mount-restored exactly once → gate OPEN (R3' corrected path)" },
  { id: 'H1', name: 'teardown: all kit ports down, stable instances unchanged, test-use pristine, tokens scrubbed' },
]
const results = {}
function check(critId, name, ok, detail) {
  if (results[critId] === undefined) results[critId] = { id: critId, name: CRITERIA.find((c) => c.id === critId)?.name ?? critId, checks: [] }
  results[critId].checks.push({ name, ok: ok === true, detail: detail === undefined ? '' : String(detail).slice(0, 600) })
  log(`${ok ? 'PASS' : 'FAIL'} [${critId}] ${name}${detail ? ` — ${String(detail).slice(0, 220)}` : ''}`)
  return ok === true
}
function finishCriterion(critId) {
  if (results[critId] !== undefined) results[critId].done = true
}
function dieFatal(msg) {
  log(`FATAL: ${msg}`)
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify({
      task: 'F15 MCP live-loss zero-core upgrade — real-host smoke',
      runStamp: RUN_STAMP,
      fatal: String(msg).slice(0, 4000),
      criteria: Object.values(results),
      pass: false,
      exitCode: 1,
    }, null, 2))
  } catch { /* RUN_DIR may not exist yet */ }
  process.exit(1)
}

// ── evidence ────────────────────────────────────────────────────────────────

const EVID = {
  legs: {},
  stablePre: null,
  stablePost: null,
  testUsePre: null,
  testUsePost: null,
  worktreeGitPre: null,
  worktreeGitPost: null,
  modelPath: { used: 'mock-env', baseUrl: null },
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

/** One browser-facing public Remote call: POST /team-remote/<method>. */
async function remoteCall(origin, cookie, method, params, tag = 'f15', version = 1, timeoutMs = 180_000) {
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
    await sleep(1500)
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
async function apiPrompt(origin, cookie, sessionId, text, tag = 'f15') {
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

/** One shipped team tool through the pattern-sanctioned observability seam
 *  (executeTool on the `as` session — the request-boundary machinery runs
 *  inside: ensure-live -> boundary reconciliation -> tools.execute). */
async function p6t6Tool(port, name, argsObj, as, timeoutMs = 180_000) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args: argsObj, as }),
  }, timeoutMs)
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
    await sleep(intervalMs)
    last = await p6t6State(port)
  }
}

// ── /__p6t6/state mcp shape readers (the I5 per-server diagnostics) ─────────

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

function stateObservationsOf(stateBody) {
  const obs = stateBody?.observations
  return Array.isArray(obs) ? obs.map(String) : []
}

// ── the durable telemetry / control readers (the TEAM's own ledger) ─────────

/** Read the whole durable ledger of one team root (the per-root authority). */
async function ledgerEntries(host, teamSessionId) {
  const page = await remoteCallReady(host, 'team.getLedgerPage', { teamSessionId, afterSequence: 0, limit: 500 }, 'ledger', 1)
  // STRICT (F15 run-4 postmortem): a non-200 final status (a 429 wall that
  // survived the retry chain) or a non-ok envelope must THROW, never
  // masquerade as an empty ledger — the run-4 recovery control request
  // sat unresolved for 120 s because a silently-empty poll cannot see it.
  if (page.status !== 200) {
    throw new Error(`team.getLedgerPage: HTTP ${page.status} after retries: ${JSON.stringify(page.body ?? null).slice(0, 240)}`)
  }
  const data = resultData(page.body)
  if (data === null) {
    throw new Error(`team.getLedgerPage: non-ok envelope: ${JSON.stringify(page.body ?? null).slice(0, 240)}`)
  }
  return Array.isArray(data?.entries) ? data.entries : []
}

/** The capability-runtime-event facts for one team root (sorted by sequence). */
async function capabilityEvents(host, teamSessionId) {
  const entries = await ledgerEntries(host, teamSessionId)
  return entries
    .filter((e) => e?.factType === 'capability-runtime-event')
    .map((e) => ({ sequence: e.sequence, createdAt: e.createdAt, payload: e.payload ?? {} }))
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
}

function factEntries(entries, factType) {
  return entries.filter((e) => e?.factType === factType)
}

/** The pending control requests of one root: `control-request-recorded`
 *  entries with NO matching `control-decision-recorded` and NO matching
 *  abandon fact. (The p6t6 `control` section is directive-ROOT-scoped —
 *  scenario teams are read from their OWN ledgers.) */
function pendingControlRequests(entries) {
  const requests = factEntries(entries, 'control-request-recorded')
  const decided = new Set(factEntries(entries, 'control-decision-recorded').map((e) => e?.payload?.requestId))
  const abandoned = new Set(factEntries(entries, 'control-request-abandoned').map((e) => e?.payload?.requestId))
  return requests
    .filter((e) => e?.payload?.requestId !== undefined && !decided.has(e.payload.requestId) && !abandoned.has(e.payload.requestId))
    .map((e) => e.payload)
}

/** Resolve one control request through the public Remote surface. */
async function resolveControl(host, teamSessionId, requestId, decision, note, tag) {
  // team.resolveControl is the v4-ONLY remote method (the F9 human ingress
  // for the durable control plane — the host derives the human principal
  // from the connection-gate authority, the wire carries no caller field).
  // A version-1 request is typed-rejected `method-version-unsupported`
  // (the run-4 stall: every resolve silently no-opped and the recovery
  // control request was never decided).
  return remoteCallReady(host, 'team.resolveControl', { teamSessionId, requestId, decision, note }, tag ?? `resolve-${String(requestId).slice(0, 12)}`, 4, 4)
}

// ── mock-model transcript readers ───────────────────────────────────────────
//
// WIRE FORMAT (0.1.7-rc.1 baseline, verified against the real host): the
// dsh-llm-deepseek adapter speaks the DeepSeek MESSAGES API — Anthropic-style
// streaming. Requests carry `messages: [{ role, content: [blocks] }]` where
// content is an ARRAY of blocks: {type:'text',text} / {type:'tool_use',id,name,input}
// (assistant) / {type:'tool_result',tool_use_id,content,is_error?} (delivered
// inside role:'user' messages — there is NO role:'tool' on this baseline; the
// adapter maps its internal role:'tool' to role:'user' + tool_result block,
// merging consecutive same-role messages). `tools` is Anthropic-style
// {name,description,input_schema}. The mock harness (packages/tools/harness/
// mock-deepseek.mjs) detects the route (/v1/messages) and speaks the matching
// SSE event vocabulary. These readers are block-format aware (with a legacy
// role:'tool' fallback for the old /chat/completions wire).

/** The textual content of one wire message (string content or text blocks). */
function msgText(m) {
  if (m === null || m === undefined) return ''
  const c = m.content
  if (typeof c === 'string') return c
  if (Array.isArray(c)) {
    const parts = []
    for (const b of c) {
      if (b === null || typeof b !== 'object') continue
      if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text)
      else if (b.type === 'tool_result') {
        if (Array.isArray(b.content)) for (const x of b.content) if (typeof x?.text === 'string') parts.push(x.text)
        else if (typeof b.content === 'string') parts.push(b.content)
      }
      else if (b.type === 'tool_use') parts.push(`[tool_use ${b.name ?? 'unknown'}]`)
    }
    return parts.join('\n')
  }
  return JSON.stringify(c ?? '')
}

/** The tool_result block TEXTS in `msgs` strictly after index `fromIdx`
 *  (the executed-tool outputs reported after a given user message). */
function toolResultsAfter(msgs, fromIdx) {
  const out = []
  for (let i = fromIdx + 1; i < msgs.length; i += 1) {
    const m = msgs[i]
    if (m?.role === 'tool') { out.push(String(m.content ?? '')); continue }
    const c = m?.content
    if (Array.isArray(c)) {
      for (const b of c) {
        if (b?.type !== 'tool_result') continue
        if (Array.isArray(b.content)) out.push(b.content.map((x) => (typeof x?.text === 'string' ? x.text : '')).join(''))
        else if (typeof b.content === 'string') out.push(b.content)
        else out.push(JSON.stringify(b.content ?? ''))
      }
    }
  }
  return out
}

/** The number of tool_result blocks in `msgs` strictly after index `fromIdx`. */
function toolResultCountAfter(msgs, fromIdx) {
  return toolResultsAfter(msgs, fromIdx).length
}

/** The index of the LAST user message whose text contains `marker` (-1 none). */
function lastMarkerUserIdx(req, marker) {
  const msgs = req?.body?.messages ?? []
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    if (msgs[i]?.role === 'user' && msgText(msgs[i]).includes(marker)) return i
  }
  return -1
}

/** The model-facing MCP tool set of one captured model request (the V1
 *  authority for the public tool surface). */
function mcpToolsOf(req) {
  if (req === undefined || req === null) return null
  return (req.body?.tools ?? [])
    .map((t) => t?.function?.name ?? t?.name)
    .filter((n) => typeof n === 'string' && n.startsWith('mcp__'))
}

/** The tool-call RESULT contents of a turn (the executed tool outputs). */
function toolResultsOf(req) {
  const msgs = req?.body?.messages ?? []
  const out = []
  for (const m of msgs) {
    if (m?.role === 'tool') { out.push(String(m.content ?? '')); continue }
    const c = m?.content
    if (!Array.isArray(c)) continue
    for (const b of c) {
      if (b?.type !== 'tool_result') continue
      if (Array.isArray(b.content)) out.push(b.content.map((x) => (typeof x?.text === 'string' ? x.text : '')).join(''))
      else if (typeof b.content === 'string') out.push(b.content)
      else out.push(JSON.stringify(b.content ?? ''))
    }
  }
  return out
}

/** The mock request where the turn carrying `marker` ENDED (final text reply). */
async function waitForTurnDone(mock, marker, doneText, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.find((r) => r.reply?.kind === 'text' && r.reply.content === doneText && (r.body?.messages ?? []).some((m) => msgText(m).includes(marker)))
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) return null
    await sleep(500)
  }
}

// ── the saved team blueprints ───────────────────────────────────────────────

/** The F15 team (schemaVersion 3 — the PR-E real-host-proven shape): the
 *  complete:true mcpServer teamRequirement + the leader's mcp initial grant
 *  [mcp-f15] + the worker template (mcp allow [] = fail-closed). K4/K12: the
 *  leader envelope carries request-control + resolve-control (the recovery
 *  dispatch opens through the caller's mutation envelope). */
function f15BlueprintYaml(leaderPersona, workerPersona) {
  return [
    '---',
    'schemaVersion: 3',
    `blueprintId: ${BP_F15_ID}`,
    'revision: "1"',
    'teamRequirements:',
    '  - requirementId: req-f15-mcp',
    '    type: mcpServer',
    `    subjects: [${SERVER}]`,
    '    complete: true',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(leaderPersona)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    '        - team_delegate',
    '        - team_follow_up',
    '        - team_list_members',
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items:',
    `        - ${SERVER}`,
    'members:',
    '  - templateId: worker',
    `    persona: ${JSON.stringify(workerPersona)}`,
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    '      builtinToolDeny: []',
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    'requirements: []',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '    - request-control',
    '    - resolve-control',
    '  deny:',
    '    - delete-team',
    'memberEnvelopes: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
    'policyStates:',
    '  - id: default',
    '    description: "F15 live-loss team default state."',
    'quotas:',
    '  team:',
    '    maxInstances: 4',
    '    maxConcurrent: 4',
    '  members:',
    '    maxInstances: 2',
    '    maxConcurrent: 2',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

/** The row anchor: a plain LEGACY leader (no capabilities block at all — the
 *  row requires a blueprintSource; the anchor is MCP-inert by construction,
 *  fail-closed — it declares the row's mcp REQUIREMENT for the S6 fact feed
 *  (W3-A–E thunk scoping) but carries no mcp CAPABILITY, so it never mounts). */
const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 3',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  `  persona: ${JSON.stringify(`You are the row anchor of the F15 smoke world. ${RUN_STAMP} is the run nonce. No work is assigned to you.`)}`,
  'members: []',
  // Row-environment requirement on the ANCHOR (the row-bound blueprint):
  // the W3-A–E (6d5269b9) S6 environmentFacts thunk resolves the team-scope
  // facts through the live provider over the ROW-BOUND blueprint's team
  // requirements — a bare v1 anchor (the pre-W3-A–E mgis/PR-E pattern)
  // yields an EMPTY feed, so intent.probe + the invariant-50 work-admission
  // gate fail closed for any complete requirement and the row
  // environmentFacts seed (now a seed-ONLY fallback for unknown live
  // verdicts) is unreachable. Declaring the row's mcp supply requirement
  // here (flat requirements list: domain mcp -> mcpServer, subject = name) makes the
  // provider probe mcp-f15 in the thunk scope: fresh boot -> unknown ->
  // the row seed (available:true) -> the pre-create probe is OPEN and the
  // create admission passes. (First-class finding F15-W3AE-1; recorded in
  // summary.json `findings` and reported to the parent.)
  'requirements:',
  '  - domain: mcp',
  `    name: ${SERVER}`,
  'memberEnvelopes: []',
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  'policyStates:',
  '  - id: default',
  '    description: "F15 row anchor default state."',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  '  members:',
  '    maxInstances: 2',
  '    maxConcurrent: 2',
  'metadata: {}',
  '---',
  '',
].join('\n')

// ── row config / patch / directive ──────────────────────────────────────────

/** One boot's row config (the PR-E 0.1.7-rc.1-era shape): environmentFacts =
 *  the row-level SEED the gate + probe read (a bootstrap/static source only —
 *  it feeds the engine for subjects whose live verdict is UNKNOWN and never
 *  overrides a live verdict; the fact domain == the v2 requirement TYPE). */
function teamRowConfig(bootPhase) {
  return {
    rootSessionId: ROOT,
    bootPhase,
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: BLUEPRINT_DIR,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'f15-smoke-model' },
    deniedSelection: null,
    mcpServers: [{ name: SERVER, port: MCP_PORT }],
    mcpServer: null,
    environmentFacts: [{ domain: 'mcpServer', subject: SERVER, available: true, generation: 1 }],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
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

function writeTeamPatchFile(patchPath, rowConfig, comment) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href
  // The 0.1.7-rc.1 loader overlay format: a TOP-LEVEL YAML ARRAY of loader
  // patch entries — `- insert:` + the row list (the mgis / restart-017rc1
  // proven shape).
  const lines = [
    '# F15 real-host smoke world profile patch (this run only — mounted through the',
    `# public profile-patch seam; ${comment})`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: rowConfig }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    '',
  ]
  writeFileSync(patchPath, `${lines.join('\n')}\n`)
}

// ── host lifecycle ──────────────────────────────────────────────────────────

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
    kit: 'f15-mcp-live-loss-smoke.mjs',
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
  const rec = { label, port, boot, phase, instance, logPath: null, url: null, token: null, cookie: null, origin: null, health: null, dumpText: null }
  writeTeamPatchFile(instance.patchFile, teamRowConfig(phase), `${label}: bootPhase=${phase}`)
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot,
    phase,
    reportDir: RUN_DIR,
    runStamp: RUN_STAMP,
    rootSessionId: ROOT,
    mcpPort: MCP_PORT,
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
  if (!DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: pathToFileURL(PRODUCTION_ROW_PATH).href })) {
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
    await sleep(1000)
  }
  log(`${label}: row ready — toolCount=${rec.health.body?.toolCount}`)
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

// ── the mock model (marker-driven oracle) ───────────────────────────────────

function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-f15-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}

function makeDecide() {
  const leaderMarkers = [MK1, MK_R1, MK_R2S, MK_R2P, MK_R4, MK_R3F]
  const workerMarkers = [WK_R1, WK_R2, WK_R4, WK_R3]
  return function decide({ req }) {
    const msgs = Array.isArray(req?.messages) ? req.messages : []
    const first = msgs[0]
    // The session-title request: 0.1.7-rc.1 sends "Generate the session title
    // from this JSON array of human messages: …" (the older baseline said
    // "Create a concise title…"). The title prompt QUOTES the work text, so
    // this branch must run before the marker scan.
    const firstText = msgText(first)
    if (firstText.startsWith('Generate the session title') || firstText.startsWith('Create a concise title')) {
      return { kind: 'text', content: 'f15 smoke session' }
    }
    // Locate the last user message carrying a known marker (leader or worker).
    let lastUserIdx = -1
    let marker = null
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      const m = msgs[i]
      if (m?.role !== 'user') continue
      const t = msgText(m)
      const hit = [...leaderMarkers, ...workerMarkers].find((mk) => t.includes(mk))
      if (hit !== undefined) { lastUserIdx = i; marker = hit; break }
    }
    if (marker === null) {
      for (let i = msgs.length - 1; i >= 0; i -= 1) {
        if (msgs[i]?.role === 'user') { lastUserIdx = i; break }
      }
    }
    // Tool results on the 0.1.7 wire are tool_result BLOCKS inside role:'user'
    // messages (there is no role:'tool') — count blocks, not messages.
    const toolsAfter = lastUserIdx === -1 ? 0 : toolResultCountAfter(msgs, lastUserIdx)
    if (marker !== null && workerMarkers.includes(marker)) {
      return { kind: 'text', content: `WORKER_DONE ${marker}` }
    }
    switch (marker) {
      case MK1:
        switch (toolsAfter) {
          case 0: return toolCall(TOOL_PING, { msg: 'alpha' })
          case 1: return { kind: 'text', content: 'F15_T1_DONE' }
          default: return { kind: 'text', content: `F15_T1_FALLTHROUGH tools=${toolsAfter}` }
        }
      case MK_R1:
        switch (toolsAfter) {
          case 0: return toolCall(TOOL_PING, { msg: 'beta' })
          case 1: return { kind: 'text', content: 'F15_R1_DONE' }
          default: return { kind: 'text', content: `F15_R1_FALLTHROUGH tools=${toolsAfter}` }
        }
      case MK_R2S:
        return { kind: 'text', content: 'F15_R2S_DONE' } // NO tool call — the surface witness only
      case MK_R2P:
        switch (toolsAfter) {
          // The ghost call: the tool executes and FAILS (the server is dead);
          // the model sees the tool error and reports it (the turn completes).
          case 0: return toolCall(TOOL_PING, { msg: 'gamma' })
          case 1: return { kind: 'text', content: 'F15_R2P_DONE' }
          default: return { kind: 'text', content: `F15_R2P_FALLTHROUGH tools=${toolsAfter}` }
        }
      case MK_R4:
        return { kind: 'text', content: 'F15_R4_DONE' } // NO tool call — the surface witness only
      case MK_R3F:
        switch (toolsAfter) {
          case 0: return toolCall(TOOL_PING, { msg: 'delta' })
          case 1: return { kind: 'text', content: 'F15_R3F_DONE' }
          default: return { kind: 'text', content: `F15_R3F_FALLTHROUGH tools=${toolsAfter}` }
        }
      default:
        return { kind: 'text', content: `F15_DEFAULT_ACK_${NONCE}` }
    }
  }
}

/** Drive one turn on a LIVE session and snapshot (state + model schema). */
async function probeTurn({ label, host, sessionId, marker, mock, doneText }) {
  const res = await apiPrompt(host.origin, host.cookie, sessionId, marker)
  if (!(res.status === 200 && res.body?.result?.ok === true)) {
    throw new Error(`${label}: turn not admitted (apiPrompt status=${res.status} body=${JSON.stringify(res.body).slice(0, 300)})`)
  }
  const done = await waitForTurnDone(mock, marker, doneText, 240_000)
  if (done === null) throw new Error(`${label}: the turn carrying ${marker} did not complete with ${doneText} within 240s (requests=${mock.requests.length})`)
  const state = await p6t6State(host.port)
  if (state.status !== 200 || state.body === null) throw new Error(`${label}: state route unavailable: HTTP ${state.status}`)
  return { label, done, stateBody: state.body, schema: mcpToolsOf(done), results: toolResultsOf(done) }
}

// ── host log window reader (byte-offset based — robust to log formats) ─────

function logFileBytes(rec) {
  try { return readFileSync(rec.logPath) } catch { return Buffer.alloc(0) }
}

/** The host-log lines appended between two byte offsets. */
function logLinesBetween(rec, fromOffset, toOffset) {
  const buf = logFileBytes(rec)
  const end = Math.min(toOffset, buf.length)
  const start = Math.min(fromOffset, end)
  const chunk = buf.subarray(start, end).toString('utf8')
  return chunk.split('\n').filter((l) => l.length > 0)
}

function logLength(rec) {
  return logFileBytes(rec).length
}

// ── the gated delegate attempt (block → recovery control → resolve) ────────

/**
 * Fire ONE leader team_delegate through the p6t6 seam (async:false — the
 * call returns when the work unit settles or the block stands) and, in
 * parallel, resolve the recovery control requests it opens (correlation
 * prefix 'recovery:'). Returns { tool, pendingSeen, decisions }.
 */
async function gatedDelegateCall(host, tag, { label, requestToken, prompt, policyRecovery = 'deny', timeoutMs = 120_000 }) {
  const callArgs = {
    rootSessionId: ROOT_T1,
    requestToken,
    label,
    prompt,
    delegationTemplateId: 'worker',
    async: false,
  }
  const toolPromise = p6t6Tool(host.port, 'team_delegate', callArgs, ROOT_T1, timeoutMs)
  const pendingSeen = []
  const decisions = []
  const seen = new Set()
  const resolvedOk = new Set()
  let stop = false
  const poll = (async () => {
    let pollNo = 0
    while (!stop) {
      await sleep(1000)
      pollNo += 1
      try {
        const entries = await ledgerEntries(host, ROOT_T1)
        const pending = pendingControlRequests(entries)
        // Liveness logging (F15 run-4 postmortem): the first three polls
        // must be auditable — a silently-empty poll (a swallowed 429) is
        // exactly how run-4's recovery control request went unseen for
        // 120 s. The ledger read is now STRICT (throws on non-200 /
        // non-ok), so these counts are trustworthy.
        if (pollNo <= 3) log(`gatedDelegateCall ${tag}: poll #${pollNo} entries=${entries.length} pending=${pending.length}`)
        for (const req of pending) {
          const rid = req.requestId
          const isRecovery = typeof req.correlation === 'string' && req.correlation.startsWith('recovery:')
          if (!seen.has(rid)) {
            seen.add(rid)
            pendingSeen.push({
              requestId: rid,
              kind: req.kind ?? null,
              correlation: req.correlation ?? null,
              toolName: req.toolName ?? null,
              actionName: req.actionName ?? null,
              createdAt: req.createdAt ?? null,
              payload: req,
            })
            log(`gatedDelegateCall ${tag}: pending control request ${rid} (correlation=${req.correlation ?? null} kind=${req.kind ?? null})`)
          }
          if (!isRecovery || resolvedOk.has(rid)) continue
          const r = await resolveControl(host, ROOT_T1, rid, policyRecovery, `f15 ${tag} (${policyRecovery})`, `resolve-${tag}-${String(rid).slice(0, 8)}`)
          const errCode = resultError(r.body)?.code ?? null
          log(`gatedDelegateCall ${tag}: resolve ${rid} decision=${policyRecovery} -> HTTP ${r.status} error=${errCode}`)
          decisions.push({ requestId: rid, decision: policyRecovery, resolveStatus: r.status, resolveError: errCode })
          // A failed resolve is RETRIED on the next poll (run-4: the
          // one-shot seen-set stranded a failed resolve forever). The
          // server's exactly-once semantics make the retry safe — a
          // duplicate returns CONTROL_REQUEST_DECIDED, counted as done.
          if ((r.status === 200 && errCode === null) || errCode === 'CONTROL_REQUEST_DECIDED') resolvedOk.add(rid)
        }
      } catch (error) {
        log(`gatedDelegateCall ${tag}: poll #${pollNo} error (transient): ${String(error?.message ?? error).slice(0, 300)}`)
      }
    }
  })()
  // stop MUST be set even when the tool call rejects (run-4: the poll loop
  // is an orphan otherwise and holds the process open forever after a
  // timeout — the teardown never finished).
  let tool
  try {
    tool = await toolPromise
  } finally {
    stop = true
  }
  await poll.catch(() => { /* settled */ })
  return { tool, pendingSeen, decisions, call: callArgs }
}

/** A closed team-tool rejection (K6): {ok:true, value:{status:'rejected',
 *  code, message, details}} — the typed gate block travels as a CLOSED
 *  result, never as the ok:false thrown-fault branch. */
function closedRejection(resp) {
  return resp.body?.ok === true && resp.body?.value?.status === 'rejected'
}

function rejectedValue(resp) {
  return closedRejection(resp) ? resp.body.value : null
}

function admittedValue(resp) {
  if (resp.body?.ok !== true) return null
  const v = resp.body.value
  if (v?.status === 'rejected') return null
  return v
}

// ── token scrubbing (the whole evidence dir before commit) ──────────────────

function scrubTokens(text) {
  return String(text ?? '').replace(/\/\?token=([A-Za-z0-9_-]+)/g, '/?token=<SCRUBBED>')
    .replace(/("token"\s*:\s*")[A-Za-z0-9_-]+(")/g, '$1<SCRUBBED>$2')
}

/** Restart the mini-MCP with a bounded retry: a close + immediate rebind can
 *  race the listener teardown (EADDRINUSE); the retry is kit-side polling,
 *  NOT the plugin's retry loop. */
async function startMiniMcpWithRetry(candidates, maxTries = 12) {
  let lastErr = null
  for (let i = 0; i < maxTries; i += 1) {
    try {
      const started = await startMiniMcpServer(candidates)
      if (started.port === candidates[0]) return started
      await closeMiniServer(started)
      lastErr = new Error(`mini MCP landed on ${started.port}, expected ${candidates[0]}`)
    } catch (error) {
      lastErr = error
    }
    await sleep(500)
  }
  throw lastErr
}

/** Recursively scrub EVERY text file under `dir` so no launch token leaks
 *  into the committed evidence. */
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

// ── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  let host1 = null
  let host2 = null
  let mini = null
  let mockRef = { current: null }
  // Set when the legs block threw: the teardown still runs, but the
  // VERDICT summary + exit(0/2) must NOT mask the real failure — the
  // main().catch handler owns the fatal summary + exit(1) then.
  let legsThrew = false

  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  writeFileSync(RUN_LOG, '', 'utf8')
  log(`=== F15 MCP live-loss zero-core real-host smoke ${RUN_STAMP} (ruling: Option A) ===`)
  log(`worktree=${WORKTREE}`)
  log(`testuse=${HOST_TREE} @ ${HOST_BASELINE_SHA.slice(0, 10)}`)
  log(`evidence=${RUN_DIR} keep=${FLAG_KEEP}`)

  // ── PREF ──────────────────────────────────────────────────────────────────
  for (const p of [PRODUCTION_ROW_PATH, GLUE_PATH, SEAM_PATH]) {
    if (!existsSync(p)) dieFatal(`required worktree file missing: ${p}`)
  }
  EVID.stablePre = {}
  for (const u of STABLE_URLS) EVID.stablePre[u] = await probeStableInstance(u)
  writeFileSync(join(RUN_DIR, 'stable-pre.json'), JSON.stringify(EVID.stablePre, null, 2))
  log(`stable pre-probes: ${STABLE_URLS.map((u) => `${new URL(u).port}=${EVID.stablePre[u].status}`).join(' ')}`)

  const gitPreDir = join(RUN_DIR, 'git-pre')
  mkdirSync(gitPreDir, { recursive: true })
  const testusePre = await captureGitState(HOST_TREE, gitPreDir)
  EVID.testUsePre = testusePre
  writeFileSync(join(RUN_DIR, 'testuse-pre.json'), JSON.stringify({ ...testusePre, baselineSha: HOST_BASELINE_SHA, at: new Date().toISOString() }, null, 2))
  if (testusePre.statusEmpty !== true || testusePre.diffEmpty !== true) {
    dieFatal('test-use worktree is NOT pristine before the run (porcelain non-empty) — fix before running (TEST_METHODS §3.5)')
  }
  if (testusePre.head !== HOST_BASELINE_SHA) {
    dieFatal(`test-use HEAD ${testusePre.head} != baseline ${HOST_BASELINE_SHA}`)
  }
  const worktreePre = await captureGitState(WORKTREE, gitPreDir)
  EVID.worktreeGitPre = worktreePre
  writeFileSync(join(RUN_DIR, 'worktree-git-pre.json'), JSON.stringify(worktreePre, null, 2))
  log(`worktree pre-status: clean=${worktreePre.statusEmpty} (untracked scratch expected — the kit + probes are committed later)`)

  for (const [label, p] of [['host1', HOST1_PORT], ['host2', HOST2_PORT], ['mcp', MCP_PORT], ['mock', MOCK_PORT]]) {
    if (await portInUse(p)) dieFatal(`port ${label}=${p} is already in use — refusing to start`)
  }
  log(`ports: host1=${HOST1_PORT} host2=${HOST2_PORT} mcp=${MCP_PORT} mock=${MOCK_PORT}`)

  assertFreshHome(HOME, 'smoke world')
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'f15-leader-bp.yaml'), f15BlueprintYaml(
    `You are the leader of the F15 live-loss team. ${NONCE} is the run nonce. When a marker turn asks you to ping, call the mcp__${SERVER}__ping tool EXACTLY once with the given msg, then answer with the turn's done marker text verbatim. When a marker turn asks you to say hi, answer with the done marker text verbatim and call NO tools.`,
    'You are a worker of the F15 live-loss team. Do exactly what the work unit says, then finish.',
  ))
  log(`world materialized: home=${HOME} blueprints=${BLUEPRINT_DIR}`)
  check('PREF', `preflight (dist files present; test-use pristine @ ${HOST_BASELINE_SHA.slice(0, 10)}; stable instances probed; kit ports free; home fresh)`, true, 'see stable-pre.json / testuse-pre.json / worktree-git-pre.json')
  finishCriterion('PREF')

  // Services: mock model + mini MCP.
  const mock = await startMockModel({ port: MOCK_PORT, decide: makeDecide(), log: (l) => log(`mock: ${l}`) })
  if (mock.port !== MOCK_PORT) dieFatal(`mock model landed on ${mock.port}, expected ${MOCK_PORT}`)
  mockRef.current = mock
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  process.env.DEEPSEEK_API_KEY = 'f15-smoke-mock-key'
  EVID.modelPath.baseUrl = process.env.DEEPSEEK_BASE_URL
  log(`mock DeepSeek endpoint up at 127.0.0.1:${MOCK_PORT}`)
  try {
    mini = await startMiniMcpServer([MCP_PORT])
    if (mini.port !== MCP_PORT) dieFatal(`mini MCP landed on ${mini.port}, expected ${MCP_PORT}`)
  } catch (error) {
    dieFatal(`mini MCP startup failed: ${error.message}`)
  }
  log(`mini MCP up on 127.0.0.1:${MCP_PORT} (${SERVER})`)

  try {
    // ── BOOT 1 (create; the mini-MCP is UP) ─────────────────────────────────
    await ensureProfile({ instance: new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port: HOST1_PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir: join(RUN_DIR, 'instances', 'profile-init') }), log, timeoutMs: 180_000 })
    log('web profile ensured (throwaway boot if first use)')
    host1 = await bootHost({ label: 'HOST1-CREATE', port: HOST1_PORT, boot: 1, phase: 'create' })
    const st1 = await p6t6StateReady(host1.port, { rootSessionId: ROOT, phase: 'create' })
    log(`HOST1: state ready (anchor teamSession=${st1.body?.teamSession?.blueprintId})`)

    // ── C0: the blueprint preflight (catalog + intent.probe) ────────────────
    {
      const catGet = await remoteCallReady(host1, 'catalog.get', { blueprintId: BP_F15_ID }, 'catget')
      writeFileSync(join(RUN_DIR, 'c0-catalog-get.json'), JSON.stringify(catGet.body ?? catGet, null, 2))
      const catOk = resultError(catGet.body) === null
      const probe = await remoteCallReady(host1, 'intent.probe', { blueprintId: BP_F15_ID, environmentFacts: [] }, 'intent-probe')
      writeFileSync(join(RUN_DIR, 'c0-intent-probe.json'), JSON.stringify(probe.body ?? probe, null, 2))
      const pErr = resultError(probe.body)
      const compat = pErr === null ? resultData(probe.body)?.compatibility ?? null : null
      const reqRow = Array.isArray(compat?.requirements) ? compat.requirements.find((r) => r?.requirementId === 'req-f15-mcp') ?? null : null
      check('C0', 'catalog.get resolves the v3 blueprint; intent.probe: req-f15-mcp (complete:true mcpServer) outcome=PASS with status=OPEN — the row environmentFacts seed feeds the pre-create unknown live verdict',
        catOk && pErr === null && compat?.status === 'OPEN' && reqRow?.outcome === 'PASS',
        `catalog=${catOk} status=${compat?.status} req=${JSON.stringify(reqRow ?? null).slice(0, 200)}`)
      finishCriterion('C0')
    }

    // ── C1: team.create (v1 envelope + initialWork) ─────────────────────────
    const createT1 = await remoteCall(host1.origin, host1.cookie, 'team.create', {
      rootSessionId: ROOT_T1,
      blueprintId: BP_F15_ID,
      initialWork: { prompt: `${MK1} Your first task: ping the mcp server now — call the mcp__${SERVER}__ping tool with msg "alpha" and report the result. Answer with the text F15_T1_DONE when done.` },
    }, 't1')
    writeFileSync(join(RUN_DIR, 'c1-team-create.json'), JSON.stringify(createT1.body ?? createT1, null, 2))
    const t1Data = (() => { try { return remoteValue(createT1, 'team.create') } catch { return null } })()
    check('C1', 'team.create (v1 envelope + initialWork) succeeds on the fresh root (path=fresh-root; the create preflight + admitInitialWork pass)',
      createT1.status === 200 && t1Data !== null && t1Data?.path === 'fresh-root',
      `status=${createT1.status} data=${JSON.stringify(t1Data ?? createT1.body).slice(0, 300)}`)
    finishCriterion('C1')
    if (t1Data === null) throw new Error('C1 failed — aborting before the C2 assertions')

    // ── C2: baseline — the initial work DIRECTLY called MCP ─────────────────
    const t1Turn = await probeTurn({ label: 'T1 leader first turn', host: host1, sessionId: ROOT_T1, marker: MK1, mock, doneText: 'F15_T1_DONE' })
    const baselineSlot = slotOf(mcpServersOf(t1Turn.stateBody, ROOT_T1), SERVER)
    const capEventsC2 = await capabilityEvents(host1, ROOT_T1)
    check('C2', 'baseline: the initial work turn called mcp__mcp-f15__ping (pong:alpha); slot mounted attempts=1; the model-facing surface carries the tool (V1 authority); ZERO capability-runtime-event facts',
      t1Turn.results.some((r) => r.includes('pong:alpha'))
      && t1Turn.schema?.includes(TOOL_PING) === true
      && baselineSlot?.mounted === true && baselineSlot?.materialization === 'mounted' && baselineSlot?.attempts === 1
      && capEventsC2.length === 0,
      `results=${JSON.stringify(t1Turn.results).slice(0, 200)} schema=${JSON.stringify(t1Turn.schema)} slot=${JSON.stringify(baselineSlot)} capEvents=${capEventsC2.length}`)
    writeFileSync(join(RUN_DIR, 'c2-baseline.json'), JSON.stringify({
      schema: t1Turn.schema, toolResults: t1Turn.results, slot: baselineSlot, capEvents: capEventsC2,
    }, null, 2))
    finishCriterion('C2')

    // ── R1: the transient blip (kill → 1.3 s → restore) ─────────────────────
    {
      const tKill1 = new Date().toISOString()
      const offKill1 = logLength(host1)
      await closeMiniServer(mini)
      mini = null
      log('R1: mini-MCP KILLED (transient blip begins)')
      const plannedOutageMs = 1300
      await sleep(plannedOutageMs)
      const tRestore1 = new Date().toISOString()
      const offRestore1 = logLength(host1)
      const realOutageMs = Date.parse(tRestore1) - Date.parse(tKill1)
      mini = await startMiniMcpWithRetry([MCP_PORT])
      log(`R1: mini-MCP RESTORED (planned outage ${plannedOutageMs} ms; real wall-clock ${realOutageMs} ms)`)
      const windowLines = logLinesBetween(host1, offKill1, offRestore1)
      const mcpClientLinesInWindow = windowLines.filter((l) => l.includes('mcp-client('))

      const r1Turn = await probeTurn({ label: 'R1 post-restore turn', host: host1, sessionId: ROOT_T1, marker: MK_R1, mock, doneText: 'F15_R1_DONE' })
      const r1Slot = slotOf(mcpServersOf(r1Turn.stateBody, ROOT_T1), SERVER)
      const capEventsR1 = await capabilityEvents(host1, ROOT_T1)
      const lostEventsR1 = capEventsR1.filter((e) => e.payload?.event === 'capability-lost')
      const retireObsR1 = stateObservationsOf(r1Turn.stateBody).filter((o) => o.includes('mcp fiber retired'))

      // The next new-work boundary (the request-boundary machinery + the
      // requirement gate on a REAL admission): must be ADMITTED.
      const r1Boundary = await gatedDelegateCall(host1, 'r1', {
        label: 'w-r1',
        requestToken: `rt-f15-r1-${NONCE}`,
        prompt: `${WK_R1} work unit r1 (nonce ${NONCE})`,
      })
      const r1Admitted = admittedValue(r1Boundary.tool)
      const r1WorkerDone = await waitForTurnDone(mock, WK_R1, `WORKER_DONE ${WK_R1}`, 60_000)

      check('R1', 'transient blip: zero mcp-client log lines in the outage window (supervisor silent — the streamable-http signature); post-restore tool call succeeds (pong:beta) through the SAME fiber; surface visible throughout; fiber NOT recycled (attempts=1); zero capability-lost; no retirement observation; the boundary delegate ADMITTED',
        mcpClientLinesInWindow.length === 0
        && r1Turn.results.some((r) => r.includes('pong:beta'))
        && r1Turn.schema?.includes(TOOL_PING) === true
        && r1Slot?.mounted === true && r1Slot?.attempts === 1
        && lostEventsR1.length === 0
        && retireObsR1.length === 0
        && r1Admitted !== null
        && r1WorkerDone !== null,
        `windowLines=${windowLines.length} mcpClientInWindow=${JSON.stringify(mcpClientLinesInWindow).slice(0, 200)} results=${JSON.stringify(r1Turn.results).slice(0, 160)} slot=${JSON.stringify(r1Slot)} lost=${lostEventsR1.length} retireObs=${retireObsR1.length} admitted=${r1Admitted !== null} workerDone=${r1WorkerDone !== null}`)
      EVID.legs.R1 = {
        killAt: tKill1, restoreAt: tRestore1, plannedOutageMs, realOutageMs,
        windowLines, mcpClientLinesInWindow,
        postRestore: { pong: r1Turn.results.some((r) => r.includes('pong:beta')), schema: r1Turn.schema },
        slotAfter: r1Slot,
        boundary: { admitted: r1Admitted !== null, value: r1Admitted ?? r1Boundary.tool.body },
      }
      writeFileSync(join(RUN_DIR, 'r1-transient-blip.json'), JSON.stringify(EVID.legs.R1, null, 2))
      finishCriterion('R1')
    }

    // ── R2: the permanent loss — FIRST-CLASS FINDING (verbatim) ─────────────
    {
      const tKill2 = new Date().toISOString()
      const offKill2 = logLength(host1)
      await closeMiniServer(mini)
      mini = null
      log('R2: mini-MCP KILLED (permanent loss)')
      const plannedWaitMs = 4500 // a margin over the 3.5 s upstream budget — NEVER equated with the SLO (plan §8.2)
      await sleep(plannedWaitMs)
      const realWaitMs = Date.parse(new Date().toISOString()) - Date.parse(tKill2)

      // (a) the surface check: a no-tool leader turn — the request's tools[]
      //     is the V1 authority for the public tool surface.
      const r2sTurn = await probeTurn({ label: 'R2 surface check', host: host1, sessionId: ROOT_T1, marker: MK_R2S, mock, doneText: 'F15_R2S_DONE' })
      const ghostSurface = r2sTurn.schema?.includes(TOOL_PING) === true
      const r2sSlot = slotOf(mcpServersOf(r2sTurn.stateBody, ROOT_T1), SERVER)

      // (b) the boundary: the gate must be ADMITTED (readiness reachable —
      //     the stale positive persists; the finding).
      const r2Boundary = await gatedDelegateCall(host1, 'r2', {
        label: 'w-r2',
        requestToken: `rt-f15-r2-${NONCE}`,
        prompt: `${WK_R2} work unit r2 (nonce ${NONCE})`,
      })
      const r2Admitted = admittedValue(r2Boundary.tool)
      const r2WorkerDone = await waitForTurnDone(mock, WK_R2, `WORKER_DONE ${WK_R2}`, 60_000)

      // (c) the ghost tool call: the model calls the still-registered tool;
      //     the SDK fetch fails; the model sees the tool error (turn completes).
      const ghostStartAt = new Date().toISOString()
      const r2pTurn = await probeTurn({ label: 'R2 ghost call', host: host1, sessionId: ROOT_T1, marker: MK_R2P, mock, doneText: 'F15_R2P_DONE' })
      const ghostEndAt = new Date().toISOString()
      const ghostCallMs = Date.parse(ghostEndAt) - Date.parse(ghostStartAt)
      // Only the tool results reported AFTER the R2P work message — the
      // history still carries the earlier C2/R1 results (the stale
      // pong:alpha / "Error: fetch failed"), which are NOT the ghost call's.
      const ghostMsgs = r2pTurn.done?.body?.messages ?? []
      const ghostIdx = lastMarkerUserIdx(r2pTurn.done, MK_R2P)
      const ghostTurnResults = ghostIdx === -1 ? [] : toolResultsAfter(ghostMsgs, ghostIdx)
      const ghostPong = ghostTurnResults.some((r) => r.includes('pong:gamma'))
      const ghostError = ghostTurnResults[0] ?? null

      const offEnd2 = logLength(host1)
      const linesSinceKill2 = logLinesBetween(host1, offKill2, offEnd2)
      const mcpClientLinesSinceKill2 = linesSinceKill2.filter((l) => l.includes('mcp-client('))
      const capEventsR2 = await capabilityEvents(host1, ROOT_T1)
      const lostEventsR2 = capEventsR2.filter((e) => e.payload?.event === 'capability-lost')
      const r2pSlot = slotOf(mcpServersOf(r2pTurn.stateBody, ROOT_T1), SERVER)
      const retireObsR2 = stateObservationsOf(r2pTurn.stateBody).filter((o) => o.includes('mcp fiber retired'))

      const finding = {
        headline: 'The pinned 0.1.7-rc.1 mcp-client supervisor does NOT detect a live streamable-http server death (onclose-only entry; the streamable-http transport fires onclose only on explicit close()). The registered tools remain on the public surface forever (ghost tools); readiness stays reachable; the F15 gate stays open; only the model sees the failure — via the tool error of the ghost call.',
        evidence: {
          supervisorLogLinesSinceKill: mcpClientLinesSinceKill2,
          allHostLogLinesSinceKill: linesSinceKill2,
          ghostSurfaceRetained: ghostSurface,
          boundaryAdmittedDespiteLoss: r2Admitted !== null,
          ghostToolCall: { startAt: ghostStartAt, endAt: ghostEndAt, wallClockMs: ghostCallMs, pongSeen: ghostPong, modelVisibleError: ghostError },
          slotAfter: r2pSlot,
          capabilityLostEvents: lostEventsR2,
          retirementObservations: retireObsR2,
        },
      }
      check('R2', 'PERMANENT LOSS FINDING (verbatim): supervisor silent (zero mcp-client lines after the kill); the ghost tool is retained on the public surface; the boundary is ADMITTED (readiness reachable — stale positive); the ghost call fails model-visibly (no pong; the exact error + wall-clock latency recorded); slot still mounted attempts=1; zero capability-lost; no retirement',
        mcpClientLinesSinceKill2.length === 0
        && ghostSurface === true
        && r2Admitted !== null
        && r2WorkerDone !== null
        && ghostPong === false
        && ghostError !== null
        && r2pSlot?.mounted === true && r2pSlot?.attempts === 1
        && lostEventsR2.length === 0
        && retireObsR2.length === 0,
        `ghostSurface=${ghostSurface} admitted=${r2Admitted !== null} ghostError=${JSON.stringify(ghostError).slice(0, 200)} latencyMs=${ghostCallMs} slot=${JSON.stringify(r2pSlot)} lost=${lostEventsR2.length}`)
      EVID.legs.R2 = { killAt: tKill2, plannedWaitMs, realWaitMs, finding }
      writeFileSync(join(RUN_DIR, 'r2-permanent-loss-finding.json'), JSON.stringify(EVID.legs.R2, null, 2))
      log(`R2 FINDING recorded: ghostSurface=${ghostSurface} admitted=${r2Admitted !== null} ghostError=${JSON.stringify(ghostError)?.slice(0, 200)}`)
      finishCriterion('R2')
    }

    // ── R4: the policy deny is NOT a loss ────────────────────────────────────
    {
      const tMutate = new Date().toISOString()
      // The T1 team's OWN governance (team-remote override.set — the frozen
      // production mutation authority, scoped by teamSessionId). The row
      // harness endpoint /__p6t6/governance/mutate writes the ROW's (anchor
      // team's) slot regardless of `as` — the anchor has no mcp capability,
      // so a deny there can never reach the T1 fiber.
      const mutate = await remoteCallReady(host1, 'override.set', {
        teamSessionId: ROOT_T1,
        capability: 'mcp',
        value: { kind: 'deny' },
        actor: { kind: 'human' },
        scope: 'team',
      }, 'r4-deny')
      writeFileSync(join(RUN_DIR, 'r4-governance-mutate.json'), JSON.stringify(mutate.body ?? mutate, null, 2))
      const mv = (() => { try { return remoteValue(mutate, 'override.set') } catch { return null } })()
      const r2CapCount = (await capabilityEvents(host1, ROOT_T1)).length

      // The next boundary: reconcile runs the deny-first disposal (the
      // intentional-removal sequence) → the delegate must be ADMITTED (the
      // probe is unknown — no fiber, the slot is not failed — and the row
      // seed feeds available).
      const r4Boundary = await gatedDelegateCall(host1, 'r4', {
        label: 'w-r4',
        requestToken: `rt-f15-r4-${NONCE}`,
        prompt: `${WK_R4} work unit r4 (nonce ${NONCE})`,
      })
      const r4Admitted = admittedValue(r4Boundary.tool)
      const r4WorkerDone = await waitForTurnDone(mock, WK_R4, `WORKER_DONE ${WK_R4}`, 60_000)

      // The surface witness: the plugin WITHDREW the tools (no tool call this
      // turn — the request's tools[] is the authority).
      const r4Turn = await probeTurn({ label: 'R4 surface check', host: host1, sessionId: ROOT_T1, marker: MK_R4, mock, doneText: 'F15_R4_DONE' })
      const surfaceWithdrawn = r4Turn.schema !== null && r4Turn.schema.includes(TOOL_PING) === false
      const r4Slot = slotOf(mcpServersOf(r4Turn.stateBody, ROOT_T1), SERVER)
      const capEventsR4 = await capabilityEvents(host1, ROOT_T1)
      // The ledger is append-only and sorted by sequence: everything beyond
      // the R2 watermark count is NEW since R2.
      const capSinceR2 = capEventsR4.slice(r2CapCount)
      const lostSinceR2 = capSinceR2.filter((e) => e.payload?.event === 'capability-lost')
      const withdrawnReasons = capSinceR2.filter((e) => JSON.stringify(e.payload ?? {}).includes('MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN'))
      const retireObsR4 = stateObservationsOf(r4Turn.stateBody).filter((o) => o.includes('mcp fiber retired'))

      // World hygiene: reset the override BEFORE the host1 teardown — the
      // durable deny must not survive into boot 2, where R3' needs the
      // template-only target set to produce the mount-time failure (a
      // denied target set mounts nothing, so no failed slot would exist).
      const reset = await remoteCallReady(host1, 'override.reset', {
        teamSessionId: ROOT_T1,
        capability: 'mcp',
        actor: { kind: 'human' },
        scope: 'team',
      }, 'r4-reset')
      writeFileSync(join(RUN_DIR, 'r4-override-reset.json'), JSON.stringify(reset.body ?? reset, null, 2))
      const resetRemoved = (() => { try { return remoteValue(reset, 'override.reset')?.removed === true } catch { return false } })()

      check('R4', 'policy deny is not loss: the override.set is admitted (human-override record, team scope on the T1 root); the boundary disposes the fiber and the surface is WITHDRAWN (no mcp tool on the model-facing schema); the delegate is STILL ADMITTED (unknown probe → row seed feeds available); ZERO new capability facts since R2 (no capability-lost, no mount-*); no MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN anywhere; no retirement observation; slot mounted=false allowed=false (materialization stays mounted — a deny is not a failure); the override is then RESET (world hygiene for the boot-2 R3\' leg)',
        mutate.status === 200 && mv !== null
        && mv?.kind === 'human-override' && mv?.rootSessionId === ROOT_T1 && mv?.scope === 'team' && mv?.values?.mcp?.kind === 'deny'
        && r4Admitted !== null
        && r4WorkerDone !== null
        && surfaceWithdrawn === true
        && capSinceR2.length === 0
        && lostSinceR2.length === 0
        && withdrawnReasons.length === 0
        && retireObsR4.length === 0
        && r4Slot?.mounted === false && r4Slot?.allowed === false && r4Slot?.materialization === 'mounted'
        && resetRemoved,
        `mutate=${JSON.stringify(mv ?? mutate.body).slice(0, 200)} admitted=${r4Admitted !== null} surfaceWithdrawn=${surfaceWithdrawn} newCapSinceR2=${capSinceR2.length} slot=${JSON.stringify(r4Slot)} reset=${resetRemoved}`)
      EVID.legs.R4 = { mutateAt: tMutate, mutateValue: mv, boundary: { admitted: r4Admitted !== null }, surface: r4Turn.schema, slot: r4Slot, newCapSinceR2: capSinceR2.length, controlRequestsSeen: r4Boundary.pendingSeen, reset: { status: reset.status, removed: resetRemoved } }
      writeFileSync(join(RUN_DIR, 'r4-policy-deny.json'), JSON.stringify(EVID.legs.R4, null, 2))
      finishCriterion('R4')
    }

    await stopHost(host1)
    host1 = null

    // ── BOOT 2 (resume; the mini-MCP stays DOWN) ────────────────────────────
    host2 = await bootHost({ label: 'HOST2-RESUME', port: HOST2_PORT, boot: 2, phase: 'resume' })
    const st2 = await p6t6StateReady(host2.port, { rootSessionId: ROOT, phase: 'resume' })
    const tBoot2Ready = new Date().toISOString()
    log(`HOST2: state ready after restart (phase=resume, anchor teamSession=${st2.body?.teamSession?.blueprintId})`)

    // ── R5: the restart path (BEFORE any boundary — passive reads only) ─────
    {
      const serversR5 = mcpServersOf(st2.body, ROOT_T1)
      const slotR5 = slotOf(serversR5, SERVER)
      const capEventsR5 = await capabilityEvents(host2, ROOT_T1)
      const r5Obs = stateObservationsOf(st2.body)
      const noFabricatedFailedState = slotR5 === null || slotR5.materialization !== 'failed'
      const noRetireObs = !r5Obs.some((o) => o.includes('mcp fiber retired'))
      check('R5', 'restart (before the first boundary): no fabricated mcp slot (the witness + slots are ephemeral — never persisted; no `failed` fabrication), zero new capability facts since the R4 watermark, no retirement observation in the fresh boot',
        noFabricatedFailedState && capEventsR5.length === 0 && noRetireObs,
        `servers=${JSON.stringify(serversR5 ?? null).slice(0, 200)} slot=${JSON.stringify(slotR5)} capEvents=${capEventsR5.length} obs=${JSON.stringify(r5Obs).slice(0, 160)}`)
      EVID.legs.R5 = { boot2ReadyAt: tBoot2Ready, servers: serversR5, slot: slotR5, capEvents: capEventsR5.length, observations: r5Obs }
      writeFileSync(join(RUN_DIR, 'r5-restart-ephemeral.json'), JSON.stringify(EVID.legs.R5, null, 2))
      finishCriterion('R5')
    }

    // ── R3': mount-time failure → cooldown → fresh remount ──────────────────
    {
      // B1: the first boundary with the server down.
      const tB1 = new Date().toISOString()
      const offB1 = logLength(host2)
      const b1 = await gatedDelegateCall(host2, 'r3-b1', {
        label: 'w-r3a',
        requestToken: `rt-f15-r3a-${NONCE}`,
        prompt: `${WK_R3} work unit r3a (nonce ${NONCE})`,
      })
      const offB1End = logLength(host2)
      const b1Lines = logLinesBetween(host2, offB1, offB1End)
      const attemptFailedLine = b1Lines.find((l) => l.includes('connection attempt failed')) ?? null
      const retryLine = b1Lines.find((l) => l.includes('connection failed; retrying')) ?? null
      const giveUpLine = b1Lines.find((l) => l.includes('giving up after')) ?? null

      // The supervisor's WARN lines (connection attempt failed / retrying)
      // are emitted via the plugin ctx.logger, which on the real host has NO
      // observable sink (Cordis context logger -> in-memory startup exporter
      // only; surfaces only in a StartupError boot-failure dump; the instance
      // stdout/stderr carries raw console.log lines only — verified across
      // runs: zero logger lines even when adapter errors occurred). So the
      // single-attempt proof is carried by the OBSERVABLE channels: slot
      // failed with attempts=1 (attempts 2-4 never happened -> no retry loop
      // ran, no "giving up"), exactly one mount-failed telemetry, and the
      // gate verdict. The log-window read is kept as evidence (and as the
      // no-giving-up assertion on the observable channel).
      const capEventsB1 = await capabilityEvents(host2, ROOT_T1)
      const mountFailedB1 = capEventsB1.filter((e) => e.payload?.event === 'mount-failed')
      const stB1 = await p6t6State(host2.port)
      const slotB1 = slotOf(mcpServersOf(stB1.body, ROOT_T1), SERVER)
      const b1Rejected = rejectedValue(b1.tool)

      check('R3', 'B1 (mount-time failure, failOnStartupError production path): SINGLE mount attempt — slot failed with attempts=1 (attempts 2-4 never ran; no "giving up" line on any observable channel: the plugin rollback disposes the supervisor); exactly ONE mount-failed telemetry; the gate BLOCKS (TEAM_RUNTIME_COMPATIBILITY_BLOCKED / requiredScopeDown / source requirement-gate / blockedScopes ["team"]); the recovery control request is opened (correlation recovery:*) and resolved deny. NOTE: the supervisor WARN lines (attempt failed / retrying) are ctx.logger-only with no real-host sink (finding F15-LOGSINK-1) — recorded in evidence, not in the pass criteria',
        giveUpLine === null
        && slotB1?.mounted === false && slotB1?.materialization === 'failed' && slotB1?.attempts === 1
        && mountFailedB1.length === 1
        && b1Rejected !== null && b1Rejected?.code === GATE_BLOCKED_CODE
        && b1Rejected?.details?.gateReason === 'requiredScopeDown'
        && b1Rejected?.details?.source === 'requirement-gate'
        && b1Rejected?.details?.status === 'BLOCKED_FATAL'
        && JSON.stringify(b1Rejected?.details?.blockedScopes) === JSON.stringify(['team'])
        && b1.pendingSeen.length >= 1
        && b1.decisions.length >= 1,
        `logWindow=${b1Lines.length} lines attemptFailed=${JSON.stringify(attemptFailedLine)} retry=${JSON.stringify(retryLine)} slot=${JSON.stringify(slotB1)} mountFailed=${mountFailedB1.length} blockCode=${b1Rejected?.code} details=${JSON.stringify(b1Rejected?.details ?? null).slice(0, 260)} ctrlReq=${b1.pendingSeen.length} decisions=${b1.decisions.length}`)

      // Restore the server, then B2 immediately (inside the 30 s cooldown).
      const tRestore3 = new Date().toISOString()
      mini = await startMiniMcpWithRetry([MCP_PORT])
      log(`R3': mini-MCP RESTORED at ${tRestore3}`)

      const tB2 = new Date().toISOString()
      const b2 = await gatedDelegateCall(host2, 'r3-b2', {
        label: 'w-r3b',
        requestToken: `rt-f15-r3b-${NONCE}`,
        prompt: `${WK_R3} work unit r3b (nonce ${NONCE})`,
      })
      const capEventsB2 = await capabilityEvents(host2, ROOT_T1)
      const mountFailedB2New = capEventsB2.filter((e) => e.payload?.event === 'mount-failed' && e.sequence > (mountFailedB1[0]?.sequence ?? 0))
      const stB2 = await p6t6State(host2.port)
      const slotB2 = slotOf(mcpServersOf(stB2.body, ROOT_T1), SERVER)
      const b2Rejected = rejectedValue(b2.tool)

      check('R3', 'B2 (cooldown, server restored but inside the 30 s window): the failed slot is SKIPPED — NO new mount attempt (no new mount-failed telemetry; attempts still 1 — no hot retry loop); the gate is STILL BLOCKED (the recovery request is opened and resolved deny)',
        mountFailedB2New.length === 0
        && slotB2?.materialization === 'failed' && slotB2?.attempts === 1
        && b2Rejected !== null && b2Rejected?.code === GATE_BLOCKED_CODE && b2Rejected?.details?.gateReason === 'requiredScopeDown',
        `newMountFailed=${mountFailedB2New.length} slot=${JSON.stringify(slotB2)} block=${b2Rejected?.code} ctrlReq=${b2.pendingSeen.length}`)

      // Wait past the 30 s plugin retry cooldown (recorded wall-clock; the
      // cooldown is a plugin-level constant — MCP_RETRY_COOLDOWN_MS 30_000).
      const cooldownFloorMs = Date.parse(tB1) + 31_500
      const waitMs = cooldownFloorMs - Date.now()
      if (waitMs > 0) {
        log(`R3': waiting ${Math.round(waitMs / 1000)} s for the 30 s plugin cooldown to elapse (real wall-clock)`)
        await sleep(waitMs)
      }
      // B3: fire the boundary after the cooldown. ADAPTIVE RETRY (kit-side,
      // up to 3 firings, 3 s apart): the slot's lastAttemptAt is stamped
      // slightly AFTER tB1, so a firing that lands inside the remaining
      // cooldown is SKIPPED by the plugin (no attempt, no telemetry — the
      // B2-style behavior) and the next firing performs the fresh mount.
      // The final-state assertions below are identical either way.
      let b3 = null
      const b3Fires = []
      for (let firing = 0; firing < 3; firing += 1) {
        const fireAt = new Date().toISOString()
        b3 = await gatedDelegateCall(host2, `r3-b3-${firing + 1}`, {
          label: `w-r3c${firing + 1}`,
          requestToken: `rt-f15-r3c${firing + 1}-${NONCE}`,
          prompt: `${WK_R3} work unit r3c (nonce ${NONCE})`,
        })
        const admitted = admittedValue(b3.tool)
        b3Fires.push({ fireAt, admitted: admitted !== null, block: admitted === null ? rejectedValue(b3.tool) : null })
        if (admitted !== null) break
        log(`R3': B3 firing ${firing + 1} blocked (inside the cooldown) — re-firing in 3 s`)
        await sleep(3000)
      }
      const tB3 = b3Fires[0].fireAt
      const capEventsB3 = await capabilityEvents(host2, ROOT_T1)
      const mountRestored = capEventsB3.filter((e) => e.payload?.event === 'mount-restored')
      const stB3 = await p6t6State(host2.port)
      const slotB3 = slotOf(mcpServersOf(stB3.body, ROOT_T1), SERVER)
      const b3Admitted = admittedValue(b3.tool)
      const r3WorkerDone = await waitForTurnDone(mock, WK_R3, `WORKER_DONE ${WK_R3}`, 60_000)
      const restoreObs = stateObservationsOf(stB3.body).filter((o) => o.includes('mcp mount restored'))

      // The end-to-end proof: a final leader ping turn.
      const r3fTurn = await probeTurn({ label: 'R3 final ping', host: host2, sessionId: ROOT_T1, marker: MK_R3F, mock, doneText: 'F15_R3F_DONE' })

      check('R3', 'B3 (after the cooldown): the fresh remount succeeds (attempts=2); mount-restored telemetry EXACTLY ONCE (+ the mount restored observation); the gate is OPEN — the delegate is ADMITTED and the worker settles; the final leader ping turn proves pong:delta end-to-end',
        slotB3?.mounted === true && slotB3?.materialization === 'mounted' && slotB3?.attempts === 2
        && mountRestored.length === 1
        && restoreObs.length === 1
        && b3Admitted !== null
        && r3WorkerDone !== null
        && r3fTurn.results.some((r) => r.includes('pong:delta')),
        `slot=${JSON.stringify(slotB3)} mountRestored=${mountRestored.length} obs=${JSON.stringify(restoreObs).slice(0, 200)} admitted=${b3Admitted !== null} pong=${r3fTurn.results.some((r) => r.includes('pong:delta'))}`)
      EVID.legs.R3 = {
        b1: { fireAt: tB1, lines: b1Lines, attemptFailedLine, retryLine, giveUpLine, slot: slotB1, mountFailedEvents: mountFailedB1, block: b1Rejected, controlRequests: b1.pendingSeen, decisions: b1.decisions },
        restoreAt: tRestore3,
        b2: { fireAt: tB2, slot: slotB2, newMountFailed: mountFailedB2New.length, block: b2Rejected, controlRequests: b2.pendingSeen },
        b3: { fireAt: tB3, cooldownWallClockMs: Date.parse(tB3) - Date.parse(tB1), fires: b3Fires, slot: slotB3, mountRestoredEvents: mountRestored, restoreObservations: restoreObs, admitted: b3Admitted !== null, pongDelta: r3fTurn.results.some((r) => r.includes('pong:delta')) },
      }
      writeFileSync(join(RUN_DIR, 'r3-mount-failure-recovery.json'), JSON.stringify(EVID.legs.R3, null, 2))
      finishCriterion('R3')
    }

    await stopHost(host2)
    host2 = null
  } catch (error) {
    legsThrew = true
    throw error
  } finally {
    // ── H1: teardown + cleanliness ──────────────────────────────────────────
    await sweepLiveHosts()
    if (mini !== null) { await closeMiniServer(mini); mini = null }
    if (mockRef.current !== null) { await mockRef.current.close(); mockRef.current = null }
    const portChecks = {}
    for (const [label, p] of [['host1', HOST1_PORT], ['host2', HOST2_PORT], ['mcp', MCP_PORT], ['mock', MOCK_PORT]]) {
      await waitForPortFree(p, 10_000)
      portChecks[label] = { port: p, free: (await portInUse(p)) === false }
    }
    EVID.stablePost = {}
    for (const u of STABLE_URLS) EVID.stablePost[u] = await probeStableInstance(u)
    writeFileSync(join(RUN_DIR, 'stable-post.json'), JSON.stringify(EVID.stablePost, null, 2))
    const stableUnchanged = STABLE_URLS.every((u) => JSON.stringify(EVID.stablePre[u]) === JSON.stringify(EVID.stablePost[u]))

    const gitPostDir = join(RUN_DIR, 'git-post')
    mkdirSync(gitPostDir, { recursive: true })
    const testusePost = await captureGitState(HOST_TREE, gitPostDir)
    EVID.testUsePost = testusePost
    writeFileSync(join(RUN_DIR, 'testuse-post.json'), JSON.stringify({ ...testusePost, baselineSha: HOST_BASELINE_SHA, at: new Date().toISOString() }, null, 2))
    const testuseClean = testusePost.statusEmpty === true && testusePost.diffEmpty === true && testusePost.head === HOST_BASELINE_SHA
    const worktreePost = await captureGitState(WORKTREE, gitPostDir)
    EVID.worktreeGitPost = worktreePost
    writeFileSync(join(RUN_DIR, 'worktree-git-post.json'), JSON.stringify(worktreePost, null, 2))

    const scrubbed = scrubDir(RUN_DIR)

    check('H1', 'teardown: all kit ports torn down (3182/3183/3491/3497 free); the stable instances (:3080/:3180) unchanged; the test-use checkout pristine @ baseline (post); tokens scrubbed from the evidence dir',
      Object.values(portChecks).every((c) => c.free === true) && stableUnchanged && testuseClean && scrubbed >= 0,
      `ports=${JSON.stringify(portChecks)} stableUnchanged=${stableUnchanged} testuseClean=${testuseClean} scrubbedFiles=${scrubbed}`)
    finishCriterion('H1')

    if (legsThrew) {
      // The legs failed: the main().catch handler owns the fatal summary +
      // exit(1) — a "VERDICT" summary here would mask the real failure.
      log('legs aborted — teardown complete; the fatal summary is owned by the catch handler')
      return
    }

    // ── summary ─────────────────────────────────────────────────────────────
    const failed = CRITERIA.filter((c) => results[c.id] !== undefined && results[c.id].done === true && !results[c.id].checks.every((k) => k.ok)).map((c) => c.id)
    const passed = CRITERIA.filter((c) => results[c.id] !== undefined && results[c.id].done === true && results[c.id].checks.every((k) => k.ok)).map((c) => c.id)
    const summary = {
      task: 'F15 MCP live-loss zero-core upgrade — real-host smoke (ruling: Option A)',
      runStamp: RUN_STAMP,
      verdict: failed.length === 0 ? 'PASS' : 'FAIL',
      finding: 'The pinned 0.1.7-rc.1 mcp-client supervisor does not detect live streamable-http server death (ghost tools; see r2-permanent-loss-finding.json). R1 redefined witness / R2 first-class finding / R3 corrected mount-time path (failOnStartupError single attempt + 30 s plugin cooldown + fresh remount) / R4 + R5 verbatim per plan §10.',
      findings: [
        {
          id: 'F15-LOGSINK-1',
          title: 'Real-host world has NO observable sink for plugin ctx.logger output (supervisor WARN lines uncapturable in-world)',
          detail: 'The mcp-client supervisor emits its WARN lines (connection attempt failed / connection failed; retrying in …) via the Cordis plugin-context logger. On the host generation these observations were made — 0.1.7-rc.1 app-boot, observed at 2026-10-02, UNVERIFIED AT PIN (tests/paths.mjs now names 0.2.0-rc.2; re-verification belongs to the paused host-chain gate) — the only registered logger exporter is the STARTUP exporter (in-memory startupLogs), which surfaces ONLY in a StartupError boot-failure dump (cause.startup.messages); a running host emits no logger lines to the instance stdout/stderr (verified across runs: the instance log carries raw console.log lines only — 3 lines total in a world where an adapter error provably occurred) and no file sink exists (no DSH_HOME logs dir in app-boot). CONSEQUENCE: R3\' B1 verbatim-log assertions are adapted to the observable channels (slot failed/attempts=1 — proof the single-attempt path ran and no retry loop followed; exactly one mount-failed telemetry; the gate verdict; the no-giving-up assertion on the observable log window). The log window is still captured in evidence (r3-mount-time-failure.json) with the expected lines recorded as null.',
        },
        {
          id: 'F15-WIRE-1',
          title: 'Mock-model wire contract observed at 0.1.7-rc.1 is the DeepSeek Messages API (Anthropic-style blocks), not OpenAI chat/completions — UNVERIFIED AT PIN',
          detail: 'The dsh-llm-deepseek adapter on the generation observed posts to /v1/messages with messages carrying BLOCK content: (0.2.0-rc.2 keeps the same /v1/messages route but delivers tool results as content parts nested one level deeper inside role:user - see tests/kits/rc2-real-host-smoke/fixtures/captured-0.2.0-rc.2/, so any reader written for the older envelope must be re-checked before this kit runs again): text blocks, assistant tool_use blocks, and tool_result blocks delivered INSIDE role:user messages (the internal role:tool is mapped to role:user + tool_result; consecutive same-role messages are merged); tools are Anthropic-style {name,description,input_schema}; responses are Anthropic SSE (message_start/content_block_*/message_delta stop_reason/message_stop). There is NO role:tool and NO OpenAI tool_calls on the wire. The kit\'s transcript readers + decide oracle are block-format aware (the mock harness packages/tools/harness/mock-deepseek.mjs already serves this route; its header docstring describing the OpenAI contract is legacy text observed at the 0.1.5-rc.2 era, UNVERIFIED AT PIN, and accurate only for the /chat/completions fallback route). Note: marker-driven oracles written for the older wire (counting role:tool messages) loop forever on this baseline — the tool results never satisfy the counter (infinite tool-call loop; unbounded mock-recorder growth -> process OOM).',
        },
        {
          id: 'F15-W3AE-1',
          title: 'Post-W3-A–E base: the row environmentFacts seed is seed-ONLY; the S6 fact feed is scoped to the row-bound (anchor) blueprint',
          detail: 'W3-A–E (6d5269b9, in base e696823e) switched the S6 environmentFacts thunk (root.ts) from the legacy static row feed (row environmentFacts verbatim) to the live requirement-facts provider resolved over the ROW-BOUND (anchor) blueprint\'s team requirements. A bare v1 anchor (the pre-W3-A–E mgis/PR-E kit pattern) therefore yields an EMPTY team-scope feed: intent.probe and the invariant-50 work-admission gate fail closed for ANY complete requirement (engine: fact absent -> available:false -> "structural FATAL, not downgradeable"), while the row environmentFacts seed — now a seed-ONLY fallback for unknown live verdicts of DECLARED requirements — is unreachable. Verified forensics (fresh world, this kit\'s world shape): WITHOUT the anchor requirement — C0 intent.probe BLOCKED_FATAL (environmentFingerprint fp-v1:3531d25c618b5eda) and team.create ok:false TEAM_RUNTIME_COMPATIBILITY_BLOCKED (the create preflight itself PASSES — the team, the leader row, and the mcp-f15 mount are durable; the invariant-50 gate then rejects the initialWork admission); WITH the anchor requirement (v1 flat list: domain mcp, name mcp-f15) — C0 OPEN (fp-v1:0894e21a99f451bc, req-f15-mcp PASS "all 1 required subject(s) available") and team.create ok:true path=fresh-root. The kit declares the row\'s mcp supply requirement on the anchor to conform to the current scope model; rows with required MCPs on this base must do the same (candidate product regression for parent follow-up: the pre-create probe / admission gate feed could not see a created team\'s own requirements).',
        },
      ],
      worktree: WORKTREE,
      testUse: { path: HOST_TREE, baselineSha: HOST_BASELINE_SHA, pre: testusePre, post: testusePost, clean: testuseClean },
      ports: { host1: HOST1_PORT, host2: HOST2_PORT, mcp: MCP_PORT, mock: MOCK_PORT, stable: STABLE_URLS },
      home: { path: HOME, kept: FLAG_KEEP, lockFile: LOCK_FILE },
      server: { name: SERVER, port: MCP_PORT, tool: TOOL_PING },
      roots: { boot: ROOT, team1: ROOT_T1 },
      modelPath: EVID.modelPath,
      stable: { pre: EVID.stablePre, post: EVID.stablePost, unchanged: stableUnchanged },
      legs: EVID.legs,
      criteria: Object.values(results),
      passed,
      failed,
      pass: failed.length === 0,
      exitCode: failed.length === 0 ? 0 : 2,
    }
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
    writeFileSync(join(RUN_DIR, 'criterion-list.json'), JSON.stringify(Object.values(results), null, 2))
    // Second scrub pass AFTER the summary is written (the summary may itself
    // carry a token in a leg value) — idempotent over the already-scrubbed
    // evidence; the committed evidence dir must be token-free.
    const scrubbedSecond = scrubDir(RUN_DIR)
    log(`summary -> ${join(RUN_DIR, 'summary.json')} (second scrub pass changed ${scrubbedSecond} file(s))`)
    log(`VERDICT ${summary.pass ? 'PASS' : 'FAIL'} — passed [${passed.join(', ')}] failed [${failed.join(', ')}] (scrubbedFiles=${scrubbed})`)

    if (!FLAG_KEEP) {
      try { rmSync(HOME, { recursive: true, force: true }); rmSync(LOCK_FILE, { force: true }) } catch { /* best effort */ }
      log(`home removed (ephemeral world; --keep to retain): ${HOME}`)
    }
    process.exit(summary.exitCode)
  }
}

process.on('SIGTERM', () => {
  log('SIGTERM received — best-effort teardown')
  sweepLiveHosts().then(() => process.exit(130)).catch(() => process.exit(130))
})
process.on('SIGINT', () => {
  log('SIGINT received — best-effort teardown')
  sweepLiveHosts().then(() => process.exit(130)).catch(() => process.exit(130))
})

// Script entry guard: run main() only when this file is the executed entry
// point (an import — e.g. a static check — must NOT boot a host).
const IS_MAIN = (() => {
  const entry = process.argv[1]
  if (entry === undefined) return false
  try { return resolve(entry) === fileURLToPath(import.meta.url) } catch { return false }
})()

if (IS_MAIN) {
  main().catch((error) => {
    const msg = String(error?.stack ?? error)
    log(`FATAL (kit-level, run aborted): ${msg}`)
    try {
      mkdirSync(RUN_DIR, { recursive: true })
      writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify({
        task: 'F15 MCP live-loss zero-core upgrade — real-host smoke',
        runStamp: RUN_STAMP,
        fatal: msg.slice(0, 4000),
        criteria: Object.values(results),
        pass: false,
        exitCode: 1,
      }, null, 2))
    } catch { /* RUN_DIR may not exist yet */ }
    console.log(JSON.stringify({ fatal: msg.slice(0, 2000), criteria: Object.values(results) }, null, 2))
    process.exit(1)
  })
}
