/**
 * a5-m1-control-legs.d.ts — the declaration half of `a5-m1-control-legs.mjs`
 * (an untyped `.mjs` test helper: the CI typecheck leg includes `test/`, so
 * the helper's consumers need a real declaration instead of `any`).
 *
 * DECLARED SCOPE (identical to the module header — no silent widening):
 * these are C1 STAND-IN legs. They run the REAL kernel landing edge
 * (`assembly.issueApprovedGrant` → a fingerprint-bound one-shot grant) and
 * create NO durable Control request row and run NO `guardOperation`
 * consumption. The frozen full-obligation leg is the AUTH bridge
 * (`operation-permission/pa-control-bridge.ts`); C2 acceptance runs THAT.
 */

/** The plan the plane hands a leg: `assembly.planApproval(request).value`. */
export interface ControlLegPlan {
  readonly approvalCaseId: string
  readonly requiredAuthority: string
  readonly effectSetFingerprint: string
  readonly authorityGeneration: number
  readonly deniedEffects?: readonly unknown[]
  readonly perEffectRequired?: readonly string[]
  readonly [key: string]: unknown
}

/** The only assembly member a leg may touch: the kernel's own landing edge. */
export interface ControlLegAssembly {
  issueApprovedGrant(
    request: unknown,
    approval: Record<string, unknown>,
  ): { readonly ok: boolean; readonly value?: unknown; readonly error?: { readonly message?: string } }
}

/** What the plane's `controlLeg` seam passes. */
export interface ControlLegInput {
  readonly realmId?: string
  readonly callId: string
  readonly request: unknown
  readonly plan: ControlLegPlan
  readonly assembly: ControlLegAssembly
  readonly member?: unknown
  readonly signal?: { readonly aborted?: boolean }
}

/** The leg's settle: approve MUST carry a landed grant (the center rejects
 *  an approval without one as APPROVAL_LEG_INCOMPLETE). */
export type ControlLegResult =
  | { readonly decision: 'approve'; readonly requestId: string; readonly approval: Record<string, unknown>; readonly grant: unknown; readonly manifest?: unknown }
  | { readonly decision: 'deny'; readonly requestId?: string; readonly detail?: string }

export type ControlLegAudit = string[]

/** Approving C1 stand-in (lands the kernel grant for real; no Control row). */
export declare function approvingControlLeg(
  audit?: ControlLegAudit,
): (input: ControlLegInput) => Promise<ControlLegResult>

/** Denying leg: the request settles deny; the body must never run. */
export declare function denyingControlLeg(
  audit?: ControlLegAudit,
): (input: Pick<ControlLegInput, 'callId' | 'plan'>) => Promise<ControlLegResult>
