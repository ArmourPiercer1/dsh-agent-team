/**
 * Pins the M7-A real-host suite's host-state contract: a host that is absent
 * must produce a machine-readable DECLARED REFUSAL and SKIPPED cases — never a
 * green run — and `M7A_REQUIRE_PINNED_HOST=1` must turn that refusal into a
 * hard failure.
 *
 * This runs the real suite file with `M7A_HOST_TREE` pointed at an empty
 * directory, so it costs no boot: the suite must refuse before it creates a
 * world. The words are pinned because a refusal nobody can read is not a
 * refusal.
 *
 * node:test on purpose: it is host-free and belongs to the same dispatch leg as
 * the C1 unit suite (`m7a-real-host-c1`), so both run in ci-integration on every
 * PR. It is NOT a vitest suite — the vitest census population (705 files at the
 * last real census) is a reviewed artifact and this file does not move it.
 *
 * Run: node --test tests/world-factory/m7a-real-slice-host-state.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const REPO = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const SUITE = join(REPO, 'tests', 'world-factory', 'm7a-real-slice.test.mjs')
const emptyHost = mkdtempSync(join(tmpdir(), 'm7a-no-host-'))

test.after(() => {
  rmSync(emptyHost, { recursive: true, force: true })
})

function runSuite(env) {
  // The outer runner marks this process with NODE_TEST_CONTEXT; a child that
  // inherits it is treated as a nested worker and SKIPS running the file (the
  // exact "run() called recursively" trap that would make these pins vacuous).
  const inherited = { ...process.env }
  delete inherited.NODE_TEST_CONTEXT
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', SUITE], {
    cwd: REPO,
    env: { ...inherited, M7A_HOST_TREE: emptyHost, M7A_REQUIRE_PINNED_HOST: '', ...env },
    encoding: 'utf8',
    timeout: 120_000,
  })
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

test('M7-A real-host suite: an absent host refuses in words and skips, and the suite is not green', () => {
  const { status, output } = runSuite({})
  assert.equal(status, 0)
  assert.match(output, /M7A-REAL-SLICE-HOST-REFUSED/u)
  assert.match(output, /reason=apps\/cli\/lib\/bin\.js is absent/u)
  assert.match(output, /action=provision per docs\/TEST_METHODS\.md/u)
  assert.match(output, /skipped 1/u)
  assert.match(output, /pass 0/u)
})

test('M7-A real-host suite: M7A_REQUIRE_PINNED_HOST=1 makes the same absence a hard failure', () => {
  const { status, output } = runSuite({ M7A_REQUIRE_PINNED_HOST: '1' })
  assert.notEqual(status, 0)
  assert.match(output, /M7A-REAL-SLICE-HOST-INCOMPLETE/u)
})
