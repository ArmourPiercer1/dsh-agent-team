/**
 * P6-T2 A2/B1 — caller authority (steps 2b + 3 of the documented order):
 * the closed role sets on creation actions, the mutation envelope
 * (team ∩ template ∩ instance overlay), and the human override boundary.
 *
 * MUST-TEST coverage: member self-escalation (a worker following up on
 * ITSELF is out of envelope — invariant 37) and leader out-of-envelope
 * (the P6-T2 team envelope deliberately lacks `dispose-member` — the
 * leader is denied, invariant 36). The human owner is unbounded
 * (invariant 34): the same dispose that the leader cannot perform is
 * executed by the human caller.
 */

import { describe, expect, it } from 'vitest'
import {
  TEAM_RUNTIME_ERROR_CODES,
} from '../admission/index.js'
import {
  destroyP6T1World,
} from './p6t1-helpers.js'
import {
  P6T2_SEEDS,
  createFakeLifecycleCommitPort,
  createP6T2Runtime,
  createP6T2World,
  expectRejection,
  humanCaller,
  makeActionRequest,
  memberCaller,
  p6t2Seed,
} from './p6t2-helpers.js'

interface AuthorityCase {
  readonly code: string
  readonly details?: Record<string, unknown>
  readonly newWrites: number
}

