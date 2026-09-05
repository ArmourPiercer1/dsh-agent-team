/**
 * P7-T3 — the shared resolve / reject core of the lifecycle operations
 * (TaskDoc §11.5 P7-T3 card; ruling R34 owned surface
 * `packages/runtime/lifecycle/**`).
 *
 * Every operation (Archive / Restore / Dispose) begins with the SAME
 * fail-closed prologue: validate the target identity (the P5-T6 identity
 * gate, wrapped into the runtime's own `LIFECYCLE_INVALID_INPUT`), then
 * the LeaderInstance guard (the reserved leader id is rejected with
 * `LIFECYCLE_LEADER_NOT_OPERABLE`, Architecture §9.2 / invariant 15,
 * regardless of whether a leader row exists and of its shape), then
 * read the durable record (absent → `LIFECYCLE_MEMBER_NOT_FOUND`, read
 * fault → `LIFECYCLE_DURABLE_STATE_FAILED` phase `read`). The prologue is
 * BEFORE any live effect and BEFORE any legality probe, so an invalid or
 * unknown target cannot touch the live runtime or the durable stores.
 *
 * The legality probes are DRY RUNS over the pure P3-T3 domain FSM
 * (`applyLifecycleOperation`): they throw the typed
 * `LifecycleTransitionError`, which this module maps into
 * `LIFECYCLE_ILLEGAL_STATE` (the domain error type is never leaked). A
 * probe that completes has already produced the exact next record — the
 * durable commit reuses the probe's output, so the commit cannot drift
 * from the probed legality.
 *
 * Pure orchestration helpers: no live contact of their own (the read
 * goes through the injected `TeamDomain`).
 * @module @dsh-agent-team/runtime/lifecycle/resolve
 */
import type { MemberInstanceRecordDto, MemberLifecycleState } from '../../contracts/src/index.js';
import type { LifecycleOperation } from '../../domain/lifecycle/src/index.js';
import { LifecycleRuntimeError } from './errors.js';
import type { LifecyclePorts, LifecycleStepName, LifecycleTarget } from './types.js';
/**
 * Validate the composite member identity fail-closed (the P5-T6 identity
 * gate; its `MemberResidencyError` is mapped into
 * `LIFECYCLE_INVALID_INPUT` with the offending `field` preserved).
 * @param target - the composite member identity.
 * @throws {@link LifecycleRuntimeError} (`LIFECYCLE_INVALID_INPUT`).
 */
export declare function validateTarget(target: LifecycleTarget): void;
/**
 * Read the durable MemberInstance record of the target (fail-closed):
 * the reserved leader id is rejected up front (`LIFECYCLE_LEADER_NOT_OPERABLE`,
 * §9.2 / invariant 15); otherwise absent → `LIFECYCLE_MEMBER_NOT_FOUND`;
 * read fault → `LIFECYCLE_DURABLE_STATE_FAILED` (phase `read`).
 * @param ports - the lifecycle ports.
 * @param target - the composite member identity.
 * @throws {@link LifecycleRuntimeError} (`LIFECYCLE_INVALID_INPUT`,
 *   `LIFECYCLE_LEADER_NOT_OPERABLE`, `LIFECYCLE_MEMBER_NOT_FOUND`, or
 *   `LIFECYCLE_DURABLE_STATE_FAILED`).
 * @returns the frozen durable record.
 */
export declare function loadMember(ports: LifecyclePorts, target: LifecycleTarget): MemberInstanceRecordDto;
/**
 * Map a domain FSM rejection into the runtime's `LIFECYCLE_ILLEGAL_STATE`
 * (the domain `LifecycleTransitionError` is never leaked). Anything that
 * is NOT a domain rejection is a programming fault and is re-thrown as-is.
 * @param from - the member's durable lifecycle state (for the details).
 * @param error - the thrown value of the dry-run probe.
 * @throws {@link LifecycleRuntimeError} (`LIFECYCLE_ILLEGAL_STATE`).
 * @returns never.
 */
export declare function rejectIllegalState(from: string, error: unknown): never;
/**
 * Wrap a durable read fault (phase `read`).
 * @param error - the thrown value of the repository read.
 * @returns the typed runtime error.
 */
export declare function durableReadFailure(error: unknown): LifecycleRuntimeError;
/**
 * Wrap a durable write fault (phase `write`, with the failing commit step).
 * @param step - the commit step that was being written.
 * @param error - the thrown value of the repository write.
 * @returns the typed runtime error.
 */
export declare function durableWriteFailure(step: LifecycleStepName, error: unknown): LifecycleRuntimeError;
/**
 * The durable commit of one probed transition (the P6-T2
 * {@link LifecycleCommitPort} — this module's documented surface for the
 * durable lifecycle commit; the `member_instances` store itself is
 * append-only per record and is never rewritten by this module).
 *
 * The commit is a compare-and-swap (R4/CR-10): `expectedActivityVersion`
 * is the version the probed record carried when this step planned the
 * transition; a concurrent writer that moved the row first makes the
 * commit fail instead of silently overwriting.
 * @param ports - the lifecycle ports.
 * @param identity - the composite member identity (addressed by the port).
 * @param from - the current durable lifecycle state (the probe's source).
 * @param operation - the FSM operation being committed.
 * @param to - the committed target state (the probe's output `lifecycle`).
 * @param expectedActivityVersion - the probed row's activityVersion (CAS).
 * @param step - the commit step name (for the fault details).
 * @throws {@link LifecycleRuntimeError} (`LIFECYCLE_DURABLE_STATE_FAILED`,
 *   phase `write`, with the failing step).
 */
export declare function commitDurable(ports: LifecyclePorts, identity: LifecycleTarget, from: MemberLifecycleState, operation: LifecycleOperation, to: MemberLifecycleState, expectedActivityVersion: number, step: LifecycleStepName): Promise<void>;
//# sourceMappingURL=resolve.d.ts.map