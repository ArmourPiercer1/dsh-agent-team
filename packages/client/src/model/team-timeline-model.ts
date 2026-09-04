/**
 * Pure projection of the vNext team snapshot plus the durable ledger model
 * onto the "团队" tab's timeline section: one lane per non-leader member
 * instance in `members` order (the lane's color slot walks the fixed CSS
 * ramp by index; fallback lanes cover activity intervals from instances
 * without a roster row), one bar per activity interval, and the linear
 * honest time domain — the earliest known activity time (an interval open,
 * or a durable progress fact over a known-complete ledger) to the last
 * closure, extended to the caller's clock while any interval runs. Idle
 * gaps stay gaps: nothing here compresses, clamps, or reads a wall clock.
 * React-free; the renderer supplies the snapshot, the ledger model, and the
 * clock.
 *
 * P9-T5 (S3-C) mechanical adaptation of the legacy delegation-timeline
 * model (plan §8.2): the interaction and geometry algorithm is preserved
 * byte-for-byte; only the inputs change — the legacy `delegations` rows
 * become the ledger's activity-interval rows, and the roster `members` rows
 * become the snapshot's member instances.
 */
import type { TeamUiLedgerModel, TeamUiSnapshot } from './team-ui-snapshot.js'

/** One activity-interval bar inside a lane (the effective end folds in "now"). */
export interface TeamTimelineSpan {
  /** Stable React key across projection frames. */
  readonly key: string
  /** The interval's open time (epoch ms). */
  readonly startedAt: number
  /** The closure time; the caller's clock while the interval is open. */
  readonly endedAt: number
  /** True while no closure has ended the interval (drives the running motion). */
  readonly inProgress: boolean
}

/** One member-instance lane: the side label plus its bars in start-time order. */
export interface TeamTimelineLane {
  /** The lane's instance id (lane identity; the frozen id, never the label). */
  readonly instanceId: string
  /** Roster label; a not-rostered fallback lane shows the raw instance id. */
  readonly name: string
  /** Row index, top to bottom. */
  readonly lane: number
  /** Palette slot: the lane's position modulo the ramp length below. */
  readonly colorSlot: number
  /** The lane's durable child session for the click-to-switch; `''` when absent. */
  readonly childSessionId: string
  readonly spans: readonly TeamTimelineSpan[]
}

/** The rendered projection; `null` means "no activity intervals" (one-line empty state). */
export interface TeamTimelineModel {
  readonly start: number
  readonly end: number
  readonly lanes: readonly TeamTimelineLane[]
}

/** Lane-color ramp length; the CSS module defines one slot per index. */
export const TEAM_LANE_COLOR_SLOTS = 8

/** Mutable lane while the fold runs; the returned lanes freeze its spans. */
interface LaneBuild {
  id: string
  name: string
  childSessionId: string
  spans: TeamTimelineSpan[]
}

/**
 * Project the ledger's activity intervals onto member-instance lanes over
 * the linear time domain.
 * @param snapshot - the normalized team snapshot (the roster lanes).
 * @param ledger - the durable ledger model (the interval rows; durable
 *   progress facts extend the domain only when the ledger is known complete).
 * @param now - the caller's clock (epoch ms); read by open intervals only.
 * @returns the lane model, or `null` when the ledger carries no activity
 *   intervals (the renderer then shows the one-line empty state instead of
 *   a lane matrix).
 */
