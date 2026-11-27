/**
 * vnext-template-binding.test.mjs — which template a session is, under which bound snapshot.
 *
 * The locator is fail-closed, and its refusals are typed because the setup's rollback reads the code.
 * These arms pin the four refusal reasons and the rule that makes them refusals rather than fallbacks:
 * the templateId hint may bridge ONLY the fresh-member window, and a root's cache never leaks into
 * another root (the BP-F defect: one row carries many team roots, each bound to its own snapshot).
 *
 * Run: node --test packages/runtime/test/vnext-template-binding.test.mjs
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createTemplateBinding } from '../src/plugin/vnext/template-binding.mjs'

// The parser and projection are injected by production; these arms use the real ones' CONTRACT with
// trivial stand-ins, because what this module decides is WHICH template, not how a blueprint is parsed.
const parseBlueprint = (source) => JSON.parse(source)
const staticCapabilitiesOf = (blueprint, template) => template.capabilities ?? { mode: 'legacy' }
const make = (options) => createTemplateBinding({ parseBlueprint, staticCapabilitiesOf, observe: () => {}, ...options })

const template = (templateId, capabilities) => ({ templateId, ...(capabilities === undefined ? {} : { capabilities }) })
const blueprintFor = (root) => ({
  leader: { ...template('leader'), role: 'leader', root },
  members: [template('tmpl-a', { mode: 'selective', teamTools: { allow: ['team_delegate'] } }), template('tmpl-b')],
})
const domainWith = (rows) => ({
  repositories: { memberInstances: { list: (root) => rows.filter((row) => row.root === root) } },
})

test('TB-1 — a member resolves through its DURABLE row, and the projection rides the same parse', () => {
  const observe = []
  let parses = 0
  const binding = make({
    domain: domainWith([{ root: 'root-1', childSessionId: 'child-a', instanceId: 'inst-a', templateId: 'tmpl-a' }]),
    bootRootSessionId: 'root-1',
    resolveBoundBlueprint: (root) => { parses += 1; return blueprintFor(root) },
    observe: (message) => observe.push(message),
  })
  const located = binding.locateTemplate('child-a', 'inst-a', undefined, 'root-1', 'cold-member')
  assert.equal(located.templateId, 'tmpl-a')
  assert.equal(binding.getBoundBlueprint('root-1'), binding.getBoundBlueprint('root-1'), 'one parse per root')
  assert.equal(parses, 1, 'the cache is what keeps parsing pure-once')
  assert.deepEqual(binding.resolveStaticCapabilities('child-a', 'inst-a', undefined, 'root-1', 'cold-member'), {
    mode: 'selective',
    teamTools: { allow: ['team_delegate'] },
  })
  // The leader resolves by POSITION, not by row.
  assert.equal(binding.locateTemplate('root-1', 'inst-leader', undefined, 'root-1', 'cold-root').role, 'leader')
  assert.deepEqual(observe, [])
})

test('TB-2 — one row, many roots: each root keeps its OWN bound snapshot (the BP-F defect)', () => {
  const binding = make({
    domain: domainWith([]),
    bootRootSessionId: 'root-1',
    resolveBoundBlueprint: (root) => blueprintFor(root),
    observe: () => {},
  })
  assert.equal(binding.getBoundBlueprint('root-1').leader.root, 'root-1')
  assert.equal(binding.getBoundBlueprint('root-2').leader.root, 'root-2', 'a second root must not read the first root\u0027s snapshot')
  assert.notEqual(binding.getBoundBlueprint('root-1'), binding.getBoundBlueprint('root-2'))
})

test('TB-3 — the fresh-member hint bridges ONLY fresh-member; every other path fails closed', () => {
  const observe = []
  const binding = make({
    domain: domainWith([]),
    bootRootSessionId: 'root-1',
    resolveBoundBlueprint: (root) => blueprintFor(root),
    observe: (message) => observe.push(message),
  })
  // The row has not committed yet - the hint is the value the flow commits moments later.
  assert.equal(binding.locateTemplate('child-x', 'inst-x', 'tmpl-b', 'root-1', 'fresh-member').templateId, 'tmpl-b')
  // The same hint on any other path is NOT an authorization fallback.
  for (const path of ['cold-member', 'fresh-root', 'cold-root', undefined]) {
    assert.throws(
      () => binding.locateTemplate('child-x', 'inst-x', 'tmpl-b', 'root-1', path),
      (error) => error.code === 'capability-template-unresolved' && error.reason === 'template-id-missing',
      `${String(path)} must not use the hint`,
    )
  }
  assert.ok(observe.some((line) => line.includes('capability-template-unresolved')), 'a refusal is recorded where other refusals are')
})

test('TB-4 — the four refusal reasons are typed, and NO refusal degrades to legacy', () => {
  const cases = [
    {
      why: 'no resolver and no source: the blueprint is unavailable',
      input: { resolveBoundBlueprint: undefined, blueprintSource: undefined },
      call: (b) => b.locateTemplate('root-1', 'inst-leader', undefined, 'root-1', 'cold-root'),
      reason: 'blueprint-unavailable',
    },
    {
      why: 'a blueprint with no leader is broken, not legacy',
      input: { resolveBoundBlueprint: () => ({ members: [template('tmpl-a')] }) },
      call: (b) => b.locateTemplate('root-1', 'inst-leader', undefined, 'root-1', 'cold-root'),
      reason: 'template-not-found',
    },
    {
      why: 'a durable row naming an unknown template',
      input: { resolveBoundBlueprint: () => blueprintFor('root-1'), rows: [{ root: 'root-1', childSessionId: 'child-a', instanceId: 'inst-a', templateId: 'tmpl-gone' }] },
      call: (b) => b.locateTemplate('child-a', 'inst-a', undefined, 'root-1', 'cold-member'),
      reason: 'template-not-found',
    },
    {
      why: 'a member with no row and no hint',
      input: { resolveBoundBlueprint: () => blueprintFor('root-1'), rows: [] },
      call: (b) => b.locateTemplate('child-a', 'inst-a', undefined, 'root-1', 'cold-member'),
      reason: 'template-id-missing',
    },
  ]
  for (const { why, input, call, reason } of cases) {
    const binding = make({
      domain: domainWith(input.rows ?? []),
      bootRootSessionId: 'root-1',
      resolveBoundBlueprint: input.resolveBoundBlueprint,
      blueprintSource: input.blueprintSource,
      observe: () => {},
    })
    assert.throws(
      () => call(binding),
      (error) => error.code === 'capability-template-unresolved' && error.reason === reason,
      `${why}: expected ${reason}`,
    )
  }
})

test('TB-5 — the legacy anchor is the no-resolver fallback, and an empty source is null (the pre-repair contract)', () => {
  const source = JSON.stringify({ leader: { templateId: 'leader' }, members: [{ templateId: 'tmpl-a' }] })
  const binding = make({
    domain: domainWith([]),
    bootRootSessionId: 'root-1',
    resolveBoundBlueprint: undefined,
    blueprintSource: source,
    observe: () => {},
  })
  assert.equal(binding.locateTemplate('root-1', 'inst-leader', undefined, 'root-1', 'cold-root').templateId, 'leader')
  const empty = make({ domain: domainWith([]), bootRootSessionId: 'root-1', blueprintSource: '' })
  assert.equal(empty.getBoundBlueprint('root-1'), null)
})

test('TB-6 — the factory refuses a domain or sink it cannot honour', () => {
  assert.throws(() => make({ domain: {}, bootRootSessionId: 'r', observe: () => {} }), /memberInstances\.list/u)
  assert.throws(() => make({ domain: domainWith([]), bootRootSessionId: 'r', observe: undefined }), /observe/u)
  assert.throws(() => createTemplateBinding({ domain: domainWith([]), bootRootSessionId: 'r', observe: () => {} }), /parseBlueprint/u)
})
