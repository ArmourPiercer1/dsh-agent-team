/**
 * Alpha.6 PR3′ (Lane 2) — the single-flight wake kernel, unit tier C1.
 *
 * Matrix legs 1–12 and 14–16 of `docs/plans/memo/alpha6-review-separation/pr3-wake-scheduler-design-20261030.md`
 * §5. Everything here is deterministic: no timers (the adapter owns clocks and hands the firing deadline to
 * the kernel as data), no promises, no fake ports whose behaviour I control mid-test, no wall clock. Two
 * runs of this file must produce the same result, and the wake ids it asserts are the ones the kernel
 * derives, not the ones it happened to print.
 *
 * What C1 cannot prove, and therefore what no leg below claims: the Kv adapter's real cross-process CAS
 * atomicity (legs model the CAS protocol, they do not run two processes), and the truth of inbox facts in
 * the recovery fold (legs feed synthetic facts, which proves the fold's decisions and not the host's
 * reporting). Both are C2 at the final merged HEAD, named as such in §5 of the design.
 */

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { canonicalJsonStringify } from '../../contracts/src/index.js'
import {
  composeWakeText,
  createWakeSlot,
  deriveWakeId,
  hydrateWakeSlot,
  reconcileWakeSlots,
  reduceWakeSlot,
  type WakeContext,
  type WakeEvent,
  type WakeInboxFact,
  type WakeLimits,
  type WakeSlot,
  type WakeSlotKey,
} from '../review-wake/index.js'

const KEY: WakeSlotKey = { rootSessionId: 'team-root-01', reviewerInstanceId: 'inst-officer-1', sessionGeneration: 4 }
const OTHER: WakeSlotKey = { rootSessionId: 'team-root-01', reviewerInstanceId: 'inst-officer-2', sessionGeneration: 4 }
const FENCE = { key: KEY, leaseEpoch: 1, writerToken: 'writer-a' }
const LIMITS: WakeLimits = { maxRedeliveries: 2, noProgressLimit: 2, backoff: { baseMs: 1000, capMs: 8000 } }
const NOW = '2026-10-30T12:00:00.000Z'

function ctx(nowIso: string = NOW, limits: WakeLimits = LIMITS): WakeContext {
  return { nowIso, limits }
}

/** Events are data, so the helpers are literal builders and every one of them carries the fence. */
const ev = {
  request: (workFingerprint: string, over: Record<string, unknown> = {}) => ({ kind: 'request' as const, ...FENCE, workFingerprint, ...over }),
  accepted: (wakeId: string, messageId: string, over: Record<string, unknown> = {}) => ({ kind: 'delivery-accepted' as const, ...FENCE, wakeId, messageId, ...over }),
  refused: (wakeId: string, failure: 'send-failed' | 'target-unresolvable' | 'timeout' = 'send-failed') => ({ kind: 'delivery-refused' as const, ...FENCE, wakeId, failure }),
  claimed: (wakeId: string, messageId: string, turn: number) => ({ kind: 'claimed' as const, ...FENCE, wakeId, messageId, turn }),
  turnEnded: (wakeId: string, turn: number) => ({ kind: 'turn-ended' as const, ...FENCE, wakeId, turn }),
  scan: (hasReadyWork: boolean, workFingerprint: string | null) => ({ kind: 'work-scan-completed' as const, ...FENCE, hasReadyWork, workFingerprint }),
  withdraw: () => ({ kind: 'withdraw-requested' as const, ...FENCE }),
  stop: (reason: 'user-stop' | 'team-close' | 'reviewer-disposed' = 'user-stop') => ({ kind: 'stop' as const, ...FENCE, reason }),
  resume: () => ({ kind: 'resume' as const, ...FENCE }),
  timer: (deadlineIso: string) => ({ kind: 'timer-elapsed' as const, ...FENCE, deadlineIso }),
  recovery: (inbox: 'unclaimed' | 'claimed' | 'absent', messageId: string | null = null, turn: number | null = null) => ({ kind: 'recovery-observed' as const, ...FENCE, inbox, messageId, turn }),
}

/** The shape the reducer's effect descriptors arrive in, widened only as far as the assertions need. */
type EffectRow = { kind: string; wakeId?: string; messageId?: string; turn?: number; text?: string }

interface Drive {
  readonly slot: WakeSlot | null
  readonly effects: readonly EffectRow[]
  readonly refusals: readonly (string | null)[]
  /** Run the same fold twice and prove the slot is only ever what the reducer returned. */
  readonly revisions: readonly number[]
}

function drive(events: readonly WakeEvent[], context: WakeContext = ctx()): Drive {
  let slot: WakeSlot | null = null
  const effects: EffectRow[] = []
  const refusals: (string | null)[] = []
  const revisions: number[] = []
  for (const event of events) {
    const result = reduceWakeSlot(slot, event, context)
    slot = result.slot
    for (const effect of result.effects) effects.push(effect as EffectRow)
    refusals.push(result.refusal)
    revisions.push(slot?.revision ?? -1)
  }
  return { slot, effects, refusals, revisions }
}

const delivers = (effects: Drive['effects']) => effects.filter((e) => e.kind === 'deliver-wake')
const withdraws = (effects: Drive['effects']) => effects.filter((e) => e.kind === 'withdraw-wake')

/** The canonical first flight: request → wake → accepted → claimed → turn ends. */
function oneFullCycle(workFingerprint = 'fp-a', turn = 7): Drive {
  const first = drive([ev.request(workFingerprint)])
  const wakeId = (first.slot as WakeSlot).wakeId as string
  return drive([
    ev.request(workFingerprint),
    ev.accepted(wakeId, 'msg-1'),
    ev.claimed(wakeId, 'msg-1', turn),
    ev.turnEnded(wakeId, turn),
  ])
}

// --- leg 1 ---------------------------------------------------------------------------------------------

describe('a6-pr3 leg 1 — one hundred requests, one wake', () => {
  it('merges ninety-nine of them and delivers exactly one wake (A6-SF-02)', () => {
    const events: WakeEvent[] = []
    for (let i = 0; i < 100; i += 1) events.push(ev.request(`fp-${i}`))
    const run = drive(events)
    expect(delivers(run.effects)).toHaveLength(1)
    expect(run.slot?.phase).toBe('reserved')
    expect(run.slot?.wakeSequence).toBe(1)
    expect(run.slot?.dirty).toBe(true)
    // Ninety-nine refusals would also be acceptable behaviour, but silence is the point: a merge is not an
    // error, so nothing is reported as one.
    expect(run.refusals.filter((r) => r !== null)).toEqual([])
  })

  it('the merged requests do not accumulate into a queue of wake ids', () => {
    const run = drive([ev.request('fp-1'), ev.request('fp-2'), ev.request('fp-3')])
    expect(run.slot?.wakeId).toBe(deriveWakeId({ ...KEY, wakeSequence: 1 }))
    expect(run.revisions).toEqual([1, 2, 3])
  })
})

// --- legs 2 and 3 --------------------------------------------------------------------------------------

