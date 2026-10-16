#!/usr/bin/env node
/**
 * fake-lang-server-p06.mjs — FICTIONAL auditable stdio language server for PR6 PoC6b
 * (Team-owned PoC fixture, rewritten every run). LSP base framing. Hover text carries
 * pid + didOpen count; hover with position.line > 50 delays that many ms (lease probe);
 * env P6B_IGNORE_SHUTDOWN=1 makes it ignore shutdown/exit (terminate-escalation probe).
 * Audit lines (open/recv) go to stderr with the pid.
 */
const IGNORE_SHUTDOWN = process.env.P6B_IGNORE_SHUTDOWN === '1'
let opens = 0
let lastDelay = 0
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const log = (o) => process.stderr.write(JSON.stringify({ pid: process.pid, ...o }) + '\n')
let buf = Buffer.alloc(0)
process.stdin.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk])
  for (;;) {
    const headerEnd = buf.indexOf('\r\n\r\n')
    if (headerEnd < 0) return
    const header = buf.subarray(0, headerEnd).toString('ascii')
    const match = /Content-Length: (\d+)/i.exec(header)
    if (!match) { process.exit(1) }
    const len = Number(match[1])
    if (buf.length < headerEnd + 4 + len) return
    const body = buf.subarray(headerEnd + 4, headerEnd + 4 + len).toString('utf8')
    buf = buf.subarray(headerEnd + 4 + len)
    let msg
    try { msg = JSON.parse(body) } catch { continue }
    void handle(msg)
  }
})
const send = (m) => { const s = JSON.stringify(m); process.stdout.write('Content-Length: ' + Buffer.byteLength(s) + '\r\n\r\n' + s) }
const reply = (id, r) => send({ jsonrpc: '2.0', id, result: r })
async function handle(msg) {
  const { id, method, params } = msg
  log({ ev: 'recv', method })
  switch (method) {
    case 'initialize':
      reply(id, { capabilities: { hoverProvider: true, textDocumentSync: { openClose: true, change: 1 } }, serverInfo: { name: 'fake-lang-p06', version: '0.0.0-fixture' } })
      return
    case 'initialized': return
    case 'textDocument/didOpen': opens++; log({ ev: 'open', uri: params?.textDocument?.uri, opens }); return
    case 'textDocument/didClose': return
    case 'textDocument/hover': {
      const d = Number(params?.position?.line ?? 0)
      lastDelay = d > 50 ? d : 0
      if (lastDelay > 0) await sleep(lastDelay)
      reply(id, { contents: 'P06AUDIT pid=' + process.pid + ' opens=' + opens + ' delay=' + lastDelay })
      return
    }
    case 'shutdown':
      if (IGNORE_SHUTDOWN) { log({ ev: 'shutdown-ignored' }); return }
      return reply(id, null)
    case 'exit': process.exit(0)
    default:
      if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'fake-lang-p06: unsupported' } })
  }
}
log({ ev: 'boot' })
