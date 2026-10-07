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

/** Something the scan could see but not follow, with the reason it stopped. */
export interface ScanHeldItem {
  readonly specifier: string
  readonly importer: string
  readonly zone: SpecifierZone
  readonly reason: string
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
  /**
   * What `untraversed` counts, item by item. A bare count reached no output, so a
   * run holding one such specifier printed byte-identically to a clean run;
   * `formatSkipDetail` prints these, which makes that impossible now.
   */
  readonly untraversedItems: readonly ScanHeldItem[]
  /**
   * Subpaths whose `exports` shape this check could not read. Not failures — but
   * printed, because a silent "I could not tell" is the mute this gate exists to
   * close.
   */
  readonly subpathBails: readonly ScanHeldItem[]
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
/** One string target an `exports` value advertises, labelled by condition path. */
export interface ExportTarget {
  readonly label: string
  readonly target: string
}

export interface CollectedExportTargets {
  readonly targets: readonly ExportTarget[]
  /** False when some part of the value could not be read: never read as "fine". */
  readonly understood: boolean
}

/** Every string an `exports` value advertises, plus whether its shape was read. */
export function collectExportTargets(
  value: unknown,
  label?: string,
  depth?: number,
): CollectedExportTargets

/**
 * The target an `exports` KEY maps `subpath` to under Node's pattern rule (the
 * key's `*` is captured and substituted into the value's `*`), or null when the
 * key does not cover the subpath.
 */
export function exportPatternTarget(key: string, target: unknown, subpath: string): string | null

export interface SubpathVerdict {
  /** True only when Node could not resolve the subpath at all. */
  readonly missing: boolean
  /** Non-null when this check could not read the shape, so nothing is claimed. */
  readonly bail: string | null
  /** The measured reason for a miss, for the printed detail. */
  readonly why: string | null
}

/**
 * The full verdict for one SUBPATH of a package that IS present: uncovered by any
 * `exports` key, or covered — exactly or through a pattern VALUE whose mapped
 * file is then looked for — with every mapped target absent, is a miss; with no
 * `exports` field, a miss is the absence of any legacy candidate. A bare package
 * name or an unreadable manifest is never a miss: unknown is not evidence of
 * absence. What this cannot read comes back as `bail`, which the scan counts and
 * the SKIP line prints.
 */
export function packageSubpathVerdict(
  packageDirectory: string,
  specifier: string,
  io?: Pick<ClosureIo, 'fileExists' | 'readJson'>,
): SubpathVerdict

/** The boolean view of {@link packageSubpathVerdict}; a bail is not a miss. */
export function packageSubpathIsMissing(
  packageDirectory: string,
  specifier: string,
  io?: Pick<ClosureIo, 'fileExists' | 'readJson'>,
): boolean
export function scanModuleClosure(options: ScanOptions): ClosureScanResult
export function resolutionFailureOf(error: unknown): ResolutionFailure | null
/** `…/node_modules/@scope/name/package.json` -> `@scope/name`; null if unrelated. */
export function packageNameOfManifestPath(path: string): string | null
export function upstreamMissingPackages(
  closure: ClosureScanResult | null,
  loadErrorPackage?: string | null,
): string[]
export function classifyClosureStep(input: {
  readonly entryExists: boolean
  readonly closure: ClosureScanResult | null
  readonly loadError?: unknown
}): StepDecision
/**
 * The SKIP line. Beyond naming the unresolvable packages it prints everything the
 * scan held back — untraversed specifiers and `exports` shapes it could not read —
 * because a SKIP whose text is identical with and without them is exactly how a
 * laundered defect looks.
 */
export function formatSkipDetail(
  missing: readonly string[],
  extra?: { readonly untraversed?: readonly ScanHeldItem[]; readonly bails?: readonly ScanHeldItem[] },
): string
export function repoRelative(repoRoot: string, absolute: string): string
