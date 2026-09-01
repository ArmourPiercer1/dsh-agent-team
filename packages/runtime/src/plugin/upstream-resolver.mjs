/**
 * upstream-resolver.mjs — the `@deepseek-ai/*` resolution hook of the
 * shipped production entry (P8-S5A, plain JavaScript — no TS tooling).
 *
 * WHY: the production entry (`dist/packages/runtime/src/plugin/host.js`),
 * the live-agent glue bundle (`src/plugin/live/agent-bindings.mjs`) and the
 * real storage seam (`root-binding/harness/seam.mjs`) live in the
 * dsh-agent-team WORKTREE — outside the DSH checkout. A bare
 * `@deepseek-ai/<name>` import from a file outside the checkout never
 * reaches the DSH workspace links (pnpm layout: the links live under
 * `<checkout>/apps/cli/node_modules/@deepseek-ai/`), so the import fails
 * with ERR_MODULE_NOT_FOUND.
 *
 * HOW: this hook (registered by host.ts through `module.register`, which
 * runs it on the process's module-resolution hook thread) redirects ONLY
 * `@deepseek-ai/*` specifiers to a fictitious parent module inside the
 * checkout's `apps/cli/lib/`. Node's OWN resolution then applies — the
 * exports maps, subpath entries, and pnpm symlinks of the checkout do the
 * rest, exactly as they do for the DSH host process itself. Every other
 * specifier passes through untouched.
 *
 * CHECKOUT DISCOVERY (first candidate whose
 * `<candidate>/apps/cli/node_modules/@deepseek-ai` exists wins):
 *   1. three dirname()s above `process.argv[1]` — the production boot runs
 *      `node apps/cli/lib/bin.js web ...` from the checkout root;
 *   2. the references/deepseek-harness-test-use checkout two levels above
 *      this file's worktree (the test DSH source, TEST_METHODS.md);
 *   3. the same checkout under the MAIN repository (the worktree's parent).
 *
 * The redirect is a resolution-time rewrite only: no file is created, no
 * module is cached differently, nothing outside `@deepseek-ai/*` changes.
 * @module @dsh-agent-team/runtime/plugin/upstream-resolver
 */
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve as pathResolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RESOLVER_FILE = fileURLToPath(import.meta.url)

/** The argv[1]-based candidate: `node apps/cli/lib/bin.js` run from the checkout root. */
function candidateFromArgv() {
  const entry = process.argv[1]
  if (typeof entry !== 'string' || entry.length === 0) return null
  const abs = isAbsolute(entry) ? entry : pathResolve(process.cwd(), entry)
  return dirname(dirname(dirname(abs)))
}

/** The worktree-based candidates (this file lives in the worktree source tree). */
function candidatesFromResolverFile() {
  // .../<worktree>/packages/runtime/src/plugin/upstream-resolver.mjs
  const worktree = dirname(dirname(dirname(dirname(RESOLVER_FILE))))
  const mainRepo = dirname(dirname(worktree))
  return [worktree, mainRepo].map((base) =>
    join(base, 'references', 'deepseek-harness-test-use'),
  )
}

let cachedCheckout = null
let discoveryDone = false

function discoverCheckout() {
  if (discoveryDone) return cachedCheckout
  discoveryDone = true
  const candidates = [candidateFromArgv(), ...candidatesFromResolverFile()].filter(
    (candidate) => candidate !== null && candidate !== undefined,
  )
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'apps', 'cli', 'node_modules', '@deepseek-ai'))) {
      cachedCheckout = candidate
      break
    }
  }
  return cachedCheckout
}

/**
 * The resolve hook. `@deepseek-ai/*` is re-parented into the checkout's
 * apps/cli (whose node_modules carries the workspace links); everything
 * else is passed through to the next resolver unchanged.
 * @param {string} specifier
 * @param {object} context
 * @param {(specifier: string, context: object) => Promise<object>} nextResolve
 * @returns {Promise<object>} the resolved module record.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@deepseek-ai/')) {
    const checkout = discoverCheckout()
    if (checkout !== null) {
      const parent = pathToFileURL(
        join(checkout, 'apps', 'cli', 'lib', '__resolver__.js'),
      )
      return nextResolve(specifier, { ...context, parentURL: parent.href })
    }
  }
  return nextResolve(specifier, context)
}
