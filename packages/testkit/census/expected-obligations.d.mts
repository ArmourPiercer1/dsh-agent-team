/** A tracked obligation/sources artifact after the fail-closed load. */
export interface CensusArtifact {
  schema: string
  [key: string]: unknown
}
export declare function loadTrackedArtifact(
  repoRoot: string,
  artifactFile: string,
  schemaFile: string,
): { artifact: CensusArtifact; digest: string }
export declare function loadExpectedPair(repoRoot: string): { expected: CensusArtifact; sources: CensusArtifact }
