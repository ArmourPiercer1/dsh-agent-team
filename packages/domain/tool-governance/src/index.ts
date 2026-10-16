/**
 * `@dsh-agent-team/domain/tool-governance` — the Alpha.5 PR0 internal lane:
 * pure contracts and the immutable authorization algebra (implementation
 * plan §3; design §2.1/§4.1/§4.2/§4.3/§5).
 *
 * DORMANT BY CONTRACT: no shipped source anywhere in `packages` imports this
 * barrel — the lane is wired by PR1+ as a reviewed change (the
 * `a5p0-layer-audit` test fails the moment production touches it). It is also
 * PURE: no `node:*`, no
 * DSH imports, no I/O, no clock (the clock arrives per call), no persistence
 * (consumption reaches `validateGrantForCall` as an injected view). Blueprint
 * v3 remains CLOSED: nothing here is a v3 field (design §8: PR8 owns vNext).
 *
 * REUSE, NOT SECOND FACTS (the task's hard line): the deny/ask/allow rank
 * table, the meet lattice, the matching walk and BOTH plane semantics are
 * imported from `domain/authority-envelope` — the Alpha.4 grammar (ADR
 * A3-9/A1-4) — not restated; the lane adds the Realm dimension by SCOPING,
 * pinned rule-for-rule against the shared algebra by `a5p0-planes`.
 *
 * @module @dsh-agent-team/domain/tool-governance
 */

export {
  canonicalJsonFingerprint,
  canonicalJsonStringify,
} from './canonical-json.js'

export {
  TOOL_CONTRACT_PROBLEM_CODES,
  closeRecordKeys,
  isRecord,
  problemCodesOf,
} from './parse-util.js'
export type { ParseResult, ToolContractProblem, ToolContractProblemCode } from './parse-util.js'

export {
  RESOURCE_KINDS,
  RESOURCE_RIGHTS,
  RESOURCE_RIGHT_MATRIX,
  parseResourceRef,
  resourceEquals,
  resourceIdentityKey,
} from './resource.js'
export type { ResourceKind, ResourceRef, ResourceRight } from './resource.js'

export {
  EFFECT_KINDS,
  EFFECT_REQUIRED_RIGHT,
  effectIdentityKey,
  effectsAreSubset,
  parseRequestedEffectSet,
} from './effects.js'
export type { DomainRefEffect, Effect, EffectKind, RequestedEffectSet, ResourceEffect, ToolInvokeEffect } from './effects.js'

export {
  ASSURANCE_DIMENSIONS,
  ASSURANCE_LEVELS,
  EXECUTION_BOUNDARIES,
  IMPLEMENTATION_ORIGINS,
  assuranceSatisfies,
  parseAssuranceContract,
} from './assurance.js'
export type { AssuranceContract, AssuranceDimension, AssuranceLevel, AssuranceRequirement, ExecutionBoundary, ImplementationOrigin } from './assurance.js'

export {
  BINDING_STATES,
  BINDING_TRANSITIONS,
  advanceBindingStatus,
  parseToolBinding,
} from './binding.js'
export type { BindingAdvance, BindingState, ToolBinding } from './binding.js'

export {
  GRANT_REFUSAL_REASONS,
  grantRefusalErrorCode,
  parseOperationGrant,
  validateGrantForCall,
} from './grant.js'
export type { GrantCallContext, GrantConsumptionLedgerView, GrantRefusalReason, GrantValidation, MemberRef, OperationGrant } from './grant.js'

export {
  EXECUTION_LEASE_KINDS,
  LEASE_STATUSES,
  openExecutionLease,
  parseExecutionLease,
  requestLeaseCancellation,
  settleLeaseTermination,
} from './lease.js'
export type { ExecutionLease, ExecutionLeaseKind, LeaseAdvance, LeaseStatus } from './lease.js'

export {
  EFFECT_RANK,
  evaluateToolPolicyApprovalNarrowing,
  evaluateToolPolicyExpansionAuthority,
  parseToolPolicyDocument,
} from './planes.js'
export type { ToolPolicyCeiling, ToolPolicyDocument, ToolPolicyMatcher, ToolPolicyRule, ToolPolicyScope } from './planes.js'

export { GOVERNANCE_ERROR_CODES } from './errors.js'
export type { GovernanceError, GovernanceErrorCode, GovernanceResult } from './errors.js'

export type {
  AdmissionRequest,
  ConfinedProcessProvider,
  ConfinedSpawnReceipt,
  ConfinedSpawnRequest,
  ControlledFs,
  DomainVeto,
  FsObservation,
  FsReadWindow,
  FsTextContent,
  FsWriteReceipt,
  GatewayCallRequest,
  GatewayReceipt,
  GatewayTarget,
  OperationAdmission,
  OperationAdmissionDecision,
  ProcessCapability,
  ProviderGateway,
} from './interfaces.js'
