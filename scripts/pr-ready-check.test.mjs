/**
 * pr-ready-check.test.mjs — the refusal algebra of the pre-ready check.
 *
 * The live half (gh api / git) is exercised by running the tool against a real
 * PR; here we pin the only part a reader cannot eyeball: which fact produces
 * which refusal, and that a fully-satisfied fixture is READY.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { evaluate, latestCheck, LAYERS } from './pr-ready-check.mjs'

const HEAD = 'a'.repeat(40)

function check(name, conclusion, at = '2026-11-13T00:00:00Z', status = 'completed') {
  return { name, conclusion, status, completed_at: at }
}

function greenChecks() {
  return [
    check('ci-fast / ci-fast', 'success', '2026-11-13T00:00:01Z'),
    check('ci-integration / ci-integration', 'success', '2026-11-13T00:00:02Z'),
    check('ci-security / ci-security', 'success', '2026-11-13T00:00:03Z'),
    check('ci-product / ci-product', 'success', '2026-11-13T00:00:04Z'),
    check('ci-required-deferred', 'success', '2026-11-13T00:00:05Z'),
    check('ci-census / census-runtime', 'skipped', '2026-11-13T00:00:06Z'),
  ]
}

function settlement(sha) {
  return { id: 7, body: `**[dated settlement, 2026-11-13T16:20Z — verified]**\ncovered head ${sha}\nevidence: dev/agent-workflow/evidence/x/` }
}

function fixture(over = {}) {
  return {
    pr: {
      number: 759,
      isDraft: true,
      mergeStateStatus: 'blocked',
      headRefOid: HEAD,
      title: '[BASELINE] something',
      body: 'body',
      ...(over.pr ?? {}),
    },
    checks: over.checks ?? greenChecks(),
    comments: over.comments ?? [settlement(HEAD)],
    git: over.git === undefined ? { clean: true, ahead: 0 } : over.git,
  }
}

test('a fully satisfied fixture is READY with exit 0', () => {
  const v = evaluate(fixture())
  assert.equal(v.verdict, 'READY')
  assert.equal(v.exit, 0)
  assert.deepEqual(v.reasons, [])
})

test('latestCheck takes the newest run and tolerates the "name / job" form', () => {
  const checks = [check('ci-fast / ci-fast', 'failure', '2026-11-13T00:00:01Z'), check('ci-fast / ci-fast', 'success', '2026-11-13T00:00:09Z')]
  assert.equal(latestCheck(checks, 'ci-fast').conclusion, 'success')
  assert.equal(latestCheck([check('ci-census / census-runtime', 'skipped')], 'ci-census').conclusion, 'skipped')
  assert.equal(latestCheck([], 'ci-fast'), null)
})

test('no head sha is a refusal, never a pass', () => {
  const v = evaluate(fixture({ pr: { headRefOid: '' } }))
  assert.equal(v.verdict, 'REFUSED')
  assert.deepEqual(v.reasons, ['NO_HEAD_SHA'])
})

test('already-ready is refused: this check exists to run before the flip', () => {
  const v = evaluate(fixture({ pr: { isDraft: false } }))
  assert.ok(v.reasons.includes('ALREADY_READY'))
})

test('the open-state marker is refused on title and on body first line', () => {
  assert.ok(evaluate(fixture({ pr: { title: 'DO-NOT-MERGE x' } })).reasons.includes('MARKER_PRESENT_TITLE'))
  assert.ok(evaluate(fixture({ pr: { body: 'DO-NOT-MERGE — awaiting' } })).reasons.includes('MARKER_PRESENT_BODY'))
  // a mention deeper in the body is prose by law (#455 lesson 1)
  assert.equal(evaluate(fixture({ pr: { body: 'intro\nDO-NOT-MERGE is discussed here' } })).verdict, 'READY')
})

test('behind and dirty are refused; blocked/draft/unstable are not', () => {
  assert.ok(evaluate(fixture({ pr: { mergeStateStatus: 'behind' } })).reasons.includes('BRANCH_BEHIND'))
  assert.ok(evaluate(fixture({ pr: { mergeStateStatus: 'dirty' } })).reasons.includes('BRANCH_DIRTY'))
  for (const state of ['blocked', 'draft', 'unstable', 'clean']) {
    assert.equal(evaluate(fixture({ pr: { mergeStateStatus: state } })).verdict, 'READY', state)
  }
})

test('every L1 layer must be green on this head', () => {
  for (const layer of LAYERS) {
    const checks = greenChecks().map((c) => (c.name.startsWith(`${layer} /`) ? { ...c, conclusion: 'failure' } : c))
    const v = evaluate(fixture({ checks }))
    const reason = `LAYER_${layer.toUpperCase().replace(/-/g, '_')}_FAILURE`
    assert.ok(v.reasons.includes(reason), `${layer} -> ${v.reasons.join(',')}`)
  }
  const missing = evaluate(fixture({ checks: greenChecks().filter((c) => !c.name.startsWith('ci-security')) }))
  assert.ok(missing.reasons.includes('LAYER_CI_SECURITY_MISSING'))
})

test('the deferred summary is the L1 verdict', () => {
  const checks = greenChecks().map((c) => (c.name === 'ci-required-deferred' ? { ...c, conclusion: 'failure' } : c))
  assert.ok(evaluate(fixture({ checks })).reasons.includes('DEFERRED_FAILURE'))
})

test('a census that already ran is refused (the head would pay L2 twice)', () => {
  const checks = greenChecks().map((c) => (c.name === 'ci-census / census-runtime' ? { ...c, conclusion: 'success' } : c))
  assert.ok(evaluate(fixture({ checks })).reasons.includes('CENSUS_SUCCESS_NOT_SKIPPED'))
})

test('settlement must exist and cover the current head', () => {
  assert.ok(evaluate(fixture({ comments: [] })).reasons.includes('SETTLEMENT_MISSING'))
  const stale = [{ id: 1, body: `**[dated settlement, 2026-11-13T16:20Z — old]**\ncovered head ${'b'.repeat(40)}` }]
  assert.ok(evaluate(fixture({ comments: stale })).reasons.includes('SETTLEMENT_NOT_COVERING_HEAD'))
  const noOpener = [{ id: 1, body: `looks settled ${HEAD}` }]
  assert.ok(evaluate(fixture({ comments: noOpener })).reasons.includes('SETTLEMENT_MISSING'))
})

test('local hygiene: dirty worktree and unpushed commits are refused', () => {
  assert.ok(evaluate(fixture({ git: { clean: false, ahead: 0 } })).reasons.includes('WORKTREE_DIRTY'))
  assert.ok(evaluate(fixture({ git: { clean: true, ahead: 2 } })).reasons.includes('UNPUSHED_COMMITS'))
  assert.equal(evaluate(fixture({ git: null })).verdict, 'READY')
})

test('refusals accumulate instead of short-circuiting (one run shows all of them)', () => {
  const v = evaluate(fixture({
    pr: { isDraft: false, title: 'DO-NOT-MERGE x', mergeStateStatus: 'behind' },
    checks: [],
    comments: [],
    git: { clean: false, ahead: 1 },
  }))
  for (const r of ['ALREADY_READY', 'MARKER_PRESENT_TITLE', 'BRANCH_BEHIND', 'SETTLEMENT_MISSING', 'WORKTREE_DIRTY']) {
    assert.ok(v.reasons.includes(r), r)
  }
})

test('the CLI self-test runs without network and agrees with the algebra', () => {
  const r = spawnSync(process.execPath, ['scripts/pr-ready-check.mjs', '--self-test'], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /DSH-PR-READY-SELFTEST PASS cases=6 failed=0/)
})
