/**
 * ts-loader.mjs — Node module-resolution hook for the G8 reviewer-5
 * real-instance harness (harness directory:
 * <worktree>/dev/agent-workflow/evidence/G8-REVIEW/reviewer-5/harness).
 *
 * The harness row (plugin.mjs, mounted into a REAL DSH web instance through
 * the public cordis.patch.yml profile seam) and the boot driver (run.mjs)
 * consume the WORKTREE's TypeScript package sources directly (native TS
 * type-stripping / transform under Node v24, no bundling, no prebuild).
 * The worktree packages declare NodeNext `.js` specifiers for their
 * relative imports, while only the `.ts` files exist on disk — so a
 * relative (or absolute) `.js` specifier whose literal file does not exist
 * must be rewritten to its `.ts` sibling, exactly the rewrite the repo's
 * own test runner performs (and the P7-T7 e2e loader, with its gate
 * widened: here the importing module may live OUTSIDE `packages/` — the
 * row and the boot driver live in this evidence directory — so the gate
 * keys on the RESOLVED TARGET being under the worktree's `packages/`,
 * never on the parent. Host-tree imports (references/
 * deepseek-harness-test-use) are never touched: their `.js` targets exist,
 * so the rewrite cannot fire.
 *
 * Registration: plugin.mjs and run.mjs call `module.register()` with THIS
 * file before their first dynamic TS import (their static imports are all
 * node: builtins, so no hook is needed before registration). The hook
 * thread loads this same module again and uses its exported `resolve`.
 *
 * Packages root: `<worktree>/packages`, computed as six directory levels
 * above this file (harness → reviewer-5 → G8-REVIEW → evidence →
 * agent-workflow → dev → worktree root) unless the G8R5_PACKAGES_DIR
 * environment variable overrides it. A sanity check against
 * packages/remote/src/handlers/register.ts fails boot loudly when the
 * computation is wrong.
 *
 * Plain .mjs; runs in the hook worker thread (no main-thread assumptions).
 */
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve as resolvePath, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const packagesDir =
  process.env.G8R5_PACKAGES_DIR !== undefined
    ? resolvePath(process.env.G8R5_PACKAGES_DIR)
    : resolvePath(here, '..', '..', '..', '..', '..', '..', 'packages')

if (!existsSync(join(packagesDir, 'remote', 'src', 'handlers', 'register.ts'))) {
  throw new Error(`g8r5 ts-loader: packages root not found at '${packagesDir}'`)
}

function underPackagesDir(p) {
  return p === packagesDir || p.startsWith(packagesDir + sep)
}

export async function resolve(spec, context, next) {
  // Candidate target paths, per specifier kind:
  //   - file: URL specifiers (the harness imports TS via pathToFileURL)
  //   - relative specifiers resolved against the parent
  //   - absolute path specifiers
  let candidate = null
  if (typeof spec === 'string' && spec.endsWith('.js') && !spec.endsWith('.mjs')) {
    if (spec.startsWith('file:')) {
      candidate = fileURLToPath(spec)
    } else if (spec.startsWith('.') || isAbsolute(spec)) {
      const parentPath = context.parentURL !== undefined ? fileURLToPath(context.parentURL) : ''
      candidate = isAbsolute(spec) ? resolvePath(spec) : parentPath !== '' ? join(dirname(parentPath), spec) : null
    }
  }
  if (candidate !== null && underPackagesDir(candidate)) {
    const tsAlt = candidate.slice(0, candidate.length - '.js'.length) + '.ts'
    if (!existsSync(candidate) && existsSync(tsAlt)) {
      return { url: pathToFileURL(tsAlt).href, shortCircuit: true }
    }
  }
  return next(spec, context)
}
