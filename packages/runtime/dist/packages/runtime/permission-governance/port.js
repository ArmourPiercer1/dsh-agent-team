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
export {};
//# sourceMappingURL=port.js.map