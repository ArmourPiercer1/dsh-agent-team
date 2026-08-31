/**
 * ts-loader.mjs — Node module-resolution hook for the P7-T7 real-instance
 * harness.
 *
 * The harness plugin row (plugin.mjs) imports this repository's
 * session-reader TypeScript modules by their NodeNext `.js` specifiers.
 * Under plain Node (native TS type-stripping, Node >= 23.6) a relative
 * `.js` specifier whose literal file does not exist must be rewritten to
 * the sibling `.ts` file — exactly the rewrite
 * scripts/run-tests-hooks.mjs performs for the unit-test runner.
 *
 * Registration: plugin.mjs calls `module.register()` with THIS file
 * before its first dynamic TS import (the row module's static imports are
 * all node: builtins, so no hook is needed before registration). The hook
 * thread loads this same module again and uses its exported `resolve` as
 * the customization hook.
 *
 * Gating: the rewrite applies ONLY when the importing file
 * (context.parentURL) lives under THIS repository's `packages/` directory
 * (computed from this file's own location:
 * <worktree>/packages/legacy/session-reader/e2e). Host-tree imports
 * (references/deepseek-harness-test-use) are never touched, so the hook
 * cannot perturb the host's own resolution.
 *
 * Plain .mjs; runs in the hook worker thread (no main-thread assumptions).
 * @module @dsh-agent-team/legacy/session-reader/e2e/ts-loader
 */
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
// e2e/ -> session-reader/ -> legacy/ -> packages/
const packagesDir = resolvePath(here, '..', '..', '..')

/**
 * The resolve hook. Rewrites a relative or absolute `.js` specifier to its
 * sibling `.ts` file when the literal `.js` file does not exist, the `.ts`
 * sibling does, and the importing file is inside this repository's
 * packages/ tree. Everything else delegates to the default resolver.
 *
 * @param {string} spec - the import specifier.
 * @param {object} context - resolution context (parentURL et al.).
 * @param {(spec: string, context: object) => Promise<object>} next - the default resolver.
 * @returns the resolution record.
 */
export async function resolve(spec, context, next) {
  if (
    typeof spec === 'string' &&
    spec.endsWith('.js') &&
    (spec.startsWith('./') || spec.startsWith('../') || isAbsolute(spec)) &&
    context.parentURL &&
    context.parentURL.startsWith('file:')
  ) {
    const parentPath = fileURLToPath(context.parentURL)
    if (parentPath.startsWith(packagesDir)) {
      const base = isAbsolute(spec) ? spec : join(dirname(parentPath), spec)
      const tsAlt = base.slice(0, base.length - '.js'.length) + '.ts'
      if (!existsSync(base) && existsSync(tsAlt)) {
        return { url: pathToFileURL(tsAlt).href, shortCircuit: true }
      }
    }
  }
  return next(spec, context)
}
