#!/usr/bin/env node
/**
 * exec-contract live smoke (PR #19 production live verification).
 *
 * The user ruling 2026-09-19 (PR #19 review): on a REAL rc.2 host, run
 * three live cases over the production row (worktree dist glue — the
 * PR branch build), with NO new architecture, NO dual-gate design
 * change, NO C2 expansion, NO full-smoke redo:
 *
 *   L1  dual gate OPEN (leader `permissions.allow` bash/any AND the
 *       bound blueprint's teamEnvelope carries the `bash` exec token):
 *       `bash: echo marker > file` executes DIRECTLY — the side effect
 *       lands and the durable control ledger records ZERO user-approval
 *       requests (the real bound-blueprint token reaches the listener).
 *
 *   L2  gate 1 open, gate 2 CLOSED (same allow lane; the teamEnvelope
 *       omits `bash` but STILL admits `request-control` — the review's
 *       explicit trap: a missing request must not be misread as a
 *       dual-gate pass): the bash call does NOT execute immediately; a
 *       durable `user-approval` request (human-only resolver closure) is
 *       created; the marker file is ABSENT until the human allows
 *       (scripted through the production `team.resolveControl` v4
 *       channel, the cookie-derived human principal); after the allow
 *       the exec runs and the file appears.
 *
 *   L3  external hard deny (both gates open, as L1, but the host's
 *       external hard policy denies the `tools` cell): the static-allow
 *       last-mile recheck (A2C-4) refuses — the bash does NOT execute
 *       even though both gates pass; zero side effect; NO control row
 *       (a recheck denial is a zero-effect deny).
 *
 * Topology: two single-purpose worlds (the external hard facts are a
 * plugin-level host ceiling — L1+L2 share the no-ceiling world A; L3
 * gets the hard-deny world B):
 *
 *   world A (no external ceiling) → team L1 → team L2
 *   world B (hard tools deny)     → team L3
 *
 * The leader's exec calls are driven by the mock model oracle (marker
 * routing over the last trigger-bearing user message; the boot turn is
 * the scenario's `initialWork` prompt). All authority paths are the
 * production ones: pre-execute adapter (dual gate + A2C-4 recheck),
 * durable control plane, `team.resolveControl` v4 human ingress.
 *
 * Kit invariants (C1 discipline): the test-use checkout must be the
 * pristine rc.2 baseline; the mock model is the only model; worlds are
 * scratch DSH_HOMEs under tests/homes/ (self-cleaned unless --keep);
 * the stable dev instances (:3080 / :3180) are probed 401 before and
 * after and never touched.
 *
 * CLI:
 *   node tests/kits/exec-contract-live-smoke/exec-contract-live-smoke.mjs \
 *     [--worktree <path>] [--testuse <path>] [--mock-port N] \
 *     [--evidence-dir <path>] [--keep]
 *
 * EXIT: 0 = all criteria pass; 2 = a criterion failed (full evidence
 * dump in the evidence dir); 1 = fatal (environment/boot/row).
 */

import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
import { anchorBlueprintYaml, scenarioBlueprintYaml, teamEnvelopeAllow } from './blueprint.mjs'

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
const MOCK_PORT = Number(argValue('mock-port', 3516))
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

const SMOKE_PRESET_ID = 'exec-live-smoke'
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
  'team_list_pending_control',
]

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').replace('T', 'T').slice(0, 19)
const RUN_DIR = EVIDENCE_DIR_ARG
  ? resolve(EVIDENCE_DIR_ARG)
  : join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'exec-contract', 'live-smoke', `exec-live-${RUN_STAMP}`)
const HOME_A = join(WORKTREE, 'tests', 'homes', `exec-live-${RUN_STAMP}-a`)
const HOME_B = join(WORKTREE, 'tests', 'homes', `exec-live-${RUN_STAMP}-b`)
const WORKSPACE_A = join(HOME_A, 'workspace')
const WORKSPACE_B = join(HOME_B, 'workspace')
const BLUEPRINT_DIR = join(WORKTREE, `.exec-live-smoke-blueprints-${RUN_STAMP}`)

const ROOT_A = `session-exec-live-root-a-${RUN_STAMP}`
const ROOT_B = `session-exec-live-root-b-${RUN_STAMP}`
const CREATE_ROOT_L1 = `session-exec-live-l1-${RUN_STAMP}`
const CREATE_ROOT_L2 = `session-exec-live-l2-${RUN_STAMP}`
const CREATE_ROOT_L3 = `session-exec-live-l3-${RUN_STAMP}`
const BP_ANCHOR_A_ID = 'team.exec-anchor-a'
const BP_ANCHOR_B_ID = 'team.exec-anchor-b'
const BP_L1_ID = 'team.exec-l1'
const BP_L2_ID = 'team.exec-l2'
const BP_L3_ID = 'team.exec-l3'

