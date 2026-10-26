/**
 * U6 PR5 — the SEARCH-class golden-vector corpus as ONE generator with the
 * projection face INJECTED (the PR2/PR3 precedent, u6-pr2-golden-corpus.mts
 * / u6-pr3-golden-corpus.mts). Nothing here imports at runtime: the master
 * worktree imports THIS file cross-tree and records master's answers; the
 * moved tree feeds the SAME vectors through the SAME names and the digest
 * must stand. Pure DATA + pure calls: no fs, no clocks, no randomness.
 *
 * DISCLOSED SHAPE DIFFERENCE from PR2/PR3 (do not hide it): master has NO
 * `canonicalizeOperation('grep'|'glob')` case (the slice plan's line
 * "canonical-operation.ts case 'search' :784-796" cites PRE-SURGERY
 * numbering — at this base the file carries no such case; grep/glob are
 * outside the A2 frozen permission vocabulary and answer the closed
 * `tool-unsupported` refusal, while permission-coverage maps both names to
 * the `fsSearch` CLASS LABEL). operation-permission/** is on the PROTECTED
 * center set, so this gate pins what is OBSERVABLE of the search surface
 * from master and proves the move did not move one byte of it:
 *
 *   GROUP `authority`      — canonicalizeOperation over EVERY search arg
 *                            shape and every spelling: the exact refusal
 *                            code/reason/detail bytes (durable approvals
 *                            keyed by this fingerprint never re-address);
 *   GROUP `coverage`       — classifyPermissionCoverageTool over the pinned
 *                            facts face: the fsSearch CLASS label survives
 *                            byte-identically, and `coverage-eval` —
 *                            evaluatePermissionCoverage over pinned
 *                            surfaces — the whole closed verdict;
 *   GROUP `lane-parse`     — the a5p5 row-argument contract (parseGrepArgs/
 *                            parseGlobArgs) over the raw grid: the input
 *                            shape the moved argv builders consume;
 *   GROUP `search-argv` /  — searchArgv / grepArgv (the W5 port) / globArgv:
 *        `w5-argv` /          the exact bytes the rows put ON THE WIRE
 *        `glob-argv`          (the native-behavior contract, WRITE side,
 *                             §10.5-5 — rg vocabulary, additions, framing);
 *   GROUP `walk-parse`     — parseWalkOutput over adversarial NUL-framed
 *                            streams (the contract's READ side);
 *   GROUP `present-path`   — presentPath over adversarial record paths;
 *   GROUP `project`        — projectMatches: the three output modes, the
 *                            window arithmetic, the refusal shapes;
 *   GROUP `cov-refusal`    — walkerCoverageRefusal over stderr fixtures:
 *                            the coverage law's classifier bytes.
 *
 * Classes: unicode (NFC/NFD, CJK, astral, RTL, zero-width, NBSP), glob/regex
 * metacharacter soup (every metachar class, unbalanced braces/classes,
 * extglob-looking forms), path shapes (absolute, relative, `..`, dotfile,
 * trailing slash, backslash, newline-in-name, empty), pattern↔path
 * PAIRINGS (a pattern that is path-shaped, a path that is pattern-shaped),
 * every typed knob's type edge and out-of-range, record-stream adversarial
 * shapes, and 64KiB-class long inputs.
 */

/** Argument SHAPES for the grep row, in the RAW lane vocabulary (the shape
 *  `parseGrepArgs` accepts — closed keys: pattern/path/glob/output_mode/
 *  fixed_string/ignore_case/multiline/context/max_results). */
