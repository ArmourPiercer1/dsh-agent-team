/**
 * Alpha.6 PR3 — ReviewWakeCoordinator focused unit suite.
 *
 * Every acceptance item owned by A6-PR3 is executable here:
 *   - three activations → at most one outstanding wake (single flight);
 *   - arrivals while running only mark dirty; turn-end re-reads exactly once
 *     and at most one fresh wake follows;
 *   - pending-but-unchanged never withdraws a valid wake; only an
 *     authoritative `no-ready-work` scan releases it;
 *   - a repeated scan of the same ready fingerprint never re-wakes;
 *   - a persisted wake is adopted without duplicate delivery, and a wake
 *     from another generation is refused;
 *   - delivery failure releases `queued` for a later activation (no timer);
 *   - Stop is sticky and only explicit resume revives it;
 *   - malformed input/invalid transitions are refused without mutation.
 *
 * Pure unit level: no Host, no I/O, no clock.
 *
 * @module packages/runtime/test/a6-pr3-wake-coordinator.test
 */

import { describe, expect, it } from 'vitest'
import {
  REVIEW_WAKE_ACTIVATION_REASONS,
  REVIEW_WAKE_EVENT_TYPES,
  REVIEW_WAKE_REFUSAL_CODES,
  REVIEW_WAKE_RESCAN_REASONS,
  REVIEW_WAKE_STATUSES,
  REVIEW_WAKE_WITHDRAW_REASONS,
  createReviewWakeCoordinator,
  createReviewWakeState,
  reduceReviewWake,
} from '../review-wake/index.js'
import type {
  PersistedReviewWakeFact,
  ReviewWakeEffect,
  ReviewWakeEvent,
  ReviewWakeKey,
  ReviewWakeState,
  ReviewWakeTransition,
} from '../review-wake/index.js'

type Applied = Extract<ReviewWakeTransition, { outcome: 'applied' }>
type Refused = Extract<ReviewWakeTransition, { outcome: 'refused' }>

const KEY: ReviewWakeKey = Object.freeze({
  rootSessionId: 'root-session-1',
  reviewerInstanceId: 'instance-officer-1',
  sessionGeneration: 1,
})

function start(key: ReviewWakeKey = KEY): ReviewWakeState {
  return createReviewWakeState(key)
}

function applied(transition: ReviewWakeTransition): Applied {
  if (transition.outcome !== 'applied') {
    throw new Error(
      `expected applied, got refusal ${transition.code} in state ${transition.state.status}`,
    )
  }
  return transition
}

function refused(transition: ReviewWakeTransition): Refused {
  if (transition.outcome !== 'refused') {
    throw new Error(
      `expected refusal, got applied with ${transition.effects.length} effect(s)`,
    )
  }
  return transition
}

function reduce(
  state: ReviewWakeState,
  event: ReviewWakeEvent,
): ReviewWakeTransition {
  return reduceReviewWake(state, event)
}

const activate = (reason: 'work-changed' | 'handoff' | 'takeover' = 'work-changed'): ReviewWakeEvent => ({
  type: 'activate',
  reason,
})

const ready = (fingerprint: string): ReviewWakeEvent => ({
  type: 'scan-result',
  work: { kind: 'ready', fingerprint },
})

const nothingReady: ReviewWakeEvent = {
  type: 'scan-result',
  work: { kind: 'no-ready-work' },
}

function effectKinds(effects: readonly ReviewWakeEffect[]): string[] {
  return effects.map((effect) => effect.kind)
}

/** Drive the latch to `queued` for `fingerprint` and return it. */
function queuedFor(fingerprint: string, key: ReviewWakeKey = KEY): Applied {
  const polled = applied(reduce(start(key), activate()))
  expect(effectKinds(polled.effects)).toEqual(['rescan'])
  return applied(reduce(polled.state, ready(fingerprint)))
}

function wakeIdOf(transition: Applied): string {
  const effect = transition.effects.find((e) => e.kind === 'deliver-wake')
  if (effect === undefined || effect.kind !== 'deliver-wake') {
    throw new Error('expected a deliver-wake effect')
  }
  return effect.wakeId
}

