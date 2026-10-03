/**
 * rc2-kit-fault-injection.test.ts — the rc2 kit's run control driven to its
 * failure paths IN A SUBPROCESS, asserting which process dies.
 *
 * THE REVIEW FINDING THIS CLOSES. The kit's first guard fatalled with
 * `process.exit(2)` from inside `dieFatal`, which bypassed the owner's `finally`
 * (stop the host child, close the mock) and left a spawned host running after
 * the kit "finished"; it also had no independent lifetime watchdog, and its
 * request ceiling was checked only after a wait's fast path, with the
 * repeated-reply streak tracked globally so interleaved title/sibling traffic
 * reset it. The reviewer's required proof is a process-level one: after a cap, a
 * timeout, or an unexpected shape, ONLY this run's own child is gone — an
 * unrelated process is never touched.
 *
 * So the assertions are made against the process table, not against a mock:
 *   - the test spawns the "host" child AND a decoy process it never hands to the
 *     harness (only the PID travels, for the survival check);
 *   - `fault-harness.mjs` reproduces the kit's owner shape (arm → bindChild →
 *     budget-guarded decide → abort → owner cleanup) and is driven to one fault;
 *   - the test then asserts: expected exit code, expected violation kind, own
 *     child gone, decoy ALIVE, and `cleanup.json` proving the child's exit was
 *     observed and the mock closed before the harness exited.
 *
 * Exit-code contract (mirrors the kit): 0 healthy, 2 budget/guard abort,
 * 3 decoder failure, 1 anything else.
 *
 * RUNNER CONSTRAINTS: synchronous bodies (`spawnSync`), shim-safe matchers.
 * Scratch lives under `tests/homes/` (gitignored, inside the workspace) and is
 * removed in `finally`; no port and no real host is used here.
 *
 * @module @dsh-agent-team/testkit/test/rc2-kit-fault-injection
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../..')
const HARNESS = join(REPO, 'tests/kits/rc2-real-host-smoke/fault-harness.mjs')
const RUN_ID = `${Date.now()}-${process.pid}`
const SCRATCH = join(REPO, 'tests/homes', `rc2-kit-fault-${RUN_ID}`)

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Spawn a detached, long-lived process we do NOT own (the decoy) or the child. */
const spawnDetached = (args: string[]): number => {
  const child = spawn(process.execPath, args, { detached: true, stdio: 'ignore' })
  child.unref()
  if (typeof child.pid !== 'number') throw new Error('spawn failed')
  return child.pid
}

const readJson = (path: string): Record<string, unknown> => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>

/** Wait (bounded) for a pid to disappear, so "dead" is not a race. */
const waitUntilDead = (pid: number, timeoutMs = 5_000): boolean => {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    if (!alive(pid)) return true
    spawnSync('sleep', ['0.05'])
  }
  return !alive(pid)
}

const sleep = (ms: number) => spawnSync('sleep', [(ms / 1000).toFixed(2)])

interface Run {
  status: number | null
  /** The child the harness spawned and owned (recorded by the harness). */
  ownChildPid: number | null
  /** A process the test owns and the harness must never signal. */
  decoyPid: number
  stdout: string
  stderr: string
}

function runScenario(scenario: string, extraEnv: Record<string, string> = {}): Run {
  // An unrelated long-lived process: the harness is told its pid and must still
  // leave it alive. The run's OWN child is spawned by the harness itself, so
  // ownership and reaping live in the same process (a test-spawned child would
  // sit unreaped — a zombie — while the test blocks in `spawnSync`, and
  // `kill(pid, 0)` succeeds on a zombie: an observation artifact, not a leak).
  const decoyPid = spawnDetached(['-e', 'setTimeout(() => {}, 120000)'])
  sleep(150)
  const res = spawnSync(process.execPath, [HARNESS], {
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, FAULT_SCENARIO: scenario, FAULT_SCRATCH: SCRATCH, UNRELATED_PID: String(decoyPid), ...extraEnv },
  })
  sleep(200)
  let ownChildPid: number | null = null
  try {
    const raw = readFileSync(join(SCRATCH, `${scenario}-own-child.json`), 'utf8')
    ownChildPid = (JSON.parse(raw) as { pid: number }).pid ?? null
  } catch {
    ownChildPid = null
  }
  return {
    status: res.status,
    ownChildPid,
    decoyPid,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
  }
}