export const GREP_RAW: readonly { readonly label: string; readonly args: Record<string, unknown> }[] = [
  { label: 'basic', args: { pattern: 'TODO', path: '.' } },
  { label: 'absolute-path', args: { pattern: 'TODO', path: '/srv/workspace/ds h/notes.md' } },
  { label: 'subdir', args: { pattern: 'needle', path: 'src/deep/dir' } },
  { label: 'dotdot', args: { pattern: 'x', path: '../outside' } },
  { label: 'dotfile', args: { pattern: 'x', path: '.hidden/file.txt' } },
  { label: 'trailing-slash', args: { pattern: 'x', path: 'dir/' } },
  { label: 'fs-root', args: { pattern: 'x', path: '/' } },
  { label: 'empty-path', args: { pattern: 'x', path: '' } },
  { label: 'regex-class', args: { pattern: '^[a-z]+\\.(t|j)sx?$', path: 'src' } },
  { label: 'regex-anchor-soup', args: { pattern: 'a$|b^|(?i)x', path: '.' } },
  { label: 'regex-empty', args: { pattern: '', path: '.' } },
  { label: 'unicode-nfc', args: { pattern: 'café', path: 'café/文件.txt' } },
  { label: 'unicode-nfd', args: { pattern: 'cafe\u0301', path: 'cafe\u0301/doc.txt' } },
  { label: 'unicode-astral', args: { pattern: '😀', path: '😀/x' } },
  { label: 'unicode-rtl', args: { pattern: 'مرحبا', path: 'عربي/ملف.txt' } },
  { label: 'unicode-zerowidth', args: { pattern: 'a\u200Bb', path: 'x\u200By' } },
  { label: 'unicode-nbsp', args: { pattern: 'a\u00A0b', path: 'p\u00A0q' } },
  { label: 'newline-name', args: { pattern: 'x', path: 'weird\nname.txt' } },
  { label: 'cr-name', args: { pattern: 'x', path: 'a\rb' } },
  { label: 'backslash-name', args: { pattern: 'x', path: 'win\\path\\file.txt' } },
  { label: 'dash-pattern', args: { pattern: '--version', path: '.' } },
  { label: 'dash-path', args: { pattern: 'x', path: '-rf' } },
  { label: 'nul-in-pattern', args: { pattern: 'a\u0000b', path: '.' } },
  { label: 'modes-content', args: { pattern: 'x', path: '.', output_mode: 'content' } },
  { label: 'modes-files', args: { pattern: 'x', path: '.', output_mode: 'files_with_matches' } },
  { label: 'modes-count', args: { pattern: 'x', path: '.', output_mode: 'count' } },
  { label: 'modes-bad', args: { pattern: 'x', path: '.', output_mode: 'jsonl' } },
  { label: 'flags-all-on', args: { pattern: 'x', path: '.', fixed_string: true, ignore_case: true, multiline: true } },
  { label: 'flags-all-off', args: { pattern: 'x', path: '.', fixed_string: false, ignore_case: false, multiline: false } },
  { label: 'flags-type-edges', args: { pattern: 'x', path: '.', fixed_string: 'yes', ignore_case: 0, multiline: null } },
  { label: 'context-0', args: { pattern: 'x', path: '.', context: 0 } },
  { label: 'context-3', args: { pattern: 'x', path: '.', context: 3 } },
  { label: 'context-neg', args: { pattern: 'x', path: '.', context: -1 } },
  { label: 'context-huge', args: { pattern: 'x', path: '.', context: 1_000_000 } },
  { label: 'context-float', args: { pattern: 'x', path: '.', context: 1.5 } },
  { label: 'context-string', args: { pattern: 'x', path: '.', context: '3' } },
  { label: 'max-1', args: { pattern: 'x', path: '.', max_results: 1 } },
  { label: 'max-7', args: { pattern: 'x', path: '.', max_results: 7 } },
  { label: 'max-0', args: { pattern: 'x', path: '.', max_results: 0 } },
  { label: 'max-neg', args: { pattern: 'x', path: '.', max_results: -2 } },
  { label: 'glob-filter', args: { pattern: 'x', path: '.', glob: '**/*.ts' } },
  { label: 'glob-filter-empty', args: { pattern: 'x', path: '.', glob: '' } },
  { label: 'unknown-key', args: { pattern: 'x', path: '.', engine: 'ripgrep' } },
  { label: 'missing-pattern', args: { path: '.' } },
  { label: 'missing-path', args: { pattern: 'x' } },
  { label: 'empty-args', args: {} },
  { label: 'pattern-number', args: { pattern: 42, path: '.' } },
  { label: 'path-object', args: { pattern: 'x', path: { nested: true } } },
  { label: 'pattern-array', args: { pattern: ['a', 'b'], path: '.' } },
  { label: 'huge-pattern', args: { pattern: 'q'.repeat(65_536), path: '.' } },
  { label: 'huge-path', args: { pattern: 'x', path: '/tmp/' + 'p'.repeat(262_144) } },
  { label: 'path-is-pattern', args: { pattern: 'x', path: '**/*.ts' } },
  { label: 'pattern-is-path', args: { pattern: '/etc/passwd', path: '.' } },
]

