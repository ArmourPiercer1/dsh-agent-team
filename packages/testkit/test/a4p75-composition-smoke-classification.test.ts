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
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  classifyClosureStep,
  formatSkipDetail,
  scanModuleClosure,
} from '../../../scripts/composition-smoke-closure.mjs'
import {
  checkCompositionSurface,
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
    for (const caseName of ['ok', 'upstream', 'own-bug', 'throws']) {
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
  write(join(compositionDir, 'package.json'), JSON.stringify({
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
