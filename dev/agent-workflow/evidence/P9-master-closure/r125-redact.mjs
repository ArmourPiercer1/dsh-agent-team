import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
const ROOTS = [
  'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9-MC/dev/agent-workflow/evidence/P9-master-closure',
  'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9-MC/dev/agent-workflow/evidence/P9',
  'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9-MC/dev/agent-workflow/evidence/T12',
  'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9-MC/dev/agent-workflow/evidence/upstream-rc1-compat',
]
const TEXT_EXT = new Set(['.md','.mjs','.js','.ts','.json','.log','.txt','.html','.yaml','.yml','.csv','.tsv'])
const PATTERNS = [
  [/\?token=[A-Za-z0-9_-]{12,}/g, '?token=<REDACTED>'],
  [/([?"'\s])(launchToken|bootToken|authToken|token|tokenValue)\1\s*[:=]\s*[A-Za-z0-9_-]{12,}/g, (m, q) => m.replace(/[A-Za-z0-9_-]{12,}$/, '<REDACTED>')],
  [/dsh-auth-[A-Za-z0-9._-]{8,}/g, 'dsh-auth-<REDACTED>'],
  [/\bsk-[A-Za-z0-9_-]{12,}\b/g, 'sk-<REDACTED>'],
  [/<REDACTED>/g, '<REDACTED>'],
  [/<REDACTED>/g, '<REDACTED>'],
]
let totalFiles = 0, totalRed = 0
const touched = []
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist') continue
    const p = join(dir, e.name)
    if (e.isDirectory()) { walk(p); continue }
    if (!TEXT_EXT.has(extname(e.name))) continue
    const st = statSync(p)
    if (st.size > 8 * 1024 * 1024) continue
    let t
    try { t = readFileSync(p, 'utf8') } catch { continue }
    let n = 0
    for (const [re, rep] of PATTERNS) {
      t = t.replace(re, (m, ...args) => { n++; return typeof rep === 'function' ? rep(m, ...args) : rep })
    }
    totalFiles++
    if (n > 0) {
      totalRed += n
      writeFileSync(p, t, 'utf8')
      touched.push(`${p.replace(ROOTS[0].replace(/\/.worktrees\/P9-MC/, ''), '')} (${n})`)
    }
  }
}
for (const r of ROOTS) walk(r)
console.log(`scanned ${totalFiles} text files, ${totalRed} redactions in ${touched.length} files`)
for (const f of touched.slice(0, 60)) console.log('  ' + f)
