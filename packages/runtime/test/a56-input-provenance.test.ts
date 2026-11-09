/**
 * a56-input-provenance.test.ts — A56-SEMANTICS: the ONE place the A5 Goal
 * authority question and the A6 Sticky Stop question are answered together.
 *
 * THE CONFLICT (measured, PR #691 gate 2). Upstream `tool-goal/src/authority.ts`
 * (@ `639ed01539`) authorizes `create_goal` only for the exact live calling
 * agent inside its active driver, on a runtime ROOT, whose OPEN TURN contains a
 * `user/message` session event with `data.source.kind === 'user'`
 * (`hasDirectHumanInput`). A Team Member is a top-level agent
 * (`agents.roots()` = "created without an owning agent context"), so the source
 * kind of the delivery that started its turn is what decides whether a governed
 * Member may own a goal.
 *
 * Alpha.6 moved every Team delivery to `plugin:dsh-agent-team` so a machine
 * relay could not clear a human Sticky Stop (`agent/inbox/claimed` with
 * `source.kind === 'user'` is the ONLY resume trigger). Measured on the
 * integration base: a Member's `create_goal` was refused
 * `GOAL_TOOL_AUTHORITY_REQUIRED` with 0 rounds. Keeping `user` on that path
 * again would re-open the Sticky Stop hole (a Leader/model delegation would
 * clear a human Stop).
 *
 * THE RESOLUTION (a): the two properties are separated, not traded.
 *   - WORK delivery keeps the human attribution (so A5 goal authority is
 *     intact) and is registered in the machine-input ledger;
 *   - machine relays / notifications / wakes carry the producer-owned machine
 *     kind (so they can neither authorize a goal nor resume a stop);
 *   - the Sticky Stop resume arbour does not ask "is the kind `user`?" any
 *     more — it asks the PRODUCER (this ledger + the durable `[team-...]`
 *     envelopes) whether the claim was a Team delivery.
 *
 * These legs pin each half, so a future merge cannot silently pick one side
 * again: the merge that dropped this surface produced exactly these failures.
 */
import { describe, expect, it } from 'vitest'
import { createLiveWorld } from './t12a-live-bridge.mjs'
import {
  TEAM_MACHINE_ENVELOPES,
  TEAM_PRODUCER_SOURCE,
  createMachineInputLedger,
  isHumanInteractionClaim,
  isTeamMachineInput,
  isTeamMachineText,
} from '../src/plugin/live/input-provenance.mjs'

const ROOT = 'session-a56-provenance-root'

interface FollowupRecord {
  sessionId: string
  message: {
    id?: string
    content: readonly { type: string; text?: string }[]
    source: { kind: string }
  }
}

interface ProvenanceBinding {
  boot(): Promise<void>
  createRootAgent(sessionId: string): Promise<void>
  childSessionIdFor(rootSessionId: string, instanceId: string): string
  isTeamMachineInput(sessionId: string, message: unknown): boolean
  workDelivery: {
    deliver(args: {
      rootSessionId: string
      instanceId: string
      childSessionId: string
      requestToken: string
      prompt: string
    }): Promise<unknown>
  }
  sessionInput: {
    submitAttributedInput(input: {
      sessionId: string
      text: string
      attribution: { kind: string; fromHumanId?: string; fromInstanceId?: string }
    }): Promise<void>
  }
  deliverRootWork(input: { rootSessionId: string; requestToken: string; prompt: string }): Promise<void>
  deliverRootControlNotification(input: { rootSessionId: string; requestId: string; text: string }): Promise<void>
}

async function world(): Promise<{ binding: ProvenanceBinding; records: { followups: FollowupRecord[] } }> {
  const live = await createLiveWorld({ rootSessionId: ROOT })
  const binding = live.binding as unknown as ProvenanceBinding
  await binding.boot()
  await binding.createRootAgent(ROOT)
  return { binding, records: live.records as unknown as { followups: FollowupRecord[] } }
}

