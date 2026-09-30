#!/usr/bin/env node
/**
 * G6 ONE-OFF DIAGNOSTIC (PR-F closure, increment 2) — discriminates the
 * prf kit's G6 failure (no durable `artifact-read-granted` fact after the
 * 300KB bash spill on the leader-only spill team) into exactly one of:
 *
 *   (A) observer NOT installed on the TSPILL leader agent (the fresh-root
 *       setup's permission policy / control service / artifact-authority
 *       ref gate in agent-bindings.mjs L2324-2563) — witnessed by the
 *       p6t6 `observations` array lacking 'shell-result-observer installed'
 *   (B) the bash result carried NO stdout.spillPath (the spill itself did
 *       not happen upstream) — witnessed by the mock model request
 *       (the rendered tool result text carries '[output truncated;
 *       full output: <path>]' on a spilled stream, tool-bash render.ts
 *       L11-14) and by the world-local tmp tree (TMPDIR pinned to
 *       <world>/tmp, the strict-read-smoke pattern)
 *   (C) recordShellArtifact FAULTED (contained — no fact) — witnessed by
 *       'alpha2-artifact-grant: shell-record-failed ... <fault message>'
 *       in observations (the fault message names the step: resolve /
 *       stat / digest / durable put)
 *   (D) chain HEALTHY (the fact lands) — the kit failure was a
 *       run-specific flake
 *
 * World shape — faithful to the prf kit's B4 boot row composition
 * (dev/agent-workflow/evidence/pre-alpha3-refactor/pr-f/
 * prf-2026-09-30T04-48-23/instances/B4-RESTORE/): the production
 * dsh-agent-team row (WORKTREE dist host.js + glue + seam) + the p6t6
 * observability row + the `bare` preset (the kit's writeTeamPatchFile),
 * the THREE mini-MCPs configured on the row AND running (3491/3492/3493),
 * environmentFacts all available, the DEFAULT live substrate (no
 * presetSubstrate — the standard preset mounts dsh-tool-bash, the
 * spill-capable bash tool). Two deliberate diagnostic deltas (disclosed):
 *   1. a single CREATE boot instead of the kit's B1..B4 sequence — the
 *      TSPILL agent's setup path (createRootAgent fresh) is identical in
 *      both (durableSessionExists(TSPILL)=false either way);
 *   2. TMPDIR pinned to <world>/tmp for the host process (the strict-read
 *      smoke's E2 world-local spill-root pattern) so the subprocess
 *      spill files are RETAINED in the world as evidence — the failed
 *      kit runs left the spill root in the sandbox tmpdir (unverifiable
 *      post-run).
 *
 * Red lines honored: ports 3182-3186 host / 3491-3493 mini-MCP / 3497 mock
 * (NEVER 3080/3180); the world is RETAINED (--keep semantics: nothing is
 * deleted); evidence token-scrubbed; run.log EOF-clean; the stable
 * :3080/:3180 instances are probed read-only (pre/post parity).
 *
 * Retained artifacts: this run's evidence dir + the world under
 * tests/homes/.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, copyFileSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DshInstance, ensureProfile } from '../../../../../../tests/characterization/lib/instance.mjs'
import { startMockModel } from '../../../../../../packages/tools/harness/mock-deepseek.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../../tests/paths.mjs'

// ── frozen facts / paths ────────────────────────────────────────────────────

const THIS = fileURLToPath(import.meta.url)
const WORKTREE = join(dirname(THIS), '..', '..', '..', '..', '..', '..')
const TESTUSE = join(WORKTREE, 'tests', 'deepseek-harness-test-use')
const HOST_BASELINE_SHA = TEST_USE_BASELINE_SHA
// The test-use checkout is gitignored: it exists in the MAIN checkout, not
// in the task worktree — the kit's fallback (L255-259).
const TESTUSE_MAIN = resolve(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))
const HOST_TREE = existsSync(TESTUSE) ? TESTUSE : (existsSync(TESTUSE_MAIN) ? TESTUSE_MAIN : TESTUSE)
const PRODUCTION_ROW_PATH = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')
const GLUE_PATH = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_ROW_NAME = pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')).href
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href

// ── ports (TEST_METHODS §5; NEVER 3080/3180) ────────────────────────────────

const HOST_PORT_CANDIDATES = [3182, 3183, 3184, 3185, 3186]
const MOCK_PORT_CANDIDATES = [3497, 3496]
const PORT_REPO = 3492
const PORT_LEADERREQ = 3491
const PORT_WEB = 3493
const S_REPO = 'mcp_repo'
const S_LEADERREQ = 'mcp_leaderreq'
const S_WEB = 'mcp_web'
const S_SIGNAL = 'mcp_signal'
const STABLE_URLS = ['http://127.0.0.1:3080/', 'http://127.0.0.1:3180/']

// ── run stamp / world paths ─────────────────────────────────────────────────

function utcStamp() {
  const d = new Date().toISOString()
  return d.replace(/[:.]/g, '-').slice(0, 19)
}
const STAMP = utcStamp()
const RUN_STAMP = `g6diag-${STAMP}`
const EVI_DIR = dirname(THIS)
const RUN_DIR = join(EVI_DIR, RUN_STAMP)
const HOME = join(WORKTREE, 'tests', 'homes', RUN_STAMP)
const BLUEPRINT_DIR = join(HOME, 'blueprints')
const WORLD_TMP = join(HOME, 'tmp')

mkdirSync(RUN_DIR, { recursive: true })
const RUN_LOG = join(RUN_DIR, 'run.log')
let log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  writeFileSync(RUN_LOG, stamped + '\n', { flag: 'a' })
}

function die(msg) {
  log(`FATAL: ${msg}`)
  try { teardownAll() } catch { /* best effort */ }
  process.exit(1)
}

