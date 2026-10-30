/**
 * Alpha.6 PR3′ (Lane 2) — the closed vocabularies of the single-flight review-wake scheduler.
 *
 * WHY THIS PACKAGE EXISTS AT ALL. Today a Member that needs a decision posts a control request, and
 * the plugin notifies the reviewer by enqueueing a `next-turn` message per request. One hundred
 * requests are one hundred model turns in a target that could have read all hundred cases in its first
 * turn. This package is the thing that turns "one hundred requests" into "one wake, then re-read".
 *
 * THE ONE LAW THAT HOLDS THIS PACKAGE TOGETHER (Alpha.6 goal 7, and PR #319 §8 SF-1…SF-4): a wake slot
 * is SCHEDULING state and nothing else. It is not an approval, not a case, not a decision, not a
 * permission. Nothing here may ever be read as evidence that a case exists or that anything was
 * decided — the reviewer re-reads the authoritative case list from ControlService/TeamDomain inside its
 * own turn, and the wake text carries a token and a pointer to "query your review work", never an
 * approval payload. The notification is allowed to be lost; the authoritative Case is not.
 *
 * Laws, numbered for the review:
 *  - L-1 SCHEDULING ONLY. No `allow`, no decision value, no mandate, no case payload appears in any
 *    type below. A reviewer reading this file should be able to confirm that by looking, not by trust.
 *  - L-2 SINGLE FLIGHT. At most one non-terminal slot per (rootSessionId, reviewerInstanceId,
 *    sessionGeneration); a request that arrives while one is outstanding merges, it does not deliver.
 *  - L-3 NO WAKE INTO AN EMPTY QUEUE. Reconciling with no ready work releases the slot and emits
 *    nothing. Not "usually not" — nothing.
 *  - L-4 A TURN ENDS ONLY ON A MATCHING `turn/end`. `whenIdle()` is not a completion fact and
 *    `agent/turn-stopping` runs before the durable `turn/end`; neither may advance the machine.
 *  - L-5 STOP IS STICKY. User Stop, Team close and reviewer dispose suspend the slot; no event the
 *    scheduler receives on its own may bring it back. Only an explicit human/Leader `resume` does.
 *  - L-6 NO CLOCK, NO I/O, NO HOST. Time arrives as an injected ISO instant in the context; the
 *    outside world is reached only through event kinds and effect descriptors. This module computes and
 *    refuses; it can touch nothing. Delivery lives in `live/agent-bindings.mjs` and is PR-I2 — a named
 *    Center-Interface PR, not this one.
 */

// --- phases -----------------------------------------------------------------------------------------

/**
 * The slot's lifecycle. `reconciling` is the only phase whose whole purpose is to ask a question of the
 * authoritative side before deciding; `suspended` is the only phase with no automatic exit.
 */
export const WAKE_PHASES = ['idle', 'reserved', 'queued', 'running', 'reconciling', 'backoff', 'suspended'] as const
export type WakePhase = (typeof WAKE_PHASES)[number]

/** Phases in which the slot holds an outstanding ask. L-2 is stated over exactly this set. */
export const WAKE_OUTSTANDING_PHASES: readonly WakePhase[] = ['reserved', 'queued', 'running', 'reconciling', 'backoff']

export function isOutstandingWake(phase: WakePhase): boolean {
  return WAKE_OUTSTANDING_PHASES.includes(phase)
}

// --- events (what the outside world tells the kernel) ------------------------------------------------

export const WAKE_EVENT_KINDS = [
  'request',
  'delivery-accepted',
  'delivery-refused',
  'claimed',
  'turn-ended',
  'work-scan-completed',
  'withdraw-requested',
  'stop',
  'resume',
  'timer-elapsed',
  'recovery-observed',
] as const
export type WakeEventKind = (typeof WAKE_EVENT_KINDS)[number]

/** Why a wake could not be delivered. Closed, because the retry ledger keys off it. */
export const WAKE_DELIVERY_FAILURES = ['send-failed', 'target-unresolvable', 'timeout'] as const
export type WakeDeliveryFailure = (typeof WAKE_DELIVERY_FAILURES)[number]

/** Why a slot was suspended. `no-progress` is the storm stop; the rest are the L-5 set. */
export const WAKE_SUSPEND_REASONS = ['user-stop', 'team-close', 'reviewer-disposed', 'no-progress', 'redeliver-budget'] as const
export type WakeSuspendReason = (typeof WAKE_SUSPEND_REASONS)[number]

/** Where the wake message physically is, as observed on restart (PR #319 §9 recovery rule 2). */
export const WAKE_INBOX_OBSERVATIONS = ['unclaimed', 'claimed', 'absent'] as const
export type WakeInboxObservation = (typeof WAKE_INBOX_OBSERVATIONS)[number]

