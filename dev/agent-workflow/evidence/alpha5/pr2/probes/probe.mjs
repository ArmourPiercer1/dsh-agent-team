// probe.mjs — Alpha.5 PR2 hard-ceiling re-audit probe (READ-ONLY, no state outside this process).
// Pinned to the audited commit: worktree .worktrees/a5-pr2 @ branch alpha5-pr2-admission-grant
// code head af3e046bebf86c8879a3428f879e5494fc1c2be2 (committed dist, no build required).
// Run: node <this file>   (node v24.21.0 used; dist is plain ESM)
const W = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2'
const D = `${W}/packages/runtime/dist`

import { createAdmissionKernel, createGrantLedger, createStubAssuranceProbe,
  evaluateEffectSetExpansion, verifyEffectSetApproval }
  from '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2/packages/runtime/dist/packages/runtime/tool-admission/index.js'
import { bindingDocs, grantCeiling }
  from '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2/packages/runtime/dist/packages/runtime/governance/authority-ceiling.js'
import { evaluateAuthorityCeiling }
  from '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2/packages/runtime/dist/packages/runtime/governance/runtime-authority.js'
import { parseToolBinding, parseRequestedEffectSet, parseToolPolicyDocument }
  from '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2/packages/runtime/dist/packages/domain/tool-governance/src/index.js'
import { resolveEffectivePolicy }
  from '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2/packages/runtime/dist/packages/domain/policy/src/index.js'
import { hasAuthorityResolver, CONTROL_UNRESOLVABLE_AUTHORITIES }
  from '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2/packages/runtime/dist/packages/runtime/control/types.js'
import { parseRootSessionId, parseTeamSessionId, parseInstanceId, createMemberIdentity }
  from '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2/packages/runtime/dist/packages/domain/policy/src/contracts-mirror.js'

const J = (x) => JSON.stringify(x)
const LINE = (s) => console.log(s)
const FIXED_NOW = 1_737_000_000_000
const REALM = 'realm-a'
const MEMBER = { teamSessionId: 'ts-1', instanceId: 'inst-2' }

// ---------- assurance contract / binding (a5p2-fixtures.ts verbatim shapes) ----------
function dimensionRecord(level) {
  const real = level === 'enforced' || level === 'author-trusted'
  return { level, mechanism: real ? 'landlock-abi4-selflock' : null, realmId: REALM,
    trustRoot: real ? 'os:kernel-6.12' : null, evidence: real ? 'evidence/a5p4/probe.json' : null }
}
function assuranceContract() {
  const dims = ['content-read', 'directory-metadata', 'write', 'alias', 'network-destination', 'inherit-cancel']
  const assurance = {}
  for (const d of dims) assurance[d] = dimensionRecord('untested')
  return { implementationOrigin: 'team-trusted-extension', executionBoundary: 'confined-subprocess', assurance }
}
function makeBinding(toolName) {
  const assurance = assuranceContract()
  const parsed = parseToolBinding({
    bindingId: 'bind-p2-secret-1', agentScopeKey: 'session-m1', toolName,
    definitionIdentity: `def:${toolName}`, providerId: 'team-adapter',
    implementationOrigin: assurance.implementationOrigin, executionBoundary: assurance.executionBoundary,
    assurance, policyGeneration: 1, authorityGeneration: 1, revision: 1, status: 'ACTIVE',
  })
  if (!parsed.ok) throw new Error(`binding rejected: ${J(parsed.problems)}`)
  return parsed.value
}

// ---------- shared inputs (previous audit §1.2: THE only variable is who reviews) ----------
const EFFECTS_PARSED = parseRequestedEffectSet([{ kind: 'tool-invoke', toolName: 'p2.secret', resource: null }])
if (!EFFECTS_PARSED.ok) throw new Error(`effects rejected: ${J(EFFECTS_PARSED.problems)}`)
const EFFECTS = EFFECTS_PARSED.value
const BINDING = makeBinding('p2.secret')
const SCOPE = { operationClass: 'tool-invoke', matcher: { kind: 'exact', resource: `${REALM}|tool:p2.secret` } }
const HARD_DENY_RULE = { operationClass: 'tool-invoke', matcher: { kind: 'exact', resource: `${REALM}|tool:p2.secret` }, maximumEffect: 'deny' }
const UNRELATED_ALLOW_RULE = { operationClass: 'tool-invoke', matcher: { kind: 'exact', resource: `${REALM}|tool:other` }, maximumEffect: 'allow' }
const DOCS = Object.freeze({
  teamHardEnvelope: { rules: [HARD_DENY_RULE] },          // hard ceiling: deny on this scope
  permissionMutationEnvelope: { rules: [UNRELATED_ALLOW_RULE] }, // unrelated to this case
})
const policyDoc = (maximumEffect) => {
  const p = parseToolPolicyDocument({ rules: [{ realmId: REALM, effectKind: 'tool-invoke',
    matcher: { kind: 'exact', resource: `${REALM}|tool:p2.secret` }, maximumEffect }] })
  if (!p.ok) throw new Error(`policy rejected: ${J(p.problems)}`)
  return p.value
}
const POLICY_ASK = policyDoc('ask')
const POLICY_DENY = policyDoc('deny')
const POLICY_ALLOW = policyDoc('allow')