// ── spill team fixtures (the kit's EXACT G6 shape) ──────────────────────────

const NONCE = RUN_STAMP
const ROOT = `session-g6diag-boot-${RUN_STAMP}` // the row anchor's boot root
const TSPILL = `session-g6diag-spill-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.g6diag-anchor'
const BP_SPILL_ID = 'team.g6diag-spill'
const MK_SPILL = `G6DIAG_SPILL_${NONCE}`
const SPILL_COMMAND = "head -c 300000 /dev/zero | tr '\\0' 'x'" // 300KB stdout > 64KB cap
const SPILL_PROMPT =
  `${MK_SPILL} — run exactly one bash command for me: ${SPILL_COMMAND} — then tell me the approximate output size.`

const LEADER_TEAM_TOOLS = [
  'team_delegate', 'team_follow_up', 'team_create_member', 'team_collect',
  'team_send_message', 'team_report_progress', 'team_request_control',
  'team_resolve_control', 'team_list_pending_control', 'team_list_members',
  'team_list_templates', 'team_inspect_config', 'team_archive_member',
]
const UNMANAGED_BUILTINS = [
  'ask_user_question', 'create_goal', 'exit_plan_mode', 'get_goal',
  'glob', 'grep', 'interrupt_agent', 'job_kill', 'job_list', 'job_output',
  'list_agents', 'present', 'send_message', 'skill', 'subagent_fork',
  'update_goal', 'web_fetch', 'web_search', 'workflow',
]

const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 1',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  `  persona: ${JSON.stringify(`You are the leader of the G6 diagnostic boot team. ${NONCE} is the run nonce.`)}`,
  'members: []',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

function spillTeamBlueprintYaml() {
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${BP_SPILL_ID}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the G6 diagnostic spill team (nonce ${NONCE}). When given a work unit, do exactly what it says, then answer with the done marker.`)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    ...LEADER_TEAM_TOOLS.map((t) => `        - ${t}`),
    '    builtinToolDeny:',
    ...UNMANAGED_BUILTINS.map((t) => `      - ${t}`),
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: bash',
    '          resource:',
    '            kind: any',
    '      ask: []',
    '      deny: []',
    'members: []',
    'requirements: []',
    'teamEnvelope:',
    '  allow:',
    '    - bash',
    '  deny: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

// ── the production row config + profile-patch emitter (the kit's shape) ─────

const ROW_MCP_SERVERS = [
  { name: S_REPO, port: PORT_REPO },
  { name: S_LEADERREQ, port: PORT_LEADERREQ },
  { name: S_WEB, port: PORT_WEB },
]

function envFacts() {
  const f = []
  const add = (subject, available) => f.push({ domain: 'mcpServer', subject, available, generation: 1 })
  add(S_REPO, true)
  add(S_LEADERREQ, true)
  add(S_WEB, true)
  add(S_SIGNAL, true)
  return f
}

