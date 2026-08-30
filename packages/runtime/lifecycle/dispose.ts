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

import type { MemberInstanceRecordDto } from '../../contracts/src/index.js'
import {
  LIFECYCLE_OPERATIONS,
  applyLifecycleOperation,
} from '../../domain/lifecycle/src/index.js'
import { LIFECYCLE_STEP_NAMES } from './types.js'
import type {
  DisposeMemberResult,
  LifecyclePorts,
  LifecycleStepName,
  LifecycleTarget,
} from './types.js'
import { commitDurable, loadMember, rejectIllegalState } from './resolve.js'
import { quiesceMember } from './quiesce.js'

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
export async function disposeMember(
  ports: LifecyclePorts,
  target: LifecycleTarget,
): Promise<DisposeMemberResult> {
  // Prologue — fail-closed: identity, durable read, dry-run legality.
  const member = loadMember(ports, target)
  let probed: MemberInstanceRecordDto
  try {
    probed = applyLifecycleOperation(member, LIFECYCLE_OPERATIONS.DISPOSE)
  } catch (error) {
    rejectIllegalState(member.lifecycle, error)
  }

  // Quiesce FIRST (Architecture §30.4): the five live steps complete
  // before the single commit — or the procedure aborts with zero writes.
  const outcome = await quiesceMember(ports, target, member)
  const steps: LifecycleStepName[] = [...outcome.steps, LIFECYCLE_STEP_NAMES.COMMIT_DISPOSE]

  // The single durable commit (the exact probed transition). The record
  // and its bindings stay on the durable medium (历史不删除): only the
  // lifecycle field moves to the terminal state.
  await commitDurable(
    ports,
    target,
    member.lifecycle,
    LIFECYCLE_OPERATIONS.DISPOSE,
    probed.lifecycle,
    LIFECYCLE_STEP_NAMES.COMMIT_DISPOSE,
  )

  return {
    member: probed,
    steps: Object.freeze(steps),
    drained: outcome.drained,
    residencyDropped: outcome.residencyDropped,
  }
}
