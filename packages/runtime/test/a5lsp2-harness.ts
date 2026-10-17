/**
 * a5lsp2-harness — shared fixture plumbing for the Alpha.5 P-LSP production
 * lane (R-1 streaming arm + R-2 per-(member×policy-generation) LSP realm
 * assembly). Scratch worlds live under `tests/homes/` (TEST_METHODS §7; the
 * lane's sanctioned prefix is `a5lsp2-`), are built fresh per suite run and
 * are removed on teardown. The confined legs only confine THEIR OWN
 * processes (P1 entry self-lock); nothing outside the scratch tree is
 * written.
 *
 * @module packages/runtime/test/a5lsp2-harness
 */

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findTestRepoRoot, homeRoot } from '../../../tests/paths.mjs'

/** The lane's scratch-world prefix (brief-pinned: `tests/homes/a5lsp2-*`). */
export const A5LSP2_WORLD_PREFIX = 'a5lsp2-'

/** Create a fresh scratch world directory; the caller owns cleanup. */
export function makeWorld(label: string): string {
  const repoRoot = findTestRepoRoot(fileURLToPath(import.meta.url))
  if (typeof repoRoot !== 'string') throw new Error('a5lsp2 harness: tests/paths.mjs could not resolve the repo root')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = join(homeRoot(repoRoot), `${A5LSP2_WORLD_PREFIX}${label}-${stamp}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Remove a scratch world (teardown). Deleting an absent tree is not an error. */
export function removeWorld(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
}

/** Locate a lane test fixture (this directory). */
export function fixturePath(name: string): string {
  return join(dirname(fileURLToPath(import.meta.url)), name)
}

/** The production launcher bytes (the trusted prelauncher the assembly pins). */
export function productionLauncherPath(): string {
  return fixturePath('../sandbox-provider/launcher/landlock-prelauncher.py')
}

/** sha256 (hex) of a file's bytes — the assembly-pinned integrity input. */
export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/** Write a JSON file under the world and return its path. */
export function writeJson(dir: string, name: string, value: unknown): string {
  const path = join(dir, name)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value))
  return path
}

/** OS liveness: /proc is authoritative inside this world's PID namespace. */
export function pidAlive(pid: number): boolean {
  try {
    return readdirSync('/proc').includes(String(pid))
  } catch {
    return false
  }
}

/** This runtime's node binary path (lane-cast: the shared program shims `process`). */
export function execPath(): string {
  const laneProcess = (globalThis as { process?: { execPath?: string } }).process
  return laneProcess?.execPath ?? '/usr/bin/node'
}

/**
 * Zero-residue sampling: every LIVE process whose /proc cwd or cmdline
 * mentions the lane fixtures/world. Returns the observed pid/cmd facts —
 * an empty array is the zero-handle / zero-pid proof.
 */
export function sampleLaneProcesses(worldRoot: string): { pid: number; cwd: string; cmd: string }[] {
  const found: { pid: number; cwd: string; cmd: string }[] = []
  let entries: string[]
  try {
    entries = readdirSync('/proc')
  } catch {
    return found
  }
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue
    const pid = Number(entry)
    let cwd = ''
    let cmd = ''
    try {
      cwd = readFileSync(`/proc/${pid}/cwd`, 'utf8')
    } catch {
      // vanished or unreadable (a pid outside our ownership) — not a lane process we created
    }
    try {
      cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ').trim()
    } catch {
      continue
    }
    const lane = cmd.includes('a5lsp2-fixture') || cwd.startsWith(worldRoot)
    if (lane) found.push({ pid, cwd, cmd: cmd.slice(0, 200) })
  }
  return found
}

/** A bounded poll: resolves true once `until()` is true, false at the deadline. */
export async function pollUntil(until: () => boolean, deadlineMs: number, everyMs = 25): Promise<boolean> {
  const t0 = Date.now()
  for (;;) {
    if (until()) return true
    if (Date.now() - t0 >= deadlineMs) return false
    await new Promise((r) => setTimeout(r, everyMs))
  }
}

/** The node binary directory the confined fixture needs execute+read on. */
export function nodeBinDir(): string {
  return dirname(execPath())
}
