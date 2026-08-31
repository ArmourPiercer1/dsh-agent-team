/**
 * p8t3-negative-scan.d.mts — the tsc type surface of `p8t3-negative-scan.mjs`
 * (ruling R24, the same `.mjs` + adjacent `.d.mts` pattern as the P4-T5
 * `file-seam` harness and the P4-T6 session-event scanner): only `.mjs`
 * files may import `node:` builtins; tsc (NodeNext) resolves these
 * declarations for the `./p8t3-negative-scan.mjs` import specifier, while
 * the plain-node / vitest runner loads the `.mjs` natively.
 *
 * Token-free by design: this file is INSIDE the scanned tree
 * (`packages/remote/test/`) and is NOT among the P4-T6 scanner's
 * self-excluded files, so it must carry zero denylist tokens.
 *
 * @module remote/test/p8t3-negative-scan
 */

/** One rule violation at one source location. */
export interface P8T3NegativeViolation {
  /** The scanned file, POSIX path relative to the repo root (or the text label). */
  readonly file: string
  /** The violated rule id: `R1`..`R6`. */
  readonly rule: string
  /** 1-based line of the hit. */
  readonly line: number
  /** 1-based column (code unit offset + 1) of the matched token. */
  readonly column: number
  /** A human-readable description of the hit. */
  readonly detail: string
}

/** One import specifier discovered in the scanned text. */
export interface P8T3ImportSpecifier {
  /** The scanned file, POSIX path relative to the repo root (or the text label). */
  readonly file: string
  /** 1-based line of the specifier. */
  readonly line: number
  /** 1-based column of the specifier's opening quote. */
  readonly column: number
  /** The raw specifier string (without quotes). */
  readonly specifier: string
}

/** The per-file / per-text result of applying rules R1–R6. */
export interface P8T3NegativeScanFileResult {
  /** Every import specifier found, sorted by (line, column). */
  readonly importSpecifiers: readonly P8T3ImportSpecifier[]
  /** Every rule violation found, sorted by (line, column, rule). */
  readonly violations: readonly P8T3NegativeViolation[]
}

/** The deterministic result of scanning the P8-T3-owned source tree. */
export interface P8T3NegativeScanResult {
  /** Every scanned file, POSIX path relative to the repo root, sorted. */
  readonly files: readonly string[]
  /** Per-file results, aligned with `files`. */
  readonly fileResults: readonly P8T3NegativeScanFileResult[]
  /** Every violation across all scanned files, in file order. */
  readonly violations: readonly P8T3NegativeViolation[]
  /** `violations.length`. */
  readonly totalViolations: number
}

/**
 * Apply rules R1–R6 to one text (a single file's content, or one synthetic
 * control sample).
 * @param text - the text to match.
 * @param file - the reported file label (defaults to `<text>`).
 * @returns the import specifiers found plus the violations.
 */
export declare function matchP8T3RulesInText(text: string, file?: string): P8T3NegativeScanFileResult

/**
 * A synthetic sample that must trip R1 + R2 + R6 (builtin, upstream and
 * non-relative specifiers). Built from the imported frozen constant value
 * for the private upstream specifier, never a literal.
 * @returns the control text.
 */
export declare function buildP8T3SpecifierControlText(): string

/**
 * A synthetic sample that must trip R3 (the mirror token) and R4 (four
 * session-log artifact tokens).
 * @returns the control text.
 */
export declare function buildP8T3MirrorLogControlText(): string

/**
 * A synthetic sample that must produce exactly one `event-string` hit and
 * one `declaration-merge` hit under the frozen denylist.
 * @returns the control text.
 */
export declare function buildP8T3VocabularyControlText(): string

/**
 * Scan every `.ts` file under `packages/remote/src` (the P8-T3-owned
 * source files) and apply rules R1–R6 to each.
 * @returns the deterministic scan result.
 * @throws when a candidate file cannot be read (fail loud, never skip).
 */
export declare function scanP8T3OwnedFiles(): P8T3NegativeScanResult
