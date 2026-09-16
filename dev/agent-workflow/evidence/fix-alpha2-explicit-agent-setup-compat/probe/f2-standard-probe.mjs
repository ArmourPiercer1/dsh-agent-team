#!/usr/bin/env node
/**
 * F2 — standard-preset A/B/C surface PROBE (PR #17 review follow-up,
 * instruction F2; memo in
 * evidence/fix-alpha2-explicit-agent-setup-compat/
 * pr17-review-followup-instructions.md).
 *
 * Question: on the real DSH 0.1.5-rc.2 host with the SHIPPED `standard`
 * preset + a leader `capabilities.permissions` policy (strict Coverage
 * Gate), WHEN does the preset's deferred `subagent` install (a per-agent
 * own-layer registration — `dsh-tool-subagent` with
 * `modelSelectionSettings: true`, installed on `agent/created`) land
 * relative to:
 *
 *   A — the Coverage Gate's `tools.schemas(agent)` read (during the
 *       AgentSetup callback, i.e. during agent composition);
 *   B — after `agents.create()` resolves / publication (`publish` ->
 *       `agents.announce` -> `agent/created`);
 *   C — the first model request (the model-facing `body.tools`).
 *
 * `subagent` and `subagent_fork` are tracked SEPARATELY at each moment
 * (instruction F2): `subagent_fork` is named in the blueprint's
 * `builtinToolDeny` (it installs immediately into a restrictable layer,
 * so an undenied `subagent_fork` would FATAL the gate at A and confound
 * the subagent timing question); `subagent` is deliberately NOT denied
 * (instruction: 不主动 deny subagent) — it is the subject of the probe.
 *
 * Method (probe only — no production code change):
 *   LEG 0 (DISC control) — the boot root (legacy blueprint, no
 *         capabilities) gets one prompt; the mock model records the
 *         boot leader's first model-facing surface. Expected: the full
 *         standard-preset discovery surface (38 = 27 preset tools incl.
 *         subagent + 11 team tools, as captured in
 *         runs/a2x-smoke-20260914T07-34-10Z) — proves the standard
 *         preset's subagent machinery is ACTIVE in this world before the
 *         permissions leg.
 *   LEG 1 (the probe) — a fresh-root `team.create` with the leader
 *         `capabilities.permissions` blueprint (20-name builtinToolDeny
 *         = the standard preset's 26 restrictable names minus the six
 *         fs-owned tools {bash, read, read_image, write, edit,
 *         todo_write}, INCLUDING subagent_fork, EXCLUDING subagent):
 *         - gate FAILS with known-sensitive-unmanaged `subagent`
 *           -> subagent ∈ A  -> CASE A (setup-blocked; subagent present
 *              at the gate);
 *         - gate PASSES and subagent ∈ B or C
 *           -> CASE B (P1 POST-GATE SURFACE EXPANSION);
 *         - gate PASSES and subagent ∉ A, B, C
 *           -> GREEN (no post-gate expansion observed).
 *         `initialWork` triggers the leader's first model request (the
 *         C capture through the mock).
 *
 * The probe row (f2-standard-probe-row.mjs) snapshots
 * `tools.schemas(agent)` at agent/created (+microtask/+250ms/+2s), every
 * tools/change, and a 1s re-scan — the B/C timeline evidence.
 *
 * The probe is a CLASSIFICATION run: GREEN is NOT required (instruction
 * F2). Exit 0 = classification completed (any case); 2 = host boot
 * failure; 3 = DISC control mismatch (world broken); 4 = model-request
 * capture failure; 5 = probe-row timeout.
 */
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ── constants ───────────────────────────────────────────────────────────────

const PROBE_DIR = dirname(fileURLToPath(import.meta.url))
// dev/agent-workflow/evidence/fix-alpha2-explicit-agent-setup-compat/probe
// -> five up = the task worktree root.
const WORKTREE = resolve(PROBE_DIR, '..', '..', '..', '..', '..')
if (!existsSync(join(WORKTREE, 'packages', 'runtime')) || !existsSync(join(WORKTREE, '.git'))) {
  console.error(`FATAL ${WORKTREE} is not a dsh-agent-team worktree (packages/runtime or .git missing)`)
  process.exit(1)
}