describe('A6-PR3 single flight per (rootSessionId, reviewerInstanceId, sessionGeneration)', () => {
  it('three activations while idle coalesce into one rescan path and at most one wake', () => {
    let state = start()
    for (let i = 0; i < 3; i += 1) {
      const step = applied(reduce(state, activate()))
      expect(effectKinds(step.effects)).toEqual(['rescan'])
      expect(step.state.status).toBe('idle')
      state = step.state
    }

    const delivered = applied(reduce(state, ready('A')))
    expect(effectKinds(delivered.effects)).toEqual(['deliver-wake'])
    expect(delivered.state.status).toBe('queued')
    expect(delivered.state.wakeId).toBe(wakeIdOf(delivered))

    // B/C/D arriving while queued: dirty only, never a second wake.
    let queued = delivered.state
    for (let i = 0; i < 3; i += 1) {
      const step = applied(reduce(queued, activate()))
      expect(step.effects).toEqual([])
      expect(step.state.status).toBe('queued')
      expect(step.state.dirty).toBe(true)
      expect(step.state.wakeId).toBe(delivered.state.wakeId)
      queued = step.state
    }
  })

  it('keeps a separate latch per session generation', () => {
    const newerKey: ReviewWakeKey = { ...KEY, sessionGeneration: 2 }
    const older = queuedFor('A', KEY)
    expect(older.state.status).toBe('queued')

    // The newer generation is idle and may wake on its own; the older
    // generation's outstanding wake neither blocks nor leaks into it.
    const newer = start(newerKey)
    const polled = applied(reduce(newer, activate()))
    expect(effectKinds(polled.effects)).toEqual(['rescan'])
    const delivered = applied(reduce(polled.state, ready('A')))
    expect(effectKinds(delivered.effects)).toEqual(['deliver-wake'])
    expect(delivered.state.key.sessionGeneration).toBe(2)
    expect(delivered.state.status).toBe('queued')
    expect(older.state.key.sessionGeneration).toBe(1)
  })
})

describe('A6-PR3 running turn: dirty coalescing and exactly one post-turn re-read', () => {
  it('B/C arrivals while running only mark dirty; turn end emits one rescan and one fresh wake', () => {
    const delivered = queuedFor('A')
    const state = applied(reduce(delivered.state, { type: 'turn-start' })).state
    expect(state.status).toBe('running')

    const b = applied(reduce(state, activate('work-changed')))
    const c = applied(reduce(b.state, activate('handoff')))
    expect(b.effects).toEqual([])
    expect(c.effects).toEqual([])
    expect(c.state.status).toBe('running')
    expect(c.state.dirty).toBe(true)

    const ended = applied(reduce(c.state, { type: 'turn-end' }))
    expect(effectKinds(ended.effects)).toEqual(['rescan'])
    expect(ended.effects[0]).toEqual({
      kind: 'rescan',
      key: KEY,
      reason: 'turn-end',
    })
    expect(ended.state.status).toBe('idle')
    expect(ended.state.wakeId).toBeNull()

    const deliveredAgain = applied(reduce(ended.state, ready('B')))
    expect(effectKinds(deliveredAgain.effects)).toEqual(['deliver-wake'])
    expect(deliveredAgain.state.status).toBe('queued')
    // One wake for the whole A/B/C burst after the first turn.
    expect(deliveredAgain.effects).toHaveLength(1)
  })

  it('does not re-wake when the post-turn re-read shows the same ready work (no progress)', () => {
    const first = queuedFor('A')
    expect(effectKinds(first.effects)).toEqual(['deliver-wake'])

    const state = applied(reduce(first.state, { type: 'turn-start' })).state
    const ended = applied(reduce(state, { type: 'turn-end' }))
    expect(effectKinds(ended.effects)).toEqual(['rescan'])

    const unchanged = applied(reduce(ended.state, ready('A')))
    expect(unchanged.effects).toEqual([])
    expect(unchanged.state.status).toBe('idle')

    // A later automatic poll re-reads the same fingerprint: still no wake.
    const polled = applied(reduce(unchanged.state, { type: 'poll' }))
    expect(effectKinds(polled.effects)).toEqual(['rescan'])
    const stillUnchanged = applied(reduce(polled.state, ready('A')))
    expect(stillUnchanged.effects).toEqual([])
    expect(stillUnchanged.state.status).toBe('idle')
  })

  it('returns to idle with no wake when the post-turn re-read finds no ready work', () => {
    const first = queuedFor('A')
    const state = applied(reduce(first.state, { type: 'turn-start' })).state
    const ended = applied(reduce(state, { type: 'turn-end' }))
    const empty = applied(reduce(ended.state, nothingReady))
    expect(empty.effects).toEqual([])
    expect(empty.state.status).toBe('idle')
    expect(empty.state.observedWorkFingerprint).toBeNull()
  })

  it('does not move the progress baseline for work that changes during the running turn', () => {
    const first = queuedFor('A')
    let state = applied(reduce(first.state, { type: 'turn-start' })).state
    // A mid-turn authoritative read shows new work; it must not be lost as
    // "already seen" when the turn ends.
    state = applied(reduce(state, ready('B'))).state
    expect(state.dirty).toBe(true)
    expect(state.observedWorkFingerprint).toBe('A')
    const ended = applied(reduce(state, { type: 'turn-end' }))
    const after = applied(reduce(ended.state, ready('B')))
    expect(effectKinds(after.effects)).toEqual(['deliver-wake'])
  })
})

