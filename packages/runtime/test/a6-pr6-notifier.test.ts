import { describe, expect, it, vi } from 'vitest'
import {
  createAlpha6RootControlNotifier,
  createComposedControlNotifier,
  renderOfficerReviewWake,
} from '../alpha6/notifier.js'
import { decideAlpha6Composition } from '../alpha6/composition.js'
import { createLeaderControlNotifier } from '../control/leader-notification.js'
import type { ControlRequestRecord } from '../control/types.js'
import { createAlpha6RootRouter } from '../alpha6/root-router.js'
import type { ReviewRouting } from '../../domain/blueprint/src/index.js'

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
      memberSession: (_root: string, _instanceId: string) => ({ childSessionId: 'session-officer-child' }),
      deliver,
    })
    await notifier.notifyLeaderRequest(legRequest)
    expect(resolve).toHaveBeenCalledWith({
      rootSessionId: 'root-a6-pr6',
      approvalCaseId: 'case-a6-root-1',
      currentLegRequestId: 'req-a6-pr6-1',
      legOrdinal: 1,
    })
    expect(deliver).toHaveBeenCalledWith('root-a6-pr6', {
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
      memberSession: (_root: string, _instanceId: string) => ({ childSessionId: 'session-officer-child' }),
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
    const deliver = vi.fn(async (_root: string, _wake: { targetSessionId: string; wakeId: string; text: string }) => {})
    const resolve = vi.fn(async () => ({ instanceId: 'inst-officer' }))
    const notifier = createAlpha6RootControlNotifier({
      rootSessionId: 'root-a6-pr6',
      resolveCurrentReviewer: resolve,
      memberSession: (_root: string, _instanceId: string) => ({ childSessionId: 'session-officer-child' }),
      deliver,
      readRequests: async (_root: string) => legs,
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
    const wake = deliver.mock.calls[0]![1]
    expect(wake.wakeId).toBe('review:req-a6-merge-1,req-a6-merge-2,req-a6-merge-3')
    expect(wake.text).toContain('requests=3')
  })

  it('excludes a fixed Leader/Human leg from the merge', async () => {
    const deliver = vi.fn(async (_root: string, _wake: { targetSessionId: string; wakeId: string; text: string }) => {})
    const notifier = createAlpha6RootControlNotifier({
      rootSessionId: 'root-a6-pr6',
      resolveCurrentReviewer: async () => ({ instanceId: 'inst-officer' }),
      memberSession: (_root: string, _instanceId: string) => ({ childSessionId: 'session-officer-child' }),
      deliver,
      readRequests: async (_root: string) => legs,
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
    const wake = deliver.mock.calls[0]![1]
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
      memberSession: (_root: string, _instanceId: string) => ({ childSessionId: 'session-officer-child' }),
      deliver: async () => {
        throw new Error('direct delivery must not run when the latch seam exists')
      },
      dispatchWake,
      readRequests: async (_root: string) => legs,
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

describe('A6 root notifier — exclusion laws', () => {
  const legs = ['1', '2'].map((n) => ({
    ...request,
    requestId: `req-a6-exclude-${n}`,
    approvalCaseId: `case-a6-exclude-${n}`,
    legOrdinal: 1,
    reviewAuthority: 'leader' as const,
  } as ControlRequestRecord))

  it('excludes a requiresHuman leg and a leg resolved to another reviewer', async () => {
    const deliver = vi.fn(async (_root: string, _wake: { targetSessionId: string; wakeId: string; text: string }) => {})
    const notifier = createAlpha6RootControlNotifier({
      rootSessionId: 'root-a6-pr6',
      resolveCurrentReviewer: async (query) =>
        query.currentLegRequestId === 'req-a6-exclude-2'
          ? { instanceId: 'inst-other-officer' }
          : { instanceId: 'inst-officer' },
      memberSession: (_root: string, _instanceId: string) => ({ childSessionId: 'session-officer-child' }),
      deliver,
      readRequests: async (_root: string) => legs,
      reviewFacts: async (query) => ({
        reviewRouting: {
          enabled: true,
          officerTemplateId: 'officer',
          ordinaryToolApprovals: { default: 'officer', leaderExceptions: [] },
          whenOfficerUnavailable: 'hold',
        },
        fixedLeaderOrHumanCategory: false,
        requiresHuman: query.currentLegRequestId === 'req-a6-exclude-1',
      }),
    })
    await notifier.notifyLeaderRequest({
      ...request,
      requestId: 'req-a6-seed',
      approvalCaseId: 'case-a6-seed',
      legOrdinal: 1,
      reviewAuthority: 'leader' as const,
    } as ControlRequestRecord)
    expect(deliver).toHaveBeenCalledTimes(1)
    expect(deliver.mock.calls[0]![1].wakeId).toBe('review:req-a6-seed')
  })
})

describe('A6 root notifier — the shared router is the recipient authority', () => {
  it('notifies the LEADER (never the Officer) when the router routes to the Leader', async () => {
    const deliver = vi.fn(async () => {})
    const notifyLeader = vi.fn(async () => {})
    const notifier = createAlpha6RootControlNotifier({
      rootSessionId: 'root-a6-route',
      resolveCurrentReviewer: async () => ({ instanceId: 'inst-officer' }),
      memberSession: () => ({ childSessionId: 'session-officer' }),
      deliver,
      route: async () => ({ kind: 'recipient', target: { kind: 'instance', instanceId: 'inst-leader', templateId: 'leader', routeRole: 'leader' }, reason: 'fixed Leader category' }),
      notifyLeader,
    })
    await notifier.notifyLeaderRequest({ ...request, requestId: 'req-route-leader', approvalCaseId: 'case-route-leader', legOrdinal: 1 } as ControlRequestRecord)
    expect(notifyLeader).toHaveBeenCalledTimes(1)
    expect(deliver).not.toHaveBeenCalled()
  })

  it('never lets an authored hold become a Leader decision', async () => {
    const deliver = vi.fn(async () => {})
    const notifyLeader = vi.fn(async () => {})
    const notifier = createAlpha6RootControlNotifier({
      rootSessionId: 'root-a6-route',
      resolveCurrentReviewer: async () => ({ instanceId: 'inst-officer' }),
      memberSession: () => ({ childSessionId: 'session-officer' }),
      deliver,
      route: async () => ({ kind: 'hold', holdReason: 'officer-availability-unconfirmed', reason: 'policy says hold' }),
      notifyLeader,
    })
    const held = {
      ...request,
      requestId: 'req-route-held',
      approvalCaseId: 'case-route-held',
      legOrdinal: 1,
      reviewAuthority: 'leader' as const,
      operationToolOwner: 'dsh-agent-team',
      operationToolName: 'bash',
      perEffectRequiredAuthorities: ['leader'],
    } as ControlRequestRecord
    await expect(notifier.notifyLeaderRequest(held)).rejects.toThrow(/is hold/)
    expect(notifyLeader).not.toHaveBeenCalled()
    expect(deliver).not.toHaveBeenCalled()
  })

  it('delivers an UNROUTABLE legacy guard row to the Leader, not an A6 ordinary ask', async () => {
    const deliver = vi.fn(async () => {})
    const notifyLeader = vi.fn(async () => {})
    const notifier = createAlpha6RootControlNotifier({
      rootSessionId: 'root-a6-route',
      resolveCurrentReviewer: async () => ({ instanceId: 'inst-officer' }),
      memberSession: () => ({ childSessionId: 'session-officer' }),
      deliver,
      route: async () => ({ kind: 'unroutable', reason: 'not a delegable ordinary tool ask' }),
      notifyLeader,
    })
    const legacy = {
      ...request,
      requestId: 'req-route-legacy',
      approvalCaseId: 'case-route-legacy',
      legOrdinal: 1,
      reviewAuthority: 'leader' as const,
      actionName: 'parameter-permission',
    } as ControlRequestRecord
    await notifier.notifyLeaderRequest(legacy)
    expect(notifyLeader).toHaveBeenCalledTimes(1)
    expect(deliver).not.toHaveBeenCalled()
  })

  it('delivers a CASE-LESS leader-approval row to the Leader instead of throwing', async () => {
    const deliver = vi.fn(async () => {})
    const notifyLeader = vi.fn(async () => {})
    const notifier = createAlpha6RootControlNotifier({
      rootSessionId: 'root-a6-route',
      resolveCurrentReviewer: async () => ({ instanceId: 'inst-officer' }),
      memberSession: () => ({ childSessionId: 'session-officer' }),
      deliver,
      route: async () => null,
      notifyLeader,
    })
    const caseLess = { ...request, requestId: 'req-route-plain', approvalCaseId: undefined, legOrdinal: undefined, kind: 'leader-approval' as const }
    await notifier.notifyLeaderRequest(caseLess as ControlRequestRecord)
    expect(notifyLeader).toHaveBeenCalledTimes(1)
    expect(deliver).not.toHaveBeenCalled()
  })
})

describe('A6 root router — real idle Officer liveness', () => {
  const routing: ReviewRouting = {
    enabled: true,
    officerTemplateId: 'officer',
    ordinaryToolApprovals: { default: 'officer', leaderExceptions: [] },
    whenOfficerUnavailable: 'hold',
  }
  const leg = {
    requestId: 'ctrl-a6-router-1',
    approvalCaseId: 'case-a6-router-1',
    legOrdinal: 1,
    status: 'pending',
    kind: 'leader-approval',
    reviewAuthority: 'leader',
    requestedEffect: 'allow',
    operationFingerprint: 'sha256:op',
    authorityScope: { kind: 'exact', path: '/tmp/a6-router' },
    reviewPayload: { authorityScope: { kind: 'exact', path: '/tmp/a6-router' } },
    operationToolOwner: 'dsh-agent-team',
    operationToolName: 'bash',
    operationOwnerTemplateId: 'worker',
    perEffectRequiredAuthorities: ['leader'],
  } as never
  const routerWith = (lifecycle: string) => createAlpha6RootRouter({
    rootSessionId: 'root-a6-router',
    routing,
    leaderTemplateId: 'leader',
    control: { readControlState: async () => ({ requests: [leg], transfers: [] } as never) },
    members: {
      list: () => [
        { instanceId: 'inst-officer', templateId: 'officer', childSessionId: 'session-child', lifecycle, rootSessionId: 'root-a6-router' },
        { instanceId: 'inst-leader', templateId: 'leader' },
      ],
    },
    fixedLeaderOrHumanCategory: () => false,
  })

  for (const lifecycle of ['CREATED', 'RUNNING', 'SETTLED'] as const) {
    it(`routes to a ${lifecycle} Officer`, async () => {
      await expect(routerWith(lifecycle).route('ctrl-a6-router-1', 'root-a6-router')).resolves.toMatchObject({
        kind: 'recipient',
        target: { kind: 'instance', instanceId: 'inst-officer', routeRole: 'officer' },
      })
    })
  }

  it('uses the CHILD root policy when its officerTemplateId differs from the boot policy', async () => {
    const childRouting: ReviewRouting = {
      ...routing,
      officerTemplateId: 'child-officer',
    }
    const router = createAlpha6RootRouter({
      rootSessionId: 'root-a6-router',
      routing,
      leaderTemplateId: 'leader',
      routingForRoot: (root) => root === 'root-child'
        ? { routing: childRouting, leaderTemplateId: 'leader' }
        : { routing, leaderTemplateId: 'leader' },
      control: {
        readControlState: async () => ({ requests: [leg], transfers: [] } as never),
      },
      members: {
        list: (root) => root === 'root-child'
          ? [
              { instanceId: 'inst-child-officer', templateId: 'child-officer', childSessionId: 'child-session', lifecycle: 'SETTLED', rootSessionId: 'root-child' },
              { instanceId: 'inst-leader', templateId: 'leader' },
            ]
          : [
              { instanceId: 'inst-boot-officer', templateId: 'officer', childSessionId: 'boot-session', lifecycle: 'SETTLED', rootSessionId: 'root-a6-router' },
              { instanceId: 'inst-leader', templateId: 'leader' },
            ],
      },
      fixedLeaderOrHumanCategory: () => false,
    })
    await expect(router.route('ctrl-a6-router-1', 'root-child')).resolves.toMatchObject({
      kind: 'recipient',
      target: { kind: 'instance', instanceId: 'inst-child-officer', routeRole: 'officer' },
    })
  })

  it('holds when the child root has no resolvable frozen policy', async () => {
    const router = createAlpha6RootRouter({
      rootSessionId: 'root-a6-router',
      routing,
      leaderTemplateId: 'leader',
      routingForRoot: () => null,
      control: { readControlState: async () => ({ requests: [leg], transfers: [] } as never) },
      members: { list: () => [] },
      fixedLeaderOrHumanCategory: () => false,
    })
    await expect(router.route('ctrl-a6-router-1', 'root-child')).resolves.toMatchObject({
      kind: 'hold',
      holdReason: 'config-invalid',
    })
  })

  it('holds when the only Officer is ARCHIVED', async () => {
    await expect(routerWith('ARCHIVED').route('ctrl-a6-router-1')).resolves.toMatchObject({ kind: 'hold' })
  })
})
