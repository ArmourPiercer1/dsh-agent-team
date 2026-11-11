#!/usr/bin/env node
/**
 * wp1-sticky-stop.mjs — WP1 (P0) measurement of the Alpha.6 **Sticky Stop**
 * on a real Host: the path the product claims to support (ARM A, with an
 * active review latch) and the path it claims NOT to support (ARM B, no
 * latch). CANDIDATE-C2 evidence against the pinned candidate SHA.
 *
 * WHY THIS KIT EXISTS
 * -------------------
 * The second C2 round measured Sticky Stop with NO review latch (markers empty,
 * wakes 1->1) and graded that as a failure. The release notes (§2.2/§4.7) state
 * the marker is LATCH-SCOPED: the only writer is inside
 * `if (coordinator === undefined) return false`
 * (`packages/runtime/src/plugin/root.ts:2755-2762`). This kit therefore
 * measures BOTH arms, and records what the product actually does on each.
 *
 * WHAT IT PROVES (one boot per arm; n=2 agreement is NOT a stability claim)
 * -------------------------------------------------------------------------
 * ARM A — supported path:
 *   A1 a real v5 Team creates a live Officer; a Member bash ask is routed to
 *      the Officer and a real review wake is dispatched (witness: the durable
 *      `wake-<latchHash>.json` intent row AND the `[team-review-wake ...]`
 *      request at the mock model) — so a wake coordinator exists for that
 *      reviewer Session before the Stop.
 *   A2 the HUMAN Stop is issued through the production channel
 *      (`POST /api/session/cancel` -> `session/cancel` -> upstream
 *      `turn/end` with `reason.kind='aborted'`, `reason.reason.kind='user'`),
 *      i.e. the listener in `host.ts:3105-3120`, never a direct function call.
 *   A3 a `stopped-<latchHash>.json` marker exists at the documented path
 *      (`<alpha6WakeIntentPath>/stopped-<FNV-1a(latch key)>.json`) with the
 *      documented content (`{stopped:true,key,targetSessionId,
 *      ownerRootSessionId}`). The function's `true` return is INFERRED from
 *      the marker write: production discards the boolean
 *      (`host.ts:3113-3120`), and the only `false` return is the
 *      coordinator-missing branch BEFORE any write.
 *   A4 SIGKILL + cold boot on the SAME DSH_HOME: the marker file survives
 *      byte-identical; a NEW review leg for the SAME reviewer is then
 *      SUPPRESSED (a fresh bash ask from a pre-created idle second worker
 *      mints a new parameter-permission leg AND its PA `team-tool-execute`
 *      leg, yet NO new wake reaches the mock), which is the observed
 *      consultation of the recovered marker (boot recovery registers the
 *      marker's latch as stopped, `root.ts:2936-2952`).
 *   A5 relay resistance: a machine `member.send` (the production
 *      `team_send_message` surface, caller instance = Leader) and a machine
 *      `member.followup` (work delivery) do NOT clear the marker and do NOT
 *      re-deliver the withdrawn wake.
 *
 * ARM B — the documented-unsupported path:
 *   B1 the same opt-in Host and the same Officer, but NO review wake is
 *      dispatched and no intent/stopped row exists — no coordinator.
 *   B2 the same HUMAN Stop (production `session/cancel`).
 *   B3 no `stopped-*` marker is written. The `false` return is INFERRED from
 *      the code path + absence of the marker/coordinator; the kit also
 *      scans the durable team domain, the host instance log and the session
 *      log for any "stopped" claim and records every hit (a claim on this
 *      path would be a finding).
 *   B4 the next review wake is OBSERVED to activate the reviewer. The
 *      sequence is: Stop -> ONE ordinary human turn re-engages the reviewer
 *      (there is no marker, so nothing is "cleared"; the turn exists because
 *      the Host's aborted-session state alone refuses the immediately next
 *      wake, see the diagnostic note) -> a new ask for the same reviewer is
 *      dispatched and a NEW `[team-review-wake ...]` turn starts at the mock.
 *      This is the disclosed limit, observed rather than inferred.
 *
 * WHAT IT DOES NOT PROVE
 * ----------------------
 *   - The returned boolean is not observed directly (production discards it);
 *     A3/B3 are code-path inferences backed by the marker witness.
 *   - It does not prove "exactly one wake" at the Inbox level; it counts
 *     DISTINCT wake ids observed at the mock (a wake turn may make several
 *     model calls, and the recipient session may already carry turns).
 *   - DIAGNOSTIC (not an n=2 criterion, recorded in the evidence README):
 *     with NO human turn after the Stop, the immediately next review ask is
 *     refused before any intent row is written (4/4 probe runs), while a
 *     control run with no Stop at all dispatches it immediately. The refusal
 *     is therefore Host session state, not a durable fact — exactly the gap
 *     PD-40 is about.
 *   - It does not test the explicit human resume arbour (A6-24) except as a
 *     side observation; it is not a criterion here.
 *   - It does not grade PD-40, does not fix anything, and does not change
 *     product semantics. It is a measurement.
 *
 * ENV / FLAGS
 * -----------
 *   C1_PLANE_TAKEOVER=1     REQUIRED (A6 officer path: the saved-source
 *                           blueprints are invalid YAML without the shell
 *                           takeover and team.create fails with a misleading
 *                           `blueprint not found in catalog`).
 *   --arm a|b               REQUIRED. Which arm to measure.
 *   --run-label <label>     Optional evidence/home label (e.g. a1).
 *   --host-port <p>         Default 15001 (use 1500x; NEVER 3080).
 *   --mock-port <p>         Default 15051 (use 1505x).
 *   --evidence-dir <dir>    Default dev/agent-workflow/evidence/wp1-sticky-stop/run-<label>.
 *   --worktree <dir>        Product tree to boot (default: this worktree).
 *   --testuse <dir>         Pristine host checkout (default: tests/paths.mjs tree).
 *   --wait-ms <ms>          Per-phase wait budget (default 240000).
 *   --keep                  Keep the DSH_HOME + blueprint scratch (state why
 *                           in the evidence README). Default: torn down.
 *
 * PORTS
 * -----
 *   Host: 15001-15009 family. Mock: 15051-15059 family. Loopback only.
 *   The stable instance (:3080) is probed read-only before/after, never touched.
 *
 * EXIT CODES
 * ----------
 *   0  every criterion passed
 *   2  at least one criterion failed (measurement completed)
 *   1  fatal setup/boot/preflight failure (measurement did not complete)
 *
 * EVIDENCE CLASS: CANDIDATE-C2, citing the pinned candidate SHA in
 * run-manifest.json. n=2 per arm = agreement, not stability.
 */

import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
import { DSH_BASELINE_VERSION } from '../../../tests/paths.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../_shared/preset-seam.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../tests/paths.mjs'

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
const ARM = String(argValue('arm', '')).toLowerCase()
if (ARM !== 'a' && ARM !== 'b') {
  console.error('wp1-sticky-stop: --arm a|b is required')
  process.exit(1)
}
const PLANE_TAKEOVER = process.env['C1_PLANE_TAKEOVER'] === '1'
if (!PLANE_TAKEOVER) {
  console.error('wp1-sticky-stop: C1_PLANE_TAKEOVER=1 is required for the A6 officer path (see header)')
  process.exit(1)
}
const RUN_LABEL = String(argValue('run-label', `${ARM}1`)).replace(/[^A-Za-z0-9._-]+/g, '-')
const HOST_PORT = Number(argValue('host-port', 15001))
const MOCK_PORT = Number(argValue('mock-port', 15051))
const WAIT_MS = Number(argValue('wait-ms', 240_000))

