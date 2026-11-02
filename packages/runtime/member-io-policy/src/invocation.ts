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

import type {
  BindInvocationInput,
  BindInvocationResult,
  ConsumeInvocationResult,
  EpochBumpReceipt,
  InvocationAuthority,
  InvocationBinder,
  InvocationCapability,
  InvocationConsumeRequest,
  InvocationConsumption,
  InvocationLease,
  InvocationRefusal,
  InvocationRefusalCode,
  RevokeInvocationResult,
  TrustedMemberIdentity,
} from './types.js'

/** Module-private per-capability state. One bit, not a ledger. */
interface CapabilityState {
  consumed: boolean
  /** The binder instance that minted it: a capability never crosses binders. */
  readonly owner: InvocationBinder
}

/**
 * Branding + per-capability state are module-private: an object that was not
 * minted by `bind()` below can never be found in either WeakSet/WeakMap, so
 * `verify`/`consume` refuse it as `CAPABILITY_UNKNOWN` by shape alone.
 */
const CAPABILITY_BRAND = new WeakSet<object>()
const CAPABILITY_STATE = new WeakMap<object, CapabilityState>()

function refusal(code: InvocationRefusalCode, detail: string, path: string) {
  return Object.freeze({ ok: false as const, code, detail, path })
}

function isNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isGeneration(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isSafeInteger(value) && value >= 0
}

/** Validate the trusted inputs; nothing is inferred or defaulted. */
function validateBindInput(input: BindInvocationInput): string | null {
  const member: TrustedMemberIdentity = input.member
  if (
    !isNonBlank(member.teamId) ||
    !isNonBlank(member.memberInstanceId) ||
    !isNonBlank(member.templateId) ||
    !isGeneration(member.instanceGeneration)
  ) {
    return 'a capability binds only a complete, trusted TeamDomain MemberIdentity'
  }
  if (!isNonBlank(input.callId)) return 'callId must be a non-empty string'
  if (!isNonBlank(input.policyRevision)) return 'policyRevision must be a non-empty string'
  if (!isNonBlank(input.toolBindingIdentity)) return 'toolBindingIdentity must be a non-empty string'
  if (typeof input.approvedOnce !== 'boolean') return 'approvedOnce must be the boolean Alpha.4 decided for THIS call'
  if (input.lease !== null) {
    if (typeof input.lease !== 'object') return 'lease must be null or carry an explicit expiry'
    if (!isFiniteNumber(input.lease.expiresAt)) {
      return 'a lease must carry a FINITE caller-supplied expiresAt; the module never reads a clock'
    }
  }
  return null
}

function freezeLease(lease: InvocationLease | null): InvocationLease | null {
  return lease === null ? null : Object.freeze({ expiresAt: lease.expiresAt })
}

function freezeCapability(capability: InvocationCapability): InvocationCapability {
  return Object.freeze(capability)
}

function freezeConsumption(consumption: InvocationConsumption): InvocationConsumption {
  return Object.freeze(consumption)
}

/** True iff `capability` was minted by a binder in this module instance. */
function isBranded(capability: unknown): capability is InvocationCapability {
  return typeof capability === 'object' && capability !== null && CAPABILITY_BRAND.has(capability)
}

/**
 * Create an isolated binder. Tests (and the process-wide default binder below)
 * each own their epoch counters; passing an explicit binder is the only way to
 * keep two independent trust domains apart in one process.
 */
