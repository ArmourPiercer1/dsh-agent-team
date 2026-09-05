/**
 * P8-T2 Projection Service — the pure-ish whole-projection fold
 * (TaskDoc §11.9 P8-T2; DevPlan §21).
 *
 * {@link projectTeam} maps the durable TeamDomain projection source
 * (invariant 41) + the OPTIONAL already-materialized live overlay snapshot +
 * the produced-at timestamp to the frozen {@link TeamProjectionDto}.
 *
 * It is a PURE function of its three inputs: no I/O, no clock read, no
 * global. The overlay is already a snapshot map (materialized by the service
 * from {@link LiveResidencyOverlayPort}) and the `generatedAt` string is
 * stamped by the service — so the fold only transforms data. The
 * `generation` is the durable one (carried verbatim from the source); the
 * live overlay NEVER affects it, which is what makes downstream
 * stale-overwrite detection (`isStaleTeamProjection`) keyed against the
 * durable authority.
 *
 * The fold delegates every field-level and cross-field invariant to the
 * frozen P8-T1 DTO pipeline (`createTeamProjection` + the embedded record
 * parsers). An unknown lifecycle state, a malformed field, a missing
 * non-leader `childSessionId`, a duplicated LeaderInstance, or a member
 * referencing an unknown template is therefore rejected with the P8-T1
 * error surface (`MALFORMED_DTO` or a field-specific contract code) — the
 * fold adds no second vocabulary. The ONE service-level invariant the fold
 * resolves itself is the effective workspace (a member row may inherit the
 * team default; neither present is a {@link PROJECTION_ERROR_CODES.MEMBER_WORKSPACE_UNRESOLVED}).
 *
 * Complexity: O(templates + members), independent of any child Session log
 * volume (the source port exposes no log read surface — see `types.ts`).
 *
 * Pure module: no I/O, no `node:` builtins.
 * @module @dsh-agent-team/runtime/projection/fold
 */
import type { InstanceId, MemberLiveActivityDto, TeamProjectionDto } from '../../contracts/src/index.js';
import type { TeamDomainProjectionSource } from './types.js';
/**
 * Fold one durable TeamDomain projection source (+ optional live overlay
 * snapshot) into the frozen whole `TeamProjectionDto`.
 *
 * @param source - the bounded durable TeamDomain projection source
 *   (invariant 41); the generation, root facts, templates, members, and
 *   ledger summary all come from here.
 * @param overlay - the materialized live overlay snapshot (instance id ->
 *   live activity), or `null` for a COLD projection (durable-only: every
 *   member's `liveActivity` is `null`).
 * @param generatedAt - the produced-at stamp (ISO-8601), stamped by the
 *   caller (the service injects the clock so the fold stays pure).
 * @param schemaVersion - the projection schema version to stamp (S7-R2):
 *   `2` for the additive repair fields, `1` (default) for the frozen v1
 *   shape.
 * @returns the frozen whole projection (validated by the P8-T1 pipeline).
 * @throws the frozen P8-T1 DTO contract error (`MALFORMED_DTO` or a
 *   field-specific code) when the source is malformed; or a
 *   {@link ProjectionError} (`MEMBER_WORKSPACE_UNRESOLVED`) when a member's
 *   effective workspace cannot be resolved.
 */
export declare function projectTeam(source: TeamDomainProjectionSource, overlay: ReadonlyMap<InstanceId, MemberLiveActivityDto> | null, generatedAt: string, schemaVersion?: 1 | 2): TeamProjectionDto;
//# sourceMappingURL=fold.d.ts.map