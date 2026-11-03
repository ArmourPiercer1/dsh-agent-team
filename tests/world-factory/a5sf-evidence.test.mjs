/**
 * a5sf-evidence.test.mjs — BL-11 / R3 C1 proof for the Sandbox-First evidence
 * chain recorder (`tests/world-factory/lib/a5sf-evidence.mjs`) and the
 * same-call alignment check.
 *
 * ZERO Host boots, ZERO ports, no network: the suite builds a real durable
 * P6-T4 unit world (the same one R1's approval-takeover test uses), the real
 * P1 compiler through the merged #540 harness, a real oracle observation over a
 * World-shaped home, and then reads the recorded JSONL back with
 * `scripts/a5sf-diag.mjs` — the R4 reader that owns the row contract.
 *
 * WHAT IT PROVES (each arm is a law BL-11's consumers rely on):
 *   A1 aligned: the four links (durable consumption / compiled MemberPolicy +
 *      EffectiveIo / Provider consulted / independent oracle effect) line up on
 *      one member instance + generation + invocation id + operation identity,
 *      and the SAME file is reported `ALLOW_LEGITIMATE` + `NO_BYPASS_FOUND` by
 *      `scripts/a5sf-diag.mjs` (the round-trip: the schema contract is real,
 *      not declared).
 *   A2-A5 each of the four links broken in turn is CHAIN_BROKEN with the right
 *      link + reason (approval scope, policy generation, provider consult,
 *      effect observation).
 *   A6 a narrowed allow with the durable row MISSING is UNDECIDABLE (fail
 *      closed: absence of evidence is not evidence of a bypass).
 *   A7 an ALLOW the compiled lane cannot explain is BROKEN even when the
 *      approval row is missing (an approval can never widen a hard ceiling).
 *   A8 the recorder refuses to mint/poison: duplicate ceiling, a call whose
 *      tool was not compiled, a mismatched EffectiveIo, a replayed
 *      consumption row, a malformed provider/effect fact.
 *   A9 passivity fence: the recorder's own source never calls the compiler,
 *      the locator algebra, the guard or the approval service; it imports the
 *      binding law from the R4 tool instead of restating it.
 *   A10 the CLI verdict/exit contract.
 *
 * CORE PATCH BUDGET = 0. Nothing here touches `tests/deepseek-harness-test-use/`.
 * Dependency note (same as the R2 harness C1): the P1 TS seams need the
 * workspace installed (`pnpm install --frozen-lockfile`; `ci-integration`
 * already does it) and Node >= 24 for native type stripping.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { register } from 'node:module'
import { dirname, join } from 'node:path'
import process from 'node:process'
import test, { after } from 'node:test'
import { pathToFileURL } from 'node:url'
import { createRunRecord } from './lib/run-record.mjs'
import { createA5sfHarness, loadPolicySeams } from './lib/a5sf-harness.mjs'
import {
  A5SF_EVIDENCE_CODES,
  A5sfEvidenceError,
  alignEvidenceChain,
  alignEvidenceFile,
  createEvidenceRecorder,
  evidenceSourceText,
} from './lib/a5sf-evidence.mjs'
import { analyzeRows, collectInput } from '../../scripts/a5sf-diag.mjs'

const HERE = dirname(new URL(import.meta.url).pathname)
const REPO_ROOT = join(HERE, '..', '..')
const DIAG_TOOL = join(REPO_ROOT, 'scripts', 'a5sf-diag.mjs')
const EVIDENCE_CLI = join(HERE, 'lib', 'a5sf-evidence.mjs')

// The workspace scratch dir, INSIDE the worktree (the round-trip leg must run
// the diagnostic on a real file under the checkout, not on os.tmpdir).
const SCRATCH = mkdtempSync(join(REPO_ROOT, '.tmp-a5sf-r3-evidence-'))
after(() => rmSync(SCRATCH, { recursive: true, force: true }))

// Same hook the harness/diag register; the P1 algebra and the P6-T4 helper are
// TypeScript sources, so they arrive through it (no new loader, no build).
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)
const { matchLocator } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'member-io-policy', 'src', 'path-rules.ts')).href)
const { CONTROL_REQUEST_KINDS } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'control', 'index.ts')).href)
const {
  P6T4_ROOT,
  P6T4_SEEDS,
  constantAuthorityRecheck,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  leaderCaller,
  makeScope,
  memberCaller,
} = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'test', 'p6t4-helpers.ts')).href)

// --- fixtures ----------------------------------------------------------------

const TEAM = 'team.a5sf.r3'
const GENERATION = 3
const LEGIT_CALL = 'call-a5sf-r3-legit'
const PLAIN_CALL = 'call-a5sf-r3-open'
const LEGIT_LOCATOR = '/work/a/asked'
const PLAIN_LOCATOR = '/work/a/open'

function rw(opts = {}) {
  return { mode: 'restricted', allow: opts.allow ?? [], ask: opts.ask ?? [], deny: opts.deny ?? [] }
}

const NET_DENY = { mode: 'deny', default: 'deny' }

function blueprintDoc() {
  return {
    schemaVersion: 4,
    blueprintId: TEAM,
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
      { templateId: 'alpha', io: { read: rw({ allow: ['/work/a'] }), write: rw({ allow: ['/work/b'] }), network: { mode: 'allow' } } },
      { templateId: 'leader', io: { read: rw({ allow: ['team/'] }), write: rw({ allow: ['team/out'] }), network: NET_DENY } },
    ],
    toolBindings: [],
  }
}

/** The v4 tool binding whose `ask` subtree the legit call is narrowed out of. */
const TOOL_BINDING = Object.freeze({
  owner: 'dsh.fs',
  name: 'read',
  authorization: 'ask',
  io: { read: rw({ allow: ['/work/a'], ask: ['/work/a/asked'] }), write: rw({ allow: [] }), network: NET_DENY },
  execution: { implementationOrigin: 'dsh-native', executionBoundary: 'confined-subprocess' },
})