function teamRowConfig({ bootPhase, facts, mcpServers }) {
  return {
    rootSessionId: ROOT,
    bootPhase,
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: BLUEPRINT_DIR,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'g6diag-model' },
    deniedSelection: null,
    mcpServers,
    mcpServer: null,
    environmentFacts: facts,
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
  const lines = [
    `# G6 one-off diagnostic patch layer (world ${RUN_STAMP}): production dsh-agent-team row (WORKTREE dist — the branch's current build) + p6t6 observability row + the D-2a \`bare\` preset — the prf kit's B4 boot row composition (identical to tests/kits/pr-f-closure-smoke writeTeamPatchFile), mounted ONLY through the public profile-patch seam (CORE PATCH BUDGET = 0).`,
    `# ${comment}`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: rowConfig }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...yamlEmitItem({
      id: 'preset-bare',
      name: '@deepseek-ai/dsh-agent-preset',
      config: {
        id: 'bare',
        order: 9,
        plugins: [
          { id: 'agent-instructions', name: '@deepseek-ai/dsh-agent-instructions', config: { maxBytes: 65536 } },
        ],
      },
    }, 2),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

// ── small utils ─────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url, init, timeoutMs = 30_000) {
  let res
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    return { status: 0, body: null, error: String(error?.message ?? error) }
  }
  const text = await res.text().catch(() => '')
  let body = null
  try { body = text === '' ? null : JSON.parse(text) } catch { body = text }
  return { status: res.status, body, error: null }
}

async function probeStableInstance(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch((e) => ({ status: 0, error: String(e?.message ?? e) }))
  const text = await r.text().catch(() => '')
  return { status: r.status, length: text.length, head: text.slice(0, 200) }
}

async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
  const cookie = res.headers.get('set-cookie') ?? ''
  if (res.status !== 303) throw new Error(`authenticate: expected 303 (status=${res.status})`)
  if (!cookie) throw new Error(`authenticate: no set-cookie on 303`)
  return cookie.split(';')[0]
}

function scrubTokens(text) {
  return String(text)
    .replace(/\bsk-[A-Za-z0-9]{24,}/g, 'sk-REDACTED')
    .replace(/[?&]token=[A-Za-z0-9_-]{16,}/g, (m) => `${m[0]}token=REDACTED`)
    .replace(/\btoken=[A-Za-z0-9_-]{24,}/g, 'token=REDACTED')
}

async function portInUse(port) {
  try {
    const s = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1_500) })
    s.body?.cancel?.()
    return true
  } catch {
    return false
  }
}

async function pickPort(candidates) {
  for (const p of candidates) if (!(await portInUse(p))) return p
  return null
}

// ── the remote surface ──────────────────────────────────────────────────────

const EVID = { transcript: [] }

async function remoteCall(host, method, params, tag, version = 1, timeoutMs = 60_000) {
  const body = {
    type: 'client-request',
    rpcId: `${tag}-${randomUUID().slice(0, 8)}`,
    method,
    payload: { version, params },
  }
  const r = await fetchJson(`${host.origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: host.cookie },
    body: JSON.stringify(body),
  }, timeoutMs)
  const entry = {
    at: new Date().toISOString(),
    method,
    version,
    tag,
    status: r.status,
    error: r.error,
    ok: r.body?.result?.ok === true,
    code: r.body?.result?.ok === false ? r.body?.result?.error?.code : undefined,
    params: params ?? null,
    body: r.body,
  }
  EVID.transcript.push(entry)
  log(`remote ${method} v${version} [${tag}] -> ${r.status} ok=${entry.ok === true}${entry.code ? ` code=${entry.code}` : ''}`)
  return r
}

async function remoteCallReady(host, method, params, tag, version = 1, retries = 20, timeoutMs = 60_000) {
  let last = null
  for (let i = 0; i < retries; i += 1) {
    last = await remoteCall(host, method, params, tag, version, timeoutMs)
    if (last.status !== 429) return last
    await sleep(1500)
  }
  return last
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

function remoteValue(result, method) {
  if (result.status !== 200) throw new Error(`${method}: HTTP ${result.status}: ${scrubTokens(JSON.stringify(result.body).slice(0, 400))}`)
  const r = result.body?.result
  if (r === undefined) throw new Error(`${method}: no result envelope`)
  if (r.ok !== true) throw new Error(`${method}: remote error: ${scrubTokens(JSON.stringify(r.error ?? r).slice(0, 800))}`)
  const v = r.value
  if (v && typeof v === 'object' && 'data' in v && 'provenance' in v) return v.data
  return v
}

// ── the p6t6 seam ───────────────────────────────────────────────────────────

async function p6t6State(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 30_000)
}

async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}

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
      throw new Error(`row state not well-formed within ${timeoutMs}ms; last: status=${last.status} body=${JSON.stringify(last.body).slice(0, 400)}`)
    }
    await sleep(intervalMs)
    last = await p6t6State(port)
  }
}

// ── the durable ledger readers ──────────────────────────────────────────────

async function ledgerEntries(host, teamSessionId) {
  const entries = []
  let afterSequence = 0
  for (let pageNo = 0; pageNo < 100; pageNo += 1) {
    const page = await remoteCallReady(host, 'team.getLedgerPage', { teamSessionId, afterSequence, limit: 500 }, `ledger-p${pageNo}`, 1)
    const data = remoteValue(page, 'team.getLedgerPage')
    const pageEntries = Array.isArray(data?.entries) ? data.entries : []
    entries.push(...pageEntries)
    const next = data?.nextAfterSequence
    if (typeof next !== 'number' || pageEntries.length === 0) break
    afterSequence = next
  }
  return entries.sort((a, b) => (a?.sequence ?? 0) - (b?.sequence ?? 0))
}

function factEntries(entries, factType) {
  return entries.filter((e) => e?.factType === factType)
}

// ── the mock model oracle (the kit's spill logic, verbatim) ─────────────────

function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-g6diag-${randomUUID().slice(0, 8)}`, name, arguments: argumentsObj }] }
}

