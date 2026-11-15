/**
 * Independent effect witnesses — observation channels that do not trust the
 * tool's own return value or the host's log lines.
 *
 * HONESTY RULE (the reason this module is narrow): a filesystem witness says
 * NOTHING about process or network effects. Those domains are reported with
 * `observed: false`, `instrumented: false`, AND listed in `blindDomains`, so
 * the contract oracle refuses to grade a contract it cannot see instead of
 * reading "no filesystem write" as "no effect anywhere".
 *
 * PROVENANCE IS A PROPERTY OF AN INSTRUMENT INSTANCE (M7-A, corrected). A row
 * is not evidence because it has the right SHAPE: the first seal was attached
 * to whatever `observe()` returned, so `createBlindWitness(anythingWithObserve,
 * [])` could stamp a caller-supplied object and the oracle accepted the result
 * as `witnessed`. Now the module keeps a private `WeakSet` of the witness
 * INSTANCES it created, every row carries a non-enumerable reference to the
 * instance that produced it, and `isSealedWitnessObservation` answers true only
 * when that referenced instance is still in the set. Consequences: (a) a
 * hand-built row has no reference and fails; (b) a blind wrapper over a
 * non-instrument REFUSES to be constructed (`createBlindWitness` throws), so no
 * exported function can turn an arbitrary object into a witnessed row; (c) rows
 * are frozen, so a sealed row cannot be edited into a different observation;
 * (d) the reference does not survive JSON, so a replayed evidence file is
 * unsealed by construction.
 *
 * SCOPE (M7-A, corrected). A witness watches PATHS, not "the filesystem". Every
 * row therefore declares the absolute paths its instrument actually watched
 * (`watchedPaths`) and, when it reports an effect, the absolute paths it saw
 * change (`observedPaths`). The oracle may only grade a contract whose required
 * scope is COVERED by that watch set; otherwise it must answer INCONCLUSIVE.
 * `evidence` is the human-readable projection of the same facts; the oracle
 * never parses it. `exclude` names the instrument's DECLARED blind spots (the
 * Host's own mutable state), and a required path inside one is not covered
 * either.
 *
 * KNOWN LIMITS (stated, not hidden): the witness compares two point-in-time
 * snapshots, so (a) a file created and deleted between them is invisible,
 * (b) a write performed through a symlink to a target outside every watched
 * root shows up only as the symlink itself changing, and (c) a file above
 * {@link DIGEST_LIMIT} is compared by size+mtime only. Those are limits of the
 * channel; the oracle reports them and no verdict may read them as clean.
 *
 * M2/M7-A SCOPE: only the filesystem channel is implemented. No process, PTY,
 * HTTP proxy, or network-outlet witness exists yet; those need E2 (real
 * confined subprocess / OS fidelity).
 *
 * @module @dsh-agent-team/testkit/effect-witness
 */
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

/** The effect domains a contract can be graded over. */
export type EffectDomain = 'filesystem' | 'process' | 'network'

/** One raw observation of one effect domain. */
export interface WitnessObservation {
  domain: EffectDomain
  /** Whether an effect was seen in this domain. */
  observed: boolean
  /**
   * Whether this channel can see the domain at all. Set by the witness
   * implementation; the oracle refuses to grade a domain whose row is false.
   */
  instrumented: boolean
  evidence: string[]
  truncated?: boolean
  /**
   * ABSOLUTE paths this row's instrument actually watched for `domain`. A
   * directory covers its subtree; the oracle grades a required path only when a
   * watched path contains it. Present on every row a witness produces.
   */
  watchedPaths?: string[]
  /**
   * ABSOLUTE paths that changed (created/modified/deleted) behind
   * `observed: true`. Capped; `truncated` says so. The oracle classifies these
   * against the contract's authorized paths — evidence strings are never parsed.
   */
  observedPaths?: string[]
}

/** A read-only, independent observation channel. */
export interface EffectWitness {
  observe(): Promise<WitnessObservation[]>
  /** Domains this instrument cannot see; a verdict must not assume them clean. */
  readonly blindDomains: EffectDomain[]
  /** Absolute roots this instrument watches (declared, never inferred). */
  readonly watchedPaths: readonly string[]
}

/** All three domains, in the fixed reporting order. */
const ALL_DOMAINS: readonly EffectDomain[] = ['filesystem', 'process', 'network']

/** Changed paths beyond this count are dropped from `evidence` and flagged. */
const EVIDENCE_CAP = 20

/** Changed paths beyond this count are dropped from `observedPaths` and flagged. */
const OBSERVED_CAP = 500

/** Files at or below this size are compared by content digest as well. */
export const DIGEST_LIMIT = 4 * 1024 * 1024

/** One entry's identity for change detection, including its kind. */
type EntryIdentity = string

/**
 * The module's own registry of instrument INSTANCES. Private on purpose: it is
 * the only thing that can answer "was this row produced by an instrument?".
 */
const INSTRUMENTS = new WeakSet<object>()

/** Non-enumerable link from a row to the instrument instance that produced it. */
const WITNESS_INSTRUMENT = Symbol('@dsh-agent-team/testkit/effect-witness/instrument')

