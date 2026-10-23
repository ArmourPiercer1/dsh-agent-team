/**
 * a5-m1-control-legs — C1 STAND-IN legs for the plane mount's `controlLeg`
 * seam. DISCLOSED SCOPE (root ruling, M1): these stand-ins are C1-level
 * only — they run the REAL kernel landing edge (`assembly.issueApprovedGrant`
 * → returned grant, fingerprint-bound, one-shot) but they create NO durable
 * Control request row and run NO `guardOperation` consumption. The FROZEN
 * full-obligation leg (durable row create/reuse → real decision → presenter
 * → issueApprovedGrant → guardOperation consume) is the AUTH bridge
 * (operation-permission/pa-control-bridge.ts) — C2 acceptance runs THAT.
 * The center now rejects any leg that returns an approval without a landed
 * grant (APPROVAL_LEG_INCOMPLETE), so even these stand-ins must land for
 * real; nothing here fakes a Control row.
 */

/** Approving C1 stand-in: lands the kernel's own plan for real (grant
 *  minted via issueApprovedGrant); no durable Control row, no guardOperation
 *  — the delta to the frozen leg is exactly what the AUTH bridge adds. */
export function approvingControlLeg(audit = []) {
  return async ({ callId, request, plan, assembly }) => {
    audit.push(`c1-standin-landing paCase=${plan.approvalCaseId} rung=${plan.requiredAuthority}`)
    const approval = {
      approvalCaseId: plan.approvalCaseId,
      reviewerAuthority: plan.requiredAuthority,
      beneficiaryAuthority: 'member',
      requiredAuthorityAtCreation: plan.requiredAuthority,
      effectSetFingerprint: plan.effectSetFingerprint,
      authorityGenerationAtCreation: plan.authorityGeneration,
      deniedEffectsAtCreation: plan.deniedEffects,
    }
    const issued = await assembly.issueApprovedGrant(request, approval)
    if (issued.ok !== true) {
      return { decision: 'deny', requestId: `c1-standin-${callId}`, detail: String(issued.error?.message ?? 'landing refused') }
    }
    return { decision: 'approve', requestId: `c1-standin-${callId}`, approval, grant: issued.value }
  }
}

/** Denying leg: the request settles deny — body must never run. */
export function denyingControlLeg(audit = []) {
  return async ({ callId, plan }) => {
    audit.push(`c1-standin paCase=${plan.approvalCaseId} decision=deny`)
    return { decision: 'deny', requestId: `c1-standin-${callId}` }
  }
}
