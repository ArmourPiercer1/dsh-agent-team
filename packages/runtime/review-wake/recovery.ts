/**
 * Alpha.6 PR3′ (Lane 2) — the restart fold.
 *
 * After a plugin restart the kernel knows two things and believes neither: the slot rows it persisted
 * (which say what it last *asked* for) and the host's inbox facts (which say what is *actually sitting in
 * the reviewer's inbox*). The fold's job is to line those two up and say what should be told to the
 * reducer — and nothing more.
 *
 * The deliberate split, and the reason it is a split: `reconcileWakeSlots` produces **events**, never
 * effects, and it never touches slot state. The reducer is the only thing in this package that decides
 * what a state transition is, and the store's CAS is the only thing that commits one. A fold that computed
 * its own next state would be a second copy of the transition law — the second-ledger mistake in miniature,
 * one review away from the two schedulers disagreeing about what is outstanding. So: the fold decides what
 * to ask, the reducer decides what it means, and one of them can be deleted without hiding the other.
 *
 * What the fold will NOT do, each for a named reason:
 *  - revive a `suspended` slot (invariant 8: Stop is sticky across a restart, not just across a session);
 *  - invent facts for a slot it has no observation for (an unobserved slot is reported, not guessed at —
 *    "we could not tell" must stay visible in the report instead of becoming a quiet transition);
 *  - delete an orphan message it finds in the facts but cannot match to a slot. That is a deletion with a
 *    human's message as the possible other outcome, so it is reported for the adapter to surface and a
 *    human to resolve. PR-I2 owns that path; this fold's silence is the safety property, not a gap;
 *  - act on an unbranded slot (the same brand the reducer demands; hydration is the only front door).
 */

import { isBrandedWakeSlot } from './slot.js'
import type { WakeContext, WakeEvent, WakeInboxObservation, WakeRefusalCode, WakeSlot, WakeSlotKey } from './types.js'

/** One reviewer-visible wake message as the host reports it, tied to the triple that authored it. */
export interface WakeInboxFact {
  readonly key: WakeSlotKey
  readonly inbox: WakeInboxObservation
  readonly messageId: string | null
  readonly turn: number | null
}

export interface WakeReconcileInput {
  readonly slots: readonly WakeSlot[]
  readonly facts: readonly WakeInboxFact[]
  readonly ctx: WakeContext
  readonly fence: { readonly leaseEpoch: number; readonly writerToken: string }
}

/** What the adapter must do for one slot: feed these events, in order, CAS-ing at `expectedRevision`. */
export interface WakeReconcilePlan {
  readonly key: WakeSlotKey
  readonly expectedRevision: number
  readonly events: readonly WakeEvent[]
}

/**
 * Everything the fold declined to act on, named rather than dropped. This report is the reason the fold is
 * auditable: "we restarted and did nothing about four slots" has to be answerable with which four and why.
 */
export interface WakeReconcileReport {
  readonly plans: readonly WakeReconcilePlan[]
  readonly unobserved: readonly WakeSlotKey[]
  readonly suspended: readonly WakeSlotKey[]
  readonly released: readonly WakeSlotKey[]
  readonly orphanFacts: readonly WakeInboxFact[]
  readonly rejected: readonly { readonly key: unknown; readonly refusal: WakeRefusalCode }[]
}

const keyText = (key: WakeSlotKey): string => `${key.rootSessionId}\u0000${key.reviewerInstanceId}\u0000${key.sessionGeneration}`

const plainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

function parseFact(value: unknown): WakeInboxFact | null {
  if (!plainObject(value)) return null
  const key = value.key
  if (!plainObject(key) || typeof key.rootSessionId !== 'string' || typeof key.reviewerInstanceId !== 'string' || typeof key.sessionGeneration !== 'number') {
    return null
  }
  if (value.inbox !== 'unclaimed' && value.inbox !== 'claimed' && value.inbox !== 'absent') return null
  if (value.messageId !== null && typeof value.messageId !== 'string') return null
  if (value.turn !== null && !(typeof value.turn === 'number' && Number.isInteger(value.turn) && value.turn >= 0)) return null
  return {
    key: { rootSessionId: key.rootSessionId, reviewerInstanceId: key.reviewerInstanceId, sessionGeneration: key.sessionGeneration },
    inbox: value.inbox,
    messageId: value.messageId as string | null,
    turn: value.turn as number | null,
  }
}

