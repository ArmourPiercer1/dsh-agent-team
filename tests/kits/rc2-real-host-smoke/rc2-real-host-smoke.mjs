#!/usr/bin/env node
/**
 * rc2-real-host-smoke.mjs — the 0.1.5-rc.2 real-host smoke (S1–S5) for the
 * rc2-repair round (plan §17, docs/plans/active/dsh-agent-team-rc2-repair-plan.md).
 *
 * WHAT THIS PROVES (one world, one host instance, sequential legs):
 *   S1 — a Leader whose bound blueprint declares `allow read subtree team`
 *        EXECUTES the read WITHOUT any control request (static allow on the
 *        canonicalized subtree) — plan §17 S1; A1 allow path.
 *   S2 — the same Leader, `read runtime/...` under `deny read subtree
 *        runtime`, is rejected as an EXPLICIT STATIC DENY (provenance
 *        rule/deny — NOT a canonicalization failure) — plan §17 S2; A1 deny
 *        path.
 *   S3 — the same Leader, `bash echo rc2-smoke` under `ask bash any`,
 *        creates a durable control request, the scripted approval (human
 *        principal — the leader's own asks are kind USER_APPROVAL, resolvers
 *        = human only) resolves allow, and the command EXECUTES on the
 *        last-mile guard (no target-stale) — plan §17 S3; A6 proof.
 *   S4 — a second team on the SAME plugin row: the row's anchor is blueprint
 *        A (no worker-b template), the team is BOUND to blueprint B (worker-b
 *        exists only in B). team.create succeeds, the Leader's persona is
 *        B's, and the first team_create_member(worker-b) + team_delegate
 *        SUCCEED (pre-A2-fix: the binder persona resolved from the row
 *        anchor → the post-commit member create was rejected) — plan §17
 *        S4; A2 proof.
 *   S5 — a THIRD team on the same row, bound to blueprint C (same templateId
 *        `worker-b`, DIFFERENT persona): the C member gets C's persona while
 *        the B member keeps B's — root-scoped blueprint resolution, no
 *        row-global leak — plan §17 S5; A2 multi-team proof.
 *
 * DESIGN (frozen in dev/agent-workflow/briefs/rc2-repair/smoke-kit-design.md;
 * pattern source: dev/agent-workflow/evidence/fix-alpha2-explicit-agent-setup-
 * compat/a2x-real-host-smoke.mjs). Refinements settled at implementation:
 *   R1 — S1–S4 run as ONE continuous Leader turn on the created B team: the
 *        team.create's initialWork (marker MK_B) drives a scripted mock chain
 *        (read team → read runtime → bash → create_member → delegate → final
 *        text). The bash step pauses the turn at the durable control wait;
 *        the kit approves from the outside; the turn resumes. Driving all
 *        permission legs from the same turn maximizes the causal chain and
 *        avoids any dependence on session/prompt to a created team root.
 *   R2 — the S3 approval principal is the boot root (the host-known operator
 *        = human): the leader's own ask is kind USER_APPROVAL (isLeader ?
 *        USER_APPROVAL : LEADER_APPROVAL — pre-execute-adapter), whose
 *        resolvers are human only; the leader principal would be rejected
 *        (CONTROL_RESOLVER_NOT_AUTHORIZED).
 *   R3 — the pending requestId is discovered through the p6t6 observation
 *        feed first, then a read-only DSH_HOME storage scan (the p6t6
 *        `/__p6t6/state` control block is bound to the DIRECTIVE root only —
 *        the created team's control state is not exposed there). If neither
 *        source yields it, S3 fails with a full diagnostic dump (an
 *        infrastructure gap to report, not a silent pass).
 *   R4 — A1 probe reuse: this same kit is the A1 live-repro harness
 *        (plan §10). Run it against the INSTRUMENTED dist (plan §9 probe
 *        commit) to capture the canonicalization/contains observations;
 *        the A1 branch decision (A/B/C) comes from those observations + the
 *        S1/S2 verdicts. Run it again post-fix to close the RED→GREEN arc.
 *
 * WORLD:
 *   - host = the pristine test-use checkout (DSH 0.1.5-rc.2 @
 *     fb2c4b9e69) launched as `node <testuse>/apps/cli/lib/bin.js web` with
 *     cwd = a scratch session workspace (`<home>/workspace`) — probe files
 *     live there and NEVER enter the frozen checkout.
 *   - env: DSH_HOME=<world home>, DSH_CLIENT_COMMIT_HASH=fb2c4b9e69,
 *     DEEPSEEK_BASE_URL=http://127.0.0.1:<mock-port> (the in-process mock
 *     model — packages/tools/harness/mock-deepseek.mjs).
 *   - plugin rows mounted ONLY through the public profile-patch seam:
 *     production row = <worktree>/packages/runtime/dist/.../host.js,
 *     observability row = packages/tools/harness/plugin.mjs (p6t6).
 *   - one row, one boot team (blueprint A anchor, legacy no-capabilities
 *     Leader — the 0.1.0-rc.1 byte shape), two created teams (B, C).
 *   - preset `rc2-smoke` (user-preset seam, DSH_HOME/.agent-presets):
 *     persona + dsh-tool-fs + the minimal-style persistent shell group
 *     (bash stack; NO delegation group — the 0.1.5 deferred own-layer
 *     `subagent` is structurally un-denyable under the Coverage Gate;
 *     followup-backlog item 2).
 *   - LEG 0 discovery: one scripted turn on the boot Leader captures the
 *     model-facing tool surface (the mock request's `tools` array); the
 *     saved blueprints' `builtinToolDeny` is computed as
 *     surface − MANAGED_TOOL_NAMES − {todo_write} − the 11 team tools, so
 *     the strict Coverage Gate sees a fully covered surface.
 *
 * USAGE:
 *   node tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs \
 *     [--worktree <path>] [--testuse <path>] [--host-port N] \
 *     [--mock-port N] [--evidence-dir <path>] [--keep]
 *   defaults: --worktree = the repo root containing this kit (4 levels up),
 *   --testuse = <worktree>/tests/deepseek-harness-test-use, host port =
 *   first free of 3491–3500, mock port = 3496, evidence dir =
 *   dev/agent-workflow/evidence/rc2-repair/smoke/rc2-smoke-<stamp>/.
 *
 * EXIT: 0 = all criteria pass; 2 = a S-leg criterion failed (with the full
 * evidence dump); 1 = fatal (environment/boot/row).
 *
 * ZERO-TOUCH: the live instances :3080 and :3180 are probed read-only
 * (status recorded pre/post) and never written to.
 */

import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
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
const TESTUSE = resolve(argValue('testuse', join(WORKTREE, 'tests', 'deepseek-harness-test-use')))
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

