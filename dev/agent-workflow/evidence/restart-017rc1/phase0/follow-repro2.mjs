#!/usr/bin/env node
/**
 * follow-repro2.mjs — which DYN-root follow shape kills the mux socket?
 *
 * World: run 9's (fence patch already reject=true autoArm=true
 * teamSessions=[DYN]). Boot ⇒ fence auto-arms at row load; the glue's
 * boot-resume loop resumes BOOT_ROOT, then DYN — DYN is VETOED at boot
 * (≈ +280 ms), rolled back (agent/disposed), api-session/error emitted.
 *
 * Variants (fresh socket each, RAW byte capture):
 *   V1: follow DYN AFTER the boot veto settled (cold, prepared, no permit)
 *       → snapshot + background promote → veto. Socket survive?
 *   V2: open the follow IMMEDIATELY (race the glue boot-resume) → legB shape
 *   V3: permit DYN first, wait, then follow → promote PASSES (live takeover
 *       via the follow path — the production-equivalent browser open).
 *
 * Usage: node follow-repro2.mjs [port]
 */
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import crypto from 'node:crypto'
import http from 'node:http'
import { openSync, readFileSync, writeFileSync, mkdirSync, rmSync, appendFileSync } from 'node:fs'

const MAIN_REPO = '/home/user/dsh-plugins/dsh-agent-team'
const TESTUSE = join(MAIN_REPO, 'tests', 'deepseek-harness-test-use')
const WORKTREE = join(MAIN_REPO, '.worktrees', 'team-restart-017rc1')
const TESTUSE_PIN = '46a7f68b0922371ce7144b668b90e377d8e799f4'
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const HOME = join(MAIN_REPO, 'tests', 'homes', 'rst017-spike-2026-09-26T04-32-14')
const DYN = 'session-rst017-dyn-2026-09-26T04-32-14'
const PORT = Number(process.argv[2] ?? 3496)
const MOCK_PORT = Number(process.argv[3] ?? 3499)
const OUT = join(MAIN_REPO, 'dev', 'agent-workflow', 'evidence', 'restart-017rc1', 'phase0', 'follow-repro2')
const t0 = Date.now()
const t = () => Date.now() - t0
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let rawLog = ''
function rawDump(tag, dir, chunk) {
  const hex = chunk.toString('hex')
  const ascii = chunk.toString('latin1').replace(/[^\x20-\x7e]/g, '.')
  appendFileSync(rawLog, `[${tag} +${t()}ms] ${dir} ${chunk.length}B ${hex}\n      ${ascii}\n`)
}

