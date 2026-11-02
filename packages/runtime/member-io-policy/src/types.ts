/**
 * Alpha.5 P1-02 — the internal two-axis I/O policy vocabulary.
 *
 * These types are INTERNAL to the Team runtime. They are NOT a new Blueprint
 * syntax: the only author-visible carrier is the v4 `memberIoCeilings` family
 * (P1-01) plus the existing `toolBindings[].io` lanes, both projected by
 * `@dsh-agent-team/domain/vnext-field-mapping`. This module is the shape the
 * three I/O consumers (FS / Web / Subprocess-PTY) receive.
 *
 * The plan's invariant is a SUBSET relation, never a union:
 *
 *   EffectiveIo(member, tool, call) ⊆ MemberCeiling(member) ∩ ToolRestriction(member, tool)
 *
 * Pure data + pure functions; the only I/O-free impurity allowed in the lane
 * is `node:crypto` for the stable policy digest (deterministic, no clock).
 *
 * @module @dsh-agent-team/runtime/member-io-policy/types
 */

import type { TeamBlueprintV4 } from '../../../domain/blueprint/src/index.js'

/** The two path axes, each an independent rule set. */
export type PathAxes = 'read' | 'write'

/** Network is a BOOLEAN this round (destination ACLs are a future interface). */
export type NetworkAccess = 'allow' | 'deny'

/**
 * One projected path rule set, faithful to the authoring lane (zero
 * normalization: locators survive exactly as written; matching semantics are
 * P1-03's job, not this module's).
 */
export interface PathRuleSet {
  readonly mode: 'all' | 'restricted'
  readonly allow: readonly string[]
  readonly ask: readonly string[]
  readonly deny: readonly string[]
}

/**
 * A tool-level lane may declare NO additional narrowing (`mode: all`): the
 * effective set is then exactly the Member ceiling. It can never be wider,
 * because the intersection is taken against the ceiling, not the tool.
 */
export type ToolPathLane = PathRuleSet | 'no-additional-narrowing'

/** The trusted MemberIdentity reference (a TeamDomain fact, never argv/cwd). */
export interface TrustedMemberIdentity {
  readonly teamId: string
  /** The MemberInstance id minted by the trusted TeamDomain. */
  readonly memberInstanceId: string
  /** The template this instance was created from (authoring reference). */
  readonly templateId: string
  /** Monotonic instance generation; a stale generation never compiles. */
  readonly instanceGeneration: number
}

/** The Blueprint bound to a Team, with the team identity it was bound to. */
export interface BoundBlueprint {
  readonly teamId: string
  readonly blueprint: TeamBlueprintV4
}

/**
 * The ALREADY-COMPUTED Alpha.4 effective authority (call admission). The
 * compiler CONSUMES this; it never recomputes approval semantics and never
 * creates a second grant ledger.
 */
export interface Alpha4EffectiveAuthority {
  readonly revision: string
  readonly memberInstanceId: string
  readonly instanceGeneration: number
  /** Whether Alpha.4 currently admits this member at all. */
  readonly admitted: boolean
}

export interface CompileInput {
  readonly trustedMember: TrustedMemberIdentity
  readonly boundBlueprint: BoundBlueprint
  readonly effectiveAuthority: Alpha4EffectiveAuthority
}

/** The Member half of the two-axis policy (the LEFT factor of the subset law). */
export interface MemberPolicy {
  readonly memberIdentity: string
  readonly templateId: string
  readonly revision: string
  readonly read: PathRuleSet
  readonly write: PathRuleSet
  readonly network: { readonly access: NetworkAccess }
}

/** One tool's restriction inside a Member ceiling (the RIGHT factor). */
export interface ToolIoRestriction {
  readonly bindingIdentity: string
  readonly read: ToolPathLane
  readonly write: ToolPathLane
  readonly network: NetworkAccess | 'unsupported'
}

/**
 * The per-call capability a trusted binder mints (P1-04). It is NOT a grant:
 * `approvedOnce` only says "Alpha.4 approved THIS call"; the hard ceiling is
 * still enforced by `compileEffectiveIo`.
 */
export interface InvocationAuthority {
  readonly memberIdentity: string
  readonly callId: string
  readonly policyRevision: string
  readonly toolBindingIdentity: string
  readonly approvedOnce: boolean
}

