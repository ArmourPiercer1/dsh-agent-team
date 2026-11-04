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
 *    intent is persisted, the effect is handed to the `ReviewWakeDeliveryPort`
 *    (text rendered by `createReviewWakeDelivery`), and the Inbox acceptance
 *    is recorded (`markAccepted`).
 * 4. Inbox acceptance means QUEUED, not claimed: the latch STAYS `queued`.
 *    The Host adapter calls {@link claimReviewWake} when the recipient turn
 *    actually starts, and {@link releaseReviewWake} at the real turn boundary.
 *    Neither a recipient turn nor a `turn-end` is synthesized here.
 * 5. Delivery rejection is surfaced as `delivery-failed` (with the attempted
 *    `wakeId`), which releases `queued` and resets the progress baseline:
 *    the wake is retryable on a later cycle and is never claimed as delivered.
 *
 * A `dispatched` cycle performs no I/O beyond the caller's delivery port,
 * intent store and Inbox reconcile port; it reads no clock.
 *
 * @module @dsh-agent-team/runtime/alpha6/wake-dispatch
 */

import { createReviewWakeDelivery } from '../review-wake/index.js'
import type {
  ReviewWakeCoordinator,
  ReviewWakeDeliverEffect,
  ReviewWakeDeliveryPort,
  ReviewWakeEffect,
  ReviewWakeKey,
  ReviewWakeRefusalCode,
  ReviewWakeStatus,
  ReviewWakeTransition,
  ReviewWorkScan,
} from '../review-wake/index.js'
import type {
  ReviewWakeInboxPort,
  ReviewWakeIntentStore,
} from './wake-intent.js'
import type { PlannedWake, WakePlan } from './wake-plan.js'

// PR3 lane hygiene: root/host code imports the lane ONLY through alpha6.
export { createReviewWakeCoordinator, renderReviewWake } from '../review-wake/index.js'
export type { ReviewWakeCoordinator as LatchCoordinator } from '../review-wake/index.js'
export { recoverReviewWake as recoverLatch } from './wake-intent.js'

/** Root-facing aliases: PR3 lane hygiene keeps the lane token inside alpha6. */
export {
  claimReviewWake as claimLatch,
  createReviewWakeCoordinator as createLatchCoordinator,
  dispatchReviewWakes as dispatchLatch,
  planFingerprint as latchFingerprint,
  releaseReviewWake as releaseLatch,
  reviewWakeKeyFor as latchKeyFor,
  renderReviewWake as renderLatchWake,
} from './wake-dispatch.js'
/** The marker every review-wake message carries (the Host filters on it). */
export const ALPHA6_WAKE_MARKER = '[team-review-wake'

/** One dispatch cycle's dependency set. */
/**
 * Wake ids whose persist/deliver/mark is in flight in THIS process. A queued
 * reducer state is published before the async delivery completes, so a second
 * notification arriving in that window would otherwise see "queued but not in
 * the Inbox" and release a delivery that is merely still starting.
 */
