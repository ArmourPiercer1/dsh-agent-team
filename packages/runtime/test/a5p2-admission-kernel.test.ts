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
import { parseOperationGrant, type AdmissionRequest, type OperationGrant } from '../../domain/tool-governance/src/index.js'
import type { AssuranceProbe, PresentedApproval } from '../tool-admission/index.js'
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
import { allowPolicy, emptyPolicy, hardRulesDocs, makeHarness, recordPorts } from './a5p2-kernel-harness.js'
import { policyDoc } from './a5p2-fixtures.js'
import type { ToolPolicyDocument } from '../../domain/tool-governance/src/index.js'

const FP = 'sha256:' + 'd'.repeat(64)

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

function approvalFor(request: AdmissionRequest, over: Partial<PresentedApproval> = {}): PresentedApproval {
  return {
    approvalCaseId: 'tadm-case-1',
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

  it('a policy DENY on one effect is a whole-set typed denial, unapprovable (no case opens)', async () => {
    const poisoned = effects(readEffect(), writeEffect())
    const request = requestOf({ requestedEffects: poisoned })
    const denyPolicy = policyDoc([{ effectKind: 'write', resource: scopeResource(writeEffect()), maximumEffect: 'deny' }])
    const ports = recordPorts()
    const { kernel } = makeHarness({ policy: () => denyPolicy, ports })
    const decision = await kernel.admit(request)
    if (!decision.ok || decision.value.kind !== 'denied') throw new Error(JSON.stringify(decision))
    expect(decision.value.error.code).toBe('IO_POLICY_UNSUPPORTED')
    expect(decision.value.error.details?.refusal).toBe('effect-set-unapprovable')
    expect(decision.value.error.details?.effectIndex).toBe(1)
    expect(ports.registrations).toBe(0)
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

  it('a deny that arrives while the Ask is open kills the issue (stale is a refusal, not a retry)', async () => {
    const request = requestOf({ requestedEffects: effects(readEffect()) })
    let poisoned: ToolPolicyDocument = emptyPolicy()
    const { kernel } = makeHarness({ policy: () => poisoned })
    expect((await kernel.admit(request)).ok).toBe(true)
    poisoned = policyDoc([{ effectKind: 'read', resource: scopeResource(readEffect()), maximumEffect: 'deny' }])
    const issued = await kernel.issueApprovedGrant(request, approvalFor(request))
    expect(issued.ok).toBe(false)
    if (!issued.ok) expect(issued.error.details?.refusal).toBe('effect-set-unapprovable-at-issue')
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
