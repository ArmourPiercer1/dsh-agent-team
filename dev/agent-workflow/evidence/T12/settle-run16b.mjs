// run16b (corrected attempt) settlement: rename dumps + slice log
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
const EV = 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/T12'

const renames = [
  ['summary.json', 't12v-summary-run16b.json'],
  ['t12v-mock-capture.json', 't12v-mock-capture-run16b.json'],
  ['t12v-port3080-pre.txt', 't12v-port3080-pre-run16b.txt'],
  ['t12v-port3080-post.txt', 't12v-port3080-post-run16b.txt'],
]
for (const [from, to] of renames) {
  if (existsSync(`${EV}/${from}`)) { renameSync(`${EV}/${from}`, `${EV}/${to}`); console.log(`renamed ${from} -> ${to}`) }
  else console.log(`WARN: ${from} not present (skipped)`)
}

const lines = readFileSync(`${EV}/t12v-run.log`, 'utf8').split('\n')
const start = lines.findIndex((l) => l.includes('mtkvds5d91659e'))
if (start < 0) { console.error('FATAL: nonce not found'); process.exit(1) }
const end = lines.findIndex((l, i) => i > start && l.includes('runner done'))
const section = lines.slice(start, end + 1)
writeFileSync(`${EV}/t12v-run16b.log`, section.join('\n'), 'utf8')
console.log(`t12v-run16b.log written (${section.length} lines)`)