/**
 * Every event carries these. Two things, and both are load-bearing:
 *  - `key` — the triple this event is ABOUT. The kernel refuses an event whose key differs from the slot
 *    it is applied to (matrix leg 16). It looks redundant, since the adapter already selected the slot by
 *    key, and that is exactly why it is here: `wakeId` is derived *from the triple*, so an event mis-routed
 *    to another slot would carry an id the reducer would happily accept against the wrong reviewer. The
 *    redundancy is the check.
 *  - `leaseEpoch` + `writerToken` — the fencing identity of the writer that saw the event (invariant 6).
 */
export interface WakeEventFence {
  readonly key: WakeSlotKey
  readonly leaseEpoch: number
  readonly writerToken: string
}

export interface WakeRequestEvent extends WakeEventFence {
  readonly kind: 'request'
  /**
   * Fingerprint of the pending review work this request is part of. It is a SCHEDULING hint used only
   * to answer "has anything actually changed since the last turn?" for the no-progress guard — it is
   * never an approval reference and nothing downstream may treat it as one.
   */
  readonly workFingerprint: string
}

export interface WakeDeliveryAcceptedEvent extends WakeEventFence {
  readonly kind: 'delivery-accepted'
  readonly wakeId: string
  readonly messageId: string
}

export interface WakeDeliveryRefusedEvent extends WakeEventFence {
  readonly kind: 'delivery-refused'
  readonly wakeId: string
  readonly failure: WakeDeliveryFailure
}

export interface WakeClaimedEvent extends WakeEventFence {
  readonly kind: 'claimed'
  readonly wakeId: string
  readonly messageId: string
  /** The host turn that consumed the message. Bound to it, per L-4. */
  readonly turn: number
}

export interface WakeTurnEndedEvent extends WakeEventFence {
  readonly kind: 'turn-ended'
  readonly turn: number
  readonly wakeId: string
}

export interface WakeWorkScanCompletedEvent extends WakeEventFence {
  readonly kind: 'work-scan-completed'
  /** The authoritative answer to "is there ready review work?" — read from the case side, not here. */
  readonly hasReadyWork: boolean
  readonly workFingerprint: string | null
}

export interface WakeWithdrawRequestedEvent extends WakeEventFence {
  readonly kind: 'withdraw-requested'
}

export interface WakeStopEvent extends WakeEventFence {
  readonly kind: 'stop'
  readonly reason: WakeSuspendReason
}

export interface WakeResumeEvent extends WakeEventFence {
  readonly kind: 'resume'
}

export interface WakeTimerElapsedEvent extends WakeEventFence {
  readonly kind: 'timer-elapsed'
  /**
   * The deadline the adapter's timer fired for. A timer that fires early is refused rather than
   * honoured: the backoff bound is a law about wake storms, and an eager adapter must not be able to
   * shorten it. The kernel holds no timer of its own (L-6).
   */
  readonly deadlineIso: string
}

export interface WakeRecoveryObservedEvent extends WakeEventFence {
  readonly kind: 'recovery-observed'
  readonly inbox: WakeInboxObservation
  /** Set when the inbox reports the message was claimed: the turn that claimed it. */
  readonly turn: number | null
  /** The message id observed in the inbox, when one is there. Adopted rather than duplicated. */
  readonly messageId: string | null
}

export type WakeEvent =
  | WakeRequestEvent
  | WakeDeliveryAcceptedEvent
  | WakeDeliveryRefusedEvent
  | WakeClaimedEvent
  | WakeTurnEndedEvent
  | WakeWorkScanCompletedEvent
  | WakeWithdrawRequestedEvent
  | WakeStopEvent
  | WakeResumeEvent
  | WakeTimerElapsedEvent
  | WakeRecoveryObservedEvent

// --- effects (what the kernel asks the outside world to do; it never does any of it) ----------------

export const WAKE_EFFECT_KINDS = ['deliver-wake', 'withdraw-wake', 'scan-work', 'observe-turn'] as const
export type WakeEffectKind = (typeof WAKE_EFFECT_KINDS)[number]

export interface WakeDeliverEffect {
  readonly kind: 'deliver-wake'
  readonly wakeId: string
  /**
   * The line the reviewer would be shown, carried as TEXT ONLY and containing nothing but the token and
   * the instruction to query review work. It exists here so the "a wake never carries an approval
   * payload" law (L-1) is testable at the effect boundary rather than asserted about a later layer.
   */
  readonly text: string
}

export interface WakeWithdrawEffect {
  readonly kind: 'withdraw-wake'
  readonly wakeId: string
  /** Exact id, never a bulk clear: an unclaimed message this slot authored and nothing else. */
  readonly messageId: string
}