/**
 * Line the persisted slots up with the observed inbox facts and produce per-slot event plans.
 *
 * Deterministic by construction: slots are ordered by their canonical key text, each contributes at most
 * one `recovery-observed` event, and nothing here reads a clock or a counter. Two restarts over the same
 * rows and the same facts produce byte-identical plans, which is what makes the crash-window table in the
 * design testable instead of merely plausible.
 */
export function reconcileWakeSlots(input: WakeReconcileInput): WakeReconcileReport {
  const plans: WakeReconcilePlan[] = []
  const unobserved: WakeSlotKey[] = []
  const suspended: WakeSlotKey[] = []
  const released: WakeSlotKey[] = []
  const orphanFacts: WakeInboxFact[] = []
  const rejected: { key: unknown; refusal: WakeRefusalCode }[] = []

  if (!plainObject(input)) {
    return { plans, unobserved, suspended, released, orphanFacts, rejected: [{ key: null, refusal: 'WAKE_EVENT_MALFORMED' }] }
  }
  const slots = Array.isArray(input.slots) ? input.slots : []
  const rawFacts = Array.isArray(input.facts) ? input.facts : []
  const fence = input.fence
  if (!plainObject(fence) || typeof fence.writerToken !== 'string' || typeof fence.leaseEpoch !== 'number' || !Number.isInteger(fence.leaseEpoch) || fence.leaseEpoch < 0) {
    return { plans, unobserved, suspended, released, orphanFacts, rejected: [{ key: null, refusal: 'WAKE_CONTEXT_INVALID' }] }
  }

  const factsByKey = new Map<string, WakeInboxFact>()
  for (const raw of rawFacts) {
    const fact = parseFact(raw)
    if (fact === null) {
      rejected.push({ key: plainObject(raw) ? raw.key : raw, refusal: 'WAKE_EVENT_MALFORMED' })
      continue
    }
    // Duplicate facts for one triple are a fact-source bug, not a choice to make: the first in the given
    // order wins and the rest are reported, so the disagreement is visible instead of order-lucky.
    const text = keyText(fact.key)
    if (factsByKey.has(text)) {
      orphanFacts.push(fact)
      continue
    }
    factsByKey.set(text, fact)
  }

  const matched = new Set<string>()
  const ordered = [...slots].sort((a, b) => (keyText(a.key) < keyText(b.key) ? -1 : keyText(a.key) > keyText(b.key) ? 1 : 0))
  for (const slot of ordered) {
    if (!isBrandedWakeSlot(slot)) {
      rejected.push({ key: plainObject(slot) ? slot.key : slot, refusal: 'WAKE_SLOT_UNBRANDED' })
      continue
    }
    const text = keyText(slot.key)
    if (slot.phase === 'suspended') {
      suspended.push(slot.key)
      continue
    }
    if (slot.phase === 'idle') {
      // Nothing outstanding, so there is nothing to reconcile. An inbox message at this point is an
      // orphan by definition and the fact report is where it shows up.
      released.push(slot.key)
      continue
    }
    const fact = factsByKey.get(text)
    if (fact === undefined) {
      unobserved.push(slot.key)
      continue
    }
    matched.add(text)
    plans.push({
      key: slot.key,
      expectedRevision: slot.revision,
      events: [recoveryEvent(slot.key, fact, input.ctx, fence)],
    })
  }

  for (const [text, fact] of factsByKey) {
    if (!matched.has(text)) orphanFacts.push(fact)
  }

  return Object.freeze({
    plans: Object.freeze(plans),
    unobserved: Object.freeze(unobserved),
    suspended: Object.freeze(suspended),
    released: Object.freeze(released),
    orphanFacts: Object.freeze(orphanFacts),
    rejected: Object.freeze(rejected),
  })
}

function recoveryEvent(
  key: WakeSlotKey,
  fact: WakeInboxFact,
  ctx: WakeContext,
  fence: { readonly leaseEpoch: number; readonly writerToken: string },
): WakeEvent {
  // `ctx` is taken so the fold's output carries the same injected instant the reducer will be run at; the
  // event itself carries no timestamp, because the slot's `lastEventIso` is written by the reducer from
  // the context and two clocks in one record is two chances to disagree.
  void ctx
  return { kind: 'recovery-observed', key, leaseEpoch: fence.leaseEpoch, writerToken: fence.writerToken, inbox: fact.inbox, turn: fact.turn, messageId: fact.messageId }
}
