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
}

export declare function lintMarkdownText(relPath: string, text: string): WordingViolation[]

export declare function lintPendingGatesText(text: string): WordingViolation[]

export declare function lintRepo(repoRoot: string): LintRepoResult
