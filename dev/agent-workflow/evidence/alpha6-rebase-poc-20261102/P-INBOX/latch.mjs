/**
 * P-INBOX model — the PR #536 §3.4 activation/poll/latch state machine,
 * implemented as a PURE model over an injected authoritative-work port.
 *
 * This is a design model, NOT the production coordinator and NOT a host proof.
 * It exists to make the coalescing law executable before any code is written:
 *   - one in-flight Review Wake per recipient;
 *   - events during queued/running collapse into `dirty` (no per-event followup);
 *   - a wake is emitted only when the AUTHORITATIVE scan says there is fresh
 *     work — a resolved case or the same backlog version is not fresh work;
 *   - turn end rescans and emits at most one more wake;
 *   - `recover()` re-reads the authority after a crash/claim.
 */

export const LATCH_STATES = ['idle', 'queued', 'running']

export function createLatch({ scan, wake }) {
  let phase = 'idle'
  let dirty = false
  let lastSeenVersion = -1
  let lastSeenIds = []
  const log = { wakes: 0, scans: 0, suppressed: 0 }

  const freshWork = () => {
    log.scans += 1
    const snapshot = scan()
    const ids = [...(snapshot.pendingIds ?? [])]
    const version = Number(snapshot.version ?? 0)
    const fresh = ids.length > 0 && (version !== lastSeenVersion || !sameIds(ids, lastSeenIds))
    return { fresh, version, ids }
  }

  const maybeWake = (why) => {
    if (phase !== 'idle') return false
    const work = freshWork()
    if (!work.fresh) {
      dirty = false
      log.suppressed += 1
      return false
    }
    phase = 'queued'
    dirty = false
    lastSeenVersion = work.version
    lastSeenIds = work.ids
    log.wakes += 1
    wake({ why, version: work.version, ids: work.ids })
    return true
  }

  return {
    get phase() {
      return phase
    },
    get dirty() {
      return dirty
    },
    get log() {
      return { ...log }
    },
    /** A WorkChanged hint (new ask, resolve, abandon, handoff, takeover). */
    workChanged() {
      if (phase === 'idle') {
        maybeWake('work-changed')
      } else {
        dirty = true
        log.suppressed += 1
      }
    },
    /** The DSH turn actually started; the queued wake is now in flight. */
    turnStart() {
      if (phase !== 'queued') throw new Error(`turnStart in phase ${phase}`)
      phase = 'running'
    },
    /** The turn ended: rescan, and emit at most ONE more coalesced wake. */
    turnEnd() {
      if (phase !== 'running') throw new Error(`turnEnd in phase ${phase}`)
      phase = 'idle'
      const hadDirty = dirty
      dirty = false
      const work = freshWork()
      if (!work.fresh) {
        log.suppressed += 1
        return { woken: false, dirty: hadDirty }
      }
      // A dirty flag alone is not enough: freshWork() is authoritative.
      phase = 'queued'
      lastSeenVersion = work.version
      lastSeenIds = work.ids
      log.wakes += 1
      wake({ why: 'turn-end-rescan', version: work.version, ids: work.ids })
      return { woken: true, dirty: hadDirty }
    },
    /** Read the current authoritative snapshot (no state change). */
    snapshot() {
      return scan()
    },
    /** Withdraw an unclaimed generic wake that the authority says is stale. */
    cancelIfStale() {
      if (phase !== 'queued') return false
      const work = freshWork()
      if (work.fresh) return false
      phase = 'idle'
      dirty = false
      log.suppressed += 1
      return true
    },
    /** Crash / restart / claim-lost recovery: re-read the authority from idle.
     *  A crash loses the in-flight claim, so the freshness baseline is reset:
     *  the SAME still-pending work must be able to wake again. */
    recover() {
      phase = 'idle'
      dirty = false
      lastSeenVersion = -1
      lastSeenIds = []
      return maybeWake('recover')
    },
  }
}

function sameIds(a, b) {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((v, i) => v === right[i])
}
