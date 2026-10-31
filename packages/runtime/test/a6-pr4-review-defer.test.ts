/**
 * Alpha.6 PR4′ — the review-wake defer laws.
 *
 * The lane has one job: decide, for one wake, whether the Leader is told now or not told yet. The legs are
 * arranged by who could be wrong — the key that addresses a defer, the store that holds it, the decision that
 * reads it, the gate that acts on it, and the port a model holds — because each has a different failure that
 * matters:
 *
 *  - a **key** that mis-addresses a defer mutes the wrong case, which is the one failure this lane must never
 *    have, since everything else about it is a courtesy;
 *  - a **store** that accepts a bad defer tells its author something is standing when nothing is;
 *  - a **decision** that is confused answers "deliver", so the legs here insist on that rather than on
 *    cleverness;
 *  - a **gate** that swallows a delivery failure makes a broken deliverer look like a deferred case;
 *  - a **port** writing to a store the gate does not read is a switch that does nothing.
 *
 * No leg here boots a Host, touches a filesystem, or waits on a timer: the lane is pure functions over an
 * injected instant, and a law that needed a clock to test would be a law about timing rather than about
 * deferral.
 */

import { describe, expect, it } from 'vitest'

import {
  REVIEW_DEFER_DECISIONS,
  REVIEW_DEFER_DEFAULT_LIMITS,
  REVIEW_DEFER_REASON_CODES,
  REVIEW_DEFER_REFUSALS,
  REVIEW_DEFER_WAKE_REASONS,
  cancelReviewDefer,
  createReviewDeferGate,
  createReviewDeferPort,
  createReviewDeferStore,
  decideReviewWake,
  listReviewDefers,
  reviewDeferEntryId,
  reviewDeferKeyOf,
  setReviewDefer,
  sweepReviewDefers,
  type ReviewDeferGate,
  type ReviewDeferKey,
  type ReviewDeferRefusal,
  type ReviewDeferResult,
  type ReviewDeferStore,
  type ReviewDeferWakeReason,
  type ReviewWakeCandidate,
} from '../review-defer/index.js'

const ROOT = 'team-root-01'
const CASE_ID = 'case-1f2e3d4c'
const LEG = 1
const REQ_ID = 'req-9a8b7c'
const NOW = '2026-11-01T10:00:00.000Z'

/** `NOW` plus a duration, as an instant — the test's only clock, and it is arithmetic, not a read. */
function later(ms: number): string {
  return new Date(Date.parse(NOW) + ms).toISOString()
}

function record(overrides: Partial<ReviewWakeCandidate> = {}): ReviewWakeCandidate {
  return { rootSessionId: ROOT, requestId: REQ_ID, approvalCaseId: CASE_ID, legOrdinal: LEG, ...overrides }
}

function key(overrides: Partial<ReviewDeferKey> = {}): ReviewDeferKey {
  return { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: LEG, ...overrides }
}

/** File a defer through the writer, failing the test loudly if the fixture itself was refused. */
function defer(
  store: ReviewDeferStore,
  input: {
    readonly approvalCaseId?: string
    readonly legOrdinal?: number
    readonly rootSessionId?: string
    readonly notBeforeIso?: string
    readonly reasonCode?: (typeof REVIEW_DEFER_REASON_CODES)[number]
    readonly nowIso?: string
  } = {},
): void {
  const result = setReviewDefer(
    store,
    {
      rootSessionId: input.rootSessionId ?? ROOT,
      approvalCaseId: input.approvalCaseId ?? CASE_ID,
      legOrdinal: input.legOrdinal ?? LEG,
      notBeforeIso: input.notBeforeIso ?? later(10 * 60 * 1000),
      reasonCode: input.reasonCode ?? 'LEADER_REQUESTED',
    },
    input.nowIso ?? NOW,
  )
  if (!result.ok) throw new Error(`fixture refused: ${result.refusal} — ${result.detail}`)
}

/** A notifier double that records the identity of what it was handed, and can be made to fail. */
function recordingNotifier(failWith?: Error): {
  readonly notify: { notifyLeaderRequest(r: ReviewWakeCandidate): Promise<void> }
  readonly seen: ReviewWakeCandidate[]
} {
  const seen: ReviewWakeCandidate[] = []
  return {
    seen,
    notify: {
      notifyLeaderRequest: async (r: ReviewWakeCandidate): Promise<void> => {
        seen.push(r)
        if (failWith !== undefined) throw failWith
      },
    },
  }
}

// --- D — the key: what a defer is addressed to ---------------------------------------------------------

