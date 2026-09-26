// repro6-spike-client.mjs — the SPIKE's RemoteMuxSocket class, verbatim,
// with raw 'data' event logging, run standalone against a live host.
// Answers: do the heartbeat PING bytes ever reach the spike client?
import crypto from 'node:crypto'
import http from 'node:http'
import { setTimeout as sleepMs } from 'node:timers/promises'
const wsTraceSink = []
function writeEvidence(tag, name, data) { /* no-op */ }
const t0 = Date.now()
const t = () => Date.now() - t0
const log = (m) => console.log(`[repro6 +${t()}ms] ${m}`)
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
        payloadLen = Number(this.buffer.readBigUInt64BE(need - 2))
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

const [,, originArg, cookieArg] = process.argv
if (!originArg || !cookieArg) { console.error('usage: node repro6-spike-client.mjs <origin> <cookie>'); process.exit(2) }
const origin = originArg.replace(/^http/, 'ws')
const ws = new RemoteMuxSocket(origin + '/api/remote.mux', { cookie: cookieArg })
ws.label = 'repro6'
await ws.connect()
log('WS CONNECTED')
// Raw data logging BEFORE the class's _attach? No — the class attaches its
// own 'data' listener; add a SECOND raw listener that logs every chunk.
ws.socket.on('data', (c) => {
  const hdr = c.length >= 2 ? `b0=0x${c[0].toString(16)} b1=0x${c[1].toString(16)} op=${c[1] & 0x0f}` : 'short'
  const note = (c[1] & 0x0f) === 0x9 ? ' <== PING' : (c[1] & 0x0f) === 0xa ? ' <== PONG?' : (c[1] & 0x0f) === 0x8 ? ' <== CLOSE-FRAME!' : ''
  log(`RAW DATA ${c.length}B ${hdr}${note}`)
})
// Open $events like the spike does
const streamId = 'ev-repro6-' + Math.random().toString(36).slice(2, 6)
ws.send(JSON.stringify({ type: 'open', streamId, endpoint: '$events', payload: { args: {} } }))
log('$events opened, observing for 12 s (heartbeat interval 2 s, terminate after 2 misses)')
const deadline = Date.now() + 12_000
for (;;) {
  try {
    const f = await ws.next(1000)
    if (f !== undefined) log(`FRAME streamId=${f.streamId} type=${f.type} ${JSON.stringify(f.value ?? '').slice(0, 100)}`)
  } catch (e) {
    if (String(e.message).includes('timeout')) { if (Date.now() >= deadline || ws.closed) break; continue }
    log(`next() threw: ${e.message}`)
    break
  }
  if (Date.now() >= deadline || ws.closed) break
}
log(`final: closed=${ws.closed} closeError=${ws.closeError?.message ?? 'none'} traceFrames=${(ws.trace ?? []).length}`)
ws.socket?.destroy()
process.exit(0)
