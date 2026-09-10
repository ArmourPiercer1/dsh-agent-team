#!/usr/bin/env node
// cap-resume-check.mjs — the N5 cold-resume re-check.
//
// Runs AFTER a `phase: resume` re-boot of the SAME world (the durable
// team_domain was adopted, not re-stamped). Verifies the capability wiring
// SURVIVED the cold resume:
//   - the blueprint (cap-bp-1) is still in the catalog (user-layer override).
//   - the seed members (tpl-a, tpl-b) are still live.
//   - the per-teammate team-tool selection (N1) is unchanged.
//   - the durable MCP-allow override persists (allowed:true for all three).
//
// No override is created here (it was created by cap-check.mjs on the first
// boot and persisted in the team_domain). Writes cap-resume-check-<stamp>.json.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
function findState() {
  const states = readdirSync(__dirname).filter((n) => n.startsWith('cap-state-') && n.endsWith('.json')).sort()
  if (states.length === 0) { console.error('no cap-state-*.json found'); process.exit(2) }
  return join(__dirname, states[states.length - 1])
}
const statePath = findState()
const state = JSON.parse(readFileSync(statePath, 'utf8'))
const origin = state.origin
const cookie = state.cookie
const runStamp = state.runStamp ?? 'run'
console.log(`[cap-resume-check] state: ${statePath}`)
console.log(`[cap-resume-check] origin: ${origin} runStamp: ${runStamp}`)

function headers() { return { 'content-type': 'application/json', cookie } }
async function get(path) {
  const res = await fetch(`${origin}${path}`, { headers: headers() })
  const text = await res.text()
  let body; try { body = JSON.parse(text) } catch { body = text }
  return { status: res.status, body }
}
async function post(path, payload) {
  const res = await fetch(`${origin}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) })
  const text = await res.text()
  let body; try { body = JSON.parse(text) } catch { body = text }
  return { status: res.status, body }
}

const report = { at: new Date().toISOString(), origin, checks: [], failures: [] }
function check(id, label, expected, actual, detail) {
  const ok = expected === actual
  report.checks.push({ id, label, expected, actual, ok, detail })
  if (!ok) report.failures.push({ id, label, expected, actual, detail })
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${id}: expected=${expected} actual=${actual}${ok ? '' : ` — ${detail}`}`)
}

// 0. health
{
  const { status, body } = await get('/__p6t6/health')
  check('health-ok', 'p6t6 health ok (cold resume)', true, body?.ok === true, `status=${status} body=${JSON.stringify(body).slice(0, 200)}`)
  check('health-live-3-sessions', 'leader + 2 seeded members live after resume', 3, (body?.liveSessions ?? []).length, `liveSessions=${JSON.stringify(body?.liveSessions)}`)
}

// 1. the blueprint is still in the catalog (user-layer override persists)
{
  const { status, body } = await post('/team-remote/catalog.list', {
    type: 'client-request', rpcId: `resume-${Date.now()}`, method: 'catalog.list',
    payload: { version: 1, params: {} },
  })
  const catalog = body?.result?.value?.data?.blueprints ?? []
  const hasCapBp = catalog.some((b) => b?.blueprintId === 'cap-bp-1')
  check('blueprint-persists', 'cap-bp-1 still in the catalog after resume', true, hasCapBp, `catalog=${JSON.stringify(catalog.map((b) => b?.blueprintId)).slice(0, 200)}`)
}

// 2. N1: per-teammate team-tool selection (unchanged after resume)
async function toolState(as, name) {
  const { status, body } = await post('/__p6t6/tool', {
    name, as, args: {}, callId: `n5-${as}-${name}-${Math.random().toString(36).slice(2, 8)}`,
  })
  if (status === 422 && body?.error?.code === 'NO_LIVE_AGENT') return 'no-live-agent'
  if (body?.ok === true) return 'registered'
  const code = body?.error?.info?.code
  if (code === 'UNKNOWN_TOOL') return 'not-registered'
  return code ? `error-${code}` : 'error-unknown'
}
const n1Plan = {
  'cap-root': [
    { tool: 'team_list_members', expect: 'registered' },
    { tool: 'team_send_message', expect: 'registered' },
    { tool: 'team_delegate', expect: 'not-registered' },
  ],
  'session-capa-a': [
    { tool: 'team_delegate', expect: 'registered' },
    { tool: 'team_list_members', expect: 'not-registered' },
  ],
  'session-capb-b': [
    { tool: 'team_list_members', expect: 'not-registered' },
    { tool: 'team_delegate', expect: 'not-registered' },
  ],
}
console.log('\n=== N5 cold-resume re-check: N1 team tools ===')
for (const [as, tools] of Object.entries(n1Plan)) {
  for (const { tool, expect } of tools) {
    const registered = await toolState(as, tool)
    check(`n5-n1-${as}-${tool}`, `N5 N1 ${as} ${tool} (after resume)`, expect, registered, '')
  }
}

// 3. N4: the durable MCP-allow override persists (allowed:true for all three)
console.log('\n=== N5 cold-resume re-check: N4 MCP durable override ===')
{
  const { status, body } = await get('/__p6t6/state')
  const sessions = body?.governance?.sessions ?? {}
  for (const sid of ['cap-root', 'session-capa-a', 'session-capb-b']) {
    const v = sessions[sid]?.mcp
    check(`n5-n4-${sid}-mcp-allowed`, `N5 N4 ${sid} MCP durable-allowed persists (after resume)`, true, v?.allowed === true, JSON.stringify(v).slice(0, 200))
  }
  // The override record itself is still in the governance state.
  const overrides = body?.governance?.overrides ?? []
  const hasOverride = overrides.some((o) => o?.recordId === 'cap-mcp-allow')
  check('n5-n4-override-record-persists', 'cap-mcp-allow override record persists', true, hasOverride, `overrides=${JSON.stringify(overrides.map((o) => o?.recordId)).slice(0, 200)}`)
}

// 4. write the report
const outFile = join(__dirname, `cap-resume-check-${runStamp}.json`)
writeFileSync(outFile, JSON.stringify(report, null, 2))
console.log(`\n[cap-resume-check] report → ${outFile}`)
console.log(`[cap-resume-check] PASS=${report.checks.length - report.failures.length}/${report.checks.length}`)
if (report.failures.length > 0) {
  console.error('[cap-resume-check] FAILURES:')
  for (const f of report.failures) console.error(`  - ${f.id}: expected=${f.expected} actual=${f.actual}`)
  process.exitCode = 1
} else {
  console.log('[cap-resume-check] ALL CHECKS PASSED — capability wiring survived the cold resume')
}