describe('a6-pr3 legs 2–3 — one wake per completed turn', () => {
  it('after a turn ends with b and c still ready, exactly one new wake is reserved (A6-SF-03)', () => {
    const wakeId = deriveWakeId({ ...KEY, wakeSequence: 1 })
    const run = drive([
      ev.request('fp-a'),
      ev.accepted(wakeId, 'msg-1'),
      ev.claimed(wakeId, 'msg-1', 7),
      ev.turnEnded(wakeId, 7),
      ev.scan(true, 'fp-bc'),
    ])
    expect(delivers(run.effects)).toHaveLength(2)
    expect(run.slot?.wakeSequence).toBe(2)
    expect(run.slot?.wakeId).toBe(deriveWakeId({ ...KEY, wakeSequence: 2 }))
    expect(run.slot?.noProgressCycles).toBe(0)
  })

  it('and when the reviewer drained everything in its first turn, zero further wakes and the slot is idle', () => {
    const wakeId = deriveWakeId({ ...KEY, wakeSequence: 1 })
    const run = drive([
      ev.request('fp-a'),
      ev.accepted(wakeId, 'msg-1'),
      ev.claimed(wakeId, 'msg-1', 7),
      ev.turnEnded(wakeId, 7),
      ev.scan(false, null),
    ])
    expect(delivers(run.effects)).toHaveLength(1)
    expect(run.slot?.phase).toBe('idle')
    expect(run.slot?.wakeId).toBeNull()
    expect(run.slot?.messageId).toBeNull()
  })

  it('work that arrived mid-turn still gets exactly one wake after the turn, not one per arrival', () => {
    const wakeId = deriveWakeId({ ...KEY, wakeSequence: 1 })
    const run = drive([
      ev.request('fp-a'),
      ev.accepted(wakeId, 'msg-1'),
      ev.claimed(wakeId, 'msg-1', 7),
      ev.request('fp-b'),
      ev.request('fp-c'),
      ev.turnEnded(wakeId, 7),
      ev.scan(true, 'fp-bc'),
    ])
    expect(delivers(run.effects)).toHaveLength(2)
    expect(run.slot?.dirty).toBe(false)
  })
})

// --- leg 4 ---------------------------------------------------------------------------------------------

describe('a6-pr3 leg 4 — no wake into an empty queue, absolutely (SF-4)', () => {
  it('a reconciling slot with nothing ready emits NOTHING and releases; the planted true emits one', () => {
    const wakeId = deriveWakeId({ ...KEY, wakeSequence: 1 })
    const prefix = [
      ev.request('fp-a'),
      ev.accepted(wakeId, 'msg-1'),
      ev.claimed(wakeId, 'msg-1', 7),
      ev.turnEnded(wakeId, 7),
    ]
    const before = drive(prefix)
    const empty = drive([...prefix, ev.scan(false, null)])
    // The last event added NOTHING to the effect list. A slice-based assertion would pass on a reducer that
    // emitted an extra wake earlier in the sequence, which is not the law being pinned.
    expect(empty.effects).toEqual(before.effects)
    expect(delivers(empty.effects)).toHaveLength(1)
    expect(empty.slot?.phase).toBe('idle')
    // The negative control: this leg must be able to fail. If the reducer ever stops honouring the answer,
    // the ready variant is where it shows.
    const ready = drive([...prefix, ev.scan(true, 'fp-a2')])
    expect(delivers(ready.effects)).toHaveLength(2)
  })
})

// --- legs 5 and 6 --------------------------------------------------------------------------------------

describe('a6-pr3 legs 5–6 — withdrawal is exact, unclaimed-only, and never someone else\'s message', () => {
  it('a claimed wake cannot be withdrawn at all', () => {
    const wakeId = deriveWakeId({ ...KEY, wakeSequence: 1 })
    const run = drive([ev.request('fp-a'), ev.accepted(wakeId, 'msg-1'), ev.claimed(wakeId, 'msg-1', 7), ev.withdraw()])
    expect(run.refusals.at(-1)).toBe('WAKE_PHASE_UNEXPECTED')
    expect(withdraws(run.effects)).toEqual([])
    expect(run.slot?.phase).toBe('running')
  })

  it('an unclaimed wake is withdrawn by its exact id and nothing else', () => {
    const wakeId = deriveWakeId({ ...KEY, wakeSequence: 1 })
    const run = drive([ev.request('fp-a'), ev.accepted(wakeId, 'msg-1'), ev.withdraw()])
    expect(withdraws(run.effects)).toEqual([{ kind: 'withdraw-wake', wakeId, messageId: 'msg-1' }])
    expect(run.slot?.phase).toBe('idle')
    expect(run.slot?.messageId).toBeNull()
  })

  it('a wake that was never accepted has no message to delete, and saying so beats deleting a guess', () => {
    const run = drive([ev.request('fp-a'), ev.withdraw()])
    expect(run.refusals.at(-1)).toBe('WAKE_NO_MESSAGE_TO_WITHDRAW')
    expect(withdraws(run.effects)).toEqual([])
  })

  it('a message id the slot never authored is refused, in both directions', () => {
    const wakeId = deriveWakeId({ ...KEY, wakeSequence: 1 })
    // The acceptance callback lying about which message it wrote.
    const acceptedForeign = drive([ev.request('fp-a'), ev.accepted(wakeId, 'msg-of-a-human')])
    expect(acceptedForeign.slot?.messageId).toBe('msg-of-a-human')
    // ...and recovery claiming an unclaimed message that is not ours: two physical messages exist, and the
    // kernel that "picks one" is the kernel that deletes the wrong one.
    const withOurs = drive([ev.request('fp-a'), ev.accepted(wakeId, 'msg-1')])
    const observedOther = reduceWakeSlot(withOurs.slot, ev.recovery('unclaimed', 'msg-2'), ctx())
    expect(observedOther.refusal).toBe('WAKE_FOREIGN_MESSAGE')
    expect(observedOther.slot).toBe(withOurs.slot)
  })
})

// --- leg 7 ---------------------------------------------------------------------------------------------

