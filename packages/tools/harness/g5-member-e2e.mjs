#!/usr/bin/env node
/**
 * g5-member-e2e.mjs — G5A (Team D1-D6 repair v2, final wave) LIVE-HOST
 * MEMBER E2E acceptance runner: the plan 15.1 acceptance-matrix row
 * "D1 member tools" (member base file/shell tools + the ten team_* tools
 * + REAL tool calls, ordinary session non-regression), plus the live
 * checks for the D2 structured result and the D3 member identity block.
 *
 * A standalone runner that EXTENDS the PATTERN of
 * packages/tools/harness/d4-restart-reopen.mjs (itself the byte-identical
 * t12-vertical.mjs precedent): the same public profile-patch seam, the
 * same production dist host row (this worktree's committed D1-D4 build —
 * G5A changes NO install surface, so no rebuild), the same DshInstance
 * boot chain (file-fd stdio only — TEST_METHODS §5), the same p6t6-team-
 * tools observability row, the same multi-frame zstd durable-log reader,
 * and the same deterministic local DeepSeek-compatible mock
 * (mock-deepseek.mjs) reached only via the launch environment
 * (DEEPSEEK_BASE_URL / DEEPSEEK_API_KEY), so every model call goes
 * through the real dsh-llm adapter + SSE + agent loop + durable session
 * log.
 *
 * SCENARIO (plan 15.1 D1 row + the D2/D3 live checks) — executed on the
 * shared TEST_METHODS test host:
 *   source: references/deepseek-harness-test-use (pristine @ 76fda729)
 *   home:   references/.dsh-test (SHARED test home; pre-existing roots
 *           are NOT destroyed and are enumerated as part of S1)
 *   port:   3180 (one boot; the port is verified free before — polling
 *           up to 20 min when busy, a never-free port is DEFERRED — and
 *           after the boot)
 *
 *   S0 pre-flight + control fixtures: test-use pristine (porcelain empty
 *      + HEAD), the stable :3080 read-only probe (no operation), the
 *      committed dist host row exists + the dynamic-import probe, the
 *      node_modules junction wiring (D4 pattern; the worktree has also
 *      had `pnpm install --ignore-scripts` per the task), the shared
 *      home's pre-existing roots recorded, port 3180 verified free, the
 *      mock model started, and the member workspace + the unique control
 *      file pre-created (S4a's read target, inside the runner-owned
 *      evidence run dir).
 *   S1 BOOT 1 on 3180 + team root via the PUBLIC remote channel: the
 *      row-phase 'create' boot materializes ROOT_A (the directive root)
 *      live; ROOT_B is created over the browser-facing public remote
 *      channel POST /team-remote/team.create (contract v2 — the
 *      UI-equivalent programmatic path the Team UI New-Team entry
 *      uses; D4/t12 boot+drive precedent).
 *   S2 MEMBER PROVISIONING (the public surface used — cited): there is
 *      NO team.* remote method that creates a member (the public remote
 *      surface at base 3b53e40 is team.create / team.admitInitialWork /
 *      team.listRoots / team.ensureRootLive / team.getProjection /
 *      team.getLedgerPage — packages/runtime/src/plugin/s6-remote.ts,
 *      read by G5A). The CANONICAL path is therefore the Leader
 *      `team_create_member` tool via a REAL Leader turn: a real
 *      POST /api/session/prompt on ROOT_B whose mock-replied tool call
 *      executes team_create_member over the real runtime. The member
 *      ends as a LIVE child agent bound to ROOT_B (the durable
 *      MemberInstance row, the native session artifact with the member-
 *      workspace cwd, and the health liveSessions list).
 *   S3 MEMBER TOOL TABLE: from the real model request to the member
 *      agent (mock capture — the real dsh-llm adapter wire), the member
 *      sees BOTH the ordinary base tools (the standard preset's file-
 *      read tool and the win32 shell tool — the ACTUAL names are
 *      enumerated from the capture) AND exactly the ten team_* tools.
 *   S4 MEMBER REAL TOOL CALLS: three real member turns, each driven over
 *      the public member-session prompt path POST /api/session/prompt on
 *      the member's child session (the session controller's resolve()
 *      PREFERS the live agent — packages/api/session-controller/src/
 *      agent.ts `resolve()`: while the member is resident, its live
 *      team-composed agent handles the turn):
 *        (a) 'read' of the pre-created control file inside the member
 *            workspace — the content round-trips into the tool result
 *            (mock capture + the durable member session log);
 *        (b) 'pwsh' pwd — the output is the expected member workspace
 *            path (mock capture + the durable member session log);
 *        (c) team_report_progress — the captured tool call carries the
 *            OWNING rootSessionId (ROOT_B) and a FRESH unique
 *            requestToken; the tool result settles (mock capture + the
 *            durable member session log).
 *      All three are real executions: tool/call + tool/result events are
 *      present in the durable member session log, correlated by callId.
 *   S5 D2 LIVE RESULT: a delegated work item on that member — a real
 *      Leader turn on ROOT_B whose mock-replied tool call executes
 *      team_delegate (the continue form, the existing member instance).
 *      The Leader-facing ACTION RESULT — read through the same public
 *      seam the Leader model sees it (the Leader's own real model
 *      request, whose role=tool message carries the tool result; the
 *      durable ROOT_B log carries the same) — carries the C1/C2 frozen
 *      structured result: the tool layer's {status:'executed', effect}
 *      with effect.memberResult = {requestToken, status:'succeeded',
 *      body:<the member business body>} (C2 requirement 1: deliver()
 *      returns the frozen WorkDeliveryResult; the work-admitted effect
 *      copies memberResult on the delegate/follow-up path).
 *   S6 D3 LIVE IDENTITY: from the member model-request messages (mock
 *      capture), the agent-scoped prompt (the system text) contains the
 *      B2 scoped team-member-context block with the OWNING root session
 *      id (ROOT_B), the member OWN instanceId, role=member, and the
 *      fresh-requestToken rule line — verbatim.
 *   S7 ORDINARY SESSION NON-REGRESSION: an ordinary (non-Team) session
 *      on the same host, created over the public
 *      POST /api/session/create; its session-local model selection is
 *      steered at the mock-reachable provider over the public
 *      POST /api/session/selectModel seam (deepseek-official — the same
 *      provider the team row drives; the deepseek adapter's resolveModel
 *      is a local lookup, no provider I/O), so its tool table is
 *      captured from the REAL model request: NO team_* tool is present
 *      (while the standard preset's 'read'/'pwsh' are), and a basic turn
 *      completes (durable log). The deployment default model is restored
 *      afterwards (selectModel back to qiyuan-self/qwen3.8-27b — the
 *      test home's only real provider).
 *   S8 CLEANUP: host stopped, port 3180 free, host process gone, test-
 *      use pristine (porcelain empty + HEAD unchanged), the mock capture
 *      + summary.json written.
 *
 * HARD BOUNDARIES: no product code changes (this runner + the evidence
 * dir only); the stable :3080 instance and D:\deepseek-harness are never
 * touched (read-only probe only); references/deepseek-harness-test-use
 * stays pristine (verified before AND after); no host process is left
 * behind; the shared home accumulates this run's nonce roots like every
 * previous run (never destroyed).
 *
 * Usage: node g5-member-e2e.mjs --report-dir <dir>
 */

import { createHash, randomBytes } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import net from 'node:net'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

import { DshInstance, ensureProfile } from '../../../tests/characterization/lib/instance.mjs'
import {
  logTail,
  spawnToLog,
  walk,
  waitForPortFree,
} from '../../../tests/characterization/lib/util.mjs'
import { captureGitState } from '../../../tests/characterization/lib/tree-clean.mjs'
import { startMockModel } from './mock-deepseek.mjs'

// ── paths & constants ──────────────────────────────────────────────────────

const HERE = import.meta.dirname
const WORKTREE_ROOT = resolve(HERE, '..', '..', '..')

