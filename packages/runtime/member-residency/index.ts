/**
 * MemberResidency public facade (P5-T6; TaskDoc §11.5 P5-T6 card,
 * ruling R34 owned surface `packages/runtime/member-residency/**`).
 *
 * Re-exports the complete productized member create/resume residency
 * module set:
 *
 * - the three entry points — {@link createFreshMember} (fresh member:
 *   derived durable identity + fresh install of all three overlay slots
 *   + the admission decision), {@link rehydrateColdMember} (process-
 *   restart / re-admit: scope restore, zero fresh-time side effects,
 *   zero writes) and {@link evictSettledMember} (SETTLED-residency
 *   eviction: drop the live handle only, durable records untouched);
 * - the identity derivation — {@link deriveMemberIdentity} (spec →
 *   stable `(instanceId, childSessionId)`, deterministic and pure) plus
 *   the spec / identity validation gates;
 * - the injected-handle contract — {@link MemberResidencyPorts},
 *   {@link MemberDomainWritePort} (fresh path's only writer, invariant
 *   41), {@link SessionDurabilityPort} (fresh path's child-Session
 *   durability barrier — the DevPlan §18.5 "Session durable"
 *   postcondition), {@link ResidencyPort} (evict path's only live-runtime
 *   contact), the input/result types;
 * - the closed error channel — {@link MemberResidencyError} + codes;
 * - the real write-port adapter over the P4 TeamDomain repositories —
 *   {@link createMemberDomainWritePort} (the mirror of the binder's
 *   `createTeamDomainReadHandle` projection, P5-T1).
 *
 * The real-instance harness (`./harness/run.mjs`) binds the DSH public
 * seams through exactly these interfaces; the unit layer
 * (`packages/runtime/test/p5t6-*.test.ts`) binds the P4 repositories
 * over the testkit `FileStorageSeam`. The binder (P5-T1) and the T2/T3/
 * T4 slot implementations stay injected — this module never reaches
 * into the agent runtime.
 *
 * @module @dsh-agent-team/runtime/member-residency
 */

export { createFreshMember } from './fresh-member.js'
export { rehydrateColdMember } from './cold-member.js'
export { evictSettledMember } from './evict.js'
export {
  deriveMemberIdentity,
  canonicalMemberSpecString,
  validateMemberCreateSpec,
  validateMemberIdentityInput,
  memberResidencyToken,
} from './identity.js'
export { createMemberDomainWritePort } from './write-port.js'
export {
  MEMBER_RESIDENCY_ERROR_CODES,
  MEMBER_RESIDENCY_ERROR_CODE_VALUES,
  MemberResidencyError,
  isMemberResidencyError,
} from './errors.js'
export type { MemberResidencyErrorCode } from './errors.js'
export type {
  ColdMemberResult,
  DerivedMemberIdentity,
  EvictSettledMemberResult,
  FreshMemberResult,
  MemberCreateSpec,
  MemberDomainWritePort,
  MemberIdentityInput,
  MemberResidencyDurableState,
  MemberResidencyPorts,
  ResidencyPort,
  SessionDurabilityPort,
} from './types.js'
