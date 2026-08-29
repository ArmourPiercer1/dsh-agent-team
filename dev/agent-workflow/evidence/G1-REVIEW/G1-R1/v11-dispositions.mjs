// V11: manifest disposition analysis (read-only, no child processes).
import { readFileSync, writeFileSync } from 'node:fs'

const manifestPath = 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/provenance/file-manifest.json'
const logPath = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G1-R1/dev/g1-review/G1-R1/V11-a-manifest-dispositions.log'
const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
const out = []
out.push('=== V11a manifest dispositions (read-only) ===')
out.push(`date: ${new Date().toISOString()}`)
out.push('')

const byDisp = new Map()
for (const f of m.files) {
  const key = `${f.classification} | ${f.disposition}`
  byDisp.set(key, (byDisp.get(key) || 0) + 1)
}
out.push('--- classification | disposition counts ---')
for (const [k, n] of [...byDisp.entries()].sort()) out.push(`  ${k}: ${n}`)
out.push('')

for (const cls of ['GENERIC_FORK_CAPABILITY', 'UNRELATED_FORK_FEATURE', 'MIXED']) {
  out.push(`--- ${cls} file list (path | status | disposition) ---`)
  for (const f of m.files.filter(f => f.classification === cls)) {
    out.push(`  ${f.status} | ${f.path} | ${f.disposition}`)
    if (cls === 'MIXED') {
      out.push(`      reason: ${f.reason}`)
      for (const h of (f.mixed_hunks || [])) out.push(`      mixed_hunk: ${JSON.stringify(h)}`)
    }
  }
  out.push('')
}

// UNRELATED_FORK_FEATURE reasons
out.push('--- UNRELATED_FORK_FEATURE reasons ---')
for (const f of m.files.filter(f => f.classification === 'UNRELATED_FORK_FEATURE')) {
  out.push(`  ${f.path}: ${f.reason}`)
}
out.push('')

// disposition semantics for the big classes (sample)
for (const cls of ['TEAM_OWNED', 'GENERATED_FROM_TEAM']) {
  const rs = new Map()
  for (const f of m.files.filter(f => f.classification === cls)) {
    const r = `${f.disposition}`
    rs.set(r, (rs.get(r) || 0) + 1)
  }
  out.push(`--- ${cls} disposition distribution ---`)
  for (const [k, n] of [...rs.entries()].sort()) out.push(`  ${k}: ${n}`)
  out.push('')
}

writeFileSync(logPath, out.join('\r\n'), { encoding: 'utf8' })
console.log(out.join('\n'))
