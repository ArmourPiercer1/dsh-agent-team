/**
 * P7-T3 — the DISPOSE procedure (DevPlan §20.3; Architecture §30.4;
 * §29.5 DISPOSED terminal; 历史不删除).
 *
 * ```text
 * Dispose:  quiesce → DISPOSED terminal   (历史不删除)
 * ```
 *
 * The frozen §29 FSM has a DIRECT `→ DISPOSED` edge from every non-
 * terminal state (`CREATED | RUNNING | SETTLED | ARCHIVED`), so Dispose
 * commits ONE durable write — no settle-then-dispose pair is needed
 * (unlike Archive of a RUNNING member):
 *
 * ```text
 * any non-terminal:  quiesce → commit DISPOSE   (one durable write)
 * DISPOSED:          rejected BEFORE any live effect
 *                    (LIFECYCLE_ILLEGAL_STATE; zero writes)
 * ```
 *
 * The order invariants (all asserted by the tests):
 *
 * 1. fail-closed prologue — identity validation, then the durable read,
 *    then the DRY-RUN legality probe;
 * 2. quiesce FIRST (Architecture §30.4): the five live steps (shared
 *    {@link quiesceMember}) complete — or the procedure aborts — before
 *    the single commit;
 * 3. the durable commit sends the EXACT probed transition
 *    (`{ from, operation, to }`) through the injected P6-T2
 *    {@link LifecycleCommitPort} (the `member_instances` store is
 *    append-only per record — P4 — and is never rewritten by this
 *    module);
 * 4. HISTORY IS PRESERVED (历史不删除): the DISPOSED record and the
 *    session bindings are NOT deleted by this module — the durable row
 *    remains readable with its identity fields verbatim, and only the
 *    lifecycle field changes to the terminal `DISPOSED` state.
 *
 * @module @dsh-agent-team/runtime/lifecycle/dispose
 */
import type { DisposeMemberResult, LifecyclePorts, LifecycleTarget } from './types.js';
/**
 * Dispose one member: close admission → interrupt → drain descendants →
 * wait quiescence → release residency → commit DISPOSED (the terminal
 * state; history is preserved).
 *
 * @param ports - the lifecycle ports.
 * @param target - the composite member identity.
 * @returns the committed DISPOSED record + the full ordered step trace +
 *   the drain/residency observations.
 * @throws {@link LifecycleRuntimeError} — `LIFECYCLE_INVALID_INPUT`,
 *   `LIFECYCLE_MEMBER_NOT_FOUND`, `LIFECYCLE_ILLEGAL_STATE` (all before
 *   any effect, zero writes), `LIFECYCLE_NOT_QUIESCENT` /
 *   `LIFECYCLE_LIVE_EFFECT_FAILED` (after the live steps, still zero
 *   writes), `LIFECYCLE_DURABLE_STATE_FAILED` (the commit fault).
 */
export declare function disposeMember(ports: LifecyclePorts, target: LifecycleTarget): Promise<DisposeMemberResult>;
//# sourceMappingURL=dispose.d.ts.map