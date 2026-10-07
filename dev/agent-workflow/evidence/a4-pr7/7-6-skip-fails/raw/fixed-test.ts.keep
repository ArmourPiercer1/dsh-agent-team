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
 *
 * SKIP-FAILS ROUND (A4-PR7 7.6) added the two describes at the bottom of this
 * file. They exist because the sentence above — "a gate must not be able to go
 * quiet" — was only ever enforced about the PRINTING, never about the VERDICT:
 * the gate printed `1 step NOT RUN and NOT passed` in complete honesty and
 * exited **0** beside it, so everything downstream that reads the exit code
 * (Task 7.6's machine gate, any `&&` chain, any CI) inherited a green from a run
 * that had verified one arm fewer than it claimed. The new legs drive the whole
 * gate script end to end over three fixture repositories — every arm runnable,
 * one arm skipped, one arm genuinely broken — because the contract that failed
 * was a process exit code, and no in-process call into `checkCompositionSurface`
 * can produce one. See the block above `GATE_ROOT` for the contract they pin and
 * for why the synthetic skip is injected as a FILE rather than as a switch.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  classifyClosureStep,
  collectExportTargets,
  exportPatternTarget,
  formatSkipDetail,
  isInsideNodeModules,
  packageSubpathIsMissing,
  packageSubpathVerdict,
  resolutionFailureOf,
  scanModuleClosure,
} from '../../../scripts/composition-smoke-closure.mjs'
import {
  REQUIRED_CHECK_IDS,
  advertisedShimPaths,
  checkCompositionSurface,
  checkSetDifferences,
  renderSurfaceStepLines,
  staticExternalRequests,
} from '../../../scripts/composition-smoke-bundle.mjs'
import { PLUGIN_TARGETS } from '../../../scripts/composition-smoke-targets.mjs'
import type { CompositionSmokeTarget } from '../../../scripts/composition-smoke-targets.mjs'
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
  untraversedItems: [],
  subpathBails: [],
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

/**
 * The three round-2 fixtures: a wildcard-covered subpath whose mapped target
 * is absent, a present package with no followable target, and an `exports`
 * value this check cannot read. A helper because the classifier's `afterAll`
 * deletes SCRATCH, and the describes that read these run after it — a fixture
 * that is gone reads as a scan that found nothing, which is the exact
 * confusion this round is about.
 */
