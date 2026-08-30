/**
 * P6-T3 Suite 1 — send/delivery over the REAL durable world.
 *
 * The MUST-TEST delivery matrix of the task card, end to end through the
 * `createTeamRuntime` facade (P6-T2) — authority, envelope and quota are
 * the facade's; this suite only verifies the P6-T3 record split:
 *
 *  1. leader → member: DIRECT — the full two-record split (durable
 *     coordination fact + confirmation fact) and the ordinary attributed
 *     input on the target member session (nothing on any other session);
 *  2. member → leader: DIRECT (upward coordination is never mediated);
 *  3. human → member: DIRECT, attributed with `fromHumanId`;
 *  4. unknown target: the facade's `TEAM_RUNTIME_INSTANCE_NOT_FOUND`
 *     propagates UNMAPPED (single authority), zero durable writes, no
 *     input;
 *  5. label AND template addressing: the facade's
 *     `TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED` (invariant 19 — instanceId
 *     is the identity), zero durable writes;
 *  6. self-send: the module's `MESSAGING_SELF_SEND_REJECTED` (defined
 *     policy, checked before the facade), zero durable writes;
 *  7. the MUTED member sends: the facade's
 *     `TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS` (mediation never grants
 *     authority), zero durable writes;
 *  8. a failing session input port: `MESSAGING_DELIVERY_FAILED` leaves
 *     the intent fact durable WITHOUT a confirmation (R2) — and the
 *     same-world `recoverPendingDeliveries` redelivers it exactly once
 *     (R3 exactly-once on the ledger).
 *
 * Write-cost convention (FileStorageSeam): one durable ledger fact =
 * allocateSequence + put = 2 seam writes; a healthy delivery (two facts)
 * costs 4; every rejection costs 0.
 *
 * Red line (invariant 42): exactly two ledger fact families are created
 * (`team-coordination-recorded` by the facade, `team-message-delivered`
 * by the module) plus ordinary attributed inputs on member sessions —
 * NO Team-specific DSH SessionEvent vocabulary anywhere.
 *
 * Note: every durable-state probe (findFacts / gaps) runs in the setup
 * block while the world is open; the `it`s assert on captured snapshots.
 */

import { describe, expect, it } from 'vitest'
import type { LedgerEntry } from '../../storage/schema/index.js'
import { TEAM_RUNTIME_ERROR_CODES } from '../admission/index.js'
import { MESSAGING_ERROR_CODES } from '../messaging/index.js'
import type {
  AttributedSessionInput,
  MessagingCoordinator,
  PendingDeliveryRecoveryResult,
  SendTeamMessageOutcome,
  SendTeamMessageRequest,
} from '../messaging/index.js'
import {
  destroyP6T1World,
} from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  assertRuntimeCode,
} from './p6t2-helpers.js'
import {
  createP6T3Coordinator,
  createP6T3World,
  expectMessagingRejection,
  FakeSessionInputPort,
  findFacts,
  humanCaller,
  leaderCaller,
  makeSendRequest,
  memberCaller,
  P6T3_NOW,
  P6T3_ROOT,
  P6T3_SEEDS,
} from './p6t3-helpers.js'

/**
 * Expect one send to be rejected by the FACADE with a TeamRuntimeError of
 * exactly `code` (the module's contract: facade errors propagate unmapped)
 * and resolve to the checked code + details + the error name.
 */
function expectFacadeRejection(
  coordinator: MessagingCoordinator,
  request: SendTeamMessageRequest,
  code: string,
): Promise<{
  readonly code: string
  readonly details?: Record<string, unknown>
  readonly errorName: string
}> {
  return coordinator.sendTeamMessage(request).then(
    (outcome) => {
      throw new Error(
        `expectFacadeRejection('${code}'): the send was delivered (confirmation sequence ${outcome.deliveredSequence})`,
      )
    },
    (error: unknown) => {
      const checked = assertRuntimeCode(error, code)
      return { ...checked, errorName: (error as Error).name }
    },
  )
}

