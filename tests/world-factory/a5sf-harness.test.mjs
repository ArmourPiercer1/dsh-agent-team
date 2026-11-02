/**
 * a5sf-harness.test.mjs — BL-10 / R2 C1 proof that the Sandbox-First harness is
 * WIRED to the inherited machinery. ZERO Host boots, ZERO ports bound, no
 * network: safe for the `ci-integration` node:test layer.
 *
 * Run: node --test tests/world-factory/a5sf-harness.test.mjs
 *
 * What it proves (each arm is a law the P2 suites will rely on):
 *   1. BUDGET LEASE: the harness refuses to construct without the run record
 *      that owns the SHARED host-start ledger, refuses to boot when that ledger
 *      is at its cap, and — when it does boot — writes its start to THAT SAME
 *      ledger before the successor `world.startHost()` is called. No second
 *      budget ledger exists to drift.
 *   2. FIXED CANDIDATE: the pin is READ from `tests/paths.mjs`
 *      (`TEST_USE_BASELINE_SHA`); the 40-hex literal must not appear in the
 *      harness source (a copied number is the failure this asserts against).
 *   3. POLICY IDENTITY: `compileCeiling()` returns the P1 `MemberPolicy` object
 *      itself (frozen, `memberIdentity`, `instanceGeneration`, `a5sf1:` revision),
 *      and `installGuard()` hands back that SAME object plus the P1
 *      `createMemberFsGuard` admission function — the deny/allow arms below are
 *      executed by the shipped guard, not by a re-implementation.
 *   4. FAIL CLOSED ON AN UNSUPPORTED LANE: a `network: restricted` Member
 *      ceiling surfaces the P1 compiler's `IO_POLICY_UNSUPPORTED` (and
 *      `requireCeiling()` raises the typed `UNSUPPORTED_LANE` carrying that
 *      code); it is never coerced into an allow.
 *   5. ORACLE SENSITIVITY, BOTH ARMS: the adapter's oracle reports a PLANTED
 *      effect as detected even when the tool's own return says `ran:false`, and
 *      an UNPLANTED tag as absent even when the return says `ran:true`.
 *   6. DIAGNOSTICS INHERITANCE: `classifyFailure()` delegates to the existing
 *      PR #394 tool for the Alpha.5 refusal vocabulary, and returns the P1 code
 *      verbatim (`classified:false`) for an a5sf compiler refusal instead of
 *      quoting a cross-vocabulary row.
 *
 * CORE PATCH BUDGET = 0. Nothing here touches `tests/deepseek-harness-test-use/`.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEST_USE_BASELINE_SHA } from '../paths.mjs'
import { createRunRecord } from './lib/run-record.mjs'
import {
  A5SF_HARNESS_CODES,
  A5sfHarnessError,
  createA5sfHarness,
  harnessSourceText,
} from './lib/a5sf-harness.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')

function tmp(label) {
  return mkdtempSync(join(tmpdir(), `a5sf-harness-${label}-`))
}

// --- the v4 fixture (shape pinned by packages/runtime/test/a5sf-member-policy.test.ts) ---

function rw(opts = {}) {
  return { mode: 'restricted', allow: opts.allow ?? [], ask: [], deny: opts.deny ?? [] }
}
const NET_ALLOW = { mode: 'allow' }
const NET_RESTRICTED = { mode: 'restricted', allow: ['api.example.test:443'], ask: [], deny: [], default: 'deny' }

function blueprintDoc({ readAllow, writeAllow, network = NET_ALLOW }) {
  return {
    schemaVersion: 4,
    blueprintId: 'team.a5sf.r2',
    revision: '1',
    leader: { templateId: 'leader', persona: 'Lead.' },
    members: [{ templateId: 'alpha', persona: 'Alpha member.' }],
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: [
      { templateId: 'alpha', io: { read: rw({ allow: [readAllow] }), write: rw({ allow: [writeAllow] }), network } },
      { templateId: 'leader', io: { read: rw({ allow: ['team/'] }), write: rw({ allow: ['team/out'] }), network: { mode: 'deny', default: 'deny' } } },
    ],
    toolBindings: [],
  }
}

const AUTHORITY = Object.freeze({ revision: 'a4:r2-fixture', admitted: true })

/** A stub World: records whether the launcher was reached; never spawns. */
function stubWorld(id = 'u5a5sfstub-20261102T00-00-00Z') {
  const calls = { startHost: 0 }
  return {
    id,
    calls,
    async startHost() {
      calls.startHost += 1
      return { port: 3199, logPath: join(tmpdir(), 'never-written.log') }
    },
  }
}

