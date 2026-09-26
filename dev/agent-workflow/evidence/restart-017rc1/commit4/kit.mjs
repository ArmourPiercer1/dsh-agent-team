#!/usr/bin/env node
/**
 * kit.mjs — Commit 4 real-host restart REGRESSION kit for the 0.1.7-rc.1
 * Team restart-recovery fix (guide
 * docs/plans/active/dsh-agent-team-restart-recovery-0.1.7-rc.1-guide.md
 * §13.6 + §16 Commit 4 + §17 acceptance 3/4/5/7/8/9/10/16).
 *
 * WHAT CHANGED VERSUS THE PHASE 0 SPIKE (this kit runs the SHIPPED plugin):
 *
 *   - The C1 Team Session Activation Fence (Commits 1–3 + the Commit-4
 *     runOwned-await fix, built into the installed `dsh-agent-team` row;
 *     branch tip f3d5a71b) now performs the
 *     vetoes IN PRODUCTION CODE. The `fence-probe` row runs PASSIVE
 *     (`reject: false`) and is listed FIRST in the patch layer so its
 *     awaited-serial `agent/created` listener is registered BEFORE the
 *     production fence's: it records every creation announcement (the
 *     serial chain reaches it), and a fence veto is then observed as the
 *     created → exact-generation agent/disposed → api-session/error
 *     sequence plus the exact production veto wording in the host log.
 *     The Phase 0 autoArm/permit emulations are UNUSED here (the production
 *     fence + the v5 wire `team.prepareOrdinaryOpen` permit do the work).
 *   - Worlds A–E of guide §13.6, each in its own FRESH world
 *     (tests/homes/rst017-c4-<stamp>-<world>, TEST_METHODS §7 naming), one
 *     host at a time (3492), one fresh mock at 3497 per world, the plugin
 *     installed per world via `dsh plugin add git+file:///<bare>#task/…`
 *     (the U8 vertical pattern; the branch is in the shared object store
 *     with committed dist/composition — check-artifacts-committed OK 1180).
 *   - gate-5 live closure (Phase 0 verdict gate-5 condition): after a
 *     successful Team takeover, WITHOUT any reload, the leader is prompted
 *     DIRECTLY over the wire (session/prompt — the wire equivalent of the
 *     composer) and must get a model answer. The browser gold-standard leg
 *     (UI veto → 以 Team 模式 打开 → composer immediately usable, with
 *     screenshots) is driven externally via `--browser-hold` (the kit holds
 *     boot 2, prints the marker URL + its PID, and on SIGTERM collects the
 *     browser-triggered veto + takeover + composer-prompt evidence and
 *     asserts on it).
 *
 * Worlds (guide §13.6 verbatim assertion lists — see worlds-verdict.md):
 *   A  dynamic Team root: team.create → work → stop → fresh restart →
 *      browser-style session.follow → fence veto (probe events: created →
 *      exact-generation disposed + the production wording) →
 *      team.ensureRootLive → Team resume success → the 13-item §13.6
 *      assertion list + gate-5 (wire; or the browser leg with
 *      --browser-hold).
 *   B  dynamic member child: team + member live → stop → restart →
 *      browser-style follow of the MEMBER child (fenced) → leader
 *      team_send_message triggers the member ensure → member cold resume
 *      success → role / owning root / member context / preset+base tools /
 *      Team tools surface / single writer / no OUTSIDE_TEAM|writer-held.
 *   C  ordinary non-Team negative control (the MOST IMPORTANT non-regression):
 *      ordinary cold session → restart → browser follow → ordinary
 *      SessionController promotion must SUCCEED normally (the fence never
 *      intercepts a non-Team-owned session).
 *   D  explicit ordinary mode (the v5 wire, host side of the client
 *      two-phase open): cold Team root → wire v5 team.prepareOrdinaryOpen →
 *      native open → ordinary Agent success (ensureRootLive call count 0,
 *      glue hasLive false, upstream ctx.agents live, ordinary prompt runs,
 *      a subsequent Team-mode ensure TYPED FAILS CLOSED (no silent adopt),
 *      backend restart → ordinary owner gone → Team takeover works again).
 *   E  race pressure: ≥20 iterations of restart → session.follow →
 *      concurrent team.ensureRootLive after 0–few random microtasks;
 *      acceptance 20/20 final Team live / 0 unresolved writer-held /
 *      0 double Agent / 0 leaked handle.
 *
 * Usage:
 *   node kit.mjs                          # worlds A,B,C,D,E, serial
 *   node kit.mjs --world A                # one world
 *   node kit.mjs --world A --browser-hold # World A with the external
 *                                         # browser gold-standard gate-5 leg
 *   node kit.mjs --keep-home              # keep every world's DSH_HOME
 *                                         # (default: keep A + E + failures;
 *                                         # remove the rest after evidence)
 *
 * Kit self-teardown (Phase 0 lesson): the kit SIGTERMs every host it
 * spawns and mock.close()s every mock before exit; it never relies on an
 * external kill. Per-boot probe event JSONLs, instance logs, mock request
 * logs, wire payloads and the checks ledger land under commit4/world-<X>/.
 *
 * Red lines honored: test-use stays pristine (preflight-verified, never
 * touched); DSH_HOME strictly under tests/homes/; host port 3492 / mock
 * 3497; :3080 and this GUI's home are never touched (pre/post probes
 * recorded); zero core patch; no git commit/push from the kit.
 */

import {
  appendFileSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync,
  readdirSync, rmSync, writeFileSync,
} from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import crypto from 'node:crypto'
import http from 'node:http'
import { zstdDecompressSync } from 'node:zlib'

// ── frozen facts ────────────────────────────────────────────────────────────
const MAIN_REPO = '/home/user/dsh-plugins/dsh-agent-team'
const TESTUSE = join(MAIN_REPO, 'tests', 'deepseek-harness-test-use')
const TESTUSE_PIN = '46a7f68b0922371ce7144b668b90e377d8e799f4'
const WORKTREE = join(MAIN_REPO, '.worktrees', 'team-restart-017rc1')
const BRANCH = 'task/team-restart-017rc1'
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const MOCK_MODULE = join(WORKTREE, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')
const P6T6_PLUGIN = join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')
const P6T6_ROW_NAME = pathToFileURL(P6T6_PLUGIN).href
const KIT_DIR = dirname(fileURLToPath(import.meta.url))
// The probe row's file URL must land under a manifest WITHOUT a dsh.client
// declaration — the 0.1.7 client-modules registry attributes any file-URL
// row to the nearest ancestor package, and the repo-root manifest
// (dsh-agent-team, dsh.client) would collide with the installed bundle row.
// packages/tools/harness/ sits under @dsh-agent-team/tools (no dsh.client).
const FENCE_PROBE = join(WORKTREE, 'packages', 'tools', 'harness', 'fence-probe.mjs')
const EVIDENCE_BASE = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'restart-017rc1', 'commit4')
// Per-world evidence dirs (Phase 0 RUN-14 lesson: one dir per run, never
// shared across runs). Each world gets commit4/world-<X>/ exclusively;
// inside it, per-boot subdirs (boot-1/, boot-2/…) hold the instance log,
// the per-boot probe JSONL boundary and the wire payloads.
const RUN_STAMP_EARLY = process.env.RST017_STAMP ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

const RUN_STAMP = RUN_STAMP_EARLY

// The accepted Commit-4 fix build (parent adjudication 2026-09-26): the
// fence fix "runOwned must span the operation's AWAITED lifetime" on top of
// Commit 3 (61419de). Branch tip = f3d5a71b (the parent message quoted
// a997af3 — a same-tree recommit of the identical fix; verified
// `git diff a997af3 f3d5a71b` empty). Parent-verified: C1 suite 26/26,
// runtime 2141/2149 zero new debt, typecheck/build/artifacts green. The
// bare clone must reproduce this tip exactly.
const EXPECTED_BRANCH_SHA = 'f3d5a71b7eab6e1ef166a63b86278b97ec5cc6d5'

// ── world selection (argv) ─────────────────────────────────────────────────
const argv = process.argv.slice(2)
function argvFlag(name) { return argv.includes(name) }
function argvValue(name) {
  const i = argv.indexOf(name)
  if (i === -1) return null
  const v = argv[i + 1]
  return v === undefined || v.startsWith('--') ? null : v
}
const WORLD_ARG = argvValue('--world')
const WORLD_SEQUENCE = WORLD_ARG
  ? WORLD_ARG.split(',').map((s) => s.trim().toUpperCase()).filter((s) => /^[A-E]$/.test(s))
  : ['A', 'B', 'C', 'D', 'E']
const BROWSER_HOLD = argvFlag('--browser-hold')
const KEEP_HOME = argvFlag('--keep-home')
const RACE_ITERATIONS = Number(process.env.RST017_RACE ?? 20) // guide: ≥ 20

// RUN-15 INSTRUMENTATION: event-loop lag watchdog. A setInterval that
// reports whenever the loop was busy for >1000 ms, with the last
// activity marker (set by markActivity() at key statements). This
// localizes run 14's ~30 s receive stall (B2b window: the socket's
// data events + the 30 s wait timer only resumed together at +30 s).
globalThis.__rst017Lag = { last: Date.now(), marker: 'boot', events: [] }
function markActivity(m) { globalThis.__rst017Lag.marker = `${m} @${Date.now()}` }
if (process.env.RST017_LAG === '1') {
  setInterval(() => {
    const now = Date.now()
    const lag = now - globalThis.__rst017Lag.last
    globalThis.__rst017Lag.last = now
    if (lag > 1000) {
      const e = { at: new Date().toISOString(), lagMs: lag, lastActivity: globalThis.__rst017Lag.marker }
      globalThis.__rst017Lag.events.push(e)
      console.log(`[lag] EVENT-LOOP BLOCKED ${lag}ms; lastActivity=${globalThis.__rst017Lag.marker}`)
    }
  }, 200)
}
// ── per-world state (reassigned by applyWorld before every world) ──────────
let HOME = null
let WORKSPACE = null
let XDG = null
let REPO_GIT = null
let PROFILE_DIR = null
let BLUEPRINT_DIR = null
let SPILL_ROOT = null
let EVIDENCE_DIR = null
let WORLD = null

function applyWorld(letter) {
  WORLD = letter
  // TEST_METHODS §7: ephemeral world = <line>-<UTC timestamp>, one dir per
  // world; the world letter disambiguates the five Commit 4 worlds.
  const worldStamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  HOME = join(MAIN_REPO, 'tests', 'homes', `rst017-c4-${worldStamp}-${letter}`)
  WORKSPACE = join(HOME, 'workspace')
  XDG = join(HOME, '.xdg')
  REPO_GIT = join(HOME, 'repo.git')
  PROFILE_DIR = join(HOME, 'profiles', 'web')
  BLUEPRINT_DIR = join(HOME, 'blueprints')
  SPILL_ROOT = join(HOME, 'spill')
  EVIDENCE_DIR = join(EVIDENCE_BASE, `world-${letter}`)
}

// 3492/3497 (3491 family): run 5's kit crash orphaned a boot host that still
// listens on 3491 (pid recorded in the run-5 evidence; workspace-only policy
// forbids killing it, so this kit simply moves one family member over).
const HOST_PORT = Number(process.env.RST017_HOST_PORT ?? 3492)
const MOCK_PORT = Number(process.env.RST017_MOCK_PORT ?? 3497)