const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(KIT_DIR, '..', '..', '..')))
let TESTUSE = resolve(argValue('testuse', join(WORKTREE, 'tests', 'deepseek-harness-test-use')))
if (!existsSync(TESTUSE) && existsSync(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))) {
  TESTUSE = resolve(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))
}

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').replace('T', 'T').slice(0, 19)
const RUN_DIR = resolve(argValue('evidence-dir', join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'wp1-sticky-stop', `run-${RUN_LABEL}`)))
const HOME = join(WORKTREE, 'tests', 'homes', `wp1-sticky-${RUN_LABEL}-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const BLUEPRINT_DIR = join(WORKTREE, `.wp1-sticky-blueprints-${RUN_STAMP}`)
const WAKE_DIR = join(HOME, 'alpha6-wake-intents')

const ROOT = `session-wp1-root-${RUN_STAMP}`
const CREATE_ROOT = `session-wp1-team-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.wp1-anchor'
const BP_TEAM_ID = 'team.wp1-a6'

// ── frozen facts / production row ───────────────────────────────────────────

const HOST_BASELINE_SHA = TEST_USE_BASELINE_SHA
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

const SMOKE_PRESET_ID = 'rc2-smoke'
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
const TEAM_TOOL_CATALOG = [
  'team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member',
  'team_delegate', 'team_follow_up', 'team_collect', 'team_send_message', 'team_report_progress',
  'team_request_control', 'team_resolve_control', 'team_list_pending_control',
  'team_archive_member', 'team_grant_permission', 'team_revoke_permission',
]
const LEADER_TEAM_TOOLS_ALLOW = [
  'team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member',
  'team_delegate', 'team_collect', 'team_list_pending_control', 'team_resolve_control',
  'team_request_control',
]

const MK_A = `WP1MKA_${RUN_STAMP}`
const MK_A_MEMBER = `WP1MKAM_${RUN_STAMP}`
const MK_A_NEXT = `WP1MKAN_${RUN_STAMP}`
const MK_A_MEMBER2 = `WP1MKAM2_${RUN_STAMP}`
const CMD_POSTBOOT = 'echo wp1-postboot-ask'
const MK_B = `WP1MKB_${RUN_STAMP}`
const MK_B_MEMBER = `WP1MKBM_${RUN_STAMP}`
const MK_B_WARM = `WP1MKBW_${RUN_STAMP}`
const MK_B_NEXT = `WP1MKBN_${RUN_STAMP}`
const MK_B_MEMBER2 = `WP1MKBM2_${RUN_STAMP}`
const MK_B_REENGAGE = `WP1_ARM_B_REENGAGE_${RUN_STAMP}`
const CMD_NEXT_ASK = 'echo wp1-next-ask'
const ARM_A = ARM === 'a'
const SUM_ALLOW = `wp1-allow-${RUN_STAMP}`
const FILE_ALLOW = join(WORKSPACE, `wp1-allow-${RUN_STAMP}.txt`)
const CMD_ALLOW = `echo ${SUM_ALLOW} > ${FILE_ALLOW} && echo wp1-allow-executed`
const HOLD_TEXT = 'WP1_ARM_B_OFFICER_HOLD'
const RELAY_TEXT = 'WP1_ARM_A_MACHINE_RELAY'
const WORK_TEXT = 'WP1_ARM_A_MACHINE_WORK'

// ── logging / criteria ─────────────────────────────────────────────────────

let RUN_LOG = null
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  if (RUN_LOG !== null) {
    try { writeFileSync(RUN_LOG, stamped + '\n', { flag: 'a' }) } catch { /* best-effort */ }
  }
}
const criteria = []
function check(critId, name, ok, detail) {
  criteria.push({ id: critId, name, ok: ok === true, detail: String(detail ?? '') })
  log(`${ok === true ? 'PASS' : 'FAIL'} ${critId}: ${name}${detail === '' ? '' : ` — ${String(detail).slice(0, 600)}`}`)
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
  writeEvidence('summary.json', { runLabel: RUN_LABEL, arm: ARM, runStamp: RUN_STAMP, fatal: msg, criteria })
  process.exit(exitCode)
}

// ── HTTP helpers ───────────────────────────────────────────────────────────

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
async function remoteCall(origin, cookie, method, params, tag = 'wp1', version = 1) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version, params } }),
  }, 240_000)
}
async function apiPrompt(origin, cookie, sessionId, text, tag = 'wp1') {
  return fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: { args: { request: { requestId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } },
    }),
  }, 240_000)
}
/**
 * The production HUMAN Stop channel. `session/cancel` reaches upstream
 * `agent.cancel({kind:'user'})`; the resulting `turn/end` carries
 * `reason.kind='aborted'` + `reason.reason.kind='user'` — the ONLY shape
 * `host.ts:3105-3120` maps onto `alpha6WakeUserStop`.
 */
async function apiCancel(origin, cookie, sessionId, tag = 'wp1cancel') {
  return fetchJson(`${origin}/api/session/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/cancel',
      payload: { args: { request: { sessionId } } },
    }),
  }, 30_000)
}
async function p6t6State(port) { return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 30_000) }
async function p6t6Health(port) { return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000) }
function logTail(logPath, n = 30) {
  try { return readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n') } catch { return '<no log>' }
}
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/
async function waitForLogLine(logPath, regex, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  let seen = 0
  for (;;) {
    let text = ''
    try { text = readFileSync(logPath, 'utf8') } catch { /* not yet */ }
    const lines = text === '' ? [] : text.split('\n')
    for (let i = seen; i < lines.length; i += 1) {
      if (regex.exec(lines[i]) !== null) return lines[i]
    }
    seen = lines.length
    if (Date.now() >= deadline) break
    if (alive !== undefined && !alive()) return null
    await new Promise((r) => setTimeout(r, 300))
  }
  return null
}

// ── preflight / ports ──────────────────────────────────────────────────────

function preflight() {
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' })
  if (rev.status !== 0 || rev.stdout.trim() !== HOST_BASELINE_SHA) {
    dieFatal(`test-use checkout is not at ${HOST_BASELINE_SHA} (got ${rev.stdout?.trim() ?? rev.stderr})`)
  }
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' })
  if (dirty.status !== 0 || dirty.stdout.trim() !== '') {
    dieFatal(`test-use checkout is not pristine: ${dirty.stdout?.trim().slice(0, 300)}`)
  }
  for (const p of [HOST_BIN, PRODUCTION_ROW_PATH, GLUE_PATH, SEAM_PATH, P6T6_PLUGIN_PATH]) {
    if (!existsSync(p)) dieFatal(`required file missing: ${p}`)
  }
  const product = spawnSync('git', ['-C', WORKTREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
  if (product.status !== 0) dieFatal(`cannot resolve product worktree HEAD: ${product.stderr}`)
  return product.stdout.trim()
}
async function portFree(port, timeoutMs = 1500) {
  const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ error: e }))
  return res.error !== undefined
}

// ── world materialization ──────────────────────────────────────────────────

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
function planeLauncherSha() {
  return createHash('sha256').update(readFileSync(join(WORKTREE, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py'))).digest('hex')
}
function teamRowConfig() {
  const launcher = join(WORKTREE, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: BP_A6_ANCHOR_YAML,
    blueprintDir: BLUEPRINT_DIR,
    rootPresetId: SMOKE_PRESET_ID,
    memberPresetId: SMOKE_PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'wp1-sticky-model' },
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
    teamToolPlane: {
      realmId: `wp1-plane-realm-${RUN_STAMP}`,
      names: { bash: 'bash' },
      workingDir: WORKSPACE,
      confinedProvider: {
        trustRoot: `sha256:${planeLauncherSha().slice(0, 16)}#${launcher}`,
        assembly: { launcherPath: launcher, launcherSha256: planeLauncherSha(), minAbiVersion: 3 },
      },
    },
    alpha6ReviewRouting: true,
    alpha6WakeIntentPath: WAKE_DIR,
  }
}

/** The v5 opt-in anchor: Officer admitted, routing declared, durable path configured. */
const BP_A6_ANCHOR_YAML = [
  '---',
  'schemaVersion: 5',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader: { templateId: leader, persona: WP1 measurement anchor. }',
  'members:',
  '  - templateId: officer',
  '    persona: Review asks for this team.',
  '  - templateId: worker',
  '    persona: Worker of the WP1 team.',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'permissionMutationEnvelope: { rules: [] }',
  'teamHardEnvelope: { rules: [] }',
  'teamEnvelope:',
  '  allow:',
  '    - request-control',
  '  deny: []',
  'metadata: {}',
  'reviewRouting:',
  '  enabled: true',
  '  officerTemplateId: officer',
  '  ordinaryToolApprovals:',
  '    default: officer',
  '    leaderExceptions: []',
  '  whenOfficerUnavailable: hold',
  '---',
  '',
].join('\n')

/** The saved-source v5 team blueprint (strict leader/worker + one real Officer). */
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
    '      deny: []',
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
    '        deny: []',
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
  const officer = [
    '  - templateId: officer',
    '    persona: "You are the WP1 Officer. Resolve the review legs routed to you; do not execute work."',
    '    capabilities:',
    '      teamTools:',
    '        kind: allow',
    '        items:',
    '          - team_list_pending_control',
    '          - team_resolve_control',
    '      builtinToolDeny: []',
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    '      permissions:',
    '        default: deny',
    '        allow: []',
    '        ask: []',
    '        deny: []',
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
    '  - templateId: officer',
    '    envelope:',
    '      allow:',
    '        - resolve-control',
    '      deny: []',
  ]
  let text = [
    '---',
    'schemaVersion: 5',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    'requirements: []',
    ...leaderBlock,
    ...teamEnvelope,
    ...workerBlock,
    officer.join('\n'),
    ...memberEnvelope,
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
    'policyStates: []',
    'metadata: {}',
    'reviewRouting:',
    '  enabled: true',
    '  officerTemplateId: officer',
    '  ordinaryToolApprovals:',
    '    default: officer',
    '    leaderExceptions: []',
    '  whenOfficerUnavailable: hold',
    '---',
    '',
  ].join('\n')
  return text
}