// Distinct markers (no substring collisions).
const MK_DISC_A = `EXECLIVE_DISC_A_${RUN_STAMP}`
const MK_DISC_B = `EXECLIVE_DISC_B_${RUN_STAMP}`
const MK_L1 = `EXECLIVE_L1_${RUN_STAMP}`
const MK_L2 = `EXECLIVE_L2_${RUN_STAMP}`
const MK_L3 = `EXECLIVE_L3_${RUN_STAMP}`

// Scenario side-effect files (ABSOLUTE paths — cwd-robust) + commands
// that both WRITE the marker file and PRINT an executed marker (so the
// executed branch is distinguishable in the tool result).
const FILE_L1 = join(WORKSPACE_A, `exec-l1-${RUN_STAMP}.txt`)
const FILE_L2 = join(WORKSPACE_A, `exec-l2-${RUN_STAMP}.txt`)
const FILE_L3 = join(WORKSPACE_B, `exec-l3-${RUN_STAMP}.txt`)
const SUM_L1 = `exec-l1-${RUN_STAMP}`
const SUM_L2 = `exec-l2-${RUN_STAMP}`
const SUM_L3 = `exec-l3-${RUN_STAMP}`
const CMD_L1 = `echo ${SUM_L1} > ${FILE_L1} && echo l1-executed`
const CMD_L2 = `echo ${SUM_L2} > ${FILE_L2} && echo l2-executed`
const CMD_L3 = `echo ${SUM_L3} > ${FILE_L3} && echo l3-executed`

// The external hard facts per world (the plugin-level host ceiling):
//   A = no ceiling (L1 + L2 live here);
//   B = hard deny of the `tools` cell (L3 — invariant 34: no Team
//       decision, human included, bypasses it).
const FACTS_NONE = { hard: {}, capabilityExists: {} }
const FACTS_TOOLS_DENY = { hard: { tools: { kind: 'deny' } }, capabilityExists: {} }

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

// ── small http helpers (C1 kit shape) ───────────────────────────────────────

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
async function remoteCall(origin, cookie, method, params, tag = 'xl', version = 1) {
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
async function apiPrompt(origin, cookie, sessionId, text, tag = 'xl') {
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
  for (const p of [3511, 3512, 3513, 3514, 3515, 3517, 3518, 3519]) {
    if (await portFree(p)) return p
  }
  dieFatal('no free host port in 3511-3519')
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

function teamRowConfig({ rootId, anchorId, hardFacts }) {
  return {
    rootSessionId: rootId,
    bootPhase: 'create',
    blueprintSource: anchorBlueprintYaml(anchorId, 'You are the leader of the exec-contract live smoke boot team. The discovery prompt carries its own marker.'),
    blueprintDir: BLUEPRINT_DIR,
    rootPresetId: SMOKE_PRESET_ID,
    memberPresetId: SMOKE_PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'exec-live-smoke-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: hardFacts,
    glueUrl: GLUE_URL,
    seamUrl: SEAM_URL,
  }
}

function writeSmokePreset(home) {
  const dir = join(home, '.agent-presets', SMOKE_PRESET_ID)
  mkdirSync(dir, { recursive: true })
  const text = [
    `# ${SMOKE_PRESET_ID} — exec-contract live smoke preset (run ${RUN_STAMP}).`,
    '# Reused from the C1 kit (public user-preset seam): persona +',
    '# dsh-tool-fs + the minimal-style persistent shell group (the bash',
    '# stack — the LEADER exec surface the dual gate governs). NO',
    '# delegation group (same rc2 constraint as C1).',
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

/** The p6t6 observability row's boot directive (required at the DSH_HOME
 *  root before the host boots — the row reads it during setup). */
function writeP6t6Directive(home, rootId) {
  writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
    boot: 1,
    phase: 'create',
    reportDir: RUN_DIR,
    runStamp: RUN_STAMP,
    rootSessionId: rootId,
  }, null, 2))
}

function writePatchFile(home, { rootId, anchorId, hardFacts, note }) {
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const lines = [
    `# exec-contract live smoke patch layer (run ${RUN_STAMP}, ${note}): production dsh-agent-team row (worktree dist — the PR branch build) + p6t6 observability row — mounted ONLY through the public profile-patch seam.`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig({ rootId, anchorId, hardFacts }) }, 2),
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
        cwd: home,
        stdio: ['ignore', outFd, errFd],
        env: {
          ...process.env,
          DSH_HOME: home,
          DSH_CLIENT_COMMIT_HASH: 'fb2c4b9e69',
          DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
          DEEPSEEK_API_KEY: 'exec-live-smoke-mock-key',
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
    if (h !== null && h.alive()) h.child.kill('SIGTERM')
  } catch { /* best-effort */ }
}

