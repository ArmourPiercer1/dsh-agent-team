/**
 * A5-SRGP — the anchored confined-ripgrep SEARCH backend: RED-first face, the
 * rg PARITY regression the plan names
 * (`docs/plans/memo/alpha5-tool-io-governance/alpha5-s0-pr0-pr8-implementation-plan.md`
 * :33 PR5 "grep/glob R3 … 原生等价层", :132 "真实固定 rg 版行为回归（原生 vs Team
 * 的结构化 value、meta/render、错误、binary、ignore/hidden/VCS、路径、溢出 Spill、
 * 本机/并发/Cancel/timeout）"), the LIVE leg (the real packaged rg 15 inside the
 * real confined provider), and the typed-shape legs.
 *
 * RED FIRST (legs R1–R5): the SHIPPED plane row — the grep(1) port in
 * `plane-effect-backends.mjs` — is exercised UNCHANGED and its behaviour is
 * pinned verbatim, because it is the control the parity claim is measured
 * against: its argv form, the files it finds that a default-law ripgrep walk
 * must not find (the ignore/hidden/VCS gap the GLUE-7 review ② named), the way
 * `contextLines` arrives as indistinguishable "matches", its `multiline` refusal
 * word, and the way a newline in a filename splits one object into two entries.
 * Then every P leg mounts the NEW row and shows the rg answer.
 *
 * PARITY DISCIPLINE: the native side is invoked with the HAND-WRITTEN argv of
 * `alpha5-search-harness.ts` (not the host helper), and leg `argv-law` is what
 * ties that spelling to the host's public `buildGrepCommand` plus the row's
 * frozen additions. A parity match therefore cannot be true by construction.
 *
 * Evidence: run with `A5SRGP_EVIDENCE_DIR=<dir>` to also write
 * `parity-table.json` (byte-stable: no timestamps, no absolute paths).
 *
 * Worlds: `tests/homes/a5srgp-*` (TEST_METHODS §5/§7), self-removed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { buildGrepCommand, parseGrepArgs, resolveRgPath } from '@deepseek-ai/dsh-tool-fs-search'
import { createConfinedProcessProvider } from '../sandbox-provider/index.js'
import {
  buildOutside,
  buildSearchFixture,
  confinedConf,
  destroyWorldVerified,
  LAUNCHER,
  LAUNCHER_SHA,
  loadSearchBackendRow,
  nativeModeArgv,
  REPO,
  nativePlainRows,
  nativeSearchArgv,
  nativeSearchRg,
  nativeJsonRows,
  newWorld,
  plantBulk,
  refusalCodeSet,
  relativize,
  SEARCH_EXCLUDED,
  SEARCH_INCLUDED,
  SEARCH_TOK,
  searchCall,
  type SearchBackend,
  type SearchBackendResult,
  type SearchBackendRow,
  type NativeRun,
} from './alpha5-search-harness.js'

import { sweepStrayWorlds } from './alpha5-glob-harness.js'

const WORLD = newWorld('a5srgp-unit')
const ROOT_DIR = join(WORLD, 'root')
const OUTSIDE_DIR = join(WORLD, 'outside')
const BULK_WORLD = newWorld('a5srgp-bulk')
const BULK_ROOT = join(BULK_WORLD, 'root')
/** The house face for the environment in this package's tests. */
const ENV = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const EVIDENCE_DIR = ENV['A5SRGP_EVIDENCE_DIR']
const SLOW = 120_000

const START_SWEEP = sweepStrayWorlds('a5srgp-')

/** The repository root this spec runs from (`packages/runtime/test/<file>`). */
const REPO_ROOT = resolve(import.meta.dirname, '../../..')
/** The dist byte-copy targets named by `scripts/place-dist-glue.mjs`. */
const placedDistPaths = (): string[] =>
  [...readFileSync(join(REPO_ROOT, 'scripts/place-dist-glue.mjs'), 'utf8')
    .matchAll(/^\s+dist: '([^']+\.mjs)'/gm)]
    .map((m) => m[1] ?? '')
    .filter((rel) => rel !== '')
/** Every `.mjs` the shipped live rows import by a relative specifier. */
const faceImportsOf = (absFile: string): string[] =>
  [...readFileSync(absFile, 'utf8').matchAll(/from\s+'(\.[^']+)'/g)].map((m) => resolve(dirname(absFile), m[1] ?? ''))

/** The SHIPPED row (the RED control), loaded the house way for live `.mjs` rows. */
interface PlaneBackendsRow {
  grepArgv(parsed: Record<string, unknown>, searchPath: string): string[]
  createAnchoredSearchBackend(o: Record<string, unknown>): unknown
}
const planeRow: PlaneBackendsRow = (await import(new URL('../src/plugin/live/plane-effect-backends.mjs', import.meta.url).href)) as PlaneBackendsRow

let row: SearchBackendRow
let rgPath = ''
let backend: SearchBackend
const observed: string[] = []
const parityRows: ParityRow[] = []

interface ParityRow {
  readonly leg: string
  readonly mode: string
  readonly nativeExit: number | null
  readonly nativeCount: number
  readonly teamCount: number
  readonly teamTotal: number
  readonly teamTruncated: boolean
  readonly teamFailure: string | null
  readonly match: boolean
  readonly note: string
}

/**
 * One row per parity leg, written out (byte-stably) when an evidence dir is set.
 * `ok` is passed IN because each leg decides parity on the comparison IT asserts
 * (P4's is "these classes are absent here and present in the no-ignore control",
 * P8's is "both sides refuse"), not on a generic set equality. Every leg still
 * records the native exit, both counts and the row's own verdict, so a claim
 * that was decided by a looser comparison than it looks like stays visible.
 */
function parity(leg: string, mode: string, native: NativeRun, result: SearchBackendResult, note: string, ok: boolean, nativeCount: number, teamCount: number): void {
  const failure = result.ok === false ? result.failure.code : null
  const outcome = result.ok === true ? result.outcome : null
  parityRows.push({
    leg,
    mode,
    nativeExit: native.code,
    nativeCount,
    teamCount,
    teamTotal: outcome?.totalMatches ?? -1,
    teamTruncated: outcome?.truncated ?? false,
    teamFailure: failure,
    match: ok,
    note,
  })
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

/** Run the row with a fresh counting sink. */
async function runRow(b: SearchBackend, call: unknown): Promise<{ result: SearchBackendResult; writes: () => number; bytes: () => number; text: () => string }> {
  const sink = { writes: 0, buf: '' }
  const result = await b.run(call, { sink: { write(t: string) { sink.writes += 1; sink.buf += t } } })
  return { result, writes: () => sink.writes, bytes: () => sink.buf.length, text: () => sink.buf }
}

beforeAll(async () => {
  row = await loadSearchBackendRow()
  rgPath = await resolveRgPath()
  buildSearchFixture(ROOT_DIR)
  buildOutside(OUTSIDE_DIR)
  // An in-tree symlink that escapes the governed root (the escape class), and a
  // file target for the file-arm legs.
  symlinkSync(join(OUTSIDE_DIR, 'secret.txt'), join(ROOT_DIR, 'escape-link.txt'))
  backend = row.createAnchoredRgSearchBackend({
    realmId: 'a5srgp-realm',
    rootDir: ROOT_DIR,
    confined: confinedConf(WORLD),
    observe: (line: string) => { observed.push(line) },
  })
}, SLOW)

afterAll(async () => {
  const reappeared = await destroyWorldVerified(WORLD) + await destroyWorldVerified(BULK_WORLD)
  for (const dir of [WORLD, BULK_WORLD]) {
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* already gone */ }
  }
  expect(reappeared).toBe(0)
  if (EVIDENCE_DIR !== undefined && EVIDENCE_DIR.length > 0) {
    mkdirSync(EVIDENCE_DIR, { recursive: true })
    const body = {
      row: 'packages/runtime/src/plugin/live/search-backend.mjs',
      rg: 'ripgrep 15.0.0 (rev 3a612f88b8) — @vscode/ripgrep-linux-x64@1.18.0',
      launcher: `sha256:${LAUNCHER_SHA.slice(0, 16)}`,
      fixedArgv: ['<rg>', '--no-config', '--json', '--regexp=<P>', '[--glob=<inc>]', ...row.SEARCH_ARGV_ADDITIONS, '--', '.'],
      legs: { total: parityRows.length, matched: parityRows.filter((r) => r.match).length },
      rows: parityRows,
      strayWorldsSweptAtStart: START_SWEEP,
    }
    writeFileSync(join(EVIDENCE_DIR, 'parity-table.json'), `${JSON.stringify(body, null, 2)}\n`)
  }
}, SLOW)

