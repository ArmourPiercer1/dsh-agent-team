#!/usr/bin/env node
// Registered-universe extractor for the collection-errors lane's ONE census.
//
// `scripts/fail-set.mjs` reduces a vitest JSON report to the FAILING identities. The
// question this lane has to answer is different and complementary: which legs are
// REGISTERED AT ALL — because a file that dies at collection contributes no identity
// to either set, which is exactly how 32 legs went missing from a "6288" universe.
// So this script emits the full registered-leg identity set, with the same identity
// grammar `fail-set.mjs` uses (repo-relative path + verbatim `fullName`, worktree
// prefix stripped), plus one line per file that registered zero legs.
//
// Identity grammar (sorted, deduplicated, LF-terminated):
//   TEST <repo-relative/path>::<full test name>       a leg that REGISTERED (any status)
//   FILE <repo-relative/path>::COLLECTION-OR-UNHANDLED  a file that registered no leg
//
// Usage: node leg-set.mjs <vitest-json> <out-legs> <out-roots-summary>
//
// Everything is BY NAME. Counts appear only in the summary file, and only as a
// derived reading of the identity sets, never as the comparison itself.

import { readFileSync, writeFileSync } from 'node:fs';

const [jsonPath, legsOut, rootsOut] = process.argv.slice(2)
if (!jsonPath || !legsOut || !rootsOut) {
  console.error('usage: leg-set.mjs <vitest-json> <out-legs> <out-roots-summary>')
  process.exit(2)
}

const ROOTS = ['contracts', 'domain', 'legacy', 'remote', 'runtime', 'storage', 'testkit', 'tools', 'client']

function normalizePath(raw) {
  let p = String(raw ?? '').replaceAll('\\', '/').trim()
  const cut = p.lastIndexOf('dsh-agent-team/')
  if (cut >= 0) p = p.slice(cut + 'dsh-agent-team/'.length)
  p = p.replace(/^\.worktrees\/[^/]+\//, '')
  return p.replace(/^\.\//, '')
}

const normalizeName = (raw) => String(raw ?? '').trim()

const report = JSON.parse(readFileSync(jsonPath, 'utf8'))
const files = Array.isArray(report?.testResults) ? report.testResults : []
const ids = new Set()
const perRoot = new Map(ROOTS.map((r) => [r, { files: 0, legs: 0, zeroLegFiles: [] }]))
const unattributed = { files: 0, legs: 0, zeroLegFiles: [] }
const zeroLegFiles = []

for (const file of files) {
  const rel = normalizePath(file?.name)
  const legs = Array.isArray(file?.assertionResults) ? file.assertionResults : []
  const rootMatch = /^packages\/([^/]+)\/test\//.exec(rel)
  const bucket = rootMatch && ROOTS.includes(rootMatch[1]) ? perRoot.get(rootMatch[1]) : unattributed
  bucket.files += 1
  bucket.legs += legs.length
  if (legs.length === 0) {
    ids.add(`FILE ${rel}::COLLECTION-OR-UNHANDLED`)
    bucket.zeroLegFiles.push(rel)
    zeroLegFiles.push(rel)
    continue
  }
  for (const a of legs) {
    const name = normalizeName(a?.fullName) || [...(a?.ancestorTitles ?? []), a?.title].filter(Boolean).join(' ')
    if (!name) continue
    ids.add(`TEST ${rel}::${name}`)
  }
}

const sorted = [...ids].sort()
writeFileSync(legsOut, sorted.join('\n') + (sorted.length ? '\n' : ''), 'utf8')

const lines = []
lines.push(`capturedAt=${new Date().toISOString()}`)
lines.push(`vitestDurationMs=${report?.duration ?? ''}`)
lines.push(`files=${files.length} registeredLegIdentities=${sorted.length - countPrefixed(sorted, 'FILE ')} zeroLegFiles=${zeroLegFiles.length}`)
for (const root of ROOTS) {
  const b = perRoot.get(root)
  lines.push(`root ${root}: files=${b.files} legs=${b.legs} zeroLegFiles=${b.zeroLegFiles.length}`)
  for (const f of b.zeroLegFiles) lines.push(`  ZERO-LEG FILE ${f}`)
}
if (unattributed.files > 0) {
  lines.push(`root UNATTRIBUTED (outside packages/*/test): files=${unattributed.files} legs=${unattributed.legs}`)
  for (const f of unattributed.zeroLegFiles) lines.push(`  ZERO-LEG FILE ${f}`)
}
writeFileSync(rootsOut, lines.join('\n') + '\n', 'utf8')
console.log(lines.join('\n'))

function countPrefixed(sortedLines, prefix) {
  return sortedLines.filter((l) => l.startsWith(prefix)).length
}