const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
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
]
// The B/C Leader teamTools allow list (the smoke needs create + delegate;
// the list is a closed subset of the 11).
const LEADER_TEAM_TOOLS_ALLOW = [
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_create_member',
  'team_delegate',
  'team_collect',
]

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').replace('T', 'T').slice(0, 19)
const RUN_DIR = EVIDENCE_DIR_ARG
  ? resolve(EVIDENCE_DIR_ARG)
  : join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'rc2-repair', 'smoke', `rc2-smoke-${RUN_STAMP}`)
const HOME = join(WORKTREE, 'tests', 'homes', `rc2-smoke-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const BLUEPRINT_DIR = join(WORKTREE, `.rc2-smoke-blueprints-${RUN_STAMP}`)

const ROOT = `session-rc2-smoke-root-${RUN_STAMP}`
const CREATE_ROOT_B = `session-rc2-smoke-b-${RUN_STAMP}`
const CREATE_ROOT_C = `session-rc2-smoke-c-${RUN_STAMP}`
const SMOKE_PRESET_ID = 'rc2-smoke'
const BP_ANCHOR_ID = 'team.rc2-anchor-a'
const BP_B_ID = 'team.rc2-b'
const BP_C_ID = 'team.rc2-c'

// Persona tokens (substring-asserted in the mock request system prompts).
const P_LEADER_A = `RC2SMK_A_LEADER_${RUN_STAMP}`
const P_LEADER_B = `RC2SMK_B_LEADER_${RUN_STAMP}`
const P_LEADER_C = `RC2SMK_C_LEADER_${RUN_STAMP}`
const P_WORKER_A = `RC2SMK_A_WORKER_${RUN_STAMP}`
const P_WORKER_B = `RC2SMK_B_WORKER_${RUN_STAMP}`
const P_WORKER_C = `RC2SMK_C_WORKER_${RUN_STAMP}`

// Distinct markers (no substring collisions).
const MK_DISC = `RC2MK_DISC_${RUN_STAMP}`
const MK_B = `RC2MK_B_${RUN_STAMP}`
const MK_BMEM = `RC2MK_BMEM_${RUN_STAMP}`
const MK_C = `RC2MK_C_${RUN_STAMP}`
const MK_CMEM = `RC2MK_CMEM_${RUN_STAMP}`

const PROBE_TEAM_FILE = join(WORKSPACE, 'team', 'test.md')
const PROBE_TEAM_CONTENT = `rc2-smoke-team-probe-${RUN_STAMP}`

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

// ── small http helpers (a2x kit shape) ──────────────────────────────────────

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

/**
 * One browser-facing public Remote call: POST /team-remote/<method>.
 * `version` is the remote contract version: 1 for the v1-era methods
 * (team.create — proven in this round), 4 for the v4-only methods
 * (team.resolveControl — a v1 request is typed-rejected
 * `method-version-unsupported` before dispatch, catalog
 * isRemoteMethodAvailableInVersion).
 */
async function remoteCall(origin, cookie, method, params, tag = 'rc2', version = 1) {
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
async function apiPrompt(origin, cookie, sessionId, text, tag = 'rc2') {
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

async function p6t6Tool(port, name, argsBody, as, tag = 'rc2') {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args: argsBody, as, callId: `${tag}-${Math.random().toString(36).slice(2, 12)}` }),
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
    // An empty file splits to [''] — a phantom line that would advance
    // `seen` past index 0 and permanently skip the log's FIRST physical
    // line (latent: the boot marker is usually line 2; a single-line
    // boot log would be missed). Keep `seen` stable until content exists.
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
  for (const p of [3491, 3492, 3493, 3494, 3495, 3497, 3498, 3499, 3500]) {
    if (await portFree(p)) return p
  }
  dieFatal('no free host port in 3491-3500')
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
    // Contract (host.ts: blueprintSource must be a non-empty string — the
    // inline YAML source). It is the ROW ANCHOR (blueprint A) and, on the
    // production path with the resolver injected, the no-resolver fallback
    // only — the bound team resolves through the saved-source catalog.
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: BLUEPRINT_DIR,
    rootPresetId: SMOKE_PRESET_ID,
    memberPresetId: SMOKE_PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'rc2-smoke-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    // The production row's LIVE GLUE: the dist agent-bindings.mjs (the
    // a2x contract — the glueUrl IS the glue; seamUrl is the separate
    // root-binding harness seam).
    glueUrl: GLUE_URL,
    seamUrl: SEAM_URL,
  }
}

/**
 * The row anchor blueprint A: a plain LEGACY leader (NO capabilities — the
 * byte-for-byte 0.1.0-rc.1 boot shape; worker-a exists only here). The A2
 * test hinges on worker-b being ABSENT from A.
 */
const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 1',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  `  persona: "You are the leader of the rc2 smoke boot team. ${P_LEADER_A}"`,
  'members:',
  '  - templateId: worker-a',
  `    persona: "You are a worker of the rc2 smoke boot team. ${P_WORKER_A}"`,
  'memberEnvelopes: []',
  'requirements: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

/**
 * One saved-source strict blueprint (B or C). The Leader declares the full
 * alpha.1 capability set + alpha.2 permissions (the shape that triggers the
 * strict Coverage Gate): allow read subtree team / deny read subtree runtime
 * / ask bash any / default ask. `builtinToolDeny` (CAPABILITIES-level,
 * discovery-computed) covers the unmanaged surface. worker-b exists ONLY in
 * B and C (persona differs per blueprint — the A2 T3/S5 axis).
 *
 * Mutation envelopes (LIVE-FOUND this round, run 11-02-31): without a
 * teamEnvelope the LEADER cannot perform the `request-control` mutation —
 * the permission ask's control-request creation fails closed with
 * "operation 'request-control' ... is outside the caller's mutation
 * envelope" (the admission envelope check over ALL_MUTATION_OPS). The S3
 * bash-ask leg REQUIRES the leader to hold request-control; assign-task /
 * create-member cover the S4 delegate/create legs; resolve-control covers
 * leader-approval member asks. The worker keeps the standard member set.
 */
function savedBlueprintYaml(bpId, leaderPersona, workerPersona, denyList) {
  const denyLines = denyList.length === 0
    ? ['    builtinToolDeny: []']
    : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(leaderPersona)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    ...LEADER_TEAM_TOOLS_ALLOW.map((t) => `        - ${t}`),
    ...denyLines,
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
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '    - request-control',
    '    - resolve-control',
    '  deny: []',
    'members:',
    '  - templateId: worker-b',
    `    persona: ${JSON.stringify(workerPersona)}`,
    'memberEnvelopes:',
    '  - templateId: worker-b',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '      deny: []',
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
    `# ${SMOKE_PRESET_ID} — rc2 real-host smoke preset (run ${RUN_STAMP}). Kit-authored`,
    '# via the public user-preset seam (DSH_HOME/.agent-presets). persona +',
    '# dsh-tool-fs + the minimal-style persistent shell group (bash stack).',
    '# NO delegation group: the 0.1.5 spawn `subagent` row is a deferred',
    '# per-agent own-layer install — un-restrictable and KNOWN_SENSITIVE',
    '# under the Coverage Gate (followup-backlog item 2).',
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
    `# rc2 real-host smoke patch layer (run ${RUN_STAMP}): production dsh-agent-team row (worktree dist) + p6t6 observability row — mounted ONLY through the public profile-patch seam.`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    '',
  ]
  writeFileSync(join(home, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
}

// ── the real-host boot (test-use bin; the DshInstance pattern) ─────────────

function spawnHost({ port, home, logPath, mockPort }) {
  const outFd = openSync(logPath, 'a')
  const errFd = openSync(logPath, 'a')
  let child
  try {
    child = spawn(
      process.execPath,
      [HOST_BIN, 'web', '--port', String(port), '--no-open'],
      {
        // The session workspace IS the host cwd: probe files live in the
        // scratch workspace, the frozen checkout is never touched.
        cwd: WORKSPACE,
        stdio: ['ignore', outFd, errFd],
        env: {
          ...process.env,
          DSH_HOME: home,
          DSH_CLIENT_COMMIT_HASH: 'fb2c4b9e69',
          DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
          DEEPSEEK_API_KEY: 'rc2-smoke-mock-key',
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
  writeFileSync(join(BLUEPRINT_DIR, 'rc2-anchor-a.yaml'), BP_ANCHOR_YAML)
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
  // Row health gate (a latched setupError must fail fast).
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
  // Row state well-formed for the boot root.
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

// ── mock decide policy (R1: one continuous B chain, C chain, DISC, members) ─

function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-rc2-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}

/**
 * The request body, shape-tolerant: the kit's mock RECORD carries the
 * parsed body under `.body`; the mock harness's decide callback receives
 * the parsed body ITSELF (decide({seq, req: parsed}) — req = the body).
 */
function bodyOf(recordOrBody) {
  if (recordOrBody === null || typeof recordOrBody !== 'object') return null
  return 'body' in recordOrBody ? (recordOrBody.body ?? null) : recordOrBody
}

function userTextOf(req) {
  const messages = bodyOf(req)?.messages ?? []
  return messages
    .filter((m) => m.role === 'user')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
    .join('\n')
}

function toolMsgsOf(req) {
  return (bodyOf(req)?.messages ?? []).filter((m) => m.role === 'tool')
}

/**
 * The instance id from a team_create_member / team_delegate tool result.
 * The `executed` result carries `targetInstanceId` (tools.ts
 * toExecutedResult) — the field name FIRST; the bare `instanceId` and the
 * inst- pattern are forensic fallbacks.
 */
function extractInstanceId(content) {
  const m =
    /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(String(content)) ??
    /"instanceId"\s*:\s*"([^"]+)"/.exec(String(content)) ??
    /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(String(content))
  return m === null ? null : m[1]
}

function makeDecide() {
  return function decide({ req }) {
    // Title-generation side calls (DSH derives the session title from the
    // queued human messages — they CARRY the markers, nested, so they must
    // never drive the scripted chain): a neutral text reply, no chain.
    const firstMsg = (bodyOf(req)?.messages ?? [])[0]
    if (typeof firstMsg?.content === 'string' && firstMsg.content.startsWith('Create a concise title')) {
      return { kind: 'text', content: 'RC2 smoke session' }
    }
    const text = userTextOf(req)
    const tools = toolMsgsOf(req).length
    // Member turns (separate sessions, their own marker).
    if (text.includes(MK_BMEM)) return { kind: 'text', content: 'RC2_MEMBER_B_DONE' }
    if (text.includes(MK_CMEM)) return { kind: 'text', content: 'RC2_MEMBER_C_DONE' }
    // LEG 0 discovery on the boot Leader.
    if (text.includes(MK_DISC)) return { kind: 'text', content: 'RC2_DISC_DONE' }
    // The B chain: S1 read team → S2 read runtime → S3 bash (control wait)
    // → S4 create_member(worker-b) → delegate → final.
    // Team-tool args (LIVE-FOUND run 11-02-31): EVERY team tool requires
    // rootSessionId + a fresh per-operation requestToken (the tools.ts
    // makeDefinition gate; the skill's request-token discipline — a fresh
    // token per logical operation), and create/delegate take
    // delegationTemplateId / delegationInstanceId + label.
    if (text.includes(MK_B)) {
      switch (tools) {
        case 0: return toolCall('read', { file_path: 'team/test.md' })
        case 1: return toolCall('read', { file_path: 'runtime/forbidden.txt' })
        case 2: return toolCall('bash', { command: 'echo rc2-smoke' })
        case 3: return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT_B,
          requestToken: `rc2-b-create-${RUN_STAMP}`,
          delegationTemplateId: 'worker-b',
          label: 'worker-b-1',
        })
        case 4: {
          const id = extractInstanceId(toolMsgsOf(req)[3]?.content)
          if (id === null) return { kind: 'text', content: `RC2_B_EXTRACT_FAIL :: ${String(toolMsgsOf(req)[3]?.content).slice(0, 300)}` }
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT_B,
            requestToken: `rc2-b-delegate-${RUN_STAMP}`,
            delegationInstanceId: id,
            label: 'worker-b-1',
            prompt: MK_BMEM,
          })
        }
        case 5: return { kind: 'text', content: 'RC2_SMOKE_B_DONE' }
        default: return { kind: 'text', content: `RC2_B_FALLTHROUGH tools=${tools}` }
      }
    }
    // The C chain: create_member(worker-b) → delegate → final.
    if (text.includes(MK_C)) {
      switch (tools) {
        case 0: return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT_C,
          requestToken: `rc2-c-create-${RUN_STAMP}`,
          delegationTemplateId: 'worker-b',
          label: 'worker-b-1',
        })
        case 1: {
          const id = extractInstanceId(toolMsgsOf(req)[0]?.content)
          if (id === null) return { kind: 'text', content: `RC2_C_EXTRACT_FAIL :: ${String(toolMsgsOf(req)[0]?.content).slice(0, 300)}` }
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT_C,
            requestToken: `rc2-c-delegate-${RUN_STAMP}`,
            delegationInstanceId: id,
            label: 'worker-b-1',
            prompt: MK_CMEM,
          })
        }
        case 2: return { kind: 'text', content: 'RC2_SMOKE_C_DONE' }
        default: return { kind: 'text', content: `RC2_C_FALLTHROUGH tools=${tools}` }
      }
    }
    return { kind: 'text', content: 'RC2_NOOP_DONE' }
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

