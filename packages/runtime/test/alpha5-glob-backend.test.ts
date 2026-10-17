/**
 * A5-GLOB — the anchored confined-rg GLOB backend: RED-first face, rg PARITY
 * regression (plan `alpha5-s0-pr0-pr8-implementation-plan.md:132`: native vs
 * Team, structured value / meta / error / ignore / hidden / VCS / path /
 * overflow), the LIVE leg (the real rg process inside the confined provider),
 * and the typed-shape legs (illegal pattern / empty / over-cap truncated).
 *
 * RED FIRST (leg R1): the shipped plane row, unchanged, lands `team_glob` on
 * the typed shut face and this suite pins that text VERBATIM. Every G leg then
 * mounts the new backend through the plane's own existing
 * `input.backends.glob` seam — the row itself is never edited (integration is
 * the glue writer's; see `dev/agent-workflow/evidence/alpha5/glob-backend/README.md`).
 *
 * PARITY DISCIPLINE: the native side is invoked with the HAND-WRITTEN argv of
 * `alpha5-glob-harness.ts` (not the host helper), and leg P0 is the leg that
 * ties that spelling to the host's public `buildGlobCommand`. A parity match
 * therefore cannot be true by construction.
 *
 * Evidence: run with `A5GLB_EVIDENCE_DIR=<dir>` to also write
 * `parity-table.json` (byte-stable: no timestamps, no absolute paths).
 *
 * Worlds: `tests/homes/a5glb-*` (TEST_METHODS §5/§7), self-removed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildGlobCommand, GLOB_MAX_RESULTS, resolveRgPath } from '@deepseek-ai/dsh-tool-fs-search'
import { createConfinedProcessProvider } from '../sandbox-provider/index.js'
import {
  buildCapFixture,
  buildGlobFixture,
  buildTiePair,
  confinedConf,
  destroyWorld,
  globCall,
  LAUNCHER,
  LAUNCHER_SHA,
  loadGlobBackendRow,
  nativeGlobArgv,
  nativePaths,
  nativeRg,
  newWorld,
  REPO,
  START_SWEEP,
  sweepStrayWorlds,
  type GlobBackend,
  type GlobBackendRow,
  type GlobBackendResult,
  type NativeRun,
} from './alpha5-glob-harness.js'

const WORLD = newWorld('a5glb-unit')
const ROOT_DIR = join(WORLD, 'root')
const OUTSIDE_DIR = join(WORLD, 'outside')
const CAP_WORLD = newWorld('a5glb-cap')
const CAP_ROOT = join(CAP_WORLD, 'root')
/** The house face for the environment in this package's tests (no ambient node globals in .ts here). */
const ENV = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const EVIDENCE_DIR = ENV['A5GLB_EVIDENCE_DIR']

const OUTSIDE_TOKEN = 'A5GLB-OUTSIDE-SECRET-42'

let row: GlobBackendRow
let rgPath = ''
let backend: GlobBackend
const observed: string[] = []
const parityRows: ParityRow[] = []

interface ParityRow {
  readonly leg: string
  readonly pattern: string
  readonly target: string
  readonly nativeExit: number | null
  readonly nativeCount: number
  readonly teamCount: number
  readonly teamTotal: number
  readonly teamTruncated: boolean
  readonly teamFailure: string | null
  readonly orderMatch: boolean
  readonly note: string
}

function makeBackend(): GlobBackend {
  return row.createAnchoredGlobBackend({
    realmId: 'a5glb-realm',
    rootDir: ROOT_DIR,
    confined: confinedConf(WORLD),
    observe: (line: string) => observed.push(line),
  })
}

async function call(pattern: string, locator: string = '.', placement: string = 'workspace', sink: { write(s: string): void } | null = null): Promise<GlobBackendResult> {
  return await backend.run(globCall(`c-${String(parityRows.length)}-${pattern}`, pattern, locator, placement) as never, { sink })
}

/** The confined allow-set every measurement leg needs (system rx + the governed root, read-only). */
function confinedAllow(rootDir: string): { path: string; accessBits: Record<string, boolean> }[] {
  return [
    { path: '/bin', accessBits: { execute: true, readFile: true, readDir: true } },
    { path: '/usr', accessBits: { execute: true, readFile: true, readDir: true } },
    { path: '/lib', accessBits: { execute: true, readFile: true, readDir: true } },
    { path: rgPath.slice(0, rgPath.lastIndexOf('/')), accessBits: { execute: true, readFile: true, readDir: true } },
    { path: rootDir, accessBits: { readFile: true, readDir: true } },
  ]
}

