/**
 * Shared harness for the A5-GLOB backend suites
 * (`alpha5-glob-backend.test.ts`, `alpha5-glob-backend-adversarial.test.ts`).
 *
 * It owns the FIXED fixture tree, the native-rg oracle invocation, and the
 * typed faces of the `.mjs` backend row (the row is plain JavaScript, so the
 * suite declares the structural types it is held to — the house pattern for
 * live `.mjs` rows, cf. `alpha5-g1-deny-lane.test.ts`).
 *
 * THE ORACLE IS DELIBERATELY HAND-WRITTEN: `nativeGlobArgv` spells the ripgrep
 * vector out longhand here instead of calling the host helper, so "team side
 * and native side agree" cannot be true by construction. A dedicated parity
 * row (`argv-equality`) is what ties this spelling to
 * `@deepseek-ai/dsh-tool-fs-search#buildGlobCommand`.
 *
 * Worlds are under `tests/homes/` (workspace constraint, TEST_METHODS §5/§7)
 * and self-remove.
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
export const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
export const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')

/**
 * START SWEEP of THIS lane's own name-matched leftovers (house precedent: the
 * `alpha5-glue7-backend` kit's own sweep @ 07580728 — a cancelled run's worlds
 * poison the next round's fixture hygiene). Age-guarded at 20 minutes ON
 * PURPOSE: two of this lane's suites run in one vitest pool, and a world
 * another file created seconds ago must never be swept out from under it.
 * Whatever was swept is returned, so the evidence names it instead of hiding it.
 */
/** How old a `<line>-<stamp>-<rand>` world name claims to be (null = unreadable). */
function worldAgeMs(name: string): number | null {
  const yearMs = 365 * 24 * 60 * 60 * 1000
  for (const segment of name.split('-')) {
    const at = Number.parseInt(segment, 36)
    if (!Number.isFinite(at)) continue
    const age = Date.now() - at
    if (age > -60_000 && age < yearMs) return age
  }
  return null
}

export function sweepStrayWorlds(prefix = 'a5glb-'): string[] {
  const swept: string[] = []
  const homes = join(REPO, 'tests/homes')
  let entries: string[] = []
  try {
    entries = readdirSync(homes).filter((name) => name.startsWith(prefix))
  } catch {
    return swept
  }
  for (const name of entries) {
    const dir = join(homes, name)
    // Age from the name's own base-36 timestamp (`<line>-<stamp>-<rand>`, the
    // §7 convention newWorld writes) rather than an mtime read: no extra
    // syscall, and it is the moment the world was created, not the last touch.
    // The stamp is found by PLAUSIBILITY, not position — `<line>` is
    // dash-bearing (`a5glb-adv-…`) and a line label parses as base 36 just
    // fine, which is exactly how a first draft of this swept a LIVE sibling's
    // world out from under it. Unrecognisable names are treated as LIVE.
    const ageMs = worldAgeMs(name)
    if (ageMs === null || ageMs < 20 * 60 * 1000) continue // live, or not ours to judge
    try {
      rmSync(dir, { recursive: true, force: true })
      swept.push(name)
    } catch {
      swept.push(`${name} (retained: removal failed)`) // reported, never silently ignored
    }
  }
  return swept
}

/** What this process swept at import time (evidence-facing; empty on a clean tree). */
export const START_SWEEP: readonly string[] = sweepStrayWorlds()