/** Argument SHAPES for the glob row (closed keys: pattern/path). */
export const GLOB_RAW: readonly { readonly label: string; readonly args: Record<string, unknown> }[] = [
  { label: 'basic', args: { pattern: '**/*.ts' } },
  { label: 'dot', args: { pattern: '.' } },
  { label: 'doublestar', args: { pattern: '**' } },
  { label: 'brace', args: { pattern: '*.{ts,tsx}' } },
  { label: 'brace-unbalanced', args: { pattern: '*.{ts,tsx' } },
  { label: 'brace-nested', args: { pattern: '*.{a,{b,c}}' } },
  { label: 'class-bang', args: { pattern: '[!a]*' } },
  { label: 'class-caret', args: { pattern: '[^a]*' } },
  { label: 'class-space', args: { pattern: '[^ ]' } },
  { label: 'class-unbalanced', args: { pattern: '[abc' } },
  { label: 'pattern-is-path', args: { pattern: '/etc/passwd' } },
  { label: 'dotslash-prefix', args: { pattern: './**/*.md' } },
  { label: 'parent-escape', args: { pattern: '../../**/*' } },
  { label: 'absolute-nested', args: { pattern: '/tmp/**/x' } },
  { label: 'hidden-all', args: { pattern: '**/.*' } },
  { label: 'git-escape', args: { pattern: '**/.git/**' } },
  { label: 'unicode-nfc', args: { pattern: '**/café/**' } },
  { label: 'unicode-astral', args: { pattern: '**/😀.ts' } },
  { label: 'newline', args: { pattern: 'a\nb*' } },
  { label: 'carriage', args: { pattern: 'a\rb*' } },
  { label: 'empty', args: { pattern: '' } },
  { label: 'missing', args: {} },
  { label: 'pattern-number', args: { pattern: 7 } },
  { label: 'trailing-slash', args: { pattern: 'src/**/' } },
  { label: 'question', args: { pattern: 'file?.ts' } },
  { label: 'dash', args: { pattern: '--help' } },
  { label: 'huge', args: { pattern: '*'.repeat(65_536) } },
  { label: 'extglob', args: { pattern: 'file@(1|2).ts' } },
  { label: 'escaped-star', args: { pattern: 'a\\*b' } },
  { label: 'with-path', args: { pattern: '*.ts', path: 'src' } },
  { label: 'path-dotdot', args: { pattern: '*.ts', path: '..' } },
  { label: 'unknown-key', args: { pattern: '*', include_ignored: true } },
  { label: 'nul-in-pattern', args: { pattern: 'a\u0000b*' } },
  { label: 'zero-star', args: { pattern: '{,}' } },
]

/** The pinned ownership-facts face for the coverage classifier (identical
 *  literals on both trees — the recorder binds them, not the face). */
export const COVERAGE_FACTS = Object.freeze({
  managedToolNames: ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh'],
  teamToolNames: ['team_grep', 'team_glob', 'team_bash'],
  mcpToolNames: [],
})

/** Pinned surfaces for evaluatePermissionCoverage. */
export const COVERAGE_SURFACES: readonly (readonly string[])[] = [
  ['grep'],
  ['glob', 'grep'],
  ['grep', 'read', 'bash'],
  ['team_grep', 'team_glob', 'team_bash'],
  ['grep', 'subagent', 'web_fetch', 'job_list'],
]

