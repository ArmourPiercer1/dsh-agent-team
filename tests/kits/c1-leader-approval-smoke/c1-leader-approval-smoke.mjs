#!/usr/bin/env node
/**
 * c1-leader-approval-smoke.mjs — C1 (leader-approval REACHABILITY) real-host
 * smoke on a pristine DSH 0.1.5-rc.2 checkout. Plan:
 * docs/plans/active/dsh-agent-team-c1-leader-approval-repair-plan.md §9.6
 * (S1–S6).
 *
 * WHAT IT PROVES (the C1 acceptance arc on a real host):
 *
 *   S1 — pending discovery: a MEMBER triggers a permission ask (a durable
 *        `leader-approval` request); the LEADER — from the liveness
 *        notification (a model-visible input turn) — calls
 *        `team_list_pending_control` and the EXACT requestId surfaces in
 *        the tool result.
 *   S2 — Leader resolve (allow): the Leader resolves allow through the
 *        SAME model-facing `team_resolve_control` tool; the member
 *        operation EXECUTES on the last-mile guard (the side-effect file
 *        lands); exactly ONE consumption fact appears in the durable
 *        ledger.
 *   S3 — Leader resolve (deny): a second member ask; the Leader resolves
 *        deny; the member operation has ZERO side effects (the file the
 *        command would have written does not exist; the verdict is the
 *        blocked result, not output).
 *   S4 — notification failure recovery: the mock model refuses the Leader's
 *        notification turn (HTTP 500 — the delivery's model call fails);
 *        the request REMAINS durable; `team_list_pending_control` (driven
 *        by an explicit Leader input — no notification involved) discovers
 *        the exact requestId; the Leader resolves it through the same
 *        model-facing tool; the member's ORIGINAL blocked operation then
 *        proceeds (its control wait returns the allow; the guard consumes
 *        it; the side effect lands).
 *   S5 — idempotent retry: the same request scope/correlation retried
 *        through the production `team_request_control` surface (the tool's
 *        requestToken IS the correlation) returns the SAME requestId,
 *        writes ONE durable row, and does NOT re-notify (exactly one
 *        delivery attempt for the request in the mock corpus).
 *   S6 — Leader busy / synchronous delegation CHARACTERIZATION (not a
 *        requirement to create concurrent Leader turns): the Leader
 *        delegates SYNCHRONOUSLY; the member asks while the Leader turn is
 *        blocked in the delegate; the kit records that the root
 *        notification is QUEUED (not immediately processable — its model
 *        request only appears after the Leader turn ends), that the
 *        HUMAN resolver channel stays open (a `team.resolveControl` remote
 *        call succeeds while the Leader is busy AND the notification
 *        delivery is in flight — no control-lock deadlock; the notifier
 *        runs after the lock release), and that the queued notification is
 *        processed after the turn, where the pending list reflects the
 *        recorded decision. Guidance recorded: `async: true` for
 *        approval-capable work.
 *
 * TOPOLOGY (three created teams on one production row):
 *   - Team X: async delegation; the liveness path works end to end
 *     (S1+S2+S3). The Leader's scripted turn ends right after the async
 *     delegate admission; each member ask lands as a NEW Leader turn.
 *   - Team Z: async delegation; the notification turn is REFUSED by the
 *     mock model (S4+S5). Recovery is driven by an explicit Leader input
 *     (`/api/session/prompt` on the created root).
 *   - Team Y: SYNCHRONOUS delegation; the Leader turn blocks in the
 *     delegate while the member asks (S6). The kit breaks the cycle
 *     through the human resolver channel (the member's ask is
 *     `leader-approval` — resolvable by Leader OR human; the Leader is
 *     busy, so the human resolves).
 *
 * DESIGN NOTES:
 *   - The member's asks are kind `leader-approval` (the pre-execute
 *     adapter: isLeader ? user-approval : leader-approval) — resolvable
 *     by Leader OR human. The Leader resolves through the model-facing
 *     tool; the S6 human resolution goes through the production remote
 *     `team.resolveControl` (contract v4) with the boot-root operator
 *     principal (= human).
 *   - The mock model is a full decision oracle (the a2x/rc2 pattern).
 *     Chain routing is over the LAST user message + the tool messages
 *     AFTER that last user message (a session's request history carries
 *     every earlier chain's tool results — a bare cumulative count
 *     misroutes multi-chain sessions). The notification turns are
 *     recognized by their token-leading text `[team-control requestId=`;
 *     the chain extracts the requestId from the text and the
 *     allow/deny verdict + the target root from the summary markers,
 *     then calls `team_list_pending_control` → `team_resolve_control` —
 *     NO test-only decision injection: the resolution is the same
 *     model-facing authority the plan requires.
 *   - Upstream fact (verified in the rc.2 checkout, this round): a
 *     crash-orphaned tool call is NOT redriven on resume — the session
 *     repair appends a synthetic "interrupted" tool result and closes the
 *     turn. S5's same-correlation retry is therefore exercised through
 *     the production `team_request_control` tool (requestToken = the
 *     correlation the tool binds to the scope key), which is the surface
 *     that exposes the correlation to the model.
 *   - Durable evidence: the plugin's control ledger in
 *     `<DSH_HOME>/storages/team_domain.json` (read-only scan;
 *     `control-request-recorded` / `control-decision-recorded` /
 *     `control-allow-consumed` rows) + the mock request corpus
 *     (timestamps for the S6 queueing characterization) + the workspace
 *     file side-effect checks (S2/X allow executed / S3 deny not executed
 *     / S4 recovered operation executed).
 *   - WORLD: host = the pristine test-use checkout (DSH 0.1.5-rc.2 @
 *     fb2c4b9e69) launched as `node <testuse>/apps/cli/lib/bin.js web`
 *     with cwd = a scratch session workspace; env: DSH_HOME=<world home
 *     under tests/homes/>, DSH_CLIENT_COMMIT_HASH=fb2c4b9e69,
 *     DEEPSEEK_BASE_URL=<in-process mock model>. Plugin rows mounted ONLY
 *     through the public profile-patch seam (production row = the
 *     WORKTREE's dist — this is the C1 branch build; p6t6
 *     observability row). The preset is the same minimal-style smoke
 *     preset as the rc2 kit (no delegation group — the 0.1.5 spawn
 *     `subagent` is un-denyable; followup-backlog items 2/5/6).
 *   - ZERO-TOUCH: the live instances :3080 and :3180 are probed
 *     read-only (status recorded pre/post) and never written to. Do NOT
 *     run this kit in parallel with a full `vitest` run (shared port
 *     family + CPU load).
 *
 * USAGE:
 *   node tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs \
 *     [--worktree <path>] [--testuse <path>] [--host-port N] \
 *     [--mock-port N] [--evidence-dir <path>] [--keep]
 *   defaults: --worktree = the repo root containing this kit (3 levels
 *   up), --testuse = <worktree>/tests/deepseek-harness-test-use (fallback:
 *   the parent repo's tests/deepseek-harness-test-use — the gitignored
 *   checkout only exists in the main checkout, not in task worktrees),
 *   host port = first free of 3501–3510, mock port = 3506, evidence dir =
 *   dev/agent-workflow/evidence/c1-leader-approval/smoke/c1-smoke-<stamp>/.
 *
 * EXIT: 0 = all criteria pass; 2 = a criterion failed (full evidence
 * dump in the evidence dir); 1 = fatal (environment/boot/row).
 */

import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
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
const FLAG_KEEP = args.includes('--keep')

const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(KIT_DIR, '..', '..', '..')))
let TESTUSE = resolve(argValue('testuse', join(WORKTREE, 'tests', 'deepseek-harness-test-use')))
// The gitignored test-use checkout exists only in the MAIN checkout, not
// in task worktrees (<main>/.worktrees/<task>). Fallback: parent repo.
if (!existsSync(TESTUSE) && existsSync(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))) {
  TESTUSE = resolve(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))
}
const MOCK_PORT = Number(argValue('mock-port', 3506))
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

