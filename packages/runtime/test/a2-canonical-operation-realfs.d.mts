/**
 * a2-canonical-operation-realfs.d.mts — the tsc type surface of
 * `a2-canonical-operation-realfs.mjs` (the same `.mjs` + adjacent
 * `.d.mts` pattern as the P4-T6 `session-event-scan`, the P7-T5
 * `p7t5-no-creation-scan`, and the `t12a-live-bridge`): only `.mjs`
 * files may import `node:` builtins; tsc (NodeNext) resolves these
 * declarations for the `./a2-canonical-operation-realfs.mjs` import
 * specifier, while the plain-node runner loads the `.mjs` natively.
 *
 * This file is inside the P4-T6 whole-tree scanner's scope
 * (`packages/**`) and is NOT among its two self-excluded files, so it
 * carries zero legacy SessionEvent denylist tokens.
 *
 * @module @dsh-agent-team/runtime/test/a2-canonical-operation-realfs (type surface)
 */

/** One resolved target as seen by the module (opaque key + display). */
export interface RealFsTarget {
  /** The backend's opaque canonical key (`targetKey` unbranded). */
  readonly key: string
  /** The backend's display path (`displayPath`). */
  readonly display: string
}

/** One optional symlink/junction probe outcome (skips are recorded, never thrown). */
export interface RealFsProbeOutcome {
  /** The probe ran (false = skipped with `reason`). */
  readonly ok: boolean
  /** Whether the link spelling resolved to the target's key (only when `ok`). */
  readonly sameKey?: boolean
  /** The skip reason (only when `!ok`). */
  readonly reason?: string
}

/** The real-backend case results (only when `available`). */
export interface RealBackendCases {
  /** `resolve('f.txt')` — relative against the bound cwd. */
  readonly relative: RealFsTarget
  /** `resolve(<cwd>/f.txt)` — absolute. */
  readonly absolute: RealFsTarget
  /** A forward-slash spelling of the absolute path. */
  readonly sepVariant: RealFsTarget
  /** `resolve(<cwd>/sub/../f.txt)` — `..` traversal spelling. */
  readonly traversal: RealFsTarget
  /** Whether the temp dir's filesystem resolves case-variants to the same file. */
  readonly caseInsensitive: boolean
  /** `resolve('CaseFile.txt')` — the on-disk spelling (only when `caseInsensitive`). */
  readonly caseBaseline?: RealFsTarget
  /** `resolve('casefile.txt')` — the case-variant spelling (only when `caseInsensitive`). */
  readonly caseVariant?: RealFsTarget
  /** File symlink: `resolve('link-f.txt')` key === `resolve('f.txt')` key. */
  readonly fileSymlink: RealFsProbeOutcome
  /** Directory symlink/junction: `resolve('jlink/g.txt')` key === `resolve('sub/g.txt')` key. */
  readonly dirJunction: RealFsProbeOutcome
  /** Absent file: `resolve('new-dir/new-file.txt')` key (ancestor realpath + missing suffix). */
  readonly absentKey: string
  /** Absent file, `..`-traversed spelling: same expected key. */
  readonly absentTraversalKey: string
  /** Absent file, different name: a distinct key. */
  readonly absentOtherKey: string
}

/** The result of one real-backend case run (or the availability record). */
export interface RealBackendCasesResult {
  /** The test-use prebuilt lib was found and the cases ran. */
  readonly available: boolean
  /** The unavailability reason (only when `!available`). */
  readonly reason?: string
  /** The test-use checkout root (only when `available`). */
  readonly root?: string
  /** The case results (only when `available`). */
  readonly cases?: RealBackendCases
}

/**
 * Run the A2 real-backend canonicalization cases over the pristine
 * test-use `@deepseek-ai/dsh-fs-local` (temp dir under `os.tmpdir`,
 * created and destroyed inside). Never throws — environment problems
 * degrade to `{ available: false, reason }`.
 */
export declare function runRealBackendCases(): Promise<RealBackendCasesResult>
