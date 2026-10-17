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
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildGlobCommand, GLOB_MAX_RESULTS, resolveRgPath } from '@deepseek-ai/dsh-tool-fs-search'
import { createConfinedProcessProvider } from '../sandbox-provider/index.js'
import {
  buildCapFixture,
  buildGlobFixture,
  buildTiePair,
  confinedConf,
  destroyWorldVerified,
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

afterAll(async () => {
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
    // Idempotent + re-verified (see `destroyWorldVerified`): a late provider
    // scratch write re-creates the world right after removal, which used to make
    // the single-shot check pass while leaving the tree behind.
    let reappeared = await destroyWorldVerified(WORLD)
    reappeared += await destroyWorldVerified(CAP_WORLD)
    expect(existsSync(WORLD), `world leaked: ${WORLD}`).toBe(false)
    expect(existsSync(CAP_WORLD), `world leaked: ${CAP_WORLD}`).toBe(false)
    if (reappeared > 0) {
      (globalThis as { process?: { stdout?: { write(v: string): void } } }).process?.stdout?.write(`a5glb teardown: the provider re-created a world ${String(reappeared)}x after removal; cleanup repeated\n`)
    }
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
  it('P0 the native argv IS the host public helper argv, plus the row\'s ONE framing token', () => {
    // The parity oracle must be the host's own selection argv, byte for byte.
    expect(nativeGlobArgv('**/*.ts', { nul: false })).toEqual(buildGlobCommand({ pattern: '**/*.ts' }))
    expect(nativeGlobArgv('a', { nul: false })).toEqual(buildGlobCommand({ pattern: 'a' }))
    // and the row's deviation from it is EXACTLY the NUL framing token (A5).
    const rowArgv = row.globArgv({ pattern: '**/*.ts' })
    expect(rowArgv).toEqual(buildGlobCommand({ pattern: '**/*.ts' }))
    expect([...rowArgv, ...row.GLOB_OUTPUT_PROTOCOL_ARGV]).toEqual(nativeGlobArgv('**/*.ts'))
    expect(row.GLOB_OUTPUT_PROTOCOL_ARGV).toEqual(['--null'])
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
    // Under the NUL framing law the byte law is stated exactly as before: the
    // spill channel carries the walker's OWN bytes for an admitted walk. What
    // changed (fix-list ①) is WHEN they may be written: after the verdict.
    expect(chunks.join('')).toBe(native.stdout)
    parityRows.push({
      leg: 'P11 sink bytes', pattern: '**/*.md', target: '.', nativeExit: native.code, nativeCount: nativePaths(native).length,
      teamCount: filesOf(result).length, teamTotal: result.ok === true ? result.outcome.totalMatches : 0, teamTruncated: false,
      teamFailure: null, orderMatch: true, note: 'sink bytes == native stdout (spill attribution is the plane\'s)',
    })
  })
})

describe('A5-GLOB N — the OUTPUT FRAMING law (NUL, not newline) and the single-producer law', () => {
  it('N1 a newline in a filename is ONE object now — the single-segment forgery is dead', async () => {
    // The forgery, spelled exactly as it can exist: '/' cannot appear in a
    // filename, so ONE object can only forge records inside its own directory.
    // An object named `plain.ts\nhidden-adjacent.ts` is one file, and under
    // NEWLINE framing it emits two records — `plain.ts` and
    // `hidden-adjacent.ts` — BOTH of which are real files here, so a per-entry
    // "is this real?" law waves them through: the walk then reports a phantom
    // duplicate of a file the object is not, and the object's own name never
    // appears. NUL framing cannot be forged because NUL cannot exist in a name.
    const forgedName = 'plain.ts\nhidden-adjacent.ts'
    const forgedAbs = join(ROOT_DIR, forgedName)
    // the two halves must be REAL files for the forgery to pass a "does it
    // exist?" check — that is what makes this class dangerous rather than noisy
    writeFileSync(join(ROOT_DIR, 'plain.ts'), 'A5GLB-PLAIN\n')
    utimesSync(join(ROOT_DIR, 'plain.ts'), 1_657_000_100, 1_657_000_100)
    writeFileSync(join(ROOT_DIR, 'hidden-adjacent.ts'), 'A5GLB-ADJACENT\n')
    utimesSync(join(ROOT_DIR, 'hidden-adjacent.ts'), 1_657_000_200, 1_657_000_200)
    writeFileSync(forgedAbs, 'A5GLB-FORGED-NAME\n')
    utimesSync(forgedAbs, 1_658_000_000, 1_658_000_000)
    const nulArgv = nativeGlobArgv('*.ts')
    const native = nativeRg(rgPath, ROOT_DIR, nulArgv)
    const lineFramed = nativeRg(rgPath, ROOT_DIR, nativeGlobArgv('*.ts', { nul: false }))
    const team = await call('*.ts')
    expect(team.ok, JSON.stringify(team)).toBe(true)
    const listed = filesOf(team)

    // (1) the counterfactual: newline framing FORGES. Two real objects become
    // three records, the true name disappears, and a name is reported twice.
    const asRecords = nativePaths(lineFramed)
    expect(asRecords.filter((p) => p === 'plain.ts')).toHaveLength(2) // the real one + the forged one
    expect(asRecords).toContain('hidden-adjacent.ts')
    expect(asRecords).not.toContain(forgedName) // the object's own name vanishes
    // one object on disk became TWO records: the framed count is one short of
    // the newline count, and the difference is exactly the forged half
    expect(asRecords.length).toBe(nativePaths(native).length + 1)

    // (2) the row: one object, one record, true name, byte-equal to the native
    // NUL walk — and no phantom duplicate anywhere.
    expect(listed).toContain(forgedName)
    expect(listed.filter((p) => p === forgedName)).toHaveLength(1)
    expect(listed).toEqual(nativePaths(native))
    expect(new Set(listed).size).toBe(listed.length)
    expect(listed.filter((p) => p === 'plain.ts')).toHaveLength(1) // the REAL file, once
    expect(listed.length).toBe(nativePaths(native).length) // one record per object
    expect(JSON.stringify(team)).not.toContain('forged-by-split')
    rmSync(forgedAbs, { force: true })
    rmSync(join(ROOT_DIR, 'plain.ts'), { force: true })
    rmSync(join(ROOT_DIR, 'hidden-adjacent.ts'), { force: true })
    parityRows.push({
      leg: 'N1 newline forgery', pattern: '*.ts', target: '.', nativeExit: native.code, nativeCount: nativePaths(native).length,
      teamCount: listed.length, teamTotal: team.ok === true ? team.outcome.totalMatches : 0, teamTruncated: false, teamFailure: null,
      orderMatch: true, note: `NUL framing: one object one record; newline framing on the SAME bytes emits ${String(asRecords.length)} records and loses the true name`,
    })
  })

  it('N2 the protocol break is typed, and the parse is injective on the delimiter that cannot occur', () => {
    const good = row.parseWalkOutput('src/a.ts\0docs/guide.md\0')
    expect(good.ok).toBe(true)
    if (good.ok !== true) return
    expect(good.entries).toEqual(['src/a.ts', 'docs/guide.md'])
    const newlineName = row.parseWalkOutput('README.md\ndocs/guide.md\0')
    expect(newlineName.ok).toBe(true)
    if (newlineName.ok !== true) return
    expect(newlineName.entries).toEqual(['README.md\ndocs/guide.md']) // ONE record
    const midBreak = row.parseWalkOutput('src/a.ts\0\0docs/guide.md\0')
    expect(midBreak.ok).toBe(false)
    if (midBreak.ok !== false) return
    expect(midBreak.code).toBe('walk-protocol-error')
    const trailingOnly = row.parseWalkOutput('')
    expect(trailingOnly.ok).toBe(true)
    if (trailingOnly.ok !== true) return
    expect(trailingOnly.entries).toEqual([])
  })

  it('N3 STATIC ARGUMENT: nothing between verification and presentation re-parses a string', () => {
    const source = readFileSync(join(REPO, 'packages/runtime/src/plugin/live/glob-backend.mjs'), 'utf8')
    const code = source.split('\n').filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('/**')).join('\n')
    // (a) the walker's bytes are cut on NUL and NOWHERE by newline:
    expect(code.includes("split('\\0')"), 'the framing split must be on NUL').toBe(true)
    expect(code.includes("split('\\n')"), 'no newline framing may survive anywhere').toBe(false)
    // (b) the outcome's file array is a WINDOW of the verifier's own output:
    expect(code.includes('verdict.entries.slice(0, maxResults)'), 'presentation must be the verifier array, windowed').toBe(true)
    const postVerifyTransforms = code.split('\n').filter((l) => /files:\s*files/.test(l) || /const files =/.test(l))
    expect(postVerifyTransforms).toHaveLength(1)
    // (c) the prefix comes from the anchor, never from the walker's bytes:
    expect(code.includes('anchor.walkRel'), 'the presentation prefix must be anchor-owned').toBe(true)
    // (d) every entry was opened under the pinned fd before its string entered the array:
    expect(code.includes('/proc/self/fd/'), 'verification must run through the pinned fd view').toBe(true)
    expect(code.includes('OPEN_FILE_NOFOLLOW'), 'the final component must be opened without following links').toBe(true)
    // (e) the framing addition is exactly one token, appended once:
    expect((code.match(/GLOB_OUTPUT_PROTOCOL_ARGV/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('N4 the cap window never re-orders: slice preserves the verified order', async () => {
    const anchor = await row.openAnchoredWalkRoot(ROOT_DIR, { placement: 'workspace', locator: '.' })
    expect(anchor.ok).toBe(true)
    if (anchor.ok !== true) return
    try {
      const many = ['src/a.ts', 'src/deep/b.ts', 'src/deep/c.js', 'src/index.ts', 'README.md', 'docs/guide.md']
      const verdict = await row.verifyGlobResultsBeneath(anchor, many)
      expect(verdict.ok).toBe(true)
      if (verdict.ok !== true) return
      expect(verdict.entries).toEqual(many) // target '.' -> no prefix, order preserved verbatim
      expect(verdict.entries.slice(0, 2)).toEqual(many.slice(0, 2))
      const sub = await row.openAnchoredWalkRoot(ROOT_DIR, { placement: 'workspace', locator: 'src' })
      expect(sub.ok).toBe(true)
      if (sub.ok !== true) return
      try {
        const prefixed = await row.verifyGlobResultsBeneath(sub, ['a.ts', 'deep/b.ts'])
        expect(prefixed.ok).toBe(true)
        if (prefixed.ok !== true) return
        expect(prefixed.entries).toEqual(['src/a.ts', 'src/deep/b.ts']) // anchor-owned prefix, one join
      } finally {
        await sub.handle.close()
      }
    } finally {
      await anchor.handle.close()
    }
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

  it('L5 MEASURED interface boundary: a caller-side directory fd CANNOT cross into the confined child', async () => {
    // Fix-list ② asked for the walk root and every result to share one verified
    // fd/handle semantics. This leg states how far the provider's PUBLIC face
    // allows that to go, measured rather than asserted: the fd-inheritance face
    // is a DECLARATION (`declaredFds` -> fd_plan) and the streaming arm spawns
    // the launcher on a fixed four-pipe stdio (`provider.ts`
    // `['pipe','pipe','pipe','pipe']`: 0/1/2 are the streaming interface, 3 is
    // the launcher's own handshake and is REFUSED as a payload fd by
    // `compileFdPlan`). So no caller-opened directory fd ever exists in the
    // child, and `/proc/self/fd/N` inside it can only ever name the child's own
    // descriptors (leg L3b: using it as cwd walks EMPTY).
    // The row therefore puts the handle semantics where the interface DOES
    // allow them: on the caller side, which is also the side that presents the
    // answer — every emitted record is opened under the pinned anchor fd before
    // its string is allowed into the presented array (A4 + A6, legs N3/N4/S1).
    const realmId = 'a5glb-fdface'
    const provider = createConfinedProcessProvider({
      realmId, trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      scratchRoot: join(WORLD, 'scratch-fdface'), assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    })
    expect((await provider.probe()).ok).toBe(true)
    const { open, constants } = await import('node:fs/promises')
    const handle = await open(ROOT_DIR, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
    try {
      const r = await provider.spawnStreaming({
        grantFingerprint: 'a5glb-fdface', realmId, bindingId: 'a5glb-fdface', memberScope: 'member',
        argv: ['/bin/ls', '/proc/self/fd'], cwd: ROOT_DIR,
        env: [['PATH', '/usr/bin:/bin']], allowPaths: confinedAllow(ROOT_DIR),
        declaredFds: [{ fd: 7, purpose: 'delivery', resourceFingerprint: `dir:${String(handle.fd)}` }],
      })
      expect(r.ok, JSON.stringify(r)).toBe(true)
      if (r.ok !== true) return
      let out = ''
      let err = ''
      r.value.stdout.on('data', (c: unknown) => { out += String(c) })
      r.value.stderr.on('data', (c: unknown) => { err += String(c) })
      await r.value.exited
      await r.value.terminate()
      const seen = out.split('\n').filter((l) => l.trim().length > 0).map((l) => l.trim().split(' ')[0])
      expect(seen.length).toBeGreaterThan(0) // the listing itself ran confined
      expect(seen).toContain('0')
      expect(seen).toContain('1')
      expect(seen).toContain('2')
      expect(seen).not.toContain('7') // the DECLARED caller fd is NOT in the child: declaration is not inheritance
      // nothing of the caller's survived past the boundary either — only the
      // streaming pipes and the launcher's own reserved descriptor are there
      expect(seen.filter((f) => Number(f) >= 4)).toEqual([])
      expect(err).toBe('')
      parityRows.push({
        leg: 'L5 fd face (measured)', pattern: '-', target: '/proc/self/fd', nativeExit: 0, nativeCount: seen.length,
        teamCount: seen.length, teamTotal: seen.length, teamTruncated: false, teamFailure: null, orderMatch: true,
        note: `child fds=${seen.join(',')} (0/1/2 streaming pipes + the launcher's own reserved descriptor); a DECLARED caller fd never crosses, so handle semantics must live on the presenting (caller) side`,
      })
    } finally {
      await handle.close()
    }
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

function spySinkFor(): { write(v: string): void; bytes(): string } {
  const chunks: string[] = []
  return { write: (v: string) => { chunks.push(String(v)) }, bytes: () => chunks.join('') }
}

describe('A5-GLOB X — CHANNEL AUDIT: no unverified byte reaches any channel before the verdict', () => {
  // Fix-list ②. The defect this group exists for: the row used to write the
  // child's stdout into io.sink AS IT ARRIVED, so a walk refused a moment later
  // had already put its raw bytes into the spill channel. Every channel a walk
  // can touch is pinned below, statically and behaviourally.
  const SPILL_CANARY = 'A5GLB-UNVERIFIED-BYTES-DO-NOT-SPILL'

  function spySink(): { write(v: string): void; bytes(): string } {
    const chunks: string[] = []
    return { write: (v: string) => { chunks.push(String(v)) }, bytes: () => chunks.join('') }
  }

  async function callWithSink(pattern: string, locator = '.'): Promise<{ result: GlobBackendResult; sink: ReturnType<typeof spySink> }> {
    const sink = spySink()
    const result = await backend.run(globCall(`x-${pattern}-${locator}`, pattern, locator) as never, { sink } as never)
    return { result, sink }
  }

  it('X1 a walk refused AFTER the child streamed spills NOTHING — not one byte, not one name', async () => {
    // The shape of the defect: the child runs, enumerates and streams real
    // rows, and the walk is refused only at verification — the moment where the
    // pre-fix row had ALREADY written those rows into the spill channel.
    // The refusal here is deterministic, not a race: a listed regular file whose
    // contents cannot be opened at verification time (mode 000, and we run as
    // uid != 0, so the open genuinely fails) trips A4 after the stream closed.
    const planted: string[] = []
    for (const name of [`${SPILL_CANARY}-a.ts`, `${SPILL_CANARY}-b.ts`, `${SPILL_CANARY}-c.ts`]) {
      writeFileSync(join(ROOT_DIR, 'docs', name), 'x\n')
      utimesSync(join(ROOT_DIR, 'docs', name), 1_660_000_000, 1_660_000_000)
      planted.push(join(ROOT_DIR, 'docs', name))
    }
    const blocked = join(ROOT_DIR, 'docs', 'zz-unreadable.ts')
    writeFileSync(blocked, 'x\n')
    utimesSync(blocked, 1_660_000_100, 1_660_000_100)
    chmodSync(blocked, 0o000)
    const before = backend.execCount()
    const { result, sink } = await callWithSink('docs/**')
    chmodSync(blocked, 0o644) // the world goes back the way we found it
    expect(result.ok, `expected the post-stream refusal, got ${JSON.stringify(result).slice(0, 240)}`).toBe(false)
    expect(backend.execCount()).toBe(before + 1) // the child DID run and stream
    if (result.ok !== false) return
    expect(['walk-unverifiable', 'walk-contaminated']).toContain(result.failure.code)
    expect(sink.bytes(), 'a refused walk must not write a single byte to the channel').toBe('')
    expect(JSON.stringify(result)).not.toContain(SPILL_CANARY) // the answer echoes no rows
    expect(JSON.stringify(result)).not.toContain(OUTSIDE_TOKEN)
    rmSync(blocked, { force: true })
    for (const p2 of planted) rmSync(p2, { force: true })
    const clean = await callWithSink('docs/**')
    expect(clean.result.ok).toBe(true) // with the object readable again, the same walk answers
    expect(clean.sink.bytes().length).toBeGreaterThan(0)
    parityRows.push({
      leg: 'X1 post-stream refusal spills nothing', pattern: 'docs/**', target: '.', nativeExit: null, nativeCount: 0, teamCount: 0,
      teamTotal: 0, teamTruncated: false, teamFailure: result.failure.code, orderMatch: true,
      note: 'child ran and streamed, verdict refused, channel bytes = 0, answer echoes no rows',
    })
  })

  it('X2 every other refusal arm also leaves the sink empty', async () => {
    const arms: [string, string, string][] = [
      ['walker error (invalid glob)', '**/[a-', '.'],
      ['no such target', '**/*', 'no-such-dir'],
      ['escaping target (pre-spawn)', '**/*', '../outside'],
      ['target is a file', '**/*', 'src/a.ts'],
    ]
    for (const [label, pattern, locator] of arms) {
      const { result, sink } = await callWithSink(pattern, locator)
      expect(result.ok, `${label}: expected refusal`).toBe(false)
      expect(sink.bytes(), `${label}: the sink must stay empty`).toBe('')
    }
  })

  it('X3 the timeout arm settles cancelled and spills nothing', async () => {
    const patient = row.createAnchoredGlobBackend({
      realmId: 'a5glb-timeout', rootDir: CAP_ROOT, confined: confinedConf(CAP_WORLD), timeoutMs: 1,
    })
    const sink = spySink()
    const result = await patient.run(globCall('x-timeout', 'many/*.ts') as never, { sink } as never)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (result.ok !== true) return
    expect(result.settlement.kind).toBe('cancelled')
    expect(result.outcome.files).toEqual([])
    expect(sink.bytes()).toBe('')
    parityRows.push({
      leg: 'X3 timeout spills nothing', pattern: 'many/*.ts', target: '<cap world>', nativeExit: null, nativeCount: 0,
      teamCount: 0, teamTotal: 0, teamTruncated: false, teamFailure: null, orderMatch: true,
      note: 'cancelled settlement, empty outcome, empty sink',
    })
  }, 180_000)

  it('X4 the capped window: spill carries the ADMITTED rows, never the whole walk', async () => {
    const capBackend = row.createAnchoredGlobBackend({
      realmId: 'a5glb-cap-x4', rootDir: CAP_ROOT, confined: confinedConf(CAP_WORLD),
    })
    const sink = spySink()
    const result = await capBackend.run(globCall('x-cap', 'many/*.ts') as never, { sink } as never)
    expect(result.ok).toBe(true)
    if (result.ok !== true) return
    const native = nativeRg(rgPath, CAP_ROOT, nativeGlobArgv('many/*.ts'))
    const nativeList = nativePaths(native)
    expect(result.outcome.files.length).toBe(GLOB_MAX_RESULTS)
    expect(result.outcome.totalMatches).toBe(nativeList.length)
    // spill == the admitted set, in the walker's own NUL framing
    expect(sink.bytes()).toBe(`${result.outcome.files.join('\0')}\0`)
    expect(sink.bytes()).not.toBe(native.stdout) // NOT the whole walk
    expect(sink.bytes().split('\0').filter((r) => r.length > 0)).toHaveLength(GLOB_MAX_RESULTS)
    parityRows.push({
      leg: 'X4 capped spill window', pattern: 'many/*.ts', target: '<cap world>', nativeExit: native.code, nativeCount: nativeList.length,
      teamCount: result.outcome.files.length, teamTotal: result.outcome.totalMatches, teamTruncated: true, teamFailure: null,
      orderMatch: true, note: 'spill carries the admitted rows only, NUL-framed like the walker',
    })
  }, 180_000)


  it('X6 the overflow arm refuses, parses nothing, and writes nothing (buffer narrowed by the assembly)', async () => {
    // The overflow channel, reached honestly: the buffer knob NARROWS only (it
    // can never exceed GLOB_MAX_WALK_BYTES), so a 4 KiB budget over the 105-file
    // tree walks the same code path 8 MB of filenames would.
    const tight = row.createAnchoredGlobBackend({
      realmId: 'a5glb-overflow', rootDir: CAP_ROOT, confined: confinedConf(CAP_WORLD), maxWalkBytes: 256,
    })
    const sink = spySinkFor()
    const result = await tight.run(globCall('x-overflow', 'many/*.ts') as never, { sink } as never)
    expect(result.ok).toBe(false)
    if (result.ok !== false) return
    expect(result.failure.code).toBe('walk-too-large')
    expect(sink.bytes()).toBe('')
    expect(JSON.stringify(result)).not.toContain('f0000.ts') // the refusal echoes no rows
  }, 180_000)

  it('X5 STATIC AUDIT: exactly one channel write, after the verdict, and stderr never reaches it', () => {
    const source = readFileSync(join(REPO, 'packages/runtime/src/plugin/live/glob-backend.mjs'), 'utf8')
    // Comments are stripped first: this audit is about CODE paths. (The prose in
    // that module talks about the sink a lot — on purpose — and prose is not a
    // channel.) Behavioural proof is legs X1-X4; this leg pins the SHAPE.
    const code = source
      .split('\n')
      .map((line) => (line.trimStart().startsWith('//') || line.trimStart().startsWith('*') || line.trimStart().startsWith('/*') ? '' : line.split('//')[0] ?? ''))
      .join('\n')
    const lines = code.split('\n')
    // (a) ONE sink write in the whole module, sitting AFTER the verdict:
    const writeSites = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.includes('sink.write'))
    expect(writeSites.map(({ l }) => l.trim())).toEqual([expect.any(String)])
    const verdictLine = lines.findIndex((l) => l.includes('await verifyGlobResultsBeneath('))
    const windowLine = lines.findIndex((l) => l.includes('verdict.entries.slice(0, maxResults)'))
    expect(verdictLine).toBeGreaterThan(-1)
    expect(windowLine).toBeGreaterThan(verdictLine)
    expect(writeSites).toHaveLength(1)
    expect(writeSites[0]?.i).toBeGreaterThan(windowLine)
    // (b) the stream handler holds no channel and logs no rows:
    const handler = code.slice(code.indexOf("stdout.on('data'"), code.indexOf("child.stderr.on('data'"))
    expect(handler.includes('sink')).toBe(false)
    expect(handler.includes('observe(')).toBe(false)
    expect(handler.includes('io')).toBe(false)
    // (c) stderr is only ever a typed diagnostic: never a channel, never an answer:
    expect(lines.filter((l) => l.includes('stderrText')).every((l) => !l.includes('sink'))).toBe(true)
    const successArm = code.slice(code.lastIndexOf('settlement: { kind:'), code.lastIndexOf('settlement: { kind:') + 900)
    expect(successArm.includes('stderr')).toBe(false)
    // (d) buffering is bounded, so it cannot itself become a channel:
    expect(code.includes('GLOB_MAX_WALK_BYTES')).toBe(true)
    expect(code.includes("'walk-too-large'")).toBe(true)
    // (e) nothing refuses AFTER the write site — the write is the last thing an
    //     admitted walk does before returning it:
    expect(lines.map((l, i) => ({ l, i })).filter(({ l, i }) => i > (writeSites[0]?.i ?? 0) && (l.includes('return failure(') || l.includes('return verdict')))).toEqual([])
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

  it('S3 SUPERSEDED law, kept as a positive: a newline-named file is walked, verified under the pinned fd, and returned by its true name', async () => {
    // This leg used to pin `walk-unverifiable` for such a name — the row ended
    // TYPED rather than fabricate paths, because the protocol could not carry
    // the name. The framing law (A5) removed the cause, so the honest form of
    // the leg is now: the object is ANSWERED for, and verification still runs
    // through the anchor's fd chain.
    const weird = join(ROOT_DIR, 'docs', `weird\nname.ts`)
    writeFileSync(weird, 'A5GLB-NEWLINE-NAME\n')
    utimesSync(weird, 1_655_000_000, 1_655_000_000)
    const result = await call('docs/**')
    expect(result.ok, JSON.stringify(result)).toBe(true)
    const listed = filesOf(result)
    expect(listed).toContain(`docs/weird\nname.ts`)
    const anchor = await row.openAnchoredWalkRoot(ROOT_DIR, { placement: 'workspace', locator: '.' })
    expect(anchor.ok).toBe(true)
    if (anchor.ok !== true) return
    try {
      const verdict = await row.verifyGlobResultsBeneath(anchor, ['docs/guide.md', `docs/weird\nname.ts`])
      expect(verdict.ok, JSON.stringify(verdict)).toBe(true)
      if (verdict.ok !== true) return
      expect(verdict.entries).toEqual(['docs/guide.md', `docs/weird\nname.ts`])
    } finally {
      await anchor.handle.close()
    }
    rmSync(weird, { force: true })
    const clean = await call('docs/**')
    expect(clean.ok, JSON.stringify(clean)).toBe(true) // with the object gone, the same walk is clean again
  })
})
