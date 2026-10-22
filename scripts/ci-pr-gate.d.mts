/**
 * The type surface for `ci-pr-gate.mjs`, following the repository convention for a `.mjs`
 * tool that a TypeScript test imports (sibling `.d.mts`; the precedent is
 * `scripts/verify-blueprint-version-clean.d.mts`, itself following
 * `packages/runtime/root-binding/harness/persona-probe.{mjs,d.mts}` recorded in the p4t6
 * inventory). Declaring it beside the script rather than casting at the call site matters:
 * a fixture's assertions are only as trustworthy as the shapes they compare, and an `any`
 * import lets a renamed field read as a passing assertion (PR #356 typecheck RED, run
 * 39743016561 job 119704629468: implicit-any callback parameters under an untyped import).
 *
 * Only the two pure checkers that TypeScript tests actually import are declared; every
 * other export of the script stays untyped for TypeScript consumers because no `.ts` file
 * imports them. If a future test imports another export, ADD it here with its real shape —
 * never widen to `any`.
 */

/** Result shape shared by both pure checkers: findings are human-readable strings; an
 *  empty `findings` array is the ONLY green grade. */
export interface CheckResult {
  findings: string[]
  info: Record<string, unknown>
}

/**
 * Alpha.4 legacy s7-round integrity check (historical-integrity job; fixtures are
 * legacy-only). Green means the round-58 pointer agrees both ways and records are
 * contiguous — never that the phase is current.
 */
export declare function checkStatePointers(input: {
  graphText: string
  logText: string
  isAncestor: (sha: string) => boolean
}): CheckResult

/**
 * Current-contract check (groups A-D hardened; the production path never falls back to
 * the legacy shape). Inputs are injected ports, not ambient fs/git, so fixtures drive
 * it directly.
 */
export declare function checkCurrentContract(input: {
  graphText: string
  readFile: (relPath: string) => string | null
  fileExists: (relPath: string) => boolean
  revExists: (sha: string) => boolean
  baselineCurrent: (sha: string) => boolean
  driftProvider: (sha: string) => string[] | null
}): CheckResult