/** One REAL confined child run through the provider's public face (measurement helper). */
async function confinedRun(tag: string, argv: readonly string[], cwd: string = ROOT_DIR): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const provider = createConfinedProcessProvider({
    realmId: tag, trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
    scratchRoot: join(WORLD, `scratch-${tag}`), assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
  })
  const probe = await provider.probe()
  expect(probe.ok, JSON.stringify(probe)).toBe(true)
  const r = await provider.spawnStreaming({
    grantFingerprint: tag, realmId: tag, bindingId: tag, memberScope: 'member',
    argv: [...argv], cwd, env: [['PATH', '/usr/bin:/bin']], allowPaths: confinedAllow(ROOT_DIR),
  })
  expect(r.ok, JSON.stringify(r)).toBe(true)
  if (r.ok !== true) return { stdout: '', stderr: '', code: null }
  let stdout = ''
  let stderr = ''
  r.value.stdout.on('data', (c: unknown) => { stdout += String(c) })
  r.value.stderr.on('data', (c: unknown) => { stderr += String(c) })
  const exit = await r.value.exited
  await r.value.terminate()
  return { stdout, stderr, code: exit.code }
}

function filesOf(result: GlobBackendResult): string[] {
  return result.ok === true ? [...result.outcome.files] : []
}

/** One parity leg: native oracle + Team backend, order-compared. */
async function parity(
  leg: string,
  pattern: string,
  options: { target?: string; placement?: string; locator?: string; nativeArgv?: string[]; cwd?: string; note?: string; expectTeamFailure?: string } = {},
): Promise<{ native: NativeRun; team: GlobBackendResult }> {
  const cwd = options.cwd ?? join(ROOT_DIR, options.target ?? '')
  const native = nativeRg(rgPath, cwd, options.nativeArgv ?? nativeGlobArgv(pattern))
  const team = await call(pattern, options.locator ?? '.', options.placement ?? 'workspace')
  const nativeList = nativePaths(native)
  const teamList = filesOf(team)
  const expectedFailure = options.expectTeamFailure ?? null
  const teamFailure = team.ok === true ? null : team.failure.code
  if (expectedFailure !== null) {
    expect(team.ok, `${leg}: expected the typed refusal ${expectedFailure}, got ${JSON.stringify(team).slice(0, 300)}`).toBe(false)
    expect(teamFailure).toBe(expectedFailure)
  } else {
    expect(team.ok, `${leg}: ${JSON.stringify(team).slice(0, 300)}`).toBe(true)
  }
  const orderMatch = expectedFailure !== null ? native.stdout.length === 0 : teamList.length === nativeList.length && teamList.every((p, i) => p === nativeList[i])
  parityRows.push({
    leg,
    pattern,
    target: options.target ?? '.',
    nativeExit: native.code,
    nativeCount: nativeList.length,
    teamCount: teamList.length,
    teamTotal: team.ok === true ? team.outcome.totalMatches : 0,
    teamTruncated: team.ok === true ? team.outcome.truncated : false,
    teamFailure,
    orderMatch,
    note: options.note ?? '',
  })
  return { native, team }
}

beforeAll(async () => {
  mkdirSync(ROOT_DIR, { recursive: true })
  mkdirSync(OUTSIDE_DIR, { recursive: true })
  writeFileSync(join(OUTSIDE_DIR, 'secret.txt'), `${OUTSIDE_TOKEN}\n`)
  writeFileSync(join(OUTSIDE_DIR, 'leak.ts'), `export const x = '${OUTSIDE_TOKEN}'\n`)
  buildGlobFixture(ROOT_DIR)
  mkdirSync(CAP_ROOT, { recursive: true })
  buildCapFixture(CAP_ROOT, GLOB_MAX_RESULTS + 5)
  row = await loadGlobBackendRow()
  rgPath = await resolveRgPath()
  backend = makeBackend()
}, 180_000)

afterAll(() => {
  // The evidence write must NEVER cost a world: fixture hygiene runs in the
  // finally, and the worlds being GONE is asserted (a leaked world is a defect
  // this lane polices itself — TEST_METHODS §7).
  try {
    if (EVIDENCE_DIR !== undefined && EVIDENCE_DIR.length > 0) {
      mkdirSync(EVIDENCE_DIR, { recursive: true })
      const body = {
        rgBinaryVersion: nativeRg(rgPath, ROOT_DIR, ['--version']).stdout.split('\n')[0] ?? 'unknown',
        rgBinaryPackage: '@vscode/ripgrep (packaged by @deepseek-ai/dsh-tool-fs-search)',
        globMaxResults: GLOB_MAX_RESULTS,
        backendId: row.GLOB_BACKEND_ID,
        launcherSha256: LAUNCHER_SHA,
        startSweepOfStaleWorlds: [...START_SWEEP],
        rows: parityRows,
        legs: { total: parityRows.length, matched: parityRows.filter((r) => r.orderMatch).length },
      }
      writeFileSync(join(EVIDENCE_DIR, 'parity-table.json'), `${JSON.stringify(body, null, 2)}\n`)
    }
  } finally {
    destroyWorld(WORLD)
    destroyWorld(CAP_WORLD)
    expect(existsSync(WORLD), `world leaked: ${WORLD}`).toBe(false)
    expect(existsSync(CAP_WORLD), `world leaked: ${CAP_WORLD}`).toBe(false)
  }
})

