/**
 * run-tests-hooks.mjs — Node module resolution hooks for scripts/run-tests.mjs.
 *
 * Three rewrites, all required to run the skeleton's .test.ts sources under
 * plain Node (native TS type-stripping) without a bundler:
 *
 *   1. 'vitest' -> scripts/test-vitest-shim.mjs
 *      The bare specifier is intercepted so test files import the minimal
 *      shim (same module instance the runner uses for results).
 *
 *   2. relative './x.js' / '../x.js' / absolute .js specifiers whose literal
 *      file does not exist -> the sibling .ts file.
 *      TS/vite convention: TypeScript sources are imported with .js
 *      specifiers; under node type-stripping the .ts sibling must be
 *      resolved explicitly (node does not rewrite .js -> .ts itself).
 *
 *   3. TEAM_TEST_HOST=next: every bare `@deepseek-ai/*` import (TEAM product
 *      code included) resolves INSIDE tests/deepseek-harness-next.
 *      WHY: the repo's own `node_modules/@deepseek-ai/*` are the 0.2.0-rc.2
 *      legacy packages. Without this rewrite a harness can construct its world
 *      from rc.5 while the product code it exercises imports rc.2 classes — two
 *      host generations in one process, and a green that means neither. The
 *      rewrite is inert unless the environment variable is set, so every
 *      existing leg resolves exactly as before (`tests/next-host/host-select.mjs`).
 *
 * Runs in the hook worker thread spawned by module.register(); no
 * child_process, no dependencies (beyond the fail-loud host selector).
 */
import { existsSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve as resolvePath, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { resolveSelectedHostModule, selectedHostTree, testHostMode } from '../tests/next-host/host-select.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolvePath(here, '..')
const shimUrl = pathToFileURL(join(here, 'test-vitest-shim.mjs')).href

/** Resolved host targets, so the tree verifier's git calls run once per specifier. */
const hostResolutions = new Map()
/** The host tree's realpath, resolved once (the worktree path is a symlink). */
let hostRoot = null

/**
 * Is the importing module ALREADY inside the host tree? A host package's own
 * bare imports (including third-party ones like `@deepseek-ai/cosmokit`, which
 * are legitimate host dependencies) must resolve through Node's normal,
 * already host-anchored walk — redirecting them would ask a workspace anchor to
 * resolve a package only the host's own install carries, and fail.
 */
function parentIsInsideHost(context) {
  if (hostRoot === null) hostRoot = realpathSync(selectedHostTree(repoRoot, 'next'))
  if (typeof context.parentURL !== 'string' || !context.parentURL.startsWith('file:')) return false
  try {
    const parent = realpathSync(fileURLToPath(context.parentURL))
    return parent === hostRoot || parent.startsWith(`${hostRoot}${sep}`)
  } catch {
    return false
  }
}

export async function resolve(spec, context, next) {
  if (spec === 'vitest') return { url: shimUrl, shortCircuit: true }

  // (3) Host-anchored bare imports from TEAM code. `testHostMode` throws on an
  // unknown value, which is what keeps a typo from silently selecting the
  // legacy host.
  if (spec.startsWith('@deepseek-ai/') && testHostMode() === 'next' && !parentIsInsideHost(context)) {
    let url = hostResolutions.get(spec)
    if (url === undefined) {
      url = pathToFileURL(resolveSelectedHostModule(spec, repoRoot, 'next')).href
      hostResolutions.set(spec, url)
    }
    return { url, shortCircuit: true }
  }

  if (
    spec.endsWith('.js') &&
    (spec.startsWith('./') || spec.startsWith('../') || isAbsolute(spec)) &&
    context.parentURL
  ) {
    const parentPath = fileURLToPath(context.parentURL)
    const base = isAbsolute(spec) ? spec : join(dirname(parentPath), spec)
    const tsAlt = base.slice(0, base.length - '.js'.length) + '.ts'
    if (!existsSync(base) && existsSync(tsAlt)) {
      return { url: pathToFileURL(tsAlt).href, shortCircuit: true }
    }
  }

  return next(spec, context)
}