// ---------------------------------------------------------------------------
// R — the RED control: the SHIPPED grep(1) row, pinned as the fact it is
// ---------------------------------------------------------------------------

describe('A5-SRGP R: the shipped grep-port row is the control (RED face)', () => {
  const oldRow = planeRow.createAnchoredSearchBackend({ realmId: 'a5srgp-realm', rootDir: ROOT_DIR, observe: () => {} }) as unknown as SearchBackend

  it('R1 pins its argv form verbatim', () => {
    expect(planeRow.grepArgv({ pattern: SEARCH_TOK, outputMode: 'content', fixedString: false, ignoreCase: false, contextLines: 0 }, '/abs/target')).toEqual([
      '-rIn', '--binary-files=without-match', '-E', '--', SEARCH_TOK, '/abs/target',
    ])
    // The shipped form keeps `-rIn` AND splices `-rl` in place of the binary
    // flag — pinned verbatim, quirks included: this is the control.
    expect(planeRow.grepArgv({ pattern: SEARCH_TOK, outputMode: 'files_with_matches', fixedString: false, ignoreCase: false, contextLines: 0 }, '.')).toEqual([
      '-rIn', '-rl', '-E', '--', SEARCH_TOK, '.',
    ])
  })

  it('R2 finds the ignore / hidden / VCS classes a default-law rg walk must NOT find', async () => {
    const { result } = await runRow(oldRow as unknown as SearchBackend, searchCall('r2', { outputMode: 'files_with_matches', maxResults: 500 }))
    expect(result.ok).toBe(true)
    const found = result.ok === true ? relativize(ROOT_DIR, result.outcome.files) : []
    // The classes the GLUE-7 review ② named: grep(1) has no ignore law at all.
    for (const excluded of ['ignored/drop.ts', 'node_modules/pkg/index.ts', '.hidden.ts', '.git/config', '.svn/entries']) {
      expect(found, `the grep row must still find ${excluded} (that is the gap)`).toContain(excluded)
    }
  }, SLOW)

  it('R3 shows contextLines arriving as ordinary matches (the mangling the rg row refuses by name)', async () => {
    const { result } = await runRow(oldRow as unknown as SearchBackend, searchCall('r3', { contextLines: 1, maxResults: 500 }))
    expect(result.ok).toBe(true)
    if (result.ok !== true) return
    // grep prints a context line as `path-NN-text` (dashes, not a colon), so the
    // shipped parser lands it as a MATCH whose `path` is the whole line and whose
    // `text` is empty: the neighbour of `src/a.ts:1` arrives as content the lane
    // cannot tell apart from a hit. That is the mangling the rg row refuses by
    // name instead of reproducing.
    const mangled = result.outcome.matches.filter((m) => m.text === '' && String(m.path).includes('plain neighbour'))
    expect(mangled.length).toBeGreaterThan(0)
  }, SLOW)

  it('R4 keeps its honest multiline refusal word (the rg row re-uses the word)', async () => {
    const { result } = await runRow(oldRow as unknown as SearchBackend, searchCall('r4', { multiline: true }))
    expect(result.ok).toBe(false)
    if (result.ok === false) expect(result.failure.code).toBe('multiline-unsupported')
  })

  it('R5 splits one newline-named file into two entries (newline framing is not injective)', async () => {
    const { result } = await runRow(oldRow as unknown as SearchBackend, searchCall('r5', { outputMode: 'files_with_matches', maxResults: 500 }))
    expect(result.ok).toBe(true)
    if (result.ok !== true) return
    const found = relativize(ROOT_DIR, result.outcome.files)
    expect(found).toContain('newline')
    expect(found).toContain('name.ts')
    expect(found).not.toContain('newline\nname.ts')
  }, SLOW)
})

// ---------------------------------------------------------------------------
// A — the argv law (static; no child exists yet)
// ---------------------------------------------------------------------------

