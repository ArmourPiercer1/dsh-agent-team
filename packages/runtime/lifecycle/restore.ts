/**
 * P7-T3 — the RESTORE procedure (DevPlan §20.3; Architecture §30.2,
 * final frozen semantics 3A).
 *
 * ```text
 * Restore:  ARCHIVED → SETTLED   (不得 resume Agent)
 * ```
 *
 * Restore is DURATIONAL AVAILABILITY ONLY: it commits the single durable
 * edge `ARCHIVED → SETTLED` and NOTHING else. It has, by construction,
 * ZERO live-runtime contact — no admission-close, no interrupt, no
 * descendant drain, no residency release, and (the G7 criterion, DevPlan
 * §20.7: "Restore does not create/resume Agent") no Agent create/resume
 * call of any kind. The module simply never holds a code path from this
 * file to a live port: the only step is `commit-restore`.
 *
 * Legality (the pure P3-T3 FSM, dry-run probed): RESTORE is legal from
 * `ARCHIVED` ONLY. From `CREATED` / `RUNNING` / `SETTLED` it is an
 * `LIFECYCLE_ILLEGAL_TRANSITION`, from `DISPOSED` a
 * `LIFECYCLE_TERMINAL_STATE` — both mapped into `LIFECYCLE_ILLEGAL_STATE`
 * BEFORE any effect (zero live calls, zero durable writes).
 *
 * A restored member is SETTLED — new work reaches RUNNING through the
 * normal admission path (DevPlan §20.3 "New work", Architecture §30.3
 * `SETTLED → RUNNING` ADMIT_WORK), never through Restore.
 *
 * @module @dsh-agent-team/runtime/lifecycle/restore
 */

import type { MemberInstanceRecordDto } from '../../contracts/src/index.js'
import {
  LIFECYCLE_OPERATIONS,
  applyLifecycleOperation,
} from '../../domain/lifecycle/src/index.js'
import { LIFECYCLE_STEP_NAMES } from './types.js'
import type { LifecyclePorts, RestoreMemberResult, LifecycleTarget } from './types.js'
import { commitDurable, loadMember, rejectIllegalState } from './resolve.js'

/**
 * Restore one member: the single durable commit `ARCHIVED → SETTLED`.
 * Durable availability only — NO Agent create/resume, NO live port of any
 * kind is touched (the structural G7 guarantee).
 *
 * @param ports - the lifecycle ports (only `teamDomain` is reachable from
 *   this procedure).
 * @param target - the composite member identity.
 * @returns the committed SETTLED record + the step trace (exactly
 *   `[commit-restore]`).
 * @throws {@link LifecycleRuntimeError} — `LIFECYCLE_INVALID_INPUT`,
 *   `LIFECYCLE_MEMBER_NOT_FOUND`, `LIFECYCLE_ILLEGAL_STATE` (all before
 *   any effect, zero live calls, zero writes) or
 *   `LIFECYCLE_DURABLE_STATE_FAILED` (the commit fault).
 */
export async function restoreMember(
  ports: LifecyclePorts,
  target: LifecycleTarget,
): Promise<RestoreMemberResult> {
  // Prologue — fail-closed: identity, durable read, dry-run legality.
  const member = loadMember(ports, target)
  let restored: MemberInstanceRecordDto
  try {
    restored = applyLifecycleOperation(member, LIFECYCLE_OPERATIONS.RESTORE)
  } catch (error) {
    rejectIllegalState(member.lifecycle, error)
  }

  // The single durable commit (the exact probed transition). No live
  // step precedes or follows it — that is the frozen 3A semantics.
  await commitDurable(
    ports,
    target,
    member.lifecycle,
    LIFECYCLE_OPERATIONS.RESTORE,
    restored.lifecycle,
    LIFECYCLE_STEP_NAMES.COMMIT_RESTORE,
  )

  return {
    member: restored,
    steps: Object.freeze([LIFECYCLE_STEP_NAMES.COMMIT_RESTORE]),
  }
}
