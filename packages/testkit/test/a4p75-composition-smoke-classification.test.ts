/**
 * a4p75-composition-smoke-classification.test.ts — the three-state classifier
 * and the offline composition-surface checks behind `pnpm smoke:composition`
 * (A4-PR7 Task 7.5).
 *
 * WHY A TEST AT ALL, when the script prints its verdicts: the round's whole
 * point is that a gate must not be able to go quiet. A SKIP branch nobody
 * exercises is a mute with better typography — the A4-PR6 precedent (six
 * `eslint-disable no-explicit-any` closing a lint gate) is exactly a check that
 * stopped checking while still printing green. So every arm here is driven to
 * its red state on a fixture, not asserted only in the happy direction:
 *
 *   - the classifier: `run` / `skip` (naming the packages) / `fail`, with the
 *     laundering case — our OWN artifact carrying an undeclared import while
 *     the upstream closure is ALSO incomplete — proven to stay red;
 *   - each composition-surface arm: output missing, bundle outside an install
 *     surface, a manifest path that does not exist, a recorded manifest value
 *     that drifted, a row registration renamed or lost, a module graph that
 *     throws, a plugin export that is gone, an external that appeared or
 *     disappeared, a derived URL that points at nothing.
 *
 * The load-side checks need the upstream client closure, which this workspace
 * cannot install (`@deepseek-ai/dsh-client-ui-primitives` declares no runtime
 * dependencies and imports 23 bare packages; 17 are absent here). The fixture
 * closures below are therefore synthetic — they reproduce the SHAPE of the
 * failure (a bare specifier requested by a file inside `node_modules`) without
 * pretending to be the real dependency.
 *
 * REVIEW ROUND (this commit) added the shapes that printed the healthy output
 * while a defect was present, each first reproduced against the real gate:
 * a dangling SUBPATH of an installed package asked for by a non-entry own file
 * (used to be `untraversed`, so the own zone stayed silent and the step
 * SKIPPED); a capped closure walk, which could still be skipped; an own import
 * that was merely INDENTED, invisible to a column-0 scanner; the
 * `composition-bundle-is-install-surface` arm, which compared the caller's own
 * constants and could not fail; and the arm SET itself, where a check that
 * stopped reporting simply stopped being printed under a `PASS` summary.
 * Resolution errors here are captured from a child `node` process, because the
 * test runner's own resolver disagrees with Node about directory imports and
 * subpath exports — pinning the runner would have tested the wrong thing.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  classifyClosureStep,
  formatSkipDetail,
  isInsideNodeModules,
  packageSubpathIsMissing,
  resolutionFailureOf,
  scanModuleClosure,
} from '../../../scripts/composition-smoke-closure.mjs'
import {
  REQUIRED_CHECK_IDS,
  checkCompositionSurface,
  checkSetDifferences,
  staticExternalRequests,
} from '../../../scripts/composition-smoke-bundle.mjs'
import {
  CLIENT_BUNDLE_FILENAME,
  CLIENT_COMPOSITION_DIR,
  CLIENT_MODULE_TABLE_EXTERNALS,
  CLIENT_NODE_HALF_FILENAME,
  CLIENT_PLUGIN_NAME,
  CLIENT_ROW_IDS,
  CLIENT_SHIM_ROW_ID,
  INSTALL_SURFACES,
} from '../../../scripts/client-composition-surface.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SCRATCH = join(REPO_ROOT, 'packages/testkit/test/.tmp-fault/a4p75-composition-smoke')

function write(file: string, text: string): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
}

function readCheck(checks: ReadonlyArray<{ id: string; ok: boolean; detail: string }>, id: string) {
  const found = checks.find((check) => check.id === id)
  if (found === undefined) throw new Error(`check ${id} is not reported by the surface check`)
  return found
}

/**
 * A fixture file's REAL resolution failure, captured from a child `node`
 * process and re-raised as an Error with Node's own code and message.
 *
 * This cannot be done by importing inside the test: vitest resolves modules its
 * own way, and it disagrees with Node precisely on the shapes under test — it
 * resolves a directory import that Node rejects with
 * `ERR_UNSUPPORTED_DIR_IMPORT`, and it words a subpath-not-exported failure
 * differently. An error captured in-process would pin the test runner's
 * behaviour where the gate depends on the runtime's.
 */
function nodeResolutionError(target: string): Error & { code: string } {
  const url = pathToFileURL(target).href
  const script = `try { await import(${JSON.stringify(url)}); process.stdout.write(JSON.stringify({ code: null, message: 'LOADED: no error' })) } `
    + 'catch (error) { process.stdout.write(JSON.stringify({ code: error?.code ?? null, message: String(error?.message ?? error) })) }'
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' })
  const parsed = JSON.parse(run.stdout) as { code: string | null; message: string }
  if (parsed.code === null) throw new Error(`expected ${target} to fail to load, it loaded (${parsed.message})`)
  return Object.assign(new Error(parsed.message), { code: parsed.code })
}

/**
 * A scan that saw everything and found nothing. Used by the tests that isolate
 * the LOAD-error branch of the classifier: leaving the scan's own verdict in
 * play would let one arm of the classifier answer for the other.
 */
