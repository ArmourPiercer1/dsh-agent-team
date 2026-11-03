/**
 * Alpha.6 — the deterministic wake DISPATCHER (plan → coordinator cycle).
 *
 * `wake-plan.ts` is the authoritative router-first PLAN: every pending leg is
 * routed once and the routes are merged per recipient session. This module is
 * the second slice: it turns ONE planned wake into the coordinator events the
 * `ReviewWakeCoordinator` reducer requires, and performs the ONE delivery the
 * latch allows. It never re-decides routing, never invents a recipient and
 * never invents an event name.
 *
 * ## Identity (deterministic, no randomness)
 *
 * A `ReviewWakeKey` is the single-flight latch identity
 * (`rootSessionId`, `reviewerInstanceId`, `sessionGeneration`). The recipient
 * session IS the reviewer identity; the Team root and the caller-supplied
 * generation complete the key. The merged leg set is summarised by a stable
 * `planFingerprint` (FNV-1a over the sorted leg ids plus the leg count). The
 * fingerprint cannot live in the key: the latch must stay the SAME when the
 * work moves, otherwise `dirty` could never be observed. Instead the reducer
 * derives the deterministic `wakeId` from `(key, fingerprint)`, so the full
 * identity `(key, fingerprint)` is stable for identical work and changes only
 * when the merged leg set changes.
 *
 * ## One delivery cycle (only reducer transitions, in order)
 *
 * 1. A plan arriving while the latch is `running` (an active turn) is an
 *    automatic `poll`: it marks the latch `dirty` and NEVER delivers a second
 *    wake.
 * 2. Otherwise the merged authoritative read is dispatched as
 *    `scan-result { kind: 'ready', fingerprint }`.
 * 3. If — and only if — the reducer answers with a `deliver-wake` effect, the
 *    effect is handed to the `ReviewWakeDeliveryPort` (text rendered by
 *    `createReviewWakeDelivery`).
 * 4. Delivery success claims the wake (`turn-start`), releases it
 *    (`turn-end`) and answers the single post-turn `rescan` with the SAME
 *    merged read, so the cycle ends `idle`, not `queued`.
 * 5. Delivery rejection is surfaced as `delivery-failed` (with the attempted
 *    `wakeId`), which releases `queued` and resets the progress baseline:
 *    the wake is retryable on a later cycle and is never claimed as delivered.
 *
 * A `dispatched` cycle is one recipient turn; it performs no I/O beyond the
 * caller's delivery port and reads no clock.
 *
 * @module @dsh-agent-team/runtime/alpha6/wake-dispatch
 */

import { createReviewWakeDelivery } from '../review-wake/index.js'
import type {
  ReviewWakeCoordinator,
  ReviewWakeDeliverEffect,
  ReviewWakeDeliveryPort,
  ReviewWakeKey,
  ReviewWakeRefusalCode,
  ReviewWakeStatus,
  ReviewWakeTransition,
} from '../review-wake/index.js'
import type { PlannedWake, WakePlan } from './wake-plan.js'

/** One dispatch cycle's dependency set. */
export interface WakeDispatchDeps {
  /** The router-first plan; held/human entries are surfaced, never dispatched. */
  readonly plan: WakePlan
  /** The Team root that owns every reviewed leg. */
  readonly rootSessionId: string
  /**
   * The per-identity latches the caller owns. The dispatcher derives the key
   * for each planned wake and binds it to the coordinator whose `state.key`
   * matches EXACTLY; a missing/mismatched latch fails closed (no delivery).
   */
  readonly coordinators: readonly ReviewWakeCoordinator[]
  /** The delivery seam; a rejection becomes the reducer's `delivery-failed`. */
  readonly deliver: (input: Parameters<ReviewWakeDeliveryPort>[0], targetSessionId: string) => Promise<void>
  /** Current generation of the recipient latch; 0 when the caller omits it. */
  readonly sessionGeneration?: number
  /**
   * Production turn ownership: when true the dispatcher claims the wake
   * (`turn-start`) but does NOT synthesize `turn-end`. The caller must call
   * {@link releaseReviewWake} from the recipient's REAL turn boundary.
   */
  readonly deferTurnEnd?: boolean
}

