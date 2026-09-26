#!/usr/bin/env node
/**
 * RST017 run-20 keep-mode K1 reconstruction driver.
 *
 * The keep-mode kit (PID 3 in job bash-105's bwrap namespace) never received
 * its SIGTERM: job_kill destroyed the whole namespace (--die-with-parent)
 * before the `process.once('SIGTERM', resolveHold)` handler could run, so the
 * keep-final evidence block (spike.mjs :1549-1585) never executed. Host and
 * mock died with the namespace (ports freed), the WORLD HOME SURVIVED on
 * disk (workspace file), including the boot-3 patch layer (fence probe
 * reject=true, autoArm=true, reportDir = run-20 probe-events/).
 *
 * This driver boots host 4 on the SAME world, completes the missing live
 * checks, and writes the keep-final evidence files the kit would have
 * written, each annotated `reconstructed: true`.
 *
 * Steps:
 *   1. mock model @3497 (kit decide, MK_DONE = RST017DONE_2026-09-26T07-03-12)
 *   2. host @3492 with DSH_HOME = run-20 world (world's patch auto-loads the
 *      fence probe; the probe APPENDS to the surviving 10-event JSONL)
 *   3. wait boot marker → token → cookie
 *   4. fence health (expect armed=true reject=true teamSessions=[DYN])
 *   5. POST /__fence/permit (one-shot, the C1 runOwned pass-through emulation
 *      for the Team's own post-restart activation)
 *   6. team.ensureRootLive(DYN)  ← the missing kTakeover status
 *   7. write keep-final evidence (probe events live + jsonl, mock requests,
 *      session log scan, ensureRootLive result, verdict/q1-q2.json)
 *   8. SIGTERM host, wait ports free, exit
 */
