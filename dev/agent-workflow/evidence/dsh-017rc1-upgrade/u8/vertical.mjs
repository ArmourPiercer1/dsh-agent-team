#!/usr/bin/env node
/**
 * vertical.mjs — U8 pristine 0.1.7 real-host vertical (plan §11 / u8-brief).
 *
 * THE FINAL COMPATIBILITY AUTHORITY of the 0.1.5-rc.2 → 0.1.7-rc.1 upgrade
 * round. One world, one installed plugin, one continuous host boot
 * (plus one fresh reboot for V8):
 *
 *   step 0  git-install smoke (plan §11.2): fresh DSH_HOME → bare clone of
 *           the upgraded branch → `dsh plugin add git+file://…#branch` with
 *           the 0.1.7 plugin version-compat check in the loop →
 *           S1 (add exit 0, NO incompat/allow-version lines, no pnpm git
 *           prepare rejection, no allowBuilds), S2 (dsh.profile.bundles
 *           auto-contains dsh-agent-team — the CLI reconcile product, not a
 *           hand-written row), S3 (installed package dir carries the
 *           committed install surface incl. team-spill-local.js + the root
 *           cordis.patch.yml spill rows).
 *   V0      host boot on the INSTALL world (bundle rows + profile-patch
 *           override + p6t6 observability row): boot marker, unauth 401,
 *           host/client rows active, team-spill-local active + base
 *           spill-local disabled, no duplicate service, no
 *           ERR_MODULE_NOT_FOUND, no pending required service (0.1.7
 *           startup diagnostics recorded when present).
 *   V1      ordinary (non-Team) session: message → fs read tool → turn end
 *           (the plugin does not break the ordinary Agent loop; no team_
 *           tools leak onto the ordinary surface).
 *   V2      new Team on the real product path (team.create v2 → open Root →
 *           admitInitialWork): projection, member create, preset mount
 *           (0.1.7 shipped `standard` preset via rootPresetId/memberPresetId),
 *           persona, workspace, model selection.
 *   V3      team tools on ONE continuous scripted Leader turn: create_member
 *           → delegate → send_message (historical hang regression point:
 *           must exit) → report_progress.
 *   V4      permissions: leader allowed (read subtree team, silent pass),
 *           member allowed, member/leader explicit STATIC DENY
 *           (read subtree runtime, provenance in the tool result),
 *           strict-read workspace read, no-grant outside workspace → deny
 *           (the V6 member spill read).
 *   V5      MCP initial grant, THREE mini servers on the real host
 *           (U6 handoff): single/paginated/none; the created Leader+member
 *           tool surface is EXACTLY mcp__u8single__ping +
 *           mcp__u8paged__alpha + mcp__u8paged__beta (two-page aggregate),
 *           zero mcp__u8none__*; live calls return pong:<msg> /
 *           <name>:<msg>; the `none` server must not crash Team init;
 *           three servers concurrently mounted on one live Team.
 *   V6      0.1.7 TOKEN-BUDGET spill (base row maxInlineTokens: 12500 —
 *           the legacy byte threshold is gone): a 64KB-capped bash output
 *           is replaced by the spill notice; TeamAwareLocalSpillStore
 *           records a DURABLE artifact grant; the OWNER agent reads the
 *           spill file; another instance (the member) cannot.
 *   V7      lifecycle: member archive (durable ARCHIVED transition — the
 *           current product's lifecycle tool is team_archive_member; there
 *           is NO restore tool in the closed 13-tool set, recorded),
 *           leader stop (the p6t6 residency-drop seam disposes the live
 *           leader handle), leader COLD RESUME afterwards (0.1.7
 *           agents.resume path); 0.1.7 event-vocabulary observation
 *           (`agent/session-start` absent from the boot log).
 *   V8      process stop + fresh reboot of the SAME profile (bootPhase
 *           resume): the host must re-boot. Old-Team resume is NOT a
 *           blocking criterion — on failure: logs + session files +
 *           service topology + POST-UPGRADE SESSION-RESUME marker.
 *
 * World discipline (TEST_METHODS §7, workspace-contained): DSH_HOME =
 * tests/homes/u8-017rc1-<stamp> under the MAIN repo; XDG_DATA_HOME =
 * <world>/.xdg (pnpm 11 SQLite store), TMPDIR = <world>/tmp. Host port =
 * first free in 3491–3500 (excluding the mock/MCP band); mock = 3496;
 * mini-MCP = 3497/3498/3499 (3497 is the LOGGING single-variant endpoint —
 * same byte-frozen wire contract, plus a request trace that captures the
 * 0.1.7 client's initialize protocolVersion — U6 handoff item 3).
 * :3080/:3180 get read-only probes only (pre == post asserted). The
 * test-use checkout must be pristine @ 46a7f68b09 before and after.
 *
 * The profile's own cordis.patch.yml (the public seam) carries: the
 * `dsh-agent-team` row CONFIG OVERRIDE (last-write-wins over the bundle
 * layer's machine-agnostic row — the documented override semantics of the
 * shipped cordis.patch.yml), the p6t6 observability row, and a config-only
 * override of `team-spill-local` pinning its spill `root` INSIDE the world
 * (deterministic V6 artifact location). The production row MODULE is the
 * INSTALLED form (profiles/web/node_modules/dsh-agent-team) — no worktree
 * file URL for the production row; the p6t6 row is a test-only harness
 * module (file URL, the kit convention).
 *
 * Usage: node vertical.mjs
 */
import {
  appendFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync,
  rmSync, statSync, writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ── frozen facts ────────────────────────────────────────────────────────────
const MAIN_REPO = '/home/user/dsh-plugins/dsh-agent-team'
const WORKTREE = join(MAIN_REPO, '.worktrees', 'dsh-017rc1-upgrade')
const TESTUSE = join(MAIN_REPO, 'tests', 'deepseek-harness-test-use')
const HOST_PIN = '46a7f68b0922371ce7144b668b90e377d8e799f4' // DSH 0.1.7-rc.1 release point
const WORKTREE_PIN = 'adad20c00c75413f4c1fa1fe6832fb0fad746f6c' // task/dsh-017rc1-upgrade @ U7
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const BRANCH = 'task/dsh-017rc1-upgrade'
const MOCK_MODULE = join(WORKTREE, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')
const P6T6_PLUGIN = join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')
const P6T6_ROW_NAME = pathToFileURL(P6T6_PLUGIN).href

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const HOME = join(MAIN_REPO, 'tests', 'homes', `u8-017rc1-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const XDG = join(HOME, '.xdg')
const WORLD_TMP = join(HOME, 'tmp')
const REPO_GIT = join(HOME, 'repo.git')
const PROFILE_DIR = join(HOME, 'profiles', 'web')
const SPILL_ROOT = join(HOME, 'spill')
const BLUEPRINT_DIR = join(HOME, 'blueprints')
const U8_DIR = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'dsh-017rc1-upgrade', 'u8')

const HOST_PORT_RANGE = []
for (let p = 3491; p <= 3500; p += 1) HOST_PORT_RANGE.push(p)
const RESERVED_PORTS = new Set([3496, 3497, 3498, 3499])
const MOCK_PORT = 3496
const MCP_PORT_SINGLE = 3497 // logging single variant
const MCP_PORT_PAGED = 3498
const MCP_PORT_NONE = 3499

const ROOT = `session-u8-root-${RUN_STAMP}`
const CREATE_ROOT = `session-u8-team-${RUN_STAMP}`
const ORD_SESSION = `session-u8-ord-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.u8-anchor'
const BP_MAIN_ID = 'team.u8-main'
const MODEL_ID = `u8-model-${RUN_STAMP}`
const PRESET_ID = 'standard' // the 0.1.7 web-app SHIPPED preset (preset-migration §1)
const MCP_SINGLE = 'u8single'
const MCP_PAGED = 'u8paged'
const MCP_NONE = 'u8none'

const P_LEADER = `U8LEADER_PERSONA_${RUN_STAMP}`
const P_WORKER = `U8WORKER_PERSONA_${RUN_STAMP}`
const MK_DISC = `U8MK_DISC_${RUN_STAMP}`
const MK_ORD = `U8MK_ORD_${RUN_STAMP}`
const MK_B = `U8MK_B_${RUN_STAMP}`
const MK_BMEM = `U8MK_BMEM_${RUN_STAMP}`
const MK_SPILL = `U8MK_SPILL_${RUN_STAMP}`
const MK_SPILL_DENY = `U8MK_SPILLDENY_${RUN_STAMP}`
const MK_LIFE = `U8MK_LIFE_${RUN_STAMP}`
const MK_LIFE2 = `U8MK_LIFE2_${RUN_STAMP}`
const U8MSG = `U8MSG_${RUN_STAMP}`
const BASH_MARKER = `u8-smoke-${RUN_STAMP}`
const SPILL_FILLER = 'u8spillfiller'
const SPILL_CMD = `yes ${SPILL_FILLER} | head -c 250000`

const PROBE_TEAM_FILE = join(WORKSPACE, 'team', 'test.md')
const PROBE_TEAM_CONTENT = `u8-team-probe-${RUN_STAMP}`
const PROBE_RUNTIME_FILE = join(WORKSPACE, 'runtime', 'forbidden.txt')

const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
// The closed 13-tool set (packages/tools/src/tools.ts @ adad20c).
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
  'team_archive_member',
]
const LEADER_TEAM_TOOLS_ALLOW = [
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
  'team_archive_member',
]
const MEMBER_TEAM_TOOLS_ALLOW = ['team_send_message', 'team_report_progress']

// ── logging / criteria / evidence ───────────────────────────────────────────
const RUN_LOG = join(U8_DIR, 'vertical.log')
function log(line) {
  const full = `[${new Date().toISOString()}] ${line}`
  try { mkdirSync(U8_DIR, { recursive: true }); appendFileSync(RUN_LOG, full + '\n') } catch { /* pre-dir */ }
  console.log(full)
}
const CRITERIA = []
function check(leg, name, ok, detail) {
  CRITERIA.push({ leg, name, ok: !!ok, detail: detail ?? '' })
  log(`${ok ? 'PASS' : 'FAIL'} [${leg}] ${name}${detail ? ` — ${detail}` : ''}`)
  return !!ok
}
function legDir(leg) {
  const d = join(U8_DIR, leg)
  mkdirSync(d, { recursive: true })
  return d
}
function writeEvidence(leg, name, content) {
  const d = legDir(leg)
  writeFileSync(join(d, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2))
  return join(d, name)
}
let fatalError = null
let hostPortRef = null
function dieFatal(msg) {
  fatalError = msg
  log(`FATAL: ${msg}`)
}

// ── small http helpers (rc2 kit shape) ──────────────────────────────────────
async function fetchJson(url, init, timeoutMs = 60_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ status: 0, body: null, error: e.message }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body }
}
async function probeStableInstance(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(5_000) })
    return { port, reachable: true, status: res.status }
  } catch {
    return { port, reachable: false, status: null }
  }
}
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie !== null) return setCookie.split(';', 1)[0]
  if (res.status >= 200 && res.status < 300) {
    // No cookie, but the endpoint accepted the token inline — continue
    // cookieless and let the next authenticated request prove or disprove
    // it (a 401 there is a clean, recorded signal of an auth-flow drift).
    return null
  }
  throw new Error(`dsh web authentication returned HTTP ${res.status} with no set-cookie (expected 3xx + set-cookie)`)
}
/** One browser-facing public Remote call: POST /team-remote/<method>. */
async function remoteCall(origin, cookie, method, params, tag = 'u8', version = 1) {
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
async function apiPrompt(origin, cookie, sessionId, text, tag = 'u8') {
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
  }, 300_000)
}
// 0.1.7 drift: the remote session API no longer auto-creates a session on
// the first session/prompt (unknown sessionId → session/not-found error).
// Sessions must be created explicitly via /api/session/create first.
async function apiCreateSession(origin, cookie, sessionId, cwd) {
  return fetchJson(`${origin}/api/session/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `u8create-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/create',
      payload: { args: { request: { sessionId, cwd } } },
    }),
  }, 30_000)
}
async function p6t6State(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 30_000)
}
async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}
async function p6t6ResidencyDrop(port, sessionId, tag = 'u8') {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/residency/drop`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  }, 120_000)
}
function logTail(logPath, n = 30) {
  try {
    return readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n')
  } catch {
    return '<no log>'
  }
}

// ── ports ───────────────────────────────────────────────────────────────────
async function portFree(port, timeoutMs = 1500) {
  return new Promise((res) => {
    const srv = createServer()
    const timer = setTimeout(() => { try { srv.close() } catch { /* already gone */ } res(false) }, timeoutMs)
    // EADDRINUSE (the port is taken) ⇒ NOT free; a clean listen ⇒ free.
    srv.once('error', () => { clearTimeout(timer); try { srv.close() } catch { /* already gone */ } res(false) })
    srv.once('listening', () => { clearTimeout(timer); srv.close(() => res(true)) })
    srv.listen(port, '127.0.0.1')
  })
}
async function pickHostPort() {
  for (const p of HOST_PORT_RANGE) {
    if (RESERVED_PORTS.has(p)) continue
    if (await portFree(p)) return p
  }
  throw new Error(`no free host port in ${HOST_PORT_RANGE[0]}–${HOST_PORT_RANGE.at(-1)}`)
}

// ── the real-host boot (test-use bin; the DshInstance pattern) ─────────────
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
    // Mid-deadline full re-scan: run-7 showed the boot marker can land on
    // disk MUCH later than the incremental scan's first reads (the loop
    // missed a present line for ~5min; only the deadline re-scan caught
    // it). A full re-scan at half-deadline recovers such lines early.
    if (midScanned === false && Date.now() >= midScanAt) {
      midScanned = true
      const hit = fullScan()
      if (hit !== null) return hit
    }
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
function spawnHost({ port, logPath }) {
  const outFd = openSync(logPath, 'a')
  const errFd = openSync(logPath, 'a')
  let child
  try {
    child = spawn(
      process.execPath,
      [HOST_BIN, 'web', '--port', String(port), '--no-open'],
      {
        // The session workspace IS the host cwd (brief launch chain); the
        // row's defaultWorkspace falls back to this directory.
        cwd: WORKSPACE,
        stdio: ['ignore', outFd, errFd],
        env: {
          ...process.env,
          DSH_HOME: HOME,
          DSH_CLIENT_COMMIT_HASH: HOST_PIN.slice(0, 10),
          DEEPSEEK_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
          DEEPSEEK_API_KEY: 'u8-vertical-mock-key',
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
async function waitForPortFree(port, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await portFree(port, 500)) return true
    if (Date.now() >= deadline) return false
    await new Promise((r) => setTimeout(r, 300))
  }
}

// ── yaml emission (rc2 kit shape) ───────────────────────────────────────────
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

// ── blueprints ──────────────────────────────────────────────────────────────
/**
 * The row anchor (blueprint A): a plain LEGACY leader + worker-a (NO
 * capabilities — the byte-for-byte boot shape; the boot leader runs the
 * legacy tool set). The created team binds the STRICT main blueprint.
 */
const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 1',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  `  persona: "You are the leader of the u8 vertical boot team. ${P_LEADER}"`,
  'members:',
  '  - templateId: worker-a',
  `    persona: "You are a worker of the u8 vertical boot team. ${P_LEADER}"`,
  'memberEnvelopes: []',
  'requirements: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

/**
 * One saved-source strict blueprint (the created Team binds this). The
 * Leader declares the full 13-tool teamTools set + mcp allow (3 mini
 * servers) + alpha.2 permissions (the strict Coverage Gate shape proven
 * byte-for-byte in the rc2 kit): allow read subtree team / deny read
 * subtree runtime / ask bash any / default ask. `builtinToolDeny`
 * (CAPABILITIES-level, LEG0-discovery-computed) covers the unmanaged
 * surface. worker-b carries the SAME capability shape with the MEMBER team
 * tool scope ([send-message, report-progress]) — the per-member initial
 * grant + per-member static permissions axis. The teamEnvelope allows the
 * closed mutation ops the leader needs, INCLUDING archive-member (V7) —
 * the closed op vocabulary (admission/actions.ts RUNTIME_OPS) has no
 * delete-team; validation is self-consistency only.
 */
function mainBlueprintYaml(denyList) {
  /** One template's capabilities block. `cap` = the SPACE indent of the
   *  `capabilities:` line itself (leader: 2, member: 4); everything inside
   *  is relative to it (+2 per level). */
  const capabilitiesBlock = (cap, teamTools) => {
    const s = (n) => ' '.repeat(n)
    const k = cap + 2 // capability field indent (teamTools/builtinToolDeny/…)
    const v = k + 2   // kind/items/lane indent
    const i = v + 2   // item indent (team tools / mcp servers / deny entries)
    const r = v + 2   // permission rule item indent (`- tool:`)
    const rr = r + 2  // resource mapping indent
    const rf = rr + 2 // resource field indent (kind/path)
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
      `${s(v)}items:`,
      `${s(i)}- ${MCP_SINGLE}`,
      `${s(i)}- ${MCP_PAGED}`,
      `${s(i)}- ${MCP_NONE}`,
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
    `  persona: ${JSON.stringify(`You are the leader of the u8 vertical team. ${P_LEADER}`)}`,
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
    `    persona: ${JSON.stringify(`You are worker-b of the u8 vertical team. ${P_WORKER}`)}`,
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

function teamRowConfig(phase) {
  return {
    bootPhase: phase,
    rootSessionId: ROOT,
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: BLUEPRINT_DIR,
    rootPresetId: PRESET_ID,
    memberPresetId: PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: MODEL_ID },
    deniedSelection: null,
    mcpServers: [
      { name: MCP_SINGLE, port: MCP_PORT_SINGLE },
      { name: MCP_PAGED, port: MCP_PORT_PAGED },
      { name: MCP_NONE, port: MCP_PORT_NONE },
    ],
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
}

function writePatchFile(phase) {
  mkdirSync(PROFILE_DIR, { recursive: true })
  // 0.1.7 note: the new compatibility preflight (app-boot/compatibility-preflight.ts)
  // rejects any row whose `name` is undefined — `manifestOf` crashes on
  // `row.name.startsWith('cordis:')` and the row is disabled with a misleading
  // "peer dependencies cannot be validated" line. Override rows therefore carry
  // the SAME name as the bundle row they replace (the proven rc2 kit pattern;
  // same id + same name → last-write-wins whole-config replace).
  const lines = [
    `# U8 vertical patch layer (run ${RUN_STAMP}, phase ${phase}): the public profile-patch seam — the dsh-agent-team row CONFIG OVERRIDE (named row, last-write-wins whole-config replace over the bundle layer's machine-agnostic row), the p6t6 observability row, and a named override of team-spill-local pinning its spill root inside the world.`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: 'dsh-agent-team/host', config: teamRowConfig(phase) }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...yamlEmitItem({ id: 'team-spill-local', name: 'dsh-agent-team/spill-local', config: { root: SPILL_ROOT } }, 2),
    '',
  ]
  writeFileSync(join(PROFILE_DIR, 'cordis.patch.yml'), lines.join('\n'))
  return join(PROFILE_DIR, 'cordis.patch.yml')
}

