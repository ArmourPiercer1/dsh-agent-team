// suite-domain-diff.mjs — V2 plan: durable domain truth vs a declared
// expectation list (per-phase JSON). Read-only.
//
// usage: node suite-domain-diff.mjs <expected.json>
//
// expected.json schema (all fields optional):
// {
//   "root": "session-...",            // defaults to boot-state root
//   "minFacts": 50,                   // min ledger facts for the root
//   "facts": [ {"factType": "progress-recorded", "minCount": 1}, ... ],
//   "members": [ {"label": "W1", "lifecycle": "SETTLED"}, ... ],
//   "minMembers": 2,
//   "overrides": 0                    // exact count of override rows (any root)
// }
// exit 0 = all expectations met; 1 = any miss (table printed).
import { ledgerFactsForRoot, loadDomain, readBootState, teamMembers } from './common.mjs'
import { readFileSync } from 'node:fs'

const path = process.argv[2]
if (!path) { console.error('usage: node suite-domain-diff.mjs <expected.json>'); process.exit(2) }
const expected = JSON.parse(readFileSync(path, 'utf8'))
const state = (() => { try { return readBootState() } catch { return null } })()
const root = expected.root ?? state?.rootSessionId
const dom = loadDomain()

const rows = []
const miss = (name, want, got) => rows.push({ name, want, got, ok: false })
const hit = (name, want, got) => rows.push({ name, want, got, ok: true })

const facts = ledgerFactsForRoot(dom, root)
if (expected.minFacts !== undefined) {
  const ok = facts.length >= expected.minFacts
  ok ? hit('minFacts', `>=${expected.minFacts}`, facts.length) : miss('minFacts', `>=${expected.minFacts}`, facts.length)
}
for (const f of expected.facts ?? []) {
  const got = facts.filter((x) => x.factType === f.factType).length
  const want = f.minCount !== undefined ? `>=${f.minCount}` : String(f.minCount ?? 1)
  const ok = got >= (f.minCount ?? 1)
  ok ? hit(`fact:${f.factType}`, want, got) : miss(`fact:${f.factType}`, want, got)
}
const members = teamMembers(dom, root)
if (expected.minMembers !== undefined) {
  const ok = members.length >= expected.minMembers
  ok ? hit('minMembers', `>=${expected.minMembers}`, members.length) : miss('minMembers', `>=${expected.minMembers}`, members.length)
}
for (const m of expected.members ?? []) {
  const got = members.find((x) => x.label === m.label)
  if (!got) { miss(`member:${m.label}`, 'exists', 'absent'); continue }
  if (m.lifecycle !== undefined) {
    const ok = got.lifecycle === m.lifecycle
    ok ? hit(`member:${m.label}.lifecycle`, m.lifecycle, got.lifecycle) : miss(`member:${m.label}.lifecycle`, m.lifecycle, got.lifecycle)
  } else hit(`member:${m.label}`, 'exists', `lifecycle=${got.lifecycle}`)
}
if (expected.overrides !== undefined) {
  const got = dom.rows('overrides').length
  const ok = got === expected.overrides
  ok ? hit('overrides', String(expected.overrides), got) : miss('overrides', String(expected.overrides), got)
}

console.log(`[domain-diff] root=${root.slice(0, 24)}…`)
for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  want=${r.want} got=${r.got}`)
const bad = rows.filter((r) => !r.ok).length
console.log(bad === 0 ? '[domain-diff] PASS — all expectations met' : `[domain-diff] FAIL — ${bad} miss(es)`)
process.exit(bad === 0 ? 0 : 1)
