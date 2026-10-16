#!/usr/bin/env node
/**
 * fake-lang-server.mjs — FICTIONAL, fully auditable stdio language server for Alpha.5 P0-5
 * LSP-01 evidence (Team-owned PoC fixture; rewritten by 06-lsp/p05-runner.mjs on every run).
 * Protocol: LSP base framing (Content-Length). Reports its own OS pid, counts didOpen,
 * probes file reads at initialize time (boot probes), and answers the custom request
 * "$/p05ReadProbe" by attempting an os-level read of params.path and returning the outcome.
 * All probes go to stderr (audit log) AND into structured responses (observation channel).
 */
import { readFileSync } from 'node:fs'

const probe = (path) => {
  if (typeof path !== 'string' || path === '') return { path: String(path), ok: false, code: 'NO_PATH' }
  try {
    const buf = readFileSync(path)
    return { path, ok: true, bytes: buf.length, head: buf.subarray(0, 24).toString('utf8') }
  } catch (error) { return { path, ok: false, code: String(error && error.code || error) } }
}

const bootForbidden = probe(process.env.P05_FORBIDDEN)   // expected-under-strict-ACL DENIED; reality recorded as-is
const bootAllowed = probe(process.env.P05_ALLOWED)       // positive control, expected READ_OK
const customProbes = []
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
    if (!match) { process.exit(1) }
    const len = Number(match[1])
    if (buf.length < headerEnd + 4 + len) return
    const body = buf.subarray(headerEnd + 4, headerEnd + 4 + len).toString('utf8')
    buf = buf.subarray(headerEnd + 4 + len)
    let msg
    try { msg = JSON.parse(body) } catch { continue }
    handle(msg)
  }
})

const send = (m) => { const s = JSON.stringify(m); process.stdout.write('Content-Length: ' + Buffer.byteLength(s) + '\r\n\r\n' + s) }
const reply = (id, r) => send({ jsonrpc: '2.0', id, result: r })

function handle(msg) {
  const { id, method, params } = msg
  log({ ev: 'recv', method })
  switch (method) {
    case 'initialize':
      reply(id, {
        capabilities: { hoverProvider: true, textDocumentSync: { openClose: true, change: 1 } },
        serverInfo: { name: 'fake-lang-p05', version: '0.0.0-fixture' },
      })
      return
    case 'initialized': return
    case 'textDocument/didOpen': opens++; log({ ev: 'open', uri: params?.textDocument?.uri, opens }); return
    case 'textDocument/didClose': return
    case 'textDocument/hover':
      reply(id, { contents: 'P05AUDIT pid=' + process.pid + ' opens=' + opens +
        ' boot_forbidden=' + JSON.stringify(bootForbidden) +
        ' boot_allowed=' + JSON.stringify(bootAllowed) +
        ' custom_probes=' + JSON.stringify(customProbes) })
      return
    case '$/p05ReadProbe': {
      const outcome = probe(params && params.path)
      customProbes.push(outcome)
      log({ ev: 'p05ReadProbe', ...outcome })
      reply(id, outcome)
      return
    }
    case 'shutdown': return reply(id, null)
    case 'exit': process.exit(0)
    default:
      if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'fake-lang-p05: unsupported ' + method } })
  }
}
log({ ev: 'boot', bootForbidden, bootAllowed })