const CLEAN_CLOSURE = {
  ran: true,
  reason: null,
  visitedFiles: 1,
  truncated: false,
  ownUnresolved: [],
  upstreamUnresolved: [],
  untraversed: 0,
} as const

// ── closure fixtures ────────────────────────────────────────────────────────

/** A fixture package that DOES resolve, so `run` is a real state, not a default. */
const PRESENT_PACKAGE = {
  'node_modules/@a4p75/present/package.json': JSON.stringify({
    name: '@a4p75/present',
    version: '1.0.0',
    type: 'module',
    exports: { '.': './index.js', './sub': './sub/index.js' },
  }),
  'node_modules/@a4p75/present/index.js': 'export const present = 1\n',
  'node_modules/@a4p75/present/sub/index.js': 'import "../index.js"\nexport const sub = 2\n',
}

/** A third-party file asking for packages that are not installed anywhere. */
const UPSTREAM_WITH_UNDECLARED_DEPS = {
  'node_modules/@a4p75/upstream/package.json': JSON.stringify({
    name: '@a4p75/upstream',
    version: '1.0.0',
    type: 'module',
    exports: { '.': './lib/index.js' },
  }),
  'node_modules/@a4p75/upstream/lib/index.js':
    "import { one } from '@a4p75/no-such-clsx'\nimport { two } from '@a4p75/deep-missing'\nexport const up = one + two\n",
}

const OWN_UNDECLARED_IMPORT =
  "import { missing } from '@a4p75/own-missing'\nexport const ownSide = missing\n"

