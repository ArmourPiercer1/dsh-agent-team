/**
 * upstream-resolver.mjs — the `@deepseek-ai/*` resolution hook of the
 * shipped production entry (P8-S5A, plain JavaScript — no TS tooling;
 * normal-first hardening added by task/plugin-bundle-form).
 *
 * WHY: the production entry (`dist/packages/runtime/src/plugin/host.js`),
 * the live-agent glue bundle (`src/plugin/live/agent-bindings.mjs`) and the
 * real storage seam (`root-binding/harness/seam.mjs`) live in the
 * dsh-agent-team INSTALL — in the clone+mount world that is a worktree
 * outside the DSH checkout, in the git-install world a `node_modules`
 * directory of the consumer profile. A bare `@deepseek-ai/<name>` import
 * from a file outside a DSH checkout normally resolves through the
 * install's OWN `node_modules` (the prepare step pins the registry
 * `@deepseek-ai/*` set there — version-correct by construction); when it
 * cannot (no install yet, a package the install does not declare), the
 * legacy behavior re-parents the specifier into the DSH checkout's
 * `apps/cli` so the checkout's own pnpm links answer it.
 *
 * HOW (normal-first): for `@deepseek-ai/*` specifiers the hook tries the
 * NEXT resolver with the ORIGINAL context first (the install's own
 * node_modules). Only when that fails with EXACTLY `ERR_MODULE_NOT_FOUND`
 * (the package is absent from the install's resolution scope) does it fall
 * back to re-parenting the specifier into a discovered checkout's
 * `apps/cli/lib/__resolver__.js` and resolving again through the next
 * resolver. Every other failure — including `ERR_PACKAGE_PATH_NOT_EXPORTED`
 * (the package exists but the subpath is not exported: an API drift that
 * must fail loud, not be papered over by the other world) — is rethrown
 * unchanged. Every non-`@deepseek-ai/*` specifier passes through
 * untouched. The redirect is a resolution-time rewrite only: no file is
 * created, no module is cached differently.
 *
 * CHECKOUT DISCOVERY (first candidate whose
 * `<candidate>/apps/cli/node_modules/@deepseek-ai` exists wins; only the
 * fallback path ever consults it):
 *   1. three dirname()s above `process.argv[1]` — OBSERVED (unfixed,
 *      deliberately): for the production bin
 *      (`<checkout>/apps/cli/lib/bin.js`) three dirname()s land on
 *      `<checkout>/apps`, so the `<candidate>/apps/cli/node_modules/
 *      @deepseek-ai` probe here is dead — an off-by-one relative to the
 *      bin's actual location. Left dead on purpose: in the git-install
 *      world a live candidate 1 would discover the USER's host checkout
 *      and the fallback could re-parent into a different DSH version
 *      than the install was pinned against (drift). Normal-first
 *      resolution makes the dead candidate harmless.
 *   2. EVERY ancestor of this file's own location that is a repository root
 *      (marker: `<root>/tests/paths.mjs`), each contributing the canonical
 *      `tests/deepseek-harness-test-use` candidate plus the legacy
 *      `references/deepseek-harness-test-use` fallback. NOTE
 *      (task/plugin-bundle-form): the resolver-file candidates were ORIGINALLY
 *      dead — four dirname()s from
 *      `packages/runtime/src/plugin/` land on <root>/packages, not the repo
 *      root — so the re-parent path never fired in any world (the verified
 *      verticals ran on plain passthrough). GLUE-6 (install-surface
 *      self-sufficiency) replaced that single fixed count with the two
 *      LAYOUT-matched roots, because the shipped entry now registers the
 *      byte-identical DIST-MIRROR copy of this file
 *      (`packages/runtime/dist/packages/runtime/src/plugin/`), which sits at a
 *      DIFFERENT depth than the source copy — one fixed count silently deadens
 *      the fallback for one of the two shipped layouts. The recognition is
 *      name-based (a closed suffix pair), never a directory scan, so the
 *      no-drift property holds: the fallback stays discoverable ONLY on this
 *      machine's test world (the test-use checkout is gitignored, so a user's
 *      clone/git-install profile never exposes a candidate), which is exactly
 *      what the normal-first order relies on. The legacy
 *      references/deepseek-harness-test-use layout stays a fallback
 *      candidate for machines that predate the 2026-09-12 move.
 *
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

/**
 * The repository-root candidates, derived from this file's OWN location.
 *
 * GLUE-6 (install-surface self-sufficiency): the shipped entry registers the
 * byte-identical DIST-MIRROR copy of this file
 * (`packages/runtime/dist/packages/runtime/src/plugin/upstream-resolver.mjs`),
 * while the source entry registers the source copy
 * (`packages/runtime/src/plugin/upstream-resolver.mjs`). The two layouts sit
 * at DIFFERENT depths, so a single fixed dirname count silently deadens the
 * fallback for one of them (measured pre-fix: the mirror copy would have
 * derived `<repo>/packages/runtime/dist` as its "worktree"). Both layouts are
 * therefore matched by their own closed suffix, and ONLY those two paths are
 * recognized: this stays a NAME-based derivation, never a directory scan, so
 * no candidate can ever re-parent into a different DSH checkout than the one
 * this repository pins (the no-drift property the normal-first order relies
 * on; an arbitrary ancestor walk would break it).
 *
 * @returns {string[]} candidate repository roots — the located repository,
 *   then the same shape's parent-of-worktree main repository (a
 *   `<main>/.worktrees/<task>` checkout maps to `<main>`).
 */
