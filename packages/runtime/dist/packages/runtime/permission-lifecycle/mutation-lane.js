/**
 * The PR4 permission-lifecycle MUTATION lane — the typed entry points of the
 * lifecycle write plane (grant / revoke / restore).
 *
 * What this module is NOT, stated first because it is the whole point:
 *
 * - it is NOT a mutation authority. Every permission write it performs is one
 *   call to `GovernanceMutationService.mutatePermission` — the SOLE permission
 *   mutation authority (ADR §1/§5). It never calls the overlay port's
 *   `append`, it never builds a snapshot, it never assigns a generation: the
 *   only durable write path stays `authority -> PermissionOverlayRepositoryPort
 *   -> durable store`.
 * - it is NOT a second lifecycle path. `restore` rides the EXISTING single
 *   lifecycle path (the member lifecycle port's restore, ARCHIVED -> SETTLED,
 *   one durable commit, zero live contact — the G7 criterion) and adds no
 *   transition of its own; the frozen FSM's typed refusals
 *   (`LIFECYCLE_ILLEGAL_STATE`) propagate verbatim.
 *
 * The lifecycle semantics it DOES own (plan PR4 "revoke creates snapshot; no
 * delete; no inheritance"; ADR §8):
 *
 * 1. **grant/revoke produce a NEW snapshot** — because the authority appends
 *    a FULL snapshot per accepted mutation; this lane guarantees only that it
 *    never reaches for anything else.
 * 2. **no delete** — there is no delete member here, and the port has none.
 * 3. **no inheritance** — a mutation is always addressed to one
 *    `(teamSessionId, memberInstanceId)`; a NEW instance simply has no rows
 *    (`latest` -> `undefined`), so it starts with zero overlay permissions.
 *    Nothing here copies, seeds or defaults an overlay for a new instance.
 * 4. **restore keeps the CURRENT authority** — the same MemberInstance returns
 *    from ARCHIVED and its CURRENT latest overlay is its authority. No
 *    historical snapshot is replayed, no revoked grant is resurrected, and no
 *    snapshot is written "to show it went through a mutation": a pure restore
 *    performs ZERO permission writes (`wroteSnapshot: false`). A rule change
 *    that genuinely belongs to the restore is submitted as an ordinary
 *    PermissionMutation through the authority — its own mutation, its own
 *    snapshot, its own provenance.
 * 5. **a DISPOSED target is refused before the authority is called** — ADR §8
 *    "DISPOSED: overlay historical only; never effective", so a new snapshot
 *    for a terminal instance could never be effective; writing one would be
 *    audit noise dressed as authority (zero write, typed refusal). An
 *    ARCHIVED target is NOT refused: ADR §8 keeps its overlay RETAINED, so
 *    revoking during ARCHIVED is meaningful — and it is exactly what the
 *    restore leg below pins as still revoked afterwards.
 *
 * @module @dsh-agent-team/runtime/permission-lifecycle/mutation-lane
 */
import { PERMISSION_LIFECYCLE_ERROR_CODES, PermissionLifecycleError } from './types.js';
/**
 * THE shared permission-target assertion (ROUND 7, parent BLOCK-1: ONE
 * lifecycle law, never a second parallel gate). The mutation lane runs it as
 * a caller-side pre-check AND the governance service runs the SAME function
 * INSIDE its serialized section (post-await revalidation — a pre-check can
 * race a dispose, the in-chain run cannot).
 *
 * The parent-pinned TRI-STATE (§8):
 *   - NO durable row (`undefined`, and the reader is Leader-aware: the
 *     Leader position answers live iff the TeamSession row exists)
 *       -> `INSTANCE_UNKNOWN`, append FORBIDDEN;
 *   - `DISPOSED` -> `TARGET_TERMINAL`, append FORBIDDEN (the overlay is
 *     historical only; writing it is audit noise dressed as authority);
 *   - `ARCHIVED` -> **LEGAL**: the overlay is RETAINED and may still be
 *     granted/revoked (revoke-during-archive is exactly what the restore leg
 *     pins as still revoked afterwards); execution over an ARCHIVED instance
 *     is separately, unconditionally disabled by the DECISION lane — the
 *     mutation side never executes anything, so a legal mutation there is
 *     consistent, not a leak.
 */