/** The spellings the AUTHORITY sees for the search class (frozen-vocabulary
 *  law: NONE of them canonicalizes; every byte of every refusal stands). */
export const SPELLINGS: readonly string[] = ['grep', 'glob', 'team_grep', 'team_glob', 'Grep', 'GLOB', 'grep ', 'rg', 'search', 'fsSearch']

/** Parsed grep shapes for the argv builders (the `parseGrepArgs` ANSWER
 *  face plus its adversarial cousins — builders never re-validate, so
 *  these shapes reach them in the wild through the trusted lane). */
export const PARSED_GREP: readonly { readonly label: string; readonly parsed: Record<string, unknown> }[] = [
  { label: 'content', parsed: { tool: 'grep', pattern: 'TODO', target: { placement: 'relative', key: 'dir:.' }, outputMode: 'content', fixedString: false, ignoreCase: false, multiline: false, contextLines: 0, maxResults: 100 } },
  { label: 'files', parsed: { tool: 'grep', pattern: 'TODO', target: { placement: 'relative', key: 'dir:.' }, outputMode: 'files_with_matches', fixedString: false, ignoreCase: false, multiline: false, contextLines: 0, maxResults: 100 } },
  { label: 'count', parsed: { tool: 'grep', pattern: 'TODO', target: { placement: 'relative', key: 'dir:.' }, outputMode: 'count', fixedString: false, ignoreCase: false, multiline: false, contextLines: 0, maxResults: 100 } },
  { label: 'fixed-i', parsed: { tool: 'grep', pattern: 'a.*b', target: { placement: 'relative', key: 'dir:.' }, outputMode: 'content', fixedString: true, ignoreCase: true, multiline: false, contextLines: 0, maxResults: 100 } },
  { label: 'glob-C', parsed: { tool: 'grep', pattern: 'x', globFilter: '**/*.ts', target: { placement: 'relative', key: 'dir:.' }, outputMode: 'content', fixedString: false, ignoreCase: false, multiline: false, contextLines: 3, maxResults: 100 } },
  { label: 'glob-count-C', parsed: { tool: 'grep', pattern: 'x', globFilter: '*', target: { placement: 'relative', key: 'dir:.' }, outputMode: 'count', fixedString: false, ignoreCase: true, multiline: false, contextLines: 5, maxResults: 2 } },
  { label: 'unicode', parsed: { tool: 'grep', pattern: 'café😀مرحبا', target: { placement: 'relative', key: 'dir:.' }, outputMode: 'content', fixedString: true, ignoreCase: false, multiline: true, contextLines: 0, maxResults: 1 } },
  { label: 'newline-pattern', parsed: { tool: 'grep', pattern: 'a\nb', target: { placement: 'relative', key: 'dir:.' }, outputMode: 'content', fixedString: false, ignoreCase: false, multiline: true, contextLines: 0, maxResults: 10 } },
  { label: 'dash-pattern', parsed: { tool: 'grep', pattern: '--flag', target: { placement: 'relative', key: 'dir:.' }, outputMode: 'content', fixedString: true, ignoreCase: false, multiline: false, contextLines: 0, maxResults: 10 } },
  { label: 'glob-empty-string', parsed: { tool: 'grep', pattern: 'x', globFilter: '', target: { placement: 'relative', key: 'dir:.' }, outputMode: 'content', fixedString: false, ignoreCase: false, multiline: false, contextLines: 0, maxResults: 100 } },
  { label: 'missing-fields', parsed: {} },
  { label: 'pattern-number', parsed: { pattern: 42, outputMode: 'content' } },
  { label: 'context-string', parsed: { pattern: 'x', outputMode: 'content', contextLines: '3' } },
  { label: 'huge-pattern', parsed: { pattern: 'q'.repeat(65_536), outputMode: 'content', fixedString: true, ignoreCase: false, multiline: false, contextLines: 0, maxResults: 1 } },
]

