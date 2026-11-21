/**
 * vnext-admission.test.mjs — the admission point's arms, including the three unwired refusals.
 *
 * The lane predicates are the PRODUCT's (`member-io-policy`); these arms therefore test the delta
 * this module owns: the axis table, the locator requirement, the binding requirement, and the
 * record. Each negative arm removes exactly one thing the positive arm relied on.
 *
 * Run: node --test packages/runtime/test/vnext-admission.test.mjs
 */

import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

// The centre is TypeScript and imports the product packages with `.js` specifiers (the repo's
// convention, resolved to `.ts` by its test hooks). Register the hooks BEFORE the import so this
// file runs under plain `node --test` as well as under scripts/run-tests.mjs.
register(pathToFileURL(fileURLToPath(new URL('../../../scripts/run-tests-hooks.mjs', import.meta.url))).href)
const { admit, invocationFactsOf, CENTRE_TOOL_NAMES, HOST_CAPABILITY_TOOL_NAMES, mcpServerOf } = await import('../src/plugin/vnext/admission.ts')
// The centre does not own grants: `member-io-policy` does. These arms use the PRODUCT binder and
// assert the properties the centre relies on, so a regression in the product turns them red.
const { createInvocationBinder } = await import('../member-io-policy/src/invocation.ts')
const { openFactLedger } = await import('../src/plugin/vnext/fact-ledger.mjs')
const { installAdmissionPoint } = await import('../src/plugin/vnext/admission-port.mjs')
const { createSettlementWriter } = await import('../src/plugin/vnext/settlement-port.mjs')
const { bindingFromCompiledMember, installMemberCentre } = await import('../src/plugin/vnext/centre-install.mjs')
const { createExecutionSettlementStore } = await import('../settlement/execution-settlement.ts')
const { dispatchExecutionId } = await import('../settlement/dispatch-settlement.ts')

const lane = (allow = [], ask = [], deny = []) => ({ mode: 'restricted', allow, ask, deny })

const binding = (over = {}) => ({
  agentId: 'agent-1',
  sessionId: 'session-1',
  instanceGeneration: 3,
  read: lane(['/work/a']),
  write: lane(['/work/a']),
  workspaceRoot: '/work/a',
  definitionSource: '@deepseek-ai/dsh-tool-fs',
  policyGeneration: 'gen-7',
  blueprintRevision: 'rev-2',
  owner: 'team-root-1',
  ...over,
})

const call = (toolName, args, bindingOverride) => admit({ binding: bindingOverride === undefined ? binding() : bindingOverride, toolName, arguments: args })

test('ADM-1 — an in-lane read is allowed, and the record says what was asked', () => {
  const decision = call('read', { file_path: '/work/a/doc.txt' })
  assert.equal(decision.kind, 'allow')
  const facts = invocationFactsOf({ binding: binding(), toolName: 'read', callId: 'c-1', arguments: { file_path: '/work/a/doc.txt' }, admission: decision })
  assert.equal(facts.decision, 'allow')
  assert.equal(facts.axis, 'fs.read')
  assert.equal(facts.locator, '/work/a/doc.txt')
  assert.equal(facts.policyGeneration, 'gen-7')
  assert.equal(facts.instanceGeneration, 3)
  assert.equal(facts.refusalCode, undefined)
})

test('ADM-2 — out of lane is a LANE_DENY, and a write grant is never read as a read grant', () => {
  const denied = call('read', { file_path: '/work/b/doc.txt' })
  assert.equal(denied.kind, 'deny')
  assert.equal(denied.code, 'LANE_DENY')
  // The write lane is a DIFFERENT lane: the same locator is judged by the write rule set only
  // when the tool is a write tool.
  assert.equal(call('write', { file_path: '/work/a/new.txt' }).kind, 'allow')
  assert.equal(call('write', { file_path: '/work/b/new.txt' }).kind, 'deny')
})

test('ADM-3 — UNWIRED: no binding refuses, it does not fall through to the composition provider', () => {
  const decision = admit({ binding: undefined, toolName: 'read', arguments: { file_path: '/work/a/doc.txt' } })
  assert.equal(decision.kind, 'deny')
  assert.equal(decision.code, 'ADMISSION_NO_BINDING')
  const facts = invocationFactsOf({ binding: undefined, toolName: 'read', callId: 'c-2', arguments: { file_path: '/work/a/doc.txt' }, admission: decision })
  assert.equal(facts.decision, 'deny')
  assert.equal(facts.refusalCode, 'ADMISSION_NO_BINDING')
  assert.equal(facts.agentId, '', 'a refused unbound call has no agent identity to claim')
})

test('ADM-4 — UNWIRED: a tool with no declared axis is refused, never admitted by default', () => {
  // `bash` HAS an axis (process.exec), so the honest arm for "unclassified" uses a name the centre
  // has never heard of - and `bash` gets its own arm below, because its refusal is a different one.
  const decision = call('mystery_tool', { anything: 1 })
  assert.equal(decision.kind, 'deny')
  assert.equal(decision.code, 'ADMISSION_TOOL_UNBOUND')
})