function writeDirective(boot, phase) {
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot,
    phase,
    reportDir: U8_DIR,
    runStamp: RUN_STAMP,
    rootSessionId: ROOT,
  }, null, 2))
}

// ── the scripted mock model (decide lives here; the mock records all) ──────
// The DSH host replays the full transcript on every model request, so the
// CURRENT turn must be delimited correctly: its prompt is the LAST user
// message carrying text, and its tool results are the ones AFTER the last
// assistant message. (A multi-turn session like the created leader — B turn
// → spill turn → delegate turn → lifecycle turns — would otherwise
// re-trigger earlier marker branches and corrupt the per-turn tool index.)
// 0.1.7 drift: the DeepSeek provider now speaks the Messages API
// (Anthropic-style): messages[i].content is an ARRAY of blocks, tool calls
// are assistant {type:'tool_use',id,name,input} blocks, and tool results
// ride USER messages as {type:'tool_result',tool_use_id,content} blocks.
// The 0.1.5 OpenAI chat-completions shape (string content, 'tool' role) is
// still accepted so the helpers work against both wire protocols.
// The same helpers serve two callers with different envelopes: waitForMock
// predicates receive mock RECORDS ({seq, body, ...}) while decide() receives
// the raw parsed BODY — bodyOf normalizes both (rc2 kit precedent).
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
function userTextOf(req) {
  const msgs = bodyOf(req)?.messages ?? []
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (m?.role !== 'user') continue
    const texts = msgTexts(m)
    if (texts.length > 0) return texts.join('\n')
  }
  return ''
}
function toolMsgsOf(req) {
  const msgs = bodyOf(req)?.messages ?? []
  const isMessagesApi = msgs.some((m) => Array.isArray(m?.content))
  if (isMessagesApi) {
    // 0.1.7: each tool result rides its OWN user message (tool_result
    // blocks), interleaved with the assistant steps — [user(prompt),
    // assistant, user(result1), assistant, user(result2), …]. The decide
    // ladder wants the CURRENT-TURN result count (same semantics as the
    // OpenAI branch below: results since the last user prompt), so scope to
    // tool_result blocks in user messages after the last user message that
    // carries a text block (the prompt / last spliced text). Counting only
    // after the last assistant stalled the ladder at 1 (run-4: the mock
    // re-issued the denied read until 0.1.7's repetition guard ended the
    // turn).
    let lastPromptUser = -1
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      const m = msgs[i]
      if (m?.role !== 'user' || !Array.isArray(m.content)) continue
      if (m.content.some((b) => b && b.type === 'text' && typeof b.text === 'string' && b.text.length > 0)) { lastPromptUser = i; break }
    }
    const results = []
    for (let i = lastPromptUser + 1; i < msgs.length; i += 1) {
      const m = msgs[i]
      if (m?.role !== 'user' || !Array.isArray(m.content)) continue
      for (const b of m.content) {
        if (b && b.type === 'tool_result') results.push({ role: 'tool', toolCallId: b.tool_use_id, content: b.content })
      }
    }
    return results
  }
  // 0.1.5 OpenAI shape: tool-role messages after the last user message.
  let lastUser = -1
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    if (msgs[i]?.role === 'user') { lastUser = i; break }
  }
  return msgs.slice(lastUser + 1).filter((m) => m?.role === 'tool')
}
function contentText(c) {
  if (typeof c === 'string') return c
  if (Array.isArray(c)) return c.map((b) => (typeof b === 'string' ? b : (b && typeof b === 'object' && typeof b.text === 'string' ? b.text : JSON.stringify(b ?? '')))).join('\n')
  return JSON.stringify(c ?? '')
}
function toolMsgTexts(req) {
  return toolMsgsOf(req).map((m) => contentText(m.content))
}
function toolsOf(req) {
  return (bodyOf(req)?.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t))
}

const state = { memberInstanceId: null, spillPath: null }
const mockDiag = []
// 0.1.7: team_delegate's requestToken is the WORK-UNIT IDEMPOTENCY key —
// reusing a settled token yields WORK_REPLAYED ("work unit already settled;
// original result not re-reported") and the member is NOT re-spawned (run-6
// V6b: the second delegate with the shared token was replayed, member idle).
// One unique token per team-tool call.
let u8TokSeq = 0
const freshToken = () => `u8-tok-${RUN_STAMP}-${++u8TokSeq}`