/** Search-walk path elements searchArgv is asked to carry. */
export const SEARCH_PATH_ELTS: readonly { readonly label: string; readonly elt: string }[] = [
  { label: 'dot', elt: '.' },
  { label: 'file-name', elt: 'file.txt' },
  { label: 'unicode-name', elt: '文件😀.ts' },
  { label: 'dash-file', elt: '--no-ignore' },
  { label: 'empty', elt: '' },
]

/** Grep-OUTPUT record streams for projectMatches (the READ side of the
 *  native contract — records as the `--json` parser projects them). */
export const RECORD_STREAMS: readonly { readonly label: string; readonly records: readonly Record<string, unknown>[] }[] = [
  { label: 'empty', records: [] },
  {
    label: 'three-files',
    records: [
      { path: 'src/a.ts', lineNumber: 1, line: 'const x = 1' },
      { path: 'src/a.ts', lineNumber: 4, line: 'const y = "TODO"' },
      { path: 'docs/b.md', lineNumber: 2, line: 'TODO: fix' },
    ],
  },
  {
    label: 'unicode-paths',
    records: [
      { path: 'café/文件.ts', lineNumber: 3, line: '😀 todo' },
      { path: 'a\u00A0b/c\u200Bd.ts', lineNumber: 10, line: 'TODO مرحبا' },
    ],
  },
  {
    label: 'newline-in-name',
    records: [{ path: 'weird\nname.ts', lineNumber: 1, line: 'TODO' }],
  },
  {
    label: 'escapes-in-line',
    records: [{ path: 'a.ts', lineNumber: 7, line: 'tab\there \r CR and \x1b[31mcolor\x1b[0m' }],
  },
  {
    label: 'out-of-scope-record',
    records: [
      { path: 'ok.ts', lineNumber: 1, line: 'x' },
      { path: '../escape.ts', lineNumber: 1, line: 'x' },
    ],
  },
  {
    label: 'absolute-record',
    records: [{ path: '/etc/passwd', lineNumber: 1, line: 'root' }],
  },
  {
    label: 'dot-segments',
    records: [{ path: './src/./deep//a.ts', lineNumber: 2, line: 'x' }],
  },
  { label: 'empty-path-record', records: [{ path: '', lineNumber: 1, line: 'x' }] },
  { label: 'nul-path-record', records: [{ path: 'a\u0000b.ts', lineNumber: 1, line: 'x' }] },
  { label: 'win-abs-record', records: [{ path: 'C:\\Windows\\x.ts', lineNumber: 1, line: 'x' }] },
  {
    label: 'many-files-truncate',
    records: Array.from({ length: 7 }, (_u, i) => ({ path: `f${String(i)}.ts`, lineNumber: i + 1, line: `TODO ${String(i)}` })),
  },
]

/** (records × mode × cap) grids for projectMatches. */
export const PROJECT_GRID: readonly { readonly mode: string; readonly cap: number }[] = [
  { mode: 'content', cap: 100 },
  { mode: 'content', cap: 2 },
  { mode: 'content', cap: 0 },
  { mode: 'files_with_matches', cap: 100 },
  { mode: 'files_with_matches', cap: 1 },
  { mode: 'count', cap: 100 },
  { mode: 'count', cap: 3 },
  { mode: 'count', cap: -5 },
]