export function deriveTeamTimeline(
  snapshot: TeamUiSnapshot,
  ledger: TeamUiLedgerModel,
  now: number,
): TeamTimelineModel | null {
  const intervals = ledger.intervals
  if (intervals.length === 0) return null

  let start = Infinity
  let end = -Infinity
  for (const interval of intervals) {
    const openedAt = Date.parse(interval.openedAt)
    if (openedAt < start) start = openedAt
    const settled = interval.isOpen ? openedAt : Date.parse(interval.closedAt ?? interval.openedAt)
    const closing = interval.isOpen ? Math.max(settled, now) : settled
    if (closing > end) end = closing
  }
  // Plan §7.4: durable progress facts extend the domain only over a
  // known-complete ledger — the mechanical successor of the legacy task-at
  // extension; a partial ledger never claims a wider board.
  if (ledger.completeness === 'complete') {
    for (const progress of ledger.progress) {
      const at = Date.parse(progress.at)
      if (at < start) start = at
      if (at > end) end = at
    }
  }
  if (end <= start) end = start + 1

  const builds: LaneBuild[] = []
  const buildById = new Map<string, LaneBuild>()
  const kindByTemplate = new Map(
    snapshot.templates.map(template => [template.templateId, template.kind] as const),
  )
  for (const member of snapshot.members) {
    // Leader-kind instances carry no lane (the fixed leading leader entry
    // lives in the members section); unknown templates read as teammates.
    if (kindByTemplate.get(member.templateId) === 'leader') continue
    const build: LaneBuild = {
      id: member.instanceId,
      name: member.label,
      childSessionId: member.childSessionId ?? '',
      spans: [],
    }
    builds.push(build)
    buildById.set(member.instanceId, build)
  }
  intervals.forEach((interval, index) => {
    let build = buildById.get(interval.instanceId)
    // An activity interval whose instance never reached a roster row still
    // renders: a fallback lane named by the raw id, appended after the
    // roster lanes in first-seen order, instead of silently dropping the
    // bar.
    if (build === undefined) {
      build = { id: interval.instanceId, name: interval.instanceId, childSessionId: '', spans: [] }
      builds.push(build)
      buildById.set(interval.instanceId, build)
    }
    const openedAt = Date.parse(interval.openedAt)
    const settled = interval.isOpen ? openedAt : Date.parse(interval.closedAt ?? interval.openedAt)
    build.spans.push({
      key: `${interval.instanceId}:${openedAt}:${index}`,
      startedAt: openedAt,
      endedAt: interval.isOpen ? Math.max(settled, now) : settled,
      inProgress: interval.isOpen,
    })
  })

  const lanes: TeamTimelineLane[] = builds.map((build, lane) => ({
    instanceId: build.id,
    name: build.name,
    lane,
    colorSlot: lane % TEAM_LANE_COLOR_SLOTS,
    childSessionId: build.childSessionId,
    spans: build.spans.sort((left, right) => left.startedAt - right.startedAt),
  }))
  return { start, end, lanes }
}

/**
 * Pick "nice" axis ticks inside one visible domain: the step is the first
 * 1/2/5×10^n multiple at or above the raw span, so label density stays near
 * the target across zoom levels.
 * @param start - visible domain start (epoch ms).
 * @param end - visible domain end (epoch ms, inclusive).
 * @param target - approximate tick count (default 6).
 * @returns ascending tick times, or the single point for a degenerate domain.
 */
export function teamTimelineTicks(start: number, end: number, target = 6): number[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return []
  if (end === start) return [start]
  const rawStep = (end - start) / Math.max(1, target - 1)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalized = rawStep / magnitude
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude
  const first = Math.ceil(start / step) * step
  const count = Math.floor((end - first) / step) + 1
  return Array.from({ length: Math.max(0, count) }, (_, index) => first + index * step)
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Format one epoch-ms mark as a fixed 24-hour `HH:MM:SS` label in the local
 * timezone. Deliberately locale-free (no localized number or weekday
 * formatting): the print format is identical on every host; the wall-clock
 * readout follows the browser's timezone like every other local time on the
 * page.
 * @param timestamp - epoch milliseconds.
 * @returns the clock label.
 */
export function formatTeamClock(timestamp: number): string {
  const date = new Date(timestamp)
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

/**
 * Format a non-negative duration as a Chinese label: sub-second rounds to
 * `N毫秒`, seconds keep one decimal below 10 s, then `N分NN秒`, then
 * `N小时NN分`.
 * @param milliseconds - duration in milliseconds (negative or non-finite reads as 0).
 * @returns the duration label.
 */
export function formatTeamDuration(milliseconds: number): string {
  const ms = Number.isFinite(milliseconds) && milliseconds > 0 ? Math.floor(milliseconds) : 0
  if (ms < 1_000) return `${ms}毫秒`
  if (ms < 60_000) {
    const seconds = ms / 1_000
    return `${seconds < 10 ? Math.round(seconds * 10) / 10 : Math.round(seconds)}秒`
  }
  if (ms < 3_600_000) {
    return `${Math.floor(ms / 60_000)}分${pad2(Math.floor((ms % 60_000) / 1_000))}秒`
  }
  return `${Math.floor(ms / 3_600_000)}小时${pad2(Math.floor((ms % 3_600_000) / 60_000))}分`
}
