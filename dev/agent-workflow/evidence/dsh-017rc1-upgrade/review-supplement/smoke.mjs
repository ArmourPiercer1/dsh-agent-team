#!/usr/bin/env node
/**
 * smoke.mjs — the PR #29 review-supplement real-host smoke (H1–H3).
 *
 * Closes the guide §11.3 real-host items against the SUPPLEMENT state of
 * task/dsh-017rc1-upgrade (F1 peer + F2 preset policy + F3 retention),
 * on a FRESH 0.1.7-rc.1 host world (test-use @ 46a7f68b09), reusing the
 * U8 kit conventions (world layout, profile-patch seam, mock model,
 * boot-marker/auth/remoteCall helpers) — but NO mini-MCP, NO permission
 * lanes exercised, NO lifecycle legs: this is a focused smoke, not a
 * full U8 re-run (U8's vertical evidence already covers V1–V8).
 *
 *   H1  git-install compat on the real 0.1.7 host (F1 closure proof):
 *       fresh world + bare-clone + `dsh plugin add git+file://…#branch`
 *       → exit 0, NO incompatible/allow-version lines, NO
 *       ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED, NO allowBuilds, NO
 *       compatibility.json exemption grant — AND the peer is PROVEN
 *       read: the installed manifest carries
 *       peerDependencies['@deepseek-ai/dsh'] = '0.1.7-rc.1' and the
 *       host's OWN built evaluator (test-use app-boot lib) accepts the
 *       manifest at the running 0.1.7-rc.1 runtime while it would RAISE
 *       an issue at 0.1.5-rc.2 (the gate now constrains the plugin —
 *       the pre-supplement state was unconstrained by construction).
 *
 *   H2  boot + roster read + Team creation (F2 real-host proof):
 *       host boot → unauth 401 → cookie → `POST /api/agentPresets/list`
 *       with the ACTUAL wire value of `modeSelectionEnabled` recorded
 *       (the guide's §11 note: source evidence if the field turns out
 *       deprecated — it is live: the roster returns it) → strict
 *       blueprint write + `team-remote/team.create` (v2) with minimal
 *       initial work → the leader's first model request observed at the
 *       mock (persona + model selection) and the create response ok.
 *
 *   H3  session coexistence + catalog wire shape (F3 real-host proof):
 *       the ordinary main session (row boot root) + the created team
 *       root + one freshly created ordinary session coexist in the
 *       catalog; a FRESH client connection (second launch-token cookie =
 *       a distinct client identity) sees the SAME catalog (no row
 *       loss across a new connection). Wire facts established by the
 *       session-controller source (types.ts + client service.ts):
 *       session/list rows are `SessionSummary` — they carry NO
 *       `retainedBy` field; `retainedBy` is a client-LOCAL merge of
 *       per-connection retain counts into the local list snapshot
 *       (`publishRetention`), and `retainInfo`/`retain`/`release` are
 *       client-context services with NO wire RPC endpoint — so the
 *       open-mode invariant is pinned by the client R1–R3 tests, and
 *       the wire-level observables are the row shape + catalog
 *       contents + reconnect stability (all asserted here).
 *
 * World discipline (TEST_METHODS §7): DSH_HOME =
 * tests/homes/rs-017rc1-<stamp> under the MAIN repo; XDG_DATA_HOME =
 * <world>/.xdg; TMPDIR = <world>/tmp. Host port = first free in
 * 3491–3500 (mock band excluded); mock = 3496. :3080/:3180 untouched.
 * The test-use checkout must be pristine @ 46a7f68b09 before and after.
 *
 * Usage: node smoke.mjs
 */
