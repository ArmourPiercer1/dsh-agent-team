/**
 * Alpha.6 PR-I2 — the timed-wake decision core.
 *
 * Contract: `docs/plans/memo/alpha6-timed-wake/timedwake-port-contract-20261031.md` §2 (port), §3 (the refusal
 * surface, which is the only part implementable while the carrier is blocked), §4 (the acceptance legs these
 * types exist to make testable). Read that file before changing anything here: this module deliberately implements
 * LESS than the port describes, because the thing that would satisfy the port does not exist upstream.
 *
 * What is implemented: the consumer's decision. Given an optional `TimedWakePort`, a clock, and a durable sink,
 * decide whether a floor-delayed wake may be promised — and write down whichever answer was given.
 *
 * What is deliberately NOT implemented, and why that is not laziness:
 *  - **no scheduler**. Nothing here calls `setTimeout`/`setInterval` or persists a due time. §6 and ruling 一
 *    forbid a second timer family in the plugin; a wake guarantee must come from the host, or be refused.
 *  - **no wiring**. `src/plugin/host.ts` is untouched and gains no call site. §10 makes wiring conditional on legs
 *    L-1a/L-1b having actually been run against a host, and this machine has no test runtime
 *    (`tests/deepseek-harness-test-use`, `tests/homes` absent), so those legs are ENV-REFUSED — which is not a pass.
 *  - **no fake port in production**. The only `TimedWakePort` implementations are in the test file, where they are
 *    contract oracles for a future adapter, not a shipping wake source.
 *
 * Two rules the whole file exists to enforce, both from ruling 一 (2026-10-31):
 *  1. a missing time source answers `{ accepted: false, code: 'TIMED_WAKE_UNAVAILABLE' }` and never, under any
 *     configuration, `accepted: true`;
 *  2. the refusal is not merely returned to the caller — it is recorded, so "we blocked" is a durable fact rather
 *     than a log line somebody has to trust.
 *
 * @module packages/runtime/timed-wake/decision
 */

/** Why a wake was requested. A bounded slug, screened at the boundary: §2.4 allows only "why", never authority. */
const REASON_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/
/** Idempotency keys are caller-generated and enter durable facts, so they get the same shape discipline. */
const WAKE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

export type TimedWakeRefusal =
  /** No port exists — every case in this phase, by construction. */
  | 'TIMED_WAKE_UNAVAILABLE'
  /** Only used when the caller explicitly demands "not before" semantics on a past instant (§3). */
  | 'NOT_BEFORE_IN_PAST'
  /** The same wakeId is already bound to a different reason (§2.2). */
  | 'WAKE_ID_CONFLICT'
  /** A port exists and refused. Its own code travels unchanged in `portCode`; we never rewrite it. */
  | 'PORT_REFUSED'

export type TimedWakeReason = string

/** What a port reports when a wake moment arrives (§2's `setHandler` payload). */
export interface TimedWakeFire {
  readonly wakeId: string
  readonly reason: TimedWakeReason
  readonly firedAtEpochMs: number
  /** The `notBefore` originally requested; `firedAt - dueSince` is how late delivery is recognised. */
  readonly dueSinceEpochMs: number
  /** True when this delivery is a replay after a restart (§2.1). */
  readonly replay: boolean
}

export type TimedWakeScheduleResult =
  | { readonly accepted: true; readonly scheduledAtEpochMs: number }
  | { readonly accepted: false; readonly code: TimedWakeRefusal }

export type TimedWakeCancelResult =
  | { readonly cancelled: true }
  | { readonly cancelled: false; readonly code: 'UNKNOWN_WAKE' | 'ALREADY_FIRED' | 'CANCEL_UNSUPPORTED' }

/** The host-provided time source PR-I2 does not yet have. Implementations must persist or refuse (§2.1). */
export interface TimedWakePort {
  schedule(input: {
    readonly wakeId: string
    readonly notBeforeEpochMs: number
    readonly reason: TimedWakeReason
  }): Promise<TimedWakeScheduleResult>
  cancel(input: { readonly wakeId: string }): Promise<TimedWakeCancelResult>
  setHandler(handler: (wake: TimedWakeFire) => void | Promise<void>): void
}

