/**
 * Alpha.6 PR3′ (Lane 2) — the wake slot's transition function.
 *
 * One pure function, `reduceWakeSlot(previous, event, context)`, plus the only two things allowed to put a
 * slot into existence: `createWakeSlot` and `hydrateWakeSlot`. Everything the outside world may say comes
 * in as a `WakeEvent`; everything the kernel may ask for goes out as an effect descriptor. No clock, no
 * I/O, no host, no promise, no random value (L-6).
 *
 * ## The slot brand, which this lane already knows it needs
 *
 * PR0's first review found that a hand-built `ReviewPlan` walked straight past its parser's law. The same
 * attack is worse here: a `withdraw-wake` effect carries an exact `messageId` that an adapter will DELETE,
 * and it is built from fields of the slot. A fabricated slot carrying a fabricated `messageId` would be a
 * plugin deleting a message it never authored. So a slot is trustworthy only if this module made it —
 * `BRANDED_SLOTS`, a `WeakSet` keyed on object identity, handed out only by `createWakeSlot` and
 * `hydrateWakeSlot` (which validates every field and mints a frozen copy rather than trusting the caller's
 * object). `reduceWakeSlot` refuses an unbranded `previous`. The store adapter's entire job is
 * `hydrateWakeSlot(row)` in and `compareAndSwap(next)` out; there is no way around validation, exactly as
 * PR-I1 has no way around `parseReviewPlan`.
 *
 * ## Refusal, never exception
 *
 * Every rejected transition answers with a code from the closed `WakeRefusalCode` list and returns the
 * incoming slot **by reference**, unchanged. Container presence is checked before any read that could
 * throw, including the destructures that would themselves throw — the precise lesson PR0's round-2 review
 * recorded, applied here on day one rather than relearned. What that does NOT promise, at the precision
 * the code holds: any event whose containers exist and whose fields are plain values always gets a code. A
 * getter that throws on a field this module must read cannot be defended against by any code anywhere, so
 * hostile containers are a caller obligation — and the caller is `hydrateWakeSlot`, which reads fields one
 * at a time off a storage row, or a host fact read inside the team lock.
 */

import { composeWakeText, deriveWakeId } from './identity.js'
import {
  WAKE_DELIVERY_FAILURES,
  WAKE_EVENT_KINDS,
  WAKE_INBOX_OBSERVATIONS,
  WAKE_PHASES,
  WAKE_SUSPEND_REASONS,
  type WakeContext,
  type WakeEffect,
  type WakeEvent,
  type WakeReduceResult,
  type WakeRefusalCode,
  type WakeSlot,
  type WakeSlotKey,
  type WakeSuspendReason,
} from './types.js'

const NO_EFFECTS: readonly WakeEffect[] = Object.freeze([])

// --- field predicates ---------------------------------------------------------------------------------

const plainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const wholeNumber = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0
const isoInstant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const optionalNonEmpty = (value: unknown): boolean => value === null || value === undefined || nonEmpty(value)
const optionalWhole = (value: unknown): boolean => value === null || value === undefined || wholeNumber(value)
const optionalIso = (value: unknown): boolean => value === null || value === undefined || isoInstant(value)
const inList = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value)

function parseKey(value: unknown): WakeSlotKey | null {
  if (!plainObject(value)) return null
  if (!nonEmpty(value.rootSessionId) || !nonEmpty(value.reviewerInstanceId) || !wholeNumber(value.sessionGeneration)) return null
  return { rootSessionId: value.rootSessionId, reviewerInstanceId: value.reviewerInstanceId, sessionGeneration: value.sessionGeneration }
}

function sameKey(a: WakeSlotKey, b: WakeSlotKey): boolean {
  return a.rootSessionId === b.rootSessionId
    && a.reviewerInstanceId === b.reviewerInstanceId
    && a.sessionGeneration === b.sessionGeneration
}

// --- slot minting and hydration ------------------------------------------------------------------------

const BRANDED_SLOTS = new WeakSet<object>()

/** True only for a slot this module produced. Exported for tests and for an adapter's own paranoia. */
export function isBrandedWakeSlot(slot: WakeSlot): boolean {
  return BRANDED_SLOTS.has(slot)
}