describe('A6-PR3 pending vs changed: no withdrawal without authoritative no-work', () => {
  it('pending-but-unchanged does NOT cancel or withdraw the valid queued wake', () => {
    const delivered = queuedFor('A')
    const wakeId = wakeIdOf(delivered)

    const polled = applied(reduce(delivered.state, { type: 'poll' }))
    expect(polled.effects).toEqual([
      { kind: 'rescan', key: KEY, reason: 'poll' },
    ])

    const unchanged = applied(reduce(polled.state, ready('A')))
    expect(unchanged.effects).toEqual([])
    expect(unchanged.state.status).toBe('queued')
    expect(unchanged.state.wakeId).toBe(wakeId)
    expect(unchanged.state.observedWorkFingerprint).toBe('A')
  })

  it('a work change while queued keeps the single generic wake (no second wake)', () => {
    const delivered = queuedFor('A')
    const wakeId = wakeIdOf(delivered)

    const polled = applied(reduce(delivered.state, { type: 'poll' }))
    const changed = applied(reduce(polled.state, ready('B')))
    expect(changed.effects).toEqual([])
    expect(changed.state.status).toBe('queued')
    expect(changed.state.wakeId).toBe(wakeId)
    expect(changed.state.observedWorkFingerprint).toBe('B')

    // The turn sees the latest authority; its post-turn re-read of B is not
    // progress and must not mint another wake.
    const state = applied(reduce(changed.state, { type: 'turn-start' })).state
    const ended = applied(reduce(state, { type: 'turn-end' }))
    const after = applied(reduce(ended.state, ready('B')))
    expect(after.effects).toEqual([])
  })

  it('an authoritative no-ready-work scan withdraws the unclaimed queued wake', () => {
    const delivered = queuedFor('A')
    const wakeId = wakeIdOf(delivered)

    const polled = applied(reduce(delivered.state, { type: 'poll' }))
    const released = applied(reduce(polled.state, nothingReady))
    expect(released.effects).toEqual([
      {
        kind: 'withdraw-wake',
        key: KEY,
        wakeId,
        reason: 'no-ready-work',
      },
    ])
    expect(released.state.status).toBe('idle')
    expect(released.state.wakeId).toBeNull()
    expect(released.state.observedWorkFingerprint).toBeNull()

    // A resolved case cannot justify a new wake.
    const again = applied(reduce(released.state, activate()))
    expect(effectKinds(again.effects)).toEqual(['rescan'])
    const empty = applied(reduce(again.state, nothingReady))
    expect(empty.effects).toEqual([])
    expect(empty.state.status).toBe('idle')
  })
})