/** Per-recipient outcome of one dispatch cycle. */
export interface WakeDispatchDelivery {
  readonly sessionId: string
  readonly templateId: string
  readonly routeRole: PlannedWake['routeRole']
  readonly key: ReviewWakeKey
  /** The merged leg count the fingerprint was derived from. */
  readonly legCount: number
  /** The stable plan fingerprint used as the authoritative work read. */
  readonly workFingerprint: string
  /** The one wake this cycle delivered, `null` when nothing was delivered. */
  readonly wakeId: string | null
  readonly delivered: boolean
  /** The latch phase after the cycle (running = an active turn kept the wake). */
  readonly status: ReviewWakeStatus
  readonly dirty: boolean
  readonly stopped: boolean
}

/** Why a planned wake did not reach a successful delivery. */
export interface WakeDispatchFailure {
  readonly sessionId: string
  readonly scope: 'coordinator' | 'delivery' | 'transition'
  readonly message: string
  readonly refusal?: ReviewWakeRefusalCode
  readonly wakeId?: string
}

export interface WakeDispatchResult {
  /** One entry per planned wake, in plan order (delivered or not). */
  readonly deliveries: readonly WakeDispatchDelivery[]
  /** The wakes actually delivered this cycle. */
  readonly delivered: readonly WakeDispatchDelivery[]
  /** Session ids whose latch is `queued` after the cycle. */
  readonly queued: readonly string[]
  /** Session ids whose latch is `dirty` after the cycle. */
  readonly dirty: readonly string[]
  /** Held routes from the plan: surfaced as data, never dispatched. */
  readonly held: WakePlan['held']
  /** Human targets from the plan: no Agent inbox, never dispatched. */
  readonly humanLegIds: readonly string[]
  readonly failures: readonly WakeDispatchFailure[]
}

/** FNV-1a (32 bit) over UTF-16 code units. Stable across runs/hosts. */
function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * The stable work fingerprint of one planned wake: the merged leg COUNT plus
 * a hash over the sorted, de-duplicated leg ids and the recipient route. The
 * same plan always yields the same string; no clock, no randomness, and the
 * order in which the asks were routed does not matter.
 */
export function planFingerprint(wake: PlannedWake): string {
  const legs = [...new Set(wake.currentLegIds)].sort()
  const canonical = [
    'a6-review-wake-plan/v1',
    wake.reviewerInstanceId,
    wake.templateId,
    wake.routeRole,
    String(legs.length),
    ...legs,
  ].join('\u001f')
  return `a6wake:v1:${String(legs.length)}:${stableHash(canonical)}`
}

/**
 * The deterministic single-flight key for one planned wake. The recipient
 * session is the reviewer identity; the fingerprint is deliberately NOT part
 * of the key (see the module note) — it reaches the reducer as the
 * authoritative work scan, which derives the deterministic `wakeId`.
 */
export function reviewWakeKeyFor(
  wake: PlannedWake,
  rootSessionId: string,
  sessionGeneration: number,
): ReviewWakeKey {
  return {
    rootSessionId,
    reviewerInstanceId: wake.reviewerInstanceId,
    sessionGeneration,
  }
}

function sameKey(a: ReviewWakeKey, b: ReviewWakeKey): boolean {
  return (
    a.rootSessionId === b.rootSessionId &&
    a.reviewerInstanceId === b.reviewerInstanceId &&
    a.sessionGeneration === b.sessionGeneration
  )
}

function findCoordinator(
  coordinators: readonly ReviewWakeCoordinator[],
  key: ReviewWakeKey,
): ReviewWakeCoordinator | undefined {
  return coordinators.find((coordinator) => sameKey(coordinator.state.key, key))
}

function deliverEffect(
  transition: ReviewWakeTransition,
): ReviewWakeDeliverEffect | undefined {
  if (transition.outcome !== 'applied') return undefined
  return transition.effects.find(
    (effect): effect is ReviewWakeDeliverEffect => effect.kind === 'deliver-wake',
  )
}

function refusalOf(
  transition: ReviewWakeTransition,
): ReviewWakeRefusalCode | undefined {
  return transition.outcome === 'refused' ? transition.code : undefined
}

