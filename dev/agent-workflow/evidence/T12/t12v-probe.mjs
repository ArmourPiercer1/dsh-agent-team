// Quick state probe for run #13: glue tail, mock request count, child log records, ledger seq.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'

const ev = 'D:\\AgentDev\\dsh-plugins\\dsh-agent-team\\dev\\agent-workflow\\evidence\\T12'
const hA = 'D:\\AgentDev\\dsh-plugins\\dsh-agent-team\\references\\.dsh-test-t12-a'

console.log('now:', new Date().toISOString())
for (const [label, port] of [['A1', '3181'], ['A2', '3182']]) {
  const p = join(ev, 'instances', label, `instance-port${port}.log`)
  if (!existsSync(p)) { console.log(`${label}: no log`); continue }
  const lines = readFileSync(p, 'utf8').split('\n').filter((l) => l.trim())
  const wl = lines.filter((l) => l.startsWith('[t12v-wl]'))
  console.log(`${label}: total=${lines.length} wl=${wl.length} lastWl=${wl.length ? wl[wl.length - 1].slice(0, 150) : '(none)'}`)
}
const run = readFileSync(join(ev, 't12v-run.log'), 'utf8').split('\n').filter((l) => l.trim())
const mockReqs = run.filter((l) => /mock: \d+ (text|tool-call) reply/.test(l))
console.log(`mock replies seen: ${mockReqs.length}; last: ${mockReqs.length ? mockReqs[mockReqs.length - 1].slice(0, 120) : '(none)'}`)
const tail = run.slice(-4)
console.log('runner tail:', tail.map((l) => l.slice(0, 140)).join(' | '))
const td = JSON.parse(readFileSync(join(hA, 'storages', 'team_domain.json'), 'utf8'))
const ledger = td.tables.ledger
const seqs = Object.keys(ledger).filter((k) => k !== '__ledger_sequence_counter').sort()
console.log(`ledger seqs: [${seqs.join(',')}] counter=${ledger.__ledger_sequence_counter?.value}`)
function findZstd(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...findZstd(p))
    else if (e.name.endsWith('.zstd')) out.push(p)
  }
  return out
}
for (const p of findZstd(join(hA, 'sessions'))) {
  const raw = zstdDecompressSync(readFileSync(p))
  const recs = raw.toString('utf8').split('\n').filter((l) => l.trim())
  const id = p.split('session-')[1]?.split(/[\\/]/)[0] ?? p
  const last = recs.length ? JSON.parse(recs[recs.length - 1]) : null
  const lastKind = last ? (last.type ?? last.kind ?? '?') : '?'
  console.log(`session ${id}: records=${recs.length} lastKind=${lastKind}`)
}