/** NUL-framed walk streams for parseWalkOutput. */
export const WALK_STREAMS: readonly { readonly label: string; readonly stdout: string }[] = [
  { label: 'empty', stdout: '' },
  { label: 'single', stdout: 'a.ts\u0000' },
  { label: 'multi', stdout: 'a.ts\u0000b/c.ts\u0000d.md\u0000' },
  { label: 'no-trailing-nul', stdout: 'a.ts\u0000b.ts' },
  { label: 'leading-nul', stdout: '\u0000a.ts\u0000' },
  { label: 'consecutive-nul', stdout: 'a.ts\u0000\u0000b.ts\u0000' },
  { label: 'only-nul', stdout: '\u0000' },
  { label: 'unicode', stdout: 'café/文件.ts\u0000😀/x.ts\u0000' },
  { label: 'newline-name', stdout: 'weird\nname.ts\u0000ok.ts\u0000' },
  { label: 'crlf', stdout: 'a.ts\r\nb.ts\r\n' },
  { label: 'backslash', stdout: 'win\\path.ts\u0000' },
  { label: 'dot-entries', stdout: '.\u0000..\u0000real.ts\u0000' },
  { label: 'hidden', stdout: '.env\u0000.gitignore\u0000' },
  { label: 'nbsp-zerowidth', stdout: 'a\u00A0b.ts\u0000c\u200Bd.ts\u0000' },
  { label: 'long-name', stdout: `${'z'.repeat(4096)}.ts\u0000` },
  { label: 'abs-entry', stdout: '/etc/passwd\u0000ok.ts\u0000' },
]

/** Record paths for presentPath (the anchored-presentation law). */
export const RECORD_PATHS: readonly string[] = [
  'a.ts',
  'src/deep/a.ts',
  './a.ts',
  './src/./deep//a.ts',
  '.',
  './',
  '..',
  '../a.ts',
  'src/../a.ts',
  'src/../../a.ts',
  '/etc/passwd',
  'C:\\Windows\\x.ts',
  'c:/x/y.ts',
  '',
  'a\u0000b.ts',
  'café/文件.ts',
  'weird\nname.ts',
  'a\\\\b.ts',
  '.env',
  '.git/config',
]

/** The anchor presentPath presents against. */
export const ANCHOR = Object.freeze({ anchorPath: '/governed/root' })

/** stderr fixtures for walkerCoverageRefusal (the coverage law). */
export const STDERR_FIXTURES: readonly { readonly label: string; readonly stderr: string }[] = [
  { label: 'clean', stderr: '' },
  { label: 'relative-refusal', stderr: 'rg: sub/dir: Permission denied (os error 13)\n' },
  { label: 'abs-noise-only', stderr: 'rg: /home/user/.git: Permission denied (os error 13)\n' },
  { label: 'win-abs-noise', stderr: 'rg: C:\\Users\\x\\.git: Permission denied\n' },
  { label: 'mixed', stderr: 'rg: /abs/noise: Permission denied (os error 13)\nrg: rel/dir: Operation not permitted (os error 1)\n' },
  { label: 'epn-only', stderr: 'rg: dir: Operation not permitted\n' },
  { label: 'other-error', stderr: 'rg: regex parse error: unclosed group\n' },
  { label: 'glob-error', stderr: 'rg: error parsing glob: unclosed bracket\n' },
  { label: 'lookalike', stderr: 'xr: dir: Permission denied\n' },
  { label: 'embedded', stderr: 'warning\n  rg: dir: Permission denied (indented)\n' },
  { label: 'crlf-lines', stderr: 'rg: d: Permission denied\r\n' },
]

/** Run the FULL corpus against the injected face. Deterministic; the ORDER
 *  of vectors and of groups is part of the digest contract. */
/** The injected face's public surface (type-light: the face is a plain
 *  module built by the recorder / the family lane, never a TS module). */
type CorpusFace = {
  canonicalizeOperation: (op: { name: string, arguments: unknown }) => unknown
  classifyPermissionCoverage: (name: string) => unknown
  evaluatePermissionCoverage: (surface: readonly string[]) => unknown
  parseGrepArgs: (args: unknown) => unknown
  parseGlobArgs: (args: unknown) => unknown
  searchArgv: (parsed: unknown, pathElts?: unknown) => unknown
  grepArgv: (parsed: unknown, file: string) => unknown
  globArgv: (parsed: unknown) => unknown
  parseWalkOutput: (stdout: string) => unknown
  presentPath: (anchor: unknown, path: unknown) => unknown
  projectMatches: (records: unknown, mode: unknown, cap: unknown, present: (path: unknown) => unknown) => unknown
  walkerCoverageRefusal: (stderr: string) => unknown
  ANCHOR?: unknown
}