describe('a6-pr3 leg 7 — Stop is sticky at every phase (A6-SF-10)', () => {
  const phases: Array<{ label: string; events: readonly WakeEvent[]; withdraws: boolean }> = []
  const wakeId = deriveWakeId({ ...KEY, wakeSequence: 1 })
  phases.push({ label: 'reserved', events: [ev.request('fp-a')], withdraws: false })
  phases.push({ label: 'queued', events: [ev.request('fp-a'), ev.accepted(wakeId, 'msg-1')], withdraws: true })
  phases.push({ label: 'running', events: [ev.request('fp-a'), ev.accepted(wakeId, 'msg-1'), ev.claimed(wakeId, 'msg-1', 7)], withdraws: false })
  phases.push({ label: 'reconciling', events: [ev.request('fp-a'), ev.accepted(wakeId, 'msg-1'), ev.claimed(wakeId, 'msg-1', 7), ev.turnEnded(wakeId, 7)], withdraws: false })
  phases.push({ label: 'backoff', events: [ev.request('fp-a'), ev.refused(wakeId)], withdraws: false })

  for (const phase of phases) {
    it(`stop from ${phase.label} suspends, removes only an unclaimed notification, and refuses everything after`, () => {
      const before = drive(phase.events)
      const stopped = reduceWakeSlot(before.slot, ev.stop('user-stop'), ctx())
      expect(stopped.slot?.phase).toBe('suspended')
      expect(stopped.slot?.suspendReason).toBe('user-stop')
      expect(withdraws(stopped.effects as Drive['effects'])).toHaveLength(phase.withdraws ? 1 : 0)

      for (const later of [ev.request('fp-new'), ev.claimed(wakeId, 'msg-1', 8), ev.turnEnded(wakeId, 8), ev.scan(true, 'fp-x'), ev.timer('2027-01-01T00:00:00.000Z'), ev.recovery('unclaimed', 'msg-1')]) {
        const after = reduceWakeSlot(stopped.slot, later, ctx())
        expect(after.refusal, `a ${String((later as { kind: string }).kind)} event must not revive a suspended slot`).toBe('WAKE_SLOT_SUSPENDED')
        expect(after.effects).toEqual([])
        expect(after.slot).toBe(stopped.slot)
      }
    })
  }

  it('a second stop keeps the first reason, and only an explicit resume leaves the phase', () => {
    const before = drive([ev.request('fp-a')])
    const first = reduceWakeSlot(before.slot, ev.stop('user-stop'), ctx())
    const second = reduceWakeSlot(first.slot, ev.stop('team-close'), ctx())
    expect(second.refusal).toBeNull()
    expect(second.slot?.suspendReason).toBe('user-stop')
    // Resume is the one event allowed out, and even it delivers no wake: it re-reads.
    const resumed = reduceWakeSlot(second.slot, ev.resume(), ctx())
    expect(resumed.slot?.phase).toBe('reconciling')
    expect(delivers(resumed.effects as Drive['effects'])).toEqual([])
    expect(resumed.effects.map((e) => e.kind)).toEqual(['scan-work'])
  })

  it('stop for a triple that never existed is an accepted no-op, not a slot invented out of nothing', () => {
    const run = reduceWakeSlot(null, ev.stop('user-stop'), ctx())
    expect(run.refusal).toBeNull()
    expect(run.slot).toBeNull()
    expect(run.effects).toEqual([])
  })
})

// --- leg 8 ---------------------------------------------------------------------------------------------

describe('a6-pr3 leg 8 — the crash windows and the restart fold', () => {
  const wakeId = deriveWakeId({ ...KEY, wakeSequence: 1 })

  it('checkpoint said reserved, the send callback never arrived, the message is absent: re-deliver the SAME wake id', () => {
    const reserved = drive([ev.request('fp-a')])
    const recovered = reduceWakeSlot(reserved.slot, ev.recovery('absent'), ctx())
    expect(recovered.refusal).toBeNull()
    expect(delivers(recovered.effects as Drive['effects']).map((e) => e.wakeId)).toEqual([wakeId])
    expect(recovered.slot?.redeliveries).toBe(1)
    expect(recovered.slot?.wakeSequence).toBe(1)
  })

  it('the message is sitting there unclaimed: adopt it, send nothing', () => {
    const reserved = drive([ev.request('fp-a')])
    const recovered = reduceWakeSlot(reserved.slot, ev.recovery('unclaimed', 'msg-1'), ctx())
    expect(recovered.effects).toEqual([])
    expect(recovered.slot?.phase).toBe('queued')
    expect(recovered.slot?.messageId).toBe('msg-1')
  })

  it('the message was claimed by turn 9 while we were down: run it, re-send nothing', () => {
    const queued = drive([ev.request('fp-a'), ev.accepted(wakeId, 'msg-1')])
    const recovered = reduceWakeSlot(queued.slot, ev.recovery('claimed', 'msg-1', 9), ctx())
    expect(recovered.slot?.phase).toBe('running')
    expect(recovered.slot?.claimedTurn).toBe(9)
    expect(recovered.effects.map((e) => e.kind)).toEqual(['observe-turn'])
    expect(delivers(recovered.effects as Drive['effects'])).toEqual([])
  })

  it('the message is gone and a turn was in flight: absence is not proof of completion', () => {
    const running = drive([ev.request('fp-a'), ev.accepted(wakeId, 'msg-1'), ev.claimed(wakeId, 'msg-1', 7)])
    const recovered = reduceWakeSlot(running.slot, ev.recovery('absent'), ctx())
    expect(recovered.effects).toEqual([])
    expect(recovered.slot?.phase).toBe('running')
  })

  it('re-delivery is budgeted, and the budget suspends rather than hammering the host', () => {
    let slot: WakeSlot | null = drive([ev.request('fp-a')]).slot
    const sends: number[] = []
    for (let i = 0; i < 6; i += 1) {
      const next = reduceWakeSlot(slot, ev.recovery('absent'), ctx())
      slot = next.slot
      if (next.effects.some((e) => e.kind === 'deliver-wake')) sends.push(i)
      if (next.slot?.phase === 'suspended') break
    }
    expect(sends).toHaveLength(LIMITS.maxRedeliveries)
    expect(slot?.phase).toBe('suspended')
    expect(slot?.suspendReason).toBe('redeliver-budget')
  })

  it('the fold lines slots up with facts and emits one recovery event per live slot, in key order', () => {
    const wake1 = deriveWakeId({ ...KEY, wakeSequence: 1 })
    const live = drive([ev.request('fp-a'), ev.accepted(wake1, 'msg-1')]).slot as WakeSlot
    const otherSlot = reduceWakeSlot(
      createWakeSlot(OTHER, ctx(), { leaseEpoch: 1, writerToken: 'writer-a' }),
      { ...ev.request('fp-other'), key: OTHER },
      ctx(),
    ).slot as WakeSlot
    const stopped = reduceWakeSlot(live, ev.stop('user-stop'), ctx())
    const drained = drive([ev.request('fp-a'), ev.accepted(wake1, 'msg-1'), ev.claimed(wake1, 'msg-1', 7), ev.turnEnded(wake1, 7), ev.scan(false, null)])
    const facts: WakeInboxFact[] = [
      { key: OTHER, inbox: 'absent', messageId: null, turn: null },
      { key: KEY, inbox: 'unclaimed', messageId: 'msg-1', turn: null },
      { key: { ...KEY, sessionGeneration: 9 }, inbox: 'unclaimed', messageId: 'msg-orphan', turn: null },
    ]
    const report = reconcileWakeSlots({
      slots: [otherSlot, live, stopped.slot as WakeSlot, drained.slot as WakeSlot],
      facts,
      ctx: ctx(),
      fence: { leaseEpoch: 1, writerToken: 'writer-a' },
    })
    // Deterministic order, one event each, and the plans carry the revision the CAS must expect.
    expect(report.plans.map((p) => [p.key.reviewerInstanceId, p.expectedRevision, p.events.map((e) => e.kind)])).toEqual([
      ['inst-officer-1', 2, ['recovery-observed']],
      ['inst-officer-2', 1, ['recovery-observed']],
    ])
    expect(report.suspended.map((k) => k.reviewerInstanceId)).toEqual(['inst-officer-1'])
    expect(report.released.map((k) => k.reviewerInstanceId)).toEqual(['inst-officer-1'])
    expect(report.orphanFacts.map((f) => f.messageId)).toEqual(['msg-orphan'])
    expect(report.unobserved).toEqual([])
    expect(report.rejected).toEqual([])
  })

  it('the fold invents nothing: a live slot with no observation is reported, not guessed at', () => {
    const live = drive([ev.request('fp-a')]).slot as WakeSlot
    const report = reconcileWakeSlots({ slots: [live], facts: [], ctx: ctx(), fence: { leaseEpoch: 1, writerToken: 'writer-a' } })
    expect(report.plans).toEqual([])
    expect(report.unobserved).toEqual([KEY])
  })

  it('driving the fold\'s events through the reducer produces exactly the reducer\'s own decisions', () => {
    const live = drive([ev.request('fp-a')]).slot as WakeSlot
    const report = reconcileWakeSlots({ slots: [live], facts: [{ key: KEY, inbox: 'unclaimed', messageId: 'msg-1', turn: null }], ctx: ctx(), fence: { leaseEpoch: 1, writerToken: 'writer-a' } })
    let slot: WakeSlot | null = live
    const effects = []
    for (const plan of report.plans) {
      expect(plan.expectedRevision).toBe(live.revision)
      for (const event of plan.events) {
        const next = reduceWakeSlot(slot, event, ctx())
        slot = next.slot
        effects.push(...next.effects)
      }
    }
    expect(slot?.phase).toBe('queued')
    expect(effects).toEqual([])
  })
})

