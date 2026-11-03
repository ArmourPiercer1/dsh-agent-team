/**
 * Alpha.6 PR2a — the single ReviewCapability evaluator.
 *
 * Positive control: a real legal Operation Case, a real Member reviewer who is
 * the unique current Officer, and the actual OperationOwner (not requester).
 * Negative controls: each independent identity, category, transfer, generation,
 * scope and escalation fact is varied one at a time.
 */
import { describe, expect, it } from 'vitest'
import {
  ReviewCapabilityCandidate,
  decisionCapabilityEvidenceFrom,
  evaluateReviewCapability,
  type ReviewCallFacts,
  type ReviewCapabilityEntry,
  type ReviewCapabilityRefusal,
} from '../review-authority/index.js'
import type { ReviewRouting } from '../../domain/blueprint/src/index.js'

const ROUTING: ReviewRouting = {
  enabled: true,
  officerTemplateId: 'officer',
  ordinaryToolApprovals: {
    default: 'officer',
    leaderExceptions: [{ memberTemplateId: 'member-a', tool: { owner: 'dsh.shell', name: 'bash' } }],
  },
  whenOfficerUnavailable: 'hold',
}

function facts(over: Partial<ReviewCallFacts> = {}): ReviewCallFacts {
  return {
    reviewer: { kind: 'instance', instanceId: 'inst-officer', role: 'member' },
    reviewerMember: { instanceId: 'inst-officer', templateId: 'officer', rootSessionId: 'root-1' },
    requester: { kind: 'instance', instanceId: 'inst-requester', role: 'member' },
    currentOfficer: { instanceId: 'inst-officer', templateId: 'officer', rootSessionId: 'root-1' },
    operationOwner: { rootSessionId: 'root-1', instanceId: 'inst-member-b', templateId: 'member-b' },
    operationTool: { definitionIdentity: 'tool-def-write', owner: 'dsh.fs', name: 'write' },
    currentCase: {
      approvalCaseId: 'case-1',
      currentLegRequestId: 'leg-2',
      legOrdinal: 2,
      kind: 'leader-approval',
      reviewAuthority: 'leader',
      status: 'pending',
      requestedEffect: 'ask',
      operationFingerprint: 'op-1',
      mutationProposalFingerprint: null,
      scopeFingerprint: 'scope-1',
      authorityGeneration: 7,
    },
    operationScope: {
      rootSessionId: 'root-1',
      actionName: 'tool.write',
      toolName: 'write',
      correlation: 'corr-1',
      operationFingerprint: 'op-1',
      authorityScope: { operationClass: 'tool.write', matcher: { kind: 'exact', resource: './out' } },
    },
    scopeFingerprint: 'scope-1',
    effectSetFingerprint: 'effects-1',
    paManifestPresent: true,
    blueprint: { revision: 'r1', contentHash: 'hash-1', reviewRouting: ROUTING },
    currentLegTransfer: null,
    authorityGeneration: 7,
    fixedLeaderOrHumanCategory: false,
    requiresHuman: false,
    escalationSuccessor: 'human-user',
    officerActedOnEarlierLeg: false,
    perEffectRequiredAuthorities: ['leader'],
    ...over,
  }
}

function expectRefusal(entry: ReviewCapabilityEntry, over: Partial<ReviewCallFacts>, code: ReviewCapabilityRefusal): void {
  const result = evaluateReviewCapability(facts(over), entry)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.code).toBe(code)
}

