/** Type surface of the ONE stage-1 managed projection law (A5M2
 *  coverage-safety card). Production glue and the directed suite share this
 *  exact function; probes that throw or are absent fail CLOSED (ungoverned). */

export interface CoverageClass {
  readonly kind?: unknown
}

export type ClassOf = (name: string) => CoverageClass | undefined | null

export type GovernedProbe = (name: string) => boolean

export interface CoverageFactsPorts {
  readonly classOf: ClassOf
  readonly placementGoverned: GovernedProbe
  readonly scheduleGoverned: GovernedProbe
  readonly runCodeGoverned: GovernedProbe
}

export declare function projectManagedToolNames(
  vocabulary: readonly string[],
  facts: CoverageFactsPorts,
): string[]
