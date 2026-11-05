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
import type { MemberInstanceRecordDto } from '../../contracts/src/index.js';
import type { LifecyclePorts, LifecycleTarget, QuiesceOutcome } from './types.js';
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
export declare function quiesceMember(ports: LifecyclePorts, target: LifecycleTarget, member: MemberInstanceRecordDto): Promise<QuiesceOutcome>;
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
export declare function reopenAdmission(ports: LifecyclePorts, target: LifecycleTarget): Promise<void>;
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
export declare function dropResidencyAfterCommit(ports: LifecyclePorts, childSessionId: string): boolean;
//# sourceMappingURL=quiesce.d.ts.map