#!/usr/bin/env node
/**
 * S8 preset probe — call the live Host API `agentPresets/list` over the
 * authenticated /api channel (the same wire the P9 New Team panel's
 * `ctx.remote.agentPresets.list()` uses) and print the roster rows
 * (id/trust/name/isDefault/broken-reason), to diagnose the empty preset
 * select behind the BLOCKED_FATAL compatibility state.
 *
 * Usage: node s8-presetprobe.mjs [payloadJson]
 *   payloadJson defaults to {} (list takes no args).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const EV = dirname(fileURLToPath(import.meta.url))
const state = JSON.parse(readFileSync(join(EV, 'state.json'), 'utf8'))
const payload = process.argv[2] === undefined ? {} : JSON.parse(process.argv[2])
const rpcId = randomUUID()
const url = `${state.origin}/api/agentPresets/list`
const resp = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie: state.cookie },
  body: JSON.stringify({ type: 'client-request', rpcId, method: 'agentPresets/list', payload }),
})
const text = await resp.text()
console.log(`POST ${url}`)
console.log(`HTTP ${resp.status}`)
let parsed = null
try { parsed = JSON.parse(text) } catch { /* printed raw below */ }
if (parsed === null) {
  console.log(text.slice(0, 3000))
  process.exit(0)
}
const result = parsed.result
console.log(`rpcId match=${parsed.rpcId === rpcId}`)
console.log(JSON.stringify(result, null, 2).slice(0, 8000))