function recordFor(dir, runId) {
  return createRunRecord({
    runId,
    suite: 'a5sf-evidence-c1',
    selectedCases: [],
    bindings: {},
    ledgerPath: join(dir, `budget-${runId}.jsonl`),
  })
}

function harnessFor(dir, runId) {
  const evidenceRoot = join(dir, 'harness-evidence')
  mkdirSync(evidenceRoot, { recursive: true })
  return createA5sfHarness({
    repoRoot: REPO_ROOT,
    evidenceRoot,
    suite: 'a5sf-evidence-c1',
    line: 'r3c1',
    runRecord: recordFor(dir, runId),
    maxHostStarts: 1,
    hostTree: join(dir, 'no-host-tree'),
    leaseRoot: join(dir, 'leases'),
  })
}

/** A World-shaped home with ONE planted effect for `tag` (the shipped oracle's channels). */
function plantEffect(home, tag) {
  const markerDir = join(home, 'workspace', 'markers')
  mkdirSync(markerDir, { recursive: true })
  writeFileSync(join(markerDir, `${tag}.marker`), 'effect happened\n')
  writeFileSync(join(home, '.u5-ownership.json'), JSON.stringify({ hostPid: process.pid }))
  const ledgerPath = join(home, 'canary.jsonl')
  let prior = []
  try {
    prior = readFileSync(ledgerPath, 'utf8').split('\n').filter((line) => line.trim() !== '')
  } catch {
    /* no ledger yet: the first planted effect creates it */
  }
  prior.push(JSON.stringify({ leg: 'body-ran', tag }), JSON.stringify({ leg: 'marker-ran', tag }))
  writeFileSync(ledgerPath, `${prior.join('\n')}\n`)
}

/**
 * The real builder. The member identity MUST be the durable world's own worker
 * instance id: that is what makes link 1 and link 2 the same member instead of
 * two fixtures that happen to agree.
 */
