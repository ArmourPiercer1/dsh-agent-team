#!/usr/bin/env node
/**
 * p06-stage2b-kit.mjs — Alpha.5 P0-6 stage2b: the mock-model Team world REAL
 * tool-call closed loop on the isolated pinned real host (guide §3 P0-6).
 *
 * Chain basis = tests/kits/c1-leader-approval-smoke (writePatchFile + smoke
 * preset + in-process mock model + spawnHost on the pristine test-use bin).
 * Increments (each judged independently, never extrapolated):
 *   I1  cold boot :3185 with the production dsh-agent-team row (W dist) +
 *       smoke presets + p6t6 observer + mock model: boot line + 401 gate +
 *       row health/state.
 *   I2  browserless: team.create (remote HTTP), Leader (mock script) creates
 *       members; member sessions active (catalog.list / team.getProjection /
 *       p6t6 liveSessions / session/list evidence).
 *   I3  a member REALLY executes a native tool once (scripted `read` of a
 *       seed file; the unique on-disk content returning in the tool result
 *       proves real-body execution).
 *   I4  same-name Adapter closed loop: the a5p0-adapter preset plugin arms on
 *       the arming member's OWN scope (restrict-first, then same-name
 *       register). The member's next read -> Adapter marker text + marker
 *       file line, native body output characteristics GONE. Same-boot
 *       sibling control member (never armed, same preset; its own scope
 *       never assembled) still gets native output.
 *   I5  safe-unload leg: dispose the Adapter (restrict KEPT) -> the same
 *       member calls the same name -> typed unknown-tool error (no native
 *       fallback; native body count stays 0).
 *
 * HARD CONSTRAINTS honored: host port = 3185 ONLY (mock = ephemeral :0);
 * DSH_HOME under W/tests/homes/; test-use tree never written; :3080 never
 * touched (read-only probes recorded); kill ONLY the recorded host PID;
 * tokens redacted from evidence.
 *
 * Usage: node p06-stage2b-kit.mjs [--keep] [--host-port 3185] [--evidence-dir <p>]
 * EXIT: 0 = all increments pass; 2 = an increment failed; 1 = fatal.
 */

import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startMockModel } from '../../../../../../packages/tools/harness/mock-deepseek.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../../../tests/kits/_shared/preset-seam.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../../tests/paths.mjs'

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
const WORKTREE = resolve(KIT_DIR, '..', '..', '..', '..', '..', '..')
const TESTUSE = join(WORKTREE, 'tests', 'deepseek-harness-test-use')
const HOST_PORT = Number(argValue('host-port', 3185))
if (HOST_PORT === 3080 || HOST_PORT === 3180) throw new Error(`refusing port ${HOST_PORT}`)
const EVIDENCE_DIR_ARG = argValue('evidence-dir', null)

// ── frozen facts ────────────────────────────────────────────────────────────
const HOST_BASELINE_SHA = TEST_USE_BASELINE_SHA
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'host.js')
const GLUE_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_PLUGIN_PATH = join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')
const ADAPTER_PLUGIN_PATH = join(KIT_DIR, 'a5p0-adapter-preset-plugin.mjs')
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href
const GLUE_URL = pathToFileURL(GLUE_PATH).href
const SEAM_URL = pathToFileURL(SEAM_PATH).href
const P6T6_ROW_NAME = pathToFileURL(P6T6_PLUGIN_PATH).href
const ADAPTER_ROW_NAME = pathToFileURL(ADAPTER_PLUGIN_PATH).href

