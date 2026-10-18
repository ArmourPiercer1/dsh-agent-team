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

import { mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
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
 * Per-run identity token, stamped on EVERY process this lane starts
 * (`laneArgv` appends it) and recognised by the samplers below.
 *
 * Why identity and not vocabulary: census run 330's `FORENSIC` scene caught the
 * old rule mis-attributing a foreign process — `foreign=[14668]` whose cmdline
 * was `node …/eslint/bin/eslint.js …`, a LINT leg of the same CI job that merely
 * named a fixture path in its arguments. Zero-residue is a claim about
 * processes THIS lane created, so membership is decided by (a) the process'
 * cwd being inside this world, or (b) the run nonce in its argv. A neighbour's
 * linter/scanner carries neither, and no amount of load average can change
 * that (the same artifact put cpuPressure at avg10=13.2 on a 16-core runner,
 * which retired the CPU-starvation hypothesis).
 */
export const LANE_TOKEN_FLAG = '--lane-token='

export const LANE_NONCE = createHash('sha256').update(randomUUID()).digest('hex').slice(0, 16)

/** Spawn argv for a lane process: the caller's argv plus this run's identity. */
export function laneArgv(args: readonly string[]): string[] {
  return [...args, `${LANE_TOKEN_FLAG}${LANE_NONCE}`]
}

/** The lane fixtures at their SOURCE paths (a real leak shape, see below). */
export function sourceFixturePaths(): string[] {
  return ['a5lsp2-fixture-ping.mjs', 'a5lsp2-fixture-lang-server.mjs'].map((n) => fixturePath(n))
}

/** The NUL-delimited argv of a pid, or null when it is gone/unreadable. */
function argvOf(pid: number): string[] | null {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter((a) => a.length > 0)
  } catch {
    return null
  }
}

export type LaneProcess = { pid: number; cwd: string; cmd: string }

/**
 * Zero-residue sampling: every LIVE process this lane owns — its /proc cwd is
 * inside this world, or its argv carries this run's nonce. An empty array is
 * the zero-handle / zero-pid proof. The old rule also admitted any cmdline that
 * merely CONTAINED the fixture vocabulary, which census run 330 proved wrong:
 * the CI `FORENSIC` scene shows `foreign=[14668]` = a lint leg of the same job
 * (`node …/eslint/bin/eslint.js …`) being counted as a lane process.
 */
/** `PPid:` from `/proc/<pid>/status`, or 0 when unreadable. */
function ppidOf(pid: number): number {
  try {
    const m = /\nPPid:\s*(\d+)/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))
    return m === null ? 0 : Number(m[1])
  } catch {
    return 0
  }
}

/** Every pid whose ancestor chain reaches one of `roots` (bounded walk). */
function descendantClosure(all: readonly number[], roots: ReadonlySet<number>): Set<number> {
  const ppid = new Map<number, number>()
  for (const pid of all) ppid.set(pid, ppidOf(pid))
  const hit = new Set<number>()
  for (const pid of all) {
    let cur = pid
    for (let depth = 0; depth < 64; depth += 1) {
      const parent = ppid.get(cur) ?? 0
      if (parent <= 0 || roots.has(parent)) {
        if (parent > 0) hit.add(pid)
        break
      }
      cur = parent
      if (cur === pid) break
    }
  }
  return hit
}

/**
 * Zero-residue sampling: every LIVE process this lane owns, by three arms —
 *   (a) its /proc cwd is inside this world (read via `readlinkSync`; `readFileSync`
 *       throws EISDIR on that symlink, which is how this arm died silently for the
 *       whole life of the lane and left census 330 counting a stranger's eslint),
 *   (b) its argv carries this run's nonce (`laneArgv`),
 *   (c) its PPid chain reaches one of `roots` — the descendants of the processes
 *       this lane started. Arm (c) is what catches the escape the first two are
 *       blind to: an instance that spawns a helper of its own, with no nonce in
 *       that helper's argv and a cwd the lane never granted. A neighbour's linter
 *       is in no arm: no nonce, not our cwd, not our descendant.
 *
 * Disclosed limit of arm (c): it walks LIVE processes, so a descendant ORPHANED
 * by its parent's death (reparented to the namespace init) leaves the chain.
 * Teardown legs therefore snapshot the closure while the instances are alive
 * (`descendantsOf`) and require every pid in it to be gone.
 */
export function sampleLaneProcesses(worldRoot: string, roots: readonly number[] = []): LaneProcess[] {
  const found: LaneProcess[] = []
  let entries: string[]
  try {
    entries = readdirSync('/proc')
  } catch {
    return found
  }
  const seen: { pid: number; cwd: string; cmd: string }[] = []
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue
    const pid = Number(entry)
    const argv = argvOf(pid)
    if (argv === null) continue
    let cwd = ''
    try {
      cwd = readlinkSync(`/proc/${pid}/cwd`)
    } catch {
      // vanished, or outside our ownership: cwd stays empty and is never assumed to be ours
    }
    seen.push({ pid, cwd, cmd: argv.join(' ').slice(0, 200) })
  }
  const inherited = descendantClosure(seen.map((p) => p.pid), new Set(roots))
  for (const p of seen) {
    if (p.cmd.includes(LANE_NONCE) || p.cwd.startsWith(worldRoot) || inherited.has(p.pid)) found.push(p)
  }
  return found
}

/** The live descendant closure of `roots`, for snapshot-before-teardown assertions. */
export function descendantsOf(roots: readonly number[]): number[] {
  let entries: string[]
  try {
    entries = readdirSync('/proc')
  } catch {
    return []
  }
  const all = entries.filter((e) => /^\d+$/.test(e)).map(Number)
  return [...descendantClosure(all, new Set(roots))].sort((x, y) => x - y)
}

/**
 * The NAMED source-leak check, kept from the old vocabulary arm on purpose: the
 * arm was guarding a real shape — an instance started from the SOURCE fixture
 * instead of the world copy — and deleting it silently would have traded a true
 * alarm for a false one. It is now evaluated only over a set the lane can
 * attribute to itself (its output `sampleLaneProcesses`), never as a global
 * /proc sweep: every spawn site of this lane runs with `cwd` inside the world,
 * so a real source-fixture instance is in the set, while a neighbour's linter
 * or scanner can only ever be in it by also running inside our world. A process
 * carrying the nonce is ours by identity (this lane does start a fixture from
 * its source path in one leg), so it is reported by name, not as residue.
 */
export function sourceFixtureLeaksIn(procs: readonly LaneProcess[]): LaneProcess[] {
  const sources = sourceFixturePaths()
  return procs.filter((p) => !p.cmd.includes(LANE_NONCE) && sources.some((src) => p.cmd.includes(src)))
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