const inFlightWakeIds = new Set<string>()

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
   * Production turn ownership: accepted for compatibility, but no longer
   * changes the latch. Inbox acceptance NEVER claims a turn, so a dispatch
   * always leaves the latch `queued` in both modes; the caller claims
   * ({@link claimReviewWake}) and releases ({@link releaseReviewWake}) at the
   * Host's real turn boundaries.
   */
  readonly deferTurnEnd?: boolean
  /**
   * The minimal persisted intent seam: one row per latch, written BEFORE the
   * delivery attempt and marked accepted AFTER the Inbox accepts it. Optional
   * for pure unit cycles; production supplies the durable port (window a–d
   * recovery lives in `wake-intent.ts`).
   */
  readonly intent?: ReviewWakeIntentStore
  /**
   * The native Inbox probe used by the no-ready-work reconcile: a queued
   * wake whose recipient is absent from the new plan is withdrawn from the
   * Inbox (when the port offers `remove`) and the latch is revoked.
   */
  readonly inbox?: ReviewWakeInboxPort
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
  /**
   * Session ids whose stale queued wake the no-ready-work reconcile revoked
   * because the recipient was ABSENT from this plan (an empty plan revokes
   * every queued latch at this root/generation).
   */
  readonly revoked: readonly string[]
  /** The withdrawn Inbox message ids (the reconcile effects actually drained). */
  readonly revokedWakeIds: readonly string[]
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

    // A queued latch whose native message disappeared (interrupt/cancel,
    // session clear, a non-throwing remove) is otherwise a permanent wedge:
    // every later plan takes this same branch and no turn can claim it.
    const queuedWakeId = coordinator.state.status === 'queued' ? coordinator.state.wakeId : null

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

    let effect = deliverEffect(scanned)
    if (effect === undefined && queuedWakeId !== null && deps.inbox !== undefined) {
      let present = true
      try {
        present = await deps.inbox.has(queuedWakeId)
      } catch {
        // An unreadable Inbox is not evidence of absence: do not release on it.
        present = true
      }
      if (!present && !inFlightWakeIds.has(queuedWakeId)) {
        const released = coordinator.dispatch({ type: 'delivery-failed', wakeId: queuedWakeId })
        if (released.outcome === 'applied') {
          const rescanned = coordinator.dispatch({
            type: 'scan-result',
            work: { kind: 'ready', fingerprint },
          })
          if (rescanned.outcome === 'applied') effect = deliverEffect(rescanned)
        }
      }
    }
    if (effect === undefined) {
      // Queued (one wake already outstanding) or idle at the same fingerprint
      // (pending-but-unchanged, bounded suppression). No second delivery.
      deliveries.push(outcome(wake, key, fingerprint, coordinator, false, null))
      continue
    }

    inFlightWakeIds.add(effect.wakeId)
    let accepted = false
    try {
      // Crash window (a)/(b): the intent is durable BEFORE the Inbox call, so
      // "decided but not delivered" is visible to recovery and can be
      // discarded instead of adopted.
      await deps.intent?.persistQueued({
        key: effect.key,
        wakeId: effect.wakeId,
        workFingerprint: effect.workFingerprint,
      })
      await deliver(effect)
      accepted = true
    } catch (error) {
      // A transport can throw AFTER the native Inbox accepted the message.
      // Treating that as "never delivered" would clear the intent and release
      // the latch, and the next deterministic scan would deliver a duplicate.
      let landed = false
      if (deps.inbox !== undefined) {
        try {
          landed = await deps.inbox.has(effect.wakeId)
        } catch {
          landed = false
        }
      }
      if (landed) {
        try { await deps.intent?.markAccepted(effect.wakeId) } catch { /* Inbox is truth */ }
        inFlightWakeIds.delete(effect.wakeId)
        const entry = outcome(wake, key, fingerprint, coordinator, true, effect.wakeId)
        deliveries.push(entry)
        delivered.push(entry)
        continue
      }
      // A port failure is the reducer's `delivery-failed`: it releases
      // `queued`, resets the baseline and is never a claimed success. The
      // intent row goes too: there is no delivered wake to recover.
      await clearIntent(deps.intent, effect.wakeId)
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
      inFlightWakeIds.delete(effect.wakeId)
      deliveries.push(outcome(wake, key, fingerprint, coordinator, false, null))
      continue
    }
    if (accepted) {
      try {
        // Crash window (c): the Inbox has the message, but the local mark may
        // be lost. Recovery adopts from the Inbox truth, not from this call.
        await deps.intent?.markAccepted(effect.wakeId)
      } catch (error) {
        // The Inbox ALREADY accepted the wake. A local mark failure must not
        // be reported as a delivery failure (that would release `queued` and
        // let the next plan deliver the same wakeId again). Keep the durable
        // intent `queued`; boot recovery reconciles it from the Inbox truth.
        failures.push({
          sessionId: wake.reviewerInstanceId,
          scope: 'delivery',
          message: `wake accepted by the Inbox but markAccepted failed: ${error instanceof Error ? error.message : String(error)}`,
          wakeId: effect.wakeId,
        })
        inFlightWakeIds.delete(effect.wakeId)
        deliveries.push(outcome(wake, key, fingerprint, coordinator, true, effect.wakeId))
        continue
      }
    }

    // Inbox acceptance is QUEUED, never claimed: the wake sits in the native
    // Inbox until the Host starts a turn. The dispatcher does not synthesize
    // `turn-start`/`turn-end`; `claimReviewWake`/`releaseReviewWake` own them.
    inFlightWakeIds.delete(effect.wakeId)
    const entry = outcome(wake, key, fingerprint, coordinator, true, effect.wakeId)
    deliveries.push(entry)
    delivered.push(entry)
  }

  // Latches ABSENT from this plan have no ready work in the authoritative
  // read. Reconcile (withdraw) their stale queued wake; a running/claimed
  // turn is never cancelled by absence.
  const reconciled = await reconcileReviewWakes({
    plan: deps.plan,
    rootSessionId: deps.rootSessionId,
    sessionGeneration: generation,
    coordinators: deps.coordinators,
    ...(deps.intent !== undefined ? { intent: deps.intent } : {}),
    ...(deps.inbox !== undefined ? { inbox: deps.inbox } : {}),
  })
  failures.push(...reconciled.failures)

  return {
    deliveries,
    delivered,
    queued: deliveries.filter((entry) => entry.status === 'queued').map((entry) => entry.sessionId),
    dirty: deliveries.filter((entry) => entry.dirty).map((entry) => entry.sessionId),
    held: deps.plan.held,
    humanLegIds: deps.plan.humanLegIds,
    revoked: reconciled.revoked,
    revokedWakeIds: reconciled.wakeIds,
    failures,
  }
}

