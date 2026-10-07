/**
 * The type surface for `composition-smoke-closure.mjs` (A4-PR7 Task 7.5).
 *
 * Same convention as `verify-blueprint-version-clean.d.mts`: a `.mjs` gate tool
 * that a TypeScript test imports gets a sibling declaration file, because an
 * `any` import would let a renamed field (`onwardUnresolved`? `skipped`?) read
 * as a passing assertion — and the whole point of this module is that its
 * fields decide PASS vs SKIP vs FAIL.
 */

/** Which side of the dependency boundary an unresolved specifier belongs to. */
export type SpecifierZone = 'own' | 'upstream'

export interface UnresolvedSpecifier {
  readonly specifier: string
  readonly importer: string
  readonly zone: SpecifierZone
  readonly package?: string | null
}

export interface ClosureScanResult {
  /** False when the scan could not even read the entry — never reported as clean. */
  readonly ran: boolean
  readonly reason: string | null
  readonly visitedFiles: number
  /** The walk hit its file cap; the unresolved sets may be incomplete. */
  readonly truncated: boolean
  /** Unresolved imports asked for by THIS repository's artifact. Never skippable. */
  readonly ownUnresolved: readonly UnresolvedSpecifier[]
  /** Unresolved imports asked for by third-party files — what a SKIP names. */
  readonly upstreamUnresolved: readonly UnresolvedSpecifier[]
  /** Present packages whose entry this scan could not map to a file. */
  readonly untraversed: number
}

export interface ClosureIo {
  readonly fileExists?: (path: string) => boolean
  readonly directoryExists?: (path: string) => boolean
  readonly readFile?: (path: string) => string
  readonly readJson?: (path: string) => unknown
  readonly realpath?: (path: string) => string
  readonly ownPrefixes?: readonly string[]
}

export interface ScanOptions {
  readonly entryFile: string
  readonly repoRoot: string
  readonly maxFiles?: number
  readonly io?: ClosureIo
}

export interface ResolutionFailure {
  readonly code: string
  readonly specifier: string
  readonly importer: string
  readonly package: string | null
}

export type StepStatus = 'run' | 'skip' | 'fail'

export interface StepDecision {
  readonly status: StepStatus
  /** Why. For `skip` this is replaced by `formatSkipDetail`'s named list. */
  readonly why: string
  /** The named missing packages a SKIP reports (set only for `skip`). */
  readonly missing?: readonly string[]
}

export const ASSET_SPECIFIER: RegExp
export const RESOLUTION_ERROR_CODES: readonly string[]

export function isBuiltinSpecifier(specifier: string): boolean
export function packageNameOf(specifier: string): string | null
export function isInsideNodeModules(path: string): boolean
export function esmStaticSpecifiers(text: string): string[]
export function findPackageDirectory(
  fromDirectory: string,
  packageName: string | null,
  io?: Pick<ClosureIo, 'directoryExists'>,
): string | null
export function resolvePackageEntryFile(
  packageDirectory: string,
  specifier: string,
  io?: Pick<ClosureIo, 'fileExists' | 'readJson'>,
): string | null
export function scanModuleClosure(options: ScanOptions): ClosureScanResult
export function resolutionFailureOf(error: unknown): ResolutionFailure | null
export function upstreamMissingPackages(
  closure: ClosureScanResult | null,
  loadErrorPackage?: string | null,
): string[]
export function classifyClosureStep(input: {
  readonly entryExists: boolean
  readonly closure: ClosureScanResult | null
  readonly loadError?: unknown
}): StepDecision
export function formatSkipDetail(missing: readonly string[]): string
export function repoRelative(repoRoot: string, absolute: string): string