/** The only way a slot object comes into being: build, deep-freeze, brand. Never called with raw input. */
function mint(fields: Omit<WakeSlot, 'key'> & { key: WakeSlotKey }): WakeSlot {
  const slot: WakeSlot = Object.freeze({ ...fields, key: Object.freeze({ ...fields.key }) })
  BRANDED_SLOTS.add(slot)
  return slot
}

/**
 * A brand-new slot, `idle`, having never asked for anything.
 *
 * Note what this does NOT do: it does not reserve a wake. Reservation is a transition like any other and
 * goes through the reducer, so "at most one outstanding wake per triple" has exactly one place it could be
 * broken and exactly one place a test has to aim.
 */
export function createWakeSlot(
  key: WakeSlotKey,
  ctx: WakeContext,
  fence: { readonly leaseEpoch: number; readonly writerToken: string },
): WakeSlot {
  return mint({
    key,
    phase: 'idle',
    revision: 0,
    leaseEpoch: fence.leaseEpoch,
    writerToken: fence.writerToken,
    wakeSequence: 0,
    wakeId: null,
    messageId: null,
    claimedTurn: null,
    dirty: false,
    noProgressCycles: 0,
    redeliveries: 0,
    lastWorkFingerprint: null,
    notBeforeIso: null,
    suspendReason: null,
    lastEventIso: ctx.nowIso,
  })
}

/**
 * Rebuild a slot from a storage row, or refuse it. The adapter's only entry point, and deliberately not
 * permissive: an unknown phase, a non-integer revision, an empty `wakeId`, a `claimedTurn` that arrived as
 * a string — all refused, none of them producing a branded object. A corrupt row must not become a slot,
 * because a slot is what a deletion is authorised against. The result is never the caller's object but a
 * frozen copy, so a row the caller can still mutate cannot later change what the kernel believes.
 */
export function hydrateWakeSlot(raw: unknown): { readonly ok: true; readonly slot: WakeSlot } | { readonly ok: false; readonly refusal: WakeRefusalCode } {
  if (!plainObject(raw)) return { ok: false, refusal: 'WAKE_SLOT_MALFORMED' }
  const key = parseKey(raw.key)
  if (key === null) return { ok: false, refusal: 'WAKE_SLOT_MALFORMED' }
  if (!inList(WAKE_PHASES, raw.phase)) return { ok: false, refusal: 'WAKE_SLOT_MALFORMED' }
  if (!wholeNumber(raw.revision) || !wholeNumber(raw.leaseEpoch) || !nonEmpty(raw.writerToken)) return { ok: false, refusal: 'WAKE_SLOT_MALFORMED' }
  if (!wholeNumber(raw.wakeSequence) || !wholeNumber(raw.noProgressCycles) || !wholeNumber(raw.redeliveries)) return { ok: false, refusal: 'WAKE_SLOT_MALFORMED' }
  if (!optionalNonEmpty(raw.wakeId) || !optionalNonEmpty(raw.messageId) || !optionalWhole(raw.claimedTurn)) return { ok: false, refusal: 'WAKE_SLOT_MALFORMED' }
  // Identity consistency, at the front door and nowhere else. A stored row is the kernel's only memory of
  // which wake it has outstanding, and every correlator (`turn-ended`, `delivery-refused`, a re-delivery)
  // matches on `wakeId`. A row whose id is not the digest of its own (key, wakeSequence) is therefore not a
  // slightly odd row: it is a slot that will re-deliver, or refuse, a wake token belonging to a DIFFERENT
  // triple — a reviewer instance being notified with another reviewer's pointer. The lane's law is that a
  // wake id is derived and never carried, so hydration recomputes it and rejects the row that disagrees.
  // (`wakeId === null` is legitimate: no flight is outstanding, and `wakeSequence` may be non-zero because
  // the counter never rewinds.)
  if (raw.wakeId !== null && raw.wakeId !== undefined && raw.wakeId !== deriveWakeId({ ...key, wakeSequence: raw.wakeSequence as number })) {
    return { ok: false, refusal: 'WAKE_SLOT_MALFORMED' }
  }
  if (typeof raw.dirty !== 'boolean') return { ok: false, refusal: 'WAKE_SLOT_MALFORMED' }
  if (!optionalIso(raw.notBeforeIso) || !optionalIso(raw.lastEventIso)) return { ok: false, refusal: 'WAKE_SLOT_MALFORMED' }
  if (!optionalNonEmpty(raw.lastWorkFingerprint)) return { ok: false, refusal: 'WAKE_SLOT_MALFORMED' }
  if (raw.suspendReason !== null && raw.suspendReason !== undefined && !inList(WAKE_SUSPEND_REASONS, raw.suspendReason)) {
    return { ok: false, refusal: 'WAKE_SLOT_MALFORMED' }
  }
  return {
    ok: true,
    slot: mint({
      key,
      phase: raw.phase,
      revision: raw.revision,
      leaseEpoch: raw.leaseEpoch,
      writerToken: raw.writerToken,
      wakeSequence: raw.wakeSequence,
      wakeId: (raw.wakeId as string | null | undefined) ?? null,
      messageId: (raw.messageId as string | null | undefined) ?? null,
      claimedTurn: (raw.claimedTurn as number | null | undefined) ?? null,
      dirty: raw.dirty,
      noProgressCycles: raw.noProgressCycles,
      redeliveries: raw.redeliveries,
      lastWorkFingerprint: (raw.lastWorkFingerprint as string | null | undefined) ?? null,
      notBeforeIso: (raw.notBeforeIso as string | null | undefined) ?? null,
      suspendReason: (raw.suspendReason as WakeSuspendReason | null | undefined) ?? null,
      lastEventIso: raw.lastEventIso as string,
    }),
  }
}