async function clearIntent(
  store: ReviewWakeIntentStore | undefined,
  wakeId: string,
): Promise<void> {
  try {
    await store?.clear(wakeId)
  } catch {
    // The primary delivery/transition failure is the fact worth surfacing;
    // a failing clear leaves the intent for `recoverReviewWake`, which will
    // discard it when the Inbox has no such message.
  }
}


/**
 * The Host's REAL turn-start claim: `queued` -> `running` only.
 *
 * A delivery port's acceptance proves the message reached the native Inbox;
 * it does NOT prove the recipient claimed or started a turn. Only the Host
 * adapter that owns the recipient Agent may call this, from the Agent's actual
 * turn-start boundary. The reducer refuses it in every phase but `queued`.
 */
export function claimReviewWake(
  coordinator: ReviewWakeCoordinator,
): ReviewWakeTransition {
  return coordinator.dispatch({ type: 'turn-start' })
}

/** Drain one emitted `deliver-wake` through the Host delivery seam. */
export type ReviewWakeReleaseDeliver = (
  effect: ReviewWakeDeliverEffect,
) => void | Promise<void>

/** Optional seams for a release; none of them is authority. */
export interface ReviewWakeReleaseOptions {
  /**
   * Required whenever the release emits a fresh `deliver-wake` (the fresh
   * fingerprint moved). A missing port THROWS instead of leaving an
   * unconsumed queued wake behind.
   */
  readonly deliver?: ReviewWakeReleaseDeliver
  /** Persist the fresh intent before its delivery; mark/clear around it. */
  readonly intent?: ReviewWakeIntentStore
  /** Native Inbox removal for a `withdraw-wake` effect. */
  readonly inbox?: ReviewWakeInboxPort
}

export interface ReviewWakeReleaseFailure {
  readonly scope: 'delivery' | 'transition'
  readonly message: string
  readonly wakeId?: string
}

/** Every effect a release produced, and how each one was consumed. */
export interface ReviewWakeReleaseResult {
  readonly outcome: ReviewWakeTransition['outcome']
  readonly refusal?: ReviewWakeRefusalCode
  /** The latch phase after the release (`queued` = a fresh wake is pending). */
  readonly status: ReviewWakeStatus
  readonly wakeId: string | null
  readonly effects: readonly ReviewWakeEffect[]
  /** The fresh wake ids this release delivered itself. */
  readonly delivered: readonly string[]
  /** The stale Inbox message ids this release withdrew itself. */
  readonly withdrawn: readonly string[]
  readonly failures: readonly ReviewWakeReleaseFailure[]
}

function releaseSnapshot(
  coordinator: ReviewWakeCoordinator,
  transition: ReviewWakeTransition,
  effects: readonly ReviewWakeEffect[],
  delivered: readonly string[],
  withdrawn: readonly string[],
  failures: readonly ReviewWakeReleaseFailure[],
): ReviewWakeReleaseResult {
  return {
    outcome: transition.outcome,
    ...(transition.outcome === 'refused' ? { refusal: transition.code } : {}),
    status: coordinator.state.status,
    wakeId: coordinator.state.wakeId,
    effects,
    delivered,
    withdrawn,
    failures,
  }
}