// --- leg 9 ---------------------------------------------------------------------------------------------

describe('a6-pr3 leg 9 — the store key is the triple, so creation is a CAS and not a hopeful look', () => {
  interface Row { readonly key: string; readonly slot: WakeSlot }
  class Store {
    private readonly rows = new Map<string, Row>()
    load(key: WakeSlotKey): WakeSlot | null {
      return this.rows.get(JSON.stringify(canonicalJsonStringify([key.rootSessionId, key.reviewerInstanceId, key.sessionGeneration])))?.slot ?? null
    }
    cas(key: WakeSlotKey, expectedRevision: number, next: WakeSlot): boolean {
      const text = JSON.stringify(canonicalJsonStringify([key.rootSessionId, key.reviewerInstanceId, key.sessionGeneration]))
      const current = this.rows.get(text)
      if ((current?.slot.revision ?? 0) !== expectedRevision) return false
      this.rows.set(text, { key: text, slot: next })
      return true
    }
    get size(): number {
      return this.rows.size
    }
  }

  it('two writers who both saw "no slot" end with exactly one slot and one wake', () => {
    const store = new Store()
    const outcomes: boolean[] = []
    // Writer A and writer B both load nothing, both reduce a first request, both try to commit.
    const a = reduceWakeSlot(store.load(KEY), ev.request('fp-a'), ctx())
    const b = reduceWakeSlot(store.load(KEY), { ...ev.request('fp-b'), writerToken: 'writer-b' }, ctx())
    outcomes.push(store.cas(KEY, 0, a.slot as WakeSlot))
    outcomes.push(store.cas(KEY, 0, b.slot as WakeSlot))
    expect(outcomes).toEqual([true, false])
    expect(store.size).toBe(1)

    // The loser re-runs against the winner. Its own wake is gone — that is the point — and the request
    // survives as a merge on the slot that won.
    const winner = store.load(KEY) as WakeSlot
    const retry = reduceWakeSlot(winner, { ...ev.request('fp-b'), writerToken: 'writer-b' }, ctx())
    expect(retry.refusal).toBe('WAKE_FOREIGN_WRITER')
    // ...which is why the adapter must re-bind its fence on a takeover rather than retry with a foreign
    // token. With the epoch raised (a real restart), the retry lands as a merge and emits no second wake:
    const takeover = reduceWakeSlot(winner, { ...ev.request('fp-b'), leaseEpoch: 2, writerToken: 'writer-b' }, ctx())
    expect(takeover.refusal).toBeNull()
    expect(takeover.effects).toEqual([])
    expect(takeover.slot?.dirty).toBe(true)
    expect(takeover.slot?.wakeSequence).toBe(1)
    expect(delivers(takeover.effects as Drive['effects'])).toEqual([])
    expect(store.cas(KEY, winner.revision, takeover.slot as WakeSlot)).toBe(true)
  })

  it('a CAS loss discards the whole transition, so the slot never holds two outstanding wakes', () => {
    const store = new Store()
    const first = reduceWakeSlot(null, ev.request('fp-a'), ctx())
    expect(store.cas(KEY, 0, first.slot as WakeSlot)).toBe(true)
    const wakeId = deriveWakeId({ ...KEY, wakeSequence: 1 })
    const acceptedFirst = reduceWakeSlot(store.load(KEY), ev.accepted(wakeId, 'msg-1'), ctx())
    const stale = reduceWakeSlot(store.load(KEY), ev.turnEnded(wakeId, 7), ctx())
    expect(stale.refusal).toBe('WAKE_TURN_MISMATCH')
    expect(store.cas(KEY, 5, stale.slot as WakeSlot)).toBe(false)
    // The expected revision is what the adapter LOADED, not what a losing transition invented.
    expect(store.cas(KEY, (store.load(KEY) as WakeSlot).revision, acceptedFirst.slot as WakeSlot)).toBe(true)
    expect((store.load(KEY) as WakeSlot).phase).toBe('queued')
  })
})

// --- leg 10 --------------------------------------------------------------------------------------------

describe('a6-pr3 leg 10 — fencing: a superseded writer changes nothing (SF: no stale revival)', () => {
  it('a lower epoch is refused outright and the slot is returned by reference', () => {
    const wakeId = deriveWakeId({ ...KEY, wakeSequence: 1 })
    const run = drive([ev.request('fp-a'), ev.accepted(wakeId, 'msg-1')])
    const stale = reduceWakeSlot(run.slot, { ...ev.claimed(wakeId, 'msg-1', 7), leaseEpoch: 0 }, ctx())
    expect(stale.refusal).toBe('WAKE_STALE_LEASE')
    expect(stale.slot).toBe(run.slot)
    expect(stale.effects).toEqual([])
  })

  it('the same epoch with a different token is a foreign writer, not a co-worker', () => {
    const run = drive([ev.request('fp-a')])
    const foreign = reduceWakeSlot(run.slot, { ...ev.request('fp-b'), writerToken: 'writer-z' }, ctx())
    expect(foreign.refusal).toBe('WAKE_FOREIGN_WRITER')
    expect(foreign.slot).toBe(run.slot)
  })

  it('a higher epoch takes the slot over and re-binds the token, advancing the revision as it does', () => {
    const run = drive([ev.request('fp-a')])
    const takeover = reduceWakeSlot(run.slot, { ...ev.request('fp-b'), leaseEpoch: 2, writerToken: 'writer-b' }, ctx())
    expect(takeover.slot?.leaseEpoch).toBe(2)
    expect(takeover.slot?.writerToken).toBe('writer-b')
    // Monotone, not "+1": a takeover is two state changes (re-bind, then transition) and the CAS contract
    // is on the loaded revision. A step-size assertion here would pin an implementation detail.
    expect(takeover.slot!.revision).toBeGreaterThan(run.slot!.revision)
    // The old writer is outside the fence twice over — a lower epoch AND a different token — and the epoch
    // check answers first, which is the stronger of the two statements about it.
    const tooLate = reduceWakeSlot(takeover.slot, ev.request('fp-c'), ctx())
    expect(tooLate.refusal).toBe('WAKE_STALE_LEASE')
    // A stranger at the NEW epoch is refused too, by the token check.
    const stranger = reduceWakeSlot(takeover.slot, { ...ev.request('fp-c'), leaseEpoch: 2, writerToken: 'writer-c' }, ctx())
    expect(stranger.refusal).toBe('WAKE_FOREIGN_WRITER')
  })
})

