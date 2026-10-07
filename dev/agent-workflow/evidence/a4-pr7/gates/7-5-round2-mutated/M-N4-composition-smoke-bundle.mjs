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
 *   - a path the built manifest advertises     -> `composition-bundle-is-install-surface`
 *     that lies outside the surface a git
 *     install copies, so it ships to nobody
 *   - our own top-level code throwing        -> `bundle-module-graph-evaluates`
 *   - a glue/seam mismatch against
 *     `packages/runtime/dist`                -> `derived-urls-resolve`
 *   - drift in what the bundle requires      -> `external-specifier-set`
 *   - an arm that stopped being reported,    -> `REQUIRED_CHECK_IDS` and
 *     stopped being PRINTED, or changed its        `renderSurfaceStepLines`,
 *     name, so `PASS composition-smoke` could      applied by
 *     print over a gate that had quietly             `composition-smoke.mjs`
 *     shrunk
 *
 * THE THREE MUTES THIS HAD, and which are closed by construction rather than by
 * discipline (a review found the first closed and the next two still open, so the
 * distinction is worth stating instead of implying):
 *   1. an arm stops being REPORTED. Closed mechanically: the line set is built by
 *      iterating `REQUIRED_CHECK_IDS`, so an absent check becomes a printed FAIL
 *      ("never reported") instead of an absent line.
 *   2. a reported arm stops being PRINTED (a filter at the print site: measured,
 *      that printed the healthy output minus one line and exited 0). Closed
 *      mechanically, because nothing iterates the returned checks any more — the
 *      only iteration is over required ids — and the caller re-derives the
 *      printed set from the very array it prints, so a filter upstream of that
 *      derivation is itself a red line.
 *   3. an author deletes an id from `REQUIRED_CHECK_IDS`, drops its `record()`
 *      call, or filters BETWEEN the caller's last derivation and `console.log`.
 *      Not closable inside this program: the guard and the guarded thing are the
 *      same text. That one is author-visible by policy, which is why the id list
 *      is a named set in one place with its reason attached, and why every change
 *      to it needs its own red proof.
 *
 * What is asserted mechanically is asserted about LINES, not about the array a
 * function returned: the earlier guard validated the returned array and the print
 * site was free to disagree with it.
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

import { collectExportTargets } from './composition-smoke-closure.mjs'
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
 * The arms this module is REQUIRED to report, by name.
 *
 * Hand-declared, and deliberately NOT derived from the `checks` array: the
 * defect is an arm that stops being emitted, so whatever catches it has to live
 * outside the emitting code. Before this list existed the smoke printed one
 * line per returned check and failed only on `ok === false`, so dropping an arm
 * — or returning no arms at all — printed `PASS composition-smoke` over a gate
 * that had stopped checking (measured: 8 lines, exit 0; 0 lines, exit 0). That
 * is the lint-mute failure mode exactly: the healthy output, minus the check.
 *
 * It is a SET OF NAMES, not a count: an arm may only be added or retired by
 * editing this list in the same commit as its `record()` call and its red
 * proof, and a renamed id fails on both sides at once.
 *
 * This list is also what the output is PRINTED from — see
 * {@link renderSurfaceStepLines}. Reporting and printing cannot diverge, because
 * there is one iteration and it is over these names.
 */
export const REQUIRED_CHECK_IDS = Object.freeze([
  'composition-output-present',
  'composition-bundle-is-install-surface',
  'manifest-targets-resolve',
  'shim-recorded-values',
  'plugin-row-registrations',
  'bundle-module-graph-evaluates',
  'plugin-row-exports',
  'external-specifier-set',
  'derived-urls-resolve',
])

/**
 * Which required ids went unreported, and which reported ids were never
 * required. Both directions matter: the first is a disappeared arm, the second
 * is an arm renamed (which otherwise reads as the first plus a free pass).
 */
export function checkSetDifferences(checks) {
  const reported = (checks ?? []).map((check) => check.id)
  const missing = REQUIRED_CHECK_IDS.filter((id) => !reported.includes(id))
  const unexpected = [...new Set(reported)].filter((id) => !REQUIRED_CHECK_IDS.includes(id))
  return { missing, unexpected }
}