describe('A5-GLOB R — the gap as shipped (RED face, pinned verbatim; stays green forever)', () => {
  it('R1 team_glob on the UNCONFIGURED plane row lands on the typed shut face, verbatim', async () => {
    const plane = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
      createTeamToolPlaneAssembly: (i: Record<string, unknown>) => { ok: true; value: { definitions: ReadonlyArray<{ name: string; execute(a: unknown): Promise<{ text: string }> }> } } | { ok: false; code: string; message: string }
    }
    const built = plane.createTeamToolPlaneAssembly({
      permissionPolicy: { default: 'ask', allow: [{ tool: 'read', resource: { kind: 'any' } }], ask: [], deny: [] },
      realmId: 'a5glb-red-realm',
      templateId: 'a5glb-red-tpl',
      role: 'member',
      instanceId: 'a5glb-red-instance',
    })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    const def = built.value.definitions.find((d) => d.name === 'team_glob')
    expect(def, 'team_glob is on the plane vocabulary').toBeDefined()
    const res = await def?.execute({ pattern: '**/*.ts', path: '.' })
    const text = res?.text ?? ''
    // The SHUT ORIGINAL, verbatim — this is the gap this backend exists to close.
    expect(text).toContain('IO_POLICY_UNSUPPORTED')
    expect(text).toContain('the production effect-face adapter for this backend is the registered GLUE-4 follow-up (pb-CONTRACT §6)')
    expect(text).toContain('never faked')
    expect(text).not.toContain('src/a.ts')
  }, 120_000)

  it('R2 the lane\'s OWN fallback law is why the shut text answers: no globBackend = searchBackend (register.ts:118)', async () => {
    const registerSource = readFileSync(join(REPO, 'packages/tools/a5p5-tools/src/register.ts'), 'utf8')
    expect(registerSource).toContain('assembly.globBackend ?? assembly.searchBackend')
  })
})