// Session ids are stamped per KIT RUN; every world has its own home, so the
// same ids across worlds never collide.
const BOOT_ROOT = `session-rst017c4-boot-${RUN_STAMP}`
const DYN_ROOT = `session-rst017c4-dyn-${RUN_STAMP}`
const ORD_SESSION = `session-rst017c4-ord-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.rst017c4-anchor'
const BP_MAIN_ID = 'team.rst017c4-main'
const MODEL_ID = `rst017c4-model-${RUN_STAMP}`
const PRESET_ID = 'standard'
const P_BOOT = `RST017C4BOOT_PERSONA_${RUN_STAMP}`
const P_DYN = `RST017C4DYN_PERSONA_${RUN_STAMP}`
const P_MEM = `RST017C4MEM_PERSONA_${RUN_STAMP}`
const MEMBER_LABEL = `c4-worker-${RUN_STAMP.slice(-6)}`
const MK_DONE = `RST017C4DONE_${RUN_STAMP}`
const MK_ORD = `RST017C4ORD_${RUN_STAMP}`
const MK_TEAMUP = `RST017C4TEAMUP_${RUN_STAMP}`
const MK_BMEM = `RST017C4BMEM_${RUN_STAMP}`
const MK_BMEM2 = `RST017C4BMEM2_${RUN_STAMP}`
const MK_G5 = `RST017C4GATE5_${RUN_STAMP}`

// The closed 13-tool Team catalog (packages/tools/src/tools.ts @ 61419de —
// the same set U8 v8 pinned; guide §13.6: "U8 当前 evidence 为 13 个 team_*").
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
// The frozen legacy-mode surfaces. VERIFIED against the plugin source @
// f3d5a71b (run 8, World B, member model request seq=7): the FULL 13-tool
// catalog is mounted on EVERY team-owned session (leader AND member) —
// there is NO mount-time role filtering. The worker envelope
// (send-message + report-progress) is enforced AT THE ACTION LEVEL:
// per-tool role guards (TEAM_TOOL_ARCHIVE_NOT_LEADER /
// TEAM_TOOL_PENDING_LIST_NOT_LEADER) + checkAgainstEnvelope in the
// mutation service (packages/runtime/admission/envelope.ts: the envelope
// governs mutation OPS, not the tool surface). Guide B item 5
// "Team tools surface 正确" = the frozen closed catalog is present and
// complete on the member surface (the earlier "exactly two tools"
// reading was a kit misimplementation — kit bug #11).
const LEADER_TEAM_TOOLS_ALLOW = [...TEAM_TOOL_CATALOG]
const MEMBER_TEAM_TOOLS_ALLOW = [...TEAM_TOOL_CATALOG]
// The standard preset's managed tool surface (U8 MANAGED_TOOL_NAMES) — the
// "member preset/base tools" of the §13.6 World B assertion.
const BASE_PRESET_TOOLS = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/
// PROBE_TEAM_FILE is derived from the per-world workspace.
function probeTeamFile() { return join(WORKSPACE, 'team', 'test.md') }
const PROBE_TEAM_CONTENT = `rst017c4-team-probe-${RUN_STAMP}`

// ── small state ─────────────────────────────────────────────────────────────
let fatal = null
const results = []
function log(msg) { console.log(`[rst017-c4 ${RUN_STAMP}] ${msg}`) }
function die(msg) { fatal = msg; log(`FATAL: ${msg}`) }
function check(leg, name, ok, detail = '') {
  results.push({ leg, name, ok: !!ok, detail })
  log(`${ok ? 'PASS' : 'FAIL'} [${leg}] ${name}${detail ? ` — ${detail}` : ''}`)
  return !!ok
}
function legDir(leg) {
  const d = join(EVIDENCE_DIR, leg)
  mkdirSync(d, { recursive: true })
  return d
}
function writeEvidence(leg, name, content) {
  const d = legDir(leg)
  const p = join(d, name)
  writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2))
  return p
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── tiny http helpers ───────────────────────────────────────────────────────
async function fetchJson(url, init, timeoutMs = 60_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ status: 0, body: null, error: e.message }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body }
}
async function probePort(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(5_000) })
    return { port, reachable: true, status: res.status }
  } catch {
    return { port, reachable: false, status: null }
  }
}
async function portFree(port, timeoutMs = 3_000) {
  try {
    await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(timeoutMs) })
    return false
  } catch {
    return true
  }
}
async function waitForPortFree(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await portFree(port, 500)) return true
    if (Date.now() >= deadline) return false
    await sleep(300)
  }
}
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie !== null) return setCookie.split(';', 1)[0]
  if (res.status >= 200 && res.status < 300) return null
  throw new Error(`dsh web authentication returned HTTP ${res.status} with no set-cookie`)
}
function rpcBody(method, params, version, tag) {
  return JSON.stringify({
    type: 'client-request',
    rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
    method,
    payload: { version, params },
  })
}
async function remoteCall(origin, cookie, method, params, tag = 'rst', version = 1, timeoutMs = 240_000) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: rpcBody(method, params, version, tag),
  }, timeoutMs)
}
/**
 * The 0.1.7 session channel wire shape (the dsh-client-connection RPC
 * channel mounted at /api/session/*; the U8-proven envelope: the args ride
 * `{ args: { request } }`, no contract version stamp).
 */
/**
 * The 0.1.7 session prompt wire shape (U8-proven; the prompt is queued
 * asynchronously — the model request arrives on the mock, not in the reply).
 */
async function apiPrompt(origin, cookie, sessionId, text, tag = 'rst') {
  const requestId = `${tag}-${Math.random().toString(36).slice(2, 12)}`
  return fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: requestId,
      method: 'session/prompt',
      payload: { args: { request: { requestId, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } },
    }),
  }, 300_000)
}
async function apiCreateSession(origin, cookie, sessionId, cwd) {
  return fetchJson(`${origin}/api/session/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `rst-create-session-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/create',
      payload: { args: { request: { sessionId, cwd } } },
    }),
  }, 60_000)
}

// ── raw WebSocket client (RFC 6455, cookie-carrying upgrade, no deps) ──────
/**
 * Minimal client: HTTP/1.1 upgrade with custom headers, masked client text
 * frames, unmasked server text frames (fragmentation-safe), ping→pong,
 * close. Enough for the /api/remote.mux stream protocol.
 */
/** RST017_WS_TRACE=1 sink: one entry per closed/failed socket. */
const wsTraceSink = []
class RemoteMuxSocket {
  constructor(url, { cookie, timeoutMs = 20_000 } = {}) {
    const u = new URL(url)
    this.host = u.hostname
    this.port = u.port ? Number(u.port) : 80
    this.path = u.pathname + u.search
    this.cookie = cookie
    this.timeoutMs = timeoutMs
    this.socket = null
    this.buffer = Buffer.alloc(0)
    this.fragPayload = null
    this.frames = []
    this.waiters = []
    this.closed = false
    this.closeError = null
    // RST017_WS_TRACE=1: record EVERY frame (both directions, incl. control
    // frames) to diagnose host-side socket closes (run 8: "ws closed by
    // host" with no close frame during session/follow streaming).
    this.trace = process.env.RST017_WS_TRACE === '1' ? [] : null
    this.traceT0 = Date.now()
    this.label = 'unlabeled'
    this._open = new Promise((res, rej) => { this._openRes = res; this._openRej = rej })
  }

  _trace(dir, opcode, payload) {
    if (this.trace === null) return
    const head = payload.subarray(0, 400)
    this.trace.push({
      t: Date.now() - this.traceT0, dir, op: opcode, len: payload.length,
      head: head.toString('utf8').slice(0, 400),
    })
  }
  _flushTrace() {
    if (this.trace === null) return
    const frames = this.trace
    this.trace = null
    wsTraceSink.push({
      label: this.label,
      closeError: this.closeError !== null ? String(this.closeError?.message ?? this.closeError) : null,
      frames,
    })
  }

  connect() {
    const req = http.request({
      host: this.host,
      port: this.port,
      path: this.path,
      method: 'GET',
      headers: {
        connection: 'Upgrade',
        upgrade: 'websocket',
        'sec-websocket-key': crypto.randomBytes(16).toString('base64'),
        'sec-websocket-version': '13',
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
    })
    // Node fires the request 'upgrade' event (NOT the response callback) for
    // a 101 Switching Protocols; `head` may already hold frame bytes.
    req.on('upgrade', (res, socket, head) => {
      if (res.statusCode !== 101) {
        socket.destroy()
        this._fail(new Error(`ws upgrade rejected: HTTP ${res.statusCode}`))
        return
      }
      this.socket = socket
      if (head && head.length > 0) this.buffer = Buffer.from(head)
      this._attach()
      this._openRes()
      if (this.buffer.length > 0) this._pump()
    })
    req.on('response', (res) => {
      // Non-upgrade response (e.g. 401/404): the connection is plain HTTP.
      const status = res.statusCode
      res.resume()
      this._fail(new Error(`ws upgrade rejected: HTTP ${status}`))
    })
    // Upgrade-phase timeout only (a manual timer — a socket timeout would
    // later kill the long-lived stream connection).
    const upgradeTimer = setTimeout(() => this._fail(new Error('ws upgrade timeout')), this.timeoutMs)
    const clearUpgradeTimer = () => clearTimeout(upgradeTimer)
    req.on('error', (e) => { clearUpgradeTimer(); this._fail(e) })
    req.on('upgrade', () => clearUpgradeTimer())
    req.on('response', () => clearUpgradeTimer())
    req.end()
    return this._open
  }

  _fail(err) {
    if (this.closed) return
    this.closed = true
    this.closeError = err
    this._openRej?.(err)
    for (const w of this.waiters) w.rej(err)
    this.waiters = []
    this._flushTrace()
    try { this.socket?.destroy() } catch { /* already gone */ }
  }

  _attach() {
    const sock = this.socket
    sock.on('data', (chunk) => {
      if (process.env.RST017_RAW_LOG === '1') {
        const b0 = chunk.length > 0 ? chunk[0].toString(16).padStart(2, '0') : '?'
        const b1 = chunk.length > 1 ? chunk[1].toString(16).padStart(2, '0') : '?'
        const op = chunk.length > 1 ? (chunk[1] & 0x0f) : -1
        const note = op === 9 ? ' <== PING' : op === 10 ? ' <== PONG?' : op === 8 ? ' <== CLOSE-FRAME!' : ''
        console.log(`[rawlog ${this.label} +${Date.now() - (this.__t0 ?? (this.__t0 = Date.now()))}ms] RAW ${chunk.length}B b0=0x${b0} b1=0x${b1}${note}`)
      }
      this.buffer = Buffer.concat([this.buffer, chunk])
      this._pump()
    })
    sock.on('close', () => {
      if (!this.closed) {
        this.closed = true
        this.closeError = new Error('ws closed by host')
        for (const w of this.waiters) w.rej(this.closeError)
        this.waiters = []
      }
      this._flushTrace()
    })
    sock.on('error', (e) => this._fail(e))
  }

  _pump() {
    for (;;) {
      const first = this.fragPayload === null ? 2 : 1
      if (this.buffer.length < first) return
      const fin = (this.buffer[0] & 0x80) !== 0
      const opcode = this.buffer[0] & 0x0f
      const b1 = this.fragPayload === null ? this.buffer[1] : this.buffer[0]
      const masked = (b1 & 0x80) !== 0
      let payloadLen = b1 & 0x7f
      let offset = this.fragPayload === null ? 2 : 1
      if (payloadLen === 126) {
        const need = this.fragPayload === null ? 4 : 3
        if (this.buffer.length < need) return
        payloadLen = this.buffer.readUInt16BE(need - 2)
        offset = need
      } else if (payloadLen === 127) {
        const need = this.fragPayload === null ? 10 : 9
        if (this.buffer.length < need) return
        // RUN-14 FIX: the 64-bit length field follows the 2-byte header at
        // bytes 2..9 (new frame) / 1..8 (continuation) — NOT at `need - 2`
        // (that offset is only correct for the 16-bit case). The old code
        // read payload bytes as the length (~exabyte) on every frame
        // >= 65536 B, desyncing the parser: the follow snapshot was never
        // delivered, PINGs were swallowed into the buffer, no PONG was
        // sent, and the 0.1.7 mux heartbeat (2 s × 2 misses) terminated
        // the socket framelessly at ~+6 s. This was the A4/B2 "ws closed
        // by host" mechanism for ALL runs with a large snapshot.
        payloadLen = Number(this.buffer.readBigUInt64BE(this.fragPayload === null ? 2 : 1))
        offset = need
      }
      if (masked) {
        if (this.buffer.length < offset + 4 + payloadLen) return
        const mask = this.buffer.subarray(offset, offset + 4)
        offset += 4
        const payload = Buffer.from(this.buffer.subarray(offset, offset + payloadLen))
        this.buffer = this.buffer.subarray(offset + payloadLen)
        for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4]
        this._safeFrame(opcode, fin, payload)
      } else {
        if (this.buffer.length < offset + payloadLen) return
        const payload = Buffer.from(this.buffer.subarray(offset, offset + payloadLen))
        this.buffer = this.buffer.subarray(offset + payloadLen)
        this._safeFrame(opcode, fin, payload)
      }
    }
  }

  /** Frame handler wrapper: frame-processing errors must never escape the
   *  socket 'data' handler (they would kill the kit with an uncaught throw
   *  — the run-5 crash mode). Fail the socket instead. */
  _safeFrame(opcode, fin, payload) {
    try { this._framePayload(opcode, fin, payload) }
    catch (e) { this._fail(new Error(`ws frame handling error: ${String(e?.message ?? e)}`)) }
  }

  _framePayload(opcode, fin, payload) {
    this._trace('rx', opcode, payload)
    if (opcode === 0x8) {
      // Host-initiated close: record the code/reason for the evidence.
      if (this.closeError === null && payload.length >= 2) {
        const code = payload.readUInt16BE(0)
        const reason = payload.subarray(2).toString('utf8')
        this.closeError = new Error(`ws closed by host (code=${code}${reason ? `: ${reason}` : ''})`)
      }
      this.close()
      return
    }
    if (opcode === 0x9) { this._rawFrame(0xA, payload); return }
    if (opcode === 0xA) return
    if (opcode !== 0x1) { this._fail(new Error(`ws unexpected opcode ${opcode}`)); return }
    if (this.fragPayload === null) this.fragPayload = []
    this.fragPayload.push(payload)
    if (fin) {
      const text = Buffer.concat(this.fragPayload).toString('utf8')
      this.fragPayload = null
      let msg
      try { msg = JSON.parse(text) } catch { return }
      const w = this.waiters.shift()
      if (w !== undefined) w.res(msg)
      else this.frames.push(msg)
    }
  }

  _rawFrame(opcode, payload) {
    if (this.socket === null || this.socket.destroyed) return
    this._trace('tx', opcode, payload)
    const len = payload.length
    // Client→server frames MUST be masked (RFC 6455 §5.3): the mask bit is
    // the high bit of the SECOND header byte. Runs 5/6 omitted it — the
    // smoke-test's lenient fake gateway accepted the unmasked frames, but
    // the real ws@8 receiver closed the socket with 1002 (it read the
    // appended 4 "mask" bytes as payload → invalid UTF-8).
    let header
    if (len < 126) header = Buffer.from([0x80 | opcode, 0x80 | len])
    else if (len < 65536) {
      header = Buffer.alloc(4)
      header[0] = 0x80 | opcode
      header[1] = 0x80 | 126
      header.writeUInt16BE(len, 2)
    } else {
      header = Buffer.alloc(10)
      header[0] = 0x80 | opcode
      header[1] = 0x80 | 127
      header.writeBigUInt64BE(BigInt(len), 2)
    }
    const mask = crypto.randomBytes(4)
    const masked = Buffer.from(payload)
    for (let i = 0; i < masked.length; i += 1) masked[i] ^= mask[i % 4]
    this.socket.write(Buffer.concat([header, mask, masked]))
  }

  send(text) {
    this._rawFrame(0x1, Buffer.from(text, 'utf8'))
  }

  /** Next complete message, or reject on close/failure/timeout. */
  next(timeoutMs = 30_000) {
    if (this.frames.length > 0) return Promise.resolve(this.frames.shift())
    if (this.closed) return Promise.reject(this.closeError ?? new Error('ws closed'))
    return new Promise((res, rej) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== wRef)
        rej(new Error('ws next-frame timeout'))
      }, timeoutMs)
      const wRef = {
        res: (m) => { clearTimeout(timer); res(m) },
        rej: (e) => { clearTimeout(timer); rej(e) },
      }
      this.waiters.push(wRef)
    })
  }

  close() {
    if (this.closed) return
    this.closed = true
    for (const w of this.waiters) w.rej(this.closeError ?? new Error('ws closed by client'))
    this.waiters = []
    try { this._rawFrame(0x8, Buffer.from([0x3e, 0x00])) } catch { /* best effort */ }
    const t = setTimeout(() => { try { this.socket?.destroy() } catch { /* gone */ } }, 300)
    t.unref?.()
  }
}

// ── the scripted mock model ─────────────────────────────────────────────────
/**
 * Per-world mock state + the scenario `decide` table. The mock is FRESH per
 * world (started in startWorld, closed at world end) — `requests` is the
 * per-world model-request log the assertions read.
 */
const worldMock = { state: null }
function makeDecide(worldState) {
  return ({ req }) => {
    const msgs = req?.messages ?? []
    const tools = (req?.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t))
    // Tool-result blocks after the last text-bearing user message (the
    // turn's completed tool calls; the U8-proven ladder shape).
    const lastPromptUser = (() => {
      let i = -1
      for (let k = msgs.length - 1; k >= 0; k -= 1) {
        const m = msgs[k]
        if (m?.role !== 'user' || !Array.isArray(m.content)) continue
        if (m.content.some((b) => b && b.type === 'text' && typeof b.text === 'string' && b.text.length > 0)) { i = k; break }
      }
      return i
    })()
    const tmsgs = []
    for (let k = lastPromptUser + 1; k < msgs.length; k += 1) {
      const m = msgs[k]
      if (m?.role !== 'user' || !Array.isArray(m.content)) continue
      for (const b of m.content) {
        if (b && b.type === 'tool_result') tmsgs.push(b)
      }
    }
    const userTexts = msgs.filter((m) => m?.role === 'user')
      .map((m) => (typeof m.content === 'string' ? m.content
        : Array.isArray(m.content) ? m.content.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join('')
        : ''))
      .filter((t) => t.length > 0)
    const userText = userTexts.join('\n')
    // Title-gen side call (U8: a request without a tool header is a side
    // call; keep the conversation chains pure).
    if (tools.length === 0) return { kind: 'text', content: 'c4 title' }
    const text = (content) => ({ kind: 'text', content })
    let tokSeq = 0
    const freshToken = () => `c4-tok-${RUN_STAMP.slice(-6)}-${++tokSeq}`
    const call = (name, args) => ({ kind: 'tool-call', toolCalls: [{ id: `c4-${Math.random().toString(36).slice(2, 10)}`, name, arguments: args }] })

    // ── ordinary-session markers (World C + World D ordinary owner) ──────
    if (userText.includes(MK_ORD)) return text(`C4_ORD_ACK ${MK_ORD}`)
    // ── World B: the dynamic leader's team-up turn ─────────────────────────
    if (userText.includes(MK_TEAMUP)) {
      const t = tmsgs.length
      if (t === 0) {
        return call('team_create_member', { rootSessionId: DYN_ROOT, requestToken: freshToken(), delegationTemplateId: 'worker', label: MEMBER_LABEL })
      }
      if (t === 1) {
        // Parse the create-member tool result. 0.1.7 wire shape: the
        // tool_result block carries content as a WireInput[] (array of
        // {type:'text', text} blocks), NOT a bare JSON string — run-3
        // world B proved the old string-only parse fell back to the label
        // and the product CORRECTLY rejected the delegate's invalid
        // instanceId (closed-contract enforcement, not a product bug).
        let raw = tmsgs[t - 1]?.content
        if (Array.isArray(raw)) raw = raw.filter((b) => b?.type === 'text').map((b) => b?.text ?? '').join('')
        let parsed = null
        if (typeof raw === 'string') { try { parsed = JSON.parse(raw) } catch { parsed = null } }
        else if (raw && typeof raw === 'object') parsed = raw
        let instanceId = null
        let childSessionId = null
        if (parsed) {
          const walk = (node) => {
            if (node === null || typeof node !== 'object') return
            for (const [k, v] of Object.entries(node)) {
              if (k === 'instanceId' && typeof v === 'string' && v.startsWith('inst-')) instanceId = v
              if (k === 'childSessionId' && typeof v === 'string' && v.startsWith('session-')) childSessionId = v
              walk(v)
            }
          }
          walk(parsed)
        }
        instanceId ??= MEMBER_LABEL
        worldState.memberInstanceId = instanceId
        worldState.memberChildSessionId = childSessionId ?? null
        return call('team_delegate', {
          rootSessionId: DYN_ROOT,
          requestToken: freshToken(),
          delegationInstanceId: instanceId,
          label: MEMBER_LABEL,
          prompt: `${MK_BMEM} Worker task: read team/test.md and answer with its content, then stop.`,
        })
      }
      return text(`C4_TEAMUP_DONE ${MK_TEAMUP}`)
    }
    // ── World B: member turns (delegate prompt + post-restart send) ───────
    if (userText.includes(MK_BMEM2)) {
      const t = tmsgs.length
      if (t === 0) return call('read', { file_path: 'team/test.md' })
      return text(`C4_BMEM2_ACK ${MK_BMEM2}`)
    }
    if (userText.includes(MK_BMEM)) {
      const t = tmsgs.length
      if (t === 0) return call('read', { file_path: 'team/test.md' })
      return text(`C4_BMEM_ACK ${MK_BMEM}`)
    }
    // ── World A/D: the dynamic leader's initial work ──────────────────────
    // NOTE (kit bug #8, run-5 browser leg): userText joins EVERY user
    // message of the conversation, so once the initial work (MK_DONE) is in
    // history it shadows any later prompt that is checked after it. The
    // gate-5 marker must be tested FIRST: the post-takeover prompt is the
    // discriminating turn and its scripted answer must not be masked by the
    // history. The product is unaffected (the prompt does reach the model —
    // run-5's browser turn executed; the mock simply answered with the wrong
    // scripted line).
    if (userText.includes(MK_G5)) return text(`C4_GATE5_ACK ${MK_G5}`)
    if (userText.includes(MK_DONE)) return text(`C4_DONE ${MK_DONE}`)
    return text('c4 noop ack')
  }
}
async function startMockModel() {
  const { startMockModel: startMock } = await import(pathToFileURL(MOCK_MODULE).href)
  const mockLogPath = join(EVIDENCE_DIR, 'mock.log')
  const mock = await startMock({
    port: MOCK_PORT,
    decide: makeDecide(worldMock.state),
    log: (l) => { try { appendFileSync(mockLogPath, l + '\n') } catch { /* best-effort */ } },
  })
  return mock
}

// ── host lifecycle ──────────────────────────────────────────────────────────
function spawnHost({ port, logPath, detached = false }) {
  const outFd = openSync(logPath, 'a')
  const alive = { exited: false }
  const child = spawn(
    process.execPath,
    [HOST_BIN, 'web', '--port', String(port), '--no-open'],
    {
      cwd: WORKSPACE,
      stdio: ['ignore', outFd, outFd],
      env: {
        ...process.env,
        DSH_HOME: HOME,
        DSH_CLIENT_COMMIT_HASH: TESTUSE_PIN.slice(0, 10),
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
        DEEPSEEK_API_KEY: 'rst017-c4-mock-key',
        // RST017_HOST_HOOK=1: in-memory observation of the product dist
        // modules (module.registerHooks source transform — zero file
        // modification; logs [c4diag*] lines to the host's stderr → the
        // per-boot instance log). Diagnostic mode only (attribution of the
        // boot 1 production-fence veto — see diag-hook-c4.mjs header).
        ...(process.env.RST017_HOST_HOOK === '1' ? { NODE_OPTIONS: `--import ${join(KIT_DIR, 'diag-hook-c4.mjs')}` } : {}),
      },
      ...(detached ? { detached: true } : {}),
    },
  )
  child.on('close', () => { alive.exited = true })
  child.on('error', () => { alive.exited = true })
  if (detached) child.unref?.()
  return { child, alive: () => !alive.exited }
}
function stopHost(child) {
  try { child.kill('SIGTERM') } catch { /* already gone */ }
}
async function waitForLogLine(logPath, regex, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  let last = -1
  for (;;) {
    try {
      const text = readFileSync(logPath, 'utf8')
      if (text.length > last) {
        const m = regex.exec(text.slice(last))
        if (m !== null) return m[0]
        last = text.length
      }
    } catch { /* not created yet */ }
    if (!alive()) break
    if (Date.now() >= deadline) break
    await sleep(250)
  }
  return null
}
function logTail(logPath, n = 40) {
  try {
    const lines = readFileSync(logPath, 'utf8').split('\n').filter((l) => l.length > 0)
    return lines.slice(-n).join('\n')
  } catch {
    return '(no log)'
  }
}

// ── blueprints (plain legacy — NO capabilities: the spike keeps the surface
//     at the stock preset + full team catalog, no strict-gate involvement) ──
const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 1',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  `  persona: "You are the leader of the rst017 boot team. ${P_BOOT} Answer concisely and stop."`,
  'members:',
  '  - templateId: worker',
  `    persona: "You are a worker of the rst017 boot team. ${P_BOOT}"`,
  'memberEnvelopes: []',
  'requirements: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

function mainBlueprintYaml() {
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${BP_MAIN_ID}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the rst017c4 dynamic team. ${P_DYN} Answer concisely and stop.`)}`,
    'members:',
    '  - templateId: worker',
    '    displayName: "Worker"',
    `    persona: ${JSON.stringify(`You are a worker of the rst017c4 dynamic team. ${P_MEM}`)}`,
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '    - archive-member',
    '  deny: []',
    'memberEnvelopes:',
    '  - templateId: worker',
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
    rootSessionId: BOOT_ROOT,
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: BLUEPRINT_DIR,
    rootPresetId: PRESET_ID,
    memberPresetId: PRESET_ID,
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
  }
}

// ── yaml emission (rc2 kit shape) ───────────────────────────────────────────
function yamlScalar(v) {
  if (v === null) return 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
}
function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (value !== null && typeof value === 'object') {
    const empty = Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0
    if (empty) return [`${pad}${key}: ${Array.isArray(value) ? '[]' : '{}'}`]
    if (Array.isArray(value)) {
      return [`${pad}${key}:`, ...value.flatMap((item) => yamlEmitItem(item, indent + 1))]
    }
    return [`${pad}${key}:`, ...Object.entries(value).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}
function yamlEmitItem(item, indent) {
  const pad = '  '.repeat(indent)
  // Scalar sequence elements (e.g. a string in a string array) must emit as
  // `- "value"` — Object.entries() on a string yields 0..n character rows,
  // which the patch-layer YAML parser reads back as a mapping (run 8:
  // teamSessions came back as {0:"s",1:"e",...} → the probe's
  // Array.isArray guard saw an empty set → the veto never fired).
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

/**
 * The profile patch layer (Commit 4 shape). ROW ORDER MATTERS: the
 * fence-probe row is listed FIRST so its awaited-serial `agent/created`
 * listener is registered before the production fence's listener (the
 * production row's apply() registers the fence at its very front, guide
 * §4.1) — the passive probe then records EVERY creation announcement and
 * a production veto is observed as the created → exact-generation
 * disposed → api-session/error sequence. The probe is strictly PASSIVE
 * (`reject: false`): the SHIPPED fence (Commits 1–3) performs the vetoes;
 * the probe only observes (its `veto` field stays false by construction).
 * The p6t6 row stays AFTER the production row (its inject parks on the
 * `teamRoot` service the production row provides).
 */
function writePatchFile(phase, bootNo) {
  mkdirSync(PROFILE_DIR, { recursive: true })
  const lines = [
    `# rst017 Commit 4 kit patch layer (run ${RUN_STAMP}, world ${WORLD}, boot ${bootNo}, bootPhase ${phase})`,
    '# fence-probe FIRST: passive observer registered before the production',
    '# C1 fence (see writePatchFile docs). reject=false — the shipped fence vetoes.',
    '- insert:',
    ...yamlEmitItem({
      id: 'team-restart-fence-probe',
      name: pathToFileURL(FENCE_PROBE).href,
      config: {
        reject: false,
        autoArm: false,
        teamSessions: [DYN_ROOT],
        reportDir: join(EVIDENCE_DIR, `boot-${bootNo}`, 'probe-events'),
      },
    }, 2),
    ...yamlEmitItem({ id: 'dsh-agent-team', name: 'dsh-agent-team/host', config: teamRowConfig(phase) }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...yamlEmitItem({ id: 'team-spill-local', name: 'dsh-agent-team/spill-local', config: { root: SPILL_ROOT } }, 2),
    '',
  ]
  writeFileSync(join(PROFILE_DIR, 'cordis.patch.yml'), lines.join('\n'))
}