/** The compiled, per-invocation policy every I/O consumer obeys. */
export interface EffectiveIoPolicy {
  readonly memberIdentity: string
  readonly toolBindingIdentity: string
  readonly invocationId: string
  readonly policyRevision: string
  readonly read: PathRuleSet
  readonly write: PathRuleSet
  readonly network: { readonly access: NetworkAccess }
}

/** Closed refusal vocabulary (no string-matched error messages by consumers). */
export const POLICY_REFUSAL_CODES = [
  'MEMBER_IDENTITY_UNTRUSTED',
  'TEAM_MISMATCH',
  'MEMBER_TEMPLATE_UNKNOWN',
  'MEMBER_GENERATION_STALE',
  'AUTHORITY_REFUSED',
  'MEMBER_CEILING_UNDECLARED',
  'IO_POLICY_UNSUPPORTED',
  'TOOL_NETWORK_UNSUPPORTED',
  'INVOCATION_MISMATCH',
  'STALE_POLICY_REVISION',
] as const

export type PolicyRefusalCode = (typeof POLICY_REFUSAL_CODES)[number]

export interface PolicyRefusal {
  readonly ok: false
  readonly code: PolicyRefusalCode
  readonly detail: string
  /** JSON-ish path of the refusing input, for diagnostics. */
  readonly path: string
}

export type CompileResult<T> = { readonly ok: true; readonly value: T } | PolicyRefusal

// ===========================================================================
// Alpha.5 P1-04 — Invocation Binder vocabulary (APPEND-ONLY; nothing above
// this banner changes meaning). The binder mints a per-call capability; the
// trust registry records deployment trust. Neither is a grant ledger.
// ===========================================================================

/**
 * A caller-supplied lease. `expiresAt` is epoch milliseconds supplied by the
 * caller; the library never reads a clock, so expiry stays deterministic.
 * The boundary is INCLUSIVE: a capability is expired only when
 * `now > expiresAt` (the strict-`>` rule Alpha.4's grant lease already uses).
 */
export interface InvocationLease {
  readonly expiresAt: number
}

/**
 * The trusted inputs of one binding. `member` is the TeamDomain identity (the
 * same shape P1-02's compiler consumes), never an argv/cwd/UI string.
 * `toolBindingIdentity` is the v4 `authoringOwner/toolName` coordinate the
 * capability is pinned to; it cannot be inferred from the call arguments.
 */
export interface BindInvocationInput {
  readonly member: TrustedMemberIdentity
  readonly callId: string
  readonly policyRevision: string
  readonly toolBindingIdentity: string
  /** Alpha.4's per-call approval input, carried forward for audit only. */
  readonly approvedOnce: boolean
  readonly lease: InvocationLease | null
}

/**
 * A non-transferable reference to exactly one bound call. Frozen and branded
 * by the module that minted it: a structural copy is not a capability.
 *
 * `epoch` is the binder-wide cold-start epoch; `memberEpoch` is the per-member
 * revocation epoch. A capability stays valid only while BOTH match the
 * binder's current values, so neither a cold start nor `revoke(member)` can
 * leave an outstanding reference usable.
 */
export interface InvocationCapability {
  readonly memberIdentity: string
  readonly callId: string
  readonly policyRevision: string
  readonly toolBindingIdentity: string
  readonly epoch: number
  readonly memberEpoch: number
  readonly approvedOnce: boolean
  readonly singleUse: true
  readonly lease: InvocationLease | null
}

/**
 * What a consumer presents to consume a capability. The whole tuple must match
 * the mint, so a capability minted for member A / call X / tool T / revision R
 * is refused for B, Y, U or S.
 */
export interface InvocationConsumeRequest {
  readonly memberIdentity: string
  readonly callId: string
  readonly policyRevision: string
  readonly toolBindingIdentity: string
  /** Only needed (and mandatory) when the capability carries a lease. */
  readonly now?: number
}

/** The audit record returned by a successful (single) consumption. */
export interface InvocationConsumption {
  readonly memberIdentity: string
  readonly callId: string
  readonly policyRevision: string
  readonly toolBindingIdentity: string
  readonly epoch: number
  readonly memberEpoch: number
  readonly approvedOnce: boolean
  readonly consumedAt: number | null
}

