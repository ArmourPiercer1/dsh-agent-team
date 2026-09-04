import { readFileSync } from 'node:fs'
const ev = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/PBF/dev/agent-workflow/evidence/plugin-bundle-form'
const r = JSON.parse(readFileSync(`${ev}/browser/gentry-report.json`, 'utf8'))
const rpcs = r.rpcs ?? []
console.log('rpcs:', rpcs.length)
for (const e of rpcs) {
  const s = JSON.stringify(e)
  if (/getProjection/i.test(s)) {
    console.log('=== entry ===')
    console.log(s.slice(0, 1500))
  }
}
