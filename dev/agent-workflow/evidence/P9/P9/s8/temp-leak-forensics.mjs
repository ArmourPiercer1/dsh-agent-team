// Temp: mtime histogram of untracked build artifacts + per-pkg tsconfig.json noEmit
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const root = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9'
const untracked = execSync('git -C "' + root + '" status --porcelain -- packages/', { maxBuffer: 64 * 1024 * 1024 })
  .toString().split(/\r?\n/)
  .filter(l => l.startsWith('?? '))
  .map(l => l.slice(3))

const byTime = {}
for (const rel of untracked) {
  const st = statSync(join(root, rel))
  const t = st.mtime.toISOString().slice(11, 19)
  byTime[t] = (byTime[t] || 0) + 1
}
console.log('untracked under packages/: ' + untracked.length)
for (const [t, n] of Object.entries(byTime).sort()) console.log('  ' + t + '  x' + n)

for (const p of ['contracts','domain','storage','runtime','tools','remote','client','testkit']) {
  const raw = readFileSync(join(root, 'packages', p, 'tsconfig.json'), 'utf8')
  const noEmit = /"noEmit"\s*:\s*true/.test(raw)
  const outDir = raw.match(/"outDir"\s*:\s*"([^"]+)"/)
  const inc = (raw.match(/"include"\s*:\s*\[[\s\S]*?\]/) || ['?'])[0].replace(/\s+/g, ' ')
  console.log(p + ': noEmit=' + noEmit + ' outDir=' + (outDir ? outDir[1] : '-') + ' include=' + inc.slice(0, 120))
}
