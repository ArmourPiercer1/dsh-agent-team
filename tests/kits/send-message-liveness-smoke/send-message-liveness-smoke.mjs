#!/usr/bin/env node
/**
 * send-message-liveness-smoke.mjs — the team_send_message ACCEPTANCE
 * BOUNDARY real-host smoke on a pristine DSH 0.1.5-rc.2 checkout. Plan:
 * docs/plans/active/team_send_message_liveness_fix_guide.md §13
 * (scenarios A/B/C).
 *
 * WHAT IT PROVES (the liveness fix on a real host):
 *
 *   A — Leader → Member: `team_send_message` returns `status: delivered`
 *       promptly: the leader's model chain carries the delivered tool
 *       result (the sender's turn ENDED) — and the member's bound
 *       session then independently processes the attributed input (a new
 *       model request on the member carrying the message text).
 *   B — Member → Leader: on the member's message-triggered turn the
 *       member calls `team_send_message(Leader, ...)` and that send also
 *       returns `delivered` promptly; the leader receives the reply as a
 *       NEW model request and runs a new turn. Neither agent waits for
 *       the other to be idle (no cross-Agent whenIdle cycle).
 *   C — THE KEY SCENARIO: the member's message-triggered turn is
 *       DELIBERATELY LONG — its first model call takes 8 s to respond
 *       (a long in-flight model call = a real agent reasoning/working;
 *       chosen over a bash step because the α.2 permission contract
 *       rejects any positive whole-tool allow for shell-class tools on
 *       MEMBER templates — the allow-lane exec exception is LEADER-
 *       scoped only; the mock harness therefore supports an async
 *       decide that keeps the model call in flight). The wire-level
 *       proof: let
 *         tW1 = the member's FIRST model request of the message turn
 *               (the attributed input accepted; the turn starts)
 *         tL4 = the leader's model request carrying the
 *               team_send_message TOOL RESULT (status delivered — the
 *               sender's tool call has returned)
 *         tW2 = the member's SECOND model request (after the long work
 *               step; the member turn is still running)
 *       the criterion is tW1 < tL4 < tW2 (with tW2 − tW1 ≥ 7 s): the
 *       sender's tool completed while the recipient was still RUNNING.
 *       Pre-fix this window is inverted (the send only returns after
 *       the member's whole turn — tL4 > tW2 and the leader turn hangs
 *       for the duration of the member's work).
 *
 *   Durable semantics (unchanged by the fix, still verified): the team
 *   ledger carries exactly the two `team-coordination-recorded` intents
 *   and the two `team-message-delivered` confirmations (one per
 *   direction, correlated by requestToken, each confirmation sequenced
 *   after its intent).
 *
 * TOPOLOGY (one created team on one production row):
 *   - Boot/anchor team (ROOT): the plain anchor leader; used for the
 *     L0 discovery of the model-facing tool surface (the strict
 *     blueprint deny list needs the live surface).
 *   - SML team (CREATE_ROOT, fresh root): the scenario team. The
 *     LEADER (the fresh root's agent) creates one worker, sends it the
 *     probe message, and stops. The WORKER runs the long turn (its
 *     first model call is held in flight 8 s), replies to the leader,
 *     and stops. The leader processes the reply in a new turn.
 *
 * DESIGN NOTES:
 *   - The mock model is a decision oracle (the WCN/C1/rc2 pattern):
 *     chain routing is over the LAST marker-bearing user message + the
 *     tool messages AFTER it (a session's request history carries every
 *     earlier chain's tool results — the C1 LIVE-FOUND lesson). No
 *     test-only decision injection: every tool the mock admits is a
 *     real model-facing team tool.
 *   - The member instance id (the leader's send target) and the leader
 *     instance id (the worker's reply target) are discovered from a
 *     real `team_list_members` tool result — the mock never hardcodes
 *     ids.
 *   - Durable evidence: the plugin's TeamDomain ledger in
 *     `<DSH_HOME>/storages/team_domain.json` (read-only scan) + the
 *     mock request corpus (every model request with receivedAt — the
 *     tW1/tL4/tW2 ordering is taken from the corpus, not inferred).
 *   - WORLD: host = the pristine test-use checkout (DSH 0.1.5-rc.2 @
 *     fb2c4b9e69) launched as `node <testuse>/apps/cli/lib/bin.js web`
 *     with cwd = a scratch session workspace; env: DSH_HOME=<world home
 *     under tests/homes/>, DSH_CLIENT_COMMIT_HASH=fb2c4b9e69,
 *     DEEPSEEK_BASE_URL=<in-process mock model>. Plugin rows mounted
 *     ONLY through the public profile-patch seam (production row = the
 *     WORKTREE's dist — the send-message-liveness branch build).
 *   - MARKER DISCIPLINE (LIVE-FOUND, run 3): a user message carrying
 *     TWO scenario markers mis-routes the chain selector (the member
 *     MK_PAYLOAD branch is checked before the leader MK_START branch,
 *     so a leader prompt embedding the MK_PAYLOAD body text was routed
 *     into the member chain → a 500-retry loop). Every message carries
 *     EXACTLY ONE marker: the leader's initialWork prompt carries only
 *     MK_START; the MK_PAYLOAD / MK_REPLY bodies are injected by the
 *     mock into the actual tool-call arguments (they surface as user
 *     messages only on the RECIPIENT's session).
 *   - The production row must carry the FIX: the preflight asserts the
 *     dist glue contains the acceptance-boundary marker (a stale dist
 *     would silently re-test the old whenIdle boundary — a green
 *     verdict against the wrong code).
 *   - ZERO-TOUCH: the live instances :3080 and :3180 are probed
 *     read-only (status recorded pre/post) and never written to. Do
 *     NOT run this kit in parallel with a full `vitest` run (shared
 *     port family + CPU load).
 *
 * USAGE:
 *   node tests/kits/send-message-liveness-smoke/send-message-liveness-smoke.mjs \
 *     [--worktree <path>] [--testuse <path>] [--host-port N] \
 *     [--mock-port N] [--evidence-dir <path>] [--keep]
 *   defaults: --worktree = the repo root containing this kit (3 levels
 *   up), --testuse = <worktree>/tests/deepseek-harness-test-use (fallback:
 *   the parent repo's tests/deepseek-harness-test-use — the gitignored
 *   checkout only exists in the main checkout, not in task worktrees),
 *   host port = first free of the 3491–3500 family (mock port aside),
 *   mock port = 3496, evidence dir =
 *   dev/agent-workflow/evidence/send-message-liveness/smoke/
 *   sml-smoke-<stamp>/.
 *
 * EXIT: 0 = all criteria pass; 2 = a criterion failed (full evidence
 * dump in the evidence dir); 1 = fatal (environment/boot/row).
 */

