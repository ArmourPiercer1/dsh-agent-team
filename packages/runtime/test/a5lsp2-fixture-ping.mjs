#!/usr/bin/env node
/**
 * a5lsp2-fixture-ping — a fake LSP-server stand-in speaking ONE line of
 * line-delimited JSON per request for the assembly-discipline legs:
 * request `{"ping":<seq>}` ⇒ answer `{"pong":<seq>,"pid":…,"gen":…,"cwd":…}`.
 * Self-reports the OS pid, the policy generation it was assembled with and
 * its cwd (the zero-handle / isolation observations). `{"die":true}` exits 0.
 *
 * argv: [node, this-file, <gen>]
 *
 * @module packages/runtime/test/a5lsp2-fixture-ping
 */

import process from 'node:process'

const gen = String(process.argv[2] ?? 'g0')
let buf = ''
process.stdout.write(`{"ready":true,"pid":${process.pid},"gen":${JSON.stringify(gen)}}\n`)
process.stdin.on('data', (chunk) => {
  buf += String(chunk)
  for (;;) {
    const nl = buf.indexOf('\n')
    if (nl < 0) break
    const line = buf.slice(0, nl)
    buf = buf.slice(nl + 1)
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
