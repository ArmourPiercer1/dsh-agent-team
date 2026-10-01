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
import type { PermissionLifecycleMutationLane, PermissionLifecycleMutationLaneDeps } from './types.js';
/**
 * Build the lifecycle mutation lane. Pure wiring: no clock, no randomness,
 * no I/O of its own (every durable effect happens behind an injected port).
 */
export declare function createPermissionLifecycleMutationLane(deps: PermissionLifecycleMutationLaneDeps): PermissionLifecycleMutationLane;
//# sourceMappingURL=mutation-lane.d.ts.map