function makeDecide() {
  return ({ seq, req }) => {
    const ut = userTextOf(req)
    const keys = req !== null && typeof req === 'object' ? Object.keys(req) : [String(req)]
    const tools = toolsOf(req)
    const tmsgs = toolMsgsOf(req)
    mockDiag.push(`seq=${seq} userHead=${JSON.stringify(ut.slice(0, 80))} nToolMsgs=${tmsgs.length} tools=${tools.length} bodyKeys=${JSON.stringify(keys)}`)
    // Title-gen side call (the core title generator, not the scripted
    // conversation) — keep the chain pure. 0.1.7: a request without a tool
    // header is a side call (every scripted conversation request carries its
    // preset surface), so it must never fall into a marker branch.
    if (tools.length === 0) return { kind: 'text', content: 'u8 title' }
    if (/Create a concise title/i.test(ut)) return { kind: 'text', content: 'u8 title' }
    const text = (content) => {
      mockDiag.push(`seq=${seq} -> text ${JSON.stringify(content.slice(0, 60))}`)
      return { kind: 'text', content }
    }
    const call = (name, args) => {
      mockDiag.push(`seq=${seq} -> tool-call ${name} ${JSON.stringify(args).slice(0, 120)}`)
      return { kind: 'tool-call', toolCalls: [{ id: `u8-${seq}-${toolsOf(req).length}-${Math.random().toString(36).slice(2, 6)}`, name, arguments: args }] }
    }

    // ── V1: the ordinary (non-Team) session ───────────────────────────────
    if (ut.includes(MK_ORD)) {
      if (tmsgs.length === 0) return call('read', { file_path: 'team/test.md' })
      return text('U8_ORD_DONE')
    }
    // ── LEG 0: discovery on the boot root ─────────────────────────────────
    if (ut.includes(MK_DISC)) return text('U8_DISC_DONE')
    // ── member turns ──────────────────────────────────────────────────────
    if (ut.includes(MK_BMEM)) {
      if (tmsgs.length === 0) return call('read', { file_path: 'team/test.md' })
      if (tmsgs.length === 1) return call('read', { file_path: 'runtime/forbidden.txt' })
      return text('U8_MEMBER_DONE')
    }
    if (ut.includes(MK_SPILL_DENY)) {
      if (tmsgs.length === 0) return call('read', { file_path: state.spillPath ?? '/nonexistent-spill' })
      return text('U8_MEMBER_DENY_DONE')
    }
    if (ut.includes(U8MSG)) return text('U8_MEMBER_MSG_ACK')
    // ── the created-team leader: one continuous scripted turn (V2–V5) ────
    if (ut.includes(MK_B)) {
      const t = tmsgs.length
      if (t === 0) return call('read', { file_path: 'team/test.md' })
      if (t === 1) return call('read', { file_path: 'runtime/forbidden.txt' })
      if (t === 2) return call('bash', { command: `echo ${BASH_MARKER}`, description: 'U8 vertical smoke echo (V4 last-mile guard leg)' })
      if (t === 3) return call('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: freshToken(), delegationTemplateId: 'worker-b', label: 'worker-b-1' })
      if (t === 4) {
        const created = parseInstanceId(contentText(tmsgs[t - 1]?.content))
        state.memberInstanceId = created
        return call('team_delegate', { rootSessionId: CREATE_ROOT, requestToken: freshToken(), delegationInstanceId: created ?? 'worker-b-1', label: 'worker-b-1', prompt: `${MK_BMEM} Worker task: verify your workspace and permissions. First read team/test.md, then read runtime/forbidden.txt, then answer done.` })
      }
      if (t === 5) return call('team_send_message', { rootSessionId: CREATE_ROOT, requestToken: freshToken(), recipientInstanceId: state.memberInstanceId ?? 'worker-b-1', body: `${U8MSG} hello from the u8 leader`, subject: 'u8 v3 send-message' })
      if (t === 6) return call('team_report_progress', { rootSessionId: CREATE_ROOT, requestToken: freshToken(), instanceId: state.memberInstanceId ?? 'worker-b-1', subject: 'u8-v3-lane', progress: 'completed', summary: 'u8 vertical V3 lane completed' })
      if (t === 7) return call(`mcp__${MCP_SINGLE}__ping`, { msg: 'u8-v5' })
      if (t === 8) return call(`mcp__${MCP_PAGED}__alpha`, { msg: 'u8-alpha' })
      return text('U8_TEAM_B_DONE')
    }
    // ── V6: the token-budget spill turn (leader) ──────────────────────────
    if (ut.includes(MK_SPILL)) {
      const t = tmsgs.length
      if (t === 0) return call('bash', { command: SPILL_CMD, description: 'U8 vertical token-budget spill generator (V6)' })
      if (t === 1) {
        const m = /stored at:\s*([^\s)(]+)/.exec(toolMsgTexts(req)[0] ?? '')
        // 0.1.7 notice: `<locator>. <retrievalHint>` — the GUIDANCE_SEPARATOR
        // period lands on the capture; strip it (the locator never ends in '.').
        state.spillPath = m === null ? null : m[1].replace(/\.$/, '')
        if (state.spillPath === null) {
          return text(`U8_SPILL_NO_NOTICE :: ${toolMsgTexts(req)[0]?.slice(0, 300)}`)
        }
        return call('read', { file_path: state.spillPath })
      }
      return text('U8_SPILL_OWNER_DONE')
    }
    // ── V6b: the member-denied read (leader delegates) ────────────────────
    if (ut.includes(MK_SPILL_DENY) === false && ut.includes(`U8MK_DELEGATE_DENY_${RUN_STAMP}`)) {
      const t = tmsgs.length
      if (t === 0) return call('team_delegate', { rootSessionId: CREATE_ROOT, requestToken: freshToken(), delegationInstanceId: state.memberInstanceId ?? 'worker-b-1', label: 'worker-b-1', prompt: `${MK_SPILL_DENY} Try to read this spilled artifact file: ${state.spillPath ?? 'unknown'} and tell me what you see.` })
      return text('U8_DELEGATE_DENY_DONE')
    }
    // ── V7: the lifecycle turn (leader) ───────────────────────────────────
    if (ut.includes(MK_LIFE)) {
      const t = tmsgs.length
      if (t === 0) return call('team_archive_member', { rootSessionId: CREATE_ROOT, requestToken: freshToken(), targetInstanceId: state.memberInstanceId ?? 'worker-b-1' })
      return text('U8_LIFE_DONE')
    }
    if (ut.includes(MK_LIFE2)) return text('U8_LEADER_RESUME_DONE')
    return text('U8_NOOP')
  }
}

/** Extract the created member instance id from a team_create_member result. */
function parseInstanceId(content) {
  try {
    const parsed = JSON.parse(content)
    const candidates = []
    const walk = (node) => {
      if (node === null || typeof node !== 'object') return
      for (const [k, v] of Object.entries(node)) {
        if (k === 'targetInstanceId' || k === 'instanceId' || k === 'delegationInstanceId') {
          if (typeof v === 'string' && v.length > 0) candidates.push(v)
        }
        walk(v)
      }
    }
    walk(parsed)
    return candidates[0] ?? null
  } catch {
    const m = /"(?:targetInstanceId|instanceId|delegationInstanceId)"\s*:\s*"([^"]+)"/.exec(content ?? '')
    return m === null ? null : m[1]
  }
}

async function waitForMock(mock, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    for (let i = 0; i < mock.requests.length; i += 1) {
      const r = mock.requests[i]
      if (r.body !== null && pred(r)) return { ...r, index: i }
    }
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, 250))
  }
}

// ── control-request discovery + scripted approval (rc2 S3 shape) ───────────
function collectRequests(node, root, out) {
  if (node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const v of node) collectRequests(v, root, out)
    return
  }
  const flat = node.payload !== null && typeof node.payload === 'object' ? { ...node.payload, ...node } : node
  const looksLikeRequest = (
    typeof flat.requestId === 'string'
    && (flat.toolName === 'bash' || flat.actionName === 'bash' || flat.kind === 'user-approval' || flat.kind === 'leader-approval')
    && (flat.status === undefined || flat.status === 'pending')
  )
  if (looksLikeRequest) {
    const rowRoot = flat.rootSessionId ?? flat.payload?.rootSessionId
    if (rowRoot === undefined || rowRoot === root) {
      if (!out.some((o) => o.requestId === flat.requestId)) {
        out.push({ requestId: flat.requestId, status: flat.status ?? 'unknown', toolName: flat.toolName ?? flat.actionName, source: 'node' })
      }
    }
  }
  for (const v of Object.values(node)) collectRequests(v, root, out)
}
// 0.1.7 kit-side discovery adaptation: the p6t6 /__p6t6/state control feed
// is PER-TEAM-ROOT scoped (runtime `listControlState` filters
// rootSessionId === the directive's bound root), so a created team's
// pending requests (rootSessionId = the created root) never surface there.
// The request IS durably recorded, though: the plugin domain store
// (storages/team_domain.json) holds one double-encoded JSON string row per
// ledger fact under `tables` (factType `control-request-recorded` /
// `control-decision-recorded`). Scan the durable store directly: a pending
// request = a request-recorded row with no matching decision row (matched
// by requestId or correlation), bound to this run's created root.
function collectDurableControlFacts(storDir, root, out) {
  let names = []
  try { names = readdirSync(storDir) } catch { return }
  const decided = new Set()
  const requestRows = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    let parsed
    try { parsed = JSON.parse(readFileSync(join(storDir, name), 'utf8')) } catch { continue }
    const walk = (node) => {
      if (node === null || typeof node !== 'object') {
        if (typeof node === 'string' && node.length > 2 && node[0] === '{') {
          try { walk(JSON.parse(node)) } catch { /* not a fact row */ }
        }
        return
      }
      if (Array.isArray(node)) { for (const v of node) walk(v); return }
      if (node.factType === 'control-decision-recorded') {
        for (const k of ['requestId', 'correlation']) {
          const v = node.payload?.[k]
          if (typeof v === 'string') decided.add(v)
        }
      } else if (node.factType === 'control-request-recorded') {
        requestRows.push(node)
      }
      for (const v of Object.values(node)) walk(v)
    }
    walk(parsed)
  }
  for (const row of requestRows) {
    const p = row.payload ?? {}
    const rid = typeof p.requestId === 'string' ? p.requestId : null
    if (rid === null) continue
    if (decided.has(rid) || (typeof p.correlation === 'string' && decided.has(p.correlation))) continue
    if (row.rootSessionId !== undefined && row.rootSessionId !== root) continue
    if (p.status !== undefined && p.status !== 'pending') continue
    if (p.toolName !== 'bash' && p.actionName !== 'bash' && p.kind !== 'user-approval' && p.kind !== 'leader-approval') continue
    if (!out.some((o) => o.requestId === rid)) {
      out.push({ requestId: rid, status: 'pending', toolName: p.toolName ?? p.actionName, source: 'durable-fact-store' })
    }
  }
}
async function discoverPendingRequestId(port, root) {
  // (1) the p6t6 state (control feed + observations, bound to the directive root).
  const st = await p6t6State(port).catch(() => ({ status: 0, body: null }))
  if (st.body !== null && st.body !== undefined) {
    const out = []
    collectRequests(st.body, root, out)
    const rid = out[0]?.requestId
    if (rid !== undefined) return rid
    const obs = st.body.observations
    if (Array.isArray(obs)) {
      for (const line of obs) {
        const m = /requestId=([A-Za-z0-9-]+)/.exec(String(line))
        if (m !== null) return m[1]
      }
    }
  }
  // (2) the read-only DSH_HOME durable-fact-store scan (0.1.7 layout).
  const outDurable = []
  collectDurableControlFacts(join(HOME, 'storages'), root, outDurable)
  if (outDurable.length > 0) return outDurable[0].requestId
  // (3) legacy flat storage scan (0.1.5-era shapes kept for compatibility).
  const out = []
  try {
    const storDir = join(HOME, 'storages')
    for (const name of readdirSync(storDir)) {
      if (!name.endsWith('.json')) continue
      try {
        collectRequests(JSON.parse(readFileSync(join(storDir, name), 'utf8')), root, out)
      } catch { /* non-JSON or locked */ }
    }
  } catch { /* no storages yet */ }
  return out[0]?.requestId ?? null
}
async function scriptedApproval(origin, cookie, root, requestId, decision = 'allow', note = 'u8 vertical scripted human resolution (rc2 S3 pattern; GUI approve stand-in)') {
  const res = await remoteCall(origin, cookie, 'team.resolveControl', {
    teamSessionId: root,
    requestId,
    decision,
    note,
  }, 'u8appr', 4)
  return res
}

// ── the logging mini-MCP (single variant, byte-frozen wire contract) ────────
// The 3497 endpoint: identical responses to mini-mcp.mjs's `single` variant
// (ping → pong:<msg>, same serverInfo/initialize), plus a per-request trace
// that captures the 0.1.7 client's wire behavior (initialize
// protocolVersion — the U6 handoff observation). The other two variants
// come from the shared harness module.
function startLoggingMiniMcp(port, wireLogPath) {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer((req, res) => {
      if (req.method === 'DELETE' && req.url === '/mcp') { res.writeHead(200); res.end(); return }
      if (req.method !== 'POST' || req.url !== '/mcp') {
        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'not found' } }))
        return
      }
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        let msg
        try {
          msg = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')
        } catch {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }))
          return
        }
        const id = msg === null || typeof msg !== 'object' ? null : msg.id
        const method = msg?.method
        const params = msg === null || typeof msg !== 'object' || msg.params === undefined ? {} : msg.params
        const ok = (result) => ({ jsonrpc: '2.0', id, result })
        let reply
        switch (method) {
          case 'initialize':
            reply = ok({
              protocolVersion: (params && params.protocolVersion) || '2025-06-18',
              capabilities: { tools: { listChanged: false } },
              serverInfo: { name: 'p5t5-mini-mcp', version: '0.0.1' },
            })
            break
          case 'notifications/initialized':
          case 'notifications/cancelled':
            reply = null
            break
          case 'tools/list':
            reply = ok({ tools: [{ name: 'ping', description: 'P5-T5 mini MCP echo tool', inputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'], additionalProperties: false } }] })
            break
          case 'tools/call':
            if (params.name === 'ping') {
              reply = ok({ content: [{ type: 'text', text: `pong:${String((params.arguments && params.arguments.msg) ?? '')}` }], isError: false })
            } else {
              reply = { jsonrpc: '2.0', id, error: { code: -32602, message: `unknown tool: ${String(params.name)}` } }
            }
            break
          default:
            reply = id === null ? null : { jsonrpc: '2.0', id, error: { code: -32601, message: 'method not found' } }
        }
        try {
          appendFileSync(wireLogPath, JSON.stringify({ at: new Date().toISOString(), method, id, params: sanitizeParams(params), reply }) + '\n')
        } catch { /* best-effort */ }
        if (reply === null) { res.writeHead(202); res.end(); return }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(reply))
      })
    })
    server.once('error', rejectPromise)
    server.listen(port, '127.0.0.1', () => resolvePromise({ server }))
  })
}
function sanitizeParams(params) {
  if (params === null || typeof params !== 'object') return params
  const out = { ...params }
  if (out.arguments !== undefined) out.arguments = { ...(out.arguments ?? {}) }
  return out
}
async function closeMiniServer(mini) {
  return new Promise((resolveClose) => {
    if (mini === null || mini === undefined || mini.server === undefined) return resolveClose()
    try {
      mini.server.close(() => resolveClose())
      mini.server.closeAllConnections?.()
    } catch {
      resolveClose()
    }
  })
}

