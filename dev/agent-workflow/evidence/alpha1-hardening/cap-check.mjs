#!/usr/bin/env node
// cap-check.mjs — the live-host capability check (the approved checklist).
//
// Reads the cap-state-<stamp>.json (the booter's state: origin, cookie, port,
// world home). Then:
//   N1  per-teammate team-tool selection via POST /__p6t6/tool (registered
//       = ok:true + arg-validation; not-registered = ok:false + UNKNOWN_TOOL).
//   N4  MCP AND semantics via GET /__p6t6/state (before + after a durable
//       MCP-allow governance override via POST /__p6t6/governance/mutate).
//   N3  team-skills wiring via the state's `observations` (alpha1 skip events).
//   R1  the legacy full-catalog regression is checked by a SEPARATE world
//       (not here); this file is the capability world only.
//
// Writes cap-check-<stamp>.json (the structured report) + a human summary.
// No teardown (the booter owns the host).

import { readFileSync, writeFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const stamp = process.env.CAP_STAMP || 'latest'

// ── resolve the state.json ───────────────────────────────────────────────
function findState() {
  if (stamp !== 'latest') {
    return join(__dirname, `cap-state-${stamp}.json`)
  }
  const states = readdirSync(__dirname)
    .filter((n) => n.startsWith('cap-state-') && n.endsWith('.json'))
    .sort()
  if (states.length === 0) {
    console.error('no cap-state-*.json found (run cap-boot.mjs boot first)')
    process.exit(2)
  }
  return join(__dirname, states[states.length - 1])
}

const statePath = findState()
const state = JSON.parse(readFileSync(statePath, 'utf8'))
const origin = state.origin
const cookie = state.cookie
const runStamp = state.runStamp ?? 'run'

console.log(`[cap-check] state: ${statePath}`)
console.log(`[cap-check] origin: ${origin} runStamp: ${runStamp}`)

// ── http helpers ─────────────────────────────────────────────────────────
function headers() {
  return { 'content-type': 'application/json', cookie }
}
async function get(path) {
  const res = await fetch(`${origin}${path}`, { headers: headers() })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  return { status: res.status, body }
}
async function post(path, payload) {
  const res = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  return { status: res.status, body }
}

// ── the check accumulator ────────────────────────────────────────────────
const report = {
  at: new Date().toISOString(),
  origin,
  statePath,
  health: null,
  n1_team_tools: {},
  n4_mcp: { before: {}, after: {}, override: null },
  n3_skills: { observations: [], note: '' },
  state_before: null,
  state_after: null,
  checks: [],
  failures: [],
}

function check(id, label, expected, actual, detail) {
  const ok = expected === actual
  report.checks.push({ id, label, expected, actual, ok, detail })
  if (!ok) report.failures.push({ id, label, expected, actual, detail })
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`  [${mark}] ${id}: expected=${expected} actual=${actual}${ok ? '' : ` — ${detail}`}`)
}

// ── 0. health ────────────────────────────────────────────────────────────
{
  const { status, body } = await get('/__p6t6/health')
  report.health = body
  check('health-ok', 'p6t6 health ok', true, body?.ok === true, `status=${status} body=${JSON.stringify(body).slice(0, 200)}`)
  check('health-toolcount-10', 'full 10-tool factory output (the plugin-load signal)', 10, body?.toolCount, `toolCount=${body?.toolCount}`)
  const live = body?.liveSessions ?? []
  check('health-live-3-sessions', 'leader + 2 seeded members live', 3, live.length, `liveSessions=${JSON.stringify(live)}`)
}