/** One fresh scratch world (TEST_METHODS §7 naming: `<line>-<stamp>`). */
export function newWorld(line: string): string {
  const dir = join(REPO, 'tests/homes', `${line}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

export function destroyWorld(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    /* best effort — a world is scratch, never state */
  }
}

/** The confined-provider entries the row needs (production launcher, byte-pinned). */
export function confinedConf(world: string): Record<string, unknown> {
  return {
    trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
    scratchRoot: join(world, 'scratch'),
    assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
  }
}

// ---------------------------------------------------------------------------
// the fixed fixture tree
// ---------------------------------------------------------------------------

/** `path → content` of every regular file the fixed tree carries. */
export const FIXTURE_FILES: Readonly<Record<string, string>> = Object.freeze({
  'src/a.ts': 'A5GLB-INSIDE-A\n',
  'src/index.ts': 'A5GLB-INSIDE-INDEX\n',
  'src/deep/b.ts': 'A5GLB-INSIDE-B\n',
  'src/deep/c.js': 'A5GLB-INSIDE-C\n',
  'README.md': 'A5GLB-README\n',
  'docs/guide.md': 'A5GLB-GUIDE\n',
  '.hidden.ts': 'A5GLB-HIDDEN\n',
  'dotdir/.secret.log': 'A5GLB-DOTDIR-SECRET\n',
  'node_modules/pkg/index.ts': 'A5GLB-DEPS\n',
  'ignored/drop.ts': 'A5GLB-IGNORED\n',
  'bin/tool': 'A5GLB-BIN\n',
  '.git/config': 'A5GLB-GITCONFIG\n',
  '.svn/entries': 'A5GLB-SVN\n',
  '.hg/store': 'A5GLB-HG\n',
  '.bzr/whatever': 'A5GLB-BZR\n',
  '.jj/state': 'A5GLB-JJ\n',
  '.sl/repo': 'A5GLB-SL\n',
})

/** Modification times that make `--sort=modified` deterministic (and one TIE pair). */
const FIXTURE_MTIMES: Readonly<Record<string, number>> = Object.freeze({
  'src/a.ts': 1_600_000_000,
  'src/index.ts': 1_610_000_000,
  'src/deep/b.ts': 1_620_000_000,
  'src/deep/c.js': 1_630_000_000,
  'README.md': 1_640_000_000,
  'docs/guide.md': 1_650_000_000,
  '.hidden.ts': 1_660_000_000,
  'dotdir/.secret.log': 1_670_000_000,
  'node_modules/pkg/index.ts': 1_680_000_000,
  'ignored/drop.ts': 1_690_000_000,
  'bin/tool': 1_700_000_000,
  '.git/config': 1_710_000_000,
  '.svn/entries': 1_720_000_000,
  '.hg/store': 1_730_000_000,
  '.bzr/whatever': 1_740_000_000,
  '.jj/state': 1_750_000_000,
  '.sl/repo': 1_760_000_000,
})

/** The `.gitignore` the fixed tree carries (honored by native rg WITHOUT `--no-ignore`). */
export const FIXTURE_GITIGNORE = 'ignored/\nnode_modules/\n'

/** Two files sharing one mtime — the TIE case of the sort-stability class (added only by that leg, so the fixed tree stays exact-order comparable). */
export const TIE_DIR = 'tie'
export const TIE_MTIME = 1_615_000_000

/** Build the fixed tree (deterministic content + deterministic mtimes). */
export function buildGlobFixture(root: string): void {
  writeFileSync(join(root, '.gitignore'), FIXTURE_GITIGNORE)
  utimesSync(join(root, '.gitignore'), 1_605_000_000, 1_605_000_000)
  for (const [rel, content] of Object.entries(FIXTURE_FILES)) {
    const target = join(root, rel)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
    const at = FIXTURE_MTIMES[rel] ?? 1_605_000_000
    utimesSync(target, at, at)
  }
}

/** Add the tie pair (two entries with an IDENTICAL mtime) — rg's tie order is unspecified. */
export function buildTiePair(root: string): string[] {
  const names = [`${TIE_DIR}/x-first.ts`, `${TIE_DIR}/y-second.ts`]
  mkdirSync(join(root, TIE_DIR), { recursive: true })
  for (const name of names) {
    writeFileSync(join(root, name), 'A5GLB-TIE\n')
    utimesSync(join(root, name), TIE_MTIME, TIE_MTIME)
  }
  return names
}

/** A second, isolated tree used only by the output-cap class (keeps the fixed tree fixed). */
export function buildCapFixture(root: string, count: number): string[] {
  const dir = join(root, 'many')
  mkdirSync(dir, { recursive: true })
  const names: string[] = []
  for (let i = 0; i < count; i++) {
    const name = `many/f${String(i).padStart(4, '0')}.ts`
    writeFileSync(join(root, name), 'X')
    const at = 1_500_000_000 + i
    utimesSync(join(root, name), at, at)
    names.push(name)
  }
  return names
}

// ---------------------------------------------------------------------------
// the native oracle
// ---------------------------------------------------------------------------

/** The six VCS stores the public argv excludes (spelled here, not imported). */
const NATIVE_VCS = ['.git', '.svn', '.hg', '.bzr', '.jj', '.sl'] as const

/**
 * The native `rg --files` vector, spelled longhand (see the header note).
 * `withIgnore`/`withVcsExcludes` toggle the flags so a class can show BOTH
 * what the governed argv does and what the default native invocation does.
 */
export function nativeGlobArgv(
  pattern: string,
  options: { readonly noIgnore?: boolean; readonly hidden?: boolean; readonly vcsExcludes?: boolean; readonly path?: string } = {},
): string[] {
  const argv = ['--files', `--glob=${pattern}`, '--sort=modified']
  if (options.noIgnore !== false) argv.push('--no-ignore')
  if (options.hidden !== false) argv.push('--hidden')
  if (options.vcsExcludes !== false) {
    for (const name of NATIVE_VCS) argv.push(`--glob=!**/${name}`, `--glob=!**/${name}/**`)
  }
  if (options.path !== undefined) argv.push('--', options.path)
  return argv
}

export interface NativeRun {
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
  readonly argv: readonly string[]
}

/** Run the packaged ripgrep natively in `cwd` (the oracle; never confined). */
export function nativeRg(rgPath: string, cwd: string, argv: readonly string[]): NativeRun {
  const r = spawnSync(rgPath, [...argv], { cwd, encoding: 'utf8', timeout: 60_000 })
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', argv }
}

/** Native stdout → the same root-relative spelling the backend returns. */
export function nativePaths(run: NativeRun): string[] {
  return run.stdout.split('\n').filter((l) => l.length > 0).map((l) => (l.startsWith('./') ? l.slice(2) : l))
}

// ---------------------------------------------------------------------------
// the .mjs backend row (structural types the suite holds it to)
// ---------------------------------------------------------------------------

export interface GlobBackendFailure {
  readonly class: 'denied' | 'hidden' | 'undetermined'
  readonly code: string
  readonly detail: string
}

export interface GlobOutcome {
  readonly outputMode: 'files_with_matches'
  readonly matches: readonly unknown[]
  readonly counts: readonly unknown[]
  readonly files: readonly string[]
  readonly totalMatches: number
  readonly truncated: boolean
}

export type GlobBackendResult =
  | { readonly ok: true; readonly outcome: GlobOutcome; readonly settlement: { readonly kind: string; readonly event?: string } }
  | { readonly ok: false; readonly failure: GlobBackendFailure }

export interface GlobBackend {
  readonly backendId: string
  run(call: { realmId: string; callId: string; parsedArgs: unknown }, io: { sink: { write(s: string): void } | null }): Promise<GlobBackendResult>
  execCount(): number
  readonly lastStageTrace: readonly string[]
  readonly lastRuns: readonly { callId: string; pid: number; exit: number | null; total: number; capped: boolean }[]
}

export interface AnchorOpenOk {
  readonly ok: true
  readonly handle: { fd: number; close(): Promise<void>; stat(o?: { bigint?: boolean }): Promise<{ dev: bigint | number; ino: bigint | number; isDirectory(): boolean }> }
  readonly rootReal: string
  readonly anchorPath: string
  readonly anchorReal: string
  readonly walkRel: string
  readonly identity: { dev: number; ino: number }
}

export type AnchorOpen = AnchorOpenOk | { readonly ok: false; readonly failure: GlobBackendFailure }

export interface GlobBackendRow {
  GLOB_BACKEND_ID: string
  GLOB_MAX_RESULTS_CEILING: number
  createAnchoredGlobBackend(o: Record<string, unknown>): GlobBackend
  openAnchoredWalkRoot(rootDir: string, target: unknown): Promise<AnchorOpen>
  verifyGlobResultsBeneath(anchor: AnchorOpenOk, entries: readonly string[]): Promise<{ ok: true; verified: number } | { ok: false; failure: GlobBackendFailure }>
  globArgv(parsed: { pattern: string }): string[]
  parseWalkOutput(stdout: string): string[]
}

/** Load the backend row (dynamic import, cast to the types above). */
export async function loadGlobBackendRow(): Promise<GlobBackendRow> {
  const url = new URL('../src/plugin/live/glob-backend.mjs', import.meta.url).href
  return (await import(url)) as unknown as GlobBackendRow
}

/** One parsed-args call as the a5p5 lane would hand it to a backend. */
export function globCall(callId: string, pattern: string, locator: string = '.', placement: string = 'workspace'): unknown {
  return { realmId: 'a5glb-realm', callId, parsedArgs: { tool: 'glob', pattern, target: { placement, locator } } }
}

/** Plant a symlink (used by the confinement + adversarial legs). */
export function plantSymlink(linkPath: string, target: string): void {
  mkdirSync(dirname(linkPath), { recursive: true })
  symlinkSync(target, linkPath, 'dir')
}
