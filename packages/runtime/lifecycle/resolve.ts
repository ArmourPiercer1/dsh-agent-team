/**
 * P7-T3 — the shared resolve / reject core of the lifecycle operations
 * (TaskDoc §11.5 P7-T3 card; ruling R34 owned surface
 * `packages/runtime/lifecycle/**`).
 *
 * Every operation (Archive / Restore / Dispose) begins with the SAME
 * fail-closed prologue: validate the target identity (the P5-T6 identity
 * gate, wrapped into the runtime's own `LIFECYCLE_INVALID_INPUT`), then
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

import type { MemberInstanceRecordDto, MemberLifecycleState } from '../../contracts/src/index.js'
import { isLifecycleTransitionError } from '../../domain/lifecycle/src/index.js'
import type { LifecycleOperation } from '../../domain/lifecycle/src/index.js'
import { isMemberResidencyError, validateMemberIdentityInput } from '../member-residency/index.js'
import {
  LIFECYCLE_RUNTIME_ERROR_CODES,
  LifecycleRuntimeError,
  errorMessage,
} from './errors.js'
import type { LifecyclePorts, LifecycleStepName, LifecycleTarget } from './types.js'

/**
 * Validate the composite member identity fail-closed (the P5-T6 identity
 * gate; its `MemberResidencyError` is mapped into
 * `LIFECYCLE_INVALID_INPUT` with the offending `field` preserved).
 * @param target - the composite member identity.
 * @throws {@link LifecycleRuntimeError} (`LIFECYCLE_INVALID_INPUT`).
 */
export function validateTarget(target: LifecycleTarget): void {
  try {
    validateMemberIdentityInput(target)
  } catch (error) {
    const details: Record<string, unknown> = {}
    if (isMemberResidencyError(error)) {
      details.cause = error.code
      const field = error.details.field
      if (typeof field === 'string') details.field = field
    }
    throw new LifecycleRuntimeError(
      LIFECYCLE_RUNTIME_ERROR_CODES.LIFECYCLE_INVALID_INPUT,
      `invalid lifecycle target: ${errorMessage(error)}`,
      details,
    )
  }
}

/**
 * Read the durable MemberInstance record of the target (fail-closed):
 * absent → `LIFECYCLE_MEMBER_NOT_FOUND`; read fault →
 * `LIFECYCLE_DURABLE_STATE_FAILED` (phase `read`).
 * @param ports - the lifecycle ports.
 * @param target - the composite member identity.
 * @returns the frozen durable record.
 */
export function loadMember(ports: LifecyclePorts, target: LifecycleTarget): MemberInstanceRecordDto {
  validateTarget(target)
  let record: MemberInstanceRecordDto | undefined
  try {
    record = ports.teamDomain.repositories.memberInstances.get(target.rootSessionId, target.instanceId)
  } catch (error) {
    throw durableReadFailure(error)
  }
  if (record === undefined) {
    throw new LifecycleRuntimeError(
      LIFECYCLE_RUNTIME_ERROR_CODES.LIFECYCLE_MEMBER_NOT_FOUND,
      `no durable MemberInstance for team ${target.rootSessionId} instance ${target.instanceId}`,
      {
        rootSessionId: target.rootSessionId,
        instanceId: target.instanceId,
      },
    )
  }
  return record
}

/**
 * Map a domain FSM rejection into the runtime's `LIFECYCLE_ILLEGAL_STATE`
 * (the domain `LifecycleTransitionError` is never leaked). Anything that
 * is NOT a domain rejection is a programming fault and is re-thrown as-is.
 * @param from - the member's durable lifecycle state (for the details).
 * @param error - the thrown value of the dry-run probe.
 * @throws {@link LifecycleRuntimeError} (`LIFECYCLE_ILLEGAL_STATE`).
 * @returns never.
 */
export function rejectIllegalState(from: string, error: unknown): never {
  if (isLifecycleTransitionError(error)) {
    throw new LifecycleRuntimeError(
      LIFECYCLE_RUNTIME_ERROR_CODES.LIFECYCLE_ILLEGAL_STATE,
      `lifecycle state '${from}' forbids this operation: ${error.message}`,
      {
        from: error.from,
        to: error.to,
        reason: error.reason,
      },
    )
  }
  throw error
}

/**
 * Wrap a durable read fault (phase `read`).
 * @param error - the thrown value of the repository read.
 * @returns the typed runtime error.
 */
export function durableReadFailure(error: unknown): LifecycleRuntimeError {
  return new LifecycleRuntimeError(
    LIFECYCLE_RUNTIME_ERROR_CODES.LIFECYCLE_DURABLE_STATE_FAILED,
    `durable TeamDomain read failed: ${errorMessage(error)}`,
    { phase: 'read' },
  )
}

/**
 * Wrap a durable write fault (phase `write`, with the failing commit step).
 * @param step - the commit step that was being written.
 * @param error - the thrown value of the repository write.
 * @returns the typed runtime error.
 */
export function durableWriteFailure(step: LifecycleStepName, error: unknown): LifecycleRuntimeError {
  return new LifecycleRuntimeError(
    LIFECYCLE_RUNTIME_ERROR_CODES.LIFECYCLE_DURABLE_STATE_FAILED,
    `durable TeamDomain write failed at '${step}': ${errorMessage(error)}`,
    { phase: 'write', step },
  )
}

/**
 * The durable commit of one probed transition (the P6-T2
 * {@link LifecycleCommitPort} — this module's documented surface for the
 * durable lifecycle commit; the `member_instances` store itself is
 * append-only per record and is never rewritten by this module).
 * @param ports - the lifecycle ports.
 * @param identity - the composite member identity (addressed by the port).
 * @param from - the current durable lifecycle state (the probe's source).
 * @param operation - the FSM operation being committed.
 * @param to - the committed target state (the probe's output `lifecycle`).
 * @param step - the commit step name (for the fault details).
 * @throws {@link LifecycleRuntimeError} (`LIFECYCLE_DURABLE_STATE_FAILED`,
 *   phase `write`, with the failing step).
 */
export async function commitDurable(
  ports: LifecyclePorts,
  identity: LifecycleTarget,
  from: MemberLifecycleState,
  operation: LifecycleOperation,
  to: MemberLifecycleState,
  step: LifecycleStepName,
): Promise<void> {
  try {
    await ports.commit.commitTransition({
      rootSessionId: identity.rootSessionId,
      instanceId: identity.instanceId,
      from,
      operation,
      to,
    })
  } catch (error) {
    throw durableWriteFailure(step, error)
  }
}
