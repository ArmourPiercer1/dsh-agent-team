/**
 * Alpha.6 PR1 — shared ordinary-ask predicate and deterministic router.
 *
 * The positive control is a REAL legal Operation Case shape: `requestedEffect`
 * present, `operationFingerprint` present, `mutationProposalFingerprint`
 * absent, `authorityScope` present. The missing-effect negative exists only
 * to prove the old P0 cannot return.
 */
import { describe, expect, it } from 'vitest'
import {
  blueprintReviewPolicyFrom,
  isDelegableOrdinaryToolAsk,
  routeReview,
  type BlueprintReviewPolicy,
  type CurrentOfficer,
  type OrdinaryToolAskFacts,
  type ReviewLeaderTarget,
  type ReviewRouteInput,
} from '../review-router/index.js'
import type { ReviewRouting } from '../../domain/blueprint/src/index.js'

const LEADER: ReviewLeaderTarget = { instanceId: 'inst-leader', templateId: 'leader' }
const OFFICER: CurrentOfficer = { status: 'active', instanceId: 'inst-officer', templateId: 'officer' }

const ROUTING: ReviewRouting = {
  enabled: true,
  officerTemplateId: 'officer',
  ordinaryToolApprovals: {
    default: 'officer',
    leaderExceptions: [{ memberTemplateId: 'member-a', tool: { owner: 'dsh.shell', name: 'bash' } }],
  },
  whenOfficerUnavailable: 'hold',
}

const POLICY: BlueprintReviewPolicy = blueprintReviewPolicyFrom(ROUTING) as BlueprintReviewPolicy

const LEGAL_FACTS: OrdinaryToolAskFacts = {
  kind: 'leader-approval',
  reviewAuthority: 'leader',
  requestedEffect: 'ask',
  operationFingerprint: 'op-123',
  mutationProposalFingerprint: null,
  authorityScope: { kind: 'exact', path: './out' },
  operationTool: { owner: 'dsh.fs', name: 'write' },
  perEffectRequiredAuthorities: ['leader'],
  fixedLeaderOrHumanCategory: false,
}

function input(over: Partial<ReviewRouteInput> = {}): ReviewRouteInput {
  return {
    policy: POLICY,
    currentLeg: {
      requestId: 'req-1',
      status: 'pending',
      kind: 'leader-approval',
      reviewAuthority: 'leader',
      operationOwnerTemplateId: 'member-b',
      ordinaryAsk: LEGAL_FACTS,
      requiresHuman: false,
      hasLegalResolver: true,
      fixedLeaderCategory: false,
    },
    currentOfficer: OFFICER,
    leader: LEADER,
    transfer: null,
    ...over,
  }
}

describe('isDelegableOrdinaryToolAsk — the frozen Operation Case set', () => {
  it('accepts a real legal Operation Case with requestedEffect, operationFingerprint and authorityScope', () => {
    expect(isDelegableOrdinaryToolAsk(LEGAL_FACTS)).toBe(true)
  })

  it('refuses missing requestedEffect (the old P0 formulation cannot pass)', () => {
    expect(isDelegableOrdinaryToolAsk({ ...LEGAL_FACTS, requestedEffect: undefined as never })).toBe(false)
  })

  it('refuses mutation cases, missing operation fingerprints/scopes, Human rungs and fixed categories', () => {
    expect(isDelegableOrdinaryToolAsk({ ...LEGAL_FACTS, mutationProposalFingerprint: 'mut-1' })).toBe(false)
    expect(isDelegableOrdinaryToolAsk({ ...LEGAL_FACTS, operationFingerprint: null })).toBe(false)
    expect(isDelegableOrdinaryToolAsk({ ...LEGAL_FACTS, authorityScope: null })).toBe(false)
    expect(isDelegableOrdinaryToolAsk({ ...LEGAL_FACTS, perEffectRequiredAuthorities: ['human-user'] })).toBe(false)
    expect(isDelegableOrdinaryToolAsk({ ...LEGAL_FACTS, fixedLeaderOrHumanCategory: true })).toBe(false)
    expect(isDelegableOrdinaryToolAsk({ ...LEGAL_FACTS, kind: 'user-approval' })).toBe(false)
    expect(isDelegableOrdinaryToolAsk({ ...LEGAL_FACTS, operationTool: null })).toBe(false)
    expect(isDelegableOrdinaryToolAsk({ ...LEGAL_FACTS, perEffectRequiredAuthorities: [] })).toBe(false)
  })
})

