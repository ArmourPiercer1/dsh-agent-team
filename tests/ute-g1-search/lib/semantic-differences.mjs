/**
 * semantic-differences.mjs — the REAL differences measured between the GOVERNED
 * PLANE (the legacy `dsh.search-family` body: `packages/tools/families/search.mjs`
 * + `search-family/src/*`) and the HOST MODULE serving the product `grep`/`glob`
 * names through route C (the pinned `@deepseek-ai/dsh-tool-fs-search` module on
 * the confined face).
 *
 * WHY THIS IS MEASURED, NOT ASSERTED. The governed row's argv is built by its
 * OWN exported builder (`searchArgv` in `search-backend.mjs`); the route-C
 * face's argv is the argv the confined provider ACTUALLY received (a witness,
 * read from the provider call record). Both are run against the SAME fixture
 * and their selected match sets are compared. Nothing here is graded; this
 * module only reports what the two implementations do differently, so the
 * retirement ledger can declare it instead of discovering it later.
 *
 * A difference is declared `blocking: true` with `approval: null` — no owner
 * approval exists, and inventing one would turn "unresolved" into "resolved"
 * by paperwork.
 *
 * @module tests/ute-g1-search/lib/semantic-differences
 */
import { execFile } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { REPO_ROOT, mountRouteCWorld, loadSearchSeams } from './world.mjs'
import { SEARCH_NEEDLE } from './corpus.mjs'

const execFileAsync = promisify(execFile)

/** The governed lane's own exported argv builder (read-only import). */
async function governedSeams() {
  // The hooks must be registered BEFORE the governed lane is imported: its
  // '.js' specifiers resolve to this checkout's '.ts' sources through them.
  const seams = await loadSearchSeams()
  const backendPath = join(REPO_ROOT, 'packages', 'tools', 'search-family', 'src', 'search-backend.mjs')
  const backend = await import(`file://${backendPath}`)
  return { searchArgv: backend.searchArgv, SEARCH_ARGV_ADDITIONS: backend.SEARCH_ARGV_ADDITIONS, host: seams.searchModule }
}

/**
 * Resolve the packaged ripgrep the host module itself spawns (the host's own
 * resolver, not a hard-coded node_modules path).
 */
async function rgPathOf(host) {
  const resolved = await host.resolveRgPath()
  if (typeof resolved !== 'string' || resolved.length === 0) {
    throw new Error('the host module could not resolve its packaged ripgrep binary')
  }
  return resolved
}

/** Run one argv vector in `cwd` and return its raw stdout (rg exit 1 = empty). */
async function runArgv(argv, cwd) {
  try {
    const { stdout } = await execFileAsync(argv[0], argv.slice(1), { cwd, maxBuffer: 32 * 1024 * 1024 })
    return stdout
  } catch (error) {
    if (error.code === 1) return String(error.stdout ?? '')
    throw error
  }
}

/** The sorted `path:line` set selected by one raw `rg --json` stdout. */
function matchKeys(stdout, host) {
  return host.parseGrepMatches(stdout)
    .map((match) => `${String(match.path).replace(/^\.\//u, '')}:${match.lineNumber}`)
    .sort()
}

/**
 * Measure the two declared differences that the corpus vectors do NOT already
 * pin as a single-path claim.
 *
 * @returns {Promise<{ routeC: object, governed: object, pathless: object, repoRoot: string }>}
 */