describe('A5-GLOB P — rg PARITY (native oracle vs the confined Team walk)', () => {
  it('P0 the hand-written native argv IS the host public helper argv', () => {
    expect(nativeGlobArgv('**/*.ts')).toEqual(buildGlobCommand({ pattern: '**/*.ts' }))
    expect(nativeGlobArgv('a')).toEqual(buildGlobCommand({ pattern: 'a' }))
  })

  it('P1 basic pattern — same paths, SAME modification-time ORDER', async () => {
    const { native, team } = await parity('P1 basic', '**/*.ts')
    expect(filesOf(team).length).toBeGreaterThan(3)
    expect(filesOf(team)).toEqual(nativePaths(native))
    expect(native.code).toBe(0)
  })

  it('P2 hidden class — dotfiles are in on both sides, and the control legs show what --hidden changes natively', async () => {
    const { native, team } = await parity('P2 hidden', '**/*.ts')
    expect(nativePaths(native)).toContain('.hidden.ts')
    expect(filesOf(team)).toContain('.hidden.ts')
    const inside = await call('dotdir/**')
    expect(inside.ok).toBe(true)
    expect(filesOf(inside)).toContain('dotdir/.secret.log')
    // MEASURED control legs (rg 15.0.0): a positive --glob matches hidden
    // entries even WITHOUT --hidden; WITHOUT a positive glob, --hidden is what
    // lets a hidden subtree in at all. The governed argv carries both, so the
    // Team walk sees everything the native one does under the same argv.
    const noGlobNoHidden = nativeRg(rgPath, ROOT_DIR, ['--files', '--sort=modified', '--no-ignore'])
    expect(nativePaths(noGlobNoHidden)).not.toContain('.hidden.ts')
    const noGlobHidden = nativeRg(rgPath, ROOT_DIR, ['--files', '--sort=modified', '--no-ignore', '--hidden'])
    expect(nativePaths(noGlobHidden)).toContain('.hidden.ts')
    parityRows.push({
      leg: 'P2b hidden control', pattern: '(no --glob)', target: '.', nativeExit: noGlobHidden.code,
      nativeCount: nativePaths(noGlobHidden).length, teamCount: 0, teamTotal: 0, teamTruncated: false, teamFailure: null,
      orderMatch: nativePaths(noGlobNoHidden).length < nativePaths(noGlobHidden).length,
      note: 'without a positive glob, --hidden is what admits hidden entries (rg 15.0.0 measured)',
    })
  })

  it('P3 ignore class — the governed argv is --no-ignore (gitignore does NOT hide), control leg proves the flag bites', async () => {
    const { native, team } = await parity('P3 ignore', '**/*.ts')
    expect(nativePaths(native)).toContain('ignored/drop.ts')
    expect(filesOf(team)).toContain('ignored/drop.ts')
    const honoring = nativeRg(rgPath, ROOT_DIR, nativeGlobArgv('**/*.ts', { noIgnore: false }))
    expect(nativePaths(honoring)).not.toContain('ignored/drop.ts')
    expect(nativePaths(honoring)).not.toContain('node_modules/pkg/index.ts')
  })

  it('P4 VCS class — every GLOB_VCS_EXCLUDES store is out on BOTH sides, and the bare walk would have listed it', async () => {
    const { native, team } = await parity('P4 VCS', '**/*')
    for (const store of ['.git/config', '.svn/entries', '.hg/store', '.bzr/whatever', '.jj/state', '.sl/repo']) {
      expect(nativePaths(native), `native leaked ${store}`).not.toContain(store)
      expect(filesOf(team), `team leaked ${store}`).not.toContain(store)
    }
    const bare = nativeRg(rgPath, ROOT_DIR, nativeGlobArgv('**/*', { vcsExcludes: false }))
    expect(nativePaths(bare)).toContain('.git/config') // the negations are what prune it
  })

  it('P5 subtree target — a subdirectory walk is presented root-relative and matches the native subtree walk', async () => {
    const native = nativeRg(rgPath, join(ROOT_DIR, 'src'), nativeGlobArgv('**/*.ts'))
    const team = await call('**/*.ts', 'src')
    expect(team.ok, JSON.stringify(team)).toBe(true)
    const teamList = filesOf(team)
    const nativeList = nativePaths(native).map((p) => `src/${p}`)
    parityRows.push({
      leg: 'P5 subtree', pattern: '**/*.ts', target: 'src', nativeExit: native.code, nativeCount: nativeList.length,
      teamCount: teamList.length, teamTotal: team.ok === true ? team.outcome.totalMatches : 0, teamTruncated: false,
      teamFailure: null, orderMatch: teamList.length === nativeList.length && teamList.every((p, i) => p === nativeList[i]), note: 'root-relative presentation',
    })
    expect(teamList).toEqual(nativeList)
  })

  it('P6 absolute target inside the root — same walk, same order', async () => {
    const native = nativeRg(rgPath, join(ROOT_DIR, 'src/deep'), nativeGlobArgv('*.js'))
    const team = await call('*.js', join(ROOT_DIR, 'src/deep'), 'absolute-path')
    expect(team.ok, JSON.stringify(team)).toBe(true)
    const teamList = filesOf(team)
    const nativeList = nativePaths(native).map((p) => `src/deep/${p}`)
    parityRows.push({
      leg: 'P6 absolute', pattern: '*.js', target: '<root>/src/deep', nativeExit: native.code, nativeCount: nativeList.length,
      teamCount: teamList.length, teamTotal: team.ok === true ? team.outcome.totalMatches : 0, teamTruncated: false,
      teamFailure: null, orderMatch: teamList.length === nativeList.length && teamList.every((p, i) => p === nativeList[i]), note: 'absolute-path placement, root-relative presentation',
    })
    expect(teamList).toEqual(nativeList)
  })

  it('P7 sort stability — distinct mtimes order identically, and a repeated walk re-orders nothing', async () => {
    const { native, team } = await parity('P7 sort (distinct)', '**/*.ts')
    const expected = nativePaths(native)
    expect(filesOf(team)).toEqual(expected)
    const again = await call('**/*.ts')
    expect(filesOf(again)).toEqual(filesOf(team))
    const third = await call('**/*.ts')
    expect(filesOf(third)).toEqual(filesOf(team))
    // the order really is modification-time order, not name order
    const nameSorted = [...expected].sort()
    expect(expected).not.toEqual(nameSorted)
  })

  it('P7b tie stability — equal mtimes: both sides report the SAME set, and the Team order never moves between runs', async () => {
    const names = buildTiePair(ROOT_DIR)
    const native = nativeRg(rgPath, join(ROOT_DIR, 'tie'), nativeGlobArgv('*.ts'))
    expect(native.code).toBe(0)
    expect(nativePaths(native).slice().sort()).toEqual(['x-first.ts', 'y-second.ts'])
    const first = filesOf(await call('*.ts', 'tie'))
    const second = filesOf(await call('*.ts', 'tie'))
    expect(first.slice().sort()).toEqual(names.map((n) => n.slice('tie/'.length)).sort().map((n) => `tie/${n}`))
    expect(second).toEqual(first) // rg's tie order is unspecified; OURS never moves inside one world
    parityRows.push({
      leg: 'P7b sort (tie)', pattern: '*.ts', target: 'tie', nativeExit: native.code, nativeCount: nativePaths(native).length,
      teamCount: first.length, teamTotal: first.length, teamTruncated: false, teamFailure: null,
      orderMatch: true, note: 'identical mtimes: set-parity + Team-side order stability across runs',
    })
  })

  it('P8 empty result — the typed empty shape, and native exit 1 is NOT an error', async () => {
    const { native, team } = await parity('P8 empty', '**/*.nope', { note: 'native exit 1 = no matches (not an error)' })
    expect(native.code).toBe(1)
    expect(team.ok).toBe(true)
    if (team.ok !== true) return
    expect(team.outcome.files).toEqual([])
    expect(team.outcome.totalMatches).toBe(0)
    expect(team.outcome.truncated).toBe(false)
  })

  it('P9 illegal pattern — TYPED failure carrying the walker\'s own words, never an empty list', async () => {
    const bad = '**/[a-'
    const native = nativeRg(rgPath, ROOT_DIR, nativeGlobArgv(bad))
    expect(native.code).toBe(2)
    const team = await call(bad)
    expect(team.ok).toBe(false)
    const code = team.ok === true ? null : team.failure.code
    const detail = team.ok === true ? '' : team.failure.detail
    expect(team.ok === false && team.failure.class === 'undetermined').toBe(true)
    expect(code).toMatch(/^rg-exit-|^rg-walker-error$|^rg-exit-unobserved$/)
    expect(detail).toContain('error parsing glob')
    parityRows.push({
      leg: 'P9 illegal pattern', pattern: bad, target: '.', nativeExit: native.code, nativeCount: 0, teamCount: 0,
      teamTotal: 0, teamTruncated: false, teamFailure: code, orderMatch: true, note: 'typed walker error',
    })
  })

  it('P10 over-cap — GLOB_MAX_RESULTS inline, totalMatches = the FULL native count, truncated honest', async () => {
    const capBackend = row.createAnchoredGlobBackend({
      realmId: 'a5glb-cap-realm', rootDir: CAP_ROOT, confined: confinedConf(CAP_WORLD),
    })
    const native = nativeRg(rgPath, CAP_ROOT, nativeGlobArgv('many/*.ts'))
    const nativeList = nativePaths(native)
    expect(nativeList.length).toBe(GLOB_MAX_RESULTS + 5)
    const capped = await capBackend.run(globCall('cap-1', 'many/*.ts') as never, { sink: null })
    expect(capped.ok).toBe(true)
    if (capped.ok !== true) return
    expect(capped.outcome.files.length).toBe(GLOB_MAX_RESULTS)
    expect(capped.outcome.files).toEqual(nativeList.slice(0, GLOB_MAX_RESULTS))
    expect(capped.outcome.totalMatches).toBe(nativeList.length)
    expect(capped.outcome.truncated).toBe(true)
    // and the ceiling is a WIDENING an assembly may choose, with the full list matching native
    const wide = row.createAnchoredGlobBackend({
      realmId: 'a5glb-cap-realm-2', rootDir: CAP_ROOT, confined: confinedConf(CAP_WORLD), maxResults: nativeList.length,
    })
    const unwounded = await wide.run(globCall('cap-2', 'many/*.ts') as never, { sink: null })
    expect(unwounded.ok).toBe(true)
    if (unwounded.ok !== true) return
    expect([...unwounded.outcome.files]).toEqual(nativeList)
    expect(unwounded.outcome.truncated).toBe(false)
    parityRows.push({
      leg: 'P10 cap', pattern: 'many/*.ts', target: '.', nativeExit: native.code, nativeCount: nativeList.length,
      teamCount: capped.outcome.files.length, teamTotal: capped.outcome.totalMatches, teamTruncated: true,
      teamFailure: null, orderMatch: true, note: `inline cap ${String(GLOB_MAX_RESULTS)}; full list matches native at the ceiling`,
    })
  }, 180_000)

  it('P11 spill bytes == walk bytes — the io.sink saw exactly the native stdout', async () => {
    const chunks: string[] = []
    const result = await call('**/*.md', '.', 'workspace', { write: (s: string) => chunks.push(s) })
    expect(result.ok).toBe(true)
    const native = nativeRg(rgPath, ROOT_DIR, nativeGlobArgv('**/*.md'))
    expect(chunks.join('')).toBe(native.stdout)
    parityRows.push({
      leg: 'P11 sink bytes', pattern: '**/*.md', target: '.', nativeExit: native.code, nativeCount: nativePaths(native).length,
      teamCount: filesOf(result).length, teamTotal: result.ok === true ? result.outcome.totalMatches : 0, teamTruncated: false,
      teamFailure: null, orderMatch: true, note: 'sink bytes == native stdout (spill attribution is the plane\'s)',
    })
  })
})

