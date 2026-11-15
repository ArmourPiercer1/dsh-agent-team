#!/usr/bin/env node
/**
 * contract-tiers.mjs — prove a contract's `required_tiers` against the tiers its bound tests ACTUALLY
 * execute in (TINF trust-closeout, F-03).
 *
 * WHAT WAS WRONG. `dev/ci/test-contracts.json` declares `required_tiers: ["L1"]` (or `["L1","L2"]`)
 * for every critical contract, and nothing compared that claim with the CI layers that run the bound
 * files. `AUTH-01` could require L1 while its two test files were collected only by the L2 census, and
 * the catalog still called the contract bound. A tier is a promise about WHEN a test runs, and an
 * unchecked promise is a comment.
 *
 * HOW IT IS DERIVED (no new list). Two authorities already exist:
 *   - L1 = the node:test suites a non-census manifest leg dispatches (`dispatch-tests.mjs` resolves
 *     `suites[]`/`areas[]` against tracked files).
 *   - L2 = the census population (`census-plan.mjs` `deriveRoots()` enumerates every root vitest file).
 * A test file's tier set is the union of those sources. For every contract, every bound test file
 * must execute in every tier the contract requires; a missing tier is CONTRACT_TIER_UNMET unless the
 * reviewed `dev/ci/contract-tier-exceptions.json` carries a matching, non-expired entry.
 *
 * ORACLES. `required_oracles` does not exist on any contract today, and the census plan's oracle list
 * is empty, so claiming oracle coverage would be fabrication. This gate instead refuses
 * CONTRACT_ORACLE_UNPLANNED when a contract DECLARES an oracle requirement that no executed path
 * plans. It is vacuously green today and becomes a real gate the moment a contract asks for one; it
 * uses the same exception mechanism (`tier: "oracle"`).
 *
 * USAGE
 *   node scripts/contract-tiers.mjs                 # table + token
 *   node scripts/contract-tiers.mjs --check         # exit 2 on an unmet tier / invalid exception
 *   node scripts/contract-tiers.mjs --json          # machine artifact
 *   node scripts/contract-tiers.mjs --write-exceptions [--out FILE]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { dispatchLegs, loadManifest, resolveLeg, trackedFiles } from './dispatch-tests.mjs'
import { deriveRoots } from './census-plan.mjs'

export const TIERS = Object.freeze(['L1', 'L2'])
export const CONTRACT_TIERS_SCHEMA = 'contract-tiers/1'
export const EXCEPTIONS_REL = 'dev/ci/contract-tier-exceptions.json'
export const EXCEPTIONS_SCHEMA = 'contract-tier-exceptions/1'
export const CONTRACTS_REL = 'dev/ci/test-contracts.json'
export const DEFAULT_EXPIRES = '2026-12-31'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The tier model as EXECUTED, derived from the manifest plus the census planner.
 *
 * @returns {{ok: true, tiers: Map<string, Set<string>>, sources: object} | {ok: false, code: string, detail: string}}
 */
export function deriveExecutedTiers({ root = REPO_ROOT, manifest = null, tracked = null, roots = null } = {}) {
  let loaded
  try {
    loaded = manifest ?? loadManifest(root)
  } catch (e) {
    return { ok: false, code: 'MANIFEST_UNREADABLE', detail: String(e && e.message ? e.message : e) }
  }
  const universe = tracked ?? trackedFiles(root)
  const tiers = new Map()
  const add = (path, tier) => {
    if (!tiers.has(path)) tiers.set(path, new Set())
    tiers.get(path).add(tier)
  }
  const l1Legs = []
  for (const entry of dispatchLegs(loaded)) {
    const tier = entry.layer === 'ci-census' ? 'L2' : 'L1'
    // A leg without --run only inspects; it does not execute a suite and therefore proves no tier.
    if (!entry.explicit) continue
    const resolved = resolveLeg(entry.leg, universe)
    for (const problem of resolved.problems) {
      return { ok: false, code: problem.code, detail: problem.detail }
    }
    for (const suite of resolved.suites) add(suite, tier)
    if (tier === 'L1') l1Legs.push({ id: entry.id, layer: entry.layer, suites: resolved.suites.length })
  }
  const census = roots ?? deriveRoots({ cwd: root })
  if (!census.ok) return { ok: false, code: census.code, detail: census.detail }
  for (const r of census.roots) {
    for (const rel of r.files_expected) add(`${r.root}/${rel}`, 'L2')
  }
  return {
    ok: true,
    tiers,
    sources: {
      l1: { authority: 'dev/ci/eb3-ci-manifest.json dispatch legs (non-census)', legs: l1Legs },
      l2: { authority: 'scripts/census-plan.mjs deriveRoots()', roots: census.roots.length, files: census.file_count },
    },
  }
}