interface SendDeliveryState {
  readonly world: P6T1World
  readonly port: FakeSessionInputPort
  readonly leaderToWorker: {
    readonly outcome: SendTeamMessageOutcome
    readonly intent: LedgerEntry
    readonly confirm: LedgerEntry
    readonly input: AttributedSessionInput
    readonly inputCount: number
    readonly newWrites: number
    readonly gaps: number[]
  }
  readonly memberToLeader: {
    readonly outcome: SendTeamMessageOutcome
    readonly intent: LedgerEntry
    readonly confirm: LedgerEntry
    readonly input: AttributedSessionInput
  }
  readonly humanToWorker: {
    readonly outcome: SendTeamMessageOutcome
    readonly intent: LedgerEntry
    readonly confirm: LedgerEntry
    readonly input: AttributedSessionInput
  }
  readonly inputCountAfterValidSends: number
  readonly unknownTarget: {
    readonly code: string
    readonly errorName: string
    readonly newWrites: number
    readonly inputCount: number
  }
  readonly labelTarget: {
    readonly code: string
    readonly details?: Record<string, unknown>
    readonly newWrites: number
  }
  readonly templateTarget: {
    readonly code: string
    readonly details?: Record<string, unknown>
    readonly newWrites: number
  }
  readonly inputCountAfterRejections: number
  readonly selfSend: {
    readonly code: string
    readonly newWrites: number
    readonly inputCount: number
  }
  readonly mutedSend: {
    readonly code: string
    readonly errorName: string
    readonly newWrites: number
  }
  readonly failedDelivery: {
    readonly code: string
    readonly newWrites: number
    readonly intentFacts: number
    readonly confirmFactsBeforeRecovery: number
    readonly inputsToScoutBeforeRecovery: number
  }
  readonly recovery: PendingDeliveryRecoveryResult
  readonly inputAfterRecovery: AttributedSessionInput
  readonly confirmFactsAfterRecovery: number
  readonly totalInputs: number
}