/** Walk up from the worktree to the ancestor containing references/. */
function findRepoRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'references', 'deepseek-harness-test-use'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} contains references/deepseek-harness-test-use`)
    dir = parent
  }
}

const REPO_ROOT = findRepoRoot(WORKTREE_ROOT)
const HOST_TREE = join(REPO_ROOT, 'references', 'deepseek-harness-test-use')

const argv = process.argv.slice(2)
const reportDirArg = argv.find((a, i) => argv[i - 1] === '--report-dir')
if (reportDirArg === undefined) throw new Error('usage: node g5-member-e2e.mjs --report-dir <dir>')
const REPORT_DIR = resolve(reportDirArg)

const CLIENT_COMMIT_HASH = '76fda72979'
const STABLE_URL = 'http://127.0.0.1:3080/'
const EXPECTED_HOST_SHA = '76fda729799fe9b3848dbe2c211d4b231032b81e'

const PRODUCTION_ROW_ID = 'dsh-agent-team'
const PRODUCTION_ROW_NAME = pathToFileURL(
  join(WORKTREE_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js'),
).href
const P6T6_ROW_ID = 'p6t6-team-tools'
const P6T6_ROW_NAME = pathToFileURL(join(HERE, 'plugin.mjs')).href
const GLUE_URL = pathToFileURL(
  join(WORKTREE_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'),
).href
const SEAM_URL = pathToFileURL(
  join(WORKTREE_ROOT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs'),
).href

const PORT = 3180
const DSH_HOME = join(REPO_ROOT, 'references', '.dsh-test')
// The shared home's workspace registry holds exactly ONE registered
// workspace: the repo root itself. The v2 remote team.create validates the
// workspace parameter against the registry, so the scenario's team works
// in the registered workspace (the real Team-UI "new team" shape). The
// MEMBER's workspace is a runner-owned dir under the evidence run dir,
// passed explicitly through team_create_member's `workspace` field (the
// child factory honors request.workspace over the team default — T12-M1,
// agent-bindings.mjs createChildSession).
const WORKSPACE = REPO_ROOT
const PORT_WAIT_MAX_MS = 20 * 60_000

const NONCE = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
const RUN_STAMP = NONCE
const ROOT_A = `session-g5a-a-${NONCE}`
const ROOT_B = `session-g5a-b-${NONCE}`
const ORDINARY = `session-g5a-ord-${NONCE}`
const BLUEPRINT_ID = 'g5a-bp'
const BLUEPRINT_REVISION = '1' // blueprint doc revision (string, YAML scalar)
const BLUEPRINT_REVISION_NUM = 1 // remote param shape: blueprintRevision is a number (params.ts)
const LEADER_INSTANCE_ID = 'inst-leader'
const EXPECTED_TOOL_COUNT = 10
const MODEL_PROVIDER = 'deepseek-official'
const MODEL_ID = 'g5a-model'
const ORDINARY_DEFAULT_PROVIDER = 'qiyuan-self'
const ORDINARY_DEFAULT_MODEL = 'qwen3.8-27b'

// The member workspace + control file (pre-created before boot; the S4a
// read target). Lives inside this run's evidence dir, never in a tree that
// is pristine-asserted.
const MEMBER_WS = join(REPORT_DIR, 'member-workspace')
const CONTROL_FILE = join(MEMBER_WS, `g5a-control-${NONCE}.txt`)
const CONTROL_TOKEN = `G5A-CONTROL-TOKEN-${NONCE}`
const CONTROL_CONTENT = `${CONTROL_TOKEN}: member base file tool round-trip sentinel; the quick brown fox jumps over the lazy dog 1234567890.`
const WORK_BODY = `G5A-WORK-BODY-${NONCE}: delegated work unit completed — the control sentinel is ${CONTROL_TOKEN}.`

/** Turn markers (the mock model decides deterministically on them). */
const MC = `G5A-MC-${NONCE}` // Leader turn: create the member (team_create_member)
const MW = `G5A-MW-${NONCE}` // Leader turn: delegate the work unit (team_delegate)
const MF = `G5A-MF-${NONCE}` // member turn: real file read
const MP = `G5A-MP-${NONCE}` // member turn: real pwd
const MT = `G5A-MT-${NONCE}` // member turn: real team_* call (team_report_progress)
const MO = `G5A-MO-${NONCE}` // ordinary session turn

/** Fresh unique request tokens (per-run; the S4c one rides in the prompt text). */
const CREATE_TOK = `g5a-create-${NONCE}-tok`
const WORK_TOK = `g5a-work-${NONCE}-tok`
const MT_TOK = `g5a-memteam-${NONCE}-tok`

/** The closed ten team_* tools (packages/tools/src/tools.ts). */
const TEAM_TOOLS = [
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_create_member',
  'team_delegate',
  'team_follow_up',
  'team_send_message',
  'team_report_progress',
  'team_request_control',
  'team_resolve_control',
]

/**
 * The B2 scoped member identity block (D3; packages/runtime/src/plugin/
 * live/agent-bindings.mjs memberTeamContextBlock) — asserted verbatim in
 * S6 with the owning root + the member's own instance id.
 */
function memberBlock(rootSessionId, instanceId) {
  return (
    `[team-member-context rootSessionId="${rootSessionId}" instanceId="${instanceId}" role="member"]\n`
    + `Every team_* tool call must include rootSessionId="${rootSessionId}" and a fresh unique requestToken; `
    + "do not use another team's rootSessionId or another member's instanceId."
  )
}

const BLUEPRINT_DOC = [
  '---',
  'schemaVersion: 1',
  `blueprintId: ${BLUEPRINT_ID}`,
  `revision: "${BLUEPRINT_REVISION}"`,
  'leader:',
  '  templateId: leader',
  '  persona: "G5A leader: you lead the g5a live-host member acceptance team."',
  'members:',
  '  - templateId: worker',
  '    displayName: "G5A Worker"',
  '    persona: "G5A worker persona: you are the deterministic g5a worker member."',
  'requirements:',
  '  - domain: persona',
  '    name: standard',
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
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: "The g5a default state."',
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

// ── logging / scenario plumbing ────────────────────────────────────────────

mkdirSync(REPORT_DIR, { recursive: true })
mkdirSync(MEMBER_WS, { recursive: true })
writeFileSync(CONTROL_FILE, CONTROL_CONTENT, 'utf8')
const RUN_LOG = join(REPORT_DIR, 'run.log')
const log = (line) => {
  const text = `[${new Date().toISOString()}] ${line}`
  console.log(text)
  appendFileSync(RUN_LOG, `${text}\n`)
}

function makeScenarioCtx(criterion) {
  const c = { criterion, t0: Date.now(), assertions: [], evidence: {}, notes: [], error: null }
  c.check = (name, ok, detail) => {
    c.assertions.push({ name, ok: ok === true, detail: detail === undefined ? undefined : String(detail).slice(0, 3000) })
    return ok === true
  }
  c.note = (text) => c.notes.push(String(text))
  c.finish = () => ({
    criterion,
    pass: c.error === null && c.assertions.length > 0 && c.assertions.every((a) => a.ok),
    durationMs: Date.now() - c.t0,
    assertions: c.assertions,
    evidence: c.evidence,
    notes: c.notes,
    ...(c.error !== null ? { error: String(c.error).slice(0, 4000) } : {}),
  })
  return c
}

const scenarioResults = {}
const liveInstances = new Set()

process.on('exit', () => {
  for (const rec of [...liveInstances]) {
    try {
      if (rec.instance?.child !== undefined) rec.instance.child.kill()
    } catch { /* already dead */ }
  }
})

// Mutable state the mock decide() reads at request time (filled in S2).
const memberState = { instanceId: null, childSessionId: null }

// ── runtime module resolution wiring (worktree node_modules only) ──────────
// The production row's DYNAMIC imports (seam.mjs, agent-bindings.mjs) load
// at boot, outside the static graph the dist import-probe covers. Their bare
// specifiers (@deepseek-ai/*, zod) resolve by the standard Node walk from
// the importing file. t12-vertical wires pnpm-style junctions in the
// worktree (packages/runtime/node_modules + packages/node_modules), each
// pointing at the host tree's pnpm hidden hoist entry; the host tree is
// never touched.
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
      throw new Error(`host tree pnpm hoist has no entry for ${label} at ${target} — cannot wire ${logTag} module links`)
    }
    const scopeDir = scope ? join(base, scope) : base
    mkdirSync(scopeDir, { recursive: true })
    const link = join(scopeDir, name)
    let st = null
    try {
      st = lstatSync(link)
    } catch { /* absent — create below */ }
    if (st !== null) {
      let ok = false
      try { ok = st.isSymbolicLink() && realpathSync(link) === realpathSync(target) } catch { ok = false }
      if (!ok) rmSync(link, { force: true, recursive: true })
      else continue
    }
    symlinkSync(target, link, 'junction')
    log(`${logTag} link: ${label} -> ${target}`)
  }
}

// ── durable session log access (discovery — never hardcoded ids) ───────────

/**
 * Decompress a multi-frame zstd stream (the durable session log format).
 * Each materialized append is a NEW zstd frame without a content size, and
 * node:zlib's zstdDecompressSync only decodes the FIRST frame — frames are
 * walked by magic and each chunk decompressed separately.
 */
function decompressZstdStream(buf) {
  const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  const starts = []
  let off = 0
  for (;;) {
    const i = buf.indexOf(MAGIC, off)
    if (i === -1) break
    starts.push(i)
    off = i + 4
  }
  if (starts.length === 0) throw new Error('no zstd frame in stream')
  const bounds = [...starts, buf.length]
  const parts = []
  let pending = undefined
  for (let k = 0; k < bounds.length - 1; k++) {
    const chunk = buf.subarray(bounds[k], bounds[k + 1])
    const candidate = pending === undefined ? chunk : Buffer.concat([pending, chunk])
    try {
      parts.push(zstdDecompressSync(candidate))
      pending = undefined
    } catch {
      pending = candidate
    }
  }
  if (pending !== undefined) parts.push(zstdDecompressSync(pending))
  return Buffer.concat(parts)
}

function parseFirstJsonLine(buf) {
  const first = zstdDecompressSync(buf).toString('utf8').split('\n').find((l) => l !== '')
  if (first === undefined) return null
  try {
    return JSON.parse(first)
  } catch {
    return null
  }
}

/** Discover one session's durable log by header id (no hardcoded dirs). */
function findSessionFile(dshHome, sessionId) {
  if (sessionId === undefined || sessionId === null) return null
  const root = join(dshHome, 'sessions')
  if (!existsSync(root)) return null
  for (const entry of walk(root, [])) {
    if (!entry.name.endsWith('session.jsonl.zstd')) continue
    try {
      const buf = readFileSync(entry.path)
      const header = parseFirstJsonLine(buf)
      if (header && header.id === sessionId) return { file: entry.path, header, buffer: buf }
    } catch {
      // undecodable / not a session log — skip
    }
  }
  return null
}

/** The full durable log of one session as parsed JSON lines (or null). */
function readSessionLog(dshHome, sessionId) {
  const found = findSessionFile(dshHome, sessionId)
  if (found === null) return null
  const text = decompressZstdStream(found.buffer).toString('utf8')
  const lines = []
  for (const line of text.split('\n')) {
    if (line === '') continue
    try {
      lines.push(JSON.parse(line))
    } catch {
      lines.push({ unparsed: line.slice(0, 200) })
    }
  }
  return { lines, file: found.file, header: found.header }
}

/**
 * Poll a session log until `predicate(line)` matches or the timeout passes.
 */
async function waitForLogLineJson(dshHome, sessionId, predicate, timeoutMs, intervalMs = 1000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const logRec = readSessionLog(dshHome, sessionId)
    if (logRec !== null) {
      for (const line of logRec.lines) {
        if (predicate(line)) return line
      }
    }
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

/**
 * The child session id a member instance materializes as
 * (packages/runtime/src/plugin/live/agent-bindings.mjs
 * `childSessionIdFor`) — recomputed here from the OWNING root + instance
 * so the S2/S4 assertions read the REAL session id without any private
 * handle.
 */
function childSessionIdFor(rootSessionId, instanceId) {
  return `session-team-child-${createHash('sha256').update(`${rootSessionId}\u0000${instanceId}`).digest('hex').slice(0, 32)}`
}

// ── durable TeamDomain forensic reads (evidence; remote reads assert) ──────

function readTeamDomain(dshHome) {
  const file = join(dshHome, 'storages', 'team_domain.json')
  if (!existsSync(file)) return null
  const doc = JSON.parse(readFileSync(file, 'utf8'))
  const tables = doc?.tables ?? {}
  const parse = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : v } catch { return null } }
  return {
    file,
    teamSessions: Object.fromEntries(Object.entries(tables.team_sessions ?? {}).map(([k, v]) => [k, parse(v)])),
    memberInstances: Object.fromEntries(Object.entries(tables.member_instances ?? {}).map(([k, v]) => [k, parse(v)])),
    sessionBindings: Object.fromEntries(Object.entries(tables.session_bindings ?? {}).map(([k, v]) => [k, parse(v)])),
  }
}

/**
 * The durable MemberInstance rows of one root. The member_instances table
 * is keyed by the JSON tuple {instanceId, rootSessionId} (the D4 domLeader
 * key shape); values are JSON-encoded rows.
 */
function memberRowsOfRoot(domain, rootSessionId) {
  if (domain === null) return []
  const out = []
  for (const [key, row] of Object.entries(domain.memberInstances)) {
    if (row === null) continue
    if (row.rootSessionId !== rootSessionId) continue
    out.push({ key, row })
  }
  return out
}

// ── HTTP helpers (fetch, cookie auth, the public channels) ─────────────────

const fetchJson = async (url, init, timeoutMs) => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  let body = null
  try {
    body = text === '' ? null : JSON.parse(text)
  } catch {
    body = { nonJsonBody: text.slice(0, 800) }
  }
  return { status: res.status, body }
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

/**
 * One browser-facing public Remote call: POST /team-remote/<method>.
 * Every call is appended to `remoteCallLedger` (cited in the evidence).
 */
const remoteCallLedger = []
async function remoteCall(origin, cookie, method, params, version) {
  const entry = { at: new Date().toISOString(), method, version, status: null, body: null }
  remoteCallLedger.push(entry)
  const { status, body } = await fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `g5a-${randomBytes(6).toString('hex')}`,
      method,
      payload: { version, params },
    }),
  }, 180_000)
  entry.status = status
  entry.body = body
  return { status, body }
}

/** One user turn on the DSH core public channel: POST /api/session/prompt. */
async function apiPrompt(origin, cookie, sessionId, text) {
  const { status, body } = await fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `g5a-${randomBytes(6).toString('hex')}`,
      method: 'session/prompt',
      payload: {
        args: {
          request: {
            requestId: `g5a-${randomBytes(6).toString('hex')}`,
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text }],
          },
        },
      },
    }),
  }, 240_000)
  return { status, body }
}

/** One native session-history page: POST /api/session/page. */
async function apiPage(origin, cookie, sessionId, { throughSeq, maxMessages }) {
  const { status, body } = await fetchJson(`${origin}/api/session/page`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `g5a-${randomBytes(6).toString('hex')}`,
      method: 'session/page',
      payload: {
        args: {
          request: {
            address: { kind: 'session', sessionId },
            throughSeq,
            maxMessages,
          },
        },
      },
    }),
  }, 60_000)
  return { status, body }
}

/** One ordinary (non-Team) session: POST /api/session/create. */
async function apiCreate(origin, cookie, sessionId, cwd) {
  const { status, body } = await fetchJson(`${origin}/api/session/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `g5a-${randomBytes(6).toString('hex')}`,
      method: 'session/create',
      payload: {
        args: {
          request: { sessionId, cwd },
        },
      },
    }),
  }, 60_000)
  return { status, body }
}

