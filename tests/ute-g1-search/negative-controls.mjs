#!/usr/bin/env node
/**
 * negative-controls.mjs — FAMILY-LEVEL and PER-MEMBER mutations that plant a
 * defect the golden fixture must catch.
 *
 * Each control has two arms: the MUTATED run must go RED (the defect is
 * observed) and the UNMODIFIED run must reproduce its golden row (the arm is
 * not green-by-skip). A control whose mutation does not change the observed
 * record is an `NC ... FAIL`: a control that cannot fail proves nothing.
 *
 * The mutations, and why they are legitimate:
 *   NC-HARNESS-BITES     flip one golden cell (the match digest) — proves the
 *                        comparator grades that cell instead of trusting the run.
 *   NC-CATEGORY-TOTAL    feed the classifier a refusal no entry explains — must
 *                        raise REFUSAL_VOCABULARY_INCOMPLETE, never bucket it,
 *                        and `unknown` must be unreachable from every entry.
 *   NC-MEMBER grep       widen ONLY the read lane around the out-of-lane grep
 *                        vector: the same call then succeeds and carries the
 *                        secret. The refusal was the lane's decision.
 *   NC-MEMBER glob       the same widening for the out-of-lane glob vector.
 *   NC-SHADOW-LOAD-BEARING  dispose the realm's search shadow (its own
 *                        disposal): the out-of-lane grep is then served by the
 *                        inherited unconfined definition and leaks the secret.
 *   NC-STDIN-LOAD-BEARING   the same disposal on the PATH-LESS grep vector: the
 *                        zero-match answer becomes a real match, so SR-G2's
 *                        emptiness is the confined child's stdin, not the
 *                        fixture.
 *
 * Evidence: dev/agent-workflow/evidence/ute3-search-b1-20261120/negative-controls.txt
 *
 * @module tests/ute-g1-search/negative-controls
 */
import { captureVector } from './lib/old-path.mjs'
import { CORPUS, SEARCH_NEEDLE } from './lib/corpus.mjs'
import { compareRecord, parseGolden } from './lib/compare.mjs'
import {
  CATEGORY_IDS,
  REFUSAL_CATEGORIES,
  RefusalVocabularyError,
  SEARCH_REFUSAL_MAP,
  classifySearchRefusal,
} from './lib/effect-oracle.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const GOLDEN = join(process.cwd(), 'tests', 'ute-g1-search', 'golden', 'old-path.tsv')
/** The per-vector scratch root, collapsed so a transcript never carries a host path. */
const SCRATCH = join(process.cwd(), '.artifacts', 'tmp', 'ute-g1-search')
const stable = (text) => String(text ?? '')
  .split(SCRATCH).join('<scratch>')
  .replace(/<scratch>\/w-[A-Za-z0-9]+/gu, '<scratch>/<world>')
const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
const goldenRow = (id) => {
  const row = golden.find((record) => record.id === id)
  if (row === undefined) throw new Error(`the golden fixture has no row ${id}`)
  return row
}
const vector = (id) => {
  const found = CORPUS.find((candidate) => candidate.id === id)
  if (found === undefined) throw new Error(`the corpus has no vector ${id}`)
  return found
}

let controls = 0
let failed = 0
/** Run one control; `body` returns a reason string when the control FAILS to bite. */
async function control(id, body) {
  controls += 1
  let reason
  let detail
  try {
    const settled = await body()
    if (settled !== null && typeof settled === 'object' && !(settled instanceof Error)) {
      reason = settled.reason
      detail = settled.detail
    } else {
      reason = settled
    }
  } catch (error) {
    reason = `threw: ${error?.message ?? String(error)}`
  }
  if (reason === undefined || reason === null) {
    console.log(stable(`NC ${id} ok${detail === undefined ? '' : ` (${detail})`}`))
    return true
  }
  failed += 1
  console.log(stable(`NC ${id} FAIL ${reason}`))
  return false
}

/** The unmodified run must still reproduce the golden row (a positive arm). */
async function positiveArm(id) {
  const observed = await captureVector(vector(id))
  const verdict = compareRecord(goldenRow(id), observed)
  return verdict.ok ? undefined : `the unmodified ${id} run no longer reproduces its golden row (${verdict.diffs.map((diff) => diff.field).join(',')})`
}

/* ── 1. the harness bites on the cell the argument rests on ─────────────── */
await control('NC-HARNESS-BITES', async () => {
  const observed = await captureVector(vector('SR-G1-inlane-match'))
  const clean = compareRecord(goldenRow('SR-G1-inlane-match'), observed)
  if (!clean.ok) return `the unmodified run already differs from its golden row (${clean.diffs.map((diff) => diff.field).join(',')})`
  // Flip exactly one cell: the canonical match digest.
  const tampered = {
    ...goldenRow('SR-G1-inlane-match'),
    effects: goldenRow('SR-G1-inlane-match').effects.map((effect) => (effect.path === '@matches:grep'
      ? { ...effect, sha256: 'f'.repeat(64) }
      : effect)),
  }
  const mutated = compareRecord(tampered, observed)
  if (mutated.ok) return 'a tampered match digest was graded GREEN'
  if (!mutated.diffs.some((diff) => diff.field === 'effects')) return 'the tampered digest was not reported on the effects field'
  return undefined
})

