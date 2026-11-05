/**
 * Alpha.6 PR4 (delivery slice) — the generic Review Wake delivery seam.
 *
 * The coordinator emits a `deliver-wake` EFFECT; this module turns that
 * effect into one deterministic, non-authority model-visible hint and hands
 * it to a caller-supplied delivery port. It performs no I/O itself, writes no
 * TeamDomain state, and never names an approval decision. The durable case
 * ledger and the restricted review list remain the authority.
 *
 * The real Host adapter (DSH Inbox / followup-steer) is wired in PR6; this
 * seam is deliberately small so the adapter can be swapped without changing
 * the coordinator or the text.
 *
 * @module @dsh-agent-team/runtime/review-wake/delivery
 */
import type { ReviewWakeEffect, ReviewWakeKey } from './types.js'

export interface ReviewWakeDeliveryInput {
  readonly key: ReviewWakeKey
  readonly wakeId: string
  readonly text: string
}

export interface ReviewWakeDeliveryPort {
  (input: ReviewWakeDeliveryInput): Promise<void>
}

export type ReviewWakeDeliverEffect = Extract<ReviewWakeEffect, { kind: 'deliver-wake' }>

const WAKE_ID_MAX = 1024
const ROOT_ID_MAX = 256
const INSTANCE_ID_MAX = 256

function boundedId(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`review-wake: ${field} must be a non-empty string`)
  }
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

/**
 * The token is the ONLY Inbox identity: `has()` matches this exact string.
 * Truncating it would make every probe answer false and re-deliver forever, so
 * an over-long id is a typed refusal, never a shortened token.
 */
function exactId(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`review-wake: ${field} must be a non-empty string`)
  }
  if (value.length > max) {
    throw new TypeError(`review-wake: ${field} exceeds ${String(max)} characters`)
  }
  return value
}

/**
 * Render ONE wake hint. The token-leading line is stable for the same
 * `wakeId`, so a redelivery is recognizable; the text never contains a
 * decision, case payload, or tool authority.
 */
export function renderReviewWake(effect: ReviewWakeDeliverEffect): string {
  const wakeId = exactId(effect.wakeId, 'wakeId', WAKE_ID_MAX)
  const rootSessionId = boundedId(effect.key.rootSessionId, 'rootSessionId', ROOT_ID_MAX)
  const reviewerInstanceId = boundedId(effect.key.reviewerInstanceId, 'reviewerInstanceId', INSTANCE_ID_MAX)
  return [
    `[team-review-wake wakeId=${wakeId}]`,
    'New review work is ready.',
    '',
    `reviewer: ${reviewerInstanceId}`,
    `rootSession: ${rootSessionId}`,
    ...(effect.requestIds === undefined || effect.requestIds.length === 0
      ? ['Read your current review tasks with `team_list_pending_control`, then decide or escalate with `team_resolve_control`.']
      : [
          'requestId:',
          ...effect.requestIds.slice(0, 32).map((requestId) => `- ${boundedId(requestId, 'requestId', WAKE_ID_MAX)}`),
          'Decide or escalate with `team_resolve_control` using the EXACT requestId above; `team_list_pending_control` may be Leader-only for a delegated reviewer.',
        ]),
  ].join('\n')
}

/**
 * Bind the coordinator's delivery effect to one port. A port rejection
 * PROPAGATES: the coordinator's `delivery-failed` transition is what releases
 * `queued`, and this seam must not swallow that signal.
 */
export function createReviewWakeDelivery(port: ReviewWakeDeliveryPort): (effect: ReviewWakeDeliverEffect) => Promise<void> {
  if (typeof port !== 'function') {
    throw new TypeError('review-wake: a delivery port function is required')
  }
  return async (effect) => {
    await port({
      key: effect.key,
      wakeId: effect.wakeId,
      text: renderReviewWake(effect),
    })
  }
}
