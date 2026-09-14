#!/usr/bin/env node
/**
 * a2x-real-host-smoke.mjs — fix/alpha2-explicit-agent-setup-compat: the
 * DSH 0.1.5-rc.2 REAL-HOST live smoke (plan §8).
 *
 * Purpose
 *   Verify the production plugin glue under the REAL DSH 0.1.5-rc.2
 *   distribution (the published npm `@deepseek-ai/dsh@0.1.5-rc.2` — the
 *   user's host), where the AgentSetup contract is the explicit two-arg
 *   form `setup(agentCtx, agent)` (verified in the npm dist:
 *   `dsh-agent-loop/lib/index.js: setup?.(prepared.agent.ctx,
 *   prepared.agent)`) and the `agentCtx.agent` reverse association no
 *   longer exists. The plugin's own node_modules resolve a DIFFERENT
 *   @deepseek-ai/dsh-scope module instance (0.1.2-rc.1) than the host's
 *   bundled one (0.1.5-rc.2) — the tag is a module-private Symbol, so
 *   `scopeOf(agentCtx)` is undefined across instances: the exact
 *   `alpha2-permission-coverage-surface-unavailable` production blocker
 *   on a fresh-root `team.create` whose Leader template declares
 *   `capabilities.permissions`.
 *
 * Legs (one fresh DSH_HOME world each; same 3180-family host port; the
 * mock model is shared on 3496 and reaches the host only through
 * DEEPSEEK_BASE_URL / DEEPSEEK_API_KEY):
 *   1. DISCOVERY (fixed glue) — boot a LEGACY team (no capabilities =>
 *      the gate is absent, exactly the user's production boot shape),
 *      drive one leader turn, and capture the leader's FINAL model-facing
 *      tool surface from the mock request. The surface drives the
 *      created-team blueprint: `builtinToolDeny` = surface − managed
 *      vocabulary − SAFE_UNMANAGED − team-tool catalog (a coverage-
 *      complete alpha.2 policy — every non-managed tool is removed at the
 *      capability layer before the Coverage Gate classifies).
 *   2. RED (PRE-FIX glue — `git show df9230d:...agent-bindings.mjs`,
 *      materialized in a symlink farm so its relative + bare imports
 *      resolve exactly as the dist copy's) — boot the same legacy team
 *      (starts fine: legacy path, no gate), then the remote
 *      `team.create` with the Leader-permissions blueprint from the row's
 *      saved `blueprintDir` MUST fail with the user's exact production
 *      error: `TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED` wrapping
 *      `alpha2-permission-coverage-surface-unavailable` (the pre-fix
 *      resolver has no explicit agent, `agentCtx.agent` is gone in
 *      0.1.5, and the scope tag is cross-instance unreadable).
 *   3. GREEN (FIXED dist glue) — the SAME row world + the SAME remote
 *      `team.create` MUST succeed (`path: 'fresh-root'`), the created
 *      Leader's initial work must drive a real model turn through the
 *      mock (its model-facing surface proves the gate passed and the
 *      capability layer applied), and — when the allow-lane managed
 *      tool (`read`, on the `a2x-a5` preset surface; see A5_TOOL) is on
 *      that surface — one permission-gated tool call proves the A5
 *      enforcement listener + the lazy cwd basis run on the real host
 *      with a durable ALLOW decision (an `alpha2-perm:` observation row
 *      must land).
 *
 * World layout (TEST_METHODS: homes under the worktree's tests/homes,
 * 3180 family only, :3080 READ-ONLY probe before/after):
 *   home   <worktree>/tests/homes/a2x-smoke-<stamp>-{disc,red,green}
 *   patch  <home>/profiles/web/cordis.patch.yml — production row + p6t6
 *          observability row, mounted ONLY through the public
 *          profile-patch seam
 *   preset <home>/.agent-presets/a2x-a5/agent.cordis.yml — kit-authored
 *          USER preset (persona + dsh-tool-fs ONLY, no delegation group),
 *          mounted through the public $DSH_HOME/.agent-presets seam
 *          (rootPresetId/memberPresetId = 'a2x-a5'). SMOKE SCOPE
 *          DECISION (see followup-backlog.md item 2): every shipped
 *          non-minimal 0.1.5 preset's spawn `subagent` tool is a
 *          deferred PER-AGENT (own-layer) registration, structurally
 *          un-denyable via tools.restrict() while the Coverage Gate
 *          classifies it KNOWN_SENSITIVE — such presets make strict
 *          agents un-creatable on 0.1.5-rc.2. `minimal` avoids the
 *          collision but its only managed tool is `bash`, which the
 *          alpha.2 policy forbids in the allow lane — the plan §9
 *          A5 allow-lane proof is impossible there. `a2x-a5` puts
 *          `read` on the created surface with no subagent anywhere.
 *   blueprints <worktree>/.a2x-smoke-blueprints/ (gitignored scratch; the
 *          saved catalog the row's `blueprintDir` points at)
 *   prefix   <worktree>/.a2x-prefix/ (gitignored scratch; the pre-fix
 *          glue symlink farm)
 *   evidence <this kit's dir>/runs/<stamp>/
 *
 * Usage
 *   node a2x-real-host-smoke.mjs [--host-port <n>] [--keep]
 *     --host-port  fixed host port (3180..3186). Default: first FREE of
 *                  3180..3186 (3180 is often the operator's own GUI).
 *     --keep       keep the three temporary DSH_HOME worlds (registered
 *                  in summary.json instead of deleted; TEST_METHODS §7).
 *
 * Exit codes
 *   0 = all three legs behaved as expected (GREEN)
 *   2 = a leg ran end-to-end but an expectation failed
 *   1 = kit-level FATAL (infra/boot); partial evidence in runs/<stamp>/
 *
 * Pattern sources (all read, none modified): dev/agent-workflow/evidence/
 * multi-mcp/d-smoke/multi-mcp-real-host-smoke.mjs (row/patch/boot/p6t6
 * shape), tests/characterization/lib/{instance,util}.mjs (boot marker +
 * port helpers), packages/tools/harness/mock-deepseek.mjs (the mock),
 * packages/runtime/src/plugin/{host.ts,s6-remote.ts,blueprint-source-
 * index.ts} (row config + team.create contract).
 */

