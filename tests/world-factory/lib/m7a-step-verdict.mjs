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

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'

export const UNPROVISIONABLE_TOKEN = 'M7A-HOST-ASSET-UNPROVISIONABLE'
export const ALLOW_UNPROVISIONABLE_ENV = 'M7A_ALLOW_UNPROVISIONABLE_HOST'
export const STEP_RECORD_SCHEMA = 'm7a-step/1'
export const STEP_RUN_ID_ENV = 'M7A_STEP_RUN_ID'
export const STEP_ARGV_ENV = 'M7A_STEP_ARGV'
export const STEP_RECORD_ENV = 'M7A_STEP_RECORD'
export const STEP_RECORD_DIR_ENV = 'M7A_STEP_RECORD_DIR'

/**
 * The five arms and the verdict each MUST carry. The ledger grades a `VERIFIED` record against
 * this table independently of whatever wrote it: `arms: 5` alone is a number, not a verification.
 */
export const EXPECTED_ARM_VERDICTS = Object.freeze([
  { arm: 'deny-outside-workspace', verdict: 'SATISFIED' },
  { arm: 'unauthorized-observed', verdict: 'VIOLATED' },
  { arm: 'observation-disabled', verdict: 'INCONCLUSIVE' },
  { arm: 'trace-only-no-witness', verdict: 'INSTRUMENT_ERROR' },
  { arm: 'bash-reachable-and-confined', verdict: 'SATISFIED' },
])

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

const isSha256 = (v) => typeof v === 'string' && /^[0-9a-f]{64}$/u.test(v)

/**
 * The INDEPENDENT reader used by the ledger — not a re-print.
 *
 * It re-checks every conjunction the writer relied on, against the environment the job declares:
 * schema, run identity, host sha, declared argv, arm count vs verdict, and each arm's verdict
 * against `EXPECTED_ARM_VERDICTS`. A record that fails any of these is `INVALID` (or `STALE` when it
 * belongs to another run) and the ledger exits 1 — the record is evidence, not a claim to echo.
 */
export function validateStepRecord(record, { env = process.env, expectedHostSha = null } = {}) {
  const invalid = (reason, detail = '') => ({ ok: false, code: 'INVALID', reason, detail })
  if (record === null || typeof record !== 'object' || Array.isArray(record)) return invalid('NOT_AN_OBJECT')
  if (record.schema !== STEP_RECORD_SCHEMA) return invalid('WRONG_SCHEMA', String(record.schema))

  // Run identity: a record from another run is never this run's verdict.
  const declaredRunId = typeof env?.[STEP_RUN_ID_ENV] === 'string' ? env[STEP_RUN_ID_ENV].trim() : ''
  const runId = typeof record.runId === 'string' ? record.runId.trim() : ''
  if (runId === '') return invalid('NO_RUN_ID')
  if (declaredRunId !== '' && runId !== declaredRunId) {
    return { ok: false, code: 'STALE', reason: 'RUN_ID_MISMATCH', detail: `record=${runId} this-run=${declaredRunId}` }
  }

  if (expectedHostSha !== null && record.hostSha !== expectedHostSha) return invalid('HOST_SHA_MISMATCH', String(record.hostSha))
  if (typeof record.hostSha !== 'string' || record.hostSha.length < 7) return invalid('NO_HOST_SHA')

  // The argv must be the DECLARED one; a reconstruction cannot be checked and is refused.
  if (record.argvSource !== STEP_ARGV_ENV) return invalid('ARGV_NOT_DECLARED', String(record.argvSource))
  if (!Array.isArray(record.argv) || record.argv.length === 0 || record.argv.some((t) => typeof t !== 'string')) return invalid('ARGV_MALFORMED')
  const declaredArgv = typeof env?.[STEP_ARGV_ENV] === 'string' ? env[STEP_ARGV_ENV].trim() : ''
  if (declaredArgv !== '' && record.argv.join(' ') !== declaredArgv) return invalid('ARGV_MISMATCH', record.argv.join(' '))

  if (record.verdict === 'VERIFIED') {
    if (record.reason !== 'ARMS_GRADED') return invalid('WRONG_REASON', String(record.reason))
    if (record.arms !== EXPECTED_ARM_VERDICTS.length) return invalid('WRONG_ARM_COUNT', String(record.arms))
    if (!Array.isArray(record.armVerdicts) || record.armVerdicts.length !== EXPECTED_ARM_VERDICTS.length) return invalid('ARM_VERDICTS_MISSING')
    for (const [i, expected] of EXPECTED_ARM_VERDICTS.entries()) {
      const got = record.armVerdicts[i]
      if (got?.arm !== expected.arm) return invalid('ARM_ORDER_MISMATCH', `${String(got?.arm)} != ${expected.arm}`)
      if (got?.verdict !== expected.verdict) return invalid('ARM_VERDICT_MISMATCH', `${expected.arm}: ${String(got?.verdict)} != ${expected.verdict}`)
    }
    return { ok: true, code: 'OK', verdict: 'VERIFIED', reason: 'ARMS_GRADED' }
  }

  if (record.verdict === 'DISCLOSED_REFUSAL') {
    if (record.reason !== 'HOST_ASSET_UNPROVISIONABLE') return invalid('WRONG_REASON', String(record.reason))
    if (record.arms !== 0) return invalid('REFUSAL_WITH_ARMS', String(record.arms))
    if (Array.isArray(record.armVerdicts) && record.armVerdicts.length > 0) return invalid('REFUSAL_WITH_ARM_VERDICTS')
    if (typeof record.asset !== 'string' || record.asset.trim() === '') return invalid('NO_ASSET')
    if (!isSha256(record.actualSha256) || !isSha256(record.expectedSha256)) return invalid('NO_SHA_PAIR')
    if (record.actualSha256 === record.expectedSha256) return invalid('SHA_PAIR_EQUAL')
    return { ok: true, code: 'OK', verdict: 'DISCLOSED_REFUSAL', reason: 'HOST_ASSET_UNPROVISIONABLE' }
  }

  return invalid('UNKNOWN_VERDICT', String(record.verdict))
}

