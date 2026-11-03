import { describe, expect, it } from 'vitest'
import { blueprintReviewPolicyFrom, type ReviewRouteInput } from '../review-router/index.js'
import type { ReviewRouting } from '../../domain/blueprint/src/index.js'
import { planReviewWakes } from '../alpha6/wake-plan.js'

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
function input(requestId: string, over: Partial<ReviewRouteInput> = {}): ReviewRouteInput {
  return {
    policy: POLICY,
    currentLeg: { ...LEG, requestId },
    currentOfficer: { status: 'active', instanceId: 'session-officer', templateId: 'officer' },
    leader: { instanceId: 'session-leader', templateId: 'leader' },
    transfer: null,
    ...over,
  }
}

describe('A6 main wake plan — router then per-recipient merge', () => {
  it('merges three ordinary asks into ONE Officer wake', () => {
    const plan = planReviewWakes([input('req-1'), input('req-2'), input('req-3')])
    expect(plan.wakes).toEqual([
      { sessionId: 'session-officer', templateId: 'officer', routeRole: 'officer', currentLegIds: ['req-1', 'req-2', 'req-3'] },
    ])
    expect(plan.humanLegIds).toEqual([])
  })

  it('does not merge across recipients and never invents one on hold', () => {
    const plan = planReviewWakes([
      input('req-1'),
      input('req-2', { currentOfficer: { status: 'ambiguous', candidates: ['a', 'b'] } as never }),
    ])
    expect(plan.wakes[0]?.currentLegIds).toEqual(['req-1'])
    expect(plan.held).toHaveLength(1)
  })
})
