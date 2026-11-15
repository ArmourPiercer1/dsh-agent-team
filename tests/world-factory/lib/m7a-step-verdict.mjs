/**
 * m7a-step-verdict.mjs — the ONE place that decides what the M7-A step's outcome means.
 *
 * WHY THIS FILE EXISTS (2026-11-15, reviewer decision, option B). The hosted `census-runtime`
 * job cannot boot the pinned host at all: `bin/glibc/system.node` is a gitignored native asset
 * and `tests/world-factory/lib/host-sandbox-assets-manifest.json` pins the bytes of ONE machine's
 * build, while a fresh clone + build of the same pinned host SHA produces different bytes and
 * the provisioner's only source is a local tree a hosted runner does not have. A permanently red
 * Required leg is not shippable; `continue-on-error` would let ANY failure pass. So the step gets
 * one named, disclosed refusal and nothing else:
 *
 *   verdict=DISCLOSED_REFUSAL reason=HOST_ASSET_UNPROVISIONABLE
 *
 * accepted ONLY when (a) the caller opted in (`M7A_ALLOW_UNPROVISIONABLE_HOST=1`, default off, so
 * local runs keep hard-failing), (b) the failure is EXACTLY the sandbox-asset digest refusal, and
 * (c) no arm ran (a refusal plus graded arms is a contradiction, and a contradiction is a failure).
 * Every other outcome — any other precondition, a failure after arms, a refusal alongside arms, an
 * unreadable record — is FAILED and must fail the job. The decision is a pure function so the
 * four ways this could become a hole are pinned by tests instead of by prose.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const UNPROVISIONABLE_TOKEN = 'M7A-HOST-ASSET-UNPROVISIONABLE'
export const ALLOW_UNPROVISIONABLE_ENV = 'M7A_ALLOW_UNPROVISIONABLE_HOST'
export const STEP_RECORD_SCHEMA = 'm7a-step/1'

/** The opt-in is an explicit `1`; unset, `0`, `true`, `yes` all mean "do not accept a refusal". */
export function allowUnprovisionableHost(env = process.env) {
  return env[ALLOW_UNPROVISIONABLE_ENV] === '1'
}

/**
 * Classify a thrown value as the ONE accepted refusal, or return `null`.
 *
 * Only `DESTINATION_DIGEST_MISMATCH` from `host-sandbox-assets` qualifies. Its siblings are
 * deliberately NOT accepted: `SOURCE_IS_DESTINATION` means a caller pointed the source at the
 * destination (a configuration error this gate must not bless), and `SOURCE_TREE_MISSING` means
 * provisioning was requested with nowhere to copy from (also a configuration error). Neither is
 * the "this machine cannot carry the pinned bytes" fact the disclosure is about.
 */
export function classifyHostAssetRefusal(error) {
  if (error === null || error === undefined) return null
  const message = String(error?.message ?? error)
  if (!message.includes('host-sandbox-assets')) return null
  const match =
    /DESTINATION_DIGEST_MISMATCH: (.+?) in (.+?) hashes ([0-9a-f]{64}), the pinned manifest says ([0-9a-f]{64})/u.exec(message)
  if (match === null) return null
  return {
    token: UNPROVISIONABLE_TOKEN,
    asset: match[1],
    tree: match[2],
    actualSha256: match[3],
    expectedSha256: match[4],
    detail: `${match[1]} sha256=${match[3]} (this tree) != ${match[4]} (pinned manifest)`,
  }
}

/**
 * The gate. `error === null` means the run completed; `armCount` is how many arms were graded.
 *
 * VERIFIED requires graded arms: an empty green run is not a verification.
 * DISCLOSED_REFUSAL requires opt-in + the exact asset refusal + zero arms.
 */