async function buildAlignedChain({ dir, label }) {
  const world = await createP6T4World(`a5sf-r3-${label}`, ['leader', 'worker'])
  let consumption
  let scope
  try {
    const service = createP6T4Service(world, { authorityRevalidation: constantAuthorityRecheck().port })
    const memberInstanceId = String(P6T4_SEEDS.worker.instanceId)
    scope = makeScope({
      targetInstanceId: memberInstanceId,
      actionName: 'team.action.execute',
      toolName: 'read',
      correlation: `corr-a5sf-r3-${label}`,
      operationFingerprint: `sha256:a5sf-r3-${label}`,
    })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(memberInstanceId),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: memberInstanceId,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
      operationFingerprint: scope.operationFingerprint,
    })
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: request.requestId, decision: 'allow' })
    await service.guardOperation(scope)
    const state = await service.listControlState(P6T4_ROOT)
    consumption = state.consumptions[state.consumptions.length - 1]

    const harness = harnessFor(dir, `r3-${label}`)
    const compiled = await harness.requireCeiling({
      blueprint: blueprintDoc(),
      templateId: 'alpha',
      memberInstanceId,
      instanceGeneration: GENERATION,
      authority: { revision: 'a4:a5sf-r3-fixture', admitted: true },
    })
    const policy = compiled.policy
    const seams = await loadPolicySeams(REPO_ROOT)
    const tool = seams.projectToolIoRestriction(TOOL_BINDING)
    assert.equal(tool.ok, true, JSON.stringify(tool))
    const effectiveFor = async (callId) => {
      const result = await harness.compileInvocation({
        policy,
        toolBinding: TOOL_BINDING,
        invocation: {
          memberIdentity: policy.memberIdentity,
          callId,
          policyRevision: policy.revision,
          toolBindingIdentity: tool.value.bindingIdentity,
          approvedOnce: true,
        },
      })
      assert.equal(result.ok, true, JSON.stringify(result))
      return result.effective
    }
    const legitEffective = await effectiveFor(LEGIT_CALL)
    const plainEffective = await effectiveFor(PLAIN_CALL)

    const home = join(dir, `home-${label}`)
    mkdirSync(home, { recursive: true })
    plantEffect(home, LEGIT_CALL)
    plantEffect(home, PLAIN_CALL)
    const oracle = harness.oracleFor({ home, markerDir: join(home, 'workspace', 'markers'), ledgerPath: join(home, 'canary.jsonl') })
    const legitEffect = harness.judgeEffect({ oracle, tag: LEGIT_CALL })
    const plainEffect = harness.judgeEffect({ oracle, tag: PLAIN_CALL })

    const installResult = {
      identity: { teamId: TEAM, memberInstanceId, templateId: 'alpha', instanceGeneration: GENERATION },
      toolBindingIdentity: tool.value.bindingIdentity,
      policyRevision: policy.revision,
    }
    const file = join(dir, `evidence-${label}.jsonl`)
    const recorder = createEvidenceRecorder({ path: file, suite: 'a5sf-evidence-c1', runId: `r3-${label}` })
    recorder.ceiling({
      policy,
      tools: [{ tool: 'read', effective: legitEffective }, { tool: 'read', effective: plainEffective }],
    })
    recorder.approval(consumption)
    recorder.call({
      policy,
      effective: legitEffective,
      disposition: matchLocator(legitEffective.read, LEGIT_LOCATOR),
      lane: 'allow',
      callId: LEGIT_CALL,
      tool: 'read',
      axis: 'read',
      locator: LEGIT_LOCATOR,
      actionName: scope.actionName,
      logicalOperationId: scope.correlation,
      operationFingerprint: scope.operationFingerprint,
      approvalRequestId: consumption.requestId,
      provider: installResult,
      consulted: true,
      effect: legitEffect,
    })
    recorder.call({
      policy,
      effective: plainEffective,
      disposition: matchLocator(plainEffective.read, PLAIN_LOCATOR),
      lane: 'allow',
      callId: PLAIN_CALL,
      tool: 'read',
      axis: 'read',
      locator: PLAIN_LOCATOR,
      provider: installResult,
      consulted: true,
      effect: plainEffect,
    })
    return {
      file,
      rows: recorder.rows(),
      policy,
      legitEffective,
      plainEffective,
      installResult,
      consumption,
      scope,
      verdicts: alignEvidenceChain(recorder.rows()),
      diag: () => spawnSync(process.execPath, [DIAG_TOOL, file], { encoding: 'utf8', timeout: 30_000 }),
    }
  } finally {
    await destroyP6T1World(world)
  }
}