const LIVE_HOST_DIR = join(WORKTREE, 'tests', 'live-host-015rc2', 'node_modules', '@deepseek-ai', 'dsh')
const LIVE_HOST_PKG = JSON.parse(readFileSync(join(LIVE_HOST_DIR, 'package.json'), 'utf8'))
if (LIVE_HOST_PKG.version !== '0.1.5-rc.2') {
  console.error(`FATAL tests/live-host-015rc2 host version is ${LIVE_HOST_PKG.version}, expected 0.1.5-rc.2 (reinstall: npm install --no-save @deepseek-ai/dsh@0.1.5-rc.2)`)
  process.exit(1)
}
const HOST_BIN = join(LIVE_HOST_DIR, 'lib', 'bin.js')
if (!existsSync(HOST_BIN)) {
  console.error('FATAL host bin missing (tests/live-host-015rc2 not installed)')
  process.exit(1)
}

const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_NAME = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'host.js')).href
const PRODUCTION_GLUE_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
const SEAM_URL = pathToFileURL(join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const PROBE_ROW_NAME = pathToFileURL(join(PROBE_DIR, 'f2-standard-probe-row.mjs')).href

function utcStamp() {
  const d = new Date().toISOString()
  return `${d.slice(0, 4)}${d.slice(5, 7)}${d.slice(8, 10)}T${d.slice(11, 13)}-${d.slice(14, 16)}-${d.slice(17, 19)}Z`
}
const RUN_STAMP = `f2-standard-probe-${utcStamp()}`
const RUN_DIR = join(PROBE_DIR, 'runs', RUN_STAMP)
const HOME = join(WORKTREE, 'tests', 'homes', `f2-standard-probe-${utcStamp()}`)
const BLUEPRINT_DIR = join(RUN_DIR, 'blueprints')

const HOST_PORT_CANDIDATES = [3180, 3181, 3182, 3183, 3184, 3185, 3186]
const MOCK_PORT = 3496
const STABLE_URL = 'http://127.0.0.1:3080/'
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

const ROOT = `session-f2root-${RUN_STAMP}`
const CREATE_ROOT = `session-f2created-${RUN_STAMP}`
const MK_DISC = `F2_DISC_${RUN_STAMP}`
const MK_F2 = `F2_PROBE_${RUN_STAMP}`
const SAVED_BLUEPRINT_ID = 'team.f2-perm'

/**
 * The 20-name builtinToolDeny (the standard preset's 26 restrictable
 * names — its 27 non-team discovery tools minus the own-layer `subagent`
 * that tools.restrict() cannot name — minus the six fs-owned tools
 * {bash, read, read_image, write, edit, todo_write}):
 *
 *   KNOWN_SENSITIVE (gate FATAL if present unmanaged): glob, grep,
 *   ralph, send_message, skill(no — skill is NOT sensitive; kept for
 *   surface minimality), subagent_fork, web_fetch, web_search,
 *   workflow, job_kill, job_list, job_output
 *   + the remaining non-owned tools: ask_user_question, create_goal,
 *   exit_plan_mode, get_goal, interrupt_agent, list_agents, present,
 *   update_goal
 *
 * `subagent` is deliberately ABSENT from this list (instruction F2:
 * 不主动 deny subagent) — its timing at A/B/C is the probe subject.
 */
const DENY_LIST = [
  'ask_user_question',
  'create_goal',
  'exit_plan_mode',
  'get_goal',
  'glob',
  'grep',
  'interrupt_agent',
  'job_kill',
  'job_list',
  'job_output',
  'list_agents',
  'present',
  'ralph',
  'send_message',
  'skill',
  'subagent_fork',
  'update_goal',
  'web_fetch',
  'web_search',
  'workflow',
]

// TEST_METHODS §7 — the probe home is ephemeral: best-effort removal on
// every exit path (the dieFatal / unhandled-rejection paths exit without
// running the main-flow teardown).
process.on('exit', () => {
  try {
    if (existsSync(HOME)) rmSync(HOME, { recursive: true, force: true })
  } catch { /* best-effort */ }
})

// ── logging / fatals ────────────────────────────────────────────────────────

let RUN_LOG = null
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  if (RUN_LOG !== null) {
    try {
      appendFileSync(RUN_LOG, stamped + '\n')
    } catch { /* evidence best-effort */ }
  }
}

