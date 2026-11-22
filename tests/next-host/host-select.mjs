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
import {
  CLIENT_COMMIT_HASH, DSH_BASELINE_VERSION, HOST_PORT_BANDS, NEXT_HOST, TEST_USE_BASELINE_SHA, findTestRepoRoot, testUseTree,
} from '../paths.mjs'

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
