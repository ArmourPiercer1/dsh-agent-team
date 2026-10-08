/**
 * The type surface for `artifact-check-scratch.mjs` (A4-PR7 Task 7.8).
 *
 * Typed on purpose, for the same reason its siblings are: the merge-gate leg resolves the
 * scratch path through THIS function rather than rebuilding the string, so the leg and the
 * instrument cannot disagree about where the scratch is. A typed import is what makes that a
 * compile error instead of a leg that quietly measures a directory nothing writes to.
 */

/** Path segments under the running checkout where one run's scratch lives. */
export const SCRATCH_PARENT: string

/** The scratch directory for one run; `stamp` must start with the caller's pid. */
export function resolveScratchPath(root: string, stamp: string): string

/** False only for a pid the OS says is gone (ESRCH); true for live pids and unknown errors. */
export function isLive(pid: number): boolean

/**
 * Remove scratch trees left by runs whose pid is gone, including any `legacyPrefixes` entry
 * sitting directly in `root` (the location an earlier version of the instrument used).
 * Returns the paths it removed.
 */
export function sweepStaleScratches(
  root: string,
  opts?: {
    legacyPrefixes?: readonly string[]
    recentMs?: number
    maxAgeMs?: number
    isLivePid?: (pid: number) => boolean
  },
): string[]
