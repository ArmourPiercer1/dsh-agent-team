/**
 * A6-PR7 — the merged wake reaches a REAL Host inbox exactly once.
 *
 * This is the first end-to-end leg of the main path: three routed asks are
 * merged by wake-plan, dispatched through the coordinator, rendered by the
 * delivery seam, and written to the live Host's followup inbox. No v5 catalog
 * activation is involved; routing facts are the PR1 test shape.
 */
import { describe, expect, it } from 'vitest'
import { createLiveWorld } from './t12a-live-bridge.mjs'
import { blueprintReviewPolicyFrom, type ReviewRouteInput } from '../review-router/index.js'
import type { ReviewRouting } from '../../domain/blueprint/src/index.js'
import { createReviewWakeCoordinator } from '../review-wake/index.js'
import { planReviewWakes } from '../alpha6/wake-plan.js'
import { dispatchReviewWakes, reviewWakeKeyFor } from '../alpha6/wake-dispatch.js'

const ROOT = 'session-root-a6-pr7-merged'
const ROUTING: ReviewRouting = {
  enabled: true,
  officerTemplateId: 'officer',
  ordinaryToolApprovals: { default: 'officer', leaderExceptions: [] },
  whenOfficerUnavailable: 'hold',
}
const POLICY = blueprintReviewPolicyFrom(ROUTING)!
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
function input(requestId: string): ReviewRouteInput {
  return {
    policy: POLICY,
    currentLeg: { ...LEG, requestId },
    currentOfficer: { status: 'active', instanceId: ROOT, templateId: 'officer' },
    leader: { instanceId: 'session-leader-a6-pr7', templateId: 'leader' },
    transfer: null,
  }
}

interface WakeBinding {
  boot(): Promise<void>
  deliverReviewWake(input: { rootSessionId: string; targetSessionId: string; wakeId: string; text: string }): Promise<void>
}

describe('A6-PR7 merged wake — real Host inbox', () => {
  it('delivers three routed asks as ONE attributed inbox input', async () => {
    const world = await createLiveWorld({ rootSessionId: ROOT })
    const binding = world.binding as unknown as WakeBinding
    await binding.boot()
    const before = world.records.followups.length
    const plan = planReviewWakes([input('req-1'), input('req-2'), input('req-3')])
    expect(plan.wakes).toHaveLength(1)
    const coordinator = createReviewWakeCoordinator(reviewWakeKeyFor(plan.wakes[0]!, ROOT, 0))
    const deliver = async (input: {
      readonly key: { readonly reviewerInstanceId: string }
      readonly wakeId: string
      readonly text: string
    }): Promise<void> => {
      await binding.deliverReviewWake({
        rootSessionId: ROOT,
        targetSessionId: input.key.reviewerInstanceId,
        wakeId: input.wakeId,
        text: input.text,
      })
    }

    const result = await dispatchReviewWakes({
      plan,
      rootSessionId: ROOT,
      coordinators: [coordinator],
      deliver,
    })
    expect(result.delivered).toHaveLength(1)
    const added = world.records.followups.slice(before) as { sessionId: string; message: { content: { text?: string }[]; source: unknown } }[]
    expect(added).toHaveLength(1)
    expect(added[0]?.sessionId).toBe(ROOT)
    expect(added[0]?.message.content[0]?.text).toContain('[team-review-wake')
    expect(added[0]?.message.source).toEqual({ kind: 'plugin:dsh-agent-team' })
  })
})
