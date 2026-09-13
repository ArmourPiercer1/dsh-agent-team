#!/usr/bin/env node
/**
 * multi-mcp-real-host-smoke.mjs — Task D (multi-mcp quick-fix) dual mini-MCP
 * REAL-HOST smoke kit.
 *
 * Purpose
 *   Prove, on a REAL DSH host (tests/deepseek-harness-test-use @ baseline,
 *   pristine), that the shipped dsh-agent-team production row (built from the
 *   TARGET repo passed via --repo) mounts TWO named mini-MCP servers
 *   (mcp_signal @3491, mcp_designer @3492) with per-template subsets:
 *     - leader template  : capabilities.mcp allow [A, B]
 *     - worker-a (m1)    : capabilities.mcp allow [A]
 *     - worker-b (m2)    : capabilities.mcp allow [B]
 *   and satisfies the seven acceptance criteria (d-docs-smoke.md):
 *     C1 per-agent model-facing MCP tools EXACT (I5 state shape + schema double proof)
 *     C2 A/B namespaces do not collide (same underlying tool `ping`, distinct
 *        mounted names mcp__A__ping / mcp__B__ping)
 *     C3 member isolation (m1 sees A only; m2 sees B only)
 *     C4 durable override tightening (leader [A,B] -> [A]) really unmounts B at
 *        the next boundary (tool gone from the model-facing schema)
 *     C5 host restart (same home, resume) rebuilds the SAME effective set
 *     C6 teardown releases 3491/3492 (+3496 mock, +host port)
 *     C7 test-use worktree porcelain empty + HEAD baseline; :3080 untouched
 *
 * World design (frozen-contract semantics — verified against mcp-facet.ts /
 * cell-provenance.ts / agent-bindings.mjs, int tree @ 4feac8c, Gate C round 1):
 *   - The blueprint's capabilities.mcp is the STATIC template gate only. It
 *     NEVER seeds the durable cell: an unspecified team cell is fail-closed
 *     (NO mount). So after boot:1 the kit seeds a TEAM-SCOPE governance
 *     override (override.set, capability mcp, allow [A,B], scope team) —
 *     the durable policy record that grants the cell.
 *   - Members created AFTER the seed resolve fresh at creation and mount
 *     their template subsets (m1 → A, m2 → B) immediately.
 *   - The leader (root session) reconciles only at a REQUEST BOUNDARY. The
 *     root native prompt path (/api/session/prompt) does NOT run the team
 *     boundary (pre-existing glue wiring: prepareAgentForRequest is invoked
 *     from submitAttributedInput / workDelivery.deliver / deliverRootInput /
 *     executeTool only). Therefore the kit triggers the boundary with a
 *     team-TOOL execution on the root (team_list_members via the p6t6 tool
 *     route → executeTool → prepareAgentForRequest(root) → reconcile) —
 *     once before the C1 probes, and once more as the C4 "next boundary"
 *     op after the instance-scope tighten. Tool executions issue no model
 *     requests (mock seq accounting unaffected).
 *   - pendingNextBoundary is bookkeeping/diagnostics, not a second gate:
 *     effective = current durable policy; a boundary (or a fresh setup,
 *     e.g. boot:2) applies it.
 *
 * Row config (canonical multi-MCP form + legacy null, RC/master compatible):
 *   mcpServers: [{ name: mcp_signal, port: 3491 }, { name: mcp_designer, port: 3492 }]
 *   mcpServer:  null
 * On the base tree (before Task A/B merge) the row still boots (legacy check
 * passes with null; `mcpServers` is an ignored unknown field); the team-scope
 * seed and the boundary-trigger tool calls are all ADMITTED there too
 * (governance override + team tools pre-date multi-MCP), but nothing ever
 * mounts (no mcpServers support) and the kit observes the LEGACY single-value
 * /__p6t6/state mcp shape — the EXPECTED base dry-run failure mode (criteria
 * C1-C5 FAIL with that detail; C6/C7 still PASS). Do not chase GREEN on a
 * base tree.
 *
 * Usage
 *   node multi-mcp-real-host-smoke.mjs [--repo <target repo root>] [--keep] [--host-port <n>]
 *     --repo        target repo to BUILD (pnpm build && pnpm build:composition) and
 *                   whose production dist + p6t6 harness row are mounted.
 *                   Default: cwd. A worktree without tests/deepseek-harness-test-use
 *                   resolves the host tree to the nearest ancestor that has it
 *                   (the main tree) — the standard test-infra layout.
 *     --keep        keep the temporary DSH_HOME world after the run (registered
 *                   in summary.json instead of deleted; TEST_METHODS §7).
 *     --host-port   fixed host port (3180 family). Default 0 = auto-pick the
 *                   first FREE port of 3180..3186 (3180 is commonly the
 *                   operator's own DSH GUI host in these environments).
 *
 * Ports (TEST_METHODS §1: 3180 family only, NEVER 3080)
 *   host 3180..3186 (auto) / mini A 3491 / mini B 3492 / mock model 3496
 *
 * Home protocol (TEST_METHODS §7)
 *   <hostRepoRoot>/tests/homes/mm-smoke-<UTC stamp>  (ephemeral; deleted at
 *   teardown unless --keep; <home>.lock beside it; never committed).
 *
 * Exit codes (fail loud; the full criterion list JSON is printed in ALL cases)
 *   0 = all seven criteria PASS (GREEN)
 *   2 = the run completed end-to-end but >=1 criterion FAILED
 *       (the expected base-tree dry-run outcome, or a real regression)
 *   1 = kit-level FATAL before completion (build/boot/infra); partial list
 *
 * Model path: a deterministic local DeepSeek-compatible mock (the target
 * repo's packages/tools/harness/mock-deepseek.mjs, port 3496) reached only
 * through the launch environment (DEEPSEEK_BASE_URL / DEEPSEEK_API_KEY) —
 * the real dsh-llm adapter + agent loop + durable session log run for every
 * turn; the mock's captured `tools` array per request is the model-facing
 * tool schema evidence (the t12-vertical pattern).
 *
 * Pattern sources (all read, none modified): packages/tools/harness/
 * t12-vertical.mjs (production row mount + boot chain + mock-env + p6t6
 * directives), tests/characterization/lib/{instance,util,tree-clean}.mjs,
 * packages/runtime/root-binding/harness/mini-mcp.mjs (the inline mini-MCP
 * endpoint below is a self-contained copy of its JSON-RPC dispatch).
 */

import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ── CLI ─────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
function argValue(name) {
  const i = argv.indexOf(name)
  return i === -1 ? undefined : argv[i + 1]
}
const KEEP = argv.includes('--keep')
const REPO_ARG = argValue('--repo')
const HOST_PORT_ARG = argValue('--host-port')

const KIT_DIR = dirname(fileURLToPath(import.meta.url))
const TARGET_REPO = resolve(REPO_ARG ?? process.cwd())

// Ephemeral world stamp: mm-smoke-<UTC stamp> (TEST_METHODS §7 form, e.g.
// mm-smoke-20260914T08-00-00Z — fractional seconds dropped, single trailing Z).
function utcStamp() {
  const d = new Date().toISOString() // 2026-09-14T08:00:00.000Z
  return `${d.slice(0, 4)}${d.slice(5, 7)}${d.slice(8, 10)}T${d.slice(11, 13)}-${d.slice(14, 16)}-${d.slice(17, 19)}Z`
}
const RUN_STAMP = 'mm-smoke-' + utcStamp()

