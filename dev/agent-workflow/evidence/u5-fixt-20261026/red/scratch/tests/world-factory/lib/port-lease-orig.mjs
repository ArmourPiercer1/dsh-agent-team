/**
 * port-lease.mjs — cross-process, crash-recoverable port leases for the
 * U5 TestWorldFactory (plan U5: 跨进程资源租约可崩溃恢复).
 *
 * MODEL
 *   A lease is a JSON file `<leaseRoot>/<port>.lease` created with O_EXCL
 *   (two racers, one winner). It records the holder pid + start time + world
 *   id. A lease whose holder pid is DEAD is stale and MAY be reclaimed — that
 *   is the crash-recovery path (a runner SIGKILLed mid-run cannot delete its
 *   own leases; the next creator, or the reclaim scan, reclaims them).
 *
 *   The lease file alone is NOT sufficient: a sibling agent (e.g. the G1-F
 *   H0 PoC lane) may bind the same port WITHOUT a lease file. So acquisition
 *   additionally proves the port is actually free (`portInUse`, the same TCP
 *   probe the characterization harness uses) before returning, and releases
 *   the lease when an external bind is found. Lease + free-probe together
 *   close both races: file-race (exclusive create) and external-bind race
 *   (probe after create; retry the next port on failure).
 *
 *   Port policy is enforced here, not trusted to callers: only ranges from
 *   tests/paths.mjs TEST_PORT_RANGES (3180-3186 / 3491-3500); 3080 (stable
 *   instance) and anything outside the ranges are refused.
 */
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isSanctionedTestPort, STABLE_INSTANCE_PORT, TEST_PORT_RANGES } from '../../paths.mjs'
import { portInUse } from '../../characterization/lib/util.mjs'

/** True when `pid` is live (signal-0 probe). EPERM counts as alive. */
export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') return false
    if (error.code === 'EPERM') return true
    // Unknown errno: conservatively treat as alive (never steal from maybe-alive).
    return true
  }
}

/** All candidate ports in policy order: the 3180 block first, then 3491-3500. */
export function candidatePorts() {
  const out = []
  for (const [lo, hi] of TEST_PORT_RANGES) for (let p = lo; p <= hi; p += 1) out.push(p)
  return out
}

export class LeaseError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'LeaseError'
    this.code = code
  }
}

export function leasePathFor(leaseRoot, port) {
  return join(leaseRoot, `${port}.lease`)
}

/**
 * Read + interpret one lease file. Returns
 *   {state:'free'} | {state:'held', by} | {state:'stale', by} | {state:'corrupt', detail}
 */
export function readLease(leaseRoot, port) {
  const path = leasePathFor(leaseRoot, port)
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return { state: 'free', path }
    return { state: 'corrupt', detail: `read failed: ${error.code ?? error.message}`, path }
  }
  let lease
  try {
    lease = JSON.parse(raw)
  } catch {
    // A lease we cannot parse is NOT reclaimable evidence-free: treat as held
    // (a writer mid-create is indistinguishable from garbage, and stealing a
    // live agent's port is the harm this whole file exists to prevent).
    return { state: 'held', by: { pid: null, unparsable: true }, path }
  }
  const pid = Number(lease?.pid)
  if (!Number.isInteger(pid)) return { state: 'held', by: { pid: null, badPid: true }, path }
  if (pidAlive(pid)) return { state: 'held', by: lease, path }
  return { state: 'stale', by: lease, path }
}

/** O_EXCL create — the exclusivity IS the lock. EEXIST = somebody else won. */
function createLeaseExclusive(path, payload) {
  writeFileSync(path, JSON.stringify(payload, null, 2) + '\n', { flag: 'wx' })
}

/**
 * Acquire an exclusive lease on `port`. Throws LeaseError on:
 *   PORT_REFUSED    (policy violation: 3080 or outside the sanctioned ranges)
 *   LEASE_HELD      (live holder, or unparsable lease)
 *   EXTERNAL_BIND   (no live lease holder, but the TCP port answers — a
 *                    foreign listener, e.g. the concurrent G1-F lane)
 * Reclaims a STALE lease (dead holder pid) by removing the file and re-creating
 * it with a `reclaimedFrom` provenance field.
 * @returns {Promise<{leasePath:string, port:number, release:()=>void, note:(x:object)=>void}>}
 */
