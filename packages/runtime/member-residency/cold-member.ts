/**
 * The cold-member resume path (P5-T6; DevPlan §18.5: "Agent residency is
 * EPHEMERAL ... new work arrives as a COLD resume of the durable
 * MemberInstance + child Session"; TaskDoc §11.5 P5-T6 card).
 *
 * {@link rehydrateColdMember} brings a durable member back as a resident
 * agent WITHOUT any fresh-time side effect: it reads the durable
 * MemberInstance record (and verifies its child session binding), then
 * runs the P5-T1 binder's cold-member path — `surface.restoreScope(
 * childSessionId, scope)` with the member scope
 * `{ kind: 'member', rootSessionId, instanceId, slots:
 * ['persona', 'model', 'capability'] }` + the
 * `agent-setup/scope-restored` event record + the admission GUARD
 * decision re-decided (`agent-setup/admission-decided`). NO slot
 * `apply`, NO `installOverlay`, NO durable write — the overlay slots'
 * `restore` behavior reads the durable scope, never re-runs creation
 * logic (the T2/T3/T4 slot contract; "zero fresh side effects" is the
 * G5 must-assert of the M2 harness scenario).
 *
 * Orchestration (every step fail-closed; ZERO durable writes by
 * construction — the write port is never consulted on this path):
 *
 * 1. Input validation (`./identity.js`) — the composite identity
 *    `(rootSessionId, instanceId)` is validated fail-closed
 *    (`MEMBER_RESIDENCY_INVALID_INPUT`, no effect).
 * 2. Record load — the durable MemberInstance record of the addressed
 *    identity. ABSENT: the identity is a no-op
 *    (`noopReason: 'absent'`, `durable` and `bind` ABSENT, zero effects)
 *    — the member analogue of the ordinary-root no-op: cold-resuming an
 *    identity that never had a record restores nothing and writes
 *    nothing.
 * 3. Child session binding PRE-CHECK — the record's `childSessionId`
 *    must carry a `team-member` binding row agreeing with the addressed
 *    identity (`MEMBER_RESIDENCY_RECORD_CONFLICT` otherwise). The binder
 *    alone would no-op such a world as `ordinary` (it resolves the
 *    identity FROM the binding row, P5-T1 step 1) — but an explicit
 *    `(rootSessionId, instanceId)` address with a present record and a
 *    missing / inconsistent binding is CORRUPTION of the durable state,
 *    not ordinariness: the module fails closed with a loud conflict
 *    instead of a silent no-op. (The crash-window state "record present,
 *    binding absent" is repaired by RE-DRIVING the fresh path
 *    (`./fresh-member.js`), which convergently re-puts the binding.)
 * 4. The binder's cold-member path (P5-T1) — a NEW `TeamAgentBinder` per
 *    call (fresh per-invocation state, mirror of the T5 discipline),
 *    driving `rehydrateColdMember(childSessionId)`: scope restore +
 *    admission re-decided. A `DISPOSED` record fails with the binder's
 *    `BINDER_MEMBER_DISPOSED` (propagated unwrapped — the terminal state
 *    is never resumed).
 *
 * RE-ADMIT after an evict (`./evict.ts`) is this same path: the evict
 * dropped only the ephemeral residency, so the durable rows are intact
 * and the cold resume restores the scope again — idempotent, zero
 * writes, no duplicate records (Architecture §31: lifecycle !=
 * residency; DevPlan §18.5).
 *
 * @module @dsh-agent-team/runtime/member-residency/cold-member
 */

import { TeamAgentBinder } from '../agent-setup/binder/index.js'
import {
  MEMBER_RESIDENCY_ERROR_CODES,
  MemberResidencyError,
} from './errors.js'
import { validateMemberIdentityInput } from './identity.js'
import type {
  ColdMemberResult,
  MemberIdentityInput,
  MemberResidencyDurableState,
  MemberResidencyPorts,
} from './types.js'

/**
 * Cold-resume one durable member (see the module docs for the full
 * orchestration and the no-op / fail-closed semantics).
 *
 * @param ports - the injected handles (read handle, surface, residency
 *   port, optional slot/guard overrides; the write port is NOT
 *   consulted on this path).
 * @param input - the composite member identity `(rootSessionId,
 *   instanceId)`.
 * @returns the result: `noopReason: 'absent'` (absent record — zero
 *   effects) or the durable state (`wrote: false`) plus the binder's
 *   cold-member bind result (scope restored, admission re-decided).
 * @throws {@link MemberResidencyError} (`MEMBER_RESIDENCY_INVALID_INPUT`,
 *   `MEMBER_RESIDENCY_RECORD_CONFLICT`) before any effect; the binder's
 *   own errors (e.g. `BINDER_MEMBER_DISPOSED`, `BINDER_OVERLAY_FAILED`)
 *   propagate unwrapped.
 */
export async function rehydrateColdMember(
  ports: MemberResidencyPorts,
  input: MemberIdentityInput,
): Promise<ColdMemberResult> {
  // Step 1 — input validation (fail-closed, no effect).
  validateMemberIdentityInput(input)
  const rootSessionId = String(input.rootSessionId)
  const instanceId = String(input.instanceId)

  // Step 2 — the durable record (read-only). Absent: the zero-record,
  // zero-effect no-op.
  const member = ports.teamDomain.getMemberInstance(rootSessionId, instanceId)
  if (member === undefined) {
    return { path: 'cold-member', noopReason: 'absent' }
  }

  // Step 3 — the child session binding pre-check (fail-closed; the
  // rationale is in the module docs).
  const binding = ports.teamDomain.getSessionBinding(member.childSessionId)
  const foundMemberBinding =
    binding !== undefined && binding.kind === 'team-member' ? binding : undefined
  const foundRoot = foundMemberBinding?.rootSessionId ?? 'none'
  const foundInstance = foundMemberBinding?.instanceId ?? 'none'
  if (
    foundMemberBinding === undefined ||
    foundMemberBinding.rootSessionId !== rootSessionId ||
    foundMemberBinding.instanceId !== instanceId
  ) {
    throw new MemberResidencyError(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_RECORD_CONFLICT,
      `child session '${member.childSessionId}' of member (root '${rootSessionId}', instance '${instanceId}') carries no consistent 'team-member' binding (found kind: ${binding === undefined ? 'none' : binding.kind}, root: '${foundRoot}', instance: '${foundInstance}'); re-drive the fresh path to converge, or repair the durable state`,
      {
        rootSessionId,
        instanceId,
        childSessionId: member.childSessionId,
        foundKind: binding?.kind,
        foundRoot,
        foundInstance,
      },
    )
  }

  // Step 4 — the binder's cold-member path (the scope restore + the
  // admission re-decision; zero durable writes, zero fresh-time side
  // effects by the binder's cold-path contract).
  const binder = new TeamAgentBinder({
    surface: ports.surface,
    teamDomain: ports.teamDomain,
    ...(ports.slots !== undefined ? { slots: ports.slots } : {}),
    ...(ports.admissionGuard !== undefined ? { admissionGuard: ports.admissionGuard } : {}),
  })
  const bind = binder.rehydrateColdMember(member.childSessionId)

  const durable: MemberResidencyDurableState = {
    member,
    binding: foundMemberBinding,
    wrote: false,
  }
  return { path: 'cold-member', durable, bind }
}
