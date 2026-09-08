// forensics-batch.mjs — V2 plan: one read-only forensic pass per phase.
//
// usage: node forensics-batch.mjs
//
// Consolidates the round-1 per-script forensics into one parallel read:
// root log tail, last tools of root + members, domain team/member/ledger
// summary, ledger fact-type histogram for the root, override rows,
// operation count. Prints one consolidated block (NOTES-ready).
import {
  lastTools, ledgerFactsForRoot, loadDomain, logRows, readBootState,
  sessionLogPath, teamMembers,
} from './common.mjs'

const state = readBootState()
const root = state.rootSessionId
const dom = loadDomain()

const section = (title, fn) => {
  process.stdout.write(`\n── ${title} ─────────────────────────────\n`)
  try { fn() } catch (e) { console.log(`(error: ${e.message})`) }
}

section(`team_sessions[${root.slice(0, 20)}…]`, () => {
  const ts = dom.row('team_sessions', root)
  if (!ts) { console.log('ABSENT'); return }
  console.log(`blueprint=${ts.blueprint.blueprintId}@${ts.blueprint.revision} hash=${ts.blueprint.contentHash.slice(0, 19)}… generation=${ts.generation} created=${ts.createdAt}`)
})

section('members', () => {
  for (const m of teamMembers(dom, root)) {
    console.log(`${m.label}  ${m.instanceId}  template=${m.templateId}  lifecycle=${m.lifecycle}  child=${m.childSessionId}`)
  }
})

section(`ledger (root facts: count / tail / histogram)`, () => {
  const facts = ledgerFactsForRoot(dom, root)
  if (facts.length === 0) { console.log('empty'); return }
  console.log(`count=${facts.length} seq=${facts[0].sequence}..${facts[facts.length - 1].sequence} last=${facts[facts.length - 1].createdAt}`)
  const hist = {}
  for (const f of facts) hist[f.factType] = (hist[f.factType] ?? 0) + 1
  for (const [t, c] of Object.entries(hist).sort((a, b) => b[1] - a[1])) console.log(`  ${t}: ${c}`)
})

section('overrides (all roots)', () => {
  const rows = dom.rows('overrides')
  if (rows.length === 0) { console.log('none'); return }
  for (const [k, v] of rows) console.log(`${k}: ${JSON.stringify(v).slice(0, 160)}`)
})

section('operations (count + last 3)', () => {
  const ops = dom.rows('operations')
  console.log(`count=${ops.length}`)
  for (const [k, v] of ops.slice(-3)) console.log(`${k}: ${JSON.stringify(v).slice(0, 160)}`)
})

section(`durable log tail (root, last 12 structural rows)`, () => {
  const p = sessionLogPath(root)
  if (!p) { console.log('no log'); return }
  const rows = logRows(p).slice(-12)
  for (const r of rows) {
    const d = r.raw
    let brief = JSON.stringify(d).slice(0, 140)
    if (d.type === 'tool/call') brief = `tool/call t=${d.turn} s=${d.step} ${d.name} ${String(d.arguments).slice(0, 80)}`
    if (d.type === 'user/message') brief = `user/message ${String(JSON.stringify(d.content ?? '')).slice(0, 100)}`
    console.log(`  seq=${r.seq} ${r.type ?? '?'} ${brief}`)
  }
})

section('last tools (root + members)', () => {
  const sessions = [{ id: root, name: 'leader' }, ...teamMembers(dom, root).map((m) => ({ id: m.childSessionId, name: m.label ?? m.instanceId }))]
  for (const s of sessions) {
    const p = sessionLogPath(s.id)
    if (!p) { console.log(`${s.name}: no log`); continue }
    const ft = lastTools(p)
    if (!ft) { console.log(`${s.name}: no tools`); continue }
    console.log(`${s.name.padEnd(8)} total=${ft.count} team_*=${ft.team.length} mcp=${ft.mcp.join(',') || '∅'}`)
  }
})

console.log('\n[forensics-batch] done')
