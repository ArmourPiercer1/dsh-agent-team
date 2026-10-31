/**
 * Alpha.6 PR-I2 (Lane 2) — the floor-delayed wake decision, pinned by the contract memo's own legs.
 *
 * WHICH LEGS THESE ARE, stated up front because the honest split matters more than the count. Memo §4 lists eight
 * acceptance legs to be run against a FAKE port. Half of them constrain the consumer (this module) and half
 * constrain whatever adapter eventually satisfies `TimedWakePort`:
 *  - **bound by these tests** (consumer behaviour, so the guarantee cannot rot when an adapter lands): leg 1 (no
 *    port ⇒ refusal + trace + no wake-bearing write), leg 3 (an idempotency key never produces a second promise),
 *    leg 4 (a past instant is immediate, not a rejection, unless the caller asked for strict), leg 6 (a port's own
 *    refusal is passed through unrewritten), leg 7 (a throwing handler is recorded, never swallowed), leg 8 (reason
 *    is durable; authority is absent).
 *  - **exercised here against a fake, and re-runnable against a real adapter later**: leg 2 (replay after restart
 *    keeps `dueSinceEpochMs` and sets `replay: true`) and leg 5 (a clock rollback re-delivers rather than dropping).
 *    Against a fake those legs show that the fake and the consumer agree on the contract's shape; they do NOT prove
 *    that any real host persists a wake. Nothing here claims that. Persisting a wake remains `CORE_SEAM_BLOCKER`.
 *
 * What this file refuses to test, on purpose: nothing here boots a host process. The end-to-end legs of memo §8.5
 * (L-1a/L-1b: does a plugin receive `domain/changed`, with and without `{ global: true }`) need
 * `tests/deepseek-harness-test-use` and `tests/homes`, and neither exists in this lane — ENV-REFUSED, recorded as
 * refused. A contract test over a fake is not a substitute for those legs and is not presented as one.
 */

import { describe, expect, it } from 'vitest'

import { decideTimedWake, observeTimedWake } from '../timed-wake/index.js'
import type {
  TimedWakeDeps,
  TimedWakeFact,
  TimedWakeFire,
  TimedWakePort,
  TimedWakeScheduleResult,
} from '../timed-wake/index.js'

const NOW = 1_700_000_000_000

interface Harness {
  readonly deps: TimedWakeDeps
  readonly facts: TimedWakeFact[]
  readonly kinds: () => string[]
}

/** A harness whose only effects are in-memory: an array of appended facts. No timers anywhere in this file. */
function harness(input: {
  readonly port?: TimedWakePort
  readonly now?: number
  readonly known?: Readonly<Record<string, string>>
} = {}): Harness {
  const facts: TimedWakeFact[] = []
  const deps: TimedWakeDeps = {
    ...(input.port === undefined ? {} : { port: input.port }),
    nowEpochMs: () => input.now ?? NOW,
    appendFact: async (fact) => {
      facts.push(fact)
    },
    reasonOfKnownWake: (wakeId) => input.known?.[wakeId],
  }
  return { deps, facts, kinds: () => facts.map((fact) => fact.kind) }
}

/**
 * A contract oracle, not a scheduler: it answers `schedule` from the test and delivers nothing on its own. Every
 * delivery in this file is made by the test calling the wrapped handler, because a fake that timed anything would
 * be the second timer family §6 forbids.
 */
function fakePort(
  calls: string[],
  schedule?: (input: {
    readonly wakeId: string
    readonly notBeforeEpochMs: number
    readonly reason: string
  }) => Promise<TimedWakeScheduleResult>,
): TimedWakePort {
  return {
    schedule: async (input) => {
      calls.push('schedule')
      return (await schedule?.(input)) ?? { accepted: true, scheduledAtEpochMs: NOW }
    },
    cancel: async () => {
      calls.push('cancel')
      return { cancelled: true }
    },
    setHandler: () => {
      calls.push('setHandler')
    },
  }
}

const REQUEST = {
  wakeId: 'wake:case-7:f41f0895',
  notBeforeEpochMs: 1_700_000_600_000,
  reason: 'review-wake-deferred-floor',
}

