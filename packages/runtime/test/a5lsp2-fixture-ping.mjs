#!/usr/bin/env node
/**
 * a5lsp2-fixture-ping — a fake LSP-server stand-in for the assembly-
 * discipline legs. Since the root LSP-review ruling (2026-10-25) the REAL
 * default readiness is the STANDARD LSP initialize handshake, and this
 * fixture answers it over real Content-Length framing: `initialize` →
 * framed result carrying `capabilities` → accept `initialized`. On top of
 * the handshake it still speaks the assembly spec's round-trip probe —
 * line-delimited JSON request `{"ping":<seq>}` ⇒ answer
 * `{"pong":<seq>,"pid":…,"gen":…,"cwd":…}`. Self-reports the OS pid, the
 * policy generation it was assembled with and its cwd (the zero-handle /
 * isolation observations). `{"die":true}` exits 0.
 *
 * argv: [node, this-file, <gen>]
 *
 * @module packages/runtime/test/a5lsp2-fixture-ping
 */

import { Buffer } from 'node:buffer'
import process from 'node:process'

const gen = String(process.argv[2] ?? 'g0')
let inbuf = ''
process.stdout.write(`{"ready":true,"pid":${process.pid},"gen":${JSON.stringify(gen)}}\n`)

function frame (obj) {
  const body = JSON.stringify(obj)
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`)
}

// One accumulator carries BOTH channels the assembly round uses: the framed
// LSP initialize exchange and the fixture's line-JSON ping protocol. Framing
// is detected by its header terminator; a framed header without
// Content-Length is skipped whole (never re-synced into the line channel).
process.stdin.on('data', (chunk) => {
  inbuf += String(chunk)
  for (;;) {
    const headerEnd = inbuf.indexOf('\r\n\r\n')
    const nl = inbuf.indexOf('\n')
    if (headerEnd >= 0 && (nl < 0 || headerEnd < nl)) {
      const header = inbuf.slice(0, headerEnd)
      const m = /content-length:\s*(\d+)/i.exec(header)
      const start = headerEnd + 4
      if (m === null) {
        inbuf = inbuf.slice(start)
        continue
      }
      const length = Number(m[1])
      if (inbuf.length < start + length) break
      const body = inbuf.slice(start, start + length)
      inbuf = inbuf.slice(start + length)
      let msg
      try { msg = JSON.parse(body) } catch { continue }
      if (msg.method === 'initialize') {
        frame({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            capabilities: { hoverProvider: true, definitionProvider: true, referencesProvider: true, implementationProvider: true },
            serverInfo: { name: 'a5lsp2-fixture-ping', pid: process.pid, gen },
          },
        })
      }
      // `initialized` and any other framed traffic are accepted silently.
      continue
    }
    if (nl < 0) break
    const line = inbuf.slice(0, nl)
    inbuf = inbuf.slice(nl + 1)
    if (line.length === 0) continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      process.stdout.write('{"parse-error":true}\n')
      continue
    }
    if (msg.die === true) process.exit(0)
    if (typeof msg.ping !== 'undefined') {
      process.stdout.write(`{"pong":${JSON.stringify(msg.ping)},"pid":${process.pid},"gen":${JSON.stringify(gen)},"cwd":${JSON.stringify(process.cwd())}}\n`)
    }
  }
})
process.stdin.on('end', () => process.exit(0))
