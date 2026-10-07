/**
 * The type surface for `verify-blueprint-version-clean.mjs` (A4-PR7 Task 7.5).
 *
 * The repository's convention for a `.mjs` tool that a TypeScript test imports
 * is a sibling `.d.mts` (the precedent is `packages/runtime/root-binding/harness/
 * persona-probe.mjs` with `persona-probe.d.mts`, recorded in the p4t6 inventory).
 * Declaring it here rather than casting at the call site matters: the wrapper
 * test's assertions are only as trustworthy as the shapes they compare, and an
 * `any` import would let a renamed field read as a passing assertion.
 */

export interface BlueprintVersionSite {
  readonly path: string
  /** 1-based line of the offending literal; 0 for an unreadable tracked path. */
  readonly line: number
  /** The declared document version; null when the file could not be read. */
  readonly version: number | null
  readonly unreadable: boolean
  /** Why the file could not be read (set only when `unreadable`). */
  readonly why?: string | null
}

export interface BlueprintVersionScanResult {
  /** False when the scan could not enumerate the tree — never reported as clean. */
  readonly ran: boolean
  readonly reason: string | null
  /** Tracked files inside the fence's scope (the positive control for `ran`). */
  readonly scopeFiles: number
  readonly sites: readonly BlueprintVersionSite[]
}

/** Scan the tracked tree (never the filesystem, never `rg`) for retired-version sites. */
export function scanBlueprintVersionSites(): BlueprintVersionScanResult

/** The pure half of the predicate, exported so it can be tested on samples. */
export function versionSitesInText(text: string): ReadonlyArray<{ line: number; version: number }>

/** The machine-readable report: one `OFFENDING <path> :: …` line per site. */
export function formatReport(result: BlueprintVersionScanResult): string
