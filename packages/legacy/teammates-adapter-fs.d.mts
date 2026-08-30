/**
 * Type surface for `teammates-adapter-fs.mjs` (P7-T6 legacy teammates
 * import adapter, synchronous filesystem seam).
 *
 * @module @dsh-agent-team/legacy/teammates-adapter-fs
 */

/** One raw legacy teammate file as read from a directory. */
export interface LegacyTeammateFileEntry {
  /** Base name of the `.md` file. */
  readonly fileName: string
  /** Raw UTF-8 file content. */
  readonly content: string
}

/** One shipped adapter source file (path + content) for the source scan. */
export interface AdapterSourceFile {
  /** Absolute path of the source file. */
  readonly path: string
  /** UTF-8 source content. */
  readonly content: string
}

/** Resolve a fixture directory under `test/fixtures/` (path-traversal safe). */
export declare function fixtureDir(name: string): string

/**
 * Read one legacy teammates directory (sorted `.md` entries). A missing
 * directory yields `[]` (ported legacy silent-skip).
 */
export declare function readTeammateDirectory(dirPath: string): readonly LegacyTeammateFileEntry[]

/** Read one of the committed fixture directories under `test/fixtures/`. */
export declare function readFixtureTeammates(fixtureName: string): readonly LegacyTeammateFileEntry[]

/** The shipped adapter source texts for the p7t6 no-runtime-authority scan. */
export declare function adapterSourceTexts(): readonly AdapterSourceFile[]

/**
 * Create `.scratch-p7t6-<name>` under `test/fixtures/` and write the given
 * files. `name` must match `^p7t6-[a-z0-9][a-z0-9-]*$`.
 * @returns the absolute scratch directory path.
 */
export declare function createScratchTeammatesDir(
  name: string,
  files: readonly { readonly fileName: string; readonly content: string }[],
): string

/** Overwrite one file inside an existing scratch teammates directory. */
export declare function writeScratchTeammateFile(name: string, fileName: string, content: string): void

/** Remove a scratch teammates directory (idempotent). */
export declare function removeScratchTeammatesDir(name: string): void
