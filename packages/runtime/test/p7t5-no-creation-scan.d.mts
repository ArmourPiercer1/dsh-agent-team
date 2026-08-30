/**
 * p7t5-no-creation-scan.d.mts — the tsc type surface of
 * `p7t5-no-creation-scan.mjs` (the same `.mjs` + adjacent `.d.mts`
 * pattern as the P4-T6 `session-event-scan` and the P6-T6
 * `p6t6-bypass-scan`): only `.mjs` files may import `node:` builtins;
 * tsc (NodeNext) resolves these declarations for the
 * `./p7t5-no-creation-scan.mjs` import specifier, while the plain-node
 * runner loads the `.mjs` natively.
 *
 * This file is inside the P4-T6 whole-tree scanner's scope
 * (`packages/**`) and is NOT among its two self-excluded files, so it
 * carries zero legacy SessionEvent denylist tokens.
 *
 * @module p7t5-no-creation-scan (type surface)
 */

/** One no-creation-rule violation at one source location. */
export interface NoCreationScanViolation {
  /** The scanned file, POSIX path relative to the repo root. */
  readonly file: string
  /** The stable rule id (`R1` … `R7`; see the `.mjs` header). */
  readonly rule: string
  /** 1-based line of the violation. */
  readonly line: number
  /** 1-based column of the violation. */
  readonly column: number
  /** The offending specifier / text, for reportability. */
  readonly detail: string
}

/** The result of running the rules over one source text. */
export interface NoCreationTextResult {
  /** Every import specifier extracted from the text. */
  readonly importSpecifiers: readonly string[]
  /** Every violation found in the text, sorted by (line, column, rule). */
  readonly violations: readonly NoCreationScanViolation[]
}

/** Per-file summary of one scanned source file. */
export interface NoCreationScanFileResult {
  /** The scanned file, POSIX path relative to the repo root. */
  readonly file: string
  /** Every import specifier of the file. */
  readonly importSpecifiers: readonly string[]
  /** The number of violations found in the file. */
  readonly violations: number
}

/** The result of one whole-module scan. */
export interface NoCreationScanResult {
  /** Every scanned file, POSIX path relative to the repo root. */
  readonly files: readonly string[]
  /** The per-file summaries, in file order. */
  readonly fileResults: readonly NoCreationScanFileResult[]
  /** Every violation, in (file, line, column, rule) order. */
  readonly violations: readonly NoCreationScanViolation[]
  /** The total number of violations (must be zero for a green scan). */
  readonly totalViolations: number
  /** The total number of import specifiers checked. */
  readonly totalImportSpecifiers: number
}

/**
 * Run every rule over one source text.
 * @param text - the full source text of one file.
 * @param file - the file label recorded on each violation.
 */
export declare function matchNoCreationRulesInText(
  text: string,
  file?: string,
): NoCreationTextResult

/**
 * Run the deterministic scan over every `.ts` file under
 * `packages/runtime/handoff/` (the handoff module).
 * @returns the scan result (files, per-file summaries, every violation).
 */
export declare function scanHandoffNoCreation(): NoCreationScanResult
