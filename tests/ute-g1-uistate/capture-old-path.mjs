#!/usr/bin/env node
/**
 * capture-old-path.mjs — capture the old path and (optionally) re-baseline the
 * golden fixture.
 *
 * Default mode is a CHECK: capture, compare against the committed golden, print
 * one line per vector and exit non-zero on any drift. `--write` re-baselines the
 * fixture, and it is the ONLY way the golden changes — a capture that disagrees
 * with a committed row is a measured change to the old path, which must be
 * reviewed, not silently absorbed.
 *
 * Usage:
 *   node tests/ute-g1-uistate/capture-old-path.mjs            # check
 *   node tests/ute-g1-uistate/capture-old-path.mjs --write    # re-baseline
 *   node tests/ute-g1-uistate/capture-old-path.mjs --print    # check + print rows
 *
 * @module tests/ute-g1-uistate/capture-old-path
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { checkDesignClaim, compareAll, parseGolden, serializeGolden } from './lib/compare.mjs'
import { captureCorpus, OLD_PATH_IDENTITY } from './lib/old-path.mjs'
import { categoricalCoverage, observedCodes } from './lib/effect-oracle.mjs'
import { assertVocabularyTotal } from './lib/refusal-map.mjs'
import { REPO_ROOT } from './lib/paths.mjs'

const GOLDEN = join(REPO_ROOT, 'tests', 'ute-g1-uistate', 'golden', 'old-path.tsv')
const META = join(REPO_ROOT, 'tests', 'ute-g1-uistate', 'golden', 'old-path.meta.txt')
const args = new Set(process.argv.slice(2))

const records = await captureCorpus()
const codes = observedCodes(records)
const totals = assertVocabularyTotal(codes)
const coverage = categoricalCoverage(records)

for (const record of records) {
  console.log(`OLD-PATH-VECTOR ${record.id} entry=${record.entry} class=${record.klass} outcome=${record.outcome} refusal=${record.refusal === null ? '-' : record.refusal} code=${record.code}`)
  if (args.has('--print')) console.log(`OLD-PATH-EFFECTS ${record.id} ${record.effects} facts=${Object.keys(record.facts).sort().map((key) => `${key}=${String(record.facts[key])}`).join(',')}`)
  for (const note of record.notes) console.log(`OLD-PATH-NOTE ${record.id} ${note}`)
}
console.log(`OLD-PATH-CODES ${codes.join(',')}`)
console.log(`OLD-PATH-CATEGORIES reached=${coverage.reached.join('|')} excluded=${Object.keys(coverage.exclusions).join('|')}`)
for (const [category, reason] of Object.entries(coverage.exclusions)) console.log(`OLD-PATH-EXCLUDED category=${category} reason=${reason}`)
if (!totals.ok) {
  for (const problem of totals.problems) console.error(`OLD-PATH-VOCABULARY-FAIL ${problem}`)
  process.exitCode = 1
}
if (coverage.missing.length > 0 || coverage.undeclaredReached.length > 0) {
  console.error(`OLD-PATH-COVERAGE-FAIL missing=${coverage.missing.join(',')} undeclared=${coverage.undeclaredReached.join(',')}`)
  process.exitCode = 1
}

if (args.has('--write')) {
  writeFileSync(GOLDEN, serializeGolden(records), 'utf8')
  writeFileSync(META, [
    `OLD-PATH-META vectors=${String(records.length)} host=${OLD_PATH_IDENTITY.host}`,
    `OLD-PATH-META host-tree=${OLD_PATH_IDENTITY.hostTree} (read-only; gitignored)`,
    `OLD-PATH-META composition=${OLD_PATH_IDENTITY.composition}`,
    `OLD-PATH-META members=${OLD_PATH_IDENTITY.members.join(',')}`,
    `OLD-PATH-META columns=${'id entry family class outcome refusal code effects facts'}`,
    `OLD-PATH-META captured-by=tests/ute-g1-uistate/capture-old-path.mjs --write (a reviewable fixture, never a recording of whatever happened)`,
    '',
  ].join('\n'), 'utf8')
  console.log(`OLD-PATH-WRITTEN ${GOLDEN}`)
  console.log(`OLD-PATH-WRITTEN ${META}`)
} else {
  const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
  const comparison = compareAll(golden, records)
  for (const failure of comparison.failures) {
    console.error(`OLD-PATH-DIFF ${failure.id} ${failure.diffs.map((diff) => `${diff.field}: golden="${diff.expected}" observed="${diff.observed}"`).join(' | ')}`)
  }
  for (const id of comparison.missingObserved) console.error(`OLD-PATH-DIFF ${id} golden row has no observation`)
  for (const id of comparison.missingGolden) console.error(`OLD-PATH-DIFF ${id} observation has no golden row`)
  const claims = []
  for (const vector of (await import('./lib/corpus.mjs')).CORPUS) {
    const record = records.find((candidate) => candidate.id === vector.id)
    if (record === undefined) continue
    for (const problem of checkDesignClaim(vector, record)) claims.push(`${vector.id}: ${problem}`)
  }
  for (const problem of claims) console.error(`OLD-PATH-CLAIM-FAIL ${problem}`)
  const ok = comparison.failures.length === 0 && comparison.missingObserved.length === 0 && comparison.missingGolden.length === 0 && claims.length === 0
  console.log(`OLD-PATH-VERDICT ${ok ? 'GREEN' : 'RED'} vectors=${String(records.length)} drift=${String(comparison.failures.length)} claims=${String(claims.length)} host=${OLD_PATH_IDENTITY.host}`)
  if (!ok) process.exitCode = 1
}
