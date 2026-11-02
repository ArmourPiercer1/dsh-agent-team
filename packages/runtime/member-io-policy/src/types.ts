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