function failure(
  sessionId: string,
  scope: WakeDispatchFailure['scope'],
  message: string,
  transition: ReviewWakeTransition,
  wakeId?: string,
): WakeDispatchFailure {
  const refusal = refusalOf(transition)
  return {
    sessionId,
    scope,
    message,
    ...(refusal !== undefined ? { refusal } : {}),
    ...(wakeId !== undefined ? { wakeId } : {}),
  }
}

function outcome(
  wake: PlannedWake,
  key: ReviewWakeKey,
  fingerprint: string,
  coordinator: ReviewWakeCoordinator,
  delivered: boolean,
  wakeId: string | null,
): WakeDispatchDelivery {
  return {
    sessionId: wake.reviewerInstanceId,
    templateId: wake.templateId,
    routeRole: wake.routeRole,
    key,
    legCount: new Set(wake.currentLegIds).size,
    workFingerprint: fingerprint,
    wakeId,
    delivered,
    status: coordinator.state.status,
    dirty: coordinator.state.dirty,
    stopped: coordinator.state.stopped,
  }
}

/**
 * Dispatch ONE delivery cycle over a `WakePlan`.
 *
 * Async only because the delivery port is async; every reducer transition is
 * synchronous and pure. The result reports delivered wakes, queued/dirty
 * latches, held/human routes (never dispatched) and every failure. A delivery
 * port rejection is never swallowed and never reported as a success.
 */
