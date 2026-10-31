/**
 * Alpha.6 PR4′ (Lane 2) — the negatives: one chooser, no retraction, no dedupe claim, and a fail-open order
 * that never turns a quiet into a silence.
 *
 * These legs are deliberately awkward. The positive behaviour of the defer gate is in
 * `a6-pr4-review-defer.test.ts`; what belongs here is the shape of the mistakes that PR4′ could introduce into
 * the plane around it — a second switch that also decides delivery, a quiet that reaches a case it was not
 * pointed at, a tool that writes state the notifier never reads, or a gate that quietly becomes the reason a
 * case stops being reviewed. Each leg is written so that the wrong wiring fails it, not so that it can be
 * satisfied by a comment.
 *
 * No live bridge and no Host: the file imports `t12a-live-bridge`-free helpers only, so it runs in C1 (and in
 * this lane, where the pristine test-use checkout is absent and the Host-adjacent suites are environment
 * refusals rather than results).
 */

import { describe, expect, it } from 'vitest'

import {
  cancelReviewDefer,
  createReviewDeferGate,
  createReviewDeferPort,
  createReviewDeferStore,
  decideReviewWake,
  setReviewDefer,
  type ReviewDeferEntry,
  type ReviewDeferGate,
  type ReviewWakeCandidate,
} from '../review-defer/index.js'
// Type-only imports: they cost nothing at runtime and they are the only honest way to assert that a real
// record of somebody else's shape is accepted by this lane, rather than a fixture that happens to look like one.
import type { ControlRequestNotificationPort, ControlRequestRecord } from '../control/types.js'
import type { TeamReviewDeferEntry } from '../../tools/src/types.js'

const ROOT = 'team-root-01'
const CASE_ID = 'case-1f2e3d4c'
const NOW = '2026-11-01T10:00:00.000Z'

function later(ms: number): string {
  return new Date(Date.parse(NOW) + ms).toISOString()
}

function wake(overrides: Partial<ReviewWakeCandidate> = {}): ReviewWakeCandidate {
  return { rootSessionId: ROOT, requestId: 'req-9a8b7c', approvalCaseId: CASE_ID, legOrdinal: 1, ...overrides }
}

function recorder(): {
  readonly notify: { notifyLeaderRequest(record: ReviewWakeCandidate): Promise<void> }
  readonly seen: ReviewWakeCandidate[]
} {
  const seen: ReviewWakeCandidate[] = []
  return {
    seen,
    notify: { notifyLeaderRequest: async (record: ReviewWakeCandidate): Promise<void> => void seen.push(record) },
  }
}

/** File a quiet through the writer, failing the test if the fixture itself was refused. */
function fileQuiet(store: ReturnType<typeof createReviewDeferStore>): void {
  const result = setReviewDefer(
    store,
    { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: 1, notBeforeIso: later(30 * 60 * 1000), reasonCode: 'LEADER_REQUESTED' },
    NOW,
  )
  if (!result.ok) throw new Error(`fixture refused: ${result.refusal}`)
}

describe('A6-PR4/M — the shapes the lane must accept from the plane', () => {
  it('accepts a real control-request record, and the assignment is proved by the compiler rather than by a fixture', () => {
    // `createLeaderControlNotifier` is handed a `ControlRequestRecord` and this lane is handed the same object
    // structurally. If the control lane ever renames or narrows what it passes, this line stops compiling —
    // which is the right place to discover it, because the alternative is a gate that silently sees no case id
    // and therefore delivers everything forever, in a test suite where every fixture was written by hand.
    const accepts: (record: ControlRequestRecord) => ReviewWakeCandidate = (record) => record
    expect(typeof accepts).toBe('function')
    // The pre-Alpha.4 shape is the load-bearing one: `approvalCaseId` is optional on the real record, so a
    // row from before the case model exists is a value this lane has to answer for without guessing.
    const legacy = { rootSessionId: ROOT, requestId: 'req-legacy' } as unknown as ControlRequestRecord
    expect(accepts(legacy).approvalCaseId).toBeUndefined()
  })

  it('is usable where the control service wants a notification port', () => {
    const store = createReviewDeferStore()
    const gate: ReviewDeferGate = createReviewDeferGate({ notify: recorder().notify, store, nowIso: () => NOW })
    const port: ControlRequestNotificationPort = gate
    expect(typeof port.notifyLeaderRequest).toBe('function')
    // The store is exposed on the gate for the tool wiring, and it is not part of the port contract: an
    // object with an extra member still satisfies the interface, and nothing in the control lane can see it.
    expect(Object.keys(port).sort()).toEqual(['notifyLeaderRequest', 'store'])
  })

  it('agrees with the tool layer about what a standing quiet looks like', () => {
    const store = createReviewDeferStore()
    const filed = setReviewDefer(
      store,
      { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: 1, notBeforeIso: later(60 * 1000), reasonCode: 'AWAITING_EVIDENCE' },
      NOW,
    )
    expect(filed.ok).toBe(true)
    if (!filed.ok) return
    // Drift detector: `packages/tools` declares the entry structurally because it must not import this lane.
    // The day the two declarations disagree, this assignment stops compiling, and the day it stops compiling
    // is the day the tool would be describing a state that is not the one the gate holds.
    const entryForTool: TeamReviewDeferEntry = filed.value satisfies ReviewDeferEntry
    expect(entryForTool.key.approvalCaseId).toBe(CASE_ID)
    expect(entryForTool.notBeforeIso).toBe(later(60 * 1000))
  })
})

