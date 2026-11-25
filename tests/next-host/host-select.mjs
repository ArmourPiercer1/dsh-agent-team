/**
 * host-select.mjs — WHICH pinned DSH host a harness grades against.
 *
 * The repo carries two pristine, pinned hosts:
 *
 *   legacy  `tests/deepseek-harness-test-use` — 0.2.0-rc.2 @ 639ed01539, and the
 *           `node_modules/@deepseek-ai/*` links the repo itself installs (rc.2)
 *   next    `tests/deepseek-harness-next`      — 0.2.2-rc.5 @ 9c2670d3bc
 *
 * A harness that says "on the real host" without saying WHICH host is the
 * substitution this whole lane exists to prevent. `TEAM_TEST_HOST=next` selects
 * the second one; unset (or `legacy`) keeps every existing caller on rc.2
 * byte-for-byte, so the selector is inert unless a lane opts in.
 *
 * WHAT SELECTION MEANS, precisely:
 *   - the host TREE (which `LocalFileSystem`, `dsh-tool-fs`, `Context` … come from);
 *   - every BARE `@deepseek-ai/*` import made by TEAM product code, which would
 *     otherwise resolve from the repo's rc.2 `node_modules` and silently mix two
 *     hosts in one world (`scripts/run-tests-hooks.mjs` consults this module);
 *   - the dispatch SHAPE (`tools.execute` batch on rc.5), because rc.5 changed
 *     the public call shape and a legacy-shaped call is not accepted there.
 *
 * FAIL-LOUD: an unknown value is refused (a typo must not silently select
 * legacy), and a `next` resolution that escapes the tree throws from
 * `resolveInsideTree` — never a fallback to rc.2.
 *
 * @module tests/next-host/host-select
 */
