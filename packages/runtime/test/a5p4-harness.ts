/**
 * a5p4-harness — shared fixture plumbing for the Alpha.5 PR4 provider/launcher
 * lane (C Lane, branch `alpha5-pr4-prov`). DORMANT lane: this harness is inert
 * without the specs that import it.
 *
 * Scratch worlds live under `tests/homes/` (TEST_METHODS §7; the lane's
 * sanctioned prefix is `a5p4-`), are built fresh per suite run, and are
 * removed on teardown. Nothing outside the scratch tree is written; the
 * launcher legs only confine THEIR OWN processes (P1 entry self-lock).
 *
 * @module packages/runtime/test/a5p4-harness
 */

import { mkdirSync, rmSync } from 'node:fs'

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findTestRepoRoot, homeRoot } from '../../../tests/paths.mjs'
import { createLauncherDeps } from '../sandbox-provider/probe-abi.js'

/** The lane's scratch-world prefix (brief-pinned: `tests/homes/a5p4-*`). */
export const A5P4_WORLD_PREFIX = 'a5p4-'

/** Create a fresh scratch world directory; the caller owns cleanup. */
export function makeScratchWorld(label: string): string {
  const repoRoot = findTestRepoRoot(fileURLToPath(import.meta.url))
  if (typeof repoRoot !== 'string') throw new Error('a5p4 harness: tests/paths.mjs could not resolve the repo root')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const name = `${A5P4_WORLD_PREFIX}${label}-${stamp}`
  const dir = join(homeRoot(repoRoot), name)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Remove a scratch world (teardown). Deleting an absent tree is not an error. */
export function removeScratchWorld(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
}

/** Locate the lane's reference launcher script (python3 stdlib only). */
export function launcherPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
}

/** The production launcher deps (no shell, fixed argv array, bounded buffers). */
export function createDefaultLauncherDeps() {
  return createLauncherDeps({
    pythonPath: (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.['A5P4_PYTHON'] ?? 'python3',
    launcherPath: launcherPath(),
  })
}

/**
 * One launcher invocation outcome as the lane sees it — the injected seam's
 * return shape (the production default wraps `spawnSync` with no shell).
 */
export interface RunResult {
  readonly rc: number | null
  readonly stdout: string
  readonly stderr: string
}

/** Parse the launcher's JSON stdout; a non-JSON stdout is a MIXED/FAILED leg, never a throw. */
export function parseLauncherJson(stdout: string): { ok: true; value: Record<string, unknown> } | { ok: false; raw: string } {
  const line = stdout.trim().split('\n').filter((l) => l.length > 0).pop()
  if (line === undefined) return { ok: false, raw: stdout }
  try {
    const parsed: unknown = JSON.parse(line)
    if (typeof parsed === 'object' && parsed !== null) return { ok: true, value: parsed as Record<string, unknown> }
    return { ok: false, raw: stdout }
  } catch {
    return { ok: false, raw: stdout }
  }
}
