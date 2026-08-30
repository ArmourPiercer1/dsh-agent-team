/**
 * session-event-scan.d.mts — the tsc type surface of `session-event-scan.mjs`
 * (ruling R24, same `.mjs` + adjacent `.d.mts` pattern as the P4-T5
 * `file-seam` harness): only `.mjs` files may import `node:` builtins;
 * tsc (NodeNext) resolves these declarations for the
 * `../fault-injection/session-event-scan.mjs` import specifier, while the
 * plain-node runner loads the `.mjs` natively.
 *
 * Token-free by design: this file is INSIDE the scanned tree
 * (`packages/testkit/fault-injection/`) and is NOT among the two
 * self-excluded files, so it must carry zero denylist tokens. The
 * denylist vocabulary itself (the legacy event strings, the legacy payload
 * symbols, and the legacy declaration-merging identifier + module
 * specifier) lives ONLY in `session-event-scan.mjs` and in the excluded
 * committed test. Refer to the module header of the `.mjs` for the exact
 * frozen vocabulary.
 *
 * @module fault-injection/session-event-scan
 */

/** One denylist hit at one source location. */
export interface SessionEventScanHit {
  /** The scanned file, POSIX path relative to the repo root. */
  readonly file: string
  /** 1-based line of the hit. */
  readonly line: number
  /** 1-based column (code unit offset + 1) of the matched token. */
  readonly column: number
  /**
   * The denylist category: an exact quoted legacy event string literal
   * (`event-string`), an exact word-bounded legacy payload symbol
   * (`payload-symbol`), or the legacy declaration-merging pattern in the
   * same file (`declaration-merge`, one file-level hit).
   */
  readonly kind: 'event-string' | 'payload-symbol' | 'declaration-merge'
  /** The exact matched token. */
  readonly token: string
}

/** Per-category hit counts plus the total. */
export interface SessionEventScanSummary {
  readonly eventString: number
  readonly payloadSymbol: number
  readonly declarationMerge: number
  readonly total: number
}

/** One skipped dependency/build directory. */
export interface SkippedDir {
  /** The directory segment name (`node_modules` or `dist`). */
  readonly name: string
  /** POSIX path relative to the repo root. */
  readonly path: string
}

/** The deterministic result of one full tree scan. */
export interface SessionEventScanResult {
  /** The resolved repo root the scan ran from. */
  readonly repoRoot: string
  /** The `packages` directory the scan covered. */
  readonly packagesDir: string
  /** The package directory names under `packages/**` (sorted). */
  readonly packageDirs: readonly string[]
  /**
   * Every scanned file (POSIX, repo-root-relative, sorted). Excludes
   * `node_modules`/`dist` trees and the two self-referential files (the
   * scanner `.mjs` itself and the committed `p4t6-*.test.ts`).
   */
  readonly files: readonly string[]
  /** `files.length`. */
  readonly filesScanned: number
  /** The two self-referential files skipped by the exclusion contract. */
  readonly excludedSelfFiles: readonly string[]
  /** Every `node_modules`/`dist` directory skipped. */
  readonly skippedDirs: readonly SkippedDir[]
  /** All denylist hits, sorted by (file, line, column, kind, token). */
  readonly hits: readonly SessionEventScanHit[]
  /** Per-category counts. */
  readonly summary: SessionEventScanSummary
}

/**
 * Scan every `.ts`/`.mts`/`.mjs` file under `packages/**` for the frozen
 * Team SessionEvent denylist. Deterministic: the same tree yields the same
 * result on every run (see the `.mjs` module header for the exact matching
 * precision and the exclusion contract).
 * @param options - optional override of the repo root.
 * @returns the deterministic scan result.
 * @throws when a candidate file cannot be read (fail loud, never skip).
 */
export declare function scanSessionEventVocabulary(options?: { readonly repoRoot?: string }): SessionEventScanResult

/**
 * Match the denylist inside one text (a single file's content, or one
 * synthetic control sample for the positive/negative tests).
 * @param text - the text to match.
 * @param file - the reported file label (defaults to `<text>`).
 * @returns the hits, sorted by (line, column, kind, token).
 */
export declare function matchDenyListInText(text: string, file?: string): readonly SessionEventScanHit[]