describe('evaluateReviewCapability — delegated Officer path', () => {
  it('mints a blueprint-officer candidate for a legal allow, with the real OperationOwner and case identity', () => {
    const result = evaluateReviewCapability(facts(), 'allow')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.candidate).toBeInstanceOf(ReviewCapabilityCandidate)
    expect(result.candidate.capability).toMatchObject({
      source: 'blueprint-officer',
      entry: 'allow',
      effectiveReviewAuthority: 'leader',
      approvalCaseId: 'case-1',
      currentLegRequestId: 'leg-2',
      legOrdinal: 2,
      blueprintContentHash: 'hash-1',
      operationOwner: { instanceId: 'inst-member-b', templateId: 'member-b' },
      operationTool: { definitionIdentity: 'tool-def-write' },
    })
    expect(decisionCapabilityEvidenceFrom(result.candidate)).toMatchObject({
      source: 'blueprint-officer', entry: 'allow', operationOwnerTemplateId: 'member-b',
    })
  })

  it('allows deny inside the same case-scoped delegation', () => {
    expect(evaluateReviewCapability(facts(), 'deny').ok).toBe(true)
  })

  it('allows escalate only to human-user without an earlier Officer action', () => {
    expect(evaluateReviewCapability(facts(), 'escalate').ok).toBe(true)
    expectRefusal('escalate', { escalationSuccessor: 'leader' }, 'escalation-successor-not-human')
    expectRefusal('escalate', { officerActedOnEarlierLeg: true }, 'officer-acted-on-earlier-leg')
  })

  it('never lets a delegated Officer terminal-close', () => {
    expectRefusal('terminal-close', {}, 'terminal-close-not-delegable')
  })

  it('does not use requester as the OperationOwner', () => {
    expect(evaluateReviewCapability(facts({ requester: { kind: 'instance', instanceId: 'inst-member-a', role: 'member' } }), 'allow').ok).toBe(true)
    expectRefusal('allow', { operationOwner: null }, 'operation-owner-unknown')
  })

  it('refuses Leader exceptions, Officer self-asks and fixed Leader/Human categories', () => {
    expectRefusal('allow', {
      operationOwner: { rootSessionId: 'root-1', instanceId: 'inst-member-a', templateId: 'member-a' },
      operationTool: { definitionIdentity: 'tool-def-bash', owner: 'dsh.shell', name: 'bash' },
    }, 'leader-exception')
    expectRefusal('allow', {
      operationOwner: { rootSessionId: 'root-1', instanceId: 'inst-officer', templateId: 'officer' },
    }, 'operation-owner-is-officer')
    expectRefusal('allow', { fixedLeaderOrHumanCategory: true }, 'fixed-leader-or-human-category')
    expectRefusal('allow', { requiresHuman: true }, 'requires-human')
  })

  it('refuses non-ordinary cases: user-approval, envelope mutation, mutation fingerprint and missing effect', () => {
    expectRefusal('allow', { currentCase: { ...facts().currentCase, kind: 'user-approval' } }, 'not-ordinary-ask')
    expectRefusal('allow', { currentCase: { ...facts().currentCase, kind: 'envelope-mutation' } }, 'not-ordinary-ask')
    expectRefusal('allow', { currentCase: { ...facts().currentCase, mutationProposalFingerprint: 'mut-1' } }, 'not-ordinary-ask')
    expectRefusal('allow', { currentCase: { ...facts().currentCase, requestedEffect: undefined as never } }, 'not-ordinary-ask')
    expectRefusal('allow', { currentCase: { ...facts().currentCase, reviewAuthority: 'member' } }, 'leg-not-leader-rung')
    expectRefusal('allow', { currentCase: { ...facts().currentCase, status: 'decided' } }, 'case-not-pending')
  })

  it('refuses a reviewer who is not the unique current Officer', () => {
    expectRefusal('allow', {
      reviewer: { kind: 'instance', instanceId: 'inst-other', role: 'member' },
      reviewerMember: { instanceId: 'inst-other', templateId: 'officer', rootSessionId: 'root-1' },
    }, 'reviewer-not-current-officer')
    expectRefusal('allow', { reviewerMember: { instanceId: 'inst-officer', templateId: 'member', rootSessionId: 'root-1' } }, 'officer-template-mismatch')
    expectRefusal('allow', { reviewerMember: { instanceId: 'inst-officer', templateId: 'officer', rootSessionId: 'other-root' } }, 'reviewer-not-current-officer')
    expectRefusal('allow', { reviewer: { kind: 'instance', instanceId: 'inst-member-b', role: 'member' } }, 'reviewer-not-current-officer')
  })

  it('refuses transfers, absent routing, mismatched blueprint/scope/generation/effect-set', () => {
    expectRefusal('allow', { currentLegTransfer: { target: 'leader', actor: 'officer' } }, 'transfer-overrides-delegation')
    expectRefusal('allow', { blueprint: { revision: 'r1', contentHash: 'hash-1' } }, 'blueprint-routing-absent')
    expectRefusal('allow', { currentCase: { ...facts().currentCase, scopeFingerprint: 'other' } }, 'scope-mismatch')
    expectRefusal('allow', { authorityGeneration: 8 }, 'authority-generation-mismatch')
    expectRefusal('allow', { effectSetFingerprint: undefined }, 'effect-set-mismatch')
    expectRefusal('allow', { effectSetFingerprint: '' }, 'effect-set-mismatch')
    expectRefusal('allow', { operationOwner: null }, 'operation-owner-unknown')
    expectRefusal('allow', { operationTool: null }, 'operation-tool-unknown')
  })

  it('keeps Leader/Human native path distinct from blueprint-officer', () => {
    const leader = evaluateReviewCapability(facts({ reviewer: { kind: 'instance', instanceId: 'inst-leader', role: 'leader' } }), 'allow')
    expect(leader.ok).toBe(true)
    if (leader.ok) expect(leader.candidate.capability.source).toBe('native')
    const human = evaluateReviewCapability(facts({ reviewer: { kind: 'human', humanId: 'human-1' } }), 'allow')
    expect(human.ok).toBe(true)
    if (human.ok) expect(human.candidate.capability.source).toBe('native')
  })
})