describe('composition-smoke three-state classifier', () => {
  beforeAll(() => {
    rmSync(SCRATCH, { recursive: true, force: true })
    const root = join(SCRATCH, 'closure')
    // Every fixture is its own ESM package: without this the `.js` fixtures
    // would inherit whatever `type` the nearest package.json declares, and a
    // SyntaxError would stand in for the error under test.
    for (const caseName of ['ok', 'upstream', 'own-bug', 'throws', 'subpath', 'indented', 'subpath-upstream', 'dirimport']) {
      write(join(root, caseName, 'package.json'), JSON.stringify({ name: `@a4p75/fixture-${caseName}`, type: 'module' }, null, 2))
    }
    // (1) everything resolves -> run.
    write(join(root, 'ok/node_modules/@a4p75/present/package.json'), PRESENT_PACKAGE['node_modules/@a4p75/present/package.json'])
    write(join(root, 'ok/node_modules/@a4p75/present/index.js'), PRESENT_PACKAGE['node_modules/@a4p75/present/index.js'])
    write(join(root, 'ok/node_modules/@a4p75/present/sub/index.js'), PRESENT_PACKAGE['node_modules/@a4p75/present/sub/index.js'])
    write(join(root, 'ok/dist/entry.js'), "import { present } from '@a4p75/present'\nimport { sub } from '@a4p75/present/sub'\nimport './inner.js'\nexport const loaded = present + sub\n")
    write(join(root, 'ok/dist/inner.js'), "import 'node:fs'\nexport const inner = 1\n")

    // (2) upstream closure incomplete -> skip, naming the packages.
    for (const [rel, text] of Object.entries(UPSTREAM_WITH_UNDECLARED_DEPS)) {
      write(join(root, 'upstream', rel), text)
    }
    write(join(root, 'upstream/dist/entry.js'), "import { up } from '@a4p75/upstream'\nexport const clientEntry = up\n")

    // (3) our own artifact ALSO has an undeclared import, and the upstream
    //     failure links first — the laundering case.
    for (const [rel, text] of Object.entries(UPSTREAM_WITH_UNDECLARED_DEPS)) {
      write(join(root, 'own-bug', rel), text)
    }
    write(join(root, 'own-bug/dist/own-side.js'), OWN_UNDECLARED_IMPORT)
    write(join(root, 'own-bug/dist/entry.js'), "import { up } from '@a4p75/upstream'\nimport { ownSide } from './own-side.js'\nexport const clientEntry = up + ownSide\n")

    // (4) the graph links and then throws -> fail.
    write(join(root, 'throws/dist/entry.js'), "throw new TypeError('mount dereferenced a seam service')\nexport const never = 1\n")

    // (5) the review-round laundering case: our OWN non-entry file imports a
    //     SUBPATH of a package that IS installed. The package is present, so
    //     this used to be counted as `untraversed` instead of unresolved, the
    //     own zone stayed silent, and the load error named the upstream gap —
    //     a SKIP that was byte-identical to a clean run (receipt R-1a).
    for (const caseName of ['subpath', 'indented']) {
      write(join(root, `${caseName}/node_modules/@a4p75/present/package.json`), PRESENT_PACKAGE['node_modules/@a4p75/present/package.json'])
      write(join(root, `${caseName}/node_modules/@a4p75/present/index.js`), PRESENT_PACKAGE['node_modules/@a4p75/present/index.js'])
      write(join(root, `${caseName}/node_modules/@a4p75/present/sub/index.js`), PRESENT_PACKAGE['node_modules/@a4p75/present/sub/index.js'])
      for (const [rel, text] of Object.entries(UPSTREAM_WITH_UNDECLARED_DEPS)) {
        write(join(root, caseName, rel), text)
      }
    }
    write(join(root, 'subpath/dist/own-side.js'), "import { nope } from '@a4p75/present/does-not-exist'\nexport const ownSide = nope\n")
    write(join(root, 'subpath/dist/entry.js'), "import { up } from '@a4p75/upstream'\nimport { ownSide } from './own-side.js'\nexport const clientEntry = up + ownSide\n")
    // (6) the other review-round shape: an own import that is INDENTED. The
    //     scanner read column 0 only, so the specifier vanished and the step
    //     skipped over our own defect (receipt R-2a).
    write(join(root, 'indented/dist/own-side.js'), "  import { missing } from '@a4p75/own-missing-indented'\nexport const ownSide = missing\n")
    write(join(root, 'indented/dist/entry.js'), "import { up } from '@a4p75/upstream'\nimport { ownSide } from './own-side.js'\nexport const clientEntry = up + ownSide\n")

    // (7) the SAME error form on the OTHER side of the zone boundary: a
    //     third-party file whose own subpath does not resolve. That is the
    //     host's closure and must still skip, which is what makes (5) a zone
    //     test rather than a blanket ban on subpath errors.
    write(join(root, 'subpath-upstream/node_modules/@a4p75/present/package.json'), PRESENT_PACKAGE['node_modules/@a4p75/present/package.json'])
    write(join(root, 'subpath-upstream/node_modules/@a4p75/present/index.js'), PRESENT_PACKAGE['node_modules/@a4p75/present/index.js'])
    write(join(root, 'subpath-upstream/node_modules/@a4p75/host/package.json'), JSON.stringify({ name: '@a4p75/host', version: '1.0.0', type: 'module', exports: { '.': './lib/index.js' } }))
    write(join(root, 'subpath-upstream/node_modules/@a4p75/host/lib/index.js'), "import { nope } from '@a4p75/present/does-not-exist'\nexport const host = nope\n")
    write(join(root, 'subpath-upstream/dist/entry.js'), "import { host } from '@a4p75/host'\nexport const clientEntry = host\n")

    // (8) a directory import, the third resolution-error form the classifier
    //     parses. Node's message names the directory and then the importer.
    write(join(root, 'dirimport/somedir/index.js'), 'export const dir = 1\n')
    write(join(root, 'dirimport/dist/entry.js'), "import { dir } from '../somedir'\nexport const clientEntry = dir\n")
  })

  afterAll(() => {
    rmSync(SCRATCH, { recursive: true, force: true })
  })

  const closureOf = (dir: string) => {
    const caseRoot = join(SCRATCH, 'closure', dir)
    return scanModuleClosure({ entryFile: join(caseRoot, 'dist/entry.js'), repoRoot: caseRoot })
  }

  it('runs the step when every specifier in the graph resolves', () => {
    const closure = closureOf('ok')
    expect(closure.ran).toBe(true)
    expect(closure.ownUnresolved).toEqual([])
    expect(closure.upstreamUnresolved).toEqual([])
    const decision = classifyClosureStep({ entryExists: true, closure, loadError: undefined })
    expect(decision.status).toBe('run')
  })

  it('skips, and names every unresolvable package, when only the upstream closure is missing', async () => {
    const root = join(SCRATCH, 'closure/upstream')
    const entryFile = join(root, 'dist/entry.js')
    const closure = scanModuleClosure({ entryFile, repoRoot: root })
    expect(closure.ownUnresolved).toEqual([])
    expect(closure.upstreamUnresolved.map((entry) => entry.package).sort())
      .toEqual(['@a4p75/deep-missing', '@a4p75/no-such-clsx'])
    // The real import attempt, so the classifier sees a real Node error.
    let loadError: unknown
    try {
      await import(`${entryFile}?case=upstream`)
    } catch (error) {
      loadError = error
    }
    const decision = classifyClosureStep({ entryExists: true, closure, loadError })
    expect(decision.status).toBe('skip')
    // The brief's requirement: the SKIP line contains the missing package names.
    const line = formatSkipDetail(decision.missing ?? [])
    expect(line).toContain('@a4p75/no-such-clsx')
    expect(line).toContain('@a4p75/deep-missing')
    expect(line).toMatch(/^host module closure unavailable — 2 unresolvable: /)
  })

  it('never launders: our own undeclared import fails even while the upstream closure is also missing', () => {
    const closure = closureOf('own-bug')
    expect(closure.upstreamUnresolved.length).toBeGreaterThan(0)
    expect(closure.ownUnresolved.map((entry) => entry.specifier)).toEqual(['@a4p75/own-missing'])
    const upstreamLoadError = Object.assign(
      new Error("Cannot find package '@a4p75/no-such-clsx' imported from /x/node_modules/@a4p75/upstream/lib/index.js"),
      { code: 'ERR_MODULE_NOT_FOUND' },
    )
    const decision = classifyClosureStep({ entryExists: true, closure, loadError: upstreamLoadError })
    expect(decision.status).toBe('fail')
    expect(decision.why).toContain('@a4p75/own-missing')
  })

  it('fails on a module-evaluation throw instead of calling it a missing package', async () => {
    const root = join(SCRATCH, 'closure/throws')
    const entryFile = join(root, 'dist/entry.js')
    let loadError: unknown
    try {
      await import(`${entryFile}?case=throws`)
    } catch (error) {
      loadError = error
    }
    const closure = scanModuleClosure({ entryFile, repoRoot: root })
    const decision = classifyClosureStep({ entryExists: true, closure, loadError })
    expect(decision.status).toBe('fail')
    expect(decision.why).toContain('mount dereferenced a seam service')
  })

  it('fails, not skips, when the artifact itself is absent', () => {
    const decision = classifyClosureStep({ entryExists: false, closure: null, loadError: undefined })
    expect(decision.status).toBe('fail')
    expect(decision.why).toContain('pnpm build')
  })

  // ── review round: the shapes that used to print the healthy output ────────
  // Each of these was reproduced against the real gate first (receipt
  // `gates/7-5-review-round-mutations.txt`): the dangling subpath printed
  // `SKIP … 17 unresolvable …` + `PASS composition-smoke`, exit 0, byte-identical
  // to a clean run; the indented import printed the same. A fixture that only
  // asserts the fixed direction would not have caught either, so both assert the
  // scan record AND the verdict, and both were run red against the pre-fix code.

  it('records a dangling subpath of an INSTALLED package as an own-zone defect, never as untraversed', () => {
    const root = join(SCRATCH, 'closure/subpath')
    const entryFile = join(root, 'dist/entry.js')
    const closure = scanModuleClosure({ entryFile, repoRoot: root })
    // The old behaviour in one number: a present package with an unresolvable
    // subpath was counted here instead of in the zone it belongs to.
    expect(closure.untraversed).toBe(0)
    expect(closure.ownUnresolved.map((entry) => entry.specifier)).toEqual(['@a4p75/present/does-not-exist'])
    expect(closure.ownUnresolved[0]?.zone).toBe('own')
    expect(closure.ownUnresolved[0]?.importer).toContain(join('dist', 'own-side.js'))
    // The real import attempt, in a real `node`: the upstream gap wins the link
    // race, so the load error ALONE would justify a SKIP. The scan is what keeps
    // this red, and this assertion is the measurement of that race.
    const loadError = nodeResolutionError(entryFile)
    expect(loadError.code).toBe('ERR_MODULE_NOT_FOUND')
    expect(loadError.message).toContain('@a4p75/no-such-clsx')
    const decision = classifyClosureStep({ entryExists: true, closure, loadError })
    expect(decision.status).toBe('fail')
    expect(decision.why).toContain('@a4p75/present/does-not-exist')
  })

  it('sees an own import that is indented, not at column 0 (the skip was the EAGER direction)', () => {
    const root = join(SCRATCH, 'closure/indented')
    const entryFile = join(root, 'dist/entry.js')
    const closure = scanModuleClosure({ entryFile, repoRoot: root })
    expect(closure.ownUnresolved.map((entry) => entry.specifier)).toEqual(['@a4p75/own-missing-indented'])
    const loadError = nodeResolutionError(entryFile)
    expect(loadError.code).toBe('ERR_MODULE_NOT_FOUND')
    const decision = classifyClosureStep({ entryExists: true, closure, loadError })
    expect(decision.status).toBe('fail')
    expect(decision.why).toContain('@a4p75/own-missing-indented')
  })

  it('fails instead of skipping when the closure walk hit its file cap', () => {
    const root = join(SCRATCH, 'closure/upstream')
    const entryFile = join(root, 'dist/entry.js')
    const loadError = nodeResolutionError(entryFile)
    // Same fixture, same real error: uncapped it skips (the test above), capped
    // it must not — the difference is the scan's coverage, not the error.
    const uncapped = scanModuleClosure({ entryFile, repoRoot: root })
    expect(uncapped.truncated).toBe(false)
    expect(classifyClosureStep({ entryExists: true, closure: uncapped, loadError }).status).toBe('skip')
    const capped = scanModuleClosure({ entryFile, repoRoot: root, maxFiles: 1 })
    expect(capped.truncated).toBe(true)
    expect(capped.ownUnresolved).toEqual([])
    const decision = classifyClosureStep({ entryExists: true, closure: capped, loadError })
    expect(decision.status).toBe('fail')
    expect(decision.why).toContain('file cap')
  })

  it('names the importing file, not the offending package.json, for a subpath error', () => {
    const root = join(SCRATCH, 'closure/subpath')
    const ownSide = join(root, 'dist/own-side.js')
    const loadError = nodeResolutionError(ownSide)
    expect(loadError.code).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED')
    const failure = resolutionFailureOf(loadError)
    expect(failure).not.toBeNull()
    // Node's message carries BOTH paths; the importer is the second one. Taking
    // the tail made this string contain the package.json, so the zone test was
    // true for every one of them and decided nothing.
    expect(failure?.importer).toBe(ownSide)
    expect(isInsideNodeModules(failure?.importer ?? '')).toBe(false)
    // The package is recovered from the manifest path the message names, so the
    // ZONE is what decides here — not the accident that `'./does-not-exist'` is
    // not a bare package name, which is what really produced this FAIL before.
    expect(failure?.package).toBe('@a4p75/present')
    const decision = classifyClosureStep({ entryExists: true, closure: CLEAN_CLOSURE, loadError })
    expect(decision.status).toBe('fail')
    expect(decision.why).toContain('own-side.js')
    expect(decision.why).toContain('this repo')
    expect(decision.why).not.toContain('package.json')
  })

  it('still skips a THIRD-PARTY file whose own subpath does not resolve', () => {
    const root = join(SCRATCH, 'closure/subpath-upstream')
    const entryFile = join(root, 'dist/entry.js')
    const closure = scanModuleClosure({ entryFile, repoRoot: root })
    expect(closure.ownUnresolved).toEqual([])
    expect(closure.upstreamUnresolved.map((entry) => entry.package)).toEqual(['@a4p75/present'])
    const loadError = nodeResolutionError(entryFile)
    const failure = resolutionFailureOf(loadError)
    expect(failure?.code).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED')
    expect(isInsideNodeModules(failure?.importer ?? '')).toBe(true)
    const decision = classifyClosureStep({ entryExists: true, closure, loadError })
    expect(decision.status).toBe('skip')
    expect(formatSkipDetail(decision.missing ?? [])).toContain('@a4p75/present')
  })

  it('parses a directory import and names its importer (and still fails it)', () => {
    const root = join(SCRATCH, 'closure/dirimport')
    const entryFile = join(root, 'dist/entry.js')
    const loadError = nodeResolutionError(entryFile)
    expect(loadError.code).toBe('ERR_UNSUPPORTED_DIR_IMPORT')
    const failure = resolutionFailureOf(loadError)
    expect(failure).not.toBeNull()
    expect(failure?.importer).toBe(entryFile)
    expect(failure?.package).toBeNull()
    const decision = classifyClosureStep({ entryExists: true, closure: CLEAN_CLOSURE, loadError })
    expect(decision.status).toBe('fail')
    expect(decision.why).toContain('entry.js')
  })

  it('calls an exports-gated subpath missing even when the file sits on disk', () => {
    const packageDirectory = join(SCRATCH, 'closure/ok/node_modules/@a4p75/present')
    // `exports` is a gate, not a hint: `sub/index.js` exists, `./nope` is not
    // exported, and Node fails the second one regardless of what is on disk.
    expect(packageSubpathIsMissing(packageDirectory, '@a4p75/present/does-not-exist')).toBe(true)
    expect(packageSubpathIsMissing(packageDirectory, '@a4p75/present/nope/deeper.js')).toBe(true)
    expect(packageSubpathIsMissing(packageDirectory, '@a4p75/present/sub')).toBe(false)
    expect(packageSubpathIsMissing(packageDirectory, '@a4p75/present')).toBe(false)
    // No `exports` field: legacy path resolution, where a real file (or its
    // index) means present.
    const legacy = join(SCRATCH, 'closure/legacy/node_modules/@a4p75/legacy')
    write(join(legacy, 'package.json'), JSON.stringify({ name: '@a4p75/legacy', version: '1.0.0', type: 'module' }))
    write(join(legacy, 'lib/thing.js'), 'export const thing = 1\n')
    write(join(legacy, 'nest/index.js'), 'export const nest = 1\n')
    expect(packageSubpathIsMissing(legacy, '@a4p75/legacy/lib/thing.js')).toBe(false)
    expect(packageSubpathIsMissing(legacy, '@a4p75/legacy/lib/thing')).toBe(false)
    expect(packageSubpathIsMissing(legacy, '@a4p75/legacy/nest')).toBe(false)
    expect(packageSubpathIsMissing(legacy, '@a4p75/legacy/lib/nope.js')).toBe(true)
    // An unreadable manifest is unknown, and unknown is never a miss.
    expect(packageSubpathIsMissing(join(SCRATCH, 'closure/no-such-dir'), '@a4p75/x/y')).toBe(false)
    // Pattern exports (`./features/*`) cover what an exact-key lookup would miss.
    const patterned = join(SCRATCH, 'closure/patterned/node_modules/@a4p75/pat')
    write(join(patterned, 'package.json'), JSON.stringify({ name: '@a4p75/pat', version: '1.0.0', exports: { '.': './index.js', './*': './dist/*' } }))
    expect(packageSubpathIsMissing(patterned, '@a4p75/pat/features/a.js')).toBe(false)
    // A string `exports` publishes `.` only: every subpath is unpublished.
    const stringy = join(SCRATCH, 'closure/stringy/node_modules/@a4p75/str')
    write(join(stringy, 'package.json'), JSON.stringify({ name: '@a4p75/str', version: '1.0.0', exports: './index.js' }))
    expect(packageSubpathIsMissing(stringy, '@a4p75/str/anything.js')).toBe(true)
  })
})

