/**
 * Alpha.6 — wake dispatch slice acceptance suite.
 *
 * Proves the router-first plan is delivered through the
 * `ReviewWakeCoordinator` reducer (never the direct per-request notifier):
 *   - three asks merged per recipient produce ONE wake / ONE delivery;
 *   - a plan arriving during an active turn polls/dirties, never a second
 *     delivery;
 *   - a delivery-port failure surfaces as `delivery-failed` and releases the
 *     latch for a later retry (no lost wake, no false success);
 *   - held routes (and human targets) are surfaced but never delivered;
 *   - the key/fingerprint are deterministic across fresh runs.
 *
 * @module packages/runtime/test/a6-pr6-wake-dispatch.test
 */

import { describe, expect, it } from 'vitest'
import { blueprintReviewPolicyFrom, type ReviewRouteInput } from '../review-router/index.js'
import type { ReviewRouting } from '../../domain/blueprint/src/index.js'
import { planReviewWakes } from '../alpha6/wake-plan.js'
import {
  dispatchReviewWakes,
  planFingerprint,
  reviewWakeKeyFor,
} from '../alpha6/wake-dispatch.js'
import {
  createReviewWakeCoordinator,
  type ReviewWakeCoordinator,
  type ReviewWakeDeliveryPort,
} from '../review-wake/index.js'

const ROUTING: ReviewRouting = {
  enabled: true,
  officerTemplateId: 'officer',
  ordinaryToolApprovals: { default: 'officer', leaderExceptions: [] },
  whenOfficerUnavailable: 'hold',
}
const POLICY = blueprintReviewPolicyFrom(ROUTING)!
const ROOT = 'session-root-wake-dispatch'
const GENERATION = 1
const OFFICER = 'session-officer'

const LEG = {
  status: 'pending' as const,
  kind: 'leader-approval' as const,
  reviewAuthority: 'leader' as const,
  operationOwnerTemplateId: 'worker',
  requiresHuman: false,
  hasLegalResolver: true,
  fixedLeaderCategory: false,
  ordinaryAsk: {
    kind: 'leader-approval' as const,
    reviewAuthority: 'leader' as const,
    requestedEffect: 'ask' as const,
    operationFingerprint: 'op-1',
    mutationProposalFingerprint: null,
    authorityScope: { kind: 'exact' as const, path: './out' },
    operationTool: { owner: 'dsh.fs', name: 'write' },
    perEffectRequiredAuthorities: ['leader' as const],
    fixedLeaderOrHumanCategory: false,
  },
}

function input(requestId: string, over: Partial<ReviewRouteInput> = {}): ReviewRouteInput {
  return {
    policy: POLICY,
    currentLeg: { ...LEG, requestId },
    currentOfficer: { status: 'active', instanceId: OFFICER, templateId: 'officer' },
    leader: { instanceId: 'session-leader', templateId: 'leader' },
    transfer: null,
    ...over,
  }
}

interface RecordingPort {
  readonly calls: { wakeId: string; target: string; text: string }[]
  readonly deliver: ReviewWakeDeliveryPort
}

function recordingPort(): RecordingPort {
  const calls: { wakeId: string; target: string; text: string }[] = []
  return {
    calls,
    deliver: async (delivery) => {
      calls.push({
        wakeId: delivery.wakeId,
        target: delivery.key.reviewerInstanceId,
        text: delivery.text,
      })
    },
  }
}

/** One latch per planned recipient, at the suite's root/generation. */
function coordinatorsFor(
  plan: ReturnType<typeof planReviewWakes>,
): ReviewWakeCoordinator[] {
  return plan.wakes.map((wake) =>
    createReviewWakeCoordinator(reviewWakeKeyFor(wake, ROOT, GENERATION)),
  )
}