function smokePresetDeclaration() {
  return presetDeclarationRow({
    id: SMOKE_PRESET_ID,
    displayName: 'wp1 sticky stop',
    description: `WP1 Sticky Stop real-host kit (run ${RUN_STAMP}); mounted through the public profile-patch seam.`,
    plugins: smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
    }),
  })
}

function writePatchFile(home) {
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const lines = [
    `# WP1 Sticky Stop patch layer (run ${RUN_STAMP}): production dsh-agent-team row (worktree dist) + p6t6 observability row — mounted ONLY through the public profile-patch seam.`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...yamlEmitItem(smokePresetDeclaration(), 2),
    '',
  ]
  writeFileSync(join(home, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
}

// ── real-host boot ─────────────────────────────────────────────────────────

function spawnHost({ port, home, logPath, mockPort }) {
  const outFd = openSync(logPath, 'a')
  const errFd = openSync(logPath, 'a')
  let child
  try {
    child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(port), '--no-open'], {
      cwd: WORKSPACE,
      stdio: ['ignore', outFd, errFd],
      env: {
        ...process.env,
        DSH_HOME: home,
        DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
        DEEPSEEK_API_KEY: 'wp1-sticky-mock-key',
      },
    })
  } catch (error) {
    closeSync(outFd)
    closeSync(errFd)
    throw new Error(`host spawn failed: ${error.message}`)
  }
  const exitInfo = { exited: false, code: undefined, signal: undefined, message: undefined }
  child.on('error', (error) => { exitInfo.exited = true; exitInfo.signal = 'spawn-error'; exitInfo.message = error.message })
  child.on('close', (code, signal) => { exitInfo.exited = true; exitInfo.code = code; exitInfo.signal = signal })
  return { child, exitInfo, alive: () => !exitInfo.exited, logPath }
}
function stopHost(h) { try { h.child.kill() } catch { /* gone */ } return h }
async function waitForBoot(logPath, offset, alive) {
  const deadline = Date.now() + 240_000
  for (;;) {
    let text = ''
    try { text = readFileSync(logPath, 'utf8').slice(offset) } catch { /* not yet */ }
    const m = [...text.matchAll(/dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/g)].at(-1)
    if (m !== undefined) return { origin: `http://127.0.0.1:${m[1]}`, token: m[2] }
    if (Date.now() >= deadline) return null
    if (alive !== undefined && !alive()) return null
    await new Promise((r) => setTimeout(r, 250))
  }
}
async function bootHost({ port, home, mockPort, instanceLog }) {
  writePatchFile(home)
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'wp1-anchor.yaml'), BP_A6_ANCHOR_YAML)
  writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
    boot: 1, phase: 'create', reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT,
  }, null, 2))
  const h = spawnHost({ port, home, logPath: instanceLog, mockPort })
  const found = await waitForBoot(instanceLog, 0, h.alive)
  if (found === null) {
    stopHost(h)
    dieFatal(`host boot failed: ${h.exitInfo.exited ? `exited code=${h.exitInfo.code} signal=${h.exitInfo.signal}` : 'no boot marker'}\n--- log tail ---\n${logTail(instanceLog)}`)
  }
  const cookie = await authenticate(found.origin, found.token).catch((e) => dieFatal(`auth failed: ${e.message}`))
  const portNum = Number(new URL(found.origin).port)
  const deadline = Date.now() + 240_000
  let health = null
  for (;;) {
    const hb = await p6t6Health(portNum)
    health = hb
    if (hb.status === 200 && hb.body?.ok === true) break
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      stopHost(h)
      dieFatal(`row setup failed — setupError: ${String(hb.body.setupError).slice(0, 800)}\n--- log tail ---\n${logTail(instanceLog)}`)
    }
    if (Date.now() >= deadline) {
      stopHost(h)
      dieFatal(`row health not ready in 240s — health=${JSON.stringify(hb.body).slice(0, 400)}\n--- log tail ---\n${logTail(instanceLog)}`)
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  const sDeadline = Date.now() + 90_000
  for (;;) {
    const s = await p6t6State(portNum)
    const b = s.body
    if (s.status === 200 && b !== null && typeof b === 'object' && b.rootSessionId === ROOT
      && b.teamSession !== null && typeof b.teamSession === 'object') break
    if (Date.now() >= sDeadline) {
      stopHost(h)
      dieFatal(`row state not well-formed; last: status=${s.status} body=${JSON.stringify(s.body).slice(0, 400)}`)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  log(`host booted at ${found.origin}; row ready — toolCount=${health.body?.toolCount}`)
  return { host: h, port: portNum, origin: found.origin, cookie, instanceLog }
}

// ── mock model ─────────────────────────────────────────────────────────────

function bashArgs(command) { return { command, timeout: 30_000 } }
function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-wp1-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}
function bodyOf(recordOrBody) {
  if (recordOrBody === null || typeof recordOrBody !== 'object') return null
  return 'body' in recordOrBody ? (recordOrBody.body ?? null) : recordOrBody
}
function messagesOf(req) { return bodyOf(req)?.messages ?? [] }
function contentText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((block) => {
      if (typeof block === 'string') return block
      if (block?.type === 'tool_result') return contentText(block.content)
      return typeof block?.text === 'string' ? block.text : ''
    }).join('\n')
  }
  return JSON.stringify(content ?? '')
}
const TRIGGER_RE = /WP1MK[A-Z0-9_]+_[0-9T:-]+|\[team-control requestId=|\[team-review-wake wakeId=/
function isToolResultMessage(m) {
  if (m?.role === 'tool') return true
  return m?.role === 'user' && Array.isArray(m.content) && m.content.some((block) => block?.type === 'tool_result')
}
function lastTriggerIndex(req) {
  const messages = messagesOf(req)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m.role !== 'user' || isToolResultMessage(m)) continue
    const t = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
    if (TRIGGER_RE.test(t)) return i
  }
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user' && !isToolResultMessage(messages[i])) return i
  }
  return -1
}
function lastUserTextOf(req) {
  const messages = messagesOf(req)
  const i = lastTriggerIndex(req)
  if (i === -1) return ''
  return contentText(messages[i].content)
}
function toolMsgsOf(req) {
  const messages = messagesOf(req)
  const from = lastTriggerIndex(req) + 1
  return messages.slice(from).filter(isToolResultMessage)
}
/**
 * DELIVERED review wakes = DISTINCT wake ids observed as the chain's last user
 * text. A wake turn may make several model calls (tool results follow), and a
 * recipient session may already carry earlier turns, so neither model-request
 * count nor `messageCount === 1` is a delivery count. The wake id is the
 * delivery identity (deterministic per latch + work fingerprint).
 */
function wakeIds(requests) {
  const ids = new Set()
  for (const r of requests) {
    const m = /^\[team-review-wake wakeId=([^\]]+)\]/.exec(lastUserTextOf(r))
    if (m !== null) ids.add(m[1])
  }
  return ids
}
function wakeStartCount(requests) {
  return wakeIds(requests).size
}
/** The worker instance id from a team_list_members tool result. */
function extractWorkerId(text) {
  for (const part of String(text).split('{')) {
    if (!/"templateId"\s*:\s*"worker"/.test(part)) continue
    const m = /"instanceId"\s*:\s*"([^"]+)"/.exec(part)
    if (m !== null) return m[1]
  }
  return null
}

function extractInstanceId(content) {
  const text = contentText(content)
  const m =
    /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(text) ??
    /"instanceId"\s*:\s*"([^"]+)"/.exec(text) ??
    /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(text)
  return m === null ? null : m[1]
}

