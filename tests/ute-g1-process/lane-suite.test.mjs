/**
 * lane-suite.test.mjs — the UTE G1 PROCESS lane's own gates (B1: old path only).
 *
 *   node --test tests/ute-g1-process/lane-suite.test.mjs
 *
 * Seven independent checks, one verdict line:
 *   1. the OLD PATH still reproduces the reviewed golden fixture, field by
 *      field, and two captures are BYTE-IDENTICAL;
 *   2. the golden speaks only the closed refusal vocabulary, carries no
 *      machine-specific path, and every row's witnesses are well formed;
 *   3. the covered member set is exactly the exercisable one, and the DECLARED
 *      `pwsh` exclusion is printed rather than silently absent;
 *   4. the five measured semantic differences are still declared, still
 *      blocking and still UNAPPROVED;
 *   5. the family-level and per-member NEGATIVE CONTROLS are GREEN, and the
 *      committed transcript agrees with the live run;
 *   6. the composition probe's measured verdict is reproduced (route-C bash
 *      shadow, confined provider, pwsh unreachable, plane acceptance);
 *   7. the evidence directory is complete and the retirement state is honestly
 *      NOT_RETIREABLE (no approval record exists).
 *
 * The verdict is NOT a retirement claim: the old baseline is captured, the new
 * path does not exist at all, semantic differences are unresolved.
 *
 * @module tests/ute-g1-process/lane-suite.test
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { CORPUS, PROCESS_SECRET } from './lib/corpus.mjs'
import { compareAll, effectOf, parseGolden, processMode } from './lib/compare.mjs'
import { CATEGORY_IDS, REFUSAL_CATEGORIES, UNKNOWN_CATEGORY, auditProcessVocabulary } from './lib/effect-oracle.mjs'
import { identityLine, captureCorpus } from './lib/old-path.mjs'
import {
  PWSH_EXCLUSION_REFUSAL,
  PwshExclusionError,
  coverageObligation,
  measureWiring,
  wiringFacts,
  wiringLine,
} from './lib/pwsh-exclusion.mjs'
import { SEMANTIC_DIFF_LINE_RE, SEMANTIC_DIFFERENCES, semanticDifferenceLines } from './lib/semantic-differences.mjs'

const ROOT = process.cwd()
const DIR = join(ROOT, 'tests', 'ute-g1-process')
const GOLDEN = join(DIR, 'golden', 'old-path.tsv')
const META = join(DIR, 'golden', 'old-path.meta.txt')
const COVERAGE = join(DIR, 'golden', 'COVERAGE.md')
const EVIDENCE = join(ROOT, 'dev', 'agent-workflow', 'evidence', 'ute3-process-b1-20261120')
const PROBE_TRANSCRIPT = join(EVIDENCE, 'composition-probe.txt')
const NC_TRANSCRIPT = join(EVIDENCE, 'negative-controls.txt')
const CAPTURE_TRANSCRIPT = join(EVIDENCE, 'old-path-capture.txt')

const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
const goldenText = readFileSync(GOLDEN, 'utf8')

/** Every token the fixture must never contain. */
const FORBIDDEN_IN_GOLDEN = [
  [ROOT, 'the repository root'],
  ['/home/', 'a home directory'],
  ['.artifacts/tmp', 'a scratch path'],
  ['w-PB-', 'a scratch world name'],
]

test('PROC-1 the old path reproduces its golden fixture and two captures agree byte for byte', async () => {
  const first = await captureCorpus()
  const second = await captureCorpus()
  assert.equal(first.length, CORPUS.length, 'every corpus vector must be captured')
  const firstVerdict = compareAll(golden, first)
  assert.deepEqual(firstVerdict.failures, [], `the old path drifted from the golden fixture: ${JSON.stringify(firstVerdict.failures)}`)
  assert.deepEqual(firstVerdict.missingObserved, [], 'the fixture must not carry a vector the corpus no longer has')
  assert.deepEqual(firstVerdict.missingGolden, [], 'the corpus must not carry a vector the fixture has not recorded')
  const secondVerdict = compareAll(golden, second)
  assert.deepEqual(secondVerdict.failures, [], 'a second capture must reproduce the fixture identically')
  // The strongest form: the two independent runs serialize to the same bytes.
  const { serializeGolden } = await import('./lib/compare.mjs')
  assert.equal(serializeGolden(first), serializeGolden(second), 'two captures are not byte-identical')
  // And the committed fixture is exactly what a fresh capture writes.
  assert.equal(serializeGolden(first), goldenText, 'the committed fixture differs from a fresh capture')
  console.log(identityLine())
  console.log(`PROC-GOLDEN vectors=${String(golden.length)} claimProblems=0 captures=2 compare=identical`)
  void processMode
})