// ── 1. N1: per-teammate team-tool selection ──────────────────────────────
// The leader allows [team_send_message, team_list_members]; member A allows
// [team_delegate]; member B allows [] (empty). Registered = ok:true (arg
// validation, the tool is present); not-registered = ok:false + UNKNOWN_TOOL.
async function toolState(as, name) {
  const { status, body } = await post('/__p6t6/tool', {
    name, as, args: {}, callId: `n1-${as}-${name}-${Math.random().toString(36).slice(2, 8)}`,
  })
  if (status === 422 && body?.error?.code === 'NO_LIVE_AGENT') return { registered: 'no-live-agent', raw: body }
  if (body?.ok === true) return { registered: 'registered', raw: body }
  const code = body?.error?.info?.code
  if (code === 'UNKNOWN_TOOL') return { registered: 'not-registered', raw: body }
  // A registered tool that failed arg/domain validation still means the tool
  // is present (ok:false but not UNKNOWN_TOOL).
  return { registered: code ? `error-${code}` : 'error-unknown', raw: body }
}
console.log('\n=== N1: per-teammate team-tool selection ===')
const n1Plan = {
  'cap-root': [
    { tool: 'team_list_members', expect: 'registered' },
    { tool: 'team_send_message', expect: 'registered' },
    { tool: 'team_delegate', expect: 'not-registered' },
  ],
  'session-capa-a': [
    { tool: 'team_delegate', expect: 'registered' },
    { tool: 'team_list_members', expect: 'not-registered' },
    { tool: 'team_send_message', expect: 'not-registered' },
  ],
  'session-capb-b': [
    { tool: 'team_list_members', expect: 'not-registered' },
    { tool: 'team_delegate', expect: 'not-registered' },
    { tool: 'team_send_message', expect: 'not-registered' },
  ],
}
for (const [as, tools] of Object.entries(n1Plan)) {
  const agentReport = {}
  for (const { tool, expect } of tools) {
    const { registered } = await toolState(as, tool)
    agentReport[tool] = registered
    check(`n1-${as}-${tool}`, `N1 ${as} ${tool}`, expect, registered, '')
  }
  report.n1_team_tools[as] = agentReport
}

// ── 2. N3: team-skills wiring (the observations) ─────────────────────────
console.log('\n=== N3: team-skills wiring ===')
{
  const { status, body } = await get('/__p6t6/state')
  report.state_before = body
  report.n3_skills.observations = body?.observations ?? []
  // The leader + member A allow the skill 'base'; it is not in the team
  // skills catalog (the row config's teamSkills carries only
  // alpha1-real-skill), so both produce an alpha1 skip observation. This
  // proves the skills wiring is ACTIVE on the live host (the allow-list is
  // consulted; unknown items are skipped with a diagnostic).
  const skips = (body?.observations ?? []).filter((o) => String(o).includes('skipped'))
  check('n3-skills-wiring-active', 'alpha1 skill-skip observations present (wiring active)', true, skips.length >= 2, `observations=${JSON.stringify(body?.observations)}`)
}

// ── 2b. N3b: the REAL team skill (plan 8.4) — per-member scope visibility ──
// The row config's teamSkills registers alpha1-real-skill in the team skill
// catalog. Member A's skills allow-list names it, so the adapter registers
// it in member A's AGENT SCOPE (ctx.skills.register files into the calling
// context's scope layer; the registry merges global + the viewing scope's
// chain, so the registration is invisible to other scopes). The model-facing
// `skill` tool (dsh-tool-skill, standard preset) loads by name: visible for
// member A, not loadable for member B (skills deny — the CLEAN no-global-
// leak proof: it has the skill tool but not the skill), for the leader (the
// root mounts no preset substrate by design — D1 v2: the root keeps exactly
// today's tool table, so the `skill` tool itself is absent there), or under
// an unknown name (control).
console.log('\n=== N3b: real team skill alpha1-real-skill (per-member scope) ===')
async function loadSkill(as, name) {
  const { status, body } = await post('/__p6t6/tool', {
    name: 'skill', as, args: { name }, callId: `n3b-${as}-${name}-${Math.random().toString(36).slice(2, 8)}`,
  })
  if (body?.ok === true) return { cls: 'visible', raw: body }
  const msg = String(body?.error?.message ?? body?.error ?? '')
  if (msg.includes('unknown or no longer available')) return { cls: 'not-visible', raw: body }
  const code = body?.error?.info?.code
  return { cls: code ? `error-${code}` : `error-unknown`, raw: body }
}
{
  const memberA = await loadSkill('session-capa-a', 'alpha1-real-skill')
  const memberB = await loadSkill('session-capb-b', 'alpha1-real-skill')
  const leader = await loadSkill('cap-root', 'alpha1-real-skill')
  const control = await loadSkill('session-capa-a', 'cap-unknown-skill')
  report.n3_skills.realSkill = { memberA: memberA.cls, memberB: memberB.cls, leader: leader.cls, control: control.cls }
  check('n3b-real-skill-member-a-visible', 'alpha1-real-skill loadable in member A scope (real skill registered)', 'visible', memberA.cls, JSON.stringify(memberA.raw).slice(0, 220))
  check('n3b-real-skill-member-b-invisible', 'alpha1-real-skill NOT loadable in member B scope (skills deny)', 'not-visible', memberB.cls, JSON.stringify(memberB.raw).slice(0, 220))
  check('n3b-real-skill-leader-invisible', 'alpha1-real-skill NOT loadable in leader scope (root mounts no preset substrate by design)', true, leader.cls !== 'visible', JSON.stringify(leader.raw).slice(0, 220))
  check('n3b-real-skill-control-unknown', 'control: an unknown skill name is not loadable in member A scope', 'not-visible', control.cls, JSON.stringify(control.raw).slice(0, 220))
}

