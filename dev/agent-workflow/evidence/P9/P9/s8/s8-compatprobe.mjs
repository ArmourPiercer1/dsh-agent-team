#!/usr/bin/env node
/**
 * S8 compat probe — call the live team-remote `intent.probe` (T12 wire) for
 * the s8v-bp-1 blueprint with the same environment facts the P9 New Team
 * panel sends (one persona fact for the selected preset), to capture the
 * compatibility verdict at contract level (before/after the blueprint
 * reseed + the seam-6 envelope fix).
 *
 * Usage: node s8-compatprobe.mjs [presetId]
 *   presetId defaults to 'standard' (the roster's isDefault row).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const EV = dirname(fileURLToPath(import.meta.url))
const state = JSON.parse(readFileSync(join(EV, 'state.json'), 'utf8'))
const presetId = process.argv[2] ?? 'standard'
const rpcId = randomUUID()
const payload = {
  version: 1,
  params: {
    blueprintId: 's8v-bp-1',
    blueprintRevision: 1,
    environmentFacts: [
      { domain: 'persona', subject: presetId, available: true, generation: 0 },
    ],
  },
}
const url = `${state.origin}/team-remote/intent.probe`
const resp = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie: state.cookie },
  body: JSON.stringify({ type: 'client-request', rpcId, method: 'intent.probe', payload }),
})
const text = await resp.text()
console.log(`POST ${url} (preset=${presetId})`)
console.log(`HTTP ${resp.status}`)
let parsed = null
try { parsed = JSON.parse(text) } catch { /* raw below */ }
if (parsed === null) {
  console.log(text.slice(0, 3000))
  process.exit(0)
}
const result = parsed.result
if (result === undefined || result === null) {
  console.log(text.slice(0, 3000))
  process.exit(0)
}
const out = result.error !== undefined
  ? { error: result.error }
  : { status: result.data?.status ?? result.status, requirements: (result.data?.requirements ?? result.requirements)?.map(r => ({ id: r.requirementId, complete: r.complete, outcome: r.outcome, reasonCode: r.reasonCode })) }
console.log(JSON.stringify(out, null, 2))