/** A contract's bound paths, accepting the documented `{path}` objects (and a bare string, defensively). */
export function boundPaths(contract) {
  return (Array.isArray(contract?.test_refs) ? contract.test_refs : [])
    .map((ref) => (typeof ref === 'string' ? ref : ref?.path))
    .filter((p) => typeof p === 'string' && p !== '')
}

/**
 * Evaluate every contract against the executed tier map.
 *
 * @returns {{contracts: object[], findings: object[], summary: object}}
 */
export function evaluateContracts({ contracts, tiers, exceptions = [], today = new Date() }) {
  const day = typeof today === 'string' ? today : today.toISOString().slice(0, 10)
  const findings = []
  const validExceptions = []
  for (const entry of Array.isArray(exceptions) ? exceptions : []) {
    const ok =
      entry && typeof entry.contract_id === 'string' && typeof entry.tier === 'string' &&
      typeof entry.owner === 'string' && entry.owner !== '' &&
      typeof entry.reason === 'string' && entry.reason !== '' &&
      typeof entry.expires === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.expires)
    if (!ok) {
      findings.push({ code: 'CONTRACT_TIER_EXCEPTION_INVALID', entry })
      continue
    }
    if (entry.expires < day) {
      findings.push({ code: 'CONTRACT_TIER_EXCEPTION_EXPIRED', contract: entry.contract_id, tier: entry.tier, detail: `expired ${entry.expires}` })
      continue
    }
    validExceptions.push(entry)
  }
  const rows = []
  for (const contract of Array.isArray(contracts) ? contracts : []) {
    const required = Array.isArray(contract?.required_tiers) ? [...contract.required_tiers].sort() : []
    const unknown = required.filter((t) => !TIERS.includes(t))
    if (unknown.length > 0) {
      findings.push({ code: 'CONTRACT_TIER_UNKNOWN', contract: contract.id, detail: `required_tiers ${unknown.join(',')} is not one of ${TIERS.join('|')}` })
    }
    const paths = boundPaths(contract)
    const actual = new Set()
    for (const p of paths) for (const t of tiers.get(p) ?? []) actual.add(t)
    const missing = required.filter((t) => TIERS.includes(t) && !actual.has(t))
    const excepted = []
    const unmet = []
    for (const tier of missing) {
      const ex = validExceptions.find((e) => e.contract_id === contract.id && e.tier === tier)
      if (ex) excepted.push({ tier, owner: ex.owner, reason: ex.reason, expires: ex.expires })
      else unmet.push(tier)
    }
    for (const tier of unmet) {
      findings.push({
        code: 'CONTRACT_TIER_UNMET',
        contract: contract.id,
        tier,
        detail:
          `${contract.id} requires ${tier} but its bound file(s) execute only in ${actual.size === 0 ? 'no derived tier' : [...actual].sort().join(',')}: ` +
          `${paths.slice(0, 4).join(', ')} — either bind a test that runs in ${tier}, or record a reviewed exception with an owner and an expiry`,
      })
    }
    const oracles = Array.isArray(contract?.required_oracles) ? contract.required_oracles : []
    for (const oracle of oracles) {
      const ex = validExceptions.find((e) => e.contract_id === contract.id && e.tier === 'oracle')
      if (!ex) {
        findings.push({
          code: 'CONTRACT_ORACLE_UNPLANNED',
          contract: contract.id,
          detail:
            `${contract.id} declares required_oracles ${JSON.stringify(oracle)} but no executed path plans an oracle result ` +
            '(the census plan records tasks, not oracle outcomes) — plan the oracle or record a reviewed exception with tier "oracle"',
        })
      }
    }
    rows.push({
      contract_id: contract.id,
      required_tiers: required,
      executed_tiers: [...actual].sort(),
      missing_tiers: missing,
      excepted,
      status: required.length === 0 ? 'no-requirement' : unmet.length > 0 ? 'unmet' : excepted.length > 0 ? 'excepted' : 'met',
    })
  }
  const summary = {
    contracts: rows.length,
    met: rows.filter((r) => r.status === 'met').length,
    excepted: rows.filter((r) => r.excepted.length > 0).length,
    unmet: rows.filter((r) => r.status === 'unmet').length,
    exceptions: validExceptions.length,
    findings: findings.length,
  }
  return { contracts: rows, findings, summary }
}