describe('A6-PR4/D — a defer is addressed to one leg of one case of one team session', () => {
  it('derives the key a record names, and the slot the store will use', () => {
    const derived = reviewDeferKeyOf(ROOT, record())
    expect(derived.ok, JSON.stringify(derived)).toBe(true)
    if (!derived.ok) return
    expect(derived.value).toEqual({ rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: LEG })
    // The slot derivation is one function, shared by writer and gate; a second copy in the gate would
    // diverge and the failure would be silent, because a gate that looks in the wrong slot delivers.
    const store = createReviewDeferStore()
    defer(store)
    expect(store.entries.has(reviewDeferEntryId(derived.value))).toBe(true)
  })

  it('refuses to defer a wake that names no case, and says so with the code that means "not mine to mute"', () => {
    // A pre-Alpha.4 control row carries no approvalCaseId. That absence is load-bearing: "the row is an
    // Alpha.4 LEG row" is what the field's own contract says, so a lane that deferred such a row would be
    // guessing at which case a wake belonged to — and guessing wrong silences the wrong case.
    const result = reviewDeferKeyOf(ROOT, record({ approvalCaseId: undefined }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe('REVIEW_DEFER_CASE_UNIDENTIFIED')
    expect(result.detail).toContain('approvalCaseId')
    const blank = reviewDeferKeyOf(ROOT, record({ approvalCaseId: '' }))
    expect(blank.ok).toBe(false)
    if (blank.ok) return
    expect(blank.refusal).toBe('REVIEW_DEFER_CASE_UNIDENTIFIED')
  })

  it('refuses a case without a leg, because one leg of a case can be quiet while the next is not', () => {
    for (const legOrdinal of [undefined, 0, -1, 1.5, Number.NaN]) {
      const result = reviewDeferKeyOf(ROOT, record({ legOrdinal }))
      expect(result.ok, `legOrdinal ${String(legOrdinal)}`).toBe(false)
      if (result.ok) continue
      expect(result.refusal, `legOrdinal ${String(legOrdinal)}`).toBe('REVIEW_DEFER_LEG_MALFORMED')
    }
  })

  it('refuses identifiers that are not identifiers, on both paths that accept them', () => {
    const store = createReviewDeferStore()
    for (const approvalCaseId of ['case with spaces', '../elsewhere', 'é', 'x'.repeat(200)]) {
      const result = reviewDeferKeyOf(ROOT, record({ approvalCaseId }))
      expect(result.ok, approvalCaseId).toBe(false)
      if (result.ok) continue
      expect(result.refusal, approvalCaseId).toBe('REVIEW_DEFER_ID_MALFORMED')
      // The write path is driven with the same garbage so the "no state touched" claim is something the store
      // is asked rather than something asserted about a call that never reached it (round-2 finding R2-10 on
      // #509: the earlier version asserted `store.entries.size === 0` after calls that take no store).
      const filed = setReviewDefer(store, { rootSessionId: ROOT, approvalCaseId, legOrdinal: LEG, notBeforeIso: later(60 * 1000), reasonCode: 'AWAITING_EVIDENCE' }, NOW)
      expect(filed.ok, `write path accepted ${approvalCaseId}`).toBe(false)
      if (!filed.ok) expect(filed.refusal, approvalCaseId).toBe('REVIEW_DEFER_ID_MALFORMED')
    }
    expect(store.entries.size).toBe(0)
  })
})

// --- S — the store: what a defer may say about itself -------------------------------------------------

describe('A6-PR4/S — a standing defer says exactly one true thing', () => {
  it('records the instant it was filed from the caller, never from a clock of its own', () => {
    const store = createReviewDeferStore()
    defer(store, { notBeforeIso: later(60 * 1000) })
    const [entry] = listReviewDefers(store, NOW)
    expect(entry).toBeDefined()
    expect(entry?.setAtIso).toBe(NOW)
    expect(entry?.notBeforeIso).toBe(later(60 * 1000))
    expect(entry?.reasonCode).toBe('LEADER_REQUESTED')
    expect(Object.isFrozen(entry)).toBe(true)
  })

  it('refuses a floor that is not in the future, because "defer until the past" reports a silence that silences nothing', () => {
    const store = createReviewDeferStore()
    for (const notBeforeIso of [NOW, later(-1)]) {
      const result = setReviewDefer(
        store,
        { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: LEG, notBeforeIso, reasonCode: 'AWAITING_EVIDENCE' },
        NOW,
      )
      expect(result.ok, notBeforeIso).toBe(false)
      if (result.ok) continue
      expect(result.refusal, notBeforeIso).toBe('REVIEW_DEFER_NOT_IN_FUTURE')
    }
    expect(listReviewDefers(store, NOW)).toEqual([])
  })

  it('refuses a floor past the horizon and points at the pending list instead', () => {
    const store = createReviewDeferStore()
    const result = setReviewDefer(
      store,
      {
        rootSessionId: ROOT,
        approvalCaseId: CASE_ID,
        legOrdinal: LEG,
        notBeforeIso: later(REVIEW_DEFER_DEFAULT_LIMITS.horizonMs + 1),
        reasonCode: 'LEADER_REQUESTED',
      },
      NOW,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe('REVIEW_DEFER_HORIZON_EXCEEDED')
    // The detail is part of the law: the alternative to a bounded defer is not silence, it is the pending
    // list, and a caller who is not told that will reach for a longer defer until the cap becomes a bug.
    expect(result.detail).toContain('pending list')
    // Exactly at the horizon is allowed — the boundary is a limit, not a wall to back away from.
    expect(
      setReviewDefer(
        store,
        {
          rootSessionId: ROOT,
          approvalCaseId: CASE_ID,
          legOrdinal: LEG,
          notBeforeIso: later(REVIEW_DEFER_DEFAULT_LIMITS.horizonMs),
          reasonCode: 'LEADER_REQUESTED',
        },
        NOW,
      ).ok,
    ).toBe(true)
  })

  it('refuses an unreadable instant and an unknown reason as two different facts', () => {
    const store = createReviewDeferStore()
    const base = { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: LEG, reasonCode: 'LEADER_REQUESTED' } as const
    for (const notBeforeIso of ['tomorrow', '1793500000000', '', null]) {
      const result = setReviewDefer(store, { ...base, notBeforeIso: notBeforeIso as string }, NOW)
      expect(result.ok, String(notBeforeIso)).toBe(false)
      if (result.ok) continue
      expect(result.refusal, String(notBeforeIso)).toBe('REVIEW_DEFER_INSTANT_MALFORMED')
    }
    // Round-1 finding F-5 on #509: this used to answer `REVIEW_DEFER_INSTANT_MALFORMED` for a bad REASON, with
    // a perfectly good instant. A caller reading the log would go hunting for a clock bug in a call site whose
    // only mistake was a string. Two refusals, two facts.
    const badReason = setReviewDefer(store, { ...base, notBeforeIso: later(60 * 1000), reasonCode: 'UNTIL_I_SAY_SO' as never }, NOW)
    expect(badReason.ok).toBe(false)
    if (badReason.ok) return
    expect(badReason.refusal).toBe('REVIEW_DEFER_REASON_UNKNOWN')
    // A malformed now is refused too: a lane that could not locate the present could not honour a floor.
    const badNow = setReviewDefer(
      store,
      { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: LEG, notBeforeIso: later(60 * 1000), reasonCode: 'LEADER_REQUESTED' },
      'not-an-instant',
    )
    expect(badNow.ok).toBe(false)
    if (badNow.ok) return
    expect(badNow.refusal).toBe('REVIEW_DEFER_INSTANT_MALFORMED')
    expect(store.entries.size).toBe(0)
  })

  it('replaces a standing floor when the same key is filed again, because the newest instruction is the true one', () => {
    const store = createReviewDeferStore()
    defer(store, { notBeforeIso: later(60 * 1000) })
    defer(store, { notBeforeIso: later(5 * 60 * 1000) })
    const entries = listReviewDefers(store, NOW)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.notBeforeIso).toBe(later(5 * 60 * 1000))
    // And the replacement may shorten as well as lengthen: refusing a shorter floor would keep a case quiet
    // longer than anybody asked, which is the direction a courtesy must not tip.
    expect(decideReviewWake(store, ROOT, record(), later(6 * 60 * 1000)).decision).toBe('deliver')
  })

  it('refuses a new defer at capacity and never evicts a standing one to make room', () => {
    const store = createReviewDeferStore({ horizonMs: 60 * 60 * 1000, maxEntries: 2 })
    defer(store, { approvalCaseId: 'case-aaaaaaaa' })
    defer(store, { approvalCaseId: 'case-bbbbbbbb' })
    const third = setReviewDefer(
      store,
      { rootSessionId: ROOT, approvalCaseId: 'case-cccccccc', legOrdinal: LEG, notBeforeIso: later(60 * 1000), reasonCode: 'LEADER_REQUESTED' },
      NOW,
    )
    expect(third.ok).toBe(false)
    if (third.ok) return
    expect(third.refusal).toBe('REVIEW_DEFER_STORE_SATURATED')
    // The two standing defers are untouched: an overflow that un-muted somebody else's case would turn a
    // capacity limit into a surprise wake for the wrong Leader question.
    expect(listReviewDefers(store, NOW).map((e) => e.key.approvalCaseId).sort()).toEqual(['case-aaaaaaaa', 'case-bbbbbbbb'])
    // Re-filling a key that already stands is not "new", so saturation cannot block an update.
    expect(() => defer(store, { approvalCaseId: 'case-aaaaaaaa', notBeforeIso: later(20 * 60 * 1000) })).not.toThrow()
    expect(listReviewDefers(store, NOW)).toHaveLength(2)
  })

  it('cancels, and distinguishes "there was none" from "it had already lifted" in the detail', () => {
    const store = createReviewDeferStore()
    defer(store, { notBeforeIso: later(60 * 1000) })
    const cancelled = cancelReviewDefer(store, key(), NOW)
    expect(cancelled.ok).toBe(true)
    if (!cancelled.ok) return
    expect(cancelled.value.notBeforeIso).toBe(later(60 * 1000))
    expect(listReviewDefers(store, NOW)).toEqual([])

    const again = cancelReviewDefer(store, key(), NOW)
    expect(again.ok).toBe(false)
    if (again.ok) return
    expect(again.refusal).toBe('REVIEW_DEFER_NO_ACTIVE_DEFER')
    expect(again.detail).toBe('no defer is standing on this key')

    defer(store, { notBeforeIso: later(60 * 1000) })
    const afterFloor = cancelReviewDefer(store, key(), later(61 * 60 * 1000))
    expect(afterFloor.ok).toBe(false)
    if (afterFloor.ok) return
    expect(afterFloor.refusal).toBe('REVIEW_DEFER_NO_ACTIVE_DEFER')
    // Same code, different fact, and the difference is in the words the caller gets: "your defer has been
    // lifted" about a defer that lifted itself teaches an operator to distrust a correct answer.
    expect(afterFloor.detail).toContain('already passed')
  })

  it('drops an expired floor on the first touch, because there is no reaper and there must not be one', () => {
    const store = createReviewDeferStore()
    defer(store, { notBeforeIso: later(60 * 1000) })
    // One millisecond short of the floor the entry is still standing — "until" is inclusive of the instant it
    // names and exclusive of everything before it.
    expect(sweepReviewDefers(store, later(60 * 1000 - 1))).toBe(0)
    expect(sweepReviewDefers(store, later(60 * 1000))).toBe(1)
    expect(store.entries.size).toBe(0)
    // Expiry is evaluated inside every entry point as well, so correctness never depends on somebody
    // remembering a housekeeping call — the shape that a timer would have implied, and a timer here would be
    // a second scheduler driving review wakes.
    const second = createReviewDeferStore()
    defer(second, { notBeforeIso: later(60 * 1000) })
    expect(listReviewDefers(second, later(120 * 60 * 1000))).toEqual([])
  })

  it('hands out a copy of what is standing', () => {
    const store = createReviewDeferStore()
    defer(store)
    const listed = listReviewDefers(store, NOW)
    ;(listed as unknown as unknown[]).length = 0
    expect(store.entries.size).toBe(1)
  })

  it('keeps its bounds when handed limits that cannot bound anything', () => {
    // Round-2 finding R2-1 on #509, reproduced against the shipped output before it was fixed: `NaN` disarms both
    // stated bounds by arithmetic alone — `remaining > NaN` is false so every floor fits the horizon, and
    // `size >= NaN` is false so the capacity never refuses. A store declared at one hour and sixty-four entries
    // filed a ten-year quiet and 300 keys. Nothing could reach that while the lane is dark, but PR-I2 feeds plane
    // config through this exact constructor, so the bound has to survive a caller that hands it garbage.
    for (const limits of [
      { horizonMs: Number.NaN, maxEntries: Number.NaN },
      { horizonMs: Number.POSITIVE_INFINITY, maxEntries: 64 },
      // `maxEntries: 0` is deliberately NOT in this list any more: round 3 showed that a zero cap is the safest
      // thing an operator can ask for (it refuses every new key), so honouring it replaced substituting 64.
      // A negative cap is still garbage, and so is a fractional one.
      { horizonMs: 3_600_000, maxEntries: -1 },
      { horizonMs: 3_600_000, maxEntries: 2.5 },
    ]) {
      const store = createReviewDeferStore(limits)
      expect(store.limits, JSON.stringify(limits)).toEqual(REVIEW_DEFER_DEFAULT_LIMITS)
      const tenYears = setReviewDefer(
        store,
        { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: LEG, notBeforeIso: later(10 * 365 * 24 * 60 * 60 * 1000), reasonCode: 'AWAITING_EVIDENCE' },
        NOW,
      )
      expect(tenYears.ok, `a ten-year floor was accepted under ${JSON.stringify(limits)}`).toBe(false)
      if (!tenYears.ok) expect(tenYears.refusal).toBe('REVIEW_DEFER_HORIZON_EXCEEDED')
    }
    // The usable case is still usable — a substitution that also rejected good limits would be a different bug.
    const narrowed = createReviewDeferStore({ horizonMs: 10 * 60 * 1000, maxEntries: 1 })
    expect(narrowed.limits).toEqual({ horizonMs: 10 * 60 * 1000, maxEntries: 1 })
  })

  it('judges each bound on its own and keeps the one that suppresses', () => {
    // Round-3 finding R3-2 on #509, against my own first fix: replacing the WHOLE object when one field is
    // unusable LOOSENS the suppressive bound. `{horizonMs: 60_000, maxEntries: 2.5}` became a one-hour horizon
    // because a *different* field was garbage — a 60× longer silence than configured, in the one direction this
    // lane forbids. Per-field substitution is the fix, and it is measured here rather than asserted in prose.
    expect(createReviewDeferStore({ horizonMs: 60_000, maxEntries: 2.5 }).limits)
      .toEqual({ horizonMs: 60_000, maxEntries: REVIEW_DEFER_DEFAULT_LIMITS.maxEntries })
    expect(createReviewDeferStore({ horizonMs: Number.NaN, maxEntries: 1 }).limits)
      .toEqual({ horizonMs: REVIEW_DEFER_DEFAULT_LIMITS.horizonMs, maxEntries: 1 })

    // Zero is not garbage, it is the safest thing an operator can ask for: a zero horizon refuses every floor and
    // a zero cap refuses every new key, so both mean "no quiets, ever" — pure fail-open. The first version
    // silently turned that into a live 64-entry suppressing plane.
    const zeroHorizon = createReviewDeferStore({ horizonMs: 0, maxEntries: 64 })
    expect(zeroHorizon.limits.horizonMs).toBe(0)
    const refused = setReviewDefer(zeroHorizon, { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: LEG, notBeforeIso: later(60 * 1000), reasonCode: 'AWAITING_EVIDENCE' }, NOW)
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.refusal).toBe('REVIEW_DEFER_HORIZON_EXCEEDED')
    const zeroCap = createReviewDeferStore({ horizonMs: 3_600_000, maxEntries: 0 })
    expect(zeroCap.limits.maxEntries).toBe(0)
    const capped = setReviewDefer(zeroCap, { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: LEG, notBeforeIso: later(60 * 1000), reasonCode: 'AWAITING_EVIDENCE' }, NOW)
    expect(capped.ok).toBe(false)
    if (!capped.ok) expect(capped.refusal).toBe('REVIEW_DEFER_STORE_SATURATED')
  })

  it('owns its limits: the caller mutating its config object re-arms nothing', () => {
    // Round-3 finding R3-1 on #509 — the defect was inside the fix for round 2's R2-1. Validating at
    // construction while holding the CALLER'S reference meant one more line of ordinary config code re-opened the
    // exact hole: refuse a ten-year floor, `myLimits.horizonMs = NaN`, then file 200 of them. Plane config is the
    // most likely object in the tree to be read, mutated and re-read, so the store keeps a frozen copy.
    const myLimits = { horizonMs: 3_600_000, maxEntries: 4 }
    const store = createReviewDeferStore(myLimits)
    expect(Object.isFrozen(store.limits)).toBe(true)
    expect(store.limits === myLimits).toBe(false)
    const first = setReviewDefer(store, { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: LEG, notBeforeIso: later(10 * 365 * 24 * 60 * 60 * 1000), reasonCode: 'AWAITING_EVIDENCE' }, NOW)
    expect(first.ok).toBe(false)
    myLimits.horizonMs = Number.NaN
    myLimits.maxEntries = Number.NaN
    expect(store.limits).toEqual({ horizonMs: 3_600_000, maxEntries: 4 })
    const after = setReviewDefer(store, { rootSessionId: ROOT, approvalCaseId: 'case-second', legOrdinal: LEG, notBeforeIso: later(10 * 365 * 24 * 60 * 60 * 1000), reasonCode: 'AWAITING_EVIDENCE' }, NOW)
    expect(after.ok, 'a ten-year floor became filable after the caller mutated its own limits').toBe(false)
    if (!after.ok) expect(after.refusal).toBe('REVIEW_DEFER_HORIZON_EXCEEDED')
  })

  it('refuses identifiers that are not strings, instead of throwing or inventing a slot', () => {
    // Round-3 finding R3-7 on #509: `ID_PATTERN.test` COERCES. `test(undefined)` tests the string "undefined"
    // (which passes the pattern) and the value then reaches the length prefix and throws a TypeError out of a
    // function whose whole contract is a refusal; `test(42)` passes and files a quiet under `…|2:42#1`, a slot no
    // legal string id can ever address. Types forbid both, and the gate's catch kept every wake flowing, but a
    // PR-I2 tool receives its arguments from JSON, which produces exactly these shapes.
    const store = createReviewDeferStore()
    for (const notAString of [undefined, null, 42, true, {}, [], Symbol('x') as unknown]) {
      const filed = setReviewDefer(store, { rootSessionId: ROOT, approvalCaseId: notAString as never, legOrdinal: LEG, notBeforeIso: later(60 * 1000), reasonCode: 'AWAITING_EVIDENCE' }, NOW)
      expect(filed.ok, `set accepted a ${typeof notAString} case id`).toBe(false)
      if (!filed.ok) expect(filed.refusal).toBe('REVIEW_DEFER_ID_MALFORMED')
      const cancelled = cancelReviewDefer(store, { rootSessionId: ROOT, approvalCaseId: notAString as never, legOrdinal: LEG }, NOW)
      expect(cancelled.ok, `cancel accepted a ${typeof notAString} case id`).toBe(false)
      if (!cancelled.ok) expect(cancelled.refusal).toBe('REVIEW_DEFER_ID_MALFORMED')
      const derived = reviewDeferKeyOf(ROOT, record({ approvalCaseId: notAString as never }))
      expect(derived.ok, `keyOf accepted a ${typeof notAString} case id`).toBe(false)
      if (!derived.ok) expect(derived.refusal).toBe(notAString === undefined ? 'REVIEW_DEFER_CASE_UNIDENTIFIED' : 'REVIEW_DEFER_ID_MALFORMED')
      const woken = decideReviewWake(store, ROOT, record({ approvalCaseId: notAString as never }), NOW)
      expect(woken.decision, `a ${typeof notAString} case id suppressed a wake`).toBe('deliver')
    }
    expect(store.entries.size).toBe(0)
  })

  it('does not let a read destroy state when the caller\'s clock cannot be read', () => {
    // Round-2 finding R2-2 on #509: the sweep is justified for an entry whose FLOOR is illegible (it can never be
    // honoured, so it goes), and it was deleting everything on an illegible CALLER clock instead — a `list()`
    // that answered "you have no quiets" while emptying the map. A read reports; the wake path fails open on its
    // own account (the G and T legs prove it), so this sweep is not what keeps a case alive.
    const store = createReviewDeferStore()
    defer(store, { approvalCaseId: 'case-one' })
    defer(store, { approvalCaseId: 'case-two' })
    const listed = listReviewDefers(store, 'yesterday')
    expect(listed).toHaveLength(2)
    expect(store.entries.size).toBe(2)
    expect(sweepReviewDefers(store, '{ now: () => 1 }')).toBe(0)
    expect(store.entries.size).toBe(2)
    // A readable clock still sweeps exactly as the law says.
    expect(listReviewDefers(store, later(120 * 60 * 1000))).toEqual([])
    expect(store.entries.size).toBe(0)
  })
})

// --- G — the decision: deliver, or not yet ------------------------------------------------------------

describe('A6-PR4/G — the wake decision, as a function of a store, a record and an instant', () => {
  it('delivers when nothing is standing, and calls that what it is', () => {
    const store = createReviewDeferStore()
    const decision = decideReviewWake(store, ROOT, record(), NOW)
    expect(decision.decision).toBe('deliver')
    expect(decision.reason).toBe('WAKE_NOT_DEFERRED')
    expect(decision.notBeforeIso).toBeNull()
  })

  it('holds a wake while a floor stands, and carries the floor so a caller can report it without a second read', () => {
    const store = createReviewDeferStore()
    defer(store, { notBeforeIso: later(60 * 1000) })
    const decision = decideReviewWake(store, ROOT, record(), NOW)
    expect(decision.decision).toBe('defer')
    expect(decision.reason).toBe('WAKE_DEFER_PENDING')
    expect(decision.notBeforeIso).toBe(later(60 * 1000))
    expect(decision.key).toEqual(key())
  })

  it('delivers the wake that discovers a floor has passed, and retires the floor as it goes', () => {
    const store = createReviewDeferStore()
    defer(store, { notBeforeIso: later(60 * 1000) })
    // Exactly at the floor, the floor has passed: a defer that ran until 10:10 does not also mute 10:10.
    const decision = decideReviewWake(store, ROOT, record(), later(60 * 1000))
    expect(decision.decision).toBe('deliver')
    expect(decision.reason).toBe('WAKE_DEFER_FLOOR_PASSED')
    expect(store.entries.size).toBe(0)
    // And the next wake is ordinary again, not a second FLOOR_PASSED.
    expect(decideReviewWake(store, ROOT, record(), later(62 * 1000)).reason).toBe('WAKE_NOT_DEFERRED')
  })

  it('delivers a wake it cannot attribute, even while another case is deferred', () => {
    const store = createReviewDeferStore()
    defer(store)
    const decision = decideReviewWake(store, ROOT, record({ approvalCaseId: undefined }), NOW)
    expect(decision.decision).toBe('deliver')
    expect(decision.reason).toBe('WAKE_CASE_UNIDENTIFIED')
    // The defer of the identified case is still standing: an unattributable wake may not consume it.
    expect(store.entries.size).toBe(1)
    // The identified wake of that same case is still held, so the two answers differ only by what the
    // record can prove about itself.
    expect(decideReviewWake(store, ROOT, record(), NOW).decision).toBe('defer')
  })

  it('does not let one case, one leg, or one team session borrow another’s silence', () => {
    const store = createReviewDeferStore()
    defer(store, { approvalCaseId: CASE_ID, legOrdinal: 1 })
    const borrowed = [
      record({ approvalCaseId: 'case-other-0001' }),
      record({ legOrdinal: 2 }),
      record({ approvalCaseId: 'case-other-0002', legOrdinal: 1 }),
    ]
    for (const wake of borrowed) {
      expect(decideReviewWake(store, ROOT, wake, NOW).decision, JSON.stringify(wake)).toBe('deliver')
    }
    // The case that was deferred stays deferred, and its other leg is untouched — the same case is not one
    // silence; a leg is.
    expect(decideReviewWake(store, ROOT, record({ legOrdinal: 1 }), NOW).decision).toBe('defer')

    // A slot names its team session, so a store ever shared or reused between roots cannot mute across them.
    const foreign = decideReviewWake(store, 'team-root-99', record(), NOW)
    expect(foreign.decision).toBe('deliver')
    expect(foreign.reason).toBe('WAKE_NOT_DEFERRED')
  })

  it('answers the same way twice, and its answer cannot be edited by a caller', () => {
    const store = createReviewDeferStore()
    defer(store, { notBeforeIso: later(60 * 1000) })
    const first = decideReviewWake(store, ROOT, record(), NOW)
    const second = decideReviewWake(store, ROOT, record(), NOW)
    expect(second).toEqual(first)
    expect(Object.isFrozen(first)).toBe(true)
  })
})

// --- T — the gate: one chooser, and it fails open -----------------------------------------------------

describe('A6-PR4/T — the gate hands the notification to the real notifier or not', () => {
  it('passes the record through to the wrapped notifier, by identity, exactly once', async () => {
    const store = createReviewDeferStore()
    const double = recordingNotifier()
    const gate: ReviewDeferGate = createReviewDeferGate({ notify: double.notify, store, nowIso: () => NOW })
    const wake = record()
    await gate.notifyLeaderRequest(wake)
    expect(double.seen).toHaveLength(1)
    // Identity, not equality: a gate that cloned the record would be re-encoding a decision somebody else
    // already made about what the notification is about.
    expect(double.seen[0]).toBe(wake)
  })

  it('does not reach the notifier while a floor stands, and reaches it once the floor has passed', async () => {
    const store = createReviewDeferStore()
    let clock = NOW
    const double = recordingNotifier()
    const gate = createReviewDeferGate({ notify: double.notify, store, nowIso: () => clock })
    defer(store, { notBeforeIso: later(60 * 1000) })
    await gate.notifyLeaderRequest(record())
    expect(double.seen).toHaveLength(0)
    clock = later(61 * 1000)
    await gate.notifyLeaderRequest(record())
    expect(double.seen).toHaveLength(1)
    // The floor was retired by the delivery that found it expired, so a third wake is not "deferred by
    // leftovers" — the store cannot accumulate floors that nothing cleans.
    expect(store.entries.size).toBe(0)
    await gate.notifyLeaderRequest(record())
    expect(double.seen).toHaveLength(2)
  })

  it('propagates a notifier failure instead of dressing a broken deliverer up as a deferred case', async () => {
    const store = createReviewDeferStore()
    const failure = new Error('root input channel closed')
    const double = recordingNotifier(failure)
    const gate = createReviewDeferGate({ notify: double.notify, store, nowIso: () => NOW })
    await expect(gate.notifyLeaderRequest(record())).rejects.toBe(failure)
    // Swallowing here would be the worst convenience in the lane: the request stays pending and the plane
    // reports a liveness fault, and a silent gate would turn "the Leader could not be told" into "the case
    // was deliberately left alone".
    expect(store.entries.size).toBe(0)
  })

  it('delivers when it cannot read the instant, and leaves the store exactly as it found it', async () => {
    const store = createReviewDeferStore()
    defer(store, { notBeforeIso: later(60 * 1000) })
    const double = recordingNotifier()
    const decisions: ReviewDeferWakeReason[] = []
    const gate = createReviewDeferGate({
      notify: double.notify,
      store,
      nowIso: () => {
        throw new Error('clock unavailable')
      },
      onDecision: (d) => decisions.push(d.reason),
    })
    await gate.notifyLeaderRequest(record())
    // FAIL OPEN is the lane's whole failure posture: an extra wake costs one look at a case that is genuinely
    // still pending, a suppressed wake costs the case its reviewer.
    expect(double.seen).toHaveLength(1)
    // `WAKE_DECISION_FAILED`, not `WAKE_NOT_DEFERRED` (round-1 finding F-5 on #509): "no defer is standing"
    // and "the decision could not be computed" are different facts, and collapsing them makes the lane's
    // fail-open path invisible to the one reader that could act on it.
    expect(decisions).toEqual(['WAKE_DECISION_FAILED'])
    // The panic path reads nothing and writes nothing: the store is exactly as the caller left it.
    expect(store.entries.size).toBe(1)
  })

  it('delivers, and names the reason, when a standing floor cannot be read as a time', async () => {
    // The non-throwing half of the same law, which the first version of the gate got backwards (F-3): a NaN
    // comparison is false, so this fell into the suppress branch and muted a wake on an illegible value.
    const store = createReviewDeferStore()
    defer(store, { notBeforeIso: later(60 * 1000) })
    const decisions: ReviewDeferWakeReason[] = []
    const double = recordingNotifier()
    const gate = createReviewDeferGate({
      notify: double.notify,
      store,
      nowIso: () => 'the day after the day after',
      onDecision: (d) => decisions.push(d.reason),
    })
    await gate.notifyLeaderRequest(record())
    expect(double.seen).toHaveLength(1)
    expect(decisions).toEqual(['WAKE_DEFER_UNREADABLE'])
    // Retired, not kept: an entry nobody can read is not a courtesy anybody can honour, and keeping it would
    // turn one bad write into a permanent mute.
    expect(store.entries.size).toBe(0)
  })

  it('reports every decision it acted on, including the one it took in a panic', async () => {
    const store = createReviewDeferStore()
    defer(store, { notBeforeIso: later(60 * 1000) })
    const double = recordingNotifier()
    const seen: string[] = []
    const gate = createReviewDeferGate({
      notify: double.notify,
      store,
      nowIso: () => NOW,
      onDecision: (d) => seen.push(`${d.decision}:${d.reason}`),
    })
    await gate.notifyLeaderRequest(record())
    await gate.notifyLeaderRequest(record({ approvalCaseId: undefined }))
    expect(double.seen).toHaveLength(1)
    expect(double.seen[0]?.approvalCaseId).toBeUndefined()
    expect(seen).toEqual(['defer:WAKE_DEFER_PENDING', 'deliver:WAKE_CASE_UNIDENTIFIED'])
    // One delivery, for the wake the observer was told was delivered: the observer is a seam for a later
    // metrics PR, and a report that disagreed with what the gate did would be worse than no report.
  })

  it('is the store the caller gave it, not a store of its own', async () => {
    const store = createReviewDeferStore()
    const gate = createReviewDeferGate({ notify: recordingNotifier().notify, store, nowIso: () => NOW })
    expect(gate.store).toBe(store)
  })
})

// --- P — the injected port: the switch and the gate read one state ------------------------------------

// The port is a SEAM, not a mounted control: PR-I2 injects a tool into it (law 6 in `types.ts`), and what this
// block pins is the property that makes that wiring safe — one store by construction, so a filed quiet and the
// gate's decision cannot drift apart the way two stores would.
describe('A6-PR4/P — the seam a tool is injected with, and the gate, share one store by construction', () => {
  it('a defer filed through the port holds the gate, which is the only thing that makes it a switch', async () => {
    const store = createReviewDeferStore()
    const port = createReviewDeferPort({ store, nowIso: () => NOW })
    const double = recordingNotifier()
    const gate = createReviewDeferGate({ notify: double.notify, store, nowIso: () => NOW })

    const filed = port.set({
      rootSessionId: ROOT,
      approvalCaseId: CASE_ID,
      legOrdinal: LEG,
      notBeforeIso: later(30 * 60 * 1000),
      reasonCode: 'PLAN_NOT_IN_FORCE',
    })
    expect(filed.ok, JSON.stringify(filed)).toBe(true)
    await gate.notifyLeaderRequest(record())
    expect(double.seen).toHaveLength(0)

    expect(port.list().map((e) => e.reasonCode)).toEqual(['PLAN_NOT_IN_FORCE'])
    const lifted = port.cancel(key())
    expect(lifted.ok).toBe(true)
    await gate.notifyLeaderRequest(record())
    expect(double.seen).toHaveLength(1)
  })

  it('takes its instant from the plane, so a tool call cannot defer by an amount of time it invented', () => {
    const store = createReviewDeferStore({ horizonMs: 10 * 60 * 1000, maxEntries: 4 })
    const port = createReviewDeferPort({ store, nowIso: () => NOW })
    const tooFar = port.set({
      rootSessionId: ROOT,
      approvalCaseId: CASE_ID,
      legOrdinal: LEG,
      notBeforeIso: later(11 * 60 * 1000),
      reasonCode: 'OFFICER_UNAVAILABLE',
    })
    expect(tooFar.ok).toBe(false)
    if (tooFar.ok) return
    expect(tooFar.refusal).toBe('REVIEW_DEFER_HORIZON_EXCEEDED')
    // The horizon is the plane's, not the model's: a tool that could set its own ceiling could keep a
    // Leader away from a case indefinitely, which is the one outcome this lane must not be able to produce.
    expect(port.list()).toEqual([])
  })

  it('answers a refusal with the refusal, not with a thrown surprise', () => {
    const store = createReviewDeferStore()
    const port = createReviewDeferPort({ store, nowIso: () => NOW })
    const missing = port.cancel(key())
    expect(missing.ok).toBe(false)
    if (missing.ok) return
    expect(missing.refusal).toBe('REVIEW_DEFER_NO_ACTIVE_DEFER')
  })
})

// --- V — vocabulary ----------------------------------------------------------------------------------

describe('A6-PR4/V — the vocabulary is closed, reachable, and not a policy engine', () => {
  it('declares two decisions and means both', () => {
    expect(REVIEW_DEFER_DECISIONS).toEqual(['deliver', 'defer'])
    // `as const`, the repository convention for a closed list (`review-mandate`, `review-wake`): readonly is
    // enforced on the TypeScript consumers, and the values that cross the boundary — keys, entries, decisions
    // — are frozen at runtime, which is where a mutated value could be mistaken for a decision.
    // There is no third answer. "Drop the wake" is the one option missing on purpose: dropping a
    // notification with nothing scheduled behind it turns a liveness signal into a silent case.
    expect(REVIEW_DEFER_DECISIONS).not.toContain('drop')
  })

  it('produces every wake reason, in both directions', async () => {
    const produced = new Set<ReviewDeferWakeReason>()
    const empty = createReviewDeferStore()
    produced.add(decideReviewWake(empty, ROOT, record(), NOW).reason)
    produced.add(decideReviewWake(empty, ROOT, record({ approvalCaseId: undefined }), NOW).reason)
    const standing = createReviewDeferStore()
    defer(standing, { notBeforeIso: later(60 * 1000) })
    produced.add(decideReviewWake(standing, ROOT, record(), NOW).reason)
    const expiring = createReviewDeferStore()
    defer(expiring, { notBeforeIso: later(60 * 1000) })
    produced.add(decideReviewWake(expiring, ROOT, record(), later(61 * 1000)).reason)
    // A case named and a leg missing: attributable enough to notice, not attributable enough to mute.
    produced.add(decideReviewWake(empty, ROOT, record({ legOrdinal: undefined }), NOW).reason)
    // A case readable, the identity half not: the slot cannot be addressed, which is not the same fact as a
    // pre-Alpha.4 row (round-2 finding R2-3 on #509 — this shape used to answer WAKE_CASE_UNIDENTIFIED).
    produced.add(decideReviewWake(empty, ROOT, record({ requestId: 'not an id' }), NOW).reason)
    produced.add(decideReviewWake(empty, 'root id with spaces', record(), NOW).reason)
    // A case id that is present and non-empty but malformed is the fourth shape that cannot address a slot, and
    // the reason doc has to cover it (round-3 finding R3-6 on #509: the doc claimed "a case IS readable").
    produced.add(decideReviewWake(empty, ROOT, record({ approvalCaseId: 'case with spaces' }), NOW).reason)
    // The two fail-open states, produced without a notifier in sight.
    const unreadable = createReviewDeferStore()
    defer(unreadable, { notBeforeIso: later(60 * 1000) })
    produced.add(decideReviewWake(unreadable, ROOT, record(), 'not-a-time').reason)
    // The panic reason is produced by the GATE's catch, not by the pure decision — the decision has no catch,
    // because a pure function that swallows is not pure any more. Driving it through the gate is the only
    // honest way to reach it, and the same drive proves the wake was still delivered.
    const panicSeen: ReviewDeferWakeReason[] = []
    const delivered: string[] = []
    const poisonedGate = createReviewDeferGate({
      notify: { notifyLeaderRequest: async (r: ReviewWakeCandidate): Promise<void> => void delivered.push(r.requestId) },
      store: {
        get limits(): never {
          throw new Error('store poisoned')
        },
        get entries(): never {
          throw new Error('store poisoned')
        },
      } as unknown as ReviewDeferStore,
      nowIso: () => NOW,
      onDecision: (d) => panicSeen.push(d.reason),
    })
    await poisonedGate.notifyLeaderRequest(record())
    produced.add(panicSeen[0] as ReviewDeferWakeReason)
    expect(delivered).toEqual([record().requestId])
    expect([...produced].sort()).toEqual([...REVIEW_DEFER_WAKE_REASONS].sort())
  })

  it('produces every refusal, in both directions', () => {
    const produced = new Set<ReviewDeferRefusal>()
    const note = (result: ReviewDeferResult<unknown>): void => {
      if (!result.ok) produced.add(result.refusal)
    }
    note(reviewDeferKeyOf(ROOT, record({ approvalCaseId: undefined })))
    // The one refusal that belongs to derivation rather than to a write, pinned from BOTH sides so the doc
    // sentence about it can never rot silently (round-2 finding R2-4 on #509): deriving a key from a record that
    // names no case answers CASE_UNIDENTIFIED, while a write that supplies an empty case id answers ID_MALFORMED.
    const derived = reviewDeferKeyOf(ROOT, record({ approvalCaseId: '' }))
    note(derived)
    if (derived.ok) throw new Error('an empty case id must not derive a key')
    expect(derived.refusal).toBe('REVIEW_DEFER_CASE_UNIDENTIFIED')
    note(reviewDeferKeyOf(ROOT, record({ legOrdinal: 0 })))
    note(reviewDeferKeyOf(ROOT, record({ approvalCaseId: 'not an id' })))
    const store = createReviewDeferStore({ horizonMs: 10 * 60 * 1000, maxEntries: 1 })
    const base = { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: LEG, reasonCode: 'LEADER_REQUESTED' } as const
    note(setReviewDefer(store, { ...base, notBeforeIso: NOW }, NOW))
    const written = setReviewDefer(store, { ...base, approvalCaseId: '', notBeforeIso: later(30 * 1000) }, NOW)
    note(written)
    if (written.ok) throw new Error('an empty case id must not file a defer')
    expect(written.refusal).toBe('REVIEW_DEFER_ID_MALFORMED')
    const cancelled = cancelReviewDefer(store, key({ approvalCaseId: '' }), NOW)
    note(cancelled)
    if (cancelled.ok) throw new Error('an empty case id must not cancel a defer')
    expect(cancelled.refusal).toBe('REVIEW_DEFER_ID_MALFORMED')
    note(setReviewDefer(store, { ...base, notBeforeIso: later(2 * 60 * 1000) }, NOW))
    note(setReviewDefer(store, { ...base, notBeforeIso: 'someday' }, NOW))
    note(setReviewDefer(store, { ...base, notBeforeIso: later(10 * 60 * 1000 + 1) }, NOW))
    note(setReviewDefer(store, { ...base, approvalCaseId: 'case-second', notBeforeIso: later(30 * 1000) }, NOW))
    note(cancelReviewDefer(store, key({ approvalCaseId: 'case-none' }), NOW))
    // A reason code outside the closed list refuses the WRITE, and does not blame the instant (F-5 on #509).
    note(setReviewDefer(store, { ...base, notBeforeIso: later(30 * 1000), reasonCode: 'UNTIL_I_SAY_SO' as never }, NOW))
    expect([...produced].sort()).toEqual([...REVIEW_DEFER_REFUSALS].sort())
  })

  it('keeps reason codes closed, because a free-text reason is where a policy engine hides', () => {
    expect(REVIEW_DEFER_REASON_CODES).toHaveLength(4)
    expect(new Set(REVIEW_DEFER_REASON_CODES).size).toBe(4)
    for (const code of REVIEW_DEFER_REASON_CODES) {
      const store = createReviewDeferStore()
      expect(setReviewDefer(store, {
        rootSessionId: ROOT,
        approvalCaseId: CASE_ID,
        legOrdinal: LEG,
        notBeforeIso: later(60 * 1000),
        reasonCode: code,
      }, NOW).ok, code).toBe(true)
    }
  })

  it('states its limits instead of inheriting an implicit one', () => {
    expect(REVIEW_DEFER_DEFAULT_LIMITS.horizonMs).toBe(60 * 60 * 1000)
    expect(REVIEW_DEFER_DEFAULT_LIMITS.maxEntries).toBe(64)
    // `toEqual`, not `toBe`: after round-3 finding R3-1 the store holds a frozen COPY of whatever limits it was
    // given, including the defaults, because sharing the caller's object is what let a mutation re-arm the bug.
    const defaults = createReviewDeferStore().limits
    expect(defaults).toEqual(REVIEW_DEFER_DEFAULT_LIMITS)
    expect(Object.isFrozen(defaults)).toBe(true)
  })
})