/** A request for a floor-delayed wake. `requireFutureNotBefore` selects the strict reading of a past instant. */
export interface TimedWakeRequest {
  readonly wakeId: string
  readonly notBeforeEpochMs: number
  readonly reason: TimedWakeReason
  readonly requireFutureNotBefore?: boolean
}

/**
 * Durable facts this module may append. The set is closed and contains no authority, identity, permission or
 * decision field by construction — the same screen PR-I1a applies to its payloads: a wake is never a credential.
 */
export type TimedWakeFact =
  | {
      readonly kind: 'timed-wake-scheduled'
      readonly wakeId: string
      readonly reason: TimedWakeReason
      readonly notBeforeEpochMs: number
      readonly scheduledAtEpochMs: number
    }
  | {
      readonly kind: 'timed-wake-refused'
      readonly wakeId: string
      readonly reason: TimedWakeReason
      readonly code: TimedWakeRefusal
      readonly portCode?: string
      readonly attemptedAtEpochMs: number
    }
  | {
      readonly kind: 'timed-wake-fired'
      readonly wakeId: string
      readonly reason: TimedWakeReason
      readonly firedAtEpochMs: number
      readonly dueSinceEpochMs: number
      readonly replay: boolean
    }
  | {
      readonly kind: 'timed-wake-fire-error'
      readonly wakeId: string
      readonly reason: TimedWakeReason
      readonly firedAtEpochMs: number
      readonly message: string
    }
  | {
      readonly kind: 'timed-wake-schedule-error'
      readonly wakeId: string
      readonly reason: TimedWakeReason
      readonly message: string
    }

export interface TimedWakeDeps {
  /** Absent for the whole of this phase. Its absence is the blocked carrier, not a default to paper over. */
  readonly port?: TimedWakePort
  /** Injectable wall clock. The core never reads `Date` directly, so "which clock answered" is always explicit. */
  readonly nowEpochMs: () => number
  readonly appendFact: (fact: TimedWakeFact) => Promise<void>
  /** Best-effort lookup of the reason an existing wakeId was bound to, for the idempotency rule (§2.2). */
  readonly reasonOfKnownWake?: (wakeId: string) => TimedWakeReason | undefined
}

export type TimedWakeDecision =
  | { readonly accepted: true; readonly scheduledAtEpochMs: number }
  | { readonly accepted: false; readonly code: TimedWakeRefusal; readonly portCode?: string }

function screen(pattern: RegExp, value: string, label: string): void {
  if (!pattern.test(value)) {
    throw new TypeError(
      `${label} must match ${String(pattern)} (a bounded slug carrying no authority); got ${JSON.stringify(value)}`,
    )
  }
}

function refused(
  deps: TimedWakeDeps,
  request: TimedWakeRequest,
  code: TimedWakeRefusal,
  portCode?: string,
): Promise<TimedWakeDecision> {
  const fact: TimedWakeFact = {
    kind: 'timed-wake-refused',
    wakeId: request.wakeId,
    reason: request.reason,
    code,
    ...(portCode === undefined ? {} : { portCode }),
    attemptedAtEpochMs: deps.nowEpochMs(),
  }
  // Typed as the union, not inferred: an inferred `accepted: boolean` would let a refusal flow into a branch
  // that reads it as acceptance, which is the one confusion this module exists to make unrepresentable.
  const decision: TimedWakeDecision =
    portCode === undefined ? { accepted: false, code } : { accepted: false, code, portCode }
  // §2.6: the refusal itself is the durable record. A refusal that leaves no trace is a claim, not a fact.
  return deps.appendFact(fact).then(() => decision)
}

