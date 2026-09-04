// t12v-ledger-dump.mjs <team_domain.json>
import { readFileSync } from 'node:fs'
const file = process.argv[2]
const j = JSON.parse(readFileSync(file, 'utf8'))
const tables = j.tables ?? {}
console.log('tables:', Object.keys(tables).join(', '))
for (const [name, value] of Object.entries(tables)) {
  if (Array.isArray(value)) {
    console.log(`\n=== ${name} (${value.length}) ===`)
    for (const e of value) console.log(JSON.stringify(e).slice(0, 500))
  } else if (value && typeof value === 'object') {
    console.log(`\n=== ${name} (object, ${Object.keys(value).length} keys) ===`)
    for (const [k, v] of Object.entries(value)) console.log(`${k} :: ${JSON.stringify(v).slice(0, 500)}`)
  } else {
    console.log(`\n=== ${name} = ${JSON.stringify(value)}`)
  }
}
if (j.global !== undefined) console.log('\nglobal:', JSON.stringify(j.global).slice(0, 500))
if (j.unit !== undefined) console.log('unit:', JSON.stringify(j.unit).slice(0, 300))