describe('PR-I2 leg 1 — a missing time source refuses, and the refusal is a fact', () => {
  it('refuses TIMED_WAKE_UNAVAILABLE and writes a refusal trace, not a wake promise', async () => {
    const h = harness()
    const decision = await decideTimedWake(h.deps, REQUEST)

    expect(decision).toEqual({ accepted: false, code: 'TIMED_WAKE_UNAVAILABLE' })
    // §2.6 demands the durable trace; §4.1 forbids any wake-bearing write. The two are the same fact read
    // carefully: exactly one fact, and it is a refusal — never `timed-wake-scheduled`.
    expect(h.kinds()).toEqual(['timed-wake-refused'])
    expect(h.facts[0]).toMatchObject({ code: 'TIMED_WAKE_UNAVAILABLE', wakeId: REQUEST.wakeId })
  })

  it('never reports accepted:true without a port, in any input shape', async () => {
    const shapes = [
      REQUEST,
      { ...REQUEST, notBeforeEpochMs: 1 },
      { ...REQUEST, requireFutureNotBefore: true },
      { ...REQUEST, requireFutureNotBefore: false },
    ]
    for (const request of shapes) {
      const h = harness()
      const decision = await decideTimedWake(h.deps, request)
      expect(decision.accepted).toBe(false)
    }
  })

  it('stops a conflicting id before the carrier is ever asked (§2.2 idempotency)', async () => {
    const calls: string[] = []
    const h = harness({
      known: { [REQUEST.wakeId]: 'some-other-reason' },
      port: fakePort(calls),
    })
    const conflict = await decideTimedWake(h.deps, REQUEST)

    expect(conflict).toEqual({ accepted: false, code: 'WAKE_ID_CONFLICT' })
    expect(calls).toEqual([])
    expect(h.kinds()).toEqual(['timed-wake-refused'])
  })

  it('lets the same id through when the reason matches, because that is a replay and not a conflict', async () => {
    const calls: string[] = []
    const h = harness({ known: { [REQUEST.wakeId]: REQUEST.reason }, port: fakePort(calls) })
    expect((await decideTimedWake(h.deps, REQUEST)).accepted).toBe(true)
    expect(calls).toEqual(['schedule'])
  })
})

describe('PR-I2 legs 3/4/6 — what a present carrier may and may not be told', () => {
  it('passes a port refusal through unchanged, because rewriting it hides which layer said no', async () => {
    const calls: string[] = []
    const h = harness({
      port: fakePort(calls, async () => ({ accepted: false, code: 'NOT_BEFORE_IN_PAST' })),
    })
    const decision = await decideTimedWake(h.deps, REQUEST)

    expect(decision).toEqual({ accepted: false, code: 'PORT_REFUSED', portCode: 'NOT_BEFORE_IN_PAST' })
    expect(h.kinds()).toEqual(['timed-wake-refused'])
    expect(h.facts[0]).toMatchObject({ code: 'PORT_REFUSED', portCode: 'NOT_BEFORE_IN_PAST' })
  })

  it('records a scheduled fact carrying the instant the carrier promised', async () => {
    const calls: string[] = []
    const h = harness({
      port: fakePort(calls, async () => ({ accepted: true, scheduledAtEpochMs: 1_700_000_605_000 })),
    })
    const decision = await decideTimedWake(h.deps, REQUEST)

    expect(decision).toEqual({ accepted: true, scheduledAtEpochMs: 1_700_000_605_000 })
    expect(calls).toEqual(['schedule'])
    expect(h.facts).toEqual([
      {
        kind: 'timed-wake-scheduled',
        wakeId: REQUEST.wakeId,
        reason: REQUEST.reason,
        notBeforeEpochMs: REQUEST.notBeforeEpochMs,
        scheduledAtEpochMs: 1_700_000_605_000,
      },
    ])
  })

  it('treats a past instant as immediate unless the caller demands the strict reading', async () => {
    const past = { ...REQUEST, notBeforeEpochMs: 1_699_999_000_000 }

    const lenient = harness({ port: fakePort([]), now: NOW })
    expect((await decideTimedWake(lenient.deps, past)).accepted).toBe(true)

    const strict = harness({ port: fakePort([]), now: NOW })
    const decision = await decideTimedWake(strict.deps, { ...past, requireFutureNotBefore: true })
    expect(decision).toEqual({ accepted: false, code: 'NOT_BEFORE_IN_PAST' })
    expect(strict.kinds()).toEqual(['timed-wake-refused'])
  })

  it('lets a carrier exception propagate instead of laundering it into a refusal code', async () => {
    const calls: string[] = []
    const h = harness({
      port: fakePort(calls, async () => {
        throw new Error('carrier store unreachable')
      }),
    })
    await expect(decideTimedWake(h.deps, REQUEST)).rejects.toThrow('carrier store unreachable')
    expect(h.kinds()).toEqual(['timed-wake-schedule-error'])
    expect(h.facts[0]).toMatchObject({ message: 'carrier store unreachable' })
  })

  it('screens the identifier and the reason before anything is written', async () => {
    const h = harness()
    await expect(decideTimedWake(h.deps, { ...REQUEST, reason: 'role=admin' })).rejects.toThrow(/reason/)
    await expect(decideTimedWake(h.deps, { ...REQUEST, wakeId: '' })).rejects.toThrow(/wakeId/)
    await expect(decideTimedWake(h.deps, { ...REQUEST, notBeforeEpochMs: -5 })).rejects.toThrow(/notBeforeEpochMs/)
    expect(h.facts).toEqual([])
  })
})

