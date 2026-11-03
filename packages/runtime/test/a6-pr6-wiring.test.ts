import { describe, expect, it, vi } from 'vitest'
import { controlRequestNotification } from '../alpha6/wiring.js'
import type { ControlRequestRecord } from '../control/types.js'

const BASE = [
  'schemaVersion: 5',
  'blueprintId: team.alpha6.wiring',
  'revision: "1"',
  'leader: { templateId: leader, persona: Lead. }',
  'members:',
  '  - templateId: officer',
  '    persona: Review asks.',
  '  - templateId: worker',
  '    persona: Do work.',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'permissionMutationEnvelope: { rules: [] }',
  'teamHardEnvelope: { rules: [] }',
  'metadata: {}',
  'reviewRouting:',
  '  enabled: true',
  '  officerTemplateId: officer',
  '  ordinaryToolApprovals:',
  '    default: officer',
  '    leaderExceptions: []',
  '  whenOfficerUnavailable: hold',
]
const V5 = `---\n${BASE.join('\n')}\n---\n`
const V4 = V5.replace('schemaVersion: 5', 'schemaVersion: 4').replace(/reviewRouting:[\s\S]*$/, '')

const request = {
  requestId: 'req-wiring-1',
  rootSessionId: 'root-wiring',
  kind: 'leader-approval',
  requester: { kind: 'instance', instanceId: 'worker-1' },
  subject: { kind: 'instance', instanceId: 'worker-1' },
  targetInstanceId: 'worker-1',
  toolName: 'team_delegate',
  summary: 'write ./out',
  status: 'pending',
  createdAt: 1,
} as unknown as ControlRequestRecord

const config = {
  alpha6ReviewRouting: true,
  blueprintSource: V5,
  rootSessionId: 'root-wiring',
  seedMembers: [
    { templateId: 'leader', childSessionId: 'root-wiring' },
    { templateId: 'officer', childSessionId: 'session-officer' },
    { templateId: 'worker', childSessionId: 'session-worker' },
  ],
} as const

describe('A6-PR6 root wiring', () => {
  it('wakes the unique Officer session and never the Leader', async () => {
    const leader = vi.fn(async () => {})
    const wake = vi.fn(async () => {})
    const { requestNotification } = controlRequestNotification(config, {
      deliverRootControlNotification: leader,
      deliverReviewWake: wake,
    })
    await requestNotification!.notifyLeaderRequest(request)
    expect(leader).not.toHaveBeenCalled()
    expect(wake).toHaveBeenCalledWith({
      rootSessionId: 'root-wiring',
      targetSessionId: 'session-officer',
      wakeId: 'review:req-wiring-1',
      text: expect.stringContaining('[team-review-wake requestId=req-wiring-1]'),
    })
  })

  it('legacy only when disabled or no wake seam; enabled-but-invalid is refused', async () => {
    for (const c of [{ ...config, alpha6ReviewRouting: false }]) {
      const leader = vi.fn(async () => {})
      const wake = vi.fn(async () => {})
      const { requestNotification } = controlRequestNotification(c, {
        deliverRootControlNotification: leader,
        deliverReviewWake: wake,
      })
      await requestNotification!.notifyLeaderRequest(request)
      expect(leader).toHaveBeenCalledTimes(1)
      expect(wake).not.toHaveBeenCalled()
    }
    for (const c of [
      { ...config, blueprintSource: V4 },
      { ...config, seedMembers: [...config.seedMembers, { templateId: 'officer', childSessionId: 'session-officer-2' }] },
    ]) {
      const leader = vi.fn(async () => {})
      const { requestNotification } = controlRequestNotification(c, {
        deliverRootControlNotification: leader,
        deliverReviewWake: vi.fn(async () => {}),
      })
      await expect(requestNotification!.notifyLeaderRequest(request)).rejects.toThrow('no Leader fallback')
      expect(leader).not.toHaveBeenCalled()
    }
    // Explicit opt-in without the wake seam is refused, never legacy.
    const leader = vi.fn(async () => {})
    const missingSeam = controlRequestNotification(config, {
      deliverRootControlNotification: leader,
    })
    await expect(missingSeam.requestNotification!.notifyLeaderRequest(request)).rejects.toThrow('no Leader fallback')
    expect(leader).not.toHaveBeenCalled()
  })
})
