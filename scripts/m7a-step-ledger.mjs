#!/usr/bin/env node
/**
 * m7a-step-ledger.mjs — one line per L2 saying whether the real-host capability was VERIFIED or
 * DISCLOSED-REFUSED BY NAME on that runner.
 *
 * Reviewer decision 2026-11-15 (option B): the hosted runner structurally cannot boot the pinned
 * host (the sandbox-asset manifest pins one machine's native bytes; a cold checkout produces
 * different bytes and provisioning has no local source). Rather than a permanently red Required
 * leg or a `continue-on-error` that would bless any failure, the M7-A step may accept ONE named
 * refusal (`M7A-HOST-ASSET-UNPROVISIONABLE`) and must write `m7a-step.json`. This step reads that
 * record and turns it into the single line a human greps for.
 *
 * It is deliberately strict, because it is the last reader of the gate:
 *   - no record            → exit 1 (`verdict=MISSING`)
 *   - VERIFIED             → exit 0, and only with `arms` > 0
 *   - DISCLOSED_REFUSAL    → exit 0, and only with reason=HOST_ASSET_UNPROVISIONABLE
 *   - anything else        → exit 1 (`verdict=INVALID`)
 *
 * Run: node scripts/m7a-step-ledger.mjs [path]
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatLedgerLine } from '../tests/world-factory/lib/m7a-step-verdict.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const path = process.argv[2] ?? join(REPO_ROOT, '.artifacts', 'tmp', 'm7a-real-slice', 'm7a-step.json')

if (!existsSync(path)) {
  console.error(`M7A-STEP-LEDGER verdict=MISSING reason=NO_RECORD path=${path}`)
  process.exit(1)
}

let record = null
try {
  record = JSON.parse(readFileSync(path, 'utf8'))
} catch (error) {
  console.error(`M7A-STEP-LEDGER verdict=INVALID reason=UNREADABLE_RECORD path=${path} detail=${String(error?.message ?? error).slice(0, 200)}`)
  process.exit(1)
}

const verified = record?.verdict === 'VERIFIED' && Number.isInteger(record.arms) && record.arms > 0
const refused = record?.verdict === 'DISCLOSED_REFUSAL' && record.reason === 'HOST_ASSET_UNPROVISIONABLE'
if (verified || refused) {
  console.log(`${formatLedgerLine(record)} path=${path}`)
  process.exit(0)
}
// A VERIFIED record with no arms is not a verification; say so rather than echo the claim.
const reason = record?.verdict === 'VERIFIED' ? 'NO_ARMS' : String(record?.verdict ?? 'MISSING')
console.error(`M7A-STEP-LEDGER verdict=INVALID reason=${reason} path=${path}`)
process.exit(1)
