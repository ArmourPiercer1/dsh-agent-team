export interface WordingViolation {
  readonly line: number
  readonly text: string
  readonly claims?: readonly string[]
  readonly file?: string
}

export interface LintRepoResult {
  readonly violations: readonly WordingViolation[]
  readonly filesScanned: number
  readonly pendingGates: 'absent' | 'checked'
  /**
   * Repo-relative paths of symlinks whose target is missing (ENOENT). The
   * walker skips them (a5-docs-matrix hardening; census 458/459/460 class)
   * and discloses each one — never silently. Other walker errors still throw.
   */
  readonly skippedDangling: readonly string[]
}

export declare function lintMarkdownText(relPath: string, text: string): WordingViolation[]

export declare function lintPendingGatesText(text: string): WordingViolation[]

export declare function lintRepo(repoRoot: string): LintRepoResult
