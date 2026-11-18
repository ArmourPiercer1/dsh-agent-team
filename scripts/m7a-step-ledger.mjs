#!/usr/bin/env node
/**
 * m7a-step-ledger.mjs — one line per L2 saying whether the real-host capability was VERIFIED or
 * DISCLOSED-REFUSED BY NAME on that runner.
 *
 * Reviewer decision 2026-11-15 (option B): the hosted runner structurally cannot boot the pinned
 * host (the sandbox-asset manifest pins one machine's native bytes; a cold checkout produces
 * different bytes and provisioning has no local source). Rather than a permanently red Required
 * leg or a `continue-on-error` that would bless any failure, the M7-A step may accept ONE named
 * refusal (`M7A-HOST-ASSET-UNPROVISIONABLE`) and must write `m7a-step.json`.
 *
 * This step RE-CHECKS that record instead of re-printing it — a reader that only echoes its input
 * is not a gate. It refuses:
 *   - `MISSING`  no record at the path (a run that never wrote one: the honest default)
 *   - `STALE`    a record whose run id is not this run's (`M7A_STEP_RUN_ID`)
 *   - `INVALID`  schema, host sha, declared argv, arm count, or an arm verdict disagrees
 *   - `OK` + VERIFIED             exactly five arms, each with its expected verdict
 *   - `OK` + DISCLOSED_REFUSAL    the one accepted reason, zero arms, a real differing sha256 pair
 *
 * Every `MISSING` / `STALE` / `INVALID` exits 1, so the job (or a local run) is red and says why.
 *
 * Run: node scripts/m7a-step-ledger.mjs [path]
 */
import { fileURLToPath } from 'node:url'
import { readStepRecord, stepRecordPath } from '../tests/world-factory/lib/m7a-step-verdict.mjs'
import { TEST_USE_BASELINE_SHA } from '../tests/paths.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const path = process.argv[2] ?? stepRecordPath(REPO_ROOT)
const result = readStepRecord(path, { env: process.env, expectedHostSha: TEST_USE_BASELINE_SHA })

if (!result.ok) {
  const detail =
    result.detail === undefined || result.detail === '' ? '' : ` detail=${String(result.detail).replace(/\s+/gu, ' ').slice(0, 240)}`
  console.error(`M7A-STEP-LEDGER verdict=${result.code} reason=${result.reason}${detail} path=${path}`)
  process.exit(1)
}

const record = result.record
const line =
  record.verdict === 'VERIFIED'
    ? `M7A-STEP-LEDGER verdict=VERIFIED arms=${String(record.arms)} host=${String(record.hostSha)} utc=${String(record.utc)} run=${String(record.runId)}`
    : `M7A-STEP-LEDGER verdict=DISCLOSED_REFUSAL reason=HOST_ASSET_UNPROVISIONABLE asset=${String(record.asset)} actual=${String(record.actualSha256)} pinned=${String(record.expectedSha256)} host=${String(record.hostSha)} utc=${String(record.utc)} run=${String(record.runId)}`
console.log(`${line} path=${path}`)