// ---------------------------------------------------------------------------
// A2 — role + envelope rejections (all zero writes by construction)
// ---------------------------------------------------------------------------
let a2: {
  readonly workerSelfEscalation: AuthorityCase
  readonly workerRequestControl: AuthorityCase
  readonly workerCreateMember: AuthorityCase
  readonly workerDelegate: AuthorityCase
  readonly leaderDispose: AuthorityCase
}
{
  const world = await createP6T2World('p6t2x-a2', ['leader', 'worker', 'scout'])
  try {
    const runtime = createP6T2Runtime(world)
    const run = async (
      request: Parameters<typeof makeActionRequest>[0],
      code: string,
    ): Promise<AuthorityCase> => {
      const before = world.seam.writeCount
      const rejection = await expectRejection(
        runtime,
        makeActionRequest(request),
        code,
      )
      return {
        code: rejection.code,
        details: rejection.details,
        newWrites: world.seam.writeCount - before,
      }
    }
    const workerId = P6T2_SEEDS.worker.instanceId
    a2 = {
      // MUST-TEST: member self escalation — `assign-task` is not in the
      // worker's envelope (team ∩ worker-template ∩ overlay).
      workerSelfEscalation: await run(
        {
          caller: memberCaller(workerId),
          targetInstanceId: workerId,
          requestToken: 'tok-p6t2-b2a',
        },
        TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
      ),
      // A worker asking for control on itself: `request-control` is not in
      // the worker template envelope (the scout template's is).
      workerRequestControl: await run(
        {
          action: 'request-control',
          caller: memberCaller(workerId),
          targetInstanceId: workerId,
          requestToken: 'tok-p6t2-b2b',
        },
        TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
      ),
      // Closed role set: create-member is [human, leader].
      workerCreateMember: await run(
        {
          action: 'create-member',
          caller: memberCaller(workerId),
          delegationTemplateId: 'scout',
          payload: { label: 'member-created' },
          requestToken: 'tok-p6t2-b2c',
        },
        TEAM_RUNTIME_ERROR_CODES.CALLER_AUTHORITY_DENIED,
      ),
      // Closed role set: delegate is [leader].
      workerDelegate: await run(
        {
          action: 'delegate',
          caller: memberCaller(workerId),
          delegationTemplateId: 'scout',
          payload: { label: 'member-delegated', prompt: 'p6t2 b2d delegate prompt' },
          requestToken: 'tok-p6t2-b2d',
        },
        TEAM_RUNTIME_ERROR_CODES.CALLER_AUTHORITY_DENIED,
      ),
      // MUST-TEST: leader out-of-envelope — the P6-T2 teamEnvelope has no
      // `dispose-member` (invariant 36: the leader never exceeds the team
      // autonomy envelope).
      leaderDispose: await run(
        {
          action: 'dispose-member',
          caller: { kind: 'instance', instanceId: 'inst-leader' },
          targetInstanceId: workerId,
          requestToken: 'tok-p6t2-b2e',
        },
        TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
      ),
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// ---------------------------------------------------------------------------
// B1 — the human boundary + the positive member/coordination controls
// ---------------------------------------------------------------------------
let b1: {
  readonly humanFollowUp: {
    readonly effectKind: string
    readonly fromLifecycle?: string
    readonly lifecycleCommitted?: boolean
    readonly newWrites: number
  }
  readonly scoutRequestControl: {
    readonly effectKind: string
    readonly factType?: string
    readonly newWrites: number
  }
  readonly workerSendMessage: {
    readonly effectKind: string
    readonly factType?: string
    readonly newWrites: number
  }
  readonly sendMessageByLabel: AuthorityCase
  readonly humanDispose: {
    readonly effectKind: string
    readonly from?: string
    readonly to?: string
    readonly newWrites: number
  }
}
{
  const world = await createP6T2World('p6t2x-b1', ['leader'], {
    seedMembers: [
      p6t2Seed('worker', { lifecycle: 'SETTLED' }),
      p6t2Seed('scout'),
    ],
  })
  try {
    // B1 wires the P7-T3 lifecycle-commit port (test double): the human
    // follow-up durably resumes the settled worker (SETTLED -> RUNNING) and
    // the human dispose durably commits RUNNING -> DISPOSED.
    const lifecycleCommit = createFakeLifecycleCommitPort(world)
    const runtime = createP6T2Runtime(world, { lifecycleCommit })
    const workerId = P6T2_SEEDS.worker.instanceId
    const scoutId = P6T2_SEEDS.scout.instanceId

    const beforeHumanFollowUp = world.seam.writeCount
    const humanFollowUpOutcome = await runtime.performAction(
      makeActionRequest({
        caller: humanCaller(),
        targetInstanceId: workerId,
        requestToken: 'tok-p6t2-b1a',
      }),
    )
    const humanFollowUpEffect = humanFollowUpOutcome.effect
    const humanFollowUpNewWrites = world.seam.writeCount - beforeHumanFollowUp

    const beforeScoutControl = world.seam.writeCount
    const scoutControlOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'request-control',
        caller: memberCaller(scoutId),
        targetInstanceId: scoutId,
        requestToken: 'tok-p6t2-b1b',
      }),
    )
    const scoutControlEffect = scoutControlOutcome.effect
    const scoutControlNewWrites = world.seam.writeCount - beforeScoutControl

    const beforeWorkerMessage = world.seam.writeCount
    const workerMessageOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'send-message',
        caller: memberCaller(workerId),
        targetInstanceId: scoutId,
        payload: {
          recipientInstanceId: scoutId,
          subject: 'sync',
          body: 'worker reports to scout',
        },
        requestToken: 'tok-p6t2-b1c',
      }),
    )
    const workerMessageEffect = workerMessageOutcome.effect
    const workerMessageNewWrites = world.seam.writeCount - beforeWorkerMessage

    const beforeLabelMessage = world.seam.writeCount
    const labelMessage = await expectRejection(
      runtime,
      makeActionRequest({
        action: 'send-message',
        caller: memberCaller(workerId),
        targetInstanceId: scoutId,
        payload: { recipientInstanceId: 'existing-scout' },
        requestToken: 'tok-p6t2-b1d',
      }),
      TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED,
    )
    const labelMessageNewWrites = world.seam.writeCount - beforeLabelMessage

    const beforeHumanDispose = world.seam.writeCount
    const humanDisposeOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'dispose-member',
        caller: humanCaller(),
        targetInstanceId: workerId,
        requestToken: 'tok-p6t2-b1e',
      }),
    )
    const humanDisposeEffect = humanDisposeOutcome.effect
    const humanDisposeNewWrites = world.seam.writeCount - beforeHumanDispose

    b1 = {
      humanFollowUp: {
        effectKind: humanFollowUpEffect.kind,
        ...(humanFollowUpEffect.kind === 'work-admitted'
          ? {
              fromLifecycle: humanFollowUpEffect.fromLifecycle,
              lifecycleCommitted: humanFollowUpEffect.lifecycleCommitted,
            }
          : {}),
        newWrites: humanFollowUpNewWrites,
      },
      scoutRequestControl: {
        effectKind: scoutControlEffect.kind,
        ...(scoutControlEffect.kind === 'fact-recorded'
          ? { factType: scoutControlEffect.factType }
          : {}),
        newWrites: scoutControlNewWrites,
      },
      workerSendMessage: {
        effectKind: workerMessageEffect.kind,
        ...(workerMessageEffect.kind === 'fact-recorded'
          ? { factType: workerMessageEffect.factType }
          : {}),
        newWrites: workerMessageNewWrites,
      },
      sendMessageByLabel: {
        code: labelMessage.code,
        details: labelMessage.details,
        newWrites: labelMessageNewWrites,
      },
      humanDispose: {
        effectKind: humanDisposeEffect.kind,
        ...(humanDisposeEffect.kind === 'lifecycle-changed'
          ? { from: humanDisposeEffect.from, to: humanDisposeEffect.to }
          : {}),
        newWrites: humanDisposeNewWrites,
      },
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T2 A2: role sets + mutation envelope rejections (zero writes)', () => {
  it('MUST-TEST: a worker self-escalation (follow-up on itself) is out of envelope', () => {
    expect(a2.workerSelfEscalation.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
    )
    const details = a2.workerSelfEscalation.details ?? {}
    expect(details['op']).toBe('assign-task')
    expect(Array.isArray(details['requiredOps'])).toBe(true)
    expect(
      (details['requiredOps'] as readonly string[]).includes('assign-task'),
    ).toBe(true)
    expect(a2.workerSelfEscalation.newWrites).toBe(0)
  })

  it('a worker request-control on itself is out of envelope (worker template has no request-control)', () => {
    expect(a2.workerRequestControl.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
    )
    expect((a2.workerRequestControl.details ?? {})['op']).toBe('request-control')
    expect(a2.workerRequestControl.newWrites).toBe(0)
  })

  it('a worker create-member is a closed-role-set denial (details.allowed = human+leader)', () => {
    expect(a2.workerCreateMember.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.CALLER_AUTHORITY_DENIED,
    )
    const details = a2.workerCreateMember.details ?? {}
    expect(details['role']).toBe('member')
    expect(details['allowed']).toEqual(['human', 'leader'])
    expect(a2.workerCreateMember.newWrites).toBe(0)
  })

  it('a worker delegate is a closed-role-set denial (delegate is leader-only)', () => {
    expect(a2.workerDelegate.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.CALLER_AUTHORITY_DENIED,
    )
    const details = a2.workerDelegate.details ?? {}
    expect(details['role']).toBe('member')
    expect(details['allowed']).toEqual(['leader'])
    expect(a2.workerDelegate.newWrites).toBe(0)
  })

  it('MUST-TEST: the leader disposing a member is out of the team envelope', () => {
    expect(a2.leaderDispose.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
    )
    const details = a2.leaderDispose.details ?? {}
    expect(details['op']).toBe('dispose-member')
    expect(details['requiredOps']).toEqual(['dispose-member'])
    expect(a2.leaderDispose.newWrites).toBe(0)
  })
})