function makeDecide() {
  return async function decide({ req }) {
    try {
      writeFileSync(join(RUN_DIR, 'mock-decide.log'), `seq=${req.seq} messages=${messagesOf(req).length} lastUser=${JSON.stringify(lastUserTextOf(req).slice(0, 500))}\n`, { flag: 'a' })
    } catch { /* best-effort */ }
    const firstMsg = messagesOf(req)[0]
    if (typeof firstMsg?.content === 'string'
      && (firstMsg.content.startsWith('Create a concise title') || firstMsg.content.startsWith('Generate the session title'))) {
      return { kind: 'text', content: 'WP1 sticky stop' }
    }
    const lastUser = lastUserTextOf(req)
    if (lastUser.startsWith('Generate the session title') || lastUser.startsWith('Create a concise title')) {
      return { kind: 'text', content: 'WP1 sticky stop' }
    }
    const tools = toolMsgsOf(req).length
    // ── the Arm B officer hold turn (a real turn for the human Stop) ──
    if (lastUser.includes(HOLD_TEXT)) {
      await new Promise((resolve) => setTimeout(resolve, 8_000))
      return { kind: 'text', content: 'WP1_ARM_B_OFFICER_HOLD_DONE' }
    }
    // ── the durable Leader notification turn (C1 shape) ──
    // The A5 parameter-permission leg the confined bash produces first is a
    // LEGACY leader row (no operationTool facts), so the Alpha.6 router
    // legally hands it to the Leader. Resolving it through the model-facing
    // tools lets the plane PA leg be minted, which IS a delegable ordinary
    // ask and is routed to the Officer as the review wake.
    if (lastUser.startsWith('[team-control requestId=')) {
      const requestIdFromText = /requestId:\s*(ctrl-[A-Za-z0-9_-]+)/.exec(lastUser)?.[1] ?? null
      if (tools === 0) {
        return toolCall('team_list_pending_control', {
          rootSessionId: CREATE_ROOT,
          requestToken: `wp1-notif-list-${String(Math.random()).slice(2, 8)}`,
        })
      }
      const listText = contentText(toolMsgsOf(req).slice(-1)[0]?.content ?? '')
      // Resolve the EXACT request this notification names (a pending list may
      // also carry an older, already-abandoned leg — preferring the first
      // listed id made the resolve miss after a restart, measured).
      const listed = requestIdFromText ?? /"requestId"\s*:\s*"([^"]+)"/.exec(listText)?.[1] ?? ''
      if (tools === 1) {
        return toolCall('team_resolve_control', {
          rootSessionId: CREATE_ROOT,
          requestToken: `wp1-notif-res-${String(Math.random()).slice(2, 8)}`,
          requestId: listed,
          decision: 'allow',
        })
      }
      return { kind: 'text', content: 'WP1_NOTIF_DONE' }
    }
    // ── the review wake turn ──
    if (lastUser.startsWith('[team-review-wake')) {
      // Arm A: hold the wake turn open so the Stop lands on a RUNNING turn.
      // Arm B: reply immediately (the point is that the wake is DELIVERED).
      if (ARM_A) await new Promise((resolve) => setTimeout(resolve, 40_000))
      return { kind: 'text', content: ARM_A ? 'WP1_ARM_A_WAKE_HELD' : 'WP1_ARM_B_WAKE_ACTIVATED' }
    }
    if (lastUser.includes('WP1_ARM_B_REENGAGE')) return { kind: 'text', content: 'WP1_B_REENGAGE_DONE' }
    // ── Arm A post-restart chain: a SECOND worker + ask so a NEW review leg
    // is minted for the SAME (recovered, stopped) reviewer latch. ──
    if (lastUser.includes(MK_A_NEXT)) {
      switch (tools) {
        case 0: return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT, requestToken: `wp1-a-next-create-${RUN_STAMP}`, templateId: 'worker', label: 'w-wp1-2',
        })
        case 1: {
          const wid = extractInstanceId(toolMsgsOf(req).slice(-1)[0]?.content)
          if (wid === null) return { kind: 'text', content: 'WP1_A_NEXT_ID_FAIL' }
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT, requestToken: `wp1-a-next-delegate-${RUN_STAMP}`, delegationInstanceId: wid, label: 'w-wp1-2', prompt: MK_A_MEMBER, async: true,
          })
        }
        default: return { kind: 'text', content: 'WP1_A_NEXT_DONE' }
      }
    }
    // ── Arm B warm-up: a text-only worker turn (settles the child session
    // so the later followup is delivered like any other work unit) ──
    if (lastUser.includes(MK_B_WARM)) return { kind: 'text', content: 'WP1_B_WARM_DONE' }
    // ── Arm B next-wake trigger: the Leader delegates a fresh ask to the
    // already-created worker (the production delegation path; a followup on a
    // never-reactivated idle child does not start a turn in this build). ──
    if (lastUser.includes(MK_B_NEXT)) {
      if (tools === 0) {
        return toolCall('team_list_members', {
          rootSessionId: CREATE_ROOT,
          requestToken: `wp1-b-next-list-${RUN_STAMP}`,
        })
      }
      if (tools === 1) {
        const listText = contentText(toolMsgsOf(req).slice(-1)[0]?.content ?? '')
        const wid = extractWorkerId(listText)
        if (wid === null) return { kind: 'text', content: `WP1_B_NEXT_ID_FAIL :: ${listText.slice(0, 300)}` }
        return toolCall('team_delegate', {
          rootSessionId: CREATE_ROOT,
          requestToken: `wp1-b-next-${RUN_STAMP}`,
          delegationInstanceId: wid,
          label: 'w-wp1',
          prompt: MK_B_MEMBER2,
          async: true,
        })
      }
      return { kind: 'text', content: 'WP1_B_NEXT_DONE' }
    }
    // ── Arm A leader chain: officer + worker + async delegate ──
    if (lastUser.includes(MK_A)) {
      switch (tools) {
        case 0: return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT, requestToken: `wp1-a-officer-${RUN_STAMP}`, delegationTemplateId: 'officer', label: 'officer',
        })
        case 1: return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT, requestToken: `wp1-a-worker-${RUN_STAMP}`, delegationTemplateId: 'worker', label: 'w-wp1',
        })
        // A second, IDLE worker created before the Stop. Its first work unit
        // is delivered AFTER the cold boot, so the post-restart ask does not
        // depend on the first worker's resumed pre-kill turn.
        case 2: return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT, requestToken: `wp1-a-idle-${RUN_STAMP}`, delegationTemplateId: 'worker', label: 'w-wp1-idle',
        })
        case 3: {
          const workerId = extractInstanceId(toolMsgsOf(req)[1]?.content)
          if (workerId === null) return { kind: 'text', content: `WP1_A_WORKER_EXTRACT_FAIL :: ${contentText(toolMsgsOf(req)[1]?.content).slice(0, 300)}` }
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT, requestToken: `wp1-a-delegate-${RUN_STAMP}`, delegationInstanceId: workerId, label: 'w-wp1', prompt: MK_A_MEMBER, async: true,
          })
        }
        case 4: return { kind: 'text', content: 'WP1_A_LEADER_DONE' }
        default: return { kind: 'text', content: 'WP1_A_LEADER_FALLTHROUGH' }
      }
    }
    // ── Arm B leader chain: officer + worker, NO delegation/ask ──
    if (lastUser.includes(MK_B)) {
      switch (tools) {
        case 0: return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT, requestToken: `wp1-b-officer-${RUN_STAMP}`, delegationTemplateId: 'officer', label: 'officer',
        })
        case 1: return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT, requestToken: `wp1-b-worker-${RUN_STAMP}`, delegationTemplateId: 'worker', label: 'w-wp1',
        })
        case 2: {
          const workerId = extractInstanceId(toolMsgsOf(req)[1]?.content)
          if (workerId === null) return { kind: 'text', content: `WP1_B_WORKER_EXTRACT_FAIL :: ${contentText(toolMsgsOf(req)[1]?.content).slice(0, 300)}` }
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT, requestToken: `wp1-b-warm-${RUN_STAMP}`, delegationInstanceId: workerId, label: 'w-wp1', prompt: MK_B_WARM, async: true,
          })
        }
        case 3: return { kind: 'text', content: 'WP1_B_LEADER_DONE' }
        default: return { kind: 'text', content: 'WP1_B_LEADER_FALLTHROUGH' }
      }
    }
    // ── member chain: one bash ask (the review leg) ──
    if (lastUser.includes(MK_A_MEMBER2)) {
      switch (tools) {
        case 0: return toolCall('bash', bashArgs(CMD_POSTBOOT))
        case 1: return { kind: 'text', content: 'WP1_MEMBER2_DONE' }
        default: return { kind: 'text', content: 'WP1_MEMBER2_FALLTHROUGH' }
      }
    }
    if (lastUser.includes(MK_A_MEMBER) || lastUser.includes(MK_B_MEMBER) || lastUser.includes(MK_B_MEMBER2)) {
      const command = lastUser.includes(MK_B_MEMBER2) ? CMD_NEXT_ASK : CMD_ALLOW
      switch (tools) {
        case 0: return toolCall('bash', bashArgs(command))
        case 1: return { kind: 'text', content: 'WP1_MEMBER_DONE' }
        default: return { kind: 'text', content: 'WP1_MEMBER_FALLTHROUGH' }
      }
    }
    return { kind: 'text', content: 'WP1_NOOP_DONE' }
  }
}

async function waitForMock(mock, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.find(pred)
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, 250))
  }
}

// ── durable state readers ──────────────────────────────────────────────────