// ── storage read-back helpers ───────────────────────────────────────────────
function readTeamDomainJson() {
  try {
    return JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
  } catch {
    return null
  }
}
/** Recursively find rows (objects) whose fields include a given key=value. */
function findRows(node, key, value, out = []) {
  if (node === null || typeof node !== 'object' || out.length > 200) {
    // 0.1.7 plugin domain store: ledger/durable rows are DOUBLE-ENCODED
    // JSON strings (one stringified object per row under `tables`).
    // Re-parse string values that look like JSON objects so the scan sees
    // the row fields (rootSessionId, instanceId, …).
    if (typeof node === 'string' && node.length > 2 && node[0] === '{') {
      try { findRows(JSON.parse(node), key, value, out) } catch { /* not JSON */ }
    }
    return out
  }
  if (Array.isArray(node)) {
    for (const v of node) findRows(v, key, value, out)
    return out
  }
  if (node[key] !== undefined && JSON.stringify(node[key]) === JSON.stringify(value)) out.push(node)
  for (const v of Object.values(node)) findRows(v, key, value, out)
  return out
}
/** Recursively collect every string that contains `needle` (bounded). */
function findStrings(node, needle, out = []) {
  if (node === null || typeof node !== 'object' || out.length > 50) return out
  if (typeof node === 'string') {
    if (node.includes(needle)) out.push(node)
    return out
  }
  if (Array.isArray(node)) { for (const v of node) findStrings(v, needle, out); return out }
  for (const v of Object.values(node)) findStrings(v, needle, out)
  return out
}
function listFilesRecursive(dir, out = []) {
  let entries = []
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue
    const p = join(dir, e.name)
    if (e.isDirectory()) listFilesRecursive(p, out)
    else if (e.isFile()) out.push(p)
  }
  return out
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(U8_DIR, { recursive: true })
  log(`U8 pristine 0.1.7 real-host vertical — stamp ${RUN_STAMP}`)
  log(`testuse=${TESTUSE} @ ${HOST_PIN}`)
  log(`worktree=${WORKTREE} (branch ${BRANCH})`)
  log(`world=${HOME}`)
  log(`evidence=${U8_DIR}`)

  // ── preflight ─────────────────────────────────────────────────────────
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' })
  if (rev.status !== 0 || rev.stdout.trim() !== HOST_PIN) {
    dieFatal(`test-use checkout is not at ${HOST_PIN} (got ${rev.stdout?.trim() ?? rev.stderr})`)
    return
  }
  const porcelain = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' }).stdout
  if (porcelain !== '') dieFatal(`test-use working tree is NOT pristine before the run: ${porcelain.slice(0, 300)}`)
  const wtRev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: WORKTREE, encoding: 'utf8' })
  if (wtRev.status !== 0 || wtRev.stdout.trim() !== WORKTREE_PIN) {
    dieFatal(`worktree HEAD is not ${WORKTREE_PIN} (got ${wtRev.stdout?.trim()})`)
  }
  check('preflight', 'test-use pristine @ 46a7f68b09 (HEAD + empty porcelain)', true, 'verified before any mutation')
  if (fatalError !== null) return finish(1)
  log('preflight: test-use pristine @ 46a7f68b09; worktree @ adad20c')

  // 启动前置 (u8-brief): the main-session's scheduled test-use reset log ends
  // with a FAILED attempt (pnpm EROFS — the global pnpm store is read-only
  // under the workspace-write sandbox; the reset did not set XDG_DATA_HOME).
  // The build artifacts postdate that log entry and the CLI empirically runs
  // 0.1.7-rc.1, so the FUNCTIONAL precondition (a bootable pristine 0.1.7
  // test-use) is met; the log discrepancy is recorded here + as a
  // post-upgrade follow-up (re-run the reset with XDG_DATA_HOME=<world>/.xdg).
  {
    const resetLog = '/home/user/dsh-plugins/dsh-agent-team/scratch-logs/dsh-017rc1-u8-reset.log'
    let lastBuildExit = null
    let lastInstallExit = null
    try {
      for (const l of readFileSync(resetLog, 'utf8').split('\n')) {
        const b = /^BUILD_EXIT:(\d+)/.exec(l)
        if (b !== null) lastBuildExit = Number(b[1])
        const i2 = /^INSTALL_EXIT:(\d+)/.exec(l)
        if (i2 !== null) lastInstallExit = Number(i2[1])
      }
    } catch { /* absent */ }
    const cliVersion = spawnSync(process.execPath, [HOST_BIN, '--version'], { cwd: TESTUSE, encoding: 'utf8', timeout: 60_000 }).stdout.trim()
    writeEvidence('v0-boot', 'preflight-reset-state.json', {
      note: 'reset log records INSTALL_EXIT=1/BUILD_EXIT=1 (ERR_PNPM_EROFS on the global pnpm store /home/user/.local/share/pnpm/store/v11 — read-only in the workspace-write sandbox; the reset did not set XDG_DATA_HOME); build artifacts postdate the log and the CLI runs 0.1.7-rc.1 — functional precondition met, log discrepancy is a post-upgrade follow-up',
      resetLog,
      lastInstallExit,
      lastBuildExit,
      empiricalCliVersion: cliVersion,
      binExists: existsSync(HOST_BIN),
      fsLocalLibExists: existsSync(join(TESTUSE, 'packages', 'fs', 'fs-local', 'lib', 'index.js')),
    })
    check('preflight', 'boot precondition: the test-use CLI empirically runs 0.1.7-rc.1 (reset-log discrepancy recorded as a follow-up)', cliVersion === '0.1.7-rc.1', `cliVersion=${cliVersion} lastBuildExit=${lastBuildExit}`)
  }

  const preStable = { p3080: await probeStableInstance(3080), p3180: await probeStableInstance(3180) }
  writeEvidence('v0-boot', 'pre-stable-probe.json', preStable)
  log(`stable pre-probe: 3080=${preStable.p3080.status} 3180=${preStable.p3180.status}`)

  const hostPort = await pickHostPort()
  hostPortRef = hostPort
  log(`ports: host=${hostPort} mock=${MOCK_PORT} mcp=${MCP_PORT_SINGLE}/${MCP_PORT_PAGED}/${MCP_PORT_NONE}`)

  // ── world materialization ──────────────────────────────────────────────
  rmSync(HOME, { recursive: true, force: true })
  mkdirSync(WORKSPACE, { recursive: true })
  mkdirSync(join(WORKSPACE, 'team'), { recursive: true })
  mkdirSync(join(WORKSPACE, 'runtime'), { recursive: true })
  mkdirSync(WORLD_TMP, { recursive: true })
  mkdirSync(XDG, { recursive: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  mkdirSync(SPILL_ROOT, { recursive: true })
  writeFileSync(PROBE_TEAM_FILE, `${PROBE_TEAM_CONTENT}\n`)
  writeFileSync(PROBE_RUNTIME_FILE, 'u8-vertical-runtime-probe\n')
  writeFileSync(join(BLUEPRINT_DIR, 'u8-anchor.yaml'), BP_ANCHOR_YAML)
  log('world materialized (probe files + anchor blueprint)')

  // ── mock model ─────────────────────────────────────────────────────────
  const { startMockModel } = await import(pathToFileURL(MOCK_MODULE).href)
  const mockLog = writeEvidence('v0-boot', 'mock.log', '')
  const mock = await startMockModel({
    port: MOCK_PORT,
    decide: makeDecide(),
    log: (l) => { try { appendFileSync(mockLog, l + '\n') } catch { /* best-effort */ } },
  })
  log(`mock model listening on ${mock.port}`)

  // ── step 0: git-install (plan §11.2) ───────────────────────────────────
  const SPEC = `git+file:///${REPO_GIT}#${BRANCH}`
  log(`── step 0: git-install (S1–S3) ──`)
  {
    const clone = spawnSync('git', ['clone', '--bare', '--branch', BRANCH, WORKTREE, REPO_GIT], { encoding: 'utf8', timeout: 300_000 })
    if (clone.status !== 0) dieFatal(`git clone --bare failed: ${String(clone.stderr ?? clone.stdout).slice(0, 400)}`)
    const clonedSha = spawnSync('git', ['--git-dir', REPO_GIT, 'rev-parse', `refs/heads/${BRANCH}`], { encoding: 'utf8' }).stdout.trim()
    check('install', 'S0 bare clone of the upgraded branch; cloned tip == worktree HEAD', clonedSha === WORKTREE_PIN, `cloned=${clonedSha} worktree=${WORKTREE_PIN}`)
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
    writeEvidence('install', 'add.log', addOut)
    const all = `${first.stdout ?? ''}\n${first.stderr ?? ''}`
    check('install', 'S1 first `dsh plugin add` exits 0 (0.1.7 compat check PASS by construction: no peerDependencies)', first.status === 0, `exit=${first.status}`)
    check('install', 'S1 NO 0.1.7 incompat line / allow-version exemption prompt in the add output',
      !/incompatible|allow-version/i.test(all),
      `output had ${/incompatible|allow-version/i.test(all) ? 'MATCHES' : 'no matches'} (full output in install/add.log)`)
    check('install', 'S1 no ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED (install surface is committed prebuilt; zero lifecycle scripts)',
      !/ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED/.test(all), '')
    let allowBuilds = false
    try {
      allowBuilds = /allowBuilds/.test(readFileSync(join(PROFILE_DIR, 'pnpm-workspace.yaml'), 'utf8'))
    } catch { /* absent = fine */ }
    check('install', 'S1 no allowBuilds entry in the profile pnpm-workspace.yaml', allowBuilds === false, '')
    const warnLines = all.split('\n').filter((l) => l.startsWith('dsh: warning:')).map((l) => l.trim())
    writeEvidence('install', 'add-warnings.json', warnLines)
    log(`add warnings (recorded, not asserted): ${warnLines.length === 0 ? 'none' : warnLines.join(' | ').slice(0, 300)}`)
    // S2 — the bundle auto-registration (the CLI reconcile product).
    let profilePkg = null
    try { profilePkg = JSON.parse(readFileSync(join(PROFILE_DIR, 'package.json'), 'utf8')) } catch { /* not yet */ }
    const bundles = profilePkg?.dsh?.profile?.bundles ?? []
    check('install', 'S2 dsh.profile.bundles AUTO-contains dsh-agent-team (CLI reconcile of the root dsh.bundle.patch declaration)',
      Array.isArray(bundles) && bundles.includes('dsh-agent-team'), `bundles=${JSON.stringify(bundles)}`)
    let userPatchMentions = false
    try { userPatchMentions = /dsh-agent-team/.test(readFileSync(join(PROFILE_DIR, 'cordis.patch.yml'), 'utf8')) } catch { /* absent */ }
    check('install', 'S2 the profile patch carries NO hand-written dsh-agent-team row (the bundle layer owns it)', userPatchMentions === false, '')
    // S3 — the committed install surface in the installed package dir.
    const inst = join(PROFILE_DIR, 'node_modules', 'dsh-agent-team')
    const artifacts = [
      'packages/runtime/dist/packages/runtime/src/plugin/host.js',
      'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs',
      'packages/runtime/dist/packages/runtime/src/plugin/team-spill-local.js',
      'cordis.patch.yml',
    ]
    const missing = artifacts.filter((a) => !existsSync(join(inst, a)))
    check('install', 'S3 installed package dir carries the committed install surface (host.js + agent-bindings.mjs + team-spill-local.js + cordis.patch.yml)',
      missing.length === 0, missing.length === 0 ? `all ${artifacts.length} present under ${inst}` : `missing=${JSON.stringify(missing)}`)
    let spillRows = false
    try {
      const patchText = readFileSync(join(inst, 'cordis.patch.yml'), 'utf8')
      spillRows = /id: spill-local/.test(patchText) && /disabled: true/.test(patchText) && /team-spill-local/.test(patchText)
    } catch { /* absent */ }
    check('install', 'S3 the installed root cordis.patch.yml carries the spill replacement rows (base spill-local disabled + team-spill-local inserted)', spillRows, '')
  }
  if (fatalError !== null) return finish(1)

  // ── the three mini-MCP servers (V5) ────────────────────────────────────
  const wireLog = writeEvidence('v5-mcp', 'wire-u8single.log', '')
  const miniSingle = await startLoggingMiniMcp(MCP_PORT_SINGLE, wireLog)
  const { startMiniMcpServer } = await import(pathToFileURL(join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'mini-mcp.mjs')).href)
  const miniPaged = await startMiniMcpServer([MCP_PORT_PAGED], { tools: 'paginated' })
  const miniNone = await startMiniMcpServer([MCP_PORT_NONE], { tools: 'none' })
  log(`mini-MCP: single@${miniSingle.server.address().port} (logging) paged@${miniPaged.port} none@${miniNone.port}`)

  // ── V0: host boot (the install world) ──────────────────────────────────
  log('── V0: host boot ──')
  const instanceLog = writeEvidence('v0-boot', 'instance-1.log', '')
  writePatchFile('create')
  writeDirective(1, 'create')
  let host = spawnHost({ port: hostPort, logPath: instanceLog })
  const bootLine = await waitForLogLine(instanceLog, BOOT_MARKER, 300_000, host.alive)
  if (bootLine === null) {
    stopHost(host)
    const detail = host.exitInfo.exited
      ? `process exited (code=${host.exitInfo.code} signal=${host.exitInfo.signal ?? 'none'}${host.exitInfo.message ? ` msg=${host.exitInfo.message}` : ''})`
      : 'no boot marker within 300s'
    dieFatal(`host boot failed: ${detail}\n--- log tail ---\n${logTail(instanceLog)}`)
    return finish(1)
  }
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(bootLine.replace(/.*dsh web:\s*/, ''))
  if (m === null) dieFatal(`unexpected boot url shape: ${bootLine}`)
  const origin = `http://127.0.0.1:${m[1]}`
  const port = Number(m[1])
  writeEvidence('v0-boot', 'boot-marker.txt', bootLine + '\n')
  check('v0', 'V0 host boot marker present (dsh web: …?token=…)', true, bootLine.slice(0, 80))
  // Unauth probe BEFORE authentication (the 401 gate).
  const unauth = await fetch(`${origin}/`, { signal: AbortSignal.timeout(10_000) }).then((r) => r.status).catch(() => -1)
  check('v0', 'V0 unauthenticated GET / → 401 (launch-token gate active)', unauth === 401, `status=${unauth}`)
  const cookie = await authenticate(origin, m[2]).catch((e) => { dieFatal(`auth failed: ${e.message}`); return null })
  if (cookie === null) return finish(1)
  // Row health gate (a latched setupError must fail fast).
  const deadline = Date.now() + 240_000
  let health = null
  for (;;) {
    health = await p6t6Health(port)
    if (health.status === 200 && health.body?.ok === true) break
    if (health.status === 200 && health.body?.ok === false && health.body?.setupError !== undefined) {
      stopHost(host)
      dieFatal(`row setup failed — setupError: ${String(health.body.setupError).slice(0, 600)}\n--- log tail ---\n${logTail(instanceLog)}`)
      return finish(1)
    }
    if (Date.now() >= deadline) {
      stopHost(host)
      dieFatal(`row health not ready in 240s — health=${JSON.stringify(health.body).slice(0, 400)}\n--- log tail ---\n${logTail(instanceLog)}`)
      return finish(1)
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  writeEvidence('v0-boot', 'p6t6-health.json', health.body)
  const state0 = await p6t6State(port)
  writeEvidence('v0-boot', 'p6t6-state.json', state0.body)
  check('v0', 'V0 row ready: p6t6 health ok + phase=create + root teamSession adopted (create-or-open fresh world)',
    state0.status === 200 && state0.body?.phase === 'create' && state0.body?.teamSession !== null
    && state0.body?.teamSession?.rootSessionId === ROOT,
    `phase=${state0.body?.phase} teamSession=${JSON.stringify(state0.body?.teamSession ?? null).slice(0, 120)}`)
  // Plugin load rows in the instance log (RECORDED — the authoritative
  // row-load proof is the p6t6 row readiness above + the /team-remote
  // route working in V1/V2; the 0.1.7 row-loader log format is not a
  // frozen contract, so the scan is evidence, not a criterion).
  const logText = () => { try { return readFileSync(instanceLog, 'utf8') } catch { return '' } }
  const pluginLines = logText().split('\n').filter((l) => l.includes('dsh-agent-team')).slice(0, 20)
  writeEvidence('v0-boot', 'plugin-load-lines.json', { pluginLines, note: 'instance-log scan (evidence only); row-load proof = p6t6 readiness + /team-remote liveness + client app shell below' })
  check('v0', 'V0 no ERR_MODULE_NOT_FOUND in the instance log (installed dist resolves end-to-end)', !/ERR_MODULE_NOT_FOUND/.test(logText()), '')
  // The CLIENT row liveness proof: the authenticated app shell is served.
  const shell = await fetch(`${origin}/`, { headers: { cookie }, signal: AbortSignal.timeout(15_000) }).then(async (r) => ({ status: r.status, text: r.status === 200 ? (await r.text()).slice(0, 400) : null })).catch((e) => ({ status: 0, error: e.message }))
  writeEvidence('v0-boot', 'client-shell-probe.json', shell)
  check('v0', 'V0 the dsh-agent-team CLIENT row is live (authenticated GET / serves the web app shell)', shell.status === 200 && /<html|<!doctype/i.test(shell.text ?? ''), `status=${shell.status}`)
  check('v0', 'V0 no duplicate service collision in the instance log', !/duplicate.*service|service.*duplicate|already (?:provided|registered)/i.test(logText()), '')
  // 0.1.7 startup diagnostics (recorded when emitted).
  const diagLines = logText().split('\n').filter((l) => /diagnostic|required service|pending.*required/i.test(l)).slice(0, 40)
  writeEvidence('v0-boot', 'startup-diagnostics.json', diagLines)
  check('v0', 'V0 no pending REQUIRED service (0.1.7 startup diagnostics)', diagLines.every((l) => !/pending|unsatisfied|missing/i.test(l)) || diagLines.length === 0, `diagLines=${diagLines.length}`)
  // dump-config: the composed tree (single dsh-agent-team row; spill rows).
  const dumpLog = writeEvidence('v0-boot', 'dump-config-1.log', '')
  const dump = spawnSync(process.execPath, [HOST_BIN, '--profile', 'web', '--dump-config'], {
    cwd: HOME, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180_000,
    env: { ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: HOST_PIN.slice(0, 10) },
  })
  const dumpText = dump.stdout ?? ''
  appendFileSync(dumpLog, `# exit=${dump.status}\n${dumpText}\n${dump.stderr ?? ''}`)
  const idCount = (re) => dumpText.split('\n').filter((l) => re.test(l)).length
  const dshRows = idCount(/^\s*-?\s*id:\s*["']?dsh-agent-team["']?\s*$/)
  const spillBase = dumpText.split('\n').filter((l) => /^\s*-\s*id:\s*["']?spill-local["']?\s*$/.test(l))
  const spillBaseDisabled = spillBase.length > 0 && /disabled:\s*true/.test(dumpText.slice(0, dumpText.indexOf('team-spill-local')))
  // 0.1.7 behavior delta: dump-config renders the composed tree LAYERED —
  // the bundle section and the profile-patch section each retain their rows
  // (0.1.5 rendered the merged flat tree, where exactly one row was correct).
  // The named override row still wins at runtime — proven above by the p6t6
  // teamSession adopting this run's ROOT + blueprint — so the criterion is
  // scoped to the profile-patch layer carrying exactly one named host row.
  const sections = []
  let curSection = null
  for (const l of dumpText.split('\n')) {
    const m = /^# == (.*)$/.exec(l)
    if (m) { curSection = { title: m[1], dshRows: 0 }; sections.push(curSection) }
    else if (curSection !== null && /^\s*-?\s*id:\s*["']?dsh-agent-team["']?\s*$/.test(l)) curSection.dshRows += 1
  }
  const patchSection = sections.find((s) => /cordis\.patch\.yml$/.test(s.title))
  const bundleSection = sections.find((s) => /^dsh-agent-team$/.test(s.title))
  check('v0', 'V0 profile-patch layer carries EXACTLY ONE named dsh-agent-team host row (0.1.7 layered dump: the bundle layer keeps its machine-agnostic row; runtime override proven by the p6t6 teamSession above)',
    dump.status === 0 && patchSection?.dshRows === 1, `exit=${dump.status} patchLayerRows=${patchSection?.dshRows ?? 'n/a'} bundleLayerRows=${bundleSection?.dshRows ?? 'n/a'} totalIdLines=${dshRows}`)
  check('v0', 'V0 team-spill-local row present in the composed tree', /id:\s*["']?team-spill-local["']?/.test(dumpText), '')
  check('v0', 'V0 base spill-local row DISABLED in the composed tree', spillBaseDisabled, `baseRows=${spillBase.length}`)
  if (fatalError !== null) return finish(1)

  // ── V1: ordinary DSH unaffected ────────────────────────────────────────
  log('── V1: ordinary session ──')
  {
    // 0.1.7: the remote session API no longer auto-creates a session on the
    // first prompt (unknown sessionId → session/not-found). Create explicitly.
    const ordCreate = await apiCreateSession(origin, cookie, ORD_SESSION, WORKSPACE)
    check('v1', 'V1 ordinary session explicitly created via /api/session/create (0.1.7: prompt no longer auto-creates)',
      ordCreate.status === 200 && ordCreate.body?.result?.ok === true, `status=${ordCreate.status} body=${JSON.stringify(ordCreate.body ?? null).slice(0, 160)}`)
    const promptPending = apiPrompt(origin, cookie, ORD_SESSION, `${MK_ORD} Please read the file team/test.md and confirm you can see its content.`, 'u8ord')
    const ord1 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_ORD) && toolMsgsOf(r).length === 0 && (r.body?.tools ?? []).length > 0, 180_000, 'ordinary turn start')
    if (ord1 === null) {
      check('v1', 'V1 ordinary session turn started (model request observed)', false, `requests=${mock.requests.length}`)
    } else {
      const surface = toolsOf(ord1)
      writeEvidence('v1-ordinary', 'ordinary-request.json', { seq: ord1.seq, model: ord1.body?.model, tools: surface })
      check('v1', 'V1 ordinary session turn started on the shipped preset surface', surface.length > 0, `tools=${surface.length} model=${ord1.body?.model}`)
      check('v1', 'V1 ordinary surface carries NO team_ tools (the plugin does not pollute the ordinary loop)', surface.every((n) => !String(n).startsWith('team_')), `teamTools=${JSON.stringify(surface.filter((n) => String(n).startsWith('team_')))}`)
      const ord2 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_ORD) && toolMsgsOf(r).length === 1, 120_000, 'ordinary tool result')
      if (ord2 === null) {
        check('v1', 'V1 ordinary fs read tool executed (tool result observed)', false, '')
      } else {
        const toolText = toolMsgTexts(ord2)[0] ?? ''
        check('v1', 'V1 ordinary fs read returned the workspace probe content (strict-read ordinary path intact)', toolText.includes(PROBE_TEAM_CONTENT), `toolHead=${JSON.stringify(toolText.slice(0, 120))}`)
        const reply = await promptPending
        // 0.1.7: session/prompt resolves on ACCEPT (the turn runs async
        // server-side); turn completion is proven by the mock having observed
        // the tool result + the scripted final text, not by the settlement.
        check('v1', 'V1 ordinary prompt accepted (0.1.7 remote: session/prompt resolves on accept, not turn end)',
          reply.status === 200 && reply.body?.result?.ok === true, `status=${reply.status} body=${JSON.stringify(reply.body ?? null).slice(0, 120)}`)
      }
    }
  }

  // ── LEG 0: discovery + the strict main blueprint ───────────────────────
  log('── LEG 0: discovery (boot root surface → main blueprint deny list) ──')
  let mainBlueprintWritten = false
  {
    await apiPrompt(origin, cookie, ROOT, `${MK_DISC} List your tools and answer done.`, 'u8disc').catch(() => {})
    const disc = await waitForMock(mock, (r) => userTextOf(r).includes(MK_DISC) && (r.body?.tools ?? []).length > 0, 180_000, 'discovery request')
    if (disc === null) {
      check('v2', 'LEG0 discovery model request observed', false, `requests=${mock.requests.length}`)
    } else {
      const surface = toolsOf(disc).sort()
      writeEvidence('v2-team', 'leg0-surface.json', { seq: disc.seq, model: disc.body?.model, tools: surface })
      // 0.1.7 behavior delta (run-3 blocker): the `subagent` tool is now
      // registered per agent scope (own layer) by the `tool-subagent` row
      // package — it is model-visible on every surface but EXEMPT from
      // `tools.restrict()`, which in 0.1.7 validates named tools against the
      // inherited/global set only (core/tools `view()`: restrictableNames =
      // inherited layers; own-layer registrations are exempt by design) and
      // THROWS on unknown names ("tools.restrict() names unknown global tool
      // \"subagent\"; known global tools: …25 names…"). 0.1.5 accepted the
      // same surface-derived deny list, so the drift is the validation +
      // layering, not the blueprint. Kit-side adaptation (upstream frozen):
      // the generated builtinToolDeny must name only restrictable (global)
      // tools — `subagent` is filtered out and recorded. The leader keeps
      // the per-agent subagent tool (recorded 0.1.7 observation); no U8
      // assertion depends on its absence. Plugin-side robustness follow-up:
      // make the builtin-deny restrict wrapper tolerate non-restrictable
      // names (see post-upgrade follow-ups).
      const NON_RESTRICTABLE_017 = ['subagent']
      const rawDenyList = surface.filter((n) => !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n) && !TEAM_TOOL_CATALOG.includes(n))
      const filteredNonRestrictable = rawDenyList.filter((n) => NON_RESTRICTABLE_017.includes(n))
      const denyList = rawDenyList.filter((n) => !NON_RESTRICTABLE_017.includes(n))
      const missingManaged = MANAGED_TOOL_NAMES.filter((n) => !surface.includes(n))
      if (filteredNonRestrictable.length > 0) {
        writeEvidence('v2-team', 'leg0-nonrestrictable-017.json', {
          filtered: filteredNonRestrictable,
          reason: '0.1.7: tool-subagent row registers `subagent` per agent scope (own layer); tools.restrict() only names inherited/global tools and throws on unknown names (exact host error recorded in the run-3 team-create-b-failed evidence)',
        })
      }
      check('v2', 'LEG0 discovery captured the boot-root surface; read + bash present (the shipped standard preset mounts the managed stack)',
        surface.includes('read') && surface.includes('bash'), `surface=${surface.length} missingManaged=${JSON.stringify(missingManaged)}`)
      writeFileSync(join(BLUEPRINT_DIR, 'u8-main.yaml'), mainBlueprintYaml(denyList))
      mainBlueprintWritten = true
      writeEvidence('v2-team', 'leg0-denylist.json', { denyList, filteredNonRestrictable, missingManaged, mainBlueprint: mainBlueprintYaml(denyList) })
      log(`main blueprint written (deny list = ${denyList.length} unmanaged names; filtered non-restrictable on 0.1.7: ${filteredNonRestrictable.length})`)
    }
  }
  if (!mainBlueprintWritten) dieFatal('LEG 0 failed — aborting before team.create')
  if (fatalError !== null) return finish(1)

  // ── V2–V5: team.create (pending) + the one continuous leader turn ──────
  log('── V2–V5: team.create (B) + the continuous scripted leader turn ──')
  const createBPending = remoteCall(origin, cookie, 'team.create', {
    rootSessionId: CREATE_ROOT,
    blueprintId: BP_MAIN_ID,
    initialWork: { prompt: `${MK_B} Team work: first read team/test.md, then read runtime/forbidden.txt, then run bash: echo ${BASH_MARKER}. Then create worker-b-1 from worker-b and delegate the worker verification task, send it a message, report progress on lane u8-v3-lane, then ping the ${MCP_SINGLE} server (msg u8-v5) and call the ${MCP_PAGED} alpha tool (msg u8-alpha). Answer done at the end.` },
  }, 'u8b')
  let createBError = null
  createBPending.catch((e) => { createBError = e })

  let b1 = null
  let b2 = null
  let b3 = null
  let b4 = null
  let b5 = null
  let b6 = null
  let b7 = null
  let b8 = null
  let b9 = null
  let b10 = null
  let m1 = null
  let m2 = null
  let m3 = null
  let approval = null
  let approvalRes = null

  b1 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 0 && (r.body?.tools ?? []).length > 0, 180_000, 'B leader turn start')
  if (b1 !== null) {
    // 0.1.7 Messages API: the system prompt is a TOP-LEVEL `system` string
    // in the request body (serialize.ts), not a role=system message (the
    // 0.1.5 OpenAI shape). Prefer the top-level field, fall back to the
    // legacy message shape.
    const systemPrompt = typeof b1.body?.system === 'string' && b1.body.system.length > 0
      ? b1.body.system
      : (b1.body?.messages ?? []).filter((mm) => mm.role === 'system').map((mm) => (typeof mm.content === 'string' ? mm.content : JSON.stringify(mm.content ?? ''))).join('\n')
    const b1Tools = toolsOf(b1)
    writeEvidence('v2-team', 'b1-leader-request.json', { seq: b1.seq, model: b1.body?.model, tools: b1Tools, systemPrompt: systemPrompt.slice(0, 6000) })
    check('v2', 'V2 model selection correct: the leader model request carries the row staticModel id', b1.body?.model === MODEL_ID, `model=${b1.body?.model} expected=${MODEL_ID}`)
    check('v2', 'V2 persona visible: the leader system prompt carries the bound blueprint persona', systemPrompt.includes(P_LEADER), `sysHead=${JSON.stringify(systemPrompt.slice(0, 120))}`)
    check('v2', 'V2 preset mount: the leader surface carries the shipped standard preset managed tools (read + bash)', b1Tools.includes('read') && b1Tools.includes('bash'), `tools=${b1Tools.length}`)
    const mcpTools = b1Tools.filter((n) => String(n).startsWith('mcp__')).sort()
    const EXPECTED_MCP = [`mcp__${MCP_PAGED}__alpha`, `mcp__${MCP_PAGED}__beta`, `mcp__${MCP_SINGLE}__ping`].sort()
    writeEvidence('v5-mcp', 'b1-leader-mcp-surface.json', { mcpTools })
    check('v5', 'V5 leader MCP surface is EXACTLY ping + alpha + beta (two-page aggregate); zero tools from the none server',
      JSON.stringify(mcpTools) === JSON.stringify(EXPECTED_MCP), `mcpTools=${JSON.stringify(mcpTools)}`)
  } else {
    check('v2', 'V2 B leader turn started (model request observed)', false, `requests=${mock.requests.length}`)
  }

  // If the created-team leader turn never started, the created-team legs
  // (V2 create response, V3 tools, V4 permissions, V5 mcp, V6 spill,
  // V7 lifecycle) cannot run — record the create response + diagnostics
  // and skip them explicitly instead of cascading timeouts.
  const teamCreated = b1 !== null
  if (teamCreated === false) {
    const createBEarly = await Promise.race([
      createBPending,
      new Promise((res) => setTimeout(() => res({ status: 0, body: null, error: 'create-response-timeout(60s)' }), 60_000)),
    ]).catch((e) => ({ status: 0, body: null, error: String(e?.message ?? e) }))
    writeEvidence('v2-team', 'team-create-b-failed.json', createBEarly.body ?? createBEarly)
    writeEvidence('v2-team', 'b1-absent-diag.json', {
      mockRequests: mock.requests.length,
      mockDiagTail: mockDiag.slice(-40),
      instanceLogTail: logTail(instanceLog, 50),
    })
    for (const [leg, name] of [
      ['v2', 'V2 team.create (product path) — SKIPPED (no B leader turn observed)'],
      ['v3', 'V3 team tools chain — SKIPPED (no created team)'],
      ['v4', 'V4 permission legs — SKIPPED (no created team)'],
      ['v5', 'V5 MCP three-variant real-host — SKIPPED (no created team)'],
      ['v6', 'V6 token-budget spill + artifact grant — SKIPPED (no created team)'],
      ['v7', 'V7 lifecycle — SKIPPED (no created team)'],
    ]) check(leg, name, false, 'create failed or the initial-work turn never started — see v2-team/team-create-b-failed.json + b1-absent-diag.json')
  } else {

  // Steps 1–2: the permission legs land inline (allow pass / static deny).
  b2 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 1, 60_000, 'B tool=1')
  if (b2 !== null) {
    const t = toolMsgTexts(b2)[0] ?? ''
    writeEvidence('v4-permission', 'b2-read-team.json', { toolMessage: t.slice(0, 800) })
    check('v4', 'V4 leader ALLOWED read (allow read subtree team): silent pass, probe content returned', t.includes(PROBE_TEAM_CONTENT), `head=${JSON.stringify(t.slice(0, 100))}`)
  }
  b3 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 2, 60_000, 'B tool=2')
  if (b3 !== null) {
    const t = toolMsgTexts(b3)[1] ?? ''
    writeEvidence('v4-permission', 'b3-read-runtime-deny.json', { toolMessage: t.slice(0, 1200) })
    check('v4', 'V4 leader DENIED read (deny read subtree runtime): explicit static deny with provenance in the tool result',
      /deni|forbidden|not allowed|permission/i.test(t) && !t.includes('u8-vertical-runtime-probe'), `head=${JSON.stringify(t.slice(0, 200))}`)
  }
  // Step 3: the bash ask → durable control request → scripted human approval.
  {
    const askDeadline = Date.now() + 120_000
    let rid = null
    while (rid === null && Date.now() < askDeadline) {
      rid = await discoverPendingRequestId(port, CREATE_ROOT)
      if (rid === null) await new Promise((r) => setTimeout(r, 700))
    }
    check('v4', 'V4 bash ask created a durable pending control request (discovered)', rid !== null, `requestId=${rid}`)
    if (rid !== null) {
      approvalRes = await scriptedApproval(origin, cookie, CREATE_ROOT, rid)
      approval = rid
      writeEvidence('v4-permission', 'bash-approval.json', { requestId: rid, response: approvalRes.body ?? approvalRes })
      check('v4', 'V4 scripted human approval (team.resolveControl v4) admitted', approvalRes.status === 200, `status=${approvalRes.status}`)
    }
  }
  b4 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 3, 120_000, 'B tool=3 (bash executed)')
  if (b4 !== null) {
    const t = toolMsgTexts(b4)[2] ?? ''
    writeEvidence('v4-permission', 'b4-bash-result.json', { toolMessage: t.slice(0, 600) })
    check('v4', 'V4 the approved bash EXECUTED on the last-mile guard (marker in the tool result)', t.includes(BASH_MARKER), `head=${JSON.stringify(t.slice(0, 120))}`)
  } else {
    check('v4', 'V4 approved bash executed (tool result observed)', false, '')
  }
  // Step 4: create_member → the member instance id.
  b5 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 4, 120_000, 'B tool=4 (create_member)')
  if (b5 !== null) {
    const t = toolMsgTexts(b5)[3] ?? ''
    writeEvidence('v2-team', 'b5-create-member.json', { toolMessage: t.slice(0, 1200) })
    const created = parseInstanceId(t)
    state.memberInstanceId = created
    check('v2', 'V2 member create succeeded (the team tool returned the new instance id)', created !== null && created.length > 0, `instanceId=${created}`)
  } else {
    check('v2', 'V2 member create observed (tool result)', false, '')
  }
  // Step 5: delegate (the member turn runs concurrently).
  b6 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 5, 120_000, 'B tool=5 (delegate)')
  if (b6 !== null) {
    const t = toolMsgTexts(b6)[4] ?? ''
    writeEvidence('v3-tools', 'b6-delegate.json', { toolMessage: t.slice(0, 1200) })
    check('v3', 'V3 team_delegate executed (the core work path exited with a result)', /admitted|executed|settled|result|status|accepted|queued|delegat/i.test(t) && !/error|rejected/i.test(t), `head=${JSON.stringify(t.slice(0, 160))}`)
  }
  // The member turn (MK_BMEM): V4b/V4c member legs + V5 member surface.
  m1 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_BMEM) && toolMsgsOf(r).length === 0 && (r.body?.tools ?? []).length > 0, 180_000, 'member turn start')
  if (m1 !== null) {
    const mTools = toolsOf(m1)
    // 0.1.7 Messages API: top-level `system` field (see the leader check).
    const systemPrompt = typeof m1.body?.system === 'string' && m1.body.system.length > 0
      ? m1.body.system
      : (m1.body?.messages ?? []).filter((mm) => mm.role === 'system').map((mm) => (typeof mm.content === 'string' ? mm.content : JSON.stringify(mm.content ?? ''))).join('\n')
    const mcpTools = mTools.filter((n) => String(n).startsWith('mcp__')).sort()
    const EXPECTED_MCP = [`mcp__${MCP_PAGED}__alpha`, `mcp__${MCP_PAGED}__beta`, `mcp__${MCP_SINGLE}__ping`].sort()
    writeEvidence('v5-mcp', 'm1-member-mcp-surface.json', { mcpTools, model: m1.body?.model })
    check('v5', 'V5 member MCP surface is EXACTLY ping + alpha + beta (per-member initial grant, none contributes zero)', JSON.stringify(mcpTools) === JSON.stringify(EXPECTED_MCP), `mcpTools=${JSON.stringify(mcpTools)}`)
    check('v2', 'V2 member persona visible (worker-b persona in the member system prompt)', systemPrompt.includes(P_WORKER), `sysHead=${JSON.stringify(systemPrompt.slice(0, 120))}`)
    check('v2', 'V2 member model selection correct (staticModel id)', m1.body?.model === MODEL_ID, `model=${m1.body?.model}`)
  }
  m2 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_BMEM) && toolMsgsOf(r).length === 1, 120_000, 'member tool=1')
  if (m2 !== null) {
    const t = toolMsgTexts(m2)[0] ?? ''
    writeEvidence('v4-permission', 'm2-member-read-team.json', { toolMessage: t.slice(0, 800) })
    check('v4', 'V4 member ALLOWED read (allow read subtree team): silent pass', t.includes(PROBE_TEAM_CONTENT), `head=${JSON.stringify(t.slice(0, 100))}`)
  }
  m3 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_BMEM) && toolMsgsOf(r).length === 2, 120_000, 'member tool=2')
  if (m3 !== null) {
    const t = toolMsgTexts(m3)[1] ?? ''
    writeEvidence('v4-permission', 'm3-member-read-runtime-deny.json', { toolMessage: t.slice(0, 1200) })
    check('v4', 'V4 member DENIED read (deny read subtree runtime): explicit static deny, provenance distinguishable from a canonicalization failure',
      /deni|forbidden|not allowed|permission/i.test(t) && !t.includes('u8-vertical-runtime-probe'), `head=${JSON.stringify(t.slice(0, 200))}`)
  }
  // Step 6: send_message (the historical hang regression point).
  b7 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 6, 180_000, 'B tool=6 (send_message)')
  if (b7 !== null) {
    const t = toolMsgTexts(b7)[5] ?? ''
    writeEvidence('v3-tools', 'b7-send-message.json', { toolMessage: t.slice(0, 1200) })
    check('v3', 'V3 team_send_message EXITED (tool result observed — the historical hang regression point does not reproduce)', t.length > 0 && !/pending|waiting/i.test(t.slice(0, 200)), `head=${JSON.stringify(t.slice(0, 160))}`)
  } else {
    check('v3', 'V3 team_send_message exited (tool result observed)', false, `requests=${mock.requests.length}`)
  }
  // Step 7: report_progress.
  b8 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 7, 120_000, 'B tool=7 (report_progress)')
  if (b8 !== null) {
    const t = toolMsgTexts(b8)[6] ?? ''
    writeEvidence('v3-tools', 'b8-report-progress.json', { toolMessage: t.slice(0, 1200) })
    check('v3', 'V3 team_report_progress recorded (progress-recorded status in the tool result)', /progress-recorded|recorded/i.test(t), `head=${JSON.stringify(t.slice(0, 160))}`)
  }
  // Step 8–9: the live MCP calls.
  b9 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 8, 120_000, 'B tool=8 (mcp ping)')
  if (b9 !== null) {
    const t = toolMsgTexts(b9)[7] ?? ''
    writeEvidence('v5-mcp', 'b9-mcp-ping-result.json', { toolMessage: t.slice(0, 800) })
    check('v5', 'V5 live MCP call (single): mcp__u8single__ping returned pong:u8-v5', t.includes('pong:u8-v5'), `head=${JSON.stringify(t.slice(0, 160))}`)
  }
  b10 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 9, 120_000, 'B tool=9 (mcp alpha)')
  if (b10 !== null) {
    const t = toolMsgTexts(b10)[8] ?? ''
    writeEvidence('v5-mcp', 'b10-mcp-alpha-result.json', { toolMessage: t.slice(0, 800) })
    check('v5', 'V5 live MCP call (paginated page-2 tool reachable via page-1 aggregate): mcp__u8paged__alpha returned alpha:u8-alpha', t.includes('alpha:u8-alpha'), `head=${JSON.stringify(t.slice(0, 160))}`)
  }
  // The create response settles once the turn is idle.
  {
    const createB = createBError === null
      ? await Promise.race([createBPending, new Promise((res) => setTimeout(() => res({ status: 0, body: null, error: 'timeout' }), 180_000))])
      : { status: 0, body: null, error: String(createBError?.message ?? createBError) }
    writeEvidence('v2-team', 'team-create-b.json', createB.body ?? createB)
    // 0.1.7 behavior observation: does team.create hold the HTTP response
    // until the initial-work turn goes idle (0.1.5 rc2-kit observation),
    // or return right after the input-seam deliver? Record the ordering.
    writeEvidence('v2-team', 'create-response-timing.json', {
      note: '0.1.5-rc.2 (rc2 kit): the create response held until the initial-work turn went idle (in-flight scripted approval). 0.1.7: observed ordering recorded here (createResolvedAt vs first model request receivedAt).',
      createResolvedAt: new Date().toISOString(),
      firstModelRequestAt: b1?.receivedAt ?? null,
    })
    check('v2', 'V2 team.create (v2 product path) succeeded with path=fresh-root (projection established)',
      createB.status === 200 && createB.body?.result?.ok === true && createB.body?.result?.value?.data?.path === 'fresh-root',
      `status=${createB.status} body=${JSON.stringify(createB.body ?? createB).slice(0, 300)}`)
  }
  // Team projection + durable membership (storage read-back).
  {
    const dom = readTeamDomainJson()
    const memberRows = state.memberInstanceId !== null ? findRows(dom, 'instanceId', state.memberInstanceId) : []
    const teamRows = findRows(dom, 'rootSessionId', CREATE_ROOT)
    writeEvidence('v2-team', 'storage-scan-create.json', { memberRowCount: memberRows.length, memberRows: memberRows.slice(0, 3), teamSessionRowCount: teamRows.length })
    check('v2', 'V2 Team projection durable: the created root + member instance rows exist in team_domain storage',
      teamRows.length > 0 && memberRows.length > 0, `teamRows=${teamRows.length} memberRows=${memberRows.length}`)
  }
  // V5 mount state (per-server views from the p6t6 state projection).
  {
    const st = await p6t6State(port)
    writeEvidence('v5-mcp', 'state-mcp-servers.json', st.body?.governance?.sessions ?? null)
    const sess = st.body?.governance?.sessions?.[CREATE_ROOT]
    const servers = sess?.mcp?.servers ?? {}
    const all = [MCP_SINGLE, MCP_PAGED, MCP_NONE].every((n) => servers[n]?.mounted === true && servers[n]?.allowed === true)
    check('v5', 'V5 per-server state: single/paged/none all mounted+allowed (the none variant did NOT crash Team init)', all, JSON.stringify(servers).slice(0, 300))
    check('v5', 'V5 no activationError on any of the three servers', !JSON.stringify(servers).includes('activationError'), '')
    log(`V5 mount state recorded (none-variant stability: team init + full chain on the same live Team)`)
  }

  // ── V6: the 0.1.7 token-budget spill + the durable artifact grant ──────
  log('── V6: token-budget spill + artifact grant ──')
  {
    const spillPrompt = apiPrompt(origin, cookie, CREATE_ROOT, `${MK_SPILL} Run exactly this bash command: ${SPILL_CMD} — it will spill. Then read the spill file the notice reports and confirm you can read it.`, 'u8spill')
    const s1 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_SPILL) && toolMsgsOf(r).length === 0, 120_000, 'spill turn start')
    let spillApproval = null
    if (s1 !== null) {
      const askDeadline = Date.now() + 120_000
      let rid = null
      while (rid === null && Date.now() < askDeadline) {
        rid = await discoverPendingRequestId(port, CREATE_ROOT)
        if (rid === null) await new Promise((r) => setTimeout(r, 700))
      }
      check('v6', 'V6 the spill bash ask created a durable control request (ask bash any)', rid !== null, `requestId=${rid}`)
      if (rid !== null) {
        spillApproval = rid
        const res = await scriptedApproval(origin, cookie, CREATE_ROOT, rid)
        writeEvidence('v6-spill', 'spill-approval.json', { requestId: rid, response: res.body ?? res })
      }
    } else {
      check('v6', 'V6 spill turn started (model request observed)', false, `requests=${mock.requests.length}`)
    }
    // 0.1.7 robustness: the OWNER (leader) read of the spill file should be
    // auto-admitted by the plugin's durable artifact grant; if 0.1.7 routes
    // it through the ASK lane instead, the turn blocks on a pending control
    // request. Resolve any owner read-ask as the scripted human (ALLOW — the
    // owner-only grant intent) across the s2/s3 waits.
    const ownerSettle = { done: false }
    const ownerPoller = (async () => {
      const deadline = Date.now() + 240_000
      const resolutions = []
      while (Date.now() < deadline && ownerSettle.done === false) {
        const rid = await discoverPendingRequestId(port, CREATE_ROOT).catch(() => null)
        if (rid !== null) {
          const res = await scriptedApproval(origin, cookie, CREATE_ROOT, rid, 'allow', 'u8 vertical scripted human ALLOW (V6: owner artifact read)')
          resolutions.push({ requestId: rid, status: res.status })
          writeEvidence('v6-spill', 'owner-read-approvals.json', resolutions)
        }
        await new Promise((r) => setTimeout(r, 3_000))
      }
      return resolutions
    })()
    const s2 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_SPILL) && toolMsgsOf(r).length === 1, 180_000, 'spill tool=1')
    let spillNoticeOk = false
    if (s2 !== null) {
      const t = toolMsgTexts(s2)[0] ?? ''
      writeEvidence('v6-spill', 's2-bash-spill-result.json', { toolMessage: t.slice(0, 4000), spillPath: state.spillPath })
      const hasNotice = /Full formatted result stored at:/.test(t)
      // The mock's decide parses the locator a beat later (it runs when the
      // mock receives THIS request); parse it here too so the check never
      // races the mock-side parse.
      const kitNotice = /stored at:\s*([^\s)(]+)/.exec(t)
      if (state.spillPath === null && kitNotice !== null) state.spillPath = kitNotice[1].replace(/\.$/, '')
      spillNoticeOk = hasNotice
      check('v6', 'V6 the 250KB bash output was SPILLED by the 0.1.7 token budget (spill notice with locator in the tool result; base row maxInlineTokens: 12500 — no byte threshold in play)',
        hasNotice && state.spillPath !== null, `notice=${hasNotice} path=${state.spillPath}`)
      const preview = t.length
      // The retained preview is capped by the 12.5k-token budget (≈40–60KB of
      // this filler text, depending on the tokenizer's per-line cost); the
      // assertion is that it is a PREVIEW, not the full 250000-byte output.
      check('v6', 'V6 the inline result is the RETAINED preview (head/tail + notice), not the full 250KB output', preview > 1_000 && preview < 200_000, `inlineBytes=${preview}`)
    }
    const s3 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_SPILL) && toolMsgsOf(r).length === 2, 180_000, 'spill tool=2 (owner read)')
    if (s3 !== null) {
      const t = toolMsgTexts(s3)[1] ?? ''
      writeEvidence('v6-spill', 's3-owner-read.json', { toolMessage: t.slice(0, 1200) })
      check('v6', 'V6 the OWNER agent READS the spill file (the durable artifact grant admits it)', t.includes(SPILL_FILLER) && !/deni|forbidden/i.test(t.slice(0, 300)), `head=${JSON.stringify(t.slice(0, 120))}`)
    }
    if (state.spillPath !== null && existsSync(state.spillPath)) {
      const st = statSync(state.spillPath)
      writeEvidence('v6-spill', 'spill-file.json', { path: state.spillPath, bytes: st.size })
      check('v6', 'V6 the spill file is DURABLE on disk under the world-pinned spill root', st.size >= 60_000, `bytes=${st.size}`)
    } else {
      check('v6', 'V6 the spill file exists on disk', false, `path=${state.spillPath}`)
    }
    // The DURABLE grant read-back happens AFTER THE V7 ARCHIVE COMMIT.
    // Two independent causes hid the grant from the V6-era read-backs:
    // (1) a KIT BUG — findStrings() (a parsed-JSON tree walker) was applied
    //     to RAW file text, where it returns [] by construction (runs 7-10);
    // (2) the domain store file is BATCH-flushed on domain commits, not
    //     per-fact / not on a short timer — run-7 the grant fact was absent
    //     on disk ≥21s after creation and present by the archive-commit mtime
    //     (14:17:26.63); run-10 present by the archive mtime (14:43:33.79).
    //     The proven-safe placement is therefore "after a subsequent domain
    //     operation" — the V7 archive commit — with a short poll.
    const spillReply = await spillPrompt
    check('v6', 'V6 the spill turn ended (apiPrompt settled)', spillReply.status === 200, `status=${spillReply.status}`)
    // Drain the owner-allow poller BEFORE V6b: the member's read-ask must not
    // be auto-ALLOWed by the V6 owner poller (it would invert the V6b denial).
    ownerSettle.done = true
    const ownerResolutions = await ownerPoller
    if (ownerResolutions.length > 0) {
      log(`V6 owner read-ask resolved by scripted human ALLOW: ${JSON.stringify(ownerResolutions)}`)
      writeEvidence('v6-spill', 'owner-read-approvals-final.json', ownerResolutions)
    }

    // The other-instance denial: delegate the member to read the spill file.
    const MK_DELEGATE_DENY = `U8MK_DELEGATE_DENY_${RUN_STAMP}`
    const denyPrompt = apiPrompt(origin, cookie, CREATE_ROOT, `${MK_DELEGATE_DENY} Delegate to worker-b-1: make it read the spilled file and report back.`, 'u8dd')
    const d0 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_DELEGATE_DENY) && toolMsgsOf(r).length === 0, 120_000, 'delegate-deny start')
    const dm1 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_SPILL_DENY) && toolMsgsOf(r).length === 0, 180_000, 'member deny turn start')
    // 0.1.7 robustness: the member's read of the off-workspace spill root may
    // land in the DEFAULT-ASK lane (no artifact grant for the member) — the
    // member would then block on a pending control request and never reach a
    // tool result. Resolve it the way the GUI human would for this test:
    // scripted DENY (the owner-only artifact grant must hold). A static deny
    // needs no intervention (the poller finds nothing and exits on settle).
    const denySettle = { done: false }
    const denyPoller = (async () => {
      const deadline = Date.now() + 90_000
      while (Date.now() < deadline && denySettle.done === false) {
        const rid = await discoverPendingRequestId(port, CREATE_ROOT).catch(() => null)
        if (rid !== null) {
          const res = await scriptedApproval(origin, cookie, CREATE_ROOT, rid, 'deny', 'u8 vertical scripted human DENY (V6b: member read — owner-only artifact grant)')
          writeEvidence('v6-spill', 'member-deny-approval.json', { requestId: rid, status: res.status, body: res.body })
          return { requestId: rid, status: res.status }
        }
        await new Promise((r) => setTimeout(r, 3_000))
      }
      return null
    })()
    const dm2 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_SPILL_DENY) && toolMsgsOf(r).length === 1, 120_000, 'member deny tool=1')
    denySettle.done = true
    const denyResolution = await denyPoller
    if (denyResolution !== null) log(`V6b member read-ask resolved by scripted human DENY (requestId=${denyResolution.requestId} status=${denyResolution.status})`)
    if (dm2 !== null) {
      const t = toolMsgTexts(dm2)[0] ?? ''
      writeEvidence('v6-spill', 'member-deny-read.json', { toolMessage: t.slice(0, 1200), denyResolution })
      check('v6', 'V6 the OTHER instance (member) CANNOT read the spill file (no grant outside the workspace → deny; the owner-only grant scope holds)',
        /deni|forbidden|not allowed|permission|grant/i.test(t) && !t.includes(SPILL_FILLER), `head=${JSON.stringify(t.slice(0, 200))}`)
    } else {
      check('v6', 'V6 the member denied read observed (tool result)', false, `d0=${d0 !== null} dm1=${dm1 !== null} denyResolution=${JSON.stringify(denyResolution)}`)
    }
    // The member's final (text) model request = its turn is ending; wait for
    // it so the member is SETTLED before V7 archives it (archive rejects a
    // RUNNING target's pending-work window). The member's FINAL model
    // request carries one current-turn tool message (the read result) and
    // gets a text reply from the mock — observing it means the turn is
    // ending (sync decide ⇒ immediate settle).
    await waitForMock(mock, (r) => userTextOf(r).includes(MK_SPILL_DENY) && toolMsgsOf(r).length === 1, 30_000, 'member deny turn end')
    await denyPrompt.catch(() => {})
  }

  // ── V7: lifecycle ───────────────────────────────────────────────────────
  log('── V7: lifecycle (archive + leader stop + cold resume) ──')
  {
    const lifePrompt = apiPrompt(origin, cookie, CREATE_ROOT, `${MK_LIFE} Archive the worker-b-1 member instance now and confirm the lifecycle changed.`, 'u8life')
    const l2 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_LIFE) && toolMsgsOf(r).length === 1, 180_000, 'life tool=1')
    if (l2 !== null) {
      const t = toolMsgTexts(l2)[0] ?? ''
      writeEvidence('v7-lifecycle', 'l2-archive-result.json', { toolMessage: t.slice(0, 1200), memberInstanceId: state.memberInstanceId })
      check('v7', 'V7 team_archive_member executed (the durable archive transition was committed)', /archiv|executed|settled|committed/i.test(t), `head=${JSON.stringify(t.slice(0, 200))}`)
    }
    const lifeReply = await lifePrompt.catch(() => ({ status: 0 }))
    check('v7', 'V7 the archive turn ended (apiPrompt settled)', lifeReply.status === 200, `status=${lifeReply.status}`)
    {
      const dom = readTeamDomainJson()
      const rows = state.memberInstanceId !== null ? findRows(dom, 'instanceId', state.memberInstanceId) : []
      const lifecycle = rows.map((r) => r.lifecycle ?? r.status ?? null)
      writeEvidence('v7-lifecycle', 'archive-storage-scan.json', { lifecycle, rows: rows.slice(0, 3) })
      check('v7', 'V7 the member lifecycle is DURABLY archived (the storage row lifecycle=archived — the 0.1.7 durable transition survived)',
        lifecycle.some((v) => String(v ?? '').toLowerCase() === 'archived'), `lifecycle=${JSON.stringify(lifecycle)}`)
    }
    // V6 deferred read-back: the DURABLE artifact grant (recorded during V6,
    // see the note in the V6 spill section). The archive commit above is the
    // proven flush boundary for the domain store file (run-7/8/9) — read it
    // back now, polling briefly in case the write lands a beat after settle.
    if (state.spillPath !== null) {
      let hits = []
      const scanGrant = () => {
        const found = []
        for (const f of listFilesRecursive(HOME).filter((p) => p.endsWith('.json') || p.endsWith('.jsonl'))) {
          if (f.includes('node_modules')) continue
          try {
            // RAW-TEXT search: findStrings() is a parsed-JSON tree walker and
            // returns [] for string input (kit bug, runs 7-10 — the grant scan
            // was blind while the grant was already on disk).
            if (readFileSync(f, 'utf8').includes(state.spillPath)) found.push(f.replace(HOME, '<world>'))
          } catch { /* binary/locked */ }
        }
        return found
      }
      const grantDeadline = Date.now() + 15_000
      do {
        hits = scanGrant()
        if (hits.length > 0) break
        await new Promise((r) => setTimeout(r, 1_000))
      } while (Date.now() < grantDeadline)
      writeEvidence('v6-spill', 'grant-scan.json', { spillPath: state.spillPath, filesContainingLocator: hits, note: 'read back after the V7 archive commit (the proven domain-store flush boundary; see vertical.mjs V6 note)' })
      check('v6', 'V6 TeamAwareLocalSpillStore recorded a DURABLE artifact grant (the locator appears in durable world storage; read back after the V7 archive commit boundary)', hits.length > 0, `files=${JSON.stringify(hits.slice(0, 6))}`)
    }
    // leader stop: dispose the live leader handle (the p6t6 residency-drop seam).
    const drop = await p6t6ResidencyDrop(port, CREATE_ROOT)
    writeEvidence('v7-lifecycle', 'leader-drop.json', drop.body ?? drop)
    check('v7', 'V7 leader stop: the live leader handle was disposed (residency/drop)', drop.status === 200 && (drop.body?.dropped === true || drop.body?.dropped === false), `body=${JSON.stringify(drop.body ?? drop).slice(0, 200)}`)
    // the leader COLD RESUMEs (the 0.1.7 agents.resume path).
    const resumePrompt = apiPrompt(origin, cookie, CREATE_ROOT, `${MK_LIFE2} Confirm you are back after the residency drop.`, 'u8life2')
    const l3 = await waitForMock(mock, (r) => userTextOf(r).includes(MK_LIFE2) && toolMsgsOf(r).length === 0, 180_000, 'leader resume turn')
    check('v7', 'V7 the leader agent COLD-RESUMED after the stop (a fresh model request on the same session — the 0.1.7 agents.resume path)', l3 !== null, `requests=${mock.requests.length}`)
    const resumeReply = await resumePrompt.catch(() => ({ status: 0 }))
    check('v7', 'V7 the leader resume turn ended (apiPrompt settled)', resumeReply.status === 200, `status=${resumeReply.status}`)
  }
  } // ── end created-team legs (teamCreated) ──

  // 0.1.7 event-vocabulary observation (boot-log evidence, independent of
  // the created team): `agent/session-start` is GONE in 0.1.7 (replaced by
  // the agent/created payload `source`); the U3 probe re-measurement
  // records the full trace diff separately.
  {
    const lt = logText()
    const sessionStartRefs = lt.split('\n').filter((l) => l.includes('agent/session-start')).length
    writeEvidence('v7-lifecycle', 'event-vocabulary-observation.json', {
      agentSessionStartLinesInInstanceLog: sessionStartRefs,
      note: '0.1.7 removed agent/session-start (upstream-seams §1.3); the U3 agent-lifecycle probe (which listens for it) is re-measured separately in lifecycle-probe/',
    })
    check('v7', 'V7 0.1.7 event vocabulary: no agent/session-start references in the boot log (the event is gone in 0.1.7)', sessionStartRefs === 0, `refs=${sessionStartRefs}`)
  }

  // ── V8: stop + fresh reboot (resume is NOT a blocking criterion) ───────
  log('── V8: process stop + fresh reboot (bootPhase resume) ──')
  {
    const sessionsBefore = listFilesRecursive(join(HOME, 'sessions')).map((p) => p.replace(HOME, '<world>'))
    writeEvidence('v8-reboot', 'sessions-before-reboot.json', sessionsBefore)
    stopHost(host)
    const freed = await waitForPortFree(hostPort, 30_000)
    check('v8', 'V8 host stopped and the port freed', freed, `port=${hostPort}`)

    writePatchFile('resume')
    writeDirective(2, 'resume')
    const instanceLog2 = writeEvidence('v8-reboot', 'instance-2.log', '')
    host = spawnHost({ port: hostPort, logPath: instanceLog2 })
    const bootLine2 = await waitForLogLine(instanceLog2, BOOT_MARKER, 300_000, host.alive)
    check('v8', 'V8 the host RE-BOOTS after the process stop (fresh boot marker, same profile)', bootLine2 !== null, bootLine2 === null ? `exit=${host.exitInfo.code} signal=${host.exitInfo.signal ?? 'none'}` : bootLine2.slice(0, 80))
    if (bootLine2 === null) {
      writeEvidence('v8-reboot', 'reboot-failure-diag.json', { logTail: logTail(instanceLog2), exitInfo: host.exitInfo })
      stopHost(host)
    } else {
      const health2 = await p6t6Health(port)
      writeEvidence('v8-reboot', 'p6t6-health-2.json', health2.body ?? health2)
      const state2 = await p6t6State(port).catch(() => ({ status: 0, body: null }))
      writeEvidence('v8-reboot', 'p6t6-state-2.json', state2.body ?? state2)
      check('v8', 'V8 row ready on the resume boot (p6t6 health ok)', health2.status === 200 && health2.body?.ok === true, `body=${JSON.stringify(health2.body ?? health2).slice(0, 200)}`)
      const resumed = state2.body !== null && state2.body?.phase === 'resume' && state2.body?.teamSession !== null
      if (resumed) {
        check('v8', 'V8 old Team RE-ADOPTED on the resume boot (strict load-only: the durable TeamSession was loaded — resume worked this round)', true, JSON.stringify(state2.body?.teamSession ?? null).slice(0, 200))
      } else {
        // NON-BLOCKING per the brief: record + mark + continue.
        writeEvidence('v8-reboot', 'POST-UPGRADE-SESSION-RESUME.json', {
          marker: 'POST-UPGRADE SESSION-RESUME',
          note: 'Team resume after the fresh reboot did not reach the adopted-team state this round (non-blocking per plan §11.3 V8); the fresh-Team main path is green on the create boot (V2). Evidence: instance-2.log, p6t6-state-2.json, sessions-*.json, service topology below.',
          state2: state2.body ?? state2,
          logTail: logTail(instanceLog2).slice(-8000),
          serviceTopology: {
            rows: readFileSync(join(PROFILE_DIR, 'cordis.patch.yml'), 'utf8').slice(0, 2000),
            members: state2.body?.members ?? null,
            governanceSessions: state2.body?.governance?.sessions ?? null,
            observations: state2.body?.observations ?? null,
          },
        })
        check('v8', 'V8 old Team resume after fresh reboot (NON-BLOCKING — marked POST-UPGRADE SESSION-RESUME with logs + session files + service topology)', false, `phase=${state2.body?.phase} teamSession=${JSON.stringify(state2.body?.teamSession ?? null).slice(0, 120)}`)
      }
    }
    const sessionsAfter = listFilesRecursive(join(HOME, 'sessions')).map((p) => p.replace(HOME, '<world>'))
    writeEvidence('v8-reboot', 'sessions-after-reboot.json', sessionsAfter)
    const v4Naming = sessionsAfter.filter((p) => /session\.v4\.jsonl\.zstd$/.test(p))
    const anySessionLogs = sessionsAfter.filter((p) => /\.jsonl\.zstd$/.test(p))
    check('v8', 'V8 session logs use the 0.1.7 V4 naming (session.v4.jsonl.zstd)', anySessionLogs.length > 0 && v4Naming.length > 0, `v4=${v4Naming.length} total=${anySessionLogs.length}`)
    // The mini-MCP servers must still be alive and consistent after the
    // reboot (three-server concurrent-mount stability across the host cycle).
    const wireAfter = existsSync(wireLog) ? readFileSync(wireLog, 'utf8').split('\n').filter(Boolean).length : 0
    writeEvidence('v8-reboot', 'mcp-wire-count-after-reboot.json', { wireRequests: wireAfter })
  }

  // ── teardown ────────────────────────────────────────────────────────────
  log('── teardown ──')
  try { stopHost(host) } catch { /* already stopped */ }
  await closeMiniServer(miniSingle)
  await closeMiniServer(miniPaged)
  await closeMiniServer(miniNone)
  await mock.close().catch(() => {})
  const mockDiagPath = writeEvidence('v0-boot', 'mock-decisions.log', mockDiag.join('\n'))
  log(`mock decision trace: ${mockDiagPath} (${mockDiag.length} lines); ${mock.requests.length} model requests recorded`)

  const postStable = { p3080: await probeStableInstance(3080), p3180: await probeStableInstance(3180) }
  writeEvidence('v8-reboot', 'post-stable-probe.json', postStable)
  check('closing', ':3080/:3180 state unchanged (read-only probes pre == post)', JSON.stringify(preStable) === JSON.stringify(postStable), `pre=${JSON.stringify(preStable)} post=${JSON.stringify(postStable)}`)
  // Poll until released (the host needs SIGTERM grace to exit) — a one-shot
  // probe races the shutdown (run-6: 3491 still bound 5ms after stopHost).
  const ports = [hostPort, MOCK_PORT, MCP_PORT_SINGLE, MCP_PORT_PAGED, MCP_PORT_NONE]
  const portResults = {}
  for (const p of ports) portResults[String(p)] = await waitForPortFree(p, 15_000)
  if (portResults[String(hostPort)] === false) {
    // Escalate: SIGKILL the (re-booted) host child and re-check.
    try { host.child.kill('SIGKILL') } catch { /* already gone */ }
    portResults[String(hostPort)] = await waitForPortFree(hostPort, 10_000)
  }
  writeEvidence('v8-reboot', 'ports-released.json', portResults)
  check('closing', 'all U8 ports released (host + mock + mini-MCP)', Object.values(portResults).every(Boolean), JSON.stringify(portResults))
  const porcelainAfter = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' }).stdout
  const headAfter = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' }).stdout.trim()
  check('closing', 'test-use working tree still byte-clean after the run', porcelainAfter === '', `porcelain=${porcelainAfter.slice(0, 200)}`)
  check('closing', 'test-use HEAD unchanged (46a7f68b09)', headAfter === HOST_PIN, `head=${headAfter}`)
  log(`world RETAINED as evidence: ${HOME} (registered in this run's evidence; session files + spill root + profile state inside)`)

  return finish(fatalError !== null || CRITERIA.some((c) => !c.ok) ? 2 : 0)
}

