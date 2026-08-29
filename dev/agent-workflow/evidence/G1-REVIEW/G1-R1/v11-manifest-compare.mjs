// V11: provenance manifest analysis (read-only).
// Compares the manifest's per-file classification against the actual
// cd5ef814..HEAD diff of the downstream host tree.
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const manifestPath = 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/provenance/file-manifest.json'
const downstream = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P1-int-downstream'
const upstreamSha = 'cd5ef8148158c3a752a658978873241fdf8e2bbc'
const logPath = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G1-R1/dev/g1-review/G1-R1/V11-b-manifest-vs-diff.log'

const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
const out = []
out.push('=== V11b manifest structure + manifest-vs-downstream-diff comparison ===')
out.push(`date: ${new Date().toISOString()}`)
out.push('')

// 1. Baseline block
out.push('--- manifest.baseline ---')
out.push(`upstream_sha: ${m.baseline.upstream_sha}`)
out.push(`upstream_ref: ${m.baseline.upstream_ref}`)
out.push(`legacy_sha: ${m.baseline.legacy_sha}`)
out.push(`file_count: ${m.baseline.file_count}`)
out.push(`status_counts: ${JSON.stringify(m.baseline.status_counts)}`)
out.push(`line_counts: ${JSON.stringify(m.baseline.line_counts)}`)
out.push(`classification_enum: ${JSON.stringify(m.baseline.classification_enum)}`)
out.push('')

// 2. Top-level keys
out.push(`top-level keys: ${JSON.stringify(Object.keys(m))}`)
const files = m.files
out.push(`files array length: ${files.length}`)
out.push(`sample entry keys: ${JSON.stringify(Object.keys(files[0]))}`)
out.push('')

// 3. Classification counts
const byClass = new Map()
for (const f of files) {
  const c = f.classification
  byClass.set(c, (byClass.get(c) || 0) + 1)
}
out.push('--- manifest classification counts ---')
for (const [c, n] of [...byClass.entries()].sort()) out.push(`  ${c}: ${n}`)
out.push('')

// 4. Per-classification status + line stats if present
const classStats = new Map()
for (const f of files) {
  const key = `${f.classification}|${f.status}`
  classStats.set(key, (classStats.get(key) || 0) + 1)
}
out.push('--- classification|status counts ---')
for (const [k, n] of [...classStats.entries()].sort()) out.push(`  ${k}: ${n}`)
out.push('')

// 5. Extra manifest fields we care about (notes, hunks, lane)
const extraKeys = new Set()
for (const f of files) for (const k of Object.keys(f)) extraKeys.add(k)
out.push(`all entry keys: ${JSON.stringify([...extraKeys])}`)
out.push('')

// 6. Actual downstream diff (name-status, rename detection)
let diffOut
try {
  diffOut = execFileSync('git', ['-C', downstream, 'diff', '--name-status', '-M', `${upstreamSha}..HEAD`], { encoding: 'utf8' })
} catch (e) {
  out.push('GIT DIFF FAILED: ' + (e.message || e))
  writeFileSync(logPath, out.join('\r\n'), { encoding: 'utf8' })
  process.exit(2)
}
const diffLines = diffOut.trim().split('\n')
const diffFiles = new Map() // path -> status (for renames use new path)
for (const line of diffLines) {
  const parts = line.split('\t')
  const status = parts[0][0] // M/A/D/R/C
  if (status === 'R' || status === 'C') {
    diffFiles.set(parts[parts.length - 1], status)
  } else {
    diffFiles.set(parts[1], status)
  }
}
out.push('--- actual downstream diff (cd5ef814..HEAD) ---')
out.push(`diff file count: ${diffFiles.size}`)
const diffStatus = new Map()
for (const s of diffFiles.values()) diffStatus.set(s, (diffStatus.get(s) || 0) + 1)
out.push(`diff status counts: ${JSON.stringify(Object.fromEntries([...diffStatus.entries()].sort()))}`)
out.push('')

// 7. Set comparison
const TEAM_LIKELY = new Set(['TEAM_OWNED', 'GENERATED_FROM_TEAM'])
const NON_TEAM = files.filter(f => !TEAM_LIKELY.has(f.classification))
const NON_TEAM_PATHS = new Set(NON_TEAM.map(f => f.path))
const manifestPaths = new Set(files.map(f => f.path))

const missingFromDiff = [...NON_TEAM_PATHS].filter(p => !diffFiles.has(p))
const inDiffButNotNonTeam = [...diffFiles.keys()].filter(p => !NON_TEAM_PATHS.has(p))
  .map(p => ({ path: p, inManifest: manifestPaths.has(p), class: manifestPaths.has(p) ? files.find(f => f.path === p)?.classification : null }))

out.push('--- set comparison ---')
out.push(`manifest non-Team files (GENERIC_FORK_CAPABILITY + UNRELATED_FORK_FEATURE + other non-Team): ${NON_TEAM.length}`)
out.push(`non-Team manifest files MISSING from downstream diff: ${missingFromDiff.length}`)
for (const p of missingFromDiff.slice(0, 50)) out.push(`  MISSING: ${p}`)
out.push(`downstream-diff files NOT in manifest non-Team set: ${inDiffButNotNonTeam.length}`)
for (const e of inDiffButNotNonTeam.slice(0, 50)) out.push(`  UNEXPECTED: ${e.path} (inManifest=${e.inManifest}, class=${e.class})`)
out.push('')

// 8. Per-class presence summary in diff
for (const cls of [...byClass.keys()].sort()) {
  const clsPaths = files.filter(f => f.classification === cls).map(f => f.path)
  const present = clsPaths.filter(p => diffFiles.has(p)).length
  out.push(`class ${cls}: manifest=${clsPaths.length}, present-in-diff=${present}`)
}
out.push('')

const verdict = missingFromDiff.length === 0 && inDiffButNotNonTeam.length === 0
out.push(verdict
  ? 'RESULT: PASS downstream diff == manifest non-Team file set (exact match)'
  : 'RESULT: MISMATCH (see lists above)')

writeFileSync(logPath, out.join('\r\n'), { encoding: 'utf8' })
console.log(out.join('\n').slice(0, 3000))
console.log(`\n[written: ${logPath}]`)
process.exit(verdict ? 0 : 1)