const SMOKE_PRESET_ID = 'a5p0-smoke'
const ADAPTER_PRESET_ID = 'a5p0-adp'
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
const TEAM_TOOL_CATALOG = [
  'team_list_members', 'team_list_templates', 'team_inspect_config',
  'team_create_member', 'team_delegate', 'team_follow_up', 'team_collect',
  'team_send_message', 'team_report_progress', 'team_request_control',
  'team_resolve_control', 'team_list_pending_control',
]
const LEADER_TEAM_TOOLS_ALLOW = [
  'team_list_members', 'team_list_templates', 'team_inspect_config',
  'team_create_member', 'team_delegate', 'team_collect',
]

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = EVIDENCE_DIR_ARG ? resolve(EVIDENCE_DIR_ARG) : join(KIT_DIR, `run-${RUN_STAMP}`)
const HOME = join(WORKTREE, 'tests', 'homes', `a5p0-s2b-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const BLUEPRINT_DIR = join(RUN_DIR, 'blueprints')
const MARKER_FILE = join(RUN_DIR, 'adapter-marker.log')
const PLUGIN_LOG = join(RUN_DIR, 'adapter-plugin.log')

const ROOT = `session-a5p0-root-${RUN_STAMP}`
const CREATE_ROOT = `session-a5p0-team-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.a5p0-anchor'
const BP_MAIN_ID = 'team.a5p0-main'

// Distinct markers (no substring collisions).
const MK_DISC = `A5P0MK_DISC_${RUN_STAMP}`
const MK_L1 = `A5P0MK_L1_${RUN_STAMP}`
const MK_D2 = `A5P0MK_D2_${RUN_STAMP}`
const MK_M1 = `A5P0MK_M1_${RUN_STAMP}`
const MK_M2 = `A5P0MK_M2_${RUN_STAMP}`
const ARM_TOKEN = `A5P0ARM_${RUN_STAMP}`
const DISPOSE_TOKEN = `A5P0DISP_${RUN_STAMP}`
const ADAPTER_MARK = `A5P0_ADAPTER_RAN_${RUN_STAMP}`
const SEED_UNIQUE = `A5P0_SEED_CONTENT_${RUN_STAMP}`
const SEED_FILE = join(WORKSPACE, `a5p0-seed-${RUN_STAMP}.txt`)
// Token carriers ride the ALLOWED `read` name (alpha.2: the allow lane must
// not carry a whole-tool bash rule), so the tokens travel in the file path.
const ARM_FILE = join(WORKSPACE, `a5p0-arm-${ARM_TOKEN}.txt`)
const DISPOSE_FILE = join(WORKSPACE, `a5p0-dispose-${DISPOSE_TOKEN}.txt`)

const TRIGGER_RE = /A5P0MK_[A-Z0-9]+_[0-9T:.-]+/

// ── logging / criteria / fatals ─────────────────────────────────────────────
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
  log(`${ok === true ? 'PASS' : 'FAIL'} ${critId}: ${name}${detail === '' || detail === undefined ? '' : ` — ${String(detail).slice(0, 500)}`}`)
  return ok === true
}
const REDACT = [
  [/(https?:\/\/[^\s"'`]+?\?token=)[A-Za-z0-9_-]{8,}/g, '$1<REDACTED-TOKEN>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}(=[A-Za-z0-9._\-%=]{6,})?/g, 'dsh-auth-<REDACTED>=<REDACTED>'],
  [/\bBearer\s+[A-Za-z0-9._-]{6,}/gi, 'Bearer <REDACTED>'],
]
function redact(text) {
  let out = String(text)
  for (const [re, repl] of REDACT) out = out.replace(re, repl)
  return out
}
function writeEvidence(name, content) {
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    writeFileSync(join(RUN_DIR, name), redact(typeof content === 'string' ? content : JSON.stringify(content, null, 2)))
  } catch { /* best-effort */ }
}
function dieFatal(msg, exitCode = 1) {
  log(`FATAL ${msg}`)
  writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: redact(msg), criteria })
  process.exit(exitCode)
}

// ── http helpers (c1 shape) ─────────────────────────────────────────────────
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
async function remoteCall(origin, cookie, method, params, tag = 'a5', version = 1) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version, params } }),
  }, 240_000)
}
async function apiCall(origin, cookie, endpoint, request, tag = 'a5', timeoutMs = 240_000) {
  return fetchJson(`${origin}/api/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method: endpoint, payload: { args: { request } } }),
  }, timeoutMs)
}
async function apiPrompt(origin, cookie, sessionId, text, tag = 'a5') {
  return apiCall(origin, cookie, 'session/prompt', {
    requestId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
    sessionId, mode: 'queue', content: [{ type: 'text', text }],
  }, tag)
}
function logTail(logPath, n = 25) {
  try { return readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n') } catch { return '<no log>' }
}
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/
async function waitForLogLine(logPath, regex, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    let text = ''
    try { text = readFileSync(logPath, 'utf8') } catch { /* not yet */ }
    for (const line of text.split('\n')) {
      const m = regex.exec(line)
      if (m !== null) return line
    }
    if (Date.now() >= deadline) break
    if (alive !== undefined && !alive()) return null
    await new Promise((r) => setTimeout(r, 300))
  }
  return null
}
async function portFree(port, timeoutMs = 1500) {
  const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ error: e }))
  return res.error !== undefined
}

// ── world materialization ───────────────────────────────────────────────────
function yamlScalar(v) { return v === null ? 'null' : typeof v === 'string' ? JSON.stringify(v) : String(v) }
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
    memberPresetId: ADAPTER_PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5p0-model' },
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

const BP_ANCHOR_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader',
  `  persona: "You are the leader of the a5p0 stage2b boot team. ${MK_DISC} is the discovery marker."`,
  'members:', '  - templateId: worker', '    persona: "You are a worker of the a5p0 stage2b boot team."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

/** The main blueprint: c1 lane shape + member allow lanes for read + bash. */
function savedBlueprintYaml(denyList) {
  const denyLines = (list, baseIndent) => {
    const pad = '  '.repeat(baseIndent)
    return list.length === 0 ? [`${pad}builtinToolDeny: []`] : [`${pad}builtinToolDeny:`, ...list.map((n) => `${pad}  - ${n}`)]
  }
  const leaderBlock = [
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the a5p0 stage2b main team. ${MK_L1} and ${MK_D2} drive your chains.`)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
    ...LEADER_TEAM_TOOLS_ALLOW.map((t) => `        - ${t}`),
    ...denyLines(denyList, 2),
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask',
    '      allow:', '        - tool: read', '          resource:', '            kind: subtree', '            path: team',
    '      ask:', '        - tool: bash', '          resource:', '            kind: any',
    '      deny:', '        - tool: read', '          resource:', '            kind: subtree', '            path: runtime',
  ]
  const workerBlock = [
    'members:', '  - templateId: worker',
    `    persona: ${JSON.stringify('You are a worker of the a5p0 stage2b main team. Follow the delegated script exactly, one tool call at a time.')}`,
    '    capabilities:', '      teamTools:', '        kind: deny',
    ...denyLines(denyList, 3),
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask',
    '        allow:',
    '          - tool: read', '            resource:', '              kind: any',
    '        ask: []',
    '        deny:', '          - tool: read', '            resource:', '              kind: subtree', '              path: runtime',
  ]
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    ...leaderBlock,
    'teamEnvelope:', '  allow:', '    - assign-task', '    - create-member', '    - send-message',
    '    - report-progress', '    - request-control', '    - resolve-control', '  deny: []',
    ...workerBlock,
    'memberEnvelopes:', '  - templateId: worker', '    envelope:', '      allow:', '        - send-message',
    '        - report-progress', '        - request-control', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

