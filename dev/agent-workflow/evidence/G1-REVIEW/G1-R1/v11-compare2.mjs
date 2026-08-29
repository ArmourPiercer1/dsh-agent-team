// V11b-2: manifest vs downstream diff set comparison (file reads only, no child processes).
import { readFileSync, writeFileSync } from 'node:fs'

const manifestPath = 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/provenance/file-manifest.json'
const diffPath = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G1-R1/dev/g1-review/G1-R1/V11-c-downstream-name-status.txt'
const logPath = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G1-R1/dev/g1-review/G1-R1/V11-b-manifest-vs-diff.log'

const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
const out = []
out.push('=== V11b manifest vs downstream diff (cd5ef814..HEAD, -M) ===')
out.push(`date: ${new Date().toISOString()}`)
out.push('')
out.push(`manifest files: ${m.files.length}`)
out.push('')

// Parse actual diff (name-status, tab-separated; renames possible)
const diffLines = readFileSync(diffPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim() !== '')
const diffFiles = new Map()
for (const line of diffLines) {
  const parts = line.split('\t')
  const status = parts[0][0]
  if ((status === 'R' || status === 'C') && parts.length >= 3) {
    diffFiles.set(parts[parts.length - 1], status)
  } else {
    diffFiles.set(parts[1], status)
  }
}
out.push(`actual downstream diff files: ${diffFiles.size}`)
const diffStatus = new Map()
for (const s of diffFiles.values()) diffStatus.set(s, (diffStatus.get(s) || 0) + 1)
out.push(`diff status counts: ${JSON.stringify(Object.fromEntries([...diffStatus.entries()].sort()))}`)
out.push('')

const byClass = new Map()
for (const f of m.files) byClass.set(f.classification, (byClass.get(f.classification) || 0) + 1)
out.push(`manifest classification counts: ${JSON.stringify(Object.fromEntries([...byClass.entries()].sort()))}`)
out.push('')

const TEAM_LIKELY = new Set(['TEAM_OWNED', 'GENERATED_FROM_TEAM'])
const nonTeam = m.files.filter(f => !TEAM_LIKELY.has(f.classification))
const nonTeamPaths = new Set(nonTeam.map(f => f.path))
const teamPaths = new Set(m.files.filter(f => TEAM_LIKELY.has(f.classification)).map(f => f.path))

const missingFromDiff = [...nonTeamPaths].filter(p => !diffFiles.has(p))
const teamInDiff = [...diffFiles.keys()].filter(p => teamPaths.has(p))
const unexpected = [...diffFiles.keys()].filter(p => !nonTeamPaths.has(p) && !teamPaths.has(p))

out.push('--- CHECK 1: every manifest non-Team file present in downstream diff ---')
out.push(`non-Team manifest files: ${nonTeam.length}; missing from diff: ${missingFromDiff.length}`)
for (const p of missingFromDiff) out.push(`  MISSING: ${p}`)
out.push('')

out.push('--- CHECK 2: no TEAM_OWNED / GENERATED_FROM_TEAM file in downstream diff ---')
out.push(`Team-classified files appearing in diff: ${teamInDiff.length}`)
for (const p of teamInDiff) out.push(`  TEAM-IN-DIFF: ${p}`)
out.push('')

out.push('--- CHECK 3: diff files all classified in manifest, and non-Team ---')
out.push(`diff files not in manifest at all: ${unexpected.length}`)
for (const p of unexpected) out.push(`  NOT-IN-MANIFEST: ${p} (diff status: ${diffFiles.get(p)})`)
out.push('')

// Per-class presence
out.push('--- per-class presence in diff ---')
for (const cls of [...byClass.keys()].sort()) {
  const clsPaths = m.files.filter(f => f.classification === cls).map(f => f.path)
  const present = clsPaths.filter(p => diffFiles.has(p))
  out.push(`${cls}: manifest=${clsPaths.length} present-in-diff=${present.length}`)
  const miss = clsPaths.filter(p => !diffFiles.has(p))
  for (const p of miss) out.push(`    missing: ${p}`)
}
out.push('')

// Status agreement for present non-Team files (manifest status vs diff status)
let statusMismatch = 0
for (const f of nonTeam) {
  if (diffFiles.has(f.path) && diffFiles.get(f.path) !== f.status) {
    statusMismatch++
    out.push(`  STATUS-MISMATCH: ${f.path} manifest=${f.status} diff=${diffFiles.get(f.path)}`)
  }
}
out.push(`status mismatches (non-Team): ${statusMismatch}`)
out.push('')

const pass = missingFromDiff.length === 0 && teamInDiff.length === 0
out.push(pass
  ? 'RESULT: PASS (all non-Team manifest files present; zero Team-classified files in diff)'
  : 'RESULT: MISMATCH (see above)')

writeFileSync(logPath, out.join('\r\n'), { encoding: 'utf8' })
console.log(out.join('\n'))
process.exit(pass ? 0 : 1)
