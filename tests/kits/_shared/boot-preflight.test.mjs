/**
 * `tests/kits/_shared/boot-preflight.test.mjs` — host-free unit tests for the
 * shared boot preflight.
 *
 * These tests import ONLY the pure module: no Host, no port, no `DSH_HOME`, no
 * pristine checkout. Run with:
 *
 *   node --test tests/kits/_shared/boot-preflight.test.mjs
 *
 * The first test is the owner's named bug class: an arm this run did NOT select
 * must be recorded `NOT_SELECTED` even when the driver computed `FAIL` for it,
 * and that must not block the start. The rest pin the closed-set semantics so a
 * future edit cannot blur FAIL / NOT_REACHED / ENV_BLOCK again.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BLOCKING_PRECEDENCE,
  BootPreflightRefusal,
  PREFLIGHT_STATES,
  assertBootPreflight,
  assertPreflightState,
  checkCandidate,
  checkEnv,
  checkHostPin,
  checkModalities,
  checkOfficerCount,
  checkPorts,
  checkWorld,
  gradeChecks,
  recordCheck,
  runBootPreflight,
} from './boot-preflight.mjs'

const SANCTIONED = (port) => port >= 3180 && port <= 3199

/** A complete PASS input; tests mutate one field at a time. */
function goodInput(overrides = {}) {
  return {
    env: { required: ['DSH_HOME'], provided: { DSH_HOME: '/repo/tests/homes/w1' } },
    hostPin: { declared: 'a'.repeat(40), actual: 'a'.repeat(40), porcelainClean: true },
    candidate: { expectedSha: 'b'.repeat(40), actualSha: 'b'.repeat(40) },
    modalities: [{ id: 'text', supported: true }],
    officer: { required: true, count: 1 },
    ports: [{ port: 3181, free: true }],
    isSanctionedPort: SANCTIONED,
    world: { dshHome: '/repo/tests/homes/w1', workspaceRoot: '/repo', exists: false },
    arms: { selected: ['ask-1'], known: ['ask-1', 'ask-2'] },
    ...overrides,
  }
}

test('the closed set is exactly the owner six words, no seventh', () => {
  assert.deepEqual([...PREFLIGHT_STATES], ['PASS', 'FAIL', 'NOT_REACHED', 'NOT_SELECTED', 'UNSUPPORTED', 'ENV_BLOCK'])
  assert.throws(() => assertPreflightState('FAILED'), /not one of/)
  assert.throws(() => assertPreflightState('ERROR'), /not one of/)
  assert.throws(() => assertPreflightState(undefined), /not one of/)
})

test('BUG CLASS: an UNSELECTED arm can never be recorded FAIL, and never blocks', () => {
  // The driver measured a real FAIL for ask-2, but this run did not select it.
  const recorded = recordCheck({ id: 'ask-2.plane', arm: 'ask-2', state: 'FAIL', detail: 'boom' }, ['ask-1'])
  assert.equal(recorded.state, 'NOT_SELECTED')
  assert.equal(recorded.rawState, 'FAIL')       // audited, never counted
  assert.equal(recorded.selection, 'arm not selected by this run')

  const graded = gradeChecks([
    { id: 'ask-1.core', arm: 'ask-1', state: 'PASS' },
    recorded,
  ])
  assert.equal(graded.verdict, 'PASS')
  assert.equal(graded.counts.NOT_SELECTED, 1)
  assert.deepEqual(graded.skipped, ['ask-2.plane'])
  assert.deepEqual(graded.blocking, [])
})

test('a SELECTED arm that fails does block; sibling unselected arms still do not', () => {
  const graded = gradeChecks([
    { id: 'ask-1.core', arm: 'ask-1', state: 'PASS' },
    recordCheck({ id: 'ask-1.plane', arm: 'ask-1', state: 'FAIL', detail: 'officer answered wrong' }, ['ask-1']),
    recordCheck({ id: 'ask-2.plane', arm: 'ask-2', state: 'FAIL', detail: 'never ran' }, ['ask-1']),
  ])
  assert.equal(graded.verdict, 'FAIL')
  assert.match(graded.reason, /ask-1\.plane/)
  assert.equal(graded.counts.NOT_SELECTED, 1)
})

