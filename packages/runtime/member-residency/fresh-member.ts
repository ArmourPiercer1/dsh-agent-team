/**
 * The fresh-member creation path (P5-T6; DevPlan §18.5 member residency;
 * TaskDoc §11.5 P5-T6 card).
 *
 * {@link createFreshMember} creates one member of a bound Team: it
 * derives the stable identity from the creation spec, durably commits the
 * MemberInstance record and the `team-member` session binding (idempotent
 * and CONVERGENT re-runs skip the writes or repair the lost side of the
 * crash window), and then runs the P5-T1 binder's fresh-member path so
 * the member becomes a resident agent with its full overlay scope — all
 * three frozen overlay slots (`persona`, `model`, `capability`) installed
 * plus the admission GUARD decision (the "四槽位" of the ruling: the
 * complete overlay set plus the admission decision point; DevPlan §18.2
 * substrate wiring lives in the injected slot implementations).
 *
 * Orchestration (every step fail-closed; the binder is never run unless
 * the durable state is consistent):
 *
 * 1. Identity derivation (`./identity.js`) — the spec is validated
 *    fail-closed (`MEMBER_RESIDENCY_INVALID_INPUT`, no effect); the
 *    derived `(instanceId, childSessionId)` is the ONLY identity used
 *    from here on (invariants 18/19/23/24).
 * 2. Root resolution (READ ONLY, before any effect) — the root session
 *    must carry a `team-root` binding (`MEMBER_RESIDENCY_ROOT_NOT_BOUND`
 *    otherwise — a member cannot be created under an unbound or
 *    ordinary/member session) AND a durable TeamSession record
 *    (`MEMBER_RESIDENCY_RECORD_CONFLICT` otherwise — a team-root binding
 *    without its record is an integrity violation, invariant 41).
 * 3. MemberInstance record — absent: durably put the `CREATED` /
 *    activityVersion-1 record. PRESENT: it must match the spec's
 *    immutable identity (templateId, label, groupId, workspace,
 *    childSessionId) exactly — `MEMBER_RESIDENCY_RECORD_CONFLICT`
 *    otherwise; a `DISPOSED` record is
 *    `MEMBER_RESIDENCY_LIFECYCLE_CONFLICT` (the terminal state is never
 *    re-entered by the create path; a re-creation after disposal is a
 *    DIFFERENT spec / different derived identity).
 * 4. `team-member` session binding — absent: durably put it. PRESENT: it
 *    must agree with the derived identity (`MEMBER_RESIDENCY_RECORD_CONFLICT`
 *    otherwise). CONVERGENT REPLAY (I1c): when the record is absent but a
 *    CONSISTENT binding is present, step 3 re-puts the record (recovery)
 *    and step 4 keeps the binding — a re-drive after a lost record
 *    produces no duplicate row (the repositories' identical-bytes put is
 *    an idempotent no-op) and no crash.
 *
 * CRASH-SAFE ORDERING: the record is committed BEFORE the binding
 * (mirror of the T5 root ordering). A crash between the two writes leaves
 * a binding-less record: the re-run detects it (step 4 sees no binding)
 * and completes it — there is no unrecoverable half-write. A binding
 * WITHOUT a record cannot arise from this module's ordering; it is
 * repaired convergently when consistent (step 3) and rejected otherwise
 * (step 4's conflict check).
 *
 * 5. The binder's fresh-member path (P5-T1) — a NEW
 *    `TeamAgentBinder` per call (fresh per-invocation state, mirror of
 *    the T5 discipline), driving `bindFreshMember(childSessionId)`:
 *    per slot in `OVERLAY_SLOT_ORDER` → `slot.apply(context)` +
 *    `surface.installOverlay(childSessionId, slot)` + the
 *    `agent-setup/overlay-installed` event record; then
 *    `admissionGuard.decide(context)` + the `agent-setup/admission-decided`
 *    record. Any binder failure propagates fail-closed and the durable
 *    commit of steps 3–4 STANDS BY DESIGN (DevPlan §18.5: durable commit
 *    + lost ephemeral residency is exactly the state the COLD path —
 *    `./cold-member.js` — recovers; re-reading the same durable rows on
 *    the next call is the recovery, not a duplicate).
 *
 * Idempotency: a re-run on a world where the member already exists
 * (records consistent, no lost rows) performs ZERO durable writes
 * (`durable.wrote === false`) and re-runs the fresh install on the same
 * records (the slot `apply` contract is idempotent; the surface
 * `installOverlay` is re-entrant by the T1 contract).
 *
 * @module @dsh-agent-team/runtime/member-residency/fresh-member
 */

