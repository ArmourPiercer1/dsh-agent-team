#!/usr/bin/env node
/**
 * negative-controls.mjs — FAMILY-LEVEL and PER-MEMBER mutations that plant a
 * defect the golden fixture must catch.
 *
 * Each control has two arms: the MUTATED run must go RED (the defect is
 * observed) and, where the control mutates a declaration, the UNMODIFIED run
 * must reproduce its golden row (the arm is not green-by-skip). A control whose
 * mutation does not change the observed record is an `NC ... FAIL`: a control
 * that cannot fail proves nothing.
 *
 * The mutations, and why they are legitimate (none patches product code):
 *   NC-HARNESS-BITES          flip one golden cell (the stdout digest and the
 *                             exit status) — proves the comparator grades those
 *                             cells instead of trusting the run.
 *   NC-CATEGORY-TOTAL         feed the classifier a refusal no entry explains —
 *                             must raise REFUSAL_VOCABULARY_INCOMPLETE, never
 *                             bucket it, and `unknown` must be unreachable.
 *   NC-MEMBER bash            widen ONLY the read lane around the out-of-lane
 *                             read vector: the same call then succeeds and
 *                             carries the secret. The refusal was the lane's
 *                             decision.
 *   NC-MEMBER bash-POSITIVE   the unmodified arm reproduces its golden row, so
 *                             the control above did not pass by breaking the
 *                             world.
 *   NC-SHADOW-LOAD-BEARING    dispose the realm's route-C bash shadow (its own
 *                             disposal): the out-of-lane WORKDIR call is then
 *                             served by the inherited preset definition and
 *                             succeeds — the lane decision belongs to the shadow.
 *   NC-CONFINEMENT-WITNESS    the same disposal on the OS-denied read: the
 *                             inherited shell runs it, the confined provider is
 *                             never called and the secret reaches the model, so
 *                             the confined-vs-inherited witness bites.
 *   NC-TIMEOUT-LOAD-BEARING   re-run the timeout vector with a 30 s caller
 *                             timeout: the payload completes and writes the
 *                             marker, so the kill was the declared timeout.
 *   NC-ENV-SCRUB-LOAD-BEARING mount the SAME face with the secret opted in
 *                             through the install spec's `env` (layered AFTER
 *                             the scrub): the child then sees it, so the
 *                             baseline's ABSENT is the scrub, not a broken env.
 *   NC-CAP-LOAD-BEARING       the same large-output call with the shadow
 *                             disposed: the inherited definition answers its own
 *                             cap (the host executor's maxOutputBytes), so the
 *                             recorded 262144 is the shadow's declared cap.
 *
 * Evidence: dev/agent-workflow/evidence/ute3-process-b1-20261120/negative-controls.txt
 *
 * @module tests/ute-g1-process/negative-controls
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CORPUS, PROCESS_SECRET } from './lib/corpus.mjs'
import { compareRecord, parseGolden } from './lib/compare.mjs'
import {
  CATEGORY_IDS,
  REFUSAL_CATEGORIES,
  RefusalVocabularyError,
  UNKNOWN_CATEGORY,
  auditProcessVocabulary,
  classifyProcessRefusal,
} from './lib/effect-oracle.mjs'
import { captureVector } from './lib/old-path.mjs'
import {
  PWSH_EXCLUSION_REFUSAL,
  PwshExclusionError,
  coverageObligation,
  measureWiring,
  wiringFacts,
} from './lib/pwsh-exclusion.mjs'

const GOLDEN = join(process.cwd(), 'tests', 'ute-g1-process', 'golden', 'old-path.tsv')
/** The per-vector scratch root, collapsed so a transcript never carries a host path. */
const SCRATCH = join(process.cwd(), '.artifacts', 'tmp', 'ute-g1-process')
const stable = (text) => String(text ?? '').split(SCRATCH).join('<scratch>').replace(/<scratch>\/w-[A-Za-z0-9-]+/gu, '<scratch>/<world>')
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
const effectOf = (record, path) => record.effects.find((effect) => effect.path === path)