describe('A5-GLOB L — the LIVE leg: the real rg process inside the confined provider', () => {
  it('L1 the capability probe is ENFORCED (kernel), not advisory', async () => {
    const provider = createConfinedProcessProvider({
      realmId: 'a5glb-live-realm', trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      scratchRoot: join(WORLD, 'scratch-live'),
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    })
    const probe = await provider.probe()
    expect(probe.ok, JSON.stringify(probe)).toBe(true)
    if (probe.ok !== true) return
    const levels = probe.value.map((r: { dimension: string; level: string }) => `${r.dimension}=${r.level}`)
    expect(levels.some((l: string) => l.includes('content-read=enforced'))).toBe(true)
    parityRows.push({
      leg: 'L1 confine probe', pattern: '-', target: '-', nativeExit: null, nativeCount: probe.value.length, teamCount: probe.value.length,
      teamTotal: probe.value.length, teamTruncated: false, teamFailure: null, orderMatch: true, note: levels.join(','),
    })
  }, 120_000)

  it('L2 the walk really ran confined: a real pid, a real rg, real bytes, execCount moved', async () => {
    const before = backend.execCount()
    const result = await call('src/**/*.ts')
    expect(result.ok).toBe(true)
    const run = backend.lastRuns.at(-1)
    expect(run).toBeDefined()
    expect(backend.execCount()).toBe(before + 1)
    expect(run?.pid).toBeGreaterThan(1)
    expect(run?.exit).toBe(0)
    expect(filesOf(result).length).toBeGreaterThan(1)
    expect(backend.lastStageTrace).toEqual(['probe', 'prepare', 'execute', 'terminate'])
  }, 120_000)

  it('L3 MEASURED confine scope: CONTENT is kernel-denied outside the root, NAMES are not — which is why the row carries its own result law', async () => {
    // Measured on this host (Landlock ABI v4, evidence/alpha5/glob-backend):
    //   read outside content  -> EACCES inside the child  (enforced)
    //   LIST an outside dir    -> succeeds                (NOT enforced by the sandbox)
    // So "the confine is the backstop" only covers BYTES. Path-NAME disclosure
    // is the row's own job — legs A4/S1 of the adversarial suite — and this leg
    // pins both halves of that fact, so nobody later reads the backstop as
    // broader than it is.
    const outsideContent = await confinedRun('a5glb-content', ['/bin/cat', join(OUTSIDE_DIR, 'secret.txt')])
    expect(outsideContent.stdout).not.toContain(OUTSIDE_TOKEN)
    expect(outsideContent.stderr).toContain('Permission denied')
    const outsideListing = await confinedRun('a5glb-listing', ['/bin/ls', OUTSIDE_DIR])
    expect(outsideListing.stdout).toContain('secret.txt') // measured: the sandbox does not gate directory enumeration
    parityRows.push({
      leg: 'L3 confine scope (measured)', pattern: '-', target: '<world>/outside', nativeExit: null, nativeCount: 1, teamCount: 1,
      teamTotal: 2, teamTruncated: false, teamFailure: null, orderMatch: true,
      note: 'content=EACCES (enforced); directory listing=succeeds (not enforced) -> result-side anchor law is load-bearing',
    })
  }, 180_000)

  it('L3b a `/proc/self/fd/N` cwd is NOT a usable walk root through the confined spawn (measured empty)', async () => {
    // This row passes the anchored PATH as the child cwd. The alternative —
    // handing the child the verified directory fd's magic link — was measured:
    // the confined child enumerates NOTHING from it (exit 0, zero rows, zero
    // stderr). A silently-empty answer is worse than a refused one, so the row
    // never does that; containment of the ANSWER is A4's job instead.
    const { open, constants } = await import('node:fs/promises')
    const realmId = 'a5glb-fdcwd'
    const provider = createConfinedProcessProvider({
      realmId, trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      scratchRoot: join(WORLD, 'scratch-fdcwd'), assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    })
    expect((await provider.probe()).ok).toBe(true)
    const handle = await open(ROOT_DIR, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
    const r = await provider.spawnStreaming({
      grantFingerprint: 'a5glb-fdcwd', realmId, bindingId: 'a5glb-fdcwd', memberScope: 'member',
      argv: [rgPath, ...nativeGlobArgv('**/*.ts')], cwd: `/proc/self/fd/${String(handle.fd)}`,
      env: [['PATH', '/usr/bin:/bin']], allowPaths: confinedAllow(ROOT_DIR),
    })
    expect(r.ok, JSON.stringify(r)).toBe(true)
    if (r.ok !== true) { await handle.close(); return }
    let out = ''
    r.value.stdout.on('data', (c: unknown) => { out += String(c) })
    await r.value.exited
    await r.value.terminate()
    await handle.close()
    const viaPath = await confinedRun('a5glb-fdcwd-control', [rgPath, ...nativeGlobArgv('**/*.ts')], ROOT_DIR)
    expect(out).toBe('') // the fd-cwd walk produced nothing
    expect(viaPath.stdout).toContain('src/a.ts') // the same argv from the PATH cwd walks fine
    const viaPathRun: NativeRun = { argv: [...nativeGlobArgv('**/*.ts')], stdout: viaPath.stdout, stderr: viaPath.stderr, code: viaPath.code }
    parityRows.push({
      leg: 'L3b fd-cwd face (measured)', pattern: '**/*.ts', target: '/proc/self/fd/N', nativeExit: 0, nativeCount: nativePaths(viaPathRun).length,
      teamCount: 0, teamTotal: 0, teamTruncated: false, teamFailure: null, orderMatch: false,
      note: 'fd-magic-link cwd walks EMPTY through the confined spawn — the row uses the anchored path + A4 instead',
    })
  }, 180_000)

  it('L4 the backend mounts through the plane\'s OWN backends seam (no plane edit)', async () => {
    const plane = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
      createTeamToolPlaneAssembly: (i: Record<string, unknown>) => { ok: true; value: { definitions: ReadonlyArray<{ name: string; execute(a: unknown): Promise<{ text: string }> }> } } | { ok: false; code: string; message: string }
    }
    const built = plane.createTeamToolPlaneAssembly({
      permissionPolicy: { default: 'ask', allow: [{ tool: 'read', resource: { kind: 'any' } }], ask: [], deny: [] },
      realmId: 'a5glb-realm',
      templateId: 'a5glb-tpl',
      role: 'member',
      instanceId: 'a5glb-instance',
      backends: { glob: makeBackend() },
    })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    const res = await built.value.definitions.find((d) => d.name === 'team_glob')?.execute({ pattern: 'src/**/*.ts', path: '.' })
    expect(res?.text).toContain('src/a.ts')
    expect(res?.text).not.toContain('IO_POLICY_UNSUPPORTED')
  }, 180_000)
})

