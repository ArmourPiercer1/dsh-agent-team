#!/usr/bin/env node
/**
 * ws-diag.mjs — verbose WebSocket protocol diagnostic against a REAL 0.1.7
 * gateway (phase0 spike side-tool; workspace-only, no product changes).
 *
 * Purpose: run 8 closed the mux socket frame-less ("ws closed by host", no
 * code) mid `session/follow` — the candidate is the heartbeat
 * (MAX_MISSED_HEARTBEATS=2 → socket.terminate(), no close frame). This
 * tool boots a resume host on the run-8 world, then connects a fully
 * INSTRUMENTED raw RFC6455 client (every frame logged: t, dir, opcode,
 * fin, len, payload head) and holds the connection to observe whether
 * PINGs arrive, PONGs go out, and exactly when/why the socket dies.
 *
 * Usage: node ws-diag.mjs <world-home> <dyn-session-id> [port] [seconds]
 */
import { spawn, spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import crypto from 'node:crypto'
import http from 'node:http'
import { openSync, readFileSync, writeFileSync, existsSync } from 'node:fs'

const MAIN_REPO = '/home/user/dsh-plugins/dsh-agent-team'
const TESTUSE = join(MAIN_REPO, 'tests', 'deepseek-harness-test-use')
const TESTUSE_PIN = '46a7f68b0922371ce7144b668b90e377d8e799f4'
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')

const HOME = process.argv[2]
const DYN_SESSION = process.argv[3]
const PORT = Number(process.argv[4] ?? 3493)
const HOLD_S = Number(process.argv[5] ?? 90)
if (!HOME || !DYN_SESSION) {
  console.error('usage: node ws-diag.mjs <world-home> <dyn-session-id> [port] [hold-seconds]')
  process.exit(2)
}
const WORKSPACE = join(HOME, 'workspace')
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'ws-diag')
const frames = []
const t0 = Date.now()
function t() { return Date.now() - t0 }
function logFrame(dir, opcode, fin, payload) {
  const head = payload.subarray(0, 1500)
  frames.push({
    t: t(), dir, op: opcode, fin: !!fin, len: payload.length,
    hex: head.toString('hex').slice(0, 80),
    text: head.toString('utf8').slice(0, 1500),
  })
  console.log(`[+${t()}ms] ${dir} op=0x${opcode.toString(16)} fin=${fin ? 1 : 0} len=${payload.length} ${JSON.stringify(head.toString('utf8').slice(0, 1500))}`)
}

class DiagSocket {
  constructor(url, cookie) {
    const u = new URL(url)
    this.host = u.hostname
    this.port = u.port ? Number(u.port) : 80
    this.path = u.pathname + u.search
    this.cookie = cookie
    this.socket = null
    this.buffer = Buffer.alloc(0)
    this.fragPayload = null
  }

