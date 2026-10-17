#!/usr/bin/env node
/**
 * fake-lang-server-a5lspdr.mjs — FICTIONAL auditable stdio language server for
 * the W-LSP-DR kit (destroy-rebuild verification). Declared role, same as
 * PR6's fake-lang-server-p06 and W-PTC-RE's fixture: the SERVER is fictional;
 * the provider / pool / spawn / dispose code under test are the REAL pinned
 * production libs of the host tree.
 *
 * Hover content carries the full audit line:
 *   A5DR pid=<pid> gen=<A5DR_GEN> opens=<didOpen count> cwd=<process.cwd()>
 *
 * PID LEDGER: every server appends raw JSONL birth/death lines to
 * $A5DR_LEDGER (absolute path from the realm's per-generation server config):
 *   {ev:"server-boot", pid, ppid, gen, cwd, at}
 *   {ev:"server-exit", pid, gen, code, signal, at}
 * That file is the birth/death ledger of every LSP server process this run
 * ever started (evidence raw text — the runner copies it into runs/).
 *
 * No ports. No world state. Stdout is pure LSP framing.
 * @module dev/agent-workflow/evidence/alpha5/w-lsp-dr/fake-lang-server-a5lspdr
 */
import { appendFileSync } from 'node:fs'

const GEN = process.env.A5DR_GEN ?? 'unset'
const LEDGER = process.env.A5DR_LEDGER ?? ''
const ledger = (o) => {
  if (LEDGER === '') return
  try { appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...o }) + '\n') } catch { /* ledger is best-effort */ }
}

let opens = 0
const log = (o) => process.stderr.write(JSON.stringify({ pid: process.pid, ...o }) + '\n')

ledger({ ev: 'server-boot', pid: process.pid, ppid: process.ppid, gen: GEN, cwd: process.cwd() })
process.on('exit', (code) => ledger({ ev: 'server-exit', pid: process.pid, gen: GEN, code, signal: null }))

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
  log({ ev: 'recv', method, gen: GEN })
  switch (method) {
    case 'initialize':
      reply(id, { capabilities: { hoverProvider: true, textDocumentSync: { openClose: true, change: 1 } }, serverInfo: { name: 'fake-lang-a5lspdr', version: '0.0.0-fixture' } })
      return
    case 'initialized': return
    case 'textDocument/didOpen': opens++; log({ ev: 'open', uri: params?.textDocument?.uri, opens }); return
    case 'textDocument/didClose': return
    case 'textDocument/hover':
      reply(id, { contents: `A5DR pid=${process.pid} gen=${GEN} opens=${opens} cwd=${process.cwd()}` })
      return
    case 'shutdown': return reply(id, null)
    case 'exit': process.exit(0)
    default:
      if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'fake-lang-a5lspdr: unsupported' } })
  }
}
log({ ev: 'boot', gen: GEN })