function writePatchFile(home) {
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const adapterPlugins = smokePresetPlugins({
    personaText: 'You are a coding agent powered by the {{model}} model.',
    cwdSuffix: 'Your working directory is {{cwd}}.',
    bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
  })
  adapterPlugins.push({ id: 'a5p0-adapter', name: ADAPTER_ROW_NAME })
  const lines = [
    `# a5p0 stage2b patch layer (run ${RUN_STAMP}): production dsh-agent-team row (W dist) + p6t6 observer + two presets (base smoke; smoke + a5p0 same-name Adapter row) — public profile-patch seam only.`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...yamlEmitItem(presetDeclarationRow({
      id: SMOKE_PRESET_ID, displayName: 'a5p0 smoke',
      description: `a5p0 stage2b base preset (run ${RUN_STAMP})`,
      plugins: smokePresetPlugins({
        personaText: 'You are a coding agent powered by the {{model}} model.',
        cwdSuffix: 'Your working directory is {{cwd}}.',
        bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
      }),
    }), 2),
    ...yamlEmitItem(presetDeclarationRow({
      id: ADAPTER_PRESET_ID, displayName: 'a5p0 adp',
      description: `a5p0 stage2b adapter preset (run ${RUN_STAMP}): base + the a5p0-adapter same-name Adapter row`,
      plugins: adapterPlugins,
    }), 2),
    '',
  ]
  writeFileSync(join(home, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
}

// ── host boot (c1 shape) ────────────────────────────────────────────────────
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
        DEEPSEEK_API_KEY: 'a5p0-s2b-mock-key',
      },
    })
  } catch (error) {
    closeSync(outFd); closeSync(errFd)
    throw new Error(`host spawn failed: ${error.message}`)
  }
  const exitInfo = { exited: false, code: undefined, signal: undefined, message: undefined }
  child.on('error', (error) => { exitInfo.exited = true; exitInfo.signal = 'spawn-error'; exitInfo.message = error.message })
  child.on('close', (code, signal) => { exitInfo.exited = true; exitInfo.code = code; exitInfo.signal = signal })
  return { child, pid: child.pid, exitInfo, alive: () => !exitInfo.exited, logPath }
}
function stopHost(h) {
  try { if (h !== undefined && h.pid !== undefined) process.kill(h.pid) } catch { /* already gone */ }
  return h
}
async function bootHost({ port, home, mockPort, instanceLog }) {
  writePatchFile(home)
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'a5p0-anchor.yaml'), BP_ANCHOR_YAML)
  writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({ boot: 1, phase: 'create', reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT }, null, 2))
  writeFileSync(join(home, 'a5p0-adapter-directive.json'), JSON.stringify({
    nativeName: 'read', armToken: ARM_TOKEN, disposeToken: DISPOSE_TOKEN,
    adapterMark: ADAPTER_MARK, markerFile: MARKER_FILE, logFile: PLUGIN_LOG,
  }, null, 2))
  const h = spawnHost({ port, home, logPath: instanceLog, mockPort })
  const line = await waitForLogLine(instanceLog, BOOT_MARKER, 240_000, h.alive)
  if (line === null) {
    stopHost(h)
    const detail = h.exitInfo.exited
      ? `process exited (code=${String(h.exitInfo.code)} signal=${String(h.exitInfo.signal ?? 'none')}${h.exitInfo.message ? ` msg=${h.exitInfo.message}` : ''})`
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
    const hb = await fetchJson(`${origin}/__p6t6/health`, undefined, 10_000)
    health = hb
    if (hb.status === 200 && hb.body?.ok === true) break
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      stopHost(h)
      dieFatal(`row setup failed — setupError: ${String(hb.body.setupError).slice(0, 600)}\n--- log tail ---\n${logTail(instanceLog)}`)
    }
    if (Date.now() >= deadline) { stopHost(h); dieFatal(`row health not ready in 240s — ${JSON.stringify(hb.body).slice(0, 400)}\n--- log tail ---\n${logTail(instanceLog)}`) }
    await new Promise((r) => setTimeout(r, 1000))
  }
  const sDeadline = Date.now() + 90_000
  let state = null
  for (;;) {
    const s = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    state = s
    const b = s.body
    if (s.status === 200 && b !== null && typeof b === 'object' && b.rootSessionId === ROOT && b.phase === 'create' && b.teamSession !== null) break
    if (Date.now() >= sDeadline) { stopHost(h); dieFatal(`row state not well-formed in 90s; last: status=${s.status} body=${JSON.stringify(s.body).slice(0, 400)}`) }
    await new Promise((r) => setTimeout(r, 500))
  }
  log(`host booted at ${origin} (pid ${String(h.pid)}); row ready — toolCount=${String(health.body?.toolCount)}`)
  return { host: h, port: Number(m[1]), origin, cookie, instanceLog, health, stateBody: state.body }
}

