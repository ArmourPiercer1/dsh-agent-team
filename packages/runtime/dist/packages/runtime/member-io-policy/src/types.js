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
];
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
];
/** Closed trust refusal vocabulary. */
export const TRUST_REFUSAL_CODES = [
    'TRUST_INPUT_INVALID',
    'TRUST_BINDING_UNKNOWN',
    'TRUST_PACKAGE_DIGEST_MISMATCH',
    'TRUST_DEPENDENCY_DIGEST_MISMATCH',
    'TRUST_GENERATION_STALE',
    'TRUST_GENERATION_MISMATCH',
    'TRUST_REGISTRATION_CONFLICT',
];
//# sourceMappingURL=types.js.map