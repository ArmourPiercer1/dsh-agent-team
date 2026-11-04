#!/usr/bin/env node
/**
 * row6-replay.mjs — host-free re-judgement of the archived Search row 6.
 *
 * WHAT THIS IS: the cheapest honest reproduction of the row-6 failure. The
 * driver archived, for each run, the exact `postStopDispatches`, `probeFacts`,
 * `membersAfterArchive`, stop instant and process seam; this script hands
 * those archived bytes back to the SHIPPED judge (`judgeRow6`) and prints the
 * clause that is false and the dispatch it refers to. No Host is booted and
 * nothing is re-run; the verdict is computed from what the run measured.
 *
 * WHAT IS RECONSTRUCTED (and why): `oracle-samples.json` stores a DISPLAY copy
 * of the row-6 sample — `membersAfter` and `observations` are reduced to
 * counts, so re-judging that copy would falsify `archivedLifecycle`. This
 * script therefore takes those two fields from `teardown.json` (full array) and
 * the stop instant from `run-record.json` (detail), and takes the remaining
 * fields from the oracle sample. `confinedSpawnsAfterStop` /
 * `baseSpawnsAfterStop` survive only as COUNTS in the run record (the counter
 * rows for the probes were written to the World home, which teardown deletes);
 * the judge consumes only their length, which is exactly what the count is.
 *
 * Usage: node row6-replay.mjs [sampleDir ...]
 *   default = the two archived sample dirs under ./row6-samples/
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { judgeRow6, SEARCH_CASE_IDS } from '../../../../tests/world-factory/lib/a5sf-search-live.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROW6 = SEARCH_CASE_IDS.row6
<<<<<<< HEAD
=======
// The two archived runs predate the 2026-11-05 wording fix that renamed the
// row to `...-archive-boundary-...` (the temporal bound is the archive commit,
// not world.teardown()). The archived bytes are history and are NOT rewritten:
// look the old id up as a legacy alias.
const LEGACY_ROW6 = 'live:search-row6-teardown-no-callable-shadow'
const row6Id = (cases) => {
  const id = Object.keys(cases ?? {}).find((key) => key === ROW6)
    ?? Object.keys(cases ?? {}).find((key) => key === LEGACY_ROW6)
  return id
}
>>>>>>> origin/master
const json = (path) => JSON.parse(readFileSync(path, 'utf8'))

function replay(dir) {
  const record = json(join(dir, 'run-record.json'))
  const teardown = json(join(dir, 'teardown.json'))
  const oracle = json(join(dir, 'oracle-samples.json'))
<<<<<<< HEAD
  const row6Case = record.cases.find((c) => c.id === ROW6)
  if (row6Case === undefined) throw new Error(`${dir}: run record has no row 6`)
  const archivedSample = oracle.cases[ROW6]?.sample
=======
  const runId = row6Id(Object.fromEntries((record.cases ?? []).map((c) => [c.id, c])))
  const row6Case = record.cases.find((c) => c.id === runId)
  if (row6Case === undefined) throw new Error(`${dir}: run record has no row 6`)
  const oracleId = row6Id(oracle.cases)
  const archivedSample = oracle.cases[oracleId]?.sample
>>>>>>> origin/master
  if (archivedSample === undefined) throw new Error(`${dir}: no archived oracle sample for row 6`)

  const member = archivedSample.member
  const sample = {
    member,
    archive: teardown.archive,
    membersAfter: teardown.membersAfterArchive,
    postStopDispatches: teardown.postStopDispatches,
    facts: archivedSample.facts,
    probeFacts: teardown.probeFacts,
    stopInstant: row6Case.detail.stopInstant,
    observations: teardown.observations,
    managed: { sessionId: member.childSessionId, realmLabel: `member:${member.instanceId}` },
    duringManagedDisposal: true,
    managedRealmCount: 1,
    // the process seam the driver measured AFTER world.teardown()
    hostAlive: row6Case.detail.host.hostAlive,
    portStillListening: teardown.processSeam.portStillListening,
    homeDeleted: teardown.processSeam.homeExistsAfterTeardown === false,
    orphanPids: teardown.processSeam.orphanPids,
    // counts only (see the header): the judge reads length
    confinedSpawnsAfterStop: new Array(Number(row6Case.detail.confinedSpawnsAfterStop ?? 0)),
    baseSpawnsAfterStop: new Array(Number(row6Case.detail.baseSpawnsAfterStop ?? 0)),
  }

  const judged = judgeRow6(sample)

  // The falsifying dispatch, named explicitly rather than derived from the
  // failure list: a 200 with body.ok === true is a SERVED call.
  const served = sample.postStopDispatches
    .map((reply, index) => ({ index, reply }))
    .filter(({ reply }) => reply !== null && reply !== undefined && reply.status === 200 && reply.body?.ok === true)
    .map(({ index, reply }) => ({
      index,
      method: index === 0 ? 'grep' : index === 1 ? 'glob' : 'unknown',
      status: reply.status,
      bodyOk: reply.body?.ok ?? null,
      value: reply.body?.value ?? null,
      errorCode: reply.body?.error?.info?.code ?? null,
      dispatchedBy: '/__p6t6/tool -> live.executeTool(member.childSessionId)',
    }))

  return {
    dir,
    runId: record.runId,
    archivedVerdict: { verdict: row6Case.verdict, reason: row6Case.reason, failed: row6Case.failed },
    replayedVerdict: { verdict: judged.verdict, reason: judged.reason, failed: judged.failed, checks: judged.checks },
    stopInstant: sample.stopInstant,
    archive: { status: teardown.archive?.status ?? null, ok: teardown.archive?.body?.ok ?? null, effect: teardown.archive?.body?.value?.effect ?? null },
    membersAfter: sample.membersAfter.map((m) => ({ instanceId: m.instanceId, templateId: m.templateId, lifecycle: m.lifecycle })),
    served,
    postStop: sample.postStopDispatches.map((reply, index) => ({
      index,
      status: reply?.status ?? null,
      ok: reply?.body?.ok ?? null,
      code: reply?.body?.error?.info?.code ?? null,
    })),
    probeFacts: sample.probeFacts.map((f) => ({ decision: f.decision, decidedBy: f.decidedBy, realm: f.realm, method: f.method, observedAt: f.observedAt })),
    // independent arithmetic for the three clauses the task names
    clause: {
      everyDispatchExplained:
        'unexplained = postStopDispatches not in { 422, 500, 200-with-body.ok===false } -> ' +
        JSON.stringify(sample.postStopDispatches.map((r) => r === null ? null : (r.status === 422 || r.status === 500 || (r.status === 200 && r.body?.ok === false)))),
      noSuccessAfterStop: 'successes = 200-with-body.ok===true -> index ' + JSON.stringify(served.map((s) => s.index)),
      probeFactsAreRefusals: 'probe facts must all be deny (or none) -> ' + JSON.stringify(sample.probeFacts.map((f) => f.decision)),
    },
  }
}

const dirs = process.argv.length > 2
  ? process.argv.slice(2).map((p) => resolve(p))
  : [
      join(HERE, 'row6-samples', '2026-11-04T20-10-19Z'),
      join(HERE, 'row6-samples', '2026-11-04T20-17-23Z'),
    ]
const results = dirs.map(replay)
for (const result of results) {
  console.log(`\n== ${result.runId}  (${result.dir})`)
  console.log(`archived verdict: ${result.archivedVerdict.verdict} / ${result.archivedVerdict.reason} failed=${JSON.stringify(result.archivedVerdict.failed)}`)
  console.log(`replayed verdict: ${result.replayedVerdict.verdict} / ${result.replayedVerdict.reason} failed=${JSON.stringify(result.replayedVerdict.failed)}`)
  console.log(`stopInstant=${result.stopInstant} archive=${JSON.stringify(result.archive)}`)
  console.log(`membersAfter=${JSON.stringify(result.membersAfter)}`)
  console.log(`postStop=${JSON.stringify(result.postStop)}`)
  console.log(`served=${JSON.stringify(result.served)}`)
  console.log(`probeFacts=${JSON.stringify(result.probeFacts)}`)
  console.log(`clause=${JSON.stringify(result.clause)}`)
}
const identical = results.every((r) => JSON.stringify(r.replayedVerdict.failed) === JSON.stringify(results[0].replayedVerdict.failed))
console.log(`\nsame failed-clause set across ${results.length} run(s): ${identical}`)
