/**
 * P6-T3 Suite 2 — the EXACT member→member mediation rule (documented in
 * `messaging/mediation.ts`) end to end over the REAL durable world.
 *
 * The matrix:
 *  1. member → peer with NO grant → MEDIATED: the ordinary attributed
 *     input lands on the LEADER's session (the relay header names the
 *     intended-for peer), NOTHING on the peer's session, and the
 *     coordination fact still records the INTENDED recipient (mediation
 *     decides the delivery path, never the coordination);
 *  2. the sender holds the peer-direct grant (its LATEST instance
 *     autonomy overlay carries `messagingPeerDirect: true`) → DIRECT to
 *     the peer's session;
 *  3. grants are PER-SENDER: worker2 holds NO grant of its own — the
 *     grant on the (other) worker does not apply to it → still mediated;
 *  4. a newer overlay generation WITHOUT the grant revokes it (latest
 *     generation wins; fail closed → mediated again);
 *  5. authority beats mediation: the scout's own overlay denies the
 *     `send-message` op → the facade's ENVELOPE_OUT_OF_BOUNDS before any
 *     delivery planning, zero writes (the grant on the same overlay is
 *     irrelevant — mediation never grants authority);
 *  6. the confirmation facts record the path ACTUALLY taken for both
 *     modes (R1: the plan is re-derived at delivery time);
 *  7. the relay text + attribution carry the correlation (requestToken +
 *     intent factSequence) and the intended-for identity.
 *
 * Note: every durable-state probe (findFacts) runs in the setup block
 * while the world is open; the `it`s assert on captured snapshots.
 */

import { describe, expect, it } from 'vitest'
import type { LedgerEntry } from '../../storage/schema/index.js'
import { TEAM_RUNTIME_ERROR_CODES } from '../admission/index.js'
import {
  PEER_DIRECT_GRANT_KEY,
} from '../messaging/index.js'
import type {
  AttributedSessionInput,
  SendTeamMessageOutcome,
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
  FakeSessionInputPort,
  findFacts,
  makeSendRequest,
  memberCaller,
  P6T3_SEEDS,
  putP6T3Overlay,
} from './p6t3-helpers.js'
import type { MessagingCoordinator, SendTeamMessageRequest } from '../messaging/index.js'

/**
 * Expect one send to be rejected by the FACADE with a TeamRuntimeError of
 * exactly `code` (unmapped propagation) and resolve to code + name.
 */
function expectFacadeRejection(
  coordinator: MessagingCoordinator,
  request: SendTeamMessageRequest,
  code: string,
): Promise<{ readonly code: string; readonly errorName: string }> {
  return coordinator.sendTeamMessage(request).then(
    (outcome) => {
      throw new Error(
        `expectFacadeRejection('${code}'): the send was delivered (confirmation sequence ${outcome.deliveredSequence})`,
      )
    },
    (error: unknown) => {
      const checked = assertRuntimeCode(error, code)
      return { code: checked.code, errorName: (error as Error).name }
    },
  )
}

/** One confirmation fact, flattened to the audited fields. */
interface ConfirmationRow {
  readonly requestToken: string
  readonly deliveryMode: string
  readonly deliveredToInstanceId: string
  readonly recipientInstanceId: string
  readonly factSequence: number
}

interface MediationState {
  readonly world: P6T1World
  readonly port: FakeSessionInputPort
  readonly noGrant: {
    readonly outcome: SendTeamMessageOutcome
    readonly intent: LedgerEntry
    readonly confirm: LedgerEntry
    readonly input: AttributedSessionInput
    readonly scoutInputs: number
    readonly workerInputs: number
  }
  readonly granted: {
    readonly outcome: SendTeamMessageOutcome
    readonly intent: LedgerEntry
    readonly confirm: LedgerEntry
    readonly input: AttributedSessionInput
    readonly scoutInputs: number
  }
  readonly perSender: {
    readonly outcome: SendTeamMessageOutcome
    readonly intent: LedgerEntry
    readonly confirm: LedgerEntry
    readonly input: AttributedSessionInput
  }
  readonly revoked: {
    readonly outcome: SendTeamMessageOutcome
    readonly intent: LedgerEntry
    readonly confirm: LedgerEntry
    readonly input: AttributedSessionInput
  }
  readonly envelopeBlocked: {
    readonly code: string
    readonly errorName: string
    readonly newWrites: number
    readonly inputCount: number
    readonly intentFacts: number
  }
  readonly leaderInputs: number
  readonly scoutInputs: number
  readonly confirmations: readonly ConfirmationRow[]
}