export function createInvocationBinder(initialEpoch = 1): InvocationBinder {
  let epoch = isGeneration(initialEpoch) && initialEpoch > 0 ? initialEpoch : 1
  // Assigned before the returned binder can be called; the closures below
  // need the identity of the binder they belong to.
  let self: InvocationBinder
  /** Per-member revocation epoch (0 = never revoked). */
  const memberEpochs = new Map<string, number>()

  function currentMemberEpoch(memberIdentity: string): number {
    return memberEpochs.get(memberIdentity) ?? 0
  }

  function bind(input: BindInvocationInput): BindInvocationResult {
    const invalid = validateBindInput(input)
    if (invalid !== null) {
      return refusal('CAPABILITY_INPUT_INVALID', invalid, 'bindInvocation')
    }

    const memberIdentity = input.member.memberInstanceId
    const capability: InvocationCapability = freezeCapability({
      memberIdentity,
      callId: input.callId,
      policyRevision: input.policyRevision,
      toolBindingIdentity: input.toolBindingIdentity,
      epoch,
      memberEpoch: currentMemberEpoch(memberIdentity),
      approvedOnce: input.approvedOnce,
      singleUse: true,
      lease: freezeLease(input.lease),
    })

    CAPABILITY_BRAND.add(capability)
    CAPABILITY_STATE.set(capability, { consumed: false, owner: self })
    return Object.freeze({ ok: true as const, value: capability })
  }

  function consume(
    capability: InvocationCapability,
    request: InvocationConsumeRequest,
  ): ConsumeInvocationResult {
    if (!isBranded(capability)) {
      return refusal(
        'CAPABILITY_UNKNOWN',
        'the presented object was not minted by this binder (branded capability required; a structural copy is not a capability)',
        'capability',
      )
    }
    const state = CAPABILITY_STATE.get(capability)
    if (state === undefined) {
      // Defensive: brand and state are written together, so this is unreachable.
      return refusal('CAPABILITY_UNKNOWN', 'the capability has no per-call binding state', 'capability')
    }
    // A capability belongs to exactly one binder instance (one realm). Another
    // binder in the same process never honours it, even with matching fields.
    if (state.owner !== self) {
      return refusal(
        'CAPABILITY_UNKNOWN',
        'the capability was minted by a DIFFERENT binder instance; capabilities never cross binders',
        'capability',
      )
    }

    // The whole tuple must match: a capability never transfers.
    if (request.memberIdentity !== capability.memberIdentity) {
      return refusal(
        'CAPABILITY_MEMBER_MISMATCH',
        `capability '${capability.callId}' was minted for '${capability.memberIdentity}', not '${String(request.memberIdentity)}'`,
        'request.memberIdentity',
      )
    }
    if (request.callId !== capability.callId) {
      return refusal(
        'CAPABILITY_CALL_MISMATCH',
        `capability '${capability.callId}' is bound to call '${capability.callId}', not '${String(request.callId)}'`,
        'request.callId',
      )
    }
    if (request.policyRevision !== capability.policyRevision) {
      return refusal(
        'CAPABILITY_REVISION_MISMATCH',
        `capability '${capability.callId}' carries revision '${capability.policyRevision}', not '${String(request.policyRevision)}'`,
        'request.policyRevision',
      )
    }
    if (request.toolBindingIdentity !== capability.toolBindingIdentity) {
      return refusal(
        'CAPABILITY_BINDING_MISMATCH',
        `capability '${capability.callId}' is bound to tool '${capability.toolBindingIdentity}', not '${String(request.toolBindingIdentity)}'`,
        'request.toolBindingIdentity',
      )
    }

    // Cold start: the binder-wide epoch moved past the mint.
    if (capability.epoch !== epoch) {
      return refusal(
        'CAPABILITY_EPOCH_STALE',
        `capability '${capability.callId}' was minted under epoch ${String(capability.epoch)}, but the binder is at epoch ${String(epoch)}; a cold start never revalidates an old capability`,
        'capability.epoch',
      )
    }

    // Member revocation: the per-member epoch moved past the mint.
    const memberEpoch = currentMemberEpoch(capability.memberIdentity)
    if (capability.memberEpoch !== memberEpoch) {
      return refusal(
        'CAPABILITY_MEMBER_REVOKED',
        `capability '${capability.callId}' was minted under member epoch ${String(capability.memberEpoch)}, but '${capability.memberIdentity}' is at member epoch ${String(memberEpoch)}`,
        'capability.memberEpoch',
      )
    }

    // Deterministic lease: the caller supplies the clock; the module never does.
    if (capability.lease !== null) {
      if (request.now === undefined) {
        return refusal(
          'CAPABILITY_LEASE_UNVERIFIED',
          `capability '${capability.callId}' carries an expiry but the caller supplied no 'now'; expiry is never silently skipped`,
          'request.now',
        )
      }
      if (!isFiniteNumber(request.now)) {
        return refusal('CAPABILITY_INPUT_INVALID', "the caller-supplied 'now' must be finite", 'request.now')
      }
      if (request.now > capability.lease.expiresAt) {
        return refusal(
          'CAPABILITY_LEASE_EXPIRED',
          `capability '${capability.callId}' expired at ${String(capability.lease.expiresAt)} (caller now ${String(request.now)})`,
          'capability.lease.expiresAt',
        )
      }
    } else if (request.now !== undefined && !isFiniteNumber(request.now)) {
      return refusal('CAPABILITY_INPUT_INVALID', "the caller-supplied 'now' must be finite", 'request.now')
    }

    // SINGLE-USE: check and mark in one synchronous step. Node is
    // single-threaded and there is no `await` between the read and the write,
    // so two concurrent consumers can never both observe `consumed === false`.
    if (state.consumed) {
      return refusal(
        'CAPABILITY_CONSUMED',
        `capability '${capability.callId}' was already consumed; a one-shot capability is never replayed`,
        'capability',
      )
    }
    state.consumed = true

    return Object.freeze({
      ok: true as const,
      value: freezeConsumption({
        memberIdentity: capability.memberIdentity,
        callId: capability.callId,
        policyRevision: capability.policyRevision,
        toolBindingIdentity: capability.toolBindingIdentity,
        epoch: capability.epoch,
        memberEpoch: capability.memberEpoch,
        approvedOnce: capability.approvedOnce,
        consumedAt: request.now ?? null,
      }),
    })
  }

  function revoke(memberIdentity: string): RevokeInvocationResult {
    if (!isNonBlank(memberIdentity)) {
      return refusal('CAPABILITY_INPUT_INVALID', 'revoke needs the member identity it invalidates', 'memberIdentity')
    }
    const next = currentMemberEpoch(memberIdentity) + 1
    memberEpochs.set(memberIdentity, next)
    return Object.freeze({
      ok: true as const,
      memberIdentity,
      memberEpoch: next,
      binderEpoch: epoch,
    })
  }

  function bumpEpoch(): EpochBumpReceipt {
    epoch += 1
    return Object.freeze({ ok: true as const, epoch })
  }

  const binder: InvocationBinder = Object.freeze({
    bind,
    consume,
    revoke,
    bumpEpoch,
    currentEpoch: () => epoch,
    currentMemberEpoch,
  })
  self = binder
  return binder
}

