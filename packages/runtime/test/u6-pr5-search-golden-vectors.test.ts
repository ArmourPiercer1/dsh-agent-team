/**
 * U6 PR5 — THE SEARCH GOLDEN-VECTOR GATE (the slice plan's stop condition,
 * the PR2/PR3 precedent `u6-pr2-read-golden-vectors` / `u6-pr3-shell-golden-
 * vectors`): the search family lane must reproduce master's search-surface
 * behavior BYTE-IDENTICALLY over a pinned corpus generated FROM master.
 *
 * The recording (one generator `u6-pr5-search-golden-corpus.mts`, face
 * INJECTED — the scratch recorder preserved at
 * dev/agent-workflow/evidence/u6-pr5-20261026/golden-recorder.scratch.test.ts.txt):
 * 409 vectors ran against the DETACHED `origin/master` worktree @ 5c03f7240
 * (pre-move: the search region inside plane-effect-backends.mjs plus
 * search-backend.mjs / glob-backend.mjs in `src/plugin/live/`) and against
 * THIS tree (post-move: `packages/tools/search-family/` + the UNTOUCHED
 * protected authority). Both recordings are byte-identical — the FULL corpus
 * JSON, not a spot list:
 *   dev/agent-workflow/evidence/u6-pr5-20261026/golden-vectors-master.json
 *   dev/agent-workflow/evidence/u6-pr5-20261026/golden-vectors-family.json
 *   digest: sha256 0dabc187cae53bc0b22e7573b4c442f5dcdeb2f2f2f98aef79bfbd9a653e3de8
 *
 * DISCLOSED SHAPE (do not bury it): the PR2/PR3 gates pinned a
 * `canonicalizeOperation` PROJECTION (read/shell classes exist in the A2
 * frozen vocabulary). grep/glob do NOT — master canonicalizes them to the
 * closed `tool-unsupported` refusal and coverage-maps them to the `fsSearch`
 * CLASS LABEL; the slice plan's "canonical-operation.ts case 'search'
 * :784-796" cites pre-surgery numbering that does not exist at this base.
 * The protected set FORBIDS touching operation-permission/**, so this gate
 * pins the whole observable search surface instead: the authority refusals,
 * the coverage classes, the row-argument contract, the exact argv the rows
 * put on the wire (the native-rg behavior contract, §10.5-5), the walk/JSON
 * read-side parsers, the anchored presentation law, and the coverage-law
 * classifier — over unicode (NFC/NFD, CJK, astral, RTL, zero-width, NBSP),
 * metacharacter soup, adversarial paths/streams, and type edges.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { canonicalizeOperation } from '../operation-permission/canonical-operation.js'
import { classifyPermissionCoverageTool, evaluatePermissionCoverage } from '../operation-permission/permission-coverage.js'
// The model-facing grammar is the a5p5 REGISTRATION face (the plane builds
// the rows through createGovernedToolDefinitions imported from this barrel,
// team-tool-plane.mjs:75; run6 measured rows validating that grammar on the
// live host — output_mode required). This is the audit's TEST_ONLY edge:
// exactly ONE dynamic barrel line, path- and form-pinned inside
// a5p5-dormant-audit (the package face stays pinned as mechanics by the
// lane's own alpha5 suites).
const { parseGrepArgs, parseGlobArgs } = await import('../../tools/a5p5-tools/src/index.js')
import { buildCorpus, COVERAGE_FACTS, ANCHOR } from './u6-pr5-search-golden-corpus.mjs'

/** Master @ 5c03f7240 (detached-worktree recording, pre-move): 409 vectors
 *  (312 clean answers / 97 closed throws). Byte-identical family recording:
 *  digest-family.txt beside golden-vectors-master.json. */
const MASTER_CORPUS_DIGEST = '0dabc187cae53bc0b22e7573b4c442f5dcdeb2f2f2f98aef79bfbd9a653e3de8'
const MASTER_VECTOR_COUNT = 409
/** The SPELLINGS grid in the corpus generator (one authority refusal each). */
const SPELLING_COUNT = 10