function writeRound3ClosureFixtures(root: string): void {
  for (const caseName of ['wildcard', 'untraversed', 'bail']) {
    // Each fixture is its own ESM package, exactly as in the classifier's
    // `beforeAll`: without it the `.js` files inherit whatever `type` the
    // nearest manifest declares, and a SyntaxError stands in for the error
    // under test.
    write(join(root, caseName, 'package.json'), JSON.stringify({ name: `@a4p75/fixture-${caseName}`, type: 'module' }, null, 2))
  }
  // (9) the SECOND-round laundering case: the subpath IS covered, by a
  //     wildcard `exports` key, and the file the pattern maps it to does not
  //     exist. Matching the key on prefix and suffix alone answered "covered",
  //     so our own dangling import rode along with the host's gap and printed
  //     a SKIP byte-identical to a healthy one. The real artifact reached this
  //     exact shape through `@deepseek-ai/dsh-client-store`, which publishes
  //     `"./src/*": "./src/*"`.
  for (const caseName of ['wildcard', 'untraversed', 'bail']) {
    for (const [rel, text] of Object.entries(UPSTREAM_WITH_UNDECLARED_DEPS)) {
      write(join(root, caseName, rel), text)
    }
}
write(join(root, 'wildcard/node_modules/@a4p75/wild/package.json'), JSON.stringify({
  name: '@a4p75/wild',
  version: '1.0.0',
  type: 'module',
  exports: { '.': './index.js', './src/*': './src/*' },
}))
write(join(root, 'wildcard/node_modules/@a4p75/wild/index.js'), 'export const wild = 1\n')
write(join(root, 'wildcard/node_modules/@a4p75/wild/src/real.js'), 'export const real = 1\n')
// Non-entry own file again: the entry itself is linked before the host's gap
// is even reached, so an own defect in a chunk is the shape that used to vanish.
write(join(root, 'wildcard/dist/own-side.js'), "import { nope } from '@a4p75/wild/src/nope.js'\nexport const ownSide = nope\n")
write(join(root, 'wildcard/dist/entry.js'), "import { up } from '@a4p75/upstream'\nimport { ownSide } from './own-side.js'\nexport const clientEntry = up + ownSide\n")

// (10) a present package whose `exports["."]` target is absent: nothing here
//      is a miss, but the scan cannot follow it either. It lands in
//      `untraversed`, which is only worth anything once the SKIP line prints
//      it — see the test that reads this fixture.
write(join(root, 'untraversed/node_modules/@a4p75/broken-entry/package.json'), JSON.stringify({
  name: '@a4p75/broken-entry',
  version: '1.0.0',
  type: 'module',
  exports: { '.': './lib/absent.js' },
}))
write(join(root, 'untraversed/node_modules/@a4p75/broken-entry/lib/present.js'), 'export const present = 1\n')
write(join(root, 'untraversed/dist/own-side.js'), "import { z } from '@a4p75/broken-entry'\nexport const ownSide = z\n")
write(join(root, 'untraversed/dist/entry.js'), "import { up } from '@a4p75/upstream'\nimport { ownSide } from './own-side.js'\nexport const clientEntry = up + ownSide\n")

// (11) an `exports` value this check cannot read. Not a miss — a BAIL — and
//      the bail has to reach the output, or "I could not tell" is once again
//      a silent pass.
write(join(root, 'bail/node_modules/@a4p75/odd/package.json'), JSON.stringify({
  name: '@a4p75/odd',
  version: '1.0.0',
  type: 'module',
  exports: { '.': './index.js', './src/*': { import: 42 } },
}))
write(join(root, 'bail/node_modules/@a4p75/odd/index.js'), 'export const odd = 1\n')
write(join(root, 'bail/dist/own-side.js'), "import { whatever } from '@a4p75/odd/src/whatever.js'\nexport const ownSide = whatever\n")
write(join(root, 'bail/dist/entry.js'), "import { up } from '@a4p75/upstream'\nimport { ownSide } from './own-side.js'\nexport const clientEntry = up + ownSide\n")
}

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

    writeRound3ClosureFixtures(root)
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
    // Pattern exports (`./features/*`) cover what an exact-key lookup would
    // miss — but "covered" is a claim about the file the pattern maps to, not
    // about the key. The assertions here used to be the laundering itself:
    // `@a4p75/pat/features/a.js` mapped to a `dist/` that did not exist and was
    // called present, because the key matched on prefix and suffix alone. Node
    // answers `ERR_MODULE_NOT_FOUND` for that shape (measured against
    // `@deepseek-ai/dsh-client-store`'s `"./src/*": "./src/*"`), so that is what
    // is pinned now, in both directions.
    const patterned = join(SCRATCH, 'closure/patterned/node_modules/@a4p75/pat')
    write(join(patterned, 'package.json'), JSON.stringify({ name: '@a4p75/pat', version: '1.0.0', exports: { '.': './index.js', './*': './dist/*' } }))
    write(join(patterned, 'dist/exists.js'), 'export const exists = 1\n')
    // `./*` -> `./dist/*`, so `@a4p75/pat/exists.js` is `dist/exists.js`.
    expect(packageSubpathIsMissing(patterned, '@a4p75/pat/exists.js')).toBe(false)
    expect(packageSubpathIsMissing(patterned, '@a4p75/pat/nope.js')).toBe(true)
    // A key that matches but whose value cannot be read is a bail, not a miss.
    expect(packageSubpathIsMissing(patterned, '@a4p75/pat/nope.js', {
      fileExists: () => false,
      readJson: () => ({ name: '@a4p75/pat', exports: { './*': { import: 42 } } }),
    })).toBe(false)
    // A string `exports` publishes `.` only: every subpath is unpublished.
    const stringy = join(SCRATCH, 'closure/stringy/node_modules/@a4p75/str')
    write(join(stringy, 'package.json'), JSON.stringify({ name: '@a4p75/str', version: '1.0.0', exports: './index.js' }))
    expect(packageSubpathIsMissing(stringy, '@a4p75/str/anything.js')).toBe(true)
  })
})

