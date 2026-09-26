#!/usr/bin/env node
/**
 * follow-repro.mjs — minimal isolation of the run-9 "ws closed by host".
 *
 * Question: does opening `session/follow` on a LIVE session make the 0.1.7
 * gateway hard-terminate the /api/remote.mux socket (no WS close frame)?
 * Repro WITHOUT the team plugin / fence: create one fresh ordinary session
 * over the public seam, then follow it. Captures EVERY raw TCP byte (hex +
 * ascii, timestamped) so the host's last words are exact.
 *
 * Variants per boot:
 *   A: $events + follow on one socket   (spike shape)
 *   B: follow only (no $events)         (isolate the multiplex)
 *
 * Usage: node follow-repro.mjs <world-home> [port]
 */
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import crypto from 'node:crypto'
import http from 'node:http'
import { openSync, readFileSync, writeFileSync, mkdirSync, rmSync, appendFileSync } from 'node:fs'

const MAIN_REPO = '/home/user/dsh-plugins/dsh-agent-team'
const TESTUSE = join(MAIN_REPO, 'tests', 'deepseek-harness-test-use')
const TESTUSE_WORKTREE = join(MAIN_REPO, '.worktrees', 'team-restart-017rc1')
const TESTUSE_PIN = '46a7f68b0922371ce7144b668b90e377d8e799f4'
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const { existsSync } = await import('node:fs')
// Run on an ALREADY-INSTALLED team world (default: run 9's) with a LIVE
// mock — identical boot conditions to the spike (a dead-mock-port boot
// hangs pre-URL; observed). The repro follows a FRESH ordinary session, so
// the team glue/fence state is inert for the followed session.
const HOME = process.argv[2] ?? join(MAIN_REPO, 'tests', 'homes', 'rst017-spike-2026-09-26T04-32-14')
const PORT = Number(process.argv[3] ?? 3495)
const MOCK_PORT = Number(process.argv[4] ?? 3498)
if (!existsSync(join(HOME, 'profiles'))) {
  console.error('world has no profile dir:', HOME)
  process.exit(2)
}
const WORKSPACE = join(HOME, 'workspace')
const OUT = join(dirname0(), 'follow-repro')
const t0 = Date.now()
const t = () => Date.now() - t0
function dirname0() { return join(MAIN_REPO, 'dev', 'agent-workflow', 'evidence', 'restart-017rc1', 'phase0') }

const rawLog = join(OUT, 'raw-bytes.log')
function rawDump(dir, chunk) {
  const hex = chunk.toString('hex')
  const ascii = chunk.toString('latin1').replace(/[^\x20-\x7e]/g, '.')
  appendFileSync(rawLog, `[+${t()}ms] ${dir} ${chunk.length}B ${hex}\n      ${ascii}\n`)
}