import { TeamAgentBinder } from '../agent-setup/binder/index.js'
import type {
  ChildSessionId,
  InstanceId,
  MemberInstanceRecordDto,
  MemberInstanceRecordInput,
  RootSessionId,
  SessionBindingDto,
  TemplateId,
} from '../../contracts/src/index.js'
import {
  MEMBER_RESIDENCY_ERROR_CODES,
  MemberResidencyError,
} from './errors.js'
import { deriveMemberIdentity } from './identity.js'
import type {
  FreshMemberResult,
  MemberCreateSpec,
  MemberResidencyDurableState,
  MemberResidencyPorts,
} from './types.js'

/** The default `createdAt` clock (system UTC ISO-8601). */
function defaultNow(): string {
  return new Date().toISOString()
}

/**
 * Create one FRESH member of a bound Team (see the module docs for the
 * full orchestration and the crash/convergence guarantees).
 *
 * @param ports - the injected handles (read handle, write port, surface,
 *   residency port, optional slot/guard/clock overrides).
 * @param spec - the member creation spec (the canonical identity input).
 * @returns the result: the durable state (written or pre-existing) plus
 *   the binder's fresh-member bind result (all three overlay slots
 *   installed, admission decision included).
 * @throws {@link MemberResidencyError} (`MEMBER_RESIDENCY_INVALID_INPUT`,
 *   `MEMBER_RESIDENCY_ROOT_NOT_BOUND`,
 *   `MEMBER_RESIDENCY_RECORD_CONFLICT`,
 *   `MEMBER_RESIDENCY_LIFECYCLE_CONFLICT`) before any effect; a
 *   repository/seam write error or a binder error after the durable
 *   commit (fail-closed; see the module docs).
 */