// ── composition-surface fixtures ────────────────────────────────────────────

interface SurfaceOptions {
  rows?: readonly string[]
  externals?: readonly string[]
  entryThrows?: boolean
  /**
   * Source-level overrides, because the row object has to be REAL code inside
   * the synthetic bundle: `apply: 'undefined'` emits a missing export, and
   * `inject: '[]'` emits an empty list.
   */
  pluginExports?: Partial<{ name: string; apply: string; inject: string }>
  bundleAdvertisedAs?: string
  shimVersion?: string
  platform?: string
  glueRel?: string
  seamRels?: readonly string[]
  installSurfaces?: readonly string[]
  /** Extra files to create, repo-relative, for advertised-path cases. */
  extraFiles?: readonly string[]
  /** Write a shim manifest that advertises nothing at all. */
  blankShimManifest?: boolean
}

const SURFACE_ROOT = join(SCRATCH, 'surface')

/**
 * Write a synthetic composition surface: a root manifest, a client manifest,
 * and `<compositionDir>/{client-bundle.js,index.js,package.json}`. The bundle
 * text is the upstream `window.__ModuleLoader__.load` format, reduced to what
 * the checks read — so a red here means a check stopped matching, not that a
 * fixture went malformed.
 */
function buildSurface(caseName: string, options: SurfaceOptions = {}) {
  const root = join(SURFACE_ROOT, caseName)
  const compositionDir = join(root, CLIENT_COMPOSITION_DIR)
  const rows = options.rows ?? CLIENT_ROW_IDS
  const externals = options.externals ?? CLIENT_MODULE_TABLE_EXTERNALS
  const plugin = {
    name: JSON.stringify(CLIENT_PLUGIN_NAME),
    apply: 'function apply() {}',
    inject: "['slots', 'sessions']",
    ...options.pluginExports,
  }
  const nameValue = plugin.name
  const applyValue = plugin.apply
  const injectValue = plugin.inject
  const bundle = [
    'var __dshFactory = (require) => {',
    '  const __extReq = (spec) => require(spec);',
    ...(options.entryThrows ? ['  throw new TypeError("module-scope defect");'] : []),
    `  const exports = { name: ${nameValue}, apply: ${applyValue}, inject: ${injectValue} };`,
    ...externals.map((spec) => `  __extReq(${JSON.stringify(spec)});`),
    '  return exports;',
    '};',
    ...rows.map((id) => `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: __dshFactory });`),
    '',
  ].join('\n')
  write(join(compositionDir, CLIENT_BUNDLE_FILENAME), bundle)
  write(join(compositionDir, CLIENT_NODE_HALF_FILENAME), 'export function apply(ctx) { void ctx }\n')
  write(join(compositionDir, 'package.json'), JSON.stringify(options.blankShimManifest === true ? {
    // A manifest that advertises nothing: `manifest-targets-resolve` over an
    // empty set is vacuous, so the surface arm must fail on that alone rather
    // than call an unknown artifact shipped.
    name: CLIENT_SHIM_ROW_ID,
    version: options.shimVersion ?? '1.2.3',
    private: true,
    type: 'module',
  } : {
    name: CLIENT_SHIM_ROW_ID,
    version: options.shimVersion ?? '1.2.3',
    private: true,
    type: 'module',
    exports: {
      '.': `./${CLIENT_NODE_HALF_FILENAME}`,
      './client': options.bundleAdvertisedAs ?? `./${CLIENT_BUNDLE_FILENAME}`,
      './package.json': './package.json',
    },
    dsh: { client: { platform: options.platform ?? 'web' } },
    files: [CLIENT_BUNDLE_FILENAME, CLIENT_NODE_HALF_FILENAME],
  }, null, 2))
  write(join(root, 'package.json'), JSON.stringify({
    name: '@a4p75/fake-host',
    version: '1.2.3',
    type: 'module',
    exports: { '.': `./${CLIENT_COMPOSITION_DIR}/${CLIENT_NODE_HALF_FILENAME}` },
    files: [...INSTALL_SURFACES],
  }, null, 2))
  write(join(root, 'packages/client/package.json'), JSON.stringify({ name: '@a4p75/client', version: '1.2.3' }, null, 2))

  const hostEntryFile = join(root, 'packages/runtime/dist/packages/runtime/src/plugin/host.js')
  write(hostEntryFile, 'export const host = 1\n')
  const glueRel = options.glueRel ?? 'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs'
  write(join(root, glueRel), 'export const glue = 1\n')
  const seamRels = options.seamRels ?? ['packages/runtime/root-binding/harness/seam.mjs']
  for (const rel of seamRels) write(join(root, rel), 'export const seam = 1\n')
  for (const rel of options.extraFiles ?? []) write(join(root, rel), 'export const extra = 1\n')

  const hostModule = {
    defaultGlueUrl: (hostModuleUrl: string) => new URL('./live/agent-bindings.mjs', hostModuleUrl).href,
    defaultSeamUrlCandidates: (hostModuleUrl: string) => [
      new URL('../../../../../root-binding/harness/seam.mjs', hostModuleUrl).href,
      new URL('../../root-binding/harness/seam.mjs', hostModuleUrl).href,
    ],
  }
  return { caseName, root, compositionDir, hostEntryFile, hostModule, glueRel }
}

