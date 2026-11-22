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
import { appendFileSync, existsSync, rmSync } from 'node:fs'
import { join as pathJoin } from 'node:path'
import { register } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

// The centre is TypeScript and imports the product packages with `.js` specifiers (the repo's
// convention, resolved to `.ts` by its test hooks). Register the hooks BEFORE the import so this
// file runs under plain `node --test` as well as under scripts/run-tests.mjs.
register(pathToFileURL(fileURLToPath(new URL('../../../scripts/run-tests-hooks.mjs', import.meta.url))).href)
const { admit, invocationFactsOf, CENTRE_TOOL_NAMES, HOST_CAPABILITY_TOOL_NAMES } = await import('../src/plugin/vnext/admission.ts')
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

test('ADM-18 — the SUBPROCESS family is EXPLICITLY unavailable when no tool-level EXECUTION authorization is compiled', () => {
  // ROUND 75 (owner ruling, review 20261122-1536 §1): a process tool is no longer judged on a
  // process LANE (there is none and there must not be). It is judged on the v4 tool-level EXECUTION
  // authorization. This binding declares none, so absence is not permission and the call is refused
  // with the execution-specific code — not admitted, and not silently re-read as an fs lane.
  for (const toolName of ['bash', 'pwsh']) {
    const decision = call(toolName, { command: 'ls' })
    assert.equal(decision.kind, 'deny', `${toolName} must not be admitted while no execution authorization exists`)
    assert.equal(decision.code, 'ADMISSION_EXECUTION_UNAUTHORIZED')
  }
  // C7 (round 55): `run_code` is the PTC entry and PTC is a DIFFERENT absence from "a shell with no
  // execution authorization" — the escalation row would be a second execution authority even if the
  // tool were authorized. It therefore carries its own code; collapsing the two made both unreviewable.
  const ptc = call('run_code', { command: 'ls' })
  assert.equal(ptc.kind, 'deny')
  assert.equal(ptc.code, 'ADMISSION_PTC_UNAVAILABLE')
  assert.notEqual(ptc.code, call('bash', { command: 'ls' }).code, 'the two absences must stay distinguishable')
  const facts = invocationFactsOf({ binding: binding(), toolName: 'bash', callId: 'c-18', arguments: { command: 'ls' }, admission: call('bash', { command: 'ls' }) })
  assert.equal(facts.axis, 'process.exec', 'the record must say which axis the absence belongs to')
  assert.equal(facts.refusalCode, 'ADMISSION_EXECUTION_UNAUTHORIZED')
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
    // The HOST-NATIVE ask: no durable approval authority, so the pre-execute verdict is the host's
    // approval prompt and the grant anticipates it. (The durable-Control shape is ADM-50/51.)
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
  const asked = await host.preExecute(exec)
  assert.equal(asked.kind, 'ask')
  assert.equal(facts[0].decision, 'ask', 'the record keeps the ask for the host-native shape: approval does not rewrite what was asked')
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
  const { writer } = await settlementWorld('crash')
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

test('ADM-24 — a compiled EXECUTION authorization admits the shell, and the working directory never decides', () => {
  // ROUND 75: the old arm asserted the shell was judged on its cwd against `Binding.process`. That
  // was the axis confusion the owner struck down: a cwd does not bound what a shell can open. The
  // SAME authorization now admits the shell from ANY cwd, and the record still names the cwd as
  // context — never as the permission.
  const authorized = binding({
    workspaceRoot: '/work/a',
    executors: { 'confined-subprocess': 'ready' },
    perTool: { bash: { authorization: 'allow', execution: { implementationOrigin: 'dsh-native', executionBoundary: 'confined-subprocess' } } },
  })
  assert.equal(call('bash', { command: 'ls' }, authorized).kind, 'allow')
  const elsewhere = { ...authorized, workspaceRoot: '/somewhere/else' }
  assert.equal(call('bash', { command: 'ls' }, elsewhere).kind, 'allow', 'the cwd is not a permission: moving it changes nothing')
  const facts = invocationFactsOf({ binding: authorized, toolName: 'bash', callId: 'c-24', arguments: { command: 'ls' }, admission: call('bash', { command: 'ls' }, authorized) })
  assert.equal(facts.axis, 'process.exec')
  assert.equal(facts.locator, '/work/a', 'the cwd is recorded as context, and the record still names it')
  // Execution authority is not a path lane: it does not widen any fs axis, and vice versa.
  assert.equal(call('read', { file_path: '/work/b/x' }, authorized).kind, 'deny', 'a process authorization is not a read permission')
  // A read/write lane never becomes process authority either.
  const wideFs = binding({ read: { mode: 'all', allow: [], ask: [], deny: [] }, write: { mode: 'all', allow: [], ask: [], deny: [] } })
  assert.equal(call('bash', { command: 'ls' }, wideFs).code, 'ADMISSION_EXECUTION_UNAUTHORIZED', 'an open fs lane must not stand in for execution authority')
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
  assert.equal(b.process, undefined, 'round 75: there is no process LANE field at all; execution authority rides perTool')
  assert.equal(b.perTool, undefined, 'and with no compiled tool binding, a process tool has no execution authority to admit it')
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
  // R1 (settled round 55): Alpha.6 review routing is EXPLICITLY UNAVAILABLE — the code names the
  // missing axis, and a path no longer buys the opt-in (the decisions were never the centre's).
  const alpha6WithPath = centreConfigViolation({ alpha6ReviewRouting: true, centreStatePath: '/srv/centre' })
  assert.match(String(alpha6WithPath), /ADMISSION_ALPHA6_UNAVAILABLE/u)
  assert.match(String(alpha6WithPath), /no review-routing axis/u)
  // The path itself is validated even when Alpha.6 is off.
  assert.match(String(centreConfigViolation({ centreStatePath: 42 })), /non-empty string/u)
  // Absent is not "empty": a row that never mentions the centre is legal.
  assert.equal(centreConfigViolation({ alpha6ReviewRouting: false }), undefined)
})

test('ADM-35 — the member execution composition refuses to run a governed member unrecorded', async () => {
  const { installMemberExecution } = await import('../src/plugin/vnext/member-execution.mjs')
  const compiledAnswer = {
    members: [{
      memberIdentity: 'member-1', templateId: 'worker', instanceGeneration: 1, revision: 'rev-1',
      read: lane(['/work']), write: lane(['/work']), network: 'deny',
    }],
  }
  const base = {
    agentCtx: {}, realm: {}, sessionId: 'session-1', instanceId: 'member-1', teamRoot: 'root-1',
    workspaceRoot: '/work', onDispose: () => {}, onNativeDispose: () => {}, observe: () => {},
  }
  // No state directory: refused, and the message names the member and the key.
  await assert.rejects(
    () => installMemberExecution({ ...base, compiledAnswer, config: {} }),
    (error) => /member-1/u.test(error.message) && /centreStatePath/u.test(error.message),
    'a governed member with nowhere to record must be refused, not run',
  )
  // An UNGOVERNED member (no compiled answer) installs nothing and touches no realm.
  assert.equal(await installMemberExecution({ ...base, compiledAnswer: undefined, config: {} }), undefined)
  // The two lifecycle callbacks are mandatory: a centre without a disposer outlives its member.
  await assert.rejects(() => installMemberExecution({ ...base, compiledAnswer: undefined, config: {}, onDispose: undefined }), /onDispose/u)
  await assert.rejects(() => installMemberExecution({ ...base, compiledAnswer: undefined, config: {}, observe: undefined }), /observe/u)
})

test('ADM-36 — session identity, the durable lifecycle gate and the admission close, on their own', async () => {
  // The extracted component is testable without a boot, a live handle or 5,000 lines of closure: that
  // is the whole reason it was extracted. Each arm below is a question a resurrection seam asks.
  const { createSessionIdentity } = await import('../src/plugin/vnext/session-identity.mjs')
  const rows = [
    { instanceId: 'inst-a', childSessionId: 'session-a', lifecycle: 'SETTLED' },
    { instanceId: 'inst-b', childSessionId: 'session-b', lifecycle: 'ARCHIVED' },
    { instanceId: 'inst-c', childSessionId: 'session-c', lifecycle: 'DISPOSED' },
  ]
  const domain = { repositories: { memberInstances: { list: () => rows } } }
  const identity = createSessionIdentity({
    domain,
    bootRootSessionId: 'root-1',
    sessionPersistence: { exists: async (id) => id === 'session-a' },
  })
  // The idempotency contract: the pair decides, statelessly.
  assert.equal(identity.childSessionIdFor('root-1', 'inst-a'), identity.childSessionIdFor('root-1', 'inst-a'))
  assert.notEqual(identity.childSessionIdFor('root-1', 'inst-a'), identity.childSessionIdFor('root-2', 'inst-a'))
  assert.match(identity.childSessionIdFor('root-1', 'inst-a'), /^session-team-child-[0-9a-f]{32}$/u)
  // Ownership: the root owns itself; a member belongs to the root whose rows carry it; unowned is undefined.
  assert.equal(identity.teamRootOfSession('root-1'), 'root-1')
  assert.equal(identity.teamRootOfSession('session-a'), 'root-1')
  assert.equal(identity.teamRootOfSession('nobody'), undefined)
  assert.equal(identity.instanceIdForSession('root-1'), 'inst-leader')
  assert.equal(identity.instanceIdForSession('session-a'), 'inst-a')
  assert.throws(() => identity.instanceIdForSession('session-z'), /no team instance/u)
  // The durable lifecycle gate: only a terminal row is refused, with the frozen code for its state,
  // and the ROOT is never refused (it has no MemberInstance row and archive never addresses it).
  assert.equal(identity.memberResumeRefusal('session-a', 'root-1'), null)
  assert.equal(identity.memberResumeRefusal('root-1', 'root-1'), null)
  assert.equal(identity.memberResumeRefusal('session-b', 'root-1').code, 'PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED')
  assert.equal(identity.memberResumeRefusal('session-c', 'root-1').code, 'PERMISSION_LIFECYCLE_EXECUTION_TERMINAL')
  // The admission close: closing is per durable child (never per request claim), refuses with its own
  // code, and reopening records the boot-publish marker for a terminal row.
  assert.equal(identity.closeAdmission({ rootSessionId: 'root-1', instanceId: 'inst-b' }), true)
  assert.equal(identity.admissionCloseRefusal('session-b').code, 'LIFECYCLE_ADMISSION_CLOSED')
  assert.equal(identity.admissionCloseRefusal('session-a'), null)
  assert.equal(identity.reopenAdmission({ rootSessionId: 'root-1', instanceId: 'inst-b' }), true)
  assert.equal(identity.admissionCloseRefusal('session-b'), null)
  assert.equal(identity.terminalMarkerOf('session-b'), 'ARCHIVED', 'a reopened ARCHIVED member leaves the boot-publish marker')
  assert.equal(identity.reopenAdmission({ rootSessionId: 'root-1', instanceId: 'inst-a' }), false)
  assert.equal(identity.terminalMarkerOf('session-a'), undefined, 'a non-terminal reopen clears the marker')
  identity.closeAdmission({ rootSessionId: 'root-1', instanceId: 'inst-a' })
  identity.reopenAdmission({ rootSessionId: 'root-1', instanceId: 'inst-a' })
  assert.equal(identity.terminalMarkerOf('session-a'), undefined)
  identity.clearTerminalMarker('session-b')
  assert.equal(identity.terminalMarkerOf('session-b'), undefined)
  assert.equal(identity.closeAdmission({ rootSessionId: 'root-1', instanceId: 'inst-zzz' }), false, 'no durable row means nothing to close')
  // Durable existence FAILS CLOSED: a missing seam is a typed refusal, and a backend fault is NOT
  // flattened into "not durable".
  const noSeam = createSessionIdentity({ domain, bootRootSessionId: 'root-1' })
  await assert.rejects(() => noSeam.durableSessionExists('session-a'), /sessionPersistence\.exists/u)
  const faulty = createSessionIdentity({ domain, bootRootSessionId: 'root-1', sessionPersistence: { exists: async () => { throw new Error('backend down') } } })
  await assert.rejects(() => faulty.durableSessionExists('session-a'), /backend down/u)
  const good = createSessionIdentity({ domain, bootRootSessionId: 'root-1', sessionPersistence: { exists: async (id) => id === 'session-a' } })
  assert.equal(await good.durableSessionExists('session-a'), true)
  assert.equal(await good.durableSessionExists('session-zzz'), false)
  // A domain that cannot answer is refused at construction, not later.
  assert.throws(() => createSessionIdentity({ domain: {}, bootRootSessionId: 'r' }), /memberInstances\.list/u)
})

test('ADM-37 — a refusal is recorded as REFUSED, and the recheck can actually refuse', async () => {
  // Three defects the adversarial review found in the PRODUCT composition, one arm because they are one
  // story: a decision that was overruled, a settlement that kept the overruled version, and a recheck
  // whose second question was the same frozen answer as the first.
  const { installMemberCentre, bindingFromCompiledMember } = await import('../src/plugin/vnext/centre-install.mjs')
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')

  const member = {
    identity: { instanceId: 'inst-1', instanceGeneration: 1, blueprintRevision: 'rev-1' },
    templateId: 'worker',
    policy: { read: lane(['/a']), write: lane(['/a']), network: 'deny', revision: 'gen-1' },
  }
  const bindWith = (over = {}) => bindingFromCompiledMember({
    member: { ...member, ...over, policy: { ...member.policy, ...(over.policy ?? {}) } },
    agentId: 'session-1', sessionId: 'session-1', workspaceRoot: '/a', owner: 'root-1',
  })
  // A host double that runs the waterfall the way the real one does: pre-execute, then one guard pass,
  // then one result.
  const makeHost = () => {
    const host = {
      pre: [], result: [], guards: [],
      on (event, handler) {
        if (event === 'tools/pre-execute') host.pre.push(handler)
        else if (event === 'tools/result') host.result.push(handler)
        return () => {
          host.pre = host.pre.filter((h) => h !== handler)
          host.result = host.result.filter((h) => h !== handler)
        }
      },
      guard (fn) { host.guards.push(fn); return () => { host.guards = host.guards.filter((g) => g !== fn) } },
      get: (name) => (name === 'tools' ? { guard: (fn) => host.guard(fn) } : undefined),
      async dispatch (exec) {
        const decision = { kind: 'allow' }
        let verdict = decision
        for (const handler of host.pre) verdict = await handler(exec, async () => verdict)
        if (verdict.kind !== 'allow') {
          for (const handler of host.result) handler(exec, { isError: true, error: { message: verdict.reason } })
          return verdict
        }
        for (const guard of host.guards) {
          const reason = guard(exec)
          if (reason !== undefined) {
            for (const handler of host.result) handler(exec, { isError: true, error: { message: reason } })
            return { kind: 'deny', reason }
          }
        }
        for (const handler of host.result) handler(exec, { isError: false })
        return { kind: 'allow' }
      },
    }
    return host
  }
  const identityOf = (exec) => ({ executionId: `exec-${exec.callId}`, actorId: 'inst-1', worldId: 'session-1' })

  // (1) ASK with no grants is a REFUSAL - and the settlement must say REFUSED, not `allow` with
  // decisionKind `ask` left open to recover as UNKNOWN. The port used to settle the lane's raw answer
  // before turning it into the refusal it enforced.
  const store1 = createExecutionSettlementStore({ dir: mkdtempSync(join(tmpdir(), 'centre-37a-')) })
  const host1 = makeHost()
  const admissions = []
  const askBinding = bindWith({ policy: { read: lane(['/a'], ['/a/secret']) } })
  const askCenter = installMemberCentre({
    ctx: host1, binding: askBinding, resolveBinding: () => askBinding,
    recordAdmission: (fact) => admissions.push(fact), recordExecution: () => {}, store: store1, identityOf,
  })
  const askDecision = await host1.dispatch({ callId: 'call-ask', name: 'read', arguments: { file_path: '/a/secret/keys.txt' } })
  assert.equal(askDecision.kind, 'deny')
  assert.match(askDecision.reason, /ADMISSION_ASK_UNWIRED/u)
  assert.equal(store1.read('exec-call-ask').state, 'REFUSED', 'a refused call must be terminal REFUSED')
  const askFact = admissions.find((fact) => fact.callId === 'call-ask')
  assert.equal(askFact.decision, 'deny', 'the authority fact records the refusal, not the raw ask')
  assert.equal(askFact.refusalCode, 'ADMISSION_ASK_UNWIRED')
  askCenter.dispose()

  // (2) THE RECHECK. The live answer is narrowed between the two consultations - exactly "the lane was
  // narrowed" - and the guard must refuse. With a constant binding this arm could not fail.
  const store2 = createExecutionSettlementStore({ dir: mkdtempSync(join(tmpdir(), 'centre-37b-')) })
  const host2 = makeHost()
  const wide = bindWith()
  const narrowed = bindWith({ policy: { read: lane(['/b']), revision: 'gen-2' } })
  let phase = 'pre'
  const recheckFaults = []
  const recheckFacts = []
  const recheckCenter = installMemberCentre({
    ctx: host2, binding: wide,
    resolveBinding: () => (phase === 'pre' ? wide : narrowed),
    recordAdmission: () => {}, recordExecution: (fact) => recheckFacts.push(fact), store: store2, identityOf,
    onFault: (error, context) => recheckFaults.push([error, context]),
  })
  const guard = host2.guards[0]
  host2.guards[0] = (exec) => { phase = 'guard'; return guard(exec) }
  const recheckDecision = await host2.dispatch({ callId: 'call-read', name: 'read', arguments: { file_path: '/a/x' } })
  assert.equal(recheckDecision.kind, 'deny', 'a lane narrowed between the two consultations must refuse')
  assert.match(recheckDecision.reason, /ADMISSION_RECHECK/u)
  // The case the OLD contract could not express is now the owner-approved Option A: the recheck writes a
  // SECOND durable deny decision (same executionId, its OWN generation) beside the untouched allow, and
  // the settlement terminates REFUSED/not-started citing THAT decision. No gap is reported: the refusal
  // is evidenced by a durable decision, not by a fabricated state.
  const rechecked = store2.read('exec-call-read')
  assert.equal(rechecked.state, 'REFUSED', 'the recheck refusal is terminal REFUSED, not ADMITTED')
  assert.equal(rechecked.observation.dispatch, 'not-started')
  assert.equal(rechecked.observation.bodyOutcome, 'not-started')
  assert.equal(rechecked.admission.decision, 'allow', 'the ORIGINAL allow is preserved, never rewritten')
  assert.equal(rechecked.terminalDecision.decisionId, 'admission-recheck:call-read')
  assert.equal(rechecked.terminalDecision.decision, 'deny')
  assert.equal(rechecked.terminalDecision.reasonCode, 'ADMISSION_RECHECK_LANE_DENY')
  assert.equal(rechecked.terminalDecision.policyGeneration, 'gen-2', 'the deny names the generation that refused')
  assert.equal(recheckFaults.some(([error]) => error?.code === 'SETTLEMENT_CONTRACT_GAP'), false, 'a durable deny means no gap')
  assert.match(recheckFacts.find((fact) => fact.callId === 'call-read').refusalCode, /ADMISSION_RECHECK/u)

  // (3) IDEMPOTENT DISPOSE: `disposers.reverse()` mutates in place, so a second dispose would re-run the
  // whole teardown in the opposite order.
  let disposals = 0
  const countingHost = makeHost()
  const originalOn = countingHost.on
  countingHost.on = (event, handler) => {
    const dispose = originalOn(event, handler)
    return () => { disposals += 1; dispose() }
  }
  const store3 = createExecutionSettlementStore({ dir: mkdtempSync(join(tmpdir(), 'centre-37c-')) })
  const idempotent = installMemberCentre({
    ctx: countingHost, binding: wide, resolveBinding: () => wide,
    recordAdmission: () => {}, recordExecution: () => {}, store: store3, identityOf,
  })
  idempotent.dispose()
  const afterFirst = disposals
  idempotent.dispose()
  assert.equal(disposals, afterFirst, 'a second dispose must be a no-op, not a re-run')
  recheckCenter.dispose()
})

test('ADM-38 — a fault while reading or writing the record is a REFUSAL, and a second dispatch is a replay', async () => {
  // A truncated ledger line or a settlement conflict must not escape from a pre-execute listener: what
  // the host does with a thrown listener is unmeasured, and a decision nobody can record is not one this
  // centre will run under. Both become explicit denies with the fault's own code.
  const { installMemberCentre, bindingFromCompiledMember } = await import('../src/plugin/vnext/centre-install.mjs')
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const member = {
    identity: { instanceId: 'inst-1', instanceGeneration: 1, blueprintRevision: 'rev-1' },
    templateId: 'worker',
    policy: { read: lane(['/a']), write: lane(['/a']), network: 'deny', revision: 'gen-1' },
  }
  const binding = bindingFromCompiledMember({ member, agentId: 'session-1', sessionId: 'session-1', workspaceRoot: '/a', owner: 'root-1' })
  const makeHost = () => {
    const host = {
      pre: [], result: [], guards: [],
      on (event, handler) {
        if (event === 'tools/pre-execute') host.pre.push(handler)
        else if (event === 'tools/result') host.result.push(handler)
        return () => {}
      },
      guard (fn) { host.guards.push(fn); return () => {} },
      get: (name) => (name === 'tools' ? { guard: (fn) => host.guard(fn) } : undefined),
      async dispatch (exec) {
        let verdict = { kind: 'allow' }
        for (const handler of host.pre) verdict = await handler(exec, async () => verdict)
        if (verdict.kind !== 'allow') return verdict
        for (const guard of host.guards) {
          const reason = guard(exec)
          if (reason !== undefined) return { kind: 'deny', reason }
        }
        for (const handler of host.result) handler(exec, { isError: false })
        return { kind: 'allow' }
      },
    }
    return host
  }
  const identityOf = (exec) => ({ executionId: `exec-${exec.callId}`, actorId: 'inst-1', worldId: 'session-1' })
  const store = createExecutionSettlementStore({ dir: mkdtempSync(join(tmpdir(), 'centre-38-')) })
  // (1) the ledger cannot be read
  const host1 = makeHost()
  const faults = []
  const centre1 = installMemberCentre({
    ctx: host1, binding, resolveBinding: () => binding,
    recordAdmission: () => {}, recordExecution: () => {}, store, identityOf,
    isReplay: () => { throw new Error('LEDGER_TRUNCATED: the last line is not valid JSON') },
    onFault: (error, context) => faults.push([error, context]),
  })
  const unreadable = await host1.dispatch({ callId: 'c-unreadable', name: 'read', arguments: { file_path: '/a/x' } })
  assert.equal(unreadable.kind, 'deny')
  assert.match(unreadable.reason, /ADMISSION_LEDGER_UNREADABLE/u)
  assert.match(unreadable.reason, /LEDGER_TRUNCATED/u, 'the fault text survives into the refusal')
  assert.equal(faults.at(-1)[1].phase, 'replay-check')
  centre1.dispose()
  // (2) the ledger cannot be written
  const host2 = makeHost()
  const centre2 = installMemberCentre({
    ctx: host2, binding, resolveBinding: () => binding,
    recordAdmission: () => { throw new Error('disk full') }, recordExecution: () => {}, store, identityOf,
    onFault: (error, context) => faults.push([error, context]),
  })
  const unwritable = await host2.dispatch({ callId: 'c-unwritable', name: 'read', arguments: { file_path: '/a/x' } })
  assert.equal(unwritable.kind, 'deny')
  assert.match(unwritable.reason, /ADMISSION_LEDGER_UNWRITABLE/u)
  centre2.dispose()
  // (3) the settlement cannot be opened
  const host3 = makeHost()
  const centre3 = installMemberCentre({
    ctx: host3, binding, resolveBinding: () => binding,
    recordAdmission: () => {}, recordExecution: () => {},
    store: { ...store, recordAdmission: () => { throw new Error('SETTLEMENT_CONFLICT') } },
    identityOf,
    onFault: (error, context) => faults.push([error, context]),
  })
  const unsettleable = await host3.dispatch({ callId: 'c-settlement', name: 'read', arguments: { file_path: '/a/x' } })
  assert.equal(unsettleable.kind, 'deny')
  assert.match(unsettleable.reason, /ADMISSION_SETTLEMENT_FAULT/u)
  centre3.dispose()
  // (4) THE MEMO SERVES ONE DISPATCH. Same callId, a different execution object, before any tools/result:
  // that is a replay, and it must meet the ledger rather than inherit the first verdict.
  const host4 = makeHost()
  const centre4 = installMemberCentre({
    ctx: host4, binding, resolveBinding: () => binding,
    recordAdmission: () => {}, recordExecution: () => {}, store, identityOf,
  })
  const first = host4.pre[0]
  const verdictOne = await first({ callId: 'c-dup', name: 'read', arguments: { file_path: '/a/x' } }, async () => ({ kind: 'allow' }))
  assert.equal(verdictOne.kind, 'allow')
  const verdictTwo = await first({ callId: 'c-dup', name: 'read', arguments: { file_path: '/a/x' } }, async () => ({ kind: 'allow' }))
  assert.equal(verdictTwo.kind, 'deny', 'a second dispatch of the same callId is a replay, not a memo hit')
  assert.match(verdictTwo.reason, /ADMISSION_REPLAY/u)
  // The SAME execution object consulting again (the host's second consultation) still reads the memo.
  const sameExec = { callId: 'c-dup2', name: 'read', arguments: { file_path: '/a/x' } }
  const ok = await first(sameExec, async () => ({ kind: 'allow' }))
  assert.equal(ok.kind, 'allow')
  const again = await first(sameExec, async () => ({ kind: 'allow' }))
  assert.equal(again.kind, 'allow', 'the same execution may be consulted twice')
  centre4.dispose()
})

test('ADM-39 — a compiled answer that omits an axis does not inherit the ceiling', () => {
  // The review's sharpest P2: `perTool?.read ?? binding.read` meant "the compiler said nothing about this
  // tool's read axis, so use the widest one". That reads an absence as a permission. Three controls,
  // because the fix must not swallow the documented fallback either.
  const ceiling = { mode: 'restricted', allow: ['/work'], ask: [], deny: [] }
  const narrow = { mode: 'restricted', allow: ['/work/only'], ask: [], deny: [] }
  // (1) POSITIVE: a tool WITH a compiled answer covering the axis is judged by THAT lane, not the ceiling.
  // perTool is keyed by the BARE tool name, so a `write` call consults perTool.write.
  const withLane = binding({ perTool: { write: { read: ceiling, write: narrow } } })
  assert.equal(call('write', { file_path: '/work/other.txt' }, withLane).kind, 'deny', 'the tool lane is narrower than the ceiling')
  assert.equal(call('write', { file_path: '/work/only/x.txt' }, withLane).kind, 'allow')
  // (2) NEGATIVE CONTROL: the same tool, same call, with the axis MISSING from its compiled answer. The
  // ceiling would allow /work/other.txt; the centre must refuse instead of quietly widening.
  const partial = binding({ perTool: { write: { read: ceiling } } })
  const partialDecision = call('write', { file_path: '/work/other.txt' }, partial)
  assert.equal(partialDecision.kind, 'deny', 'a gap in the compiled answer is not an inheritance of the ceiling')
  assert.equal(partialDecision.code, 'ADMISSION_AXIS_UNSUPPORTED')
  assert.match(partialDecision.reason, /does not cover this axis/u)
  // (3) The DOCUMENTED fallback survives: a tool with NO compiled entry at all is answered by the ceiling.
  const ceilingOnly = binding({ perTool: { write: { read: ceiling, write: narrow } } })
  assert.equal(call('read', { file_path: '/work/a/f.txt' }, ceilingOnly).kind, 'allow', 'an uncompiled tool is the ceiling case')
  assert.equal(call('read', { file_path: '/elsewhere/f.txt' }, ceilingOnly).kind, 'deny', 'and the ceiling still refuses outside it')
})

test('ADM-40 — a binding names its generation or refuses to exist, and never invents a definition source', async () => {
  const { bindingFromCompiledMember } = await import('../src/plugin/vnext/centre-install.mjs')
  const member = {
    identity: { instanceId: 'i', instanceGeneration: 4, blueprintRevision: 'r' },
    templateId: 'worker',
    policy: { read: lane(['/a']), write: lane(['/a']), network: 'deny', revision: 'gen-4' },
  }
  const built = bindingFromCompiledMember({ member, agentId: 's', sessionId: 's', workspaceRoot: '/a', owner: 'root' })
  assert.equal(built.instanceGeneration, 4)
  // The generation is what the recheck compares a live answer against; a default of 0 would make every
  // revocation look like a match.
  const noGeneration = { ...member, identity: { instanceId: 'i', blueprintRevision: 'r' }, policy: { ...member.policy } }
  assert.throws(
    () => bindingFromCompiledMember({ member: noGeneration, agentId: 's', sessionId: 's', workspaceRoot: '/a', owner: 'root' }),
    /no instance generation/u,
  )
  // No hardcoded `@deepseek-ai/dsh-tool-fs` for every tool: the member names its source when it has one,
  // and '' means "several sources" rather than a guess that a reviewer would trust.
  assert.equal(built.definitionSource, '')
  const named = bindingFromCompiledMember({
    member: { ...member, definitionSource: '@deepseek-ai/dsh-tool-fs' },
    agentId: 's', sessionId: 's', workspaceRoot: '/a', owner: 'root',
  })
  assert.equal(named.definitionSource, '@deepseek-ai/dsh-tool-fs')
  // And the compiled per-tool answer is the intersection: a narrowing entry survives verbatim.
  const withBindings = bindingFromCompiledMember({
    member,
    bindings: [{ toolName: 'write', effective: { read: lane(['/a']), write: lane(['/a/sub']), network: { access: 'deny' } } }],
    agentId: 's', sessionId: 's', workspaceRoot: '/a', owner: 'root',
  })
  // perTool[<toolName>] = {read, write, network}: the tool named `write` carries both lanes.
  assert.deepEqual(withBindings.perTool.write.write.allow, ['/a/sub'])
  assert.equal(withBindings.perTool.write.network, 'deny')
})

test('ADM-41 — the ledger owns its reserved fields, and one call ends once', async () => {
  const { openFactLedger, LEDGER_KINDS } = await import('../src/plugin/vnext/fact-ledger.mjs')
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  // ONE exported list of kinds. It used to name a `playback-refusal` the writer never emits and omit
  // `execution` entirely, so anything validating against the public list rejected the ledger's own
  // execution records.
  assert.ok(LEDGER_KINDS.includes('execution'))
  assert.ok(LEDGER_KINDS.includes('replay-refusal'))
  assert.ok(!LEDGER_KINDS.includes('playback-refusal'), 'a kind the writer never emits is not a ledger kind')
  const path = join(mkdtempSync(join(tmpdir(), 'ledger-41-')), 'l.jsonl')
  const ledger = openFactLedger({ path, now: () => '2026-11-22T00:00:00.000Z' })
  // A caller cannot rename the record kind through the facts it passes: `kind` is the ledger's.
  const written = ledger.recordAdmission({ callId: 'c-1', toolName: 'read', kind: 'execution', at: '1999-01-01T00:00:00.000Z', decision: 'allow' })
  assert.equal(written.kind, 'invocation-authority', 'the method decides the kind, not the caller')
  assert.equal(written.at, '2026-11-22T00:00:00.000Z', 'the ledger stamps the time')
  // ONE execution fact per call: a second one would make "how did this call end" a question with two
  // answers on the same durable record.
  ledger.recordExecution({ callId: 'c-1', outcome: 'completed' })
  assert.throws(() => ledger.recordExecution({ callId: 'c-1', outcome: 'failed' }), /LEDGER_DUPLICATE_EXECUTION|already has an execution/u)
  // And the same rule holds when the duplicate is already ON DISK (a crash between two writers): the
  // file is refused as corrupt rather than read as two answers.
  const corrupt = join(mkdtempSync(join(tmpdir(), 'ledger-41b-')), 'l.jsonl')
  const { writeFileSync } = await import('node:fs')
  writeFileSync(corrupt, [
    JSON.stringify({ kind: 'invocation-authority', callId: 'c-9', at: '2026-11-22T00:00:00.000Z' }),
    JSON.stringify({ kind: 'execution', callId: 'c-9', outcome: 'completed', at: '2026-11-22T00:00:01.000Z' }),
    JSON.stringify({ kind: 'execution', callId: 'c-9', outcome: 'failed', at: '2026-11-22T00:00:02.000Z' }),
    '',
  ].join('\n'))
  const reader = openFactLedger({ path: corrupt })
  assert.throws(() => reader.readAll(), (error) => error.code === 'LEDGER_DUPLICATE_EXECUTION')
})

test('ADM-42 — a native module specifier is judged before it is imported', async () => {
  // `await import()` runs the code it names. A validation that inspects the module afterwards has
  // already executed the thing it exists to refuse, so the check is a decision about the string.
  const { assertHostModuleSpecifier } = await import('../src/plugin/vnext/member-execution.mjs')
  assert.equal(assertHostModuleSpecifier('@deepseek-ai/dsh-tool-fs'), '@deepseek-ai/dsh-tool-fs')
  for (const bad of ['/etc/passwd.mjs', 'file:///tmp/x.mjs', 'node:fs', 'https://example.com/x.mjs', '', undefined]) {
    assert.throws(() => assertHostModuleSpecifier(bad), /needs a specifier|refusing to import/u, `must refuse ${JSON.stringify(bad)}`)
  }
})

test('ADM-43 — the record names the MEMBER and the session, not one value in both fields', async () => {
  // `agentId` carried the session id in the product wiring, so a record could not answer "which member"
  // after the session was gone - and a fact that puts the host's identity where the member's belongs
  // cannot be joined to a member registry. Two fields, both recorded.
  const { bindingFromCompiledMember } = await import('../src/plugin/vnext/centre-install.mjs')
  const member = {
    identity: { instanceId: 'member-7', instanceGeneration: 3, blueprintRevision: 'r' },
    templateId: 'worker',
    policy: { read: lane(['/a']), write: lane(['/a']), network: 'deny', revision: 'gen-3' },
  }
  const built = bindingFromCompiledMember({ member, agentId: 'member-7', sessionId: 'session-9', workspaceRoot: '/a', owner: 'root' })
  assert.equal(built.instanceId, 'member-7', 'the member identity comes from the compiled identity')
  assert.equal(built.sessionId, 'session-9')
  const facts = invocationFactsOf({
    binding: built,
    toolName: 'read',
    callId: 'c-1',
    arguments: { file_path: '/a/x' },
    admission: { kind: 'allow' },
  })
  assert.equal(facts.instanceId, 'member-7')
  assert.equal(facts.sessionId, 'session-9')
  assert.equal(facts.agentId, 'member-7', 'the agent field names the member, not the session')
  // A binding with no member (a diagnostic context) omits the field rather than inventing one.
  const bare = invocationFactsOf({
    binding: { ...built, instanceId: undefined },
    toolName: 'read',
    callId: 'c-2',
    arguments: { file_path: '/a/x' },
    admission: { kind: 'allow' },
  })
  assert.equal('instanceId' in bare, false, 'no member, no member field')
})

test('ADM-44 — a row that asked for the centre cannot run unmediated', async () => {
  // A governed member whose realm never mounted used to run its native tools with NO admission decision,
  // no durable fact and no settlement — unmediated and unreported. The rule is deliberately narrow: it
  // fires only when the row ASKED for the centre, so it cannot convert a wiring gap into an outage.
  const { memberCentreUnwiredViolation } = await import('../src/plugin/vnext/centre-config.ts')
  const asked = { centreStatePath: '/tmp/centre' }
  // (1) asked + no realm ⇒ refused, with the member named and the reason spelled out.
  const refused = memberCentreUnwiredViolation(asked, { instanceId: 'inst-9', mountedRealm: false })
  assert.match(String(refused), /MEMBER_CENTRE_UNWIRED/u)
  assert.match(String(refused), /no admission decision/u)
  assert.match(String(refused), /inst-9/u)
  // (2) NEGATIVE CONTROL: the same member WITH a realm is fine.
  assert.equal(memberCentreUnwiredViolation(asked, { instanceId: 'inst-9', mountedRealm: true }), undefined)
  // (3) NEGATIVE CONTROL: a row that never configured the centre keeps its behaviour — no new outage.
  assert.equal(memberCentreUnwiredViolation({}, { instanceId: 'inst-9', mountedRealm: false }), undefined)
  assert.equal(memberCentreUnwiredViolation(undefined, { instanceId: 'inst-9', mountedRealm: false }), undefined)
  // A non-string centreStatePath is the config rule's business (R1), not this one's.
  assert.equal(memberCentreUnwiredViolation({ centreStatePath: 7 }, { instanceId: 'inst-9', mountedRealm: false }), undefined)
})

test('ADM-45 — the durable overlay can only REMOVE authority, and a fault is a refusal (E3 plumbing)', async () => {
  // The retired entry enforced the Alpha.4 durable plane through a pre-execute adapter that the A1 cut
  // retired WITH the execution route, so a grantInstance deny persisted after the member was bound had no
  // decision-side effect at all (E3). The centre stays the ONE decision point: the overlay is a
  // RESTRICTION consulted beside the lane verdict. These three properties are what make that safe.
  const host = fakeHost()
  const admitted = []
  const binding = bindingFromCompiledMember({ member: compiledMember(), agentId: 'agent-1', sessionId: 'session-1', workspaceRoot: '/work/a' })
  const calls = []
  const centre = installMemberCentre({
    ctx: host.ctx,
    binding,
    recordAdmission: (fact) => admitted.push(fact),
    recordExecution: () => {},
    // Positive control: a lane ALLOW meets an overlay DENY and the call is refused, naming the overlay.
    overlayDecision: (facts) => {
      calls.push(facts)
      if (facts.arguments?.file_path === '/work/a/secret.txt') return 'deny'
      if (facts.arguments?.file_path === '/work/a/boom.txt') throw new Error('overlay store unreadable')
      return undefined
    },
  })
  try {
    // (1) POSITIVE: the lane allows a read inside the lane; the overlay denies it. The overlay wins.
    const denied = { name: 'read', callId: 'ov-1', arguments: { file_path: '/work/a/secret.txt' }, agent: { id: 'agent-1' }, turn: 1, step: 1 }
    const verdict = await host.preExecute(denied)
    assert.equal(verdict.kind, 'deny')
    assert.equal(admitted[0].refusalCode, 'ADMISSION_OVERLAY_DENY')
    assert.equal(admitted[0].laneDecision, 'allow', 'the lane really did allow it — the overlay is what refused')
    // (2) NEGATIVE CONTROL: no overlay opinion ⇒ the lane verdict stands, untouched.
    const allowed = { name: 'read', callId: 'ov-2', arguments: { file_path: '/work/a/doc.txt' }, agent: { id: 'agent-1' }, turn: 1, step: 1 }
    assert.equal((await host.preExecute(allowed)).kind, 'allow')
    assert.equal(host.guard(allowed), undefined)
    // (3) NEGATIVE CONTROL: a lane DENY never asks the overlay — it can only REMOVE authority, so there is
    // nothing to remove and the overlay must not be able to launder a deny into an allow.
    const outside = { name: 'read', callId: 'ov-3', arguments: { file_path: '/etc/passwd' }, agent: { id: 'agent-1' }, turn: 1, step: 1 }
    assert.equal((await host.preExecute(outside)).kind, 'deny')
    const asked = calls.map((c) => c.arguments?.file_path)
    assert.ok(!asked.includes('/etc/passwd'), `the overlay was consulted about a lane-denied call: ${JSON.stringify(asked)}`)
    // (4) FAULT IS A REFUSAL: a throwing overlay is not "no opinion".
    const boom = { name: 'read', callId: 'ov-4', arguments: { file_path: '/work/a/boom.txt' }, agent: { id: 'agent-1' }, turn: 1, step: 1 }
    assert.equal((await host.preExecute(boom)).kind, 'deny')
    assert.equal(admitted.at(-1).refusalCode, 'ADMISSION_OVERLAY_FAULT')
  } finally {
    centre.dispose()
  }
})

// =============================================================== THE ASK PATH (B stage)
//
// An `ask` is only a decision if somebody RECORDS it. The centre turns it into a durable Control
// request, waits for the durable decision through the ONE existing bridge
// (`ControlService.awaitControlDecision`), and only then mints the one-shot grant the guard spends
// immediately before the body. Every failure mode is its own refusal code, recorded as the decision
// that was ENFORCED - an ask is never an allow and never a prompt nobody can answer.

const { createControlApprovalPort } = await import('../src/plugin/vnext/admission-port.mjs')

/** A durable-approval stand-in that answers with ONE fixed verdict and counts its consultations. */
const approvalsAnswer = (answer) => {
  const asked = []
  return {
    asked,
    port: {
      async request (input) {
        asked.push(input)
        if (answer instanceof Error) throw answer
        return typeof answer === 'function' ? answer(input) : answer
      },
    },
  }
}

test('ADM-46 — an ask is WIRED only when BOTH halves exist: a grant binder AND a recorded approval', async () => {
  const askHost = async (over) => {
    const host = fakeHost()
    const facts = []
    installAdmissionPoint({
      ctx: host.ctx,
      resolveBinding: () => askBinding(),
      record: (fact) => facts.push(fact),
      ...over,
    })
    const exec = { name: 'read', callId: `wired-${Math.random().toString(16).slice(2)}`, arguments: { file_path: '/work/ask/doc.txt' } }
    return { verdict: await host.preExecute(exec), facts, host, exec }
  }
  const binder = () => createInvocationBinder()
  const memberOf = (b) => ({ teamId: 'team-1', memberInstanceId: b.agentId, templateId: 'tmpl', instanceGeneration: b.instanceGeneration })

  // (1) NEGATIVE CONTROL: no grant binder at all — nobody could spend an approval.
  const noGrants = await askHost({ approvals: approvalsAnswer({ ok: true, approval: { approvalId: 'a' } }).port })
  assert.equal(noGrants.verdict.kind, 'deny')
  assert.match(String(noGrants.verdict.reason), /ADMISSION_ASK_UNWIRED/u)
  assert.equal(noGrants.facts[0].refusalCode, 'ADMISSION_ASK_UNWIRED')

  // (2) HOST-NATIVE ASK (grants, no durable approval authority): the ask goes to the host as its own
  //     approval request, and the grant is spendable at the guard. This is the shape every world
  //     WITHOUT a Control plane runs, and the product supplies `approvals` wherever it has one.
  const hostNative = await askHost({ grants: { binder: binder(), memberOf } })
  assert.equal(hostNative.verdict.kind, 'ask')
  assert.equal(hostNative.facts[0].decision, 'ask')
  assert.equal(await hostNative.host.guard(hostNative.exec), undefined, 'the host-native grant is spent at the guard')

  // (3) POSITIVE: both halves, an approving authority → the call proceeds under a one-shot grant.
  const approvals = approvalsAnswer({ ok: true, approval: { approvalId: 'approval-46', policyRevision: 'gen-7' } })
  const both = await askHost({ grants: { binder: binder(), memberOf }, approvals: approvals.port })
  assert.equal(both.verdict.kind, 'allow')
  assert.equal(approvals.asked.length, 1, 'exactly one approval request per ask')
  assert.equal(approvals.asked[0].callId, approvals.asked[0].callId)
  assert.equal(both.facts[0].decision, 'allow')
  assert.equal(both.facts[0].laneDecision, 'ask', 'the lane asked; the record keeps that')
  assert.equal(await both.host.guard(both.exec), undefined, 'the grant is spendable exactly at the guard')
})

test('ADM-47 — a DENIED approval is its own refusal: no execution, a durable fact, settlement closed', async () => {
  const host = fakeHost()
  const facts = []
  const { store, writer } = await settlementWorld('approval-denied')
  const approvals = approvalsAnswer({ ok: false, code: 'ADMISSION_APPROVAL_DENIED', reason: 'the leader said no' })
  installAdmissionPoint({
    ctx: host.ctx,
    resolveBinding: () => askBinding(),
    record: (fact) => facts.push(fact),
    settlement: writer,
    grants: {
      binder: createInvocationBinder(),
      memberOf: (b) => ({ teamId: 'team-1', memberInstanceId: b.agentId, templateId: 'tmpl', instanceGeneration: b.instanceGeneration }),
    },
    approvals: approvals.port,
  })
  const exec = { name: 'read', callId: 'deny-1', arguments: { file_path: '/work/ask/doc.txt' } }
  const verdict = await host.preExecute(exec)
  assert.equal(verdict.kind, 'deny', 'a denied approval never becomes an allow')
  assert.match(String(verdict.reason), /ADMISSION_APPROVAL_DENIED/u)
  // THE DURABLE FACT names the refusal that was enforced, with the lane's answer kept.
  assert.equal(facts.length, 1)
  assert.equal(facts[0].decision, 'deny')
  assert.equal(facts[0].refusalCode, 'ADMISSION_APPROVAL_DENIED')
  assert.equal(facts[0].laneDecision, 'ask')
  // NO EXECUTION: the guard refuses too, and both consultations agree.
  assert.match(String(host.guard(exec)), /ADMISSION_APPROVAL_DENIED/u)
  assert.match(String(host.guard(exec)), /ADMISSION_APPROVAL_DENIED/u)
  // SETTLEMENT CLOSED: the store's own admission writer closed the refusal as REFUSED at birth.
  const executionId = dispatchExecutionId({ rootSessionId: 'session-1', agentInstanceId: 'agent-1' }, 'deny-1')
  assert.equal(store.read(executionId).state, 'REFUSED')
  assert.match(String(store.read(executionId).terminalReason ?? ''), /ADMISSION_APPROVAL_DENIED/u)
})

test('ADM-48 — an EXPIRED approval has its OWN code, distinct from a denial', async () => {
  const host = fakeHost()
  const facts = []
  installAdmissionPoint({
    ctx: host.ctx,
    resolveBinding: () => askBinding(),
    record: (fact) => facts.push(fact),
    grants: {
      binder: createInvocationBinder(),
      memberOf: (b) => ({ teamId: 'team-1', memberInstanceId: b.agentId, templateId: 'tmpl', instanceGeneration: b.instanceGeneration }),
    },
    approvals: approvalsAnswer({ ok: false, code: 'ADMISSION_APPROVAL_EXPIRED', reason: 'stale-denied' }).port,
  })
  const exec = { name: 'read', callId: 'expired-1', arguments: { file_path: '/work/ask/doc.txt' } }
  const verdict = await host.preExecute(exec)
  assert.equal(verdict.kind, 'deny')
  assert.match(String(verdict.reason), /ADMISSION_APPROVAL_EXPIRED/u)
  assert.notEqual(facts[0].refusalCode, 'ADMISSION_APPROVAL_DENIED', 'an expired approval is not a denial and must not be counted as one')
  assert.equal(facts[0].refusalCode, 'ADMISSION_APPROVAL_EXPIRED')
})

test('ADM-49 — a FAULTING approval authority is a refusal, and an unreadable answer is too', async () => {
  const run = async (approvals) => {
    const host = fakeHost()
    const facts = []
    installAdmissionPoint({
      ctx: host.ctx,
      resolveBinding: () => askBinding(),
      record: (fact) => facts.push(fact),
      grants: {
        binder: createInvocationBinder(),
        memberOf: (b) => ({ teamId: 'team-1', memberInstanceId: b.agentId, templateId: 'tmpl', instanceGeneration: b.instanceGeneration }),
      },
      approvals,
    })
    const exec = { name: 'read', callId: `fault-${Math.random().toString(16).slice(2)}`, arguments: { file_path: '/work/ask/doc.txt' } }
    return { verdict: await host.preExecute(exec), facts }
  }
  // (1) the authority throws.
  const thrown = await run(approvalsAnswer(new Error('control plane down')).port)
  assert.equal(thrown.verdict.kind, 'deny')
  assert.match(String(thrown.verdict.reason), /ADMISSION_APPROVAL_FAULT/u)
  assert.equal(thrown.facts[0].refusalCode, 'ADMISSION_APPROVAL_FAULT')
  // (2) NEGATIVE CONTROL: an answer with no verdict is NOT an allow.
  const empty = await run(approvalsAnswer(undefined).port)
  assert.equal(empty.verdict.kind, 'deny')
  assert.equal(empty.facts[0].refusalCode, 'ADMISSION_APPROVAL_FAULT')
})

test('ADM-50 — the REAL Control plane: ask → durable request → leader allow → one-shot spend', async () => {
  const { createP6T4World, createP6T4Service, destroyP6T1World, leaderCaller, P6T4_ROOT, P6T4_SEEDS } =
    await import('./p6t4-helpers.js')
  const world = await createP6T4World('vnext-ask-allow')
  const service = createP6T4Service(world)
  try {
    const host = fakeHost()
    const facts = []
    const worker = String(P6T4_SEEDS.worker.instanceId)
    const binding = {
      agentId: worker,
      instanceId: worker,
      sessionId: P6T4_SEEDS.worker.childSessionId,
      instanceGeneration: 2,
      templateId: 'worker',
      read: lane(['/work/a'], ['/work/ask']),
      write: lane(['/work/a']),
      workspaceRoot: '/work/a',
      policyGeneration: 'gen-7',
      owner: P6T4_ROOT,
    }
    // The REAL binder, with its consumption COUNTED: "exactly once" must be measured, not assumed.
    const binder = createInvocationBinder()
    let consumed = 0
    const countedBinder = {
      bind: (input) => binder.bind(input),
      consume: (capability, request) => {
        consumed += 1
        return binder.consume(capability, request)
      },
    }
    // The approval authority over the REAL durable Control plane; the leader resolves inside
    // `onRequested`, which runs AFTER the request row is durable and BEFORE the wait begins, so the
    // sequence is deterministic with no polling and no sleeps.
    const approvals = createControlApprovalPort({
      controlOf: () => service,
      onRequested: async (record) => {
        await service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: record.requestId,
          decision: 'allow',
        })
      },
    })
    installAdmissionPoint({
      ctx: host.ctx,
      resolveBinding: () => binding,
      record: (fact) => facts.push(fact),
      // The DURABLE replay authority, exactly as the product supplies it (the fact ledger): a second
      // dispatch carrying a judged callId is a replay, not a new approval.
      isReplay: (callId) => facts.some((fact) => fact.callId === callId),
      grants: {
        binder: countedBinder,
        memberOf: (b) => ({ teamId: b.owner, memberInstanceId: b.instanceId, templateId: b.templateId, instanceGeneration: b.instanceGeneration }),
      },
      approvals,
    })
    const exec = { name: 'read', callId: 'real-ask-1', arguments: { file_path: '/work/ask/doc.txt' } }
    const verdict = await host.preExecute(exec)
    assert.equal(verdict.kind, 'allow', `an approved ask proceeds (${JSON.stringify(verdict)})`)

    // (1) THE DURABLE REQUEST exists, with the shape this port raised: one inline leader-approval
    //     addressed to the member, correlated to the call.
    const state = await service.listControlState(P6T4_ROOT)
    assert.equal(state.requests.length, 1, 'exactly one durable control request for one ask')
    const request = state.requests[0]
    assert.equal(request.kind, 'leader-approval')
    assert.equal(request.executionCoupling, 'inline')
    assert.equal(request.correlation, 'admission:real-ask-1')
    assert.equal(request.targetInstanceId, worker)
    assert.equal(request.actionName, 'admission-ask')
    assert.equal(request.toolName, 'read')
    assert.equal(request.requester.instanceId, worker, 'the MEMBER asked for its own call')

    // (2) THE DURABLE DECISION exists and is the decision that authorized the call.
    assert.equal(state.decisions.length, 1)
    assert.equal(state.decisions[0].decision, 'allow')
    assert.equal(state.decisions[0].requestId, request.requestId)

    // (3) THE ONE-SHOT SPEND: the guard spends once, and the host's second consultation spends nothing.
    assert.equal(host.guard(exec), undefined)
    assert.equal(consumed, 1, 'the approval was spent exactly once')
    assert.equal(host.guard(exec), undefined)
    assert.equal(consumed, 1, 'the second guard consultation re-uses the memo; it does not spend again')
    host.result(exec)

    // (4) REPLAY: a second dispatch with the same callId meets the ledger.
    const replayed = await host.preExecute(exec)
    assert.equal(replayed.kind, 'deny')
    assert.match(String(replayed.reason), /ADMISSION_REPLAY/u)

    // (5) NEGATIVE CONTROL: the approval is durable for THIS call only — the same scope under a new
    //     callId is a new request, never a reuse of the old decision (a second request + a second
    //     decision must appear).
    const second = { name: 'read', callId: 'real-ask-2', arguments: { file_path: '/work/ask/doc.txt' } }
    assert.equal((await host.preExecute(second)).kind, 'allow')
    const after = await service.listControlState(P6T4_ROOT)
    assert.equal(after.requests.length, 2)
    assert.equal(after.decisions.length, 2)
  } finally {
    await destroyP6T1World(world)
  }
})

test('ADM-51 — the REAL Control plane: a leader DENY refuses the call and is durably recorded', async () => {
  const { createP6T4World, createP6T4Service, destroyP6T1World, leaderCaller, P6T4_ROOT, P6T4_SEEDS } =
    await import('./p6t4-helpers.js')
  const world = await createP6T4World('vnext-ask-deny')
  const service = createP6T4Service(world)
  try {
    const host = fakeHost()
    const facts = []
    const worker = String(P6T4_SEEDS.worker.instanceId)
    const binding = {
      agentId: worker,
      instanceId: worker,
      sessionId: P6T4_SEEDS.worker.childSessionId,
      instanceGeneration: 2,
      templateId: 'worker',
      read: lane(['/work/a'], ['/work/ask']),
      write: lane(['/work/a']),
      workspaceRoot: '/work/a',
      policyGeneration: 'gen-7',
      owner: P6T4_ROOT,
    }
    const approvals = createControlApprovalPort({
      controlOf: () => service,
      onRequested: async (record) => {
        await service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: record.requestId,
          decision: 'deny',
          note: 'not this file',
        })
      },
    })
    installAdmissionPoint({
      ctx: host.ctx,
      resolveBinding: () => binding,
      record: (fact) => facts.push(fact),
      grants: {
        binder: createInvocationBinder(),
        memberOf: (b) => ({ teamId: b.owner, memberInstanceId: b.instanceId, templateId: b.templateId, instanceGeneration: b.instanceGeneration }),
      },
      approvals,
    })
    const exec = { name: 'read', callId: 'real-deny-1', arguments: { file_path: '/work/ask/doc.txt' } }
    const verdict = await host.preExecute(exec)
    assert.equal(verdict.kind, 'deny')
    assert.match(String(verdict.reason), /ADMISSION_APPROVAL_DENIED/u)
    assert.equal(facts[0].refusalCode, 'ADMISSION_APPROVAL_DENIED')
    assert.equal(facts[0].laneDecision, 'ask')
    // The durable decision is a deny, and the guard cannot turn it into an execution.
    const state = await service.listControlState(P6T4_ROOT)
    assert.equal(state.decisions.length, 1)
    assert.equal(state.decisions[0].decision, 'deny')
    assert.match(String(host.guard(exec)), /ADMISSION_APPROVAL_DENIED/u)
  } finally {
    await destroyP6T1World(world)
  }
})

test('ADM-52 — the POST-APPROVAL RECHECK refuses when the policy generation moved after the approval', async () => {
  const host = fakeHost()
  const facts = []
  let current = binding({ ...askBinding(), policyGeneration: 'gen-7' })
  const approvals = approvalsAnswer({ ok: true, approval: { approvalId: 'approval-52', policyRevision: 'gen-7' } })
  installAdmissionPoint({
    ctx: host.ctx,
    resolveBinding: () => current,
    record: (fact) => facts.push(fact),
    grants: {
      binder: createInvocationBinder(),
      memberOf: (b) => ({ teamId: 'team-1', memberInstanceId: b.agentId, templateId: 'tmpl', instanceGeneration: b.instanceGeneration }),
    },
    approvals: approvals.port,
  })
  const exec = { name: 'read', callId: 'drift-1', arguments: { file_path: '/work/ask/doc.txt' } }
  assert.equal((await host.preExecute(exec)).kind, 'allow')
  // The SAME lane, but the policy was recompiled: the approval named gen-7, the world runs gen-8.
  current = { ...askBinding(), policyGeneration: 'gen-8' }
  const verdict = host.guard(exec)
  assert.equal(typeof verdict, 'string', 'a recompiled policy must not execute under the old approval')
  assert.match(verdict, /ADMISSION_GRANT_CAPABILITY_REVISION_MISMATCH/u)
  // NEGATIVE CONTROL: the SAME wiring with the generation UNCHANGED spends (nothing else is at fault).
  const host2 = fakeHost()
  let current2 = binding({ ...askBinding(), policyGeneration: 'gen-7' })
  installAdmissionPoint({
    ctx: host2.ctx,
    resolveBinding: () => current2,
    record: () => {},
    grants: {
      binder: createInvocationBinder(),
      memberOf: (b) => ({ teamId: 'team-1', memberInstanceId: b.agentId, templateId: 'tmpl', instanceGeneration: b.instanceGeneration }),
    },
    approvals: approvalsAnswer({ ok: true, approval: { approvalId: 'approval-52b', policyRevision: 'gen-7' } }).port,
  })
  const exec2 = { name: 'read', callId: 'drift-2', arguments: { file_path: '/work/ask/doc.txt' } }
  assert.equal((await host2.preExecute(exec2)).kind, 'allow')
  assert.equal(host2.guard(exec2), undefined, 'without the move the same wiring spends the approval')
  // ...and the LANE-narrowing recheck is a DIFFERENT refusal on the same approved call.
  const host3 = fakeHost()
  let current3 = binding({ ...askBinding(), policyGeneration: 'gen-7' })
  installAdmissionPoint({
    ctx: host3.ctx,
    resolveBinding: () => current3,
    record: () => {},
    grants: {
      binder: createInvocationBinder(),
      memberOf: (b) => ({ teamId: 'team-1', memberInstanceId: b.agentId, templateId: 'tmpl', instanceGeneration: b.instanceGeneration }),
    },
    approvals: approvalsAnswer({ ok: true, approval: { approvalId: 'approval-52c', policyRevision: 'gen-7' } }).port,
  })
  const exec3 = { name: 'read', callId: 'drift-3', arguments: { file_path: '/work/ask/doc.txt' } }
  assert.equal((await host3.preExecute(exec3)).kind, 'allow')
  current3 = binding({ read: lane(['/work/a']), policyGeneration: 'gen-7' })
  assert.match(String(host3.guard(exec3)), /ADMISSION_RECHECK_LANE_DENY/u)
})

test('ADM-53 — an incomplete member identity refuses BEFORE a reviewer is asked', async () => {
  const host = fakeHost()
  const facts = []
  const approvals = approvalsAnswer({ ok: true, approval: { approvalId: 'approval-53' } })
  installAdmissionPoint({
    ctx: host.ctx,
    resolveBinding: () => askBinding(),
    record: (fact) => facts.push(fact),
    grants: {
      binder: createInvocationBinder(),
      // No templateId: the trusted TeamDomain identity cannot be projected, and this assembly must not
      // invent the missing field.
      memberOf: () => undefined,
    },
    approvals: approvals.port,
  })
  const exec = { name: 'read', callId: 'unidentified-1', arguments: { file_path: '/work/ask/doc.txt' } }
  const verdict = await host.preExecute(exec)
  assert.equal(verdict.kind, 'deny')
  assert.match(String(verdict.reason), /ADMISSION_MEMBER_UNIDENTIFIED/u)
  assert.equal(approvals.asked.length, 0, 'a reviewer is never asked for an approval nobody could bind')
})

test('ADM-54 — the PRODUCT composition supplies the ask path: member-execution threads it, the glue wires it', async () => {
  // The admission port owning the ask path is not the same claim as the PRODUCT supplying it. The A1
  // cut's gap was exactly that difference: the port could spend a grant, and nothing ever handed it
  // one. These two arms pin the supply chain at its two hops that CAN be exercised without a boot.
  const { installMemberExecution } = await import('../src/plugin/vnext/member-execution.mjs')
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const compiledAnswer = {
    members: [{
      identity: { instanceId: 'member-1', instanceGeneration: 1 },
      policy: {
        ok: true,
        value: {
          memberIdentity: 'member-1',
          templateId: 'worker',
          instanceGeneration: 1,
          revision: 'rev-1',
          read: lane(['/work'], ['/work/ask']),
          write: lane(['/work']),
          network: { access: 'deny' },
        },
      },
    }],
  }
  const makeCtx = () => {
    const listeners = {}
    let guardFn
    const tools = { guard (fn) { guardFn = fn; return () => { guardFn = undefined } } }
    return {
      ctx: {
        get: (name) => (name === 'tools' ? tools : undefined),
        on: (event, fn) => { listeners[event] = fn; return () => {} },
      },
      preExecute: async (exec) => listeners['tools/pre-execute'](exec, async () => ({ kind: 'allow' })),
      guard: (exec) => guardFn(exec),
      result: (exec) => listeners['tools/result']?.(exec, {}),
    }
  }
  const install = async (over) => {
    const host = makeCtx()
    const state = mkdtempSync(`${tmpdir()}/vnext-supply-`)
    const disposers = []
    const installed = await installMemberExecution({
      agentCtx: host.ctx,
      realm: {},
      compiledAnswer,
      config: { centreStatePath: state },
      sessionId: 'session-1',
      instanceId: 'member-1',
      teamRoot: 'root-1',
      workspaceRoot: '/work',
      onDispose: (dispose) => { disposers.push(dispose) },
      onNativeDispose: () => {},
      observe: () => {},
      ...over,
    })
    return { host, installed, dispose: () => { for (const dispose of disposers.reverse()) dispose() } }
  }
  const grants = () => ({
    binder: createInvocationBinder(),
    memberOf: (b) => ({ teamId: b.owner, memberInstanceId: b.instanceId, templateId: b.templateId, instanceGeneration: b.instanceGeneration }),
  })

  // (1) NO SUPPLY: the composition installs a centre and every ask is still ADMISSION_ASK_UNWIRED. This
  //     is the state the B stage found the product in.
  const bare = await install({})
  const asked = { name: 'read', callId: 'supply-1', arguments: { file_path: '/work/ask/doc.txt' } }
  assert.equal((await bare.host.preExecute(asked)).kind, 'deny')
  assert.match(String((await bare.host.preExecute({ ...asked, callId: 'supply-1b' })).reason), /ADMISSION_ASK_UNWIRED/u)
  bare.dispose()

  // (2) SUPPLIED: the SAME composition, with the two ports threaded, makes the ask a real approval.
  const approvals = approvalsAnswer({ ok: true, approval: { approvalId: 'supply-approval', policyRevision: 'rev-1' } })
  const supplied = await install({ grants: grants(), approvals: approvals.port })
  const approved = { name: 'read', callId: 'supply-2', arguments: { file_path: '/work/ask/doc.txt' } }
  assert.equal((await supplied.host.preExecute(approved)).kind, 'allow')
  assert.equal(approvals.asked.length, 1)
  assert.equal(approvals.asked[0].binding.templateId, 'worker', 'the binding carries the template the trusted identity needs')
  assert.equal(supplied.host.guard(approved), undefined, 'and the grant it minted is spendable')
  supplied.dispose()

  // (3) THE GLUE HOP (source pin): the row assembly reads the shared Control ref and passes BOTH ports
  //     into the ONE centre composition. A boot would prove more, but it cannot be faked here - and a
  //     hop nobody pins is how the port came to be written and never supplied.
  const { readFileSync } = await import('node:fs')
  const glue = readFileSync(new URL('../src/plugin/vnext/agent-bindings.mjs', import.meta.url), 'utf8')
  assert.match(glue, /const \{ agents, sessionPersistence, domain, config, teamToolsRef, controlServiceRef,/u, 'the glue must read the Control ref the host fills')
  assert.match(glue, /createControlApprovalPort\(\{ controlOf: \(\) => controlServiceRef\.current \}\)/u, 'the approval authority is the durable Control service, read lazily')
  assert.match(glue, /\.\.\.\(grants === undefined \? \{\} : \{ grants \}\),\n\s*\.\.\.\(approvals === undefined \? \{\} : \{ approvals \}\),/u, 'both ports ride the ONE installMemberExecution call')
  assert.match(glue, /from '\.\.\/\.\.\/\.\.\/member-io-policy\/src\/invocation\.js'/u, 'the binder is the PRODUCT binder, not a local re-implementation')
})

test('ADM-55 — the wait bridge\'s own closed outcomes map to their own refusal codes', async () => {
  // The wait bridge is the EXISTING `ControlService.awaitControlDecision`; its typed settle values are
  // the port's inputs. Each one must become a DISTINCT refusal: an aborted wait and an abandoned
  // request are different facts an operator has to be able to tell apart, and neither is an allow.
  const run = async (controlOf) => {
    const host = fakeHost()
    const facts = []
    const approvals = createControlApprovalPort({ controlOf })
    installAdmissionPoint({
      ctx: host.ctx,
      resolveBinding: () => askBinding(),
      record: (fact) => facts.push(fact),
      grants: {
        binder: createInvocationBinder(),
        memberOf: (b) => ({ teamId: 'team-1', memberInstanceId: b.agentId, templateId: 'tmpl', instanceGeneration: b.instanceGeneration }),
      },
      approvals,
    })
    const exec = { name: 'read', callId: `wait-${Math.random().toString(16).slice(2)}`, arguments: { file_path: '/work/ask/doc.txt' } }
    return { verdict: await host.preExecute(exec), facts }
  }
  const serviceWith = (settle) => ({
    async requestControl () { return { requestId: 'ctrl-1' } },
    async awaitControlDecision () { return settle() },
  })

  // (1) the wait is aborted (the inline request is durably closed by the service).
  const aborted = await run(() => serviceWith(() => { const error = new Error('aborted'); error.code = 'CONTROL_WAIT_ABORTED'; throw error }))
  assert.equal(aborted.verdict.kind, 'deny')
  assert.equal(aborted.facts[0].refusalCode, 'ADMISSION_APPROVAL_WAIT_ABORTED')

  // (2) the request was durably abandoned (the terminal mark beats any decision).
  const abandoned = await run(() => serviceWith(() => { const error = new Error('abandoned'); error.code = 'CONTROL_REQUEST_ABANDONED'; throw error }))
  assert.equal(abandoned.facts[0].refusalCode, 'ADMISSION_APPROVAL_ABANDONED')
  assert.notEqual(abandoned.facts[0].refusalCode, aborted.facts[0].refusalCode, 'abort and abandon are different durable facts')

  // (3) NEGATIVE CONTROL: a decision value outside the closed vocabulary is a refusal, not an allow.
  const unrecognized = await run(() => serviceWith(() => ({ decision: 'maybe' })))
  assert.equal(unrecognized.verdict.kind, 'deny')
  assert.equal(unrecognized.facts[0].refusalCode, 'ADMISSION_APPROVAL_UNRECOGNIZED')

  // (4) NEGATIVE CONTROL: NO Control service on the row is its own refusal, and it is never an allow.
  const noService = await run(() => undefined)
  assert.equal(noService.verdict.kind, 'deny')
  assert.equal(noService.facts[0].refusalCode, 'ADMISSION_APPROVAL_UNAVAILABLE')
})

// ================================================ STOP PRIORITY + LIFECYCLE CLOSE (B stage)
//
// Two properties are proven here, both over the SAME assembly the product runs (one admission point,
// one fact ledger, one settlement store, one Control plane):
//
//  - A STOP beats every other outcome. The Stop is the host's own `exec.signal` — the same signal the
//    execution fact already reads — so there is no second stop mechanism. It is decided BEFORE the
//    lane and before any reviewer, it closes a pending durable Control request through the EXISTING
//    wait bridge's inline-abort cascade, it is never spent into an execution, and a durable approval
//    that arrives afterwards is refused by the Control plane itself (the abandonment is terminal).
//  - A LIFECYCLE CLOSE refuses instead of vanishing. After the member is closed a new call is
//    REFUSED with its own code and settled REFUSED/not-started (not UNKNOWN, not an execution), an
//    in-flight call still settles, and a second close is a no-op.

/**
 * One member's assembly on a host double that runs the waterfall the way the real host does:
 * every pre-execute listener in order, then the guard, then the result. The ledger and the settlement
 * store are the PRODUCT's, over a temp dir, so every claim below is a claim about written records.
 */
const centreWorld = async (label, over = {}) => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  // The durable half (round 54) re-opens the SAME directory with FRESH objects after a child process
  // died, so a world may adopt an existing dir/ledger/store instead of minting new ones. Every default
  // is exactly what it was before: no existing arm changed its world.
  const dir = over.dir ?? mkdtempSync(`${tmpdir()}/vnext-b-${label}-`)
  const listeners = { pre: [], result: [] }
  // The tools service is ONE object whether the caller supplies it (the C-mcp arms hand in the
  // surface the REAL mcp-client plugin registers into) or the arm only needs the centre's guard.
  const suppliedTools = over.tools
  const guardHolder = { current: undefined }
  const tools = suppliedTools === undefined
    ? { guard (fn) { guardHolder.current = fn; return () => { guardHolder.current = undefined } } }
    // Wrap the supplied service so the centre's guard is ALSO visible to this world's own dispatch
    // (the arm consults it exactly as the host does). Register/schemas pass through untouched.
    : {
        ...suppliedTools,
        guard (fn) {
          guardHolder.current = fn
          const dispose = suppliedTools.guard(fn)
          return () => {
            if (guardHolder.current === fn) guardHolder.current = undefined
            if (typeof dispose === 'function') dispose()
          }
        },
      }
  // The remaining Cordis surface the upstream mcp-client plugin reads during apply(). It decides
  // nothing and carries no policy: it is the host context a boot would supply (the same double the
  // U6 seam test uses).
  const hostDisposers = []
  const ctx = {
    root: {},
    fiber: { uid: null },
    tools,
    logger: { info () {}, warn () {}, error () {}, debug () {} },
    get: (name) => (name === 'tools' ? tools : undefined),
    effect: (setup) => {
      const dispose = setup()
      if (typeof dispose === 'function') hostDisposers.push(dispose)
    },
    inject: (_names, compose) => compose({
      mcpResources: { register () {} },
      systemPrompt: { section () {}, getSectionOrder () { return 100 } },
    }),
    on: (event, fn) => {
      const target = event === 'tools/pre-execute' ? listeners.pre : event === 'tools/result' ? listeners.result : undefined
      if (target === undefined) return () => {}
      target.push(fn)
      return () => {
        const at = target.indexOf(fn)
        if (at >= 0) target.splice(at, 1)
      }
    },
  }
  const ledger = over.ledger ?? openFactLedger({ path: join(dir, `${label}.facts.jsonl`) })
  const store = over.store ?? createExecutionSettlementStore({ dir: join(dir, 'settlement') })
  const faults = []
  const body = { count: 0 }
  const lookups = { count: 0 }
  let currentBinding = over.binding
  let resolveImpl = over.resolveBinding
  const resolveBinding = (exec) => {
    lookups.count += 1
    if (resolveImpl !== undefined) return resolveImpl(exec)
    return currentBinding
  }
  const identityOf = over.identityOf ?? ((exec) => ({
    executionId: dispatchExecutionId({ rootSessionId: 'session-1', agentInstanceId: 'agent-1' }, exec.callId),
    actorId: 'agent-1',
    worldId: 'session-1',
  }))
  const centre = installMemberCentre({
    ctx,
    binding: over.binding,
    resolveBinding,
    recordAdmission: (fact) => ledger.recordAdmission(fact),
    recordExecution: (fact) => ledger.recordExecution(fact),
    isReplay: (callId) => ledger.has(callId),
    recordReplay: (input) => ledger.recordReplayRefusal(input),
    store,
    identityOf,
    onFault: (error, context) => faults.push([error, context]),
    ...(over.grants === undefined ? {} : { grants: over.grants }),
    ...(over.approvals === undefined ? {} : { approvals: over.approvals }),
  })
  const preExecute = async (exec) => {
    const chain = listeners.pre.slice()
    const step = async (index) => (index >= chain.length ? { kind: 'allow' } : chain[index](exec, () => step(index + 1)))
    return step(0)
  }
  const guard = (exec) => (guardHolder.current === undefined ? undefined : guardHolder.current(exec))
  const result = (exec, outcome) => { for (const handler of listeners.result.slice()) handler(exec, outcome) }
  /** One dispatch: pre-execute, guard, body, result — with the host's own result shape. */
  const dispatch = async (exec) => {
    const verdict = await preExecute(exec)
    if (verdict.kind !== 'allow') {
      result(exec, { isError: true, error: { message: String(verdict.reason) } })
      return verdict
    }
    const reason = guard(exec)
    if (reason !== undefined) {
      result(exec, { isError: true, error: { message: String(reason) } })
      return { kind: 'deny', reason }
    }
    body.count += 1
    result(exec, { isError: false })
    return { kind: 'allow' }
  }
  return {
    dir,
    ctx,
    tools,
    hostDispose: () => {
      for (const dispose of [...hostDisposers].reverse()) {
        try { dispose() } catch { /* a dying mount is expected at teardown */ }
      }
    },
    centre,
    ledger,
    store,
    faults,
    body,
    lookups,
    preExecute,
    guard,
    result,
    dispatch,
    identityOf,
    executionIdOf: (exec) => identityOf(exec).executionId,
    setBinding: (value) => { currentBinding = value },
    setResolve: (fn) => { resolveImpl = fn },
    admissionFact: (callId) => ledger.readAll().find((record) => record.kind === 'invocation-authority' && record.callId === callId),
    close: () => centre.close(),
    dispose: () => centre.dispose(),
  }
}

const readExec = (callId, signal, filePath = '/work/a/doc.txt') => ({
  name: 'read',
  callId,
  arguments: { file_path: filePath },
  agent: { id: 'agent-1' },
  turn: 1,
  step: 1,
  ...(signal === undefined ? {} : { signal }),
})

test('ADM-56 — a Stop before the body is its OWN refusal: REFUSED/not-started, never UNKNOWN, never an execution', async () => {
  // (1) POSITIVE CONTROL: without a Stop the same call is admitted, its body runs, and it settles
  //     COMPLETED. Without this the stop arm could pass on a permanently-broken composition.
  const okWorld = await centreWorld('stop-ok', { binding: binding() })
  const ok = readExec('stop-ok-1')
  const okVerdict = await okWorld.dispatch(ok)
  assert.equal(okVerdict.kind, 'allow')
  assert.equal(okWorld.body.count, 1, 'the positive control really ran the body')
  assert.equal(okWorld.store.read(okWorld.executionIdOf(ok)).state, 'COMPLETED')
  okWorld.close()

  // (2) THE STOP. The host's own signal is already aborted when the call reaches the centre.
  const stopWorld = await centreWorld('stop', { binding: binding() })
  const controller = new AbortController()
  controller.abort()
  const stopped = readExec('stop-1', controller.signal)
  const verdict = await stopWorld.preExecute(stopped)
  assert.equal(verdict.kind, 'deny')
  assert.match(String(verdict.reason), /ADMISSION_STOPPED/u)
  assert.equal(stopWorld.body.count, 0, 'a Stop must precede the body')
  // ...and BOTH guard consultations agree: the second cannot turn the stop into an execution.
  assert.match(String(stopWorld.guard(stopped)), /ADMISSION_STOPPED/u)
  assert.match(String(stopWorld.guard(stopped)), /ADMISSION_STOPPED/u)
  assert.equal(stopWorld.body.count, 0)
  // The host now settles the refused call: the execution fact joins the decision that was enforced.
  stopWorld.result(stopped, { isError: true, error: { message: String(verdict.reason) } })
  assert.equal(stopWorld.ledger.readAll().find((entry) => entry.kind === 'execution' && entry.callId === 'stop-1').outcome, 'admission-refusal')

  // THE DURABLE FACT names the stop code, and that code is distinct from every other refusal a call
  // can meet - a Stop reported as a lane rule, an expiry or a fault is unreviewable.
  const fact = stopWorld.admissionFact('stop-1')
  assert.equal(fact.decision, 'deny')
  assert.equal(fact.refusalCode, 'ADMISSION_STOPPED')
  for (const other of [
    'LANE_DENY',
    'ADMISSION_APPROVAL_DENIED',
    'ADMISSION_APPROVAL_EXPIRED',
    'ADMISSION_APPROVAL_FAULT',
    'ADMISSION_ASK_UNWIRED',
    'ADMISSION_MEMBER_CLOSED',
  ]) {
    assert.notEqual(fact.refusalCode, other, `a Stop must not be recorded as ${other}`)
  }

  // THE SETTLEMENT: REFUSED at birth, nothing dispatched, no effect claimed, no RUNNING transition.
  const record = stopWorld.store.read(stopWorld.executionIdOf(stopped))
  assert.equal(record.state, 'REFUSED')
  assert.equal(record.observation.dispatch, 'not-started')
  assert.equal(record.observation.bodyOutcome, 'not-started')
  assert.equal(record.observation.effectEvidence, 'none-confirmed')
  assert.deepEqual(record.transitions.map((entry) => entry.to), ['ADMITTED', 'REFUSED'], 'no execution state was ever entered')
  assert.match(String(record.terminalReason), /ADMISSION_STOPPED/u)
  assert.equal(stopWorld.store.recoverUnsettled(new Date().toISOString()).length, 0, 'nothing is left open to recover as UNKNOWN')

  // (3) NEGATIVE CONTROL: the SAME out-of-lane call WITHOUT a Stop is a lane denial, so the stop code
  //     is not simply what this assembly always says.
  const outside = readExec('stop-outside-1', undefined, '/etc/passwd')
  const laneDenied = await stopWorld.dispatch(outside)
  assert.equal(laneDenied.kind, 'deny')
  assert.match(String(laneDenied.reason), /LANE_DENY/u)
  assert.equal(stopWorld.admissionFact('stop-outside-1').refusalCode, 'LANE_DENY')

  // (4) NEGATIVE CONTROL / STOP PRIORITY: the SAME out-of-lane call WITH a Stop reports the Stop. A
  //     Stop beats the lane's own answer (both refuse; the RECORD must name the operator's decision).
  const outsideStopped = new AbortController()
  outsideStopped.abort()
  const priority = await stopWorld.dispatch(readExec('stop-outside-2', outsideStopped.signal, '/etc/passwd'))
  assert.equal(priority.kind, 'deny')
  assert.match(String(priority.reason), /ADMISSION_STOPPED/u)
  assert.equal(stopWorld.admissionFact('stop-outside-2').refusalCode, 'ADMISSION_STOPPED')
  stopWorld.close()
})

test('ADM-57 — a Stop while the ask is PENDING closes the durable request, and a later approval cannot revive it', async () => {
  const { createP6T4World, createP6T4Service, destroyP6T1World, leaderCaller, P6T4_ROOT, P6T4_SEEDS } =
    await import('./p6t4-helpers.js')
  // A previous run of this arm that was KILLED (not a normal exit) leaves its scratch domain behind,
  // and a fixed basename would then refuse to create it ("team_domain already exists"). Clear the
  // leftover so the arm is re-runnable; on a normal exit the `finally` below already removes it.
  const { destroyDir, scratchDir } = await import('../../testkit/fault-injection/file-seam.mjs')
  destroyDir(scratchDir('vnext-stop-ask'))
  const world = await createP6T4World('vnext-stop-ask')
  const service = createP6T4Service(world)
  try {
    const worker = String(P6T4_SEEDS.worker.instanceId)
    const workerBinding = {
      agentId: worker,
      instanceId: worker,
      sessionId: P6T4_SEEDS.worker.childSessionId,
      instanceGeneration: 2,
      templateId: 'worker',
      read: lane(['/work/a'], ['/work/ask']),
      write: lane(['/work/a']),
      workspaceRoot: '/work/a',
      policyGeneration: 'gen-7',
      owner: P6T4_ROOT,
    }
    const binder = createInvocationBinder()
    let consumed = 0
    const countedBinder = {
      bind: (input) => binder.bind(input),
      consume: (capability, request) => { consumed += 1; return binder.consume(capability, request) },
    }
    const stopController = new AbortController()
    // The reviewer answers INSIDE `onRequested`, i.e. after the request row is durable and before the
    // wait begins: deterministic, no polling and no sleeps. The stop arm aborts the CALL's signal at
    // that same instant, so the pending ask and the Stop genuinely coincide.
    const approvals = createControlApprovalPort({
      controlOf: () => service,
      onRequested: async (record) => {
        if (record.correlation === 'admission:real-stop-1') {
          stopController.abort()
          return
        }
        await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: record.requestId, decision: 'allow' })
      },
    })
    const w = await centreWorld('stop-ask', {
      binding: workerBinding,
      grants: {
        binder: countedBinder,
        memberOf: (b) => ({ teamId: b.owner, memberInstanceId: b.instanceId, templateId: b.templateId, instanceGeneration: b.instanceGeneration }),
      },
      approvals,
    })
    const stopped = { name: 'read', callId: 'real-stop-1', arguments: { file_path: '/work/ask/doc.txt' }, signal: stopController.signal }
    const verdict = await w.preExecute(stopped)
    assert.equal(verdict.kind, 'deny')
    assert.match(String(verdict.reason), /ADMISSION_STOPPED/u)
    assert.equal(consumed, 0, 'a Stop must never mint or spend an approval')

    // THE DURABLE SIDE, on the product's own terms: the request exists, NO decision exists for it, and
    // the wait bridge's inline-abort cascade wrote the terminal abandonment mark.
    const state = await service.listControlState(P6T4_ROOT)
    assert.equal(state.requests.length, 1, 'the ask really became a durable Control request')
    assert.equal(state.decisions.length, 0, 'no approval was ever granted for a stopped call')
    assert.equal(state.abandonments.length, 1, 'the pending inline request was durably ABANDONED')
    assert.equal(state.abandonments[0].requestId, state.requests[0].requestId)

    // THE STALE APPROVAL. A leader that answers after the Stop is refused by the Control plane, with no
    // durable side effect: the abandonment is terminal, so a Stop is never downgraded by a later allow.
    await assert.rejects(
      () => service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: state.requests[0].requestId, decision: 'allow' }),
      (error) => error?.code === 'CONTROL_REQUEST_ABANDONED',
      'a stale approval after a Stop must be refused with the abandonment code',
    )
    const after = await service.listControlState(P6T4_ROOT)
    assert.equal(after.decisions.length, 0, 'the refused stale approval wrote no decision')
    assert.equal(after.abandonments.length, 1, 'the terminal mark is written exactly once')

    // THE RECORD: REFUSED, nothing dispatched, no effect claimed, no open record.
    const record = w.store.read(w.executionIdOf(stopped))
    assert.equal(record.state, 'REFUSED')
    assert.equal(record.observation.dispatch, 'not-started')
    assert.equal(record.observation.bodyOutcome, 'not-started')
    assert.equal(w.admissionFact('real-stop-1').refusalCode, 'ADMISSION_STOPPED')
    assert.equal(w.body.count, 0)
    // The guard cannot turn the stopped ask into an execution either (no grant exists to spend).
    assert.match(String(w.guard(stopped)), /ADMISSION_STOPPED/u)
    assert.equal(consumed, 0)
    w.result(stopped, { isError: true, error: { message: String(verdict.reason) } })

    // (POSITIVE CONTROL) The SAME wiring, no Stop: the ask becomes a durable allow and runs once.
    const approved = { name: 'read', callId: 'real-ok-2', arguments: { file_path: '/work/ask/doc.txt' } }
    assert.equal((await w.dispatch(approved)).kind, 'allow')
    assert.equal(consumed, 1, 'the positive control spends the approval exactly once')
    assert.equal(w.store.read(w.executionIdOf(approved)).state, 'COMPLETED')
    const final = await service.listControlState(P6T4_ROOT)
    assert.equal(final.requests.length, 2)
    assert.equal(final.decisions.length, 1)
    assert.equal(final.abandonments.length, 1)
    w.close()
  } finally {
    await destroyP6T1World(world)
  }
})

test('ADM-58 — a Stop AFTER the approval and BEFORE the body spends nothing, and closes the record with Stop evidence', async () => {
  const run = async (label, stop) => {
    const w = await centreWorld(label, {
      binding: askBinding(),
      grants: {
        binder: createInvocationBinder(),
        memberOf: (b) => ({ teamId: 'team-1', memberInstanceId: b.agentId, templateId: 'tmpl', instanceGeneration: b.instanceGeneration }),
      },
      approvals: approvalsAnswer({ ok: true, approval: { approvalId: `approval-${label}`, policyRevision: 'gen-7' } }).port,
    })
    const controller = new AbortController()
    const exec = readExec(`${label}-1`, stop ? controller.signal : undefined, '/work/ask/doc.txt')
    const asked = await w.preExecute(exec)
    assert.equal(asked.kind, 'allow', 'the approval was granted at pre-execute')
    if (stop) controller.abort()
    const firstGuard = w.guard(exec)
    const secondGuard = w.guard(exec)
    if (firstGuard === undefined) {
      w.body.count += 1
      w.result(exec, { isError: false })
    } else {
      w.result(exec, { isError: true, error: { message: String(firstGuard) } })
    }
    return { w, exec, firstGuard, secondGuard }
  }

  // (1) THE STOP. The approval already holds and the body has not run: it must not be spent, and it
  //     must not execute. Both guard consultations agree (the host consults the guard twice).
  const stopped = await run('stop-guard', true)
  assert.match(String(stopped.firstGuard), /ADMISSION_STOPPED/u)
  assert.equal(stopped.secondGuard, stopped.firstGuard, 'the second consultation reads the same refusal')
  assert.equal(stopped.w.body.count, 0, 'the approval must not reach the body')
  const record = stopped.w.store.read(stopped.w.executionIdOf(stopped.exec))
  // The frozen settlement contract has no REFUSED-from-allow (the open settlement-recheck escalation),
  // so the product's OWN Stop vocabulary is used: a recorded pre-dispatch Stop plus CANCELLED, with an
  // observation that says nothing was dispatched and nothing was claimed.
  assert.equal(record.state, 'CANCELLED')
  assert.equal(record.observation.dispatch, 'not-started')
  assert.equal(record.observation.bodyOutcome, 'not-started')
  assert.equal(record.observation.effectEvidence, 'none-confirmed')
  assert.deepEqual(record.stops.map((entry) => entry.phase), ['pre-dispatch'], 'the Stop evidence is the authority signal recorded')
  assert.deepEqual(record.transitions.map((entry) => entry.to), ['ADMITTED', 'CANCELLED'], 'the call never entered an execution state')
  assert.notEqual(record.state, 'UNKNOWN')
  // The ADMISSION decision is NOT rewritten (a second authority record for one callId is a replay);
  // the Stop is a LATER durable fact, and the execution fact is where it is named.
  const admission = stopped.w.admissionFact('stop-guard-1')
  assert.equal(admission.decision, 'allow', 'the approval that was granted at pre-execute stays in the record')
  assert.equal(admission.laneDecision, 'ask', 'the lane answer is never erased')
  const execution = stopped.w.ledger.readAll().find((entry) => entry.kind === 'execution' && entry.callId === 'stop-guard-1')
  assert.equal(execution.outcome, 'admission-refusal', 'the Stop refused the call, it did not fail it')
  assert.equal(execution.refusalCode, 'ADMISSION_STOPPED', 'and the durable fact names the stop')
  assert.equal(stopped.w.store.recoverUnsettled(new Date().toISOString()).length, 0, 'no open record survives the stop')

  // (2) NEGATIVE CONTROL: the SAME wiring without a Stop spends the approval exactly once, runs, and
  //     settles COMPLETED. Nothing above is a property of a broken assembly.
  const allowed = await run('stop-guard-ok', false)
  assert.equal(allowed.firstGuard, undefined, 'without a Stop the approved call passes the guard')
  assert.equal(allowed.w.body.count, 1)
  assert.equal(allowed.w.store.read(allowed.w.executionIdOf(allowed.exec)).state, 'COMPLETED')
  assert.equal(allowed.w.store.read(allowed.w.executionIdOf(allowed.exec)).stops.length, 0, 'no Stop is invented for a call nobody stopped')
  stopped.w.close()
  allowed.w.close()
})

test('ADM-59 — LIFECYCLE CLOSE: a new call is REFUSED with its own code, not judged against a stale binding, and not UNKNOWN', async () => {
  const w = await centreWorld('closed', { binding: binding() })
  try {
    // (1) POSITIVE CONTROL: before the close the same call is admitted and completes.
    const before = readExec('close-before-1')
    assert.equal((await w.dispatch(before)).kind, 'allow')
    assert.equal(w.body.count, 1)
    assert.equal(w.store.read(w.executionIdOf(before)).state, 'COMPLETED')

    // (2) THE CLOSE. From here the binding resolver is a TRAP: a closed member has no live binding, so
    //     a centre that consulted one would be admitting against a stale answer. It must not be read.
    let bindingReadsAfterClose = 0
    w.setResolve(() => { bindingReadsAfterClose += 1; return binding() })
    w.close()
    const readsAtClose = w.lookups.count

    const after = readExec('close-after-1')
    const verdict = await w.preExecute(after)
    assert.equal(verdict.kind, 'deny')
    assert.match(String(verdict.reason), /ADMISSION_MEMBER_CLOSED/u)
    assert.equal(bindingReadsAfterClose, 0, 'a closed centre must not consult a binding for a new call')
    assert.equal(w.lookups.count, readsAtClose, 'no binding lookup happened after the close')
    assert.equal(w.body.count, 1, 'the closed member must not run the body')
    // The guard agrees, so a host that consults it sees the same refusal.
    assert.match(String(w.guard(after)), /ADMISSION_MEMBER_CLOSED/u)
    w.result(after, { isError: true, error: { message: String(verdict.reason) } })

    // THE RECORD: its own code, REFUSED/not-started, terminal at birth, never UNKNOWN.
    const fact = w.admissionFact('close-after-1')
    assert.equal(fact.decision, 'deny')
    assert.equal(fact.refusalCode, 'ADMISSION_MEMBER_CLOSED')
    assert.notEqual(fact.refusalCode, 'ADMISSION_NO_BINDING', 'a closed member is not "no binding": it has its own code')
    const record = w.store.read(w.executionIdOf(after))
    assert.equal(record.state, 'REFUSED')
    assert.equal(record.observation.dispatch, 'not-started')
    assert.equal(record.observation.bodyOutcome, 'not-started')
    assert.deepEqual(record.transitions.map((entry) => entry.to), ['ADMITTED', 'REFUSED'])
    assert.equal(w.store.recoverUnsettled(new Date().toISOString()).length, 0, 'nothing is left open to recover as UNKNOWN')

    // (3) IDEMPOTENCE: a second close changes nothing (same verdict, same records, no throw).
    const factsBefore = w.ledger.readAll().length
    w.close()
    w.close()
    assert.equal(w.ledger.readAll().length, factsBefore, 'a second close writes nothing')
    const again = readExec('close-after-2')
    assert.match(String(await w.guard(again)), /ADMISSION_MEMBER_CLOSED/u)
    assert.equal(w.admissionFact('close-after-2').refusalCode, 'ADMISSION_MEMBER_CLOSED')
    assert.equal(w.store.read(w.executionIdOf(again)).state, 'REFUSED')
    // A repeated consultation of the SAME execution reads the memo: one record, never two.
    assert.match(String(await w.guard(again)), /ADMISSION_MEMBER_CLOSED/u)
    assert.equal(w.ledger.readAll().filter((entry) => entry.kind === 'invocation-authority' && entry.callId === 'close-after-2').length, 1)
  } finally {
    w.dispose()
    w.dispose()
  }
})

test('ADM-60 — CLOSE with a call IN FLIGHT: it still settles, and a second dispose neither throws nor double-settles', async () => {
  const w = await centreWorld('closed-flight', { binding: binding() })
  try {
    const exec = readExec('flight-1')
    assert.equal((await w.preExecute(exec)).kind, 'allow')
    assert.equal(w.guard(exec), undefined, 'the guard passes: the body is about to run')
    w.body.count += 1
    assert.equal(w.store.read(w.executionIdOf(exec)).state, 'RUNNING')

    // THE CLOSE happens while the body is running. The observation must survive it.
    w.close()
    w.result(exec, { isError: false })

    const record = w.store.read(w.executionIdOf(exec))
    assert.equal(record.state, 'COMPLETED', 'an in-flight call that finishes after the close must still settle')
    assert.deepEqual(record.transitions.map((entry) => entry.to), ['ADMITTED', 'RUNNING', 'COMPLETED'])
    assert.equal(w.ledger.readAll().filter((entry) => entry.kind === 'execution' && entry.callId === 'flight-1').length, 1, 'exactly one execution fact, written after the close')
    assert.equal(w.store.recoverUnsettled(new Date().toISOString()).length, 0, 'nothing is left for recovery to call UNKNOWN')

    // IDEMPOTENCE: two more closes and two disposals throw nothing and change nothing.
    const recordBefore = JSON.stringify(record)
    w.close()
    w.close()
    w.dispose()
    w.dispose()
    assert.equal(JSON.stringify(w.store.read(w.executionIdOf(exec))), recordBefore, 'no double-settle and no rewrite')
    assert.equal(w.faults.length, 0, `no fault may be reported by a close: ${JSON.stringify(w.faults.map(([error]) => String(error?.message ?? error)))}`)
    // NEGATIVE CONTROL: after a real REMOVAL the point answers nothing (the disposal path is unchanged).
    assert.equal(w.guard(readExec('flight-removed-1')), undefined)
  } finally {
    w.dispose()
  }
})

test('ADM-61 — CLOSE while an ask is PENDING: the request is abandoned, the call is REFUSED/not-started, and a later approval is refused', async () => {
  const { createP6T4World, createP6T4Service, destroyP6T1World, leaderCaller, P6T4_ROOT, P6T4_SEEDS } =
    await import('./p6t4-helpers.js')
  // Same leftover protection as ADM-57: a killed run must not poison the next one.
  const { destroyDir, scratchDir } = await import('../../testkit/fault-injection/file-seam.mjs')
  destroyDir(scratchDir('vnext-close-ask'))
  const world = await createP6T4World('vnext-close-ask')
  const service = createP6T4Service(world)
  try {
    const worker = String(P6T4_SEEDS.worker.instanceId)
    const workerBinding = {
      agentId: worker,
      instanceId: worker,
      sessionId: P6T4_SEEDS.worker.childSessionId,
      instanceGeneration: 2,
      templateId: 'worker',
      read: lane(['/work/a'], ['/work/ask']),
      write: lane(['/work/a']),
      workspaceRoot: '/work/a',
      policyGeneration: 'gen-7',
      owner: P6T4_ROOT,
    }
    const binder = createInvocationBinder()
    let consumed = 0
    const countedBinder = {
      bind: (input) => binder.bind(input),
      consume: (capability, request) => { consumed += 1; return binder.consume(capability, request) },
    }
    let closeInside = undefined
    const approvals = createControlApprovalPort({
      controlOf: () => service,
      onRequested: async (record) => {
        // The positive control answers with a durable allow; the close arm closes the member at the
        // instant the request is durable and before the wait starts.
        if (record.correlation === 'admission:close-ask-2') {
          closeInside()
          return
        }
        await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: record.requestId, decision: 'allow' })
      },
    })
    const w = await centreWorld('close-ask', {
      binding: workerBinding,
      grants: {
        binder: countedBinder,
        memberOf: (b) => ({ teamId: b.owner, memberInstanceId: b.instanceId, templateId: b.templateId, instanceGeneration: b.instanceGeneration }),
      },
      approvals,
    })
    closeInside = () => w.close()

    // (1) POSITIVE CONTROL: the ask approves and runs...
    const approved = { name: 'read', callId: 'close-ask-1', arguments: { file_path: '/work/ask/doc.txt' } }
    assert.equal((await w.dispatch(approved)).kind, 'allow')
    assert.equal(w.store.read(w.executionIdOf(approved)).state, 'COMPLETED')
    assert.equal(consumed, 1)

    // ...then the member closes with the next ask still pending.
    const pending = { name: 'read', callId: 'close-ask-2', arguments: { file_path: '/work/ask/doc.txt' } }
    const verdict = await w.dispatch(pending)
    assert.equal(verdict.kind, 'deny')
    assert.match(String(verdict.reason), /ADMISSION_MEMBER_CLOSED/u, 'a close, not a Stop and not a denial')
    assert.equal(consumed, 1, 'the pending ask never minted a grant')

    // THE DURABLE SIDE: the request exists and was abandoned by the ONE wait bridge; no decision.
    const state = await service.listControlState(P6T4_ROOT)
    assert.equal(state.requests.length, 2)
    assert.equal(state.decisions.length, 1, 'only the positive control carries a decision')
    assert.equal(state.abandonments.length, 1, 'the pending request of the closed member is durably abandoned')
    const pendingRequest = state.requests.find((request) => request.correlation === 'admission:close-ask-2')
    assert.equal(state.abandonments[0].requestId, pendingRequest.requestId)

    // THE RECORD: REFUSED/not-started for a call that was admitted to the centre and never ran.
    const record = w.store.read(w.executionIdOf(pending))
    assert.equal(record.state, 'REFUSED')
    assert.equal(record.observation.dispatch, 'not-started')
    assert.equal(record.observation.bodyOutcome, 'not-started')
    assert.equal(w.admissionFact('close-ask-2').refusalCode, 'ADMISSION_MEMBER_CLOSED')
    assert.equal(w.store.recoverUnsettled(new Date().toISOString()).length, 0, 'no open record is left to recover as UNKNOWN')

    // THE LATER APPROVAL is refused: an abandoned request can never become an allow.
    await assert.rejects(
      () => service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: pendingRequest.requestId, decision: 'allow' }),
      (error) => error?.code === 'CONTROL_REQUEST_ABANDONED',
    )

    // A NEW call after the close asks no reviewer at all: it is refused by the closed centre itself.
    const later = { name: 'read', callId: 'close-ask-3', arguments: { file_path: '/work/ask/doc.txt' } }
    assert.match(String((await w.dispatch(later)).reason), /ADMISSION_MEMBER_CLOSED/u)
    const final = await service.listControlState(P6T4_ROOT)
    assert.equal(final.requests.length, 2, 'a closed member must not raise another approval request')
    w.close()
    w.dispose()
    assert.equal(w.faults.length, 0, `the close path must report no fault: ${JSON.stringify(w.faults.map(([error]) => String(error?.message ?? error)))}`)
  } finally {
    await destroyP6T1World(world)
  }
})

test('ADM-62 — the PRODUCT composition CLOSES the member: member-execution\'s dispose refuses with its own code and still settles', async () => {
  // ADM-59 measures the centre. This arm measures the SUPPLY: the product's member lifecycle must call
  // the close (not the removal), or an archived member's tools would run with no admission at all.
  const { installMemberExecution } = await import('../src/plugin/vnext/member-execution.mjs')
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const compiledAnswer = {
    members: [{
      identity: { instanceId: 'member-1', instanceGeneration: 1 },
      policy: {
        ok: true,
        value: {
          memberIdentity: 'member-1',
          templateId: 'worker',
          instanceGeneration: 1,
          revision: 'rev-1',
          read: lane(['/work']),
          write: lane(['/work']),
        },
      },
    }],
  }
  const listeners = { pre: [], result: [] }
  let guardFn
  const agentCtx = {
    get: (name) => (name === 'tools' ? { guard (fn) { guardFn = fn; return () => { guardFn = undefined } } } : undefined),
    on: (event, fn) => {
      const target = event === 'tools/pre-execute' ? listeners.pre : event === 'tools/result' ? listeners.result : undefined
      if (target === undefined) return () => {}
      target.push(fn)
      return () => {
        const at = target.indexOf(fn)
        if (at >= 0) target.splice(at, 1)
      }
    },
  }
  const state = mkdtempSync(`${tmpdir()}/vnext-close-product-`)
  const disposers = []
  const observed = []
  const centreState = await installMemberExecution({
    agentCtx,
    realm: {},
    compiledAnswer,
    config: { centreStatePath: state },
    sessionId: 'session-1',
    instanceId: 'member-1',
    teamRoot: 'root-1',
    workspaceRoot: '/work',
    onDispose: (dispose) => { disposers.push(dispose) },
    onNativeDispose: () => {},
    observe: (line) => { observed.push(String(line)) },
  })
  const body = { count: 0 }
  const idOf = (exec) => dispatchExecutionId({ rootSessionId: 'root-1', agentInstanceId: 'member-1' }, exec.callId)
  const run = async (exec) => {
    const chain = listeners.pre.slice()
    const step = async (index) => (index >= chain.length ? { kind: 'allow' } : chain[index](exec, () => step(index + 1)))
    const verdict = await step(0)
    if (verdict.kind !== 'allow') {
      for (const handler of listeners.result.slice()) handler(exec, { isError: true, error: { message: String(verdict.reason) } })
      return verdict
    }
    const reason = guardFn === undefined ? undefined : guardFn(exec)
    if (reason !== undefined) {
      for (const handler of listeners.result.slice()) handler(exec, { isError: true, error: { message: String(reason) } })
      return { kind: 'deny', reason }
    }
    body.count += 1
    for (const handler of listeners.result.slice()) handler(exec, { isError: false })
    return { kind: 'allow' }
  }
  const disposeMember = () => { for (const dispose of disposers) dispose() }

  // (1) POSITIVE CONTROL: while the member is live the same call is admitted and completes.
  const before = { name: 'read', callId: 'product-1', arguments: { file_path: '/work/doc.txt' } }
  assert.equal((await run(before)).kind, 'allow')
  assert.equal(body.count, 1)
  assert.equal(centreState.settlementStore.read(idOf(before)).state, 'COMPLETED')

  // (2) THE PRODUCT CLOSE: the member's own disposer, twice (the second must be a no-op, not a throw).
  disposeMember()
  assert.doesNotThrow(disposeMember, 'a second dispose of the member must not throw')

  const after = { name: 'read', callId: 'product-2', arguments: { file_path: '/work/doc.txt' } }
  const verdict = await run(after)
  assert.equal(verdict.kind, 'deny')
  assert.match(String(verdict.reason), /ADMISSION_MEMBER_CLOSED/u)
  assert.equal(body.count, 1, 'the archived member must not run the body')
  const fact = centreState.ledger.readAll().find((entry) => entry.kind === 'invocation-authority' && entry.callId === 'product-2')
  assert.equal(fact.refusalCode, 'ADMISSION_MEMBER_CLOSED')
  assert.equal(fact.agentId, 'member-1', 'a closed member still names itself in the refusal fact (the install-time binding is kept for that)')
  const record = centreState.settlementStore.read(idOf(after))
  assert.equal(record.state, 'REFUSED')
  assert.equal(record.observation.dispatch, 'not-started')
  assert.equal(record.observation.bodyOutcome, 'not-started')
  assert.equal(centreState.settlementStore.recoverUnsettled(new Date().toISOString()).length, 0, 'nothing is left open to recover as UNKNOWN')
  assert.equal(observed.filter((line) => line.includes('fault')).length, 0, `the close path must report no fault: ${JSON.stringify(observed)}`)
})

// ============================================================================================
// THE DURABLE HALF (B stage, round 54): crash recovery, UNKNOWN, and no replay
//
// Rounds 51-53 proved the decision path, the Stop/lifecycle close and the probe ladder IN ONE
// PROCESS. What stayed "coded" is what survives a process: a record opened before a crash, a callId
// that must not be admitted twice, and a ledger that cannot be read. So every arm below reads its
// answer back FROM THE FILES with FRESH product objects, and the writer is a CHILD PROCESS that
// exits without unwinding (`process.exit`), leaving on disk exactly what a crash leaves: a complete
// record for what happened, an OPEN record for what did not, and a writer lock still naming the dead
// pid (which the next open reclaims - ADM-79 asserts that pid transition on disk).
//
// There is NO sleep, NO retry and NO timer here: the child's exit status is part of the assertion.
// ============================================================================================

const { settlementRecordPath } = await import('../settlement/execution-settlement.ts')
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, chmodSync, readdirSync } = await import('node:fs')
const { tmpdir } = await import('node:os')
const { join } = await import('node:path')
const { spawnSync } = await import('node:child_process')

/** The worktree root, so the child resolves the same modules and hooks this file does. */
const durableRoot = fileURLToPath(new URL('../../..', import.meta.url))

/** The ONE durable identity both processes derive execution ids from. */
const DURABLE_IDENTITY = Object.freeze({
  rootSessionId: 'root-durable',
  agentInstanceId: 'member-durable',
  actorId: 'member-durable',
  worldId: 'session-durable',
})

const durableExecutionId = (callId) => dispatchExecutionId(
  { rootSessionId: DURABLE_IDENTITY.rootSessionId, agentInstanceId: DURABLE_IDENTITY.agentInstanceId },
  callId,
)

const durableIdentityOf = (exec) => ({
  executionId: durableExecutionId(exec.callId),
  actorId: DURABLE_IDENTITY.actorId,
  worldId: DURABLE_IDENTITY.worldId,
})

/**
 * THE CRASH. A child process that (a) writes through the PRODUCT composition (`installMemberCentre`
 * over a real `openFactLedger` and a real `ExecutionSettlementStore`), (b) prints ONE JSON line
 * SYNCHRONOUSLY (`writeSync`, so an abrupt exit cannot truncate it) and (c) `process.exit()`s without
 * running a disposer. The only state that survives is what reached the files.
 */
const DURABLE_CHILD = String.raw`
import { writeSync } from 'node:fs'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
const root = process.env.VNEXT_CHILD_ROOT
const plan = JSON.parse(process.argv[1])
register(pathToFileURL(root + '/scripts/run-tests-hooks.mjs').href)
const load = (rel) => import(pathToFileURL(root + '/' + rel).href)
const { openFactLedger } = await load('packages/runtime/src/plugin/vnext/fact-ledger.mjs')
const { installMemberCentre } = await load('packages/runtime/src/plugin/vnext/centre-install.mjs')
const { createExecutionSettlementStore } = await load('packages/runtime/settlement/execution-settlement.ts')
const { dispatchExecutionId } = await load('packages/runtime/settlement/dispatch-settlement.ts')
const binding = plan.binding
const listeners = { pre: [], result: [] }
let guardFn
const ctx = {
  get: (name) => (name === 'tools' ? { guard (fn) { guardFn = fn; return () => {} } } : undefined),
  on: (event, fn) => {
    const target = event === 'tools/pre-execute' ? listeners.pre : event === 'tools/result' ? listeners.result : undefined
    if (target === undefined) return () => {}
    target.push(fn)
    return () => {}
  },
}
const ledger = openFactLedger({ path: plan.dir + '/' + plan.ledger })
const store = plan.store === true ? createExecutionSettlementStore({ dir: plan.dir + '/' + plan.settlement }) : undefined
const identityOf = (exec) => ({
  executionId: dispatchExecutionId({ rootSessionId: plan.rootSessionId, agentInstanceId: plan.agentInstanceId }, exec.callId),
  actorId: plan.actorId,
  worldId: plan.worldId,
})
const faults = []
installMemberCentre({
  ctx,
  binding,
  resolveBinding: () => binding,
  recordAdmission: (fact) => ledger.recordAdmission(fact),
  recordExecution: (fact) => ledger.recordExecution(fact),
  isReplay: (callId) => ledger.has(callId),
  recordReplay: (input) => ledger.recordReplayRefusal(input),
  ...(store === undefined ? {} : { store }),
  identityOf,
  onFault: (error, context) => faults.push(context.phase + ': ' + String(error instanceof Error ? error.message : error)),
})
const preExecute = async (exec) => {
  const chain = listeners.pre.slice()
  const step = async (index) => (index >= chain.length ? { kind: 'allow' } : chain[index](exec, () => step(index + 1)))
  return step(0)
}
const results = []
const bodyCounts = {}
for (const step of plan.steps) {
  const exec = { name: 'read', callId: step.callId, arguments: { file_path: step.filePath }, agent: { id: plan.actorId }, turn: 1, step: 1 }
  const entry = { callId: step.callId, mode: step.mode }
  const verdict = await preExecute(exec)
  entry.verdict = verdict.kind
  if (verdict.reason !== undefined) entry.reason = String(verdict.reason)
  if (step.mode !== 'admit' && verdict.kind === 'allow') {
    const reason = guardFn === undefined ? undefined : guardFn(exec)
    if (reason !== undefined) entry.guardReason = String(reason)
    else {
      bodyCounts[step.callId] = (bodyCounts[step.callId] ?? 0) + 1
      if (step.mode === 'complete') {
        for (const handler of listeners.result.slice()) handler(exec, { isError: false })
        entry.settled = 'completed'
      }
    }
  }
  results.push(entry)
}
writeSync(1, JSON.stringify({ pid: process.pid, results, bodyCounts, faults }) + '\n')
process.exit(plan.exit === undefined ? 0 : plan.exit)
`

/** Run the crash child and lift its ONE machine-readable line. No shell, no timeout, no retry. */
const runDurableChild = (plan) => {
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', DURABLE_CHILD, JSON.stringify(plan)], {
    cwd: durableRoot,
    encoding: 'utf8',
    env: { ...process.env, VNEXT_CHILD_ROOT: durableRoot },
    maxBuffer: 64 * 1024 * 1024,
  })
  const line = String(run.stdout ?? '').split('\n').map((entry) => entry.trim()).filter((entry) => entry.startsWith('{')).at(-1)
  return { ...run, summary: line === undefined ? undefined : JSON.parse(line) }
}

const durableWorldDir = (label) => mkdtempSync(join(tmpdir(), `vnext-durable-${label}-`))

const durablePlan = (dir, steps, over = {}) => ({
  dir,
  ledger: 'facts.jsonl',
  settlement: 'settlement',
  store: true,
  ...DURABLE_IDENTITY,
  binding: binding(),
  steps,
  ...over,
})

const durableText = (path) => readFileSync(path, 'utf8')

/** A fresh ledger instance over the SAME file. Its maps are new; the authority is the file. */
const readBackLedger = (dir) => openFactLedger({ path: join(dir, 'facts.jsonl') })

/** A fresh store over the SAME directory (it reclaims a dead writer lock on open). */
const readBackStore = (dir, settlement = 'settlement') => createExecutionSettlementStore({ dir: join(dir, settlement) })

test('ADM-79 — a crash between the admission fact and the execution fact is recovered by a NEW process as UNKNOWN, never COMPLETED, and never re-executed', async () => {
  const dir = durableWorldDir('crash')
  const crash = runDurableChild(durablePlan(dir, [
    { callId: 'crash-done-1', filePath: '/work/a/doc.txt', mode: 'complete' },
    { callId: 'crash-open-1', filePath: '/work/a/doc.txt', mode: 'admit' },
  ], { exit: 7 }))
  assert.equal(crash.status, 7, `the writer must die abruptly, not unwind (stderr: ${crash.stderr})`)
  assert.notEqual(crash.summary, undefined, 'the child reports what it did BEFORE dying')
  assert.equal(crash.summary.bodyCounts['crash-done-1'], 1, 'the control call really ran')
  assert.equal(crash.summary.bodyCounts['crash-open-1'], undefined, 'the crashing call never reached the body')
  assert.equal(crash.summary.results.find((entry) => entry.callId === 'crash-open-1').verdict, 'allow', 'the admission decision was an ALLOW before the crash')

  // (1) THE CRASH IS ON DISK. The lock still names the dead process; the open call has an admission
  // fact and an ADMITTED settlement, and NO execution fact. Nothing below reads the child's memory.
  const lockBefore = JSON.parse(durableText(join(dir, 'settlement', '.settlement-writer.lock')))
  assert.equal(lockBefore.pid, crash.summary.pid, 'the writer lock on disk still names the DEAD writer')

  const ledger = readBackLedger(dir)
  const store = readBackStore(dir)
  const lockAfter = JSON.parse(durableText(join(dir, 'settlement', '.settlement-writer.lock')))
  assert.equal(lockAfter.pid, process.pid, 'the FRESH process reclaimed the dead writer lock - a new process, not a cleared map')

  const openBefore = store.read(durableExecutionId('crash-open-1'))
  assert.equal(openBefore.state, 'ADMITTED', 'the record the dead process opened is the record on disk')
  assert.deepEqual(openBefore.transitions.map((entry) => entry.to), ['ADMITTED'])
  const factsAtCrash = ledger.readAll()
  assert.deepEqual(
    factsAtCrash.filter((entry) => entry.callId === 'crash-open-1').map((entry) => entry.kind),
    ['invocation-authority'],
    'an admission fact, and no execution fact: the crash is BETWEEN them',
  )

  // (2) COLD RECOVERY by the new process: the product's own `recoverUnsettled`, the same call
  // `member-execution` makes at bind time.
  const recovered = createSettlementWriter({ store, identityOf: durableIdentityOf }).recover()
  assert.equal(recovered.length, 1, 'exactly the OPEN record is reconciled')
  const mine = recovered[0]
  assert.equal(mine.executionId, durableExecutionId('crash-open-1'))
  assert.equal(mine.before, 'ADMITTED')
  assert.equal(mine.after, 'UNKNOWN', 'nobody knows whether the body ran, so the only honest state is UNKNOWN')
  const openAfter = store.read(durableExecutionId('crash-open-1'))
  assert.equal(openAfter.state, 'UNKNOWN')
  assert.deepEqual(openAfter.transitions.map((entry) => entry.to), ['ADMITTED', 'UNKNOWN'], 'no RUNNING and no COMPLETED was invented')
  assert.match(String(openAfter.terminalReason), /PROCESS_TERMINATED_WITHOUT_OUTCOME/u)
  assert.equal(openAfter.observation.dispatch, 'not-started', 'the admission observed no dispatch, and recovery does not rewrite that')
  assert.equal(openAfter.observation.bodyOutcome, 'unknown')
  assert.equal(openAfter.observation.effectEvidence, 'unknown', 'unknown is the absence of proof, never proof of absence')
  assert.equal(openAfter.missingEvidence.length > 0, true)
  assert.equal(openAfter.missingEvidence.includes('dispatch-confirmation'), true, 'the record says WHAT is missing')
  assert.deepEqual(openAfter.stops, [], 'recovery fabricated no Stop evidence')

  // NEGATIVE CONTROL: a record that DID reach its execution fact is a closed record, and recovery
  // must leave it alone. Without this, "UNKNOWN" could be a blanket rewrite of every file it reads.
  const done = store.read(durableExecutionId('crash-done-1'))
  assert.equal(done.state, 'COMPLETED', 'a call that ended before the crash stays COMPLETED')
  assert.deepEqual(done.transitions.map((entry) => entry.to), ['ADMITTED', 'RUNNING', 'COMPLETED'])
  assert.equal(recovered.some((entry) => entry.executionId === durableExecutionId('crash-done-1')), false)

  // (3) NOT DROPPED: the durable side can still answer for the crashed call, and says it was ALLOWED.
  const observed = ledger.observe('crash-open-1')
  assert.equal(observed.state, 'KNOWN', 'the callId is not forgotten by the crash')
  assert.equal(observed.admission.decision, 'allow')

  // (4) NOT RE-EXECUTED: the same callId, through the product centre, in THIS fresh process.
  const fresh = await centreWorld('crash-readback', {
    binding: binding(),
    dir,
    ledger,
    store,
    identityOf: durableIdentityOf,
  })
  const replayExec = readExec('crash-open-1')
  const replayVerdict = await fresh.preExecute(replayExec)
  assert.equal(replayVerdict.kind, 'deny')
  assert.match(String(replayVerdict.reason), /ADMISSION_REPLAY/u)
  assert.match(String(fresh.guard(replayExec)), /ADMISSION_REPLAY/u)
  assert.equal(fresh.body.count, 0, 'a recovered call is never run a second time')
  const afterReplay = store.read(durableExecutionId('crash-open-1'))
  assert.equal(afterReplay.state, 'UNKNOWN', 'the replay refusal does not invent a terminal state either')
  assert.deepEqual(afterReplay.transitions.map((entry) => entry.to), ['ADMITTED', 'UNKNOWN'])
  const factsNow = ledger.readAll()
  assert.equal(factsNow.filter((entry) => entry.kind === 'invocation-authority' && entry.callId === 'crash-open-1').length, 1, 'one call, one authority record')
  assert.equal(factsNow.filter((entry) => entry.kind === 'execution' && entry.callId === 'crash-open-1').length, 0)
  assert.equal(factsNow.filter((entry) => entry.kind === 'replay-refusal' && entry.callId === 'crash-open-1').length, 1, 'the second attempt is itself recorded')

  // NEGATIVE CONTROL: a NEW callId in the SAME recovered world is admitted and completes, so the
  // refusal above is about the callId and not about a world the crash left broken.
  const newer = readExec('crash-new-1')
  assert.equal((await fresh.dispatch(newer)).kind, 'allow')
  assert.equal(fresh.body.count, 1)
  assert.equal(store.read(durableExecutionId('crash-new-1')).state, 'COMPLETED')

  // (5) IDEMPOTENT. A THIRD fresh store finds nothing left to recover, and the record files are
  // byte-identical: recovery is not a second writer that keeps "cleaning up".
  const openPath = settlementRecordPath(join(dir, 'settlement'), durableExecutionId('crash-open-1'))
  const donePath = settlementRecordPath(join(dir, 'settlement'), durableExecutionId('crash-done-1'))
  const bytes = { open: durableText(openPath), done: durableText(donePath) }
  const third = readBackStore(dir)
  assert.deepEqual(createSettlementWriter({ store: third, identityOf: durableIdentityOf }).recover(), [])
  assert.equal(durableText(openPath), bytes.open, 'a second recovery rewrites nothing')
  assert.equal(durableText(donePath), bytes.done)
  fresh.dispose()
})

test('ADM-80 — a callId with a durable fact is REFUSED on a second attempt in a FRESH process, before the body, and the ledger keeps ONE authority record', async () => {
  const dir = durableWorldDir('replay')
  const populate = runDurableChild(durablePlan(dir, [
    { callId: 'replay-1', filePath: '/work/a/doc.txt', mode: 'complete' },
  ], { exit: 0 }))
  assert.equal(populate.status, 0, `the populating process must exit cleanly (stderr: ${populate.stderr})`)
  assert.equal(populate.summary.results[0].verdict, 'allow')
  assert.equal(populate.summary.bodyCounts['replay-1'], 1)

  // THE SECOND PROCESS: same directory, same product composition, DIFFERENT pid. No settlement store
  // is opened here on purpose: the replay authority is the LEDGER, and a second writer on the same
  // settlement root would be measuring the writer lock, not replay.
  const second = runDurableChild(durablePlan(dir, [
    { callId: 'replay-1', filePath: '/work/a/doc.txt', mode: 'admit' },
    { callId: 'replay-new-1', filePath: '/work/a/doc.txt', mode: 'complete' },
  ], { store: false, exit: 0 }))
  assert.equal(second.status, 0, `the second process must not throw (stderr: ${second.stderr})`)
  assert.notEqual(second.summary.pid, populate.summary.pid, 'this is a DIFFERENT process, not another object in the first one')
  assert.notEqual(second.summary.pid, process.pid)
  const replay = second.summary.results.find((entry) => entry.callId === 'replay-1')
  assert.equal(replay.verdict, 'deny')
  assert.match(String(replay.reason), /ADMISSION_REPLAY/u)
  assert.equal(second.summary.bodyCounts['replay-1'], undefined, 'the replay must never reach the body')
  // NEGATIVE CONTROL: a NEW callId in the same second process is admitted and completes, so the
  // refusal is the callId's history and not "this process refuses everything".
  const freshCall = second.summary.results.find((entry) => entry.callId === 'replay-new-1')
  assert.equal(freshCall.verdict, 'allow')
  assert.equal(second.summary.bodyCounts['replay-new-1'], 1)
  assert.deepEqual(second.summary.faults, [], 'a replay is a decision, not a fault')

  // READ BACK FROM THE FILE by a FRESH ledger instance in THIS process.
  const back = readBackLedger(dir)
  const all = back.readAll()
  assert.equal(all.filter((entry) => entry.kind === 'invocation-authority' && entry.callId === 'replay-1').length, 1, 'one call, one authority record')
  assert.equal(all.filter((entry) => entry.kind === 'execution' && entry.callId === 'replay-1').length, 1, 'one call, one execution fact')
  const refusal = all.find((entry) => entry.kind === 'replay-refusal' && entry.callId === 'replay-1')
  assert.notEqual(refusal, undefined, 'the second attempt is itself a durable governance event')
  assert.match(String(refusal.reason), /ADMISSION_REPLAY/u)
  assert.equal(all.filter((entry) => entry.kind === 'invocation-authority' && entry.callId === 'replay-new-1').length, 1)

  // AND AT THE LEDGER ITSELF: a fresh instance refuses a second admission with its own code, and the
  // refusal appends NOTHING (a refused replay may not mutate the record it was refused by).
  const bytesBefore = durableText(join(dir, 'facts.jsonl'))
  assert.throws(
    () => back.recordAdmission({ callId: 'replay-1', toolName: 'read', decision: 'allow' }),
    (error) => error?.code === 'LEDGER_REPLAY',
  )
  assert.equal(durableText(join(dir, 'facts.jsonl')), bytesBefore, 'a refused replay writes nothing')
})

test('ADM-81 — a duplicate execution fact on disk is a REFUSAL, never "two answers" for one call', async () => {
  const dir = durableWorldDir('dup')
  const dupPath = join(dir, 'dup.jsonl')
  writeFileSync(dupPath, [
    JSON.stringify({ kind: 'invocation-authority', callId: 'dup-1', decision: 'allow', at: '2026-11-22T00:00:00.000Z' }),
    JSON.stringify({ kind: 'execution', callId: 'dup-1', outcome: 'completed', at: '2026-11-22T00:00:01.000Z' }),
    JSON.stringify({ kind: 'execution', callId: 'dup-1', outcome: 'failed', at: '2026-11-22T00:00:02.000Z' }),
    '',
  ].join('\n'))

  const corrupt = openFactLedger({ path: dupPath })
  assert.equal(corrupt.health().state, 'UNKNOWN', 'a ledger with two endings for one call cannot be trusted about anything')
  assert.equal(corrupt.health().reason, 'LEDGER_DUPLICATE_EXECUTION')
  assert.throws(() => corrupt.readAll(), (error) => error?.code === 'LEDGER_DUPLICATE_EXECUTION')
  assert.throws(() => corrupt.has('dup-1'), (error) => error?.code === 'LEDGER_DUPLICATE_EXECUTION', 'even a lookup must not answer from a corrupt file')

  // THROUGH THE CENTRE: a fault while reading an authority record is a REFUSAL, never "no opinion".
  const world = await centreWorld('dup-centre', {
    binding: binding(),
    dir,
    ledger: corrupt,
    store: createExecutionSettlementStore({ dir: join(dir, 'settlement') }),
  })
  const exec = readExec('dup-call-1')
  const verdict = await world.preExecute(exec)
  assert.equal(verdict.kind, 'deny')
  assert.match(String(verdict.reason), /ADMISSION_LEDGER_UNREADABLE/u)
  assert.match(String(verdict.reason), /two execution records on disk/u, "the ledger own reason survives into the refusal")
  assert.match(String(world.guard(exec)), /ADMISSION_LEDGER_UNREADABLE/u, 'both stages agree')
  assert.equal(world.faults.length, 1, 'the fault is REPORTED, not swallowed into an allow')
  assert.equal(world.faults[0][1].phase, 'replay-check')
  assert.equal(world.store.list().length, 0, 'no settlement record was invented for a call the ledger could not adjudicate')
  world.dispose()

  // NEGATIVE CONTROL: the same file with ONE execution fact is readable, and the centre admits a NEW
  // call. So the refusal above is about the contradiction, not about "a file that mentions execution".
  const okPath = join(dir, 'one.jsonl')
  writeFileSync(okPath, [
    JSON.stringify({ kind: 'invocation-authority', callId: 'dup-1', decision: 'allow', at: '2026-11-22T00:00:00.000Z' }),
    JSON.stringify({ kind: 'execution', callId: 'dup-1', outcome: 'completed', at: '2026-11-22T00:00:01.000Z' }),
    '',
  ].join('\n'))
  const okLedger = openFactLedger({ path: okPath })
  assert.equal(okLedger.health().state, 'KNOWN')
  assert.equal(okLedger.readAll().filter((entry) => entry.kind === 'execution').length, 1)
  const ok = await centreWorld('dup-ok', {
    binding: binding(),
    dir: join(dir, 'ok'),
    ledger: okLedger,
    store: createExecutionSettlementStore({ dir: join(dir, 'ok-settlement') }),
    identityOf: durableIdentityOf,
  })
  const accepted = await ok.dispatch(readExec('dup-new-1'))
  assert.equal(accepted.kind, 'allow')
  assert.equal(ok.body.count, 1)
  assert.equal(ok.store.read(durableExecutionId('dup-new-1')).state, 'COMPLETED')
  assert.equal(okLedger.readAll().filter((entry) => entry.callId === 'dup-new-1').map((entry) => entry.kind).sort().join(','), 'execution,invocation-authority')
  ok.dispose()
})

test('ADM-82 — a truncated or garbage ledger line is a REFUSAL, not an empty ledger and not "no opinion"', async () => {
  const dir = durableWorldDir('trunc')
  const good = JSON.stringify({ kind: 'invocation-authority', callId: 'kept-1', decision: 'allow', at: '2026-11-22T00:00:00.000Z' })
  const cases = [
    ['truncated-tail', `${good}\n{"kind":"invocation-autho`, 'LEDGER_TRUNCATED', /partially written record must not be read as authority/u],
    ['garbage-line', `${good}\nthis line is not json at all\n`, 'LEDGER_TRUNCATED', /is not valid JSON/u],
    ['no-call-id', `${good}\n${JSON.stringify({ kind: 'execution', outcome: 'completed' })}\n`, 'LEDGER_RECORD_INVALID', /has no callId/u],
  ]
  for (const [label, text, code, detail] of cases) {
    const path = join(dir, `${label}.jsonl`)
    writeFileSync(path, text)
    const back = openFactLedger({ path })
    assert.equal(back.health().state, 'UNKNOWN', `${label}: a half-readable authority record must fail closed`)
    assert.equal(back.health().reason, code, label)
    assert.throws(
      () => back.recordAdmission({ callId: `after-${label}`, toolName: 'read', decision: 'allow' }),
      (error) => error?.code === code,
      `${label}: a corrupt ledger must not start a second history beside the damaged one`,
    )
    const world = await centreWorld(`trunc-${label}`, {
      binding: binding(),
      dir: join(dir, label),
      ledger: back,
      store: createExecutionSettlementStore({ dir: join(dir, `${label}-settlement`) }),
    })
    const exec = readExec(`trunc-${label}-call`)
    const verdict = await world.preExecute(exec)
    assert.equal(verdict.kind, 'deny', `${label}: the call must be refused, never sent to the body`)
    assert.notEqual(verdict.kind, 'ask', `${label}: a fault is not an approval request`)
    assert.match(String(verdict.reason), /ADMISSION_LEDGER_UNREADABLE/u)
    assert.match(String(verdict.reason), detail, `${label}: the ledger's own reason survives into the refusal`)
    assert.match(String(world.guard(exec)), /ADMISSION_LEDGER_UNREADABLE/u, `${label}: both stages agree`)
    assert.equal(world.faults.length, 1)
    assert.equal(world.faults[0][1].phase, 'replay-check')
    assert.equal(world.store.list().length, 0, `${label}: a refused call gets no settlement record at all`)
    world.dispose()
  }

  // POSITIVE CONTROL: the same wiring over a COMPLETE ledger is readable and the centre admits.
  const goodPath = join(dir, 'good.jsonl')
  writeFileSync(goodPath, `${good}\n`)
  const goodLedger = openFactLedger({ path: goodPath })
  assert.equal(goodLedger.health().state, 'KNOWN')
  const ok = await centreWorld('trunc-good', {
    binding: binding(),
    dir: join(dir, 'good-world'),
    ledger: goodLedger,
    store: createExecutionSettlementStore({ dir: join(dir, 'good-settlement') }),
    identityOf: durableIdentityOf,
  })
  const accepted = await ok.dispatch(readExec('trunc-good-call'))
  assert.equal(accepted.kind, 'allow')
  assert.equal(ok.body.count, 1)
  assert.equal(ok.store.read(durableExecutionId('trunc-good-call')).state, 'COMPLETED')
  ok.dispose()
})

test('ADM-83 — an UNWRITABLE ledger is a REFUSAL (ADMISSION_LEDGER_UNWRITABLE), never an unrecorded run', async () => {
  const base = durableWorldDir('unwritable')
  const lockedDir = join(base, 'locked')
  mkdirSync(lockedDir, { recursive: true })
  chmodSync(lockedDir, 0o555)
  try {
    // PRECONDITION, asserted rather than assumed: if this process can still write there (a root run),
    // the arm would pass for the wrong reason, so the precondition fails loudly instead.
    let writable = false
    try {
      writeFileSync(join(lockedDir, 'probe'), 'x')
      writable = true
    } catch { writable = false }
    assert.equal(writable, false, 'PRECONDITION: the ledger directory must really be unwritable for this arm to mean anything')

    const back = openFactLedger({ path: join(lockedDir, 'facts.jsonl') })
    assert.equal(back.health().state, 'KNOWN', 'nothing on disk yet is a valid EMPTY ledger, not a corrupt one')
    const world = await centreWorld('unwritable', {
      binding: binding(),
      dir: join(base, 'world'),
      ledger: back,
      store: createExecutionSettlementStore({ dir: join(base, 'world-settlement') }),
    })
    const exec = readExec('unwritable-call-1')
    const verdict = await world.preExecute(exec)
    assert.equal(verdict.kind, 'deny', 'a decision nobody can record is not one the centre will run under')
    assert.notEqual(verdict.kind, 'ask')
    assert.match(String(verdict.reason), /ADMISSION_LEDGER_UNWRITABLE/u)
    assert.match(String(world.guard(exec)), /ADMISSION_LEDGER_UNWRITABLE/u, 'both stages agree')
    assert.equal(world.faults.length, 1, 'the write fault is reported')
    assert.equal(world.faults[0][1].phase, 'record')
    assert.equal(world.store.list().length, 0, 'no settlement record claims an admission that was never written')
    assert.equal(readdirSync(lockedDir).includes('facts.jsonl'), false, 'nothing was written to the unwritable directory')
    world.dispose()
  } finally {
    chmodSync(lockedDir, 0o755)
  }

  // POSITIVE CONTROL: the same wiring, same call shape, writable directory -> recorded and completed.
  const okDir = join(base, 'writable')
  mkdirSync(okDir, { recursive: true })
  const ok = await centreWorld('writable', {
    binding: binding(),
    dir: join(base, 'ok-world'),
    ledger: openFactLedger({ path: join(okDir, 'facts.jsonl') }),
    store: createExecutionSettlementStore({ dir: join(base, 'ok-settlement') }),
    identityOf: durableIdentityOf,
  })
  const accepted = await ok.dispatch(readExec('unwritable-call-2'))
  assert.equal(accepted.kind, 'allow')
  assert.equal(ok.body.count, 1)
  assert.equal(ok.store.read(durableExecutionId('unwritable-call-2')).state, 'COMPLETED')
  assert.deepEqual(ok.ledger.readAll().map((entry) => entry.kind), ['invocation-authority', 'execution'])
  ok.dispose()
})

test('ADM-84 — a settlement left OPEN by a crash is CLASSIFIED from disk as UNKNOWN with what is missing, and no terminal state is invented', async () => {
  const dir = durableWorldDir('cold')
  const crash = runDurableChild(durablePlan(dir, [
    { callId: 'cold-refused-1', filePath: '/etc/passwd', mode: 'complete' },
    { callId: 'cold-admitted-1', filePath: '/work/a/doc.txt', mode: 'admit' },
    { callId: 'cold-running-1', filePath: '/work/a/doc.txt', mode: 'guard' },
  ], { exit: 7 }))
  assert.equal(crash.status, 7, `the writer must die abruptly (stderr: ${crash.stderr})`)
  const modes = Object.fromEntries(crash.summary.results.map((entry) => [entry.callId, entry.verdict]))
  assert.equal(modes['cold-refused-1'], 'deny', 'the refusal is a decision the dead process already made')
  assert.equal(modes['cold-admitted-1'], 'allow')
  assert.equal(modes['cold-running-1'], 'allow')
  assert.equal(crash.summary.bodyCounts['cold-running-1'], 1, 'the RUNNING record belongs to a call whose body started')

  const store = readBackStore(dir)
  const refused = store.read(durableExecutionId('cold-refused-1'))
  const admitted = store.read(durableExecutionId('cold-admitted-1'))
  const running = store.read(durableExecutionId('cold-running-1'))
  assert.equal(refused.state, 'REFUSED', 'a refusal is terminal at birth: it was CLOSED before the crash')
  assert.equal(admitted.state, 'ADMITTED', 'open between the admission and the body')
  assert.equal(running.state, 'RUNNING', 'open after the body started')
  assert.equal(running.observation.dispatch, 'started')

  const recovered = createSettlementWriter({ store, identityOf: durableIdentityOf }).recover()
  assert.deepEqual(
    recovered.map((entry) => entry.executionId).sort(),
    [durableExecutionId('cold-admitted-1'), durableExecutionId('cold-running-1')].sort(),
    'exactly the OPEN records - and not the refusal that was already classified',
  )
  const byId = new Map(recovered.map((entry) => [entry.executionId, entry]))
  const recAdmitted = byId.get(durableExecutionId('cold-admitted-1'))
  const recRunning = byId.get(durableExecutionId('cold-running-1'))
  assert.equal(recAdmitted.before, 'ADMITTED')
  assert.equal(recAdmitted.after, 'UNKNOWN')
  assert.equal(recRunning.before, 'RUNNING')
  assert.equal(recRunning.after, 'UNKNOWN')

  const admittedAfter = store.read(durableExecutionId('cold-admitted-1'))
  const runningAfter = store.read(durableExecutionId('cold-running-1'))
  assert.deepEqual(admittedAfter.transitions.map((entry) => entry.to), ['ADMITTED', 'UNKNOWN'])
  assert.deepEqual(runningAfter.transitions.map((entry) => entry.to), ['ADMITTED', 'RUNNING', 'UNKNOWN'])
  for (const record of [admittedAfter, runningAfter]) {
    assert.equal(record.state, 'UNKNOWN', 'the ONLY state recovery may write here')
    assert.notEqual(record.state, 'COMPLETED')
    assert.notEqual(record.state, 'FAILED')
    assert.notEqual(record.state, 'REFUSED')
    assert.notEqual(record.state, 'CANCELLED')
    assert.match(String(record.terminalReason), /PROCESS_TERMINATED_WITHOUT_OUTCOME/u)
    assert.equal(record.observation.bodyOutcome, 'unknown')
    assert.equal(record.observation.effectEvidence, 'unknown')
    assert.deepEqual(record.stops, [], 'no Stop was invented to justify a terminal state')
  }
  // Recovery does NOT rewrite what the dead process observed: the phase it reached is still readable.
  assert.equal(admittedAfter.observation.dispatch, 'not-started')
  assert.equal(runningAfter.observation.dispatch, 'started')
  // ...and the missing evidence is DERIVED from that phase, not a fixed template.
  assert.equal(admittedAfter.missingEvidence.includes('dispatch-confirmation'), true)
  assert.equal(runningAfter.missingEvidence.includes('dispatch-confirmation'), false)
  assert.equal(runningAfter.missingEvidence.includes('host-result'), true)
  assert.equal(admittedAfter.missingEvidence.includes('host-result'), false)

  // NEGATIVE CONTROL: a decision the dead process DID make is not re-classified. The refusal stays
  // REFUSED and is not swept into UNKNOWN with the open records.
  const refusedAfter = store.read(durableExecutionId('cold-refused-1'))
  assert.equal(refusedAfter.state, 'REFUSED')
  assert.equal(recovered.some((entry) => entry.executionId === durableExecutionId('cold-refused-1')), false)

  // NEGATIVE CONTROL, "no invented terminal": the store will not re-drive the classified record into
  // a success. UNKNOWN is terminal; a later COMPLETED is a conflict, not an overwrite.
  const writer = createSettlementWriter({ store, identityOf: durableIdentityOf })
  assert.throws(
    () => writer.settled({ exec: { name: 'read', callId: 'cold-running-1' }, outcome: 'completed' }),
    (error) => error?.code === 'SETTLEMENT_CONFLICT',
    'an UNKNOWN record must not be promoted to COMPLETED after the fact',
  )

  // IDEMPOTENT, and byte-identical on disk: a THIRD fresh store finds nothing left to recover.
  const paths = {
    admitted: settlementRecordPath(join(dir, 'settlement'), durableExecutionId('cold-admitted-1')),
    running: settlementRecordPath(join(dir, 'settlement'), durableExecutionId('cold-running-1')),
    refused: settlementRecordPath(join(dir, 'settlement'), durableExecutionId('cold-refused-1')),
  }
  const bytes = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, durableText(path)]))
  const third = readBackStore(dir)
  assert.deepEqual(createSettlementWriter({ store: third, identityOf: durableIdentityOf }).recover(), [])
  for (const [key, path] of Object.entries(paths)) assert.equal(durableText(path), bytes[key], `${key}: recovery must not keep rewriting the record`)
})

// ============================================================================================
// C stage (round 55): the three capabilities that have no member I/O axis.
//
// The centre's law is "an unwired controlled call is refused with a code that names why". Remote,
// Alpha.6 review routing and PTC escalation were the three rows that were neither wired nor named:
// each had real machinery and no axis, which is the one state the cut must not leave behind, because
// «silently absent» is indistinguishable from «working» in every log that does not mention it.
//
// Both states are proved here, on the product's own modules:
//  - C-remote (ROUND 74: PER COMMAND, not per surface) and C-alpha6: the host-surface refusal point
//    (the SAME product recorder `root.ts` wires) records the refusal with the product fact ledger and
//    the product settlement store, and the surface body is NOT run. For remote the unit is the
//    COMMAND: the governed dispatcher serves the control-plane commands and refuses only the
//    agent-execution ones (the ONE closed table in `s6-command-classification.ts`). The point is
//    undefined exactly when the row never configured the centre — the same world in which no command
//    is refused, which is what makes the refusal meaningful rather than a permanently broken fixture.
//  - C-ptc: the real centre composition (`installMemberCentre` over the product ledger/store) refuses
//    `run_code` with a PTC-specific code BEFORE the body, records it on `process.exec`, and settles
//    REFUSED/not-started. `bash` keeps the generic process-axis code, so the two absences stay
//    distinguishable (the task's "not one generic unavailable").
// ============================================================================================

const hostSurfaceWorld = async (label) => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { createHostSurfaceRefusalPoint } = await import('../src/plugin/vnext/host-surface-refusal.mjs')
  const { createExecutionSettlementStore } = await import('../settlement/execution-settlement.ts')
  const dir = mkdtempSync(join(tmpdir(), `vnext-host-surface-${label}-`))
  const ledger = openFactLedger({ path: join(dir, 'facts.jsonl') })
  const store = createExecutionSettlementStore({ dir: join(dir, 'settlement') })
  const faults = []
  const identityOf = (exec) => ({
    executionId: dispatchExecutionId({ rootSessionId: 'root-host-surface', agentInstanceId: 'host-surface' }, exec.callId),
    actorId: 'host-surface',
    worldId: 'session-host-surface',
  })
  const point = (capability) => createHostSurfaceRefusalPoint({
    capability,
    ledger,
    store,
    identityOf,
    onFault: (error, context) => faults.push([error, context]),
  })
  return { dir, ledger, store, faults, identityOf, point }
}

test('ADM-85 — C-alpha6 is EXPLICITLY UNAVAILABLE: the decision is refused before the wake, recorded, and settled REFUSED/not-started', async () => {
  const { refuseHostSurfaceBefore, HOST_SURFACE_REFUSALS } = await import('../src/plugin/vnext/host-surface-refusal.mjs')
  const world = await hostSurfaceWorld('alpha6')
  const wake = { count: 0 }
  // POSITIVE CONTROL, same helper: with no point (the row never asked for the centre) the surface is
  // NOT refused, and the wake runs. The refusal below is therefore the governance gate, not a broken
  // always-false fixture.
  const ungated = refuseHostSurfaceBefore(undefined, { subject: 'alpha6.review-routing', owner: 'root-host-surface' })
  assert.equal(ungated, false)
  if (!ungated) wake.count += 1
  assert.equal(wake.count, 1, 'an ungoverned row keeps its Alpha.6 wake')

  // THE REFUSAL. This is the exact call shape the root composition makes: a review-routing decision
  // for one leg, on a row that configured the centre.
  const refused = refuseHostSurfaceBefore(world.point('alpha6'), {
    subject: 'alpha6.review-routing',
    owner: 'root-host-surface',
    locator: 'session-officer-1',
    detail: 'leg L-1',
  })
  assert.equal(refused, true, 'a governed row must NOT run the review-routing surface')
  if (!refused) wake.count += 1
  assert.equal(wake.count, 1, 'ZERO side effects: no wake was dispatched after the refusal')
  assert.equal(world.faults.length, 0, 'the refusal was recorded cleanly')

  // The FACT: one invocation-authority record, on the subject's own existing axis, carrying the code.
  const records = world.ledger.readAll().filter((record) => record.kind === 'invocation-authority')
  assert.equal(records.length, 1)
  const fact = records[0]
  assert.equal(fact.decision, 'deny')
  assert.equal(fact.refusalCode, 'ADMISSION_ALPHA6_UNAVAILABLE')
  assert.equal(fact.axis, 'host.service', 'the record says which of the EXISTING axes the subject belongs to')
  assert.equal(fact.toolName, 'alpha6.review-routing')
  assert.equal(fact.locator, 'session-officer-1')
  assert.match(String(fact.reason), /no review-routing axis/u, 'the reason names the missing axis, not "unavailable"')
  // The SETTLEMENT: the product store closed the record REFUSED, and it never left ADMITTED.
  const settled = world.store.read(world.identityOf({ callId: fact.callId }).executionId)
  assert.equal(settled.state, 'REFUSED')
  assert.equal(settled.observation.dispatch, 'not-started')
  assert.equal(settled.observation.bodyOutcome, 'not-started')

  // The CONFIG gate and the recorded gate name the SAME absence with the same code.
  const { centreConfigViolation } = await import('../src/plugin/vnext/centre-config.ts')
  assert.match(String(centreConfigViolation({ alpha6ReviewRouting: true, centreStatePath: '/srv/centre' })), new RegExp(HOST_SURFACE_REFUSALS.alpha6.code, 'u'))
})

test('ADM-86 — ROUND 74: a governed row serves the S6 CONTROL PLANE and refuses AGENT-EXECUTION commands with the existing typed code, recorded on team.control and settled REFUSED', async () => {
  const { HOST_SURFACE_REFUSALS } = await import('../src/plugin/vnext/host-surface-refusal.mjs')
  const { createS6RemoteDispatcher } = await import('../src/plugin/s6-remote.ts')
  const { REMOTE_METHOD_NAMES } = await import('../../remote/src/contracts/catalog.ts')
  const {
    S6_AGENT_EXECUTION_COMMANDS,
    S6_CLASSIFIED_COMMANDS,
    S6_CONTROL_PLANE_COMMANDS,
    isS6ControlPlaneCommand,
    s6CommandEffectOf,
  } = await import('../src/plugin/s6-command-classification.ts')

  // 1. THE CLOSED TABLE, PINNED IN BOTH DIRECTIONS.
  // Every frozen catalog method is classified (a catalog addition cannot silently fall through), and
  // the classification table carries no method the catalog does not know.
  assert.deepEqual(
    [...S6_CLASSIFIED_COMMANDS].sort(),
    [...REMOTE_METHOD_NAMES].sort(),
    'the closed S6 effect table and the frozen remote catalog must be the SAME set',
  )
  for (const method of REMOTE_METHOD_NAMES) {
    assert.notEqual(s6CommandEffectOf(method), undefined, `${method}: every catalog method needs an effect class`)
  }
  // The refused set is pinned LITERALLY (a widened allow set turns this red).
  assert.deepEqual(
    [...S6_AGENT_EXECUTION_COMMANDS],
    ['member.create', 'member.followup', 'member.send', 'team.admitInitialWork', 'team.ensureRootLive'],
    'the agent-execution set is the closed refusal list: dispatch a native tool / shell / agent I/O',
  )
  // And every other catalog command is control-plane — no third bucket, no silent gap.
  assert.deepEqual(
    [...S6_CONTROL_PLANE_COMMANDS],
    [...REMOTE_METHOD_NAMES].filter((method) => S6_AGENT_EXECUTION_COMMANDS.includes(method) === false).sort(),
    'every non-refused catalog command is control-plane',
  )
  // A NEW command cannot default to allowed: there is no fallback branch.
  assert.equal(s6CommandEffectOf('team.executeNativeTool'), undefined, 'an unclassified command has NO effect class')
  assert.equal(isS6ControlPlaneCommand('team.executeNativeTool'), false, 'an unclassified command is REFUSED, never default-allowed')
  assert.equal(isS6ControlPlaneCommand('member.send'), false)
  assert.equal(isS6ControlPlaneCommand('team.create'), true, 'creation is a control-plane command')
  assert.equal(isS6ControlPlaneCommand('team.getProjection'), true, 'a team read is a control-plane command')

  // 2. THE GOVERNED DISPATCHER: control plane served, agent execution refused BEFORE the handler.
  const world = await hostSurfaceWorld('remote')
  const point = world.point('remote')
  const called = []
  // Deliberately NO messaging/member/admission ports: a refused command must never reach one, so a
  // missing port would be a TypeError rather than a green. `catalog.list` is the served control arm.
  const ports = { catalog: { list: async () => { called.push('catalog.list'); return [] } } }
  const principal = () => ({ kind: 'human', humanId: 'operator' })
  const refusals = []
  const dispatcher = createS6RemoteDispatcher(ports, principal, undefined, (method) => {
    refusals.push(method)
    return point.refuse({
      subject: `remote.command:${method}`,
      owner: 'root-host-surface',
      locator: 'root-host-surface',
      detail: method,
    }).admission
  })

  const served = await dispatcher('catalog.list', { version: 1, params: {} })
  assert.equal(served.ok, true, `a control-plane read must be served, got ${JSON.stringify(served)}`)
  assert.deepEqual(called, ['catalog.list'])
  assert.deepEqual(refusals, [], 'the refusal hook is never consulted for a control-plane command')

  const refused = await dispatcher('member.send', { version: 1, params: {} })
  assert.equal(refused.ok, false)
  assert.equal(refused.error.code, HOST_SURFACE_REFUSALS.remote.code, 'the typed wire code is the EXISTING host-surface code')
  assert.match(String(refused.error.message), /explicitly unavailable/u, 'the wire message names the refusal')
  assert.equal(refused.error.details.reason, 'domain-error', 'invariant 4b stamps the vocabulary pass-through reason')
  assert.deepEqual(refusals, ['member.send'])
  assert.deepEqual(called, ['catalog.list'], 'ZERO side effects: no handler/port/agent path ran for the refused command')

  // 3. THE REFUSAL IS DURABLE (fact + settlement), the same shape as the other host-surface refusals.
  const fact = world.ledger.readAll().find(
    (record) => record.kind === 'invocation-authority' && record.toolName === 'remote.command:member.send',
  )
  assert.notEqual(fact, undefined, 'the refused command must leave an invocation-authority fact')
  assert.equal(fact.decision, 'deny')
  assert.equal(fact.refusalCode, 'ADMISSION_REMOTE_UNAVAILABLE')
  assert.equal(fact.axis, 'team.control', 'a remote command belongs to the team control plane, not to an invented axis')
  assert.match(String(fact.reason), /member Binding for UTE/u, 'the reason names the missing member binding/axis')
  const settled = world.store.read(world.identityOf({ callId: fact.callId }).executionId)
  assert.equal(settled.state, 'REFUSED')
  assert.equal(settled.observation.dispatch, 'not-started')

  // 4. UNAUTHENTICATED: without the connection-gate authority basis EVERY command is refused before
  // the effect guard, the params and any port — the same fail-closed principal context as before.
  const unauthenticated = createS6RemoteDispatcher(ports, principal, {})
  const denied = await unauthenticated('catalog.list', { version: 1, params: {} })
  assert.equal(denied.ok, false)
  assert.equal(denied.error.code, 'TEAM_REMOTE_PRINCIPAL_INVALID', 'an unauthenticated request cannot reach a command at all')
  assert.deepEqual(called, ['catalog.list'], 'the unauthenticated request reached no port')
  assert.deepEqual(refusals, ['member.send'], 'the unauthenticated request reached no guard/handler')

  // The three host-surface codes stay distinct BY CONSTRUCTION (the closed table), not by a comment.
  const codes = [HOST_SURFACE_REFUSALS.remote.code, HOST_SURFACE_REFUSALS.alpha6.code, HOST_SURFACE_REFUSALS.ptc.code]
  assert.equal(new Set(codes).size, 3, `the capabilities must be individually identifiable, got ${codes.join(', ')}`)
})

test('ADM-87 — C-ptc is EXPLICITLY UNAVAILABLE at the ONE centre: run_code is refused by its own code, recorded and settled, before the body', async () => {
  const world = await centreWorld('ptc', { binding: binding() })
  // POSITIVE CONTROL: the same world admits an in-lane read, runs its body and settles COMPLETED.
  const read = await world.dispatch(readExec('ptc-read-1'))
  assert.equal(read.kind, 'allow')
  assert.equal(world.body.count, 1)
  assert.equal(world.store.read(world.executionIdOf(readExec('ptc-read-1'))).state, 'COMPLETED')

  // THE REFUSAL: `run_code` is the PTC entry. It never reaches the body.
  const exec = { name: 'run_code', callId: 'ptc-call-1', arguments: { command: 'ls' }, agent: { id: 'agent-1' }, turn: 1, step: 1 }
  const verdict = await world.dispatch(exec)
  assert.equal(verdict.kind, 'deny')
  assert.match(String(verdict.reason), /ADMISSION_PTC_UNAVAILABLE/u, 'the pre-execute stage names the PTC code')
  assert.equal(world.body.count, 1, 'ZERO side effects: the body count did not move')
  // Both stages agree BY CONSTRUCTION: the guard is only reached when pre-execute returned allow, and
  // this call never gets there. Re-driving it after the dispatch would be a replay, which is its own
  // refusal (ADM-20) - so the arm does not mistake a replay for a second opinion.

  // FACT: the ONE admission record for the call, on the process axis (the axis PTC executes on).
  const fact = world.admissionFact('ptc-call-1')
  assert.equal(fact.decision, 'deny')
  assert.equal(fact.refusalCode, 'ADMISSION_PTC_UNAVAILABLE')
  assert.equal(fact.axis, 'process.exec')
  assert.match(String(fact.reason), /PTC entry/u)
  assert.match(String(fact.reason), /second execution authority/u, 'the reason names the escalation row, not just the missing lane')

  // SETTLEMENT: REFUSED, not-started, never UNKNOWN (the body provably never ran).
  const settled = world.store.read(world.executionIdOf(exec))
  assert.equal(settled.state, 'REFUSED')
  assert.equal(settled.observation.dispatch, 'not-started')
  assert.equal(settled.observation.bodyOutcome, 'not-started')

  // DISTINCT: a plain shell with no compiled execution authorization keeps the EXECUTION code, so a
  // reader can tell the two absences apart from the durable record alone.
  const shell = { name: 'bash', callId: 'ptc-bash-1', arguments: { command: 'ls' }, agent: { id: 'agent-1' }, turn: 1, step: 1 }
  const shellVerdict = await world.dispatch(shell)
  assert.equal(shellVerdict.kind, 'deny')
  assert.match(String(shellVerdict.reason), /ADMISSION_EXECUTION_UNAUTHORIZED/u)
  assert.doesNotMatch(String(shellVerdict.reason), /ADMISSION_PTC_UNAVAILABLE/u, 'the two absences stay distinguishable in the refusal itself')
  assert.equal(world.body.count, 1)
  world.dispose()
})

test('ADM-88 — the capability table is CLOSED, each refusal names its own missing axis, and no code is generic', async () => {
  const { HOST_SURFACE_REFUSALS, HOST_SURFACE_CAPABILITIES, hostSurfaceRefusal } = await import('../src/plugin/vnext/host-surface-refusal.mjs')
  assert.deepEqual([...HOST_SURFACE_CAPABILITIES], ['remote', 'alpha6', 'ptc'])
  for (const capability of HOST_SURFACE_CAPABILITIES) {
    const entry = HOST_SURFACE_REFUSALS[capability]
    assert.match(entry.code, /^ADMISSION_[A-Z0-9_]+_UNAVAILABLE$/u)
    assert.notEqual(entry.code, 'ADMISSION_AXIS_UNSUPPORTED', 'a capability-specific absence must not collapse into the generic code')
    const refusal = hostSurfaceRefusal(capability)
    assert.equal(refusal.kind, 'deny')
    assert.equal(refusal.code, entry.code)
    assert.match(refusal.reason, /explicitly unavailable/u)
    assert.match(refusal.reason, new RegExp(entry.missing.slice(0, 24).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), 'the reason carries the measured missing axis')
    // The axis it records is an EXISTING one — this module invents no axis.
    assert.equal(['team.control', 'host.service', 'process.exec'].includes(entry.axis), true, `${capability}: ${entry.axis}`)
  }
  assert.throws(() => hostSurfaceRefusal('mcp'), (error) => /closed table/u.test(error.message), 'a new capability cannot be refused by being forgotten')
})

// ================================================ C STAGE (round 56): C-tools / C-member / C-work OVER THE ONE CENTRE
//
// WHAT WAS UNPROVEN. The 15 `team_*` tools are CENTRE-OWNED: `CENTRE_TOOL_NAMES` admits them on
// `team.control`, not on an fs/net/process lane, because their authority is enforced INSIDE the team
// (Leader-only checks, the ControlService, work delivery). ADM-31 pinned only that CLOSED LIST. No arm
// drove the product's OWN tool surface through the centre, so C-tools/C-member/C-work stood at
// "MECHANISM (unverified end to end)".
//
// WHAT IS REAL HERE, layer by layer (and what is a HOST STAND-IN, named, never silent):
//
//  * the TOOL SURFACE: `createTeamTools` — the factory `root.ts` fills `teamToolsRef.current` with —
//    over the REAL `createTeamRuntime` facade, the REAL `TeamDomain` (durable scratch world, real
//    repositories), the REAL `ControlService`, the REAL messaging coordinator and activity ledger.
//    Every create / archive / delegate / collect below runs the tool's OWN `execute` body.
//  * the CENTRE: `installMemberCentre` (the ONE composition point) for the Leader and
//    `installMemberExecution` (the product member composition: binding, durable fact ledger, per-member
//    settlement store, crash recovery, native-mount lifecycle) for every member. No admission point is
//    installed by hand and no lane is rebuilt: the binding is `bindingFromCompiledMember`'s projection.
//  * the FACTS and the SETTLEMENTS: read back from DISK through FRESH ledger/store objects.
//  * HOST STAND-INS (the parts a boot would supply, each carrying NO policy and deciding nothing):
//    (a) the agent-context double runs the host's own dispatch ORDER (pre-execute waterfall -> guard ->
//    body -> `tools/result`); (b) a member's "live agent handle" is an object whose `dispose()` runs the
//    disposers `installMemberExecution` registered — exactly what `agent-bindings.mjs` does
//    (`onDispose: (dispose) => toolDisposers.push(dispose)`) and what the lifecycle's
//    `release-residency` step calls; (c) the child-session factory is where a created member's centre is
//    installed, i.e. the product's member-bind moment; (d) the work delivery port is the host's
//    session-input seam. The compiled member answer is an INPUT (a ceiling), not a decision.
//
// WHAT THIS DOES NOT PROVE: no host boot, so NO ROW BECOMES PRODUCT-PROVEN. The archived member's
// PRODUCT ROUTE refuses at the durable lifecycle gate before the centre is reached; what these arms
// prove is the centre's own tombstone on the member's layer, which is the guarantee the row names.

const C_LEADER = 'inst-leader'

/** The arm's compiled-answer INPUT for one member (the shape `installMemberExecution` consumes). */
const cCompiledAnswer = ({ instanceId, templateId, revision, read, write }) => ({
  members: [{
    identity: { instanceId, instanceGeneration: 1 },
    definitionSource: '@deepseek-ai/dsh-tool-fs',
    policy: {
      ok: true,
      value: {
        memberIdentity: instanceId,
        templateId,
        instanceGeneration: 1,
        revision,
        read: lane(read),
        write: lane(write),
        network: { access: 'deny' },
      },
    },
  }],
})

/**
 * The host's dispatch order, as one double: every pre-execute listener in order, then the guard, then
 * the body, then `tools/result`. It decides nothing — it is the HOST, and the verdicts come from the
 * centre installed on the same ctx.
 */
const cHost = () => {
  const listeners = { pre: [], result: [] }
  let guardFn
  const ctx = {
    get: (name) => (name === 'tools'
      ? { guard (fn) { guardFn = fn; return () => { guardFn = undefined } } }
      : undefined),
    on: (event, fn) => {
      const target = event === 'tools/pre-execute' ? listeners.pre : event === 'tools/result' ? listeners.result : undefined
      if (target === undefined) return () => {}
      target.push(fn)
      return () => {
        const at = target.indexOf(fn)
        if (at >= 0) target.splice(at, 1)
      }
    },
  }
  return {
    ctx,
    preExecute: async (exec) => {
      const chain = listeners.pre.slice()
      const step = async (index) => (index >= chain.length ? { kind: 'allow' } : chain[index](exec, () => step(index + 1)))
      return await step(0)
    },
    guard: (exec) => (guardFn === undefined ? undefined : guardFn(exec)),
    result: (exec, outcome) => {
      for (const handler of listeners.result.slice()) handler(exec, outcome)
    },
  }
}

/**
 * Build ONE C-stage assembly: the durable TeamDomain world + the real satellite set + the product tool
 * surface + the Leader's centre + a centre per member (seeded members at build time, created members at
 * the child-session factory). The lifecycle STEP ports are installed, so archive runs the production
 * quiesce-then-commit procedure and `release-residency` disposes the member's handle.
 */
const cStage = async (label, options = {}) => {
  const { existsSync, mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { createP6T2World, p6t2Seed, P6T2_ROOT, P6T2_NOW, P6T2_SEEDS, createFakeLifecycleCommitPort, TEST_STATIC_MODEL } = await import('./p6t2-helpers.ts')
  const { destroyP6T1World } = await import('./p6t1-helpers.ts')
  const { scratchDir, destroyDir } = await import('../../testkit/fault-injection/file-seam.mjs')
  const { createTeamTools } = await import('../../tools/src/index.ts')
  const { createP6T6CallerMap, createFakeSessionInput } = await import('../../tools/test/p6t6-helpers.ts')
  const { createTeamRuntime } = await import('../action-router/index.ts')
  const { createControlService } = await import('../control/index.ts')
  const { createMessagingCoordinator } = await import('../messaging/index.ts')
  const { createActivityLedger, createWorkActivityWriter } = await import('../activity/index.ts')
  const { installMemberExecution } = await import('../src/plugin/vnext/member-execution.mjs')
  const { createExecutionSettlementStore } = await import('../settlement/execution-settlement.ts')
  const { dispatchExecutionId } = await import('../settlement/dispatch-settlement.ts')

  const root = String(P6T2_ROOT)
  const worker = String(P6T2_SEEDS.worker.instanceId)
  // The p6t1 world uses a DETERMINISTIC scratch dir per basename, so a killed run must not poison the
  // next one: the dir is removed first and in `destroy()`.
  destroyDir(scratchDir(label))
  // C11 (projection): the PRODUCTION boot world seeds the LEADER row with its own child session equal
  // to the ROOT session — the durable read port documents and normalizes exactly that shape
  // (`projection-source.ts` `memberRowsOf`, the `childSessionId === root` structural leader branch),
  // and the frozen DTO contract REJECTS a LeaderInstance carrying any other child session
  // (invariant 14). The P6-T2 fixture seeds a synthetic leader child id instead (its satellite worlds
  // never project), so the projection arms ask the fixture for the PRODUCTION shape rather than
  // teaching the projection to tolerate a shape production never writes. Nothing else changes: the
  // same leader row, same instance id, same satellite wiring — only the child session id it is seeded
  // with (the store has no update path, so it must be seeded right the first time).
  const world = options.leaderChildSessionIsRoot === true
    ? await createP6T2World(label, (options.seed ?? ['leader', 'worker']).filter((name) => name !== 'leader'), {
        seedMembers: [p6t2Seed('leader', { childSessionId: root })],
      })
    : await createP6T2World(label, options.seed ?? ['leader', 'worker'])
  const dir = mkdtempSync(join(tmpdir(), `${label}-`))
  const centreStatePath = dir

  const toolsById = new Map()
  const members = new Map()
  const handles = new Map()
  const bodies = []
  const deliveries = []
  const commits = createFakeLifecycleCommitPort(world)
  let sequence = 0

  /** Install ONE member's centre through the PRODUCT composition, and register its handle. */
  const installMember = async (member) => {
    if (members.has(member.instanceId)) return members.get(member.instanceId)
    const host = cHost()
    const disposers = []
    const files = join(centreStatePath, `${member.instanceId}.facts.jsonl`)
    const entry = { ...member, host, disposers, files }
    members.set(member.instanceId, entry)
    handles.set(member.childSessionId, {
      async dispose () { for (const dispose of disposers.reverse()) dispose() },
    })
    entry.state = await installMemberExecution({
      agentCtx: host.ctx,
      realm: {},
      compiledAnswer: cCompiledAnswer({
        instanceId: member.instanceId,
        templateId: member.templateId,
        revision: `rev-${member.instanceId}`,
        read: options.memberLane ?? ['/work/member'],
        write: options.memberLane ?? ['/work/member'],
      }),
      config: { centreStatePath },
      sessionId: member.childSessionId,
      instanceId: member.instanceId,
      teamRoot: root,
      workspaceRoot: '/work',
      onDispose: (dispose) => disposers.push(dispose),
      onNativeDispose: () => {},
      observe: () => {},
    })
    return entry
  }

  // ── the Leader's centre: the ONE composition point over its own durable ledger + settlement store ──
  const leaderHost = cHost()
  const leaderLedgerPath = join(centreStatePath, `${C_LEADER}.facts.jsonl`)
  const leaderLedger = openFactLedger({ path: leaderLedgerPath })
  const leaderStore = createExecutionSettlementStore({ dir: join(centreStatePath, 'settlement', C_LEADER) })
  const leaderBinding = bindingFromCompiledMember({
    member: cCompiledAnswer({
      instanceId: C_LEADER,
      templateId: 'leader',
      revision: `rev-${C_LEADER}`,
      read: options.leaderLane ?? ['/work', '/work/member'],
      write: options.leaderLane ?? ['/work', '/work/member'],
    }).members[0],
    agentId: C_LEADER,
    instanceId: C_LEADER,
    sessionId: root,
    workspaceRoot: '/work',
    owner: root,
  })
  let currentBinding = leaderBinding
  const leaderIdentity = (exec) => ({
    executionId: dispatchExecutionId({ rootSessionId: root, agentInstanceId: C_LEADER }, exec.callId),
    actorId: C_LEADER,
    worldId: root,
  })
  installMemberCentre({
    ctx: leaderHost.ctx,
    binding: leaderBinding,
    resolveBinding: () => currentBinding,
    recordAdmission: (fact) => leaderLedger.recordAdmission(fact),
    recordExecution: (fact) => leaderLedger.recordExecution(fact),
    isReplay: (callId) => leaderLedger.has(callId),
    recordReplay: (input) => leaderLedger.recordReplayRefusal(input),
    store: leaderStore,
    identityOf: leaderIdentity,
  })

  // ── a created member's centre at the CHILD SESSION FACTORY (the product's member-bind moment) ─────
  const factory = world.childFactory
  const originalCreate = factory.createChildSession.bind(factory)
  factory.createChildSession = async (request) => {
    const made = await originalCreate(request)
    const instanceId = String(request.instanceId)
    if (!members.has(instanceId)) {
      await installMember({ instanceId, childSessionId: String(made.childSessionId), templateId: String(request.templateId) })
    }
    return made
  }

  // ── a seeded member is bound at BOOT (its row exists before any tool call) ────────────────────────
  if (options.seedCentres !== false) {
    for (const row of world.domain.repositories.memberInstances.list(root)) {
      const instanceId = String(row.instanceId)
      if (instanceId === C_LEADER || String(row.lifecycle) === 'DISPOSED' || row.childSessionId === undefined) continue
      await installMember({ instanceId, childSessionId: String(row.childSessionId), templateId: String(row.templateId) })
    }
  }

  // ── the satellites + the product tool surface ─────────────────────────────────────────────────────
  const deliveryBody = options.deliveryBody ?? 'C-STAGE-MEMBER-BODY'
  const workDelivery = {
    async deliver (args) {
      deliveries.push({ requestToken: String(args.requestToken), prompt: args.prompt })
      return { requestToken: String(args.requestToken), status: 'succeeded', body: deliveryBody }
    },
  }
  const residency = {
    has: (sessionId) => handles.has(String(sessionId)),
    hasResidency: (sessionId) => handles.has(String(sessionId)),
    dropResidency (sessionId) {
      const handle = handles.get(String(sessionId))
      if (handle === undefined) return false
      handles.delete(String(sessionId))
      // The sync port cannot await; the handle's dispose runs the centre's LIFECYCLE CLOSE synchronously
      // (ADM-59: the point stays installed in its closed mode and refuses with ADMISSION_MEMBER_CLOSED).
      void handle.dispose()
      return true
    },
  }
  const lifecyclePorts = {
    teamDomain: world.domain,
    commit: commits,
    admission: { closeNewWork: async () => {}, reopenNewWork: async () => {} },
    activity: { interrupt: () => {} },
    descendants: { drainDescendants: async () => ({ drained: 0, quiescent: true }) },
    residency,
  }
  const runtime = createTeamRuntime({
    teamDomain: world.domain,
    activationProvider: world.provider,
    blueprintCatalog: world.catalog,
    environmentFacts: world.ports.environmentFacts,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    staticModel: TEST_STATIC_MODEL,
    now: () => P6T2_NOW,
    lifecycleCommit: commits,
    lifecyclePorts,
    workDelivery,
    workActivity: createWorkActivityWriter({ teamDomain: world.domain, now: () => P6T2_NOW }),
  })
  const control = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T2_NOW,
  })
  const sessionInput = createFakeSessionInput()
  const messaging = createMessagingCoordinator({ teamRuntime: runtime, teamDomain: world.domain, sessionInput, now: () => P6T2_NOW })
  const activity = createActivityLedger({ teamDomain: world.domain, runtime, now: () => P6T2_NOW })
  const callerMap = createP6T6CallerMap(options.seed ?? ['leader', 'worker'])
  const { tools } = createTeamTools({
    teamRuntime: runtime,
    controlService: control,
    messaging,
    activity,
    async resolveCaller (sessionId) {
      const caller = callerMap.bySession.get(sessionId)
      if (caller === undefined) throw new Error(`C-stage caller map: no caller for session ${sessionId}`)
      return { caller, rootSessionId: root }
    },
  })
  for (const definition of tools) toolsById.set(definition.name, definition)

  /** The host dispatch of ONE product tool on the LEADER's own centre. */
  const leaderDispatch = async (name, args) => {
    const callId = `${label}-leader-${++sequence}`
    const exec = { name, callId, arguments: { rootSessionId: root, ...args }, agent: { id: root }, turn: 1, step: 1 }
    const verdict = await leaderHost.preExecute(exec)
    if (verdict.kind !== 'allow') {
      leaderHost.result(exec, { isError: true, error: { message: String(verdict.reason) } })
      return { callId, verdict, bodyRan: false, result: undefined }
    }
    const reason = leaderHost.guard(exec)
    if (reason !== undefined) {
      leaderHost.result(exec, { isError: true, error: { message: String(reason) } })
      return { callId, verdict: { kind: 'deny', reason }, bodyRan: false, result: undefined }
    }
    const definition = toolsById.get(name)
    if (definition === undefined) throw new Error(`C-stage: the world has no tool named ${name}`)
    bodies.push(name)
    // A typed tool rejection is a RESULT, not a host error (the tool layer's own contract), so only a
    // THROWN body is `isError`.
    const result = await definition.execute(exec.arguments, exec)
    leaderHost.result(exec, { isError: false })
    return { callId, verdict: { kind: 'allow' }, bodyRan: true, result }
  }

  /** The host dispatch of ONE call on a MEMBER's own centre (the member's own layer). */
  const memberDispatch = async (instanceId, name, args, callId) => {
    const member = members.get(instanceId)
    if (member === undefined) throw new Error(`C-stage: no member centre installed for ${instanceId}`)
    const exec = { name, callId, arguments: args, agent: { id: member.childSessionId }, turn: 1, step: 1 }
    const verdict = await member.host.preExecute(exec)
    if (verdict.kind !== 'allow') {
      member.host.result(exec, { isError: true, error: { message: String(verdict.reason) } })
      return { callId, verdict, bodyRan: false }
    }
    const reason = member.host.guard(exec)
    if (reason !== undefined) {
      member.host.result(exec, { isError: true, error: { message: String(reason) } })
      return { callId, verdict: { kind: 'deny', reason }, bodyRan: false }
    }
    // The member's tool BODY is not this round's subject (the ladder owns the native bodies); the call
    // is observed as having reached the body so a refusal can be told from an execution.
    member.host.result(exec, { isError: false })
    return { callId, verdict: { kind: 'allow' }, bodyRan: true }
  }

  /** One call on the LEADER's centre with NO product body (a non-team tool: the axis is the subject). */
  const leaderProbe = async (name, args, callId) => {
    const exec = { name, callId, arguments: args, agent: { id: root }, turn: 1, step: 1 }
    const verdict = await leaderHost.preExecute(exec)
    if (verdict.kind !== 'allow') {
      leaderHost.result(exec, { isError: true, error: { message: String(verdict.reason) } })
      return { callId, verdict, bodyRan: false }
    }
    const reason = leaderHost.guard(exec)
    if (reason !== undefined) {
      leaderHost.result(exec, { isError: true, error: { message: String(reason) } })
      return { callId, verdict: { kind: 'deny', reason }, bodyRan: false }
    }
    leaderHost.result(exec, { isError: false })
    return { callId, verdict: { kind: 'allow' }, bodyRan: true }
  }

  /** Facts, read back from DISK through a FRESH ledger (never the in-memory writer). */
  const factsOf = (path) => openFactLedger({ path }).readAll()
  const memberSettlementOf = (instanceId, callId) => {
    const store = createExecutionSettlementStore({ dir: join(centreStatePath, 'settlement', instanceId) })
    return store.read(dispatchExecutionId({ rootSessionId: root, agentInstanceId: instanceId }, callId))
  }

  return {
    label,
    root,
    worker,
    dir,
    world,
    runtime,
    control,
    tools,
    toolsById,
    commits,
    bodies,
    deliveries,
    handles,
    members,
    leader: {
      host: leaderHost,
      ledgerPath: leaderLedgerPath,
      store: leaderStore,
      binding: leaderBinding,
      setBinding (value) { currentBinding = value },
      dispatch: leaderDispatch,
      facts: () => factsOf(leaderLedgerPath),
      probe: leaderProbe,
      settlementOf: (callId) => leaderStore.read(leaderIdentity({ callId }).executionId),
      identityOf: leaderIdentity,
    },
    memberOf: (instanceId) => members.get(instanceId),
    memberFacts: (instanceId) => {
      const member = members.get(instanceId)
      if (member === undefined) throw new Error(`C-stage: no member ${instanceId}`)
      return existsSync(member.files) ? factsOf(member.files) : []
    },
    memberSettlementOf,
    memberDispatch,
    lifecycleRows: () => world.domain.repositories.memberInstances.list(root),
    async destroy () {
      try { await destroyP6T1World(world) } catch { /* a world already closed is not a test failure */ }
      destroyDir(dir)
    },
  }
}

// The 15 tools' arguments, built per name. The bodies are the PRODUCT bodies; a body's own typed
// rejection is allowed (the claim here is ADMISSION on team.control plus a recorded fact), but the arm
// asserts every body was REACHED, so a centre that silently refused could not pass.
const cToolArgs = (state) => ({
  team_list_members: {},
  team_list_templates: {},
  team_inspect_config: { targetInstanceId: state.worker },
  team_create_member: { delegationTemplateId: 'scout', label: 'c-tools-scout' },
  team_delegate: { delegationInstanceId: state.worker, label: 'c-tools-work', prompt: 'c-tools: deliver this unit', async: false },
  team_follow_up: { targetInstanceId: state.worker, prompt: 'c-tools: follow this up', async: false },
  team_collect: { requestTokens: ['c-tools-absent'] },
  team_send_message: { recipientInstanceId: state.worker, body: 'c-tools message body' },
  team_report_progress: { instanceId: state.worker, subject: 'c-tools', progress: 'in-progress' },
  team_request_control: { kind: 'leader-approval', targetInstanceId: state.worker, actionName: 'archive-member' },
  team_resolve_control: { requestId: 'ctl-c-tools-absent', decision: 'deny' },
  team_list_pending_control: {},
  team_archive_member: { targetInstanceId: state.created ?? state.worker },
  team_grant_permission: { targetInstanceId: state.worker, rules: [{ operationClass: 'fs.write', matcher: { kind: 'exact', value: '/work/member/x.txt' }, effect: 'allow' }] },
  team_revoke_permission: { targetInstanceId: state.worker, rules: [{ operationClass: 'fs.write', matcher: { kind: 'exact', value: '/work/member/x.txt' }, effect: 'allow' }] },
})

const cToken = (name) => `tok-${name.replace(/^team_/u, '').replace(/_/gu, '-')}`

test('ADM-89 — C-tools: every one of the closed 15 is ADMITTED on team.control through the product tool surface, and records a fact', async () => {
  const stage = await cStage('vnext-c-tools')
  try {
    const state = { worker: stage.worker, created: undefined }
    const runs = []
    for (const name of CENTRE_TOOL_NAMES) {
      const run = await stage.leader.dispatch(name, { requestToken: cToken(name), ...cToolArgs(state)[name] })
      runs.push({ name, ...run })
      if (name === 'team_create_member' && run.result?.status === 'executed') state.created = run.result.effect.instanceId
    }
    // (1) ADMISSION — all 15, in the centre's own order, allowed BEFORE the body and then executed.
    assert.deepEqual(runs.map((run) => run.name), [...CENTRE_TOOL_NAMES], 'the closed 15 are driven in their declared order')
    for (const run of runs) {
      assert.equal(run.verdict.kind, 'allow', `${run.name} must be admitted for a bound agent`)
      assert.equal(run.bodyRan, true, `${run.name} reached its product body`)
      assert.notEqual(run.result, undefined, `${run.name} returned its lossless result`)
    }
    assert.equal(stage.bodies.length, CENTRE_TOOL_NAMES.length, 'every tool ran its body exactly once')
    assert.notEqual(state.created, undefined, 'team_create_member produced a real TeamDomain member')
    assert.equal(stage.lifecycleRows().some((row) => String(row.instanceId) === state.created), true)

    // (2) THE DURABLE FACTS, read back from disk with a FRESH ledger: one authority fact per call, on
    //     team.control, attributed to the Leader's member identity and its compiled generation.
    const facts = stage.leader.facts()
    const authority = facts.filter((record) => record.kind === 'invocation-authority')
    assert.equal(authority.length, CENTRE_TOOL_NAMES.length)
    assert.deepEqual(authority.map((record) => record.toolName), [...CENTRE_TOOL_NAMES])
    for (const fact of authority) {
      assert.equal(fact.axis, 'team.control', `${fact.toolName} is centre-owned, not judged on an fs/net lane`)
      assert.equal(fact.decision, 'allow')
      assert.equal(fact.agentId, C_LEADER)
      assert.equal(fact.instanceId, C_LEADER)
      assert.equal(fact.sessionId, stage.root)
      assert.equal(fact.owner, stage.root)
      assert.equal(fact.policyGeneration, `rev-${C_LEADER}`)
      assert.equal(fact.instanceGeneration, 1)
      assert.equal(fact.refusalCode, undefined)
      assert.equal(fact.locator, '', 'a centre tool has NO locator: recording a path nobody judged would be worse than none')
    }
    assert.equal(facts.filter((record) => record.kind === 'execution').length, CENTRE_TOOL_NAMES.length)
    for (const run of runs) {
      const settled = stage.leader.settlementOf(run.callId)
      assert.equal(settled.state, 'COMPLETED', `${run.name} settled COMPLETED`)
      assert.equal(settled.observation.dispatch, 'quiesced')
      assert.equal(settled.observation.bodyOutcome, 'completed')
    }
  } finally {
    await stage.destroy()
  }
})

test('ADM-90 — C-tools: an UNBOUND agent is REFUSED for all 15, with the A1 code, zero bodies and REFUSED/not-started settlements', async () => {
  const stage = await cStage('vnext-c-tools-unbound')
  try {
    // The SAME world, the SAME tool set: only the centre's binding is removed (the A1 law's input).
    stage.leader.setBinding(undefined)
    const state = { worker: stage.worker, created: undefined }
    const runs = []
    for (const name of CENTRE_TOOL_NAMES) {
      runs.push({ name, ...(await stage.leader.dispatch(name, { requestToken: cToken(name), ...cToolArgs(state)[name] })) })
    }
    for (const run of runs) {
      assert.equal(run.verdict.kind, 'deny', `${run.name} must be refused for an unbound agent`)
      assert.match(String(run.verdict.reason), /ADMISSION_NO_BINDING/u, `${run.name}: the unwired call is refused, not forwarded`)
      assert.equal(run.bodyRan, false, `${run.name}: ZERO side effects`)
    }
    assert.equal(stage.bodies.length, 0, 'no tool body ran for any of the 15')
    assert.equal(stage.deliveries.length, 0, 'no work was delivered')
    assert.equal(stage.lifecycleRows().length, 2, 'no member was created (the runtime was never reached)')

    const facts = stage.leader.facts()
    const authority = facts.filter((record) => record.kind === 'invocation-authority')
    assert.equal(authority.length, CENTRE_TOOL_NAMES.length)
    for (const fact of authority) {
      assert.equal(fact.decision, 'deny')
      assert.equal(fact.refusalCode, 'ADMISSION_NO_BINDING')
      assert.equal(fact.agentId, '', 'a refused unbound call has no agent identity to claim')
      assert.equal(fact.axis, 'team.control', 'the axis is the tool\'s, even when the identity is absent')
    }
    // A refusal writes the EXECUTION fact too (nothing ran), so the durable record can tell a refused
    // call from a call that was never attempted.
    const execution = facts.filter((record) => record.kind === 'execution')
    assert.equal(execution.length, CENTRE_TOOL_NAMES.length)
    for (const record of execution) {
      assert.equal(record.refusalCode, 'ADMISSION_NO_BINDING')
      assert.equal(record.outcome, 'admission-refusal', 'the execution fact says the refusal was the admission\'s')
    }
    for (const run of runs) {
      const settled = stage.leader.settlementOf(run.callId)
      assert.equal(settled.state, 'REFUSED')
      assert.equal(settled.observation.dispatch, 'not-started')
      assert.equal(settled.observation.bodyOutcome, 'not-started')
    }

    // POSITIVE CONTROL, same world: restoring the binding admits the same tool (the refusal is the
    // absent binding, not a broken assembly).
    stage.leader.setBinding(stage.leader.binding)
    const restored = await stage.leader.dispatch('team_list_members', { requestToken: 'tok-restored' })
    assert.equal(restored.verdict.kind, 'allow')
    assert.equal(restored.bodyRan, true)
    assert.equal(stage.leader.settlementOf(restored.callId).state, 'COMPLETED')
  } finally {
    await stage.destroy()
  }
})

test('ADM-91 — C-tools: a tool NOT in the closed list is refused by name, never silently admitted', async () => {
  const { readFileSync } = await import('node:fs')
  const stage = await cStage('vnext-c-tools-unlisted')
  try {
    // The closed list is the admission table AND the created set (ADM-31's two-way pin, re-read here so
    // "not in the list" cannot be a stale literal in this arm).
    const source = readFileSync(new URL('../../../packages/tools/src/tools.ts', import.meta.url), 'utf8')
    for (const absent of ['team_delete_team', 'team_promote_member']) {
      assert.equal(CENTRE_TOOL_NAMES.includes(absent), false)
      assert.equal(source.includes(`name: '${absent}'`), false, `${absent} is not a product tool — so admitting it would be invention`)

      const run = await stage.leader.dispatch(absent, { requestToken: cToken(absent) })
      assert.equal(run.verdict.kind, 'deny', `${absent} must NOT be admitted`)
      assert.match(String(run.verdict.reason), /ADMISSION_TOOL_UNBOUND/u, 'an unclassified tool is refused by name')
      assert.equal(run.bodyRan, false, 'ZERO side effects')
      const fact = stage.leader.facts().find((record) => record.kind === 'invocation-authority' && record.toolName === absent)
      assert.equal(fact.decision, 'deny')
      assert.equal(fact.refusalCode, 'ADMISSION_TOOL_UNBOUND')
      const settled = stage.leader.settlementOf(run.callId)
      assert.equal(settled.state, 'REFUSED')
      assert.equal(settled.observation.dispatch, 'not-started')
    }
    // The refusal is NOT a blanket: the same centre admits a CLASSIFIED tool on its own axis, so a green
    // here cannot come from a permanently-denying assembly.
    const read = await stage.leader.probe('read', { file_path: '/work/member/doc.txt' }, 'c-tools-read-probe')
    assert.equal(read.verdict.kind, 'allow')
    const readFact = stage.leader.facts().find((record) => record.kind === 'invocation-authority' && record.toolName === 'read')
    assert.equal(readFact.axis, 'fs.read')
    assert.equal(readFact.decision, 'allow')
  } finally {
    await stage.destroy()
  }
})

test('ADM-92 — C-member: create through the tool surface records the authority fact and installs the MEMBER\'s own centre', async () => {
  const { existsSync } = await import('node:fs')
  const stage = await cStage('vnext-c-member-create')
  try {
    const created = await stage.leader.dispatch('team_create_member', {
      requestToken: 'tok-c-member-create',
      delegationTemplateId: 'scout',
      label: 'c-member-scout',
    })
    assert.equal(created.verdict.kind, 'allow')
    assert.equal(created.result.status, 'executed')
    assert.equal(created.result.effect.kind, 'member-activated')
    const instanceId = created.result.effect.instanceId
    const childSessionId = created.result.effect.childSessionId

    // (1) the LEADER's authority fact for the lifecycle operation, read back from disk.
    const fact = stage.leader.facts().find((record) => record.kind === 'invocation-authority' && record.toolName === 'team_create_member')
    assert.equal(fact.axis, 'team.control')
    assert.equal(fact.decision, 'allow')
    assert.equal(fact.instanceId, C_LEADER)
    assert.equal(stage.leader.settlementOf(created.callId).state, 'COMPLETED')

    // (2) the REAL product object: the durable member row the create committed.
    const row = stage.lifecycleRows().find((candidate) => String(candidate.instanceId) === instanceId)
    assert.notEqual(row, undefined)
    assert.equal(String(row.templateId), 'scout')
    assert.equal(String(row.childSessionId), childSessionId)

    // (3) the MEMBER'S OWN CENTRE EXISTS: its durable ledger was opened at the member bind, and it is
    //     EMPTY (no call has been judged yet) — a centre that already carried facts would be a copy.
    const member = stage.memberOf(instanceId)
    assert.notEqual(member, undefined, 'the created member is bound to its own centre')
    assert.notEqual(member.state, undefined, 'installMemberExecution returned the member\'s centre state')
    assert.equal(member.state.binding.agentId, instanceId, 'the centre\'s binding is the MEMBER\'s own identity')
    assert.equal(member.state.binding.sessionId, childSessionId)
    assert.deepEqual(stage.memberFacts(instanceId), [], 'no call has been judged yet, so no fact exists')

    // (4) THE MEMBER'S CALLS ARE JUDGED BY THE MEMBER'S CENTRE: an in-lane read is admitted and recorded
    //     in the MEMBER's ledger, not the Leader's.
    const memberCall = await stage.memberDispatch(instanceId, 'read', { file_path: '/work/member/doc.txt' }, 'c-member-read-1')
    assert.equal(memberCall.verdict.kind, 'allow')
    assert.equal(existsSync(member.files), true, 'the member\'s durable fact ledger exists after its first call')
    const memberFacts = stage.memberFacts(instanceId).filter((record) => record.kind === 'invocation-authority')
    assert.equal(memberFacts.length, 1)
    assert.equal(memberFacts[0].kind, 'invocation-authority')
    assert.equal(memberFacts[0].toolName, 'read')
    assert.equal(memberFacts[0].axis, 'fs.read')
    assert.equal(memberFacts[0].agentId, instanceId)
    assert.equal(memberFacts[0].instanceId, instanceId)
    assert.equal(memberFacts[0].policyGeneration, `rev-${instanceId}`, 'the member\'s own compiled generation, not the Leader\'s')
    assert.equal(stage.memberSettlementOf(instanceId, 'c-member-read-1').state, 'COMPLETED')
    assert.equal(stage.leader.facts().some((record) => record.kind === 'invocation-authority' && record.toolName === 'read'), false,
      'the member\'s call never reaches the Leader\'s ledger')

    // (5) NEGATIVE CONTROL: the member's own lane is narrower than the Leader's, so the SAME locator is
    //     refused by the MEMBER's centre while the Leader's centre allows it — the judgement belongs to
    //     that member, not to the leader.
    const refused = await stage.memberDispatch(instanceId, 'read', { file_path: '/work/shared/other.txt' }, 'c-member-read-2')
    assert.equal(refused.verdict.kind, 'deny')
    assert.match(String(refused.verdict.reason), /LANE_DENY/u)
    const leaderSame = await stage.leader.probe('read', { file_path: '/work/shared/other.txt' }, 'c-member-leader-read')
    assert.equal(leaderSame.verdict.kind, 'allow')
  } finally {
    await stage.destroy()
  }
})

test('ADM-93 — C-member: archive through the tool surface CLOSES the member\'s own centre; a later call is ADMISSION_MEMBER_CLOSED, not admitted and not UNKNOWN', async () => {
  const stage = await cStage('vnext-c-member-archive')
  try {
    const created = await stage.leader.dispatch('team_create_member', {
      requestToken: 'tok-c-archive-create',
      delegationTemplateId: 'scout',
      label: 'c-archive-scout',
    })
    assert.equal(created.result.status, 'executed')
    const instanceId = created.result.effect.instanceId
    const member = stage.memberOf(instanceId)

    // Make the member legally archivable through the SAME tool surface: one synchronous work unit takes
    // it through the real FSM (CREATED -> RUNNING -> SETTLED, committed through the real repository CAS).
    const work = await stage.leader.dispatch('team_delegate', {
      requestToken: 'tok-c-archive-work',
      delegationInstanceId: instanceId,
      label: 'c-archive-work',
      prompt: 'c-archive: one unit of work',
      async: false,
    })
    assert.equal(work.result.status, 'executed')
    assert.equal(work.result.effect.settled, true)
    assert.equal(String(stage.lifecycleRows().find((row) => String(row.instanceId) === instanceId).lifecycle), 'SETTLED')

    // POSITIVE CONTROL, before the archive: the member's centre ADMITS a call (so the tombstone below is
    // the archive's, not an assembly that never worked).
    const before = await stage.memberDispatch(instanceId, 'read', { file_path: '/work/member/before.txt' }, 'c-member-before-archive')
    assert.equal(before.verdict.kind, 'allow')

    // THE ARCHIVE, through the product's own tool.
    const archived = await stage.leader.dispatch('team_archive_member', {
      requestToken: 'tok-c-archive-op',
      targetInstanceId: instanceId,
    })
    assert.equal(archived.verdict.kind, 'allow')
    assert.equal(archived.result.status, 'executed')
    assert.equal(archived.result.effect.kind, 'lifecycle-changed')
    assert.equal(archived.result.effect.to, 'ARCHIVED')
    const archiveFact = stage.leader.facts().find((record) => record.kind === 'invocation-authority' && record.toolName === 'team_archive_member')
    assert.equal(archiveFact.axis, 'team.control')
    assert.equal(archiveFact.decision, 'allow')
    assert.equal(stage.leader.settlementOf(archived.callId).state, 'COMPLETED')

    // the durable product state, and the handle released by the lifecycle's `release-residency` step.
    assert.equal(String(stage.lifecycleRows().find((candidate) => String(candidate.instanceId) === instanceId).lifecycle), 'ARCHIVED')
    assert.equal(stage.handles.has(member.childSessionId), false, 'the member\'s handle was released by the archive procedure')

    // (1) THE MEMBER'S CENTRE IS CLOSED: its pre-close fact survives (nothing is rewritten) and the NEXT
    //     call is refused with the lifecycle code, recorded on the member's own ledger.
    assert.equal(stage.memberFacts(instanceId).filter((record) => record.kind === 'invocation-authority').length, 1)
    const after = await stage.memberDispatch(instanceId, 'read', { file_path: '/work/member/after.txt' }, 'c-member-after-archive')
    assert.equal(after.verdict.kind, 'deny')
    assert.match(String(after.verdict.reason), /ADMISSION_MEMBER_CLOSED/u, 'a closed centre refuses with its OWN code, not a lane denial')
    assert.equal(after.bodyRan, false, 'ZERO side effects after the close')
    const facts = stage.memberFacts(instanceId).filter((record) => record.kind === 'invocation-authority')
    assert.equal(facts.length, 2)
    assert.equal(facts[0].callId, 'c-member-before-archive', 'the pre-close fact is untouched')
    assert.equal(facts[1].callId, 'c-member-after-archive')
    assert.equal(facts[1].decision, 'deny')
    assert.equal(facts[1].refusalCode, 'ADMISSION_MEMBER_CLOSED')
    assert.equal(facts[1].agentId, instanceId, 'the closed centre still names WHICH member refused')

    // (2) NOT ADMITTED, NOT UNKNOWN: the product settlement says REFUSED and nothing started.
    const settled = stage.memberSettlementOf(instanceId, 'c-member-after-archive')
    assert.equal(settled.state, 'REFUSED')
    assert.equal(settled.state === 'UNKNOWN', false, 'a closed member\'s call is a decision, not an unknown')
    assert.equal(settled.observation.dispatch, 'not-started')
    assert.equal(settled.observation.bodyOutcome, 'not-started')
    assert.deepEqual(settled.transitions.map((transition) => transition.to), ['ADMITTED', 'REFUSED'])
    assert.match(String(settled.terminalReason), /ADMISSION_MEMBER_CLOSED/u, 'the durable record carries the code, not prose')

    // (3) THE CLOSE IS PER MEMBER: the Leader's centre still admits its own calls.
    const leaderStill = await stage.leader.dispatch('team_list_members', { requestToken: 'tok-after-archive' })
    assert.equal(leaderStill.verdict.kind, 'allow')
    assert.equal(stage.leader.settlementOf(leaderStill.callId).state, 'COMPLETED')

    // (4) NEGATIVE CONTROL: archiving the ARCHIVED target again is not a second success and commits
    //     nothing.
    const commitsBefore = stage.commits.calls.length
    const again = await stage.leader.dispatch('team_archive_member', { requestToken: 'tok-c-archive-again', targetInstanceId: instanceId })
    assert.equal(again.result.status === 'executed', false, 'a non-live target is not archived twice')
    assert.equal(stage.commits.calls.length, commitsBefore, 'no second durable lifecycle commit')
    assert.equal(String(stage.lifecycleRows().find((candidate) => String(candidate.instanceId) === instanceId).lifecycle), 'ARCHIVED')
  } finally {
    await stage.destroy()
  }
})

test('ADM-94 — C-work: delegate -> collect through the tool surface delivers the unit, and the collected work\'s own member calls are judged by THAT member\'s centre', async () => {
  const stage = await cStage('vnext-c-work')
  try {
    // (1) DELEGATE through the product tool: one synchronous unit on the seeded worker, delivered
    //     through the work-delivery port and settled durably.
    const delegated = await stage.leader.dispatch('team_delegate', {
      requestToken: 'tok-c-work-delegate',
      delegationInstanceId: stage.worker,
      label: 'c-work-unit',
      prompt: 'c-work: the exact delivered prompt',
      async: false,
    })
    assert.equal(delegated.verdict.kind, 'allow')
    assert.equal(delegated.result.status, 'executed')
    assert.equal(delegated.result.effect.kind, 'work-admitted')
    assert.equal(delegated.result.effect.instanceId, stage.worker)
    assert.equal(delegated.result.effect.settled, true, 'the work unit settled through the delivery chain')
    assert.equal(delegated.result.effect.memberResult.body, 'C-STAGE-MEMBER-BODY')
    assert.deepEqual(stage.deliveries, [{ requestToken: 'tok-c-work-delegate', prompt: 'c-work: the exact delivered prompt' }],
      'the PROMPT reached the host delivery seam verbatim')

    // the LEADER's durable record of the delegation, read back from disk.
    const fact = stage.leader.facts().find((record) => record.kind === 'invocation-authority' && record.toolName === 'team_delegate')
    assert.equal(fact.axis, 'team.control', 'delegation is centre-owned authority, not an fs/net lane')
    assert.equal(fact.decision, 'allow')
    assert.equal(stage.leader.settlementOf(delegated.callId).state, 'COMPLETED')

    // (2) COLLECT through the product tool: the terminal state comes back from the durable work status.
    const collected = await stage.leader.dispatch('team_collect', {
      requestToken: 'tok-c-work-collect',
      requestTokens: ['tok-c-work-delegate'],
    })
    assert.equal(collected.result.status, 'executed')
    assert.equal(collected.result.effect.kind, 'work-status')
    const entry = collected.result.effect.entries.find((candidate) => candidate.requestToken === 'tok-c-work-delegate')
    assert.notEqual(entry, undefined)
    assert.equal(entry.status, 'succeeded')
    assert.equal(entry.instanceId, stage.worker)
    assert.equal(typeof entry.settledSequence, 'number')
    assert.equal(entry.memberResult.body, 'C-STAGE-MEMBER-BODY')
    assert.equal(stage.leader.settlementOf(collected.callId).state, 'COMPLETED')

    // (3) THE COLLECTED WORK'S OWN MEMBER CALLS ARE JUDGED BY THAT MEMBER'S CENTRE. The member's lane is
    //     narrower than the Leader's, and both facts are read back from their OWN ledgers.
    const inLane = await stage.memberDispatch(stage.worker, 'read', { file_path: '/work/member/doc.txt' }, 'c-work-member-1')
    assert.equal(inLane.verdict.kind, 'allow')
    const outOfLane = await stage.memberDispatch(stage.worker, 'read', { file_path: '/work/shared/doc.txt' }, 'c-work-member-2')
    assert.equal(outOfLane.verdict.kind, 'deny')
    assert.match(String(outOfLane.verdict.reason), /LANE_DENY/u)
    assert.match(String(outOfLane.verdict.reason), new RegExp(`policy generation rev-${stage.worker}`, 'u'),
      'the refusal names the MEMBER\'s generation')

    const memberFacts = stage.memberFacts(stage.worker).filter((record) => record.kind === 'invocation-authority')
    assert.equal(memberFacts.length, 2)
    for (const record of memberFacts) {
      assert.equal(record.agentId, stage.worker)
      assert.equal(record.instanceId, stage.worker)
      assert.equal(record.policyGeneration, `rev-${stage.worker}`)
      assert.equal(record.owner, stage.root)
    }
    assert.equal(memberFacts[0].decision, 'allow')
    assert.equal(memberFacts[1].decision, 'deny')
    assert.equal(stage.memberSettlementOf(stage.worker, 'c-work-member-1').state, 'COMPLETED')
    assert.equal(stage.memberSettlementOf(stage.worker, 'c-work-member-2').state, 'REFUSED')

    // and the LEADER's centre does NOT share the member's judgement: the same locator is allowed there.
    const leaderSame = await stage.leader.probe('read', { file_path: '/work/shared/doc.txt' }, 'c-work-leader-read')
    assert.equal(leaderSame.verdict.kind, 'allow')
    const leaderReadFacts = stage.leader.facts().filter((record) => record.kind === 'invocation-authority' && record.toolName === 'read')
    assert.equal(leaderReadFacts.length, 1, 'the Leader\'s ledger holds only the Leader\'s own read')
    assert.equal(leaderReadFacts[0].callId, leaderSame.callId)
  } finally {
    await stage.destroy()
  }
})

test('ADM-95 — C-work negative: a refused delegation delivers NOTHING and admits no work; the collect stays a read with an unknown entry', async () => {
  const stage = await cStage('vnext-c-work-negative')
  try {
    // The A1 law at the delegation itself: no binding, no delegation — and no delivery.
    stage.leader.setBinding(undefined)
    const refused = await stage.leader.dispatch('team_delegate', {
      requestToken: 'tok-c-work-refused',
      delegationInstanceId: stage.worker,
      label: 'c-work-refused',
      prompt: 'c-work: this must never be delivered',
      async: false,
    })
    assert.equal(refused.verdict.kind, 'deny')
    assert.match(String(refused.verdict.reason), /ADMISSION_NO_BINDING/u)
    assert.equal(refused.bodyRan, false)
    assert.equal(stage.deliveries.length, 0, 'ZERO delivery: a refused delegation reaches no member turn')
    assert.equal(String(stage.lifecycleRows().find((candidate) => String(candidate.instanceId) === stage.worker).lifecycle), 'RUNNING',
      'the target was not moved by a refused admission')
    assert.equal(stage.commits.calls.length, 0, 'no lifecycle commit for a refused admission')
    const refusal = stage.leader.facts().find((record) => record.kind === 'invocation-authority' && record.toolName === 'team_delegate')
    assert.equal(refusal.refusalCode, 'ADMISSION_NO_BINDING')
    assert.equal(stage.leader.settlementOf(refused.callId).state, 'REFUSED')

    // With the binding restored, `team_collect` reads the durable work status: the refused token was
    // never admitted, so it is UNKNOWN — and the read writes nothing.
    stage.leader.setBinding(stage.leader.binding)
    const writesBefore = stage.world.seam.writeCount
    const collected = await stage.leader.dispatch('team_collect', {
      requestToken: 'tok-c-work-collect-refused',
      requestTokens: ['tok-c-work-refused'],
    })
    assert.equal(collected.result.status, 'executed')
    const entry = collected.result.effect.entries.find((candidate) => candidate.requestToken === 'tok-c-work-refused')
    assert.notEqual(entry, undefined)
    assert.equal(entry.status, 'unavailable', 'a token with no admitted work unit has no work status, never a fabricated success')
    assert.equal(entry.settledSequence, undefined)
    assert.equal(entry.memberResult, undefined)
    assert.equal(stage.world.seam.writeCount, writesBefore, 'the collect is a READ: zero durable writes')
    assert.equal(stage.leader.settlementOf(collected.callId).state, 'COMPLETED')
  } finally {
    await stage.destroy()
  }
})

// ============================================================================================
// C STAGE (round 57): the two C rows whose MOUNT path was still unproven — C-mcp and C-alpha6.
//
// C-mcp. ADM-33 pinned the JUDGEMENT (server as locator, `net.mcp`, no prefix match) but a string
// literal is not a mount: nothing proved that a REAL server, reached through the product's OWN MCP
// transport, contributes a tool the ONE centre then judges. ADM-96/97 close that:
//
//  * the server is the product's own `packages/runtime/root-binding/harness/mini-mcp.mjs` endpoint —
//    a real HTTP MCP server, not a hand-written fake;
//  * the mount is the EXACT call `agent-bindings.mjs#reconcileMcpSet` makes
//    (`mcpMountCtx.plugin(mcpClient, <the same seven-field streamable-http literal>)`), executed as
//    `mcpClient.apply(ctx, config)` (the public namespace-plugin seam the Cordis `plugin()` call
//    invokes) over a real socket;
//  * WHICH servers exist is the product's own SUPPLY + MOUNT GATE (`configuredMcpServers` →
//    `filterMcpServers`), not a list the arm invents;
//  * the judged name is read off the resulting model-visible surface (`mcp__<server>__<tool>`), and
//    the body behind it is the real MCP round-trip (`pong:<msg>`), so "admitted" means the mounted
//    tool actually ran.
//
// The HOST STAND-IN is named: the Cordis ctx double (the same surface U6 pins for this plugin) and
// the dispatcher order (pre-execute → guard → body → result). It decides nothing; the decision is the
// centre's on the same ctx.
//
// NOT PROVEN (stated in CAPABILITY-MATRIX-C.md as a LIMIT): the centre is not MOUNT-AWARE. Its binding
// is frozen before the mount target is computed (agent-bindings.mjs installs the centre at the bind,
// and computes `mcpMountTarget` later per boundary), so a WELL-FORMED name for a server that is not
// mounted is decided on the network axis alone if a caller fabricates the call past the tool registry.
// ADM-97 pins that current answer explicitly so it cannot change silently.
//
// C-alpha6. Round 55 proved the REFUSAL. What was unproven is the other side: that on the ONE row
// shape where Alpha.6 is reachable (a row that never configured the centre) the product really TAKES
// a routing decision and RECORDS who it chose. ADM-98 drives the real composition + the ONE router +
// the real wake dispatcher + the durable intent directory, and reads the chosen reviewer back from
// disk. ADM-99 then proves the centre has no vocabulary for that decision at all: the governed join
// is missing, not merely switched off.
// ============================================================================================

/**
 * The tools service the REAL `@deepseek-ai/dsh-mcp-client` plugin registers into, plus the ONE
 * centre's `guard`. ONE object on the agent ctx, exactly as a boot supplies it.
 */
const cMcpTools = () => {
  const registered = []
  const disposers = []
  let guardFn
  const tools = {
    register (definition) {
      registered.push(definition)
      const dispose = () => {
        const at = registered.indexOf(definition)
        if (at >= 0) registered.splice(at, 1)
      }
      disposers.push(dispose)
      return dispose
    },
    guard (fn) { guardFn = fn; return () => { if (guardFn === fn) guardFn = undefined } },
    schemas () { return registered.map((definition) => ({ name: definition.name })) },
  }
  return {
    tools,
    names: () => registered.map((definition) => definition.name),
    definitionOf: (name) => registered.find((definition) => definition.name === name),
    disposeAll: () => { for (const dispose of [...disposers].reverse()) { try { dispose() } catch { /* teardown */ } } },
  }
}

/** The EXACT config literal `reconcileMcpSet` passes to `state.mcpMountCtx.plugin(mcpClient, …)`. */
const cMcpMountConfig = (serverName, port) => ({
  transport: 'streamable-http',
  serverName,
  url: `http://127.0.0.1:${port}/mcp`,
  headers: {},
  toolCallTimeoutMs: 15_000,
  failOnStartupError: true,
  reconnect: { enabled: true, initialDelayMs: 500, maxDelayMs: 2_000, maxAttempts: 3 },
})

/** The compiled-answer INPUT one member's net.mcp lane comes from (the ceiling + per-tool answers). */
const cMcpCompiledMember = ({ instanceId = 'inst-mcp', network = 'allow', perTool = [] } = {}) => ({
  members: [{
    identity: { instanceId, instanceGeneration: 1 },
    definitionSource: '@deepseek-ai/dsh-tool-fs',
    policy: {
      ok: true,
      value: {
        memberIdentity: instanceId,
        templateId: 'worker',
        instanceGeneration: 1,
        revision: `rev-${instanceId}`,
        read: lane(['/work/member']),
        write: lane(['/work/member']),
        network: { access: network },
      },
    },
  }],
  bindings: perTool.map((entry) => ({
    toolName: entry.toolName,
    effective: { read: lane(['/work/member']), write: lane(['/work/member']), network: { access: entry.network } },
  })),
})

/** Mount one server through the product's own call, over the real transport. */
const cMountMcp = async (world, serverName, port) => {
  const mcpClient = await import('@deepseek-ai/dsh-mcp-client')
  await mcpClient.apply(world.ctx, cMcpMountConfig(serverName, port))
}

/** One dispatch in the host's order, with the MOUNTED tool's real body as the body. */
const cDispatchMountedMcp = async (world, mcp, exec) => {
  const verdict = await world.preExecute(exec)
  if (verdict.kind !== 'allow') {
    world.result(exec, { isError: true, error: { message: String(verdict.reason) } })
    return { verdict, bodyRan: false }
  }
  const reason = world.guard(exec)
  if (reason !== undefined) {
    world.result(exec, { isError: true, error: { message: String(reason) } })
    return { verdict: { kind: 'deny', reason }, bodyRan: false }
  }
  const definition = mcp.definitionOf(exec.name)
  if (definition === undefined) throw new Error(`c-mcp: no mounted definition for ${exec.name}`)
  const result = await definition.execute(exec.arguments, exec)
  world.result(exec, { isError: false })
  return { verdict: { kind: 'allow' }, bodyRan: true, result }
}

/**
 * The same host order WITHOUT a body: pre-execute and guard only, then close the host event as an
 * error. Used where the point is the centre's answer about a name the surface does not carry.
 */
const cProbeCentre = async (world, exec) => {
  const verdict = await world.preExecute(exec)
  if (verdict.kind !== 'allow') {
    world.result(exec, { isError: true, error: { message: String(verdict.reason) } })
    return { verdict, bodyRan: false }
  }
  const reason = world.guard(exec)
  if (reason !== undefined) {
    world.result(exec, { isError: true, error: { message: String(reason) } })
    return { verdict: { kind: 'deny', reason }, bodyRan: false }
  }
  world.result(exec, { isError: true, error: { message: 'HOST_TOOL_UNKNOWN: no definition on this agent surface' } })
  return { verdict: { kind: 'allow' }, bodyRan: false }
}

test('ADM-96 — C-mcp: a REAL mounted MCP server’s tool call is ADMITTED by the ONE centre on net.mcp, and its real body answers', async () => {
  const { startMiniMcpServer, closeMiniServer } = await import('../root-binding/harness/mini-mcp.mjs')
  const { filterMcpServers } = await import('../agent-setup/capability/index.ts')
  const { configuredMcpServers } = await import('../src/plugin/mcp-supply.ts')
  const mcp = cMcpTools()
  const mini = await startMiniMcpServer([3961, 3962], { tools: 'single' })
  const compiled = cMcpCompiledMember()
  const world = await centreWorld('mcp-mount', {
    tools: mcp.tools,
    binding: bindingFromCompiledMember({
      member: compiled.members[0],
      agentId: 'inst-mcp',
      sessionId: 'session-mcp',
      workspaceRoot: '/work/member',
      owner: 'root-mcp',
    }),
  })
  try {
    // (1) WHICH SERVERS EXIST is the product's own supply read + mount gate — never the arm's list.
    const configured = configuredMcpServers({
      mcpServers: [
        { name: 'p5t5mini', port: mini.port },
        { name: 'ghost-srv', port: null },
      ],
    })
    const target = filterMcpServers(configured.map((server) => server.name), { kind: 'allow', items: ['p5t5mini'] })
    assert.deepEqual(target, ['p5t5mini'], 'the mount gate admits the granted configured server and nothing else')

    // (2) THE PRODUCT'S MOUNT CALL, over a real socket to the real mini-MCP endpoint.
    await cMountMcp(world, 'p5t5mini', mini.port)
    assert.deepEqual(mcp.names(), ['mcp__p5t5mini__ping'], 'the model-visible surface is the server-qualified name')

    // (3) THE ONE CENTRE judges the mounted call, and the real body runs.
    const exec = {
      name: 'mcp__p5t5mini__ping',
      callId: 'mcp-mount-1',
      arguments: { msg: 'mounted' },
      agent: { id: 'agent-1' },
      turn: 1,
      step: 1,
    }
    const run = await cDispatchMountedMcp(world, mcp, exec)
    assert.equal(run.verdict.kind, 'allow')
    assert.equal(run.bodyRan, true, 'the admitted call reached the mounted body')
    assert.deepEqual(run.result, { content: [{ type: 'text', text: 'pong:mounted' }] }, 'the REAL server answered; the body is not a stub')

    // (4) The fact, read back from DISK through a FRESH ledger: the NETWORK axis, the SERVER as locator.
    const fact = world.ledger.readAll().find((record) => record.kind === 'invocation-authority')
    assert.notEqual(fact, undefined)
    assert.equal(fact.toolName, 'mcp__p5t5mini__ping')
    assert.equal(fact.decision, 'allow')
    assert.equal(fact.axis, 'net.mcp')
    assert.equal(fact.locator, 'p5t5mini', 'the locator is the SERVER, never a fabricated path')
    assert.equal(world.admissionFact(exec.callId).locator, 'p5t5mini')

    // (5) The product settlement store closed the call COMPLETED in the product's own state order.
    const settled = world.store.read(world.executionIdOf(exec))
    assert.equal(settled.state, 'COMPLETED')
    assert.deepEqual(settled.transitions.map((entry) => entry.to), ['ADMITTED', 'RUNNING', 'COMPLETED'])
  } finally {
    mcp.disposeAll()
    world.hostDispose()
    await closeMiniServer(mini)
    world.dispose()
  }
})

test('ADM-97 — C-mcp negatives: the member’s compiled lane decides a MOUNTED call, a tool-level restriction narrows, and a bare prefix is not a permission', async () => {
  const { startMiniMcpServer, closeMiniServer } = await import('../root-binding/harness/mini-mcp.mjs')
  const { filterMcpServers } = await import('../agent-setup/capability/index.ts')
  const mcp = cMcpTools()
  const mini = await startMiniMcpServer([3963, 3964], { tools: 'paginated' })
  // The compiled answer: network ALLOW at the ceiling, and a TOOL-LEVEL deny on `alpha` only. The
  // second server is configured but NOT granted, so it must never be mounted.
  const compiled = cMcpCompiledMember({
    perTool: [{ toolName: 'mcp__p5t5mini__alpha', network: 'deny' }],
  })
  const world = await centreWorld('mcp-narrow', {
    tools: mcp.tools,
    binding: bindingFromCompiledMember({
      member: compiled.members[0],
      bindings: compiled.bindings,
      agentId: 'inst-mcp',
      sessionId: 'session-mcp',
      workspaceRoot: '/work/member',
      owner: 'root-mcp',
    }),
  })
  const execOf = (name, callId) => ({ name, callId, arguments: { msg: callId }, agent: { id: 'agent-1' }, turn: 1, step: 1 })
  try {
    // (1) The MOUNT GATE is a decision: `deny` mounts nothing, and an ungranted configured server is
    //     excluded even under allow.
    assert.deepEqual(filterMcpServers(['p5t5mini', 'ghost-srv'], { kind: 'deny', items: [] }), [])
    assert.deepEqual(filterMcpServers(['p5t5mini', 'ghost-srv'], { kind: 'allow', items: ['p5t5mini'] }), ['p5t5mini'])
    await cMountMcp(world, 'p5t5mini', mini.port)
    const surface = mcp.names().sort()
    assert.deepEqual(surface, ['mcp__p5t5mini__alpha', 'mcp__p5t5mini__beta'])
    assert.equal(surface.some((name) => name.includes('ghost-srv')), false, 'an unmounted server contributes NO tool name to the surface')

    // (2) A MOUNTED tool the member's compiled TOOL-level answer denies: NETWORK_DENY, zero body.
    const alpha = await cDispatchMountedMcp(world, mcp, execOf('mcp__p5t5mini__alpha', 'mcp-narrow-alpha'))
    assert.equal(alpha.verdict.kind, 'deny')
    assert.match(String(alpha.verdict.reason), /NETWORK_DENY/u)
    assert.equal(alpha.bodyRan, false)
    const alphaFact = world.admissionFact('mcp-narrow-alpha')
    assert.equal(alphaFact.refusalCode, 'NETWORK_DENY')
    assert.equal(alphaFact.axis, 'net.mcp')
    assert.equal(alphaFact.locator, 'p5t5mini')
    assert.equal(world.store.read(world.executionIdOf(execOf('mcp__p5t5mini__alpha', 'mcp-narrow-alpha'))).state, 'REFUSED', 'mounting is not permission: the same mounted server is still judged by the member')

    // (3) The OTHER tool of the SAME mounted server is admitted and really runs — the narrowing is
    //     per-tool, not "the server was refused".
    const beta = await cDispatchMountedMcp(world, mcp, execOf('mcp__p5t5mini__beta', 'mcp-narrow-beta'))
    assert.equal(beta.verdict.kind, 'allow')
    assert.deepEqual(beta.result, { content: [{ type: 'text', text: 'beta:mcp-narrow-beta' }] })

    // (4) MALFORMED / UNBOUND names: no prefix matching. `mcp__` names no server and `mcp__<server>`
    //     names no tool; both are refused by NAME through the ONE centre, recorded, settled REFUSED.
    for (const [name, callId] of [['mcp__', 'mcp-bare-prefix'], ['mcp__p5t5mini', 'mcp-server-only']]) {
      const run = await cDispatchMountedMcp(world, mcp, execOf(name, callId))
      assert.equal(run.verdict.kind, 'deny', name)
      assert.match(String(run.verdict.reason), /ADMISSION_TOOL_UNBOUND/u, name)
      assert.equal(run.bodyRan, false)
      const fact = world.admissionFact(callId)
      assert.equal(fact.refusalCode, 'ADMISSION_TOOL_UNBOUND')
      assert.equal(fact.axis, 'net.mcp', 'the record still says which family the malformed name claimed')
      assert.equal(world.store.read(world.executionIdOf(execOf(name, callId))).state, 'REFUSED')
    }

    // (5) LIMIT, PINNED AS A FACT: a WELL-FORMED name for a server that was never mounted is decided on
    //     the network axis alone. The centre is not mount-aware (its binding is frozen before the mount
    //     target exists), so the product's exclusion of `ghost-srv` is the mount gate + the tool registry,
    //     NOT this decision. This arm exists so the limit cannot change silently; it is stated in
    //     CAPABILITY-MATRIX-C.md as UNPROVEN at the centre.
    const ghost = await cProbeCentre(world, execOf('mcp__ghost-srv__ping', 'mcp-ghost-wellformed'))
    assert.equal(ghost.verdict.kind, 'allow', 'the DISCLOSED limit: the centre judges the name, not the mount table')
    assert.equal(ghost.bodyRan, false, 'no body exists for it: the surface, not the centre, is what stops the dispatch')
    assert.equal(mcp.definitionOf('mcp__ghost-srv__ping'), undefined, 'the product surface carries no definition for the unmounted server')
    assert.equal(world.admissionFact('mcp-ghost-wellformed').locator, 'ghost-srv')
    assert.equal(world.admissionFact('mcp-ghost-wellformed').axis, 'net.mcp')

    // (6) The COMPILED LANE still decides a mounted call when the ceiling denies: the same surface,
    //     a narrower binding, NETWORK_DENY and zero body.
    world.setBinding(bindingFromCompiledMember({
      member: cMcpCompiledMember({ network: 'deny' }).members[0],
      agentId: 'inst-mcp',
      sessionId: 'session-mcp',
      workspaceRoot: '/work/member',
      owner: 'root-mcp',
    }))
    const denied = await cDispatchMountedMcp(world, mcp, execOf('mcp__p5t5mini__beta', 'mcp-narrow-ceiling'))
    assert.equal(denied.verdict.kind, 'deny')
    assert.match(String(denied.verdict.reason), /NETWORK_DENY/u)
    assert.equal(denied.bodyRan, false)
    assert.equal(world.admissionFact('mcp-narrow-ceiling').axis, 'net.mcp')
    assert.equal(world.store.read(world.executionIdOf(execOf('mcp__p5t5mini__beta', 'mcp-narrow-ceiling'))).state, 'REFUSED')
  } finally {
    mcp.disposeAll()
    world.hostDispose()
    await closeMiniServer(mini)
    world.dispose()
  }
})

// ------------------------------------------------------------------ C-alpha6: reachable vs refused

/** The complete v5 shape (the same one the A6 root-wiring leg uses) — Alpha.6's only accepted source. */
const cAlpha6Source = () => [
  '---',
  'schemaVersion: 5',
  'blueprintId: C57-ALPHA6',
  'revision: "57"',
  'leader: { templateId: leader, persona: Lead. }',
  'members:',
  '  - templateId: officer',
  '    persona: Review asks.',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'permissionMutationEnvelope: { rules: [] }',
  'teamHardEnvelope: { rules: [] }',
  'teamEnvelope:',
  '  allow:',
  '    - request-control',
  '  deny: []',
  'metadata: {}',
  'reviewRouting:',
  '  enabled: true',
  '  officerTemplateId: officer',
  '  ordinaryToolApprovals:',
  '    default: officer',
  '    leaderExceptions: []',
  '  whenOfficerUnavailable: hold',
  '---',
  '',
].join('\n')

test('ADM-98 — C-alpha6 positive: on the only row shape where Alpha.6 is reachable, the ONE router takes a real decision and the DURABLE wake record names the routed Officer', async () => {
  const { mkdtempSync, readFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { createAlpha6RootWiring } = await import('../alpha6/root-composition.ts')
  const { createAlpha6RootRouter } = await import('../alpha6/root-router.ts')
  const { createAlpha6CategoryLookup } = await import('../alpha6/assigned-officer-facts.ts')
  const { createFileWakeIntentDirectory } = await import('../alpha6/wake-intent-directory.ts')
  const { dispatchLatch, createLatchCoordinator, latchKeyFor } = await import('../alpha6/wake-dispatch.ts')

  const ROOT = 'root-c57-alpha6'
  const OFFICER = 'inst-c57-officer'
  const OFFICER_SESSION = 'session-child-c57-officer'
  const LEADER = 'inst-c57-leader'
  // The durable control row this leg is about (an INPUT: the routing policy decides from it).
  const leg = {
    requestId: 'ctrl-c57-leg-1',
    rootSessionId: ROOT,
    approvalCaseId: 'case-c57-1',
    legOrdinal: 1,
    status: 'pending',
    kind: 'leader-approval',
    reviewAuthority: 'leader',
    requestedEffect: 'allow',
    operationFingerprint: 'sha256:c57-op',
    authorityScope: { kind: 'exact', path: '/tmp/c57' },
    reviewPayload: { authorityScope: { kind: 'exact', path: '/tmp/c57' } },
    operationToolOwner: 'dsh-agent-team',
    operationToolName: 'bash',
    operationOwnerTemplateId: 'worker',
    perEffectRequiredAuthorities: ['leader'],
  }
  const officerRow = { instanceId: OFFICER, rootSessionId: ROOT, templateId: 'officer', childSessionId: OFFICER_SESSION, lifecycle: 'RUNNING' }
  const leaderRow = { instanceId: LEADER, rootSessionId: ROOT, templateId: 'leader', childSessionId: 'session-child-c57-leader', lifecycle: 'RUNNING' }
  const control = {
    readControlState: async (rootSessionId) => (rootSessionId === ROOT
      ? { requests: [leg], transfers: [] }
      : { requests: [], transfers: [] }),
  }
  const members = {
    get: (rootSessionId, instanceId) => (rootSessionId === ROOT ? [officerRow, leaderRow].find((row) => row.instanceId === instanceId) : undefined),
    list: (rootSessionId) => (rootSessionId === ROOT ? [officerRow, leaderRow] : []),
  }

  // (1) THE OPT-IN, through the PRODUCT's one assembly. A row that did not configure the centre is the
  //     only row shape on which Alpha.6 is reachable; here it composes, naming the Officer template.
  const wiring = createAlpha6RootWiring(true, () => ({
    blueprintSource: cAlpha6Source(),
    rootSessionId: ROOT,
    leaderTemplateId: 'leader',
    members,
    control,
  }))
  assert.equal(wiring.mode, 'alpha6')
  assert.equal(wiring.officerTemplateId, 'officer')

  // (2) THE ONE SHARED ROUTER takes the decision from the durable control row + live member rows.
  const router = createAlpha6RootRouter({
    rootSessionId: ROOT,
    routing: wiring.routing,
    leaderTemplateId: 'leader',
    routingForRoot: wiring.routingForRoot,
    control,
    members: { list: members.list },
    // The SAME adapter root.ts passes: the closed-kind classifier takes a leg, the router names a kind.
    fixedLeaderOrHumanCategory: ({ kind, rootSessionId, routing }) => createAlpha6CategoryLookup()({
      rootSessionId: rootSessionId ?? ROOT,
      leg: { kind },
      routing: routing ?? wiring.routing,
    }),
  })
  const route = await router.route(leg.requestId, ROOT)
  assert.notEqual(route, null)
  assert.equal(route.kind, 'recipient')
  assert.deepEqual(route.target, { kind: 'instance', instanceId: OFFICER, templateId: 'officer', routeRole: 'officer' })
  assert.match(String(route.reason), /delegated to the dedicated Officer/u)
  assert.equal(route.currentLegId, leg.requestId)

  // (3) THE RECORD: the product's own dispatcher persists the planned wake for the reviewer the ROUTING
  //     DECISION chose, then reads it back from DISK through a FRESH directory object.
  const dir = mkdtempSync(join(tmpdir(), 'c57-alpha6-'))
  const intents = createFileWakeIntentDirectory(dir)
  const wake = {
    reviewerInstanceId: route.target.instanceId,
    targetSessionId: OFFICER_SESSION,
    templateId: route.target.templateId,
    routeRole: route.target.routeRole,
    currentLegIds: [leg.requestId],
  }
  const key = latchKeyFor(wake, ROOT, 7)
  const delivered = []
  const dispatched = await dispatchLatch({
    plan: { wakes: [wake], humanLegIds: [], held: [] },
    rootSessionId: ROOT,
    sessionGeneration: 7,
    coordinators: [createLatchCoordinator(key)],
    intent: intents.forKey(key),
    deliver: async (delivery, targetSessionId) => { delivered.push({ delivery, targetSessionId }) },
  })
  assert.deepEqual(dispatched.failures, [])
  assert.equal(delivered.length, 1, 'the routed reviewer is the one woken')
  assert.equal(delivered[0].targetSessionId, OFFICER_SESSION)
  const reread = createFileWakeIntentDirectory(dir)
  const rows = await reread.list()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].key.rootSessionId, ROOT)
  assert.equal(rows[0].key.reviewerInstanceId, OFFICER, 'the durable row names the reviewer the routing decision chose')
  assert.equal(rows[0].status, 'accepted')
  assert.equal(typeof rows[0].workFingerprint, 'string')
  assert.equal(rows[0].workFingerprint.length > 0, true)
  assert.match(readFileSync(reread.pathFor(key), 'utf8'), new RegExp(OFFICER), 'the row is a real file under the configured directory')
  assert.equal(await reread.isStopped(key), false)
})

test('ADM-99 — C-alpha6 missing seam: the CENTRE has no vocabulary for a review-routing decision, so the governed join stays EXPLICITLY UNAVAILABLE', async () => {
  const { HOST_SURFACE_REFUSALS } = await import('../src/plugin/vnext/host-surface-refusal.mjs')
  const { centreConfigViolation } = await import('../src/plugin/vnext/centre-config.ts')
  const { TOOL_AXES } = await import('../src/plugin/vnext/admission.ts')

  // (1) The CONFIG gate refuses the opt-in with its own code — and it is NOT scoped to centre-configured
  //     rows: the SAME opt-in on a row with NO centreStatePath is refused too. `validateTeamPluginConfig`
  //     is the only production enforcement point, so there is NO product-config path on which Alpha.6 is
  //     reachable at all; the machinery proven by ADM-98 is reachable only when a caller composes it
  //     directly (the direct-root/fixture shape). This is measured, not inferred.
  assert.match(
    String(centreConfigViolation({ alpha6ReviewRouting: true, centreStatePath: '/srv/centre' })),
    new RegExp(HOST_SURFACE_REFUSALS.alpha6.code, 'u'),
  )
  assert.match(
    String(centreConfigViolation({ alpha6ReviewRouting: true })),
    new RegExp(HOST_SURFACE_REFUSALS.alpha6.code, 'u'),
    'the config refusal is unconditional: an ungoverned row is refused as well',
  )

  // (2) THE MISSING SEAM, stated as a closed-vocabulary fact: no axis and no tool family in the centre
  //     can name a review-routing decision. This is why a governed decision has nowhere to be admitted.
  const vocabulary = new Set([...Object.keys(TOOL_AXES), ...CENTRE_TOOL_NAMES, ...HOST_CAPABILITY_TOOL_NAMES])
  for (const subject of ['alpha6.review-routing', 'reviewRouting', 'review_routing', 'review.route']) {
    assert.equal(vocabulary.has(subject), false, `${subject} must not be an axis the centre pretends to judge`)
  }

  // (3) Driving the centre with the decision SUBJECT shows its only possible answer: UNCLASSIFIED. It
  //     refuses with the generic unbound code and records the call on a FALLBACK axis — which is exactly
  //     the invented-axis record the cut forbids, so the row cannot be claimed as governed.
  const world = await centreWorld('alpha6-seam', {
    binding: bindingFromCompiledMember({
      member: cCompiledAnswer({
        instanceId: 'inst-alpha6',
        templateId: 'worker',
        revision: 'rev-inst-alpha6',
        read: ['/work/member'],
        write: ['/work/member'],
      }).members[0],
      agentId: 'inst-alpha6',
      sessionId: 'session-alpha6',
      workspaceRoot: '/work/member',
      owner: 'root-alpha6',
    }),
  })
  try {
    const exec = {
      name: 'alpha6.review-routing',
      callId: 'alpha6-seam-1',
      arguments: { reviewerInstanceId: 'inst-c57-officer', currentLegId: 'ctrl-c57-leg-1' },
      agent: { id: 'agent-1' },
      turn: 1,
      step: 1,
    }
    const verdict = await world.dispatch(exec)
    assert.equal(verdict.kind, 'deny')
    assert.match(String(verdict.reason), /ADMISSION_TOOL_UNBOUND/u)
    const fact = world.admissionFact(exec.callId)
    assert.equal(fact.refusalCode, 'ADMISSION_TOOL_UNBOUND')
    assert.equal(fact.decision, 'deny')
    assert.equal(fact.axis, 'fs.read', 'the record falls back to a fabricated axis: the reason a real axis (a contract change) is required')
    assert.equal(world.body.count, 0, 'zero side effects: no review decision ran through the centre')
    assert.equal(world.store.read(world.executionIdOf(exec)).state, 'REFUSED')
    // The closed table still names the absence with its OWN code and an EXISTING axis — the refusal is
    // honest, and it is the only product shape available until the axis or the join exists.
    assert.equal(HOST_SURFACE_REFUSALS.alpha6.axis, 'host.service')
    assert.match(String(HOST_SURFACE_REFUSALS.alpha6.missing), /no review-routing axis/u)
  } finally {
    world.dispose()
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// ADM-100 … ADM-102 — SHAPE A: a GOVERNED member's native tools are mounted into its own realm
// BY DEFAULT, from the preset's own rows, and the call is served by the member's CONTROLLED
// provider. Round 60 measured the defect on a live host (zero guard consults: the native `read`
// ran on the preset standing scope's BASE provider because only an explicit module row re-mounts).
//
// These arms are IN PROCESS and use the REAL pinned host: the real `@deepseek-ai/dsh-tools`
// registry, the real `@deepseek-ai/dsh-tool-fs` module, the real confined `LocalFileSystem` and
// the product's own `mountA5sfRealm` + `mountGovernedNativeToolModules` seams. No mocked host, no
// fake Member, no skipped judge: the positive arm asserts the provider CONSULTED its guard, and
// the same world without the mount is the falsifiable control.
// ─────────────────────────────────────────────────────────────────────────────

const DOMAIN_ROOT = fileURLToPath(new URL('../../../', import.meta.url))

const SHAPE_A_IDENTITY = Object.freeze({
  teamId: 'team-adm-shape-a',
  memberInstanceId: 'member-adm-shape-a',
  templateId: 'worker',
  instanceGeneration: 1,
})

const shapeALane = (allow) => Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })

/**
 * One in-process GOVERNED Member world: the preset standing scope installs the host's own tool
 * module (the inherited definition the defect ran on), the agent scope joins it, and the product's
 * realm mount installs the member's confined provider with the guard-consult sink.
 * `mountRealm: false` is the ungoverned control: there is no controlled provider at all.
 */
async function buildShapeAWorld ({ dir, mountRealm = true }) {
  const { instrumentedFileSystemClass, loadFsContractSeams } = await import('../../../tests/world-factory/lib/a5sf-fs-contract-world.mjs')
  const { mountA5sfRealm } = await import('../team-services/src/mount.ts')
  const seams = await loadFsContractSeams(DOMAIN_ROOT)
  const { Context, ToolRuntime, SystemPrompt, LocalFileSystem, createScope, bindScopeParent, nativeToolModules } = seams

  const inside = join(dir, 'inside')
  const outside = join(dir, 'outside')
  mkdirSync(inside, { recursive: true })
  mkdirSync(outside, { recursive: true })
  const insideFile = join(inside, 'doc.txt')
  const outsideFile = join(outside, 'secret.txt')
  writeFileSync(insideFile, 'ADM100-IN-LANE\n', 'utf8')
  writeFileSync(outsideFile, 'ADM100-SECRET-NOT-FOR-MEMBER\n', 'utf8')

  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  // The composition's provider: what a member resolves if nothing confines it.
  await root.plugin(LocalFileSystem, { cwd: dir, diffBasisMaxBytes: 10 * 1024 * 1024 })

  // THE PRESET TOPOLOGY. The standing scope installs the host's own tool module; this is the
  // definition the member would inherit (the base-provider definition of the finding).
  const standingKey = {}
  const standing = createScope(root, standingKey)
  await standing.ctx.plugin(nativeToolModules)

  const agentKey = {
    id: 'agent-adm-shape-a',
    session: {
      header: { cwd: inside },
      requestHeader: () => ({ config: { provider: 'mock-provider', model: 'mock-model' } }),
    },
    options: {},
  }
  const agent = createScope(root, agentKey)
  agentKey.ctx = agent.ctx
  bindScopeParent(agentKey, standingKey)
  const presetRead = root.get('tools').get('read', agentKey)

  const sinkPath = join(dir, 'guard-consult.jsonl')
  let realm
  let providerClass
  if (mountRealm) {
    const InstrumentedFs = instrumentedFileSystemClass(LocalFileSystem, [])
    providerClass = InstrumentedFs
    realm = await mountA5sfRealm({
      root: agent.ctx,
      members: [{
        identity: SHAPE_A_IDENTITY,
        policy: {
          ok: true,
          value: Object.freeze({
            memberIdentity: SHAPE_A_IDENTITY.memberInstanceId,
            templateId: SHAPE_A_IDENTITY.templateId,
            instanceGeneration: SHAPE_A_IDENTITY.instanceGeneration,
            revision: 'rev-adm-shape-a',
            read: shapeALane([inside]),
            write: shapeALane([inside]),
            network: Object.freeze({ access: 'allow' }),
          }),
        },
        config: { cwd: dir, diffBasisMaxBytes: 10 * 1024 * 1024 },
      }],
      providerClass: InstrumentedFs,
      // The product sink: every provider guard consultation lands on disk, exactly as the live
      // acceptance driver's `a5sfEvidencePath` does.
      onGuardConsult: (fact) => appendFileSync(sinkPath, `${JSON.stringify(fact)}\n`),
    })
  }

  const facts = () => {
    if (!mountRealm) return []
    let text
    try {
      text = readFileSync(sinkPath, 'utf8')
    } catch {
      return []
    }
    return text.trim() === '' ? [] : text.trim().split('\n').map((line) => JSON.parse(line))
  }

  const dispatch = async (name, args, callId) => {
    const settled = await root.get('tools').execute({
      signal: new AbortController().signal,
      callId,
      name,
      arguments: args,
      agent: agentKey,
    })
    const text = Array.isArray(settled.content)
      ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
      : ''
    return { isError: settled.isError === true, text, errorMessage: settled.error?.message, error: settled.error }
  }

  return {
    root,
    agentCtx: agent.ctx,
    agentKey,
    insideFile,
    outsideFile,
    inside,
    presetRead,
    realm,
    providerClass,
    facts,
    dispatch,
    definitionOf: (name) => root.get('tools').get(name, agentKey),
    surface: () => root.get('tools').schemas(agentKey).map((schema) => schema.name),
    async dispose () {
      if (realm !== undefined) await realm.dispose()
      await root.dispose?.()
    },
  }
}

test('ADM-100 — a GOVERNED member mounts the host native module BY DEFAULT, and the admitted read is served by the realm\'s confined provider (guard consulted)', async () => {
  const { mountGovernedNativeToolModules } = await import('../src/plugin/vnext/realm-lane.mjs')
  const dir = mkdtempSync(join(tmpdir(), 'adm-shape-a-100-'))
  const world = await buildShapeAWorld({ dir })
  let mounted
  try {
    // The module set is DERIVED from the preset's own row for `tool-fs`; no `a5sfNativeToolModules`
    // entry is configured, which is exactly the round-60 defect shape.
    mounted = await mountGovernedNativeToolModules({
      governed: true,
      realm: world.realm,
      root: world.agentCtx,
      scope: world.agentKey,
      presetModules: ['@deepseek-ai/dsh-tool-fs'],
    })
    assert.notEqual(mounted, undefined, 'a governed member with a preset native module must mount by default')
    assert.deepEqual([...mounted.modules], ['@deepseek-ai/dsh-tool-fs'])

    const resolved = world.definitionOf('read')
    assert.notEqual(resolved, world.presetRead, 'the default mount must CHANGE the definition the member resolves')
    assert.equal(String(resolved.execute), String(world.presetRead.execute), 'the body must be the HOST module\'s own, not a Team-authored shadow')

    const admitted = await world.dispatch('read', { file_path: world.insideFile }, 'adm100-inside')
    assert.equal(admitted.isError, false, `the in-lane read must succeed: ${admitted.text}`)
    assert.match(admitted.text, /ADM100-IN-LANE/u)

    // THE FINDING'S OWN PROOF: a base-provider read leaves ZERO guard consults. Exactly one allow
    // fact, naming the real member identity, means the MEMBER provider was consulted.
    const allow = world.facts().filter((fact) => String(fact.locator ?? '') === world.insideFile && fact.decision === 'allow')
    assert.ok(allow.length >= 1, `the confined provider's guard was consulted for the admitted read (facts: ${JSON.stringify(world.facts())})`)
    assert.ok(allow.every((fact) => typeof fact.memberIdentity === 'string' && fact.memberIdentity !== ''), 'an allow fact must name the member identity')

    // The out-of-lane call is refused BY THE PROVIDER PATH, typed, with zero secret bytes.
    const denied = await world.dispatch('read', { file_path: world.outsideFile }, 'adm100-outside')
    assert.equal(denied.isError, true)
    assert.doesNotMatch(denied.text, /ADM100-SECRET-NOT-FOR-MEMBER/u)
    assert.equal(world.realm.installation.members[0].faces.fs, 'confined', 'the realm that served the call owns the confined fs face')
    assert.ok(
      world.facts().some((fact) => String(fact.locator ?? '') === world.outsideFile && fact.decision === 'deny'),
      'the provider lane recorded the out-of-lane refusal as its own guard fact',
    )
  } finally {
    if (mounted !== undefined) await mounted.dispose()
    await world.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('ADM-101 — an UNGOVERNED row is unchanged: no default mount, no realm, and the inherited base provider still serves the call', async () => {
  const { mountGovernedNativeToolModules } = await import('../src/plugin/vnext/realm-lane.mjs')
  const dir = mkdtempSync(join(tmpdir(), 'adm-shape-a-101-'))
  const world = await buildShapeAWorld({ dir, mountRealm: false })
  try {
    // The decision the row makes for a member WITHOUT a centre: `governed !== true` answers
    // `undefined` before the realm or the preset rows are read. A realm double that would throw is
    // the control that proves the lane never touched it.
    let touched = false
    const untouchedRealm = {
      async mountNativeToolModules () {
        touched = true
        throw new Error('an ungoverned row must never mount native modules')
      },
    }
    const result = await mountGovernedNativeToolModules({
      governed: false,
      realm: untouchedRealm,
      root: { get: () => world.root.get('tools') },
      scope: world.agentKey,
      presetModules: ['@deepseek-ai/dsh-tool-fs'],
    })
    assert.equal(result, undefined, 'an ungoverned row must not mount anything')
    assert.equal(touched, false, 'the realm must not even be asked')

    // Today's behaviour exactly: the member resolves the inherited preset definition and the BASE
    // provider serves it (including a path outside any compiled lane, because none exists).
    assert.equal(world.definitionOf('read'), world.presetRead, 'an ungoverned row keeps the inherited definition')
    const outside = await world.dispatch('read', { file_path: world.outsideFile }, 'adm101-outside')
    assert.equal(outside.isError, false, 'with no centre there is no compiled lane, so the base provider still reads it')
    assert.match(outside.text, /ADM100-SECRET-NOT-FOR-MEMBER/u)
  } finally {
    await world.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('ADM-102 — a preset native module that cannot be RESOLVED is a TYPED fail-closed refusal, never a base-provider fallback', async () => {
  const { mountGovernedNativeToolModules, VnextRealmError } = await import('../src/plugin/vnext/realm-lane.mjs')
  const dir = mkdtempSync(join(tmpdir(), 'adm-shape-a-102-'))
  const world = await buildShapeAWorld({ dir })
  try {
    await assert.rejects(
      () => mountGovernedNativeToolModules({
        governed: true,
        realm: world.realm,
        root: world.agentCtx,
        scope: world.agentKey,
        presetModules: ['@deepseek-ai/dsh-tool-adm102-does-not-exist'],
      }),
      (error) => {
        assert.ok(error instanceof VnextRealmError, `the refusal must be the lane's typed error: ${String(error)}`)
        assert.equal(error.code, 'GOVERNED_NATIVE_MODULE_UNRESOLVED')
        assert.match(String(error.message), /adm102-does-not-exist/u)
        return true
      },
    )
    // FAIL CLOSED means the member did NOT silently continue on the inherited definition: the
    // refusal propagated and the agent still resolves the preset definition (the caller's setup
    // fails; nothing was mounted).
    assert.equal(world.definitionOf('read'), world.presetRead, 'a refused default mount leaves no shadow behind')
    assert.deepEqual(world.facts(), [], 'no confined provider call happened for a module that could not be resolved')
  } finally {
    await world.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// ADM-103 … ADM-106 — SHAPE B of the search-face CCR (round 63): the durable overlay governs ONLY
// the faces inside its closed permission vocabulary.
//
// MEASURED DEFECT: an in-lane `grep` on a governed Member was refused with
// `laneDecision=allow refusalCode=ADMISSION_OVERLAY_FAULT detail=canonicalization failed for tool
// "grep": tool-unsupported`. The lane ALLOWED the call; the overlay could not express it and turned
// its own inability into a deny. The rule now is: for a tool outside the vocabulary the overlay has
// NO OPINION (never a deny, never a fault) and the compiled LANE alone judges the call; a
// canonicalization fault on a COVERED tool is still a refusal. The durable fact records WHY
// (`overlayOutcome`), so an abstention outside the vocabulary is never read as a fault.
//
// These arms use the REAL admission centre (`installMemberCentre` → `installAdmissionPoint`), the
// REAL overlay supplier (`createOverlayDecisionProvider`), and the REAL canonicalizer. The only
// double is the durable overlay PORT (`latest`), which is the supplier's declared input boundary.
// ─────────────────────────────────────────────────────────────────────────────

const { createOverlayDecisionProvider } = await import('../src/plugin/vnext/overlay-decision.mjs')

/** One durable overlay snapshot, in the shape the real port answers (`metadata.generation` + `state.rules`). */
const overlaySnapshot = (rules, generation = 1) => ({ metadata: { generation }, state: { rules } })

/**
 * The fs seam the supplier canonicalizes through — the supplier's OWN contract (`resolve` →
 * `{ targetKey, displayPath }`, optional `contains`). `resolved` counts resolutions so an arm can
 * prove a face outside the vocabulary never even enters canonicalization.
 */
const overlayFs = (over = {}) => {
  const resolved = []
  return {
    resolved,
    async resolve (path, opts) {
      if (typeof over.throwOn === 'string' && path === over.throwOn) throw new Error(`fs seam refused ${path}`)
      const key = path.startsWith('/') ? path : `${opts?.cwd ?? '/work/a'}/${path}`
      resolved.push(key)
      return { targetKey: key, displayPath: path }
    },
    async contains (root, target) {
      return String(target?.targetKey ?? '').startsWith(`${String(root?.targetKey ?? '')}/`)
    },
  }
}

/** A member centre over the REAL overlay supplier, the REAL centre, and one durable overlay port. */
const overlayCentre = async ({ rules, fs = overlayFs() }) => {
  const host = fakeHost()
  const admitted = []
  const binding = bindingFromCompiledMember({ member: compiledMember(), agentId: 'agent-1', sessionId: 'session-1', workspaceRoot: '/work/a' })
  const supplier = createOverlayDecisionProvider({
    overlay: { latest: async () => overlaySnapshot(rules) },
    teamSessionId: 'session-1',
    memberInstanceId: 'member-1',
    workspaceRoot: '/work/a',
    fsOf: () => fs,
  })
  const centre = installMemberCentre({
    ctx: host.ctx,
    binding,
    recordAdmission: (fact) => admitted.push(fact),
    recordExecution: () => {},
    overlayDecision: supplier.decide,
  })
  /** The production ordering: the prepare listener resolves the call AHEAD of the centre's decision. */
  const dispatch = async (name, callId, args) => {
    const exec = { name, callId, arguments: args, agent: { id: 'agent-1' }, turn: 1, step: 1 }
    await supplier.prepare(exec)
    const verdict = await host.preExecute(exec)
    return { verdict, fact: admitted.find((f) => f.callId === callId) }
  }
  return { host, admitted, fs, dispatch, dispose: () => centre.dispose() }
}

test('ADM-103 — a COVERED tool with a matching durable deny rule still refuses (positive control)', async () => {
  const rig = await overlayCentre({ rules: [{ operation: 'read', effect: 'deny', resource: 'exact:/work/a/secret.txt' }] })
  try {
    const { verdict, fact } = await rig.dispatch('read', 'adm103-deny', { file_path: '/work/a/secret.txt' })
    assert.equal(verdict.kind, 'deny', 'a stored deny over a covered face must still remove authority')
    assert.equal(fact.refusalCode, 'ADMISSION_OVERLAY_DENY')
    assert.equal(fact.laneDecision, 'allow', 'the lane really allowed it; the overlay is what refused')
    assert.equal(fact.overlayOutcome, 'deny', 'the fact says the OVERLAY denied, not the lane')

    // Negative control on the same rig/rule: an uncovered path in the same lane is not restricted.
    const allowed = await rig.dispatch('read', 'adm103-allow', { file_path: '/work/a/doc.txt' })
    assert.equal(allowed.verdict.kind, 'allow')
    assert.equal(allowed.fact.overlayOutcome, 'no-opinion', 'a consulted overlay with no matching rule imposes nothing')
    assert.equal(allowed.fact.refusalCode, undefined)
  } finally {
    rig.dispose()
  }
})

test('ADM-104 — a canonicalization fault on a COVERED tool is STILL ADMISSION_OVERLAY_FAULT (faults are not silenced)', async () => {
  // `read` IS in the vocabulary, and the lane allows the locator; the FAULT is the fs seam refusing
  // to canonicalize it. Shape B must not turn this into an allow.
  const fs = overlayFs({ throwOn: '/work/a/boom.txt' })
  const rig = await overlayCentre({ rules: [], fs })
  try {
    const { verdict, fact } = await rig.dispatch('read', 'adm104-fault', { file_path: '/work/a/boom.txt' })
    assert.equal(verdict.kind, 'deny')
    assert.equal(fact.refusalCode, 'ADMISSION_OVERLAY_FAULT')
    assert.equal(fact.laneDecision, 'allow')
    assert.equal(fact.overlayOutcome, 'fault', 'the fact distinguishes a fault from an abstention')
    assert.match(String(fact.reason), /resolver-threw/u, 'the fault names the canonicalization failure')
  } finally {
    rig.dispose()
  }
})

test('ADM-105 — an out-of-vocabulary tool (grep) IN lane is ADMITTED, and the fact says the overlay abstained', async () => {
  const rig = await overlayCentre({ rules: [{ operation: 'read', effect: 'deny', resource: 'exact:/work/a/secret.txt' }] })
  try {
    // The CCR's own shape: a search inside the Member's compiled read lane.
    const { verdict, fact } = await rig.dispatch('grep', 'adm105-grep', { pattern: 'needle', path: '/work/a/docs' })
    assert.equal(verdict.kind, 'allow', 'the compiled lane alone judges a face the overlay cannot express')
    assert.equal(fact.decision, 'allow')
    assert.equal(fact.refusalCode, undefined)
    assert.equal(fact.axis, 'fs.read', 'grep is judged on the read axis by the lane')
    assert.equal(fact.overlayOutcome, 'no-opinion', 'the fact records WHY the overlay abstained')
    assert.deepEqual(rig.fs.resolved, [], 'an out-of-vocabulary tool never even enters canonicalization')
  } finally {
    rig.dispose()
  }
})

test('ADM-106 — an out-of-vocabulary tool (grep) OUT of lane is a LANE deny, not an overlay fault', async () => {
  const rig = await overlayCentre({ rules: [] })
  try {
    const { verdict, fact } = await rig.dispatch('grep', 'adm106-grep', { pattern: 'needle', path: '/work/b' })
    assert.equal(verdict.kind, 'deny')
    assert.equal(fact.refusalCode, 'LANE_DENY', 'the LANE refuses an out-of-lane search')
    assert.notEqual(fact.refusalCode, 'ADMISSION_OVERLAY_FAULT')
    assert.equal(fact.overlayOutcome, undefined, 'the overlay was never consulted: the lane refused first')
  } finally {
    rig.dispose()
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// C11 — state projections (`sessionProjections`), disposition "preserve"
//
// The frozen row (`docs/plans/memo/ute-p0-20261121/06-CAPABILITY-CONTRACT.md:44`) reads:
// capability "state projections (`sessionProjections`)", where it lives "`projection/**` +
// `todo`/`goal` faces", disposition "preserve", evidence "projection suite".
//
// Two owners are named in that row, and they are NOT the same thing:
//
//   * `projection/**` — the TEAM's whole-projection read service (`packages/runtime/projection`),
//     wired by the assembly at `root.ts:4275-4279` as
//     `createProjectionService(createTeamDomainReadPort(domain, readPortDeps),
//      createFailClosedOverlayProxy(seams.projectionLiveOverlay), { clock, schemaVersion: 2 })`
//     and served to readers as `team.getProjection` (S6). The cut replaced the entry files, so
//     THIS is the piece the cut could have silently un-wired, and it is what these arms drive.
//   * the `todo`/`goal` faces — HOST rows on the `host.service` axis (`ADM-32`), whose state lives
//     in the host's own native `sessionProjections` service. Neither the retired entry
//     (`live/agent-bindings.mjs`, `root.ts` at 1617d5839^) nor the new one references that service
//     at all (measured: `grep -c sessionProjections` → 0 in all four), so the entry replacement
//     cannot have un-wired it: it is preserved by construction. The Team-side uses are pass-through
//     READS of the HOST service, never a registration of its own — the PTY facade hands
//     `ctx.get('sessionProjections')` to the pinned backend (`team-services/src/terminal-pty.ts:400`)
//     and the P5-T5 real-instance harness restores the durable model selection with
//     `stateOf(session, 'modelSelection')` (`root-binding/harness/plugin.mjs:969-982`). Both need a
//     real host boot, so reading the service stays on the D list — it is NOT claimed here.
//
// The arms below therefore prove the C11 half a test CAN prove without a boot: the projection is
// PRESERVED in the new assembly and derives from the TeamDomain's own durable facts, with a
// positive control (a real domain change is what a reader sees, read back from the durable store
// across a cold reopen) and two negative controls (nothing is projected before the fact exists and
// a centre-refused mutation moves nothing; the live overlay is not a second authority and a
// projection pass writes nothing, while an absent TeamSession fails closed instead of being
// invented).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the projection the way the production entry does (`root.ts:4275-4279`): the REAL
 * `createTeamDomainReadPort` over the REAL durable domain, with the REAL catalog-backed template
 * resolver and the REAL committed-policy-state resolver (the same two closures the entry installs),
 * the REAL live-residency overlay (`s6-live-overlay.ts`), and `schemaVersion: 2`.
 *
 * The only INPUTS are the live glue's own residency flags and the deterministic clock — neither
 * decides a durable value. A FRESH port + service is built on every call, so a stale cache could not
 * pass the read-back assertions.
 */
const cProjectionRig = async (world, live, root) => {
  const { createTeamDomainReadPort } = await import('../src/plugin/projection-source.ts')
  const { createProjectionService } = await import('../projection/index.ts')
  const { createLiveResidencyOverlay } = await import('../src/plugin/s6-live-overlay.ts')
  const { listDurablePolicyStateTransitions } = await import('../src/plugin/durable-mutation-store.ts')
  const { committedPolicyState } = await import('../effective-policy/types.ts')
  const { DEFAULT_CONTEXT_POLICY } = await import('../../domain/member/src/index.ts')
  const { isContextPolicy } = await import('../../contracts/src/index.ts')
  const { P6T2_NOW } = await import('./p6t2-helpers.ts')

  const readPort = createTeamDomainReadPort(world.domain, {
    // The entry's own template resolver: the BOUND SNAPSHOT's rows from the CATALOG (the durable
    // home of that content), never derived from member rows.
    templates: (row) => {
      const resolved = world.catalog.resolve(row.blueprint.blueprintId, row.blueprint.revision)
      const rowOf = (kind, template, instanceQuota) => ({
        kind,
        templateId: template.templateId,
        displayName: template.displayName ?? template.templateId,
        ...(template.description !== undefined ? { description: template.description } : {}),
        contextPolicy:
          template.contextPolicy !== undefined && isContextPolicy(template.contextPolicy)
            ? template.contextPolicy
            : DEFAULT_CONTEXT_POLICY,
        ...(instanceQuota !== undefined ? { instanceQuota } : {}),
      })
      return [
        rowOf('leader', resolved.leader, undefined),
        ...resolved.members.map((member) => rowOf('member', member, resolved.quotas?.members?.maxInstances)),
      ]
    },
    // The entry's own policy-state resolver: the LAST durable transition in commit order.
    policyState: (rootSessionId) =>
      committedPolicyState(
        listDurablePolicyStateTransitions(world.domain.repositories, rootSessionId),
      ).state.stateId,
  })
  const overlay = createLiveResidencyOverlay({
    repositories: world.domain.repositories,
    live,
    now: () => P6T2_NOW,
  })
  const service = createProjectionService(readPort, overlay, { clock: () => P6T2_NOW, schemaVersion: 2 })
  return { readPort, service, project: () => service.project(root) }
}

/** The root-filtered durable ledger entries (the same read the port's summary computes over). */
const cRootLedger = (world, root) =>
  world.domain.repositories.ledger.list().filter((entry) => String(entry.rootSessionId) === String(root))

/** The durable member rows of the team root. */
const cMemberRows = (world, root) => world.domain.repositories.memberInstances.list(String(root))

/** The live-residency flags over the stage's own handle set (an INPUT, never a decision). */
const cLiveFlags = (stage) => ({
  hasLive: (sessionId) => stage.handles.has(String(sessionId)),
  isResuming: () => false,
})

test('ADM-107 — C11 POSITIVE: the projection is the TeamDomain’s own durable facts, and a real domain change is what the next reader sees (including after a cold reopen)', async () => {
  const { restartP6T1World, destroyP6T1World } = await import('./p6t1-helpers.ts')
  const { destroyDir } = await import('../../testkit/fault-injection/file-seam.mjs')
  const stage = await cStage('vnext-c11-projection-positive', { leaderChildSessionIsRoot: true })
  let reopened
  try {
    const world = stage.world
    const p0 = (await cProjectionRig(world, cLiveFlags(stage), stage.root)).project()
    const durableRow = world.domain.repositories.teamSessions.get(stage.root)
    assert.notEqual(durableRow, undefined, 'the durable TeamSession row exists')

    // (1) THE IDENTITY CORE IS THE DURABLE ROW, VERBATIM — not a re-derivation.
    assert.equal(p0.schemaVersion, 2, 'the production entry stamps the v2 projection (root.ts:4271-4279)')
    assert.equal(p0.teamSessionId, stage.root)
    assert.equal(p0.generation, durableRow.generation, 'the generation is the durable row’s generation')
    assert.deepEqual(p0.blueprint, durableRow.blueprint, 'the bound snapshot ref is the durable ref')
    assert.equal(p0.root.createdAt, durableRow.createdAt)
    assert.equal(p0.root.policyState, 'default', 'the committed durable policy state (the blueprint’s only state)')

    // (2) EVERY MEMBER ROW IS A DURABLE ROW: same set, same fields. The projection cannot add,
    //     drop, or relabel one.
    const durableRows = cMemberRows(world, stage.root)
    assert.deepEqual(
      p0.members.map((row) => row.instanceId).sort(),
      durableRows.map((row) => String(row.instanceId)).sort(),
      'the projected member set is EXACTLY the durable member set',
    )
    for (const row of durableRows) {
      const projected = p0.members.find((member) => member.instanceId === String(row.instanceId))
      assert.notEqual(projected, undefined)
      assert.equal(projected.templateId, String(row.templateId))
      assert.equal(projected.label, row.label)
      assert.equal(projected.lifecycle, row.lifecycle, 'lifecycle is the durable fact, never a live inference')
      assert.equal(projected.createdAt, row.createdAt)
      if (String(row.instanceId) === C_LEADER) {
        // The production leader row's child session IS the root; the frozen DTO contract forbids the
        // key on the LeaderInstance, and the read port normalizes exactly that shape (never invents a
        // child session for the leader, never forwards the root as one).
        assert.equal(String(row.childSessionId), stage.root, 'the fixture seeds the production leader shape')
        assert.equal('childSessionId' in projected, false, 'the LeaderInstance carries no child session (invariant 14)')
      } else {
        assert.equal(projected.childSessionId, String(row.childSessionId))
      }
    }

    // (3) THE LEDGER SUMMARY IS THE DURABLE LEDGER: the frozen invariants, computed by the port from
    //     the same list an independent read returns.
    const ledger0 = cRootLedger(world, stage.root)
    assert.equal(p0.ledger.totalEntries, ledger0.length)
    assert.equal(
      p0.ledger.latestSequence,
      ledger0.reduce((max, entry) => Math.max(max, entry.sequence), 0),
    )
    assert.equal(
      Object.values(p0.ledger.byCategory).reduce((sum, count) => sum + count, 0),
      p0.ledger.totalEntries,
      'totalEntries == sum(byCategory)',
    )
    assert.equal(p0.ledger.pendingControlCount, 0)

    // (4) THE TEMPLATES COME FROM THE BOUND SNAPSHOT, not from the member rows: the `scout` TEMPLATE
    //     exists while no `scout` MEMBER does — so "before the fact exists" the projection shows no
    //     such member. This is the negative control INSIDE the positive arm: nothing is presaged.
    assert.deepEqual(p0.templates.map((row) => row.templateId), ['leader', 'worker', 'scout'])
    assert.equal(p0.templates.find((row) => row.templateId === 'scout').contextPolicy, 'fresh_per_delegation')
    assert.equal(p0.members.some((row) => row.templateId === 'scout'), false, 'no scout member exists yet')

    // (5) POSITIVE CONTROL: a REAL domain change through the product tool surface. The create runs
    //     the product body against the REAL runtime + REAL durable domain (ADM-92's path).
    const created = await stage.leader.dispatch('team_create_member', {
      requestToken: 'tok-c11-create',
      delegationTemplateId: 'scout',
      label: 'c11-scout',
    })
    assert.equal(created.verdict.kind, 'allow')
    assert.equal(created.bodyRan, true)
    assert.equal(created.result.status, 'executed')
    const instanceId = created.result.effect.instanceId
    const childSessionId = created.result.effect.childSessionId

    // A FRESH port + service over the SAME domain (no state kept between reads, invariant 45).
    const p1 = (await cProjectionRig(world, cLiveFlags(stage), stage.root)).project()
    const newRow = cMemberRows(world, stage.root).find((row) => String(row.instanceId) === instanceId)
    assert.notEqual(newRow, undefined, 'the create committed a durable member row')
    const projectedNew = p1.members.find((row) => row.instanceId === instanceId)
    assert.notEqual(projectedNew, undefined, 'the reader sees the member the domain committed')
    assert.equal(projectedNew.templateId, 'scout')
    assert.equal(projectedNew.label, 'c11-scout')
    assert.equal(projectedNew.childSessionId, String(childSessionId))
    assert.equal(projectedNew.lifecycle, String(newRow.lifecycle))
    assert.equal(p1.members.length, p0.members.length + 1, 'the member list grew by exactly the one real change')
    assert.ok(p1.ledger.totalEntries > p0.ledger.totalEntries, 'the create committed durable ledger facts')
    assert.equal(p1.ledger.totalEntries, cRootLedger(world, stage.root).length)
    assert.equal(p1.generation, world.domain.repositories.teamSessions.get(stage.root).generation)

    // (6) DURABLE READ-BACK: close the domain and reopen the SAME store; a brand-new world and a
    //     brand-new projection agree on every durable value (the live overlay has no handles, so the
    //     residency facts — and only they — are cold).
    reopened = await restartP6T1World(world)
    const p2 = (await cProjectionRig(reopened, { hasLive: () => false, isResuming: () => false }, stage.root)).project()
    assert.equal(p2.generation, p1.generation)
    assert.equal(p2.ledger.totalEntries, p1.ledger.totalEntries)
    assert.equal(p2.ledger.latestSequence, p1.ledger.latestSequence)
    assert.deepEqual(p2.ledger.byCategory, p1.ledger.byCategory)
    assert.deepEqual(p2.members.map((row) => row.instanceId), p1.members.map((row) => row.instanceId))
    for (const row of p2.members) {
      const liveRow = p1.members.find((member) => member.instanceId === row.instanceId)
      assert.equal(row.lifecycle, liveRow.lifecycle)
      assert.equal(row.createdAt, liveRow.createdAt)
      assert.equal(row.templateId, liveRow.templateId)
    }
    assert.equal(
      p2.members.find((row) => row.instanceId === instanceId).childSessionId,
      String(childSessionId),
      'the created member survives the cold reopen',
    )
  } finally {
    if (reopened !== undefined) {
      await destroyP6T1World(reopened)
      destroyDir(stage.dir)
    } else {
      await stage.destroy()
    }
  }
})

test('ADM-108 — C11 NEGATIVE: a mutation REFUSED at the ONE centre moves NOTHING in the projection (no row, no fact, no generation)', async () => {
  const stage = await cStage('vnext-c11-projection-refusal', { leaderChildSessionIsRoot: true })
  try {
    const world = stage.world
    const read = async () => (await cProjectionRig(world, cLiveFlags(stage), stage.root)).project()
    const p0 = await read()
    const rows0 = cMemberRows(world, stage.root).map((row) => String(row.instanceId)).sort()
    const ledger0 = cRootLedger(world, stage.root).length

    // Refusal #1: an UNBOUND agent creating a member — the centre refuses BEFORE the body.
    stage.leader.setBinding(undefined)
    const unbound = await stage.leader.dispatch('team_create_member', {
      requestToken: 'tok-c11-refused',
      delegationTemplateId: 'scout',
      label: 'c11-refused-scout',
    })
    assert.equal(unbound.verdict.kind, 'deny')
    assert.match(String(unbound.verdict.reason), /ADMISSION_NO_BINDING/u)
    assert.equal(unbound.bodyRan, false, 'a refused create never reaches the product body')

    // Refusal #2: a BOUND agent, an out-of-lane locator — LANE_DENY, still before the body.
    stage.leader.setBinding(stage.leader.binding)
    const outOfLane = await stage.leader.probe('read', { file_path: '/outside/secret.txt' }, 'c11-lane-refused')
    assert.equal(outOfLane.verdict.kind, 'deny')
    assert.match(String(outOfLane.verdict.reason), /LANE_DENY/u)
    assert.equal(outOfLane.bodyRan, false)

    // THE PROJECTION DID NOT MOVE: byte-identical (the clock is deterministic, so a moved value —
    // a member, a ledger count, a generation, a stamp — would show up).
    const p1 = await read()
    assert.deepEqual(p1, p0, 'a refused mutation is not a TeamDomain fact, so the projection shows none of it')
    // ... and the DURABLE store is untouched too (the projection is not the authority asserting this).
    assert.deepEqual(cMemberRows(world, stage.root).map((row) => String(row.instanceId)).sort(), rows0)
    assert.equal(cRootLedger(world, stage.root).length, ledger0)
    assert.equal(world.domain.repositories.teamSessions.get(stage.root).generation, p0.generation)
    assert.equal(p1.members.some((row) => row.label === 'c11-refused-scout'), false)

    // POSITIVE CONTROL on the SAME world: the same tool with the binding restored DOES move both the
    // durable store and the projection — the arm is not vacuous.
    const admitted = await stage.leader.dispatch('team_create_member', {
      requestToken: 'tok-c11-admitted',
      delegationTemplateId: 'scout',
      label: 'c11-admitted-scout',
    })
    assert.equal(admitted.verdict.kind, 'allow')
    assert.equal(admitted.bodyRan, true)
    const p2 = await read()
    assert.notEqual(p2.members.length, p0.members.length)
    assert.equal(cRootLedger(world, stage.root).length > ledger0, true)
  } finally {
    await stage.destroy()
  }
})

test('ADM-109 — C11 NEGATIVE: the live overlay is not a second authority, an absent TeamSession fails closed, and a projection pass writes nothing', async () => {
  const stage = await cStage('vnext-c11-projection-no-second-authority', { leaderChildSessionIsRoot: true })
  try {
    const world = stage.world
    const rig = await cProjectionRig(world, cLiveFlags(stage), stage.root)
    const p0 = rig.project()
    const worker = p0.members.find((row) => row.instanceId === stage.worker)
    assert.notEqual(worker, undefined)
    assert.equal(worker.liveActivity.residency, 'resident', 'the seeded member’s handle IS live (the overlay input)')
    assert.equal(worker.lifecycle, 'RUNNING')

    // (1) A LIVE SESSION WITH NO DURABLE MEMBER ROW INVENTS NO MEMBER. The overlay iterates the
    //     DURABLE rows; a live handle for an unknown session contributes nothing.
    stage.handles.set('session-child-c11-ghost', { async dispose () {} })
    const p1 = (await cProjectionRig(world, cLiveFlags(stage), stage.root)).project()
    assert.equal(p1.members.length, p0.members.length)
    assert.equal(p1.members.some((row) => row.instanceId === 'inst-c11-ghost'), false)

    // (2) DROPPING THE LIVE HANDLE MOVES ONLY THE LIVE FACT. The member, its lifecycle, its durable
    //     creation stamp and the generation all survive — the durable domain, not the live glue, is
    //     the projection's authority.
    stage.handles.delete(worker.childSessionId)
    const p2 = (await cProjectionRig(world, cLiveFlags(stage), stage.root)).project()
    const worker2 = p2.members.find((row) => row.instanceId === stage.worker)
    assert.equal(worker2.liveActivity.residency, 'cold')
    assert.equal(worker2.lifecycle, worker.lifecycle)
    assert.equal(worker2.createdAt, worker.createdAt)
    assert.equal(worker2.childSessionId, worker.childSessionId)
    assert.equal(p2.generation, p0.generation, 'residency never moves the durable generation')
    assert.equal(p2.ledger.totalEntries, p0.ledger.totalEntries)

    // (3) AN ABSENT TEAM IS REFUSED, never projected as an empty team (inventing a TeamSession whose
    //     every field would be a guess).
    assert.throws(
      () => rig.readPort.readProjectionSource('session-c11-no-such-team'),
      /TEAM_PROJECTION_SOURCE_TEAM_SESSION_ABSENT/u,
    )
    assert.throws(() => rig.service.project('session-c11-no-such-team'), /TEAM_PROJECTION_SOURCE_TEAM_SESSION_ABSENT/u)

    // (4) A PROJECTION PASS WRITES NOTHING: the durable store's write counter is unchanged by reads.
    const writes = world.seam.writeCount
    rig.project()
    ;(await cProjectionRig(world, cLiveFlags(stage), stage.root)).project()
    assert.equal(world.seam.writeCount, writes, 'the projection is a read service: it cannot create a fact')
  } finally {
    await stage.destroy()
  }
})

// =============================================================== C14b: the invariants the DROP must not take
//
// C14 drops the eight governed-family bodies (fs, search, web, process, ui, inspect, agent-control,
// agent-state), their duplicated policy computation, and the old per-family equivalence requirements
// (`06-CAPABILITY-CONTRACT.md:40`, `:54-63`). C14b preserves the safety invariants those bodies
// enforced: path read/write upper bounds, network allow/deny, Control authority, Stop. Each arm below
// proves its invariant AFTER the drop, in both directions, at the component that now owns it — and
// witnesses that the body it used to live in is still gone. A refusal counts only with its own typed
// code, its durable fact and a CLOSED settlement: the A1 law, never a narrower tolerance and never a
// second authority.

const repoPath = (relative) => fileURLToPath(new URL(`../../../${relative}`, import.meta.url))

/** The C14 drop witness: an invariant may not still be enforced by a deleted body. */
const droppedFilesGone = async (paths) => {
  const { existsSync } = await import('node:fs')
  for (const path of paths) {
    assert.equal(existsSync(repoPath(path)), false, `C14 dropped ${path}; a preserved invariant must not depend on it`)
  }
}

/** The C14b owner witness: the component that now enforces the invariant is present. */
const keptFilePresent = async (path) => {
  const { existsSync } = await import('node:fs')
  assert.equal(existsSync(repoPath(path)), true, `${path} is the component that now owns the invariant and must exist`)
}

test('ADM-110 — C14b PATH BOUNDS: with the fs/search family bodies gone, read/write are still bounded at the centre AND on the RESOLVED provider path', async () => {
  // (0) THE DROP WITNESS. The bodies C14 deleted are the ones that used to compute path policy; the
  //     lifted algebra and the provider face are KEEP surfaces, and they are what the arms below use.
  await droppedFilesGone([
    'packages/tools/fs-family/src/read-executor.mjs',
    'packages/tools/fs-family/src/write-executor.mjs',
    'packages/tools/fs-family/src/fs-mechanics.mjs',
    'packages/tools/search-family/src/search-backend.mjs',
    'packages/tools/search-family/src/search-mechanics.mjs',
  ])
  await keptFilePresent('packages/runtime/member-io-policy/src/provider-capabilities.ts')

  // (1) POSITIVE CONTROL AT THE CENTRE: an in-lane read AND an in-lane write are admitted, run their
  //     bodies exactly once each, and settle COMPLETED with a durable fact on their own axis.
  const w = await centreWorld('c14b-path', { binding: binding() })
  try {
    const read = readExec('c14b-path-read')
    assert.equal((await w.dispatch(read)).kind, 'allow')
    const write = { name: 'write', callId: 'c14b-path-write', arguments: { file_path: '/work/a/new.txt', content: 'x' }, agent: { id: 'agent-1' }, turn: 1, step: 1 }
    assert.equal((await w.dispatch(write)).kind, 'allow')
    assert.equal(w.body.count, 2, 'the positive control really ran both bodies')
    assert.equal(w.store.read(w.executionIdOf(read)).state, 'COMPLETED')
    assert.equal(w.store.read(w.executionIdOf(write)).state, 'COMPLETED')
    assert.equal(w.admissionFact('c14b-path-read').axis, 'fs.read')
    assert.equal(w.admissionFact('c14b-path-write').axis, 'fs.write')

    // (2) NEGATIVE CONTROL AT THE CENTRE: the same two calls outside the lane are refused BEFORE any
    //     body, recorded with the lane's own code, and settled REFUSED/not-started.
    const outRead = readExec('c14b-path-out-read', undefined, '/work/b/secret.txt')
    const outWrite = { name: 'write', callId: 'c14b-path-out-write', arguments: { file_path: '/work/b/new.txt', content: 'x' }, agent: { id: 'agent-1' }, turn: 1, step: 1 }
    for (const exec of [outRead, outWrite]) {
      const verdict = await w.preExecute(exec)
      assert.equal(verdict.kind, 'deny', `${exec.name} outside the lane must be refused`)
      assert.match(String(verdict.reason), /LANE_DENY/u)
      w.result(exec, { isError: true, error: { message: String(verdict.reason) } })
      assert.equal(w.admissionFact(exec.callId).refusalCode, 'LANE_DENY')
      const record = w.store.read(w.executionIdOf(exec))
      assert.equal(record.state, 'REFUSED')
      assert.equal(record.observation.dispatch, 'not-started')
    }
    assert.equal(w.body.count, 2, 'a lane refusal never reaches a body')
  } finally {
    w.close()
  }

  // (3) THE SECOND LAYER, WITH A REAL FILESYSTEM: authored containment cannot decide `..` or a
  //     symlink, so the provider face takes the decision on the RESOLVED path. That algebra is the
  //     KEPT `member-io-policy` module the confined providers call — not a deleted family body.
  const { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { evaluateLocatorAccess } = await import('../member-io-policy/src/provider-capabilities.ts')
  const base = mkdtempSync(join(tmpdir(), 'c14b-path-'))
  try {
    const inside = join(base, 'inside')
    const outside = join(base, 'outside')
    mkdirSync(inside)
    mkdirSync(outside)
    writeFileSync(join(inside, 'doc.txt'), 'alpha', 'utf8')
    writeFileSync(join(outside, 'secret.txt'), 'SECRET', 'utf8')
    symlinkSync(join(outside, 'secret.txt'), join(inside, 'link-out'))
    symlinkSync(join(inside, 'doc.txt'), join(inside, 'link-in'))
    const providerLane = lane([inside])

    // POSITIVE: a real in-lane file, and an in-lane symlink that RESOLVES inside, are allowed.
    const ok = await evaluateLocatorAccess({ lane: providerLane, locator: join(inside, 'doc.txt') })
    assert.equal(ok.decision, 'allow')
    const okLink = await evaluateLocatorAccess({ lane: providerLane, locator: join(inside, 'link-in') })
    assert.equal(okLink.decision, 'allow')

    // NEGATIVE: a plain outside path.
    const out = await evaluateLocatorAccess({ lane: providerLane, locator: join(outside, 'secret.txt') })
    assert.equal(out.decision, 'deny')
    assert.equal(out.code, 'PATH_NOT_ALLOWED')

    // NEGATIVE: AUTHORED containment admits `inside/../outside/secret.txt` (the `..` segment is kept
    // literal, never folded — pinned in `path-rules.ts`), so the CENTRE allows the authored locator;
    // the RESOLVED path is outside the lane and the provider face refuses it. This is the division of
    // labour the old body performed, still enforced after the body is gone.
    // NB `path.join` would NORMALIZE the `..`; the authored string is built by hand on purpose.
    const traversal = `${inside}/../outside/secret.txt`
    assert.equal(admit({ binding: binding({ read: lane([inside]) }), toolName: 'read', arguments: { file_path: traversal } }).kind, 'allow', 'the centre decides the AUTHORED locator; the provider face must decide the resolved one')
    const escaped = await evaluateLocatorAccess({ lane: providerLane, locator: traversal })
    assert.equal(escaped.decision, 'deny')
    assert.equal(escaped.code, 'PATH_NOT_ALLOWED')

    // NEGATIVE: a symlink authored INSIDE the lane that resolves OUTSIDE it is its own typed refusal.
    const linked = await evaluateLocatorAccess({ lane: providerLane, locator: join(inside, 'link-out') })
    assert.equal(linked.decision, 'deny')
    assert.equal(linked.code, 'PATH_SYMLINK_ESCAPE')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('ADM-111 — C14b NETWORK: with the web family body gone, allow/deny still decides, and no fs lane authorises the network', async () => {
  await droppedFilesGone([
    'packages/tools/web-family/src/fetch-executor.mjs',
    'packages/tools/web-family/src/web-transport.mjs',
    'packages/tools/web-family/src/web-mechanics.mjs',
  ])
  await keptFilePresent('packages/runtime/team-services/src/web.ts')

  // (1) POSITIVE CONTROL: an explicit network allow admits the call, runs the body once, records
  //     `net.fetch` with the judged locator, and settles COMPLETED.
  const allow = await centreWorld('c14b-net-allow', { binding: binding({ network: 'allow' }) })
  try {
    const exec = { name: 'web_fetch', callId: 'c14b-net-allow-1', arguments: { url: 'https://example.test/in' }, agent: { id: 'agent-1' }, turn: 1, step: 1 }
    assert.equal((await allow.dispatch(exec)).kind, 'allow')
    assert.equal(allow.body.count, 1)
    const fact = allow.admissionFact('c14b-net-allow-1')
    assert.equal(fact.axis, 'net.fetch')
    assert.equal(fact.decision, 'allow')
    assert.equal(fact.locator, 'https://example.test/in')
    assert.equal(allow.store.read(allow.executionIdOf(exec)).state, 'COMPLETED')
  } finally {
    allow.close()
  }

  // (2) NEGATIVE CONTROL: the SAME binding's read/write lanes DO allow its workspace, and the network
  //     is still refused — an fs grant is never read as a network grant.
  const unset = await centreWorld('c14b-net-unset', { binding: binding() })
  try {
    assert.equal(binding().network, undefined, 'the negative binding really has no network axis')
    const exec = { name: 'web_fetch', callId: 'c14b-net-unset-1', arguments: { url: 'https://example.test/in' }, agent: { id: 'agent-1' }, turn: 1, step: 1 }
    const verdict = await unset.preExecute(exec)
    assert.equal(verdict.kind, 'deny')
    assert.match(String(verdict.reason), /NETWORK_DENY/u)
    assert.match(String(verdict.reason), /unset axis is not a permission/u)
    unset.result(exec, { isError: true, error: { message: String(verdict.reason) } })
    assert.equal(unset.admissionFact('c14b-net-unset-1').refusalCode, 'NETWORK_DENY')
    assert.equal(unset.store.read(unset.executionIdOf(exec)).state, 'REFUSED')
    assert.equal(unset.body.count, 0)
  } finally {
    unset.close()
  }

  // (3) NEGATIVE CONTROL 2: an explicit deny, and a TOOL-level `unsupported` that narrows a
  //     network-wide allow to a refusal — the compiled intersection decides, never the widest input.
  const deny = await centreWorld('c14b-net-deny', { binding: binding({ network: 'deny' }) })
  try {
    const verdict = await deny.preExecute({ name: 'web_fetch', callId: 'c14b-net-deny-1', arguments: { url: 'https://example.test/in' }, agent: { id: 'agent-1' }, turn: 1, step: 1 })
    assert.equal(verdict.kind, 'deny')
    assert.match(String(verdict.reason), /NETWORK_DENY/u)
    assert.equal(deny.admissionFact('c14b-net-deny-1').refusalCode, 'NETWORK_DENY')
    assert.equal(deny.body.count, 0)
  } finally {
    deny.close()
  }
  assert.equal(
    admit({ binding: binding({ network: 'allow', perTool: { web_fetch: { network: 'unsupported' } } }), toolName: 'web_fetch', arguments: { url: 'https://example.test/in' } }).code,
    'NETWORK_DENY',
    'a tool-level unsupported narrows the ceiling allow to a refusal',
  )
})

test('ADM-112 — C14b CONTROL AUTHORITY: with pa-mount-registry and pre-execute-adapter gone, the ONE durable Control plane still adjudicates every ask', async () => {
  await droppedFilesGone([
    'packages/runtime/src/plugin/live/pa-mount-registry.mjs',
    'packages/runtime/src/plugin/live/pre-execute-adapter.mjs',
    'packages/runtime/src/plugin/live/pa-control-bridge.mjs',
  ])
  await keptFilePresent('packages/runtime/control/service.ts')

  const { createP6T4World, createP6T4Service, destroyP6T1World, leaderCaller, P6T4_ROOT, P6T4_SEEDS } =
    await import('./p6t4-helpers.js')
  const { destroyDir, scratchDir } = await import('../../testkit/fault-injection/file-seam.mjs')
  destroyDir(scratchDir('vnext-c14b-control'))
  const world = await createP6T4World('vnext-c14b-control')
  const service = createP6T4Service(world)
  const worker = String(P6T4_SEEDS.worker.instanceId)
  const workerBinding = {
    agentId: worker,
    instanceId: worker,
    sessionId: P6T4_SEEDS.worker.childSessionId,
    instanceGeneration: 2,
    templateId: 'worker',
    read: lane(['/work/a'], ['/work/ask']),
    write: lane(['/work/a']),
    workspaceRoot: '/work/a',
    policyGeneration: 'gen-7',
    owner: P6T4_ROOT,
  }
  try {
    // (1) NEGATIVE CONTROL: an ask whose grant half is missing cannot be spent, so it is refused as
    //     UNWIRED — never self-approved, never forwarded to the host as an implicit allow.
    const unwired = await centreWorld('c14b-control-unwired', { binding: workerBinding })
    try {
      const exec = { name: 'read', callId: 'c14b-control-unwired-1', arguments: { file_path: '/work/ask/doc.txt' }, agent: { id: worker }, turn: 1, step: 1 }
      const verdict = await unwired.preExecute(exec)
      assert.equal(verdict.kind, 'deny')
      assert.match(String(verdict.reason), /ADMISSION_ASK_UNWIRED/u)
      unwired.result(exec, { isError: true, error: { message: String(verdict.reason) } })
      assert.equal(unwired.admissionFact('c14b-control-unwired-1').refusalCode, 'ADMISSION_ASK_UNWIRED')
      assert.equal(unwired.store.read(unwired.executionIdOf(exec)).state, 'REFUSED')
      assert.equal(unwired.body.count, 0)
    } finally {
      unwired.close()
    }

    // (2) NEGATIVE CONTROL 2 + POSITIVE, over the REAL durable Control plane: the leader DENIES one
    //     ask (refused, body never runs) and ALLOWS the next (one durable request, one durable
    //     decision, one one-shot spend, body runs once).
    let consumed = 0
    const binder = createInvocationBinder()
    const countedBinder = {
      bind: (input) => binder.bind(input),
      consume: (capability, request) => {
        consumed += 1
        return binder.consume(capability, request)
      },
    }
    const approvals = createControlApprovalPort({
      controlOf: () => service,
      onRequested: async (record) => {
        const decision = record.correlation === 'admission:c14b-control-deny' ? 'deny' : 'allow'
        await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: record.requestId, decision })
      },
    })
    const centre = await centreWorld('c14b-control', {
      binding: workerBinding,
      grants: {
        binder: countedBinder,
        memberOf: (b) => ({ teamId: b.owner, memberInstanceId: b.instanceId, templateId: b.templateId, instanceGeneration: b.instanceGeneration }),
      },
      approvals,
    })
    try {
      const denied = { name: 'read', callId: 'c14b-control-deny', arguments: { file_path: '/work/ask/doc.txt' }, agent: { id: worker }, turn: 1, step: 1 }
      const deniedVerdict = await centre.preExecute(denied)
      assert.equal(deniedVerdict.kind, 'deny')
      assert.match(String(deniedVerdict.reason), /ADMISSION_APPROVAL_DENIED/u)
      centre.result(denied, { isError: true, error: { message: String(deniedVerdict.reason) } })
      assert.equal(centre.admissionFact('c14b-control-deny').refusalCode, 'ADMISSION_APPROVAL_DENIED')
      assert.equal(centre.store.read(centre.executionIdOf(denied)).state, 'REFUSED')
      assert.equal(centre.body.count, 0)
      assert.equal(consumed, 0, 'a denied ask spends nothing')

      const approved = { name: 'read', callId: 'c14b-control-allow', arguments: { file_path: '/work/ask/doc.txt' }, agent: { id: worker }, turn: 1, step: 1 }
      assert.equal((await centre.dispatch(approved)).kind, 'allow')
      assert.equal(consumed, 1, 'the approved ask is spent exactly once, at the guard')
      assert.equal(centre.body.count, 1)
      assert.equal(centre.store.read(centre.executionIdOf(approved)).state, 'COMPLETED')

      // THE DURABLE SIDE: one request per ask, one decision each, and the decisions are the leader's
      // own rows in the Control plane — the centre is not a second approval authority.
      const state = await service.listControlState(P6T4_ROOT)
      assert.equal(state.requests.length, 2)
      assert.deepEqual(state.decisions.map((row) => row.decision), ['deny', 'allow'])
    } finally {
      centre.close()
    }
  } finally {
    await destroyP6T1World(world)
  }
})

test('ADM-113 — C14b STOP: with the family bodies gone, Stop is still the ONE host signal, REFUSED/not-started, and durable across a fresh reader', async () => {
  await droppedFilesGone([
    'packages/tools/fs-family/src/read-executor.mjs',
    'packages/tools/process-family/src/confined-shell-executor.mjs',
  ])
  await keptFilePresent('packages/runtime/control/service.ts')
  await keptFilePresent('packages/runtime/settlement/execution-settlement.ts')

  // (1) POSITIVE CONTROL: without a Stop the same call is admitted, runs, and settles COMPLETED —
  //     so a Stop refusal cannot be what this assembly always says.
  const ok = await centreWorld('c14b-stop-ok', { binding: binding() })
  try {
    const exec = readExec('c14b-stop-ok-1')
    assert.equal((await ok.dispatch(exec)).kind, 'allow')
    assert.equal(ok.body.count, 1)
    assert.equal(ok.store.read(ok.executionIdOf(exec)).state, 'COMPLETED')
  } finally {
    ok.close()
  }

  // (2) NEGATIVE CONTROL: the host's own abort signal refuses the call before the body, with its own
  //     code, and the settlement says not-started with no execution state.
  const w = await centreWorld('c14b-stop', { binding: binding() })
  try {
    const controller = new AbortController()
    controller.abort()
    const stopped = readExec('c14b-stop-1', controller.signal)
    const verdict = await w.preExecute(stopped)
    assert.equal(verdict.kind, 'deny')
    assert.match(String(verdict.reason), /ADMISSION_STOPPED/u)
    assert.equal(w.body.count, 0)
    w.result(stopped, { isError: true, error: { message: String(verdict.reason) } })
    const fact = w.admissionFact('c14b-stop-1')
    assert.equal(fact.refusalCode, 'ADMISSION_STOPPED')
    assert.notEqual(fact.refusalCode, 'LANE_DENY', 'a Stop is never recorded as a lane rule')
    const record = w.store.read(w.executionIdOf(stopped))
    assert.equal(record.state, 'REFUSED')
    assert.equal(record.observation.dispatch, 'not-started')
    assert.equal(record.observation.bodyOutcome, 'not-started')
    assert.deepEqual(record.transitions.map((entry) => entry.to), ['ADMITTED', 'REFUSED'])

    // (3) DURABLE AND NON-REPLAYING AFTER THE DROP: a FRESH store over the same directory reads the
    //     same REFUSED record, and NOTHING is left open to be recovered as UNKNOWN.
    const { createExecutionSettlementStore } = await import('../settlement/execution-settlement.ts')
    const { join } = await import('node:path')
    const fresh = createExecutionSettlementStore({ dir: join(w.dir, 'settlement') })
    const reread = fresh.read(w.executionIdOf(stopped))
    assert.equal(reread.state, 'REFUSED')
    assert.equal(reread.observation.dispatch, 'not-started')
    assert.equal(fresh.recoverUnsettled(new Date().toISOString()).length, 0, 'a Stop leaves no open record to replay')
    assert.equal(w.ledger.readAll().filter((entry) => entry.kind === 'execution' && entry.callId === 'c14b-stop-1').length, 1, 'exactly one execution fact, never a replay')
  } finally {
    w.close()
  }
})

test('ADM-114 — C14b PROCESS: with the process family body gone, an unjudgeable shell is REFUSED by the centre, never run unconfined', async () => {
  await droppedFilesGone([
    'packages/tools/process-family/src/confined-shell-executor.mjs',
    'packages/tools/process-family/src/bash-contribution.mjs',
    'packages/tools/process-family/src/pwsh-executor.mjs',
  ])
  await keptFilePresent('packages/runtime/team-services/src/subprocess.ts')

  const w = await centreWorld('c14b-process', { binding: binding() })
  try {
    // (1) POSITIVE CONTROL: the SAME binding still admits a call it can judge (`fs.read`), so the
    //     process refusal is not a blanket refusal of everything.
    const read = readExec('c14b-process-read')
    assert.equal((await w.dispatch(read)).kind, 'allow')
    assert.equal(w.body.count, 1)

    // (2) NEGATIVE CONTROL: `bash` has no compiled tool-level EXECUTION authorization in this
    //     binding, so it is refused at the ONE centre with its own code, on its own axis, before any
    //     body — the invariant "no unconfined shell" survives as a typed refusal (round 75: the
    //     absence is execution authority, not a path lane), not as an unjudged execution.
    const bash = { name: 'bash', callId: 'c14b-process-bash', arguments: { command: 'cat /etc/passwd' }, agent: { id: 'agent-1' }, turn: 1, step: 1 }
    const verdict = await w.preExecute(bash)
    assert.equal(verdict.kind, 'deny')
    assert.match(String(verdict.reason), /ADMISSION_EXECUTION_UNAUTHORIZED/u)
    w.result(bash, { isError: true, error: { message: String(verdict.reason) } })
    const fact = w.admissionFact('c14b-process-bash')
    assert.equal(fact.axis, 'process.exec')
    assert.equal(fact.refusalCode, 'ADMISSION_EXECUTION_UNAUTHORIZED')
    const record = w.store.read(w.executionIdOf(bash))
    assert.equal(record.state, 'REFUSED')
    assert.equal(record.observation.dispatch, 'not-started')
    assert.equal(w.body.count, 1, 'the shell body was never entered')

    // (3) NEGATIVE CONTROL 2: PTC is its OWN absence, not the generic shell code — the escalation
    //     authority is not the centre, and the call is still refused before the body.
    assert.equal(admit({ binding: binding(), toolName: 'run_code', arguments: { code: '1' } }).code, 'ADMISSION_PTC_UNAVAILABLE')
  } finally {
    w.close()
  }
})

test('ADM-115 — C14b NAME DISCIPLINE: the dropped families’ tool names are not silently admitted, and preserved host faces keep their own axis', async () => {
  await droppedFilesGone([
    'packages/tools/ui-family/src/ask-executor.mjs',
    'packages/tools/inspect-family/src/skill-executor.mjs',
    'packages/tools/agent-control-family/src/fork-row.mjs',
    'packages/tools/agent-state-family/src/executors.mjs',
  ])

  // POSITIVE CONTROL: the preserved host capabilities the four deleted families re-homed are admitted
  // for a bound agent and recorded on `host.service` (their I/O is the host's, a stated limit).
  const w = await centreWorld('c14b-names', { binding: binding() })
  try {
    for (const toolName of ['skill', 'subagent', 'todo_write', 'get_goal']) {
      const exec = { name: toolName, callId: `c14b-names-${toolName}`, arguments: {}, agent: { id: 'agent-1' }, turn: 1, step: 1 }
      assert.equal((await w.dispatch(exec)).kind, 'allow', `${toolName} is a preserved host capability`)
      assert.equal(w.admissionFact(`c14b-names-${toolName}`).axis, 'host.service')
    }
    assert.equal(w.body.count, 4)

    // NEGATIVE CONTROL: the names that had a body and no preserved home are REFUSED by the centre as
    // unbound — the drop did not leave a name that the composition could still execute.
    for (const toolName of ['ask_user_question', 'present', 'exit_plan_mode', 'team_skill']) {
      const exec = { name: toolName, callId: `c14b-names-dropped-${toolName}`, arguments: {}, agent: { id: 'agent-1' }, turn: 1, step: 1 }
      const verdict = await w.preExecute(exec)
      assert.equal(verdict.kind, 'deny', `${toolName} has no preserved home and must be refused`)
      assert.match(String(verdict.reason), /ADMISSION_TOOL_UNBOUND/u)
      w.result(exec, { isError: true, error: { message: String(verdict.reason) } })
      assert.equal(w.store.read(w.executionIdOf(exec)).state, 'REFUSED')
    }
    assert.equal(w.body.count, 4, 'no dropped name reached a body')
  } finally {
    w.close()
  }
})

// ============================================================================================
// Round 68 (shape A) — the host entry records the refusal it already decides.
//
// The round-63 live measurement found the one honest gap in the Alpha.6 row: the gate
// (`centre-config.ts` at `host.ts`) refused the row correctly, but the product's own recorder
// (`createHostSurfaceRefusalPoint`) was only built inside `root.ts`, so the refusal left NO durable
// fact and NO settlement at the host entry. These arms drive the EXACT functions the entry now wires:
// `centreConfigViolation` (the unchanged rule), `createAlpha6RowRefusalHook` (what `host.ts` passes to
// `validateTeamPluginConfig`), and `createCentreHostSurfacePoint` (the ONE construction `root.ts` and
// the entry share). No arm needs a host boot, and none re-implements the rule.
// ============================================================================================

const alpha6RowConfig = (over = {}) => ({
  bootPhase: 'create',
  rootSessionId: 'session-row-68',
  blueprintSource: 'blueprintId: ROW-68\nrevision: "1"\n',
  generation: 1,
  seedMembers: [],
  staticModel: { provider: 'p', model: 'm' },
  deniedSelection: null,
  mcpServer: null,
  environmentFacts: [],
  externalPolicyFacts: { hard: {}, capabilityExists: {} },
  ...over,
})

test('ADM-116 — C-alpha6 recorded refusal (a): the Alpha.6 row is still refused AND the refusal now exists as a durable fact + REFUSED settlement', async () => {
  const { mkdtempSync, existsSync, readFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { centreConfigViolation } = await import('../src/plugin/vnext/centre-config.ts')
  const { HOST_SURFACE_REFUSALS } = await import('../src/plugin/vnext/host-surface-refusal.mjs')
  const { createAlpha6RowRefusalHook } = await import('../src/plugin/vnext/row-refusal-entry.ts')

  const dir = mkdtempSync(join(tmpdir(), 'row68-recorded-'))
  const config = alpha6RowConfig({ alpha6ReviewRouting: true, centreStatePath: dir })

  // (1) THE DECISION IS UNCHANGED. The rule still refuses with its own code and names the missing
  //     axis, and the message a caller sees is byte-identical to the pre-round text (`fail()` wraps
  //     it in `TEAM_PLUGIN_CONFIG_INVALID`, which this rule does not touch).
  const violation = centreConfigViolation(config)
  assert.equal(typeof violation, 'string', 'an Alpha.6 opt-in is still refused, not accepted')
  assert.match(String(violation), new RegExp(`^${HOST_SURFACE_REFUSALS.alpha6.code}:`, 'u'))
  assert.match(String(violation), /no review-routing axis/u)
  assert.match(String(violation), /explicitly unavailable in this cut/u)

  // (2) THE RECORD. This is the hook the host entry passes to `validateTeamPluginConfig`; the entry
  //     runs it AT the centre rule, before the unchanged throw.
  const recorded = []
  const faults = []
  const hook = createAlpha6RowRefusalHook({
    onFault: (error, context) => faults.push([error, context]),
    onRecorded: (row) => recorded.push(row),
  })
  hook(String(violation), config)
  assert.equal(faults.length, 0, `recording must be clean: ${String(faults[0]?.[0]?.message ?? '')}`)
  assert.equal(recorded.length, 1, 'the entry records exactly one refusal for exactly one row')
  assert.equal(recorded[0].code, HOST_SURFACE_REFUSALS.alpha6.code)
  assert.equal(recorded[0].capability, 'alpha6')

  // (3) THE FACT, read back from DISK through a FRESH ledger (never the writer's memory).
  const factPath = join(dir, 'alpha6.host-surface.facts.jsonl')
  assert.equal(existsSync(factPath), true, 'the refusal fact file exists at the row centre path')
  const { openFactLedger } = await import('../src/plugin/vnext/fact-ledger.mjs')
  const facts = openFactLedger({ path: factPath }).readAll()
  const admissionFacts = facts.filter((record) => record.kind === 'invocation-authority')
  assert.equal(admissionFacts.length, 1)
  const fact = admissionFacts[0]
  assert.equal(fact.decision, 'deny')
  assert.equal(fact.refusalCode, HOST_SURFACE_REFUSALS.alpha6.code)
  assert.equal(fact.axis, 'host.service', 'the record uses the subject\'s EXISTING axis; no new axis was invented')
  assert.equal(fact.toolName, 'alpha6.review-routing')
  assert.equal(fact.callId, recorded[0].callId)
  assert.match(String(fact.reason), /no review-routing axis/u)

  // (4) THE SETTLEMENT, read back from DISK through a FRESH store: closed REFUSED at birth.
  const store = createExecutionSettlementStore({ dir: join(dir, 'settlement', 'host-surface', 'alpha6') })
  const settled = store.read(dispatchExecutionId({ rootSessionId: 'session-row-68', agentInstanceId: 'host-surface' }, fact.callId))
  assert.equal(settled.state, 'REFUSED')
  assert.equal(settled.observation.dispatch, 'not-started')
  assert.equal(settled.observation.bodyOutcome, 'not-started')
  assert.deepEqual(settled.transitions.map((transition) => transition.to), ['ADMITTED', 'REFUSED'])

  // (5) THE WIRING IS PINNED AT THE ENTRY: `host.ts` passes this hook to the validator at the centre
  //     rule, and `root.ts` builds the point through the same constructor. A source-shape assertion is
  //     used because `host.ts` cannot be imported under node type-stripping (parameter properties).
  const hostSource = readFileSync(new URL('../src/plugin/host.ts', import.meta.url), 'utf8')
  assert.match(hostSource, /validateTeamPluginConfig\(config, \{\s*onCentreRefusal: createAlpha6RowRefusalHook\(/u)
  assert.match(hostSource, /hooks\?\.onCentreRefusal\?\.\(centreViolation/u)
  const rootSource = readFileSync(new URL('../src/plugin/vnext/root.ts', import.meta.url), 'utf8')
  assert.match(rootSource, /createCentreHostSurfacePoint\(\{/u)
})

test('ADM-117 — C-alpha6 recorded refusal (b) POSITIVE CONTROL: a row without the Alpha.6 point is unaffected — it validates/binds and writes NO refusal', async () => {
  const { mkdtempSync, existsSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { centreConfigViolation } = await import('../src/plugin/vnext/centre-config.ts')
  const { createAlpha6RowRefusalHook } = await import('../src/plugin/vnext/row-refusal-entry.ts')

  const dir = mkdtempSync(join(tmpdir(), 'row68-control-'))
  const config = alpha6RowConfig({ centreStatePath: dir })

  // (1) The SAME row without the opt-in passes the centre rule, so validation proceeds and the row
  //     would bind. The centre configuration alone is not a refusal.
  assert.equal(centreConfigViolation(config), undefined)

  // (2) No centre refusal happens, so the entry's hook is never called by the validator. Driving it
  //     with the absence of a violation must be inert (the hook is not a second gate).
  const recorded = []
  const hook = createAlpha6RowRefusalHook({ onRecorded: (row) => recorded.push(row) })
  hook(undefined, config) // defensive: no violation string means nothing was refused
  assert.equal(recorded.length, 0)
  assert.equal(existsSync(join(dir, 'alpha6.host-surface.facts.jsonl')), false, 'a bound row never gets a refusal fact')
  assert.equal(existsSync(join(dir, 'settlement', 'host-surface', 'alpha6')), false, 'a bound row never gets a refusal settlement')

  // (3) AND THE BIND STILL WORKS: the same centre composition admits an in-lane call and settles it
  //     COMPLETED, so "unaffected" is measured, not asserted from the absence of an exception.
  const w = await centreWorld('row68-control', { binding: binding() })
  try {
    const verdict = await w.dispatch(readExec('row68-control-read'))
    assert.equal(verdict.kind, 'allow')
    assert.equal(w.body.count, 1)
    assert.equal(w.store.read(w.executionIdOf(readExec('row68-control-read'))).state, 'COMPLETED')
  } finally {
    w.close()
  }
})

test('ADM-118 — C-alpha6 recorded refusal (c): a covered-face fault elsewhere is untouched — the shared point still records remote, and a non-Alpha.6 centre violation records nothing', async () => {
  const { mkdtempSync, existsSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { centreConfigViolation } = await import('../src/plugin/vnext/centre-config.ts')
  const { HOST_SURFACE_REFUSALS, refuseHostSurfaceBefore } = await import('../src/plugin/vnext/host-surface-refusal.mjs')
  const { createAlpha6RowRefusalHook, createCentreHostSurfacePoint, recordAlpha6RowRefusal } = await import('../src/plugin/vnext/row-refusal-entry.ts')

  const dir = mkdtempSync(join(tmpdir(), 'row68-covered-'))

  // (1) THE OTHER COVERED FACE still records through the SAME construction (the constructor root.ts
  //     uses), into ITS own file — the new entry recorder did not take over or displace it.
  const remotePoint = createCentreHostSurfacePoint({ capability: 'remote', centreStatePath: dir, rootSessionId: 'session-row-68' })
  assert.notEqual(remotePoint, undefined)
  assert.equal(refuseHostSurfaceBefore(remotePoint, { subject: 'remote.surface', owner: 'session-row-68', locator: 'session-row-68' }), true)
  assert.equal(existsSync(join(dir, 'remote.host-surface.facts.jsonl')), true)
  const { openFactLedger } = await import('../src/plugin/vnext/fact-ledger.mjs')
  const remoteFacts = openFactLedger({ path: join(dir, 'remote.host-surface.facts.jsonl') }).readAll()
    .filter((record) => record.kind === 'invocation-authority')
  assert.equal(remoteFacts.length, 1)
  assert.equal(remoteFacts[0].refusalCode, HOST_SURFACE_REFUSALS.remote.code)
  assert.equal(existsSync(join(dir, 'alpha6.host-surface.facts.jsonl')), false, 'the remote refusal writes only the remote face')

  // (2) A NON-Alpha.6 centre violation is refused exactly as before and the emergency recorder stays
  //     out of the way: it must not blame Alpha.6 for a different fault.
  const badField = alpha6RowConfig({ centreStatePath: 42 })
  const badViolation = centreConfigViolation(badField)
  assert.match(String(badViolation), /centreStatePath must be a non-empty string/u)
  assert.equal(recordAlpha6RowRefusal({ violation: String(badViolation), config: badField }), undefined)
  const recorded = []
  createAlpha6RowRefusalHook({ onRecorded: (row) => recorded.push(row) })(String(badViolation), badField)
  assert.equal(recorded.length, 0, 'a covered-face config fault elsewhere writes no Alpha.6 refusal')
  assert.equal(existsSync(join(dir, 'alpha6.host-surface.facts.jsonl')), false)
})

// ================================================ SETTLEMENT OPTION A (round 73)
//
// "Admitted as allow, then refused before the body" now has a TRUTHFUL terminal state, under the
// owner-approved Option A (docs/reviews/20261122-1536.txt §2; CONTRACT-CHANGE-REQUEST-settlement-
// recheck.md): the original allow is never rewritten, the recheck appends a NEW durable deny decision
// for the same call (same executionId, its own policyGeneration), and settlement may then reach
// REFUSED/not-started citing THAT decision — only while the body demonstrably never started.
//
// The six arms below run over the REAL store, the REAL settlement port and the REAL fact ledger. The
// two negatives are what keep the relaxation from becoming a hole: without a durable deny the old
// SETTLEMENT_ADMISSION_MISMATCH still refuses the terminal write, and a call that reached RUNNING can
// never be back-filled into a pre-execution refusal.

/** One dispatch that stops at the guard, between the two consultations, so the recheck can refuse. */
const recheckWorld = async (label, { dir, store, ledger } = {}) => {
  const world = await centreWorld(label, {
    binding: binding({ policyGeneration: 'gen-1' }),
    ...(dir === undefined ? {} : { dir }),
    ...(store === undefined ? {} : { store }),
    ...(ledger === undefined ? {} : { ledger }),
  })
  let phase = 'pre'
  const wide = binding({ policyGeneration: 'gen-1' })
  const narrow = binding({ policyGeneration: 'gen-2', read: lane(['/work/b']) })
  world.setResolve(() => (phase === 'pre' ? wide : narrow))
  const exec = readExec(`${label}-1`)
  const preVerdict = await world.preExecute(exec)
  assert.equal(preVerdict.kind, 'allow', 'the call is admitted BEFORE the authority changes')
  const executionId = world.executionIdOf(exec)
  const opened = world.store.read(executionId)
  const allowFact = world.ledger.readAll().find((record) => record.kind === 'invocation-authority' && record.callId === exec.callId)
  phase = 'guard'
  const refusal = world.guard(exec)
  return { world, exec, phase, executionId, opened, allowFact, refusal, setPhase: (value) => { phase = value } }
}

test('ADM-119 — SETTLEMENT OPTION A (positive): allow → durable recheck deny → REFUSED/not-started citing the deny; the allow survives unchanged', async () => {
  const { world, exec, executionId, opened, allowFact, refusal } = await recheckWorld('option-a')
  try {
    // (1) THE ORDER IS THE GUARANTEE. At the moment the guard refuses, the durable deny is ALREADY on
    //     disk while the record is still ADMITTED: the decision precedes the termination, which is what
    //     makes the crash window (ADM-123) recoverable instead of lossy.
    assert.match(String(refusal), /^ADMISSION_RECHECK_LANE_DENY:/u, 'the refusal is the product\'s existing recheck code')
    const denied = world.store.read(executionId)
    assert.equal(denied.state, 'ADMITTED', 'the deny decision is written BEFORE the settlement terminates')
    assert.equal(denied.recheckDecisions.length, 1, 'exactly one durable deny decision is appended')
    assert.equal(denied.admission.decision, 'allow', 'the admission still says allow')
    assert.equal(denied.terminalDecision, undefined)

    // (2) THE HOST NOW SETTLES THE REFUSED CALL through the real port.
    assert.equal(world.body.count, 0, 'the body never ran')
    world.result(exec, { isError: true, error: { message: String(refusal) } })
    const record = world.store.read(executionId)

    // (3) THE TERMINAL STATE. REFUSED, not-started, and citing the SECOND decision — never UNKNOWN,
    //     never CANCELLED (there was no Stop), never FAILED (the body did not run).
    assert.equal(record.state, 'REFUSED')
    assert.equal(record.observation.dispatch, 'not-started')
    assert.equal(record.observation.bodyOutcome, 'not-started')
    assert.equal(record.observation.effectEvidence, 'none-confirmed')
    assert.deepEqual(record.transitions.map((entry) => entry.to), ['ADMITTED', 'REFUSED'], 'the call never entered an execution state')
    assert.match(String(record.terminalReason), /ADMISSION_RECHECK_LANE_DENY/u)
    assert.equal(record.terminalDecision.decision, 'deny')
    assert.equal(record.terminalDecision.decisionId, `admission-recheck:${exec.callId}`)
    assert.equal(record.terminalDecision.subjectExecutionId, executionId, 'the deny is for the SAME execution')
    assert.equal(record.terminalDecision.callId, exec.callId, 'and for the SAME callId')
    assert.deepEqual(record.terminalDecision, record.recheckDecisions[0], 'terminalDecision IS the appended deny')

    // (4) THE ORIGINAL ALLOW IS TRUE HISTORY: still readable, byte-for-byte unchanged, and it names the
    //     generation it was issued under. The deny names a DIFFERENT generation — that difference is the
    //     revocation, not a rewritten allow.
    assert.deepEqual(record.admission, opened.admission, 'the admission reference is untouched by the recheck')
    assert.equal(record.admission.decision, 'allow')
    assert.equal(record.admission.decisionId, `admission:${exec.callId}`)
    const allowFactAfter = world.ledger.readAll().find((entry) => entry.kind === 'invocation-authority' && entry.callId === exec.callId)
    assert.deepEqual(allowFactAfter, allowFact, 'the durable allow fact is unchanged after the refusal')
    assert.equal(allowFact.decision, 'allow')
    assert.equal(allowFact.policyGeneration, 'gen-1', 'the allow was issued under gen-1')
    assert.equal(record.terminalDecision.policyGeneration, 'gen-2', 'the deny was issued under gen-2')
    assert.notEqual(record.terminalDecision.policyGeneration, allowFact.policyGeneration)

    // (5) The durable execution fact keeps the provenance too, and nothing is left open to recover.
    const execution = world.ledger.readAll().find((entry) => entry.kind === 'execution' && entry.callId === exec.callId)
    assert.equal(execution.outcome, 'admission-refusal')
    assert.equal(execution.refusalCode, 'ADMISSION_RECHECK_LANE_DENY')
    assert.equal(world.store.recoverUnsettled(new Date().toISOString()).length, 0, 'nothing is left ADMITTED')
    assert.deepEqual(world.faults, [], 'no gap, no fault: the refusal is fully evidenced')
  } finally {
    world.close()
  }
})

test('ADM-120 — SETTLEMENT OPTION A (negative 1): REFUSED against an allow WITHOUT a durable recheck deny still fails exactly as today', async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = mkdtempSync(join(tmpdir(), 'option-a-no-deny-'))
  const store = createExecutionSettlementStore({ dir })
  const faults = []
  const identityOf = (exec) => ({ executionId: `exec-${exec.callId}`, actorId: 'agent-1', worldId: 'session-1' })
  const writer = createSettlementWriter({ store, identityOf, onFault: (error, context) => faults.push([error, context]) })
  const exec = readExec('no-deny-1')

  // Admitted as allow, nothing else. THE RELAXATION IS NOT "REFUSED FROM ADMITTED": it is "REFUSED FROM
  // ADMITTED WITH A DURABLE RECHECK DENY", and without the deny the old invariant is intact.
  writer.admitted({ exec, callId: exec.callId, admission: { kind: 'allow', code: 'LANE_ALLOW', reason: 'in lane' } })
  const observation = { executionId: 'exec-no-deny-1', dispatch: 'not-started', bodyOutcome: 'not-started', effectEvidence: 'none-confirmed', observedEffects: [] }
  assert.throws(
    () => store.settle({ executionId: 'exec-no-deny-1', state: 'REFUSED', observation, at: new Date().toISOString(), reason: 'a refusal nobody recorded' }),
    (error) => error?.code === 'SETTLEMENT_ADMISSION_MISMATCH',
    'the store still refuses a REFUSED that contradicts a recorded allow with no second decision',
  )
  // ...and the PORT still reports the gap and leaves the record open rather than settle a lie.
  writer.refused({ exec, code: 'ADMISSION_RECHECK_LANE_DENY', reason: 'refused' })
  assert.equal(store.read('exec-no-deny-1').state, 'ADMITTED', 'no terminal state is fabricated')
  assert.ok(faults.some(([error]) => error?.code === 'SETTLEMENT_CONTRACT_GAP'), 'the gap is surfaced')
  assert.deepEqual(store.read('exec-no-deny-1').recheckDecisions ?? [], [], 'no decision was invented')
})

test('ADM-121 — SETTLEMENT OPTION A (negative 2): a call that reached RUNNING cannot be back-filled with a pre-execution refusal', async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = mkdtempSync(join(tmpdir(), 'option-a-running-'))
  const store = createExecutionSettlementStore({ dir })
  const faults = []
  const identityOf = (exec) => ({ executionId: `exec-${exec.callId}`, actorId: 'agent-1', worldId: 'session-1' })
  const writer = createSettlementWriter({ store, identityOf, onFault: (error, context) => faults.push([error, context]) })
  const exec = readExec('running-1')
  writer.admitted({ exec, callId: exec.callId, admission: { kind: 'allow', code: 'LANE_ALLOW', reason: 'in lane' } })
  writer.running({ exec })
  assert.equal(store.read('exec-running-1').state, 'RUNNING')

  // (1) The deny decision cannot be appended after dispatch: a "pre-execution" refusal recorded after
  //     the body started would be a back-fill, and the store names the reason it refuses it.
  assert.throws(
    () => store.recordRecheckDecision({
      executionId: 'exec-running-1',
      at: new Date().toISOString(),
      decision: {
        decisionId: 'admission-recheck:running-1',
        decisionDigest: 'a'.repeat(64),
        decision: 'deny',
        decisionKind: 'recheck-decision',
        reasonCode: 'ADMISSION_RECHECK_LANE_DENY',
        subjectExecutionId: 'exec-running-1',
        callId: 'running-1',
        policyGeneration: 'gen-2',
        decidedAt: new Date().toISOString(),
      },
    }),
    (error) => error?.code === 'RECHECK_NOT_BEFORE_BODY',
    'a deny decision cannot be appended once the body may have run',
  )

  // (2) And the settlement cannot be forced to REFUSED from RUNNING: the state machine has no such
  //     transition, so the port's refused() throws rather than silently rewriting the record.
  const observation = { executionId: 'exec-running-1', dispatch: 'not-started', bodyOutcome: 'not-started', effectEvidence: 'none-confirmed', observedEffects: [] }
  assert.throws(
    () => store.settle({ executionId: 'exec-running-1', state: 'REFUSED', observation, at: new Date().toISOString(), reason: 'back-filled' }),
    (error) => error?.code === 'ILLEGAL_TRANSITION',
    'RUNNING → REFUSED is not a legal transition',
  )
  assert.throws(
    () => writer.refused({ exec, code: 'ADMISSION_RECHECK_LANE_DENY', reason: 'back-filled' }),
    (error) => error?.code === 'ILLEGAL_TRANSITION',
    'the port does not paper over the illegal transition',
  )
  assert.equal(store.read('exec-running-1').state, 'RUNNING', 'the record keeps its real phase')
  assert.deepEqual(store.read('exec-running-1').recheckDecisions ?? [], [])

  // (3) The mirror-image guard: once a durable deny EXISTS, the call cannot enter RUNNING either — the
  //     store itself is the bar, not a promise of one caller.
  const dir2 = mkdtempSync(join(tmpdir(), 'option-a-deny-bar-'))
  const store2 = createExecutionSettlementStore({ dir: dir2 })
  const writer2 = createSettlementWriter({
    store: store2,
    identityOf: (value) => ({ executionId: `exec-${value.callId}`, actorId: 'agent-1', worldId: 'session-1' }),
    onFault: () => {},
  })
  const exec2 = readExec('deny-bar-1')
  writer2.admitted({ exec: exec2, callId: exec2.callId, admission: { kind: 'allow', code: 'LANE_ALLOW', reason: 'in lane' } })
  writer2.recheckDenied({ exec: exec2, callId: exec2.callId, code: 'ADMISSION_RECHECK_LANE_DENY', reason: 'narrowed', policyGeneration: 'gen-2' })
  assert.throws(
    () => writer2.running({ exec: exec2 }),
    (error) => error?.code === 'RECHECK_DENY_BLOCKS_DISPATCH',
    'a durable recheck deny blocks the body even if a caller forgets to check it',
  )
})

test('ADM-122 — SETTLEMENT OPTION A (negative 3): a Stop still settles CANCELLED with its own fact, and a refusal is never CANCELLED', async () => {
  // (1) THE STOP PATH. The host's OWN signal is the authority: a pre-dispatch Stop, CANCELLED, and no
  //     fabricated refusal decision — the two are different events and must stay different states.
  const stopWorld = await centreWorld('option-a-stop', { binding: binding({ policyGeneration: 'gen-1' }) })
  try {
    const controller = new AbortController()
    const exec = readExec('option-a-stop-1', controller.signal)
    assert.equal((await stopWorld.preExecute(exec)).kind, 'allow')
    const opened = stopWorld.store.read(stopWorld.executionIdOf(exec))
    assert.equal(opened.state, 'ADMITTED')
    controller.abort()
    const stopped = stopWorld.guard(exec)
    assert.match(String(stopped), /ADMISSION_STOPPED/u)
    stopWorld.result(exec, { isError: true, error: { message: String(stopped) } })
    const record = stopWorld.store.read(stopWorld.executionIdOf(exec))
    assert.equal(record.state, 'CANCELLED', 'a Stop is CANCELLED, never REFUSED')
    assert.deepEqual(record.stops.map((entry) => entry.phase), ['pre-dispatch'], 'the Stop fact is recorded')
    assert.deepEqual(record.transitions.map((entry) => entry.to), ['ADMITTED', 'CANCELLED'])
    assert.equal(record.admission.decision, 'allow', 'the admission is still allow')
    assert.deepEqual(record.recheckDecisions ?? [], [], 'no deny decision is invented for a Stop')
    assert.equal(record.terminalDecision, undefined)
    assert.equal(stopWorld.ledger.readAll().find((entry) => entry.kind === 'execution' && entry.callId === 'option-a-stop-1').refusalCode, 'ADMISSION_STOPPED')
  } finally {
    stopWorld.close()
  }

  // (2) THE REFUSAL PATH, same assembly without a Stop: REFUSED with NO stop record. The refusal is
  //     never laundered into CANCELLED (which would make a security refusal look like an operator act).
  const refused = await recheckWorld('option-a-not-cancelled')
  try {
    refused.world.result(refused.exec, { isError: true, error: { message: String(refused.refusal) } })
    const record = refused.world.store.read(refused.executionId)
    assert.equal(record.state, 'REFUSED')
    assert.notEqual(record.state, 'CANCELLED')
    assert.deepEqual(record.stops, [], 'a recheck refusal records no Stop')
    assert.equal(record.terminalDecision.decision, 'deny')
  } finally {
    refused.world.close()
  }
})

test('ADM-123 — SETTLEMENT OPTION A (crash window): deny written, settlement not terminated — a fresh store recovers REFUSED/not-started from the durable deny, never replays the call', async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = mkdtempSync(join(tmpdir(), 'option-a-crash-'))
  const ledgerPath = join(dir, 'option-a-crash.facts.jsonl')
  const settlementDir = join(dir, 'settlement')
  const ledger1 = openFactLedger({ path: ledgerPath })
  const store1 = createExecutionSettlementStore({ dir: settlementDir })
  const crashed = await recheckWorld('option-a-crash', { dir, ledger: ledger1, store: store1 })
  const callId = crashed.exec.callId
  try {
    // THE WINDOW: the deny is durable, the record is still ADMITTED, and the process "dies" before the
    // host ever emits a result. No tools/result, no terminal write.
    assert.match(String(crashed.refusal), /^ADMISSION_RECHECK_LANE_DENY:/u)
    const beforeCrash = store1.read(crashed.executionId)
    assert.equal(beforeCrash.state, 'ADMITTED')
    assert.equal(beforeCrash.recheckDecisions.length, 1)
    assert.equal(beforeCrash.terminalDecision, undefined)
    assert.equal(ledger1.readAll().filter((entry) => entry.kind === 'execution' && entry.callId === callId).length, 0, 'the crash happened before any execution fact')
  } finally {
    crashed.world.dispose()
  }

  // (1) A FRESH STORE over the same directory: recovery reads the durable deny and settles the refusal
  //     the dead process already made. It does NOT classify the call as UNKNOWN.
  const store2 = createExecutionSettlementStore({ dir: settlementDir })
  const recovered = store2.recoverUnsettled(new Date().toISOString())
  assert.equal(recovered.length, 1, 'exactly the one open record is reconciled')
  assert.equal(recovered[0].before, 'ADMITTED')
  assert.equal(recovered[0].after, 'REFUSED')
  const record = store2.read(crashed.executionId)
  assert.equal(record.state, 'REFUSED')
  assert.equal(record.observation.dispatch, 'not-started')
  assert.equal(record.observation.bodyOutcome, 'not-started')
  assert.equal(record.observation.effectEvidence, 'none-confirmed')
  assert.equal(record.terminalDecision.decisionId, `admission-recheck:${callId}`)
  assert.equal(record.admission.decision, 'allow', 'the allow the dead process recorded is still the history')
  assert.match(String(record.terminalReason), /ADMISSION_RECHECK_LANE_DENY/u)
  // Idempotent: a second recovery rewrites nothing.
  assert.equal(store2.recoverUnsettled(new Date().toISOString()).length, 0)

  // (2) THE CALL IS NOT REPLAYED. A fresh ledger over the same file still holds the durable admission,
  //     so the same callId meets the replay rule at pre-execute — before the lane, before the body —
  //     and the body counter never moves.
  const ledger2 = openFactLedger({ path: ledgerPath })
  assert.equal(ledger2.has(callId), true, 'the durable admission survived the crash')
  const rebooted = await centreWorld('option-a-crash-reboot', { dir, ledger: ledger2, store: store2, binding: binding() })
  try {
    const replay = readExec(callId)
    const verdict = await rebooted.preExecute(replay)
    assert.equal(verdict.kind, 'deny')
    assert.match(String(verdict.reason), /ADMISSION_REPLAY/u, 'the callId is refused as a replay, not re-judged')
    rebooted.result(replay, { isError: true, error: { message: String(verdict.reason) } })
    assert.equal(rebooted.body.count, 0, 'the tool body is NOT re-run on recovery')
    const authorityRecords = ledger2.readAll().filter((entry) => entry.kind === 'invocation-authority' && entry.callId === callId)
    assert.equal(authorityRecords.length, 1, 'no second admission record was appended for the replay')
    const executionFacts = ledger2.readAll().filter((entry) => entry.kind === 'execution' && entry.callId === callId)
    assert.equal(executionFacts.length, 1, 'the replay refusal is the only execution fact; recovery itself wrote none')
    assert.equal(executionFacts[0].refusalCode, 'ADMISSION_REPLAY', 'and it names the replay, not a tool body outcome')
    assert.equal(store2.read(crashed.executionId).state, 'REFUSED', 'the recovered terminal state is not rewritten by the replay')
  } finally {
    rebooted.close()
  }
})

test('ADM-124 — SETTLEMENT OPTION A (fail-closed): when the deny-decision write fails, the call still does not run and the failure is surfaced', async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const realStore = createExecutionSettlementStore({ dir: mkdtempSync(join(tmpdir(), 'option-a-fail-')) })
  const failingStore = {
    ...realStore,
    recordRecheckDecision: () => { const error = new Error('disk full: the deny decision is not durable'); error.code = 'SETTLEMENT_WRITE_FAILED'; throw error },
  }
  const world = await recheckWorld('option-a-fail', { store: failingStore })
  try {
    // (1) The recheck still REFUSES. The body never runs: a persistence failure must never turn a
    //     refusal into a permission.
    assert.match(String(world.refusal), /^ADMISSION_RECHECK_LANE_DENY:/u)
    assert.equal(world.world.body.count, 0, 'the refusal happens even though the decision could not be written')
    assert.ok(
      world.world.faults.some(([error, context]) => context?.phase === 'recheck' && /disk full/u.test(String(error?.message))),
      'the persistence failure is surfaced through the fault sink',
    )
    // (2) The settlement is NOT silently settled: there is no durable deny, so the terminal write
    //     reports the gap and the record stays ADMITTED (recovery may classify it UNKNOWN, which is
    //     honest about what this process could prove).
    world.world.result(world.exec, { isError: true, error: { message: String(world.refusal) } })
    const record = world.world.store.read(world.executionId)
    assert.equal(record.state, 'ADMITTED', 'a refusal nobody could write down is not settled as a refusal')
    assert.equal(record.terminalDecision, undefined)
    assert.ok(world.world.faults.some(([error]) => error?.code === 'SETTLEMENT_CONTRACT_GAP'), 'the gap is surfaced, never swallowed')
  } finally {
    world.world.close()
  }
})

// ============================================================================
// ROUND 75 — PROCESS EXECUTION AUTHORITY IS NOT PATH AUTHORITY
// (owner ruling, review 20261122-1536 §1)
//
// What these arms pin, in the order the ruling names it:
//   ADM-125  allow  ⇒ the process tool runs AND the call is recorded (fact + settlement)
//   ADM-126  deny   ⇒ refused before the body, with its own code
//   ADM-127  ask    ⇒ a durable Control decision, then the body under a one-shot grant
//   ADM-128  a declared boundary with no ready executor ⇒ typed refusal, no body
//   ADM-129  grep runs on its fs.read lane with NO process authority anywhere
//   ADM-130  a process's file reach is the OS profile's, not a path lane (in-process half)
//
// The process authority is the v4 declaration the compiled answer already carries
// (`toolBindings[].authorization` + `execution.executionBoundary`). These arms never author a lane
// and never pass a cwd as a permission.
// ============================================================================

/** A compiled per-tool entry: exactly what `projectToolIoRestriction` now carries. */
const processTool = (authorization, boundary = 'confined-subprocess') => ({
  authorization,
  execution: { implementationOrigin: 'dsh-native', executionBoundary: boundary },
})

/** A binding whose `bash` tool has a compiled execution authorization and a ready executor. */
const processBinding = (authorization, over = {}) => binding({
  instanceId: 'member-1',
  templateId: 'worker',
  executors: { 'confined-subprocess': 'ready' },
  perTool: { bash: processTool(authorization) },
  ...over,
})

const bashExec = (callId, command = 'echo round-75') => ({
  name: 'bash',
  callId,
  arguments: { command },
  agent: { id: 'agent-1' },
  turn: 1,
  step: 1,
})

test('ADM-125 — a process tool ALLOWED by its tool-level authorization runs, and the call is recorded', async () => {
  const world = await centreWorld('round75-allow', { binding: processBinding('allow') })
  try {
    const exec = bashExec('r75-allow-1')
    const verdict = await world.dispatch(exec)
    assert.equal(verdict.kind, 'allow', 'the compiled tool-level authorization is what admits the shell')
    assert.equal(world.body.count, 1, 'the admitted body really ran')
    const fact = world.admissionFact('r75-allow-1')
    assert.equal(fact.decision, 'allow')
    assert.equal(fact.axis, 'process.exec')
    assert.equal(fact.refusalCode, undefined)
    assert.equal(fact.policyGeneration, 'gen-7', 'the fact names the policy generation the authorization came from')
    const record = world.store.read(world.executionIdOf(exec))
    assert.equal(record.state, 'COMPLETED', 'the settlement follows the run, not a refusal')
    // The cwd is recorded as CONTEXT and was never an input: moving it changes nothing.
    assert.equal(fact.locator, '/work/a', 'the fact still names the working directory it observed')
    world.setBinding(processBinding('allow', { workspaceRoot: '/elsewhere/entirely' }))
    assert.equal((await world.dispatch(bashExec('r75-allow-2'))).kind, 'allow', 'a different cwd is the same authority')
  } finally {
    world.close()
  }
})

test('ADM-126 — a tool-level DENY refuses the shell before the body, with its own code', async () => {
  const world = await centreWorld('round75-deny', { binding: processBinding('deny') })
  try {
    const exec = bashExec('r75-deny-1')
    const verdict = await world.dispatch(exec)
    assert.equal(verdict.kind, 'deny')
    assert.match(String(verdict.reason), /ADMISSION_EXECUTION_DENIED/u)
    assert.equal(world.body.count, 0, 'deny is decided before the body')
    const fact = world.admissionFact('r75-deny-1')
    assert.equal(fact.decision, 'deny')
    assert.equal(fact.refusalCode, 'ADMISSION_EXECUTION_DENIED')
    assert.equal(fact.axis, 'process.exec')
    const record = world.store.read(world.executionIdOf(exec))
    assert.equal(record.state, 'REFUSED')
    assert.equal(record.observation.dispatch, 'not-started')
    // A DENY does not need an executor fact: it wins even when the executor is ready, and it wins
    // when it is not (a reviewer is never asked to approve what the declaration forbids).
    const noExecutor = binding({
      instanceId: 'member-1',
      templateId: 'worker',
      executors: { 'confined-subprocess': 'unavailable' },
      perTool: { bash: processTool('deny') },
    })
    const deniedAnyway = admit({ binding: noExecutor, toolName: 'bash', arguments: { command: 'ls' } })
    assert.equal(deniedAnyway.code, 'ADMISSION_EXECUTION_DENIED', 'deny outranks the executor check')
  } finally {
    world.close()
  }
})

test('ADM-127 — an ASK goes to the durable Control plane, and only the approval admits the shell', async () => {
  const approvals = approvalsAnswer({ ok: true, approval: { approvalId: 'r75-approval', policyRevision: 'gen-7' } })
  const world = await centreWorld('round75-ask', {
    binding: processBinding('ask'),
    grants: {
      binder: createInvocationBinder(),
      memberOf: (b) => ({ teamId: b.owner, memberInstanceId: b.instanceId, templateId: b.templateId, instanceGeneration: b.instanceGeneration }),
    },
    approvals: approvals.port,
  })
  try {
    const exec = bashExec('r75-ask-1')
    const verdict = await world.dispatch(exec)
    assert.equal(verdict.kind, 'allow', 'the approval lands, the grant is spent, the call runs')
    assert.equal(approvals.asked.length, 1, 'exactly one durable approval request')
    assert.equal(approvals.asked[0].toolName, 'bash', 'the reviewer is asked about THIS tool')
    assert.match(String(approvals.asked[0].laneReason ?? ''), /executionBoundary/u, 'the request names the declared execution boundary')
    assert.equal(world.body.count, 1)
    const fact = world.admissionFact('r75-ask-1')
    assert.equal(fact.decision, 'allow')
    assert.equal(fact.laneDecision, 'ask', 'the record keeps the lane answer the centre overruled by approval')
    assert.equal(world.store.read(world.executionIdOf(exec)).state, 'COMPLETED')

    // NEGATIVE HALF: a DENIED Control decision refuses before the body. Without this the arm could
    // pass on an approval port that says yes to everything.
    const deniedApprovals = approvalsAnswer({ ok: false, code: 'ADMISSION_APPROVAL_DENIED', reason: 'the operator said no' })
    const deniedWorld = await centreWorld('round75-ask-denied', {
      binding: processBinding('ask'),
      grants: {
        binder: createInvocationBinder(),
        memberOf: (b) => ({ teamId: b.owner, memberInstanceId: b.instanceId, templateId: b.templateId, instanceGeneration: b.instanceGeneration }),
      },
      approvals: deniedApprovals.port,
    })
    try {
      const deniedExec = bashExec('r75-ask-2')
      const deniedVerdict = await deniedWorld.dispatch(deniedExec)
      assert.equal(deniedVerdict.kind, 'deny')
      assert.match(String(deniedVerdict.reason), /ADMISSION_APPROVAL_DENIED/u)
      assert.equal(deniedWorld.body.count, 0, 'a denied approval never reaches the body')
      assert.equal(deniedWorld.store.read(deniedWorld.executionIdOf(deniedExec)).state, 'REFUSED')
    } finally {
      deniedWorld.close()
    }
  } finally {
    world.close()
  }
})

test('ADM-128 — a declared boundary with NO ready executor is a typed refusal, never a narrow run', () => {
  // (1) No readiness fact at all: UNKNOWN is not ready.
  const unknown = binding({
    instanceId: 'member-1',
    templateId: 'worker',
    perTool: { bash: processTool('allow') },
  })
  const unknownDecision = admit({ binding: unknown, toolName: 'bash', arguments: { command: 'ls' } })
  assert.equal(unknownDecision.kind, 'deny')
  assert.equal(unknownDecision.code, 'ADMISSION_EXECUTOR_UNAVAILABLE')
  assert.match(String(unknownDecision.reason), /UNKNOWN/u)

  // (2) The composition says the confined executor is unavailable (no OS sandbox face).
  const unavailable = binding({
    instanceId: 'member-1',
    templateId: 'worker',
    executors: { 'confined-subprocess': 'unavailable' },
    perTool: { bash: processTool('allow') },
  })
  const unavailableDecision = admit({ binding: unavailable, toolName: 'bash', arguments: { command: 'ls' } })
  assert.equal(unavailableDecision.kind, 'deny')
  assert.equal(unavailableDecision.code, 'ADMISSION_EXECUTOR_UNAVAILABLE')
  assert.match(String(unavailableDecision.reason), /UNAVAILABLE/u)

  // (3) The SAME authorization against the boundary it declared READY is admitted: the refusal is
  //     about the executor, not about the tool. A `trusted-host` declaration is not satisfied by a
  //     ready `confined-subprocess` entry and vice versa.
  const mismatch = binding({
    instanceId: 'member-1',
    templateId: 'worker',
    executors: { 'confined-subprocess': 'ready' },
    perTool: { bash: processTool('allow', 'delegated-remote') },
  })
  assert.equal(admit({ binding: mismatch, toolName: 'bash', arguments: { command: 'ls' } }).code, 'ADMISSION_EXECUTOR_UNAVAILABLE', 'a different boundary is a different executor')
  const trusted = binding({
    instanceId: 'member-1',
    templateId: 'worker',
    executors: { 'trusted-host': 'ready' },
    perTool: { bash: processTool('allow', 'trusted-host') },
  })
  assert.equal(admit({ binding: trusted, toolName: 'bash', arguments: { command: 'ls' } }).kind, 'allow')

  // (4) A declaration whose authorization is absent is NOT an executor problem and never becomes
  //     one: absence of execution authority keeps its own code.
  assert.equal(admit({ binding: binding(), toolName: 'bash', arguments: { command: 'ls' } }).code, 'ADMISSION_EXECUTION_UNAUTHORIZED')
})

test('ADM-129 — grep runs on its fs.read lane and needs NO process authority', async () => {
  // A binding whose `bash` is explicitly DENIED (and has no executor), so any implementation that
  // routed grep through process authority would refuse the search. grep must still be admitted.
  const world = await centreWorld('round75-grep', { binding: processBinding('deny') })
  try {
    const exec = {
      name: 'grep',
      callId: 'r75-grep-1',
      arguments: { pattern: 'needle', path: '/work/a' },
      agent: { id: 'agent-1' },
      turn: 1,
      step: 1,
    }
    const verdict = await world.dispatch(exec)
    assert.equal(verdict.kind, 'allow', 'grep is a search tool on the read lane; bash authority is irrelevant to it')
    assert.equal(world.body.count, 1)
    const fact = world.admissionFact('r75-grep-1')
    assert.equal(fact.axis, 'fs.read', 'the record says which lane actually judged it')
    // The process tool is still refused on the SAME binding: the two decisions are independent.
    assert.equal(admit({ binding: processBinding('deny'), toolName: 'bash', arguments: { command: 'ls' } }).code, 'ADMISSION_EXECUTION_DENIED')
    // And an out-of-lane search is still a lane denial, not a process refusal.
    const outOfLane = { ...exec, callId: 'r75-grep-2', arguments: { pattern: 'needle', path: '/elsewhere' } }
    const outVerdict = await world.dispatch(outOfLane)
    assert.equal(outVerdict.kind, 'deny')
    assert.equal(world.admissionFact('r75-grep-2').refusalCode, 'LANE_DENY', 'the read lane decides, and it is not a process code')
  } finally {
    world.close()
  }
})

test('ADM-130 — a process\'s file reach is bounded by the OS profile and the three lanes, never by a path lane', async () => {
  const { compileExecutionProfile } = await import('../team-sandbox/src/profile.ts')
  const effective = {
    read: lane(['/work/a']),
    write: lane(['/work/a/out']),
    network: { access: 'deny' },
  }
  const compiled = compileExecutionProfile(effective)
  assert.equal(compiled.ok, true, `the effective lanes must compile to an OS profile: ${JSON.stringify(compiled)}`)
  const readPaths = compiled.value.readPaths
  assert.deepEqual(readPaths, ['/work/a'], 'the OS read reach is the effective READ lane')
  assert.deepEqual(compiled.value.writeOnlyPaths, ['/work/a/out'], 'the OS write-only reach is the effective WRITE lane')
  assert.equal(compiled.value.networkProfile, 'deny', 'the network reach is the compiled network axis')
  assert.equal(readPaths.includes('/etc/passwd'), false, 'an outside path is not in the profile by construction')
  assert.equal(readPaths.includes('/work/a/out'), false, 'and the write-only subtree is not a read root')
  // The profile refuses to express a lane it cannot honour, rather than widening it.
  const askLane = compileExecutionProfile({ read: lane(['/work/a'], ['/work/a/secret']), write: lane(['/work/a']), network: { access: 'deny' } })
  assert.equal(askLane.ok, false)
  assert.equal(askLane.code, 'PATH_LANE_UNSUPPORTED', 'an ask is an approval, never an OS grant')

  // WHAT THIS ARM CANNOT PROVE (stated, not implied): it does NOT run a child under Landlock, so it
  // proves the PROFILE the executor applies, not the kernel's answer to it. Kernel enforcement is
  // measured by the OS arms (`dev/agent-workflow/evidence/a5sf-bl16-grep/`, `a5sf-p1-07/OS-RUNNER-
  // EVIDENCE.md`) and by the live boot; this arm would be dishonest if it claimed otherwise.
})

// ============================================================================
// ROUND 76 — THE AUTHORED DECLARATION IS WHAT CARRIES EXECUTION AUTHORITY
//
// Round 75 pinned the ADMISSION half (a compiled per-tool entry admits/asks/
// denies). This round closes the gap on the AUTHORING side: a Team's v4
// blueprint now declares `toolBindings[]` for `bash`, and that declaration
// alone must produce the compiled authorization the centre judges. The chain
// exercised here is the product's own, end to end and with no hand-built
// per-tool object:
//
//   authored entry → projectToolIoRestriction → compileEffectiveIo
//                  → bindingFromCompiledMember → admit
//
// ADM-131 covers allow / ask / deny from the SAME authored document (one
// positive and two negative arms), and asserts that the declaration is NOT a
// path lane: the io lanes it declares do not narrow the Member's ceiling.
// ADM-132 pins the model-visible `bash` SURFACE the governed composition now
// mounts: the pinned HOST persistent definition, `command` as the only
// parameter, over `ctx.terminals` (never `ctx.shell`).
// ============================================================================

/** The exact authored entry the D3 acceptance world puts in its blueprint. */
const authoredBashBinding = (authorization = 'allow') => ({
  owner: 'dsh.subprocess',
  name: 'bash',
  authorization,
  io: {
    read: { mode: 'all', deny: [] },
    write: { mode: 'all', deny: [] },
    network: { mode: 'allow' },
  },
  execution: { implementationOrigin: 'dsh-native', executionBoundary: 'confined-subprocess' },
})

/** The compiled member the centre receives, built through the product's assembler. */
const compiledBashBinding = async (authorization) => {
  const { projectToolIoRestriction, compileEffectiveIo } = await import('../member-io-policy/src/compile.ts')
  const tool = projectToolIoRestriction(authoredBashBinding(authorization))
  assert.equal(tool.ok, true, `the authored binding must project: ${JSON.stringify(tool)}`)
  const ceiling = {
    memberIdentity: 'member-1',
    templateId: 'worker-a',
    revision: 'rev-1',
    instanceGeneration: 2,
    read: lane(['/work/a']),
    write: lane(['/work/a']),
    network: { access: 'allow' },
  }
  const invocation = {
    memberIdentity: 'member-1',
    callId: 'call-1',
    policyRevision: 'rev-1',
    toolBindingIdentity: tool.value.bindingIdentity,
  }
  const effective = compileEffectiveIo(ceiling, tool.value, invocation)
  assert.equal(effective.ok, true, `the effective io must compile: ${JSON.stringify(effective)}`)
  const binding = bindingFromCompiledMember({
    member: {
      policy: { value: ceiling },
      identity: { instanceId: 'member-1', instanceGeneration: 2, blueprintRevision: 'bp-rev-1' },
      definitionSource: '@deepseek-ai/dsh-tool-bash-persistent',
    },
    bindings: [{
      toolName: tool.value.toolName,
      effective: effective.value,
      authorization: tool.value.authorization,
      execution: tool.value.execution,
    }],
    agentId: 'agent-1',
    sessionId: 'session-1',
    workspaceRoot: '/work/a',
    owner: 'team-root-1',
    instanceId: 'member-1',
    executors: { 'confined-subprocess': 'ready' },
  })
  return { tool: tool.value, effective: effective.value, binding }
}

test('ADM-131 — a v4-authored toolBindings[] alone carries allow / ask / deny into admission', async () => {
  // ── allow: the authored declaration is the whole reason the shell is admitted ──
  const allowed = await compiledBashBinding('allow')
  assert.equal(allowed.tool.bindingIdentity, 'dsh.subprocess/bash', 'the binding identity is the authoring owner/name')
  assert.equal(allowed.tool.authorization, 'allow', 'the authorization came from the authored entry, not a default')
  assert.deepEqual(allowed.tool.execution, { implementationOrigin: 'dsh-native', executionBoundary: 'confined-subprocess' })
  // The authored io adds NO path narrowing: the effective lanes are exactly the
  // Member's ceiling lanes (the projection's all/empty-deny lane contributes
  // nothing to intersect). That is the property that keeps process authority
  // from becoming a second, weaker lane.
  assert.deepEqual(allowed.effective.read, lane(['/work/a']), 'an all/empty-deny lane adds NO path narrowing')
  assert.deepEqual(allowed.effective.write, lane(['/work/a']), 'execution authority is not smuggled in as a path lane')
  assert.equal(allowed.effective.network.access, 'allow')
  assert.equal(allowed.binding.perTool.bash.authorization, 'allow')
  const allowVerdict = admit({ binding: allowed.binding, toolName: 'bash', arguments: { command: 'echo r76' } })
  assert.equal(allowVerdict.kind, 'allow', 'the authored allow is what admits the process tool')

  // ── ask: the same document, one word changed, parks the call for a Control decision ──
  const asked = await compiledBashBinding('ask')
  const askVerdict = admit({ binding: asked.binding, toolName: 'bash', arguments: { command: 'echo r76' } })
  assert.equal(askVerdict.kind, 'ask', 'an authored ask is a Control decision, never a silent allow')

  // ── deny: and a deny refuses before any body ──
  const denied = await compiledBashBinding('deny')
  const denyVerdict = admit({ binding: denied.binding, toolName: 'bash', arguments: { command: 'echo r76' } })
  assert.equal(denyVerdict.kind, 'deny')
  assert.equal(denyVerdict.code, 'ADMISSION_EXECUTION_DENIED', 'a declared deny has its own typed refusal')

  // ── and the truth that makes the three arms meaningful: with NO authored
  //    binding, the same binding refuses as UNAUTHORIZED (it never defaults to allow) ──
  const { bindingFromCompiledMember: assemble } = await import('../src/plugin/vnext/centre-install.mjs')
  const noAuthority = assemble({
    member: {
      policy: { value: { memberIdentity: 'member-1', templateId: 'worker-a', revision: 'rev-1', read: lane(['/work/a']), write: lane(['/work/a']), network: { access: 'allow' } } },
      identity: { instanceId: 'member-1', instanceGeneration: 2, blueprintRevision: 'bp-rev-1' },
      definitionSource: '@deepseek-ai/dsh-tool-bash',
    },
    bindings: [],
    agentId: 'agent-1',
    sessionId: 'session-1',
    workspaceRoot: '/work/a',
    owner: 'team-root-1',
    executors: { 'confined-subprocess': 'ready' },
  })
  const unauthorized = admit({ binding: noAuthority, toolName: 'bash', arguments: { command: 'echo r76' } })
  assert.equal(unauthorized.kind, 'deny')
  assert.equal(unauthorized.code, 'ADMISSION_EXECUTION_UNAUTHORIZED', 'no declaration is never an implicit allow')
})

test('ADM-132 — the governed bash SURFACE is the pinned HOST persistent definition, command-only, over terminals', async () => {
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))

  // (1) THE DEFINITION ITSELF: mount the pinned host module and read the tool it
  //     registers. This is the model-visible surface, measured, not quoted.
  const { apply, inject, name } = await import('@deepseek-ai/dsh-tool-bash-persistent')
  assert.equal(name, 'tool-bash-persistent')
  assert.ok(inject.includes('terminals'), 'the persistent body resolves ctx.terminals (the governed PTY face)')
  assert.equal(inject.includes('shell'), false, 'and it never resolves the base unconfined ctx.shell')
  const registered = []
  let disposed = false
  const fakeCtx = {
    tools: { register: (definition) => { registered.push(definition) } },
    terminals: { spawn: async () => { throw new Error('not spawned in this arm') }, list: () => [], kill: async () => {} },
    effect: (factory) => { const value = factory(); return value },
    on: () => () => {},
  }
  apply(fakeCtx, { backendType: 'a5sf-governed-shell' })
  assert.equal(registered.length, 1, 'the module registers exactly one tool definition')
  const definition = registered[0]
  assert.equal(definition.name, 'bash', 'the model-visible tool is still called bash')
  const schema = definition.parameters
  assert.equal(schema.type, 'object')
  assert.deepEqual(Object.keys(schema.properties), ['command'], 'the surface is command ONLY — description/workdir/timeoutMs are gone')
  assert.equal(schema.properties.command.type, 'string')
  assert.deepEqual(schema.required, ['command'])
  // `description` is not a parameter any more; the default text describes the
  // PERSISTENT semantics (state survives) instead of the one-shot contract.
  assert.match(String(definition.description), /persistent/iu)
  void disposed

  // (2) THE COMPOSITION: the shipped governed preset declares that HOST package
  //     with the governed backend, and mounts no Team copy under another name.
  const patch = readFileSync(`${repoRoot}cordis.patch.yml`, 'utf8')
  const presetStart = patch.indexOf('id: "a5sf-governed-member"')
  assert.ok(presetStart > 0, 'the shipped composition must still declare the governed preset')
  const presetBlock = patch.slice(presetStart, patch.indexOf('\n    - id:', presetStart + 10) === -1 ? undefined : patch.indexOf('\n    - id:', presetStart + 10))
  assert.match(presetBlock, /- id: tool-bash-persistent\r?\n\s+name: '@deepseek-ai\/dsh-tool-bash-persistent'/u, 'the preset mounts the HOST persistent package')
  assert.match(presetBlock, /backendType: a5sf-governed-shell/u, 'and names the governed PTY backend, not the base shell backend')
  assert.equal((presetBlock.match(/name: '@deepseek-ai\/dsh-tool-bash-persistent'/gu) ?? []).length, 1, 'exactly one declaration of the persistent tool')
  assert.equal(/tool-bash-persistent/u.test(presetBlock.replace(/- id: tool-bash-persistent[\s\S]*?backendType: a5sf-governed-shell/u, '')), false, 'no second/renamed persistent row')
})

test('ADM-133 — the product assembly ACCEPTS a confined-subprocess declaration exactly when the realm owns the process face', async () => {
  // Round 76 measured this the hard way: a live Member creation refused
  // `a5sfMemberPolicies.members[0].toolRestrictions[0].execution.executionBoundary=
  // "confined-subprocess" has no realm face in this lane` EVEN THOUGH the
  // governed realm passes `availableFaces.process: true`. The face check was a
  // dead branch: `confined-subprocess` always fell through to the generic
  // `boundary !== 'trusted-host'` refusal. This arm pins both halves of the one
  // decision — accepted WITH the face, refused with the typed premise code
  // WITHOUT it — so neither half can regress alone.
  const { deriveProductRealmPlan } = await import('../team-services/src/index.ts')
  // The version comes from the grammar's OWN constant, never an inline literal: the fence gate
  // (`scripts/verify-blueprint-version-clean.mjs`) treats an authoring literal in a test as a
  // RETIRED-document risk, and a constant cannot drift from the version the compiler accepts.
  const { BLUEPRINT_V4_SCHEMA_VERSION } = await import('../../domain/blueprint/src/blueprint-v4.ts')
  const document = {
    schemaVersion: BLUEPRINT_V4_SCHEMA_VERSION,
    blueprintId: 'team.r76.bindings',
    revision: '1',
    leader: { templateId: 'leader', persona: 'L' },
    members: [{ templateId: 'worker-a', persona: 'W' }],
    requirements: [],
    teamEnvelope: { allow: [], deny: [] },
    memberEnvelopes: [{ templateId: 'worker-a', envelope: { allow: [], deny: [] } }],
    policyStates: [{ id: 'default', description: 'D' }],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: [{ templateId: 'worker-a', io: { read: lane(['/work/a']), write: lane(['/work/a']), network: { mode: 'allow' } } }],
    toolBindings: [authoredBashBinding('allow')],
  }
  const source = `---\n${JSON.stringify(document)}\n---\n`
  const authority = { revision: 'rev-1', admitted: true }

  const withFace = deriveProductRealmPlan({ blueprintSource: source, authority, availableFaces: { process: true } })
  const restriction = withFace.members[0].restrictions[0]
  assert.equal(restriction.bindingIdentity, 'dsh.subprocess/bash', 'the Team-scoped binding reaches the Member declaration')
  assert.equal(restriction.authorization, 'allow', 'and its authorization is carried verbatim')
  assert.deepEqual(restriction.execution, { implementationOrigin: 'dsh-native', executionBoundary: 'confined-subprocess' })

  // NEGATIVE CONTROL, same document: with no process face the SAME declaration
  // is the typed premise refusal (never a silently narrower mount).
  for (const faces of [undefined, { process: false }]) {
    assert.throws(
      () => deriveProductRealmPlan({ blueprintSource: source, authority, ...(faces === undefined ? {} : { availableFaces: faces }) }),
      (error) => error?.code === 'SUBPROCESS_UNCONFINED_REALM',
      `without the confined subprocess face the declaration must refuse SUBPROCESS_UNCONFINED_REALM (faces=${JSON.stringify(faces)})`,
    )
  }

  // The acceptance is SCOPED to that one boundary: a delegated-remote
  // declaration still refuses even when the process face exists.
  const remote = JSON.parse(JSON.stringify(document))
  remote.toolBindings[0].execution = { implementationOrigin: 'dsh-native', executionBoundary: 'delegated-remote' }
  assert.throws(
    () => deriveProductRealmPlan({ blueprintSource: `---\n${JSON.stringify(remote)}\n---\n`, authority, availableFaces: { process: true } }),
    (error) => error?.code === 'NETWORK_UNCONFINED_REALM',
    'the process face never authorizes a boundary it does not own',
  )
})

test('ADM-134 — a process-class binding may only declare the CEILING lane; a narrower one is refused as unenforceable', async () => {
  // Round 76's other half. A `confined-subprocess` binding is executed by the Member's process face,
  // whose lane IS the compiled ceiling. If the assembler accepted a narrower io lane it would be
  // shipping a claim no code path enforces on the shell — silently wider than declared. The
  // declaration is therefore refused, typed, while the ceiling-lane form is accepted (ADM-133).
  const { createProductRealmProvider, deriveProductRealmPlan } = await import('../team-services/src/index.ts')
  const { BLUEPRINT_V4_SCHEMA_VERSION } = await import('../../domain/blueprint/src/blueprint-v4.ts')
  const document = {
    schemaVersion: BLUEPRINT_V4_SCHEMA_VERSION,
    blueprintId: 'team.r76.narrow',
    revision: '1',
    leader: { templateId: 'leader', persona: 'L' },
    members: [{ templateId: 'worker-a', persona: 'W' }],
    requirements: [],
    teamEnvelope: { allow: [], deny: [] },
    memberEnvelopes: [{ templateId: 'worker-a', envelope: { allow: [], deny: [] } }],
    policyStates: [{ id: 'default', description: 'D' }],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: [{ templateId: 'worker-a', io: { read: lane(['/work/a']), write: lane(['/work/a']), network: { mode: 'allow' } } }],
    toolBindings: [{
      owner: 'dsh.subprocess',
      name: 'bash',
      authorization: 'allow',
      io: { read: lane(['/work/a/sub']), write: lane(['/work/a/sub']), network: { mode: 'allow' } },
      execution: { implementationOrigin: 'dsh-native', executionBoundary: 'confined-subprocess' },
    }],
  }
  // The refusal is a COMPILATION fact: the plan carries the declaration, the provider is what
  // compiles it against the ceiling and refuses an unenforceable narrowing.
  assert.throws(
    () => {
      const plan = deriveProductRealmPlan({
        blueprintSource: `---\n${JSON.stringify(document)}\n---\n`,
        authority: { revision: 'rev-1', admitted: true },
        availableFaces: { process: true },
      })
      return createProductRealmProvider(plan).compiledFor({ instanceId: 'inst-r76-narrow', templateId: 'worker-a' })
    },
    (error) => error?.code === 'REALM_DECLARATION_INVALID' && /process-class/.test(String(error.message)),
    'a process-class binding that narrows the ceiling must refuse rather than mount an unenforced lane',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// ADM-135 … ADM-140 — the 0.2.2-rc.5 FS additions are CONFINED (B5 closure).
//
// The rc.5 review's #1 item: `FileSystem` grew `patchText` / `deleteFile` /
// `moveFile`, and the Team confined provider overrode ten methods ending at
// `editText`. On rc.5 `apply_patch`, delete and move therefore reached the real
// backend with the Member's lane never consulted. These arms pin the three
// overrides the way the tenant-facing guarantee is worded:
//
//   in-lane      ⇒ the SPY base provider is reached EXACTLY once, with the SAME
//                  target object(s) the caller passed (the confined class does
//                  not re-resolve, so the effect is the base's own);
//   out-of-lane  ⇒ a typed TeamIoDenial, and the provider is NEVER called (so
//                  the source of a refused move is not removed either);
//   cross-root   ⇒ per the PRODUCT's own rule: both paths judged on their own
//                  admission (the destination write + read-if-existing), and no
//                  invented cross-root ban;
//   old backend  ⇒ a typed IO_POLICY_UNSUPPORTED refusal, never a fallthrough
//                  and never an untyped crash on `undefined(...)`.
//
// ADM-140 is the same three calls against the REAL pinned provider, host-
// relative: on rc.5 they take effect; on rc.2 (the type this repo compiles
// against) the identical calls must be refused typed with nothing changed.
// ─────────────────────────────────────────────────────────────────────────────

const FS_ADDITIONS_ROOT = pathJoin(DOMAIN_ROOT, '.artifacts', 'tmp', 'adm-fs-additions')

/** One lane (the file's shared helper) wrapped in the compiled policy shape. */
const additionsPolicy = ({ read, write, memberIdentity = 'member-adm-fs-additions' }) => ({
  memberIdentity,
  templateId: 'worker',
  instanceGeneration: 1,
  revision: 'rev-adm-fs-additions',
  read: lane(read),
  write: lane(write),
  network: { access: 'allow' },
})

/** A REAL temp tree inside the workspace (a DSH_HOME/tmp world is forbidden outside it). */
function prepareAdditionsArm (name) {
  const dir = pathJoin(FS_ADDITIONS_ROOT, name)
  rmSync(dir, { recursive: true, force: true })
  const inside = pathJoin(dir, 'inside')
  const outside = pathJoin(dir, 'outside')
  mkdirSync(inside, { recursive: true })
  mkdirSync(outside, { recursive: true })
  return { dir, inside, outside }
}

/** The recording base: every admitted call is recorded with the EXACT arguments it received. */
class RecordingFsBase {
  constructor () {
    this.calls = []
  }

  processPath (target) {
    return target.hostPath
  }

  async patchText (target, hunks, expected, signal, policy) {
    this.calls.push({ method: 'patchText', target, hunks, expected, signal, policy })
    return { patched: true }
  }

  async deleteFile (target, expected, signal, policy) {
    this.calls.push({ method: 'deleteFile', target, expected, signal, policy })
    return { before: 'deleted-basis' }
  }

  async moveFile (source, destination, options, signal, policy) {
    this.calls.push({ method: 'moveFile', source, destination, options, signal, policy })
    return { sourceDeleted: true }
  }
}

/** A base of the OLD generation: it has none of the three methods. */
class LegacyFsBase {
  constructor () {
    this.calls = []
  }

  processPath (target) {
    return target.hostPath
  }
}

/** Mount the confined class over `Base` with the REAL production guard. */
async function confinedOver (Base, policy) {
  const { createConfinedFileSystemClass, createMemberFsGuard } = await import('../team-services/src/fs.ts')
  const Confined = createConfinedFileSystemClass(Base, createMemberFsGuard(policy), policy.memberIdentity)
  return new Confined()
}

/** A typed refusal, asserted by class + code + method (never by message text alone). */
const refusal = (code, method) => (error) => {
  assert.equal(error?.name, 'TeamIoDenial', `expected a typed TeamIoDenial, got ${error?.name}: ${error?.message}`)
  assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`)
  assert.equal(error.method, method, `the refusal must name the method that asked: ${error.method}`)
  return true
}

test('ADM-135 — rc.5 patchText is confined like editText: in-lane reaches the provider once, out-of-lane is refused before it', async () => {
  const { inside, outside } = prepareAdditionsArm('patch-text')
  const insideFile = pathJoin(inside, 'patch-me.txt')
  const outsideFile = pathJoin(outside, 'not-yours.txt')
  writeFileSync(insideFile, 'one\ntwo\n', 'utf8')
  writeFileSync(outsideFile, 'SECRET\n', 'utf8')
  const policy = additionsPolicy({ read: [inside], write: [inside] })
  const fs = await confinedOver(RecordingFsBase, policy)
  const target = { hostPath: insideFile }

  const outcome = await fs.patchText(target, [])
  assert.deepEqual(outcome, { patched: true })
  assert.equal(fs.calls.length, 1, 'an admitted patch must reach the base provider exactly once')
  assert.equal(fs.calls[0].method, 'patchText')
  assert.equal(fs.calls[0].target, target, 'the SAME target object is delegated: the confined class never re-resolves the path')
  assert.equal(fs.calls[0].target.hostPath, insideFile, 'and it is the caller\'s path')
  assert.deepEqual(fs.calls[0].hunks, [])

  const outsideTarget = { hostPath: outsideFile }
  await assert.rejects(() => fs.patchText(outsideTarget, []), refusal('IO_WRITE_DENIED', 'patchText'))
  assert.equal(fs.calls.length, 1, 'an out-of-lane patch must never reach the provider (zero side effects)')
  assert.equal(existsSync(outsideFile), true, 'and the out-of-lane file is untouched')
})

test('ADM-136 — rc.5 deleteFile is judged like a WRITE of the file it removes (write axis, and read coverage)', async () => {
  const { inside, outside } = prepareAdditionsArm('delete-file')
  const insideFile = pathJoin(inside, 'remove-me.txt')
  const outsideFile = pathJoin(outside, 'not-yours.txt')
  writeFileSync(insideFile, 'bye\n', 'utf8')
  writeFileSync(outsideFile, 'SECRET\n', 'utf8')
  const fs = await confinedOver(RecordingFsBase, additionsPolicy({ read: [inside], write: [inside] }))
  const target = { hostPath: insideFile }

  const outcome = await fs.deleteFile(target, undefined)
  assert.deepEqual(outcome, { before: 'deleted-basis' })
  assert.equal(fs.calls.length, 1, 'an admitted delete must reach the base provider exactly once')
  assert.equal(fs.calls[0].method, 'deleteFile')
  assert.equal(fs.calls[0].target, target, 'the SAME target object is delegated')

  const outsideTarget = { hostPath: outsideFile }
  await assert.rejects(() => fs.deleteFile(outsideTarget), refusal('IO_WRITE_DENIED', 'deleteFile'))
  assert.equal(fs.calls.length, 1, 'an out-of-lane delete must never reach the provider')
  assert.equal(existsSync(outsideFile), true, 'and the out-of-lane file survives')

  // "Like a write" is not only the axis: the native write contract requires READ
  // coverage of an existing target, and a delete removes an existing file. A lane
  // that may delete but not read is refused with the write-requires-read code.
  const writeOnly = await confinedOver(RecordingFsBase, additionsPolicy({ read: [], write: [inside] }))
  await assert.rejects(() => writeOnly.deleteFile(target), refusal('IO_WRITE_REQUIRES_READ', 'deleteFile'))
  assert.equal(writeOnly.calls.length, 0, 'the write-requires-read refusal happens before the provider')
})

test('ADM-137 — rc.5 moveFile judges BOTH paths: an out-of-lane destination refuses the move and removes nothing', async () => {
  const { inside, outside } = prepareAdditionsArm('move-file')
  const sourceFile = pathJoin(inside, 'move-me.txt')
  const insideDestination = pathJoin(inside, 'moved.txt')
  const outsideDestination = pathJoin(outside, 'exfiltrated.txt')
  writeFileSync(sourceFile, 'MOVE-ME\n', 'utf8')
  const policy = additionsPolicy({ read: [inside], write: [inside] })
  const fs = await confinedOver(RecordingFsBase, policy)
  const source = { hostPath: sourceFile }
  const destination = { hostPath: insideDestination }

  const outcome = await fs.moveFile(source, destination, {})
  assert.deepEqual(outcome, { sourceDeleted: true })
  assert.equal(fs.calls.length, 1, 'an admitted move must reach the base provider exactly once')
  assert.equal(fs.calls[0].method, 'moveFile')
  assert.equal(fs.calls[0].source, source, 'the SAME source object is delegated')
  assert.equal(fs.calls[0].destination, destination, 'the SAME destination object is delegated')
  assert.equal(fs.calls[0].source.hostPath, sourceFile)
  assert.equal(fs.calls[0].destination.hostPath, insideDestination)

  // The destination is OUT OF LANE: the move is refused and the provider is never
  // entered, so the source is still there (nothing was published, nothing removed).
  await assert.rejects(
    () => fs.moveFile(source, { hostPath: outsideDestination }, {}),
    refusal('IO_WRITE_DENIED', 'moveFile'),
  )
  assert.equal(fs.calls.length, 1, 'an out-of-lane DESTINATION must never reach the provider')
  assert.equal(existsSync(sourceFile), true, 'and the source is not removed by a refused move')
  assert.equal(existsSync(outsideDestination), false, 'and nothing is published outside the lane')

  // Symmetrically: an out-of-lane SOURCE is refused before the destination is written.
  const outsideSource = pathJoin(outside, 'foreign.txt')
  writeFileSync(outsideSource, 'FOREIGN\n', 'utf8')
  await assert.rejects(
    () => fs.moveFile({ hostPath: outsideSource }, destination, {}),
    refusal('IO_WRITE_DENIED', 'moveFile'),
  )
  assert.equal(fs.calls.length, 1, 'an out-of-lane SOURCE must never reach the provider')
  assert.equal(existsSync(outsideSource), true)
})

test('ADM-138 — a CROSS-ROOT move follows the product\'s own rule: each path is admitted on its own, no invented ban', async () => {
  const { dir, inside: rootA, outside: rootB } = prepareAdditionsArm('cross-root')
  const sourceFile = pathJoin(rootA, 'from-a.txt')
  const existingInB = pathJoin(rootB, 'already-there.txt')
  const freshInB = pathJoin(rootB, 'fresh-target.txt')
  writeFileSync(sourceFile, 'FROM-A\n', 'utf8')
  writeFileSync(existingInB, 'IN-B\n', 'utf8')
  const policy = additionsPolicy({ read: [rootA], write: [rootA, rootB] })
  const fs = await confinedOver(RecordingFsBase, policy)
  const source = { hostPath: sourceFile }

  // Root B is WRITABLE but not READABLE, so a destination that ALREADY EXISTS
  // cannot be admitted: the write would publish over bytes this Member may not
  // read. That is the product's `write ⇒ read` rule applied to the destination —
  // the cross-root case is refused by the SAME rule, not by a root comparison.
  await assert.rejects(
    () => fs.moveFile(source, { hostPath: existingInB }, {}),
    refusal('IO_WRITE_REQUIRES_READ', 'moveFile'),
  )
  assert.equal(fs.calls.length, 0, 'the destination admission refuses before the provider')
  assert.equal(existsSync(sourceFile), true, 'the source is untouched')

  // The control that makes the arm above meaningful: a move into root B is NOT
  // banned as "cross-root" when each path passes its own admission (a fresh
  // destination only needs the write axis). Both paths are delegated unchanged.
  assert.equal(dir.startsWith(FS_ADDITIONS_ROOT), true)
  const destination = { hostPath: freshInB }
  const outcome = await fs.moveFile(source, destination, {})
  assert.deepEqual(outcome, { sourceDeleted: true })
  assert.equal(fs.calls.length, 1, 'the cross-root move reaches the provider exactly once when both paths are admitted')
  assert.equal(fs.calls[0].source, source)
  assert.equal(fs.calls[0].destination, destination)
})

test('ADM-139 — a base provider WITHOUT the rc.5 methods refuses typed (IO_POLICY_UNSUPPORTED), never a fallthrough or a crash', async () => {
  const { inside } = prepareAdditionsArm('legacy-base')
  const aFile = pathJoin(inside, 'a.txt')
  const bFile = pathJoin(inside, 'b.txt')
  writeFileSync(aFile, 'A\n', 'utf8')
  writeFileSync(bFile, 'B\n', 'utf8')
  const policy = additionsPolicy({ read: [inside], write: [inside] })
  const fs = await confinedOver(LegacyFsBase, policy)

  const unsupported = (method) => (error) => {
    // The typed refusal, NOT the `TypeError: undefined is not a function` an
    // unguarded `this.basePatchText.call(...)` would produce.
    assert.equal(error instanceof TypeError, false, 'an old backend must not surface an untyped crash')
    assert.equal(error?.name, 'TeamIoDenial', `expected a typed refusal for ${method}`)
    assert.equal(error.code, 'IO_POLICY_UNSUPPORTED', `expected the unsupported capability code for ${method}: ${error.message}`)
    assert.match(String(error.message), new RegExp(`${method}\\(\\)`), 'the refusal names the method the host does not implement')
    assert.equal(error.memberIdentity, policy.memberIdentity, 'and the Member whose call was refused')
    return true
  }

  await assert.rejects(() => fs.patchText({ hostPath: aFile }, []), unsupported('patchText'))
  await assert.rejects(() => fs.deleteFile({ hostPath: aFile }), unsupported('deleteFile'))
  await assert.rejects(() => fs.moveFile({ hostPath: aFile }, { hostPath: bFile }, {}), unsupported('moveFile'))
  assert.equal(fs.calls.length, 0, 'nothing reaches a provider that cannot perform the operation')
  assert.equal(existsSync(aFile), true, 'and no effect happened: the typed refusal is not a partial move/delete')
  assert.equal(existsSync(bFile), true)
})

test('ADM-140 — the REAL pinned provider, host-relative: rc.5 performs the three calls, rc.2 refuses them typed with nothing changed', async () => {
  const { inside } = prepareAdditionsArm('real-base')
  const { createConfinedFileSystemClass, createMemberFsGuard } = await import('../team-services/src/fs.ts')
  const { loadFsContractSeams } = await import('../../../tests/world-factory/lib/a5sf-fs-contract-world.mjs')
  const seams = await loadFsContractSeams(DOMAIN_ROOT)
  const hostHasAdditions = ['patchText', 'deleteFile', 'moveFile']
    .every((name) => typeof seams.LocalFileSystem.prototype[name] === 'function')
  // The branch below must be the one the SELECTED host implies: a lane that says
  // `TEAM_TEST_HOST=next` and resolves the rc.2 tree would otherwise pass the
  // rc.2 half and read as a green that proves nothing about rc.5.
  const { testHostMode } = await import('../../../tests/next-host/host-select.mjs')
  assert.equal(hostHasAdditions, testHostMode() === 'next', 'the resolved provider generation must match the lane the run claims')

  const patchFile = pathJoin(inside, 'patch.txt')
  const deleteFile = pathJoin(inside, 'delete.txt')
  const moveSource = pathJoin(inside, 'move.txt')
  const moveDestination = pathJoin(inside, 'moved.txt')
  writeFileSync(patchFile, 'one\ntwo\n', 'utf8')
  writeFileSync(deleteFile, 'bye\n', 'utf8')
  writeFileSync(moveSource, 'MOVE\n', 'utf8')
  const target = (hostPath) => ({ targetKey: hostPath, displayPath: hostPath })
  const policy = additionsPolicy({ read: [inside], write: [inside] })

  const root = new seams.Context()
  const Confined = createConfinedFileSystemClass(seams.LocalFileSystem, createMemberFsGuard(policy), policy.memberIdentity)
  await root.plugin(Confined, { cwd: inside, diffBasisMaxBytes: 10 * 1024 * 1024 })
  try {
    const fs = root.get('fs')
    assert.ok(fs !== undefined, 'the confined class must mount as the `fs` service over the real provider')

    if (hostHasAdditions) {
      // rc.5: the effect is the REAL provider's own (empty hunk list = a no-op patch).
      const patched = await fs.patchText(target(patchFile), [])
      assert.equal(patched.before, 'one\ntwo\n')
      assert.equal(patched.after, 'one\ntwo\n')
      const deleted = await fs.deleteFile(target(deleteFile))
      assert.equal(deleted.before, 'bye\n')
      assert.equal(existsSync(deleteFile), false, 'rc.5: the admitted delete really removes the file')
      const moved = await fs.moveFile(target(moveSource), target(moveDestination), {})
      assert.equal(moved.sourceDeleted, true)
      assert.equal(existsSync(moveDestination), true)
      assert.equal(existsSync(moveSource), false)

      // …and the SAME real provider refuses an out-of-lane destination with the lane's code.
      const outside = pathJoin(inside, '..', 'outside-real.txt')
      writeFileSync(outside, 'OUT\n', 'utf8')
      await assert.rejects(() => fs.moveFile(target(moveDestination), target(outside), {}), refusal('IO_WRITE_DENIED', 'moveFile'))
      assert.equal(existsSync(moveDestination), true, 'the refused destination move changed nothing')
    } else {
      // rc.2: the base class has none of the three methods. The SAME calls are
      // typed refusals and no file moves.
      for (const run of [
        () => fs.patchText(target(patchFile), []),
        () => fs.deleteFile(target(deleteFile)),
        () => fs.moveFile(target(moveSource), target(moveDestination), {}),
      ]) {
        await assert.rejects(run, (error) => {
          assert.equal(error?.name, 'TeamIoDenial')
          assert.equal(error.code, 'IO_POLICY_UNSUPPORTED')
          return true
        })
      }
      assert.equal(existsSync(deleteFile), true)
      assert.equal(existsSync(moveSource), true)
      assert.equal(existsSync(moveDestination), false)
    }
  } finally {
    await root.fiber.dispose()
  }
})
