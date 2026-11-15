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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { TEST_USE_BASELINE_SHA } from '../paths.mjs'

const REPO = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const SUITE = join(REPO, 'tests', 'world-factory', 'm7a-real-slice.test.mjs')
const emptyHost = mkdtempSync(join(tmpdir(), 'm7a-no-host-'))
// A host tree that LOOKS provisioned (`apps/cli/lib/bin.js` exists) but cannot
// be trusted: no git base, so the suite's host-base precondition must fail.
const brokenHost = mkdtempSync(join(tmpdir(), 'm7a-broken-host-'))

test.after(() => {
  rmSync(emptyHost, { recursive: true, force: true })
  rmSync(brokenHost, { recursive: true, force: true })
})

function runSuite(env, timeoutMs = 120_000) {
  // The outer runner marks this process with NODE_TEST_CONTEXT; a child that
  // inherits it is treated as a nested worker and SKIPS running the file (the
  // exact "run() called recursively" trap that would make these pins vacuous).
  const inherited = { ...process.env }
  delete inherited.NODE_TEST_CONTEXT
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', SUITE], {
    cwd: REPO,
    env: { ...inherited, M7A_HOST_TREE: emptyHost, M7A_REQUIRE_PINNED_HOST: '', ...env },
    encoding: 'utf8',
    timeout: timeoutMs,
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

test('M7-A real-host suite: a host-start failure EXITS, names the precondition, and does not hang', () => {
  // MEASURED on the hosted runner (job 132898455498): the suite failed 166 ms in and the step
  // then sat for 41 minutes, because the in-process mock provider it had already started kept
  // the event loop alive and the reporter never reached its failure summary. The contract this
  // case pins is the one that matters at the job level: a failing suite finishes failing.
  //
  // The host tree is HOST-FREE by construction: a fake `bin.js` that exits at once, and a
  // `git` on PATH that answers the pin checks so the suite reaches `startHost`. That is the
  // exact sequence that hung — mock provider listening, Host start failing — and the boot
  // timeout is 2 s so the failure is fast and deterministic.
  const fakeHost = mkdtempSync(join(tmpdir(), 'm7a-fake-host-'))
  const fakeBin = join(fakeHost, 'shims')
  mkdirSync(join(fakeHost, 'apps', 'cli', 'lib'), { recursive: true })
  writeFileSync(join(fakeHost, 'apps', 'cli', 'lib', 'bin.js'), 'process.exit(0)\n')
  mkdirSync(fakeBin)
  const realGit = spawnSync('command', ['-v', 'git'], { shell: true, encoding: 'utf8' }).stdout.trim()
  writeFileSync(
    join(fakeBin, 'git'),
    `#!/bin/sh\ncase "$*" in\n  *rev-parse*) echo ${TEST_USE_BASELINE_SHA} ;;\n  *status*) exit 0 ;;\n  *) exec ${realGit} "$@" ;;\nesac\n`,
    { mode: 0o755 },
  )
  try {
    const startedAt = Date.now()
    const { status, output } = runSuite({
      M7A_HOST_TREE: fakeHost,
      M7A_REQUIRE_PINNED_HOST: '1',
      M7A_BOOT_TIMEOUT_MS: '2000',
      PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
    }, 240_000)
    const elapsedMs = Date.now() - startedAt
    // spawnSync's 120 s timeout reports `status: null`; an exit by itself reports a number.
    assert.notEqual(status, null, `the suite must exit on its own (spawn timeout would mean a hang); output:\n${output}`)
    assert.notEqual(status, 0)
    assert.ok(elapsedMs < 240_000, `the suite must finish inside the child timeout (took ${String(elapsedMs)}ms)`)
    assert.match(output, /M7A-PRECONDITION host-start FAILED/u)
    assert.match(output, /\[M7A\] SUITE FAILED:/u)
    assert.match(output, /teardown \(t\.after\)|teardown \(body-finally\)/u)
  } finally {
    rmSync(fakeHost, { recursive: true, force: true })
  }
})