// --- context validation -------------------------------------------------------------------------------

/**
 * A malformed limit is a refusal, never a default. This is where a wake storm would be born: an
 * `maxRedeliveries` of `undefined` quietly becoming "unlimited", or a `noProgressLimit` of `NaN` quietly
 * becoming "never suspend". Both are the exact failure the invariant exists to prevent, so both abort the
 * call instead of being tolerated into a number.
 */
function contextProblem(ctx: unknown): WakeRefusalCode | null {
  if (!plainObject(ctx)) return 'WAKE_CONTEXT_INVALID'
  if (!isoInstant(ctx.nowIso)) return 'WAKE_TIMESTAMP_INVALID'
  const limits = ctx.limits
  if (!plainObject(limits)) return 'WAKE_CONTEXT_INVALID'
  if (!wholeNumber(limits.maxRedeliveries) || !wholeNumber(limits.noProgressLimit)) return 'WAKE_CONTEXT_INVALID'
  const backoff = limits.backoff
  if (!plainObject(backoff)) return 'WAKE_CONTEXT_INVALID'
  if (!wholeNumber(backoff.baseMs) || !wholeNumber(backoff.capMs)) return 'WAKE_CONTEXT_INVALID'
  if (backoff.capMs < backoff.baseMs) return 'WAKE_CONTEXT_INVALID'
  return null
}

// --- result helpers ------------------------------------------------------------------------------------

function refused(previous: WakeSlot | null, code: WakeRefusalCode): WakeReduceResult {
  return Object.freeze({ slot: previous, effects: NO_EFFECTS, refusal: code })
}

function accepted(next: WakeSlot, effects: readonly WakeEffect[] = NO_EFFECTS): WakeReduceResult {
  return Object.freeze({ slot: next, effects: effects.length === 0 ? NO_EFFECTS : Object.freeze([...effects]), refusal: null })
}

/**
 * The one place `revision` advances, so "every accepted transition moves the CAS counter and only that
 * does" is a property of the code rather than of discipline. A takeover that changes nothing else still
 * advances it: re-binding a writer is a state change that the next writer must see.
 */
function step(previous: WakeSlot, ctx: WakeContext, patch: Partial<Omit<WakeSlot, 'key' | 'revision'>>): WakeSlot {
  return mint({
    key: previous.key,
    phase: patch.phase ?? previous.phase,
    revision: previous.revision + 1,
    leaseEpoch: patch.leaseEpoch ?? previous.leaseEpoch,
    writerToken: patch.writerToken ?? previous.writerToken,
    wakeSequence: patch.wakeSequence ?? previous.wakeSequence,
    wakeId: patch.wakeId !== undefined ? patch.wakeId : previous.wakeId,
    messageId: patch.messageId !== undefined ? patch.messageId : previous.messageId,
    claimedTurn: patch.claimedTurn !== undefined ? patch.claimedTurn : previous.claimedTurn,
    dirty: patch.dirty ?? previous.dirty,
    noProgressCycles: patch.noProgressCycles ?? previous.noProgressCycles,
    redeliveries: patch.redeliveries ?? previous.redeliveries,
    lastWorkFingerprint: patch.lastWorkFingerprint !== undefined ? patch.lastWorkFingerprint : previous.lastWorkFingerprint,
    notBeforeIso: patch.notBeforeIso !== undefined ? patch.notBeforeIso : previous.notBeforeIso,
    suspendReason: patch.suspendReason !== undefined ? patch.suspendReason : previous.suspendReason,
    lastEventIso: ctx.nowIso,
  })
}

