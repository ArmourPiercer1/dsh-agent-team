/**
 * Pure projection of the vNext team snapshot into the input dock bar: the
 * D23 team-wide counts (running member instances, the frozen pending
 * control count) for the collapsed readout, plus the compact expanded
 * content (current-roster member status rows and current-work activity
 * rows). React-free; the renderer supplies the snapshot. Every field is
 * read straight from the projection — the raw frozen lifecycle plus the
 * §7.2 display status — and never re-derived here (D20).
 *
 * P9-T5 (S3-C) mechanical adaptation of the legacy dock model (plan §8.6):
 * the running count moves from the session-log overlay to the projection
 * lifecycle (never from the session log); the pending count moves from the
 * per-row sum to the frozen team-wide `ledgerSummary.pendingControlCount`
 * read directly; the compact task rows become the snapshot's current-work
 * activity rows. History-only (disposed) rows are excluded from the live
 * readout.
 */
import type {
  TeamUiMemberInstance, TeamUiSnapshot,
} from './team-ui-snapshot.js'
import type { ProgressValue } from '../../../contracts/src/index.js'

/** The D23 dock readout counts over the whole team. */
export interface TeamDockCounts {
  /** N: the member instances in the running lifecycle (multi-instance counts per instance; history-only rows excluded). */
  readonly runningSessions: number
  /** M: the frozen team-wide pending control count (read directly from the ledger summary, never summed). */
  readonly pendingControls: number
}

/** One expanded member status row (current-roster instances; history-only rows skipped). */
export interface TeamDockMemberRow {
  /** Stable React key across projection frames (the instance id is unique within one team). */
  readonly key: string
  /** The instance id (the D19 authority). */
  readonly instanceId: string
  /** The instance label (the row's own field, never re-resolved). */
  readonly name: string
  /** The §7.2 display status of the row. */
  readonly status: TeamUiMemberInstance['displayStatus']
}

/** One expanded activity row (the snapshot's current-work row, compact). */
export interface TeamDockActivityRow {
  /** Stable React key across projection frames (one current-work row per instance). */
  readonly key: string
  /** The instance the row belongs to. */
  readonly instanceId: string
  /** The instance label. */
  readonly label: string
  /** The admitted-work progress status; absent = no dot and no status text. */
  readonly status?: ProgressValue
  /** The row text (the subject, else the summary, else the live current action). */
  readonly subject?: string
}

/** The dock's expanded content: the member status rows plus the activity rows. */
export interface TeamDockContent {
  /** The current-roster member instances in snapshot order (the leader instance included). */
  readonly members: readonly TeamDockMemberRow[]
  /** The current-work activity rows in snapshot order. */
  readonly activities: readonly TeamDockActivityRow[]
}

/**
 * Count the D23 readout over the whole team: N is the member instances in
 * the running lifecycle (the raw frozen lifecycle — never the session-log
 * overlay — and archived/disposed instances are never counted), M is the
 * frozen team-wide pending control count read directly from the ledger
 * summary.
 * @param snapshot - the normalized team snapshot.
 * @returns the team-wide counts.
 */
export function deriveTeamDockCounts(snapshot: TeamUiSnapshot): TeamDockCounts {
  let runningSessions = 0
  for (const member of snapshot.members) {
    if (member.fromHistory) continue
    if (member.lifecycle === 'RUNNING') runningSessions += 1
  }
  return { runningSessions, pendingControls: snapshot.ledgerSummary.pendingControlCount }
}

/**
 * Project the expanded content: every current-roster member instance
 * (history-only rows skipped, the leader instance included) plus every
 * current-work activity row, each field read straight from the snapshot.
 * @param snapshot - the normalized team snapshot.
 * @returns the compact member status rows and activity rows.
 */
export function deriveTeamDockContent(snapshot: TeamUiSnapshot): TeamDockContent {
  const members: TeamDockMemberRow[] = []
  for (const member of snapshot.members) {
    if (member.fromHistory) continue
    members.push({
      key: member.instanceId,
      instanceId: member.instanceId,
      name: member.label,
      status: member.displayStatus,
    })
  }
  const activities: TeamDockActivityRow[] = snapshot.activity.map(row => ({
    key: row.instanceId,
    instanceId: row.instanceId,
    label: row.label,
    ...(row.status !== undefined ? { status: row.status } : {}),
    ...(row.subject !== undefined ? { subject: row.subject }
      : row.summary !== undefined ? { subject: row.summary }
      : row.currentAction !== undefined ? { subject: row.currentAction }
      : {}),
  }))
  return { members, activities }
}