// --- leg 11 --------------------------------------------------------------------------------------------

describe('a6-pr3 leg 11 — no progress, no storm (the bound is state, not vigilance)', () => {
  it('identical pending work across cycles ends in suspension and the wake count stops growing', () => {
    // One cycle = the reviewer is woken, claims, finishes its turn, and the authoritative side reports the
    // SAME pending work. Three of those is LIMITS.noProgressLimit + 1 attempts, then silence.
    let slot: WakeSlot | null = null
    let turn = 7
    let wakeCount = 0
    const phases: string[] = []
    for (let cycle = 1; cycle <= 8; cycle += 1) {
      const sent = slot === null
        ? reduceWakeSlot(null, ev.request('fp-same'), ctx())
        : reduceWakeSlot(slot, ev.timer(slot.notBeforeIso as string), ctx())
      slot = sent.slot
      wakeCount += sent.effects.filter((e) => e.kind === 'deliver-wake').length
      if (slot?.phase === 'suspended') break
      const wakeId = slot?.wakeId as string
      slot = reduceWakeSlot(slot, ev.accepted(wakeId, `msg-${cycle}`), ctx()).slot
      slot = reduceWakeSlot(slot, ev.claimed(wakeId, `msg-${cycle}`, turn), ctx()).slot
      slot = reduceWakeSlot(slot, ev.turnEnded(wakeId, turn), ctx()).slot
      const scanned = reduceWakeSlot(slot, ev.scan(true, 'fp-same'), ctx())
      slot = scanned.slot
      phases.push(String(slot?.phase))
      expect(scanned.effects).toEqual([]) // no cycle may emit at the moment it discovers "nothing changed"
      if (slot?.phase === 'suspended') break
      turn += 1
    }
    expect(slot?.phase).toBe('suspended')
    expect(slot?.suspendReason).toBe('no-progress')
    expect(slot?.noProgressCycles).toBe(LIMITS.noProgressLimit + 1)
    expect(phases).toEqual(['backoff', 'backoff', 'suspended'])
    // Exactly one wake per cycle that was allowed to happen, and zero after the bound. A reducer that kept
    // waking forever would report a larger number here, which is the whole point of the leg.
    expect(wakeCount).toBe(3)
  })

  it('an eager timer cannot shorten the floor, and a floor-honouring timer can proceed', () => {
    const wakeId = deriveWakeId({ ...KEY, wakeSequence: 1 })
    const refused = drive([ev.request('fp-a'), ev.refused(wakeId)])
    const notBefore = refused.slot?.notBeforeIso as string
    expect(notBefore).toBe('2026-10-30T12:00:01.000Z')
    const early = reduceWakeSlot(refused.slot, ev.timer('2026-10-30T12:00:00.500Z'), ctx())
    expect(early.refusal).toBe('WAKE_BACKOFF_PENDING')
    expect(early.slot).toBe(refused.slot)
    const onTime = reduceWakeSlot(refused.slot, ev.timer(notBefore), ctx())
    expect(onTime.refusal).toBeNull()
    expect(onTime.slot?.phase).toBe('reserved')
    // Same identity: a re-delivery is the same wake, which is what lets recovery recognise it.
    expect(delivers(onTime.effects as Drive['effects']).map((e) => e.wakeId)).toEqual([wakeId])
  })

  it('backoff geometry is min(base * 2^(n-1), cap), never negative and never unbounded', () => {
    const wakeId = deriveWakeId({ ...KEY, wakeSequence: 1 })
    // A retry cycle is: refuse from `reserved`, read the floor that refusal set, let the adapter's timer
    // fire AT that floor, and the slot is `reserved` again for the next attempt. Floors are read from the
    // refusal that set them — reading the previous iteration's floor is how this leg once passed for the
    // wrong reason.
    const floors: (string | null)[] = []
    let slot: WakeSlot | null = reduceWakeSlot(null, ev.request('fp-a'), ctx()).slot
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const refusedAgain = reduceWakeSlot(slot, ev.refused(wakeId), ctx())
      expect(refusedAgain.refusal, `attempt ${attempt} must refuse a real delivery from a reserved slot`).toBeNull()
      const floor = refusedAgain.slot?.notBeforeIso ?? null
      floors.push(floor)
      slot = refusedAgain.slot
      if (floor === null) break // the budget suspended the slot; there is no timer left to fire
      const timed = reduceWakeSlot(slot, ev.timer(floor), ctx())
      expect(timed.refusal).toBeNull()
      slot = timed.slot
      expect(slot?.phase).toBe('reserved')
    }
    expect(floors).toEqual(['2026-10-30T12:00:01.000Z', '2026-10-30T12:00:02.000Z', null])

    // With a generous budget the geometric series runs until the cap and stays there: no negative deadline
    // (which would mean "wake immediately, forever") and no unbounded one.
    const wide: WakeContext = { nowIso: NOW, limits: { maxRedeliveries: 100, noProgressLimit: 100, backoff: { baseMs: 1000, capMs: 8000 } } }
    let broad: WakeSlot | null = reduceWakeSlot(null, ev.request('fp-a'), wide).slot
    let lastFloor: string | null = null
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      const refusedAgain = reduceWakeSlot(broad, ev.refused(wakeId), wide)
      expect(refusedAgain.refusal).toBeNull()
      lastFloor = refusedAgain.slot?.notBeforeIso ?? null
      expect(Date.parse(lastFloor as string)).toBeGreaterThanOrEqual(Date.parse(NOW))
      const timer = reduceWakeSlot(refusedAgain.slot, ev.timer(lastFloor as string), wide)
      expect(timer.refusal).toBeNull()
      broad = timer.slot
    }
    expect(lastFloor).toBe('2026-10-30T12:00:08.000Z')
    expect(broad?.phase).toBe('reserved')
    expect(broad?.redeliveries).toBe(12)
  })
})

// --- leg 12 --------------------------------------------------------------------------------------------

