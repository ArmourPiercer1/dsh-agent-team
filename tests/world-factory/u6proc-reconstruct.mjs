#!/usr/bin/env node
/**
 * U6 PR3 — OFFLINE reconstruction of a u6-proc RUN RECORD from written
 * evidence (zero host starts; the budget ledger is not touched).
 *
 * Why this exists: runs u6prc1-5 measured the product law live (every
 * governed shell arm on the factory C2 world is fail-closed: the shell
 * ask is born-terminal for every rung — fingerprint-pinned human-admin
 * with no Admin resolver, ADR A1-12 — and the leader allow-lane exec
 * downgrades to that ask when the dual-gate token is absent at bind
 * time). The verdicts were then re-scoped (via the SHARED judge function
 * in lib/u6-proc-assembly.mjs) to state exactly what the evidence shows.
 * This script re-applies that judge to the evidence JSON and writes a
 * clean record + RUN-SUMMARY. It invents nothing: every case row is a
 * pure function of the recorded digest, and `proc:mounted` — whose inputs
 * are boot-time-only — is CARRIED verbatim from the source run record.
 *
 * Usage:
 *   node tests/world-factory/u6proc-reconstruct.mjs \
 *     --evidence <evidence dir> --source <runId.u6proc-evidence.json> \
 *     --source-record <run-u6proc.json> --from-run <runId> \
 *     --run-record <out.json>
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRunRecord, exitCodeFor, formatSummary } from './lib/run-record.mjs'
import { judgeU6Proc } from './lib/u6-proc-assembly.mjs'
import { SUITE_CASES } from './u5-canary-runner.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
void HERE

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? null : process.argv[i + 1]
}

const evidenceDir = arg('evidence')
const source = arg('source')
const sourceRecordPath = arg('source-record')
const fromRun = arg('from-run')
const outRecord = arg('run-record')
if (evidenceDir === null || source === null || sourceRecordPath === null || fromRun === null || outRecord === null) {
  console.error('missing args — see header')
  process.exit(2)
}

const digest = JSON.parse(readFileSync(source.startsWith('/') ? source : join(evidenceDir, source), 'utf8'))
const sourceRecord = JSON.parse(readFileSync(sourceRecordPath, 'utf8'))
const runs = Array.isArray(sourceRecord) ? sourceRecord : (sourceRecord.runs ?? [sourceRecord])
const src = runs.find((r) => r.runId === fromRun) ?? (runs.at(-1)?.runId === fromRun ? runs.at(-1) : null)
if (src === null || src === undefined) {
  console.error(`source run ${fromRun} not found in ${sourceRecordPath}`)
  process.exit(2)
}
// hostAlive at judgment time is reconstructed from the record's own facts:
// a CLEAN finalization (finishedAt + no aborted marker) means the run drove
// to completion with the host answering its final probes.
const abortedPath = join(evidenceDir, `${fromRun}.run-abort.json`)
const hostAliveReconstructed = src.finishedAt !== undefined && src.finishedAt !== null && !existsSync(abortedPath)

const runId = `${fromRun}-recon-${new Date().toISOString().replace(/[:.]/g, '-')}`
const record = createRunRecord({
  runId,
  suite: 'u6-proc',
  selectedCases: SUITE_CASES['u6-proc'],
  ledgerPath: null, // NO host starts: reconstruction never boots
  bindings: {
    mode: 'reconstruct',
    reconstructedFrom: { runId: fromRun, evidence: source, record: sourceRecordPath },
    hostAliveReconstructed,
    disclosure:
      'offline re-judgment of run u6prc5 through the shared judgeU6Proc (the same function live runs use); no host start, ledger untouched; proc:mounted carried verbatim from the source record (boot-time-only inputs).',
  },
})

const mounted = (src.cases ?? []).find((c) => c.id === 'proc:mounted')
if (mounted !== undefined && mounted !== undefined) {
  record.addCase('proc:mounted', mounted.verdict, {
    carriedFrom: fromRun,
    note: 'boot-time-only inputs (placement-feed echo, launcher pin) cannot be recomputed offline; verdict + detail carried verbatim from the source run',
    source: mounted,
  })
}
for (const [id, verdict, detail] of judgeU6Proc(digest, hostAliveReconstructed)) {
  record.addCase(id, verdict, detail)
}

const rec = record.finalize()
record.write(outRecord)
for (const c of rec.cases) console.log(`[u6-proc] case ${c.id}: ${c.verdict}`)
console.log(formatSummary(rec))
process.exit(exitCodeFor(rec))
