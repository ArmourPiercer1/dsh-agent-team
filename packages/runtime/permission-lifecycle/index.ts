/**
 * `permission-lifecycle` — Alpha.3 PR4: the permission lifecycle lane.
 *
 * PR1 made the `PermissionOverlaySnapshot` durable, PR2 made the effective
 * policy assemblable, PR3 made `GovernanceMutationService` the ONE mutation
 * authority. PR4 makes that authority usable across the MemberInstance
 * lifecycle, and owns exactly three things:
 *
 *   - the WRITE ENTRIES (`mutation-lane.ts`): `grantInstance` / `revoke` are
 *     typed entries into `mutatePermission` — the authority stays the only
 *     durable write path — and `restore` rides the EXISTING member lifecycle
 *     path, performing NO permission write of its own (the same instance
 *     returns from ARCHIVED keeping the CURRENT latest overlay; a genuine rule
 *     change at restore time is an ordinary PermissionMutation);
 *   - the EXECUTION GATE and read plane (`decision-lane.ts`): ADR §8 (RUNNING
 *     effective / ARCHIVED retained-but-disabled / DISPOSED historical /
 *     new instance no inheritance) in front of the MERGED two-stage plane
 *     (PR2 assembler + the frozen Alpha.2 resolver for the file class; the
 *     governance kernel's pure effective-answer algebra for the exec
 *     fingerprint class);
 *   - the closed refusal vocabulary (`types.ts`), every refusal typed and
 *     every one of them zero-write.
 *
 * What it is NOT: not a mutation authority, not a lifecycle transition
 * implementation, not a resolver, not a second policy. It stores nothing:
 * no snapshot is ever written here, nothing is ever deleted (plan PR4 "no
 * delete"), and no instance ever receives another instance's overlay (plan
 * PR4 "no inheritance" — the port reads per `(teamSessionId,
 * memberInstanceId)` and a new instance simply has no rows).
 *
 * @module @dsh-agent-team/runtime/permission-lifecycle
 */

export type {
  MemberLifecycleReaderPort,
  OverlaySubtreeContainment,
  PermissionCarrierDecoder,
  PermissionCarrierMatcher,
  PermissionDecisionLane,
  PermissionDecisionLaneDeps,
  PermissionDecisionLayer,
  PermissionDecisionOutcome,
  PermissionDecisionPlane,
  PermissionDecisionRequest,
  PermissionDecisionStaticFacts,
  PermissionEffectiveAnswerPort,
  PermissionKernelAnswer,
  PermissionKernelStaticFacts,
  PermissionKernelStaticLayer,
  PermissionKernelStaticLayerRule,
  PermissionLifecycleErrorCode,
  PermissionLifecycleGateVerdict,
  PermissionLifecycleGrantArgs,
  PermissionLifecycleMutationLane,
  PermissionLifecycleMutationLaneDeps,
  PermissionLifecycleRestoreArgs,
  PermissionLifecycleRestorePort,
  PermissionLifecycleRestoreResult,
} from './types.js'
export { PERMISSION_LIFECYCLE_ERROR_CODES, PermissionLifecycleError } from './types.js'
export { createPermissionLifecycleMutationLane } from './mutation-lane.js'
export {
  containmentFallback,
  createPermissionDecisionLane,
  evaluatePermissionLifecycleGate,
  toKernelStaticFacts,
} from './decision-lane.js'
