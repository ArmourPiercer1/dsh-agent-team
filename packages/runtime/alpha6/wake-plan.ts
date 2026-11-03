/**
 * Alpha.6 — the authoritative wake PLAN (router → per-recipient merge).
 *
 * The direct per-request notifier is NOT the main path. This module runs every
 * pending leg through the shared `ReviewRouter`, then merges the recipient
 * routes into ONE plan per Agent session. A coordinator/dispatcher consumes
 * this plan; it never re-decides routing and never invents a recipient.
 *
 * @module @dsh-agent-team/runtime/alpha6/wake-plan
 */
import { routeReview, type ReviewRouteInput } from '../review-router/index.js'

export interface PlannedWake {
  /** The latch/authority identity (Member instance id). */
  readonly reviewerInstanceId: string
  /** The DSH session the inbox belongs to (durable childSessionId). */
  readonly targetSessionId: string
  readonly templateId: string
  readonly routeRole: 'officer' | 'leader'
  readonly currentLegIds: readonly string[]
}

export interface WakePlan {
  readonly wakes: readonly PlannedWake[]
  /** Human targets have no Agent inbox; they are surfaced, never woken. */
  readonly humanLegIds: readonly string[]
  readonly held: readonly { readonly requestId?: string; readonly reason: string }[]
}

export interface WakePlanOptions {
  /** Composition-owned map from Member instance id to its durable DSH session. */
  readonly sessionIdFor: (instanceId: string) => string | undefined
}

export function planReviewWakes(
  inputs: readonly ReviewRouteInput[],
  options: WakePlanOptions,
): WakePlan {
  const byRecipient = new Map<string, { targetSessionId: string; templateId: string; routeRole: 'officer' | 'leader'; ids: string[] }>()
  const human: string[] = []
  const held: { requestId?: string; reason: string }[] = []
  for (const input of inputs) {
    const route = routeReview(input)
    if (route.kind === 'no-work') continue
    if (route.kind === 'hold' || route.kind === 'unroutable') {
      const legId = 'currentLegId' in route ? route.currentLegId : undefined
      held.push({ ...(legId !== undefined ? { requestId: legId } : {}), reason: route.reason })
      continue
    }
    if (route.target.kind === 'native-human') {
      if (route.currentLegId !== undefined) human.push(route.currentLegId)
      continue
    }
    const key = route.target.instanceId
    const targetSessionId = options.sessionIdFor(key)
    if (targetSessionId === undefined) {
      held.push({ ...(route.currentLegId !== undefined ? { requestId: route.currentLegId } : {}), reason: `no durable DSH session for reviewer instance '${key}'` })
      continue
    }
    const group = byRecipient.get(key) ?? {
      targetSessionId,
      templateId: route.target.templateId,
      routeRole: route.target.routeRole,
      ids: [],
    }
    if (route.currentLegId !== undefined) group.ids.push(route.currentLegId)
    byRecipient.set(key, group)
  }
  return {
    wakes: [...byRecipient].map(([reviewerInstanceId, group]) => ({
      reviewerInstanceId,
      targetSessionId: group.targetSessionId,
      templateId: group.templateId,
      routeRole: group.routeRole,
      currentLegIds: group.ids,
    })),
    humanLegIds: human,
    held,
  }
}
