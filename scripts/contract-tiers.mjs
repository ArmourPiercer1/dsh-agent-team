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
 * A test file's tier set is the union of those sources. The quantifier is PER TEST, not per contract:
 * `∀contract ∀required tier ∀bound test: the test executes in that tier`. (The earlier version unioned
 * the tiers of all bound tests and asked whether the tier was anywhere in the union, which accepted a
 * contract binding an L1 test and an L2-only test as `met` for L1.) A (contract, tier, test) gap is
 * CONTRACT_TIER_UNMET unless a reviewed `dev/ci/contract-tier-exceptions.json` row names that exact
 * test; an absent `tests[]` covers every bound test only when the row's reason says "all bound tests".
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
 *   node scripts/contract-tiers.mjs --run --tier L1   # execute the bound files, raw exit
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'

import { gradeLeg } from './eb3-ci-required.mjs'
import { fileURLToPath } from 'node:url'

import { dispatchLegs, loadManifest, resolveLeg, trackedFiles } from './dispatch-tests.mjs'
import { deriveRoots } from './census-plan.mjs'

export const TIERS = Object.freeze(['L1', 'L2'])
export const CONTRACT_TIERS_SCHEMA = 'contract-tiers/1'
export const EXCEPTIONS_REL = 'dev/ci/contract-tier-exceptions.json'
export const EXCEPTIONS_SCHEMA = 'contract-tier-exceptions/1'
export const CONTRACTS_REL = 'dev/ci/test-contracts.json'
export const DEFAULT_EXPIRES = '2026-12-31'
/** Owners that assert nothing. A row carrying one of these is unowned, not reviewed. */
export const PLACEHOLDER_OWNERS = Object.freeze(['unassigned', 'tbd', 'todo', 'nobody'])

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const isPlaceholderOwner = (owner) => typeof owner === 'string' && PLACEHOLDER_OWNERS.includes(owner.trim().toLowerCase())
const coversAllBoundTests = (reason) => /\ball bound tests\b/i.test(reason)

/**
 * The tier model as EXECUTED, derived from the manifest plus the census planner.
 *
 * @returns {{ok: true, tiers: Map<string, Set<string>>, sources: object} | {ok: false, code: string, detail: string}}
 */