/* ── 2. the refusal vocabulary is total, and `unknown` is unreachable ───── */
await control('NC-CATEGORY-TOTAL', async () => {
  for (const entry of SEARCH_REFUSAL_MAP) {
    if (entry.category === 'unknown') return 'a mapping entry reaches the unknown bucket'
    if (!CATEGORY_IDS.includes(entry.category)) return `a mapping entry names ${JSON.stringify(entry.category)}, outside the closed vocabulary`
    if (!Object.hasOwn(REFUSAL_CATEGORIES, entry.category)) return `a mapping entry names ${JSON.stringify(entry.category)}, absent from REFUSAL_CATEGORIES`
  }
  try {
    classifySearchRefusal({
      outcome: 'deny',
      text: 'Error: a refusal this corpus has never observed',
      facts: [],
      readRoots: ['/tmp/ute3-search-never-a-real-root'],
    })
  } catch (error) {
    if (error instanceof RefusalVocabularyError && error.code === 'REFUSAL_VOCABULARY_INCOMPLETE') return undefined
    return `an unexplainable refusal threw ${error?.code ?? error?.name} instead of REFUSAL_VOCABULARY_INCOMPLETE`
  }
  return 'an unexplainable refusal was CLASSIFIED instead of refused (the vocabulary is not total)'
})

/* ── 3-6. per-member mutations + their positive arms ────────────────────── */
/**
 * The witness that a withheld READ reached the model. For `grep` it is the
 * returned file CONTENT; for `glob` it is the returned PATH (a listing carries
 * no bytes), so the two members need different evidence for the same mutation.
 */
function escapedWitness(record, member) {
  if (member === 'grep') {
    return record.leaks.length > 0 ? `leaked content ${record.leaks.join(',')}` : undefined
  }
  const effect = record.effects.find((candidate) => candidate.path === '@matches:glob')
  const keys = String(effect?.mode ?? '').split(',').find((part) => part.startsWith('keys='))
  const escaped = (keys ?? '').slice('keys='.length).split('+').filter((key) => key.startsWith('abs:'))
  return escaped.length > 0 ? `leaked path ${escaped.join('+')}` : undefined
}

/** Widen only the read lane: the same call must then succeed and leak. */
async function widenLaneControl({ id, member }) {
  const tampered = await captureVector(vector(id), { laneExtraRead: ['outside'], allowEscapedMatches: true })
  const row = goldenRow(id)
  if (tampered.outcome !== 'allow') return `widening the read lane did not turn the refusal into an allow (observed ${tampered.outcome})`
  const witness = escapedWitness(tampered, member)
  if (witness === undefined) return 'the widened run carried no out-of-lane witness, so the mutation proves nothing about the lane'
  const verdict = compareRecord(row, tampered)
  if (verdict.ok) return 'the widened run still matched the golden row'
  const detail = `mutation: outcome ${row.outcome}->${tampered.outcome}, refusal ${String(row.refusal)}->${String(tampered.refusal)}, match effect absent->present, ${witness}`
  const positive = await positiveArm(id)
  if (positive !== undefined) return positive
  controls += 1
  console.log(`NC-MEMBER-POSITIVE ${member} ok (the unmodified ${id} row still reproduces)`)
  return { detail }
}

await control('NC-MEMBER grep', () => widenLaneControl({ id: 'SR-G3-outside-denied', member: 'grep' }))
await control('NC-MEMBER glob', () => widenLaneControl({ id: 'SR-L2-outside-denied', member: 'glob' }))

/* ── 7. the search shadow is load-bearing ───────────────────────────────── */
await control('NC-SHADOW-LOAD-BEARING', async () => {
  const observed = await captureVector(vector('SR-G3-outside-denied'), { dropSearchShadow: true, allowEscapedMatches: true })
  const row = goldenRow('SR-G3-outside-denied')
  if (observed.outcome !== 'allow') return `disposing the search shadow did not expose the out-of-lane read (observed ${observed.outcome}, refusal ${String(observed.refusal)})`
  if (observed.leaks.length === 0) return 'the unconfined arm returned no secret token, so the shadow is not proven load-bearing'
  const verdict = compareRecord(row, observed)
  if (verdict.ok) return 'the unconfined arm still matched the golden row'
  const positive = await positiveArm('SR-G3-outside-denied')
  if (positive !== undefined) return positive
  return undefined
})

/* ── 8. the path-less zero is the confined stdin, not the fixture ───────── */
await control('NC-STDIN-LOAD-BEARING', async () => {
  const observed = await captureVector(vector('SR-G2-no-path-stdin'), { dropSearchShadow: true })
  const matchEffect = observed.effects.find((effect) => effect.path === '@matches:grep')
  if (matchEffect?.exists !== true || matchEffect.bytes === 0) {
    return `the unconfined path-less grep still returned ${String(matchEffect?.bytes)} matches; the stdin explanation is not proven`
  }
  if (!String(observed.effects.find((effect) => effect.path === '@matches:grep')?.mode ?? '').includes('keys=')) {
    return 'the unconfined arm produced no path keys, so the matches are not attributable'
  }
  const positive = await positiveArm('SR-G2-no-path-stdin')
  if (positive !== undefined) return positive
  // The golden row must stay a ZERO-match allow: the control proves the cause,
  // never changes the recorded product behaviour.
  const row = goldenRow('SR-G2-no-path-stdin')
  if (row.outcome !== 'allow' || row.refusal !== null) return 'the golden row for SR-G2 is not the recorded allow'
  void SEARCH_NEEDLE
  return undefined
})

console.log(`NC-VERDICT ${failed === 0 ? 'GREEN' : 'RED'} controls=${controls} failed=${failed}`)
if (failed > 0) process.exitCode = 1