describe('A6-PR4/M — the one chooser', () => {
  /**
   * A mirror of the expression in `root.ts`, not an import of it: `createTeamProductionRoot` cannot be built
   * without a Host, which is why the mirror is here and the textual count of the real thing is in
   * `a6-pr4-lane-hygiene.test.ts`. The mirror is honest about being a mirror, and both halves are needed:
   * this one says what the two branches must do, that one says there is only one place that does it.
   */
  function chooseNotifier(
    enabled: boolean,
    plain: { notifyLeaderRequest(record: ReviewWakeCandidate): Promise<void> },
    store: ReturnType<typeof createReviewDeferStore>,
  ): { notifyLeaderRequest(record: ReviewWakeCandidate): Promise<void> } {
    return enabled
      ? createReviewDeferGate({ notify: plain, store, nowIso: () => NOW })
      : plain
  }

  it('hands back the untouched notifier when the plane is off, by reference', async () => {
    const store = createReviewDeferStore()
    const double = recorder()
    const chosen = chooseNotifier(false, double.notify, store)
    expect(chosen).toBe(double.notify)
    // A defer filed anyway (there is no way to file one while off, but the state shape allows the question)
    // changes nothing: the OFF path does not consult the store, so a stray entry cannot mute a wake.
    setReviewDefer(store, { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: 1, notBeforeIso: later(60 * 1000), reasonCode: 'LEADER_REQUESTED' }, NOW)
    await chosen.notifyLeaderRequest(wake())
    expect(double.seen).toHaveLength(1)
  })

  it('wraps the same notifier when the plane is on, and the wrapped notifier is still the thing that delivers', async () => {
    const store = createReviewDeferStore()
    const double = recorder()
    const chosen = chooseNotifier(true, double.notify, store)
    expect(chosen).not.toBe(double.notify)
    const theWake = wake()
    await chosen.notifyLeaderRequest(theWake)
    expect(double.seen).toHaveLength(1)
    // Identity of the delivered object, not equality: the gate composes the notifier, it does not re-render a
    // notification somebody else owns.
    expect(double.seen[0]).toBe(theWake)
  })

  it('leaves the case-less row on the old path with the plane fully on', async () => {
    const store = createReviewDeferStore()
    const double = recorder()
    const gate = createReviewDeferGate({ notify: double.notify, store, nowIso: () => NOW })
    // Even with a quiet standing for the identified case, a pre-Alpha.4 row must be delivered: muting what
    // the lane cannot attribute is the one error the whole design is arranged to make impossible.
    setReviewDefer(store, { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: 1, notBeforeIso: later(60 * 1000), reasonCode: 'LEADER_REQUESTED' }, NOW)
    await gate.notifyLeaderRequest({ rootSessionId: ROOT, requestId: 'req-legacy' })
    expect(double.seen).toHaveLength(1)
    expect(store.entries.size).toBe(1)
    await gate.notifyLeaderRequest(wake())
    expect(double.seen).toHaveLength(1)
  })
})

