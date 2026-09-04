/**
 * Team timeline model: the lane projection (non-leader member instances in
 * members order, stable color slots, per-lane spans, the not-rostered
 * fallback lane), the linear honest time domain (progress-fact domain
 * extension only over a known-complete ledger, open-interval clock
 * extension, zero-width guard), the axis tick picker, and the locale-free
 * clock/duration formatters.
 *
 * P9-T5 (S3-C): fixtures build the vNext snapshot + ledger model inputs
 * (plan §8.2 mapping); the legacy task rows become durable progress facts
 * gated on completeness, and the legacy "unbound" lane case becomes a
 * sessionless instance.
 */
import { describe, expect, it } from 'vitest'
import type { TemplateKind } from '../../contracts/src/index.js'
import type {
  TeamUiActivityIntervalRow, TeamUiLedgerModel, TeamUiMemberInstance, TeamUiSnapshot,
  TeamUiTemplate,
} from '../src/model/team-ui-snapshot.js'
import {
  deriveTeamTimeline, formatTeamClock, formatTeamDuration, teamTimelineTicks,
  TEAM_LANE_COLOR_SLOTS,
} from '../src/model/team-timeline-model.js'

const T = 1_700_000_000_000

const iso = (ms: number): string => new Date(ms).toISOString()

/** One zero-count ledger category map (the eight frozen categories). */
const ZERO_CATEGORIES = {
  team: 0, member: 0, lifecycle: 0, message: 0, control: 0, policy: 0, compatibility: 0, progress: 0,
} as const

function snapshot(overrides: Partial<TeamUiSnapshot> = {}): TeamUiSnapshot {
  return {
    teamSessionId: 'leader-s',
    generation: 1,
    blueprint: { blueprintId: 'bp-1', revision: '1', contentHash: 'h-1' },
    perspective: { kind: 'team-root' },
    templates: [],
    members: [],
    compatibility: {
      status: 'OPEN', probeGeneration: 1, requirementFingerprint: 'rf-1', environmentFingerprint: 'ef-1',
      warningCount: 0, fatalCount: 0, acknowledgedWarningCount: 0,
    },
    policyState: 'open',
    ledgerSummary: { latestSequence: 0, totalEntries: 0, byCategory: { ...ZERO_CATEGORIES }, pendingControlCount: 0 },
    activity: [],
    disposedHistory: [],
    ...overrides,
  } as unknown as TeamUiSnapshot
}

function template(templateId: string, kind: TemplateKind, displayName: string): TeamUiTemplate {
  return { kind, templateId, displayName, contextPolicy: 'persistent' } as unknown as TeamUiTemplate
}

function instance(
  overrides: Partial<TeamUiMemberInstance> & Pick<TeamUiMemberInstance, 'instanceId' | 'templateId' | 'label'>,
): TeamUiMemberInstance {
  return {
    childSessionId: null,
    lifecycle: 'CREATED',
    displayStatus: 'created',
    liveActivity: null,
    pendingControlCount: null,
    fromHistory: false,
    createdAt: iso(T),
    ...overrides,
  } as unknown as TeamUiMemberInstance
}

function interval(
  overrides: Partial<TeamUiActivityIntervalRow> & Pick<TeamUiActivityIntervalRow, 'instanceId' | 'openedAt'>,
): TeamUiActivityIntervalRow {
  return {
    correlation: 'corr-1',
    openedSequence: 1,
    isOpen: false,
    ...overrides,
  } as unknown as TeamUiActivityIntervalRow
}

function ledger(overrides: Partial<TeamUiLedgerModel> = {}): TeamUiLedgerModel {
  return {
    completeness: 'partial',
    entries: [],
    controls: [],
    messages: [],
    intervals: [],
    progress: [],
    pendingControlByInstance: {},
    ...overrides,
  } as unknown as TeamUiLedgerModel
}