// ---------------------------------------------------------------------------
// Setup — one world, all five seeds, the whole matrix executed in order.
// Every probe is captured IMMEDIATELY after the action it documents.
// ---------------------------------------------------------------------------
let sd!: SendDeliveryState
{
  const world = await createP6T3World('p6t3x-send', [
    'leader',
    'worker',
    'worker2',
    'scout',
    'muted',
  ])
  try {
    const port = new FakeSessionInputPort()
    const coordinator = createP6T3Coordinator(world, port)
    const { leader, worker, scout, muted } = P6T3_SEEDS

    // -- 1. leader → worker (direct) ------------------------------------
    const beforeLeaderToWorker = world.seam.writeCount
    const l2wOutcome = await coordinator.sendTeamMessage(
      makeSendRequest({
        caller: leaderCaller(),
        recipientInstanceId: worker.instanceId,
        subject: 'status check',
        body: 'please report progress',
        requestToken: 'tok-p6t3-send-1',
      }),
    )
    const l2wIntent = findFacts(
      world,
      'team-coordination-recorded',
      (p) => p['requestToken'] === 'tok-p6t3-send-1',
    )[0]!
    const l2wConfirm = findFacts(
      world,
      'team-message-delivered',
      (p) => p['requestToken'] === 'tok-p6t3-send-1',
    )[0]!
    const l2wInput = port.inputsFor(worker.childSessionId)[0]!
    const l2w = {
      outcome: l2wOutcome,
      intent: l2wIntent,
      confirm: l2wConfirm,
      input: l2wInput,
      inputCount: port.inputs.length,
      // two durable facts × (allocateSequence + put) = 4 seam writes, plus
      // the ONE-TIME ledger sequence-counter bootstrap put on the first
      // allocation of this fresh ledger (putRaw 0 + updateRaw) = 5
      newWrites: world.seam.writeCount - beforeLeaderToWorker,
      gaps: world.domain.repositories.ledger.gaps(),
    }

    // -- 2. worker → leader (direct) ------------------------------------
    const m2lOutcome = await coordinator.sendTeamMessage(
      makeSendRequest({
        caller: memberCaller(worker.instanceId),
        recipientInstanceId: leader.instanceId,
        body: 'worker reports: task in progress',
        requestToken: 'tok-p6t3-send-2',
      }),
    )
    const m2lIntent = findFacts(
      world,
      'team-coordination-recorded',
      (p) => p['requestToken'] === 'tok-p6t3-send-2',
    )[0]!
    const m2lConfirm = findFacts(
      world,
      'team-message-delivered',
      (p) => p['requestToken'] === 'tok-p6t3-send-2',
    )[0]!
    const m2lInput = port.inputsFor(leader.childSessionId)[0]!
    const m2l = {
      outcome: m2lOutcome,
      intent: m2lIntent,
      confirm: m2lConfirm,
      input: m2lInput,
    }

    // -- 3. human → worker (direct) -------------------------------------
    const h2wOutcome = await coordinator.sendTeamMessage(
      makeSendRequest({
        caller: humanCaller(),
        recipientInstanceId: worker.instanceId,
        subject: 'owner note',
        body: 'keep the team focused',
        requestToken: 'tok-p6t3-send-3',
      }),
    )
    const h2wIntent = findFacts(
      world,
      'team-coordination-recorded',
      (p) => p['requestToken'] === 'tok-p6t3-send-3',
    )[0]!
    const h2wConfirm = findFacts(
      world,
      'team-message-delivered',
      (p) => p['requestToken'] === 'tok-p6t3-send-3',
    )[0]!
    const h2wInput = port.inputsFor(worker.childSessionId)[1]!
    const h2w = {
      outcome: h2wOutcome,
      intent: h2wIntent,
      confirm: h2wConfirm,
      input: h2wInput,
    }

    const inputCountAfterValidSends = port.inputs.length

    // -- 4. unknown target (facade INSTANCE_NOT_FOUND, zero writes) -----
    const beforeUnknown = world.seam.writeCount
    const unknownTarget = await expectFacadeRejection(
      coordinator,
      makeSendRequest({
        caller: leaderCaller(),
        recipientInstanceId: 'inst-p6t3unknown',
        body: 'to nobody',
        requestToken: 'tok-p6t3-send-4',
      }),
      TEAM_RUNTIME_ERROR_CODES.INSTANCE_NOT_FOUND,
    )
    const unknown = {
      code: unknownTarget.code,
      errorName: unknownTarget.errorName,
      newWrites: world.seam.writeCount - beforeUnknown,
      inputCount: port.inputs.length,
    }

    // -- 5. label + template addressing (zero writes) -------------------
    const beforeLabel = world.seam.writeCount
    const labelTarget = await expectFacadeRejection(
      coordinator,
      makeSendRequest({
        caller: leaderCaller(),
        recipientInstanceId: 'existing-worker', // worker's LABEL, not its instanceId
        body: 'by label',
        requestToken: 'tok-p6t3-send-5a',
      }),
      TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED,
    )
    const label = {
      code: labelTarget.code,
      details: labelTarget.details,
      newWrites: world.seam.writeCount - beforeLabel,
    }
    const beforeTemplate = world.seam.writeCount
    const templateTarget = await expectFacadeRejection(
      coordinator,
      makeSendRequest({
        caller: memberCaller(worker.instanceId),
        recipientInstanceId: 'worker', // a template ID, not an instanceId
        body: 'by template',
        requestToken: 'tok-p6t3-send-5b',
      }),
      TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED,
    )
    const template = {
      code: templateTarget.code,
      details: templateTarget.details,
      newWrites: world.seam.writeCount - beforeTemplate,
    }

    const inputCountAfterRejections = port.inputs.length

    // -- 6. self-send (module policy, zero writes) ----------------------
    const beforeSelf = world.seam.writeCount
    const selfSend = await expectMessagingRejection(
      coordinator,
      makeSendRequest({
        caller: memberCaller(worker.instanceId),
        recipientInstanceId: worker.instanceId, // the caller's OWN instance
        body: 'echo',
        requestToken: 'tok-p6t3-send-6',
      }),
      MESSAGING_ERROR_CODES.MESSAGING_SELF_SEND_REJECTED,
    )
    const self = {
      code: selfSend.code,
      newWrites: world.seam.writeCount - beforeSelf,
      inputCount: port.inputs.length,
    }

    // -- 7. the muted member sends (facade envelope, zero writes) -------
    const beforeMuted = world.seam.writeCount
    const mutedSend = await expectFacadeRejection(
      coordinator,
      makeSendRequest({
        caller: memberCaller(muted.instanceId),
        recipientInstanceId: worker.instanceId,
        body: 'should not pass',
        requestToken: 'tok-p6t3-send-7',
      }),
      TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
    )
    const mutedResult = {
      code: mutedSend.code,
      errorName: mutedSend.errorName,
      newWrites: world.seam.writeCount - beforeMuted,
    }

    // -- 8. failing port (R2: intent stays durable, no confirmation) ----
    port.setFailures(1)
    const beforeFailed = world.seam.writeCount
    const failedDelivery = await expectMessagingRejection(
      coordinator,
      makeSendRequest({
        caller: leaderCaller(),
        recipientInstanceId: scout.instanceId,
        subject: 'lost in flight',
        body: 'this delivery will fail at the port',
        requestToken: 'tok-p6t3-send-8',
      }),
      MESSAGING_ERROR_CODES.MESSAGING_DELIVERY_FAILED,
    )
    const failed = {
      code: failedDelivery.code,
      // exactly ONE durable fact (the intent) = allocateSequence + put
      newWrites: world.seam.writeCount - beforeFailed,
      intentFacts: findFacts(
        world,
        'team-coordination-recorded',
        (p) => p['requestToken'] === 'tok-p6t3-send-8',
      ).length,
      confirmFactsBeforeRecovery: findFacts(
        world,
        'team-message-delivered',
        (p) => p['requestToken'] === 'tok-p6t3-send-8',
      ).length,
      inputsToScoutBeforeRecovery:
        port.inputsFor(scout.childSessionId).length,
    }

    // Same-world recovery redelivers the pending intent exactly once.
    const recovery = await coordinator.recoverPendingDeliveries(P6T3_ROOT)
    const inputAfterRecovery = port.inputsFor(scout.childSessionId)[0]!
    const confirmFactsAfterRecovery = findFacts(
      world,
      'team-message-delivered',
      (p) => p['requestToken'] === 'tok-p6t3-send-8',
    ).length
    const totalInputs = port.inputs.length

    sd = {
      world,
      port,
      leaderToWorker: l2w,
      memberToLeader: m2l,
      humanToWorker: h2w,
      inputCountAfterValidSends,
      unknownTarget: unknown,
      labelTarget: label,
      templateTarget: template,
      inputCountAfterRejections,
      selfSend: self,
      mutedSend: mutedResult,
      failedDelivery: failed,
      recovery,
      inputAfterRecovery,
      confirmFactsAfterRecovery,
      totalInputs,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T3 send/delivery (MUST-TEST: leader→member, member→leader, negatives, failure)', () => {
  it('1. leader → member: DIRECT — two ledger facts + the attributed input on the target session (the record split)', () => {
    const o = sd.leaderToWorker.outcome
    expect(o.status).toBe('delivered')
    expect(o.action).toBe('send-message')
    expect(o.rootSessionId).toBe(P6T3_ROOT)
    expect(o.callerRole).toBe('leader')
    expect(o.recipientInstanceId).toBe(P6T3_SEEDS.worker.instanceId)
    expect(o.deliveryMode).toBe('direct')
    expect(o.deliveredToInstanceId).toBe(P6T3_SEEDS.worker.instanceId)
    expect(o.deliveredToSessionId).toBe(P6T3_SEEDS.worker.childSessionId)
    expect(o.requestToken).toBe('tok-p6t3-send-1')
    expect(o.factSequence).toBe(sd.leaderToWorker.intent.sequence)
    expect(o.deliveredSequence).toBe(sd.leaderToWorker.confirm.sequence)
    expect(o.deliveredSequence).toBeGreaterThan(o.factSequence)

    // (a) the durable coordination record (facade intent fact): who →
    // whom, addressed by instanceId, with the correlation token.
    expect(sd.leaderToWorker.intent.factType).toBe('team-coordination-recorded')
    expect(String(sd.leaderToWorker.intent.rootSessionId)).toBe(P6T3_ROOT)
    expect(sd.leaderToWorker.intent.payload['action']).toBe('send-message')
    expect(sd.leaderToWorker.intent.payload['caller']).toEqual({
      kind: 'instance',
      instanceId: 'inst-leader',
      role: 'leader',
    })
    expect(sd.leaderToWorker.intent.payload['targetInstanceId']).toBe(
      P6T3_SEEDS.worker.instanceId,
    )
    expect(sd.leaderToWorker.intent.payload['recipientInstanceId']).toBe(
      P6T3_SEEDS.worker.instanceId,
    )
    expect(sd.leaderToWorker.intent.payload['subject']).toBe('status check')
    expect(sd.leaderToWorker.intent.payload['body']).toBe('please report progress')
    expect(sd.leaderToWorker.intent.payload['requestToken']).toBe('tok-p6t3-send-1')
    expect(sd.leaderToWorker.intent.payload['at']).toBe(P6T3_NOW)

    // (b) the delivery confirmation (module confirmation fact): the
    // delivery/result correlation row.
    expect(sd.leaderToWorker.confirm.factType).toBe('team-message-delivered')
    expect(sd.leaderToWorker.confirm.payload['action']).toBe('send-message')
    expect(sd.leaderToWorker.confirm.payload['requestToken']).toBe('tok-p6t3-send-1')
    expect(sd.leaderToWorker.confirm.payload['factSequence']).toBe(
      sd.leaderToWorker.intent.sequence,
    )
    expect(sd.leaderToWorker.confirm.payload['fromInstanceId']).toBe('inst-leader')
    expect(sd.leaderToWorker.confirm.payload['recipientInstanceId']).toBe(
      P6T3_SEEDS.worker.instanceId,
    )
    expect(sd.leaderToWorker.confirm.payload['deliveryMode']).toBe('direct')
    expect(sd.leaderToWorker.confirm.payload['deliveredToInstanceId']).toBe(
      P6T3_SEEDS.worker.instanceId,
    )
    expect(sd.leaderToWorker.confirm.payload['deliveredToSessionId']).toBe(
      P6T3_SEEDS.worker.childSessionId,
    )
    expect(sd.leaderToWorker.confirm.payload['at']).toBe(P6T3_NOW)

    // (c) the target session received ONLY ordinary attributed input.
    const input = sd.leaderToWorker.input
    expect(input.sessionId).toBe(P6T3_SEEDS.worker.childSessionId)
    expect(input.attribution).toEqual({
      kind: 'team-relay',
      fromInstanceId: 'inst-leader',
      intendedForInstanceId: P6T3_SEEDS.worker.instanceId,
      correlation: {
        requestToken: 'tok-p6t3-send-1',
        factSequence: sd.leaderToWorker.intent.sequence,
      },
    })
    expect(input.text).toBe(
      `[team-relay] from=inst-leader (label: leader) to=${P6T3_SEEDS.worker.instanceId} (label: existing-worker)\nsubject=status check\nplease report progress`,
    )

    // Nothing on any other session; the write cost is exactly two durable
    // facts — 4 seam writes plus the one-time ledger counter bootstrap on
    // this fresh world's first allocation (= 5); the ledger stays gap-free.
    expect(sd.leaderToWorker.inputCount).toBe(1)
    expect(sd.leaderToWorker.newWrites).toBe(5)
    expect(sd.leaderToWorker.gaps).toEqual([])
  })

  it('2. member → leader: DIRECT — upward coordination is never mediated', () => {
    const o = sd.memberToLeader.outcome
    expect(o.callerRole).toBe('member')
    expect(o.deliveryMode).toBe('direct')
    expect(o.recipientInstanceId).toBe('inst-leader')
    expect(o.deliveredToInstanceId).toBe('inst-leader')
    expect(o.deliveredToSessionId).toBe(P6T3_SEEDS.leader.childSessionId)

    expect(sd.memberToLeader.intent.payload['caller']).toEqual({
      kind: 'instance',
      instanceId: P6T3_SEEDS.worker.instanceId,
      role: 'member',
    })
    expect(sd.memberToLeader.confirm.payload['deliveryMode']).toBe('direct')
    expect(sd.memberToLeader.confirm.payload['deliveredToInstanceId']).toBe(
      'inst-leader',
    )

    const input = sd.memberToLeader.input
    expect(input.sessionId).toBe(P6T3_SEEDS.leader.childSessionId)
    expect(input.attribution).toEqual({
      kind: 'team-relay',
      fromInstanceId: P6T3_SEEDS.worker.instanceId,
      intendedForInstanceId: 'inst-leader',
      correlation: {
        requestToken: 'tok-p6t3-send-2',
        factSequence: sd.memberToLeader.intent.sequence,
      },
    })
    expect(input.text).toBe(
      `[team-relay] from=${P6T3_SEEDS.worker.instanceId} (label: existing-worker) to=inst-leader (label: leader)\nworker reports: task in progress`,
    )
  })

  it('3. human → member: DIRECT, attributed with fromHumanId (invariant 34)', () => {
    const o = sd.humanToWorker.outcome
    expect(o.callerRole).toBe('human')
    expect(o.deliveryMode).toBe('direct')
    expect(o.deliveredToInstanceId).toBe(P6T3_SEEDS.worker.instanceId)

    expect(sd.humanToWorker.intent.payload['caller']).toEqual({
      kind: 'human',
      humanId: 'human-p6t3-owner',
    })
    expect(sd.humanToWorker.confirm.payload['fromHumanId']).toBe('human-p6t3-owner')

    const input = sd.humanToWorker.input
    expect(input.sessionId).toBe(P6T3_SEEDS.worker.childSessionId)
    expect(input.attribution).toEqual({
      kind: 'team-relay',
      fromHumanId: 'human-p6t3-owner',
      intendedForInstanceId: P6T3_SEEDS.worker.instanceId,
      correlation: {
        requestToken: 'tok-p6t3-send-3',
        factSequence: sd.humanToWorker.intent.sequence,
      },
    })
    expect(input.text).toBe(
      `[team-relay] from=human:human-p6t3-owner to=${P6T3_SEEDS.worker.instanceId} (label: existing-worker)\nsubject=owner note\nkeep the team focused`,
    )
  })

  it('4. unknown target: the facade INSTANCE_NOT_FOUND propagates UNMAPPED, zero writes, no input', () => {
    expect(sd.unknownTarget.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.INSTANCE_NOT_FOUND,
    )
    expect(sd.unknownTarget.errorName).toBe('TeamRuntimeError')
    expect(sd.unknownTarget.newWrites).toBe(0)
    expect(sd.unknownTarget.inputCount).toBe(sd.inputCountAfterValidSends)
  })

  it('5. label AND template addressing: facade ACTION_ADDRESSING_REJECTED (invariant 19), zero writes', () => {
    expect(sd.labelTarget.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED,
    )
    expect(sd.labelTarget.details?.['kind']).toBe('member-label')
    expect(sd.labelTarget.details?.['instanceId']).toBe(
      P6T3_SEEDS.worker.instanceId,
    )
    expect(sd.labelTarget.newWrites).toBe(0)
    expect(sd.templateTarget.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED,
    )
    expect(sd.templateTarget.details?.['kind']).toBe('template-id')
    expect(sd.templateTarget.newWrites).toBe(0)
    expect(sd.inputCountAfterRejections).toBe(sd.inputCountAfterValidSends)
  })

  it('6. self-send: MESSAGING_SELF_SEND_REJECTED before the facade (defined policy), zero writes', () => {
    expect(sd.selfSend.code).toBe(
      MESSAGING_ERROR_CODES.MESSAGING_SELF_SEND_REJECTED,
    )
    expect(sd.selfSend.newWrites).toBe(0)
    expect(sd.selfSend.inputCount).toBe(sd.inputCountAfterValidSends)
  })

  it('7. the muted member sends: facade ENVELOPE_OUT_OF_BOUNDS (authority beats mediation), zero writes', () => {
    expect(sd.mutedSend.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
    )
    expect(sd.mutedSend.errorName).toBe('TeamRuntimeError')
    expect(sd.mutedSend.newWrites).toBe(0)
  })

  it('8. failing port: MESSAGING_DELIVERY_FAILED — intent durable, no confirmation, no input; recovery redelivers exactly once', () => {
    const scout = P6T3_SEEDS.scout
    expect(sd.failedDelivery.code).toBe(
      MESSAGING_ERROR_CODES.MESSAGING_DELIVERY_FAILED,
    )
    // exactly ONE durable fact (the intent) — no confirmation.
    expect(sd.failedDelivery.newWrites).toBe(2)
    expect(sd.failedDelivery.intentFacts).toBe(1)
    expect(sd.failedDelivery.confirmFactsBeforeRecovery).toBe(0)
    expect(sd.failedDelivery.inputsToScoutBeforeRecovery).toBe(0)

    // Same-world recovery: exactly one pending intent, redelivered direct
    // to the scout session with the ORIGINAL correlation.
    expect(sd.recovery.recovered.length).toBe(1)
    expect(sd.recovery.skipped.length).toBe(0)
    const recovered = sd.recovery.recovered[0]!
    expect(recovered.requestToken).toBe('tok-p6t3-send-8')
    expect(recovered.deliveryMode).toBe('direct')
    expect(recovered.deliveredToInstanceId).toBe(scout.instanceId)
    expect(recovered.deliveredSequence).toBeGreaterThan(recovered.factSequence)

    const input = sd.inputAfterRecovery
    expect(input.sessionId).toBe(scout.childSessionId)
    expect(input.attribution).toEqual({
      kind: 'team-relay',
      fromInstanceId: 'inst-leader',
      intendedForInstanceId: scout.instanceId,
      correlation: {
        requestToken: 'tok-p6t3-send-8',
        factSequence: recovered.factSequence,
      },
    })
    expect(input.text).toBe(
      `[team-relay] from=inst-leader (label: leader) to=${scout.instanceId} (label: existing-scout)\nsubject=lost in flight\nthis delivery will fail at the port`,
    )

    // the confirmation fact now exists exactly once (exactly-once, R3)
    expect(sd.confirmFactsAfterRecovery).toBe(1)
    // the recovery added exactly one input overall (no redelivery noise)
    expect(sd.totalInputs).toBe(sd.inputCountAfterValidSends + 1)
  })
})
