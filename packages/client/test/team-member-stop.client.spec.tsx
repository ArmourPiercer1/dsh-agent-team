// @vitest-environment jsdom
/**
 * PD-34 (MEMBER-STOP) — the team view's per-Member stop entry, through the
 * REAL component and the injected face.
 *
 * What this file proves (host-free): the control EXISTS on a live Member row,
 * its copy distinguishes the two semantics (stop THIS Member vs stop the
 * Leader's current turn), the click calls the injected stop face with the
 * Member's own child session id, the note shows the OBSERVED durable phase the
 * face returned, and the row keeps its projection-driven lifecycle (NO
 * optimistic local patch). It also proves the negative space: no face → no
 * control; ARCHIVED / DISPOSED / session-less rows → no control.
 *
 * What it CANNOT prove (disclosed, not implied): that a headless click really
 * reached the host. The live arm drives the SAME face's RPC sequence
 * (`goals/get` → `goals/pause` → `session/cancel` → `goals/get`) against a
 * real boot; the click path itself is verified here at the component boundary.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { RemoteResponse } from '../../remote/src/index.js'
import type {
  TeamUiDisplayStatus, TeamUiLedgerModel, TeamUiMemberInstance, TeamUiSnapshot,
} from '../src/model/team-ui-snapshot.js'
import type { MemberStopOutcome } from '../src/model/member-stop.js'
import { TeamMembers, type TeamMembersCommandFace } from '../src/ui/TeamMembers.js'
import { zh } from '../src/ui/locales.js'

const LEADER = 'leader-s'
const SA = 'sa'

const iso = (ms: number): string => new Date(ms).toISOString()

const ZERO_CATEGORIES = {
  team: 0, member: 0, lifecycle: 0, message: 0, control: 0, policy: 0, compatibility: 0, progress: 0,
} as const

const LIFECYCLE: Record<TeamUiDisplayStatus, TeamUiMemberInstance['lifecycle']> = {
  created: 'CREATED',
  running: 'RUNNING',
  settled: 'SETTLED',
  archived: 'ARCHIVED',
  disposed: 'DISPOSED',
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
    createdAt: iso(1_700_000_000_000),
    ...overrides,
  } as unknown as TeamUiMemberInstance
}

function snapshot(members: readonly TeamUiMemberInstance[]): TeamUiSnapshot {
  return {
    teamSessionId: LEADER,
    generation: 1,
    blueprint: { blueprintId: 'bp-1', revision: '1', contentHash: 'h-1' },
    perspective: { kind: 'team-root' },
    templates: [
      { kind: 'leader', templateId: 'tpl-lead', displayName: 'Lead', contextPolicy: 'persistent' },
      { kind: 'member', templateId: 'tpl-a', displayName: 'Alpha', contextPolicy: 'persistent' },
    ],
    members,
    compatibility: {
      status: 'OPEN', probeGeneration: 1, requirementFingerprint: 'rf-1', environmentFingerprint: 'ef-1',
      warningCount: 0, fatalCount: 0, acknowledgedWarningCount: 0,
    },
    policyState: 'open',
    ledgerSummary: { latestSequence: 0, totalEntries: 0, byCategory: { ...ZERO_CATEGORIES }, pendingControlCount: 0 },
    activity: [],
    disposedHistory: [],
  } as unknown as TeamUiSnapshot
}

function ledger(): TeamUiLedgerModel {
  return {
    completeness: 'partial',
    entries: [],
    controls: [],
    messages: [],
    intervals: [],
    progress: [],
    pendingControlByInstance: {},
  } as unknown as TeamUiLedgerModel
}

const okResponse = (method: string): RemoteResponse => ({
  ok: true,
  value: {
    data: null,
    provenance: {
      origin: 'team-remote', method, endpoint: method, contractVersion: 1,
      requestToken: null, projectionGeneration: null, effectSequence: null,
    },
  },
})

const STOPPED: MemberStopOutcome = {
  kind: 'stopped',
  goalId: 'goal-1',
  revision: 3,
  phase: 'paused',
  observedPhase: 'paused',
  cancel: { kind: 'accepted' },
}

function makeFace(overrides: Partial<TeamMembersCommandFace> = {}): TeamMembersCommandFace {
  return {
    memberCreate: vi.fn(() => Promise.resolve(okResponse('member.create'))),
    memberSend: vi.fn(() => Promise.resolve(okResponse('member.send'))),
    memberFollowup: vi.fn(() => Promise.resolve(okResponse('member.followup'))),
    memberArchive: vi.fn(() => Promise.resolve(okResponse('member.archive'))),
    memberRestore: vi.fn(() => Promise.resolve(okResponse('member.restore'))),
    memberDispose: vi.fn(() => Promise.resolve(okResponse('member.dispose'))),
    memberStop: vi.fn(() => Promise.resolve(STOPPED)),
    leaderStopTurn: vi.fn(() => Promise.resolve({ kind: 'accepted' } as const)),
    pullProjection: vi.fn(() => Promise.resolve({ status: 'duplicate', receivedGeneration: 1 } as const)),
    ...overrides,
  }
}

function props(team: TeamUiSnapshot, face?: TeamMembersCommandFace): Parameters<typeof TeamMembers>[0] {
  const base: Parameters<typeof TeamMembers>[0] = {
    snapshot: team,
    ledger: ledger(),
    currentSessionId: LEADER,
    onSelectSession: vi.fn(),
    t: makeTranslate(zh),
  }
  if (face !== undefined) base.memberCommands = face
  return base
}

const memberRow = (overrides: Partial<TeamUiMemberInstance> = {}): TeamUiMemberInstance => instance({
  instanceId: 'a',
  templateId: 'tpl-a',
  label: 'Alpha',
  childSessionId: SA,
  lifecycle: LIFECYCLE.running,
  displayStatus: 'running',
  ...overrides,
})

afterEach(cleanup)

describe('PD-34 team view — stop a specific Member', () => {
  it('renders the per-Member stop on a live row, with copy that names the scope', () => {
    const view = render(<TeamMembers {...props(snapshot([memberRow()]), makeFace())} />)
    const stop = view.container.querySelector<HTMLButtonElement>('[data-member-stop]')
    if (stop === null) throw new Error('the per-Member stop control did not render')
    expect(stop.textContent).toBe('停止此成员')
    // The hint is the semantic contract, not decoration.
    expect(stop.getAttribute('title')).toContain('暂停该成员的目标')
    expect(stop.getAttribute('title')).toContain('不影响其他成员')
  })

  it('calls the stop face with the Member child session id and shows the OBSERVED phase', async () => {
    const face = makeFace()
    const view = render(<TeamMembers {...props(snapshot([memberRow()]), face)} />)
    const stop = view.container.querySelector<HTMLButtonElement>('[data-member-stop]')
    if (stop === null) throw new Error('the per-Member stop control did not render')
    fireEvent.click(stop)

    await vi.waitFor(() => {
      expect(face.memberStop).toHaveBeenCalledTimes(1)
      expect(view.container.querySelector('[data-member-stop-note]')?.textContent).toBeTruthy()
    })
    expect(face.memberStop).toHaveBeenCalledWith({
      teamSessionId: LEADER,
      instanceId: 'a',
      sessionId: SA,
    })
    const note = view.container.querySelector('[data-member-stop-note]')?.textContent ?? ''
    expect(note).toContain('已停止')
    expect(note).toContain('phase=paused')
    expect(note).toContain('rev 3')
    // NO optimistic lifecycle patch: the row stays RUNNING until the
    // projection says otherwise (the stop changes the goal, not the lifecycle).
    expect(view.container.querySelector('[data-member-instance]')?.getAttribute('data-status')).toBe('running')
  })

  it('renders a typed stop failure verbatim (never a green note)', async () => {
    const face = makeFace({
      memberStop: vi.fn(() => Promise.resolve({
        kind: 'pause-refused',
        code: 'goal/stale-revision',
        message: 'revision moved',
        phase: 'active',
        revision: 2,
      } as const)),
    })
    const view = render(<TeamMembers {...props(snapshot([memberRow()]), face)} />)
    fireEvent.click(view.container.querySelector('[data-member-stop]')!)
    await vi.waitFor(() => {
      const note = view.container.querySelector('[data-member-stop-note]')?.textContent ?? ''
      expect(note).toContain('停止失败')
      expect(note).toContain('goal/stale-revision')
      expect(note).toContain('revision moved')
    })
  })

  it('the LEADER entry is a DIFFERENT control with different copy and no Member call', async () => {
    const face = makeFace()
    const view = render(<TeamMembers {...props(snapshot([memberRow()]), face)} />)
    const leaderStop = view.container.querySelector<HTMLButtonElement>('[data-leader-stop]')
    if (leaderStop === null) throw new Error("the Leader turn-stop control did not render")
    expect(leaderStop.textContent).toBe('停止 Leader 当前回合')
    expect(leaderStop.getAttribute('title')).toContain('已委派的成员不会被停止')
    fireEvent.click(leaderStop)

    await vi.waitFor(() => {
      expect(face.leaderStopTurn).toHaveBeenCalledTimes(1)
      expect(view.container.querySelector('[data-leader-stop-note]')?.textContent).toBeTruthy()
    })
    expect(face.leaderStopTurn).toHaveBeenCalledWith(LEADER)
    expect(face.memberStop).toHaveBeenCalledTimes(0)
    const note = view.container.querySelector('[data-leader-stop-note]')?.textContent ?? ''
    expect(note).toContain('已委派的成员继续运行')
  })

  it('renders no stop control without the face (display-only section stays display-only)', () => {
    const view = render(<TeamMembers {...props(snapshot([memberRow()]))} />)
    expect(view.container.querySelectorAll('[data-member-stop]')).toHaveLength(0)
    expect(view.container.querySelectorAll('[data-leader-stop]')).toHaveLength(0)
  })

  it('renders no per-Member stop on ARCHIVED / DISPOSED / session-less rows', () => {
    const view = render(<TeamMembers {...props(snapshot([
      memberRow({ instanceId: 'x', label: 'Arch', lifecycle: LIFECYCLE.archived, displayStatus: 'archived' }),
      memberRow({ instanceId: 'y', label: 'Disp', lifecycle: LIFECYCLE.disposed, displayStatus: 'disposed' }),
      memberRow({ instanceId: 'z', label: 'NoSess', childSessionId: null }),
    ]), makeFace())} />)
    expect(view.container.querySelectorAll('[data-member-stop]')).toHaveLength(0)
    // The Leader entry still renders: it addresses the root, not a Member row.
    expect(screen.getByText('停止 Leader 当前回合')).toBeTruthy()
  })
})
