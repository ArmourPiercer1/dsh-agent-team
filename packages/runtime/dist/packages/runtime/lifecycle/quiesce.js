/**
 * P7-T3 — the shared QUIESCENCE procedure of Archive and Dispose
 * (DevPlan §20.3 steps 1–5; Architecture §30.1 "quiesce FIRST, then the
 * durable transition").
 *
 * The five live steps, in the frozen order:
 *
 * ```text
 * 1 close-admission   — no new work may be admitted (AdmissionClosePort)
 * 2 interrupt         — cancel the member's current activity (MemberActivityPort)
 * 3 drain-descendants — drain the resident generic descendants
 *                       (DescendantDrainPort, the public descendant seam)
 * 4 wait-quiescence   — the quiescence observation of the drain report
 * 5 release-residency — drop the resident Agent handle (ResidencyPort, P5-T6)
 * ```
 *
 * Fail-closed guarantees (asserted by the tests):
 *
 * - a FAULT at any live step aborts before the remaining steps and before
 *   any durable write (`LIFECYCLE_LIVE_EFFECT_FAILED`, `details.step` =
 *   the failing step) — and `release-residency` is never reached after a
 *   drain fault or a quiescence negative;
 * - a NON-QUIESCENT drain report (`quiescent: false`, or a malformed
 *   report) aborts with `LIFECYCLE_NOT_QUIESCENT` — zero durable writes
 *   and the residency is NOT released. Because the quiescence observation
 *   precedes `release-residency`, the forbidden order ("write ARCHIVED,
 *   then try to stop the Agent", Architecture §30.1) cannot occur here:
 *   no durable write of the module can ever precede a completed
 *   quiescence.
 *
 * The procedure returns the ordered step trace of the FIVE live steps;
 * the caller appends its own commit steps.
 * @module @dsh-agent-team/runtime/lifecycle/quiesce
 */
import { LIFECYCLE_RUNTIME_ERROR_CODES, LifecycleRuntimeError, errorMessage, } from './errors.js';
import { LIFECYCLE_STEP_NAMES } from './types.js';
/**
 * One fault of a live port, mapped to `LIFECYCLE_LIVE_EFFECT_FAILED` with
 * the failing step.
 * @param step - the failing step name.
 * @param error - the thrown value of the port call.
 * @returns the typed runtime error.
 */
function liveFailure(step, error) {
    return new LifecycleRuntimeError(LIFECYCLE_RUNTIME_ERROR_CODES.LIFECYCLE_LIVE_EFFECT_FAILED, `lifecycle live effect failed at step '${step}': ${errorMessage(error)}`, { step });
}
/**
 * Run the five-step quiescence procedure for one member (shared by
 * Archive and Dispose).
 *
 * @param ports - the lifecycle ports.
 * @param target - the composite member identity (addressed by the
 *   admission-close and interrupt steps).
 * @param member - the durable member record (its `childSessionId`
 *   addresses the descendant seam and the residency port).
 * @returns the ordered live-step trace + the drain observation + the
 *   residency-release observation.
 * @throws {@link LifecycleRuntimeError} — `LIFECYCLE_LIVE_EFFECT_FAILED`
 *   (a port fault, `details.step` = the failing step) or
 *   `LIFECYCLE_NOT_QUIESCENT` (the quiescence negative; `details.drained`
 *   = the drain count, `details.step` = `wait-quiescence`).
 */
export async function quiesceMember(ports, target, member) {
    const steps = [];
    // Step 1 — close new-work admission (DevPlan §20.3 step 1).
    try {
        await ports.admission.closeNewWork(target);
    }
    catch (error) {
        throw liveFailure(LIFECYCLE_STEP_NAMES.CLOSE_ADMISSION, error);
    }
    steps.push(LIFECYCLE_STEP_NAMES.CLOSE_ADMISSION);
    // Step 2 — interrupt the member's current activity (step 2).
    try {
        await ports.activity.interrupt(target);
    }
    catch (error) {
        throw liveFailure(LIFECYCLE_STEP_NAMES.INTERRUPT, error);
    }
    steps.push(LIFECYCLE_STEP_NAMES.INTERRUPT);
    // Step 3 — drain the resident generic descendants (step 3).
    let report;
    try {
        report = await ports.descendants.drainDescendants(member.childSessionId);
    }
    catch (error) {
        throw liveFailure(LIFECYCLE_STEP_NAMES.DRAIN_DESCENDANTS, error);
    }
    steps.push(LIFECYCLE_STEP_NAMES.DRAIN_DESCENDANTS);
    // Step 4 — wait quiescence (step 4): the quiescence observation. A
    // malformed report (non-object, non-boolean, non-number) is treated as
    // a quiescence NEGATIVE — fail closed, no write, no release.
    if (typeof report !== 'object' ||
        report === null ||
        typeof report.quiescent !== 'boolean' ||
        typeof report.drained !== 'number') {
        throw new LifecycleRuntimeError(LIFECYCLE_RUNTIME_ERROR_CODES.LIFECYCLE_NOT_QUIESCENT, `descendant drain returned a malformed report for child session ${member.childSessionId}`, { step: LIFECYCLE_STEP_NAMES.WAIT_QUIESCENCE, reason: 'malformed-drain-report' });
    }
    if (report.quiescent !== true) {
        throw new LifecycleRuntimeError(LIFECYCLE_RUNTIME_ERROR_CODES.LIFECYCLE_NOT_QUIESCENT, `descendant drain reported residual activity for child session ${member.childSessionId}: drained=${report.drained}`, { step: LIFECYCLE_STEP_NAMES.WAIT_QUIESCENCE, drained: report.drained });
    }
    steps.push(LIFECYCLE_STEP_NAMES.WAIT_QUIESCENCE);
    // Step 5 — release the resident Agent handle (step 5). NO-OP semantics
    // when the handle is absent (the P5-T6 port contract); a live fault here
    // still aborts before any durable commit.
    let dropped;
    try {
        dropped = ports.residency.dropResidency(member.childSessionId);
    }
    catch (error) {
        throw liveFailure(LIFECYCLE_STEP_NAMES.RELEASE_RESIDENCY, error);
    }
    steps.push(LIFECYCLE_STEP_NAMES.RELEASE_RESIDENCY);
    return {
        steps: Object.freeze(steps),
        drained: report.drained,
        residencyDropped: dropped,
    };
}
//# sourceMappingURL=quiesce.js.map