async function buildTreeCorpus(): Promise<unknown[]> {
  // The lane's plain .mjs bindings ride dynamic URL imports — the same
  // convention alpha5-search-harness uses (a .mjs module has no TS surface;
  // static imports would type it `any` only by an error, TS7016).
  const lane = (rel: string): Promise<Record<string, never>> =>
    import(new URL(rel, import.meta.url).href) as Promise<Record<string, never>>
  const [searchBackend, globBackend, mechanics] = await Promise.all([
    lane('../../tools/search-family/src/search-backend.mjs'),
    lane('../../tools/search-family/src/glob-backend.mjs'),
    lane('../../tools/search-family/src/search-mechanics.mjs'),
  ])
  const { searchArgv, presentPath, projectMatches, walkerCoverageRefusal } = searchBackend
  const { globArgv, parseWalkOutput } = globBackend
  const { grepArgv } = mechanics
  return buildCorpus({
    canonicalizeOperation: (input: { name: string; arguments: Record<string, unknown> }) => canonicalizeOperation(input as never),
    classifyPermissionCoverage: (name: string) => classifyPermissionCoverageTool(name, COVERAGE_FACTS),
    evaluatePermissionCoverage: (surface: readonly string[]) => evaluatePermissionCoverage(surface, COVERAGE_FACTS),
    parseGrepArgs,
    parseGlobArgs,
    searchArgv,
    grepArgv,
    globArgv,
    parseWalkOutput,
    presentPath,
    projectMatches: (records: unknown, mode: string, cap: number, present: (p: string) => unknown) =>
      (projectMatches as unknown as (r: unknown, m: unknown, c: number, f: unknown) => unknown)(records, mode, cap, present),
    walkerCoverageRefusal,
    ANCHOR,
  } as never)
}