export async function buildCorpus(face: CorpusFace) {
  const vectors: Array<Record<string, unknown>> = []
  const push = (group: string, label: string, subject: string, value: unknown) => vectors.push({ group, label, subject, value })
  const attempt = async (fn: () => unknown | Promise<unknown>) => {
    try {
      return lossless(await fn())
    } catch (error) {
      const e = error as { name?: string, message?: string, code?: string, details?: unknown }
      return { threw: lossless({ name: e?.name ?? null, message: e?.message ?? null, code: e?.code ?? null, details: e?.details ?? null }) }
    }
  }
  // authority: every raw search shape through canonicalizeOperation under BOTH
  // native names, and every spelling with the canonical args.
  for (const c of GREP_RAW) push('authority', `grep:${c.label}`, 'grep', await attempt(() => face.canonicalizeOperation({ name: 'grep', arguments: c.args })))
  for (const c of GLOB_RAW) push('authority', `glob:${c.label}`, 'glob', await attempt(() => face.canonicalizeOperation({ name: 'glob', arguments: c.args })))
  for (const name of SPELLINGS) {
    push('authority-spelling', name, name, await attempt(() => face.canonicalizeOperation({ name, arguments: { pattern: 'x', path: '.' } })))
    push('coverage', name, name, await attempt(() => face.classifyPermissionCoverage(name)))
  }
  for (const surface of COVERAGE_SURFACES) {
    push('coverage-eval', surface.join(','), 'coverage', await attempt(() => face.evaluatePermissionCoverage(surface)))
  }
  // lane parse contract (the input the moved builders consume).
  for (const c of GREP_RAW) push('lane-parse-grep', c.label, 'grep', await attempt(() => face.parseGrepArgs(c.args)))
  for (const c of GLOB_RAW) push('lane-parse-glob', c.label, 'glob', await attempt(() => face.parseGlobArgs(c.args)))
  // the argv builders (WRITE side of the native contract).
  for (const c of PARSED_GREP) {
    push('search-argv', c.label, 'grep', await attempt(() => face.searchArgv(c.parsed)))
    push('w5-argv', c.label, 'grep', await attempt(() => face.grepArgv(c.parsed, 'target.txt')))
  }
  for (const p of SEARCH_PATH_ELTS) {
    push('search-argv-elt', p.label, 'grep', await attempt(() => face.searchArgv(PARSED_GREP[0]!.parsed, p.elt)))
  }
  for (const c of GLOB_RAW) {
    const parsed = (await attempt(() => face.parseGlobArgs(c.args))) as { ok?: boolean; value?: unknown } | null
    push('glob-argv', c.label, 'glob', await attempt(() =>
      parsed && parsed.ok === true ? face.globArgv(parsed.value) : face.globArgv({ pattern: c.args.pattern })))
  }
  // the READ side: walk parser, presentation, projection.
  for (const s of WALK_STREAMS) push('walk-parse', s.label, 'glob', await attempt(() => face.parseWalkOutput(s.stdout)))
  for (const p of RECORD_PATHS) push('present-path', JSON.stringify(p), 'search', await attempt(() => face.presentPath(face.ANCHOR ?? ANCHOR, p)))
  for (const s of RECORD_STREAMS) {
    for (const g of PROJECT_GRID) {
      push('project', `${s.label}|${g.mode}|${String(g.cap)}`, 'search', await attempt(() =>
        face.projectMatches(s.records, g.mode, g.cap, (path: unknown) => face.presentPath(face.ANCHOR ?? ANCHOR, path))))
    }
  }
  for (const f of STDERR_FIXTURES) push('cov-refusal', f.label, 'search', await attempt(() => face.walkerCoverageRefusal(f.stderr)))
  return vectors
}

const lossless = (value: unknown): unknown => {
  if (typeof value === 'function') return `[function ${value.name || 'anonymous'}]`
  if (Array.isArray(value)) return value.map(lossless)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, lossless(v)]))
  }
  if (typeof value === 'bigint' || typeof value === 'symbol') return `[${typeof value}]`
  return value
}
