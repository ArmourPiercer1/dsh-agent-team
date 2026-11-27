#!/usr/bin/env node
/**
 * version-gate-receipt.mjs — publish the VERSION GATE receipt from a green
 * candidate-gate verdict.
 *
 * WHY A RECEIPT AT ALL. The owner ruling (2026-11-25) makes the candidate
 * acceptance gate a VERSION gate: it is the formal gate for a candidate/release
 * version, required at the FROZEN candidate SHA, and PRODUCT-PROVEN means
 * "gate-backed at that frozen SHA with the gate Required and green there". A
 * passing run is not enough to freeze: the freeze needs a small, machine-checkable
 * record that binds ONE SHA to ONE verdict. That record is this receipt.
 *
 * IT DOES NOT INVENT A SECOND EVIDENCE FORMAT. The judges, hosts and counts come
 * from the gate's own `verdict.json`; the receipt only REFERENCES that file by
 * path + sha256 digest, so the driver evidence stays the single source and a
 * receipt whose referenced bytes changed is refused by the verifier
 * (`scripts/version-gate-verify.mjs`).
 *
 * FAIL CLOSED. No receipt is written unless the verdict parses, declares the
 * gate's own schema, names a 40-hex head, and is `pass` with `envLimited === 0`.
 * `--requested-head` (the SHA this run was launched for) must equal the verdict's
 * head, so a receipt can never be published for a head other than the requested
 * one.
 *
 *   node scripts/version-gate-receipt.mjs --verdict <verdict.json>
 *                                         [--requested-head <40-hex>]
 *                                         [--out <receipt.json>]
 *
 * Exit: 0 written | 1 typed refusal (`REFUSED <CODE> <detail>`) | 2 usage.
 *
 * @module scripts/version-gate-receipt
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const RECEIPT_SCHEMA_VERSION = 1
export const RECEIPT_KIND = 'version-gate-receipt'
export const RECEIPT_FILENAME = 'version-gate-receipt.json'
/** The only verdict schema this writer understands. A new gate schema needs a
 *  deliberate edit here, not a silently-accepted payload. */
export const GATE_VERDICT_SCHEMA = 'candidate-acceptance-gate/1'

export const WRITER_CODES = Object.freeze({
  USAGE: 'VERSION_GATE_USAGE',
  VERDICT_MISSING: 'VERSION_GATE_VERDICT_FILE_MISSING',
  VERDICT_UNREADABLE: 'VERSION_GATE_VERDICT_UNREADABLE',
  GATE_VERSION_UNSUPPORTED: 'VERSION_GATE_GATE_VERSION_UNSUPPORTED',
  HEAD_INVALID: 'VERSION_GATE_HEAD_INVALID',
  HEAD_MISMATCH: 'VERSION_GATE_HEAD_MISMATCH',
  VERDICT_NOT_PASS: 'VERSION_GATE_VERDICT_NOT_PASS',
  ENV_LIMITED_NONZERO: 'VERSION_GATE_ENV_LIMITED_NONZERO',
  JUDGES_INVALID: 'VERSION_GATE_JUDGES_INVALID',
})

function refusal(code, detail) {
  return { ok: false, code, detail }
}