/** Whether `path` is `root` or lies inside it (both absolute, resolved). */
function coveredBy(path: string, root: string): boolean {
  const rel = relative(resolve(root), resolve(path))
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`))
}

/** Read `code` off an unknown thrown value without leaning on the NodeJS namespace. */
function errnoCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined
}

function digestOf(path: string, size: number): string {
  if (size > DIGEST_LIMIT) return 'no-digest'
  return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 32)
}

function identityOf(path: string): EntryIdentity {
  const stats = lstatSync(path)
  if (stats.isSymbolicLink()) return `link:${readlinkSync(path)}`
  if (stats.isDirectory()) return 'dir'
  if (!stats.isFile()) return `other:${stats.mode}`
  return `file:${stats.size}:${stats.mtimeMs}:${digestOf(path, stats.size)}`
}

/**
 * Snapshot every entry under each root (files, directories, symlinks), keyed by
 * absolute path. A missing root is an empty snapshot; any other read failure
 * propagates, because an unreadable instrument must not read as "no change".
 * Paths inside `exclude` (and their subtrees) are not recorded: they are the
 * instrument's DECLARED blind spots.
 */
function snapshot(roots: readonly string[], exclude: readonly string[]): Map<string, EntryIdentity> {
  const entries = new Map<string, EntryIdentity>()
  const isExcluded = (path: string): boolean => exclude.some((root) => coveredBy(path, root))
  const walk = (current: string): void => {
    let children
    try {
      children = readdirSync(current, { withFileTypes: true })
    } catch (error) {
      if (errnoCode(error) === 'ENOENT') return
      throw error
    }
    for (const entry of children) {
      const path = join(current, entry.name)
      if (isExcluded(path)) continue
      try {
        entries.set(path, identityOf(path))
      } catch (error) {
        if (errnoCode(error) === 'ENOENT') continue
        throw error
      }
      // A symlinked directory is recorded, never followed: its target is a
      // different location, and following it would report on a tree the caller
      // did not name.
      if (entry.isDirectory()) walk(path)
    }
  }
  for (const root of roots) walk(root)
  return entries
}

function changes(baseline: Map<string, EntryIdentity>, current: Map<string, EntryIdentity>): string[] {
  const out: string[] = []
  for (const [path, identity] of current) {
    if (baseline.get(path) !== identity) out.push(path)
  }
  for (const path of baseline.keys()) {
    if (!current.has(path)) out.push(path)
  }
  return out.sort()
}

function label(path: string, root: string): string {
  const rel = relative(root, path)
  return rel === '' || rel.startsWith(`..${sep}`) || rel === '..' ? path : rel
}

/**
 * Bind rows to the instrument instance that produced them.
 *
 * The seal is a non-enumerable reference to the INSTANCE, so the oracle asks
 * the module's private registry rather than trusting a shape. Rows and their
 * arrays are frozen: a sealed row cannot be edited into a different
 * observation after the fact.
 */
function instrumentRows(rows: WitnessObservation[], instrument: object): WitnessObservation[] {
  for (const row of rows) {
    Object.freeze(row.evidence)
    if (row.watchedPaths !== undefined) Object.freeze(row.watchedPaths)
    if (row.observedPaths !== undefined) Object.freeze(row.observedPaths)
    Object.defineProperty(row, WITNESS_INSTRUMENT, { value: instrument, enumerable: false, writable: false })
    Object.freeze(row)
  }
  return rows
}

/**
 * Whether one observation row was produced by an instrument INSTANCE this
 * module created (see the module doc: provenance is an instance property).
 *
 * @param value - any value claiming to be a {@link WitnessObservation}.
 */
export function isSealedWitnessObservation(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const instrument = (value as Record<symbol, unknown>)[WITNESS_INSTRUMENT]
  return typeof instrument === 'object' && instrument !== null && INSTRUMENTS.has(instrument)
}

/**
 * Whether EVERY row was produced by this module's instruments. Empty input is
 * not sealed: an empty witness is an absence of observation, not a seal.
 *
 * @param rows - the observations handed to an oracle.
 */
export function areSealedWitnessObservations(rows: readonly unknown[]): boolean {
  return rows.length > 0 && rows.every((row) => isSealedWitnessObservation(row))
}

/**
 * Create a filesystem witness over a declared set of paths.
 *
 * The verdict is: an entry under one of the watched roots was CREATED,
 * MODIFIED or DELETED, where a file's identity is `size:mtimeMs:sha256` (digest
 * up to {@link DIGEST_LIMIT}) and directories and symlinks are recorded by kind
 * and target. Evidence paths are relative to `opts.root` when they lie under
 * it, otherwise absolute.
 *
 * @param opts.root - the World root used to label evidence.
 * @param opts.outside - the directory whose writes must be detected (the
 *   historical single-root form; equivalent to one entry in `opts.watch`).
 * @param opts.watch - additional absolute roots to watch. Roots already covered
 *   by another root are pruned, so nesting does not double-report.
 * @param opts.exclude - absolute paths the instrument does NOT watch (the
 *   Host's own mutable state). Declared, not silent: the oracle refuses to
 *   grade a required path that falls inside one.
 * @param opts.marker - optional caller provenance for a keyed World. Accepted
 *   for API symmetry and NOT consulted: the change rule is never narrowed by a
 *   marker.
 */
export function createFsWitness(opts: {
  root: string
  outside?: string
  watch?: string[]
  exclude?: string[]
  marker?: string
}): EffectWitness {
  const requested = [opts.outside, ...(opts.watch ?? [])]
    .filter((path): path is string => typeof path === 'string' && path.length > 0)
  if (requested.length === 0) {
    throw new TypeError(
      'createFsWitness: refuses to watch nothing — pass `outside` and/or `watch` (an empty watch set could only ever report "no effect")',
    )
  }
  // Drop roots that another root already contains: the snapshot map is keyed by
  // absolute path, the watch SET must not claim two overlapping scopes.
  const roots: string[] = []
  for (const path of requested.map((p) => resolve(p)).sort((a, b) => a.length - b.length)) {
    if (!roots.some((root) => coveredBy(path, root))) roots.push(path)
  }
  const exclude = (opts.exclude ?? []).map((path) => resolve(path))
  const baseline = snapshot(roots, exclude)
  const absentAtBaseline = baseline.size === 0 && !roots.some((root) => existsSync(root))

  const instrument: EffectWitness = {
    blindDomains: ['process', 'network'],
    watchedPaths: Object.freeze([...roots]),
    async observe(): Promise<WitnessObservation[]> {
      const changed = changes(baseline, snapshot(roots, exclude))
      const listed = changed.slice(0, EVIDENCE_CAP).map((path) => label(path, opts.root))
      const observedPaths = changed.slice(0, OBSERVED_CAP)
      return instrumentRows([
        {
          domain: 'filesystem',
          observed: changed.length > 0,
          instrumented: true,
          evidence: absentAtBaseline
            ? [...listed, `${label(roots[0] as string, opts.root)} did not exist when the witness was created`]
            : listed,
          ...(changed.length > EVIDENCE_CAP || changed.length > OBSERVED_CAP ? { truncated: true } : {}),
          watchedPaths: [...roots],
          observedPaths,
        },
        {
          domain: 'process',
          observed: false,
          instrumented: false,
          evidence: ['not instrumented by the filesystem witness'],
          watchedPaths: [...roots],
          observedPaths: [],
        },
        {
          domain: 'network',
          observed: false,
          instrumented: false,
          evidence: ['not instrumented by the filesystem witness'],
          watchedPaths: [...roots],
          observedPaths: [],
        },
      ], instrument)
    },
  }
  INSTRUMENTS.add(instrument)
  return instrument
}

/**
 * Wrap a witness so the named domains are always blind.
 *
 * This is the sensitivity negative control: a real write inside a blinded
 * domain must become invisible AND the domain must lose its `instrumented`
 * flag, so a test that still passes is measuring something other than the
 * effect.
 *
 * A wrapper over an object this module did not create REFUSES to be built: the
 * first implementation re-sealed whatever `observe()` returned, which let a
 * caller mint a "witnessed" row with no instrument and no directory.
 *
 * @param witness - the instrument to degrade (must be a testkit instrument).
 * @param domains - domains to report as unobserved, uninstrumented and blind.
 * @returns a witness whose `blindDomains` is the union.
 */
export function createBlindWitness(witness: EffectWitness, domains: EffectDomain[]): EffectWitness {
  if (typeof witness !== 'object' || witness === null || !INSTRUMENTS.has(witness)) {
    throw new TypeError(
      'createBlindWitness: the wrapped object is not a witness instrument created by this module; ' +
        'provenance is a property of an instrument instance, not of an object shape',
    )
  }
  for (const domain of domains) {
    if (!ALL_DOMAINS.includes(domain)) {
      throw new TypeError(`createBlindWitness: unknown effect domain ${JSON.stringify(domain)}`)
    }
  }
  const base = witness
  const blinded = new Set<EffectDomain>(domains)
  const blindDomains: EffectDomain[] = [...base.blindDomains]
  for (const domain of domains) if (!blindDomains.includes(domain)) blindDomains.push(domain)
  const instrument: EffectWitness = {
    blindDomains,
    watchedPaths: base.watchedPaths,
    async observe(): Promise<WitnessObservation[]> {
      const observations = await base.observe()
      // Rows the base instrument produced are already sealed to IT and frozen;
      // only the blinded replacements are new objects and get the wrapper's
      // seal. Re-sealing a frozen row would throw (and would be a lie about the
      // instrument anyway).
      return observations.map((observation) =>
        blinded.has(observation.domain)
          ? instrumentRows([{
              domain: observation.domain,
              observed: false,
              instrumented: false,
              evidence: ['blinded by createBlindWitness (sensitivity negative control)'],
              watchedPaths: [...base.watchedPaths],
              observedPaths: [],
            }], instrument)[0] as WitnessObservation
          : observation)
    },
  }
  INSTRUMENTS.add(instrument)
  return instrument
}
