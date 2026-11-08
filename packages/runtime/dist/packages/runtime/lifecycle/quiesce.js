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
 * WHAT STEP 1 AND STEP 2 ARE, MEASURED (PD20-B1, `a5sf-recon-shell`):
 * "close-admission" is the boundary new execution is refused at — the step
 * publishes the close to the state the Member's lane guard reads
 * (`lifecycle/admission-state`, keyed by the instance id the compiled policy
 * carries AND by the child session id), so the NEXT tool boundary of the
 * member's own turn is refused with `LIFECYCLE_ADMISSION_CLOSED` before it can
 * spawn a command or touch a byte. The step is where the state is published on
 * purpose: the procedure owns the close/open lifetime, so a later root wiring
 * cannot forget it, and the reopened state is dropped on every exit of
 * Archive/Dispose (`reopenAdmission` below). "interrupt" is the PUBLIC Agent cancel, which stops
 * the activity at its next step but does NOT retroactively abort a tool call
 * already running: a turn that is mid-command finishes that command, and the
 * call returns only after the turn has settled (measured window 8.56 s / 8.72 s
 * across two boots, a second `bash` refused at the boundary 290/427 ms before
 * the durable commit). The procedure therefore never promised "the turn is
 * cancelled instantly" — it promises no NEW execution is admitted, and the
 * step order above is what makes that true.
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
import { clearMemberAdmissionClosedForInstance, markMemberAdmissionClosed } from './admission-state.js';
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
    // …and PUBLISH the close to the one reader every Member execution face goes
    // through (the lane guard). The port closes the Team tool-dispatch route; this
    // stamp closes the member's OWN next tool boundary, which that route never
    // sees. Both are step 1: "no new work may be admitted" is one boundary with
    // two faces. `reopenAdmission` below drops it on every exit.
    markMemberAdmissionClosed({
        childSessionId: member.childSessionId,
        instanceId: target.instanceId,
        rootSessionId: target.rootSessionId,
    });
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
/**
 * Reopen new-work admission for one member — the counterpart of step 1,
 * which Archive and Dispose run on EVERY exit (committed, aborted, or
 * faulted). Optional on the port: an absent method is a no-op (the mock-first
 * worlds, and any wiring that never closed).
 *
 * The close is a PROCESS-LOCAL window, not the durable authority: after a
 * successful commit the durable lifecycle refuses the member, and after a
 * failed operation the member is still SETTLED — keeping it closed would brick
 * a live member for the rest of the process. A reopen fault is therefore
 * swallowed rather than surfaced: it must not turn a committed archive into a
 * reported failure, and it protects nothing on the failure path.
 * @param ports - the lifecycle ports.
 * @param target - the composite member identity.
 * @returns never rejects.
 */
export async function reopenAdmission(ports, target) {
    const reopen = ports.admission.reopenNewWork;
    try {
        if (typeof reopen === 'function')
            await reopen.call(ports.admission, target);
    }
    catch {
        // See the doc: the durable lifecycle (not this flag) is the authority, and
        // the only correct caller-visible outcome is the operation's own result.
    }
    finally {
        // The published close is dropped LAST and unconditionally: a port fault must
        // not leave the member's lane shut for the rest of the process, and the
        // durable row is the authority from here on.
        clearMemberAdmissionClosedForInstance(target.instanceId);
    }
}
/**
 * The POST-COMMIT residency re-drop (the archive/dispose race, row 6).
 *
 * Why this exists after step 5 already dropped residency: quiesce drops the
 * handle BEFORE the durable transition is committed, so the drop→commit window
 * is a real interval in which a dispatch may cold-resume the member (the
 * durable row still reads SETTLED). A handle resumed in that window would
 * survive the commit — and `ensureLiveAgent` returns a resident handle from
 * `liveAgents` BEFORE consulting the durable gate, so it would outlive the
 * archive for the rest of the process. Re-running the (idempotent) drop AFTER
 * the commit closes that half; the glue's post-resume durable re-read closes
 * the other (a resume that resolves after the commit).
 *
 * A port fault here is swallowed: the durable transition is ALREADY committed,
 * so throwing would report a failed archive for a committed one. The durable
 * gate refuses the member either way; the drop is the in-process cleanup.
 * @param ports - the lifecycle ports.
 * @param childSessionId - the member's child session (the residency key).
 * @returns whether a (re)appeared handle was dropped.
 */
export function dropResidencyAfterCommit(ports, childSessionId) {
    try {
        return ports.residency.dropResidency(childSessionId);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=quiesce.js.map