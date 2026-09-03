/**
 * Pure projection of the vNext team snapshot plus the durable ledger model
 * onto the "团队" tab's member-group section: the fixed leading leader row
 * (anchored to the first leader-kind instance, or synthesized from the team
 * session when the rows carry none — the "回到 leader" entry) plus one group
 * per non-leader template in `members` order. A group's container row
 * tallies its running instances for the `Name · N 活跃` label; its expansion
 * lists the group's instance rows — the snapshot member instances, each
 * carrying the raw frozen lifecycle, the §7.2 display status, the latest
 * tool call, and the completeness-aware pending control-request count.
 * Instances sharing a templateId fold into one group (the multi-instance
 * interface). React-free; the renderer supplies the snapshot, the ledger
 * model, and the locale. Status is read straight from the projection — never
 * re-derived here.
 *
 * P9-T5 (S3-C) mechanical adaptation of the legacy member-group model (plan
 * §8.4): the group/instance fold, the deterministic order, and the fixed
 * leading leader row are preserved; the inputs change — the grouping key is
 * `templateId`, the identity is `instanceId`, the name is the template
 * display name (falling back to the instance label), and the legacy
 * "unbound" vocabulary is abolished (every snapshot instance is a real
 * instance; the CREATED lifecycle replaces the absent bound session).
 */
import type {
  TeamUiLedgerModel, TeamUiMemberInstance, TeamUiSnapshot,
} from './team-ui-snapshot.js'

/** One instance row inside a member group (a snapshot member instance). */
export interface TeamMemberInstanceRow {
  /** Stable React key across projection frames. */
  readonly key: string
  /** The instance's durable child session: the row's click-to-switch target; `''` = no target (the leader). */
  readonly childSessionId: string
  /** The raw frozen lifecycle (read straight from the snapshot row). */
  readonly lifecycle: TeamUiMemberInstance['lifecycle']
  /** The §7.2 display status (read straight from the snapshot row). */
  readonly status: TeamUiMemberInstance['displayStatus']
  /** The latest tool call from the activity facts; absent before any call. */
  readonly currentAction?: string
  /**
   * The instance's still-unresolved control requests (drives the waiting
   * badge); `null` = unknown under a partial ledger (never invented, plan
   * §7.3).
   */
  readonly pendingControlCount: number | null
  /** `true` for rows reconstructed from the disposed history (history-only). */
  readonly fromHistory: boolean
}

/** One member group: the container row plus its instance rows. */
export interface TeamMemberGroupRow {
  /** The group's template (roster definition) id. */
  readonly templateId: string
  /** Template display name (falling back to the first instance label); absent only on the synthesized leading row (the renderer falls back to the locale leader label). */
  readonly name?: string
  readonly role: 'leader' | 'teammate'
  /** Running instance count: the container row's `N` in `Name · N 活跃`. */
  readonly activeCount: number
  /** The group's instance rows in projection order. */
  readonly instances: readonly TeamMemberInstanceRow[]
}

/** The rendered members section: the fixed leading leader row plus the non-leader groups. */
export interface TeamMembersModel {
  /** The leading leader row (the "回到 leader" entry). */
  readonly leader: TeamMemberGroupRow
  /** The non-leader groups in `members` order. */
  readonly groups: readonly TeamMemberGroupRow[]
}

/** Mutable group while the fold runs; the returned groups freeze their instance lists. */
interface GroupBuild {
  templateId: string
  name?: string
  role: 'leader' | 'teammate'
  activeCount: number
  instances: TeamMemberInstanceRow[]
}

/**
 * Plan §7.3 completeness-aware pending count: the per-instance badge comes
 * only from known-complete control facts; a partial ledger leaves it
 * unknown.
 * @param member - the snapshot member instance.
 * @param ledger - the durable ledger model.
 * @returns the count, or `null` when the ledger is not known complete.
 */
function pendingOf(member: TeamUiMemberInstance, ledger: TeamUiLedgerModel): number | null {
  if (ledger.completeness !== 'complete') return null
  return ledger.pendingControlByInstance[member.instanceId] ?? 0
}

/**
 * Fold one snapshot member instance into a group's running tally and
 * instance list. Every instance is a real row (the legacy "unbound" skip
 * has no vNext successor).
 * @param group - the group being built (mutated in place while the fold runs).
 * @param member - the snapshot member instance.
 * @param ledger - the durable ledger model (for the completeness-aware count).
 */
function appendRow(group: GroupBuild, member: TeamUiMemberInstance, ledger: TeamUiLedgerModel): void {
  group.instances.push({
    key: `${member.instanceId}:${member.childSessionId ?? ''}:${group.instances.length}`,
    childSessionId: member.childSessionId ?? '',
    lifecycle: member.lifecycle,
    status: member.displayStatus,
    ...(member.currentAction !== undefined ? { currentAction: member.currentAction } : {}),
    pendingControlCount: pendingOf(member, ledger),
    fromHistory: member.fromHistory,
  })
  if (member.lifecycle === 'RUNNING') group.activeCount += 1
}

/**
 * Project the snapshot's member instances onto the members-section model.
 * @param snapshot - the normalized team snapshot.
 * @param ledger - the durable ledger model.
 * @returns the leading leader row — synthesized from the team session when
 *   the rows carry no leader kind — plus the non-leader groups in `members`
 *   order, instances sharing a templateId folded into one group.
 */
export function deriveTeamMembers(
  snapshot: TeamUiSnapshot,
  ledger: TeamUiLedgerModel,
): TeamMembersModel {
  const groups: TeamMemberGroupRow[] = []
  const groupById = new Map<string, GroupBuild>()
  const templateById = new Map(
    snapshot.templates.map(template => [template.templateId, template] as const),
  )
  let leader: GroupBuild | undefined
  for (const member of snapshot.members) {
    const kind = templateById.get(member.templateId)?.kind
    if (kind === 'leader') {
      if (leader === undefined) {
        leader = {
          templateId: member.templateId,
          name: templateById.get(member.templateId)?.displayName ?? member.label,
          role: 'leader',
          activeCount: 0,
          instances: [],
        }
      }
      appendRow(leader, member, ledger)
      continue
    }
    let group = groupById.get(member.templateId)
    if (group === undefined) {
      group = {
        templateId: member.templateId,
        name: templateById.get(member.templateId)?.displayName ?? member.label,
        role: 'teammate',
        activeCount: 0,
        instances: [],
      }
      groupById.set(member.templateId, group)
      groups.push(group)
    }
    appendRow(group, member, ledger)
  }
  return {
    leader: leader ?? {
      templateId: snapshot.teamSessionId,
      role: 'leader',
      activeCount: 0,
      instances: [],
    },
    groups,
  }
}