function readDomain() {
  try { return JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8')) } catch { return null }
}
function readControlLedger(root) {
  const out = { requests: [], decisions: [], consumptions: [], abandonments: [], error: null }
  const parsed = readDomain()
  const ledger = parsed?.tables?.ledger
  if (ledger === null || typeof ledger !== 'object') { out.error = 'no ledger table'; return out }
  for (const [k, v] of Object.entries(ledger)) {
    if (k === '__ledger_sequence_counter' || typeof v !== 'string') continue
    let entry
    try { entry = JSON.parse(v) } catch { continue }
    if (String(entry?.rootSessionId) !== root) continue
    const payload = entry?.payload ?? {}
    if (entry.factType === 'control-request-recorded') {
      out.requests.push({ sequence: Number(k), requestId: payload.requestId, kind: payload.kind, toolName: payload.toolName, actionName: payload.actionName, targetInstanceId: payload.targetInstanceId, status: payload.status })
    } else if (entry.factType === 'control-decision-recorded') {
      out.decisions.push({ sequence: Number(k), requestId: payload.requestId, decision: payload.decision })
    } else if (entry.factType === 'control-allow-consumed') {
      out.consumptions.push({ sequence: Number(k), requestId: payload.requestId })
    } else if (entry.factType === 'control-request-abandoned') {
      out.abandonments.push({ sequence: Number(k), requestId: payload.requestId, reason: payload.reason })
    }
  }
  return out
}
function readMemberRows(root) {
  const rows = readDomain()?.tables?.member_instances
  if (rows === null || typeof rows !== 'object') return []
  const out = []
  for (const v of Object.values(rows)) {
    if (typeof v !== 'string') continue
    let row
    try { row = JSON.parse(v) } catch { continue }
    if (String(row?.rootSessionId) === root) out.push(row)
  }
  return out
}
function listWakeDir() {
  try {
    return readdirSync(WAKE_DIR).sort()
  } catch { return [] }
}
function stoppedFiles() { return listWakeDir().filter((n) => n.startsWith('stopped-') && n.endsWith('.json')) }
function wakeFiles() { return listWakeDir().filter((n) => n.startsWith('wake-') && n.endsWith('.json')) }
function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}
function fnv1a(text) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
/** The documented marker path for a marker's own latch key. */
function expectedMarkerName(marker) {
  const key = marker?.key ?? {}
  return `stopped-${fnv1a(`${key.rootSessionId}\u001f${key.reviewerInstanceId}\u001f${String(key.sessionGeneration)}`)}.json`
}
/** Scan every durable/log surface for a "stopped" claim (Arm B finding probe). */
function scanStopClaims(instanceLog) {
  const hits = []
  const needles = [/sticky stop/i, /stopped/i, /PD-40/i, /alpha6WakeUserStop/]
  const scanText = (surface, text) => {
    if (typeof text !== 'string' || text === '') return
    for (const needle of needles) {
      const re = new RegExp(needle.source, needle.flags.includes('g') ? needle.flags : `${needle.flags}g`)
      let m
      while ((m = re.exec(text)) !== null) {
        hits.push({ surface, needle: needle.source, index: m.index, excerpt: text.slice(Math.max(0, m.index - 100), m.index + 160) })
        if (hits.length > 200) return
      }
    }
  }
  scanText('instance.log', (() => { try { return readFileSync(instanceLog, 'utf8') } catch { return '' } })())
  // The durable FACT surface only: ledger entries. The blueprint source blob
  // also lives in team_domain.json and legitimately contains product text;
  // scanning it would be a false positive, not a "stopped" claim.
  const ledger = readDomain()?.tables?.ledger
  if (ledger !== null && typeof ledger === 'object') {
    for (const [k, v] of Object.entries(ledger)) {
      if (k === '__ledger_sequence_counter' || typeof v !== 'string') continue
      scanText(`team_domain.json#ledger/${k}`, v)
    }
  }
  let sessionFiles = []
  try {
    const sessionsDir = join(HOME, 'sessions')
    sessionFiles = readdirSync(sessionsDir).filter((n) => n.includes('session') && (n.endsWith('.json') || n.endsWith('.jsonl'))).slice(0, 20)
    for (const name of sessionFiles) scanText(`sessions/${name}`, (() => { try { return readFileSync(join(sessionsDir, name), 'utf8') } catch { return '' } })())
  } catch { /* no sessions dir */ }
  return { hits, sessionFiles }
}

// ── shared boot + L0 ───────────────────────────────────────────────────────

async function standUpWorld({ productSha }) {
  rmSync(HOME, { recursive: true, force: true })
  rmSync(BLUEPRINT_DIR, { recursive: true, force: true })
  mkdirSync(WORKSPACE, { recursive: true })
  log(`world materialized: home=${HOME}`)

  const mockLog = join(RUN_DIR, 'mock.log')
  const mock = await startMockModel({
    port: MOCK_PORT,
    decide: makeDecide(),
    log: (l) => { try { writeFileSync(mockLog, l + '\n', { flag: 'a' }) } catch { /* best-effort */ } },
  })
  log(`mock model listening on 127.0.0.1:${mock.port}`)

  const instanceLog = join(RUN_DIR, 'instance.log')
  writeFileSync(instanceLog, '', { flag: 'w' })
  const booted = await bootHost({ port: HOST_PORT, home: HOME, mockPort: mock.port, instanceLog })
  writeEvidence('run-manifest.json', {
    evidenceClass: 'CANDIDATE-C2',
    runLabel: RUN_LABEL,
    arm: ARM,
    runStamp: RUN_STAMP,
    productSha,
    productTree: WORKTREE,
    candidate: 'cand-v0.1.6-2',
    hostVersion: DSH_BASELINE_VERSION,
    hostBaselineSha: HOST_BASELINE_SHA,
    rootSessionId: ROOT,
    teamSessionId: CREATE_ROOT,
    home: HOME,
    ports: { host: booted.port, mock: mock.port },
    optIn: { alpha6ReviewRouting: true, alpha6WakeIntentPath: WAKE_DIR, planeTakeover: PLANE_TAKEOVER },
    note: 'one boot per arm run; n=2 agreement is not a stability claim',
  })

  // L0 discovery: the boot Leader's model-facing surface (needed for the
  // strict Coverage Gate deny list of the saved-source blueprint).
  const discPrompt = await apiPrompt(booted.origin, booted.cookie, ROOT, `WP1_DISC_${RUN_STAMP}`)
  const discReq = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(`WP1_DISC_${RUN_STAMP}`) && (r.body?.tools ?? []).length > 0, 120_000, 'DISC')
  if (discPrompt.status !== 200 || discReq === null) dieFatal(`discovery failed: prompt=${discPrompt.status} req=${discReq === null ? 'none' : 'ok'}`)
  const surface = (discReq.body.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t)).sort()
  const denyList = surface.filter((n) => !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n) && !TEAM_TOOL_CATALOG.includes(n))
  writeEvidence('l0-surface.json', { surface, denyList })
  log(`L0 surface ${surface.length} tools; denyList ${denyList.length} names`)
  const blueprintText = savedBlueprintYaml(BP_TEAM_ID, `You are the WP1 leader. ${MK_A}`, `You are the WP1 worker. ${MK_A_MEMBER}`, denyList)
  writeFileSync(join(BLUEPRINT_DIR, 'wp1-team.yaml'), blueprintText)
  writeEvidence('team-blueprint.yaml', blueprintText)
  return { mock, booted, instanceLog }
}

async function createTeam({ booted, initialPrompt, tag }) {
  const create = await remoteCall(booted.origin, booted.cookie, 'team.create', {
    rootSessionId: CREATE_ROOT,
    blueprintId: BP_TEAM_ID,
    initialWork: { prompt: initialPrompt },
  }, tag)
  const ok = create.status === 200 && create.body?.result?.ok === true
  writeEvidence(`team-create-${tag}.json`, create.body ?? create)
  if (!ok) dieFatal(`team.create failed: status=${create.status} body=${JSON.stringify(create.body ?? create).slice(0, 1200)}`)
  return create
}

async function officerAndWorker() {
  const deadline = Date.now() + 120_000
  for (;;) {
    const rows = readMemberRows(CREATE_ROOT)
    const officer = rows.find((r) => r.templateId === 'officer')
    const worker = rows.find((r) => r.templateId === 'worker')
    if (officer !== undefined && worker !== undefined && typeof officer.childSessionId === 'string' && typeof worker.childSessionId === 'string') {
      return { officer, worker }
    }
    if (Date.now() >= deadline) dieFatal(`officer/worker rows not bound: ${JSON.stringify(rows).slice(0, 800)}`)
    await new Promise((r) => setTimeout(r, 500))
  }
}

