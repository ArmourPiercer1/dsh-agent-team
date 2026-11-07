/**
 * dev-live-slots.mjs — the machine-wide dev-Host concurrency counter.
 *
 * Limit history: 2 (owner ruling 2026-11-09, chosen while product behaviour was
 * still moving). RAISED to 6 by owner ruling 2026-11-13 ("我批准解除之前的总并发数
 * 限制"), after measuring this development machine: 30 GiB RAM with ~25 GiB
 * available and 16 vCPUs, against a measured peak well under 1 GiB per dev Host
 * (Host + its confined children). 6 keeps ~5x headroom on memory and leaves
 * cores for the agent processes themselves; the per-subagent cap of 2 stays in
 * force independently.
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
 *   { slot, token, pid, pidNs, startedAt, runId, face, world, headCommit }
 *
 * LIVENESS IS NAMESPACE-LOCAL, AND THAT IS THE HARD PART. `pid` is recorded in
 * the ACQUIRER's PID namespace. A prober in a different namespace cannot turn
 * that number into a verdict: the same number may name an unrelated process
 * (false alive ⇒ a ghost slot keeps occupying capacity) or nothing at all
 * (false dead ⇒ a peer deletes a LIVE slot). Both were observed on this
 * machine — the recon lanes' slots all recorded `pid: 3` while they were
 * different live processes in different namespaces. A slot therefore also
 * records `pidNs` (`/proc/self/ns/pid`), and the prober classifies:
 *
 *   - `dead`    same namespace, `pidAlive(pid)` false ⇒ stale once the file is
 *               older than `DEAD_SLOT_GRACE_MS` (a just-written slot is never
 *               swept out from under its own writer);
 *   - `alive`   same namespace, pid alive ⇒ live;
 *   - `unknown` another namespace (or a legacy file with no `pidNs`) ⇒ this
 *               prober CANNOT decide. Such a slot is left alone until it is
 *               older than `CROSS_NAMESPACE_GRACE_MS`, and it is deleted only
 *               after a token re-read proves the file was not re-created by a
 *               peer in the meantime.
 *
 * A live cross-namespace owner refreshes its slot's mtime by heartbeat
 * (`slot.touch()`, started by the dev-live lease while the boot is spending its
 * slot), so a running boot never ages past the grace window while a crashed
 * one does. `DEV_LIVE_SLOT_TTL_MS` stays as the last-resort valve.
 *
 * A slot is STALE when `liveness === 'dead'` AND the file is older than
 * `DEAD_SLOT_GRACE_MS`, when the file is unparsable and older than
 * `UNPARSABLE_STALE_MS`, when the liveness is undecidable and the file is older
 * than `CROSS_NAMESPACE_GRACE_MS`, or when its age exceeds the TTL. Deletion
 * ALWAYS re-reads the token first: a slot whose on-disk token changed between
 * scan and unlink belongs to a peer now and is never unlinked.
 *
 * THE TWO GRACES ARE DIFFERENT QUESTIONS, and both are needed: the
 * cross-namespace grace is long (5 min) because this prober cannot judge the
 * owner at all — it must not delete on a guess; the dead-slot grace is short
 * (5 s) because the judgement IS available (same namespace, pid gone) and the
 * only thing worth waiting for is a writer that has not been scheduled since it
 * created the file.
 *
 * CORE PATCH BUDGET = 0. No upstream tree is touched.
 *
 * @module tests/world-factory/lib/dev-live-slots
 */