function harnessFor(dir, { runRecord, maxHostStarts = 5 } = {}) {
  const evidenceRoot = join(dir, 'evidence')
  mkdirSync(evidenceRoot, { recursive: true })
  return createA5sfHarness({
    repoRoot: REPO_ROOT,
    evidenceRoot,
    suite: 'a5sf-harness-c1',
    line: 'r2c1',
    runRecord,
    maxHostStarts,
    hostTree: join(dir, 'no-host-tree'),
    leaseRoot: join(dir, 'leases'),
  })
}

// --- 1. budget lease ---------------------------------------------------------

test('budget lease: no run record ⇒ typed BUDGET_LEASE_REQUIRED, nothing constructed', () => {
  const dir = tmp('lease')
  try {
    const evidenceRoot = join(dir, 'evidence')
    const base = { repoRoot: REPO_ROOT, evidenceRoot, suite: 'a5sf-harness-c1', line: 'r2c1' }
    for (const runRecord of [undefined, null, {}, { logHostStart() {} }]) {
      assert.throws(
        () => createA5sfHarness({ ...base, runRecord }),
        (error) => error instanceof A5sfHarnessError && error.code === 'BUDGET_LEASE_REQUIRED',
        `runRecord=${JSON.stringify(runRecord)} must be refused`,
      )
    }
    assert.ok(A5SF_HARNESS_CODES.includes('BUDGET_LEASE_REQUIRED'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('budget lease: an exhausted SHARED ledger refuses the boot and leaves ledger + World untouched', async () => {
  const dir = tmp('exhausted')
  const ledgerPath = join(dir, 'budget.jsonl')
  try {
    const runRecord = createRunRecord({ runId: 'r2-exhaust', suite: 'a5sf-harness-c1', selectedCases: [], bindings: {}, ledgerPath })
    runRecord.logHostStart({ world: 'prior-1' })
    runRecord.logHostStart({ world: 'prior-2' })
    const harness = harnessFor(dir, { runRecord, maxHostStarts: 2 })
    assert.deepEqual(harness.budget(), { ledgerPath, used: 2, max: 2, remaining: 0 })

    const world = stubWorld()
    await assert.rejects(
      harness.boot({ world }),
      (error) => error instanceof A5sfHarnessError && error.code === 'BUDGET_EXHAUSTED' && error.budget.used === 2,
    )
    assert.equal(world.calls.startHost, 0, 'a refused budget must never reach the launcher')
    assert.equal(readFileSync(ledgerPath, 'utf8').trim().split('\n').length, 2, 'the shared ledger is unchanged by a refusal')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('budget lease: a permitted boot appends to the SAME shared ledger BEFORE startHost, then boots', async () => {
  const dir = tmp('permitted')
  const ledgerPath = join(dir, 'budget.jsonl')
  try {
    const runRecord = createRunRecord({ runId: 'r2-permit', suite: 'a5sf-harness-c1', selectedCases: [], bindings: {}, ledgerPath })
    const harness = harnessFor(dir, { runRecord, maxHostStarts: 3 })
    const world = stubWorld()
    const boot = await harness.boot({ world, phase: 'c1-proof' })
    assert.equal(boot.port, 3199)
    assert.equal(world.calls.startHost, 1)
    assert.equal(runRecord.ledgerStartCount(), 1, 'the start was charged to the shared ledger')
    const rows = readFileSync(ledgerPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    assert.equal(rows.length, 1)
    assert.equal(rows[0].world, world.id)
    assert.equal(rows[0].phase, 'c1-proof')
    assert.equal(rows[0].suite, 'a5sf-harness-c1')
    assert.equal(harness.budget().used, 1)
    // ...and the SAME ledger is the one the factory/run-record already manages:
    // there is no second file next to it.
    assert.deepEqual(harness.runRecord, runRecord)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// --- 2. fixed candidate ------------------------------------------------------

test('fixed candidate: the pin is READ from tests/paths.mjs, never copied into the harness', () => {
  const dir = tmp('candidate')
  try {
    const harness = harnessFor(dir, { runRecord: createRunRecord({ runId: 'r2-pin', suite: 'a5sf-harness-c1', selectedCases: [], bindings: {} }) })
    const candidate = harness.candidate()
    assert.equal(candidate.pin, TEST_USE_BASELINE_SHA)
    assert.match(candidate.source, /tests\/paths\.mjs/)
    assert.equal(candidate.asserted, false, 'candidate() must not require a host tree')
    const source = harnessSourceText()
    assert.equal(source.includes(TEST_USE_BASELINE_SHA), false, 'the 40-hex pin literal must not be copied into the harness')
    assert.match(source, /TEST_USE_BASELINE_SHA/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// --- 3. policy identity + the shipped guard ---------------------------------

test('policy identity: the installed ceiling IS the P1 MemberPolicy, and its guard is the shipped P1 guard', async () => {
  const dir = tmp('policy')
  try {
    const readDir = join(dir, 'read-ok')
    const writeDir = join(dir, 'write-ok')
    const outsideDir = join(dir, 'outside')
    for (const d of [readDir, writeDir, outsideDir]) mkdirSync(d, { recursive: true })
    writeFileSync(join(readDir, 'a.txt'), 'readable\n')
    writeFileSync(join(outsideDir, 'b.txt'), 'not ours\n')

    const harness = harnessFor(dir, { runRecord: createRunRecord({ runId: 'r2-policy', suite: 'a5sf-harness-c1', selectedCases: [], bindings: {} }) })
    const compiled = await harness.requireCeiling({
      blueprint: blueprintDoc({ readAllow: readDir, writeAllow: writeDir }),
      templateId: 'alpha',
      memberInstanceId: 'mi-alpha-1',
      instanceGeneration: 3,
      authority: AUTHORITY,
    })
    const policy = compiled.policy
    assert.equal(Object.isFrozen(policy), true, 'the P1 compiler returns a frozen policy')
    assert.equal(policy.memberIdentity, 'mi-alpha-1')
    assert.equal(policy.templateId, 'alpha')
    assert.equal(policy.instanceGeneration, 3)
    assert.equal(policy.read.mode, 'restricted')
    assert.deepEqual([...policy.read.allow], [readDir])
    assert.deepEqual([...policy.write.allow], [writeDir])
    assert.equal(policy.network.access, 'allow')
    assert.match(policy.revision, /^a5sf1:[0-9a-f]{32}$/)

    const installed = await harness.installGuard(policy)
    assert.equal(installed.policy, policy, 'installGuard must install the compiled object itself, not a copy')
    assert.equal(installed.revision, policy.revision)
    assert.equal(typeof installed.guard, 'function')

    // The arms are executed by the SHIPPED guard: allowed path passes,
    // outside path is refused with the P1 denial vocabulary.
    await installed.guard('readText', join(readDir, 'a.txt'))
    await assert.rejects(
      installed.guard('readText', join(outsideDir, 'b.txt')),
      (error) => error?.name === 'TeamIoDenial' && error.code === 'IO_READ_DENIED',
    )
    // write axis is independent of read: a new file under the write subtree is
    // admitted, a write outside it is refused.
    await installed.guard('writeText', join(writeDir, 'new.txt'))
    await assert.rejects(
      installed.guard('writeText', join(outsideDir, 'c.txt')),
      (error) => error?.name === 'TeamIoDenial' && error.code === 'IO_WRITE_DENIED',
    )

    // Identity is enforced, not decorative: the same fixture compiled for a
    // STALE generation is refused by the P1 compiler (this adapter adds no law).
    const stale = await harness.compileCeiling({
      blueprint: blueprintDoc({ readAllow: readDir, writeAllow: writeDir }),
      templateId: 'alpha',
      memberInstanceId: 'mi-alpha-1',
      instanceGeneration: 3,
      authority: { revision: 'a4:r2-fixture', admitted: true, instanceGeneration: 2 },
    })
    assert.equal(stale.ok, false)
    assert.equal(stale.code, 'MEMBER_GENERATION_STALE')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('policy identity: the Alpha.4 authority is required, never synthesised by the harness', async () => {
  const dir = tmp('authority')
  try {
    const harness = harnessFor(dir, { runRecord: createRunRecord({ runId: 'r2-auth', suite: 'a5sf-harness-c1', selectedCases: [], bindings: {} }) })
    await assert.rejects(
      harness.compileCeiling({ blueprint: blueprintDoc({ readAllow: '/work/a', writeAllow: '/work/b' }), templateId: 'alpha', memberInstanceId: 'mi-alpha-1', instanceGeneration: 3 }),
      (error) => error instanceof A5sfHarnessError && error.code === 'AUTHORITY_REQUIRED',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// --- 4. fail closed on an unsupported lane ----------------------------------

test('unsupported lane: network:restricted surfaces the P1 UNSUPPORTED code, never an allow', async () => {
  const dir = tmp('unsupported')
  try {
    const harness = harnessFor(dir, { runRecord: createRunRecord({ runId: 'r2-unsup', suite: 'a5sf-harness-c1', selectedCases: [], bindings: {} }) })
    const input = {
      blueprint: blueprintDoc({ readAllow: '/work/a', writeAllow: '/work/b', network: NET_RESTRICTED }),
      templateId: 'alpha',
      memberInstanceId: 'mi-alpha-1',
      instanceGeneration: 3,
      authority: AUTHORITY,
    }
    const refused = await harness.compileCeiling(input)
    assert.equal(refused.ok, false, 'a destination-restricted network lane must not compile')
    assert.equal(refused.code, 'IO_POLICY_UNSUPPORTED')
    assert.equal(Object.hasOwn(refused, 'policy'), false, 'a refusal carries no policy')

    await assert.rejects(
      harness.requireCeiling(input),
      (error) => error instanceof A5sfHarnessError &&
        error.code === 'UNSUPPORTED_LANE' &&
        error.compilerCode === 'IO_POLICY_UNSUPPORTED',
    )

    // An undeclared ceiling is the other fail-closed arm: absence is not permission.
    const undeclared = await harness.compileCeiling({
      blueprint: { ...blueprintDoc({ readAllow: '/work/a', writeAllow: '/work/b' }), memberIoCeilings: [] },
      templateId: 'alpha',
      memberInstanceId: 'mi-alpha-1',
      instanceGeneration: 3,
      authority: AUTHORITY,
    })
    assert.equal(undeclared.ok, false)
    assert.equal(undeclared.code, 'MEMBER_CEILING_UNDECLARED')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// --- 5. oracle sensitivity, both arms ---------------------------------------

test('oracle adapter: a planted effect is detected and an unplanted tag is absent (sensitivity, both arms)', async () => {
  const dir = tmp('oracle')
  try {
    const home = join(dir, 'world-home')
    const markerDir = join(home, 'workspace', 'markers')
    const ledgerPath = join(home, 'canary.jsonl')
    mkdirSync(markerDir, { recursive: true })
    // "live host" for this fixture = this very process (the oracle's
    // attribution channel reads .u5-ownership.json exactly as in a World).
    writeFileSync(join(home, '.u5-ownership.json'), JSON.stringify({ hostPid: process.pid }))
    const PLANTED = 'planted'
    writeFileSync(join(markerDir, `${PLANTED}.marker`), 'effect happened\n')
    writeFileSync(ledgerPath, [
      JSON.stringify({ leg: 'register', ok: true }),
      JSON.stringify({ leg: 'body-ran', tag: PLANTED }),
      JSON.stringify({ leg: 'marker-ran', tag: PLANTED }),
    ].join('\n') + '\n')

    const harness = harnessFor(dir, { runRecord: createRunRecord({ runId: 'r2-oracle', suite: 'a5sf-harness-c1', selectedCases: [], bindings: {} }) })
    const world = { home, markerDir, ledgerPath }
    const oracle = harness.oracleFor(world)
    assert.equal(oracle.id, 'sound')

    // ARM A — effect PRESENT even though the tool claims it did nothing.
    const planted = harness.judgeEffect({ oracle, tag: PLANTED, returnedRan: false })
    assert.equal(planted.effect, true)
    assert.ok(planted.basis.includes('marker'))
    assert.equal(planted.verdict.marker, true)
    assert.equal(planted.verdict.bodyRan, true)
    assert.equal(planted.verdict.attributable, true)

    // ARM B — NO effect even though the tool claims `ran:true` (the planted
    // defect the sound oracle must keep RED).
    const absent = harness.judgeEffect({ oracle, tag: 'never-planted', returnedRan: true })
    assert.equal(absent.effect, false)
    assert.equal(absent.verdict.marker, false)

    // The deliberately-broken control diverges — the sensitivity proof itself.
    const blinded = harness.oracleFor(world, { broken: 'ignore-marker' })
    const blindVerdict = harness.judgeEffect({ oracle: blinded, tag: 'never-planted', returnedRan: true })
    assert.equal(blindVerdict.effect, true)
    assert.notEqual(blindVerdict.effect, absent.effect)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// --- 6. diagnostics inheritance ---------------------------------------------

test('diagnostics: classifyFailure delegates to the PR #394 tool, and keeps a5sf codes in their own vocabulary', async () => {
  const dir = tmp('diag')
  try {
    const harness = harnessFor(dir, { runRecord: createRunRecord({ runId: 'r2-diag', suite: 'a5sf-harness-c1', selectedCases: [], bindings: {} }) })
    // Alpha.5 refusal vocabulary ⇒ the existing tool's own JSON report.
    const line = 'a5p5-refused kind=refused-admission code=APPROVAL_STALE detail=a4:control:stale'
    const delegated = await harness.classifyFailure(line)
    assert.equal(delegated.ok, true)
    assert.equal(delegated.delegatedTo, 'scripts/diag-call-chain.mjs#diagnose')
    assert.equal(delegated.report.tool, 'scripts/diag-call-chain.mjs')
    assert.equal(delegated.report.refusals.length, 1)
    assert.equal(delegated.report.refusals[0].code, 'APPROVAL_STALE')
    assert.notEqual(delegated.report.refusals[0].verdict, 'UNKNOWN_CODE')

    // a5sf compiler refusal ⇒ the P1 code verbatim, no cross-vocabulary row.
    const refused = await harness.classifyFailure({ ok: false, code: 'IO_POLICY_UNSUPPORTED', detail: 'restricted network', path: 'boundBlueprint.blueprint.memberIoCeilings.network' })
    assert.equal(refused.ok, false)
    assert.equal(refused.vocabulary, 'a5sf-member-io-policy')
    assert.equal(refused.classified, false)
    assert.equal(refused.code, 'IO_POLICY_UNSUPPORTED')
    assert.equal(refused.overlappingAlpha5String, true, 'the string overlap is disclosed, not hidden')
    assert.match(refused.note, /no row was added/i)

    // Empty input is a refusal, not "nothing wrong" (the tool's own law).
    const empty = await harness.classifyFailure('')
    assert.equal(empty.ok, false)
    assert.equal(empty.classification, 'REFUSED')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
