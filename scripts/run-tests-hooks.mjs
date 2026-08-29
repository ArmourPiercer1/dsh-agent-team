/**
 * run-tests-hooks.mjs — Node module resolution hooks for scripts/run-tests.mjs.
 *
 * Two rewrites, both required to run the skeleton's .test.ts sources under
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
 * Runs in the hook worker thread spawned by module.register(); no
 * child_process, no dependencies.
 */
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const shimUrl = pathToFileURL(join(here, 'test-vitest-shim.mjs')).href

export async function resolve(spec, context, next) {
  if (spec === 'vitest') return { url: shimUrl, shortCircuit: true }

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