import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
// The domain's identity-level inspector (same dist module the production
// host resolves): saved blueprints that fail INSPECTION are silently
// absent from the catalog ("blueprint not found in catalog" at
// team.create) — validate every written source up front (fail fast with
// the exact diagnostics instead of a 300s mock timeout).
import { inspectBlueprintSource } from '../../../packages/runtime/dist/packages/domain/blueprint/src/index.js'

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function argValue(name, dflt) {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = args[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}
const FLAG_KEEP = args.includes('--keep')

const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(KIT_DIR, '..', '..', '..')))
let TESTUSE = resolve(argValue('testuse', join(WORKTREE, 'tests', 'deepseek-harness-test-use')))
// The gitignored test-use checkout exists only in the MAIN checkout, not
// in task worktrees (<main>/.worktrees/<task>). Fallback: parent repo.
if (!existsSync(TESTUSE) && existsSync(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))) {
  TESTUSE = resolve(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))
}
const MOCK_PORT = Number(argValue('mock-port', 3496))
const EVIDENCE_DIR_ARG = argValue('evidence-dir', null)

// ── frozen facts ────────────────────────────────────────────────────────────

const HOST_BASELINE_SHA = 'fb2c4b9e698e30edb738bca4cf0618587db7d203' // DSH 0.1.5-rc.2 release point
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'host.js')
const GLUE_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_PLUGIN_PATH = join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href
const GLUE_URL = pathToFileURL(GLUE_PATH).href
const SEAM_URL = pathToFileURL(SEAM_PATH).href
const P6T6_ROW_NAME = pathToFileURL(P6T6_PLUGIN_PATH).href

// The acceptance-boundary marker that MUST be in the dist the production
// row mounts (the preflight proof that this kit tests the FIX, not the
// old whenIdle boundary that a stale dist would silently re-test).
const FIX_MARKER = 'Success boundary = inbox acceptance'

const SMOKE_PRESET_ID = 'sml-smoke'
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
// The team tool catalog this smoke's surface check expects on the boot
// root (the closed twelve of the vNext tool layer).
const TEAM_TOOL_CATALOG = [
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
  'team_list_pending_control',
]
// The Leader teamTools allow list (the closed subset this smoke drives):
// create the worker, discover instance ids, send the probe message.
const LEADER_TEAM_TOOLS_ALLOW = [
  'team_list_members',
  'team_create_member',
  'team_send_message',
]
// The Worker teamTools allow list (the closed subset this smoke drives):
// reply to the leader + discover instance ids.
const WORKER_TEAM_TOOLS_ALLOW = [
  'team_list_members',
  'team_send_message',
]

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').replace('T', 'T').slice(0, 19)
const RUN_DIR = EVIDENCE_DIR_ARG
  ? resolve(EVIDENCE_DIR_ARG)
  : join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'send-message-liveness', 'smoke', `sml-smoke-${RUN_STAMP}`)
const HOME = join(WORKTREE, 'tests', 'homes', `sml-smoke-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const BLUEPRINT_DIR = join(WORKTREE, `.sml-smoke-blueprints-${RUN_STAMP}`)

const ROOT = `session-sml-smoke-root-${RUN_STAMP}`
const CREATE_ROOT = `session-sml-smoke-team-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.sml-anchor'
const BP_SML_ID = 'team.sml-smoke'

// Distinct markers (no substring collisions).
const MK_DISC = `SMLK_DISC_${RUN_STAMP}`
const MK_START = `SMLK_START_${RUN_STAMP}`
const MK_PAYLOAD = `SMLK_PAYLOAD_${RUN_STAMP}`
const MK_REPLY = `SMLK_REPLY_${RUN_STAMP}`
// Deterministic tool-call request tokens (the durable ledger correlation).
const TOK_CREATE = `sml-create-${RUN_STAMP}`
const TOK_LISTL = `sml-listl-${RUN_STAMP}`
const TOK_SEND = `sml-send-${RUN_STAMP}`
const TOK_LISTM = `sml-listm-${RUN_STAMP}`
const TOK_REPLY = `sml-reply-${RUN_STAMP}`
// Terminal texts (asserted verbatim in the mock corpus).
const W_LEADER_DONE = `SMLW_LEADER_DONE_${RUN_STAMP}`
const W_MEMBER_DONE = `SMLW_MEMBER_DONE_${RUN_STAMP}`
const W_LEADER2_DONE = `SMLW_LEADER2_DONE_${RUN_STAMP}`
// The member's deliberately long first model call (the C scenario): the
// async mock decide holds this request in flight for this many ms before
// responding — a real "long turn" (long reasoning / long tool work), not
// a bash step (the α.2 permission contract forbids a positive whole-tool
// allow for shell-class tools on MEMBER templates).
const LONG_TURN_MS = 8000

/** A resolved-after delay (the mock decide is awaited by the harness). */
function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── logging / criteria / fatals ─────────────────────────────────────────────

let RUN_LOG = null
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  if (RUN_LOG !== null) {
    try {
      writeFileSync(RUN_LOG, stamped + '\n', { flag: 'a' })
    } catch { /* evidence best-effort */ }
  }
}

const criteria = []
function check(critId, name, ok, detail) {
  criteria.push({ id: critId, name, ok: ok === true, detail: String(detail ?? '') })
  log(`${ok === true ? 'PASS' : 'FAIL'} ${critId}: ${name}${detail === '' || detail === undefined ? '' : ` — ${String(detail).slice(0, 500)}`}`)
  return ok === true
}

function writeEvidence(name, content) {
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    writeFileSync(join(RUN_DIR, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2))
  } catch { /* best-effort */ }
}

function dieFatal(msg, exitCode = 1) {
  log(`FATAL ${msg}`)
  writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: msg, criteria })
  process.exit(exitCode)
}

// ── small http helpers (a2x/rc2/C1/WCN kit shape) ───────────────────────────

async function fetchJson(url, init, timeoutMs = 60_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ status: 0, body: null, error: e.message }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body }
}

async function probeStableInstance(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) }).catch(() => null)
  return { url, status: res === null ? 'unreachable' : res.status }
}

async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) {
    throw new Error(`dsh web authentication returned HTTP ${res.status} (expected 303 + set-cookie)`)
  }
  return setCookie.split(';', 1)[0]
}

/** One browser-facing public Remote call: POST /team-remote/<method>. */
async function remoteCall(origin, cookie, method, params, tag = 'sml', version = 1) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version, params },
    }),
  }, 240_000)
}

