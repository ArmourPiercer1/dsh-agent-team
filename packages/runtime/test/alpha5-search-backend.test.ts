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
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
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
    expect(built).toEqual(['--no-config', '--json', `--regexp=${SEARCH_TOK}`, '--no-messages', '--no-ignore-parent', '--no-ignore-global', '--', '.'])
  })

  it('argv-law/include: the lane filter rides the host\'s own --glob= form', () => {
    const built = row.searchArgv({ pattern: 'a(b', globFilter: '*.ts' })
    expect(built).toEqual(nativeSearchArgv('a(b', { include: '*.ts' }))
    expect(built).toEqual(['--no-config', '--json', '--regexp=a(b', '--glob=*.ts', '--no-messages', '--no-ignore-parent', '--no-ignore-global', '--', '.'])
  })

  it('argv-additions: every addition is a --no-* law switch, never a value-taking knob', () => {
    expect(row.SEARCH_ARGV_ADDITIONS).toEqual(['--no-messages', '--no-ignore-parent', '--no-ignore-global'])
    for (const addition of row.SEARCH_ARGV_ADDITIONS) expect(addition.startsWith('--no-')).toBe(true)
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
    const control = nativeSearchRg(rgPath, ROOT_DIR, ['--no-config', '--json', `--regexp=${SEARCH_TOK}`, '--no-ignore', '--hidden', '--no-messages', '--no-ignore-parent', '--no-ignore-global', '--', '.'])
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
    const text = nativeSearchRg(rgPath, ROOT_DIR, ['--no-config', '--json', `--regexp=${SEARCH_TOK}`, '--text', '--no-messages', '--no-ignore-parent', '--no-ignore-global', '--', 'src/BINARY.bin'])
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
})

// ---------------------------------------------------------------------------
// V — the anchor / refusal laws (a refusal costs no process and no byte)
// ---------------------------------------------------------------------------

describe('V: the anchor law and the closed refusal face', () => {
  it('V1-V4 knobs and placements are refused BY NAME, before any child exists', async () => {
    const before = backend.execCount()
    const cases: Array<[unknown, string]> = [
      [searchCall('v1', { tool: 'glob' }), 'wrong-tool-for-backend'],
      [searchCall('v2', { multiline: true }), 'multiline-unsupported'],
      [searchCall('v3', { contextLines: 2 }), 'context-unsupported'],
      [searchCall('v4', { target: { placement: 'realm-home', locator: '~/notes' } }), 'placement-unsupported'],
    ]
    for (const [call, code] of cases) {
      const { result, writes } = await runRow(backend, call)
      expect(result.ok, code).toBe(false)
      if (result.ok === false) {
        expect(result.failure.code).toBe(code)
        expect(result.failure.class).toBe('denied')
        expect(result.failure.family).toBe('a5srgp-refused/pre-execute')
      }
      expect(writes()).toBe(0)
    }
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
    const before = await row.verifyAnchorStillGoverned(anchor)
    expect(before.verdict).toBe('confirmed')
    rmSync(doomed, { recursive: true, force: true })
    const after = await row.verifyAnchorStillGoverned(anchor)
    expect(['undeterminable', 'escape', 'drift']).toContain(after.verdict)
    expect(after.verdict).not.toBe('confirmed')
    await anchor.handle?.close().catch(() => undefined)
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
