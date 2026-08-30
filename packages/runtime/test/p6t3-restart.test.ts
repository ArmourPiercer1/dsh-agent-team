/**
 * P6-T3 Suite 3 — durability across restart + pending-delivery recovery.
 *
 * The unit-restart model (P6-T1): the same scratch dir is closed and
 * reopened — every durable fact survives, every port is fresh.
 *
 *  1. a pending DIRECT intent (intent durable, no confirmation — the port
 *     failed before the restart, R2) is recovered exactly once, through
 *     the FRESH port, with the ORIGINAL correlation (factSequence of the
 *     pre-restart intent fact);
 *  2. a pending MEDIATED intent is recovered onto the LEADER session
 *     (the re-derived plan uses the fresh governance state);
 *  3. the already-confirmed send is NOT re-delivered and a second
 *     recovery run is a no-op (exactly-once on the ledger, R3);
 *  4. dead/missing targets at recovery time are SKIPPED with the closed
 *     reason — no side effects, the intents stay pending (R4);
 *  5. recovery aborts on the first hard failure (R5): the earlier
 *     confirmations stay durable and a clean retry recovers ONLY the
 *     remaining pending intent.
 */

import { describe, expect, it } from 'vitest'
import type { TeamDomain } from '../../storage/repositories/index.js'
import type { TeamRuntime } from '../admission/index.js'
import {
  MESSAGING_ERROR_CODES,
  createMessagingCoordinator,
} from '../messaging/index.js'
import type {
  AttributedSessionInput,
  PendingDeliveryRecoveryResult,
} from '../messaging/index.js'
import {
  destroyP6T1World,
  restartP6T1World,
} from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  assertMessagingCode,
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

interface RestartState {
  readonly world2: P6T1World
  readonly port2: FakeSessionInputPort
  readonly pendingDirectSequence: number
  readonly pendingMedSequence: number
  readonly ab1Sequence: number
  readonly ab2Sequence: number
  readonly result1: PendingDeliveryRecoveryResult
  readonly result2: PendingDeliveryRecoveryResult
  readonly inputDirect: AttributedSessionInput
  readonly inputMed: AttributedSessionInput
  readonly scoutInputsAfterRecovery: number
  readonly okConfirmations: number
  readonly totalInputs: number
  readonly abortError: unknown
  readonly abortResult: PendingDeliveryRecoveryResult | undefined
  readonly ab1ConfirmationsAfterAbort: number
  readonly scoutInputsAfterAbort: number
  readonly resultAfterAbort: PendingDeliveryRecoveryResult
  readonly leaderInputs: number
}

