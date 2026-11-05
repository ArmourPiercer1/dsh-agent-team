/**
 * Alpha.6 root router — a real idle Officer is SETTLED (or CREATED before its
 * first turn), not RUNNING. Requiring RUNNING made every real idle Officer
 * invisible and held every ordinary ask, so this pins the live-state set at
 * the router's own boundary.
 */
import { describe, expect, it } from 'vitest'
import { createAlpha6RootRouter } from '../alpha6/root-router.js'
import type { ReviewRouting } from '../../domain/blueprint/src/index.js'

const ROUTING: ReviewRouting = {
  enabled: true,
  officerTemplateId: 'officer',
  ordinaryToolApprovals: { default: 'officer', leaderExceptions: [] },
  whenOfficerUnavailable: 'hold',
}

const row = {
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

describe('A6 root router — idle Officer liveness', () => {
  for (const lifecycle of ['CREATED', 'RUNNING', 'SETTLED'] as const) {
    it(`routes to a ${lifecycle} Officer`, async () => {
      const router = createAlpha6RootRouter({
        rootSessionId: 'root-a6-router',
        routing: ROUTING,
        leaderTemplateId: 'leader',
        control: {
          readControlState: async () => ({ requests: [row], transfers: [] } as never),
        },
        members: {
          list: () => [
            { instanceId: 'inst-officer', templateId: 'officer', childSessionId: 'session-child', lifecycle, rootSessionId: 'root-a6-router' },
            { instanceId: 'inst-leader', templateId: 'leader' },
          ],
        },
        fixedLeaderOrHumanCategory: () => false,
      })
      await expect(router.route('ctrl-a6-router-1', 'root-a6-router')).resolves.toMatchObject({
        kind: 'recipient',
        target: { kind: 'instance', instanceId: 'inst-officer', routeRole: 'officer' },
      })
    })
  }

  it('holds when the only Officer is ARCHIVED', async () => {
    const router = createAlpha6RootRouter({
      rootSessionId: 'root-a6-router',
      routing: ROUTING,
      leaderTemplateId: 'leader',
      control: { readControlState: async () => ({ requests: [row], transfers: [] } as never) },
      members: {
        list: () => [
          { instanceId: 'inst-officer', templateId: 'officer', childSessionId: 'session-child', lifecycle: 'ARCHIVED', rootSessionId: 'root-a6-router' },
          { instanceId: 'inst-leader', templateId: 'leader' },
        ],
      },
      fixedLeaderOrHumanCategory: () => false,
    })
    const route = await router.route('ctrl-a6-router-1')
    expect(route).toMatchObject({ kind: 'hold' })
  })
})
