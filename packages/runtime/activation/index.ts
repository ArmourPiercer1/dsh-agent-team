/**
 * P6-T1 ActivationProvider — public facade.
 *
 * The ActivationProvider is the SOLE entry point for every new
 * MemberInstance creation (Architecture invariant 26) and the full
 * admission/provisioning order (DevPlan 19.2). Human, leader-explicit, and
 * leader-delegate requests all funnel through the same provider.
 *
 * Composition:
 *   - `types.ts`    — the request/result/port vocabulary (closed set)
 *   - `errors.ts`   — the closed activation error-code vocabulary
 *   - `identity.ts` — stable operation identity (Architecture §18.2): the
 *     instanceId is ALLOCATED INSIDE the identity, derived from
 *     (rootSessionId, source, requestToken)
 *   - `checks.ts`   — the admission/provisioning step functions (DevPlan
 *     19.2 steps 1-11)
 *   - `adapter.ts`  — the coordinator's child-Session adapter (factory +
 *     unconditional durability barrier, invariant 41/46)
 *   - `provider.ts` — the orchestration (steps 0-16) + admit-once convergence
 */

export {
  ACTIVATION_SOURCE_VALUES,
  ACTIVATION_SOURCES,
} from './types.js'
export type {
  ActivationAdmissionState,
  ActivationDelegation,
  ActivationPorts,
  ActivationProjectionEvent,
  ActivationProjectionState,
  ActivationProvider,
  ActivationResult,
  ActivationSource,
  ChildSessionCreationRequest,
  ChildSessionCreationResult,
  ChildSessionFactoryPort,
  MemberActivationRequest,
} from './types.js'

export {
  ACTIVATION_ERROR_CODES,
  ACTIVATION_ERROR_CODE_VALUES,
  ActivationError,
  isActivationError,
} from './errors.js'
export type { ActivationErrorCode } from './errors.js'

export {
  ACTIVATION_TOKEN_MAX_LENGTH,
  activationOperationIdentity,
  activationOperationKey,
  allocateActivationInstanceId,
} from './identity.js'

export {
  BLUEPRINT_DOMAIN_TO_REQUIREMENT_TYPE,
  admitSource,
  allocateCheckedInstanceId,
  checkCallerAuthority,
  checkQuota,
  computeOverlayBounds,
  countTeamQuota,
  effectivePolicyValues,
  evaluateActivationCompatibility,
  resolveActivationPolicy,
  resolveBoundBlueprint,
  resolveCreationFields,
  resolveTeamSession,
  resolveTemplate,
  selectPolicyOverrides,
  toActivationRequirements,
} from './checks.js'
export type {
  QuotaCountingView,
  ResolvedBoundBlueprint,
  ResolvedCreationFields,
} from './checks.js'

export { createActivationChildAdapter } from './adapter.js'

export {
  LEADER_INSTANCE_ID,
  createActivationProvider,
  mapActivationDurableError,
} from './provider.js'
export type { ActivationTeamDomain } from './provider.js'