test('ADM-16 — the SEARCH family is fs.read: outside denied, inside allowed, omitted path means the workspace root', () => {
  assert.equal(call('grep', { pattern: 'token', path: '/work/a/src' }).kind, 'allow')
  const outside = call('grep', { pattern: 'token', path: '/work/b' })
  assert.equal(outside.kind, 'deny')
  assert.equal(outside.code, 'LANE_DENY', 'a denied grep path must be refused for the LANE reason, not an unbound tool')
  // The ordinary call: no path at all. The default is the member's own root, which the lane covers.
  assert.equal(call('grep', { pattern: 'token' }).kind, 'allow')
  const facts = invocationFactsOf({ binding: binding(), toolName: 'grep', callId: 'c-16', arguments: { pattern: 'token' }, admission: call('grep', { pattern: 'token' }) })
  assert.equal(facts.axis, 'fs.read')
  assert.equal(facts.locator, '/work/a', 'the record says WHICH locator was judged, not an empty string')
  // A workspace root outside the lane cannot be reached by simply omitting the path.
  const rooted = call('grep', { pattern: 'token' }, binding({ workspaceRoot: '/work/b' }))
  assert.equal(rooted.kind, 'deny')
  assert.equal(rooted.code, 'LANE_DENY')
  // glob is the same axis, and cannot be smuggled past with a different tool name.
  assert.equal(call('glob', { pattern: '**/*.ts', path: '/work/b' }).kind, 'deny')
})

test('ADM-17 — the NETWORK axis is its own: unset is not allow, and allow is not inferred from the fs lanes', () => {
  const unset = call('web_fetch', { url: 'https://example.invalid/x' })
  assert.equal(unset.kind, 'deny')
  assert.equal(unset.code, 'NETWORK_DENY')
  assert.match(String(unset.reason), /unset axis is not a permission/u)
  assert.equal(call('web_fetch', { url: 'https://example.invalid/x' }, binding({ network: 'deny' })).kind, 'deny')
  const allowed = call('web_fetch', { url: 'https://example.invalid/x' }, binding({ network: 'allow' }))
  assert.equal(allowed.kind, 'allow', 'fs lanes say nothing about the network; the network axis decides')
  const facts = invocationFactsOf({ binding: binding({ network: 'allow' }), toolName: 'web_fetch', callId: 'c-17', arguments: { url: 'https://example.invalid/x' }, admission: allowed })
  assert.equal(facts.axis, 'net.fetch')
  assert.equal(facts.locator, 'https://example.invalid/x')
})

test('ADM-18 — the SUBPROCESS family is EXPLICITLY unavailable when no process lane is compiled', () => {
  for (const toolName of ['bash', 'pwsh', 'run_code']) {
    const decision = call(toolName, { command: 'ls' })
    assert.equal(decision.kind, 'deny', `${toolName} must not be admitted while no subprocess lane exists`)
    assert.equal(decision.code, 'ADMISSION_AXIS_UNSUPPORTED')
  }
  const facts = invocationFactsOf({ binding: binding(), toolName: 'bash', callId: 'c-18', arguments: { command: 'ls' }, admission: call('bash', { command: 'ls' }) })
  assert.equal(facts.axis, 'process.exec', 'the record must say which axis was unavailable')
  assert.equal(facts.refusalCode, 'ADMISSION_AXIS_UNSUPPORTED')
})

test('ADM-5 — UNWIRED: a call with no locator cannot be judged, so it is refused', () => {
  const decision = call('write', { content: 'no path here' })
  assert.equal(decision.kind, 'deny')
  assert.equal(decision.code, 'ADMISSION_NO_LOCATOR')
})

test('ADM-6 — ask stays ask: it is never promoted to allow, and the record keeps the reason', () => {
  const asking = binding({ read: lane(['/work/a'], ['/work/a/secret']) })
  const decision = call('read', { file_path: '/work/a/secret/keys.txt' }, asking)
  assert.equal(decision.kind, 'ask')
  const facts = invocationFactsOf({ binding: asking, toolName: 'read', callId: 'c-3', arguments: { file_path: '/work/a/secret/keys.txt' }, admission: decision })
  assert.equal(facts.decision, 'ask')
  assert.match(String(facts.reason), /requires approval/u)
  assert.equal(facts.refusalCode, undefined, 'an ask is not a refusal')
})

test('ADM-7 — deny wins over allow, in the product precedence', () => {
  const both = binding({ read: lane(['/work/a'], [], ['/work/a/private']) })
  const decision = call('read', { file_path: '/work/a/private/x' }, both)
  assert.equal(decision.kind, 'deny')
  assert.equal(decision.code, 'LANE_DENY')
})

