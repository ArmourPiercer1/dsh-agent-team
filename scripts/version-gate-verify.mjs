#!/usr/bin/env node
/**
 * version-gate-verify.mjs — the VERSION GATE's fail-closed freeze check.
 *
 * THE QUESTION IT ANSWERS, EXACTLY. "Is this candidate/release VERSION gate-backed
 * at this SHA?" By the owner ruling (2026-11-25) the answer is YES only when a
 * version gate receipt exists for that SHA, its referenced verdict is the same
 * bytes (digest) and says `pass`, `envLimited` is 0, the known-refuted set is
 * EXACTLY the gate's enumerated one, and the head is the SHA asked about.
 *
 * WHY IT MUST FAIL CLOSED. A verifier that returns "pass" when the receipt is
 * missing, malformed, or about another commit is worse than no verifier: the freeze
 * would be declared on nothing. So every failure below is a NAMED code with a
 * detail string — never a generic throw, never an empty success. There is no
 * "warn" path and no default that reads as pass.
 *
 * WHAT IT DOES NOT DO. It does not run the gate (the gate is a ~84 min dual-host
 * run), does not re-grade a judge, and does not invent evidence: it validates the
 * receipt the gate published and follows its `verdictFile.path` + digest back to
 * the gate's own verdict.
 *
 *   node scripts/version-gate-verify.mjs [--receipt <path>] [--head <40-hex>] [--json]
 *                                        [--root <dir>]
 *
 * Defaults: `--receipt` = the newest `version-gate-receipt.json` under
 * `dev/agent-workflow/evidence/candidate-acceptance-gate`; `--head` =
 * `git rev-parse HEAD`; `--root` = this checkout.
 *
 * Exit: 0 only when every rule above holds | 1 typed refusal | 2 usage.
 *
 * @module scripts/version-gate-verify
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { KNOWN_REFUTED_IDS } from './candidate-acceptance-known-refuted.mjs'
import { GATE_VERDICT_SCHEMA, RECEIPT_FILENAME, RECEIPT_KIND, RECEIPT_SCHEMA_VERSION, refutedIdsOf } from './version-gate-receipt.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
export const DEFAULT_RECEIPT_ROOT = 'dev/agent-workflow/evidence/candidate-acceptance-gate'

/** The closed refusal vocabulary. Every non-pass outcome names one of these. */
export const VERIFY_CODES = Object.freeze({
  USAGE: 'VERSION_GATE_USAGE',
  HEAD_UNRESOLVED: 'VERSION_GATE_HEAD_UNRESOLVED',
  RECEIPT_MISSING: 'VERSION_GATE_RECEIPT_MISSING',
  RECEIPT_UNREADABLE: 'VERSION_GATE_RECEIPT_UNREADABLE',
  SCHEMA_DRIFT: 'VERSION_GATE_SCHEMA_DRIFT',
  SCHEMA_VERSION_UNSUPPORTED: 'VERSION_GATE_SCHEMA_VERSION_UNSUPPORTED',
  HEAD_INVALID: 'VERSION_GATE_HEAD_INVALID',
  HEAD_MISMATCH: 'VERSION_GATE_HEAD_MISMATCH',
  VERDICT_NOT_PASS: 'VERSION_GATE_VERDICT_NOT_PASS',
  TIME_INVALID: 'VERSION_GATE_TIME_INVALID',
  VERDICT_FILE_MISSING: 'VERSION_GATE_VERDICT_FILE_MISSING',
  VERDICT_DIGEST_MISMATCH: 'VERSION_GATE_VERDICT_DIGEST_MISMATCH',
  VERDICT_UNREADABLE: 'VERSION_GATE_VERDICT_UNREADABLE',
  VERDICT_SCHEMA_UNSUPPORTED: 'VERSION_GATE_VERDICT_SCHEMA_UNSUPPORTED',
  VERDICT_HEAD_MISMATCH: 'VERSION_GATE_VERDICT_HEAD_MISMATCH',
  JUDGES_MISMATCH: 'VERSION_GATE_JUDGES_MISMATCH',
  ENV_LIMITED_NONZERO: 'VERSION_GATE_ENV_LIMITED_NONZERO',
  KNOWN_REFUTED_UNEXPECTED: 'VERSION_GATE_KNOWN_REFUTED_UNEXPECTED',
  KNOWN_REFUTED_MISSING: 'VERSION_GATE_KNOWN_REFUTED_MISSING',
  HOSTS_MISMATCH: 'VERSION_GATE_HOSTS_MISMATCH',
})