// ---------------------------------------------------------------------------
// Setup — world1: two failing sends (direct + mediated) + one healthy send;
// restart; recover; then the R5 abort scenario on world2.
// ---------------------------------------------------------------------------
let rt!: RestartState
{
  const world1 = await createP6T3World('p6t3x-restart', [
    'leader',
    'worker',
    'scout',
  ])
  try {
    const port1 = new FakeSessionInputPort()
    const coordinator1 = createP6T3Coordinator(world1, port1)
    const { worker, scout } = P6T3_SEEDS

    // A DIRECT intent that fails at the port (R2: intent stays durable).
    port1.setFailures(1)
    await expectMessagingRejection(
      coordinator1,
      makeSendRequest({
        caller: leaderCaller(),
        recipientInstanceId: worker.instanceId,
        body: 'direct send that fails before the restart',
        requestToken: 'tok-p6t3-rst-direct',
      }),
      MESSAGING_ERROR_CODES.MESSAGING_DELIVERY_FAILED,
    )

    // A MEDIATED intent (no grant) that fails at the port.
    port1.setFailures(1)
    await expectMessagingRejection(
      coordinator1,
      makeSendRequest({
        caller: memberCaller(worker.instanceId),
        recipientInstanceId: scout.instanceId,
        body: 'mediated send that fails before the restart',
        requestToken: 'tok-p6t3-rst-med',
      }),
      MESSAGING_ERROR_CODES.MESSAGING_DELIVERY_FAILED,
    )

    // A healthy send: delivered + confirmed in world1.
    await coordinator1.sendTeamMessage(
      makeSendRequest({
        caller: leaderCaller(),
        recipientInstanceId: scout.instanceId,
        body: 'delivered before the restart',
        requestToken: 'tok-p6t3-rst-ok',
      }),
    )

    const pendingDirectSequence = findFacts(
      world1,
      'team-coordination-recorded',
      (p) => p['requestToken'] === 'tok-p6t3-rst-direct',
    )[0]!.sequence
    const pendingMedSequence = findFacts(
      world1,
      'team-coordination-recorded',
      (p) => p['requestToken'] === 'tok-p6t3-rst-med',
    )[0]!.sequence

    // RESTART — close the domain, reopen the SAME scratch dir.
    const world2 = await restartP6T1World(world1)
    const port2 = new FakeSessionInputPort()
    const coordinator2 = createP6T3Coordinator(world2, port2)

    const result1 = await coordinator2.recoverPendingDeliveries(P6T3_ROOT)
    const result2 = await coordinator2.recoverPendingDeliveries(P6T3_ROOT)
    // captured BEFORE the R5 scenario below (the aborted run still
    // delivers ab1 to the scout session).
    const scoutInputsAfterRecovery =
      port2.inputsFor(scout.childSessionId).length
    const totalInputsAfterRecovery = port2.inputs.length

    // -- R5: two more pending intents, then an aborting recovery ---------
    port2.setFailures(1)
    await expectMessagingRejection(
      coordinator2,
      makeSendRequest({
        caller: leaderCaller(),
        recipientInstanceId: scout.instanceId,
        body: 'ab1: direct, fails at the port',
        requestToken: 'tok-p6t3-rst-ab1',
      }),
      MESSAGING_ERROR_CODES.MESSAGING_DELIVERY_FAILED,
    )
    port2.setFailures(1)
    await expectMessagingRejection(
      coordinator2,
      makeSendRequest({
        caller: memberCaller(worker.instanceId),
        recipientInstanceId: scout.instanceId,
        body: 'ab2: mediated, fails at the port',
        requestToken: 'tok-p6t3-rst-ab2',
      }),
      MESSAGING_ERROR_CODES.MESSAGING_DELIVERY_FAILED,
    )
    const ab1Sequence = findFacts(
      world2,
      'team-coordination-recorded',
      (p) => p['requestToken'] === 'tok-p6t3-rst-ab1',
    )[0]!.sequence
    const ab2Sequence = findFacts(
      world2,
      'team-coordination-recorded',
      (p) => p['requestToken'] === 'tok-p6t3-rst-ab2',
    )[0]!.sequence

    // The leader session is faulty: ab1 (scout session) recovers, ab2
    // (leader session, mediated) fails → the run aborts (R5).
    port2.setFailSession(P6T3_SEEDS.leader.childSessionId)
    let abortError: unknown
    let abortResult: PendingDeliveryRecoveryResult | undefined
    try {
      abortResult = await coordinator2.recoverPendingDeliveries(P6T3_ROOT)
    } catch (error) {
      abortError = error
    }
    port2.setFailSession(undefined)

    // The clean retry recovers ONLY the remaining pending intent (ab2).
    const resultAfterAbort =
      await coordinator2.recoverPendingDeliveries(P6T3_ROOT)

    rt = {
      world2,
      port2,
      pendingDirectSequence,
      pendingMedSequence,
      ab1Sequence,
      ab2Sequence,
      result1,
      result2,
      inputDirect: port2.inputsFor(worker.childSessionId)[0]!,
      inputMed: port2.inputsFor(P6T3_SEEDS.leader.childSessionId)[0]!,
      scoutInputsAfterRecovery,
      okConfirmations: findFacts(
        world2,
        'team-message-delivered',
        (p) => p['requestToken'] === 'tok-p6t3-rst-ok',
      ).length,
      totalInputs: totalInputsAfterRecovery,
      abortError,
      abortResult,
      ab1ConfirmationsAfterAbort: findFacts(
        world2,
        'team-message-delivered',
        (p) => p['requestToken'] === 'tok-p6t3-rst-ab1',
      ).length,
      scoutInputsAfterAbort: port2.inputsFor(scout.childSessionId).length,
      resultAfterAbort,
      leaderInputs: port2.inputsFor(P6T3_SEEDS.leader.childSessionId).length,
    }
  } finally {
    await destroyP6T1World(rt?.world2 ?? world1)
  }
}

// ---------------------------------------------------------------------------
// Setup 2 — the R4 skip matrix over a hand-rolled fake TeamDomain (no
// persistence): the recovery code path is identical — the coordinator only
// uses the repositories. It runs BEFORE the `it`s (the plain-node shim has
// no async `it`); they assert on the captured results.
// ---------------------------------------------------------------------------
interface FakeRecoveryState {
  readonly result: PendingDeliveryRecoveryResult
  readonly putCount: number
  readonly inputs: readonly AttributedSessionInput[]
}

