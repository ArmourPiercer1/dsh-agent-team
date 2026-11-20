/**
 * host.mjs — tree-local resolution of the NEXT host's PUBLIC package entries.
 *
 * Why this file exists at all: Node's resolver walks UP from the importing
 * anchor, so a package name can silently resolve to the LEGACY host's copy in
 * the Team repo's own `node_modules` (measured during the smoke: `dsh-tool-fs`
 * resolved to `0.2.0-rc.2`). That is exactly the substitution this prototype
 * must not make. Every resolution here is anchored inside the pinned next tree
 * AND the resolved file is asserted to be beneath that tree; a resolution that
 * escapes is a hard error, never a fallback.
 *
 * Only published package entries are resolved: `main`/`exports` of packages the
 * host itself builds. No `src/` module is imported, no host file is written.
 *
 * @module tests/ute-g1-fs/lib/host
 */
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

import { NEXT_HOST } from '../../paths.mjs'
import { assertNextHostTree } from '../../next-host/host-next-lib.mjs'

/**
 * Anchors whose dependency graph contains the entries the prototype needs. Each
 * is a real `package.json` inside the tree, so pnpm's per-package links are on
 * the resolution path.
 */
const ANCHORS = Object.freeze([
  'packages/fs/tool-fs/package.json',
  'packages/fs/fs-local/package.json',
  'packages/fs/fs-observation-policy/package.json',
  'packages/test-support/agent-loop-testkit/package.json',
  'packages/core/session/package.json',
  'packages/core/tools/package.json',
])

/**
 * Resolve one package specifier to a file INSIDE the pinned next tree.
 * @param {string} tree - absolute next-host tree.
 * @param {string} spec - bare package specifier.
 * @returns {string} absolute file path beneath `tree`.
 */
export function treeResolve(tree, spec) {
  // A provisioned next-host tree may be a SYMLINK shared between worktrees
  // (this lane's worktree symlinks the already-provisioned tree). Containment
  // is therefore checked on the RESOLVED tree: resolving through the symlink is
  // not an escape, while a package that resolves to a DIFFERENT tree still is.
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
        throw new Error(`ute-g1-fs: '${spec}' resolved OUTSIDE the pinned next-host tree (${file}); refusing the legacy fallback`)
      }
      return file
    } catch (error) {
      if (error?.code !== 'MODULE_NOT_FOUND') throw error
      last = error
    }
  }
  throw new Error(`ute-g1-fs: '${spec}' is not resolvable inside the pinned next-host tree ${tree} (${last?.message ?? 'no anchor'}); provision it per docs/TEST_METHODS.md §11`)
}

/** Import one package entry from the pinned tree by its resolved file URL. */
export function treeImport(tree, spec) {
  return import(pathToFileURL(treeResolve(tree, spec)).href)
}

/**
 * Assert the pinned next host exists (fail loud) and load its public surface.
 * A missing/ drifted tree throws `NextHostMissingError` — there is no legacy
 * fallback and no skip.
 * @param {string} [repoRoot] - repo root of the calling worktree.
 * @returns {Promise<object>} the loaded public surface.
 */
export async function loadHostSurface(repoRoot) {
  const host = assertNextHostTree(repoRoot)
  const tree = host.tree
  const [cordis, testkit, toolkit, session, fsLocal, fsPkg, toolFsPath, observationPath] = await Promise.all([
    treeImport(tree, '@deepseek-ai/cordis'),
    treeImport(tree, '@deepseek-ai/dsh-agent-loop-testkit'),
    treeImport(tree, '@deepseek-ai/dsh-tool-testkit'),
    treeImport(tree, '@deepseek-ai/dsh-session'),
    treeImport(tree, '@deepseek-ai/dsh-fs-local'),
    treeImport(tree, '@deepseek-ai/dsh-fs'),
    Promise.resolve(treeResolve(tree, '@deepseek-ai/dsh-tool-fs')),
    Promise.resolve(treeResolve(tree, '@deepseek-ai/dsh-fs-observation-policy')),
  ])
  return Object.freeze({
    host,
    tree,
    Context: cordis.Context,
    SessionId: session.SessionId,
    mountAgentLoopTestDependencies: testkit.mountAgentLoopTestDependencies,
    mountAgentLoopTestHarness: testkit.mountAgentLoopTestHarness,
    executeModelToolFixture: toolkit.executeModelToolFixture,
    LocalFileSystem: fsLocal.LocalFileSystem,
    FsError: fsPkg.FsError,
    toolFs: await import(pathToFileURL(toolFsPath).href),
    observationPolicy: await import(pathToFileURL(observationPath).href),
  })
}

/** The generation identity line the evidence quotes. */
export function hostIdentity(host) {
  return `host=next version=${NEXT_HOST.version} tag=${NEXT_HOST.tag} commit=${NEXT_HOST.sha} tree=${host.tree}`
}
