/**
 * composition-smoke-bundle.mjs — the workspace-side check of the composed
 * client artifact (A4-PR7 Task 7.5, added when the client LOAD step became a
 * SKIP instead of a false red).
 *
 * WHY. The load step imports the tsc-ESM client entry, which statically
 * imports `@deepseek-ai/dsh-client-ui-primitives` and therefore cannot be
 * linked by a bare Node process in this workspace at all (see
 * `composition-smoke-closure.mjs` for the measurement). If that step had simply
 * started printing SKIP, nothing in this repository would have checked the
 * client artifact any more — the 876 client vitest cases exercise SOURCE
 * modules, not the composed bundle, and the bundle is what a real host loads.
 * This module is the check that replaced the mute, and it needs no upstream
 * closure: the composed bundle is a browser facade whose only bare specifiers
 * are the four module-table externals, so everything below runs offline against
 * committed build output.
 *
 * WHAT IT PROVES, by real-defect class:
 *   - a missing plugin-row export            -> `plugin-row-exports`
 *   - a wrong artifact path / manifest path  -> `manifest-targets-resolve`,
 *                                               `composition-output-present`,
 *                                               `shim-recorded-values`
 *   - our own top-level code throwing        -> `bundle-module-graph-evaluates`
 *   - a glue/seam mismatch against
 *     `packages/runtime/dist`                -> `derived-urls-resolve`
 *   - drift in what the bundle requires      -> `external-specifier-set`
 *
 * HOW the bundle is read, and why. The bundle is the upstream client wire
 * format: one `var __dshFactory = (require) => { … }` plus
 * `window.__ModuleLoader__.load({ id, factory })` per row id. It is a SCRIPT,
 * not a module, and it touches the DOM at module scope (the identity-class CSS
 * injection table runs `document.createElement("style")` while the graph is
 * evaluated), so `import()` is not an option and neither is a bare Node
 * context. This file therefore runs it in a `node:vm` context that provides
 * exactly three things — `window.__ModuleLoader__` (recorded, never real), a
 * `document` whose elements are inert objects, and `console` — and hands the
 * factory an inert namespace for every specifier it requires, which is what
 * makes the check independent of the upstream closure. A browser API the
 * bundle needs and this surface does not provide fails the step loudly and
 * names the API: the stub is deliberately minimal so the check cannot rot into
 * a mock that asserts nothing. Shape is thus established by EVALUATION (real
 * `typeof` of the real exports), not by parsing an `export` list the bundle
 * does not have.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'

import {
  CLIENT_BUNDLE_FILENAME,
  CLIENT_BUNDLE_INSTALL_PATH,
  CLIENT_COMPOSITION_DIR,
  CLIENT_MODULE_TABLE_EXTERNALS,
  CLIENT_NODE_HALF_FILENAME,
  CLIENT_PLUGIN_NAME,
  CLIENT_ROW_IDS,
  CLIENT_SHIM_ROW_ID,
} from './client-composition-surface.mjs'

/** Default expectations — the builder's own constants, never a restatement. */
export const DEFAULT_EXPECTATIONS = Object.freeze({
  rowIds: CLIENT_ROW_IDS,
  externals: CLIENT_MODULE_TABLE_EXTERNALS,
  pluginName: CLIENT_PLUGIN_NAME,
  shimRowId: CLIENT_SHIM_ROW_ID,
  bundleInstallPath: CLIENT_BUNDLE_INSTALL_PATH,
  compositionDir: CLIENT_COMPOSITION_DIR,
  bundleFilename: CLIENT_BUNDLE_FILENAME,
  nodeHalfFilename: CLIENT_NODE_HALF_FILENAME,
})

const BUNDLE_REQUIRE_CALL = /__extReq\(\s*['"]([^'"]+)['"]\s*\)/g

/**
 * The minimum browser surface this bundle's module evaluation touches.
 *
 * `document.createElement` is not decoration: the facade injects every
 * `.module.css` text once while its graph evaluates, so without it the check
 * would report our own artifact as broken. Nothing here renders a component,
 * resolves a promise, or serves a host service — `apply()` is never called.
 */
export function createMinimalBrowserSurface() {
  const inertElement = () => ({
    setAttribute() {},
    appendChild() {},
    removeChild() {},
    textContent: '',
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    dataset: {},
    children: [],
  })
  const rows = []
  return {
    rows,
    sandbox: {
      window: { __ModuleLoader__: { load: (row) => rows.push(row) } },
      document: {
        createElement: () => inertElement(),
        createTextNode: () => ({}),
        head: inertElement(),
        body: inertElement(),
        documentElement: inertElement(),
      },
      console: { log() {}, warn() {}, error() {} },
    },
  }
}