/** Every unmet (contract, tier) pair, shaped as a reviewed exception row. Owners are UNASSIGNED. */
export function measuredExceptions(evaluation, { expires = DEFAULT_EXPIRES, owner = 'UNASSIGNED' } = {}) {
  return evaluation.contracts
    .flatMap((row) => row.missing_tiers.map((tier) => ({ contract_id: row.contract_id, tier })))
    .map(({ contract_id, tier }) => ({
      contract_id,
      tier,
      owner,
      reason:
        `measured ${new Date().toISOString().slice(0, 10)}: the contract's bound files execute only in ` +
        `${evaluation.contracts.find((r) => r.contract_id === contract_id)?.executed_tiers.join(',') || 'no derived tier'}; ` +
        `no ${tier} leg declares them. Owner must be assigned by a human before this expires.`,
      expires,
    }))
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function token(summary) {
  return `DSH-CONTRACT-TIERS contracts=${String(summary.contracts)} met=${String(summary.met)} excepted=${String(summary.excepted)} unmet=${String(summary.unmet)} findings=${String(summary.findings)}`
}

function main(argv) {
  if (argv.includes('--help')) {
    process.stdout.write(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 8).join('\n') + '\n')
    return 0
  }
  const root = REPO_ROOT
  const outAt = argv.indexOf('--out')
  const outPath = outAt >= 0 ? argv[outAt + 1] : null
  if (outAt >= 0 && (!outPath || outPath.startsWith('--'))) {
    process.stderr.write('REFUSED CONTRACT_TIERS_ARGUMENT: --out needs a path\n')
    return 2
  }
  const contractsFile = readJson(resolve(root, CONTRACTS_REL))
  if (!contractsFile || !Array.isArray(contractsFile.contracts)) {
    process.stderr.write(`REFUSED CONTRACT_TIERS_CONTRACTS_MISSING: ${CONTRACTS_REL} is absent or carries no contracts[]\n`)
    return 2
  }
  const tiers = deriveExecutedTiers({ root })
  if (!tiers.ok) {
    process.stderr.write(`REFUSED ${tiers.code}: ${tiers.detail}\n`)
    return 2
  }
  const exceptionsFile = readJson(resolve(root, EXCEPTIONS_REL), null)
  const exceptions = exceptionsFile && exceptionsFile.schema === EXCEPTIONS_SCHEMA ? exceptionsFile.exceptions ?? [] : []
  const evaluation = evaluateContracts({ contracts: contractsFile.contracts, tiers: tiers.tiers, exceptions })

  if (argv.includes('--write-exceptions')) {
    const body = {
      schema: EXCEPTIONS_SCHEMA,
      note:
        'Reviewed ceiling for F-03 (contract tier coverage). Generated from MEASURED reality by ' +
        '`node scripts/contract-tiers.mjs --write-exceptions`; never hand-typed to hide a tier. ' +
        'Each row must name an owner and an expiry; owner UNASSIGNED means no human owns the gap yet ' +
        'and the memo says so. An entry that is expired or malformed is RED, not grandfathered.',
      exceptions: measuredExceptions(evaluation),
    }
    const target = resolve(root, outPath ?? EXCEPTIONS_REL)
    try {
      writeFileSync(target, `${JSON.stringify(body, null, 2)}\n`)
    } catch (e) {
      process.stderr.write(`REFUSED CONTRACT_TIERS_UNWRITABLE: ${target}: ${String(e && e.message ? e.message : e)}\n`)
      return 2
    }
    process.stdout.write(`DSH-CONTRACT-TIERS-EXCEPTIONS written=ok entries=${String(body.exceptions.length)} out=${target}\n`)
    return 0
  }

  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ schema: CONTRACT_TIERS_SCHEMA, ...evaluation, sources: tiers.sources, executed: [...tiers.tiers].map(([path, set]) => ({ path, tiers: [...set].sort() })) }, null, 2)}\n`)
  } else {
    for (const row of evaluation.contracts) {
      process.stdout.write(
        `  ${row.contract_id.padEnd(16)} required=${row.required_tiers.join(',') || '-'} ` +
          `executed=${row.executed_tiers.join(',') || '-'} status=${row.status}` +
          `${row.missing_tiers.length ? ` missing=${row.missing_tiers.join(',')}` : ''}` +
          `${row.excepted.length ? ` excepted=${row.excepted.map((e) => e.tier).join(',')}` : ''}\n`,
      )
    }
    for (const f of evaluation.findings) process.stderr.write(`REFUSED ${f.code} ${f.contract ?? ''} ${f.detail ?? ''}\n`.trimEnd() + '\n')
    process.stdout.write(`${token(evaluation.summary)}\n`)
  }
  if (!argv.includes('--check')) return evaluation.findings.length > 0 ? 2 : 0
  return evaluation.findings.length > 0 ? 2 : 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)))
}
