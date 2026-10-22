/**
 * a5-m1-control-legs — TEST-SIDE implementations of the plane mount's
 * `controlLeg` seam (the AUTH-owned durable-Control contract, in-process).
 *
 * The M1 center wiring (team-tool-plane paAdmit) treats the PA kernel's
 * approvalCaseId as a LOGICAL id: requires-approval is only functional
 * through a control leg that stands for a REAL Control request row. These
 * helpers stand for that row IN-PROCESS for unit acceptance: they carry the
 * kernel's own plan (case id, rung, fingerprint, generation, denied-effect
 * provenance) into the kernel's `issueApprovedGrant` landing edge, so the
 * approved grant is real (fingerprint-bound, generation-checked, one-shot).
 * Real-Host C2 kits replace ONLY this file's body with the controlService
 * request/decision legs; the mount seam and everything downstream stay.
 */

/** Approving leg: lands the kernel's own plan unchanged (rung as planned). */
export function approvingControlLeg(audit = []) {
  return async ({ callId, plan }) => {
    audit.push(`control-request-created paCase=${plan.approvalCaseId} rung=${plan.requiredAuthority}`)
    return {
      decision: 'approve',
      requestId: `test-ctl-${callId}`,
      approval: {
        approvalCaseId: plan.approvalCaseId,
        reviewerAuthority: plan.requiredAuthority,
        beneficiaryAuthority: 'member',
        requiredAuthorityAtCreation: plan.requiredAuthority,
        effectSetFingerprint: plan.effectSetFingerprint,
        authorityGenerationAtCreation: plan.authorityGeneration,
        deniedEffectsAtCreation: plan.deniedEffects,
      },
    }
  }
}

/** Denying leg: the durable request settles deny — body must never run. */
export function denyingControlLeg(audit = []) {
  return async ({ callId, plan }) => {
    audit.push(`control-request-created paCase=${plan.approvalCaseId} decision=deny`)
    return { decision: 'deny', requestId: `test-ctl-${callId}` }
  }
}