// ── S3 requestId discovery (R3) ─────────────────────────────────────────────

/**
 * The B-root control rows from the plugin's durable ledger
 * (storages/team_domain.json → tables.ledger): the control service
 * persists requests/decisions/consumptions as ledger entries with
 * factType `control-request-recorded` / `control-decision-recorded` /
 * `control-consumption-recorded` (control/service.ts), each entry a
 * JSON string {factType, rootSessionId, payload, ...}. Read-only.
 */
function readControlLedger(root) {
  const out = { entries: [], error: null }
  try {
    const parsed = JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
    const ledger = parsed?.tables?.ledger
    if (ledger === null || typeof ledger !== 'object') { out.error = 'no ledger table'; return out }
    for (const [k, v] of Object.entries(ledger)) {
      if (k === '__ledger_sequence_counter' || typeof v !== 'string') continue
      try {
        const entry = JSON.parse(v)
        if (entry?.factType === 'control-request-recorded' && String(entry.rootSessionId) === root) {
          out.entries.push({ sequence: k, entry })
        }
      } catch { /* not a JSON entry — skip */ }
    }
  } catch (error) {
    out.error = String(error?.message ?? error)
  }
  return out
}

/**
 * Discover the pending bash-ask control requestId for the created B team.
 * Source 1: the p6t6 observation feed (global across roots). Source 2: the
 * plugin's durable control ledger (team_domain.json). POLLING: the request
 * is created milliseconds AFTER the mock's bash tool-call reply is served
 * (the host executes the tool after answering the mock) — a single read
 * races it (LIVE-FOUND run 11-02-31: S3a candidates=[] ~5 ms after the
 * bash reply). Both dumps are written to the evidence dir for the
 * forensic record.
 */