test('ADM-8 — an `all` lane admits, and that is the ONLY way a locator needs no matching rule', () => {
  const all = binding({ read: { mode: 'all', allow: [], ask: [], deny: [] } })
  assert.equal(call('read', { file_path: '/anywhere/at/all' }, all).kind, 'allow')
  assert.equal(call('read', { file_path: '/anywhere/at/all' }).kind, 'deny', 'a restricted lane with no rule denies the same locator')
})

test('ADM-9 — `path` is accepted where the tool uses it, and a blank locator is treated as absent', () => {
  assert.equal(call('read', { path: '/work/a/x' }).kind, 'allow')
  const blank = call('read', { file_path: '   ' })
  assert.equal(blank.kind, 'deny')
  assert.equal(blank.code, 'ADMISSION_NO_LOCATOR')
})

// ---------------------------------------------------------------------------- one-shot grants
//
// `ask` is granted per CALL, not per locator: the approval authorizes exactly one execution. The
// binder is the product's, and these arms measure the three ways an approval must die - it was
// used, it belongs to another member/call/binding, or the world moved (epoch bump / member revoke).

const member = (over = {}) => ({ teamId: 'team-1', memberInstanceId: 'member-1', templateId: 'tmpl-1', instanceGeneration: 2, ...over })
const bindInput = (binder, over = {}) => binder.bind({
  member: member(),
  callId: 'call-1',
  policyRevision: 'rev-1',
  toolBindingIdentity: 'owner/read',
  approvedOnce: true,
  lease: null,
  ...over,
})
const consumeRequest = (over = {}) => ({ memberIdentity: 'member-1', callId: 'call-1', policyRevision: 'rev-1', toolBindingIdentity: 'owner/read', ...over })

test('ADM-10 — one approval, one execution: a consumed grant cannot be presented again', () => {
  const binder = createInvocationBinder()
  const bound = bindInput(binder)
  assert.equal(bound.ok, true, JSON.stringify(bound))
  const first = binder.consume(bound.value, consumeRequest())
  assert.equal(first.ok, true, JSON.stringify(first))
  const second = binder.consume(bound.value, consumeRequest())
  assert.equal(second.ok, false)
  assert.equal(second.code, 'CAPABILITY_CONSUMED', 'a second execution on one approval is exactly what a one-shot grant forbids')
})

test('ADM-11 — a grant is bound to its call: another member/call/binding is refused', () => {
  const binder = createInvocationBinder()
  const bound = bindInput(binder)
  assert.equal(bound.ok, true)
  for (const [field, request, code] of [
    ['member', consumeRequest({ memberIdentity: 'member-2' }), 'CAPABILITY_MEMBER_MISMATCH'],
    ['call', consumeRequest({ callId: 'call-2' }), 'CAPABILITY_CALL_MISMATCH'],
    ['binding', consumeRequest({ toolBindingIdentity: 'owner/write' }), 'CAPABILITY_BINDING_MISMATCH'],
    ['revision', consumeRequest({ policyRevision: 'rev-2' }), 'CAPABILITY_REVISION_MISMATCH'],
  ]) {
    const result = binder.consume(bound.value, request)
    assert.equal(result.ok, false, `${field} mismatch must refuse`)
    assert.equal(result.code, code, `${field} mismatch refused with ${result.code}`)
  }
  // ...and none of those attempts burned the grant: the real request still works exactly once.
  assert.equal(binder.consume(bound.value, consumeRequest()).ok, true)
})

test('ADM-12 — the world moving kills an outstanding grant: cold start and member revocation', () => {
  const binder = createInvocationBinder()
  const cold = bindInput(binder)
  assert.equal(cold.ok, true)
  binder.bumpEpoch()
  const afterCold = binder.consume(cold.value, consumeRequest())
  assert.equal(afterCold.ok, false)
  assert.equal(afterCold.code, 'CAPABILITY_EPOCH_STALE', 'a cold start must not leave an approved call usable')

  const revoked = bindInput(binder)
  assert.equal(revoked.ok, true)
  binder.revoke('member-1')
  const afterRevoke = binder.consume(revoked.value, consumeRequest())
  assert.equal(afterRevoke.ok, false)
  assert.equal(afterRevoke.code, 'CAPABILITY_MEMBER_REVOKED', 'revocation must reach a grant already minted')
})

test('ADM-13 — a structural COPY of a grant is not a grant', () => {
  const binder = createInvocationBinder()
  const bound = bindInput(binder)
  assert.equal(bound.ok, true)
  const copy = { ...bound.value }
  const result = binder.consume(copy, consumeRequest())
  assert.equal(result.ok, false)
  assert.equal(result.code, 'CAPABILITY_UNKNOWN', 'branding is the point: a JSON round-trip must not mint authority')
})

// ------------------------------------------------------------------- UNKNOWN is not permission
//
// The dangerous reading of a durable store is "no record found, so nothing objected". These arms
// pin the opposite: an unanswerable question is UNKNOWN, and a store that cannot read itself
// answers UNKNOWN for EVERYTHING rather than a partial truth.