/**
 * A namespace object for a module-table specifier. Property access yields
 * another inert namespace, so `prim.MarkdownText` or `jsx_runtime.jsx` read as
 * functions without any host code being loaded. This stands in for the host's
 * client module table for the one thing this check asks: WHICH specifiers the
 * bundle requires, and whether our own top-level code runs.
 */
function inertNamespace(specifier) {
  const target = function teamCompositionInert() { return undefined }
  return new Proxy(target, {
    get(_target, property) {
      if (property === Symbol.toStringTag) return 'Module'
      if (property === Symbol.toPrimitive) return () => `[inert ${specifier}]`
      if (property === 'then') return undefined
      return inertNamespace(`${specifier}.${String(property)}`)
    },
    apply: () => undefined,
    construct: () => ({}),
    has: () => true,
  })
}

/**
 * Evaluate the built bundle: run the registration script, then evaluate the
 * factory with inert externals. Never throws — every outcome is returned, so
 * the caller can report which stage failed.
 */
export function evaluateClientBundle(options) {
  const { bundleFile } = options
  const readFile = options.readFile ?? ((p) => readFileSync(p, 'utf8'))
  const outcome = {
    loaded: false,
    evaluated: false,
    error: null,
    registrations: [],
    requiredSpecifiers: [],
    namespace: null,
  }
  let text
  try {
    text = readFile(bundleFile)
  } catch (error) {
    outcome.error = `bundle is unreadable: ${error instanceof Error ? error.message : String(error)}`
    return outcome
  }
  const { rows, sandbox } = createMinimalBrowserSurface()
  try {
    vm.createContext(sandbox)
    new vm.Script(text, { filename: bundleFile }).runInContext(sandbox)
    outcome.loaded = true
  } catch (error) {
    outcome.error = `the registration script threw: ${error instanceof Error ? error.message : String(error)}`
    return outcome
  }
  outcome.registrations = rows.map((row) => row.id)
  const factory = rows.find((row) => typeof row.factory === 'function')?.factory
  if (factory === undefined) {
    outcome.error = 'no row registered a function factory (window.__ModuleLoader__.load received no factory)'
    return outcome
  }
  const required = new Set()
  try {
    outcome.namespace = factory((specifier) => {
      required.add(String(specifier))
      return inertNamespace(String(specifier))
    })
    outcome.evaluated = true
    outcome.requiredSpecifiers = [...required].sort()
  } catch (error) {
    outcome.error = `the factory's module graph threw while evaluating: ${error instanceof Error ? error.message : String(error)}`
  }
  return outcome
}

/** The specifiers the emitted code can require, read off the emitted calls. */
export function staticExternalRequests(bundleText) {
  const found = new Set()
  for (const match of bundleText.matchAll(BUNDLE_REQUIRE_CALL)) found.add(match[1])
  return [...found].sort()
}

