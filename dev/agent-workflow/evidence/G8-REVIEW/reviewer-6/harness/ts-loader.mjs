/**
 * ts-loader.mjs — G8-R6 (reviewer 6) e2e harness: Node module-resolution hook.
 *
 * Two jobs, both strictly gated so the host's own resolution is never
 * perturbed (the hook is process-wide once `module.register()` runs, so it
 * must be a no-op for everything that is not this harness's own tree):
 *
 *  1. WORKTREE-RELATIVE `.js` -> `.ts` REWRITE (the P5-T5 rewrite, widened
 *     gate). The mounted plugin row (plugin.mjs) lives in this worktree
 *     (under dev/agent-workflow/evidence/..., NOT under packages/) and
 *     imports this repository's TypeScript modules by their NodeNext `.js`
 *     specifiers. Under plain Node (native TS type-stripping, Node >= 23.6)
 *     a relative/absolute `.js` specifier whose literal file does not exist
 *     is rewritten to the sibling `.ts` file. The gate is the WHOLE worktree
 *     root (six levels above this file), which also covers every product
 *     `.ts` module whose own relative `.js` imports are then rewritten.
 *
 *  2. FARM FALLBACK FOR BARE SPECIFIERS. The worktree carries no installed
 *     `node_modules` for the one bare dependency of the loaded closure
 *     (`yaml`, imported by packages/domain/blueprint/src/parse.ts), and
 *     seam.mjs imports `zod` + `@deepseek-ai/dsh-storage-domain`. The hook
 *     therefore tries the DEFAULT resolution first and, ONLY when it fails,
 *     retries resolution anchored at this harness directory's junction farm
 *     (`<harness>/node_modules`, populated by run.mjs through
 *     ensureProbeResolution from the pinned test-use tree). A default
 *     resolution that SUCCEEDS is never touched: host-tree modules keep
 *     their own copies, and the two farm packages are loaded by exactly one
 *     copy each (the farm link), so no duplicate-instance risk exists.
 *
 * Plain .mjs; runs in the hook worker thread (no main-thread assumptions).
 * @module g8r6-harness/ts-loader
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve as resolvePath, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** This file's directory: <worktree>/dev/agent-workflow/evidence/G8-REVIEW/reviewer-6/harness */
const HERE = dirname(fileURLToPath(import.meta.url))
/** The worktree root (six levels up: harness -> reviewer-6 -> G8-REVIEW -> evidence -> agent-workflow -> dev -> worktree). */
const WORKTREE = resolvePath(HERE, '..', '..', '..', '..', '..', '..')
/** Gate prefix with a trailing separator so sibling roots can never match. */
const WORKTREE_PREFIX = WORKTREE.endsWith(sep) ? WORKTREE : WORKTREE + sep

/**
 * Resolution anchor for the farm fallback: a (virtual) file in THIS
 * directory, so `require.resolve` walks `<harness>/node_modules` first.
 * The anchor file need not exist — only its directory matters.
 */
const requireFromFarm = createRequire(join(HERE, 'farm-anchor.mjs'))

/**
 * The resolve hook. @param {string} specifier @param {object} context
 * @param {(specifier: string, context: object) => Promise<object>} next
 * @returns the resolved module record.
 */
export async function resolve(specifier, context, next) {
  const parentURL = context?.parentURL
  let underHarness = false
  let parentPath = null
  if (typeof parentURL === 'string' && parentURL.startsWith('file:')) {
    parentPath = fileURLToPath(parentURL)
    underHarness = parentPath.startsWith(WORKTREE_PREFIX)
  }
  if (underHarness) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../')
    if (isRelative || isAbsolute(specifier)) {
      const base = isAbsolute(specifier) ? specifier : join(dirname(parentPath), specifier)
      if (!existsSync(base)) {
        const tsAlt = base.endsWith('.js') ? base.slice(0, base.length - '.js'.length) + '.ts' : base + '.ts'
        if (existsSync(tsAlt)) {
          return { url: pathToFileURL(tsAlt).href, shortCircuit: true }
        }
      }
    }
  }
  // Default resolution first — a succeeding default is never perturbed.
  try {
    return await next(specifier, context)
  } catch (error) {
    if (underHarness && !specifier.startsWith('node:') && !specifier.startsWith('file:')) {
      try {
        const anchored = requireFromFarm.resolve(specifier)
        return { url: pathToFileURL(anchored).href, shortCircuit: true }
      } catch {
        /* farm has it not either — surface the original error */
      }
    }
    throw error
  }
}
