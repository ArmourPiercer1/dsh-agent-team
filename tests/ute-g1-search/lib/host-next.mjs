/**
 * host-next.mjs — tree-anchored resolution of the PINNED NEXT HOST's public
 * package entries for the SEARCH family's new-path run.
 *
 * WHY THIS FILE EXISTS. The B1 old-path world resolves its host modules through
 * `createRequire(packages/runtime/package.json)`, i.e. the LEGACY pin
 * (`0.2.0-rc.2`) the product tree is installed against. A new-path run must NOT
 * inherit that substitution: every host module it loads is resolved from INSIDE
 * the pinned next tree (`tests/deepseek-harness-next`, `tests/paths.mjs#NEXT_HOST`)
 * and the resolved file is asserted to be beneath that tree. A resolution that
 * escapes is a hard error, never a fallback.
 *
 * Only PUBLISHED package entries are imported (`main`/`exports` of packages the
 * host itself builds). No host `src/` module is imported and no host file is
 * written (CORE PATCH BUDGET = 0).
 *
 * FAIL-LOUD: a missing/drifted tree throws `NextHostMissingError` through the
 * shared `assertNextHostTree` — there is no skip path and no faked fallback.
 *
 * @module tests/ute-g1-search/lib/host-next
 */
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

import { NEXT_HOST } from '../../paths.mjs'
import { assertNextHostTree } from '../../next-host/host-next-lib.mjs'

/**
 * Anchors whose dependency graphs contain the entries the new-path harness
 * needs. Each is a real `package.json` inside the tree, so the tree's own
 * per-package links are on the resolution path.
 */
const ANCHORS = Object.freeze([
  'packages/fs/tool-fs-search/package.json',
  'packages/subprocess/subprocess-local/package.json',
  'packages/test-support/agent-loop-testkit/package.json',
  'packages/test-support/tool-testkit/package.json',
  'packages/core/session/package.json',
  'packages/core/tools/package.json',
])

/**
 * Resolve one bare specifier to a file INSIDE the pinned next tree.
 * @param {string} tree - absolute next-host tree.
 * @param {string} spec - bare package specifier.
 * @returns {string} absolute file path beneath `tree`.
 */
export function treeResolve(tree, spec) {
  // The provisioned tree is a real directory in this worktree, but a sibling
  // worktree may share it through a symlink: containment is checked on the
  // RESOLVED tree, so resolving through that symlink is not an escape while a
  // package resolving to a DIFFERENT tree still is.
  const resolvedTree = realpathSync(tree)
  let last
  for (const anchor of ANCHORS) {
    let require
    try {
      require = createRequire(join(tree, anchor))
    } catch (error) {
      last = error
      continue
    }
    try {
      const file = realpathSync(require.resolve(spec))
      if (file !== resolvedTree && !file.startsWith(`${resolvedTree}${sep}`)) {
        throw new Error(`ute-g1-search: '${spec}' resolved OUTSIDE the pinned next-host tree (${file}); refusing the legacy fallback`)
      }
      return file
    } catch (error) {
      if (error?.code !== 'MODULE_NOT_FOUND') throw error
      last = error
    }
  }
  throw new Error(`ute-g1-search: '${spec}' is not resolvable inside the pinned next-host tree ${tree} (${last?.message ?? 'no anchor'}); provision it per docs/TEST_METHODS.md §11`)
}

/** Import one package entry from the pinned tree by its resolved file URL. */
export function treeImport(tree, spec) {
  return import(pathToFileURL(treeResolve(tree, spec)).href)
}

/**
 * Assert the pinned next host exists and load its PUBLIC surface.
 * @param {string} [repoRoot] - repo root of the calling worktree.
 * @returns {Promise<object>} the loaded surface (frozen).
 */
export async function loadNextSearchHost(repoRoot) {
  const host = assertNextHostTree(repoRoot)
  const tree = host.tree
  const searchEntry = treeResolve(tree, '@deepseek-ai/dsh-tool-fs-search')
  const subprocessEntry = treeResolve(tree, '@deepseek-ai/dsh-subprocess-local')
  const [cordis, agentLoopTestkit, toolTestkit, session, searchModule, subprocessLocal] = await Promise.all([
    treeImport(tree, '@deepseek-ai/cordis'),
    treeImport(tree, '@deepseek-ai/dsh-agent-loop-testkit'),
    treeImport(tree, '@deepseek-ai/dsh-tool-testkit'),
    treeImport(tree, '@deepseek-ai/dsh-session'),
    import(pathToFileURL(searchEntry).href),
    import(pathToFileURL(subprocessEntry).href),
  ])
  const LocalSubprocessRuntime = subprocessLocal.default ?? subprocessLocal.LocalSubprocessRuntime
  if (typeof LocalSubprocessRuntime !== 'function') {
    throw new Error('ute-g1-search: the pinned next host\'s @deepseek-ai/dsh-subprocess-local exposes no LocalSubprocessRuntime class')
  }
  if (typeof searchModule.applyGrepTool !== 'function' || typeof searchModule.applyGlobTool !== 'function') {
    throw new Error('ute-g1-search: the pinned next host\'s @deepseek-ai/dsh-tool-fs-search does not export applyGrepTool/applyGlobTool')
  }
  return Object.freeze({
    host,
    tree,
    /** The generation stamp the evidence quotes (single source: tests/paths.mjs). */
    generation: NEXT_HOST.version,
    tag: NEXT_HOST.tag,
    commit: NEXT_HOST.sha,
    Context: cordis.Context,
    SessionId: session.SessionId,
    mountAgentLoopTestDependencies: agentLoopTestkit.mountAgentLoopTestDependencies,
    mountAgentLoopTestHarness: agentLoopTestkit.mountAgentLoopTestHarness,
    executeModelToolFixture: toolTestkit.executeModelToolFixture,
    searchModule,
    searchModuleEntry: searchEntry,
    LocalSubprocessRuntime,
  })
}

/** The generation identity line the evidence quotes. */
export function nextSearchHostIdentity(host) {
  return `host=next version=${host.generation} tag=${host.tag} commit=${host.commit} tree=${NEXT_HOST.treeRel}`
}
