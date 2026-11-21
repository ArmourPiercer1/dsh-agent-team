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
import { execFileSync } from 'node:child_process'
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

const ROOT = process.cwd()
const GOLDEN = join(ROOT, 'tests', 'ute-g1-fs', 'golden', 'old-path.tsv')
const META = join(ROOT, 'tests', 'ute-g1-fs', 'golden', 'old-path.meta.txt')
const NC_TRANSCRIPT = join(ROOT, 'dev', 'agent-workflow', 'evidence', 'ute-g1-fs-20261121', 'negative-controls.txt')

test('the prototype reproduces the old-path golden corpus', async () => {
  const host = await loadHostSurface()
  const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
  assert.equal(golden.length, CORPUS.length, 'the golden fixture must cover every corpus vector')
  // PR B2 removes the declared-pending channel ENTIRELY. A vector carrying
  // `newPathPending` is a declared non-coverage, so its PRESENCE is a failure —
  // a future suite cannot park a vector as pending again without going red.
  assert.deepEqual(
    CORPUS.filter((vector) => Object.hasOwn(vector, 'newPathPending')).map((vector) => vector.id),
    [],
    'newPathPending must not exist anywhere: every corpus vector must be reproduced',
  )
  const { records } = await runCorpus()
  assert.equal(records.length, CORPUS.length, 'every corpus vector must run on the new path')
  const { verdicts, failures, missingGolden, missingObserved } = compareAll(golden, records)
  for (const failure of failures) {
    console.log(`UTE-G1-FS-DIFF ${failure.id} ${failure.diffs.map((diff) => `${diff.field}: old="${diff.expected}" new="${diff.observed}"`).join(' | ')}`)
  }
  for (const verdict of verdicts.filter((candidate) => candidate.ok)) {
    console.log(`NEW-PATH-VECTOR ${verdict.id} PASS`)
  }
  assert.deepEqual(missingGolden, [], 'the corpus must not add vectors without a captured old-path record')
  assert.deepEqual(missingObserved, [], 'every golden vector must run on the prototype')
  assert.equal(verdicts.length, CORPUS.length)
  assert.deepEqual(failures, [], `${failures.length} of ${verdicts.length} vectors diverged from the old path`)
  console.log(`UTE-G1-FS-VERDICT GREEN vectors=${verdicts.length} pending=0 host=${host.host.head}`)
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


test('the golden meta records the measured new-path truth, not the stale pending note', () => {
  const meta = readFileSync(META, 'utf8')
  assert.equal(meta.includes('`newPathPending: true`'), false, 'the meta must not still claim every FS-I row is newPathPending')
  assert.equal(/the new-path run cannot reproduce these baselines/u.test(meta), false, 'the meta must not still say the new path cannot reproduce the image baselines')
  assert.match(meta, /read_image` on the NEW path — NOW REPRODUCED/u)
  assert.match(meta, /PROTOTYPE-VERDICT GREEN vectors=16 failed=0/u)
  console.log('UTE-G1-FS-META newPathPending=absent image-vectors=reproduced')
})

test('the family-level and per-member negative controls hold, with an exact transcript', async () => {
  const results = await runNegativeControls()
  for (const result of results) console.log(`UTE-G1-FS-NC ${result.id} ${result.ok ? 'ok' : 'FAIL'} ${result.detail}`)
  assert.deepEqual(results.filter((result) => !result.ok), [], 'every negative control must hold')
  assert.equal(results.length, 13, 'the battery has THIRTEEN controls; a shrunk battery must red, not silently lower the count')
  for (const id of ['NC-MEMBER read', 'NC-MEMBER write', 'NC-MEMBER edit', 'NC-MEMBER read_image', 'NC-IMAGE-OBSERVER']) {
    assert.ok(results.some((result) => result.id === id), `missing control ${id}`)
  }
  const fresh = execFileSync(process.execPath, [join(ROOT, 'tests', 'ute-g1-fs', 'negative-controls.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  }).trim().split('\n')
  const committed = readFileSync(NC_TRANSCRIPT, 'utf8').trim().split('\n').filter((line) => !line.startsWith('EXIT='))
  assert.deepEqual(fresh, committed, 'the committed FS negative-control transcript must be exactly a fresh run')
  assert.equal(fresh.at(-1), 'NC-VERDICT GREEN controls=13 failed=0')
})