/** SIGKILL + cold boot on the SAME DSH_HOME (create-or-open). */
async function restartHost({ booted, mock, instanceLog }) {
  const offset = statSync(instanceLog).size
  const patchPath = join(HOME, 'profiles', 'web', 'cordis.patch.yml')
  const patchText = readFileSync(patchPath, 'utf8')
  if (!patchText.includes('bootPhase: "create-or-open"')) {
    writeFileSync(patchPath, patchText.replace('bootPhase: "create"', 'bootPhase: "create-or-open"'))
  }
  booted.host.child.kill('SIGKILL')
  const exitDeadline = Date.now() + 20_000
  while (booted.host.alive() && Date.now() < exitDeadline) await new Promise((r) => setTimeout(r, 50))
  const h2 = spawnHost({ port: booted.port, home: HOME, logPath: instanceLog, mockPort: mock.port })
  const found = await waitForBoot(instanceLog, offset, h2.alive)
  if (found === null) dieFatal(`cold boot failed after SIGKILL\n--- log tail ---\n${logTail(instanceLog)}`)
  const cookie = await authenticate(found.origin, found.token)
  // The row must be ready (recovery finished) before the next wake is driven.
  const deadline = Date.now() + 240_000
  for (;;) {
    const hb = await p6t6Health(Number(new URL(found.origin).port))
    if (hb.status === 200 && hb.body?.ok === true) break
    if (Date.now() >= deadline) dieFatal(`cold-boot row health not ready: ${JSON.stringify(hb.body).slice(0, 500)}`)
    await new Promise((r) => setTimeout(r, 1000))
  }
  await new Promise((r) => setTimeout(r, 5000))
  log(`cold boot ready at ${found.origin}`)
  return { host: h2, port: Number(new URL(found.origin).port), origin: found.origin, cookie, instanceLog }
}

// ── ARM A ──────────────────────────────────────────────────────────────────

