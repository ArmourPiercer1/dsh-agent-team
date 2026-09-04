import { readFileSync, writeFileSync } from 'node:fs'
const p = 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/T12/summary.json'
const j = JSON.parse(readFileSync(p, 'utf8'))
const lines = []
lines.push(`nonce=${j.nonce} generatedAt=${j.generatedAt} exitCode=${j.exitCode}`)
lines.push(`modelPath=${JSON.stringify(j.modelPath)} pristine=${j.testUsePristine} port3080=${JSON.stringify(j.port3080)} phaseFailures=${JSON.stringify(j.phaseFailures)}`)
const CANON = ['V1', 'V2', 'V3', 'V4', 'V5', 'HANDOFF', 'LIFECYCLE', 'RESTART']
let totPass = 0
let totFail = 0
let passScen = 0
for (const k of CANON) {
  const sc = j.scenarios[k]
  const as = sc.assertions || []
  const pass = as.filter(a => a.ok === true).length
  const fail = as.length - pass
  totPass += pass
  totFail += fail
  if (sc.pass === true) passScen++
  lines.push(`[${k}] pass=${sc.pass} dur=${sc.durationMs}ms a=${pass}/${as.length}`)
  for (const a of as) lines.push(`  ${a.ok === true ? 'PASS' : 'FAIL'}: ${a.name} :: ${a.detail}`)
}
lines.push(`TOTAL scenarios pass=${passScen}/8 assertions ${totPass}/${totPass + totFail}`)
writeFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/T12/t12v-run12-all.txt', lines.join('\n'), 'utf8')
const fails = lines.filter(l => l.includes('FAIL:'))
console.log(lines.slice(0, 12).join('\n'))
console.log('---- FAILS ----')
console.log(fails.join('\n'))
console.log(lines[lines.length - 1])
