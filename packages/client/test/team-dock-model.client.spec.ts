/**
 * team-dock-model: the D23 readout counts (N = the member instances in the
 * running lifecycle, history-only rows excluded; M = the frozen team-wide
 * pending control count read directly from the ledger summary) and the
 * compact expanded content (current-roster member rows in snapshot order,
 * history-only rows skipped; current-work activity rows in snapshot order)
 * — every field read straight from the projection.
 *
 * P9-T5 (S3-C): fixtures build the vNext snapshot inputs (plan §8.6
 * mapping). The running count comes from the projection lifecycle (never
 * the session log); the pending count is the frozen team-wide summary
 * value (never a per-row sum); the compact task rows become the
 * snapshot's current-work activity rows.
 */
import { describe, expect, it } from 'vitest'
import type { TeamUiSnapshot } from '../src/model/team-ui-snapshot.js'
import { deriveTeamDockContent, deriveTeamDockCounts } from '../src/model/team-dock-model.js'

const LEADER = 'leader-s'
const SA = 'sa'
const SB = 'sb'

const iso = (ms: number): string => new Date(ms).toISOString()

const ZERO_CATEGORIES = {
  team: 0, member: 0, lifecycle: 0, message: 0, control: 0, policy: 0, compatibility: 0, progress: 0,
} as const

