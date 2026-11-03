/**
 * Alpha.6 PR3 — the pure Review Wake coordinator.
 *
 * ## Laws implemented here (blueprint §3.4; execution plan A6-PR3)
 *
 * 1. **Single flight.** One latch per `(rootSessionId, reviewerInstanceId,
 *    sessionGeneration)`. While `queued` or `running`, an activation only
 *    sets `dirty`; it never enqueues a second wake. Three activations still
 *    produce at most one `deliver-wake`.
 * 2. **One post-turn re-read.** `turn-end` emits exactly one `rescan`
 *    (unless Stop is active). The following `scan-result` decides: ready
 *    work whose fingerprint MOVED yields at most one fresh wake; the same
 *    fingerprint yields none.
 * 3. **Pending ≠ changed.** `{ kind: 'ready' }` with the observed
 *    fingerprint is pending-but-unchanged; it never withdraws the valid
 *    wake. Only `{ kind: 'no-ready-work' }` may release/withdraw it.
 * 4. **No-progress guard.** The observed fingerprint is the baseline: a
 *    repeated scan of the same ready work never re-wakes, so a poll loop
 *    cannot spin model turns. There is no counter and no timer.
 * 5. **Recovery.** A persisted wake fact is ADOPTED (`status`, `wakeId`,
 *    baseline); it is never re-delivered. No fact starts `idle`. A fact from
 *    another generation/key is refused.
 * 6. **Delivery failure.** A failed queued delivery releases `queued` to
 *    `idle` and resets the baseline, so a LATER activation may retry. The
 *    coordinator never retries by itself.
 * 7. **Sticky Stop.** `stop` suspends the latch (withdrawing an unclaimed
 *    queued wake); activations/polls/scans cannot revive it. Only an
 *    explicit `resume` does.
 *
 * The coordinator performs no I/O, imports no `node:*` module, reads no
 * clock and schedules no timer. Inputs are data/events; outputs are effect
 * descriptors (`rescan`, `deliver-wake`, `withdraw-wake`) for the caller.
 *
 * @module @dsh-agent-team/runtime/review-wake/coordinator
 */

import { ReviewWakeInputError } from './errors.js'
import {
  REVIEW_WAKE_ACTIVATION_REASONS,
  REVIEW_WAKE_EVENT_TYPES,
  REVIEW_WAKE_SCAN_KINDS,
  REVIEW_WAKE_STATUSES,
} from './types.js'
import type {
  PersistedReviewWakeFact,
  ReviewWakeActivationReason,
  ReviewWakeCoordinator,
  ReviewWakeEffect,
  ReviewWakeEvent,
  ReviewWakeKey,
  ReviewWakeRefusalCode,
  ReviewWakeRescanReason,
  ReviewWakeState,
  ReviewWakeTransition,
  ReviewWakeWithdrawReason,
  ReviewWorkScan,
} from './types.js'

const NO_EFFECTS: readonly ReviewWakeEffect[] = Object.freeze([])

/** No session/generation token is empty or carries a control character. */
function isToken(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) return false
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 0x20 || code === 0x7f) return false
  }
  return true
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isKey(value: unknown): value is ReviewWakeKey {
  if (!isRecord(value)) return false
  return (
    isToken(value.rootSessionId) &&
    isToken(value.reviewerInstanceId) &&
    typeof value.sessionGeneration === 'number' &&
    Number.isSafeInteger(value.sessionGeneration) &&
    value.sessionGeneration >= 0
  )
}

function sameKey(a: ReviewWakeKey, b: ReviewWakeKey): boolean {
  return (
    a.rootSessionId === b.rootSessionId &&
    a.reviewerInstanceId === b.reviewerInstanceId &&
    a.sessionGeneration === b.sessionGeneration
  )
}

/**
 * Deterministic, payload-free wake identity. The same pending work observed
 * by the same recipient generation maps to the same id, so a caller can use
 * it as an Inbox remove/replace key; changed work gets a new id.
 */
function deriveWakeId(key: ReviewWakeKey, fingerprint: string): string {
  return [
    'review-wake',
    encodeURIComponent(key.rootSessionId),
    encodeURIComponent(key.reviewerInstanceId),
    String(key.sessionGeneration),
    encodeURIComponent(fingerprint),
  ].join(':')
}