describe('composition-smoke exports pattern mapping (round 2 R1)', () => {
  beforeAll(() => {
    writeRound3ClosureFixtures(join(SCRATCH, 'closure'))
  })

  it('does not launder a wildcard-covered subpath of an installed package', () => {
    const root = join(SCRATCH, 'closure/wildcard')
    const entryFile = join(root, 'dist/entry.js')
    const closure = scanModuleClosure({ entryFile, repoRoot: root })
    // The review-round shape, third variant: the key matched, the mapped file did
    // not exist, and the answer given was "covered".
    expect(closure.ownUnresolved.map((entry) => entry.specifier)).toEqual(['@a4p75/wild/src/nope.js'])
    expect(closure.ownUnresolved[0]?.zone).toBe('own')
    expect(closure.ownUnresolved[0]?.importer).toContain(join('dist', 'own-side.js'))
    expect(closure.untraversed).toBe(0)
    expect(closure.subpathBails).toEqual([])
    // And the gate question, on the real import attempt: the host's gap still
    // wins Node's link race, so ONLY the scan can keep this red. Measured on the
    // real artifact, this exact shape printed output identical to a healthy run
    // at exit 0 (round-2 receipt R1).
    const loadError = nodeResolutionError(entryFile)
    expect(loadError.code).toBe('ERR_MODULE_NOT_FOUND')
    expect(loadError.message).toContain('@a4p75/no-such-clsx')
    const decision = classifyClosureStep({ entryExists: true, closure, loadError })
    expect(decision.status).toBe('fail')
    expect(decision.why).toContain('@a4p75/wild/src/nope.js')
    // The file the pattern DID map to an existing file stays unremarkable, so
    // this is a claim about the absent target and not a ban on pattern exports.
    const ok = packageSubpathVerdict(join(root, 'node_modules/@a4p75/wild'), '@a4p75/wild/src/real.js')
    expect(ok.missing).toBe(false)
    expect(ok.bail).toBeNull()
  })

  const ioWith = (files: readonly string[], exportsField: unknown) => ({
    fileExists: (target: string) => files.some((rel) => target.endsWith(rel)),
    readJson: () => ({ name: '@a4p75/any', exports: exportsField }),
  })

  it('maps a pattern key through its VALUE and looks for the mapped file', () => {
    const io = ioWith(['dist/exists.js'], { './*': './*' })
    const present = packageSubpathVerdict('/pkg', '@a4p75/any/dist/exists.js', io)
    expect(present.missing).toBe(false)
    expect(present.bail).toBeNull()
    const absent = packageSubpathVerdict('/pkg', '@a4p75/any/dist/nope.js', io)
    expect(absent.missing).toBe(true)
    // The name of the mapped target, not just of the specifier: the reader has
    // to be able to see WHICH file the manifest sent the resolver to.
    expect(absent.why).toContain('exports[./*] -> ./dist/nope.js')
  })

  it('maps through conditional and array values, every string being a real path', () => {
    const conditional = ioWith(['lib/real.js'], { './*': { import: './*' } })
    expect(packageSubpathVerdict('/pkg', '@a4p75/any/lib/real.js', conditional).missing).toBe(false)
    const nestedAbsent = packageSubpathVerdict('/pkg', '@a4p75/any/lib/nope.js', conditional)
    expect(nestedAbsent.missing).toBe(true)
    expect(nestedAbsent.why).toContain('exports[./*].import -> ./lib/nope.js')
    // A candidate array: present under one condition is present.
    const candidates = ioWith(['lib/real.js'], { './*': [{ types: './*.d.ts' }, { import: './*' }] })
    expect(packageSubpathVerdict('/pkg', '@a4p75/any/lib/real.js', candidates).missing).toBe(false)
  })

  it('bails, never claims, on a shape it cannot read — and an unmodelled value cannot hide an absent one', () => {
    const unreadable = packageSubpathVerdict('/pkg', '@a4p75/any/src/x.js', ioWith([], { './src/*': { import: 42 } }))
    expect(unreadable.missing).toBe(false)
    expect(unreadable.bail).toContain('cannot map')
    // The hard case: the readable half maps to nothing. Reporting a miss would
    // be honest about that half, but a bail is what keeps the check from
    // over-reporting on a package whose shape it does not understand — and the
    // bail is printed, so the run still changes text.
    const mixed = packageSubpathVerdict('/pkg', '@a4p75/any/src/x.js', ioWith([], { './src/*': [{ import: './gone/*' }, { weird: null }] }))
    expect(mixed.missing).toBe(false)
    expect(mixed.bail).toContain('pattern-covered but absent')
    // An exact key with no readable target is a bail for the same reason.
    const emptyKey = packageSubpathVerdict('/pkg', '@a4p75/any/x.js', ioWith([], { './x.js': {} }))
    expect(emptyKey.missing).toBe(false)
    expect(emptyKey.bail).toContain('no string target')
  })

  it('substitutes the captured text into the value, the way Node does', () => {
    expect(exportPatternTarget('./src/*', './src/*', './src/deep/x.js')).toBe('./src/deep/x.js')
    expect(exportPatternTarget('./*', './dist/features/*.js', './a')).toBe('./dist/features/a.js')
    expect(exportPatternTarget('./src/*', './fixed.js', './src/a.js')).toBe('./fixed.js')
    // A key that does not cover the subpath maps to nothing at all.
    expect(exportPatternTarget('./src/*', './src/*', './lib/a.js')).toBeNull()
    expect(exportPatternTarget('./exact', './lib/a.js', './other')).toBeNull()
    expect(collectExportTargets({ import: './a.js', require: ['./b.js', { types: './c.d.ts' }] }).targets)
      .toEqual([
        { label: 'exports.import', target: './a.js' },
        { label: 'exports.require[0]', target: './b.js' },
        { label: 'exports.require[1].types', target: './c.d.ts' },
      ])
    expect(collectExportTargets({}).understood).toBe(false)
    expect(collectExportTargets([]).understood).toBe(false)
    expect(collectExportTargets(null).understood).toBe(false)
  })
})

