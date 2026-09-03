// @vitest-environment jsdom
/**
 * The S5-B member command flows (P9-T7; UI doc §17/§23/§40, Gate P9-G5):
 * the lifecycle-gated action cluster (the §40 matrix per closed lifecycle,
 * with the work-aware labels — CREATED "Send work…", SETTLED "Resume…",
 * the other live states "Message…"), the §17 create dialog on the group
 * "+" entry, the §23 confirmations (archive with the RUNNING drain
 * warning; dispose — never a "delete" framing), the direct-click restore
 * (§23.4), and the G5 discipline: every command settles through the
 * injected frozen Remote face, a typed failure is rendered VERBATIM
 * (code + message + the request-token echo), a transport loss records the
 * `transport-loss` note, a success pulls the projection (the final-state
 * authority) and applies NO optimistic authority patch — the row keeps
 * its projection-driven status until a new frame lands.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  RemoteMemberCreateParams, RemoteMemberFollowupParams, RemoteMemberLifecycleParams,
  RemoteMemberSendParams, RemoteResponse, RemoteSafeJsonValue,
} from '../../remote/src/index.js'
import type {
  TeamUiDisplayStatus, TeamUiLedgerModel, TeamUiMemberInstance, TeamUiSnapshot,
} from '../src/model/team-ui-snapshot.js'
import type { TeamWorkspaceOption } from '../src/model/team-intent-model.js'
import { TeamMembers, type TeamMembersCommandFace } from '../src/ui/TeamMembers.js'
import { zh } from '../src/ui/locales.js'

const LEADER = 'leader-s'
const SA = 'sa'

const iso = (ms: number): string => new Date(ms).toISOString()

const ZERO_CATEGORIES = {
  team: 0, member: 0, lifecycle: 0, message: 0, control: 0, policy: 0, compatibility: 0, progress: 0,
} as const

/** The §7.2 display → raw lifecycle pairing for fixture rows. */
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

