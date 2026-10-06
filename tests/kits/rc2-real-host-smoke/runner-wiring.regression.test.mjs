import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { guardedDecide, makeStrictFailureCapture, requestStateKey, spawnHost, strictCaptureReferences, systemTextOf, toolResultTextOf, userTextOf, writeFatalSummary } from './rc2-real-host-smoke.mjs'
import { createRunControl } from './run-control.mjs'
import { extractInstanceId, toolResultEntries } from './wire-shape.mjs'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'

const control = (limits = {}) => createRunControl({ limits, log() {}, writeEvidence() {} })
const agent = (system, count = 0) => ({ seq: 1, req: {
  system, tools: [{ name: 'read' }],
  messages: [{ role: 'user', content: 'work' }, ...Array.from({ length: count }, (_, i) => ({ role: 'tool', tool_call_id: `c${i}`, content: 'ok' }))],
} })
const title = () => ({ seq: 2, req: { system: 'Create a concise title', messages: [{ role: 'user', content: 'title' }] } })
const reply = () => ({ kind: 'tool-call', toolCalls: [{ name: 'read', arguments: { file_path: 'fixture' } }] })
const fixture = (path) => JSON.parse(readFileSync(new URL(`./fixtures/${path}`, import.meta.url), 'utf8'))

test('actual runner callback separates session identities', () => {
  assert.notEqual(requestStateKey(agent('leader A')), requestStateKey(agent('leader B')))
})
test('actual runner callback counts result progress', () => {
  assert.notEqual(requestStateKey(agent('leader A', 0)), requestStateKey(agent('leader A', 1)))
})
test('interleaved titles cannot reset repeated agent state', () => {
  const rc = control()
  for (let i = 0; i < 6; i++) {
    guardedDecide(agent('leader A'), reply, rc)
    guardedDecide(title(), reply, rc)
  }
  assert.equal(rc.aborted(), true)
  assert.equal(rc.violation().kind, 'same-state-repeat')
})
test('unknown wire shape aborts before invoking scripted policy', () => {
  const rc = control()
  let issued = 0
  const result = guardedDecide({ seq: 3, req: { tools: [{ name: 'read' }], messages: [{ role: 'robot', content: 'work' }] } }, () => { issued++; return reply() }, rc)
  assert.equal(issued, 0)
  assert.equal(result.status, 503)
  assert.equal(rc.aborted(), true)
  assert.equal(rc.budget.state.totalRequests, 1)
})
test('tool-less unknown purpose aborts before scripted policy', () => {
  const rc = control()
  let issued = 0
  const result = guardedDecide({ seq: 4, req: { messages: [{ role: 'user', content: 'work' }] } }, () => { issued++; return reply() }, rc)
  assert.equal(issued, 0)
  assert.equal(result.status, 503)
  assert.equal(rc.aborted(), true)
})
test('compaction replay cannot issue an agent tool or fake chain progress', () => {
  const rc = control()
  let issued = 0
  const request = fixture('reconstructed/model-request-0.2.0-rc.2-compaction-with-tools.json').request
  const result = guardedDecide({ seq: 5, req: request }, () => { issued++; return reply() }, rc)
  assert.equal(issued, 0)
  assert.equal(result.status, 503)
  assert.match(rc.violation().detail, /compaction/)
})
test('title attribution is handled before the agent policy', () => {
  const rc = control()
  const result = guardedDecide(title(), () => { throw new Error('agent policy must not run') }, rc)
  assert.equal(result.kind, 'text')
  assert.equal(rc.aborted(), false)
})
test('actual HTTP mock passes the envelope through the production callback', async () => {
  const rc = control()
  let issued = 0
  const mock = await startMockModel({ port: 0, log() {}, decide: (envelope) => guardedDecide(envelope, () => { issued++; return { kind: 'text', content: 'ok' } }, rc) })
  try {
    for (const envelope of [agent('leader A'), title(), agent('leader B')]) {
      const response = await fetch(`http://127.0.0.1:${mock.port}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...envelope.req, stream: true, model: 'synthetic' }) })
      await response.text()
      assert.equal(response.status, 200)
    }
    assert.equal(issued, 2)
    assert.equal(rc.budget.state.perSession.size, 3)
    assert.equal(rc.budget.state.totalRequests, 3)
  } finally { await mock.close() }
})
test('member persona reader handles both instruction placements', () => {
  assert.match(systemTextOf({ body: { system: 'worker B', messages: [] } }), /worker B/)
  assert.match(systemTextOf({ body: { messages: [{ role: 'system', content: 'worker B' }] } }), /worker B/)
})
test('production spawn owns its child before any boot await', { timeout: 10000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rc2-runner-owned-'))
  const rc = control()
  const bin = join(dir, 'host.mjs')
  writeFileSync(bin, 'setInterval(() => {}, 1000)\n')
  const host = spawnHost({ port: 0, home: dir, logPath: join(dir, 'host.log'), mockPort: 0, bin, cwd: dir, control: rc })
  try {
    assert.equal(rc.state.child, host.child)
    assert.ok(host.child.pid > 0)
    // This models boot/authentication failing before the caller gets a booted
    // record: cleanup must work using controller ownership alone.
    await rc.stopChild({ graceMs: 50, killWaitMs: 2000 })
    assert.ok(host.child.exitCode !== null || host.child.signalCode !== null)
  } finally {
    await rc.stopChild({ graceMs: 50, killWaitMs: 2000 })
    rc.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})
for (const name of ['0.1.x-classic-create-result', '0.2.0-rc.2-parts-create-result']) {
  test(`decoded ${name} supplies a usable delegation identity`, () => {
    const value = fixture(`instance-id/${name}.json`)
    const entry = toolResultEntries({ messages: [value.result] })[0]
    assert.equal(extractInstanceId(entry.item), value.payload.targetInstanceId)
  })
}
for (const name of ['empty-result', 'error-result', 'no-id-result']) {
  test(`${name} cannot supply a delegation identity`, () => {
    const value = fixture(`instance-id/${name}.json`)
    const entry = toolResultEntries({ messages: [value.result] })[0]
    assert.throws(() => extractInstanceId(entry.item))
  })
}

test('tool transcripts cannot impersonate user scenario markers', () => {
  const body = { messages: [
    { role: 'user', content: [{ type: 'text', text: 'leader-marker' }] },
    { role: 'assistant', content: [{ type: 'tool_use', name: 'team_delegate', input: { prompt: 'worker-marker' } }] },
    { role: 'user', content: [{ type: 'tool_result', content: [{ type: 'text', text: 'worker-marker completed' }] }] },
  ] }
  assert.equal(userTextOf({ seq: 1, req: body }), 'leader-marker')
  assert.equal(userTextOf({ body }), 'leader-marker')
  assert.equal(userTextOf({ messages: [{ role: 'user', content: 'worker-marker' }] }), 'worker-marker')
})

// Each sequential smoke oracle must read the result of its own call, not a
// transcript-wide string. Joining history or matching only the tool name breaks
// these tests: S1 and S2 both call read, but only S2 is deliberately denied.
const smokeCalls = [
  { id: 'read-allowed', name: 'read', text: 'probe rc2-smoke from the earlier read' },
  { id: 'read-denied', name: 'read', text: 'denied by static rule', error: true },
  { id: 'bash-approved', name: 'bash', text: 'rc2-smoke\n' },
  { id: 'member-created', name: 'team_create_member', text: '{"member":{"instanceId":"inst-worker-b"}}' },
]
function smokeHistory(wire, calls) {
  return { body: { system: 'leader B', tools: [{ name: 'read' }], messages: [
    { role: 'user', content: 'leader scenario' },
    ...calls.flatMap((call) => wire === 'classic' ? [
      { role: 'assistant', content: null, tool_calls: [{ id: call.id, type: 'function', function: { name: call.name, arguments: '{}' } }] },
      { role: 'tool', tool_call_id: call.resultId ?? call.id, content: call.text, is_error: call.error === true },
    ] : [
      { role: 'assistant', content: [{ type: 'tool_use', id: call.id, name: call.name, input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: call.resultId ?? call.id, content: [{ type: 'text', text: call.text }], is_error: call.error === true }] },
    ]),
  ] } }
}
const readStep = (request, count, name, allowError = false) => toolResultTextOf(request, { expectedCount: count, expectedTool: name, allowError })
for (const wire of ['classic', 'parts']) {
  test(`${wire}: S4 create result excludes the earlier intentional deny`, () => {
    const result = readStep(smokeHistory(wire, smokeCalls), 4, 'team_create_member')
    assert.equal(result, smokeCalls[3].text)
    assert.match(result, /member|created|inst-/)
    assert.doesNotMatch(result, /reject|denied|error|unavailable|not found/i)
  })
  test(`${wire}: S3 cannot pass on rc2-smoke from an earlier read`, () => {
    const calls = [...smokeCalls.slice(0, 2), { ...smokeCalls[2], text: 'wrong output' }]
    const result = readStep(smokeHistory(wire, calls), 3, 'bash')
    assert.equal(result.includes('rc2-smoke'), false)
  })
  test(`${wire}: S1/S2/S3 select their own call even with repeated tool names`, () => {
    for (let index = 0; index < 3; index++) {
      const call = smokeCalls[index]
      assert.equal(readStep(smokeHistory(wire, smokeCalls.slice(0, index + 1)), index + 1, call.name, index === 1), call.text)
    }
  })
  test(`${wire}: an error result cannot satisfy a positive output oracle`, () => {
    const calls = [...smokeCalls.slice(0, 2), { ...smokeCalls[2], text: 'failed to run echo rc2-smoke', error: true }]
    assert.throws(() => readStep(smokeHistory(wire, calls), 3, 'bash'), /error result/)
  })
  for (const [label, calls, count, name] of [
    ['stale earlier id', [...smokeCalls.slice(0, 3), { ...smokeCalls[3], resultId: 'read-allowed' }], 4, 'team_create_member'],
    ['unmatched id', [{ ...smokeCalls[0], resultId: 'unknown' }], 1, 'read'],
    ['duplicate call id', [smokeCalls[0], { ...smokeCalls[1], id: 'read-allowed' }], 2, 'read'],
    ['wrong tool name', smokeCalls.slice(0, 3), 3, 'team_create_member'],
    ['missing expected result', smokeCalls.slice(0, 2), 3, 'bash'],
    ['extra result', smokeCalls, 3, 'bash'],
  ]) {
    test(`${wire}: ${label} fails the oracle instead of guessing`, () => {
      assert.throws(() => readStep(smokeHistory(wire, calls), count, name), /smoke oracle/)
    })
  }
  test(`${wire}: a result without its assistant call is not attributable`, () => {
    const request = smokeHistory(wire, smokeCalls.slice(0, 1))
    request.body.messages = request.body.messages.filter((message) => message.role !== 'assistant')
    assert.throws(() => readStep(request, 1, 'read'), /smoke oracle/)
  })
}

test('actual S1/S2/S3/S4 call sites pin count and tool identity', () => {
  const source = readFileSync(new URL('./rc2-real-host-smoke.mjs', import.meta.url), 'utf8')
  for (const [stage, count, name] of [['S1', 1, 'read'], ['S2', 2, 'read'], ['S3', 3, 'bash'], ['S4', 4, 'team_create_member']]) {
    assert.ok(source.includes(`toolResultTextOf(b${stage}, { expectedCount: ${count}, expectedTool: '${name}'`), `${stage} must use its own count and tool identity`)
  }
})

test('captured host parts preserve a usable call/result association', () => {
  const request = fixture('captured-0.2.0-rc.2/model-request-0.2.0-rc.2-agent-with-result-0003.json').request
  assert.notEqual(readStep(request, 1, 'team_list_members'), '')
})


// ── capture-before-assert (run 6 forensics; repaired per the be57d4b7 review) ─
// The strict oracle persists RAW call/result evidence to an EXPLICIT PRIVATE
// sink (never RUN_DIR's publishable default), through a STRICT writer that
// only ever reports persisted:true on a real write+chmod success, with a
// BOUNDED host tail and a documented size cap — and the original verdict is
// re-thrown unchanged on every one of these paths. All tests drive the SAME
// exported seam main() wires at S1–S4.
const CAPTURE_ERROR_TEXT = 'rc2-capture-probe bash failure — head [spawn echo rc2-smoke exited 1] …middle… tail [no stderr]'
const TAIL_MARKER = 'CAPTURE-TAIL-MARKER-last-line'

function captureFixture({ rawSink = 'private', rawMaxBytes } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'rc2-strict-capture-'))
  const publicDir = join(base, 'public-evidence')
  mkdirSync(publicDir)
  const worldDir = join(base, 'world')
  mkdirSync(worldDir)
  const instanceLog = join(base, 'instance.log')
  writeFileSync(instanceLog, 'instance: bash tool faulted while executing echo rc2-smoke\n')
  const rawSinkDir = rawSink === 'private' ? join(base, 'private-raw')
    : rawSink === 'blocked' ? join(base, 'blocked-sink')
    : undefined
  if (rawSink === 'blocked') writeFileSync(rawSinkDir, 'a regular file cannot serve as the 0700 sink dir\n')
  const statuses = []
  const capture = makeStrictFailureCapture({
    stage: 'S3',
    rawSinkDir,
    statusEvidence: (name, content) => {
      statuses.push({ name, content })
      writeFileSync(join(publicDir, name), JSON.stringify(content, null, 2))
    },
    log() {},
    instanceLog,
    ...(rawMaxBytes === undefined ? {} : { rawMaxBytes }),
  })
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = join(d, e.name)
    return e.isDirectory() ? walk(p) : [p]
  })
  return {
    base,
    publicDir,
    worldDir,
    instanceLog,
    statuses,
    capture,
    status: () => statuses[statuses.length - 1].content,
    rawPath: join(base, 'private-raw', 'strict-failure-S3.json'),
    raw: () => JSON.parse(readFileSync(join(base, 'private-raw', 'strict-failure-S3.json'), 'utf8')),
    failing: [...smokeCalls.slice(0, 2), { ...smokeCalls[2], text: CAPTURE_ERROR_TEXT, error: true }],
    assertNoRawTextAnywhere: () => {
      for (const p of walk(base)) {
        assert.equal(readFileSync(p, 'utf8').includes(CAPTURE_ERROR_TEXT), false, `raw result text leaked into ${p}`)
      }
    },
  }
}
const runFailingOracle = (f, wire = 'parts', request = null) => assert.throws(
  () => toolResultTextOf(request ?? smokeHistory(wire, f.failing), { expectedCount: request ? 1 : 3, expectedTool: request ? 'read' : 'bash', onStrictFailure: f.capture }),
  /smoke oracle/,
)

for (const wire of ['classic', 'parts']) {
  test(`${wire}: an error result persists RAW to the private sink (dir 0700/file 0600) AND still throws the strict verdict`, () => {
    const f = captureFixture()
    try {
      runFailingOracle(f, wire)
      const rawFile = f.raw()
      assert.equal(rawFile.stage, 'S3')
      assert.equal(typeof rawFile.capturedAt, 'string')
      assert.match(rawFile.error.message, /error result cannot prove successful execution/)
      assert.equal(rawFile.calls[2].id, 'bash-approved')
      assert.equal(rawFile.calls[2].name, 'bash')
      assert.deepEqual(rawFile.calls[2].arguments, wire === 'classic' ? '{}' : {})
      assert.equal(rawFile.results[2].toolUseId, rawFile.calls[2].id)
      assert.equal(rawFile.results[2].isError, true)
      assert.equal(rawFile.results[2].text, CAPTURE_ERROR_TEXT)
      assert.equal(rawFile.hostTailTruncated, false)
      assert.match(rawFile.hostTail, /bash tool faulted/)
      assert.equal(statSync(join(f.base, 'private-raw')).mode & 0o777, 0o700)
      assert.equal(statSync(f.rawPath).mode & 0o777, 0o600)
      const st = f.status()
      assert.equal(st.persisted, true)
      assert.equal(st.status, 'persisted')
      assert.equal(st.rawEvidenceFile, 'strict-failure-S3.json')
      // The PUBLIC tree holds only the non-sensitive status reference.
      assert.deepEqual(readdirSync(f.publicDir), ['strict-failure-S3-status.json'])
      // Teardown removes the world afterwards — the private raw stays readable.
      rmSync(f.worldDir, { recursive: true, force: true })
      assert.equal(f.raw().results[2].text, CAPTURE_ERROR_TEXT)
    } finally { rmSync(f.base, { recursive: true, force: true }) }
  })
}

test('an association failure is captured with the decoded call/result pair', () => {
  const f = captureFixture()
  try {
    const request = smokeHistory('parts', [{ ...smokeCalls[0], resultId: 'unknown' }])
    runFailingOracle(f, 'parts', request)
    const rawFile = f.raw()
    assert.match(rawFile.error.message, /smoke oracle read step 1: missing, duplicate, stale or out-of-order call\/result id at 0/)
    assert.equal(rawFile.calls[0].id, 'read-allowed')
    assert.equal(rawFile.calls[0].name, 'read')
    assert.equal(rawFile.results[0].toolUseId, 'unknown')
    assert.equal(rawFile.results[0].isError, false)
    assert.equal(rawFile.results[0].text, smokeCalls[0].text)
  } finally { rmSync(f.base, { recursive: true, force: true }) }
})

test('no private sink configured: raw content is written NOWHERE, only the status reference exists', () => {
  const f = captureFixture({ rawSink: 'none' })
  try {
    runFailingOracle(f)
    assert.equal(f.status().persisted, false)
    assert.equal(f.status().status, 'raw-sink-unconfigured')
    assert.equal(existsSync(join(f.base, 'private-raw')), false)
    assert.deepEqual(readdirSync(f.publicDir), ['strict-failure-S3-status.json'])
    f.assertNoRawTextAnywhere()
  } finally { rmSync(f.base, { recursive: true, force: true }) }
})

test('a real writer failure reports capture-write-failed honestly and never fakes persisted:true', () => {
  const f = captureFixture({ rawSink: 'blocked' })
  try {
    runFailingOracle(f)
    const st = f.status()
    assert.equal(st.persisted, false)
    assert.equal(st.status, 'capture-write-failed')
    assert.match(st.writeError, /sink dir unusable|raw write failed|raw chmod failed/)
    assert.equal(existsSync(join(f.base, 'private-raw')), false)
    assert.deepEqual(readdirSync(f.publicDir), ['strict-failure-S3-status.json'])
    f.assertNoRawTextAnywhere()
  } finally { rmSync(f.base, { recursive: true, force: true }) }
})

test('the host tail is a bounded window: a 200 KB single line becomes <=64 KiB with truncated:true', () => {
  const f = captureFixture()
  try {
    writeFileSync(f.instanceLog, 'A'.repeat(200_000) + TAIL_MARKER + '\n')
    runFailingOracle(f)
    const rawFile = f.raw()
    assert.ok(Buffer.byteLength(rawFile.hostTail) <= 64 * 1024, `tail was ${Buffer.byteLength(rawFile.hostTail)} bytes`)
    assert.equal(rawFile.hostTailTruncated, true)
    assert.ok(rawFile.hostTail.includes(TAIL_MARKER), 'the window must still hold the newest bytes')
    assert.equal(rawFile.hostTailWindowBytes, 64 * 1024)
  } finally { rmSync(f.base, { recursive: true, force: true }) }
})

test('an oversize capture is marked capture-incomplete-oversize and never written', () => {
  const f = captureFixture({ rawMaxBytes: 512 })
  try {
    runFailingOracle(f)
    const st = f.status()
    assert.equal(st.persisted, false)
    assert.equal(st.status, 'capture-incomplete-oversize')
    assert.ok(st.rawBytes > 512)
    assert.equal(existsSync(join(f.base, 'private-raw', 'strict-failure-S3.json')), false)
  } finally { rmSync(f.base, { recursive: true, force: true }) }
})

test('the fatal summary keeps the strict-capture refs through the real writeFatalSummary path', () => {
  const f = captureFixture()
  try {
    runFailingOracle(f)
    const written = []
    const refs = writeFatalSummary('synthetic fatal', (name, content) => written.push({ name, content }))
    assert.equal(written.length, 1)
    assert.equal(written[0].name, 'summary.json')
    assert.equal(written[0].content.fatal, 'synthetic fatal')
    assert.ok(written[0].content.strictFailureCaptures.includes('strict-failure-S3-status.json'),
      'the top-level fatal rewrite must not drop the capture state')
    assert.deepEqual(refs, written[0].content.strictFailureCaptures)
  } finally { rmSync(f.base, { recursive: true, force: true }) }
})

test('a broken capture cannot mask or replace the strict oracle verdict', () => {
  assert.throws(
    () => toolResultTextOf(smokeHistory('parts', [...smokeCalls.slice(0, 2), { ...smokeCalls[2], text: 'boom', error: true }]), {
      expectedCount: 3, expectedTool: 'bash',
      onStrictFailure: () => { throw new Error('capture exploded') },
    }),
    /smoke oracle bash step 3: error result cannot prove successful execution/,
  )
})

test('a passing step never writes strict-failure evidence', () => {
  const f = captureFixture()
  try {
    const result = toolResultTextOf(smokeHistory('parts', smokeCalls.slice(0, 1)), { expectedCount: 1, expectedTool: 'read', onStrictFailure: f.capture })
    assert.equal(result, smokeCalls[0].text)
    assert.equal(f.statuses.length, 0)
    assert.deepEqual(readdirSync(f.publicDir), [])
    assert.equal(existsSync(join(f.base, 'private-raw')), false)
  } finally { rmSync(f.base, { recursive: true, force: true }) }
})

test('production wiring: S1-S4 hooks write to the private sink; fatal/teardown share the ref list', () => {
  const source = readFileSync(new URL('./rc2-real-host-smoke.mjs', import.meta.url), 'utf8')
  for (const stage of ['S1', 'S2', 'S3', 'S4']) {
    assert.ok(source.includes(`onStrictFailure: strictCapture('${stage}')`), `${stage} must wire the capture-before-assert hook`)
  }
  assert.ok(source.includes('rawSinkDir: RAW_CAPTURE_SINK_DIR'), 'the production capture must target the explicit private sink, never RUN_DIR')
  assert.ok(source.includes('RAW_EVIDENCE_DIR_ARG === null || resolve(RAW_EVIDENCE_DIR_ARG) === RUN_DIR'), 'a sink equal to the publishable evidence dir must be rejected')
  assert.ok(source.includes('strictFailureCaptures: strictCaptureReferences()'), 'the fatal summary must carry the capture refs')
  assert.ok(source.includes('writeFatalSummary(String(e.message ?? e))'), 'the top-level catch must route through the shared fatal summary')
})
