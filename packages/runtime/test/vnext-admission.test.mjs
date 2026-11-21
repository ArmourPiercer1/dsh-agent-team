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
  for (const toolName of ['bash', 'pwsh']) {
    const decision = call(toolName, { command: 'ls' })
    assert.equal(decision.kind, 'deny', `${toolName} must not be admitted while no subprocess lane exists`)
    assert.equal(decision.code, 'ADMISSION_AXIS_UNSUPPORTED')
  }
  // C7 (round 55): `run_code` is the PTC entry and PTC is a DIFFERENT absence from "a shell with no
  // lane" — the escalation row would be a second execution authority even if a process lane existed.
  // It therefore carries its own code; collapsing the two made both unreviewable.
  const ptc = call('run_code', { command: 'ls' })
  assert.equal(ptc.kind, 'deny')
  assert.equal(ptc.code, 'ADMISSION_PTC_UNAVAILABLE')
  assert.notEqual(ptc.code, call('bash', { command: 'ls' }).code, 'the two absences must stay distinguishable')
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

/**
 * The durable approval authority, as a deterministic stand-in for the Control plane in the arms that
 * are NOT about the Control plane: an approval that is recorded, and nothing else. The real bridge
 * (request → durable decision → wait) is measured by ADM-50/51 over the REAL ControlService, and every
 * mapping of its closed outcomes is measured by ADM-55.
 */
const approvalOnce = (over = {}) => {
  const asked = []
  return {
    asked,
    port: {
      async request (input) {
        asked.push(input)
        return { ok: true, approval: { approvalId: 'approval-1', policyRevision: 'gen-7' }, ...over }
      },
    },
  }
}

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
  const narrowed = bindWith({ policy: { read: lane(['/b']) } })
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
  // And the case the contract cannot express: admitted as `allow`, refused by the recheck. No terminal
  // state exists for it (REFUSED is forbidden against an allow, CANCELLED needs a Stop), so the centre
  // REPORTS the gap instead of writing a state that lies - and the durable fact still carries the refusal.
  // This is an escalation, recorded in CONTRACT-CHANGE-REQUEST-settlement-recheck.md.
  assert.equal(store2.read('exec-call-read').state, 'ADMITTED', 'no fabricated terminal state')
  assert.ok(recheckFaults.some(([error]) => error?.code === 'SETTLEMENT_CONTRACT_GAP'), 'the gap is reported, not swallowed')
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
  const { join } = await import('node:path')

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
  let guardFn
  const ctx = {
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
  const guard = (exec) => (guardFn === undefined ? undefined : guardFn(exec))
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
  const { join } = await import('node:path')
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
  const at = new Date(Date.parse(openBefore.updatedAt) + 1000).toISOString()
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

  const at = new Date(Date.parse(running.updatedAt) + 1000).toISOString()
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
//  - C-remote and C-alpha6: the host-surface refusal point (the SAME `refuseHostSurfaceBefore` the
//    product composition calls in `root.ts`) records the refusal with the product fact ledger and the
//    product settlement store, and the surface body is NOT run. The point is undefined exactly when
//    the row never configured the centre — the same world in which the surface IS built and runs,
//    which is what makes the refusal meaningful rather than a permanently broken fixture.
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

test('ADM-86 — C-remote is EXPLICITLY UNAVAILABLE: the S6 surface is refused before it is built, recorded on team.control, settled REFUSED', async () => {
  const { refuseHostSurfaceBefore, HOST_SURFACE_REFUSALS } = await import('../src/plugin/vnext/host-surface-refusal.mjs')
  const world = await hostSurfaceWorld('remote')
  const dispatcher = { calls: 0, dispatch: () => { dispatcher.calls += 1; return { ok: true } } }
  // POSITIVE CONTROL: the ungoverned row builds and dispatches.
  const ungated = refuseHostSurfaceBefore(undefined, { subject: 'remote.surface', owner: 'root-host-surface' })
  assert.equal(ungated, false)
  if (!ungated) dispatcher.dispatch()
  assert.equal(dispatcher.calls, 1)

  // THE REFUSAL: the row is centre-configured, so the command plane is not installed at all.
  const refused = refuseHostSurfaceBefore(world.point('remote'), {
    subject: 'remote.surface',
    owner: 'root-host-surface',
    locator: 'root-host-surface',
    detail: 'endpoint team.delegate',
  })
  assert.equal(refused, true)
  assert.equal(dispatcher.calls, 1, 'ZERO side effects: no dispatcher was built or called after the refusal')

  const fact = world.ledger.readAll().find((record) => record.kind === 'invocation-authority')
  assert.equal(fact.decision, 'deny')
  assert.equal(fact.refusalCode, 'ADMISSION_REMOTE_UNAVAILABLE')
  assert.equal(fact.axis, 'team.control', 'a remote command belongs to the team control plane, not to an invented axis')
  assert.match(String(fact.reason), /no remote-command axis/u)
  const settled = world.store.read(world.identityOf({ callId: fact.callId }).executionId)
  assert.equal(settled.state, 'REFUSED')
  assert.equal(settled.observation.dispatch, 'not-started')

  // The three codes are distinct BY CONSTRUCTION (the closed table), not by a comment.
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
  assert.match(String(fact.reason), /process lane/u)
  assert.match(String(fact.reason), /second execution authority/u, 'the reason names the escalation row, not just the lane')

  // SETTLEMENT: REFUSED, not-started, never UNKNOWN (the body provably never ran).
  const settled = world.store.read(world.executionIdOf(exec))
  assert.equal(settled.state, 'REFUSED')
  assert.equal(settled.observation.dispatch, 'not-started')
  assert.equal(settled.observation.bodyOutcome, 'not-started')

  // DISTINCT: a plain shell keeps the generic process-axis code, so a reader can tell the two
  // absences apart from the durable record alone.
  const shell = { name: 'bash', callId: 'ptc-bash-1', arguments: { command: 'ls' }, agent: { id: 'agent-1' }, turn: 1, step: 1 }
  const shellVerdict = await world.dispatch(shell)
  assert.equal(shellVerdict.kind, 'deny')
  assert.match(String(shellVerdict.reason), /ADMISSION_AXIS_UNSUPPORTED/u)
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