describe('A5-GLOB H — fixture hygiene (a lane that litters worlds poisons the next round)', () => {
  it('H1 the start sweep removes THIS lane\'s stale worlds and never a live one', () => {
    // A first draft of the sweep judged age by the wrong name segment and swept
    // a LIVE sibling's world; that is now a pinned law, not a lesson.
    const staleName = `a5glb-swept-${(Date.now() - 60 * 60 * 1000).toString(36)}-dead00`
    const liveName = `a5glb-swept-${Date.now().toString(36)}-live00`
    const homesRoot = join(REPO, 'tests/homes')
    const stale = join(homesRoot, staleName)
    const live = join(homesRoot, liveName)
    mkdirSync(stale, { recursive: true })
    mkdirSync(live, { recursive: true })
    const swept = sweepStrayWorlds('a5glb-swept-')
    expect(swept).toContain(staleName)
    expect(existsSync(stale)).toBe(false)
    expect(existsSync(live), 'a fresh world — possibly a sibling suite\'s — must survive the sweep').toBe(true)
    rmSync(live, { recursive: true, force: true })
    expect(sweepStrayWorlds('a5glb-nothing-here-')).toEqual([])
  })
})

describe('A5-GLOB C — typed refusals BEFORE the child exists (execCount never moves)', () => {
  async function refused(code: string, pattern: string, locator: string, placement: string = 'workspace'): Promise<void> {
    const before = backend.execCount()
    const result = await call(pattern, locator, placement)
    expect(result.ok, JSON.stringify(result)).toBe(false)
    if (result.ok !== true) expect(result.failure.code).toBe(code)
    expect(backend.execCount()).toBe(before)
  }

  it('C1 a `..` target is refused (lexically, before any open)', async () => {
    await refused('target-outside-governed-root', '**/*', '../outside')
  })

  it('C2 an absolute target outside the root is refused', async () => {
    await refused('target-outside-governed-root', '**/*', OUTSIDE_DIR, 'absolute-path')
  })

  it('C3 a symlinked LAST component escaping the root is refused (open-time ELOOP / exec-time escape)', async () => {
    symlinkSync(OUTSIDE_DIR, join(ROOT_DIR, 'exit-link'), 'dir')
    await refused('symlink-alias', '**/*', 'exit-link')
    const result = await call('**/*', 'exit-link')
    expect(result.ok === false && result.failure.detail).toBeTruthy()
    rmSync(join(ROOT_DIR, 'exit-link'), { force: true })
  })

  it('C4 a symlinked MIDDLE component escaping the root is refused', async () => {
    mkdirSync(join(ROOT_DIR, 'chain'), { recursive: true })
    symlinkSync(OUTSIDE_DIR, join(ROOT_DIR, 'chain', 'hop'), 'dir')
    await refused('symlink-alias', '**/*', 'chain/hop')
    rmSync(join(ROOT_DIR, 'chain'), { recursive: true, force: true })
  })

  it('C5 the wrong tool on this backend is a named refusal', async () => {
    const before = backend.execCount()
    const result = await backend.run({ realmId: 'a5glb-realm', callId: 'wrong', parsedArgs: { tool: 'grep', pattern: 'x', target: { placement: 'workspace', locator: '.' } } } as never, { sink: null })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.failure.code).toBe('wrong-tool-for-backend')
    expect(backend.execCount()).toBe(before)
  })

  it('C6 an empty pattern is refused by the host public argument law', async () => {
    const before = backend.execCount()
    const result = await call('   ')
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.failure.code).toBe('pattern-invalid')
    expect(backend.execCount()).toBe(before)
  })

  it('C7 a missing target is typed, never an empty success', async () => {
    await refused('target-unresolvable', '**/*', 'no-such-dir')
  })

  it('C8 a target that is a FILE is typed, not walked', async () => {
    const result = await call('**/*', 'src/a.ts')
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.failure.code).toBe('not-a-directory')
  })

  it('C9 every refusal class this row can emit is inside the CLOSED triad', async () => {
    const classes = new Set<string>()
    for (const [locator, placement] of [['../outside', 'workspace'], [OUTSIDE_DIR, 'absolute-path'], ['no-such', 'workspace']] as const) {
      const r = await call('**/*', locator, placement)
      if (r.ok === false) classes.add(r.failure.class)
    }
    for (const cls of classes) expect(['denied', 'hidden', 'undetermined']).toContain(cls)
  })
})