function sha256Of(path) {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`
}

/** Repo-root-relative when inside the repository, absolute otherwise. */
function bindPath(path) {
  const abs = resolve(path)
  const rel = relative(ROOT, abs)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel) ? rel.split('\\').join('/') : abs
}

function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/u.test(value)
}

function integerAtLeastZero(value) {
  return Number.isInteger(value) && value >= 0
}

/** Judges that are REFUTED anywhere in the gate verdict, exactly once per id. */
export function refutedIdsOf(verdict) {
  const ids = new Set()
  for (const host of Array.isArray(verdict?.perHost) ? verdict.perHost : []) {
    for (const driver of Array.isArray(host?.drivers) ? host.drivers : []) {
      for (const judge of Array.isArray(driver?.judges) ? driver.judges : []) {
        if (judge?.verdict === 'REFUTED' && typeof judge?.id === 'string') ids.add(judge.id)
      }
    }
  }
  return [...ids].sort()
}

/**
 * Pure core: turn a parsed gate verdict into a receipt value, or a typed refusal.
 *
 * @param {object} p
 * @param {object} p.verdict       parsed `candidate-acceptance-gate/1` verdict
 * @param {string} p.verdictPath   path to the verdict file (for the digest)
 * @param {string} [p.requestedHead]
 * @param {string} [p.finishedAt]  ISO time of receipt creation (defaults to now)
 * @returns {{ok: true, receipt: object} | {ok: false, code: string, detail: string}}
 */
export function receiptFromVerdict({ verdict, verdictPath, requestedHead, finishedAt = new Date().toISOString() }) {
  if (verdict?.schema !== GATE_VERDICT_SCHEMA) {
    return refusal(WRITER_CODES.GATE_VERSION_UNSUPPORTED, `verdict schema=${JSON.stringify(verdict?.schema ?? null)}; this writer understands ${GATE_VERDICT_SCHEMA} only`)
  }
  if (!isSha(verdict?.head)) return refusal(WRITER_CODES.HEAD_INVALID, `verdict head=${JSON.stringify(verdict?.head ?? null)} is not a 40-hex SHA`)
  if (requestedHead !== undefined && !isSha(requestedHead)) {
    return refusal(WRITER_CODES.HEAD_INVALID, `--requested-head ${JSON.stringify(requestedHead)} is not a 40-hex SHA`)
  }
  if (requestedHead !== undefined && requestedHead !== verdict.head) {
    return refusal(WRITER_CODES.HEAD_MISMATCH, `the verdict grades ${verdict.head} but this run requested ${requestedHead}`)
  }
  if (verdict?.verdict !== 'pass') {
    return refusal(WRITER_CODES.VERDICT_NOT_PASS, `the gate verdict is ${JSON.stringify(verdict?.verdict ?? null)}; a receipt is published only after a green run`)
  }
  const totals = verdict?.totals
  if (
    !integerAtLeastZero(totals?.proven) ||
    !integerAtLeastZero(totals?.knownRefuted) ||
    !integerAtLeastZero(totals?.envLimited) ||
    !Number.isInteger(totals?.judges) ||
    totals.judges !== totals.proven + totals.knownRefuted + totals.envLimited
  ) {
    return refusal(WRITER_CODES.JUDGES_INVALID, `verdict totals=${JSON.stringify(totals ?? null)} do not partition into judges = proven + knownRefuted + envLimited`)
  }
  if (totals.envLimited !== 0) {
    return refusal(WRITER_CODES.ENV_LIMITED_NONZERO, `envLimited=${String(totals.envLimited)}; an ENV-LIMITED judge is not a version-gate pass`)
  }
  const hosts = Array.isArray(verdict?.hosts) ? verdict.hosts.filter((h) => typeof h === 'string') : []
  if (hosts.length === 0 || hosts.length !== verdict.hosts.length) {
    return refusal(WRITER_CODES.JUDGES_INVALID, `verdict hosts=${JSON.stringify(verdict?.hosts ?? null)} is not a non-empty string array`)
  }
  const startedAt = typeof verdict?.at === 'string' && !Number.isNaN(Date.parse(verdict.at)) ? verdict.at : null
  if (startedAt === null) return refusal(WRITER_CODES.HEAD_INVALID, `verdict at=${JSON.stringify(verdict?.at ?? null)} is not an ISO timestamp`)
  // `totals.knownRefuted` counts OCCURRENCES (one per host for a dual-host run);
  // `knownRefutedIds` is the DISTINCT id set. Their lengths are not comparable and
  // must not be equated: the same approved refusal appears once per host.
  const refuted = refutedIdsOf(verdict)
  if (refuted.length === 0 && totals.knownRefuted !== 0) {
    return refusal(WRITER_CODES.JUDGES_INVALID, `verdict totals.knownRefuted=${String(totals.knownRefuted)} but its judge records contain no REFUTED id`)
  }
  if (totals.knownRefuted < refuted.length) {
    return refusal(WRITER_CODES.JUDGES_INVALID, `verdict totals.knownRefuted=${String(totals.knownRefuted)} is fewer than the ${String(refuted.length)} distinct REFUTED judge id(s) it records`)
  }
  const receipt = {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    kind: RECEIPT_KIND,
    head: verdict.head,
    verdict: 'pass',
    judges: {
      proven: totals.proven,
      knownRefuted: totals.knownRefuted,
      envLimited: totals.envLimited,
    },
    knownRefutedIds: refuted,
    hosts,
    startedAt,
    finishedAt,
    gateVersion: verdict.schema,
    verdictFile: {
      path: bindPath(verdictPath),
      digest: sha256Of(verdictPath),
    },
  }
  return { ok: true, receipt }
}

/** Write the receipt next to the verdict unless `--out` says otherwise. */
export function writeReceipt({ verdictPath, requestedHead, out }) {
  if (!existsSync(verdictPath)) return refusal(WRITER_CODES.VERDICT_MISSING, `${verdictPath} does not exist`)
  let verdict
  try {
    verdict = JSON.parse(readFileSync(verdictPath, 'utf8'))
  } catch (error) {
    return refusal(WRITER_CODES.VERDICT_UNREADABLE, `${verdictPath}: ${String(error?.message ?? error)}`)
  }
  const built = receiptFromVerdict({ verdict, verdictPath, requestedHead })
  if (built.ok !== true) return built
  const target = out ?? join(dirname(verdictPath), RECEIPT_FILENAME)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, `${JSON.stringify(built.receipt, null, 2)}\n`)
  return { ok: true, receipt: built.receipt, path: target }
}

const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(name)
  if (i === -1) return undefined
  const value = argv[i + 1]
  if (typeof value !== 'string' || value === '') throw Object.assign(new Error(`${name} needs a value`), { code: WRITER_CODES.USAGE })
  return value
}

function main() {
  const known = new Set(['--verdict', '--requested-head', '--out'])
  for (const token of argv) {
    if (token.startsWith('--') && !known.has(token)) throw Object.assign(new Error(`unknown flag ${JSON.stringify(token)}`), { code: WRITER_CODES.USAGE })
  }
  const verdictArg = flag('--verdict')
  if (verdictArg === undefined) throw Object.assign(new Error('--verdict <path> is required'), { code: WRITER_CODES.USAGE })
  const out = flag('--out')
  const result = writeReceipt({
    verdictPath: resolve(ROOT, verdictArg),
    requestedHead: flag('--requested-head'),
    out: out === undefined ? undefined : resolve(ROOT, out),
  })
  if (result.ok !== true) {
    console.error(`REFUSED ${result.code} ${result.detail}`)
    return 1
  }
  console.log(`VERSION-GATE-RECEIPT written head=${result.receipt.head} verdict=${result.receipt.verdict} proven=${String(result.receipt.judges.proven)} known-refuted=${String(result.receipt.judges.knownRefuted)} env-limited=${String(result.receipt.judges.envLimited)} hosts=${result.receipt.hosts.join(',')} path=${bindPath(result.path)}`)
  return 0
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  try {
    process.exitCode = main()
  } catch (error) {
    console.error(`REFUSED ${String(error?.code ?? WRITER_CODES.USAGE)} ${String(error?.message ?? error)}`)
    process.exitCode = error?.code === WRITER_CODES.USAGE ? 2 : 1
  }
}