async function surfaceOf(options: SurfaceOptions = {}, caseName = 'case') {
  const fixture = buildSurface(caseName, options)
  const result = await checkCompositionSurface({
    repoRoot: fixture.root,
    installSurfaces: options.installSurfaces ?? INSTALL_SURFACES,
    hostEntryFile: fixture.hostEntryFile,
    hostModule: fixture.hostModule,
    gluePlacementDist: fixture.glueRel,
  })
  return { ...result, fixture }
}

describe('composition-smoke offline composition surface', () => {
  afterAll(() => {
    rmSync(SCRATCH, { recursive: true, force: true })
  })

  it('passes every arm on a well-formed surface', async () => {
    const { checks } = await surfaceOf({}, 'green')
    expect(checks.filter((check) => !check.ok).map((check) => `${check.id}: ${check.detail}`)).toEqual([])
    expect(readCheck(checks, 'plugin-row-registrations').detail).toContain(CLIENT_ROW_IDS[1] ?? '')
  })

  it('is red when a plugin row stops being registered', async () => {
    const { checks } = await surfaceOf({ rows: [CLIENT_ROW_IDS[0] ?? ''] }, 'row-missing')
    const check = readCheck(checks, 'plugin-row-registrations')
    expect(check.ok).toBe(false)
    expect(check.detail).toContain(CLIENT_SHIM_ROW_ID)
  })

  it('is red when a registered row id drifts by one character', async () => {
    const { checks } = await surfaceOf({ rows: [CLIENT_ROW_IDS[0] ?? '', `${CLIENT_SHIM_ROW_ID}-typo`] }, 'row-typo')
    expect(readCheck(checks, 'plugin-row-registrations').ok).toBe(false)
  })

  it('is red when our own top-level code throws at evaluation', async () => {
    const { checks } = await surfaceOf({ entryThrows: true }, 'throws')
    expect(readCheck(checks, 'bundle-module-graph-evaluates').ok).toBe(false)
    expect(readCheck(checks, 'bundle-module-graph-evaluates').detail).toContain('module-scope defect')
    expect(readCheck(checks, 'plugin-row-exports').ok).toBe(false)
  })

  it('is red when the row loses its apply export', async () => {
    const { checks } = await surfaceOf({ pluginExports: { apply: 'undefined' } }, 'no-apply')
    expect(readCheck(checks, 'plugin-row-exports').detail).toContain('apply')
    expect(readCheck(checks, 'plugin-row-exports').ok).toBe(false)
  })

  it('is red when the row name drifts from the pinned value', async () => {
    const { checks } = await surfaceOf({ pluginExports: { name: JSON.stringify(`${CLIENT_PLUGIN_NAME}-drift`) } }, 'name-drift')
    expect(readCheck(checks, 'plugin-row-exports').detail).toContain(CLIENT_PLUGIN_NAME)
    expect(readCheck(checks, 'plugin-row-exports').ok).toBe(false)
  })

  it('is red when the bundle requires a specifier the host module table does not serve', async () => {
    const { checks } = await surfaceOf({ externals: [...CLIENT_MODULE_TABLE_EXTERNALS, 'not-a-served-external'] }, 'extra-external')
    const check = readCheck(checks, 'external-specifier-set')
    expect(check.ok).toBe(false)
    expect(check.detail).toContain('not-a-served-external')
  })

  it('is red when the configured baseline names an external the bundle no longer uses', async () => {
    const { checks } = await surfaceOf({ externals: CLIENT_MODULE_TABLE_EXTERNALS.slice(1) }, 'stale-external')
    expect(readCheck(checks, 'external-specifier-set').ok).toBe(false)
  })

  it('is red when an advertised artifact path does not exist', async () => {
    const { checks } = await surfaceOf({ bundleAdvertisedAs: './client-bundle-typo.js' }, 'bad-path')
    const check = readCheck(checks, 'manifest-targets-resolve')
    expect(check.ok).toBe(false)
    expect(check.detail).toContain('client-bundle-typo.js')
  })

  it('is red when the composition output is not inside a shipped install surface', async () => {
    const { checks } = await surfaceOf({ installSurfaces: ['packages/runtime/dist'] }, 'outside-surface')
    expect(readCheck(checks, 'composition-bundle-is-install-surface').ok).toBe(false)
  })

  // Review round: the two tests above could both be satisfied by an arm that
  // compared the caller's own constants to each other, and the arm DID —
  // `expectations.bundleInstallPath` against `installSurfaces`, both handed in
  // from `client-composition-surface.mjs`, true for every artifact state. These
  // two drive the ARM through the artifact on disk instead.
  it('is red when the built manifest advertises a path outside the install surface', async () => {
    // The advertised file EXISTS, so `manifest-targets-resolve` stays green and
    // only the surface question can go red. This is the shape a real builder
    // regression produces: the manifest points a consumer at a file that no git
    // install copies and that `check:artifacts` never compares.
    const outside = '../dist/packages/client/src/plugin/client.js'
    const { checks } = await surfaceOf({
      bundleAdvertisedAs: outside,
      extraFiles: ['packages/client/dist/packages/client/src/plugin/client.js'],
    }, 'advertised-outside')
    const check = readCheck(checks, 'composition-bundle-is-install-surface')
    expect(check.ok).toBe(false)
    expect(check.detail).toContain('packages/client/dist/packages/client/src/plugin/client.js')
    expect(readCheck(checks, 'manifest-targets-resolve').ok).toBe(true)
  })

  it('is red when the built manifest advertises nothing at all', async () => {
    // An empty advertised set would make the containment loop vacuously green;
    // "we know of no path" is not evidence that everything ships.
    const { checks } = await surfaceOf({ blankShimManifest: true }, 'blank-manifest')
    const check = readCheck(checks, 'composition-bundle-is-install-surface')
    expect(check.ok).toBe(false)
    expect(check.detail).toContain('no `exports`/`files` path')
  })

  it('is red when a recorded manifest value drifts', async () => {
    const drifted = await surfaceOf({ shimVersion: '9.9.9' }, 'version-drift')
    expect(readCheck(drifted.checks, 'shim-recorded-values').detail).toContain('9.9.9')
    expect(readCheck(drifted.checks, 'shim-recorded-values').ok).toBe(false)
    const wrongPlatform = await surfaceOf({ platform: 'node' }, 'platform-drift')
    expect(readCheck(wrongPlatform.checks, 'shim-recorded-values').ok).toBe(false)
  })

  it('is red when a file the runtime derives a URL for is not on disk', async () => {
    const noGlue = await surfaceOf({ glueRel: 'packages/runtime/dist/packages/runtime/src/plugin/live/elsewhere.mjs' }, 'glue-missing')
    expect(readCheck(noGlue.checks, 'derived-urls-resolve').detail).toContain('glue')
    expect(readCheck(noGlue.checks, 'derived-urls-resolve').ok).toBe(false)
    const noSeam = await surfaceOf({ seamRels: ['packages/runtime/nowhere/seam.mjs'] }, 'seam-missing')
    expect(readCheck(noSeam.checks, 'derived-urls-resolve').ok).toBe(false)
  })
})

