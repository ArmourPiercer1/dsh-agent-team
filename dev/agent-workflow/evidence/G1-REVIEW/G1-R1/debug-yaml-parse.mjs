// G1-R1 debug: replicate scanner yaml C2 block parsing on the fixture file
import { readFileSync } from 'node:fs'
const p = 'D:\\AgentDev\\dsh-plugins\\dsh-agent-team\\.worktrees\\G1-R1\\scripts\\fixtures\\zero-core\\pnpm-workspace.yaml'
const lines = readFileSync(p, 'utf8').split('\n')
console.log('raw lines:')
lines.forEach((l, i) => console.log(i, JSON.stringify(l)))
let inBlock = false
for (const line of lines) {
  const header = /^patchedDependencies:\s*(#.*)?$/.test(line)
  if (header) { console.log('header match -> inBlock=true'); inBlock = true; continue }
  if (inBlock) {
    const m = line.match(/^\s{2,}([^:\s][^:]*):\s*(.*)$/)
    console.log('inBlock line', JSON.stringify(line), 'header-matched:', header, 'entry-match:', m && JSON.stringify(m[1]))
    if (m === null) { const nonWs = /^\S/.test(line); console.log('  -> m null; nonWs=', nonWs, ' inBlock stays', !nonWs); inBlock = nonWs ? false : inBlock; continue }
    console.log('  -> checkPatchKey target:', m[1].trim().replace(/^['"]|['"]$/g, ''))
  }
}
