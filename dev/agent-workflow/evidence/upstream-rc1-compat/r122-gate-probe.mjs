// R122 boot-gate re-verification probe (independent of the boot kit stream).
// (a) 401 gate: unauthenticated catalog.list on /team-remote must be 401/403.
// (b) The served index must inject a plugin URL set that includes the shim
//     package (@dsh-agent-team/client) — the browser-load path of the client
//     half (the boot-time serveCheck combo already proved the bundle bytes
//     are inside the served combo).
import { readFileSync } from 'node:fs'

const state = JSON.parse(readFileSync(
  'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/P9/s8/state.json',
  'utf8',
))
const origin = state.origin
const cookie = state.cookie

const body = {
  type: 'client-request',
  rpcId: `r122-${Date.now().toString(16)}`,
  method: 'catalog.list',
  payload: { version: 1, params: {} },
}

// (a) unauthenticated
const unauth = await fetch(`${origin}/team-remote/catalog.list`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})
const unauthText = await unauth.text()
console.log(`(a) unauthenticated catalog.list -> HTTP ${unauth.status} ${unauthText.slice(0, 160)}`)

// (b) index plugin URL injection
const idx = await fetch(origin, { headers: { cookie } })
const html = await idx.text()
const urls = [...html.matchAll(/\/plugins\/[^"'\s>]+/g)].map((m) => m[0])
const withShim = urls.filter((u) => u.includes('@dsh-agent-team'))
console.log(`(b) index HTTP ${idx.status}; plugin URLs: ${urls.length}; shim-bearing: ${withShim.length}`)
for (const u of withShim) console.log(`    ${u.slice(0, 120)}${u.length > 120 ? '…' : ''}`)
// the shim package must appear inside some served URL (combo or direct)
const shimServed = withShim.length > 0
console.log(`(b) result: shim package ${shimServed ? 'IS' : 'is NOT'} referenced by an injected plugin URL`)

// (c) authenticated catalog.list (control: the channel answers 200 with auth)
const authed = await fetch(`${origin}/team-remote/catalog.list`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify(body),
})
const authedBody = await authed.json().catch(() => ({}))
console.log(`(c) authenticated catalog.list -> HTTP ${authed.status}; ok=${authedBody?.result?.ok ?? authedBody?.ok ?? 'n/a'}`)