function rescan(
  state: ReviewWakeState,
  reason: ReviewWakeRescanReason,
): ReviewWakeEffect {
  return { kind: 'rescan', key: state.key, reason }
}

function applied(
  state: ReviewWakeState,
  effects: readonly ReviewWakeEffect[] = NO_EFFECTS,
): ReviewWakeTransition {
  return { outcome: 'applied', state, effects }
}

function refused(
  code: ReviewWakeRefusalCode,
  state: ReviewWakeState,
): ReviewWakeTransition {
  return { outcome: 'refused', code, state }
}

/**
 * Build the initial idle latch for one single-flight identity.
 *
 * @throws ReviewWakeInputError when `key` is structurally invalid.
 */
export function createReviewWakeState(key: ReviewWakeKey): ReviewWakeState {
  if (!isKey(key)) {
    throw new ReviewWakeInputError(
      'review wake key requires non-empty rootSessionId/reviewerInstanceId and a non-negative safe integer sessionGeneration',
    )
  }
  return {
    key: Object.freeze({
      rootSessionId: key.rootSessionId,
      reviewerInstanceId: key.reviewerInstanceId,
      sessionGeneration: key.sessionGeneration,
    }),
    status: 'idle',
    dirty: false,
    stopped: false,
    observedWorkFingerprint: null,
    wakeId: null,
  }
}

type EventValidation =
  | { readonly ok: true; readonly event: ReviewWakeEvent }
  | { readonly ok: false; readonly code: ReviewWakeRefusalCode }

function validateScan(work: unknown): EventValidation {
  if (!isRecord(work)) return { ok: false, code: 'invalid-scan' }
  if (
    typeof work.kind !== 'string' ||
    !(REVIEW_WAKE_SCAN_KINDS as readonly string[]).includes(work.kind)
  ) {
    return { ok: false, code: 'invalid-scan' }
  }
  if (work.kind === 'ready' && !isToken(work.fingerprint)) {
    return { ok: false, code: 'invalid-scan' }
  }
  return {
    ok: true,
    event: { type: 'scan-result', work: work as ReviewWorkScan },
  }
}

/**
 * Structural validation of one input event. Malformed input is REFUSED
 * (`invalid-event` / `invalid-scan`), never coerced.
 */
function validateEvent(event: unknown): EventValidation {
  if (!isRecord(event)) return { ok: false, code: 'invalid-event' }
  if (
    typeof event.type !== 'string' ||
    !(REVIEW_WAKE_EVENT_TYPES as readonly string[]).includes(event.type)
  ) {
    return { ok: false, code: 'invalid-event' }
  }

  switch (event.type) {
    case 'activate': {
      if (
        typeof event.reason !== 'string' ||
        !(REVIEW_WAKE_ACTIVATION_REASONS as readonly string[]).includes(
          event.reason,
        )
      ) {
        return { ok: false, code: 'invalid-event' }
      }
      return {
        ok: true,
        event: {
          type: 'activate',
          reason: event.reason as ReviewWakeActivationReason,
        },
      }
    }
    case 'scan-result':
      return validateScan(event.work)
    case 'delivery-failed': {
      if (event.wakeId !== undefined && !isToken(event.wakeId)) {
        return { ok: false, code: 'invalid-event' }
      }
      return {
        ok: true,
        event:
          event.wakeId === undefined
            ? { type: 'delivery-failed' }
            : { type: 'delivery-failed', wakeId: event.wakeId },
      }
    }
    case 'recover': {
      if (event.stopped !== undefined && typeof event.stopped !== 'boolean') {
        return { ok: false, code: 'invalid-event' }
      }
      const persistedWake = event.persistedWake
      if (persistedWake !== undefined && persistedWake !== null) {
        if (!isRecord(persistedWake)) {
          return { ok: false, code: 'invalid-persisted-wake' }
        }
        if (
          !isKey(persistedWake.key) ||
          (persistedWake.status !== 'queued' &&
            persistedWake.status !== 'running') ||
          !isToken(persistedWake.wakeId) ||
          !isToken(persistedWake.workFingerprint)
        ) {
          return { ok: false, code: 'invalid-persisted-wake' }
        }
      }
      return {
        ok: true,
        event: {
          type: 'recover',
          persistedWake:
            (persistedWake as PersistedReviewWakeFact | null | undefined) ??
            null,
          stopped: event.stopped === true,
        },
      }
    }
    case 'poll':
    case 'turn-start':
    case 'turn-end':
    case 'stop':
    case 'resume':
      return { ok: true, event: { type: event.type } }
    default:
      // Unreachable: the closed set above is exhaustive.
      return { ok: false, code: 'invalid-event' }
  }
}