// Evidence ALWAYS lands next to this kit file (the task's own evidence dir —
// committed with the task in whichever tree hosts this checkout).
const EVIDENCE_DIR = KIT_DIR
const RUN_DIR = join(EVIDENCE_DIR, 'runs', RUN_STAMP)

// ── target-repo imports (dynamic: the kit runs against any --repo tree) ────

async function importFrom(p) {
  return import(pathToFileURL(p).href)
}

let pathsMod, instanceMod, utilMod, treeCleanMod, mockMod
try {
  pathsMod = await importFrom(join(TARGET_REPO, 'tests', 'paths.mjs'))
} catch (error) {
  console.error(`FATAL --repo ${TARGET_REPO} is not a dsh-agent-team checkout (tests/paths.mjs missing): ${error.message}`)
  process.exit(1)
}
const { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH, findTestRepoRoot } = pathsMod
const HOST_REPO_ROOT = findTestRepoRoot(TARGET_REPO)
if (HOST_REPO_ROOT === null) {
  console.error(`FATAL no ancestor of ${TARGET_REPO} contains tests/deepseek-harness-test-use (build the test-use checkout first — TEST_METHODS §1)`)
  process.exit(1)
}
const HOST_TREE = join(HOST_REPO_ROOT, 'tests', 'deepseek-harness-test-use')
const { DshInstance, ensureProfile } = await importFrom(join(TARGET_REPO, 'tests', 'characterization', 'lib', 'instance.mjs'))
const { logTail, portInUse, spawnToLog, waitForPortFree } = await importFrom(join(TARGET_REPO, 'tests', 'characterization', 'lib', 'util.mjs'))
const { captureGitState } = await importFrom(join(TARGET_REPO, 'tests', 'characterization', 'lib', 'tree-clean.mjs'))
const { startMockModel } = await importFrom(join(TARGET_REPO, 'packages', 'tools', 'harness', 'mock-deepseek.mjs'))

// ── constants ───────────────────────────────────────────────────────────────

const HOST_PORT_CANDIDATES = [3180, 3181, 3182, 3183, 3184, 3185, 3186]
const PORT_A = 3491 // mini-MCP A (mcp_signal)
const PORT_B = 3492 // mini-MCP B (mcp_designer)
const MOCK_PORT = 3496
const STABLE_URL = 'http://127.0.0.1:3080/'

const SERVER_A = 'mcp_signal'
const SERVER_B = 'mcp_designer'
const TOOL_A = `mcp__${SERVER_A}__ping`
const TOOL_B = `mcp__${SERVER_B}__ping`

const ROOT = `session-mm-smoke-root-${RUN_STAMP}`
const LEADER_INSTANCE_ID = 'inst-leader'
const TMPL_LEADER = 'leader'
const TMPL_A = 'worker-a'
const TMPL_B = 'worker-b'

const HOME_NAME = RUN_STAMP // mm-smoke-<UTC stamp> (TEST_METHODS §7 ephemeral form)
const HOME = join(HOST_REPO_ROOT, 'tests', 'homes', HOME_NAME)
const LOCK_FILE = `${HOME}.lock`

const PRODUCTION_ROW_NAME = pathToFileURL(
  join(TARGET_REPO, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js'),
).href
const P6T6_ROW_NAME = pathToFileURL(join(TARGET_REPO, 'packages', 'tools', 'harness', 'plugin.mjs')).href
const NONCE = RUN_STAMP
const MK = (p) => `${p}_${NONCE}` // per-run markers
const MK_L1 = MK('MM_L1') // leader turn 1 (initial)
const MK_L2 = MK('MM_L2') // leader turn 2 (post-override)
const MK_M1 = MK('MM_M1')
const MK_M2 = MK('MM_M2')
const MK_RL = MK('MM_RL') // post-restart leader
const MK_RM1 = MK('MM_RM1')
const MK_RM2 = MK('MM_RM2')

// ── logging ─────────────────────────────────────────────────────────────────

let RUN_LOG = null
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  if (RUN_LOG !== null) {
    try { appendFileSync(RUN_LOG, `${stamped}\n`) } catch { /* dir not ready */ }
  }
}
function dieFatal(msg) {
  log(`FATAL — ${msg}`)
  throw new Error(msg)
}

// ── the inline mini-MCP endpoints (self-contained copy of the proven pattern) ─
// Pattern source: packages/runtime/root-binding/harness/mini-mcp.mjs (P5-T5
// real-instance harness): plain-JSON streamable-http, initialize /
// notifications / tools/list / tools/call, one tool. BOTH endpoints here
// expose the SAME tool name `ping` on purpose: the only thing that separates
// them after mounting is the mcp__<serverName>__ prefix (criterion C2).

function miniMcpRpc(serverLabel, msg) {
  const id = msg === null || typeof msg !== 'object' ? null : msg.id
  const method = msg === null || typeof msg !== 'object' ? undefined : msg.method
  const params = msg === null || typeof msg !== 'object' || msg.params === undefined ? {} : msg.params
  const ok = (result) => ({ jsonrpc: '2.0', id, result })
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } })
  const MINI_TOOL = {
    name: 'ping',
    description: `Task D smoke mini MCP echo tool (endpoint ${serverLabel})`,
    inputSchema: {
      type: 'object',
      properties: { msg: { type: 'string' } },
      required: ['msg'],
      additionalProperties: false,
    },
  }
  switch (method) {
    case 'initialize':
      return ok({
        protocolVersion: (params && params.protocolVersion) || '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: `mm-smoke-mini-${serverLabel}`, version: '0.0.1' },
      })
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null
    case 'tools/list':
      return ok({ tools: [MINI_TOOL] })
    case 'tools/call':
      if (params.name === 'ping') {
        const text = `pong:${serverLabel}:${String((params.arguments && params.arguments.msg) ?? '')}`
        return ok({ content: [{ type: 'text', text }], isError: false })
      }
      return fail(-32602, `unknown tool: ${String(params.name)}`)
    default:
      if (id === null) return null
      return fail(-32601, `method not found: ${String(method)}`)
  }
}

function startMiniMcp(port, label) {
  return new Promise((resolveListen, rejectListen) => {
    const server = createServer((req, res) => {
      if (req.method === 'DELETE' && req.url === '/mcp') { res.writeHead(200); res.end(); return }
      if (req.method !== 'POST' || req.url !== '/mcp') {
        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'not found' } }))
        return
      }
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        let msg
        try { msg = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null') }
        catch {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }))
          return
        }
        const reply = miniMcpRpc(label, msg)
        if (reply === null) { res.writeHead(202); res.end(); return }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(reply))
      })
    })
    server.once('error', rejectListen)
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', rejectListen)
      resolveListen({ port: server.address().port, server })
    })
  })
}

async function closeMini(mini) {
  if (mini === null || mini === undefined) return
  await new Promise((resolveClose) => {
    try {
      mini.server.close(() => resolveClose())
      mini.server.closeAllConnections?.()
    } catch { resolveClose() }
  })
}

/** Direct MCP-level probe: initialize + tools/list against one mini endpoint. */
async function probeMiniTools(port) {
  const post = async (body) => {
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    return { status: res.status, body: res.status === 202 ? null : await res.json().catch(() => null) }
  }
  const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mm-smoke-kit', version: '0.0.1' } } })
  const list = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  return {
    initStatus: init.status,
    tools: (list.body?.result?.tools ?? []).map((t) => t?.name).filter(Boolean),
  }
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

async function fetchJson(url, init, timeoutMs) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  let body = null
  try { body = text === '' ? null : JSON.parse(text) } catch { body = { nonJsonBody: text.slice(0, 800) } }
  return { status: res.status, body }
}