function snapshot(overrides: Partial<TeamUiSnapshot> = {}): TeamUiSnapshot {
  return {
    teamSessionId: LEADER,
    generation: 1,
    blueprint: { blueprintId: 'bp-1', revision: '1', contentHash: 'h-1' },
    perspective: { kind: 'team-root' },
    templates: [
      { kind: 'leader', templateId: 'tpl-lead', displayName: 'Lead', contextPolicy: 'persistent' },
      { kind: 'member', templateId: 'tpl-a', displayName: 'Alpha', contextPolicy: 'persistent' },
      { kind: 'member', templateId: 'tpl-b', displayName: 'Beta', contextPolicy: 'persistent' },
    ],
    members: [
      {
        instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: LEADER,
        lifecycle: 'CREATED', displayStatus: 'created', liveActivity: null,
        pendingControlCount: null, fromHistory: false, createdAt: iso(1_700_000_000_000),
      },
      {
        instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
        lifecycle: 'RUNNING', displayStatus: 'running', currentAction: 'Bash', liveActivity: null,
        pendingControlCount: null, fromHistory: false, createdAt: iso(1_700_000_000_000),
      },
      {
        instanceId: 'b', templateId: 'tpl-b', label: 'Beta', childSessionId: null,
        lifecycle: 'CREATED', displayStatus: 'created', liveActivity: null,
        pendingControlCount: null, fromHistory: false, createdAt: iso(1_700_000_000_000),
      },
    ],
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

describe('deriveTeamDockCounts', () => {
  it('reads N as the running instances, the leader instance included, and M from the ledger summary', () => {
    const team = snapshot({
      members: [
        {
          instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: LEADER,
          lifecycle: 'RUNNING', displayStatus: 'running', liveActivity: null,
          pendingControlCount: null, fromHistory: false, createdAt: iso(1_700_000_000_000),
        },
        {
          instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
          lifecycle: 'RUNNING', displayStatus: 'running', liveActivity: null,
          pendingControlCount: null, fromHistory: false, createdAt: iso(1_700_000_000_000),
        },
        {
          instanceId: 'b', templateId: 'tpl-b', label: 'Beta', childSessionId: SB,
          lifecycle: 'CREATED', displayStatus: 'created', liveActivity: null,
          pendingControlCount: null, fromHistory: false, createdAt: iso(1_700_000_000_000),
        },
      ],
      ledgerSummary: {
        latestSequence: 0, totalEntries: 0, byCategory: { ...ZERO_CATEGORIES }, pendingControlCount: 2,
      },
    })
    expect(deriveTeamDockCounts(team)).toEqual({ runningSessions: 2, pendingControls: 2 })
  })

  it('counts a multi-instance member once per running instance', () => {
    const team = snapshot({
      members: [
        {
          instanceId: 'a1', templateId: 'tpl-a', label: 'Alpha', childSessionId: 'sa1',
          lifecycle: 'RUNNING', displayStatus: 'running', liveActivity: null,
          pendingControlCount: null, fromHistory: false, createdAt: iso(1_700_000_000_000),
        },
        {
          instanceId: 'a2', templateId: 'tpl-a', label: 'Alpha', childSessionId: 'sa2',
          lifecycle: 'RUNNING', displayStatus: 'running', liveActivity: null,
          pendingControlCount: null, fromHistory: false, createdAt: iso(1_700_000_000_000),
        },
      ],
    })
    expect(deriveTeamDockCounts(team).runningSessions).toBe(2)
  })

  it('never counts history-only instances and reads M as the frozen summary value, not a per-row sum', () => {
    const team = snapshot({
      members: [
        {
          instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: LEADER,
          lifecycle: 'CREATED', displayStatus: 'created', liveActivity: null,
          pendingControlCount: 5, fromHistory: false, createdAt: iso(1_700_000_000_000),
        },
        {
          instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
          lifecycle: 'CREATED', displayStatus: 'created', liveActivity: null,
          pendingControlCount: 5, fromHistory: false, createdAt: iso(1_700_000_000_000),
        },
        {
          instanceId: 'gone', templateId: 'tpl-b', label: 'Gone', childSessionId: null,
          lifecycle: 'DISPOSED', displayStatus: 'disposed', liveActivity: null,
          pendingControlCount: null, fromHistory: true, createdAt: iso(1_700_000_000_000), disposedAt: iso(1_700_000_060_000),
        },
      ],
      ledgerSummary: {
        latestSequence: 0, totalEntries: 0, byCategory: { ...ZERO_CATEGORIES }, pendingControlCount: 3,
      },
    })
    expect(deriveTeamDockCounts(team)).toEqual({ runningSessions: 0, pendingControls: 3 })
  })

  it('reads zero from a fully idle team', () => {
    const team = snapshot({
      members: [
        {
          instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: LEADER,
          lifecycle: 'CREATED', displayStatus: 'created', liveActivity: null,
          pendingControlCount: null, fromHistory: false, createdAt: iso(1_700_000_000_000),
        },
      ],
    })
    expect(deriveTeamDockCounts(team)).toEqual({ runningSessions: 0, pendingControls: 0 })
  })
})

describe('deriveTeamDockContent', () => {
  it('lists the current-roster instances in snapshot order, the leader instance included, and skips history-only rows', () => {
    const team = snapshot({
      members: [
        {
          instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: LEADER,
          lifecycle: 'CREATED', displayStatus: 'created', liveActivity: null,
          pendingControlCount: null, fromHistory: false, createdAt: iso(1_700_000_000_000),
        },
        {
          instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
          lifecycle: 'RUNNING', displayStatus: 'running', liveActivity: null,
          pendingControlCount: null, fromHistory: false, createdAt: iso(1_700_000_000_000),
        },
        {
          instanceId: 'b', templateId: 'tpl-b', label: 'Beta', childSessionId: null,
          lifecycle: 'CREATED', displayStatus: 'created', liveActivity: null,
          pendingControlCount: null, fromHistory: false, createdAt: iso(1_700_000_000_000),
        },
        {
          instanceId: 'gone', templateId: 'tpl-b', label: 'Gone', childSessionId: null,
          lifecycle: 'DISPOSED', displayStatus: 'disposed', liveActivity: null,
          pendingControlCount: null, fromHistory: true, createdAt: iso(1_700_000_000_000), disposedAt: iso(1_700_000_060_000),
        },
      ],
    })
    const content = deriveTeamDockContent(team)
    expect(content.members).toEqual([
      { key: 'lead', instanceId: 'lead', name: 'Lead', status: 'created' },
      { key: 'a', instanceId: 'a', name: 'Alpha', status: 'running' },
      { key: 'b', instanceId: 'b', name: 'Beta', status: 'created' },
    ])
    expect(content.activities).toEqual([])
  })

  it('reads the current-work activity rows straight through in snapshot order', () => {
    const team = snapshot({
      activity: [
        {
          instanceId: 'a', label: 'Alpha', status: 'in-progress', subject: 'Wire the mirror',
          openIntervals: [],
        },
        {
          instanceId: 'lead', label: 'Lead', status: 'completed', subject: 'Ship the dock',
          openIntervals: [],
        },
      ],
    })
    expect(deriveTeamDockContent(team).activities).toEqual([
      { key: 'a', instanceId: 'a', label: 'Alpha', status: 'in-progress', subject: 'Wire the mirror' },
      { key: 'lead', instanceId: 'lead', label: 'Lead', status: 'completed', subject: 'Ship the dock' },
    ])
  })

  it('falls back for the activity row text: subject, else summary, else the live current action', () => {
    const team = snapshot({
      activity: [
        {
          instanceId: 'a', label: 'Alpha', status: 'in-progress',
          subject: 'Wire the mirror', summary: 'summary-a', currentAction: 'Bash',
          openIntervals: [],
        },
        {
          instanceId: 'b', label: 'Beta', summary: 'halfway there',
          openIntervals: [],
        },
        {
          instanceId: 'c', label: 'Gamma', currentAction: 'Bash',
          openIntervals: [],
        },
        {
          instanceId: 'lead', label: 'Lead', status: 'blocked',
          openIntervals: [],
        },
      ],
    })
    expect(deriveTeamDockContent(team).activities).toEqual([
      { key: 'a', instanceId: 'a', label: 'Alpha', status: 'in-progress', subject: 'Wire the mirror' },
      { key: 'b', instanceId: 'b', label: 'Beta', subject: 'halfway there' },
      { key: 'c', instanceId: 'c', label: 'Gamma', subject: 'Bash' },
      { key: 'lead', instanceId: 'lead', label: 'Lead', status: 'blocked' },
    ])
  })

  it('keeps a distinct key per row for a multi-instance member', () => {
    const team = snapshot({
      members: [
        {
          instanceId: 'a1', templateId: 'tpl-a', label: 'Alpha', childSessionId: 'sa1',
          lifecycle: 'RUNNING', displayStatus: 'running', liveActivity: null,
          pendingControlCount: null, fromHistory: false, createdAt: iso(1_700_000_000_000),
        },
        {
          instanceId: 'a2', templateId: 'tpl-a', label: 'Alpha', childSessionId: 'sa2',
          lifecycle: 'CREATED', displayStatus: 'created', liveActivity: null,
          pendingControlCount: null, fromHistory: false, createdAt: iso(1_700_000_000_000),
        },
      ],
    })
    const keys = deriveTeamDockContent(team).members.map(row => row.key)
    expect(keys).toEqual(['a1', 'a2'])
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('keeps a sessionless instance in the member list', () => {
    const team = snapshot({
      members: [
        {
          instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: null,
          lifecycle: 'CREATED', displayStatus: 'created', liveActivity: null,
          pendingControlCount: null, fromHistory: false, createdAt: iso(1_700_000_000_000),
        },
      ],
    })
    expect(deriveTeamDockContent(team).members).toEqual([
      { key: 'a', instanceId: 'a', name: 'Alpha', status: 'created' },
    ])
  })
})
