// V11 provenance manifest digest
import { readFileSync } from 'node:fs'
const m = JSON.parse(readFileSync(process.argv[2], 'utf8'))
console.log('== baseline ==')
console.log(JSON.stringify(m.baseline, null, 1).slice(0, 1200))
console.log('== top-level keys ==', Object.keys(m).join(', '))
const files = m.files ?? m.entries ?? []
console.log('== file entries: ' + files.length + ' ==')
const byClass = new Map()
for (const f of files) {
  const c = f.classification
  if (!byClass.has(c)) byClass.set(c, [])
  byClass.get(c).push(f)
}
for (const [c, list] of byClass) {
  console.log(`\n== classification ${c}: ${list.length} files ==`)
  for (const f of list) {
    const extra = []
    if (f.hunks !== undefined) extra.push(`hunks=${Array.isArray(f.hunks) ? f.hunks.length : typeof f.hunks}`)
    if (f.mixed_hunks) extra.push(`mixed=${f.mixed_hunks.length}`)
    console.log(`  ${f.path}${extra.length ? ' [' + extra.join(' ') + ']' : ''}`)
    if (f.reason) console.log(`      reason: ${String(f.reason).slice(0, 160)}`)
  }
}
