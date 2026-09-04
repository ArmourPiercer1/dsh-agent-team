// Forensic read: team_domain ledger tail + session log records for run #13.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'

const hA = 'D:\\AgentDev\\dsh-plugins\\dsh-agent-team\\references\\.dsh-test-t12-a'

// 1. team_domain.json ledger
const td = JSON.parse(readFileSync(join(hA, 'storages', 'team_domain.json'), 'utf8'))
console.log('team_domain top keys:', Object.keys(td).join(','))
const tables = td.tables ?? {}
console.log('tables:', Object.keys(tables).join(','))
const ledger = tables.ledger ?? td.global?.ledger ?? null
if (ledger) {
  const events = Array.isArray(ledger) ? ledger : (ledger.events ?? [])
  console.log(`ledger events: ${events.length} (tail 12):`)
  for (const e of events.slice(-12)) {
    console.log('  ', JSON.stringify(e).slice(0, 220))
  }
} else {
  console.log('ledger: not found under expected keys; dumping structure:', JSON.stringify(td).slice(0, 500))
}

// 2. session logs
const sessionsDir = join(hA, 'sessions')
function findZstd(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...findZstd(p))
    else if (e.name.endsWith('.zstd')) out.push(p)
  }
  return out
}
for (const p of findZstd(sessionsDir)) {
  const st = statSync(p)
  const raw = zstdDecompressSync(readFileSync(p))
  const lines = raw.toString('utf8').split('\n').filter((l) => l.trim())
  const id = p.split('session-')[1]?.split(/[\\/]/)[0] ?? p
  console.log(`\n== ${id} file=${st.size}B mtime=${st.mtime.toISOString()} records=${lines.length} ==`)
  for (const line of lines) {
    let rec
    try { rec = JSON.parse(line) } catch { console.log('  (unparsed) ' + line.slice(0, 120)); continue }
    const ts = rec.ts ?? rec.timestamp ?? rec.at ?? rec.receivedAt ?? rec.time ?? rec.t ?? ''
    const kind = rec.type ?? rec.kind ?? rec.event ?? rec.name ?? '?'
    console.log(`  ${String(ts).slice(11, 23)} ${kind} ${JSON.stringify(rec).slice(0, 160)}`)
  }
}
