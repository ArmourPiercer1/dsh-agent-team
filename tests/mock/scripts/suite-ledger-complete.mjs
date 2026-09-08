// suite-ledger-complete.mjs — V2 plan R-F11 API half (ledger completeness).
//
// usage: node suite-ledger-complete.mjs [--root <id>] [--limit 50] [--max-pages 40]
//
// Pages team.getLedgerPage through to the end (cursor null) and asserts the
// SERVER contract: pages strictly increasing, no gaps within a team's own
// sequence space, Σ entries === reported total, tail sequence. Then
// cross-checks against the durable domain (team_domain.json ledger rows for
// the same root) — entry count AND tail must match.
//
// Note (round-1 F11): the truncation was CLIENT-side (the store's
// frontier>=total unit mismatch). This script proves the server side is
// sound and provides the tail facts the UI half (G5) compares against.
import {
  ledgerFactsForRoot, loadDomain, readBootState, readCookie, teamRemote,
} from './common.mjs'

const argv = process.argv.slice(2)
const get = (flag, dflt) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : dflt }
const state = readBootState()
const root = get('--root', state.rootSessionId)
const limit = Number(get('--limit', 50))
const maxPages = Number(get('--max-pages', 40))

const origin = state.origin
const cookie = readCookie()

let after = 0
let pages = 0
let total = null
const seen = new Set()
let tail = null
const problems = []

for (;;) {
  const r = await teamRemote(origin, cookie, 'team.getLedgerPage', { teamSessionId: root, afterSequence: after, limit })
  if (!r.ok) { problems.push(`page ${pages}: RPC failed status=${r.status} err=${JSON.stringify(r.error).slice(0, 200)}`); break }
  const data = r.value.data
  pages += 1
  total = data.total
  const entries = data.entries
  if (entries.length === 0 && data.nextAfterSequence === null) break
  for (const e of entries) {
    if (seen.has(e.sequence)) problems.push(`duplicate sequence ${e.sequence}`)
    seen.add(e.sequence)
    if (e.rootSessionId !== root) problems.push(`foreign entry sequence=${e.sequence} root=${e.rootSessionId}`)
    if (e.sequence <= after) problems.push(`entry sequence ${e.sequence} <= afterSequence ${after}`)
  }
  const seqs = entries.map((e) => e.sequence)
  for (let i = 1; i < seqs.length; i++) if (seqs[i] <= seqs[i - 1]) problems.push(`non-increasing page sequences at ${seqs[i - 1]} -> ${seqs[i]}`)
  if (entries.length > 0) tail = seqs[seqs.length - 1]
  after = data.nextAfterSequence
  if (after === null) break
  if (pages >= maxPages) { problems.push(`stopped at max-pages=${maxPages} (cursor ${after})`); break }
}

const dom = loadDomain()
const durable = ledgerFactsForRoot(dom, root)
const durableTail = durable.length > 0 ? durable[durable.length - 1].sequence : null

console.log(`[ledger-complete] root=${root.slice(0, 24)}… pages=${pages} serverTotal=${total} fetched=${seen.size} tail=${tail}`)
console.log(`[ledger-complete] durable(domain): entries=${durable.length} tail=${durableTail}`)

if (total === null) problems.push('no pages returned at all')
if (seen.size !== total) problems.push(`Σ entries (${seen.size}) !== server total (${total})`)
if (durable.length !== total) problems.push(`durable count (${durable.length}) !== server total (${total})`)
if (durableTail !== tail) problems.push(`durable tail (${durableTail}) !== paged tail (${tail})`)

if (problems.length === 0) {
  console.log('[ledger-complete] PASS — server paging complete, matches durable ground truth')
  process.exit(0)
}
for (const p of problems) console.log(`[ledger-complete] FAIL ${p}`)
process.exit(1)