import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ── CLI ─────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
function argValue(name) {
  const i = argv.indexOf(name)
  return i === -1 ? undefined : argv[i + 1]
}
const KEEP = argv.includes('--keep')
const HOST_PORT_ARG = argValue('--host-port')

const KIT_DIR = dirname(fileURLToPath(import.meta.url))
// dev/agent-workflow/evidence/fix-alpha2-explicit-agent-setup-compat ->
// four up = the task worktree root.
const WORKTREE = resolve(KIT_DIR, '..', '..', '..', '..')
if (
  !existsSync(join(WORKTREE, 'packages', 'runtime')) ||
  !existsSync(join(WORKTREE, '.git'))
) {
  console.error(`FATAL ${WORKTREE} is not a dsh-agent-team worktree (packages/runtime or .git missing)`)
  process.exit(1)
}

function utcStamp() {
  const d = new Date().toISOString()
  return `${d.slice(0, 4)}${d.slice(5, 7)}${d.slice(8, 10)}T${d.slice(11, 13)}-${d.slice(14, 16)}-${d.slice(17, 19)}Z`
}
const RUN_STAMP = 'a2x-smoke-' + utcStamp()
const RUN_DIR = join(KIT_DIR, 'runs', RUN_STAMP)

// ── the real 0.1.5-rc.2 host (npm install under tests/live-host-015rc2) ────

const LIVE_HOST_DIR = join(WORKTREE, 'tests', 'live-host-015rc2', 'node_modules', '@deepseek-ai', 'dsh')
// The A5 read probe target: the created leader's session workspace IS
// LIVE_HOST_DIR (the host's defaultWorkspace — verified in the preserved
// model requests: "session workspace: <LIVE_HOST_DIR>"), so a relative
// `file_path` read is resolved through the FIX's lazy cwd basis
// (runtimeAgent.session.header.cwd). The file must EXIST for the A2
// canonicalizer (a missing path argument/target is a fail-closed
// canonicalization denial), so the kit writes it before the GREEN
// team.create and removes it at teardown.
const A5_PROBE_FILE = join(LIVE_HOST_DIR, 'a2x-green-probe.txt')
const LIVE_HOST_PKG = JSON.parse(readFileSync(join(LIVE_HOST_DIR, 'package.json'), 'utf8'))
if (LIVE_HOST_PKG.version !== '0.1.5-rc.2') {
  console.error(`FATAL tests/live-host-015rc2 host version is ${LIVE_HOST_PKG.version}, expected 0.1.5-rc.2 (reinstall: npm install --no-save @deepseek-ai/dsh@0.1.5-rc.2)`)
  process.exit(1)
}
const HOST_BIN = join(LIVE_HOST_DIR, 'lib', 'bin.js')
if (!existsSync(HOST_BIN)) {
  console.error(`FATAL host bin missing: ${HOST_BIN}`)
  process.exit(1)
}

// ── target-repo row assets (the production row + fixed dist glue) ──────────

const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_NAME = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'host.js')).href
const FIXED_GLUE_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
const SEAM_URL = pathToFileURL(join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const P6T6_ROW_NAME = pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')).href

const BASELINE_SHA = 'df9230de678f987f407f3bb59492863bb8dc6530' // plan baseline (origin/master)
const PREFIX_GLUE_DIR = join(WORKTREE, '.a2x-prefix')
const BLUEPRINT_DIR = join(WORKTREE, '.a2x-smoke-blueprints')

// ── world constants ─────────────────────────────────────────────────────────

const HOST_PORT_CANDIDATES = [3180, 3181, 3182, 3183, 3184, 3185, 3186]
const MOCK_PORT = 3496
const STABLE_URL = 'http://127.0.0.1:3080/'

const ROOT = `session-a2x-root-${RUN_STAMP}`
const CREATE_ROOT = `session-a2x-created-${RUN_STAMP}`
const MK_DISC = `A2X_DISC_${RUN_STAMP}`
const MK_GREEN = `A2X_GREEN_${RUN_STAMP}`
const SAVED_BLUEPRINT_ID = 'team.a2x-perm'
const SAVED_BLUEPRINT_FILE = 'a2x-perm-team.yaml'

const HOME = {
  disc: join(WORKTREE, 'tests', 'homes', `${RUN_STAMP}-disc`),
  red: join(WORKTREE, 'tests', 'homes', `${RUN_STAMP}-red`),
  green: join(WORKTREE, 'tests', 'homes', `${RUN_STAMP}-green`),
}

// The closed coverage vocabularies (mirrored from the frozen domain/
// operation-permission sources — the kit computes the deny list against
// them; the gate itself is the product under test).
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
// The managed tool the A5 enforcement leg exercises: `read` — legal in the
// allow lane (the alpha.2 policy FORBIDS a whole-tool allow for the shell
// class bash/pwsh, so on the `minimal` preset — whose only managed tool is
// bash — the plan §9 "one allowed managed tool enters the normal
// permission pipeline" proof is impossible). The smoke therefore mounts the
// kit-authored user preset `a2x-a5` (fs tools only, no delegation group —
// see writeSmokePreset / followup-backlog.md item 2) so `read` is on the
// created surface under the allow lane.
const A5_TOOL = 'read'
// The kit-authored smoke preset (written into each world's
// DSH_HOME/.agent-presets — the public 0.1.5 user-preset seam, verified in
// the npm 0.1.5-rc.2 dist: dsh-agent-presets USER_PRESET_DIR).
const SMOKE_PRESET_ID = 'a2x-a5'
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

// ── logging / fatals ────────────────────────────────────────────────────────

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
  log(`${ok === true ? 'PASS' : 'FAIL'} ${critId}: ${name}${detail === '' || detail === undefined ? '' : ` — ${String(detail).slice(0, 400)}`}`)
  return ok === true
}

function dieFatal(msg) {
  log(`FATAL ${msg}`)
  try {
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify({ runStamp: RUN_STAMP, fatal: msg, criteria }, null, 2))
  } catch { /* best-effort */ }
  process.exit(1)
}

