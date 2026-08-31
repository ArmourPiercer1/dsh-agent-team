/**
 * ts-loader.mjs — Node module-resolution hook for the G8-R4 (reviewer 4)
 * remote-projection e2e harness.
 *
 * The harness row (row.mjs) loads this worktree's TypeScript packages by
 * their NodeNext `.js` specifiers. Under plain Node (native TS
 * type-stripping, Node >= 23.6) a relative `.js` specifier whose literal
 * file does not exist must be rewritten to the sibling `.ts` file — the
 * same rewrite scripts/run-tests.mjs performs for the unit-test runner.
 *
 * Differences from the P7-T7 session-reader loader:
 *
 * 1. Gating is TARGET-based (not parent-based): the rewrite applies only
 *    when the RESOLVED `.js` target lies under THIS worktree's
 *    `packages/` directory (the worktree root is discovered by walking up
 *    from this file until `packages/remote/src/index.ts` exists). The
 *    harness row itself lives under `dev/agent-workflow/evidence/...`
 *    (outside `packages/`), so a parent-path gate would never fire for the
 *    row's own imports. Host-tree files (references/deepseek-harness-test-use)
 *    can never match this worktree's `packages/` prefix, so host
 *    resolution is untouched.
 *
 * 2. Bare-specifier redirect for `yaml`: the single bare production import
 *    in the worktree (packages/domain/blueprint/src/parse.ts) resolves to
 *    the pristine test-use deployment's pnpm copy (yaml@2.9.0, CJS entry
 *    dist/index.js). The worktree has no node_modules of its own.
 *
 * Registration: row.mjs calls `module.register()` with THIS file before
 * its first dynamic TS import (the row's static imports are node: builtins
 * only). The hook thread loads this same module again and uses its
 * exported `resolve` as the customization hook.
 *
 * Plain .mjs; runs in the hook worker thread (no main-thread assumptions).
 * @module g8r4/harness/ts-loader
 */
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve as resolvePath, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** Walk up from `start` until a directory contains packages/remote/src/index.ts. */
function findWorktreeRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'packages', 'remote', 'src', 'index.ts'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

const worktreeRoot = findWorktreeRoot(here)
if (worktreeRoot === null) {
  throw new Error('g8r4 ts-loader: worktree root (packages/remote/src/index.ts) not found above ' + here)
}
const packagesDir = join(worktreeRoot, 'packages') + sep

/**
 * The bare `yaml` redirect target: the pristine test-use deployment's
 * pnpm copy (yaml@2.9.0). CJS entry; Node ESM default-imports the full
 * `module.exports` (parse.ts binds through the default import).
 */
const YAML_ENTRY_URL =
  'file:///D:/AgentDev/dsh-plugins/dsh-agent-team/references/deepseek-harness-test-use' +
  '/node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/index.js'

/**
 * The resolve hook.
 *
 * @param {string} spec - the import specifier.
 * @param {object} context - resolution context (parentURL et al.).
 * @param {(spec: string, context: object) => Promise<object>} next - the default resolver.
 * @returns the resolution record.
 */
export async function resolve(spec, context, next) {
  // 1. Bare `yaml` → the test-use pnpm copy (the worktree's only bare
  //    production import; verified by the G8-R4 import-face audit).
  if (typeof spec === 'string' && spec === 'yaml') {
    return { url: YAML_ENTRY_URL, shortCircuit: true }
  }
  // 2. NodeNext `.js` → sibling `.ts` rewrite, gated on the RESOLVED
  //    target living under THIS worktree's packages/ tree. The specifier
  //    may be relative, an absolute path, or a file: URL.
  let specPath = null
  if (typeof spec === 'string' && spec.endsWith('.js')) {
    if (spec.startsWith('file:')) {
      try {
        specPath = fileURLToPath(spec)
      } catch {
        specPath = null
      }
    } else if (isAbsolute(spec) || spec.startsWith('./') || spec.startsWith('../')) {
      specPath = isAbsolute(spec)
        ? resolvePath(spec)
        : context.parentURL && context.parentURL.startsWith('file:')
          ? join(dirname(fileURLToPath(context.parentURL)), spec)
          : null
    }
  }
  if (specPath !== null) {
    const base = specPath
    if (base.startsWith(packagesDir)) {
      const tsAlt = base.slice(0, base.length - '.js'.length) + '.ts'
      if (!existsSync(base) && existsSync(tsAlt)) {
        return { url: pathToFileURL(tsAlt).href, shortCircuit: true }
      }
    }
  }
  return next(spec, context)
}
