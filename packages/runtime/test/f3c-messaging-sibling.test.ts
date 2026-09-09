/**
 * F3-C (repair-r1) — the messaging coordinator's PRIVATE per-team chain
 * lock scope (INV-9.1, private-chain extension; the H2 sibling of F3-A).
 *
 * The coordinator's own lock map (its private chain) was held across the
 * whole delivery: plan + target read, the `SessionInputPort` call (the
 * recipient's ENTIRE model execution — the production port is
 * `followup` + `whenIdle`), and the confirmation commit. A
 * `team_send_message` issued by the recipient inside the
 * message-triggered turn re-enters this same coordinator and, pre-fix,
 * queued behind the outer send's own pending tail on the non-re-entrant
 * private map: the H2 self-deadlock (latent — no round-1 data hit it,
 * but the T6.1 relay-turn proves models call team tools inside such
 * turns).
 *
 * The fix under test (INV-9.1: "no chain — shared or private — may be
 * held across a turn it observes"): `deliverOne` is split into three
 * lock-scope phases of the SAME private chain — Phase A (the intent fact
 * read + plan derivation + target liveness + input rendering) under the
 * chain, RELEASE, Phase B (the session input port call — the recipient's
 * model execution) WITHOUT the chain, Phase C (the confirmation fact
 * commit) re-acquiring the chain. The recovery scan and its R4
 * skip-verdicts keep their own brief acquisitions; the scan no longer
 * holds the chain across a recipient turn.
 *
 * Coverage (contract rows F3C-T1…F3C-T2):
 * - T1 (the H2 re-entry; red pre-fix = deadlock): a fake
 *   `SessionInputPort` that, from inside ONE outer delivery, issues a
 *   second `sendTeamMessage` through the SAME coordinator (the
 *   recipient's `team_send_message` inside the message-triggered turn)
 *   — post-fix the outer send resolves, both intents and both
 *   confirmations are durable exactly once, the nested input lands
 *   BEFORE the outer one (the re-entry provably happened mid-delivery),
 *   and the ledger stays gap-free; pre-fix the nested send queues behind
 *   the outer's own pending tail and NOTHING can progress (the
 *   deterministic microtask-budget probe exhausts — red);
 * - T2 (R3 exactly-once under the released Phase B): two CONCURRENT
 *   `recoverPendingDeliveries` runs over one pending intent — both
 *   re-deliver the input (the documented at-least-once residue,
 *   detectable through the correlation token) but only ONE confirmation
 *   fact is committed: the second Phase C converges on the existing
 *   fact and reports the same `deliveredSequence`.
 *
 * House pattern of the runtime package: async world construction and
 * action execution at the TOP LEVEL (one bare block per scenario, each
 * destroyed in its finally); every `it` below asserts the captured
 * constants synchronously (the plain-node shim supports no async `it`).
 *
 * @module @dsh-agent-team/runtime/test/f3c-messaging-sibling
 */

