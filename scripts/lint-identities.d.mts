/**
 * Types for `lint-identities.mjs`, which §7.6 imports rather than re-implementing so that the
 * gate and `pnpm lint:identities` cannot drift into two different notions of an identity. The
 * script itself is plain JS (it is a CLI); this sidecar is the repo's convention for importing
 * one from TypeScript — see `composition-smoke-targets.d.mts`.
 */

export type LintUniverse = {
  /** How many files ESLint actually read. `0` means the scan matched nothing, not that it was clean. */
  files: number
  /** The scanned paths that `git check-ignore` claims, sorted. */
  ignored: string[]
  /** Present when git refused to answer; a refusal here forbids believing the census. */
  unreadable?: string
}

export type Capture = {
  ran: boolean
  reason: string | null
  ids: string[]
  universe?: LintUniverse
}

export function captureIdentities(target: string, cwd: string): Capture

export function lintUniverse(cwd: string, paths: string[]): LintUniverse

export function newIdentities(baselineLines: string[], currentLines: string[]): string[]

/**
 * The three answers to "what did the child's stderr say": not captured, empty, or a tail. Split
 * out of `captureIdentities` so the uncaptured arm — unreachable through a piping caller — is
 * reachable by a test at all.
 */
export function describeStderr(stderr: string | null | undefined): string