/** The receipt schema, as a closed key set. Extra keys are DRIFT, not tolerance:
 *  a field the verifier does not understand must never travel unread. */
export const RECEIPT_KEYS = Object.freeze([
  'schemaVersion', 'kind', 'head', 'verdict', 'judges', 'knownRefutedIds',
  'hosts', 'startedAt', 'finishedAt', 'gateVersion', 'verdictFile',
])
const JUDGE_KEYS = Object.freeze(['proven', 'knownRefuted', 'envLimited'])
const VERDICT_FILE_KEYS = Object.freeze(['path', 'digest'])

function refuse(code, detail) {
  return { ok: false, code, detail }
}

const isString = (v) => typeof v === 'string' && v !== ''
const isSha = (v) => typeof v === 'string' && /^[0-9a-f]{40}$/u.test(v)
const isCount = (v) => Number.isInteger(v) && v >= 0
const isIso = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v))

function sameKeys(object, keys) {
  if (object === null || typeof object !== 'object' || Array.isArray(object)) return false
  const got = Object.keys(object).sort()
  return got.length === keys.length && got.every((k, i) => k === [...keys].sort()[i])
}

function sha256Of(path) {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`
}

function latestReceipt(root) {
  const base = join(root, DEFAULT_RECEIPT_ROOT)
  if (!existsSync(base)) return null
  let newest = null
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      let stat
      try { stat = statSync(path) } catch { continue }
      if (stat.isDirectory()) { walk(path); continue }
      if (name !== RECEIPT_FILENAME) continue
      if (newest === null || stat.mtimeMs > newest.mtimeMs) newest = { path, mtimeMs: stat.mtimeMs }
    }
  }
  walk(base)
  return newest?.path ?? null
}

function resolveReceiptPath(path, root) {
  if (path === undefined) {
    const latest = latestReceipt(root)
    return latest === null ? null : latest
  }
  return isAbsolute(path) ? path : resolve(root, path)
}

/** Resolve the SHA the caller asked about. `git rev-parse HEAD` by default. */
export function resolveHead(root) {
  try {
    const out = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    return out
  } catch {
    return null
  }
}

/** Validate the receipt shape BEFORE trusting any field of it. */
export function validateReceiptSchema(receipt) {
  if (receipt === null || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return refuse(VERIFY_CODES.SCHEMA_DRIFT, 'the receipt is not a JSON object')
  }
  if (receipt.schemaVersion !== RECEIPT_SCHEMA_VERSION) {
    if (Number.isInteger(receipt.schemaVersion)) {
      return refuse(VERIFY_CODES.SCHEMA_VERSION_UNSUPPORTED, `schemaVersion=${String(receipt.schemaVersion)}; this verifier understands ${String(RECEIPT_SCHEMA_VERSION)} only`)
    }
    return refuse(VERIFY_CODES.SCHEMA_DRIFT, `schemaVersion=${JSON.stringify(receipt.schemaVersion ?? null)} is not an integer`)
  }
  if (!sameKeys(receipt, RECEIPT_KEYS)) {
    const extra = Object.keys(receipt).filter((k) => !RECEIPT_KEYS.includes(k))
    const missing = RECEIPT_KEYS.filter((k) => !(k in receipt))
    return refuse(VERIFY_CODES.SCHEMA_DRIFT, `receipt keys drift: missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`)
  }
  if (receipt.kind !== RECEIPT_KIND) return refuse(VERIFY_CODES.SCHEMA_DRIFT, `kind=${JSON.stringify(receipt.kind)}; expected ${JSON.stringify(RECEIPT_KIND)}`)
  if (!isSha(receipt.head)) return refuse(VERIFY_CODES.HEAD_INVALID, `receipt head=${JSON.stringify(receipt.head)} is not a 40-hex SHA`)
  if (!isString(receipt.verdict)) return refuse(VERIFY_CODES.SCHEMA_DRIFT, 'receipt verdict is not a string')
  if (!sameKeys(receipt.judges, JUDGE_KEYS)) return refuse(VERIFY_CODES.SCHEMA_DRIFT, `judges keys=${JSON.stringify(Object.keys(receipt.judges ?? {}))}; expected ${JSON.stringify(JUDGE_KEYS)}`)
  for (const key of JUDGE_KEYS) {
    if (!isCount(receipt.judges[key])) return refuse(VERIFY_CODES.SCHEMA_DRIFT, `judges.${key}=${JSON.stringify(receipt.judges[key])} is not a non-negative integer`)
  }
  if (!Array.isArray(receipt.knownRefutedIds) || receipt.knownRefutedIds.some((id) => !isString(id))) {
    return refuse(VERIFY_CODES.SCHEMA_DRIFT, 'knownRefutedIds is not an array of non-empty strings')
  }
  if (!Array.isArray(receipt.hosts) || receipt.hosts.length === 0 || receipt.hosts.some((h) => !isString(h))) {
    return refuse(VERIFY_CODES.SCHEMA_DRIFT, 'hosts is not a non-empty array of non-empty strings')
  }
  if (!isIso(receipt.startedAt)) return refuse(VERIFY_CODES.TIME_INVALID, `startedAt=${JSON.stringify(receipt.startedAt)} is not an ISO timestamp`)
  if (!isIso(receipt.finishedAt)) return refuse(VERIFY_CODES.TIME_INVALID, `finishedAt=${JSON.stringify(receipt.finishedAt)} is not an ISO timestamp`)
  if (!isString(receipt.gateVersion)) return refuse(VERIFY_CODES.SCHEMA_DRIFT, 'gateVersion is not a non-empty string')
  if (!sameKeys(receipt.verdictFile, VERDICT_FILE_KEYS)) return refuse(VERIFY_CODES.SCHEMA_DRIFT, `verdictFile keys=${JSON.stringify(Object.keys(receipt.verdictFile ?? {}))}; expected ${JSON.stringify(VERDICT_FILE_KEYS)}`)
  if (!isString(receipt.verdictFile.path)) return refuse(VERIFY_CODES.SCHEMA_DRIFT, 'verdictFile.path is not a non-empty string')
  if (typeof receipt.verdictFile.digest !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(receipt.verdictFile.digest)) {
    return refuse(VERIFY_CODES.SCHEMA_DRIFT, `verdictFile.digest=${JSON.stringify(receipt.verdictFile.digest)} is not sha256:<64 hex>`)
  }
  return { ok: true }
}

/** The gate verdict's own REFUTED ids (ONE implementation, in the writer). */
export { refutedIdsOf }

function sorted(values) {
  return [...values].sort()
}

function sameSet(a, b) {
  return a.length === b.length && sorted(a).every((v, i) => v === sorted(b)[i])
}

/**
 * The whole verification. Pure over (receipt value, verdict value, head), so every
 * negative control is a unit test rather than a shell pipeline.
 *
 * @param {object} p
 * @param {object} p.receipt      parsed receipt JSON
 * @param {object} [p.verdict]    parsed verdict JSON (already digest-checked)
 * @param {string} p.head         the SHA asked about
 * @returns {{ok: true, summary: object} | {ok: false, code: string, detail: string}}
 */
export function verifyValues({ receipt, verdict, head }) {
  const schema = validateReceiptSchema(receipt)
  if (schema.ok !== true) return schema
  if (!isSha(head)) return refuse(VERIFY_CODES.HEAD_INVALID, `the requested head ${JSON.stringify(head)} is not a 40-hex SHA`)
  if (receipt.head !== head) {
    return refuse(VERIFY_CODES.HEAD_MISMATCH, `the receipt is for ${receipt.head} but this check is for ${head} — a frozen-SHA receipt only speaks for its own SHA`)
  }
  if (receipt.verdict !== 'pass') return refuse(VERIFY_CODES.VERDICT_NOT_PASS, `the receipt verdict is ${JSON.stringify(receipt.verdict)}`)
  if (receipt.judges.envLimited !== 0) return refuse(VERIFY_CODES.ENV_LIMITED_NONZERO, `judges.envLimited=${String(receipt.judges.envLimited)}; an ENV-LIMITED judge is not a version-gate pass`)
  if (!sameSet(receipt.knownRefutedIds, KNOWN_REFUTED_IDS)) {
    const extra = receipt.knownRefutedIds.filter((id) => !KNOWN_REFUTED_IDS.includes(id))
    const missing = KNOWN_REFUTED_IDS.filter((id) => !receipt.knownRefutedIds.includes(id))
    if (extra.length > 0) return refuse(VERIFY_CODES.KNOWN_REFUTED_UNEXPECTED, `the receipt allows known-refuted id(s) outside the enumeration: ${JSON.stringify(extra)} (enumerated: ${JSON.stringify(KNOWN_REFUTED_IDS)})`)
    return refuse(VERIFY_CODES.KNOWN_REFUTED_MISSING, `the receipt omits enumerated known-refuted id(s): ${JSON.stringify(missing)} — the set must be exactly ${JSON.stringify(KNOWN_REFUTED_IDS)}`)
  }
  // An OCCURRENCE count, not an id count: the same approved refusal is graded once
  // per host, so `judges.knownRefuted` may exceed the distinct id set. It may never
  // be fewer than the ids, and the digest-bound verdict has the final say below.
  if (receipt.judges.knownRefuted < receipt.knownRefutedIds.length) {
    return refuse(VERIFY_CODES.JUDGES_MISMATCH, `judges.knownRefuted=${String(receipt.judges.knownRefuted)} is fewer than the ${String(receipt.knownRefutedIds.length)} distinct known-refuted id(s) declared`)
  }
  if (verdict === undefined) return { ok: true, summary: { head: receipt.head, hosts: receipt.hosts, judges: receipt.judges } }
  if (verdict?.schema !== GATE_VERDICT_SCHEMA) {
    return refuse(VERIFY_CODES.VERDICT_SCHEMA_UNSUPPORTED, `the referenced verdict schema=${JSON.stringify(verdict?.schema ?? null)}; expected ${GATE_VERDICT_SCHEMA}`)
  }
  if (verdict?.head !== receipt.head) {
    return refuse(VERIFY_CODES.VERDICT_HEAD_MISMATCH, `the receipt names ${receipt.head} but its referenced verdict grades ${JSON.stringify(verdict?.head ?? null)}`)
  }
  if (!sameSet(receipt.hosts, Array.isArray(verdict?.hosts) ? verdict.hosts : [])) {
    return refuse(VERIFY_CODES.HOSTS_MISMATCH, `receipt hosts=${JSON.stringify(receipt.hosts)} but verdict hosts=${JSON.stringify(verdict?.hosts ?? null)}`)
  }
  const verdictRefuted = refutedIdsOf(verdict)
  if (!sameSet(verdictRefuted, receipt.knownRefutedIds)) {
    const extra = verdictRefuted.filter((id) => !receipt.knownRefutedIds.includes(id))
    if (extra.length > 0) return refuse(VERIFY_CODES.KNOWN_REFUTED_UNEXPECTED, `the referenced verdict contains REFUTED judge id(s) the receipt does not enumerate: ${JSON.stringify(extra)}`)
    return refuse(VERIFY_CODES.KNOWN_REFUTED_MISSING, `the referenced verdict is missing REFUTED id(s) the receipt declares: ${JSON.stringify(receipt.knownRefutedIds.filter((id) => !verdictRefuted.includes(id)))}`)
  }
  const totals = verdict?.totals ?? {}
  if (totals.proven !== receipt.judges.proven || totals.knownRefuted !== receipt.judges.knownRefuted || totals.envLimited !== receipt.judges.envLimited) {
    return refuse(VERIFY_CODES.JUDGES_MISMATCH, `receipt judges=${JSON.stringify(receipt.judges)} but verdict totals=${JSON.stringify({ proven: totals.proven, knownRefuted: totals.knownRefuted, envLimited: totals.envLimited })}`)
  }
  if (totals.envLimited !== 0) return refuse(VERIFY_CODES.ENV_LIMITED_NONZERO, `verdict totals.envLimited=${String(totals.envLimited)}`)
  if (verdict?.verdict !== 'pass') return refuse(VERIFY_CODES.VERDICT_NOT_PASS, `the referenced verdict is ${JSON.stringify(verdict?.verdict ?? null)}`)
  return { ok: true, summary: { head: receipt.head, hosts: receipt.hosts, judges: receipt.judges, verdictFile: receipt.verdictFile.path } }
}

/**
 * Filesystem wrapper: read the receipt, follow the digest-bound verdict, verify.
 *
 * @param {object} [p]
 * @param {string} [p.receiptPath]  explicit receipt; default = newest published
 * @param {string} [p.head]         SHA to check; default = `git rev-parse HEAD`
 * @param {string} [p.root]         checkout root
 */
export function verifyVersionGate({ receiptPath, head, root = ROOT } = {}) {
  const resolvedHead = head ?? resolveHead(root)
  if (resolvedHead === null || !isSha(resolvedHead)) return refuse(VERIFY_CODES.HEAD_UNRESOLVED, 'no 40-hex SHA was supplied and `git rev-parse HEAD` did not produce one')
  const path = resolveReceiptPath(receiptPath, root)
  if (path === null) return refuse(VERIFY_CODES.RECEIPT_MISSING, `no ${RECEIPT_FILENAME} under ${DEFAULT_RECEIPT_ROOT} — the version gate has not published a receipt, so nothing is frozen`)
  if (!existsSync(path)) return refuse(VERIFY_CODES.RECEIPT_MISSING, `${path} does not exist`)
  let receipt
  try {
    receipt = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    return refuse(VERIFY_CODES.RECEIPT_UNREADABLE, `${path}: ${String(error?.message ?? error)}`)
  }
  const schema = validateReceiptSchema(receipt)
  if (schema.ok !== true) return { ...schema, receiptPath: path }
  const verdictAbs = isAbsolute(receipt.verdictFile.path) ? receipt.verdictFile.path : resolve(root, receipt.verdictFile.path)
  if (!existsSync(verdictAbs)) return refuse(VERIFY_CODES.VERDICT_FILE_MISSING, `the receipt references ${receipt.verdictFile.path}, which does not exist — the evidence the receipt binds is gone`)
  const digest = sha256Of(verdictAbs)
  if (digest !== receipt.verdictFile.digest) {
    return refuse(VERIFY_CODES.VERDICT_DIGEST_MISMATCH, `the referenced verdict is ${digest} but the receipt binds ${receipt.verdictFile.digest} — the bytes changed after the receipt was published`)
  }
  let verdict
  try {
    verdict = JSON.parse(readFileSync(verdictAbs, 'utf8'))
  } catch (error) {
    return refuse(VERIFY_CODES.VERDICT_UNREADABLE, `${receipt.verdictFile.path}: ${String(error?.message ?? error)}`)
  }
  const result = verifyValues({ receipt, verdict, head: resolvedHead })
  if (result.ok !== true) return { ...result, receiptPath: path }
  return { ok: true, receiptPath: path, receipt, verdict, summary: result.summary }
}

const argv = process.argv.slice(2)
function argValue(name) {
  const i = argv.indexOf(name)
  if (i === -1) return undefined
  const value = argv[i + 1]
  if (typeof value !== 'string' || value === '') throw Object.assign(new Error(`${name} needs a value`), { code: VERIFY_CODES.USAGE })
  return value
}

function main() {
  const known = new Set(['--receipt', '--head', '--root', '--json'])
  for (const token of argv) {
    if (token.startsWith('--') && !known.has(token)) throw Object.assign(new Error(`unknown flag ${JSON.stringify(token)}`), { code: VERIFY_CODES.USAGE })
  }
  const root = argv.includes('--root') ? resolve(ROOT, argValue('--root')) : ROOT
  const result = verifyVersionGate({
    receiptPath: argValue('--receipt'),
    head: argValue('--head'),
    root,
  })
  if (result.ok !== true) {
    if (argv.includes('--json')) console.log(JSON.stringify({ ok: false, code: result.code, detail: result.detail }, null, 2))
    console.error(`REFUSED ${result.code} ${result.detail}`)
    return 1
  }
  const s = result.summary
  if (argv.includes('--json')) console.log(JSON.stringify({ ok: true, head: s.head, hosts: s.hosts, judges: s.judges, receipt: result.receiptPath }, null, 2))
  console.log(`VERSION-GATE-VERIFY pass head=${s.head} hosts=${s.hosts.join(',')} proven=${String(s.judges.proven)} known-refuted=${String(s.judges.knownRefuted)} env-limited=${String(s.judges.envLimited)} receipt=${relative(root, result.receiptPath).split('\\').join('/') || result.receiptPath}`)
  return 0
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  try {
    process.exitCode = main()
  } catch (error) {
    console.error(`REFUSED ${String(error?.code ?? VERIFY_CODES.USAGE)} ${String(error?.message ?? error)}`)
    process.exitCode = error?.code === VERIFY_CODES.USAGE ? 2 : 1
  }
}
