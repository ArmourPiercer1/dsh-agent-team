import { describe, expect, it, vi } from 'vitest'
import {
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