// ── mock decide policy ──────────────────────────────────────────────────────
function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-a5-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}
function bodyOf(rec) { return rec === null || typeof rec !== 'object' ? null : ('body' in rec ? (rec.body ?? null) : rec) }
function messagesOf(req) { return bodyOf(req)?.messages ?? [] }
function userTextOf(req) {
  return messagesOf(req).filter((m) => m.role === 'user')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))).join('\n')
}
function lastTriggerIndex(req) {
  const messages = messagesOf(req)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m.role !== 'user') continue
    const t = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
    if (TRIGGER_RE.test(t)) return i
  }
  for (let i = messages.length - 1; i >= 0; i -= 1) if (messages[i].role === 'user') return i
  return -1
}
function lastUserTextOf(req) {
  const messages = messagesOf(req)
  const i = lastTriggerIndex(req)
  if (i === -1) return ''
  const last = messages[i]
  return typeof last.content === 'string' ? last.content : JSON.stringify(last.content ?? '')
}
// WIRE SHAPE PIN (probe-wire-shape.mjs, this host generation, Anthropic-style
// message blocks): a tool result arrives as a role='user' message carrying a
// content block { type:'tool_result', tool_use_id, content:[{type:'text'}],
// is_error }. There are NO role='tool' messages on this wire.
function toolResultsAfterTrigger(req) {
  const messages = messagesOf(req)
  const out = []
  for (const m of messages.slice(lastTriggerIndex(req) + 1)) {
    const blocks = Array.isArray(m.content) ? m.content : []
    for (const b of blocks) {
      if (b?.type === 'tool_result') {
        const text = (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('')
        out.push({ text, isError: b.is_error === true, toolUseId: b.tool_use_id ?? null })
      }
    }
    if (m.role === 'tool') out.push({ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''), isError: false, toolUseId: m.tool_call_id ?? null })
  }
  return out
}
function toolMsgsOf(req) { return toolResultsAfterTrigger(req) }
function allToolResultsOf(req) {
  const out = []
  for (const m of messagesOf(req)) {
    const blocks = Array.isArray(m.content) ? m.content : []
    for (const b of blocks) {
      if (b?.type === 'tool_result') out.push({ text: (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join(''), toolUseId: b.tool_use_id ?? null })
    }
  }
  return out
}
function extractInstanceId(content) {
  const m = /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(String(content))
    ?? /"instanceId"\s*:\s*"([^"]+)"/.exec(String(content))
    ?? /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(String(content))
  return m === null ? null : m[1]
}
/** Discover the native read tool's argument key from the live tool schema. */
function discoverReadArgKey(req) {
  const tools = bodyOf(req)?.tools ?? []
  const read = tools.find((t) => (t?.function?.name ?? t?.name) === 'read')
  const props = read?.function?.parameters?.properties ?? read?.input_schema?.properties ?? read?.parameters?.properties ?? {}
  for (const key of ['file_path', 'path', 'filename', 'filePath']) if (key in props) return key
  const first = Object.keys(props)[0]
  return first ?? 'file_path'
}

const M1_PROMPT = `${MK_M1} Follow this script EXACTLY, one tool call per turn: (1) read ${SEED_FILE}; (2) read ${ARM_FILE}; (3) read ${SEED_FILE} again; (4) read ${DISPOSE_FILE}; (5) read ${SEED_FILE} again; (6) finish. Reply with the final marker when done.`
const M2_PROMPT = `${MK_M2} Call read on ${SEED_FILE} exactly once, then finish.`