export async function measureArgvDifferences() {
  const { searchArgv, SEARCH_ARGV_ADDITIONS, host } = await governedSeams()
  const rg = await rgPathOf(host)
  const root = mkdtempSync(join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-search', 'sd-'))
  const inside = join(root, 'inside')
  mkdirSync(join(inside, 'sub'), { recursive: true })
  mkdirSync(join(root, 'outside'), { recursive: true })
  // A VCS-ignored file that carries the needle: the ignore law is the difference.
  writeFileSync(join(inside, '.gitignore'), 'ignored.txt\n', 'utf8')
  writeFileSync(join(inside, 'ignored.txt'), `${SEARCH_NEEDLE} ignored\n`, 'utf8')
  writeFileSync(join(inside, 'keep.txt'), `${SEARCH_NEEDLE} keep\n`, 'utf8')
  writeFileSync(join(inside, 'sub', 'nested.txt'), `${SEARCH_NEEDLE} nested\n`, 'utf8')

  const world = await mountRouteCWorld({ label: 'sd', fixtureRoot: root, cwd: inside, readRoots: [inside] })
  let routeCArgv
  let routeCSet
  let pathlessRouteC
  try {
    const withPath = await world.dispatch('grep', { pattern: SEARCH_NEEDLE, path: '.' })
    const calls = world.providerCalls()
    if (calls.length !== 1) throw new Error(`the route-C grep must reach the confined provider exactly once (observed ${calls.length})`)
    routeCArgv = calls[0].argv
    routeCSet = matchKeys(await runArgv(routeCArgv, inside), host)
    void withPath
    const pathless = await world.dispatch('grep', { pattern: SEARCH_NEEDLE })
    pathlessRouteC = { matches: Array.isArray(pathless.value?.matches) ? pathless.value.matches.length : null, argv: world.providerCalls().at(-1)?.argv ?? null }
  } finally {
    await world.dispose()
  }

  const governedArgv = [rg, ...searchArgv({ pattern: SEARCH_NEEDLE })]
  const governedSet = matchKeys(await runArgv(governedArgv, inside), host)
  const governedPathlessArgv = [rg, ...searchArgv({ pattern: SEARCH_NEEDLE }, '.')]
  const governedPathlessSet = matchKeys(await runArgv(governedPathlessArgv, inside), host)

  rmSync(root, { recursive: true, force: true })

  return {
    routeC: { argv: routeCArgv, selected: routeCSet },
    governed: { argv: governedArgv, selected: governedSet, additions: [...SEARCH_ARGV_ADDITIONS] },
    pathless: {
      routeC: pathlessRouteC,
      governed: { argv: governedPathlessArgv, selected: governedPathlessSet },
    },
  }
}

/** The declared differences. Each id is stable; `approval: null` is deliberate. */
export const SEMANTIC_DIFFERENCES = Object.freeze([
  {
    id: 'SD-SEARCH-1-grep-path-default',
    klass: 'argument-default',
    blocking: true,
    approval: null,
    summary: 'a `grep` call WITHOUT `path` returns ZERO matches on the product route: the host module omits the path operand from argv and the confined child\'s fd 0 is a readable socket, so ripgrep searches stdin instead of the session workspace (the tool description says it defaults to the workspace). The governed row always appends `.`, so the same call searches the anchored root.',
    evidence: 'tests/ute-g1-search/golden/old-path.tsv row SR-G2-no-path-stdin (observed: allow, 0 matches) + `node tests/ute-g1-search/probe-semantic-differences.mjs` (`SD pathless`)',
  },
  {
    id: 'SD-SEARCH-2-grep-vcs-ignore',
    klass: 'selection-semantics',
    blocking: true,
    approval: null,
    summary: 'the two implementations select DIFFERENT file sets for the same pattern: the route-C confined face runs ripgrep with `--no-ignore-parent --no-ignore-vcs` (a VCS-ignored file IS searched and the allow fact discloses it), while the governed row adds `--no-ignore-parent --no-ignore-global` only (VCS ignore stays in force, so the same file is NOT searched).',
    evidence: '`node tests/ute-g1-search/probe-semantic-differences.mjs` (`SD argv`): the observed route-C argv vs `searchArgv()` from packages/tools/search-family/src/search-backend.mjs, both run on one fixture',
  },
  {
    id: 'SD-SEARCH-3-refusal-surface',
    klass: 'refusal-code',
    blocking: true,
    approval: null,
    summary: 'a withheld search surfaces differently: on route C the engine reports the SAME model-facing text for every confined denial ("grep subprocess failed before reporting an outcome (ripgrep provider failure)") and the actual cause exists only as the realm\'s `a5sf-guard-consult/1` fact (`IO_READ_DENIED`, same code for a lane denial and a missing target); the governed row owns a closed, per-cause `SEARCH_REFUSAL_TEXT` vocabulary and no guard-fact channel. Both are mapped onto the same closed category here, but a consumer keying on the model-facing error cannot distinguish them on route C.',
    evidence: 'tests/ute-g1-search/golden/old-path.tsv rows SR-G3/SR-G5 (identical text, identical IO_READ_DENIED, different category)',
  },
])

/** Printable lines, FS style (`semantic-differences.mjs` precedent). */
export const SEMANTIC_DIFF_LINE_RE = /^SEMANTIC-DIFF (?:SD-SEARCH-[0-9]+-kebab|[a-z-]+) blocking=(?:YES|NO) approval=(?:PENDING|none|by:[^ ]+) — .+$/u

/**
 * @returns {string[]} one line per declared difference.
 */
export function semanticDifferenceLines() {
  return SEMANTIC_DIFFERENCES.map((difference) => {
    const approval = difference.approval === null ? 'PENDING' : `by:${difference.approval.by}`
    return `SEMANTIC-DIFF ${difference.id} blocking=${difference.blocking ? 'YES' : 'NO'} approval=${approval} — ${difference.summary}`
  })
}