const rowOf = (rows, predicate) => rows.find(predicate)
const chainOf = (result, callId) => result.chains.find((chain) => chain.callId === callId)

// --- A1: the aligned chain + the diag round-trip ----------------------------

test('A1 aligned: one identity across all four links, and a5sf-diag reports the narrowed allow as legitimate', async () => {
  const dir = mkdtempSync(join(SCRATCH, 'aligned-'))
  const chain = await buildAlignedChain({ dir, label: 'aligned' })

  // The recorded ceiling is the compiled EffectiveIo (no re-derivation).
  const ceilingRow = rowOf(chain.rows, (row) => row.kind === 'ceiling')
  assert.equal(ceilingRow.member, chain.policy.memberIdentity)
  assert.equal(ceilingRow.instanceGeneration, GENERATION)
  assert.equal(ceilingRow.policyRevision, chain.policy.revision)
  assert.deepEqual(ceilingRow.tools[0].read, {
    mode: chain.legitEffective.read.mode,
    allow: [...chain.legitEffective.read.allow],
    ask: [...chain.legitEffective.read.ask],
    deny: [...chain.legitEffective.read.deny],
  })
  assert.equal(ceilingRow.tools[0].binding, chain.installResult.toolBindingIdentity)

  // The four links, as recorded.
  const approvalRow = rowOf(chain.rows, (row) => row.kind === 'approval')
  assert.equal(approvalRow.requestId, chain.consumption.requestId)
  assert.equal(approvalRow.decisionSequence, chain.consumption.decisionSequence)
  assert.equal(approvalRow.scope.correlation, chain.scope.correlation)
  const legitCall = rowOf(chain.rows, (row) => row.kind === 'call' && row.callId === LEGIT_CALL)
  assert.equal(legitCall.disposition, 'ask')
  assert.equal(legitCall.lane, 'allow')
  assert.equal(legitCall.logicalOperationId, approvalRow.scope.correlation)
  assert.notEqual(legitCall.callId, approvalRow.scope.correlation, "R1's real shape: the invocation id is NOT the logical-operation correlation")
  assert.equal(legitCall.provider.consulted, true)
  assert.equal(legitCall.provider.memberInstanceId, legitCall.member)
  assert.equal(legitCall.provider.instanceGeneration, GENERATION)
  assert.equal(legitCall.provider.policyRevision, chain.policy.revision)
  assert.equal(legitCall.effect.oracleId, 'sound')
  assert.equal(legitCall.effect.effect, true)
  assert.equal(legitCall.effect.tag, LEGIT_CALL)

  // The chain verdict (both calls aligned; the plain allow needs no approval).
  assert.equal(chain.verdicts.summary.calls, 2)
  assert.equal(chain.verdicts.summary.verdict, 'CHAIN_ALIGNED', JSON.stringify(chain.verdicts.chains, null, 1))
  const aligned = chainOf(chain.verdicts, LEGIT_CALL)
  assert.equal(aligned.verdict, 'CHAIN_ALIGNED')
  assert.equal(aligned.identity.member, chain.policy.memberIdentity)
  assert.equal(aligned.identity.instanceGeneration, GENERATION)
  assert.equal(aligned.identity.invocation, LEGIT_CALL)
  assert.equal(aligned.identity.operation, chain.scope.correlation)
  assert.equal(aligned.identity.operationKey, 'logicalOperationId')
  assert.equal(aligned.identity.boundBy, 'call.logicalOperationId = scope.correlation')
  // Honesty: the durable row is NOT generation-tagged and the oracle tag is the
  // invocation id, so those keys are disclosed as unbound rather than implied.
  assert.ok(aligned.unbound.includes('approval.instanceGeneration'), JSON.stringify(aligned.unbound))
  assert.equal(chainOf(chain.verdicts, PLAIN_CALL).verdict, 'CHAIN_ALIGNED')

  // ROUND TRIP: the R4 reader consumes the recorded file unchanged.
  const r = chain.diag()
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`)
  const legit = r.stdout.split(/\r?\n/).filter((line) => line.startsWith('ALLOW_LEGITIMATE'))
  assert.equal(legit.length, 1, r.stdout)
  assert.match(legit[0], /code=APPROVAL_CONSUMED_NARROWED_ALLOW\b/)
  assert.match(legit[0], new RegExp(`callId=${LEGIT_CALL}\\b`))
  assert.match(legit[0], /boundBy=call\.logicalOperationId = scope\.correlation\b/)
  const reportLines = r.stdout.split(/\r?\n/)
  assert.equal(reportLines.some((line) => line.startsWith('APPROVAL_BYPASS ')), false, r.stdout)
  assert.equal(reportLines.some((line) => line.startsWith('UNDECIDABLE ')), false, r.stdout)
  assert.equal(reportLines.some((line) => line.startsWith('ROW_INVALID ')), false, r.stdout)
  assert.match(r.stdout, /SUMMARY calls=2 .*findings=0 .*legitimate_narrowed=1 .*undecidable=0 .*verdict=NO_BYPASS_FOUND\b/)
  // ...and the additive fields do not turn a row into "ignored" evidence.
  const collected = collectInput(chain.file)
  assert.equal(collected.error, undefined, JSON.stringify(collected))
  assert.equal(analyzeRows(collected.rows).ignored, 0, 'the additive call fields must not create unknown-kind rows')
})

// --- A2-A5: one broken link at a time ---------------------------------------

test('A2 approval link broken: a durable row for another member is CHAIN_BROKEN(link=approval)', async () => {
  const dir = mkdtempSync(join(SCRATCH, 'broken-approval-'))
  const chain = await buildAlignedChain({ dir, label: 'broken-approval' })
  const rows = chain.rows.map((row) => (row.kind === 'approval'
    ? { ...row, scope: { ...row.scope, targetInstanceId: 'inst-someone-else' } }
    : row))
  const result = alignEvidenceChain(rows)
  const broken = chainOf(result, LEGIT_CALL)
  assert.equal(broken.verdict, 'CHAIN_BROKEN', JSON.stringify(broken))
  assert.equal(broken.link, 'approval')
  assert.equal(broken.reason, 'APPROVAL_SCOPE_MISMATCH')
  assert.equal(broken.detail.why, 'scope.targetInstanceId')
})

test('A3 policy link broken: a generation mismatch is CHAIN_BROKEN(link=policy)', async () => {
  const dir = mkdtempSync(join(SCRATCH, 'broken-policy-'))
  const chain = await buildAlignedChain({ dir, label: 'broken-policy' })
  const rows = chain.rows.map((row) => (row.kind === 'ceiling' ? { ...row, instanceGeneration: GENERATION + 1 } : row))
  const result = alignEvidenceChain(rows)
  const broken = chainOf(result, LEGIT_CALL)
  assert.equal(broken.verdict, 'CHAIN_BROKEN', JSON.stringify(broken))
  assert.equal(broken.link, 'policy')
  assert.equal(broken.reason, 'GENERATION_MISMATCH')
  assert.deepEqual(broken.detail, { ceiling: GENERATION + 1, call: GENERATION })
})

test('A4 provider link broken: an unconsulted Provider is CHAIN_BROKEN(link=provider)', async () => {
  const dir = mkdtempSync(join(SCRATCH, 'broken-provider-'))
  const chain = await buildAlignedChain({ dir, label: 'broken-provider' })
  const rows = chain.rows.map((row) => (row.kind === 'call' && row.callId === LEGIT_CALL
    ? { ...row, provider: { ...row.provider, consulted: false } }
    : row))
  const result = alignEvidenceChain(rows)
  const broken = chainOf(result, LEGIT_CALL)
  assert.equal(broken.verdict, 'CHAIN_BROKEN', JSON.stringify(broken))
  assert.equal(broken.link, 'provider')
  assert.equal(broken.reason, 'PROVIDER_NOT_CONSULTED')
})

test('A5 effect link broken: an oracle that saw nothing is CHAIN_BROKEN(link=effect)', async () => {
  const dir = mkdtempSync(join(SCRATCH, 'broken-effect-'))
  const chain = await buildAlignedChain({ dir, label: 'broken-effect' })
  const rows = chain.rows.map((row) => (row.kind === 'call' && row.callId === LEGIT_CALL
    ? { ...row, effect: { ...row.effect, effect: false, basis: [] } }
    : row))
  const result = alignEvidenceChain(rows)
  const broken = chainOf(result, LEGIT_CALL)
  assert.equal(broken.verdict, 'CHAIN_BROKEN', JSON.stringify(broken))
  assert.equal(broken.link, 'effect')
  assert.equal(broken.reason, 'EFFECT_NOT_OBSERVED')
})

// --- A6/A7: the missing-approval-row asymmetry ------------------------------

test('A6 a narrowed allow with the approval row missing is UNDECIDABLE, never aligned and never a silent bypass', async () => {
  const dir = mkdtempSync(join(SCRATCH, 'missing-approval-'))
  const chain = await buildAlignedChain({ dir, label: 'missing-approval' })
  const rows = chain.rows.filter((row) => row.kind !== 'approval')
  const result = alignEvidenceChain(rows)
  const chainVerdict = chainOf(result, LEGIT_CALL)
  assert.equal(chainVerdict.verdict, 'UNDECIDABLE', JSON.stringify(chainVerdict))
  assert.equal(chainVerdict.link, 'approval')
  assert.equal(chainVerdict.reason, 'APPROVAL_ROW_MISSING')
  assert.equal(result.summary.verdict, 'UNDECIDABLE')

  // Even a plain compiled `allow` that NAMES a durable row the record does not
  // contain is a missing link, not a clean chain.
  const namedMissing = rows.map((row) => (row.kind === 'call' && row.callId === PLAIN_CALL
    ? { ...row, approvalRequestId: 'ctrl-not-recorded' }
    : row))
  const named = chainOf(alignEvidenceChain(namedMissing), PLAIN_CALL)
  assert.equal(named.verdict, 'UNDECIDABLE', JSON.stringify(named))
  assert.equal(named.reason, 'APPROVAL_ROW_MISSING')
  assert.equal(named.link, 'approval')

  // The R4 reader answers the OTHER question: on the same rows it reports the
  // missing durable row as an approval bypass (exit 1). Both fail closed, on
  // different questions — the README records the distinction.
  const file = join(dir, 'missing-approval.jsonl')
  writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`)
  const r = spawnSync(process.execPath, [DIAG_TOOL, file], { encoding: 'utf8', timeout: 30_000 })
  assert.equal(r.status, 1, `${r.stdout}${r.stderr}`)
  assert.match(r.stdout, /code=ALLOW_WITHOUT_DURABLE_APPROVAL\b/)
})