// ── small http helpers (multi-mcp kit shape) ────────────────────────────────

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
      rpcId: `a2x-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version: 1, params },
    }),
  }, 180_000)
}

/** One user turn on the DSH core public channel: POST /api/session/prompt. */
async function apiPrompt(origin, cookie, sessionId, text) {
  return fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `a2x-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: {
        args: {
          request: {
            requestId: `a2x-${Math.random().toString(36).slice(2, 12)}`,
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text }],
          },
        },
      },
    }),
  }, 180_000)
}

async function p6t6Tool(port, name, args, as) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args, as }),
  }, 180_000)
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

// ── the real-host boot (npm dist bin; the DshInstance pattern, host-agnostic) ─

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

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
          // The published dist carries no .git; a pinned hash skips any
          // in-build git spawn (the DshInstance pattern).
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

async function bootNpmHost({ label, port, home, glueUrl, logDir }) {
  mkdirSync(logDir, { recursive: true })
  const instanceLog = join(logDir, `instance-port${port}.log`)
  writeFileSync(instanceLog, '', { flag: 'w' })
  writePatchFile(join(home, 'profiles', 'web', 'cordis.patch.yml'), glueUrl)
  writeSmokePreset(home)
  writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
    boot: 1,
    phase: 'create',
    reportDir: RUN_DIR,
    runStamp: RUN_STAMP,
    rootSessionId: ROOT,
  }, null, 2))
  const h = spawnNpmHost({ port, home, logPath: instanceLog })
  const line = await waitForLogLine(instanceLog, BOOT_MARKER, 240_000, h.alive)
  if (line === null) {
    stopNpmHost(h, port)
    const detail = h.exitInfo.exited
      ? `process exited (code=${h.exitInfo.code} signal=${h.exitInfo.signal ?? 'none'}${h.exitInfo.message ? ` msg=${h.exitInfo.message}` : ''})`
      : `no boot marker within 240s`
    dieFatal(`${label}: host boot failed: ${detail}\n--- log tail ---\n${logTail(instanceLog)}`)
  }
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(line.replace(/.*dsh web:\s*/, ''))
  if (m === null) dieFatal(`${label}: unexpected boot url shape: ${line}`)
  const origin = `http://127.0.0.1:${m[1]}`
  const cookie = await authenticate(origin, m[2]).catch((e) => dieFatal(`${label}: auth failed: ${e.message}`))
  // Row health gate (a latched setupError must fail fast, not hang).
  const deadline = Date.now() + 240_000
  let health = null
  for (;;) {
    const hb = await p6t6Health(Number(m[1]))
    health = { status: hb.status, body: hb.body }
    if (hb.status === 200 && hb.body?.ok === true) break
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      stopNpmHost(h, port)
      dieFatal(`${label}: row setup failed — setupError: ${String(hb.body.setupError).slice(0, 600)}\n--- log tail ---\n${logTail(instanceLog)}`)
    }
    if (Date.now() >= deadline) {
      stopNpmHost(h, port)
      dieFatal(`${label}: row health not ready in 240s — health=${JSON.stringify(hb.body).slice(0, 400)}\n--- log tail ---\n${logTail(instanceLog)}`)
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  // Row state must be well-formed for the boot root + phase.
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
      stopNpmHost(h, port)
      dieFatal(`${label}: row state not well-formed in 90s; last: status=${s.status} body=${JSON.stringify(s.body).slice(0, 400)}`)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  log(`${label}: booted (host 0.1.5-rc.2) at ${origin}; row ready — toolCount=${health.body?.toolCount} liveSessions=${JSON.stringify(health.body?.liveSessions ?? [])}`)
  return {
    label,
    host: h,
    port: Number(m[1]),
    origin,
    cookie,
    instanceLog,
    health,
    stateBody: state.body,
  }
}

function stopNpmHost(h, port) {
  try {
    h.child.kill()
  } catch { /* already gone */ }
  return h
}

async function dumpNpmConfig(home, destPath) {
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

// ── row config + profile patch (multi-mcp kit shape) ────────────────────────

function teamRowConfig(glueUrl) {
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: BOOT_BLUEPRINT,
    // The saved-source catalog the remote team.create resolves from.
    blueprintDir: BLUEPRINT_DIR,
    // 0.1.5 host preset choice (SMOKE SCOPE DECISION, recorded in
    // followup-backlog.md): the kit-authored USER preset `a2x-a5`
    // (writeSmokePreset — persona + dsh-tool-fs, mounted through the
    // public $DSH_HOME/.agent-presets seam). Reason: on 0.1.5 every
    // shipped non-minimal preset mounts the spawn `subagent` tool as a
    // DEFERRED PER-AGENT install (modelSelectionSettings —
    // `dsh-tool-subagent` registers it into the agent's OWN tool layer
    // after `agent/created`), where (a) `tools.restrict()` cannot reach
    // it (restrictableNames excludes the own layer) and (b) the
    // Coverage Gate classifies it KNOWN_SENSITIVE — a delegation-group
    // preset therefore makes strict (capabilities.permissions) team
    // agents un-creatable on 0.1.5-rc.2 (standard preset proven live:
    // restrict threw `unknown global tool "subagent"` in
    // runs/a2x-smoke-20260914T07-34-10Z). The shipped `minimal` preset
    // avoids the collision but its only managed tool is `bash`, which
    // the alpha.2 policy forbids in the allow lane (A2C-1: no positive
    // whole-tool permission for the shell class) — the plan §9 "allowed
    // managed tool enters the permission pipeline" proof is impossible
    // there. `a2x-a5` is fs-only: `read` (the allow-lane tool) is on the
    // created surface, no subagent anywhere. The AgentSetup identity /
    // permission pipeline under test is preset-agnostic.
    rootPresetId: SMOKE_PRESET_ID,
    memberPresetId: SMOKE_PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a2x-smoke-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl,
    seamUrl: SEAM_URL,
  }
}

// The BOOT team blueprint: a plain LEGACY leader (NO capabilities — the
// gate is absent on this path, byte-for-byte the 0.1.0-rc.1 behavior; this
// is the shape the user's production host boots with).
const BOOT_BLUEPRINT = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.a2x-boot',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the a2x smoke boot team."',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

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

