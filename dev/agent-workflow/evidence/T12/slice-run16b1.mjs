// Slice the run16b1 (first stateprobe attempt) section out of the cumulative log
import { readFileSync, writeFileSync } from 'node:fs'
const EV = 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/T12'
const lines = readFileSync(`${EV}/t12v-run.log`, 'utf8').split('\n')
const start = lines.findIndex((l) => l.includes('mtkvb8scf3505a'))
if (start < 0) { console.error('FATAL: nonce not found'); process.exit(1) }
const end = lines.findIndex((l, i) => i > start && l.includes('runner done'))
if (end < 0) { console.error('FATAL: end not found'); process.exit(1) }
const section = lines.slice(start, end + 1)
writeFileSync(`${EV}/t12v-run16b1.log`, section.join('\n'), 'utf8')
console.log(`t12v-run16b1.log written (${section.length} lines, ${start + 1}..${end + 1})`)
