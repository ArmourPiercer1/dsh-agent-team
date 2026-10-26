/**
 * Type surface for the ARC-A fitness scanner (`scan.mjs`) — the sidecar
 * declaration convention this repo already uses for its plain-.mjs testkit
 * modules (session-event-scan.d.mts is the sibling precedent). The scanner
 * stays plain JavaScript; TS consumers (the fitness suite) typecheck
 * against this surface.
 */
export declare const sha256Text: (text: string) => string

/** Prefix/dir set of the PROTECTED CENTER (law L1's shape). */
export declare const PROTECTED_CENTER_SET: readonly string[]

export declare const isProtectedPath: (p: string) => boolean

export declare function trackedProtectedFiles(repoRoot: string): string[]

export declare function readTreeMap(repoRoot: string, paths: readonly string[]): Map<string, string>

export type ProtectedLedger = {
  files: ReadonlyArray<{ path: string; sha256: string }>
  overrides: ReadonlyArray<{ path: string; sha256: string; pr: string; reason: string }>
}

export type FitnessViolation = { path: string; kind: string; detail: string }

export declare function scanProtectedLedger(input: {
  current: ReadonlyMap<string, string>
  ledger: ProtectedLedger
  tracked: readonly string[]
}): { violations: FitnessViolation[] }

export declare const TOOL_NAME_LITERALS: readonly string[]

export declare function scanNameLiterals(input: {
  files: ReadonlyMap<string, string>
}): { hits: Array<{ path: string; literal: string; line: number }> }

export type NameEntry = { entry: string; kind: 'literal' | 'bound-definition' | 'dynamic' }

export type ContributionFact = {
  path: string
  familyIds: string[]
  nativeNames: NameEntry[] | null
  reviewedSource: boolean
  testOnly: boolean
}

export declare function scanContributions(input: {
  paths: readonly string[]
  files: ReadonlyMap<string, string>
}): { contributions: ContributionFact[] }

export type CensusLedger = {
  families: ReadonlyArray<{
    familyId: string
    lane: string
    mount: string
    contributionPaths: readonly string[]
  }>
}

export declare function scanCensus(input: {
  contributions: readonly ContributionFact[]
  ledger: CensusLedger
}): { violations: FitnessViolation[] }

export declare function scanClosedness(input: {
  contributions: readonly ContributionFact[]
}): { violations: FitnessViolation[] }

export declare function trackedContributionPaths(repoRoot: string): string[]