const SMOKE_PRESET_ID = 'rc2-smoke' // the rc2 kit's preset id (reused shape)
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
// The C1 tool catalog: the eleven + team_list_pending_control.
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
// create + delegate + collect + list members/templates/config for
// addressing, and the C1 approval-loop pair.
const LEADER_TEAM_TOOLS_ALLOW = [
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_create_member',
  'team_delegate',
  'team_collect',
  'team_list_pending_control',
  'team_resolve_control',
  // LIVE-FOUND run 5: the created team's LEADER surface is the blueprint's
  // teamTools allow (the boot root's 17-tool surface does NOT carry over).
  // The S5 idempotency probe runs through the production
  // team_request_control tool ON THE CREATED LEADER (plan §S5) — without
  // this grant the probe tool-call fails 'unknown tool' (the service
  // never sees it, no row, no notification).
  'team_request_control',
]

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').replace('T', 'T').slice(0, 19)
const RUN_DIR = EVIDENCE_DIR_ARG
  ? resolve(EVIDENCE_DIR_ARG)
  : join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'c1-leader-approval', 'smoke', `c1-smoke-${RUN_STAMP}`)
const HOME = join(WORKTREE, 'tests', 'homes', `c1-smoke-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const BLUEPRINT_DIR = join(WORKTREE, `.c1-smoke-blueprints-${RUN_STAMP}`)

const ROOT = `session-c1-smoke-root-${RUN_STAMP}`
const CREATE_ROOT_X = `session-c1-smoke-x-${RUN_STAMP}`
const CREATE_ROOT_Y = `session-c1-smoke-y-${RUN_STAMP}`
const CREATE_ROOT_Z = `session-c1-smoke-z-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.c1-anchor'
const BP_X_ID = 'team.c1-x'
const BP_Y_ID = 'team.c1-y'
const BP_Z_ID = 'team.c1-z'

// Distinct markers (no substring collisions).
const MK_DISC = `C1MK_DISC_${RUN_STAMP}`
const MK_X = `C1MK_X_${RUN_STAMP}`
const MK_XMEM = `C1MK_XMEM_${RUN_STAMP}`
const MK_Y = `C1MK_Y_${RUN_STAMP}`
const MK_YMEM = `C1MK_YMEM_${RUN_STAMP}`
const MK_Z = `C1MK_Z_${RUN_STAMP}`
const MK_ZMEM = `C1MK_ZMEM_${RUN_STAMP}`
const MK_ZCHECK = `C1MK_ZCHECK_${RUN_STAMP}`

// The C1 notification prefix token (the renderer's first line).
const NOTIF_PREFIX = '[team-control requestId='
// Summary markers carried into the C1 notification text (routing +
// verdict selection in the mock oracle):
//   c1-x-allow / c1-x-deny / c1-z-<stamp>.txt (refused, S4) / c1-z-s5
//   (the S5 idempotency probe, normal chain) / c1-y- (queued, S6).
const SUM_X_ALLOW = `c1-x-allow-${RUN_STAMP}`
const SUM_X_DENY = `c1-x-deny-${RUN_STAMP}`
const SUM_Z_FILE = `c1-z-${RUN_STAMP}.txt`
const SUM_Z_S5 = `c1-z-s5-${RUN_STAMP}`
const SUM_Y = `c1-y-${RUN_STAMP}`
const S5_TOKEN = `c1-z-s5tok-${RUN_STAMP}`

// Member side-effect files (ABSOLUTE paths — cwd-robust) + commands that
// both WRITE the marker file and PRINT a -executed marker (so the
// executed branch is distinguishable in the tool result).
const FILE_X_ALLOW = join(WORKSPACE, `c1-x-allow-${RUN_STAMP}.txt`)
const FILE_X_DENY = join(WORKSPACE, `c1-x-deny-${RUN_STAMP}.txt`)
const FILE_Y = join(WORKSPACE, `c1-y-${RUN_STAMP}.txt`)
const FILE_Z = join(WORKSPACE, `c1-z-${RUN_STAMP}.txt`)
const CMD_X_ALLOW = `echo ${SUM_X_ALLOW} > ${FILE_X_ALLOW} && echo x-allow-executed`
const CMD_X_DENY = `echo ${SUM_X_DENY} > ${FILE_X_DENY} && echo x-deny-executed`
const CMD_Y = `echo ${SUM_Y} > ${FILE_Y} && echo y-executed`
const CMD_Z = `echo ${SUM_Z_FILE} > ${FILE_Z} && echo z-executed`

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

// ── small http helpers (a2x/rc2 kit shape) ──────────────────────────────────

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
async function remoteCall(origin, cookie, method, params, tag = 'c1', version = 1) {
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
async function apiPrompt(origin, cookie, sessionId, text, tag = 'c1') {
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
}

async function portFree(port, timeoutMs = 1500) {
  const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ error: e }))
  if (res.error) return true
  return false
}

async function pickHostPort() {
  if (args.includes('--host-port')) return Number(argValue('host-port', 0))
  for (const p of [3501, 3502, 3503, 3504, 3505, 3507, 3508, 3509, 3510]) {
    if (await portFree(p)) return p
  }
  dieFatal('no free host port in 3501-3510')
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
    staticModel: { provider: 'deepseek-official', model: 'c1-smoke-model' },
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
  `  persona: "You are the leader of the C1 smoke boot team. ${MK_DISC} is the discovery marker."`,
  'members:',
  '  - templateId: worker',
  '    persona: "You are a worker of the C1 smoke boot team."',
  'memberEnvelopes: []',
  'requirements: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

/**
 * One saved-source strict blueprint (X/Y/Z — same shape, different
 * personas/markers). The Leader declares the full capability set (strict
 * Coverage Gate) + the C1 approval-loop tools in teamTools. The WORKER is
 * strict too — `default: ask` + `ask bash any` is what makes its bash
 * calls produce durable `leader-approval` requests (the pre-execute
 * adapter's ask-lane path). The member envelope admits `request-control`
 * (the ask's control-request creation is an admitted mutation op for the
 * calling agent — LIVE-FOUND rc2) but NOT `resolve-control` (a member is
 * never a resolver).
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
    '        kind: deny',
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
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '    - request-control',
    '    - resolve-control',
    '  deny: []',
  ]
  const memberEnvelope = [
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '        - request-control',
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
    `# ${SMOKE_PRESET_ID} — C1 real-host smoke preset (run ${RUN_STAMP}).`,
    '# Reused from the rc2 kit (public user-preset seam): persona +',
    '# dsh-tool-fs + the minimal-style persistent shell group (bash',
    '# stack). NO delegation group: the 0.1.5 spawn `subagent` row is a',
    '# deferred per-agent own-layer install — un-restrictable and',
    '# KNOWN_SENSITIVE under the Coverage Gate (followup-backlog 2/5/6).',
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
    `# C1 real-host smoke patch layer (run ${RUN_STAMP}): production dsh-agent-team row (worktree dist — the C1 branch build) + p6t6 observability row — mounted ONLY through the public profile-patch seam.`,
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
          DEEPSEEK_API_KEY: 'c1-smoke-mock-key',
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
  writeFileSync(join(BLUEPRINT_DIR, 'c1-anchor.yaml'), BP_ANCHOR_YAML)
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

// ── mock decide policy (C1: leaders, members, notification turns) ──────────

function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-c1-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
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

/** The LAST user message containing a chain trigger (a MK_* marker or
 *  the C1 notification token). The DSH agent loop injects a "Current
 *  runtime context..." user message AFTER the real input on the first
 *  request of a session, so the raw last user message is not a reliable
 *  chain selector (LIVE-FOUND run 08-45-27: DISC routed to the NOOP
 *  fallback). Multi-chain sessions (the ZCHECK input re-uses the Z root;
 *  the notification re-uses the X/Z root) need the newest MARKER-bearing
 *  input; sessions with no marker in the history fall back to the raw
 *  last user message. */
const TRIGGER_RE = /C1MK_[A-Z0-9_]+_[0-9T:-]+|\[team-control requestId=/
function lastTriggerIndex(req) {
  const messages = messagesOf(req)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m.role !== 'user') continue
    const t = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
    if (TRIGGER_RE.test(t)) return i
  }
  // Fallback: the raw last user message.
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return i
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

/** The instance id from a team_create_member / team_delegate tool result. */
function extractInstanceId(content) {
  const m =
    /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(String(content)) ??
    /"instanceId"\s*:\s*"([^"]+)"/.exec(String(content)) ??
    /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(String(content))
  return m === null ? null : m[1]
}

