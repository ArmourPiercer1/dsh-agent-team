#!/usr/bin/env node
/**
 * mock-host.mjs — the long-lived mock model companion for the
 * team-projection-recovery real-host smoke (one process per world).
 *
 * The main kit spawns this DETACHED so the mock survives between kit
 * invocations (setup → browser scenarios → stop/corrupt/restart). Every
 * model request gets a plain text reply (the read-side scenarios need no
 * model-side decisions; the sessions just have to be openable).
 *
 * USAGE:
 *   node mock-host.mjs --port <n> --log <path>
 * EXIT: 0 on SIGTERM (the kit sends it in --stop/--teardown).
 */

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'

function opt(name, fallback) {
  const i = process.argv.indexOf(name)
  if (i === -1 || process.argv[i + 1] === undefined) return fallback
  return process.argv[i + 1]
}

const port = Number(opt('--port', '3496'))
const logPath = opt('--log', null)
if (logPath !== null) mkdirSync(dirname(logPath), { recursive: true })
const log = (line) => {
  if (logPath !== null) {
    try {
      appendFileSync(logPath, `${line}\n`)
    } catch { /* best-effort */ }
  }
}

const mock = await startMockModel({
  port,
  log: (l) => log(l),
  decide: () => ({
    kind: 'text',
    content: 'tpr-smoke: acknowledged (mock text reply, no decisions).',
  }),
})
writeFileSync(
  `${dirname(logPath ?? 'mock.log')}/mock-ready.json`,
  JSON.stringify({ port: mock.port, readyAt: new Date().toISOString() }, null, 2),
)
log(`mock-host ready on 127.0.0.1:${mock.port}`)
process.on('SIGTERM', () => {
  log('mock-host SIGTERM — closing')
  void mock.close().then(() => process.exit(0))
})
process.on('SIGINT', () => {
  void mock.close().then(() => process.exit(0))
})
// Hold the process open.
setInterval(() => {}, 1 << 30)
