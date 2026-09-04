// Temp: replicate p4t6 scanner scope to compute the +162 delta breakdown
import { readdirSync, statSync } from 'node:fs'
import { join, dirname, relative, sep } from 'node:path'

const root = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9'
const pkgs = join(root, 'packages')
const selfPath = join(pkgs, 'testkit', 'fault-injection', 'session-event-scan.mjs')
const testkitTestDir = join(pkgs, 'testkit', 'test')

const files = []
function walk(dir) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.tmp-fault') continue
    const abs = join(dir, e.name)
    let isDir = e.isDirectory()
    if (e.isSymbolicLink()) { try { isDir = statSync(abs).isDirectory() } catch { continue } }
    if (isDir) { walk(abs); continue }
    const base = e.name
    if (!(base.endsWith('.ts') || base.endsWith('.mts') || base.endsWith('.mjs'))) continue
    if (abs === selfPath) continue
    if (dirname(abs) === testkitTestDir && /^p4t6-.*\.test\.ts$/.test(base)) continue
    files.push(relative(root, abs).split(sep).join('/'))
  }
}
walk(pkgs)
files.sort()
console.log('total scannable: ' + files.length)

const byPkg = {}
for (const f of files) {
  const top = f.split('/')[1]
  byPkg[top] = (byPkg[top] || 0) + 1
}
for (const [k, v] of Object.entries(byPkg).sort()) console.log('  ' + k + ': ' + v)

// client package detail: src vs test, by extension
const clientSrc = files.filter(f => f.startsWith('packages/client/src/'))
const clientTest = files.filter(f => f.startsWith('packages/client/test/'))
console.log('client src: ' + clientSrc.length + ' (ts ' + clientSrc.filter(f => f.endsWith('.ts')).length + ', d.ts ' + clientSrc.filter(f => f.endsWith('.d.ts')).length + ', tsx-excluded-by-scan ' + 0 + ')')
console.log('client test: ' + clientTest.length)
