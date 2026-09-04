// Temp: delete exactly the untracked burst artifacts under packages/
import { execSync } from 'node:child_process'
import { unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9'
const files = execSync('git -C "' + root + '" status --porcelain -- packages/', { maxBuffer: 64 * 1024 * 1024 })
  .toString().split(/\r?\n/).filter(l => l.startsWith('?? ')).map(l => l.slice(3))

let deleted = 0
for (const rel of files) {
  const abs = join(root, rel)
  if (existsSync(abs)) { unlinkSync(abs); deleted++ }
}
console.log('deleted: ' + deleted + ' of ' + files.length)

// verify
const left = execSync('git -C "' + root + '" status --porcelain -- packages/', { maxBuffer: 64 * 1024 * 1024 })
  .toString().split(/\r?\n/).filter(l => l.startsWith('?? '))
console.log('remaining untracked under packages/: ' + left.length)
for (const l of left.slice(0, 5)) console.log('  ' + l)