// ---------------------------------------------------------------------------
// Setup — one world; the mediation matrix executed in order. Every probe
// is captured IMMEDIATELY after the action it documents.
// ---------------------------------------------------------------------------
let md!: MediationState
{
  const world = await createP6T3World('p6t3x-mediation', [
    'leader',
    'worker',
    'worker2',
    'scout',
  ])
  try {
    const port = new FakeSessionInputPort()
    const coordinator = createP6T3Coordinator(world, port)
    const { leader, worker, worker2, scout } = P6T3_SEEDS

    // -- 1. no grant → mediated ------------------------------------------
    const med1 = await coordinator.sendTeamMessage(
      makeSendRequest({
        caller: memberCaller(worker.instanceId),
        recipientInstanceId: scout.instanceId,
        body: 'scout, check the northern perimeter',
        requestToken: 'tok-p6t3-med-1',
      }),
    )
    const med1Intent = findFacts(
      world,
      'team-coordination-recorded',
      (p) => p['requestToken'] === 'tok-p6t3-med-1',
    )[0]!
    const med1Confirm = findFacts(
      world,
      'team-message-delivered',
      (p) => p['requestToken'] === 'tok-p6t3-med-1',
    )[0]!
    const med1Input = port.inputsFor(leader.childSessionId)[0]!
    const noGrant = {
      outcome: med1,
      intent: med1Intent,
      confirm: med1Confirm,
      input: med1Input,
      scoutInputs: port.inputsFor(scout.childSessionId).length,
      workerInputs: port.inputsFor(worker.childSessionId).length,
    }

    // -- 2. grant on the SENDER → direct ---------------------------------
    putP6T3Overlay(world, worker.instanceId, 'ol-p6t3-med-w')
    const med2 = await coordinator.sendTeamMessage(
      makeSendRequest({
        caller: memberCaller(worker.instanceId),
        recipientInstanceId: scout.instanceId,
        body: 'now delivered direct',
        requestToken: 'tok-p6t3-med-2',
      }),
    )
    const med2Intent = findFacts(
      world,
      'team-coordination-recorded',
      (p) => p['requestToken'] === 'tok-p6t3-med-2',
    )[0]!
    const med2Confirm = findFacts(
      world,
      'team-message-delivered',
      (p) => p['requestToken'] === 'tok-p6t3-med-2',
    )[0]!
    const med2Input = port.inputsFor(scout.childSessionId)[0]!
    const granted = {
      outcome: med2,
      intent: med2Intent,
      confirm: med2Confirm,
      input: med2Input,
      scoutInputs: port.inputsFor(scout.childSessionId).length,
    }

    // -- 3. PER-SENDER: worker2 holds no grant of its own (the grant on
    //      the OTHER worker does not apply) → still mediated ------------
    const med3 = await coordinator.sendTeamMessage(
      makeSendRequest({
        caller: memberCaller(worker2.instanceId),
        recipientInstanceId: scout.instanceId,
        body: 'still mediated: grants are per-sender',
        requestToken: 'tok-p6t3-med-3',
      }),
    )
    const med3Intent = findFacts(
      world,
      'team-coordination-recorded',
      (p) => p['requestToken'] === 'tok-p6t3-med-3',
    )[0]!
    const med3Confirm = findFacts(
      world,
      'team-message-delivered',
      (p) => p['requestToken'] === 'tok-p6t3-med-3',
    )[0]!
    const med3Input = port.inputsFor(leader.childSessionId)[1]!
    const perSender = {
      outcome: med3,
      intent: med3Intent,
      confirm: med3Confirm,
      input: med3Input,
    }

    // -- 4. a newer generation WITHOUT the grant revokes it --------------
    putP6T3Overlay(world, worker.instanceId, 'ol-p6t3-med-w-rev', {
      generation: 2,
      values: {},
    })
    const med4 = await coordinator.sendTeamMessage(
      makeSendRequest({
        caller: memberCaller(worker.instanceId),
        recipientInstanceId: scout.instanceId,
        body: 'grant revoked, mediated again',
        requestToken: 'tok-p6t3-med-4',
      }),
    )
    const med4Intent = findFacts(
      world,
      'team-coordination-recorded',
      (p) => p['requestToken'] === 'tok-p6t3-med-4',
    )[0]!
    const med4Confirm = findFacts(
      world,
      'team-message-delivered',
      (p) => p['requestToken'] === 'tok-p6t3-med-4',
    )[0]!
    const med4Input = port.inputsFor(leader.childSessionId)[2]!
    const revoked = {
      outcome: med4,
      intent: med4Intent,
      confirm: med4Confirm,
      input: med4Input,
    }

    // -- 5. the scout's envelope denies send-message (authority) ---------
    putP6T3Overlay(world, scout.instanceId, 'ol-p6t3-med-s', {
      values: {
        [PEER_DIRECT_GRANT_KEY]: true,
        envelope: { deny: ['send-message'] },
      },
    })
    const beforeBlocked = world.seam.writeCount
    const envelopeBlocked = await expectFacadeRejection(
      coordinator,
      makeSendRequest({
        caller: memberCaller(scout.instanceId),
        recipientInstanceId: worker.instanceId,
        body: 'blocked by its own envelope',
        requestToken: 'tok-p6t3-med-5',
      }),
      TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
    )
    const blocked = {
      code: envelopeBlocked.code,
      errorName: envelopeBlocked.errorName,
      newWrites: world.seam.writeCount - beforeBlocked,
      inputCount: port.inputs.length,
      intentFacts: findFacts(
        world,
        'team-coordination-recorded',
        (p) => p['requestToken'] === 'tok-p6t3-med-5',
      ).length,
    }

    // -- 6. the full confirmation audit (both modes) ----------------------
    const confirmations = findFacts(
      world,
      'team-message-delivered',
    ).map((entry) => ({
      requestToken: String(entry.payload['requestToken']),
      deliveryMode: String(entry.payload['deliveryMode']),
      deliveredToInstanceId: String(entry.payload['deliveredToInstanceId']),
      recipientInstanceId: String(entry.payload['recipientInstanceId']),
      factSequence: Number(entry.payload['factSequence']),
    }))

    md = {
      world,
      port,
      noGrant,
      granted,
      perSender,
      revoked,
      envelopeBlocked: blocked,
      leaderInputs: port.inputsFor(leader.childSessionId).length,
      scoutInputs: port.inputsFor(scout.childSessionId).length,
      confirmations,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T3 member→member mediation (the documented rule, end to end)', () => {
  it('1. no grant → MEDIATED via the leader: input on the leader session, nothing on the peer session, the coordination fact keeps the intended recipient', () => {
    const scout = P6T3_SEEDS.scout
    const leader = P6T3_SEEDS.leader
    const o = md.noGrant.outcome
    expect(o.deliveryMode).toBe('mediated')
    expect(o.recipientInstanceId).toBe(scout.instanceId)
    expect(o.deliveredToInstanceId).toBe('inst-leader')
    expect(o.deliveredToSessionId).toBe(leader.childSessionId)

    // (a) the coordination fact addresses the INTENDED recipient —
    // mediation never rewrites the coordination (Arch §24.2).
    expect(md.noGrant.intent.payload['recipientInstanceId']).toBe(
      scout.instanceId,
    )
    expect(md.noGrant.intent.payload['caller']).toEqual({
      kind: 'instance',
      instanceId: P6T3_SEEDS.worker.instanceId,
      role: 'member',
    })

    // (b) the input landed on the LEADER session only.
    expect(md.noGrant.input.sessionId).toBe(leader.childSessionId)
    expect(md.noGrant.scoutInputs).toBe(0)
    expect(md.noGrant.workerInputs).toBe(0)

    // (c) the confirmation records the path actually taken.
    expect(md.noGrant.confirm.payload['deliveryMode']).toBe('mediated')
    expect(md.noGrant.confirm.payload['deliveredToInstanceId']).toBe(
      'inst-leader',
    )
    expect(md.noGrant.confirm.payload['deliveredToSessionId']).toBe(
      leader.childSessionId,
    )
    expect(md.noGrant.confirm.payload['recipientInstanceId']).toBe(
      scout.instanceId,
    )
  })

  it('2. the sender holds the peer-direct grant → DIRECT to the peer session', () => {
    const scout = P6T3_SEEDS.scout
    const o = md.granted.outcome
    expect(o.deliveryMode).toBe('direct')
    expect(o.deliveredToInstanceId).toBe(scout.instanceId)
    expect(o.deliveredToSessionId).toBe(scout.childSessionId)
    expect(md.granted.scoutInputs).toBe(1)

    expect(md.granted.confirm.payload['deliveryMode']).toBe('direct')
    expect(md.granted.confirm.payload['deliveredToInstanceId']).toBe(
      scout.instanceId,
    )

    const input = md.granted.input
    expect(input.sessionId).toBe(scout.childSessionId)
    expect(input.attribution).toEqual({
      kind: 'team-relay',
      fromInstanceId: P6T3_SEEDS.worker.instanceId,
      intendedForInstanceId: scout.instanceId,
      correlation: {
        requestToken: 'tok-p6t3-med-2',
        factSequence: md.granted.intent.sequence,
      },
    })
    expect(input.text).toBe(
      `[team-relay] from=${P6T3_SEEDS.worker.instanceId} (label: existing-worker) to=${scout.instanceId} (label: existing-scout)\nnow delivered direct`,
    )
  })

  it('3. grants are PER-SENDER: worker2 holds no grant of its own (the grant on the other worker does not apply) → still mediated', () => {
    const o = md.perSender.outcome
    expect(o.deliveryMode).toBe('mediated')
    expect(o.deliveredToInstanceId).toBe('inst-leader')
    expect(md.perSender.confirm.payload['deliveryMode']).toBe('mediated')
    expect(md.perSender.input.sessionId).toBe(
      P6T3_SEEDS.leader.childSessionId,
    )
    expect(md.perSender.input.attribution.fromInstanceId).toBe(
      P6T3_SEEDS.worker2.instanceId,
    )
    expect(md.perSender.input.text).toBe(
      `[team-relay:mediated via leader] from=${P6T3_SEEDS.worker2.instanceId} (label: second-worker) intended-for=${P6T3_SEEDS.scout.instanceId} (label: existing-scout)\nstill mediated: grants are per-sender`,
    )
  })

  it('4. a newer overlay generation without the grant revokes it (latest generation wins, fail closed → mediated again)', () => {
    const o = md.revoked.outcome
    expect(o.deliveryMode).toBe('mediated')
    expect(o.deliveredToInstanceId).toBe('inst-leader')
    expect(md.revoked.confirm.payload['deliveryMode']).toBe('mediated')
    expect(md.revoked.input.sessionId).toBe(
      P6T3_SEEDS.leader.childSessionId,
    )
    expect(md.revoked.input.text).toBe(
      `[team-relay:mediated via leader] from=${P6T3_SEEDS.worker.instanceId} (label: existing-worker) intended-for=${P6T3_SEEDS.scout.instanceId} (label: existing-scout)\ngrant revoked, mediated again`,
    )
  })

  it('5. authority beats mediation: the scout envelope denies send-message, so the facade rejects it — zero writes, no coordination fact', () => {
    expect(md.envelopeBlocked.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
    )
    expect(md.envelopeBlocked.errorName).toBe('TeamRuntimeError')
    expect(md.envelopeBlocked.newWrites).toBe(0)
    expect(md.envelopeBlocked.inputCount).toBe(
      md.leaderInputs + md.scoutInputs,
    )
    expect(md.envelopeBlocked.intentFacts).toBe(0)
  })

  it('6. the confirmation facts record the path actually taken for both modes', () => {
    expect(md.confirmations).toEqual([
      {
        requestToken: 'tok-p6t3-med-1',
        deliveryMode: 'mediated',
        deliveredToInstanceId: 'inst-leader',
        recipientInstanceId: P6T3_SEEDS.scout.instanceId,
        factSequence: md.noGrant.intent.sequence,
      },
      {
        requestToken: 'tok-p6t3-med-2',
        deliveryMode: 'direct',
        deliveredToInstanceId: P6T3_SEEDS.scout.instanceId,
        recipientInstanceId: P6T3_SEEDS.scout.instanceId,
        factSequence: md.granted.intent.sequence,
      },
      {
        requestToken: 'tok-p6t3-med-3',
        deliveryMode: 'mediated',
        deliveredToInstanceId: 'inst-leader',
        recipientInstanceId: P6T3_SEEDS.scout.instanceId,
        factSequence: md.perSender.intent.sequence,
      },
      {
        requestToken: 'tok-p6t3-med-4',
        deliveryMode: 'mediated',
        deliveredToInstanceId: 'inst-leader',
        recipientInstanceId: P6T3_SEEDS.scout.instanceId,
        factSequence: md.revoked.intent.sequence,
      },
    ])
  })

  it('7. the relay text + attribution carry the correlation and the intended-for identity (mediated and direct)', () => {
    const scout = P6T3_SEEDS.scout
    const input = md.noGrant.input
    expect(input.attribution.kind).toBe('team-relay')
    expect(input.attribution.fromInstanceId).toBe(
      P6T3_SEEDS.worker.instanceId,
    )
    expect(input.attribution.intendedForInstanceId).toBe(scout.instanceId)
    expect(input.attribution.correlation).toEqual({
      requestToken: 'tok-p6t3-med-1',
      factSequence: md.noGrant.intent.sequence,
    })
    expect(input.text).toBe(
      `[team-relay:mediated via leader] from=${P6T3_SEEDS.worker.instanceId} (label: existing-worker) intended-for=${scout.instanceId} (label: existing-scout)\nscout, check the northern perimeter`,
    )
    // the direct path names the peer as the recipient (exact text)
    expect(md.granted.input.text).toBe(
      `[team-relay] from=${P6T3_SEEDS.worker.instanceId} (label: existing-worker) to=${scout.instanceId} (label: existing-scout)\nnow delivered direct`,
    )
    expect(md.granted.input.attribution.correlation.requestToken).toBe(
      'tok-p6t3-med-2',
    )
  })
})
