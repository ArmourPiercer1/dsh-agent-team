#!/usr/bin/env node
/**
 * fake-lang-server-a5ptc.mjs — FICTIONAL auditable stdio language server for the
 * W-PTC-RE assembly kit (Team-owned fixture, same declared role as PR6's
 * fake-lang-server-p06: the SERVER is a fixture; the providers/pool/spawn/tool
 * route under test are the REAL pinned production libs).
 *
 * Hover text carries its own OS pid + didOpen count:
 *   A5PTCAUDIT pid=<pid> opens=<n>
 * Audit lines go to stderr as JSON with the pid. No ports, no world.
 * @module dev/agent-workflow/evidence/alpha5/w-ptc-re/fake-lang-server-a5ptc
 */
let opens = 0
const log = (o) => process.stderr.write(JSON.stringify({ pid: process.pid, ...o }) + '\n')
let buf = Buffer.alloc(0)
process.stdin.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk])
  for (;;) {
    const headerEnd = buf.indexOf('\r\n\r\n')
    if (headerEnd < 0) return
    const header = buf.subarray(0, headerEnd).toString('ascii')
    const match = /Content-Length: (\d+)/i.exec(header)
    if (!match) process.exit(1)
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
      reply(id, { capabilities: { hoverProvider: true, textDocumentSync: { openClose: true, change: 1 } }, serverInfo: { name: 'fake-lang-a5ptc', version: '0.0.0-fixture' } })
      return
    case 'initialized': return
    case 'textDocument/didOpen': opens++; log({ ev: 'open', uri: params?.textDocument?.uri, opens }); return
    case 'textDocument/didClose': return
    case 'textDocument/hover':
      reply(id, { contents: 'A5PTCAUDIT pid=' + process.pid + ' opens=' + opens })
      return
    case 'shutdown': return reply(id, null)
    case 'exit': process.exit(0)
    default:
      if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'fake-lang-a5ptc: unsupported' } })
  }
}
log({ ev: 'boot' })
