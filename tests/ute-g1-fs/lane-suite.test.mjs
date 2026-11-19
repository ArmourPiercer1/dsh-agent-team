/**
 * ute-g1-fs.test.mjs — the G1-FS prototype's lane test.
 *
 * Two cases, both lane-run (no boot, no ports, no DSH_HOME):
 *   1. the prototype on the pinned next host reproduces the old-path golden
 *      corpus cell-for-cell (the comparison harness bites; see NC-2);
 *   2. the four negative controls (lane bites, harness bites, no fallback,
 *      lane is load-bearing) hold.
 *
 * HOST-REQUIRED, FAIL-LOUD: the next-host tree is provisioned by a documented
 * command (docs/TEST_METHODS.md §11) and is gitignored; a run without it is a
 * RED run, not a skip (`loadHostSurface` -> `assertNextHostTree` throws).
 *
 * @module tests/ute-g1-fs/lane-suite
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { compareAll, parseGolden } from './lib/compare.mjs'
import { CORPUS } from './lib/corpus.mjs'
import { loadHostSurface } from './lib/host.mjs'
import { runCorpus } from './lib/new-path.mjs'
import { runNegativeControls } from './negative-controls.mjs'
import { SEMANTIC_DIFF_LINE_RE, SEMANTIC_DIFFERENCES, semanticDifferenceLines } from './lib/semantic-differences.mjs'

const GOLDEN = join(process.cwd(), 'tests', 'ute-g1-fs', 'golden', 'old-path.tsv')

test('the prototype reproduces the old-path golden corpus', async () => {
  const host = await loadHostSurface()
  const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
  const { records } = await runCorpus()
  assert.equal(golden.length, CORPUS.length, 'the golden fixture must cover every corpus vector')
  const { verdicts, failures, missingGolden, missingObserved } = compareAll(golden, records)
  for (const failure of failures) {
    console.log(`UTE-G1-FS-DIFF ${failure.id} ${failure.diffs.map((diff) => `${diff.field}: old="${diff.expected}" new="${diff.observed}"`).join(' | ')}`)
  }
  assert.deepEqual(missingGolden, [], 'the corpus must not add vectors without a captured old-path record')
  assert.deepEqual(missingObserved, [], 'every golden vector must run on the prototype')
  assert.equal(verdicts.length, CORPUS.length)
  assert.deepEqual(failures, [], `${failures.length} of ${verdicts.length} vectors diverged from the old path`)
  console.log(`UTE-G1-FS-VERDICT GREEN vectors=${verdicts.length} host=${host.host.head}`)
})

test('every known semantic difference is declared and printable', () => {
  const lines = semanticDifferenceLines()
  assert.equal(lines.length, SEMANTIC_DIFFERENCES.length)
  assert.ok(lines.length > 0, 'an empty semantic-difference list is a claim of equivalence; delete it deliberately, not silently')
  for (const line of lines) {
    console.log(`UTE-G1-FS-${line}`)
    assert.match(line, SEMANTIC_DIFF_LINE_RE)
  }
  const blocking = SEMANTIC_DIFFERENCES.filter((difference) => difference.blocking)
  assert.ok(blocking.length > 0, 'at least the refusal-code difference must block a silent retirement')
  assert.ok(blocking.some((difference) => difference.klass === 'refusal-code'), 'the lane refusal-code difference must be recorded')
})

test('the four negative controls hold', async () => {
  const results = await runNegativeControls()
  for (const result of results) console.log(`UTE-G1-FS-NC ${result.id} ${result.ok ? 'ok' : 'FAIL'} ${result.detail}`)
  assert.deepEqual(results.filter((result) => !result.ok), [], 'every negative control must hold')
})
