#!/usr/bin/env node
/**
 * a5lsp2-fixture-lang-server — a TRUE-BLUE fake stdio LSP server fixture for
 * the P-LSP production lane. Protocol = real LSP framing (Content-Length
 * header block + JSON-RPC 2.0): the streaming positive leg performs a real
 * initialize handshake and bidirectional hover round-trips through the
 * confined provider's stdin/stdout pipes.
 *
 * Self-reporting (audit surface, same law as the W-LSP-DR fixture): every
 * `initialize` result carries {pid, gen, cwd, secretRead} — the OS pid, the
 * policy generation it was launched with, the process cwd and the outcome of
 * a FORCED read of `<gen-root>/forbidden/secret.txt` (must be EACCES under
 * the confined policy; the deny-path raw word is echoed back INSIDE the
 * child so the leg can prove what the confined domain did or did not see).
 *
 * argv: [node, this-file, <gen>]
 *
 * @module packages/runtime/test/a5lsp2-fixture-lang-server
 */

import process from 'node:process'
import fs from 'node:fs'

const gen = String(process.argv[2] ?? 'g0')

function frame(obj) {
  const body = JSON.stringify(obj)
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`)
}

function reply(id, result) {
  frame({ jsonrpc: '2.0', id, result })
}

function replyError(id, code, message) {
  frame({ jsonrpc: '2.0', id, error: { code, message } })
}

function secretProbe() {
  // The deny-path probe: the forbidden directory sits INSIDE this instance's
  // workspace root but is NOT in the confined allow set... it IS under the
  // root rule — the fixture reads a path OUTSIDE every allow entry when
  // FORBIDDEN_PATH is provided via argv[3]; otherwise it reports 'not-asked'.
  const target = process.argv[3]
  if (!target) return 'not-asked'
  try {
    fs.readFileSync(target, 'utf8')
    return 'READ-ALLOWED' // a confined run must never answer this
  } catch (error) {
    return String(error && error.code ? error.code : 'ERR')
  }
}

let buf = Buffer.alloc(0)
process.stdin.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk])
  for (;;) {
    const headerEnd = buf.indexOf('\r\n\r\n', 0, 'utf8')
    if (headerEnd < 0) return
    const header = buf.subarray(0, headerEnd).toString('utf8')
    const m = /content-length:\s*(\d+)/i.exec(header)
    if (!m) {
      process.stderr.write('framing-error\n')
      process.exit(3)
    }
    const len = Number(m[1])
    if (buf.length < headerEnd + 4 + len) return
    const body = buf.subarray(headerEnd + 4, headerEnd + 4 + len).toString('utf8')
    buf = buf.subarray(headerEnd + 4 + len)
    let msg
    try {
      msg = JSON.parse(body)
    } catch {
      process.stderr.write('parse-error\n')
      process.exit(3)
    }
    handle(msg)
  }
})

function handle(msg) {
  const { id, method } = msg
  if (method === 'initialize') {
    reply(id, {
      capabilities: { hoverProvider: true },
      serverInfo: {
        name: 'a5lsp2-fixture-lang-server',
        pid: process.pid,
        gen,
        cwd: process.cwd(),
        secretRead: secretProbe(),
      },
    })
    return
  }
  if (method === 'shutdown') {
    reply(id, null)
    return
  }
  if (method === 'exit') {
    process.exit(0)
  }
  if (method === 'textDocument/hover') {
    const uri = String((msg.params && msg.params.textDocument && msg.params.textDocument.uri) || '')
    const file = uri.replace(/^file:\/\//, '')
    let text = `<missing ${file}>`
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch (error) {
      text = `<read ${String(error && error.code)}>`
    }
    reply(id, { contents: { kind: 'markdown', value: `[${gen}|pid:${process.pid}] ${text.trim()}` } })
    return
  }
  if (id !== undefined) replyError(id, -32601, `unhandled ${String(method)}`)
  // notifications (no id): acknowledged silently, per LSP
}

process.stdin.on('end', () => process.exit(0))