export function decideStepOutcome({ error = null, allowUnprovisionable = false, armCount = 0 } = {}) {
  const arms = Number.isInteger(armCount) && armCount > 0 ? armCount : 0
  if (error === null || error === undefined) {
    if (arms === 0) return { verdict: 'FAILED', reason: 'NO_ARMS_GRADED', detail: 'the run ended without grading a single arm' }
    return { verdict: 'VERIFIED', reason: 'ARMS_GRADED', arms }
  }
  const refusal = classifyHostAssetRefusal(error)
  if (refusal === null) {
    return {
      verdict: 'FAILED',
      reason: 'REFUSAL_NOT_ACCEPTED',
      detail: String(error?.message ?? error).slice(0, 400),
    }
  }
  if (!allowUnprovisionable) {
    return { verdict: 'FAILED', reason: 'UNPROVISIONABLE_HOST_NOT_ALLOWED', detail: refusal.detail }
  }
  if (arms > 0) {
    return { verdict: 'FAILED', reason: 'REFUSAL_WITH_ARM_OUTPUT', detail: `${String(arms)} arm(s) graded before the refusal: ${refusal.detail}` }
  }
  return { verdict: 'DISCLOSED_REFUSAL', reason: 'HOST_ASSET_UNPROVISIONABLE', arms: 0, ...refusal }
}

/** The one machine-greppable line a human (and the next reader of the log) looks for. */
export function formatStepLine(outcome) {
  const parts = [`M7A-STEP`, `verdict=${outcome.verdict}`, `reason=${outcome.reason}`]
  if (outcome.arms !== undefined) parts.push(`arms=${String(outcome.arms)}`)
  if (outcome.detail !== undefined && outcome.detail !== '') parts.push(`detail=${String(outcome.detail).replace(/\s+/gu, ' ').slice(0, 400)}`)
  return parts.join(' ')
}

/** The ledger line printed by `scripts/m7a-step-ledger.mjs` after the step (same job, `always()`). */
export function formatLedgerLine(record) {
  if (record === null || typeof record !== 'object') return 'M7A-STEP-LEDGER verdict=INVALID reason=UNREADABLE'
  if (record.verdict === 'VERIFIED') {
    return `M7A-STEP-LEDGER verdict=VERIFIED arms=${String(record.arms ?? 0)} host=${String(record.hostSha ?? 'unknown')} utc=${String(record.utc ?? 'unknown')}`
  }
  if (record.verdict === 'DISCLOSED_REFUSAL' && record.reason === 'HOST_ASSET_UNPROVISIONABLE') {
    return `M7A-STEP-LEDGER verdict=DISCLOSED_REFUSAL reason=HOST_ASSET_UNPROVISIONABLE asset=${String(record.asset ?? 'unknown')} actual=${String(record.actualSha256 ?? 'unknown')} pinned=${String(record.expectedSha256 ?? 'unknown')} host=${String(record.hostSha ?? 'unknown')} utc=${String(record.utc ?? 'unknown')}`
  }
  return `M7A-STEP-LEDGER verdict=INVALID reason=${String(record.verdict ?? 'MISSING')}`
}

/**
 * The argv that actually decided this run, as a fact rather than a reconstruction.
 *
 * The step declares it (`M7A_STEP_ARGV`) because inside a `node --test` child `process.execArgv`
 * is the runtime's whole default flag set — it cannot even see `--test-reporter=spec`, which the
 * runner consumes. A local run without the declaration records the best available reconstruction
 * and says so (`argvSource`).
 */
export function stepArgv(env = process.env) {
  const declared = typeof env?.M7A_STEP_ARGV === 'string' ? env.M7A_STEP_ARGV.trim() : ''
  if (declared !== '') return { argv: declared.split(/\s+/u), argvSource: 'M7A_STEP_ARGV' }
  const flags = [...new Set(process.execArgv.filter((flag) => flag.startsWith('--test')))]
  return { argv: [process.execPath, ...flags, ...process.argv.slice(1)], argvSource: 'process.argv (reconstructed)' }
}

/** Where the step record lives: gitignored, stable across runs, uploaded by the job. */
export function stepRecordPath(repoRoot) {
  return join(repoRoot, '.artifacts', 'tmp', 'm7a-real-slice', 'm7a-step.json')
}

/** Write the record the ledger step reads. A failure to write must be loud, not silent. */
export function writeStepRecord(file, record) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
  return file
}