  connect(timeoutMs = 20_000) {
    const req = http.request({
      host: this.host, port: this.port, path: this.path, method: 'GET',
      headers: {
        connection: 'Upgrade', upgrade: 'websocket',
        'sec-websocket-key': crypto.randomBytes(16).toString('base64'),
        'sec-websocket-version': '13',
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
    })
    let timer = setTimeout(() => { try { req.destroy() } catch {} }, timeoutMs)
    req.on('upgrade', (res, socket, head) => {
      clearTimeout(timer)
      if (res.statusCode !== 101) { console.log('upgrade rejected', res.statusCode); socket.destroy(); return }
      this.socket = socket
      socket.on('data', (chunk) => {
        this.buffer = Buffer.concat([this.buffer, chunk])
        this._pump()
      })
      socket.on('close', () => { logFrame('tcp', 0, false, Buffer.from('socket close (FIN/RST)')); this._done?.() })
      socket.on('error', (e) => console.log('socket error:', e.message))
      if (head.length > 0) { this.buffer = Buffer.concat([head, this.buffer]); this._pump() }
      console.log('WS CONNECTED')
    })
    req.on('response', (res) => { console.log('HTTP response instead of upgrade:', res.statusCode); res.resume() })
    req.on('error', (e) => console.log('req error:', e.message))
    req.end()
  }

  _rawFrame(opcode, payload) {
    if (this.socket === null || this.socket.destroyed) return
    const len = payload.length
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
    logFrame('tx', opcode, true, payload)
  }

  send(text) { this._rawFrame(0x1, Buffer.from(text, 'utf8')) }

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
        if (this.buffer.length < (this.fragPayload === null ? 4 : 3)) return
        payloadLen = this.buffer.readUInt16BE((this.fragPayload === null ? 4 : 3) - 2)
        offset = this.fragPayload === null ? 4 : 3
      } else if (payloadLen === 127) {
        if (this.buffer.length < (this.fragPayload === null ? 10 : 9)) return
        payloadLen = Number(this.buffer.readBigUInt64BE((this.fragPayload === null ? 10 : 9) - 2))
        offset = this.fragPayload === null ? 10 : 9
      }
      if (masked) {
        if (this.buffer.length < offset + 4 + payloadLen) return
        const mask = this.buffer.subarray(offset, offset + 4)
        offset += 4
        const payload = Buffer.from(this.buffer.subarray(offset, offset + payloadLen))
        this.buffer = this.buffer.subarray(offset + payloadLen)
        for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4]
        this._frame(opcode, fin, payload)
      } else {
        if (this.buffer.length < offset + payloadLen) return
        const payload = Buffer.from(this.buffer.subarray(offset, offset + payloadLen))
        this.buffer = this.buffer.subarray(offset + payloadLen)
        this._frame(opcode, fin, payload)
      }
    }
  }

  _frame(opcode, fin, payload) {
    if (opcode === 0x8) {
      let detail = 'no payload'
      if (payload.length >= 2) detail = `code=${payload.readUInt16BE(0)} reason=${JSON.stringify(payload.subarray(2).toString('utf8'))}`
      console.log(`HOST CLOSE FRAME: ${detail}`)
      logFrame('rx-close', opcode, fin, Buffer.from(`CLOSE ${detail}`))
      try { this._rawFrame(0x8, Buffer.from([0x3e, 0x00])) } catch {}
      setTimeout(() => { try { this.socket?.destroy() } catch {} this._done?.() }, 300)
      return
    }
    if (opcode === 0x9) {
      console.log('PING received — sending PONG')
      logFrame('rx', 9, fin, payload)
      this._rawFrame(0xA, payload)
      return
    }
    logFrame('rx', opcode, fin, payload)
  }
}

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function main() {
  const { mkdirSync } = await import('node:fs')
  const logPath = join(OUT, 'diag-host.log')
  try { const { rmSync } = await import('node:fs'); rmSync(OUT, { recursive: true, force: true }) } catch {}
  mkdirSync(OUT, { recursive: true })
  writeFileSync(logPath, '')
  const outFd = openSync(logPath, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(PORT), '--no-open'], {
    cwd: WORKSPACE,
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      DSH_HOME: HOME,
      DSH_CLIENT_COMMIT_HASH: TESTUSE_PIN.slice(0, 10),
    },
  })
  child.on('error', (e) => console.log('spawn error', e.message))
  // wait for boot marker
  let token = null
  const deadline = Date.now() + 180_000
  for (;;) {
    let text = ''
    try { text = readFileSync(logPath, 'utf8') } catch { /* not created yet */ }
    const m = BOOT_MARKER.exec(text)
    if (m !== null) { token = m[2]; break }
    if (Date.now() >= deadline) throw new Error('no boot marker in 180s')
    await new Promise((r) => setTimeout(r, 500))
  }
  const origin = `http://127.0.0.1:${PORT}`
  console.log('host up:', origin)
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  const cookie = setCookie !== null ? setCookie.split(';', 1)[0] : null
  console.log('cookie acquired:', cookie !== null)

  const ws = new DiagSocket(`${origin}/api/remote.mux`, cookie)
  ws.connect()
  await new Promise((r) => setTimeout(r, 1_000))
  ws.send(JSON.stringify({ type: 'open', streamId: 'ev-diag', endpoint: '$events', payload: { args: {} } }))
  await new Promise((r) => setTimeout(r, 1_500))
  ws.send(JSON.stringify({
    type: 'open', streamId: 'fol-diag', endpoint: 'session/follow',
    payload: { args: { request: { address: { kind: 'session', sessionId: DYN_SESSION } } } },
  }))
  console.log(`holding ${HOLD_S}s — watching frames...`)
  await new Promise((r) => setTimeout(r, HOLD_S * 1000))
  writeFileSync(join(OUT, 'frames.json'), JSON.stringify(frames, null, 2))
  console.log(`frames captured: ${frames.length} → ${join(OUT, 'frames.json')}`)
  try { child.kill('SIGTERM') } catch {}
  await new Promise((r) => setTimeout(r, 2_000))
  process.exit(0)
}
main().catch((e) => { console.error('diag failed:', e); try { process.exit(1) } catch {} })