function makeKernel(documents, policyDocument, events) {
  return createAdmissionKernel({
    clock: () => FIXED_NOW, authorityGeneration: () => 1,
    documents: () => documents, policyDocument: () => policyDocument,
    beneficiaryAuthority: 'member', assuranceProbe: createStubAssuranceProbe({}),
    requiredAssurance: () => ({}), ledger: createGrantLedger(),
    onObserve: (e) => events.push(e.event),
  })
}
const REQUEST = { binding: BINDING, member: MEMBER, callId: 'call-1', realmId: REALM,
  parametersFingerprint: `sha256:${'a'.repeat(64)}`, requestedEffects: EFFECTS }
const approvalFor = (reviewer, caseId) => ({
  approvalCaseId: caseId, reviewerAuthority: reviewer, beneficiaryAuthority: 'member',
  requiredAuthorityAtCreation: reviewer, effectSetFingerprint: EFFECTS.fingerprint,
  authorityGenerationAtCreation: 1,
})
const CALL = { currentAuthorityGeneration: 1, member: MEMBER, callId: 'call-1', realmId: REALM,
  bindingId: 'bind-p2-secret-1', bindingRevision: 1, parametersFingerprint: `sha256:${'a'.repeat(64)}`,
  requestedEffects: EFFECTS }

// ===========================================================================
LINE('== GATE G8 (Alpha.4 Control resolver-availability gate) ==')
LINE(`CONTROL_UNRESOLVABLE_AUTHORITIES = ${J(CONTROL_UNRESOLVABLE_AUTHORITIES)}`)
LINE(`hasAuthorityResolver('human-admin') = ${hasAuthorityResolver('human-admin')}`)

// ===========================================================================
LINE('')
LINE('== ARM A (baseline reproduction: teamHardEnvelope deny + human-admin reviewer) ==')
for (const rung of ['member', 'leader', 'human-user', 'human-admin']) {
  let bd, gc
  try { bd = J(bindingDocs(rung, DOCS).map(d => d.rules.length)) } catch (e) { bd = `REFUSED ${e.code}/${e.problem}` }
  try { gc = J(grantCeiling(rung, DOCS, SCOPE)) } catch (e) { gc = `REFUSED ${e.code}/${e.problem}` }
  LINE(`${rung.padEnd(12)}: bindingDocs = ${bd}   grantCeiling = ${gc}`)
}
const ev = evaluateAuthorityCeiling({ beneficiaryAuthority: 'member', initiatorAuthority: 'member',
  operationClass: SCOPE.operationClass, matcher: SCOPE.matcher, desiredEffect: 'allow', documents: DOCS })
LINE(`evaluateAuthorityCeiling   -> outcome=${ev.outcome} requiredAuthority=${ev.requiredAuthority ?? 'n/a'} roseBecauseInsufficient=${J(ev.roseBecauseInsufficient ?? null)}`)
LINE(`evaluateEffectSetExpansion -> ${J(evaluateEffectSetExpansion(EFFECTS, REALM, POLICY_ASK))}`)
const planK = makeKernel(DOCS, POLICY_ASK, [])
const planned = planK.planApproval(REQUEST)
LINE(`planApproval               -> ${J(planned)}`)
const caseId = planned.value.approvalCaseId
for (const reviewer of ['human-admin', 'human-user', 'leader']) {
  const v = verifyEffectSetApproval({ effects: EFFECTS, realmId: REALM, approval: approvalFor(reviewer, caseId),
    currentAuthorityGeneration: 1, documents: DOCS })
  LINE(`verifyEffectSetApproval(reviewer=${reviewer}) -> ${v.ok ? 'ACCEPTED' : 'REFUSED'} ${J(v.ok ? v.value : v.error)}`)
}
const eventsA = []
const kernelA = makeKernel(DOCS, POLICY_ASK, eventsA)
const admitted = await kernelA.admit(REQUEST)
LINE(`admit()                    -> ${J({ kind: admitted.ok ? admitted.value.kind : 'error',
  reason: admitted.ok ? admitted.value.reason : admitted.error })}`)
const minted = await kernelA.issueApprovedGrant(REQUEST, approvalFor('human-admin', caseId))
LINE(`issueApprovedGrant()       -> ${minted.ok ? `MINTED grant ${minted.value.grantId} singleUse=${minted.value.singleUse} expiresAt=${J(minted.value.expiresAt ?? null)}` : `REFUSED ${J(minted.error)}`} events=${J(eventsA)}`)
if (minted.ok) {
  const c1 = kernelA.consumeForExecution(minted.value, CALL)
  LINE(`consumeForExecution(grant) -> ${J(c1.ok ? { ok: true, lease: c1.value.lease } : c1.error)}`)
  const c2 = kernelA.consumeForExecution(minted.value, CALL)
  LINE(`consumeForExecution(again) -> ${c2.ok ? 'ACCEPTED (BUG)' : `REFUSED ${J(c2.error)}`}`)
}