test('ADM-14 — an unknown callId is UNKNOWN, never "not refused, therefore allowed"', async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const ledger = openFactLedger({ path: `${mkdtempSync(`${tmpdir()}/vnext-unknown-`)}/facts.jsonl` })
  assert.equal(ledger.observe('never-seen').state, 'UNKNOWN')
  assert.match(String(ledger.observe('never-seen').reason), /no durable admission record/u)
  ledger.recordAdmission({ callId: 'seen-1', decision: 'deny' })
  assert.equal(ledger.observe('seen-1').state, 'KNOWN')
  assert.equal(ledger.observe('seen-1').admission.decision, 'deny', 'a REFUSAL is a known state, not an absence')
})

test('ADM-15 — a ledger that cannot read itself reports UNKNOWN for everything and refuses new writes', async () => {
  const { mkdtempSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const base = mkdtempSync(`${tmpdir()}/vnext-health-`)
  const broken = `${base}/broken.jsonl`
  writeFileSync(broken, '{"kind":"invocation-authority","callId":"t-1","decision":"allow"}\n{"kind":"invo')
  const ledger = openFactLedger({ path: broken })
  const health = ledger.health()
  assert.equal(health.state, 'UNKNOWN')
  assert.equal(health.reason, 'LEDGER_TRUNCATED')
  assert.throws(() => ledger.recordAdmission({ callId: 'new-1', decision: 'allow' }), (error) => error.code === 'LEDGER_TRUNCATED', 'a corrupt ledger must fail closed, not start a second history beside the truncated one')
})

// ------------------------------------------------- POST-APPROVAL RECHECK (the guard re-decides)
//
// An approval is a decision at a moment, not a licence. Between the ask and the body the policy can
// be recompiled or narrowed, so the guard - the last point before the body - re-decides with the
// binding as it is NOW. These arms use a fake tools service: no host, no dispatch, just the two
// stages the host calls.

const fakeHost = () => {
  const listeners = {}
  let guardFn
  const tools = {
    guard (fn) { guardFn = fn; return () => {} },
  }
  const ctx = {
    get: (name) => (name === 'tools' ? tools : undefined),
    on: (event, fn) => { listeners[event] = fn; return () => {} },
  }
  return {
    ctx,
    preExecute: async (exec) => listeners['tools/pre-execute'](exec, async () => ({ kind: 'allow' })),
    guard: (exec) => guardFn(exec),
    result: (exec) => listeners['tools/result'](exec),
  }
}

const askBinding = () => binding({ read: lane(['/work/a'], ['/work/ask']) })

test('ADM-19 — an approval that no longer holds at guard time is REFUSED, not executed', async () => {
  const host = fakeHost()
  let current = askBinding()
  const facts = []
  installAdmissionPoint({
    ctx: host.ctx,
    resolveBinding: () => current,
    record: (fact) => facts.push(fact),
    grants: {
      binder: createInvocationBinder(),
      memberOf: (b) => ({ teamId: 'team-1', memberInstanceId: b.agentId, templateId: 'tmpl', instanceGeneration: b.instanceGeneration }),
    },
  })
  const exec = { name: 'read', callId: 'recheck-1', arguments: { file_path: '/work/ask/doc.txt' } }
  const asked = await host.preExecute(exec)
  assert.equal(asked.kind, 'ask', 'the ask must be raised so there is something to recheck')
  // The lane narrows between approval and execution: the same locator is now outside it.
  current = binding({ read: lane(['/work/a']) })
  const verdict = await host.guard(exec)
  assert.equal(typeof verdict, 'string', 'the guard must refuse after the authority changed')
  assert.match(verdict, /ADMISSION_RECHECK_LANE_DENY/u)
  assert.equal(facts.length, 1, 'the recheck does not write a second authority record; it refuses the call')
})

test('ADM-20 — an approval that still holds is spent exactly once, and a replay meets the ledger', async () => {
  const host = fakeHost()
  const facts = []
  installAdmissionPoint({
    ctx: host.ctx,
    resolveBinding: () => askBinding(),
    record: (fact) => facts.push(fact),
    // The replay authority is the DURABLE side; here the fact list stands in for the ledger so the
    // arm can prove the memo's lifetime is one execution.
    isReplay: (callId) => facts.some((fact) => fact.callId === callId),
    grants: {
      binder: createInvocationBinder(),
      memberOf: (b) => ({ teamId: 'team-1', memberInstanceId: b.agentId, templateId: 'tmpl', instanceGeneration: b.instanceGeneration }),
    },
  })
  const exec = { name: 'read', callId: 'recheck-2', arguments: { file_path: '/work/ask/doc.txt' } }
  assert.equal((await host.preExecute(exec)).kind, 'ask')
  assert.equal(await host.guard(exec), undefined, 'the unchanged authority must let the approved call through')
  assert.equal(await host.guard(exec), undefined, 'the host consults the guard twice in one execution; the memo serves the second')
  host.result(exec)
  // A SECOND dispatch with the same callId is a replay: the memo is gone with the execution.
  const replayed = await host.preExecute(exec)
  assert.equal(replayed.kind, 'deny')
  assert.match(String(replayed.reason), /ADMISSION_REPLAY/u)
})

// ------------------------------------------------------- SETTLEMENT, through the product's store
//
// The centre writes the product's `ExecutionSettlementStore`, which owns the transition law. It does
// not decide anything: the admission decision is referenced, the outcome is the host's, and the
// store refuses to re-drive a terminal state.

const settlementWorld = async (label) => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const dir = mkdtempSync(`${tmpdir()}/vnext-settle-${label}-`)
  const store = createExecutionSettlementStore({ dir })
  const writer = createSettlementWriter({
    store,
    identityOf: (exec) => ({
      executionId: dispatchExecutionId({ rootSessionId: 'session-1', agentInstanceId: 'agent-1' }, exec.callId),
      actorId: 'agent-1',
      worldId: 'session-1',
    }),
  })
  return { store, writer }
}

