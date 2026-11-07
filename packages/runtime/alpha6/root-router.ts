/**
 * Alpha.6 — the ROOT-side trusted router input builder.
 *
 * The notification layer must never equate "the unique live Officer" with
 * "the reviewer of this leg". Leader exceptions, Officer self-asks, fixed
 * Leader/Human categories, current-leg transfers and availability states are
 * all decided by the ONE shared `routeReview` policy. This module turns the
 * durable Control row + live member rows into that policy's input; it decides
 * nothing itself.
 *
 * @module packages/runtime/alpha6/root-router
 */
import type { ReviewRouting } from '../../domain/blueprint/src/index.js'
import type {
  ControlRequestRecord,
  ControlStateSnapshot,
  CurrentLegTransferRecord,
} from '../control/types.js'
import { hasAuthorityResolver } from '../control/types.js'
import { blueprintReviewPolicyFrom, routeReview } from '../review-router/index.js'
import type {
  CurrentOfficer,
  ReviewLeaderTarget,
  ReviewLegFacts,
  ReviewRoute,
  ReviewRouteInput,
} from '../review-router/index.js'
import type { AssignedOfficerMemberSnapshot } from './assigned-officer-facts.js'

export interface Alpha6RootRouting {
  readonly routing: ReviewRouting
  readonly leaderTemplateId: string
}

export interface Alpha6RootRouterInput {
  readonly rootSessionId: string
  readonly routing: ReviewRouting
  readonly leaderTemplateId: string
  /**
   * The frozen v5 policy of a CREATED team root. Null refuses that root: the
   * boot policy is never reused for a root whose own Blueprint cannot be
   * resolved. Absent preserves the single-root/test composition.
   */
  readonly routingForRoot?: (rootSessionId: string) => Alpha6RootRouting | null
  readonly control: {
    readonly readControlState: (rootSessionId: string) => Promise<ControlStateSnapshot>
  }
  readonly members: {
    readonly list: (
      rootSessionId: string,
    ) => Promise<readonly AssignedOfficerMemberSnapshot[]> | readonly AssignedOfficerMemberSnapshot[]
  }
  readonly fixedLeaderOrHumanCategory: (input: {
    readonly kind: ControlRequestRecord['kind']
    readonly rootSessionId?: string
    readonly routing?: ReviewRouting
  }) => boolean | null | Promise<boolean | null>
}

export interface Alpha6RootRouter {
  /**
   * Route ONE durable leg; null when the row is absent/not a case leg.
   * `rootSessionId` is the REQUEST's team root (a created team may differ
   * from the boot root this composition was constructed under).
   */
  readonly route: (requestId: string, rootSessionId?: string) => Promise<ReviewRoute | null>
}

function authorityScopeOf(row: ControlRequestRecord): unknown {
  const payload = row.reviewPayload
  if (payload === null || typeof payload !== 'object') return null
  const scope = (payload as Record<string, unknown>)['authorityScope']
  return scope === undefined ? null : scope
}

function transferOf(
  transfer: CurrentLegTransferRecord | undefined,
): ReviewRouteInput['transfer'] {
  if (transfer === undefined) return null
  return transfer.target === 'leader'
    ? { target: 'leader', actor: transfer.actor.kind === 'officer' ? 'officer' : 'trusted-team-runtime' }
    : { target: 'native-human', actor: 'trusted-team-runtime' }
}

function leaderTargetOf(
  members: readonly AssignedOfficerMemberSnapshot[],
  leaderTemplateId: string,
): ReviewLeaderTarget | null {
  // The production Leader row is the contracts-v2 LeaderInstanceRecord: it
  // has NO lifecycle and NO childSessionId (fresh-root.ts mints it that way).
  // Identity is template + instance, and an EXPLICIT terminal lifecycle is the
  // only thing that disqualifies it. Requiring RUNNING here made every Leader
  // route degrade to hold('leader-unavailable') on a real boot.
  const leader = members.find(
    (member) =>
      member.templateId === leaderTemplateId &&
      typeof member.instanceId === 'string' &&
      member.instanceId.length > 0 &&
      member.lifecycle !== 'ARCHIVED' &&
      member.lifecycle !== 'DISPOSED',
  )
  return leader === undefined
    ? null
    : { instanceId: leader.instanceId, templateId: leader.templateId }
}

