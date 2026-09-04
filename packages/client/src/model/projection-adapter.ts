/**
 * P9-T4 (S3-A) — the pure projection adapter: `TeamProjectionDto` (+ the
 * viewer perspective) → `TeamUiSnapshot`.
 *
 * Purity (plan §7.1): `output = pure(TeamProjectionDto, perspective)` —
 * no backend write, no authoritative lifecycle storage, no session-log
 * scan, no DOM, no TeamDomain import. Every output field is copied
 * verbatim from a frozen DTO field or derived by one of the documented
 * mappings below; a missing fact stays missing (never invented).
 *
 * Documented mappings:
 *   - §7.2 display mapping: `lifecycle` (RAW, always kept) →
 *     `displayStatus` (CREATED→`created`, RUNNING→`running`,
 *     SETTLED→`settled`, ARCHIVED→`archived`, DISPOSED→`disposed`).
 *   - §7.2 presentation fallback: `currentAction =
 *     liveActivity?.currentAction ?? activity?.lastAction ?? undefined`
 *     (presentation, NOT lifecycle inference).
 *   - §7.2 navigation: the leader's absent `childSessionId` becomes
 *     `null` (navigation target = teamSessionId / root); a non-leader
 *     row reads its frozen `childSessionId` directly; never inferred
 *     from label / template / session list.
 *   - §7.3: the per-instance `pendingControlCount` is `null` here —
 *     this adapter sees the projection only; the ledger adapter fills
 *     it for a KNOWN-COMPLETE ledger (the dock top-level count is the
 *     summary's `pendingControlCount` directly, in the snapshot).
 *   - §7.4: `activity` rows are the current-work summary (member
 *     `activity` + `liveActivity`), emitted only when at least one of
 *     `status` / `subject` / `summary` / `currentAction` is present.
 *   - G3: disposed-history DTO rows are merged into `members`
 *     (`fromHistory: true`, lifecycle forced to the RAW `DISPOSED` the
 *     history implies, no live overlay) AND retained verbatim in
 *     `disposedHistory` as the durable fact rows.
 *
 * Wire entry: `projectionFromWire` lifts the frozen
 * `RemoteProjectionValue` (the exact 9-field value-level D-4 mirror of
 * the projection DTO) to the typed DTO.
 *
 * Pure module: no React, no I/O. Erasable TS only.
 * @module @dsh-agent-team/client/model/projection-adapter
 */

import type {
  MemberLifecycleState,
  TeamProjectionDto,
} from '../../../contracts/src/index.js'
import type { RemoteProjectionValue } from '../../../remote/src/index.js'
import type { TeamPerspective } from '../state/team-session-resolution.js'
import type {
  TeamUiCurrentWorkRow,
  TeamUiDisplayStatus,
  TeamUiMemberInstance,
  TeamUiSnapshot,
  TeamUiTemplate,
} from './team-ui-snapshot.js'

/**
 * Lift one frozen wire projection value to the typed projection DTO.
 *
 * The ONE documented boundary narrowing in the client data layer (see
 * the P9-T4 evidence note): the frozen `RemoteProjectionValue` is the
 * exact 9-field value-level mirror of `TeamProjectionDto` (remote D-4:
 * same field names, nested pass-through), so the conversion is
 * structurally identity — but the wire's `RemoteSafeRecord` fields are
 * not nominally assignable to the branded/readonly DTO fields, and a
 * direct cast is a TS2352. The single `as unknown as` keeps the
 * narrowing at exactly one auditable site; every field read downstream
 * goes through the typed DTO.
 */
export function projectionFromWire(value: RemoteProjectionValue): TeamProjectionDto {
  return value as unknown as TeamProjectionDto
}

/** The §7.2 display mapping (closed; the raw lifecycle is always kept alongside). */
function displayStatusOf(lifecycle: MemberLifecycleState): TeamUiDisplayStatus {
  switch (lifecycle) {
    case 'CREATED':
      return 'created'
    case 'RUNNING':
      return 'running'
    case 'SETTLED':
      return 'settled'
    case 'ARCHIVED':
      return 'archived'
    case 'DISPOSED':
      return 'disposed'
  }
}

/** One live member DTO row → the merged roster row (history rows appended separately). */
function adaptLiveMember(member: TeamProjectionDto['members'][number]): TeamUiMemberInstance {
  const activity = member.activity
  const liveActivity = member.liveActivity
  return {
    instanceId: member.instanceId,
    templateId: member.templateId,
    label: member.label,
    ...(member.groupId === undefined ? {} : { groupId: member.groupId }),
    // §7.2: leader = key ABSENT → null (nav target: the root session).
    childSessionId: member.childSessionId === undefined ? null : member.childSessionId,
    lifecycle: member.lifecycle,
    displayStatus: displayStatusOf(member.lifecycle),
    // §7.2 presentation fallback (not lifecycle inference).
    ...(member.liveActivity?.currentAction !== undefined
      ? { currentAction: member.liveActivity.currentAction }
      : activity?.lastAction !== undefined
        ? { currentAction: activity.lastAction }
        : {}),
    workspace: member.workspace,
    contextPolicy: member.contextPolicy,
    effectiveConfig: member.effectiveConfig,
    ...(activity === undefined ? {} : { activity }),
    liveActivity,
    // §7.3: projection-only — the per-instance badge is unknown until
    // the ledger adapter sees known-complete control facts.
    pendingControlCount: null,
    fromHistory: false,
    createdAt: member.createdAt,
  }
}