test('ADM-21 — a completed call walks ADMITTED -> RUNNING -> COMPLETED in the product store', async () => {
  const { store, writer } = await settlementWorld('done')
  const exec = { name: 'read', callId: 'settle-1' }
  writer.admitted({ exec, callId: 'settle-1', admission: { kind: 'allow' } })
  writer.running({ exec })
  writer.settled({ exec, outcome: 'completed' })
  const executionId = dispatchExecutionId({ rootSessionId: 'session-1', agentInstanceId: 'agent-1' }, 'settle-1')
  const record = store.read(executionId)
  assert.equal(record.state, 'COMPLETED')
  // The store is terminal: a second settlement is refused by the PRODUCT, not by a flag here.
  assert.throws(() => writer.settled({ exec, outcome: 'failed' }), (error) => error.code === undefined || /SETTLEMENT/u.test(String(error.code ?? error.name)))
})

test('ADM-22 — a call refused at admission is REFUSED without ever entering RUNNING', async () => {
  const { store, writer } = await settlementWorld('refused')
  const exec = { name: 'read', callId: 'settle-2' }
  writer.admitted({ exec, callId: 'settle-2', admission: { kind: 'deny', code: 'LANE_DENY', reason: 'outside the lane' } })
  const executionId = dispatchExecutionId({ rootSessionId: 'session-1', agentInstanceId: 'agent-1' }, 'settle-2')
  const record = store.read(executionId)
  assert.equal(record.state, 'REFUSED')
  assert.equal(String(record.terminalReason ?? '').includes('LANE_DENY'), true, `the refusal code must survive into the settlement record: ${JSON.stringify(record.terminalReason)}`)
})

test('ADM-23 — a process that dies mid-call recovers as UNKNOWN, never as success or failure', async () => {
  const { store, writer } = await settlementWorld('crash')
  const exec = { name: 'read', callId: 'settle-3' }
  writer.admitted({ exec, callId: 'settle-3', admission: { kind: 'allow' } })
  writer.running({ exec })
  // ...and the process is gone: nothing settles this record.
  const recovered = writer.recover()
  const mine = recovered.find((entry) => entry.executionId === dispatchExecutionId({ rootSessionId: 'session-1', agentInstanceId: 'agent-1' }, 'settle-3'))
  assert.notEqual(mine, undefined, 'the unsettled RUNNING record must be reconciled')
  assert.equal(mine.before, 'RUNNING')
  assert.equal(mine.after, 'UNKNOWN', 'an effect nobody observed is UNKNOWN - the one honest answer')
  assert.equal(mine.missingEvidence.length > 0, true, 'the record must say WHAT was not observed, not just that it was not')
})

test('ADM-24 — WITH a compiled process lane, the shell is judged on its working directory', () => {
  const withLane = binding({ process: lane(['/work/a']) })
  assert.equal(call('bash', { command: 'ls' }, withLane).kind, 'allow', 'the workspace root is inside the process lane')
  const outside = call('bash', { command: 'ls' }, binding({ process: lane(['/work/a']), workspaceRoot: '/work/b' }))
  assert.equal(outside.kind, 'deny')
  assert.equal(outside.code, 'LANE_DENY')
  const facts = invocationFactsOf({ binding: withLane, toolName: 'bash', callId: 'c-24', arguments: { command: 'ls' }, admission: call('bash', { command: 'ls' }, withLane) })
  assert.equal(facts.axis, 'process.exec')
  assert.equal(facts.locator, '/work/a', 'the judged locator is the shell directory, and the record says which one')
  // A process lane does not leak into the fs axes, and vice versa.
  assert.equal(call('read', { file_path: '/work/b/x' }, withLane).kind, 'deny', 'a process lane is not a read permission')
})

