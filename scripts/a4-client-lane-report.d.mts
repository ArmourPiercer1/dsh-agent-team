/**
 * The type surface for `a4-client-lane-report.mjs` (A4-PR7 G2, the summary-parser fix).
 *
 * Typed for the reason its siblings are: the merge-gate leg classifies through THIS function
 * rather than a local copy, so the leg, the witness script, and the unit pins cannot disagree
 * about what a verdict means. A `verdict` widened to `string` here would let a new state pass
 * as an old one; it stays a closed union.
 */

export interface ClientLaneReportRun {
  /** Child stdout+stderr verbatim — styling and all. Parsed only after normalisation. */
  out?: string
  /** Content of the `--outputFile.json` report; `null` when the file was not there. */
  jsonText?: string | null
  /** The process exit status; null/undefined means it was not observed and is not cross-checked. */
  code?: number | null
  /** Trio spec files absent from the tree, listed BEFORE the run whose honesty is in question. */
  missingTrioFiles?: readonly string[]
}

export type ClientLaneVerdict = 'passed' | 'failed' | 'refused'

export interface ClientLaneReportVerdict {
  verdict: ClientLaneVerdict
  why: string
  /**
   * What the instrument MEASURED about the child, independent of which grading branch fired:
   * failing identities parsed and from which source, and whether the child stdout carried ANSI
   * at all (`yes(N ESC bytes)` / `no`). The G2 refusal claimed absence about output holding
   * three summaries; a leg that quotes `observed` next to `why` cannot make that mistake
   * silently — the two sentences disagree out loud.
   */
  observed: string
}

export const CLIENT_BASELINE_FAILURES: readonly string[]
export const CLIENT_DISCLOSED_LOCATION_DEPENDENT: string
export const CLIENT_TRIO_FILES: readonly string[]

export function stripAnsi(text: string): string

export function classifyClientLaneReport(run: ClientLaneReportRun): ClientLaneReportVerdict
