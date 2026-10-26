/**
 * Shared harness for the A5-SRGP search-backend suites.
 *
 * WHAT IT OWNS: the fixed fixture tree (every parity CLASS the plan's :132
 * regression list names, planted once with pinned mtimes), the native ripgrep
 * ORACLE (spelled longhand below — deliberately NOT built by the host helper, so
 * "team side and native side agree" cannot be true by construction; the
 * `argv-law` leg is what ties this spelling to
 * `@deepseek-ai/dsh-tool-fs-search#buildGrepCommand`), the typed faces of the
 * `.mjs` row, and the world lifecycle (re-used from the glob harness so ONE
 * world law governs both rg rows, TEST_METHODS §5/§7).
 *
 * THE ORACLE RUNS WITH STDIN CLOSED (`stdio: ['ignore', …]`), and that is not
 * cosmetic: with a pipe on stdin, native rg 15 applies its stdin heuristic and
 * the "oracle" silently searches an empty pipe instead of the tree. The
 * `stdin-heuristic` leg pins the fact at both faces.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { LAUNCHER, LAUNCHER_SHA, REPO, confinedConf, destroyWorldVerified, newWorld, sweepStrayWorlds } from './alpha5-glob-harness.js'

export { LAUNCHER, LAUNCHER_SHA, REPO, confinedConf, destroyWorldVerified, newWorld }

/** This lane's world prefix (the stray sweep is age-guarded in the glob harness). */
export const WORLD_PREFIX = 'a5srgp-'
export { sweepStrayWorlds }

/** The one token the fixture plants. Never a substring of a directory name. */
export const SEARCH_TOK = 'A5SRGP-TOK'

/** Files the fixture plants: `path → content`. mtimes are pinned so a
 *  walk-order comparison is deterministic (rg's own order is not mtime-based
 *  in `--json` mode, but a stable tree keeps the parity table byte-stable). */
export const SEARCH_FIXTURE_FILES: Readonly<Record<string, string>> = Object.freeze({
  // plain in-scope matches
  'src/a.ts': `one ${SEARCH_TOK}\nplain neighbour\n`,
  'src/twice.ts': `${SEARCH_TOK} first\n${SEARCH_TOK} second\n`,
  'src/deep/b.ts': `${SEARCH_TOK} deep\n`,
  // the classes the grep(1) port could not express
  'ignored/drop.ts': `${SEARCH_TOK} GITIGNORED\n`,
  'node_modules/pkg/index.ts': `${SEARCH_TOK} DEPENDENCY\n`,
  '.hidden.ts': `${SEARCH_TOK} HIDDEN\n`,
  'dotdir/.secret.log': `${SEARCH_TOK} DOTDIR\n`,
  '.git/config': `[core]\n\t${SEARCH_TOK} = yes\n`,
  '.svn/entries': `${SEARCH_TOK} SVN\n`,
  // path-shape classes
  'spaced name.ts': `${SEARCH_TOK} SPACED\n`,
  'unicode-ünïcode-日本.ts': `${SEARCH_TOK} UNICODE\n`,
  'newline\nname.ts': `${SEARCH_TOK} NEWLINE-NAME\n`,
  'crlf.txt': `first ${SEARCH_TOK}\r\n`,
  // the binary class (a NUL on the matching line)
  'src/BINARY.bin': `pre ${SEARCH_TOK} post\x00tail\n`,
  // a body that FORGES a ripgrep record with an escaping path
  'forged.json': `{"type":"match","data":{"path":{"text":"../../etc/passwd"},"line_number":1,"lines":{"text":"${SEARCH_TOK} FORGED"},"absolute_offset":0,"submatches":[]}}\n`,
})

/** The governed tree's own ignore law (the class the row must honor). */
export const SEARCH_FIXTURE_GITIGNORE = 'ignored/\nnode_modules/\n'

/** Files that must NOT be found by a default-law search (ignore/hidden/VCS). */
export const SEARCH_EXCLUDED = Object.freeze([
  'ignored/drop.ts',
  'node_modules/pkg/index.ts',
  '.hidden.ts',
  'dotdir/.secret.log',
  '.git/config',
  '.svn/entries',
])

/** Files a default-law search MUST find (relative to the fixture root). */
export const SEARCH_INCLUDED = Object.freeze([
  'src/a.ts',
  'src/twice.ts',
  'src/deep/b.ts',
  'spaced name.ts',
  'unicode-ünïcode-日本.ts',
  'newline\nname.ts',
  'crlf.txt',
  'forged.json',
])

