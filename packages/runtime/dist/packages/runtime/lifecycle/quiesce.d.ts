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
//# sourceMappingURL=quiesce.d.ts.map