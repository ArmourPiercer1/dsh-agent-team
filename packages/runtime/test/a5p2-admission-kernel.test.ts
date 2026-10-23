/**
 * a5p2-admission-kernel.test.ts — Alpha.5 PR2 (plan §5) end-to-end through
 * `createAdmissionKernel`: the three frozen arms, the per-call leg ORDER,
 * the ONE-logical-ApprovalCase path, stale-between-approval-and-dispatch,
 * Cancel before/during/after, cross-Member Grant theft, and the two hard
 * clauses in their KERNEL positions (H1 first-leg, H2 ahead of any mint).
 *
 * @module test/a5p2-admission-kernel
 */
import { describe, expect, it } from 'vitest'
import { parseOperationGrant, type AdmissionRequest, type Effect, type OperationGrant } from '../../domain/tool-governance/src/index.js'
import { deriveTeamPolicyAuthority, toolAskApprovalCaseId, type AssuranceProbe, type PolicyDenySource, type PresentedApproval } from '../tool-admission/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/types.js'
import {
  assuranceContract,
  binding,
  dimensionRecord,
  effects,
  MEMBER,
  observed,
  readEffect,
  scopeResource,
  toolInvokeEffect,
  REALM,
  OTHER_REALM,
  writeEffect,
} from './a5p2-fixtures.js'
import { allowPolicy, emptyHardDocs, emptyPolicy, hardRulesDocs, makeHarness, mutationRulesDocs, recordPorts } from './a5p2-kernel-harness.js'
import { policyDoc } from './a5p2-fixtures.js'
import type { ToolPolicyDocument } from '../../domain/tool-governance/src/index.js'

const FP = 'sha256:' + 'd'.repeat(64)

const denySource = (over: Partial<PolicyDenySource> = {}): PolicyDenySource => ({
  realmId: REALM,
  effectKind: 'write',
  matcher: { kind: 'exact', resource: scopeResource(writeEffect()) },
  ownerAuthority: 'leader', // the overlay lane writes Team denies at Leader reach (spec §8.2)
  sourceRef: 'overlay:entry-7',
  sourceVersion: 1,
  ...over,
})

function requestOf(over: Partial<AdmissionRequest> = {}): AdmissionRequest {
  return {
    binding: binding(),
    member: MEMBER,
    callId: 'call-1',
    realmId: REALM,
    parametersFingerprint: FP,
    requestedEffects: effects(readEffect()),
    ...over,
  }
}

/** The presentation the case ACTUALLY opens for this request (F-1 round:
 *  a constant caseId would make the member-binding check untestable). */
function approvalFor(request: AdmissionRequest, over: Partial<PresentedApproval> = {}): PresentedApproval {
  return {
    approvalCaseId: toolAskApprovalCaseId({
      teamSessionId: request.member.teamSessionId,
      instanceId: request.member.instanceId,
      effectSetFingerprint: request.requestedEffects.fingerprint,
      authorityGeneration: over.authorityGenerationAtCreation ?? 1,
    }),
    reviewerAuthority: 'leader',
    beneficiaryAuthority: 'member',
    requiredAuthorityAtCreation: 'leader',
    effectSetFingerprint: request.requestedEffects.fingerprint,
    authorityGenerationAtCreation: 1,
    ...over,
  }
}

function consumeFields(request: AdmissionRequest, grant: OperationGrant) {
  return {
    currentAuthorityGeneration: grant.authorityGeneration,
    member: request.member,
    callId: request.callId,
    realmId: request.realmId,
    bindingId: grant.bindingId,
    bindingRevision: grant.bindingRevision,
    parametersFingerprint: request.parametersFingerprint,
    requestedEffects: request.requestedEffects,
  }
}

describe('arm 1 — `admitted` (policy allows the WHOLE set)', () => {
  it('carries a single-use grant that re-parses, and registers exactly once', async () => {
    const set = effects(readEffect(), toolInvokeEffect('bash'))
    const request = requestOf({ requestedEffects: set })
    const { kernel, ledger, ports } = makeHarness({ policy: () => allowPolicy(set) })
    const decision = await kernel.admit(request)
    expect(decision.ok).toBe(true)
    if (!decision.ok || decision.value.kind !== 'admitted') throw new Error(JSON.stringify(decision))
    expect(decision.value.grant.singleUse).toBe(true)
    expect(decision.value.grant.callId).toBe('call-1')
    expect(decision.value.grant.expiresAt).toBeNull()
    expect(parseOperationGrant(decision.value.grant).ok).toBe(true)
    expect(ports.registrations).toBe(1)
    expect(ledger.consumedCount()).toBe(0) // admitted ≠ spent
  })
})