describe('a6-pr3 leg 12 — determinism, and wake identity is a function of the tuple alone', () => {
  const sequence = [
    ev.request('fp-a'),
    ev.accepted(deriveWakeId({ ...KEY, wakeSequence: 1 }), 'msg-1'),
    ev.claimed(deriveWakeId({ ...KEY, wakeSequence: 1 }), 'msg-1', 7),
    ev.turnEnded(deriveWakeId({ ...KEY, wakeSequence: 1 }), 7),
    ev.scan(true, 'fp-b'),
  ]

  it('the same sequence twice gives byte-identical state and effects', () => {
    const first = drive(sequence)
    const second = drive(sequence)
    expect(JSON.stringify(first.slot)).toBe(JSON.stringify(second.slot))
    expect(JSON.stringify(first.effects)).toBe(JSON.stringify(second.effects))
    expect(first.revisions).toEqual(second.revisions)
  })

  it('the wake id is the published digest of the tuple, recomputed here independently', () => {
    const expected = `wake-${createHash('sha256').update(canonicalJsonStringify(['team-root-01', 'inst-officer-1', 4, 1])).digest('hex')}`
    expect(deriveWakeId({ ...KEY, wakeSequence: 1 })).toBe(expected)
    // And the digest is a function of the tuple only: same tuple in a fresh call, same id.
    expect(deriveWakeId({ rootSessionId: 'team-root-01', reviewerInstanceId: 'inst-officer-1', sessionGeneration: 4, wakeSequence: 1 })).toBe(expected)
    for (const changed of [
      { ...KEY, wakeSequence: 2 },
      { ...KEY, reviewerInstanceId: 'inst-officer-2', wakeSequence: 1 },
      { ...KEY, sessionGeneration: 5, wakeSequence: 1 },
      { rootSessionId: 'team-root-02', reviewerInstanceId: 'inst-officer-1', sessionGeneration: 4, wakeSequence: 1 },
    ]) {
      expect(deriveWakeId(changed)).not.toBe(expected)
    }
  })

  it('a malformed tuple is a programmer error loudly, and the reducer is not reachable by one', () => {
    // `deriveWakeId` is exported for adapters and tests, and it refuses to hash `undefined` silently. It
    // throws rather than returning null because every internal call site is already validated: a slot
    // reaches it only through `createWakeSlot`/`hydrateWakeSlot`, both of which reject a malformed key
    // before any id is derived. The reducer therefore has no path into this throw from external input —
    // the leg below is what keeps that claim honest rather than merely asserted.
    expect(() => deriveWakeId({} as never)).toThrow()
    expect(() => reduceWakeSlot(null, { ...FENCE, kind: 'request', workFingerprint: 'fp', key: { rootSessionId: 'r', reviewerInstanceId: 'i' } } as never, ctx())).not.toThrow()
  })

  it('the wake text is a pointer and a token, and carries no authority whatever (L-1)', () => {
    const text = composeWakeText(deriveWakeId({ ...KEY, wakeSequence: 1 }))
    const run = drive([ev.request('fp-a')])
    expect(delivers(run.effects)[0]?.text).toBe(text)
    for (const forbidden of ['allow', 'deny', 'force', 'approve', 'mandate', 'grant', 'effectScope', 'caseId', 'approvalCase']) {
      expect(text.toLowerCase(), `wake text must not carry ${forbidden}`).not.toContain(forbidden.toLowerCase())
    }
    expect(text).toContain(deriveWakeId({ ...KEY, wakeSequence: 1 }))
  })
})

// --- leg 14 --------------------------------------------------------------------------------------------

describe('a6-pr3 leg 14 — a trusted false negative costs latency, never the flight', () => {
  it('after a released slot, the next request for the same triple reserves and delivers again', () => {
    const wakeId = deriveWakeId({ ...KEY, wakeSequence: 1 })
    const released = drive([
      ev.request('fp-a'),
      ev.accepted(wakeId, 'msg-1'),
      ev.claimed(wakeId, 'msg-1', 7),
      ev.turnEnded(wakeId, 7),
      ev.scan(false, null), // the port lied, successfully
    ])
    expect(released.slot?.phase).toBe('idle')
    expect(delivers(released.effects)).toHaveLength(1)
    const rearmed = reduceWakeSlot(released.slot, ev.request('fp-a'), ctx())
    expect(rearmed.refusal).toBeNull()
    expect(rearmed.slot?.phase).toBe('reserved')
    expect(delivers(rearmed.effects as Drive['effects'])).toHaveLength(1)
    expect(rearmed.slot?.wakeId).toBe(deriveWakeId({ ...KEY, wakeSequence: 2 }))
  })

  it('a "nothing ready" answer that arrived while work was landing is discarded, not released', () => {
    const wakeId = deriveWakeId({ ...KEY, wakeSequence: 1 })
    const run = drive([
      ev.request('fp-a'),
      ev.accepted(wakeId, 'msg-1'),
      ev.claimed(wakeId, 'msg-1', 7),
      ev.request('fp-b'),
      ev.turnEnded(wakeId, 7),
      ev.scan(false, null),
    ])
    // Not idle: the scan's answer describes a world that has already moved on.
    expect(run.slot?.phase).toBe('backoff')
    expect(run.slot?.noProgressCycles).toBe(1)
    const after = reduceWakeSlot(run.slot, ev.timer(run.slot?.notBeforeIso as string), ctx())
    expect(after.slot?.phase).toBe('reconciling')
    expect(after.effects.map((e) => e.kind)).toEqual(['scan-work'])
  })
})

// --- leg 15 --------------------------------------------------------------------------------------------

