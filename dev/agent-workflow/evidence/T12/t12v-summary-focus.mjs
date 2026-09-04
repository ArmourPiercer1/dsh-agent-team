// t12v-summary-focus.mjs — dump specific scenarios' assertions + selected evidence keys
import fs from 'node:fs'

const p = process.argv[2] ?? 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/T12/summary.json'
const keys = (process.argv[3] ?? 'V4,V5').split(',')
const evKeys = (process.argv[4] ?? '').split(',').filter(Boolean)
const s = JSON.parse(fs.readFileSync(p, 'utf8'))
for (const k of keys) {
  const v = (s.scenarios ?? {})[k]
  if (v === undefined) { console.log(`==== ${k} ABSENT`); continue }
  console.log(`==== ${k} pass=${v.pass} dur=${(v.durationMs / 1000).toFixed(1)}s`)
  for (const a of v.assertions ?? []) {
    const mark = a.ok ? 'OK  ' : 'FAIL'
    console.log(`  [${mark}] ${a.name}` + (a.detail !== undefined ? ` :: ${String(a.detail).slice(0, 600)}` : ''))
  }
  for (const ek of evKeys) {
    if (v.evidence && v.evidence[ek] !== undefined) {
      console.log(`  evidence.${ek}: ${JSON.stringify(v.evidence[ek]).slice(0, 900)}`)
    }
  }
  if (v.error !== undefined) console.log(`  ERROR: ${String(v.error).slice(0, 900)}`)
}