/** One disposed-history DTO row → the merged roster row (history-only). */
function adaptHistoryMember(history: NonNullable<TeamProjectionDto['disposedHistory']>[number]): TeamUiMemberInstance {
  return {
    instanceId: history.instanceId,
    templateId: history.templateId,
    label: history.label,
    ...(history.groupId === undefined ? {} : { groupId: history.groupId }),
    // The history DTO requires the durable child session (never the leader).
    childSessionId: history.childSessionId,
    // RAW lifecycle for a disposed instance; the history row implies it.
    lifecycle: 'DISPOSED',
    displayStatus: 'disposed',
    // The history DTO carries no workspace / context policy /
    // effective config / activity: absent, never invented.
    liveActivity: null,
    pendingControlCount: null,
    fromHistory: true,
    createdAt: history.createdAt,
    ...(history.disposedAt === undefined ? {} : { disposedAt: history.disposedAt }),
  }
}

/**
 * One §7.4 current-work row from a live member's `activity` +
 * `liveActivity`; `undefined` when the member carries no work facts at
 * all (no invented rows).
 */
function adaptCurrentWork(member: TeamProjectionDto['members'][number]): TeamUiCurrentWorkRow | undefined {
  const activity = member.activity
  const liveActivity = member.liveActivity
  const status = activity?.status
  const subject = activity?.subject
  const summary = activity?.summary
  const currentAction = liveActivity?.currentAction ?? activity?.lastAction
  if (
    status === undefined &&
    subject === undefined &&
    summary === undefined &&
    currentAction === undefined
  ) {
    return undefined
  }
  return {
    instanceId: member.instanceId,
    label: member.label,
    ...(status === undefined ? {} : { status }),
    ...(subject === undefined ? {} : { subject }),
    ...(summary === undefined ? {} : { summary }),
    ...(currentAction === undefined ? {} : { currentAction }),
    ...(activity?.lastProgressAt === undefined ? {} : { lastProgressAt: activity.lastProgressAt }),
    ...(liveActivity?.lastActivityAt === undefined ? {} : { lastActivityAt: liveActivity.lastActivityAt }),
    ...(liveActivity?.runningSince === undefined ? {} : { runningSince: liveActivity.runningSince }),
    ...(liveActivity?.admittedWorkCorrelation === undefined
      ? {}
      : { admittedWorkCorrelation: liveActivity.admittedWorkCorrelation }),
    openIntervals: activity?.openIntervals ?? [],
  }
}

/**
 * Adapt one projection frame + viewer perspective to the normalized
 * UI snapshot (pure; deterministic for one frame + perspective).
 *
 * @param projection - the generation-verified team projection frame.
 * @param perspective - the viewer perspective (team-root or the member
 *   child; carried as data for the §8.10 current-member highlight).
 */
export function adaptTeamProjection(
  projection: TeamProjectionDto,
  perspective: TeamPerspective,
): TeamUiSnapshot {
  const templates: TeamUiTemplate[] = projection.templates.map(template => ({
    kind: template.kind,
    templateId: template.templateId,
    displayName: template.displayName,
    ...(template.description === undefined ? {} : { description: template.description }),
    contextPolicy: template.contextPolicy,
    ...(template.instanceQuota === undefined ? {} : { instanceQuota: template.instanceQuota }),
  }))

  // Live members in frame order, then the disposed-history rows in frame
  // order (G3: archived/disposed represented; identity = instanceId,
  // labels never participate).
  const members: TeamUiMemberInstance[] = projection.members.map(adaptLiveMember)
  const history = projection.disposedHistory ?? []
  for (const row of history) members.push(adaptHistoryMember(row))

  const activity: TeamUiCurrentWorkRow[] = []
  for (const member of projection.members) {
    const row = adaptCurrentWork(member)
    if (row !== undefined) activity.push(row)
  }

  return {
    teamSessionId: projection.teamSessionId,
    generation: projection.generation,
    blueprint: projection.blueprint,
    perspective,
    templates,
    members,
    compatibility: projection.root.compatibility,
    policyState: projection.root.policyState,
    ledgerSummary: projection.ledger,
    activity,
    disposedHistory: history,
  }
}