describe('A5-GLOB S — the walk never answers with what the governed root does not contain', () => {
  it('S1 an escaping symlink inside the tree is neither followed nor listed (native parity), and A4 has teeth of its own', async () => {
    const toFile = join(ROOT_DIR, 'docs', 'out-link.ts')
    const toDir = join(ROOT_DIR, 'docs', 'out-dir')
    symlinkSync(join(OUTSIDE_DIR, 'leak.ts'), toFile, 'file')
    symlinkSync(OUTSIDE_DIR, toDir, 'dir')
    const native = nativeRg(rgPath, ROOT_DIR, nativeGlobArgv('**/*.ts'))
    const result = await call('**/*.ts')
    expect(result.ok, JSON.stringify(result)).toBe(true)
    const teamList = filesOf(result)
    // rg neither follows nor lists those entries; the Team walk answers the SAME set.
    expect(nativePaths(native)).not.toContain('docs/out-link.ts')
    expect(teamList).toEqual(nativePaths(native))
    expect(teamList.join('\n')).not.toContain(OUTSIDE_TOKEN)
    expect(JSON.stringify(result)).not.toContain(OUTSIDE_TOKEN)
    // A4's own teeth: a hostile ENTRY LIST — what a swapped tree or a walker
    // that did follow a link would hand the verifier — is refused outright.
    const anchor = await row.openAnchoredWalkRoot(ROOT_DIR, { placement: 'workspace', locator: '.' })
    expect(anchor.ok).toBe(true)
    if (anchor.ok !== true) return
    try {
      for (const hostile of ['docs/out-link.ts', 'docs/out-dir/leak.ts', '../outside/secret.txt', '/etc/passwd']) {
        const verdict = await row.verifyGlobResultsBeneath(anchor, [hostile])
        expect(verdict.ok, `A4 accepted ${hostile}`).toBe(false)
        if (verdict.ok !== true) expect(['walk-contaminated', 'walk-unverifiable']).toContain(verdict.failure.code)
      }
      const clean = await row.verifyGlobResultsBeneath(anchor, ['src/a.ts', 'docs/guide.md'])
      expect(clean.ok).toBe(true)
    } finally {
      await anchor.handle.close()
    }
    rmSync(toFile, { force: true })
    rmSync(toDir, { force: true })
    parityRows.push({
      leg: 'S1 escaping symlink', pattern: '**/*.ts', target: '.', nativeExit: native.code, nativeCount: nativePaths(native).length,
      teamCount: teamList.length, teamTotal: result.ok === true ? result.outcome.totalMatches : 0, teamTruncated: false, teamFailure: null,
      orderMatch: true, note: 'rg neither follows nor lists it (parity); A4 separately refuses hostile entries incl. ../ and absolute',
    })
  })

  it('S2 a pattern naming OUTSIDE the root is a typed empty walk, never a leak', async () => {
    const result = await call('../../../outside/**')
    expect(result.ok).toBe(true)
    if (result.ok !== true) return
    expect(result.outcome.files).toEqual([])
    expect(JSON.stringify(result)).not.toContain(OUTSIDE_TOKEN)
  })

  it('S3 a filename carrying a newline ends TYPED (the protocol cannot be parsed safely)', async () => {
    const weird = join(ROOT_DIR, 'docs', `weird\nname.ts`)
    writeFileSync(weird, 'A5GLB-NEWLINE\n')
    utimesSync(weird, 1_655_000_000, 1_655_000_000)
    const result = await call('docs/**')
    expect(result.ok).toBe(false)
    if (result.ok !== true) {
      expect(['walk-unverifiable', 'walk-contaminated']).toContain(result.failure.code)
    }
    rmSync(weird, { force: true })
    const clean = await call('docs/**')
    expect(clean.ok).toBe(true)
  })
})