export async function acquirePortLease({ leaseRoot, port, world, purpose }) {
  if (!isSanctionedTestPort(port)) {
    throw new LeaseError('PORT_REFUSED', `port ${port} is outside policy (sanctioned: 3180-3186/3491-3500; never ${STABLE_INSTANCE_PORT})`)
  }
  mkdirSync(leaseRoot, { recursive: true })
  const payload = { pid: process.pid, startedAt: new Date().toISOString(), world: world ?? null, purpose: purpose ?? null }
  const path = leasePathFor(leaseRoot, port)
  const state = readLease(leaseRoot, port)
  if (state.state === 'corrupt') throw new LeaseError('LEASE_HELD', `lease ${path} unreadable: ${state.detail}`)
  if (state.state === 'held') throw new LeaseError('LEASE_HELD', `port ${port} leased by pid ${String(state.by?.pid ?? '?')} since ${String(state.by?.startedAt ?? '?')}`)
  if (state.state === 'stale') {
    // Crash recovery: holder pid is dead. Record the reclaim in the payload.
    payload.reclaimedFrom = { pid: state.by.pid, startedAt: state.by.startedAt ?? null, world: state.by.world ?? null }
    unlinkSync(path)
  }
  try {
    createLeaseExclusive(path, payload)
  } catch (error) {
    if (error.code === 'EEXIST') throw new LeaseError('LEASE_HELD', `port ${port}: lost the create race`)
    throw error
  }
  // Second guard: a foreign listener without a live lease file (concurrent lane).
  if (await portInUse(port)) {
    releasePortLease(path, process.pid)
    throw new LeaseError('EXTERNAL_BIND', `port ${port} answers TCP with no live lease holder — refusing (foreign listener)`)
  }
  return {
    leasePath: path,
    port,
    release: () => releasePortLease(path, process.pid),
    /** Refresh the lease after the holder learns something (host pid, …). */
    note: (extra) => {
      try {
        const current = JSON.parse(readFileSync(path, 'utf8'))
        writeFileSync(path, JSON.stringify({ ...current, ...extra }, null, 2) + '\n')
      } catch {
        /* best effort: the pid is the lock; annotations are diagnostics */
      }
    },
  }
}

/**
 * Release ONLY a lease we own (pid match). Deleting somebody else's lease
 * would let a third party steal a live port — the same harm class as killing
 * foreign PIDs — so a mismatch against a LIVE owner throws.
 */
export function releasePortLease(path, ownerPid) {
  let state = null
  try {
    state = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    state = null
  }
  if (state !== null && Number.isInteger(state.pid) && state.pid !== ownerPid && pidAlive(state.pid)) {
    throw new LeaseError('LEASE_HELD', `refusing to release lease ${path} owned by live pid ${state.pid}`)
  }
  try {
    unlinkSync(path)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

/**
 * Pick the first free, leasable, externally-idle port. `preferred` is tried
 * first (deterministic first-run layout), then the remaining candidates.
 * `include` optionally restricts the candidate set.
 * @returns {Promise<{port:number, leasePath:string, release:()=>void, note:(x:object)=>void, attempts:object[]}>}
 */
export async function acquireFirstFreeLease({ leaseRoot, world, purpose, preferred = [], include = null }) {
  const order = [...new Set([...preferred, ...candidatePorts()])].filter((p) => (include === null ? true : include.includes(p)))
  const attempts = []
  for (const port of order) {
    try {
      const lease = await acquirePortLease({ leaseRoot, port, world, purpose })
      return { ...lease, attempts }
    } catch (error) {
      attempts.push({ port, reason: `${error.code ?? 'ERR'}: ${error.message}` })
    }
  }
  const err = new LeaseError('NO_PORT', `no sanctioned port leasable (tried ${order.length}: ${attempts.map((a) => a.port).join(',')})`)
  err.attempts = attempts
  throw err
}

/**
 * Reclaim scan: every lease in `leaseRoot` whose holder pid is dead is stale.
 * Returns them for the caller to tear down (kill recorded owned pids, then
 * releasePortLease + owned-paths cleanup). NEVER touches live leases.
 */
export function scanStaleLeases(leaseRoot) {
  const out = []
  let names = []
  try {
    names = readdirSync(leaseRoot)
  } catch {
    return out
  }
  for (const name of names) {
    if (!name.endsWith('.lease')) continue
    const port = Number.parseInt(name.slice(0, -'.lease'.length), 10)
    if (!Number.isInteger(port)) continue
    const state = readLease(leaseRoot, port)
    if (state.state === 'stale') out.push({ port, leasePath: state.path, by: state.by })
  }
  return out
}