function dieFatal(msg, code) {
  log(`FATAL ${msg}`)
  try {
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify({ probe: 'f2-standard-surface', stamp: RUN_STAMP, fatal: msg }, null, 2))
  } catch { /* best-effort */ }
  process.exit(code ?? 1)
}

// ── small http helpers ──────────────────────────────────────────────────────

async function fetchJson(url, init, timeoutMs = 60_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ status: 0, body: null, error: e.message }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body }
}

async function probeStableInstance() {
  const res = await fetch(STABLE_URL, { signal: AbortSignal.timeout(5_000) }).catch(() => null)
  return { status: res === null ? 'unreachable' : res.status }
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
async function remoteCall(origin, cookie, method, params) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `f2-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version: 1, params },
    }),
  }, 180_000)
}

/**
 * One user turn on the DSH core public channel: POST /api/session/prompt.
 * Bounded retry ONLY on session/not-found (the boot root's session-index
 * registration can lag the boot marker by a few hundred ms); the requestId
 * is stable across retries so an accepted prompt is never double-admitted.
 */
async function apiPrompt(origin, cookie, sessionId, text, attempt = 0, requestId = `f2-${Math.random().toString(36).slice(2, 12)}`) {
  const data = await fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `f2-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: {
        args: {
          request: {
            requestId,
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text }],
          },
        },
      },
    }),
  }, 180_000)
  const result = data.body?.result ?? {}
  if (data.status === 200 && result.ok === false && result.error?.code === 'session/not-found' && attempt < 5) {
    log(`prompt session/not-found (startup race, attempt ${attempt + 1}) — retrying after 2s`)
    await new Promise((r) => setTimeout(r, 2000))
    return apiPrompt(origin, cookie, sessionId, text, attempt + 1, requestId)
  }
  return data
}

// ── real-host boot (the a2x kit pattern) ────────────────────────────────────

const BOOT_BLUEPRINT = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.f2-boot',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the F2 probe boot team."',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

function teamRowConfig() {
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: BOOT_BLUEPRINT,
    // The saved-source catalog the remote team.create resolves from.
    blueprintDir: BLUEPRINT_DIR,
    // F2 SUBJECT: the SHIPPED standard preset (root + members) — its
    // spawn `subagent` row (modelSelectionSettings: true) is the deferred
    // per-agent own-layer installer under test. No user preset.
    rootPresetId: 'standard',
    memberPresetId: 'standard',
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'f2-probe-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: PRODUCTION_GLUE_URL,
    seamUrl: SEAM_URL,
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

function writePatchFile(patchPath) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const lines = [
    `# f2 standard-preset A/B/C probe patch layer (run ${RUN_STAMP}): production dsh-agent-team row (worktree dist, standard preset) + f2-standard-probe observer row — mounted ONLY through the public profile-patch seam (CORE PATCH BUDGET = 0).`,
    '# The probe row mounts FIRST (its listeners must be live before any team agent is composed).',
    '- insert:',
    ...yamlEmitItem({
      id: 'f2-standard-probe',
      name: PROBE_ROW_NAME,
      config: {
        outputPath: join(RUN_DIR, 'probe-timeline.jsonl'),
        readyPath: join(RUN_DIR, 'probe-ready.json'),
        rescanMs: 1000,
        rescanCount: 90,
      },
    }, 2),
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() }, 2),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

