/**
 * `a5p5-tools` Phase 2 — SPILL semantics: the controlled-path life of large
 * tool output inside the World (task slice ①; plan §8 "Spill 可正确归属且被
 * 读取时复核权限"; S0 D-4: the Adapter self-manages spill — the native
 * post-execute identity path of S-09 is deliberately NOT relied on).
 *
 * THE FOUR LAWS (each pinned by `test/a5p5-spill.test.ts`):
 *
 *  1. WORLD-BOUND CONTROLLED PATH. Every byte lands under a `rootDir` that is
 *     a STRICT descendant of the injected `worldRoot` (segment-law, `..`
 *     refused BEFORE any collapse — the same pre-collapse refusal as
 *     `args.ts`). A forged spillId (separators, `..`, absolutes, NUL, blank,
 *     over-length) is a typed refusal with ZERO port calls: refuse before
 *     touch, never "write then filter".
 *  2. LEASE-SHAPED LIFECYCLE (INTERFACES-v1.md C-GW): the closed states are
 *     ACTIVE → DRAINING → CLOSED; the ACTIVE→DRAINING edge is the ONE settled
 *     edge, and from DRAINING on every NEW write is typed-refused (the bytes
 *     already settled stay exactly as they were).
 *  3. RESIDUE NEVER VANISHES SILENTLY. Enumeration reads the DISK, not
 *     memory: residue of a cancelled or torn-down call is listed by a FRESH
 *     store handle with attribution and settlement class intact — and an
 *     ORPHAN file (no meta at all) is still enumerated, as unattributed.
 *     Cleanup is the explicit, listed alternative; after it a read is a
 *     typed `spill-missing` refusal, never silence (C-FS: hidden-read 永不
 *     静默 — the typed error classes here are exactly the C-FS triad
 *     denied/hidden/undetermined).
 *  4. READ RE-CHECKS AUTHORIZATION (S0 D-4). `readSpill` asks the INJECTED
 *     authorizer before any payload I/O; the lane decides nothing itself — it
 *     consumes a verdict, mirroring the C-ADM read-time law with no second
 *     authorization fact.
 *
 * The cancellation/settlement event vocabulary is the C-BIND v1.1 pin — the
 * six PR1r event names VERBATIM (dispatcher-call-cancelled-before-body /
 * terminated-after-body-start / completed-after-abort / outcome-unreadable /
 * cancelled-by-others / executed-unvalidated); normal completion is the one
 * non-cancelled settlement.
 *
 * Purity: no `node:*`, no I/O, no clock — all disk contact goes through the
 * injected `SpillFsPort`; the tests provide the `node:fs` adapter.
 *
 * @module @dsh-agent-team/tools/a5p5-tools/spill
 */

import { deepFreezeContracts } from '../../../domain/tool-governance/src/parse-util.js'

/** C-GW lease-shape states, in transition order. */
export const SPILL_LEASE_STATES = ['active', 'draining', 'closed'] as const
export type SpillLeaseState = (typeof SPILL_LEASE_STATES)[number]

/** The C-BIND v1.1 PR1r cancellation event names — VERBATIM, closed. */
export const SETTLEMENT_EVENTS = [
  'dispatcher-call-cancelled-before-body',
  'terminated-after-body-start',
  'completed-after-abort',
  'outcome-unreadable',
  'cancelled-by-others',
  'executed-unvalidated',
] as const
export type SettlementEvent = (typeof SETTLEMENT_EVENTS)[number]

/** How a settled edge happened: normal completion, or a cancellation class. */
export type LeaseSettlement =
  | { readonly kind: 'completed' }
  | { readonly kind: 'cancelled'; readonly event: SettlementEvent }

/** The C-FS typed-error triad (denied/hidden/undetermined) — closed set. */
export const SPILL_ERROR_CLASSES = ['denied', 'hidden', 'undetermined'] as const
export type SpillErrorClass = (typeof SPILL_ERROR_CLASSES)[number]

/** The closed refusal vocabulary of this module. */
export const SPILL_REFUSAL_CODES = [
  'spill-root-outside-world',
  'spill-id-invalid',
  'spill-write-after-drain',
  'spill-write-after-close',
  'spill-settled-twice',
  'spill-close-without-settle',
  'spill-finalize-before-settle',
  'spill-finalized-twice',
  'spill-read-denied',
  'spill-missing',
] as const
export type SpillRefusalCode = (typeof SPILL_REFUSAL_CODES)[number]

export interface SpillRefusal {
  readonly code: SpillRefusalCode
  readonly class: SpillErrorClass
  readonly detail: string
}

