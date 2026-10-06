#!/usr/bin/env node
/**
 * fail-set-normalize — the Alpha.4 baseline fail-set normalizer (evidence-local).
 *
 * Input : one vitest `--reporter=json --outputFile=<x>.json` report of the ROOT
 *         suite (`vitest run` at the repo root; vitest.config.ts include is the
 *         per-package test glob under packages).
 * Output: the normalized failing-identity list, one identity per line, sorted:
 *
 *   TEST <relpath>::<vitest fullName>              one failed test
 *   FILE <relpath>::COLLECTION-OR-UNHANDLED        a file that failed to collect
 *                                                  (or carries a file-level /
 *                                                  unhandled error message)
 *
 * Rules (this script reproduces dev/agent-workflow/evidence/alpha4/baseline/
 * failing-identities-2b86ee42.txt byte-for-byte from root-vitest.json — that
 * check is the compatibility proof, see BASELINE.md "Normalizer compatibility"):
 *
 *   1. <relpath> = the JSON `name` (absolute path) with the repo-root prefix
 *      removed; separators are emitted as POSIX `/` so a report captured on
 *      Windows compares equal to one captured on Linux.
 *      Repo root = the explicit 2nd argument, else the current working
 *      directory when every `name` lives under it, else the longest common
 *      absolute prefix of the names.
 *   2. <vitest fullName> is copied VERBATIM from assertionResults[].fullName
 *      (= ancestorTitles joined by one space + ' ' + title). It is never
 *      re-derived, so a describe/test rename changes the identity.
 *   3. A file emits FILE when its file-level `message` is non-empty, or it has
 *      zero assertionResults while its status is not 'passed'. A file may emit
 *      BOTH a FILE line and TEST lines (unhandled error + named failures).
 *      A file whose tests all pass but which emitted a console error does NOT
 *      emit FILE (vitest leaves `message` empty in that case).
 *   4. Output = unique lines, byte-sorted over the whole line ('FILE ' < 'TEST ';
 *      digit titles sort lexicographically: "1." < "10." < "11b." < "2.").
 *   5. The report is the ONLY input: no re-run, no wall-clock, no counts in the
 *      identity file (counts go to the companion .summary.txt).
 *
 * Usage:
 *   node <this> <report.json> [repoRoot]            # print identities (+ per-file
 *                                                   # counts on stderr)
 *   node <this> <report.json> [repoRoot] --check <expected.txt>
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const argv = process.argv.slice(2)
const checkAt = argv.indexOf('--check')
const expectedFile = checkAt === -1 ? undefined : argv[checkAt + 1]
const positional = checkAt === -1 ? argv : argv.filter((a, i) => i < checkAt || i > checkAt + 1)
const [reportPath, repoRootArg] = positional
if (reportPath === undefined || (checkAt !== -1 && expectedFile === undefined)) {
  process.stderr.write(
    'usage: node fail-set-normalize.mjs <report.json> [repoRoot] [--check <expected.txt>]\n',
  )
  process.exit(2)
}

const report = JSON.parse(readFileSync(resolve(reportPath), 'utf8'))
const results = report['testResults'] ?? []
if (results.length === 0) throw new Error('no testResults in report')

const withSep = (p) => `${p.replace(/\\/g, '/').replace(/\/+$/, '')}/`
const names = results.map((r) => String(r['name'] ?? '').replace(/\\/g, '/'))

// Fallback root: longest common absolute prefix of the names, cut after a '/'.
const rootFromNames = (() => {
  let prefix = names[0] ?? ''
  for (const n of names) {
    while (!n.startsWith(prefix)) prefix = prefix.slice(0, prefix.length - 1)
  }
  const cut = prefix.slice(0, prefix.lastIndexOf('/') + 1)
  if (cut === '' || cut === '/') throw new Error('cannot derive repo root from report; pass repoRoot')
  return cut
})()
const cwdRoot = withSep(process.cwd())
const root =
  repoRootArg !== undefined ? withSep(resolve(repoRootArg)) : names.every((n) => n.startsWith(cwdRoot)) ? cwdRoot : rootFromNames

const identities = new Set()
const perFile = new Map()

for (const file of results) {
  const path = String(file['name'] ?? '').replace(/\\/g, '/').replace(root, '')
  let named = 0
  for (const a of file['assertionResults'] ?? []) {
    if (a['status'] === 'failed') {
      identities.add(`TEST ${path}::${a['fullName']}`)
      named += 1
    }
  }
  const message = typeof file['message'] === 'string' ? file['message'] : ''
  const noTestsButFailed = (file['assertionResults'] ?? []).length === 0 && file['status'] !== 'passed'
  const collection = message !== '' || noTestsButFailed
  if (collection) identities.add(`FILE ${path}::COLLECTION-OR-UNHANDLED`)
  if (named > 0 || collection) perFile.set(path, { named, collection })
}

const lines = [...identities].sort()
const stdout = `${lines.join('\n')}\n`

if (expectedFile !== undefined) {
  const expected = readFileSync(resolve(expectedFile), 'utf8')
  if (expected === stdout) {
    process.stdout.write(
      `MATCH: normalizer output is byte-identical to ${expectedFile} (${lines.length} identities)\n`,
    )
    process.exit(0)
  }
  const e = expected.split('\n').filter((l) => l !== '')
  const onlyExpected = e.filter((l) => !identities.has(l))
  const onlyActual = lines.filter((l) => !e.includes(l))
  process.stdout.write(
    `DIFF vs ${expectedFile}\n- expected ${e.length} identities, produced ${lines.length}\n` +
      `- only in expected (${onlyExpected.length}):\n${onlyExpected.map((l) => '  - ' + l).join('\n')}\n` +
      `- only in produced (${onlyActual.length}):\n${onlyActual.map((l) => '  + ' + l).join('\n')}\n`,
  )
  process.exit(1)
}

const summary = [...perFile.entries()]
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([path, v]) => `${String(v.named).padStart(3)}  ${v.collection ? 'COLLECTION-OR-UNHANDLED' : ''}  ${path}`)
process.stdout.write(stdout)
process.stderr.write(
  `# ${lines.length} identities = ${lines.filter((l) => l.startsWith('TEST ')).length} TEST + ${
    lines.filter((l) => l.startsWith('FILE ')).length
  } FILE over ${perFile.size} files\n${summary.join('\n')}\n`,
)