import {
  mkdirSync, readdirSync, readFileSync, readlinkSync, statSync, unlinkSync, utimesSync, writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { pidAlive } from './port-lease.mjs'

/** The owner's 2026-11-09 cap: at most 2 concurrent dev Hosts per machine. */
export const DEV_LIVE_SLOT_LIMIT = 6

/** Safety valve only; liveness is normally decided by `pidAlive`. */
export const DEV_LIVE_SLOT_TTL_MS = 4 * 60 * 60 * 1000

/** An unparsable slot file is residue once it is older than this (same order
 *  as `port-lease.mjs#UNPARSABLE_CLAIM_STALE_MS`; small files land instantly). */
export const UNPARSABLE_STALE_MS = 60_000

/** How long an UNJUDGEABLE slot is left alone. A same-namespace dead pid is
 *  reclaimed immediately; a cross-namespace (or legacy) slot is only guessed
 *  dead after this grace, because this process cannot see the owner's PID
 *  namespace. `slot.touch()` keeps a live owner well under it. */
export const CROSS_NAMESPACE_GRACE_MS = 5 * 60 * 1000

/** How often the dev-live lease refreshes a held slot's mtime. Must be well
 *  below {@link CROSS_NAMESPACE_GRACE_MS}. */
export const DEV_LIVE_SLOT_HEARTBEAT_MS = 30_000

/** How long a slot is left alone after its owner was PROVABLY dead (same PID
 *  namespace, `pidAlive` false). Short, because the judgement is authoritative;
 *  it exists only so a writer that has just created the file cannot lose it
 *  before its next instruction. Deliberately orthogonal to
 *  {@link CROSS_NAMESPACE_GRACE_MS}: that grace covers "I cannot judge", this
 *  one covers "I judged, and the loser may still be mid-acquire". */
export const DEAD_SLOT_GRACE_MS = 5_000

export const DEV_LIVE_SLOT_CODES = Object.freeze([
  /** the machine already runs `limit` live dev Hosts */
  'DEV_LIVE_LIMIT_REACHED',
  /** a dev-live boot did not acquire a slot first (the gate was bypassed) */
  'DEV_LIVE_SLOT_REQUIRED',
  /** a slot path could not be created/read for a non-staleness reason */
  'DEV_LIVE_SLOT_UNAVAILABLE',
  /** a lease object does not expose the release API (a silent-leak hazard) */
  'DEV_LIVE_SLOT_API_MISSING',
  /** a release call returned while the lease still reports a held slot */
  'DEV_LIVE_SLOT_LEAKED',
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

/** This process's PID namespace identity (`pid:[…]`), or null when /proc is
 *  unavailable. Recorded on acquire so a peer can tell "I cannot judge this
 *  pid" from "this pid is dead". */
export function currentPidNamespace() {
  try {
    return readlinkSync('/proc/self/ns/pid')
  } catch {
    return null
  }
}

/**
 * The ONE liveness/staleness rule, shared by the scanner and the sweeper.
 * `unknown` is a verdict in its own right: a pid number from another namespace
 * is not evidence of death, so it may only be swept after a grace window.
 */
function classifySlotEntry({ raw, ageMs, currentNs, ttlMs }) {
  if (raw === null) {
    return { liveness: 'unparsable', alive: false, stale: ageMs > UNPARSABLE_STALE_MS }
  }
  const pid = Number.isInteger(raw.pid) ? raw.pid : null
  const pidNs = typeof raw.pidNs === 'string' && raw.pidNs !== '' ? raw.pidNs : null
  let liveness
  if (pid === null) {
    liveness = 'unknown'
  } else if (pidNs !== null && currentNs !== null) {
    liveness = pidNs === currentNs ? (pidAlive(pid) ? 'alive' : 'dead') : 'unknown'
  } else {
    // No namespace evidence (legacy file, or /proc unavailable): a bare number
    // cannot distinguish a dead same-namespace owner from a live peer whose
    // namespace reuses that number. Never resolve that ambiguity as "dead".
    liveness = 'unknown'
  }
  const stale = liveness === 'dead'
    ? ageMs > DEAD_SLOT_GRACE_MS
    : ageMs > ttlMs
      ? true
      : liveness === 'unknown'
        ? ageMs > CROSS_NAMESPACE_GRACE_MS
        : false
  return { liveness, alive: liveness === 'alive', stale }
}

/**
 * Read (and classify) every slot file. Pure observation: never deletes.
 *
 * @param {object} input
 * @param {string} input.leaseRoot shared lease root
 * @param {number} [input.now] injectable clock (tests)
 * @param {number} [input.ttlMs]
 * @param {string|null} [input.pidNamespace] this prober's PID namespace
 *   (defaults to `/proc/self/ns/pid`; injectable so tests are deterministic)
 * @returns {{root: string, entries: object[], live: object[], stale: object[], limit: number, atLimit: boolean}}
 */
export function scanDevLiveSlots({
  leaseRoot,
  now = Date.now(),
  ttlMs = DEV_LIVE_SLOT_TTL_MS,
  limit = DEV_LIVE_SLOT_LIMIT,
  pidNamespace = currentPidNamespace(),
} = {}) {
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
    const { liveness, alive, stale } = classifySlotEntry({ raw, ageMs, currentNs: pidNamespace, ttlMs })
    entries.push(Object.freeze({
      slot: Number(match[1]),
      path,
      raw,
      pid: Number.isInteger(raw?.pid) ? raw.pid : null,
      pidNs: typeof raw?.pidNs === 'string' ? raw.pidNs : null,
      runId: typeof raw?.runId === 'string' ? raw.runId : null,
      face: typeof raw?.face === 'string' ? raw.face : null,
      world: typeof raw?.world === 'string' ? raw.world : null,
      headCommit: typeof raw?.headCommit === 'string' ? raw.headCommit : null,
      startedAt: typeof raw?.startedAt === 'string' ? raw.startedAt : null,
      token: typeof raw?.token === 'string' ? raw.token : null,
      ageMs,
      alive,
      liveness,
      unparsable: raw === null,
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

/**
 * Remove ONE stale slot file — the sweep half of the race-safe acquire. It
 * re-reads the file first and refuses if the on-disk token is no longer the one
 * the scan saw: a peer may have released and re-acquired the same slot between
 * scan and unlink, and deleting its fresh slot is the "peer deleted my slot"
 * failure the recon lanes observed (`DEV_LIVE_SLOT_REQUIRED` right after a
 * successful acquire). Returns true only when it actually unlinked OUR stale
 * file.
 *
 * Exported because the token-recheck contract is tested directly (host-free):
 * scanning is not a lock, so the guard has to live at the unlink.
 *
 * @param {object} entry a scan entry (`scanDevLiveSlots(...).stale`)
 * @param {object} [options]
 * @param {number} [options.now]
 * @param {number} [options.ttlMs]
 * @param {string|null} [options.pidNamespace] this prober's PID namespace
 * @returns {boolean}
 */
export function sweepStaleDevLiveSlot(entry, { now = Date.now(), ttlMs = DEV_LIVE_SLOT_TTL_MS, pidNamespace = currentPidNamespace() } = {}) {
  if (entry === null || typeof entry !== 'object' || typeof entry.path !== 'string') return false
  const raw = readSlot(entry.path)
  if (raw === null) {
    // Unparsable: only residue once it is old, and never a file we cannot stat.
    if (ageOf(entry.path, now) <= UNPARSABLE_STALE_MS) return false
  } else if (raw.token !== entry.token) {
    // A peer owns this slot now (released + re-acquired, or we scanned stale
    // content that has since been replaced). It is not ours to delete.
    return false
  } else {
    const ageMs = ageOf(entry.path, now)
    if (!classifySlotEntry({ raw, ageMs, currentNs: pidNamespace, ttlMs }).stale) return false
  }
  try {
    unlinkSync(entry.path)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

/** Refresh a slot's mtime iff we still own it (heartbeat; never a peer's). */
export function touchDevLiveSlot({ path, token } = {}) {
  const raw = readSlot(path)
  if (raw === null || raw.token !== token) return false
  try {
    const at = new Date()
    utimesSync(path, at, at)
    return true
  } catch {
    return false
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
 * @param {string|null} [input.pidNamespace] owner PID namespace (defaults to
 *   `/proc/self/ns/pid`; the recorded value is what lets peers classify this
 *   slot as `unknown` instead of guessing it dead)
 * @param {number} [input.ttlMs]
 * @param {number} [input.limit]
 * @returns {Readonly<{slot:number, path:string, token:string, release:()=>boolean, touch:()=>boolean}>}
 */
export function acquireDevLiveSlot({
  leaseRoot,
  runId,
  face,
  world,
  headCommit = null,
  pid = process.pid,
  pidNamespace = currentPidNamespace(),
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
  const scan = scanDevLiveSlots({ leaseRoot, now, ttlMs, limit, pidNamespace })
  for (const entry of scan.stale) sweepStaleDevLiveSlot(entry, { now, ttlMs, pidNamespace })
  const fresh = scanDevLiveSlots({ leaseRoot, now, ttlMs, limit, pidNamespace })
  if (fresh.atLimit) {
    throw new DevLiveSlotError(
      'DEV_LIVE_LIMIT_REACHED',
      `the machine already runs ${String(fresh.live.length)} dev Host(s), the owner ruling caps development boots at ${String(limit)}; finish or tear down one before starting another (slots: ${fresh.live.map((e) => `#${String(e.slot)} pid=${String(e.pid)} liveness=${String(e.liveness)} run=${String(e.runId)} world=${String(e.world)}`).join('; ')})`,
      { live: fresh.live, limit },
    )
  }
  mkdirSync(fresh.root, { recursive: true })
  const token = randomBytes(8).toString('hex')
  const startedAt = new Date(now).toISOString()
  for (let slot = 0; slot < limit; slot += 1) {
    const path = join(fresh.root, `${slot}.json`)
    const payload = { slot, token, pid, pidNs: pidNamespace, startedAt, runId, face, world, headCommit }
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
      pidNs: pidNamespace,
      /** Release ONLY the file that still names this token (never a peer's). */
      release: () => releaseDevLiveSlot({ path, token }),
      /** Heartbeat: keeps an unjudgeable (cross-namespace) slot fresh. */
      touch: () => touchDevLiveSlot({ path, token }),
    })
  }
  throw new DevLiveSlotError(
    'DEV_LIVE_LIMIT_REACHED',
    `every one of the ${String(limit)} dev-live slot file(s) was taken by a racing peer; no slot could be claimed`,
    { live: fresh.live, limit },
  )
}

/**
 * The driver-side release obligation, in ONE place. A driver must never call a
 * release method it merely *hopes* exists: `lease.release?.()` is a silent
 * no-op when the real API is `releaseSlot` / `finish`, and every boot then
 * leaks a machine slot until the runner exits (the 2026-11-07 `a5sf-live-member`
 * leak: the second boot of a pair hit `DEV_LIVE_LIMIT_REACHED`).
 *
 * So: missing API is a typed ERROR, not "nothing to do"; and a lease that still
 * reports a held slot after releasing is a typed ERROR too. Callers put this in
 * `finally`, so a leak cannot be silent.
 *
 * @param {object} lease the object returned by `preRegisterDevLiveBudget`
 * @returns {{released: boolean, held: boolean|null}}
 */
export function settleDevLiveLease(lease) {
  if (lease === null || typeof lease !== 'object') {
    throw new DevLiveSlotError('DEV_LIVE_SLOT_API_MISSING', 'settleDevLiveLease needs the dev-live lease returned by preRegisterDevLiveBudget')
  }
  if (typeof lease.releaseSlot !== 'function') {
    const legacy = typeof lease.release === 'function' ? ' (a bare `release()` is not the lease API: it is `releaseSlot()` / `finish()`)' : ''
    throw new DevLiveSlotError(
      'DEV_LIVE_SLOT_API_MISSING',
      `the dev-live lease exposes no releaseSlot(); refusing to treat a missing release API as "nothing to do" — that is exactly how a machine slot leaks silently${legacy}`,
      { keys: Object.keys(lease).sort() },
    )
  }
  const released = lease.releaseSlot()
  const held = typeof lease.holdsSlot === 'function' ? lease.holdsSlot() : null
  if (held === true) {
    throw new DevLiveSlotError(
      'DEV_LIVE_SLOT_LEAKED',
      'the dev-live lease still reports a held slot after releaseSlot(); the runner would keep occupying machine capacity',
    )
  }
  return { released: Boolean(released), held }
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
