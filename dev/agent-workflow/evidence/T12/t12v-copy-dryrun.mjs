import { walk } from 'file:///D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/T12-V/tests/characterization/lib/util.mjs'
import { join, relative } from 'node:path'
import { existsSync } from 'node:fs'

const WORKTREE_ROOT = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/T12-V'
const distMirror = join(WORKTREE_ROOT, 'packages', 'runtime', 'dist', 'packages')
let count = 0
const hits = []
for (const entry of walk(distMirror)) {
  const file = entry.path
  if (!file.endsWith('.js')) continue
  count += 1
  const target = join(WORKTREE_ROOT, 'packages', relative(distMirror, file))
  const rel = relative(WORKTREE_ROOT, target).replace(/\\/g, '/')
  if (rel === 'packages/domain/blueprint/src/index.js') hits.push(`blueprint: target=${target} exists=${existsSync(target)}`)
  if (rel === 'packages/runtime/agent-setup/persona/index.js') hits.push(`persona: target=${target} exists=${existsSync(target)}`)
}
console.log('jsCount=' + count)
console.log(hits.join('\n') || 'no critical hits found')
