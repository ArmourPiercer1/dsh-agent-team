/**
 * ci-local.test.mjs — the selection rules of the L0 inner loop.
 *
 * These are the only parts of `ci-local.mjs` that can be wrong in a way a reader would not
 * notice: which changed paths select which tests, and which runner gets them. The spawning
 * half is exercised by running the tool itself, not here.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classify, buildPlan, runnerFor, isTestFile, isCiFamily, packageOf } from './ci-local.mjs'

test('isTestFile recognises both runners by convention', () => {
  assert.equal(isTestFile('packages/runtime/test/a.test.ts'), true)
  assert.equal(isTestFile('packages/client/test/a.client.spec.tsx'), true)
  assert.equal(isTestFile('scripts/pr-settlement-gate.test.mjs'), true)
  assert.equal(isTestFile('scripts/ci-local.mjs'), false)
  assert.equal(isTestFile('tests/checks/dist-placements.test.mjs'), true)
})

test('packageOf only claims packages/<name>/', () => {
  assert.equal(packageOf('packages/runtime/src/plugin/x.mjs'), 'runtime')
  assert.equal(packageOf('packages/tools/test/y.test.ts'), 'tools')
  assert.equal(packageOf('scripts/eb3-impact.mjs'), null)
  assert.equal(packageOf('tests/world-factory/lib/a.mjs'), null)
})

test('isCiFamily claims the CI declarations, but never a test file', () => {
  assert.equal(isCiFamily('.github/workflows/ci-required.yml'), true)
  assert.equal(isCiFamily('dev/ci/eb3-ci-manifest.json'), true)
  assert.equal(isCiFamily('scripts/eb3-ci-required.mjs'), true)
  assert.equal(isCiFamily('scripts/ci-pr-gate.mjs'), true)
  assert.equal(isCiFamily('tests/checks/dist-placements.test.mjs'), false)
  assert.equal(isCiFamily('scripts/docs-probe.mjs'), false)
})

test('classify: a package source selects that package, a test selects itself', () => {
  const c = classify([
    'packages/runtime/src/plugin/live/agent-bindings.mjs',
    'packages/runtime/test/foo.test.ts',
    'docs/STATUS.md',
  ])
  assert.deepEqual(c.packages, ['runtime'])
  assert.deepEqual(c.tests, ['packages/runtime/test/foo.test.ts'])
  assert.deepEqual(c.docsOnly, ['docs/STATUS.md'])
  assert.deepEqual(c.undetermined, [])
})

test('classify: root config and shared test libraries are undetermined, not guessed', () => {
  const c = classify(['pnpm-lock.yaml', 'tests/world-factory/lib/a5sf-harness.mjs', 'scripts/docs-probe.mjs'])
  assert.deepEqual(c.undetermined, ['pnpm-lock.yaml', 'scripts/docs-probe.mjs', 'tests/world-factory/lib/a5sf-harness.mjs'])
  assert.deepEqual(c.packages, [])
  assert.deepEqual(c.tests, [])
})

test('classify: CI files are graded by the CI checkers, not by package tests', () => {
  const c = classify(['.github/workflows/ci-required.yml', 'dev/ci/eb3-ci-manifest.json'])
  assert.deepEqual(c.ci, ['.github/workflows/ci-required.yml', 'dev/ci/eb3-ci-manifest.json'])
  assert.deepEqual(c.packages, [])
})

test('runnerFor ignores quoted strings that only mention a runner', () => {
  // This file quotes both imports in its own assertions; a naive substring match would
  // classify the test file itself as Vitest.
  const quoted = `assert.equal(runnerFor("import { test } from 'vitest'"), 'vitest')`
  assert.equal(runnerFor(quoted, 'scripts/ci-local.test.mjs'), 'node')
})

test('runnerFor reads the import, not the extension', () => {
  assert.equal(runnerFor("import { test } from 'vitest'"), 'vitest')
  assert.equal(runnerFor("import { test } from 'node:test'"), 'node')
  assert.equal(runnerFor('// no import', 'packages/runtime/test/x.test.ts'), 'vitest')
  assert.equal(runnerFor('// no import', 'tests/checks/x.test.mjs'), 'node')
})

test('buildPlan: a package change selects the package test tree', () => {
  const plan = buildPlan(classify(['packages/runtime/src/a.mjs']))
  assert.deepEqual(plan.vitest, ['packages/runtime/test/**/*.test.{ts,tsx}'])
  assert.equal(plan.coverage, 'determined')
  assert.equal(plan.typecheck, true)
})

test('buildPlan: undetermined changes are reported, never silently dropped', () => {
  const plan = buildPlan(classify(['package.json']))
  assert.equal(plan.coverage, 'undetermined')
  assert.deepEqual(plan.undetermined, ['package.json'])
  assert.deepEqual(plan.vitest, [])
})

test('buildPlan: a docs-only change selects no test runner and is determined', () => {
  const plan = buildPlan(classify(['docs/STATUS.md']))
  assert.equal(plan.coverage, 'determined')
  assert.deepEqual(plan.vitest, [])
  assert.deepEqual(plan.nodeTest, [])
})