import { spawn } from 'node:child_process'
import { openSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

const MAIN_REPO = '/home/user/dsh-plugins/dsh-agent-team'
const TESTUSE = join(MAIN_REPO, 'tests', 'deepseek-harness-test-use')
const TESTUSE_PIN = '46a7f68b0922371ce7144b668b90e377d8e799f4'
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const MOCK_MODULE = join(MAIN_REPO, '.worktrees', 'team-restart-017rc1', 'packages', 'tools', 'harness', 'mock-deepseek.mjs')
const WORLD = join(MAIN_REPO, 'tests', 'homes', 'rst017-spike-2026-09-26T07-03-12')
const EVID = join(MAIN_REPO, '.worktrees', 'team-restart-017rc1', 'dev', 'agent-workflow', 'evidence', 'restart-017rc1', 'phase0', 'run2026-09-26T07-03-12')
const DYN = 'session-rst017-dyn-2026-09-26T07-03-12'
const BOOT = 'session-rst017-boot-2026-09-26T07-03-12'
const HOST_PORT = 3492
const MOCK_PORT = 3497
const MK_DONE = 'RST017DONE_2026-09-26T07-03-12'
const INSTANCE_LOG = join(EVID, 'legB', 'instance-4-keepfinal.log')
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/

const log = (m) => console.log(`[rst017-keepfinal] ${m}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const writeEvidence = (leg, name, content) => {
  const p = join(EVID, leg, name)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n')
  return p
}
const fetchJson = async (url, init, timeoutMs = 60_000) => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ status: 0, body: null, error: e.message }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body }
}
const rpcBody = (method, params, version, tag) => JSON.stringify({
  type: 'client-request',
  rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
  method,
  payload: { version, params },
})
const remoteCall = (origin, cookie, method, params, tag, version = 1, timeoutMs = 240_000) =>
  fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: rpcBody(method, params, version, tag),
  }, timeoutMs)

// ── session log scan (ported verbatim from spike.mjs :880-995) ──────────────
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
const ZSTD_MAGIC = 0xfd2fb528
function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) break
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) break
    offset += 4
    if (offset === buffer.length) break
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    if ((descriptor & 0x18) !== 0) break
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 0x20) !== 0
    const checksum = (descriptor & 0x04) !== 0
    const dictionaryFlag = descriptor & 0x03
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
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
      if (blockType === 0x03) break
      const payloadBytes = blockType === 0x01 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) break
      offset += payloadBytes
      if (lastBlock) { complete = true; break }
    }
    if (!complete) break
    if (checksum) { if (buffer.length - offset < 4) break; offset += 4 }
    frames.push({ start, end: offset })
  }
  return frames
}
function countAssistantRows(path) {
  let raw = readFileSync(path)
  if (path.endsWith('.zstd')) {
    const parts = []
    for (const r of scanZstdFrames(raw)) {
      try { parts.push(zstdDecompressSync(raw.subarray(r.start, r.end)).toString('utf8')) } catch { break }
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
      if (role === 'assistant' || role === 'assistant/message') assistant += 1
    } catch { rowTypes.push('!') }
  }
  return { rows: total, assistant, rowTypes }
}

async function waitForLogLine(logPath, regex, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let last = -1
  for (;;) {
    try {
      const text = readFileSync(logPath, 'utf8')
      if (text.length > last) {
        last = text.length
        const m = text.match(regex)
        if (m) return m
      }
    } catch { /* not yet */ }
    if (Date.now() >= deadline) return null
    await sleep(250)
  }
}
async function probePort(port) {
  try { const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(5_000) }); return res.status !== 0 } catch { return false }
}
async function waitForPortFree(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (!(await probePort(port))) return true
    if (Date.now() >= deadline) return false
    await sleep(300)
  }
}

const main = async () => {
  if (!(await waitForPortFree(HOST_PORT, 10_000) && await waitForPortFree(MOCK_PORT, 10_000))) die('port 3492/3497 not free — leftover process?')

  // 1. mock
  const { startMockModel: startMock } = await import(pathToFileURL(MOCK_MODULE).href)
  const decide = ({ req }) => {
    const msgs = req?.messages ?? []
    const userText = msgs.filter((m) => m?.role === 'user')
      .map((m) => (typeof m.content === 'string' ? m.content
        : Array.isArray(m.content) ? m.content.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join('') : ''))
      .filter((t) => t.length > 0).join('\n')
    if (userText.includes(MK_DONE)) return { kind: 'text', content: `RST017_DONE ${MK_DONE}` }
    return { kind: 'text', content: 'rst017 spike ack' }
  }
  const mock = await startMock({ port: MOCK_PORT, decide, log: () => {} })
  log(`mock model up @ ${MOCK_PORT}`)

  // 2. host 4 on the surviving run-20 world (world patch auto-loads the fence probe)
  const outFd = openSync(INSTANCE_LOG, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
    cwd: join(WORLD, 'workspace'),
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      DSH_HOME: WORLD,
      DSH_CLIENT_COMMIT_HASH: TESTUSE_PIN.slice(0, 10),
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
      DEEPSEEK_API_KEY: 'rst017-spike-mock-key',
    },
  })
  const alive = { exited: false }
  child.on('close', () => { alive.exited = true })
  log('host 4 spawning on world rst017-spike-2026-09-26T07-03-12 …')

  // 3. marker → token → cookie
  const marker = await waitForLogLine(INSTANCE_LOG, BOOT_MARKER, 300_000)
  if (marker === null || alive.exited) {
    child.kill('SIGTERM')
    die(`host 4 failed to boot within 300s`)
  }
  const origin = `http://127.0.0.1:${marker[1]}`
  const authRes = await fetch(`${origin}/?token=${marker[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = authRes.headers.getSetCookie?.() ?? []
  if (setCookie.length === 0) die(`auth returned no set-cookie (HTTP ${authRes.status})`)
  const cookie = setCookie.join('; ')
  log(`host 4 up: ${origin} (cookie ok)`)

  const fence = (p, init) => fetchJson(`${origin}${p}`, init ?? { method: 'GET' }, 30_000)
  try {
    // 4. fence state after auto-arm
    const health = await fence('/__fence/health')
    log(`fence health: ${JSON.stringify(health.body)}`)
    if (!(health.body?.armed && health.body?.reject && (health.body?.teamSessions ?? []).includes(DYN))) {
      log('WARN: fence not in the expected reject+autoArm state — continuing, evidence will show it')
    }

    // 5. one-shot permit (C1 runOwned pass-through emulation for the Team's own activation)
    const per = await fence('/__fence/permit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: DYN }),
    })
    log(`permit: status=${per.status} body=${JSON.stringify(per.body)}`)

    // 6. the missing K1 live check
    const kTakeover = await remoteCall(origin, cookie, 'team.ensureRootLive', { teamSessionId: DYN }, 'rst-keep-verify-4', 3).catch((e) => ({ status: 0, body: { error: String(e?.message ?? e) } }))
    log(`ensureRootLive(DYN): status=${kTakeover.status} body=${JSON.stringify(kTakeover.body).slice(0, 400)}`)

    // 7. keep-final evidence (reconstructed)
    const eventsK = (await fence('/__fence/events')).body?.events ?? []
    writeEvidence('legB', 'keep-final-probe-events.json', { reconstructed: true, at: new Date().toISOString(), note: 'live GET /__fence/events after host-4 ensureRootLive (the kit would have written this on SIGTERM)', events: eventsK })
    let probeJsonl = null
    try { probeJsonl = readFileSync(join(EVID, 'probe-events', 'fence-probe-events.jsonl'), 'utf8') } catch { /* absent */ }
    if (probeJsonl !== null) writeEvidence('legB', 'keep-final-probe-events.jsonl', probeJsonl)
    writeEvidence('legB', 'keep-final-mock-requests.json', {
      reconstructed: true,
      note: 'host 4 mock instance request log only — the boot-1..3 mock instances died with job bash-105 namespace; their in-memory request logs were never flushed to disk',
      requests: mock.requests,
    })
    const logsK = findSessionLogs(WORLD, DYN)
    writeEvidence('legB', 'keep-session-log-files.json', { reconstructed: true, note: 'offline scan of the surviving world home', files: logsK.map((p) => ({ path: p, ...countAssistantRows(p) })) })
    writeEvidence('legB', 'keep-final-ensure-root-live.json', { reconstructed: true, at: new Date().toISOString(), call: 'team.ensureRootLive(DYN_ROOT) on host 4 after one-shot permit', ...kTakeover })

    const kDynCreated = eventsK.filter((e) => e.kind === 'agent/created' && e.sessionId === DYN)
    const kDynDisposed = eventsK.filter((e) => e.kind === 'agent/disposed' && e.sessionId === DYN)
    const kApiErrors = eventsK.filter((e) => e.kind === 'api-session/error' && e.sessionId === DYN)
    const kVetoed = kDynCreated.filter((e) => e.veto === true)
    const kTeamResume = kDynCreated.filter((e) => e.veto !== true)
    const kMockSinceVeto = kVetoed.length > 0
      ? mock.requests.filter((r) => (r.receivedAt ?? '') >= (kVetoed[0]?.t ?? '')).length
      : mock.requests.length
    const verdict = {
      mode: 'keep (browser Q2 leg done manually) — keep-final reconstructed by keepfinal.mjs (kit SIGTERM handler never ran: job_kill destroyed the bwrap namespace)',
      reconstructed: true,
      q1_writerReleased: kVetoed.length > 0 && kDynDisposed.length >= kVetoed.length,
      q1_takeoverSucceeded: kTakeover.status === 200,
      q1_teamResumeObserved: kTeamResume.length > 0,
      q1_modelRequestsAfterFirstVeto: kMockSinceVeto,
      q2_wireApiSessionError: kApiErrors[0] ?? null,
      q2_browserPersistent: 'YES within the veto page load; NO across reload — see legB/q2-browser/Q2-FINDING.md',
    }
    writeEvidence('verdict', 'q1-q2.json', verdict)
    const k1 = kVetoed.length > 0 && kDynDisposed.length >= kVetoed.length && kTeamResume.length > 0 && kTakeover.status === 200
    log(`${k1 ? 'PASS' : 'FAIL'} [legB] K1 keep-mode Q1: veto + disposed + Team resume + takeover all recorded — ${JSON.stringify({ vetoes: kVetoed.length, disposed: kDynDisposed.length, teamResume: kTeamResume.length, apiErrors: kApiErrors.length, takeover: kTakeover.status })}`)
    writeEvidence('legB', 'keep-final-reconstruction.md', `# keep-final reconstruction (host 4)\n\n- At: ${new Date().toISOString()}\n- Reason: the keep kit (PID 3, job bash-105) never received SIGTERM — job_kill destroyed the bwrap namespace (--die-with-parent) so the SIGTERM hold-release + keep-final block (spike.mjs :1549-1585) never ran. Host+mock died with the namespace (ports freed); the world home survived on disk with the boot-3 patch layer (probe reject=true autoArm=true) intact.\n- This driver booted host 4 on the same world and completed: fence health, one-shot permit, team.ensureRootLive(DYN) [the missing kTakeover status], probe events (live + JSONL), mock requests [host-4 instance only], session log scan, verdict/q1-q2.json, K1.\n- K1 result: ${k1 ? 'PASS' : 'FAIL'}\n`)
  } finally {
    child.kill('SIGTERM')
    await sleep(2_000)
    const hFree = await waitForPortFree(HOST_PORT, 30_000)
    await mock.close?.()
    await waitForPortFree(MOCK_PORT, 30_000)
    log(`teardown: host 3492 free=${hFree}, mock stopped`)
  }
}
function die(msg) { console.error(`[rst017-keepfinal] FATAL: ${msg}`); process.exit(1) }
main().catch((e) => die(String(e?.stack ?? e)))
