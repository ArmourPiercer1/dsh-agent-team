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
import { REFUSAL } from './lib/lane.mjs'
import { runNegativeControls } from './negative-controls.mjs'
import { SEMANTIC_DIFF_LINE_RE, SEMANTIC_DIFFERENCES, semanticDifferenceLines } from './lib/semantic-differences.mjs'

const GOLDEN = join(process.cwd(), 'tests', 'ute-g1-fs', 'golden', 'old-path.tsv')

test('the prototype reproduces the old-path golden corpus', async () => {
  const host = await loadHostSurface()
  const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
  assert.equal(golden.length, CORPUS.length, 'the golden fixture must cover every corpus vector')
  // UTE-3 PR B1 adds `read_image` baselines; the prototype's image support is
  // PR B2's scope. The pending set is DECLARED and printed — never a silent
  // skip, and it may not widen to another member.
  const runnable = CORPUS.filter((vector) => vector.newPathPending !== true)
  const pending = CORPUS.filter((vector) => vector.newPathPending === true)
  assert.deepEqual(
    pending.map((vector) => vector.entry),
    pending.map(() => 'read_image'),
    'only the read_image member may be new-path-pending in B1',
  )
  for (const vector of pending) {
    assert.match(vector.id, /^FS-I/, `a pending vector must be named as an image vector (got ${vector.id})`)
  }
  const runnableIds = new Set(runnable.map((vector) => vector.id))
  const goldenRunnable = golden.filter((row) => runnableIds.has(row.id))
  const { records } = await runCorpus()
  console.log(`UTE-G1-FS-NEW-PATH-PENDING ids=${pending.map((vector) => vector.id).join(',') || 'none'} reason=prototype-image-support-lands-in-B2`)
  const { verdicts, failures, missingGolden, missingObserved } = compareAll(goldenRunnable, records)
  for (const failure of failures) {
    console.log(`UTE-G1-FS-DIFF ${failure.id} ${failure.diffs.map((diff) => `${diff.field}: old="${diff.expected}" new="${diff.observed}"`).join(' | ')}`)
  }
  assert.deepEqual(missingGolden, [], 'the corpus must not add vectors without a captured old-path record')
  assert.deepEqual(missingObserved, [], 'every non-pending golden vector must run on the prototype')
  assert.equal(verdicts.length, runnable.length)
  assert.deepEqual(failures, [], `${failures.length} of ${verdicts.length} vectors diverged from the old path`)
  console.log(`UTE-G1-FS-VERDICT GREEN vectors=${verdicts.length} pending=${pending.length} host=${host.host.head}`)
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

test('no golden refusal is the unclassified bucket', () => {
  const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
  // The TSV uses the collapsed `lane-deny` (both lane axes), not the internal
  // read/write split, so that class is part of the serialized vocabulary.
  const known = new Set([...Object.values(REFUSAL), 'lane-deny'])
  for (const row of golden) {
    if (row.refusal === null) continue
    assert.ok(known.has(row.refusal), `${row.id}: refusal class ${JSON.stringify(row.refusal)} is outside the closed vocabulary`)
    if (row.refusal === REFUSAL.OTHER) {
      // `other` is the honest terminal bucket, never a silent one: if a corpus
      // vector ever needed it, the row must at least carry an observed signal.
      if (row.codes.length === 0) assert.fail(`${row.id}: refusal=other with an empty codes cell is a black box`)
    }
  }
  // B1 closes the four image causes (route-unresolved / missing-path /
  // image-modality-denied / cancelled). Nothing in the corpus may rest in
  // `other`; a new vector that does must be given a real class first.
  assert.deepEqual(golden.filter((row) => row.refusal === REFUSAL.OTHER).map((row) => row.id), [], 'no corpus vector may rest in the unclassified bucket')
  console.log(`UTE-G1-FS-REFUSAL-CLASSES ${[...new Set(golden.map((row) => row.refusal).filter(Boolean))].sort().join(',')}`)
})

test('the family-level and per-member negative controls hold', async () => {
  const results = await runNegativeControls()
  for (const result of results) console.log(`UTE-G1-FS-NC ${result.id} ${result.ok ? 'ok' : 'FAIL'} ${result.detail}`)
  assert.deepEqual(results.filter((result) => !result.ok), [], 'every negative control must hold')
})
