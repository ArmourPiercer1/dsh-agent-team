import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const root = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9'
const untracked = execSync('git -C "' + root + '" status --porcelain -- packages/', { maxBuffer: 64 * 1024 * 1024 })
  .toString().split(/\r?\n/).filter(l => l.startsWith('?? ')).map(l => l.slice(3))

// files NOT at the 04:47:00Z burst
const late = untracked.filter(rel => statSync(join(root, rel)).mtime.toISOString().slice(11, 19) !== '04:47:00')
console.log('late files (post-burst):')
for (const rel of late.sort()) {
  console.log('  ' + statSync(join(root, rel)).mtime.toISOString().slice(11, 19) + '  ' + rel)
}

// burst files: full top-3 dir histogram
const dirs = {}
for (const rel of untracked) {
  if (statSync(join(root, rel)).mtime.toISOString().slice(11, 19) === '04:47:00') {
    const parts = rel.split('/')
    const key = parts.slice(0, 3).join('/')
    dirs[key] = (dirs[key] || 0) + 1
  }
}
console.log('\nburst dir histogram (all):')
for (const [k, v] of Object.entries(dirs).sort((a, b) => b[1] - a[1])) console.log('  ' + v + '  ' + k)

// extension mix in burst
const ext = {}
for (const rel of untracked) {
  const e = rel.slice(rel.lastIndexOf('.'))
  ext[e] = (ext[e] || 0) + 1
}
console.log('\nextension mix (all untracked): ' + JSON.stringify(ext))
