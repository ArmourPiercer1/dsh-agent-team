/**
 * host.mjs — tree-anchored resolution of the PINNED NEXT HOST's public entries.
 *
 * The UTE-1 suite runs against `tests/deepseek-harness-next` (0.2.2-rc.5 @
 * `9c2670d3…`, `tests/paths.mjs#NEXT_HOST`). Every module this suite loads is
 * resolved from INSIDE that tree and asserted to be under it: a bare package
 * name would otherwise be free to resolve to the legacy host's copy in the Team
 * repo's own `node_modules`, which is exactly the substitution the pinned-host
 * rule forbids. A missing/drifted tree throws `NextHostMissingError` (fail
 * loud, no skip); `assertNextHostTree` is the shared, already-pinned refusal.
 *
 * Only PUBLISHED package entries are imported (`main`/`exports` of packages the
 * host builds). No host `src/` module is imported and no host file is written.
 *
 * @module tests/ute1-fs/lib/host
 */
import { createRequire } from 'node:module'
import { join, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

import { NEXT_HOST, nextHostTree } from '../../paths.mjs'
import { assertNextHostTree } from '../../next-host/host-next-lib.mjs'

/** Anchors whose dependency graphs contain the entries this suite needs. */
const ANCHORS = Object.freeze([
  'packages/fs/tool-fs/package.json',
  'packages/fs/fs-local/package.json',
  'packages/fs/fs-observation-policy/package.json',
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
      const file = require.resolve(spec)
      if (file !== tree && !file.startsWith(`${tree}${sep}`)) {
        throw new Error(
          `ute1-fs: '${spec}' resolved OUTSIDE the pinned next-host tree (${file}); refusing the legacy fallback`,
        )
      }
      return file
    } catch (error) {
      if (error?.code !== 'MODULE_NOT_FOUND') throw error
      last = error
    }
  }
  throw new Error(
    `ute1-fs: '${spec}' is not resolvable inside the pinned next-host tree ${tree}`
      + ` (${last?.message ?? 'no anchor'}); provision it per docs/TEST_METHODS.md §11`,
  )
}

/** Import one package entry from the pinned tree by its resolved file URL. */
export function treeImport(tree, spec) {
  return import(pathToFileURL(treeResolve(tree, spec)).href)
}

/**
 * Assert the pinned next host exists and load its PUBLIC surface.
 * @param {string} [repoRoot] - repo root of the calling worktree.
 * @returns {Promise<object>} the loaded surface.
 */
export async function loadNextHostSurface(repoRoot) {
  const host = assertNextHostTree(repoRoot)
  const tree = host.tree
  const requireFromTree = createRequire(join(tree, ANCHORS[0]))
  const toolFsEntry = treeResolve(tree, '@deepseek-ai/dsh-tool-fs')
  const observationEntry = treeResolve(tree, '@deepseek-ai/dsh-fs-observation-policy')
  const [cordis, agentLoopTestkit, toolTestkit, session, fsLocal, fsPkg, toolFs, observationPolicy] = await Promise.all([
    treeImport(tree, '@deepseek-ai/cordis'),
    treeImport(tree, '@deepseek-ai/dsh-agent-loop-testkit'),
    treeImport(tree, '@deepseek-ai/dsh-tool-testkit'),
    treeImport(tree, '@deepseek-ai/dsh-session'),
    treeImport(tree, '@deepseek-ai/dsh-fs-local'),
    treeImport(tree, '@deepseek-ai/dsh-fs'),
    import(pathToFileURL(toolFsEntry).href),
    import(pathToFileURL(observationEntry).href),
  ])
  void requireFromTree
  return Object.freeze({
    host,
    tree,
    /** The generation stamp the binding pins (read from `tests/paths.mjs`). */
    generation: NEXT_HOST.version,
    commit: NEXT_HOST.sha,
    Context: cordis.Context,
    SessionId: session.SessionId,
    mountAgentLoopTestDependencies: agentLoopTestkit.mountAgentLoopTestDependencies,
    mountAgentLoopTestHarness: agentLoopTestkit.mountAgentLoopTestHarness,
    executeModelToolFixture: toolTestkit.executeModelToolFixture,
    LocalFileSystem: fsLocal.LocalFileSystem,
    FsError: fsPkg.FsError,
    toolFs,
    toolFsEntry,
    observationPolicy,
  })
}

/** The pinned tree path, for a missing-tree assertion in the evidence. */
export function nextTreePath(repoRoot) {
  return nextHostTree(repoRoot)
}
