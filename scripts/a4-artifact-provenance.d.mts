/**
 * The type surface for `scripts/a4-artifact-provenance.mjs` (A4-PR7, task #2: the
 * never-built versus build-regressed split).
 *
 * Typed rather than `any` for the same reason `composition-smoke-targets.d.mts` is: the
 * consumer is a gate, and the decision this module returns is the difference between
 * "run `pnpm build`" and "the build regressed". A reader that sees `any` cannot tell a
 * missing field from a false one, and a missing `outputFileCount` would silently mean
 * "no siblings", i.e. a regression reported as an unbuilt tree.
 */

/** What the tree says about one declared artifact. */
export interface ArtifactProvenance {
  /** The arm's own label, carried through so a refusal can name the step. */
  readonly label: string
  /** Repository-relative path of the artifact. */
  readonly rel: string
  readonly exists: boolean
  /** Tracked in git: its absence is a defect, never a checkout shape. */
  readonly tracked: boolean
  readonly gitignored: boolean
  /** Inside `INSTALL_SURFACES`, i.e. something a git install actually ships. */
  readonly inInstallSurface: boolean
  /**
   * The outermost untracked-and-gitignored ancestor directory: the root the build emits
   * into, or `null` when no such root exists (then the path is not build output at all).
   */
  readonly outputRoot: string | null
  readonly outputRootExists: boolean
  /** Files currently under `outputRoot`; the sibling count that separates the two reds. */
  readonly outputFileCount: number
  /** The owning package's declared `main`, as disclosure only. */
  readonly manifestEntry: {
    readonly package: string
    readonly declared: string
    readonly target: string
    readonly resolves: boolean
  } | null
  /** Questions git refused to answer. Non-empty forbids a `refused` verdict. */
  readonly unreadable: readonly string[]
  /** The tree the verdict was reached in; set by `classifyAbsentArtifact`. */
  treeShape?: string
}

/** A verdict about an ABSENT artifact. `passed` is not in this vocabulary. */
export interface AbsentVerdict {
  readonly verdict: 'failed' | 'refused'
  readonly why: string
}

export function artifactProvenance(a: {
  repoRoot: string
  rel: string
  label?: string
  installSurfaces?: readonly string[]
}): ArtifactProvenance

export function treeShape(a: { repoRoot: string }): string

export function absentArtifactVerdict(prov: ArtifactProvenance, opts?: { command?: string }): AbsentVerdict

export function classifyAbsentArtifact(a: {
  repoRoot: string
  rel: string
  label?: string
  command?: string
  installSurfaces?: readonly string[]
}): AbsentVerdict & { prov: ArtifactProvenance }
