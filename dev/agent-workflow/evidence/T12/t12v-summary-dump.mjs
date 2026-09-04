// t12v-summary-dump.mjs — compact dump of scenario assertions + errors from summary.json
import fs from 'node:fs'

const p = process.argv[2] ?? 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/T12/summary.json'
const s = JSON.parse(fs.readFileSync(p, 'utf8'))
console.log('nonce:', s.nonce, '| generatedAt:', s.generatedAt)
console.log('modelPath.used:', s.modelPath?.used, '| fallbackUsed:', s.modelPath?.fallbackUsed)
if (s.testUsePristine) console.log('testUsePristine pre/post statusEmpty:', s.testUsePristine.pre?.statusEmpty, s.testUsePristine.post?.statusEmpty)
if (s.port3080) console.log('port3080 pre/post:', s.port3080.pre?.status, s.port3080.post?.status)
for (const [k, v] of Object.entries(s.scenarios ?? {})) {
  console.log(`==== ${k} pass=${v.pass} dur=${(v.durationMs / 1000).toFixed(1)}s`)
  for (const a of v.assertions ?? []) {
    const mark = a.ok ? 'OK  ' : 'FAIL'
    console.log(`  [${mark}] ${a.name}` + (a.detail !== undefined ? ` :: ${String(a.detail).slice(0, 500)}` : ''))
  }
  for (const n of v.notes ?? []) console.log(`  note: ${String(n).slice(0, 500)}`)
  if (v.error !== undefined) console.log(`  ERROR: ${String(v.error).slice(0, 800)}`)
}
const missing = ['V1', 'V2', 'V3', 'V4', 'V5', 'HANDOFF', 'LIFECYCLE', 'RESTART'].filter((k) => (s.scenarios ?? {})[k] === undefined)
console.log('missing scenarios:', missing.join(',') || '(none)')