// ===========================================================================
LINE('')
LINE('== ARM B1 (inject external-hard-shaped DENY as an extra document slot) ==')
const DOCS_B1 = { ...DOCS, externalHard: { rules: [HARD_DENY_RULE] } }
const eventsB1 = []
const kernelB1 = makeKernel(DOCS_B1, POLICY_ASK, eventsB1)
await kernelB1.admit(REQUEST)
const mintedB1 = await kernelB1.issueApprovedGrant(REQUEST, approvalFor('human-admin', caseId))
LINE(`documents carries externalHard:{rules:[deny]} -> ${mintedB1.ok ? `MINTED grant ${mintedB1.value.grantId} (injection NOT READ by kernel)` : `REFUSED ${J(mintedB1.error)}`} events=${J(eventsB1)}`)
const cB1 = mintedB1.ok ? kernelB1.consumeForExecution(mintedB1.value, CALL) : null
LINE(`consumeForExecution        -> ${cB1 ? J({ ok: cB1.ok, lease: cB1.ok ? cB1.value.lease : undefined }) : 'n/a'}`)
LINE(`grantCeiling('human-admin', DOCS_B1) = ${J(grantCeiling('human-admin', DOCS_B1, SCOPE))}`)

// ===========================================================================
LINE('')
LINE('== ARM B2 (external-hard fact routed as ToolPolicyDocument deny) ==')
const eventsB2 = []
const kernelB2 = makeKernel(DOCS, POLICY_DENY, eventsB2)
const admittedB2 = await kernelB2.admit(REQUEST)
LINE(`admit(policy=deny)         -> ${J({ kind: admittedB2.ok ? admittedB2.value.kind : 'error',
  value: admittedB2.ok ? admittedB2.value : admittedB2.error })}`)
const mintedB2 = await kernelB2.issueApprovedGrant(REQUEST, approvalFor('human-admin', caseId))
LINE(`issueApprovedGrant()       -> ${mintedB2.ok ? `MINTED ${mintedB2.value.grantId}` : `REFUSED ${J(mintedB2.error)}`} events=${J(eventsB2)}`)

// ===========================================================================
LINE('')
LINE('== ARM C (policy allow, hard Envelope deny still present) ==')
const eventsC = []
const kernelC = makeKernel(DOCS, POLICY_ALLOW, eventsC)
const admittedC = await kernelC.admit(REQUEST)
LINE(`admit()                    -> ${J(admittedC)} events=${J(eventsC)}`)

// ===========================================================================
LINE('')
LINE('== ARM D (domain/policy stage-2 external-hard face, Invariant 34 / §25.4) ==')
const ROOT = parseRootSessionId('session-root-1')
const TEAM = parseTeamSessionId('session-root-1')
const IDN = createMemberIdentity(ROOT, parseInstanceId('inst-a'))
const ALLOW_ITEMS = ['p2.secret']
const baseIn = (external, extra = {}) => ({ teamSessionId: TEAM, member: IDN,
  blueprint: {}, template: {}, policyState: { stateId: 'default' }, external, ...extra })
const cellOf = (out, cap) => {
  const cell = out.cells[cap]
  return { effective: cell.effective, note: cell.external.note, removedItems: cell.external.removedItems }
}
const d1 = resolveEffectivePolicy(baseIn({ hard: { tools: { kind: 'deny' } }, capabilityExists: {} },
  { humanOverride: { overrideId: 'ovh-1', scope: 'team', values: { tools: { kind: 'allow', items: ALLOW_ITEMS } } } }))
LINE(`D1 humanOverride allow + external hard deny -> ${J(cellOf(d1, 'tools'))}`)
const d2 = resolveEffectivePolicy(baseIn({ hard: { tools: { kind: 'allow', items: ['other'] } }, capabilityExists: {} },
  { humanOverride: { overrideId: 'ovh-1', scope: 'team', values: { tools: { kind: 'allow', items: ALLOW_ITEMS } } } }))
LINE(`D2 humanOverride allow + hard allow-list excludes item -> ${J(cellOf(d2, 'tools'))}`)
const d3 = resolveEffectivePolicy(baseIn({ hard: {}, capabilityExists: { tools: false } },
  { humanOverride: { overrideId: 'ovh-1', scope: 'team', values: { tools: { kind: 'allow', items: ALLOW_ITEMS } } } }))
LINE(`D3 humanOverride allow + capabilityExists:false -> ${J(cellOf(d3, 'tools'))}`)
LINE('probe done.')