async function bootHost({ port, home, mockPort, instanceLog }) {
  const h = spawnHost({ port, home, logPath: instanceLog, mockPort })
  const bootLine = await waitForLogLine(instanceLog, BOOT_MARKER, 240_000, h.alive)
  if (bootLine === null) {
    stopHost(h)
    dieFatal(`boot marker not found in 240s\n--- log tail ---\n${logTail(instanceLog)}`)
  }
  const m = BOOT_MARKER.exec(bootLine)
  const origin = `http://127.0.0.1:${m[1]}`
  const cookie = await authenticate(origin, /token=([A-Za-z0-9_-]+)/.exec(bootLine)?.[1] ?? '')
  let health = null
  const healthDeadline = Date.now() + 240_000
  for (;;) {
    const hb = await p6t6Health(Number(m[1]))
    health = { status: hb.status, body: hb.body }
    if (hb.status === 200 && hb.body?.ok === true) break
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      stopHost(h)
      dieFatal(`row setup failed — setupError: ${String(hb.body.setupError).slice(0, 600)}\n--- log tail ---\n${logTail(instanceLog)}`)
    }
    if (Date.now() >= healthDeadline) {
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
      && b.phase === 'create' && b.teamSession !== null && typeof b.teamSession === 'object') break
    if (Date.now() >= sDeadline) {
      stopHost(h)
      dieFatal(`row state not well-formed in 90s; last: status=${s.status} body=${JSON.stringify(s.body).slice(0, 400)}`)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  const bootedRoot = state.body?.rootSessionId ?? null
  log(`host booted at ${origin} (root=${bootedRoot}); row ready — toolCount=${health.body?.toolCount}`)
  return { host: h, port: Number(m[1]), origin, cookie, instanceLog, health, stateBody: state.body }
}

// ── mock decide policy (the oracle) ─────────────────────────────────────────

function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-xl-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}

function bodyOf(recordOrBody) {
  if (recordOrBody === null || typeof recordOrBody !== 'object') return null
  return 'body' in recordOrBody ? (recordOrBody.body ?? null) : recordOrBody
}

function messagesOf(req) {
  return bodyOf(req)?.messages ?? []
}

function userTextOf(req) {
  return messagesOf(req)
    .filter((m) => m.role === 'user')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
    .join('\n')
}

/** The LAST user message containing a chain trigger (a marker). The
 *  `[A-Z0-9_]+` segment class includes the underscore (two-segment
 *  markers: DISC_A / DISC_B — C1 trigger-regex convention). */
const TRIGGER_RE = /EXECLIVE_[A-Z0-9_]+_[0-9T:-]+/
function lastTriggerIndex(req) {
  const messages = messagesOf(req)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m.role !== 'user') continue
    const t = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
    if (TRIGGER_RE.test(t)) return i
  }
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return i
  }
  return -1
}

function lastUserTextOf(req) {
  const messages = messagesOf(req)
  const i = lastTriggerIndex(req)
  if (i === -1) return ''
  const last = messages[i]
  return typeof last.content === 'string' ? last.content : JSON.stringify(last.content ?? '')
}

/** The tool messages AFTER the chain trigger (chain progress). */
function toolMsgsOf(req) {
  const messages = messagesOf(req)
  const i = lastTriggerIndex(req)
  return messages.slice(i + 1).filter((m) => m.role === 'tool')
}

/** The last tool message content after the trigger (the bash result). */
function bashResultOf(req) {
  const tools = toolMsgsOf(req)
  const last = tools[tools.length - 1]
  if (last === undefined) return ''
  return typeof last.content === 'string' ? last.content : JSON.stringify(last.content ?? '')
}

/**
 * The oracle. Per-scenario chains (each scenario team is its OWN session —
 * one marker, one bash):
 *
 *   discovery (per boot root)      → text (the surface is captured from
 *                                    the model request itself)
 *   L1/L2/L3 leader chain:
 *     0 tool results → bash tool call (the scenario command)
 *     ≥1 tool result → the scenario DONE text (the turn completes)
 */