test('ADM-25 — the centre\'s own tools are admitted on authority, not on a file lane', () => {
  // Every team_* tool is declared centre-owned: bound => allow, with an axis that says so. The
  // alternative would be to invent an fs lane for `team_delegate`, which is a category error.
  for (const toolName of ['team_delegate', 'team_resolve_control', 'team_grant_permission', 'team_revoke_permission']) {
    const decision = call(toolName, {}, binding())
    assert.equal(decision.kind, 'allow', `${toolName} must be admitted for a bound agent`)
    const facts = invocationFactsOf({ binding: binding(), toolName, callId: `c-${toolName}`, arguments: {}, admission: decision })
    assert.equal(facts.axis, 'team.control')
    assert.equal(facts.locator, '', 'a centre tool has no locator, and the record must not invent one')
  }
  // The authority is NOT a blanket: an unbound agent still cannot speak for a team.
  assert.equal(admit({ binding: undefined, toolName: 'team_delegate', arguments: {} }).code, 'ADMISSION_NO_BINDING')
  // And the closed list is closed: an unknown tool is still refused by name.
  assert.equal(call('some_future_tool', {}, binding()).code, 'ADMISSION_TOOL_UNBOUND')
  // A centre tool is not a way to reach an I/O lane: the fs axes stay exactly as strict.
  assert.equal(call('read', { file_path: '/elsewhere/x' }, binding()).kind, 'deny')
})

// ------------------------------------------------- THE PRODUCT COMPOSITION POINT
//
// `installMemberCentre` is the ONE place a member agent is wired to the centre. These arms pin its
// two halves: the compiled member policy maps onto a binding without reinterpreting it, and the
// three observation points install over one callId.

const compiledMember = (read = lane(['/work/a']), write = lane(['/work/a']), network = 'deny') => ({
  identity: { memberInstanceId: 'member-1', instanceGeneration: 7, blueprintRevision: 'bp-1' },
  policy: { ok: true, value: { memberIdentity: 'member-1', revision: 'rev-1', read, write, network: { access: network }, instanceGeneration: 7 } },
})

test('ADM-26 — a compiled member maps onto a binding by reference, never by re-interpretation', () => {
  const member = compiledMember(lane(['/work/a'], ['/work/ask']), lane(['/work/a']), 'allow')
  const b = bindingFromCompiledMember({ member, agentId: 'agent-1', sessionId: 'session-1', workspaceRoot: '/work/a', owner: 'root-1' })
  assert.equal(b.read, member.policy.value.read, 'the READ lane must be the SAME object: a rebuilt lane is a second policy')
  assert.equal(b.write, member.policy.value.write)
  assert.equal(b.network, 'allow')
  assert.equal(b.instanceGeneration, 7)
  assert.equal(b.policyGeneration, 'rev-1')
  assert.equal(b.blueprintRevision, 'bp-1')
  assert.equal(b.process, undefined, 'no subprocess lane compiled => process.exec stays unsupported')
  // Per-tool compiled answers are carried THROUGH by tool name, by reference, so admission can pick
  // the tool's own intersection instead of the ceiling.
  const toolEffective = { memberIdentity: 'member-1', toolBindingIdentity: 'dsh.fs/read', invocationId: 'i', policyRevision: 'rev-1', read: lane(['/work/a/docs']), write: lane(['/work/a']), network: { access: 'deny' } }
  const withTool = bindingFromCompiledMember({
    member, agentId: 'agent-1', sessionId: 'session-1', workspaceRoot: '/work/a',
    bindings: [{ identity: {}, toolBindingIdentity: 'dsh.fs/read', toolName: 'read', effective: toolEffective }],
  })
  assert.equal(withTool.perTool.read.read, toolEffective.read, 'the tool lane must be the compiled object, not a copy')
  assert.equal(withTool.perTool.read.network, 'deny')
  assert.equal(call('read', { file_path: '/work/a/other.md' }, withTool).code, 'LANE_DENY', 'the tool lane, not the ceiling, decides')
  // A compiled answer without lanes is refused rather than defaulted to something permissive.
  assert.throws(() => bindingFromCompiledMember({ member: { identity: {}, policy: { value: { revision: 'r' } } }, agentId: 'a', sessionId: 's', workspaceRoot: '/w' }), /read and write lanes/u)
})

test('ADM-27 — installMemberCentre wires admission, facts and settlement over ONE callId', async () => {
  const host = fakeHost()
  const admitted = []
  const executed = []
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const store = createExecutionSettlementStore({ dir: mkdtempSync(`${tmpdir()}/vnext-centre-`) })
  const identityOf = (exec) => ({
    executionId: dispatchExecutionId({ rootSessionId: 'session-1', agentInstanceId: 'agent-1' }, exec.callId),
    actorId: 'agent-1',
    worldId: 'session-1',
  })
  const centre = installMemberCentre({
    ctx: host.ctx,
    binding: bindingFromCompiledMember({ member: compiledMember(), agentId: 'agent-1', sessionId: 'session-1', workspaceRoot: '/work/a' }),
    recordAdmission: (fact) => admitted.push(fact),
    recordExecution: (fact) => executed.push(fact),
    store,
    identityOf,
  })
  try {
    const exec = { name: 'read', callId: 'centre-1', arguments: { file_path: '/work/a/doc.txt' }, agent: { id: 'agent-1' }, turn: 1, step: 1 }
    assert.equal((await host.preExecute(exec)).kind, 'allow')
    assert.equal(host.guard(exec), undefined)
    host.result({ ...exec, result: { isError: false } })
    assert.equal(admitted.length, 1)
    assert.equal(executed.length, 1)
    const record = store.read(identityOf(exec).executionId)
    assert.equal(record.state, 'COMPLETED', 'the settlement must close the same execution the fact named')
    assert.equal(record.identity.toolName, 'read')
  } finally {
    centre.dispose()
  }
})