const LAYOUT_SUFFIXES = Object.freeze([
  // .../<root>/packages/runtime/dist/packages/runtime/src/plugin/upstream-resolver.mjs
  'packages/runtime/dist/packages/runtime/src/plugin/upstream-resolver.mjs',
  // .../<root>/packages/runtime/src/plugin/upstream-resolver.mjs
  'packages/runtime/src/plugin/upstream-resolver.mjs',
])

function repositoryRootsFromResolverFile() {
  const roots = []
  const push = (root) => {
    if (root.length > 0 && !roots.includes(root)) roots.push(root)
  }
  for (const suffix of LAYOUT_SUFFIXES) {
    // Compare on the separator-normalized tail so a Windows file URL and a
    // POSIX one derive the SAME roots; the root itself is cut out of the
    // platform-native path, never re-joined from the normalized copy.
    const normalized = RESOLVER_FILE.split(/[\\/]/).join('/')
    if (!normalized.endsWith(`/${suffix}`)) continue
    const cut = RESOLVER_FILE.length - suffix.length - 1
    if (cut <= 0) continue
    const root = RESOLVER_FILE.slice(0, cut).replace(/[\\/]$/, '')
    push(root)
    // The worktree's MAIN repository (a `.worktrees/<task>` checkout is two
    // levels below it — the mapping the pre-GLUE-6 fixed count computed).
    push(dirname(dirname(root)))
  }
  return roots
}

function candidatesFromResolverFile() {
  // Canonical test layout first (tests/deepseek-harness-test-use —
  // tests/paths.mjs, test-infra-standardization 2026-09-12); the legacy
  // references/ layout stays as a fallback for pre-move machines.
  return repositoryRootsFromResolverFile().flatMap((base) => [
    join(base, 'tests', 'deepseek-harness-test-use'),
    join(base, 'references', 'deepseek-harness-test-use'),
  ])
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
 * The resolve hook. `@deepseek-ai/*` resolves normally first (the
 * install's own node_modules — registry-pinned and version-correct);
 * ONLY an `ERR_MODULE_NOT_FOUND` from that attempt falls back to the
 * discovered checkout's apps/cli re-parent. Any other error (notably
 * `ERR_PACKAGE_PATH_NOT_EXPORTED`) and a fallback with no discoverable
 * checkout rethrow the ORIGINAL failure.
 * @param {string} specifier
 * @param {object} context
 * @param {(specifier: string, context: object) => Promise<object>} nextResolve
 * @returns {Promise<object>} the resolved module record.
 */
export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('@deepseek-ai/')) {
    return nextResolve(specifier, context)
  }
  try {
    // Normal resolution FIRST: the install's own node_modules (the
    // prepare step pins the @deepseek-ai/* set there for the git-install
    // world; the workspace links answer it for the clone+mount world).
    return await nextResolve(specifier, context)
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') {
      // API drift (subpath not exported), unsupported import, … — fail
      // loud; the checkout fallback must not mask a version mismatch.
      throw error
    }
    const checkout = discoverCheckout()
    if (checkout === null) {
      // No fallback world exists — surface the original not-found.
      throw error
    }
    const parent = pathToFileURL(
      join(checkout, 'apps', 'cli', 'lib', '__resolver__.js'),
    )
    return nextResolve(specifier, { ...context, parentURL: parent.href })
  }
}