test('PROC-2 the golden speaks only the closed vocabulary and carries no machine-specific path', async () => {
  for (const [token, description] of FORBIDDEN_IN_GOLDEN) {
    assert.equal(goldenText.includes(token), false, `the fixture carries ${description} (${token})`)
  }
  // The vocabulary is the imported nine-category one; `unknown` is unreachable.
  assert.equal(Object.keys(REFUSAL_CATEGORIES).length, 9)
  assert.equal(CATEGORY_IDS.includes(UNKNOWN_CATEGORY), true, 'the residual bucket must be a declared id')
  assert.deepEqual(auditProcessVocabulary(), [], 'the process refusal entries must stay closed')
  const refused = golden.filter((row) => row.outcome === 'deny')
  for (const row of refused) {
    assert.ok(Object.hasOwn(REFUSAL_CATEGORIES, row.refusal), `row ${row.id} names an undeclared category ${JSON.stringify(row.refusal)}`)
    assert.notEqual(row.refusal, UNKNOWN_CATEGORY, `row ${row.id} rested in the unclassified bucket`)
  }
  // Effects are well formed on EVERY row: the four synthetic witnesses, with a
  // non-empty digest, and an explicit record shape.
  for (const row of golden) {
    for (const path of ['@process', '@stdout', '@stderr', '@fs:tree']) {
      const effect = effectOf(row, path)
      assert.ok(effect !== undefined, `row ${row.id} is missing the ${path} witness`)
      if (path === '@fs:tree') {
        assert.equal(effect.exists, true)
        assert.match(String(effect.sha256), /^[0-9a-f]{64}$/u)
        assert.match(String(effect.mode), /^(unchanged|CHANGED)$/u)
      }
    }
    const mode = processMode(row)
    assert.ok(mode !== undefined && (mode.record === 'json' || mode.record === 'absent'))
    if (row.outcome === 'deny') {
      assert.equal(mode.record, 'absent', `row ${row.id} refused but still answered a child record`)
      assert.equal(mode.timedOut, 'no')
    }
    // Leaks never appear, by construction of the fixture.
    assert.deepEqual(row.leaks, [], `row ${row.id} carries a secret token`)
  }
  const emitted = new Set(golden.map((row) => row.refusal).filter((value) => value !== null))
  console.log(`PROC-VOCABULARY declared=${String(CATEGORY_IDS.length)} emitted=${[...emitted].sort().join(',')} unknown=${refused.some((row) => row.refusal === UNKNOWN_CATEGORY) ? 'REACHED' : 'unreachable'}`)
})

test('PROC-3 the covered member set and the DECLARED pwsh exclusion are both explicit', async () => {
  const entries = [...new Set(golden.map((row) => row.entry))]
  assert.deepEqual(entries, ['bash'], `the baseline covers exactly the exercisable member, got ${JSON.stringify(entries)}`)
  // The census books TWO members; the unit must stay visibly short.
  const census = JSON.parse(readFileSync(join(ROOT, 'dev', 'agent-workflow', 'ledgers', 'arc-a-family-census.json'), 'utf8'))
  const processFamily = census.families.find((family) => family.familyId === 'dsh.process-family')
  assert.ok(processFamily !== undefined, 'the census must still book dsh.process-family')
  const names = processFamily.nativeNames.map((member) => String(member).replace(/^\(bound-definition\) /u, ''))
  assert.deepEqual(names.sort(), ['bash', 'pwsh'], `the census member list changed: ${JSON.stringify(names)}`)
  assert.equal(CORPUS.some((vector) => vector.entry === 'pwsh'), false, 'no pwsh vector may be claimed')
  // The exclusion is PRINTED in the meta + coverage files, not merely absent.
  const meta = readFileSync(META, 'utf8')
  const coverage = readFileSync(COVERAGE, 'utf8')
  for (const [file, text] of [[META, meta], [COVERAGE, coverage]]) {
    assert.match(text, /pwsh/u, `${file} must name the excluded member`)
    assert.match(text, /(?:EXCLUDED|excluded|not exercisable|NOT exercise)/u, `${file} must mark the exclusion as a decision`)
  }
  assert.match(meta, /OLD-PATH-META vectors=14 host=0\.2\.0-rc\.2 host_commit=[0-9a-f]{40} members=bash unit=1\/2/u)
  console.log(`PROC-COVERAGE members=census:${names.join('+')} covered=bash unit=1/2 pwsh=DECLARED-EXCLUSION vectors=${String(golden.length)}`)
})

