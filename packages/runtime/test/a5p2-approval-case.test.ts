/**
 * a5p2-approval-case.test.ts — Alpha.5 PR2 (plan §5): the multi-effect Ask
 * rides the ONE logical Alpha.4 ApprovalCase, and EVERY effect independently
 * checks the reviewer's position AND the envelope coverage — the max-rank
 * shortcut is the named anti-pattern ("不用简单取最大 rank 代替合法性"), and
 * a request containing a determined-deny or undetermined effect must never be
 * approved at all.
 *
 * @module test/a5p2-approval-case
 */
import { describe, expect, it } from 'vitest'
import {
  evaluateEffectSetExpansion,
  planEffectSetApproval,
  toolAskApprovalCaseId,
  verifyEffectSetApproval,
  type PresentedApproval,
} from '../tool-admission/approval-case.js'
import { effects, MEMBER, policyDoc, readEffect, scopeResource, writeEffect, REALM } from './a5p2-fixtures.js'
import { emptyHardDocs, hardRulesDocs, mutationRulesDocs } from './a5p2-kernel-harness.js'

const A = readEffect('data/a.txt')
const B = writeEffect('data/b.txt')

function plan(set: ReturnType<typeof effects>, docs = emptyHardDocs(), extra: Record<string, unknown> = {}) {
  const expansion = evaluateEffectSetExpansion(set, REALM, { rules: [] })
  return planEffectSetApproval({
    effects: set,
    needApproval: expansion.needsApproval,
    realmId: REALM,
    beneficiaryAuthority: 'member',
    documents: docs,
    authorityGeneration: 1,
    teamSessionId: MEMBER.teamSessionId,
    instanceId: MEMBER.instanceId,
    ...extra,
  })
}

describe('expansion plane over the WHOLE effect set', () => {
  it('no rule matches anywhere ⇒ every effect needs the Ask (absence is not denial)', () => {
    const r = evaluateEffectSetExpansion(effects(A, B), REALM, { rules: [] })
    expect(r.unapprovable).toBeNull()
    expect(r.needsApproval).toEqual([0, 1])
    expect(r.allowed).toEqual([])
  })

  it('a decided-DENY effect poisons the whole set (a case never opens for a Team deny)', () => {
    const doc = policyDoc([{ effectKind: 'write', resource: scopeResource(B), maximumEffect: 'deny' }])
    const r = evaluateEffectSetExpansion(effects(A, B), REALM, doc)
    expect(r.unapprovable).not.toBeNull()
    expect(r.unapprovable?.plane).toBe('expansion')
    expect(r.unapprovable?.effectIndex).toBe(1)
    expect(r.unapprovable?.detail).toContain('DENY')
  })

  it('an allow rule makes THAT effect directly authorized; mixed sets split cleanly', () => {
    const doc = policyDoc([{ effectKind: 'read', resource: scopeResource(A), maximumEffect: 'allow' }])
    const r = evaluateEffectSetExpansion(effects(A, B), REALM, doc)
    expect(r.allowed).toEqual([0])
    expect(r.needsApproval).toEqual([1])
    expect(r.unapprovable).toBeNull()
  })

  it('a subtree rule without the filesystem truth is undetermined — and undetermined poisons too', () => {
    const doc = policyDoc([{ effectKind: 'read', resource: 'realm-a|data', maximumEffect: 'allow', matcherKind: 'subtree' }])
    const r = evaluateEffectSetExpansion(effects(A), REALM, doc)
    expect(r.unapprovable).not.toBeNull()
    expect(r.unapprovable?.detail).toContain('undetermined')
  })
})

