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
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { createHostResolver, testHostMode } from '../tests/next-host/host-select.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolvePath(here, '..')
const shimUrl = pathToFileURL(join(here, 'test-vitest-shim.mjs')).href

/**
 * The ONE shared resolvers (tests/next-host/host-select.mjs), cached per
 * selected generation. This file is an ADAPTER: it owns the Node ESM hook
 * shape, not the host decision. `testHostMode()` is consulted on EVERY host
 * specifier so an unknown `TEAM_TEST_HOST` refuses (typed) instead of being
 * masked by a stale cache.
 */
const hostResolvers = new Map()
function selectedHost() {
  const mode = testHostMode()
  let resolver = hostResolvers.get(mode)
  if (resolver === undefined) {
    resolver = createHostResolver(repoRoot, mode)
    hostResolvers.set(mode, resolver)
  }
  return resolver
}

export async function resolve(spec, context, next) {
  if (spec === 'vitest') return { url: shimUrl, shortCircuit: true }

  // (3) Every bare `@deepseek-ai/*` import is decided by the shared resolver.
  // `createHostResolver()` throws a typed HostSelectionError on an unknown
  // selector, which is what keeps a typo from silently selecting the legacy
  // host. The resolver also declines host-internal importers (a host package's
  // own bare imports must walk its own install) and, under `legacy`, declines
  // a miss so Node's default resolution — the same rc.2 install — answers.
  if (spec.startsWith('@deepseek-ai/')) {
    const decision = selectedHost().resolveForImporter(spec, context.parentURL)
    if (decision !== null) return { url: pathToFileURL(decision.file).href, shortCircuit: true }
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