import {
  appendFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync,
  rmSync, writeFileSync,
} from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ── frozen facts ────────────────────────────────────────────────────────────
const MAIN_REPO = '/home/user/dsh-plugins/dsh-agent-team'
const WORKTREE = join(MAIN_REPO, '.worktrees', 'dsh-017rc1-upgrade')
const TESTUSE = join(MAIN_REPO, 'tests', 'deepseek-harness-test-use')
const HOST_PIN = '46a7f68b0922371ce7144b668b90e377d8e799f4' // DSH 0.1.7-rc.1
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const BRANCH = 'task/dsh-017rc1-upgrade'
const MOCK_MODULE = join(WORKTREE, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')
const APP_BOOT_LIB = join(TESTUSE, 'packages', 'boot', 'app-boot', 'lib', 'index.js')
const EXPECTED_PEER_RANGE = '0.1.7-rc.1' // the exact RC range (F1)

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const HOME = join(MAIN_REPO, 'tests', 'homes', `rs-017rc1-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const XDG = join(HOME, '.xdg')
const WORLD_TMP = join(HOME, 'tmp')
const REPO_GIT = join(HOME, 'repo.git')
const PROFILE_DIR = join(HOME, 'profiles', 'web')
const SPILL_ROOT = join(HOME, 'spill')
const BLUEPRINT_DIR = join(HOME, 'blueprints')
const SUPP_DIR = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'dsh-017rc1-upgrade', 'review-supplement')

const HOST_PORT_RANGE = []
for (let p = 3491; p <= 3500; p += 1) HOST_PORT_RANGE.push(p)
const MOCK_PORT = 3496

const ROOT = `session-rs-root-${RUN_STAMP}` // the boot main (ordinary) session
const CREATE_ROOT = `session-rs-team-${RUN_STAMP}` // the team.create pre-allocation
const ORD_SESSION = `session-rs-ord-${RUN_STAMP}` // the H3 freshly-created ordinary session
const BP_ANCHOR_ID = 'team.rs-anchor'
const BP_MAIN_ID = 'team.rs-main'
const MODEL_ID = `rs-model-${RUN_STAMP}`
const P_LEADER = `RSLEADER_PERSONA_${RUN_STAMP}`
const P_WORKER = `RSWORKER_PERSONA_${RUN_STAMP}`
const MK_CREATE = `RS2CREATE_${RUN_STAMP}`

// The LEG0 discovery-computed builtin deny list from the U8 DEFINITIVE run
// (same host 0.1.7-rc.1 @ 46a7f68b09 + same shipped `standard` preset →
// identical unmanaged surface; proven byte-for-byte in u8/v2-team/leg0-denylist.json).
const DENY_LIST = [
  'ask_user_question', 'create_goal', 'exit_plan_mode', 'get_goal', 'glob', 'grep',
  'interrupt_agent', 'job_kill', 'job_list', 'job_output', 'list_agents', 'present',
  'send_message', 'skill', 'subagent_fork', 'update_goal', 'web_fetch', 'web_search',
  'workflow',
]
const LEADER_TEAM_TOOLS_ALLOW = [
  'team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member',
  'team_delegate', 'team_follow_up', 'team_collect', 'team_send_message',
  'team_report_progress', 'team_request_control', 'team_resolve_control',
  'team_list_pending_control', 'team_archive_member',
]
const MEMBER_TEAM_TOOLS_ALLOW = ['team_send_message', 'team_report_progress']

// ── evidence + checks ───────────────────────────────────────────────────────
const checks = []
function check(leg, name, ok, detail = '') {
  checks.push({ leg, name, ok, detail })
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} [${leg}] ${name}${ok || detail === '' ? '' : ` — ${detail}`}\n`)
}
function writeEvidence(leg, file, content) {
  const dir = join(SUPP_DIR, leg)
  mkdirSync(dir, { recursive: true })
  const p = join(dir, file)
  writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2))
  return p
}
function logTail(path, n = 40) {
  try { return readFileSync(path, 'utf8').split('\n').filter((l) => l.length > 0).slice(-n).join('\n') } catch { return '<no log>' }
}
function dieFatal(msg) {
  writeEvidence('fatal', 'fatal.json', { message: msg, at: new Date().toISOString() })
  process.stdout.write(`FATAL: ${msg}\n`)
}
function finish(code) {
  const failed = checks.filter((c) => c.ok === false)
  writeEvidence('summary', 'summary.json', {
    runStamp: RUN_STAMP,
    world: HOME,
    hostPin: HOST_PIN,
    branch: BRANCH,
    checks: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    failedChecks: failed,
  })
  process.stdout.write(`\n${checks.length - failed.length}/${checks.length} checks passed. world=${HOME}\n`)
  process.exit(code)
}

// ── helpers (U8 kit patterns) ───────────────────────────────────────────────
async function fetchJson(url, init, timeoutMs = 60_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ status: 0, body: null, error: e.message }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body }
}
async function portFree(port, timeoutMs = 1500) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(timeoutMs) })
    return false
  } catch {
    return true
  }
}
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie !== null) return setCookie.split(';', 1)[0]
  if (res.status >= 200 && res.status < 300) throw new Error(`authenticate: no set-cookie and status=${res.status}`)
  throw new Error(`authenticate: unexpected status=${res.status}`)
}
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/
async function waitForLogLine(logPath, regex, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  const midScanAt = Date.now() + Math.floor(timeoutMs / 2)
  let midScanned = false
  const fullScan = () => {
    try {
      for (const l of readFileSync(logPath, 'utf8').split('\n')) {
        const m = regex.exec(l)
        if (m !== null) return l
      }
    } catch { /* best-effort */ }
    return null
  }
  let seen = 0
  for (;;) {
    let text = ''
    try { text = readFileSync(logPath, 'utf8') } catch { /* not written yet */ }
    const lines = text === '' ? [] : text.split('\n')
    for (let i = seen; i < lines.length; i += 1) {
      const m = regex.exec(lines[i])
      if (m !== null) return lines[i]
    }
    seen = lines.length
    if (midScanned === false && Date.now() >= midScanAt) {
      midScanned = true
      const hit = fullScan()
      if (hit !== null) return hit
    }
    if (Date.now() >= deadline) break
    if (alive !== undefined && !alive()) return null
    await new Promise((r) => setTimeout(r, 300))
  }
  return fullScan()
}
function spawnHost({ port, logPath }) {
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
          DSH_HOME: HOME,
          DSH_CLIENT_COMMIT_HASH: HOST_PIN.slice(0, 10),
          DEEPSEEK_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
          DEEPSEEK_API_KEY: 'rs-smoke-mock-key',
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
    exitInfo.message = String(error?.message ?? error)
  })
  child.on('close', (code, signal) => {
    exitInfo.exited = true
    exitInfo.code = code
    exitInfo.signal = signal
  })
  return { child, exitInfo, alive: () => !exitInfo.exited, logPath }
}
function stopHost(h) {
  try { h.child.kill('SIGTERM') } catch { /* already gone */ }
  return h
}
/** One user turn on the DSH core public channel: POST /api/session/prompt. */
async function apiPrompt(origin, cookie, sessionId, text, tag = 'rs') {
  return fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: { args: { request: { sessionId, text, source: 'ui' } } },
    }),
  }, 240_000)
}
async function apiCreateSession(origin, cookie, sessionId, cwd) {
  return fetchJson(`${origin}/api/session/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `rscreate-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/create',
      payload: { args: { request: { sessionId, cwd } } },
    }),
  }, 30_000)
}
/**
 * session/list — the typert descriptor names the reserved empty request
 * parameter `_request` (the host signature is `list(_request: SessionListRequest, …)`;
 * parameter names map 1:1 to args keys, `session/create` uses `request`).
 * The wire ROWS are `SessionSummary` (types.ts:177): agentAvailable /
 * sessionId / updatedAt / running / blank / parentSessionId? / origin? /
 * cwd? / projections? — NOTE: `retainedBy` is NOT a wire field; it is a
 * client-local merge of per-connection retain counts into the local list
 * snapshot (session-controller client service `publishRetention`), which
 * is exactly why the H3 check below asserts the SessionSummary shape and
 * records that retainedBy is client-side (R1–R3 pin the invariant).
 */