function savedBlueprintYaml() {
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${SAVED_BLUEPRINT_ID}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "You are the leader of the F2 standard-preset probe team."',
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    '        - team_send_message',
    '        - team_list_members',
    '    builtinToolDeny:',
    ...DENY_LIST.map((n) => `      - ${n}`),
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
    '            kind: any',
    '      ask:',
    '        - tool: write',
    '          resource:',
    '            kind: any',
    '      deny:',
    '        - tool: bash',
    '          resource:',
    '            kind: any',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

function logTail(logPath, n = 25) {
  try {
    return readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n')
  } catch {
    return '<no log>'
  }
}

async function waitForLogLine(logPath, regex, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  let seen = 0
  for (;;) {
    let text = ''
    try {
      text = readFileSync(logPath, 'utf8')
    } catch { /* not written yet */ }
    const lines = text.split('\n')
    for (let i = seen; i < lines.length; i += 1) {
      const m = regex.exec(lines[i])
      if (m !== null) return lines[i]
    }
    seen = lines.length
    if (Date.now() >= deadline) return null
    if (alive !== undefined && !alive()) return null
    await new Promise((r) => setTimeout(r, 300))
  }
}

function spawnNpmHost({ port, home, logPath }) {
  const outFd = openSync(logPath, 'a')
  const errFd = openSync(logPath, 'a')
  let child
  try {
    child = spawn(
      process.execPath,
      [HOST_BIN, 'web', '--port', String(port), '--no-open'],
      {
        cwd: LIVE_HOST_DIR,
        stdio: ['ignore', outFd, errFd],
        env: {
          ...process.env,
          DSH_HOME: home,
          DSH_CLIENT_COMMIT_HASH: 'npm-0.1.5-rc.2',
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

function stopNpmHost(h) {
  try {
    h.child.kill()
  } catch { /* already gone */ }
  return h
}

function dumpNpmConfig(home, destPath) {
  const r = spawnSync(
    process.execPath,
    [HOST_BIN, '--profile', 'web', '--dump-config'],
    { cwd: LIVE_HOST_DIR, encoding: 'utf8', timeout: 90_000, env: { ...process.env, DSH_HOME: home, DSH_CLIENT_COMMIT_HASH: 'npm-0.1.5-rc.2' } },
  )
  const text = `${r.stdout ?? ''}${r.stderr ?? ''}`
  try {
    writeFileSync(destPath, text)
  } catch { /* best-effort */ }
  return text
}

// ── the main probe ──────────────────────────────────────────────────────────

let mock = null
let host = null
let hostPort = null

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'probe.log')

  // Redlines: the stable instance is never touched; the mock port must be
  // free; the home must start absent (TEST_METHODS §7).
  const pre = await probeStableInstance()
  log(`:3080 pre = ${pre.status}`)
  if (pre.status !== 'unreachable') dieFatal(`stable instance :3080 is REACHABLE (${pre.status}) — refusing to run`, 2)
  const { portInUse } = await import(pathToFileURL(join(WORKTREE, 'tests', 'characterization', 'lib', 'util.mjs')).href)
  if (await portInUse(MOCK_PORT)) dieFatal(`mock port ${MOCK_PORT} is already in use — refusing`, 2)
  hostPort = null
  for (const candidate of HOST_PORT_CANDIDATES) {
    if (candidate === 3080) continue
    if (!(await portInUse(candidate))) { hostPort = candidate; break }
  }
  if (hostPort === null) dieFatal(`no free host port among ${HOST_PORT_CANDIDATES.join(', ')} — refusing`, 2)
  log(`port    = ${hostPort}`)
  if (existsSync(HOME)) dieFatal(`${HOME} already exists (TEST_METHODS §7 — the probe home must start absent)`, 2)
  mkdirSync(HOME, { recursive: true })

  // The mock model (the C capture + the DISC control surface).
  const { startMockModel } = await import(pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')).href)
  mock = await startMockModel({
    port: MOCK_PORT,
    decide: (ctx) => {
      const body = ctx?.req ?? ctx
      const msgs = Array.isArray(body?.messages) ? body.messages : []
      const userTexts = msgs
        .filter((m) => m?.role === 'user')
        .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
      if (userTexts.some((t) => t.includes(MK_DISC))) return { kind: 'text', content: `F2_DISC_ACK_${RUN_STAMP}` }
      if (userTexts.some((t) => t.includes(MK_F2))) return { kind: 'text', content: `F2_PROBE_ACK_${RUN_STAMP}` }
      return { kind: 'text', content: `F2 ack (${RUN_STAMP})` }
    },
    log: (l) => log(`mock: ${l}`),
  })
  if (mock.port !== MOCK_PORT) dieFatal(`mock landed on ${mock.port}, expected ${MOCK_PORT}`, 2)
  // Mirror the a2x kit's proven environment EXACTLY: the credentials
  // resolution (dsh-credentials) falls back to the env API key; a fresh
  // probe home has an empty .credentials.yaml, so without this the
  // adapter has no key and the first model call never reaches the mock.
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  process.env.DEEPSEEK_API_KEY = 'f2-standard-probe-mock-key'
  log(`mock DeepSeek endpoint up at 127.0.0.1:${MOCK_PORT}`)

  // The home: the patch layer (probe row + production row, standard
  // preset) + the saved probe blueprint.
  writePatchFile(join(HOME, 'profiles', 'web', 'cordis.patch.yml'))
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'f2-perm-team.yaml'), savedBlueprintYaml())
  writeFileSync(join(RUN_DIR, 'saved-blueprint.yaml'), savedBlueprintYaml())
  writeFileSync(join(RUN_DIR, 'deny-list.json'), JSON.stringify({ denyList: DENY_LIST, note: 'subagent deliberately NOT denied (the probe subject); subagent_fork denied (immediate restrictable install — an undenied copy would FATAL the gate at A and confound the subagent timing question)' }, null, 2))
  log(`patch   = ${join(HOME, 'profiles', 'web', 'cordis.patch.yml')}`)
  log(`home    = ${HOME}`)
  log(`run     = ${RUN_DIR}`)

  // Boot the real 0.1.5-rc.2 host.
  const logDir = join(RUN_DIR, 'instance')
  mkdirSync(logDir, { recursive: true })
  const instanceLog = join(logDir, `instance-port${hostPort}.log`)
  writeFileSync(instanceLog, '', { flag: 'w' })
  host = spawnNpmHost({ port: hostPort, home: HOME, logPath: instanceLog })
  const line = await waitForLogLine(instanceLog, BOOT_MARKER, 240_000, host.alive)
  if (line === null) {
    stopNpmHost(host)
    const detail = host.exitInfo.exited
      ? `process exited (code=${host.exitInfo.code} signal=${host.exitInfo.signal ?? 'none'}${host.exitInfo.message ? ` msg=${host.exitInfo.message}` : ''})`
      : 'no boot marker within 240s'
    dieFatal(`host boot failed: ${detail}\n--- log tail ---\n${logTail(instanceLog)}`, 2)
  }
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(line.replace(/.*dsh web:\s*/, ''))
  if (m === null) dieFatal(`unexpected boot url shape: ${line}`, 2)
  hostPort = Number(m[1])
  const origin = `http://127.0.0.1:${hostPort}`
  const cookie = await authenticate(origin, m[2]).catch((e) => dieFatal(`auth failed: ${e.message}`, 2))
  log(`host booted: ${line.trim()}`)

  // The probe row must be live (its ready marker) before any leg.
  const readyPath = join(RUN_DIR, 'probe-ready.json')
  const rDeadline = Date.now() + 120_000
  for (;;) {
    if (existsSync(readyPath)) break
    if (!host.alive()) dieFatal('host exited before the probe row became ready', 2)
    if (Date.now() >= rDeadline) dieFatal('probe row ready marker not written within 120s', 5)
    await new Promise((r) => setTimeout(r, 500))
  }
  log('probe row ready (observer live)')

  dumpNpmConfig(HOME, join(RUN_DIR, 'dump-config.txt'))

  const surfaceOf = (req) => (req === undefined || req === null)
    ? null
    : (req.body?.tools ?? [])
      .map((t) => t?.function?.name ?? t?.name)
      .filter((n) => typeof n === 'string')
      .sort()

  const waitForMockRequest = async (marker, timeoutMs) => {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const req = mock.requests.find((r) => (r.body?.messages ?? []).some((mm) => typeof mm.content === 'string' && mm.content.includes(marker)))
      if (req !== undefined) return req
      if (Date.now() >= deadline) return null
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  const result = {
    probe: 'f2-standard-surface',
    stamp: RUN_STAMP,
    hostVersion: LIVE_HOST_PKG.version,
    port: hostPort,
    mockPort: MOCK_PORT,
    distRow: PRODUCTION_ROW_NAME,
    port3080: { pre: pre.status, post: null },
    disc: null,
    gateOutcome: null,
    aSurface: null,
    bSurface: null,
    cSurface: null,
    subagent: { a: null, b: null, c: null, firstAppearanceLabel: null },
    subagentFork: { a: null, b: null, c: null, note: 'denied in the probe blueprint (builtinToolDeny) — masked at composition; expected absent at A/B/C' },
    case: 'INDETERMINATE',
    caseDetail: '',
  }

  // ── LEG 0: DISC control (the boot leader's full standard surface) ────────
  log('── leg 0: DISC control (boot root, standard preset, no capabilities) ──')
  const discPrompt = await apiPrompt(origin, cookie, ROOT, MK_DISC)
  log(`DISC prompt response: status=${discPrompt.status} body=${JSON.stringify(discPrompt.body).slice(0, 400)}`)
  if (discPrompt.status !== 200) {
    dieFatal(`DISC prompt failed: status=${discPrompt.status} body=${JSON.stringify(discPrompt.body).slice(0, 300)}`, 4)
  }
  if (discPrompt.body?.result?.ok === false) {
    const err = discPrompt.body.result.error ?? {}
    dieFatal(`DISC prompt rejected: code=${err.code} message=${err.message} (retries exhausted — the world's session registration did not settle)`, 4)
  }
  const discReq = await waitForMockRequest(MK_DISC, 120_000)
  if (discReq === null) {
    // Diagnostics before the fatal: the team projection, the session log
    // tail, and the mock request count say where the turn died.
    const diagProjection = await remoteCall(origin, cookie, 'team.getProjection', { teamSessionId: ROOT }).catch((e) => ({ status: 0, body: e.message }))
    log(`DIAG projection: ${JSON.stringify(diagProjection.body).slice(0, 600)}`)
    log(`DIAG mock requests so far: ${mock.requests.length}`)
    try {
      const { zstdDecompressSync } = await import('node:zlib')
      const { readdirSync } = await import('node:fs')
      const sessionsRoot = join(HOME, 'sessions')
      for (const dir of readdirSync(sessionsRoot)) {
        const sf = join(sessionsRoot, dir, 'session.v3.jsonl.zstd')
        if (existsSync(sf)) {
          const text = zstdDecompressSync(readFileSync(sf)).toString()
          log(`DIAG session ${dir} tail: ${text.split('\n').slice(-8).join(' | ').slice(0, 900)}`)
        }
      }
    } catch (e) {
      log(`DIAG session dump failed: ${e.message}`)
    }
    dieFatal('DISC model request not captured within 120s', 4)
  }
  const discSurface = surfaceOf(discReq)
  writeFileSync(join(RUN_DIR, 'disc-surface.json'), JSON.stringify({ reqSeq: discReq.seq, surface: discSurface }, null, 2))
  result.disc = { reqSeq: discReq.seq, surfaceCount: discSurface.length, surface: discSurface }
  log(`disc surface (${discSurface.length} tools): ${discSurface.join(', ')}`)
  // Control assertion: the standard preset's subagent machinery must be
  // ACTIVE in this world (the 07-34-10Z run captured 38 = 27 preset
  // tools incl. subagent + 11 team tools).
  if (!discSurface.includes('subagent')) {
    dieFatal(`DISC control mismatch: subagent absent from the boot leader's standard-preset surface (world broken — the probe premise fails). surface=${discSurface.join(', ')}`, 3)
  }
  if (!discSurface.includes('subagent_fork')) {
    dieFatal(`DISC control mismatch: subagent_fork absent from the standard surface (world broken). surface=${discSurface.join(', ')}`, 3)
  }
  log(`DISC control OK: subagent + subagent_fork present in the standard discovery surface (${discSurface.length} tools)`)

  // ── LEG 1: the permissions team.create (A evidence + B/C captures) ──────
  log('── leg 1: team.create with leader capabilities.permissions (standard preset) ──')
  const createAt = Date.now()
  const createRes = await remoteCall(origin, cookie, 'team.create', {
    rootSessionId: CREATE_ROOT,
    blueprintId: SAVED_BLUEPRINT_ID,
    initialWork: { prompt: MK_F2 },
  })
  const createAtRes = Date.now()
  writeFileSync(join(RUN_DIR, 'team-create.json'), JSON.stringify({ dispatchAt: createAt, responseAt: createAtRes, response: createRes }, null, 2))

  const createError = createRes.body?.result?.ok === false
    ? createRes.body?.result?.error
    : (createRes.status !== 200 || createRes.body?.result === undefined
        ? { code: 'TRANSPORT', message: `status=${createRes.status} body=${JSON.stringify(createRes.body).slice(0, 500)}`, details: null }
        : null)

  if (createError !== null) {
    // Gate (or setup) FAILED. NOTE: the remote error envelope does not
    // serialize the structured coverage detail (startRootAgent wraps the
    // rejection in TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED with
    // details {reason:'root-start-failed'}); the DETERMINISTIC MESSAGE
    // carries the unmanaged names verbatim:
    //   "permission coverage gate failed for instance '<id>': N unmanaged
    //    tool(s) on the final model-facing surface: <name>
    //    (known-sensitive-unmanaged | unknown-unmanaged), ...
    //    (code: alpha2-permission-coverage-unmanaged)"
    log(`team.create FAILED: code=${createError.code ?? '?'} message=${String(createError.message ?? '').slice(0, 300)}`)
    result.gateOutcome = { ok: false, code: createError.code ?? null, message: createError.message ?? null, details: createError.details ?? null }
    const msg = String(createError.message ?? '')
    const isCoverageFailure = msg.includes('alpha2-permission-coverage-unmanaged')
    const parsedUnmanaged = []
    if (isCoverageFailure) {
      for (const m of msg.matchAll(/([A-Za-z0-9_]+) \((known-sensitive-unmanaged|unknown-unmanaged)\)/g)) {
        parsedUnmanaged.push({ name: m[1], classification: m[2] })
      }
    }
    result.aSurface = {
      source: isCoverageFailure
        ? 'gate-error-message (the structured detail is not serialized through the remote envelope; the deterministic message carries the unmanaged names verbatim)'
        : 'unavailable (non-coverage failure)',
      unmanagedTools: parsedUnmanaged,
      note: 'the gate read is internal to the setup; the typed failure message is the A-surface evidence',
    }
    result.subagent.a = parsedUnmanaged.some((t) => t.name === 'subagent')
    result.subagentFork.a = parsedUnmanaged.some((t) => t.name === 'subagent_fork')
    // No model request is expected (the setup rolled back) — confirm idle.
    const stray = await waitForMockRequest(MK_F2, 5_000)
    result.cSurface = { source: 'not-captured', tools: null, strayRequest: stray !== null ? stray.seq : null }
    result.bSurface = { source: 'not-applicable (setup failed before publication)' }
    if (result.subagent.a) {
      result.case = 'A'
      result.caseDetail = 'subagent present in the gate surface (A): the Coverage Gate FATALs with known-sensitive-unmanaged before publication — the standard preset + capabilities.permissions is setup-blocked on 0.1.5-rc.2 (per instruction F2: record + candidate options list, no implementation)'
    } else {
      result.case = 'INDETERMINATE'
      result.caseDetail = `setup failed for a non-subagent reason (code=${createError.code ?? '?'}); the A/B/C subagent timing question is not answered by this run`
    }
  } else {
    // Gate PASSED — subagent ∉ A (otherwise the gate FATALs: subagent is
    // KNOWN_SENSITIVE). Capture C (the leader's first model request via
    // initialWork) + the probe timeline (B).
    log('team.create OK — gate passed (subagent not in the A surface)')
    result.gateOutcome = { ok: true, result: createRes.body?.result ?? null }
    result.aSurface = {
      source: 'implied-absent (gate passed)',
      note: 'subagent ∉ A: the gate classifies subagent KNOWN_SENSITIVE — a gate pass implies subagent was absent from the tools.schemas(agent) read at setup time',
    }
    result.subagent.a = false
    result.subagentFork.a = false

    const cReq = await waitForMockRequest(MK_F2, 120_000)
    if (cReq === null) dieFatal('C-capture model request not found within 120s after a successful team.create', 4)
    const cSurface = surfaceOf(cReq)
    writeFileSync(join(RUN_DIR, 'c-surface.json'), JSON.stringify({ reqSeq: cReq.seq, surface: cSurface }, null, 2))
    result.cSurface = { source: 'mock-model-request', reqSeq: cReq.seq, tools: cSurface }
    result.subagent.c = cSurface.includes('subagent')
    result.subagentFork.c = cSurface.includes('subagent_fork')
    log(`C surface (${cSurface.length} tools): ${cSurface.join(', ')}`)

    // The probe timeline (B evidence + the post-gate appearance order).
    // Give the deferred installs a settling window before reading.
    await new Promise((r) => setTimeout(r, 3_000))
    const timelinePath = join(RUN_DIR, 'probe-timeline.jsonl')
    let timeline = []
    try {
      timeline = readFileSync(timelinePath, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l))
    } catch { /* best-effort */ }
    writeFileSync(join(RUN_DIR, 'probe-timeline.snapshot.json'), JSON.stringify(timeline, null, 2))

    // The created leader's entries (its agent/created fired after the
    // gate; correlate by the response time B_ref = createAtRes).
    // CORRELATION: the 1s rescan window (90s from boot) is still alive at
    // team.create time, so the BOOT leader's rescan-N entries also fall
    // inside the t >= createAt-1000 window and carry the boot surface
    // (which includes subagent). B must describe the team.create leader,
    // so identify it (first created-sync after createAt that is not the
    // boot root) and filter by its agentId.
    const createdAfter = timeline.filter((e) => e.t >= createAt - 1000 && e.label === 'created-sync' && e.agentId !== ROOT)
    const newLeaderAgentId = createdAfter.length > 0 ? createdAfter[0].agentId : null
    result.teamCreateLeaderAgentId = newLeaderAgentId
    const leaderEntries = timeline.filter((e) => {
      if (e.t < createAt - 1000) return false
      if (e.label === 'row-applied') return false
      if (typeof e.label === 'string' && e.label.startsWith('rescan-heartbeat')) return false
      if (newLeaderAgentId !== null) return e.agentId === newLeaderAgentId
      return e.agentId !== ROOT
    })
    const bEntry = leaderEntries.find((e) => Array.isArray(e.tools) && e.tools.includes('subagent')) ??
      leaderEntries.find((e) => e.label === 'created-microtask') ??
      leaderEntries.find((e) => e.label === 'created-250ms') ??
      leaderEntries[0] ?? null
    result.bSurface = {
      source: 'probe-timeline (tools.schemas(agent) snapshots)',
      bRefAt: createAtRes,
      entries: leaderEntries.map((e) => ({ t: e.t, label: e.label, agentId: e.agentId, sessionId: e.sessionId, hasSubagent: Array.isArray(e.tools) ? e.tools.includes('subagent') : null, hasSubagentFork: Array.isArray(e.tools) ? e.tools.includes('subagent_fork') : null, toolCount: Array.isArray(e.tools) ? e.tools.length : null, error: e.error ?? null })),
      representative: bEntry === null ? null : { label: bEntry.label, tools: bEntry.tools ?? null, error: bEntry.error ?? null },
    }
    result.subagent.b = bEntry !== null && Array.isArray(bEntry.tools) ? bEntry.tools.includes('subagent') : false
    result.subagentFork.b = bEntry !== null && Array.isArray(bEntry.tools) ? bEntry.tools.includes('subagent_fork') : false
    const firstSub = leaderEntries.find((e) => Array.isArray(e.tools) && e.tools.includes('subagent'))
    result.subagent.firstAppearanceLabel = firstSub === undefined ? null : firstSub.label

    if (result.subagent.b || result.subagent.c) {
      result.case = 'B'
      result.caseDetail = 'P1 POST-GATE SURFACE EXPANSION: the Coverage Gate passed (subagent ∉ A — the gate reads tools.schemas(agent) during composition, before publish/announce) but the standard preset deferred its own-layer `subagent` install to the agent/created event dispatched at publication — subagent appears in the post-gate surface (B: ' + (result.subagent.b ? 'present' : 'absent') + ', C: ' + (result.subagent.c ? 'present' : 'absent') + '); first probe appearance: ' + (result.subagent.firstAppearanceLabel ?? 'never') + '. The gate-verified surface is therefore NOT the model-facing surface (instruction F2: mark + precise evidence + STOP; no fix in this round)'
    } else {
      result.case = 'GREEN'
      result.caseDetail = 'standard preset + capabilities.permissions: the gate passed and subagent is absent from B and C — no post-gate surface expansion observed on 0.1.5-rc.2'
    }
  }

  // Teardown.
  const post = await probeStableInstance()
  result.port3080.post = post.status
  stopNpmHost(host)
  await new Promise((r) => setTimeout(r, 1_000))
  if (mock !== null) {
    try {
      await mock.close()
    } catch { /* best-effort */ }
  }
  writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify(result, null, 2))
  log(`:3080 post = ${post.status}`)
  log(`CASE: ${result.case} — ${result.caseDetail.slice(0, 300)}`)
  log(`summary: ${join(RUN_DIR, 'summary.json')}`)
  process.exit(0)
}

main().catch((error) => {
  const msg = error instanceof Error ? (error.stack ?? error.message) : String(error)
  log(`FATAL (unhandled) ${msg}`)
  if (host !== null) stopNpmHost(host)
  if (mock !== null) mock.close().catch(() => {})
  process.exit(2)
})