/** The requestId from a C1 notification text (`requestId: <id>` line). */
function extractNotifRequestId(text) {
  const m = /requestId:\s*([A-Za-z0-9][A-Za-z0-9_-]{3,128})/.exec(String(text))
  return m === null ? null : m[1]
}

/** The FIRST requestId in a team_list_pending_control tool result JSON. */
function extractListedRequestId(content) {
  const m = /"requestId"\s*:\s*"([^"]+)"/.exec(String(content))
  return m === null ? null : m[1]
}

/** The requestId in a team_request_control / resolve tool result. */
function extractResultRequestId(content) {
  const m = /"requestId"\s*:\s*"([^"]+)"/.exec(String(content))
  return m === null ? null : m[1]
}

/**
 * The C1 mock oracle. Chain routing is over (LAST user message, tool
 * messages AFTER it):
 *
 *   1. title side-calls → neutral (they nest the markers);
 *   2. `[team-control requestId=...` → a C1 notification turn:
 *        c1-z-<stamp>.txt summary → the deliberate 500 (S4 injection);
 *        otherwise list pending + resolve (the verdict + root come from
 *        the summary markers: c1-x-allow → allow@X, c1-x-deny →
 *        deny@X, c1-z-s5 → allow@Z, c1-y → the S6 post-turn chain);
 *   3. member chains (X: bash allow-ask → bash deny-ask → done;
 *      Z: bash → done — its blocked execution resumes after the
 *      recovered allow; Y: bash → done);
 *   4. leader chains (X/Z: create_member → async delegate → done;
 *      Y: create_member → SYNC delegate → done — the S6 blocked turn;
 *      Z-check: list → resolve R_Z1 → request_control →
 *      request_control (same token, S5) → done).
 */
function makeDecide() {
  return function decide({ req }) {
    const firstMsg = messagesOf(req)[0]
    if (typeof firstMsg?.content === 'string' && firstMsg.content.startsWith('Create a concise title')) {
      return { kind: 'text', content: 'C1 smoke session' }
    }
    const lastUser = lastUserTextOf(req)
    const tools = toolMsgsOf(req).length

    // (2) the C1 notification turns (token-leading, no dedupe).
    if (lastUser.startsWith(NOTIF_PREFIX)) {
      // S4 injection: the Z member-ask notification (summary carries the
      // side-effect file marker) is REFUSED at the model layer — the
      // durable request + the pending list are what make this recoverable.
      if (lastUser.includes(SUM_Z_FILE)) {
        return { kind: 'error', status: 500, message: 'c1 smoke S4: deliberate notification delivery failure', code: 'c1-smoke-s4' }
      }
      const requestId = extractNotifRequestId(lastUser)
      // Root + verdict from the summary markers (the renderer's bounded
      // summary line carries the command/summary text).
      let root = CREATE_ROOT_Y
      let decision = 'allow'
      if (lastUser.includes(SUM_X_ALLOW) || lastUser.includes(SUM_X_DENY)) {
        root = CREATE_ROOT_X
        decision = lastUser.includes(SUM_X_DENY) ? 'deny' : 'allow'
      } else if (lastUser.includes(SUM_Z_S5)) {
        root = CREATE_ROOT_Z
      }
      if (tools === 0) {
        return toolCall('team_list_pending_control', {
          rootSessionId: root,
          requestToken: `c1-notif-list-${requestId ?? 'x'}`,
        })
      }
      if (tools === 1) {
        return toolCall('team_resolve_control', {
          rootSessionId: root,
          requestToken: `c1-notif-res-${requestId ?? 'x'}`,
          requestId: requestId ?? '',
          decision,
        })
      }
      return { kind: 'text', content: 'C1_NOTIF_DONE' }
    }

    // (3) member chains.
    if (lastUser.includes(MK_XMEM)) {
      switch (tools) {
        case 0: return toolCall('bash', { command: CMD_X_ALLOW, timeoutMs: 30000 })
        case 1: return toolCall('bash', { command: CMD_X_DENY, timeoutMs: 30000 })
        case 2: return { kind: 'text', content: 'C1_XMEM_DONE' }
        default: return { kind: 'text', content: `C1_XMEM_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_ZMEM)) {
      // ONE bash: it is blocked at the control wait until the recovered
      // allow arrives (S4); then it executes and the turn ends.
      switch (tools) {
        case 0: return toolCall('bash', { command: CMD_Z, timeoutMs: 30000 })
        case 1: return { kind: 'text', content: 'C1_ZMEM_DONE' }
        default: return { kind: 'text', content: `C1_ZMEM_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_YMEM)) {
      switch (tools) {
        case 0: return toolCall('bash', { command: CMD_Y, timeoutMs: 30000 })
        case 1: return { kind: 'text', content: 'C1_YMEM_DONE' }
        default: return { kind: 'text', content: `C1_YMEM_FALLTHROUGH tools=${tools}` }
      }
    }

    // (4) leader chains.
    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'C1_DISC_DONE' }
    if (lastUser.includes(MK_X) || lastUser.includes(MK_Z)) {
      const isX = lastUser.includes(MK_X)
      const root = isX ? CREATE_ROOT_X : CREATE_ROOT_Z
      switch (tools) {
        case 0: return toolCall('team_create_member', {
          rootSessionId: root,
          requestToken: `c1-${isX ? 'x' : 'z'}-create-${RUN_STAMP}`,
          delegationTemplateId: 'worker',
          label: isX ? 'w-x' : 'w-z',
        })
        case 1: {
          const id = extractInstanceId(toolMsgsOf(req)[0]?.content)
          if (id === null) return { kind: 'text', content: `C1_${isX ? 'X' : 'Z'}_EXTRACT_FAIL :: ${String(toolMsgsOf(req)[0]?.content).slice(0, 300)}` }
          return toolCall('team_delegate', {
            rootSessionId: root,
            requestToken: `c1-${isX ? 'x' : 'z'}-delegate-${RUN_STAMP}`,
            delegationInstanceId: id,
            label: isX ? 'w-x' : 'w-z',
            prompt: isX ? MK_XMEM : MK_ZMEM,
            async: true,
          })
        }
        case 2: return { kind: 'text', content: isX ? 'C1_X_DONE' : 'C1_Z_DONE' }
        default: return { kind: 'text', content: `C1_${isX ? 'X' : 'Z'}_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_Y)) {
      switch (tools) {
        case 0: return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT_Y,
          requestToken: `c1-y-create-${RUN_STAMP}`,
          delegationTemplateId: 'worker',
          label: 'w-y',
        })
        case 1: {
          const id = extractInstanceId(toolMsgsOf(req)[0]?.content)
          if (id === null) return { kind: 'text', content: `C1_Y_EXTRACT_FAIL :: ${String(toolMsgsOf(req)[0]?.content).slice(0, 300)}` }
          // SYNC delegation (no async arg) — the S6 blocked Leader turn:
          // this call does not return to the model until the member's
          // work unit settles, which requires a control decision.
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT_Y,
            requestToken: `c1-y-delegate-${RUN_STAMP}`,
            delegationInstanceId: id,
            label: 'w-y',
            prompt: MK_YMEM,
          })
        }
        case 2: return { kind: 'text', content: 'C1_Y_DONE' }
        default: return { kind: 'text', content: `C1_Y_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_ZCHECK)) {
      // The explicit recovery + S5 chain (NO notification involved):
      // list pending (S4c) → resolve the member's ask (S4d) →
      // request_control probe (S5a) → request_control RETRY, same token
      // (S5a: same requestId, one row, no re-notify) → done.
      // The member instance id: the session history carries the
      // create_member result (a tool message from the Z leader chain).
      const allToolMsgs = messagesOf(req).filter((m) => m.role === 'tool')
      const memberId = allToolMsgs.map((m) => extractInstanceId(String(m.content ?? ''))).find((v) => v !== null) ?? null
      switch (tools) {
        case 0: return toolCall('team_list_pending_control', {
          rootSessionId: CREATE_ROOT_Z,
          requestToken: `c1-z-check-list-${RUN_STAMP}`,
        })
        case 1: {
          const requestId = extractListedRequestId(toolMsgsOf(req)[0]?.content)
          if (requestId === null) return { kind: 'text', content: `C1_ZCHECK_EXTRACT_FAIL :: ${String(toolMsgsOf(req)[0]?.content).slice(0, 300)}` }
          return toolCall('team_resolve_control', {
            rootSessionId: CREATE_ROOT_Z,
            requestToken: `c1-z-check-res-${RUN_STAMP}`,
            requestId,
            decision: 'allow',
          })
        }
        case 2:
          if (memberId === null) return { kind: 'text', content: 'C1_ZCHECK_MEMBERID_FAIL :: no instance id in history' }
          return toolCall('team_request_control', {
            rootSessionId: CREATE_ROOT_Z,
            requestToken: S5_TOKEN,
            kind: 'leader-approval',
            targetInstanceId: memberId,
            actionName: 'bash',
            toolName: 'bash',
            summary: `S5 idempotency probe ${SUM_Z_S5}`,
          })
        case 3:
          if (memberId === null) return { kind: 'text', content: 'C1_ZCHECK_MEMBERID_FAIL :: no instance id in history (retry)' }
          // THE idempotent retry: the SAME scope (identical arguments)
          // + the SAME requestToken (= the correlation) → the existing
          // row, no new request, no re-notification.
          return toolCall('team_request_control', {
            rootSessionId: CREATE_ROOT_Z,
            requestToken: S5_TOKEN,
            kind: 'leader-approval',
            targetInstanceId: memberId,
            actionName: 'bash',
            toolName: 'bash',
            summary: `S5 idempotency probe ${SUM_Z_S5}`,
          })
        case 4: return { kind: 'text', content: 'C1_Z_LEADER_DONE' }
        default: return { kind: 'text', content: `C1_ZCHECK_FALLTHROUGH tools=${tools}` }
      }
    }
    return { kind: 'text', content: 'C1_NOOP_DONE' }
  }
}

/** Poll the in-process mock request log for the first request matching pred. */
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

// ── durable control ledger (read-only) ─────────────────────────────────────

/**
 * The plugin's durable control ledger (storages/team_domain.json →
 * tables.ledger): the control service persists requests/decisions/
 * consumptions as ledger entries with factType
 * `control-request-recorded` / `control-decision-recorded` /
 * `control-allow-consumed`, each entry a JSON string
 * {factType, rootSessionId, payload, ...}. Read-only.
 */
function readControlLedger(root) {
  const out = { requests: [], decisions: [], consumptions: [], error: null }
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
      if (entry.factType === 'control-request-recorded') {
        out.requests.push({ sequence: Number(k), factType: entry.factType, requestId: payload.requestId, kind: payload.kind, toolName: payload.toolName, actionName: payload.actionName, targetInstanceId: payload.targetInstanceId, status: payload.status, correlation: payload.correlation, createdAt: entry.createdAt })
      } else if (entry.factType === 'control-decision-recorded') {
        out.decisions.push({ sequence: Number(k), factType: entry.factType, requestId: payload.requestId, decision: payload.decision, resolver: payload.resolver ?? payload.resolvedBy, createdAt: entry.createdAt })
      } else if (entry.factType === 'control-allow-consumed') {
        out.consumptions.push({ sequence: Number(k), factType: entry.factType, requestId: payload.requestId, createdAt: entry.createdAt })
      }
    }
  } catch (error) {
    out.error = String(error?.message ?? error)
  }
  return out
}