function snapshot(
  members: readonly TeamUiMemberInstance[],
  overrides: Partial<TeamUiSnapshot> = {},
): TeamUiSnapshot {
  return {
    teamSessionId: LEADER,
    generation: 1,
    blueprint: { blueprintId: 'bp-1', revision: '1', contentHash: 'h-1' },
    perspective: { kind: 'team-root' },
    templates: [
      { kind: 'leader', templateId: 'tpl-lead', displayName: 'Lead', contextPolicy: 'persistent' },
      { kind: 'member', templateId: 'tpl-a', displayName: 'Alpha', contextPolicy: 'persistent' },
      { kind: 'member', templateId: 'tpl-b', displayName: 'Beta', contextPolicy: 'fresh_per_delegation' },
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
    ...overrides,
  } as unknown as TeamUiSnapshot
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

/** One provenance-bearing success envelope (the wire shape, verbatim). */
function okResponse(data: unknown, method: string): RemoteResponse {
  return {
    ok: true,
    value: {
      data: data as RemoteSafeJsonValue,
      provenance: {
        origin: 'team-remote', method, endpoint: method, contractVersion: 1,
        requestToken: null, projectionGeneration: null, effectSequence: null,
      },
    },
  }
}

/** One typed failure envelope (the closed code + wire message kept verbatim). */
function errorResponse(code: string, message: string, method: string, requestToken: string | null): RemoteResponse {
  return {
    ok: false,
    error: {
      code, message,
      details: { method, endpoint: method, contractVersion: 1, requestToken },
    },
  }
}

/** The S5-B command face (every member a spy; the defaults are the happy path). */
function makeFace(overrides: Partial<TeamMembersCommandFace> = {}): TeamMembersCommandFace {
  return {
    memberCreate: vi.fn(() => Promise.resolve(okResponse(null, 'member.create'))),
    memberSend: vi.fn(() => Promise.resolve(okResponse(null, 'member.send'))),
    memberFollowup: vi.fn(() => Promise.resolve(okResponse(null, 'member.followup'))),
    memberArchive: vi.fn(() => Promise.resolve(okResponse(null, 'member.archive'))),
    memberRestore: vi.fn(() => Promise.resolve(okResponse(null, 'member.restore'))),
    memberDispose: vi.fn(() => Promise.resolve(okResponse(null, 'member.dispose'))),
    pullProjection: vi.fn(() => Promise.resolve(null)),
    ...overrides,
  }
}

function makeProps(
  team: TeamUiSnapshot,
  memberCommands?: TeamMembersCommandFace,
  workspaces?: readonly TeamWorkspaceOption[],
  onSelectSession: (sessionId: string) => void = vi.fn(),
): Parameters<typeof TeamMembers>[0] {
  const props: Parameters<typeof TeamMembers>[0] = {
    snapshot: team,
    ledger: ledger(),
    currentSessionId: LEADER,
    onSelectSession,
    t: makeTranslate(zh),
  }
  if (memberCommands !== undefined) {
    props.memberCommands = memberCommands
  }
  if (workspaces !== undefined) {
    props.workspaces = workspaces
  }
  return props
}

/** The action buttons of one instance row, in cluster order. */
function rowActions(container: HTMLElement, status: TeamUiDisplayStatus): HTMLButtonElement[] {
  const row = container.querySelector(`[data-member-instance][data-status="${status}"]`)
  if (row === null) throw new Error(`the ${status} instance row did not render`)
  return [...row.querySelectorAll<HTMLButtonElement>('[data-member-action-button]')]
}

/** The "+" create entry of the first teammate group. */
function createEntry(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('[data-member-create-instance]')
  if (button === null) throw new Error('the group "+" create entry did not render')
  return button
}

afterEach(cleanup)

describe('TeamMembers S5-B command flows', () => {
  it('stays display-only without the command face (no cluster, no "+" entry)', () => {
    const view = render(<TeamMembers {...makeProps(snapshot([
      instance({ instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA }),
    ]))} />)
    expect(view.container.querySelectorAll('[data-member-actions]')).toHaveLength(0)
    expect(view.container.querySelectorAll('[data-member-create-instance]')).toHaveLength(0)
  })

  it('exposes the §40 CREATED cluster: send work / follow-up / archive / dispose', () => {
    const view = render(<TeamMembers {...makeProps(
      snapshot([instance({ instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA })]),
      makeFace(),
    )} />)
    const buttons = rowActions(view.container, 'created')
    expect(buttons.map(button => button.dataset.memberActionButton)).toEqual(['send', 'followup', 'archive', 'dispose'])
    expect(buttons.map(button => button.textContent)).toEqual(['发送任务…', '发送跟进', '归档', '处置'])
  })

  it('exposes the §40 RUNNING cluster: the send action reads as a message', () => {
    const view = render(<TeamMembers {...makeProps(
      snapshot([
        instance({
          instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
          lifecycle: LIFECYCLE.running, displayStatus: 'running',
        }),
      ]),
      makeFace(),
    )} />)
    const buttons = rowActions(view.container, 'running')
    expect(buttons.map(button => button.dataset.memberActionButton)).toEqual(['send', 'followup', 'archive', 'dispose'])
    expect(buttons.map(button => button.textContent)).toEqual(['发送消息…', '发送跟进', '归档', '处置'])
  })

  it('exposes the §40 SETTLED cluster with the Resume… follow-up label', () => {
    const view = render(<TeamMembers {...makeProps(
      snapshot([
        instance({
          instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
          lifecycle: LIFECYCLE.settled, displayStatus: 'settled',
        }),
      ]),
      makeFace(),
    )} />)
    const buttons = rowActions(view.container, 'settled')
    expect(buttons.map(button => button.dataset.memberActionButton)).toEqual(['send', 'followup', 'archive', 'dispose'])
    expect(buttons.map(button => button.textContent)).toEqual(['发送消息…', '恢复…', '归档', '处置'])
  })

  it('exposes the §40 ARCHIVED cluster: restore + dispose only', () => {
    const view = render(<TeamMembers {...makeProps(
      snapshot([
        instance({
          instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
          lifecycle: LIFECYCLE.archived, displayStatus: 'archived',
        }),
      ]),
      makeFace(),
    )} />)
    const buttons = rowActions(view.container, 'archived')
    expect(buttons.map(button => button.dataset.memberActionButton)).toEqual(['restore', 'dispose'])
    expect(buttons.map(button => button.textContent)).toEqual(['恢复', '处置'])
  })

  it('renders NO action cluster for DISPOSED rows and keeps the leader lane display-only', () => {
    const view = render(<TeamMembers {...makeProps(
      snapshot([
        instance({ instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: LEADER }),
        instance({
          instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
          lifecycle: LIFECYCLE.disposed, displayStatus: 'disposed',
        }),
      ]),
      makeFace(),
    )} />)
    expect(rowActions(view.container, 'disposed')).toHaveLength(0)
    const leaderRow = view.container.querySelector('[data-member-instance][data-status="created"]')
    expect(leaderRow).toBeTruthy()
    expect(leaderRow!.querySelector('[data-member-actions]')).toBeNull()
    // The leader group row carries no "+" entry (only teammate groups do).
    const leaderGroup = view.container.querySelector('[data-member-group]')
    expect(leaderGroup?.querySelector('[data-member-create-instance]')).toBeNull()
  })

  it('send-work settles through member.followup: frozen params, pending badge, projection pull, no local patch (G5)', async () => {
    const face = makeFace()
    const view = render(<TeamMembers {...makeProps(
      snapshot([
        instance({
          instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
          lifecycle: LIFECYCLE.running, displayStatus: 'running', currentAction: 'Bash',
        }),
      ]),
      face,
    )} />)
    fireEvent.click(rowActions(view.container, 'running')[1]!) // followup
    // The prompt dialog (the send-new-work interaction).
    expect(screen.getByText('向 Alpha 发送任务')).toBeTruthy()
    const input = view.container.querySelector<HTMLInputElement>('[data-member-prompt-input]')
    if (input === null) throw new Error('the prompt input did not render')
    expect(view.container.querySelector<HTMLButtonElement>('[data-member-prompt-submit]')?.disabled).toBe(true)
    fireEvent.change(input, { target: { value: '  继续 ' } })
    fireEvent.click(view.container.querySelector('[data-member-prompt-submit]')!)
    // The dialog closes; the row shows the in-flight command.
    expect(view.container.querySelector('[data-member-prompt-dialog]')).toBeNull()
    const row = view.container.querySelector<HTMLElement>('[data-member-instance][data-status="running"]')
    expect(row?.dataset.memberCommandPending).toBe('followup')
    expect(face.memberFollowup).toHaveBeenCalledTimes(1)
    expect(face.memberFollowup).toHaveBeenCalledWith({
      teamSessionId: LEADER,
      caller: { kind: 'human', humanId: LEADER },
      targetInstanceId: 'a',
      requestToken: 'ui-1',
      payload: { prompt: '继续' },
    } satisfies RemoteMemberFollowupParams)
    // Success: the projection is pulled (the final-state authority) and NO
    // optimistic patch is applied — the row keeps its projection status.
    await vi.waitFor(() => {
      expect(face.pullProjection).toHaveBeenCalledTimes(1)
      expect(row?.dataset.memberCommandPending).toBeUndefined()
    })
    expect(face.pullProjection).toHaveBeenCalledWith(LEADER)
    expect(view.container.querySelector('[data-member-command-error]')).toBeNull()
    // NO optimistic authority patch: the row keeps its projection status.
    expect(row?.querySelector('[data-member-status-text]')?.textContent).toBe('运行中')
  })

  it('the message dialog submits member.send with the subject present only when given', async () => {
    const sendCalls: RemoteMemberSendParams[] = []
    const face = makeFace({
      memberSend: vi.fn((params: RemoteMemberSendParams) => {
        sendCalls.push(params)
        return Promise.resolve(okResponse(null, 'member.send'))
      }),
    })
    const view = render(<TeamMembers {...makeProps(
      snapshot([
        instance({
          instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
          lifecycle: LIFECYCLE.running, displayStatus: 'running',
        }),
      ]),
      face,
    )} />)
    fireEvent.click(rowActions(view.container, 'running')[0]!) // send (message)
    expect(screen.getByText('给 Alpha 发消息')).toBeTruthy()
    const body = view.container.querySelector<HTMLTextAreaElement>('[data-member-message-body]')
    if (body === null) throw new Error('the message body did not render')
    fireEvent.change(body, { target: { value: ' hello ' } })
    fireEvent.click(view.container.querySelector('[data-member-message-submit]')!)
    expect(sendCalls).toHaveLength(1)
    expect(sendCalls[0]).toEqual({
      teamSessionId: LEADER,
      caller: { kind: 'human', humanId: LEADER },
      recipientInstanceId: 'a',
      body: 'hello',
      requestToken: 'ui-1',
    })
    // The subject key is ABSENT (not an empty string) when left blank.
    expect('subject' in (sendCalls[0] ?? {})).toBe(false)
    await vi.waitFor(() => {
      expect(face.pullProjection).toHaveBeenCalledTimes(1)
    })

    // Second message, this time with a subject (the dialog state is
    // dialog-local: the reopened dialog starts blank again).
    fireEvent.click(rowActions(view.container, 'running')[0]!)
    const subject = view.container.querySelector<HTMLInputElement>('[data-member-message-subject]')
    if (subject === null) throw new Error('the message subject did not render')
    const reopenedBody = view.container.querySelector<HTMLTextAreaElement>('[data-member-message-body]')
    if (reopenedBody === null) throw new Error('the reopened message body did not render')
    fireEvent.change(subject, { target: { value: ' sync ' } })
    fireEvent.change(reopenedBody, { target: { value: ' sync text ' } })
    fireEvent.click(view.container.querySelector('[data-member-message-submit]')!)
    expect(sendCalls).toHaveLength(2)
    expect(sendCalls[1]).toEqual({
      teamSessionId: LEADER,
      caller: { kind: 'human', humanId: LEADER },
      recipientInstanceId: 'a',
      body: 'sync text',
      subject: 'sync',
      requestToken: 'ui-2',
    })
    expect('subject' in (sendCalls[1] ?? {})).toBe(true)
  })

  it('a typed failure renders the verbatim note with the token echo and pulls no projection (G5)', async () => {
    const face = makeFace({
      memberFollowup: vi.fn(() => Promise.resolve(
        errorResponse('ADMISSION_REJECTED', 'prompt too long', 'member.followup', 'ui-1'),
      )),
    })
    const view = render(<TeamMembers {...makeProps(
      snapshot([
        instance({
          instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
          lifecycle: LIFECYCLE.running, displayStatus: 'running',
        }),
      ]),
      face,
    )} />)
    fireEvent.click(rowActions(view.container, 'running')[1]!)
    const input = view.container.querySelector<HTMLInputElement>('[data-member-prompt-input]')
    if (input === null) throw new Error('the prompt input did not render')
    fireEvent.change(input, { target: { value: 'x' } })
    fireEvent.click(view.container.querySelector('[data-member-prompt-submit]')!)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-member-command-error]')).toBeTruthy()
    })
    expect(view.container.querySelector('[data-member-command-error]')?.textContent)
      .toBe('命令失败：ADMISSION_REJECTED: prompt too long [ui-1]')
    expect(face.pullProjection).not.toHaveBeenCalled()
    // The pending mark is cleared: the cluster is re-enabled.
    const row = view.container.querySelector<HTMLElement>('[data-member-instance][data-status="running"]')
    expect(row?.dataset.memberCommandPending).toBeUndefined()
    expect(row?.querySelectorAll('[data-member-action-button][disabled]')).toHaveLength(0)
  })

  it('a transport loss (the only rejection kind) records the transport-loss note', async () => {
    const face = makeFace({
      memberFollowup: vi.fn(() => Promise.reject(new Error('channel lost'))),
    })
    const view = render(<TeamMembers {...makeProps(
      snapshot([
        instance({
          instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
          lifecycle: LIFECYCLE.running, displayStatus: 'running',
        }),
      ]),
      face,
    )} />)
    fireEvent.click(rowActions(view.container, 'running')[1]!)
    const input = view.container.querySelector<HTMLInputElement>('[data-member-prompt-input]')
    if (input === null) throw new Error('the prompt input did not render')
    fireEvent.change(input, { target: { value: 'x' } })
    fireEvent.click(view.container.querySelector('[data-member-prompt-submit]')!)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-member-command-error]')).toBeTruthy()
    })
    expect(view.container.querySelector('[data-member-command-error]')?.textContent)
      .toBe('命令失败：transport-loss: channel lost [ui-1]')
    expect(face.pullProjection).not.toHaveBeenCalled()
  })

  it('archive confirms (with the RUNNING drain warning); cancel issues nothing', async () => {
    const face = makeFace()
    const view = render(<TeamMembers {...makeProps(
      snapshot([
        instance({
          instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
          lifecycle: LIFECYCLE.running, displayStatus: 'running',
        }),
      ]),
      face,
    )} />)
    fireEvent.click(rowActions(view.container, 'running')[2]!) // archive
    expect(screen.getByText('归档该成员？')).toBeTruthy()
    expect(screen.getByText('该成员正在运行。归档将停止当前工作，并在归档前排空其驻留子成员。')).toBeTruthy()
    // Cancel closes the dialog without running the command.
    fireEvent.click(view.container.querySelector('[data-member-confirm-cancel]')!)
    expect(view.container.querySelector('[data-member-confirm-dialog]')).toBeNull()
    expect(face.memberArchive).not.toHaveBeenCalled()

    // Confirm runs the frozen lifecycle command.
    fireEvent.click(rowActions(view.container, 'running')[2]!)
    fireEvent.click(view.container.querySelector('[data-member-confirm-ok]')!)
    expect(face.memberArchive).toHaveBeenCalledTimes(1)
    expect(face.memberArchive).toHaveBeenCalledWith({
      teamSessionId: LEADER,
      instanceId: 'a',
    } satisfies RemoteMemberLifecycleParams)
    await vi.waitFor(() => {
      expect(face.pullProjection).toHaveBeenCalledTimes(1)
    })
  })

  it('restore is a direct click — no confirmation dialog (§23.4)', async () => {
    const face = makeFace()
    const view = render(<TeamMembers {...makeProps(
      snapshot([
        instance({
          instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
          lifecycle: LIFECYCLE.archived, displayStatus: 'archived',
        }),
      ]),
      face,
    )} />)
    fireEvent.click(rowActions(view.container, 'archived')[0]!) // restore
    expect(view.container.querySelector('[data-member-dialog]')).toBeNull()
    expect(face.memberRestore).toHaveBeenCalledTimes(1)
    expect(face.memberRestore).toHaveBeenCalledWith({
      teamSessionId: LEADER,
      instanceId: 'a',
    } satisfies RemoteMemberLifecycleParams)
    await vi.waitFor(() => {
      expect(face.pullProjection).toHaveBeenCalledTimes(1)
    })
  })

  it('dispose confirms with the §23.5 copy (never a delete framing)', async () => {
    const face = makeFace()
    const view = render(<TeamMembers {...makeProps(
      snapshot([
        instance({
          instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
          lifecycle: LIFECYCLE.settled, displayStatus: 'settled',
        }),
      ]),
      face,
    )} />)
    fireEvent.click(rowActions(view.container, 'settled')[3]!) // dispose
    expect(screen.getByText('处置该成员？')).toBeTruthy()
    expect(screen.getByText('该成员无法再恢复或接收新的团队任务。其会话历史、Chat、Trajectory 与团队审计历史将保留。')).toBeTruthy()
    const ok = view.container.querySelector<HTMLButtonElement>('[data-member-confirm-ok]')
    if (ok === null) throw new Error('the confirm ok button did not render')
    expect(ok.textContent).toBe('处置')
    fireEvent.click(ok)
    expect(face.memberDispose).toHaveBeenCalledTimes(1)
    expect(face.memberDispose).toHaveBeenCalledWith({
      teamSessionId: LEADER,
      instanceId: 'a',
    } satisfies RemoteMemberLifecycleParams)
  })

  it('the group "+" opens the §17 create dialog (template row, fresh notice, hidden workspace field without a feed)', () => {
    const view = render(<TeamMembers {...makeProps(
      snapshot([
        instance({ instanceId: 'b', templateId: 'tpl-b', label: 'Beta' }),
      ]),
      makeFace(),
    )} />)
    fireEvent.click(createEntry(view.container))
    const dialog = view.container.querySelector('[data-member-create-dialog]')
    expect(dialog).toBeTruthy()
    expect(screen.getByText('创建成员实例')).toBeTruthy()
    // The template is the fresh_per_delegation one → the notice shows.
    expect(view.container.querySelector('[data-member-create-template-name]')?.textContent).toBe('Beta')
    expect(screen.getByText('新的委派会创建新实例。')).toBeTruthy()
    expect(view.container.querySelector<HTMLInputElement>('[data-member-create-label]')?.placeholder).toBe('例如：研究员-1')
    // No workspace feed → the field is hidden.
    expect(view.container.querySelector('[data-member-create-workspace]')).toBeNull()
    // The submit is disabled while the label is blank.
    expect(view.container.querySelector<HTMLButtonElement>('[data-member-create-submit]')?.disabled).toBe(true)
  })

  it('the create dialog submits member.create with the template delegation and the trimmed payload', async () => {
    const face = makeFace()
    const view = render(<TeamMembers {...makeProps(
      snapshot([instance({ instanceId: 'b', templateId: 'tpl-b', label: 'Beta' })]),
      face,
      [{ id: 'wsp-1', title: '工作区一', path: 'C:\\work\\one' }],
    )} />)
    fireEvent.click(createEntry(view.container))
    const label = view.container.querySelector<HTMLInputElement>('[data-member-create-label]')
    if (label === null) throw new Error('the create label input did not render')
    fireEvent.change(label, { target: { value: '  研究员-1  ' } })
    fireEvent.change(view.container.querySelector('[data-member-create-group]')!, { target: { value: ' g1 ' } })
    fireEvent.change(view.container.querySelector('[data-member-create-workspace]')!, { target: { value: 'C:\\work\\one' } })
    expect(view.container.querySelector<HTMLButtonElement>('[data-member-create-submit]')?.disabled).toBe(false)
    fireEvent.click(view.container.querySelector('[data-member-create-submit]')!)
    // The dialog closes; the command settles on the template key.
    expect(view.container.querySelector('[data-member-create-dialog]')).toBeNull()
    expect(face.memberCreate).toHaveBeenCalledTimes(1)
    expect(face.memberCreate).toHaveBeenCalledWith({
      teamSessionId: LEADER,
      caller: { kind: 'human', humanId: LEADER },
      requestToken: 'ui-1',
      delegationTemplateId: 'tpl-b',
      payload: { label: '研究员-1', groupId: 'g1', workspace: 'C:\\work\\one' },
    } satisfies RemoteMemberCreateParams)
    await vi.waitFor(() => {
      expect(face.pullProjection).toHaveBeenCalledTimes(1)
    })
  })

  it('a create failure notes on the template key and re-enables the "+" entry', async () => {
    const create = deferred()
    const face = makeFace({ memberCreate: vi.fn(() => create.promise) })
    const view = render(<TeamMembers {...makeProps(
      snapshot([instance({ instanceId: 'b', templateId: 'tpl-b', label: 'Beta' })]),
      face,
    )} />)
    fireEvent.click(createEntry(view.container))
    const label = view.container.querySelector<HTMLInputElement>('[data-member-create-label]')
    if (label === null) throw new Error('the create label input did not render')
    fireEvent.change(label, { target: { value: '研究员-1' } })
    fireEvent.click(view.container.querySelector('[data-member-create-submit]')!)
    // While the create is in flight, the "+" entry is disabled.
    expect(createEntry(view.container).disabled).toBe(true)
    await act(async () => {
      create.resolve(errorResponse('ADMISSION_REJECTED', 'label already in use', 'member.create', 'ui-1'))
    })
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-member-create-error]')).toBeTruthy()
    })
    expect(view.container.querySelector('[data-member-create-error]')?.textContent)
      .toBe('命令失败：ADMISSION_REJECTED: label already in use [ui-1]')
    expect(createEntry(view.container).disabled).toBe(false)
    expect(face.pullProjection).not.toHaveBeenCalled()
  })
})

/** A controllable promise (the mid-flight create assertion). */
function deferred(): {
  promise: Promise<RemoteResponse>
  resolve: (value: RemoteResponse) => void
} {
  let resolve!: (value: RemoteResponse) => void
  const promise = new Promise<RemoteResponse>(res => {
    resolve = res
  })
  return { promise, resolve }
}
