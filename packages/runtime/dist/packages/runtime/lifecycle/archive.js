/**
 * P7-T3 — the ARCHIVE procedure (DevPlan §20.3; Architecture §30.1).
 *
 * ```text
 * Archive:  close admission → interrupt → drain descendants
 *           → wait quiescence → release residency → commit ARCHIVED
 * ```
 *
 * The frozen §29 FSM has NO `RUNNING → ARCHIVED` edge (the durable edge to
 * ARCHIVED exists only from the quiescent SETTLED state, §30.1), so
 * archiving a RUNNING member durably SETTLES the interrupted work FIRST:
 *
 * ```text
 * RUNNING:  quiesce → commit SETTLE → commit ARCHIVE   (two durable writes)
 * SETTLED:  quiesce → commit ARCHIVE                   (one durable write)
 * CREATED / ARCHIVED / DISPOSED:  rejected BEFORE any live effect
 *                                 (LIFECYCLE_ILLEGAL_STATE; zero writes)
 * ```
 *
 * The order invariants (all asserted by the tests):
 *
 * 1. fail-closed prologue — identity validation, then the durable read,
 *    then the DRY-RUN legality probe over the pure P3-T3 FSM. No live
 *    effect and no write can precede a legal plan;
 * 2. quiesce FIRST — the five live steps (shared {@link quiesceMember})
 *    complete — or the procedure aborts (`LIFECYCLE_NOT_QUIESCENT` /
 *    `LIFECYCLE_LIVE_EFFECT_FAILED`) with zero durable writes and the
 *    residency unreleased — before any commit;
 * 3. the durable commits send the EXACT probed transitions
 *    (`{ from, operation, to }` of the dry-run output) through the
 *    injected P6-T2 {@link LifecycleCommitPort} — the commit cannot
 *    drift from the probed legality. The `member_instances` store is
 *    append-only per record (P4); this module never rewrites it.
 *
 * Crash-window semantics (DevPlan §20.7 "quiescence 与 durable
 * lifecycle 一致"): if the process dies between the SETTLE commit and the
 * ARCHIVE commit, the member is durably SETTLED — retrying `archiveMember`
 * re-plans from the durable record (now SETTLED), quiesces again (a no-op
 * live procedure) and commits only ARCHIVE. No state is lost or doubled.
 *
 * @module @dsh-agent-team/runtime/lifecycle/archive
 */
import { LIFECYCLE_OPERATIONS, applyLifecycleOperation, } from '../../domain/lifecycle/src/index.js';
import { LIFECYCLE_STEP_NAMES } from './types.js';
import { commitDurable, loadMember, rejectIllegalState } from './resolve.js';
import { quiesceMember } from './quiesce.js';
/**
 * Probe the archive legality DRY (zero effects): RUNNING ⇒
 * SETTLE-then-ARCHIVE, SETTLED ⇒ ARCHIVE, anything else ⇒
 * `LIFECYCLE_ILLEGAL_STATE` (the domain rejection is mapped, never
 * leaked).
 * @param member - the durable member record.
 * @returns the archive plan (the probed intermediate, when any).
 */
function planArchive(member) {
    try {
        if (member.lifecycle !== 'RUNNING') {
            applyLifecycleOperation(member, LIFECYCLE_OPERATIONS.ARCHIVE);
            return { settled: undefined };
        }
        const settled = applyLifecycleOperation(member, LIFECYCLE_OPERATIONS.SETTLE);
        applyLifecycleOperation(settled, LIFECYCLE_OPERATIONS.ARCHIVE);
        return { settled };
    }
    catch (error) {
        rejectIllegalState(member.lifecycle, error);
    }
}
/**
 * Archive one member: close admission → interrupt → drain descendants →
 * wait quiescence → release residency → commit ARCHIVED (a RUNNING member
 * is durably SETTLED first — the frozen FSM has no RUNNING→ARCHIVED edge).
 *
 * @param ports - the lifecycle ports.
 * @param target - the composite member identity.
 * @returns the committed record + the full ordered step trace + the
 *   settle/archive/drain/residency observations.
 * @throws {@link LifecycleRuntimeError} — `LIFECYCLE_INVALID_INPUT`,
 *   `LIFECYCLE_MEMBER_NOT_FOUND`, `LIFECYCLE_ILLEGAL_STATE` (all before
 *   any effect, zero writes), `LIFECYCLE_NOT_QUIESCENT` /
 *   `LIFECYCLE_LIVE_EFFECT_FAILED` (after the live steps, still zero
 *   writes), `LIFECYCLE_DURABLE_STATE_FAILED` (a commit fault).
 */
export async function archiveMember(ports, target) {
    // Prologue — fail-closed: identity, durable read, dry-run legality.
    const member = loadMember(ports, target);
    const plan = planArchive(member);
    // Quiesce FIRST (Architecture §30.1): the five live steps complete
    // before any durable commit — or the procedure aborts with zero writes.
    const outcome = await quiesceMember(ports, target, member);
    const steps = [...outcome.steps];
    // The durable commits (the exact probed transitions, verbatim).
    if (plan.settled !== undefined) {
        await commitDurable(ports, target, member.lifecycle, LIFECYCLE_OPERATIONS.SETTLE, plan.settled.lifecycle, member.activityVersion, LIFECYCLE_STEP_NAMES.COMMIT_SETTLE);
        steps.push(LIFECYCLE_STEP_NAMES.COMMIT_SETTLE);
    }
    const base = plan.settled ?? member;
    const archived = applyLifecycleOperation(base, LIFECYCLE_OPERATIONS.ARCHIVE);
    await commitDurable(ports, target, base.lifecycle, LIFECYCLE_OPERATIONS.ARCHIVE, archived.lifecycle, base.activityVersion, LIFECYCLE_STEP_NAMES.COMMIT_ARCHIVE);
    steps.push(LIFECYCLE_STEP_NAMES.COMMIT_ARCHIVE);
    return {
        member: archived,
        steps: Object.freeze(steps),
        settledCommitted: plan.settled !== undefined,
        drained: outcome.drained,
        residencyDropped: outcome.residencyDropped,
    };
}
//# sourceMappingURL=archive.js.map