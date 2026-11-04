import { describe, expect, it } from 'vitest'
import { createReviewWakeDelivery, renderReviewWake } from '../review-wake/delivery.js'
import type { ReviewWakeDeliverEffect } from '../review-wake/delivery.js'

const effect: ReviewWakeDeliverEffect = {
  kind: 'deliver-wake',
  key: { rootSessionId: 'root-a6-pr4', reviewerInstanceId: 'inst-officer-a6-pr4', sessionGeneration: 2 },
  wakeId: 'wake-a6-pr4-1',
  workFingerprint: 'fp-a6-pr4',
}

describe('A6-PR4 review wake delivery seam', () => {
  it('renders a deterministic token-leading, non-authority hint', () => {
    const text = renderReviewWake(effect)
    expect(text.startsWith('[team-review-wake wakeId=wake-a6-pr4-1]')).toBe(true)
    expect(text).toContain('team_list_pending_control')
    expect(text).toContain('team_resolve_control')
    expect(text).not.toContain('allow')
    expect(renderReviewWake(effect)).toBe(text)
  })

  it('keeps the full wakeId in the token so Inbox identity never truncates', () => {
    const longId = `wake-${'x'.repeat(220)}`
    const text = renderReviewWake({ ...effect, wakeId: longId })
    expect(text).toContain(`wakeId=${longId}]`)
    expect(text).not.toContain('…')
  })

  it('forwards exactly the key, wakeId and rendered text to the port', async () => {
    const seen: unknown[] = []
    const deliver = createReviewWakeDelivery(async (input) => { seen.push(input) })
    await deliver(effect)
    expect(seen).toEqual([{
      key: effect.key,
      wakeId: effect.wakeId,
      text: renderReviewWake(effect),
    }])
  })

  it('propagates a port failure so queued can be released', async () => {
    const deliver = createReviewWakeDelivery(async () => { throw new Error('inbox unavailable') })
    await expect(deliver(effect)).rejects.toThrow('inbox unavailable')
  })

  it('rejects malformed wake effects without calling the port', async () => {
    let called = false
    const deliver = createReviewWakeDelivery(async () => { called = true })
    await expect(deliver({ ...effect, wakeId: '' })).rejects.toThrow('wakeId')
    expect(called).toBe(false)
  })
})
