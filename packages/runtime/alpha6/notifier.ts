/**
 * Alpha.6 PR6 — the notifier replacement seam (pure composition).
 *
 * The legacy `ControlRequestNotificationPort` always wakes the LEADER. A6
 * routes an ordinary tool ask to the assigned Officer through the review-wake
 * delivery seam instead. This module composes the two WITHOUT changing the
 * durable ledger: it renders one model-visible hint and hands it to the wake
 * port; the pending list still reads durable state.
 *
 * @module @dsh-agent-team/runtime/alpha6/notifier
 */
import type {
  AssignedOfficerReviewFacts,
  AssignedOfficerReviewFactsQuery,
  ControlRequestNotificationPort,
  ControlRequestRecord,
  ControlSubject,
} from '../control/types.js'
import type { Alpha6CompositionDecision } from './composition.js'

export interface WakeDeliveryPort {
  (input: {
    readonly targetSessionId: string
    readonly wakeId: string
    readonly text: string
  }): Promise<void>
}

function subjectText(subject: ControlSubject): string {
  switch (subject.kind) {
    case 'instance':
      return `instance ${subject.instanceId}`
    case 'template':
      return `template ${subject.templateId}`
    case 'team':
      return `team ${subject.rootSessionId}`
  }
}

/**
 * Render the Officer-facing wake. Deterministic per request; leads with the
 * dedup token; carries no decision and no case payload.
 */
export function renderOfficerReviewWake(request: ControlRequestRecord): string {
  const requester =
    request.requester.kind === 'instance'
      ? request.requester.instanceId
      : `human:${request.requester.humanId}`
  return [
    `[team-review-wake requestId=${request.requestId}]`,
    'A Team member operation is waiting for review.',
    '',
    `requestId: ${request.requestId}`,
    `requester: ${requester}`,
    `subject: ${subjectText(request.subject)}`,
    ...(request.toolName !== undefined ? [`tool: ${request.toolName}`] : []),
    ...(request.summary !== undefined ? [`summary: ${request.summary}`] : []),
    '',
    'Decide with `team_resolve_control` using this EXACT requestId.',
    'Inspect your pending work with `team_list_pending_control`.',
  ].join('\n')
}

/**
 * Compose the legacy Leader notifier and the A6 Officer wake behind ONE port.
 *
 * - `legacy` decision → the legacy notifier is invoked unchanged.
 * - `alpha6` decision → exactly one wake to the resolved Officer session and
 *   NO Leader notification.
 * - A `refused` decision → throw; never the Leader fallback.
 */
export function createComposedControlNotifier(ports: {
  readonly decision: Alpha6CompositionDecision
  readonly legacy: ControlRequestNotificationPort
  readonly wake: WakeDeliveryPort
  readonly recipientSessionId: string
}): ControlRequestNotificationPort {
  return {
    async notifyLeaderRequest(request: ControlRequestRecord): Promise<void> {
      if (ports.decision.mode === 'refused') {
        throw new Error(`Alpha.6 review routing is enabled but refused (${ports.decision.refused}); no Leader fallback`)
      }
      if (ports.decision.mode !== 'alpha6') {
        await ports.legacy.notifyLeaderRequest(request)
        return
      }
      await ports.wake({
        targetSessionId: ports.recipientSessionId,
        wakeId: `review:${request.requestId}`,
        text: renderOfficerReviewWake(request),
      })
    },
  }
}

/** Resolve the CURRENT reviewer for one durable request (the trusted facts port). */
export interface Alpha6NotifierReviewerPort {
  (query: {
    readonly rootSessionId: string
    readonly approvalCaseId: string
    readonly currentLegRequestId: string
    readonly legOrdinal: number
  }): Promise<{ readonly instanceId: string } | null>
}

/**
 * The root-level Alpha.6 notification path: a control request is resolved
 * through the SAME trusted facts port the decision path uses, then delivered
 * to that reviewer's live child session. There is NO Leader fallback:
 * unresolvable reviewer, missing case identity or a delivery failure throws
 * (the service's notification is fire-and-forget/liveness, so throwing cannot
 * change the durable outcome, but it must be visible).
 */