describe('arm 2 — `requires-approval` (the ONE logical ApprovalCase)', () => {
  it('carries the WHOLE effect set and the case identity; mints nothing', async () => {
    const request = requestOf({ requestedEffects: effects(readEffect(), writeEffect()) })
    const ports = recordPorts()
    const { kernel } = makeHarness({ ports })
    const decision = await kernel.admit(request)
    if (!decision.ok || decision.value.kind !== 'requires-approval') throw new Error(JSON.stringify(decision))
    expect(decision.value.requestedEffects).toBe(request.requestedEffects)
    expect(decision.value.reason).toContain('tadm:')
    expect(decision.value.reason).toContain('ALL 2 effects')
    expect(ports.registrations).toBe(0)
  })

  it('two calls asking the same legal question share the case identity; the plan names the highest rung', async () => {
    const { kernel } = makeHarness()
    const r1 = await kernel.planApproval(requestOf({ callId: 'call-a' }))
    const r2 = await kernel.planApproval(requestOf({ callId: 'call-b' }))
    expect(r1.ok && r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return
    expect(r1.value.approvalCaseId).toBe(r2.value.approvalCaseId)
    expect(r1.value.requiredAuthority).toBe('leader')
  })

  it('a policy DENY no longer short-circuits the door: it rides the ONE case at its rung (ruling ①)', async () => {
    // The blanket "decided DENY ⇒ whole-set unapprovable" arm was this
    // implementation tightening beyond its original authority; the user
    // ruling (2026-10-16) replaces it with SOURCE ROUTING. An envelope that
    // stays silent (the projection law's degenerate case) lands wherever the
    // ladder proves — the ladder, not an invented short-circuit, decides.
    const poisoned = effects(readEffect(), writeEffect())
    const request = requestOf({ requestedEffects: poisoned })
    const denyPolicy = policyDoc([{ effectKind: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'deny' }])
    const ports = recordPorts()
    const { kernel } = makeHarness({
      policy: () => denyPolicy,
      documents: () => mutationRulesDocs([{ operationClass: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'deny' }]),
      denySources: () => [denySource()],
      ports,
    })
    const decision = await kernel.admit(request)
    if (!decision.ok || decision.value.kind !== 'requires-approval') throw new Error(JSON.stringify(decision))
    const planned = await kernel.planApproval(request)
    if (!planned.ok) throw new Error(JSON.stringify(planned))
    expect(planned.value.requiredAuthority).toBe('human-user')
    expect(ports.registrations).toBe(0) // routed, not minted — the door still never grants alone
  })

  it('the model cannot route around the ladder: a Human Admin ask is refused, not minted', async () => {
    const { kernel } = makeHarness({ beneficiary: 'human-admin' })
    const decision = await kernel.admit(requestOf())
    if (!decision.ok || decision.value.kind !== 'denied') throw new Error(JSON.stringify(decision))
    expect(decision.value.error.details?.refusal).toBe('approval-unapprovable')
  })
})

describe('arm 3 — `denied` (identity, realm, binding state)', () => {
  it('a cross-Realm effect inside the set is a forged scope', async () => {
    const request = requestOf({ requestedEffects: effects(readEffect('data/a.txt', REALM), readEffect('other/x.txt', OTHER_REALM)) })
    const decision = await makeHarness().kernel.admit(request)
    if (!decision.ok || decision.value.kind !== 'denied') throw new Error(JSON.stringify(decision))
    expect(decision.value.error.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(decision.value.error.details?.refusal).toBe('realm-mismatch')
  })

  it('a DRAINING binding admits nothing (ADAPTER_DRAINING, PR1 state machine stands)', async () => {
    const drained = binding({ status: 'DRAINING' })
    const decision = await makeHarness().kernel.admit(requestOf({ binding: drained }))
    if (!decision.ok || decision.value.kind !== 'denied') throw new Error(JSON.stringify(decision))
    expect(decision.value.error.code).toBe('ADAPTER_DRAINING')
  })

  it('a stale binding generation is a refusal (re-assembly, not admission)', async () => {
    const stale = binding({ authorityGeneration: 1 })
    const { kernel } = makeHarness({ authorityGeneration: () => 2 })
    const decision = await kernel.admit(requestOf({ binding: stale }))
    if (!decision.ok || decision.value.kind !== 'denied') throw new Error(JSON.stringify(decision))
    expect(decision.value.error.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(decision.value.error.details?.refusal).toBe('authority-generation-drift')
  })
})

describe('H2 in its kernel position — assurance verification AHEAD of hard-profile/mint', () => {
  const hardRead = () => ({ 'content-read': 'hard' as const })

  it('an enforced CLAIM with no probe observation never reaches mint (probe answers first)', async () => {
    const contract = assuranceContract({ 'content-read': dimensionRecord('enforced') })
    const set = effects(readEffect())
    const ports = recordPorts()
    const { kernel } = makeHarness({
      policy: () => allowPolicy(set),
      requiredAssurance: hardRead,
      // stub with NO observations: the claim is alone in the room.
      probe: ((): AssuranceProbe => (_binding, _dimension) => ({ ok: false, detail: 'no probe before PR4' }))(),
      ports,
    })
    const decision = await kernel.admit(requestOf({ binding: binding({}, contract), requestedEffects: set }))
    if (!decision.ok || decision.value.kind !== 'denied') throw new Error(JSON.stringify(decision))
    expect(decision.value.error.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(ports.probeCalls).toBe(1)
    expect(ports.registrations).toBe(0)
  })

  it('a probe-MATCHED enforced record admits, and the ORDER is probe-then-mint', async () => {
    const contract = assuranceContract({ 'content-read': dimensionRecord('enforced') })
    const set = effects(readEffect())
    const ports = recordPorts()
    const { kernel } = makeHarness({
      policy: () => allowPolicy(set),
      requiredAssurance: hardRead,
      probe: createProbe(contract),
      ports,
    })
    const decision = await kernel.admit(requestOf({ binding: binding({}, contract), requestedEffects: set }))
    expect(decision.ok && decision.value.kind === 'admitted').toBe(true)
    expect(ports.sequence).toEqual(['probe:content-read', 'register'])
  })
})

describe('the approval → issue → consume ride (and everything that poisons it)', () => {
  it('happy ride: requires-approval → leader leg → issue → consume ONCE', async () => {
    const request = requestOf({ requestedEffects: effects(readEffect()) })
    const { kernel, ledger } = makeHarness()
    const decision = await kernel.admit(request)
    expect(decision.ok && decision.value.kind === 'requires-approval').toBe(true)
    const issued = await kernel.issueApprovedGrant(request, approvalFor(request))
    expect(issued.ok).toBe(true)
    if (!issued.ok) return
    expect(issued.value.singleUse).toBe(true)
    const consumed = kernel.consumeForExecution(issued.value, consumeFields(request, issued.value))
    expect(consumed.ok).toBe(true)
    expect(ledger.consumedCount()).toBe(1)
    const again = kernel.consumeForExecution(issued.value, consumeFields(request, issued.value))
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error.code).toBe('APPROVAL_STALE')
  })

  it('the leader leg does NOT cover an effect the hard envelope raised (per-effect, whole-set refusal)', async () => {
    const request = requestOf({ requestedEffects: effects(readEffect(), writeEffect()) })
    const hardened = hardRulesDocs([{ operationClass: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'ask' }])
    const { kernel } = makeHarness()
    const issued = await kernel.issueApprovedGrant(request, approvalFor(request))
    expect(issued.ok).toBe(true) // under empty docs the leader leg is legal
    // SAME approval presentation, envelope GREW in between (a permission
    // change deliberately inserted between approval and dispatch):
    const hardenedKernel = makeHarness({ documents: () => hardened }).kernel
    const refused = await hardenedKernel.issueApprovedGrant(request, approvalFor(request))
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.error.code).toBe('APPROVAL_STALE')
  })

  it('a deny PROJECTED into the envelope while the Ask is open kills the issue (stale is a refusal, not a retry)', async () => {
    const request = requestOf({ requestedEffects: effects(writeEffect()) })
    let docs = emptyHardDocs()
    const ports = recordPorts()
    const { kernel } = makeHarness({ documents: () => docs, ports })
    expect((await kernel.admit(request)).ok).toBe(true) // requires-approval at leader while the envelope is silent
    docs = hardRulesDocs([{ operationClass: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'deny' }])
    const issued = await kernel.issueApprovedGrant(request, approvalFor(request))
    expect(issued.ok).toBe(false)
    if (!issued.ok) expect(issued.error.message).toContain('required rung rose') // the ladder now answers HIGHER than the case was opened at
    expect(ports.registrations).toBe(0)
  })

  it('a moved authority generation between approval and execution is APPROVAL_STALE (resume with an old token)', async () => {
    const request = requestOf()
    const { kernel } = makeHarness()
    const issued = await kernel.issueApprovedGrant(request, approvalFor(request, { authorityGenerationAtCreation: 1 }))
    expect(issued.ok).toBe(true) // a fresh question at generation 1
    // Resume the SAME approval after the generation moved (binding re-validated
    // at 2, presentation still says 1): the stale leg never issues.
    const movedBinding = binding({ authorityGeneration: 2 })
    const moved = makeHarness({ authorityGeneration: () => 2 })
    const staleIssue = await moved.kernel.issueApprovedGrant(
      requestOf({ binding: movedBinding }),
      approvalFor(request, { authorityGenerationAtCreation: 1 }),
    )
    expect(staleIssue.ok).toBe(false)
    if (!staleIssue.ok) expect(staleIssue.error.message).toContain('authority generation moved')
  })

  it('a stale BINDING generation at issue time is refused even with a fresh approval', async () => {
    const request = requestOf()
    const moved = makeHarness({ authorityGeneration: () => 2 })
    const issue = await moved.kernel.issueApprovedGrant(request, approvalFor(request, { authorityGenerationAtCreation: 2 }))
    expect(issue.ok).toBe(false)
    if (!issue.ok) expect(issue.error.details?.refusal).toBe('authority-generation-drift')
  })

  it('an approval carrying a DIFFERENT effect-set fingerprint never issues this call', async () => {
    const request = requestOf({ requestedEffects: effects(readEffect()) })
    const { kernel } = makeHarness()
    const forged = approvalFor(request, { effectSetFingerprint: effects(readEffect(), writeEffect()).fingerprint })
    const issued = await kernel.issueApprovedGrant(request, forged)
    expect(issued.ok).toBe(false)
    if (!issued.ok) expect(issued.error.message).toContain('WHOLE set')
  })

  it('a presentation made for ANOTHER member never issues here — the case identity binds the member (F-1)', async () => {
    const request = requestOf()
    // A's approval (A's member leg of the case identity), presented for B's request.
    const presentationForA = approvalFor(request)
    const victim = { ...request, member: { teamSessionId: 'ts-1', instanceId: 'inst-VICTIM' } }
    const { kernel } = makeHarness()
    const issued = await kernel.issueApprovedGrant(victim, presentationForA)
    expect(issued.ok).toBe(false)
    if (!issued.ok) {
      expect(issued.error.code).toBe('APPROVAL_STALE')
      expect(issued.error.details?.refusal).toBe('approval-case-identity-mismatch')
      expect(issued.error.details?.expected).toContain('inst-VICTIM')
    }
  })

  it('a case identity forged around the fingerprint is refused on the same leg, before any mint', async () => {
    const request = requestOf()
    const forged = approvalFor(request, { approvalCaseId: 'tadm:ts-1:inst-2:sha256:' + 'f'.repeat(64) + ':g1' })
    const { kernel, ports } = makeHarness()
    const issued = await kernel.issueApprovedGrant(request, forged)
    expect(issued.ok).toBe(false)
    if (!issued.ok) expect(issued.error.details?.refusal).toBe('approval-case-identity-mismatch')
    expect(ports.registrations).toBe(0)
  })

  it('cross-Member Grant theft: the leader-leg grant spent by ANOTHER member refuses', async () => {
    const request = requestOf()
    const { kernel } = makeHarness()
    const issued = await kernel.issueApprovedGrant(request, approvalFor(request))
    expect(issued.ok).toBe(true)
    if (!issued.ok) return
    const stolen = kernel.consumeForExecution(issued.value, {
      ...consumeFields(request, issued.value),
      member: { teamSessionId: 'ts-1', instanceId: 'inst-VICTIM-2' },
    })
    expect(stolen.ok).toBe(false)
    if (!stolen.ok) expect(stolen.error.code).toBe('TOOL_BINDING_UNVERIFIED')
  })
})

describe('Cancel before / during / after (lease algebra, PR0-pinned)', () => {
  it('before the edge: refused with the grant UNspent', async () => {
    const set = effects(readEffect())
    const request = requestOf({ requestedEffects: set })
    const { kernel, ledger } = makeHarness({ policy: () => allowPolicy(set) })
    const decision = await kernel.admit(request)
    if (!decision.ok || decision.value.kind !== 'admitted') throw new Error('admit failed')
    const refused = kernel.consumeForExecution(decision.value.grant, { ...consumeFields(request, decision.value.grant), cancelRequested: true })
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.error.details?.refusal).toBe('cancelled-before-execution')
    expect(ledger.consumedCount()).toBe(0)
    // the grant is still intact for its (uncancelled) call
    expect(kernel.consumeForExecution(decision.value.grant, consumeFields(request, decision.value.grant)).ok).toBe(true)
  })

  it('during: request ≠ terminated; settlement decides; the spent grant stays spent', async () => {
    const set = effects(readEffect())
    const request = requestOf({ requestedEffects: set })
    const { kernel, ledger } = makeHarness({ policy: () => allowPolicy(set) })
    const decision = await kernel.admit(request)
    if (!decision.ok || decision.value.kind !== 'admitted') throw new Error('admit failed')
    const consumed = kernel.consumeForExecution(decision.value.grant, { ...consumeFields(request, decision.value.grant), executionKind: 'process-tree' })
    expect(consumed.ok).toBe(true)
    if (!consumed.ok || consumed.value.lease === null) throw new Error('lease missing')
    const cancelling = kernel.requestCancellation(consumed.value.lease)
    expect(cancelling.ok).toBe(true)
    if (!cancelling.ok) return
    expect(cancelling.value.status).toBe('cancelling')
    const unconfirmed = kernel.settleTermination(cancelling.value, false)
    expect(unconfirmed.ok && unconfirmed.value.status).toBe('termination-unconfirmed')
    expect(ledger.consumedCount()).toBe(1) // cancellation never refunds the one-shot
  })

  it('after: a terminated lease never reopens; a spent grant never re-consumes', async () => {
    const set = effects(readEffect())
    const request = requestOf({ requestedEffects: set })
    const { kernel } = makeHarness({ policy: () => allowPolicy(set) })
    const decision = await kernel.admit(request)
    if (!decision.ok || decision.value.kind !== 'admitted') throw new Error('admit failed')
    const consumed = kernel.consumeForExecution(decision.value.grant, { ...consumeFields(request, decision.value.grant), executionKind: 'background-instance' })
    if (!consumed.ok || consumed.value.lease === null) throw new Error('lease missing')
    const settled = kernel.settleTermination(consumed.value.lease, true)
    expect(settled.ok && settled.value.status).toBe('terminated')
    if (!settled.ok) return
    const late = kernel.requestCancellation(settled.value)
    expect(late.ok).toBe(false)
    if (!late.ok) expect(late.error.code).toBe('EXECUTION_TERMINATION_UNCONFIRMED')
  })
})

describe('mint hygiene at the kernel edge', () => {
  it('a broken expiry policy fails the mint CLOSED (never an expiry at zero or ∞)', async () => {
    const set = effects(readEffect())
    const request = requestOf({ requestedEffects: set })
    const { kernel } = makeHarness({ policy: () => allowPolicy(set), grantExpiry: () => Number.POSITIVE_INFINITY })
    const decision = await kernel.admit(request)
    if (!decision.ok || decision.value.kind !== 'denied') throw new Error(JSON.stringify(decision))
    expect(decision.value.error.details?.refusal).toBe('grant-expiry-policy-defective')
  })
})

/** A probe that confirms every enforced record of `contract` verbatim. */
function createProbe(contract: ReturnType<typeof assuranceContract>): AssuranceProbe {
  return (_b, dimension) => {
    const record = contract.assurance[dimension]
    if (record.mechanism === null || record.trustRoot === null || record.evidence === null) {
      return { ok: false, detail: 'record has nulls' }
    }
    return { ok: true, ...observed({ mechanism: record.mechanism, realmId: record.realmId, trustRoot: record.trustRoot, evidence: record.evidence }) }
  }
}

describe('policy-deny routing — the controls of the 2026-10-16 ruling (问题2)', () => {
  const denyWrite = policyDoc([{ effectKind: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'deny' }])

  it('control 低阶 deny 升阶: an overlay-bound deny escalates to Human User — the Leader cannot lift it, Human User can', async () => {
    const request = requestOf({ requestedEffects: effects(writeEffect()) })
    const ports = recordPorts()
    const { kernel } = makeHarness({
      policy: () => denyWrite,
      documents: () => mutationRulesDocs([{ operationClass: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'deny' }]),
      denySources: () => [denySource()],
      ports,
    }) // ADR A5-1: the mutation envelope binds the LEADER only — the walk must climb past it
    const decision = await kernel.admit(request)
    if (!decision.ok || decision.value.kind !== 'requires-approval') throw new Error(JSON.stringify(decision))
    const planned = await kernel.planApproval(request)
    if (!planned.ok) throw new Error(JSON.stringify(planned))
    expect(planned.value.requiredAuthority).toBe('human-user') // 升阶 IS the owning-authority answer
    const asLeader = await kernel.issueApprovedGrant(request, approvalFor(request, { reviewerAuthority: 'leader', requiredAuthorityAtCreation: 'human-user' }))
    expect(asLeader.ok).toBe(false) // the rung the deny is bound at cannot sign over its own deny
    const asUser = await kernel.issueApprovedGrant(request, approvalFor(request, { reviewerAuthority: 'human-user', requiredAuthorityAtCreation: 'human-user', deniedEffectsAtCreation: [{ effectIndex: 0, requiredAuthority: 'human-user' }] }))
    expect(asUser.ok).toBe(true)
    expect(ports.registrations).toBe(1)
  })

  it('control Envelope deny 升阶 + admin 单次批准: a hard-envelope deny lands at Human Admin; the one-shot approval is legal and mutates nothing', async () => {
    const request = requestOf({ requestedEffects: effects(writeEffect()) })
    const docs = hardRulesDocs([{ operationClass: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'deny' }])
    const ports = recordPorts()
    const { kernel } = makeHarness({ policy: () => denyWrite, documents: () => docs, denySources: () => [denySource({ ownerAuthority: 'human-user', sourceRef: 'blueprint:hard-ceiling-3' })], ports })
    const planned = await kernel.planApproval(request)
    if (!planned.ok) throw new Error(JSON.stringify(planned))
    expect(planned.value.requiredAuthority).toBe('human-admin') // admin: the top rung INSIDE envelope support
    const policyBefore = JSON.stringify(denyWrite)
    const issued = await kernel.issueApprovedGrant(request, approvalFor(request, { reviewerAuthority: 'human-admin', requiredAuthorityAtCreation: 'human-admin', deniedEffectsAtCreation: [{ effectIndex: 0, requiredAuthority: 'human-admin' }] }))
    if (!issued.ok) throw new Error(JSON.stringify(issued))
    expect(issued.ok).toBe(true) // a SINGLE-USE grant — no policy document was, or had to be, changed
    expect(JSON.stringify(denyWrite)).toBe(policyBefore) // ④ the policy bytes are byte-identical across the mint — an approval is not a mutation
    expect(kernel.consumeForExecution(issued.value, consumeFields(request, issued.value)).ok).toBe(true)
    expect(kernel.consumeForExecution(issued.value, consumeFields(request, issued.value)).ok).toBe(false) // spent once — not a standing exception
    const again = await kernel.admit(request)
    if (!again.ok || again.value.kind !== 'requires-approval') throw new Error(JSON.stringify(again)) // the deny is still on the books: 不强迫先永久修改策略
    expect(ports.registrations).toBe(1) // exactly one mint for one approval
  })

  it('control whole-effect joint authority: an allowed effect may not slip through beside a denied one', async () => {
    const request = requestOf({ requestedEffects: effects(readEffect(), writeEffect()) })
    const mixed = policyDoc([
      { effectKind: 'read', resource: scopeResource(readEffect()), maximumEffect: 'allow' },
      { effectKind: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'deny' },
    ])
    const { kernel } = makeHarness({
      policy: () => mixed,
      documents: () => hardRulesDocs([{ operationClass: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'deny' }]),
      denySources: () => [denySource({ ownerAuthority: 'human-user', sourceRef: 'blueprint:hard-ceiling-3' })],
    })
    const decision = await kernel.admit(request)
    if (!decision.ok || decision.value.kind !== 'requires-approval') throw new Error(JSON.stringify(decision)) // no partial admit for the allowed half
    const planned = await kernel.planApproval(request)
    if (!planned.ok) throw new Error(JSON.stringify(planned))
    expect(planned.value.requiredAuthority).toBe('human-admin') // ONE case at the set MAX
    const asUser = await kernel.issueApprovedGrant(request, approvalFor(request, { reviewerAuthority: 'human-user', requiredAuthorityAtCreation: 'human-user', deniedEffectsAtCreation: [{ effectIndex: 0, requiredAuthority: 'human-user' }] }))
    expect(asUser.ok).toBe(false) // covering the read is covering nothing: ALL effects or none
  })

  it('control 未知来源: a deny whose owning authority cannot be established refuses with an accurate diagnosis, zero mints (ruling ③)', async () => {
    const ports = recordPorts()
    const { kernel } = makeHarness({
      policy: () => denyWrite,
      documents: () => ({
        teamHardEnvelope: { rules: [{ operationClass: 'write', matcher: { kind: 'subtree' as const, resource: 'realm-a|data' }, maximumEffect: 'deny' as const }] },
        permissionMutationEnvelope: { status: 'absent' as const },
      }), // no subtreeContains seam: WHICH rung owns the deny is undeterminable — the lane must say so, not costume it
      ports,
    })
    const decision = await kernel.admit(requestOf({ requestedEffects: effects(writeEffect()) }))
    if (!decision.ok || decision.value.kind !== 'denied') throw new Error(JSON.stringify(decision))
    expect(decision.value.error.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(decision.value.error.details?.refusal).toBe('deny-source-unattributed')
    expect(decision.value.error.message).toContain('unattributed')
    expect(ports.registrations).toBe(0)
  })

  it('control 来源/世代变化: a deny landing as a mutation (generation bumped) turns the open Ask stale — stale is a refusal', async () => {
    let gen = 1
    let poisoned: ToolPolicyDocument = emptyPolicy()
    const { kernel } = makeHarness({ authorityGeneration: () => gen, policy: () => poisoned })
    const request = requestOf()
    expect((await kernel.admit(request)).ok).toBe(true) // requires-approval at generation 1
    poisoned = denyWrite // the deny arrives…
    gen = 2 // …and the assembly bumps the generation, as spec §8.2's mutation discipline requires
    const stale = await kernel.issueApprovedGrant(requestOf({ binding: binding({ authorityGeneration: 2 }) }), approvalFor(request))
    expect(stale.ok).toBe(false)
    if (!stale.ok) expect(stale.error.message).toContain('authority generation moved')
  })

  it('control 环境不支持: a capability fact that turns off between approval and issue kills the mint with zero side effects (ruling ②)', async () => {
    let enforced = false
    const ports = recordPorts()
    const { kernel } = makeHarness({
      requiredAssurance: () => (enforced ? { 'content-read': 'hard' as const } : {}),
      probe: () => ({ ok: false, detail: 'environment does not support the mechanism' }),
      ports,
    })
    const request = requestOf({ requestedEffects: effects(readEffect()) })
    expect((await kernel.admit(request)).ok).toBe(true) // no demand yet: requires-approval
    enforced = true // the policy now DEMANDS a hard dimension the environment cannot show
    const issued = await kernel.issueApprovedGrant(request, approvalFor(request))
    expect(issued.ok).toBe(false) // Team approval changes no facts
    expect(ports.registrations).toBe(0)
    expect(ports.consumptions).toBe(0)
  })

  it('对照表 (user review 520a250d): SAME policy deny, SAME envelope coverage, six source states — distinguishable and rung-capped', async () => {
    const request = requestOf({ requestedEffects: effects(writeEffect()) })
    const envelope = () => mutationRulesDocs([{ operationClass: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'deny' }])
    // (a) source = Leader authority, version matches ⇒ case opens at human-user;
    //     the Leader's OWN leg is refused (a rung never lifts its own authority's
    //     deny), the Human User's leg issues.
    {
      const ports = recordPorts()
      const { kernel } = makeHarness({ policy: () => denyWrite, documents: envelope, denySources: () => [denySource()], ports })
      const planned = await kernel.planApproval(request)
      if (!planned.ok) throw new Error(`(a) plan: ${JSON.stringify(planned)}`)
      expect(planned.value.requiredAuthority).toBe('human-user')
      const leaderLeg = await kernel.issueApprovedGrant(request, approvalFor(request, { requiredAuthorityAtCreation: 'human-user' }))
      expect(leaderLeg.ok).toBe(false) // 'may not review' — its own authority's deny
      expect(ports.registrations).toBe(0)
      const issued = await kernel.issueApprovedGrant(request, approvalFor(request, { reviewerAuthority: 'human-user', requiredAuthorityAtCreation: 'human-user', deniedEffectsAtCreation: [{ effectIndex: 0, requiredAuthority: 'human-user' }] }))
      if (!issued.ok) throw new Error(`(a) issue: ${JSON.stringify(issued)}`)
      expect(ports.registrations).toBe(1)
    }
    // (b) source UNKNOWN (projection unwired) ⇒ precise refusal — same envelope,
    //     which is exactly what makes (a)/(b) distinguishable.
    {
      const ports = recordPorts()
      const { kernel } = makeHarness({ policy: () => denyWrite, documents: envelope, ports })
      const planned = await kernel.planApproval(request)
      expect(planned.ok).toBe(false)
      if (!planned.ok) expect(planned.error.details?.refusal).toBe('deny-source-unattributed')
      expect(ports.registrations).toBe(0)
    }
    // (c) source = a DIFFERENT Team authority (Human User's hard ceiling), same
    //     coverage ⇒ the case RISES to human-admin (floor from the source, not
    //     the envelope); Human User's own leg is refused, Admin's issues.
    {
      const ports = recordPorts()
      const { kernel } = makeHarness({
        policy: () => denyWrite,
        documents: envelope, // byte-identical coverage to (a) — ONLY the source differs
        denySources: () => [denySource({ ownerAuthority: 'human-user', sourceRef: 'blueprint:hard-ceiling-3' })],
        ports,
      })
      const planned = await kernel.planApproval(request)
      if (!planned.ok) throw new Error(`(c) plan: ${JSON.stringify(planned)}`)
      expect(planned.value.requiredAuthority).toBe('human-admin')
      const userLeg = await kernel.issueApprovedGrant(request, approvalFor(request, { reviewerAuthority: 'human-user', requiredAuthorityAtCreation: 'human-admin' }))
      expect(userLeg.ok).toBe(false) // not its deny to lift
      const adminLeg = await kernel.issueApprovedGrant(request, approvalFor(request, { reviewerAuthority: 'human-admin', requiredAuthorityAtCreation: 'human-admin', deniedEffectsAtCreation: [{ effectIndex: 0, requiredAuthority: 'human-admin' }] }))
      if (!adminLeg.ok) throw new Error(`(c) admin: ${JSON.stringify(adminLeg)}`)
      expect(ports.registrations).toBe(1)
    }
    // (d) source version DRIFT (projected at g2, call runs at g1) ⇒ precise refusal.
    {
      const { kernel } = makeHarness({ policy: () => denyWrite, documents: envelope, denySources: () => [denySource({ sourceVersion: 2 })] })
      const planned = await kernel.planApproval(request)
      expect(planned.ok).toBe(false)
      if (!planned.ok) expect(planned.error.details?.refusal).toBe('deny-source-version-drift')
    }
    // (e) source = the TOP authority (Admin wrote the deny) ⇒ no rung above it
    //     exists ⇒ there is no one-shot at all; only spec §8.2's permanent path.
    {
      const { kernel } = makeHarness({ policy: () => denyWrite, documents: envelope, denySources: () => [denySource({ ownerAuthority: 'human-admin', sourceRef: 'blueprint:admin-rule-1' })] })
      const planned = await kernel.planApproval(request)
      expect(planned.ok).toBe(false)
      if (!planned.ok) expect(planned.error.details?.refusal).toBe('deny-owner-above-ladder')
    }
    // (f) an UNRELATED envelope rule (an ASK at the same scope) + no source ⇒
    //     nothing launders: matching an unrelated rule was never source proof.
    {
      const { kernel } = makeHarness({
        policy: () => denyWrite,
        documents: () => mutationRulesDocs([{ operationClass: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'ask' }]),
      })
      const planned = await kernel.planApproval(request)
      expect(planned.ok).toBe(false)
      if (!planned.ok) expect(planned.error.details?.refusal).toBe('deny-source-unattributed')
    }
  })

  it('F-1 (final-head review): coexisting deny sources over ONE scope are AMBIGUOUS in every array order — first-wins let order decide the outcome', async () => {
    const request = requestOf({ requestedEffects: effects(writeEffect()) })
    const memberOwned = denySource({ ownerAuthority: 'member', sourceRef: 'overlay:entry-low' })
    const adminOwned = denySource({ ownerAuthority: 'human-admin', sourceRef: 'blueprint:admin-rule-1' })
    for (const order of [[memberOwned, adminOwned], [adminOwned, memberOwned]]) {
      const ports = recordPorts()
      const { kernel } = makeHarness({
        policy: () => denyWrite,
        documents: () => mutationRulesDocs([{ operationClass: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'deny' }]),
        denySources: () => order,
        ports,
      })
      const planned = await kernel.planApproval(request)
      expect(planned.ok).toBe(false) // pre-fix, the member-first order OPENS (first-wins floor)
      if (!planned.ok) expect(planned.error.details?.refusal).toBe('deny-source-ambiguous') // pre-fix: admin-first says owner-above-ladder instead
      const issued = await kernel.issueApprovedGrant(request, approvalFor(request))
      expect(issued.ok).toBe(false)
      expect(ports.registrations).toBe(0)
    }
  })

  it('F-2 (final-head review): a SECOND deny arriving after the approval cannot mint on the unchanged MAX rung — per-effect provenance IS part of the case', async () => {
    const request = requestOf({ requestedEffects: effects(writeEffect(), readEffect()) })
    let second = false // the read deny ARRIVES between approval and issue
    const ports = recordPorts()
    const { kernel } = makeHarness({
      policy: () => second
        ? policyDoc([
            { effectKind: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'deny' },
            { effectKind: 'read', resource: scopeResource(readEffect()), maximumEffect: 'deny' },
          ])
        : denyWrite,
      documents: () => mutationRulesDocs([{ operationClass: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'deny' }]),
      // The late read-deny's floor (member-owned => leader) sits BELOW the approved
      // max rung — the MAX comparison cannot see it. The generation is deliberately
      // NOT bumped: the lane may not trust the assembly's discipline.
      denySources: () => second
        ? [denySource(), denySource({ effectKind: 'read', matcher: { kind: 'exact', resource: scopeResource(readEffect()) }, ownerAuthority: 'member', sourceRef: 'overlay:entry-late' })]
        : [denySource()],
      ports,
    })
    const planned = await kernel.planApproval(request)
    if (!planned.ok) throw new Error(`plan: ${JSON.stringify(planned)}`)
    expect(planned.value.deniedEffects).toEqual([{ effectIndex: 1, requiredAuthority: 'human-user' }])
    second = true
    const issued = await kernel.issueApprovedGrant(
      request,
      approvalFor(request, {
        reviewerAuthority: 'human-user',
        requiredAuthorityAtCreation: 'human-user',
        deniedEffectsAtCreation: [{ effectIndex: 1, requiredAuthority: 'human-user' }],
      }),
    )
    expect(issued.ok).toBe(false) // pre-fix: the MAX rung is unchanged, so this MINTS over the late deny
    expect(ports.registrations).toBe(0) // pre-fix: 1
  })

  it('R-1a: a deny the envelope never projects is NOT a leader-leg mint — unattributed, zero mints (ruling ③, review R-1a)', async () => {
    // The walk's DEFAULT rung (leader on an empty ladder) is not an owning
    // authority for a deny: before the fix this MINTED — fail-open, costumed
    // as authorization. R-1a law: a denied index's rung must be backed by at
    // least one bound narrowing rule over the denied scope.
    const request = requestOf({ requestedEffects: effects(writeEffect()) })
    const ports = recordPorts()
    const { kernel } = makeHarness({ policy: () => denyWrite, ports }) // envelope says NOTHING about the deny
    const planned = await kernel.planApproval(request)
    expect(planned.ok).toBe(false)
    if (!planned.ok) {
      expect(planned.error.code).toBe('TOOL_BINDING_UNVERIFIED')
      expect(planned.error.details?.refusal).toBe('deny-source-unattributed')
    }
    const issued = await kernel.issueApprovedGrant(request, approvalFor(request))
    expect(issued.ok).toBe(false) // pre-fix: this minted
    expect(ports.registrations).toBe(0) // pre-fix: 1
  })

  it('R-2a: a denied effect under a top-rung beneficiary says NO-UPPER-RUNG — the authority is known, nobody sits above (not ③)', async () => {
    const { kernel } = makeHarness({
      beneficiary: 'human-admin',
      policy: () => denyWrite,
      documents: () => mutationRulesDocs([{ operationClass: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'deny' }]),
      denySources: () => [denySource()], // source PROVEN (leader-owned) — so the refusal is genuinely about the exhausted ladder
    })
    const decision = await kernel.admit(requestOf({ requestedEffects: effects(writeEffect()) }))
    if (!decision.ok || decision.value.kind !== 'denied') throw new Error(JSON.stringify(decision))
    expect(decision.value.error.details?.refusal).toBe('ask-has-no-upper-rung') // NOT deny-source-unattributed
    expect(decision.value.error.message).toContain('no rung above')
    expect(decision.value.error.message).toContain('§8.2') // the fix it suggests: the permanent mutation path
  })

  it('R-1b: the plan states WHICH deny rides at WHICH rung (plan value + observe) — PR3 presents exactly this', async () => {
    const request = requestOf({ requestedEffects: effects(readEffect(), writeEffect()) })
    const observed: Record<string, unknown>[] = []
    const { kernel } = makeHarness({
      policy: () => policyDoc([
        { effectKind: 'read', resource: scopeResource(readEffect()), maximumEffect: 'ask' }, // ordinary ask — no projection needed for absence/ask
        { effectKind: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'deny' }, // the ONE deny, projected below
      ]),
      documents: () => mutationRulesDocs([
        { operationClass: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'deny' },
      ]),
      denySources: () => [denySource()],
      onObserve: (event) => {
        observed.push(event)
      },
    })
    const planned = await kernel.planApproval(request)
    if (!planned.ok) throw new Error(JSON.stringify(planned))
    expect(planned.value.deniedEffects).toEqual([{ effectIndex: 1, requiredAuthority: 'human-user' }])
    await kernel.admit(request)
    const evt = observed.find((e) => e.event === 'admission-requires-approval')
    expect(evt?.deniedEffects).toEqual([{ effectIndex: 1, requiredAuthority: 'human-user' }])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTION PROJECTION (PR2/PR3 production-assembly round) — the REAL
// authority input path: `deriveTeamPolicyAuthority` turns the template's
// `capabilities.permissions` object (what `boundTemplate.capabilities?.
// permissions` yields on the live glue) into the PR0 document + R-1a deny
// sources. Every projection-law row of the assembly contract
// (`dev/agent-workflow/evidence/alpha5/prod/pa-CONTRACT.md` §5) is pinned
// here; the end-to-end class run (assembly + provider + real file) lives in
// `a5p2-composition.test.ts`.
// ═══════════════════════════════════════════════════════════════════════════

const A_ABS = '/data/a.txt'
const metaEffectOn = (locator: string): Effect => ({
  kind: 'meta',
  resource: { realmId: REALM, kind: 'workspace', canonicalLocator: locator, rights: ['meta'] },
})
const listEffectOn = (locator: string): Effect => ({
  kind: 'list',
  resource: { realmId: REALM, kind: 'directory', canonicalLocator: locator, rights: ['list'] },
})

function projOf(policy: TemplatePermissionPolicy, over: Partial<Parameters<typeof deriveTeamPolicyAuthority>[0]> = {}) {
  return deriveTeamPolicyAuthority({
    permissionPolicy: policy,
    realmId: REALM,
    templateId: 'tpl-1',
    definitionOwnerAuthority: 'human-user',
    role: 'member',
    sourceVersion: () => 1,
    ...over,
  })
}

describe('production projection: template capabilities.permissions → PR0 authority (pa-CONTRACT §5)', () => {
  it('an allow-lane read rule projects read + meta + tool-invoke arms on the realm-qualified scope', () => {
    const r = projOf({ default: 'ask', allow: [{ tool: 'read', resource: { kind: 'exact', path: A_ABS } }], ask: [], deny: [] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.templateDefault).toBe('ask')
    expect(r.value.notes).toEqual([])
    const rules = r.value.buildDocument().rules
    const spell = new Set(rules.map((rule) => `${rule.effectKind}@${rule.matcher.resource}:${rule.maximumEffect}`))
    expect(spell.has(`read@${REALM}|${A_ABS}:allow`)).toBe(true)
    expect(spell.has(`meta@${REALM}|${A_ABS}:allow`)).toBe(true) // companion meta arm — the C-FS resolve/stat leg must not Ask under an allowed read
    expect(spell.has(`tool-invoke@${REALM}|tool:read:allow`)).toBe(true)
    expect(r.value.coversEffect(readEffect(A_ABS))).toBe(true)
    expect(r.value.coversEffect(metaEffectOn(A_ABS))).toBe(true)
    expect(r.value.coversEffect(writeEffect(A_ABS))).toBe(false) // no drift into write
    expect(r.value.denySources()).toEqual([])
  })

  it('a deny-lane write rule yields R-1a deny sources with version stamped at READ time', () => {
    let generation = 1
    const r = projOf({ default: 'ask', allow: [], ask: [], deny: [{ tool: 'write', resource: { kind: 'exact', path: A_ABS } }] }, { sourceVersion: () => generation })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const first = r.value.denySources()
    expect(first.map((s) => s.effectKind).sort()).toEqual(['meta', 'tool-invoke', 'write'])
    for (const source of first) {
      expect(source.realmId).toBe(REALM)
      expect(source.ownerAuthority).toBe('human-user')
      expect(source.sourceRef).toBe('tpl-1#deny[0]') // lane + declaration index = the named origin
      expect(source.sourceVersion).toBe(1)
    }
    generation = 7
    expect(r.value.denySources()[0]?.sourceVersion).toBe(7) // read-time, so the kernel version-trust never lags
  })

  it('a subtree rule REQUIRES the containment seam; with it, coverage answers per the injected law', () => {
    const policy: TemplatePermissionPolicy = { default: 'ask', allow: [{ tool: 'read', resource: { kind: 'subtree', path: '/data' } }], ask: [], deny: [] }
    const bare = projOf(policy)
    expect(bare.ok).toBe(false)
    if (bare.ok) return
    expect(bare.error.details?.['refusal']).toBe('projection-subtree-seam-missing')
    const seeded = projOf(policy, { subtreeContains: (root, child) => child.startsWith(`${root}/`) })
    expect(seeded.ok).toBe(true)
    if (!seeded.ok) return
    expect(seeded.value.coversEffect(readEffect('/data/x/y.txt'))).toBe(true)
    expect(seeded.value.coversEffect(readEffect('/other/z.txt'))).toBe(false)
  })

  it('unprojectable DENIES refuse the construction (no silent weakening): file any-deny and lsp resource-deny', () => {
    const anyDeny = projOf({ default: 'ask', allow: [], ask: [], deny: [{ tool: 'read', resource: { kind: 'any' } }] })
    expect(anyDeny.ok).toBe(false)
    if (anyDeny.ok) return
    expect(anyDeny.error.code).toBe('IO_POLICY_UNSUPPORTED')
    expect(anyDeny.error.details?.['refusal']).toBe('projection-deny-unprojectable')
    const lspDeny = projOf({ default: 'ask', allow: [], ask: [], deny: [{ tool: 'lsp', resource: { kind: 'exact', path: A_ABS } }] })
    expect(lspDeny.ok).toBe(false)
    if (lspDeny.ok) return
    expect(lspDeny.error.details?.['refusal']).toBe('projection-deny-unprojectable')
    // ask/deny lanes for lsp on the TOOL dimension are fine (tool-invoke expresses them fully):
    const lspAsk = projOf({ default: 'ask', allow: [], ask: [{ tool: 'lsp', resource: { kind: 'any' } }], deny: [] })
    expect(lspAsk.ok).toBe(true)
  })

  it('the shell class keeps only whole-tool rules; allow-any is leader-only and dual-gated', () => {
    const memberAllow = projOf({ default: 'ask', allow: [{ tool: 'bash', resource: { kind: 'any' } }], ask: [], deny: [] }, { role: 'member' })
    expect(memberAllow.ok).toBe(false)
    if (memberAllow.ok) return
    expect(memberAllow.error.details?.['refusal']).toBe('projection-shell-allow-non-leader')

    const shellExact = projOf({ default: 'ask', allow: [], ask: [], deny: [{ tool: 'bash', resource: { kind: 'exact', path: '/x' } }] })
    expect(shellExact.ok).toBe(false)
    if (shellExact.ok) return
    expect(shellExact.error.details?.['refusal']).toBe('projection-rule-malformed')

    const noGate = projOf(
      { default: 'ask', allow: [{ tool: 'bash', resource: { kind: 'any' } }], ask: [], deny: [] },
      { role: 'leader' },
    )
    expect(noGate.ok).toBe(true)
    if (!noGate.ok) return
    const gatedRules = noGate.value.buildDocument().rules
    expect(gatedRules.some((rule) => rule.effectKind === 'tool-invoke' && rule.maximumEffect === 'allow')).toBe(false) // never an invented allow
    expect(gatedRules.every((rule) => rule.maximumEffect === 'ask')).toBe(true)
    expect(noGate.value.notes.some((n) => /dual-gate reader not wired/.test(n))).toBe(true)

    let execToken = false
    const gated = projOf(
      { default: 'ask', allow: [{ tool: 'bash', resource: { kind: 'any' } }], ask: [], deny: [] },
      { role: 'leader', leaderExecTokenPresent: () => execToken },
    )
    expect(gated.ok).toBe(true)
    if (!gated.ok) return
    expect(gated.value.buildDocument().rules.every((rule) => rule.maximumEffect === 'ask')).toBe(true)
    execToken = true // the overlay token arrives — the READ-time build answers the NEW state
    expect(gated.value.buildDocument().rules.every((rule) => rule.maximumEffect === 'allow')).toBe(true)
  })

  it('uncanonicalizable resources: allow SKIPS (tightens, noted); ask/deny REFUSE (a dropped rule loosens)', () => {
    const never = { canonicalizeResource: () => null }
    const allowSkipped = projOf({ default: 'ask', allow: [{ tool: 'read', resource: { kind: 'exact', path: 'relative/x.txt' } }], ask: [], deny: [] }, never)
    expect(allowSkipped.ok).toBe(true)
    if (!allowSkipped.ok) return
    expect(allowSkipped.value.buildDocument().rules).toEqual([])
    expect(allowSkipped.value.notes.some((n) => /SKIPPED/.test(n))).toBe(true)
    const denyRefused = projOf({ default: 'ask', allow: [], ask: [], deny: [{ tool: 'read', resource: { kind: 'exact', path: 'relative/x.txt' } }] }, never)
    expect(denyRefused.ok).toBe(false)
    if (denyRefused.ok) return
    expect(denyRefused.error.details?.['refusal']).toBe('projection-rule-uncanonicalizable')
    // without the injector, non-absolute paths are exactly the uncanonicalizable case:
    const noCanonicalizer = projOf({ default: 'ask', allow: [], ask: [{ tool: 'write', resource: { kind: 'exact', path: 'rel.txt' } }], deny: [] })
    expect(noCanonicalizer.ok).toBe(false)
  })

  it('default deny: the covers table answers per effect kind (the assembly gate rides it)', () => {
    const r = projOf({ default: 'deny', allow: [{ tool: 'read', resource: { kind: 'exact', path: A_ABS } }], ask: [], deny: [] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.templateDefault).toBe('deny')
    expect(r.value.coversEffect(readEffect(A_ABS))).toBe(true)
    expect(r.value.coversEffect(metaEffectOn(A_ABS))).toBe(true)
    expect(r.value.coversEffect(toolInvokeEffect('read'))).toBe(true)
    expect(r.value.coversEffect(writeEffect(A_ABS))).toBe(false)
    expect(r.value.coversEffect(listEffectOn('/data'))).toBe(false)
    expect(r.value.coversEffect(toolInvokeEffect('bash'))).toBe(false)
  })

  it('file any-ALLOW projects only the tool-invoke arm and DISCLOSES the resource-dimension gap', () => {
    const r = projOf({ default: 'ask', allow: [{ tool: 'read', resource: { kind: 'any' } }], ask: [], deny: [] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const kinds = r.value.buildDocument().rules.map((rule) => rule.effectKind)
    expect(kinds).toEqual(['tool-invoke'])
    expect(r.value.notes.some((n) => /TIGHTER than declared/.test(n))).toBe(true)
    expect(r.value.coversEffect(readEffect(A_ABS))).toBe(false) // resource effect stays no-authority ⇒ Ask
  })

  it('shape violations refuse before anything is derived (defence, the blueprint already validated)', () => {
    const badDefault = projOf({ default: 'allow', allow: [], ask: [], deny: [] } as unknown as TemplatePermissionPolicy)
    expect(badDefault.ok).toBe(false)
    if (badDefault.ok) return
    expect(badDefault.error.details?.['refusal']).toBe('projection-input-malformed')
    const badTool = projOf({ default: 'ask', allow: [{ tool: 'teleport', resource: { kind: 'any' } } as unknown as TemplatePermissionPolicy['allow'][number]], ask: [], deny: [] })
    expect(badTool.ok).toBe(false)
    const anyExtras = projOf({ default: 'ask', allow: [], ask: [], deny: [{ tool: 'bash', resource: { kind: 'any', path: '/x' } as unknown as TemplatePermissionPolicy['deny'][number]['resource'] }] })
    expect(anyExtras.ok).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// INVOCATION-ONLY CLASS (Alpha.5 M2, root 20:05 limited card) — the
// schedule_list / schedule_delete pair names the projection with the whole-
// tool `any` resource in ALL THREE lanes: the rule IS the invocation
// authority, projected on the `tool-invoke` arm with the SHARED algebra and
// R-1a deny sources (no new default-allow, no new matcher). exact/subtree
// refuse; the original seven names do not move (the file any-deny law
// narrowed to TRULY file tools keeps file/shell behavior byte-identical).
// ═══════════════════════════════════════════════════════════════════════════

describe('invocation-only class: schedule_list / schedule_delete projection law (root 20:05)', () => {
  const SCHEDULERS = ['schedule_list', 'schedule_delete'] as const

  it('allow-lane any projects the tool-invoke arm as ALLOW with no tightening note and no shell dual gate', () => {
    for (const name of SCHEDULERS) {
      const r = projOf({ default: 'deny', allow: [{ tool: name, resource: { kind: 'any' } }], ask: [], deny: [] })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      const spell = r.value.buildDocument().rules.map((rule) => `${rule.effectKind}@${rule.matcher.resource}:${rule.maximumEffect}`)
      expect(spell).toEqual([`tool-invoke@${REALM}|tool:${name}:allow`]) // the ONE arm — full authority, no companions
      expect(r.value.notes).toEqual([]) // the TIGHTER note is a file-class fact; nothing is tighter here
      expect(r.value.coversEffect(toolInvokeEffect(name))).toBe(true)
    }
    // Leader or member, with or without the exec-token reader: the class is
    // NOT shell — the projection never routes it into the dual gate.
    const leader = projOf({ default: 'deny', allow: [{ tool: 'schedule_delete', resource: { kind: 'any' } }], ask: [], deny: [] }, { role: 'leader', leaderExecTokenPresent: () => false })
    expect(leader.ok).toBe(true)
    if (!leader.ok) return
    expect(leader.value.buildDocument().rules.every((rule) => rule.maximumEffect === 'allow')).toBe(true)
    expect(leader.value.notes).toEqual([])
  })

  it('ask-lane any projects ASK; an absent rule stays no-authority (no implicit allow — 缺省 law)', () => {
    const asked = projOf({ default: 'deny', allow: [], ask: [{ tool: 'schedule_list', resource: { kind: 'any' } }], deny: [] })
    expect(asked.ok).toBe(true)
    if (!asked.ok) return
    expect(asked.value.buildDocument().rules.every((rule) => rule.maximumEffect === 'ask')).toBe(true)
    expect(asked.value.coversEffect(toolInvokeEffect('schedule_list'))).toBe(true)
    const none = projOf({ default: 'deny', allow: [], ask: [], deny: [] })
    expect(none.ok).toBe(true)
    if (!none.ok) return
    expect(none.value.coversEffect(toolInvokeEffect('schedule_list'))).toBe(false)
    expect(none.value.coversEffect(toolInvokeEffect('schedule_delete'))).toBe(false)
  })

  it('deny-lane any projects DENY with the shared R-1a deny sources (narrowed law: truly file only)', () => {
    const r = projOf({ default: 'ask', allow: [], ask: [], deny: [{ tool: 'schedule_delete', resource: { kind: 'any' } }] })
    expect(r.ok).toBe(true) // the OLD condition ("not shell") refused this; the narrowing does NOT
    if (!r.ok) return
    expect(r.value.buildDocument().rules.every((rule) => rule.maximumEffect === 'deny' && rule.effectKind === 'tool-invoke')).toBe(true)
    const sources = r.value.denySources()
    expect(sources.length).toBe(1)
    expect(sources[0]?.effectKind).toBe('tool-invoke')
    expect(sources[0]?.matcher.resource).toBe(`${REALM}|tool:schedule_delete`)
    expect(sources[0]?.ownerAuthority).toBe('human-user')
    expect(sources[0]?.sourceRef).toBe('tpl-1#deny[0]') // the SAME algebra names its origin
    expect(r.value.notes).toEqual([])
  })

  it('cross-tool no-cross: a schedule_list authority never answers for schedule_delete (and vice versa)', () => {
    const listOnly = projOf({ default: 'deny', allow: [{ tool: 'schedule_list', resource: { kind: 'any' } }], ask: [], deny: [] })
    expect(listOnly.ok).toBe(true)
    if (!listOnly.ok) return
    expect(listOnly.value.coversEffect(toolInvokeEffect('schedule_list'))).toBe(true)
    expect(listOnly.value.coversEffect(toolInvokeEffect('schedule_delete'))).toBe(false)
    expect(listOnly.value.buildDocument().rules.every((rule) => rule.matcher.resource === `${REALM}|tool:schedule_list`)).toBe(true)
    const deleteOnly = projOf({ default: 'deny', allow: [{ tool: 'schedule_delete', resource: { kind: 'any' } }], ask: [], deny: [] })
    expect(deleteOnly.ok).toBe(true)
    if (!deleteOnly.ok) return
    expect(deleteOnly.value.coversEffect(toolInvokeEffect('schedule_list'))).toBe(false)
    expect(deleteOnly.value.coversEffect(toolInvokeEffect('schedule_delete'))).toBe(true)
  })

  it('exact/subtree resources refuse the projection in every lane (no file matcher exists for the class)', () => {
    for (const lane of ['allow', 'ask', 'deny'] as const) {
      for (const name of SCHEDULERS) {
        for (const kind of ['exact', 'subtree'] as const) {
          const r = projOf({ default: 'ask', allow: [], ask: [], deny: [], [lane]: [{ tool: name, resource: { kind, path: A_ABS } }] } as unknown as TemplatePermissionPolicy)
          expect(r.ok).toBe(false)
          if (r.ok) return
          expect(r.error.details?.['refusal']).toBe('projection-rule-malformed')
          expect(String(r.error.message)).toContain('invocation-only')
        }
      }
    }
  })

  it('schedule_create / schedule_update are NOT enabled permission tools (card: create/update 禁启)', () => {
    for (const name of ['schedule_create', 'schedule_update']) {
      const r = projOf({ default: 'ask', allow: [{ tool: name, resource: { kind: 'any' } } as unknown as TemplatePermissionPolicy['allow'][number]], ask: [], deny: [] })
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.error.details?.['refusal']).toBe('projection-rule-malformed')
    }
  })

  it('the original seven names did not move: file any-deny still refuses, file any-lanes still disclose, member shell allow still refuses', () => {
    const fileAnyDeny = projOf({ default: 'ask', allow: [], ask: [], deny: [{ tool: 'read', resource: { kind: 'any' } }] })
    expect(fileAnyDeny.ok).toBe(false)
    if (fileAnyDeny.ok) return // expected refusal holds → CONTINUE to the byte-stable pins (root 20:57: inverted-guard fix)
    expect(fileAnyDeny.error.code).toBe('IO_POLICY_UNSUPPORTED')
    expect(fileAnyDeny.error.details?.['refusal']).toBe('projection-deny-unprojectable')
    expect(String(fileAnyDeny.error.message)).toContain("file-class tool 'read'") // byte-stable wording
    const fileAnyAsk = projOf({ default: 'ask', allow: [], ask: [{ tool: 'write', resource: { kind: 'any' } }], deny: [] })
    expect(fileAnyAsk.ok).toBe(true)
    if (fileAnyAsk.ok) expect(fileAnyAsk.value.notes.some((n) => /TIGHTER than declared/.test(n))).toBe(true) // file disclosure intact
    const memberShellAllow = projOf({ default: 'ask', allow: [{ tool: 'bash', resource: { kind: 'any' } }], ask: [], deny: [] }, { role: 'member' })
    expect(memberShellAllow.ok).toBe(false)
    if (memberShellAllow.ok) return // expected refusal holds → CONTINUE to the dual-gate pin (root 20:57: inverted-guard fix)
    expect(memberShellAllow.error.details?.['refusal']).toBe('projection-shell-allow-non-leader') // the dual-gate branch untouched
    const leaderShellAllow = projOf({ default: 'ask', allow: [{ tool: 'bash', resource: { kind: 'any' } }], ask: [], deny: [] }, { role: 'leader' })
    expect(leaderShellAllow.ok).toBe(true)
    if (leaderShellAllow.ok) expect(leaderShellAllow.value.notes.some((n) => /exec dual-gate reader not wired/.test(n))).toBe(true) // exec law intact
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// G6 SESSION-QUERY NAMES (Alpha.5 M2 continuation, root 22:13 limited card)
// — the five names ride the IDENTICAL invocation-only projection law the
// schedule pair opened: `any` in all three lanes projects the single
// `tool-invoke` arm (the rule IS the invocation authority), exact/subtree
// refuse, deny rides the shared R-1a sources, absence stays no-authority,
// each name a DISTINCT authority. Membership is list-driven
// (INVOCATION_ONLY_PERMISSION_TOOL_VALUES) — zero new kernel code; this
// block proves the widened list carries the law unchanged.
// ═══════════════════════════════════════════════════════════════════════════

describe('invocation-only class: G6 session-query projection law (root 22:13)', () => {
  const G6 = ['session_search', 'session_event_search', 'session_trace', 'session_event_trace', 'session_event_read'] as const

  it('allow-lane any projects the single tool-invoke arm as ALLOW for EVERY G6 name — no notes, no dual gate, no I/O companion arm', () => {
    for (const name of G6) {
      const r = projOf({ default: 'deny', allow: [{ tool: name, resource: { kind: 'any' } }], ask: [], deny: [] }, { leaderExecTokenPresent: () => false })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      const spell = r.value.buildDocument().rules.map((rule) => `${rule.effectKind}@${rule.matcher.resource}:${rule.maximumEffect}`)
      expect(spell).toEqual([`tool-invoke@${REALM}|tool:${name}:allow`]) // the ONE arm — invocation authority ONLY (no file/network arm exists to ride)
      expect(r.value.notes).toEqual([])
      expect(r.value.coversEffect(toolInvokeEffect(name))).toBe(true)
    }
  })

  it('ask-lane any projects ASK; an absent rule stays no-authority for every G6 name (no implicit allow under default:ask)', () => {
    const asked = projOf({ default: 'deny', allow: [], ask: [{ tool: 'session_trace', resource: { kind: 'any' } }], deny: [] })
    expect(asked.ok).toBe(true)
    if (!asked.ok) return
    expect(asked.value.buildDocument().rules.every((rule) => rule.maximumEffect === 'ask')).toBe(true)
    const none = projOf({ default: 'ask', allow: [], ask: [], deny: [] })
    expect(none.ok).toBe(true)
    if (!none.ok) return
    for (const name of G6) expect(none.value.coversEffect(toolInvokeEffect(name))).toBe(false)
  })

  it('deny-lane any projects DENY for all five names at once with five R-1a sources (one per ruleIndex, shared algebra)', () => {
    const r = projOf({ default: 'ask', allow: [], ask: [], deny: G6.map((name) => ({ tool: name, resource: { kind: 'any' } } as TemplatePermissionPolicy['deny'][number])) })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const sources = r.value.denySources()
    expect(sources.length).toBe(G6.length)
    expect(sources.map((s) => s.matcher.resource)).toEqual(G6.map((name) => `${REALM}|tool:${name}`))
    expect(sources.map((s) => s.sourceRef)).toEqual(G6.map((_, i) => `tpl-1#deny[${i}]`))
    expect(r.value.notes).toEqual([])
  })

  it('cross-name no-cross across the G6 five: an authority for one never answers for any other', () => {
    const only = projOf({ default: 'deny', allow: [{ tool: 'session_event_read', resource: { kind: 'any' } }], ask: [], deny: [] })
    expect(only.ok).toBe(true)
    if (!only.ok) return
    for (const name of G6) {
      expect(only.value.coversEffect(toolInvokeEffect(name))).toBe(name === 'session_event_read')
    }
  })

  it('exact/subtree are refused for every G6 name in every lane (projection refuses even partially — the class carries no resource space)', () => {
    for (const name of G6) {
      for (const lane of ['allow', 'ask', 'deny'] as const) {
        for (const kind of ['exact', 'subtree'] as const) {
          const r = projOf({ default: 'ask', allow: [], ask: [], deny: [], [lane]: [{ tool: name, resource: { kind, path: '/data/notes' } as unknown as TemplatePermissionPolicy['deny'][number]['resource'] }] } as TemplatePermissionPolicy)
          expect(r.ok).toBe(false)
          if (r.ok) return // expected refusal holds → continue (root 20:57 guard law)
          expect(r.error.details?.['refusal']).toBe('projection-rule-malformed')
          expect(String(r.error.message)).toContain('invocation-only')
        }
      }
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTION-CONFIRMED SETS (root 22:4x + 22:32 cards) — ten B-TEAM, three
// G1 pure-query, three B-SUBAGENT controls and FIVE spawn ops (joint
// candidate 9b5c9f4b2, whose closed effect envelope is tool-invoke ONLY,
// resource null — the projection law below is exactly what those rows
// consume) ride the IDENTICAL invocation-only projection law: list-driven
// membership, zero new kernel code. Team rows' durable writes adjudicate
// INSIDE the delegated chain (the template lane never projects them — the
// tool-invoke arm is the whole authority, so an invocation rule is no I/O
// exemption); the G1 rows walk the plane's ONE PA admission at their fixed
// native spellings; the trio's adjacency/ancestor law and the spawn side's
// provider/model/maxDepth constraints live in the service, not in a
// projected resource.
// ═══════════════════════════════════════════════════════════════════════════

describe('invocation-only class: production-confirmed sets projection law (root 22:4x + 22:32)', () => {
  const CONFIRMED = [
    'team_list_members', 'team_list_templates', 'team_inspect_config',
    'team_create_member', 'team_delegate', 'team_follow_up', 'team_collect',
    'team_send_message', 'team_report_progress', 'team_archive_member',
    'cordis_inspect_list', 'cordis_inspect_query', 'team_list_pending_control',
    'interrupt_agent', 'list_agents', 'send_message',
    'subagent', 'subagent_fork', 'subagent_codex', 'subagent_claude_code',
    'list_subagent_models',
  ] as const

  it('allow-lane any projects the single tool-invoke arm as ALLOW for EVERY confirmed name — no notes, no dual gate, no companion effect kind', () => {
    for (const name of CONFIRMED) {
      const r = projOf({ default: 'deny', allow: [{ tool: name, resource: { kind: 'any' } }], ask: [], deny: [] }, { leaderExecTokenPresent: () => false })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      const spell = r.value.buildDocument().rules.map((rule) => `${rule.effectKind}@${rule.matcher.resource}:${rule.maximumEffect}`)
      expect(spell).toEqual([`tool-invoke@${REALM}|tool:${name}:allow`])
      expect(r.value.notes).toEqual([])
      expect(r.value.coversEffect(toolInvokeEffect(name))).toBe(true)
    }
  })

  it('deny-lane any projects DENY for all twenty-one at once — twenty-one R-1a sources, one per ruleIndex (shared algebra, nothing dropped)', () => {
    const r = projOf({ default: 'ask', allow: [], ask: [], deny: CONFIRMED.map((name) => ({ tool: name, resource: { kind: 'any' } } as TemplatePermissionPolicy['deny'][number])) })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const sources = r.value.denySources()
    expect(sources.length).toBe(CONFIRMED.length)
    expect(sources.map((s) => s.matcher.resource)).toEqual(CONFIRMED.map((name) => `${REALM}|tool:${name}`))
    expect(r.value.notes).toEqual([])
  })

  it('cross-name no-cross: team_delegate authority answers for NO other confirmed name; send_message answers only for itself', () => {
    const d = projOf({ default: 'deny', allow: [{ tool: 'team_delegate', resource: { kind: 'any' } }], ask: [], deny: [] })
    expect(d.ok).toBe(true)
    if (!d.ok) return
    for (const name of CONFIRMED) expect(d.value.coversEffect(toolInvokeEffect(name))).toBe(name === 'team_delegate')
    const m = projOf({ default: 'deny', allow: [{ tool: 'send_message', resource: { kind: 'any' } }], ask: [], deny: [] })
    expect(m.ok).toBe(true)
    if (!m.ok) return
    expect(m.value.coversEffect(toolInvokeEffect('send_message'))).toBe(true)
    expect(m.value.coversEffect(toolInvokeEffect('interrupt_agent'))).toBe(false)
  })

  it('exact/subtree refused for every confirmed name in every lane (fail closed at BOTH gates; no partial projection)', () => {
    for (const name of CONFIRMED) {
      for (const lane of ['allow', 'ask', 'deny'] as const) {
        for (const kind of ['exact', 'subtree'] as const) {
          const r = projOf({ default: 'ask', allow: [], ask: [], deny: [], [lane]: [{ tool: name, resource: { kind, path: '/data/notes' } as unknown as TemplatePermissionPolicy['deny'][number]['resource'] }] } as TemplatePermissionPolicy)
          expect(r.ok).toBe(false)
          if (r.ok) return // expected refusal holds → continue (root 20:57 guard law)
          expect(r.error.details?.['refusal']).toBe('projection-rule-malformed')
          expect(String(r.error.message)).toContain('invocation-only')
        }
      }
    }
  })
})