/** Deliver the outstanding wake, or reserve a fresh one if the slot has no identity to deliver. */
function deliverOrReserve(slot: WakeSlot, ctx: WakeContext, patch: Partial<Omit<WakeSlot, 'key' | 'revision'>> = {}): WakeReduceResult {
  if (slot.wakeId === null) return reserveNext(slot, ctx, patch)
  return accepted(step(slot, ctx, { phase: 'reserved', notBeforeIso: null, ...patch }), deliver(slot))
}

function deliver(slot: WakeSlot): readonly WakeEffect[] {
  // The id exists by construction: every transition into `reserved` sets one in the same step. If that
  // ever stops being true this throws in a unit test rather than emitting a wake with no identity.
  const wakeId = slot.wakeId
  if (wakeId === null) throw new Error('review-wake invariant violated: reserved slot without a wake id')
  return [{ kind: 'deliver-wake', wakeId, text: composeWakeText(wakeId) }]
}

/**
 * The floor for the n-th retry or non-progress cycle: `min(base * 2^(n-1), cap)` after the injected
 * instant, so the FIRST wait is `base` and the growth is what an operator would predict. The shift is
 * clamped so a slot that has been failing for a very long time cannot overflow into a negative deadline —
 * a negative floor would mean "wake immediately, forever", which is the storm this function exists to stop.
 */
function backoffFloorIso(ctx: WakeContext, attempt: number): string {
  const { baseMs, capMs } = ctx.limits.backoff
  const ms = Math.min(baseMs * 2 ** Math.min(Math.max(attempt, 1) - 1, 30), capMs)
  return new Date(Date.parse(ctx.nowIso) + ms).toISOString()
}

/** One budget rule for both places a delivery may be retried, so "capped" cannot mean two things. */
function budgetExhausted(used: number, limit: number): boolean {
  return used + 1 > limit
}

/** Reserve the next wake of this slot: the only place `wakeSequence` moves forward. */
function reserveNext(slot: WakeSlot, ctx: WakeContext, extra: Partial<Omit<WakeSlot, 'key' | 'revision'>> = {}): WakeReduceResult {
  const wakeSequence = slot.wakeSequence + 1
  const next = step(slot, ctx, {
    phase: 'reserved',
    wakeSequence,
    wakeId: deriveWakeId({ ...slot.key, wakeSequence }),
    messageId: null,
    claimedTurn: null,
    dirty: false,
    notBeforeIso: null,
    ...extra,
  })
  return accepted(next, deliver(next))
}

// --- the reducer ---------------------------------------------------------------------------------------

/**
 * The transition function. `previous` is the slot as the store last knew it, or `null` for a triple never
 * seen. The slot that comes back is what the adapter must CAS in at `expectedRevision`; if that CAS loses,
 * this entire result is thrown away and the event is re-run against the winning state — which is why the
 * reducer keeps no state of its own to get out of step.
 */