/** One user turn on the DSH core public channel: POST /api/session/prompt. */
async function apiPrompt(origin, cookie, sessionId, text, tag = 'sml') {
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
  }, 240_000)
}

async function p6t6State(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 30_000)
}

async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}

function logTail(logPath, n = 25) {
  try {
    return readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n')
  } catch {
    return '<no log>'
  }
}

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

async function waitForLogLine(logPath, regex, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  let seen = 0
  for (;;) {
    let text = ''
    try {
      text = readFileSync(logPath, 'utf8')
    } catch { /* not written yet */ }
    const lines = text === '' ? [] : text.split('\n')
    for (let i = seen; i < lines.length; i += 1) {
      const m = regex.exec(lines[i])
      if (m !== null) return lines[i]
    }
    seen = lines.length
    if (Date.now() >= deadline) break
    if (alive !== undefined && !alive()) return null
    await new Promise((r) => setTimeout(r, 300))
  }
  try {
    const full = readFileSync(logPath, 'utf8')
    for (const l of full.split('\n')) {
      const m = regex.exec(l)
      if (m !== null) return l
    }
  } catch { /* best-effort */ }
  return null
}

// ── preflight ───────────────────────────────────────────────────────────────

function preflight() {
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' })
  if (rev.status !== 0 || rev.stdout.trim() !== HOST_BASELINE_SHA) {
    dieFatal(`test-use checkout is not at ${HOST_BASELINE_SHA} (got ${rev.stdout?.trim() ?? rev.stderr})`)
  }
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' })
  if (dirty.status !== 0 || dirty.stdout.trim() !== '') {
    dieFatal(`test-use checkout is not pristine: ${dirty.stdout?.trim().slice(0, 200)}`)
  }
  for (const p of [HOST_BIN, PRODUCTION_ROW_PATH, GLUE_PATH, SEAM_PATH, P6T6_PLUGIN_PATH]) {
    if (!existsSync(p)) dieFatal(`required file missing: ${p}`)
  }
  // The liveness fix must actually be in the dist the row mounts.
  const glue = readFileSync(GLUE_PATH, 'utf8')
  if (!glue.includes(FIX_MARKER)) {
    dieFatal(`the worktree dist glue does not carry the acceptance-boundary fix (${FIX_MARKER}) — run pnpm build && pnpm build:composition in the worktree first`)
  }
}

async function portFree(port, timeoutMs = 1500) {
  const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ error: e }))
  if (res.error) return true
  return false
}

async function pickHostPort() {
  if (args.includes('--host-port')) return Number(argValue('host-port', 0))
  // The 3180 family per TEST_METHODS (3491–3500), the mock port aside.
  for (const p of [3491, 3492, 3493, 3494, 3495, 3497, 3498, 3499, 3500]) {
    if (await portFree(p)) return p
  }
  dieFatal('no free host port in the 3491–3500 family')
}

// ── world materialization ───────────────────────────────────────────────────

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
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

function teamRowConfig() {
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: BLUEPRINT_DIR,
    rootPresetId: SMOKE_PRESET_ID,
    memberPresetId: SMOKE_PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'sml-smoke-model' },
    deniedSelection: null,
    mcpServers: [],
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

/** The row anchor: a plain legacy leader (the 0.1.0-rc.1 boot shape). */
const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 1',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  `  persona: "You are the leader of the send-message liveness smoke boot team. ${MK_DISC} is the discovery marker."`,
  'members:',
  '  - templateId: worker',
  '    persona: "You are a worker of the send-message liveness smoke boot team."',
  'memberEnvelopes: []',
  'requirements: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

/**
 * The scenario team's saved-source strict blueprint. The Leader declares
 * the closed teamTools allow set (strict Coverage Gate) + the C1-kit
 * permission block. The WORKER may call the two addressing/messaging
 * team tools only — its long turn is a long MODEL call (the mock's async
 * decide), NOT a bash step: the α.2 permission contract rejects any
 * positive whole-tool allow for shell-class tools on MEMBER templates
 * (the allow-lane exec exception is LEADER-scoped — live-verified: a
 * worker `allow: bash` blueprint is MALFORMED_DTO at team.create).
 * Member envelopes allow send-message + report-progress (the
 * worker→leader reply is a direct send per the relay policy).
 */