function writeDirective(bootNo, phase) {
  // The p6t6 harness validates boot ∈ 1..4 (the number is world-specific
  // bookkeeping; the PHASE is the semantic mode). Long worlds (E: 21 boots)
  // cycle the number within 1..4 and rely on the phase field.
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot: ((bootNo - 1) % 4) + 1,
    phase,
    reportDir: EVIDENCE_DIR,
    runStamp: RUN_STAMP,
    rootSessionId: BOOT_ROOT,
  }, null, 2))
}

// ── the $events + session/follow stream carrier ─────────────────────────────
async function openMux(origin, cookie, label = 'mux') {
  const wsUrl = origin.replace(/^http/, 'ws') + '/api/remote.mux'
  const ws = new RemoteMuxSocket(wsUrl, { cookie })
  ws.label = label
  await ws.connect()
  return ws
}
/** Flush the RST017_WS_TRACE sink into evidence (no-op unless tracing). */
function dumpWsTraces(tag) {
  if (wsTraceSink.length === 0) return
  writeEvidence(tag, 'ws-traces.json', wsTraceSink.splice(0))
}
async function openEventsStream(ws) {
  const streamId = 'ev-' + Math.random().toString(36).slice(2, 10)
  ws.send(JSON.stringify({ type: 'open', streamId, endpoint: '$events', payload: { args: {} } }))
  const ready = await ws.next(30_000)
  if (ready?.streamId !== streamId || ready.type !== 'item' || ready.value?.type !== 'ready') {
    throw new Error(`unexpected first $events frame: ${JSON.stringify(ready).slice(0, 300)}`)
  }
  return streamId
}
/**
 * Open a `session/follow` stream and collect frames until the first snapshot
 * arrives (the follow handler yields the snapshot FIRST, then promotes in
 * the background — so the snapshot is the "the browser got in" signal).
 */
async function followSession(ws, sessionId, { timeoutMs = 45_000 } = {}) {
  const streamId = 'fol-' + Math.random().toString(36).slice(2, 10)
  // 0.1.7 typert descriptor: args = { request: <SessionFollowRequest> } —
  // the request object itself carries `address` (types.ts:485); run 7's
  // gateway/arguments-invalid ("missing request; unexpected address")
  // pinned the wrapping.
  ws.send(JSON.stringify({
    type: 'open',
    streamId,
    endpoint: 'session/follow',
    payload: { args: { request: { address: { kind: 'session', sessionId } } } },
  }))
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const frame = await ws.next(deadline - Date.now())
    if (frame?.streamId !== streamId) continue
    if (frame.type === 'error') throw new Error(`session/follow stream error: ${JSON.stringify(frame.error)}`)
    if (frame.type === 'item' && frame.value?.type === 'snapshot') {
      return { streamId, snapshot: frame.value }
    }
    if (Date.now() >= deadline) throw new Error('session/follow: no snapshot frame in time')
  }
}
/**
 * RUN-10 helper: wait for a $events `emit` frame on the given stream whose
 * value matches `predicate`, skipping frames of other streams (they are
 * re-queued). Returns the matching frame or null on close/timeout.
 */
async function waitForEventFrame(ws, streamId, predicate, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  const isTarget = (f) => f?.streamId === streamId && f.type === 'item' && f.value?.type === 'emit' && predicate(f.value)
  const restore = (frames, extra) => {
    // Re-queue in original order (FIFO): held frames first, newest frame last.
    if (frames.length) ws.frames.push(...frames)
    if (extra !== undefined) ws.frames.push(extra)
  }
  for (;;) {
    // Scan (do not consume) the local queue for a match (snapshot-window
    // frames may already be parked here).
    const idx = ws.frames.findIndex(isTarget)
    if (idx !== -1) return ws.frames.splice(idx, 1)[0]
    if (ws.closed) return null
    if (Date.now() >= deadline) return null
    // RUN-19 FIX (microtask starvation): if the queue holds non-matching
    // frames, next() would resolve them as immediate microtasks (:514
    // `Promise.resolve(this.frames.shift())`), so "re-queue then next()"
    // re-yields the SAME frame forever — a microtask loop that starves the
    // socket pump, all timers (incl. the 30s deadline) and the event loop
    // for the whole window (v8 --prof: waitForEventFrame/isTarget/
    // StringEqual/Unshift/Shift + promise plumbing at ~10x CPU for 30.1s;
    // CPU sampler: 299.6s CPU in 30.1s wall; runs 14-18 "B2b 30s stall").
    // Park the queue while awaiting so next() registers a REAL waiter and
    // the pump stays free; restore order on wake.
    const held = ws.frames.splice(0, ws.frames.length)
    let f
    try { f = await ws.next(deadline - Date.now()) } catch { f = undefined }
    restore(held, f)
    if (f === undefined) {
      // close/timeout: loop again — the deadline/closed check above ends it
      // (queue preserved for later waiters).
      if (ws.closed || Date.now() >= deadline) return null
    }
  }
}
async function fenceHealth(origin) {
  return fetchJson(`${origin}/__fence/health`, undefined, 30_000)
}
async function fenceEvents(origin) {
  const res = await fetchJson(`${origin}/__fence/events`, undefined, 30_000)
  return res.body?.events ?? []
}
async function fenceArmed(origin, armed) {
  return fetchJson(`${origin}/__fence/armed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ armed }),
  }, 30_000)
}
async function fencePermit(origin, sessionId) {
  return fetchJson(`${origin}/__fence/permit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  }, 30_000)
}

// ── session log inspection (read-only; the 0.1.7 layout is
//     <home>/sessions/<profile>/<sessionId>/session[.vN].jsonl[.zstd]) ──────
function findSessionLogs(home, sessionId) {
  const sessionsRoot = join(home, 'sessions')
  const out = []
  let profiles = []
  try { profiles = readdirSync(sessionsRoot, { withFileTypes: true }).filter((e) => e.isDirectory()) } catch { return out }
  for (const p of profiles) {
    const dir = join(sessionsRoot, p.name, sessionId)
    let entries = []
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const e of entries) {
      if (e.isFile() && /^session(\.v\d+)?\.jsonl(\.zstd)?$/.test(e.name)) out.push(join(dir, e.name))
    }
  }
  return out
}
/**
 * Structural scan of a concatenated-Zstandard session log (ported from
 * upstream `dsh-session-persistence-jsonl/src/zstd.ts scanZstdFrames`,
 * read-only reference — the 0.1.7 generation file is a SEQUENCE of
 * independent zstd frames: frame 1 = the session header line, one more
 * frame per durable append batch. Node's zstdDecompressSync decodes ONLY
 * the first frame, so a single-shot decode undercounts every log that
 * received a turn (run 7: 12 frames, 36KB, "1 row" with single-shot).
 */
const ZSTD_MAGIC = 0xfd2fb528
function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) break
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) break // torn tail: stop
    offset += 4
    if (offset === buffer.length) break
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    if ((descriptor & 0x18) !== 0) break // reserved bits: unreadable tail
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 0x20) !== 0
    const checksum = (descriptor & 0x04) !== 0
    const dictionaryFlag = descriptor & 0x03
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0
      ? (singleSegment ? 1 : 0)
      : 1 << contentSizeFlag
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < remainingHeaderBytes) break
    offset += remainingHeaderBytes
    let complete = false
    for (;;) {
      if (buffer.length - offset < 3) break
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 0x03
      const blockSize = blockHeader >>> 3
      if (blockType === 0x03) break // reserved: unreadable
      const payloadBytes = blockType === 0x01 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) break
      offset += payloadBytes
      if (lastBlock) { complete = true; break }
    }
    if (!complete) break
    if (checksum) {
      if (buffer.length - offset < 4) break
      offset += 4
    }
    frames.push({ start, end: offset })
  }
  return frames
}

/**
 * Read every complete JSONL row of one session generation file
 * (zstd multi-frame or plain JSONL). Returns { rows, assistant, rowTypes }.
 */