let controls = 0
let failed = 0
/** Run one control; `body` returns a reason string when the control FAILS to bite. */
async function control(id, body) {
  controls += 1
  let reason
  let detail
  try {
    const settled = await body()
    if (settled !== null && typeof settled === 'object') {
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

/** The unmodified run must still reproduce its golden row (a positive arm). */
async function positiveArm(id) {
  const observed = await captureVector(vector(id))
  const verdict = compareRecord(goldenRow(id), observed)
  return verdict.ok
    ? undefined
    : `the unmodified ${id} run no longer reproduces its golden row: ${verdict.diffs.map((diff) => `${diff.field} golden=${JSON.stringify(diff.expected)} observed=${JSON.stringify(diff.observed)}`).join(' | ')}`
}

// ── 1. the comparator bites on the cells the argument rests on ────────────
await control('NC-HARNESS-BITES', async () => {
  const row = structuredClone(goldenRow('PB-B1-inlane-stdout'))
  const stdout = effectOf(row, '@stdout')
  const process = effectOf(row, '@process')
  stdout.sha256 = 'f'.repeat(64)
  process.bytes = 99
  const observed = await captureVector(vector('PB-B1-inlane-stdout'))
  const verdict = compareRecord(row, observed)
  if (verdict.ok) return 'the mutated golden row still compares equal: the comparator is not grading the stdout digest/exit status'
  const fields = verdict.diffs.map((diff) => diff.field).sort()
  if (!fields.includes('effects')) return `the mutation was not detected on the effects cell (detected: ${fields.join(',')})`
  return undefined
})

// ── 2. the refusal vocabulary is total and `unknown` is unreachable ───────
await control('NC-CATEGORY-TOTAL', async () => {
  // (a) an unmapped refusal must RAISE, never land in a bucket.
  let raised = null
  try {
    classifyProcessRefusal({ text: 'SUBPROCESS_SOMETHING_NOBODY_MAPPED: a new refusal reason', facts: [] })
  } catch (error) {
    raised = error
  }
  if (raised === null) return 'an unmapped refusal was classified instead of raising REFUSAL_VOCABULARY_INCOMPLETE'
  if (!(raised instanceof RefusalVocabularyError) || raised.code !== 'REFUSAL_VOCABULARY_INCOMPLETE') {
    return `an unmapped refusal raised ${String(raised?.code ?? raised?.name)} instead of REFUSAL_VOCABULARY_INCOMPLETE`
  }
  // (b) `unknown` must be unreachable from every declared entry.
  const vocabulary = auditProcessVocabulary()
  if (vocabulary.length > 0) return `the process vocabulary is not closed: ${vocabulary.join(' | ')}`
  if (CATEGORY_IDS.includes(UNKNOWN_CATEGORY) === false) return 'the unclassified bucket is not even a declared id (the invariant has no meaning)'
  // (c) every category the corpus ACTUALLY emitted is a declared id, and none
  //     of them is the bucket.
  const emitted = new Set(golden.map((row) => row.refusal).filter((value) => value !== null))
  for (const category of emitted) {
    if (!Object.hasOwn(REFUSAL_CATEGORIES, category)) return `the golden emitted undeclared category ${JSON.stringify(category)}`
    if (category === UNKNOWN_CATEGORY) return 'a golden row landed in the unclassified bucket'
  }
  // (d) every IO_* code the corpus recorded still resolves through the
  //     IMPORTED vocabulary (no local fork of the shared map).
  const codes = new Set(golden.map((row) => row.codes).filter((value) => value !== '-'))
  for (const code of codes) {
    const resolved = classifyProcessRefusal({ text: `Error: ${code}: x`, code, facts: [{ decision: 'deny', locator: join(SCRATCH, 'missing') }] })
    if (resolved.category === UNKNOWN_CATEGORY) return `code ${code} resolved into the unclassified bucket`
  }
  return undefined
})

// ── 2b. the pwsh exclusion is CONDITIONAL on the wiring (hosted 44843401144) ─
// The first revision asserted "no pwsh binary on this host", which is true on
// the author's laptop and false on a GitHub runner. That is a portability defect
// in the EVIDENCE, not a flake: no test may require the host's shape. This
// control proves the replacement law can REFUSE: while the shipped wiring serves
// no pwsh the exclusion is legal, and the moment any wiring fact starts serving
// it the corpus is obliged to carry a vector — loudly, never silently.
await control('NC-PWSH-EXCLUSION-CONDITIONAL', async () => {
  const probeOutput = execFileSync(process.execPath, [join(process.cwd(), 'tests', 'ute-g1-process', 'probe-composition.mjs')], { cwd: process.cwd(), encoding: 'utf8' })
  const wiring = measureWiring(probeOutput)
  const baseline = coverageObligation(wiringFacts({ ...wiring, vectors: CORPUS }))
  if (baseline.status !== 'EXCLUDED') return `the measured wiring (serves no pwsh) did not yield EXCLUDED: ${JSON.stringify(baseline)}`
  if (CORPUS.some((vector) => vector.entry === 'pwsh')) return 'the corpus carries a pwsh vector although the wiring serves none (the exclusion would not be exercised)'
  const refused = []
  for (const [label, mutated] of [
    ['shadow', { shadowPresent: true }],
    ['preset', { presetMountsPwsh: true }],
    ['registered', { registered: true }],
  ]) {
    try {
      coverageObligation(wiringFacts({ ...wiring, ...mutated, vectors: CORPUS }))
      return `a wiring that serves pwsh via ${label} was granted the exclusion silently (the control does not bite)`
    } catch (error) {
      if (!(error instanceof PwshExclusionError) || error.code !== PWSH_EXCLUSION_REFUSAL) {
        return `the ${label} arm raised ${String(error?.code ?? error?.name)} instead of ${PWSH_EXCLUSION_REFUSAL}`
      }
      refused.push(label)
    }
  }
  if (refused.length !== 3) return `only ${String(refused.length)} of 3 wiring arms refused the exclusion`
  const covered = coverageObligation(wiringFacts({ ...wiring, registered: true, vectors: [...CORPUS, { entry: 'pwsh' }] }))
  if (covered.status !== 'COVERED') return `the same wiring WITH a vector was not accepted: ${JSON.stringify(covered)}`
  return undefined
})

// ── 3. per-member control: the out-of-lane refusal is the LANE's decision ─
await control('NC-MEMBER bash', async () => {
  const unmodified = goldenRow('PB-B8-outside-read-os')
  if (unmodified.outcome !== 'allow' || unmodified.leaks.length !== 0) return 'the golden row is not the recorded in-lane denial shape (an allow with zero leaks)'
  const widened = await captureVector(vector('PB-B8-outside-read-os'), { laneExtraTokens: ['outside'] })
  if (widened.leaks.length === 0) return 'widening the read lane did NOT leak the out-of-lane secret: the refusal was not the lane\'s decision'
  const positive = await positiveArm('PB-B8-outside-read-os')
  if (positive !== undefined) return positive
  return undefined
})

await control('NC-MEMBER bash-POSITIVE', async () => positiveArm('PB-B8-outside-read-os'))

// ── 4. the route-C shadow is load-bearing for the lane decision ───────────
await control('NC-SHADOW-LOAD-BEARING', async () => {
  const observed = await captureVector(vector('PB-B7-outside-workdir'), { dropBashShadow: true })
  if (observed.outcome !== 'allow') return `without the route-C shadow the out-of-lane workdir call still refused (outcome=${observed.outcome}); the shadow is not what decides the lane`
  if (observed.facts.baseCalls === 0) return 'the inherited shell was never reached, so the mutation did not prove the fallback'
  if (observed.facts.confined !== 0) return `the confined provider was still called ${String(observed.facts.confined)} time(s) without the shadow`
  const positive = await positiveArm('PB-B7-outside-workdir')
  if (positive !== undefined) return positive
  return undefined
})

// ── 5. the confinement witness bites (confined vs inherited) ──────────────
await control('NC-CONFINEMENT-WITNESS', async () => {
  const observed = await captureVector(vector('PB-B8-outside-read-os'), { dropBashShadow: true })
  if (observed.facts.confined !== 0) return `the shadow-disposed arm still reached the confined provider ${String(observed.facts.confined)} time(s)`
  if (observed.facts.baseCalls === 0) return 'the inherited host shell was never reached, so the witness did not distinguish the two faces'
  if (observed.leaks.length === 0) return 'the inherited shell did NOT leak the out-of-lane secret; the confinement witness cannot tell an escape from a refusal'
  if (observed.observed.record !== null) return 'the inherited arm still answered the confined record shape, so the witness keyed on the wrong definition'
  return undefined
})

// ── 6. the timeout is the declaration, not the fixture ────────────────────
await control('NC-TIMEOUT-LOAD-BEARING', async () => {
  const baseline = goldenRow('PB-B5-timeout')
  if (!String(effectOf(baseline, '@process').mode).includes('timedOut=yes')) return 'the golden timeout row does not record timedOut=yes'
  const relaxed = await captureVector(vector('PB-B5-timeout'), { argsPatch: { timeoutMs: 30_000 } })
  if (relaxed.observed.record === null) return 'the relaxed arm answered no confined record'
  if (relaxed.observed.record.timedOut !== false) return 'the payload still timed out with a 30 s caller timeout'
  if (relaxed.observed.record.exitCode !== 0) return `the relaxed arm exited ${JSON.stringify(relaxed.observed.record.exitCode)}, not 0`
  const marker = effectOf(relaxed, '@fs:tree')
  const before = effectOf(baseline, '@fs:tree')
  if (marker.sha256 === before.sha256) return 'the relaxed arm did not write marker.txt, so the timeout kill is not what removed the effect'
  const positive = await positiveArm('PB-B5-timeout')
  if (positive !== undefined) return positive
  return undefined
})

// ── 7. the environment scrub is the face's decision ───────────────────────
await control('NC-ENV-SCRUB-LOAD-BEARING', async () => {
  const baseline = goldenRow('PB-B10-env-scrub')
  if (baseline.leaks.length !== 0) return 'the golden env row leaks the planted secret'
  const optedIn = await captureVector(vector('PB-B10-env-scrub'), { faceEnv: { UTE3_PROCESS_SECRET: PROCESS_SECRET, DSH_UTE3_PROCESS_LEAK: `${PROCESS_SECRET}_DSH` } })
  if (optedIn.observed.record === null) return 'the opted-in arm answered no confined record'
  const stdout = optedIn.observed.stdout
  if (!stdout.includes(PROCESS_SECRET) && !stdout.includes('secret=UTE3')) return `an explicit opt-in did not reach the child (stdout=${JSON.stringify(stdout.slice(0, 120))}); the absence is not attributable to the scrub`
  const positive = await positiveArm('PB-B10-env-scrub')
  if (positive !== undefined) return positive
  return undefined
})

// ── 8. the recorded cap belongs to the shadow's declaration ───────────────
await control('NC-CAP-LOAD-BEARING', async () => {
  const baseline = goldenRow('PB-B4-stdout-cap')
  const recorded = effectOf(baseline, '@stdout').bytes
  if (recorded !== 262144) return `the golden cap row is ${String(recorded)} bytes, not the declared 262144`
  const inherited = await captureVector(vector('PB-B4-stdout-cap'), { dropBashShadow: true })
  if (inherited.facts.baseCalls === 0) return 'the shadow-disposed arm never reached the inherited shell'
  const inheritedBytes = Buffer.byteLength(inherited.observed.text ?? '', 'utf8')
  if (inheritedBytes === recorded) return 'the inherited definition produced the SAME byte count, so the recorded cap is not the shadow\'s declaration'
  return undefined
})

console.log(`NC-VERDICT ${failed === 0 ? 'GREEN' : 'RED'} controls=${String(controls)} failed=${String(failed)}`)
if (failed > 0) process.exitCode = 1