function savedBlueprintYaml(bpId, leaderPersona, workerPersona, denyList) {
  const denyLines = (list, baseIndent) => {
    const pad = '  '.repeat(baseIndent)
    return list.length === 0
      ? [`${pad}builtinToolDeny: []`]
      : [`${pad}builtinToolDeny:`, ...list.map((n) => `${pad}  - ${n}`)]
  }
  const leaderBlock = [
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(leaderPersona)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    ...LEADER_TEAM_TOOLS_ALLOW.map((t) => `        - ${t}`),
    ...denyLines(denyList, 2),
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: read',
    '          resource:',
    '            kind: subtree',
    '            path: team',
    '      ask:',
    '        - tool: bash',
    '          resource:',
    '            kind: any',
    '      deny:',
    '        - tool: read',
    '          resource:',
    '            kind: subtree',
    '            path: runtime',
  ]
  const workerBlock = [
    'members:',
    '  - templateId: worker',
    `    persona: ${JSON.stringify(workerPersona)}`,
    '    capabilities:',
    '      teamTools:',
    '        kind: allow',
    '        items:',
    ...WORKER_TEAM_TOOLS_ALLOW.map((t) => `          - ${t}`),
    ...denyLines(denyList, 3),
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    '      permissions:',
    '        default: ask',
    '        allow:',
    '          - tool: read',
    '            resource:',
    '              kind: subtree',
    '              path: team',
    '        ask:',
    '          - tool: bash',
    '            resource:',
    '              kind: any',
    '        deny:',
    '          - tool: read',
    '            resource:',
    '              kind: subtree',
    '              path: runtime',
  ]
  const teamEnvelope = [
    'teamEnvelope:',
    '  allow:',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '  deny: []',
  ]
  const memberEnvelope = [
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '      deny: []',
  ]
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    ...leaderBlock,
    ...teamEnvelope,
    ...workerBlock,
    ...memberEnvelope,
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

function writeSmokePreset(home) {
  const dir = join(home, '.agent-presets', SMOKE_PRESET_ID)
  mkdirSync(dir, { recursive: true })
  const text = [
    `# ${SMOKE_PRESET_ID} — send-message liveness real-host smoke preset (run ${RUN_STAMP}).`,
    '# Reused from the C1/rc2/WCN kits (public user-preset seam): persona',
    '# + dsh-tool-fs + the minimal-style persistent shell group (bash',
    '# stack — installed for surface parity; the member long turn is a',
    '# long in-flight MODEL call, not a bash step (α.2 forbids member',
    '# shell-class allow-lane rules). NO',
    '# delegation group: the 0.1.5 spawn `subagent` row is a deferred',
    '# per-agent own-layer install (KNOWN_SENSITIVE under the Coverage',
    '# Gate — followup-backlog 2/5/6).',
    '- id: persona',
    "  name: '@deepseek-ai/dsh-persona'",
    '  config:',
    '    suffix: Your working directory is {{cwd}}.',
    '    prefix: >-',
    '      You are a coding agent powered by the {{model}} model.',
    '- id: tool-fs',
    "  name: '@deepseek-ai/dsh-tool-fs'",
    '- id: persistent-shell',
    '  name: cordis:group',
    '  group: true',
    '  isolate:',
    '    terminals: true',
    '  config:',
    '    - id: pty',
    "      name: '@deepseek-ai/dsh-terminal'",
    '    - id: terminal-bash',
    "      name: '@deepseek-ai/dsh-terminal-bash'",
    '      config:',
    '        timeoutMs: 300000',
    '    - id: persistent-bash',
    "      name: '@deepseek-ai/dsh-tool-bash-persistent'",
    '      config:',
    '        timeoutMs: 300000',
    '        description: Run commands in a bash shell. State is persistent across calls.',
    '',
  ].join('\n')
  writeFileSync(join(dir, 'agent.cordis.yml'), text)
}

function writePatchFile(home) {
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const lines = [
    `# send-message liveness real-host smoke patch layer (run ${RUN_STAMP}): production dsh-agent-team row (worktree dist — the send-message-liveness branch build) + p6t6 observability row — mounted ONLY through the public profile-patch seam.`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    '',
  ]
  writeFileSync(join(home, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
}

// ── the real-host boot (test-use bin) ───────────────────────────────────────

function spawnHost({ port, home, logPath, mockPort }) {
  const outFd = openSync(logPath, 'a')
  const errFd = openSync(logPath, 'a')
  let child
  try {
    child = spawn(
      process.execPath,
      [HOST_BIN, 'web', '--port', String(port), '--no-open'],
      {
        cwd: WORKSPACE,
        stdio: ['ignore', outFd, errFd],
        env: {
          ...process.env,
          DSH_HOME: home,
          DSH_CLIENT_COMMIT_HASH: 'fb2c4b9e69',
          DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
          DEEPSEEK_API_KEY: 'sml-smoke-mock-key',
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
  try {
    h.child.kill()
  } catch { /* already gone */ }
  return h
}

async function bootHost({ port, home, mockPort, instanceLog }) {
  writePatchFile(home)
  writeSmokePreset(home)
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'sml-anchor.yaml'), BP_ANCHOR_YAML)
  writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
    boot: 1,
    phase: 'create',
    reportDir: RUN_DIR,
    runStamp: RUN_STAMP,
    rootSessionId: ROOT,
  }, null, 2))
  const h = spawnHost({ port, home, logPath: instanceLog, mockPort })
  const line = await waitForLogLine(instanceLog, BOOT_MARKER, 240_000, h.alive)
  if (line === null) {
    stopHost(h)
    const detail = h.exitInfo.exited
      ? `process exited (code=${h.exitInfo.code} signal=${h.exitInfo.signal ?? 'none'}${h.exitInfo.message ? ` msg=${h.exitInfo.message}` : ''})`
      : 'no boot marker within 240s'
    dieFatal(`host boot failed: ${detail}\n--- log tail ---\n${logTail(instanceLog)}`)
  }
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(line.replace(/.*dsh web:\s*/, ''))
  if (m === null) dieFatal(`unexpected boot url shape: ${line}`)
  const origin = `http://127.0.0.1:${m[1]}`
  const cookie = await authenticate(origin, m[2]).catch((e) => dieFatal(`auth failed: ${e.message}`))
  const deadline = Date.now() + 240_000
  let health = null
  for (;;) {
    const hb = await p6t6Health(Number(m[1]))
    health = { status: hb.status, body: hb.body }
    if (hb.status === 200 && hb.body?.ok === true) break
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      stopHost(h)
      dieFatal(`row setup failed — setupError: ${String(hb.body.setupError).slice(0, 600)}\n--- log tail ---\n${logTail(instanceLog)}`)
    }
    if (Date.now() >= deadline) {
      stopHost(h)
      dieFatal(`row health not ready in 240s — health=${JSON.stringify(hb.body).slice(0, 400)}\n--- log tail ---\n${logTail(instanceLog)}`)
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  const sDeadline = Date.now() + 90_000
  let state = null
  for (;;) {
    const s = await p6t6State(Number(m[1]))
    state = s
    const b = s.body
    if (s.status === 200 && b !== null && typeof b === 'object'
      && b.rootSessionId === ROOT && b.phase === 'create'
      && b.teamSession !== null && typeof b.teamSession === 'object') break
    if (Date.now() >= sDeadline) {
      stopHost(h)
      dieFatal(`row state not well-formed in 90s; last: status=${s.status} body=${JSON.stringify(s.body).slice(0, 400)}`)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  log(`host booted at ${origin}; row ready — toolCount=${health.body?.toolCount}`)
  return { host: h, port: Number(m[1]), origin, cookie, instanceLog, health, stateBody: state.body }
}

// ── mock decide policy (liveness: leader chain, member chain, reply) ────────

function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-sml-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}

function bodyOf(recordOrBody) {
  if (recordOrBody === null || typeof recordOrBody !== 'object') return null
  return 'body' in recordOrBody ? (recordOrBody.body ?? null) : recordOrBody
}

function messagesOf(req) {
  return bodyOf(req)?.messages ?? []
}

/** ALL user messages joined (forensic scans). */
function userTextOf(req) {
  return messagesOf(req)
    .filter((m) => m.role === 'user')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
    .join('\n')
}

/**
 * The NEWEST marker-bearing user message index (chain routing). The DSH
 * agent loop injects a "Current runtime context..." user message AFTER
 * the real input on the first request of a session, so the raw last user
 * message is not a reliable chain selector (the C1 LIVE-FOUND lesson).
 * Marker = an SMLK_* scenario marker (every attributed input and every
 * initialWork prompt carries exactly one).
 */
function lastTriggerIndex(req) {
  const messages = messagesOf(req)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m.role !== 'user') continue
    const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
    if (text.includes(MK_START) || text.includes(MK_PAYLOAD) || text.includes(MK_REPLY)) return i
  }
  return -1
}

/** The chain trigger text (see lastTriggerIndex). */
function lastUserTextOf(req) {
  const messages = messagesOf(req)
  const i = lastTriggerIndex(req)
  if (i === -1) return ''
  const last = messages[i]
  return typeof last.content === 'string' ? last.content : JSON.stringify(last.content ?? '')
}

/**
 * The tool messages AFTER the chain trigger (chain progress). The
 * cumulative count misroutes multi-chain sessions (an earlier chain's
 * tool results stay in the history).
 */
function toolMsgsOf(req) {
  const messages = messagesOf(req)
  const i = lastTriggerIndex(req)
  return messages.slice(i + 1).filter((m) => m.role === 'tool')
}

/**
 * The members-listed effect of the newest list-members tool result in
 * the request history (the instance-id discovery the mock performs the
 * way a real agent would: from a real tool result, never hardcoded).
 * Returns { worker, leader } instance ids (either may be null).
 */
function memberIdsOf(req) {
  const out = { worker: null, leader: null }
  for (const m of messagesOf(req).filter((x) => x.role === 'tool')) {
    let parsed
    try {
      parsed = JSON.parse(String(m.content ?? ''))
    } catch {
      continue
    }
    let effect = parsed?.effect
    if (typeof effect === 'string') {
      try {
        effect = JSON.parse(effect)
      } catch {
        effect = null
      }
    }
    if (effect === null || typeof effect !== 'object' || effect.kind !== 'members-listed') continue
    const members = Array.isArray(effect.members) ? effect.members : []
    for (const mem of members) {
      if (mem?.templateId === 'worker' && typeof mem.instanceId === 'string') out.worker = mem.instanceId
      if (mem?.templateId === 'leader' && typeof mem.instanceId === 'string') out.leader = mem.instanceId
    }
  }
  return out
}

/**
 * The mock oracle:
 *   1. title side-calls → neutral;
 *   2. leader chain (trigger MK_START), by tool progress after it:
 *      0 tools → team_create_member (the worker);
 *      1 tool  → team_list_members (discover instance ids);
 *      2 tools → team_send_message(worker, MK_PAYLOAD body) — SCENARIO A;
 *      3 tools → text W_LEADER_DONE (the leader turn ENDED — its send
 *                 returned delivered: SCENARIO A + C at the wire level);
 *   3. member chain (trigger MK_PAYLOAD = the attributed input), by tool
 *      progress after it:
 *      0 tools → (the model call is held in flight for LONG_TURN_MS —
 *                the DELIBERATE long turn, SCENARIO C: the recipient
 *                keeps running) → team_list_members (discover the
 *                leader's instance id);
 *      1 tool  → team_send_message(leader, MK_REPLY body) — SCENARIO B;
 *      2 tools → text W_MEMBER_DONE (the member turn completed
 *                independently, after the leader's send had returned);
 *   4. leader reply chain (trigger MK_REPLY = the attributed reply) →
 *      text W_LEADER2_DONE (the leader ran a NEW turn on the reply —
 *      SCENARIO B: no cross-Agent whenIdle cycle).
 *
 *   The oracle is ASYNC: the member's 0-tool response is delayed
 *   (the harness awaits decide — the mock-deepseek.mjs async-decide
 *   extension, sync decides unaffected) so the member's first model
 *   call is a genuinely long in-flight call.
 */
function makeDecide({ logFingerprint = () => {} } = {}) {
  return async function decide({ seq, req }) {
    const tmsgs = toolMsgsOf(req).map((m) => String(m.content ?? '').slice(0, 200))
    logFingerprint({
      seq,
      trigger: lastUserTextOf(req).slice(0, 80),
      tools: tmsgs.length,
      toolContents: lastUserTextOf(req).includes(MK_START) ? tmsgs : undefined,
    })
    const firstMsg = messagesOf(req)[0]
    if (typeof firstMsg?.content === 'string' && firstMsg.content.startsWith('Create a concise title')) {
      return { kind: 'text', content: 'sml smoke session' }
    }
    const lastUser = lastUserTextOf(req)
    const tools = toolMsgsOf(req).length
    const root = CREATE_ROOT

    // (4) the leader's reply chain (the member's reply arrived as an
    // attributed input → a fresh leader turn).
    if (lastUser.includes(MK_REPLY)) {
      return { kind: 'text', content: W_LEADER2_DONE }
    }

    // (3) the member's message-triggered chain (the attributed input).
    if (lastUser.includes(MK_PAYLOAD)) {
      if (tools === 0) {
        // THE DELIBERATE LONG TURN: hold this model call in flight for
        // LONG_TURN_MS before responding (SCENARIO C — the recipient
        // keeps running long after the sender's tool returned).
        await sleepMs(LONG_TURN_MS)
        return toolCall('team_list_members', { rootSessionId: root, requestToken: TOK_LISTM })
      }
      if (tools === 1) {
        const ids = memberIdsOf(req)
        if (ids.leader === null) {
          return { kind: 'error', status: 500, message: 'sml mock: leader instance id not found in members-listed result', code: 'sml-mock' }
        }
        return toolCall('team_send_message', {
          rootSessionId: root,
          requestToken: TOK_REPLY,
          recipientInstanceId: ids.leader,
          body: `${MK_REPLY} ack: the long turn is still underway; replying to the leader before it finishes`,
        })
      }
      // 2+ tools: the reply send's tool result is in — the member turn
      // ends (it ran independently; the leader never waited for it).
      return { kind: 'text', content: W_MEMBER_DONE }
    }

    // (2) the leader's initial-work chain.
    if (lastUser.includes(MK_START)) {
      if (tools === 0) {
        return toolCall('team_create_member', {
          rootSessionId: root,
          requestToken: TOK_CREATE,
          delegationTemplateId: 'worker',
          label: 'sml-worker',
        })
      }
      if (tools === 1) {
        return toolCall('team_list_members', { rootSessionId: root, requestToken: TOK_LISTL })
      }
      if (tools === 2) {
        const ids = memberIdsOf(req)
        if (ids.worker === null) {
          return { kind: 'error', status: 500, message: 'sml mock: worker instance id not found in members-listed result', code: 'sml-mock' }
        }
        return toolCall('team_send_message', {
          rootSessionId: root,
          requestToken: TOK_SEND,
          recipientInstanceId: ids.worker,
          body: `${MK_PAYLOAD} probe message: do the long turn, then reply to the leader — do not stop the reply until it is sent`,
        })
      }
      // 3+ tools: the send's delivered result is in — the leader turn
      // ends WITHOUT having waited for the member's work.
      return { kind: 'text', content: W_LEADER_DONE }
    }

    // No scenario marker: neutral text (side effects, stray probes).
    return { kind: 'text', content: 'sml smoke: no scenario marker — nothing to do' }
  }
}

async function waitForMock(mock, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.find(pred)
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) {
      log(`mock wait timed out: ${label} (requests=${mock.requests.length})`)
      return null
    }
    await new Promise((r) => setTimeout(r, 400))
  }
}