// ── the pure law ────────────────────────────────────────────────────────────

describe('A56 law: the machine envelopes are the frozen wire contract', () => {
  it('every producer envelope is classified machine, at the head only', () => {
    expect(TEAM_MACHINE_ENVELOPES).toEqual(['[team-work requestToken=', '[team-root-work requestToken='])
    // ONLY the human-attributed deliveries are envelope-classified (the others
    // carry the producer machine kind). See the module doc for why.
    const samples: Record<string, string> = {
      '[team-work requestToken=': '[team-work requestToken=tok-1] do the work',
      '[team-root-work requestToken=': '[team-root-work requestToken=tok-2] start',
    }
    for (const [prefix, text] of Object.entries(samples)) {
      expect(TEAM_MACHINE_ENVELOPES).toContain(prefix)
      expect(isTeamMachineText(text)).toBe(true)
    }
    // A human message is not an envelope, and neither is a quotation mid-body:
    // the model-visible convention is TOKEN-LEADING, so only the head decides.
    expect(isTeamMachineText('please continue with the review')).toBe(false)
    expect(isTeamMachineText('I saw "[team-work requestToken=x] yesterday"')).toBe(false)
    expect(isTeamMachineText('')).toBe(false)
    expect(isTeamMachineText(undefined)).toBe(false)
  })

  it('the producer kind is the plugin-owned v4 kind, never the retired generic wrapper', () => {
    expect(TEAM_PRODUCER_SOURCE).toEqual({ kind: 'plugin:dsh-agent-team' })
  })
})

describe('A56 law: a claim is human only when it is NOT a Team delivery', () => {
  it('non-user source kinds are machine by construction', () => {
    expect(isTeamMachineInput({ source: { kind: 'plugin:dsh-agent-team' }, content: [] })).toBe(true)
    expect(isTeamMachineInput({ source: { kind: 'goal' }, content: [] })).toBe(true)
    expect(isTeamMachineInput(undefined)).toBe(true)
  })

  it('the human attribution alone is NOT enough: the envelope wins', () => {
    const workTurn = {
      source: { kind: 'user' },
      content: [{ type: 'text', text: '[team-work requestToken=tok-9] implement it' }],
    }
    // A5 goal authority reads the source kind; the Sticky Stop arbour must not
    // read the same turn as a human interaction. Both are true of this message.
    expect(workTurn.source.kind).toBe('user')
    expect(isTeamMachineInput(workTurn)).toBe(true)
    expect(isHumanInteractionClaim(workTurn)).toBe(false)
  })

  it('a plain human turn is the one clearable claim', () => {
    const human = { source: { kind: 'user' }, content: [{ type: 'text', text: 'go on then' }] }
    expect(isTeamMachineInput(human)).toBe(false)
    expect(isHumanInteractionClaim(human)).toBe(true)
  })

  it('the delivery ledger classifies a message whose text shape the law does not know', () => {
    // The handoff context text is token-leading by a caller-supplied token, so
    // it carries no `[team-...]` envelope; the LEDGER is what keeps it machine.
    const ledger = createMachineInputLedger(4)
    const opaque = { id: 'msg-1', source: { kind: 'user' }, content: [{ type: 'text', text: 'ctx-abc handoff' }] }
    expect(isHumanInteractionClaim(opaque, ledger, 'session-a')).toBe(true)
    ledger.note('session-a', opaque)
    expect(isHumanInteractionClaim(opaque, ledger, 'session-a')).toBe(false)
    // Scoped per session: the same message id under another session is not a hit.
    expect(isHumanInteractionClaim(opaque, ledger, 'session-b')).toBe(true)
    // Bounded: the oldest entry is evicted rather than grown without limit.
    for (let i = 0; i < 10; i += 1) ledger.note('session-a', { id: `bulk-${String(i)}` })
    expect(ledger.size()).toBeLessThanOrEqual(4)
  })
})