function makeDecide() {
  const st = { readArgKey: 'file_path' }
  return function decide({ req }) {
    const firstMsg = messagesOf(req)[0]
    const firstText = typeof firstMsg?.content === 'string' ? firstMsg.content : JSON.stringify(firstMsg?.content ?? '')
    if (firstText.includes('session title')) {
      return { kind: 'text', content: 'a5p0 stage2b session' }
    }
    const lastUser = lastUserTextOf(req)
    const tools = toolMsgsOf(req).length
    if (lastUser.includes(MK_M1)) {
      switch (tools) {
        case 0: st.readArgKey = discoverReadArgKey(req); return toolCall('read', { [st.readArgKey]: SEED_FILE })
        case 1: return toolCall('read', { [st.readArgKey]: ARM_FILE })
        case 2: return toolCall('read', { [st.readArgKey]: SEED_FILE })
        case 3: return toolCall('read', { [st.readArgKey]: DISPOSE_FILE })
        case 4: return toolCall('read', { [st.readArgKey]: SEED_FILE })
        case 5: return { kind: 'text', content: 'A5P0_M1_DONE' }
        default: return { kind: 'text', content: `A5P0_M1_FALLTHROUGH tools=${String(tools)}` }
      }
    }
    if (lastUser.includes(MK_M2)) {
      switch (tools) {
        case 0: return toolCall('read', { [st.readArgKey]: SEED_FILE })
        case 1: return { kind: 'text', content: 'A5P0_M2_DONE' }
        default: return { kind: 'text', content: `A5P0_M2_FALLTHROUGH tools=${String(tools)}` }
      }
    }
    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'A5P0_DISC_DONE' }
    if (lastUser.includes(MK_L1)) {
      switch (tools) {
        case 0: return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: `a5-c1-${RUN_STAMP}`, delegationTemplateId: 'worker', label: 'm-adp' })
        case 1: return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: `a5-c2-${RUN_STAMP}`, delegationTemplateId: 'worker', label: 'm-ctl' })
        case 2: {
          const id = extractInstanceId(toolResultsAfterTrigger(req)[0]?.text ?? '')
          if (id === null) return { kind: 'text', content: `A5P0_L1_ID_FAIL :: ${String(toolResultsAfterTrigger(req)[0]?.text).slice(0, 300)}` }
          return toolCall('team_delegate', { rootSessionId: CREATE_ROOT, requestToken: `a5-d1-${RUN_STAMP}`, delegationInstanceId: id, label: 'm-adp', prompt: M1_PROMPT, async: true })
        }
        case 3: return { kind: 'text', content: 'A5P0_L1_DONE' }
        default: return { kind: 'text', content: `A5P0_L1_FALLTHROUGH tools=${String(tools)}` }
      }
    }
    if (lastUser.includes(MK_D2)) {
      switch (tools) {
        case 0: {
          const ids = allToolResultsOf(req).map((r) => extractInstanceId(r.text)).filter((v) => v !== null)
          const id2 = ids.length >= 2 ? ids[1] : null
          if (id2 === null) return { kind: 'text', content: `A5P0_D2_ID_FAIL ids=${String(ids.length)}` }
          return toolCall('team_delegate', { rootSessionId: CREATE_ROOT, requestToken: `a5-d2-${RUN_STAMP}`, delegationInstanceId: id2, label: 'm-ctl', prompt: M2_PROMPT, async: true })
        }
        case 1: return { kind: 'text', content: 'A5P0_D2_DONE' }
        default: return { kind: 'text', content: `A5P0_D2_FALLTHROUGH tools=${String(tools)}` }
      }
    }
    return { kind: 'text', content: 'A5P0_NOOP_DONE' }
  }
}
async function waitForMock(mock, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.find(pred)
    if (hit !== undefined) return hit
    // Storm fuse (run 22-32-37 OOM): a stuck oracle loop must never grow the
    // corpus unboundedly — fail the wait instead.
    if (mock.requests.length > 300) { log(`mock storm fuse: ${label} (requests=${String(mock.requests.length)})`); return null }
    if (Date.now() >= deadline) { log(`mock wait timed out: ${label} (requests=${String(mock.requests.length)})`); return null }
    await new Promise((r) => setTimeout(r, 400))
  }
}
const toolResultText = (req, idx) => String(toolMsgsOf(req)[idx]?.text ?? '')
const markerLineCount = () => { try { return readFileSync(MARKER_FILE, 'utf8').split('\n').filter((l) => l.startsWith('ADAPTER_CALL')).length } catch { return 0 } }

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  log(`a5p0 stage2b kit — stamp ${RUN_STAMP}`)
  log(`worktree=${WORKTREE}; testuse=${TESTUSE} @ ${HOST_BASELINE_SHA.slice(0, 10)}; evidence=${RUN_DIR}`)

  // preflight
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' })
  if (rev.status !== 0 || rev.stdout.trim() !== HOST_BASELINE_SHA) dieFatal(`test-use not at baseline: ${String(rev.stdout?.trim() ?? rev.stderr)}`)
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' })
  if (dirty.status !== 0 || dirty.stdout.trim() !== '') dieFatal(`test-use not pristine: ${String(dirty.stdout).slice(0, 200)}`)
  for (const p of [HOST_BIN, PRODUCTION_ROW_PATH, GLUE_PATH, SEAM_PATH, P6T6_PLUGIN_PATH, ADAPTER_PLUGIN_PATH]) {
    if (!existsSync(p)) dieFatal(`required file missing: ${p}`)
  }
  if (!(await portFree(HOST_PORT))) dieFatal(`host port ${HOST_PORT} busy (constraint: 3185 only)`)

  const preStable = { p3080: await probeStableInstance('http://127.0.0.1:3080/'), p3180: await probeStableInstance('http://127.0.0.1:3180/') }
  writeEvidence('pre-stable-probe.json', preStable)

  rmSync(HOME, { recursive: true, force: true })
  mkdirSync(WORKSPACE, { recursive: true })
  writeFileSync(SEED_FILE, `a5p0 stage2b seed file (run ${RUN_STAMP})\nsecond line\n${SEED_UNIQUE}\nfourth line\n`)
  writeFileSync(ARM_FILE, `arm carrier file (native content irrelevant: the path token arms the scope) ${ARM_TOKEN}\n`)
  writeFileSync(DISPOSE_FILE, `dispose carrier file ${DISPOSE_TOKEN}\n`)
  log(`world materialized; seed file written (${SEED_FILE})`)

  const mock = await startMockModel({ port: 0, decide: makeDecide(), log: (l) => { try { writeFileSync(join(RUN_DIR, 'mock.log'), l + '\n', { flag: 'a' }) } catch { /* best-effort */ } } })
  log(`mock model listening on ephemeral port ${String(mock.port)}`)

  const instanceLog = join(RUN_DIR, 'instance.log')
  writeFileSync(instanceLog, '', { flag: 'w' })
  const booted = await bootHost({ port: HOST_PORT, home: HOME, mockPort: mock.port, instanceLog })
  const host = booted.host
  writeEvidence('boot-raw.json', { bootLine: BOOT_MARKER.exec(readFileSync(instanceLog, 'utf8'))?.[0] ?? null, port: booted.port, p6t6Health: booted.health.body, note: 'boot token redacted everywhere' })

  const FAILS = []
  const fail = (id) => { if (!FAILS.includes(id)) FAILS.push(id) }

  try {
    // ══ I1 ══
    const noTok = await fetch(`${booted.origin}/`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) }).catch(() => null)
    const noTokStatus = noTok === null ? 'unreachable' : noTok.status
    const bootLines = readFileSync(instanceLog, 'utf8').split('\n').filter((l) => BOOT_MARKER.test(l)).length
    const i1ok = check('I1', 'host cold boot on :3185: boot line + no-token 401 + auth 303 + p6t6 row health/state',
      HOST_PORT === 3185 && booted.port === 3185 && bootLines >= 1 && noTokStatus === 401 && booted.health.body?.ok === true,
      `port=${String(booted.port)} bootLines=${String(bootLines)} noToken=${String(noTokStatus)} healthOk=${String(booted.health.body?.ok)}`)
    if (!i1ok) fail('I1')

    // ══ L0 discovery (surface for the deny list) ══
    await apiPrompt(booted.origin, booted.cookie, ROOT, MK_DISC)
    const discReq = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_DISC) && (r.body?.tools ?? []).length > 0, 120_000, 'DISC model request')
    if (discReq === null) dieFatal(`L0 discovery request absent; cannot compute the deny list`)
    const surface = (discReq.body.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t)).sort()
    writeEvidence('l0-surface.json', { surface })
    // denyList: builtinToolDeny is applied with `tools.restrict()` on the
    // agent scope, which ONLY names the inherited/global surface (run
    // 2026-10-15T22-21-48 typed error: "known global tools: bash, edit, read,
    // read_image, write" — team tools are OWN-layer registrations and are not
    // restrictable). So team_* names are always dropped from the deny list.
    const denyList = surface.filter((n) => !n.startsWith('team_')
      && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n) && !TEAM_TOOL_CATALOG.includes(n))
    writeFileSync(join(BLUEPRINT_DIR, 'a5p0-main.yaml'), savedBlueprintYaml(denyList))
    log(`main blueprint written (denyList=${denyList.length} names)`)

    // ══ I2 ══
    const liveBefore = new Set(booted.health.body?.liveSessions ?? [])
    const createX = await remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_L1 },
    }, 'a5x')
    writeEvidence('i2-team-create.json', createX.body ?? createX)
    const createOk = createX.status === 200 && createX.body?.result?.ok === true && createX.body?.result?.value?.data?.path === 'fresh-root'
    check('I2a', 'I2: team.create (remote HTTP) creates the fresh root team session', createOk,
      `status=${String(createX.status)} body=${JSON.stringify(createX.body ?? createX).slice(0, 300)}`)
    if (!createOk) fail('I2a')

    const cat = await remoteCall(booted.origin, booted.cookie, 'catalog.list', {}, 'a5cat')
    writeEvidence('i2-catalog-list.json', cat.body ?? cat)
    const catOk = cat.status === 200 && JSON.stringify(cat.body ?? '').includes(BP_MAIN_ID)
    check('I2b', 'I2: catalog.list (public endpoint) serves the saved blueprint', catOk, `status=${String(cat.status)}`)
    if (!catOk) fail('I2b')

    // Leader chain: create_member x2 + async delegate M1.
    const l1Done = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_L1) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'A5P0_L1_DONE', 180_000, 'L1 leader chain done')
    if (l1Done === null) { check('I2c', 'I2: Leader (mock script) created both members and delegated to M1', false, `requests=${String(mock.requests.length)}`); fail('I2c') }
    const createResults = l1Done === null ? [] : toolMsgsOf(l1Done).slice(0, 2).map((r) => String(r.text ?? ''))
    writeEvidence('i2-member-create-results.json', createResults.map((c) => c.slice(0, 1500)))
    const instanceIds = createResults.map((c) => extractInstanceId(c))
    const membersCreated = instanceIds.length === 2 && instanceIds.every((v) => v !== null)
    check('I2c', 'I2: Leader (mock script) create member x2 (instanceIds) + async delegate to M1', l1Done !== null && membersCreated,
      `instanceIds=${JSON.stringify(instanceIds)}`)
    if (!(l1Done !== null && membersCreated)) fail('I2c')

    const proj = await remoteCall(booted.origin, booted.cookie, 'team.getProjection', { teamSessionId: CREATE_ROOT }, 'a5proj')
    writeEvidence('i2-projection.json', proj.body ?? proj)
    const projHasMembers = proj.status === 200 && JSON.stringify(proj.body ?? '').includes(String(instanceIds[0]))
    const h2 = await fetchJson(`${booted.origin}/__p6t6/health`, undefined, 10_000)
    const liveAfter = new Set(h2.body?.liveSessions ?? [])
    const newLive = [...liveAfter].filter((s) => !liveBefore.has(s) && s !== CREATE_ROOT)
    const sessList = await apiCall(booted.origin, booted.cookie, 'session/list', {}, 'a5list')
    writeEvidence('i2-session-list.json', sessList.body ?? sessList)
    check('I2d', 'I2: member sessions active — projection carries the instances; p6t6 liveSessions grew (root + 2 members); session/list recorded',
      projHasMembers && newLive.length >= 2,
      `projectionHasInstance=${String(projHasMembers)} newLive=${JSON.stringify(newLive)}`)
    if (!(projHasMembers && newLive.length >= 2)) fail('I2d')

    // ══ I3: M1 native read (real body) ══
    const m1native = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_M1) && toolMsgsOf(r).length === 1, 180_000, 'M1 native read result')
    const nativeResult = m1native === null ? '' : toolResultText(m1native, 0)
    writeEvidence('i3-native-read.json', { seq: m1native?.seq ?? null, result: nativeResult.slice(0, 1200) })
    const i3ok = check('I3', 'I3: member native tool REAL execution — scripted read returned the unique on-disk seed content',
      nativeResult.includes(SEED_UNIQUE) && !nativeResult.includes(ADAPTER_MARK),
      `result=${nativeResult.slice(0, 200)}`)
    if (!i3ok) fail('I3')

    // ══ I4a: ARM (token-bearing read) then same-name Adapter ══
    // The pre-execute listener arms synchronously BEFORE the token call's own
    // dispatch, so the arm call itself already lands on the Adapter (marker
    // line 1); the next seed read is the asserted leg (marker line 2) and its
    // native characteristics must be gone.
    const m1armed = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_M1) && toolMsgsOf(r).length === 3, 180_000, 'M1 ARM read result')
    const armResult = m1armed === null ? '' : toolResultText(m1armed, 1)
    writeEvidence('i4-arm-read.json', { seq: m1armed?.seq ?? null, result: armResult.slice(0, 800) })
    const m1adp = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_M1) && toolMsgsOf(r).length === 4, 180_000, 'M1 adapter read result')
    const adpResult = m1adp === null ? '' : toolResultText(m1adp, 2)
    writeEvidence('i4-adapter-read.json', { seq: m1adp?.seq ?? null, result: adpResult.slice(0, 1200) })
    writeEvidence('i4-plugin-log.json', { pluginLog: existsSync(PLUGIN_LOG) ? readFileSync(PLUGIN_LOG, 'utf8').split('\n').slice(-40) : '<missing>' })
    const i4aok = check('I4a', 'I4: after restrict-first + same-name register (preset plugin, armed member scope) — the same read call yields the Adapter marker text and the native output characteristics are GONE',
      adpResult.includes(ADAPTER_MARK) && !adpResult.includes(SEED_UNIQUE) && markerLineCount() === 2,
      `adapterResult=${adpResult.slice(0, 160)} armResult=${armResult.slice(0, 120)} markerLines=${String(markerLineCount())}`)
    if (!i4aok) fail('I4a')

    // ══ I4b: control member (same boot, same preset, own scope never armed) ══
    const d2 = await apiPrompt(booted.origin, booted.cookie, CREATE_ROOT, `${MK_D2} Now delegate the control script to m-ctl (second member): one read of the seed file. rootSessionId=${CREATE_ROOT}`)
    if (d2.status !== 200) fail('I4b')
    const m2done = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_M2) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'A5P0_M2_DONE', 180_000, 'M2 control chain done')
    const m2req = m2done === null ? null : mock.requests.find((r) => r.body !== null && lastUserTextOf(r).includes(MK_M2) && toolMsgsOf(r).length === 1)
    const ctlResult = m2req === undefined || m2req === null ? '' : toolResultText(m2req, 0)
    writeEvidence('i4-control-read.json', { seq: m2req?.seq ?? null, result: ctlResult.slice(0, 1200) })
    const i4bok = check('I4b', 'I4: control member (own scope NOT armed) keeps the native body — read returns seed content, no Adapter marker, marker file unchanged',
      ctlResult.includes(SEED_UNIQUE) && !ctlResult.includes(ADAPTER_MARK) && markerLineCount() === 2,
      `ctlResult=${ctlResult.slice(0, 160)} markerLines=${String(markerLineCount())}`)
    if (!i4bok) fail('I4b')

    // ══ I5: dispose (restrict KEPT) -> typed unknown, no native fallback ══
    // M1 chain results ride: [0]=seed native, [1]=arm->adapter, [2]=seed
    // adapter, [3]=dispose-token read (typed unknown — the assembly drops
    // before its own dispatch), [4]=seed read after dispose (typed unknown).
    // The request carrying results[3]+[4] is the one that replies DONE
    // (oracle case 5). Run 22-40-27 pinned this ride; asserting a 6-result
    // request was the kit's off-by-one, not host behavior.
    const m1done = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_M1) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'A5P0_M1_DONE', 180_000, 'M1 chain done (carries the post-dispose results)')
    const dispResult = m1done === null ? '' : toolResultText(m1done, 3)
    const unkResult = m1done === null ? '' : toolResultText(m1done, 4)
    writeEvidence('i5-unknown-read.json', { seq: m1done?.seq ?? null, resultsTotal: m1done === null ? null : toolMsgsOf(m1done).length, disposeRideResult: dispResult.slice(0, 400), result: unkResult.slice(0, 1200) })
    // Session-event evidence: the public core read (session/page) over every
    // member session (which id is M1 is not fixed, so scan all new sessions).
    const memberPages = []
    for (const sid of newLive.filter((s) => s !== CREATE_ROOT)) {
      const page = await apiCall(booted.origin, booted.cookie, 'session/page', { sessionId: sid, limit: 200 }, 'a5page')
      memberPages.push({ sessionId: sid, status: page.status, raw: page.body })
    }
    writeEvidence('i5-session-pages.json', memberPages)
    const pagesText = JSON.stringify(memberPages.map((p) => p.raw ?? null))
    const pageHasUnknown = pagesText.toLowerCase().includes('unknown')
    const pageHasAdapter = pagesText.includes(ADAPTER_MARK)
    const i5ok = check('I5', 'I5: safe-unload — after dispose (restrict kept) the same name yields the typed unknown-tool result in the turn (no native fallback: seed content absent, marker count unchanged)',
      m1done !== null && /unknown tool|unknown_tool|UNKNOWN_TOOL/i.test(unkResult) && !unkResult.includes(SEED_UNIQUE) && markerLineCount() === 2,
      `unkResult=${unkResult.slice(0, 200)} markerLines=${String(markerLineCount())} sessionPageUnknown=${String(pageHasUnknown)} sessionPageAdapter=${String(pageHasAdapter)}`)
    if (!i5ok) fail('I5')
    check('I5z', 'I5 (closure): the M1 scripted chain terminated after the unknown-tool result', m1done !== null, `m1done=${String(m1done === null ? 'null' : m1done.seq)}`)
    if (m1done === null) fail('I5z')
  } catch (error) {
    log(`UNCAUGHT in increment sequence: ${String(error?.stack ?? error)}`)
    writeEvidence('uncaught.json', { error: String(error?.message ?? error), stack: redact(String(error?.stack ?? '')) })
  } finally {
    log('teardown: stopping host + mock')
    writeEvidence('instance-tail.txt', logTail(booted.instanceLog, 120))
    if (existsSync(PLUGIN_LOG)) writeEvidence('adapter-plugin.log.copy', readFileSync(PLUGIN_LOG, 'utf8'))
    stopHost(host)
    try { await mock.close() } catch { /* best-effort */ }
    await new Promise((r) => setTimeout(r, 1500))
    const port3185After = await portFree(HOST_PORT)
    const postStable = { p3080: await probeStableInstance('http://127.0.0.1:3080/'), p3180: await probeStableInstance('http://127.0.0.1:3180/') }
    const tuDirty = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' }).stdout.trim().length
    const tuHead = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' }).stdout.trim()
    writeEvidence('post-probes.json', { port3185FreeAfterTeardown: port3185After, postStable, testUsePorcelainLines: tuDirty, testUseHead: tuHead, hostPid: host.pid, hostExited: host.exitInfo.exited })
    if (FLAG_KEEP) log(`--keep: world retained at ${HOME}`)
    else { rmSync(HOME, { recursive: true, force: true }); log(`world removed (${HOME})`) }
    const passed = criteria.filter((c) => c.ok).length
    const inc = (p) => criteria.filter((c) => c.id.startsWith(p)).every((c) => c.ok) && criteria.some((c) => c.id.startsWith(p))
    const summary = {
      runStamp: RUN_STAMP, hostBaseline: HOST_BASELINE_SHA, hostPort: HOST_PORT, mockPort: mock.port,
      hostPid: host.pid, worktree: WORKTREE, criteria, passed, total: criteria.length, failed: FAILS,
      increments: { I1: inc('I1'), I2: inc('I2'), I3: inc('I3'), I4: criteria.filter((c) => c.id.startsWith('I4')).every((c) => c.ok), I5: inc('I5') && inc('I5z') },
      stable: { pre: preStable, post: postStable }, port3185FreeAfterTeardown: port3185After,
      verdict: FAILS.length === 0 ? 'PASS' : 'FAIL',
    }
    writeEvidence('summary.json', summary)
    writeEvidence('mock-requests.json', mock.requests.map((r) => ({ seq: r.seq, status: r.status ?? null, userHead: lastUserTextOf(r).slice(0, 120), toolMsgAfterTrigger: toolMsgsOf(r).length, reply: r.reply })))
    log(`VERDICT ${summary.verdict} — ${String(passed)}/${String(criteria.length)} criteria${FAILS.length > 0 ? `; failed: ${FAILS.join(',')}` : ''}`)
  }

  process.exit(FAILS.length === 0 ? 0 : 2)
}

main().catch((e) => {
  try {
    log(`FATAL uncaught: ${redact(String(e?.stack ?? e))}`)
    writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: redact(String(e?.message ?? e)), criteria })
  } catch { /* best-effort */ }
  process.exit(1)
})