/** The authoritative re-read handler (pending vs changed kept distinct). */
function onScan(
  state: ReviewWakeState,
  work: ReviewWorkScan,
): ReviewWakeTransition {
  if (work.kind === 'no-ready-work') {
    if (state.status === 'queued' && state.wakeId !== null) {
      // Only an authoritative "nothing ready" may withdraw an unclaimed
      // generic wake. A running/claimed turn cannot be cancelled this way.
      return applied(
        {
          ...state,
          status: 'idle',
          wakeId: null,
          observedWorkFingerprint: null,
          dirty: false,
        },
        [
          {
            kind: 'withdraw-wake',
            key: state.key,
            wakeId: state.wakeId,
            reason: 'no-ready-work' satisfies ReviewWakeWithdrawReason,
          },
        ],
      )
    }
    return applied({
      ...state,
      observedWorkFingerprint: null,
      dirty: false,
    })
  }

  const fingerprint = work.fingerprint
  switch (state.status) {
    case 'queued':
      // The single queued wake is generic: it survives a work change and the
      // turn re-reads authority itself. Updating the baseline lets the
      // post-turn scan suppress work the turn already saw.
      return applied({
        ...state,
        observedWorkFingerprint: fingerprint,
        dirty: false,
      })
    case 'running':
      // A run in flight is never turned into a second wake. A changed
      // fingerprint is remembered as dirty; DO NOT move the baseline, so the
      // predictable post-turn scan still sees the change.
      return fingerprint === state.observedWorkFingerprint
        ? applied(state)
        : applied({ ...state, dirty: true })
    case 'idle':
      if (fingerprint === state.observedWorkFingerprint) {
        // Pending but unchanged: no progress, no wake (bounded suppression).
        return applied({ ...state, dirty: false })
      }
      return applied(
        {
          ...state,
          status: 'queued',
          wakeId: deriveWakeId(state.key, fingerprint),
          observedWorkFingerprint: fingerprint,
          dirty: false,
        },
        [
          {
            kind: 'deliver-wake',
            key: state.key,
            wakeId: deriveWakeId(state.key, fingerprint),
            workFingerprint: fingerprint,
          },
        ],
      )
  }
}

/**
 * Reduce one event over the latch. Deterministic and side-effect free: the
 * input state is never mutated, refusals return it byte-for-byte, and every
 * desired action is an effect descriptor.
 */
