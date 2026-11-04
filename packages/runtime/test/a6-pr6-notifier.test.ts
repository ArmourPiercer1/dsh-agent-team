import { describe, expect, it, vi } from 'vitest'
import {
  createAlpha6RootControlNotifier,
  createComposedControlNotifier,
  renderOfficerReviewWake,
} from '../alpha6/notifier.js'
import { decideAlpha6Composition } from '../alpha6/composition.js'
import { createLeaderControlNotifier } from '../control/leader-notification.js'
import type { ControlRequestRecord } from '../control/types.js'

const request: ControlRequestRecord = {
  requestId: 'req-a6-pr6-1',
  rootSessionId: 'root-a6-pr6',
  kind: 'leader-approval',
  requester: { kind: 'instance', instanceId: 'worker-1' },
  subject: { kind: 'instance', instanceId: 'worker-1' },
  targetInstanceId: 'worker-1',
  toolName: 'team_delegate',
  summary: 'write ./out',
  status: 'pending',
  createdAt: 1,
} as unknown as ControlRequestRecord

const alpha = decideAlpha6Composition({
  enabled: true,
  blueprintDocumentVersion: 5,
  reviewRouting: { enabled: true, officerTemplateId: 'officer' },
  activeMemberTemplateIds: ['worker', 'officer'],
  leaderTemplateId: 'leader',
})

describe('A6-PR6 notifier composition', () => {
  it('renders a deterministic Officer wake with the dedup token and no decision', () => {
    const text = renderOfficerReviewWake(request)
    expect(text.startsWith('[team-review-wake requestId=req-a6-pr6-1]')).toBe(true)
    expect(text).toContain('team_resolve_control')
    expect(text).not.toMatch(/\ballow\b|\bdeny\b/)
    expect(renderOfficerReviewWake(request)).toBe(text)
  })

  it('alpha6 wakes ONLY the assigned Officer session', async () => {
    const legacy = createLeaderControlNotifier({ deliver: vi.fn(async () => {}) })
    const leaderNotify = vi.spyOn(legacy, 'notifyLeaderRequest')
    const wake = vi.fn(async () => {})
    const composed = createComposedControlNotifier({
      decision: alpha,
      legacy,
      wake,
      recipientSessionId: 'session-officer',
    })
    await composed.notifyLeaderRequest(request)
    expect(leaderNotify).not.toHaveBeenCalled()
    expect(wake).toHaveBeenCalledWith({
      targetSessionId: 'session-officer',
      wakeId: 'review:req-a6-pr6-1',
      text: renderOfficerReviewWake(request),
    })
  })

  it('legacy keeps the exact Leader notifier byte-identical', async () => {
    const deliver = vi.fn(async () => {})
    const legacy = createLeaderControlNotifier({ deliver })
    const wake = vi.fn(async () => {})
    const composed = createComposedControlNotifier({
      decision: { mode: 'legacy', reason: 'disabled' },
      legacy,
      wake,
      recipientSessionId: 'session-officer',
    })
    await composed.notifyLeaderRequest(request)
    expect(wake).not.toHaveBeenCalled()
    expect(deliver).toHaveBeenCalledTimes(1)
    expect((deliver.mock.calls[0] as unknown[])[0]).toMatchObject({
      rootSessionId: 'root-a6-pr6',
      requestId: 'req-a6-pr6-1',
    })
  })
})

describe('A6 root control notifier — trusted reviewer resolution', () => {
  const legRequest = {
    ...request,
    approvalCaseId: 'case-a6-root-1',
    legOrdinal: 1,
  } as ControlRequestRecord

  it('resolves the current Officer through the facts port and wakes that child session', async () => {
    const deliver = vi.fn(async () => {})
    const resolve = vi.fn(async () => ({ instanceId: 'inst-officer' }))
    const notifier = createAlpha6RootControlNotifier({
      rootSessionId: 'root-a6-pr6',
      resolveCurrentReviewer: resolve,
      memberSession: () => ({ childSessionId: 'session-officer-child' }),
      deliver,
    })
    await notifier.notifyLeaderRequest(legRequest)
    expect(resolve).toHaveBeenCalledWith({
      rootSessionId: 'root-a6-pr6',
      approvalCaseId: 'case-a6-root-1',
      currentLegRequestId: 'req-a6-pr6-1',
      legOrdinal: 1,
    })
    expect(deliver).toHaveBeenCalledWith({
      targetSessionId: 'session-officer-child',
      wakeId: 'review:req-a6-pr6-1',
      text: renderOfficerReviewWake(legRequest),
    })
  })

  it('throws instead of falling back to the Leader when no reviewer resolves', async () => {
    const deliver = vi.fn(async () => {})
    const notifier = createAlpha6RootControlNotifier({
      rootSessionId: 'root-a6-pr6',
      resolveCurrentReviewer: async () => null,
      memberSession: () => ({ childSessionId: 'session-officer-child' }),
      deliver,
    })
    await expect(notifier.notifyLeaderRequest(legRequest)).rejects.toThrow(/no Leader fallback/)
    expect(deliver).not.toHaveBeenCalled()
  })
})

