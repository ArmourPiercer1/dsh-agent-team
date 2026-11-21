/**
 * lane-suite.test.mjs — the UTE-3 / G1 AGENT-CONTROL lane (stage B1).
 *
 * Lane-run (`node --test`): no boot, no ports, no DSH_HOME, no host tree. Seven
 * checks, each load-bearing:
 *   1. the old path reproduces its reviewed fixture idempotently (two captures,
 *      byte-identical serialization);
 *   2. the fixture speaks only the IMPORTED closed refusal vocabulary;
 *   3. the corpus covers the census unit member-for-member, with every required
 *      vector kind, and declares NO exclusion;
 *   4. the three semantic differences are declared, blocking, unapproved — and
 *      their measurements still hold against the shipped source;
 *   5. the negative controls are GREEN and the committed transcript is exactly
 *      what a fresh run prints (a shrunk battery is a red run);
 *   6. the Stage-0 composition evidence is seven dual members with route-C
 *      serving none — the premise this whole lane rests on;
 *   7. the retirement ledger and the family inventory record this family as
 *      NOT_RETIREABLE with no approval, and the gate refuses it for the
 *      measured reasons.
 *
 * Every assertion is a REPO fact (source content, fixture cells, ledger rows,
 * gate JSON). Nothing asserts this host's shape.
 *
 * @module tests/ute-g1-agentctl/lane-suite
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { COVERED_MEMBERS, CORPUS, REQUIRED_KINDS, kindCoverage } from './lib/corpus.mjs'
import { compareAll, compareRecord, parseGolden, serializeGolden } from './lib/compare.mjs'
import { AGENT_CONTROL_REFUSAL_CATEGORY, CATEGORY_IDS, RUNTIME_REFUSAL_CATEGORY, classifyRefusal } from './lib/effect-oracle.mjs'
import { REPO_ROOT } from './lib/paths.mjs'
import { captureCorpus } from './lib/old-path.mjs'
import { SEMANTIC_DIFFERENCES, measureDifferences, semanticDifferenceLines } from './lib/semantic-differences.mjs'

const GOLDEN = join(REPO_ROOT, 'tests', 'ute-g1-agentctl', 'golden', 'old-path.tsv')
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'ute3-agentctl-b1-20261121')
const CENSUS = join(REPO_ROOT, 'dev', 'agent-workflow', 'ledgers', 'arc-a-family-census.json')

function censusMembers() {
  const census = JSON.parse(readFileSync(CENSUS, 'utf8'))
  const unit = census.families.find((family) => family.familyId === 'dsh.agent-control-family')
  assert.ok(unit !== undefined, 'the census must book dsh.agent-control-family')
  return unit.nativeNames.map((name) => name.replace('(bound-definition) ', ''))
}

test('1. the old path reproduces its reviewed fixture idempotently', async () => {
  const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
  const first = await captureCorpus()
  const second = await captureCorpus()
  assert.equal(serializeGolden(first), serializeGolden(second), 'two captures of the same corpus must be byte-identical')
  const verdict = compareAll(golden, first)
  for (const failure of verdict.failures) console.log(`OLD-PATH-DRIFT ${failure.id} ${failure.field}: golden=${JSON.stringify(failure.golden)} observed=${JSON.stringify(failure.observed)}`)
  assert.deepEqual(verdict.missingObserved, [])
  assert.deepEqual(verdict.missingGolden, [])
  assert.deepEqual(verdict.failures, [])
  assert.equal(golden.length, CORPUS.length)
  console.log(`UTE-G1-AGENTCTL-VERDICT GREEN rows=${golden.length} members=${COVERED_MEMBERS.length}`)
})

test('2. the fixture speaks only the imported closed refusal vocabulary', () => {
  const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
  const declaredCodes = new Set([...Object.keys(AGENT_CONTROL_REFUSAL_CATEGORY), ...Object.keys(RUNTIME_REFUSAL_CATEGORY), 'cancelled', 'unknown-tool'])
  const tokens = new Set(['-', 'lane-deny', 'invalid-argument', 'route-unresolved', 'cancelled'])
  for (const row of golden) {
    if (row.outcome === 'allow') {
      assert.equal(row.refusal, '-', `${row.id}: an allow row must carry no refusal`)
      assert.equal(row.category, '-', `${row.id}: an allow row must carry no category`)
      continue
    }
    assert.ok(tokens.has(row.refusal), `${row.id}: refusal token ${JSON.stringify(row.refusal)} is outside the closed vocabulary`)
    assert.ok(CATEGORY_IDS.includes(row.category), `${row.id}: category ${JSON.stringify(row.category)} is not in the imported CATEGORY_IDS`)
    assert.notEqual(row.category, 'unknown', `${row.id}: the residual category is unreachable`)
    for (const code of row.codes.split(',')) assert.ok(declaredCodes.has(code), `${row.id}: code ${JSON.stringify(code)} was never declared`)
  }
  // The classifier itself refuses an invented code through the IMPORTED error.
  assert.throws(() => classifyRefusal(new Error('refused-agent-control invented — x')), (error) => error.code === 'REFUSAL_VOCABULARY_INCOMPLETE')
  console.log(`UTE-G1-AGENTCTL-VOCABULARY categories=${CATEGORY_IDS.length} codes=${declaredCodes.size}`)
})

test('3. the corpus covers the census unit with every required vector kind and no exclusion', () => {
  const members = censusMembers()
  assert.equal(members.length, 7, 'the census books seven agent-control members')
  assert.deepEqual([...COVERED_MEMBERS].sort(), [...members].sort(), 'the corpus must cover exactly the census members')
  assert.equal(CORPUS.length, 42, 'six vectors per member')
  const coverage = kindCoverage()
  for (const member of members) {
    for (const [kind] of Object.entries(REQUIRED_KINDS)) {
      assert.ok(coverage[member][kind].length > 0, `${member} has no ${kind} vector`)
    }
  }
  const ids = CORPUS.map((vector) => vector.id)
  assert.equal(new Set(ids).size, ids.length, 'vector ids are unique')
  // The declared exclusion set is EMPTY, and `capture-old-path.mjs` prints it.
  const capture = readFileSync(join(REPO_ROOT, 'tests', 'ute-g1-agentctl', 'capture-old-path.mjs'), 'utf8')
  assert.match(capture, /const EXCLUSIONS = Object\.freeze\(\[\]\)/u, 'the exclusion set must stay declared-and-empty')
  console.log(`UTE-G1-AGENTCTL-COVERAGE members=${members.length} vectors=${CORPUS.length} exclusions=0`)
})

test('4. the three semantic differences are declared, blocking, unapproved and still measured', () => {
  assert.equal(SEMANTIC_DIFFERENCES.length, 3)
  for (const difference of SEMANTIC_DIFFERENCES) {
    assert.equal(difference.blocking, true, `${difference.id} must stay blocking`)
    assert.equal(difference.approval, null, `${difference.id} must carry no approval record`)
    assert.ok(semanticDifferenceLines().includes(semanticDifferenceLineOf(difference)))
  }
  const measurements = measureDifferences()
  assert.deepEqual(measurements.map((m) => m.id), SEMANTIC_DIFFERENCES.map((d) => d.id), 'every declared difference has a measurement')
  for (const measurement of measurements) {
    assert.equal(measurement.holds, true, `${measurement.id} no longer holds: ${JSON.stringify(measurement.facts)}`)
    console.log(`SEMANTIC-DIFF ${measurement.id} holds=yes facts=${JSON.stringify(measurement.facts)}`)
  }
  for (const line of semanticDifferenceLines()) console.log(line)
})

function semanticDifferenceLineOf(difference) {
  return `SEMANTIC-DIFF id=${difference.id} blocking=${difference.blocking ? 'yes' : 'no'} approval=${difference.approval === null ? 'none' : difference.approval}`
}

test('5. the negative controls are green and the committed transcript is a fresh run', () => {
  const fresh = execFileSync(process.execPath, [join(REPO_ROOT, 'tests', 'ute-g1-agentctl', 'negative-controls.mjs')], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  const freshLines = fresh.split('\n').filter((line) => line.length > 0 && !line.startsWith('[dsh-agent-team] '))
  assert.ok(freshLines.includes('NC-VERDICT GREEN controls=24 failed=0'), `the battery must be green: ${freshLines.filter((line) => line.startsWith('NC-VERDICT')).join(' | ')}`)
  const memberLines = freshLines.filter((line) => line.startsWith('NC-MEMBER '))
  assert.equal(memberLines.length, 7, 'one NC-MEMBER line per member')
  for (const member of censusMembers()) assert.ok(memberLines.some((line) => line.split(' ')[1] === member), `missing NC-MEMBER line for ${member}`)
  const committed = readFileSync(join(EVIDENCE, 'negative-controls.txt'), 'utf8').split('\n').filter((line) => line.length > 0)
  const freshBody = freshLines.filter((line) => !line.startsWith('NC-TRANSCRIPT '))
  assert.deepEqual(freshBody, committed, 'the committed negative-control transcript must be exactly a fresh run (no shrunk battery)')
  console.log('NC-VERDICT GREEN controls=24 failed=0')
})

test('6. the Stage-0 evidence is seven dual members and route-C serves none', () => {
  const probe = readFileSync(join(EVIDENCE, 'composition-probe.txt'), 'utf8')
  const members = censusMembers()
  for (const member of members) {
    assert.ok(probe.includes(`PROBE-AGENTCTL member=${member} two-implementations=yes`), `the probe must book ${member} as two implementations`)
    assert.ok(!probe.includes(`PROBE-AGENTCTL member=${member} single-implementation=yes`), `${member} must not be booked as single`)
  }
  assert.match(probe, /PROBE-CONCLUSION booked-members=7 single=0 dual=7/u)
  // Route-C: every member registered=no / reachable=no, with zero provider and
  // guard activity (the `unknown tool` refusal is recorded on the same line).
  for (const member of members) {
    assert.ok(probe.includes(`PROBE-ROUTE-C ${member} registered=no reachable=no refusal="Error: unknown tool \\"${member}\\""`), `route-C must refuse ${member} as an unknown tool`)
    assert.ok(probe.includes(`PROBE-ROUTE-C ${member} providerCalls=0 inheritedServiceCalls=0 guardFacts=0`), `route-C must record zero provider/guard activity for ${member}`)
  }
  assert.match(probe, /PROBE-PLANE familyId=dsh\.agent-control-family .*claims=subagent,subagent_fork,send_message,interrupt_agent,list_agents,list_subagent_models,workflow/u)
  assert.match(probe, /PLANE_SUPPORTED_NATIVE_TAKEOVERS classes=\[bash,read,grep,glob,write,edit,read_image,jobs\] agent-control-class=ABSENT/u)
  assert.match(probe, /family-assembly-reserved-native-references=0/u)
  // Re-derive the two static facts from the shipped source, not the transcript.
  const descriptor = readFileSync(join(REPO_ROOT, 'packages', 'tools', 'families', 'agent-control.mjs'), 'utf8')
  for (const member of members) assert.ok(descriptor.includes(`name: '${member}'`), `the descriptor must define ${member}`)
  console.log(`PROBE-CONCLUSION booked-members=${members.length} single=0 dual=${members.length}`)
})

test('7. the ledger and inventory record NOT_RETIREABLE with no approval, and the gate refuses it', () => {
  const ledger = JSON.parse(readFileSync(join(REPO_ROOT, 'dev', 'agent-workflow', 'ledgers', 'ute-retirement.json'), 'utf8'))
  const row = ledger.families.find((family) => family.family === 'agent-control')
  assert.ok(row !== undefined, 'the retirement ledger must carry the agent-control row')
  assert.equal(row.state, 'NOT_RETIREABLE')
  assert.equal(row.approval ?? null, null, 'a retired family would need an approval; none exists')
  // MEASURED truth, term by term: the baseline and the controls are real and
  // established; the new path does not exist and the differences are open, so
  // retirement is refused. A blanket "all false" would be as dishonest as a
  // blanket "all true".
  assert.equal(row.unit.familyId, 'dsh.agent-control-family')
  assert.deepEqual(row.unit.members, censusMembers(), 'unit.members must be the DERIVED census unit')
  assert.equal(row.terms.oldBaseline.verdict, true, 'the 42-vector baseline is established')
  assert.equal(row.terms.newPathVerified.verdict, false, 'there is no confined new path at B1')
  assert.equal(row.terms.semanticDifferencesResolved.verdict, false, 'three differences remain open and unapproved')
  assert.equal(row.terms.negativeControlsPass.verdict, true, '24 controls are green')
  const differences = row.terms.semanticDifferencesResolved.differences ?? []
  assert.equal(differences.length, 3, 'all three measured differences are booked blocking')
  for (const difference of differences) {
    assert.equal(difference.blocking, true)
    assert.equal(difference.approval ?? null, null)
  }
  const inventory = JSON.parse(readFileSync(join(REPO_ROOT, 'dev', 'agent-workflow', 'ledgers', 'ute-family-inventory.json'), 'utf8'))
  const unit = inventory.families.find((family) => family.familyId === 'dsh.agent-control-family')
  assert.ok(unit !== undefined)
  assert.deepEqual(unit.retirementReadiness, { baseline: 'complete', newPath: 'none', negativeControls: 'complete' })
  const gateRun = spawnSync(process.execPath, [join(REPO_ROOT, 'scripts', 'ute-retirement-gate.mjs'), '--family', 'agent-control', '--json'], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  // A refusal is the EXPECTED outcome, and the gate's convention is exit 1 for
  // it: assert that convention rather than swallowing either signal.
  assert.equal(gateRun.status, 1, `the gate must exit 1 when it refuses a family: ${gateRun.stderr}`)
  const gate = JSON.parse(gateRun.stdout)
  assert.equal(gate.requested, 1)
  assert.equal(gate.allowed.length, 0, 'no family may be allowed to retire')
  assert.equal(gate.refused.length, 1, 'the one requested family must be refused')
  const codes = new Set(gate.refused[0].codes)
  for (const code of ['UTE_NEW_PATH_UNVERIFIED', 'UTE_SEMANTIC_DIFFERENCES_UNRESOLVED', 'UTE_VECTOR_UNREPRODUCED', 'UTE_MEMBER_UNCOVERED']) {
    assert.ok(codes.has(code), `the gate must refuse the measured term ${code}; got ${[...codes].join(',')}`)
  }
  console.log(`UTE-G1-AGENTCTL-RETIREMENT state=${row.state} refused=${[...codes].length} codes=${[...codes].sort().join(',')}`)
})
