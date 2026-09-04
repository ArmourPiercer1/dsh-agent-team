// Temp: verify main-tree final audit covers all 47 legacy manifest paths
import { readFileSync } from 'node:fs'

const manifest = readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9/dev/agent-workflow/evidence/P9/legacy-ui-team-manifest-at-506191b.txt', 'utf8')
const audit = readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/P9/reuse-audit.md', 'utf8')

const paths = []
for (const line of manifest.split(/\r?\n/)) {
  const m = line.replace(/^\uFEFF/, '').match(/^\d+\s+\w+\s+[0-9a-f]{40}\s+\d+\t(.+)$/)
  if (m) paths.push(m[1].trim())
}
console.log('manifest paths: ' + paths.length)

const missing = []
for (const p of paths) {
  const base = p.split('/').pop()
  if (!audit.includes(base)) missing.push(p)
}
console.log('missing basenames in audit: ' + missing.length)
for (const p of missing) console.log('  MISSING: ' + p)

// also: count audit section A rows (lines starting with | and containing a .tsx/.ts/.css token)
const rows = audit.split(/\r?\n/).filter(l => /^\|/.test(l) && /\.(tsx?|css|json|ya?ml|mjs)$/.test(l))
console.log('audit table rows with file-like cells: ' + rows.length)

// verdict placeholder count
console.log('PENDING markers: ' + (audit.match(/PENDING/g) || []).length)
