/**
 * Alpha.6 — the recoverable wake-notification lifecycle.
 *
 * The review finding this suite pins:
 *   - Inbox acceptance is QUEUED, never a claimed/started turn;
 *   - a release can emit a fresh `deliver-wake` (new fingerprint) and must
 *     consume it itself, exactly once;
 *   - a queued intent is recovered ONLY when its native Inbox message exists.
 *
 * The four crash windows are exercised with a fake durable intent store and a
 * fake native Inbox:
 *   (a) case committed / no delivery     -> no intent, next plan delivers;
 *   (b) queued intent / no Inbox message -> discarded, next plan delivers;
 *   (c) Inbox accepted / no local mark   -> adopted from Inbox truth;
 *   (d) claimed/running then crash       -> adopted as queued, no duplicate.
 *
 * @module packages/runtime/test/a6-wake-persist.test
 */

import { describe, expect, it } from 'vitest'
import { blueprintReviewPolicyFrom, type ReviewRouteInput } from '../review-router/index.js'
import type { ReviewRouting } from '../../domain/blueprint/src/index.js'
import { planReviewWakes } from '../alpha6/wake-plan.js'
import {
  claimReviewWake,
  dispatchReviewWakes,
  planFingerprint,
  reconcileReviewWakes,
  releaseReviewWake,
  reviewWakeKeyFor,
} from '../alpha6/wake-dispatch.js'
import {
  recoverReviewWake,
  type PersistedReviewWakeIntent,
  type ReviewWakeInboxPort,
  type ReviewWakeIntentStore,
  type ReviewWakeQueuedIntent,
} from '../alpha6/wake-intent.js'
import {
  createReviewWakeCoordinator,
  renderReviewWake,
  type ReviewWakeCoordinator,
  type ReviewWakeDeliverEffect,
  type ReviewWakeDeliveryPort,
} from '../review-wake/index.js'

const ROUTING: ReviewRouting = {
  enabled: true,
  officerTemplateId: 'officer',
  ordinaryToolApprovals: { default: 'officer', leaderExceptions: [] },
  whenOfficerUnavailable: 'hold',
}
const POLICY = blueprintReviewPolicyFrom(ROUTING)!
const ROOT = 'session-root-a6-wake-persist'
const GENERATION = 2
const OFFICER = 'session-officer-persist'

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

function input(requestId: string): ReviewRouteInput {
  return {
    policy: POLICY,
    currentLeg: { ...LEG, requestId },
    currentOfficer: { status: 'active', instanceId: OFFICER, templateId: 'officer' },
    leader: { instanceId: 'session-leader-persist', templateId: 'leader' },
    transfer: null,
  }
}

function planFor(...requestIds: string[]) {
  return planReviewWakes(requestIds.map((id) => input(id)), { sessionIdFor: (id: string) => id })
}

function coordinatorFor(plan: ReturnType<typeof planFor>): ReviewWakeCoordinator {
  return createReviewWakeCoordinator(
    reviewWakeKeyFor(plan.wakes[0]!, ROOT, GENERATION),
  )
}

/** Derive the deterministic identity of the plan's one wake, no delivery. */
function identityFor(plan: ReturnType<typeof planFor>): {
  readonly key: ReturnType<typeof reviewWakeKeyFor>
  readonly fingerprint: string
  readonly wakeId: string
} {
  const wake = plan.wakes[0]!
  const fingerprint = planFingerprint(wake)
  const scratch = createReviewWakeCoordinator(
    reviewWakeKeyFor(wake, ROOT, GENERATION),
  )
  const scanned = scratch.dispatch({
    type: 'scan-result',
    work: { kind: 'ready', fingerprint },
  })
  if (scanned.outcome !== 'applied') throw new Error('scratch scan refused')
  const effect = scanned.effects.find(
    (candidate): candidate is ReviewWakeDeliverEffect =>
      candidate.kind === 'deliver-wake',
  )
  if (effect === undefined) throw new Error('scratch scan emitted no wake')
  return { key: scratch.state.key, fingerprint, wakeId: effect.wakeId }
}

/** A fake DURABLE store: one row per latch key, async API like disk. */
class FakeIntentStore implements ReviewWakeIntentStore {
  readonly rows = new Map<string, PersistedReviewWakeIntent>()
  persistCalls = 0
  acceptedCalls = 0
  clearCalls = 0

