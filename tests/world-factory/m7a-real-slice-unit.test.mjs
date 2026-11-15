/**
 * m7a-real-slice-unit.test.mjs — the host-free half of M7-A (C1).
 *
 * These cases run with NO boot, NO DSH_HOME, NO port, NO host checkout, and pin
 * the three pieces the live slice depends on:
 *
 *   1. the SESSION-LOG trace reader: concatenated zstd frames decode, and the
 *      durable rows map onto the oracle's vocabulary (DENIED carries the Host's
 *      typed error code; COMPLETED carries none);
 *   2. the WIRE SCRIPT driver: the same `agent-script/1` law the in-process
 *      adapter enforces — structural matching, aux requests consume nothing,
 *      exhaustion/unconsumed turns are refused;
 *   3. the ORACLE PROVENANCE rule: rows must carry the effect-witness seal in
 *      `witnessed` mode; a hand-built `{observed:false,instrumented:true}` row
 *      is INSTRUMENT_ERROR, and a blinded instrument is INCONCLUSIVE — never
 *      SATISFIED.
 *
 * Run: node --test --test-reporter=spec tests/world-factory/m7a-real-slice-unit.test.mjs
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { zstdCompressSync } from 'node:zlib'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import {
  decompressSessionLog,
  startRealRun,
  traceEventsFromSessionRows,
} from './lib/m7a-real-run.mjs'
import {
  ALLOW_UNPROVISIONABLE_ENV,
  EXPECTED_ARM_VERDICTS,
  STEP_ARGV_ENV,
  STEP_RUN_ID_ENV,
  UNPROVISIONABLE_TOKEN,
  classifyHostAssetRefusal,
  decideStepOutcome,
  formatStepLine,
  readStepRecord,
  validateStepRecord,
} from './lib/m7a-step-verdict.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const testkitWitness = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'testkit', 'src', 'effect-witness.ts')).href)
const testkitOracle = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'testkit', 'src', 'contract-oracle.ts')).href)
const testkitWire = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'testkit', 'src', 'wire-script.ts')).href)
const testkitScript = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'testkit', 'src', 'agent-script.ts')).href)

const tmpDirs = []
function tmp(label) {
  const dir = mkdtempSync(join(tmpdir(), `m7a-unit-${label}-`))
  tmpDirs.push(dir)
  return dir
}
test.after(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true })
})

// ── 1. session-log trace reader ─────────────────────────────────────────────

test('M7A-U1 session log: concatenated zstd frames decode into every appended row', () => {
  const rows = [
    { type: 'session', version: 4, id: 'session-test' },
    { type: 'tool/call', seq: 17, data: { turn: 1, callId: 'm7a-0', name: 'write', arguments: '{"file_path":"a"}' } },
    {
      type: 'tool/result',
      seq: 19,
      data: { toolCallId: 'm7a-0', message: { isError: true }, error: { name: 'FsError', code: 'FS_SANDBOX_DENIED' } },
    },
  ]
  // One frame per append, exactly the shape the Host writes.
  const buf = Buffer.concat(rows.map((row) => zstdCompressSync(Buffer.from(JSON.stringify(row) + '\n'))))
  const decoded = decompressSessionLog(buf).toString('utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
  assert.deepEqual(decoded, rows, 'every frame is decoded, in order, byte-faithfully')
})

test('M7A-U2 session log: durable rows map to DISPATCHED / DENIED / COMPLETED honestly', () => {
  const rows = [
    { type: 'tool/call', seq: 5, data: { turn: 1, callId: 'c1', name: 'write' } },
    { type: 'tool/result', seq: 6, data: { toolCallId: 'c1', message: { isError: false } } },
    { type: 'tool/call', seq: 9, data: { turn: 2, callId: 'c2', name: 'write' } },
    { type: 'tool/result', seq: 10, data: { toolCallId: 'c2', message: { isError: true }, error: { name: 'FsError', code: 'FS_SANDBOX_DENIED' } } },
  ]
  const events = traceEventsFromSessionRows(rows, { sessionId: 'session-test' })
  assert.deepEqual(events.map((e) => [e.event_seq, e.event_type, e.outcome]), [
    [5, 'tool/call', 'DISPATCHED'],
    [6, 'tool/result', 'COMPLETED'],
    [9, 'tool/call', 'DISPATCHED'],
    [10, 'tool/result', 'DENIED'],
  ])
  assert.equal(events[1].error_code, undefined, 'a successful result claims no denial')
  assert.equal(events[3].error_code, 'FS_SANDBOX_DENIED', 'the Host typed the refusal; the trace keeps the code')
  assert.equal(events[0].authority_ref, null, 'this lane computes no per-call decision and says so')
  assert.ok(events.every((event) => event.actor_id === 'session-test'))
})

test('M7A-U3 session log: a call-id filter keeps exactly the arm it names', () => {
  // The real Host nests the call id under `message.toolCallId`; the reader must
  // find it there, or the call/result pairing silently drops.
  const rows = [
    { type: 'tool/call', seq: 1, data: { callId: 'c1', name: 'write' } },
    { type: 'tool/result', seq: 2, data: { message: { isError: false, toolCallId: 'c1' } } },
    { type: 'tool/call', seq: 3, data: { callId: 'c2', name: 'write' } },
    { type: 'tool/result', seq: 4, data: { message: { isError: false, toolCallId: 'c2' } } },
  ]
  const events = traceEventsFromSessionRows(rows, { sessionId: 's', callId: 'c2' })
  assert.deepEqual(events.map((e) => e.execution_id), ['c2', 'c2'], 'the nested call id is read')
  assert.deepEqual(traceEventsFromSessionRows(rows, { sessionId: 's' }).map((e) => e.execution_id), ['c1', 'c1', 'c2', 'c2'])
})

// ── 2. wire script driver ───────────────────────────────────────────────────

const requestWith = (tools, text) => ({ tools: tools.map((name) => ({ function: { name } })), messages: [{ role: 'user', content: text }] })

test('M7A-U4 wire script: structural match, aux traffic consumes nothing, completion is enforced', async () => {
  const script = {
    schema: 'agent-script/1',
    turns: [
      { expect_request: { tools_include: ['write'], contains_text: 'ARM-1' }, respond: { kind: 'tool-call', name: 'write', args: { file_path: 'x', content: 'y' } } },
      { respond: { kind: 'text', text: 'DONE' } },
    ],
  }
  const driver = testkitWire.createWireScriptDriver(script, { callIdPrefix: 'm7a' })
  assert.equal(driver.consumedTurns, 0)

  // Aux request (no tools): a neutral text, NO turn consumed.
  assert.deepEqual(await driver.decide({ seq: 1, req: { messages: [] } }), { kind: 'text', content: 'WIRE-AUX' })
  assert.equal(driver.consumedTurns, 0)

  const call = await driver.decide({ seq: 2, req: requestWith(['write', 'bash'], 'prompt ARM-1') })
  assert.equal(call.kind, 'tool-call')
  assert.equal(call.toolCalls[0].name, 'write')
  assert.equal(call.toolCalls[0].id, 'm7a-0', 'the call id is stable per turn')
  assert.equal(driver.consumedTurns, 1)

  const done = await driver.decide({ seq: 3, req: requestWith(['write'], 'ARM-1 result') })
  assert.deepEqual(done, { kind: 'text', content: 'DONE' })
  driver.assertComplete()
  assert.equal(driver.consumedTurns, 2)

  // Extra agent request after the script ran out.
  await assert.rejects(driver.decide({ seq: 4, req: requestWith(['write'], 'again') }), (error) => error.code === 'SCRIPT_EXHAUSTED')
})

test('M7A-U5 wire script: a request that does not carry the declared tool/text is refused, not replayed', async () => {
  const script = {
    schema: 'agent-script/1',
    turns: [{ expect_request: { tools_include: ['write'] }, respond: { kind: 'text', text: 'X' } }],
  }
  const noTool = testkitWire.createWireScriptDriver(script, {})
  await assert.rejects(
    noTool.decide({ seq: 1, req: requestWith(['read'], 'p') }),
    (error) => error.code === 'SCRIPT_UNEXPECTED_REQUEST' && error.message.includes('write'),
  )
  const noText = testkitWire.createWireScriptDriver(
    { schema: 'agent-script/1', turns: [{ expect_request: { contains_text: 'NEEDLE' }, respond: { kind: 'text', text: 'X' } }] },
    {},
  )
  await assert.rejects(
    noText.decide({ seq: 1, req: requestWith(['write'], 'haystack') }),
    (error) => error.code === 'SCRIPT_UNEXPECTED_REQUEST' && error.message.includes('NEEDLE'),
  )
  const leftover = testkitWire.createWireScriptDriver(
    { schema: 'agent-script/1', turns: [{ respond: { kind: 'text', text: 'X' } }] },
    {},
  )
  assert.throws(() => leftover.assertComplete(), (error) => error.code === 'SCRIPT_UNCONSUMED_TURN')
})

test('M7A-U6 the wire driver and the in-process adapter share ONE schema law', () => {
  const doc = { schema: 'agent-script/1', turns: [{ respond: { kind: 'text', text: 'hi' } }] }
  assert.deepEqual(testkitScript.validateAgentScript(doc), testkitWire.createWireScriptDriver(doc, {}).script)
  assert.throws(() => testkitScript.validateAgentScript({ schema: 'agent-script/2', turns: [] }), (error) => error.code === 'SCRIPT_INVALID')
  assert.throws(() => testkitWire.createWireScriptDriver({ schema: 'agent-script/2', turns: [] }, {}), (error) => error.code === 'SCRIPT_INVALID')
})

// ── 3. oracle provenance + sensitivity ─────────────────────────────────────

const deniedTrace = [
  { event_seq: 1, event_type: 'tool/call', actor_id: 's', authority_ref: null, outcome: 'DISPATCHED' },
  { event_seq: 2, event_type: 'tool/result', actor_id: 's', authority_ref: null, outcome: 'DENIED', error_code: 'FS_SANDBOX_DENIED' },
]

test('M7A-U7 witness rows carry the module seal; hand-built rows do not', async () => {
  const dir = tmp('seal')
  const watched = join(dir, 'watched')
  mkdirSync(watched, { recursive: true })
  const witness = testkitWitness.createFsWitness({ root: dir, outside: watched })
  const rows = await witness.observe()
  assert.ok(rows.every((row) => testkitWitness.isSealedWitnessObservation(row)), 'instrument-produced rows are sealed')
  const handBuilt = { domain: 'filesystem', observed: false, instrumented: true, evidence: [] }
  assert.equal(testkitWitness.isSealedWitnessObservation(handBuilt), false, 'a literal has no seal')
  assert.equal(testkitWitness.areSealedWitnessObservations([handBuilt]), false)
  assert.equal(testkitWitness.areSealedWitnessObservations([]), false, 'empty is absence, not a seal')

  // JSON round-trip loses the seal: a REPLAYED evidence file cannot be re-graded
  // as witnessed. Pinned here so the limitation is a test, not a footnote.
  const replay = JSON.parse(JSON.stringify(rows))
  assert.equal(testkitWitness.areSealedWitnessObservations(replay), false, 'replayed rows are not witnessed rows')
})

test('M7A-U8 witnessed mode: a hand-built clean row is INSTRUMENT_ERROR, never SATISFIED', async () => {
  const dir = tmp('handbuilt')
  const watched = join(dir, 'watched')
  mkdirSync(watched, { recursive: true })
  const honest = await testkitWitness.createFsWitness({ root: dir, outside: watched }).observe()

  const declared = testkitOracle.judgeContract({
    contractId: 'm7a.unit',
    events: deniedTrace,
    witness: [{ domain: 'filesystem', observed: false, instrumented: true, evidence: [] }, ...honest.filter((row) => row.domain !== 'filesystem')],
    blindDomains: ['process', 'network'],
    requiredEffectDomains: ['filesystem'],
    witnessProvenance: 'declared',
  })
  assert.equal(declared.verdict, 'SATISFIED', "the pre-M7-A 'declared' mode is unchanged (back-compat)")

  const witnessed = testkitOracle.judgeContract({
    contractId: 'm7a.unit',
    events: deniedTrace,
    witness: [{ domain: 'filesystem', observed: false, instrumented: true, evidence: [] }, ...honest.filter((row) => row.domain !== 'filesystem')],
    blindDomains: ['process', 'network'],
    requiredEffectDomains: ['filesystem'],
    requiredEffectScope: [watched],
    witnessProvenance: 'witnessed',
  })
  assert.equal(witnessed.verdict, 'INSTRUMENT_ERROR', 'a fabricated instrument cannot corroborate a pass')
  assert.ok(witnessed.reasons.some((line) => line.includes('provenance seal')))
})

test('M7A-U9 witnessed mode: honest instrument -> SATISFIED, real effect -> VIOLATED, blinded -> INCONCLUSIVE', async () => {
  const dir = tmp('verdicts')
  const watched = join(dir, 'watched')
  mkdirSync(watched, { recursive: true })

  const clean = testkitWitness.createFsWitness({ root: dir, outside: watched })
  const cleanRows = await clean.observe()
  const satisfied = testkitOracle.judgeContract({
    contractId: 'm7a.unit', events: deniedTrace, witness: cleanRows, blindDomains: clean.blindDomains,
    requiredEffectDomains: ['filesystem'], requiredEffectScope: [watched], witnessProvenance: 'witnessed',
  })
  assert.equal(satisfied.verdict, 'SATISFIED')
  assert.ok(satisfied.limitations.some((line) => line.includes('process') && line.includes('network')), 'the verdict never claims process/network coverage')

  writeFileSync(join(watched, 'escape.txt'), 'ESCAPE\n')
  const dirtyRows = await clean.observe()
  const violated = testkitOracle.judgeContract({
    contractId: 'm7a.unit',
    // A decision event must exist SOMEWHERE in the trace (oracle rule 2), then
    // the escaping call's DISPATCHED/COMPLETED row with no authority_ref plus an
    // observed effect is rule 3d. The decision does not have to belong to the
    // escaping call — the oracle input is per-contract, not per-call.
    events: [
      ...deniedTrace,
      { event_seq: 3, event_type: 'tool/call', actor_id: 's', authority_ref: null, outcome: 'DISPATCHED' },
      { event_seq: 4, event_type: 'tool/result', actor_id: 's', authority_ref: null, outcome: 'COMPLETED' },
    ],
    witness: dirtyRows, blindDomains: clean.blindDomains,
    requiredEffectDomains: ['filesystem'], requiredEffectScope: [watched], witnessProvenance: 'witnessed',
  })
  assert.equal(violated.verdict, 'VIOLATED', 'an observed effect with no authority_ref is a violation')
  assert.ok(violated.reasons.some((line) => line.includes('outside the authorized set')), JSON.stringify(violated.reasons))
  assert.deepEqual(violated.unauthorizedEffectPaths, [join(watched, 'escape.txt')], 'the violating effect is named by path')

  const blinded = testkitWitness.createBlindWitness(testkitWitness.createFsWitness({ root: dir, outside: watched }), ['filesystem'])
  const blindRows = await blinded.observe()
  const inconclusive = testkitOracle.judgeContract({
    contractId: 'm7a.unit', events: deniedTrace, witness: blindRows, blindDomains: blinded.blindDomains,
    requiredEffectDomains: ['filesystem'], requiredEffectScope: [watched], witnessProvenance: 'witnessed',
  })
  assert.equal(inconclusive.verdict, 'INCONCLUSIVE', 'a blinded instrument can never produce a pass')
  assert.ok(inconclusive.reasons.some((line) => line.includes('declared blind')))
})

test('M7A-U10 without a decision event the oracle refuses to call an effect a violation', async () => {
  const dir = tmp('no-decision')
  const watched = join(dir, 'watched')
  mkdirSync(watched, { recursive: true })
  const witness = testkitWitness.createFsWitness({ root: dir, outside: watched })
  await witness.observe()
  writeFileSync(join(watched, 'escape.txt'), 'ESCAPE\n')
  const rows = await witness.observe()
  const judged = testkitOracle.judgeContract({
    contractId: 'm7a.unit',
    events: [
      { event_seq: 1, event_type: 'tool/call', actor_id: 's', authority_ref: null, outcome: 'DISPATCHED' },
      { event_seq: 2, event_type: 'tool/result', actor_id: 's', authority_ref: null, outcome: 'COMPLETED' },
    ],
    witness: rows,
    blindDomains: witness.blindDomains,
    requiredEffectDomains: ['filesystem'],
    requiredEffectScope: [watched],
    witnessProvenance: 'witnessed',
  })
  assert.equal(judged.verdict, 'INCONCLUSIVE', 'an effect with no decision anywhere in the trace cannot be graded as a violation')
  assert.ok(judged.reasons.some((line) => line.includes('no computed/denied event')))
})

// ── M7A-U11: a failing start must not leave the mock provider listening ──────
//
// MEASURED (hosted `census-runtime` job 132898455498): the live suite failed
// 166 ms in, and the step then sat for 41 minutes until the job's 60-minute
// timeout. The mechanism is here: `startRealRun` starts the in-process mock
// provider BEFORE the Host, so a throw from the Host path left an HTTP server
// holding the event loop and the test process could never exit. This case
// drives that exact sequence with a fake World whose `startHost` throws, and
// asserts the mock is CLOSED (not merely "stop was called") before the error
// reaches the caller.
test('M7A-U11 a host-start failure closes the mock provider it already started', async () => {
  const dir = tmp('start-failure')
  const server = createServer((_req, res) => res.end('{}'))
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
  const port = server.address().port
  const calls = { stopHost: 0, stopMock: 0 }
  const fakeWorld = {
    token: 'fake-token',
    home: dir,
    workspaceDir: dir,
    async startMock() {
      return { port }
    },
    async startHost() {
      throw new Error('M7A-TEST-HOST-REFUSED: sandbox pre-flight refused before the first host start')
    },
    async stopHost() {
      calls.stopHost += 1
      return { wasRunning: false }
    },
    async stopMock() {
      calls.stopMock += 1
      await new Promise((resolveClose) => server.close(resolveClose))
    },
  }
  const previousTmpdir = process.env.TMPDIR
  try {
    await assert.rejects(
      startRealRun({
        world: fakeWorld,
        tmpDir: dir,
        script: {
          schema: 'agent-script/1',
          world: 'm7a-u11',
          turns: [{ expect_request: { tools_include: ['write'] }, respond: { kind: 'text', text: 'u11' } }],
        },
        bootTimeoutMs: 1_000,
      }),
      /M7A-TEST-HOST-REFUSED/u,
    )
  } finally {
    if (previousTmpdir === undefined) delete process.env.TMPDIR
    else process.env.TMPDIR = previousTmpdir
    await new Promise((resolveClose) => server.close(() => resolveClose()))
  }
  assert.ok(calls.stopHost >= 1, 'the host stop was attempted on the failure path')
  assert.ok(calls.stopMock >= 1, 'the mock provider was stopped on the failure path')
  assert.equal(server.listening, false, 'the mock provider is CLOSED — it cannot hold the event loop after a failed start')
})

// ── M7A-U12: the disclosed-refusal gate accepts ONE outcome and nothing else ───
//
// Reviewer decision 2026-11-15 (option B): a permanently red Required leg is not shippable, and
// `continue-on-error` would let ANY failure pass. The gate must accept exactly one named refusal.
// These are the negative controls: without them the token is a hole, because anything that reaches
// the catch could be relabelled "unprovisionable" and the job would go green.
const assetRefusalError = new Error(
  'host base guard: sandbox pre-flight refused before the first host start: host-sandbox-assets: ' +
    'DESTINATION_DIGEST_MISMATCH: bin/glibc/system.node in /srv/host/tests/deepseek-harness-test-use ' +
    `hashes ${'a'.repeat(64)}, the pinned manifest says ${'b'.repeat(64)} — the runner never overwrites ` +
    'bytes it did not create',
)

test('M7A-U12 the refusal gate: the ONE accepted outcome is a named asset refusal with zero arms', () => {
  const refused = decideStepOutcome({ error: assetRefusalError, allowUnprovisionable: true, armCount: 0 })
  assert.equal(refused.verdict, 'DISCLOSED_REFUSAL')
  assert.equal(refused.reason, 'HOST_ASSET_UNPROVISIONABLE')
  assert.equal(refused.actualSha256, 'a'.repeat(64))
  assert.equal(refused.expectedSha256, 'b'.repeat(64))
  assert.equal(classifyHostAssetRefusal(assetRefusalError).token, UNPROVISIONABLE_TOKEN)
  assert.match(formatStepLine(refused), /^M7A-STEP verdict=DISCLOSED_REFUSAL reason=HOST_ASSET_UNPROVISIONABLE arms=0 detail=bin\/glibc\/system\.node /u)
})

test('M7A-U12a NOTHING ELSE IS ACCEPTED: no opt-in, another failure, a refusal with arms, and a green run with no arms all FAIL', () => {
  // 1. the same refusal without the opt-in (the local default) is a failure
  assert.deepEqual(
    (({ verdict, reason }) => ({ verdict, reason }))(decideStepOutcome({ error: assetRefusalError, allowUnprovisionable: false, armCount: 0 })),
    { verdict: 'FAILED', reason: 'UNPROVISIONABLE_HOST_NOT_ALLOWED' },
  )
  // 2. any other failure — even with the opt-in — is a failure (the token cannot launder it)
  const other = new Error('instance boot failed: process exited (code=0 signal=none)')
  assert.deepEqual(
    (({ verdict, reason }) => ({ verdict, reason }))(decideStepOutcome({ error: other, allowUnprovisionable: true, armCount: 0 })),
    { verdict: 'FAILED', reason: 'REFUSAL_NOT_ACCEPTED' },
  )
  //    …including a sandbox-asset failure that is a DIFFERENT code (SOURCE_IS_DESTINATION)
  const sibling = new Error('host-sandbox-assets: SOURCE_IS_DESTINATION: the source tree is the runtime tree')
  assert.equal(decideStepOutcome({ error: sibling, allowUnprovisionable: true, armCount: 0 }).verdict, 'FAILED')
  // 3. a refusal PLUS arm output is a contradiction, and a contradiction is a failure
  assert.deepEqual(
    (({ verdict, reason }) => ({ verdict, reason }))(decideStepOutcome({ error: assetRefusalError, allowUnprovisionable: true, armCount: 3 })),
    { verdict: 'FAILED', reason: 'REFUSAL_WITH_ARM_OUTPUT' },
  )
  // 4. a green run that graded nothing is not a verification
  assert.deepEqual(
    (({ verdict, reason }) => ({ verdict, reason }))(decideStepOutcome({ error: null, allowUnprovisionable: true, armCount: 0 })),
    { verdict: 'FAILED', reason: 'NO_ARMS_GRADED' },
  )
  // and the honest green run is VERIFIED
  assert.equal(decideStepOutcome({ error: null, allowUnprovisionable: true, armCount: 5 }).verdict, 'VERIFIED')
})

test('M7A-U12b the opt-in is an explicit 1: unset, 0, true and yes all keep the hard failure', async () => {
  const { allowUnprovisionableHost } = await import('./lib/m7a-step-verdict.mjs')
  assert.equal(allowUnprovisionableHost({}), false)
  assert.equal(allowUnprovisionableHost({ [ALLOW_UNPROVISIONABLE_ENV]: '0' }), false)
  assert.equal(allowUnprovisionableHost({ [ALLOW_UNPROVISIONABLE_ENV]: 'true' }), false)
  assert.equal(allowUnprovisionableHost({ [ALLOW_UNPROVISIONABLE_ENV]: 'yes' }), false)
  assert.equal(allowUnprovisionableHost({ [ALLOW_UNPROVISIONABLE_ENV]: '1' }), true)
})

const PASS_ARGV = 'node --test --test-force-exit --test-timeout=900000 --test-reporter=spec tests/world-factory/m7a-real-slice.test.mjs'
const PASS_ENV = { [STEP_ARGV_ENV]: PASS_ARGV, [STEP_RUN_ID_ENV]: 'run-42' }
const HOST_SHA = '639ed015397290b3745d163aafe02ffee4aa3f84'
const verifiedRecord = () => ({
  schema: 'm7a-step/1',
  verdict: 'VERIFIED',
  reason: 'ARMS_GRADED',
  arms: 5,
  runId: 'run-42',
  hostSha: HOST_SHA,
  argvSource: STEP_ARGV_ENV,
  argv: PASS_ARGV.split(' '),
  armVerdicts: EXPECTED_ARM_VERDICTS.map((arm) => ({ ...arm, expectation: arm.verdict })),
  utc: 'T',
})
const refusalRecord = () => ({
  schema: 'm7a-step/1',
  verdict: 'DISCLOSED_REFUSAL',
  reason: 'HOST_ASSET_UNPROVISIONABLE',
  arms: 0,
  armVerdicts: [],
  asset: 'bin/glibc/system.node',
  actualSha256: 'a'.repeat(64),
  expectedSha256: 'b'.repeat(64),
  runId: 'run-42',
  hostSha: HOST_SHA,
  argvSource: STEP_ARGV_ENV,
  argv: PASS_ARGV.split(' '),
  utc: 'T',
})

test('M7A-U12c the ledger re-checks the record instead of echoing it: VERIFIED and the refusal pass, everything else exits 1', () => {
  assert.deepEqual(validateStepRecord(verifiedRecord(), { env: PASS_ENV, expectedHostSha: HOST_SHA }), { ok: true, code: 'OK', verdict: 'VERIFIED', reason: 'ARMS_GRADED' })
  assert.equal(validateStepRecord(refusalRecord(), { env: PASS_ENV, expectedHostSha: HOST_SHA }).verdict, 'DISCLOSED_REFUSAL')

  // The reviewer's three malformed records: each claimed success and each must be refused.
  const cases = [
    ['no armVerdicts', (r) => { delete r.armVerdicts }, 'ARM_VERDICTS_MISSING'],
    ['a renamed arm', (r) => { r.armVerdicts[0].arm = 'some-other-arm' }, 'ARM_ORDER_MISMATCH'],
    ['refusal with arms', (r) => { r.verdict = 'DISCLOSED_REFUSAL'; r.reason = 'HOST_ASSET_UNPROVISIONABLE'; r.arms = 3; r.armVerdicts = [] }, 'REFUSAL_WITH_ARMS'],
    ['reconstructed argv', (r) => { r.argvSource = 'process.argv (reconstructed)' }, 'ARGV_NOT_DECLARED'],
    ['wrong argv', (r) => { r.argv = ['node', '--test', 'something-else.mjs'] }, 'ARGV_MISMATCH'],
    ['wrong host', (r) => { r.hostSha = 'f'.repeat(40) }, 'HOST_SHA_MISMATCH'],
    ['wrong arm verdict', (r) => { r.armVerdicts[1].verdict = 'SATISFIED' }, 'ARM_VERDICT_MISMATCH'],
    ['short arm count', (r) => { r.arms = 4 }, 'WRONG_ARM_COUNT'],
    ['equal sha pair', (r) => { const x = refusalRecord(); x.expectedSha256 = x.actualSha256; r.verdict = 'DISCLOSED_REFUSAL'; Object.assign(r, x) }, 'SHA_PAIR_EQUAL'],
  ]
  for (const [name, mutate, reason] of cases) {
    const record = verifiedRecord()
    mutate(record)
    const result = validateStepRecord(record, { env: PASS_ENV, expectedHostSha: HOST_SHA })
    assert.equal(result.ok, false, `${name} must be refused`)
    assert.equal(result.reason, reason, `${name}: ${JSON.stringify(result)}`)
  }
  // A record from ANOTHER run is STALE, not VERIFIED — the stale-blessing control.
  const stale = validateStepRecord(verifiedRecord(), { env: { ...PASS_ENV, [STEP_RUN_ID_ENV]: 'run-43' }, expectedHostSha: HOST_SHA })
  assert.equal(stale.code, 'STALE')
  assert.equal(stale.reason, 'RUN_ID_MISMATCH')

  // And the real script, as a child process: missing / invalid / stale all exit 1.
  const dir = tmp('ledger-reader')
  const ledger = join(REPO_ROOT, 'scripts', 'm7a-step-ledger.mjs')
  const runLedger = (file, env) => spawnSync(process.execPath, [ledger, file], { encoding: 'utf8', env: { ...process.env, ...env } })
  const missing = runLedger(join(dir, 'nope.json'), {})
  assert.equal(missing.status, 1)
  assert.match(missing.stderr, /M7A-STEP-LEDGER verdict=MISSING reason=NO_RECORD/u)

  const invalidFile = join(dir, 'invalid.json')
  writeFileSync(invalidFile, JSON.stringify({ ...verifiedRecord(), arms: 0 }))
  const invalid = runLedger(invalidFile, PASS_ENV)
  assert.equal(invalid.status, 1)
  assert.match(invalid.stderr, /M7A-STEP-LEDGER verdict=INVALID reason=WRONG_ARM_COUNT/u)

  const staleFile = join(dir, 'stale.json')
  writeFileSync(staleFile, JSON.stringify(verifiedRecord()))
  const staleRun = runLedger(staleFile, { ...PASS_ENV, [STEP_RUN_ID_ENV]: 'run-99' })
  assert.equal(staleRun.status, 1)
  assert.match(staleRun.stderr, /M7A-STEP-LEDGER verdict=STALE reason=RUN_ID_MISMATCH/u)

  const goodFile = join(dir, 'good.json')
  writeFileSync(goodFile, JSON.stringify(verifiedRecord()))
  const good = runLedger(goodFile, PASS_ENV)
  assert.equal(good.status, 0)
  assert.match(good.stdout, /^M7A-STEP-LEDGER verdict=VERIFIED arms=5 host=639ed01539/u)
  assert.match(good.stdout, /run=run-42/u)

  // And the refusal line, through the same reader.
  const refusalFile = join(dir, 'refusal.json')
  writeFileSync(refusalFile, JSON.stringify(refusalRecord()))
  const refusal = runLedger(refusalFile, PASS_ENV)
  assert.equal(refusal.status, 0)
  assert.match(refusal.stdout, /^M7A-STEP-LEDGER verdict=DISCLOSED_REFUSAL reason=HOST_ASSET_UNPROVISIONABLE asset=bin\/glibc\/system\.node actual=a{64} pinned=b{64}/u)

  // `readStepRecord` is the same body the script uses.
  assert.equal(readStepRecord(goodFile, { env: PASS_ENV, expectedHostSha: HOST_SHA }).ok, true)
  assert.equal(readStepRecord(join(dir, 'nope.json')).code, 'MISSING')
})