function makeDecide() {
  const toolCallCounts = {}
  const issueToolCall = (mk, tc) => {
    toolCallCounts[mk] = (toolCallCounts[mk] ?? 0) + 1
    if (toolCallCounts[mk] > 5) {
      log(`ORACLE loop guard: ${mk} issued >5 tool calls — breaking the loop`)
      return { kind: 'text', content: 'G6DIAG_LOOP_GUARD' }
    }
    return tc
  }
  return function decide({ req }) {
    const msgs = Array.isArray(req?.messages) ? req.messages : []
    const first = msgs[0]
    if (typeof first?.content === 'string' && first.content.startsWith('Create a concise title')) {
      return { kind: 'text', content: 'g6 diag session' }
    }
    let spillIdx = -1
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      const m = msgs[i]
      if (m?.role !== 'user') continue
      const t = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
      if (t.includes(MK_SPILL)) { spillIdx = i; break }
    }
    if (spillIdx !== -1) {
      if ((toolCallCounts[MK_SPILL] ?? 0) >= 1) {
        return { kind: 'text', content: `G6DIAG_DONE_SPILL_${NONCE}` }
      }
      log(`ORACLE spill round 0: bash (${SPILL_COMMAND.slice(0, 40)}...)`)
      return issueToolCall(MK_SPILL, toolCall('bash', { command: SPILL_COMMAND }))
    }
    return { kind: 'text', content: `G6DIAG_DEFAULT_ACK_${NONCE}` }
  }
}

// ── the mini-MCP servers (the kit's ping servers) ───────────────────────────