/**
 * Steer one session's model selection at the public seam
 * POST /api/session/selectModel. (Side effect — session-controller
 * saveSelection: the deployment DEFAULT model also moves; the runner
 * restores it in S7 and records both moves.)
 */
async function apiSelectModel(origin, cookie, sessionId, provider, model) {
  const { status, body } = await fetchJson(`${origin}/api/session/selectModel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `g5a-${randomBytes(6).toString('hex')}`,
      method: 'session/selectModel',
      payload: {
        args: {
          request: { sessionId, provider, model },
        },
      },
    }),
  }, 60_000)
  return { status, body }
}

// ── p6t6 observability seam (the harness plugin's test routes) ─────────────

/** One shipped team tool through the pattern-sanctioned observability seam. */
async function p6t6Tool(port, name, args, as) {
  const { status, body } = await fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args, as }),
  }, 240_000)
  return { status, body }
}

async function p6t6Health(port) {
  const { status, body } = await fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 30_000)
  return { status, body }
}

/** Row state diagnostics (durable read-back of the row's config root). */
async function p6t6State(port) {
  const { status, body } = await fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 30_000)
  return { status, body }
}

/**
 * Wait for the row state to be well-formed for the expected root + phase
 * (the row's bootstrap is asynchronous with respect to the health gate).
 */
async function p6t6StateReady(port, { rootSessionId, phase, timeoutMs = 180_000, intervalMs = 500 }) {
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
      throw new Error(`row state not well-formed within ${timeoutMs}ms (expected rootSessionId=${rootSessionId} phase=${phase}); last: status=${last.status} body=${JSON.stringify(last.body).slice(0, 500)}`)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
    last = await p6t6State(port)
  }
}

/** Unwrap a browser-facing public Remote success value ({data, provenance}). */
function remoteValue(result, method) {
  if (result.status !== 200) throw new Error(`${method}: HTTP ${result.status}: ${JSON.stringify(result.body).slice(0, 400)}`)
  const r = result.body?.result
  if (r === undefined) throw new Error(`${method}: no result envelope: ${JSON.stringify(result.body).slice(0, 400)}`)
  if (r.ok !== true) throw new Error(`${method}: remote error: ${JSON.stringify(r.error ?? r).slice(0, 1200)}`)
  const v = r.value
  if (v && typeof v === 'object' && 'data' in v && 'provenance' in v) return v.data
  return v
}

/** Unwrap the observability-seam tool envelope: {ok:true, value}. */
function toolValue(result, name) {
  if (result.status !== 200) throw new Error(`${name}: HTTP ${result.status}: ${JSON.stringify(result.body).slice(0, 400)}`)
  if (result.body?.ok !== true) throw new Error(`${name}: tool error: ${JSON.stringify(result.body).slice(0, 1200)}`)
  const value = result.body.value
  if (value?.status === 'rejected') throw new Error(`${name}: rejected: ${JSON.stringify(value.effect ?? value).slice(0, 1200)}`)
  return value
}

// ── the mock model's deterministic decide table ────────────────────────────

/**
 * Deterministic decide for every model call this run makes. Session class
 * is read from the request's system text: the D3 identity blocks
 * ([team-member-context / [team-root-context) are only present on the team
 * agent's own requests, so they classify unambiguously.
 *
 * Tool-call discipline (the mock never emits two tool calls in a row): a
 * request whose LAST message is role=tool means a tool result just came
 * back — emit the final text. Marker scan over user messages is
 * NEWEST-FIRST (the harness appends a runtime-context snapshot as a
 * separate user message after the turn text on a session's first turn, and
 * later turns' history still carries earlier markers). Title-generation
 * side calls ("Generate the session title ...") always get plain text.
 */
function makeDecide() {
  return (ctx) => {
    const body = ctx?.req ?? ctx
    const msgs = Array.isArray(body?.messages) ? body.messages : []
    const systemText = wireText(msgs.find((m) => m?.role === 'system')?.content)
    const isMember = systemText.includes('[team-member-context')
    const isRoot = systemText.includes('[team-root-context')
    const userMsgs = msgs.filter((m) => m && m.role === 'user')
    const lastUserText = wireText(userMsgs.at(-1)?.content)
    if (lastUserText.startsWith('Generate the session title')) {
      return { kind: 'text', content: `G5A title ${RUN_STAMP}` }
    }
    const lastIsTool = msgs.at(-1)?.role === 'tool'
    // The final ack after a tool result came back (one tool call per turn).
    if (lastIsTool) {
      if (isMember) {
        const markers = [MT, MP, MF]
        for (const marker of markers) {
          if (userMsgs.some((m) => wireText(m.content).includes(marker))) {
            return { kind: 'text', content: `${marker}_MEM_ACK` }
          }
        }
        return { kind: 'text', content: `${RUN_STAMP}_MEM_DEFAULT` }
      }
      if (isRoot) {
        // Which marker's tool result just came back? The tool result
        // message itself carries the turn's requestToken (the create
        // result carries CREATE_TOK, the delegate result WORK_TOK).
        const toolText = wireText(msgs.at(-1)?.content)
        const current = toolText.includes(WORK_TOK) ? MW : MC
        return { kind: 'text', content: `${current}_LEAD_ACK` }
      }
      if (userMsgs.some((m) => wireText(m.content).includes(MO))) {
        return { kind: 'text', content: `${MO}_ACK` }
      }
      return { kind: 'text', content: `${RUN_STAMP}_DEFAULT` }
    }
    // Newest-first marker scan over user messages. A message WITHOUT a
    // marker (e.g. the runtime-context snapshot the harness appends after
    // the turn text on a session's first turn) is SKIPPED, not a default —
    // the turn marker lives in the turn's own message.
    for (let i = userMsgs.length - 1; i >= 0; i--) {
      const m = userMsgs[i]
      const text = wireText(m.content)
      // member turns (file read / pwd / team_* call)
      if (isMember) {
        if (text.includes(MF)) {
          return {
            kind: 'tool-call',
            toolCalls: [{ id: `g5a-mc-${RUN_STAMP}-read`, name: 'read', arguments: JSON.stringify({ file_path: CONTROL_FILE }) }],
          }
        }
        if (text.includes(MP)) {
          // `pwd | Select-Object -ExpandProperty Path` — the canonical pwd
          // cmdlet expanded to its raw path string (a plain `pwd` renders a
          // table whose column truncates long win32 paths, which would
          // obscure the cwd in the output).
          return {
            kind: 'tool-call',
            toolCalls: [{ id: `g5a-mc-${RUN_STAMP}-pwd`, name: 'pwsh', arguments: JSON.stringify({ command: 'pwd | Select-Object -ExpandProperty Path', description: 'Print the current working directory (raw path)' }) }],
          }
        }
        if (text.includes(MT)) {
          const tok = text.match(/tok=([A-Za-z0-9-]+)/)
          if (tok === null || memberState.instanceId === null) {
            return { kind: 'text', content: 'G5A-MEMBER-STATE-UNDISCOVERED' }
          }
          return {
            kind: 'tool-call',
            toolCalls: [{
              id: `g5a-mc-${RUN_STAMP}-rep`,
              name: 'team_report_progress',
              arguments: JSON.stringify({
                rootSessionId: ROOT_B,
                requestToken: tok[1],
                instanceId: memberState.instanceId,
                subject: 'g5a member real team call',
                progress: 'completed',
                summary: `member ${memberState.instanceId} reports the real team_* call landed`,
              }),
            }],
          }
        }
        // the delegated work unit on the member (S5): plain business text
        if (text.includes(MW)) {
          return { kind: 'text', content: WORK_BODY }
        }
        continue
      }
      // leader turns (create the member / delegate the work)
      if (isRoot) {
        if (text.includes(MC)) {
          return {
            kind: 'tool-call',
            toolCalls: [{
              id: `g5a-mc-${RUN_STAMP}-create`,
              name: 'team_create_member',
              arguments: JSON.stringify({
                rootSessionId: ROOT_B,
                requestToken: CREATE_TOK,
                delegationTemplateId: 'worker',
                label: 'G5A Worker',
                workspace: MEMBER_WS,
              }),
            }],
          }
        }
        if (text.includes(MW)) {
          if (memberState.instanceId === null) {
            return { kind: 'text', content: 'G5A-LEADER-NO-MEMBER-INSTANCE' }
          }
          return {
            kind: 'tool-call',
            toolCalls: [{
              id: `g5a-mc-${RUN_STAMP}-delegate`,
              name: 'team_delegate',
              arguments: JSON.stringify({
                rootSessionId: ROOT_B,
                requestToken: WORK_TOK,
                label: 'G5A work unit',
                prompt: `${MW} Complete the delegated work unit and report the result in one line.`,
                delegationInstanceId: memberState.instanceId,
              }),
            }],
          }
        }
        continue
      }
      // ordinary session
      if (text.includes(MO)) return { kind: 'text', content: `${MO}_ACK` }
    }
    // No message carried a marker (e.g. a pure snapshot/context turn).
    if (isMember) return { kind: 'text', content: `${RUN_STAMP}_MEM_DEFAULT` }
    if (isRoot) return { kind: 'text', content: `${RUN_STAMP}_LEAD_DEFAULT` }
    return { kind: 'text', content: `${RUN_STAMP}_DEFAULT` }
  }
}

/**
 * Enumerate the agent tool table from the REAL agent model request that
 * carries `marker` in any user message (the public seam the repo tests use
 * — the model request's tools schema, t12-vertical V2 deferred checks).
 * Title-generation side calls echo the marker inside their input JSON and
 * carry no tool schema — they are skipped.
 */
function toolTableOf(mock, marker) {
  for (const r of [...mock.requests].reverse()) {
    const msgs = Array.isArray(r.body?.messages) ? r.body.messages : []
    const userMsgs = msgs.filter((m) => m && m.role === 'user')
    const userTexts = userMsgs.map((m) => wireText(m.content)).join('\n')
    if (!userTexts.includes(marker)) continue
    const lastUserText = wireText(userMsgs.at(-1)?.content)
    if (lastUserText.startsWith('Generate the session title')) continue
    const tools = Array.isArray(r.body?.tools) ? r.body.tools : []
    return {
      seq: r.seq,
      model: r.body?.model ?? null,
      toolNames: tools.map((t) => t?.function?.name).filter((n) => typeof n === 'string'),
      systemText: wireText(msgs.find((m) => m?.role === 'system')?.content),
    }
  }
  return null
}

/**
 * Render one wire message's content to plain text. Message content may be
 * a plain string OR an array of typed parts ([{type:'text', text}, ...]);
 * both forms are reduced to their text (non-text parts JSON-stringified).
 */
function wireText(content) {
  if (content === null || content === undefined) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((p) => (p !== null && typeof p === 'object' && typeof p.text === 'string' ? p.text : JSON.stringify(p))).join('\n')
  }
  return String(content)
}

/**
 * The text payload of a durable tool/result event:
 * data.message.content[].content[].text (the session log's own shape).
 */
function resultTextOf(line) {
  const parts = Array.isArray(line?.data?.message?.content) ? line.data.message.content : []
  const texts = []
  for (const p of parts) {
    if (p !== null && typeof p === 'object' && Array.isArray(p.content)) {
      for (const c of p.content) {
        if (c !== null && typeof c === 'object' && typeof c.text === 'string') texts.push(c.text)
      }
    }
  }
  return texts.join('\n')
}

/**
 * The callId of a durable tool/result event. The session log records it at
 * data.message.source.callId (there is no data.callId on this event type),
 * so correlation against the tool/call event's data.callId goes through
 * data.message.source.callId (with data.callId kept as a fallback).
 */
function resultCallIdOf(line) {
  return line?.data?.message?.source?.callId ?? line?.data?.callId ?? null
}

/** The parsed tool arguments of a durable tool/call event (or null). */
function callArgsOf(line) {
  const raw = line?.data?.arguments
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** The parsed arguments of a WIRE tool_call (handles string or object). */
function toolCallArgs(tc) {
  const raw = tc?.function?.arguments
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw
  return null
}

/**
 * Find the mock request of one turn by marker + session class, returning
 * the full request record (the turn that just issued a tool call).
 * `lastIsTool` narrows to requests whose LAST message is a tool result
 * (the request that followed the tool result — used to read the tool
 * result the agent saw).
 */
function requestForMarker(mock, marker, { isMember = null, lastIsTool = null, pick = 'last' } = {}) {
  const matches = []
  for (const r of mock.requests) {
    const msgs = Array.isArray(r.body?.messages) ? r.body.messages : []
    const systemText = wireText(msgs.find((m) => m?.role === 'system')?.content)
    const cls = systemText.includes('[team-member-context') ? 'member'
      : systemText.includes('[team-root-context') ? 'root' : 'other'
    if (isMember !== null && (isMember ? cls !== 'member' : cls === 'member')) continue
    const userMsgs = msgs.filter((m) => m && m.role === 'user')
    const hit = userMsgs.some((m) => {
      const t = wireText(m.content)
      return t.includes(marker) && !t.startsWith('Generate the session title')
    })
    if (!hit) continue
    const toolish = msgs.at(-1)?.role === 'tool'
    if (lastIsTool !== null && toolish !== lastIsTool) continue
    matches.push({ req: r, cls, systemText, msgs })
  }
  return (pick === 'first' ? matches[0] : matches.at(-1)) ?? null
}

/**
 * Diagnostic dump of every mock request's classification (written to the
 * report dir on every run — the S3/S4/S5/S6 evidence base).
 */
function dumpRequestDebug(reportDir, mock) {
  const out = []
  for (const r of mock.requests) {
    const msgs = Array.isArray(r.body?.messages) ? r.body.messages : []
    const sys = msgs.find((m) => m?.role === 'system')
    const systemText = wireText(sys?.content)
    out.push({
      seq: r.seq,
      path: r.path,
      status: r.status,
      reply: r.reply === null ? null : { kind: r.reply.kind, name: r.reply.kind === 'tool-call' ? (Array.isArray(r.reply.toolCalls) ? r.reply.toolCalls.map((c) => c?.name).join(',') : r.reply.toolCalls?.name) : String(r.reply.content ?? '').slice(0, 80) },
      systemRoleFound: sys !== undefined,
      systemKind: Array.isArray(sys?.content) ? 'array' : typeof sys?.content,
      cls: systemText.includes('[team-member-context') ? 'member' : systemText.includes('[team-root-context') ? 'root' : 'other',
      systemHead: systemText.slice(0, 120),
      lastRole: msgs.at(-1)?.role ?? null,
      lastContentKind: Array.isArray(msgs.at(-1)?.content) ? 'array' : typeof msgs.at(-1)?.content,
      userMsgs: msgs.filter((m) => m?.role === 'user').map((m) => ({
        kind: Array.isArray(m.content) ? 'array' : typeof m.content,
        head: wireText(m.content).slice(0, 100),
      })),
      toolMsgs: msgs.filter((m) => m?.role === 'tool').map((m) => ({
        contentKind: Array.isArray(m.content) ? 'array' : typeof m.content,
        head: wireText(m.content).slice(0, 200),
      })),
      assistantToolCalls: msgs.filter((m) => m?.role === 'assistant' && Array.isArray(m?.tool_calls)).map((m) => m.tool_calls.map((tc) => tc?.function?.name)),
    })
  }
  try {
    writeFileSync(join(reportDir, 'debug-requests.json'), JSON.stringify(out, null, 2))
  } catch { /* diagnostic only */ }
}

// ── world boot / stop (port 3180, the shared DSH_HOME) ─────────────────────

function rowConfig(bootPhase) {
  return {
    rootSessionId: ROOT_A,
    bootPhase,
    blueprintSource: BLUEPRINT_DOC,
    seedMembers: [],
    defaultWorkspace: WORKSPACE,
    generation: 1,
    staticModel: { provider: MODEL_PROVIDER, model: MODEL_ID },
    deniedSelection: { provider: 'g5a-denied', model: 'g5a-denied' },
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: GLUE_URL,
    seamUrl: SEAM_URL,
  }
}

// ── profile-patch YAML emitter (hand-rolled, the DSH patch dialect — ──────
// ── byte-identical to the t12-vertical/D4 precedent) ──────────────────────

function yamlScalar(v) {
  if (v === null) return 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
}

function yamlValueLines(value, indent) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => yamlEmitItem(item, indent))
  }
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
  if (item === null || typeof item !== 'object') {
    return [`${pad}- ${yamlScalar(item)}`]
  }
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
    '# G5A (Team D1-D6 repair v2) live-host MEMBER E2E acceptance mount: production dsh-agent-team row (this worktree\'s committed D1-D4 dist) + observability p6t6-team-tools row, mounted ONLY through this public profile-patch seam.',
    '- insert:',
    ...yamlEmitItem({
      id: PRODUCTION_ROW_ID,
      name: PRODUCTION_ROW_NAME,
      config: rowConfig(bootPhase),
    }, 2),
    ...yamlEmitItem({
      id: P6T6_ROW_ID,
      name: P6T6_ROW_NAME,
    }, 2),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

async function bootInstance({ label, boot, bootPhase, directivePhase }) {
  const instLogDir = join(REPORT_DIR, 'instances', label)
  mkdirSync(instLogDir, { recursive: true })
  const instance = new DshInstance({
    hostTree: HOST_TREE,
    dshHome: DSH_HOME,
    port: PORT,
    clientCommitHash: CLIENT_COMMIT_HASH,
    logDir: instLogDir,
  })
  const rec = {
    label, boot, bootPhase, instance, logPath: null, url: null, token: null,
    cookie: null, origin: null, health: null, dumpPath: null, rowMounted: null,
  }
  const profile = await ensureProfile({ instance, log, timeoutMs: 120_000 })
  log(`${label}: profile ${profile.created ? 'created via throwaway boot' : 'already initialized'}`)
  writeTeamPatchFile(instance.patchFile, bootPhase)
  log(`${label}: patch layer written to ${instance.patchFile} (phase=${bootPhase})`)
  const directive = { boot, phase: directivePhase, reportDir: REPORT_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT_A, mcpPort: null }
  writeFileSync(join(DSH_HOME, 'p6t6-directive.json'), JSON.stringify(directive, null, 2))
  log(`${label}: directive written (boot=${boot} phase=${directivePhase})`)
  const started = await instance.start({ timeoutMs: 240_000 })
  rec.url = started.url
  rec.logPath = started.logPath
  const token = started.url.slice(started.url.indexOf('token=') + 6).trim()
  rec.token = token
  rec.origin = `http://127.0.0.1:${PORT}`
  rec.cookie = await authenticate(rec.origin, token)
  log(`${label}: booted at ${rec.origin}; auth cookie exchanged`)
  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  rec.dumpPath = join(instLogDir, 'dump-config.txt')
  writeFileSync(rec.dumpPath, dump.text)
  rec.rowMounted = {
    [PRODUCTION_ROW_ID]: DshInstance.rowInDump(dump.text, { id: PRODUCTION_ROW_ID, name: PRODUCTION_ROW_NAME }),
    [P6T6_ROW_ID]: DshInstance.rowInDump(dump.text, { id: P6T6_ROW_ID, name: P6T6_ROW_NAME }),
  }
  // Row health gate (plugin ready + ten tool registrations).
  const deadline = Date.now() + 240_000
  for (;;) {
    const hb = await p6t6Health(PORT)
    rec.health = { status: hb.status, body: hb.body }
    if (hb.status === 200 && hb.body?.ok === true && hb.body?.toolCount === EXPECTED_TOOL_COUNT) break
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      throw new Error(`${label}: row setup failed — setupError: ${String(hb.body.setupError).slice(0, 600)}; log tail:\n${logTail(rec.logPath, 25)}`)
    }
    if (Date.now() >= deadline) throw new Error(`${label}: row health not ready in 240s — health=${JSON.stringify(hb.body).slice(0, 500)}; log tail:\n${logTail(rec.logPath, 25)}`)
    await new Promise((r) => setTimeout(r, 1000))
  }
  log(`${label}: row ready — toolCount=${rec.health.body.toolCount} liveSessions=${JSON.stringify(rec.health.body.liveSessions)}`)
  liveInstances.add(rec)
  return rec
}