export function deriveExecutedTiers({ root = REPO_ROOT, manifest = null, tracked = null, roots = null, contracts = null, workflows = null } = {}) {
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
  const dispatchRejected = []
  // Each manifest leg's workflow binding, so an ordinary dispatch leg can be graded against the SAME
  // step `eb3-ci-required` grades. A leg outside any layer/knownNonRequired entry has no binding.
  const legBinding = new Map()
  for (const layer of loaded?.layers ?? []) {
    for (const leg of layer?.legs ?? []) legBinding.set(leg, { workflow: layer.workflow, job: layer.job })
  }
  for (const entry of loaded?.knownNonRequired ?? []) {
    for (const leg of entry?.legs ?? []) legBinding.set(leg, { workflow: entry.workflow, job: entry.job })
  }
  for (const entry of dispatchLegs(loaded)) {
    const tier = entry.layer === 'ci-census' ? 'L2' : 'L1'
    // A leg without --run only inspects; it does not execute a suite and therefore proves no tier.
    if (!entry.explicit) continue
    // EVERY tier-granting leg is a workflow step first. A manifest-only `--run` claim grants nothing:
    // before P1-1 only the dedicated contract leg was cross-checked, so editing `suites[]` in the
    // manifest could mint an L1 tier no workflow ever ran.
    const binding = legBinding.get(entry.leg) ?? { workflow: entry.workflow, job: undefined }
    const rejected = gradeManifestLeg({ root, binding, leg: entry.leg, workflows })
    if (rejected !== null) {
      dispatchRejected.push({ id: entry.id, layer: entry.layer, tier, why: rejected })
      continue
    }
    const resolved = resolveLeg(entry.leg, universe)
    for (const problem of resolved.problems) {
      return { ok: false, code: problem.code, detail: problem.detail }
    }
    for (const suite of resolved.suites) add(suite, tier)
    if (tier === 'L1') l1Legs.push({ id: entry.id, layer: entry.layer, suites: resolved.suites.length })
  }
  // L1/L2 EXECUTION legs: a manifest leg that runs `contract-tiers --run --tier <T>` executes the
  // contract-bound files at that tier. This is the authority that turns the exception registry into a
  // real gate: the same resolved `test_refs` the runner uses are the tier's executed set.
  const contractRuns = []
  const contractRunRejected = []
  let contractsFile = contracts === null ? null : { contracts }
  for (const layer of loaded?.layers ?? []) {
    for (const leg of layer?.legs ?? []) {
      const cmd = Array.isArray(leg?.cmd) ? leg.cmd : []
      // F-03 residual: EXECUTION is the invocation itself, never the expectation list. A leg whose
      // cmd is `--check` but whose check[] names `--run --tier L1` never runs anything, so it must not
      // grant a tier. Only a cmd carrying `--run --tier <X>` counts.
      if (cmd[1] !== 'scripts/contract-tiers.mjs' || !cmd.includes('--run') || !cmd.includes('--tier')) continue
      const tier = cmd[cmd.indexOf('--tier') + 1]
      if (!TIERS.includes(tier)) continue
      // Cross-check the SAME step binding eb3-ci-required grades: a manifest-only claim with no
      // workflow step (or a weakened step) is not an execution.
      const rejected = gradeManifestLeg({ root, binding: { workflow: layer.workflow, job: layer.job }, leg, workflows })
      if (rejected !== null) {
        contractRunRejected.push({ id: leg.id ?? '(unnamed)', layer: layer.id, tier, why: rejected })
        continue
      }
      if (contractsFile === null) contractsFile = readJson(resolve(root, CONTRACTS_REL))
      if (!contractsFile || !Array.isArray(contractsFile.contracts)) {
        return { ok: false, code: 'CONTRACT_TIERS_CONTRACTS_MISSING', detail: `${CONTRACTS_REL} is absent or carries no contracts[]` }
      }
      const bound = contractsFile.contracts
        .filter((c) => Array.isArray(c?.required_tiers) && c.required_tiers.includes(tier))
        .flatMap((c) => boundPaths(c))
      for (const path of bound) add(path, tier)
      contractRuns.push({ id: leg.id ?? '(unnamed)', layer: layer.id, tier, files: new Set(bound).size })
    }
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
      contract_runs: contractRuns,
      contract_runs_rejected: contractRunRejected,
      dispatch_runs_rejected: dispatchRejected,
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
    const shapeOk =
      entry && typeof entry.contract_id === 'string' && entry.contract_id !== '' &&
      typeof entry.tier === 'string' && entry.tier !== '' &&
      typeof entry.reason === 'string' && entry.reason.trim() !== '' &&
      typeof entry.expires === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.expires)
    if (!shapeOk) {
      findings.push({ code: 'CONTRACT_TIER_EXCEPTION_INVALID', entry })
      continue
    }
    // An exception must have a REAL owner. `UNASSIGNED`/`TBD`/`TODO`/`nobody` passed the old
    // non-empty test while owning nothing, so a generated registry could be read as reviewed.
    if (typeof entry.owner !== 'string' || entry.owner.trim() === '' || isPlaceholderOwner(entry.owner)) {
      findings.push({
        code: 'CONTRACT_EXCEPTION_UNOWNED',
        contract: entry.contract_id,
        tier: entry.tier,
        detail: `${entry.contract_id}/${entry.tier} names owner ${JSON.stringify(entry.owner ?? null)} — an exception must name a real owner (placeholders ${PLACEHOLDER_OWNERS.join('/')} are refused)`,
      })
      continue
    }
    // Scope. A row may name `tests[]`; then it covers ONLY those tests. Without `tests[]` it covers
    // every bound test, but only when the reason SAYS so — otherwise an unscoped row would silently
    // excuse tests it never mentions, which is the exact failure this quantifier exists to end.
    if (entry.tests !== undefined) {
      if (!Array.isArray(entry.tests) || entry.tests.length === 0 || entry.tests.some((t) => typeof t !== 'string' || t.trim() === '')) {
        findings.push({ code: 'CONTRACT_TIER_EXCEPTION_INVALID', entry, detail: `${entry.contract_id}/${entry.tier}: tests[] must be a non-empty array of file paths` })
        continue
      }
    } else if (entry.tier !== 'oracle' && !coversAllBoundTests(entry.reason)) {
      findings.push({
        code: 'CONTRACT_TIER_EXCEPTION_INVALID',
        entry,
        detail: `${entry.contract_id}/${entry.tier}: no tests[] and the reason does not say "all bound tests" — an exception cannot silently cover tests it does not name`,
      })
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
    // Vacuous ∀ guard (review of #776, P2): with zero bound paths the per-test quantifier below is
    // true for every tier, so a contract declaring required_tiers but binding nothing would report
    // `met` — the base reported `unmet`. test-catalog's CONTRACT_WITHOUT_TEST also refuses this, but
    // a coverage checker must not depend on another gate to keep its own quantifier non-vacuous.
    if (paths.length === 0 && required.length > 0) {
      findings.push({
        code: 'CONTRACT_TESTS_EMPTY',
        contract: contract.id,
        detail: `${contract.id} requires ${required.join('|')} but binds no test file — every bound test runs in every required tier is vacuous over an empty set`,
      })
      rows.push({
        contract_id: contract.id,
        required_tiers: required,
        executed_tiers: [],
        missing: [],
        missing_tiers: [],
        unmet: required.map((tier) => ({ tier, tests: [] })),
        excepted: [],
        status: 'unmet',
      })
      continue
    }
    const actual = new Set()
    for (const p of paths) for (const t of tiers.get(p) ?? []) actual.add(t)
    // PER-TEST quantifier: a required tier is satisfied only when EVERY bound test runs in it.
    const missing = []
    for (const tier of required) {
      if (!TIERS.includes(tier)) continue
      const tests = paths.filter((p) => !(tiers.get(p) ?? new Set()).has(tier))
      if (tests.length > 0) missing.push({ tier, tests })
    }
    const excepted = []
    const unmet = []
    for (const gap of missing) {
      const matching = validExceptions.filter((e) => e.contract_id === contract.id && e.tier === gap.tier)
      const covered = new Set()
      const owners = []
      for (const ex of matching) {
        // Scoped row: only the tests it names. Unscoped row: all bound tests — validated above to
        // require the reason to say "all bound tests".
        const scope = ex.tests === undefined ? gap.tests : ex.tests
        let hit = false
        for (const test of scope) {
          if (gap.tests.includes(test)) {
            covered.add(test)
            hit = true
          }
        }
        if (hit) owners.push(ex)
      }
      const uncovered = gap.tests.filter((t) => !covered.has(t))
      if (uncovered.length > 0) {
        unmet.push({ tier: gap.tier, tests: uncovered })
        findings.push({
          code: 'CONTRACT_TIER_UNMET',
          contract: contract.id,
          tier: gap.tier,
          tests: uncovered,
          detail:
            `${contract.id} requires ${gap.tier} but ${String(uncovered.length)} of ${String(gap.tests.length)} bound file(s) never execute in ${gap.tier}: ` +
            `${uncovered.slice(0, 4).join(', ')} — every bound test must run in every required tier; either bind a test that runs in ${gap.tier}, ` +
            'or record a reviewed exception naming THESE tests (or all bound tests) with a real owner and an expiry',
        })
      } else {
        excepted.push({
          tier: gap.tier,
          tests: gap.tests,
          owner: owners.map((e) => e.owner).join(', '),
          reason: owners.map((e) => e.reason).join(' | '),
          expires: owners.map((e) => e.expires).sort().join(', '),
        })
      }
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
      // `missing` is the measurement per (tier, test); `unmet` is the part no exception covers.
      missing,
      missing_tiers: missing.map((gap) => gap.tier),
      unmet,
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

/**
 * Every gap an exception would have to cover, shaped as an exception row. The owner is `null` on
 * purpose: a generated row is a MEASUREMENT, not a review, and `null` is refused as
 * CONTRACT_EXCEPTION_UNOWNED until a human assigns a real owner and names the tests.
 */
export function measuredExceptions(evaluation, { expires = DEFAULT_EXPIRES } = {}) {
  return evaluation.contracts
    .flatMap((row) => (Array.isArray(row.unmet) ? row.unmet : []).map((gap) => ({ row, gap })))
    .map(({ row, gap }) => ({
      contract_id: row.contract_id,
      tier: gap.tier,
      tests: gap.tests,
      owner: null,
      reason:
        `measured ${new Date().toISOString().slice(0, 10)}: these ${String(gap.tests.length)} bound test(s) never execute in ` +
        `${gap.tier} (executed tiers: ${row.executed_tiers.join(',') || 'none'}); no ${gap.tier} leg declares them. ` +
        'owner is null until a human assigns one — CONTRACT_EXCEPTION_UNOWNED refuses this row until then.',
      expires,
    }))
}

/**
 * Resolve the bound files for every contract that requires `tier`, then run EXACTLY those files with
 * the repository's vitest config. This is the L1 EXECUTION half of F-03: an exception registry is a
 * disclosure of a gap, not a gate — the gate becomes real only when the required tier actually runs
 * the contract-bound tests.
 *
 * The population is derived from `dev/ci/test-contracts.json` (`test_refs` of contracts whose
 * `required_tiers` include the tier): no new list, and nothing is inferred from the catalog.
 *
 * @returns {{ok: true, contracts: number, files: string[], exit: number, signal: string|null}}
 *        | {{ok: false, code: string, detail: string}}
 */
export function runTierContracts({ tier, root = REPO_ROOT, contracts = null, spawn = spawnSync } = {}) {
  if (!TIERS.includes(tier)) {
    return { ok: false, code: 'CONTRACT_TIER_RUN_TIER_UNKNOWN', detail: `--tier must be one of ${TIERS.join('|')}, got ${String(tier)}` }
  }
  let list = contracts
  if (list === null) {
    const file = readJson(resolve(root, CONTRACTS_REL))
    if (!file || !Array.isArray(file.contracts)) {
      return { ok: false, code: 'CONTRACT_TIERS_CONTRACTS_MISSING', detail: `${CONTRACTS_REL} is absent or carries no contracts[]` }
    }
    list = file.contracts
  }
  const selected = list.filter((c) => Array.isArray(c?.required_tiers) && c.required_tiers.includes(tier))
  const files = [...new Set(selected.flatMap((c) => boundPaths(c)))].sort()
  if (files.length === 0) {
    return {
      ok: false,
      code: 'CONTRACT_TIER_RUN_NO_FILES',
      detail: `no contract requires ${tier} and names a bound test file — an empty run is not a proven tier`,
    }
  }
  const missing = files.filter((f) => !existsSync(resolve(root, f)))
  if (missing.length > 0) {
    return {
      ok: false,
      code: 'CONTRACT_TIER_RUN_FILE_MISSING',
      detail: `${tier} names ${String(missing.length)} bound file(s) that do not exist: ${missing.slice(0, 6).join(', ')}`,
    }
  }
  const args = ['exec', 'vitest', 'run', '--config', 'vitest.config.ts', '--reporter=dot', ...files]
  const run = spawn('pnpm', args, { cwd: root, stdio: 'inherit' })
  if (run && run.error) {
    return { ok: false, code: 'CONTRACT_TIER_RUN_SPAWN_FAILED', detail: String(run.error.message ?? run.error) }
  }
  return { ok: true, contracts: selected.length, files, exit: typeof run?.status === 'number' ? run.status : 1, signal: run?.signal ?? null }
}

/**
 * Grade a manifest leg against the workflow step it claims to be. Returns null when the SAME
 * `gradeLeg` law used by `eb3-ci-required` finds the step present, unweakened and whole-argv valid;
 * otherwise a `CODE: why` string. A leg with no job binding is refused before the workflow is read.
 */
function gradeManifestLeg({ root, binding, leg, workflows = null }) {
  const workflow = binding?.workflow
  const jobId = binding?.job
  if (typeof workflow !== 'string' || workflow === '' || typeof jobId !== 'string' || jobId === '') {
    return `manifest leg ${String(leg?.id ?? '(unnamed)')} is not bound to a workflow job (workflow=${String(workflow)} job=${String(jobId)}) — a manifest-only claim is not an execution`
  }
  const doc = workflowDoc({ root, path: workflow, workflows })
  const job = doc?.jobs?.[jobId]
  if (job === undefined) return `workflow ${workflow} has no job ${jobId}`
  const miss = gradeLeg(job, leg)
  return miss === null ? null : `${miss.code}: ${miss.why}`
}

function workflowDoc({ root, path, workflows = null }) {
  if (workflows !== null) {
    if (typeof workflows.get === 'function' && workflows.has(path)) return workflows.get(path)
    if (Object.prototype.hasOwnProperty.call(workflows, path)) return workflows[path]
    return null
  }
  try {
    return parseYaml(String(readFileSync(resolve(root, path), 'utf8'))) ?? null
  } catch {
    return null
  }
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
  if (argv.includes('--run')) {
    const at = argv.indexOf('--tier')
    const tier = at >= 0 ? argv[at + 1] : null
    if (tier === null || tier.startsWith('--')) {
      process.stderr.write('REFUSED CONTRACT_TIER_RUN_TIER_UNKNOWN: --run needs --tier <L1|L2>\n')
      return 2
    }
    const ran = runTierContracts({ tier, root })
    if (!ran.ok) {
      process.stderr.write(`REFUSED ${ran.code}: ${ran.detail}\n`)
      return 2
    }
    process.stdout.write(
      `DSH-CONTRACT-TIERS-RUN tier=${tier} contracts=${String(ran.contracts)} files=${String(ran.files.length)} ` +
        `exit=${String(ran.exit)}${ran.signal === null ? '' : ` signal=${ran.signal}`}\n`,
    )
    return ran.exit
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
        'Each row names the exact tests it covers, a REAL owner and an expiry; generated rows carry ' +
        'owner:null and are refused as CONTRACT_EXCEPTION_UNOWNED until a human assigns one. A row ' +
        'without tests[] covers every bound test only when its reason says "all bound tests". An entry ' +
        'that is expired, unowned or malformed is RED, not grandfathered.',
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
