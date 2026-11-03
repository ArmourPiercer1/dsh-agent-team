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
  readonly sessionId: string
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

export function planReviewWakes(inputs: readonly ReviewRouteInput[]): WakePlan {
  const byRecipient = new Map<string, { templateId: string; routeRole: 'officer' | 'leader'; ids: string[] }>()
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
    const group = byRecipient.get(key) ?? {
      templateId: route.target.templateId,
      routeRole: route.target.routeRole,
      ids: [],
    }
    if (route.currentLegId !== undefined) group.ids.push(route.currentLegId)
    byRecipient.set(key, group)
  }
  return {
    wakes: [...byRecipient].map(([sessionId, group]) => ({
      sessionId,
      templateId: group.templateId,
      routeRole: group.routeRole,
      currentLegIds: group.ids,
    })),
    humanLegIds: human,
    held,
  }
}