function readSessionLogRows(path) {
  let raw = readFileSync(path)
  if (path.endsWith('.zstd')) {
    const ranges = scanZstdFrames(raw)
    const parts = []
    for (const r of ranges) {
      try { parts.push(zstdDecompressSync(raw.subarray(r.start, r.end)).toString('utf8')) }
      catch { break } // unreadable frame: keep the decodable prefix
    }
    raw = Buffer.from(parts.join(''), 'utf8')
  }
  const rowTypes = []
  let total = 0
  let assistant = 0
  for (const line of raw.toString('utf8').split('\n')) {
    if (line.length === 0) continue
    total += 1
    try {
      const row = JSON.parse(line)
      const role = row?.role ?? row?.type ?? row?.message?.role
      rowTypes.push(String(role ?? '?'))
      // v4 event rows: the assistant turn row is type `assistant/message`
      // (legacy role rows were `assistant`).
      if (role === 'assistant' || role === 'assistant/message') assistant += 1
    } catch { rowTypes.push('!') }
  }
  return { rows: total, assistant, rowTypes }
}
function countAssistantRows(path) {
  return readSessionLogRows(path)
}

// ── the main scripted flow ──────────────────────────────────────────────────
/**
 * Boot one host instance and wait for the full readiness gate:
 *   1. the boot marker line (plugin tree loaded);
 *   2. cookie auth;
 *   3. p6t6 health ok + the expectLiveRoot live (the production bootstrap,
 *      including the boot-root create/resume, is complete);
 *   4. the fence probe health 200 (the passive observer row loaded);
 *   5. optional SETTLE: when `settleFor` lists session ids, wait until the
 *      probe event log is QUIET for those ids (3 s no-new-events) — the
 *      stock host's boot-time re-adoption of previously-live sessions
 *      (source=resume) fires AFTER the row applies and, for Team-owned
 *      sessions, is intercepted by the production fence (created →
 *      exact-generation disposed → api-session/error). The scenarios must
 *      not race that sequence; the settle-wait bounds it (120 s) and
 *      returns the settled event list for the assertions.
 */
async function runBoot({ bootNo, phase, instanceLog, tag, detached = false, expectLiveRoot = BOOT_ROOT, settleFor = [] }) {
  writePatchFile(phase, bootNo)
  writeDirective(bootNo, phase)
  // Fresh per-boot probe event dir (per-boot clean boundary; the probe
  // appends to <reportDir>/fence-probe-events.jsonl).
  rmSync(join(EVIDENCE_DIR, `boot-${bootNo}`, 'probe-events'), { recursive: true, force: true })
  const { child, alive } = spawnHost({ port: HOST_PORT, logPath: instanceLog, detached })
  const bootLine = await waitForLogLine(instanceLog, BOOT_MARKER, 300_000, alive)
  if (bootLine === null) {
    stopHost(child)
    die(`boot ${bootNo} failed: no boot marker within 300s\n--- log tail ---\n${logTail(instanceLog)}`)
    return null
  }
  const m = BOOT_MARKER.exec(bootLine)
  const origin = `http://127.0.0.1:${m[1]}`
  writeEvidence(tag, `boot-${bootNo}-marker.txt`, bootLine + '\n')
  const token = m[0].split('token=')[1]
  const cookie = await authenticate(origin, token).catch((e) => {
    stopHost(child)
    die(`boot ${bootNo} auth failed: ${e.message}`)
    return null
  })
  if (cookie === null) return null
  // Row readiness: p6t6 health (the latched setupError gate) + fence probe
  // health + the boot root live on the Team surface (bootstrap, including
  // the boot-root resume/creation, is complete).
  const deadline = Date.now() + 240_000
  let health = null
  for (;;) {
    health = await fetchJson(`${origin}/__p6t6/health`, undefined, 15_000)
    const ok = health.status === 200 && health.body?.ok === true
    const rootLive = Array.isArray(health.body?.liveSessions) && health.body.liveSessions.includes(expectLiveRoot)
    if (ok && rootLive) break
    if (health.status === 200 && health.body?.ok === false && health.body?.setupError !== undefined) {
      stopHost(child)
      die(`boot ${bootNo} row setup failed — setupError: ${String(health.body.setupError).slice(0, 600)}\n--- log tail ---\n${logTail(instanceLog)}`)
      return null
    }
    if (!alive()) break
    if (Date.now() >= deadline) {
      stopHost(child)
      die(`boot ${bootNo}: p6t6 health / boot root never live within 240s (last health: ${JSON.stringify(health.body ?? {}).slice(0, 300)})\n--- log tail ---\n${logTail(instanceLog)}`)
      return null
    }
    await sleep(500)
  }
  const fence = await fenceHealth(origin)
  if (fence.status !== 200 || fence.body?.ok !== true) {
    stopHost(child)
    die(`boot ${bootNo}: fence probe health failed: ${JSON.stringify(fence).slice(0, 300)}`)
    return null
  }
  check(tag, `boot ${bootNo} up (marker + auth + p6t6 ok + boot root live + fence probe ok, world=${WORLD} phase=${phase})`, true, `${origin} liveSessions=${JSON.stringify(health.body.liveSessions)}`)
  // Step 5: settle the boot-time re-adoption sequence for the listed ids.
  let settleEvents = []
  if (settleFor.length > 0) {
    const deadline = Date.now() + 120_000
    let lastCount = -1
    let stableSince = 0
    for (;;) {
      const evs = await fenceEvents(origin).catch(() => [])
      const n = evs.filter((e) => settleFor.includes(e.sessionId)).length
      if (n === lastCount) {
        if (stableSince === 0) stableSince = Date.now()
        else if (Date.now() - stableSince >= 3_000) break
      } else { lastCount = n; stableSince = 0 }
      if (Date.now() >= deadline) break
      await sleep(500)
    }
    settleEvents = await fenceEvents(origin).catch(() => [])
    writeEvidence(tag, `boot-${bootNo}-settle-events.json`, { settleFor, events: settleEvents })
  }
  return { origin, cookie, child, alive, instanceLog, settleEvents }
}

async function bootWorldAndInstall() {
  // Each world gets a FRESH timestamped home (applyWorld); the reuse guard
  // below only matters for an interrupted run re-entering the same world
  // within the same stamp second (crashed boot 1 leaves a stamped
  // team_domain, which a bootPhase 'create' boot then rejects).
  let installed = false
  try {
    const pk = JSON.parse(readFileSync(join(PROFILE_DIR, 'package.json'), 'utf8'))
    installed = Array.isArray(pk?.dsh?.profile?.bundles) && pk.dsh.profile.bundles.includes('dsh-agent-team')
  } catch { /* fresh world */ }
  const domainStamped = existsSync(join(HOME, 'storages', 'team_domain.json'))
  if (installed && !domainStamped) {
    log(`reusing installed, domain-unstamped world: ${HOME}`)
    return
  }
  rmSync(HOME, { recursive: true, force: true })
  mkdirSync(WORKSPACE, { recursive: true })
  mkdirSync(join(WORKSPACE, 'team'), { recursive: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  mkdirSync(SPILL_ROOT, { recursive: true })
  mkdirSync(XDG, { recursive: true })
  writeFileSync(probeTeamFile(), PROBE_TEAM_CONTENT + '\n')
  writeFileSync(join(BLUEPRINT_DIR, 'rst017c4-main.yaml'), mainBlueprintYaml())
  writeEvidence('world', 'materialized.json', { home: HOME, workspace: WORKSPACE, blueprintDir: BLUEPRINT_DIR, stamp: RUN_STAMP, world: WORLD })
  log(`world ${WORLD} materialized: ${HOME}`)

  rmSync(REPO_GIT, { recursive: true, force: true })
  const clone = spawnSync('git', ['clone', '--bare', '--branch', BRANCH, MAIN_REPO, REPO_GIT], { encoding: 'utf8', timeout: 120_000 })
  if (clone.status !== 0) die(`git clone --bare failed: ${String(clone.stderr ?? clone.stdout).slice(0, 400)}`)
  const clonedSha = spawnSync('git', ['--git-dir', REPO_GIT, 'rev-parse', `refs/heads/${BRANCH}`], { encoding: 'utf8' }).stdout.trim()
  const shaOk = check('install', `S0 bare-clone tip == ${EXPECTED_BRANCH_SHA} (the accepted Commit-4 fix build with committed dist/composition)`, clonedSha === EXPECTED_BRANCH_SHA, `cloned=${clonedSha}`)
  if (!shaOk) {
    die(`bare-clone tip mismatch: refusing to boot a world with the wrong plugin build (cloned=${clonedSha})`)
    return
  }
  const env = {
    ...process.env,
    DSH_HOME: HOME,
    DSH_CLIENT_COMMIT_HASH: TESTUSE_PIN.slice(0, 10),
    XDG_DATA_HOME: join(XDG, 'data'),
    XDG_CACHE_HOME: join(XDG, 'cache'),
  }
  const add = spawnSync(
    process.execPath,
    [HOST_BIN, 'plugin', '--profile', 'web', 'add', `git+file://${REPO_GIT}#${BRANCH}`],
    { cwd: HOME, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 600_000, env },
  )
  const addOut = `# exit=${add.status}\n# stdout\n${add.stdout ?? ''}\n# stderr\n${add.stderr ?? ''}\n`
  writeEvidence('install', 'add.log', addOut)
  const all = `${add.stdout ?? ''}\n${add.stderr ?? ''}`
  check('install', 'S1 `dsh plugin add` exits 0 (0.1.7 compat gate passes on the declared peer)', add.status === 0, `exit=${add.status}`)
  check('install', 'S1 no 0.1.7 incompat / allow-version exemption line', !/incompatible|allow-version/i.test(all), '')
  check('install', 'S1 no ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED', !/ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED/.test(all), '')
  if (fatal !== null) return

  let profilePkg = null
  try { profilePkg = JSON.parse(readFileSync(join(PROFILE_DIR, 'package.json'), 'utf8')) } catch { /* not yet */ }
  const bundles = profilePkg?.dsh?.profile?.bundles ?? []
  check('install', 'S2 dsh.profile.bundles auto-contains dsh-agent-team (CLI reconcile)', bundles.includes('dsh-agent-team'), `bundles=${JSON.stringify(bundles)}`)
  const inst = join(PROFILE_DIR, 'node_modules', 'dsh-agent-team')
  const artifacts = [
    'packages/runtime/dist/packages/runtime/src/plugin/host.js',
    'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs',
    'cordis.patch.yml',
  ]
  const missing = artifacts.filter((a) => !existsSync(join(inst, a)))
  check('install', 'S3 installed package dir carries the committed install surface', missing.length === 0, missing.length === 0 ? 'all present' : `missing=${JSON.stringify(missing)}`)
}

/**
 * Wait until the mock request log carries a request (received at/after
 * `sinceAt`) whose last user text includes `needle`.
 */
/**
 * @param {string} needle — required substring in a user message.
 * @param {string|null} sinceAt — optional ISO lower bound on receivedAt.
 *   CAUTION: a turn driven by an awaited remote call (e.g. team.create's
 *   initialWork) makes its model request BEFORE the call's HTTP response —
 *   do not filter with the post-response timestamp for such turns.
 * @param {string} userTextStartsWith — optional raw user-text prefix; pins
 *   the leader's turn request and excludes the session title-generation
 *   request, which embeds the same human text JSON-wrapped (run 6: the
 *   title request carried the needle and 0 tools).
 */
async function waitForMockRequest(mock, needle, timeoutMs, label, sinceAt = null, userTextStartsWith = null) {
  const deadline = Date.now() + timeoutMs
  const matches = () => mock.requests.find((r) => {
    if (sinceAt !== null && (r.receivedAt ?? '') < sinceAt) return false
    const body = r.body
    const msgs = body?.messages ?? []
    const userTexts = msgs.filter((m) => m?.role === 'user')
      .map((m) => (typeof m.content === 'string' ? m.content
        : Array.isArray(m.content) ? m.content.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join('')
        : ''))
      .filter((t) => t.length > 0)
    return userTexts.some((t) => t.includes(needle) && (userTextStartsWith === null || t.startsWith(userTextStartsWith)))
  })
  for (;;) {
    const hit = matches()
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) {
      // Diagnostic dump: what the mock DID receive (root-causes missed
      // needles — run 5 saw 2 requests with no MK_DONE match).
      const dump = mock.requests.map((r) => {
        const msgs = r.body?.messages ?? []
        const userTexts = msgs.filter((m) => m?.role === 'user')
          .map((m) => (typeof m.content === 'string' ? m.content
            : Array.isArray(m.content) ? m.content.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join('')
            : ''))
          .filter((t) => t.length > 0)
        return {
          seq: r.seq, path: r.path, status: r.status, error: r.error ?? null,
          model: r.body?.model ?? null, tools: (r.body?.tools ?? []).length,
          systemHead: String(r.body?.system ?? '').slice(0, 200),
          userTextsHead: userTexts.map((t) => t.slice(0, 200)),
          userTextsTail: userTexts.map((t) => t.slice(-200)),
          receivedAt: r.receivedAt,
        }
      })
      writeEvidence('diagnostics', `mock-requests-at-timeout-${label.replace(/[^a-z0-9]+/gi, '-')}.json`, { label, needle, sinceAt, count: mock.requests.length, requests: dump })
      log(`waitForMockRequest timeout: ${label} (requests so far: ${mock.requests.length} — dumped to diagnostics/)`)
      return null
    }
    await sleep(250)
  }
}
function mockToolsOf(record) {
  const body = record.body
  return (body?.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t))
}


// ── Commit 4 observation helpers ────────────────────────────────────────────
/** The exact production C1 veto wording (Commit 2, host-side fence). */
const FENCE_VETO_WORDING = 'dsh-agent-team: intercepted foreign Agent activation for Team-managed session'

let liveHost = null
function setLive(h) { liveHost = h }

let kitTokSeq = 0
function freshKitToken() { return `c4-ktok-${RUN_STAMP.slice(-6)}-${++kitTokSeq}` }

async function p6t6Health(origin) { return fetchJson(`${origin}/__p6t6/health`, undefined, 30_000) }
async function p6t6State(origin) { return fetchJson(`${origin}/__p6t6/state`, undefined, 30_000) }
/**
 * Extract one non-leader member row (with a REAL childSessionId) from a
 * team_list_members tool response. The p6t6 /state `members` view is
 * NOT a valid source (run-3 forensics: it lists the harness row's bound
 * root team — the anchor team — and stringifies absent fields to the
 * literal "undefined"), so member identity is read back through the
 * product's own member listing tool instead.
 */