test('PROC-4 the measured semantic differences are declared, blocking and unapproved', () => {
  assert.ok(SEMANTIC_DIFFERENCES.length >= 4, 'the measured difference set must not shrink')
  for (const difference of SEMANTIC_DIFFERENCES) {
    assert.match(difference.id, /^SD-PROCESS-[0-9]+-[a-z0-9-]+$/u)
    assert.equal(difference.blocking, true, `${difference.id} must stay blocking`)
    assert.equal(difference.approval, null, `${difference.id} has an approval record: retirement must not be silently unblocked`)
    assert.ok(difference.evidence.length > 0, `${difference.id} must cite where it was measured`)
  }
  for (const line of semanticDifferenceLines()) {
    assert.match(line, SEMANTIC_DIFF_LINE_RE, `a semantic-difference line is malformed: ${line}`)
    assert.equal(line.includes('approval=PENDING'), true)
    console.log(line)
  }
  // `newPathVerified` is FALSE because no new path exists AT ALL: the honest
  // evidence is an absence file, not an empty PASS transcript.
  assert.equal(existsSync(join(EVIDENCE, 'new-path-absent.txt')), true, 'the new-path absence evidence must exist')
  assert.equal(existsSync(join(EVIDENCE, 'new-path-run.txt')), false, 'no new-path PASS transcript may exist at B1')
})

test('PROC-5 the family and per-member negative controls are GREEN, and the committed transcript agrees', () => {
  const output = execFileSync(process.execPath, [join(DIR, 'negative-controls.mjs')], { cwd: ROOT, encoding: 'utf8' })
  const lines = output.trim().split('\n')
  const verdict = lines.filter((line) => line.startsWith('NC-VERDICT ')).at(-1)
  assert.ok(verdict !== undefined, 'the control script must print a verdict')
  assert.match(verdict, /^NC-VERDICT GREEN controls=[0-9]+ failed=0$/u, `the controls are not green: ${verdict}`)
  assert.match(output, /^NC NC-MEMBER bash ok$/mu, 'the per-member control must be present and green (the retirement gate greps it)')
  assert.match(output, /^NC NC-MEMBER bash-POSITIVE ok$/mu, 'the per-member control needs its positive arm')
  for (const id of ['NC-HARNESS-BITES', 'NC-CATEGORY-TOTAL', 'NC-PWSH-EXCLUSION-CONDITIONAL', 'NC-SHADOW-LOAD-BEARING', 'NC-CONFINEMENT-WITNESS', 'NC-TIMEOUT-LOAD-BEARING', 'NC-ENV-SCRUB-LOAD-BEARING', 'NC-CAP-LOAD-BEARING']) {
    assert.match(output, new RegExp(`^NC ${id} ok$`, 'mu'), `${id} must be present and green`)
  }
  assert.equal(output.includes('FAIL'), false, `a control failed: ${output}`)
  const committed = readFileSync(NC_TRANSCRIPT, 'utf8')
  const committedVerdict = committed.trim().split('\n').filter((line) => line.startsWith('NC-VERDICT ')).at(-1)
  assert.equal(committedVerdict, verdict, 'the committed control transcript does not agree with the live run')
  for (const line of lines.filter((line) => line.startsWith('NC '))) {
    assert.equal(committed.includes(line), true, `the committed transcript is missing the live line: ${line}`)
  }
  console.log(`PROC-CONTROLS ${verdict} transcript=${NC_TRANSCRIPT.replace(ROOT, '<repo>')}`)
})