// ── 3. N4: MCP AND semantics (before the durable override) ───────────────
console.log('\n=== N4: MCP AND semantics (before durable override) ===')
function mcpViews(stateBody) {
  const sessions = stateBody?.governance?.sessions ?? {}
  const out = {}
  for (const [sid, s] of Object.entries(sessions)) {
    out[sid] = {
      mounted: s?.mcp?.mounted,
      allowed: s?.mcp?.allowed,
      serverName: s?.mcp?.serverName,
      deniedBy: s?.mcp?.deniedBy,
    }
  }
  return out
}
report.n4_mcp.before = mcpViews(report.state_before)
// Before the durable override: ALL sessions fail-closed (allowed:false),
// regardless of the template's mcp entry (the durable side is fail-closed).
for (const sid of Object.keys(report.n4_mcp.before)) {
  check(`n4-before-${sid}-fail-closed`, `N4 ${sid} fail-closed before override`, false, report.n4_mcp.before[sid].allowed, JSON.stringify(report.n4_mcp.before[sid]))
}
// NOTE on MCP view semantics (verified against the harness plugin.mjs):
//   `allowed` = mcpView.allowed = the DURABLE-side consumption view (the team
//   scope's mcp governance). It is NOT the AND with the template's per-member
//   mcp entry.
//   `mounted` = mcpFiber !== undefined = the LAZY mount (false until the agent
//   actually activates the MCP through a model turn; the model cell here is
//   itself fail-closed, so no turn fires).
// The template's per-member mcp-deny (member A) applies at the filterMcpServers
// (mount) level and is covered by t4a at the glue level. The live-host check
// confirms the DURABLE side (the mcpView.allowed) + the fail-closed baseline.

// ── 4. N4: create the durable MCP-allow override, re-check ───────────────
console.log('\n=== N4: durable MCP-allow override ===')
{
  const { status, body } = await post('/__p6t6/governance/mutate', {
    as: 'cap-root',
    recordId: 'cap-mcp-allow',
    scope: 'team',
    cells: { mcp: { kind: 'allow', items: ['cap-mcp'] } },
  })
  report.n4_mcp.override = { status, body }
  console.log(`  governance/mutate status=${status} body=${JSON.stringify(body).slice(0, 300)}`)
  const ok = status === 200 || status === 201
  check('n4-override-admitted', 'durable MCP-allow override admitted', true, ok, `status=${status} body=${JSON.stringify(body).slice(0, 300)}`)
}
{
  const { status, body } = await get('/__p6t6/state')
  report.state_after = body
  report.n4_mcp.after = mcpViews(body)
  // After the durable team-scope allow of cap-mcp: the DURABLE side (the
  // mcpView.allowed) is true for ALL THREE sessions (team scope, not per-member).
  // The template's per-member mcp-deny (member A) applies at the mount
  // (filterMcpServers) level, NOT the mcpView.allowed. The mount is lazy (false
  // here: the model cell is fail-closed, so no model turn fires to activate it).
  const expectations = {
    'cap-root': { allowed: true, mounted: false },
    'session-capa-a': { allowed: true, mounted: false },
    'session-capb-b': { allowed: true, mounted: false },
  }
  for (const [sid, exp] of Object.entries(expectations)) {
    const v = report.n4_mcp.after[sid]
    check(`n4-after-${sid}-allowed-durable`, `N4 ${sid} durable-allowed (team scope)`, exp.allowed, v?.allowed, JSON.stringify(v))
    check(`n4-after-${sid}-mounted-lazy`, `N4 ${sid} mounted (lazy, false until a turn)`, exp.mounted, v?.mounted, JSON.stringify(v))
  }
}

// ── 5. write the report ──────────────────────────────────────────────────
const outFile = join(__dirname, `cap-check-${runStamp}.json`)
writeFileSync(outFile, JSON.stringify(report, null, 2))
console.log(`\n[cap-check] report → ${outFile}`)
console.log(`[cap-check] PASS=${report.checks.length - report.failures.length}/${report.checks.length}`)
if (report.failures.length > 0) {
  console.error(`[cap-check] FAILURES:`)
  for (const f of report.failures) console.error(`  - ${f.id}: expected=${f.expected} actual=${f.actual}`)
  process.exitCode = 1
} else {
  console.log('[cap-check] ALL CHECKS PASSED')
}