async function probeStableInstance() {
  try {
    const { status } = await fetchJson(STABLE_URL, undefined, 10_000)
    return { url: STABLE_URL, status }
  } catch (error) {
    return { url: STABLE_URL, status: `unreachable: ${String(error?.message ?? error).slice(0, 120)}` }
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
async function remoteCall(origin, cookie, method, params) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `mms-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version: 1, params },
    }),
  }, 180_000)
}

/** One user turn on the DSH core public channel: POST /api/session/prompt. */
async function apiPrompt(origin, cookie, sessionId, text) {
  return fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `mms-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: {
        args: {
          request: {
            requestId: `mms-${Math.random().toString(36).slice(2, 12)}`,
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text }],
          },
        },
      },
    }),
  }, 180_000)
}

/** One shipped team tool through the pattern-sanctioned observability seam. */
async function p6t6Tool(port, name, args, as) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args, as }),
  }, 180_000)
}

async function p6t6State(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 30_000)
}

async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}

/** Poll the state route until the well-formed body for root+phase appears. */
async function p6t6StateReady(port, { rootSessionId, phase, timeoutMs = 90_000, intervalMs = 500 }) {
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

/** Unwrap the observability-seam tool envelope: {ok:true, value}. */
function toolValue(result, name) {
  if (result.status !== 200) throw new Error(`${name}: HTTP ${result.status}: ${JSON.stringify(result.body).slice(0, 400)}`)
  if (result.body?.ok !== true) throw new Error(`${name}: tool error: ${JSON.stringify(result.body).slice(0, 800)}`)
  const value = result.body.value
  if (value?.status === 'rejected') throw new Error(`${name}: rejected: ${JSON.stringify(value.effect ?? value).slice(0, 800)}`)
  return value
}

// ── the multi-MCP blueprint (live-host scale) ───────────────────────────────
// Persona values are DOUBLE-QUOTED (a YAML plain scalar may not contain ": ";
// the blueprint parser is strict — t12-vertical precedent). All four
// capability sub-fields are declared wherever `capabilities` is present
// (closed-v1 schema requirement). The leader keeps the FULL team-tools set
// (it must be able to create the member instances from the p6t6 seam).

const TEAM_TOOLS = [
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_create_member',
  'team_delegate',
  'team_follow_up',
  'team_collect',
  'team_send_message',
  'team_report_progress',
  'team_request_control',
  'team_resolve_control',
]

const BLUEPRINT = [
  '---',
  'schemaVersion: 1',
  `blueprintId: mm-smoke-bp-1`,
  'revision: "1"',
  'leader:',
  `  templateId: ${TMPL_LEADER}`,
  `  persona: "Task D multi-mcp smoke leader: you lead the mm-smoke team."`,
  '  capabilities:',
  '    teamTools:',
  '      kind: allow',
  '      items:',
  ...TEAM_TOOLS.map((t) => `        - ${t}`),
  '    builtinToolDeny: []',
  '    skills:',
  '      kind: allow',
  '      items:',
  '        - base',
  '    mcp:',
  '      kind: allow',
  '      items:',
  `        - ${SERVER_A}`,
  `        - ${SERVER_B}`,
  'members:',
  `  - templateId: ${TMPL_A}`,
  `    displayName: "Smoke Member A"`,
  `    persona: "Task D multi-mcp smoke member A: you use the ${SERVER_A} tools."`,
  '    capabilities:',
  '      teamTools:',
  '        kind: allow',
  '        items: []',
  '      builtinToolDeny: []',
  '      skills:',
  '        kind: allow',
  '        items:',
  '          - base',
  '      mcp:',
  '        kind: allow',
  '        items:',
  `          - ${SERVER_A}`,
  `  - templateId: ${TMPL_B}`,
  `    displayName: "Smoke Member B"`,
  `    persona: "Task D multi-mcp smoke member B: you use the ${SERVER_B} tools."`,
  '    capabilities:',
  '      teamTools:',
  '        kind: allow',
  '        items: []',
  '      builtinToolDeny: []',
  '      skills:',
  '        kind: allow',
  '        items:',
  '          - base',
  '      mcp:',
  '        kind: allow',
  '        items:',
  `          - ${SERVER_B}`,
  'requirements:',
  '  - domain: persona',
  '    name: standard',
  '  - domain: skill',
  '    name: base',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - archive-member',
  '    - restore-member',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  `  - templateId: ${TMPL_A}`,
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  `  - templateId: ${TMPL_B}`,
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: "Task D multi-mcp smoke default state."',
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

// ── the production row config + profile-patch emitter ───────────────────────

function teamRowConfig({ bootPhase }) {
  return {
    rootSessionId: ROOT,
    bootPhase,
    blueprintSource: BLUEPRINT,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'mm-smoke-model' },
    deniedSelection: null,
    // Canonical 0..N form (the shape under test) + legacy null so the SAME
    // patch also boots on a base tree (mcpServers ignored, legacy null check
    // passes) — the base dry-run then shows the single-value shape instead of
    // a config rejection (d-docs-smoke.md expected failure mode, either form
    // is recorded; this one exercises the full chain).
    mcpServers: [
      { name: SERVER_A, port: PORT_A },
      { name: SERVER_B, port: PORT_B },
    ],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    // Row-owned plain-JS module URLs (the t12-vertical live-verified form).
    glueUrl: pathToFileURL(join(TARGET_REPO, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')).href,
    seamUrl: pathToFileURL(join(TARGET_REPO, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href,
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
    `# Task D multi-mcp smoke patch layer (world ${HOME_NAME}): production dsh-agent-team row (TARGET repo ${TARGET_REPO} built dist) + p6t6 observability row — mounted ONLY through this public profile-patch seam.`,
    '# Row config: mcpServers [mcp_signal:3491, mcp_designer:3492] + legacy mcpServer:null (see kit header).',
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig({ bootPhase }) }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

// ── runtime module resolution wiring (t12-vertical pattern, worktree-only) ──
// The production row's dynamic imports (seam.mjs, agent-bindings.mjs) resolve
// bare specifiers (@deepseek-ai/*, zod) by the standard Node walk from the
// TARGET repo. When the target is a pnpm worktree, mirror the host tree's hoist
// entries into packages/runtime/node_modules + packages/node_modules
// (gitignored, target-tree-local; the host tree is never touched).

const RUNTIME_LINKS = [
  ['@deepseek-ai', 'dsh-agent'],
  ['@deepseek-ai', 'dsh-llm'],
  ['@deepseek-ai', 'dsh-mcp-client'],
  ['@deepseek-ai', 'dsh-session'],
  ['@deepseek-ai', 'dsh-storage-domain'],
  [null, 'zod'],
]
const PACKAGES_LINKS = [
  ['@deepseek-ai', 'dsh-agent'],
  ['@deepseek-ai', 'dsh-llm'],
  ['@deepseek-ai', 'dsh-mcp-client'],
  ['@deepseek-ai', 'dsh-session'],
  ['@deepseek-ai', 'dsh-storage-domain'],
  ['@deepseek-ai', 'dsh-scope'],
  ['@deepseek-ai', 'dsh-system-prompt'],
]

function ensureJunctions(base, links, logTag) {
  const hoist = join(HOST_TREE, 'node_modules', '.pnpm', 'node_modules')
  mkdirSync(base, { recursive: true })
  for (const [scope, name] of links) {
    const label = scope ? `${scope}/${name}` : name
    const target = scope ? join(hoist, scope, name) : join(hoist, name)
    if (!existsSync(target)) {
      throw new Error(`host tree pnpm hoist has no link for ${label} at ${target} — cannot wire ${logTag} module links (is the test-use checkout pnpm-installed?)`)
    }
    const scopeDir = scope ? join(base, scope) : base
    mkdirSync(scopeDir, { recursive: true })
    const link = join(scopeDir, name)
    let st = null
    try { st = lstatSync(link) } catch { /* absent */ }
    if (st !== null) {
      if (st.isSymbolicLink() || (statSync(link, { throwIfNoEntry: false })?.isDirectory() ?? false)) {
        let okResolve = false
        try { okResolve = realpathSync(link) === realpathSync(target) } catch { okResolve = false }
        if (okResolve) continue
        rmSync(link, { force: true })
      } else {
        rmSync(link, { force: true })
      }
    }
    symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir')
    log(`${logTag} link: ${label} -> ${target}`)
  }
}

// ── mock model decide (every turn = plain text ack; NO tool calls) ──────────
// The turn's FIRST model request carries the marker + the model-facing tool
// schema; a text-only reply keeps each turn a single model round-trip.

function makeDecide() {
  const all = [MK_L1, MK_L2, MK_M1, MK_M2, MK_RL, MK_RM1, MK_RM2]
  return (ctx) => {
    const body = ctx?.req ?? ctx
    const msgs = Array.isArray(body?.messages) ? body.messages : []
    const last = [...msgs].reverse().find((m) => m && (m.role === 'user' || m.role === 'tool'))
    const text = last === undefined ? '' : String(typeof last.content === 'string' ? last.content : JSON.stringify(last.content))
    for (const m of all) {
      if (text.includes(m)) return { kind: 'text', content: `MM_ACK_${m}` }
    }
    return { kind: 'text', content: `MM_DEFAULT_ACK_${NONCE}` }
  }
}

/** Poll the mock capture for the request whose messages contain `marker`. */
async function waitForMockRequest(mock, marker, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const req = mock.requests.find((r) => (r.body?.messages ?? []).some((m) => typeof m.content === 'string' && m.content.includes(marker)))
    if (req !== undefined) return req
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

// ── /__p6t6/state mcp shape classification (base vs int I5) ─────────────────

function classifyMcpShape(mcp) {
  if (mcp === undefined || mcp === null) return 'absent'
  if (typeof mcp === 'object' && mcp.servers !== undefined && !Array.isArray(mcp.servers) && typeof mcp.servers === 'object') return 'i5-servers'
  if (typeof mcp === 'object' && ('serverName' in mcp || 'mounted' in mcp)) return 'legacy-single'
  return 'unknown'
}

/**
 * Per-session effective MCP map from a state body.
 * I5 shape: { <server>: { mounted, allowed } }.
 * Legacy single shape: { '<serverName>': { mounted, allowed: null } } with the
 * one configured server (or empty when serverName is null).
 */
function effectiveMcpMap(stateBody, sessionId, configuredNames) {
  const mcp = stateBody?.governance?.sessions?.[sessionId]?.mcp
  const shape = classifyMcpShape(mcp)
  if (shape === 'i5-servers') {
    const map = {}
    for (const name of configuredNames) {
      const s = mcp.servers?.[name]
      map[name] = s === undefined || s === null
        ? { present: false, mounted: false, allowed: null }
        : { present: true, mounted: s.mounted === true, allowed: typeof s.allowed === 'boolean' ? s.allowed : null }
    }
    return { shape, map, raw: mcp }
  }
  if (shape === 'legacy-single') {
    const map = {}
    const name = mcp.serverName ?? null
    for (const n of configuredNames) map[n] = { present: n === name, mounted: n === name && mcp.mounted === true, allowed: null }
    return { shape, map, raw: mcp }
  }
  const map = {}
  for (const n of configuredNames) map[n] = { present: false, mounted: false, allowed: null }
  return { shape, map, raw: mcp ?? null }
}

// ── criteria bookkeeping ────────────────────────────────────────────────────

const CRITERIA = [
  { id: 'C1', name: 'per-agent model-facing MCP tools EXACT (I5 state + schema double proof): leader A+B / m1 A / m2 B' },
  { id: 'C2', name: 'A/B namespaces do not collide (same underlying tool ping; distinct mounted names)' },
  { id: 'C3', name: 'member isolation (m1 sees A only; m2 sees B only)' },
  { id: 'C4', name: 'durable override tighten (leader [A,B]->[A]) really unmounts B at the next boundary' },
  { id: 'C5', name: 'host restart (same home, resume) rebuilds the SAME effective set' },
  { id: 'C6', name: 'teardown releases 3491/3492 (+3496 mock, +host port)' },
  { id: 'C7', name: 'test-use porcelain empty + HEAD baseline; :3080 untouched' },
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
    kit: 'multi-mcp-real-host-smoke.mjs',
    runStamp: RUN_STAMP,
    at: new Date().toISOString(),
  }, null, 2))
}

async function bootHost({ label, port, boot, phase, hostPort }) {
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
  // Register the live host the moment the child is up: a failure between
  // start() and row-health must still be swept at teardown (no orphan).
  liveHosts.add(rec)
  // start() resolves only on the boot marker line; it returns the URL with
  // the "dsh web:" prefix already stripped: http://127.0.0.1:<port>/?token=...
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(started.url)
  if (m === null) dieFatal(`${label}: unexpected boot url shape: ${started.url}`)
  rec.token = m[2]
  rec.origin = `http://127.0.0.1:${m[1]}`
  // TEST_METHODS §2 verify #2: bare GET / (no token) must be 401.
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
  // Row health (setup gate; fail fast on a latched setupError).
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

// ── one full agent probe: create (members) / turn / state+schema snapshot ───

/**
 * Drive one turn on the agent (leader via apiPrompt, members via member.send),
 * wait for its model request at the mock, and snapshot (state I5/legacy map +
 * model-facing mcp tools). Returns the snapshot.
 */
async function probeAgent({ label, host, kind, marker, cookie }) {
  let turnOk = false
  let turnDetail = ''
  if (kind === 'leader') {
    const res = await apiPrompt(host.origin, cookie, ROOT, marker)
    turnOk = res.status === 200 && res.body?.result?.ok === true
    turnDetail = `apiPrompt status=${res.status}`
  } else {
    const res = await remoteCall(host.origin, cookie, 'member.send', {
      teamSessionId: ROOT,
      caller: { kind: 'human', humanId: ROOT },
      recipientInstanceId: kind, // instanceId
      body: marker,
      requestToken: `mms-${marker.slice(0, 40)}-${Math.random().toString(36).slice(2, 8)}`,
    })
    const value = remoteValue(res, 'member.send')
    const outcome = value?.outcome
    turnOk = outcome?.status === 'executed' || outcome?.status === 'delivered'
    turnDetail = `member.send outcome=${JSON.stringify(outcome ?? null).slice(0, 200)}`
  }
  if (!turnOk) throw new Error(`${label}: turn not admitted (${turnDetail})`)
  const req = await waitForMockRequest(mockRef.current, marker, 300_000)
  if (req === null) throw new Error(`${label}: no model request carrying marker ${marker} reached the mock within 300s`)
  const state = await p6t6State(host.port)
  if (state.status !== 200 || state.body === null) throw new Error(`${label}: state route unavailable: HTTP ${state.status} ${JSON.stringify(state.body).slice(0, 300)}`)
  return { label, marker, reqSeq: req.seq, reqModel: req.body?.model, turnDetail, stateBody: state.body, req }
}

const mockRef = { current: null }

// ── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  log(`=== Task D multi-mcp real-host smoke kit ${RUN_STAMP} ===`)
  log(`targetRepo=${TARGET_REPO}`)
  log(`hostRepoRoot=${HOST_REPO_ROOT} hostTree=${HOST_TREE}`)
  log(`evidenceDir=${RUN_DIR} keep=${KEEP}`)

  // ── pre-flight ────────────────────────────────────────────────────────────
  const stablePre = await probeStableInstance()
  writeFileSync(join(RUN_DIR, 'port3080-pre.txt'), `# :3080 pre-flight probe (READ-ONLY; TEST_METHODS §3: never touch)\nurl: ${STABLE_URL}\nhttpStatus: ${stablePre.status}\nat: ${new Date().toISOString()}\n`)
  log(`:3080 pre: ${stablePre.status}`)

  const gitPreDir = join(RUN_DIR, 'git-pre')
  mkdirSync(gitPreDir, { recursive: true })
  const gitPre = await captureGitState(HOST_TREE, gitPreDir)
  writeFileSync(join(RUN_DIR, 'testuse-pre.json'), JSON.stringify({ ...gitPre, baselineSha: TEST_USE_BASELINE_SHA, at: new Date().toISOString() }, null, 2))
  log(`test-use pre: head=${gitPre.head} statusEmpty=${gitPre.statusEmpty} diffEmpty=${gitPre.diffEmpty} baseline=${TEST_USE_BASELINE_SHA}`)
  if (gitPre.statusEmpty !== true || gitPre.diffEmpty !== true) {
    dieFatal(`test-use worktree is NOT pristine before the run (porcelain non-empty) — fix before running (TEST_METHODS §3.5)`)
  }

  // Host port: --host-port fixed, else first free of 3180..3186.
  let hostPort = null
  if (HOST_PORT_ARG !== undefined) {
    const p = Number(HOST_PORT_ARG)
    if (!Number.isInteger(p) || p < 3180 || p > 3186) dieFatal(`--host-port must be an integer in 3180..3186 (3180 family; 3080 forbidden)`)
    hostPort = p
  } else {
    for (const p of HOST_PORT_CANDIDATES) {
      if (!(await portInUse(p))) { hostPort = p; break }
    }
    if (hostPort === null) dieFatal('no free port in the 3180..3186 family (3180 may be the operator\'s own DSH GUI)')
  }
  if (hostPort === 3080) dieFatal('port 3080 is FORBIDDEN (stable instance) — refusing')
  log(`host port selected: ${hostPort}`)
  for (const [label, p] of [['mcpA', PORT_A], ['mcpB', PORT_B], ['mock', MOCK_PORT]]) {
    if (await portInUse(p)) dieFatal(`port ${label}=${p} is already in use — refusing to start (3491-3500 band must be free)`)
  }
  log(`ports free: host=${hostPort} mcpA=${PORT_A} mcpB=${PORT_B} mock=${MOCK_PORT}`)

  assertFreshHome(HOME, 'smoke world')
  log(`fresh home asserted: ${HOME} (lock: ${LOCK_FILE})`)

  // Worktree module links (gitignored, target-tree-local; host tree untouched).
  ensureJunctions(join(TARGET_REPO, 'packages', 'runtime', 'node_modules'), RUNTIME_LINKS, 'runtime')
  ensureJunctions(join(TARGET_REPO, 'packages', 'node_modules'), PACKAGES_LINKS, 'packages')
  log('module resolution links wired (runtime + packages level)')

  // ── build (target repo production dist — the sanctioned recipe) ──────────
  log('building target repo: pnpm build && pnpm build:composition …')
  const buildLogPath = join(RUN_DIR, 'build.log')
  const b1 = await spawnToLog('pnpm', ['build'], { cwd: TARGET_REPO, logPath: buildLogPath, timeoutMs: 900_000 })
  if (!b1.ok) dieFatal(`pnpm build failed (exit=${b1.exitCode}): ${b1.text.split('\n').slice(-15).join('\n')}`)
  log(`pnpm build ok (log: ${buildLogPath})`)
  const b2 = await spawnToLog('pnpm', ['build:composition'], { cwd: TARGET_REPO, logPath: buildLogPath, timeoutMs: 600_000 })
  if (!b2.ok) dieFatal(`pnpm build:composition failed (exit=${b2.exitCode}) — incl. check-artifacts-committed: ${b2.text.split('\n').slice(-15).join('\n')}`)
  log('pnpm build:composition ok (install-surface freshness gate passed)')
  // Import probe: the built dist host must load under plain node.
  const probe = await spawnToLog(process.execPath, ['-e', `import(${JSON.stringify(PRODUCTION_ROW_NAME)}).then(m => console.log('LOADED name=' + m.name)).catch(e => { console.error('PROBE_FAIL ' + e.message); process.exit(1) })`], {
    cwd: TARGET_REPO,
    logPath: join(RUN_DIR, 'build-import-probe.log'),
    timeoutMs: 120_000,
  })
  if (!probe.ok || !probe.text.includes('LOADED name=dsh-agent-team')) {
    dieFatal(`dist host import probe failed: ${probe.text.slice(-400)}`)
  }
  log('dist host import probe ok')

  // ── services: mock model + mini MCP A/B ───────────────────────────────────
  const mock = await startMockModel({ port: MOCK_PORT, decide: makeDecide(), log: (l) => log(`mock: ${l}`) })
  if (mock.port !== MOCK_PORT) dieFatal(`mock model landed on ${mock.port}, expected ${MOCK_PORT}`)
  mockRef.current = mock
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  process.env.DEEPSEEK_API_KEY = 'mm-smoke-mock-key'
  log(`mock DeepSeek endpoint up at 127.0.0.1:${MOCK_PORT} (DEEPSEEK_BASE_URL/DEEPSEEK_API_KEY exported to host launches)`)
  let miniA = null
  let miniB = null
  try {
    miniA = await startMiniMcp(PORT_A, 'a')
    if (miniA.port !== PORT_A) dieFatal(`mini MCP A landed on ${miniA.port}, expected ${PORT_A}`)
    miniB = await startMiniMcp(PORT_B, 'b')
    if (miniB.port !== PORT_B) dieFatal(`mini MCP B landed on ${miniB.port}, expected ${PORT_B}`)
    log(`mini MCP A up on 127.0.0.1:${PORT_A} (${SERVER_A}); B up on 127.0.0.1:${PORT_B} (${SERVER_B})`)
    // C2 direct MCP-level evidence: both endpoints expose the SAME tool name.
    const probeA = await probeMiniTools(PORT_A)
    const probeB = await probeMiniTools(PORT_B)
    writeFileSync(join(RUN_DIR, 'mini-probes.json'), JSON.stringify({ a: probeA, b: probeB }, null, 2))
    log(`mini tools/list: A=${JSON.stringify(probeA.tools)} B=${JSON.stringify(probeB.tools)}`)
    results.C2.miniProbe = { a: probeA, b: probeB }
  } catch (error) {
    dieFatal(`mini MCP startup failed: ${error.message}`)
  }

  let host1 = null
  let host2 = null
  let memberA = null
  let memberB = null
  let seedRec = null
  try {
    // ── world boot #1 (create) ──────────────────────────────────────────────
    await ensureProfile({ instance: new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port: hostPort, clientCommitHash: CLIENT_COMMIT_HASH, logDir: join(RUN_DIR, 'instances', 'profile-init') }), log, timeoutMs: 180_000 })
    log('web profile ensured (throwaway boot if first use)')
    host1 = await bootHost({ label: 'HOST1-CREATE', port: hostPort, boot: 1, phase: 'create', hostPort })
    const st1 = await p6t6StateReady(host1.port, { rootSessionId: ROOT, phase: 'create' })
    log(`HOST1: state ready (teamSession=${st1.body?.teamSession?.blueprintId} rev=${st1.body?.teamSession?.revision})`)

    // ── seed the durable TEAM-scoped mcp allow (governance record) ─────────
    // The blueprint's capabilities.mcp is only the STATIC template gate —
    // it never seeds the durable cell (frozen mcp-facet semantics: an
    // unspecified team cell is fail-closed = NO mount). Mounting therefore
    // requires a governance record. This team-scope override (allow [A,B])
    // makes the durable policy grant the cell, so that:
    //   - fresh member-setup resolution at creation sees team-allow ∩
    //     template → member-1 mounts A, member-2 mounts B (C2/C3 hold from
    //     the creation phase);
    //   - the leader's next REQUEST BOUNDARY (a team-tool execution on the
    //     root — see the boundary trigger below) reconciles [A,B].
    // Fail loud: without this record the world is contract-correct but
    // mounts nothing, which would look like a runtime regression.
    const seedRes = await remoteCall(host1.origin, host1.cookie, 'override.set', {
      teamSessionId: ROOT,
      capability: 'mcp',
      value: { kind: 'allow', items: [SERVER_A, SERVER_B] },
      actor: { kind: 'human' },
      scope: 'team',
    })
    let seedRecLocal = null
    try {
      seedRecLocal = remoteValue(seedRes, 'override.set')?.record ?? remoteValue(seedRes, 'override.set')
      if (typeof seedRecLocal?.recordId !== 'string') throw new Error(`no recordId in admission: ${JSON.stringify(seedRecLocal).slice(0, 200)}`)
    } catch (error) {
      throw new Error(`team-scope mcp allow seed REJECTED (precondition for the whole smoke): ${String(error.message ?? error)}`)
    }
    seedRec = seedRecLocal
    log(`durable seed: team-scope mcp allow [${SERVER_A}, ${SERVER_B}] admitted (recordId=${seedRec.recordId})`)

    // ── create members (shipped tool via the p6t6 seam) ────────────────────
    const mkMember = async (tmpl, label, tag) => {
      const res = await p6t6Tool(host1.port, 'team_create_member', {
        rootSessionId: ROOT,
        requestToken: `mms-create-${tag}-${RUN_STAMP}`,
        delegationTemplateId: tmpl,
        label: `mm-smoke-${tag}`,
      }, ROOT)
      const created = toolValue(res, 'team_create_member')
      if (created?.status !== 'executed') throw new Error(`${label}: team_create_member not executed: ${JSON.stringify(created).slice(0, 400)}`)
      const effect = created?.effect
      if (typeof effect?.instanceId !== 'string' || typeof effect?.childSessionId !== 'string') {
        throw new Error(`${label}: effect missing instanceId/childSessionId: ${JSON.stringify(effect).slice(0, 300)}`)
      }
      log(`${label}: created instanceId=${effect.instanceId} childSessionId=${effect.childSessionId} (template ${tmpl})`)
      return { templateId: tmpl, instanceId: effect.instanceId, childSessionId: effect.childSessionId }
    }
    memberA = await mkMember(TMPL_A, 'member-1', 'm1')
    memberB = await mkMember(TMPL_B, 'member-2', 'm2')

    // ── leader boundary trigger (request-boundary op on the root) ─────────
    // The root NATIVE prompt path (/api/session/prompt) does NOT run the
    // team request boundary (pre-existing glue wiring: prepareAgentForRequest
    // is wired into submitAttributedInput / workDelivery.deliver /
    // deliverRootInput / executeTool only). A team-TOOL execution on the
    // root goes through executeTool → prepareAgentForRequest(root) → mcp
    // reconcile, which mounts [A,B] for the leader (team allow [A,B] ∩
    // leader template allow [A,B]). Run it BEFORE the first leader probe so
    // C1 observes the post-boundary state. (Tool executions issue no model
    // requests — mock seq accounting is unaffected.)
    const trig1Res = await p6t6Tool(host1.port, 'team_list_members', {
      rootSessionId: ROOT,
      requestToken: `mms-trig1-${RUN_STAMP}`,
    }, ROOT)
    const trig1 = toolValue(trig1Res, 'team_list_members')
    log(`leader boundary trigger: team_list_members executed (status=${trig1?.status})`)

    // ── initial probes (C1/C2/C3 data) ─────────────────────────────────────
    const snapLeader1 = await probeAgent({ label: 'leader#1', host: host1, kind: 'leader', marker: MK_L1, cookie: host1.cookie })
    const snapM1 = await probeAgent({ label: 'member-1#1', host: host1, kind: memberA.instanceId, marker: MK_M1, cookie: host1.cookie })
    const snapM2 = await probeAgent({ label: 'member-2#1', host: host1, kind: memberB.instanceId, marker: MK_M2, cookie: host1.cookie })
    writeFileSync(join(RUN_DIR, 'state-after-c1.json'), JSON.stringify({
      leader: snapLeader1.stateBody, member1: snapM1.stateBody, member2: snapM2.stateBody,
    }, null, 2))

    const cfgNames = [SERVER_A, SERVER_B]
    const shapeLeader = classifyMcpShape(snapLeader1.stateBody?.governance?.sessions?.[ROOT]?.mcp)
    log(`state mcp shape (leader session): ${shapeLeader}`)

    // ── C1: per-agent exact MCP tools (state + schema double proof) ────────
    const expected = {
      [ROOT]: { mounted: [SERVER_A, SERVER_B], schema: [TOOL_A, TOOL_B] },
      [memberA.childSessionId]: { mounted: [SERVER_A], schema: [TOOL_A] },
      [memberB.childSessionId]: { mounted: [SERVER_B], schema: [TOOL_B] },
    }
    const snaps = { [ROOT]: snapLeader1, [memberA.childSessionId]: snapM1, [memberB.childSessionId]: snapM2 }
    const labels = { [ROOT]: 'leader', [memberA.childSessionId]: 'member-1', [memberB.childSessionId]: 'member-2' }
    for (const sid of Object.keys(expected)) {
      const snap = snaps[sid]
      const label = labels[sid]
      const eff = effectiveMcpMap(snap.stateBody, sid, cfgNames)
      check('C1', `${label}: /__p6t6/state mcp shape is I5 (mcp.servers map)`, eff.shape === 'i5-servers',
        `observed shape=${eff.shape} raw=${JSON.stringify(eff.raw).slice(0, 300)}${eff.shape === 'legacy-single' ? ' — LEGACY single-value shape: the target tree predates mcpServers support (Task A/B not merged); this is the EXPECTED base dry-run failure mode, not a kit defect' : ''}`)
      for (const s of cfgNames) {
        const expMounted = expected[sid].mounted.includes(s)
        check('C1', `${label}: state servers.${s}.mounted === ${expMounted}`, eff.map[s].mounted === expMounted,
          `observed=${JSON.stringify(eff.map[s])}`)
      }
      const schemaTools = mcpToolsOf(snap.req)
      const expTools = expected[sid].schema
      const sameSet = Array.isArray(schemaTools) && schemaTools.length === expTools.length && expTools.every((t) => schemaTools.includes(t))
      check('C1', `${label}: model-facing MCP tool set EXACT === ${JSON.stringify(expTools)}`, sameSet,
        `observed=${JSON.stringify(schemaTools)} (mock req seq=${snap.reqSeq} model=${snap.reqModel})`)
      check('C1', `${label}: double proof consistent (state-mounted servers appear in the model schema)`,
        Array.isArray(schemaTools) && expected[sid].mounted.every((s) => schemaTools.includes(`mcp__${s}__ping`))
        && cfgNames.filter((s) => !expected[sid].mounted.includes(s)).every((s) => !schemaTools.includes(`mcp__${s}__ping`)),
        `state mounted=${JSON.stringify(expected[sid].mounted)} schema=${JSON.stringify(schemaTools)}`)
    }
    finishCriterion('C1')

    // ── C2: namespace separation ───────────────────────────────────────────
    const miniA = results.C2.miniProbe?.a
    const miniB = results.C2.miniProbe?.b
    check('C2', 'both mini endpoints expose the SAME underlying tool name "ping" (MCP-level)',
      miniA?.tools?.join(',') === 'ping' && miniB?.tools?.join(',') === 'ping',
      `A tools=${JSON.stringify(miniA?.tools)} B tools=${JSON.stringify(miniB?.tools)}`)
    const leaderTools = mcpToolsOf(snapLeader1.req) ?? []
    check('C2', 'leader schema carries BOTH mounted names as distinct tools (prefix separation, no collision)',
      leaderTools.includes(TOOL_A) && leaderTools.includes(TOOL_B) && TOOL_A !== TOOL_B,
      `leader mcp tools=${JSON.stringify(leaderTools)}`)
    check('C2', 'no colliding duplicate tool names in the leader schema',
      new Set(leaderTools).size === leaderTools.length,
      `leader mcp tools=${JSON.stringify(leaderTools)}`)
    finishCriterion('C2')

    // ── C3: member isolation ───────────────────────────────────────────────
    const m1Tools = mcpToolsOf(snapM1.req) ?? []
    const m2Tools = mcpToolsOf(snapM2.req) ?? []
    check('C3', 'member-1 schema: A tool present, B tool ABSENT',
      m1Tools.includes(TOOL_A) && !m1Tools.includes(TOOL_B), `m1 mcp tools=${JSON.stringify(m1Tools)}`)
    check('C3', 'member-2 schema: B tool present, A tool ABSENT',
      m2Tools.includes(TOOL_B) && !m2Tools.includes(TOOL_A), `m2 mcp tools=${JSON.stringify(m2Tools)}`)
    const effM1 = effectiveMcpMap(snapM1.stateBody, memberA.childSessionId, cfgNames)
    const effM2 = effectiveMcpMap(snapM2.stateBody, memberB.childSessionId, cfgNames)
    check('C3', 'member-1 state: A mounted, B NOT mounted',
      effM1.map[SERVER_A].mounted === true && effM1.map[SERVER_B].mounted === false,
      `m1 eff=${JSON.stringify(effM1.map)}`)
    check('C3', 'member-2 state: B mounted, A NOT mounted',
      effM2.map[SERVER_B].mounted === true && effM2.map[SERVER_A].mounted === false,
      `m2 eff=${JSON.stringify(effM2.map)}`)
    finishCriterion('C3')

    // ── C4: durable override tighten (leader [A,B] -> [A]) ─────────────────
    const setRes = await remoteCall(host1.origin, host1.cookie, 'override.set', {
      teamSessionId: ROOT,
      capability: 'mcp',
      value: { kind: 'allow', items: [SERVER_A] },
      actor: { kind: 'human' },
      scope: 'instance',
      targetInstanceId: LEADER_INSTANCE_ID,
    })
    let overrideRec = null
    let overrideErr = null
    try {
      overrideRec = remoteValue(setRes, 'override.set')?.record ?? remoteValue(setRes, 'override.set')
      log(`C4: override.set admitted (recordId=${overrideRec?.recordId ?? '?'})`)
    } catch (error) {
      overrideErr = String(error.message ?? error)
      log(`C4: override.set REJECTED: ${overrideErr}`)
    }
    check('C4', 'durable override tighten admitted (leader mcp allow [A,B] -> [A])',
      overrideErr === null && overrideRec !== null && typeof (overrideRec?.recordId) === 'string',
      overrideErr ?? `record=${JSON.stringify(overrideRec).slice(0, 300)}`)
    // The "next boundary" must be a boundary-RUNNING op on the root: a
    // team-tool execution (executeTool → prepareAgentForRequest(root) →
    // reconcile). The root native prompt does NOT run the team boundary
    // (pre-existing glue wiring), so a prompt-only probe would leave the
    // tightened policy sitting in pendingNextBoundary with no reconcile.
    // After this op: B is disposed (deny-first), A stays mounted.
    const trig2Res = await p6t6Tool(host1.port, 'team_list_members', {
      rootSessionId: ROOT,
      requestToken: `mms-trig2-${RUN_STAMP}`,
    }, ROOT)
    const trig2 = toolValue(trig2Res, 'team_list_members')
    log(`C4 boundary trigger: team_list_members executed (status=${trig2?.status})`)
    const snapLeader2 = await probeAgent({ label: 'leader#2', host: host1, kind: 'leader', marker: MK_L2, cookie: host1.cookie })
    writeFileSync(join(RUN_DIR, 'state-after-c4.json'), JSON.stringify(snapLeader2.stateBody, null, 2))
    const leader2Tools = mcpToolsOf(snapLeader2.req) ?? []
    const effLeader2 = effectiveMcpMap(snapLeader2.stateBody, ROOT, cfgNames)
    check('C4', 'after the next boundary, B is NOT mounted in the leader state (deny-first dispose)',
      effLeader2.map[SERVER_B].mounted === false, `leader eff post-override=${JSON.stringify(effLeader2.map)} shape=${effLeader2.shape}`)
    check('C4', 'B tool really GONE from the leader model-facing schema (A still present)',
      !leader2Tools.includes(TOOL_B) && leader2Tools.includes(TOOL_A),
      `leader mcp tools post-override=${JSON.stringify(leader2Tools)} (mock req seq=${snapLeader2.reqSeq})`)
    finishCriterion('C4')

    // ── C5: host restart (same home, resume) -> same effective set ─────────
    const preRestart = {
      [ROOT]: effectiveMcpMap(snapLeader2.stateBody, ROOT, cfgNames).map,
      [memberA.childSessionId]: effectiveMcpMap(snapM1.stateBody, memberA.childSessionId, cfgNames).map,
      [memberB.childSessionId]: effectiveMcpMap(snapM2.stateBody, memberB.childSessionId, cfgNames).map,
    }
    log(`C5: pre-restart effective sets: ${JSON.stringify(preRestart)}`)
    await stopHost(host1)
    host1 = null
    host2 = await bootHost({ label: 'HOST2-RESUME', port: hostPort, boot: 2, phase: 'resume', hostPort })
    const st2 = await p6t6StateReady(host2.port, { rootSessionId: ROOT, phase: 'resume' })
    log(`HOST2: state ready after restart (phase=resume teamSession=${st2.body?.teamSession?.blueprintId})`)
    const rSnapLeader = await probeAgent({ label: 'leader#R', host: host2, kind: 'leader', marker: MK_RL, cookie: host2.cookie })
    const rSnapM1 = await probeAgent({ label: 'member-1#R', host: host2, kind: memberA.instanceId, marker: MK_RM1, cookie: host2.cookie })
    const rSnapM2 = await probeAgent({ label: 'member-2#R', host: host2, kind: memberB.instanceId, marker: MK_RM2, cookie: host2.cookie })
    writeFileSync(join(RUN_DIR, 'state-after-c5.json'), JSON.stringify({
      leader: rSnapLeader.stateBody, member1: rSnapM1.stateBody, member2: rSnapM2.stateBody,
    }, null, 2))
    const postShaper = effectiveMcpMap(rSnapLeader.stateBody, ROOT, cfgNames)
    for (const [sid, preMap] of Object.entries(preRestart)) {
      const post = effectiveMcpMap(sid === ROOT ? rSnapLeader.stateBody : sid === memberA.childSessionId ? rSnapM1.stateBody : rSnapM2.stateBody, sid, cfgNames)
      const same = post.shape === postShaper.shape && JSON.stringify(post.map) === JSON.stringify(preMap)
      check('C5', `${labels[sid]}: post-restart effective set === pre-restart set (I5 shape)`,
        post.shape === 'i5-servers' && same,
        `pre=${JSON.stringify(preMap)} post=${JSON.stringify(post.map)} shape=${post.shape}`)
      // Model-facing re-proof for the leader (override survived the restart).
      if (sid === ROOT) {
        const rTools = mcpToolsOf(rSnapLeader.req) ?? []
        check('C5', 'leader model-facing MCP tools after restart == [A] (durable override survived)',
          rTools.length === 1 && rTools[0] === TOOL_A, `post-restart leader mcp tools=${JSON.stringify(rTools)}`)
      }
    }
    finishCriterion('C5')
    await stopHost(host2)
    host2 = null
  } finally {
    // ── teardown ───────────────────────────────────────────────────────────
    await sweepLiveHosts()
    if (miniA !== null) { await closeMini(miniA); log('mini MCP A closed') }
    if (miniB !== null) { await closeMini(miniB); log('mini MCP B closed') }
    if (mockRef.current !== null) { await mockRef.current.close(); log('mock model closed') }

    // ── C6: port release ───────────────────────────────────────────────────
    try {
      const frees = {}
      for (const [label, p] of [['host', hostPort], ['mcpA', PORT_A], ['mcpB', PORT_B], ['mock', MOCK_PORT]]) {
        frees[label] = await waitForPortFree(p, 20_000)
      }
      check('C6', `all run ports released after teardown (host=${hostPort} 3491 3492 ${MOCK_PORT})`,
        Object.values(frees).every(Boolean), JSON.stringify(frees))
    } catch (error) {
      check('C6', 'port release check completed', false, error.message)
    }
    finishCriterion('C6')

    // ── C7: test-use pristine + :3080 untouched ────────────────────────────
    try {
      const gitPostDir = join(RUN_DIR, 'git-post')
      mkdirSync(gitPostDir, { recursive: true })
      const gitPost = await captureGitState(HOST_TREE, gitPostDir)
      const stablePost = await probeStableInstance()
      writeFileSync(join(RUN_DIR, 'testuse-post.json'), JSON.stringify({ ...gitPost, at: new Date().toISOString() }, null, 2))
      writeFileSync(join(RUN_DIR, 'port3080-post.txt'), `# :3080 post-flight probe\nurl: ${STABLE_URL}\nhttpStatus: ${stablePost.status}\nat: ${new Date().toISOString()}\n`)
      check('C7', 'test-use worktree porcelain EMPTY after the run', gitPost.statusEmpty === true && gitPost.diffEmpty === true,
        `statusEmpty=${gitPost.statusEmpty} diffEmpty=${gitPost.diffEmpty} head=${gitPost.head}`)
      check('C7', `test-use HEAD still at baseline ${TEST_USE_BASELINE_SHA}`, gitPost.head === TEST_USE_BASELINE_SHA && gitPre.head === TEST_USE_BASELINE_SHA,
        `pre=${gitPre.head} post=${gitPost.head}`)
      check('C7', ':3080 untouched (read-only probe, status unchanged pre==post)', stablePre.status === stablePost.status,
        `pre=${stablePre.status} post=${stablePost.status}`)
    } catch (error) {
      check('C7', 'pristine/3080 check completed', false, error.message)
    }
    finishCriterion('C7')

    // ── home teardown (TEST_METHODS §7) ────────────────────────────────────
    let homeKept = false
    if (KEEP) {
      homeKept = true
      log(`--keep: home RETAINED as evidence at ${HOME} (registered in summary.json; TEST_METHODS §7)`)
    } else {
      rmSync(HOME, { recursive: true, force: true })
      try { rmSync(LOCK_FILE, { force: true }) } catch { /* gone with the home */ }
      log(`home deleted: ${HOME}`)
    }

    // ── summary ────────────────────────────────────────────────────────────
    const summary = {
      task: 'Task D multi-mcp dual mini-MCP real-host smoke',
      runStamp: RUN_STAMP,
      generatedAt: new Date().toISOString(),
      targetRepo: TARGET_REPO,
      hostTree: HOST_TREE,
      testUseBaseline: TEST_USE_BASELINE_SHA,
      ports: { host: hostPort, mcpA: PORT_A, mcpB: PORT_B, mock: MOCK_PORT },
      home: { path: HOME, kept: homeKept, lockFile: LOCK_FILE },
      servers: { [SERVER_A]: { port: PORT_A }, [SERVER_B]: { port: PORT_B } },
      modelPath: {
        used: 'mock-env',
        note: 'DEEPSEEK_BASE_URL=http://127.0.0.1:3496 + DEEPSEEK_API_KEY=mm-smoke-mock-key exported to host launches; every model call ran through the real dsh-llm adapter (t12-vertical pattern).',
        baseUrl: process.env.DEEPSEEK_BASE_URL,
      },
      members: { member1: memberA, member2: memberB },
      seed: seedRec,
      criteria: Object.values(results),
      pass: Object.values(results).every((r) => r.pass === true),
      exitCode: 0,
    }
    summary.exitCode = summary.pass ? 0 : 2
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
    writeFileSync(join(RUN_DIR, 'criterion-list.json'), JSON.stringify(Object.values(results), null, 2))
    log(`summary -> ${join(RUN_DIR, 'summary.json')}`)
    console.log(JSON.stringify(summary, null, 2))
    process.exitCode = summary.exitCode
  }
}

// ── fatal wrapper ───────────────────────────────────────────────────────────

process.on('SIGTERM', () => {
  log('SIGTERM received — best-effort teardown')
  sweepLiveHosts().then(() => process.exit(130)).catch(() => process.exit(130))
})
process.on('SIGINT', () => {
  log('SIGINT received — best-effort teardown')
  sweepLiveHosts().then(() => process.exit(130)).catch(() => process.exit(130))
})

main().catch((error) => {
  const msg = String(error?.stack ?? error)
  log(`FATAL (kit-level, run aborted): ${msg}`)
  // Record the partial criterion list so the failure is never silent.
  try {
    const summary = {
      task: 'Task D multi-mcp dual mini-MCP real-host smoke',
      runStamp: RUN_STAMP,
      generatedAt: new Date().toISOString(),
      targetRepo: TARGET_REPO,
      fatal: msg.slice(0, 4000),
      criteria: Object.values(results),
      pass: false,
      exitCode: 1,
    }
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
    writeFileSync(join(RUN_DIR, 'criterion-list.json'), JSON.stringify(Object.values(results), null, 2))
  } catch { /* RUN_DIR may not exist yet */ }
  console.log(JSON.stringify({ fatal: msg.slice(0, 2000), criteria: Object.values(results) }, null, 2))
  process.exit(1)
})
