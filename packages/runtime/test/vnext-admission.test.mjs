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