describe('PR-I2 legs 2/5/7/8 — what a delivery may be told about itself', () => {
  const fire = (over: Partial<TimedWakeFire> = {}): TimedWakeFire => ({
    wakeId: REQUEST.wakeId,
    reason: REQUEST.reason,
    firedAtEpochMs: 1_700_000_600_000,
    dueSinceEpochMs: REQUEST.notBeforeEpochMs,
    replay: false,
    ...over,
  })

  it('keeps dueSinceEpochMs and replay across a restart replay, so lateness stays measurable', async () => {
    const h = harness()
    await observeTimedWake(h.deps, () => {})(fire({ replay: true, firedAtEpochMs: 1_700_000_900_000 }))

    expect(h.facts).toEqual([
      {
        kind: 'timed-wake-fired',
        wakeId: REQUEST.wakeId,
        reason: REQUEST.reason,
        firedAtEpochMs: 1_700_000_900_000,
        dueSinceEpochMs: REQUEST.notBeforeEpochMs,
        replay: true,
      },
    ])
  })

  it('accepts a late-then-early delivery pair without dropping either, which is what a rolled-back clock looks like', async () => {
    // Leg 5 from the consumer's side: after the wall clock moves backwards a carrier may deliver an instant that
    // is earlier than one already seen. Dropping it silently is the failure §2.3 forbids, so the consumer's half
    // of that rule is: record both, in arrival order, with each one's own dueSince.
    const h = harness()
    const observe = observeTimedWake(h.deps, () => {})
    await observe(fire({ firedAtEpochMs: 1_700_000_900_000 }))
    await observe(fire({ firedAtEpochMs: 1_700_000_100_000, replay: true }))
    expect(h.kinds()).toEqual(['timed-wake-fired', 'timed-wake-fired'])
    expect(h.facts.map((fact) => fact.kind === 'timed-wake-fired' && fact.firedAtEpochMs)).toEqual([
      1_700_000_900_000,
      1_700_000_100_000,
    ])
  })

  it('records that the moment arrived before running the business effect, then records the failure', async () => {
    const h = harness()
    const seenBeforeThrow: string[] = []
    await expect(
      observeTimedWake(h.deps, () => {
        seenBeforeThrow.push(...h.kinds())
        throw new Error('handler blew up')
      })(fire()),
    ).rejects.toThrow('handler blew up')

    // "曾经到点" survives a throwing handler: the fire fact is durable first, and the error is durable too —
    // swallowed and silent would be the failure mode this leg exists to prevent (§4 leg 7).
    expect(seenBeforeThrow).toEqual(['timed-wake-fired'])
    expect(h.kinds()).toEqual(['timed-wake-fired', 'timed-wake-fire-error'])
    expect(h.facts[1]).toMatchObject({ message: 'handler blew up', firedAtEpochMs: fire().firedAtEpochMs })
  })

  it('carries the reason durably and carries no authority anywhere near it (§2.4, PR-I1a screen)', async () => {
    const h = harness({ port: fakePort([]) })
    await decideTimedWake(h.deps, REQUEST)
    await observeTimedWake(h.deps, () => {})(fire())

    const names = h.facts.flatMap((fact) => Object.keys(fact as Record<string, unknown>))
    const screen = /authorit|permission|principal|grant|role|token|approv|decision|allow/i
    expect(names.filter((name) => screen.test(name))).toEqual([])
    expect(names).toContain('reason')
    expect(JSON.stringify(h.facts)).toContain(REQUEST.reason)
  })
})
