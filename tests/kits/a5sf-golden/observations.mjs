/**
 * observations.mjs — the NEW-lane side of the R5 comparison corpus.
 *
 * The corpus (`vectors.json`) was converted from old tool-family vectors into
 * effect claims whose owner is one of the P1 lanes. This module produces the
 * observation for those claims by CALLING THE SHIPPING P1 CODE — it does not
 * re-implement `toLocatorKey` / `matchLocator`. If the shipping code changes
 * shape, the observation changes and the comparator reports a divergence,
 * which is exactly the regression input BL-13 exists to provide.
 *
 * TS-UNDER-NODE: the P1 lanes ship as TypeScript sources. This module
 * registers the repo's EXISTING resolution hook (`scripts/run-tests-hooks.mjs`
 * — the same hook `tests/world-factory/lib/a5sf-harness.mjs` and
 * `scripts/run-tests.mjs` use) and then imports the .ts module directly. No
 * new loader is written, no TS file is added or edited, and nothing here
 * touches the pinned Host checkout (`tests/deepseek-harness-test-use/`).
 *
 * CORE PATCH BUDGET = 0. Host-free: no port, no DSH_HOME, no boot.
 *
 * @module tests/kits/a5sf-golden/observations
 */
import { register } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = join(HERE, '..', '..', '..')

let hooksRegistered = false
let pathRulesPromise = null

/** Register the repo's existing TS-resolution hook exactly once. */
function registerRepoHooks() {
  if (hooksRegistered) return
  register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)
  hooksRegistered = true
}

/**
 * Import the shipping P1 path algebra.
 *
 * @returns {Promise<{ toLocatorKey: Function, matchLocator: Function }>}
 */
export function loadPathRules() {
  if (pathRulesPromise !== null) return pathRulesPromise
  registerRepoHooks()
  pathRulesPromise = import(
    pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'member-io-policy', 'src', 'path-rules.ts')).href
  ).then((module) => Object.freeze({
    toLocatorKey: module.toLocatorKey,
    matchLocator: module.matchLocator,
  }))
  return pathRulesPromise
}

/**
 * Observe a locator with the new lane's comparison key (the `compare.kind =
 * equal` observation shape).
 *
 * @param {string} locator
 * @returns {Promise<{ absolute: boolean, segments: string[] }>}
 */
export async function observeLocator(locator) {
  const { toLocatorKey } = await loadPathRules()
  const key = toLocatorKey(locator)
  return { absolute: key.absolute, segments: [...key.segments] }
}

/**
 * Observe the new lane's disposition for one authored locator against one
 * lane (the `compare.kind = lane-decision` observation shape).
 *
 * @param {{ mode: 'all'|'restricted', allow: string[], ask: string[], deny: string[] }} lane
 * @param {string} locator
 * @returns {Promise<'allow'|'ask'|'deny'>}
 */
export async function observeLaneDecision(lane, locator) {
  const { matchLocator } = await loadPathRules()
  return matchLocator(
    Object.freeze({
      mode: lane.mode,
      allow: Object.freeze([...lane.allow]),
      ask: Object.freeze([...lane.ask]),
      deny: Object.freeze([...lane.deny]),
    }),
    locator,
  )
}
