/**
 * The type surface for `composition-smoke-bundle.mjs` (A4-PR7 Task 7.5).
 * See `composition-smoke-closure.d.mts` for why the declaration lives here
 * rather than in an `any` cast at the call site.
 */

export interface CompositionExpectations {
  readonly rowIds: readonly string[]
  readonly externals: readonly string[]
  readonly pluginName: string
  readonly shimRowId: string
  readonly bundleInstallPath: string
  readonly compositionDir: string
  readonly bundleFilename: string
  readonly nodeHalfFilename: string
}

/** The outcome of evaluating the built bundle in the inert vm surface. */
export interface BundleEvaluation {
  /** The registration script ran (the `window.__ModuleLoader__.load` calls). */
  readonly loaded: boolean
  /** The factory ran to completion (our own top-level code did not throw). */
  readonly evaluated: boolean
  readonly error: string | null
  readonly registrations: readonly string[]
  readonly requiredSpecifiers: readonly string[]
  readonly namespace: unknown
}

export interface CompositionCheck {
  readonly id: string
  readonly ok: boolean
  readonly detail: string
}

export interface CompositionSurfaceResult {
  readonly ran: boolean
  readonly checks: readonly CompositionCheck[]
  readonly evaluation: BundleEvaluation
}

export interface CompositionSurfaceOptions {
  readonly repoRoot: string
  readonly compositionDir?: string
  readonly bundleFile?: string
  readonly rootManifestFile?: string
  readonly clientManifestFile?: string
  readonly installSurfaces?: readonly string[]
  readonly hostEntryFile?: string | null
  readonly hostModule?: {
    readonly defaultGlueUrl?: (hostModuleUrl: string) => string
    readonly defaultSeamUrlCandidates?: (hostModuleUrl: string) => readonly string[]
  } | null
  readonly gluePlacementDist?: string | null
  readonly expectations?: Partial<CompositionExpectations>
  readonly fileExists?: (path: string) => boolean
  readonly readFile?: (path: string) => string
}

export const DEFAULT_EXPECTATIONS: CompositionExpectations

/**
 * The arms `checkCompositionSurface` is required to report, by id. Declared by
 * hand, never derived from the emitted checks: the defect this guards is an arm
 * that stopped being emitted, so the expectation has to live outside the code
 * that emits. `composition-smoke.mjs` fails on either direction of the
 * difference (a missing id and an unrequired one).
 */
export const REQUIRED_CHECK_IDS: readonly string[]

/** A path the built shim manifest advertises, normalised and repo-relative. */
export interface AdvertisedShimPath {
  /** Which manifest entry said it, e.g. `exports[./client]` or `files[x.js]`. */
  readonly label: string
  readonly path: string
}

/** What the built shim manifest on disk tells a consumer to load. */
export function advertisedShimPaths(
  shimManifest: unknown,
  compositionDir: string,
): AdvertisedShimPath[]

export function checkSetDifferences(checks: readonly CompositionCheck[]): {
  readonly missing: readonly string[]
  readonly unexpected: readonly string[]
}

export function createMinimalBrowserSurface(): {
  readonly rows: Array<{ id: string; factory: (require: (s: string) => unknown) => unknown }>
  readonly sandbox: Record<string, unknown>
}

export function evaluateClientBundle(options: {
  readonly bundleFile: string
  readonly readFile?: (path: string) => string
}): BundleEvaluation

export function staticExternalRequests(bundleText: string): string[]

export function checkCompositionSurface(options: CompositionSurfaceOptions): Promise<CompositionSurfaceResult>
