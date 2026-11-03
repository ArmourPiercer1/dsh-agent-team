import { describe, expect, it } from 'vitest'
import { createLiveWorld } from './t12a-live-bridge.mjs'

const ROOT = 'session-root-a6-pr4-glue'

interface WakeBinding {
  boot(): Promise<void>
  deliverReviewWake(input: {
    rootSessionId: string
    targetSessionId: string
    wakeId: string
    text: string
  }): Promise<void>
}

interface FollowupRecord {
  sessionId: string
  message: {
    content: readonly { type: string; text?: string }[]
    source: { kind: string }
  }
}

describe('A6-PR4 review wake live glue', () => {
  it('delivers one attributed inbox input to the resolved reviewer session', async () => {
    const world = await createLiveWorld({ rootSessionId: ROOT })
    const binding = world.binding as unknown as WakeBinding
    await binding.boot()
    const before = world.records.followups.length
    await binding.deliverReviewWake({
      rootSessionId: ROOT,
      targetSessionId: ROOT,
      wakeId: 'wake-a6-pr4-glue-1',
      text: '[team-review-wake wakeId=wake-a6-pr4-glue-1]\nNew review work is ready.',
    })
    const added = (world.records.followups as FollowupRecord[]).slice(before)
    expect(added).toHaveLength(1)
    expect(added[0]?.sessionId).toBe(ROOT)
    expect(added[0]?.message.content[0]?.text).toContain('[team-review-wake wakeId=wake-a6-pr4-glue-1]')
    expect(added[0]?.message.source).toEqual({ kind: 'plugin:dsh-agent-team' })
  })

  it('rejects malformed wakes before any inbox write', async () => {
    const world = await createLiveWorld({ rootSessionId: ROOT })
    const binding = world.binding as unknown as WakeBinding
    await binding.boot()
    const before = world.records.followups.length
    await expect(binding.deliverReviewWake({
      rootSessionId: ROOT,
      targetSessionId: ROOT,
      wakeId: '',
      text: 'x',
    })).rejects.toThrow('wakeId')
    expect(world.records.followups.length).toBe(before)
  })
})