// ── the glue's producers ────────────────────────────────────────────────────

describe('A56 glue: work delivery keeps A5 goal authority and is machine for the Stop', () => {
  it('the delegation message carries source.kind user (upstream authority) AND is machine-classified', async () => {
    const { binding, records } = await world()
    // Drive the delivery onto the ROOT session (the live one this world made):
    // the message SHAPE is what this leg pins, and `workDelivery` is the single
    // producer for both the root and the member path.
    const child = ROOT
    const before = records.followups.length
    await binding.workDelivery.deliver({
      rootSessionId: ROOT,
      instanceId: 'inst-a56-worker',
      childSessionId: child,
      requestToken: 'tok-a56-work',
      prompt: 'build the thing',
    }).catch(() => undefined) // the read-back needs a scripted turn; the DELIVERY is what this leg pins
    const added = records.followups.slice(before)
    expect(added).toHaveLength(1)
    const message = added[0]!.message
    // (1) A5 property: exactly the attribution upstream `hasDirectHumanInput` reads.
    expect(message.source).toEqual({ kind: 'user' })
    expect(message.content[0]?.text).toContain('[team-work requestToken=tok-a56-work]')
    // (2) A6 property: the producer still tells the truth about its origin, so a
    // human Sticky Stop is not cleared by a machine delegation.
    expect(binding.isTeamMachineInput(added[0]!.sessionId, message)).toBe(true)
  })

  it('root work keeps the human attribution; the control notification does not', async () => {
    const { binding, records } = await world()
    const before = records.followups.length
    await binding.deliverRootWork({
      rootSessionId: ROOT,
      requestToken: 'tok-a56-root',
      prompt: 'start the team',
    }).catch(() => undefined)
    await binding.deliverRootControlNotification({
      rootSessionId: ROOT,
      requestId: 'req-a56-1',
      text: '[team-control requestId=req-a56-1] an approval is pending',
    }).catch(() => undefined)
    const added = records.followups.slice(before)
    expect(added.length).toBeGreaterThanOrEqual(2)
    const work = added[0]!.message
    const notification = added[1]!.message
    // Root WORK: goal authority is read from this turn's source kind.
    expect(work.source).toEqual({ kind: 'user' })
    expect(binding.isTeamMachineInput(added[0]!.sessionId, work)).toBe(true)
    // NOTIFICATION: not work input at all — machine kind, never a human claim.
    expect(notification.source).toEqual({ kind: 'plugin:dsh-agent-team' })
    expect(binding.isTeamMachineInput(added[1]!.sessionId, notification)).toBe(true)
  })

  it('a human-sent relay stays human; a model/Leader relay is machine', async () => {
    const { binding, records } = await world()
    const before = records.followups.length
    await binding.sessionInput.submitAttributedInput({
      sessionId: ROOT,
      text: '[team-relay] from=human:owner to=instance:officer please look',
      attribution: { kind: 'team-relay', fromHumanId: 'human-owner' },
    })
    await binding.sessionInput.submitAttributedInput({
      sessionId: ROOT,
      text: '[team-relay] from=instance:leader to=instance:officer please look',
      attribution: { kind: 'team-relay', fromInstanceId: 'instance:leader' },
    })
    const added = records.followups.slice(before)
    expect(added).toHaveLength(2)
    // Alpha.6 law preserved: a human `member.send` is a human interaction...
    expect(added[0]!.message.source).toEqual({ kind: 'user' })
    expect(binding.isTeamMachineInput(added[0]!.sessionId, added[0]!.message)).toBe(false)
    // ...and a model relay is not, so it cannot clear a human Stop.
    expect(added[1]!.message.source).toEqual({ kind: 'plugin:dsh-agent-team' })
    expect(binding.isTeamMachineInput(added[1]!.sessionId, added[1]!.message)).toBe(true)
  })
})