describe('the ONE case plan: per-effect rungs, batched at the highest', () => {
  it('plain member ask with an empty hard ceiling opens at Leader (Alpha.4 §7.4.1 first case)', () => {
    const r = plan(effects(A, B))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.requiredAuthority).toBe('leader')
      expect(r.value.perEffectRequired[0]).toBe('leader')
      expect(r.value.perEffectRequired[1]).toBe('leader')
    }
  })

  it('a Leader-bound `ask` rule raises ONLY the covered effect, and the case opens at the highest rung (A5-1: it binds the Leader alone)', () => {
    const docs = mutationRulesDocs([{ operationClass: 'write', resource: scopeResource(B), maximumEffect: 'ask' }])
    const r = plan(effects(A, B), docs)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.perEffectRequired[0]).toBe('leader')
      expect(r.value.perEffectRequired[1]).toBe('human-user')
      expect(r.value.requiredAuthority).toBe('human-user')
    }
  })

  it('a hard envelope that reaches the effect raises it to Human Admin (hard rules bind every bounded rung)', () => {
    const docs = hardRulesDocs([{ operationClass: 'read', resource: scopeResource(A), maximumEffect: 'ask' }])
    const r = plan(effects(A), docs)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.requiredAuthority).toBe('human-admin')
  })

  it('an undetermined approval scope refuses the WHOLE plan — no case without a requiredAuthority (A1-7)', () => {
    const docs = hardRulesDocs([{ operationClass: 'read', resource: scopeResource(A), maximumEffect: 'ask' }])
    // The plan itself: pass a subtree rule through the mutation envelope so
    // the walk asks containment it cannot answer (no subtreeContains given).
    const undeterminableDocs = {
      teamHardEnvelope: { status: 'absent' as const },
      permissionMutationEnvelope: {
        rules: [{ operationClass: 'read', matcher: { kind: 'subtree' as const, resource: 'realm-a|data' }, maximumEffect: 'allow' as const }],
      },
    }
    const r = plan(effects(A), undeterminableDocs, { documents: undeterminableDocs })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.unapprovable.detail).toContain('undetermined')
    // sanity: the same call under decidable docs still plans
    expect(plan(effects(A), docs).ok).toBe(true)
  })

  it('a Human Admin ask has no upper rung — a defect refusal, never a silent case', () => {
    const r = planEffectSetApproval({
      effects: effects(A),
      needApproval: [0],
      realmId: REALM,
      beneficiaryAuthority: 'human-admin',
      documents: emptyHardDocs(),
      authorityGeneration: 1,
      teamSessionId: MEMBER.teamSessionId,
      instanceId: MEMBER.instanceId,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.unapprovable.detail).toContain('defective')
  })

  it('case identity binds the effect-set fingerprint + generation, never a callId', () => {
    const set = effects(A, B)
    const id1 = toolAskApprovalCaseId({ teamSessionId: MEMBER.teamSessionId, instanceId: MEMBER.instanceId, effectSetFingerprint: set.fingerprint, authorityGeneration: 1 })
    const id2 = toolAskApprovalCaseId({ teamSessionId: MEMBER.teamSessionId, instanceId: MEMBER.instanceId, effectSetFingerprint: set.fingerprint, authorityGeneration: 1 })
    const idGen2 = toolAskApprovalCaseId({ teamSessionId: MEMBER.teamSessionId, instanceId: MEMBER.instanceId, effectSetFingerprint: set.fingerprint, authorityGeneration: 2 })
    expect(id1).toBe(id2)
    expect(id1).not.toBe(idGen2)
    expect(id1).toContain(set.fingerprint)
  })
})