export function createAlpha6RootControlNotifier(ports: {
  readonly rootSessionId: string
  readonly resolveCurrentReviewer: Alpha6NotifierReviewerPort
  readonly memberSession: (instanceId: string) =>
    | { readonly childSessionId?: string }
    | undefined
    | Promise<{ readonly childSessionId?: string } | undefined>
  readonly deliver: WakeDeliveryPort
  /**
   * Optional trusted merge inputs. When BOTH are present, the notifier reads
   * the durable pending legs, keeps only those the SAME facts port proves are
   * delegable to the SAME reviewer, and delivers ONE wake for the group.
   */
  readonly readRequests?: () => Promise<readonly ControlRequestRecord[]>
  readonly reviewFacts?: (
    query: AssignedOfficerReviewFactsQuery,
  ) => Promise<AssignedOfficerReviewFacts | null>
}): ControlRequestNotificationPort {
  return {
    async notifyLeaderRequest(request: ControlRequestRecord): Promise<void> {
      if (request.approvalCaseId === undefined || request.legOrdinal === undefined) {
        throw new Error(
          `Alpha.6 review wake refused: request '${request.requestId}' carries no approval case identity`,
        )
      }
      const reviewer = await ports.resolveCurrentReviewer({
        rootSessionId: ports.rootSessionId,
        approvalCaseId: request.approvalCaseId,
        currentLegRequestId: request.requestId,
        legOrdinal: request.legOrdinal,
      })
      if (reviewer === null) {
        throw new Error(
          `Alpha.6 review wake refused: no trusted current reviewer for request '${request.requestId}' (no Leader fallback)`,
        )
      }
      const member = await ports.memberSession(reviewer.instanceId)
      const targetSessionId = member?.childSessionId
      if (typeof targetSessionId !== 'string' || targetSessionId.length === 0) {
        throw new Error(
          `Alpha.6 review wake refused: reviewer '${reviewer.instanceId}' has no live child session (no Leader fallback)`,
        )
      }

      // MERGE: only legs this SAME facts port proves delegable to the SAME
      // reviewer join the wake. A leg with no case identity, a refused fact,
      // a fixed Leader/Human category or a different reviewer is left out.
      const merged: ControlRequestRecord[] = [request]
      if (ports.readRequests !== undefined && ports.reviewFacts !== undefined) {
        let pending: readonly ControlRequestRecord[]
        try {
          pending = await ports.readRequests()
        } catch {
          pending = []
        }
        for (const candidate of pending) {
          if (candidate.requestId === request.requestId) continue
          if (candidate.status !== 'pending') continue
          if (candidate.kind !== 'leader-approval') continue
          if (candidate.approvalCaseId === undefined || candidate.legOrdinal === undefined) continue
          if (candidate.legOrdinal < 1 || candidate.reviewAuthority === undefined) continue
          let facts: AssignedOfficerReviewFacts | null
          try {
            facts = await ports.reviewFacts({
              rootSessionId: ports.rootSessionId,
              approvalCaseId: candidate.approvalCaseId,
              currentLegRequestId: candidate.requestId,
              legOrdinal: candidate.legOrdinal,
              kind: candidate.kind,
              reviewAuthority: candidate.reviewAuthority,
            })
          } catch {
            continue
          }
          if (facts === null || facts.requiresHuman || facts.fixedLeaderOrHumanCategory) continue
          const candidateReviewer = await ports.resolveCurrentReviewer({
            rootSessionId: ports.rootSessionId,
            approvalCaseId: candidate.approvalCaseId,
            currentLegRequestId: candidate.requestId,
            legOrdinal: candidate.legOrdinal,
          })
          if (candidateReviewer?.instanceId !== reviewer.instanceId) continue
          merged.push(candidate)
        }
      }
      if (merged.length === 1) {
        await ports.deliver({
          targetSessionId,
          wakeId: `review:${request.requestId}`,
          text: renderOfficerReviewWake(request),
        })
        return
      }
      const ids = merged.map((entry) => entry.requestId).sort()
      await ports.deliver({
        targetSessionId,
        wakeId: `review:${ids.join(',')}`,
        text: renderMergedOfficerReviewWake(merged),
      })
    },
  }
}


/** One wake for a group of delegable pending legs; every id stays visible. */
export function renderMergedOfficerReviewWake(requests: readonly ControlRequestRecord[]): string {
  const ids = requests.map((request) => request.requestId).sort()
  return [
    `[team-review-wake requests=${ids.length}]`,
    'Team member operations are waiting for review.',
    '',
    ...ids.map((id) => `requestId: ${id}`),
    '',
    'Decide each with `team_resolve_control` using that EXACT requestId.',
    'Inspect your pending work with `team_list_pending_control`.',
  ].join('\n')
}