/** Every assertion that must hold in EVERY fault scenario. */
function expectOwnedCleanup(run: Run, scenario: string) {
  const cleanupPath = join(SCRATCH, `${scenario}-cleanup.json`)
  expect(existsSync(cleanupPath)).toBe(true)
  const cleanup = readJson(cleanupPath)
  expect(cleanup.cleanupRan).toBe(true)
  // The owner's cleanup observed ITS OWN child disappear before exiting…
  expect(cleanup.ownChildExitSeen).toBe(true)
  // …and closed the mock it owns (the two things dieFatal bypassed).
  expect(cleanup.mockClosed).toBe(true)
  // The child this run owns is gone — and it is the pid the harness recorded.
  expect(typeof run.ownChildPid).toBe('number')
  if (run.ownChildPid !== null) expect(waitUntilDead(run.ownChildPid)).toBe(true)
  // And the process it does NOT own is untouched.
  expect(alive(run.decoyPid)).toBe(true)
  return cleanup
}

const spawned: number[] = []

beforeAll(() => {
  mkdirSync(SCRATCH, { recursive: true })
})

afterAll(() => {
  for (const pid of spawned) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* already gone */
    }
  }
  rmSync(SCRATCH, { recursive: true, force: true })
})

describe('rc2 run control — fault injection leaves only its own child dead', () => {
  it('F0 the healthy path completes, stops its child, touches nothing else', () => {
    const run = runScenario('healthy')
    spawned.push(run.decoyPid)
    expect(run.status).toBe(0)
    const cleanup = expectOwnedCleanup(run, 'healthy')
    expect(cleanup.violationKind).toBe(null)
    expect(cleanup.watchdogFired).toBe(false)
  })

  it('F1 the total-request ceiling trips on distinct states and aborts via the owner', () => {
    const run = runScenario('request-cap')
    spawned.push(run.decoyPid)
    expect(run.status).toBe(2)
    const cleanup = expectOwnedCleanup(run, 'request-cap')
    expect(cleanup.violationKind).toBe('total-requests')
  })

  it('F2 a repeated state trips even with other sessions interleaved', () => {
    const run = runScenario('state-loop')
    spawned.push(run.decoyPid)
    expect(run.status).toBe(2)
    const cleanup = expectOwnedCleanup(run, 'state-loop')
    // The first guard missed this: its streak counter was global, so the
    // interleaved title traffic reset it every other request.
    expect(cleanup.violationKind).toBe('same-state-repeat')
  })

  it('F3 consecutive wait timeouts trip and unwind through the owner', () => {
    const run = runScenario('wait-timeout')
    spawned.push(run.decoyPid)
    expect(run.status).toBe(2)
    const cleanup = expectOwnedCleanup(run, 'wait-timeout')
    expect(cleanup.violationKind).toBe('consecutive-misses')
  })

  it('F4 an unrecognized wire shape fails loudly and still runs cleanup', () => {
    const run = runScenario('unexpected-shape')
    spawned.push(run.decoyPid)
    // 3 = decoder failure: distinguishable from a budget abort.
    expect(run.status).toBe(3)
    const cleanup = expectOwnedCleanup(run, 'unexpected-shape')
    expect(cleanup.violationKind).toBe(null)
    const context = readJson(join(SCRATCH, 'unexpected-shape-run-abort-context.json'))
    expect(context.errorName).toBe('WireShapeError')
    // The original diagnostic survives the unwinding — it is the evidence.
    expect(String(context.preservedOriginalError)).toContain('unrecognized')
  })

  it('F5 the independent lifetime watchdog fires with no progress at all', () => {
    const run = runScenario('child-lifetime')
    spawned.push(run.decoyPid)
    expect(run.status).toBe(2)
    const cleanup = expectOwnedCleanup(run, 'child-lifetime')
    // Nothing else in the run could have noticed: no request, no wait.
    expect(cleanup.watchdogFired).toBe(true)
    expect(cleanup.violationKind).toBe('aborted')
  })

  it('F6 the abort reason is written where the next reader will look', () => {
    const run = runScenario('request-cap')
    spawned.push(run.decoyPid)
    const abortPath = join(SCRATCH, 'request-cap-run-abort.json')
    // run-control writes `run-abort.json` under the run's evidence name; the
    // harness prefixes it per scenario, so either spelling proves the record.
    const candidates = [abortPath, join(SCRATCH, 'run-abort.json')]
    const found = candidates.find((p) => existsSync(p))
    expect(found !== undefined).toBe(true)
    if (found !== undefined) {
      const record = readJson(found)
      expect(String(JSON.stringify(record))).toContain('total')
    }
  })

  it('F7 the actual runner callback and owned-process cleanup regressions pass', () => {
    const env = { ...process.env }
    delete env.NODE_TEST_CONTEXT
    const result = spawnSync(process.execPath, [
      '--test',
      join(REPO, 'tests/kits/rc2-real-host-smoke/runner-wiring.regression.test.mjs'),
      join(REPO, 'tests/kits/rc2-real-host-smoke/run-control.regression.test.mjs'),
    ], { encoding: 'utf8', timeout: 60_000, env })
    expect(result.status).toBe(0)
  })
})