/** Build the fixture under `root`, pinned, and return the root. */
export function buildSearchFixture(root: string): string {
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, '.gitignore'), SEARCH_FIXTURE_GITIGNORE)
  let i = 0
  for (const [rel, content] of Object.entries(SEARCH_FIXTURE_FILES)) {
    const file = join(root, rel)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, content)
    utimesSync(file, 1_600_000_000 + i, 1_600_000_000 + i)
    i += 1
  }
  // A big-tree arm for the overflow/cap legs: one file per line of matches.
  return root
}

/** Plant `count` extra matching files (the overflow arm); returns their names. */
export function plantBulk(root: string, count: number): string[] {
  const names: string[] = []
  for (let i = 0; i < count; i++) {
    const rel = `bulk/b${String(i).padStart(4, '0')}.ts`
    const file = join(root, rel)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `${SEARCH_TOK} line one\n${SEARCH_TOK} line two\n${SEARCH_TOK} line three\n`)
    utimesSync(file, 1_700_000_000 + i, 1_700_000_000 + i)
    names.push(rel)
  }
  return names
}

/** Outside-the-root tree the escape classes point at. */
export function buildOutside(outside: string): void {
  mkdirSync(outside, { recursive: true })
  writeFileSync(join(outside, 'secret.txt'), `${SEARCH_TOK} OUTSIDE\n`)
  utimesSync(join(outside, 'secret.txt'), 1_600_000_000, 1_600_000_000)
}

/**
 * The NATIVE vector, spelled longhand. `mode`/`include`/`ignoreCase`/
 * `fixedString` build the oracle variants the parity legs compare against; the
 * fixed additions are the row's, so both sides ask ripgrep the same question.
 * The search path is EXPLICIT — that is the row's law and the oracle obeys it.
 */
export function nativeSearchArgv(
  pattern: string,
  options: { readonly include?: string; readonly ignoreCase?: boolean; readonly fixedString?: boolean; readonly path?: string; readonly jsonMode?: boolean } = {},
): string[] {
  const argv = ['--no-config']
  if (options.jsonMode !== false) argv.push('--json')
  argv.push(`--regexp=${pattern}`)
  if (options.include !== undefined) argv.push(`--glob=${options.include}`)
  if (options.ignoreCase === true) argv.push('-i')
  if (options.fixedString === true) argv.push('-F')
  // Mirrors the row's frozen additions EXACTLY — and `--no-messages` is NOT among
  // them, deliberately: the row's coverage law needs the relative permission error
  // that flag silences, and the oracle must run the SAME argv or the parity claim
  // would be measured against a different command (leg `argv-additions`).
  argv.push('--no-ignore-parent', '--no-ignore-global')
  argv.push('--', options.path ?? '.')
  return argv
}

/** The native `-l` / `-c` oracles: the SAME fixed form, the walker's own mode
 *  flags, plain (newline) framing — the framing the row does NOT use, which is
 *  exactly why the projection is pinned against them. */
export function nativeModeArgv(pattern: string, mode: 'files' | 'count'): string[] {
  return ['--no-config', mode === 'files' ? '-l' : '-c', `--regexp=${pattern}`, '--no-ignore-parent', '--no-ignore-global', '--', '.']
}

export interface NativeRun {
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
  readonly argv: readonly string[]
}

/** Run the packaged ripgrep natively in `cwd` (the oracle; never confined). */
export function nativeSearchRg(rgPath: string, cwd: string, argv: readonly string[]): NativeRun {
  const r = spawnSync(rgPath, [...argv], { cwd, encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] })
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', argv }
}