describe('A6 wake dispatch — one plan, one reducer cycle', () => {
  it('delivers ONE wake for three asks merged per recipient', async () => {
    const plan = planReviewWakes([input('req-1'), input('req-2'), input('req-3')])
    expect(plan.wakes).toHaveLength(1)

    const port = recordingPort()
    const result = await dispatchReviewWakes({
      plan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators: coordinatorsFor(plan),
      deliver: port.deliver,
    })

    expect(port.calls).toHaveLength(1)
    expect(port.calls[0]?.target).toBe(OFFICER)
    expect(port.calls[0]?.text).toContain(`wakeId=${port.calls[0]?.wakeId}`)
    expect(result.delivered).toHaveLength(1)
    expect(result.delivered[0]?.legCount).toBe(3)
    expect(result.delivered[0]?.workFingerprint).toMatch(/^a6wake:v1:3:/)
    expect(result.delivered[0]?.sessionId).toBe(OFFICER)
    expect(result.delivered[0]?.status).toBe('idle')
    expect(result.delivered[0]?.dirty).toBe(false)
    expect(result.failures).toEqual([])
    expect(result.held).toEqual([])
  })

  it('is deterministic: the same plan yields the same key/fingerprint/wakeId and never re-wakes unchanged work', async () => {
    const plan = planReviewWakes([input('req-1'), input('req-2'), input('req-3')])
    const wake = plan.wakes[0]!
    expect(planFingerprint(wake)).toBe(planFingerprint(wake))
    expect(reviewWakeKeyFor(wake, ROOT, GENERATION)).toEqual({
      rootSessionId: ROOT,
      reviewerInstanceId: OFFICER,
      sessionGeneration: GENERATION,
    })

    const first = recordingPort()
    const firstLatches = coordinatorsFor(plan)
    const firstResult = await dispatchReviewWakes({
      plan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators: firstLatches,
      deliver: first.deliver,
    })
    expect(first.calls).toHaveLength(1)

    // A second, fresh run (fresh latches) reproduces the same wake identity.
    const second = recordingPort()
    const secondResult = await dispatchReviewWakes({
      plan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators: coordinatorsFor(plan),
      deliver: second.deliver,
    })
    expect(second.calls[0]?.wakeId).toBe(first.calls[0]?.wakeId)
    expect(secondResult.delivered[0]?.workFingerprint).toBe(
      firstResult.delivered[0]?.workFingerprint,
    )

    // The same plan over the SAME latch: pending-but-unchanged, no wake.
    const repeat = await dispatchReviewWakes({
      plan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators: firstLatches,
      deliver: first.deliver,
    })
    expect(first.calls).toHaveLength(1)
    expect(repeat.delivered).toEqual([])
    expect(repeat.dirty).toEqual([])
  })

  it('polls during an active turn: queued/dirty, never a second delivery', async () => {
    const firstPlan = planReviewWakes([input('req-1')])
    const coordinators = coordinatorsFor(firstPlan)
    const coordinator = coordinators[0]!
    const port = recordingPort()

    await dispatchReviewWakes({
      plan: firstPlan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators,
      deliver: port.deliver,
    })
    expect(port.calls).toHaveLength(1)
    expect(coordinator.state.status).toBe('idle')

    // Simulate the recipient's next turn: a queued wake was claimed and the
    // turn is still running when the next plan arrives.
    const queued = coordinator.dispatch({
      type: 'scan-result',
      work: { kind: 'ready', fingerprint: 'active-turn-work' },
    })
    expect(queued.outcome).toBe('applied')
    expect(coordinator.dispatch({ type: 'turn-start' }).outcome).toBe('applied')
    expect(coordinator.state.status).toBe('running')

    const nextPlan = planReviewWakes([input('req-2'), input('req-3'), input('req-4')])
    const duringTurn = await dispatchReviewWakes({
      plan: nextPlan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators,
      deliver: port.deliver,
    })

    expect(port.calls).toHaveLength(1)
    expect(duringTurn.delivered).toEqual([])
    expect(duringTurn.dirty).toEqual([OFFICER])
    expect(duringTurn.queued).toEqual([])
    expect(duringTurn.deliveries[0]?.status).toBe('running')
    expect(coordinator.state.status).toBe('running')
    expect(coordinator.state.dirty).toBe(true)

    // The host's turn-end releases the latch; the still-pending merged plan
    // then yields exactly one fresh wake.
    expect(coordinator.dispatch({ type: 'turn-end' }).outcome).toBe('applied')
    const afterTurn = await dispatchReviewWakes({
      plan: nextPlan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators,
      deliver: port.deliver,
    })
    expect(port.calls).toHaveLength(2)
    expect(afterTurn.delivered).toHaveLength(1)
    expect(afterTurn.delivered[0]?.legCount).toBe(3)
  })

  it('surfaces a delivery-port failure as delivery-failed and keeps the wake retryable', async () => {
    const plan = planReviewWakes([input('req-1'), input('req-2')])
    const coordinators = coordinatorsFor(plan)
    const coordinator = coordinators[0]!
    const calls: string[] = []
    let attempt = 0
    const deliver: ReviewWakeDeliveryPort = async (delivery) => {
      attempt += 1
      if (attempt === 1) throw new Error('inbox unavailable')
      calls.push(delivery.wakeId)
    }

    const failed = await dispatchReviewWakes({
      plan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators,
      deliver,
    })

    expect(calls).toEqual([])
    expect(failed.delivered).toEqual([])
    expect(failed.failures).toHaveLength(1)
    expect(failed.failures[0]?.scope).toBe('delivery')
    expect(failed.failures[0]?.message).toBe('inbox unavailable')
    expect(failed.dirty).toEqual([OFFICER])
    // Released, not lost: idle + baseline reset + dirty, no outstanding wakeId.
    expect(coordinator.state.status).toBe('idle')
    expect(coordinator.state.wakeId).toBeNull()
    expect(coordinator.state.observedWorkFingerprint).toBeNull()
    expect(coordinator.state.dirty).toBe(true)

    // A later activation retries the SAME still-pending work, once.
    const retried = await dispatchReviewWakes({
      plan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators,
      deliver,
    })
    expect(calls).toHaveLength(1)
    expect(retried.delivered).toHaveLength(1)
    expect(retried.delivered[0]?.legCount).toBe(2)
    expect(retried.failures).toEqual([])
  })

  it('never delivers held routes or human targets', async () => {
    const plan = planReviewWakes([
      input('req-ordinary'),
      input('req-held', {
        currentOfficer: { status: 'ambiguous', activeCount: 2 },
      }),
      input('req-human', {
        currentLeg: { ...LEG, requestId: 'req-human', requiresHuman: true },
      }),
    ])
    expect(plan.wakes).toHaveLength(1)
    expect(plan.held).toHaveLength(1)
    expect(plan.held[0]?.requestId).toBe('req-held')
    expect(plan.humanLegIds).toEqual(['req-human'])

    const port = recordingPort()
    const result = await dispatchReviewWakes({
      plan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators: coordinatorsFor(plan),
      deliver: port.deliver,
    })

    expect(port.calls).toHaveLength(1)
    expect(port.calls[0]?.text).not.toContain('req-held')
    expect(port.calls[0]?.text).not.toContain('req-human')
    expect(result.delivered).toHaveLength(1)
    expect(result.delivered[0]?.legCount).toBe(1)
    expect(result.held).toEqual(plan.held)
    expect(result.humanLegIds).toEqual(['req-human'])
    expect(result.deliveries).toHaveLength(1)
    expect(result.failures).toEqual([])
  })
})
