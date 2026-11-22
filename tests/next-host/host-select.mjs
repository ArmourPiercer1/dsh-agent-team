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
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

import { assertNextHostTree, resolveInsideTree } from './host-next-lib.mjs'
import { NEXT_HOST, findTestRepoRoot, testUseTree } from '../paths.mjs'

/** The one environment variable that selects a host. */
export const TEST_HOST_ENV = 'TEAM_TEST_HOST'

/**
 * The selected host generation.
 * @param {NodeJS.ProcessEnv} [env] - injectable for tests.
 * @returns {'legacy'|'next'}
 */
export function testHostMode(env = process.env) {
  const value = env[TEST_HOST_ENV]
  if (value === undefined || value === '' || value === 'legacy') return 'legacy'
  if (value === 'next') return 'next'
  throw new Error(`${TEST_HOST_ENV}=${JSON.stringify(value)} is not a host generation; use 'legacy' (0.2.0-rc.2) or 'next' (${NEXT_HOST.version} @ ${NEXT_HOST.shortSha})`)
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