const TEMPLATES = [
  template('tpl-lead', 'leader', 'Lead'),
  template('tpl-a', 'member', 'Alpha'),
  template('tpl-b', 'member', 'Beta'),
]
const LEADER_INSTANCE = instance({ instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead' })
const MATE_A = instance({ instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: 'sa' })
const MATE_B = instance({ instanceId: 'b', templateId: 'tpl-b', label: 'Beta', childSessionId: 'sb' })
const INTERVAL_A = interval({ instanceId: 'a', openedAt: iso(T), closedAt: iso(T + 90_000) })

describe('deriveTeamTimeline', () => {
  it('returns null without activity intervals, even with members and progress', () => {
    expect(deriveTeamTimeline(
      snapshot({ templates: TEMPLATES, members: [LEADER_INSTANCE, MATE_A] }),
      ledger(),
      T,
    )).toBeNull()
    expect(deriveTeamTimeline(
      snapshot({ templates: TEMPLATES, members: [MATE_A] }),
      ledger({
        completeness: 'complete',
        progress: [{ sequence: 1, instanceId: 'a', subject: 's', progress: 'in-progress', at: iso(T) }],
      }),
      T,
    )).toBeNull()
  })

  it('spans the linear domain from the earliest known activity time to the last closure', () => {
    const earlyProgress = { sequence: 0, instanceId: 'a', subject: 's', progress: 'completed' as const, at: iso(T - 5_000) }
    const model = deriveTeamTimeline(
      snapshot({ templates: TEMPLATES, members: [LEADER_INSTANCE, MATE_A] }),
      ledger({ completeness: 'complete', intervals: [INTERVAL_A], progress: [earlyProgress] }),
      T,
    )
    expect(model).not.toBeNull()
    expect(model?.start).toBe(T - 5_000)
    expect(model?.end).toBe(T + 90_000)
  })

  it('lets a progress fact after the last closure extend the right edge', () => {
    const lateProgress = { sequence: 9, instanceId: 'a', subject: 's', progress: 'completed' as const, at: iso(T + 200_000) }
    const model = deriveTeamTimeline(
      snapshot({ templates: TEMPLATES, members: [MATE_A] }),
      ledger({ completeness: 'complete', intervals: [INTERVAL_A], progress: [lateProgress] }),
      T,
    )
    expect(model?.start).toBe(T)
    expect(model?.end).toBe(T + 200_000)
  })

  it('never extends the domain from progress facts over a partial ledger', () => {
    const lateProgress = { sequence: 9, instanceId: 'a', subject: 's', progress: 'completed' as const, at: iso(T + 200_000) }
    const model = deriveTeamTimeline(
      snapshot({ templates: TEMPLATES, members: [MATE_A] }),
      ledger({ completeness: 'partial', intervals: [INTERVAL_A], progress: [lateProgress] }),
      T,
    )
    expect(model?.start).toBe(T)
    expect(model?.end).toBe(T + 90_000)
  })

  it('extends an open interval to the caller clock and never beyond a known closure', () => {
    const open = interval({ instanceId: 'a', openedAt: iso(T), isOpen: true })
    const extended = deriveTeamTimeline(
      snapshot({ templates: TEMPLATES, members: [MATE_A] }),
      ledger({ intervals: [open] }),
      T + 30_000,
    )
    expect(extended?.end).toBe(T + 30_000)
    expect(extended?.lanes[0]?.spans[0]).toMatchObject({ endedAt: T + 30_000, inProgress: true })

    // A closed interval keeps its closure; the caller's clock is never read
    // (the legacy inconsistent open-with-settlement state is now expressed
    // as a closed interval — isOpen is the adapter's single authority).
    const closedLate = interval({ instanceId: 'a', openedAt: iso(T), closedAt: iso(T + 40_000) })
    const capped = deriveTeamTimeline(
      snapshot({ templates: TEMPLATES, members: [MATE_A] }),
      ledger({ intervals: [closedLate] }),
      T + 10_000,
    )
    expect(capped?.end).toBe(T + 40_000)
    expect(capped?.lanes[0]?.spans[0]?.endedAt).toBe(T + 40_000)
  })

  it('never reads the clock for a fully closed view', () => {
    const model = deriveTeamTimeline(
      snapshot({ templates: TEMPLATES, members: [MATE_A] }),
      ledger({ intervals: [INTERVAL_A] }),
      T + 10 ** 12,
    )
    expect(model?.end).toBe(T + 90_000)
  })

  it('draws one lane per member instance in members order and skips the leader-kind instance', () => {
    const model = deriveTeamTimeline(
      snapshot({ templates: TEMPLATES, members: [LEADER_INSTANCE, MATE_A, MATE_B] }),
      ledger({ intervals: [INTERVAL_A] }),
      T,
    )
    expect(model?.lanes.map(lane => [lane.instanceId, lane.name, lane.lane, lane.colorSlot, lane.childSessionId]))
      .toEqual([
        ['a', 'Alpha', 0, 0, 'sa'],
        ['b', 'Beta', 1, 1, 'sb'],
      ])
  })

  it('sorts an instance’s spans by open time with unique stable keys', () => {
    const later = interval({ instanceId: 'a', correlation: 'corr-later', openedAt: iso(T + 10_000), closedAt: iso(T + 20_000) })
    const model = deriveTeamTimeline(
      snapshot({ templates: TEMPLATES, members: [MATE_A] }),
      ledger({ intervals: [later, INTERVAL_A] }),
      T,
    )
    const spans = model?.lanes[0]?.spans ?? []
    expect(spans.map(span => span.startedAt)).toEqual([T, T + 10_000])
    expect(new Set(spans.map(span => span.key)).size).toBe(spans.length)
  })

  it('keeps same-timestamp spans in interval order', () => {
    const twin = { ...INTERVAL_A, correlation: 'corr-twin' }
    const model = deriveTeamTimeline(
      snapshot({ templates: TEMPLATES, members: [MATE_A] }),
      ledger({ intervals: [INTERVAL_A, twin] }),
      T,
    )
    const spans = model?.lanes[0]?.spans ?? []
    expect(spans).toHaveLength(2)
    expect(spans.map(span => span.key)).toEqual([`a:${T}:0`, `a:${T}:1`])
  })

  it('renders a not-rostered instance id as a fallback lane after the roster', () => {
    const ghost = interval({ instanceId: 'ghost', correlation: 'corr-ghost', openedAt: iso(T + 5_000), closedAt: iso(T + 15_000) })
    const model = deriveTeamTimeline(
      snapshot({ templates: TEMPLATES, members: [MATE_A] }),
      ledger({ intervals: [INTERVAL_A, ghost, { ...ghost, correlation: 'corr-ghost-2' }] }),
      T,
    )
    expect(model?.lanes.map(lane => [lane.instanceId, lane.name, lane.childSessionId, lane.spans.length]))
      .toEqual([
        ['a', 'Alpha', 'sa', 1],
        ['ghost', 'ghost', '', 2],
      ])
  })

  it('keeps a sessionless teammate instance on the matrix with an empty child session', () => {
    const sessionlessB = instance({ instanceId: 'b', templateId: 'tpl-b', label: 'Beta', childSessionId: null })
    const toSessionless = interval({ instanceId: 'b', openedAt: iso(T), closedAt: iso(T + 10_000) })
    const model = deriveTeamTimeline(
      snapshot({ templates: TEMPLATES, members: [MATE_A, sessionlessB] }),
      ledger({ intervals: [toSessionless] }),
      T,
    )
    expect(model?.lanes.map(lane => [lane.instanceId, lane.name, lane.childSessionId, lane.spans.length]))
      .toEqual([
        ['a', 'Alpha', 'sa', 0],
        ['b', 'Beta', '', 1],
      ])
  })

  it('cycles the color slot by lane position past the ramp length', () => {
    const templates = Array.from({ length: TEAM_LANE_COLOR_SLOTS + 1 }, (_, index) =>
      template(`tpl-${index}`, 'member', `M${index}`))
    const members = Array.from({ length: TEAM_LANE_COLOR_SLOTS + 1 }, (_, index) =>
      instance({
        instanceId: `m${index}`,
        templateId: `tpl-${index}`,
        label: `M${index}`,
        childSessionId: `s${index}`,
      }))
    const model = deriveTeamTimeline(
      snapshot({ templates, members }),
      ledger({ intervals: [interval({ instanceId: 'm0', openedAt: iso(T), closedAt: iso(T + 1) })] }),
      T,
    )
    expect(model?.lanes).toHaveLength(TEAM_LANE_COLOR_SLOTS + 1)
    expect(model?.lanes.at(-1)?.colorSlot).toBe(0)
  })

  it('widens a zero-width domain to 1 ms', () => {
    const instant = interval({ instanceId: 'a', openedAt: iso(T), closedAt: iso(T) })
    const model = deriveTeamTimeline(
      snapshot({ templates: TEMPLATES, members: [MATE_A] }),
      ledger({ intervals: [instant] }),
      T + 1,
    )
    expect(model?.start).toBe(T)
    expect(model?.end).toBe(T + 1)
  })
})

describe('teamTimelineTicks', () => {
  it('picks a 1/2/5 step that keeps the visible density near the target', () => {
    // Normalized exactly 1 keeps the 1×10^n step.
    expect(teamTimelineTicks(0, 5_000)).toEqual([0, 1_000, 2_000, 3_000, 4_000, 5_000])
    expect(teamTimelineTicks(0, 10_000)).toEqual([0, 2_000, 4_000, 6_000, 8_000, 10_000])
    expect(teamTimelineTicks(0, 12_000)).toEqual([0, 5_000, 10_000])
    expect(teamTimelineTicks(0, 1_200_000)).toEqual([0, 500_000, 1_000_000])
    // Normalized above 5 rounds the step up to 10×10^n.
    expect(teamTimelineTicks(0, 6_000, 2)).toEqual([0])
  })

  it('keeps ticks inside an offset domain and ascending', () => {
    const ticks = teamTimelineTicks(T, T + 1_200_000)
    expect(ticks.length).toBeGreaterThan(1)
    expect(ticks.every(tick => tick >= T && tick <= T + 1_200_000)).toBe(true)
    expect(ticks).toEqual([...ticks].sort((left, right) => left - right))
    // The length > 1 assertion makes both indexed reads total.
    const first = ticks[0]!
    const step = ticks[1]! - first
    expect(ticks.every((tick, index) => tick === first + index * step)).toBe(true)
  })

  it('degenerates gracefully on equal, inverted, or non-finite bounds', () => {
    expect(teamTimelineTicks(T, T)).toEqual([T])
    expect(teamTimelineTicks(T, T - 1)).toEqual([])
    expect(teamTimelineTicks(Number.NaN, T + 1)).toEqual([])
  })
})

describe('formatTeamClock', () => {
  // Anchor at the local midnight so the assertion holds in every timezone.
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const BASE = midnight.getTime()

  it('prints fixed 24-hour HH:MM:SS', () => {
    expect(formatTeamClock(BASE)).toBe('00:00:00')
    expect(formatTeamClock(BASE + 3_661_000)).toBe('01:01:01')
    expect(formatTeamClock(BASE + 86_399_999)).toBe('23:59:59')
  })
})

describe('formatTeamDuration', () => {
  it.each([
    [0, '0毫秒'],
    [-5, '0毫秒'],
    [Number.NaN, '0毫秒'],
    [500, '500毫秒'],
    [999, '999毫秒'],
    [8_400, '8.4秒'],
    [9_990, '10秒'],
    [10_000, '10秒'],
    [59_500, '60秒'],
    [61_000, '1分01秒'],
    [188_000, '3分08秒'],
    [3_599_999, '59分59秒'],
    [3_600_000, '1小时00分'],
    [3_661_000, '1小时01分'],
  ])('formats %i as %s', (input, expected) => {
    expect(formatTeamDuration(input)).toBe(expected)
  })
})