describe('composition-smoke required arm set', () => {
  const arm = (id: string) => ({ id, ok: true, detail: `${id} ok` })

  it('accepts exactly the set it requires, and names both kinds of difference', () => {
    const complete = REQUIRED_CHECK_IDS.map(arm)
    expect(checkSetDifferences(complete)).toEqual({ missing: [], unexpected: [] })
    const dropped = complete.filter((check) => check.id !== 'plugin-row-exports')
    expect(checkSetDifferences(dropped).missing).toEqual(['plugin-row-exports'])
    expect(checkSetDifferences(dropped).unexpected).toEqual([])
    // A rename is the same disappearance wearing a new name: it has to fail on
    // both sides, or a renamed arm reads as a green extra line plus a shrug.
    const renamed = complete.map((check) => (check.id === 'plugin-row-exports' ? { ...check, id: 'plugin-row-exportz' } : check))
    expect(checkSetDifferences(renamed).missing).toEqual(['plugin-row-exports'])
    expect(checkSetDifferences(renamed).unexpected).toEqual(['plugin-row-exportz'])
    // The pre-fix state this guard exists for: no arms at all.
    expect(checkSetDifferences([]).missing.length).toBe(REQUIRED_CHECK_IDS.length)
  })

  it('requires by id every arm this repository actually reports', async () => {
    const hostEntryFile = join(REPO_ROOT, 'packages/runtime/dist/packages/runtime/src/plugin/host.js')
    const hostModule = await import(pathToFileURL(hostEntryFile).href)
    const result = await checkCompositionSurface({
      repoRoot: REPO_ROOT,
      installSurfaces: INSTALL_SURFACES,
      hostEntryFile,
      hostModule: {
        defaultGlueUrl: hostModule.defaultGlueUrl,
        defaultSeamUrlCandidates: hostModule.defaultSeamUrlCandidates,
      },
      gluePlacementDist: 'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs',
    })
    expect(checkSetDifferences(result.checks)).toEqual({ missing: [], unexpected: [] })
  }, 60_000)
})