test('PASS input yields PASS, startAllowed true, and no blocking checks', () => {
  const preflight = runBootPreflight(goodInput())
  assert.equal(preflight.verdict, 'PASS')
  assert.equal(preflight.startAllowed, true)
  assert.equal(preflight.counts.FAIL, 0)
  assert.equal(preflight.counts.NOT_SELECTED, 0)
  assert.deepEqual(preflight.selectedArms, ['ask-1'])
  // ask-2 is named as known; the selection record says it is NOT_SELECTED.
  const selection = preflight.checks.find((c) => c.id === 'arms.selection')
  assert.equal(selection.state, 'PASS')
  assert.match(selection.detail, /NOT_SELECTED, never FAIL/)
})

test('a missing required env var is ENV_BLOCK (nothing about the product was tested)', () => {
  const check = checkEnv({ required: ['A', 'B'], provided: { A: 'x', B: '' } })
  assert.equal(check.state, 'ENV_BLOCK')
  assert.match(check.detail, /B/)
  const preflight = runBootPreflight(goodInput({
    env: { required: ['A'], provided: {} },
  }))
  assert.equal(preflight.verdict, 'ENV_BLOCK')
  assert.equal(preflight.startAllowed, false)
})

test('a core ENV_BLOCK turns a selected arm PASS/FAIL into NOT_REACHED, never FAIL', () => {
  const preflight = runBootPreflight(goodInput({
    env: { required: ['DSH_HOME'], provided: {} },
    modalities: [{ id: 'text', supported: true, arm: 'ask-1' }],
    officer: { required: true, count: 1, arm: 'ask-1' },
  }))
  assert.equal(preflight.verdict, 'ENV_BLOCK') // env outranks the arm gate
  const modality = preflight.checks.find((c) => c.id === 'modality.text')
  assert.equal(modality.state, 'NOT_REACHED')
  const officer = preflight.checks.find((c) => c.id === 'officer.count')
  assert.equal(officer.state, 'NOT_REACHED')
})

test('host pin: mismatch is FAIL, absent checkout/SHA is ENV_BLOCK, dirty is FAIL', () => {
  assert.equal(checkHostPin({ declared: 'a'.repeat(40), actual: 'c'.repeat(40) }).state, 'FAIL')
  assert.equal(checkHostPin({ declared: 'a'.repeat(40), actual: null }).state, 'ENV_BLOCK')
  assert.equal(checkHostPin({ declared: '' }).state, 'ENV_BLOCK')
  assert.equal(checkHostPin({ declared: 'a'.repeat(40), actual: 'a'.repeat(40), porcelainClean: false }).state, 'FAIL')
  assert.equal(checkHostPin({ declared: 'a'.repeat(40), actual: 'a'.repeat(40), porcelainClean: true }).state, 'PASS')
})

test('candidate: no expected SHA is ENV_BLOCK; mismatch is FAIL; prefix match passes', () => {
  assert.equal(checkCandidate({ expectedSha: null, manifestPath: null }).state, 'ENV_BLOCK')
  assert.equal(checkCandidate({ expectedSha: 'b'.repeat(40), actualSha: 'c'.repeat(40) }).state, 'FAIL')
  assert.equal(checkCandidate({ expectedSha: 'b'.repeat(12), actualSha: 'b'.repeat(40) }).state, 'PASS')
})

test('modalities: unsupported is UNSUPPORTED, undeclared is ENV_BLOCK (unknown ≠ supported)', () => {
  assert.equal(checkModalities([{ id: 'text', supported: true }])[0].state, 'PASS')
  assert.equal(checkModalities([{ id: 'image', supported: false }])[0].state, 'UNSUPPORTED')
  assert.equal(checkModalities([{ id: 'audio' }])[0].state, 'ENV_BLOCK')
  assert.equal(checkModalities([])[0].state, 'PASS')
})