/**
 * The team_send_message tool result for the token in the request history
 * (a tool message whose content carries the delivered shape + token),
 * or null.
 */
function sendResultOf(req, token) {
  for (const m of messagesOf(req).filter((x) => x.role === 'tool')) {
    const content = String(m.content ?? '')
    if (content.includes(token) && /"status"\s*:\s*"delivered"/.test(content)) return content
  }
  return null
}

/**
 * The plugin's durable messaging facts (storages/team_domain.json →
 * tables.ledger — the same read-only scan the WCN kit applies to the
 * work facts). Read-only.
 */
function readMessagingFacts(root) {
  const out = { intents: [], delivered: [], error: null }
  try {
    const parsed = JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
    const ledger = parsed?.tables?.ledger
    if (ledger === null || typeof ledger !== 'object') { out.error = 'no ledger table'; return out }
    for (const [k, v] of Object.entries(ledger)) {
      if (k === '__ledger_sequence_counter' || typeof v !== 'string') continue
      let entry
      try { entry = JSON.parse(v) } catch { continue }
      if (String(entry?.rootSessionId) !== root) continue
      const payload = entry?.payload ?? {}
      if (entry.factType === 'team-coordination-recorded') {
        out.intents.push({ sequence: Number(k), requestToken: payload.requestToken, recipientInstanceId: payload.recipientInstanceId ?? payload.intendedForInstanceId ?? null, action: payload.action })
      } else if (entry.factType === 'team-message-delivered') {
        out.delivered.push({ sequence: Number(k), requestToken: payload.requestToken, deliveredToInstanceId: payload.deliveredToInstanceId ?? null })
      }
    }
  } catch (error) {
    out.error = String(error?.message ?? error)
  }
  return out
}

