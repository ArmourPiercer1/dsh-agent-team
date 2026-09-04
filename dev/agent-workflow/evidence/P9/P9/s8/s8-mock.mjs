#!/usr/bin/env node
/**
 * S8 boot kit — standalone deterministic DeepSeek-compatible mock model
 * process (S8-C model turns must outlive the boot script; T12 honesty
 * pattern: the dsh-llm deepseek-official adapter resolves the launch
 * environment, so every model call in the booted instance lands here,
 * keyless and deterministic).
 *
 * Usage: node s8-mock.mjs <port> <logPath>
 * Prints S8-MOCK-READY port=<port> to stdout once listening; exits 0 on
 * SIGTERM after closing the server.
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { startMockModel } from '../../../../../.worktrees/RC1/packages/tools/harness/mock-deepseek.mjs'

const [, , portArg, logPathArg] = process.argv
if (!portArg || !logPathArg) {
  console.error('usage: node s8-mock.mjs <port> <logPath>')
  process.exit(2)
}
const PORT = Number(portArg)
const LOG_PATH = logPathArg
mkdirSync(dirname(LOG_PATH), { recursive: true })
const log = (line) => {
  appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${line}\n`)
}
let seq = 0
const decide = ({ seq: s, req }) => {
  seq = s
  log(`mock: req ${s} model=${JSON.stringify(req?.model ?? null)}`)
  // Deterministic per-sequence text reply; the content is opaque to the
  // team flow — the vertical asserts on structure, not on model prose.
  return { kind: 'text', content: `S8-M${s} ok (${req?.model ?? 'unknown-model'}).` }
}
void seq
const mock = await startMockModel({ port: PORT, decide, log })
console.log(`S8-MOCK-READY port=${mock.port}`)
let closing = false
process.on('SIGTERM', () => {
  if (closing) return
  closing = true
  log(`mock: SIGTERM — close (requests=${mock.requests.length})`)
  void mock.close().then(() => process.exit(0))
})
process.on('SIGINT', () => process.kill(process.pid, 'SIGTERM'))
