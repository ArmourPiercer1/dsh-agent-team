// temp: parse eslint output -> per-rule counts + per-file counts (ASCII-safe)
import { readFileSync } from 'node:fs'
const log = readFileSync(
  'C:/Users/user/AppData/Local/Temp/dsh-subprocess-DyBvtA/dsh-subprocess-68144-40-2a0640add75d-stdout.log',
  'utf8',
)
const lines = log.split('\n')
const byRule = new Map()
const byFile = new Map()
let current = null
for (const line of lines) {
  const fileMatch = line.match(/^(D:[^\s].*?\.(?:ts|tsx|js|mjs|json))\s*$/)
  if (fileMatch) {
    current = fileMatch[1]
    byFile.set(current, 0)
    continue
  }
  const errMatch = line.match(/^\s*\d+:\d+\s+error\s+.*\s+(@?[\w-]+\/?[\w-]*)\s*$/)
  if (errMatch && current) {
    const rule = errMatch[1]
    byRule.set(rule, (byRule.get(rule) ?? 0) + 1)
    byFile.set(current, (byFile.get(current) ?? 0) + 1)
  }
}
console.log('== by rule ==')
for (const [rule, n] of [...byRule.entries()].sort((a, b) => b[1] - a[1])) console.log(`${n}\t${rule}`)
console.log('== files > 10 errors ==')
for (const [file, n] of [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60)) {
  if (n > 10) console.log(`${n}\t${file.replace('D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9/', '')}`)
}
console.log('== file count:', byFile.size)
console.log('== total errors:', [...byFile.values()].reduce((a, b) => a + b, 0))