describe('routeReview — frozen §3.2 priority', () => {
  it('no pending leg -> no-work', () => {
    expect(routeReview(input({ currentLeg: null }))).toEqual({ kind: 'no-work' })
    expect(routeReview(input({ currentLeg: { ...input().currentLeg!, status: 'decided' } }))).toEqual({ kind: 'no-work' })
  })

  it('Human-required and fixed-Leader categories never go to the Officer', () => {
    expect(routeReview(input({ currentLeg: { ...input().currentLeg!, requiresHuman: true } }))).toMatchObject({
      kind: 'recipient', target: { kind: 'native-human' },
    })
    expect(routeReview(input({ currentLeg: { ...input().currentLeg!, fixedLeaderCategory: true } }))).toMatchObject({
      kind: 'recipient', target: { kind: 'instance', routeRole: 'leader' },
    })
  })

  it('an explicit current-leg transfer wins before self-ask/exception', () => {
    expect(routeReview(input({ transfer: { target: 'leader', actor: 'officer' } }))).toMatchObject({
      kind: 'recipient', target: { kind: 'instance', routeRole: 'leader' },
    })
  })

  it('the actual OperationOwner being the Officer routes to Leader (self-ask)', () => {
    expect(routeReview(input({ currentLeg: { ...input().currentLeg!, operationOwnerTemplateId: 'officer' } }))).toMatchObject({
      kind: 'recipient', target: { kind: 'instance', routeRole: 'leader' },
    })
  })

  it('a trusted MemberTemplate × Tool Leader exception routes to Leader', () => {
    expect(routeReview(input({
      currentLeg: {
        ...input().currentLeg!,
        operationOwnerTemplateId: 'member-a',
        ordinaryAsk: { ...LEGAL_FACTS, operationTool: { owner: 'dsh.shell', name: 'bash' } },
      },
    }))).toMatchObject({
      kind: 'recipient', target: { kind: 'instance', routeRole: 'leader' },
    })
  })

  it('the ordinary case routes to the unique active Officer', () => {
    expect(routeReview(input())).toMatchObject({
      kind: 'recipient',
      target: { kind: 'instance', instanceId: 'inst-officer', templateId: 'officer', routeRole: 'officer' },
    })
  })

  it('Officer unavailable with admission history follows the Blueprint hold/leader policy', () => {
    const hold = routeReview(input({ currentOfficer: { status: 'archived', hasAdmissionHistory: true } }))
    expect(hold).toMatchObject({ kind: 'hold', holdReason: 'officer-availability-unconfirmed' })
    const leaderPolicy = blueprintReviewPolicyFrom({ ...ROUTING, whenOfficerUnavailable: 'leader' }) as BlueprintReviewPolicy
    expect(routeReview(input({ policy: leaderPolicy, currentOfficer: { status: 'disposed', hasAdmissionHistory: true } }))).toMatchObject({
      kind: 'recipient', target: { kind: 'instance', routeRole: 'leader' },
    })
  })

  it('missing admission history, ambiguous and unconfirmed Officer states hold; never guess', () => {
    expect(routeReview(input({ currentOfficer: { status: 'missing', hasAdmissionHistory: false } }))).toMatchObject({
      kind: 'hold', holdReason: 'officer-not-admitted',
    })
    expect(routeReview(input({ currentOfficer: { status: 'ambiguous', activeCount: 2 } }))).toMatchObject({
      kind: 'hold', holdReason: 'officer-ambiguous',
    })
    expect(routeReview(input({ currentOfficer: { status: 'unconfirmed', reason: 'process exited' } }))).toMatchObject({
      kind: 'hold', holdReason: 'officer-availability-unconfirmed',
    })
  })

  it('a mismatched active Officer template is a config hold, not a delegation', () => {
    expect(routeReview(input({ currentOfficer: { status: 'active', instanceId: 'inst-x', templateId: 'other' } }))).toMatchObject({
      kind: 'hold', holdReason: 'config-invalid',
    })
  })

  it('no policy and non-delegable legs fail closed', () => {
    expect(routeReview(input({ policy: null }))).toMatchObject({ kind: 'hold', holdReason: 'config-invalid' })
    expect(routeReview(input({ currentLeg: { ...input().currentLeg!, ordinaryAsk: { ...LEGAL_FACTS, kind: 'user-approval' } } }))).toMatchObject({
      kind: 'unroutable',
    })
  })
})