class RawSocket {
  constructor(tag, url, cookie) {
    this.tag = tag
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
    this.closeCode = null
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
      if (res.statusCode !== 101) { console.log(`${this.tag}: upgrade rejected`, res.statusCode); socket.destroy(); return }
      this.socket = socket
      socket.on('data', (c) => { rawDump(this.tag, 'rx', c); this.buffer = Buffer.concat([this.buffer, c]); this._pump() })
      socket.on('close', () => { this.closedAt = t(); console.log(`${this.tag}: SOCKET CLOSED by peer at +${this.closedAt}ms (closeCode=${this.closeCode})`) })
      socket.on('error', (e) => console.log(`${this.tag}: socket error:`, e.message))
      if (head.length) { rawDump(this.tag, 'rx(head)', head); this.buffer = Buffer.concat([head, this.buffer]); this._pump() }
      console.log(`${this.tag}: WS CONNECTED at +${t()}ms`)
    })
    req.on('response', (r) => { console.log(`${this.tag}: HTTP response (no upgrade):`, r.statusCode); r.resume() })
    req.on('error', (e) => console.log(`${this.tag}: req error:`, e.message))
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
    rawDump(this.tag, 'tx', frame)
    this.socket.write(frame)
  }
  send(text) { this._rawFrame(0x1, Buffer.from(text, 'utf8')) }
  openFollow() {
    const streamId = `fol-${this.tag.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`
    this.send(JSON.stringify({
      type: 'open', streamId, endpoint: 'session/follow',
      payload: { args: { request: { address: { kind: 'session', sessionId: DYN } } } },
    }))
    return streamId
  }
  _pump() {
    for (;;) {
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
      this.closeCode = payload.length >= 2 ? payload.readUInt16BE(0) : null
      console.log(`${this.tag}: HOST CLOSE FRAME at +${t()}ms: ${detail}`)
      return
    }
    if (opcode === 0x9) { this._rawFrame(0xA, payload); return }
    if (opcode === 0xA) return
    if (opcode !== 0x1) { console.log(`${this.tag}: unexpected opcode`, opcode); return }
    if (this.frag === null) this.frag = []
    this.frag.push(payload)
    if (fin) {
      const text = Buffer.concat(this.frag).toString('utf8'); this.frag = null
      const short = text.length > 220 ? text.slice(0, 220) + '…' : text
      console.log(`${this.tag}: MSG +${t()}ms: ${short}`)
      this.messages.push(text)
    }
  }
  async waitSnapshot(streamId, timeoutMs = 15_000) {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      if (this.messages.length > 0) {
        const m = JSON.parse(this.messages.shift())
        if (m?.streamId !== streamId) { this.messages.unshift(m); break }
        if (m.type === 'error') return { kind: 'error', error: m.error }
        if (m.type === 'item' && m.value?.type === 'snapshot') return { kind: 'snapshot' }
        if (m.type === 'item' && m.value?.type === 'ready') { /* events stream; skip */ }
        break
      }
      if (this.closedAt !== null) return { kind: 'closed', at: this.closedAt }
      if (Date.now() >= deadline) return { kind: 'timeout' }
      await sleep(50)
    }
    return { kind: 'no-stream-frame' }
  }
}

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function main() {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  rawLog = join(OUT, 'raw-bytes.log')
  writeFileSync(rawLog, '')
  const { startMockModel: startMock } = await import(pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')).href)
  const mock = startMock({ port: MOCK_PORT, decide: () => ({ kind: 'text', content: 'repro2 ack' }), log: () => {} })
  console.log('mock up @', MOCK_PORT)
  const logPath = join(OUT, 'host.log')
  writeFileSync(logPath, '')
  const outFd = openSync(logPath, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(PORT), '--no-open'], {
    cwd: join(HOME, 'workspace'), stdio: ['ignore', outFd, outFd],
    env: { ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: TESTUSE_PIN.slice(0, 10), DEEPSEEK_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`, DEEPSEEK_API_KEY: 'repro2-key' },
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
    await sleep(500)
  }
  const origin = `http://127.0.0.1:${PORT}`
  console.log('host up at +', t(), 'ms:', origin)
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  const cookie = setCookie !== null ? setCookie.split(';', 1)[0] : null
  console.log('cookie acquired:', cookie !== null)
  const summary = {}

  // V2 first: race the glue boot-resume (legB shape — follow opened right
  // after connection, DYN veto lands mid-stream-setup).
  console.log('--- V2: follow DYN immediately (race glue boot-resume) ---')
  const ws2 = new RawSocket('V2', `${origin}/api/remote.mux`, cookie)
  ws2.connect()
  await sleep(300)
  const sid2 = ws2.openFollow()
  summary.v2 = await ws2.waitSnapshot(sid2, 12_000)
  await sleep(2_000)
  summary.v2.closedAt = ws2.closedAt
  try { ws2.socket?.destroy() } catch {}
  await sleep(500)

  // Settle: the boot veto (if not already) + rollback.
  await sleep(4_000)

  // V1: follow cold DYN (veto settled, no permit).
  console.log('--- V1: follow cold DYN after boot veto settled ---')
  const ws1 = new RawSocket('V1', `${origin}/api/remote.mux`, cookie)
  ws1.connect()
  await sleep(300)
  const sid1 = ws1.openFollow()
  summary.v1 = await ws1.waitSnapshot(sid1, 12_000)
  await sleep(2_000)
  summary.v1.closedAt = ws1.closedAt
  try { ws1.socket?.destroy() } catch {}
  await sleep(500)

  // V3: permit DYN, wait for the glue? (no — permit alone does not resume;
  // the follow's promote consumes it), then follow.
  console.log('--- V3: permit DYN then follow (takeover via the follow path) ---')
  const permit = await fetch(`${origin}/__fence/permit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: DYN }),
    signal: AbortSignal.timeout(15_000),
  })
  console.log('permit ->', permit.status)
  const ws3 = new RawSocket('V3', `${origin}/api/remote.mux`, cookie)
  ws3.connect()
  await sleep(300)
  const sid3 = ws3.openFollow()
  summary.v3 = await ws3.waitSnapshot(sid3, 15_000)
  await sleep(3_000)
  summary.v3.closedAt = ws3.closedAt
  summary.v3.msgCount = ws3.messages.length
  try { ws3.socket?.destroy() } catch {}
  await sleep(500)

  writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))
  console.log('summary ->', JSON.stringify(summary, null, 2))
  console.log('raw bytes ->', rawLog)
  try { child.kill('SIGTERM') } catch {}
  await sleep(2_000)
  try { await mock?.close?.() } catch { try { mock?.stop?.() } catch {} }
  process.exit(0)
}
main().catch((e) => { console.error('repro2 failed:', e); process.exit(1) })