let fake!: FakeRecoveryState
{
  const fakeEntries = [
    {
      schemaVersion: 1,
      sequence: 1,
      rootSessionId: 'root-fake-team',
      factType: 'team-coordination-recorded',
      payload: {
        action: 'send-message',
        caller: { kind: 'instance', instanceId: 'inst-leader', role: 'leader' },
        targetInstanceId: 'inst-p6t3fake-d1',
        recipientInstanceId: 'inst-p6t3fake-d1',
        body: 'direct, target missing',
        requestToken: 'tok-fake-1',
        at: '2026-09-01T10:00:00Z',
      },
    },
    {
      schemaVersion: 1,
      sequence: 2,
      rootSessionId: 'root-fake-team',
      factType: 'team-coordination-recorded',
      payload: {
        action: 'send-message',
        caller: { kind: 'instance', instanceId: 'inst-p6t3fake-m1', role: 'member' },
        targetInstanceId: 'inst-p6t3fake-d2',
        recipientInstanceId: 'inst-p6t3fake-d2',
        body: 'mediated, leader archived',
        requestToken: 'tok-fake-2',
        at: '2026-09-01T10:01:00Z',
      },
    },
    {
      schemaVersion: 1,
      sequence: 3,
      rootSessionId: 'root-fake-team',
      factType: 'team-coordination-recorded',
      payload: {
        action: 'send-message',
        caller: { kind: 'instance', instanceId: 'inst-leader', role: 'leader' },
        targetInstanceId: 'inst-p6t3fake-d3',
        recipientInstanceId: 'inst-p6t3fake-d3',
        body: 'already confirmed',
        requestToken: 'tok-fake-3',
        at: '2026-09-01T10:02:00Z',
      },
    },
    {
      schemaVersion: 1,
      sequence: 4,
      rootSessionId: 'root-fake-team',
      factType: 'team-message-delivered',
      payload: {
        action: 'send-message',
        requestToken: 'tok-fake-3',
        factSequence: 3,
        fromInstanceId: 'inst-leader',
        recipientInstanceId: 'inst-p6t3fake-d3',
        deliveryMode: 'direct',
        deliveredToInstanceId: 'inst-p6t3fake-d3',
        deliveredToSessionId: 'session-child-fake-d3',
        at: '2026-09-01T10:02:30Z',
      },
    },
  ]
  let fakePutCount = 0
  const fakeRepositories = {
    memberInstances: {
      // only the (ARCHIVED) leader exists — d1/d2 are missing.
      get: (_root: string, instanceId: string) => {
        if (instanceId === 'inst-leader') {
          return {
            instanceId: 'inst-leader',
            templateId: 'leader',
            label: 'leader',
            childSessionId: 'session-child-fake-leader',
            lifecycle: 'ARCHIVED',
          }
        }
        return undefined
      },
      list: () => [],
    },
    overrides: { list: () => [] },
    ledger: {
      list: () => fakeEntries,
      get: (sequence: number) =>
        fakeEntries.find((entry) => entry.sequence === sequence),
      allocateSequence: async (): Promise<number> => ++fakePutCount,
      put: async (_entry: unknown): Promise<void> => {
        fakePutCount += 1
      },
    },
  }
  const fakeDomain = {
    repositories: fakeRepositories,
  } as unknown as TeamDomain
  const fakeRuntime = {
    performAction: async (): Promise<never> => {
      throw new Error('the fake runtime is unused in the recovery test')
    },
  } as unknown as TeamRuntime
  const fakePort = new FakeSessionInputPort()
  const coordinator = createMessagingCoordinator({
    teamRuntime: fakeRuntime,
    teamDomain: fakeDomain,
    sessionInput: fakePort,
    now: () => '2026-09-01T10:05:00Z',
  })

  const result = await coordinator.recoverPendingDeliveries('root-fake-team')
  fake = {
    result,
    putCount: fakePutCount,
    inputs: fakePort.inputs,
  }
}