function writePatchFile(patchPath, glueUrl) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const lines = [
    `# a2x real-host smoke patch layer (run ${RUN_STAMP}): production dsh-agent-team row (worktree dist) + p6t6 observability row — mounted ONLY through the public profile-patch seam.`,
    `# glueUrl: ${glueUrl}`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig(glueUrl) }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

/**
 * The smoke's A5 preset: a kit-authored USER preset written into the
 * world's DSH_HOME via the public 0.1.5 user-preset seam
 * (`$DSH_HOME/.agent-presets/<id>/agent.cordis.yml` — dsh-agent-presets
 * `USER_PRESET_DIR`, scanned on every roster read in the npm 0.1.5-rc.2
 * dist). It mounts ONLY the persona + `dsh-tool-fs` (read / read_image /
 * write / edit) — deliberately NO delegation group: on 0.1.5 every shipped
 * non-minimal preset's spawn `subagent` row (`modelSelectionSettings:
 * true`) installs into the agent's OWN tool layer via a deferred
 * per-agent fiber, where `tools.restrict()` cannot reach it (own-layer
 * names are not restrictable) while the Coverage Gate classifies it
 * KNOWN_SENSITIVE — so on 0.1.5-rc.2 a strict
 * (capabilities.permissions) agent under any shipped preset with a
 * delegation group either dies at restrict (if the deny list names it) or
 * at the gate (if not). fs-only sidesteps the collision and puts `read`
 * (the A5 allow-lane tool — the alpha.2 policy forbids whole-tool allow
 * for the shell class) on the created surface. See
 * followup-backlog.md item 2.
 */
function writeSmokePreset(home) {
  const dir = join(home, '.agent-presets', SMOKE_PRESET_ID)
  mkdirSync(dir, { recursive: true })
  const text = [
    `# ${SMOKE_PRESET_ID} — a2x real-host smoke preset (run ${RUN_STAMP}). Kit-authored`,
    '# via the public user-preset seam (DSH_HOME/.agent-presets); NOT shipped by',
    '# the host. Managed fs tools only — no delegation group (the 0.1.5 spawn',
    '# `subagent` row is a deferred per-agent own-layer install, structurally',
    '# un-denyable via tools.restrict() and KNOWN_SENSITIVE under the',
    '# Coverage Gate — a delegation-group preset makes strict team agents',
    '# un-creatable on 0.1.5-rc.2; followup-backlog.md item 2).',
    '- id: persona',
    "  name: '@deepseek-ai/dsh-persona'",
    '  config:',
    '    suffix: Your working directory is {{cwd}}.',
    '    prefix: >-',
    '      You are a coding agent powered by the {{model}} model.',
    '- id: tool-fs',
    "  name: '@deepseek-ai/dsh-tool-fs'",
    '',
  ].join('\n')
  writeFileSync(join(dir, 'agent.cordis.yml'), text)
}

// ── the pre-fix glue symlink farm (RED leg) ─────────────────────────────────

/**
 * Materialize `<worktree>/.a2x-prefix/dist` as a symlink farm over the
 * real dist tree with EXACTLY ONE override file: the pre-fix
 * agent-bindings.mjs (git show BASELINE_SHA). Every other entry is a
 * symlink to the real file/dir, so the override's relative imports
 * resolve to the SAME real modules the fixed glue uses (realpath-identical
 * module identity), and its bare specifiers resolve through the
 * `node_modules` symlink (worktree packages/runtime/node_modules — the
 * 0.1.2-rc.1 @deepseek-ai/* instances, i.e. the cross-instance scope
 * situation of the user's production host).
 * @returns {string} the file URL of the pre-fix glue.
 */