describe('A6-PR4/M — what a quiet does not do', () => {
  it('never rewrites the record it was handed', async () => {
    const store = createReviewDeferStore()
    const gate = createReviewDeferGate({ notify: recorder().notify, store, nowIso: () => NOW })
    setReviewDefer(store, { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: 1, notBeforeIso: later(60 * 1000), reasonCode: 'PLAN_NOT_IN_FORCE' }, NOW)
    const record = wake()
    const before = JSON.stringify(record)
    await gate.notifyLeaderRequest(record)
    expect(JSON.stringify(record)).toBe(before)
    // And the quiet does not become a field on it: a wake that carried its own suppression would be a wake
    // whose authority had been edited by a liveness helper.
    expect(Object.keys(record).sort()).toEqual(['approvalCaseId', 'legOrdinal', 'requestId', 'rootSessionId'])
  })

  it('claims no dedupe: two wakes for one case are two deliveries when no quiet stands', async () => {
    const store = createReviewDeferStore()
    const double = recorder()
    const gate = createReviewDeferGate({ notify: double.notify, store, nowIso: () => NOW })
    await gate.notifyLeaderRequest(wake())
    await gate.notifyLeaderRequest(wake())
    // The deliverer documents itself as at-least-once with no dedupe, and this lane does not quietly fix
    // that: "the same wake" is the wake kernel's concept, and PR4′ owns neither the kernel nor a second
    // merge state. Two decisions here that disagree with the kernel's would be the second switch again.
    expect(double.seen).toHaveLength(2)
  })

  it('loses a quiet on restart and answers with an early wake, which is the safe direction', async () => {
    const store = createReviewDeferStore()
    const double = recorder()
    const gate = createReviewDeferGate({ notify: double.notify, store, nowIso: () => NOW })
    setReviewDefer(store, { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: 1, notBeforeIso: later(30 * 60 * 1000), reasonCode: 'OFFICER_UNAVAILABLE' }, NOW)
    await gate.notifyLeaderRequest(wake())
    expect(double.seen).toHaveLength(0)
    // "Restart": the state is process-local, so this is the whole of it — a new store, nothing standing.
    const afterRestart = createReviewDeferStore()
    const restarted = createReviewDeferGate({ notify: double.notify, store: afterRestart, nowIso: () => NOW })
    await restarted.notifyLeaderRequest(wake())
    // An early wake is a Leader looking at a case that is genuinely still pending. A lost wake is a case with
    // no reviewer. Every failure of this store lands on the first side of that line, and this leg is the
    // reason the store is allowed to stay process-local in this PR.
    expect(double.seen).toHaveLength(1)
    expect(afterRestart.entries.size).toBe(0)
  })

  it('decides without delivering, and touches the store only to retire an expired floor', () => {
    const standing = createReviewDeferStore()
    setReviewDefer(standing, { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: 1, notBeforeIso: later(60 * 1000), reasonCode: 'LEADER_REQUESTED' }, NOW)
    const decision = decideReviewWake(standing, ROOT, wake(), NOW)
    expect(decision.decision).toBe('defer')
    expect(standing.entries.size).toBe(1)

    const expired = createReviewDeferStore()
    setReviewDefer(expired, { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: 1, notBeforeIso: later(60 * 1000), reasonCode: 'LEADER_REQUESTED' }, NOW)
    expect(expired.entries.size).toBe(1)
    expect(decideReviewWake(expired, ROOT, wake(), later(61 * 1000)).decision).toBe('deliver')
    // The only write a decision performs: an expired floor leaves, because a floor that has passed is not a
    // quiet, and keeping it would be a lie about state that nothing will clear later.
    expect(expired.entries.size).toBe(0)
  })

  it('lifts a quiet through the same store the gate reads, or the tool would be theatre', async () => {
    const store = createReviewDeferStore()
    const port = createReviewDeferPort({ store, nowIso: () => NOW })
    const double = recorder()
    const gate = createReviewDeferGate({ notify: double.notify, store, nowIso: () => NOW })
    port.set({ rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: 1, notBeforeIso: later(30 * 60 * 1000), reasonCode: 'LEADER_REQUESTED' })
    await gate.notifyLeaderRequest(wake())
    expect(double.seen).toHaveLength(0)
    const lifted = cancelReviewDefer(store, { rootSessionId: ROOT, approvalCaseId: CASE_ID, legOrdinal: 1 }, NOW)
    expect(lifted.ok).toBe(true)
    await gate.notifyLeaderRequest(wake())
    expect(double.seen).toHaveLength(1)
  })

  it('gives a second gate on the same store the same answer, which is why the plane builds one', async () => {
    const store = createReviewDeferStore()
    const double = recorder()
    const first = createReviewDeferGate({ notify: double.notify, store, nowIso: () => NOW })
    const second = createReviewDeferGate({ notify: double.notify, store, nowIso: () => NOW })
    fileQuiet(store)
    await first.notifyLeaderRequest(wake())
    await second.notifyLeaderRequest(wake())
    // Two gates over one store are consistent, so nothing here is a correctness hazard — but two gates over
    // TWO stores would be, and a store per consumer is exactly what a lazy wiring produces. The hygiene suite
    // counts `createReviewDeferStore(` in root.ts for that reason; this leg records what the alternative
    // would have to look like before anybody reaches for it.
    expect(double.seen).toHaveLength(0)
  })
})

