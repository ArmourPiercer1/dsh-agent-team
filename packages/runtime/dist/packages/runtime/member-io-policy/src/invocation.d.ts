/**
 * Alpha.5 P1-04 — the Invocation Binder.
 *
 * WHAT THIS MODULE IS: the ONE place where a trusted `MemberIdentity` + an
 * Alpha.4 per-call approval input (`approvedOnce`) become a NON-TRANSFERABLE
 * CALL CAPABILITY reference for exactly one
 * `memberIdentity / callId / policyRevision / toolBindingIdentity` tuple. The
 * capability is what the P1-02 compiler and the I/O consumers audit: it
 * carries the whole tuple plus the cold-start `epoch` / per-member
 * `memberEpoch` it was minted under, and it is what `toInvocationAuthority`
 * projects into `compileEffectiveIo`.
 *
 * WHAT IT IS NOT — it is NOT a second grant ledger. It does not decide
 * `allow/ask/deny`, it does not compute an Alpha.4 authority revision, it does
 * not mint or validate an OperationGrant, and it never widens a ceiling.
 * `approvedOnce` is a copied INPUT, not a permission this module grants. The
 * only state the module owns is a per-capability one-bit `consumed` flag plus
 * the binder's epoch counters — an in-memory per-call binding state, not a
 * table of grants. The Alpha.4 grant/approval store remains the single owner of
 * approval truth; this module only binds one ALREADY-DECIDED call to identity.
 *
 * LAWS (all machine-checked by `test/a5sf-invocation.test.ts`):
 *  - SINGLE USE: a capability is consumed exactly once. Check-and-mark happens
 *    in one synchronous step with no `await` in between, so in Node's
 *    single-threaded model two interleaved consumers produce exactly one
 *    winner; the loser gets `CAPABILITY_CONSUMED`. There is no race window to
 *    widen later.
 *  - NO TRANSFER: the tuple is re-checked on every consume, so a capability
 *    minted for A / call X / tool T / revision R is refused for any other
 *    member, call, tool binding or revision. A structurally cloned object is
 *    not a capability: minting brands the object in a module-private WeakSet,
 *    and consumption state lives in a module-private WeakMap keyed by that
 *    exact object. The object is frozen, so it cannot be mutated in place.
 *  - REVOCATION: `revoke(member)` bumps that member's revocation epoch; every
 *    outstanding capability for the member (which carries the old
 *    `memberEpoch`) is refused with `CAPABILITY_MEMBER_REVOKED`, and a new
 *    binding is minted under the new epoch. Other members are untouched.
 *  - COLD START: `bumpEpoch()` is the binder-wide epoch bump; every capability
 *    minted under a previous epoch is refused with `CAPABILITY_EPOCH_STALE`.
 *  - LEASE: expiry is deterministic. The module NEVER reads `Date.now()`;
 *    a lease carries a caller-supplied `expiresAt` and the caller supplies
 *    `now` when consuming. A lease without a caller clock is refused
 *    (`CAPABILITY_LEASE_UNVERIFIED`) instead of silently skipping expiry. The
 *    boundary is inclusive: expired only when `now > expiresAt`.
 *
 * @module @dsh-agent-team/runtime/member-io-policy/invocation
 */
import type { BindInvocationInput, BindInvocationResult, ConsumeInvocationResult, EpochBumpReceipt, InvocationAuthority, InvocationBinder, InvocationCapability, InvocationConsumeRequest, InvocationRefusal, RevokeInvocationResult } from './types.js';
/**
 * Create an isolated binder. Tests (and the process-wide default binder below)
 * each own their epoch counters; passing an explicit binder is the only way to
 * keep two independent trust domains apart in one process.
 */
export declare function createInvocationBinder(initialEpoch?: number): InvocationBinder;
/** `bindInvocation({member,callId,policyRevision,approvedOnce,lease,...})`. */
export declare function bindInvocation(input: BindInvocationInput, binder?: InvocationBinder): BindInvocationResult;
export declare function consumeInvocation(capability: InvocationCapability, request: InvocationConsumeRequest, binder?: InvocationBinder): ConsumeInvocationResult;
export declare function revokeInvocation(memberIdentity: string, binder?: InvocationBinder): RevokeInvocationResult;
export declare function bumpInvocationEpoch(binder?: InvocationBinder): EpochBumpReceipt;
/**
 * Project a minted capability into the P1-02 `InvocationAuthority` input the
 * policy compiler consumes. This is an AUDIT projection, not an execution
 * permission: it does not consume the capability and does not widen anything.
 * A capability that is consumed, stale (cold start), lease-expired or revoked is
 * refused here too, so a dead reference cannot be replayed into a fresh policy
 * compile. A leased capability requires the caller clock.
 */
export declare function toInvocationAuthority(capability: InvocationCapability, binder?: InvocationBinder, now?: number): {
    readonly ok: true;
    readonly value: InvocationAuthority;
} | InvocationRefusal;
//# sourceMappingURL=invocation.d.ts.map