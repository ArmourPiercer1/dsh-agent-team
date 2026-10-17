/**
 * `@dsh-agent-team/runtime/tool-admission` — the Alpha.5 PR2 lane: unified
 * Operation Admission, the multi-effect Ask on the ONE logical Alpha.4
 * ApprovalCase, and the single-use ExecutionGrant (implementation plan §5;
 * design §4.2/§4.3/§5; hard clauses H1/H2 from the user's 05:4x/07:0xZ
 * instructions).
 *
 * REUSE, NOT A SECOND ALGEBRA (the same law PR0/PR1 pinned):
 *  - the deny/ask/allow rank, the meet lattice and BOTH plane arms come from
 *    PR0 `planes.ts` (which aliases the Alpha.4 `authority-envelope` grammar)
 *    — the two dual-plane functions are used as the TWO FUNCTIONS they are,
 *    never folded and never re-implemented;
 *  - the rung ladder, `mayReview` and the ceiling walk are Alpha.4's
 *    (`governance/authority-ceiling` + `governance/runtime-authority`), and
 *    the effect-set plan mirrors the all-or-nothing batching the mutation
 *    lane established (`planPermissionMutationApproval`);
 *  - grant validation is PR0's `validateGrantForCall` with its frozen
 *    precedence and frozen §5 reason→code mapping; leases are PR0's
 *    `ExecutionLease` algebra; nothing here restates a law owned upstream.
 *
 * THE HARD CLAUSES:
 *  - H1 (clock.ts): every clock entering an authorization/expiry decision is
 *    verified FINITE by Admission first; NaN/±∞ = typed fail-closed, body=0.
 *    The expiry stays PR0's strict `>` — unchanged.
 *  - H2 (assurance-runtime.ts): assurance is runtime-verified BEFORE any
 *    hard-profile consumption; a level never redeems alone (real
 *    evidence/realmId/trustRoot matched against the probe; enforced+null =
 *    refusal). The probe is an injected port; stub semantics in README.md.
 *
 * DORMANT-BY-DEFAULT like its siblings: no shipped glue imports this barrel
 * yet; the layer audit names this lane as the reviewed PR2 consumer. Live
 * assembly wiring rides with the first PR that executes through it (PR3/PR4).
 *
 * @module @dsh-agent-team/runtime/tool-admission
 */

export { classifyClock, requireFiniteClock, type ClockRefusalKind } from './clock.js'

export {
  createStubAssuranceProbe,
  verifyAssuranceForHardProfile,
  type AssuranceProbe,
  type AssuranceProbeAnswer,
  type AssuranceProbeRecord,
  type AssuranceRuntimeRefusal,
  type VerifiedAssurance,
} from './assurance-runtime.js'

export {
  effectApprovalScope,
  evaluateEffectSetExpansion,
  planEffectSetApproval,
  toolAskApprovalCaseId,
  verifyEffectSetApproval,
  type EffectSetApprovalPlan,
  type EffectSetPlanOutcome,
  type EffectSetExpansion,
  type PolicyDenySource,
  type PresentedApproval,
  type UnapprovableReason,
} from './approval-case.js'

export {
  createGrantLedger,
  mintOperationGrant,
  type ConsumeOutcome,
  type GrantLedger,
  type MintInputs,
} from './grant-mint.js'

export {
  createAdmissionKernel,
  // PR2/PR3 production-assembly round: the production entry class + the
  // template-policy → PR0 projection it derives from (contract: evidence
  // `alpha5/prod/pa-CONTRACT.md`).
  createProductionAdmissionAssembly,
  deriveTeamPolicyAuthority,
  grantIdForCall,
  type AdmissionKernel,
  type AdmissionKernelOptions,
  type ExecutionCallFields,
  type ProductionAdmissionAssembly,
  type ProductionAdmissionConfig,
  type ProductionFsAdmissionPort,
  type RequiredAssuranceReader,
  type TemplatePolicyProjection,
  type TemplatePolicyProjectionInput,
} from './admission-kernel.js'