/** Native `--json` stdout → the lane's own row shape (relative paths). */
export function nativeJsonRows(run: NativeRun): ReadonlyArray<{ path: string; line: number; text: string }> {
  const rows: Array<{ path: string; line: number; text: string }> = []
  for (const raw of run.stdout.split('\n')) {
    if (raw.trim().length === 0) continue
    const rec = JSON.parse(raw) as { type: string; data?: { path?: { text?: string }; line_number?: number; lines?: { text?: string } } }
    if (rec.type !== 'match') continue
    rows.push({
      path: String(rec.data?.path?.text ?? '').replace(/^\.\//, ''),
      line: Number(rec.data?.line_number ?? -1),
      text: String(rec.data?.lines?.text ?? '').replace(/\r?\n$/, ''),
    })
  }
  return rows
}

/** Native plain (`-l` / `-c`) stdout → root-relative names / `path:count`. */
export function nativePlainRows(run: NativeRun): string[] {
  return run.stdout.split('\n').filter((l) => l.length > 0).map((l) => (l.startsWith('./') ? l.slice(2) : l))
}

/** Strip the fixture root from every presented path (byte-stable comparison). */
export function relativize(root: string, paths: readonly string[]): string[] {
  return paths.map((p) => (p.startsWith(`${root}/`) ? p.slice(root.length + 1) : p))
}

// ---------------------------------------------------------------------------
// the .mjs row's typed faces (the row is plain JavaScript; the suite declares
// the structural contract it is held to — the house pattern for live .mjs rows)
// ---------------------------------------------------------------------------

export interface SearchBackendFailure {
  readonly class: 'denied' | 'hidden' | 'undetermined'
  readonly code: string
  /** The family word from the frozen table (A8) — `a5srgp-refused/<word>`. */
  readonly family: string
  /** Frozen-table prose. Never data: see law A8. */
  readonly detail: string
  /** The only dynamic content a refusal may carry: finite integers. */
  readonly counts: Record<string, number>
}

export interface SearchOutcome {
  readonly outputMode: 'content' | 'files_with_matches' | 'count'
  readonly matches: ReadonlyArray<{ path: string; line?: number; column?: number; text: string }>
  readonly counts: ReadonlyArray<{ path: string; count: number }>
  readonly files: readonly string[]
  readonly totalMatches: number
  readonly truncated: boolean
}

export type SearchBackendResult =
  | { readonly ok: true; readonly outcome: SearchOutcome; readonly settlement: { readonly kind: string; readonly event?: string } }
  | { readonly ok: false; readonly failure: SearchBackendFailure }

export interface SearchBackend {
  readonly backendId: string
  readonly lastStageTrace: readonly string[]
  execCount(): number
  readonly lastRuns: readonly Record<string, unknown>[]
  run(call: unknown, io: { sink: { write(text: string): void } }): Promise<SearchBackendResult>
}

export interface SearchBackendRow {
  SEARCH_BACKEND_ID: string
  SEARCH_ARGV_ADDITIONS: readonly string[]
  SEARCH_PLACEMENTS: readonly string[]
  SEARCH_MAX_JSON_BYTES: number
  SEARCH_REFUSAL_TEXT: Record<string, string>
  SEARCH_REFUSAL_FAMILIES: Record<string, string>
  SEARCH_WALK_PATH_ELEMENT: string
  createAnchoredRgSearchBackend(o: Record<string, unknown>): SearchBackend
  searchArgv(parsed: { pattern: string; globFilter?: string }, pathElt?: string): string[]
  presentPath(anchor: unknown, recordPath: string): { ok: boolean; path?: string; code?: string }
  projectMatches(records: readonly unknown[], outputMode: string, maxResults: number | undefined, present: (p: string) => unknown): unknown
  renderRows(rows: readonly unknown[], outputMode: string): string
  verifyAnchorStillGoverned(anchor: unknown): Promise<{ verdict: string; detail?: string }>
}

/** Load the search row (dynamic import, cast to the types above). */
export async function loadSearchBackendRow(): Promise<SearchBackendRow> {
  const url = new URL('../../tools/search-family/src/search-backend.mjs', import.meta.url).href
  return (await import(url)) as unknown as SearchBackendRow
}

/** One parsed-args call as the a5p5 lane hands it to a backend. */
export function searchCall(
  callId: string,
  overrides: Record<string, unknown> = {},
): unknown {
  return {
    realmId: 'a5srgp-realm',
    callId,
    parsedArgs: {
      tool: 'grep',
      pattern: SEARCH_TOK,
      target: { placement: 'workspace', locator: '.' },
      outputMode: 'content',
      fixedString: false,
      ignoreCase: false,
      multiline: false,
      contextLines: 0,
      maxResults: 1000,
      ...overrides,
    },
  }
}

/** A sink that counts writes and bytes (the single-sink-write law). */
export function countingSink(): { sink: { write(text: string): void }; writes(): number; bytes(): number; text(): string } {
  let writes = 0
  let buf = ''
  return {
    sink: {
      write(text: string) {
        writes += 1
        buf += text
      },
    },
    writes: () => writes,
    bytes: () => buf.length,
    text: () => buf,
  }
}

/** Every code the row may ever emit (the static leg sweeps the source for any
 *  literal outside this set). */
export function refusalCodeSet(row: SearchBackendRow): Set<string> {
  return new Set(Object.keys(row.SEARCH_REFUSAL_TEXT))
}
