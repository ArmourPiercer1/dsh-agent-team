/**
 * Independent effect witnesses — observation channels that do not trust the
 * tool's own return value or the host's log lines.
 *
 * HONESTY RULE (the reason this module is narrow): a filesystem witness says
 * NOTHING about process or network effects. Those domains are reported with
 * `observed: false` AND listed in `blindDomains`, so the contract oracle can
 * refuse to grade a contract it cannot see instead of reading "no filesystem
 * write" as "no effect anywhere".
 *
 * SENSITIVITY RULE: {@link createBlindWitness} is a deliberately broken
 * instrument for negative controls. It hides changes in the named domains, so
 * a test that still thinks the instrument is honest goes red.
 *
 * M2 SCOPE: only the filesystem channel is implemented. No process, PTY, HTTP
 * proxy, or network-outlet witness exists yet; those need E2 (real confined
 * subprocess / OS fidelity).
 *
 * @module @dsh-agent-team/testkit/effect-witness
 */
import { readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/** The effect domains a contract can be graded over. */
export type EffectDomain = 'filesystem' | 'process' | 'network'

/** One raw observation of one effect domain. */
export interface WitnessObservation {
  domain: EffectDomain
  observed: boolean
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

/** One file's identity for change detection: size plus modification time. */
type FileIdentity = string

function identityOf(path: string): FileIdentity {
  const stats = statSync(path)
  return `${stats.size}:${stats.mtimeMs}`
}

/**
 * Snapshot every regular file under `dir`, keyed by absolute path.
 * Missing directories and children are an empty snapshot; any other read
 * failure propagates, because an unreadable instrument must not silently read
 * as "no change".
 */
function snapshot(dir: string): Map<string, FileIdentity> {
  const files = new Map<string, FileIdentity>()
  const walk = (current: string): void => {
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch (error) {
      if (errnoCode(error) === 'ENOENT') return
      throw error
    }
    for (const entry of entries) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (!entry.isFile()) continue
      try {
        files.set(path, identityOf(path))
      } catch (error) {
        if (errnoCode(error) === 'ENOENT') continue
        throw error
      }
    }
  }
  walk(dir)
  return files
}

function changedPaths(baseline: Map<string, FileIdentity>, current: Map<string, FileIdentity>): string[] {
  const changed: string[] = []
  for (const [path, identity] of current) {
    if (baseline.get(path) !== identity) changed.push(path)
  }
  return changed.sort()
}

function label(path: string, root: string): string {
  const rel = relative(root, path)
  return rel === '' || rel.startsWith(`..${sep}`) || rel === '..' ? path : rel
}

/**
 * Filesystem witness over `opts.outside`.
 *
 * The verdict is strictly: a NEW or MODIFIED regular file exists anywhere
 * under `outside`. Deletions are not counted. Evidence paths are relative to
 * `opts.root` when they lie under it, otherwise absolute.
 *
 * @param opts.root - the World root used to label evidence.
 * @param opts.outside - the directory whose writes must be detected.
 * @param opts.marker - optional caller provenance for a keyed World. M2 accepts
 *   it for API symmetry and does NOT consult it: the "any new/modified file"
 *   rule above is never narrowed by a marker.
 */
/** Read `code` off an unknown thrown value without leaning on the NodeJS namespace. */
function errnoCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined
}

export function createFsWitness(opts: { root: string; outside: string; marker?: string }): EffectWitness {
  const baseline = snapshot(opts.outside)
  return {
    blindDomains: ['process', 'network'],
    async observe(): Promise<WitnessObservation[]> {
      const changed = changedPaths(baseline, snapshot(opts.outside))
      const listed = changed.slice(0, EVIDENCE_CAP).map((path) => label(path, opts.root))
      return [
        {
          domain: 'filesystem',
          observed: changed.length > 0,
          evidence: listed,
          ...(changed.length > EVIDENCE_CAP ? { truncated: true } : {}),
        },
        {
          domain: 'process',
          observed: false,
          evidence: ['not instrumented by the filesystem witness'],
        },
        {
          domain: 'network',
          observed: false,
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
 * domain must become invisible, so any test that still passes is measuring
 * something other than the effect.
 *
 * @param witness - the instrument to degrade.
 * @param domains - domains to report as unobserved and blind.
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
              evidence: [`domain deliberately blinded by the negative-control wrapper`],
            }
          : observation,
      )
    },
  }
}
