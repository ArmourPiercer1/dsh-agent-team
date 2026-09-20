#!/usr/bin/env node
/**
 * work-completion-wakeup-smoke.mjs — async work-completion (wake-up)
 * real-host smoke on a pristine DSH 0.1.5-rc.2 checkout. Plan:
 * docs/plans/active/dsh-agent-team-work-completion-wakeup-implementation-plan.md
 * §25 (L1–L4).
 *
 * WHAT IT PROVES (the wake-up acceptance arc on a real host):
 *
 *   L1 — single async completion wakes an idle Leader: the Leader's
 *        scripted turn admits ONE `team_delegate(async: true)` (create
 *        form) and returns — the Leader turn ends, the Leader is IDLE.
 *        When the member's work unit reaches its durable terminal
 *        settlement, the runtime's completion observer fires the
 *        best-effort wake-up: the Leader AUTOMATICALLY gets a NEW model
 *        request (idle → followup) whose text leads with
 *        `[team-work-settled requestToken=<token>]`. On that wake turn
 *        the Leader (mock) calls `team_collect([token])` and the tool
 *        result carries the member's durable result (correct body).
 *   L2 — two async members, staggered completion: the Leader admits TWO
 *        async work units in ONE turn. The first settlement wakes the
 *        idle Leader (followup); the second settlement reaches the
 *        Leader without any manual user input — either via `inject` into
 *        the current turn's next step (Stop-priority: the non-waking
 *        send), or via a fresh followup if the Leader is already idle
 *        again; the two notifications may also be merged-observed within
 *        one step/turn. Both tokens are `team_collect`-ed. The model-
 *        call count for the Leader session is recorded (the plan does
 *        NOT require strict single-turn proof).
 *   L3 — failed member completion wakes: the member's work turn fails
 *        (a controlled mock model error) → the work unit settles
 *        TERMINAL with the failure (LIVE-FOUND: a controlled model error
 *        persists a FAILED member result — `memberResult.status: failed`
 *        under `workOutcome: settled` — not the transport-fault
 *        `delivery-failed` variant; both are durable terminal facts)
 *        → the Leader is STILL woken (terminal authority = the durable
 *        settlement fact, never the promise outcome) → `team_collect`
 *        reports the failed/unavailable result.
 *   L4 — sync regression: a plain `team_delegate` (no async) still
 *        BLOCKS the Leader turn to the terminal result (the member
 *        result is IN the tool result), and NO separate completion
 *        notification turn appears for the token (the tool result is
 *        the completion channel — the sync path is byte-identical).
 *
 * TOPOLOGY (four created teams on one production row — one per scenario,
 * the C1 kit's isolation pattern; each team = one blueprint, one root):
 *   - Team L1: the core wake arc (async → idle → followup wake → collect).
 *   - Team L2: two staggered async units (followup + inject/followup).
 *   - Team L3: the fail-closed wake (controlled member model error).
 *   - Team L4: the sync no-notify regression.
 *
 * DESIGN NOTES:
 *   - The mock model is a decision oracle (the a2x/rc2/C1 pattern).
 *     Chain routing is over the LAST marker-bearing user message + the
 *     tool messages AFTER it (a session's request history carries every
 *     earlier chain's tool results — the C1 LIVE-FOUND 08-45-27 lesson).
 *     Wake-up turns are recognized by their token-leading text
 *     `[team-work-settled requestToken=`; the chain extracts the
 *     requestToken and calls `team_collect([token])` — NO test-only
 *     decision injection: the collect is the same model-facing tool the
 *     plan names as the recovery path.
 *   - Member work is plain text (no bash): a member's turn either ends
 *     with a body (L1/L2/L4 — succeeded) or with a controlled model
 *     error (L3 — the fail-closed settlement). Zero side-effect files:
 *     the durable evidence is the plugin ledger + the mock corpus.
 *   - Durable evidence: the plugin's TeamDomain ledger in
 *     `<DSH_HOME>/storages/team_domain.json` (read-only scan: the
 *     `team-work-admitted` + `member-lifecycle-changed to=SETTLED`
 *     facts per token, incl. the L3 fail-closed `workOutcome`) + the
 *     mock request corpus (every model request with the wake-up text,
 *     the collect tool results, and the Leader model-call count).
 *   - WORLD: host = the pristine test-use checkout (DSH 0.1.5-rc.2 @
 *     fb2c4b9e69) launched as `node <testuse>/apps/cli/lib/bin.js web`
 *     with cwd = a scratch session workspace; env: DSH_HOME=<world home
 *     under tests/homes/>, DSH_CLIENT_COMMIT_HASH=fb2c4b9e69,
 *     DEEPSEEK_BASE_URL=<in-process mock model>. Plugin rows mounted
 *     ONLY through the public profile-patch seam (production row = the
 *     WORKTREE's dist — this is the work-completion-wakeup branch
 *     build; p6t6 observability row). The preset is the same
 *     minimal-style smoke preset as the C1/rc2 kits.
 *   - ZERO-TOUCH: the live instances :3080 and :3180 are probed
 *     read-only (status recorded pre/post) and never written to. Do
 *     NOT run this kit in parallel with a full `vitest` run (shared
 *     port family + CPU load).
 *
 * USAGE:
 *   node tests/kits/work-completion-wakeup-smoke/work-completion-wakeup-smoke.mjs \
 *     [--worktree <path>] [--testuse <path>] [--host-port N] \
 *     [--mock-port N] [--evidence-dir <path>] [--keep]
 *   defaults: --worktree = the repo root containing this kit (3 levels
 *   up), --testuse = <worktree>/tests/deepseek-harness-test-use (fallback:
 *   the parent repo's tests/deepseek-harness-test-use — the gitignored
 *   checkout only exists in the main checkout, not in task worktrees),
 *   host port = first free of the 3491–3500 family (mock port aside),
 *   mock port = 3496, evidence dir =
 *   dev/agent-workflow/evidence/work-completion-wakeup/smoke/
 *   wakeup-smoke-<stamp>/.
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

const SMOKE_PRESET_ID = 'wcn-smoke'
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
// delegate (create + continue forms) + collect (the recovery path the
// wake-up text points at) + the read-side addressing tools.
const LEADER_TEAM_TOOLS_ALLOW = [
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_delegate',
  'team_follow_up',
  'team_collect',
]

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').replace('T', 'T').slice(0, 19)
const RUN_DIR = EVIDENCE_DIR_ARG
  ? resolve(EVIDENCE_DIR_ARG)
  : join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'work-completion-wakeup', 'smoke', `wakeup-smoke-${RUN_STAMP}`)
const HOME = join(WORKTREE, 'tests', 'homes', `wcn-smoke-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const BLUEPRINT_DIR = join(WORKTREE, `.wcn-smoke-blueprints-${RUN_STAMP}`)

const ROOT = `session-wcn-smoke-root-${RUN_STAMP}`
const CREATE_ROOT_L1 = `session-wcn-smoke-l1-${RUN_STAMP}`
const CREATE_ROOT_L2 = `session-wcn-smoke-l2-${RUN_STAMP}`
const CREATE_ROOT_L3 = `session-wcn-smoke-l3-${RUN_STAMP}`
const CREATE_ROOT_L4 = `session-wcn-smoke-l4-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.wcn-anchor'
const BP_L1_ID = 'team.wcn-l1'
const BP_L2_ID = 'team.wcn-l2'
const BP_L3_ID = 'team.wcn-l3'
const BP_L4_ID = 'team.wcn-l4'

// Distinct markers (no substring collisions).
const MK_DISC = `WCMK_DISC_${RUN_STAMP}`
const MK_L1 = `WCMK_L1_${RUN_STAMP}`
const MK_L1MEM = `WCMK_L1MEM_${RUN_STAMP}`
const MK_L2 = `WCMK_L2_${RUN_STAMP}`
const MK_L2A = `WCMK_L2A_${RUN_STAMP}`
const MK_L2B = `WCMK_L2B_${RUN_STAMP}`
const MK_L3 = `WCMK_L3_${RUN_STAMP}`
const MK_L3MEM = `WCMK_L3MEM_${RUN_STAMP}`
const MK_L4 = `WCMK_L4_${RUN_STAMP}`
const MK_L4MEM = `WCMK_L4MEM_${RUN_STAMP}`

// The wake-up notification prefix (the renderer's first line, plan §5).
const NOTIF_PREFIX = '[team-work-settled requestToken='
// Deterministic delegate request tokens (the mock routes wake chains by
// them: the wake-up text carries the exact token).
const TOK_L1 = `wcn-l1-delegate-${RUN_STAMP}`
const TOK_L2A = `wcn-l2a-delegate-${RUN_STAMP}`
const TOK_L2B = `wcn-l2b-delegate-${RUN_STAMP}`
const TOK_L3 = `wcn-l3-delegate-${RUN_STAMP}`
const TOK_L4 = `wcn-l4-delegate-${RUN_STAMP}`
const TOKEN_TO_ROOT = { [TOK_L1]: CREATE_ROOT_L1, [TOK_L2A]: CREATE_ROOT_L2, [TOK_L2B]: CREATE_ROOT_L2, [TOK_L3]: CREATE_ROOT_L3, [TOK_L4]: CREATE_ROOT_L4 }
// Member result bodies (asserted verbatim in the collect tool results).
const RESULT_L1 = 'WCMK_RESULT_L1_BODY'
const RESULT_L2A = 'WCMK_RESULT_L2A_BODY'
const RESULT_L2B = 'WCMK_RESULT_L2B_BODY'
const RESULT_L4 = 'WCMK_RESULT_L4_BODY'

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

// ── small http helpers (a2x/rc2/C1 kit shape) ───────────────────────────────

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
async function remoteCall(origin, cookie, method, params, tag = 'wcn', version = 1) {
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
async function apiPrompt(origin, cookie, sessionId, text, tag = 'wcn') {
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
  // The wake-up branch must actually be in the dist the row mounts.
  const glue = readFileSync(GLUE_PATH, 'utf8')
  if (!glue.includes('deliverRootWorkCompletionNotification')) {
    dieFatal('the worktree dist glue does not carry deliverRootWorkCompletionNotification — run pnpm build && pnpm build:composition in the worktree first')
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
    staticModel: { provider: 'deepseek-official', model: 'wcn-smoke-model' },
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
  `  persona: "You are the leader of the work-completion smoke boot team. ${MK_DISC} is the discovery marker."`,
  'members:',
  '  - templateId: worker',
  '    persona: "You are a worker of the work-completion smoke boot team."',
  'memberEnvelopes: []',
  'requirements: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

/**
 * One saved-source strict blueprint (L1..L4 — same shape, different
 * personas/markers). The Leader declares the closed teamTools allow set
 * (strict Coverage Gate) + the same permission block the C1 kit used.
 * The WORKER is strict too (the capability set must be declared); its
 * work turns are plain model text — no tools at all.
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
    `# ${SMOKE_PRESET_ID} — work-completion wake-up real-host smoke preset (run ${RUN_STAMP}).`,
    '# Reused from the C1/rc2 kits (public user-preset seam): persona +',
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
    `# work-completion wake-up real-host smoke patch layer (run ${RUN_STAMP}): production dsh-agent-team row (worktree dist — the work-completion-wakeup branch build) + p6t6 observability row — mounted ONLY through the public profile-patch seam.`,
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
          DEEPSEEK_API_KEY: 'wcn-smoke-mock-key',
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
  writeFileSync(join(BLUEPRINT_DIR, 'wcn-anchor.yaml'), BP_ANCHOR_YAML)
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

// ── mock decide policy (wake-up: leaders, members, wake turns) ──────────────

function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-wcn-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
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
 * Marker = a WCMK_* scenario marker OR a wake-up notification token line.
 */