export function reduceReviewWake(
  state: ReviewWakeState,
  event: ReviewWakeEvent,
): ReviewWakeTransition {
  // A hand-built/corrupted latch is refused before it can drive a transition;
  // in particular an out-of-vocabulary phase (the rejected seven-phase names)
  // can never re-enter through this entry point.
  if (!isKey(state.key) || !isReviewWakeStatus(state.status)) {
    return refused('invalid-event', state)
  }
  const validated = validateEvent(event)
  if (!validated.ok) return refused(validated.code, state)
  const input = validated.event

  switch (input.type) {
    case 'activate': {
      if (state.stopped) return applied(state)
      if (state.status === 'idle') {
        return applied(state, [rescan(state, 'activation')])
      }
      return applied({ ...state, dirty: true })
    }

    case 'poll': {
      if (state.stopped) return applied(state)
      if (state.status === 'running') return applied({ ...state, dirty: true })
      return applied(state, [rescan(state, 'poll')])
    }

    case 'scan-result': {
      if (state.stopped) return applied(state)
      return onScan(state, input.work)
    }

    case 'turn-start': {
      if (state.stopped || state.status !== 'queued') {
        return refused('invalid-transition', state)
      }
      return applied({ ...state, status: 'running', dirty: false })
    }

    case 'turn-end': {
      if (state.status !== 'running') {
        return refused('invalid-transition', state)
      }
      const idle: ReviewWakeState = {
        ...state,
        status: 'idle',
        wakeId: null,
        dirty: false,
      }
      // Stop suppresses the automatic post-turn re-read; explicit resume
      // performs the re-read instead.
      return state.stopped ? applied(idle) : applied(idle, [rescan(state, 'turn-end')])
    }

    case 'delivery-failed': {
      if (state.stopped || state.status !== 'queued') {
        return refused('invalid-transition', state)
      }
      if (input.wakeId !== undefined && input.wakeId !== state.wakeId) {
        return refused('wake-mismatch', state)
      }
      // Release the latch and reset the progress baseline so a LATER
      // activation can retry the same still-pending work. Never self-retry.
      return applied({
        ...state,
        status: 'idle',
        wakeId: null,
        observedWorkFingerprint: null,
        dirty: true,
      })
    }

    case 'stop': {
      if (state.stopped) return applied(state)
      const stoppedState: ReviewWakeState = {
        ...state,
        stopped: true,
        observedWorkFingerprint: null,
        dirty: false,
      }
      if (state.status !== 'queued') return applied(stoppedState)
      // Only an UNCLAIMED queued wake may be withdrawn; a claimed/running
      // turn keeps running and is released by its own turn-end.
      return applied(
        { ...stoppedState, status: 'idle', wakeId: null },
        state.wakeId === null
          ? NO_EFFECTS
          : [
              {
                kind: 'withdraw-wake',
                key: state.key,
                wakeId: state.wakeId,
                reason: 'stopped' satisfies ReviewWakeWithdrawReason,
              },
            ],
      )
    }

    case 'resume': {
      if (!state.stopped) return refused('invalid-transition', state)
      if (state.status === 'running') {
        // The in-flight turn cannot be cancelled; its turn-end will do the
        // re-read because Stop is now cleared.
        return applied({ ...state, stopped: false, dirty: true })
      }
      return applied(
        {
          ...state,
          stopped: false,
          status: 'idle',
          wakeId: null,
          observedWorkFingerprint: null,
          dirty: false,
        },
        [rescan(state, 'resume')],
      )
    }

    case 'recover': {
      const stopped = state.stopped || input.stopped === true
      const fact = input.persistedWake ?? null
      if (fact === null) {
        return applied({
          ...state,
          status: 'idle',
          wakeId: null,
          observedWorkFingerprint: null,
          dirty: false,
          stopped,
        })
      }
      if (!sameKey(fact.key, state.key)) {
        // In particular an older sessionGeneration is a different latch.
        return refused('key-mismatch', state)
      }
      if (stopped && fact.status === 'queued') {
        // Sticky Stop outranks a persisted unclaimed wake; no effect is
        // emitted during recovery (the caller owns Inbox reconciliation).
        return applied({
          ...state,
          status: 'idle',
          wakeId: null,
          observedWorkFingerprint: null,
          dirty: false,
          stopped,
        })
      }
      // ADOPT the persisted wake: no deliver-wake is ever emitted here.
      return applied({
        ...state,
        status: fact.status,
        wakeId: fact.wakeId,
        observedWorkFingerprint: fact.workFingerprint,
        dirty: false,
        stopped,
      })
    }
  }
}

/**
 * The thin stateful shell over the reducer. It stores only the pure latch;
 * callers still perform every effect. No I/O, no timers, no clock.
 */
export function createReviewWakeCoordinator(
  key: ReviewWakeKey,
): ReviewWakeCoordinator {
  let current = createReviewWakeState(key)
  return {
    get state(): ReviewWakeState {
      return current
    },
    dispatch(event: ReviewWakeEvent): ReviewWakeTransition {
      const result = reduceReviewWake(current, event)
      if (result.outcome === 'applied') current = result.state
      return result
    },
  }
}

/** Guard for callers that need to assert a state is one we produced. */
export function isReviewWakeStatus(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    (REVIEW_WAKE_STATUSES as readonly string[]).includes(value)
  )
}
