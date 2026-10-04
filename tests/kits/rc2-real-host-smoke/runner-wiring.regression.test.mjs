import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { guardedDecide, requestStateKey, spawnHost, systemTextOf, toolResultTextOf, userTextOf } from './rc2-real-host-smoke.mjs'
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