export type OpenStoreResult = { readonly ok: true; readonly store: SpillStore } | { readonly ok: false; readonly refusal: SpillRefusal }
export type OpenSinkResult = { readonly ok: true; readonly sink: SpillSink } | { readonly ok: false; readonly refusal: SpillRefusal }
export type WriteResult = { readonly ok: true; readonly bytes: number } | { readonly ok: false; readonly refusal: SpillRefusal }
export type LeaseMoveResult = { readonly ok: true } | { readonly ok: false; readonly refusal: SpillRefusal }
export type ReadSpillResult =
  | { readonly ok: true; readonly text: string; readonly attribution: SpillAttribution | null }
  | { readonly ok: false; readonly refusal: SpillRefusal }

const refuse = (code: SpillRefusalCode, detail: string, cls: SpillErrorClass = 'denied') => ({
  ok: false,
  refusal: { code, detail, class: cls },
}) as const

/** The file-system port the store is allowed to touch — nothing else. */
export interface SpillFsPort {
  ensureDir(path: string): void
  writeFile(path: string, text: string): void
  appendFile(path: string, text: string): void
  readText(path: string): string
  sizeBytes(path: string): number
  list(dir: string): readonly string[]
  remove(path: string): void
  exists(path: string): boolean
}

/** Who a spill belongs to (S0 D-4 归属): the call, not the model's words. */
export interface SpillAttribution {
  readonly realmId: string
  readonly tool: string
  readonly callId: string
}

export interface SpillSink {
  readonly spillId: string
  /** Characters accepted so far (the bytes law is the port's at read-back). */
  bytes(): number
  write(chunk: string): WriteResult
  /** Record the settled-edge fact on the residue meta; requires a settled lease. */
  finalize(settlement: LeaseSettlement): LeaseMoveResult
}

export interface SpillLease {
  state(): SpillLeaseState
  settle(settlement: LeaseSettlement): LeaseMoveResult
  close(): LeaseMoveResult
}

export interface SpillResidueEntry {
  readonly spillId: string
  readonly bytes: number
  readonly attribution: SpillAttribution | null
  readonly settlement: LeaseSettlement | null
}

export type ReadAuthorizer = (attribution: SpillAttribution | null) => { allow: true } | { allow: false; detail: string }

const SPILL_SUFFIX = '.spill'
const META_SUFFIX = '.spill.meta'
const MAX_SPILL_ID_LENGTH = 128
const SPILL_ID_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

function validSpillId(spillId: string): SpillRefusal | null {
  if (typeof spillId !== 'string' || spillId.length === 0) return { code: 'spill-id-invalid', class: 'denied', detail: 'a spill id must be a non-empty string' }
  if (spillId.length > MAX_SPILL_ID_LENGTH) return { code: 'spill-id-invalid', class: 'denied', detail: `a spill id is bounded at ${MAX_SPILL_ID_LENGTH} characters` }
  if (spillId.includes('..')) return { code: 'spill-id-invalid', class: 'denied', detail: 'a spill id may not carry a .. walk' }
  if (!SPILL_ID_SHAPE.test(spillId)) return { code: 'spill-id-invalid', class: 'denied', detail: 'a spill id is [A-Za-z0-9][A-Za-z0-9._-]* — no separators, no absolutes, no control or blank bytes' }
  return null
}

/** Segment law, refused BEFORE collapse: absolute, no `.`, no `..`. */
function pathSegments(raw: string): string[] | null {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return null
  const parts = raw.split('/')
  const out: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') return null
    out.push(part)
  }
  return out
}

function joinUnder(root: string, name: string): string {
  return `${root.endsWith('/') ? root.slice(0, -1) : root}/${name}`
}

export function createSpillLease(): SpillLease {
  let state: SpillLeaseState = 'active'
  let settled: LeaseSettlement | null = null
  return deepFreezeContracts({
    state: () => state,
    settlement: () => settled,
    settle(next: LeaseSettlement) {
      if (state !== 'active') return refuse('spill-settled-twice', `the lease is already ${state}; the settled edge is single (C-GW)`)
      if (next.kind === 'cancelled' && !SETTLEMENT_EVENTS.includes(next.event)) return refuse('spill-settled-twice', 'the cancellation event must be one of the six PR1r names verbatim')
      state = 'draining'
      settled = next
      return { ok: true }
    },
    close() {
      if (state === 'active') return refuse('spill-close-without-settle', 'close is legal only across the settled edge (ACTIVE→DRAINING→CLOSED)')
      state = 'closed'
      return { ok: true }
    },
  })
}

interface MetaRecord {
  readonly attribution: SpillAttribution | null
  readonly settlement: LeaseSettlement | null
}

export interface SpillStore {
  openSink(args: { spillId: string; lease: SpillLease; attribution: SpillAttribution }): OpenSinkResult
  listResidue(): readonly SpillResidueEntry[]
  cleanupResidue(): { readonly removed: readonly string[] }
  readSpill(spillId: string, authorize: ReadAuthorizer): ReadSpillResult
}

