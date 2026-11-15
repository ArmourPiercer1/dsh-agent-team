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
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

const REPO = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..')
const SUITE = join(REPO, 'tests', 'world-factory', 'm7a-real-slice.test.mjs')
const emptyHost = mkdtempSync(join(tmpdir(), 'm7a-no-host-'))

afterAll(() => {
  rmSync(emptyHost, { recursive: true, force: true })
})

function runSuite(env: Record<string, string>) {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', SUITE], {
    cwd: REPO,
    env: { ...process.env, M7A_HOST_TREE: emptyHost, M7A_REQUIRE_PINNED_HOST: '', ...env },
    encoding: 'utf8',
    timeout: 120_000,
  })
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

describe('M7-A real-host suite: host-state contract', () => {
  it('an absent host refuses in words and skips, and the suite is not green', () => {
    const { status, output } = runSuite({})
    expect(status).toBe(0)
    expect(output).toContain('M7A-REAL-SLICE-HOST-REFUSED')
    expect(output).toContain('reason=apps/cli/lib/bin.js is absent')
    expect(output).toContain('action=provision per docs/TEST_METHODS.md')
    expect(output).toMatch(/skipped 1/u)
    expect(output).toMatch(/pass 0/u)
  })

  it('M7A_REQUIRE_PINNED_HOST=1 makes the same absence a hard failure', () => {
    const { status, output } = runSuite({ M7A_REQUIRE_PINNED_HOST: '1' })
    expect(status).not.toBe(0)
    expect(output).toContain('M7A-REAL-SLICE-HOST-INCOMPLETE')
  })
})