function sameSet(left, right) {
  const a = [...new Set(left)].sort()
  const b = [...new Set(right)].sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

/**
 * The full offline check. Every arm returns a named result; the caller prints
 * one line per arm and fails on any `ok: false`.
 *
 * All paths are parameters so the arms are testable against fixtures — an
 * assertion nobody can drive red is an assertion nobody can trust.
 */
export async function checkCompositionSurface(options) {
  const repoRoot = options.repoRoot
  const expectations = { ...DEFAULT_EXPECTATIONS, ...(options.expectations ?? {}) }
  const fileExists = options.fileExists ?? ((p) => existsSync(p) && statSync(p).isFile())
  const readFile = options.readFile ?? ((p) => readFileSync(p, 'utf8'))
  const compositionDir = options.compositionDir ?? join(repoRoot, expectations.compositionDir)
  const bundleFile = options.bundleFile ?? join(compositionDir, expectations.bundleFilename)
  const nodeHalfFile = join(compositionDir, expectations.nodeHalfFilename)
  const manifestFile = join(compositionDir, 'package.json')
  const rootManifestFile = options.rootManifestFile ?? join(repoRoot, 'package.json')
  const clientManifestFile = options.clientManifestFile ?? join(repoRoot, 'packages', 'client', 'package.json')
  const installSurfaces = options.installSurfaces ?? []
  const hostEntryFile = options.hostEntryFile ?? null
  const hostModule = options.hostModule ?? null
  const gluePlacementDist = options.gluePlacementDist ?? null

  const readJson = (file) => {
    try {
      return JSON.parse(readFile(file))
    } catch {
      return null
    }
  }
  const checks = []
  const record = (id, ok, detail) => { checks.push({ id, ok, detail }); }

  // ── 1. the build output exists, and exists inside the tracked surface ──
  const missingOutputs = [bundleFile, nodeHalfFile, manifestFile].filter((f) => !fileExists(f))
  record(
    'composition-output-present',
    missingOutputs.length === 0,
    missingOutputs.length === 0
      ? `${expectations.compositionDir}/ carries ${expectations.bundleFilename}, ${expectations.nodeHalfFilename}, package.json`
      : `missing composition output: ${missingOutputs.join(', ')}`,
  )
  const insideSurface = installSurfaces.some((surface) => expectations.bundleInstallPath.startsWith(`${surface}/`))
  record(
    'composition-bundle-is-install-surface',
    insideSurface,
    insideSurface
      ? `${expectations.bundleInstallPath} is inside an install surface check:artifacts compares`
      : `${expectations.bundleInstallPath} is NOT inside any install surface (${installSurfaces.join(', ') || 'none given'}) — a bundle outside the tracked surface ships nothing`,
  )

  // ── 2. every manifest path the artifact advertises resolves on disk ─────
  const rootManifest = readJson(rootManifestFile)
  const shimManifest = readJson(manifestFile)
  if (rootManifest === null || shimManifest === null) {
    record('manifest-targets-resolve', false, 'a manifest needed for the path check is unreadable or missing')
    record('shim-recorded-values', false, 'the shim manifest is unreadable or missing')
  } else {
    const broken = []
    for (const [key, target] of Object.entries(rootManifest.exports ?? {})) {
      if (typeof target !== 'string') continue
      if (!fileExists(join(repoRoot, ...target.replace(/^\.\//, '').split('/')))) broken.push(`root exports[${key}] -> ${target}`)
    }
    for (const entry of rootManifest.files ?? []) {
      if (typeof entry !== 'string') continue
      if (!existsSync(join(repoRoot, ...entry.split('/')))) broken.push(`root files[${entry}]`)
    }
    for (const [key, target] of Object.entries(shimManifest.exports ?? {})) {
      if (typeof target !== 'string' || target === './package.json') continue
      if (!fileExists(join(compositionDir, ...target.replace(/^\.\//, '').split('/')))) broken.push(`shim exports[${key}] -> ${target}`)
    }
    for (const entry of shimManifest.files ?? []) {
      if (typeof entry !== 'string') continue
      if (!fileExists(join(compositionDir, entry))) broken.push(`shim files[${entry}]`)
    }
    record(
      'manifest-targets-resolve',
      broken.length === 0,
      broken.length === 0
        ? 'every root and shim manifest target resolves on disk'
        : `advertised artifact path does not exist: ${broken.join(', ')}`,
    )

    // ── 3. the values the builder RECORDED still match this tree ─────────
    const clientManifest = readJson(clientManifestFile)
    const drift = []
    if (shimManifest.name !== expectations.shimRowId) drift.push(`name ${JSON.stringify(shimManifest.name)} != ${JSON.stringify(expectations.shimRowId)}`)
    if (shimManifest.version !== clientManifest?.version) drift.push(`version ${JSON.stringify(shimManifest.version)} != packages/client ${JSON.stringify(clientManifest?.version)}`)
    if (shimManifest?.dsh?.client?.platform !== 'web') drift.push(`dsh.client.platform ${JSON.stringify(shimManifest?.dsh?.client?.platform)} != "web"`)
    for (const required of [expectations.bundleFilename, expectations.nodeHalfFilename]) {
      if (!(shimManifest.files ?? []).includes(required)) drift.push(`files omits ${required}`)
    }
    record(
      'shim-recorded-values',
      drift.length === 0,
      drift.length === 0
        ? `shim manifest records name/version/dsh.client.platform/files as the builder writes them (v${shimManifest.version})`
        : drift.join('; '),
    )
  }

  // ── 4/5/6. evaluate the real bundle ────────────────────────────────────
  const evaluation = fileExists(bundleFile)
    ? evaluateClientBundle({ bundleFile, readFile })
    : { loaded: false, evaluated: false, error: 'bundle file missing', registrations: [], requiredSpecifiers: [], namespace: null }
  record(
    'plugin-row-registrations',
    evaluation.loaded && sameSet(evaluation.registrations, expectations.rowIds),
    !evaluation.loaded
      ? `registration script did not run (${evaluation.error})`
      : sameSet(evaluation.registrations, expectations.rowIds)
        ? `registers both client row ids: ${evaluation.registrations.join(', ')}`
        : `registered [${evaluation.registrations.join(', ')}] but the host claims [${[...expectations.rowIds].join(', ')}]`,
  )
  record(
    'bundle-module-graph-evaluates',
    evaluation.evaluated,
    evaluation.evaluated
      ? `module graph evaluated with ${evaluation.requiredSpecifiers.length} inert module-table namespace(s) and no browser host`
      : evaluation.error ?? 'the factory never ran',
  )
  if (evaluation.evaluated && evaluation.namespace !== null) {
    const namespace = evaluation.namespace
    const problems = []
    if (namespace.name !== expectations.pluginName) problems.push(`name ${JSON.stringify(namespace.name)} != ${JSON.stringify(expectations.pluginName)}`)
    if (typeof namespace.apply !== 'function') problems.push(`apply is ${typeof namespace.apply}, not a function`)
    if (!Array.isArray(namespace.inject) || namespace.inject.length === 0) problems.push('inject is not a non-empty array')
    else if (!namespace.inject.every((entry) => typeof entry === 'string' && entry.length > 0)) problems.push('inject carries a non-string entry')
    record(
      'plugin-row-exports',
      problems.length === 0,
      problems.length === 0
        ? `name="${namespace.name}", apply is a function, inject lists ${namespace.inject.length} seam service(s)`
        : problems.join('; '),
    )
  } else {
    record('plugin-row-exports', false, 'not evaluable: the module graph did not produce a namespace')
  }

  // ── 7. external drift: what the bundle may require ─────────────────────
  let emitted = []
  try {
    emitted = staticExternalRequests(readFile(bundleFile))
  } catch {
    emitted = []
  }
  const required = [...new Set([...emitted, ...evaluation.requiredSpecifiers])].sort()
  const expected = [...expectations.externals].sort()
  const added = required.filter((spec) => !expected.includes(spec))
  const unused = expected.filter((spec) => !required.includes(spec))
  record(
    'external-specifier-set',
    added.length === 0 && unused.length === 0 && required.length > 0,
    added.length === 0 && unused.length === 0 && required.length > 0
      ? `requires exactly the host module table: ${required.join(', ')}`
      : `external set drifted — requires-but-unserved [${added.join(', ') || 'none'}], configured-but-not-required [${unused.join(', ') || 'none'}]`,
  )

  // ── 8. the URLs the built host derives at runtime resolve on disk ──────
  if (hostModule === null || hostEntryFile === null) {
    record('derived-urls-resolve', false, 'no built host module was supplied to derive the glue/seam URLs from')
  } else {
    const hostUrl = pathToFileURL(hostEntryFile).href
    const problems = []
    const tried = []
    const glueUrl = typeof hostModule.defaultGlueUrl === 'function' ? hostModule.defaultGlueUrl(hostUrl) : null
    if (glueUrl === null) {
      problems.push('the built host entry does not export defaultGlueUrl')
    } else {
      tried.push(glueUrl)
      if (!fileExists(fileURLToPath(glueUrl))) {
        problems.push(`the glue URL the host derives from its own module location does not exist: ${glueUrl}`)
      } else if (gluePlacementDist !== null) {
        const derived = fileURLToPath(glueUrl)
        const expectedGlue = join(repoRoot, ...gluePlacementDist.split('/'))
        if (derived !== expectedGlue) problems.push(`derived glue ${derived} is not the placed mirror ${expectedGlue}`)
      }
    }
    const candidates = typeof hostModule.defaultSeamUrlCandidates === 'function'
      ? [...hostModule.defaultSeamUrlCandidates(hostUrl)]
      : []
    if (candidates.length === 0) {
      problems.push('the built host entry exports no defaultSeamUrlCandidates')
    } else {
      tried.push(...candidates)
      const seamPath = (url) => fileURLToPath(url)
      if (!candidates.some((candidate) => fileExists(seamPath(candidate)))) {
        problems.push(`no seam candidate exists (tried: ${candidates.join(' | ')})`)
      }
    }
    record(
      'derived-urls-resolve',
      problems.length === 0,
      problems.length === 0
        ? `${tried.length} runtime-derived URL(s) resolve on disk (glue + seam candidates)`
        : problems.join('; '),
    )
  }

  return { ran: true, checks, evaluation }
}