export async function dispatchReviewWakes(
  deps: WakeDispatchDeps,
): Promise<WakeDispatchResult> {
  const generation = deps.sessionGeneration ?? 0
  const deliver = createReviewWakeDelivery(async (input) => {
    const targetSessionId = deps.plan.wakes.find((wake) => wake.reviewerInstanceId === input.key.reviewerInstanceId)?.targetSessionId
    if (targetSessionId === undefined) throw new Error(`no target session for reviewer instance '${input.key.reviewerInstanceId}'`)
    await deps.deliver(input, targetSessionId)
  })
  const deliveries: WakeDispatchDelivery[] = []
  const delivered: WakeDispatchDelivery[] = []
  const failures: WakeDispatchFailure[] = []

  for (const wake of deps.plan.wakes) {
    const key = reviewWakeKeyFor(wake, deps.rootSessionId, generation)
    const fingerprint = planFingerprint(wake)
    const coordinator = findCoordinator(deps.coordinators, key)
    if (coordinator === undefined) {
      failures.push({
        sessionId: wake.reviewerInstanceId,
        scope: 'coordinator',
        message: `no ReviewWakeCoordinator is registered for the derived key of session '${wake.reviewerInstanceId}'`,
      })
      // No latch, no state: report an idle, undelivered entry (fail closed).
      deliveries.push({
        sessionId: wake.reviewerInstanceId,
        templateId: wake.templateId,
        routeRole: wake.routeRole,
        key,
        legCount: new Set(wake.currentLegIds).size,
        workFingerprint: fingerprint,
        wakeId: null,
        delivered: false,
        status: 'idle',
        dirty: false,
        stopped: false,
      })
      continue
    }

    // Sticky Stop outranks every automatic path; the reducer would no-op the
    // events anyway, so report the latch without inventing a transition.
    if (coordinator.state.stopped) {
      deliveries.push(outcome(wake, key, fingerprint, coordinator, false, null))
      continue
    }

    // An active turn owns the latch. The plan arrival is an automatic poll:
    // it can only dirty the latch, never deliver a second wake.
    if (coordinator.state.status === 'running') {
      const polled = coordinator.dispatch({ type: 'poll' })
      if (polled.outcome === 'refused') {
        failures.push(
          failure(wake.reviewerInstanceId, 'transition', 'poll was refused during an active turn', polled),
        )
      }
      deliveries.push(outcome(wake, key, fingerprint, coordinator, false, null))
      continue
    }

    // The merged authoritative read answering the poll/activation rescan.
    const scanned = coordinator.dispatch({
      type: 'scan-result',
      work: { kind: 'ready', fingerprint },
    })
    if (scanned.outcome === 'refused') {
      failures.push(
        failure(wake.reviewerInstanceId, 'coordinator', 'the merged scan-result was refused', scanned),
      )
      deliveries.push(outcome(wake, key, fingerprint, coordinator, false, null))
      continue
    }

    const effect = deliverEffect(scanned)
    if (effect === undefined) {
      // Queued (one wake already outstanding) or idle at the same fingerprint
      // (pending-but-unchanged, bounded suppression). No second delivery.
      deliveries.push(outcome(wake, key, fingerprint, coordinator, false, null))
      continue
    }

    try {
      await deliver(effect)
    } catch (error) {
      // A port failure is the reducer's `delivery-failed`: it releases
      // `queued`, resets the baseline and is never a claimed success.
      const failed = coordinator.dispatch({
        type: 'delivery-failed',
        wakeId: effect.wakeId,
      })
      const reason = error instanceof Error ? error.message : String(error)
      if (failed.outcome === 'refused') {
        failures.push(
          failure(
            wake.reviewerInstanceId,
            'transition',
            `delivery failed (${reason}) and delivery-failed was refused`,
            failed,
            effect.wakeId,
          ),
        )
      } else {
        failures.push({
          sessionId: wake.reviewerInstanceId,
          scope: 'delivery',
          message: reason,
          wakeId: effect.wakeId,
        })
      }
      deliveries.push(outcome(wake, key, fingerprint, coordinator, false, null))
      continue
    }

    // The port accepted the wake: claim it, release it, and answer the ONE
    // post-turn rescan with the same merged read so the latch settles idle.
    const started = coordinator.dispatch({ type: 'turn-start' })
    if (started.outcome === 'refused') {
      failures.push(
        failure(
          wake.reviewerInstanceId,
          'transition',
          'the delivered wake could not be claimed (turn-start refused)',
          started,
          effect.wakeId,
        ),
      )
      // Delivered to the port but the latch did not advance: surface both.
      deliveries.push(outcome(wake, key, fingerprint, coordinator, true, effect.wakeId))
      delivered.push(deliveries[deliveries.length - 1]!)
      continue
    }

    if (deps.deferTurnEnd === true) {
      const claimed = outcome(wake, key, fingerprint, coordinator, true, effect.wakeId)
      deliveries.push(claimed)
      delivered.push(claimed)
      continue
    }

    const ended = coordinator.dispatch({ type: 'turn-end' })
    if (ended.outcome === 'refused') {
      failures.push(
        failure(
          wake.reviewerInstanceId,
          'transition',
          'the claimed wake could not be released (turn-end refused)',
          ended,
          effect.wakeId,
        ),
      )
      deliveries.push(outcome(wake, key, fingerprint, coordinator, true, effect.wakeId))
      delivered.push(deliveries[deliveries.length - 1]!)
      continue
    }

    if (ended.effects.some((next) => next.kind === 'rescan')) {
      const settled = coordinator.dispatch({
        type: 'scan-result',
        work: { kind: 'ready', fingerprint },
      })
      if (settled.outcome === 'refused') {
        failures.push(
          failure(
            wake.reviewerInstanceId,
            'coordinator',
            'the post-turn re-read was refused',
            settled,
            effect.wakeId,
          ),
        )
      }
    }

    const entry = outcome(wake, key, fingerprint, coordinator, true, effect.wakeId)
    deliveries.push(entry)
    delivered.push(entry)
  }

  return {
    deliveries,
    delivered,
    queued: deliveries.filter((entry) => entry.status === 'queued').map((entry) => entry.sessionId),
    dirty: deliveries.filter((entry) => entry.dirty).map((entry) => entry.sessionId),
    held: deps.plan.held,
    humanLegIds: deps.plan.humanLegIds,
    failures,
  }
}


/**
 * Release a wake claimed by `dispatchReviewWakes({ deferTurnEnd: true })` at
 * the recipient's REAL turn boundary. It is the only legal producer of the
 * post-delivery `turn-end`; the follow-up rescan uses the caller's fresh
 * authoritative fingerprint (not a stale one captured at delivery time).
 */
export function releaseReviewWake(
  coordinator: ReviewWakeCoordinator,
  work: { readonly kind: 'ready'; readonly fingerprint: string } | { readonly kind: 'no-ready-work' },
): ReviewWakeTransition {
  const ended = coordinator.dispatch({ type: 'turn-end' })
  if (ended.outcome === 'refused') return ended
  if (!ended.effects.some((next) => next.kind === 'rescan')) return ended
  return coordinator.dispatch({ type: 'scan-result', work })
}
