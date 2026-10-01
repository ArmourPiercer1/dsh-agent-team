/**
 * The PermissionOverlayRepository PORT (Alpha.3 PR1; ADR §1, design §2).
 *
 * This is the seam the future `GovernanceMutationService` (Alpha.3 PR3) will
 * be wired against. It is a PERSISTENCE port and nothing else.
 *
 * ADR §1 states the authority chain:
 *
 *     Leader/Human request
 *             |
 *     GovernanceMutationService      <-- the SOLE permission mutation authority
 *             |
 *     PermissionOverlayRepository    <-- this port
 *             |
 *     TeamDomain (the durable Team sidecar)
 *
 * and forbids this port to:
 *
 *     - validate authority;
 *     - perform envelope checks;
 *     - bypass mutation serialization;
 *     - become an alternative write path.
 *
 * Those prohibitions are why the interface has exactly THREE members —
 * `append`, `latest`, `history`:
 *
 * - **NO authority surface**: no authorize/authenticate/checkAuthority/
 *   admit/approve member. The port never decides whether a mutation may
 *   happen; `provenance.actor` is stored as audit data and is never
 *   interpreted here (ADR §7: human provenance does NOT create resolver
 *   precedence).
 * - **NO envelope surface**: no validateEnvelope/checkEnvelope/expand/tighten
 *   member. Whether a Leader expansion (deny -> ask, deny -> allow,
 *   ask -> allow) is covered by a MutationEnvelope is decided by the
 *   mutation service (ADR §6), before this port is ever called.
 * - **NO mutation or lifecycle surface**: no applyMutation/transition/
 *   grant/revoke/archive/restore/dispose/inherit member. PermissionMutation
 *   interpretation, mutation serialization and the lifecycle rules (ADR §5,
 *   §8) belong to the mutation service and to PR4.
 * - **NO resolver or notification surface**: no resolve/assemble/notify
 *   member. `EffectivePermissionAssembler` is PR2, the resolver stays pure
 *   (ADR §3), notification is PR5 and is never authorization evidence
 *   (ADR §9).
 *
 * `append` is the only write member, and the durable side makes it
 * append-only: a generation is never overwritten and never deleted
 * (implementation plan PR4 "no delete; no inheritance" keeps that shape).
 * Because the port exposes no way to change or remove a durable row, it
 * cannot serve as an alternative write path around the mutation service —
 * adding a permission overlay WITHOUT going through the mutation service
 * would require widening this interface, which is a plan-level change.
 *
 * @module @dsh-agent-team/runtime/permission-governance/port
 */

import type {
  PermissionOverlayIdentity,
  PermissionOverlaySnapshot,
  PermissionOverlaySnapshotInput,
} from './types.js'

/**
 * The persistence-only port over the durable PermissionOverlaySnapshot
 * store. See the module header for what this interface deliberately does NOT
 * expose; `permission-overlay-port-surface.test.ts` pins the member set, the
 * import graph and this contract text.
 */
export interface PermissionOverlayRepositoryPort {
  /**
   * Append one FULL snapshot as the next generation of its identity chain.
   *
   * The port does not ask who the caller is or whether the change is an
   * expansion: it persists what it is handed and reports the durable result.
   * A generation CAS conflict is a typed persistence conflict, not a policy
   * refusal — serialization of concurrent mutations is the mutation
   * service's job (ADR §1), and this port must not become a second place
   * where permission policy is decided.
   * @param input - the ADR §2 sections of the snapshot to persist.
   * @returns the durable snapshot (the stored row when the identical
   *   snapshot was already durable).
   */
  append(input: PermissionOverlaySnapshotInput): Promise<PermissionOverlaySnapshot>

  /**
   * The CURRENT AUTHORITY of one MemberInstance: the HIGHEST-generation
   * snapshot (ADR §2). Never a fold or a replay of history.
   * @param identity - the (TeamSession, MemberInstance) identity.
   * @returns the authority snapshot, or `undefined` when none exists.
   */
  latest(identity: PermissionOverlayIdentity): Promise<PermissionOverlaySnapshot | undefined>

  /**
   * The AUDIT history of one MemberInstance, ascending by generation.
   * History is audit-only: nothing in this package folds these rows into an
   * effective state (ADR §2 "History: audit only", "No event replay is used
   * for execution").
   * @param identity - the (TeamSession, MemberInstance) identity.
   */
  history(identity: PermissionOverlayIdentity): Promise<readonly PermissionOverlaySnapshot[]>
}