describe('A6-PR3 recovery: adopt persisted facts, never duplicate a wake', () => {
  const persistedQueued = (overrides: Partial<PersistedReviewWakeFact> = {}): PersistedReviewWakeFact => ({
    key: KEY,
    status: 'queued',
    wakeId: 'persisted-wake-1',
    workFingerprint: 'A',
    ...overrides,
  })

  it('adopts a persisted queued wake with no deliver effect and no duplicate on activation', () => {
    const recovered = applied(
      reduce(start(), { type: 'recover', persistedWake: persistedQueued() }),
    )
    expect(recovered.effects).toEqual([])
    expect(recovered.state.status).toBe('queued')
    expect(recovered.state.wakeId).toBe('persisted-wake-1')
    expect(recovered.state.observedWorkFingerprint).toBe('A')

    const activated = applied(reduce(recovered.state, activate()))
    expect(activated.effects).toEqual([])
    expect(activated.state.dirty).toBe(true)

    const polled = applied(reduce(activated.state, { type: 'poll' }))
    const unchanged = applied(reduce(polled.state, ready('A')))
    expect(unchanged.effects).toEqual([])
    expect(unchanged.state.wakeId).toBe('persisted-wake-1')
  })

  it('adopts a persisted running wake without an extra wake after its turn ends unchanged', () => {
    const recovered = applied(
      reduce(start(), {
        type: 'recover',
        persistedWake: persistedQueued({ status: 'running' }),
      }),
    )
    expect(recovered.state.status).toBe('running')
    expect(recovered.effects).toEqual([])

    const ended = applied(reduce(recovered.state, { type: 'turn-end' }))
    expect(effectKinds(ended.effects)).toEqual(['rescan'])
    const unchanged = applied(reduce(ended.state, ready('A')))
    expect(unchanged.effects).toEqual([])
  })

  it('starts idle when no persisted wake exists; a later activation may wake once', () => {
    const recovered = applied(
      reduce(start(), { type: 'recover', persistedWake: null }),
    )
    expect(recovered.state.status).toBe('idle')
    expect(recovered.effects).toEqual([])

    const polled = applied(reduce(recovered.state, activate()))
    const delivered = applied(reduce(polled.state, ready('A')))
    expect(delivered.effects).toHaveLength(1)
    expect(effectKinds(delivered.effects)).toEqual(['deliver-wake'])
  })

  it('refuses a persisted wake belonging to another session generation', () => {
    const stale: PersistedReviewWakeFact = {
      key: { ...KEY, sessionGeneration: 2 },
      status: 'queued',
      wakeId: 'older-generation-wake',
      workFingerprint: 'A',
    }
    const before = start()
    const result = refused(
      reduce(before, { type: 'recover', persistedWake: stale }),
    )
    expect(result.code).toBe('key-mismatch')
    expect(result.state).toBe(before)
  })

  it('keeps sticky Stop across recovery and does not adopt an unclaimed queued wake', () => {
    const recovered = applied(
      reduce(start(), {
        type: 'recover',
        persistedWake: persistedQueued(),
        stopped: true,
      }),
    )
    expect(recovered.effects).toEqual([])
    expect(recovered.state.status).toBe('idle')
    expect(recovered.state.stopped).toBe(true)
    expect(recovered.state.wakeId).toBeNull()
  })
})

describe('A6-PR3 delivery failure releases queued exactly once, with no self-retry', () => {
  it('releases queued and lets a later activation retry the same pending work', () => {
    const delivered = queuedFor('A')
    const wakeId = wakeIdOf(delivered)

    const failed = applied(
      reduce(delivered.state, { type: 'delivery-failed', wakeId }),
    )
    expect(failed.effects).toEqual([])
    expect(failed.state.status).toBe('idle')
    expect(failed.state.wakeId).toBeNull()
    expect(failed.state.observedWorkFingerprint).toBeNull()
    expect(failed.state.dirty).toBe(true)

    // No timer/automatic retry: only another activation starts the retry.
    const activated = applied(reduce(failed.state, activate()))
    expect(effectKinds(activated.effects)).toEqual(['rescan'])
    const retried = applied(reduce(activated.state, ready('A')))
    expect(effectKinds(retried.effects)).toEqual(['deliver-wake'])
    expect(retried.state.status).toBe('queued')
  })

  it('refuses a stale delivery failure for a different wake id', () => {
    const delivered = queuedFor('A')
    const before = delivered.state
    const result = refused(
      reduce(before, { type: 'delivery-failed', wakeId: 'some-other-wake' }),
    )
    expect(result.code).toBe('wake-mismatch')
    expect(result.state).toBe(before)
    expect(result.state.status).toBe('queued')
  })

  it('refuses delivery failure outside the queued phase', () => {
    const delivered = queuedFor('A')
    const running = applied(reduce(delivered.state, { type: 'turn-start' }))
    expect(refused(reduce(running.state, { type: 'delivery-failed' })).code).toBe(
      'invalid-transition',
    )
  })
})