function miniMcpRpc(serverLabel, msg) {
  const { id, method, params } = msg ?? {}
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: serverLabel, version: '1.0.0' },
      },
    }
  }
  if (method === 'notifications/initialized') return null
  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: [
          {
            name: `ping`,
            description: `ping ${serverLabel}`,
            inputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] },
          },
        ],
      },
    }
  }
  if (method === 'tools/call') {
    const toolName = String(params?.name ?? '')
    if (toolName === 'ping') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: `pong:${serverLabel}:${String(params?.arguments?.msg ?? '?')}` }],
          isError: false,
        },
      }
    }
    return { jsonrpc: '2.0', id, error: { code: -32601, message: `unknown tool ${toolName}` } }
  }
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${String(method)}` } }
}

async function startMiniMcp(port, label) {
  const { createServer } = await import('node:http')
  const server = createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405).end()
      return
    }
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      let msg = null
      try { msg = JSON.parse(raw || 'null') } catch { /* null */ }
      const reply = miniMcpRpc(label, msg)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(reply === null ? '' : JSON.stringify(reply))
    })
  })
  await new Promise((resolveP, rejectP) => {
    server.once('error', rejectP)
    server.listen(port, '127.0.0.1', () => resolveP())
  })
  log(`mini MCP ${label} up on 127.0.0.1:${port}`)
  return { port, server }
}

async function stopMiniMcp(mini, label) {
  if (mini === null) return
  await new Promise((r) => mini.server.close(r))
  log(`mini MCP ${label ?? mini.port} stopped on 127.0.0.1:${mini.port}`)
}

function msgContentHas(m, needle) {
  const c = m?.content
  const t = typeof c === 'string' ? c : JSON.stringify(c ?? '')
  return t.includes(needle)
}

// ── world boot / stop ───────────────────────────────────────────────────────

let host = null
const liveMinis = []
let MOCK = null

function assertFreshHome(homePath, label) {
  if (existsSync(homePath)) {
    const entries = readdirSync(homePath)
    if (entries.length > 0) {
      die(`${label}: DSH home ${homePath} exists and is non-empty (${entries.length} entries) — fail CLOSED; delete it to re-run`)
    }
  }
  mkdirSync(homePath, { recursive: true })
}

async function bootHost({ port }) {
  const instLogDir = join(RUN_DIR, 'instances', 'B1-CREATE')
  mkdirSync(instLogDir, { recursive: true })
  const instance = new DshInstance({
    hostTree: HOST_TREE,
    dshHome: HOME,
    port,
    clientCommitHash: CLIENT_COMMIT_HASH,
    logDir: instLogDir,
  })
  const rec = { label: 'B1-CREATE', port, instance, logPath: null, url: null, token: null, cookie: null, origin: null, health: null, dumpText: null }
  const rowConfig = teamRowConfig({ bootPhase: 'create', facts: envFacts(), mcpServers: ROW_MCP_SERVERS })
  writeTeamPatchFile(instance.patchFile, rowConfig, 'single create boot (the TSPILL fresh-agent setup path is boot-phase-independent)')
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot: 1,
    phase: 'create',
    reportDir: RUN_DIR,
    runStamp: RUN_STAMP,
    kitBoot: 1,
    rootSessionId: ROOT,
    mcpPort: PORT_LEADERREQ,
  }, null, 2))
  log(`B1-CREATE: patch written (bootPhase=create, facts=all-true, mcp=${JSON.stringify(ROW_MCP_SERVERS)}) + directive`)
  const started = await instance.start({ timeoutMs: 240_000 })
  rec.url = started.url
  rec.logPath = started.logPath
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(started.url)
  if (m === null) die(`B1-CREATE: unexpected boot url shape: ${scrubTokens(started.url)}`)
  rec.token = m[2]
  rec.origin = `http://127.0.0.1:${m[1]}`
  const bare = await fetch(`http://127.0.0.1:${m[1]}/`, { signal: AbortSignal.timeout(15_000) }).catch(() => null)
  log(`B1-CREATE: bare GET / -> ${bare === null ? 'unreachable' : bare.status} (expected 401 = launch-token gate)`)
  rec.cookie = await authenticate(rec.origin, rec.token)
  log(`B1-CREATE: booted at ${rec.origin}; auth cookie exchanged`)
  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  rec.dumpText = dump.text
  writeFileSync(join(RUN_DIR, 'instances', 'B1-CREATE', 'dump-config.txt'), dump.text)
  if (!DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME })) {
    die(`B1-CREATE: production row not in composed profile dump`)
  }
  if (!DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: P6T6_ROW_NAME })) {
    die(`B1-CREATE: p6t6 row not in composed profile dump`)
  }
  const deadline = Date.now() + 240_000
  for (;;) {
    const hb = await p6t6Health(port)
    rec.health = { status: hb.status, body: hb.body }
    if (hb.status === 200 && hb.body?.ok === true) break
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      die(`B1-CREATE: row setup failed — setupError: ${String(hb.body.setupError).slice(0, 600)}`)
    }
    if (Date.now() >= deadline) {
      die(`B1-CREATE: row health not ready in 240s — health=${JSON.stringify(hb.body).slice(0, 400)}`)
    }
    await sleep(1000)
  }
  host = rec
  log(`B1-CREATE: row ready — toolCount=${rec.health.body?.toolCount}`)
  return rec
}

function teardownAll() {
  return (async () => {
    if (host !== null) {
      try {
        const res = await host.instance.stop({ timeoutMs: 20_000 })
        log(`host stopped (killed=${res.killed} portFree=${res.portFree})`)
      } catch (error) {
        log(`host stop error: ${error.message}`)
      }
      host = null
    }
    for (const [mini, label] of [...liveMinis]) {
      try { await stopMiniMcp(mini, label) } catch (error) { log(`mini stop error: ${error.message}`) }
    }
    liveMinis.length = 0
    if (MOCK !== null) {
      try { await MOCK.close() } catch { /* ignore */ }
      MOCK = null
    }
  })()
}

// ── the main diagnostic ─────────────────────────────────────────────────────

const VERDICT = {}

