#!/usr/bin/env node
// client-names.mjs <vitest.json> <out.txt>
// Emits one line per REGISTERED client leg: `<test file as loaded>::<describe > title>::<status>`.
// Written as a script (not an inline -e) so the before/after captures are reproducible verbatim.
// NOTE: client-lane legs are compared as TEST-NAME SETS. The repo's scripts/fail-set.mjs identity
// diff has no client mode (it keys on the root vitest project layout); this is the client analogue.
import { readFileSync, writeFileSync } from 'node:fs'

const [inPath, outPath] = process.argv.slice(2)
if (!inPath || !outPath) {
  console.error('usage: client-names.mjs <vitest.json> <out.txt>')
  process.exit(2)
}
const report = JSON.parse(readFileSync(inPath, 'utf8'))
const lines = []
const files = []
for (const suite of report.testResults ?? []) {
  const rel = suite.name.replace(/^.*\/packages\/client\//, '')
  files.push(rel)
  if ((suite.assertionResults ?? []).length === 0) {
    lines.push(`${rel}::COLLECTION-OR-UNHANDLED::${suite.status}`)
    continue
  }
  for (const a of suite.assertionResults) {
    const full = (a.ancestorTitles ?? []).concat(a.title).join(' > ')
    lines.push(`${rel}::${full}::${a.status}`)
  }
}
lines.sort()
writeFileSync(outPath, lines.join('\n') + '\n')
files.sort()
console.log(`files loaded: ${files.length}; legs: ${lines.length} -> ${outPath}`)
console.log(`failed files: ${files.filter((f, i) => lines.some((l) => l.startsWith(`${f}::`) && l.endsWith('::failed'))).length}`)
console.log(`failed legs : ${lines.filter((l) => l.endsWith('::failed')).length}`)
for (const l of lines.filter((l) => l.endsWith('::failed'))) console.log(`  FAILED ${l.replace(/::failed$/, '')}`)