/** Read + validate a record file; the ledger's whole body. `MISSING` and `STALE` are failures too. */
export function readStepRecord(path, options = {}) {
  if (!existsSync(path)) return { ok: false, code: 'MISSING', reason: 'NO_RECORD', detail: path }
  let record = null
  try {
    record = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    return { ok: false, code: 'INVALID', reason: 'UNREADABLE_RECORD', detail: String(error?.message ?? error).slice(0, 200) }
  }
  return { ...validateStepRecord(record, options), record }
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
  const declared = typeof env?.[STEP_ARGV_ENV] === 'string' ? env[STEP_ARGV_ENV].trim() : ''
  if (declared !== '') return { argv: declared.split(/\s+/u), argvSource: 'M7A_STEP_ARGV' }
  const flags = [...new Set(process.execArgv.filter((flag) => flag.startsWith('--test')))]
  return { argv: [process.execPath, ...flags, ...process.argv.slice(1)], argvSource: 'process.argv (reconstructed)' }
}

/**
 * Where the step record lives. `M7A_STEP_RECORD` (a file) and `M7A_STEP_RECORD_DIR` (a directory)
 * exist so a test that runs this suite as a CHILD (the C1 host-state cases) cannot delete or
 * overwrite the record of the real step: three parallel children sharing one fixed path turned a
 * green C2 into `verdict=MISSING` (observed 2026-11-15).
 */
export function stepRecordPath(repoRoot, env = process.env) {
  const explicit = typeof env?.[STEP_RECORD_ENV] === 'string' ? env[STEP_RECORD_ENV].trim() : ''
  if (explicit !== '') return explicit
  const dir = typeof env?.[STEP_RECORD_DIR_ENV] === 'string' ? env[STEP_RECORD_DIR_ENV].trim() : ''
  return join(dir !== '' ? dir : join(repoRoot, '.artifacts', 'tmp', 'm7a-real-slice'), 'm7a-step.json')
}

/**
 * The identity a record is bound to. The job supplies it (`<run_id>-<run_attempt>`), so a record
 * from an earlier run — or one seeded by hand — can never be read as this run's verdict. A local
 * run without the variable gets a random id: the record still says WHICH run it belongs to.
 */
export function stepRunId(env = process.env) {
  const declared = typeof env?.[STEP_RUN_ID_ENV] === 'string' ? env[STEP_RUN_ID_ENV].trim() : ''
  return declared !== '' ? declared : `local-${randomUUID()}`
}

/**
 * Delete any record at `path` BEFORE a single precondition can return, and return the path.
 *
 * This is called at MODULE scope by the suite, not inside the test body: the hosted job's failure
 * mode is a suite that never reaches its body (absent host + M7A_REQUIRE_PINNED_HOST=1), and a
 * `VERIFIED` record left from an earlier run would then be blessed by the ledger. "Absent record =
 * ambiguous" is only true if the record is deleted on the paths that never write one.
 */
export function resetStepRecord(repoRoot, env = process.env) {
  const path = stepRecordPath(repoRoot, env)
  rmSync(path, { force: true })
  return path
}

/** Write the record the ledger step reads. A failure to write must be loud, not silent. */
export function writeStepRecord(file, record) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
  return file
}