function buildPrefixGlueFarm() {
  rmSync(PREFIX_GLUE_DIR, { recursive: true, force: true })
  const realDist = join(WORKTREE, 'packages', 'runtime', 'dist')
  const overrideRel = ['packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs']
  const git = spawnSync('git', ['show', `${BASELINE_SHA}:packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs`], {
    cwd: WORKTREE,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  if (git.status !== 0 || typeof git.stdout !== 'string' || git.stdout.length === 0) {
    dieFatal(`git show ${BASELINE_SHA} pre-fix glue failed: ${git.stderr?.slice(0, 300)}`)
  }
  const preFixText = git.stdout
  if (!preFixText.includes('coverageSurfaceNames(agentCtx, sessionId)')) {
    dieFatal('sanity: extracted pre-fix glue does not carry the single-arg coverageSurfaceNames — baseline moved?')
  }
  const farmDist = join(PREFIX_GLUE_DIR, 'dist')

  function materialize(realDir, farmDir, remaining) {
    mkdirSync(farmDir, { recursive: true })
    for (const entry of readdirSync(realDir, { withFileTypes: true })) {
      const realPath = join(realDir, entry.name)
      const farmPath = join(farmDir, entry.name)
      const passesOverride = remaining.length > 0 && (
        (remaining.length === 1 && remaining[0] === entry.name)
        || (entry.isDirectory() && remaining[0] === entry.name)
      )
      if (!passesOverride) {
        symlinkSync(realPath, farmPath, entry.isDirectory() ? 'dir' : 'file')
        continue
      }
      if (remaining.length === 1) {
        // The override file itself — write the pre-fix content.
        writeFileSync(farmPath, preFixText)
        continue
      }
      if (entry.isDirectory()) {
        materialize(realPath, farmPath, remaining.slice(1))
        continue
      }
      // The override path descends into a FILE — malformed layout.
      dieFatal(`pre-fix farm: override path crosses a file at ${realPath}`)
    }
  }
  materialize(realDist, farmDist, overrideRel)
  // The bare-specifier resolution farm: the override's walk-up finds this
  // first (dist/packages/runtime/node_modules), symlinking to the real
  // worktree runtime node_modules (same realpath as the fixed glue's).
  const farmNm = join(farmDist, 'packages', 'runtime', 'node_modules')
  symlinkSync(join(WORKTREE, 'packages', 'runtime', 'node_modules'), farmNm, 'dir')
  const url = pathToFileURL(join(farmDist, ...overrideRel)).href
  // Sanity: the farm file is the pre-fix content and NOT the fixed file.
  if (readFileSync(join(farmDist, ...overrideRel), 'utf8') === readFileSync(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs'), 'utf8')) {
    dieFatal('pre-fix farm sanity: farm glue is byte-identical to the fixed dist glue (override not applied)')
  }
  return url
}

// ── the saved Leader-permissions blueprint (GREEN/RED create target) ────────

/**
 * The created-team blueprint: a Leader that declares the FULL alpha.1
 * capability set + alpha.2 `capabilities.permissions` (the shape that
 * triggers the strict Coverage Gate). `builtinToolDeny` (a CAPABILITIES-level
 * sibling of `teamTools` per the domain validator — packages/domain/blueprint
 * validate.ts, NOT a field of the teamTools allow entry) carries the
 * discovery-computed unmanaged names so the gate classifies a fully covered
 * surface on the real host.
 */
function savedBlueprintYaml(denyList) {
  const denyLines = denyList.length === 0
    ? ['    builtinToolDeny: []']
    : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${SAVED_BLUEPRINT_ID}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "You are the leader of the a2x permissions team."',
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    '        - team_send_message',
    '        - team_list_members',
    ...denyLines,
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    '    permissions:',
    '      default: ask',
    // Lane shape: one legal allow/ask/deny policy (plan §9). The ALLOW
    // lane carries `read` — the A5_TOOL that the `a2x-a5` preset puts on
    // the created surface (the alpha.2 policy forbids a whole-tool allow
    // for the shell class bash/pwsh, so the A5 allow-lane proof needs a
    // non-shell managed tool; see the A5_TOOL note). The mock scripts a
    // `read` call through the allow lane (the durable-allow proof);
    // `ask: write` and `deny: bash` keep the three-lane policy shape
    // legal (bash `any` is legal in ask/deny but NOT in allow — A2C-1).
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

function writeSavedBlueprint(denyList) {
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  const file = join(BLUEPRINT_DIR, SAVED_BLUEPRINT_FILE)
  writeFileSync(file, savedBlueprintYaml(denyList))
  // Evidence copy (the scratch dir is removed at teardown).
  writeFileSync(join(RUN_DIR, 'saved-blueprint.yaml'), savedBlueprintYaml(denyList))
  return file
}

// ── mock model ──────────────────────────────────────────────────────────────

let mock = null

/**
 * The decide policy:
 *   - discovery marker  -> one text ack (the turn's FIRST request carries
 *     the model-facing tool surface = the discovery evidence);
 *   - green marker, no tool result yet -> a `read` tool call (the A5
 *     permission-gated lane: allow read/any — proves the enforcement
 *     listener + lazy cwd basis run on the real host with a durable
 *     ALLOW decision, plan §9);
 *   - green marker, tool result present -> the final text;
 *   - anything else -> a text ack.
 *
 * The marker is matched against ANY user message, not just the last
 * user/tool message: the host appends a "Current runtime context" user
 * message AFTER the [team-root-work ...] envelope, so a last-message
 * heuristic misses the work prompt on the initial-work request.
 */
function makeDecide() {
  return (ctx) => {
    const body = ctx?.req ?? ctx
    const msgs = Array.isArray(body?.messages) ? body.messages : []
    const userTexts = msgs
      .filter((m) => m?.role === 'user')
      .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
    const hasGreen = userTexts.some((t) => t.includes(MK_GREEN))
    const hasDisc = userTexts.some((t) => t.includes(MK_DISC))
    const hasToolMsg = msgs.some((m) => m?.role === 'tool')
    if (hasGreen && !hasToolMsg) {
      // 0.1.5 dsh-tool-fs `read` parameter is `file_path` (the A2
      // canonicalizer rejects `path` with `file-path-missing` —
      // fail-closed by design); relative name resolves through the fix's
      // lazy cwd basis into the session workspace (A5_PROBE_FILE).
      return { kind: 'tool-call', toolCalls: [{ id: 'a2x-read-1', name: 'read', arguments: { file_path: 'a2x-green-probe.txt' } }] }
    }
    if (hasGreen && hasToolMsg) return { kind: 'text', content: `A2X_GREEN_DONE_${RUN_STAMP}` }
    if (hasDisc) return { kind: 'text', content: `A2X_DISC_ACK_${RUN_STAMP}` }
    return { kind: 'text', content: `A2X_DEFAULT_${RUN_STAMP}` }
  }
}

/** Poll the mock capture for the request whose messages contain `marker`. */
async function waitForMockRequest(marker, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const req = mock.requests.find((r) => (r.body?.messages ?? []).some((m) => typeof m.content === 'string' && m.content.includes(marker)))
    if (req !== undefined) return req
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, 500))
  }
}

/** The model-facing tool names of one captured model request. */
function surfaceOf(req) {
  if (req === undefined || req === null) return null
  return (req.body?.tools ?? [])
    .map((t) => t?.function?.name ?? t?.name)
    .filter((n) => typeof n === 'string')
    .sort()
}

// ── home helpers ────────────────────────────────────────────────────────────

function assertFreshHome(home, label) {
  if (existsSync(home)) {
    dieFatal(`${label} home already exists: ${home} (TEST_METHODS §7 — ephemeral worlds must start absent)`)
  }
  mkdirSync(home, { recursive: true })
}

function removeHome(home, label) {
  if (!existsSync(home)) return
  rmSync(home, { recursive: true, force: true })
  rmSync(`${home}.lock`, { force: true })
  log(`${label} home removed: ${home}`)
}

// ── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  log(`=== a2x real-host smoke (DSH 0.1.5-rc.2 npm dist) ${RUN_STAMP} ===`)
  log(`worktree=${WORKTREE}`)
  log(`host=${LIVE_HOST_DIR} (version ${LIVE_HOST_PKG.version})`)
  log(`baselineSha=${BASELINE_SHA} keep=${KEEP}`)

  // ── pre-flight ────────────────────────────────────────────────────────────
  const stablePre = await probeStableInstance()
  writeFileSync(join(RUN_DIR, 'port3080-pre.txt'), `# :3080 pre-flight probe (READ-ONLY; TEST_METHODS §3: never touch)\nurl: ${STABLE_URL}\nhttpStatus: ${stablePre.status}\nat: ${new Date().toISOString()}\n`)
  log(`:3080 pre: ${stablePre.status}`)

  const { portInUse, waitForPortFree } = await import(pathToFileURL(join(WORKTREE, 'tests', 'characterization', 'lib', 'util.mjs')).href)
  const { startMockModel } = await import(pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')).href)

  let hostPort = null
  if (HOST_PORT_ARG !== undefined) {
    const p = Number(HOST_PORT_ARG)
    if (!Number.isInteger(p) || p < 3180 || p > 3186) dieFatal(`--host-port must be an integer in 3180..3186 (3180 family; 3080 forbidden)`)
    hostPort = p
  } else {
    for (const p of HOST_PORT_CANDIDATES) {
      if (!(await portInUse(p))) { hostPort = p; break }
    }
    if (hostPort === null) dieFatal('no free port in the 3180..3186 family (3180 may be the operator\'s own DSH GUI)')
  }
  if (hostPort === 3080) dieFatal('port 3080 is FORBIDDEN (stable instance) — refusing')
  if (await portInUse(MOCK_PORT)) dieFatal(`mock port ${MOCK_PORT} is already in use — refusing`)
  log(`ports: host=${hostPort} mock=${MOCK_PORT}`)

  for (const [label, home] of Object.entries(HOME)) assertFreshHome(home, `leg-${label}`)
  log(`fresh homes asserted (disc/red/green)`)

  // Mock model first (the host spawns inherit DEEPSEEK_* from this env).
  mock = await startMockModel({ port: MOCK_PORT, decide: makeDecide(), log: (l) => log(`mock: ${l}`) })
  if (mock.port !== MOCK_PORT) dieFatal(`mock landed on ${mock.port}, expected ${MOCK_PORT}`)
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  process.env.DEEPSEEK_API_KEY = 'a2x-smoke-mock-key'
  log(`mock DeepSeek endpoint up at 127.0.0.1:${MOCK_PORT}`)

  let discHost = null
  let redHost = null
  let greenHost = null
  let discoverySurface = null
  let denyList = null
  let verdict = 'GREEN'

  try {
    // ── LEG 1: DISCOVERY (fixed glue, legacy boot team) ─────────────────────
    log('── leg 1: DISCOVERY (fixed glue, legacy boot) ──')
    discHost = await bootNpmHost({
      label: 'DISC',
      port: hostPort,
      home: HOME.disc,
      glueUrl: FIXED_GLUE_URL,
      logDir: join(RUN_DIR, 'instances', 'disc'),
    })
    dumpNpmConfig(HOME.disc, join(RUN_DIR, 'instances', 'disc', 'dump-config.txt'))
    const discTurn = await apiPrompt(discHost.origin, discHost.cookie, ROOT, MK_DISC)
    if (discTurn.status !== 200 || discTurn.body?.result?.ok !== true) {
      check('D1', 'discovery leader turn admitted', false, `apiPrompt status=${discTurn.status} body=${JSON.stringify(discTurn.body).slice(0, 300)}`)
      verdict = 'RED-EXPECTED-FAILED'
    } else {
      check('D1', 'discovery leader turn admitted', true, `apiPrompt status=${discTurn.status}`)
    }
    const discReq = await waitForMockRequest(MK_DISC, 120_000)
    if (discReq === null) {
      check('D2', 'discovery model request captured', false, 'no mock request carrying the discovery marker within 120s')
      verdict = 'RED-EXPECTED-FAILED'
    } else {
      discoverySurface = surfaceOf(discReq)
      writeFileSync(join(RUN_DIR, 'discovery-surface.json'), JSON.stringify({ reqSeq: discReq.seq, model: discReq.body?.model, surface: discoverySurface }, null, 2))
      check('D2', 'discovery model request captured', true, `seq=${discReq.seq} model=${discReq.body?.model} surfaceCount=${discoverySurface?.length ?? 0}`)
      log(`discovery surface (${discoverySurface.length} tools): ${discoverySurface.join(', ')}`)
    }
    if (discoverySurface !== null) {
      denyList = discoverySurface.filter(
        (n) => !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n) && !TEAM_TOOL_CATALOG.includes(n),
      )
      if (denyList.includes('run_code')) {
        // tools.restrict() REFUSES to name the reserved PTC transport — a
        // coverage-complete policy is impossible while run_code is on the
        // model-facing surface (a genuine alpha.2 coverage finding).
        check('D3', 'coverage-complete policy derivable', false, 'run_code is on the model-facing surface and cannot be denied via builtinToolDeny (reserved PTC name) — alpha.2 coverage finding; the GREEN leg cannot succeed as designed')
        verdict = 'RED-EXPECTED-FAILED'
        denyList = null
      } else {
        check('D3', 'coverage-complete policy derivable', true, `denyList(${denyList.length}): ${denyList.join(', ') || '(none)'}`)
      }
    }
    stopNpmHost(discHost.host, hostPort)
    await waitForPortFree(hostPort, 15_000)
    log('DISC host stopped')

    if (denyList === null) {
      // Cannot proceed to RED/GREEN without the saved blueprint.
      throw new Error('discovery did not yield a usable surface — aborting before RED/GREEN (evidence kept)')
    }
    const bpFile = writeSavedBlueprint(denyList)
    log(`saved blueprint written: ${bpFile}`)
    const prefixGlueUrl = buildPrefixGlueFarm()
    log(`pre-fix glue farm ready: ${prefixGlueUrl}`)

    // ── LEG 2: RED (pre-fix glue) ───────────────────────────────────────────
    log('── leg 2: RED (pre-fix glue @ baseline, team.create with Leader permissions) ──')
    redHost = await bootNpmHost({
      label: 'RED',
      port: hostPort,
      home: HOME.red,
      glueUrl: prefixGlueUrl,
      logDir: join(RUN_DIR, 'instances', 'red'),
    })
    dumpNpmConfig(HOME.red, join(RUN_DIR, 'instances', 'red', 'dump-config.txt'))
    const redRes = await remoteCall(redHost.origin, redHost.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT,
      blueprintId: SAVED_BLUEPRINT_ID,
      initialWork: { prompt: MK_GREEN },
    })
    writeFileSync(join(RUN_DIR, 'red-team-create.json'), JSON.stringify(redRes, null, 2))
    const redErr = redRes.body?.result?.error
    const redErrMsg = redErr ? `${redErr.code ?? ''} :: ${redErr.message ?? ''}` : JSON.stringify(redRes.body).slice(0, 400)
    const redOk =
      redRes.status === 200
      && redRes.body?.result?.ok === false
      && redErr?.code === 'TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED'
      && String(redErr.message ?? '').includes('alpha2-permission-coverage-surface-unavailable')
    check(
      'R1',
      'pre-fix glue: team.create fails with the exact production error',
      redOk,
      `result=${redErrMsg.slice(0, 500)}`,
    )
    // The glue's own observation row must carry the surface-unavailable fact.
    const redState = await p6t6State(redHost.port)
    writeFileSync(join(RUN_DIR, 'red-state.json'), JSON.stringify(redState.body ?? redRes, null, 2))
    const redObs = Array.isArray(redState.body?.observations) ? redState.body.observations : []
    const redObsLine = redObs.find((o) => String(o).includes('permission-coverage-surface-unavailable') && String(o).includes(CREATE_ROOT))
    check('R2', 'pre-fix glue: surface-unavailable observation recorded for the created root', redObsLine !== undefined, redObsLine ?? `observations(${redObs.length}): ${redObs.slice(-5).join(' | ').slice(0, 300)}`)
    stopNpmHost(redHost.host, hostPort)
    await waitForPortFree(hostPort, 15_000)
    log('RED host stopped')

    // ── LEG 3: GREEN (fixed glue) ───────────────────────────────────────────
    log('── leg 3: GREEN (fixed dist glue, same row world, same team.create) ──')
    greenHost = await bootNpmHost({
      label: 'GREEN',
      port: hostPort,
      home: HOME.green,
      glueUrl: FIXED_GLUE_URL,
      logDir: join(RUN_DIR, 'instances', 'green'),
    })
    dumpNpmConfig(HOME.green, join(RUN_DIR, 'instances', 'green', 'dump-config.txt'))
    // The A5 read probe target (see A5_PROBE_FILE): written into the
    // created leader's session workspace so the scripted `read` call
    // canonicalizes (a missing target is a fail-closed denial) and the
    // allow lane can decide.
    writeFileSync(A5_PROBE_FILE, 'a2x smoke A5 allow-lane probe target\n')
    const greenRes = await remoteCall(greenHost.origin, greenHost.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT,
      blueprintId: SAVED_BLUEPRINT_ID,
      initialWork: { prompt: MK_GREEN },
    })
    writeFileSync(join(RUN_DIR, 'green-team-create.json'), JSON.stringify(greenRes, null, 2))
    const greenData = greenRes.body?.result?.ok === true ? greenRes.body.result.value?.data : undefined
    check(
      'G1',
      'fixed glue: team.create succeeds (fresh-root)',
      greenRes.status === 200 && greenRes.body?.result?.ok === true && greenData?.path === 'fresh-root',
      `result=${greenRes.body?.result?.ok === true ? JSON.stringify(greenData ?? {}).slice(0, 300) : JSON.stringify(greenRes.body?.result?.error ?? greenRes.body).slice(0, 400)}`,
    )
    // The created Leader's initial work drove a REAL model turn (the agent
    // is live; the gate passed; the capability layer applied).
    const greenReq = await waitForMockRequest(MK_GREEN, 180_000)
    let greenSurface = null
    if (greenReq === null) {
      check('G2', 'created leader initial work reached the model', false, 'no mock request carrying the green marker within 180s')
    } else {
      greenSurface = surfaceOf(greenReq)
      writeFileSync(join(RUN_DIR, 'green-leader-request.json'), JSON.stringify({ reqSeq: greenReq.seq, model: greenReq.body?.model, surface: greenSurface, body: greenReq.body }, null, 2))
      check('G2', 'created leader initial work reached the model', true, `seq=${greenReq.seq} model=${greenReq.body?.model} surfaceCount=${greenSurface?.length ?? 0}`)
      log(`created-leader surface (${greenSurface.length} tools): ${greenSurface.join(', ')}`)
    }
    if (greenSurface !== null && discoverySurface !== null) {
      const deniedOnSurface = denyList.filter((n) => greenSurface.includes(n))
      check('G3', 'capability layer: every denied unmanaged tool is OFF the created surface', deniedOnSurface.length === 0, deniedOnSurface.length === 0 ? 'none of the deny list present' : `still present: ${deniedOnSurface.join(', ')}`)
      const selected = ['team_send_message', 'team_list_members']
      const missing = selected.filter((n) => !greenSurface.includes(n))
      check('G4', 'selected team tools ON the created surface', missing.length === 0, missing.length === 0 ? selected.join(', ') : `missing: ${missing.join(', ')}`)
      const otherTeam = TEAM_TOOL_CATALOG.filter((n) => !selected.includes(n) && greenSurface.includes(n))
      check('G5', 'non-selected team tools OFF the created surface (selective mode)', otherTeam.length === 0, otherTeam.length === 0 ? 'clean' : `present: ${otherTeam.join(', ')}`)
      const managedPresent = MANAGED_TOOL_NAMES.filter((n) => discoverySurface.includes(n) && greenSurface.includes(n))
      check('G6', 'managed-vocabulary tools stay ON the surface (gate-managed, not denied)', managedPresent.length > 0, `present: ${managedPresent.join(', ') || '(none on discovery surface?)'}`)
    }
    // A5 enforcement live proof: the allow-lane managed tool call (`read`
    // — the A5_TOOL the `a2x-a5` preset puts on the created surface; see
    // the blueprint lane note) ran through the permission listener and
    // the decision was a durable ALLOW (not a block): the p6t6
    // observation feed must carry the adapter's `stage: canonicalized`
    // row for the tool AND a `stage: decision` row with
    // `decision: allow` (plan §9: "one allowed managed tool enters the
    // normal permission pipeline").
    //
    // The read call is scripted into the initial-work MODEL TURN, which
    // starts AFTER the first captured request (G2), and the decision rows
    // land asynchronously through the observation feed — so POLL the
    // feed (500ms cadence, 90s cap) for the rows instead of snapshotting
    // state once.
    const g7Deadline = Date.now() + 90_000
    let greenState = null
    let greenObs = []
    for (;;) {
      greenState = await p6t6State(greenHost.port)
      greenObs = Array.isArray(greenState.body?.observations) ? greenState.body.observations : []
      const done =
        greenObs.some((o) => String(o).includes(`"tool":"${A5_TOOL}"`))
        && greenObs.some((o) => String(o).includes('"decision":"allow"'))
      if (done || Date.now() >= g7Deadline) break
      await new Promise((r) => setTimeout(r, 500))
    }
    writeFileSync(join(RUN_DIR, 'green-state.json'), JSON.stringify(greenState.body ?? null, null, 2))
    const greenPermsObs = greenObs.filter((o) => String(o).includes('alpha2-perm'))
    const a5ToolOnSurface = greenSurface !== null && greenSurface.includes(A5_TOOL)
    let g7Detail = `${A5_TOOL} is NOT on the created surface — enforcement leg skipped (no tool call to gate)`
    let g7Ok = true
    if (a5ToolOnSurface) {
      const toolRow = greenPermsObs.find((o) => String(o).includes(`"tool":"${A5_TOOL}"`))
      const allowRow = greenPermsObs.find((o) => String(o).includes('"decision":"allow"'))
      g7Ok = toolRow !== undefined && allowRow !== undefined
      g7Detail = g7Ok
        ? `alpha2-perm rows (${greenPermsObs.length}) — tool row: ${String(toolRow).slice(0, 220)} || allow-decision row: ${String(allowRow).slice(0, 220)}`
        : `A5 proof incomplete after 90s: toolRow=${toolRow === undefined ? 'ABSENT' : 'ok'} allowRow=${allowRow === undefined ? 'ABSENT' : 'ok'}; alpha2-perm rows (${greenPermsObs.length}): ${greenPermsObs.map((o) => String(o).slice(0, 160)).join(' || ').slice(0, 700)}`
    }
    check('G7', `A5 enforcement: ${A5_TOOL} allow/any call entered the permission pipeline with a durable ALLOW on the real host`, g7Ok, g7Detail)
    // No fail-closed evidence anywhere in the GREEN world.
    const badObs = greenObs.filter((o) => String(o).includes('surface-unavailable') || String(o).includes('unmanaged'))
    check('G8', 'no coverage failure observations in the GREEN world', badObs.length === 0, badObs.length === 0 ? 'clean' : badObs.join(' | ').slice(0, 400))
    stopNpmHost(greenHost.host, hostPort)
    await waitForPortFree(hostPort, 15_000)
    log('GREEN host stopped')
  } catch (error) {
    verdict = 'FATAL-IN-LEGS'
    log(`LEGS FAILED: ${error?.stack ?? error}`)
  } finally {
    // ── teardown ────────────────────────────────────────────────────────────
    for (const [label, rec] of [['disc', discHost], ['red', redHost], ['green', greenHost]]) {
      if (rec !== null && rec !== undefined) {
        stopNpmHost(rec.host, hostPort)
        await waitForPortFree(hostPort, 10_000)
        log(`sweep: ${label} host stopped`)
      }
    }
    try {
      await mock.close()
      log('mock model closed')
    } catch { /* already gone */ }
    const stablePost = await probeStableInstance()
    writeFileSync(join(RUN_DIR, 'port3080-post.txt'), `# :3080 post-flight probe (READ-ONLY)\nurl: ${STABLE_URL}\nhttpStatus: ${stablePost.status}\nat: ${new Date().toISOString()}\n`)
    log(`:3080 post: ${stablePost.status}`)
    // Scratch removal (evidence copies live in RUN_DIR).
    rmSync(PREFIX_GLUE_DIR, { recursive: true, force: true })
    log('pre-fix farm removed')
    if (KEEP) {
      log(`--keep: homes retained under ${join(WORKTREE, 'tests', 'homes')}`)
    } else {
      for (const [label, home] of Object.entries(HOME)) removeHome(home, `leg-${label}`)
    }
    rmSync(BLUEPRINT_DIR, { recursive: true, force: true })
    log('blueprint scratch removed')
    rmSync(A5_PROBE_FILE, { force: true })
    log('A5 probe file removed')
  }

  const failed = criteria.filter((c) => !c.ok)
  const expectedGreen = verdict === 'GREEN' && failed.length === 0
  const summary = {
    runStamp: RUN_STAMP,
    verdict: expectedGreen ? 'GREEN' : verdict === 'GREEN' ? 'RED-EXPECTED-FAILED' : verdict,
    host: { package: '@deepseek-ai/dsh', version: LIVE_HOST_PKG.version, bin: HOST_BIN, port: hostPort, mockPort: MOCK_PORT },
    baselineSha: BASELINE_SHA,
    worlds: { disc: HOME.disc, red: HOME.red, green: HOME.green, kept: KEEP },
    discoverySurface,
    denyList,
    criteria,
    artifacts: [
      'run.log',
      'discovery-surface.json',
      'saved-blueprint.yaml',
      'red-team-create.json',
      'red-state.json',
      'green-team-create.json',
      'green-leader-request.json',
      'green-state.json',
      'port3080-pre.txt',
      'port3080-post.txt',
      'instances/disc/',
      'instances/red/',
      'instances/green/',
    ],
    at: new Date().toISOString(),
  }
  writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
  log(`summary: ${join(RUN_DIR, 'summary.json')} — verdict=${summary.verdict} (${failed.length} failed criteria)`)
  process.exit(expectedGreen ? 0 : 2)
}

main().catch((error) => dieFatal(`main: ${error?.stack ?? error}`))