async function runArmA({ mock, booted, instanceLog, productSha }) {
  await createTeam({ booted, initialPrompt: MK_A, tag: 'a' })
  const { officer, worker } = await officerAndWorker()
  const idleWorker = readMemberRows(CREATE_ROOT).find((row) => row.label === 'w-wp1-idle')
  if (idleWorker === undefined) dieFatal('Arm A: the pre-created idle worker is missing')
  log(`ARM A: officer instance=${officer.instanceId} session=${officer.childSessionId}; worker instance=${worker.instanceId}; idleWorker=${idleWorker.instanceId}`)

  // A1: a real review wake is dispatched. Witness = the durable intent row
  // (written by the dispatch BEFORE delivery) AND the wake turn start at the
  // mock. Both together prove a coordinator existed and a wake was delivered.
  const wakeDeadline = Date.now() + WAIT_MS
  let intentRow = null
  while (Date.now() < wakeDeadline) {
    const rows = wakeFiles()
    if (rows.length > 0) {
      intentRow = { file: rows[0], content: readJson(join(WAKE_DIR, rows[0])) }
      break
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  const wakeReq = await waitForMock(mock, (r) => lastUserTextOf(r).startsWith('[team-review-wake'), WAIT_MS, 'A wake turn')
  const latchWitnessOk = intentRow !== null && wakeReq !== null
  check('A1', 'a real review wake is dispatched for the Officer (latch coordinator exists): durable wake intent row + model-visible wake turn',
    latchWitnessOk,
    `intent=${intentRow === null ? 'none' : intentRow.file} wakeTurnSeq=${wakeReq === null ? 'none' : wakeReq.seq}`)
  if (!latchWitnessOk) {
    writeEvidence('arm-a.json', { stage: 'A1', intentRow, wakeRequests: mock.requests.filter((r) => lastUserTextOf(r).startsWith('[team-review-wake')).map((r) => r.seq) })
    return false
  }
  writeEvidence('a1-latch-witness.json', {
    intentRow,
    wakeTurn: { seq: wakeReq.seq, lastUserText: lastUserTextOf(wakeReq).slice(0, 3000), messageCount: wakeReq.body?.messages?.length ?? null },
    note: 'the intent row is written by wake-dispatch as part of the dispatch that registers the coordinator in alpha6WakeBySession (root.ts:2587-2620); the wake turn proves delivery',
  })
  const wakesBefore = wakeStartCount(mock.requests)

  // A2: the HUMAN Stop through the production channel.
  const cancel = await apiCancel(booted.origin, booted.cookie, officer.childSessionId, 'wp1a')
  log(`ARM A: session/cancel officer -> HTTP ${cancel.status} ok=${String(cancel.body?.result?.ok)}`)

  // A3: the durable marker.
  const markerDeadline = Date.now() + 60_000
  while (Date.now() < markerDeadline && stoppedFiles().length === 0) await new Promise((r) => setTimeout(r, 250))
  const stopped = stoppedFiles()
  const markerFile = stopped[0] ?? null
  const marker = markerFile === null ? null : readJson(join(WAKE_DIR, markerFile))
  const markerPathOk = marker !== null && markerFile === expectedMarkerName(marker)
  const markerKeyMatches = marker !== null
    && marker.key?.rootSessionId === CREATE_ROOT
    && marker.key?.reviewerInstanceId === officer.instanceId
    && marker.key?.sessionGeneration === 1
  // ownerRootSessionId is the MOUNT root that wrote the marker (the boot root),
  // not the created Team root: markStopped(key, targetSessionId, rootSid) passes
  // the plugin instance's root session (root.ts:2770). Documented here, not guessed.
  const markerContentOk = marker !== null && marker.stopped === true && marker.targetSessionId === officer.childSessionId && marker.ownerRootSessionId === ROOT
  const cancelOk = cancel.status === 200 && cancel.body?.result?.ok === true
  const a3ok = cancelOk && stopped.length === 1 && markerPathOk && markerKeyMatches && markerContentOk
  check('A3', 'the human Stop writes exactly one durable latch-scoped marker at the documented path with the documented content (function `true` inferred: the only `false` path returns before any write)',
    a3ok,
    `cancel=${String(cancelOk)} markers=[${stopped.join(',')}] pathOk=${String(markerPathOk)} keyOk=${String(markerKeyMatches)} contentOk=${String(markerContentOk)}`)
  writeEvidence('a3-marker.json', {
    cancel: cancel.body ?? cancel,
    markerFile,
    markerPath: markerFile === null ? null : join(WAKE_DIR, markerFile),
    marker,
    expectedName: marker === null ? null : expectedMarkerName(marker),
    wakeIntentRows: wakeFiles(),
    wakesBefore,
    returnValue: { observed: 'inferred-true', why: 'production discards the boolean (host.ts:3113-3120); root.ts:2755-2762 returns false only when no coordinator exists, BEFORE markStopped writes. The marker exists, so that branch was not taken; every post-write path returns true.' },
  })
  if (!a3ok) return false

  // A5 (relay resistance, while the stopped reviewer session is live).
  const wakesBeforeRelay = wakeStartCount(mock.requests)
  const relay = await remoteCall(booted.origin, booted.cookie, 'member.send', {
    teamSessionId: CREATE_ROOT,
    caller: { kind: 'instance', instanceId: 'inst-leader' },
    recipientInstanceId: officer.instanceId,
    body: RELAY_TEXT,
    requestToken: `wp1-relay-${String(Date.now())}`,
  }, 'wp1relay', 4)
  await new Promise((r) => setTimeout(r, 8000))
  const markersAfterRelay = stoppedFiles()
  const wakesAfterRelay = wakeStartCount(mock.requests)
  const relayClaimed = mock.requests.some((r) => lastUserTextOf(r).includes(RELAY_TEXT))
  const relayOutcome = relay.body?.result?.value?.data?.outcome?.status ?? null
  // "Resistance" here is scoped: the TEAM LAYER accepts the relay (it reports
  // `delivered`), but the message does not clear the marker and does not
  // re-deliver the withdrawn REVIEW wake. Measured, not assumed.
  const relayOk = relay.status === 200 && relay.body?.result?.ok === true && relayOutcome === 'delivered'
    && markersAfterRelay.length === 1 && wakesAfterRelay === wakesBeforeRelay
  check('A5a', 'a machine `team_send_message` (member.send, caller instance = Leader) does NOT clear the human Sticky Stop and does NOT re-deliver the withdrawn review wake (the message itself is still delivered by the team layer)',
    relayOk,
    `relayStatus=${String(relay.status)} relayOutcome=${String(relayOutcome)} modelSawRelay=${String(relayClaimed)} markers=[${markersAfterRelay.join(',')}] wakes=${String(wakesBeforeRelay)}->${String(wakesAfterRelay)}`)
  const work = await remoteCall(booted.origin, booted.cookie, 'member.followup', {
    teamSessionId: CREATE_ROOT,
    caller: { kind: 'instance', instanceId: 'inst-leader' },
    targetInstanceId: officer.instanceId,
    requestToken: `wp1-work-${String(Date.now())}`,
    payload: { prompt: WORK_TEXT },
  }, 'wp1work', 4)
  await new Promise((r) => setTimeout(r, 8000))
  const markersAfterWork = stoppedFiles()
  const wakesAfterWork = wakeStartCount(mock.requests)
  const workClaimed = mock.requests.some((r) => lastUserTextOf(r).includes(WORK_TEXT))
  const workOutcome = work.body?.result?.value?.data?.outcome?.status ?? null
  // Same scoping: the work unit is ADMITTED by the team layer; it still does
  // not clear the marker and the stopped latch still suppresses review wakes.
  const workOk = work.status === 200 && work.body?.result?.ok === true && workOutcome === 'executed'
    && markersAfterWork.length === 1 && wakesAfterWork === wakesBeforeRelay
  check('A5b', 'a machine WORK delivery (member.followup) does NOT clear the Stop and does NOT re-deliver the withdrawn review wake (the work unit is still admitted by the team layer)',
    workOk,
    `followupStatus=${String(work.status)} workOutcome=${String(workOutcome)} modelSawWork=${String(workClaimed)} markers=[${markersAfterWork.join(',')}] wakes=${String(wakesBeforeRelay)}->${String(wakesAfterWork)}`)
  writeEvidence('a5-relay-resistance.json', {
    relay: { status: relay.status, outcome: relayOutcome, modelSawRelay: relayClaimed, body: relay.body ?? null },
    work: { status: work.status, outcome: workOutcome, modelSawWork: workClaimed, body: work.body ?? null },
    markersAfterRelay, markersAfterWork, wakesBeforeRelay, wakesAfterRelay, wakesAfterWork,
    scope: 'resistance = the marker persists and the withdrawn REVIEW wake is not re-delivered; the team layer still delivers/admits the machine message/work (observed, not assumed)',
  })

  // A4: SIGKILL + cold boot; the marker survives and is still consulted.
  const markerBytesBefore = readFileSync(join(WAKE_DIR, markerFile), 'utf8')
  const wakesBeforeRestart = wakeStartCount(mock.requests)
  const booted2 = await restartHost({ booted, mock, instanceLog })
  const stoppedAfterRestart = stoppedFiles()
  const markerSurvives = stoppedAfterRestart.length === 1
    && stoppedAfterRestart[0] === markerFile
    && readFileSync(join(WAKE_DIR, stoppedAfterRestart[0]), 'utf8') === markerBytesBefore
  const wakesAtRestart = wakeStartCount(mock.requests)
  check('A4a', 'the Sticky Stop marker survives SIGKILL + cold boot byte-identical and is not re-delivered at boot',
    markerSurvives && wakesAtRestart === wakesBeforeRestart,
    `markers=[${stoppedAfterRestart.join(',')}] wakes=${String(wakesBeforeRestart)}->${String(wakesAtRestart)}`)

  // Consultation: drive a NEW review ask for the SAME reviewer and observe the
  // recovered (stopped) latch suppressing the wake. Boot recovery registers
  // the marker's latch as stopped (root.ts:2936-2952).
  //
  // The ask must be minted by a path that does not depend on the stopped
  // reviewer accepting machine work: the Leader creates a SECOND worker and
  // delegates an ordinary bash unit to it. The resulting review leg names the
  // SAME Officer, hence the SAME recovered latch key.
  //
  // A Team-managed root cannot be prompted directly after boot (the host
  // refuses foreign Agent activation: TeamSessionActivationInterceptedError,
  // measured), so the ask is a HUMAN work delivery to the WORKER — the human
  // channel production exposes. The officer stays stopped throughout.
  //
  // The worker's pre-kill turn resumes at boot; give it time to settle, then
  // deliver a NEW work unit (a new prompt text) so a FRESH bash ask is made.
  const seqAtRestart = mock.requests.length
  await new Promise((r) => setTimeout(r, 20_000))
  const legsBefore = readControlLedger(CREATE_ROOT).requests.length
  // FIRE-AND-FORGET: member.followup is synchronous and settles only with the
  // member result; here the member's decision wait is (correctly) held by the
  // stopped reviewer, so the HTTP call never settles. The work is admitted
  // regardless — witnessed by the worker's bash ask and the new durable legs.
  const nextAskPromise = remoteCall(booted2.origin, booted2.cookie, 'member.followup', {
    teamSessionId: CREATE_ROOT,
    caller: { kind: 'human', humanId: CREATE_ROOT },
    targetInstanceId: idleWorker.instanceId,
    requestToken: `wp1-postboot-work-${String(Date.now())}`,
    payload: { prompt: MK_A_MEMBER2 },
  }, 'wp1postboot', 4).catch((error) => ({ status: 0, body: null, error: String(error) }))
  const workSeen = await waitForMock(mock, (r) => r.seq > seqAtRestart && lastUserTextOf(r).includes(MK_A_MEMBER2), 120_000, 'A post-boot worker ask')
  const nextAsk = await Promise.race([
    nextAskPromise,
    new Promise((resolve) => setTimeout(() => resolve({ status: -1, body: { pending: true } }), 1000)),
  ])
  writeEvidence('a4-postboot-work.json', { followup: nextAsk, workerAskSeen: workSeen !== null, seq: workSeen?.seq ?? null })
  const postDeadline = Date.now() + 120_000
  let ledgerAfter = readControlLedger(CREATE_ROOT)
  while (Date.now() < postDeadline) {
    ledgerAfter = readControlLedger(CREATE_ROOT)
    if (ledgerAfter.requests.length > legsBefore) break
    await new Promise((r) => setTimeout(r, 500))
  }
  await new Promise((r) => setTimeout(r, 10_000))
  const stoppedAfterWakeAttempt = stoppedFiles()
  const wakesAfterWakeAttempt = wakeStartCount(mock.requests)
  const wakeSuppressed = wakesAfterWakeAttempt === wakesAtRestart && stoppedAfterWakeAttempt.length === 1
  const newLegObserved = ledgerAfter.requests.length > legsBefore
  check('A4b', 'after cold boot a NEW review leg for the SAME reviewer is suppressed (no new wake turn) — the recovered marker is consulted',
    wakeSuppressed && newLegObserved,
    `humanWork=${String(nextAsk.status)} workerAsk=${String(workSeen !== null)} legActions=[${ledgerAfter.requests.map((r) => r.actionName).join(',')}] legs=${String(legsBefore)}->${String(ledgerAfter.requests.length)} markers=[${stoppedAfterWakeAttempt.join(',')}] wakes=${String(wakesAtRestart)}->${String(wakesAfterWakeAttempt)}`)
  writeEvidence('a4-cold-boot.json', {
    markerBytesBefore,
    markerSurvives,
    wakesBeforeRestart,
    wakesAtRestart,
    humanWork: nextAsk.body ?? nextAsk,
    workerAskSeq: workSeen?.seq ?? null,
    legsBefore,
    legActions: ledgerAfter.requests.map((r) => r.actionName),
    controlRequests: ledgerAfter.requests,
    stoppedAfterWakeAttempt,
    wakesAfterWakeAttempt,
    consultationWitness: 'a new durable review leg exists but no new [team-review-wake] turn reached the model; the marker was not cleared; dispatch skips a stopped coordinator (wake-dispatch.ts:351) and boot recovery registered the marker latch as stopped (root.ts:2936-2952)',
  })
  writeEvidence('arm-a.json', { criteria: criteria.filter((c) => c.id.startsWith('A')), productSha, home: HOME })
  return a3ok && relayOk && workOk && markerSurvives && wakeSuppressed && newLegObserved
}

// ── ARM B ──────────────────────────────────────────────────────────────────

async function runArmB({ mock, booted, instanceLog, productSha }) {
  await createTeam({ booted, initialPrompt: MK_B, tag: 'b' })
  const { officer, worker } = await officerAndWorker()
  // Warm-up: the leader's chain delegates a text-only unit to the worker so
  // its child session has settled once before the later followup. No ask, no
  // wake, no control row is created by this unit.
  const warm = await waitForMock(mock, (r) => lastUserTextOf(r).includes(MK_B_WARM) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'WP1_B_WARM_DONE', 120_000, 'B warm-up')
  if (warm === null) dieFatal('Arm B warm-up worker turn did not complete')
  await new Promise((r) => setTimeout(r, 4000))
  log('ARM B: worker warmed with one text-only work unit (no ask, no wake)')
  log(`ARM B: officer instance=${officer.instanceId} session=${officer.childSessionId}; worker instance=${worker.instanceId}`)

  // B1: prove NO coordinator exists: no intent row, no stopped marker, no
  // review-wake turn, and no control request routed for review.
  const ledger = readControlLedger(CREATE_ROOT)
  const noLatch = wakeFiles().length === 0 && stoppedFiles().length === 0
    && wakeStartCount(mock.requests) === 0 && ledger.requests.length === 0
  check('B1', 'no review wake was dispatched and no intent/stopped row exists: no wake coordinator for the Officer (documented-unsupported path)',
    noLatch,
    `wakeRows=[${wakeFiles().join(',')}] stopped=[${stoppedFiles().join(',')}] wakeTurns=${String(wakeStartCount(mock.requests))} controlRequests=${String(ledger.requests.length)}`)
  writeEvidence('b1-no-latch.json', { wakeRows: wakeFiles(), stopped: stoppedFiles(), wakeTurns: wakeStartCount(mock.requests), ledger, memberRows: readMemberRows(CREATE_ROOT) })
  if (!noLatch) return false

  // B2: a live Officer turn, then the SAME production human Stop.
  const prompt = await apiPrompt(booted.origin, booted.cookie, officer.childSessionId, HOLD_TEXT)
  const holdReq = await waitForMock(mock, (r) => lastUserTextOf(r).includes(HOLD_TEXT), 60_000, 'B officer hold turn')
  await new Promise((r) => setTimeout(r, 2000))
  const cancel = await apiCancel(booted.origin, booted.cookie, officer.childSessionId, 'wp1b')
  await new Promise((r) => setTimeout(r, 5000))
  const cancelOk = prompt.status === 200 && holdReq !== null && cancel.status === 200 && cancel.body?.result?.ok === true
  log(`ARM B: officer turn started=${String(holdReq !== null)}; session/cancel -> HTTP ${cancel.status} ok=${String(cancel.body?.result?.ok)}`)

  // B3: no marker, no durable "stopped" claim.
  const stoppedNow = stoppedFiles()
  const claims = scanStopClaims(instanceLog)
  const markerAbsent = stoppedNow.length === 0 && wakeFiles().length === 0
  const noClaim = claims.hits.length === 0
  const b3ok = cancelOk && markerAbsent
  check('B3', 'the same human Stop on a session with NO latch returns false / writes NO marker: no durable protection is created (false inferred from the coordinator-undefined branch + absent marker)',
    b3ok,
    `cancel=${String(cancelOk)} markers=[${stoppedNow.join(',')}] wakeRows=[${wakeFiles().join(',')}]`)
  check('B3b', 'nothing on the no-latch path CLAIMS durable protection: no fact, log line or UI state asserting "stopped"',
    noClaim,
    `hits=${String(claims.hits.length)}${claims.hits.length === 0 ? '' : ` first=${JSON.stringify(claims.hits[0]).slice(0, 400)}`}`)
  writeEvidence('b3-no-marker.json', {
    prompt: prompt.body ?? prompt,
    holdTurnSeq: holdReq === null ? null : holdReq.seq,
    cancel: cancel.body ?? cancel,
    markers: stoppedNow,
    wakeRows: wakeFiles(),
    returnValue: { observed: 'inferred-false', why: 'root.ts:2755-2762 returns false when alpha6WakeBySession has no coordinator for the target session, before markStopped; production discards the boolean (host.ts:3113-3120). No marker exists.' },
    stopClaims: claims,
  })

  // B4: the next review wake activates the reviewer — observed, not inferred.
  // The disclosed no-latch path leaves NOTHING durable to resume. Re-engage
  // the reviewer with one ordinary human turn (the post-Stop human move), then
  // drive the next review ask. Nothing is cleared here — there is no marker.
  const reengage = await apiPrompt(booted.origin, booted.cookie, officer.childSessionId, MK_B_REENGAGE)
  const reengageSeen = await waitForMock(mock, (r) => lastUserTextOf(r).includes(MK_B_REENGAGE), 60_000, 'B re-engage')
  if (reengageSeen === null) dieFatal('Arm B: the post-Stop human re-engagement turn did not start')
  log(`ARM B: reviewer re-engaged by one human turn (status=${String(reengage.status)}); no marker existed to clear`)

  const wakesBefore = wakeStartCount(mock.requests)
  // The next review ask is driven through the Leader (production delegation),
  // which is how review work actually reaches the reviewer.
  // The created Team root, not the boot root: the model-facing Team tools
  // derive the CALLER root from the session, so prompting the boot root would
  // make every team_* call a TEAM_TOOL_CALLER_ROOT_MISMATCH (measured).
  const follow = await apiPrompt(booted.origin, booted.cookie, CREATE_ROOT, MK_B_NEXT, 'wp1bnext')
  const wakeReq = await waitForMock(mock, (r) => lastUserTextOf(r).startsWith('[team-review-wake'), 180_000, 'B next wake')
  const wakesAfter = wakeStartCount(mock.requests)
  const ledgerAfter = readControlLedger(CREATE_ROOT)
  const activated = follow.status === 200 && wakeReq !== null && wakesAfter > wakesBefore
  check('B4', 'after the no-latch Stop and one ordinary human re-engagement turn, the next review wake ACTIVATES the reviewer: a new [team-review-wake] turn starts at the model, with no marker anywhere',
    activated,
    `leaderPrompt=${String(follow.status)} wakeSeq=${wakeReq === null ? 'none' : wakeReq.seq} wakes=${String(wakesBefore)}->${String(wakesAfter)} wakeIds=[${[...wakeIds(mock.requests)].join(',')}] newLegs=${String(ledgerAfter.requests.length)} markers=[${stoppedFiles().join(',')}]`)
  writeEvidence('b4-next-wake.json', {
    leaderPrompt: follow.body ?? follow,
    wakeSeq: wakeReq === null ? null : wakeReq.seq,
    wakeText: wakeReq === null ? null : lastUserTextOf(wakeReq).slice(0, 3000),
    wakesBefore,
    wakesAfter,
    controlRequests: ledgerAfter.requests,
    markersAfter: stoppedFiles(),
    note: 'the disclosed limit, observed: after ONE ordinary human turn (nothing durable existed to clear), the next review ask wakes the reviewer a human had "stopped"',
  })
  writeEvidence('arm-b.json', { criteria: criteria.filter((c) => c.id.startsWith('B')), productSha, home: HOME })
  return b3ok && noClaim && activated
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  rmSync(RUN_LOG, { force: true })
  log(`WP1 sticky stop — arm ${ARM.toUpperCase()} — run ${RUN_LABEL} — stamp ${RUN_STAMP}`)
  log(`worktree=${WORKTREE}`)
  log(`testuse=${TESTUSE} @ ${HOST_BASELINE_SHA.slice(0, 10)}`)
  log(`evidence=${RUN_DIR}`)

  const productSha = preflight()
  if (!(await portFree(HOST_PORT))) dieFatal(`host port ${HOST_PORT} busy`)
  if (!(await portFree(MOCK_PORT))) dieFatal(`mock port ${MOCK_PORT} busy`)
  log(`ports: host=${HOST_PORT} mock=${MOCK_PORT}`)

  const preStable = { p3080: await probeStableInstance('http://127.0.0.1:3080/') }
  writeEvidence('pre-stable-probe.json', preStable)
  log(`stable :3080 pre-probe = ${preStable.p3080.status} (read-only; never touched)`)

  const { mock, booted, instanceLog } = await standUpWorld({ productSha })
  let ok = false
  try {
    ok = ARM_A
      ? await runArmA({ mock, booted, instanceLog, productSha })
      : await runArmB({ mock, booted, instanceLog, productSha })
  } catch (error) {
    log(`FATAL arm ${ARM} threw: ${String(error?.stack ?? error)}`)
    ok = false
  } finally {
    stopHost(booted.host)
    await mock.close()
    const postStable = { p3080: await probeStableInstance('http://127.0.0.1:3080/') }
    writeEvidence('post-stable-probe.json', postStable)
    if (!FLAG_KEEP) {
      rmSync(HOME, { recursive: true, force: true })
      rmSync(BLUEPRINT_DIR, { recursive: true, force: true })
      log('world torn down (home + blueprint scratch removed)')
    } else {
      log(`--keep: home retained at ${HOME}; blueprint scratch at ${BLUEPRINT_DIR}`)
    }
    const summary = {
      runLabel: RUN_LABEL,
      arm: ARM,
      evidenceClass: 'CANDIDATE-C2',
      runStamp: RUN_STAMP,
      productSha,
      ok,
      criteria,
      homeRetained: FLAG_KEEP ? HOME : null,
      note: 'n=2 per arm is agreement, not stability',
    }
    writeEvidence('summary.json', summary)
    log(`SUMMARY arm=${ARM.toUpperCase()} run=${RUN_LABEL} ok=${String(ok)} pass=${criteria.filter((c) => c.ok).length}/${criteria.length}`)
  }
  process.exit(ok ? 0 : 2)
}

main().catch((error) => dieFatal(String(error?.stack ?? error)))