describe('a6-pr3 leg 15 — a slot is trustworthy only if this module made it', () => {
  const row = () => ({
    key: { ...KEY },
    phase: 'queued',
    revision: 4,
    leaseEpoch: 1,
    writerToken: 'writer-a',
    wakeSequence: 1,
    wakeId: deriveWakeId({ ...KEY, wakeSequence: 1 }),
    messageId: 'msg-1',
    claimedTurn: null,
    dirty: false,
    noProgressCycles: 0,
    redeliveries: 0,
    lastWorkFingerprint: 'fp-a',
    notBeforeIso: null,
    suspendReason: null,
    lastEventIso: NOW,
  })

  it('hydration accepts a valid row and hands back a frozen copy, not the caller\'s object', () => {
    const raw = row()
    const hydrated = hydrateWakeSlot(raw)
    expect(hydrated.ok).toBe(true)
    if (!hydrated.ok) return
    expect(hydrated.slot).not.toBe(raw)
    expect(Object.isFrozen(hydrated.slot)).toBe(true)
    expect(Object.isFrozen(hydrated.slot.key)).toBe(true)
    raw.messageId = 'msg-tampered'
    expect(hydrated.slot.messageId).toBe('msg-1')
  })

  it.each<[string, () => unknown]>([
    ['a phase from outside the vocabulary', () => ({ ...row(), phase: 'awake' })],
    ['a fractional revision', () => ({ ...row(), revision: 1.5 })],
    ['a negative epoch', () => ({ ...row(), leaseEpoch: -1 })],
    ['a blank writer token', () => ({ ...row(), writerToken: '  ' })],
    ['a claimed turn as a string', () => ({ ...row(), claimedTurn: '7' })],
    ['a wake id that is the empty string', () => ({ ...row(), wakeId: '' })],
    ['a suspend reason nobody defined', () => ({ ...row(), suspendReason: 'because-i-said-so' })],
    ['a key naming a different generation type', () => ({ ...row(), key: { ...KEY, sessionGeneration: '4' } })],
    ['a missing field', () => { const copy = row(); delete (copy as Record<string, unknown>).noProgressCycles; return copy }],
    ['an array', () => [row()]],
    ['null', () => null],
  ])('rejects %s without producing a usable slot', (_label, build) => {
    const result = hydrateWakeSlot(build())
    expect(result.ok).toBe(false)
  })

  it('an unbranded look-alike is refused, changed nothing, and cannot reach a withdrawal', () => {
    const hydrated = hydrateWakeSlot(row())
    if (!hydrated.ok) throw new Error('fixture must hydrate')
    const lookAlikes: WakeSlot[] = [
      { ...hydrated.slot },
      Object.freeze({ ...hydrated.slot }),
      Object.assign(Object.create(null), hydrated.slot) as WakeSlot,
      Object.defineProperties(Object.create(Object.prototype), Object.getOwnPropertyDescriptors(hydrated.slot)) as WakeSlot,
      JSON.parse(JSON.stringify(hydrated.slot)) as WakeSlot,
    ]
    for (const fake of lookAlikes) {
      const result = reduceWakeSlot(fake, ev.withdraw(), ctx())
      expect(result.refusal).toBe('WAKE_SLOT_UNBRANDED')
      expect(result.effects).toEqual([])
      expect(result.slot).toBe(fake)
    }
    // The specific thing the brand is for: a slot with a fabricated message id must never authorise a
    // deletion, because `withdraw-wake` carries an id an adapter deletes by.
    const forged = hydrateWakeSlot({ ...row(), messageId: 'a-human-s-message' })
    expect(forged.ok).toBe(true)
  })

  it('createWakeSlot mints a branded slot that the reducer accepts', () => {
    const fresh = createWakeSlot(KEY, ctx(), { leaseEpoch: 1, writerToken: 'writer-a' })
    expect(fresh.phase).toBe('idle')
    expect(fresh.revision).toBe(0)
    const run = reduceWakeSlot(fresh, ev.request('fp-a'), ctx())
    expect(run.refusal).toBeNull()
    expect(delivers(run.effects as Drive['effects'])).toHaveLength(1)
  })
})

// --- leg 16 --------------------------------------------------------------------------------------------

describe('a6-pr3 leg 16 — an event about the wrong triple is refused, however valid its fence', () => {
  it('a mis-routed event changes nothing, at every phase', () => {
    const nullState = reduceWakeSlot(null, { ...ev.withdraw(), key: OTHER }, ctx())
    expect(nullState.refusal).toBe('WAKE_NO_SLOT')
    expect(nullState.slot).toBeNull()
    const states: (WakeSlot | null)[] = [
      drive([ev.request('fp-a')]).slot,
      drive([ev.request('fp-a'), ev.accepted(deriveWakeId({ ...KEY, wakeSequence: 1 }), 'msg-1')]).slot,
    ]
    for (const state of states) {
      const misrouted = reduceWakeSlot(state, { ...ev.request('fp-a'), key: OTHER }, ctx())
      expect(misrouted.refusal, `phase ${String(state?.phase ?? 'null')}`).toBe(state === null ? 'WAKE_NO_SLOT' : 'WAKE_KEY_MISMATCH')
      expect(misrouted.effects).toEqual([])
      expect(misrouted.slot).toBe(state)
    }
  })

  it('a first request with a malformed key is refused rather than defaulting to somebody', () => {
    const malformedKeys: ReadonlyArray<Record<string, unknown>> = [
      {},
      { rootSessionId: '', reviewerInstanceId: 'x', sessionGeneration: 1 },
      { rootSessionId: 'r', reviewerInstanceId: 'x', sessionGeneration: 1.5 },
      { rootSessionId: 'r', reviewerInstanceId: 'x' },
    ]
    for (const bad of malformedKeys) {
      // `as unknown as`, not a direct cast: tsc is right that these rows are not WakeEvents, which is
      // precisely what the leg is feeding the reducer.
      const result = reduceWakeSlot(null, { ...ev.request('fp-a'), key: bad } as unknown as WakeEvent, ctx())
      expect(result.refusal).toBe('WAKE_EVENT_MALFORMED')
      expect(result.slot).toBeNull()
    }
  })
})

// --- the fail-closed floor: malformed input answers a code, it does not throw ----------------------------

function row(): Record<string, unknown> {
  return {
    key: { ...KEY },
    phase: 'queued',
    revision: 2,
    leaseEpoch: 1,
    writerToken: 'writer-a',
    wakeSequence: 1,
    wakeId: deriveWakeId({ ...KEY, wakeSequence: 1 }),
    messageId: 'msg-1',
    claimedTurn: null,
    dirty: false,
    noProgressCycles: 0,
    redeliveries: 0,
    lastWorkFingerprint: null,
    notBeforeIso: null,
    suspendReason: null,
    lastEventIso: NOW,
  }
}