export async function assertPermissionMutationTarget(members, teamSessionId, memberInstanceId, operation) {
    const state = await members.readLifecycle(teamSessionId, memberInstanceId);
    if (state === undefined) {
        throw new PermissionLifecycleError(PERMISSION_LIFECYCLE_ERROR_CODES.INSTANCE_UNKNOWN, `cannot ${operation}: MemberInstance ${JSON.stringify(memberInstanceId)} has no durable row in TeamSession ${JSON.stringify(teamSessionId)} (zero write)`, { teamSessionId, memberInstanceId });
    }
    if (state === 'DISPOSED') {
        throw new PermissionLifecycleError(PERMISSION_LIFECYCLE_ERROR_CODES.TARGET_TERMINAL, `cannot ${operation}: MemberInstance ${JSON.stringify(memberInstanceId)} is DISPOSED — its overlay is historical only and never effective (ADR §8; zero write)`, { teamSessionId, memberInstanceId, lifecycle: state });
    }
    // ARCHIVED (and every live state) falls through: LEGAL here; the decision
    // lane owns the execution disable.
}
/**
 * Build the lifecycle mutation lane. Pure wiring: no clock, no randomness,
 * no I/O of its own (every durable effect happens behind an injected port).
 */
export function createPermissionLifecycleMutationLane(deps) {
    /** The caller-side pre-check over the SHARED assertion above. */
    const assertMutationTarget = (teamSessionId, memberInstanceId, operation) => assertPermissionMutationTarget(deps.members, teamSessionId, memberInstanceId, operation);
    const grantInstance = async (args) => {
        await assertMutationTarget(args.teamSessionId, args.memberInstanceId, 'grant a permission overlay rule');
        // The ONE authority path: kind `grant_instance`, everything else verbatim.
        return await deps.governance.mutatePermission({ ...args, kind: 'grant_instance' });
    };
    const revoke = async (args) => {
        await assertMutationTarget(args.teamSessionId, args.memberInstanceId, 'revoke a permission overlay rule');
        // A revoke is a NEW FULL snapshot with the addressed pairs removed —
        // never an in-place edit, never a delete, never a tombstone the resolver
        // would have to interpret (the history keeps the pre-revoke authority).
        return await deps.governance.mutatePermission({ ...args, kind: 'revoke_permission' });
    };
    const restore = async (args) => {
        const { teamSessionId, memberInstanceId } = args;
        if (deps.lifecycle === undefined) {
            throw new PermissionLifecycleError(PERMISSION_LIFECYCLE_ERROR_CODES.RESTORE_UNCONFIGURED, 'the member lifecycle restore port is not wired: restore rides the EXISTING single lifecycle path and is never performed by a substitute (zero write)', { teamSessionId, memberInstanceId });
        }
        const state = await deps.members.readLifecycle(teamSessionId, memberInstanceId);
        if (state === undefined) {
            throw new PermissionLifecycleError(PERMISSION_LIFECYCLE_ERROR_CODES.INSTANCE_UNKNOWN, `cannot restore: MemberInstance ${JSON.stringify(memberInstanceId)} has no durable row in TeamSession ${JSON.stringify(teamSessionId)}`, { teamSessionId, memberInstanceId });
        }
        // The EXISTING lifecycle path owns the transition (and its typed
        // `LIFECYCLE_ILLEGAL_STATE` when the instance is not ARCHIVED). This lane
        // deliberately performs NO permission write here: the returning instance
        // keeps the CURRENT latest overlay, revoked-during-archive and all.
        const restored = await deps.lifecycle.restore({
            rootSessionId: teamSessionId,
            instanceId: memberInstanceId,
        });
        if (args.ruleChange === undefined || args.ruleChange.rules.length === 0) {
            const overlayAfter = await deps.overlay.latest({ teamSessionId, memberInstanceId });
            return {
                member: restored.member,
                steps: restored.steps,
                overlay: overlayAfter,
                wroteSnapshot: false,
            };
        }
        // A GENUINE rule change decided at restore time: an ordinary mutation
        // through the authority (envelope, CAS, provenance and all). `overlayBefore`
        // is kept only to make the no-op case reportable — it is never replayed.
        const mutation = await deps.governance.mutatePermission({
            ...args.ruleChange,
            teamSessionId,
            memberInstanceId,
        });
        const overlayAfter = await deps.overlay.latest({ teamSessionId, memberInstanceId });
        return {
            member: restored.member,
            steps: restored.steps,
            overlay: overlayAfter,
            wroteSnapshot: mutation.changed,
            mutation,
        };
    };
    return Object.freeze({ grantInstance, revoke, restore });
}
//# sourceMappingURL=mutation-lane.js.map