describe('u6-pr5 golden vectors: the moved search lane reproduces master byte-for-byte', () => {
  it('corpus digest (409 vectors: refusals + argv + parsers + presentation + coverage) equals the master recording', async () => {
    const corpus = await buildTreeCorpus()
    expect(corpus.length).toBe(MASTER_VECTOR_COUNT)
    const digest = createHash('sha256').update(JSON.stringify(corpus), 'utf8').digest('hex')
    expect(digest).toBe(MASTER_CORPUS_DIGEST)
  })

  it('the recorded master JSON is what this tree regenerates, vector by vector (FULL corpus, not a digest alone)', async () => {
    const recorded: unknown = JSON.parse(readFileSync(
      fileURLToPath(new URL('../../../dev/agent-workflow/evidence/u6-pr5-20261026/golden-vectors-master.json', import.meta.url).href),
      'utf8',
    ))
    const corpus = await buildTreeCorpus()
    // Serialization round-trip (arrays may legitimately carry `undefined`,
    // which the recording serialized as null) then PER-VECTOR exact
    // equality — a failure names ONE vector. The digest test above
    // additionally pins order + serialization bytes.
    const fresh = JSON.parse(JSON.stringify(corpus)) as unknown[]
    expect(Array.isArray(recorded)).toBe(true)
    const master = recorded as Array<{ group?: string; label?: string; subject?: string; value?: unknown }>
    expect(master.length).toBe(fresh.length)
    for (let i = 0; i < master.length; i += 1) {
      expect(fresh[i]).toEqual(master[i])
    }
  })

  it('the AUTHORITY refusals stand exactly: grep/glob are outside the frozen vocabulary (A2 law)', async () => {
    const corpus = await buildTreeCorpus()
    const refusals = corpus.filter((v) => (v as { group?: string }).group === 'authority-spelling')
    expect(refusals.length).toBe(SPELLING_COUNT)
    for (const v of refusals) {
      const threw = (v as { value: { threw?: { code?: string; details?: { reason?: string } } } }).value.threw
      expect(threw, `authority spelling ${(v as { label: string }).label} must be a closed refusal`).toBeDefined()
      expect(threw?.code).toBe('OPERATION_CANONICALIZATION_FAILED')
      expect(threw?.details?.reason).toBe('tool-unsupported')
    }
  })

  it('the coverage CLASS label survives: grep/glob classify known-sensitive-unmanaged, team_* stay managed', async () => {
    const corpus = await buildTreeCorpus()
    const cls = (label: string) => {
      const v = corpus.find((x) => (x as { group?: string; label?: string }).group === 'coverage' && (x as { label?: string }).label === label)
      return (v as { value: { classification?: string } }).value.classification
    }
    expect(cls('grep')).toBe('known-sensitive-unmanaged')
    expect(cls('glob')).toBe('known-sensitive-unmanaged')
    expect(cls('team_grep')).toBe('other-managed-team-tool')
    expect(cls('team_glob')).toBe('other-managed-team-tool')
    expect(cls('rg')).toBe('unknown-unmanaged')
  })

  it('the native-behavior contract (WRITE side, §10.5-5): the argv bytes the rows put on the wire', async () => {
    const corpus = await buildTreeCorpus()
    const at = (group: string, label: string) =>
      (corpus.find((v) => (v as { group?: string; label?: string }).group === group && (v as { label?: string }).label === label) as { value: unknown }).value
    // The W5 port keeps its exact short-flag contract…
    expect(at('w5-argv', 'content')).toEqual(['-rIn', '--binary-files=without-match', '-E', '--', 'TODO', 'target.txt'])
    // (the `-rl`/`-rc` REPLACE the --binary-files arm at index 1 — master's
    // exact splice arithmetic, pinned here BECAUSE it is load-bearing oddity)
    expect(at('w5-argv', 'files')).toEqual(['-rIn', '-rl', '-E', '--', 'TODO', 'target.txt'])
    expect(at('w5-argv', 'count')).toEqual(['-rIn', '-rc', '-E', '--', 'TODO', 'target.txt'])
    expect(at('w5-argv', 'fixed-i')).toEqual(['-rIn', '--binary-files=without-match', '-F', '-i', '--', 'a.*b', 'target.txt'])
    expect(at('w5-argv', 'glob-C')).toEqual(['-rIn', '--binary-files=without-match', '-E', '--include=**/*.ts', '-C3', '--', 'x', 'target.txt'])
    // …and the rg row keeps the host argv verbatim: --no-config prefix, the
    // host's fixed additions, `--` then the path element (nothing else).
    expect(at('search-argv', 'content')).toEqual([
      '--no-config', '--json', '--regexp=TODO', '--no-ignore-parent', '--no-ignore-global', '--', '.',
    ])
    // The dash-injection law: a pattern starting with `--` never reaches rg
    // as an option — it is always positional after `--`.
    expect(at('w5-argv', 'dash-pattern')).toEqual(['-rIn', '--binary-files=without-match', '-F', '--', '--flag', 'target.txt'])
    // Glob framing: the host's own buildGlobCommand bytes, pattern verbatim.
    expect(at('glob-argv', 'basic')).toEqual([
      '--files', '--glob=**/*.ts', '--sort=modified', '--no-ignore', '--hidden',
      '--glob=!**/.git', '--glob=!**/.git/**', '--glob=!**/.svn', '--glob=!**/.svn/**',
      '--glob=!**/.hg', '--glob=!**/.hg/**', '--glob=!**/.bzr', '--glob=!**/.bzr/**',
      '--glob=!**/.jj', '--glob=!**/.jj/**', '--glob=!**/.sl', '--glob=!**/.sl/**',
    ])
  })

  it('the native-behavior contract (READ side): NUL framing is injective, protocol breaks are typed', async () => {
    const corpus = await buildTreeCorpus()
    const at = (group: string, label: string) =>
      (corpus.find((v) => (v as { group?: string; label?: string }).group === group && (v as { label?: string }).label === label) as { value: unknown }).value
    // The forgery class the framing law closes: one object, one record.
    expect(at('walk-parse', 'newline-name')).toEqual({ ok: true, entries: ['weird\nname.ts', 'ok.ts'] })
    expect(at('walk-parse', 'unicode')).toEqual({ ok: true, entries: ['café/文件.ts', '😀/x.ts'] })
    // An empty mid-stream record is a PROTOCOL BREAK, never a dropped row.
    expect(at('walk-parse', 'consecutive-nul')).toEqual({ ok: false, code: 'walk-protocol-error' })
    expect(at('walk-parse', 'only-nul')).toEqual({ ok: false, code: 'walk-protocol-error' })
  })

  it('the anchored presentation law + the coverage classifier keep their exact shapes', async () => {
    const corpus = await buildTreeCorpus()
    const at = (group: string, label: string) =>
      (corpus.find((v) => (v as { group?: string; label?: string }).group === group && (v as { label?: string }).label === label) as { value: unknown }).value
    expect(at('present-path', '"src/deep/a.ts"')).toEqual({ ok: true, path: '/governed/root/src/deep/a.ts' })
    expect(at('present-path', '"../a.ts"')).toEqual({ ok: false, code: 'record-out-of-scope' })
    expect(at('present-path', '"/etc/passwd"')).toEqual({ ok: false, code: 'record-out-of-scope' })
    // Downward permission refusal is coverage-visible; absolute upward noise
    // is not; the pattern-error stderr is a DIFFERENT code path entirely.
    expect(at('cov-refusal', 'relative-refusal')).toBe('walker-permission-refused')
    expect(at('cov-refusal', 'abs-noise-only')).toBeNull()
    expect(at('cov-refusal', 'clean')).toBeNull()
  })
})