describe('P6-T3 restart durability + pending-delivery recovery', () => {
  it('1. the pending DIRECT intent is recovered exactly once, through the fresh port, with the ORIGINAL correlation', () => {
    expect(rt.result1.recovered.length).toBe(2)
    expect(rt.result1.skipped.length).toBe(0)
    const recovered = rt.result1.recovered[0]!
    expect(recovered.requestToken).toBe('tok-p6t3-rst-direct')
    expect(recovered.factSequence).toBe(rt.pendingDirectSequence)
    expect(recovered.deliveryMode).toBe('direct')
    expect(recovered.deliveredToInstanceId).toBe(
      P6T3_SEEDS.worker.instanceId,
    )
    expect(recovered.deliveredSequence).toBeGreaterThan(
      recovered.factSequence,
    )

    const input = rt.inputDirect
    expect(input.sessionId).toBe(P6T3_SEEDS.worker.childSessionId)
    expect(input.attribution).toEqual({
      kind: 'team-relay',
      fromInstanceId: 'inst-leader',
      intendedForInstanceId: P6T3_SEEDS.worker.instanceId,
      correlation: {
        requestToken: 'tok-p6t3-rst-direct',
        factSequence: rt.pendingDirectSequence,
      },
    })
    expect(input.text).toBe(
      `[team-relay] from=inst-leader (label: leader) to=${P6T3_SEEDS.worker.instanceId} (label: existing-worker)\ndirect send that fails before the restart`,
    )
  })

  it('2. the pending MEDIATED intent is recovered onto the LEADER session (the plan is re-derived from the fresh state)', () => {
    const recovered = rt.result1.recovered[1]!
    expect(recovered.requestToken).toBe('tok-p6t3-rst-med')
    expect(recovered.factSequence).toBe(rt.pendingMedSequence)
    expect(recovered.deliveryMode).toBe('mediated')
    expect(recovered.deliveredToInstanceId).toBe('inst-leader')

    const input = rt.inputMed
    expect(input.sessionId).toBe(P6T3_SEEDS.leader.childSessionId)
    expect(input.attribution).toEqual({
      kind: 'team-relay',
      fromInstanceId: P6T3_SEEDS.worker.instanceId,
      intendedForInstanceId: P6T3_SEEDS.scout.instanceId,
      correlation: {
        requestToken: 'tok-p6t3-rst-med',
        factSequence: rt.pendingMedSequence,
      },
    })
    expect(input.text).toBe(
      `[team-relay:mediated via leader] from=${P6T3_SEEDS.worker.instanceId} (label: existing-worker) intended-for=${P6T3_SEEDS.scout.instanceId} (label: existing-scout)\nmediated send that fails before the restart`,
    )
  })

  it('3. the already-confirmed send is NOT re-delivered; the second recovery run is a no-op (exactly-once)', () => {
    // the ok send's input went to the world1 port; the fresh port2 never
    // saw it, and its single confirmation fact survived the restart.
    expect(rt.scoutInputsAfterRecovery).toBe(0)
    expect(rt.okConfirmations).toBe(1)
    expect(rt.result2.recovered.length).toBe(0)
    expect(rt.result2.skipped.length).toBe(0)
    // exactly the two recovered inputs on the fresh port
    expect(rt.totalInputs).toBe(2)
  })

  it('4. dead/missing targets at recovery are SKIPPED with the closed reason — no side effects, the intents stay pending (R4)', () => {
    expect(fake.result.rootSessionId).toBe('root-fake-team')
    expect(fake.result.recovered.length).toBe(0)
    expect(fake.result.skipped).toEqual([
      {
        requestToken: 'tok-fake-1',
        factSequence: 1,
        reason: 'delivery-target-missing',
      },
      {
        requestToken: 'tok-fake-2',
        factSequence: 2,
        reason: 'delivery-target-not-live',
      },
    ])
    // no side effects: no input, no confirmation write
    expect(fake.inputs.length).toBe(0)
    expect(fake.putCount).toBe(0)
  })

  it('5. recovery aborts on the first hard failure (R5): earlier confirmations stay durable; the clean retry recovers ONLY the remainder', () => {
    const checked = assertMessagingCode(
      rt.abortError,
      MESSAGING_ERROR_CODES.MESSAGING_DELIVERY_FAILED,
    )
    expect(checked.code).toBe(MESSAGING_ERROR_CODES.MESSAGING_DELIVERY_FAILED)
    // the run rejected — it returned no result
    expect(rt.abortResult).toBe(undefined)

    // ab1 (the earlier pending, healthy scout session) delivered +
    // confirmed BEFORE the abort: its confirmation is durable.
    expect(rt.ab1ConfirmationsAfterAbort).toBe(1)
    expect(rt.scoutInputsAfterAbort).toBe(1)

    // the clean retry recovers ONLY ab2 (ab1 now confirmed, R3).
    expect(rt.resultAfterAbort.recovered.length).toBe(1)
    expect(rt.resultAfterAbort.skipped.length).toBe(0)
    const recovered = rt.resultAfterAbort.recovered[0]!
    expect(recovered.requestToken).toBe('tok-p6t3-rst-ab2')
    expect(recovered.factSequence).toBe(rt.ab2Sequence)
    expect(recovered.deliveryMode).toBe('mediated')
    expect(recovered.deliveredToInstanceId).toBe('inst-leader')
    expect(recovered.deliveredSequence).toBeGreaterThan(recovered.factSequence)
    // the ab2 input landed on the leader session (mediated path)
    expect(rt.leaderInputs).toBe(2)
  })
})
