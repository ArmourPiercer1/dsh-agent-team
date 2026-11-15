/**
 * test-suite-paths.mjs — the ONE definition of "this path is a test suite".
 *
 * WHY A LEAF MODULE. Two questions are asked all over the CI tooling, and until M6 each asker
 * carried its own regex:
 *   - "is this a node:test suite?"  (discovery, the collection audit, the M6 dispatcher)
 *   - "is this test-like at all?"   (discovery: a vitest .test.ts is a test but must not be handed
 *                                    to `node --test`)
 * Two regexes that disagree by one alternative are not a style problem: the catalog would call a
 * file collected while the dispatcher refuses it, or the audit would count a suite the dispatcher
 * never runs. That is the same class of defect M6 removes for the file lists, so the predicate gets
 * one home too.
 *
 * It lives in a LEAF on purpose: `test-catalog.mjs` imports the collection audit, so the audit
 * cannot import the catalog without a cycle. This module imports nothing.
 *
 * @module scripts/test-suite-paths
 */

/** Everything a runner might own: `.test`/`.spec` with any JS/TS extension. */
export const TEST_LIKE_RE = /\.(?:test|spec)\.(?:mjs|cjs|js|jsx|ts|tsx|mts|cts)$/

/** The node:test subset: only the extensions `node --test` executes as a suite. */
export const NODE_SUITE_RE = /\.(?:test|spec)\.(?:mjs|cjs|js)$/

export function isTestLikePath(file) {
  return TEST_LIKE_RE.test(String(file))
}

export function isNodeSuitePath(file) {
  return NODE_SUITE_RE.test(String(file))
}
