#!/usr/bin/env node
/**
 * spike.mjs — Phase 0 real-host characterization spike for the 0.1.7-rc.1
 * Team restart-recovery fix (guide `dsh-agent-team-restart-recovery-0.1.7-rc.1-guide.md`
 * §9; Commit 1 = characterization only, NO production changes).
 *
 * Answers the two guide questions:
 *
 *   Q1  Does a rejected `agent/created` (the C1 fence veto) really release
 *       the session writer? (rollback: write handle close → agent/disposed →
 *       the Team's own `agents.resume` succeeds afterwards, with zero model
 *       requests made by the foreign agent and a fully intact session log.)
 *
 *   Q2  Does the intentional rejection surface a PERSISTENT user-visible
 *       `api-session/error` in the browser? (wire-level capture here; the
 *       browser leg is a manual step while `--keep` holds boot 3 alive —
 *       see the keep-mode.json evidence and the session report.)
 *
 * Legs (one fresh world under tests/homes/, git-install of the task branch,
 * mock model, cookie-gated REST + the /api/remote.mux WebSocket protocol):
 *
 *   Leg A   (baseline, CURRENT production code): boot 1 (bootPhase create) →
 *           team.create dynamic root R1 → leader live (model request seen) →
 *           stop. Boot 2 (bootPhase resume): the dynamic root is COLD.
 *           Browser-equivalent `session/follow`(R1) over the stream carrier
 *           triggers the stock ordinary promotion (agent/created source=
 *           resume, unvetoed by the passive probe). Then
 *           `team.ensureRootLive`(R1) must FAIL with the typed
 *           TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM ("already registered") —
 *           the recorded baseline blocker.
 *
 *   Leg B   (fence probe, the C1 premise): the patch layer re-enables the
 *           probe (reject: true, teamSessions=[R1]). Boot 3 (resume): the
 *           boot team root re-adopts on restart and its agent/created must
 *           NOT be vetoed (the fence only targets the configured
 *           Team-managed sessions).
 *
 *           --keep (the Q2 mode): the script ARMS the fence, then HOLDS
 *           (prints its PID) leaving boot 3 alive. The browser (manual step)
 *           then: opens R1 (its own session/follow triggers the veto →
 *           rollback → api-session/error broadcast) → observes the error
 *           lane → clicks 以 Team 模式 打开 (takeover) → observes whether
 *           the error persists. Finally `kill -TERM <pid>`: the script
 *           collects the probe event log, the mock request log, the p6t6
 *           live state and the session log, writes the Q1 verdict + the Q2
 *           wire evidence, and tears the world down.
 *
 *           Without --keep: the script itself plays the browser over the
 *           wire (WS follow → veto → disposed → api-session/error capture →
 *           disarm → ensureRootLive success → surface checks → Leg C).
 *
 *   Leg C   (ordinary negative control, inside boot 3): a plain DSH session
 *           O1 (not Team-managed) followed/promoted while the fence is ARMED
 *           must pass (no veto) and stay fully usable.
 *
 * Usage:
 *   node spike.mjs           # full scripted run (A + B-wire + C), teardown
 *   node spike.mjs --keep    # A + B-arm + HOLD for the manual browser Q2 leg
 *
 * Red lines honored: test-use stays pristine (preflight-verified, never
 * touched); DSH_HOME strictly under tests/homes/; host port 3491 family;
 * :3080 and this GUI's home are never touched (pre/post probes recorded);
 * zero core patch.
 */

import {
  appendFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync,
  rmSync, writeFileSync,
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
const EVIDENCE_BASE = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'restart-017rc1', 'phase0')
// RUN-14 FIX: per-run evidence dirs. The shared-current-dir pattern lost
// run 9's legA/legB (overwritten by run 10) and run 12's probe JSONL
// (cleared by run 13's boot — the JSONL is shared across processes and
// cleared per boot). Each run now gets phase0/run<stamp>/ exclusively.
const RUN_STAMP_EARLY = process.env.RST017_STAMP ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const EVIDENCE_DIR = join(EVIDENCE_BASE, `run${RUN_STAMP_EARLY}`)

const RUN_STAMP = RUN_STAMP_EARLY

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
const KEEP_MODE = process.argv.includes('--keep')