/**
 * Decide one floor-delayed wake request. Returns after the corresponding durable fact has been appended, so a
 * caller that returns `accepted: false` has already left the trace behind it.
 *
 * Malformed `wakeId`/`reason` reject rather than refuse: they are caller bugs at a boundary we own, and turning
 * them into a business code would let a bad identifier slip into durable facts. They reject instead of throwing
 * synchronously so the function has exactly one failure channel — a caller that only ever awaits cannot have a
 * validation error escape past it, which is the same reason §4 leg 7 forbids swallowing anything.
 */
export async function decideTimedWake(deps: TimedWakeDeps, request: TimedWakeRequest): Promise<TimedWakeDecision> {
  screen(WAKE_ID_PATTERN, request.wakeId, 'wakeId')
  screen(REASON_PATTERN, request.reason, 'reason')
  if (!Number.isSafeInteger(request.notBeforeEpochMs) || request.notBeforeEpochMs < 0) {
    throw new TypeError(`notBeforeEpochMs must be a non-negative safe integer; got ${String(request.notBeforeEpochMs)}`)
  }

  const known = deps.reasonOfKnownWake?.(request.wakeId)
  if (known !== undefined && known !== request.reason) {
    return refused(deps, request, 'WAKE_ID_CONFLICT')
  }
  if (deps.port === undefined) {
    return refused(deps, request, 'TIMED_WAKE_UNAVAILABLE')
  }
  // §2.3: wall-clock semantics. A past instant means "immediately" unless the caller asked for the strict reading.
  if (request.requireFutureNotBefore === true && request.notBeforeEpochMs < deps.nowEpochMs()) {
    return refused(deps, request, 'NOT_BEFORE_IN_PAST')
  }

  const port = deps.port
  let result: TimedWakeScheduleResult
  try {
    result = await port.schedule({
      wakeId: request.wakeId,
      notBeforeEpochMs: request.notBeforeEpochMs,
      reason: request.reason,
    })
  } catch (error: unknown) {
    // Leg 7's sibling: an exception from the carrier must not be swallowed into a silent non-wake, and must not
    // be laundered into a refusal code either — an error is not a refusal. Record, then let it propagate.
    await deps.appendFact({
      kind: 'timed-wake-schedule-error',
      wakeId: request.wakeId,
      reason: request.reason,
      message: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
  if (result.accepted === false) {
    // §3: a port's own refusal travels unchanged. Rewriting it would hide which layer said no.
    return refused(deps, request, 'PORT_REFUSED', result.code)
  }
  const fact: TimedWakeFact = {
    kind: 'timed-wake-scheduled',
    wakeId: request.wakeId,
    reason: request.reason,
    notBeforeEpochMs: request.notBeforeEpochMs,
    scheduledAtEpochMs: result.scheduledAtEpochMs,
  }
  await deps.appendFact(fact)
  return { accepted: true, scheduledAtEpochMs: result.scheduledAtEpochMs }
}

/**
 * Wrap the caller's wake handler so that a delivery is observed durably before the business effect runs, and a
 * throwing handler records its failure without erasing the fact that the moment arrived (§4 leg 7).
 */
export function observeTimedWake(
  deps: TimedWakeDeps,
  inner: (wake: TimedWakeFire) => void | Promise<void>,
): (wake: TimedWakeFire) => Promise<void> {
  return async (wake: TimedWakeFire): Promise<void> => {
    screen(WAKE_ID_PATTERN, wake.wakeId, 'wakeId')
    await deps.appendFact({
      kind: 'timed-wake-fired',
      wakeId: wake.wakeId,
      reason: wake.reason,
      firedAtEpochMs: wake.firedAtEpochMs,
      dueSinceEpochMs: wake.dueSinceEpochMs,
      replay: wake.replay,
    })
    try {
      await inner(wake)
    } catch (error: unknown) {
      await deps.appendFact({
        kind: 'timed-wake-fire-error',
        wakeId: wake.wakeId,
        reason: wake.reason,
        firedAtEpochMs: wake.firedAtEpochMs,
        message: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}