export function reduceWakeSlot(previous: WakeSlot | null, event: WakeEvent, ctx: WakeContext): WakeReduceResult {
  // Containers before any read that could throw, `event.kind` included. Then the context, because a
  // malformed limit would otherwise be applied to an otherwise-valid event.
  if (!plainObject(event)) return refused(previous, 'WAKE_EVENT_MALFORMED')
  const problem = contextProblem(ctx)
  if (problem !== null) return refused(previous, problem)
  if (!wholeNumber(event.leaseEpoch) || !nonEmpty(event.writerToken)) return refused(previous, 'WAKE_EVENT_MALFORMED')
  if (!inList(WAKE_EVENT_KINDS, event.kind)) return refused(previous, 'WAKE_EVENT_MALFORMED')
  const key = parseKey(event.key)
  if (key === null) return refused(previous, 'WAKE_EVENT_MALFORMED')

  const leaseEpoch = event.leaseEpoch
  const writerToken = event.writerToken

  if (previous !== null) {
    if (!isBrandedWakeSlot(previous)) return refused(previous, 'WAKE_SLOT_UNBRANDED')
    // Mis-routing check, before the fence: an event about another triple must never be applied, and it
    // must not be applied even if its fence is perfectly valid.
    if (!sameKey(previous.key, key)) return refused(previous, 'WAKE_KEY_MISMATCH')
    // Fencing (invariant 6): a writer this one superseded changes nothing, and a different writer at the
    // SAME epoch is not this writer either. A higher epoch takes the slot over — that is what a restart
    // looks like from inside the kernel.
    if (leaseEpoch < previous.leaseEpoch) return refused(previous, 'WAKE_STALE_LEASE')
    if (leaseEpoch === previous.leaseEpoch && writerToken !== previous.writerToken) return refused(previous, 'WAKE_FOREIGN_WRITER')
  }

  // An event carrying a newer epoch re-binds the writer as it is applied, so every later branch reasons
  // about a slot that already names the writer who is speaking. The re-bind is itself a state change, so a
  // takeover event advances `revision` twice (re-bind, then transition). That is deliberate and harmless:
  // the CAS contract is on the revision the adapter LOADED, not on the size of the step, and minting a
  // branded slot is the only way to record the new fence — an unbranded in-place copy would be exactly the
  // forgery leg 15 refuses. What matters, and what the legs pin, is that revision is monotone and that a
  // stale or foreign writer can never move it.
  const taken = previous !== null && leaseEpoch > previous.leaseEpoch
    ? step(previous, ctx, { leaseEpoch, writerToken })
    : previous

  // Stop is accepted everywhere, and is idempotent: a second Stop keeps the first cause, because the
  // reason a slot stopped is the reason it stopped.
  if (event.kind === 'stop') {
    if (!inList(WAKE_SUSPEND_REASONS, event.reason)) return refused(previous, 'WAKE_EVENT_MALFORMED')
    if (taken === null) {
      // Nothing to suspend. Accepted, because the ask was "make sure this cannot wake", and it cannot.
      return Object.freeze({ slot: null, effects: NO_EFFECTS, refusal: null })
    }
    if (taken.phase === 'suspended') return accepted(taken)
    // Stop removes an UNCLAIMED notification so a stopped Agent cannot be woken by a message still sitting
    // in its inbox (A6-SF-10). Once claimed, the message is consumed history: deleting it would erase what
    // the reviewer already read, and the turn that read it is not the scheduler's business.
    const withdrawable = taken.phase === 'queued' && taken.messageId !== null && taken.wakeId !== null
    const next = step(taken, ctx, {
      phase: 'suspended',
      suspendReason: event.reason,
      messageId: withdrawable ? null : taken.messageId,
    })
    return accepted(next, withdrawable ? [{ kind: 'withdraw-wake', wakeId: taken.wakeId as string, messageId: taken.messageId as string }] : NO_EFFECTS)
  }

  if (taken === null) {
    // Only a first request may create a slot. Anything else about a triple the kernel has never seen means
    // the adapter is confused, and inventing state to satisfy it would be the worse answer.
    if (event.kind !== 'request') return refused(previous, 'WAKE_NO_SLOT')
    if (!nonEmpty(event.workFingerprint)) return refused(previous, 'WAKE_EVENT_MALFORMED')
    const blank = createWakeSlot(key, ctx, { leaseEpoch, writerToken })
    return reserveNext(blank, ctx, { lastWorkFingerprint: event.workFingerprint })
  }

  // Sticky suspension (invariant 8): nothing the scheduler receives on its own revives a suspended slot.
  if (taken.phase === 'suspended') {
    if (event.kind !== 'resume') return refused(previous, 'WAKE_SLOT_SUSPENDED')
    // `resume` is a human/Leader act, and even it delivers no wake. It re-reads; only an authoritative
    // "there is ready work" answer may lead to a wake. That is how stop-stickiness survives the one event
    // allowed to leave the phase at all.
    const resumed = step(taken, ctx, {
      phase: 'reconciling',
      suspendReason: null,
      noProgressCycles: 0,
      redeliveries: 0,
      wakeId: null,
      messageId: null,
      claimedTurn: null,
      dirty: false,
    })
    return accepted(resumed, [{ kind: 'scan-work', wakeId: null }])
  }

  const live = taken

  switch (event.kind) {
    case 'request': {
      if (!nonEmpty(event.workFingerprint)) return refused(previous, 'WAKE_EVENT_MALFORMED')
      if (live.phase === 'idle') {
        // Idle plus work means the flight may start. This is also the re-arm path for the trusted
        // false-negative window named in the design (§4): a slot released because a scan said "nothing
        // ready" is rearmed by the next request, so that hole costs latency and never costs the flight.
        return reserveNext(live, ctx, { lastWorkFingerprint: event.workFingerprint, noProgressCycles: 0 })
      }
      // SF-1 / SF-3: an outstanding slot absorbs the request. A hundred requests against one live slot
      // produce zero additional wake effects, because a wake is never "about request a" — it says "go
      // re-read your work", and the reviewer's single turn sees all a hundred.
      return accepted(step(live, ctx, { dirty: true }))
    }

    case 'delivery-accepted': {
      const { wakeId, messageId } = event
      if (!nonEmpty(wakeId) || !nonEmpty(messageId)) return refused(previous, 'WAKE_EVENT_MALFORMED')
      if (wakeId !== live.wakeId) return refused(previous, 'WAKE_ID_MISMATCH')
      if (live.phase === 'queued' || live.phase === 'running' || live.phase === 'reconciling' || live.phase === 'backoff') {
        // A replayed acceptance for the message already in hand is a retry, not an event. Accepted
        // silently and unchanged: recovery replays this legitimately, and refusing it there would bury the
        // refusals worth logging.
        if (live.messageId === messageId) return accepted(live)
        return refused(previous, 'WAKE_FOREIGN_MESSAGE')
      }
      if (live.phase !== 'reserved') return refused(previous, 'WAKE_PHASE_UNEXPECTED')
      return accepted(step(live, ctx, { phase: 'queued', messageId }))
    }

    case 'delivery-refused': {
      const { wakeId, failure } = event
      if (!nonEmpty(wakeId) || !inList(WAKE_DELIVERY_FAILURES, failure)) return refused(previous, 'WAKE_EVENT_MALFORMED')
      if (live.phase !== 'reserved') return refused(previous, 'WAKE_PHASE_UNEXPECTED')
      if (wakeId !== live.wakeId) return refused(previous, 'WAKE_ID_MISMATCH')
      if (budgetExhausted(live.redeliveries, ctx.limits.maxRedeliveries)) {
        // Bounded by state, not by an operator noticing. The wake stays suspended until a human resumes
        // it; a reviewer that cannot be notified is a liveness problem, not a licence to hammer the host.
        return accepted(step(live, ctx, { phase: 'suspended', suspendReason: 'redeliver-budget' }))
      }
      const redeliveries = live.redeliveries + 1
      return accepted(step(live, ctx, { phase: 'backoff', redeliveries, notBeforeIso: backoffFloorIso(ctx, redeliveries) }))
    }

    case 'claimed': {
      const { wakeId, messageId, turn } = event
      if (!nonEmpty(wakeId) || !nonEmpty(messageId) || !wholeNumber(turn)) return refused(previous, 'WAKE_EVENT_MALFORMED')
      if (wakeId !== live.wakeId) return refused(previous, 'WAKE_ID_MISMATCH')
      if (live.phase === 'running' || live.phase === 'reconciling') {
        if (live.messageId === messageId && live.claimedTurn === turn) return accepted(live)
        return refused(previous, 'WAKE_FOREIGN_MESSAGE')
      }
      if (live.phase !== 'queued') return refused(previous, 'WAKE_PHASE_UNEXPECTED')
      // Acting on a message id this slot never authored is the deletion-adjacent mistake one step earlier.
      // The kernel knows one messageId; anything else is refused, never coerced into "close enough".
      if (live.messageId !== messageId) return refused(previous, 'WAKE_FOREIGN_MESSAGE')
      return accepted(step(live, ctx, { phase: 'running', claimedTurn: turn }), [{ kind: 'observe-turn', turn, wakeId }])
    }

    case 'turn-ended': {
      const { turn, wakeId } = event
      if (!wholeNumber(turn) || !nonEmpty(wakeId)) return refused(previous, 'WAKE_EVENT_MALFORMED')
      if (wakeId !== live.wakeId) return refused(previous, 'WAKE_ID_MISMATCH')
      // L-4, the reason this edge is guarded by a number instead of a feeling: `whenIdle()` and
      // `agent/turn-stopping` are not completion facts, and a turn/end naming a different turn is not the
      // end of THIS wake either.
      if (live.claimedTurn !== turn) return refused(previous, 'WAKE_TURN_MISMATCH')
      if (live.phase === 'reconciling') return accepted(live)
      if (live.phase !== 'running') return refused(previous, 'WAKE_PHASE_UNEXPECTED')
      return accepted(step(live, ctx, { phase: 'reconciling' }), [{ kind: 'scan-work', wakeId }])
    }

    case 'work-scan-completed': {
      const { hasReadyWork, workFingerprint } = event
      if (typeof hasReadyWork !== 'boolean') return refused(previous, 'WAKE_EVENT_MALFORMED')
      if (workFingerprint !== null && !nonEmpty(workFingerprint)) return refused(previous, 'WAKE_EVENT_MALFORMED')
      if (live.phase !== 'reconciling') return refused(previous, 'WAKE_PHASE_UNEXPECTED')
      if (!hasReadyWork) {
        if (live.dirty) {
          // Work was recorded while the scan was in flight, so this "nothing to do" answer describes a
          // world that has already moved on. Releasing here is the lost-wakeup bug in its cleanest form;
          // the answer is discarded and the authoritative side asked again — behind the backoff floor, so a
          // source that flip-flops walks into the no-progress bound instead of spinning.
          const noProgressCycles = live.noProgressCycles + 1
          if (noProgressCycles > ctx.limits.noProgressLimit) {
            return accepted(step(live, ctx, { phase: 'suspended', suspendReason: 'no-progress', noProgressCycles, dirty: false }))
          }
          return accepted(step(live, ctx, { phase: 'backoff', noProgressCycles, notBeforeIso: backoffFloorIso(ctx, noProgressCycles) }))
        }
        // SF-4, absolute: no ready work, no wake. The slot releases and the effect list is empty. (§4
        // names the one thing this cannot distinguish — a successful lie by the port — and leg 14 pins the
        // re-arm that makes it survivable.)
        return accepted(step(live, ctx, {
          phase: 'idle',
          dirty: false,
          noProgressCycles: 0,
          wakeId: null,
          messageId: null,
          claimedTurn: null,
          lastWorkFingerprint: workFingerprint,
        }))
      }
      const progressed = live.dirty || (workFingerprint !== null && workFingerprint !== live.lastWorkFingerprint)
      if (progressed) {
        // Exactly one new wake per completed turn (A6-SF-03), whichever remainder turned up.
        return reserveNext(live, ctx, { lastWorkFingerprint: workFingerprint ?? live.lastWorkFingerprint })
      }
      // Invariant 7: the turn ended and the pending work is the same work. Waking again at once is the
      // storm; the bound is state, not vigilance.
      const noProgressCycles = live.noProgressCycles + 1
      if (noProgressCycles > ctx.limits.noProgressLimit) {
        return accepted(step(live, ctx, { phase: 'suspended', suspendReason: 'no-progress', noProgressCycles, notBeforeIso: null }))
      }
      return accepted(step(live, ctx, { phase: 'backoff', noProgressCycles, notBeforeIso: backoffFloorIso(ctx, noProgressCycles) }))
    }

    case 'withdraw-requested': {
      if (live.phase === 'running' || live.phase === 'reconciling') {
        // Already claimed: there is no effect at all, by design. A stale wake that costs one cheap turn is
        // correct behaviour; a deleted message the reviewer already read is not.
        return refused(previous, 'WAKE_PHASE_UNEXPECTED')
      }
      if (live.phase !== 'queued' || live.messageId === null || live.wakeId === null) {
        return refused(previous, 'WAKE_NO_MESSAGE_TO_WITHDRAW')
      }
      // Exact id, unclaimed only, authored by this slot. Never a bulk clear: a reviewer inbox can hold a
      // human's message, and a scheduler that deletes it is a scheduler with too much authority.
      return accepted(
        step(live, ctx, { phase: 'idle', wakeId: null, messageId: null, claimedTurn: null, dirty: false }),
        [{ kind: 'withdraw-wake', wakeId: live.wakeId, messageId: live.messageId }],
      )
    }

    case 'timer-elapsed': {
      const { deadlineIso } = event
      if (!isoInstant(deadlineIso)) return refused(previous, 'WAKE_EVENT_MALFORMED')
      if (live.phase !== 'backoff') return refused(previous, 'WAKE_PHASE_UNEXPECTED')
      // An eager timer is refused rather than honoured: the backoff floor is a law about wake storms, and
      // an adapter that fires early must not be able to shorten it.
      if (live.notBeforeIso !== null && Date.parse(deadlineIso) < Date.parse(live.notBeforeIso)) {
        return refused(previous, 'WAKE_BACKOFF_PENDING')
      }
      if (live.dirty) {
        // L-3 outranks eagerness: when the backoff was entered because work arrived mid-scan, the
        // authoritative answer is re-read before anything is sent.
        return accepted(step(live, ctx, { phase: 'reconciling', dirty: false }), [{ kind: 'scan-work', wakeId: live.wakeId }])
      }
      if (live.wakeId !== null && live.messageId === null) {
        // A send that never got its acceptance: re-deliver the SAME wakeId. The identity is a function of
        // the reserve cycle, not of the attempt, which is what lets recovery recognise its own ask.
        return deliverOrReserve(live, ctx)
      }
      return reserveNext(live, ctx)
    }

    case 'recovery-observed': {
      const { inbox, turn, messageId } = event
      if (!inList(WAKE_INBOX_OBSERVATIONS, inbox)) return refused(previous, 'WAKE_EVENT_MALFORMED')
      if (turn !== null && !wholeNumber(turn)) return refused(previous, 'WAKE_EVENT_MALFORMED')
      if (messageId !== null && !nonEmpty(messageId)) return refused(previous, 'WAKE_EVENT_MALFORMED')
      if (live.phase === 'idle') return accepted(live)
      if (inbox === 'unclaimed') {
        if (messageId === null) return refused(previous, 'WAKE_EVENT_MALFORMED')
        // `messageId === null` is the crash window this branch exists for: the send was accepted by the
        // host but the acceptance callback never reached the checkpoint, so the slot knows it asked and
        // does not know what the host wrote. The observation supplies the id; it is adopted, not resent.
        if (live.messageId !== null && live.messageId !== messageId) {
          // Two physical messages for one logical wake, or a message that is not ours. The kernel refuses
          // to pick a winner; the recovery fold reports it and a human or the next cycle resolves it.
          return refused(previous, 'WAKE_FOREIGN_MESSAGE')
        }
        // The checkpoint exists but the acceptance callback did not: adopt the observed message rather
        // than send a second one. This branch is what keeps a restart from doubling notifications.
        if (live.phase === 'reserved') return accepted(step(live, ctx, { phase: 'queued', messageId }))
        return accepted(live)
      }
      if (inbox === 'claimed') {
        if (turn === null) return refused(previous, 'WAKE_EVENT_MALFORMED')
        if (live.claimedTurn === turn) return accepted(live)
        if (live.phase === 'running' || live.phase === 'reconciling') return refused(previous, 'WAKE_TURN_MISMATCH')
        if (live.wakeId === null) return refused(previous, 'WAKE_ID_MISMATCH')
        return accepted(step(live, ctx, { phase: 'running', claimedTurn: turn }), [{ kind: 'observe-turn', turn, wakeId: live.wakeId }])
      }
      // inbox === 'absent'
      if (live.phase === 'running' || live.phase === 'reconciling') {
        // The message is gone and a turn was in flight. Absence does not prove completion: the turn may
        // still be running, and guessing that it finished is how a wake gets re-sent into a live review.
        // The no-progress bound, not a guess, is what eventually releases this slot.
        return live.phase === 'reconciling'
          ? accepted(step(live, ctx, {}), [{ kind: 'scan-work', wakeId: live.wakeId }])
          : accepted(live)
      }
      if (budgetExhausted(live.redeliveries, ctx.limits.maxRedeliveries)) {
        return accepted(step(live, ctx, { phase: 'suspended', suspendReason: 'redeliver-budget' }))
      }
      // Bounded re-delivery for a wake PROVEN absent from the inbox facts — the only place the kernel
      // re-sends, and never after a claim (invariant 5).
      return deliverOrReserve(live, ctx, { redeliveries: live.redeliveries + 1 })
    }

    case 'resume': {
      // Leaving `suspended` is handled above; a resume anywhere else is an idempotent no-op the adapter may
      // retry safely.
      return accepted(live)
    }

    default: {
      return refused(previous, 'WAKE_EVENT_MALFORMED')
    }
  }
}
