/**
 * p8t4-negative-scan.d.mts — the tsc type surface of `p8t4-negative-scan.mjs`
 * (ruling R24, the same `.mjs` + adjacent `.d.mts` pattern as the P4-T5
 * `file-seam` harness, the P4-T6 session-event scanner, and the P8-T3
 * remote-contract scanner): only `.mjs` files may import `node:` builtins;
 * tsc (NodeNext) resolves these declarations for the
 * `./p8t4-negative-scan.mjs` import specifier, while the plain-node /
 * vitest runner loads the `.mjs` natively.
 *
 * Token-free by design: this file is both in the tree the P4-T6 scanner
 * scans (`packages/**`) and in this scanner's own owned-file set, so it
 * must carry zero denylist tokens and zero rule tokens — its comments
 * deliberately avoid the artifact word forms.
 *
 * @module remote/test/p8t4-negative-scan
 */

/** One rule violation at one source location. */
export interface P8T4NegativeViolation {
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
export interface P8T4ImportSpecifier {
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
export interface P8T4NegativeScanFileResult {
  /** The scanned file, POSIX path relative to the repo root (or the text label). */
  readonly file: string
  /** Every import specifier found, sorted by (line, column). */
  readonly importSpecifiers: readonly P8T4ImportSpecifier[]
  /** Every rule violation found, sorted by (line, column, rule). */
  readonly violations: readonly P8T4NegativeViolation[]
}

/** The deterministic result of scanning the P8-T4-owned file set. */
export interface P8T4NegativeScanResult {
  /** Every scanned file, POSIX path relative to the repo root, sorted. */
  readonly files: readonly string[]
  /** Per-file results, aligned with `files`. */
  readonly fileResults: readonly P8T4NegativeScanFileResult[]
  /** Every violation across all scanned files, in file order. */
  readonly violations: readonly P8T4NegativeViolation[]
  /** `violations.length`. */
  readonly totalViolations: number
}

/**
 * Apply rules R1–R6 to one text (a single file's content, or one synthetic
 * control sample).
 * @param text - the text to match.
 * @param file - the reported file label (defaults to `<text>`).
 * @param isMjs - whether the label is a `.mjs` file (grants the R1
 *   builtin-import exemption and the R6 exemption for those `node:`
 *   builtin specifiers).
 * @returns the import specifiers found plus the violations.
 */
export declare function matchP8T4RulesInText(
  text: string,
  file?: string,
  isMjs?: boolean,
): P8T4NegativeScanFileResult

/**
 * A synthetic sample that must trip R1 + R2 + R6 (builtin, upstream and
 * non-relative specifiers). Built from runtime fragments and the imported
 * frozen specifier constant — never a literal in this source.
 * @returns the control text.
 */
export declare function buildP8T4SpecifierControlText(): string

/**
 * A synthetic sample that must trip R3 (the mirror token) and R4 (the log
 * artifact tokens: the path fragment, the JSONL name, the camelCase form
 * and the hyphenated form). Assembled at runtime from fragments.
 * @returns the control text.
 */
export declare function buildP8T4MirrorLogControlText(): string

/**
 * A synthetic sample that must produce exactly one `event-string` hit and
 * one `declaration-merge` hit under the frozen denylist. Built at runtime
 * from the imported frozen scanner values — no literal appears in this
 * file.
 * @returns the control text.
 */
export declare function buildP8T4VocabularyControlText(): string

/**
 * Scan exactly the 13 P8-T4-owned files (the 6 push engine files and the
 * 7 P8-T4 test files) and apply rules R1–R6 to each (the `.mjs` scanner
 * file gets the R1 builtin exemption).
 * @returns the deterministic scan result.
 * @throws when an owned file is missing or cannot be read (fail loud,
 *   never skip).
 */
export declare function scanP8T4OwnedFiles(): P8T4NegativeScanResult
