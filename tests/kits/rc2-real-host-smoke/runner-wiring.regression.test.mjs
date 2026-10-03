import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { guardedDecide, requestStateKey, spawnHost, systemTextOf, userTextOf } from './rc2-real-host-smoke.mjs'
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