describe('A6-PR3 sticky Stop', () => {
  it('withdraws an unclaimed queued wake and blocks automatic revival', () => {
    const delivered = queuedFor('A')
    const wakeId = wakeIdOf(delivered)

    const stopped = applied(reduce(delivered.state, { type: 'stop' }))
    expect(stopped.effects).toEqual([
      { kind: 'withdraw-wake', key: KEY, wakeId, reason: 'stopped' },
    ])
    expect(stopped.state.status).toBe('idle')
    expect(stopped.state.stopped).toBe(true)
    expect(stopped.state.wakeId).toBeNull()

    for (const event of [activate(), { type: 'poll' } as const, ready('A'), nothingReady]) {
      const step = applied(reduce(stopped.state, event))
      expect(step.effects).toEqual([])
      expect(step.state.status).toBe('idle')
      expect(step.state.stopped).toBe(true)
    }
  })

  it('only explicit resume revives the latch and emits one re-read', () => {
    const state = applied(reduce(queuedFor('A').state, { type: 'stop' })).state
    const resumed = applied(reduce(state, { type: 'resume' }))
    expect(resumed.effects).toEqual([
      { kind: 'rescan', key: KEY, reason: 'resume' },
    ])
    expect(resumed.state.stopped).toBe(false)
    expect(resumed.state.status).toBe('idle')

    const delivered = applied(reduce(resumed.state, ready('A')))
    expect(effectKinds(delivered.effects)).toEqual(['deliver-wake'])
    expect(delivered.state.status).toBe('queued')
  })

  it('does not withdraw a claimed running wake; its turn end is silent while stopped', () => {
    const delivered = queuedFor('A')
    const running = applied(reduce(delivered.state, { type: 'turn-start' })).state

    const stopped = applied(reduce(running, { type: 'stop' }))
    expect(stopped.effects).toEqual([])
    expect(stopped.state.status).toBe('running')
    expect(stopped.state.stopped).toBe(true)

    const ended = applied(reduce(stopped.state, { type: 'turn-end' }))
    expect(ended.effects).toEqual([])
    expect(ended.state.status).toBe('idle')
    expect(ended.state.stopped).toBe(true)

    const resumed = applied(reduce(ended.state, { type: 'resume' }))
    expect(effectKinds(resumed.effects)).toEqual(['rescan'])
    const deliveredAgain = applied(reduce(resumed.state, ready('A')))
    expect(effectKinds(deliveredAgain.effects)).toEqual(['deliver-wake'])
  })

  it('refuses resume when the latch is not stopped', () => {
    const before = start()
    const result = refused(reduce(before, { type: 'resume' }))
    expect(result.code).toBe('invalid-transition')
    expect(result.state).toBe(before)
  })
})

