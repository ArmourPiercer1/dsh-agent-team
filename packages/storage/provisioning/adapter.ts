/**
 * AgentFactoryAdapter — the NARROW public-surface adapter for the ONE
 * external effect of member provisioning (TaskDoc §11.5 P4-T4; ruling R20).
 *
 * The durable provisioning protocol (Development Plan §17.3 crash model,
 * Architecture §18) has exactly one step that reaches OUTSIDE the TeamDomain
 * sidecar: the creation of the member's durable child DSH Session (and the
 * Agent bound to it). Every other step — recording the child id, the
 * SessionBinding, the MemberInstance record, the ledger fact, and the
 * COMMITTED operation marker — is a durable TeamDomain write owned by this
 * package and its P4-T1/T2/T3 dependencies.
 *
 * The adapter is the seam between that one external effect and the durable
 * state machine. It is intentionally minimal:
 *
 * - `createChildSession(request)` is the ONLY method. It is the single
 *   external effect; surfacing more would let the runtime leak Team
 *   control-plane authority (Architecture §14: TeamDomain is the SOLE Team
 *   control-plane authority). The coordinator never needs to read, list,
 *   or destroy child sessions through this seam in P4 — those are runtime
 *   concerns of a later phase (P5).
 *
 * **Idempotency contract (why it is needed):** the crash model allows a
 * crash between the external effect completing and its durable record
 * landing (Development Plan §17.4 "after child create"). Recovery
 * re-drives the SAME operation, and a re-drive MUST NOT create a second
 * external child for the same member. Therefore the adapter MUST be
 * idempotent on the member identity `(rootSessionId, instanceId)`:
 * calling `createChildSession` again for the same member returns the SAME
 * `childSessionId` it returned before (it never mints a second child for
 * one member). This is what makes "effect success but lost durable record"
 * converge to ONE child instead of two (the fake in `fake-adapter.ts`
 * models this; a real binding in P5 must satisfy the same contract).
 *
 * **No runtime here:** this module is a pure type surface. It imports NO
 * host backend, NO live Agent, NO DSH runtime, and NO `node:` builtin. The
 * only implementation shipped in this task is the deterministic in-memory
 * `FakeAgentFactoryAdapter` (`fake-adapter.ts`); the real adapter binding is
 * a later phase (P5 runtime).
 *
 * @module @dsh-agent-team/storage/provisioning/adapter
 */

import type { ChildSessionId, InstanceId, RootSessionId, TemplateId } from '../../contracts/src/index.js'

/**
 * The minimal request to create the durable child Session of one member.
 *
 * Only the member's runtime identity and the static creation identity are
 * carried:
 *
 * - `rootSessionId` + `instanceId` — the member runtime identity
 *   (invariant 18). This is the adapter's IDEMPOTENCY key: the same pair
 *   must always resolve to the same child session (see module docs).
 * - `templateId` — the static template identity the child Agent is built
 *   from (invariant 19: NOT a runtime identity, but required so the child
 *   Agent has a persona/role; carried for the later real binding).
 * - `label` — the human-facing label of the member (carried so a real
 *   factory can name the child; NOT a runtime identity).
 * - `workspace` — the effective workspace the child inherits (optional;
 *   absent means inherited, Architecture §21.2).
 */
export interface CreateChildSessionRequest {
  /** The TeamSession (root session id) the member belongs to. */
  readonly rootSessionId: RootSessionId
  /** The member's stable instance id (with the root, the runtime identity). */
  readonly instanceId: InstanceId
  /** The static template identity the child Agent is built from. */
  readonly templateId: TemplateId
  /** The human-facing member label (NOT a runtime identity). */
  readonly label: string
  /** The effective workspace (optional; absent means inherited). */
  readonly workspace?: string
}

/**
 * The result of one child-session creation: the durable child DSH Session
 * id the member is bound to (invariant 23). Nothing else crosses the seam —
 * the coordinator records this id durably and builds the rest of the
 * protocol from TeamDomain writes.
 */
export interface CreateChildSessionResult {
  /** The durable child DSH Session bound to the member. */
  readonly childSessionId: ChildSessionId
}

/**
 * The narrow public-surface adapter for the provisioning external effect.
 *
 * Implementations MUST be idempotent on `(rootSessionId, instanceId)` (see
 * module docs) and MUST NOT mutate any TeamDomain state (the TeamDomain is
 * written only by the coordinator through the repositories).
 */
export interface AgentFactoryAdapter {
  /**
   * Create (or, on a retry, re-resolve) the durable child Session of one
   * member. Idempotent on the member identity: a repeated call for the same
   * `(rootSessionId, instanceId)` returns the same `childSessionId`.
   * @param request - the minimal creation request.
   * @returns the durable child session id.
   */
  createChildSession(request: CreateChildSessionRequest): Promise<CreateChildSessionResult>
}