/**
 * One line of this step's output, and whether it is green.
 *
 * The step's output is built HERE, by iterating {@link REQUIRED_CHECK_IDS}, and
 * never by iterating what `checkCompositionSurface` returned. That is the whole
 * point: the previous version printed `surface.checks` and separately compared
 * that same array against the required set, so a filter at the print site —
 * `surface.checks.filter((c) => c.id !== 'external-specifier-set')` — produced
 * the healthy output minus one line at exit 0 while the guard stayed satisfied,
 * because the guard was reading the array and the terminal was reading something
 * else. An id that is required has to appear here or the run is red, whatever the
 * arms decided to report.
 */
export function renderSurfaceStepLines(surface, compositionDir) {
  const checks = surface?.checks ?? []
  const byId = new Map()
  for (const check of checks) {
    if (!byId.has(check.id)) byId.set(check.id, check)
  }
  const label = (id) => `client bundle ${id} (${compositionDir})`
  const lines = []
  for (const id of REQUIRED_CHECK_IDS) {
    const check = byId.get(id)
    if (check === undefined) {
      lines.push({
        id,
        ok: false,
        text: `FAIL ${label(id)}: never reported — an arm that stopped reporting is a closed gate, not a green one`,
      })
      continue
    }
    const ok = check.ok === true
    lines.push({ id, ok, text: `${ok ? 'PASS' : 'FAIL'} ${label(id)}: ${check.detail}` })
  }
  const { unexpected } = checkSetDifferences(checks)
  if (unexpected.length > 0) {
    lines.push({
      id: 'check-set',
      ok: false,
      text: `FAIL client bundle check-set (${compositionDir}): reported but not required [${unexpected.join(', ')}] — `
        + 'an arm that changed its name reads as one that disappeared',
    })
  }
  return lines
}

/**
 * Every artifact path the BUILT shim manifest advertises, repo-relative and
 * normalised. This is what a consumer of the package is told to load — the
 * `exports` targets and the `files` entries of the manifest sitting on disk in
 * the composition directory, not a path this module was handed.
 *
 * An `exports` VALUE is flattened, not type-tested: `{ "import": "../outside/x.js" }`
 * tells a consumer to load exactly that file, and reading only string values made
 * every nested target invisible to both path arms (measured: a conditional target
 * outside both install surfaces printed `all 4 path(s) … land inside an install
 * surface` and passed, where the flat form of the same path printed 5 and failed).
 * A value with nothing readable inside it is still ADVERTISED, with `path: null`,
 * so the arms say so instead of counting one fewer path.
 */
export function advertisedShimPaths(shimManifest, compositionDir) {
  const advertised = []
  const manifest = shimManifest !== null && typeof shimManifest === 'object' ? shimManifest : {}
  const exportsField = typeof manifest.exports === 'object' && manifest.exports !== null ? manifest.exports : {}
  for (const [key, value] of Object.entries(exportsField)) {
    if (process.env.DSH_A4P75_MUTE === 'M-N4' && typeof value !== 'string') continue
    const collected = collectExportTargets(value, `exports[${key}]`)
    for (const entry of collected.targets) {
      advertised.push({ label: entry.label, path: normaliseRepoPath(join(compositionDir, entry.target)) })
    }
    if (collected.targets.length === 0 || !collected.understood) {
      advertised.push({ label: `exports[${key}]`, path: null })
    }
  }
  for (const entry of Array.isArray(manifest.files) ? manifest.files : []) {
    if (typeof entry !== 'string') continue
    advertised.push({ label: `files[${entry}]`, path: normaliseRepoPath(join(compositionDir, entry)) })
  }
  return advertised
}

/** `packages/x/./y/../z` -> `packages/x/z`, with forward slashes. */
function normaliseRepoPath(path) {
  const out = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return out.join('/')
}