describe('execution-boundary legality: per effect, all-or-nothing', () => {
  const docsAskOnB = mutationRulesDocs([{ operationClass: 'write', resource: scopeResource(B), maximumEffect: 'ask' }])
  const bothSet = effects(A, B)

  it('a leader-leg approval that only covers effect 0 refuses the WHOLE execution (no partial run)', () => {
    const presentation = {
      approvalCaseId: 'case-1',
      reviewerAuthority: 'leader' as const,
      beneficiaryAuthority: 'member' as const,
      requiredAuthorityAtCreation: 'leader' as const,
      effectSetFingerprint: bothSet.fingerprint,
      authorityGenerationAtCreation: 1,
    }
    // effect 0 ALONE is legal under this reviewer (its own fingerprint set)…
    const alonePresentation = { ...presentation, effectSetFingerprint: effects(A).fingerprint }
    const alone = verifyEffectSetApproval({ effects: effects(A), realmId: REALM, approval: alonePresentation, currentAuthorityGeneration: 1, documents: docsAskOnB })
    expect(alone.ok).toBe(true)
    // …but as part of the approved SET the uncovered effect 1 refuses ALL.
    const whole = verifyEffectSetApproval({ effects: bothSet, realmId: REALM, approval: presentation, currentAuthorityGeneration: 1, documents: docsAskOnB })
    expect(whole.ok).toBe(false)
    if (!whole.ok) {
      expect(whole.error.code).toBe('APPROVAL_STALE')
      expect(whole.error.message).toContain('effect 1')
    }
  })

  it('the correctly-required rung (human-user) legally covers BOTH effects', () => {
    const r = verifyEffectSetApproval({
      effects: bothSet,
      realmId: REALM,
      approval: {
        approvalCaseId: 'case-2',
        reviewerAuthority: 'human-user',
        beneficiaryAuthority: 'member',
        requiredAuthorityAtCreation: 'human-user',
        effectSetFingerprint: bothSet.fingerprint,
        authorityGenerationAtCreation: 1,
      },
      currentAuthorityGeneration: 1,
      documents: docsAskOnB,
    })
    expect(r.ok).toBe(true)
  })

  it('self-approval is refused (reviewer must be STRICTLY above the beneficiary)', () => {
    const r = verifyEffectSetApproval({
      effects: effects(A),
      realmId: REALM,
      approval: {
        approvalCaseId: 'case-3',
        reviewerAuthority: 'member',
        beneficiaryAuthority: 'member',
        requiredAuthorityAtCreation: 'leader',
        effectSetFingerprint: effects(A).fingerprint,
        authorityGenerationAtCreation: 1,
      },
      currentAuthorityGeneration: 1,
      documents: emptyHardDocs(),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message).toContain('may not review')
  })

  it('old leg escalated ⇒ the old reviewer cannot allow (current rung is RECOMPUTED)', () => {
    const set = effects(A)
    // Approved while the ladder answered `leader`…
    const presentation = {
      approvalCaseId: 'case-4',
      reviewerAuthority: 'leader' as const,
      beneficiaryAuthority: 'member' as const,
      requiredAuthorityAtCreation: 'leader' as const,
      effectSetFingerprint: set.fingerprint,
      authorityGenerationAtCreation: 1,
    }
    expect(verifyEffectSetApproval({ effects: set, realmId: REALM, approval: presentation, currentAuthorityGeneration: 1, documents: emptyHardDocs() }).ok).toBe(true)
    // …then the hard envelope GREW an `ask` rule over the same scope (a
    // permission change between approval and dispatch).
    const hardened = hardRulesDocs([{ operationClass: 'read', resource: scopeResource(A), maximumEffect: 'ask' }])
    const r = verifyEffectSetApproval({ effects: set, realmId: REALM, approval: presentation, currentAuthorityGeneration: 1, documents: hardened })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message).toContain('required rung rose')
  })

  it('an approval for a DIFFERENT effect set never covers this call', () => {
    const other = effects(A)
    const r = verifyEffectSetApproval({
      effects: bothSet,
      realmId: REALM,
      approval: {
        approvalCaseId: 'case-5',
        reviewerAuthority: 'human-user',
        beneficiaryAuthority: 'member',
        requiredAuthorityAtCreation: 'human-user',
        effectSetFingerprint: other.fingerprint,
        authorityGenerationAtCreation: 1,
      },
      currentAuthorityGeneration: 1,
      documents: emptyHardDocs(),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message).toContain('WHOLE set')
  })

  it('a generation move between approval and dispatch is stale — no auto-trim, no retry', () => {
    const r = verifyEffectSetApproval({
      effects: effects(A),
      realmId: REALM,
      approval: {
        approvalCaseId: 'case-6',
        reviewerAuthority: 'leader',
        beneficiaryAuthority: 'member',
        requiredAuthorityAtCreation: 'leader',
        effectSetFingerprint: effects(A).fingerprint,
        authorityGenerationAtCreation: 1,
      },
      currentAuthorityGeneration: 2,
      documents: emptyHardDocs(),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message).toContain('authority generation moved')
  })

  it('an unreadable bound document at execution reads as STALE, never as legal', () => {
    const set = effects(A)
    const r = verifyEffectSetApproval({
      effects: set,
      realmId: REALM,
      approval: {
        approvalCaseId: 'case-7',
        reviewerAuthority: 'leader',
        beneficiaryAuthority: 'member',
        requiredAuthorityAtCreation: 'leader',
        effectSetFingerprint: set.fingerprint,
        authorityGenerationAtCreation: 1,
      },
      currentAuthorityGeneration: 1,
      documents: { teamHardEnvelope: { status: 'unavailable' }, permissionMutationEnvelope: { status: 'absent' } },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('APPROVAL_STALE')
  })
})

describe('the execution-leg isolation: documents-derived ceiling walk vs reviewer position (review F-2, labelled per delta D-2/D-4)', () => {
  // WHAT THIS ISOLATES: the DOCUMENTS-derived ceiling-walk arm — the refusal
  // this test emits is the walk's 'effect N … is undetermined at execution
  // time' message, reached when a subtree envelope cannot answer containment.
  // The `grantCeiling` coverage arm further down the same function is
  // documented-unreachable-by-monotonicity defense-in-depth: positional
  // binding means a higher rung is bound by FEWER documents, so passing the
  // rung leg already implies the reviewer's own ceiling reaches. Anchor for
  // that claim (this file cannot keep a probe): the independent 14,544-input
  // full-space sweep in review-PR2-delta.md §4 — arms fired: mayReview@creation
  // 5859, ACCEPTED 5651, rung-escalated 1882, walk-undetermined 1152,
  // grantCeiling coverage 0.
  // SAME approval, SAME documents — only the containment seam differs. The
  // refusal rides the documents half-leg; the rung half-leg is then either
  // irrelevant (never evaluated) or, on the seam-true leg, demonstrably
  // passed (verify returns ok only if BOTH half-legs passed).
  it('an unanswerable containment at execution refuses on the envelope leg; the seam alone legalizes the same presentation', () => {
    const set = effects(A)
    const docs = {
      teamHardEnvelope: { rules: [{ operationClass: 'read', matcher: { kind: 'subtree' as const, resource: 'realm-a|data' }, maximumEffect: 'allow' as const }] },
      permissionMutationEnvelope: { status: 'absent' as const },
    }
    const approval: PresentedApproval = {
      approvalCaseId: toolAskApprovalCaseId({ ...MEMBER, effectSetFingerprint: set.fingerprint, authorityGeneration: 1 }),
      reviewerAuthority: 'leader',
      beneficiaryAuthority: 'member',
      requiredAuthorityAtCreation: 'leader',
      effectSetFingerprint: set.fingerprint,
      authorityGenerationAtCreation: 1,
    }
    const blind = verifyEffectSetApproval({ effects: set, realmId: REALM, approval, currentAuthorityGeneration: 1, documents: docs })
    expect(blind.ok).toBe(false)
    if (!blind.ok) {
      const detail = String(blind.error.details?.detail ?? '')
      expect(detail).toContain('undetermined at execution') // the envelope-coverage arm
      expect(detail).not.toContain('may not review') // NOT the rung arm…
      expect(detail).not.toContain('required rung rose') // …and NOT the escalation arm
    }
    const seen = verifyEffectSetApproval({
      effects: set,
      realmId: REALM,
      approval,
      currentAuthorityGeneration: 1,
      documents: docs,
      subtreeContains: (root, child) => child.startsWith(root),
    })
    expect(seen.ok).toBe(true) // rung unchanged, documents unchanged: containment answered ⇒ both half-legs pass
  })
})