  private static keyOf(key: ReviewWakeQueuedIntent['key']): string {
    return `${key.rootSessionId}\u001f${key.reviewerInstanceId}\u001f${String(key.sessionGeneration)}`
  }

  async persistQueued(intent: ReviewWakeQueuedIntent): Promise<void> {
    this.persistCalls += 1
    this.rows.set(FakeIntentStore.keyOf(intent.key), {
      ...intent,
      status: 'queued',
    })
  }

  async markAccepted(wakeId: string): Promise<void> {
    this.acceptedCalls += 1
    for (const [key, row] of [...this.rows]) {
      if (row.wakeId === wakeId) this.rows.set(key, { ...row, status: 'accepted' })
    }
  }

  async clear(wakeId?: string): Promise<void> {
    this.clearCalls += 1
    if (wakeId === undefined) {
      this.rows.clear()
      return
    }
    for (const [key, row] of [...this.rows]) {
      if (row.wakeId === wakeId) this.rows.delete(key)
    }
  }

  async read(): Promise<PersistedReviewWakeIntent | null> {
    const first = this.rows.values().next()
    return first.done ? null : first.value
  }

  get size(): number {
    return this.rows.size
  }
}

/** A fake native Inbox: `has`/`remove` are the only truth recovery reads. */
class FakeInbox implements ReviewWakeInboxPort {
  readonly messages = new Map<string, string>()

  has(wakeId: string): boolean {
    return this.messages.has(wakeId)
  }

  remove(wakeId: string): void {
    this.messages.delete(wakeId)
  }

  accept(wakeId: string): void {
    this.messages.set(wakeId, `[team-review-wake wakeId=${wakeId}]`)
  }
}

interface Harness {
  readonly calls: string[]
  readonly deliver: (
    input: Parameters<ReviewWakeDeliveryPort>[0],
    targetSessionId: string,
  ) => Promise<void>
  readonly deliverEffect: (effect: ReviewWakeDeliverEffect) => Promise<void>
}

/** Dispatch delivery + release delivery both land in the fake Inbox. */
function harness(inbox: FakeInbox): Harness {
  const calls: string[] = []
  return {
    calls,
    deliver: async (delivery, _targetSessionId) => {
      calls.push(delivery.wakeId)
      inbox.accept(delivery.wakeId)
    },
    deliverEffect: async (effect) => {
      calls.push(effect.wakeId)
      inbox.accept(effect.wakeId)
    },
  }
}

const EMPTY_PLAN = { wakes: [], humanLegIds: [], held: [] } as const

