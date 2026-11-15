/**
 * Host-free negative controls for `scripts/dispatch-tests.mjs` (TINF trust-closeout, F-01).
 *
 * THE DEFECT THESE CONTROL. `node scripts/dispatch-tests.mjs --run --leg tinf-instruments --json`
 * printed 36 lines of plan JSON and exited 0 without spawning a single test. `eb3-ci-required` graded
 * the workflow line by a cmd PREFIX, so appending `--json` to a manifest `cmd` kept the static gate
 * green while the CI step ran nothing. The controls below are the CLI itself (never an internal
 * helper), because the defect lived in argument dispatch, not in leg resolution:
 *
 *   - EVERY conflicting mode pair      -> REFUSED DISPATCH_MODE_CONFLICT, exit 2, EMPTY stdout;
 *   - `--run` with no `--leg`          -> REFUSED DISPATCH_NO_LEG, exit 2;
 *   - `--leg … --run`                  -> really spawns `node --test` (child TAP output is present),
 *                                         the run token is printed AFTER the child output, and the
 *                                         dispatcher returns the runner's own status;
 *   - `--leg … --json`                 -> mode=inspect, no TAP output (inspection never spawns).
 *
 * Host-free: six cheap `node` spawns of the CLI; the execution control runs ONE real one-file suite
 * (`tinf-m0-baseline`, no host, no build, no network).
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('./dispatch-tests.mjs', import.meta.url))

function cli(args) {
  // The outer node:test runner exports NODE_TEST_CONTEXT; a spawned `node --test` that inherits it
  // reports through the parent's channel instead of its own stdout. Production never sets it, and
  // this suite must observe the child's real TAP output, so it is removed for the spawn.
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

test('dispatch: every execution/inspection mode pair refuses by name, before any output', () => {
  const pairs = [
    ['--run', '--json'],
    ['--run', '--list'],
    ['--run', '--check'],
    ['--run', '--parity'],
    ['--run', '--run-args'],
    ['--run', '--help'],
    ['--json', '--list'],
    ['--json', '--check'],
    ['--list', '--parity'],
    ['--check', '--run-args'],
  ]
  for (const pair of pairs) {
    const r = cli([...pair, '--leg', 'tinf-instruments'])
    assert.equal(r.status, 2, `${pair.join(' ')} must exit 2`)
    assert.match(r.stderr, /REFUSED DISPATCH_MODE_CONFLICT/, `${pair.join(' ')} must name the refusal`)
    assert.equal(r.stdout, '', `${pair.join(' ')} must print NOTHING (no plan JSON, no argv, no token)`)
  }
})

test('dispatch: --run without --leg is DISPATCH_NO_LEG (a named refusal, not the generic usage exit)', () => {
  const r = cli(['--run'])
  assert.equal(r.status, 2)
  assert.match(r.stderr, /REFUSED DISPATCH_NO_LEG/)
  assert.equal(r.stdout, '')
})

test('dispatch: --run really spawns and prints its token only AFTER the child ran', () => {
  const r = cli(['--run', '--leg', 'tinf-m0-baseline'])
  assert.equal(r.status, 0)
  // The child (`node --test`) prints the TAP summary; a dispatcher that only printed a plan cannot.
  assert.match(r.stdout, /ℹ tests \d+/, 'no node:test TAP summary in stdout — --run did not spawn')
  const childAt = r.stdout.indexOf('ℹ tests')
  const tokenAt = r.stdout.indexOf('DSH-TEST-DISPATCH mode=run')
  assert.ok(tokenAt > childAt, 'the run token must be printed AFTER the spawn, never before it')
  assert.match(r.stdout.slice(tokenAt), /leg=tinf-m0-baseline suites=1 files=1 exit=0/)
})

test('dispatch: inspection is labelled mode=inspect and never spawns', () => {
  const r = cli(['--leg', 'tinf-m0-baseline', '--json'])
  assert.equal(r.status, 0)
  const artifact = JSON.parse(r.stdout)
  assert.equal(artifact.mode, 'inspect')
  assert.equal(artifact.suites.length, 1)
  assert.doesNotMatch(r.stdout, /ℹ tests/, 'inspection must not run a test')

  const human = cli(['--leg', 'tinf-m0-baseline', '--run-args'])
  assert.equal(human.status, 0)
  assert.match(human.stdout, /DSH-TEST-DISPATCH mode=inspect /)
  assert.match(human.stdout, /^node --test /m)
  assert.doesNotMatch(human.stdout, /ℹ tests/)
})

test('dispatch: the F-01 invocation (`--run … --json`) cannot be satisfied without spawning', () => {
  const r = cli(['--run', '--leg', 'tinf-instruments', '--json'])
  assert.equal(r.status, 2)
  assert.match(r.stderr, /REFUSED DISPATCH_MODE_CONFLICT/)
  assert.doesNotMatch(r.stdout, /"schema": "test-dispatch\/1"/, 'the old defect printed the plan JSON here')
})
