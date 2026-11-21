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
const { admit, invocationFactsOf } = await import('../src/plugin/vnext/admission.ts')
// The centre does not own grants: `member-io-policy` does. These arms use the PRODUCT binder and
// assert the properties the centre relies on, so a regression in the product turns them red.
const { createInvocationBinder } = await import('../member-io-policy/src/invocation.ts')
const { openFactLedger } = await import('../src/plugin/vnext/fact-ledger.mjs')

const lane = (allow = [], ask = [], deny = []) => ({ mode: 'restricted', allow, ask, deny })

const binding = (over = {}) => ({
  agentId: 'agent-1',
  sessionId: 'session-1',
  instanceGeneration: 3,
  read: lane(['/work/a']),
  write: lane(['/work/a']),
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
  const decision = call('bash', { command: 'ls' })
  assert.equal(decision.kind, 'deny')
  assert.equal(decision.code, 'ADMISSION_TOOL_UNBOUND')
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
