// suite-face-verify.mjs — V2 plan B7: concurrent tool-face re-verification.
//
// usage:
//   node suite-face-verify.mjs [--root <id>] [--mode leader|direct] [--label <tag>]
//
// leader mode (default, campaign-proven): ONE leader prompt instructs the
// leader to follow_up every active member with "请只回复 OK"; then all
// sessions (root + member children) are waited on concurrently with
// wait-turn semantics, and each log's last model-request tools array is
// asserted: leader = 10 team_* (+ dtesthttp); members = 10 team_* + dtesthttp.
//
// direct mode: one concurrent API prompt per session (tests whether the
// public session API authorizes cross-session prompts from the root cookie).
//
// Assertions are soft-configurable: expected team-tool count and the
// dtesthttp presence; dtest-mini presence is REPORTED, not asserted
// (override state varies by phase).
import {
  logRows, maxTurn, lastTools, loadDomain, readBootState, readCookie,
  sessionLogPath, sessionPrompt, sleep, teamMembers,
} from './common.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HERE } from './common.mjs'

const argv = process.argv.slice(2)
const get = (flag, dflt) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : dflt }
const state = readBootState()
const root = get('--root', state.rootSessionId)
const mode = get('--mode', 'leader')
const label = get('--label', 'face')
const origin = state.origin
const cookie = readCookie()

const dom = loadDomain()
if (dom.row('team_sessions', root) === undefined) {
  console.error(`[face-verify] root ${root} not in team_sessions`); process.exit(2)
}
const members = teamMembers(dom, root).filter((m) => m.lifecycle !== 'ARCHIVED')
const sessions = [{ id: root, name: 'leader' }, ...members.map((m) => ({ id: m.childSessionId, name: m.label ?? m.instanceId }))]

const readPrompt = (f) => readFileSync(join(HERE, 'prompts', f), 'utf8').trim()

// baselines BEFORE prompting
const base = {}
for (const s of sessions) {
  const p = sessionLogPath(s.id)
  if (!p) { console.error(`[face-verify] no log for ${s.name} (${s.id})`); process.exit(2) }
  base[s.id] = { logPath: p, turn: maxTurn(p) }
}
console.log(`[face-verify] mode=${mode} root=${root.slice(0, 20)}… sessions=${sessions.map((s) => s.name).join(',')} (baseline turns ${sessions.map((s) => base[s.id].turn).join(',')})`)

let delivered = 0
if (mode === 'direct') {
  const text = readPrompt('ok-direct.md')
  await Promise.all(sessions.map(async (s) => {
    const r = await sessionPrompt(origin, cookie, s.id, text)
    if (r.ok) { delivered += 1; console.log(`[face-verify] prompt OK -> ${s.name}`) }
    else console.log(`[face-verify] prompt REJECTED -> ${s.name}: status=${r.status} err=${JSON.stringify(r.error ?? r.raw?.nonJson ?? '?').slice(0, 200)}`)
  }))
} else {
  const leaderPrompt = readPrompt('ok-leader-route.md').replace('{MEMBERS}', members.map((m) => m.label ?? m.instanceId).join('、') || '（无成员）')
  const r = await sessionPrompt(origin, cookie, root, leaderPrompt)
  if (!r.ok) { console.error(`[face-verify] leader prompt rejected: status=${r.status} err=${JSON.stringify(r.error ?? r.raw?.nonJson ?? '?').slice(0, 300)}`); process.exit(2) }
  delivered = 1
  console.log(`[face-verify] leader prompt OK (route=${mode})`)
}
if (delivered === 0) { console.error('[face-verify] no prompt delivered — aborting'); process.exit(2) }

// concurrent wait-turn per session (180s each; the leader waits for its
// own turn AND member turns complete inside the leader turn, so member
// logs usually finish before the leader's)
const waitOne = async (s) => {
  const b = base[s.id]
  const deadline = Date.now() + 180_000
  for (;;) {
    const rows = logRows(b.logPath)
    const done = rows.some((r) => r.type === 'turn/end' && typeof r.turn === 'number' && r.turn > b.turn)
    if (done) return { name: s.name, ok: true }
    if (Date.now() > deadline) {
      const tail = rows.slice(-3).map((r) => `${r.type} t=${r.turn}`).join(' | ')
      return { name: s.name, ok: false, detail: `timeout; tail: ${tail}` }
    }
    await sleep(2_000)
  }
}
const waits = await Promise.all(sessions.map(waitOne))
for (const w of waits) console.log(`${w.ok ? 'PASS' : 'FAIL'}  wait-turn ${w.name}${w.detail ? ' — ' + w.detail : ''}`)
if (waits.some((w) => !w.ok)) process.exit(1)

// face assertions
const problems = []
for (const s of sessions) {
  const ft = lastTools(base[s.id].logPath)
  if (!ft) { problems.push(`${s.name}: no tools array found`); continue }
  const hasHttp = ft.mcp.includes('mcp__dtesthttp__ping')
  const hasMini = ft.mcp.includes('mcp__dtest-mini__ping')
  const expectTeam = 10
  console.log(`face ${s.name.padEnd(8)} total=${ft.count} team_*=${ft.team.length} mcp=${ft.mcp.join(',') || '∅'} (seq ${ft.seq})`)
  if (ft.team.length !== expectTeam) problems.push(`${s.name}: team_* count ${ft.team.length} !== ${expectTeam}`)
  if (!hasHttp) problems.push(`${s.name}: mcp__dtesthttp__ping missing`)
  if (hasMini) console.log(`note ${s.name}: mcp__dtest-mini__ping PRESENT (override allowed in current phase?)`)
}

if (problems.length === 0) console.log(`[face-verify] PASS — ${sessions.length} faces verified (label=${label})`)
else for (const p of problems) console.log(`[face-verify] FAIL ${p}`)
process.exit(problems.length === 0 ? 0 : 1)
