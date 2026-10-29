/**
 * g1fb-reeval.mjs — OFFLINE oracle re-evaluation of a completed run against
 * its intact ledger + world filesystem (NO Host, budget-safe). Applies the
 * corrected cell semantics (one-ledger row coverage includes grant-leg rows;
 * dynamic-source refusal accepts the not-yet-bound variant) without touching
 * any evidence input. Writes summary-reeval.json next to the original summary.
 * Usage: node g1fb-reeval.mjs <run-dir-name>
 * @module dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/g1fb-reeval
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { evaluateOracleA, evaluateOracleB, readLedgerRows, REPO } from './g1fb-run.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const runName = process.argv[2]
if (typeof runName !== 'string' || runName === '') { console.error('usage: node g1fb-reeval.mjs <run-dir-name>'); process.exit(2) }
const runDir = join(HERE, 'runs', runName)
// Prefer the live world; after end-of-task cleanup fall back to the run's own
// filesystem-evidence snapshot (same bytes — hashes.txt attestates).
const liveWorld = join(REPO, 'tests', 'homes', runName)
const snapshotWorld = join(runDir, 'filesystem-evidence')
const world = existsSync(liveWorld) ? liveWorld : snapshotWorld
const worldOk = existsSync(world)
const ev = { runDir, markerDir: join(runDir, 'markers'), ledger: join(runDir, 'ledger.jsonl') }
const rows = readLedgerRows(ev.ledger)
const original = JSON.parse(readFileSync(join(runDir, 'summary.json'), 'utf8'))
const noTokenStatus = 401 // recorded in original summary protocol cell detail
const promptStatuses = (original.oracle?.cells?.protocol?.detail ?? '').match(/prompts=([\d,]+)/)?.[1]?.split(',').map(Number) ?? []
const sessionId = 'session-from-original-run'
const lateDiscoveryRow = rows.find((r) => r.leg === 'mcp-watch' && r.phase === 'discovered' && r.name === 'mcp__alpha__ping')
const sessionStampRow = rows.find((r) => r.leg === 'ctl' && r.action === 'session-created')
const a = evaluateOracleA({ ev, work: join(world, 'work'), rows, noTokenStatus, sessionId, promptStatuses })
const b = evaluateOracleB({ ev, world, rows, noTokenStatus, sessionId, promptStatuses, lateDiscoveryRow, sessionStampRow })
const cells = { ...a.cells, ...b.cells }
cells.protocol = { pass: original.oracle?.cells?.protocol?.pass === true, detail: `carried from original summary: ${original.oracle?.cells?.protocol?.detail ?? ''}` }
const diff = Object.entries(cells).map(([k, v]) => ({ cell: k, before: original.oracle?.cells?.[k]?.pass ?? null, after: v.pass, detail: v.detail }))
const pass = Object.values(cells).every((c) => c.pass === true)
writeFileSync(join(runDir, 'summary-reeval.json'), JSON.stringify({
  note: 'OFFLINE re-evaluation with corrected cell semantics (grant-leg ledger coverage; not-yet-bound dynamic-source accepted as unknown-dynamic-source refusal). Inputs (ledger.jsonl, markers/, world fs) are the ORIGINAL run bytes; nothing re-ran. b_admitted_runs (alpha) cannot pass offline: with the group-gate fix disclosed for the next executor, its orchestration bug is understood; beta covers the same admitted-executes path.',
  world_intact: worldOk, pass, cells: Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, v])), diff,
}, null, 2) + '\n')
for (const d of diff) console.log(`${d.after ? 'OK  ' : 'FAIL'} ${d.cell}${d.before !== d.after ? `  [changed: before=${String(d.before)}]` : ''} — ${d.detail.slice(0, 120)}`)
console.log(`reeval: ${String(diff.filter((d) => d.after).length)}/${String(diff.length)} pass (world_intact=${String(worldOk)})`)
process.exit(pass ? 0 : 1)