test('A7 an unexplained allow stays BROKEN when the approval row is missing', async () => {
  const dir = mkdtempSync(join(SCRATCH, 'unexplained-'))
  // No approval row at all, and the compiled lane forbids the locator: no
  // durable allow could have made this call lawful (an approval never widens).
  const chain = await buildAlignedChain({ dir, label: 'unexplained' })
  const rows = chain.rows
    .filter((row) => row.kind !== 'approval')
    .map((row) => (row.kind === 'call' && row.callId === LEGIT_CALL
      ? { ...row, locator: '/work/a/forbidden', disposition: 'deny', approvalRequestId: undefined }
      : row))
  const result = alignEvidenceChain(rows)
  const broken = chainOf(result, LEGIT_CALL)
  assert.equal(broken.verdict, 'CHAIN_BROKEN', JSON.stringify(broken))
  assert.equal(broken.link, 'policy')
  assert.equal(broken.reason, 'ALLOW_OUTSIDE_COMPILED_CEILING')
  assert.equal(result.summary.verdict, 'CHAIN_BROKEN')
})

// --- A8: the recorder's own fail-closed laws --------------------------------

test('A8 recorder refuses to mint or poison evidence (fail closed, typed codes)', async () => {
  const dir = mkdtempSync(join(SCRATCH, 'refusals-'))
  const chain = await buildAlignedChain({ dir, label: 'refusals' })
  const fresh = (label) => createEvidenceRecorder({ path: join(dir, `${label}.jsonl`) })
  const codeIs = (code) => (error) => error instanceof A5sfEvidenceError && error.code === code
  const policy = chain.policy

  // A second ceiling row for one member would make the diag call that member's
  // allows UNDECIDABLE, so the recorder refuses it instead of emitting it.
  const duplicate = fresh('duplicate')
  duplicate.ceiling({ policy, tools: [{ tool: 'read', effective: chain.legitEffective }] })
  assert.throws(() => duplicate.ceiling({ policy, tools: [{ tool: 'read', effective: chain.legitEffective }] }), codeIs('DUPLICATE_CEILING_MEMBER'))

  // A call whose tool was never compiled into the ceiling cannot be aligned.
  assert.throws(
    () => fresh('noceiling').call({ policy, effective: chain.plainEffective, disposition: 'allow', lane: 'allow', callId: PLAIN_CALL, tool: 'read', axis: 'read', locator: PLAIN_LOCATOR, provider: chain.installResult, consulted: true, effect: { oracleId: 'sound', tag: PLAIN_CALL, effect: false } }),
    codeIs('TOOL_NOT_IN_CEILING'),
  )

  // An EffectiveIo compiled for another revision is not this policy's result.
  const mismatch = fresh('mismatch')
  mismatch.ceiling({ policy, tools: [{ tool: 'read', effective: chain.legitEffective }] })
  assert.throws(
    () => mismatch.call({ policy, effective: { ...chain.legitEffective, policyRevision: 'a5sf1:deadbeef' }, disposition: 'allow', lane: 'allow', callId: PLAIN_CALL, tool: 'read', axis: 'read', locator: PLAIN_LOCATOR, provider: chain.installResult, consulted: true, effect: { oracleId: 'sound', tag: PLAIN_CALL, effect: false } }),
    codeIs('EFFECTIVE_MISMATCH'),
  )

  // A replayed durable row contradicts R1 exactly-once.
  const replay = fresh('replay')
  replay.ceiling({ policy, tools: [{ tool: 'read', effective: chain.legitEffective }] })
  replay.approval(chain.consumption)
  assert.throws(() => replay.approval(chain.consumption), codeIs('DUPLICATE_CONSUMPTION_ROW'))

  // The provider/effect links are facts, not free text.
  const noConsult = fresh('noconsult')
  noConsult.ceiling({ policy, tools: [{ tool: 'read', effective: chain.plainEffective }] })
  const plainCall = { policy, effective: chain.plainEffective, disposition: 'allow', lane: 'allow', callId: PLAIN_CALL, tool: 'read', axis: 'read', locator: PLAIN_LOCATOR, provider: chain.installResult }
  assert.throws(
    () => noConsult.call({ ...plainCall, effect: { oracleId: 'sound', tag: PLAIN_CALL, effect: false } }),
    codeIs('PROVIDER_CONSULTED_MISSING'),
  )
  assert.throws(
    () => noConsult.call({ ...plainCall, consulted: true, effect: { oracleId: 'sound' } }),
    codeIs('EFFECT_RESULT_INVALID'),
  )

  // The vocabulary is closed and documented.
  for (const code of ['POLICY_REQUIRED', 'APPROVAL_ROW_INVALID', 'CALL_ROW_INVALID', 'DUPLICATE_CEILING_MEMBER']) {
    assert.ok(A5SF_EVIDENCE_CODES.includes(code), code)
  }
})