async function discoverPendingRequestId(port, root, tag) {
  const found = { source: null, requestId: null, row: null, candidates: [] }
  // Source 1: observations. The permission listener emits
  // `alpha2-perm: {"stage":"request-created","callId":...,"requestId":...,"kind":...,"correlation":...}`
  // into the same feed (pre-execute-adapter observe → onObserve) — the
  // authoritative requestId source for the created team's ask.
  const deadline = Date.now() + 20_000
  let st = null
  let ledger = null
  for (;;) {
    st = await p6t6State(port)
    const obs = Array.isArray(st.body?.observations) ? st.body.observations : []
    const obsText = obs.map((o) => (typeof o === 'string' ? o : JSON.stringify(o)))
    for (const line of obsText) {
      if (!/request-created|requestId/.test(line)) continue
      const m = /"requestId"\s*:\s*"([^"]+)"/.exec(line)
      if (m !== null) found.candidates.push({ source: 'observations/request-created', line: line.slice(0, 400), requestId: m[1] })
    }
    // A direct structured observation (object rows) carrying the request.
    for (const o of obs) {
      if (o !== null && typeof o === 'object' && JSON.stringify(o).includes('bash')) {
        const s = JSON.stringify(o)
        const m = /"requestId"\s*:\s*"([^"]+)"/.exec(s)
        if (m !== null) found.candidates.push({ source: 'observations-structured', requestId: m[1], row: o })
      }
    }
    // Source 2: the durable control ledger (fresh read each poll).
    ledger = readControlLedger(root)
    for (const { entry } of ledger.entries) {
      found.candidates.push({
        source: 'storage:team_domain.json/ledger',
        requestId: String(entry.payload?.requestId ?? ''),
        row: { factType: entry.factType, rootSessionId: entry.rootSessionId, kind: entry.payload?.kind, toolName: entry.payload?.toolName, createdAt: entry.createdAt },
      })
    }
    if (found.candidates.length > 0) break
    if (Date.now() >= deadline) break
    await new Promise((r) => setTimeout(r, 500))
  }
  writeEvidence(`${tag}-state-pending.json`, st?.body)
  if (ledger !== null) writeEvidence(`${tag}-ledger-control.json`, ledger)
  // Source 3 (forensic): read-only home storage scan (JSON files only).
  const walk = (dir, depth) => {
    if (depth > 8) return
    let entries = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch { return }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name.startsWith('.git')) continue
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        walk(p, depth + 1)
      } else if (e.isFile() && (e.name.endsWith('.json') || e.name.endsWith('.jsonl'))) {
        let text = ''
        try {
          text = readFileSync(p, 'utf8')
        } catch { continue }
        if (!text.includes('bash')) continue
        if (!text.includes('requestId') && !text.includes('"request"')) continue
        try {
          const parsed = JSON.parse(text)
          const hits = collectRequests(parsed, root)
          if (hits.length > 0) found.candidates.push({ source: `storage:${p}`, file: p, hits })
        } catch {
          // JSONL or partial: line-by-line.
          for (const line of text.split('\n')) {
            if (line === '') continue
            try {
              const hits = collectRequests(JSON.parse(line), root)
              if (hits.length > 0) found.candidates.push({ source: `storage-jsonl:${p}`, line: line.slice(0, 300), hits })
            } catch { /* not a JSON line */ }
          }
        }
      }
    }
  }
  walk(HOME, 0)
  writeEvidence(`${tag}-requestid-candidates.json`, found.candidates)
  if (found.candidates.length > 0) {
    found.source = found.candidates[0].source
    found.requestId = found.candidates[0].requestId ?? found.candidates[0].hits?.[0]?.requestId ?? null
  }
  return found
}

/** Collect pending control request ids for `root` from a parsed JSON node. */
function collectRequests(node, root, out = []) {
  if (node === null || typeof node !== "object") return out
  if (Array.isArray(node)) {
    for (const item of node) collectRequests(item, root, out)
    return out
  }
  // A control request row: has a requestId and is the bash ask (or a
  // request-shaped durable row). Accept both the flat shape and the
  // wrapped {payload:{…}} durable shape.
  const flat = node.payload !== null && typeof node.payload === "object" ? { ...node.payload, ...node } : node
  const looksLikeRequest = (
    typeof flat.requestId === "string"
    && (flat.toolName === "bash" || flat.actionName === "bash" || flat.kind === "user-approval" || flat.kind === "leader-approval")
    && (flat.status === undefined || flat.status === "pending")
  )
  if (looksLikeRequest) {
    const rowRoot = flat.rootSessionId ?? flat.payload?.rootSessionId
    if (rowRoot === undefined || rowRoot === root) {
      if (!out.some((o) => o.requestId === flat.requestId)) {
        out.push({ requestId: flat.requestId, status: flat.status ?? "unknown", toolName: flat.toolName ?? flat.actionName, source: "node" })
      }
    }
  }
  for (const v of Object.values(node)) {
    if (v !== null && typeof v === "object") collectRequests(v, root, out)
  }
  return out
}