describe('A6-PR3 malformed input and invalid transitions are refused without mutation', () => {
  const malformed: Array<[string, ReviewWakeEvent, string]> = [
    ['unknown event type', { type: 'backoff' } as unknown as ReviewWakeEvent, 'invalid-event'],
    ['null event', null as unknown as ReviewWakeEvent, 'invalid-event'],
    [
      'activation with a non-closed reason',
      { type: 'activate', reason: 'timer' } as unknown as ReviewWakeEvent,
      'invalid-event',
    ],
    [
      'ready scan with an empty fingerprint',
      { type: 'scan-result', work: { kind: 'ready', fingerprint: '' } },
      'invalid-scan',
    ],
    [
      'scan with an unknown kind',
      { type: 'scan-result', work: { kind: 'maybe' } } as unknown as ReviewWakeEvent,
      'invalid-scan',
    ],
    [
      'scan without work',
      { type: 'scan-result' } as unknown as ReviewWakeEvent,
      'invalid-scan',
    ],
    [
      'delivery failure with an empty wake id',
      { type: 'delivery-failed', wakeId: '' },
      'invalid-event',
    ],
    [
      'recover with a malformed persisted fact',
      {
        type: 'recover',
        persistedWake: {
          key: KEY,
          status: 'queued',
          wakeId: '',
          workFingerprint: 'A',
        },
      },
      'invalid-persisted-wake',
    ],
    [
      'recover with a non-boolean stop flag',
      { type: 'recover', stopped: 'yes' } as unknown as ReviewWakeEvent,
      'invalid-event',
    ],
  ]

  it.each(malformed)('refuses %s', (_label, event, code) => {
    const before = start()
    const result = refused(reduce(before, event))
    expect(result.code).toBe(code)
    expect(result.state).toBe(before)
  })

  it('refuses out-of-phase turn events and invalid transitions', () => {
    const idle = start()
    expect(refused(reduce(idle, { type: 'turn-start' })).code).toBe(
      'invalid-transition',
    )

    const queued = queuedFor('A').state
    expect(refused(reduce(queued, { type: 'turn-end' })).code).toBe(
      'invalid-transition',
    )
  })

  it('refuses a state carrying an out-of-vocabulary (seven-phase) status', () => {
    const corrupted = {
      ...start(),
      status: 'reconciling',
    } as unknown as ReviewWakeState
    const result = refused(reduce(corrupted, activate()))
    expect(result.code).toBe('invalid-event')
    expect(result.state).toBe(corrupted)
  })

  it('never mutates the input state or event', () => {
    const delivered = queuedFor('A')
    const frozenState: ReviewWakeState = Object.freeze({
      ...delivered.state,
      key: Object.freeze({ ...delivered.state.key }),
    })
    const frozenEvent: ReviewWakeEvent = Object.freeze({
      type: 'activate',
      reason: 'work-changed',
    })
    const snapshot = JSON.stringify(frozenState)

    const first = reduce(frozenState, frozenEvent)
    const second = reduce(frozenState, frozenEvent)
    expect(first).toEqual(second)
    expect(JSON.stringify(frozenState)).toBe(snapshot)
    expect(applied(first).state.dirty).toBe(true)
    expect(applied(first).state).not.toBe(frozenState)
  })

  it('drives state only through the coordinator shell; refusals leave it untouched', () => {
    const coordinator = createReviewWakeCoordinator(KEY)
    expect(coordinator.state.status).toBe('idle')

    coordinator.dispatch(activate())
    expect(coordinator.state.status).toBe('idle')
    coordinator.dispatch(ready('A'))
    expect(coordinator.state.status).toBe('queued')

    const before = coordinator.state
    const refusal = coordinator.dispatch({ type: 'resume' })
    expect(refusal.outcome).toBe('refused')
    expect(coordinator.state).toBe(before)
  })
})

describe('A6-PR3 closed vocabularies', () => {
  it('exposes exactly the frozen three-phase latch and bounded event/refusal sets', () => {
    expect(REVIEW_WAKE_STATUSES).toEqual(['idle', 'queued', 'running'])
    expect(REVIEW_WAKE_EVENT_TYPES).toEqual([
      'activate',
      'poll',
      'scan-result',
      'turn-start',
      'turn-end',
      'delivery-failed',
      'stop',
      'resume',
      'recover',
    ])
    expect(REVIEW_WAKE_RESCAN_REASONS).toEqual([
      'activation',
      'poll',
      'turn-end',
      'resume',
    ])
    expect(REVIEW_WAKE_WITHDRAW_REASONS).toEqual(['no-ready-work', 'stopped'])
    expect(REVIEW_WAKE_ACTIVATION_REASONS).toEqual([
      'work-changed',
      'handoff',
      'takeover',
    ])
    expect(new Set(REVIEW_WAKE_REFUSAL_CODES).size).toBe(
      REVIEW_WAKE_REFUSAL_CODES.length,
    )
  })

  it('does not carry the rejected seven-phase vocabulary (no lease/timer phases)', () => {
    for (const rejected of [
      'reserved',
      'reconciling',
      'backoff',
      'suspended',
    ]) {
      expect(REVIEW_WAKE_STATUSES as readonly string[]).not.toContain(rejected)
    }
  })
})