/**
 * Release a wake at the recipient's REAL turn boundary and CONSUME every
 * effect it produces.
 *
 * The old shape returned the reducer transition and let a `deliver-wake`
 * effect escape unconsumed (a fresh fingerprint after `turn-end` left a
 * queued wake the caller never delivered). This function drains it: the fresh
 * wake is persisted, delivered and marked accepted inside the same call, so a
 * release with NEW work yields exactly one new delivery and the latch ends
 * `queued` (never a phantom queued wake with no Inbox message).
 *
 * If the latch is still `queued` (the Host never claimed, or the claim was
 * lost across a crash), the release claims it first: a real turn boundary is
 * proof that the turn ran. `turn-end` is dispatched only from this function.
 */
export async function releaseReviewWake(
  coordinator: ReviewWakeCoordinator,
  work: ReviewWorkScan,
  deliverOrOptions: ReviewWakeReleaseDeliver | ReviewWakeReleaseOptions = {},
): Promise<ReviewWakeReleaseResult> {
  // The third argument may be the delivery port itself (the terse shape) or
  // the full options object.
  const options: ReviewWakeReleaseOptions =
    typeof deliverOrOptions === 'function'
      ? { deliver: deliverOrOptions }
      : deliverOrOptions
  const effects: ReviewWakeEffect[] = []
  const delivered: string[] = []
  const withdrawn: string[] = []
  const failures: ReviewWakeReleaseFailure[] = []
  const releasedWakeId = coordinator.state.wakeId

  if (coordinator.state.status === 'queued') {
    const claimed = claimReviewWake(coordinator)
    if (claimed.outcome === 'refused') {
      return releaseSnapshot(coordinator, claimed, effects, delivered, withdrawn, failures)
    }
    effects.push(...claimed.effects)
  }

  const ended = coordinator.dispatch({ type: 'turn-end' })
  if (ended.outcome === 'refused') {
    return releaseSnapshot(coordinator, ended, effects, delivered, withdrawn, failures)
  }
  effects.push(...ended.effects)

  let transition: ReviewWakeTransition = ended
  if (ended.effects.some((effect) => effect.kind === 'rescan')) {
    // The caller's FRESH authoritative read answers the ONE post-turn rescan.
    transition = coordinator.dispatch({ type: 'scan-result', work })
    if (transition.outcome === 'refused') {
      return releaseSnapshot(coordinator, transition, effects, delivered, withdrawn, failures)
    }
    effects.push(...transition.effects)
  }

  // Drain EVERY effect. `rescan` was answered above; `deliver-wake` and
  // `withdraw-wake` are consumed here.
  for (const effect of effects) {
    if (effect.kind === 'withdraw-wake') {
      try {
        if (options.inbox?.remove === undefined) {
          throw new Error('review-wake: withdraw-wake requires an Inbox remove port')
        }
        await options.inbox.remove(effect.wakeId)
        await options.intent?.clear(effect.wakeId)
        withdrawn.push(effect.wakeId)
      } catch (error) {
        failures.push({
          scope: 'transition',
          message: error instanceof Error ? error.message : String(error),
          wakeId: effect.wakeId,
        })
      }
      continue
    }
    if (effect.kind !== 'deliver-wake') continue
    if (options.deliver === undefined) {
      // Fail closed: leaving this effect unconsumed is exactly the defect the
      // release path is fixing.
      throw new TypeError(
        'review-wake: release emitted a deliver-wake effect but no delivery port was supplied',
      )
    }
    try {
      await options.intent?.persistQueued({
        key: effect.key,
        wakeId: effect.wakeId,
        workFingerprint: effect.workFingerprint,
      })
      await options.deliver(effect)
    } catch (error) {
      let landed = false
      if (options.inbox !== undefined) {
        try {
          landed = await options.inbox.has(effect.wakeId)
        } catch {
          landed = false
        }
      }
      if (landed) {
        try { await options.intent?.markAccepted(effect.wakeId) } catch { /* Inbox is truth */ }
        delivered.push(effect.wakeId)
        continue
      }
      // The message never reached the Inbox: clearing the intent and moving
      // the latch to delivery-failed is safe (nothing was delivered).
      await clearIntent(options.intent, effect.wakeId)
      const failed = coordinator.dispatch({
        type: 'delivery-failed',
        wakeId: effect.wakeId,
      })
      failures.push({
        scope: 'delivery',
        message: error instanceof Error ? error.message : String(error),
        wakeId: effect.wakeId,
      })
      if (failed.outcome === 'refused') {
        failures.push({
          scope: 'transition',
          message: 'delivery-failed was refused after the release delivery failed',
          wakeId: effect.wakeId,
        })
      }
      continue
    }
    try {
      await options.intent?.markAccepted(effect.wakeId)
    } catch {
      // The Inbox is the truth: the message WAS delivered. Clearing the intent
      // or dispatching delivery-failed here would re-deliver on the next scan
      // and duplicate the wake. Leave the queued row for Inbox-truthful
      // recovery adoption (window c) and count the delivery as done.
    }
    delivered.push(effect.wakeId)
  }

  // Clear the released turn's consumed Inbox message LAST: a fresh intent must
  // be durable before its predecessor disappears, or a crash in between
  // leaves a queued latch with no row for boot recovery to enumerate.
  if (releasedWakeId !== null) await clearIntent(options.intent, releasedWakeId)

  return releaseSnapshot(coordinator, transition, effects, delivered, withdrawn, failures)
}