test('ADM-28 — the centre refuses an out-of-lane call BEFORE the body, on the product composition point', async () => {
  const host = fakeHost()
  const executed = []
  const centre = installMemberCentre({
    ctx: host.ctx,
    binding: bindingFromCompiledMember({ member: compiledMember(), agentId: 'agent-1', sessionId: 'session-1', workspaceRoot: '/work/a' }),
    recordAdmission: () => {},
    recordExecution: (fact) => executed.push(fact),
  })
  try {
    const exec = { name: 'read', callId: 'centre-2', arguments: { file_path: '/elsewhere/secret' }, agent: { id: 'agent-1' }, turn: 1, step: 1 }
    const decision = await host.preExecute(exec)
    assert.equal(decision.kind, 'deny')
    assert.match(String(decision.reason), /LANE_DENY|outside the binding/u)
    host.result({ ...exec, result: { isError: true, error: { message: 'x' } } })
    assert.equal(executed[0].outcome, 'admission-refusal', 'the fact must say the CENTRE refused, not that the tool failed')
  } finally {
    centre.dispose()
  }
  // ...and after disposal no point answers any more.
  assert.equal(host.guard({ name: 'read', callId: 'centre-3', arguments: { file_path: '/work/a/x' } }), undefined)
})

test('ADM-29 — a TOOL restriction answers before the ceiling, and it can only narrow', () => {
  // The compiler already produced the intersection; the centre's job is to pick the right compiled
  // answer for the call, never to combine two of them.
  const b = binding({
    read: lane(['/work']),
    write: lane(['/work']),
    perTool: {
      read: { read: lane(['/work/docs']), write: lane(['/work']) },
      grep: { read: lane(['/work']), write: lane(['/work']), network: 'unsupported' },
    },
  })
  assert.equal(call('read', { file_path: '/work/docs/a.md' }, b).kind, 'allow')
  const outsideToolLane = call('read', { file_path: '/work/other.md' }, b)
  assert.equal(outsideToolLane.kind, 'deny', 'inside the CEILING but outside the TOOL lane must be denied')
  assert.equal(outsideToolLane.code, 'LANE_DENY')
  // A tool with no declared restriction falls back to the ceiling - and only there.
  assert.equal(call('write', { file_path: '/work/new.md' }, b).kind, 'allow')
  // A per-tool network answer of 'unsupported' refuses the fetch even though the ceiling allows it.
  const net = binding({ network: 'allow', perTool: { web_fetch: { read: lane(['/work']), write: lane(['/work']), network: 'unsupported' } } })
  const decided = call('web_fetch', { url: 'https://example.test/x' }, net)
  assert.equal(decided.kind, 'deny')
  assert.equal(decided.code, 'NETWORK_DENY')
  assert.match(String(decided.reason), /unsupported/u)
})

test('ADM-30 — the tool-level answer reaches the record, so a refusal names what was judged', () => {
  const b = binding({ read: lane(['/work']), perTool: { read: { read: lane(['/work/docs']), write: lane(['/work']) } } })
  const decision = call('read', { file_path: '/work/other.md' }, b)
  const facts = invocationFactsOf({ binding: b, toolName: 'read', callId: 'c-30', arguments: { file_path: '/work/other.md' }, admission: decision })
  assert.equal(facts.locator, '/work/other.md')
  assert.equal(facts.decision, 'deny')
  assert.equal(facts.refusalCode, 'LANE_DENY')
})

test('ADM-31 — the centre\'s closed list matches the tools the product actually creates', async () => {
  // A SOURCE SCAN, deliberately: importing the tools package here would drag the whole team-tool
  // dependency graph into an admission unit arm. The point is drift detection - if a 16th tool is
  // added to `createTeamTools` and nobody adds it to CENTRE_TOOL_NAMES, every call to it would be
  // refused as ADMISSION_TOOL_UNBOUND, and this arm must fail first.
  const { readFileSync } = await import('node:fs')
  // Resolved the same way this file already resolves the hooks script (test/ → runtime/ → packages/
  // → worktree root), so the arm keeps working whether it runs from source or a dist mirror.
  const source = readFileSync(new URL('../../../packages/tools/src/tools.ts', import.meta.url), 'utf8')
  const literal = new Set([...source.matchAll(/name: '(team_[a-z_]+)'/gu)].map((match) => match[1]))
  // The permission pair is created by a parameterised factory, so its names never appear as
  // literals; the scan derives them from the factory's arguments instead of hard-coding them here.
  for (const verb of [...source.matchAll(/permissionSpec\('([a-z]+)'\)/gu)].map((match) => match[1])) {
    literal.add(`team_${verb}_permission`)
  }
  assert.deepEqual([...literal].sort(), [...CENTRE_TOOL_NAMES].sort(),
    'the centre\'s closed list and the created tools must be the same set, in both directions')
})

