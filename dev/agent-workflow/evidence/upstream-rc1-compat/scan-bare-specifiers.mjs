// Scratch: enumerate bare (non-relative, non-builtin) import specifiers in
// the instance-loaded surface of the RC1 worktree (R122 boot diagnosis).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const RC = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/RC1'
const roots = [
  RC + '/packages/runtime/dist',
  RC + '/packages/runtime/root-binding/harness',
  RC + '/packages/runtime/member-residency/harness',
  RC + '/packages/tools/harness',
]
const files = []
function walk(d) {
  let es
  try { es = readdirSync(d, { withFileTypes: true }) } catch { return }
  for (const e of es) {
    const p = join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(mjs|cjs|js)$/.test(e.name)) files.push(p)
  }
}
for (const r of roots) walk(r)
const bare = new Map()
const re = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g
for (const f of files) {
  const s = readFileSync(f, 'utf8')
  let m
  while ((m = re.exec(s)) !== null) {
    const sp = m[1]
    if (sp.startsWith('.') || sp.startsWith('node:') || sp.includes(':')) continue
    if (!bare.has(sp)) bare.set(sp, [])
    if (bare.get(sp).length < 3) bare.get(sp).push(f.replace(RC + '/', ''))
  }
}
console.log('files scanned: ' + files.length)
for (const [sp, sample] of [...bare.entries()].sort()) {
  console.log(sp + '   <- ' + sample[0])
}