/** One no-ready-work reconcile cycle's dependency set. */
export interface WakeReconcileDeps {
  readonly plan: WakePlan
  readonly rootSessionId: string
  readonly sessionGeneration?: number
  readonly coordinators: readonly ReviewWakeCoordinator[]
  readonly intent?: ReviewWakeIntentStore
  readonly inbox?: ReviewWakeInboxPort
}

export interface WakeReconcileResult {
  /** Session ids whose stale queued latch was revoked. */
  readonly revoked: readonly string[]
  /** The withdrawn Inbox message ids. */
  readonly wakeIds: readonly string[]
  readonly failures: readonly WakeDispatchFailure[]
}

/**
 * Reconcile latches ABSENT from the new plan with the authoritative
 * `no-ready-work` read.
 *
 * Plan absence means the router no longer sees ready work for that recipient.
 * A stale `queued` wake must not survive it (it could wake the recipient for
 * nothing and keep the single-flight latch occupied). The reconcile answers
 * the rescan with `{ kind: 'no-ready-work' }`, drains the `withdraw-wake`
 * effect through the native Inbox (when `remove` exists) and clears the
 * persisted intent. A `running`/claimed turn is never cancelled this way.
 *
 * Dispatch calls this automatically at the end of every cycle, which makes an
 * EMPTY plan revoke every queued latch at the same root/generation.
 */
export async function reconcileReviewWakes(
  deps: WakeReconcileDeps,
): Promise<WakeReconcileResult> {
  const generation = deps.sessionGeneration ?? 0
  const planned = new Set(
    deps.plan.wakes.map((wake) => wake.reviewerInstanceId),
  )
  const revoked: string[] = []
  const wakeIds: string[] = []
  const failures: WakeDispatchFailure[] = []

  for (const coordinator of deps.coordinators) {
    const key = coordinator.state.key
    if (key.rootSessionId !== deps.rootSessionId) continue
    if (key.sessionGeneration !== generation) continue
    if (planned.has(key.reviewerInstanceId)) continue
    if (coordinator.state.stopped) continue

    const reconciled = coordinator.dispatch({
      type: 'scan-result',
      work: { kind: 'no-ready-work' },
    })
    if (reconciled.outcome === 'refused') {
      failures.push({
        sessionId: key.reviewerInstanceId,
        scope: 'transition',
        message: 'the no-ready-work reconcile was refused',
        refusal: reconciled.code,
      })
      continue
    }

    const withdrawals = reconciled.effects.filter(
      (effect): effect is Extract<ReviewWakeEffect, { kind: 'withdraw-wake' }> =>
        effect.kind === 'withdraw-wake',
    )
    for (const effect of withdrawals) {
      try {
        await deps.inbox?.remove?.(effect.wakeId)
        await deps.intent?.clear(effect.wakeId)
        wakeIds.push(effect.wakeId)
      } catch (error) {
        failures.push({
          sessionId: key.reviewerInstanceId,
          scope: 'transition',
          message: error instanceof Error ? error.message : String(error),
          wakeId: effect.wakeId,
        })
      }
    }
    if (withdrawals.length > 0) revoked.push(key.reviewerInstanceId)
  }

  return { revoked, wakeIds, failures }
}