function makeDecide() {
  return function decide({ req }) {
    const firstMsg = messagesOf(req)[0]
    if (typeof firstMsg?.content === 'string' && firstMsg.content.startsWith('Create a concise title')) {
      return { kind: 'text', content: 'exec-contract live smoke session' }
    }
    const lastUser = lastUserTextOf(req)
    const tools = toolMsgsOf(req).length

    if (lastUser.includes(MK_DISC_A)) return { kind: 'text', content: 'EXECLIVE_DISC_A_DONE' }
    if (lastUser.includes(MK_DISC_B)) return { kind: 'text', content: 'EXECLIVE_DISC_B_DONE' }

    if (lastUser.includes(MK_L1)) {
      switch (tools) {
        case 0: return toolCall('bash', { command: CMD_L1, timeoutMs: 30000 })
        default: return { kind: 'text', content: `EXECLIVE_L1_DONE tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_L2)) {
      switch (tools) {
        case 0: return toolCall('bash', { command: CMD_L2, timeoutMs: 30000 })
        default: return { kind: 'text', content: `EXECLIVE_L2_DONE tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_L3)) {
      switch (tools) {
        case 0: return toolCall('bash', { command: CMD_L3, timeoutMs: 30000 })
        default: return { kind: 'text', content: `EXECLIVE_L3_DONE tools=${tools}` }
      }
    }
    return { kind: 'text', content: 'EXECLIVE_NOOP_DONE' }
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

// ── durable control ledger (read-only) ──────────────────────────────────────

function readControlLedger(home, root) {
  const out = { requests: [], decisions: [], consumptions: [], error: null }
  try {
    const parsed = JSON.parse(readFileSync(join(home, 'storages', 'team_domain.json'), 'utf8'))
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

/**
 * Poll the durable ledger until a `user-approval` request for the root
 * appears (the L2 downgrade row — created by requestControl BEFORE the
 * adapter awaits the decision, so its presence pins the pre-approval
 * moment).
 */
async function waitForUserApprovalRequest(home, root, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const ledger = readControlLedger(home, root)
    const req = ledger.requests.find((q) => q.kind === 'user-approval')
    if (req !== undefined) return { ledger, req }
    if (Date.now() >= deadline) return { ledger, req: undefined }
    await new Promise((r) => setTimeout(r, 500))
  }
}

/**
 * One scenario boot: world materialization is done by the caller; this
 * boots the host, runs the boot-root discovery (L0), and returns the
 * booted host + the live-surface deny list (the strict Coverage Gate
 * convention: deny everything non-managed, non-safe, non-team).
 */
async function bootAndDiscover({ tag, home, port, mockPort, discMarker, doneText, instanceLog }) {
  const booted = await bootHost({ port, home, mockPort, instanceLog })
  const discPrompt = await apiPrompt(booted.origin, booted.cookie, booted.stateBody.rootSessionId, discMarker, `xl${tag}disc`)
  if (discPrompt.status !== 200) {
    stopHost(booted.host)
    dieFatal(`L0(${tag}) apiPrompt failed: status=${discPrompt.status} body=${JSON.stringify(discPrompt.body).slice(0, 300)}`)
  }
  const discReq = await waitForMock(mockRef.mock, (r) => r.body !== null && userTextOf(r).includes(discMarker) && (r.body?.tools ?? []).length > 0, 120_000, `L0(${tag}) model request`)
  if (discReq === null) {
    stopHost(booted.host)
    dieFatal(`L0(${tag}) diagnostic abort: the DISC request was never observed (apiPrompt=${JSON.stringify(discPrompt.body).slice(0, 300)})`)
  }
  const surface = (discReq.body.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t)).sort()
  writeEvidence(`l0-${tag}-surface.json`, { surface, discRequest: { seq: discReq.seq, tools: surface } })
  log(`L0(${tag}) surface (${surface.length} tools): ${surface.join(', ')}`)
  if (!surface.includes('bash')) {
    stopHost(booted.host)
    dieFatal(`L0(${tag}) diagnostic abort: the boot leader surface has no bash tool (the scenario surface is the preset bash stack)`)
  }
  const denyList = surface.filter(
    (n) => !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n) && !TEAM_TOOL_CATALOG.includes(n),
  )
  if (discReq.reply === undefined || discReq.reply.kind !== 'text' || String(discReq.reply.content) !== doneText) {
    writeEvidence(`l0-${tag}-diagnostic-mock.json`, mockRef.mock.requests.slice(-4).map((r) => ({ seq: r.seq, reply: r.reply })))
    stopHost(booted.host)
    dieFatal(`L0(${tag}) diagnostic abort: the DISC request (seq ${discReq.seq}) got reply ${JSON.stringify(discReq.reply).slice(0, 200)}`)
  }
  return { booted, denyList }
}

// ── main ────────────────────────────────────────────────────────────────────

const mockRef = { mock: null }

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  log(`exec-contract live smoke — stamp ${RUN_STAMP}`)
  log(`worktree=${WORKTREE}`)
  log(`testuse=${TESTUSE} @ ${HOST_BASELINE_SHA.slice(0, 10)}`)
  log(`evidence=${RUN_DIR}`)

  preflight()
  const hostPortA = await pickHostPort()
  if (!(await portFree(MOCK_PORT))) dieFatal(`mock port ${MOCK_PORT} busy`)
  log(`ports: hostA=${hostPortA} mock=${MOCK_PORT} (hostB picks after world A tears down)`)

  // Zero-touch record: the live instances (read-only pre probe).
  const preStable = {
    p3080: await probeStableInstance('http://127.0.0.1:3080/'),
    p3180: await probeStableInstance('http://127.0.0.1:3180/'),
  }
  writeEvidence('pre-stable-probe.json', preStable)
  log(`stable pre-probe: 3080=${preStable.p3080.status} 3180=${preStable.p3180.status}`)

  // World materialization (both worlds; the scenario blueprints are
  // written AFTER their world's L0 discovery — the deny list needs the
  // live surface).
  for (const home of [HOME_A, HOME_B]) rmSync(home, { recursive: true, force: true })
  rmSync(BLUEPRINT_DIR, { recursive: true, force: true })
  mkdirSync(WORKSPACE_A, { recursive: true })
  mkdirSync(WORKSPACE_B, { recursive: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeSmokePreset(HOME_A)
  writeSmokePreset(HOME_B)
  writePatchFile(HOME_A, { rootId: ROOT_A, anchorId: BP_ANCHOR_A_ID, hardFacts: FACTS_NONE, note: 'world A — no external ceiling (L1 + L2)' })
  writeP6t6Directive(HOME_A, ROOT_A)
  writePatchFile(HOME_B, { rootId: ROOT_B, anchorId: BP_ANCHOR_B_ID, hardFacts: FACTS_TOOLS_DENY, note: 'world B — external hard deny of the tools cell (L3)' })
  writeP6t6Directive(HOME_B, ROOT_B)
  log('worlds materialized (A: no ceiling; B: hard tools deny)')

  // Mock model (ONE instance serves both hosts — they run sequentially).
  const mockLog = join(RUN_DIR, 'mock.log')
  mockRef.mock = await startMockModel({
    port: MOCK_PORT,
    decide: makeDecide(),
    log: (l) => {
      try { writeFileSync(mockLog, l + '\n', { flag: 'a' }) } catch { /* best-effort */ }
    },
  })
  log(`mock model listening on ${mockRef.mock.port}`)

  const FAILS = []
  const fail = (id) => FAILS.push(id)

  // ── WORLD A: L1 (dual gate open) + L2 (gate 2 closed) ────────────────────
  let bootedA = null
  try {
    log('── WORLD A (no external ceiling): L1 + L2 ──')
    const { booted, denyList } = await bootAndDiscover({
      tag: 'a', home: HOME_A, port: hostPortA, mockPort: mockRef.mock.port,
      discMarker: MK_DISC_A, doneText: 'EXECLIVE_DISC_A_DONE',
      instanceLog: join(RUN_DIR, 'instance-a.log'),
    })
    bootedA = booted

    const l1Yaml = scenarioBlueprintYaml(BP_L1_ID, `You are the leader of the exec-contract live smoke L1 team. ${MK_L1}`, `You are worker of the exec-contract live smoke L1 team.`, true, denyList)
    const l2Yaml = scenarioBlueprintYaml(BP_L2_ID, `You are the leader of the exec-contract live smoke L2 team. ${MK_L2}`, `You are worker of the exec-contract live smoke L2 team.`, false, denyList)
    writeFileSync(join(BLUEPRINT_DIR, 'exec-l1.yaml'), l1Yaml)
    writeFileSync(join(BLUEPRINT_DIR, 'exec-l2.yaml'), l2Yaml)
    writeEvidence('blueprint-exec-l1.yaml', l1Yaml)
    writeEvidence('blueprint-exec-l2.yaml', l2Yaml)
    log(`saved blueprints L1 + L2 written (deny list = ${denyList.length} names)`)

    // ── L1: dual gate OPEN — direct exec, zero control requests ───────────
    log('── L1: dual gate open (leader allow bash + envelope bash token) ──')
    const l1Create = await remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_L1,
      blueprintId: BP_L1_ID,
      initialWork: { prompt: MK_L1 },
    }, 'xl1')
    writeEvidence('l1-create.json', l1Create.body ?? l1Create)
    const l1CreateOk = l1Create.status === 200
      && l1Create.body?.result?.ok === true
      && l1Create.body?.result?.value?.data?.path === 'fresh-root'
    check('L1.0', 'team.create (L1) succeeds on the fresh root', l1CreateOk, `status=${l1Create.status} body=${JSON.stringify(l1Create.body ?? l1Create).slice(0, 400)}`)
    if (!l1CreateOk) fail('L1.0')

    const l1Done = await waitForMock(mockRef.mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_L1) && (r.reply?.kind === 'text' ? r.reply.content : '').startsWith('EXECLIVE_L1_DONE'), 120_000, 'L1 turn complete')
    const l1Result = l1Done === null ? '' : bashResultOf(l1Done)
    writeEvidence('l1-tool-result.json', { seq: l1Done?.seq ?? null, toolResult: l1Result.slice(0, 2000) })
    writeEvidence('l1-marker-file.txt', existsSync(FILE_L1) ? readFileSync(FILE_L1, 'utf8') : '<absent>')
    check('L1.1', 'L1: the bash side effect LANDED (marker file written by the real host)',
      existsSync(FILE_L1) && readFileSync(FILE_L1, 'utf8').includes(SUM_L1),
      `fileExists=${existsSync(FILE_L1)}`)
    if (!existsSync(FILE_L1) || !readFileSync(FILE_L1, 'utf8').includes(SUM_L1)) fail('L1.1')
    check('L1.2', 'L1: the tool result reports execution (l1-executed marker printed)',
      l1Result.includes('l1-executed'), `result=${l1Result.slice(0, 300)}`)
    if (!l1Result.includes('l1-executed')) fail('L1.2')

    // The DUAL GATE proof: the bound blueprint's teamEnvelope carries the
    // `bash` token (evidence: the saved YAML above) AND the adapter let
    // the static allow through directly — the durable ledger for the L1
    // root records ZERO control requests (no user-approval row exists to
    // wait on or approve).
    const l1Ledger = readControlLedger(HOME_A, CREATE_ROOT_L1)
    writeEvidence('l1-ledger.json', l1Ledger)
    check('L1.3', 'L1: ZERO durable control requests on the L1 root (the direct-allow path — the real bound-blueprint token reached the listener)',
      l1Ledger.requests.length === 0 && l1Ledger.decisions.length === 0 && l1Ledger.consumptions.length === 0 && l1Ledger.error === null,
      `requests=${JSON.stringify(l1Ledger.requests).slice(0, 300)}`)
    if (l1Ledger.requests.length !== 0 || l1Ledger.decisions.length !== 0 || l1Ledger.consumptions.length !== 0) fail('L1.3')

    // ── L2: gate 1 open, gate 2 CLOSED — downgrade, zero effect, then allow
    log('── L2: gate 1 open, gate 2 closed (envelope WITHOUT the bash token) ──')
    // The team.create RPC AWAITS the boot turn — which is blocked in the
    // control wait after the downgrade — so it is fired as a promise and
    // resolved later by the scripted human resolution (C1 S6 precedent:
    // the human resolver channel works while the leader turn is blocked).
    const l2CreatePromise = remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_L2,
      blueprintId: BP_L2_ID,
      initialWork: { prompt: MK_L2 },
    }, 'xl2')

    const { ledger: l2PendingLedger, req: l2Req } = await waitForUserApprovalRequest(HOME_A, CREATE_ROOT_L2, 120_000)
    writeEvidence('l2-ledger-pending.json', l2PendingLedger)
    const l2ReqOk = l2Req !== undefined && l2Req.toolName === 'bash'
    check('L2.1', 'L2: the downgrade created a durable user-approval request (kind=user-approval, tool=bash) — the fallback itself was NOT envelope-blocked',
      l2ReqOk, `requests=${JSON.stringify(l2PendingLedger.requests).slice(0, 400)}`)
    if (!l2ReqOk) fail('L2.1')

    // ZERO SIDE EFFECT BEFORE APPROVAL — snapshot at the pending moment
    // (the adapter creates the row before it awaits the decision, so this
    // instant pins the pre-approval window), then re-check just before
    // the scripted resolution.
    const l2Pre = {
      at: new Date().toISOString(),
      fileExists: existsSync(FILE_L2),
      fileContent: existsSync(FILE_L2) ? readFileSync(FILE_L2, 'utf8') : null,
      pendingRequests: l2PendingLedger.requests,
    }
    await new Promise((r) => setTimeout(r, 2000))
    l2Pre.fileExistsAtT2 = existsSync(FILE_L2)
    writeEvidence('l2-pre-approval.json', l2Pre)
    check('L2.2', 'L2: zero side effect before the human allow (marker file ABSENT at the pending moment AND at the pre-resolve re-check)',
      l2Pre.fileExists === false && l2Pre.fileExistsAtT2 === false,
      `pre=${l2Pre.fileExists} t2=${l2Pre.fileExistsAtT2}`)
    if (l2Pre.fileExists !== false || l2Pre.fileExistsAtT2 !== false) fail('L2.2')

    // The scripted HUMAN resolution (the production team.resolveControl v4
    // ingress — the cookie-derived human principal; the v4-only method).
    const l2Resolve = await remoteCall(booted.origin, booted.cookie, 'team.resolveControl', {
      teamSessionId: CREATE_ROOT_L2,
      requestId: l2Req?.requestId ?? '',
      decision: 'allow',
      note: 'exec-contract live smoke L2: scripted human resolution (the production v4 ingress)',
    }, 'xl2res', 4)
    writeEvidence('l2-resolve-response.json', l2Resolve.body ?? l2Resolve)
    const l2ResolveOk = l2Resolve.status === 200
      && l2Resolve.body?.result?.ok === true
      && l2Resolve.body?.result?.value?.data?.decision?.decision === 'allow'
    check('L2.3', 'L2: the human resolution via team.resolveControl v4 succeeds (decision=allow recorded)',
      l2ResolveOk, `status=${l2Resolve.status} body=${JSON.stringify(l2Resolve.body ?? l2Resolve).slice(0, 400)}`)
    if (!l2ResolveOk) fail('L2.3')

    // The allow unblocks the control wait → the guard check-and-reserves →
    // the tool body runs → the boot turn completes → the create RPC
    // responds.
    const l2Create = await l2CreatePromise
    writeEvidence('l2-create.json', l2Create.body ?? l2Create)
    const l2CreateOk = l2Create.status === 200
      && l2Create.body?.result?.ok === true
      && l2Create.body?.result?.value?.data?.path === 'fresh-root'
    check('L2.4', 'L2: team.create (L2) succeeds (the RPC awaited the boot turn; the human allow unblocked it)',
      l2CreateOk, `status=${l2Create.status} body=${JSON.stringify(l2Create.body ?? l2Create).slice(0, 300)}`)
    if (!l2CreateOk) fail('L2.4')

    const l2Done = await waitForMock(mockRef.mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_L2) && (r.reply?.kind === 'text' ? r.reply.content : '').startsWith('EXECLIVE_L2_DONE'), 120_000, 'L2 turn complete')
    const l2Result = l2Done === null ? '' : bashResultOf(l2Done)
    writeEvidence('l2-tool-result.json', { seq: l2Done?.seq ?? null, toolResult: l2Result.slice(0, 2000) })
    writeEvidence('l2-marker-file.txt', existsSync(FILE_L2) ? readFileSync(FILE_L2, 'utf8') : '<absent>')
    check('L2.5', 'L2: after the human allow the bash EXECUTED (marker file present with the marker content)',
      existsSync(FILE_L2) && readFileSync(FILE_L2, 'utf8').includes(SUM_L2) && l2Result.includes('l2-executed'),
      `fileExists=${existsSync(FILE_L2)} result=${l2Result.slice(0, 200)}`)
    if (!existsSync(FILE_L2) || !readFileSync(FILE_L2, 'utf8').includes(SUM_L2) || !l2Result.includes('l2-executed')) fail('L2.5')

    const l2Ledger = readControlLedger(HOME_A, CREATE_ROOT_L2)
    writeEvidence('l2-ledger-final.json', l2Ledger)
    const l2Decision = l2Ledger.decisions.find((d) => d.requestId === (l2Req?.requestId ?? null))
    check('L2.6', 'L2: the durable ledger records exactly the user-approval request + the allow decision + the allow consumption',
      l2Ledger.requests.length === 1 && l2Decision !== undefined && l2Decision.decision === 'allow' && l2Ledger.consumptions.length === 1,
      `requests=${l2Ledger.requests.length} decisions=${JSON.stringify(l2Ledger.decisions).slice(0, 200)} consumptions=${l2Ledger.consumptions.length}`)
    if (!(l2Ledger.requests.length === 1 && l2Decision !== undefined && l2Decision.decision === 'allow' && l2Ledger.consumptions.length === 1)) fail('L2.6')
  } finally {
    if (bootedA !== null) {
      log('teardown: stopping host A + world A')
      stopHost(bootedA.host)
      if (!FLAG_KEEP) {
        rmSync(HOME_A, { recursive: true, force: true })
        log(`world A removed (${HOME_A})`)
      }
    }
  }

  // ── WORLD B: L3 (external hard deny — the host ceiling) ─────────────────
  let bootedB = null
  const hostPortB = await pickHostPort()
  try {
    log('── WORLD B (external hard deny of the tools cell): L3 ──')
    const { booted, denyList } = await bootAndDiscover({
      tag: 'b', home: HOME_B, port: hostPortB, mockPort: mockRef.mock.port,
      discMarker: MK_DISC_B, doneText: 'EXECLIVE_DISC_B_DONE',
      instanceLog: join(RUN_DIR, 'instance-b.log'),
    })
    bootedB = booted

    const l3Yaml = scenarioBlueprintYaml(BP_L3_ID, `You are the leader of the exec-contract live smoke L3 team. ${MK_L3}`, `You are worker of the exec-contract live smoke L3 team.`, true, denyList)
    writeFileSync(join(BLUEPRINT_DIR, 'exec-l3.yaml'), l3Yaml)
    writeEvidence('blueprint-exec-l3.yaml', l3Yaml)
    log(`saved blueprint L3 written (both gates open — the ceiling is the HOST's, not the team's)`)

    log('── L3: both gates open, external hard policy denies tools ──')
    const l3Create = await remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_L3,
      blueprintId: BP_L3_ID,
      initialWork: { prompt: MK_L3 },
    }, 'xl3')
    writeEvidence('l3-create.json', l3Create.body ?? l3Create)
    const l3CreateOk = l3Create.status === 200
      && l3Create.body?.result?.ok === true
      && l3Create.body?.result?.value?.data?.path === 'fresh-root'
    check('L3.0', 'team.create (L3) succeeds on the fresh root', l3CreateOk, `status=${l3Create.status} body=${JSON.stringify(l3Create.body ?? l3Create).slice(0, 400)}`)
    if (!l3CreateOk) fail('L3.0')

    const l3Done = await waitForMock(mockRef.mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_L3) && (r.reply?.kind === 'text' ? r.reply.content : '').startsWith('EXECLIVE_L3_DONE'), 120_000, 'L3 turn complete')
    const l3Result = l3Done === null ? '' : bashResultOf(l3Done)
    writeEvidence('l3-tool-result.json', { seq: l3Done?.seq ?? null, toolResult: l3Result.slice(0, 2000) })
    const l3Absence = {
      at: new Date().toISOString(),
      fileExists: existsSync(FILE_L3),
    }
    writeEvidence('l3-absence-check.json', l3Absence)
    check('L3.1', 'L3: the bash did NOT execute even though both gates passed (marker file ABSENT after the turn)',
      l3Absence.fileExists === false, `fileExists=${l3Absence.fileExists}`)
    if (l3Absence.fileExists !== false) fail('L3.1')
    check('L3.2', 'L3: the tool result is the external-hard-policy denial (the A2C-4 last-mile recheck over the live host facts)',
      l3Result.includes('external hard policy no longer allows bash'), `result=${l3Result.slice(0, 400)}`)
    if (!l3Result.includes('external hard policy no longer allows bash')) fail('L3.2')

    // A recheck denial is a zero-effect deny: NO durable control row is
    // written (the static path carries no control request — the recheck
    // is its only external gate).
    const l3Ledger = readControlLedger(HOME_B, CREATE_ROOT_L3)
    writeEvidence('l3-ledger.json', l3Ledger)
    check('L3.3', 'L3: ZERO durable control rows on the L3 root (a recheck denial writes nothing)',
      l3Ledger.requests.length === 0 && l3Ledger.decisions.length === 0 && l3Ledger.consumptions.length === 0 && l3Ledger.error === null,
      `requests=${JSON.stringify(l3Ledger.requests).slice(0, 300)}`)
    if (l3Ledger.requests.length !== 0 || l3Ledger.decisions.length !== 0 || l3Ledger.consumptions.length !== 0) fail('L3.3')
  } finally {
    if (bootedB !== null) {
      log('teardown: stopping host B + world B')
      stopHost(bootedB.host)
      if (!FLAG_KEEP) {
        rmSync(HOME_B, { recursive: true, force: true })
        log(`world B removed (${HOME_B})`)
      }
    }
  }

  // ── global teardown + verdict ───────────────────────────────────────────
  log('teardown: closing the mock model')
  try {
    await mockRef.mock.close()
  } catch { /* best-effort */ }
  rmSync(BLUEPRINT_DIR, { recursive: true, force: true })

  const postStable = {
    p3080: await probeStableInstance('http://127.0.0.1:3080/'),
    p3180: await probeStableInstance('http://127.0.0.1:3180/'),
  }
  writeEvidence('post-stable-probe.json', postStable)
  check('STABLE', 'the stable dev instances were untouched (:3080 / :3180 401 before AND after)',
    preStable.p3080.status === 401 && preStable.p3180.status === 401
    && postStable.p3080.status === 401 && postStable.p3180.status === 401,
    `pre=${preStable.p3080.status}/${preStable.p3180.status} post=${postStable.p3080.status}/${postStable.p3180.status}`)
  if (!(preStable.p3080.status === 401 && preStable.p3180.status === 401 && postStable.p3080.status === 401 && postStable.p3180.status === 401)) fail('STABLE')

  writeEvidence('mock-requests.json', mockRef.mock.requests.map((r) => ({
    seq: r.seq,
    receivedAt: r.receivedAt,
    userTextHead: lastUserTextOf(r).slice(0, 200),
    toolMsgCountAfterLastUser: toolMsgsOf(r).length,
    reply: r.reply,
  })))
  writeEvidence('envelope-shapes.json', {
    l1: teamEnvelopeAllow(true),
    l2: teamEnvelopeAllow(false),
    l3: teamEnvelopeAllow(true),
  })
  if (bootedA !== null) writeEvidence('instance-a-tail.txt', logTail(bootedA.instanceLog, 120))
  if (bootedB !== null) writeEvidence('instance-b-tail.txt', logTail(bootedB.instanceLog, 120))
  if (FLAG_KEEP) log(`--keep: worlds retained under tests/homes/`)

  const passed = criteria.filter((c) => c.ok).length
  const summary = {
    runStamp: RUN_STAMP,
    hostBaseline: HOST_BASELINE_SHA,
    hostPortA,
    hostPortB,
    mockPort: MOCK_PORT,
    worktree: WORKTREE,
    externalPolicyFacts: { worldA: FACTS_NONE, worldB: FACTS_TOOLS_DENY },
    criteria,
    passed,
    total: criteria.length,
    failed: FAILS,
    stable: { pre: preStable, post: postStable },
    verdict: FAILS.length === 0 ? 'PASS' : 'FAIL',
  }
  writeEvidence('summary.json', summary)
  log(`VERDICT ${summary.verdict} — ${passed}/${criteria.length} criteria passed${FAILS.length > 0 ? `; failed: ${FAILS.join(',')}` : ''}`)

  process.exit(FAILS.length === 0 ? 0 : 2)
}

main().catch((e) => {
  try {
    log(`FATAL uncaught: ${e.stack ?? e}`)
    if (RUN_LOG !== null) writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: String(e.message ?? e), criteria })
  } catch { /* best-effort */ }
  process.exit(1)
})
