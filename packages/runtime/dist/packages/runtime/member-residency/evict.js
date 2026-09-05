/**
 * The SETTLED-residency eviction path (P5-T6; DevPlan §18.5: "evicting
 * a SETTLED MemberInstance residency ... the handle may be absent" and
 * Architecture §31: "lifecycle != residency — evicting a residency never
 * changes the lifecycle"; TaskDoc §11.5 P5-T6 card).
 *
 * {@link evictSettledMember} drops the EPHEMERAL agent residency of a
 * member whose durable lifecycle is `SETTLED` — and NOTHING ELSE:
 *
 * - the durable MemberInstance record is NOT deleted, NOT transitioned
 *   (the lifecycle stays `SETTLED`; the durable commit of the lifecycle
 *   transition is a later task's surface — P5-T6 owns residency only);
 * - the durable `team-member` session binding is NOT deleted
 *   (invariants 23/24: the child session stays bound to the instance);
 * - no slot `apply`, no `installOverlay`, no surface event records —
 *   eviction is not a bind path, and the binder (the single emitter of
 *   `agent-setup/*` records, invariant 42) is never consulted;
 * - ZERO durable writes — the write port is not even consulted on this
 *   path (asserted by the unit tests).
 *
 * Orchestration (every step fail-closed):
 *
 * 1. Input validation (`./identity.js`) — the composite identity is
 *    validated fail-closed (`MEMBER_RESIDENCY_INVALID_INPUT`, no
 *    effect).
 * 2. Record load — the durable MemberInstance record of the addressed
 *    identity. ABSENT: `MEMBER_RESIDENCY_MEMBER_NOT_FOUND` (evicting an
 *    identity that never had a record is not a settled eviction — that
 *    is a caller bug, fail loudly).
 * 3. Lifecycle gate — the record must be `SETTLED`
 *    (`MEMBER_RESIDENCY_LIFECYCLE_CONFLICT` otherwise, with the actual
 *    `lifecycle` in `details`): evicting a `RUNNING` or `CREATED`
 *    residency would strand admitted work; `ARCHIVED` is not the
 *    settled state of the current work set; `DISPOSED` is terminal
 *    (there is nothing left to evict — and the evict path must never
 *    be used to clean up a disposed member).
 * 4. Child session binding consistency — the record's `childSessionId`
 *    must carry the consistent `team-member` binding row
 *    (`MEMBER_RESIDENCY_RECORD_CONFLICT` otherwise: the durable state
 *    is corrupt; eviction must not run against a corrupt world).
 * 5. Residency drop — `residencyPort.dropResidency(childSessionId)`:
 *    the LIVE handle may be ABSENT (a settled world whose process
 *    already lost the residency): the port contract makes that a
 *    no-op, reported as `residencyDropped: false` — NOT an error
 *    (DevPlan §18.5 "the handle may be absent").
 *
 * RE-ADMIT after an evict is the cold path (`./cold-member.js`): the
 * durable rows are intact, so the cold resume restores the scope again
 * (idempotent, zero writes, no duplicate records).
 *
 * @module @dsh-agent-team/runtime/member-residency/evict
 */
import { MEMBER_RESIDENCY_ERROR_CODES, MemberResidencyError, } from './errors.js';
import { validateMemberIdentityInput } from './identity.js';
/**
 * Evict the SETTLED residency of one member (see the module docs for
 * the full orchestration and the zero-write guarantee).
 *
 * @param ports - the injected handles (read handle, residency port; the
 *   write port and the surface are NOT consulted on this path).
 * @param input - the composite member identity `(rootSessionId,
 *   instanceId)`.
 * @returns the result: the unchanged durable record plus
 *   `residencyDropped` (`true` when a live residency was dropped,
 *   `false` when the handle was already absent).
 * @throws {@link MemberResidencyError} (`MEMBER_RESIDENCY_INVALID_INPUT`,
 *   `MEMBER_RESIDENCY_MEMBER_NOT_FOUND`,
 *   `MEMBER_RESIDENCY_LIFECYCLE_CONFLICT`,
 *   `MEMBER_RESIDENCY_RECORD_CONFLICT`) — all before the residency drop.
 */
export async function evictSettledMember(ports, input) {
    // Step 1 — input validation (fail-closed, no effect).
    validateMemberIdentityInput(input);
    const rootSessionId = String(input.rootSessionId);
    const instanceId = String(input.instanceId);
    // Step 2 — the durable record (read-only). Absent: loud failure.
    const member = ports.teamDomain.getMemberInstance(rootSessionId, instanceId);
    if (member === undefined) {
        throw new MemberResidencyError(MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_MEMBER_NOT_FOUND, `no MemberInstance record for (root '${rootSessionId}', instance '${instanceId}'); there is no settled residency to evict`, { rootSessionId, instanceId });
    }
    // Step 3 — the lifecycle gate (SETTLED only; Architecture §31: the
    // evict path never changes the lifecycle, it requires it).
    if (member.lifecycle !== 'SETTLED') {
        throw new MemberResidencyError(MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_LIFECYCLE_CONFLICT, `MemberInstance (root '${rootSessionId}', instance '${instanceId}') is '${member.lifecycle}'; only a SETTLED residency can be evicted`, { rootSessionId, instanceId, lifecycle: member.lifecycle });
    }
    // Step 4 — the child session binding consistency check (fail-closed
    // against a corrupt durable world).
    const binding = ports.teamDomain.getSessionBinding(member.childSessionId);
    if (binding === undefined ||
        binding.kind !== 'team-member' ||
        binding.rootSessionId !== rootSessionId ||
        binding.instanceId !== instanceId) {
        throw new MemberResidencyError(MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_RECORD_CONFLICT, `child session '${member.childSessionId}' of member (root '${rootSessionId}', instance '${instanceId}') carries no consistent 'team-member' binding (found kind: ${binding === undefined ? 'none' : binding.kind}); the durable state is corrupt — repair it before evicting`, {
            rootSessionId,
            instanceId,
            childSessionId: member.childSessionId,
            foundKind: binding?.kind,
        });
    }
    // Step 5 — the residency drop (the ONLY effect of the operation; the
    // handle may be absent — that is a settled world, not an error).
    const residencyDropped = ports.residency.dropResidency(member.childSessionId);
    return { path: 'evict-settled', member, residencyDropped };
}
//# sourceMappingURL=evict.js.map