/** The scripted approval (R2: the boot root is the host-known operator = human). */
/**
 * S3a — the human approval. LIVE-FOUND (run 11-02-31): the bash ask is
 * the LEADER's own ask → kind `user-approval` → resolvable by the HUMAN
 * ONLY (the skill: "Resolving a user-approval request as the Leader" is a
 * listed common mistake). The production human command is the remote
 * `team.resolveControl` (contract v4 — the v4-only method; the host's
 * T12-B4 principal seam stamps the human operator of the addressed root,
 * the wire carries no caller fields). A p6t6 executeTool as the boot
 * leader would resolve as an INSTANCE caller and be role-rejected.
 */
async function scriptedApproval(origin, cookie, requestId) {
  const res = await remoteCall(origin, cookie, 'team.resolveControl', {
    teamSessionId: CREATE_ROOT_B,
    requestId,
    decision: 'allow',
    note: 'rc2 smoke S3 scripted human resolution (plan §17; GUI approve stand-in)',
  }, 'rc2s3', 4)
  writeEvidence('s3-approval-response.json', res.body ?? res)
  return res
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  log(`rc2 real-host smoke — stamp ${RUN_STAMP}`)
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
  mkdirSync(dirname(PROBE_TEAM_FILE), { recursive: true })
  writeFileSync(PROBE_TEAM_FILE, `${PROBE_TEAM_CONTENT}\n`)
  // The deny subtree probe file (must NOT be readable; its existence is
  // irrelevant — the rule is static before canonicalization reaches it, but
  // a missing file would make a naive canonicalizer fail-closed deny with a
  // DIFFERENT reason; we keep it present so the ONLY legal outcome is the
  // static subtree deny).
  const PROBE_RUNTIME_FILE = join(WORKSPACE, 'runtime', 'forbidden.txt')
  mkdirSync(dirname(PROBE_RUNTIME_FILE), { recursive: true })
  writeFileSync(PROBE_RUNTIME_FILE, 'rc2-smoke-runtime-probe\n')
  writeSmokePreset(HOME)
  log('world materialized (probe files in scratch workspace)')

  // Mock model.
  const mockLog = join(RUN_DIR, 'mock.log')
  // DIAG (temporary): per-request decide input — the exact body keys +
  // the userTextOf view — so a NOOP-vs-match discrepancy is provable
  // from mock.log alone.
  const diag = (line) => {
    try {
      writeFileSync(mockLog, line + '\n', { flag: 'a' })
    } catch { /* best-effort */ }
  }
  const innerDecide = makeDecide()
  const decideDiag = ({ seq, req }) => {
    const ut = userTextOf(req)
    const keys = req !== null && typeof req === 'object' ? Object.keys(req) : [String(req)]
    // The closure-constant hit bits: if the kit's predicate matches a
    // marker but these bits are all false for the same request, the
    // decide closure captured different constants than the prompt side.
    const bits = ` seesDISC=${ut.includes(MK_DISC)} seesB=${ut.includes(MK_B)} seesCMEM=${ut.includes(MK_CMEM)}`
    diag(`diag: seq=${seq} bodyKeys=${JSON.stringify(keys)} userTextLen=${ut.length} head=${JSON.stringify(ut.slice(0, 120))}${bits}`)
    return innerDecide({ seq, req })
  }
  const dumpMock = (tag) => {
    try {
      const rows = mock.requests.map((r) => ({
        seq: r.seq,
        status: r.status ?? null,
        replyKind: r.reply !== undefined ? r.reply.kind : null,
        replyHead: r.reply !== undefined && typeof r.reply.content === 'string' ? r.reply.content.slice(0, 60) : null,
        userTextHead: r.body !== null ? userTextOf(r).slice(0, 120) : null,
        nToolMsgs: r.body !== null ? toolMsgsOf(r).length : null,
      }))
      writeFileSync(join(RUN_DIR, `mock-dump-${tag}.json`), JSON.stringify(rows, null, 2))
      // Raw body of the first four requests (shape evidence).
      mock.requests.slice(0, 4).forEach((r) => {
        if (r.body !== null) {
          writeFileSync(join(RUN_DIR, `raw-req-${r.seq}.json`), JSON.stringify(r.body, null, 2))
        }
      })
    } catch (e) { diag(`dumpMock(${tag}) failed: ${String(e)}`) }
  }
  const mock = await startMockModel({
    port: MOCK_PORT,
    decide: decideDiag,
    log: (l) => {
      try {
        writeFileSync(mockLog, l + '\n', { flag: 'a' })
      } catch { /* best-effort */ }
    },
  })
  log(`mock model listening on ${mock.port}`)

  const instanceLog = join(RUN_DIR, 'instance.log')
  writeFileSync(instanceLog, '', { flag: 'w' })
  const booted = await bootHost({ port: hostPort, home: HOME, mockPort: mock.port, instanceLog })
  let host = booted.host

  const FAILS = []
  const fail = (id) => FAILS.push(id)

  try {
    // ── LEG 0: discovery (the boot Leader's model-facing tool surface) ──
    log('── LEG 0: discovery ──')
    const discPrompt = await apiPrompt(booted.origin, booted.cookie, ROOT, MK_DISC)
    if (discPrompt.status !== 200) fail('L0')
    const discReq = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_DISC) && (r.body?.tools ?? []).length > 0, 120_000, 'DISC model request')
    if (discReq === null) {
      fail('L0')
      check('L0', 'discovery model request observed', false, `apiPrompt=${JSON.stringify(discPrompt.body).slice(0, 300)}`)
    } else {
      const surface = (discReq.body.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t)).sort()
      writeEvidence('leg0-surface.json', { surface, discRequest: { seq: discReq.seq, tools: surface } })
      log(`discovery surface (${surface.length} tools): ${surface.join(', ')}`)
      const denyList = surface.filter(
        (n) => !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n) && !TEAM_TOOL_CATALOG.includes(n),
      )
      const missingManaged = MANAGED_TOOL_NAMES.filter((n) => !surface.includes(n))
      // LIVE-FOUND (run 11-02-31): the minimal-style preset surface carries
      // 5 of the 7 managed tools (no lsp / no pwsh — the preset group set
      // only mounts the read/write/edit/read_image/bash stack). The smoke
      // legs only need read + bash; the missing managed names stay
      // informational in the evidence (leg0-denylist.json).
      check('L0', 'discovery captured the surface; read + bash present (minimal-style preset: 5/7 managed is the expected shape)',
        surface.includes('read') && surface.includes('bash'),
        `surface=${surface.length} missingManaged=[${missingManaged.join(',')}] denyList=[${denyList.join(',')}]`)
      writeEvidence('leg0-denylist.json', { denyList, missingManaged })
      // The saved blueprints (written after discovery — the deny list needs
      // the live surface; the row's blueprintDir was declared at boot).
      writeFileSync(join(BLUEPRINT_DIR, 'rc2-b.yaml'), savedBlueprintYaml(BP_B_ID, `You are the leader of the rc2 smoke B team. ${P_LEADER_B}`, `You are worker-b of the rc2 smoke B team. ${P_WORKER_B}`, denyList))
      writeFileSync(join(BLUEPRINT_DIR, 'rc2-c.yaml'), savedBlueprintYaml(BP_C_ID, `You are the leader of the rc2 smoke C team. ${P_LEADER_C}`, `You are worker-b of the rc2 smoke C team. ${P_WORKER_C}`, denyList))
      log(`saved blueprints B + C written (deny list = ${denyList.length} names)`)
      // DIAG early-exit: the mock MUST have matched the marker here —
      // otherwise every scripted downstream leg stalls (a NOOP reply ends
      // the turn; the tool-call chain never starts). Abort with the full
      // mock evidence instead of a 15-minute timeout cascade.
      if (discReq.reply === undefined || discReq.reply.kind !== 'text' || discReq.reply.content !== 'RC2_DISC_DONE') {
        dumpMock('disc-noop')
        throw new Error(
          `LEG 0 diagnostic abort: the DISC request (seq ${discReq.seq}) got reply ${JSON.stringify(discReq.reply).slice(0, 200)} — the mock did NOT match the marker it was served (see mock.log diag lines + raw-req-*.json + mock-dump-disc-noop.json)`,
        )
      }
    }

    if (FAILS.includes('L0')) {
      throw new Error('LEG 0 failed — aborting before team.create')
    }

    // ── S1–S4: create the B team; one continuous Leader turn ────────────
    log('── S1–S4: team B (bound blueprint) ──')
    // LIVE-FOUND (run 11-16-34): team.create WITH initialWork holds the
    // HTTP response until the initial-work leader turn goes IDLE
    // (the glue's deliverRootInput: followup + whenIdle + materialize) —
    // and the B turn includes the S3 bash ask, which blocks until the
    // HUMAN approval this kit issues. A sequential await here deadlocks
    // the approval for the full fetch timeout (the team creates fine;
    // only the response lags the turn). Issue the create as a PENDING
    // call; the S3 approval runs in-flight; the S4a check reads the
    // response after the turn settles (the bDone step below).
    const createBPending = remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_B,
      blueprintId: BP_B_ID,
      initialWork: { prompt: MK_B },
    }, 'rc2b')
    let createBError = null
    createBPending.catch((e) => { createBError = e }) // no unhandled rejection while in flight
    const finishCreateB = async () => {
      const createB = createBError === null
        ? await createBPending
        : { status: 0, body: null, error: String(createBError?.message ?? createBError) }
      writeEvidence('s4-team-create-b.json', createB.body ?? createB)
      const createBOk = createB.status === 200
        && createB.body?.result?.ok === true
        && createB.body?.result?.value?.data?.path === 'fresh-root'
      check('S4a', 'team.create (B, bound blueprint) succeeds on the fresh root', createBOk,
        `status=${createB.status} body=${JSON.stringify(createB.body ?? createB).slice(0, 400)}`)
      if (!createBOk) fail('S4a')
      return createB
    }

    // Step 1: the B Leader turn starts (persona assertion — A2 T2).
    const bStart = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 0 && (r.body?.tools ?? []).length > 0, 180_000, 'B leader turn start')
    if (bStart === null) {
      fail('S1')
      check('S1', 'B leader turn started (model request observed)', false, `requests=${mock.requests.length}`)
    } else {
      const systemPrompt = (bStart.body.messages ?? [])
        .filter((m) => m.role === 'system')
        .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
        .join('\n')
      writeEvidence('s1-b-leader-request.json', { seq: bStart.seq, systemPrompt: systemPrompt.slice(0, 4000), tools: (bStart.body.tools ?? []).map((t) => t.function?.name ?? t.name) })
      check('S4b', 'B leader model request carries the BOUND blueprint B persona (not the row anchor A)',
        systemPrompt.includes(P_LEADER_B) && !systemPrompt.includes(P_LEADER_A),
        `hasB=${systemPrompt.includes(P_LEADER_B)} hasA=${systemPrompt.includes(P_LEADER_A)}`)
      if (!systemPrompt.includes(P_LEADER_B)) fail('S4b')
    }

    // Step 2: S1 — the allow-subtree read EXECUTED (tool result fed back),
    // and the decision was a static allow (observation), no control request.
    const bS1 = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 1, 180_000, 'B chain step 1 (S1 read executed)')
    if (bS1 === null) {
      fail('S1')
      check('S1', 'allow-subtree read executed (tool result returned to the model)', false, `requests=${mock.requests.length}`)
    } else {
      const s1result = String(bS1.body.messages.find((m) => m.role === 'tool')?.content ?? '')
      check('S1a', 'S1: read team/test.md returned the probe content (executed, not blocked)',
        s1result.includes(PROBE_TEAM_CONTENT), `result=${s1result.slice(0, 200)}`)
      if (!s1result.includes(PROBE_TEAM_CONTENT)) fail('S1a')
      const s1state = await p6t6State(booted.port)
      writeEvidence('s1-state-after.json', s1state.body)
      const s1obs = (Array.isArray(s1state.body?.observations) ? s1state.body.observations : [])
        .map((o) => (typeof o === 'string' ? o : JSON.stringify(o)))
        .filter((l) => l.includes('alpha2-perm'))
      // The decision row: {"stage":"decision",...,"decision":"allow","provenance":{"source":"rule","effect":"allow","lane":"allow"}}
      const s1AllowDecision = s1obs.some((l) => /"stage":"decision"/.test(l) && /"decision":"allow"/.test(l))
      check('S1b', 'S1: static allow decision observed (decision:allow, rule provenance — subtree hit, no canonicalization failure)',
        s1AllowDecision && !s1obs.some((l) => /canonicalization-failed|containment-undeterminable/.test(l)),
        `obs(${s1obs.length})=[${s1obs.slice(-4).join(' | ').slice(0, 400)}]`)
      if (!s1AllowDecision || s1obs.some((l) => /canonicalization-failed|containment-undeterminable/.test(l))) fail('S1b')
      const s1ControlReq = Array.isArray(s1state.body?.control?.requests) ? s1state.body.control.requests : []
      check('S1c', 'S1: no control request created for the allow-lane read', s1ControlReq.length === 0, `requests=${JSON.stringify(s1ControlReq).slice(0, 200)}`)
      if (s1ControlReq.length > 0) fail('S1c')
    }

    // Step 3: S2 — the deny-subtree read is a static DENY (explicit rule,
    // NOT a canonicalization failure).
    const bS2 = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 2, 180_000, 'B chain step 2 (S2 read executed)')
    if (bS2 === null) {
      fail('S2')
      check('S2', 'deny-subtree read reached a decision (tool result returned to the model)', false, `requests=${mock.requests.length}`)
    } else {
      const s2result = String(bS2.body.messages.filter((m) => m.role === 'tool').pop()?.content ?? '')
      const s2state = await p6t6State(booted.port)
      writeEvidence('s2-state-after.json', s2state.body)
      const s2obs = (Array.isArray(s2state.body?.observations) ? s2state.body.observations : [])
        .map((o) => (typeof o === 'string' ? o : JSON.stringify(o)))
        .filter((l) => l.includes('alpha2-perm'))
      // An EXPLICIT STATIC DENY = a decision row {"stage":"decision",...,"decision":"deny"}
      // with rule provenance — and NOT a canonicalization failure
      // (no "canonicalization-failed" / "containment-undeterminable" /
      // "deny-canonicalization-failure" row for this step).
      const s2StaticDeny = s2obs.some((l) => /"stage":"decision"/.test(l) && /"decision":"deny"/.test(l))
      const s2CanonicalizationFailure = s2obs.some((l) => /canonicalization-failed|containment-undeterminable/.test(l)) || s2result.includes('canonicaliz')
      check('S2a', 'S2: deny-subtree read produced an explicit static deny (decision:deny, NOT a canonicalization failure)', s2StaticDeny && !s2CanonicalizationFailure,
        `result=${s2result.slice(0, 200)} obs(${s2obs.length})=[${s2obs.slice(-4).join(' | ').slice(0, 300)}]`)
      if (!s2StaticDeny || s2CanonicalizationFailure) fail('S2a')
    }

    // Step 4: S3 — bash asks, the durable request is approved (human), the
    // command executes on the guard (no target-stale).
    const bS3Issued = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 2 && JSON.stringify(r.reply ?? '').includes('bash'), 120_000, 'B chain step 3 (bash issued)')
    if (bS3Issued === null) {
      fail('S3')
      check('S3', 'bash issued by the B leader (mock tool-call observed)', false, `requests=${mock.requests.length}`)
    } else {
      log('bash issued — waiting for the durable control request…')
      const disc = await discoverPendingRequestId(booted.port, CREATE_ROOT_B, 's3')
      if (disc.requestId === null) {
        writeEvidence('s3-diagnostic-mock.json', mock.requests.slice(-6).map((r) => ({ seq: r.seq, reply: r.reply })))
        fail('S3')
        check('S3a', 'S3: pending bash control requestId discovered (observations or storage)', false,
          `candidates=${JSON.stringify(disc.candidates).slice(0, 300)}`)
      } else {
        log(`pending requestId=${disc.requestId} (source=${disc.source})`)
        const approval = await scriptedApproval(booted.origin, booted.cookie, disc.requestId)
        const approvalOk = approval.status === 200
          && approval.body?.result?.ok !== false
          && JSON.stringify(approval.body).includes('allow')
        check('S3a', 'S3: scripted approval recorded a durable allow (human principal, boot root)', approvalOk,
          `status=${approval.status} body=${JSON.stringify(approval.body).slice(0, 400)}`)
        if (!approvalOk) fail('S3a')
        // The turn resumes: the bash tool result reaches the model.
        const bS3 = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 3, 240_000, 'B chain step 3 complete (bash executed)')
        if (bS3 === null) {
          writeEvidence('s3-diagnostic-state.json', (await p6t6State(booted.port)).body)
          writeEvidence('s3-diagnostic-instance-tail.txt', logTail(booted.instanceLog, 60))
          fail('S3')
          check('S3b', 'S3: bash executed after approval (tool result returned — NO target-stale)', false, `requests=${mock.requests.length}`)
        } else {
          const s3result = String(bS3.body.messages.filter((m) => m.role === 'tool').pop()?.content ?? '')
          check('S3b', 'S3: bash executed after approval — the echo output reached the model (guard passed, no target-stale)',
            s3result.includes('rc2-smoke'), `result=${s3result.slice(0, 200)}`)
          if (!s3result.includes('rc2-smoke')) fail('S3b')
          // S3c — the A6 proof at the guard level: the last-mile verdict
          // row {"stage":"guard-verdict","allowed":true,...,requestId} for
          // the approved request (the unfixed guard returned
          // allowed:false reason:target-stale here).
          const s3state = await p6t6State(booted.port)
          writeEvidence('s3-state-after-allow.json', s3state.body)
          const s3obs = (Array.isArray(s3state.body?.observations) ? s3state.body.observations : [])
            .map((o) => (typeof o === 'string' ? o : JSON.stringify(o)))
            .filter((l) => l.includes('alpha2-perm'))
          const s3GuardAllowed = s3obs.some((l) => /"stage":"guard-verdict"/.test(l) && /"allowed":true/.test(l))
          const s3GuardStale = s3obs.some((l) => /target-stale|target_stale/.test(l))
          check('S3c', 'S3: last-mile guard verdict allowed:true for the approved leader request (NO target-stale — A6 proof)',
            s3GuardAllowed && !s3GuardStale,
            `obs(${s3obs.length}) guardRows=[${s3obs.filter((l) => l.includes('guard-verdict')).slice(-3).join(' | ').slice(0, 300)}]`)
          if (!s3GuardAllowed || s3GuardStale) fail('S3c')
        }
      }
    }

    // Step 5: S4 — team_create_member(worker-b) on the bound blueprint
    // succeeds (pre-fix: row-anchor persona → post-commit reject).
    const bS4 = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 4, 240_000, 'B chain step 4 (create_member executed)')
    if (bS4 === null) {
      fail('S4c')
      check('S4c', 'S4: team_create_member(worker-b) executed (tool result returned)', false, `requests=${mock.requests.length}`)
    } else {
      const s4result = String(bS4.body.messages.filter((m) => m.role === 'tool').pop()?.content ?? '')
      writeEvidence('s4-create-member-result.json', { result: s4result.slice(0, 2000) })
      const s4ok = /member|created|inst-/.test(s4result) && !/reject|denied|error|unavailable|not found/i.test(s4result)
      check('S4c', 'S4: first create of the B-only template worker-b SUCCEEDED (no post-commit reject)', s4ok, `result=${s4result.slice(0, 300)}`)
      if (!s4ok) fail('S4c')
    }

    // Step 6: S4 — delegate to the B member; the member model request
    // carries the B worker persona (A2 binder proof).
    const bS4d = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 5, 240_000, 'B chain step 5 (delegate executed)')
    if (bS4d === null) {
      fail('S4d')
      check('S4d', 'S4: team_delegate executed (tool result returned)', false, `requests=${mock.requests.length}`)
    } else {
      check('S4d', 'S4: team_delegate executed (tool result returned)', true, 'delegate tool result observed')
      const bMember = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_BMEM) && (r.body?.tools ?? []).length > 0, 240_000, 'B member turn')
      if (bMember === null) {
        fail('S4e')
        check('S4e', 'S4: the B member turn started (model request observed)', false, `requests=${mock.requests.length}`)
      } else {
        const bMemberSystem = (bMember.body.messages ?? [])
          .filter((mm) => mm.role === 'system')
          .map((mm) => (typeof mm.content === 'string' ? mm.content : JSON.stringify(mm.content ?? '')))
          .join('\n')
        writeEvidence('s4-b-member-request.json', { seq: bMember.seq, systemPrompt: bMemberSystem.slice(0, 4000) })
        check('S4e', 'S4: the B member carries blueprint B worker persona (binder resolved the BOUND blueprint)',
          bMemberSystem.includes(P_WORKER_B) && !bMemberSystem.includes(P_WORKER_A),
          `hasB=${bMemberSystem.includes(P_WORKER_B)} hasA=${bMemberSystem.includes(P_WORKER_A)}`)
        if (!bMemberSystem.includes(P_WORKER_B)) fail('S4e')
      }
    }

    // Step 7: the B chain completes.
    const bDone = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 5 && (r.reply?.kind === 'text' ? r.reply.content : '').includes('RC2_SMOKE_B_DONE'), 120_000, 'B chain final text')
    check('S4f', 'S4: the B leader turn completed (final text RC2_SMOKE_B_DONE)', bDone !== null, `requests=${mock.requests.length}`)
    if (bDone === null) fail('S4f')

    // Step 8: the in-flight team.create B response — the turn is idle now,
    // so the delivery (followup + whenIdle) has settled and the response
    // carries the durable fresh-root facts. (LIVE-FOUND run 11-16-34: the
    // sequential await deadlocked the S3 approval 240 s out — the S4a
    // criterion is UNCHANGED, only the read timing moves to after idle.)
    await finishCreateB()

    // ── S5: team C (same row, same templateId, different persona) ────────
    log('── S5: team C (same row, blueprint C) ──')
    const createC = await remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_C,
      blueprintId: BP_C_ID,
      initialWork: { prompt: MK_C },
    }, 'rc2c')
    writeEvidence('s5-team-create-c.json', createC.body)
    const createCOk = createC.status === 200
      && createC.body?.result?.ok === true
      && createC.body?.result?.value?.data?.path === 'fresh-root'
    check('S5a', 'team.create (C, same row, blueprint C) succeeds', createCOk, `status=${createC.status} body=${JSON.stringify(createC.body).slice(0, 300)}`)
    if (!createCOk) fail('S5a')

    const cMember = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_CMEM) && (r.body?.tools ?? []).length > 0, 300_000, 'C member turn')
    if (cMember === null) {
      fail('S5b')
      check('S5b', 'S5: the C member turn started', false, `requests=${mock.requests.length}`)
    } else {
      const cMemberSystem = (cMember.body.messages ?? [])
        .filter((mm) => mm.role === 'system')
        .map((mm) => (typeof mm.content === 'string' ? mm.content : JSON.stringify(mm.content ?? '')))
        .join('\n')
      writeEvidence('s5-c-member-request.json', { seq: cMember.seq, systemPrompt: cMemberSystem.slice(0, 4000) })
      check('S5b', 'S5: the C member carries blueprint C worker persona (root-scoped resolution)',
        cMemberSystem.includes(P_WORKER_C) && !cMemberSystem.includes(P_WORKER_B),
        `hasC=${cMemberSystem.includes(P_WORKER_C)} hasB=${cMemberSystem.includes(P_WORKER_B)}`)
      if (!cMemberSystem.includes(P_WORKER_C)) fail('S5b')
      // The B member keeps B's persona (re-assert on the captured request).
      // LIVE-FOUND (run 11-22-46): a bare marker re-scan can land on a TITLE
      // side-call (its human-message JSON nests the delegation prompt, so
      // the marker matches, but the system prompt is the title generator's
      // — no member persona → false S5c failure). Restrict to REAL model
      // requests (tools > 0), the same guard every other predicate uses.
      const bMemberAgain = mock.requests.find(
        (r) => r.body !== null && userTextOf(r).includes(MK_BMEM) && (r.body?.tools ?? []).length > 0,
      )
      const bMemberSystemAgain = (bMemberAgain?.body.messages ?? [])
        .filter((mm) => mm.role === 'system')
        .map((mm) => (typeof mm.content === 'string' ? mm.content : JSON.stringify(mm.content ?? '')))
        .join('\n')
      check('S5c', 'S5: the B member still carries B worker persona (no cross-team leak)',
        bMemberSystemAgain.includes(P_WORKER_B) && !bMemberSystemAgain.includes(P_WORKER_C),
        `requests=${mock.requests.length} memberReq=${bMemberAgain?.seq}`)
      if (!(bMemberSystemAgain.includes(P_WORKER_B) && !bMemberSystemAgain.includes(P_WORKER_C))) fail('S5c')
    }
    const cDone = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_C) && (r.reply?.kind === 'text' ? r.reply.content : '').includes('RC2_SMOKE_C_DONE'), 120_000, 'C chain final text')
    check('S5d', 'S5: the C leader turn completed (final text RC2_SMOKE_C_DONE)', cDone !== null, `requests=${mock.requests.length}`)
    if (cDone === null) fail('S5d')
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
    // The mock request corpus (the forensic heart of the evidence).
    writeEvidence('mock-requests.json', mock.requests.map((r) => ({
      seq: r.seq,
      receivedAt: r.receivedAt,
      userText: userTextOf(r).slice(0, 300),
      toolMsgCount: toolMsgsOf(r).length,
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

  // Exit code: 0 all pass / 2 a leg failed / 1 fatal (dieFatal handles).
  process.exit(FAILS.length === 0 ? 0 : 2)
}

main().catch((e) => {
  try {
    log(`FATAL uncaught: ${e.stack ?? e}`)
    if (RUN_LOG !== null) writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: String(e.message ?? e), criteria })
  } catch { /* best-effort */ }
  process.exit(1)
})
