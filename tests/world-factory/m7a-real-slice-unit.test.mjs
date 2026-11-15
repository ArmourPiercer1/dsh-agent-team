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
import { createServer } from 'node:http'
import { zstdCompressSync } from 'node:zlib'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import {
  decompressSessionLog,
  startRealRun,
  traceEventsFromSessionRows,
} from './lib/m7a-real-run.mjs'

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