/** Closed invocation refusal vocabulary. */
export const INVOCATION_REFUSAL_CODES = [
  'CAPABILITY_INPUT_INVALID',
  'CAPABILITY_UNKNOWN',
  'CAPABILITY_CONSUMED',
  'CAPABILITY_MEMBER_MISMATCH',
  'CAPABILITY_CALL_MISMATCH',
  'CAPABILITY_BINDING_MISMATCH',
  'CAPABILITY_REVISION_MISMATCH',
  'CAPABILITY_EPOCH_STALE',
  'CAPABILITY_MEMBER_REVOKED',
  'CAPABILITY_LEASE_EXPIRED',
  'CAPABILITY_LEASE_UNVERIFIED',
] as const

export type InvocationRefusalCode = (typeof INVOCATION_REFUSAL_CODES)[number]

export interface InvocationRefusal {
  readonly ok: false
  readonly code: InvocationRefusalCode
  readonly detail: string
  readonly path: string
}

export type BindInvocationResult =
  | { readonly ok: true; readonly value: InvocationCapability }
  | InvocationRefusal

export type ConsumeInvocationResult =
  | { readonly ok: true; readonly value: InvocationConsumption }
  | InvocationRefusal

export interface MemberRevocationReceipt {
  readonly ok: true
  readonly memberIdentity: string
  readonly memberEpoch: number
  readonly binderEpoch: number
}

export interface EpochBumpReceipt {
  readonly ok: true
  readonly epoch: number
}

export type RevokeInvocationResult = MemberRevocationReceipt | InvocationRefusal

/**
 * The binder surface. Consumption is a SYNCHRONOUS single-threaded state
 * transition (check-and-mark in one step), so two interleaved callers cannot
 * both win; the per-capability record is in-memory state, not a grant ledger.
 */
export interface InvocationBinder {
  bind(input: BindInvocationInput): BindInvocationResult
  consume(capability: InvocationCapability, request: InvocationConsumeRequest): ConsumeInvocationResult
  revoke(memberIdentity: string): RevokeInvocationResult
  bumpEpoch(): EpochBumpReceipt
  currentEpoch(): number
  currentMemberEpoch(memberIdentity: string): number
}

// ===========================================================================
// Alpha.5 P1-04 — Trusted Tool Registry vocabulary (APPEND-ONLY).
// Identity + load generation ONLY; this is not a sandbox and never claims a
// trusted in-process JS module cannot bypass its Provider.
// ===========================================================================

/**
 * One explicit load-time registration. Digests are SUPPLIED BY THE LOADER
 * (package source and dependency-lock digests); the registry compares them and
 * never walks or hashes a file tree per call.
 */
export interface TrustedBindingRegistration {
  readonly packageDigest: string
  readonly dependencyDigest: string
  /** The registration scope (e.g. `member:<id>` or a service realm id). */
  readonly scope: string
  /** The load generation of the Definition this registration belongs to. */
  readonly definitionGeneration: number
  readonly toolName: string
}

/** A verification presents the same tuple the loader knew at call time. */
export type TrustedBindingVerification = TrustedBindingRegistration

/** The frozen receipt of one accepted registration. */
export interface TrustedBindingReceipt {
  readonly packageDigest: string
  readonly dependencyDigest: string
  readonly scope: string
  readonly definitionGeneration: number
  readonly toolName: string
}

/** Closed trust refusal vocabulary. */
export const TRUST_REFUSAL_CODES = [
  'TRUST_INPUT_INVALID',
  'TRUST_BINDING_UNKNOWN',
  'TRUST_PACKAGE_DIGEST_MISMATCH',
  'TRUST_DEPENDENCY_DIGEST_MISMATCH',
  'TRUST_GENERATION_STALE',
  'TRUST_GENERATION_MISMATCH',
  'TRUST_REGISTRATION_CONFLICT',
] as const

export type TrustRefusalCode = (typeof TRUST_REFUSAL_CODES)[number]

export interface TrustRefusal {
  readonly ok: false
  readonly code: TrustRefusalCode
  readonly detail: string
  readonly path: string
}

export type TrustRegistrationResult =
  | { readonly ok: true; readonly value: TrustedBindingReceipt }
  | TrustRefusal

export type TrustVerificationResult =
  | { readonly ok: true; readonly value: TrustedBindingReceipt }
  | TrustRefusal

/** The registry surface: explicit registration, closed refusal vocabulary. */
export interface TrustRegistry {
  register(input: TrustedBindingRegistration): TrustRegistrationResult
  verify(input: TrustedBindingVerification): TrustVerificationResult
  inspect(scope: string, toolName: string): TrustedBindingReceipt | null
  size(): number
}
