/**
 * P-INBOX/MODEL — executable coalescing law for the light wake design.
 * Pure model: no host, no timers, no I/O. The host seam witness lives in
 * source-witness.md; the end-to-end host run is honestly ENV_BLOCK.
 */
import { describe, expect, it } from 'vitest'
import { createLatch } from './latch.mjs'

function world(initial: string[] = [], opts: { wakeThrows?: boolean } = {}) {
  let version = 1
  let pendingIds = [...initial]
  const wakes: Array<{ why: string; version: number; ids: string[] }> = []
  const latch = createLatch({
    scan: () => ({ version, pendingIds }),
    wake: (w) => {
      if (opts.wakeThrows === true) throw new Error('delivery failed')
      wakes.push(w)
    },
  })
  return {
    latch,
    wakes,
    add(id: string) {
      version += 1
      pendingIds = [...pendingIds, id]
      latch.workChanged()
    },
    resolve(id: string) {
      version += 1
      pendingIds = pendingIds.filter((x) => x !== id)
      latch.workChanged()
    },
    resolveAll() {
      version += 1
      pendingIds = []
      latch.workChanged()
    },
    get pending() {
      return [...pendingIds]
    },
  }
}

describe('P-INBOX/MODEL — one in-flight wake, dirty coalescing, authoritative fresheness', () => {
  it('three concurrent asks while idle collapse into ONE wake', () => {
    const w = world()
    w.add('A')
    w.add('B')
    w.add('C')
    expect(w.wakes).toHaveLength(1)
    expect(w.latch.phase).toBe('queued')
    // The wake is GENERIC; the coalesced work is read from the authority when
    // the turn starts, not carried by the hint.
    expect(w.latch.snapshot().pendingIds).toEqual(['A', 'B', 'C'])
  })

  it('asks arriving while running set dirty and do NOT emit per-request followups', () => {
    const w = world()
    w.add('A')
    w.latch.turnStart()
    w.add('B')
    w.add('C')
    w.add('D')
    expect(w.wakes).toHaveLength(1)
    expect(w.latch.dirty).toBe(true)
    const end = w.latch.turnEnd()
    expect(end.woken).toBe(true)
    expect(w.wakes).toHaveLength(2)
    expect(w.latch.snapshot().pendingIds).toEqual(['A', 'B', 'C', 'D'])
  })

  it('a turn that emptied the authority emits NO follow-up even if events arrived', () => {
    const w = world()
    w.add('A')
    w.latch.turnStart()
    w.resolve('A')
    const end = w.latch.turnEnd()
    expect(end.woken).toBe(false)
    expect(w.wakes).toHaveLength(1)
    expect(w.latch.phase).toBe('idle')
  })

  it('P0 regression: a pending-but-UNCHANGED wake is NOT cancelled (A is still waiting)', () => {
    const w = world()
    w.add('A')
    // No new version, no new id: the review still has A to do. The old model
    // read "not fresh" as "not pending" and withdrew the only valid wake.
    expect(w.latch.cancelIfStale()).toBe(false)
    expect(w.latch.phase).toBe('queued')
    expect(w.wakes).toHaveLength(1)
  })

  it('already-resolved work cannot justify a wake (the event is a hint, not the fact)', () => {
    const w = world()
    w.add('A')
    w.resolveAll()
    // The queued wake is still unclaimed, so it can be withdrawn when the
    // authority says there is nothing to review.
    expect(w.latch.cancelIfStale()).toBe(true)
    // A late/duplicate hint after resolution: scan sees no pending work.
    w.latch.workChanged()
    expect(w.wakes).toHaveLength(1)
    expect(w.latch.phase).toBe('idle')
  })

  it('no-progress loop guard: the same pending version does not re-wake forever', () => {
    const w = world()
    w.add('A')
    w.latch.turnStart()
    // The turn "ran" but did not change the authority; turnEnd scans the same
    // version + ids. Fresh means a NEW version or a different id set.
    const end = w.latch.turnEnd()
    expect(end.woken).toBe(false)
    expect(w.wakes).toHaveLength(1)
    expect(w.latch.log.suppressed).toBeGreaterThanOrEqual(1)
  })

  it('claim/crash recovery re-reads the authority and wakes for still-pending work', () => {
    const w = world()
    w.add('A')
    w.latch.turnStart()
    // crash: no turnEnd. The next boot recovers from the authority.
    const woken = w.latch.recover()
    expect(woken).toBe(true)
    expect(w.wakes).toHaveLength(2)
    expect(w.latch.phase).toBe('queued')
  })

  it('P0 regression: recovery adopts a surviving Host wake instead of duplicating it', () => {
    const w = world()
    w.add('A')
    w.latch.turnStart()
    // The crash happened after the wake was delivered but before the turn
    // claimed it: the Host Inbox still holds the wake.
    const woken = w.latch.recover({ persistentWakeExists: true })
    expect(woken).toBe(false)
    expect(w.wakes).toHaveLength(1)
    expect(w.latch.phase).toBe('queued')
    // Claiming the surviving wake and finishing with no progress stays silent.
    w.latch.turnStart()
    expect(w.latch.turnEnd().woken).toBe(false)
    expect(w.wakes).toHaveLength(1)
  })

  it('P0 regression: a failed delivery releases queued and the same work can wake again', () => {
    const w = world()
    w.add('A')
    expect(w.latch.phase).toBe('queued')
    expect(w.latch.deliveryFailed()).toBe(true)
    expect(w.latch.phase).toBe('idle')
    // No timer: the next activation is what retries. The baseline was reset.
    w.latch.workChanged()
    expect(w.latch.phase).toBe('queued')
    expect(w.wakes).toHaveLength(2)
  })

  it('P0 regression: a throwing wake never leaves the latch pinned in queued', () => {
    const w = world([], { wakeThrows: true })
    expect(() => w.add('A')).toThrow('delivery failed')
    expect(w.latch.phase).toBe('idle')
    expect(w.latch.dirty).toBe(true)
  })

  it('recovery with nothing pending stays silent', () => {
    const w = world()
    w.add('A')
    w.latch.turnStart()
    w.resolve('A')
    const woken = w.latch.recover()
    expect(woken).toBe(false)
    expect(w.wakes).toHaveLength(1)
  })
})