describe('composition-smoke against this repository', () => {
  it('checks the committed client artifact and reports every arm green', async () => {
    const hostEntryFile = join(REPO_ROOT, 'packages/runtime/dist/packages/runtime/src/plugin/host.js')
    const hostModule = await import(pathToFileURL(hostEntryFile).href)
    const result = await checkCompositionSurface({
      repoRoot: REPO_ROOT,
      installSurfaces: INSTALL_SURFACES,
      hostEntryFile,
      hostModule: {
        defaultGlueUrl: hostModule.defaultGlueUrl,
        defaultSeamUrlCandidates: hostModule.defaultSeamUrlCandidates,
      },
      gluePlacementDist: 'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs',
    })
    const red = result.checks.filter((check) => !check.ok).map((check) => `${check.id}: ${check.detail}`)
    expect(red).toEqual([])
  }, 60_000)

  it('agrees with the bundle on which externals the host must supply', () => {
    const bundle = readFileSync(join(REPO_ROOT, CLIENT_COMPOSITION_DIR, CLIENT_BUNDLE_FILENAME), 'utf8')
    expect(staticExternalRequests(bundle).sort()).toEqual([...CLIENT_MODULE_TABLE_EXTERNALS].sort())
  })

  it('reads the drift a renamed require would cause, straight off the emitted text', () => {
    expect(staticExternalRequests('const a = __extReq("react");\n')).toEqual(['react'])
    expect(staticExternalRequests('const a = __extReq("react/typo");\n')).toEqual(['react/typo'])
    expect(staticExternalRequests('no require calls here')).toEqual([])
  })

  it('still finds the composition output where the builder writes it', () => {
    expect(existsSync(join(REPO_ROOT, CLIENT_COMPOSITION_DIR, CLIENT_BUNDLE_FILENAME))).toBe(true)
    expect(existsSync(join(REPO_ROOT, CLIENT_COMPOSITION_DIR, CLIENT_NODE_HALF_FILENAME))).toBe(true)
    expect(INSTALL_SURFACES).toContain(CLIENT_COMPOSITION_DIR)
  })
})
