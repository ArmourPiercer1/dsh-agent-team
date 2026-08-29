// V11 manifest digest -> file (counts + lists per classification)
import { readFileSync, writeFileSync } from 'node:fs'
const m = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const out = []
out.push('== classification_rule ==\n' + String(m.baseline.classification_rule))
out.push('== disposition enum == ' + (m.baseline.disposition_enum ?? []).join(', '))
const files = m.files
const byClass = new Map()
for (const f of files) {
  const c = f.classification
  if (!byClass.has(c)) byClass.set(c, [])
  byClass.get(c).push(f)
}
for (const c of ['TEAM_OWNED', 'GENERIC_FORK_CAPABILITY', 'UNRELATED_FORK_FEATURE', 'GENERATED_FROM_TEAM', 'MIXED']) {
  const list = byClass.get(c) ?? []
  out.push(`\n== ${c}: ${list.length} files ==`)
  for (const f of list) {
    const extra = []
    if (f.hunks !== undefined) extra.push(`hunks=${Array.isArray(f.hunks) ? f.hunks.length : typeof f.hunks}`)
    if (f.mixed_hunks) extra.push(`mixed_hunks=${f.mixed_hunks.length}`)
    if (f.disposition) extra.push(`disposition=${f.disposition}`)
    out.push(`  ${f.path}${extra.length ? ' [' + extra.join(' ') + ']' : ''}`)
    if (f.reason) out.push(`      reason: ${f.reason}`)
    for (const h of f.hunks ?? []) {
      out.push(`      hunk: kind=${h.kind} ${h.note ? '| ' + h.note : ''}`)
    }
    for (const h of f.mixed_hunks ?? []) {
      out.push(`      MIXED hunk#${h.hunk}: kind=${h.kind} ${h.note ? '| ' + h.note : ''}`)
    }
  }
}
writeFileSync(process.argv[3], out.join('\n'), 'utf8')
console.log('digest written: ' + process.argv[3])
console.log('counts: ' + [...byClass.entries()].map(([c, l]) => `${c}=${l.length}`).join(' '))