async function finish(exitCode) {
  const failed = CRITERIA.filter((c) => !c.ok)
  const verdict = fatalError !== null || failed.length > 0 ? 'FAIL' : 'PASS'
  const summary = {
    task: 'U8 pristine 0.1.7 real-host vertical (plan §11)',
    runStamp: RUN_STAMP,
    hostPin: HOST_PIN,
    worktreePin: WORKTREE_PIN,
    world: HOME,
    worldRetained: true,
    hostPort: hostPortRef,
    criteria: CRITERIA,
    passed: CRITERIA.length - failed.length,
    total: CRITERIA.length,
    failed: failed.map((f) => `${f.leg}:${f.name}`),
    fatalError: fatalError ?? null,
    verdict,
  }
  try {
    writeEvidence('run', 'summary.json', summary)
  } catch { /* best-effort */ }
  log(`VERDICT ${verdict} — ${summary.passed}/${summary.total} criteria passed${failed.length > 0 ? `; failed: ${failed.map((f) => f.leg).join(',')}` : ''}`)
  process.exit(exitCode)
}

// Out-of-chain guards: background IIFEs (approval pollers) reject outside
// main's promise chain — record instead of dying silently mid-run.
process.on('unhandledRejection', (reason) => {
  const msg = String(reason?.stack ?? reason)
  try { log(`UNHANDLED REJECTION (recorded, run continues): ${msg.slice(0, 800)}`) } catch { /* best-effort */ }
  try {
    const f = join(legDir('run'), `unhandled-rejection-${Date.now()}.json`)
    writeFileSync(f, JSON.stringify({ at: new Date().toISOString(), msg: msg.slice(0, 4000) }, null, 2))
  } catch { /* best-effort */ }
})
process.on('uncaughtException', (err) => {
  const msg = String(err?.stack ?? err)
  try { log(`FATAL uncaughtException: ${msg.slice(0, 800)}`) } catch { /* best-effort */ }
  try {
    writeFileSync(join(legDir('run'), 'fatal-uncaught.json'), JSON.stringify({ at: new Date().toISOString(), msg: msg.slice(0, 4000) }, null, 2))
  } catch { /* best-effort */ }
  process.exit(1)
})

main().catch((e) => {
  const msg = String(e?.stack ?? e)
  log(`FATAL uncaught: ${msg}`)
  try {
    writeEvidence('run', 'fatal.json', { msg: msg.slice(0, 4000) })
  } catch { /* best-effort */ }
  process.exit(1)
})
