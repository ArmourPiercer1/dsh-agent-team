import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9'
const sh = (cmd) => execSync(cmd, { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString().split(/\r?\n/).filter(Boolean)

const isScannable = (f) => {
  if (!/\.ts$/.test(f) && !/\.mts$/.test(f) && !/\.mjs$/.test(f)) return false
  if (f === 'packages/testkit/fault-injection/session-event-scan.mjs') return false
  if (/^packages\/testkit\/test\/p4t6-.*\.test\.ts$/.test(f)) return false
  return true
}

// current tracked scannable set
const tracked = sh("git ls-files 'packages/'").filter(f => isScannable(f))
console.log('tracked scannable now: ' + tracked.length)

// added since pin commit
const added = sh('git diff --diff-filter=A --name-only 3839476..HEAD -- packages/').filter(isScannable)
const deleted = sh('git diff --diff-filter=D --name-only 3839476..HEAD -- packages/').filter(isScannable)
console.log('added since 3839476: ' + added.length)
for (const f of added.sort()) console.log('  + ' + f)
console.log('deleted since 3839476: ' + deleted.length)
for (const f of deleted.sort()) console.log('  - ' + f)
console.log('expected pin: ' + (601 + added.length - deleted.length))

// sanity: untracked scannable = the .d.ts burst
const untracked = sh('git status --porcelain -- packages/').filter(l => l.startsWith('?? ')).map(l => l.slice(3))
const untrackedScannable = untracked.filter(isScannable)
console.log('untracked scannable (burst): ' + untrackedScannable.length)
console.log('  sample: ' + untrackedScannable.slice(0, 3).join(' , '))
console.log('  includes legacy-vocabulary.d.ts? ' + untrackedScannable.includes('packages/contracts/src/legacy-vocabulary.d.ts'))