describe('a6-pr3 — malformed anything answers a closed code (the PR0 lesson, applied before it hurts)', () => {
  const hydrated = hydrateWakeSlot({
    key: { ...KEY },
    phase: 'queued',
    revision: 2,
    leaseEpoch: 1,
    writerToken: 'writer-a',
    wakeSequence: 1,
    wakeId: deriveWakeId({ ...KEY, wakeSequence: 1 }),
    messageId: 'msg-1',
    claimedTurn: null,
    dirty: false,
    noProgressCycles: 0,
    redeliveries: 0,
    lastWorkFingerprint: null,
    notBeforeIso: null,
    suspendReason: null,
    lastEventIso: NOW,
  })
  const slot = hydrated.ok ? hydrated.slot : null

  it.each<[string, () => unknown]>([
    ['a null event against no slot', () => reduceWakeSlot(null, null as unknown as WakeEvent, ctx())],
    ['an undefined event against a slot', () => reduceWakeSlot(slot, undefined as unknown as WakeEvent, ctx())],
    ['a string event', () => reduceWakeSlot(slot, 'request' as unknown as WakeEvent, ctx())],
    ['an array event', () => reduceWakeSlot(slot, [] as unknown as WakeEvent, ctx())],
    ['an unknown kind', () => reduceWakeSlot(slot, { ...FENCE, kind: 'wake-me-now' } as unknown as WakeEvent, ctx())],
    ['a missing fence', () => reduceWakeSlot(slot, { key: KEY, kind: 'request', workFingerprint: 'fp' } as unknown as WakeEvent, ctx())],
    ['a request without a fingerprint', () => reduceWakeSlot(null, { ...FENCE, kind: 'request' } as unknown as WakeEvent, ctx())],
    ['a claimed event with a string turn', () => reduceWakeSlot(slot, { ...FENCE, kind: 'claimed', wakeId: 'w', messageId: 'm', turn: '7' } as unknown as WakeEvent, ctx())],
    ['a scan whose answer is a string', () => reduceWakeSlot(slot, { ...FENCE, kind: 'work-scan-completed', hasReadyWork: 'yes', workFingerprint: null } as unknown as WakeEvent, ctx())],
    ['a timer with a non-instant', () => reduceWakeSlot(slot, { ...FENCE, kind: 'timer-elapsed', deadlineIso: 'tomorrow' } as unknown as WakeEvent, ctx())],
    ['a recovery observation of an unknown inbox', () => reduceWakeSlot(slot, { ...FENCE, kind: 'recovery-observed', inbox: 'maybe', messageId: null, turn: null } as unknown as WakeEvent, ctx())],
    ['a null context', () => reduceWakeSlot(slot, ev.request('fp'), null as unknown as WakeContext)],
    ['a context with no limits', () => reduceWakeSlot(slot, ev.request('fp'), { nowIso: NOW } as unknown as WakeContext)],
    ['a context whose clock is unreadable', () => reduceWakeSlot(slot, ev.request('fp'), { nowIso: 'whenever', limits: LIMITS })],
    ['a context with an unbounded redelivery budget', () => reduceWakeSlot(slot, ev.request('fp'), { nowIso: NOW, limits: { ...LIMITS, maxRedeliveries: Number.NaN } })],
    ['a context whose backoff cap is below its base', () => reduceWakeSlot(slot, ev.request('fp'), { nowIso: NOW, limits: { ...LIMITS, backoff: { baseMs: 5000, capMs: 1000 } } })],
    ['a slot that is a bare object', () => reduceWakeSlot({} as WakeSlot, ev.withdraw(), ctx())],
  ])('%s is refused, never thrown', (_label, run) => {
    expect(run).not.toThrow()
    const result = run() as { refusal: string | null }
    expect(result.refusal).not.toBeNull()
  })

  it('the refusal codes the kernel can produce are exactly the published vocabulary', () => {
    // Same discipline as PR0's round-2 finding: a type-level union proves nothing to a JS adapter that
    // switches on strings, so the produced set is pinned against the published list at runtime.
    const produced = new Set<string>()
    const probe = (result: { refusal: string | null }) => {
      if (result.refusal !== null) produced.add(result.refusal)
    }
    probe(reduceWakeSlot(null, null as unknown as WakeEvent, ctx()))
    probe(reduceWakeSlot(null, { ...FENCE, kind: 'nope' } as unknown as WakeEvent, ctx()))
    probe(reduceWakeSlot(null, ev.request('fp'), { nowIso: 'whenever', limits: LIMITS }))
    probe(reduceWakeSlot(null, ev.request('fp'), { nowIso: NOW, limits: { maxRedeliveries: 1, noProgressLimit: 1, backoff: { baseMs: 5, capMs: 1 } } }))
    probe(reduceWakeSlot(null, ev.scan(true, null), ctx()))
    probe(reduceWakeSlot(null, { ...ev.request('fp'), key: {} as unknown as WakeSlotKey }, ctx()))
    probe(reduceWakeSlot({} as WakeSlot, ev.request('fp'), ctx()))
    probe(reduceWakeSlot(slot, { ...ev.request('fp'), key: OTHER }, ctx()))
    probe(reduceWakeSlot(slot, { ...ev.request('fp'), leaseEpoch: 0 }, ctx()))
    probe(reduceWakeSlot(slot, { ...ev.request('fp'), writerToken: 'other' }, ctx()))
    probe(reduceWakeSlot(slot, ev.request('fp'), ctx()))
    probe(reduceWakeSlot(slot, ev.turnEnded('wake-nope', 3), ctx()))
    probe(reduceWakeSlot(slot, ev.turnEnded(deriveWakeId({ ...KEY, wakeSequence: 1 }), 99), ctx()))
    probe(reduceWakeSlot(slot, ev.scan(true, null), ctx()))
    probe(reduceWakeSlot(slot, ev.withdraw(), ctx()) && reduceWakeSlot(drive([ev.request('fp')]).slot, ev.withdraw(), ctx()))
    probe(reduceWakeSlot(slot, ev.timer(NOW), ctx()))
    const ours = drive([ev.request('fp'), ev.accepted(deriveWakeId({ ...KEY, wakeSequence: 1 }), 'msg-1')])
    probe(reduceWakeSlot(ours.slot, ev.recovery('unclaimed', 'msg-2'), ctx()))
    const backingOff = drive([ev.request('fp'), ev.refused(deriveWakeId({ ...KEY, wakeSequence: 1 }))])
    probe(reduceWakeSlot(backingOff.slot, ev.timer('2026-01-01T00:00:00.000Z'), ctx()))
    const stopped = reduceWakeSlot(slot, ev.stop('user-stop'), ctx())
    probe(reduceWakeSlot(stopped.slot, ev.request('fp'), ctx()))
    const published = new Set([
      'WAKE_EVENT_MALFORMED', 'WAKE_STALE_LEASE', 'WAKE_FOREIGN_WRITER', 'WAKE_NO_SLOT', 'WAKE_SLOT_SUSPENDED',
      'WAKE_PHASE_UNEXPECTED', 'WAKE_ID_MISMATCH', 'WAKE_TURN_MISMATCH', 'WAKE_FOREIGN_MESSAGE',
      'WAKE_BACKOFF_PENDING', 'WAKE_REDELIVER_BUDGET_EXCEEDED', 'WAKE_TIMESTAMP_INVALID',
      'WAKE_NO_MESSAGE_TO_WITHDRAW', 'WAKE_KEY_MISMATCH', 'WAKE_SLOT_MALFORMED', 'WAKE_SLOT_UNBRANDED',
      'WAKE_CONTEXT_INVALID',
    ])
    for (const code of produced) expect(published.has(code), `${code} is outside the published list`).toBe(true)
    // And every code the kernel actually uses is one a reader of the list could have predicted.
    // 15 of the 16 published codes are reachable by these probes. The one that is not is
    // `WAKE_PHASE_UNEXPECTED`'s neighbour below; a code nobody can reach would be listed here as dead
    // vocabulary, which is the finding PR0's round-3 review made about a sibling package.
    expect([...produced].sort()).toEqual([
      'WAKE_BACKOFF_PENDING', 'WAKE_CONTEXT_INVALID', 'WAKE_EVENT_MALFORMED', 'WAKE_FOREIGN_MESSAGE',
      'WAKE_FOREIGN_WRITER', 'WAKE_ID_MISMATCH', 'WAKE_KEY_MISMATCH', 'WAKE_NO_MESSAGE_TO_WITHDRAW',
      'WAKE_NO_SLOT', 'WAKE_PHASE_UNEXPECTED', 'WAKE_SLOT_SUSPENDED', 'WAKE_SLOT_UNBRANDED',
      'WAKE_STALE_LEASE', 'WAKE_TIMESTAMP_INVALID', 'WAKE_TURN_MISMATCH',
    ])
    // `WAKE_SLOT_MALFORMED` is produced by `hydrateWakeSlot`, not by the reducer, so it is checked where it
    // lives rather than being pretended into the set above.
    expect(hydrateWakeSlot({ ...row(), phase: 'awake' })).toEqual({ ok: false, refusal: 'WAKE_SLOT_MALFORMED' })
  })
})