test('PROC-6 the composition probe reproduces the measured verdict the baseline rests on', () => {
  const output = execFileSync(process.execPath, [join(DIR, 'probe-composition.mjs')], { cwd: ROOT, encoding: 'utf8' })
  // ONLY host-independent facts are asserted here. The binary presence is a
  // HOST OBSERVATION (a GitHub runner ships PowerShell and that must never
  // change the verdict); the exclusion itself is a WIRING fact, asserted below
  // and enforced by PROC-8 + NC-PWSH-EXCLUSION-CONDITIONAL.
  const binaryObservation = /^PROBE-PWSH binary=(.*)$/mu.exec(output)
  assert.ok(binaryObservation !== null, 'the probe must PRINT its pwsh-binary observation')
  const expect = [
    [/^PROBE-PWSH binary-on-path=(?:yes|no) host-package=present route-c-shadow=ABSENT$/mu, 'no route-C shadow for pwsh on this composition'],
    [/^PROBE-PWSH preset-row=REMOVED-by-the-shipped-governed-preset/mu, 'the shipped governed preset REMOVES the tool-pwsh row'],
    [/^PROBE-PWSH reason=shipped-wiring route-c-shadow=ABSENT preset-row=REMOVED\S* post-attach-definition=ABSENT — the binary line above is a HOST OBSERVATION, not the exclusion reason$/mu, 'the probe must name the WIRING as the exclusion reason and label the binary as an observation'],
    [/^PROBE-ROUTE-UNREACHABLE member=pwsh reason=.+$/mu, 'pwsh must be declared unreachable by NAME'],
    [/^PROBE-OWNER bash-replaced-by-attach=yes before=preset-definition after=routed-definition$/mu, 'the attach must replace the preset bash definition'],
    [/^PROBE-MEMBER bash reachable=yes outcome=allow$/mu, 'bash must be reachable'],
    [/^PROBE-MEMBER bash confined=yes providerCalls=1 inheritedServiceCalls=0$/mu, 'bash must reach the confined provider, not the inherited service'],
    [/^PROBE-PLANE names=native\+bash-pwsh gate=PLANE_NAMES_INVALID$/mu, 'the plane must refuse to express the pwsh name'],
    [/^PROBE-PLANE names=bash-native\+search-aliased gate=accepted$/mu, 'the plane must ACCEPT the native bash name on a complete map'],
    [/^PROBE-CONCLUSION baseline-scope=bash only; pwsh is a DECLARED, PRINTED exclusion/mu, 'the probe must print the baseline scope decision'],
  ]
  for (const [pattern, why] of expect) {
    assert.match(output, pattern, `the probe no longer shows ${why}:\n${output}`)
  }
  // pwsh unreachable for the RIGHT reason: no definition on the post-attach
  // scope, not a crash, not a binary lookup.
  const unreachable = output.split('\n').find((line) => line.startsWith('PROBE-ROUTE-UNREACHABLE member=pwsh'))
  assert.match(unreachable, /no definition is registered/u)
  // The observation is RECORDED and printed, never required to have one shape.
  console.log(`PROC-PROBE-PWSH binary-observation=${JSON.stringify(binaryObservation[1])} exclusion-reason=shipped-wiring (host-independent)`)

  // PROC-8's law, evaluated on the SAME probe output the assertions read: the
  // exclusion is legal only while the wiring serves no pwsh, and the corpus
  // must carry a vector the moment it does.
  const wiring = measureWiring(output)
  const facts = wiringFacts({ ...wiring, vectors: CORPUS })
  const obligation = coverageObligation(facts)
  assert.equal(obligation.status, 'EXCLUDED', `the corpus must be excluded only while the wiring serves no pwsh: ${JSON.stringify(obligation)}`)
  console.log(wiringLine(facts))
  const committed = readFileSync(PROBE_TRANSCRIPT, 'utf8')
  assert.equal(committed.includes('PROBE-ROUTE-UNREACHABLE member=pwsh'), true)
  assert.equal(committed.includes('PROBE-CONCLUSION baseline-scope=bash only'), true)
  console.log(`PROC-PROBE route-c=bash-confined pwsh=UNREACHABLE reason=no-definition plane-native-bash=ACCEPTED plane-pwsh=PLANE_NAMES_INVALID`)
})