function officerStateOf(
  members: readonly AssignedOfficerMemberSnapshot[],
  officerTemplateId: string,
  leaderTemplateId: string,
): CurrentOfficer {
  const candidates = members.filter(
    (member) =>
      member.templateId === officerTemplateId &&
      member.childSessionId !== undefined &&
      member.templateId !== leaderTemplateId,
  )
  // CREATED / RUNNING / SETTLED are all live member states; SETTLED is the
  // normal idle state of an Officer between asks. Requiring RUNNING here made
  // every real idle Officer invisible and held every route.
  const active = candidates.filter(
    (member) =>
      member.lifecycle === 'CREATED' ||
      member.lifecycle === 'RUNNING' ||
      member.lifecycle === 'SETTLED',
  )
  if (active.length === 1) {
    const officer = active[0]!
    return {
      status: 'active',
      instanceId: officer.instanceId,
      templateId: officer.templateId,
    }
  }
  if (active.length > 1) return { status: 'ambiguous', activeCount: active.length }
  if (candidates.length === 0) return { status: 'not-admitted' }
  return {
    status: 'missing',
    hasAdmissionHistory: candidates.some(
      (member) => member.lifecycle === 'ARCHIVED' || member.lifecycle === 'DISPOSED',
    ),
  }
}

function legFactsOf(
  row: ControlRequestRecord,
  fixedLeaderOrHumanCategory: boolean | null,
): ReviewLegFacts {
  const reviewAuthority = row.reviewAuthority
  const category = fixedLeaderOrHumanCategory
  const authorityScope = authorityScopeOf(row)
  return {
    requestId: row.requestId,
    status: row.status,
    kind: row.kind,
    reviewAuthority: reviewAuthority ?? 'member',
    operationOwnerTemplateId: row.operationOwnerTemplateId ?? null,
    ordinaryAsk:
      row.kind === 'leader-approval' &&
      reviewAuthority === 'leader' &&
      row.requestedEffect !== undefined &&
      row.operationToolOwner !== undefined &&
      row.operationToolName !== undefined &&
      authorityScope !== null
        ? {
            kind: row.kind,
            reviewAuthority,
            requestedEffect: row.requestedEffect,
            operationFingerprint: row.operationFingerprint ?? null,
            mutationProposalFingerprint: row.mutationProposalFingerprint ?? null,
            authorityScope,
            operationTool: {
              owner: row.operationToolOwner,
              name: row.operationToolName,
            },
            perEffectRequiredAuthorities: row.perEffectRequiredAuthorities ?? [],
            fixedLeaderOrHumanCategory: category === true,
          }
        : null,
    requiresHuman: reviewAuthority === 'human-user',
    hasLegalResolver: reviewAuthority !== undefined && hasAuthorityResolver(reviewAuthority),
    fixedLeaderCategory: category === true,
  }
}

export function createAlpha6RootRouter(input: Alpha6RootRouterInput): Alpha6RootRouter {
  return {
    async route(requestId: string, rootSessionId?: string): Promise<ReviewRoute | null> {
      const rootSessionIdForRead = rootSessionId ?? input.rootSessionId
      const rootRouting = input.routingForRoot === undefined
        ? { routing: input.routing, leaderTemplateId: input.leaderTemplateId }
        : input.routingForRoot(rootSessionIdForRead)
      if (rootRouting === null) {
        return {
          kind: 'hold',
          holdReason: 'config-invalid',
          reason: `no frozen v5 review routing is resolvable for root '${rootSessionIdForRead}'`,
          currentLegId: requestId,
        }
      }
      const policy = blueprintReviewPolicyFrom(rootRouting.routing)
      let state: ControlStateSnapshot
      try {
        state = await input.control.readControlState(rootSessionIdForRead)
      } catch {
        return null
      }
      const row = state.requests.find((candidate) => candidate.requestId === requestId)
      if (row === undefined || row.approvalCaseId === undefined || row.legOrdinal === undefined) {
        return null
      }
      const members = await input.members.list(rootSessionIdForRead)
      const categoryAnswer = await input.fixedLeaderOrHumanCategory({
        kind: row.kind,
        rootSessionId: rootSessionIdForRead,
        routing: rootRouting.routing,
      })
      const category = categoryAnswer === true ? true : categoryAnswer === false ? false : null
      const currentLeg = legFactsOf(row, category)
      const transfer = transferOf(
        state.transfers.find((candidate) => candidate.currentLegRequestId === requestId),
      )
      return routeReview({
        policy,
        currentLeg,
        currentOfficer: officerStateOf(members, rootRouting.routing.officerTemplateId, rootRouting.leaderTemplateId),
        leader: leaderTargetOf(members, rootRouting.leaderTemplateId),
        transfer,
      })
    },
  }
}

export type { ReviewRoute }