/** The scripted human resolution (the boot root is the host-known operator
 *  = human; the member's ask is leader-approval → resolvable by Leader OR
 *  human — the Leader is busy in S6, so the human resolves). */
async function scriptedHumanApproval(origin, cookie, root, requestId) {
  const res = await remoteCall(origin, cookie, 'team.resolveControl', {
    teamSessionId: root,
    requestId,
    decision: 'allow',
    note: 'c1 smoke S6 scripted human resolution (the Leader is blocked in the sync delegate)',
  }, 'c1s6', 4)
  writeEvidence('s6-approval-response.json', res.body ?? res)
  return res
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  log(`c1 real-host smoke — stamp ${RUN_STAMP}`)
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
    decide: makeDecide(),
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

  try {
    // ── L0: discovery (the boot Leader's model-facing tool surface) ──
    log('── L0: discovery ──')
    const discPrompt = await apiPrompt(booted.origin, booted.cookie, ROOT, MK_DISC)
    if (discPrompt.status !== 200) fail('L0')
    const discReq = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_DISC) && (r.body?.tools ?? []).length > 0, 120_000, 'DISC model request')
    if (discReq === null) {
      fail('L0')
      check('L0', 'discovery model request observed', false, `apiPrompt=${JSON.stringify(discPrompt.body).slice(0, 300)}`)
    } else {
      const surface = (discReq.body.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t)).sort()
      writeEvidence('l0-surface.json', { surface, discRequest: { seq: discReq.seq, tools: surface } })
      log(`discovery surface (${surface.length} tools): ${surface.join(', ')}`)
      const denyList = surface.filter(
        (n) => !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n) && !TEAM_TOOL_CATALOG.includes(n),
      )
      const missingTeam = TEAM_TOOL_CATALOG.filter((n) => !surface.includes(n))
      check('L0', 'discovery captured the surface; read + bash present; the 12-tool C1 catalog is the closed team set (the boot leader inherits the full catalog — the saved blueprints deny the non-team remainder)',
        surface.includes('read') && surface.includes('bash') && missingTeam.length === 0,
        `surface=${surface.length} missingTeam=[${missingTeam.join(',')}] denyList=[${denyList.join(',')}]`)
      if (discReq.reply === undefined || discReq.reply.kind !== 'text' || discReq.reply.content !== 'C1_DISC_DONE') {
        writeEvidence('l0-diagnostic-mock.json', mock.requests.slice(-4).map((r) => ({ seq: r.seq, reply: r.reply })))
        throw new Error(`L0 diagnostic abort: the DISC request (seq ${discReq.seq}) got reply ${JSON.stringify(discReq.reply).slice(0, 200)}`)
      }
      // The saved blueprints (the deny list needs the live surface).
      writeFileSync(join(BLUEPRINT_DIR, 'c1-x.yaml'), savedBlueprintYaml(BP_X_ID, `You are the leader of the C1 smoke X team. ${MK_X}`, `You are worker-x of the C1 smoke X team. ${MK_XMEM}`, denyList))
      writeFileSync(join(BLUEPRINT_DIR, 'c1-y.yaml'), savedBlueprintYaml(BP_Y_ID, `You are the leader of the C1 smoke Y team. ${MK_Y}`, `You are worker-y of the C1 smoke Y team. ${MK_YMEM}`, denyList))
      writeFileSync(join(BLUEPRINT_DIR, 'c1-z.yaml'), savedBlueprintYaml(BP_Z_ID, `You are the leader of the C1 smoke Z team. ${MK_Z}`, `You are worker-z of the C1 smoke Z team. ${MK_ZMEM}`, denyList))
      log(`saved blueprints X + Y + Z written (deny list = ${denyList.length} names)`)
    }

    if (FAILS.includes('L0')) throw new Error('L0 failed — aborting before team.create')

    // ── S1+S2+S3: team X (async delegation — the liveness path) ─────────
    log('── S1–S3: team X (async delegate; the liveness arc) ──')
    const createX = await remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_X,
      blueprintId: BP_X_ID,
      initialWork: { prompt: MK_X },
    }, 'c1x')
    writeEvidence('s1-team-create-x.json', createX.body ?? createX)
    const createXOk = createX.status === 200
      && createX.body?.result?.ok === true
      && createX.body?.result?.value?.data?.path === 'fresh-root'
    check('S1.0', 'team.create (X) succeeds on the fresh root', createXOk, `status=${createX.status} body=${JSON.stringify(createX.body ?? createX).slice(0, 400)}`)
    if (!createXOk) fail('S1.0')

    // X leader chain: create_member → delegate(async) → done.
    const xDone = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_X) && lastUserTextOf(r).includes(MK_X) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_X_DONE', 300_000, 'X leader chain final')
    if (xDone === null) {
      fail('S1')
      check('S1', 'the X leader chain completed (create + async delegate admitted)', false, `requests=${mock.requests.length}`)
    }

    // The member's bash (the allow-ask) reaches the durable request.
    let xLedger = { requests: [], decisions: [], consumptions: [] }
    const xReqDeadline = Date.now() + 90_000
    for (;;) {
      xLedger = readControlLedger(CREATE_ROOT_X)
      if (xLedger.requests.length >= 1) break
      if (Date.now() >= xReqDeadline) break
      await new Promise((r) => setTimeout(r, 500))
    }
    // At this moment EXACTLY one request exists (the member's first ask).
    const xAllowReq = xLedger.requests.find((q) => q.kind === 'leader-approval')
    writeEvidence('s1-x-ledger-pending.json', xLedger)
    const xAllowRequestId = xAllowReq?.requestId ?? null
    check('S1b', 'the member bash ask created a durable leader-approval request (pending)', xAllowRequestId !== null,
      `requests=${JSON.stringify(xLedger.requests).slice(0, 300)}`)
    if (xAllowRequestId === null) fail('S1b')

    // S1: the LEADER's notification turn — the mock calls
    // team_list_pending_control; the EXACT requestId must appear in the
    // tool result.
    const xNotif = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_X_ALLOW), 120_000, 'X notification turn start')
    if (xNotif === null) {
      fail('S1')
      check('S1c', 'the C1 liveness notification reached the Leader as a model-visible input turn', false, `requests=${mock.requests.length}`)
    } else {
      writeEvidence('s1-x-notification-request.json', { seq: xNotif.seq, text: lastUserTextOf(xNotif).slice(0, 1200) })
      check('S1c', 'the C1 liveness notification reached the Leader (token-leading, the exact requestId + both approval-loop tools named)',
        lastUserTextOf(xNotif).includes('team_list_pending_control') && lastUserTextOf(xNotif).includes('team_resolve_control')
        && lastUserTextOf(xNotif).includes(xAllowRequestId ?? ''),
        `text=${lastUserTextOf(xNotif).slice(0, 200)}`)
      if (!lastUserTextOf(xNotif).includes(xAllowRequestId ?? '')) fail('S1c')
      const xNotifList = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_X_ALLOW) && toolMsgsOf(r).length === 1, 120_000, 'X notification list result')
      if (xNotifList === null) {
        fail('S1')
        check('S1d', 'S1: the Leader called team_list_pending_control (tool result observed)', false, `requests=${mock.requests.length}`)
      } else {
        const listResult = String(xNotifList.body.messages.filter((m) => m.role === 'tool').pop()?.content ?? '')
        writeEvidence('s1-x-list-result.json', { seq: xNotifList.seq, result: listResult.slice(0, 2000) })
        check('S1d', 'S1: team_list_pending_control returned the EXACT pending requestId',
          listResult.includes(xAllowRequestId ?? '\u0000'),
          `result=${listResult.slice(0, 300)}`)
        if (!listResult.includes(xAllowRequestId ?? '\u0000')) fail('S1d')
      }
    }

    // S2: the leader resolves allow (the same model-facing tool); the
    // member's bash EXECUTES; one consumption fact.
    const xNotifDone = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_X_ALLOW) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_NOTIF_DONE', 120_000, 'X notification turn done')
    if (xNotifDone === null) {
      fail('S2')
      check('S2a', 'the X leader resolved the allow through team_resolve_control (turn completed)', false, `requests=${mock.requests.length}`)
    }
    const xExec = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_XMEM) && toolMsgsOf(r).length === 1, 240_000, 'X member bash #1 result')
    if (xExec === null) {
      fail('S2')
      check('S2b', 'S2: the member bash executed after the allow (tool result returned)', false, `requests=${mock.requests.length}`)
    } else {
      const execResult = String(xExec.body.messages.filter((m) => m.role === 'tool').pop()?.content ?? '')
      writeEvidence('s2-x-bash-result.json', { seq: xExec.seq, result: execResult.slice(0, 800) })
      check('S2b', 'S2: the member bash EXECUTED after the Leader allow (guard passed, output returned)',
        execResult.includes('x-allow-executed') && !/blocked|denied|pending/i.test(execResult.slice(0, 400)),
        `result=${execResult.slice(0, 200)}`)
      if (!execResult.includes('x-allow-executed')) fail('S2b')
      check('S2c', 'S2: the side effect landed (the allow file exists)', existsSync(FILE_X_ALLOW), `file=${FILE_X_ALLOW}`)
      if (!existsSync(FILE_X_ALLOW)) fail('S2c')
    }

    // S3: the member's SECOND bash (the deny-ask) — a second durable
    // request, a second notification, the leader resolves DENY.
    const xDenyNotif = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_X_DENY), 240_000, 'X deny notification')
    const xLedger2 = readControlLedger(CREATE_ROOT_X)
    writeEvidence('s3-x-ledger-deny-pending.json', xLedger2)
    const xDenyReq = xLedger2.requests.find((q) => q.requestId !== xAllowRequestId && q.kind === 'leader-approval')
    if (xDenyNotif === null || xDenyReq === undefined) {
      fail('S3')
      check('S3a', 'S3: the second member ask created a second durable request + notification', false,
        `requests=${JSON.stringify(xLedger2.requests).slice(0, 300)} notif=${xDenyNotif === null ? 'none' : xDenyNotif.seq}`)
    } else {
      check('S3a', 'S3: the second member ask created a second durable request + notification', true, `requestId=${xDenyReq.requestId} notifSeq=${xDenyNotif.seq}`)
      const xDenyDone = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_X_DENY) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_NOTIF_DONE', 120_000, 'X deny notification done')
      const xDenyResult = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_XMEM) && toolMsgsOf(r).length === 2, 240_000, 'X member bash #2 result')
      if (xDenyDone === null || xDenyResult === null) {
        fail('S3')
        check('S3b', 'S3: the Leader resolved deny and the member received the verdict', false, `requests=${mock.requests.length}`)
      } else {
        const denyResult = String(xDenyResult.body.messages.filter((m) => m.role === 'tool').pop()?.content ?? '')
        writeEvidence('s3-x-deny-result.json', { seq: xDenyResult.seq, result: denyResult.slice(0, 800) })
        check('S3b', 'S3: the denied member bash was BLOCKED (verdict returned, no output)',
          /blocked|denied|deny|pending/i.test(denyResult.slice(0, 400)) && !denyResult.includes('x-deny-executed'),
          `result=${denyResult.slice(0, 200)}`)
        if (!/blocked|denied|deny|pending/i.test(denyResult.slice(0, 400))) fail('S3b')
        check('S3c', 'S3: the denied bash had ZERO side effects (the deny file does NOT exist)', !existsSync(FILE_X_DENY), `file=${FILE_X_DENY}`)
        if (existsSync(FILE_X_DENY)) fail('S3c')
      }
    }

    // S2/S3 ledger closure: decisions + exactly one consumption for the
    // ALLOWED request (the denied one is never consumed).
    const xLedgerFinal = readControlLedger(CREATE_ROOT_X)
    writeEvidence('s2s3-x-ledger-final.json', xLedgerFinal)
    const xAllowConsumptions = xLedgerFinal.consumptions.filter((c) => c.requestId === xAllowRequestId)
    const xDenyConsumptions = xLedgerFinal.consumptions.filter((c) => c.requestId !== undefined && c.requestId !== xAllowRequestId)
    const xAllowDecision = xLedgerFinal.decisions.find((d) => d.requestId === xAllowRequestId)
    const xDenyDecision = xLedgerFinal.decisions.find((d) => d.requestId !== undefined && d.requestId !== xAllowRequestId)
    check('S2d', 'S2: exactly ONE consumption fact for the allowed request (allow-once)', xAllowConsumptions.length === 1,
      `consumptions=${JSON.stringify(xLedgerFinal.consumptions).slice(0, 300)}`)
    if (xAllowConsumptions.length !== 1) fail('S2d')
    check('S3d', 'S3: the denied request has a deny decision and ZERO consumptions',
      xDenyDecision !== undefined && String(xDenyDecision.decision).toLowerCase().includes('den') && xDenyConsumptions.length === 0,
      `denyDecision=${JSON.stringify(xDenyDecision) ?? 'none'} denyConsumptions=${xDenyConsumptions.length}`)
    if (xDenyDecision === undefined || xDenyConsumptions.length !== 0) fail('S3d')
    check('S2e', 'S2: the allow decision is durable in the ledger (recorded by the model-facing tool)',
      xAllowDecision !== undefined && String(xAllowDecision.decision).toLowerCase().includes('all'),
      `allowDecision=${JSON.stringify(xAllowDecision) ?? 'none'}`)
    if (xAllowDecision === undefined) fail('S2e')

    // ── S4+S5: team Z (async delegate; the notification is REFUSED) ─────
    log('── S4–S5: team Z (notification failure recovery + idempotent retry) ──')
    const createZ = await remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_Z,
      blueprintId: BP_Z_ID,
      initialWork: { prompt: MK_Z },
    }, 'c1z')
    writeEvidence('s4-team-create-z.json', createZ.body)
    const createZOk = createZ.status === 200
      && createZ.body?.result?.ok === true
      && createZ.body?.result?.value?.data?.path === 'fresh-root'
    check('S4.0', 'team.create (Z) succeeds', createZOk, `status=${createZ.status} body=${JSON.stringify(createZ.body ?? createZ).slice(0, 300)}`)
    if (!createZOk) fail('S4.0')

    // S4: the notification delivery was ATTEMPTED and REFUSED (mock 500
    // record for the Z member-ask notification request).
    const zNotifReq = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_Z_FILE), 120_000, 'Z notification attempt (the refused one)')
    writeEvidence('s4-z-notification-attempt.json', zNotifReq === undefined ? { present: false } : {
      seq: zNotifReq.seq,
      status: zNotifReq.status,
      error: zNotifReq.error,
      text: lastUserTextOf(zNotifReq).slice(0, 1200),
    })
    check('S4a', 'S4: the notification delivery was attempted and failed (mock refused the Leader notification turn, HTTP 500)',
      zNotifReq !== undefined && zNotifReq.status === 500,
      `seq=${zNotifReq?.seq} status=${zNotifReq?.status}`)
    if (zNotifReq === undefined || zNotifReq.status !== 500) fail('S4a')

    // S4: the request REMAINS durable + pending (the failure did not
    // remove/deny/allow it). "pending" = no control-decision-recorded
    // row for the requestId (the payload has no status field).
    let zLedger = readControlLedger(CREATE_ROOT_Z)
    const zReqDeadline = Date.now() + 60_000
    for (;;) {
      zLedger = readControlLedger(CREATE_ROOT_Z)
      if (zLedger.requests.length >= 1) break
      if (Date.now() >= zReqDeadline) break
      await new Promise((r) => setTimeout(r, 500))
    }
    const zReq = zLedger.requests.find((q) => q.kind === 'leader-approval' && q.correlation !== S5_TOKEN)
    const zPending = zReq !== undefined && !zLedger.decisions.some((d) => d.requestId === zReq.requestId)
    writeEvidence('s4-z-ledger-pending.json', zLedger)
    check('S4b', 'S4: after the notification failure the request is still durable + pending (no decision row; not removed)',
      zPending,
      `requests=${JSON.stringify(zLedger.requests).slice(0, 300)} decisions=${JSON.stringify(zLedger.decisions).slice(0, 200)}`)
    if (zReq === undefined) fail('S4b')

    // UPSTREAM LIVE-FACT (run 3, this round): a model-error turn dies
    // after a FINITE retry storm (observed: 5 retries — mock seq 23–28
    // all 500), and a turn that ENDS IN ERROR does NOT re-wake its queued
    // input (agent-loop `kick()`: the post-turn re-wake requires
    // `wakeRequested`, which a live running driver never latches for
    // mid-turn input — the queued input is stranded until the next
    // EXTERNAL input). So the explicit recovery input must arrive after
    // the failed turn has settled: wait for mock quiescence (the retry
    // storm over → the turn dead → the session idle), then send with a
    // bounded re-prompt (a re-prompt to an idle session claims the whole
    // queue, so a stranded first prompt is drained by its own turn).
    let lastSeenCount = mock.requests.length
    let lastGrowAt = Date.now()
    let quiesced = false
    const quiesceDeadline = Date.now() + 120_000
    for (;;) {
      await new Promise((r) => setTimeout(r, 2000))
      if (mock.requests.length !== lastSeenCount) {
        lastSeenCount = mock.requests.length
        lastGrowAt = Date.now()
      } else if (Date.now() - lastGrowAt >= 10_000) {
        quiesced = true
        break
      }
      if (Date.now() >= quiesceDeadline) break
    }
    log(`S4 recovery preflight: mock quiescence ${quiesced ? 'observed' : 'NOT observed (120s deadline)'} (requests=${mock.requests.length})`)

    // S4 recovery: an EXPLICIT Leader input (no notification involved) →
    // list (S4c) → resolve (S4d) → S5 probe (request_control) → S5 retry
    // (same scope + same token) → done. Bounded re-prompt: a prompt
    // stranded behind a still-settling failed turn is drained by the next
    // one (the idle session claims the whole queue in one turn).
    let zCheckList = null
    for (let attempt = 1; attempt <= 3 && zCheckList === null; attempt += 1) {
      const zCheckPrompt = await apiPrompt(booted.origin, booted.cookie, CREATE_ROOT_Z, MK_ZCHECK)
      if (zCheckPrompt.status !== 200) fail('S4c')
      zCheckList = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_ZCHECK) && toolMsgsOf(r).length === 1, 90_000, `Z recovery chain: list result (attempt ${attempt})`)
    }
    if (zCheckList === null) {
      fail('S4c')
      check('S4c', 'S4: the explicit Leader input reached the Leader turn (recovery chain running)', false, `requests=${mock.requests.length}`)
    } else {
      const zListResult = String(zCheckList.body.messages.filter((m) => m.role === 'tool').pop()?.content ?? '')
      writeEvidence('s4-z-list-result.json', { seq: zCheckList.seq, result: zListResult.slice(0, 2000) })
      check('S4c', 'S4: team_list_pending_control (explicit read, NO notification) discovered the exact pending requestId',
        zListResult.includes(zReq.requestId ?? '\u0000'), `result=${zListResult.slice(0, 300)}`)
      if (!zListResult.includes(zReq.requestId ?? '\u0000')) fail('S4c')

      const zCheckDone = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_ZCHECK) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_Z_LEADER_DONE', 240_000, 'Z recovery chain done')
      check('S4d', 'S4: the Leader resolved the recovered request through team_resolve_control (chain completed)',
        zCheckDone !== null, `requests=${mock.requests.length}`)
      if (zCheckDone === null) fail('S4d')

      // S4e: the member's ORIGINAL blocked bash now proceeds (its
      // control wait returned the allow; the guard consumed it).
      const zExec = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_ZMEM) && toolMsgsOf(r).length === 1, 240_000, 'Z member bash result (after recovery)')
      if (zExec === null) {
        fail('S4e')
        check('S4e', 'S4: the recovered member bash EXECUTED (the operation proceeded after the pending-list recovery)', false, `requests=${mock.requests.length}`)
      } else {
        const zResult = String(zExec.body.messages.filter((m) => m.role === 'tool').pop()?.content ?? '')
        writeEvidence('s4-z-bash-result.json', { seq: zExec.seq, result: zResult.slice(0, 800) })
        check('S4e', 'S4: the recovered member bash EXECUTED (the operation proceeded after the pending-list recovery)',
          zResult.includes('z-executed') && !/blocked|denied|pending/i.test(zResult.slice(0, 400)),
          `result=${zResult.slice(0, 200)}`)
        if (!zResult.includes('z-executed')) fail('S4e')
        check('S4f', 'S4: the recovered side effect landed (the z file exists)', existsSync(FILE_Z), `file=${FILE_Z}`)
        if (!existsSync(FILE_Z)) fail('S4f')
      }
    }

    // S5: the idempotent retry through the production tool surface —
    // same scope + same requestToken (the correlation) → the SAME
    // requestId, ONE durable row, NO duplicate notification.
    const zCheckReq1 = mock.requests.find((r) => r.body !== null && lastUserTextOf(r).includes(MK_ZCHECK) && toolMsgsOf(r).length === 3)
    const zCheckReq2 = mock.requests.find((r) => r.body !== null && lastUserTextOf(r).includes(MK_ZCHECK) && toolMsgsOf(r).length === 4)
    // TRIGGER-SCOPED extraction (LIVE-FOUND run 4: the Z root history
    // carries the MK_Z chain's create_member + delegate tool results
    // BEFORE the ZCHECK trigger — filtering the full message array
    // shifted every index by 2, so the "probe result" was actually the
    // list result and the "retry result" the resolve result). The
    // post-trigger window: req1 = [list, resolve, probe], req2 =
    // [list, resolve, probe, retry].
    const probeTools = zCheckReq1 === undefined ? [] : toolMsgsOf(zCheckReq1)
    const retryTools = zCheckReq2 === undefined ? [] : toolMsgsOf(zCheckReq2)
    const s5ProbeResult = String(probeTools[2]?.content ?? '')
    const s5RetryResult = String(retryTools[3]?.content ?? '')
    const s5ProbeId = extractResultRequestId(s5ProbeResult)
    const s5RetryId = extractResultRequestId(s5RetryResult)
    writeEvidence('s5-z-idempotency.json', {
      s5ProbeResult: s5ProbeResult.slice(0, 2000),
      s5RetryResult: s5RetryResult.slice(0, 2000),
      probeToolsWindow: probeTools.map((m) => String(m.content ?? '').slice(0, 1200)),
      retryToolsWindow: retryTools.map((m) => String(m.content ?? '').slice(0, 1200)),
      s5ProbeId,
      s5RetryId,
    })
    check('S5a', 'S5: the same scope + same correlation retried through team_request_control returned the SAME requestId',
      s5ProbeId !== null && s5ProbeId === s5RetryId,
      `probe=${s5ProbeId} retry=${s5RetryId}`)
    if (s5ProbeId === null || s5ProbeId !== s5RetryId) fail('S5a')

    const zLedgerFinal = readControlLedger(CREATE_ROOT_Z)
    writeEvidence('s5-z-ledger-final.json', zLedgerFinal)
    const s5Rows = zLedgerFinal.requests.filter((q) => q.correlation === S5_TOKEN)
    check('S5b', 'S5: the idempotent retry wrote exactly ONE durable request row for the scope', s5Rows.length === 1,
      `rows=${JSON.stringify(zLedgerFinal.requests.filter((q) => q.kind === 'leader-approval').map((q) => ({ id: q.requestId, correlation: q.correlation }))).slice(0, 300)}`)
    if (s5Rows.length !== 1) fail('S5b')

    // The S5 probe's notification: exactly ONE delivery attempt in the
    // mock corpus (the idempotent retry did NOT re-notify). Wait for it
    // to be processed (it is queued behind the ZCHECK turn).
    const s5NotifFirst = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_Z_S5), 120_000, 'S5 probe notification (post-turn)')
    const s5NotifAttempts = mock.requests.filter((r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_Z_S5) && toolMsgsOf(r).length === 0)
    check('S5c', 'S5: exactly ONE notification delivery attempt for the S5 probe request (the idempotent retry did NOT re-notify)',
      s5NotifFirst !== undefined && s5NotifAttempts.length === 1,
      `attempts=${s5NotifAttempts.length}`)
    if (s5NotifAttempts.length !== 1) fail('S5c')

    // Wait for the S5 notification chain to finish (list → resolve allow)
    // before reading the decision row (no ledger race).
    const s5NotifDone = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_Z_S5) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_NOTIF_DONE', 120_000, 'S5 probe notification chain done')

    const zLedgerFinal2 = readControlLedger(CREATE_ROOT_Z)
    const zConsumptions = zLedgerFinal2.consumptions.filter((c) => c.requestId === zReq?.requestId)
    const s5Decision = zLedgerFinal2.decisions.find((d) => d.requestId === s5ProbeId)
    check('S4g', 'S4: the recovered allow produced exactly ONE consumption fact (allow-once)', zConsumptions.length === 1,
      `consumptions=${JSON.stringify(zLedgerFinal2.consumptions).slice(0, 300)}`)
    if (zConsumptions.length !== 1) fail('S4g')
    check('S5d', 'S5: the S5 probe request was resolved through the liveness chain (the decision is durable)',
      s5Decision !== undefined, `decision=${JSON.stringify(s5Decision) ?? 'none'}`)
    if (s5Decision === undefined) fail('S5d')

    // ── S6: team Y (SYNC delegate — the busy-Leader characterization) ────
    log('── S6: team Y (sync delegate; the busy-Leader characterization) ──')
    // LIVE-FACT (run 3): team.create AWAITS the root's boot turn (it
    // delivers initialWork and does not respond until that turn COMPLETES).
    // With a sync delegate in the boot chain the turn blocks on the human
    // decision — so awaiting create() inline self-deadlocks the kit
    // against the decision it must later make (run 3: the create fetch
    // burned the full 240s client timeout → status=0, while the server
    // completed the create and the whole S6a–S6g arc still passed).
    // Fire the create WITHOUT awaiting; collect its response after the
    // human allow unblocks the boot turn.
    const createYPromise = remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_Y,
      blueprintId: BP_Y_ID,
      initialWork: { prompt: MK_Y },
    }, 'c1y')

    // Wait for the member's durable ask (the Leader is now BLOCKED in the
    // sync delegate — the turn has not returned to the model).
    let yLedger = { requests: [] }
    const yReqDeadline = Date.now() + 120_000
    for (;;) {
      yLedger = readControlLedger(CREATE_ROOT_Y)
      if (yLedger.requests.length >= 1) break
      if (Date.now() >= yReqDeadline) break
      await new Promise((r) => setTimeout(r, 500))
    }
    const yReq = yLedger.requests.find((q) => q.kind === 'leader-approval')
    writeEvidence('s6-y-ledger-pending.json', yLedger)
    if (yReq === undefined) {
      fail('S6')
      check('S6a', 'S6: the member bash ask created a durable request while the Leader turn was blocked in the sync delegate', false,
        `requests=${JSON.stringify(yLedger.requests).slice(0, 300)}`)
    } else {
      check('S6a', 'S6: the member bash ask created a durable request while the Leader turn was blocked in the sync delegate', true,
        `requestId=${yReq.requestId}`)
      // S6 characterization point 1: at THIS moment the Leader's delegate
      // has not returned (no MK_Y request carrying the delegate result)
      // and the queued notification has NOT been processed (no c1-y
      // notification request in the mock corpus yet).
      const yDelegateReturned = mock.requests.some((r) => r.body !== null && lastUserTextOf(r).includes(MK_Y) && toolMsgsOf(r).length >= 2)
      const yNotifSeen = mock.requests.some((r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_Y))
      const yHealthBusy = await p6t6Health(booted.port)
      writeEvidence('s6-y-busy-characterization.json', {
        note: 'captured while the Leader turn is blocked in the sync delegate and the notification is queued (immediate Leader decision NOT schedulable in this topology — the human resolver channel is the breaker; the guidance is async: true for approval-capable work)',
        yDelegateReturned,
        yNotifSeen,
        healthDuringBusy: yHealthBusy.body,
        mockTimeline: mock.requests.map((r) => ({ seq: r.seq, receivedAt: r.receivedAt, userHead: lastUserTextOf(r).slice(0, 60) })),
      })
      check('S6b', 'S6 (characterization): while the Leader is blocked, the root notification is QUEUED — not yet processed (its model request is absent; the delegate result is absent)',
        !yDelegateReturned && !yNotifSeen,
        `delegateReturned=${yDelegateReturned} notifSeen=${yNotifSeen}`)
      // The row must still be healthy (no plugin deadlock at the row).
      check('S6c', 'S6: the plugin row stays healthy while the Leader is blocked (no row-level deadlock)',
        yHealthBusy.status === 200 && yHealthBusy.body?.ok === true,
        `health=${JSON.stringify(yHealthBusy.body).slice(0, 200)}`)
      if (!(yHealthBusy.status === 200 && yHealthBusy.body?.ok === true)) fail('S6c')

      // S6: the HUMAN resolver channel stays open: resolve while the
      // Leader is busy AND the notification delivery is in flight (the
      // control lock is NOT held by the delivery — the fire-and-forget
      // notifier runs after the lock release).
      const yApproval = await scriptedHumanApproval(booted.origin, booted.cookie, CREATE_ROOT_Y, yReq.requestId)
      const yApprovalOk = yApproval.status === 200
        && yApproval.body?.result?.ok !== false
        && JSON.stringify(yApproval.body).includes('allow')
      check('S6d', 'S6: the human resolver channel works WHILE the Leader is busy + the notification in flight (no control-lock deadlock)',
        yApprovalOk, `status=${yApproval.status} body=${JSON.stringify(yApproval.body).slice(0, 300)}`)
      if (!yApprovalOk) fail('S6d')

      // The human allow unblocks the sync delegate → the member turn ends
      // → the delegate returns → the boot turn completes → the
      // team.create(Y) RPC finally responds.
      const createY = await createYPromise
      writeEvidence('s6-team-create-y.json', createY.body)
      const createYOk = createY.status === 200
        && createY.body?.result?.ok === true
        && createY.body?.result?.value?.data?.path === 'fresh-root'
      check('S6.0', 'team.create (Y) succeeds (the RPC awaits the boot turn; the human allow unblocked it)',
        createYOk, `status=${createY.status} body=${JSON.stringify(createY.body ?? createY).slice(0, 300)}`)
      if (!createYOk) fail('S6.0')

      // The member's guard consumes the allow; the bash executes; the
      // member turn ends; the sync delegate RETURNS; the Leader turn
      // completes.
      const yDone = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_Y) && toolMsgsOf(r).length >= 2 && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_Y_DONE', 300_000, 'Y leader turn complete')
      check('S6e', 'S6: after the human allow the member bash executed and the blocked Leader turn COMPLETED (the sync delegate returned)',
        yDone !== null && existsSync(FILE_Y),
        `yDone=${yDone === null ? 'null' : yDone.seq} fileExists=${existsSync(FILE_Y)}`)
      if (yDone === null || !existsSync(FILE_Y)) fail('S6e')

      // S6 characterization point 2: the QUEUED notification is now
      // processed — its model request appears AFTER the Leader turn
      // completed, and the pending list on the post-turn Leader reflects
      // the recorded decision (the request is no longer pending).
      const yNotifAfter = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_Y), 120_000, 'Y queued notification processed post-turn')
      if (yNotifAfter === null) {
        fail('S6f')
        check('S6f', 'S6 (characterization): the queued notification was processed AFTER the Leader turn completed', false, `requests=${mock.requests.length}`)
      } else {
        // The notification chain lists the pending requests — wait for
        // the list result (the decision is recorded → the request is not
        // listed as pending).
        const yNotifList = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_Y) && toolMsgsOf(r).length === 1, 60_000, 'Y post-turn notification list result')
        const yDoneAt = yDone?.receivedAt
        const yNotifAt = yNotifAfter.receivedAt
        const yListResult = yNotifList === undefined ? '' : String(yNotifList.body.messages.filter((m) => m.role === 'tool').pop()?.content ?? '')
        writeEvidence('s6-y-post-turn-notification.json', {
          yDoneAt,
          yNotifAt,
          queuedThenProcessed: yDoneAt !== undefined && yNotifAt !== undefined && new Date(yNotifAt).getTime() >= new Date(yDoneAt).getTime(),
          listResult: yListResult.slice(0, 1200),
        })
        check('S6f', 'S6 (characterization): the queued notification was processed AFTER the Leader turn completed (immediate decision NOT schedulable in this topology)',
          yDoneAt !== undefined && yNotifAt !== undefined && new Date(yNotifAt).getTime() >= new Date(yDoneAt).getTime(),
          `doneAt=${yDoneAt} notifAt=${yNotifAt}`)
        if (yNotifList === undefined) fail('S6f')
        check('S6g', 'S6: on the post-turn Leader the pending list reflects the recorded decision (the request is no longer pending)',
          yNotifList !== undefined && !yListResult.includes(yReq.requestId ?? '\u0000'),
          `listResult=${yListResult.slice(0, 200)}`)
        if (yNotifList !== undefined && yListResult.includes(yReq.requestId ?? '\u0000')) fail('S6g')
      }
    }
  } finally {
    // Teardown (evidence is flushed before the world goes).
    log('teardown: stopping host + mock')
    stopHost(host)
    try {
      await mock.close()
    } catch { /* best-effort */ }
    const postStable = {
      p3080: await probeStableInstance('http://127.0.0.1:3080/'),
      p3180: await probeStableInstance('http://127.0.0.1:3180/'),
    }
    writeEvidence('post-stable-probe.json', postStable)
    writeEvidence('mock-requests.json', mock.requests.map((r) => ({
      seq: r.seq,
      receivedAt: r.receivedAt,
      status: r.status ?? null,
      userTextHead: lastUserTextOf(r).slice(0, 200),
      toolMsgCountAfterLastUser: toolMsgsOf(r).length,
      reply: r.reply,
    })))
    writeEvidence('instance-tail.txt', logTail(booted.instanceLog, 120))
    if (FLAG_KEEP) {
      log(`--keep: world retained at ${HOME}`)
    } else {
      rmSync(HOME, { recursive: true, force: true })
      rmSync(BLUEPRINT_DIR, { recursive: true, force: true })
      log(`world removed (${HOME})`)
    }
    const passed = criteria.filter((c) => c.ok).length
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
    log(`VERDICT ${summary.verdict} — ${passed}/${criteria.length} criteria passed${FAILS.length > 0 ? `; failed: ${FAILS.join(',')}` : ''}`)
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