async function apiListSessions(origin, cookie, tag = 'rs') {
  return fetchJson(`${origin}/api/session/list`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `rslist-${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/list',
      payload: { args: { _request: {} } },
    }),
  }, 30_000)
}
async function apiListAgentPresets(origin, cookie, tag = 'rs') {
  return fetchJson(`${origin}/api/agentPresets/list`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `rspresets-${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'agentPresets/list',
      payload: { args: {} },
    }),
  }, 30_000)
}
async function remoteCall(origin, cookie, method, params, tag = 'rs', version = 1) {
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

// ── blueprints (U8 definitive shape, no MCP) ────────────────────────────────
const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 1',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  `  persona: "You are the leader of the rs supplement boot team. ${P_LEADER}"`,
  'members:',
  '  - templateId: worker-a',
  `    persona: "You are a worker of the rs supplement boot team. ${P_LEADER}"`,
  'memberEnvelopes: []',
  'requirements: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

function mainBlueprintYaml(denyList) {
  const capabilitiesBlock = (cap, teamTools) => {
    const s = (n) => ' '.repeat(n)
    const k = cap + 2
    const v = k + 2
    const i = v + 2
    const r = v + 2
    const rr = r + 2
    const rf = rr + 2
    return [
      `${s(cap)}capabilities:`,
      `${s(k)}teamTools:`,
      `${s(v)}kind: allow`,
      `${s(v)}items:`,
      ...teamTools.map((t) => `${s(i)}- ${t}`),
      ...(denyList.length === 0
        ? [`${s(k)}builtinToolDeny: []`]
        : [`${s(k)}builtinToolDeny:`, ...denyList.map((n) => `${s(i)}- ${n}`)]),
      `${s(k)}skills:`,
      `${s(v)}kind: allow`,
      `${s(v)}items: []`,
      `${s(k)}mcp:`,
      `${s(v)}kind: allow`,
      `${s(v)}items: []`,
      `${s(k)}permissions:`,
      `${s(v)}default: ask`,
      `${s(v)}allow:`,
      `${s(r)}- tool: read`,
      `${s(rr)}resource:`,
      `${s(rf)}kind: subtree`,
      `${s(rf)}path: team`,
      `${s(v)}ask:`,
      `${s(r)}- tool: bash`,
      `${s(rr)}resource:`,
      `${s(rf)}kind: any`,
      `${s(v)}deny:`,
      `${s(r)}- tool: read`,
      `${s(rr)}resource:`,
      `${s(rf)}kind: subtree`,
      `${s(rf)}path: runtime`,
    ]
  }
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${BP_MAIN_ID}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the rs supplement team. ${P_LEADER}`)}`,
    ...capabilitiesBlock(2, LEADER_TEAM_TOOLS_ALLOW),
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '    - request-control',
    '    - resolve-control',
    '    - archive-member',
    '    - restore-member',
    '  deny: []',
    'members:',
    '  - templateId: worker-b',
    '    displayName: "Worker B"',
    `    persona: ${JSON.stringify(`You are worker-b of the rs supplement team. ${P_WORKER}`)}`,
    ...capabilitiesBlock(4, MEMBER_TEAM_TOOLS_ALLOW),
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

// ── yaml emission (U8 kit shape — `insert` is a LIST of row items) ────────
// (The first kit revision hand-wrote the rows as a MAPPING under
// `insert:`; the patch parser silently ignored that shape and the bundle
// layer's machine-agnostic row survived — the boot root came up as
// `team-root` + `my-team-bp-1` instead of the configured row. The U8
// definitive shape is `- id: …` list items; the emitters below are the
// U8 helpers verbatim.)
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

/**
 * The profile's cordis.patch.yml (the public seam): the dsh-agent-team row
 * CONFIG OVERRIDE (named row, last-write-wins whole-config replace over the
 * bundle layer's machine-agnostic row — 0.1.7 preflight requires the SAME
 * name as the replaced row) + a config-only override of team-spill-local
 * pinning its spill root INSIDE the world.
 */
function writePatchFile(phase) {
  mkdirSync(PROFILE_DIR, { recursive: true })
  const lines = [
    `# rs review-supplement patch layer (run ${RUN_STAMP}, phase ${phase}): the public profile-patch seam — the dsh-agent-team row CONFIG OVERRIDE (named row, last-write-wins whole-config replace) and the team-spill-local spill-root pin.`,
    '- insert:',
    ...yamlEmitItem({
      id: 'dsh-agent-team',
      name: 'dsh-agent-team/host',
      config: {
        bootPhase: phase,
        rootSessionId: ROOT,
        blueprintSource: BP_ANCHOR_YAML,
        blueprintDir: BLUEPRINT_DIR,
        rootPresetId: 'standard',
        memberPresetId: 'standard',
        seedMembers: [],
        generation: 1,
        staticModel: { provider: 'deepseek-official', model: MODEL_ID },
        deniedSelection: null,
        mcpServers: [],
        environmentFacts: [
          { domain: 'tool', subject: 'web', available: true, generation: 1 },
          { domain: 'skill', subject: 'base', available: true, generation: 1 },
          { domain: 'persona', subject: 'standard', available: true, generation: 1 },
        ],
        externalPolicyFacts: { hard: {}, capabilityExists: {} },
      },
    }, 2),
    ...yamlEmitItem({ id: 'team-spill-local', name: 'dsh-agent-team/spill-local', config: { root: SPILL_ROOT } }, 2),
    '',
  ]
  writeFileSync(join(PROFILE_DIR, 'cordis.patch.yml'), lines.join('\n'))
  return join(PROFILE_DIR, 'cordis.patch.yml')
}

// ── mock request helpers ────────────────────────────────────────────────────
// waitForMock predicates receive mock RECORDS ({seq, body, …}); decide()
// receives the raw parsed BODY. bodyOf normalizes both (U8 kit precedent)
// — the run-4 bug was calling userTextOf on a RECORD without this, so the
// predicate could never match (record.messages is undefined).
function bodyOf(recordOrBody) {
  if (recordOrBody === null || typeof recordOrBody !== 'object') return null
  return 'body' in recordOrBody ? (recordOrBody.body ?? null) : recordOrBody
}
function msgTexts(m) {
  const c = m?.content
  if (typeof c === 'string') return [c]
  if (Array.isArray(c)) return c.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text)
  return []
}
function userTextOf(recordOrBody) {
  const req = bodyOf(recordOrBody)
  const msgs = req?.messages ?? []
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (m?.role !== 'user') continue
    const texts = msgTexts(m)
    if (texts.length > 0) return texts.join('\n')
  }
  return ''
}
function systemPromptOf(recordOrBody) {
  const req = bodyOf(recordOrBody)
  if (typeof req?.system === 'string' && req.system.length > 0) return req.system
  return (req?.messages ?? []).filter((mm) => mm.role === 'system')
    .map((mm) => (typeof mm.content === 'string' ? mm.content : JSON.stringify(mm.content ?? '')))
    .join('\n')
}
function toolsOf(recordOrBody) {
  const req = bodyOf(recordOrBody)
  return (req?.tools ?? []).map((t) => t?.function?.name ?? t?.name ?? null).filter((n) => n !== null)
}
async function waitForMock(mock, predicate, timeoutMs, what) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    for (const r of mock.requests) {
      if (predicate(r)) return r
    }
    if (Date.now() >= deadline) {
      process.stdout.write(`TIMEOUT waiting for: ${what} (requests=${mock.requests.length})\n`)
      return null
    }
    await new Promise((r) => setTimeout(r, 300))
  }
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now()
  mkdirSync(HOME, { recursive: true })
  mkdirSync(WORKSPACE, { recursive: true })
  mkdirSync(XDG, { recursive: true })
  mkdirSync(WORLD_TMP, { recursive: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'rs-anchor.yaml'), BP_ANCHOR_YAML)
  writeFileSync(join(BLUEPRINT_DIR, 'rs-main.yaml'), mainBlueprintYaml(DENY_LIST))

  // Worktree HEAD (dynamic — the supplement state, verified at commit time).
  const worktreeSha = spawnSync('git', ['-C', WORKTREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
  const worktreeDirty = spawnSync('git', ['-C', WORKTREE, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).stdout.trim()

  // ── H1: git-install compat on the real 0.1.7 host (F1 closure proof) ─────
  const SPEC = `git+file:///${REPO_GIT}#${BRANCH}`
  process.stdout.write(`── H1: git-install (S1–S3 + peer-read proof) ──\n`)
  let installedManifest = null
  {
    const clone = spawnSync('git', ['clone', '--bare', '--branch', BRANCH, WORKTREE, REPO_GIT], { encoding: 'utf8', timeout: 300_000 })
    if (clone.status !== 0) dieFatal(`git clone --bare failed: ${String(clone.stderr ?? clone.stdout).slice(0, 400)}`)
    const clonedSha = spawnSync('git', ['--git-dir', REPO_GIT, 'rev-parse', `refs/heads/${BRANCH}`], { encoding: 'utf8' }).stdout.trim()
    const dirtyNote = worktreeDirty === '' ? '' : ` (worktree dirty: ${worktreeDirty.split('\n').length} files — the smoke runs on the UNPUSHED state by design)`
    check('h1', 'S0 bare clone of the supplement branch; cloned tip == worktree HEAD',
      clonedSha === worktreeSha, `cloned=${clonedSha} worktree=${worktreeSha}${dirtyNote}`)
    const first = spawnSync(process.execPath, [HOST_BIN, 'plugin', '--profile', 'web', 'add', SPEC], {
      cwd: HOME,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      timeout: 900_000,
      env: {
        ...process.env,
        DSH_HOME: HOME,
        XDG_DATA_HOME: XDG,
        TMPDIR: WORLD_TMP,
      },
    })
    const addOut = `# exit=${first.status}\n# stdout\n${first.stdout ?? ''}\n# stderr\n${first.stderr ?? ''}\n`
    writeEvidence('h1-install', 'add.log', addOut)
    const all = `${first.stdout ?? ''}\n${first.stderr ?? ''}`
    check('h1', 'S1 first `dsh plugin add` exits 0 (the F1 peer DECLARED — the 0.1.7 compat gate now evaluates it and it PASSES at the running runtime)',
      first.status === 0, `exit=${first.status}`)
    check('h1', 'S1 NO 0.1.7 incompatible line / allow-version exemption prompt in the add output (no exemption needed: the declared range matches the running runtime)',
      !/incompatible|allow-version/i.test(all),
      `output had ${/incompatible|allow-version/i.test(all) ? 'MATCHES' : 'no matches'} (full output in h1-install/add.log)`)
    check('h1', 'S1 no ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED (install surface committed prebuilt; zero lifecycle scripts)',
      !/ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED/.test(all), '')
    let allowBuilds = false
    try {
      allowBuilds = /allowBuilds/.test(readFileSync(join(PROFILE_DIR, 'pnpm-workspace.yaml'), 'utf8'))
    } catch { /* absent = fine */ }
    check('h1', 'S1 no allowBuilds entry in the profile pnpm-workspace.yaml', allowBuilds === false, '')
    // No compatibility.json / exemption grant anywhere in the world.
    const grantHits = []
    const walk = (dir, depth) => {
      if (depth > 8) return
      let entries = []
      try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
      for (const e of entries) {
        const p = join(dir, e.name)
        if (e.isDirectory()) {
          if (e.name === 'node_modules' || e.name === '.git') continue
          walk(p, depth + 1)
        } else if (e.name === 'compatibility.json') {
          grantHits.push(p)
        }
      }
    }
    walk(HOME, 0)
    check('h1', 'S1 NO compatibility.json exemption grant file anywhere in the world (the install needed no exemption)',
      grantHits.length === 0, `hits=${JSON.stringify(grantHits)}`)
    const warnLines = all.split('\n').filter((l) => l.startsWith('dsh: warning:')).map((l) => l.trim())
    writeEvidence('h1-install', 'add-warnings.json', warnLines)

    // H1 peer-read proof: the installed manifest carries the peer and the
    // host's OWN built evaluator constrains it.
    const inst = join(PROFILE_DIR, 'node_modules', 'dsh-agent-team')
    try {
      installedManifest = JSON.parse(readFileSync(join(inst, 'package.json'), 'utf8'))
    } catch (error) {
      dieFatal(`installed manifest unreadable: ${error.message}`)
    }
    writeEvidence('h1-peer', 'installed-package.json', installedManifest)
    const peerRange = installedManifest?.peerDependencies?.['@deepseek-ai/dsh']
    check('h1', 'H1-peer the INSTALLED manifest carries peerDependencies["@deepseek-ai/dsh"] (the F1 declaration survived the git-install path)',
      peerRange === EXPECTED_PEER_RANGE, `peer=${JSON.stringify(peerRange)} expected=${EXPECTED_PEER_RANGE}`)
    const appBoot = await import(pathToFileURL(APP_BOOT_LIB).href).catch((e) => { dieFatal(`app-boot lib import failed: ${e.message}`); return null })
    if (appBoot !== null) {
      const runtimeVersion = appBoot.getDshRuntimeVersion()
      check('h1', 'H1-peer the host runtime reports the running DSH version',
        runtimeVersion === '0.1.7-rc.1', `runtime=${runtimeVersion}`)
      const atCurrent = appBoot.evaluatePluginCompatibility(installedManifest, {}, runtimeVersion)
      check('h1', 'H1-peer the host evaluator ACCEPTS the supplement manifest at the running 0.1.7-rc.1 runtime (no issue, no exemption) → the install gate passes WITHOUT grant',
        atCurrent === undefined, `result=${JSON.stringify(atCurrent ?? null)}`)
      const atOld = appBoot.evaluatePluginCompatibility(installedManifest, {}, '0.1.5-rc.2')
      const oldIssues = Array.isArray(atOld) ? atOld : (atOld !== undefined && atOld !== null ? [atOld] : [])
      const oldIssueText = JSON.stringify(oldIssues)
      check('h1', 'H1-peer COUNTERFACTUAL: at a 0.1.5-rc.2 runtime the SAME manifest RAISES an issue naming the peer (the gate now CONSTRAINS the plugin — pre-supplement it was unconstrained by construction)',
        atOld !== undefined && oldIssueText.includes('@deepseek-ai/dsh'),
        `at015=${oldIssueText.slice(0, 300)}`)
      // TRULY peerless (key ABSENT): the evaluator's Object.hasOwn gate
      // returns undefined for a manifest without the field (a key present
      // with an undefined value throws — the pre-supplement shape is the
      // key-absent one).
      const peerless = { ...installedManifest }
      delete peerless.peerDependencies
      const peerlessAtOld = appBoot.evaluatePluginCompatibility(peerless, {}, '0.1.5-rc.2')
      check('h1', 'H1-peer counterfactual (no peer declared, the PRE-supplement shape) at 0.1.5-rc.2 → unconstrained (undefined): exactly the hole F1 closes',
        peerlessAtOld === undefined, `at015-nopeer=${JSON.stringify(peerlessAtOld ?? null)}`)
      writeEvidence('h1-peer', 'evaluation.json', {
        runtimeVersion,
        atCurrentRuntime: atCurrent ?? null,
        at015rc2: oldIssues,
        peerlessAt015rc2: peerlessAtOld ?? null,
      })
    }
  }
  const h1Failed = checks.filter((c) => c.leg === 'h1' && c.ok === false).length
  if (h1Failed > 0) {
    dieFatal(`H1 has ${h1Failed} failed checks — the peer/install surface is broken; aborting before host boot`)
    return finish(1)
  }

  // ── the mock model ────────────────────────────────────────────────────────
  const { startMockModel } = await import(pathToFileURL(MOCK_MODULE).href)
  const mockLog = writeEvidence('v0-boot', 'mock.log', '')
  const mock = await startMockModel({
    port: MOCK_PORT,
    // One scripted reply for everything: the smoke only observes the
    // leader's first request (persona/model), then answers done.
    decide: () => ({ kind: 'text', content: 'done' }),
    log: (l) => { try { appendFileSync(mockLog, l + '\n') } catch { /* best-effort */ } },
  })
  process.stdout.write(`mock model listening on ${mock.port}\n`)

  // ── H2: host boot ─────────────────────────────────────────────────────────
  process.stdout.write(`── H2: host boot (the install world) ──\n`)
  const instanceLog = writeEvidence('v0-boot', 'instance-1.log', '')
  writePatchFile('create')
  let hostPort = 0
  for (const p of HOST_PORT_RANGE) {
    if (p === MOCK_PORT) continue
    if (await portFree(p)) { hostPort = p; break }
  }
  if (hostPort === 0) { dieFatal('no free host port in 3491–3500'); return finish(1) }
  let host = spawnHost({ port: hostPort, logPath: instanceLog })
  const bootLine = await waitForLogLine(instanceLog, BOOT_MARKER, 300_000, host.alive)
  if (bootLine === null) {
    stopHost(host)
    const detail = host.exitInfo.exited
      ? `process exited (code=${host.exitInfo.code} signal=${host.exitInfo.signal ?? 'none'})`
      : 'no boot marker within 300s'
    dieFatal(`host boot failed: ${detail}\n--- log tail ---\n${logTail(instanceLog)}`)
    return finish(1)
  }
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(bootLine.replace(/.*dsh web:\s*/, ''))
  if (m === null) { dieFatal(`unexpected boot url shape: ${bootLine}`); return finish(1) }
  const origin = `http://127.0.0.1:${m[1]}`
  writeEvidence('v0-boot', 'boot-marker.txt', bootLine + '\n')
  check('h2', 'H2 host boot marker present (dsh web: …?token=…)', true, bootLine.slice(0, 80))
  const unauth = await fetch(`${origin}/`, { signal: AbortSignal.timeout(10_000) }).then((r) => r.status).catch(() => -1)
  check('h2', 'H2 unauthenticated GET / → 401 (launch-token gate active)', unauth === 401, `status=${unauth}`)
  let cookie = null
  try { cookie = await authenticate(origin, m[2]) } catch (e) { dieFatal(`auth failed: ${e.message}`) }
  if (cookie === null) return finish(1)
  check('h2', 'H2 launch-token cookie obtained', true, cookie.slice(0, 24) + '…')

  // ── H2 roster: the ACTUAL agentPresets/list wire value ───────────────────
  process.stdout.write(`── H2: roster read (agentPresets/list) ──\n`)
  {
    const roster = await apiListAgentPresets(origin, cookie, 'roster1')
    writeEvidence('h2-roster', 'agentpresets-list.json', roster)
    const val = roster.body?.result?.value
    check('h2', 'H2-roster the roster endpoint responds ok on the fresh world',
      roster.status === 200 && roster.body?.result?.ok === true,
      `status=${roster.status} body=${JSON.stringify(roster.body ?? null).slice(0, 200)}`)
    if (val !== null && typeof val === 'object') {
      check('h2', 'H2-roster the wire carries `modeSelectionEnabled` as a boolean (the F2 field is LIVE on 0.1.7 — the guide §11 deprecation note is answered by source + wire)',
        typeof val.modeSelectionEnabled === 'boolean',
        `modeSelectionEnabled=${JSON.stringify(val.modeSelectionEnabled)}`)
      const presets = Array.isArray(val.presets) ? val.presets : []
      writeEvidence('h2-roster', 'roster-summary.json', {
        modeSelectionEnabled: val.modeSelectionEnabled,
        presetCount: presets.length,
        presets: presets.map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault, broken: p.broken ?? null })),
      })
      process.stdout.write(`roster: modeSelectionEnabled=${JSON.stringify(val.modeSelectionEnabled)} presets=${presets.length}\n`)
      // The plugin-side policy (F2): visible = modeSelectionEnabled ? usable : usable∩{isDefault}.
      const usable = presets.filter((p) => p.broken === undefined)
      const visible = val.modeSelectionEnabled === true ? usable : usable.filter((p) => p.isDefault === true)
      check('h2', 'H2-roster the F2 client policy yields a NON-EMPTY visible roster on the fresh world (the creation UI would not fail-visible)',
        visible.length > 0, `visible=${visible.length} of usable=${usable.length} of presets=${presets.length}`)
    } else {
      check('h2', 'H2-roster the roster response carries a value object — SKIPPED (no value; see h2-roster/agentpresets-list.json)', false, JSON.stringify(roster.body ?? null).slice(0, 200))
    }
  }

  // ── H2 team creation (v2) + the leader's first model request ─────────────
  process.stdout.write(`── H2: team.create (v2) with minimal initial work ──\n`)
  {
    // Readiness gate: the remote route mounts BEFORE the live boot settles
    // (mount-before-boot reorder) — while the state is `starting` every
    // non-catalog method is refused with `runtime-not-ready` BEFORE the
    // handler runs (nothing durable; retry-safe). The kit has no p6t6
    // health row, so it polls team.create itself: rejected pre-admission →
    // sleep 5s → retry (24 attempts = 120s budget); a `failed` boot state
    // is terminal (no automatic retry upstream) and exhausts the budget.
    const createParams = {
      rootSessionId: CREATE_ROOT,
      blueprintId: BP_MAIN_ID,
      initialWork: {
        prompt: `${MK_CREATE} You have been created for a smoke run. Answer exactly: done.`,
      },
    }
    let createAttempt = 0
    let createRes = null
    let createError = null
    let readinessNotes = []
    const createDeadline = Date.now() + 240_000
    for (;;) {
      createAttempt += 1
      let attempt = null
      try {
        attempt = await remoteCall(origin, cookie, 'team.create', createParams, `rscreate${createAttempt}`)
      } catch (e) {
        createError = e
        attempt = { status: 0, body: null, error: String(e?.message ?? e) }
      }
      const err = attempt?.body?.result?.error
      if (attempt?.body?.result?.ok === true) {
        createRes = attempt
        break
      }
      readinessNotes.push({ attempt: createAttempt, code: err?.code ?? null, reason: err?.details?.reason ?? null, message: (err?.message ?? attempt?.error ?? '').slice(0, 160) })
      if (err?.details?.reason !== 'runtime-not-ready' || Date.now() >= createDeadline) {
        createRes = attempt
        break
      }
      process.stdout.write(`team.create attempt ${createAttempt}: runtime-not-ready — waiting for the live boot (5s)\n`)
      await new Promise((r) => setTimeout(r, 5_000))
    }
    writeEvidence('h2-team', 'readiness-retries.json', readinessNotes)
    const leaderReq = await waitForMock(
      mock,
      (r) => userTextOf(r).includes(MK_CREATE) && (r.body?.tools ?? []).length > 0,
      180_000,
      'the created team leader first model request',
    )
    if (leaderReq !== null) {
      const sys = systemPromptOf(leaderReq)
      const tools = toolsOf(leaderReq)
      writeEvidence('h2-team', 'leader-first-request.json', {
        seq: leaderReq.seq,
        model: leaderReq.body?.model,
        tools,
        systemPrompt: sys.slice(0, 6000),
      })
      check('h2', 'H2-team the created team leader turn started (the model request observed; model = the row staticModel)',
        leaderReq.body?.model === MODEL_ID, `model=${leaderReq.body?.model} expected=${MODEL_ID}`)
      check('h2', 'H2-team the leader system prompt carries the bound blueprint persona (strict blueprint bound, not the anchor)',
        sys.includes(P_LEADER), `sysHead=${JSON.stringify(sys.slice(0, 120))}`)
      check('h2', 'H2-team the leader surface carries the team tool set (the 13 team_ tools of the blueprint allow list)',
        LEADER_TEAM_TOOLS_ALLOW.every((t) => tools.includes(t)),
        `teamTools=${tools.filter((t) => t.startsWith('team_')).length} surface=${tools.length}`)
    } else {
      check('h2', 'H2-team the created team leader turn started — SKIPPED (no leader request in 180s; requests=' + mock.requests.length + ')', false, '')
    }
    writeEvidence('h2-team', 'create-response.json', createRes)
    const createOk = createRes?.body?.result?.ok === true
    check('h2', `H2-team team.create resolved ok (the product-path Team creation PASS on the supplement state; readiness retries: ${readinessNotes.length})`,
      createOk && createError === null,
      `ok=${JSON.stringify(createRes?.body?.result?.ok ?? null)} path=${JSON.stringify(createRes?.body?.result?.value?.path ?? null)} error=${createError === null ? 'none' : String(createError.message).slice(0, 120)}`)
  }

  // ── H3: session coexistence + retention wire shape + reconnect ────────────
  process.stdout.write(`── H3: ordinary + team coexistence, retention shape, fresh connection ──\n`)
  {
    const ordCreate = await apiCreateSession(origin, cookie, ORD_SESSION, WORKSPACE)
    writeEvidence('h3-sessions', 'create-ordinary.json', ordCreate)
    check('h3', 'H3 a freshly created ordinary session succeeds (ordinary path intact alongside the team root)',
      ordCreate.status === 200 && ordCreate.body?.result?.ok === true,
      `status=${ordCreate.status} body=${JSON.stringify(ordCreate.body ?? null).slice(0, 200)}`)
    const list1 = await apiListSessions(origin, cookie, 'c1')
    writeEvidence('h3-sessions', 'list-connection1.json', list1)
    // Wire value shape: SessionListValue = { items: SessionSummary[] }
    // (session-controller types.ts). SessionSummary has NO retainedBy
    // field — retention is client-local (publishRetention merges per-
    // connection retain counts into the LOCAL list snapshot; R1–R3 pin
    // the open-mode invariant on that client surface). The wire-level
    // observables are the row shape + catalog contents + reconnect.
    const rows1 = list1.body?.result?.value?.items ?? []
    const ids1 = rows1.map((r) => r?.sessionId ?? null).filter(Boolean)
    check('h3', 'H3 connection-1 catalog carries the boot main root + the created team root + the new ordinary session (NO row loss while both session kinds coexist)',
      list1.status === 200 && list1.body?.result?.ok === true
        && ids1.includes(ROOT) && ids1.includes(CREATE_ROOT) && ids1.includes(ORD_SESSION),
      `ok=${JSON.stringify(list1.body?.result?.ok ?? null)} ids=${JSON.stringify(ids1)} err=${JSON.stringify(list1.body?.result?.error ?? null).slice(0, 200)}`)
    const shapeOk = rows1.length > 0 && rows1.every((r) => typeof r?.sessionId === 'string' && typeof r?.agentAvailable === 'boolean' && typeof r?.running === 'boolean')
    writeEvidence('h3-sessions', 'row-shape.json', {
      note: 'SessionSummary wire rows (session-controller types.ts) — retainedBy is NOT a wire field (client-local merge; see apiListSessions docs + client-main-retention.md H3 section)',
      rowCount: rows1.length,
      rows: rows1.map((r) => ({ sessionId: r?.sessionId, agentAvailable: r?.agentAvailable, running: r?.running, blank: r?.blank, parentSessionId: r?.parentSessionId ?? null })),
    })
    check('h3', 'H3 wire row shape: session/list rows are SessionSummary (sessionId + agentAvailable + running on every row; retainedBy confirmed client-side, not wire)',
      shapeOk, `rows=${rows1.length} shapeOk=${shapeOk}`)
    // Fresh client connection: a SECOND launch-token cookie is a distinct
    // client identity (a true new connection, not a reused one).
    let cookie2 = null
    try { cookie2 = await authenticate(origin, m[2]) } catch (e) { dieFatal(`second auth failed: ${e.message}`) }
    if (cookie2 === null) return finish(1)
    check('h3', 'H3 a second launch-token cookie (fresh client identity) obtained', true, cookie2.slice(0, 24) + '…')
    const list2 = await apiListSessions(origin, cookie2, 'c2')
    writeEvidence('h3-sessions', 'list-connection2.json', list2)
    const rows2 = list2.body?.result?.value?.items ?? []
    const ids2 = rows2.map((r) => r?.sessionId ?? null).filter(Boolean)
    check('h3', 'H3 the FRESH connection sees the SAME catalog (reconnect stability: no spurious row loss / generation-replacement window on a new client)',
      ids1.length > 0 && JSON.stringify([...ids1].sort()) === JSON.stringify([...ids2].sort()),
      `c1=${JSON.stringify(ids1)} c2=${JSON.stringify(ids2)}`)
  }

  // ── teardown ──────────────────────────────────────────────────────────────
  process.stdout.write(`── teardown ──\n`)
  stopHost(host)
  try { await mock.close() } catch { /* already closed */ }
  writeEvidence('summary', 'world-info.json', {
    world: HOME,
    branch: BRANCH,
    worktreeSha,
    hostPin: HOST_PIN,
    hostPort,
    origin,
    durationMs: Date.now() - startedAt,
    note: 'world kept for inspection (TEST_METHODS §7); safe to delete after the supplement evidence is archived',
  })
  finish(checks.every((c) => c.ok === true) ? 0 : 1)
}

main().catch((e) => {
  dieFatal(`unhandled: ${String(e?.stack ?? e)}`)
  finish(1)
})