describe('A6 root notifier — trusted merge', () => {
  const legs = ['1', '2', '3'].map((n) => ({
    ...request,
    requestId: `req-a6-merge-${n}`,
    approvalCaseId: `case-a6-merge-${n}`,
    legOrdinal: 1,
    reviewAuthority: 'leader' as const,
  } as ControlRequestRecord))

  it('merges three delegable legs for one reviewer into ONE wake', async () => {
    const deliver = vi.fn(async (_wake: { targetSessionId: string; wakeId: string; text: string }) => {})
    const resolve = vi.fn(async () => ({ instanceId: 'inst-officer' }))
    const notifier = createAlpha6RootControlNotifier({
      rootSessionId: 'root-a6-pr6',
      resolveCurrentReviewer: resolve,
      memberSession: () => ({ childSessionId: 'session-officer-child' }),
      deliver,
      readRequests: async () => legs,
      reviewFacts: async () => ({
        reviewRouting: {
          enabled: true,
          officerTemplateId: 'officer',
          ordinaryToolApprovals: { default: 'officer', leaderExceptions: [] },
          whenOfficerUnavailable: 'hold',
        },
        fixedLeaderOrHumanCategory: false,
        requiresHuman: false,
      }),
    })
    await notifier.notifyLeaderRequest(legs[0]!)
    expect(deliver).toHaveBeenCalledTimes(1)
    const wake = deliver.mock.calls[0]![0]
    expect(wake.wakeId).toBe('review:req-a6-merge-1,req-a6-merge-2,req-a6-merge-3')
    expect(wake.text).toContain('requests=3')
  })

  it('excludes a fixed Leader/Human leg from the merge', async () => {
    const deliver = vi.fn(async (_wake: { targetSessionId: string; wakeId: string; text: string }) => {})
    const notifier = createAlpha6RootControlNotifier({
      rootSessionId: 'root-a6-pr6',
      resolveCurrentReviewer: async () => ({ instanceId: 'inst-officer' }),
      memberSession: () => ({ childSessionId: 'session-officer-child' }),
      deliver,
      readRequests: async () => legs,
      reviewFacts: async (query) => ({
        reviewRouting: {
          enabled: true,
          officerTemplateId: 'officer',
          ordinaryToolApprovals: { default: 'officer', leaderExceptions: [] },
          whenOfficerUnavailable: 'hold',
        },
        fixedLeaderOrHumanCategory: query.currentLegRequestId === 'req-a6-merge-2',
        requiresHuman: false,
      }),
    })
    await notifier.notifyLeaderRequest(legs[0]!)
    expect(deliver).toHaveBeenCalledTimes(1)
    const wake = deliver.mock.calls[0]![0]
    expect(wake.wakeId).toBe('review:req-a6-merge-1,req-a6-merge-3')
  })
})

describe('A6 root notifier — coordinator seam', () => {
  const legs = ['1', '2', '3'].map((n) => ({
    ...request,
    requestId: `req-a6-latch-${n}`,
    approvalCaseId: `case-a6-latch-${n}`,
    legOrdinal: 1,
    reviewAuthority: 'leader' as const,
  } as ControlRequestRecord))

  it('hands the merged leg set to the coordinator seam once', async () => {
    const dispatchWake = vi.fn(
      async (_input: {
        reviewerInstanceId: string
        targetSessionId: string
        currentLegIds: readonly string[]
      }) => {},
    )
    const notifier = createAlpha6RootControlNotifier({
      rootSessionId: 'root-a6-pr6',
      resolveCurrentReviewer: async () => ({ instanceId: 'inst-officer' }),
      memberSession: () => ({ childSessionId: 'session-officer-child' }),
      deliver: async () => {
        throw new Error('direct delivery must not run when the latch seam exists')
      },
      dispatchWake,
      readRequests: async () => legs,
      reviewFacts: async () => ({
        reviewRouting: {
          enabled: true,
          officerTemplateId: 'officer',
          ordinaryToolApprovals: { default: 'officer', leaderExceptions: [] },
          whenOfficerUnavailable: 'hold',
        },
        fixedLeaderOrHumanCategory: false,
        requiresHuman: false,
      }),
    })
    await notifier.notifyLeaderRequest(legs[0]!)
    expect(dispatchWake).toHaveBeenCalledTimes(1)
    expect(dispatchWake.mock.calls[0]![0].currentLegIds).toEqual([
      'req-a6-latch-1',
      'req-a6-latch-2',
      'req-a6-latch-3',
    ])
  })
})