/**
 * Fail fast on a saved blueprint whose IDENTITY inspection is rejected —
 * the filesystem index silently drops such files from the catalog (a
 * later team.create would fail with "blueprint not found in catalog"
 * after a long, uninformative wait).
 */
function assertBlueprintInspectsOk(label, source) {
  const r = inspectBlueprintSource(source)
  if (r.status !== 'ok') {
    writeEvidence(`blueprint-inspect-${label}.json`, { label, inspection: r })
    dieFatal(`saved blueprint ${label} failed identity inspection: ${JSON.stringify(r.diagnostics ?? r).slice(0, 800)}`)
  }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  writeFileSync(RUN_LOG, '', { flag: 'w' })

  log(`send-message liveness smoke — stamp ${RUN_STAMP}`)
  log(`worktree=${WORKTREE}`)
  log(`testuse=${TESTUSE} @ ${HOST_BASELINE_SHA.slice(0, 10)}`)
  log(`evidence=${RUN_DIR}`)

  preflight()
  const hostPort = await pickHostPort()
  if (!(await portFree(MOCK_PORT))) dieFatal(`mock port ${MOCK_PORT} busy`)
  log(`ports: host=${hostPort} mock=${MOCK_PORT}`)

  // Zero-touch record: the live instances (read-only pre probe).
  const preStable = {
    p3080: await probeStableInstance('http://127.0.0.1:3080/'),
    p3180: await probeStableInstance('http://127.0.0.1:3180/'),
  }
  writeEvidence('pre-stable-probe.json', preStable)
  log(`stable pre-probe: 3080=${preStable.p3080.status} 3180=${preStable.p3180.status}`)

  // World materialization.
  rmSync(HOME, { recursive: true, force: true })
  rmSync(BLUEPRINT_DIR, { recursive: true, force: true })
  mkdirSync(WORKSPACE, { recursive: true })
  writeSmokePreset(HOME)
  log('world materialized (scratch workspace)')

  // Mock model.
  const mockLog = join(RUN_DIR, 'mock.log')
  const mock = await startMockModel({
    port: MOCK_PORT,
    decide: makeDecide({
      logFingerprint: (f) => log(`mock-req seq=${f.seq} trigger=${JSON.stringify(f.trigger)} toolsAfterTrigger=${f.tools}${f.toolContents ? ` toolContents=${JSON.stringify(f.toolContents)}` : ''}`),
    }),
    log: (l) => {
      try { writeFileSync(mockLog, l + '\n', { flag: 'a' }) } catch { /* best-effort */ }
    },
  })
  log(`mock model listening on ${mock.port}`)

  const instanceLog = join(RUN_DIR, 'instance.log')
  writeFileSync(instanceLog, '', { flag: 'w' })
  const booted = await bootHost({ port: hostPort, home: HOME, mockPort: mock.port, instanceLog })
  const host = booted.host

  const FAILS = []
  const fail = (id) => FAILS.push(id)
  let postStable = null // hoisted: the summary block (outside the try) references it

  try {
    // ── S0: discovery (the boot Leader's model-facing tool surface) ──
    log('── S0: discovery ──')
    const discPrompt = await apiPrompt(booted.origin, booted.cookie, ROOT, MK_DISC)
    if (discPrompt.status !== 200) fail('S0')
    const discReq = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_DISC) && (r.body?.tools ?? []).length > 0, 120_000, 'DISC model request')
    if (discReq === null) {
      fail('S0')
      check('S0', 'discovery model request observed', false, `apiPrompt=${JSON.stringify(discPrompt.body).slice(0, 300)}`)
    } else {
      const surface = (discReq.body.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t)).sort()
      writeEvidence('s0-surface.json', { surface, discRequest: { seq: discReq.seq, tools: surface } })
      log(`discovery surface (${surface.length} tools): ${surface.join(', ')}`)
      const missingTeam = TEAM_TOOL_CATALOG.filter((n) => !surface.includes(n))
      check('S0', 'discovery captured the surface; the 12-tool catalog is present on the boot root',
        missingTeam.length === 0,
        `surface=${surface.length} missingTeam=[${missingTeam.join(',')}]`)
      if (missingTeam.length > 0) fail('S0')
      if (discReq.reply === undefined || discReq.reply.kind !== 'text') {
        writeEvidence('s0-diagnostic-mock.json', mock.requests.slice(-4).map((r) => ({ seq: r.seq, reply: r.reply })))
        throw new Error(`S0 diagnostic abort: the DISC request (seq ${discReq.seq}) got an unexpected reply ${JSON.stringify(discReq.reply).slice(0, 200)}`)
      }
      // The saved blueprint (the deny list needs the live surface:
      // unmanaged non-team names).
      const denyList = surface.filter(
        (n) => !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n) && !TEAM_TOOL_CATALOG.includes(n),
      )
      const bpSml = savedBlueprintYaml(BP_SML_ID, `You are the leader of the sml smoke team. ${MK_START} starts the liveness probe.`, `You are sml-worker of the sml smoke team. ${MK_PAYLOAD} and ${MK_REPLY} are the probe markers.`, denyList)
      assertBlueprintInspectsOk('sml-smoke', bpSml)
      writeFileSync(join(BLUEPRINT_DIR, 'sml-smoke.yaml'), bpSml)
      log(`saved blueprint ${BP_SML_ID} (deny list: ${denyList.length} unmanaged names)`)
    }

    if (FAILS.includes('S0')) throw new Error('S0 failed — aborting before team.create')

    // ── the SML team: scenarios A + B + C in one created team ────────
    log('── SML: team.create (fresh root) — scenarios A/B/C ──')
    const createPromise = remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT,
      blueprintId: BP_SML_ID,
      // ONLY the MK_START marker here — the MK_PAYLOAD / MK_REPLY bodies
      // are injected by the mock into the actual tool-call arguments (a
      // prompt carrying two markers would mis-route the chain selector).
      initialWork: { prompt: `${MK_START} create one worker member, then send it ONE team_send_message with a short probe body, and stop — do NOT wait for its work` },
    }, 'smlteam')

    // The leader's chain: create → list → send → W_LEADER_DONE. The
    // W_LEADER_DONE text is the wire-level proof that the leader's turn
    // (and with it the team_send_message tool call) has ENDED.
    const leaderDone = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_START) && (r.reply?.kind === 'text' ? r.reply.content : '') === W_LEADER_DONE, 300_000, 'leader chain final (W_LEADER_DONE)')
    check('S1a', 'A: the Leader created the worker and its turn ENDED after the send (the leader did not wait for the member work)',
      leaderDone !== null, `leaderDone=${leaderDone === null ? 'null' : `seq=${leaderDone.seq} @${leaderDone.receivedAt}`}`)
    if (leaderDone === null) fail('S1a')

    // The member received the attributed input: a model request on the
    // member chain whose trigger is the probe body (tW1).
    const w1 = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_PAYLOAD), 120_000, 'member chain first request (tW1)')
    const tW1 = w1 === null ? null : String(w1.receivedAt)
    check('S1b', 'A: the member independently processed the message (a new model request carrying the probe body)',
      w1 !== null, `w1=${w1 === null ? 'null' : `seq=${w1.seq} @${tW1}`}`)
    if (w1 === null) fail('S1b')

    // THE LIVENESS CORE (scenario C): the leader's model request that
    // carries the team_send_message TOOL RESULT (status delivered + the
    // token) — the sender's tool has returned — observed at tL4.
    const l4 = await waitForMock(mock, (r) => r.body !== null && sendResultOf(r, TOK_SEND) !== null, 120_000, 'leader send-result request (tL4)')
    const tL4 = l4 === null ? null : String(l4.receivedAt)
    const l4Result = l4 === null ? null : sendResultOf(l4, TOK_SEND)
    check('S2', 'A: the Leader team_send_message returned status=delivered (the tool result is in the leader chain history, correlated by token)',
      l4Result !== null && l4Result.includes(TOK_SEND),
      `l4=${l4 === null ? 'null' : `seq=${l4.seq} @${tL4}`} result=${l4Result === null ? 'null' : l4Result.slice(0, 260)}`)
    if (l4Result === null) fail('S2')
    if (l4 !== null) writeEvidence('s2-send-result.json', { seq: l4.seq, receivedAt: tL4, result: l4Result.slice(0, 4000) })

    // The member's SECOND model request (issued only after the long
    // in-flight model call resolved) — tW2: the member turn is still
    // running. THE CORE ORDERING: tL4 < tW2 — the sender's tool result
    // (delivered) was already in the leader's history while the member
    // was still mid-turn. (tW1 < tL4 is a kick-race ordering — the
    // acceptance and the leader's tool-result request are issued
    // concurrently — so it is RECORDED, not gated: the robust liveness
    // statement is the completion ordering tL4 < tW2.)
    const w2 = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_PAYLOAD) && toolMsgsOf(r).length >= 1, 180_000, 'member chain second request (tW2)')
    const tW2 = w2 === null ? null : String(w2.receivedAt)
    const s3GapMs = tW1 !== null && tW2 !== null ? Date.parse(tW2) - Date.parse(tW1) : null
    const s3CoreOk = tL4 !== null && tW2 !== null && tL4 < tW2 && s3GapMs !== null && s3GapMs >= 7000
    writeEvidence('s3-timeline.json', {
      tW1, tL4, tW2,
      order: {
        w1BeforeL4: tW1 !== null && tL4 !== null ? tW1 < tL4 : null,
        l4BeforeW2: tL4 !== null && tW2 !== null ? tL4 < tW2 : null,
      },
      longTurnGapMs: s3GapMs,
      note: 'tL4 < tW2 = the sender tool completed before the recipient turn; tW1 < tL4 = kick-race, recorded not gated',
    })
    check('S3', `C: THE CORE — the sender's send returned while the recipient was still running (tL4 < tW2; the recipient's turn really was long: ${s3GapMs === null ? 'n/a' : s3GapMs} ms)`,
      s3CoreOk,
      `tW1=${tW1} tL4=${tL4} tW2=${tW2} gapMs=${s3GapMs} w1BeforeL4=${tW1 !== null && tL4 !== null ? tW1 < tL4 : 'n/a'}`)
    if (!s3CoreOk) fail('S3')

    // The member's turn completed (W_MEMBER_DONE) — independently,
    // after the leader's send had already returned.
    const memberDone = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_PAYLOAD) && (r.reply?.kind === 'text' ? r.reply.content : '') === W_MEMBER_DONE, 180_000, 'member chain final (W_MEMBER_DONE)')
    check('S4', 'C: the member turn completed independently (the long turn ran to its own end; nothing waited for it)',
      memberDone !== null, `memberDone=${memberDone === null ? 'null' : `seq=${memberDone.seq} @${memberDone.receivedAt}`}`)
    if (memberDone === null) fail('S4')

    // Scenario B: the member's reply send returned delivered (the tool
    // result is in the member chain history, correlated by token).
    const w4 = await waitForMock(mock, (r) => r.body !== null && sendResultOf(r, TOK_REPLY) !== null, 120_000, 'member reply-result request (tW4)')
    const w4Result = w4 === null ? null : sendResultOf(w4, TOK_REPLY)
    check('S5', 'B: the Member team_send_message(Leader) also returned status=delivered (the reverse direction is not blocked)',
      w4Result !== null && w4Result.includes(TOK_REPLY),
      `w4=${w4 === null ? 'null' : `seq=${w4.seq} @${w4.receivedAt}`} result=${w4Result === null ? 'null' : w4Result.slice(0, 260)}`)
    if (w4Result === null) fail('S5')
    if (w4 !== null) writeEvidence('s5-reply-result.json', { seq: w4.seq, receivedAt: String(w4.receivedAt), result: w4Result.slice(0, 4000) })

    // Scenario B (cont.): the leader received the reply as a NEW model
    // request and ran a new turn on it (W_LEADER2_DONE) — no mutual
    // whenIdle wait: both agents finished their own turns.
    const leaderReply = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_REPLY) && (r.reply?.kind === 'text' ? r.reply.content : '') === W_LEADER2_DONE, 180_000, 'leader reply chain (W_LEADER2_DONE)')
    check('S6', 'B: the Leader ran a NEW turn on the member reply (no cross-Agent whenIdle cycle; both agents continued their own turns)',
      leaderReply !== null, `leaderReply=${leaderReply === null ? 'null' : `seq=${leaderReply.seq} @${leaderReply.receivedAt}`}`)
    if (leaderReply === null) fail('S6')

    // team.create succeeded on the fresh root.
    const create = await createPromise
    writeEvidence('sml-team-create.json', create.body ?? create)
    const createOk = create.status === 200
      && create.body?.result?.ok === true
      && create.body?.result?.value?.data?.path === 'fresh-root'
    check('S7', 'the SML team.create succeeded on the fresh root', createOk, `status=${create.status} body=${JSON.stringify(create.body ?? create).slice(0, 300)}`)
    if (!createOk) fail('S7')

    // Durable semantics (unchanged by the fix): exactly the two intents
    // + the two confirmations, correlated, each confirmation sequenced
    // after its intent.
    const facts = readMessagingFacts(CREATE_ROOT)
    const intentsFor = (t) => facts.intents.filter((f) => f.requestToken === t)
    const deliveredFor = (t) => facts.delivered.filter((f) => f.requestToken === t)
    const s8Details = []
    let s8Ok = facts.error === null
    for (const token of [TOK_SEND, TOK_REPLY]) {
      const intents = intentsFor(token)
      const delivered = deliveredFor(token)
      const ok = intents.length === 1 && delivered.length === 1 && delivered[0].sequence > intents[0].sequence
      s8Details.push(`${token}: intents=${intents.length} delivered=${delivered.length} seqIntent=${intents[0]?.sequence} seqDelivered=${delivered[0]?.sequence}`)
      s8Ok = s8Ok && ok
    }
    s8Ok = s8Ok && facts.intents.length === 2 && facts.delivered.length === 2
    writeEvidence('s8-messaging-facts.json', { ...facts, error: facts.error })
    check('S8', 'durable: exactly the two team-coordination-recorded intents + the two team-message-delivered confirmations (correlated; confirmation after intent)',
      s8Ok, `${facts.error === null ? '' : `error=${facts.error} `}${s8Details.join(' | ')}`)
    if (!s8Ok) fail('S8')

    // Zero-touch record: the live instances (read-only post probe).
    postStable = {
      p3080: await probeStableInstance('http://127.0.0.1:3080/'),
      p3180: await probeStableInstance('http://127.0.0.1:3180/'),
    }
    writeEvidence('post-stable-probe.json', postStable)
    const s9Ok = postStable.p3080.status === preStable.p3080.status && postStable.p3180.status === preStable.p3180.status
    check('S9', 'zero-touch: the stable instances :3080/:3180 are untouched (read-only probes identical pre/post)',
      s9Ok, `pre=${JSON.stringify({ a: preStable.p3080.status, b: preStable.p3180.status })} post=${JSON.stringify({ a: postStable.p3080.status, b: postStable.p3180.status })}`)
    if (!s9Ok) fail('S9')

    // Corpus evidence (every model request, with receivedAt).
    writeEvidence('mock-corpus.json', mock.requests.map((r) => ({
      seq: r.seq,
      receivedAt: r.receivedAt,
      lastUser: lastUserTextOf(r).slice(0, 300),
      toolMsgs: toolMsgsOf(r).length,
      reply: r.reply === null ? null : (r.reply.kind === 'text' ? { kind: 'text', content: String(r.reply.content).slice(0, 300) } : { kind: r.reply.kind, names: (r.reply.toolCalls ?? []).map((c) => c.name) }),
    })))
  } catch (error) {
    log(`scenario error: ${String(error?.stack ?? error)}`)
    writeEvidence('scenario-error.json', { error: String(error?.stack ?? error) })
  } finally {
    stopHost(host)
    try { await mock.close() } catch { /* best-effort */ }
    if (!FLAG_KEEP) {
      rmSync(HOME, { recursive: true, force: true })
      rmSync(BLUEPRINT_DIR, { recursive: true, force: true })
      log('world cleaned (home + blueprint dir removed)')
    } else {
      log(`world kept (--keep): home=${HOME}`)
    }
  }

  const passed = criteria.filter((c) => c.ok).length
  {
    const summary = {
      runStamp: RUN_STAMP,
      hostBaseline: HOST_BASELINE_SHA,
      hostPort,
      mockPort: MOCK_PORT,
      worktree: WORKTREE,
      criteria,
      passed,
      total: criteria.length,
      failed: FAILS,
      stable: { pre: preStable, post: postStable },
      verdict: FAILS.length === 0 ? 'PASS' : 'FAIL',
    }
    writeEvidence('summary.json', summary)
    log(`VERDICT ${summary.verdict} — ${passed}/${criteria.length} criteria passed${FAILS.length > 0 ? `; failed: ${[...new Set(FAILS)].join(',')}` : ''}`)
  }

  process.exit(FAILS.length === 0 ? 0 : 2)
}

main().catch((e) => {
  try {
    log(`FATAL uncaught: ${e.stack ?? e}`)
    if (RUN_LOG !== null) writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: String(e.message ?? e), criteria })
  } catch { /* best-effort */ }
  process.exit(1)
})