test('ADM-32 — preserved host capabilities stay usable, and an MCP name still needs a server', () => {
  // Refusing these would be the feature loss C exists to prevent: their I/O is the HOST's service
  // (goal store, $DSH_HOME/skills, subagent registry), not the member's workspace.
  for (const toolName of HOST_CAPABILITY_TOOL_NAMES) {
    const decision = call(toolName, {}, binding())
    assert.equal(decision.kind, 'allow', `${toolName} must stay usable for a bound agent`)
    const facts = invocationFactsOf({ binding: binding(), toolName, callId: `c-host-${toolName}`, arguments: {}, admission: decision })
    assert.equal(facts.axis, 'host.service')
  }
  // Still not a blanket: an unbound agent gets nothing.
  assert.equal(admit({ binding: undefined, toolName: 'skill', arguments: {} }).code, 'ADMISSION_NO_BINDING')
  // MCP names are judged on the network axis (ADM-33). With the axis unset the call is refused - and
  // a name that names no server is refused as malformed rather than matched by prefix.
  const mcp = call('mcp__github__search', { query: 'x' }, binding())
  assert.equal(mcp.kind, 'deny')
  assert.equal(mcp.code, 'NETWORK_DENY')
})

test('ADM-33 — an MCP tool is judged on the NETWORK axis, with the SERVER as its locator', () => {
  const open = binding({ network: 'allow' })
  const decision = call('mcp__github__search_code', { query: 'x' }, open)
  assert.equal(decision.kind, 'allow')
  const facts = invocationFactsOf({ binding: open, toolName: 'mcp__github__search_code', callId: 'c-33', arguments: { query: 'x' }, admission: decision })
  assert.equal(facts.axis, 'net.mcp')
  assert.equal(facts.locator, 'github', 'the locator is the SERVER; a path nobody judged must not be recorded')
  // Unset is not allow, and deny is deny.
  for (const b of [binding(), binding({ network: 'deny' })]) {
    const refused = call('mcp__github__search_code', { query: 'x' }, b)
    assert.equal(refused.kind, 'deny')
    assert.equal(refused.code, 'NETWORK_DENY')
  }
  // A tool-level restriction still narrows it.
  const narrowed = binding({ network: 'allow', perTool: { mcp__github__search_code: { read: lane(['/work']), write: lane(['/work']), network: 'deny' } } })
  assert.equal(call('mcp__github__search_code', {}, narrowed).code, 'NETWORK_DENY')
  // A prefix is not a permission: `mcp__` with no server is malformed, not a wildcard.
  const malformed = call('mcp__', {}, open)
  assert.equal(malformed.kind, 'deny')
  assert.equal(malformed.code, 'ADMISSION_TOOL_UNBOUND')
  assert.equal(call('mcp__github', {}, open).code, 'ADMISSION_TOOL_UNBOUND', 'a server with no tool name is equally malformed')
})

test('ADM-34 — the centre\'s config rules are checkable without booting the host', async () => {
  // The rule was first written inline in host.ts, which reaches the remote handler tree through `.js`
  // specifiers that only exist after a build - so the only way to verify it was a full build, and the
  // build was broken. The pure function is the whole rule.
  const { centreConfigViolation } = await import('../src/plugin/vnext/centre-config.ts')
  // A plain row is untouched.
  assert.equal(centreConfigViolation({}), undefined)
  assert.equal(centreConfigViolation(undefined), undefined)
  // R1: Alpha.6 review routing needs somewhere durable for its decisions.
  assert.match(String(centreConfigViolation({ alpha6ReviewRouting: true })), /requires centreStatePath/u)
  // An empty path is refused by the PATH rule first - the message names the value, which is what an
  // operator needs; the Alpha.6 rule is the one that fires when the key is absent entirely.
  assert.match(String(centreConfigViolation({ alpha6ReviewRouting: true, centreStatePath: '' })), /non-empty string/u)
  assert.equal(centreConfigViolation({ alpha6ReviewRouting: true, centreStatePath: '/srv/centre' }), undefined)
  // The path itself is validated even when Alpha.6 is off.
  assert.match(String(centreConfigViolation({ centreStatePath: 42 })), /non-empty string/u)
  // Absent is not "empty": a row that never mentions the centre is legal.
  assert.equal(centreConfigViolation({ alpha6ReviewRouting: false }), undefined)
})