async function main() {
  log(`=== G6 one-off diagnostic (PR-F closure, increment 2) ===`)
  log(`runStamp=${RUN_STAMP} worktree=${WORKTREE}`)
  log(`host baseline sha=${HOST_BASELINE_SHA} (paths.mjs pin)`)

  // Preflight: test-use pristine + HEAD baseline.
  const { execFileSync } = await import('node:child_process')
  const git = (args) => execFileSync('git', ['-C', HOST_TREE, ...args], { encoding: 'utf8' }).trim()
  const preHead = git(['rev-parse', 'HEAD'])
  const prePorcelain = git(['status', '--porcelain'])
  log(`test-use preflight: head=${preHead} porcelainEmpty=${prePorcelain === ''}`)
  if (preHead !== HOST_BASELINE_SHA) die(`test-use HEAD ${preHead} != baseline ${HOST_BASELINE_SHA}`)
  if (prePorcelain !== '') die(`test-use worktree NOT pristine (porcelain non-empty)`)

  const stableBefore = {}
  for (const u of STABLE_URLS) stableBefore[u] = await probeStableInstance(u)
  log(`stable pre-probes: ${STABLE_URLS.map((u) => `${new URL(u).port}=${stableBefore[u].status}`).join(' ')}`)

  const hostPort = await pickPort(HOST_PORT_CANDIDATES)
  if (hostPort === null) die(`no free host port in ${HOST_PORT_CANDIDATES.join(',')}`)
  const mockPort = await pickPort(MOCK_PORT_CANDIDATES)
  if (mockPort === null) die(`no free mock port in ${MOCK_PORT_CANDIDATES.join(',')}`)
  for (const [label, p] of [['repo', PORT_REPO], ['leaderreq', PORT_LEADERREQ], ['web', PORT_WEB]]) {
    if (await portInUse(p)) die(`port ${label}=${p} already in use — refusing to start`)
  }
  log(`ports: host=${hostPort} mock=${mockPort} mcpRepo=${PORT_REPO} mcpLeaderreq=${PORT_LEADERREQ} mcpWeb=${PORT_WEB}`)

  assertFreshHome(HOME, 'g6diag world')
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'g6diag-anchor.yaml'), BP_ANCHOR_YAML)
  writeFileSync(join(BLUEPRINT_DIR, 'g6diag-spill.yaml'), spillTeamBlueprintYaml())
  // Diagnostic delta #2: the host's TMPDIR -> the world tmp (the strict-read
  // smoke's E2 world-local spill-root pattern; the host child inherits
  // process.env at spawn — set BEFORE bootHost).
  mkdirSync(WORLD_TMP, { recursive: true })
  const prevTmpdir = process.env.TMPDIR
  process.env.TMPDIR = WORLD_TMP
  log(`world materialized: home=${HOME} blueprints=${BLUEPRINT_DIR} TMPDIR pinned ${prevTmpdir ?? '(unset)'} -> ${WORLD_TMP}`)

  const mockLogPath = join(RUN_DIR, 'mock.log')
  MOCK = await startMockModel({
    port: mockPort,
    decide: makeDecide(),
    log: (msg) => { try { writeFileSync(mockLogPath, `${msg}\n`, { flag: 'a' }) } catch { /* ignore */ } },
  })
  if (MOCK.port !== mockPort) die(`mock model landed on ${MOCK.port}, expected ${mockPort}`)
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK.port}`
  process.env.DEEPSEEK_API_KEY = 'g6diag-mock-key'
  log(`mock DeepSeek endpoint up at 127.0.0.1:${MOCK.port}`)
  liveMinis.push([await startMiniMcp(PORT_REPO, S_REPO), S_REPO])
  liveMinis.push([await startMiniMcp(PORT_LEADERREQ, S_LEADERREQ), S_LEADERREQ])
  liveMinis.push([await startMiniMcp(PORT_WEB, S_WEB), S_WEB])

  try {
    // web profile (throwaway boot if first use)
    await ensureProfile({
      instance: new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port: hostPort, clientCommitHash: CLIENT_COMMIT_HASH, logDir: join(RUN_DIR, 'instances', 'profile-init') }),
      log,
      timeoutMs: 180_000,
    })
    log('web profile ensured (throwaway boot if first use)')

    await bootHost({ port: hostPort })
    await p6t6StateReady(hostPort, { rootSessionId: ROOT, phase: 'create' })

    // ── the G6 action: team.create v1 + initialWork (the kit's exact call) ──
    const createSpill = await remoteCallReady(host, 'team.create', {
      rootSessionId: TSPILL, blueprintId: BP_SPILL_ID,
      initialWork: { prompt: SPILL_PROMPT },
    }, 'g6-create', 1, 10, 240_000)
    const csErr = resultError(createSpill.body)
    const csOk = csErr === null
    log(`team.create (TSPILL) -> ok=${csOk}${csOk ? '' : ` code=${String(csErr.code)} msg=${scrubTokens(String(csErr.message ?? '')).slice(0, 300)}`}`)
    writeFileSync(join(RUN_DIR, 'diag-create-response.json'), JSON.stringify(createSpill.body, null, 2))

    // ── probe (a): the p6t6 state immediately after create (observations =
    //    the observer install / record-fault witness) ──
    const stateAfterCreate = await p6t6State(hostPort)
    writeFileSync(join(RUN_DIR, 'diag-state-after-create.json'), JSON.stringify(stateAfterCreate.body ?? stateAfterCreate, null, 2))
    const obsCreate = Array.isArray(stateAfterCreate.body?.observations) ? stateAfterCreate.body.observations : []
    log(`observations after create (${obsCreate.length}): ${JSON.stringify(obsCreate).slice(0, 1200)}`)

    // ── probe (b): the mock's in-memory request log (the model-facing tool
    //    result = the rendered canonical value; '[output truncated; full
    //    output: <path>]' iff the bash stream spilled, tool-bash render.ts) ──
    const mockDump = MOCK.requests.map((r) => ({
      seq: r.seq,
      method: r.method,
      path: r.path,
      receivedAt: r.receivedAt,
      status: r.status,
      error: r.error ?? null,
      reply: r.reply ?? null,
      body: r.body,
    }))
    writeFileSync(join(RUN_DIR, 'diag-mock-requests.json'), scrubTokens(JSON.stringify(mockDump, null, 2)))
    const doneSpillReq = mockDump.find((r) => r.reply?.kind === 'text' && String(r.reply.content).includes(`G6DIAG_DONE_SPILL_${NONCE}`))
    const turnCompleted = doneSpillReq !== undefined
    // the request AFTER the bash tool call carries the tool result as a
    // user-role message; find any message with the truncation notice.
    let spillRef = null
    for (const r of mockDump) {
      const msgs = r.body?.messages ?? []
      for (const m of msgs) {
        const t = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
        const at = t.indexOf('[output truncated; full output: ')
        if (at !== -1) {
          spillRef = { seq: r.seq, excerpt: scrubTokens(t.slice(Math.max(0, at - 120), at + 240)) }
          break
        }
      }
      if (spillRef !== null) break
    }
    log(`mock requests captured: ${mockDump.length}; turnCompleted=${turnCompleted}; toolResultSpillRef=${spillRef === null ? 'none' : 'present'}`)

    // ── probe (c): the world-local tmp tree (the subprocess spill files) ──
    const tmpTree = []
    const walk = (dir, depth) => {
      if (depth > 6) return
      let entries = []
      try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
      for (const e of entries) {
        const p = join(dir, e.name)
        if (e.isDirectory()) { tmpTree.push(`${p}/`); walk(p, depth + 1) }
        else {
          let size = null
          try { size = statSync(p).size } catch { /* ignore */ }
          tmpTree.push(`${p} (${size}B)`)
        }
      }
    }
    walk(WORLD_TMP, 0)
    writeFileSync(join(RUN_DIR, 'diag-world-tmp-tree.json'), JSON.stringify(tmpTree, null, 2))
    const spillFiles = tmpTree.filter((l) => l.includes('dsh-subprocess-') && !l.endsWith('/'))
    log(`world tmp tree: ${tmpTree.length} entries; subprocess spill files: ${spillFiles.length}`)
    for (const line of spillFiles.slice(0, 4)) {
      const p = line.split(' ')[0]
      try {
        const head = readFileSync(p, 'utf8').slice(0, 512).replace(/x/g, '*')
        writeFileSync(join(RUN_DIR, `diag-spill-head-${line.split('/').pop()}.txt`), `${p}\nsize=${line.split('(')[1]}\nfirst512(x->*):\n${head}\n`)
      } catch (error) {
        log(`spill head read error for ${p}: ${error.message}`)
      }
    }

    // ── probe (d): the durable grant fact (the kit's 120s settle budget) ──
    const settleStart = Date.now()
    let grantEntry = null
    let settleMs = null
    while (Date.now() - settleStart < 120_000) {
      const entries = await ledgerEntries(host, TSPILL)
      grantEntry = factEntries(entries, 'artifact-read-granted').pop() ?? null
      if (grantEntry !== null) { settleMs = Date.now() - settleStart; break }
      await sleep(1_500)
    }
    log(`ledger settle: grants=${grantEntry === null ? 0 : 1} settleMs=${settleMs}`)

    // ── probe (e): the p6t6 state after settle (late observations) ──
    const stateAfterSettle = await p6t6State(hostPort)
    writeFileSync(join(RUN_DIR, 'diag-state-after-settle.json'), JSON.stringify(stateAfterSettle.body ?? stateAfterSettle, null, 2))

    // ── the full TSPILL ledger (the complete durable record) ──
    const spillLedger = await ledgerEntries(host, TSPILL)
    writeFileSync(join(RUN_DIR, 'diag-tspill-ledger.json'), JSON.stringify(spillLedger, null, 2))

    // ── the determination ──
    const obsSettle = Array.isArray(stateAfterSettle.body?.observations) ? stateAfterSettle.body.observations : []
    const allObs = [...new Set([...obsCreate, ...obsSettle])]
    const observerInstalled = allObs.some((o) => o.includes('shell-result-observer installed'))
    const recordFaults = allObs.filter((o) => o.includes('shell-record-failed'))
    const locator = grantEntry?.payload?.locator
    const grantShape = grantEntry !== null
      && grantEntry.payload?.instanceId === 'inst-leader'
      && grantEntry.payload?.source?.kind === 'shell-foreground'
      && grantEntry.payload?.source?.toolName === 'bash'
      && (typeof locator === 'string' && locator.length > 0 || typeof locator === 'object' && locator !== null)

    let determination
    if (csOk && grantShape) {
      determination = 'D: chain HEALTHY — the durable artifact-read-granted fact landed (the kit failure was a run-specific flake)'
    } else if (!csOk) {
      determination = 'UNDIAGNOSED: team.create itself failed (see diag-create-response.json)'
    } else if (!observerInstalled) {
      determination = 'A: observer NOT installed on the TSPILL leader agent (fresh-root setup gate: permission policy / control service / artifact-authority ref)'
    } else if (recordFaults.length > 0) {
      determination = `C: recordShellArtifact FAULTED (contained — no fact): ${recordFaults.join(' | ').slice(0, 400)}`
    } else if (spillRef === null && spillFiles.length === 0) {
      determination = 'B: the bash result carried NO stdout.spillPath and NO subprocess spill file exists — the spill itself did not happen upstream (300KB < the effective inline cap on this world shape)'
    } else {
      determination = 'UNDIAGNOSED: observer installed + spill evidence present but no fact and no recorded fault — see diag-state-*.json observations + diag-mock-requests.json'
    }
    VERDICT.determination = determination
    VERDICT.createOk = csOk
    VERDICT.turnCompleted = turnCompleted
    VERDICT.observerInstalled = observerInstalled
    VERDICT.recordFaults = recordFaults
    VERDICT.toolResultSpillRef = spillRef
    VERDICT.worldSpillFiles = spillFiles
    VERDICT.grant = grantEntry?.payload ?? null
    VERDICT.grantShape = grantShape
    VERDICT.settleMs = settleMs
    VERDICT.observations = allObs
    writeFileSync(join(RUN_DIR, 'diag-verdict.json'), scrubTokens(JSON.stringify(VERDICT, null, 2)))
    log(`DETERMINATION: ${determination}`)
    log(`  createOk=${csOk} turnCompleted=${turnCompleted} observerInstalled=${observerInstalled} recordFaults=${recordFaults.length} spillRef=${spillRef === null ? 'none' : 'present'} worldSpillFiles=${spillFiles.length} grant=${grantEntry === null ? 'none' : 'yes (shape=' + grantShape + ')'} settleMs=${settleMs}`)
  } finally {
    await teardownAll()
  }

  // Stable-instance post-parity (read-only probes).
  const stableAfter = {}
  for (const u of STABLE_URLS) stableAfter[u] = await probeStableInstance(u)
  const stableUnchanged = STABLE_URLS.every((u) => stableBefore[u].status === stableAfter[u].status && stableBefore[u].length === stableAfter[u].length)
  log(`stable post-probes: ${STABLE_URLS.map((u) => `${new URL(u).port}=${stableAfter[u].status}`).join(' ')} unchanged=${stableUnchanged}`)
  writeFileSync(join(RUN_DIR, 'stable-probes.json'), JSON.stringify({ before: stableBefore, after: stableAfter, unchanged: stableUnchanged }, null, 2))

  // Port release witness.
  const released = []
  for (const p of [hostPort, mockPort, PORT_REPO, PORT_LEADERREQ, PORT_WEB]) {
    released.push({ port: p, free: !(await portInUse(p)) })
  }
  log(`port release: ${JSON.stringify(released)}`)
  writeFileSync(join(RUN_DIR, 'ports-released.json'), JSON.stringify(released, null, 2))

  // run.log EOF hygiene: exactly one trailing newline (no trailing blank line).
  const raw = readFileSync(RUN_LOG, 'utf8')
  if (raw.endsWith('\n\n')) writeFileSync(RUN_LOG, raw.replace(/\n+$/, '\n'))

  log(`=== diagnostic complete (world RETAINED at ${HOME}; evidence at ${RUN_DIR}) ===`)
  log(`EXIT=0`)
  process.exit(0)
}

main().catch((error) => {
  log(`UNCAUGHT: ${error?.stack ?? String(error)}`)
  teardownAll().catch(() => {}).finally(() => process.exit(1))
})
