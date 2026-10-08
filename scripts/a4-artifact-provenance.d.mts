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

/**
 * What the tree says about one declared artifact. `artifactProvenance` throws rather than
 * answering from the wrong directory; see its declaration below.
 */
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

/**
 * @throws if `repoRoot` is not the toplevel of a worktree (compared by realpath, so a symlinked
 * path still counts as the toplevel). Measured before the guard: called with `repoRoot` set to
 * `packages/client`, this module answered `outputRoot: "packages"` and
 * `manifestEntry.package: "../../../package.json"` and still returned a confident `refused` —
 * an answer about a tree it was not standing in. A leg that refuses for a reason it has not
 * measured is worse than one that fails, because the reason is the only part anyone reads.
 */
export function artifactProvenance(a: {
  repoRoot: string
  rel: string
  label?: string
  installSurfaces?: readonly string[]
}): ArtifactProvenance

/**
 * A one-line description of the tree the verdict was reached in, from
 * `git status --porcelain` + `git rev-parse --short HEAD`.
 *
 * The counts are of **entries**, which is what the sentence says it counted: an untracked
 * directory is ONE entry, not the files inside it, and untracked entries are included because a
 * verdict read from disk was measured over them. A previous wording claimed "N tracked file(s)
 * not matching HEAD" for what was three files inside one new directory — a reason string
 * describing a count it did not take, which is the same failure as a transcript with no results
 * in it. If git answers nothing, the string says `UNREADABLE` rather than `clean`.
 */
export function treeShape(a: { repoRoot: string }): string

/**
 * The verdict for an ABSENT artifact — and only that. The precondition is enforced rather than
 * documented: `prov.exists === true` returns `refused` naming the wrong question, ahead of every
 * absence branch, because this function never reads file contents and every sentence it can
 * otherwise write asserts that the file is missing. Before the guard it answered a healthy tree with
 * "…is missing while packages/client/dist carries 400 other file(s)" and a `failed` verdict —
 * measured twice inside an hour at `d6e786c7`, which is the reachability proof — and §7.6 pins the
 * behaviour in a leg that calls it that way on purpose.
 */
export function absentArtifactVerdict(prov: ArtifactProvenance, opts?: { command?: string }): AbsentVerdict

/**
 * `artifactProvenance` + `treeShape` + `absentArtifactVerdict` in one call, so a caller cannot
 * produce a verdict without also producing the tree it was reached in. Same wrong-question refusal:
 * `.prov.exists === true` ⇒ `verdict: 'refused'`.
 */
export function classifyAbsentArtifact(a: {
  repoRoot: string
  rel: string
  label?: string
  command?: string
  installSurfaces?: readonly string[]
}): AbsentVerdict & { prov: ArtifactProvenance }
