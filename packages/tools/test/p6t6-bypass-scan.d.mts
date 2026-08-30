/**
 * p6t6-bypass-scan.d.mts — the tsc type surface of `p6t6-bypass-scan.mjs`
 * (same `.mjs` + adjacent `.d.mts` pattern as the P4-T6
 * `session-event-scan` and the P4-T5 file-seam harness): only `.mjs`
 * files may import `node:` builtins; tsc (NodeNext) resolves these
 * declarations for the `./p6t6-bypass-scan.mjs` import specifier, while
 * the plain-node runner loads the `.mjs` natively.
 *
 * Token-free by design: this file is INSIDE the P4-T6 whole-tree
 * scanner's scope (`packages/**`) and is NOT among its two self-excluded
 * files, so it carries zero denylist tokens. The denylist vocabulary
 * itself lives ONLY in the `.mjs` (assembled at runtime from fragments);
 * here the constants are referenced by type names alone.
 */

/** One bypass-rule violation at one source location. */
export interface BypassScanViolation {
  /** The scanned file, POSIX path relative to the repo root. */
  readonly file: string
  /** The stable rule id (see the `.mjs` header for the rule set). */
  readonly rule: string
  /** 1-based line of the violation. */
  readonly line: number
  /** 1-based column of the violation. */
  readonly column: number
  /** The offending token / specifier, for reportability. */
  readonly detail: string
}

/** Per-file summary of one scanned source file. */
export interface BypassScanFileResult {
  /** The scanned file, POSIX path relative to the repo root. */
  readonly file: string
  /** The number of static import/export-from specifiers checked. */
  readonly importSpecifierCount: number
  /** The number of violations found in this file. */
  readonly violationCount: number
}

/** The deterministic scan result over every `.ts` file under `packages/tools/src/` (recursively). */
export interface BypassScanResult {
  /** Every scanned file, sorted by repo-relative POSIX path. */
  readonly files: readonly string[]
  /** One summary per file, in `files` order. */
  readonly fileResults: readonly BypassScanFileResult[]
  /** Every violation, sorted by (file, line, column, rule, detail). */
  readonly violations: readonly BypassScanViolation[]
  /** `violations.length` (redundant for report convenience). */
  readonly totalViolations: number
  /** Sum of `importSpecifierCount` over all scanned files. */
  readonly totalImportSpecifiers: number
}

/**
 * The frozen legacy event strings (P4-T6 denylist; assembled at runtime
 * in the `.mjs`). Exported so the committed test can build synthetic
 * control samples WITHOUT carrying any exact token literal in its own
 * source (this test file is inside the whole-tree scan scope).
 */
export declare const LEGACY_TEAM_EVENT_STRINGS: readonly string[]

/** The frozen legacy payload symbol names (P4-T6 denylist). */
export declare const LEGACY_PAYLOAD_SYMBOLS: readonly string[]

/** The frozen legacy declaration-merging identifier (P4-T6 denylist). */
export declare const SESSION_EVENT_MAP_IDENTIFIER: string

/** The frozen legacy session-types module specifier (P4-T6 denylist). */
export declare const SESSION_TYPES_SPECIFIER: string

/** The stable rule ids of the bypass scanner. */
export declare const BYPASS_RULES: Readonly<{
  STORAGE_IMPORT: string
  REPOSITORIES_ACCESS: string
  AGENTS_CREATE: string
  LEGACY_EVENT_STRING: string
  LEGACY_PAYLOAD_SYMBOL: string
  LEGACY_SESSION_EVENT_MAP: string
  LEGACY_SESSION_TYPES_SPECIFIER: string
}>

/**
 * Match every bypass rule inside one text (a single file's content, or
 * one synthetic control sample).
 * @param text - the text to match.
 * @param file - the reported file label (defaults to `<text>`).
 * @returns the violations, sorted by (line, column, rule, detail).
 */
export declare function matchBypassRulesInText(
  text: string,
  file?: string,
): readonly BypassScanViolation[]

/**
 * Run the deterministic bypass scan over every `.ts` file under
 * `packages/tools/src/` (recursively).
 * @returns the scan result (files, per-file summaries, every violation).
 */
export declare function scanToolsBypass(): Promise<BypassScanResult>