import { existsSync, realpathSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { assertNextHostTree, resolveInsideTree } from './host-next-lib.mjs'
import {
  CLIENT_COMMIT_HASH, DSH_BASELINE_VERSION, HOST_PORT_BANDS, NEXT_HOST, TEST_USE_BASELINE_SHA, findTestRepoRoot, testUseTree,
} from '../paths.mjs'

/** The one environment variable that selects a host. */
export const TEST_HOST_ENV = 'TEAM_TEST_HOST'

/**
 * The named refusal of the host selector. Every refusal path throws THIS type
 * with a machine-greppable `code`, so "which host" can never fail as a generic
 * assertion or (worse) silently fall back to the legacy install:
 *
 *   HOST_SELECTOR_UNKNOWN · HOST_MODULE_UNRESOLVED · HOST_RESOLUTION_ESCAPED
 *
 * The two resolution ADAPTERS (Node's ESM resolve hook and the Vite resolver
 * plugin) do not define their own failures: they call `createHostResolver()`
 * below and let this type travel.
 */
export class HostSelectionError extends Error {
  constructor(code, detail) {
    super(`host selection: ${code}: ${detail}`)
    this.name = 'HostSelectionError'
    this.code = code
  }
}

/**
 * The selected host generation.
 * @param {NodeJS.ProcessEnv} [env] - injectable for tests.
 * @returns {'legacy'|'next'}
 */
export function testHostMode(env = process.env) {
  const value = env[TEST_HOST_ENV]
  if (value === undefined || value === '' || value === 'legacy') return 'legacy'
  if (value === 'next') return 'next'
  throw new HostSelectionError('HOST_SELECTOR_UNKNOWN', `${TEST_HOST_ENV}=${JSON.stringify(value)} is not a host generation; use 'legacy' (0.2.0-rc.2) or 'next' (${NEXT_HOST.version} @ ${NEXT_HOST.shortSha})`)
}

/**
 * The bare-import resolver for the selected host.
 * @param {string} spec - bare package specifier.
 * @param {string} repoRoot - the Team checkout the harness lives in.
 * @param {'legacy'|'next'} [mode] - selected generation.
 * @returns {string} absolute entry file path.
 */
export function resolveSelectedHostModule(spec, repoRoot, mode = testHostMode()) {
  if (mode === 'next') {
    const { tree } = assertNextHostTree(repoRoot)
    return resolveInsideTree(spec, tree)
  }
  // The legacy host is the repo's OWN install. Anchor at packages/runtime, the
  // package that declares these dependencies: a worktree's root `node_modules`
  // can be a partial install (dangling links), while the per-package resolution
  // path is what every existing caller already used.
  const runtimeAnchor = join(resolve(repoRoot), 'packages', 'runtime', 'package.json')
  try {
    return createRequire(runtimeAnchor).resolve(spec)
  } catch (error) {
    if (error?.code !== 'MODULE_NOT_FOUND') throw error
    return createRequire(join(resolve(repoRoot), 'package.json')).resolve(spec)
  }
}

/**
 * The host tree a harness reads modules and the provider class from.
 * @param {string} repoRoot - the Team checkout the harness lives in.
 * @param {'legacy'|'next'} [mode] - selected generation.
 * @returns {string} absolute tree path (a symlink in a worktree, by design).
 */
export function selectedHostTree(repoRoot, mode = testHostMode()) {
  return mode === 'next' ? assertNextHostTree(repoRoot).tree : testUseTree(findTestRepoRoot(repoRoot) ?? repoRoot)
}

/**
 * The PIN the selected host is graded against, in one shape for both
 * generations. It is read from `tests/paths.mjs` (the pin authority) — never
 * re-typed by a caller — and for `next` it is the VERIFIED tree identity, so a
 * drifted checkout refuses here instead of being graded as the pin.
 *
 * `legacy` is the default, so a caller that does not opt in gets the same
 * 0.2.0-rc.2 pin it always had.
 *
 * @param {string} repoRoot - the Team checkout the harness lives in.
 * @param {'legacy'|'next'} [mode] - selected generation.
 * `clientCommitHash` is the DSH_CLIENT_COMMIT_HASH the launcher passes to skip
 * the in-build git spawn; it must be the SELECTED host's revision or the client
 * bundle is stamped with another generation's rev.
 *
 * @returns {{host: 'legacy'|'next', version: string, sha: string, clientCommitHash: string, tag: string|null, tree: string}}
 */
export function selectedHostPin(repoRoot, mode = testHostMode()) {
  if (mode === 'next') {
    const { tree, head, version } = assertNextHostTree(repoRoot)
    return { host: 'next', version, sha: head, clientCommitHash: NEXT_HOST.shortSha, tag: NEXT_HOST.tag, tree }
  }
  return {
    host: 'legacy',
    version: DSH_BASELINE_VERSION,
    sha: TEST_USE_BASELINE_SHA,
    clientCommitHash: CLIENT_COMMIT_HASH,
    tag: null,
    tree: testUseTree(findTestRepoRoot(repoRoot) ?? repoRoot),
  }
}

/**
 * The host-instance port bands the selected generation may lease.
 *
 * RULING (UTE-Prep, 2026-11-16): the bands are partitioned BY GENERATION —
 * legacy 3181-3199, the next host 13000-13049 only. A boot of the rc.5 tree on
 * a legacy port would violate the partition even though nothing asserts it, so
 * the band follows the same selector as the tree and the pin. Legacy is the
 * default and returns the exact array it always did.
 *
 * @param {'legacy'|'next'} [mode] - selected generation.
 * @returns {ReadonlyArray<readonly [number, number]>}
 */
export function selectedHostPortBands(mode = testHostMode()) {
  return mode === 'next' ? NEXT_HOST.portBands : HOST_PORT_BANDS
}

/**
 * The DSH_HOME basename suffix for the selected generation. The next-host lane
 * protocol is `tests/homes/<world>-next` (docs/TEST_METHODS.md §11.4) so a
 * next-host home can never share a directory with a legacy one.
 *
 * @param {'legacy'|'next'} [mode] - selected generation.
 * @returns {string}
 */
export function selectedHostHomeSuffix(mode = testHostMode()) {
  return mode === 'next' ? NEXT_HOST.homeSuffix : ''
}

// ---------------------------------------------------------------------------
// SHARED RESOLUTION — ONE selection authority, TWO resolution adapters.
//
// The Node ESM resolve hook (`scripts/run-tests-hooks.mjs`) and the Vite
// resolver plugin (`tests/next-host/host-vite-adapter.mjs`) are different
// module systems, not two authorities. Everything that decides WHICH host a
// bare `@deepseek-ai/*` import belongs to lives in this file:
//
//   - the host pin/tree (`testHostMode`, `selectedHostTree`, `selectedHostPin`);
//   - the package-specifier grammar (`parseHostSpecifier`);
//   - the install/tree a resolved file must stay inside
//     (`selectedHostResolveRoot` + `isInsideSelectedHost`);
//   - the refusal vocabulary (`HostSelectionError`);
//   - the source-preference mapping the client Vite population has always had
//     (`sourceEntryForBuiltModule`: the built target the host's OWN `exports`
//     map chose, re-pointed at its sibling TypeScript source — never a
//     hand-written package->path table).
//
// A second rc.2/rc.5 path table anywhere is a contract violation. If an
// adapter needs a rule this file does not expose, the rule goes HERE.
// ---------------------------------------------------------------------------

/**
 * The root a resolved host module must stay INSIDE.
 *
 * `next` is the pinned pristine tree. `legacy` is the Team checkout's own
 * install (`node_modules/`): that install IS the rc.2 host the repo links (see
 * the module docstring), while `tests/deepseek-harness-test-use` is the
 * pristine SOURCE reference, not a second installed copy the Node lane uses.
 *
 * @param {string} repoRoot - the Team checkout.
 * @param {'legacy'|'next'} [mode] - selected generation.
 * @returns {string} realpath of the containment root.
 */
export function selectedHostResolveRoot(repoRoot, mode = testHostMode()) {
  const root = resolve(repoRoot)
  if (mode === 'next') return realpathSync(assertNextHostTree(root).tree)
  return realpathSync(join(root, 'node_modules'))
}

/** True when `file` is the root itself or below it (realpath-compared). */
function isInsideReal(file, root) {
  return file === root || file.startsWith(`${root}${sep}`)
}

/** Resolve an importer path/URL to a realpath; virtual or absent importers are "outside". */
function realPathOf(value) {
  if (typeof value !== 'string' || value === '') return null
  let path = value
  if (path.startsWith('file:')) {
    try {
      path = fileURLToPath(path)
    } catch {
      return null
    }
  }
  try {
    return realpathSync(path)
  } catch {
    return null
  }
}

/**
 * Is `file` inside the SELECTED host's resolution root? Both adapters use this
 * for the "a host package's own imports are not Team imports" rule, so the
 * containment decision cannot drift between Node and Vite.
 */
export function isInsideSelectedHost(file, repoRoot, mode = testHostMode()) {
  const real = realPathOf(file)
  if (real === null) return false
  return isInsideReal(real, selectedHostResolveRoot(repoRoot, mode))
}

const HOST_SPECIFIER = /^(@deepseek-ai\/[\w.-]+)((?:\/.*)?)$/u

/**
 * Parse a bare `@deepseek-ai/*` specifier into its package name + subpath.
 * Returns null for anything that is not a bare host specifier (relative,
 * absolute, other scopes, Vite query/loader suffixes), so an adapter never
 * needs its own grammar.
 *
 * @param {string} spec
 * @returns {{packageName: string, subpath: string|null}|null}
 */
export function parseHostSpecifier(spec) {
  if (typeof spec !== 'string' || spec.includes('?') || spec.includes('\0')) return null
  const match = HOST_SPECIFIER.exec(spec)
  if (match === null) return null
  return { packageName: match[1], subpath: match[2] === '' ? null : match[2] }
}

/**
 * The TypeScript source a host built entry corresponds to, under the SAME
 * host tree. This is the client Vite population's long-standing need (a built
 * dynamic client entry is registered on the browser shell's module loader and
 * cannot execute as a plain module), expressed as a mechanical re-point of the
 * file the host's OWN `exports` map already chose:
 *
 *   <pkg>/lib/index.js        -> <pkg>/src/index.ts
 *   <pkg>/lib/client.js       -> <pkg>/src/client/index.ts
 *   <pkg>/src/client/bind.ts  -> itself
 *
 * There is no package name in this function. A package that ships no source
 * simply keeps its built file.
 *
 * @param {string} built realpath of the built entry, inside `tree`
 * @param {string} tree realpath of the selected pristine tree
 * @returns {string|undefined} realpath of the source file, or undefined
 */
export function sourceEntryForBuiltModule(built, tree) {
  const rel = relative(tree, built)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return undefined
  let stem
  const lib = /^(.*\/)?lib\/(.+)$/u.exec(rel)
  if (lib !== null) stem = `${lib[1] ?? ''}src/${lib[2]}`
  else if (rel.startsWith('src/') || rel.includes('/src/')) stem = rel
  else return undefined
  const absolute = join(tree, stem)
  const withoutExtension = absolute.replace(/\.(?:js|mjs|cjs)$/u, '')
  for (const candidate of [
    absolute,
    `${withoutExtension}.ts`,
    `${withoutExtension}.tsx`,
    join(withoutExtension, 'index.ts'),
    join(withoutExtension, 'index.tsx'),
  ]) {
    try {
      if (existsSync(candidate) && statSync(candidate).isFile()) return realpathSync(candidate)
    } catch { /* unreadable candidate: keep probing */ }
  }
  return undefined
}

/**
 * Create the ONE resolver both adapters call.
 *
 * `resolveForImporter(spec, importerPath)` is the Node/Vite built path:
 *   - null when the specifier is not a bare host specifier, or when the
 *     importer is ALREADY inside the selected host (a host package resolving
 *     its own dependencies must not be redirected);
 *   - `{file, parsed}` otherwise, with `file` guaranteed inside the selected
 *     root.
 *
 * `resolveSourceForImporter(spec)` is the client Vite population's source
 * path: same tree, same package grammar, same containment, but the built
 * target is re-pointed at its sibling source when one exists. It deliberately
 * does NOT decline host-internal importers: inside the source graph every
 * `@deepseek-ai/*` module must come from that one source tree (otherwise a
 * source file would load the built browser bundle of its own package).
 *
 * REFUSAL IS TYPED AND MODE-SHAPED. Under `next`, an unresolvable or escaping
 * specifier throws (`HOST_MODULE_UNRESOLVED` / `HOST_RESOLUTION_ESCAPED`):
 * declining would let the runner's default resolution answer with the repo's
 * rc.2 install, the exact false green this lane exists to prevent. Under
 * `legacy` a miss returns null, because the runner's default resolution IS the
 * selected host there and returns the same rc.2 install.
 *
 * @param {string} repoRoot - the Team checkout the harness lives in.
 * @param {'legacy'|'next'} [mode] - selected generation (validated eagerly).
 */
export function createHostResolver(repoRoot, mode = testHostMode()) {
  const root = resolve(repoRoot)
  const resolveRoot = selectedHostResolveRoot(root, mode)
  const hostTree = realpathSync(selectedHostTree(root, mode))
  // BOTH pinned generations, so an importer that is already part of either
  // host resolves its own dependencies through that generation's anchored walk
  // (the rc.5 subject rows load rc.5 files by absolute path inside a
  // legacy-selected process).
  const pinnedTrees = [hostTree]
  for (const generation of ['legacy', 'next']) {
    if (generation === mode) continue
    try {
      pinnedTrees.push(realpathSync(selectedHostTree(root, generation)))
    } catch (error) {
      // The other generation is NOT PROVISIONED in this environment: there is
      // nothing to decline, and its absence must not fail a single-host run.
      // Any other failure (drift, dirty checkout, not built) still refuses.
      if (error?.code !== 'TREE_MISSING') throw error
    }
  }
  const insidePinnedTree = (file) => pinnedTrees.some((tree) => isInsideReal(file, tree))
  const builtCache = new Map()
  const sourceCache = new Map()

  const resolveBuilt = (spec) => {
    if (builtCache.has(spec)) return builtCache.get(spec)
    let file
    try {
      file = resolveSelectedHostModule(spec, root, mode)
    } catch (error) {
      // Legacy only: a specifier the repo install cannot resolve (missing, or
      // an `exports` subpath it does not publish) is declined so the runner's
      // default resolution answers. That IS the selected host (rc.2), and it is
      // also what lets an rc.5 module loaded by absolute path resolve its own
      // subpaths from the rc.5 tree. A containment violation is NOT a miss —
      // it is thrown below.
      if (mode === 'legacy' && !(error instanceof HostSelectionError)) {
        builtCache.set(spec, null)
        return null
      }
      throw error
    }
    const real = realpathSync(file)
    if (!isInsideReal(real, resolveRoot)) {
      throw new HostSelectionError('HOST_RESOLUTION_ESCAPED', `${spec} resolved OUTSIDE the selected ${mode} host root (${resolveRoot}): ${real} — an out-of-tree hit would grade another host`)
    }
    builtCache.set(spec, real)
    return real
  }

  return {
    mode,
    repoRoot: root,
    /** The containment root for built resolution (install for legacy, tree for next). */
    resolveRoot,
    /** The pristine host tree (used by the source path). */
    hostTree,
    /** Whether the runner's default resolution is itself the selected host. */
    defaultResolutionIsSelectedHost: mode === 'legacy',
    isHostInternal: (importerPath) => {
      const real = realPathOf(importerPath)
      if (real === null) return false
      // Inside the selected install/tree, OR inside EITHER pinned host tree: a
      // module that is already part of a host generation must resolve its own
      // dependencies through that generation's anchored walk. This is what
      // keeps an rc.5 module (imported by absolute path in the rc.5 subject
      // rows) from resolving its `@deepseek-ai/*` imports out of the rc.2
      // install.
      return isInsideReal(real, resolveRoot) || insidePinnedTree(real)
    },
    resolveForImporter: (spec, importerPath) => {
      const parsed = parseHostSpecifier(spec)
      if (parsed === null) return null
      if (importerPath !== undefined && importerPath !== null) {
        const importer = realPathOf(importerPath)
        if (importer !== null && (isInsideReal(importer, resolveRoot) || insidePinnedTree(importer))) return null
      }
      const file = resolveBuilt(spec)
      if (file === null) return null // legacy only: the default (rc.2) resolution is the same host
      return { file, parsed }
    },
    resolveSourceForImporter: (spec) => {
      const parsed = parseHostSpecifier(spec)
      if (parsed === null) return null
      if (sourceCache.has(spec)) return sourceCache.get(spec)
      let built
      try {
        built = realpathSync(resolveInsideTree(spec, hostTree))
      } catch (error) {
        if (mode === 'legacy') {
          sourceCache.set(spec, null)
          return null
        }
        throw new HostSelectionError('HOST_MODULE_UNRESOLVED', `${spec} does not resolve inside the selected next host tree ${hostTree}: ${String(error?.message ?? error)}`)
      }
      if (!isInsideReal(built, hostTree)) {
        throw new HostSelectionError('HOST_RESOLUTION_ESCAPED', `${spec} resolved OUTSIDE the selected next host tree (${hostTree}): ${built}`)
      }
      const file = sourceEntryForBuiltModule(built, hostTree) ?? built
      const result = { file, built, parsed }
      sourceCache.set(spec, result)
      return result
    },
  }
}