// --- A9: the passivity fence ------------------------------------------------

test('A9 passivity fence: the recorder never calls the compiler/algebra/guard/approval service', () => {
  const source = evidenceSourceText()
  // A CALL to any of these would be a second permission computation or a
  // second approval authority (the two things R3 must not create).
  for (const forbidden of [
    'matchLocator(',
    'compileEffectiveIo(',
    'compileMemberPolicy(',
    'resolveAskClassCall(',
    'createMemberFsGuard(',
    'guardOperation(',
    'requestControl(',
    'resolveControl(',
    'installToolBindingRealm(',
  ]) {
    assert.equal(source.includes(forbidden), false, `a5sf-evidence.mjs must not call ${forbidden}`)
  }
  // The approval BINDING LAW is imported from the R4 tool, not restated.
  assert.match(source, /import \{ bindApproval, approvalAuthorizes \} from '\.\.\/\.\.\/\.\.\/scripts\/a5sf-diag\.mjs'/)
  // No new row kind: the emitted kinds are a subset of the diag's closed set.
  assert.deepEqual([...A5SF_EVIDENCE_CODES].filter((code) => typeof code !== 'string'), [])
  assert.equal(source.includes("kind: 'provider'"), false)
  assert.equal(source.includes("kind: 'effect'"), false)
})