export interface WakeScanEffect {
  readonly kind: 'scan-work'
  readonly wakeId: string | null
}

export interface WakeObserveTurnEffect {
  readonly kind: 'observe-turn'
  readonly turn: number
  readonly wakeId: string
}

export type WakeEffect = WakeDeliverEffect | WakeWithdrawEffect | WakeScanEffect | WakeObserveTurnEffect

// --- state -------------------------------------------------------------------------------------------

/**
 * The single-flight key. `sessionGeneration` is in the key on purpose: a reviewer Session that was
 * resumed into a NEW generation is a different wake target, and its slot must not inherit the old
 * generation's outstanding ask (or its suppression).
 */
export interface WakeSlotKey {
  readonly rootSessionId: string
  readonly reviewerInstanceId: string
  readonly sessionGeneration: number
}

export interface WakeSlot {
  readonly key: WakeSlotKey
  readonly phase: WakePhase
  /** Optimistic-concurrency counter. The CAS in the store is what makes release-vs-arrival safe. */
  readonly revision: number
  readonly leaseEpoch: number
  readonly writerToken: string
  /** Monotone within a slot; feeds the deterministic `wakeId`. Never a random value. */
  readonly wakeSequence: number
  readonly wakeId: string | null
  readonly messageId: string | null
  readonly claimedTurn: number | null
  /** New work arrived after the outstanding wake was composed (SF-3: merge, do not deliver). */
  readonly dirty: boolean
  /** Turns that ended with the pending work unchanged. The wake-storm bound (L: no progress, no storm). */
  readonly noProgressCycles: number
  /** Bounded re-delivery count for this slot; the crash-window budget. Exhaustion is a SUSPENSION with
   * reason `redeliver-budget`, not a refusal: the events that discover it are legitimate, so the answer
   * is a state the operator can see, not an error the adapter has to interpret. */
  readonly redeliveries: number
  readonly lastWorkFingerprint: string | null
  /** Backoff floor. A `timer-elapsed` before it is refused. */
  readonly notBeforeIso: string | null
  readonly suspendReason: WakeSuspendReason | null
  readonly lastEventIso: string
}

// --- refusals ----------------------------------------------------------------------------------------

/**
 * Closed refusal vocabulary. Every rejected transition answers with one of these and changes nothing;
 * there is no exception path out of the reducer, and "we could not tell" is never an implicit accept.
 */
export const WAKE_REFUSALS = [
  'WAKE_EVENT_MALFORMED',
  'WAKE_STALE_LEASE',
  'WAKE_FOREIGN_WRITER',
  'WAKE_NO_SLOT',
  'WAKE_SLOT_SUSPENDED',
  'WAKE_PHASE_UNEXPECTED',
  'WAKE_ID_MISMATCH',
  'WAKE_TURN_MISMATCH',
  'WAKE_FOREIGN_MESSAGE',
  'WAKE_BACKOFF_PENDING',
  'WAKE_TIMESTAMP_INVALID',
  'WAKE_NO_MESSAGE_TO_WITHDRAW',
  'WAKE_KEY_MISMATCH',
  'WAKE_SLOT_MALFORMED',
  'WAKE_SLOT_UNBRANDED',
  'WAKE_CONTEXT_INVALID',
] as const
export type WakeRefusalCode = (typeof WAKE_REFUSALS)[number]

// --- context and result -------------------------------------------------------------------------------

/**
 * Everything the reducer is allowed to know that is not in the slot or the event.
 *
 * `nowIso` is INJECTED (L-6): expiry and backoff arithmetic are then testable at an exact instant, and
 * the kernel cannot drift from the process clock. The limits are configuration the operator owns, so
 * they are passed in rather than baked in — but they are STRIPPED of nothing: a missing or malformed
 * limit is a refusal, not a default. Defaults would be how a wake storm gets its budget.
 */
export interface WakeContext {
  readonly nowIso: string
  readonly limits: WakeLimits
}

export interface WakeLimits {
  /** Extra deliveries permitted for one slot after the first failure/loss. `0` means never retry. */
  readonly maxRedeliveries: number
  /** Consecutive no-progress cycles tolerated before the slot suspends. `0` means suspend on the first. */
  readonly noProgressLimit: number
  /** Backoff geometry, in whole milliseconds: `min(base * 2^cycles, cap)`. */
  readonly backoff: { readonly baseMs: number; readonly capMs: number }
}

export interface WakeReduceResult {
  /** The slot after this event. On a refusal it is the incoming slot, byte-identical. */
  readonly slot: WakeSlot | null
  readonly effects: readonly WakeEffect[]
  readonly refusal: WakeRefusalCode | null
}