describe('composition-smoke what-the-scan-held-back (round 2 N2)', () => {
  const SKIP_MISSING = ['@a4p75/no-such-clsx', '@a4p75/deep-missing']

  beforeAll(() => {
    writeRound3ClosureFixtures(join(SCRATCH, 'closure'))
  })

  it('prints the untraversed specifiers, so a held-back scan is not silent', () => {
    const root = join(SCRATCH, 'closure/untraversed')
    const entryFile = join(root, 'dist/entry.js')
    const closure = scanModuleClosure({ entryFile, repoRoot: root })
    expect(closure.untraversed).toBe(1)
    expect(closure.untraversedItems.map((item: { specifier: string }) => item.specifier)).toEqual(['@a4p75/broken-entry'])
    // Still a SKIP: a present-but-unfollowable target is not our defect, and the
    // upstream gap that wins the link race is not either.
    const loadError = nodeResolutionError(entryFile)
    expect(classifyClosureStep({ entryExists: true, closure, loadError }).status).toBe('skip')
    // And the line it prints says so. This is the whole point of the item lists:
    // before them, `untraversed: 0` and `untraversed: 1` printed the same
    // characters, which is how a laundered defect looked at the gate.
    const clean = formatSkipDetail(SKIP_MISSING, { untraversed: [] })
    const held = formatSkipDetail(SKIP_MISSING, { untraversed: closure.untraversedItems })
    expect(clean).toBe(`host module closure unavailable — 2 unresolvable: ${SKIP_MISSING.join(', ')}`)
    expect(held).not.toBe(clean)
    expect(held).toContain('1 UNTRAVERSED')
    expect(held).toContain('@a4p75/broken-entry')
  })

  it('prints a bail it took, and does not turn that bail into an own-zone failure', () => {
    const root = join(SCRATCH, 'closure/bail')
    const closure = scanModuleClosure({ entryFile: join(root, 'dist/entry.js'), repoRoot: root })
    // A bail is not a miss: the own zone stays clean, because nothing was proven.
    expect(closure.ownUnresolved).toEqual([])
    expect(closure.subpathBails.map((item: { specifier: string }) => item.specifier)).toEqual(['@a4p75/odd/src/whatever.js'])
    const loadError = nodeResolutionError(join(root, 'dist/entry.js'))
    const decision = classifyClosureStep({ entryExists: true, closure, loadError })
    expect(decision.status).toBe('skip')
    const line = formatSkipDetail(decision.missing ?? [], { bails: closure.subpathBails })
    expect(line).toContain('1 SUBPATH CHECK BAIL')
    expect(line).toContain('@a4p75/odd/src/whatever.js')
    // Capped: a pathological graph must not make the line unbounded.
    const many = Array.from({ length: 7 }, (_unused, index) => ({
      specifier: `@a4p75/many${index}/x`, importer: 'i', zone: 'own' as const, reason: 'r',
    }))
    const capped = formatSkipDetail([], { bails: many })
    expect(capped).toContain('+2 more')
    expect(capped).not.toContain('@a4p75/many6/x')
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
  /**
   * Advertise the bundle through a CONDITIONAL value
   * (`{ "import": <bundleAdvertisedAs> }`) instead of a bare string. A
   * conditional target is the file a consumer under the `import` condition
   * actually loads, so both path arms have to see it; reading only string values
   * made every nested target invisible to them.
   */
  bundleAdvertisedConditionally?: boolean
  /** Advertise an `exports` value with nothing readable inside it. */
  unreadableExportValue?: boolean
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
 *
 * `root` defaults to this suite's scratch dir; the verdict tests below pass a
 * fixture-repo root of their own, because they run the WHOLE gate and a whole
 * gate derives its repo root from where its script sits.
 */
function buildSurface(caseName: string, options: SurfaceOptions = {}, root = join(SURFACE_ROOT, caseName)) {
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
      './client': options.bundleAdvertisedConditionally === true
        ? { import: options.bundleAdvertisedAs ?? `./${CLIENT_BUNDLE_FILENAME}` }
        : options.bundleAdvertisedAs ?? `./${CLIENT_BUNDLE_FILENAME}`,
      ...(options.unreadableExportValue === true ? { './broken': { import: null } } : {}),
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

  it('is red when a CONDITIONAL export target lies outside the install surface', async () => {
    // The same defect as the test above, written the way a real builder writes
    // it. Flattening the value is what makes the arm able to see it: measured on
    // the real artifact, `{ import: '../outside/…' }` printed
    // `all 4 path(s) … land inside an install surface` and passed, where the
    // flat form of the identical path printed 5 and failed.
    const outside = '../dist/packages/client/src/plugin/client.js'
    const { checks } = await surfaceOf({
      bundleAdvertisedAs: outside,
      bundleAdvertisedConditionally: true,
      extraFiles: ['packages/client/dist/packages/client/src/plugin/client.js'],
    }, 'conditional-outside')
    const check = readCheck(checks, 'composition-bundle-is-install-surface')
    expect(check.ok).toBe(false)
    // Labelled by the condition path, so the reader knows which manifest entry
    // to go fix.
    expect(check.detail).toContain('exports[./client].import')
    expect(readCheck(checks, 'manifest-targets-resolve').ok).toBe(true)
  })

  it('is red when a CONDITIONAL export target does not exist, and sees it in both arms', async () => {
    const { checks } = await surfaceOf({
      bundleAdvertisedAs: './gone.js',
      bundleAdvertisedConditionally: true,
    }, 'conditional-missing')
    expect(readCheck(checks, 'manifest-targets-resolve').ok).toBe(false)
    expect(readCheck(checks, 'manifest-targets-resolve').detail).toContain('shim exports[./client].import -> ./gone.js')
    // Inside the surface, so the surface arm stays green: the two questions are
    // still asked separately.
    expect(readCheck(checks, 'composition-bundle-is-install-surface').ok).toBe(true)
  })

  it('is red when an export value has nothing readable in it, rather than counting one fewer path', async () => {
    // Skipping a non-string value is what made a nested path uncheckable. An
    // unreadable value is still advertised, so it has to be reported as
    // "nothing can be shown to ship", not silently dropped from the count.
    const { checks } = await surfaceOf({ unreadableExportValue: true }, 'unreadable-value')
    const surface = readCheck(checks, 'composition-bundle-is-install-surface')
    expect(surface.ok).toBe(false)
    expect(surface.detail).toContain('exports[./broken] has no readable string target')
    expect(readCheck(checks, 'manifest-targets-resolve').detail).toContain('shim exports[./broken] has no readable string target')
  })

  it('flattens conditional export values into the paths it checks', () => {
    const paths = advertisedShimPaths({
      exports: {
        '.': './index.js',
        './client': { types: './client.d.ts', import: '../outside/client.js' },
        './broken': { import: null },
      },
      files: ['bundle.js'],
    }, 'packages/client/composition-shim')
    expect(paths.map((entry: { label: string; path: string | null }) => [entry.label, entry.path])).toEqual([
      ['exports[.]', 'packages/client/composition-shim/index.js'],
      ['exports[./client].types', 'packages/client/composition-shim/client.d.ts'],
      ['exports[./client].import', 'packages/client/outside/client.js'],
      ['exports[./broken]', null],
      ['files[bundle.js]', 'packages/client/composition-shim/bundle.js'],
    ])
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

  it('prints one line per required id, in the required order, whatever the arms report', () => {
    const complete = REQUIRED_CHECK_IDS.map(arm)
    const lines = renderSurfaceStepLines({ checks: complete }, 'packages/client/composition-shim')
    // The line set is built FROM the required ids, so what can be reported and
    // what can be printed are the same list. Order too: the healthy output is
    // stable whatever order the arms happened to record in.
    expect(lines.map((line: { id: string }) => line.id)).toEqual([...REQUIRED_CHECK_IDS])
    expect(lines.every((line: { ok: boolean }) => line.ok)).toBe(true)
    // Reported in a different order than required, printed in the required one:
    // the order of the output comes from the id list, not from the arms. Without
    // this, an implementation that just echoed `surface.checks` in report order
    // would satisfy the assertion above by luck.
    const shuffled = [...REQUIRED_CHECK_IDS].reverse().map(arm)
    expect(renderSurfaceStepLines({ checks: shuffled }, 'x').map((line: { id: string }) => line.id))
      .toEqual([...REQUIRED_CHECK_IDS])
    expect(lines[0]?.text).toMatch(/^PASS client bundle composition-output-present \(packages\/client\/composition-shim\): /)
  })

  it('prints a FAIL for an arm that stopped reporting, instead of no line', () => {
    const dropped = REQUIRED_CHECK_IDS.map(arm).filter((check) => check.id !== 'plugin-row-exports')
    const lines = renderSurfaceStepLines({ checks: dropped }, 'packages/client/composition-shim')
    expect(lines.map((line: { id: string }) => line.id)).toEqual([...REQUIRED_CHECK_IDS])
    const line = lines.find((candidate: { id: string }) => candidate.id === 'plugin-row-exports')
    expect(line?.ok).toBe(false)
    expect(line?.text).toContain('never reported')
    // Nothing at all reported is the same failure at full width.
    const nothing = renderSurfaceStepLines({ checks: [] }, 'packages/client/composition-shim')
    expect(nothing.every((entry: { ok: boolean }) => entry.ok === false)).toBe(true)
    expect(nothing.length).toBe(REQUIRED_CHECK_IDS.length)
  })

  it('prints a FAIL for an arm that renamed itself', () => {
    const renamed = REQUIRED_CHECK_IDS.map((id) => arm(id === 'plugin-row-exports' ? 'plugin-row-exportz' : id))
    const lines = renderSurfaceStepLines({ checks: renamed }, 'packages/client/composition-shim')
    expect(lines.find((line: { id: string }) => line.id === 'plugin-row-exports')?.ok).toBe(false)
    const checkSet = lines.find((line: { id: string }) => line.id === 'check-set')
    expect(checkSet?.ok).toBe(false)
    expect(checkSet?.text).toContain('reported but not required [plugin-row-exportz]')
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

// ── the gate as a whole: an unrun step is not a passing gate ────────────────

/**
 * THE GATE CONTRACT, in the form the next integrator has to write it — plan
 * Task 7.6's machine-gate leg, and the same three clauses now sit in the header
 * of `scripts/composition-smoke.mjs`, where a reader of the gate looks:
 *
 *   1. no line of the output matches `^SKIP `;
 *   2. the closure-gated client leg appears BY NAME behind a `PASS ` prefix;
 *   3. the footer carries no `NOT RUN` clause.
 *
 * Never the exit code alone: it read **0** across a skipped step for a whole
 * review round, which is the defect these legs exist to make impossible to
 * re-introduce. And never a literal arm count — a leg that asserts "11 lines"
 * is satisfied by a gate that has lost an arm, which is ADR X10's failure mode
 * wearing a different hat.
 *
 * WHY A FIXTURE REPOSITORY, when the subject is a process exit code. The gate
 * derives its repo root from its own file location, so the only tree it will
 * ever examine is the one it lives in — and in this workspace the client
 * closure can never resolve, which makes a green run unproducible here at all
 * (measured: `SKIP … 17 unresolvable`, and `--config.hoist=false` makes it 25).
 * So each case gets a repository of its own under `.tmp-fault/`: the gate's own
 * scripts copied in BYTE-IDENTICALLY (digest-compared below, because a stale or
 * edited copy would silently become the thing under test) plus a surface that is
 * complete except for the one thing the case is about.
 *
 * HOW THE SKIP IS INJECTED, and why it is not a knob. The synthetic skip is a
 * FILE: a third-party fixture package inside the fixture's own `node_modules`
 * asking for a package nothing installs, reached from a fixture entry the gate
 * imports for real. The decision the gate makes is made on `existsSync` and
 * `readFileSync` over a tree written at run time, so there is no literal
 * `if (false)` anywhere for a bundler to erase — the trap recorded in
 * `SESSION_ROUTER_LOG.md` (round 8) is an injected constant, and the strongest
 * non-foldable shape is a filesystem read the bundler cannot see at all.
 * Injecting through a `globalThis` read instead would have meant the GATE
 * consulting a global, i.e. a runtime override on a security-adjacent gate;
 * `scripts/composition-smoke-closure.mjs:729` records "no environment or CLI
 * knob" as a measured property of this file family, and a knob that can add an
 * arm is a knob that can be argued into removing one. The leg below therefore
 * pins that emptiness rather than weakening it, and the FINDINGS record
 * (`dev/agent-workflow/evidence/a4-pr7/7-6-skip-fails/FINDINGS.md`) states the
 * deviation from the requested injection mechanism and this reason for it.
 */
const GATE_ROOT = join(REPO_ROOT, 'packages/testkit/test/.tmp-fault/a4p75-gate-verdict')

/** Every script the gate reaches by relative path; copied verbatim per fixture. */
const GATE_SCRIPT_FILES = [
  'composition-smoke.mjs',
  'composition-smoke-bundle.mjs',
  'composition-smoke-closure.mjs',
  'composition-smoke-targets.mjs',
  'composition-smoke-assets-loader.mjs',
  'client-composition-surface.mjs',
  'place-dist-glue.mjs',
] as const

/**
 * The step lines a complete run owes, DERIVED from the two lists the gate
 * iterates. Nothing below states this number, and nothing below states the
 * arm names either: both come from the gate's own lists, so adding an arm adds
 * a requirement to these legs in the same commit that adds it to the gate.
 */
const EXPECTED_STEP_LINES = PLUGIN_TARGETS.length + REQUIRED_CHECK_IDS.length

/** The closure-gated arm, located by ROLE — the flag, never the label text. */
function closureGatedArm(): CompositionSmokeTarget {
  const found = PLUGIN_TARGETS.find((target) => target.closureGate === true)
  if (found === undefined) {
    throw new Error('the arm list carries no closure-gated target, so there is no step a skip verdict could be about')
  }
  return found
}

const CLIENT_ARM: CompositionSmokeTarget = closureGatedArm()

function sha256Of(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

/**
 * Copy the gate into a fixture repo and PROVE the copy is the shipped file.
 * Without the digest comparison the suite would be measuring whatever happened
 * to be in the scratch directory, and a scratch directory is exactly where a
 * stale copy lives.
 */
function installGateScripts(root: string): void {
  for (const name of GATE_SCRIPT_FILES) {
    const source = join(REPO_ROOT, 'scripts', name)
    const target = join(root, 'scripts', name)
    write(target, readFileSync(source, 'utf8'))
    if (sha256Of(target) !== sha256Of(source)) {
      throw new Error(`the fixture copy of scripts/${name} differs from the shipped script`)
    }
  }
}

/** The three states the top-level verdict is exercised across. */
type GateCase = 'green' | 'skipped' | 'failed'

/**
 * A built entry, written from the arm's own description rather than from a
 * remembered path or name: the label, the plugin `name` export and the
 * fail-loud contract all come from `PLUGIN_TARGETS`, so an arm added to the
 * gate gets a fixture and a required leg here in the same commit, and an arm
 * renamed in the gate cannot be quietly satisfied by the old fixture.
 *
 * `ready-rejection` is the host contract — `apply` resolves, and the loud
 * failure travels through the `teamRoot` facade's `ready` promise with the
 * pinned typed code; the two URL derivations the bundle arms read are the real
 * host's, so `derived-urls-resolve` measures a graph and not a placeholder.
 */
function gateEntrySource(target: CompositionSmokeTarget, entryCase: GateCase): string {
  if (target.contract === 'ready-rejection') {
    return [
      `export const name = ${JSON.stringify(target.expectedName)}`,
      'export function apply(ctx) {',
      `  const failure = new Error(${JSON.stringify(`fixture: the ${target.label} row config is missing`)})`,
      `  failure.code = ${JSON.stringify(target.expectCode ?? 'NO_PINNED_CODE')}`,
      "  ctx.provide('teamRoot', { ready: Promise.reject(failure) })",
      '}',
      "export const defaultGlueUrl = (hostModuleUrl) => new URL('./live/agent-bindings.mjs', hostModuleUrl).href",
      'export const defaultSeamUrlCandidates = (hostModuleUrl) => [',
      "  new URL('../../../../../root-binding/harness/seam.mjs', hostModuleUrl).href,",
      "  new URL('../../root-binding/harness/seam.mjs', hostModuleUrl).href,",
      ']',
      '',
    ].join('\n')
  }
  const body = [
    `export const name = ${JSON.stringify(target.expectedName)}`,
    "export const inject = ['slots', 'sessions']",
    'export function apply() {',
    '  throw new TypeError(\'fixture: the mount dereferenced a seam service it was never given\')',
    '}',
    '',
  ]
  if (entryCase === 'skipped') {
    // A THIRD-PARTY file asks for the package nothing installs. That is the
    // whole mechanism: `SKIP` requires the gap to sit behind a file outside
    // this repository's own artifact, so the injected state is the real state,
    // only smaller.
    return [
      "import { gap } from '@a4p75/upstream'",
      'export const pulledFromUpstream = gap',
      ...body,
    ].join('\n')
  }
  if (entryCase === 'failed') {
    // An own defect: it must stay RED for its own reason, never reclassified.
    return [
      "throw new TypeError('fixture: our own artifact threw while evaluating')",
      ...body,
    ].join('\n')
  }
  return body.join('\n')
}

/** A complete fixture repository whose only variable is the client entry. */
function buildGateRepo(entryCase: GateCase): string {
  const root = join(GATE_ROOT, entryCase)
  buildSurface(`gate-${entryCase}`, {}, root)
  // The real `packages/client/package.json` is `type: module` and its version
  // is what `shim-recorded-values` compares the shim against; the shared surface
  // fixture writes neither, so the manifest these entries load under is rewritten
  // here rather than in the builder every other case in this file depends on.
  write(join(root, 'packages/client/package.json'), JSON.stringify({
    name: '@a4p75/client',
    version: '1.2.3',
    type: 'module',
  }, null, 2))
  for (const target of PLUGIN_TARGETS) write(join(root, target.rel), gateEntrySource(target, entryCase))
  if (entryCase === 'skipped') {
    write(join(root, 'node_modules/@a4p75/upstream/package.json'), JSON.stringify({
      name: '@a4p75/upstream',
      version: '1.0.0',
      type: 'module',
      exports: { '.': './lib/index.js' },
    }, null, 2))
    write(join(root, 'node_modules/@a4p75/upstream/lib/index.js'),
      "import { nope } from '@a4p75/no-such-clsx'\nexport const gap = nope\n")
  }
  installGateScripts(root)
  return root
}

/** One run of the real gate script, parsed into the parts the contract names. */
function runGate(root: string) {
  const run = spawnSync(process.execPath, [join(root, 'scripts/composition-smoke.mjs')], {
    encoding: 'utf8',
    cwd: root,
  })
  const lines = (run.stdout ?? '').split('\n').filter((line) => line.length > 0)
  const footer = lines.at(-1) ?? ''
  return {
    status: run.status,
    stdout: run.stdout ?? '',
    stderr: run.stderr ?? '',
    lines,
    footer,
    steps: lines.filter((line) => line !== footer),
    skips: lines.filter((line) => line.startsWith('SKIP ')),
    passes: lines.filter((line) => line.startsWith('PASS ')),
    failures: lines.filter((line) => line.startsWith('FAIL ')),
  }
}

/**
 * The clause-by-clause form of the contract, as a function so a leg can name
 * WHICH clause a run broke instead of only that it broke. Returns the reasons
 * the run is NOT green: empty means every clause held.
 */
function notGreenBecause(output: ReturnType<typeof runGate>): string[] {
  const reasons: string[] = []
  if (output.skips.length > 0) reasons.push(`a step printed SKIP: ${output.skips[0] ?? ''}`)
  if (!output.passes.some((line) => line.startsWith(`PASS ${CLIENT_ARM.label}:`))) {
    reasons.push(`the closure-gated leg did not print PASS by name (${CLIENT_ARM.label})`)
  }
  if (output.footer.includes('NOT RUN')) reasons.push('the footer carries a NOT RUN clause')
  return reasons
}

describe('composition-smoke verdict: an unrun step is not a passing gate', () => {
  let green: ReturnType<typeof runGate>
  let skipped: ReturnType<typeof runGate>
  let failed: ReturnType<typeof runGate>

  beforeAll(() => {
    rmSync(GATE_ROOT, { recursive: true, force: true })
    green = runGate(buildGateRepo('green'))
    skipped = runGate(buildGateRepo('skipped'))
    failed = runGate(buildGateRepo('failed'))
  }, 120_000)

  afterAll(() => {
    rmSync(GATE_ROOT, { recursive: true, force: true })
  })

  it('exits 0 with every arm green once the closure can resolve', () => {
    // The state this workspace cannot produce, so it is built: without it the
    // fix would be unfalsifiable — every "skip is red" leg passes trivially if
    // nothing in the suite can ever print a green footer.
    expect(green.footer).toBe('PASS composition-smoke')
    expect(green.status).toBe(0)
    expect(green.skips).toEqual([])
    expect(green.failures).toEqual([])
    expect(green.steps.filter((line) => line.startsWith(`PASS ${CLIENT_ARM.label}:`))).toHaveLength(1)
  })

  it('exits non-zero when a step is skipped, and still prints the SKIP line with its reason', () => {
    expect(skipped.status).not.toBe(0)
    // The SKIP line keeps naming the step and why, unchanged: the fix is the
    // verdict, never a quieter report of the skip.
    expect(skipped.skips).toHaveLength(1)
    expect(skipped.skips[0]).toContain(CLIENT_ARM.label)
    expect(skipped.skips[0]).toContain('@a4p75/no-such-clsx')
    // And the red is attributable to that one step and nothing else.
    expect(skipped.failures).toHaveLength(1)
    expect(skipped.failures[0]).toBe(
      `FAIL composition-smoke — 1 step NOT RUN and NOT passed: ${CLIENT_ARM.label}. `
      + 'A skipped step is an unverified claim, not a green one.',
    )
    expect(skipped.stdout).not.toContain('PASS composition-smoke')
  })

  it('still exits 1 on a real failure, with that failure\'s own message and no skip clause', () => {
    expect(failed.status).toBe(1)
    expect(failed.skips).toEqual([])
    expect(failed.failures.some((line) => line.includes('our own artifact threw while evaluating'))).toBe(true)
    // A failure that did not skip anything must not borrow the skip footer.
    expect(failed.footer).toBe('FAIL composition-smoke')
  })

  it('owes exactly as many step lines as the two lists the gate iterates, by name', () => {
    // Derivation, not number: every plugin arm label and every required bundle
    // id has to appear, so the count below cannot be met by an empty set and a
    // stale literal cannot hide a dropped arm.
    expect(PLUGIN_TARGETS.length).toBeGreaterThan(0)
    expect(REQUIRED_CHECK_IDS.length).toBeGreaterThan(0)
    for (const target of PLUGIN_TARGETS) {
      expect(green.steps.some((line) => line.startsWith(`PASS ${target.label}:`))).toBe(true)
    }
    for (const id of REQUIRED_CHECK_IDS) {
      expect(green.steps.some((line) => line.includes(`bundle ${id} (`))).toBe(true)
    }
    expect(green.steps).toHaveLength(EXPECTED_STEP_LINES)
    // A skipped step still prints its line: the count is what proves the verdict
    // went red WITHOUT the report going quiet.
    expect(skipped.steps).toHaveLength(EXPECTED_STEP_LINES)
  })

  it('passes the Task 7.6 assertion form on a green run and rejects it on a skipping run', () => {
    // The form itself, driven both ways: a contract nobody has seen fail is a
    // contract that might be satisfied by anything.
    expect(notGreenBecause(green)).toEqual([])
    expect(notGreenBecause(skipped)).toEqual([
      `a step printed SKIP: ${skipped.skips[0] ?? ''}`,
      `the closure-gated leg did not print PASS by name (${CLIENT_ARM.label})`,
      'the footer carries a NOT RUN clause',
    ])
    // The failing run trips clauses 2 and 3-of-one but never the SKIP clause:
    // each clause answers to a different defect, which is the whole reason the
    // leg is three clauses and not an exit code.
    expect(notGreenBecause(failed)).toEqual([
      `the closure-gated leg did not print PASS by name (${CLIENT_ARM.label})`,
    ])
  })

  it('injects the skip by fixture, not by knob: the gate reads no env, argv, or global', () => {
    // The property `composition-smoke-closure.mjs:729` records as measured, now
    // pinned: there is no runtime override on this gate, which is why the
    // synthetic skip above had to be a file. A test seam here would be a mute
    // seam with a test written against it.
    for (const name of ['composition-smoke.mjs', 'composition-smoke-bundle.mjs', 'composition-smoke-targets.mjs']) {
      const source = readFileSync(join(REPO_ROOT, 'scripts', name), 'utf8')
      expect({ name, hits: source.match(/process\.env|globalThis|process\.argv/g) ?? [] }).toEqual({ name, hits: [] })
    }
  })
})

describe('composition-smoke verdict against this repository', () => {
  it('never reports a passing gate over a step it did not run', () => {
    // The real gate, the real artifact, this workspace's real install surface:
    // whichever way the client closure falls out here, the verdict and the
    // output have to agree. At the base of this change the output said
    // `NOT RUN and NOT passed` while the exit code said 0.
    const run = runGate(REPO_ROOT)
    if (run.skips.length === 0) {
      expect(notGreenBecause(run)).toEqual([])
      expect(run.status).toBe(0)
      return
    }
    expect(run.status).not.toBe(0)
    expect(run.footer).toContain('NOT RUN and NOT passed')
    for (const skip of run.skips) {
      expect(run.footer).toContain(skip.slice('SKIP '.length).split(':')[0] ?? '')
    }
  }, 120_000)
})