test('Officer count: exactly one passes; zero/two FAIL; unmeasured is ENV_BLOCK', () => {
  assert.equal(checkOfficerCount({ required: true, count: 1 }).state, 'PASS')
  assert.equal(checkOfficerCount({ required: true, count: 0 }).state, 'FAIL')
  assert.equal(checkOfficerCount({ required: true, count: 2 }).state, 'FAIL')
  assert.equal(checkOfficerCount({ required: true, count: null }).state, 'ENV_BLOCK')
  assert.equal(checkOfficerCount({ required: false }).state, 'PASS')
})

test('ports: :3080 is an unsanctioned-port FAIL; a busy sanctioned port is ENV_BLOCK', () => {
  assert.equal(checkPorts([{ port: 3080, free: true }], SANCTIONED)[0].state, 'FAIL')
  assert.equal(checkPorts([{ port: 3181, free: false }], SANCTIONED)[0].state, 'ENV_BLOCK')
  assert.equal(checkPorts([{ port: 3181, free: null }], SANCTIONED)[0].state, 'ENV_BLOCK')
  assert.equal(checkPorts([{ port: 3181, free: true }], SANCTIONED)[0].state, 'PASS')
})

test('World: outside-workspace is FAIL; stable-instance home is FAIL; absent is ENV_BLOCK', () => {
  assert.equal(checkWorld({ dshHome: '/tmp/x', workspaceRoot: '/repo' }).state, 'FAIL')
  assert.equal(checkWorld({ dshHome: '/tmp/x', workspaceRoot: '/repo', ownsStableInstance: true }).state, 'FAIL')
  assert.equal(checkWorld({ dshHome: null, workspaceRoot: '/repo' }).state, 'ENV_BLOCK')
  assert.equal(checkWorld({ dshHome: '/repo/tests/homes/x', workspaceRoot: '/repo' }).state, 'PASS')
})

test('World: a kit that seeds its world grades the seed; a missing seed is ENV_BLOCK, never a product FAIL', () => {
  const absent = checkWorld({
    dshHome: '/repo/tests/homes/x',
    workspaceRoot: '/repo',
    seed: { path: '/repo/tests/homes/prepared', exists: false },
  })
  assert.equal(absent.state, 'ENV_BLOCK')
  assert.equal(absent.id, 'world.seed')
  assert.match(absent.detail, /prepared seed world is absent/)
  const measured = checkWorld({
    dshHome: '/repo/tests/homes/x',
    workspaceRoot: '/repo',
    seed: { path: '/repo/tests/homes/prepared', exists: null },
  })
  assert.equal(measured.state, 'ENV_BLOCK', 'unmeasured seed is unknown, not present')
  const present = checkWorld({
    dshHome: '/repo/tests/homes/x',
    workspaceRoot: '/repo',
    seed: { path: '/repo/tests/homes/prepared', exists: true },
  })
  assert.equal(present.state, 'PASS')
  assert.match(present.detail, /seeded from/)
})

test('assertBootPreflight refuses non-PASS with the typed reason and blocking checks', () => {
  const failing = runBootPreflight(goodInput({ ports: [{ port: 3080, free: true }] }))
  assert.equal(failing.startAllowed, false)
  assert.throws(
    () => assertBootPreflight(failing),
    (error) => {
      assert.ok(error instanceof BootPreflightRefusal)
      assert.equal(error.code, 'BOOT_PREFLIGHT_REFUSED')
      assert.equal(error.verdict, 'FAIL')
      assert.ok(error.blocking.some((c) => c.id === 'port.3080'))
      return true
    },
  )
  assert.throws(() => assertBootPreflight(null), BootPreflightRefusal)
  assert.equal(assertBootPreflight(runBootPreflight(goodInput())).verdict, 'PASS')
})

test('precedence names FAIL before ENV_BLOCK when several states block', () => {
  assert.deepEqual([...BLOCKING_PRECEDENCE], ['FAIL', 'ENV_BLOCK', 'UNSUPPORTED', 'NOT_REACHED'])
  const graded = gradeChecks([
    { id: 'a', arm: null, state: 'ENV_BLOCK' },
    { id: 'b', arm: null, state: 'FAIL' },
    { id: 'c', arm: null, state: 'UNSUPPORTED' },
  ])
  assert.equal(graded.verdict, 'FAIL')
  assert.match(graded.reason, /^FAIL at b/)
})