// --- A10: the CLI contract --------------------------------------------------

test('A10 CLI: aligned file exits 0, a broken chain exits 1, a missing file refuses with 2', async () => {
  const dir = mkdtempSync(join(SCRATCH, 'cli-'))
  const chain = await buildAlignedChain({ dir, label: 'cli' })
  const ok = spawnSync(process.execPath, [EVIDENCE_CLI, '--check', chain.file], { encoding: 'utf8', timeout: 30_000 })
  assert.equal(ok.status, 0, `${ok.stdout}${ok.stderr}`)
  assert.match(ok.stdout, /CHAIN_ALIGNED callId=call-a5sf-r3-legit\b/)
  assert.match(ok.stdout, /SUMMARY calls=2 aligned=2 broken=0 undecidable=0 .*verdict=CHAIN_ALIGNED\b/)

  const brokenFile = join(dir, 'broken.jsonl')
  const brokenRows = chain.rows.map((row) => (row.kind === 'call' && row.callId === LEGIT_CALL
    ? { ...row, effect: { ...row.effect, effect: false } }
    : row))
  writeFileSync(brokenFile, `${brokenRows.map((row) => JSON.stringify(row)).join('\n')}\n`)
  const bad = spawnSync(process.execPath, [EVIDENCE_CLI, '--check', brokenFile], { encoding: 'utf8', timeout: 30_000 })
  assert.equal(bad.status, 1, `${bad.stdout}${bad.stderr}`)
  assert.match(bad.stdout, /CHAIN_BROKEN callId=call-a5sf-r3-legit link=effect reason=EFFECT_NOT_OBSERVED\b/)

  const missing = spawnSync(process.execPath, [EVIDENCE_CLI, '--check', join(dir, 'nope.jsonl')], { encoding: 'utf8', timeout: 30_000 })
  assert.equal(missing.status, 2, `${missing.stdout}${missing.stderr}`)
  assert.match(missing.stdout, /REFUSED NO_SUCH_PATH\b/)

  // A malformed call row is not dropped from the report: it is a fail-closed
  // chain, so an unreadable row can never pass as "aligned".
  const malformedFile = join(dir, 'malformed.jsonl')
  writeFileSync(malformedFile, `${JSON.stringify({ kind: 'call', member: 'inst-p6t4seedw01' })}\n`)
  const malformed = spawnSync(process.execPath, [EVIDENCE_CLI, '--check', malformedFile], { encoding: 'utf8', timeout: 30_000 })
  assert.equal(malformed.status, 1, `${malformed.stdout}${malformed.stderr}`)
  assert.match(malformed.stdout, /UNDECIDABLE callId=\(missing\) link=call reason=CALL_FIELD_MISSING\b/)
  assert.match(malformed.stdout, /SUMMARY calls=1 .*verdict=UNDECIDABLE\b/)

  // The file-level helper and the CLI agree (one implementation).
  assert.equal(alignEvidenceFile(chain.file).summary.verdict, 'CHAIN_ALIGNED')
  assert.equal(alignEvidenceFile(brokenFile).summary.verdict, 'CHAIN_BROKEN')
})
