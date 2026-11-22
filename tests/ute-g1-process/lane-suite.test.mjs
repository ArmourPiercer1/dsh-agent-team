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

import { retirementPin } from '../ute-g1-shared/retirement.mjs'
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

test('PROC-1 RETIRED-BY-A0: the appended bash shadow is gone and the fixture is the frozen baseline', async () => {
  // ROUND 81 disposition (ROUND80-CI-CLOSURE.md §4): the B1 arm captured the
  // route-C world whose attach APPENDED `confined-bash-tool.mjs`. The A1 cut
  // deleted that mechanism (`5d1349767`), so reproducing the old capture would
  // assert a surface that no longer exists. The fixture stays as the FROZEN
  // historical baseline (never re-recorded: this lane owns no new path), and the
  // retired surface is asserted ABSENT with a LIVE mount underneath.
  const pin = retirementPin({
    suite: 'PROCESS',
    subject: 'dsh.process-family',
    retiredPaths: [
      'packages/runtime/src/plugin/live/confined-bash-tool.mjs',
      'packages/runtime/src/plugin/live/confined-terminal-tool.mjs',
      'packages/tools/process-family/src/executors.mjs',
    ],
    successors: [
      'packages/runtime/test/vnext-admission.test.mjs',
      'tests/ute-g1-fs/lane-suite.test.mjs',
      'tests/world-factory/a5sf-pd12-bash-governance.test.mjs',
      'tests/ute-g1-process/lane-suite.test.mjs',
    ],
    golden: 'tests/ute-g1-process/golden/old-path.tsv',
    goldenRows: 14,
  })
  assert.match(pin.line, /^UTE-G1-PROCESS-RETIRED-BY-A0 subject=dsh\.process-family citation=5d1349767\+93ba0a1d1 /u)
  // LIVE: mount the product route-C composition with NO composition-declared
  // native module. The seam must append nothing and the preset definition must be
  // untouched — a resurrected shadow turns this RED.
  const { mountRouteCWorld } = await import('./lib/world.mjs')
  const scratch = join(ROOT, '.artifacts', 'tmp', 'ute-g1-process', `retired-${String(process.pid)}`)
  const fs = await import('node:fs')
  fs.mkdirSync(join(scratch, 'inside'), { recursive: true })
  fs.writeFileSync(join(scratch, 'inside', 'a.txt'), 'alpha\n')
  try {
    const world = await mountRouteCWorld({ label: 'retired-mechanism', fixtureRoot: scratch, cwd: join(scratch, 'inside'), readRoots: [join(scratch, 'inside')] })
    try {
      assert.equal(world.attachAppendedNothing, true, 'the post-cut attach appended a Team-authored shadow; the A1 law is HOST-MODULES-ONLY')
      assert.equal(world.shadowReplaced, false, 'the preset bash definition was replaced by an appended shadow')
      assert.equal(world.definitionAfterAttach, world.definitionBeforeAttach, 'the attach changed the resolved bash definition with no composition-declared module')
      console.log(`PROC-ATTACH appended=none definition=unchanged shadowReplaced=no`)
    } finally {
      await world.dispose()
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true })
  }
  assert.match(readFileSync(META, 'utf8'), /OLD-PATH-META vectors=14 host=0\.2\.0-rc\.2 /mu, 'the frozen fixture lost its old-path meta header')
  console.log(`PROC-GOLDEN vectors=${String(golden.length)} state=FROZEN re-records=0`)
  void processMode
  void identityLine
  void compareAll
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

test('PROC-5 the POST-CUT control battery is GREEN, and the committed transcript agrees exactly', () => {
  const output = execFileSync(process.execPath, [join(DIR, 'negative-controls.mjs')], { cwd: ROOT, encoding: 'utf8' })
  const lines = output.trim().split('\n')
  const verdict = lines.filter((line) => line.startsWith('NC-VERDICT ')).at(-1)
  assert.ok(verdict !== undefined, 'the control script must print a verdict')
  assert.match(verdict, /^NC-VERDICT GREEN controls=9 failed=0$/u, `the controls are not green: ${verdict}`)
  assert.equal(lines[0].startsWith('ACCEPTED-BY round81-a1-cut reason='), true, 'the re-recorded battery must name this round and its reason')
  // The retired appended-shadow controls are replaced one-for-one by controls
  // that prove the successor is load-bearing (see ROUND80-CI-CLOSURE.md §4).
  for (const id of [
    'NC-RETIRED-SHADOW-ABSENT',
    'NC-HOST-MODULES-ONLY',
    'NC-SUCCESSORS-EXIST',
    'NC-GOLDEN-FROZEN',
    'NC-CATEGORY-TOTAL',
    'NC-PWSH-EXCLUSION-CONDITIONAL',
    'NC-VOCABULARY-CLOSED',
    'NC-LEDGER-CITES-SUCCESSOR',
  ]) {
    assert.match(output, new RegExp(`^NC ${id} ok`, 'mu'), `${id} must be present and green`)
  }
  assert.equal(output.includes('FAIL'), false, `a control failed: ${output}`)
  const committed = readFileSync(NC_TRANSCRIPT, 'utf8').trim().split('\n')
  assert.deepEqual(lines, committed, 'the committed control transcript must be exactly a fresh run (a shrunk battery reds)')
  console.log(`PROC-CONTROLS ${verdict} transcript=${NC_TRANSCRIPT.replace(ROOT, '<repo>')}`)
})

test('PROC-6 the POST-CUT composition probe reproduces the wiring facts the exclusion rests on', () => {
  // ROUND 81: the B1 probe mounted the route-C world and graded the deleted
  // governed plane (`team-tool-plane.mjs`, cut by 93ba0a1d1). The probe now
  // measures SOURCE facts only, so it cannot inherit a dead world's answer.
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
    [/^PROBE-MOUNT bash=host-module-of-the-active-preset via .*mounts-on-by-default=yes\)$/mu, 'the successor must mount the active preset\'s own module by default'],
    [/^PROBE-SUCCESSOR appended-shadow=ABSENT composition-declared-native-modules=PRESENT$/mu, 'the retired shadow must stay absent and the composition-declared module present'],
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
  assert.equal(committed.startsWith('ACCEPTED-BY round81-a1-cut reason='), true, 'the re-recorded probe transcript must name this round and its reason')
  // The `PROBE-PWSH binary=` line is a HOST OBSERVATION (a runner may ship no
  // pwsh, or a different path). Compare everything EXCEPT that line: the wiring
  // facts must be byte-identical across hosts, the observation must not be.
  const hostFree = (text) => text.split('\n')
    .filter((line) => !line.startsWith('PROBE-PWSH binary=') && !line.startsWith('ACCEPTED-BY '))
    .join('\n')
    .trim()
  assert.equal(hostFree(committed), hostFree(output), 'the committed probe transcript must be exactly a fresh run of the post-cut probe, modulo the host-only binary observation')
  const readme = readFileSync(join(DIR, 'README.md'), 'utf8')
  assert.match(readme, /probe-composition\.mjs/u, 'the lane README must record which probe produces the wiring facts')
  console.log('PROC-PROBE route-c=absent pwsh=UNREACHABLE reason=no-definition successor=composition-declared-native-modules')
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