function listMemberRow(res) {
  let found = null
  const walk = (node) => {
    if (node === null || typeof node !== 'object' || found) return
    if (Array.isArray(node)) { node.forEach(walk); return }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'members' && Array.isArray(v)) {
        const row = v.find((m) => m && typeof m === 'object' && m.templateId !== 'leader'
          && typeof m.childSessionId === 'string' && m.childSessionId.startsWith('session-'))
        if (row) found = row
      }
      walk(v)
    }
  }
  walk(res)
  return found
}
async function p6t6Tool(origin, { name, as, args, tag = 'c4' }) {
  return fetchJson(`${origin}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, as, args, callId: `${tag}-${Math.random().toString(36).slice(2, 12)}` }),
  }, 120_000)
}

/** Read the per-boot probe JSONL (the passive probe appends every event). */
function readProbeJsonl(bootNo) {
  const p = join(EVIDENCE_DIR, `boot-${bootNo}`, 'probe-events', 'fence-probe-events.jsonl')
  let raw
  try { raw = readFileSync(p, 'utf8') } catch { return [] }
  return raw.split('\n').filter((l) => l.length > 0)
    .map((l) => { try { return JSON.parse(l) } catch { return null } })
    .filter((r) => r !== null)
}

function hostLogHasVetoFor(instanceLog, sessionId) {
  try {
    return readFileSync(instanceLog, 'utf8').split('\n')
      .some((l) => l.includes(FENCE_VETO_WORDING) && l.includes(sessionId))
  } catch { return false }
}
/** The production fence NEVER console-logs a runtime veto: it throws
 *  TeamSessionActivationInterceptedError through the AWAITED serial chain,
 *  the upstream rolls back the exact-generation agent (agent/disposed), and
 *  the session controller surfaces the error on the user-visible
 *  api-session/error lane — which the row-first passive probe records with
 *  the full message. The EXACT production wording must appear THERE (the
 *  round-1 boot-time bootstrap failure was a different path: the plugin
 *  boot FATAL logs to the host console). Channel correction, not a
 *  weakening: the exact wording is still mandatory, on the lane the
 *  product actually provides (see run-3 world A: A4b/A4c green, host log
 *  contains no veto line at all — fence source has zero log calls). */
function vetoWordingInEvents(events, sessionId) {
  return events.some((e) => e.kind === 'api-session/error' && e.sessionId === sessionId && String(e.message ?? '').includes(FENCE_VETO_WORDING))
}
function hostLogHasFor(instanceLog, needle, sessionId) {
  try {
    return readFileSync(instanceLog, 'utf8').split('\n')
      .some((l) => l.includes(needle) && l.includes(sessionId))
  } catch { return false }
}

/**
 * Quiesce the probe event log for one session: 3 s of no new events (or the
 * deadline). The scenarios must not race the boot-time re-adoption / veto /
 * rollback sequence.
 */
async function settleProbe(origin, sessionId, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let lastCount = -1
  let stableSince = 0
  for (;;) {
    const evs = await fenceEvents(origin).catch(() => [])
    const n = evs.filter((e) => e.sessionId === sessionId).length
    if (n === lastCount) {
      if (stableSince === 0) stableSince = Date.now()
      else if (Date.now() - stableSince >= 3_000) break
    } else { lastCount = n; stableSince = 0 }
    if (Date.now() >= deadline) break
    await sleep(500)
  }
}

/** Compact evidence summary of one mock request. */
function mockSummary(record) {
  if (record === null) return { absent: true }
  const body = record.body ?? {}
  const sys = typeof body.system === 'string' ? body.system : JSON.stringify(body.system ?? null)
  return {
    seq: record.seq,
    model: body.model,
    tools: (body.tools ?? []).map((t) => t?.function?.name ?? t?.name ?? String(t)),
    systemHead: String(sys).slice(0, 600),
  }
}

/** Minimal home snapshot before removal (TEST_METHODS §7 evidence). */
function snapshotHome() {
  const snap = join(EVIDENCE_DIR, 'home-snapshot')
  mkdirSync(snap, { recursive: true })
  const copy = (src, dst) => {
    try {
      if (existsSync(src)) {
        mkdirSync(dirname(dst), { recursive: true })
        copyFileSync(src, dst)
      }
    } catch (e) { log(`snapshot copy skipped: ${src} (${e.message})`) }
  }
  copy(join(HOME, 'storages', 'team_domain.json'), join(snap, 'team_domain.json'))
  copy(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), join(snap, 'cordis.patch.yml'))
  copy(join(HOME, 'p6t6-directive.json'), join(snap, 'p6t6-directive.json'))
  const seen = new Set()
  for (const sid of [BOOT_ROOT, DYN_ROOT, ORD_SESSION]) {
    for (const p of findSessionLogs(HOME, sid)) {
      if (seen.has(p)) continue
      seen.add(p)
      copy(p, join(snap, 'sessions', `${sid}-${p.split('/').pop()}`))
    }
  }
  // Member child session logs (World B): scan the sessions root for any
  // session dir that is not one of the known ids.
  const sessionsRoot = join(HOME, 'sessions')
  try {
    for (const profile of readdirSync(sessionsRoot, { withFileTypes: true })) {
      if (!profile.isDirectory()) continue
      const pdir = join(sessionsRoot, profile.name)
      for (const s of readdirSync(pdir, { withFileTypes: true })) {
        if (!s.isDirectory()) continue
        if (s.name === BOOT_ROOT || s.name === DYN_ROOT || s.name === ORD_SESSION) continue
        for (const f of readdirSync(join(pdir, s.name))) {
          copy(join(pdir, s.name, f), join(snap, 'sessions', `member-${s.name}-${f}`))
        }
      }
    }
  } catch { /* fresh home may have no sessions root */ }
}

// ── world runner (one host at a time; self-teardown per world) ─────────────
async function runWorld(letter) {
  applyWorld(letter)
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  worldMock.state = { memberInstanceId: null }
  const mock = await startMockModel()
  const startIdx = results.length
  log(`══ WORLD ${letter} — home ${HOME} ══`)
  try {
    await bootWorldAndInstall()
    if (fatal !== null) return { startIdx }
    if (letter === 'A') await worldA(mock)
    else if (letter === 'B') await worldB(mock)
    else if (letter === 'C') await worldC(mock)
    else if (letter === 'D') await worldD(mock)
    else if (letter === 'E') await worldE(mock)
  } catch (e) {
    const msg = String(e?.message ?? e)
    log(`UNEXPECTED ERROR in world ${letter}: ${msg}`)
    if (e?.stack) log(String(e.stack).split('\n').slice(1, 8).join('\n'))
    if (liveHost !== null) {
      try { writeEvidence('diagnostics', `world-${letter}-error-instance-tail.log`, logTail(liveHost.instanceLog, 80)) } catch { /* best-effort */ }
      stopHost(liveHost.child)
      await waitForPortFree(HOST_PORT).catch(() => {})
      liveHost = null
    }
    die(`world ${letter} unexpected error: ${msg}`)
  } finally {
    if (liveHost !== null) {
      stopHost(liveHost.child)
      await waitForPortFree(HOST_PORT).catch(() => {})
      liveHost = null
    }
    await mock.close()
    log(`world ${letter} torn down (host SIGTERM'd, mock closed)`)
  }
  const worldFailed = results.slice(startIdx).some((r) => !r.ok)
  const keep = KEEP_HOME || letter === 'A' || letter === 'E' || worldFailed
  if (keep) {
    writeEvidence('home', 'home-retained.json', {
      home: HOME,
      reason: worldFailed
        ? 'world had FAIL checks — retained for diagnosis'
        : (letter === 'A' || letter === 'E' ? `key world ${letter} retained` : '--keep-home'),
    })
  } else {
    snapshotHome()
    rmSync(HOME, { recursive: true, force: true })
    writeEvidence('home', 'home-removed.json', { home: HOME, reason: 'world fully passed; minimal home snapshot in home-snapshot/' })
  }
  return { startIdx, worldFailed }
}

// ── WORLD A — dynamic Team root (guide §13.6) ──────────────────────────────
async function worldA(mock) {
  // ── boot 1 (create): the dynamic team does real work ──
  const i1 = writeEvidence('boot-1', 'instance.log', '')
  const boot1 = await runBoot({ bootNo: 1, phase: 'create', instanceLog: i1, tag: 'boot-1' })
  if (boot1 === null) return
  setLive(boot1)
  const { origin: o1, cookie: c1 } = boot1
  const createRes = await remoteCall(o1, c1, 'team.create', {
    rootSessionId: DYN_ROOT,
    blueprintId: BP_MAIN_ID,
    initialWork: { prompt: `Commit 4 dynamic team created. Acknowledge with the token ${MK_DONE} and stop.` },
  }, 'c4-createA', 1)
  writeEvidence('boot-1', 'team-create-response.json', createRes)
  if (!check('A', 'A1 team.create(dynamic root) accepted over the public remote seam (RPC ok:true — transport 200 alone is not success)', createRes.status === 200 && createRes.body?.type === 'server-response' && createRes.body?.result?.ok === true, `status=${createRes.status} head=${JSON.stringify(createRes.body ?? {}).slice(0, 200)}`)) {
    stopHost(boot1.child); setLive(null); await waitForPortFree(HOST_PORT)
    return
  }
  const dynFirst = await waitForMockRequest(mock, MK_DONE, 180_000, 'A2 dyn leader first turn', null, '[team-root-work')
  writeEvidence('boot-1', 'dyn-leader-first-request.json', mockSummary(dynFirst))
  check('A', 'A2 dynamic leader live on boot 1 (first model request on the row staticModel)', dynFirst !== null && dynFirst.body?.model === MODEL_ID, `seq=${dynFirst?.seq} model=${dynFirst?.body?.model}`)
  const hist1 = findSessionLogs(HOME, DYN_ROOT).map((p) => ({ path: p, ...countAssistantRows(p) }))
  writeEvidence('boot-1', 'dyn-session-log-after-boot1.json', hist1)
  check('A', 'A2b boot-1 session history present (assistant rows ≥ 1 in the session log)', hist1.some((h) => h.assistant >= 1), JSON.stringify(hist1))
  stopHost(boot1.child); setLive(null); await waitForPortFree(HOST_PORT)
  log('A: boot 1 stopped (SIGTERM)')

  // ── boot 2 (resume): the cold dynamic root + the fence ──
  const t2 = new Date().toISOString()
  const i2 = writeEvidence('boot-2', 'instance.log', '')
  const boot2 = await runBoot({ bootNo: 2, phase: 'resume', instanceLog: i2, tag: 'boot-2', settleFor: [DYN_ROOT] })
  if (boot2 === null) return
  setLive(boot2)
  const { origin: o2, cookie: c2 } = boot2

  if (BROWSER_HOLD) {
    await worldABrowserLeg(boot2, i2, t2, mock)
  } else {
    await worldAWireLeg(boot2, i2, t2, mock, hist1)
  }
  stopHost(boot2.child); setLive(null); await waitForPortFree(HOST_PORT)
  log('A: boot 2 stopped (SIGTERM)')
}

/** The wire-level World A leg: browser-style follow → production veto →
 *  Team takeover → the 13-item §13.6 assertion list → gate-5 wire. */
async function worldAWireLeg(boot2, i2, t2, mock, hist1) {
  const { origin: o2, cookie: c2 } = boot2
  // A3 — browser-style session/follow over the stream carrier (snapshot
  // yielded first; the background promote is then vetoed in production).
  const wsA = await openMux(o2, c2, 'worldA-follow')
  const evAId = await openEventsStream(wsA)
  const followA = await followSession(wsA, DYN_ROOT).catch((e) => ({ error: String(e?.message ?? e) }))
  writeEvidence('boot-2', 'follow-dyn-root.json', followA.error !== undefined ? { error: followA.error } : { snapshotType: followA.snapshot?.type })
  check('A', 'A3 browser-style session/follow(dynamic root) yields the snapshot (the browser got in)', followA.error === undefined, JSON.stringify(followA.error ?? '').slice(0, 200))
  const vetoFrameA = await waitForEventFrame(wsA, evAId, (v) => v.event === 'api-session/error' && Array.isArray(v.args) && v.args[0] === DYN_ROOT, 45_000)
  await settleProbe(o2, DYN_ROOT, 60_000)
  dumpWsTraces('boot-2')
  // A4 — the production fence veto (multi-channel evidence).
  const ev2 = readProbeJsonl(2)
  writeEvidence('boot-2', 'probe-events-after-follow.json', ev2)
  const createdA = ev2.filter((e) => e.kind === 'agent/created' && e.sessionId === DYN_ROOT)
  const disposedA = ev2.filter((e) => e.kind === 'agent/disposed' && e.sessionId === DYN_ROOT)
  const apiErrA = ev2.filter((e) => e.kind === 'api-session/error' && e.sessionId === DYN_ROOT)
  check('A', 'A4 the production fence veto fired (EXACT production wording on the user-visible api-session/error lane — the fence throws, it never console-logs runtime vetoes)', vetoWordingInEvents(ev2, DYN_ROOT) || hostLogHasVetoFor(i2, DYN_ROOT), `created=${createdA.length} disposed=${disposedA.length} apiErr=${apiErrA.length}`)
  check('A', 'A4b exact-generation rollback: a disposed event follows the vetoed creation', createdA.length >= 1 && disposedA.length >= 1, `created=${createdA.map((e) => e.source)} disposed=${disposedA.length}`)
  check('A', 'A4c api-session/error surfaced to the follow socket (the persistent user-visible error lane)', vetoFrameA !== null || apiErrA.length >= 1, `frame=${vetoFrameA !== null ? JSON.stringify(vetoFrameA.value?.args ?? vetoFrameA.value).slice(0, 200) : 'null'} probeErr=${apiErrA.map((e) => e.message).join(' | ').slice(0, 200)}`)
  check('A', 'A5 the follow stream SURVIVES the rejection (socket still open after the error lane)', wsA.closed === false, `closed=${wsA.closed}`)
  wsA.close()
  const mockAtVeto = mock.requests.length
  writeEvidence('boot-2', 'q1-mock-at-veto.json', { count: mockAtVeto })
  // A6 — the Team takeover.
  const ensureA = await remoteCall(o2, c2, 'team.ensureRootLive', { teamSessionId: DYN_ROOT }, 'c4-ensureA', 3)
  writeEvidence('boot-2', 'ensure-root-live.json', ensureA)
  const ensureAJ = JSON.stringify(ensureA.body ?? {})
  const ensureOk = ensureA.status === 200 && ensureAJ.includes('"ok":true') && ensureAJ.includes('"live":true')
  check('A', 'A6 team.ensureRootLive(dynamic root) SUCCEEDS (the C1 repair path)', ensureOk, `status=${ensureA.status} head=${ensureAJ.slice(0, 300)}`)
  if (!ensureOk) return
  await settleProbe(o2, DYN_ROOT, 60_000)
  // gate-5 (wire minimum): WITHOUT any reload, prompt the leader directly
  // after the takeover (the composer wire equivalent) → model answer.
  const g5 = await apiPrompt(o2, c2, DYN_ROOT, `${MK_G5} Gate-5 composer check right after the Team takeover. Answer with the token ${MK_G5} and stop.`, 'c4-g5')
  writeEvidence('boot-2', 'gate5-prompt-response.json', g5)
  const g5req = await waitForMockRequest(mock, MK_G5, 180_000, 'A gate-5 prompt', t2)
  writeEvidence('boot-2', 'gate5-request.json', mockSummary(g5req))
  check('A', 'gate-5 wire: the prompt sent DIRECTLY after the takeover (no reload) gets a model answer', g5req !== null && mock.requests.length > mockAtVeto, `reqSeq=${g5req?.seq}`)
  // ── the 13-item §13.6 assertion list (the resumed leader surface) ──
  const healthA = await p6t6Health(o2)
  const stateA = await p6t6State(o2)
  writeEvidence('boot-2', 'p6t6-state-after-ensure.json', stateA.body ?? null)
  const liveA = Array.isArray(healthA.body?.liveSessions) ? healthA.body.liveSessions : []
  const evF = readProbeJsonl(2)
  writeEvidence('boot-2', 'probe-events-final.json', evF)
  const createdF = evF.filter((e) => e.kind === 'agent/created' && e.sessionId === DYN_ROOT)
  const disposedF = evF.filter((e) => e.kind === 'agent/disposed' && e.sessionId === DYN_ROOT)
  const apiErrF = evF.filter((e) => e.kind === 'api-session/error' && e.sessionId === DYN_ROOT)
  const lastCreated = createdF[createdF.length - 1]
  const errAfterLast = lastCreated ? apiErrF.filter((e) => e.t > lastCreated.t) : apiErrF
  check('A', 'A7(1) no final session/writer-held in the takeover result', !/writer-held|SessionAlreadyOwned|already owned by an active write handle/.test(ensureAJ), ensureAJ.slice(0, 200))
  check('A', 'A7(2) same rootSessionId (the takeover resolved the SAME dynamic root)', ensureAJ.includes(`"rootSessionId":"${DYN_ROOT}"`), ensureAJ.slice(0, 200))
  check('A', 'A7(3) ctx.agents: exactly one live Agent for the root (glue liveAgents carries it, no duplicates)', liveA.filter((s) => s === DYN_ROOT).length === 1, `liveSessions=${JSON.stringify(liveA)}`)
  check('A', 'A7(4) the Team glue hasLive(root) == true', liveA.includes(DYN_ROOT), JSON.stringify(liveA))
  check('A', 'A7(5) the live Agent is the Team-owned handle (exactly one surviving creation; no api-error after the surviving created)', createdF.length - disposedF.length === 1 && errAfterLast.length === 0, `created=${createdF.length} disposed=${disposedF.length} errAfterLast=${errAfterLast.length}`)
  const g5tools = g5req ? mockToolsOf(g5req) : []
  check('A', 'A7(6) ALL of the frozen 13 team_* tools present on the resumed leader surface', TEAM_TOOL_CATALOG.every((t) => g5tools.includes(t)), `missing=${JSON.stringify(TEAM_TOOL_CATALOG.filter((t) => !g5tools.includes(t)))}`)
  check('A', 'A7(7) the Team root persona/context block present (the dynamic team persona in the system block)', String(g5req?.body?.system ?? '').includes(P_DYN), 'system head: ' + String(g5req?.body?.system ?? '').slice(0, 160))
  const tlm = await p6t6Tool(o2, { name: 'team_list_members', as: DYN_ROOT, args: { rootSessionId: DYN_ROOT, requestToken: freshKitToken() }, tag: 'c4-tlm' })
  writeEvidence('boot-2', 'team-list-members.json', tlm.body ?? null)
  check('A', 'A7(8) team_list_members executed successfully on the resumed leader (REAL execution, not just mounted)', tlm.status === 200 && JSON.stringify(tlm.body ?? {}).includes('"ok":true'), JSON.stringify(tlm.body ?? {}).slice(0, 300))
  const hist2 = findSessionLogs(HOME, DYN_ROOT).map((p) => ({ path: p, ...countAssistantRows(p) }))
  writeEvidence('boot-2', 'dyn-session-log-after-resume.json', hist2)
  const rowsBefore = hist1.reduce((s, h) => s + h.rows, 0)
  const rowsAfter = hist2.reduce((s, h) => s + h.rows, 0)
  check('A', 'A7(9) history intact (session log rows present after restart; assistant rows ≥ boot-1 count)', rowsAfter >= rowsBefore && rowsAfter > 0, `before=${rowsBefore} after=${rowsAfter}`)
  check('A', 'A7(10) the first Team request after resume uses the Team model selection (row staticModel)', g5req?.body?.model === MODEL_ID, `model=${g5req?.body?.model}`)
  const g5count = mock.requests.filter((r) => {
    const msgs = r.body?.messages ?? []
    return msgs.some((m) => m?.role === 'user' && typeof m.content === 'string' && m.content.includes(MK_G5))
      || msgs.some((m) => Array.isArray(m.content) && m.content.some((b) => b?.type === 'text' && typeof b.text === 'string' && b.text.includes(MK_G5)))
  }).length
  check('A', 'A7(11) no duplicate model-selection listener side effect (exactly one model request for the gate-5 prompt)', g5count === 1, `count=${g5count}`)
  const gses = stateA.body?.governance?.sessions ?? {}
  const dynGov = gses[DYN_ROOT]
  const mcpServers = dynGov?.mcp?.servers
  check('A', 'A7(12) no MCP double mount (zero-MCP row: no server entries, no activationError in the session governance view)', (mcpServers === undefined || Object.keys(mcpServers).length === 0) && !JSON.stringify(dynGov ?? {}).includes('activationError'), `mcp=${JSON.stringify(mcpServers ?? null)} dynGov head=${JSON.stringify(dynGov ?? {}).slice(0, 200)}`)
  check('A', 'A7(13) sessionPersistence.stat(root) present (wire-level equivalent: the durable session generation file exists and its content is readable — NOT the filename as a product criterion)', hist2.length >= 1 && rowsAfter > 0, JSON.stringify(hist2.map((h) => h.path.split('/').pop())))
  check('A', 'A7q1 no model request came from a vetoed foreign agent (across the veto→takeover window the mock count rose by exactly the one gate-5 request)', mock.requests.length === mockAtVeto + 1, `count=${mock.requests.length} atVeto=${mockAtVeto}`)
}

/** The browser gold-standard World A leg (external browser does the UI):
 *  the kit holds boot 2, prints the marker URL + PID, and auto-releases the
 *  hold the moment the gate-5 prompt reaches the mock model — collecting +
 *  asserting the browser-triggered veto → 以 Team 模式 打开 →
 *  composer-usable (no page reload) evidence.
 *
 *  NOTE (run-5 post-mortem): the original release path was `kill -TERM
 *  <kitPid>`, but the job harness's kill tears down the whole PID-namespace
 *  process group without letting the kit's SIGTERM handler run the
 *  finalization block (run 5's log ends at the HOLD line; no A-browser
 *  checks recorded). Self-release on the observed gate-5 request makes the
 *  leg fully self-contained; job_kill remains only the failure backstop. */
const BROWSER_HOLD_TIMEOUT_MS = 45 * 60_000
async function worldABrowserLeg(boot2, i2, t2, mock) {
  const { origin: o2 } = boot2
  const holdAt = new Date().toISOString()
  writeEvidence('boot-2', 'browser-hold.json', {
    note: 'World A BROWSER gold-standard gate-5. Steps: (1) open the marker URL (boot-2/boot-2-marker.txt) in a browser tab; (2) open the cold dynamic session in the session list — the fence vetoes the ordinary open (会话不可用 error lane; screenshot); (3) click 以 Team 模式 打开 (Team-mode takeover); (4) WITHOUT reloading the page: the composer must be usable — type the prompt containing the gate-5 token below and send it (the leader must answer; screenshot). The kit AUTO-RELEASES the hold when the gate-5 prompt reaches the mock model (no external signal needed; job_kill only as the failure backstop).',
    kitPid: process.pid,
    gui: o2,
    dynamicRoot: DYN_ROOT,
    gate5Prompt: `Gate-5 composer check right after the Team takeover. Answer with the token ${MK_G5} and stop.`,
  })
  log(`A BROWSER HOLD: boot 2 alive at ${o2}. Kit PID ${process.pid} — hold auto-releases when the gate-5 prompt reaches the mock model (backstop: job_kill).`)
  // Hold boot 2 alive until the browser's gate-5 prompt reaches the model.
  // userTextStartsWith pins the composer turn request and excludes any
  // title-generation request that could embed the same text JSON-wrapped.
  const g5req = await waitForMockRequest(mock, MK_G5, BROWSER_HOLD_TIMEOUT_MS, 'A browser composer prompt', t2, 'Gate-5 composer check')
  log(`A: hold released (gate-5 request observed${g5req === null ? ' — TIMEOUT' : ''}) — collecting browser-leg evidence`)
  const evB = readProbeJsonl(2)
  writeEvidence('boot-2', 'probe-events-browser.json', evB)
  const after = evB.filter((e) => e.t > holdAt)
  const browserVeto = after.filter((e) => e.kind === 'agent/created' && e.sessionId === DYN_ROOT)
  const browserDisposed = after.filter((e) => e.kind === 'agent/disposed' && e.sessionId === DYN_ROOT)
  const browserErr = after.filter((e) => e.kind === 'api-session/error' && e.sessionId === DYN_ROOT)
  writeEvidence('boot-2', 'browser-leg-events.json', { created: browserVeto, disposed: browserDisposed, errors: browserErr })
  check('A-browser', 'the UI-triggered ordinary open was vetoed by the production fence (created → exact-generation disposed → api-session/error)', browserVeto.length >= 1 && browserDisposed.length >= 1 && browserErr.length >= 1, `created=${browserVeto.length} disposed=${browserDisposed.length} err=${browserErr.length}`)
  check('A-browser', 'the production veto wording on the user-visible lane (browser leg — the fence throws, it never console-logs runtime vetoes)', vetoWordingInEvents(after, DYN_ROOT) || hostLogHasVetoFor(i2, DYN_ROOT), '')
  const healthB = await p6t6Health(o2)
  const liveB = Array.isArray(healthB.body?.liveSessions) ? healthB.body.liveSessions : []
  check('A-browser', 'the 以 Team 模式 打开 click took over (glue hasLive(root) == true after the UI takeover)', liveB.includes(DYN_ROOT), JSON.stringify(liveB))
  writeEvidence('boot-2', 'browser-gate5-request.json', g5req === null ? null : mockSummary(g5req))
  check('A-browser', 'gate-5 gold standard: the composer was usable after the takeover WITHOUT a page reload (the typed prompt reached the model and got an answer)', g5req !== null, `seq=${g5req?.seq}`)
  if (g5req !== null) {
    const t = mockToolsOf(g5req)
    check('A-browser', 'the composer prompt ran on the Team leader surface (13 team_* tools + row staticModel)', TEAM_TOOL_CATALOG.every((x) => t.includes(x)) && g5req.body?.model === MODEL_ID, `model=${g5req.body?.model}`)
  }
}

// ── WORLD B — dynamic member child (guide §13.6) ───────────────────────────
async function worldB(mock) {
  // ── boot 1 (create): team + member do real work ──
  const i1 = writeEvidence('boot-1', 'instance.log', '')
  const boot1 = await runBoot({ bootNo: 1, phase: 'create', instanceLog: i1, tag: 'boot-1' })
  if (boot1 === null) return
  setLive(boot1)
  const { origin: o1, cookie: c1 } = boot1
  const createRes = await remoteCall(o1, c1, 'team.create', {
    rootSessionId: DYN_ROOT,
    blueprintId: BP_MAIN_ID,
    initialWork: { prompt: `Commit 4 member-world team created. Acknowledge with the token ${MK_DONE} and stop.` },
  }, 'c4-createB', 1)
  writeEvidence('boot-1', 'team-create-response.json', createRes)
  if (!check('B', 'B1 team.create accepted (RPC ok:true — the leader works)', createRes.status === 200 && createRes.body?.type === 'server-response' && createRes.body?.result?.ok === true, `status=${createRes.status} head=${JSON.stringify(createRes.body ?? {}).slice(0, 200)}`)) {
    stopHost(boot1.child); setLive(null); await waitForPortFree(HOST_PORT)
    return
  }
  const dynFirst = await waitForMockRequest(mock, MK_DONE, 180_000, 'B1b dyn leader first turn', null, '[team-root-work')
  check('B', 'B1b dynamic leader live (first model request on the row staticModel)', dynFirst !== null && dynFirst.body?.model === MODEL_ID, `seq=${dynFirst?.seq}`)
  // The team-up turn: the leader creates the worker member + delegates the
  // verification task (the mock scripts team_create_member → team_delegate).
  await apiPrompt(o1, c1, DYN_ROOT, `${MK_TEAMUP} Set up the team: create the worker member (template 'worker') and delegate the verification task to it.`, 'c4-teamup')
  const bm1 = await waitForMockRequest(mock, MK_BMEM, 180_000, 'B2 member first turn', null, null)
  writeEvidence('boot-1', 'member-first-request.json', mockSummary(bm1))
  check('B', 'B2 the member is live on boot 1 (delegate → member model request carrying the MEMBER context)', bm1 !== null && String(bm1.body?.system ?? '').includes(P_MEM), `seq=${bm1?.seq} system head=${String(bm1?.body?.system ?? '').slice(0, 120)}`)
  const state1 = await p6t6State(o1)
  // B3 — the durable member read-back through the product's own member
  // listing (team_list_members on the live leader via the p6t6 tool seam).
  const listB1 = await p6t6Tool(o1, {
    name: 'team_list_members',
    as: DYN_ROOT,
    args: { rootSessionId: DYN_ROOT, requestToken: freshKitToken() },
    tag: 'c4-listB1',
  })
  writeEvidence('boot-1', 'team-list-members-boot1.json', listB1.body ?? null)
  const memRow1 = listMemberRow(listB1.body)
  const MEMBER_SID = memRow1?.childSessionId ?? null
  writeEvidence('boot-1', 'member-identity.json', {
    memberInstanceId: worldMock.state.memberInstanceId,
    memberChildSessionIdFromCreate: worldMock.state.memberChildSessionId ?? null,
    childSessionId: MEMBER_SID,
    listMembersRow: memRow1 ?? null,
    state1MembersEvidenceOnly: state1.body?.members ?? null,
  })
  if (!check('B', 'B3 the member child session is bound durably (member row with childSessionId read back)', MEMBER_SID !== null && (worldMock.state.memberChildSessionId === null || worldMock.state.memberChildSessionId === undefined || MEMBER_SID === worldMock.state.memberChildSessionId), JSON.stringify(memRow1 ?? null).slice(0, 300))) {
    stopHost(boot1.child); setLive(null); await waitForPortFree(HOST_PORT)
    return
  }
  stopHost(boot1.child); setLive(null); await waitForPortFree(HOST_PORT)
  log('B: boot 1 stopped (SIGTERM)')

  // ── boot 2 (resume): the cold member child + the fence ──
  const t2 = new Date().toISOString()
  const i2 = writeEvidence('boot-2', 'instance.log', '')
  const boot2 = await runBoot({ bootNo: 2, phase: 'resume', instanceLog: i2, tag: 'boot-2', settleFor: [DYN_ROOT, MEMBER_SID] })
  if (boot2 === null) return
  setLive(boot2)
  const { origin: o2, cookie: c2 } = boot2
  // B4 — browser-style session/follow of the MEMBER child (fenced).
  const wsB = await openMux(o2, c2, 'worldB-follow')
  await openEventsStream(wsB)
  const followB = await followSession(wsB, MEMBER_SID).catch((e) => ({ error: String(e?.message ?? e) }))
  writeEvidence('boot-2', 'follow-member.json', followB.error !== undefined ? { error: followB.error } : { snapshotType: followB.snapshot?.type })
  check('B', 'B4 browser-style session/follow(member child) yields the snapshot (the browser got in)', followB.error === undefined, JSON.stringify(followB.error ?? '').slice(0, 200))
  dumpWsTraces('boot-2')
  wsB.close()
  await settleProbe(o2, MEMBER_SID, 60_000)
  // B5 — the ordinary activation of the member child was fenced.
  const ev2 = readProbeJsonl(2)
  const memVeto = ev2.filter((e) => e.sessionId === MEMBER_SID)
  writeEvidence('boot-2', 'probe-events-member.json', memVeto)
  const memCreated = memVeto.filter((e) => e.kind === 'agent/created')
  const memDisposed = memVeto.filter((e) => e.kind === 'agent/disposed')
  const memErr = memVeto.filter((e) => e.kind === 'api-session/error')
  check('B', 'B5 the member child ordinary activation was fenced (created → disposed sequence OR the production veto wording on the user-visible lane)', (memCreated.length >= 1 && memDisposed.length >= 1) || vetoWordingInEvents(ev2, MEMBER_SID) || hostLogHasVetoFor(i2, MEMBER_SID), `created=${memCreated.length} disposed=${memDisposed.length} err=${memErr.length}`)
  // B6 — the leader takeover.
  const ensureB = await remoteCall(o2, c2, 'team.ensureRootLive', { teamSessionId: DYN_ROOT }, 'c4-ensureB', 3)
  writeEvidence('boot-2', 'ensure-root-live.json', ensureB)
  const ensureBJ = JSON.stringify(ensureB.body ?? {})
  const ensureBok = ensureB.status === 200 && ensureBJ.includes('"ok":true')
  if (!check('B', 'B6 team.ensureRootLive(leader) succeeds (the member stays cold until its own ensure)', ensureBok, `status=${ensureB.status} head=${ensureBJ.slice(0, 300)}`)) return
  // B7 — the leader's team_send_message triggers the member ensure.
  const sm = await p6t6Tool(o2, {
    name: 'team_send_message',
    as: DYN_ROOT,
    args: {
      rootSessionId: DYN_ROOT,
      requestToken: freshKitToken(),
      recipientInstanceId: worldMock.state.memberInstanceId,
      body: `${MK_BMEM2} Post-restart verification: read team/test.md and answer with its content, then stop.`,
    },
    tag: 'c4-sendB',
  })
  writeEvidence('boot-2', 'team-send-message.json', sm.body ?? null)
  if (!check('B', 'B7 leader team_send_message executed ok (REAL execution on the resumed leader)', sm.status === 200 && JSON.stringify(sm.body ?? {}).includes('"ok":true'), JSON.stringify(sm.body ?? {}).slice(0, 300))) return
  // B8 — the member cold resume → its turn.
  const bm2 = await waitForMockRequest(mock, MK_BMEM2, 180_000, 'B8 member post-restart turn', t2)
  writeEvidence('boot-2', 'member-post-restart-request.json', mockSummary(bm2))
  check('B', 'B8 the member cold resume SUCCEEDED (post-restart member model request observed)', bm2 !== null, `seq=${bm2?.seq}`)
  // ── the 7-item §13.6 member assertion list ──
  const state2 = await p6t6State(o2)
  writeEvidence('boot-2', 'p6t6-state-after-member-ensure.json', state2.body ?? null)
  const listB2 = await p6t6Tool(o2, {
    name: 'team_list_members',
    as: DYN_ROOT,
    args: { rootSessionId: DYN_ROOT, requestToken: freshKitToken() },
    tag: 'c4-listB2',
  })
  writeEvidence('boot-2', 'team-list-members-boot2.json', listB2.body ?? null)
  const memRow2 = listMemberRow(listB2.body)
  check('B', 'B9(1) role = member under the owning root (durable member row of DYN_ROOT, worker template)', memRow2 !== undefined && memRow2.templateId === 'worker', JSON.stringify({ teamSessionEvidenceOnly: state2.body?.teamSession?.rootSessionId ?? null, member: memRow2 ?? null }).slice(0, 300))
  check('B', 'B9(2) the owning root is correct (the member row is bound to the dynamic root)', memRow2?.childSessionId === MEMBER_SID, `child=${MEMBER_SID}`)
  const sys2 = String(bm2?.body?.system ?? '')
  check('B', 'B9(3) the member Team context is correct (MEMBER persona present, NO leader persona on the resumed surface)', sys2.includes(P_MEM) && !sys2.includes('You are the leader'), sys2.slice(0, 200))
  const memTools2 = bm2 ? mockToolsOf(bm2) : []
  check('B', 'B9(4) the member preset/base tools are correct (standard preset surface: read/write/bash present)', ['read', 'write', 'bash'].every((t) => memTools2.includes(t)), JSON.stringify(memTools2).slice(0, 400))
  const memTeamTools = memTools2.filter((t) => String(t).startsWith('team_'))
  check('B', 'B9(5) the Team tools surface is correct (the frozen 13-tool team catalog is fully mounted on the member session with no extras; the worker envelope is enforced at the ACTION level, not at mount time — plugin source @ f3d5a71b, kit bug #11 fix)', MEMBER_TEAM_TOOLS_ALLOW.every((t) => memTeamTools.includes(t)) && memTeamTools.length === MEMBER_TEAM_TOOLS_ALLOW.length, JSON.stringify(memTeamTools))
  const health2 = await p6t6Health(o2)
  const live2 = Array.isArray(health2.body?.liveSessions) ? health2.body.liveSessions : []
  const ev2f = readProbeJsonl(2)
  const memCreatedF = ev2f.filter((e) => e.kind === 'agent/created' && e.sessionId === MEMBER_SID)
  const memDisposedF = ev2f.filter((e) => e.kind === 'agent/disposed' && e.sessionId === MEMBER_SID)
  check('B', 'B9(6) single writer (exactly one surviving member creation; the member is live in the glue)', live2.includes(MEMBER_SID) && memCreatedF.length - memDisposedF.length === 1, `live=${JSON.stringify(live2)} created=${memCreatedF.length} disposed=${memDisposedF.length}`)
  const finalErr = `${JSON.stringify(sm.body ?? {})}.${ensureBJ}`
  check('B', 'B9(7) no OUTSIDE_TEAM / writer-held final error (the ensure + delivery chain resolved clean)', !/OUTSIDE_TEAM|writer-held|SessionAlreadyOwned|already owned by an active write handle/.test(finalErr), finalErr.slice(0, 200))
  stopHost(boot2.child); setLive(null); await waitForPortFree(HOST_PORT)
  log('B: boot 2 stopped (SIGTERM)')
}

// ── WORLD C — ordinary non-Team negative control (guide §13.6) ─────────────
async function worldC(mock) {
  // ── boot 1 (create): the ordinary (non-Team) session does work ──
  const i1 = writeEvidence('boot-1', 'instance.log', '')
  const boot1 = await runBoot({ bootNo: 1, phase: 'create', instanceLog: i1, tag: 'boot-1' })
  if (boot1 === null) return
  setLive(boot1)
  const { origin: o1, cookie: c1 } = boot1
  const createOrd = await apiCreateSession(o1, c1, ORD_SESSION, WORKSPACE)
  writeEvidence('boot-1', 'session-create-ordinary.json', createOrd.body ?? null)
  if (!check('C', 'C1 the ordinary (non-Team) session is created over the public session channel', createOrd.status === 200, `status=${createOrd.status} head=${JSON.stringify(createOrd.body ?? {}).slice(0, 200)}`)) {
    stopHost(boot1.child); setLive(null); await waitForPortFree(HOST_PORT)
    return
  }
  await apiPrompt(o1, c1, ORD_SESSION, `${MK_ORD} Ordinary session pre-restart check.`, 'c4-ord1')
  const ord1 = await waitForMockRequest(mock, MK_ORD, 180_000, 'C2 ordinary pre-restart prompt')
  check('C', 'C2 the ordinary session works before the restart (model answer observed)', ord1 !== null, `seq=${ord1?.seq}`)
  stopHost(boot1.child); setLive(null); await waitForPortFree(HOST_PORT)
  log('C: boot 1 stopped (SIGTERM)')

  // ── boot 2 (resume): the fence must NOT touch the ordinary session ──
  const t2 = new Date().toISOString()
  const i2 = writeEvidence('boot-2', 'instance.log', '')
  const boot2 = await runBoot({ bootNo: 2, phase: 'resume', instanceLog: i2, tag: 'boot-2' })
  if (boot2 === null) return
  setLive(boot2)
  const { origin: o2, cookie: c2 } = boot2
  // C4 — browser-style follow of the ordinary session (the follow triggers
  // the SessionController promotion — the stock re-adoption MAY or may not
  // have happened at boot, so the probe assertions run AFTER the follow).
  const wsC = await openMux(o2, c2, 'worldC-follow')
  await openEventsStream(wsC)
  const followC = await followSession(wsC, ORD_SESSION).catch((e) => ({ error: String(e?.message ?? e) }))
  writeEvidence('boot-2', 'follow-ordinary.json', followC.error !== undefined ? { error: followC.error } : { snapshotType: followC.snapshot?.type })
  check('C', 'C4 the browser-style session/follow(ordinary) yields the snapshot (the stream survives)', followC.error === undefined, JSON.stringify(followC.error ?? '').slice(0, 200))
  dumpWsTraces('boot-2')
  wsC.close()
  await settleProbe(o2, ORD_SESSION, 60_000)
  const ev2 = readProbeJsonl(2)
  writeEvidence('boot-2', 'probe-events-ordinary.json', ev2)
  const ordCreated = ev2.filter((e) => e.kind === 'agent/created' && e.sessionId === ORD_SESSION)
  const ordDisposed = ev2.filter((e) => e.kind === 'agent/disposed' && e.sessionId === ORD_SESSION)
  const ordErr = ev2.filter((e) => e.kind === 'api-session/error' && e.sessionId === ORD_SESSION)
  check('C', 'C3 the ordinary SessionController promotion SUCCEEDED NORMALLY (agent/created observed; NO fence veto: zero disposed, zero api-error)', ordCreated.length >= 1 && ordDisposed.length === 0 && ordErr.length === 0, `created=${ordCreated.length} disposed=${ordDisposed.length} errors=${ordErr.length}`)
  check('C', 'C3b the fence never fired for the ordinary session (no veto wording on the user-visible lane OR the host log for that session — negative control)', !vetoWordingInEvents(ev2, ORD_SESSION) && !hostLogHasVetoFor(i2, ORD_SESSION), '')
  // C5 — the ordinary session is fully usable after the restart.
  await apiPrompt(o2, c2, ORD_SESSION, `${MK_ORD} Ordinary session post-restart check.`, 'c4-ord2')
  const ord2 = await waitForMockRequest(mock, MK_ORD, 180_000, 'C5 ordinary post-restart prompt', t2)
  check('C', 'C5 the ordinary session is fully usable AFTER the restart (post-restart prompt → model answer)', ord2 !== null, `seq=${ord2?.seq}`)
  // C6 — the anchor Team is unaffected (the fence coexists with the Team own-path).
  const tlm = await p6t6Tool(o2, { name: 'team_list_members', as: BOOT_ROOT, args: { rootSessionId: BOOT_ROOT, requestToken: freshKitToken() }, tag: 'c4-tlmC' })
  writeEvidence('boot-2', 'team-list-members-anchor.json', tlm.body ?? null)
  check('C', 'C6 the anchor Team is unaffected (Team own-path works alongside the ordinary promotion)', tlm.status === 200 && JSON.stringify(tlm.body ?? {}).includes('"ok":true'), JSON.stringify(tlm.body ?? {}).slice(0, 200))
  stopHost(boot2.child); setLive(null); await waitForPortFree(HOST_PORT)
  log('C: boot 2 stopped (SIGTERM)')
}

// ── WORLD D — explicit ordinary mode (the v5 wire) (guide §13.6) ───────────
async function worldD(mock) {
  // ── boot 1 (create): the dynamic team root (cold thereafter) ──
  const i1 = writeEvidence('boot-1', 'instance.log', '')
  const boot1 = await runBoot({ bootNo: 1, phase: 'create', instanceLog: i1, tag: 'boot-1' })
  if (boot1 === null) return
  setLive(boot1)
  const { origin: o1, cookie: c1 } = boot1
  const createRes = await remoteCall(o1, c1, 'team.create', {
    rootSessionId: DYN_ROOT,
    blueprintId: BP_MAIN_ID,
    initialWork: { prompt: `Commit 4 ordinary-mode team created. Acknowledge with the token ${MK_DONE} and stop.` },
  }, 'c4-createD', 1)
  writeEvidence('boot-1', 'team-create-response.json', createRes)
  if (!check('D', 'D1 team.create accepted (RPC ok:true — the dynamic root exists and is durable)', createRes.status === 200 && createRes.body?.type === 'server-response' && createRes.body?.result?.ok === true, `status=${createRes.status} head=${JSON.stringify(createRes.body ?? {}).slice(0, 200)}`)) {
    stopHost(boot1.child); setLive(null); await waitForPortFree(HOST_PORT)
    return
  }
  const dynFirst = await waitForMockRequest(mock, MK_DONE, 180_000, 'D1b dyn leader first turn', null, '[team-root-work')
  check('D', 'D1b dynamic leader live (first model request on the row staticModel)', dynFirst !== null && dynFirst.body?.model === MODEL_ID, `seq=${dynFirst?.seq}`)
  stopHost(boot1.child); setLive(null); await waitForPortFree(HOST_PORT)
  log('D: boot 1 stopped (SIGTERM)')

  // ── boot 2 (resume): cold root → v5 permit → native open → ordinary ──
  let ensureCalls = 0
  const t2 = new Date().toISOString()
  const i2 = writeEvidence('boot-2', 'instance.log', '')
  const boot2 = await runBoot({ bootNo: 2, phase: 'resume', instanceLog: i2, tag: 'boot-2', settleFor: [DYN_ROOT] })
  if (boot2 === null) return
  setLive(boot2)
  const { origin: o2, cookie: c2 } = boot2
  // D2 — the cold Team root is fenced on restart. 0.1.7 does NOT re-adopt
  // sessions spontaneously at boot (run-3 forensics: the boot window is
  // quiet; the created events in A/D landed exactly on the kit's own
  // follow/ensure calls), so the fence is exercised DEMAND-DRIVEN — the
  // first ordinary open (browser-style follow, NO permit yet) must be
  // vetoed. This is exactly the original 0.1.7 defect's trigger: the
  // client reopens the Team-managed session after a backend restart.
  const ev2boot = readProbeJsonl(2)
  writeEvidence('boot-2', 'probe-events-boot2-passive.json', ev2boot)
  const wsD2 = await openMux(o2, c2, 'worldD-fenced-open')
  const evD2Id = await openEventsStream(wsD2)
  const followD2 = await followSession(wsD2, DYN_ROOT).catch((e) => ({ error: String(e?.message ?? e) }))
  writeEvidence('boot-2', 'follow-cold-fenced.json', followD2.error !== undefined ? { error: followD2.error } : { snapshotType: followD2.snapshot?.type })
  const vetoFrameD2 = await waitForEventFrame(wsD2, evD2Id, (v) => v.event === 'api-session/error' && Array.isArray(v.args) && v.args[0] === DYN_ROOT, 45_000)
  wsD2.close()
  await settleProbe(o2, DYN_ROOT, 60_000)
  const ev2 = readProbeJsonl(2)
  writeEvidence('boot-2', 'probe-events-v5.json', ev2)
  const dCreatedBoot = ev2.filter((e) => e.kind === 'agent/created' && e.sessionId === DYN_ROOT)
  const dDisposedBoot = ev2.filter((e) => e.kind === 'agent/disposed' && e.sessionId === DYN_ROOT)
  check('D', 'D2 the cold Team root is fenced on restart (the ordinary open WITHOUT a permit is vetoed: disposed generation OR the production veto wording on the user-visible lane)', dDisposedBoot.length >= 1 || vetoWordingInEvents(ev2, DYN_ROOT) || hostLogHasVetoFor(i2, DYN_ROOT), `created=${dCreatedBoot.length} disposed=${dDisposedBoot.length} errFrame=${vetoFrameD2 !== null ? 'yes' : 'no'}`)
  // D3 — the v5 wire: prepareOrdinaryOpen grants the one-shot ordinary permit.
  const permit = await remoteCall(o2, c2, 'team.prepareOrdinaryOpen', { teamSessionId: DYN_ROOT }, 'c4-permit', 5)
  writeEvidence('boot-2', 'prepare-ordinary-open-v5.json', permit)
  const permitJ = JSON.stringify(permit.body ?? {})
  check('D', 'D3 wire v5 team.prepareOrdinaryOpen grants the one-shot ordinary permit (permitted:true + rootSessionId + contractVersion 5)', permit.status === 200 && permitJ.includes('"permitted":true') && permitJ.includes(`"rootSessionId":"${DYN_ROOT}"`) && permitJ.includes('"contractVersion":5'), `status=${permit.status} head=${permitJ.slice(0, 300)}`)
  if (permit.status !== 200) return
  // D4 — the native open (the client's second phase): browser-style follow.
  const wsD = await openMux(o2, c2, 'worldD-follow')
  await openEventsStream(wsD)
  const followD = await followSession(wsD, DYN_ROOT).catch((e) => ({ error: String(e?.message ?? e) }))
  writeEvidence('boot-2', 'follow-v5-open.json', followD.error !== undefined ? { error: followD.error } : { snapshotType: followD.snapshot?.type })
  check('D', 'D4 the native open (browser-style session/follow) yields the snapshot', followD.error === undefined, JSON.stringify(followD.error ?? '').slice(0, 200))
  dumpWsTraces('boot-2')
  wsD.close()
  await settleProbe(o2, DYN_ROOT, 60_000)
  const ev2f = readProbeJsonl(2)
  const dCreated = ev2f.filter((e) => e.kind === 'agent/created' && e.sessionId === DYN_ROOT)
  const dDisposed = ev2f.filter((e) => e.kind === 'agent/disposed' && e.sessionId === DYN_ROOT)
  check('D', 'D5 the ordinary activation PASSED the fence via the one-shot permit (exactly one surviving creation after the pre-permit veto)', dCreated.length - dDisposed.length === 1, `created=${dCreated.length} disposed=${dDisposed.length}`)
  const healthD = await p6t6Health(o2)
  const liveD = Array.isArray(healthD.body?.liveSessions) ? healthD.body.liveSessions : []
  check('D', 'D6 the Team glue hasLive(root) is still FALSE (the ordinary owner is NOT a Team handle)', !liveD.includes(DYN_ROOT), JSON.stringify(liveD))
  // D7 — the ordinary Agent runs a normal prompt.
  await apiPrompt(o2, c2, DYN_ROOT, `${MK_ORD} Ordinary-mode prompt check on the permitted owner.`, 'c4-ordD')
  const ordD = await waitForMockRequest(mock, MK_ORD, 180_000, 'D7 ordinary owner prompt', t2)
  writeEvidence('boot-2', 'ordinary-owner-request.json', mockSummary(ordD))
  const ordTools = ordD ? mockToolsOf(ordD) : []
  check('D', 'D7 the ordinary Agent runs a normal prompt (model answer; NO team_* tools on its surface)', ordD !== null && !ordTools.some((t) => String(t).startsWith('team_')), `tools head=${JSON.stringify(ordTools).slice(0, 300)}`)
  check('D', 'D8 the ensureRootLive call count during the ordinary open = 0 (the kit issued none; no ensureRootLive for the root in the host log)', ensureCalls === 0 && !hostLogHasFor(i2, 'ensureRootLive', DYN_ROOT), `ensureCalls=${ensureCalls}`)
  // D9 — the subsequent Team-mode click: typed fail closed (no silent adopt).
  ensureCalls += 1
  const ensureD = await remoteCall(o2, c2, 'team.ensureRootLive', { teamSessionId: DYN_ROOT }, 'c4-ensureD', 3)
  writeEvidence('boot-2', 'ensure-root-live-failclosed.json', ensureD)
  const ensureDJ = JSON.stringify(ensureD.body ?? {})
  check('D', 'D9 the subsequent Team-mode ensure TYPED FAILS CLOSED (ok:false with the OUTSIDE_TEAM typed error — no silent adopt)', ensureD.status === 200 ? !ensureDJ.includes('"ok":true') : ensureD.status >= 400, `status=${ensureD.status} head=${ensureDJ.slice(0, 300)}`)
  check('D', 'D9b the fail-closed error carries the typed OUTSIDE_TEAM code (S6 mapping of the writer-held / registry collision)', ensureDJ.includes('OUTSIDE_TEAM'), ensureDJ.slice(0, 300))
  const ev2g = readProbeJsonl(2)
  const dCreatedG = ev2g.filter((e) => e.kind === 'agent/created' && e.sessionId === DYN_ROOT)
  const healthDg = await p6t6Health(o2)
  const liveDg = Array.isArray(healthDg.body?.liveSessions) ? healthDg.body.liveSessions : []
  check('D', 'D9c no silent adopt (no new agent/created after the failed ensure; the glue hasLive still false; the ordinary owner keeps working)', dCreatedG.length === dCreated.length && !liveDg.includes(DYN_ROOT), `created=${dCreatedG.length} live=${JSON.stringify(liveDg)}`)
  stopHost(boot2.child); setLive(null); await waitForPortFree(HOST_PORT)
  log('D: boot 2 stopped (SIGTERM)')

  // ── boot 3 (resume): the ordinary owner is gone → Team takeover again ──
  const i3 = writeEvidence('boot-3', 'instance.log', '')
  const boot3 = await runBoot({ bootNo: 3, phase: 'resume', instanceLog: i3, tag: 'boot-3', settleFor: [DYN_ROOT] })
  if (boot3 === null) return
  setLive(boot3)
  const { origin: o3, cookie: c3 } = boot3
  const ev3boot = readProbeJsonl(3)
  writeEvidence('boot-3', 'probe-events-boot3-passive.json', ev3boot)
  // D10 — the ordinary owner is process-local and GONE after the restart;
  // a NEW ordinary open (no permit in the fresh process) must be
  // RE-FENCED before the Team can take over again (demand-driven, same
  // model as D2 — 0.1.7 has no spontaneous boot re-adoption).
  const wsD3 = await openMux(o3, c3, 'worldD-refence-open')
  const evD3Id = await openEventsStream(wsD3)
  const followD3 = await followSession(wsD3, DYN_ROOT).catch((e) => ({ error: String(e?.message ?? e) }))
  writeEvidence('boot-3', 'follow-cold-refenced.json', followD3.error !== undefined ? { error: followD3.error } : { snapshotType: followD3.snapshot?.type })
  const vetoFrameD3 = await waitForEventFrame(wsD3, evD3Id, (v) => v.event === 'api-session/error' && Array.isArray(v.args) && v.args[0] === DYN_ROOT, 45_000)
  wsD3.close()
  await settleProbe(o3, DYN_ROOT, 60_000)
  const ev3 = readProbeJsonl(3)
  writeEvidence('boot-3', 'probe-events-restart.json', ev3)
  check('D', 'D10 after the backend restart the ordinary owner is gone and re-fenced (the new ordinary open WITHOUT a permit is vetoed: disposed generation OR the production veto wording on the user-visible lane)', ev3.some((e) => e.kind === 'agent/disposed' && e.sessionId === DYN_ROOT) || vetoWordingInEvents(ev3, DYN_ROOT) || hostLogHasVetoFor(i3, DYN_ROOT), `created=${ev3.filter((e) => e.kind === 'agent/created' && e.sessionId === DYN_ROOT).length} disposed=${ev3.filter((e) => e.kind === 'agent/disposed' && e.sessionId === DYN_ROOT).length} errFrame=${vetoFrameD3 !== null ? 'yes' : 'no'}`)
  const ensureD2 = await remoteCall(o3, c3, 'team.ensureRootLive', { teamSessionId: DYN_ROOT }, 'c4-ensureD2', 3)
  writeEvidence('boot-3', 'ensure-root-live-takeover.json', ensureD2)
  const ensureD2J = JSON.stringify(ensureD2.body ?? {})
  check('D', 'D11 the Team mode can take over AGAIN after the restart (ensureRootLive ok — the ordinary owner is process-local and gone)', ensureD2.status === 200 && ensureD2J.includes('"ok":true') && ensureD2J.includes('"live":true'), `status=${ensureD2.status} head=${ensureD2J.slice(0, 300)}`)
  const healthD2 = await p6t6Health(o3)
  check('D', 'D11b the glue hasLive(root) == true after the re-takeover', Array.isArray(healthD2.body?.liveSessions) && healthD2.body.liveSessions.includes(DYN_ROOT), JSON.stringify(healthD2.body?.liveSessions ?? []))
  stopHost(boot3.child); setLive(null); await waitForPortFree(HOST_PORT)
  log('D: boot 3 stopped (SIGTERM)')
}

// ── WORLD E — ≥20× race pressure (guide §13.6) ─────────────────────────────
async function worldE(mock) {
  // ── boot 1 (create): the race world root ──
  const i1 = writeEvidence('boot-1', 'instance.log', '')
  const boot1 = await runBoot({ bootNo: 1, phase: 'create', instanceLog: i1, tag: 'boot-1' })
  if (boot1 === null) return
  setLive(boot1)
  const { origin: o1, cookie: c1 } = boot1
  const createRes = await remoteCall(o1, c1, 'team.create', {
    rootSessionId: DYN_ROOT,
    blueprintId: BP_MAIN_ID,
    initialWork: { prompt: `Commit 4 race-world team created. Acknowledge with the token ${MK_DONE} and stop.` },
  }, 'c4-createE', 1)
  writeEvidence('boot-1', 'team-create-response.json', createRes)
  if (!check('E', 'E0 team.create accepted (RPC ok:true — the race root exists and is durable)', createRes.status === 200 && createRes.body?.type === 'server-response' && createRes.body?.result?.ok === true, `status=${createRes.status} head=${JSON.stringify(createRes.body ?? {}).slice(0, 200)}`)) {
    stopHost(boot1.child); setLive(null); await waitForPortFree(HOST_PORT)
    return
  }
  const dynFirst = await waitForMockRequest(mock, MK_DONE, 180_000, 'E0b dyn leader first turn', null, '[team-root-work')
  check('E', 'E0b dynamic leader live (first model request on the row staticModel)', dynFirst !== null && dynFirst.body?.model === MODEL_ID, `seq=${dynFirst?.seq}`)
  stopHost(boot1.child); setLive(null); await waitForPortFree(HOST_PORT)
  log('E: boot 1 stopped (SIGTERM)')

  // ── the iterations: restart → session.follow ∥ team.ensureRootLive ──
  const iterations = []
  for (let i = 1; i <= RACE_ITERATIONS; i += 1) {
    const bootNo = i + 1
    const tag = `boot-${bootNo}`
    const instLog = writeEvidence(tag, 'instance.log', '')
    log(`E: iteration ${i}/${RACE_ITERATIONS} — boot ${bootNo}`)
    const boot = await runBoot({ bootNo, phase: 'resume', instanceLog: instLog, tag })
    if (boot === null) break
    setLive(boot)
    const { origin, cookie } = boot
    try {
      // Concurrent racers: the browser-style follow and the Team ensure,
      // the latter launched after 0–few random microtask hops.
      const ws = await openMux(origin, cookie, `worldE-follow-${i}`)
      await openEventsStream(ws)
      const followP = followSession(ws, DYN_ROOT).catch((e) => ({ error: String(e?.message ?? e) }))
      const delayMicro = Math.floor(Math.random() * 4) // 0..3 microtask hops
      let hop = 0
      const ensureP = (async () => {
        while (hop < delayMicro) { await Promise.resolve(); hop += 1 }
        return remoteCall(origin, cookie, 'team.ensureRootLive', { teamSessionId: DYN_ROOT }, `c4-ensureE${i}`, 3)
      })()
      const [followR, ensureR] = await Promise.all([followP, ensureP])
      writeEvidence(tag, 'race-follow.json', followR.error !== undefined ? { error: followR.error } : { snapshotType: followR.snapshot?.type })
      writeEvidence(tag, 'race-ensure.json', ensureR)
      ws.close()
      await settleProbe(origin, DYN_ROOT, 90_000)
      const ev = readProbeJsonl(bootNo)
      writeEvidence(tag, 'probe-events-race.json', ev)
      const created = ev.filter((e) => e.kind === 'agent/created' && e.sessionId === DYN_ROOT)
      const disposed = ev.filter((e) => e.kind === 'agent/disposed' && e.sessionId === DYN_ROOT)
      const health = await p6t6Health(origin)
      const live = Array.isArray(health.body?.liveSessions) ? health.body.liveSessions : []
      const ensureJ = JSON.stringify(ensureR.body ?? {})
      const teamLive = live.includes(DYN_ROOT)
      const singleWriter = created.length - disposed.length === 1
      const ensureOk = ensureR.status === 200 && ensureJ.includes('"ok":true')
      const it = {
        i, bootNo, delayMicro,
        followOk: followR.error === undefined,
        ensureStatus: ensureR.status,
        ensureOk,
        teamLive,
        created: created.length,
        disposed: disposed.length,
        singleWriter,
        live,
      }
      iterations.push(it)
      check('E', `E-iter${i} converged: final Team live + single surviving writer (delay=${delayMicro}µt, created=${created.length}, disposed=${disposed.length})`, it.followOk && it.ensureOk && it.teamLive && it.singleWriter, JSON.stringify(it).slice(0, 220))
    } finally {
      stopHost(boot.child)
      setLive(null)
      await waitForPortFree(HOST_PORT)
    }
  }
  writeEvidence('summary', 'race-iterations.json', iterations)
  const good = iterations.filter((it) => it.followOk && it.ensureOk && it.teamLive && it.singleWriter)
  check('E', `E-final ${RACE_ITERATIONS}× race: ${RACE_ITERATIONS}/${RACE_ITERATIONS} final Team live / 0 unresolved writer-held / 0 double Agent / 0 leaked handle (every boot after a prior iteration came up clean — a leaked write handle would break the next boot gate)`, iterations.length === RACE_ITERATIONS && good.length === RACE_ITERATIONS, `iterations=${iterations.length} good=${good.length}`)
  log('E: race loop finished')
}

// ── main: S0 preflight → serial world loop → finish ────────────────────────
async function main() {
  mkdirSync(EVIDENCE_BASE, { recursive: true })
  log(`Commit 4 kit — stamp ${RUN_STAMP} worlds=${WORLD_SEQUENCE.join(',')} browserHold=${BROWSER_HOLD} keepHome=${KEEP_HOME} race=${RACE_ITERATIONS}`)
  // S0 preflight (Phase 0 discipline): test-use pristine + pinned, worktree
  // at the accepted tip, CLI version, ports free, :3080/:3180 probed.
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' })
  check('s0', 'preflight: test-use HEAD == the 0.1.7-rc.1 pin', rev.status === 0 && rev.stdout.trim() === TESTUSE_PIN, `HEAD=${rev.stdout?.trim() ?? rev.stderr}`)
  const porcelain = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' }).stdout
  check('s0', 'preflight: test-use working tree pristine (empty porcelain)', porcelain === '', porcelain.slice(0, 200))
  const wtRev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: WORKTREE, encoding: 'utf8' })
  check('s0', 'preflight: task worktree at the accepted Commit-4 fix tip (f3d5a71b — runOwned await fix)', wtRev.status === 0 && wtRev.stdout.trim() === EXPECTED_BRANCH_SHA, `HEAD=${wtRev.stdout.trim()}`)
  const cliVersion = spawnSync(process.execPath, [HOST_BIN, '--version'], { cwd: TESTUSE, encoding: 'utf8', timeout: 60_000 }).stdout.trim()
  check('s0', 'preflight: the test-use CLI reports 0.1.7-rc.1', cliVersion === '0.1.7-rc.1', `version=${cliVersion}`)
  const hostFree = await portFree(HOST_PORT)
  const mockFree = await portFree(MOCK_PORT)
  check('s0', 'preflight: host/mock ports free (3492/3497)', hostFree && mockFree, `hostFree=${hostFree} mockFree=${mockFree}`)
  const preStable = { p3080: await probePort(3080), p3180: await probePort(3180) }
  const preflight = {
    stamp: RUN_STAMP,
    at: new Date().toISOString(),
    testUse: { pin: TESTUSE_PIN, head: rev.stdout.trim(), porcelain: porcelain === '' ? 'clean' : porcelain.slice(0, 200) },
    worktreeHead: wtRev.stdout.trim(),
    cliVersion,
    ports: { host: HOST_PORT, mock: MOCK_PORT, hostFree, mockFree },
    stableInstances: preStable,
  }
  writeFileSync(join(EVIDENCE_BASE, 'preflight.json'), JSON.stringify(preflight, null, 2))
  if (!hostFree || !mockFree || porcelain !== '' || rev.stdout.trim() !== TESTUSE_PIN) {
    die(`preflight failed — refusing to boot (test-use or ports not clean)`)
    return finish(1)
  }

  const worldResults = []
  for (const letter of WORLD_SEQUENCE) {
    if (fatal !== null) break
    worldResults.push(await runWorld(letter))
  }

  const postStable = { p3080: await probePort(3080), p3180: await probePort(3180) }
  writeFileSync(join(EVIDENCE_BASE, 'post-stable-probe.json'), JSON.stringify({ at: new Date().toISOString(), ...postStable }, null, 2))
  check('s0', 'post-run: the stable :3080 instance answer is UNCHANGED (no cross-world contamination)', JSON.stringify(postStable.p3080) === JSON.stringify(preStable.p3080), `before=${JSON.stringify(preStable.p3080)} after=${JSON.stringify(postStable.p3080)}`)

  return finish(fatal !== null || results.some((r) => !r.ok) ? 1 : 0)
}

function finish(code) {
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)
  mkdirSync(EVIDENCE_BASE, { recursive: true })
  writeFileSync(join(EVIDENCE_BASE, 'checks.json'), JSON.stringify({
    stamp: RUN_STAMP,
    at: new Date().toISOString(),
    worlds: WORLD_SEQUENCE,
    browserHold: BROWSER_HOLD,
    raceIterations: RACE_ITERATIONS,
    passed,
    failed: failed.length,
    fatal,
    results,
    lagEvents: globalThis.__rst017Lag?.events ?? [],
  }, null, 2))
  log(`summary: ${passed} passed, ${failed.length} failed, fatal=${fatal ?? 'none'}`)
  for (const f of failed) log(`  FAIL [${f.leg}] ${f.name} — ${f.detail}`)
  log(`evidence: ${EVIDENCE_BASE}`)
  process.exitCode = code
}

main().catch((e) => {
  log(`FATAL main: ${e?.message ?? e}\n${String(e?.stack ?? '').split('\n').slice(1, 6).join('\n')}`)
  process.exitCode = 1
})
