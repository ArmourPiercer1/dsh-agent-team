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
 * `instrumented` is the CAPABILITY declaration: it is set by the witness
 * implementation, never by the caller, and the oracle requires it to be `true`
 * before a row may corroborate anything. A caller can fabricate a row; it
 * cannot fabricate an instrument.
 *
 * SENSITIVITY RULE: {@link createBlindWitness} is a deliberately broken
 * instrument for negative controls. It hides changes in the named domains and
 * withdraws their `instrumented` flag, so a test that still believes the
 * instrument is honest goes red.
 *
 * KNOWN LIMITS (stated, not hidden): the witness compares two point-in-time
 * snapshots, so (a) a file created and deleted between them is invisible,
 * (b) a write performed through a symlink to a target outside the watched
 * directory shows up only as the symlink itself changing, and (c) a file above
 * {@link DIGEST_LIMIT} is compared by size+mtime only. Those are limits of the
 * channel; the oracle reports them and no verdict may read them as clean.
 *
 * M2 SCOPE: only the filesystem channel is implemented. No process, PTY, HTTP
 * proxy, or network-outlet witness exists yet; those need E2 (real confined
 * subprocess / OS fidelity).
 *
 * @module @dsh-agent-team/testkit/effect-witness
 */
import { createHash } from 'node:crypto'
import { lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

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
}

/** A read-only, independent observation channel. */
export interface EffectWitness {
  observe(): Promise<WitnessObservation[]>
  /** Domains this instrument cannot see; a verdict must not assume them clean. */
  readonly blindDomains: EffectDomain[]
}

/** All three domains, in the fixed reporting order. */
const ALL_DOMAINS: readonly EffectDomain[] = ['filesystem', 'process', 'network']

/** Changed paths beyond this count are dropped from `evidence` and flagged. */
const EVIDENCE_CAP = 20

/** Files at or below this size are compared by content digest as well. */
export const DIGEST_LIMIT = 4 * 1024 * 1024

/** One entry's identity for change detection, including its kind. */
type EntryIdentity = string

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
 * Snapshot every entry under `dir` (files, directories, symlinks), keyed by
 * absolute path. A missing directory is an empty snapshot; any other read
 * failure propagates, because an unreadable instrument must not read as
 * "no change".
 */
function snapshot(dir: string): Map<string, EntryIdentity> {
  const entries = new Map<string, EntryIdentity>()
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
  walk(dir)
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
 * Filesystem witness over `opts.outside`.
 *
 * The verdict is: an entry under `outside` was CREATED, MODIFIED or DELETED,
 * where a file's identity is `size:mtimeMs:sha256` (digest up to
 * {@link DIGEST_LIMIT}) and directories and symlinks are recorded by kind and
 * target. Evidence paths are relative to `opts.root` when they lie under it,
 * otherwise absolute.
 *
 * @param opts.root - the World root used to label evidence.
 * @param opts.outside - the directory whose writes must be detected.
 * @param opts.marker - optional caller provenance for a keyed World. M2 accepts
 *   it for API symmetry and does NOT consult it: the change rule above is never
 *   narrowed by a marker.
 */
export function createFsWitness(opts: { root: string; outside: string; marker?: string }): EffectWitness {
  const baseline = snapshot(opts.outside)
  return {
    blindDomains: ['process', 'network'],
    async observe(): Promise<WitnessObservation[]> {
      const changed = changes(baseline, snapshot(opts.outside))
      const listed = changed.slice(0, EVIDENCE_CAP).map((path) => label(path, opts.root))
      return [
        {
          domain: 'filesystem',
          observed: changed.length > 0,
          instrumented: true,
          evidence: listed,
          ...(changed.length > EVIDENCE_CAP ? { truncated: true } : {}),
        },
        {
          domain: 'process',
          observed: false,
          instrumented: false,
          evidence: ['not instrumented by the filesystem witness'],
        },
        {
          domain: 'network',
          observed: false,
          instrumented: false,
          evidence: ['not instrumented by the filesystem witness'],
        },
      ]
    },
  }
}

/**
 * Wrap a witness so the named domains are always blind.
 *
 * This is the sensitivity negative control: a real write inside a blinded
 * domain must become invisible AND the domain must lose its `instrumented`
 * flag, so a test that still passes is measuring something other than the
 * effect.
 *
 * @param witness - the instrument to degrade.
 * @param domains - domains to report as unobserved, uninstrumented and blind.
 * @returns a witness whose `blindDomains` is the union.
 */
export function createBlindWitness(witness: EffectWitness, domains: EffectDomain[]): EffectWitness {
  for (const domain of domains) {
    if (!ALL_DOMAINS.includes(domain)) {
      throw new TypeError(`createBlindWitness: unknown effect domain ${JSON.stringify(domain)}`)
    }
  }
  const blinded = new Set<EffectDomain>(domains)
  const blindDomains: EffectDomain[] = [...witness.blindDomains]
  for (const domain of domains) if (!blindDomains.includes(domain)) blindDomains.push(domain)
  return {
    blindDomains,
    async observe(): Promise<WitnessObservation[]> {
      const observations = await witness.observe()
      return observations.map((observation) =>
        blinded.has(observation.domain)
          ? {
              domain: observation.domain,
              observed: false,
              instrumented: false,
              evidence: ['blinded by createBlindWitness (sensitivity negative control)'],
            }
          : observation,
      )
    },
  }
}