test('PROC-8 the pwsh exclusion is conditional on the SHIPPED WIRING, not on a binary', () => {
  // Hosted run 44843401144 red on `binary=ABSENT`: that assertion encoded the
  // author's laptop, not the repository. This test encodes the LAW instead: the
  // exclusion is allowed only while route C / the preset / the post-attach scope
  // serve no `pwsh`, and a composition that DOES serve it must fail loudly here
  // rather than silently inherit the exclusion.
  const output = execFileSync(process.execPath, [join(DIR, 'probe-composition.mjs')], { cwd: ROOT, encoding: 'utf8' })
  const wiring = measureWiring(output)
  const facts = wiringFacts({ ...wiring, vectors: CORPUS })
  assert.deepEqual(wiring, { shadowPresent: false, presetMountsPwsh: false, registered: false }, `the measured wiring must serve no pwsh, got ${JSON.stringify(wiring)}`)
  assert.equal(coverageObligation(facts).status, 'EXCLUDED')
  // The exclusion is NOT inherited: flip each wiring fact and the corpus is then
  // OBLIGED to carry a pwsh vector. Each arm must refuse with the named code.
  for (const [label, mutated] of [
    ['route-c-shadow present', { shadowPresent: true }],
    ['preset mounts tool-pwsh', { presetMountsPwsh: true }],
    ['post-attach definition registered', { registered: true }],
  ]) {
    assert.throws(
      () => coverageObligation(wiringFacts({ ...wiring, ...mutated, vectors: CORPUS })),
      (error) => error instanceof PwshExclusionError && error.code === PWSH_EXCLUSION_REFUSAL,
      `${label} must REFUSE the exclusion instead of inheriting it`,
    )
  }
  // And the same wiring WITH a vector is covered, so the law is not "always red".
  const covered = coverageObligation(wiringFacts({ shadowPresent: true, presetMountsPwsh: false, registered: false, vectors: [...CORPUS, { entry: 'pwsh' }] }))
  assert.equal(covered.status, 'COVERED')
  // The corpus itself must stay bash-only while the wiring serves no pwsh.
  assert.equal(CORPUS.some((vector) => vector.entry === 'pwsh'), false)
  console.log('PROC-PWSH-CONDITIONAL wiring=serves-none exclusion=LEGAL arms-refused=3 covered-arm=COVERED')
})

test('PROC-7 the evidence directory is complete and retirement stays honestly forbidden', () => {
  for (const file of ['composition-probe.txt', 'negative-controls.txt', 'old-path-capture.txt', 'new-path-absent.txt', 'README.md']) {
    assert.equal(existsSync(join(EVIDENCE, file)), true, `the evidence file ${file} is missing`)
  }
  const capture = readFileSync(CAPTURE_TRANSCRIPT, 'utf8')
  assert.match(capture, /^OLD-PATH-GOLDEN compare=identical /mu, 'the committed capture transcript must record the identical comparison')
  assert.match(capture, /^OLD-PATH-VERDICT GREEN vectors=14 claimProblems=0 /mu)
  assert.match(capture, /^OLD-PATH-EXCLUSIONS record\.signal/mu, 'the exclusion set must be PRINTED in the transcript')
  const absence = readFileSync(join(EVIDENCE, 'new-path-absent.txt'), 'utf8')
  assert.match(absence, /NEW-PATH-ABSENT/u)
  assert.match(absence, /No new path exists/u)
  // No approval record may exist anywhere in the unit's artifacts.
  for (const [file, text] of [[META, readFileSync(META, 'utf8')], [COVERAGE, readFileSync(COVERAGE, 'utf8')]]) {
    assert.equal(/approved-by|approval:\s*by:/u.test(text), false, `${file} carries an approval record`)
  }
  // The fixture never carries a planted secret token.
  assert.equal(goldenText.includes(PROCESS_SECRET), false)
  console.log('UTE-G1-PROCESS-VERDICT old-baseline=REPRODUCIBLE new-path=ABSENT semantic-differences=UNRESOLVED negative-controls=GREEN retirement=FORBIDDEN unit=1/2')
})
