import { describe, expect, it } from 'vitest'
import { createLiveWorld } from './t12a-live-bridge.mjs'

const ROOT = 'session-root-a6-pr4-glue'
const OFFICER = 'inst-a6pr4officer'
const OFFICER_SESSION = 'session-child-a6-pr4-officer'

interface WakeBinding {
  boot(): Promise<void>
  deliverReviewWake(input: {
    rootSessionId: string
    targetSessionId: string
    wakeId: string
    text: string
    recipientInstanceId?: string
    requestId?: string
  }): Promise<void>
}

interface FollowupRecord {
  sessionId: string
  message: {
    content: readonly { type: string; text?: string }[]
    source: { kind: string }
  }
}

/**
 * ROUND 84: the wake is a GOVERNED DELIVERY now, so the world carries the two things the delivery
 * requires and previously did not — a durable Member row binding the reviewer's child session (the
 * recipient identity is never invented) and the Alpha.6 opt-in (the A56 machine attribution). The
 * assertions are unchanged in kind: one attributed inbox input, to the RESOLVED reviewer session,
 * carrying the token-leading hint.
 */
function wakeWorld() {
  return createLiveWorld({
    rootSessionId: ROOT,
    members: [{ instanceId: OFFICER, templateId: 'tpl-t12a', childSessionId: OFFICER_SESSION }],
    configOverrides: { alpha6ReviewRouting: true },
    // The Officer's child session is a DURABLE member session (that is what a real boot has); the
    // delivery port resumes it instead of inventing a live agent.
    persistence: { exists: (sid: string) => sid === OFFICER_SESSION },
  })
}

describe('A6-PR4 review wake live glue', () => {
  it('delivers one attributed inbox input to the resolved reviewer session', async () => {
    const world = await wakeWorld()
    const binding = world.binding as unknown as WakeBinding
    await binding.boot()
    const before = world.records.followups.length
    await binding.deliverReviewWake({
      rootSessionId: ROOT,
      targetSessionId: OFFICER_SESSION,
      wakeId: 'wake-a6-pr4-glue-1',
      text: '[team-review-wake wakeId=wake-a6-pr4-glue-1]\nNew review work is ready.',
      recipientInstanceId: OFFICER,
      requestId: 'ctrl-a6-pr4-glue-1',
    })
    const added = (world.records.followups as FollowupRecord[]).slice(before)
    expect(added).toHaveLength(1)
    expect(added[0]?.sessionId).toBe(OFFICER_SESSION)
    expect(added[0]?.message.content[0]?.text).toContain('[team-review-wake wakeId=wake-a6-pr4-glue-1]')
    // A56: a review wake is a MACHINE input — under the opt-in it carries the producer attribution,
    // so it can never clear a human Sticky Stop.
    expect(added[0]?.message.source).toEqual({ kind: 'plugin:dsh-agent-team' })
  })

  it('records the delivery as the same durable intent + confirmation pair round 83 uses for member.send', async () => {
    const world = await wakeWorld()
    const binding = world.binding as unknown as WakeBinding
    await binding.boot()
    await binding.deliverReviewWake({
      rootSessionId: ROOT,
      targetSessionId: OFFICER_SESSION,
      wakeId: 'wake-a6-pr4-glue-2',
      text: '[team-review-wake wakeId=wake-a6-pr4-glue-2]\nNew review work is ready.',
      // No recipientInstanceId: the glue resolves it from the durable Member row bound to the
      // session, and refuses rather than inventing one.
      requestId: 'ctrl-a6-pr4-glue-2',
    })
    const facts = world.domain.repositories.ledger.list().filter(
      (entry) =>
        entry.factType === 'team-review-wake-routed' || entry.factType === 'team-review-wake-delivered',
    )
    expect(facts.map((entry) => entry.factType)).toEqual([
      'team-review-wake-routed',
      'team-review-wake-delivered',
    ])
    const intent = facts[0] as { payload: Record<string, unknown> }
    const confirmation = facts[1] as { payload: Record<string, unknown> }
    expect(intent.payload['recipientInstanceId']).toBe(OFFICER)
    expect(intent.payload['deliveredToSessionId']).toBe(OFFICER_SESSION)
    expect(intent.payload['requestToken']).toBe('wake-a6-pr4-glue-2')
    expect(confirmation.payload['factSequence']).toBe((facts[0] as { sequence: number }).sequence)
  })

  it('rejects malformed wakes before any inbox write', async () => {
    const world = await wakeWorld()
    const binding = world.binding as unknown as WakeBinding
    await binding.boot()
    const before = world.records.followups.length
    const factsBefore = world.domain.repositories.ledger.list().length
    await expect(binding.deliverReviewWake({
      rootSessionId: ROOT,
      targetSessionId: OFFICER_SESSION,
      wakeId: '',
      text: 'x',
    })).rejects.toThrow('wakeId')
    expect(world.records.followups.length).toBe(before)
    expect(world.domain.repositories.ledger.list().length).toBe(factsBefore)
  })

  it('refuses a wake whose session is not a bound Member of this team, writing nothing', async () => {
    const world = await wakeWorld()
    const binding = world.binding as unknown as WakeBinding
    await binding.boot()
    const before = world.records.followups.length
    const factsBefore = world.domain.repositories.ledger.list().length
    await expect(binding.deliverReviewWake({
      rootSessionId: ROOT,
      targetSessionId: 'session-nowhere',
      wakeId: 'wake-a6-pr4-glue-3',
      text: '[team-review-wake wakeId=wake-a6-pr4-glue-3]\nx',
    })).rejects.toThrow(/invented recipient/u)
    expect(world.records.followups.length).toBe(before)
    expect(world.domain.repositories.ledger.list().length).toBe(factsBefore)
  })
})
