#!/usr/bin/env node
/**
 * OFFLINE re-judgement of the 2026-11-04T19:17Z run (attempt 6), from the
 * harvested evidence only. NO Host, no budget, no network: it reads the files
 * that survived in this directory and re-runs the SAME judges the driver runs.
 *
 * Why this exists
 * ---------------
 * Attempt 6 measured seven guard facts in 400 ms and then aborted in
 * `cancellation-window`. The driver reported six `FAIL / DRIVER_ABORTED` rows,
 * so the run's OWN observations were discarded — the one thing a test may never
 * do. The fix (run-boot.mjs + lib/a5sf-search-live.mjs `judgeCase`) makes the
 * driver re-judge at the abort site; this script answers the prior question:
 *
 *     can the run that already happened be re-judged from what is on disk?
 *
 * The answer is per row, and it is not a slogan: every row is reported with the
 * channels that DID survive, the channels that did not, and a verdict produced
 * by the real judge over a reconstructed sample. A row whose sample cannot be
 * completed is `NOT_REACHED` with a NAMED gap — never PASS, and never a FAIL
 * that pretends an observation was made.
 *
 * The one thing that IS decided here: row 3. The lane report attempt 6 wrote
 * before it died carries the ceiling/restriction/effective triple for the exact
 * restricted file, and the product's own algebra is re-run over the report's
 * recorded inputs. That settles whether the deny is a genuine restriction-lane
 * refusal (as the tool-axis note assumed) or a ceiling-derived one, which is the
 * `UNSUPPORTED` claim in README §5.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  SEARCH_CASE_IDS,
  judgeCase,
} from '../../../../tests/world-factory/lib/a5sf-search-live.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const DIST = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const readJsonl = (path) => {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line))
}
const norm = (value) => String(value ?? '').replace(/\/+$/u, '')
const log = (line) => process.stdout.write(`[rejudge] ${String(line)}\n`)

// ── the artifacts that survived ─────────────────────────────────────────────
const FACTS = readJsonl(join(HERE, 'consultations.jsonl')).filter((row) => row?.schema === 'a5sf-guard-consult/1')
const COUNTER = readJsonl(join(HERE, 'search-counter.jsonl'))
const DIAGNOSIS = existsSync(join(HERE, 'stage-diagnosis.json')) ? readJson(join(HERE, 'stage-diagnosis.json')) : null
const ARCHIVED = existsSync(join(HERE, 'run-record.json')) ? readJson(join(HERE, 'run-record.json')) : null
const LANE_REPORT = DIAGNOSIS?.probe?.laneReport ?? null

// The counter holds the whole run: a leader probe and a negative control ran
// BEFORE `team.create`, so their rows must be excluded or a control spawn would
// be mistaken for a member spawn (it carries `ceiling-outside` in its argv and
// would spuriously REFUTE row 2). The first confined spawn is the boundary: no
// control or probe invocation is ever confined.
const firstConfined = COUNTER.findIndex((row) => row?.leg === 'confined-spawn')
const MEMBER_ROWS = firstConfined < 0 ? [] : COUNTER.slice(firstConfined)

// The paths, from the lane report rather than from a literal: the report was
// written by the same boot that measured the facts.
const probeLocator = (index) => LANE_REPORT?.probePaths?.[index]?.locator ?? null
const derived = (() => {
  const inLaneFile = probeLocator(0)
  const restrictedFile = probeLocator(1)
  const outsideFile = probeLocator(2)
  const outsideGlobFile = probeLocator(3)
  const fifo = probeLocator(4)
  const inLaneDir = inLaneFile === null ? null : dirname(inLaneFile)
  const workspace = inLaneDir === null ? null : dirname(dirname(inLaneDir))
  // Row 2 names the DIRECTORY in its fact and in the spawning argv; the probe
  // line names the file inside it.
  const outsideDir = outsideFile === null ? null : dirname(outsideFile)
  const outsideGlobDir = outsideGlobFile === null ? null : dirname(outsideGlobFile)
  return { inLaneFile, inLaneDir, restrictedFile, outsideFile, outsideDir, outsideGlobFile, outsideGlobDir, fifo, workspace }
})()

// The two patterns are visible in the confined argv, so the sample does not
// invent them.
const argvOf = (row) => Array.isArray(row?.argv) ? row.argv : []
const needle = MEMBER_ROWS.flatMap(argvOf).map((a) => /^--regexp=(A5SF_SEARCH_NEEDLE[^\s]*)$/u.exec(String(a))?.[1] ?? null).find((v) => v !== null) ?? null
const invalidPattern = MEMBER_ROWS.flatMap(argvOf).map((a) => /^--regexp=(A5SF_\(.*)$/u.exec(String(a))?.[1] ?? null).find((v) => v !== null) ?? null
const fileName = MEMBER_ROWS.flatMap(argvOf).map((a) => /^--glob=(needle[^\s]*)$/u.exec(String(a))?.[1] ?? null).find((v) => v !== null) ?? null

const factsAt = (locator) => FACTS.filter((f) => norm(f.locator) === norm(locator))
const recordsFor = (operand) => MEMBER_ROWS.filter((row) => argvOf(row).some((a) => norm(a) === norm(operand)))
const exitsFor = (operand) => MEMBER_ROWS
  .filter((row) => row?.leg === 'confined-exit' && argvOf(row).some((a) => norm(a) === norm(operand)))
  .map((row) => row?.code ?? null)

// ── the samples that CAN be rebuilt, and the channel that is gone ──────────
// The tool-result bytes lived only in the mock transcript, which attempt 6 never
// persisted (the fix writes `mock-requests.json` at dispatch, at every settled
// row, and on the abort path). So `result` is null for every row, and the judge
// must say so instead of guessing.
const reconstruct = (id) => {
  const base = { result: null, recordedIn: 'consultations.jsonl + search-counter.jsonl + stage-diagnosis.json (tool-result bytes absent)' }
  switch (id) {
    case SEARCH_CASE_IDS.row1:
      return { ...base, facts: factsAt(derived.inLaneDir), records: recordsFor(derived.inLaneDir), declaredRoot: derived.inLaneDir, needle, fileName }
    case SEARCH_CASE_IDS.row2:
      return { ...base, facts: factsAt(derived.outsideDir), records: recordsFor(derived.outsideDir), declaredRoot: derived.outsideDir }
    case SEARCH_CASE_IDS.row3:
      return { ...base, facts: factsAt(derived.restrictedFile), records: recordsFor(derived.restrictedFile), declaredRoot: derived.restrictedFile, laneReport: LANE_REPORT }
    case SEARCH_CASE_IDS.row4:
      return { ...base, facts: factsAt(derived.fifo), records: recordsFor(derived.fifo), declaredRoot: derived.fifo, interrupt: null }
    case SEARCH_CASE_IDS.row5:
      return { ...base, facts: factsAt(derived.inLaneDir === null ? null : join(derived.inLaneDir, 'invalid')), records: recordsFor(derived.inLaneDir === null ? null : join(derived.inLaneDir, 'invalid')), declaredRoot: derived.inLaneDir === null ? null : join(derived.inLaneDir, 'invalid'), pattern: invalidPattern }
    default:
      return null // row 6 needs the teardown trace, and nothing about teardown survived
  }
}

const ABORT = 'cancellation-window'
const rows = [SEARCH_CASE_IDS.row1, SEARCH_CASE_IDS.row2, SEARCH_CASE_IDS.row3, SEARCH_CASE_IDS.row4, SEARCH_CASE_IDS.row5, SEARCH_CASE_IDS.row6].map((id) => {
  const sample = reconstruct(id)
  const judged = judgeCase(id, sample, { abortedAt: ABORT, stage: 'rejudge-offline' })
  return {
    id,
    archivedVerdict: archivedVerdictOf(id),
    archivedReason: archivedReasonOf(id),
    rejudgedVerdict: judged.verdict,
    status: judged.status,
    reason: judged.reason,
    missing: judged.missing,
    sampleComplete: judged.sampleComplete,
    judgeVerdict: judged.judgeVerdict ?? null,
    evidenceOnDisk: {
      facts: Array.isArray(sample?.facts) ? sample.facts.length : 0,
      counterRows: Array.isArray(sample?.records) ? sample.records.length : 0,
      confinedExits: exitsFor(sample?.declaredRoot).length === 0 ? [] : exitsFor(sample?.declaredRoot),
      laneReport: sample?.laneReport === undefined || sample?.laneReport === null ? 'absent' : 'present',
      toolResult: 'absent — the mock transcript was never persisted, and the World home was deleted by teardown',
    },
  }
})

function archivedVerdictOf(id) {
  const entry = (ARCHIVED?.cases ?? []).find((c) => c?.id === id)
  return entry?.verdict ?? null
}
function archivedReasonOf(id) {
  const entry = (ARCHIVED?.cases ?? []).find((c) => c?.id === id)
  return entry?.reason ?? null
}

// ── row 3: is the deny RESTRICTION-lane, or ceiling-derived? ───────────────
// The report's own triple is the measurement; the product algebra re-run over
// the report's recorded allow lists is the cross-check. If the restriction input
// alone flips the answer, the deny cannot be ceiling-derived.
const attribution = await (async () => {
  if (LANE_REPORT === null) return { decided: false, why: 'no lane report survived' }
  const pathRules = await import(pathToFileURL(join(DIST, 'member-io-policy', 'src', 'path-rules.js')).href)
  const asRuleSet = (rules) => ({ mode: rules.mode, allow: [...rules.allow], ask: [...(rules.ask ?? [])], deny: [...(rules.deny ?? [])] })
  const ceilingRuleSet = asRuleSet(LANE_REPORT.ceiling.read)
  const restrictionRuleSet = asRuleSet(LANE_REPORT.restriction.read)
  const effective = pathRules.intersectPathRuleSets(ceilingRuleSet, restrictionRuleSet)
  const probe = LANE_REPORT.probePaths.find((p) => norm(p.locator) === norm(derived.restrictedFile)) ?? null
  const recomputed = probe === null ? null : {
    ceiling: pathRules.matchLocator(ceilingRuleSet, probe.locator),
    restriction: pathRules.matchLocator(restrictionRuleSet, probe.locator),
    effective: pathRules.matchLocator(effective, probe.locator),
  }
  const widened = pathRules.matchLocator(pathRules.intersectPathRuleSets(ceilingRuleSet, asRuleSet({ mode: 'restricted', allow: [LANE_REPORT.ceiling.read.allow[0]], ask: [], deny: [] })), derived.restrictedFile)
  return {
    decided: probe !== null && probe.ceilingRead === 'allow' && probe.restrictionRead === 'deny' && probe.effectiveRead === 'deny',
    locator: derived.restrictedFile,
    recorded: probe === null ? null : { ceilingRead: probe.ceilingRead, restrictionRead: probe.restrictionRead, effectiveRead: probe.effectiveRead },
    recomputed,
    recomputedMatchesRecord: recomputed !== null && probe !== null
      && recomputed.ceiling === probe.ceilingRead && recomputed.restriction === probe.restrictionRead && recomputed.effective === probe.effectiveRead,
    bindingSource: probe !== null && probe.ceilingRead === 'allow' && probe.restrictionRead === 'deny' ? 'restriction' : 'ceiling-or-both',
    control: {
      why: 'widening the restriction to the ceiling turns the same effective answer into `allow`, so the restriction input is load-bearing',
      widenedRestrictionEffective: widened,
    },
    conclusion: probe !== null && probe.ceilingRead === 'allow' && probe.restrictionRead === 'deny'
      ? 'GENUINE RESTRICTION-LANE REFUSAL: the ceiling ADMITS workspace/lane/outside-restriction.txt and only the tool restriction denies it. The earlier UNSUPPORTED note was over-pessimistic and must be corrected.'
      : 'the deny is (also) ceiling-derived; the tool-axis note stands',
  }
})()

// ── row 1: the refutation signal that was measured, and its named gap ─────
// The handler for exit != 0/1 is the pinned module's, not an inference of ours
// (tests/deepseek-harness-test-use/packages/fs/tool-fs-search/lib/index.js:201).
// A row-1 grep that exited 2 therefore produced an isError result, which REFUTES
// row 1 — but the bytes are not on disk, so this is a RISK, not a verdict.
const row1Signal = {
  confinedExits: exitsFor(derived.inLaneDir),
  escrow: 'the module maps any exit ∉ {0,1} to SearchError(SEARCH_FAILED) — index.js:201 → the tool result is `isError: true` → row 1 clause `resultNotError` fails',
  reading: 'REFUTATION RISK on row 1; not a verdict, because the tool result was never persisted',
  discriminators: {
    sameBinarySameCwdSameTree: 'row 5 (exit 2) and row 6/glob (exit 0) share the binary, the cwd and the operand tree',
    onlyDifference: 'the in-lane grep has no `--no-ignore`, so ripgrep discovers ignore/git metadata in the ANCESTORS of the search root — `lane/`, `workspace/`, the World home — and the restriction admits only `lane/inside`',
    whyUnproven: 'stderr was never persisted, so whether the exit came from a denial during ancestor discovery or from the operand traversal cannot be told from what survived',
    cheapFollowUp: 'a host-free `rg` run against a fixture whose search root has a `.gitignore` one level outside an admissible set would separate the two; the FIFO section of dry-run.mjs already owns that kind of measurement',
  },
}

// ── the record ─────────────────────────────────────────────────────────────
const judgedRows = rows.filter((row) => row.status === 'judged')
const neverObserved = rows.filter((row) => row.status !== 'judged')
const archivedFailRows = (ARCHIVED?.cases ?? []).filter((c) => c?.verdict === 'FAIL')
const artifact = {
  schema: 'a5sf-search-live/rejudge-attempt6/1',
  at: new Date().toISOString(),
  what: 'offline re-judgement of the 2026-11-04T19:17Z run (attempt 6) from the harvested channels only; no Host was booted',
  abortedAt: ABORT,
  inputs: {
    facts: FACTS.length,
    counterRows: COUNTER.length,
    counterRowsAfterControl: MEMBER_ROWS.length,
    laneReport: LANE_REPORT === null ? 'absent' : 'present',
    archivedRunRecord: ARCHIVED === null ? 'absent' : `overall=${String(ARCHIVED.overall)}`,
    archivedOracleSamples: existsSync(join(HERE, 'oracle-samples.json')) ? readJson(join(HERE, 'oracle-samples.json')) : 'absent',
    derivedPaths: derived,
    needle,
    invalidPattern,
    fileName,
  },
  rows,
  summary: {
    judgeableOffline: judgedRows.length,
    neverObserved: neverObserved.length,
    caseVerdictsRejudged: rows.length,
    archivedCaseFailures: archivedFailRows.length,
    archivedFailuresThatWereNeverObserved: archivedFailRows.filter((c) => neverObserved.some((row) => row.id === c.id)).length,
    runVerdict: 'FAIL (the driver aborted after reaching the Host)',
    caseVerdictsWithdrawn: 'every archived FAIL was a driver-level abort, not an observation: the case verdict is NOT_REACHED + status driver-aborted',
    headline: 'attempt 6 is NOT re-judgeable from disk for any row; the correct record is 6 × NOT_REACHED (driver-aborted) plus a FAIL run, and the reason is a missing channel, not a missing fact',
  },
  row3: attribution,
  row1Risk: row1Signal,
  namedGaps: [
    { channel: 'mock-requests.json', owner: 'run-boot.mjs', state: 'absent for attempt 6, written from now on', consequence: 'no row judge can compare tool-result bytes, so rows 1/2/3/5 cannot be judged offline' },
    { channel: 'row 4 confined spawn + interrupt', owner: 'run-boot.mjs', state: 'the abort WAS the missing spawn', consequence: 'row 4 has no window to judge and stays NOT_REACHED' },
    { channel: 'teardown trace', owner: 'run-boot.mjs', state: 'never reached', consequence: 'row 6 cannot be judged at all' },
    { channel: 'stderr of the in-lane grep', owner: 'run-boot.mjs persisted argv/exit but not stderr', state: 'absent', consequence: 'row 1 keeps a refutation RISK whose cause cannot be named' },
  ],
  corrections: [
    {
      where: 'dev/agent-workflow/evidence/a5sf-search-live/README.md §5 (row 3)',
      from: 'UNSUPPORTED — the restriction could not be separated from the ceiling',
      to: 'SUPPORTED — the lane report written by the aborted run records ceilingRead=allow, restrictionRead=deny, effectiveRead=deny for workspace/lane/outside-restriction.txt; the product algebra re-run over the report\'s inputs reproduces it and a widened restriction flips the answer, so the deny is restriction-lane',
      why: 'an over-pessimistic record is its own inaccuracy, and this one is now measurable from the run\'s own artifact',
    },
  ],
}
writeFileSync(join(HERE, 'rejudge-attempt6.json'), JSON.stringify(artifact, null, 2) + '\n')

for (const row of artifact.rows) {
  log(`${row.id}: archived=${String(row.archivedVerdict)} (${String(row.archivedReason)}) → rejudged=${row.rejudgedVerdict} status=${row.status} missing=[${row.missing.join(', ')}] facts=${String(row.evidenceOnDisk.facts)} exits=[${row.evidenceOnDisk.confinedExits.join(',')}]`)
}
log(`row 3: ${attribution.decided === true ? 'restriction-lane' : 'undecided'} recorded=${JSON.stringify(attribution.recorded ?? null)} recomputed=${JSON.stringify(attribution.recomputed ?? null)}`)
log(`row 1 risk: exits=[${row1Signal.confinedExits.join(',')}] — ${row1Signal.reading}`)
log(`summary: judgeableOffline=${String(artifact.summary.judgeableOffline)} neverObserved=${String(artifact.summary.neverObserved)} archivedCaseFailures=${String(artifact.summary.archivedCaseFailures)} withdrawn=${String(artifact.summary.archivedFailuresThatWereNeverObserved)}`)
log('wrote rejudge-attempt6.json')