describe('P6-T2 B1: the human override boundary + positive member controls', () => {
  it('a human follow-up on a settled worker executes (humans are not team-envelope-bound)', () => {
    expect(b1.humanFollowUp.effectKind).toBe('work-admitted')
    expect(b1.humanFollowUp.fromLifecycle).toBe('SETTLED')
    expect(b1.humanFollowUp.lifecycleCommitted).toBe(true)
    expect(b1.humanFollowUp.newWrites).toBeGreaterThan(0)
  })

  it('a scout request-control on itself records a coordination fact', () => {
    expect(b1.scoutRequestControl.effectKind).toBe('fact-recorded')
    expect(b1.scoutRequestControl.factType).toBe('team-coordination-recorded')
    expect(b1.scoutRequestControl.newWrites).toBeGreaterThan(0)
  })

  it('a worker send-message to a scout BY INSTANCE ID records a coordination fact', () => {
    expect(b1.workerSendMessage.effectKind).toBe('fact-recorded')
    expect(b1.workerSendMessage.factType).toBe('team-coordination-recorded')
    expect(b1.workerSendMessage.newWrites).toBeGreaterThan(0)
  })

  it('a send-message recipient BY LABEL is rejected (instanceId-first, invariant 19), zero writes', () => {
    expect(b1.sendMessageByLabel.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED,
    )
    expect(b1.sendMessageByLabel.details?.['kind']).toBe('member-label')
    expect(b1.sendMessageByLabel.newWrites).toBe(0)
  })

  it('MUST-TEST: the same dispose the leader cannot perform is executed by the human owner', () => {
    expect(b1.humanDispose.effectKind).toBe('lifecycle-changed')
    expect(b1.humanDispose.from).toBe('RUNNING')
    expect(b1.humanDispose.to).toBe('DISPOSED')
    expect(b1.humanDispose.newWrites).toBeGreaterThan(0)
  })
})