export async function createFreshMember(
  ports: MemberResidencyPorts,
  spec: MemberCreateSpec,
): Promise<FreshMemberResult> {
  // Step 1 — identity derivation (fail-closed, no effect).
  const identity = deriveMemberIdentity(spec)
  const rootSessionId = spec.rootSessionId
  const { instanceId, childSessionId } = identity

  // Step 2 — root resolution (read-only, before any effect).
  const rootBinding = ports.teamDomain.getSessionBinding(rootSessionId)
  if (rootBinding === undefined || rootBinding.kind !== 'team-root') {
    throw new MemberResidencyError(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_ROOT_NOT_BOUND,
      `root session '${rootSessionId}' is not a bound Team root (found binding kind: ${rootBinding === undefined ? 'none' : rootBinding.kind}); a member cannot be created under it`,
      { rootSessionId, foundKind: rootBinding?.kind },
    )
  }
  const teamSession = ports.teamDomain.getTeamSession(rootSessionId)
  if (teamSession === undefined) {
    throw new MemberResidencyError(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_RECORD_CONFLICT,
      `root session '${rootSessionId}' carries a 'team-root' binding without its durable TeamSession record (integrity violation)`,
      { rootSessionId },
    )
  }

  // Step 3 — the MemberInstance record: write it, repair it (convergent
  // replay), or verify the existing one.
  let member: MemberInstanceRecordDto
  let wrote = false
  const existingMember = ports.teamDomain.getMemberInstance(rootSessionId, instanceId)
  const existingBinding = ports.teamDomain.getSessionBinding(childSessionId)
  if (existingMember === undefined) {
    // A binding present WITHOUT the record: it must be the consistent
    // team-member row (convergent replay, I1c) or it is an integrity
    // violation (a different identity bound this child session).
    const existingMemberBinding =
      existingBinding !== undefined && existingBinding.kind === 'team-member'
        ? existingBinding
        : undefined
    if (
      existingBinding !== undefined &&
      (existingMemberBinding === undefined ||
        existingMemberBinding.rootSessionId !== rootSessionId ||
        existingMemberBinding.instanceId !== instanceId)
    ) {
      throw new MemberResidencyError(
        MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_RECORD_CONFLICT,
        `child session '${childSessionId}' carries an inconsistent binding (kind '${existingBinding?.kind}', root '${existingMemberBinding?.rootSessionId ?? 'none'}', instance '${existingMemberBinding?.instanceId ?? 'none'}') while the MemberInstance record is absent`,
        {
          childSessionId,
          foundKind: existingBinding?.kind,
          foundRoot: existingMemberBinding?.rootSessionId,
          foundInstance: existingMemberBinding?.instanceId,
        },
      )
    }
    // The module's public API takes plain strings (validated fail-closed
    // by the identity derivation before this point); the contracts DTO
    // fields are the same strings at runtime — the `as` assertions mint
    // the compile-time brands of the validated values.
    const input: MemberInstanceRecordInput = {
      rootSessionId: rootSessionId as RootSessionId,
      instanceId: instanceId as InstanceId,
      templateId: spec.templateId as TemplateId,
      label: spec.label,
      ...(spec.groupId !== undefined ? { groupId: spec.groupId } : {}),
      childSessionId: childSessionId as ChildSessionId,
      ...(spec.workspace !== undefined ? { workspace: spec.workspace } : {}),
      lifecycle: 'CREATED',
      createdAt: (ports.now ?? defaultNow)(),
      activityVersion: 1,
    }
    member = await ports.writes.putMemberInstance(input)
    wrote = true
  } else {
    if (
      existingMember.templateId !== spec.templateId ||
      existingMember.label !== spec.label ||
      (existingMember.groupId ?? '') !== (spec.groupId ?? '') ||
      (existingMember.workspace ?? '') !== (spec.workspace ?? '') ||
      existingMember.childSessionId !== childSessionId
    ) {
      throw new MemberResidencyError(
        MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_RECORD_CONFLICT,
        `existing MemberInstance record (root '${rootSessionId}', instance '${instanceId}') conflicts with the creation spec; the spec is the canonical identity input and an existing record can never be re-pointed`,
        {
          rootSessionId,
          instanceId,
          existingTemplateId: existingMember.templateId,
          existingLabel: existingMember.label,
          existingGroupId: existingMember.groupId,
          existingWorkspace: existingMember.workspace,
          existingChildSessionId: existingMember.childSessionId,
        },
      )
    }
    if (existingMember.lifecycle === 'DISPOSED') {
      throw new MemberResidencyError(
        MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_LIFECYCLE_CONFLICT,
        `MemberInstance (root '${rootSessionId}', instance '${instanceId}') is DISPOSED (terminal); the fresh-create path cannot re-enter it — a re-creation after disposal is a different spec with a different derived identity`,
        { rootSessionId, instanceId, lifecycle: existingMember.lifecycle },
      )
    }
    member = existingMember
  }

  // Step 4 — the 'team-member' session binding row (record committed
  // first — the crash-safe ordering of the module docs).
  let binding: SessionBindingDto
  if (existingBinding === undefined) {
    binding = await ports.writes.putSessionBinding({
      kind: 'team-member',
      schemaVersion: 1,
      sessionId: childSessionId as ChildSessionId,
      rootSessionId: rootSessionId as RootSessionId,
      instanceId: instanceId as InstanceId,
    })
    wrote = true
  } else {
    const existingMemberBinding =
      existingBinding.kind === 'team-member' ? existingBinding : undefined
    if (
      existingMemberBinding === undefined ||
      existingMemberBinding.rootSessionId !== rootSessionId ||
      existingMemberBinding.instanceId !== instanceId
    ) {
      throw new MemberResidencyError(
        MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_RECORD_CONFLICT,
        `child session '${childSessionId}' is bound as '${existingBinding.kind}' (root '${existingMemberBinding?.rootSessionId ?? 'none'}', instance '${existingMemberBinding?.instanceId ?? 'none'}'); the derived binding must be the team-member row of (root '${rootSessionId}', instance '${instanceId}')`,
        {
          childSessionId,
          foundKind: existingBinding.kind,
          foundRoot: existingMemberBinding?.rootSessionId,
          foundInstance: existingMemberBinding?.instanceId,
        },
      )
    }
    binding = existingBinding
  }

  // Step 5 — the binder's fresh-member path (the agent-setup step): the
  // durable state above is now authoritative (invariant 41); any binder
  // failure propagates fail-closed and the durable commit stands
  // (DevPlan §18.5: the cold path is the recovery for that crash window).
  const binder = new TeamAgentBinder({
    surface: ports.surface,
    teamDomain: ports.teamDomain,
    ...(ports.slots !== undefined ? { slots: ports.slots } : {}),
    ...(ports.admissionGuard !== undefined ? { admissionGuard: ports.admissionGuard } : {}),
  })
  const bind = binder.bindFreshMember(childSessionId)

  const durable: MemberResidencyDurableState = { member, binding, wrote }
  return { path: 'fresh-member', durable, bind }
}