describe('A6 wake persistence — Inbox acceptance is queued, recovery is Inbox-truthful', () => {
  it('window (a): case committed with no delivery — recovery is idle and the next plan delivers once', async () => {
    const plan = planFor('req-a1', 'req-a2')
    const store = new FakeIntentStore()
    const inbox = new FakeInbox()
    const coordinator = coordinatorFor(plan)

    expect((await recoverReviewWake(coordinator, store, inbox)).adopted).toBe(false)
    expect(coordinator.state.status).toBe('idle')
    await expect(store.read()).resolves.toBeNull()

    const port = harness(inbox)
    let intentWasQueuedBeforeAccept = false
    const result = await dispatchReviewWakes({
      plan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators: [coordinator],
      intent: store,
      inbox,
      deliver: async (delivery, target) => {
        intentWasQueuedBeforeAccept =
          store.rows.size === 1 && (await store.read())?.status === 'queued'
        await port.deliver(delivery, target)
      },
    })

    expect(intentWasQueuedBeforeAccept).toBe(true)
    expect(result.delivered).toHaveLength(1)
    expect(port.calls).toHaveLength(1)
    // Inbox acceptance = QUEUED; no turn was claimed by the dispatcher.
    expect(coordinator.state.status).toBe('queued')
    expect((await store.read())?.status).toBe('accepted')
  })

  it('window (b): queued intent with no Inbox message — recovery discards it and the next plan delivers once', async () => {
    const plan = planFor('req-b1')
    const identity = identityFor(plan)
    const store = new FakeIntentStore()
    const inbox = new FakeInbox()
    const coordinator = coordinatorFor(plan)

    await store.persistQueued({
      key: identity.key,
      wakeId: identity.wakeId,
      workFingerprint: identity.fingerprint,
    })
    expect(inbox.has(identity.wakeId)).toBe(false)

    const recovered = await recoverReviewWake(coordinator, store, inbox)
    expect(recovered.adopted).toBe(false)
    expect(coordinator.state.status).toBe('idle')
    // The undelivered intent is gone, not adopted as a phantom queued wake.
    expect(store.size).toBe(0)

    const port = harness(inbox)
    const result = await dispatchReviewWakes({
      plan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators: [coordinator],
      intent: store,
      inbox,
      deliver: port.deliver,
    })
    expect(result.delivered).toHaveLength(1)
    expect(port.calls).toEqual([identity.wakeId])
    expect(inbox.has(identity.wakeId)).toBe(true)
  })

  it('window (c): Inbox accepted but the local mark was lost — recovery adopts without a second delivery', async () => {
    const plan = planFor('req-c1', 'req-c2')
    const identity = identityFor(plan)
    const store = new FakeIntentStore()
    const inbox = new FakeInbox()
    const coordinator = coordinatorFor(plan)

    // The delivery succeeded (message exists); the process crashed BEFORE
    // markAccepted, so the durable row is still `queued`.
    await store.persistQueued({
      key: identity.key,
      wakeId: identity.wakeId,
      workFingerprint: identity.fingerprint,
    })
    inbox.accept(identity.wakeId)

    const recovered = await recoverReviewWake(coordinator, store, inbox)
    expect(recovered.adopted).toBe(true)
    expect(recovered.wakeId).toBe(identity.wakeId)
    expect(coordinator.state.status).toBe('queued')
    expect(coordinator.state.wakeId).toBe(identity.wakeId)
    // The Inbox truth let recovery repair the missing local mark.
    expect((await store.read())?.status).toBe('accepted')

    const port = harness(inbox)
    const replay = await dispatchReviewWakes({
      plan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators: [coordinator],
      intent: store,
      inbox,
      deliver: port.deliver,
    })
    expect(replay.delivered).toHaveLength(0)
    expect(port.calls).toEqual([])
    expect(inbox.messages.size).toBe(1)
    expect(coordinator.state.status).toBe('queued')
  })

  it('window (d): claimed/running then crash — recovery adopts queued and never re-delivers', async () => {
    const plan = planFor('req-d1', 'req-d2', 'req-d3')
    const identity = identityFor(plan)
    const store = new FakeIntentStore()
    const inbox = new FakeInbox()
    const beforeCrash = coordinatorFor(plan)
    const port = harness(inbox)

    await dispatchReviewWakes({
      plan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators: [beforeCrash],
      intent: store,
      inbox,
      deliver: port.deliver,
      deferTurnEnd: true,
    })
    expect(claimReviewWake(beforeCrash).outcome).toBe('applied')
    expect(beforeCrash.state.status).toBe('running')
    expect(port.calls).toEqual([identity.wakeId])

    // Crash: the running latch is lost, only the durable intent + real Inbox
    // survive.
    const afterCrash = coordinatorFor(plan)
    expect((await recoverReviewWake(afterCrash, store, inbox)).adopted).toBe(true)
    expect(afterCrash.state.status).toBe('queued')
    expect(afterCrash.state.wakeId).toBe(identity.wakeId)

    const replay = await dispatchReviewWakes({
      plan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators: [afterCrash],
      intent: store,
      inbox,
      deliver: port.deliver,
    })
    expect(replay.delivered).toHaveLength(0)
    expect(port.calls).toHaveLength(1)
    expect(inbox.messages.size).toBe(1)
  })

  it('recover does not adopt a queued intent absent from the Inbox', async () => {
    const plan = planFor('req-absent')
    const identity = identityFor(plan)
    const store = new FakeIntentStore()
    const inbox = new FakeInbox()
    const coordinator = coordinatorFor(plan)

    await store.persistQueued({
      key: identity.key,
      wakeId: identity.wakeId,
      workFingerprint: identity.fingerprint,
    })

    const recovered = await recoverReviewWake(coordinator, store, inbox)
    expect(recovered.adopted).toBe(false)
    expect(recovered.wakeId).toBeNull()
    expect(coordinator.state.status).toBe('idle')
    expect(coordinator.state.wakeId).toBeNull()
    expect(store.size).toBe(0)
  })

  it('release with a NEW fingerprint and no extra dispatch call yields exactly one new delivery', async () => {
    const firstPlan = planFor('req-r1')
    const coordinator = coordinatorFor(firstPlan)
    const store = new FakeIntentStore()
    const inbox = new FakeInbox()
    const port = harness(inbox)

    const first = await dispatchReviewWakes({
      plan: firstPlan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators: [coordinator],
      intent: store,
      inbox,
      deliver: port.deliver,
      deferTurnEnd: true,
    })
    expect(first.delivered).toHaveLength(1)
    expect(port.calls).toHaveLength(1)
    expect(claimReviewWake(coordinator).outcome).toBe('applied')

    // NEW work fingerprint, no dispatchReviewWakes call in between: the
    // release itself must drain the deliver-wake effect.
    const movedPlan = planFor('req-r1', 'req-r2', 'req-r3')
    const movedFingerprint = planFingerprint(movedPlan.wakes[0]!)
    const released = await releaseReviewWake(
      coordinator,
      { kind: 'ready', fingerprint: movedFingerprint },
      { deliver: port.deliverEffect, intent: store, inbox },
    )

    expect(released.outcome).toBe('applied')
    expect(released.delivered).toHaveLength(1)
    expect(released.failures).toEqual([])
    expect(port.calls).toHaveLength(2)
    expect(new Set(port.calls).size).toBe(2)
    expect(inbox.messages.size).toBe(2)
    expect(coordinator.state.status).toBe('queued')
    expect(released.wakeId).not.toBe(first.delivered[0]?.wakeId)
    expect((await store.read())?.wakeId).toBe(released.wakeId)
    expect((await store.read())?.workFingerprint).toBe(movedFingerprint)
  })

  it('an EMPTY plan revokes a stale queued wake through no-ready-work and clears its Inbox row', async () => {
    const plan = planFor('req-e1')
    const coordinator = coordinatorFor(plan)
    const store = new FakeIntentStore()
    const inbox = new FakeInbox()
    const port = harness(inbox)

    await dispatchReviewWakes({
      plan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators: [coordinator],
      intent: store,
      inbox,
      deliver: port.deliver,
    })
    expect(coordinator.state.status).toBe('queued')
    expect(inbox.messages.size).toBe(1)
    expect(store.size).toBe(1)

    const revoked = await dispatchReviewWakes({
      plan: EMPTY_PLAN,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators: [coordinator],
      intent: store,
      inbox,
      deliver: port.deliver,
    })

    expect(revoked.revoked).toEqual([OFFICER])
    expect(revoked.revokedWakeIds).toHaveLength(1)
    expect(coordinator.state.status).toBe('idle')
    expect(coordinator.state.wakeId).toBeNull()
    expect(inbox.messages.size).toBe(0)
    expect(store.size).toBe(0)
    // No extra wake was delivered by the reconcile.
    expect(port.calls).toHaveLength(1)
  })

  it('reconcileReviewWakes is exposed as the no-ready-work revocation for absent latches', async () => {
    const plan = planFor('req-x1')
    const coordinator = coordinatorFor(plan)
    const store = new FakeIntentStore()
    const inbox = new FakeInbox()
    const port = harness(inbox)

    await dispatchReviewWakes({
      plan,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators: [coordinator],
      intent: store,
      inbox,
      deliver: port.deliver,
    })

    const reconciled = await reconcileReviewWakes({
      plan: EMPTY_PLAN,
      rootSessionId: ROOT,
      sessionGeneration: GENERATION,
      coordinators: [coordinator],
      intent: store,
      inbox,
    })
    expect(reconciled.revoked).toEqual([OFFICER])
    expect(reconciled.failures).toEqual([])
    expect(coordinator.state.status).toBe('idle')
    expect(inbox.messages.size).toBe(0)
    expect(store.size).toBe(0)
  })

  it('renders the same token-leading text a dispatch would deliver', () => {
    const plan = planFor('req-text')
    const identity = identityFor(plan)
    const text = renderReviewWake({
      kind: 'deliver-wake',
      key: identity.key,
      wakeId: identity.wakeId,
      workFingerprint: identity.fingerprint,
    })
    expect(text.startsWith(`[team-review-wake wakeId=${identity.wakeId}]`)).toBe(true)
  })
})
