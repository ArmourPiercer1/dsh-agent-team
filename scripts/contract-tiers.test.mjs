/**
 * contract-tiers.test.mjs — negative controls for F-03.
 *
 * The law: a contract's `required_tiers` must be a subset of the tiers its BOUND files actually
 * execute in, where the tiers are derived from the manifest's dispatched legs (L1) and the census
 * population (L2). Every control below deletes/renames exactly one side so the refusal cannot be
 * satisfied by the other.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import {
  deriveExecutedTiers,
  evaluateContracts,
  measuredExceptions,
  runTierContracts,
  EXCEPTIONS_SCHEMA,
} from './contract-tiers.mjs'

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname)

const MANIFEST = {
  layers: [
    {
      id: 'ci-integration',
      workflow: '.github/workflows/ci-integration.yml',
      legs: [
        {
          id: 'tinf-instruments',
          cmd: ['node', 'scripts/dispatch-tests.mjs', '--leg', 'tinf-instruments', '--run'],
          dispatch_id: 'tinf-instruments',
          suites: ['scripts/a.test.mjs'],
        },
      ],
    },
    { id: 'ci-census', workflow: '.github/workflows/ci-census.yml', legs: [] },
  ],
}

const ROOTS = {
  ok: true,
  roots: [{ root: 'packages/a', files: 2, file_count: 2, files_expected: ['test/x.test.ts', 'test/y.test.ts'], file_digest: 'sha256:' + 'a'.repeat(64) }],
  file_count: 2,
  catalog_digest: 'sha256:' + 'b'.repeat(64),
}

function tiersOf() {
  const got = deriveExecutedTiers({ manifest: MANIFEST, tracked: new Set(['scripts/a.test.mjs']), roots: ROOTS })
  assert.equal(got.ok, true, got.detail)
  return got
}

const contract = (id, paths, required = ['L1'], extra = {}) => ({ id, required_tiers: required, test_refs: paths.map((path) => ({ path })), ...extra })

test('F-03: L1 comes from a dispatched leg that actually runs; L2 comes from the census population', () => {
  const got = tiersOf()
  assert.deepEqual([...(got.tiers.get('scripts/a.test.mjs') ?? [])], ['L1'])
  assert.deepEqual([...(got.tiers.get('packages/a/test/x.test.ts') ?? [])], ['L2'])
  assert.deepEqual([...(got.tiers.get('packages/a/test/y.test.ts') ?? [])], ['L2'])
})

test('F-03: an inspect-only dispatch leg proves no tier (it does not run the suite)', () => {
  const inspect = {
    layers: [
      {
        id: 'ci-integration',
        legs: [{ id: 'inspect', cmd: ['node', 'scripts/dispatch-tests.mjs', '--leg', 'inspect', '--json'], dispatch_id: 'inspect', suites: ['scripts/a.test.mjs'] }],
      },
    ],
  }
  const got = deriveExecutedTiers({ manifest: inspect, tracked: new Set(['scripts/a.test.mjs']), roots: ROOTS })
  assert.equal(got.ok, true, got.detail)
  assert.equal(got.tiers.has('scripts/a.test.mjs'), false, '--json without --run must not grant L1')
})

test('F-03: L1 requirement bound only to L2 files is CONTRACT_TIER_UNMET (the AUTH-01 shape)', () => {
  const { tiers } = tiersOf()
  const evaluation = evaluateContracts({
    contracts: [contract('AUTH-01', ['packages/a/test/x.test.ts'], ['L1'])],
    tiers,
  })
  assert.equal(evaluation.summary.unmet, 1)
  assert.deepEqual(evaluation.findings.map((f) => f.code), ['CONTRACT_TIER_UNMET'])
  assert.equal(evaluation.findings[0].tier, 'L1')
})

test('F-03: binding a file that DOES run in the required tier is met', () => {
  const { tiers } = tiersOf()
  const evaluation = evaluateContracts({
    contracts: [contract('EXEC-01', ['scripts/a.test.mjs'], ['L1']), contract('CENSUS-01', ['packages/a/test/x.test.ts'], ['L2'])],
    tiers,
  })
  assert.equal(evaluation.summary.met, 2)
  assert.equal(evaluation.findings.length, 0)
})

test('F-03: a valid non-expired exception turns the unmet tier into `excepted`, not `met`', () => {
  const { tiers } = tiersOf()
  const evaluation = evaluateContracts({
    contracts: [contract('AUTH-01', ['packages/a/test/x.test.ts'], ['L1'])],
    tiers,
    exceptions: [{ contract_id: 'AUTH-01', tier: 'L1', owner: 'UNASSIGNED', reason: 'no L1 leg declares it', expires: '2026-12-31' }],
    today: '2026-11-15',
  })
  assert.equal(evaluation.summary.unmet, 0)
  assert.equal(evaluation.summary.excepted, 1)
  assert.equal(evaluation.contracts[0].status, 'excepted')
  assert.deepEqual(evaluation.findings, [])
})

test('F-03: an EXPIRED exception does not excuse anything', () => {
  const { tiers } = tiersOf()
  const evaluation = evaluateContracts({
    contracts: [contract('AUTH-01', ['packages/a/test/x.test.ts'], ['L1'])],
    tiers,
    exceptions: [{ contract_id: 'AUTH-01', tier: 'L1', owner: 'someone', reason: 'old', expires: '2026-01-01' }],
    today: '2026-11-15',
  })
  assert.equal(evaluation.summary.unmet, 1)
  assert.deepEqual(evaluation.findings.map((f) => f.code).sort(), ['CONTRACT_TIER_EXCEPTION_EXPIRED', 'CONTRACT_TIER_UNMET'])
})

test('F-03: an exception with no owner/reason is invalid (not an excuse)', () => {
  const { tiers } = tiersOf()
  const evaluation = evaluateContracts({
    contracts: [contract('AUTH-01', ['packages/a/test/x.test.ts'], ['L1'])],
    tiers,
    exceptions: [{ contract_id: 'AUTH-01', tier: 'L1', owner: '', reason: '', expires: '2026-12-31' }],
    today: '2026-11-15',
  })
  assert.equal(evaluation.summary.unmet, 1)
  assert.ok(evaluation.findings.some((f) => f.code === 'CONTRACT_TIER_EXCEPTION_INVALID'))
})

test('F-03: required_oracles that no executed path plans is CONTRACT_ORACLE_UNPLANNED', () => {
  const { tiers } = tiersOf()
  const evaluation = evaluateContracts({
    contracts: [contract('AUTH-01', ['packages/a/test/x.test.ts'], ['L2'], { required_oracles: ['ORACLE-AUTH'] })],
    tiers,
  })
  assert.deepEqual(evaluation.findings.map((f) => f.code), ['CONTRACT_ORACLE_UNPLANNED'])
  const excepted = evaluateContracts({
    contracts: [contract('AUTH-01', ['packages/a/test/x.test.ts'], ['L2'], { required_oracles: ['ORACLE-AUTH'] })],
    tiers,
    exceptions: [{ contract_id: 'AUTH-01', tier: 'oracle', owner: 'UNASSIGNED', reason: 'oracle not planned yet', expires: '2026-12-31' }],
    today: '2026-11-15',
  })
  assert.deepEqual(excepted.findings, [])
})

test('F-03: the generated exception rows are measured, owned and expiring', () => {
  const { tiers } = tiersOf()
  const evaluation = evaluateContracts({ contracts: [contract('AUTH-01', ['packages/a/test/x.test.ts'], ['L1'])], tiers })
  const rows = measuredExceptions(evaluation, { expires: '2026-12-31' })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].contract_id, 'AUTH-01')
  assert.equal(rows[0].tier, 'L1')
  assert.equal(rows[0].owner, 'UNASSIGNED')
  assert.match(rows[0].reason, /execute only in L2/)
  assert.equal(rows[0].expires, '2026-12-31')
})

test('F-03 CLI: the real tree passes --check, and --json is the contract-tiers artifact', () => {
  const out = execFileSync(process.execPath, ['scripts/contract-tiers.mjs', '--check'], { cwd: REPO_ROOT, encoding: 'utf8' })
  assert.match(out, /DSH-CONTRACT-TIERS contracts=6 met=6 excepted=0 unmet=0 findings=0/)
  const json = JSON.parse(execFileSync(process.execPath, ['scripts/contract-tiers.mjs', '--json'], { cwd: REPO_ROOT, encoding: 'utf8' }))
  assert.equal(json.schema, 'contract-tiers/1')
  assert.equal(json.summary.unmet, 0)
  assert.equal(json.summary.met, 6)
  assert.equal(json.summary.excepted, 0)
  assert.ok(json.sources.l1.legs.length > 0)
  assert.ok(json.sources.contract_runs.some((r) => r.tier === 'L1' && r.files === 12))
  assert.ok(json.executed.every((row) => row.tiers.length > 0))
})

test('F-03 CLI: a malformed exception file is refused, never ignored', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tinf-f03-'))
  try {
    const file = join(dir, 'exceptions.json')
    writeFileSync(file, `${JSON.stringify({ schema: EXCEPTIONS_SCHEMA, exceptions: [{ contract_id: 'AUTH-01', tier: 'L1' }] })}\n`)
    // The CLI reads the repo-relative file, so exercise the same evaluator the CLI uses rather than
    // copying the artifact over the checkout: this is the exact input the CLI passes through.
    const { tiers } = tiersOf()
    const evaluation = evaluateContracts({
      contracts: [contract('AUTH-01', ['packages/a/test/x.test.ts'], ['L1'])],
      tiers,
      exceptions: JSON.parse(execFileSync(process.execPath, ['-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(file)}, 'utf8'))`], { encoding: 'utf8' })).exceptions,
    })
    assert.ok(evaluation.findings.some((f) => f.code === 'CONTRACT_TIER_EXCEPTION_INVALID'))
    assert.equal(evaluation.summary.unmet, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── F-03 closeout: the required tier must EXECUTE the bound files ─────────────────────────────────

test('F-03 run: the L1 population is the union of bound test_refs, and the raw exit is returned', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tinf-f03-run-'))
  try {
    for (const p of ['packages/a/test/a.test.ts', 'packages/b/test/b.test.ts']) {
      mkdirSync(join(dir, p, '..'), { recursive: true })
      writeFileSync(join(dir, p), '// fixture\n')
    }
    const contracts = [
      contract('A', ['packages/a/test/a.test.ts'], ['L1']),
      contract('B', ['packages/b/test/b.test.ts'], ['L1']),
      contract('C', ['packages/a/test/a.test.ts'], ['L2']),
    ]
    let seen = null
    const got = runTierContracts({
      tier: 'L1',
      root: dir,
      contracts,
      spawn: (cmd, args, opts) => {
        seen = { cmd, args, opts }
        return { status: 7, signal: null, error: null }
      },
    })
    assert.equal(got.ok, true, got.detail)
    assert.equal(got.contracts, 2)
    assert.deepEqual(got.files, ['packages/a/test/a.test.ts', 'packages/b/test/b.test.ts'])
    assert.equal(got.exit, 7, 'the runner exit is propagated, not swallowed')
    assert.equal(seen.cmd, 'pnpm')
    assert.deepEqual(seen.args.slice(0, 6), ['exec', 'vitest', 'run', '--config', 'vitest.config.ts', '--reporter=dot'])
    assert.deepEqual(seen.args.slice(6), got.files)
    assert.equal(seen.opts.cwd, dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('F-03 run: a tier with zero bound files refuses CONTRACT_TIER_RUN_NO_FILES (never a vacuous pass)', () => {
  const got = runTierContracts({
    tier: 'L2',
    root: '/',
    contracts: [contract('A', ['a.test.ts'], ['L1'])],
    spawn: () => assert.fail('must not spawn for an empty population'),
  })
  assert.equal(got.ok, false)
  assert.equal(got.code, 'CONTRACT_TIER_RUN_NO_FILES')
})

test('F-03 run: a bound file that does not exist refuses CONTRACT_TIER_RUN_FILE_MISSING', () => {
  const got = runTierContracts({
    tier: 'L1',
    root: mkdtempSync(join(tmpdir(), 'tinf-f03-missing-')),
    contracts: [contract('A', ['packages/a/test/absent.test.ts'], ['L1'])],
    spawn: () => assert.fail('must not spawn for a missing bound file'),
  })
  assert.equal(got.ok, false)
  assert.equal(got.code, 'CONTRACT_TIER_RUN_FILE_MISSING')
})

test('F-03: the manifest contracts-l1 leg is what makes L1 executed (not the exception file)', () => {
  const workflow = '.github/workflows/ci-product.yml'
  const manifest = {
    layers: [{
      id: 'ci-product',
      workflow,
      job: 'ci-product',
      legs: [{ id: 'contracts-l1', cmd: ['node', 'scripts/contract-tiers.mjs', '--run', '--tier', 'L1'], check: [] }],
    }],
  }
  const got = deriveExecutedTiers({
    manifest,
    tracked: new Set(),
    roots: { ok: true, roots: [{ root: 'packages/a', files_expected: ['test/a.test.ts'] }], file_count: 1 },
    contracts: [contract('A', ['packages/a/test/a.test.ts'], ['L1'])],
    workflows: new Map([[workflow, { jobs: { 'ci-product': { steps: [{ run: 'node scripts/contract-tiers.mjs --run --tier L1' }] } } }]]),
  })
  assert.equal(got.ok, true, got.detail)
  assert.deepEqual([...(got.tiers.get('packages/a/test/a.test.ts') ?? [])].sort(), ['L1', 'L2'])
})

test('F-03: `--run --tier L1` only in check[] does NOT count as execution (declaration is not a run)', () => {
  const workflow = '.github/workflows/ci-product.yml'
  const manifest = {
    layers: [{
      id: 'ci-product',
      workflow,
      job: 'ci-product',
      legs: [{ id: 'contracts-l1', cmd: ['node', 'scripts/contract-tiers.mjs', '--check'], check: ['--run', '--tier', 'L1'] }],
    }],
  }
  const got = deriveExecutedTiers({
    manifest,
    tracked: new Set(),
    roots: { ok: true, roots: [{ root: 'packages/a', files_expected: ['test/a.test.ts'] }], file_count: 1 },
    contracts: [contract('A', ['packages/a/test/a.test.ts'], ['L1'])],
    workflows: new Map([[workflow, { jobs: { 'ci-product': { steps: [{ run: 'node scripts/contract-tiers.mjs --check --run --tier L1' }] } } }]]),
  })
  assert.equal(got.ok, true, got.detail)
  assert.equal(got.tiers.get('packages/a/test/a.test.ts')?.has('L1') ?? false, false, 'a check-only leg must not grant L1')
  assert.equal(got.sources.contract_runs.length, 0)
  const evaluated = evaluateContracts({ contracts: [contract('A', ['packages/a/test/a.test.ts'], ['L1'])], tiers: got.tiers, exceptions: [] })
  assert.equal(evaluated.contracts[0].status, 'unmet')
  assert.equal(evaluated.findings[0].code, 'CONTRACT_TIER_UNMET')
})

test('F-03: a real run leg with NO workflow step is rejected by the eb3 step binding (manifest-only claim)', () => {
  const workflow = '.github/workflows/ci-product.yml'
  const manifest = {
    layers: [{
      id: 'ci-product',
      workflow,
      job: 'ci-product',
      legs: [{ id: 'contracts-l1', cmd: ['node', 'scripts/contract-tiers.mjs', '--run', '--tier', 'L1'], check: [] }],
    }],
  }
  const got = deriveExecutedTiers({
    manifest,
    tracked: new Set(),
    roots: { ok: true, roots: [{ root: 'packages/a', files_expected: ['test/a.test.ts'] }], file_count: 1 },
    contracts: [contract('A', ['packages/a/test/a.test.ts'], ['L1'])],
    workflows: new Map([[workflow, { jobs: { 'ci-product': { steps: [{ run: 'echo nope' }] } } }]]),
  })
  assert.equal(got.ok, true, got.detail)
  assert.equal(got.tiers.get('packages/a/test/a.test.ts')?.has('L1') ?? false, false)
  assert.equal(got.sources.contract_runs_rejected.length, 1)
  assert.match(got.sources.contract_runs_rejected[0].why, /CI_LAYER_LEG_MISSING/)
})
