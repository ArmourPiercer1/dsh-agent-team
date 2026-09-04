// t12v-ledger-ledger.mjs <team_domain.json> — prints ONLY the ledger table, full entries
import { readFileSync } from 'node:fs'
const file = process.argv[2]
const j = JSON.parse(readFileSync(file, 'utf8'))
const led = j.tables?.ledger ?? {}
const rows = Object.entries(led).filter(([k]) => !k.startsWith('__'))
rows.sort((a, b) => {
  const sa = a[1].sequence ?? a[1].seq ?? 0
  const sb = b[1].sequence ?? b[1].seq ?? 0
  return sa - sb
})
for (const [key, row] of rows) {
  const ts = row.timestamp ?? row.createdAt ?? row.at ?? row.ts ?? ''
  const kind = row.kind ?? row.factType ?? row.type ?? ''
  const seq = row.sequence ?? row.seq ?? ''
  console.log(`[seq=${seq}] ${ts} ${kind}`)
  console.log(`   key=${key}`)
  console.log(`   ${JSON.stringify(row).slice(0, 700)}`)
  console.log('')
}
