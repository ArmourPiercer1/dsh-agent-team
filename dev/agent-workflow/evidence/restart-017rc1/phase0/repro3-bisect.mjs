#!/usr/bin/env node
/**
 * repro3-bisect.mjs — bisect the DYN-follow socket-kill.
 *
 * Copies run 9's world to a scratch home, then boots two variants:
 *   W4: stock only (patch = no team lines) — DYN is a cold durable session
 *       whose log ENDS WITH a plain end-seed resume-marker. Follow it.
 *   W3: team glue only (dsh-agent-team/host line, NO fence/p6t6/spill) —
 *       the glue boot-resume makes DYN LIVE (no veto). Follow it. (legA shape)
 *
 * For each: raw byte capture, 8 s observation after the follow open,
 * record whether the host terminates the mux socket.
 */
import { spawn, spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import crypto from 'node:crypto'
import http from 'node:http'
import { openSync, readFileSync, writeFileSync, mkdirSync, rmSync, appendFileSync, existsSync } from 'node:fs'

const MAIN_REPO = '/home/user/dsh-plugins/dsh-agent-team'
const TESTUSE = join(MAIN_REPO, 'tests', 'deepseek-harness-test-use')
const WORKTREE = join(MAIN_REPO, '.worktrees', 'team-restart-017rc1')
const TESTUSE_PIN = '46a7f68b0922371ce7144b668b90e377d8e799f4'
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const SRC_WORLD = join(MAIN_REPO, 'tests', 'homes', 'rst017-spike-2026-09-26T04-32-14')
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const HOME = join(MAIN_REPO, 'tests', 'homes', `rst017-bisect-${stamp}`)
const DYN = 'session-rst017-dyn-2026-09-26T04-32-14'
const OUT = join(MAIN_REPO, 'dev', 'agent-workflow', 'evidence', 'restart-017rc1', 'phase0', 'repro3-bisect')
const t0 = Date.now()
const t = () => Date.now() - t0
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// W3: the exact dsh-agent-team/host line from run 9's patch (glue only).
const HOST_LINE = `# repro3 bisect: team glue only (no fence / p6t6 / spill)
- insert:
    - id: "dsh-agent-team"
      name: "dsh-agent-team/host"
      config:
        bootPhase: "resume"
        rootSessionId: "session-rst017-boot-2026-09-26T04-32-14"
        blueprintSource: "---\\nschemaVersion: 1\\nblueprintId: team.rst017-anchor\\nrevision: \\"1\\"\\nleader:\\n  templateId: leader\\n  persona: \\"You are the leader of the rst017 boot team. RST017BOOT_PERSONA_2026-09-26T04-32-14 Answer concisely and stop.\\"\\nmembers:\\n  - templateId: worker\\n    persona: \\"You are a worker of the rst017 boot team. RST017BOOT_PERSONA_2026-09-26T04-32-14\\"\\nmemberEnvelopes: []\\nrequirements: []\\npolicyStates: []\\nmetadata: {}\\n---\\n"
        blueprintDir: "${join(HOME, 'blueprints')}"
        rootPresetId: "standard"
        memberPresetId: "standard"
        seedMembers: []
        generation: 1
        staticModel:
          provider: "deepseek-official"
          model: "rst017-model-2026-09-26T04-32-14"
        deniedSelection: null
        mcpServers: []
        environmentFacts:
          - domain: "tool"
            subject: "web"
            available: true
            generation: 1
          - domain: "skill"
            subject: "base"
            available: true
            generation: 1
          - domain: "persona"
            subject: "standard"
            available: true
            generation: 1
        externalPolicyFacts:
          hard: {}
          capabilityExists: {}
`
// The patch layer must be a top-level YAML ARRAY (even when empty).
const W4_PATCH = '# repro3 bisect: stock only (no team lines)\n[]\n'

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
      socket.on('close', () => { this.closedAt = t(); console.log(`${this.tag}: SOCKET CLOSED at +${this.closedAt}ms (closeCode=${this.closeCode})`) })
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
      this.closeCode = payload.length >= 2 ? payload.readUInt16BE(0) : null
      console.log(`${this.tag}: HOST CLOSE FRAME at +${t()}ms: code=${this.closeCode}`)
      return
    }
    if (opcode === 0x9) { this._rawFrame(0xA, payload); return }
    if (opcode === 0xA) return
    if (opcode !== 0x1) { console.log(`${this.tag}: unexpected opcode`, opcode); return }
    if (this.frag === null) this.frag = []
    this.frag.push(payload)
    if (fin) {
      const text = Buffer.concat(this.frag).toString('utf8'); this.frag = null
      const short = text.length > 160 ? text.slice(0, 160) + '…' : text
      console.log(`${this.tag}: MSG +${t()}ms: ${short}`)
      this.messages.push(text)
    }
  }
}

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function runVariant(name, patch, port, mockPort) {
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), patch)
  const { startMockModel: startMock } = await import(pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')).href)
  const mock = startMock({ port: mockPort, decide: () => ({ kind: 'text', content: 'repro3 ack' }), log: () => {} })
  const logPath = join(OUT, `host-${name}.log`)
  writeFileSync(logPath, '')
  const outFd = openSync(logPath, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(port), '--no-open'], {
    cwd: join(HOME, 'workspace'), stdio: ['ignore', outFd, outFd],
    env: { ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: TESTUSE_PIN.slice(0, 10), DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`, DEEPSEEK_API_KEY: 'repro3-key' },
  })
  child.on('error', (e) => console.log(`${name}: spawn error`, e.message))
  let token = null
  const deadline = Date.now() + 180_000
  for (;;) {
    let text = ''
    try { text = readFileSync(logPath, 'utf8') } catch {}
    const m = BOOT_MARKER.exec(text)
    if (m !== null) { token = m[2]; break }
    if (Date.now() >= deadline) throw new Error(`${name}: no boot marker`)
    await sleep(500)
  }
  const origin = `http://127.0.0.1:${port}`
  console.log(`${name}: host up at +${t()}ms`)
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  const cookie = setCookie !== null ? setCookie.split(';', 1)[0] : null
  await sleep(2_500) // let any boot-resume settle (W3 glue loop ≈ +300–600 ms)
  const ws = new RawSocket(name, `${origin}/api/remote.mux`, cookie)
  ws.connect()
  await sleep(400)
  const sid = ws.openFollow()
  console.log(`${name}: follow opened (streamId=${sid}) at +${t()}ms`)
  await sleep(8_000)
  const result = { closedAt: ws.closedAt, closeCode: ws.closeCode, messages: ws.messages.length }
  console.log(`${name}: RESULT after 8s: closedAt=${result.closedAt}ms closeCode=${result.closeCode} messages=${result.messages}`)
  try { ws.socket?.destroy() } catch {}
  try { child.kill('SIGTERM') } catch {}
  await sleep(2_000)
  try { await mock?.close?.() } catch { try { mock?.stop?.() } catch {} }
  return result
}

async function main() {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  rawLog = join(OUT, 'raw-bytes.log')
  writeFileSync(rawLog, '')
  rmSync(HOME, { recursive: true, force: true })
  console.log('copying world ->', HOME)
  const cp = spawnSync('cp', ['-r', SRC_WORLD, HOME], { encoding: 'utf8', timeout: 300_000 })
  if (cp.status !== 0) throw new Error(`cp failed: ${String(cp.stderr).slice(0, 300)}`)
  console.log('world copied')
  const summary = {}
  summary.w4 = await runVariant('W4', W4_PATCH, 3493, 3500)
  summary.w3 = await runVariant('W3', HOST_LINE, 3494, 3501)
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify({ home: HOME, summary }, null, 2))
  console.log('summary ->', JSON.stringify(summary))
  process.exit(0)
}
main().catch((e) => { console.error('repro3 failed:', e); process.exit(1) })