/** Is a repo-relative path the surface itself or inside it? */
function isInsideSurface(path, surface) {
  const normalised = normaliseRepoPath(surface)
  return path === normalised || path.startsWith(`${normalised}/`)
}

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
  // ── 1b. every path the BUILT artifact advertises is inside a tracked surface ──
  //
  // Derived from the shim manifest ON DISK, never from `expectations`. The
  // earlier form compared `expectations.bundleInstallPath` with `installSurfaces`,
  // and the caller hands it both from one module: `CLIENT_BUNDLE_INSTALL_PATH`
  // IS `CLIENT_COMPOSITION_DIR + '/' + CLIENT_BUNDLE_FILENAME`, and
  // `INSTALL_SURFACES` contains `CLIENT_COMPOSITION_DIR`
  // (`client-composition-surface.mjs`). The arm was therefore true for every
  // artifact state and could not fail — measured: pointing the shipped
  // manifest's `exports["./client"]` at an existing file outside both surfaces
  // left it printing the same PASS line and exit 0 (review-round receipt
  // `7-5-review-round-mutations.txt`, R-3a). What the arm asks now is the
  // question that has a defect in it: does the manifest a consumer of this
  // package actually reads advertise anything outside the surface
  // `check:artifacts` compares and a git install copies? Such a path ships to
  // nobody and is invisible to every artifact gate in this repo.
  const rootManifest = readJson(rootManifestFile)
  const shimManifest = readJson(manifestFile)
  const advertised = advertisedShimPaths(shimManifest, expectations.compositionDir)
  const unreadable = advertised.filter((entry) => entry.path === null)
  const outsideSurface = advertised.filter(
    (entry) => entry.path !== null && !installSurfaces.some((surface) => isInsideSurface(entry.path, surface)),
  )
  const surfaceProblems = []
  if (advertised.length === 0) {
    surfaceProblems.push('the built shim manifest advertises no `exports`/`files` path at all, so nothing about it is known to ship')
  }
  surfaceProblems.push(...unreadable.map((entry) => `${entry.label} has no readable string target, so nothing can be shown to ship`))
  surfaceProblems.push(...outsideSurface.map((entry) => `${entry.label} -> ${entry.path}`))
  record(
    'composition-bundle-is-install-surface',
    surfaceProblems.length === 0,
    surfaceProblems.length === 0
      ? `all ${advertised.length} path(s) the built shim manifest advertises land inside an install surface check:artifacts compares (${installSurfaces.join(', ')})`
      : `the built shim manifest advertises something this check cannot pass (${installSurfaces.join(', ') || 'none given'}): ${surfaceProblems.join('; ')} — a path outside the tracked surface ships to nobody and no artifact gate sees it, and an unreadable target is not checked at all`,
  )

  // ── 2. every manifest path the artifact advertises resolves on disk ─────
  if (rootManifest === null || shimManifest === null) {
    record('manifest-targets-resolve', false, 'a manifest needed for the path check is unreadable or missing')
    record('shim-recorded-values', false, 'the shim manifest is unreadable or missing')
  } else {
    const broken = []
    // Nested and conditional values are flattened for the same reason as
    // `advertisedShimPaths`: the string inside `{ import: … }` is the file that
    // consumer is actually sent to. A value with no readable string is reported,
    // not skipped — skipping it is what made a nested path uncheckable, and an
    // `exports` value with nothing readable in it is broken under Node anyway.
    const manifestTargets = (manifest, which, base, exists) => {
      for (const [key, value] of Object.entries(manifest.exports ?? {})) {
        const collected = collectExportTargets(value, `exports[${key}]`)
        if (collected.targets.length === 0 || !collected.understood) {
          broken.push(`${which} exports[${key}] has no readable string target`)
          continue
        }
        for (const entry of collected.targets) {
          if (entry.target === './package.json') continue
          if (!exists(join(base, ...entry.target.replace(/^\.\//, '').split('/')))) broken.push(`${which} ${entry.label} -> ${entry.target}`)
        }
      }
    }
    manifestTargets(rootManifest, 'root', repoRoot, fileExists)
    for (const entry of rootManifest.files ?? []) {
      if (typeof entry !== 'string') continue
      if (!existsSync(join(repoRoot, ...entry.split('/')))) broken.push(`root files[${entry}]`)
    }
    manifestTargets(shimManifest, 'shim', compositionDir, fileExists)
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