export function openSpillStore(deps: { worldRoot: string; rootDir: string; fs: SpillFsPort }): OpenStoreResult {
  const world = pathSegments(deps.worldRoot)
  const root = pathSegments(deps.rootDir)
  if (world === null || root === null) {
    return refuse('spill-root-outside-world', 'worldRoot and rootDir must be absolute POSIX-style paths with no . or .. segments (refused before collapse)')
  }
  const strictDescendant = root.length > world.length && world.every((segment, i) => root[i] === segment)
  if (!strictDescendant) {
    return refuse('spill-root-outside-world', 'the spill root must be a STRICT descendant of the world root — the controlled path lives inside the World')
  }
  const rootDir = root.join('/')
  const rootFull = `/${root.join('/')}`
  const registry = new Map<string, SpillAttribution>()

  const spillPath = (spillId: string): string => joinUnder(rootFull, `${spillId}${SPILL_SUFFIX}`)
  const metaPath = (spillId: string): string => joinUnder(rootFull, `${spillId}${META_SUFFIX}`)

  function readMeta(spillId: string): MetaRecord | null {
    if (!deps.fs.exists(metaPath(spillId))) return null
    try {
      const raw = JSON.parse(deps.fs.readText(metaPath(spillId))) as MetaRecord
      return { attribution: raw.attribution ?? null, settlement: raw.settlement ?? null }
    } catch {
      return { attribution: null, settlement: null } // a corrupt meta is UNATTRIBUTED, never an excuse to skip the residue
    }
  }

  const store: SpillStore = {
    openSink({ spillId, lease, attribution }) {
      const bad = validSpillId(spillId)
      if (bad) return { ok: false, refusal: bad } // ZERO port calls: refuse before touch
      deps.fs.ensureDir(rootFull)
      deps.fs.writeFile(metaPath(spillId), JSON.stringify({ attribution, settlement: null } satisfies MetaRecord))
      registry.set(spillId, attribution)
      let bytes = 0
      let finalized = false
      return {
        ok: true,
        sink: deepFreezeContracts({
          spillId,
          bytes: () => bytes,
          write(chunk: string) {
            const state = lease.state()
            if (state === 'draining') return refuse('spill-write-after-drain', `spill ${spillId}: new writes are refused from the settled edge on (DRAINING)`)
            if (state === 'closed') return refuse('spill-write-after-close', `spill ${spillId}: the lease is closed`)
            deps.fs.appendFile(spillPath(spillId), chunk)
            bytes += chunk.length
            return { ok: true, bytes }
          },
          finalize(settlement: LeaseSettlement) {
            if (lease.state() === 'active') return refuse('spill-finalize-before-settle', 'the terminal fact of a residue is recorded only across the settled edge')
            if (finalized) return refuse('spill-finalized-twice', `spill ${spillId} is already finalized`)
            finalized = true
            deps.fs.writeFile(metaPath(spillId), JSON.stringify({ attribution, settlement } satisfies MetaRecord))
            return { ok: true }
          },
        }),
      }
    },

    listResidue() {
      const names = deps.fs.list(rootFull)
      const ids = new Set<string>()
      for (const name of names) {
        if (name.endsWith(META_SUFFIX)) ids.add(name.slice(0, -META_SUFFIX.length))
        else if (name.endsWith(SPILL_SUFFIX)) ids.add(name.slice(0, -SPILL_SUFFIX.length))
      }
      const entries: SpillResidueEntry[] = []
      for (const spillId of [...ids].sort()) {
        const meta = readMeta(spillId)
        const hasFile = deps.fs.exists(spillPath(spillId))
        entries.push(
          deepFreezeContracts({
            spillId,
            bytes: hasFile ? deps.fs.sizeBytes(spillPath(spillId)) : 0,
            attribution: meta?.attribution ?? registry.get(spillId) ?? null,
            settlement: meta?.settlement ?? null,
          }),
        )
      }
      return deepFreezeContracts(entries)
    },

    cleanupResidue() {
      const names = [...deps.fs.list(rootFull)].sort()
      const removed: string[] = []
      for (const name of names) {
        deps.fs.remove(joinUnder(rootFull, name))
        removed.push(name)
      }
      registry.clear()
      return { removed }
    },

    readSpill(spillId, authorize) {
      const bad = validSpillId(spillId)
      if (bad) return { ok: false, refusal: bad }
      // Read-time re-check BEFORE any payload I/O (S0 D-4): the lane consumes
      // a verdict it did not mint; a deny counts zero payload reads.
      const verdict = authorize(registry.get(spillId) ?? null)
      if (!verdict.allow) return refuse('spill-read-denied', `authorization at read time refused spill ${spillId}: ${verdict.detail}`)
      if (!deps.fs.exists(spillPath(spillId))) return refuse('spill-missing', `spill ${spillId} has no payload file (cleaned up, or never written)`, 'undetermined')
      return deepFreezeContracts({ ok: true, text: deps.fs.readText(spillPath(spillId)), attribution: registry.get(spillId) ?? readMeta(spillId)?.attribution ?? null })
    },
  }
  return { ok: true, store }
}