async function stopInstance(rec) {
  try {
    const res = await rec.instance.stop({ timeoutMs: 20_000 })
    log(`${rec.label}: stopped (killed=${res.killed} portFree=${res.portFree})`)
    return res
  } finally {
    liveInstances.delete(rec)
  }
}

// ── port probing / long wait (the task's 20-min polling allowance) ─────────

function probePortBusy(port, timeoutMs = 2_000) {
  return new Promise((resolveProbe) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    const done = (busy) => { try { socket.destroy() } catch { /* noop */ } resolveProbe(busy) }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

/**
 * Wait up to maxMs for the port to become free (the task allows up to 20
 * minutes of polling when 3180 is busy at start). Returns {free, waitedMs}.
 */
async function waitPortFreeOrTimeout(port, maxMs, intervalMs = 15_000) {
  const t0 = Date.now()
  for (;;) {
    if (!(await probePortBusy(port))) return { free: true, waitedMs: Date.now() - t0 }
    if (Date.now() - t0 >= maxMs) return { free: false, waitedMs: Date.now() - t0 }
    log(`port ${port} busy — polling for up to ${Math.round((maxMs - (Date.now() - t0)) / 1000)}s more`)
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

// ── the scenario ───────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now()
  log(`== g5-member-e2e ${new Date().toISOString()} (nonce ${NONCE}) ==`)
  log(`ROOT_A=${ROOT_A} ROOT_B=${ROOT_B} ORDINARY=${ORDINARY} home=${DSH_HOME} port=${PORT}`)
  log(`control file: ${CONTROL_FILE}`)

  // ── S0: pre-flight + control fixtures ────────────────────────────────────
  const s0 = makeScenarioCtx('S0 pre-flight: test-use pristine at the pinned SHA; :3080 only probed read-only; the committed dist host row exists + import-probed; the junction bridges wired; the shared home pre-existing roots recorded; port 3180 verified free (up to 20 min polling); the mock model started; the member workspace + control file pre-created')
  mkdirSync(join(REPORT_DIR, 'git'), { recursive: true })
  const preGit = await captureGitState(HOST_TREE, join(REPORT_DIR, 'git'))
  s0.evidence.testUsePre = { head: preGit.head, statusEmpty: preGit.statusEmpty, diffEmpty: preGit.diffEmpty, errors: preGit.errors }
  s0.check('test-use HEAD == 76fda729 (the pinned audit baseline)', preGit.head === EXPECTED_HOST_SHA, `head=${preGit.head}`)
  s0.check('test-use git status --porcelain empty (pre)', preGit.statusEmpty, `status=${JSON.stringify(preGit.status.slice(0, 300))}`)
  const stablePre = await fetchJson(STABLE_URL, undefined, 10_000).catch((e) => ({ status: null, body: String(e) }))
  s0.evidence.stablePre = { url: STABLE_URL, httpStatus: stablePre.status }
  s0.check('stable :3080 reachable read-only (pre; NO interaction)', stablePre.status !== null, `status=${stablePre.status}`)
  // dist sanity (G5A changes no install surface; the committed D1-D4 build
  // carries the artifacts — verify the row entry + glue + seam + p6t6
  // plugin exist and the dist row loads under plain node, t12-vertical
  // import-probe form, file-fd stdio per repo discipline).
  const distFiles = {
    'plugin/host.js': existsSync(join(WORKTREE_ROOT, 'packages/runtime/dist/packages/runtime/src/plugin/host.js')),
    'plugin/live/agent-bindings.mjs': existsSync(join(WORKTREE_ROOT, 'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs')),
    'root-binding/harness/seam.mjs': existsSync(join(WORKTREE_ROOT, 'packages/runtime/root-binding/harness/seam.mjs')),
    'tools/harness/plugin.mjs': existsSync(join(HERE, 'plugin.mjs')),
  }
  s0.evidence.distFiles = distFiles
  s0.check('worktree carries the committed D1-D4 artifacts (host row / glue / seam / p6t6 plugin)', Object.values(distFiles).every(Boolean), JSON.stringify(distFiles))
  const probe = await spawnToLog(
    process.execPath,
    ['-e', `import(${JSON.stringify(PRODUCTION_ROW_NAME)}).then(m => console.log('LOADED name=' + m.name)).catch(e => { console.error('PROBE_FAIL ' + e.message); process.exit(1) })`],
    { cwd: WORKTREE_ROOT, logPath: join(REPORT_DIR, 'dist-import-probe.log'), timeoutMs: 120_000 },
  )
  s0.check('dist import probe: the committed dist row loads under plain node', probe.ok && probe.text.includes('LOADED name=dsh-agent-team'), probe.text.trim().split('\n').slice(-3).join(' | ').slice(0, 400))
  ensureJunctions(join(WORKTREE_ROOT, 'packages', 'runtime', 'node_modules'), RUNTIME_LINKS, 'runtime')
  ensureJunctions(join(WORKTREE_ROOT, 'packages', 'node_modules'), PACKAGES_LINKS, 'packages')
  s0.check('junction bridges wired (worktree node_modules only; host tree untouched)', true, 'RUNTIME_LINKS + PACKAGES_LINKS')
  const domainPre = readTeamDomain(DSH_HOME)
  s0.evidence.homePreExistingRoots = domainPre ? Object.keys(domainPre.teamSessions).sort() : null
  s0.note(`pre-existing durable roots in the shared home: ${JSON.stringify(s0.evidence.homePreExistingRoots)} (preserved; never destroyed — this run adds only its nonce roots)`)
  s0.check('member workspace + control file pre-created (the S4a read target)', existsSync(CONTROL_FILE) && readFileSync(CONTROL_FILE, 'utf8').includes(CONTROL_TOKEN), CONTROL_FILE)
  const portWait = await waitPortFreeOrTimeout(PORT, PORT_WAIT_MAX_MS)
  s0.evidence.portWait = portWait
  s0.check(`port ${PORT} free before boot (up to 20 min polling allowance)`, portWait.free, `waitedMs=${portWait.waitedMs}`)
  if (!portWait.free) {
    scenarioResults.S0 = s0.finish()
    log(`S0: pass=${scenarioResults.S0.pass}`)
    // DEFERRED: the task's 20-min polling allowance expired with the port
    // still busy. Honest status, no host was booted, nothing was touched.
    const deferredSummary = {
      task: 'G5A-live-host-member-e2e',
      verdict: 'DEFERRED',
      reason: `port ${PORT} busy for the full 20-min polling allowance — no boot attempted`,
      nonce: NONCE,
      startedAt: new Date(t0).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      portWait,
      scenarios: scenarioResults,
      pass: false,
    }
    writeFileSync(join(REPORT_DIR, 'summary.json'), JSON.stringify(deferredSummary, null, 2))
    log('== DEFERRED: port 3180 never freed within the 20-min allowance ==')
    process.exitCode = 2
    return
  }
  scenarioResults.S0 = s0.finish()
  log(`S0: pass=${scenarioResults.S0.pass}`)
  if (!scenarioResults.S0.pass) throw new Error('S0 pre-flight failed — aborting before any host boot')

  // The deterministic model (in-process; the host reaches it via env only).
  const mock = await startMockModel({ port: 0, decide: makeDecide(), log: (l) => log(`mock: ${l}`) })
  // The mock serves POST /chat/completions (the dsh-llm deepseek adapter
  // appends the path itself — the t12-vertical precedent sets the base
  // WITHOUT a /v1 suffix).
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${mock.port}`
  process.env.DEEPSEEK_API_KEY = 'g5a-mock-key'
  log(`mock model on 127.0.0.1:${mock.port}`)

  let inst = null
  try {
    // ── S1: BOOT 1 on 3180 + team root via the public remote channel ───────
    const s1 = makeScenarioCtx('S1: BOOT 1 on 3180 (row boot; create-or-open resolves to create for the nonce row root ROOT_A → the directive root goes live) + ROOT_B created over the browser-facing public remote channel team.create (contract v2 — the same path the Team UI New-Team entry drives; D4/t12 boot+drive precedent)')
    inst = await bootInstance({ label: 'BOOT1', boot: 1, bootPhase: 'create-or-open', directivePhase: 'create' })
    s1.evidence.boot1 = {
      url: inst.url, logPath: inst.logPath, rowMounted: inst.rowMounted,
      health: { status: inst.health.status, toolCount: inst.health.body?.toolCount, liveSessions: inst.health.body?.liveSessions },
    }
    s1.check('rows mounted (production row + p6t6 observability row in the composed profile)', inst.rowMounted?.[PRODUCTION_ROW_ID] === true && inst.rowMounted?.[P6T6_ROW_ID] === true, JSON.stringify(inst.rowMounted))
    s1.check('health: row ready with EXACTLY the ten team tool registrations (row level)', inst.health.body?.toolCount === EXPECTED_TOOL_COUNT, `toolCount=${inst.health.body?.toolCount}`)
    s1.check('live root agent ROOT_A materialized by the row create boot', (inst.health.body?.liveSessions ?? []).includes(ROOT_A), JSON.stringify(inst.health.body?.liveSessions))
    const stateReady1 = await p6t6StateReady(PORT, { rootSessionId: ROOT_A, phase: 'create' })
    s1.evidence.rowState1 = { status: stateReady1.status, body: stateReady1.body }
    s1.check('row state well-formed for ROOT_A (create phase)', stateReady1.status === 200, JSON.stringify(stateReady1.body).slice(0, 300))
    const createRes = await remoteCall(inst.origin, inst.cookie, 'team.create', {
      rootSessionId: ROOT_B,
      blueprintId: BLUEPRINT_ID,
      blueprintRevision: BLUEPRINT_REVISION_NUM,
      workspace: WORKSPACE,
    }, 2)
    const created = remoteValue(createRes, 'team.create')
    s1.evidence.teamCreate = { status: createRes.status, value: created }
    s1.check('remote team.create (v2) over the public remote channel minted the dynamic root ROOT_B', createRes.status === 200 && created?.durable !== undefined, JSON.stringify(created).slice(0, 400))
    const roots1Res = await remoteCall(inst.origin, inst.cookie, 'team.listRoots', {}, 3)
    const roots1 = remoteValue(roots1Res, 'team.listRoots')
    const roots1List = roots1?.roots
    const rootIds1 = Array.isArray(roots1List) ? roots1List.map((r) => r?.rootSessionId) : []
    s1.evidence.listRoots = { status: roots1Res.status, roots: rootIds1 }
    s1.check('team.listRoots (v3) enumerates BOTH new roots + the pre-existing home roots (read-only host authority)', [ROOT_A, ROOT_B, ...(s0.evidence.homePreExistingRoots ?? [])].every((id) => rootIds1.includes(id)), `roots=${JSON.stringify(rootIds1)}`)
    scenarioResults.S1 = s1.finish()
    log(`S1: pass=${scenarioResults.S1.pass}`)

    // ── S2: member provisioning via the Leader team_create_member tool ─────
    const s2 = makeScenarioCtx('S2 MEMBER PROVISIONING — the public surface used (cited): there is NO team.* remote method that creates a member (the public remote surface at base 3b53e40 is team.create / team.admitInitialWork / team.listRoots / team.ensureRootLive / team.getProjection / team.getLedgerPage — packages/runtime/src/plugin/s6-remote.ts, read by G5A). The CANONICAL path is the Leader team_create_member tool via a REAL Leader turn: POST /api/session/prompt on ROOT_B whose mock-replied tool call executes over the real runtime. The member must end as a LIVE child bound to ROOT_B.')
    const mcPrompt = await apiPrompt(inst.origin, inst.cookie, ROOT_B, `G5A leader turn ${MC}: create the team worker member (template worker) in the workspace ${MEMBER_WS}.`)
    s2.evidence.mcPrompt = { status: mcPrompt.status, body: mcPrompt.body }
    s2.check('Leader MC prompt accepted on ROOT_B (browser-facing chat path)', mcPrompt.status === 200 && mcPrompt.body?.result?.ok === true, `status=${mcPrompt.status} body=${JSON.stringify(mcPrompt.body).slice(0, 300)}`)
    const ackMC = await waitForLogLineJson(DSH_HOME, ROOT_B, (l) => l?.type === 'assistant/message' && JSON.stringify(l.data?.message?.content ?? '').includes(`${MC}_LEAD_ACK`), 180_000)
    s2.check('Leader MC turn settled (the assistant ack is durable in ROOT_B)', ackMC !== null, ackMC === null ? 'no assistant ack within 180s' : 'assistant ack present')
    // Discover the member from the durable TeamDomain (the instance id is
    // minted by the runtime — discovered, never guessed).
    const domain2 = readTeamDomain(DSH_HOME)
    const members2 = memberRowsOfRoot(domain2, ROOT_B).filter(({ row }) => row.instanceId !== LEADER_INSTANCE_ID)
    s2.evidence.memberRows = members2.map(({ key, row }) => ({ key, row }))
    s2.check('exactly ONE non-leader MemberInstance row for ROOT_B', members2.length === 1, JSON.stringify(members2.map((m) => m.row?.instanceId)))
    if (members2.length === 1) {
      memberState.instanceId = members2[0].row.instanceId
      memberState.childSessionId = childSessionIdFor(ROOT_B, memberState.instanceId)
    }
    s2.check('member row childSessionId == childSessionIdFor(ROOT_B, instanceId) (recomputed from the public formula; no private handle)', members2.length === 1 && members2[0].row.childSessionId === memberState.childSessionId, `row=${members2[0]?.row?.childSessionId} computed=${memberState.childSessionId}`)
    const memberLog2 = memberState.childSessionId !== null ? readSessionLog(DSH_HOME, memberState.childSessionId) : null
    s2.evidence.memberSessionArtifact = memberLog2 === null ? null : { file: memberLog2.file, id: memberLog2.header?.id, cwd: memberLog2.header?.cwd }
    s2.check('member child session artifact exists under DSH_HOME (a real DSH session)', memberLog2 !== null && memberLog2.header?.id === memberState.childSessionId, JSON.stringify(s2.evidence.memberSessionArtifact))
    s2.check('member session header cwd == the member workspace passed to team_create_member (the child factory honors request.workspace)', memberLog2?.header?.cwd === MEMBER_WS, `cwd=${memberLog2?.header?.cwd} expected=${MEMBER_WS}`)
    const hb2 = await p6t6Health(PORT)
    const live2 = hb2.body?.liveSessions ?? []
    s2.evidence.liveSessionsAfterS2 = live2
    s2.check('health liveSessions includes the member child session (a LIVE child bound to ROOT_B)', live2.includes(memberState.childSessionId), JSON.stringify(live2))
    s2.check('health liveSessions includes ROOT_B (the leader stays live too)', live2.includes(ROOT_B), JSON.stringify(live2))
    if (memberState.instanceId !== null) {
      const listCall = await p6t6Tool(PORT, 'team_list_members', { rootSessionId: ROOT_B, requestToken: `g5a-list-${RUN_STAMP}-tok` }, ROOT_B)
      s2.evidence.teamListMembers = { status: listCall.status, body: listCall.body }
      let listOk = false
      let listDetail = ''
      try {
        const v = toolValue(listCall, 'team_list_members')
        listOk = v !== null && JSON.stringify(v).includes(memberState.instanceId)
        listDetail = JSON.stringify(v).slice(0, 300)
      } catch (error) {
        listDetail = String(error).slice(0, 300)
      }
      s2.check('team_list_members (the pattern-sanctioned observability seam) lists the new member on ROOT_B', listOk, listDetail)
    } else {
      s2.check('team_list_members (the pattern-sanctioned observability seam) lists the new member on ROOT_B', false, 'no member row discovered')
    }
    scenarioResults.S2 = s2.finish()
    log(`S2: pass=${scenarioResults.S2.pass}`)

    // ── S4 (executed first; S3 reads its first member model request) ────────
    // S4: MEMBER REAL TOOL CALLS — three real member turns, each over the
    // public member-session prompt path POST /api/session/prompt on the
    // member's child session (the session controller's resolve() PREFERS
    // the live agent — agent.ts resolve(): while the member is resident,
    // its live team-composed agent handles the turn).
    const s4 = makeScenarioCtx('S4 MEMBER REAL TOOL CALLS — (a) file read of the pre-created control file (content round-trips into the tool result), (b) pwsh pwd (output == the member workspace path), (c) team_report_progress with the OWNING rootSessionId + a FRESH unique requestToken; all real executions: tool/call + tool/result durable events in the member session log, correlated by callId, plus the mock-captured tool call/result the agent actually saw')
    const mfPrompt = await apiPrompt(inst.origin, inst.cookie, memberState.childSessionId, `G5A member turn ${MF}: read the control file ${CONTROL_FILE} with your file-read tool and confirm you can see its sentinel.`)
    s4.evidence.mfPrompt = { status: mfPrompt.status, body: mfPrompt.body }
    const ackMF = await waitForLogLineJson(DSH_HOME, memberState.childSessionId, (l) => l?.type === 'assistant/message' && JSON.stringify(l.data?.message?.content ?? '').includes(`${MF}_MEM_ACK`), 180_000)
    s4.check('member MF turn settled (the assistant ack is durable in the member session log)', ackMF !== null, ackMF === null ? 'no assistant ack within 180s' : 'assistant ack present')
    // (a) the captured tool call + the tool result the agent saw
    const mfResultReq = requestForMarker(mock, MF, { isMember: true, lastIsTool: true })
    let mfReadArgs = null
    if (mfResultReq !== null) {
      const assistantTc = mfResultReq.msgs.filter((m) => m?.role === 'assistant' && Array.isArray(m?.tool_calls))
      for (const m of assistantTc) {
        for (const tc of m.tool_calls) {
          if (tc?.function?.name === 'read') mfReadArgs = toolCallArgs(tc)
        }
      }
    }
    s4.evidence.mfToolCall = { captureSeq: mfResultReq?.req.seq ?? null, arguments: mfReadArgs }
    s4.check('member MF turn: the captured tool call is read{file_path} targeting the control file (the agent actually issued it)', mfReadArgs?.file_path === CONTROL_FILE, JSON.stringify(mfReadArgs))
    const mfLastToolText = mfResultReq === null ? '' : wireText(mfResultReq.msgs.at(-1)?.content)
    s4.evidence.mfCapturedToolResult = mfLastToolText.slice(0, 500)
    s4.check('member MF turn: the captured tool RESULT the agent saw contains the control token (content round-trips)', mfLastToolText.includes(CONTROL_TOKEN), mfLastToolText.slice(0, 300))
    // (a) the durable member log: tool/call + tool/result correlated by callId
    const memberLogA = readSessionLog(DSH_HOME, memberState.childSessionId)
    const mfCallLine = memberLogA?.lines.find((l) => l?.type === 'tool/call' && l.data?.name === 'read' && callArgsOf(l)?.file_path === CONTROL_FILE) ?? null
    s4.evidence.mfDurableCall = mfCallLine === null ? null : { seq: mfCallLine.seq, callId: mfCallLine.data?.callId, name: mfCallLine.data?.name, file_path: callArgsOf(mfCallLine)?.file_path ?? null }
    s4.check('member MF turn: the durable log carries the real tool/call event (read of the control file)', mfCallLine !== null, JSON.stringify(s4.evidence.mfDurableCall))
    const mfResultLine = mfCallLine !== null ? (memberLogA?.lines.find((l) => l?.type === 'tool/result' && resultCallIdOf(l) === mfCallLine.data?.callId) ?? null) : null
    s4.evidence.mfDurableResult = mfResultLine === null ? null : { seq: mfResultLine.seq, callId: mfResultLine.data?.callId, hasToken: resultTextOf(mfResultLine).includes(CONTROL_TOKEN), textHead: resultTextOf(mfResultLine).slice(0, 300) }
    s4.check('member MF turn: the durable log carries the correlated tool/result with the control token (real execution)', mfResultLine !== null && resultTextOf(mfResultLine).includes(CONTROL_TOKEN), JSON.stringify(s4.evidence.mfDurableResult))

    // ── S3: MEMBER TOOL TABLE (from the first real member model request) ────
    const s3 = makeScenarioCtx('S3 MEMBER TOOL TABLE — from the real member model request (mock capture — the real dsh-llm adapter wire; the model request tools schema is the public seam the repo tests use, t12-vertical V2 deferred checks): the member sees BOTH the ordinary base tools (the standard preset file/shell tools — ACTUAL names enumerated from the capture) AND exactly the ten team_* tools')
    const memberTable = toolTableOf(mock, MF)
    s3.evidence.memberToolTable = memberTable === null ? null : { seq: memberTable.seq, model: memberTable.model, toolNames: memberTable.toolNames }
    s3.check('a real member model request exists (the mock captured the agent wire)', memberTable !== null, `seq=${memberTable?.seq}`)
    if (memberTable !== null) {
      const names = memberTable.toolNames
      const baseNonTeam = names.filter((n) => !n.startsWith('team_'))
      const teamInTable = names.filter((n) => n.startsWith('team_'))
      s3.evidence.memberBaseTools = baseNonTeam
      s3.evidence.memberTeamTools = teamInTable
      s3.check('the member sees EXACTLY the ten team_* tools (no more, no less)', TEAM_TOOLS.every((n) => names.includes(n)) && teamInTable.length === 10, JSON.stringify(teamInTable))
      s3.check("the member sees the standard preset file-read tool 'read' in its base tool table", names.includes('read'), `baseTools=${JSON.stringify(baseNonTeam)}`)
      s3.check("the member sees the win32 shell tool 'pwsh' in its base tool table", names.includes('pwsh'), `baseTools=${JSON.stringify(baseNonTeam)}`)
      s3.note(`member tool table (${names.length} tools): ${JSON.stringify(names)}`)
    } else {
      s3.check('the member sees EXACTLY the ten team_* tools (no more, no less)', false, '<no member request captured>')
      s3.check("the member sees the standard preset file-read tool 'read' in its base tool table", false, '<no member request captured>')
      s3.check("the member sees the win32 shell tool 'pwsh' in its base tool table", false, '<no member request captured>')
    }
    scenarioResults.S3 = s3.finish()
    log(`S3: pass=${scenarioResults.S3.pass}`)

    // (b) real pwd turn
    const mpPrompt = await apiPrompt(inst.origin, inst.cookie, memberState.childSessionId, `G5A member turn ${MP}: print your current working directory with the shell tool.`)
    s4.evidence.mpPrompt = { status: mpPrompt.status, body: mpPrompt.body }
    const ackMP = await waitForLogLineJson(DSH_HOME, memberState.childSessionId, (l) => l?.type === 'assistant/message' && JSON.stringify(l.data?.message?.content ?? '').includes(`${MP}_MEM_ACK`), 180_000)
    s4.check('member MP turn settled (the assistant ack is durable in the member session log)', ackMP !== null, ackMP === null ? 'no assistant ack within 180s' : 'assistant ack present')
    const mpResultReq = requestForMarker(mock, MP, { isMember: true, lastIsTool: true })
    let mpPwshArgs = null
    if (mpResultReq !== null) {
      for (const m of mpResultReq.msgs.filter((m) => m?.role === 'assistant' && Array.isArray(m?.tool_calls))) {
        for (const tc of m.tool_calls) {
          if (tc?.function?.name === 'pwsh') mpPwshArgs = toolCallArgs(tc)
        }
      }
    }
    const MP_COMMAND = 'pwd | Select-Object -ExpandProperty Path'
    s4.evidence.mpToolCall = { captureSeq: mpResultReq?.req.seq ?? null, arguments: mpPwshArgs }
    s4.check('member MP turn: the captured tool call is the pwsh pwd command (raw path expansion)', mpPwshArgs?.command === MP_COMMAND, JSON.stringify(mpPwshArgs))
    const mpOut = mpResultReq === null ? '' : wireText(mpResultReq.msgs.at(-1)?.content)
    s4.evidence.mpToolResult = mpOut.slice(0, 400)
    s4.check('member MP turn: the captured pwd tool result IS the member workspace path (exact, case-insensitive — win32)', mpOut.trim().toLowerCase() === MEMBER_WS.toLowerCase(), `out=${JSON.stringify(mpOut.trim()).slice(0, 200)} expected=${MEMBER_WS}`)
    const memberLogB = readSessionLog(DSH_HOME, memberState.childSessionId)
    const mpCallLine = memberLogB?.lines.find((l) => l?.type === 'tool/call' && l.data?.name === 'pwsh' && callArgsOf(l)?.command === MP_COMMAND) ?? null
    s4.evidence.mpDurableCall = mpCallLine === null ? null : { seq: mpCallLine.seq, callId: mpCallLine.data?.callId, name: mpCallLine.data?.name }
    s4.check('member MP turn: the durable log carries the real pwsh tool/call event', mpCallLine !== null, JSON.stringify(s4.evidence.mpDurableCall))
    const mpResultLine = mpCallLine !== null ? (memberLogB?.lines.find((l) => l?.type === 'tool/result' && resultCallIdOf(l) === mpCallLine.data?.callId) ?? null) : null
    const mpDurableText = mpResultLine === null ? '' : resultTextOf(mpResultLine)
    s4.evidence.mpDurableResult = mpResultLine === null ? null : { seq: mpResultLine.seq, exactWorkspace: mpDurableText.trim().toLowerCase() === MEMBER_WS.toLowerCase(), text: mpDurableText.trim().slice(0, 300) }
    s4.check('member MP turn: the durable log carries the correlated tool/result that IS the member workspace path (real execution)', mpDurableText.trim().toLowerCase() === MEMBER_WS.toLowerCase(), JSON.stringify(s4.evidence.mpDurableResult))

    // (c) real team_* turn (team_report_progress, owning root + fresh token)
    const mtPrompt = await apiPrompt(inst.origin, inst.cookie, memberState.childSessionId, `G5A member turn ${MT}: report your progress over the team tool; use rootSessionId ${ROOT_B} and a fresh unique requestToken: tok=${MT_TOK}.`)
    s4.evidence.mtPrompt = { status: mtPrompt.status, body: mtPrompt.body }
    const ackMT = await waitForLogLineJson(DSH_HOME, memberState.childSessionId, (l) => l?.type === 'assistant/message' && JSON.stringify(l.data?.message?.content ?? '').includes(`${MT}_MEM_ACK`), 180_000)
    s4.check('member MT turn settled (the assistant ack is durable in the member session log)', ackMT !== null, ackMT === null ? 'no assistant ack within 180s' : 'assistant ack present')
    const mtResultReq = requestForMarker(mock, MT, { isMember: true, lastIsTool: true })
    let mtTeamArgs = null
    if (mtResultReq !== null) {
      for (const m of mtResultReq.msgs.filter((m) => m?.role === 'assistant' && Array.isArray(m?.tool_calls))) {
        for (const tc of m.tool_calls) {
          if (tc?.function?.name === 'team_report_progress') mtTeamArgs = toolCallArgs(tc)
        }
      }
    }
    s4.evidence.mtToolCall = { captureSeq: mtResultReq?.req.seq ?? null, arguments: mtTeamArgs }
    s4.check('member MT turn: the captured team_report_progress call carries the OWNING rootSessionId (ROOT_B)', mtTeamArgs?.rootSessionId === ROOT_B, JSON.stringify(mtTeamArgs))
    s4.check('member MT turn: the captured team_report_progress call carries a FRESH unique requestToken (tok= value, per-run nonce)', mtTeamArgs?.requestToken === MT_TOK, JSON.stringify(mtTeamArgs))
    s4.check('member MT turn: the captured team_report_progress call carries the member OWN instanceId', mtTeamArgs?.instanceId === memberState.instanceId, JSON.stringify(mtTeamArgs))
    const mtLastToolText = mtResultReq === null ? '' : wireText(mtResultReq.msgs.at(-1)?.content)
    s4.evidence.mtCapturedToolResult = mtLastToolText.slice(0, 500)
    s4.check('member MT turn: the tool result settled in the capture (the agent saw the progress-recorded result)', mtResultReq !== null && mtResultReq.msgs.at(-1)?.role === 'tool' && mtLastToolText.includes('progress-recorded'), mtLastToolText.slice(0, 300))
    const memberLogC = readSessionLog(DSH_HOME, memberState.childSessionId)
    const mtCallLine = memberLogC?.lines.find((l) => l?.type === 'tool/call' && l.data?.name === 'team_report_progress' && callArgsOf(l)?.requestToken === MT_TOK) ?? null
    s4.evidence.mtDurableCall = mtCallLine === null ? null : { seq: mtCallLine.seq, callId: mtCallLine.data?.callId, name: mtCallLine.data?.name, rootSessionId: callArgsOf(mtCallLine)?.rootSessionId ?? null, requestToken: callArgsOf(mtCallLine)?.requestToken ?? null, instanceId: callArgsOf(mtCallLine)?.instanceId ?? null }
    s4.check('member MT turn: the durable log carries the real team_report_progress tool/call event', mtCallLine !== null, JSON.stringify(s4.evidence.mtDurableCall))
    const mtResultLine = mtCallLine !== null ? (memberLogC?.lines.find((l) => l?.type === 'tool/result' && resultCallIdOf(l) === mtCallLine.data?.callId) ?? null) : null
    s4.evidence.mtDurableResult = mtResultLine === null ? null : { seq: mtResultLine.seq, callId: mtResultLine.data?.callId, textHead: resultTextOf(mtResultLine).slice(0, 300) }
    s4.check('member MT turn: the durable log carries the correlated tool/result with the progress-recorded payload (real execution)', mtResultLine !== null && resultTextOf(mtResultLine).includes('progress-recorded'), JSON.stringify(s4.evidence.mtDurableResult))
    scenarioResults.S4 = s4.finish()
    log(`S4: pass=${scenarioResults.S4.pass}`)

    // ── S5: D2 LIVE RESULT — the Leader-facing action result carries the
    // C1/C2 frozen structured result ────────────────────────────────────────
    const s5 = makeScenarioCtx('S5 D2 LIVE RESULT — a delegated work item on the member: a real Leader turn on ROOT_B whose mock-replied tool call executes team_delegate (continue form, the existing member instance). The Leader-facing ACTION RESULT — read through the same public seam the Leader model sees it (the Leader own real model request, whose role=tool message carries the tool result; the durable ROOT_B log carries the same event) — carries the C1/C2 frozen structured result: the tool layer executed with effect.memberResult = {requestToken, status:"succeeded", body:<the member business body>} (C2: deliver() returns the frozen WorkDeliveryResult; the work-admitted effect copies memberResult on the delegate path)')
    const mwPrompt = await apiPrompt(inst.origin, inst.cookie, ROOT_B, `G5A leader turn ${MW}: delegate a work unit to the worker member and confirm its result.`)
    s5.evidence.mwPrompt = { status: mwPrompt.status, body: mwPrompt.body }
    s5.check('Leader MW prompt accepted on ROOT_B', mwPrompt.status === 200 && mwPrompt.body?.result?.ok === true, `status=${mwPrompt.status}`)
    const ackMW = await waitForLogLineJson(DSH_HOME, ROOT_B, (l) => l?.type === 'assistant/message' && JSON.stringify(l.data?.message?.content ?? '').includes(`${MW}_LEAD_ACK`), 240_000)
    s5.check('Leader MW turn settled (the delegate tool call blocked until the member work turn settled; the assistant ack is durable in ROOT_B)', ackMW !== null, ackMW === null ? 'no assistant ack within 240s' : 'assistant ack present')
    // The Leader-facing action result: the Leader's own next model request
    // carries the tool result in a role=tool message (the same public seam
    // the Leader model sees).
    const mwResultReq = requestForMarker(mock, MW, { isMember: false, lastIsTool: true })
    const mwToolText = mwResultReq === null ? '' : wireText(mwResultReq.msgs.at(-1)?.content)
    s5.evidence.leaderFacingResult = { captureSeq: mwResultReq?.req.seq ?? null, text: mwToolText.slice(0, 1500) }
    // Parse the frozen structured result (robust to string vs array tool
    // content, and to any top-level wrapping); fall back to regex extraction.
    const mwParsed = (() => {
      try {
        const p = JSON.parse(mwToolText)
        if (p && typeof p === 'object') {
          if (p.effect && typeof p.effect === 'object' && p.effect.memberResult) return { mr: p.effect.memberResult, top: p, via: 'parsed.effect' }
          if (p.memberResult) return { mr: p.memberResult, top: p, via: 'parsed.top' }
        }
      } catch { /* not pure JSON — fall through */ }
      const m = mwToolText.match(/"memberResult"\s*:\s*(\{[^{}]*\})/)
      if (m) { try { return { mr: JSON.parse(m[1]), top: null, via: 'regex' } } catch { /* fall through */ } }
      return null
    })()
    s5.evidence.memberResultExtract = mwParsed === null ? null : { via: mwParsed.via, memberResult: mwParsed.mr, toolLayerStatus: mwParsed.top?.status ?? null }
    const mwMr = mwParsed?.mr
    s5.check('the Leader-facing action result carries the memberResult structured payload (the delegate tool result the Leader model saw)', mwMr !== null, mwParsed === null ? mwToolText.slice(0, 300) : `via=${mwParsed.via}`)
    s5.check('the memberResult carries the frozen status "succeeded" (C1: deliver() succeeded = completed + last non-empty assistant text)', mwMr?.status === 'succeeded', `status=${JSON.stringify(mwMr?.status ?? null)}`)
    s5.check('the memberResult carries the FRESH requestToken (WORK_TOK)', mwMr?.requestToken === WORK_TOK, `requestToken=${JSON.stringify(mwMr?.requestToken ?? null)}`)
    s5.check('the memberResult body IS the member business body (the member actually did the work)', typeof mwMr?.body === 'string' && mwMr.body.includes(WORK_BODY), `body=${JSON.stringify(mwMr?.body ?? null).slice(0, 200)}`)
    s5.check('the tool layer reports status "executed" (the tool layer envelope around the effect)', mwParsed?.top?.status === 'executed' || mwToolText.includes('"status":"executed"') || mwToolText.includes('executed'), `toolLayerStatus=${JSON.stringify(mwParsed?.top?.status ?? null)}`)
    // Durable ROOT_B: the team_delegate tool/call + the correlated tool/result.
    const rootLog5 = readSessionLog(DSH_HOME, ROOT_B)
    const mwCallLine = rootLog5?.lines.find((l) => l?.type === 'tool/call' && l.data?.name === 'team_delegate' && callArgsOf(l)?.requestToken === WORK_TOK) ?? null
    s5.evidence.rootBDelegateCall = mwCallLine === null ? null : { seq: mwCallLine.seq, callId: mwCallLine.data?.callId, name: mwCallLine.data?.name, rootSessionId: callArgsOf(mwCallLine)?.rootSessionId ?? null, requestToken: callArgsOf(mwCallLine)?.requestToken ?? null, delegationInstanceId: callArgsOf(mwCallLine)?.delegationInstanceId ?? null }
    s5.check('the durable ROOT_B log carries the real team_delegate tool/call event', mwCallLine !== null, JSON.stringify(s5.evidence.rootBDelegateCall))
    const mwResultLine = mwCallLine !== null ? (rootLog5?.lines.find((l) => l?.type === 'tool/result' && resultCallIdOf(l) === mwCallLine.data?.callId) ?? null) : null
    const mwDurableText = mwResultLine === null ? '' : resultTextOf(mwResultLine)
    s5.evidence.rootBDelegateResult = { seq: mwResultLine?.seq ?? null, hasMemberResult: mwDurableText.includes('memberResult'), textHead: mwDurableText.slice(0, 500) }
    s5.check('the durable ROOT_B log carries the correlated tool/result with the memberResult payload', mwDurableText.includes('memberResult'), JSON.stringify(s5.evidence.rootBDelegateResult))
    // The member side: the C2 frozen work delivery text prefix + the business body.
    const memberLog5 = readSessionLog(DSH_HOME, memberState.childSessionId)
    s5.check('the member session log carries the work delivery prefix [team-work requestToken=<WORK_TOK>] (C2 frozen delivery text)', memberLog5?.lines.some((l) => JSON.stringify(l).includes(`[team-work requestToken=${WORK_TOK}]`)) === true, `WORK_TOK=${WORK_TOK}`)
    s5.check('the member session log carries the member business body as a real assistant message', memberLog5?.lines.some((l) => l?.type === 'assistant/message' && JSON.stringify(l.data?.message?.content ?? '').includes(WORK_BODY)) === true, WORK_BODY.slice(0, 200))
    scenarioResults.S5 = s5.finish()
    log(`S5: pass=${scenarioResults.S5.pass}`)

    // ── S6: D3 LIVE IDENTITY — the member model-request identity block ─────
    const s6 = makeScenarioCtx('S6 D3 LIVE IDENTITY — from the member model-request messages (mock capture — the real dsh-llm adapter wire): the agent-scoped prompt (system text) contains the B2 scoped team-member-context block with the OWNING root session id (ROOT_B), the member OWN instanceId, role=member, and the fresh-requestToken rule line — verbatim')
    const mfCallReq = requestForMarker(mock, MF, { isMember: true, lastIsTool: false, pick: 'first' })
    const expectedBlock = memberState.instanceId !== null ? memberBlock(ROOT_B, memberState.instanceId) : null
    // The durable request/header event is the harness's own record of the
    // SAME first member model request (the model-visible system prompt) —
    // it corroborates the wire capture.
    const memberLog6 = readSessionLog(DSH_HOME, memberState.childSessionId)
    const headerLine6 = memberLog6?.lines.find((l) => l?.type === 'request/header') ?? null
    const durableSys = headerLine6 !== null && typeof headerLine6.data?.header?.system === 'string' ? headerLine6.data.header.system : ''
    const captureSys = mfCallReq === null ? null : mfCallReq.systemText
    s6.evidence = {
      captureSeq: mfCallReq?.req.seq ?? null,
      captureSystemText: captureSys === null ? null : captureSys.slice(0, 4000),
      durableHeaderSeq: headerLine6?.seq ?? null,
      durableSystemText: durableSys.slice(0, 4000),
      expectedBlock,
    }
    const captureHas = captureSys !== null && expectedBlock !== null && captureSys.includes(expectedBlock)
    const durableHas = expectedBlock !== null && durableSys.includes(expectedBlock)
    s6.check('the member model request system text carries the EXACT B2 team-member-context block (owning root ROOT_B + member OWN instanceId + role=member + the fresh-requestToken rule line) — verified on the wire capture, corroborated by the durable request/header record', (captureHas || durableHas), `capture=${captureSys === null ? 'n/a' : captureHas} durable=${durableSys === '' ? 'n/a' : durableHas}`)
    const noRootCapture = captureSys !== null && !captureSys.includes('[team-root-context')
    const noRootDurable = durableSys !== '' && !durableSys.includes('[team-root-context')
    s6.check('the member model request system text does NOT carry the team-ROOT context block (member, not root)', (captureSys === null ? noRootDurable : noRootCapture) && (durableSys === '' ? noRootCapture : noRootDurable), `capture=${captureSys === null ? 'n/a' : captureSys.includes('[team-root-context')} durable=${durableSys === '' ? 'n/a' : durableSys.includes('[team-root-context')}`)
    scenarioResults.S6 = s6.finish()
    log(`S6: pass=${scenarioResults.S6.pass}`)

    // ── S7: ORDINARY SESSION NON-REGRESSION ─────────────────────────────────
    const s7 = makeScenarioCtx('S7 ORDINARY SESSION NON-REGRESSION — an ordinary (non-Team) session on the same host, created over the public POST /api/session/create; its session-local model selection steered at the mock-reachable provider over the public POST /api/session/selectModel seam (deepseek-official — the same provider the team row drives; the deepseek adapter resolveModel is a LOCAL lookup, no provider I/O); its tool table captured from the REAL model request has NO team_* tool (while the standard preset read/pwsh are); a basic turn completes; the deployment default model is restored afterwards')
    const createOrd = await apiCreate(inst.origin, inst.cookie, ORDINARY, WORKSPACE)
    s7.evidence.ordinaryCreate = { status: createOrd.status, body: createOrd.body }
    s7.check('ordinary session created over the public session/create seam', createOrd.status === 200 && createOrd.body?.result?.ok === true, JSON.stringify(createOrd.body).slice(0, 300))
    const selMock = await apiSelectModel(inst.origin, inst.cookie, ORDINARY, MODEL_PROVIDER, 'g5a-ordinary')
    s7.evidence.selectModelMock = { status: selMock.status, body: selMock.body }
    s7.check('session-local model selection steered to the mock-reachable provider (selectModel public seam)', selMock.status === 200 && selMock.body?.result?.ok === true, JSON.stringify(selMock.body).slice(0, 300))
    const moPrompt = await apiPrompt(inst.origin, inst.cookie, ORDINARY, `ordinary acceptance turn ${MO}: basic sanity turn on a non-team session — confirm you can see your file tools.`)
    s7.evidence.moPrompt = { status: moPrompt.status, body: moPrompt.body }
    const ackMO = await waitForLogLineJson(DSH_HOME, ORDINARY, (l) => l?.type === 'assistant/message' && JSON.stringify(l.data?.message?.content ?? '').includes(`${MO}_ACK`), 180_000)
    s7.check('ordinary basic turn completed (the assistant ack is durable in the ordinary session log)', ackMO !== null, ackMO === null ? 'no assistant ack within 180s' : 'assistant ack present')
    const ordinaryLog = readSessionLog(DSH_HOME, ORDINARY)
    s7.check('the ordinary session log carries a turn/end event (the turn fully settled)', ordinaryLog?.lines.some((l) => l?.type === 'turn/end') === true, `turnEndLines=${ordinaryLog?.lines.filter((l) => l?.type === 'turn/end').length}`)
    const ordinaryTable = toolTableOf(mock, MO)
    s7.evidence.ordinaryToolTable = ordinaryTable === null ? null : { seq: ordinaryTable.seq, model: ordinaryTable.model, toolNames: ordinaryTable.toolNames }
    if (ordinaryTable !== null) {
      const names = ordinaryTable.toolNames
      const teamInOrdinary = names.filter((n) => n.startsWith('team_'))
      s7.evidence.ordinaryTeamTools = teamInOrdinary
      s7.evidence.ordinaryBaseTools = names.filter((n) => !n.startsWith('team_'))
      s7.check('the ordinary session tool table has NO team_* tool (non-regression: Team capability is not leaking into ordinary sessions)', teamInOrdinary.length === 0, `tools=${JSON.stringify(names)}`)
      s7.check("the ordinary session still has the standard preset 'read' + 'pwsh' base tools", names.includes('read') && names.includes('pwsh'), `tools=${JSON.stringify(names)}`)
      s7.note(`ordinary tool table (${names.length} tools): ${JSON.stringify(names)}`)
    } else {
      s7.check('the ordinary session tool table has NO team_* tool (non-regression: Team capability is not leaking into ordinary sessions)', false, '<no ordinary request captured>')
      s7.check("the ordinary session still has the standard preset 'read' + 'pwsh' base tools", false, '<no ordinary request captured>')
    }
    // Restore the deployment default model (the selectModel side effect:
    // session-controller saveSelection also persists the deployment default
    // — restore it to the test home's real provider and record the move).
    const selRestore = await apiSelectModel(inst.origin, inst.cookie, ORDINARY, ORDINARY_DEFAULT_PROVIDER, ORDINARY_DEFAULT_MODEL)
    s7.evidence.selectModelRestore = { status: selRestore.status, body: selRestore.body }
    s7.check('deployment default model RESTORED to qiyuan-self/qwen3.8-27b (the test home real provider; the selectModel side effect is undone)', selRestore.status === 200 && selRestore.body?.result?.ok === true, JSON.stringify(selRestore.body).slice(0, 300))
    s7.note('state change recorded: the shared home deployment default model moved to deepseek-official/g5a-ordinary during the ordinary turn and back to qiyuan-self/qwen3.8-27b after S7 (the documented saveSelection side effect)')
    scenarioResults.S7 = s7.finish()
    log(`S7: pass=${scenarioResults.S7.pass}`)
  } catch (error) {
    log(`FATAL: ${error instanceof Error ? error.stack : String(error)}`)
    scenarioResults.FATAL = { pass: false, error: String(error?.message ?? error).slice(0, 4000) }
  } finally {
    // ── S8: cleanup ─────────────────────────────────────────────────────────
    const s8 = makeScenarioCtx('S8 CLEANUP — the test host stops; port 3180 is free and the host process is gone; test-use is pristine after (porcelain empty + HEAD unchanged); the mock capture + summary.json are written')
    try {
      let stopRes = null
      if (inst !== null) {
        stopRes = await stopInstance(inst)
      }
      s8.evidence.stop = stopRes
      const portFreeAfter = await waitForPortFree(PORT, 20_000)
      const portBusyAfter = await probePortBusy(PORT)
      s8.evidence.portAfter = { portFreeAfter, portBusyAfter }
      s8.check('the test host stopped and port 3180 is free (no host process left behind)', stopRes?.portFree === true || portFreeAfter === true, `stop=${JSON.stringify(stopRes)} portFreeAfter=${portFreeAfter} portBusyAfter=${portBusyAfter}`)
      // The full mock capture (every model request the real dsh-llm adapter
      // wire made — the S3/S4/S5/S6 evidence base), the per-request
      // classification debug dump, and the remote-call ledger — all written
      // BEFORE the git step so a git-step failure can never lose the evidence.
      dumpRequestDebug(REPORT_DIR, mock)
      writeFileSync(join(REPORT_DIR, 'mock-capture.json'), JSON.stringify({ requests: mock.requests }, null, 2))
      writeFileSync(join(REPORT_DIR, 'remote-call-ledger.json'), JSON.stringify(remoteCallLedger, null, 2))
      try { mock.close() } catch { /* already closed */ }
      mkdirSync(join(REPORT_DIR, 'git-post'), { recursive: true })
      const postGit = await captureGitState(HOST_TREE, join(REPORT_DIR, 'git-post'))
      s8.evidence.testUsePost = { head: postGit.head, headSource: postGit.headSource, statusEmpty: postGit.statusEmpty, diffEmpty: postGit.diffEmpty, errors: postGit.errors }
      s8.check('test-use HEAD still == 76fda729 after the run', postGit.head === EXPECTED_HOST_SHA, `head=${postGit.head}`)
      s8.check('test-use git status --porcelain empty (post)', postGit.statusEmpty, `status=${JSON.stringify(postGit.status.slice(0, 300))}`)
      const stablePost = await fetchJson(STABLE_URL, undefined, 10_000).catch((e) => ({ status: null, body: String(e) }))
      s8.evidence.stablePost = { url: STABLE_URL, httpStatus: stablePost.status }
      s8.check('stable :3080 still reachable after the run (untouched — read-only probe only)', stablePost.status !== null, `status=${stablePost.status}`)
    } catch (error) {
      s8.evidence.s8Crash = error instanceof Error ? error.stack : String(error)
      s8.check('S8 cleanup completed without error', false, `S8 threw: ${String(error?.message ?? error).slice(0, 400)}`)
    }
    scenarioResults.S8 = s8.finish()
    log(`S8: pass=${scenarioResults.S8.pass}`)

    // ── summary.json (the D4 runner shape) — ALWAYS written ─────────────────
    let summaryPass = false
    try {
    const stepKeys = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']
    const allPass = stepKeys.every((k) => scenarioResults[k]?.pass === true)
    const summary = {
      task: 'G5A-live-host-member-e2e',
      plan: 'Team D1-D6 repair v2 — 15.1 acceptance-matrix row "D1 member tools" + D2 live result + D3 live identity + ordinary session non-regression',
      nonce: NONCE,
      startedAt: new Date(t0).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      host: { source: HOST_TREE, baselineSha: EXPECTED_HOST_SHA, home: DSH_HOME, port: PORT, worktree: WORKTREE_ROOT },
      roots: { directiveRowRoot: ROOT_A, dynamicTeamRoot: ROOT_B, ordinary: ORDINARY },
      member: { instanceId: memberState.instanceId, childSessionId: memberState.childSessionId, workspace: MEMBER_WS },
      scenarios: scenarioResults,
      pass: allPass,
      boundary: {
        stableInstance: 'read-only GET probe on :3080 pre + post only; no operation was ever sent to the stable instance or D:\\deepseek-harness',
        testUse: 'references/deepseek-harness-test-use verified pristine before and after (porcelain empty + HEAD pinned at 76fda729)',
        sharedHome: 'pre-existing roots preserved (nonce-unique roots accumulate, as in every previous run); the deployment default model moved by the S7 selectModel side effect and was RESTORED to qiyuan-self/qwen3.8-27b (recorded in S7 evidence)',
        process: 'the host process is stopped; port 3180 verified free after stop',
        publicSeamsUsed: [
          'profile-patch seam (profiles/web/cordis.patch.yml): the production dist host row + the p6t6 observability row mount',
          'remote team.create (v2): the dynamic team root ROOT_B (the browser-facing public channel the Team UI New-Team entry drives)',
          'remote team.listRoots (v3): host-authority root enumeration',
          'api/session/prompt: ROOT_B leader turns (S2 member create, S5 delegate) + the member child session (S4a/b/c real tool turns) — the public member-session prompt path; session-controller resolve() prefers the live agent',
          'api/session/create + api/session/selectModel: the ordinary session (S7) + the session-local model steering (side effect restored)',
          'p6t6 observability seam: team_list_members on ROOT_B (S2)',
          'the mock capture of REAL model requests (the real dsh-llm adapter wire): S3 tool table, S4 tool calls/results, S5 Leader-facing action result, S6 identity block',
          'the durable zstd session logs: every turn/tool event',
        ],
        notExercised: [
          'remote team.admitInitialWork (not needed — the delegation went through the team_delegate tool on the existing member)',
          'the member UI entry (this matrix row is the agent-side D1 row)',
        ],
      },
    }
    writeFileSync(join(REPORT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
    log(`== done: pass=${summary.pass} (duration ${(summary.durationMs / 1000).toFixed(1)}s) ==`)
    summaryPass = summary.pass
    } catch (error) {
      log(`summary write failed: ${error instanceof Error ? error.stack : String(error)}`)
    }
    if (!summaryPass) process.exitCode = 1
  }
}

main().catch((error) => {
  log(`FATAL main: ${error instanceof Error ? error.stack : String(error)}`)
  process.exitCode = 1
})
