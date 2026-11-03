/**
 * P-INBOX model — the PR #536 §3.4 activation/poll/latch state machine,
 * implemented as a PURE model over an injected authoritative-work port.
 *
 * This is a design model, NOT the production coordinator and NOT a host proof.
 * It makes these laws executable before any code is written:
 *   - one in-flight Review Wake per recipient;
 *   - events during queued/running collapse into `dirty` (no per-event followup);
 *   - a wake is emitted only when the AUTHORITATIVE scan says work is PENDING
 *     and its identity CHANGED since the last observation — those are two
 *     separate facts (the review's P0):
 *       pending  = there is still something to review;
 *       changed  = the pending set moved since this latch last observed it.
 *   - a no-longer-pending wake may be withdrawn; PENDING-BUT-UNCHANGED may not;
 *   - turn end rescans and emits at most one more wake for changed work;
 *   - recovery first asks whether a wake already survives in the Host Inbox,
 *     and only re-emits when it does not;
 *   - a failed delivery returns the latch to idle instead of pinning it in
 *     `queued` forever.
 */

export const LATCH_STATES = ['idle', 'queued', 'running']

export function createLatch({ scan, wake }) {
  let phase = 'idle'
  let dirty = false
  let lastSeenVersion = -1
  let lastSeenIds = []
  const log = { wakes: 0, scans: 0, suppressed: 0, failed: 0 }

  /** One authoritative read. `pending` and `changed` are independent. */
  const readWork = () => {
    log.scans += 1
    const snapshot = scan()
    const ids = [...(snapshot.pendingIds ?? [])]
    const version = Number(snapshot.version ?? 0)
    const pending = ids.length > 0
    const changed = version !== lastSeenVersion || !sameIds(ids, lastSeenIds)
    return { pending, changed, version, ids }
  }

  const observe = (work) => {
    lastSeenVersion = work.version
    lastSeenIds = work.ids
  }

  const deliveryFailed = () => {
    if (phase !== 'queued') return false
    // The wake may or may not have reached the Inbox. Do not stay pinned in
    // `queued`; return to idle and make the same pending work eligible again
    // (a later activation, never a timer).
    phase = 'idle'
    dirty = true
    lastSeenVersion = -1
    lastSeenIds = []
    log.failed += 1
    return true
  }

  const emit = (work, why) => {
    phase = 'queued'
    dirty = false
    observe(work)
    log.wakes += 1
    try {
      wake({ why, version: work.version, ids: work.ids })
    } catch (error) {
      deliveryFailed()
      throw error
    }
    return true
  }

  const maybeWake = (why) => {
    if (phase !== 'idle') return false
    const work = readWork()
    if (!work.pending || !work.changed) {
      dirty = false
      log.suppressed += 1
      return false
    }
    return emit(work, why)
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
      const work = readWork()
      if (!work.pending || !work.changed) {
        log.suppressed += 1
        return { woken: false, dirty: hadDirty }
      }
      // A dirty flag alone is not enough: the authoritative read decides.
      const woken = emit(work, 'turn-end-rescan')
      return { woken, dirty: hadDirty }
    },
    /** Read the current authoritative snapshot (no state change). */
    snapshot() {
      return scan()
    },
    /** Withdraw an unclaimed generic wake only when the authority says NO
     *  work remains. Pending-but-unchanged is NOT stale. */
    cancelIfStale() {
      if (phase !== 'queued') return false
      const work = readWork()
      if (work.pending) return false
      phase = 'idle'
      dirty = false
      log.suppressed += 1
      return true
    },
    /** Crash / restart / claim-lost recovery. `persistentWakeExists` is the
     *  caller's check of the REAL Host Inbox for a surviving Review Wake: if
     *  one exists, do not mint a duplicate; adopt it as the in-flight wake. */
    recover({ persistentWakeExists = false } = {}) {
      if (persistentWakeExists) {
        const work = readWork()
        dirty = false
        if (!work.pending) {
          phase = 'idle'
          return false
        }
        phase = 'queued'
        observe(work)
        return false
      }
      phase = 'idle'
      dirty = false
      // A crash loses the in-flight claim, so the freshness baseline is reset:
      // the SAME still-pending work must be able to wake again.
      lastSeenVersion = -1
      lastSeenIds = []
      return maybeWake('recover')
    },
    /** The wake delivery path failed. Releases `queued`; never silent. */
    deliveryFailed() {
      return deliveryFailed()
    },
  }
}

function sameIds(a, b) {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((v, i) => v === right[i])
}
