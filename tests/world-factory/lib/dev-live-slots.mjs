/**
 * dev-live-slots.mjs — the machine-wide "at most 2 dev Hosts" counter
 * (owner ruling 2026-11-09).
 *
 * THIS IS NOT A NEW SUBSYSTEM. It is the smallest counter that can answer one
 * question — "how many dev-live Hosts are live on this machine right now?" —
 * and it reuses the two mechanisms WorldFactory already owns:
 *
 *   1. the SHARED lease root (`TestWorldFactory#leaseRoot`, the main checkout's
 *      `.artifacts/tmp/port-leases`, so sibling worktrees contend on the same
 *      files) with a sibling directory `dev-live-hosts/`; and
 *   2. `port-lease.mjs#pidAlive` — the same signal-0 liveness probe the port
 *      leases use, so a crashed runner is reclaimed exactly like a stale port
 *      lease (dead pid ⇒ stale; unparsable file younger than one minute is
 *      treated as a creator mid-write, older is residue).
 *
 * The owner's ruling caps DEVELOPMENT boots at 2 concurrent per machine, to be
 * adjusted after measuring resources. `DEV_LIVE_SLOT_LIMIT` is that number in
 * ONE place. Candidate (C2) acceptance is NOT counted here: a frozen-candidate
 * run goes through the unchanged C2 grant path and its own scheduling.
 *
 * Slot file shape (`<leaseRoot>/dev-live-hosts/<n>.json`):
 *   { slot, token, pid, startedAt, runId, face, world, headCommit }
 *
 * A slot is STALE when the recorded pid is not alive, or when the file is
 * unparsable and older than `UNPARSABLE_STALE_MS`, or when its age exceeds
 * `DEV_LIVE_SLOT_TTL_MS` (the timeout safety valve for a pid that cannot be
 * probed, e.g. a recycled pid on another host session). The TTL is generous
 * (4 h) because a legitimately long boot must not be evicted; crash recovery
 * is normally immediate through `pidAlive`.
 *
 * CORE PATCH BUDGET = 0. No upstream tree is touched.
 *
 * @module tests/world-factory/lib/dev-live-slots
 */
import { mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { pidAlive } from './port-lease.mjs'

/** The owner's 2026-11-09 cap: at most 2 concurrent dev Hosts per machine. */
export const DEV_LIVE_SLOT_LIMIT = 2

/** Safety valve only; liveness is normally decided by `pidAlive`. */
export const DEV_LIVE_SLOT_TTL_MS = 4 * 60 * 60 * 1000

/** An unparsable slot file is residue once it is older than this (same order
 *  as `port-lease.mjs#UNPARSABLE_CLAIM_STALE_MS`; small files land instantly). */
export const UNPARSABLE_STALE_MS = 60_000

export const DEV_LIVE_SLOT_CODES = Object.freeze([
  /** the machine already runs `limit` live dev Hosts */
  'DEV_LIVE_LIMIT_REACHED',
  /** a dev-live boot did not acquire a slot first (the gate was bypassed) */
  'DEV_LIVE_SLOT_REQUIRED',
  /** a slot path could not be created/read for a non-staleness reason */
  'DEV_LIVE_SLOT_UNAVAILABLE',
])

export class DevLiveSlotError extends Error {
  /**
   * @param {string} code one of {@link DEV_LIVE_SLOT_CODES}
   * @param {string} detail human-readable, never string-matched by callers
   * @param {object} [extra]
   */
  constructor(code, detail, extra = {}) {
    super(`${code}: ${detail}`)
    this.name = 'DevLiveSlotError'
    this.code = code
    this.detail = detail
    Object.assign(this, extra)
  }
}

/** The shared counter directory under the SAME lease root the ports use. */
export function devLiveSlotRoot(leaseRoot) {
  return join(leaseRoot, 'dev-live-hosts')
}

const SLOT_FILE = /^(\d+)\.json$/

function readSlot(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function ageOf(path, now) {
  try {
    return Math.max(0, now - statSync(path).mtimeMs)
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

/**
 * Read (and classify) every slot file. Pure observation: never deletes.
 *
 * @param {object} input
 * @param {string} input.leaseRoot shared lease root
 * @param {number} [input.now] injectable clock (tests)
 * @param {number} [input.ttlMs]
 * @returns {{root: string, entries: object[], live: object[], stale: object[], limit: number, atLimit: boolean}}
 */
export function scanDevLiveSlots({ leaseRoot, now = Date.now(), ttlMs = DEV_LIVE_SLOT_TTL_MS, limit = DEV_LIVE_SLOT_LIMIT } = {}) {
  const root = devLiveSlotRoot(leaseRoot)
  let names = []
  try {
    names = readdirSync(root)
  } catch {
    /* no counter yet = zero live dev Hosts */
  }
  const entries = []
  for (const name of names) {
    const match = SLOT_FILE.exec(name)
    if (match === null) continue
    const path = join(root, name)
    const raw = readSlot(path)
    const ageMs = ageOf(path, now)
    const pid = Number.isInteger(raw?.pid) ? raw.pid : null
    const alive = pid !== null ? pidAlive(pid) : false
    const unparsable = raw === null
    const stale = unparsable
      ? ageMs > UNPARSABLE_STALE_MS
      : !alive || ageMs > ttlMs
    entries.push(Object.freeze({
      slot: Number(match[1]),
      path,
      raw,
      pid,
      runId: typeof raw?.runId === 'string' ? raw.runId : null,
      face: typeof raw?.face === 'string' ? raw.face : null,
      world: typeof raw?.world === 'string' ? raw.world : null,
      headCommit: typeof raw?.headCommit === 'string' ? raw.headCommit : null,
      startedAt: typeof raw?.startedAt === 'string' ? raw.startedAt : null,
      token: typeof raw?.token === 'string' ? raw.token : null,
      ageMs,
      alive,
      unparsable,
      stale,
    }))
  }
  entries.sort((a, b) => a.slot - b.slot)
  const live = entries.filter((e) => !e.stale)
  const stale = entries.filter((e) => e.stale)
  return Object.freeze({
    root,
    entries,
    live,
    stale,
    limit,
    atLimit: live.length >= limit,
  })
}

/** Remove ONE stale slot file. Only a still-stale file is deleted (re-read). */
function sweepStale(entry) {
  try {
    unlinkSync(entry.path)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

/**
 * Acquire ONE of the `limit` dev-Host slots. Scans and sweeps stale entries
 * first, then takes the lowest free slot with `wx` (O_EXCL) so two racing
 * runners cannot both claim the same slot.
 *
 * @param {object} input
 * @param {string} input.leaseRoot shared lease root (the factory's)
 * @param {string} input.runId       the run record id (evidence binding)
 * @param {string} input.face        capability face this dev-live scope covers
 * @param {string} input.world       isolated test World line
 * @param {string} [input.headCommit] the version being developed (recorded)
 * @param {number} [input.pid]       owner pid (defaults to this process)
 * @param {number} [input.ttlMs]
 * @param {number} [input.limit]
 * @returns {Readonly<{slot:number, path:string, token:string, release:()=>boolean}>}
 */
export function acquireDevLiveSlot({
  leaseRoot,
  runId,
  face,
  world,
  headCommit = null,
  pid = process.pid,
  ttlMs = DEV_LIVE_SLOT_TTL_MS,
  limit = DEV_LIVE_SLOT_LIMIT,
  now = Date.now(),
} = {}) {
  if (typeof leaseRoot !== 'string' || leaseRoot.trim() === '') {
    throw new DevLiveSlotError('DEV_LIVE_SLOT_UNAVAILABLE', 'acquireDevLiveSlot needs the shared lease root (TestWorldFactory#leaseRoot)')
  }
  if (typeof runId !== 'string' || runId.trim() === '') {
    throw new DevLiveSlotError('DEV_LIVE_SLOT_UNAVAILABLE', 'a dev-live slot must be bound to the run id it hosts')
  }
  const scan = scanDevLiveSlots({ leaseRoot, now, ttlMs, limit })
  for (const entry of scan.stale) sweepStale(entry)
  const fresh = scanDevLiveSlots({ leaseRoot, now, ttlMs, limit })
  if (fresh.atLimit) {
    throw new DevLiveSlotError(
      'DEV_LIVE_LIMIT_REACHED',
      `the machine already runs ${String(fresh.live.length)} dev Host(s), the owner ruling caps development boots at ${String(limit)}; finish or tear down one before starting another (slots: ${fresh.live.map((e) => `#${String(e.slot)} pid=${String(e.pid)} run=${String(e.runId)} world=${String(e.world)}`).join('; ')})`,
      { live: fresh.live, limit },
    )
  }
  mkdirSync(fresh.root, { recursive: true })
  const token = randomBytes(8).toString('hex')
  const startedAt = new Date(now).toISOString()
  for (let slot = 0; slot < limit; slot += 1) {
    const path = join(fresh.root, `${slot}.json`)
    const payload = { slot, token, pid, startedAt, runId, face, world, headCommit }
    try {
      writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, { flag: 'wx' })
    } catch (error) {
      if (error.code === 'EEXIST') continue // taken by a live peer (or a race)
      throw new DevLiveSlotError('DEV_LIVE_SLOT_UNAVAILABLE', `cannot create dev-live slot ${path}: ${String(error?.message ?? error)}`, { path })
    }
    return Object.freeze({
      slot,
      path,
      token,
      runId,
      face,
      world,
      headCommit,
      /** Release ONLY the file that still names this token (never a peer's). */
      release: () => releaseDevLiveSlot({ path, token }),
    })
  }
  throw new DevLiveSlotError(
    'DEV_LIVE_LIMIT_REACHED',
    `every one of the ${String(limit)} dev-live slot file(s) was taken by a racing peer; no slot could be claimed`,
    { live: fresh.live, limit },
  )
}

/** Release a slot iff its on-disk token is still ours. */
export function releaseDevLiveSlot({ path, token } = {}) {
  const raw = readSlot(path)
  if (raw === null || raw.token !== token) return false
  try {
    unlinkSync(path)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

/**
 * Fail-closed check used by the boot chokepoint (`a5sf-harness.mjs#boot`): a
 * `DEV-LIVE` record may only spawn while a live slot for THAT run id exists.
 * This is what makes "forgot to acquire a slot" a refusal instead of a third
 * concurrent Host.
 *
 * @param {object} input
 * @param {string} input.leaseRoot
 * @param {string} input.runId
 * @param {number} [input.pid]
 */
export function assertDevLiveSlotHeld({ leaseRoot, runId, pid = process.pid } = {}) {
  const scan = scanDevLiveSlots({ leaseRoot })
  const held = scan.live.find((e) => e.runId === runId && e.pid === pid)
  if (held === undefined) {
    throw new DevLiveSlotError(
      'DEV_LIVE_SLOT_REQUIRED',
      `record '${String(runId)}' is DEV-LIVE but holds no dev-Host slot under ${scan.root}; a dev-live Host may only start through the scope-aware grant gate (preRegisterDevLiveBudget), which acquires one of the ${String(DEV_LIVE_SLOT_LIMIT)} machine slots`,
      { root: scan.root, live: scan.live },
    )
  }
  return held
}