class RawSocket {
  constructor(url, cookie) {
    const u = new URL(url)
    this.host = u.hostname
    this.port = u.port ? Number(u.port) : 80
    this.path = u.pathname + u.search
    this.cookie = cookie
    this.socket = null
    this.buffer = Buffer.alloc(0)
    this.frag = null
    this.messages = []
    this.closedAt = null
  }
  connect() {
    const req = http.request({
      host: this.host, port: this.port, path: this.path, method: 'GET',
      headers: {
        connection: 'Upgrade', upgrade: 'websocket',
        'sec-websocket-key': crypto.randomBytes(16).toString('base64'),
        'sec-websocket-version': '13',
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
    })
    req.on('upgrade', (res, socket, head) => {
      if (res.statusCode !== 101) { console.log('upgrade rejected', res.statusCode); socket.destroy(); return }
      this.socket = socket
      socket.on('data', (c) => { rawDump('rx', c); this.buffer = Buffer.concat([this.buffer, c]); this._pump() })
      socket.on('close', () => { this.closedAt = t(); console.log(`SOCKET CLOSED by peer at +${this.closedAt}ms`) })
      socket.on('error', (e) => console.log('socket error:', e.message))
      if (head.length) { rawDump('rx(head)', head); this.buffer = Buffer.concat([head, this.buffer]); this._pump() }
      console.log('WS CONNECTED at +', t(), 'ms')
    })
    req.on('response', (r) => { console.log('HTTP response (no upgrade):', r.statusCode); r.resume() })
    req.on('error', (e) => console.log('req error:', e.message))
    req.end()
  }
  _rawFrame(opcode, payload) {
    if (this.socket === null || this.socket.destroyed) return
    const len = payload.length
    let header
    if (len < 126) header = Buffer.from([0x80 | opcode, 0x80 | len])
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2) }
    else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2) }
    const mask = crypto.randomBytes(4)
    const masked = Buffer.from(payload)
    for (let i = 0; i < masked.length; i += 1) masked[i] ^= mask[i % 4]
    const frame = Buffer.concat([header, mask, masked])
    rawDump('tx', frame)
    this.socket.write(frame)
  }
  send(text) { this._rawFrame(0x1, Buffer.from(text, 'utf8')) }
  _pump() {
    // Server frames: unmasked, never fragmented by the host (small JSON).
    // Continuation frames are still tolerated (offset logic is shared).
    for (;;) {
      // Every frame (initial or continuation) has a 2-byte header:
      // [fin|opcode, lenbyte]. Continuations carry opcode 0 by definition.
      const isCont = this.frag !== null
      if (this.buffer.length < 2) return
      const fin = (this.buffer[0] & 0x80) !== 0
      const opcode = isCont ? 0x0 : (this.buffer[0] & 0x0f)
      const b1 = this.buffer[1]
      const masked = (b1 & 0x80) !== 0
      let n = b1 & 0x7f
      let off = 2
      if (n === 126) { if (this.buffer.length < off + 2) return; n = this.buffer.readUInt16BE(off); off += 2 }
      else if (n === 127) { if (this.buffer.length < off + 8) return; n = Number(this.buffer.readBigUInt64BE(off)); off += 8 }
      let payload
      if (masked) {
        if (this.buffer.length < off + 4 + n) return
        const mask = this.buffer.subarray(off, off + 4); off += 4
        payload = Buffer.from(this.buffer.subarray(off, off + n)); this.buffer = this.buffer.subarray(off + n)
        for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4]
      } else {
        if (this.buffer.length < off + n) return
        payload = Buffer.from(this.buffer.subarray(off, off + n)); this.buffer = this.buffer.subarray(off + n)
      }
      this._frame(opcode, fin, payload)
    }
  }
  _frame(opcode, fin, payload) {
    if (opcode === 0x8) {
      const detail = payload.length >= 2 ? `code=${payload.readUInt16BE(0)} reason=${JSON.stringify(payload.subarray(2).toString('utf8'))}` : 'no payload'
      console.log(`HOST CLOSE FRAME at +${t()}ms: ${detail}`)
      return
    }
    if (opcode === 0x9) { this._rawFrame(0xA, payload); return }
    if (opcode === 0xA) return
    if (opcode !== 0x1) { console.log('unexpected opcode', opcode); return }
    if (this.frag === null) this.frag = []
    this.frag.push(payload)
    if (fin) {
      const text = Buffer.concat(this.frag).toString('utf8'); this.frag = null
      const short = text.length > 300 ? text.slice(0, 300) + '…' : text
      console.log(`MSG +${t()}ms: ${short}`)
      this.messages.push(text)
    }
  }
}

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function main() {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  // Live mock — the boot's model-provider init must succeed (dead port
  // hangs pre-URL, observed in the A/B boot test).
  const { startMockModel: startMock } = await import(pathToFileURL(join(TESTUSE_WORKTREE, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')).href)
  const mock = startMock({ port: MOCK_PORT, decide: () => ({ kind: 'text', content: 'repro ack' }), log: () => {} })
  console.log('mock model up @', MOCK_PORT)
  const logPath = join(OUT, 'host.log')
  writeFileSync(logPath, '')
  const outFd = openSync(logPath, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(PORT), '--no-open'], {
    cwd: WORKSPACE, stdio: ['ignore', outFd, outFd],
    env: { ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: TESTUSE_PIN.slice(0, 10), DEEPSEEK_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`, DEEPSEEK_API_KEY: 'repro-key' },
  })
  child.on('error', (e) => console.log('spawn error', e.message))
  let token = null
  const deadline = Date.now() + 180_000
  for (;;) {
    let text = ''
    try { text = readFileSync(logPath, 'utf8') } catch {}
    const m = BOOT_MARKER.exec(text)
    if (m !== null) { token = m[2]; break }
    if (Date.now() >= deadline) throw new Error('no boot marker')
    await new Promise((r) => setTimeout(r, 500))
  }
  const origin = `http://127.0.0.1:${PORT}`
  console.log('host up:', origin)
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  const cookie = setCookie !== null ? setCookie.split(';', 1)[0] : null
  console.log('cookie acquired:', cookie !== null)

  const stamp = Date.now()
  const ordId = `session-repro-ord-${stamp}`
  const create = await fetch(`${origin}/api/session/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ type: 'client-request', rpcId: `repro-create-${stamp}`, method: 'session/create', payload: { args: { request: { sessionId: ordId, cwd: WORKSPACE } } } }),
    signal: AbortSignal.timeout(60_000),
  })
  const createBody = await create.text()
  console.log('create session ->', create.status, createBody.slice(0, 200))

  // Variant A: $events + follow (spike shape)
  console.log('--- Variant A: $events + follow ---')
  const wsA = new RawSocket(`${origin}/api/remote.mux`, cookie)
  wsA.connect()
  await new Promise((r) => setTimeout(r, 800))
  wsA.send(JSON.stringify({ type: 'open', streamId: 'ev-A', endpoint: '$events', payload: { args: {} } }))
  await new Promise((r) => setTimeout(r, 800))
  wsA.send(JSON.stringify({ type: 'open', streamId: 'fol-A', endpoint: 'session/follow', payload: { args: { request: { address: { kind: 'session', sessionId: ordId } } } } }))
  await new Promise((r) => setTimeout(r, 8_000))
  console.log(`Variant A result: closedAt=${wsA.closedAt}ms messages=${wsA.messages.length}`)
  try { wsA.socket?.destroy() } catch {}
  await new Promise((r) => setTimeout(r, 500))

  // Variant B: follow only
  console.log('--- Variant B: follow only ---')
  const wsB = new RawSocket(`${origin}/api/remote.mux`, cookie)
  wsB.connect()
  await new Promise((r) => setTimeout(r, 800))
  wsB.send(JSON.stringify({ type: 'open', streamId: 'fol-B', endpoint: 'session/follow', payload: { args: { request: { address: { kind: 'session', sessionId: ordId } } } } }))
  await new Promise((r) => setTimeout(r, 8_000))
  console.log(`Variant B result: closedAt=${wsB.closedAt}ms messages=${wsB.messages.length}`)
  try { wsB.socket?.destroy() } catch {}
  await new Promise((r) => setTimeout(r, 500))

  writeFileSync(join(OUT, 'summary.json'), JSON.stringify({ ordId, createStatus: create.status, createBody: createBody.slice(0, 400) }, null, 2))
  console.log('raw bytes ->', rawLog)
  try { child.kill('SIGTERM') } catch {}
  await new Promise((r) => setTimeout(r, 2_000))
  try { await mock?.close?.() } catch { try { mock?.stop?.() } catch {} }
  process.exit(0)
}
main().catch((e) => { console.error('repro failed:', e); process.exit(1) })
