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
 * A slot is STALE when BOTH hold: the file is old enough that a creator cannot
 * still be mid-write, and the owner is provably gone. "Provably gone" means
 * `pidAlive` answered FALSE **in the owner's own PID namespace** — the slot
 * records the writer's `/proc/self/ns/pid` link (`pidNs`), because a pid number
 * is namespace-local and a `pidAlive(pid)` answer from a DIFFERENT namespace is
 * not evidence of death. E1 (measured 2026-11-07, recon `a5sf-recon-search`):
 * a peer lane's sweep read our live slot's pid as dead, unlinked the file, and
 * our boot was then refused at the spawn chokepoint with
 * `DEV_LIVE_SLOT_REQUIRED` although the slot had been acquired. A slot whose
 * namespace we cannot compare (a foreign `pidNs`, or a legacy file with none)
 * is therefore NEVER swept on liveness alone; it ages out through
 * `DEV_LIVE_SLOT_TTL_MS` (the timeout safety valve), and even then the sweep
 * re-reads the file and refuses to unlink a token that changed under it.
 *
 * `alive` is the raw `pidAlive` answer (kept: callers/tests read it);
 * `liveness` says what that answer MEANS: `alive` | `dead` (same namespace, so
 * authoritative) | `foreign-namespace` | `unparsable`.
 *
 * CORE PATCH BUDGET = 0. No upstream tree is touched.
 *
 * @module tests/world-factory/lib/dev-live-slots
 */
import { mkdirSync, readdirSync, readFileSync, readlinkSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
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

/**
 * A provably-dead pid is swept only once the slot is older than this. It keeps
 * the sweep away from a file whose writer was still mid-acquire (the slot file
 * lands before the writer's next instruction, so a live-but-not-yet-visible pid
 * cannot be mistaken for a dead one by a same-namespace second look).
 */
export const DEAD_SLOT_GRACE_MS = 5_000

/**
 * This process's PID namespace identity (`pid:[<inode>]`), or `null` when the
 * platform exposes no `/proc/self/ns/pid` (macOS/Windows). `null` is "cannot
 * compare", never "same namespace".
 *
 * @returns {string | null}
 */
export function currentPidNamespace() {
  try {
    return readlinkSync('/proc/self/ns/pid')
  } catch {
    return null
  }
}

/**
 * Can a `pidAlive` answer from THIS namespace speak for the slot's owner?
 *
 * Yes only when both the recorded namespace and ours are known and equal. A
 * missing `pidNs` (legacy file) or an unknown one is NOT judgeable: stealing a
 * live peer's slot is the failure this predicate exists to prevent.
 *
 * @param {string | null} slotPidNs
 * @param {string | null} ownPidNs
 * @returns {boolean}
 */
export function pidNamespaceComparable(slotPidNs, ownPidNs) {
  return typeof slotPidNs === 'string' && slotPidNs !== '' && typeof ownPidNs === 'string' && ownPidNs !== ''
    ? slotPidNs === ownPidNs
    : false
}

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
export function scanDevLiveSlots({ leaseRoot, now = Date.now(), ttlMs = DEV_LIVE_SLOT_TTL_MS, limit = DEV_LIVE_SLOT_LIMIT, deadPidGraceMs = DEAD_SLOT_GRACE_MS, ownPidNs = currentPidNamespace() } = {}) {
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
    const pidNs = typeof raw?.pidNs === 'string' ? raw.pidNs : null
    // E1: a `pidAlive` FALSE from a DIFFERENT PID namespace is not evidence of
    // death — the number is namespace-local. Only a comparable namespace may
    // turn a dead pid into a sweep; everything else waits for the TTL.
    const liveness = unparsable
      ? 'unparsable'
      : alive
        ? 'alive'
        : pidNamespaceComparable(pidNs, ownPidNs) ? 'dead' : 'foreign-namespace'
    const deadLongEnough = liveness === 'dead' && ageMs > deadPidGraceMs
    const stale = unparsable
      ? ageMs > UNPARSABLE_STALE_MS
      : deadLongEnough || ageMs > ttlMs
    entries.push(Object.freeze({
      slot: Number(match[1]),
      path,
      raw,
      pid,
      pidNs,
      runId: typeof raw?.runId === 'string' ? raw.runId : null,
      face: typeof raw?.face === 'string' ? raw.face : null,
      world: typeof raw?.world === 'string' ? raw.world : null,
      headCommit: typeof raw?.headCommit === 'string' ? raw.headCommit : null,
      startedAt: typeof raw?.startedAt === 'string' ? raw.startedAt : null,
      token: typeof raw?.token === 'string' ? raw.token : null,
      ageMs,
      alive,
      liveness,
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

/**
 * Remove ONE stale slot file — ONLY if the file still names the token this scan
 * classified. The re-read is the second half of the E1 fix: even a slot we
 * believe is stale is never unlinked once a peer has rewritten it (a fresh
 * token means a fresh owner, whatever the pid namespace said).
 */
export function sweepStaleSlot(entry) {
  // The caller's classification is the entry's contract: an entry a scan did
  // NOT call stale is never deleted through this seam (sweeping a live peer is
  // the exact E1 failure), and the token re-read below covers the rest.
  if (entry?.stale !== true) return false
  const current = readSlot(entry.path)
  if (current === null || (entry.token !== null && current.token !== entry.token)) return false
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
  deadPidGraceMs = DEAD_SLOT_GRACE_MS,
  pidNs = currentPidNamespace(),
} = {}) {
  if (typeof leaseRoot !== 'string' || leaseRoot.trim() === '') {
    throw new DevLiveSlotError('DEV_LIVE_SLOT_UNAVAILABLE', 'acquireDevLiveSlot needs the shared lease root (TestWorldFactory#leaseRoot)')
  }
  if (typeof runId !== 'string' || runId.trim() === '') {
    throw new DevLiveSlotError('DEV_LIVE_SLOT_UNAVAILABLE', 'a dev-live slot must be bound to the run id it hosts')
  }
  const scan = scanDevLiveSlots({ leaseRoot, now, ttlMs, limit, deadPidGraceMs })
  for (const entry of scan.stale) sweepStaleSlot(entry)
  const fresh = scanDevLiveSlots({ leaseRoot, now, ttlMs, limit, deadPidGraceMs })
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
    // E1: `pidNs` is the identity that makes `pid` readable at all — a slot
    // without it (legacy writer) is never swept on liveness alone.
    const payload = { slot, token, pid, pidNs, startedAt, runId, face, world, headCommit }
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
