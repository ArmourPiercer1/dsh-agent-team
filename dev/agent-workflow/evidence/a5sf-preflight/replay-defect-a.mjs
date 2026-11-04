#!/usr/bin/env node
/**
 * replay-defect-a.mjs — HOST-FREE reproduction of the boot-2 row-6 FAIL.
 *
 *   node dev/agent-workflow/evidence/a5sf-preflight/replay-defect-a.mjs
 *
 * Boot 2 (2026-11-04T08:19Z) reported `noFactAfterStop: false` although the
 * README's "complete live sink" (8 facts) ends at 08:19:25.470Z, ~1.8 s BEFORE
 * the recorded stop instant 08:19:27.285Z. This script replays the exact
 * decision the driver made, from committed evidence only (no Host, no World):
 *
 *   A. `consultations.jsonl` (the 8-fact file the record calls the live sink)
 *      + the stop instant from `run-record.json`  -> what a naive replay sees;
 *   B. the LIVE SAMPLE the driver actually handed to `judgeRow6`
 *      (`oracle-samples.json` -> row6 -> sample.facts): 10 facts. Two of them
 *      are AFTER the stop, which is why the live verdict was REFUTED;
 *   C. attribution: the two extra facts are `stat`/`deny`/`binding` at b.txt —
 *      the exact target of the row's own two post-stop probe dispatches
 *      (`teardown.json` -> `refusalCodesAfterStop`, 2 refusals);
 *   D. the repaired input split (`factsAtStop` + `probeFacts`) -> the temporal
 *      bound holds and the probe facts are separately required to be refusals.
 *
 * The comparison itself is NOT the defect: in A every fact precedes the stop
 * and the judge PROVES. The defect was the SAMPLE: the driver re-read the sink
 * AFTER dispatching its own post-stop probes, so the row's stimulus appeared as
 * evidence against the product.
 *
 * @module dev/agent-workflow/evidence/a5sf-preflight/replay-defect-a
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { judgeRow6 } from '../../../../tests/world-factory/lib/a5sf-acceptance-preflight.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const readJson = (name) => JSON.parse(readFileSync(join(HERE, name), 'utf8'))
const readJsonl = (name) => readFileSync(join(HERE, name), 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line))

const sink = readJsonl('consultations.jsonl')
const record = readJson('run-record.json')
const samples = readJson('oracle-samples.json')
const teardown = readJson('teardown.json')

const row6Record = record.cases.find((entry) => String(entry.id ?? '').includes('row6'))
const row6Live = samples.cases['live:row6-teardown-no-usable-unconstrained-shadow']
const stopInstant = row6Record.stopInstant
const liveFacts = row6Live.sample.facts
const factsAtStop = liveFacts.filter((fact) => Date.parse(fact.observedAt) <= Date.parse(stopInstant))
const factsAfterStop = liveFacts.filter((fact) => Date.parse(fact.observedAt) > Date.parse(stopInstant))
const sameAsSink = JSON.stringify(factsAtStop) === JSON.stringify(sink)
const probeTargetsAreB = factsAfterStop.every((fact) => String(fact.locator).endsWith('/axis/b.txt'))

// The row-6 sample minus the fact array (the judge does not re-derive it).
const base = {
  member: row6Live.sample.member,
  archive: row6Live.sample.archive,
  membersAfter: teardown.membersAfterArchive,
  observations: [],
  managed: row6Live.sample.managed,
  duringManagedDisposal: true,
  managedRealmCount: 1,
  postStopDispatches: row6Live.sample.postStopDispatches,
  residencyDrop: row6Live.sample.residencyDrop,
  forbiddenClaim: row6Live.sample.forbiddenClaim,
  stopInstant,
  sinkDelta: row6Live.sample.sinkDelta,
  healthStatus: row6Live.sample.healthStatus,
  hostAlive: row6Live.sample.hostAlive,
}

const judging = (sample) => {
  const verdict = judgeRow6(sample)
  return { verdict: verdict.verdict, reason: verdict.reason, factsObserved: verdict.detail.factsObserved, factsAfterStop: verdict.detail.factsAfterStop, probeFacts: verdict.detail.probeFactsObserved, failed: verdict.detail.failed }
}

const out = []
const say = (line) => { out.push(line); console.log(line) }

say(`stopInstant (run-record.json)            = ${stopInstant}`)
say(`A. consultations.jsonl                    = ${sink.length} facts`)
say(`   newest observedAt in that file        = ${sink.map((fact) => fact.observedAt).sort().at(-1)}`)
say(`   judgeRow6(sink, stop)                 = ${JSON.stringify(judging({ ...base, facts: sink }))}`)
say(`B. the LIVE sample the driver judged     = ${liveFacts.length} facts (oracle-samples.json row6)`)
say(`   newest observedAt in that sample      = ${liveFacts.map((fact) => fact.observedAt).sort().at(-1)}`)
say(`   judgeRow6(live sample, stop)          = ${JSON.stringify(judging({ ...base, facts: liveFacts }))}`)
say('   facts after the stop, verbatim:')
for (const fact of factsAfterStop) say(`     ${fact.observedAt}  ${fact.method}/${fact.decision}  realm=${fact.realm}  ${fact.locator.split('/').pop()}`)
say(`C. attribution: factsAtStop(${factsAtStop.length}) === consultations.jsonl(${sink.length})? ${sameAsSink}`)
say(`   every post-stop fact targets b.txt? ${probeTargetsAreB}; teardown.json refusalCodesAfterStop has ${teardown.refusalCodesAfterStop.length} entries (the row's own postArchiveRead + postDropRead), each a refusal:`)
for (const entry of teardown.refusalCodesAfterStop) say(`     status=${entry.status} ok=${entry.ok} ${JSON.stringify(entry.message)}`)
say(`   the row's own probes appended exactly the facts it then counted: after = before + ${factsAfterStop.length}`)
say(`D. repaired split: factsAtStop=${factsAtStop.length}, probeFacts=${factsAfterStop.length}`)
say(`   judgeRow6({facts: factsAtStop, probeFacts: factsAfterStop}) = ${JSON.stringify(judging({ ...base, facts: factsAtStop, probeFacts: factsAfterStop }))}`)
say(`   judgeRow6({facts: factsAtStop + one fact at stop+1s})       = ${JSON.stringify(judging({ ...base, facts: [...factsAtStop, { ...factsAtStop[0], observedAt: new Date(Date.parse(stopInstant) + 1000).toISOString(), locator: '/w/after-stop.txt' }], probeFacts: factsAfterStop }))}`)
say(`   judgeRow6({facts, probeFacts with one ALLOW})             = ${JSON.stringify(judging({ ...base, facts: factsAtStop, probeFacts: [...factsAfterStop, { ...factsAfterStop[0], decision: 'allow' }] }))}`)

process.stdout.write('')