describe('A5-SRGP A: the fixed argv is one measurement, one builder', () => {
  it('argv-law: the hand-written oracle spelling equals the row builder equals the host helper plus the frozen additions', () => {
    const built = row.searchArgv({ pattern: SEARCH_TOK })
    expect(built).toEqual(nativeSearchArgv(SEARCH_TOK))
    const hostForm = ['--no-config', ...buildGrepCommand(parseGrepArgs({ pattern: SEARCH_TOK })), ...row.SEARCH_ARGV_ADDITIONS, '--', '.']
    expect(built).toEqual(hostForm)
    expect(built).toEqual(['--no-config', '--json', `--regexp=${SEARCH_TOK}`, '--no-ignore-parent', '--no-ignore-global', '--', '.'])
  })

  it('argv-law/include: the lane filter rides the host\'s own --glob= form', () => {
    const built = row.searchArgv({ pattern: 'a(b', globFilter: '*.ts' })
    expect(built).toEqual(nativeSearchArgv('a(b', { include: '*.ts' }))
    expect(built).toEqual(['--no-config', '--json', '--regexp=a(b', '--glob=*.ts', '--no-ignore-parent', '--no-ignore-global', '--', '.'])
  })

  it('argv-additions: every addition is a --no-* law switch, and --no-messages is DELIBERATELY ABSENT', () => {
    expect(row.SEARCH_ARGV_ADDITIONS).toEqual(['--no-ignore-parent', '--no-ignore-global'])
    for (const addition of row.SEARCH_ARGV_ADDITIONS) expect(addition.startsWith('--no-')).toBe(true)
    // The absence is a law, measured. `--no-messages` silences the ONE line that
    // separates "this tree has nothing to search" from "the kernel refused the
    // walk" (`rg: .: Permission denied (os error 13)`): probes
    // `coverage-probe.mjs` legs G-on-nogrants vs B-off-nogrants — with the flag a
    // fully refused walk answers `summary` + `stats.searches=0` + EMPTY stderr, a
    // silent "no matches". The noise the flag was meant for names an ABSOLUTE
    // path, which the coverage law ignores by shape (legs V11d, V11e).
    expect(row.SEARCH_ARGV_ADDITIONS).not.toContain('--no-messages')
    expect(row.searchArgv({ pattern: SEARCH_TOK })).not.toContain('--no-messages')
    expect(row.SEARCH_WALK_PATH_ELEMENT).toBe('.')
  })

  it('argv-no-path: a directory target carries NO path string; a file target carries only its own name', async () => {
    const dir = await runRow(backend, searchCall('a-no-path-dir'))
    expect(dir.result.ok).toBe(true)
    const dirArgv = String(backend.lastRuns.at(-1)?.argv ?? '')
    expect(dirArgv).toContain(' -- .')
    expect(dirArgv).not.toContain(WORLD)
    const file = await runRow(backend, searchCall('a-no-path-file', { target: { placement: 'workspace', locator: 'src/a.ts' } }))
    expect(file.result.ok).toBe(true)
    const fileArgv = String(backend.lastRuns.at(-1)?.argv ?? '')
    expect(fileArgv).toContain(' -- a.ts')
    expect(fileArgv).not.toContain(WORLD)
  }, SLOW)

  it('explicit-path-is-load-bearing: without `-- .` the confined child answers a SILENT ZERO', async () => {
    // The row never builds this argv; this leg reproduces it through the SAME
    // provider face to pin WHY the constant `.` is not cosmetic. Inside the
    // confined child fd 0 is a socket, so rg 15's stdin heuristic replaces the
    // walk with an empty stdin search (exit 0, zero records, zero stderr).
    const provider = createConfinedProcessProvider({
      realmId: 'a5srgp-heuristic',
      trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      scratchRoot: join(WORLD, 'scratch-heur'),
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    })
    const probe = await provider.probe()
    expect(probe.ok).toBe(true)
    const rx = (path: string) => ({ path, accessBits: { execute: true, readFile: true, readDir: true } })
    const run = async (argv: string[]) => {
      const h = await provider.spawnStreaming({
        grantFingerprint: `a5srgp-heuristic:${argv.length}`,
        realmId: 'a5srgp-heuristic',
        bindingId: 'a5srgp-heuristic',
        memberScope: 'leg',
        argv,
        cwd: ROOT_DIR,
        env: [['PATH', '/usr/bin:/bin']],
        allowPaths: [rx('/bin'), rx('/usr'), rx('/lib'), rx(rgPath.slice(0, rgPath.lastIndexOf('/'))), { path: ROOT_DIR, accessBits: { readFile: true, readDir: true } }],
      })
      if (h.ok !== true) return { code: -1, out: '', err: `refused ${String(h.error?.code)}` }
      const c = h.value
      c.stdin.end()
      let out = ''
      let err = ''
      c.stdout.on('data', (d) => { out += String(d) })
      c.stderr.on('data', (d) => { err += String(d) })
      const ex = await Promise.race([c.exited, new Promise((r) => setTimeout(() => r({ code: -9 }), 30_000))])
      await c.terminate()
      return { code: (ex as { code?: number }).code ?? -1, out, err }
    }
    const without = await run([rgPath, '--no-config', '--json', `--regexp=${SEARCH_TOK}`, ...row.SEARCH_ARGV_ADDITIONS])
    const withPath = await run([rgPath, '--no-config', '--json', `--regexp=${SEARCH_TOK}`, ...row.SEARCH_ARGV_ADDITIONS, '--', '.'])
    expect(without.code).toBe(0)
    expect(without.out.includes('"type":"match"')).toBe(false)
    expect(withPath.code).toBe(0)
    expect(withPath.out.includes('"type":"match"')).toBe(true)
  }, SLOW)

  it('source-law: one sink write, no channel in the stream handler, internal face opt-in, codes from the table only', () => {
    const src = readFileSync(join(REPO, 'packages/runtime/src/plugin/live/search-backend.mjs'), 'utf8')
    // (1) exactly one sink write site, and it is the post-verdict one.
    expect(src.match(/sink\?\.write\(/g) ?? []).toHaveLength(1)
    expect(src.match(/io\.sink\.write\(/g) ?? []).toHaveLength(0)
    // (2) the stdout data handler holds no channel: the only writes it performs
    //     are into its own buffer variables.
    const handler = src.slice(src.indexOf("child.stdout.on('data'"), src.indexOf("child.stderr.on('data'"))
    expect(handler).not.toContain('sink')
    expect(handler).not.toContain('observe(')
    // (3) the internal face is OFF by default and never a return value.
    expect(src).toContain('internalLog = null')
    // (4) every code literal handed to failure() is a table key.
    const table = refusalCodeSet(row)
    const codes = [...src.matchAll(/failure\('[a-z]+', '([a-z-]+)'/g)].map((m) => m[1] ?? '')
    expect(codes.length).toBeGreaterThan(10)
    for (const code of codes) expect(table.has(code), `code ${code} missing from the table`).toBe(true)
    // (5) the row imports the anchor law instead of forking it.
    expect(src).toContain("from './glob-backend.mjs'")
  })
})

// ---------------------------------------------------------------------------
// P — the parity regression (plan :132), one leg per class
// ---------------------------------------------------------------------------

describe('P: native fixed-rg vs Team row, per class (plan alpha5-s0-pr0-pr8:132)', () => {
  it('P1 content: same rows (path, line, text) as the native --json oracle', async () => {
    const native = nativeSearchRg(rgPath, ROOT_DIR, nativeSearchArgv(SEARCH_TOK))
    const nativeRows = nativeJsonRows(native)
    const { result, writes, text } = await runRow(backend, searchCall('p1', { maxResults: 500 }))
    expect(result.ok).toBe(true)
    if (result.ok !== true) return
    const teamRows = result.outcome.matches.map((m) => ({ path: relativize(ROOT_DIR, [m.path])[0] ?? '', line: m.line, text: m.text }))
    expect(teamRows).toHaveLength(nativeRows.length)
    expect([...teamRows].sort((a, b) => `${a.path}:${String(a.line)}`.localeCompare(`${b.path}:${String(b.line)}`)))
      .toEqual([...nativeRows].sort((a, b) => `${a.path}:${String(a.line)}`.localeCompare(`${b.path}:${String(b.line)}`)))
    // the presented spelling is the ANCHORED absolute path (what the plane read
    // row can read back), and the spill is written exactly once
    for (const m of result.outcome.matches) expect(m.path.startsWith(`${ROOT_DIR}/`)).toBe(true)
    expect(writes()).toBe(1)
    // the spill is ONE write of every admitted row in the lane's line form…
    const rendered = result.outcome.matches.length
    expect(rendered).toBe(nativeRows.length)
    // …but the line form is not injective when a NAME carries a newline (the
    // fixture plants `newline<LF>name.ts`), so the byte payload has one more
    // line than there are rows. Disclosed, not fixed: the row's VALUE is the
    // structured array (P7 shows the name arrives whole); a line-framed
    // RENDER of it inherits the same ambiguity the native `-l`/grep form has —
    // and unlike those, nothing here parses the render back.
    expect(text()).toBe(result.outcome.matches.map((m) => `${m.path}:${String(m.line)}:${m.text}`).join('\n'))
    expect(text().split('\n')).toHaveLength(nativeRows.length + 1)
    parity('P1', 'content', native, result, 'rows equal (path/line/text), anchored spelling', sameSet(teamRows.map((r) => `${r.path}:${String(r.line)}`), nativeRows.map((r) => `${r.path}:${String(r.line)}`)), nativeRows.length, teamRows.length)
  }, SLOW)

  it('P2 files_with_matches: the projection equals the native -l oracle', async () => {
    const native = nativeSearchRg(rgPath, ROOT_DIR, nativeModeArgv(SEARCH_TOK, 'files'))
    const nativeFiles = nativePlainRows(native)
    const { result } = await runRow(backend, searchCall('p2', { outputMode: 'files_with_matches', maxResults: 500 }))
    expect(result.ok).toBe(true)
    if (result.ok !== true) return
    const team = relativize(ROOT_DIR, result.outcome.files)
    // The native `-l` answer is NEWLINE-framed, so the fixture's
    // `newline<LF>name.ts` arrives there as TWO entries. Merging that pair is
    // the only correction applied — and it is applied because the plain
    // protocol CANNOT carry the name, while the row's value can (P7).
    expect(nativeFiles).toContain('newline')
    expect(nativeFiles).toContain('name.ts')
    const merged = nativeFiles.filter((p) => p !== 'newline' && p !== 'name.ts').concat('newline\nname.ts')
    expect(sameSet(team, merged)).toBe(true)
    parity('P2', 'files_with_matches', native, result, 'projection vs native -l (plain form splits a newline name)', sameSet(team, merged), merged.length, team.length)
  }, SLOW)

  it('P3 count: the projection equals the native -c oracle (per-file line counts)', async () => {
    const native = nativeSearchRg(rgPath, ROOT_DIR, nativeModeArgv(SEARCH_TOK, 'count'))
    const nativeCounts = nativePlainRows(native)
    const { result } = await runRow(backend, searchCall('p3', { outputMode: 'count', maxResults: 500 }))
    expect(result.ok).toBe(true)
    if (result.ok !== true) return
    const team = relativize(ROOT_DIR, result.outcome.counts.map((c) => `${c.path}:${String(c.count)}`))
    // as in P2: the `-c` form is newline-framed too, so its answer splits the
    // newline-named file (`newline` with no count, and `name.ts:1`).
    const mergedCounts = nativeCounts
      .filter((l) => l !== 'newline' && l !== 'name.ts:1')
      .concat('newline\nname.ts:1')
    expect(nativeCounts).toContain('name.ts:1')
    expect(sameSet(team, mergedCounts)).toBe(true)
    // the src/twice.ts arm: TWO matched lines in one file is count 2, not 1
    const twice = result.outcome.counts.find((c) => c.path.endsWith('src/twice.ts'))
    expect(twice?.count).toBe(2)
    parity('P3', 'count', native, result, 'projection vs native -c (plain form splits a newline name)', sameSet(team, mergedCounts), mergedCounts.length, team.length)
  }, SLOW)

  it('P4 ignore / hidden / VCS classes: absent from the answer, present in the native no-ignore control', async () => {
    const { result } = await runRow(backend, searchCall('p4', { outputMode: 'files_with_matches', maxResults: 500 }))
    expect(result.ok).toBe(true)
    if (result.ok !== true) return
    const team = relativize(ROOT_DIR, result.outcome.files)
    for (const excluded of SEARCH_EXCLUDED) {
      expect(team, `${excluded} must not be searched under rg's default ignore law`).not.toContain(excluded)
    }
    for (const included of SEARCH_INCLUDED) expect(team).toContain(included)
    // the classes are REAL, not a fixture accident:
    const control = nativeSearchRg(rgPath, ROOT_DIR, ['--no-config', '--json', `--regexp=${SEARCH_TOK}`, '--no-ignore', '--hidden', '--no-ignore-parent', '--no-ignore-global', '--', '.'])
    const controlPaths = new Set(nativeJsonRows(control).map((r) => r.path))
    for (const excluded of SEARCH_EXCLUDED) expect(controlPaths, `${excluded} must be findable`).toContain(excluded)
    parity('P4', 'ignore/hidden/VCS', control, result, 'excluded under the default ignore law, all found with --no-ignore --hidden', SEARCH_EXCLUDED.every((p) => !team.includes(p) && controlPaths.has(p)) && SEARCH_INCLUDED.every((p) => team.includes(p) && controlPaths.has(p)), controlPaths.size, team.length)
  }, SLOW)

  it('P5 binary: a NUL-bearing line yields no record on EITHER side (and --text proves the token is there)', async () => {
    const native = nativeSearchRg(rgPath, ROOT_DIR, nativeSearchArgv(SEARCH_TOK))
    const nativePaths = nativeJsonRows(native).map((r) => r.path)
    const { result } = await runRow(backend, searchCall('p5', { maxResults: 500 }))
    expect(result.ok).toBe(true)
    if (result.ok !== true) return
    const team = relativize(ROOT_DIR, result.outcome.matches.map((m) => m.path))
    expect(nativePaths).not.toContain('src/BINARY.bin')
    expect(team).not.toContain('src/BINARY.bin')
    // the file really does carry the token — the walker skipped it, the fixture
    // did not omit it.
    const text = nativeSearchRg(rgPath, ROOT_DIR, ['--no-config', '--json', `--regexp=${SEARCH_TOK}`, '--text', '--no-ignore-parent', '--no-ignore-global', '--', 'src/BINARY.bin'])
    expect(nativeJsonRows(text).length).toBeGreaterThan(0)
    parity('P5', 'binary', native, result, 'no record for a NUL-bearing line, both sides', !team.includes('src/BINARY.bin') && !nativePaths.includes('src/BINARY.bin'), nativePaths.length, team.length)
  }, SLOW)

  it('P6 forged record in a file body cannot inject a path (the body is data, the framing is JSON)', async () => {
    const { result, text } = await runRow(backend, searchCall('p6', { maxResults: 500 }))
    expect(result.ok).toBe(true)
    if (result.ok !== true) return
    // What must not happen is a forged path becoming a PATH: every path the
    // row presents is an anchored, verified object name. The body is data and
    // is presented verbatim, so the forged SENTENCE legitimately appears there.
    for (const m of result.outcome.matches) {
      expect(m.path).not.toContain('..')
      expect(m.path).not.toContain('/etc/passwd')
      expect(m.path.startsWith(`${ROOT_DIR}/`)).toBe(true)
    }
    // the file itself IS searched, and its forged text is returned as body only
    const forged = result.outcome.matches.filter((m) => m.path.endsWith('forged.json'))
    expect(forged.length).toBe(1)
    expect(forged[0]?.text).toContain('FORGED')
    expect(forged[0]?.path).toBe(`${ROOT_DIR}/forged.json`)
    // and the spill carries that row exactly once — the forged record is one
    // BODY line inside the payload, never a line of its own with a path prefix.
    expect(text().split('\n').filter((l) => l.includes('FORGED'))).toHaveLength(1)
  }, SLOW)

  it('P7 path classes: spaced / unicode / CRLF / newline-in-name are ONE record each', async () => {
    const { result } = await runRow(backend, searchCall('p7', { outputMode: 'files_with_matches', maxResults: 500 }))
    expect(result.ok).toBe(true)
    if (result.ok !== true) return
    const team = relativize(ROOT_DIR, result.outcome.files)
    expect(team).toContain('spaced name.ts')
    expect(team).toContain('unicode-ünïcode-日本.ts')
    expect(team).toContain('crlf.txt')
    // the leg R5 showed the grep row splitting: here it is one entry, exact name
    expect(team).toContain('newline\nname.ts')
    expect(team).not.toContain('newline')
    expect(team).not.toContain('name.ts')
  }, SLOW)

  it('P8 error class: an invalid pattern is a typed refusal, the walker\'s words never travel', async () => {
    // native (unconfined) has an exit code to read: ripgrep exits 2 here.
    const native = nativeSearchRg(rgPath, ROOT_DIR, nativeSearchArgv('('))
    expect(native.code).toBe(2)
    expect(native.stdout).toBe('')
    const before = backend.execCount()
    const { result, writes, text } = await runRow(backend, searchCall('p8', { pattern: '(' }))
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.failure.code).toBe('walker-invalid-pattern')
      expect(result.failure.class).toBe('undetermined')
      expect(result.failure.detail).toBe(row.SEARCH_REFUSAL_TEXT['walker-invalid-pattern'])
      // the only dynamic content the refusal carries is arithmetic
      expect(Number.isInteger(result.failure.counts.stderrBytes)).toBe(true)
      // the walker's sentence is enumeration data: not on the wire, not in spill
      const wire = JSON.stringify(result)
      expect(wire).not.toContain('regex parse error')
      expect(wire).not.toContain('unclosed group')
    }
    expect(writes()).toBe(0)
    expect(text()).toBe('')
    expect(backend.execCount()).toBe(before + 1)
    parity('P8', 'error/invalid-pattern', native, result, 'native exit 2 / row refusal walker-invalid-pattern, no echoed words', result.ok === false && result.failure.code === 'walker-invalid-pattern', 0, 0)
  }, SLOW)

  it('P8b the confined face carries NO payload exit code — so completion is proved from the stream', async () => {
    // `/bin/sh -c 'exit 7'` settles code 0 through this face: the pre-launcher
    // supervises the child and exits 0 whatever it did. A row that read
    // "exit 0" as success would trust a walk that never started, so this row
    // reads the PROTOCOL instead (a completed `--json` walk always ends with a
    // `summary` record).
    const provider = createConfinedProcessProvider({
      realmId: 'a5srgp-exits',
      trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      scratchRoot: join(WORLD, 'scratch-exits'),
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    })
    await provider.probe()
    const rx = (path: string) => ({ path, accessBits: { execute: true, readFile: true, readDir: true } })
    const one = async (argv: string[]) => {
      const h = await provider.spawnStreaming({
        grantFingerprint: `a5srgp-exits:${argv.length}:${argv[1] ?? ''}`,
        realmId: 'a5srgp-exits', bindingId: 'a5srgp-exits', memberScope: 'leg',
        argv, cwd: ROOT_DIR, env: [['PATH', '/usr/bin:/bin']],
        allowPaths: [rx('/bin'), rx('/usr'), rx('/lib'), rx(rgPath.slice(0, rgPath.lastIndexOf('/'))), { path: ROOT_DIR, accessBits: { readFile: true, readDir: true } }],
      })
      expect(h.ok).toBe(true)
      if (h.ok !== true) return { code: -1, summary: false }
      const c = h.value
      c.stdin.end()
      let out = ''
      c.stdout.on('data', (d) => { out += String(d) })
      const ex = await Promise.race([c.exited, new Promise((r) => setTimeout(() => r({ code: -9 }), 30_000))])
      await c.terminate()
      return { code: (ex as { code?: number }).code ?? -1, summary: out.includes('"type":"summary"') }
    }
    const seven = await one(['/bin/sh', '-c', 'exit 7'])
    expect(seven.code).toBe(0) // the face cannot see the child's status
    const good = await one([rgPath, ...row.searchArgv({ pattern: SEARCH_TOK })])
    expect(good.code).toBe(0)
    expect(good.summary).toBe(true) // a completed walk proves itself
    const bad = await one([rgPath, ...row.searchArgv({ pattern: '(' })])
    expect(bad.code).toBe(0) // …and an ex-0 face is exactly why the summary is the law
    expect(bad.summary).toBe(false)
  }, SLOW)

  it('P9 empty answer: exit 1 is a SUCCESS with zero matches and zero spill bytes', async () => {
    const native = nativeSearchRg(rgPath, ROOT_DIR, nativeSearchArgv('zzz-not-in-any-fixture-file'))
    expect(native.code).toBe(1)
    const { result, writes } = await runRow(backend, searchCall('p9', { pattern: 'zzz-not-in-any-fixture-file' }))
    expect(result.ok).toBe(true)
    if (result.ok !== true) return
    expect(result.outcome.totalMatches).toBe(0)
    expect(result.outcome.matches).toHaveLength(0)
    expect(result.outcome.truncated).toBe(false)
    expect(writes()).toBe(0)
    parity('P9', 'empty', native, result, 'native exit 1 = empty answer, row answers 0 matches', native.code === 1 && result.ok === true && result.outcome.totalMatches === 0, 0, 0)
  }, SLOW)

  it('P10 include filter: honored, and a filter that selects nothing is an empty answer, both sides', async () => {
    const withFilter = nativeSearchRg(rgPath, ROOT_DIR, nativeSearchArgv(SEARCH_TOK, { include: '*.ts' }))
    const { result, writes } = await runRow(backend, searchCall('p10', { globFilter: '*.ts', maxResults: 500 }))
    expect(result.ok).toBe(true)
    if (result.ok !== true) return
    expect(writes()).toBe(1) // a non-empty answer spills exactly once
    const team = [...new Set(relativize(ROOT_DIR, result.outcome.matches.map((m) => m.path)))]
    const native = [...new Set(nativeJsonRows(withFilter).map((r) => r.path))]
    expect(sameSet(team, native)).toBe(true)
    for (const p of team) expect(p.endsWith('.ts')).toBe(true)
    // Measured native law for a filter that selects NOTHING: ripgrep 15 ends the
    // walk with a `summary` record and exit 1 — an empty answer, not a failure
    // (both with and without `--no-messages`). The row answers the same way,
    // which is only visible because its completion law reads the summary.
    const nothing = nativeSearchRg(rgPath, ROOT_DIR, nativeSearchArgv(SEARCH_TOK, { include: '*.md' }))
    expect(nothing.code).toBe(1)
    expect(nothing.stdout).toContain('"type":"summary"')
    const raw = nativeSearchRg(rgPath, ROOT_DIR, ['--no-config', '--json', `--regexp=${SEARCH_TOK}`, '--glob=*.md', '--no-ignore-parent', '--no-ignore-global', '--', '.'])
    expect(raw.code).toBe(1)
    const { result: emptyResult, writes: emptyWrites } = await runRow(backend, searchCall('p10b', { globFilter: '*.md' }))
    expect(emptyResult.ok).toBe(true)
    if (emptyResult.ok === true) expect(emptyResult.outcome.totalMatches).toBe(0)
    expect(emptyWrites()).toBe(0)
    parity('P10', 'include', withFilter, result, 'filter honored; no-match filter is an empty answer on both sides', sameSet(team, native), native.length, team.length)
  }, SLOW)

  it('P11 overflow/Spill class: the inline window truncates honestly, the spill keeps EVERY admitted row', async () => {
    plantBulk(BULK_ROOT, 40)
    buildSearchFixture(BULK_ROOT)
    const bulkBackend = row.createAnchoredRgSearchBackend({
      realmId: 'a5srgp-bulk',
      rootDir: BULK_ROOT,
      confined: confinedConf(BULK_WORLD),
      observe: () => {},
    })
    const native = nativeSearchRg(rgPath, BULK_ROOT, nativeSearchArgv(SEARCH_TOK))
    const nativeCount = nativeJsonRows(native).length
    const { result, writes, text } = await runRow(bulkBackend, searchCall('p11', { maxResults: 5 }))
    expect(result.ok).toBe(true)
    if (result.ok !== true) return
    expect(result.outcome.matches).toHaveLength(5)
    expect(result.outcome.totalMatches).toBe(nativeCount)
    expect(result.outcome.truncated).toBe(true)
    expect(writes()).toBe(1)
    // every admitted row is in the payload (nothing is dropped by the window);
    // +1 line for the fixture's newline-bearing name, as pinned in P1.
    expect(text().split('\n')).toHaveLength(nativeCount + 1)
    expect(text()).toContain('bulk/b0000.ts')
    expect(text()).toContain('bulk/b0039.ts')
    parity('P11', 'overflow/Spill', native, result, 'inline window truncates honestly, spill keeps every admitted row', result.ok === true && result.outcome.truncated && result.outcome.totalMatches === nativeCount && text().split('\n').length === nativeCount + 1, nativeCount, result.ok === true ? result.outcome.matches.length : -1)
    // the buffered-bytes ceiling is a refusal, never a partial parse
    const tiny = row.createAnchoredRgSearchBackend({
      realmId: 'a5srgp-tiny',
      rootDir: BULK_ROOT,
      confined: confinedConf(BULK_WORLD),
      maxJsonBytes: 400,
      observe: () => {},
    })
    const before = tiny.execCount()
    const overflow = await runRow(tiny, searchCall('p11-overflow', { maxResults: 5 }))
    expect(overflow.result.ok).toBe(false)
    if (overflow.result.ok === false) expect(overflow.result.failure.code).toBe('output-too-large')
    expect(overflow.writes()).toBe(0)
    expect(tiny.execCount()).toBe(before + 1)
    // and the timeout arm is a CANCELLED settlement that writes nothing
    const patient = row.createAnchoredRgSearchBackend({
      realmId: 'a5srgp-patient',
      rootDir: BULK_ROOT,
      confined: confinedConf(BULK_WORLD),
      timeoutMs: 1,
      observe: () => {},
    })
    const cancelled = await runRow(patient, searchCall('p11-timeout'))
    if (cancelled.result.ok === true) {
      expect(cancelled.result.settlement.kind).toBe('cancelled')
      expect(cancelled.result.outcome.totalMatches).toBe(0)
      expect(cancelled.writes()).toBe(0)
    } else {
      // a refusal is also an acceptable answer at 1 ms (the walk never started);
      // what is NEVER acceptable is a partial write.
      expect(cancelled.writes()).toBe(0)
    }
  }, SLOW)
})

// ---------------------------------------------------------------------------
// M — the mount path: the plane's factory, both bodies
// ---------------------------------------------------------------------------

describe('M: the plane\'s search row mounts the rg body where a confined provider exists', () => {
  it('M1 with `confined`, the plane factory returns the rg row and answers like rg', async () => {
    const mounted = planeRow.createAnchoredSearchBackend({
      realmId: 'a5srgp-realm',
      rootDir: ROOT_DIR,
      observe: () => {},
      confined: confinedConf(WORLD),
    }) as SearchBackend
    expect(mounted.backendId).toBe(row.SEARCH_BACKEND_ID)
    const { result, writes } = await runRow(mounted, searchCall('m1', { outputMode: 'files_with_matches', maxResults: 500 }))
    expect(result.ok).toBe(true)
    if (result.ok !== true) return
    const found = relativize(ROOT_DIR, result.outcome.files)
    for (const excluded of SEARCH_EXCLUDED) expect(found, `${excluded} must not be searched`).not.toContain(excluded)
    expect(found).toContain('src/a.ts')
    expect(String(mounted.lastRuns.at(-1)?.argv ?? '')).toContain('--json')
    expect(mounted.execCount()).toBe(1)
    expect(writes()).toBe(1)
  }, SLOW)

  it('M2 without `confined`, the same factory keeps the grep port (the fsInstance-only mount loses nothing)', async () => {
    const mounted = planeRow.createAnchoredSearchBackend({
      realmId: 'a5srgp-realm',
      rootDir: ROOT_DIR,
      observe: () => {},
    }) as unknown as SearchBackend
    expect(mounted.backendId).toBe('a5g7-controlled-fs-anchored-grep')
    const { result } = await runRow(mounted, searchCall('m2', { outputMode: 'files_with_matches', maxResults: 500 }))
    expect(result.ok).toBe(true)
    if (result.ok !== true) return
    // the grep port's signature: it searches what rg's default law ignores
    expect(relativize(ROOT_DIR, result.outcome.files)).toContain('ignored/drop.ts')
  }, SLOW)

  it('M3 the delegated face is the plane\'s contract, not a new shape', () => {
    const mounted = planeRow.createAnchoredSearchBackend({
      realmId: 'a5srgp-realm', rootDir: ROOT_DIR, observe: () => {}, confined: confinedConf(WORLD),
    }) as unknown as Record<string, unknown>
    expect(Object.keys(mounted).sort()).toEqual(['backendId', 'execCount', 'lastRuns', 'lastStageTrace', 'run'])
    expect(typeof mounted.run).toBe('function')
    expect(typeof mounted.execCount).toBe('function')
  })

  it('M4 the SHIPPED face closes over its own import graph (the leg this line owed)', () => {
    // Why this leg exists, stated plainly: the master replay narrowed the byte-copy
    // list to the search row alone after asking "does the PLANE import the glob row?"
    // — the answer was no, so the copy was cut. The whole-tree census caught it
    // (`a5g6-install-face-render`, GLUE-6 LEG B, run 39114260882):
    // `Cannot find module './glob-backend.mjs' imported from dist/.../search-backend.mjs`.
    // The question had been aimed at the wrong importer: the SEARCH row imports the
    // anchored walk, and the plane imports the search row. So the law is closure over
    // the graph of every file the face ships, and this lane now walks that graph
    // itself instead of trusting a reading of one file's import list.
    const liveDirRel = 'packages/runtime/dist/packages/runtime/src/plugin/live'
    const queue = placedDistPaths().filter((rel) => rel.startsWith(liveDirRel))
    expect(queue.length).toBeGreaterThanOrEqual(2)
    const missing: string[] = []
    const seen = new Set<string>()
    while (queue.length > 0) {
      const rel = queue.shift() as string
      if (seen.has(rel)) continue
      seen.add(rel)
      const abs = join(REPO_ROOT, rel)
      if (!existsSync(abs)) {
        missing.push(`${rel}: named in the placement list, absent from the face`)
        continue
      }
      for (const target of faceImportsOf(abs)) {
        const faceRoot = join(REPO_ROOT, 'packages/runtime/dist')
        if (!target.startsWith(faceRoot + '/')) {
          missing.push(`${rel}: import escapes the shipped face (${relative(REPO_ROOT, target)})`)
          continue
        }
        if (!existsSync(target)) {
          missing.push(`${rel}: imports ${relative(join(REPO_ROOT, rel, '..'), target)}, which is not shipped`)
          continue
        }
        if (target.endsWith('.mjs')) queue.push(relative(REPO_ROOT, target))
      }
    }
    expect(missing, `shipped face is not import-closed: ${missing.join('; ')}`).toEqual([])
  })

  it('M5 the edge the census tripped on is pinned as a fact, not inferred', () => {
    // The delegation is a load-bearing FACE dependency, so it is pinned twice: the
    // row keeps importing the anchored walk by a RELATIVE in-face specifier (which is
    // what makes the byte-copy law apply to its target at all), and the placement
    // list carries that target. Break either half and the shipped row stops loading.
    const rowSrc = readFileSync(
      join(REPO_ROOT, 'packages/runtime/src/plugin/live/search-backend.mjs'), 'utf8')
    expect(rowSrc).toMatch(/from '\.\/glob-backend\.mjs'/)
    expect(placedDistPaths()).toContain(
      'packages/runtime/dist/packages/runtime/src/plugin/live/glob-backend.mjs')
  })
})

// ---------------------------------------------------------------------------
// V — the anchor / refusal laws (a refusal costs no process and no byte)
// ---------------------------------------------------------------------------

describe('V: the anchor law and the closed refusal face', () => {
  it('V1-V6 knobs and placements are refused BY NAME, before any child exists', async () => {
    const before = backend.execCount()
    const cases: Array<[unknown, string]> = [
      [searchCall('v1', { tool: 'glob' }), 'wrong-tool-for-backend'],
      [searchCall('v2', { multiline: true }), 'multiline-unsupported'],
      [searchCall('v3', { contextLines: 2 }), 'context-unsupported'],
      [searchCall('v6', { fixedString: true }), 'fixed-string-unsupported'],
      [searchCall('v7', { ignoreCase: true }), 'ignore-case-unsupported'],
      [searchCall('v4', { target: { placement: 'realm-home', locator: '~/notes' } }), 'placement-unsupported'],
    ]
    for (const [call, code] of cases) {
      const { result, writes } = await runRow(backend, call)
      expect(result.ok, code).toBe(false)
      if (result.ok === false) {
        expect(result.failure.code).toBe(code)
        expect(result.failure.class).toBe('denied')
        expect(result.failure.family).toBe('a5srgp-refused/pre-execute')
        // Refused by NAME: the prose is the table's, so no caller text echoes.
        expect(Object.values(row.SEARCH_REFUSAL_TEXT)).toContain(result.failure.detail)
      }
      expect(writes()).toBe(0)
    }
    expect(backend.execCount()).toBe(before)
  }, SLOW)

  it('V6b the two new refusals are a DISCLOSED capability delta, not an invisible one', async () => {
    // `fixed_string` and `ignore_case` ARE lane vocabulary
    // (`packages/tools/a5p5-tools/src/args.ts:148-149`) and the grep(1) port the
    // rg row replaces DOES honour them (`plane-effect-backends.mjs:120-122`
    // pushes `-F` / `-i`). The host's public ripgrep vocabulary has no arm for
    // either, so this row refuses rather than inventing a mapping. The delta is
    // pinned from BOTH sides here so nobody discovers it as a silent behaviour
    // change: the port answers, the rg row refuses by name.
    const portSource = readFileSync(join(REPO, 'packages/runtime/src/plugin/live/plane-effect-backends.mjs'), 'utf8')
    expect(portSource).toContain("if (parsed.fixedString) argv.push('-F')")
    expect(portSource).toContain("if (parsed.ignoreCase) argv.push('-i')")
    // And the encodings exist — which is exactly why the refusal has to be
    // deliberate rather than accidental. `(?i)` is answered by THIS walker; the
    // row does not use it.
    const viaEncoding = nativeSearchRg(rgPath, ROOT_DIR, ['--no-config', '--json', '--regexp=(?i)a5srgp-tok', '--no-ignore-parent', '--no-ignore-global', '--', '.'])
    expect(viaEncoding.code).toBe(0)
    expect(nativeJsonRows(viaEncoding).length).toBeGreaterThan(0)
    // The same pattern WITHOUT the encoding finds nothing (the fixture spells the
    // token in upper case), so `(?i)` would change the answer, not just its shape.
    const plain = nativeSearchRg(rgPath, ROOT_DIR, ['--no-config', '--json', '--regexp=a5srgp-tok', '--no-ignore-parent', '--no-ignore-global', '--', '.'])
    expect(nativeJsonRows(plain).length).toBe(0)
    // So the row's answer is the honest one: a named refusal, zero children.
    const before = backend.execCount()
    const { result } = await runRow(backend, searchCall('v6b', { pattern: 'a5srgp-tok', ignoreCase: true }))
    expect(result.ok).toBe(false)
    if (result.ok === false) expect(result.failure.code).toBe('ignore-case-unsupported')
    expect(backend.execCount()).toBe(before)
  }, SLOW)

  it('V5 an absolute target outside the governed root is refused (no child, no byte)', async () => {
    const before = backend.execCount()
    const { result, writes } = await runRow(backend, searchCall('v5', { target: { placement: 'absolute-path', locator: join(OUTSIDE_DIR, 'secret.txt') } }))
    expect(result.ok).toBe(false)
    if (result.ok === false) expect(result.failure.code).toBe('target-outside-governed-root')
    expect(writes()).toBe(0)
    expect(backend.execCount()).toBe(before)
  }, SLOW)

  it('V6/V7 an escaping symlinked FILE target is refused by name — where the native run leaks it', async () => {
    // native (unconfined) happily follows a command-line symlink and prints the
    // OUTSIDE file's content: this is the leak the row must not reproduce.
    const native = nativeSearchRg(rgPath, ROOT_DIR, nativeSearchArgv(SEARCH_TOK, { path: 'escape-link.txt' }))
    expect(native.code).toBe(0)
    expect(native.stdout).toContain('OUTSIDE')
    const before = backend.execCount()
    const { result, writes } = await runRow(backend, searchCall('v6', { target: { placement: 'workspace', locator: 'escape-link.txt' } }))
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(['walk-contaminated', 'symlink-alias']).toContain(result.failure.code)
      // the name of the outside object never comes back on the wire
      expect(JSON.stringify(result)).not.toContain('secret.txt')
      expect(JSON.stringify(result)).not.toContain(OUTSIDE_DIR)
    }
    expect(writes()).toBe(0)
    expect(backend.execCount()).toBe(before)
  }, SLOW)

  it('V8 a governed root that is a symlink alias is refused, never followed', async () => {
    const aliasWorld = newWorld('a5srgp-alias')
    try {
      const realRoot = join(aliasWorld, 'real')
      buildSearchFixture(realRoot)
      const alias = join(aliasWorld, 'alias')
      symlinkSync(realRoot, alias, 'dir')
      // The root itself is fine; the LAW is exercised by pointing the row at a
      // root whose last component is a symlink to a directory OUTSIDE the
      // lexical root it would otherwise govern.
      const outsideTarget = join(aliasWorld, 'target')
      buildOutside(outsideTarget)
      const symlinkedRoot = join(aliasWorld, 'root-sym')
      symlinkSync(outsideTarget, symlinkedRoot, 'dir')
      const aliased = row.createAnchoredRgSearchBackend({
        realmId: 'a5srgp-alias',
        rootDir: symlinkedRoot,
        confined: confinedConf(aliasWorld),
        observe: () => {},
      })
      const { result } = await runRow(aliased, searchCall('v8'))
      expect(result.ok).toBe(false)
      if (result.ok === false) expect(aliased.execCount()).toBe(0)
      if (result.ok === false) expect(result.failure.code).toBe('root-symlink-alias')
    } finally {
      await destroyWorldVerified(aliasWorld)
      rmSync(aliasWorld, { recursive: true, force: true })
    }
  }, SLOW)

  it('V9 the refusal grammar holds for every answer this row can give', async () => {
    const table = refusalCodeSet(row)
    const families = new Set(Object.values(row.SEARCH_REFUSAL_FAMILIES))
    const calls: unknown[] = [
      searchCall('g1', { tool: 'glob' }),
      searchCall('g2', { pattern: '' }),
      searchCall('g3', { target: { placement: 'realm-home', locator: '~' } }),
      searchCall('g4', { target: { placement: 'workspace', locator: '../../etc' } }),
      searchCall('g5', { target: { placement: 'workspace', locator: 'nope/nope.ts' } }),
      searchCall('g6', { target: { placement: 'workspace', locator: 'src' }, contextLines: 1 }),
      searchCall('g7', { pattern: '(' }),
      searchCall('g8', { target: { placement: 'workspace', locator: 'escape-link.txt' } }),
      { realmId: 'x', callId: 'g9' },
      { realmId: 'x', callId: 'g10', parsedArgs: null },
      { realmId: 'x', callId: 'g11', parsedArgs: { tool: 'grep' } },
      { realmId: 'x', callId: 'g12', parsedArgs: { tool: 'grep', pattern: SEARCH_TOK, target: 'a-string-not-an-object' } },
    ]
    for (const call of calls) {
      const { result } = await runRow(backend, call)
      if (result.ok === true) continue // some of these are legitimate answers
      expect(['denied', 'hidden', 'undetermined']).toContain(result.failure.class)
      expect(table.has(result.failure.code), `code ${result.failure.code} is not in the table`).toBe(true)
      expect(families.has(result.failure.family)).toBe(true)
      expect(result.failure.family).toMatch(/^a5srgp-refused\/[a-z-]+$/)
      expect(result.failure.detail).toBe(row.SEARCH_REFUSAL_TEXT[result.failure.code])
      for (const [k, v] of Object.entries(result.failure.counts)) {
        expect(Number.isInteger(v), `count ${k} is not an integer`).toBe(true)
      }
    }
  }, SLOW)

  it('V10 run() NEVER throws: the malformed-call battery all lands on a closed refusal', async () => {
    const junk: unknown[] = [undefined, null, {}, { parsedArgs: {} }, { parsedArgs: { tool: 'grep', pattern: 42, target: { placement: 7 } } }, { parsedArgs: { tool: 'grep', pattern: SEARCH_TOK, target: { placement: 'workspace', locator: '.' }, maxResults: 'not-a-number' } }]
    for (const call of junk) {
      const result = await backend.run(call, { sink: { write: () => { throw new Error('a sink must never be reached') } } })
      expect(result).toBeTypeOf('object')
      if (result.ok !== true) expect(typeof result.failure.code).toBe('string')
    }
  }, SLOW)

  it('V11 A3: an anchor whose object is gone is UNDETERMINABLE, never a silent answer', async () => {
    // The target lives INSIDE the governed root — that is what a workspace
    // locator names; the law under test is what happens to an already-open
    // anchor when that object is removed afterwards.
    const doomed = join(ROOT_DIR, 'doomed')
    mkdirSync(doomed, { recursive: true })
    writeFileSync(join(doomed, 'x.txt'), `${SEARCH_TOK}\n`)
    const globRow = (await import(new URL('../src/plugin/live/glob-backend.mjs', import.meta.url).href)) as unknown as {
      openAnchoredWalkRoot(root: string, target: unknown, debug?: unknown): Promise<unknown>
      verifyGlobResultsBeneath(anchor: unknown, entries: readonly string[], debug?: unknown): Promise<unknown>
    }
    const anchor = await globRow.openAnchoredWalkRoot(ROOT_DIR, { placement: 'workspace', locator: 'doomed' }) as { ok: boolean; handle?: { close(): Promise<void>; fd: number } }
    expect(anchor.ok).toBe(true)
    // MEASURED division of labour between the two post-walk arms: the shared
    // law's EMPTY-list arm re-checks the view, the anchor inode and the ROOT — but
    // an unlinked directory keeps its inode and a `/proc/self/fd` view, so it
    // passes (asserted below). The row's own A3 arm, which resolves the view,
    // notices. Both run, because each catches what the other cannot; V11b is the
    // case only the shared arm catches.
    const sharedBefore = await globRow.verifyGlobResultsBeneath(anchor, []) as { ok: boolean }
    expect(sharedBefore.ok).toBe(true)
    const rowBefore = await row.verifyAnchorStillGoverned(anchor)
    expect(rowBefore.verdict).toBe('confirmed')
    rmSync(doomed, { recursive: true, force: true })
    const sharedAfter = await globRow.verifyGlobResultsBeneath(anchor, []) as { ok: boolean }
    expect(sharedAfter.ok).toBe(true) // the measured blind spot of that arm alone
    const after = await row.verifyAnchorStillGoverned(anchor) as { verdict: string; detail?: string }
    expect(['undeterminable', 'escape', 'drift']).toContain(after.verdict)
    expect(after.verdict).not.toBe('confirmed')
    await anchor.handle?.close().catch(() => undefined)
  })

  it('V11b the ROOT-IDENTITY arm covers a directory walk: a swapped governed root is refused, never an empty answer', async () => {
    // The arm an anchor-inode check cannot see. The pinned anchor is still exactly
    // the object the walk ran under while the governed ROOT it was taken under has
    // been replaced underneath it — the answer then belongs to a directory the row
    // never anchored. Before this round a directory target re-checked only the
    // anchor, so this is the gap the review named; the row now runs the shared
    // verifier for both target kinds.
    const swapped = newWorld('a5srgp-rootswap')
    try {
      const root = join(swapped, 'root')
      mkdirSync(join(root, 'src'), { recursive: true })
      writeFileSync(join(root, 'src', 'a.txt'), SEARCH_TOK + ' one\n')
      const globRow = (await import(new URL('../src/plugin/live/glob-backend.mjs', import.meta.url).href)) as unknown as {
        openAnchoredWalkRoot(root: string, target: unknown, debug?: unknown): Promise<unknown>
        verifyGlobResultsBeneath(anchor: unknown, entries: readonly string[], debug?: unknown): Promise<unknown>
      }
      const anchor = await globRow.openAnchoredWalkRoot(root, { placement: 'workspace', locator: 'src' }) as { ok: boolean; handle?: { close(): Promise<void> } }
      expect(anchor.ok).toBe(true)
      expect((await globRow.verifyGlobResultsBeneath(anchor, []) as { ok: boolean }).ok).toBe(true)
      // Replace the governed root with a DIFFERENT object at the same path.
      rmSync(root, { recursive: true, force: true })
      mkdirSync(root, { recursive: true })
      const after = await globRow.verifyGlobResultsBeneath(anchor, []) as { ok: boolean; failure?: { class?: string; code?: string; family?: string } }
      expect(after.ok).toBe(false)
      expect(after.failure?.code).toBe('root-drift')
      // The shared law's own family word; the ROW re-wraps it into this row's
      // table, which is what the wire sees (leg V11f).
      expect(after.failure?.family).toBe('a5glb-refused/anchor-identity')
      await anchor.handle?.close().catch(() => undefined)
    } finally {
      await destroyWorldVerified(swapped)
      rmSync(swapped, { recursive: true, force: true })
    }
  }, SLOW)

  it('V11c a kernel-refused file is a REFUSAL, never a silent "no matches" — the coverage law, live', async () => {
    // The reachable shape of the whole-walk refusal, live on the confined face: a
    // file inside the walked tree the walker cannot open. The walker COMPLETES
    // (`summary` present, zero match records) and prints
    // `rg: ./src/unreadable.ts: Permission denied (os error 13)`. Answering `ok`
    // there would tell the model the token is absent from a file that was never
    // opened — the same class of lie as the silent-zero stdin case, arriving from
    // the other direction.
    const blocked = join(ROOT_DIR, 'src', 'unreadable.ts')
    writeFileSync(blocked, SEARCH_TOK + ' unreadable\n')
    chmodSync(blocked, 0o000)
    try {
      const before = backend.execCount()
      const res = await runRow(backend, searchCall('v11c', { maxResults: 500 }))
      expect(res.result.ok).toBe(false)
      if (res.result.ok === false) {
        expect(res.result.failure.code).toBe('walker-permission-refused')
        expect(res.result.failure.family).toBe('a5srgp-refused/walker')
        expect(res.result.failure.class).toBe('undetermined')
        expect(res.result.failure.detail)
          .toBe('ripgrep could not read the searched path \u2014 an empty answer here would be a refusal, not a fact')
        expect(Number.isFinite(res.result.failure.counts.stderrBytes ?? Number.NaN)).toBe(true)
      }
      expect(res.text()).toBe('')
      // It DID execute — the refusal is about the answer's honesty, not the spawn.
      expect(backend.execCount()).toBe(before + 1)
    } finally {
      chmodSync(blocked, 0o644)
      rmSync(blocked, { force: true })
    }
  }, SLOW)

  it('V11d the coverage law reads the CLASS of a walker error, never its text, and upward noise is a different class', () => {
    const coverage = (row as unknown as { walkerCoverageRefusal(stderr: string): string | null }).walkerCoverageRefusal
    // A walk refused end to end, and the partial form: both are refusals.
    expect(coverage('rg: .: Permission denied (os error 13)\n')).toBe('walker-permission-refused')
    expect(coverage('rg: ./src/a.ts: Permission denied (os error 13)\n')).toBe('walker-permission-refused')
    // rg's upward discovery of a parent `.git` it cannot read — measured on EVERY
    // walk in this world (probes legs A/C/D/F, always an ABSOLUTE path). It is a
    // fact about the host above the governed root, never about this answer, so it
    // must not turn a completed walk into a refusal either.
    expect(coverage('rg: /srv/somewhere/.git: Permission denied (os error 13)\n')).toBe(null)
    // Not a permission refusal is not this law's business (the walker's own error
    // law and the completion law stay single-owned).
    expect(coverage('')).toBe(null)
    expect(coverage('rg: ./weird: Is a directory (os error 21)\n')).toBe(null)
    expect(refusalCodeSet(row).has('walker-permission-refused')).toBe(true)
  })

  it('V11e the coverage law is applied AFTER completion and BEFORE any record is trusted', () => {
    // Source law: the coverage refusal sits between the completion check and the
    // record reader, and it cannot write to a channel.
    const src = readFileSync(join(REPO, 'packages/runtime/src/plugin/live/search-backend.mjs'), 'utf8')
    const completion = src.indexOf('anchored-search WALKER-INCOMPLETE')
    const coverageAt = src.indexOf('const coverage = walkerCoverageRefusal(stderrText)')
    const parseAt = src.indexOf('parseGrepMatches(stdout)')
    expect(completion).toBeGreaterThan(-1)
    expect(coverageAt).toBeGreaterThan(completion)
    expect(parseAt).toBeGreaterThan(coverageAt)
    const block = src.slice(coverageAt, coverageAt + 700)
    expect(block).toContain("failure('undetermined', coverage")
    expect(block).not.toContain('sink')
    // And the shared root-identity verifier is what BOTH target kinds re-check
    // against after the walk — the empty list is the directory case.
    // Both post-walk arms are present, and the shared one is what gives a
    // DIRECTORY target its root-identity re-check (the empty entry list).
    expect(src).toContain('verifyGlobResultsBeneath(anchor, fileTarget === null ? [] : [fileTarget], debug)')
    expect(src).toContain('await verifyAnchorStillGoverned(anchor)')
  })

  it('V11f a shared-law verification refusal arrives in THIS row\u2019s vocabulary, not the glob row\u2019s', async () => {
    // The row re-wraps every shared-law refusal, so the plane sees one refusal
    // vocabulary. Proven at the only reachable point: an anchored directory whose
    // verification fails after the walk would be re-wrapped — here the reachable
    // pre-spawn path is measured instead, because it is the same code path.
    const outside = await runRow(backend, searchCall('v11f', { target: { placement: 'workspace', locator: '../../../etc' } }))
    expect(outside.result.ok).toBe(false)
    if (outside.result.ok === false) {
      expect(outside.result.failure.family.startsWith('a5srgp-refused/')).toBe(true)
    }
    const escape = await runRow(backend, searchCall('v11f2', { target: { placement: 'absolute-path', locator: '/etc/passwd' } }))
    expect(escape.result.ok).toBe(false)
    if (escape.result.ok === false) {
      expect(escape.result.failure.family).toBe('a5srgp-refused/verification')
      expect(escape.result.failure.code).toBe('target-outside-governed-root')
    }
  })

  it('V12 the audit face carries codes and arithmetic only — never a path, a row or the walker\'s words', async () => {
    const lines: string[] = []
    const watched = row.createAnchoredRgSearchBackend({
      realmId: 'a5srgp-watch',
      rootDir: ROOT_DIR,
      confined: confinedConf(WORLD),
      observe: (line: string) => { lines.push(line) },
    })
    await runRow(watched, searchCall('w1', { outputMode: 'files_with_matches', maxResults: 500 }))
    await runRow(watched, searchCall('w2', { pattern: '(' }))
    await runRow(watched, searchCall('w3', { target: { placement: 'workspace', locator: 'escape-link.txt' } }))
    expect(lines.length).toBeGreaterThan(2)
    for (const line of lines) {
      expect(line, line).not.toContain(ROOT_DIR)
      expect(line, line).not.toContain('src/a.ts')
      expect(line, line).not.toContain('regex parse error')
      expect(line, line).not.toContain(OUTSIDE_DIR)
      expect(line, line).not.toContain(SEARCH_TOK)
    }
  }, SLOW)
})
