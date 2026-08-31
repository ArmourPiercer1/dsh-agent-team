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

import {
  LEADER_INSTANCE_ID,
  createTeamProjection,
} from '../../contracts/src/index.js'
import type {
  InstanceId,
  MemberLiveActivityDto,
  MemberProjectionInput,
  TeamProjectionDto,
  TeamRootProjectionInput,
  TemplateProjectionInput,
} from '../../contracts/src/index.js'
import { PROJECTION_ERROR_CODES, ProjectionError } from './errors.js'
import { projectLedgerSummary } from './ledger.js'
import type {
  DurableMemberRow,
  DurableTemplateRow,
  TeamDomainProjectionSource,
} from './types.js'

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
 * @returns the frozen whole projection (validated by the P8-T1 pipeline).
 * @throws the frozen P8-T1 DTO contract error (`MALFORMED_DTO` or a
 *   field-specific code) when the source is malformed; or a
 *   {@link ProjectionError} (`MEMBER_WORKSPACE_UNRESOLVED`) when a member's
 *   effective workspace cannot be resolved.
 */
export function projectTeam(
  source: TeamDomainProjectionSource,
  overlay: ReadonlyMap<InstanceId, MemberLiveActivityDto> | null,
  generatedAt: string,
): TeamProjectionDto {
  const root = buildRoot(source)
  const templates = source.templates.map((template) => buildTemplate(template))
  const members = source.members.map((member) =>
    buildMember(member, source.defaultWorkspace, overlay),
  )
  const ledger = projectLedgerSummary(source.ledger)

  return createTeamProjection({
    teamSessionId: source.teamSessionId,
    blueprint: source.blueprint,
    generation: source.generation,
    generatedAt,
    root,
    templates,
    members,
    ledger,
  })
}

/** Build the projection root from the source identity + root facts. */
function buildRoot(source: TeamDomainProjectionSource): TeamRootProjectionInput {
  const root: TeamRootProjectionInput = {
    teamSessionId: source.teamSessionId,
    createdAt: source.createdAt,
    policyState: source.root.policyState,
    admission: source.root.admission,
    compatibility: source.root.compatibility,
    creationBudgetConsumed: source.root.creationBudgetConsumed,
  }
  if (source.defaultWorkspace !== undefined) {
    root.defaultWorkspace = source.defaultWorkspace
  }
  if (source.root.handoffSourceSessionId !== undefined) {
    root.handoffSourceSessionId = source.root.handoffSourceSessionId
  }
  return root
}

/** Build one template projection row (thin identity + display record). */
function buildTemplate(template: DurableTemplateRow): TemplateProjectionInput {
  const row: TemplateProjectionInput = {
    kind: template.kind,
    templateId: template.templateId,
    displayName: template.displayName,
    contextPolicy: template.contextPolicy,
  }
  if (template.description !== undefined) {
    row.description = template.description
  }
  if (template.instanceQuota !== undefined) {
    row.instanceQuota = template.instanceQuota
  }
  return row
}

/**
 * Build one member projection row: the durable facts + the resolved
 * effective workspace + the live overlay (nullable).
 *
 * The leader / non-leader `childSessionId` rule is handled by the frozen
 * contract: the row is passed the key ONLY when the durable source carries
 * it (absent for the LeaderInstance, present for every MemberInstance —
 * including ARCHIVED / DISPOSED). A non-leader row missing its durable child
 * session therefore reaches the contract as a missing required field and is
 * rejected there (MALFORMED_DTO).
 */
function buildMember(
  member: DurableMemberRow,
  defaultWorkspace: string | undefined,
  overlay: ReadonlyMap<InstanceId, MemberLiveActivityDto> | null,
): MemberProjectionInput {
  const workspace = resolveEffectiveWorkspace(member, defaultWorkspace)
  const row: MemberProjectionInput = {
    instanceId: member.instanceId,
    templateId: member.templateId,
    label: member.label,
    workspace,
    createdAt: member.createdAt,
    lifecycle: member.lifecycle,
    contextPolicy: member.contextPolicy,
    effectiveConfig: member.effectiveConfig,
    // The live overlay is always the present key; `null` when the (optional)
    // snapshot has no facts for this member (DevPlan §21.2 nullable overlay).
    liveActivity: overlay === null ? null : overlay.get(member.instanceId) ?? null,
  }
  if (member.groupId !== undefined) {
    row.groupId = member.groupId
  }
  if (member.childSessionId !== undefined) {
    row.childSessionId = member.childSessionId
  }
  if (member.activity !== undefined) {
    row.activity = member.activity
  }
  return row
}

/**
 * Resolve the effective workspace of a member row: the instance workspace,
 * falling back to the team default workspace. A projected member row REQUIRES
 * a resolvable effective workspace, so "neither present" is a closed
 * service-level error (not a DTO field error — the DTO sees the resolved
 * value).
 */
function resolveEffectiveWorkspace(
  member: DurableMemberRow,
  defaultWorkspace: string | undefined,
): string {
  if (member.workspace !== undefined) {
    return member.workspace
  }
  if (defaultWorkspace !== undefined) {
    return defaultWorkspace
  }
  throw new ProjectionError(
    PROJECTION_ERROR_CODES.MEMBER_WORKSPACE_UNRESOLVED,
    `member '${member.instanceId}' has no resolvable effective workspace: ` +
      `the member row and the team default workspace are both absent`,
    {
      instanceId: member.instanceId,
      isLeader: member.instanceId === LEADER_INSTANCE_ID,
    },
  )
}