import { describe, expect, it } from 'vitest'
import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js'
import { MESSAGING_ERROR_CODES } from '../messaging/index.js'
import type {
  AttributedSessionInput,
  SendTeamMessageOutcome,
  SessionInputPort,
} from '../messaging/index.js'
import {
  destroyP6T1World,
} from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  createP6T3Coordinator,
  createP6T3World,
  expectMessagingRejection,
  FakeSessionInputPort,
  findFacts,
  leaderCaller,
  makeSendRequest,
  memberCaller,
  P6T3_ROOT,
  P6T3_SEEDS,
} from './p6t3-helpers.js'
import { destroyDir, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'

/**
 * Scratch hygiene: a crashed previous run of this suite (e.g. the
 * pre-fix RED check, where deadlocked promise chains are abandoned) can
 * leave a stale `f3c-*` scratch dir behind; the deterministic basenames
 * would then collide on re-run. Clean ONLY this suite's own basenames
 * before building any world (test scratch under
 * packages/testkit/test/.tmp-fault — gitignored; destroyDir is a no-op
 * when absent).
 */
const F3C_SCRATCH_BASES = [
  'f3c-t1',
  'f3c-t2',
]
for (const base of F3C_SCRATCH_BASES) {
  destroyDir(scratchDir(base))
}

// --- event-loop pump (deterministic hang detection — no wall clock) ------------

interface PumpFlag {
  done: boolean
  value?: unknown
}

/**
 * Pump the event loop (microtasks + zero-delay macrotask ticks) until
 * `cond` holds or the budget is exhausted. Returns whether `cond` held
 * in time. This is the bounded hang probe: a true deadlock (a promise
 * chain waiting on itself) can make NO progress under any pumping, so a
 * budget exhaustion is a definitive hang verdict without a wall clock.
 */
async function pumpWhile(cond: () => boolean, budget = 200_000): Promise<boolean> {
  for (let i = 1; i <= budget; i += 1) {
    if (cond()) return true
    if (i % 1000 === 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    } else {
      await Promise.resolve()
    }
  }
  return cond()
}

/**
 * Start an action and observe it through a pump flag (NEVER awaited
 * directly — a hung promise must not hang the suite).
 */
function trackAction(action: Promise<unknown>): {
  readonly flag: PumpFlag
  readonly resolved: (budget?: number) => Promise<boolean>
} {
  const flag: PumpFlag = { done: false }
  void action.then(
    (value) => {
      flag.value = value
      flag.done = true
    },
    (error) => {
      flag.value = error
      flag.done = true
    },
  )
  return { flag, resolved: (budget?: number) => pumpWhile(() => flag.done, budget) }
}

// --- fakes ----------------------------------------------------------------------

/**
 * The ONE-SHOT re-entrant session input port fake: the first submission
 * (the outer delivery — the recipient's message-triggered turn) awaits a
 * re-entry callback that issues a second `sendTeamMessage` through the
 * SAME coordinator, exactly like the production port
 * (`followup` + `whenIdle` = the recipient's whole model turn). The
 * re-entry is one-shot so the nested delivery itself does not re-enter
 * again (one model turn, one tool call — the faithful H2 shape).
 */
class ReentrantSessionInputPort implements SessionInputPort {
  /** Every successfully submitted input, in order. */
  readonly inputs: AttributedSessionInput[] = []
  /** The one-shot re-entry (the recipient turn's team tool call). */
  private reentrancy: ((input: AttributedSessionInput) => Promise<void>) | undefined

  /** Arm the one-shot re-entry (fired on the next submission only). */
  setReentrancy(fn: ((input: AttributedSessionInput) => Promise<void>) | undefined): void {
    this.reentrancy = fn
  }

  async submitAttributedInput(input: AttributedSessionInput): Promise<void> {
    // One tick, so the outer Phase B is observably in flight when the
    // re-entry fires (deterministic input ordering).
    await Promise.resolve()
    const reentrancy = this.reentrancy
    if (reentrancy !== undefined) {
      this.reentrancy = undefined // one-shot
      await reentrancy(input)
    }
    this.inputs.push(input)
  }
}

// --- scenario captures -----------------------------------------------------------

interface T1Case {
  readonly resolved: boolean
  readonly outerStatus: string | undefined
  readonly outerFactSequence: number | undefined
  readonly outerDeliveredSequence: number | undefined
  readonly outerIntentCount: number
  readonly innerIntentCount: number
  readonly outerConfirmCount: number
  readonly innerConfirmCount: number
  readonly innerFactSequence: number | undefined
  readonly nestedDeliveryMode: string | undefined
  readonly nestedDeliveredTo: string | undefined
  readonly inputCount: number
  readonly firstInputSession: string | undefined
  readonly secondInputSession: string | undefined
  readonly firstInputAttribution: unknown
  readonly secondInputAttribution: unknown
  readonly gaps: number[]
}

interface T2Case {
  readonly pendingIntentSequence: number
  readonly r1Recovered: number
  readonly r2Recovered: number
  readonly r1Token: unknown
  readonly r1FactSequence: unknown
  readonly r1DeliveryMode: unknown
  readonly r1DeliveredTo: unknown
  readonly r1Sequence: number | undefined
  readonly r2Sequence: number | undefined
  readonly sameSequence: boolean
  readonly confirmCount: number
  readonly workerInputCount: number
  readonly inputCorrelations: readonly (readonly [unknown, unknown])[]
  readonly gaps: number[]
}

let t1: T1Case
let t2: T2Case

// --- T1: the H2 nested-send re-entry (red pre-fix = deadlock) --------------------
//
// Production shape: the coordinator's OWN private chain map (its
// `withTeamLock` seam; the facade's map is the facade's). The outer
// leader→worker delivery's port call is the worker's model turn; inside
// that turn the worker issues `team_send_message` (worker→scout — the
// default mediated member→member path, onto the LEADER session) through
// the SAME coordinator. Pre-fix: the outer send holds the private chain
// across the whole port call, so the nested send's own Phase-(delivery)
// acquisition queues behind the outer's pending tail and NOTHING can
// progress (deadlock → the budget exhausts, red). Post-fix (INV-9.1):
// the chain is released during the port call; the nested send runs to
// completion (intent + confirmation durable) inside the outer's
// delivery; the outer then confirms and resolves.

{
  const world = await createP6T3World('f3c-t1', [
    'leader',
    'worker',
    'scout',
  ])
  try {
    const port = new ReentrantSessionInputPort()
    const coordinator = createP6T3Coordinator(world, port)
    const { worker, scout } = P6T3_SEEDS

    let nestedOutcome: SendTeamMessageOutcome | undefined
    port.setReentrancy(async () => {
      // The recipient's own team tool during the message-triggered turn
      // (the faithful H2 re-entry): a member→member send, default
      // mediated path.
      nestedOutcome = await coordinator.sendTeamMessage(
        makeSendRequest({
          caller: memberCaller(worker.instanceId),
          recipientInstanceId: scout.instanceId,
          body: 'nested send from inside the recipient turn',
          requestToken: 'tok-f3c-inner',
        }),
      )
    })

    const tracked = trackAction(
      coordinator.sendTeamMessage(
        makeSendRequest({
          caller: leaderCaller(),
          recipientInstanceId: worker.instanceId,
          subject: 'outer',
          body: 'outer send',
          requestToken: 'tok-f3c-outer',
        }),
      ),
    )
    const resolved = await tracked.resolved()
    const outer = resolved
      ? (tracked.flag.value as SendTeamMessageOutcome | undefined)
      : undefined

    const outerIntent = findFacts(
      world,
      'team-coordination-recorded',
      (p) => p['requestToken'] === 'tok-f3c-outer',
    )
    const innerIntent = findFacts(
      world,
      'team-coordination-recorded',
      (p) => p['requestToken'] === 'tok-f3c-inner',
    )
    const outerConfirm = findFacts(
      world,
      'team-message-delivered',
      (p) => p['requestToken'] === 'tok-f3c-outer',
    )
    const innerConfirm = findFacts(
      world,
      'team-message-delivered',
      (p) => p['requestToken'] === 'tok-f3c-inner',
    )

    t1 = {
      resolved,
      outerStatus: outer?.status,
      outerFactSequence: outer?.factSequence,
      outerDeliveredSequence: outer?.deliveredSequence,
      outerIntentCount: outerIntent.length,
      innerIntentCount: innerIntent.length,
      outerConfirmCount: outerConfirm.length,
      innerConfirmCount: innerConfirm.length,
      innerFactSequence: innerIntent[0]?.sequence,
      nestedDeliveryMode: nestedOutcome?.deliveryMode,
      nestedDeliveredTo: nestedOutcome?.deliveredToInstanceId,
      inputCount: port.inputs.length,
      firstInputSession: port.inputs[0]?.sessionId,
      secondInputSession: port.inputs[1]?.sessionId,
      firstInputAttribution: port.inputs[0]?.attribution,
      secondInputAttribution: port.inputs[1]?.attribution,
      gaps: world.domain.repositories.ledger.gaps(),
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- T2: R3 exactly-once confirmation under the released Phase B -----------------
//
// The released Phase B makes two CONCURRENT deliveries of the same
// pending intent possible (pre-fix the whole scan+delivery was one
// critical section). The R3 exactly-once-on-ledger ruling must survive:
// both runs re-deliver the session input (the documented at-least-once
// residue — detectable through the correlation token), but only the
// FIRST Phase C commits a confirmation; the second converges on the
// existing fact and reports its sequence. Deterministic: with the
// recording fakes the private-chain discipline orders the phases
// R1-scan < R2-scan < R1-R4 < R2-R4 < R1-PhaseA < R2-PhaseA <
// R1-PhaseC < R2-PhaseC.

{
  const world = await createP6T3World('f3c-t2', [
    'leader',
    'worker',
  ])
  try {
    const port = new FakeSessionInputPort()
    const coordinator = createP6T3Coordinator(world, port)
    const { worker } = P6T3_SEEDS

    // One pending intent: the port fails the delivery (R2: the intent
    // stays durable WITHOUT a confirmation).
    port.setFailures(1)
    await expectMessagingRejection(
      coordinator,
      makeSendRequest({
        caller: leaderCaller(),
        recipientInstanceId: worker.instanceId,
        body: 'race: one pending intent, two concurrent recoveries',
        requestToken: 'tok-f3c-race',
      }),
      MESSAGING_ERROR_CODES.MESSAGING_DELIVERY_FAILED,
    )
    const pendingIntentSequence = findFacts(
      world,
      'team-coordination-recorded',
      (p) => p['requestToken'] === 'tok-f3c-race',
    )[0]!.sequence

    // Two concurrent recovery runs over the SAME pending intent.
    const [r1, r2] = await Promise.all([
      coordinator.recoverPendingDeliveries(P6T3_ROOT),
      coordinator.recoverPendingDeliveries(P6T3_ROOT),
    ])

    const workerInputs = port.inputsFor(worker.childSessionId)
    t2 = {
      pendingIntentSequence,
      r1Recovered: r1.recovered.length,
      r2Recovered: r2.recovered.length,
      r1Token: r1.recovered[0]?.requestToken,
      r1FactSequence: r1.recovered[0]?.factSequence,
      r1DeliveryMode: r1.recovered[0]?.deliveryMode,
      r1DeliveredTo: r1.recovered[0]?.deliveredToInstanceId,
      r1Sequence: r1.recovered[0]?.deliveredSequence,
      r2Sequence: r2.recovered[0]?.deliveredSequence,
      sameSequence: r1.recovered[0]?.deliveredSequence === r2.recovered[0]?.deliveredSequence,
      confirmCount: findFacts(
        world,
        'team-message-delivered',
        (p) => p['requestToken'] === 'tok-f3c-race',
      ).length,
      workerInputCount: workerInputs.length,
      inputCorrelations: workerInputs.map((input) => [
        input.attribution.correlation.requestToken,
        input.attribution.correlation.factSequence,
      ]),
      gaps: world.domain.repositories.ledger.gaps(),
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// ---------------------------------------------------------------------------

describe('F3-C messaging coordinator private chain (INV-9.1, H2)', () => {
  it('T1 (F3C-T1, the H2 re-entry): a nested team_send_message from inside the recipient turn resolves against the private chain — no deadlock — and both sends are durable exactly once', () => {
    // The outer send RESOLVES (pre-fix: the deterministic budget
    // exhausts — the nested send waits behind the outer's own pending
    // tail on the non-re-entrant private map).
    expect(t1.resolved).toBe(true)
    expect(t1.outerStatus).toBe('delivered')

    // The outer send's two-record split is intact.
    expect(t1.outerIntentCount).toBe(1)
    expect(t1.outerConfirmCount).toBe(1)
    expect(typeof t1.outerFactSequence).toBe('number')
    expect(t1.outerDeliveredSequence).toBeGreaterThan(t1.outerFactSequence!)

    // The NESTED send (the recipient's own team tool mid-turn) ran to
    // completion INSIDE the outer delivery: its intent + confirmation
    // are durable exactly once, on the default mediated member→member
    // path (onto the leader's bound session).
    expect(t1.innerIntentCount).toBe(1)
    expect(t1.innerConfirmCount).toBe(1)
    expect(t1.nestedDeliveryMode).toBe('mediated')
    expect(t1.nestedDeliveredTo).toBe(String(LEADER_INSTANCE_ID))

    // The input ordering PROVES the re-entry happened mid-delivery:
    // the nested input (leader session, mediated) was submitted during
    // the outer port call, BEFORE the outer input (worker session) was
    // recorded.
    expect(t1.inputCount).toBe(2)
    expect(t1.firstInputSession).toBe(P6T3_ROOT)
    expect(t1.secondInputSession).toBe(P6T3_SEEDS.worker.childSessionId)

    // Both inputs carry their ORIGINAL correlation (the nested one
    // back to its own intent fact, the outer to the outer's).
    expect(t1.firstInputAttribution).toEqual({
      kind: 'team-relay',
      fromInstanceId: P6T3_SEEDS.worker.instanceId,
      intendedForInstanceId: P6T3_SEEDS.scout.instanceId,
      correlation: {
        requestToken: 'tok-f3c-inner',
        factSequence: t1.innerFactSequence,
      },
    })
    expect(t1.secondInputAttribution).toEqual({
      kind: 'team-relay',
      fromInstanceId: 'inst-leader',
      intendedForInstanceId: P6T3_SEEDS.worker.instanceId,
      correlation: {
        requestToken: 'tok-f3c-outer',
        factSequence: t1.outerFactSequence,
      },
    })

    // The ledger stays gap-free across the interleaved writes.
    expect(t1.gaps).toEqual([])
  })

  it('T2 (F3C-T2, R3 exactly-once): two concurrent recoveries of one pending intent both re-deliver the input (at-least-once) but commit exactly ONE confirmation', () => {
    // Both runs recover the same pending intent (both scans saw it
    // before either confirmation was durable).
    expect(t2.r1Recovered).toBe(1)
    expect(t2.r2Recovered).toBe(1)
    expect(t2.r1Token).toBe('tok-f3c-race')
    expect(t2.r1FactSequence).toBe(t2.pendingIntentSequence)
    expect(t2.r1DeliveryMode).toBe('direct')
    expect(t2.r1DeliveredTo).toBe(P6T3_SEEDS.worker.instanceId)

    // Exactly-once on the TeamLedger (R3): ONE confirmation fact for
    // the pending intent — the second Phase C converged on the first's.
    expect(t2.confirmCount).toBe(1)

    // Both runs report the SAME confirmation sequence (the converged
    // one).
    expect(typeof t2.r1Sequence).toBe('number')
    expect(t2.r1Sequence).toBeGreaterThan(t2.pendingIntentSequence)
    expect(t2.sameSequence).toBe(true)
    expect(t2.r2Sequence).toBe(t2.r1Sequence)

    // At-least-once on the session input (the documented residue):
    // both deliveries landed, both carrying the same correlation (the
    // detectable redelivery, per R3).
    expect(t2.workerInputCount).toBe(2)
    expect(t2.inputCorrelations[0]).toEqual([
      'tok-f3c-race',
      t2.pendingIntentSequence,
    ])
    expect(t2.inputCorrelations[1]).toEqual([
      'tok-f3c-race',
      t2.pendingIntentSequence,
    ])

    // The ledger stays gap-free.
    expect(t2.gaps).toEqual([])
  })
})