/**
 * The process-wide binder used by the module-level helpers. Live assembly may
 * inject its own binder (one per Team/Member realm) via `createInvocationBinder`.
 */
const DEFAULT_BINDER = createInvocationBinder()

/** `bindInvocation({member,callId,policyRevision,approvedOnce,lease,...})`. */
export function bindInvocation(
  input: BindInvocationInput,
  binder: InvocationBinder = DEFAULT_BINDER,
): BindInvocationResult {
  return binder.bind(input)
}

export function consumeInvocation(
  capability: InvocationCapability,
  request: InvocationConsumeRequest,
  binder: InvocationBinder = DEFAULT_BINDER,
): ConsumeInvocationResult {
  return binder.consume(capability, request)
}

export function revokeInvocation(
  memberIdentity: string,
  binder: InvocationBinder = DEFAULT_BINDER,
): RevokeInvocationResult {
  return binder.revoke(memberIdentity)
}

export function bumpInvocationEpoch(binder: InvocationBinder = DEFAULT_BINDER): EpochBumpReceipt {
  return binder.bumpEpoch()
}

/**
 * Project a minted capability into the P1-02 `InvocationAuthority` input the
 * policy compiler consumes. This is an AUDIT projection, not an execution
 * permission: it does not consume the capability and does not widen anything.
 * A capability that is stale (cold start) or revoked is refused here too, so a
 * dead reference cannot be replayed into a fresh policy compile.
 */
export function toInvocationAuthority(
  capability: InvocationCapability,
  binder?: InvocationBinder,
): { readonly ok: true; readonly value: InvocationAuthority } | InvocationRefusal {
  if (!isBranded(capability)) {
    return refusal(
      'CAPABILITY_UNKNOWN',
      'the presented object was not minted by a binder in this module instance',
      'capability',
    )
  }
  const state = CAPABILITY_STATE.get(capability)
  if (state === undefined) {
    return refusal('CAPABILITY_UNKNOWN', 'the capability has no per-call binding state', 'capability')
  }
  if (binder !== undefined && state.owner !== binder) {
    return refusal(
      'CAPABILITY_UNKNOWN',
      'the capability was minted by a DIFFERENT binder instance; capabilities never cross binders',
      'capability',
    )
  }
  const owner = state.owner
  if (capability.epoch !== owner.currentEpoch()) {
    return refusal(
      'CAPABILITY_EPOCH_STALE',
      `capability '${capability.callId}' was minted under epoch ${String(capability.epoch)}, but the binder is at epoch ${String(owner.currentEpoch())}`,
      'capability.epoch',
    )
  }
  const memberEpoch = owner.currentMemberEpoch(capability.memberIdentity)
  if (capability.memberEpoch !== memberEpoch) {
    return refusal(
      'CAPABILITY_MEMBER_REVOKED',
      `capability '${capability.callId}' was minted under member epoch ${String(capability.memberEpoch)}, but '${capability.memberIdentity}' is at member epoch ${String(memberEpoch)}`,
      'capability.memberEpoch',
    )
  }
  return Object.freeze({
    ok: true as const,
    value: Object.freeze({
      memberIdentity: capability.memberIdentity,
      callId: capability.callId,
      policyRevision: capability.policyRevision,
      toolBindingIdentity: capability.toolBindingIdentity,
      approvedOnce: capability.approvedOnce,
    }),
  })
}