const HOME = process.env.RST017_WORLD ?? join(MAIN_REPO, 'tests', 'homes', `rst017-spike-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const XDG = join(HOME, '.xdg')
const REPO_GIT = join(HOME, 'repo.git')
const PROFILE_DIR = join(HOME, 'profiles', 'web')
const BLUEPRINT_DIR = join(HOME, 'blueprints')
const SPILL_ROOT = join(HOME, 'spill')

// 3492/3497 (3491 family): run 5's kit crash orphaned a boot host that still
// listens on 3491 (pid recorded in the run-5 evidence; workspace-only policy
// forbids killing it, so this kit simply moves one family member over).
const HOST_PORT = Number(process.env.RST017_HOST_PORT ?? 3492)
const MOCK_PORT = Number(process.env.RST017_MOCK_PORT ?? 3497)

const BOOT_ROOT = `session-rst017-boot-${RUN_STAMP}`
const DYN_ROOT = `session-rst017-dyn-${RUN_STAMP}`
const ORD_SESSION = `session-rst017-ord-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.rst017-anchor'
const BP_MAIN_ID = 'team.rst017-main'
const MODEL_ID = `rst017-model-${RUN_STAMP}`
const PRESET_ID = 'standard'
const P_BOOT = `RST017BOOT_PERSONA_${RUN_STAMP}`
const P_DYN = `RST017DYN_PERSONA_${RUN_STAMP}`
const MK_DONE = `RST017DONE_${RUN_STAMP}`
const MK_ORD = `RST017ORD_${RUN_STAMP}`

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/
const PROBE_TEAM_FILE = join(WORKSPACE, 'team', 'test.md')
const PROBE_TEAM_CONTENT = `rst017-team-probe-${RUN_STAMP}`

// ── small state ─────────────────────────────────────────────────────────────
let fatal = null
const results = []
function log(msg) { console.log(`[rst017-spike ${RUN_STAMP}] ${msg}`) }
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
async function startMockModel() {
  const { startMockModel: startMock } = await import(pathToFileURL(MOCK_MODULE).href)
  const decide = ({ req }) => {
    const body = req
    const msgs = body?.messages ?? []
    const userTexts = msgs.filter((m) => m?.role === 'user')
      .map((m) => (typeof m.content === 'string' ? m.content
        : Array.isArray(m.content) ? m.content.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join('')
        : ''))
      .filter((t) => t.length > 0)
    const userText = userTexts.join('\n')
    if (userText.includes(MK_ORD)) return { kind: 'text', content: `RST017_ORD_ACK ${MK_ORD}` }
    if (userText.includes(MK_DONE)) return { kind: 'text', content: `RST017_DONE ${MK_DONE}` }
    return { kind: 'text', content: 'rst017 spike ack' }
  }
  return startMock({ port: MOCK_PORT, decide, log: () => {} })
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
        DEEPSEEK_API_KEY: 'rst017-spike-mock-key',
        // RST017_HOST_HOOK=1: load the zero-modification runtime
        // observation hook into the host (logs to the host's stderr → the
        // per-boot instance log). Used to capture the host-side teardown
        // when the spike's follow socket gets closed (run 10/11).
        // NOTE: the hook lives in the MAIN repo phase0 dir (KIT_DIR) — the
        // worktree copy (EVIDENCE_DIR) holds evidence, not kit sources.
        ...(process.env.RST017_HOST_HOOK === '1' ? { NODE_OPTIONS: `--import ${join(KIT_DIR, 'diag-hook.mjs')}` } : {}),
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
    `  persona: ${JSON.stringify(`You are the leader of the rst017 dynamic spike team. ${P_DYN} Answer concisely and stop.`)}`,
    'members:',
    '  - templateId: worker',
    '    displayName: "Worker"',
    `    persona: ${JSON.stringify(`You are a worker of the rst017 dynamic spike team. ${P_DYN}`)}`,
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
 * The profile patch layer. `probeReject` flips the fence-probe row between
 * the passive (Leg A) and the active-veto (Leg B) modes — same row module,
 * only the row config changes.
 */
function writePatchFile(phase, probeReject, autoArm = false) {
  mkdirSync(PROFILE_DIR, { recursive: true })
  const lines = [
    `# rst017 Phase 0 spike patch layer (run ${RUN_STAMP}, bootPhase ${phase}, probeReject ${probeReject}, autoArm ${autoArm})`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: 'dsh-agent-team/host', config: teamRowConfig(phase) }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...yamlEmitItem({
      id: 'team-restart-fence-probe',
      name: pathToFileURL(FENCE_PROBE).href,
      config: { reject: probeReject, autoArm, teamSessions: [DYN_ROOT], reportDir: join(EVIDENCE_DIR, 'probe-events') },
    }, 2),
    ...yamlEmitItem({ id: 'team-spill-local', name: 'dsh-agent-team/spill-local', config: { root: SPILL_ROOT } }, 2),
    '',
  ]
  writeFileSync(join(PROFILE_DIR, 'cordis.patch.yml'), lines.join('\n'))
}

function writeDirective(boot, phase) {
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot,
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
async function runBoot({ bootNo, phase, probeReject, autoArm = false, instanceLog, tag, detached = false, expectLiveRoot = BOOT_ROOT }) {
  writePatchFile(phase, probeReject, autoArm)
  writeDirective(bootNo, phase)
  // Fresh per-boot probe event log (the JSONL is append-only across boots
  // within a run; per-boot analysis wants clean boundaries).
  rmSync(join(EVIDENCE_DIR, 'probe-events', 'fence-probe-events.jsonl'), { force: true })
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
  check(tag, `boot ${bootNo} up (marker + auth + p6t6 ok + boot root live + fence probe ok, probeReject=${probeReject})`, true, `${origin} liveSessions=${JSON.stringify(health.body.liveSessions)}`)
  return { origin, cookie, child, alive, instanceLog }
}

async function bootWorldAndInstall() {
  // World reuse is EXPLICIT (RST017_WORLD) and only safe after a run whose
  // boot 1 leg completed: a crashed boot 1 leaves a stamped team_domain in
  // the home's storage, which a bootPhase 'create' boot then rejects.
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
  writeFileSync(PROBE_TEAM_FILE, PROBE_TEAM_CONTENT + '\n')
  writeFileSync(join(BLUEPRINT_DIR, 'rst017-main.yaml'), mainBlueprintYaml())
  writeEvidence('world', 'materialized.json', { home: HOME, workspace: WORKSPACE, blueprintDir: BLUEPRINT_DIR, stamp: RUN_STAMP })
  log(`world materialized: ${HOME}`)

  rmSync(REPO_GIT, { recursive: true, force: true })
  const clone = spawnSync('git', ['clone', '--bare', '--branch', BRANCH, MAIN_REPO, REPO_GIT], { encoding: 'utf8', timeout: 120_000 })
  if (clone.status !== 0) die(`git clone --bare failed: ${String(clone.stderr ?? clone.stdout).slice(0, 400)}`)
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

async function main() {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  log(`Phase 0 spike — stamp ${RUN_STAMP} (keep=${KEEP_MODE})`)

  // ── S0 preflight ──────────────────────────────────────────────────────
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' })
  if (rev.status !== 0 || rev.stdout.trim() !== TESTUSE_PIN) {
    die(`test-use checkout is not at ${TESTUSE_PIN} (got ${rev.stdout?.trim() ?? rev.stderr})`)
    return finish(1)
  }
  const porcelain = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' }).stdout
  if (porcelain !== '') die(`test-use working tree is NOT pristine: ${porcelain.slice(0, 300)}`)
  const wtRev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: WORKTREE, encoding: 'utf8' })
  check('s0', 'preflight: test-use pristine @ 46a7f68b09 (HEAD + empty porcelain)', true, '')
  check('s0', 'preflight: task worktree on task/team-restart-017rc1', wtRev.status === 0, `HEAD=${wtRev.stdout.trim()}`)
  const cliVersion = spawnSync(process.execPath, [HOST_BIN, '--version'], { cwd: TESTUSE, encoding: 'utf8', timeout: 60_000 }).stdout.trim()
  check('s0', 'preflight: the test-use CLI reports 0.1.7-rc.1', cliVersion === '0.1.7-rc.1', `version=${cliVersion}`)
  const preStable = { p3080: await probePort(3080), p3180: await probePort(3180) }
  writeEvidence('s0-preflight', 'pre-stable-probe.json', preStable)
  log(`stable pre-probe: 3080=${preStable.p3080.reachable ? preStable.p3080.status : 'unreachable'} 3180=${preStable.p3180.reachable ? preStable.p3180.status : 'unreachable'}`)
  if (fatal !== null) return finish(1)

  // ── world + install ───────────────────────────────────────────────────
  await bootWorldAndInstall()
  if (fatal !== null) return finish(1)

  if (!(await waitForPortFree(MOCK_PORT, 60_000))) die(`mock port ${MOCK_PORT} not free within 60s (leftover process?)`)
  const mock = await startMockModel()
  log(`mock model up @ ${MOCK_PORT}`)

  let boot3 = null
  let liveHost = null // the currently-running boot child (teardown on unexpected error)

  try {
    // ════════════════════════════════════════════════════════════════════
    // Leg A — baseline on the CURRENT production code
    // ════════════════════════════════════════════════════════════════════
    log('── Leg A: boot 1 (create) + dynamic team ──')
    const instanceLog1 = writeEvidence('legA', 'instance-1.log', '')
    const boot1 = await runBoot({ bootNo: 1, phase: 'create', probeReject: false, instanceLog: instanceLog1, tag: 'legA' })
    if (boot1 === null) return finish(1)
    liveHost = boot1
    const { origin: o1, cookie: c1 } = boot1

    // v1 team.create carries initialWork inline (the U8-proven 0.1.7 path).
    const createRes = await remoteCall(o1, c1, 'team.create', {
      rootSessionId: DYN_ROOT,
      blueprintId: BP_MAIN_ID,
      initialWork: { prompt: `Spike dynamic team created. Answer with the token ${MK_DONE} and stop.` },
    }, 'rst-create', 1)
    writeEvidence('legA', 'team-create-response.json', createRes)
    const createOk = createRes.status === 200 && createRes.body !== null
    check('legA', 'A1 team.create(R1) accepted over the public remote seam', createOk, `status=${createRes.status} bodyHead=${JSON.stringify(createRes.body ?? {}).slice(0, 200)}`)
    if (!createOk) {
      die(`team.create failed — see legA/team-create-response.json + instance log tail:\n${logTail(instanceLog1, 30)}`)
      return finish(1)
    }
    // No sinceAt here: the initial-work turn's model request lands BEFORE
    // the team.create HTTP response (the handler awaits the whole turn),
    // so a post-response timestamp would filter out the very request we
    // want (run 6 root cause). The prefix pins the leader's turn and
    // excludes the title-generation request that embeds the same text.
    const dynFirst = await waitForMockRequest(mock, MK_DONE, 120_000, 'dynamic leader first turn', null, '[team-root-work')
    const dynFirstTools = dynFirst !== null ? mockToolsOf(dynFirst) : []
    writeEvidence('legA', 'dyn-leader-first-request.json', dynFirst === null ? { absent: true } : { seq: dynFirst.seq, model: dynFirst.body?.model, tools: dynFirstTools, systemHead: String(dynFirst.body?.system ?? '').slice(0, 400) })
    // Diagnostic (run 5: no model request, and the dyn session log held
    // ONLY the envelope row — the initial-work turn never started a turn
    // boundary; a zstd-aware dump pins down what the log actually holds).
    writeEvidence('legA', 'dyn-session-log-after-A2.json', findSessionLogs(HOME, DYN_ROOT).map((p) => ({ path: p, ...countAssistantRows(p) })))
    writeEvidence('legA', 'boot-session-log-after-A2.json', findSessionLogs(HOME, BOOT_ROOT).map((p) => ({ path: p, ...countAssistantRows(p) })))
    check('legA', 'A2 dynamic leader live: first model request observed (row staticModel)',
      dynFirst !== null && dynFirst.body?.model === MODEL_ID,
      `seq=${dynFirst?.seq} model=${dynFirst?.body?.model}`)
    check('legA', 'A3 dynamic leader surface carries the team tools (legacy-mode full catalog)',
      dynFirstTools.some((t) => String(t).startsWith('team_')), `tools=${JSON.stringify(dynFirstTools).slice(0, 300)}`)
    stopHost(boot1.child)
    liveHost = null
    await waitForPortFree(HOST_PORT)
    log('boot 1 stopped (SIGTERM)')

    log('── Leg A: boot 2 (resume) — the cold dynamic root ──')
    const instanceLog2 = writeEvidence('legA', 'instance-2.log', '')
    const boot2 = await runBoot({ bootNo: 2, phase: 'resume', probeReject: false, instanceLog: instanceLog2, tag: 'legA' })
    if (boot2 === null) return finish(1)
    liveHost = boot2
    const { origin: o2, cookie: c2 } = boot2

    const probeBaselineA = (await fenceEvents(o2)).length
    writeEvidence('legA', 'probe-baseline-after-boot2.json', { count: probeBaselineA })

    const wsA = await openMux(o2, c2, 'legA-follow')
    await openEventsStream(wsA)
    const followA = await followSession(wsA, DYN_ROOT).catch((e) => ({ error: String(e?.message ?? e) }))
    writeEvidence('legA', 'follow-dyn-root.json', followA.error !== undefined ? { error: followA.error } : { snapshotType: followA.snapshot?.type })
    check('legA', 'A4 browser-equivalent session/follow(R1) yields the snapshot frame (the stream survives)',
      followA.error === undefined, followA.error !== undefined ? followA.error : 'snapshot ok')
    // RUN-10: explicit socket-survival check (run 9 A4 reported a spurious
    // "ws closed by host"; repro1/2/4/5 prove the host never closes a follow
    // socket — this check pins that on the spike's own socket).
    check('legA', 'A4b the mux socket is still open after the follow (no host-side close)',
      wsA.closed === false, `closed=${wsA.closed}`)
    dumpWsTraces('legA')

    let promoted = false
    {
      const deadline = Date.now() + 45_000
      for (;;) {
        const events = await fenceEvents(o2)
        if (events.slice(probeBaselineA).some((e) => e.kind === 'agent/created' && e.sessionId === DYN_ROOT)) { promoted = true; break }
        if (Date.now() >= deadline) break
        await sleep(250)
      }
    }
    const eventsA = await fenceEvents(o2)
    writeEvidence('legA', 'probe-events-after-follow.json', { baseline: probeBaselineA, events: eventsA.slice(probeBaselineA) })
    check('legA', 'A5 ordinary promotion observed: agent/created(R1, source=resume) fired unvetoed (the stock path)',
      promoted, JSON.stringify(eventsA.slice(probeBaselineA).map((e) => ({ kind: e.kind, sid: String(e.sessionId ?? '').slice(-12), source: e.source, veto: e.veto }))).slice(0, 400))

    // THE baseline blocker: the Team's own resume now collides.
    const ensureA = await remoteCall(o2, c2, 'team.ensureRootLive', { teamSessionId: DYN_ROOT }, 'rst-ensureA', 3)
    writeEvidence('legA', 'ensure-root-live-baseline.json', ensureA)
    const ensureAErr = JSON.stringify(ensureA.body ?? {})
    const outsideTeam = ensureAErr.includes('already registered') || ensureAErr.includes('OUTSIDE_TEAM')
    // Run 8 baseline: the stock writer-held collision surfaces as the
    // SessionAlreadyOwnedError message "session ... is already owned by an
    // active write handle" (wrapped in TEAM_REMOTE_TEAM_ROOT_LIVE_START_FAILED).
    const writerHeld = ensureAErr.includes('writer-held') || ensureAErr.includes('SessionAlreadyOwned') || ensureAErr.includes('already owned by an active write handle')
    check('legA', 'A6 BASELINE BLOCKER: team.ensureRootLive(R1) FAILS after the ordinary promotion stole the session',
      ensureA.status !== 200 || ensureAErr.includes('"ok":false') || ensureAErr.includes('error'),
      `status=${ensureA.status} errHead=${ensureAErr.slice(0, 300)}`)
    check('legA', 'A6b baseline failure lane: typed OUTSIDE_TEAM (already registered) or the writer-held race',
      outsideTeam || writerHeld, `outsideTeam=${outsideTeam} writerHeld=${writerHeld}`)
    wsA.close()
    stopHost(boot2.child)
    liveHost = null
    await waitForPortFree(HOST_PORT)
    log('boot 2 stopped (SIGTERM)')

    // ════════════════════════════════════════════════════════════════════
    // Leg B — the fence probe (the C1 premise)
    // ════════════════════════════════════════════════════════════════════
    log('── Leg B: boot 3 (resume, fence reject=true) ──')
    const instanceLog3 = writeEvidence('legB', 'instance-3.log', '')
    boot3 = await runBoot({ bootNo: 3, phase: 'resume', probeReject: true, autoArm: true, instanceLog: instanceLog3, tag: 'legB', detached: KEEP_MODE })
    if (boot3 === null) return finish(1)
    liveHost = boot3
    const { origin: o3, cookie: c3 } = boot3

    // B0: the boot team root re-adopts on restart (already live — the boot
    // gate above waited for it); its agent/created must NOT have been
    // vetoed (the fence only targets the configured dynamic root). The
    // probe state is fresh per host process (the JSONL is cleared per boot
    // too), so the FULL state is this boot's log.
    const allEventsB = await fenceEvents(o3)
    const bootCreated = allEventsB.find((e) => e.kind === 'agent/created' && e.sessionId === BOOT_ROOT) ?? null
    writeEvidence('legB', 'boot3-boot-root-events.json', { events: allEventsB })
    check('legB', 'B0 boot team root re-adopted on restart and NOT vetoed by the fence',
      bootCreated !== null && bootCreated.veto !== true,
      JSON.stringify(allEventsB.map((e) => ({ kind: e.kind, sid: String(e.sessionId ?? '').slice(-12), source: e.source, veto: e.veto }))).slice(0, 400))

    // B1: the fence was ARMED AT ROW LOAD (autoArm) — before the stock
    // host's boot-time session re-adoption — and the stock host's re-adopt
    // of the dynamic root (source=resume, boot-time — the run-8 discovery:
    // the stock host re-adopts every previously-live session at boot, and
    // that re-adoption is the writer steal, not only the browser follow)
    // has ALREADY been vetoed by the time the boot gate returns.
    const healthB = await fenceHealth(o3)
    // RUN-10 FIX (run 9 B1a false negative): the boot-gate event snapshot
    // (allEventsB, taken at the B0 point) can land BEFORE the glue's DYN
    // boot-resume veto (repro5 timeline: BOOT_ROOT re-adopt → DYN veto
    // ~150-600 ms later; the gate can return in that gap). Settle-wait for
    // the DYN agent/created event, then re-snapshot before the B1a check.
    {
      const deadline = Date.now() + 60_000
      for (;;) {
        const evs = await fenceEvents(o3)
        if (evs.some((e) => e.kind === 'agent/created' && e.sessionId === DYN_ROOT)) break
        if (Date.now() >= deadline) break
        await sleep(250)
      }
    }
    const bootVeto = (await fenceEvents(o3)).find((e) => e.kind === 'agent/created' && e.sessionId === DYN_ROOT && e.veto === true) ?? null
    writeEvidence('legB', 'boot3-autoarm-health.json', healthB.body ?? null)
    check('legB', 'B1 fence auto-armed at row load (before the stock boot re-adoption)',
      healthB.status === 200 && healthB.body?.armed === true, JSON.stringify(healthB.body ?? {}).slice(0, 200))
    check('legB', 'B1a BOOT-VETO: the stock host boot-time re-adopt of R1 was vetoed (source=resume) — the writer steal caught at the origin',
      bootVeto !== null && bootVeto.source === 'resume', JSON.stringify(bootVeto ?? null).slice(0, 250))

    if (KEEP_MODE) {
      writeEvidence('legB', 'keep-mode.json', {
        note: 'boot 3 held alive for the manual browser Q2 leg. Steps: (1) open the marker URL in a browser (legB/boot-3-marker.txt); (2) open the cold dynamic session (fence vetoes the ordinary promotion → api-session/error lands on the client); (3) observe the error lane (screenshot); (4) click 以 Team 模式 打开 (takeover); (5) observe whether the error persists after the successful takeover (screenshot); (6) kill -TERM the printed kit PID — the kit then writes the final verdict and tears the world down.',
        kitPid: process.pid,
        gui: o3,
        dynamicRoot: DYN_ROOT,
      })
      log(`KEEP MODE: boot 3 alive at ${o3} (fence auto-armed). Kit PID ${process.pid} — do the browser leg, then: kill -TERM ${process.pid}`)
      // The PROBE is a flat reject; the production C1 fence passes the
      // Team's OWN activation through (runOwned ownedDepth>0). Emulate that
      // for the browser's 以 Team 模式 打开 click: grant the one-shot permit
      // when the BROWSER-TRIGGERED foreign veto lands (not the boot-time
      // one — the boot veto predates any human; the 15s guard after the
      // keep banner separates the two). The subsequent Team-mode takeover
      // then consumes the permit and passes, so the Q2 question (error-lane
      // persistence AFTER a successful takeover) stays observable.
      const keepBannerAt = Date.now()
      void (async () => {
        for (;;) {
          const evs = await fenceEvents(o3).catch(() => [])
          const browserVeto = evs.find((e) => e.kind === 'agent/created' && e.sessionId === DYN_ROOT && e.veto === true && new Date(e.t).getTime() > keepBannerAt + 15_000)
          if (browserVeto !== undefined) {
            const per = await fencePermit(o3, DYN_ROOT).catch(() => null)
            log('KEEP MODE: browser-triggered veto observed — one-shot permit granted for the Team-mode takeover click')
            writeEvidence('legB', 'keep-permit-after-veto.json', { at: new Date().toISOString(), veto: browserVeto, permitted: per?.status === 200 && (per?.body?.permits ?? []).includes(DYN_ROOT) })
            return
          }
          await sleep(250)
        }
      })()
      await new Promise((resolveHold) => {
        process.once('SIGTERM', resolveHold)
        process.once('SIGINT', resolveHold)
      })
      log('hold released (SIGTERM) — collecting keep-mode evidence')
    } else {
      // Wire-mode leg B: the script plays the browser.
      // RUN-10 FIX: the B1a settle-wait above means the boot veto is
      // SETTLED before this socket opens — the follow's OWN background
      // promote is the only in-flight resume (repro5-runA ground truth: it
      // gets its own veto + its own api-session/error; the snapshot is
      // yielded FIRST and the socket/stream survive the rejection).
      markActivity('B2 openMux')
      const wsB = await openMux(o3, c3, 'legBC-follow')
      markActivity('B2 openEventsStream')
      const evBId = await openEventsStream(wsB)
      markActivity('B2 followSession')
      const followB = await followSession(wsB, DYN_ROOT).catch((e) => ({ error: String(e?.message ?? e) }))
      writeEvidence('legB', 'follow-dyn-root.json', followB.error !== undefined ? { error: followB.error } : { snapshotType: followB.snapshot?.type })
      check('legB', 'B2 session/follow(R1) snapshot arrives before the (background) promotion veto',
        followB.error === undefined, followB.error !== undefined ? followB.error : 'snapshot ok')
      // B2b: the stream SURVIVES the veto — the api-session/error frame for
      // the follow's own rejected promote must arrive ON THIS SOCKET (the
      // browser's data path) after the snapshot.
      markActivity('B2 check done')
      markActivity('B2b wait start')
      const vetoFrameB = await waitForEventFrame(wsB, evBId,
        (v) => v.event === 'api-session/error' && Array.isArray(v.args) && v.args[0] === DYN_ROOT, 30_000)
      markActivity('B2b wait end')
      check('legB', 'B2b the follow stream survives the rejection (the follow promote\u2019s api-session/error arrives on the same socket after the snapshot)',
        vetoFrameB !== null, JSON.stringify(vetoFrameB ?? null).slice(0, 300))
      // B2c: the mux socket itself is still open (repro4/repro5 ground
      // truth: the host never closes a follow socket; run 8/9's
      // "ws closed by host" is not reproducible in any isolated shape).
      check('legB', 'B2c the mux socket is still open after the rejection (no host-side close)',
        wsB.closed === false, `closed=${wsB.closed}`)
      dumpWsTraces('legB')

      // Q1 evidence: the FIRST veto of this boot is the boot-time one (B1a);
      // the follow's promotion, if it fired, was vetoed second. The probe
      // state is fresh per boot, so scan the whole state (first match wins).
      const q1 = { veto: null, disposed: null, apiError: null, deadline: Date.now() + 60_000 }
      for (;;) {
        markActivity('q1 poll')
        const events = await fenceEvents(o3)
        q1.veto ??= events.find((e) => e.kind === 'agent/created' && e.sessionId === DYN_ROOT && e.veto === true) ?? null
        q1.disposed ??= events.find((e) => e.kind === 'agent/disposed' && e.sessionId === DYN_ROOT) ?? null
        q1.apiError ??= events.find((e) => e.kind === 'api-session/error' && e.sessionId === DYN_ROOT) ?? null
        if (q1.veto !== null && q1.disposed !== null && q1.apiError !== null) break
        if (Date.now() >= q1.deadline) break
        await sleep(250)
      }
      const eventsB = await fenceEvents(o3)
      writeEvidence('legB', 'q1-events.json', { q1, all: eventsB })
      check('legB', 'B3 Q1: the fence veto fired on agent/created (source=resume)',
        q1.veto !== null && q1.veto.source === 'resume', JSON.stringify(q1.veto ?? null).slice(0, 250))
      check('legB', 'B4 Q1: agent/disposed arrived for the vetoed session (rollback completed)',
        q1.disposed !== null, JSON.stringify(q1.disposed ?? null).slice(0, 200))
      check('legB', 'B5 Q1: api-session/error surfaced (the SessionController promote() error surface, broadcast on the wire)',
        q1.apiError !== null, JSON.stringify(q1.apiError ?? null).slice(0, 300))

      const mockCountAtVeto = mock.requests.length
      writeEvidence('legB', 'q1-mock-at-veto.json', { count: mockCountAtVeto, tail: mock.requests.slice(-5).map((r) => ({ seq: r.seq, model: r.body?.model })) })

      // B6: the fence STAYS ARMED — the Team glue's own activation passes
      // through the one-shot permit (the production runOwned emulation),
      // mirroring guide §3 (the owned guard is pass-through, not disarm).
      const permitRes = await fencePermit(o3, DYN_ROOT)
      check('legB', "B6 fence stays armed; one-shot permit granted for R1 (the Team's own activation passes via the permit)",
        permitRes.status === 200 && (permitRes.body?.permits ?? []).includes(DYN_ROOT), JSON.stringify(permitRes.body ?? {}).slice(0, 200))
      const tAfterDisarm = new Date().toISOString()
      // Determinism: the follow's own promotion was vetoed second; its
      // AgentLoop rollback (store detach) must settle before the glue's
      // resume, or the agents store still holds the foreign entry and the
      // resume collides. Wait for probe-event quiescence on R1 (3s).
      {
        const deadline = Date.now() + 30_000
        let lastCount = -1
        let stableSince = 0
        for (;;) {
          const evs = await fenceEvents(o3)
          const n = evs.filter((e) => e.sessionId === DYN_ROOT).length
          if (n === lastCount) {
            if (stableSince === 0) stableSince = Date.now()
            else if (Date.now() - stableSince >= 3_000) break
          } else { lastCount = n; stableSince = 0 }
          if (Date.now() >= deadline) break
          await sleep(500)
        }
      }
      const ensureB = await remoteCall(o3, c3, 'team.ensureRootLive', { teamSessionId: DYN_ROOT }, 'rst-ensureB', 3)
      writeEvidence('legB', 'ensure-root-live-after-rollback.json', ensureB)
      const ensureBOk = ensureB.status === 200 && ensureB.body !== null && !JSON.stringify(ensureB.body).includes('"ok":false')
      check('legB', 'B7 Q1: team.ensureRootLive(R1) SUCCEEDS after the rollback (the writer was released)',
        ensureBOk, `status=${ensureB.status} bodyHead=${JSON.stringify(ensureB.body ?? {}).slice(0, 250)}`)

      const eventsB2 = await fenceEvents(o3)
      const teamResume = eventsB2.filter((e) => e.kind === 'agent/created' && e.sessionId === DYN_ROOT && e.permitted === true)
      writeEvidence('legB', 'team-takeover-events.json', { teamResumeEvents: teamResume })
      check('legB', 'B8 the Team\'s own resume fired exactly one permitted (non-vetoed) agent/created — the one-shot permit consumed by the owned activation',
        teamResume.length === 1, `count=${teamResume.length}`)

      // Drive the takeover turn: ensureRootLive only resumes the agent; the
      // model request happens on the next queued prompt (the Team leader
      // answers it with the full team_* surface + Team model selection).
      const promptB = await apiPrompt(o3, c3, DYN_ROOT, `Takeover verification. Answer with the token ${MK_DONE} and stop.`, 'rst-takeover')
      writeEvidence('legB', 'takeover-prompt-response.json', promptB)
      const dynTakeover = await waitForMockRequest(mock, MK_DONE, 120_000, 'team takeover first turn', tAfterDisarm, 'Takeover verification.')
      const dynTakeoverTools = dynTakeover !== null ? mockToolsOf(dynTakeover) : []
      writeEvidence('legB', 'team-takeover-first-request.json', dynTakeover === null ? { absent: true } : { seq: dynTakeover.seq, model: dynTakeover.body?.model, tools: dynTakeoverTools })
      check('legB', 'B9 takeover turn live on the mock with the Team tools (full surface retained)',
        dynTakeover !== null && dynTakeoverTools.some((t) => String(t).startsWith('team_')),
        `seq=${dynTakeover?.seq} teamTools=${dynTakeoverTools.filter((t) => String(t).startsWith('team_')).length}/${dynTakeoverTools.length}`)
      check('legB', 'B10 Q1: exactly one model request since the veto (the Team takeover turn — ZERO from the foreign agent)',
        mock.requests.length - mockCountAtVeto === (dynTakeover !== null ? 1 : 0),
        `requestsSinceVeto=${mock.requests.length - mockCountAtVeto}`)

      const logs = findSessionLogs(HOME, DYN_ROOT)
      const logStats = logs.map((p) => ({ path: p, ...countAssistantRows(p) }))
      writeEvidence('legB', 'session-log-files.json', logStats)
      check('legB', 'B11 session log intact and readable (durable rows present)', logs.length > 0 && logStats.every((s) => s.rows > 0),
        `files=${logs.length} rows=${logStats.map((s) => s.rows).join('+')} assistantRows=${logStats.map((s) => s.assistant).join('+')}`)

      // ── Leg C: the ordinary negative control (fence ARMED, unmanaged) ──
      log('── Leg C: ordinary session negative control (fence armed) ──')
      const armC = await fenceArmed(o3, true)
      check('legC', 'C0 fence re-armed for the ordinary control', armC.status === 200 && armC.body?.armed === true, '')
      // RUN-10 FIX: the ordinary session's agent/created fires with
      // source=startup AT create-time (session/create starts the agent), so
      // the fence baseline must be captured BEFORE the create — otherwise
      // the creation event is already in the baseline and C3 sees `[]`.
      const probeBaselineC = (await fenceEvents(o3)).length
      const ordCreate = await apiCreateSession(o3, c3, ORD_SESSION, WORKSPACE)
      check('legC', 'C1 ordinary session created via the public seam', ordCreate.status === 200, `status=${ordCreate.status} bodyHead=${JSON.stringify(ordCreate.body ?? {}).slice(0, 150)}`)
      let ordCreated = null
      {
        const deadline = Date.now() + 45_000
        for (;;) {
          const events = (await fenceEvents(o3)).slice(probeBaselineC)
          ordCreated = events.find((e) => e.kind === 'agent/created' && e.sessionId === ORD_SESSION) ?? null
          if (ordCreated !== null) break
          if (Date.now() >= deadline) break
          await sleep(250)
        }
      }
      const eventsC = (await fenceEvents(o3)).slice(probeBaselineC)
      writeEvidence('legC', 'probe-events-ordinary.json', eventsC)
      check('legC', 'C3 ordinary promotion passed the ARMED fence (no veto for unmanaged sessions)',
        ordCreated !== null && ordCreated.veto !== true,
        JSON.stringify(eventsC.map((e) => ({ kind: e.kind, sid: String(e.sessionId ?? '').slice(-12), veto: e.veto }))).slice(0, 300))
      // RUN-10 FIX: Leg C opens its OWN socket. Run 9's C2/C3 were cascade
      // artifacts — the kit reused wsB, which B2's close had already killed
      // ("immediate ws closed by host", C3 saw no promotion event).
      const wsC = await openMux(o3, c3, 'legC-follow')
      const followC = await followSession(wsC, ORD_SESSION).catch((e) => ({ error: String(e?.message ?? e) }))
      check('legC', 'C2 ordinary session/follow snapshot arrives (unaffected by the fence)', followC.error === undefined, followC.error !== undefined ? followC.error : 'ok')
      dumpWsTraces('legC')
      check('legC', 'C2b the ordinary follow socket is still open (no host-side close)', wsC.closed === false, `closed=${wsC.closed}`)
      wsB.close()
      wsC.close()
    }

    // ── teardown + verdict ──────────────────────────────────────────────
    if (KEEP_MODE) {
      // Final keep-mode evidence (the browser already did the Q2 leg).
      const eventsK = (await fenceEvents(boot3.origin)).catch(() => [])
      const probeJsonlPath = join(EVIDENCE_DIR, 'probe-events', 'fence-probe-events.jsonl')
      let probeJsonl = null
      try { probeJsonl = readFileSync(probeJsonlPath, 'utf8') } catch { /* absent */ }
      writeEvidence('legB', 'keep-final-probe-events.json', eventsK)
      if (probeJsonl !== null) writeEvidence('legB', 'keep-final-probe-events.jsonl', probeJsonl)
      writeEvidence('legB', 'keep-final-mock-requests.json', mock.requests)
      const logsK = findSessionLogs(HOME, DYN_ROOT)
      writeEvidence('legB', 'keep-session-log-files.json', logsK.map((p) => ({ path: p, ...countAssistantRows(p) })))
      const kDynCreated = eventsK.filter((e) => e.kind === 'agent/created' && e.sessionId === DYN_ROOT)
      const kDynDisposed = eventsK.filter((e) => e.kind === 'agent/disposed' && e.sessionId === DYN_ROOT)
      const kApiErrors = eventsK.filter((e) => e.kind === 'api-session/error' && e.sessionId === DYN_ROOT)
      const kVetoed = kDynCreated.filter((e) => e.veto === true)
      const kTeamResume = kDynCreated.filter((e) => e.veto !== true)
      const kTakeover = await remoteCall(boot3.origin, boot3.cookie, 'team.ensureRootLive', { teamSessionId: DYN_ROOT }, 'rst-keep-verify', 3).catch((e) => ({ status: 0, body: { error: String(e?.message ?? e) } }))
      writeEvidence('legB', 'keep-final-ensure-root-live.json', kTakeover)
      const kMockSinceVeto = kVetoed.length > 0
        ? mock.requests.filter((r) => (r.receivedAt ?? '') >= (kVetoed[0]?.t ?? '')).length
        : mock.requests.length
      const verdict = {
        mode: 'keep (browser Q2 leg done manually)',
        q1_writerReleased: kVetoed.length > 0 && kDynDisposed.length >= kVetoed.length,
        q1_takeoverSucceeded: kTakeover.status === 200,
        q1_teamResumeObserved: kTeamResume.length > 0,
        q1_modelRequestsAfterFirstVeto: kMockSinceVeto,
        q2_wireApiSessionError: kApiErrors[0] ?? null,
        q2_browserPersistent: 'OBSERVED MANUALLY — record the observation in the session report / browser-q2.md',
      }
      writeEvidence('verdict', 'q1-q2.json', verdict)
      check('legB', 'K1 keep-mode Q1: veto + disposed + Team resume + takeover all recorded',
        kVetoed.length > 0 && kDynDisposed.length >= kVetoed.length && kTeamResume.length > 0 && kTakeover.status === 200,
        JSON.stringify({ vetoes: kVetoed.length, disposed: kDynDisposed.length, teamResume: kTeamResume.length, apiErrors: kApiErrors.length, takeover: kTakeover.status }))
    }

    stopHost(boot3.child)
    liveHost = null
    await waitForPortFree(HOST_PORT)
    log('boot 3 stopped (SIGTERM)')
  } catch (e) {
    // Controlled failure: record the error, dump the live instance log,
    // tear the live host down, and fall through to the summary (no
    // uncaught-throw crash leaving orphaned hosts — the run-5 failure mode).
    const msg = String(e?.message ?? e)
    log(`UNEXPECTED ERROR in legs: ${msg}`)
    if (e?.stack) log(String(e.stack).split('\n').slice(1, 6).join('\n'))
    if (liveHost !== null) {
      try {
        writeEvidence('diagnostics', 'unexpected-error-instance-tail.log', logTail(liveHost.instanceLog, 60))
      } catch { /* best effort */ }
      stopHost(liveHost.child)
      await waitForPortFree(HOST_PORT).catch(() => {})
      liveHost = null
      log('live host stopped after unexpected error (SIGTERM)')
    }
    die(`unexpected error: ${msg}`)
    return finish(1)
  } finally {
    await mock.close()
  }

  const postStable = { p3080: await probePort(3080), p3180: await probePort(3180) }
  writeEvidence('s0-preflight', 'post-stable-probe.json', postStable)
  return finish(0)
}

function finish(code) {
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)
  writeEvidence('summary', 'checks.json', { stamp: RUN_STAMP, passed, failed: failed.length, results, lagEvents: globalThis.__rst017Lag?.events ?? [] })
  log(`summary: ${passed} passed, ${failed.length} failed`)
  for (const f of failed) log(`  FAIL [${f.leg}] ${f.name} — ${f.detail}`)
  log(`evidence: ${EVIDENCE_DIR}`)
  process.exitCode = code
}

main().catch((e) => {
  console.error('spike crashed:', e)
  process.exitCode = 1
})