const TRIGGER_RE = /WCMK_[A-Z0-9_]+_[A-Z0-9-]+|\[team-work-settled requestToken=/
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

/** The requestToken from a wake-up notification text (`requestToken: <tok>` line). */
function extractNotifToken(text) {
  const m = /requestToken:\s*([A-Za-z0-9][A-Za-z0-9_-]{3,128})/.exec(String(text))
  return m === null ? null : m[1]
}

/**
 * CORPUS-level wake detection: does the request's history carry a
 * wake-up notification user message for the token (any position — a
 * merged wake request can carry several notification user messages,
 * and the NEWEST one may belong to the other token).
 */
function hasNotifUserMessage(req, token) {
  if (req === null || req.body === null) return false
  return messagesOf(req).some(
    (m) => m.role === 'user' && typeof m.content === 'string' && m.content.startsWith(NOTIF_PREFIX) && m.content.includes(token),
  )
}

/** The notification user message for the token (first match), or ''. */
function notifUserTextOf(req, token) {
  if (req === null || req.body === null) return ''
  const m = messagesOf(req).find(
    (x) => x.role === 'user' && typeof x.content === 'string' && x.content.startsWith(NOTIF_PREFIX) && x.content.includes(token),
  )
  return m === undefined ? '' : m.content
}

/**
 * The wake-up mock oracle. Chain routing is over (NEWEST marker-bearing
 * user message, tool messages AFTER it):
 *
 *   1. title side-calls → neutral;
 *   2. `[team-work-settled requestToken=...` → a WAKE-UP turn (the
 *      router's completion observer fired; NO user input): extract the
 *      token → `team_collect([token])` (the recovery path the text
 *      names) → W_WAKE_DONE. The token→root map is deterministic (the
 *      kit chose every delegate requestToken).
 *   3. member work chains (L1/L2A/L2B/L4: plain result text; L2B
 *      STAGGERED by a delay; L3: a controlled model error → the fail-
 *      closed settlement).
 *   4. leader initial-work chains (L1: one async delegate; L2: two;
 *   L3: one (the failing worker); L4: one SYNC — the tool call blocks
 *      to the terminal result in-band).
 */
function makeDecide() {
  // Wake-chain state: the tokens for which a team_collect call has been
  // issued (per run, not per request — the wake chain can span several
  // model requests: followup → collect → [inject of the second token] →
  // collect → done, or a fresh followup per token).
  const collecting = new Set()
  return function decide({ req }) {
    const firstMsg = messagesOf(req)[0]
    if (typeof firstMsg?.content === 'string' && firstMsg.content.startsWith('Create a concise title')) {
      return { kind: 'text', content: 'wcn smoke session' }
    }
    const lastUser = lastUserTextOf(req)
    const tools = toolMsgsOf(req).length

    // (2) the wake-up notification turns (token-leading, the observer's
    // fire-and-forget delivery — idle → followup / running → inject
    // [Stop-priority: the non-waking next-step send]).
    // ORDERING-ROBUST: a request may carry SEVERAL notification user
    // messages (e.g. token B's inject lands in the same step as token
    // A's tool result). Collect EVERY uncollected token present in the
    // request's user messages in ONE team_collect call (the tool accepts
    // up to 64 tokens); when every token in the request is already
    // collected, the wake chain is done.
    if (lastUser.startsWith(NOTIF_PREFIX)) {
      const tokens = [...new Set(
        messagesOf(req)
          .filter((m) => m.role === 'user' && typeof m.content === 'string' && m.content.startsWith(NOTIF_PREFIX))
          .map((m) => extractNotifToken(m.content))
          .filter((t) => t !== null),
      )]
      const roots = tokens.map((t) => TOKEN_TO_ROOT[t])
      if (tokens.length === 0 || roots.some((r) => r === undefined)) {
        return { kind: 'text', content: `W_WAKE_UNROUTED :: ${lastUser.slice(0, 200)}` }
      }
      const pending = tokens.filter((t) => !collecting.has(t))
      if (pending.length === 0) return { kind: 'text', content: 'W_WAKE_DONE' }
      // Every token of one request belongs to one root (a single team's
      // wake chain) — collect them together on that root.
      for (const t of pending) collecting.add(t)
      return toolCall('team_collect', {
        rootSessionId: roots[0],
        requestToken: `wcn-wake-${pending.join('.')}`,
        requestTokens: pending,
      })
    }

    // (3) member work chains.
    if (lastUser.includes(MK_L1MEM)) return { kind: 'text', content: RESULT_L1 }
    if (lastUser.includes(MK_L4MEM)) return { kind: 'text', content: RESULT_L4 }
    if (lastUser.includes(MK_L2A)) return { kind: 'text', content: RESULT_L2A }
    if (lastUser.includes(MK_L2B)) {
      // L2: A and B's work turns run in PARALLEL sessions and settle
      // within milliseconds of each other — the stagger emerges from
      // real session scheduling (the mock's decide() is synchronous, so
      // no artificial delay). The two interleavings are both asserted-
      // robust: (a) B's notification injects into A's wake turn, or
      // (b) both notifications queue and the wake request carries BOTH
      // (the mock then collects them in one multi-token call). The plan
      // records the Leader model-call count; it does not require a
      // single wake turn.
      return { kind: 'text', content: RESULT_L2B }
    }
    if (lastUser.includes(MK_L3MEM)) {
      // L3: the controlled member model failure (a client-class error —
      // non-retryable by the upstream retry policy). The member turn
      // fails → the work unit settles TERMINAL with a persisted FAILED
      // member result (memberResult.status: failed; workOutcome: settled
      // — NOT the transport-fault delivery-failed variant) → the
      // wake-up must still fire (terminal authority = the durable fact).
      return { kind: 'error', status: 400, message: 'wcn smoke L3: controlled member model failure', code: 'wcn-smoke-l3' }
    }

    // (4) leader initial-work chains (one per team, create-form
    // delegates; L1/L2/L3 async, L4 sync).
    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'W_DISC_DONE' }
    if (lastUser.includes(MK_L1)) {
      switch (tools) {
        case 0:
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT_L1,
            requestToken: TOK_L1,
            delegationTemplateId: 'worker',
            label: 'w-l1',
            prompt: `${MK_L1MEM} do the L1 probe work and answer with the result body`,
            taskSummary: 'L1 probe work (async)',
            async: true,
          })
        case 1:
          return { kind: 'text', content: 'W_L1_DONE' }
        default:
          return { kind: 'text', content: `W_L1_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_L2)) {
      switch (tools) {
        case 0:
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT_L2,
            requestToken: TOK_L2A,
            delegationTemplateId: 'worker',
            label: 'w-l2a',
            prompt: `${MK_L2A} do the L2-A work`,
            taskSummary: 'L2-A work (async)',
            async: true,
          })
        case 1:
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT_L2,
            requestToken: TOK_L2B,
            delegationTemplateId: 'worker',
            label: 'w-l2b',
            prompt: `${MK_L2B} do the L2-B work`,
            taskSummary: 'L2-B work (async)',
            async: true,
          })
        case 2:
          return { kind: 'text', content: 'W_L2_DONE' }
        default:
          return { kind: 'text', content: `W_L2_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_L3)) {
      switch (tools) {
        case 0:
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT_L3,
            requestToken: TOK_L3,
            delegationTemplateId: 'worker',
            label: 'w-l3',
            prompt: `${MK_L3MEM} do the L3 work (it will fail)`,
            taskSummary: 'L3 work (async, expected to fail)',
            async: true,
          })
        case 1:
          return { kind: 'text', content: 'W_L3_DONE' }
        default:
          return { kind: 'text', content: `W_L3_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_L4)) {
      switch (tools) {
        case 0:
          // L4: NO async — the call blocks to the terminal result.
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT_L4,
            requestToken: TOK_L4,
            delegationTemplateId: 'worker',
            label: 'w-l4',
            prompt: `${MK_L4MEM} do the L4 work (sync)`,
            taskSummary: 'L4 work (sync)',
          })
        case 1:
          return { kind: 'text', content: 'W_L4_DONE' }
        default:
          return { kind: 'text', content: `W_L4_FALLTHROUGH tools=${tools}` }
      }
    }
    return { kind: 'text', content: 'W_NOOP_DONE' }
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

/** The LAST tool result of a request (the most recent tool output). */
function lastToolResult(req) {
  const msgs = messagesOf(req).filter((m) => m.role === 'tool')
  return String(msgs[msgs.length - 1]?.content ?? '')
}

/**
 * Corpus-robust collect-result scan: the FIRST request whose history
 * carries (a) at least one user message of the token's wake-up
 * notification AND (b) a tool message satisfying pred — i.e. the
 * team_collect result observed ON the wake chain (the tool result stays
 * in the session's history, so scanning all requests finds it no matter
 * how the wake chain's steps interleaved with injected notifications).
 */
function findWakeCollectResult(mock, token, pred) {
  for (const r of mock.requests) {
    if (r.body === null) continue
    const msgs = messagesOf(r)
    const onWakeChain = msgs.some(
      (m) => m.role === 'user' && typeof m.content === 'string' && m.content.startsWith(NOTIF_PREFIX) && m.content.includes(token),
    )
    if (!onWakeChain) continue
    const toolMsgs = msgs.filter((m) => m.role === 'tool')
    for (const t of toolMsgs) {
      const content = String(t.content ?? '')
      if (pred(content)) return { seq: r.seq, content }
    }
  }
  return null
}

/** Poll for a wake-chain collect result (it lands on the model request
 * AFTER the collect tool call — the result rides in the next history). */
async function waitForWakeCollect(mock, token, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = findWakeCollectResult(mock, token, pred)
    if (hit !== null) return hit
    if (Date.now() >= deadline) {
      log(`mock wait timed out: ${label} (requests=${mock.requests.length})`)
      return null
    }
    await new Promise((r) => setTimeout(r, 400))
  }
}

// ── durable work facts (read-only TeamDomain ledger scan) ───────────────────

/**
 * The plugin's durable work-unit facts (storages/team_domain.json →
 * tables.ledger): `team-work-admitted` (Phase A) + `member-lifecycle-
 * changed to: SETTLED` (the settlement — the wake-up's terminal
 * authority). Read-only.
 */
function readWorkFacts(root) {
  const out = { admissions: [], settlements: [], error: null }
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
      if (entry.factType === 'team-work-admitted') {
        out.admissions.push({ sequence: Number(k), requestToken: payload.requestToken, targetInstanceId: payload.targetInstanceId ?? payload.instanceId, action: payload.action })
      } else if (entry.factType === 'member-lifecycle-changed' && payload.to === 'SETTLED') {
        out.settlements.push({ sequence: Number(k), requestToken: payload.requestToken, instanceId: payload.instanceId, workOutcome: payload.workOutcome, memberResult: payload.memberResult ?? null })
      }
    }
  } catch (error) {
    out.error = String(error?.message ?? error)
  }
  return out
}

function settleOf(facts, token) {
  return facts.settlements.find((s) => s.requestToken === token) ?? null
}

/**
 * Fail fast on a saved blueprint whose IDENTITY inspection is rejected —
 * the filesystem index silently drops such files from the catalog (a
 * later team.create would fail with "blueprint not found in catalog"
 * after a long, uninformative wait).
 */
function assertBlueprintInspectsOk(name, yaml) {
  const r = inspectBlueprintSource(yaml)
  if (r.status !== 'ok') {
    writeEvidence(`blueprint-inspect-${name}.json`, { name, inspection: r })
    dieFatal(`saved blueprint ${name} failed identity inspection: ${JSON.stringify(r.diagnostics).slice(0, 400)}`)
  }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  log(`work-completion wake-up real-host smoke — stamp ${RUN_STAMP}`)
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
      const missingTeam = TEAM_TOOL_CATALOG.filter((n) => !surface.includes(n))
      check('L0', 'discovery captured the surface; read + bash present; the 12-tool catalog is present on the boot root',
        surface.includes('read') && surface.includes('bash') && missingTeam.length === 0,
        `surface=${surface.length} missingTeam=[${missingTeam.join(',')}]`)
      if (discReq.reply === undefined || discReq.reply.kind !== 'text' || discReq.reply.content !== 'W_DISC_DONE') {
        writeEvidence('l0-diagnostic-mock.json', mock.requests.slice(-4).map((r) => ({ seq: r.seq, reply: r.reply })))
        throw new Error(`L0 diagnostic abort: the DISC request (seq ${discReq.seq}) got reply ${JSON.stringify(discReq.reply).slice(0, 200)}`)
      }
      // The saved blueprints (the deny list needs the live surface:
      // unmanaged non-team names).
      const denyList = surface.filter(
        (n) => !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n) && !TEAM_TOOL_CATALOG.includes(n),
      )
      const bpL1 = savedBlueprintYaml(BP_L1_ID, `You are the leader of the wcn smoke L1 team. ${MK_L1}`, `You are worker-l1 of the wcn smoke L1 team. ${MK_L1MEM}`, denyList)
      const bpL2 = savedBlueprintYaml(BP_L2_ID, `You are the leader of the wcn smoke L2 team. ${MK_L2}`, `You are worker-l2 of the wcn smoke L2 team. ${MK_L2A} ${MK_L2B}`, denyList)
      const bpL3 = savedBlueprintYaml(BP_L3_ID, `You are the leader of the wcn smoke L3 team. ${MK_L3}`, `You are worker-l3 of the wcn smoke L3 team. ${MK_L3MEM}`, denyList)
      const bpL4 = savedBlueprintYaml(BP_L4_ID, `You are the leader of the wcn smoke L4 team. ${MK_L4}`, `You are worker-l4 of the wcn smoke L4 team. ${MK_L4MEM}`, denyList)
      // Fail fast if any saved source's identity inspection is rejected
      // (the filesystem index would silently drop it from the catalog).
      assertBlueprintInspectsOk('wcn-l1', bpL1)
      assertBlueprintInspectsOk('wcn-l2', bpL2)
      assertBlueprintInspectsOk('wcn-l3', bpL3)
      assertBlueprintInspectsOk('wcn-l4', bpL4)
      writeFileSync(join(BLUEPRINT_DIR, 'wcn-l1.yaml'), bpL1)
      writeFileSync(join(BLUEPRINT_DIR, 'wcn-l2.yaml'), bpL2)
      writeFileSync(join(BLUEPRINT_DIR, 'wcn-l3.yaml'), bpL3)
      writeFileSync(join(BLUEPRINT_DIR, 'wcn-l4.yaml'), bpL4)
      log(`saved blueprints L1–L4 written + identity-inspected OK (deny list = ${denyList.length} names)`)
    }

    if (FAILS.includes('L0')) throw new Error('L0 failed — aborting before team.create')

    // ── L1: single async completion wakes the IDLE Leader ─────────────
    log('── L1: single async completion wakes the idle Leader ──')
    const createL1Promise = remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_L1,
      blueprintId: BP_L1_ID,
      initialWork: { prompt: `${MK_L1} admit the L1 async probe work on a fresh worker and stop — the completion will come back to you` },
    }, 'wcnl1')
    // The leader's initial chain: async delegate admitted → W_L1_DONE
    // (the turn ends; the Leader is IDLE — no further user input).
    const l1Done = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_L1) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'W_L1_DONE', 300_000, 'L1 leader chain final')
    check('L1a', 'L1: the Leader admitted the async delegate and its turn ENDED (Leader now idle; no user input after)',
      l1Done !== null, `l1Done=${l1Done === null ? 'null' : l1Done.seq} requests=${mock.requests.length}`)
    if (l1Done === null) fail('L1a')

    // The member work completes → the durable settlement → the observer
    // fires the wake-up: a NEW model request on the LEADER session whose
    // history carries the token-leading notification (idle → followup).
    const l1Wake = await waitForMock(mock, (r) => hasNotifUserMessage(r, TOK_L1), 180_000, 'L1 wake-up model request')
    if (l1Wake === null) {
      fail('L1b')
      check('L1b', 'L1: the idle Leader was AUTOMATICALLY woken (a new model request with the token-leading notification; no user input)', false, `requests=${mock.requests.length}`)
    } else {
      const wakeText = notifUserTextOf(l1Wake, TOK_L1)
      writeEvidence('l1-wake-request.json', { seq: l1Wake.seq, receivedAt: l1Wake.receivedAt, text: wakeText.slice(0, 1500) })
      const l1bOk = wakeText.includes(`requestToken=${TOK_L1}`) && wakeText.includes('team_collect') && wakeText.includes(`requestToken: ${TOK_L1}`)
      check('L1b', 'L1: the idle Leader was automatically woken (token-leading text: the machine token + the team_collect guidance + the token field)',
        l1bOk, `text=${wakeText.slice(0, 300)}`)
      if (!l1bOk) fail('L1b')
      // The wake turn: team_collect([token]) → the durable member result
      // (corpus-robust scan: the result is a tool message in the wake
      // chain's history, wherever the steps interleaved).
      const l1Collect = await waitForWakeCollect(mock, TOK_L1, (c) => c.includes(RESULT_L1), 120_000, 'L1 wake collect result')
      if (l1Collect === null) {
        fail('L1c')
        check('L1c', 'L1: on the wake turn the Leader called team_collect([token]) and got the durable member result', false, `requests=${mock.requests.length}`)
      } else {
        writeEvidence('l1-collect-result.json', { seq: l1Collect.seq, result: l1Collect.content.slice(0, 3000) })
        const l1cOk = l1Collect.content.includes(RESULT_L1) && /"status"\s*:\s*"succeeded"/.test(l1Collect.content)
        check('L1c', 'L1: team_collect served the member DURABLE result (the exact body, status succeeded)',
          l1cOk, `result=${l1Collect.content.slice(0, 400)}`)
        if (!l1cOk) fail('L1c')
        // The wake chain ends (W_WAKE_DONE).
        const l1WakeDone = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(TOK_L1) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'W_WAKE_DONE', 120_000, 'L1 wake chain done')
        check('L1d', 'L1: the wake turn completed (the Leader consumed the notification and finished)', l1WakeDone !== null, `requests=${mock.requests.length}`)
        if (l1WakeDone === null) fail('L1d')
      }
    }
    const createL1 = await createL1Promise
    writeEvidence('l1-team-create.json', createL1.body ?? createL1)
    const createL1Ok = createL1.status === 200
      && createL1.body?.result?.ok === true
      && createL1.body?.result?.value?.data?.path === 'fresh-root'
    check('L1e', 'L1: team.create (L1) succeeded on the fresh root', createL1Ok, `status=${createL1.status} body=${JSON.stringify(createL1.body ?? createL1).slice(0, 300)}`)
    if (!createL1Ok) fail('L1e')
    // Durable: the settlement fact for TOK_L1 (the terminal authority).
    const l1Facts = readWorkFacts(CREATE_ROOT_L1)
    const l1Settle = settleOf(l1Facts, TOK_L1)
    check('L1f', 'L1: the durable settlement fact exists (member-lifecycle-changed to=SETTLED, the terminal authority the observer re-read)',
      l1Settle !== null && l1Settle.workOutcome === 'settled',
      `settlement=${JSON.stringify(l1Settle).slice(0, 300)}`)
    if (l1Settle === null) fail('L1f')

    // ── L2: two async members, staggered completion ────────────────────
    log('── L2: two async members (staggered) ──')
    const l2RequestsBefore = mock.requests.length
    const createL2Promise = remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_L2,
      blueprintId: BP_L2_ID,
      initialWork: { prompt: `${MK_L2} admit BOTH L2 async work units on two fresh workers in this turn and stop — their completions will come back to you` },
    }, 'wcnl2')
    const l2Done = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_L2) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'W_L2_DONE', 300_000, 'L2 leader chain final')
    check('L2a', 'L2: the Leader admitted TWO async delegates in one turn and its turn ended',
      l2Done !== null, `l2Done=${l2Done === null ? 'null' : l2Done.seq}`)
    if (l2Done === null) fail('L2a')

    // First settlement (A — the immediate one) wakes the idle Leader.
    const l2WakeA = await waitForMock(mock, (r) => hasNotifUserMessage(r, TOK_L2A), 180_000, 'L2 wake A')
    check('L2b', 'L2: the FIRST (A) completion woke the Leader (token-leading model request, no user input)',
      l2WakeA !== null, `requests=${mock.requests.length}`)
    if (l2WakeA === null) fail('L2b')

    // Second settlement (B) reaches the Leader too — via inject (the
    // Leader is awake processing A's wake turn; the non-waking next-step
    // send) or a fresh followup (A's wake turn already ended) or MERGED
    // into the same wake request (both notifications queue before the
    // turn starts). NO manual input between: the kit never prompts; both
    // tokens must be collected. (Both collect results are scanned
    // corpus-robustly: the mock collects every uncollected token in a
    // wake request in ONE call, so A and B's results may land in the
    // same request history.)
    const l2WakeB = await waitForMock(mock, (r) => hasNotifUserMessage(r, TOK_L2B), 180_000, 'L2 wake B')
    check('L2c', 'L2: the SECOND (B) completion reached the Leader WITHOUT manual user input (inject, fresh followup, or merged wake request)',
      l2WakeB !== null, `requests=${mock.requests.length}`)
    if (l2WakeB === null) fail('L2c')
    // Poll for the collect tool results (they appear on the NEXT model
    // request after the wake request — the tool call's response).
    let l2CollectA = null
    let l2CollectB = null
    const l2CollectDeadline = Date.now() + 120_000
    for (;;) {
      l2CollectA = findWakeCollectResult(mock, TOK_L2A, (c) => c.includes(RESULT_L2A))
      l2CollectB = findWakeCollectResult(mock, TOK_L2B, (c) => c.includes(RESULT_L2B))
      if (l2CollectA !== null && l2CollectB !== null) break
      if (Date.now() >= l2CollectDeadline) break
      await new Promise((r) => setTimeout(r, 400))
    }
    if (l2CollectA === null || l2CollectB === null) {
      fail('L2d')
      check('L2d', 'L2: BOTH tokens were team_collect-ed with the durable results', false,
        `collectA=${l2CollectA === null ? 'null' : l2CollectA.seq} collectB=${l2CollectB === null ? 'null' : l2CollectB.seq}`)
    } else {
      const resA = l2CollectA.content
      const resB = l2CollectB.content
      writeEvidence('l2-collect-results.json', { a: { seq: l2CollectA.seq, result: resA.slice(0, 2500) }, b: { seq: l2CollectB.seq, result: resB.slice(0, 2500) } })
      const okA = resA.includes(RESULT_L2A) && /"status"\s*:\s*"succeeded"/.test(resA)
      const okB = resB.includes(RESULT_L2B) && /"status"\s*:\s*"succeeded"/.test(resB)
      check('L2d', 'L2: both tokens were team_collect-ed with the durable results (both bodies, both succeeded)', okA && okB,
        `A=${resA.slice(0, 200)} B=${resB.slice(0, 200)}`)
      if (!okA || !okB) fail('L2d')
    }
    const createL2 = await createL2Promise
    writeEvidence('l2-team-create.json', createL2.body ?? createL2)
    const createL2Ok = createL2.status === 200 && createL2.body?.result?.ok === true
    check('L2e', 'L2: team.create (L2) succeeded', createL2Ok, `status=${createL2.status} body=${JSON.stringify(createL2.body ?? createL2).slice(0, 300)}`)
    if (!createL2Ok) fail('L2e')
    // Characterization: the Leader session's model-call count since the
    // scenario started (the plan records, it does not require, a single
    // wake turn).
    const l2LeaderCalls = mock.requests.slice(l2RequestsBefore).filter((r) => {
      const t = lastUserTextOf(r)
      return t.includes(MK_L2) || t.startsWith(NOTIF_PREFIX)
    }).length
    writeEvidence('l2-model-call-count.json', { leaderModelCalls: l2LeaderCalls, note: 'leader session requests since scenario start (initial chain + wake/inject steps); the plan records the count, it does not require a single turn' })
    log(`L2 characterization: leader model-call count = ${l2LeaderCalls}`)
    // Durable: both settlement facts.
    const l2Facts = readWorkFacts(CREATE_ROOT_L2)
    const l2SettleA = settleOf(l2Facts, TOK_L2A)
    const l2SettleB = settleOf(l2Facts, TOK_L2B)
    check('L2f', 'L2: both durable settlement facts exist (the terminal authority for each token)',
      l2SettleA !== null && l2SettleB !== null && l2SettleA.workOutcome === 'settled' && l2SettleB.workOutcome === 'settled',
      `A=${JSON.stringify(l2SettleA).slice(0, 200)} B=${JSON.stringify(l2SettleB).slice(0, 200)}`)
    if (l2SettleA === null || l2SettleB === null) fail('L2f')

    // ── L3: failed member completion wakes (fail-closed terminal) ──────
    log('── L3: failed member completion wakes ──')
    const createL3Promise = remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_L3,
      blueprintId: BP_L3_ID,
      initialWork: { prompt: `${MK_L3} admit the L3 async work on a fresh worker and stop — its completion (whatever it is) will come back to you` },
    }, 'wcnl3')
    const l3Done = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_L3) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'W_L3_DONE', 300_000, 'L3 leader chain final')
    check('L3a', 'L3: the Leader admitted the (failing) async delegate and its turn ended',
      l3Done !== null, `l3Done=${l3Done === null ? 'null' : l3Done.seq}`)
    if (l3Done === null) fail('L3a')

    // The member's work turn FAILS (controlled model error) → the fail-
    // closed settlement is durable → the wake-up still fires.
    const l3Wake = await waitForMock(mock, (r) => hasNotifUserMessage(r, TOK_L3), 240_000, 'L3 wake-up model request')
    if (l3Wake === null) {
      fail('L3b')
      check('L3b', 'L3: a FAILED member completion still wakes the Leader (durable terminal — fail-closed settlement is a terminal fact)', false, `requests=${mock.requests.length}`)
    } else {
      writeEvidence('l3-wake-request.json', { seq: l3Wake.seq, receivedAt: l3Wake.receivedAt, text: notifUserTextOf(l3Wake, TOK_L3).slice(0, 1500) })
      check('L3b', 'L3: a failed member completion still wakes the Leader (the token-leading notification arrived)', true, `wake=${l3Wake.seq}`)
      // The wake turn: team_collect([token]) → the FAIL-CLOSED result.
      // Corpus-robust scan; the pred is token-scoped (the entry for this
      // token carries it) + a terminal non-succeeded status.
      const l3Collect = await waitForWakeCollect(mock, TOK_L3, (c) => c.includes(TOK_L3) && /"status"\s*:\s*"(failed|unavailable)"/.test(c), 120_000, 'L3 wake collect result')
      if (l3Collect === null) {
        fail('L3c')
        check('L3c', 'L3: on the wake turn the Leader called team_collect([token]) and got the fail-closed result', false, `requests=${mock.requests.length}`)
      } else {
        const collectResult = l3Collect.content
        writeEvidence('l3-collect-result.json', { seq: l3Collect.seq, result: collectResult.slice(0, 3000) })
        const failedShape = /"status"\s*:\s*"(failed|unavailable)"/.test(collectResult)
        check('L3c', 'L3: team_collect reported the FAILED/UNAVAILABLE result (no fake success — the fail-closed fact is served)',
          failedShape, `result=${collectResult.slice(0, 400)}`)
        if (!failedShape) fail('L3c')
        const l3WakeDone = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(TOK_L3) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'W_WAKE_DONE', 120_000, 'L3 wake chain done')
        check('L3d', 'L3: the wake turn completed', l3WakeDone !== null, `requests=${mock.requests.length}`)
        if (l3WakeDone === null) fail('L3d')
      }
    }
    const createL3 = await createL3Promise
    writeEvidence('l3-team-create.json', createL3.body ?? createL3)
    const createL3Ok = createL3.status === 200 && createL3.body?.result?.ok === true
    check('L3e', 'L3: team.create (L3) succeeded', createL3Ok, `status=${createL3.status} body=${JSON.stringify(createL3.body ?? createL3).slice(0, 300)}`)
    if (!createL3Ok) fail('L3e')
    // Durable: the settlement fact is TERMINAL and carries the failure
    // (LIVE-FOUND run 2026-09-20: a controlled member MODEL error is
    // normalized by the work delivery into a persisted failed member
    // result — workOutcome "settled" + memberResult.status "failed" —
    // NOT the transport-fault variant "delivery-failed" (that variant,
    // the WORK_DELIVERY_FAILED path, is pinned by unit test R3). Either
    // form is a durable terminal fact the observer may read.)
    const l3Facts = readWorkFacts(CREATE_ROOT_L3)
    const l3Settle = settleOf(l3Facts, TOK_L3)
    const l3fOk = l3Settle !== null
      && (l3Settle.workOutcome === 'delivery-failed'
        || l3Settle.memberResult?.status === 'failed'
        || l3Settle.memberResult?.status === 'unavailable')
    check('L3f', 'L3: the durable terminal settlement fact exists and carries the FAILURE (persisted failed member result, or the fail-closed delivery-failed outcome — both are terminal facts the observer read)',
      l3fOk, `settlement=${JSON.stringify(l3Settle).slice(0, 400)}`)
    if (!l3fOk) fail('L3f')

    // ── L4: sync regression — in-band result, NO notification turn ─────
    log('── L4: sync regression (in-band result, no notification) ──')
    const l4RequestsBefore = mock.requests.length
    const createL4 = await remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_L4,
      blueprintId: BP_L4_ID,
      initialWork: { prompt: `${MK_L4} delegate the L4 work SYNCHRONOUSLY on a fresh worker — the tool result carries the answer` },
    }, 'wcnl4')
    // The sync delegate BLOCKS the Leader turn to the terminal result:
    // the W_L4_DONE request carries the delegate's tool result (the
    // member result, in-band).
    const l4Done = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_L4) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'W_L4_DONE', 300_000, 'L4 leader turn complete')
    if (l4Done === null) {
      fail('L4a')
      check('L4a', 'L4: the sync delegate blocked the Leader turn to the terminal result', false, `requests=${mock.requests.length}`)
    } else {
      const delegateResult = lastToolResult(l4Done)
      writeEvidence('l4-delegate-result.json', { seq: l4Done.seq, result: delegateResult.slice(0, 3000) })
      check('L4a', 'L4: the sync delegate tool result CARRIES the member result in-band (the exact body, status succeeded)',
        delegateResult.includes(RESULT_L4) && /"status"\s*:\s*"succeeded"/.test(delegateResult),
        `result=${delegateResult.slice(0, 400)}`)
      if (!(delegateResult.includes(RESULT_L4) && /"status"\s*:\s*"succeeded"/.test(delegateResult))) fail('L4a')
    }
    check('L4b', 'L4: team.create (L4) succeeded', createL4.status === 200 && createL4.body?.result?.ok === true,
      `status=${createL4.status} body=${JSON.stringify(createL4.body ?? createL4).slice(0, 300)}`)
    if (!(createL4.status === 200 && createL4.body?.result?.ok === true)) fail('L4b')
    // The regression pin: NO completion notification turn for the sync
    // token, anywhere in the whole corpus (the sync path is
    // byte-identical — zero notifications).
    await new Promise((r) => setTimeout(r, 5000)) // settle any (wrong) notification in flight
    const l4Notif = mock.requests.find((r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(TOK_L4))
    check('L4c', 'L4: NO separate completion notification turn exists for the sync token (the tool result IS the completion channel)',
      l4Notif === undefined, `l4Notif=${l4Notif === undefined ? 'absent (correct)' : l4Notif.seq}`)
    if (l4Notif !== undefined) fail('L4c')
    const l4Facts = readWorkFacts(CREATE_ROOT_L4)
    const l4Settle = settleOf(l4Facts, TOK_L4)
    check('L4d', 'L4: the sync settlement fact is durable (unchanged sync path)', l4Settle !== null && l4Settle.workOutcome === 'settled',
      `settlement=${JSON.stringify(l4Settle).slice(0, 300)}`)
    if (l4Settle === null) fail('L4d')
    log(`L4 requests since scenario start: ${mock.requests.length - l4RequestsBefore}`)
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
