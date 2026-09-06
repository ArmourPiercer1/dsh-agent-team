// @vitest-environment jsdom
/**
 * D4-A1 (Team D1–D6 repair v2) — every EXISTING Team UI mutation callback
 * refreshes the projection via the existing `pullProjection` (the
 * generation-safe pull; no push, no events, no polling), so a UI-initiated
 * mutation updates without F5.
 *
 * The two GAP paths this file closes (RED before the fix, GREEN after):
 *   - the standard two-stage create flow (`team.create` v2 → open Root →
 *     `team.admitInitialWork` v2): its terminal success previously
 *     refreshed nothing — the new team's mirror relied on the new
 *     session's TeamView cold-pull alone;
 *   - the `handoff.create` command (the `completed` /
 *     `completed-without-handoff` stored states): the same gap.
 * The pull targets the NEW team's id (invariant 9: the minted Root session
 * id IS the TeamSession id) and is fire-and-forget: the store settles
 * typed failures into its own state and never rejects, so a failed pull can
 * never break the success lane.
 *
 * Representative guards for the already-covered paths (the S5-B member
 * lifecycle commands and the S5-C governance commands pull EXACTLY ONCE on
 * success and NEVER on a typed failure) are included so the full
 * create/lifecycle/governance matrix is pinned in one place.
 *
 * Boundary: Agent/tool-originated mutations are NOT covered by D4-A1 (they
 * bypass every React callback; D4-A2 design item) — this file proves
 * nothing about them and must not be read as a live-projection guarantee.
 */
import { cleanup, fireEvent, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  RemoteResponse,
  RemoteSafeJsonValue,
} from '../../remote/src/index.js'
import type {
  TeamUiDisplayStatus, TeamUiMemberInstance, TeamUiSnapshot,
} from '../src/model/team-ui-snapshot.js'
import type { TeamUiLedgerModel } from '../src/model/team-ui-snapshot.js'
import type { TeamIntentDraft } from '../src/model/team-intent-model.js'
import { emptyTeamIntentDraft } from '../src/model/team-intent-model.js'
import { TeamCreationPanel } from '../src/ui/TeamCreationPanel.js'
import { TeamMembers, type TeamMembersCommandFace } from '../src/ui/TeamMembers.js'
import { TeamGovernance, type TeamGovernanceFace } from '../src/ui/TeamGovernance.js'
import { zh } from '../src/ui/locales.js'

// ---------------------------------------------------------------------------
// Wire fixtures (the closed provenance-bearing envelope shapes)
// ---------------------------------------------------------------------------

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
function errorResponse(
  code: string,
  message: string,
  method: string,
  requestToken: string | null,
): RemoteResponse {
  return {
    ok: false,
    error: {
      code, message,
      details: { method, endpoint: method, contractVersion: 1, requestToken },
    },
  }
}

// ---------------------------------------------------------------------------
// Creation panel fixtures
// ---------------------------------------------------------------------------

const BP = 'bp-1'

/** The frozen catalog wire payload (one blueprint, two revisions). */
const CATALOG_DATA = { blueprints: [{ blueprintId: BP, revisions: [1, 2] }] }

/** The frozen catalog detail wire payload (the §6 display block). */
const DETAIL_DATA = {
  blueprint: {
    blueprintId: BP,
    revision: 2,
    displayName: 'Atlas',
    description: 'Atlas blueprint',
    metadata: { source: 'builtin' },
    members: [{ templateId: 'tpl-lead' }],
  },
}

/** An OPEN probe verdict (PASS rows are skipped by the parser). */
const OPEN_DATA = {
  compatibility: {
    status: 'OPEN',
    requirements: [{ outcome: 'PASS', requirementId: 'req-1', unavailableSubjects: [], detail: 'ok', complete: false }],
  },
}

interface PanelHarnessProps {
  /** The scripted `team.create` v2 response. */
  createResponse: RemoteResponse
  /** The scripted `team.admitInitialWork` v2 response. */
  admitResponse: RemoteResponse
  /** The creation-path session open (default: resolves immediately). */
  openCreatedSession?: (sessionId: string) => Promise<void>
  /** The D4-A1 pull spy (absent → the prop is NOT passed, back-compat path). */
  pullProjection?: (teamSessionId: string) => Promise<unknown>
  /** The terminal-success spy. */
  onCreatedSpy?: () => void
  /** The handoff source + face (absent → the panel is the T7 surface). */
  handoff?: {
    readonly sourceSessionId: string
    readonly createResponse: RemoteResponse
  }
}

/** The scripted New Team panel (the parent-held draft mirrors TeamView). */
function PanelHarness(props: PanelHarnessProps) {
  const [draft, setDraft] = useState<TeamIntentDraft>(emptyTeamIntentDraft)
  // Captured locally so the callback closures below keep the narrowing
  // (the optional handoff / pullProjection props are absent → no block).
  const handoff = props.handoff
  const pull = props.pullProjection
  const handoffProps = handoff === undefined
    ? {}
    : {
        handoffSource: {
          sourceSessionId: handoff.sourceSessionId,
          sourceWorkspaceId: null,
        },
        handoffFace: {
          prepare: vi.fn(() => Promise.resolve(okResponse(null, 'handoff.prepare'))),
          create: vi.fn(() => Promise.resolve(handoff.createResponse)),
        },
      }
  const pullProps = pull === undefined ? {} : { pullProjection: pull }
  return (
    <TeamCreationPanel
      listCatalog={vi.fn(() => Promise.resolve(okResponse(CATALOG_DATA, 'catalog.list')))}
      getCatalog={vi.fn(() => Promise.resolve(okResponse(DETAIL_DATA, 'catalog.get')))}
      probeCompatibility={vi.fn(() => Promise.resolve(okResponse(OPEN_DATA, 'intent.probe')))}
      teamCreateV2={vi.fn(() => Promise.resolve(props.createResponse))}
      teamAdmitInitialWorkV2={vi.fn(() => Promise.resolve(props.admitResponse))}
      openCreatedSession={props.openCreatedSession ?? (async () => undefined)}
      onCreated={props.onCreatedSpy}
      listAgentPresets={vi.fn(() => Promise.resolve([]))}
      workspaces={[]}
      draft={draft}
      onDraftChange={setDraft}
      onCancel={() => undefined}
      t={makeTranslate(zh)}
      {...handoffProps}
      {...pullProps}
    />
  )
}

function blueprintSelect(container: HTMLElement): HTMLSelectElement {
  const el = container.querySelector<HTMLSelectElement>('[data-intent-blueprint]')
  if (el === null) throw new Error('the blueprint select did not render')
  return el
}

/** Select the blueprint (after the catalog load) and wait for the OPEN probe verdict (gate open). */
async function openGate(container: HTMLElement): Promise<void> {
  await vi.waitFor(() => {
    expect(blueprintSelect(container).disabled).toBe(false)
  })
  fireEvent.change(blueprintSelect(container), { target: { value: BP } })
  await vi.waitFor(() => {
    expect(container.querySelector<HTMLElement>('[data-intent-compatibility]')?.dataset.intentStatus)
      .toBe('OPEN')
  })
}

function createButton(container: HTMLElement): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>('[data-intent-create]')
  if (el === null) throw new Error('the create button did not render')
  return el
}

// ---------------------------------------------------------------------------
// Member lifecycle / governance fixtures (the S5-B/S5-C shapes)
// ---------------------------------------------------------------------------

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

function teamSnapshot(members: readonly TeamUiMemberInstance[]): TeamUiSnapshot {
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

function emptyLedger(): TeamUiLedgerModel {
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

/** The S5-B command face (every member a spy; the defaults are the happy path). */
function makeMemberFace(overrides: Partial<TeamMembersCommandFace> = {}): TeamMembersCommandFace {
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

function memberProps(
  team: TeamUiSnapshot,
  face: TeamMembersCommandFace,
): Parameters<typeof TeamMembers>[0] {
  return {
    snapshot: team,
    ledger: emptyLedger(),
    currentSessionId: LEADER,
    onSelectSession: vi.fn(),
    memberCommands: face,
    t: makeTranslate(zh),
  }
}

/** The action buttons of one instance row, in cluster order. */
function rowActions(container: HTMLElement, status: TeamUiDisplayStatus): HTMLButtonElement[] {
  const row = container.querySelector(`[data-member-instance][data-status="${status}"]`)
  if (row === null) throw new Error(`the ${status} instance row did not render`)
  return [...row.querySelectorAll<HTMLButtonElement>('[data-member-action-button]')]
}

/** The S5-C governance face (every member a spy; the defaults are the happy path). */
function makeGovernanceFace(overrides: Partial<TeamGovernanceFace> = {}): TeamGovernanceFace {
  return {
    compatibilityGet: vi.fn(() => Promise.resolve(okResponse(null, 'compatibility.get'))),
    compatibilityAck: vi.fn(() => Promise.resolve(okResponse(null, 'compatibility.ack'))),
    compatibilityReprobe: vi.fn(() => Promise.resolve(okResponse(null, 'compatibility.reprobe'))),
    policyStateGet: vi.fn(() => Promise.resolve(okResponse(null, 'policyState.get'))),
    policyStateSet: vi.fn(() => Promise.resolve(okResponse(null, 'policyState.set'))),
    overrideGet: vi.fn(() => Promise.resolve(okResponse(null, 'override.get'))),
    overrideSet: vi.fn(() => Promise.resolve(okResponse(null, 'override.set'))),
    overrideReset: vi.fn(() => Promise.resolve(okResponse(null, 'override.reset'))),
    pullProjection: vi.fn(() => Promise.resolve(null)),
    ...overrides,
  }
}

function governanceButton(container: HTMLElement, selector: string): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>(selector)
  if (el === null) throw new Error(`the ${selector} button did not render`)
  return el
}

afterEach(cleanup)

// ---------------------------------------------------------------------------
// D4-A1 — the standard two-stage create flow (the GAP path)
// ---------------------------------------------------------------------------

describe('D4-A1 — standard create flow (UI-initiated mutation)', () => {
  it('terminal success (with initial work) pulls the NEW team projection exactly once', async () => {
    const pullProjection = vi.fn(async (_teamSessionId: string) => undefined)
    const onCreatedSpy = vi.fn()
    const opened: string[] = []
    const view = render(<PanelHarness
      createResponse={okResponse(null, 'team.create')}
      admitResponse={okResponse(null, 'team.admitInitialWork')}
      openCreatedSession={async (id) => { opened.push(id) }}
      pullProjection={pullProjection}
      onCreatedSpy={onCreatedSpy}
    />)
    await openGate(view.container)
    fireEvent.change(view.container.querySelector('[data-intent-initial-work]')!, {
      target: { value: 'start the review' },
    })
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(onCreatedSpy).toHaveBeenCalledTimes(1)
    })
    // The pull fired for the minted root (invariant 9: root id IS the team
    // id) — exactly once, targeting the opened root.
    expect(pullProjection).toHaveBeenCalledTimes(1)
    const pulled = pullProjection.mock.calls[0]?.[0] ?? ''
    expect(pulled).toMatch(/^session-/)
    expect(opened).toEqual([pulled])
  })

  it('terminal success (create-only, no initial work) pulls exactly once', async () => {
    const pullProjection = vi.fn(() => Promise.resolve(null))
    const onCreatedSpy = vi.fn()
    const view = render(<PanelHarness
      createResponse={okResponse(null, 'team.create')}
      admitResponse={okResponse(null, 'team.admitInitialWork')}
      pullProjection={pullProjection}
      onCreatedSpy={onCreatedSpy}
    />)
    await openGate(view.container)
    // No initial work typed: the flow is terminal after create + open.
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(onCreatedSpy).toHaveBeenCalledTimes(1)
    })
    expect(pullProjection).toHaveBeenCalledTimes(1)
    expect(pullProjection).toHaveBeenCalledWith(expect.stringMatching(/^session-/))
  })

  it('a typed create-stage failure does NOT pull', async () => {
    const pullProjection = vi.fn(() => Promise.resolve(null))
    const onCreatedSpy = vi.fn()
    const view = render(<PanelHarness
      createResponse={errorResponse('TEAM_CREATE_REJECTED', 'blueprint gone', 'team.create', null)}
      admitResponse={okResponse(null, 'team.admitInitialWork')}
      pullProjection={pullProjection}
      onCreatedSpy={onCreatedSpy}
    />)
    await openGate(view.container)
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector<HTMLElement>('[data-intent-create-error]')?.dataset.intentCreateErrorStage)
        .toBe('create')
    })
    expect(pullProjection).not.toHaveBeenCalled()
    expect(onCreatedSpy).not.toHaveBeenCalled()
  })

  it('a typed work-stage (admit) failure does NOT pull (the Root stays open, the lane retries)', async () => {
    const pullProjection = vi.fn(() => Promise.resolve(null))
    const onCreatedSpy = vi.fn()
    const view = render(<PanelHarness
      createResponse={okResponse(null, 'team.create')}
      admitResponse={errorResponse('ADMISSION_REJECTED', 'policy closed', 'team.admitInitialWork', 'team-work-1')}
      pullProjection={pullProjection}
      onCreatedSpy={onCreatedSpy}
    />)
    await openGate(view.container)
    fireEvent.change(view.container.querySelector('[data-intent-initial-work]')!, {
      target: { value: 'start the review' },
    })
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector<HTMLElement>('[data-intent-create-error]')?.dataset.intentCreateErrorStage)
        .toBe('work')
    })
    expect(pullProjection).not.toHaveBeenCalled()
    expect(onCreatedSpy).not.toHaveBeenCalled()
  })

  it('without the pullProjection prop the success flow still settles (back-compat)', async () => {
    const onCreatedSpy = vi.fn()
    const view = render(<PanelHarness
      createResponse={okResponse(null, 'team.create')}
      admitResponse={okResponse(null, 'team.admitInitialWork')}
      onCreatedSpy={onCreatedSpy}
    />)
    await openGate(view.container)
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(onCreatedSpy).toHaveBeenCalledTimes(1)
    })
  })
})

// ---------------------------------------------------------------------------
// D4-A1 — the handoff.create command (the GAP path)
// ---------------------------------------------------------------------------

describe('D4-A1 — handoff.create (UI-initiated mutation)', () => {
  it('a stored `completed` state pulls the NEW team projection exactly once', async () => {
    const pullProjection = vi.fn(() => Promise.resolve(null))
    const opened: string[] = []
    const view = render(<PanelHarness
      createResponse={okResponse(null, 'team.create')}
      admitResponse={okResponse(null, 'team.admitInitialWork')}
      openCreatedSession={async (id) => { opened.push(id) }}
      pullProjection={pullProjection}
      handoff={{
        sourceSessionId: 'sa-source',
        createResponse: okResponse({
          state: {
            kind: 'completed', replayed: false,
            team: { teamSessionId: 'team-h', rootSessionId: 'root-h' },
          },
        }, 'handoff.create'),
      }}
    />)
    await openGate(view.container)
    // The handoff is on by default: the create click routes to handoff.create.
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(pullProjection).toHaveBeenCalledTimes(1)
    })
    expect(pullProjection).toHaveBeenCalledWith('root-h')
    expect(opened).toEqual(['root-h'])
  })

  it('a stored `completed-without-handoff` state pulls exactly once', async () => {
    const pullProjection = vi.fn(() => Promise.resolve(null))
    const view = render(<PanelHarness
      createResponse={okResponse(null, 'team.create')}
      admitResponse={okResponse(null, 'team.admitInitialWork')}
      pullProjection={pullProjection}
      handoff={{
        sourceSessionId: 'sa-source',
        createResponse: okResponse({
          state: {
            kind: 'completed-without-handoff', replayed: false,
            team: { teamSessionId: 'team-h2', rootSessionId: 'root-h2' },
          },
        }, 'handoff.create'),
      }}
    />)
    await openGate(view.container)
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(pullProjection).toHaveBeenCalledTimes(1)
    })
    expect(pullProjection).toHaveBeenCalledWith('root-h2')
  })

  it('a typed handoff.create response failure does NOT pull', async () => {
    const pullProjection = vi.fn(() => Promise.resolve(null))
    const view = render(<PanelHarness
      createResponse={okResponse(null, 'team.create')}
      admitResponse={okResponse(null, 'team.admitInitialWork')}
      pullProjection={pullProjection}
      handoff={{
        sourceSessionId: 'sa-source',
        createResponse: errorResponse('SOURCE_UNAVAILABLE', 'source gone', 'handoff.create', 'handoff-1'),
      }}
    />)
    await openGate(view.container)
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-handoff-failed-code]')).toBeTruthy()
    })
    expect(pullProjection).not.toHaveBeenCalled()
  })

  it('a stored `creation-failed` state does NOT pull', async () => {
    const pullProjection = vi.fn(() => Promise.resolve(null))
    const view = render(<PanelHarness
      createResponse={okResponse(null, 'team.create')}
      admitResponse={okResponse(null, 'team.admitInitialWork')}
      pullProjection={pullProjection}
      handoff={{
        sourceSessionId: 'sa-source',
        createResponse: okResponse({
          state: {
            kind: 'creation-failed', replayed: false,
            failure: { code: 'SUMMARIZE_FAILED', message: 'source read failed' },
          },
        }, 'handoff.create'),
      }}
    />)
    await openGate(view.container)
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-handoff-failed-code]')).toBeTruthy()
    })
    expect(pullProjection).not.toHaveBeenCalled()
  })

  it('a stored `awaiting-decision` state does NOT pull (no team exists yet)', async () => {
    const pullProjection = vi.fn(() => Promise.resolve(null))
    const view = render(<PanelHarness
      createResponse={okResponse(null, 'team.create')}
      admitResponse={okResponse(null, 'team.admitInitialWork')}
      pullProjection={pullProjection}
      handoff={{
        sourceSessionId: 'sa-source',
        createResponse: okResponse({
          state: {
            kind: 'awaiting-decision', replayed: false,
            failure: { code: 'POLICY_HOLD', message: 'org policy hold' },
            options: ['retry', 'continue-without-handoff', 'cancel'],
          },
        }, 'handoff.create'),
      }}
    />)
    await openGate(view.container)
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-handoff-failed-code]')).toBeTruthy()
    })
    expect(pullProjection).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Representative already-covered paths (the S5-B / S5-C guards)
// ---------------------------------------------------------------------------

describe('D4-A1 — representative already-covered paths', () => {
  it('a member lifecycle command success pulls exactly once (archive)', async () => {
    const face = makeMemberFace()
    const view = render(<TeamMembers {...memberProps(
      teamSnapshot([
        instance({
          instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
          lifecycle: LIFECYCLE.settled, displayStatus: 'settled',
        }),
      ]),
      face,
    )} />)
    fireEvent.click(rowActions(view.container, 'settled')[2]!) // archive
    fireEvent.click(view.container.querySelector('[data-member-confirm-ok]')!)
    await vi.waitFor(() => {
      expect(face.pullProjection).toHaveBeenCalledTimes(1)
    })
    expect(face.pullProjection).toHaveBeenCalledWith(LEADER)
  })

  it('a member lifecycle command typed failure does NOT pull (dispose)', async () => {
    const face = makeMemberFace({
      memberDispose: vi.fn(() => Promise.resolve(
        errorResponse('LIFECYCLE_INVALID', 'already disposed', 'member.dispose', 'ui-1'),
      )),
    })
    const view = render(<TeamMembers {...memberProps(
      teamSnapshot([
        instance({
          instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
          lifecycle: LIFECYCLE.running, displayStatus: 'running',
        }),
      ]),
      face,
    )} />)
    fireEvent.click(rowActions(view.container, 'running')[3]!) // dispose
    fireEvent.click(view.container.querySelector('[data-member-confirm-ok]')!)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-member-command-error]')).toBeTruthy()
    })
    expect(face.pullProjection).not.toHaveBeenCalled()
  })

  it('a governance policy commit success pulls exactly once', async () => {
    const face = makeGovernanceFace({
      policyStateGet: vi.fn(() => Promise.resolve(okResponse({
        stateId: 'open',
        cells: { tools: { locked: false } },
      }, 'policyState.get'))),
    })
    const view = render(<TeamGovernance
      snapshot={teamSnapshot([])}
      governance={face}
      t={makeTranslate(zh)}
    />)
    fireEvent.click(governanceButton(view.container, '[data-governance-policy-review]'))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-governance-policy-cells]')).toBeTruthy()
    })
    // Editing a cell is NOT a mutation: review + draft do not pull.
    const toolsKind = view.container.querySelector<HTMLSelectElement>(
      '[data-governance-policy-cell="tools"] [data-governance-policy-cell-kind]',
    )
    if (toolsKind === null) throw new Error('the tools kind select did not render')
    fireEvent.change(toolsKind, { target: { value: 'deny' } })
    expect(face.pullProjection).not.toHaveBeenCalled()
    fireEvent.click(governanceButton(view.container, '[data-governance-policy-commit]'))
    await vi.waitFor(() => {
      expect(face.pullProjection).toHaveBeenCalledTimes(1)
    })
    expect(face.pullProjection).toHaveBeenCalledWith(LEADER)
  })

  it('a governance policy commit typed failure does NOT pull', async () => {
    const face = makeGovernanceFace({
      policyStateGet: vi.fn(() => Promise.resolve(okResponse({
        stateId: 'open',
        cells: { tools: { locked: false } },
      }, 'policyState.get'))),
      policyStateSet: vi.fn(() => Promise.resolve(
        errorResponse('POLICY_INVALID', 'unknown capability', 'policyState.set', 'governance-1'),
      )),
    })
    const view = render(<TeamGovernance
      snapshot={teamSnapshot([])}
      governance={face}
      t={makeTranslate(zh)}
    />)
    fireEvent.click(governanceButton(view.container, '[data-governance-policy-review]'))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-governance-policy-cells]')).toBeTruthy()
    })
    const toolsKind = view.container.querySelector<HTMLSelectElement>(
      '[data-governance-policy-cell="tools"] [data-governance-policy-cell-kind]',
    )
    if (toolsKind === null) throw new Error('the tools kind select did not render')
    fireEvent.change(toolsKind, { target: { value: 'deny' } })
    fireEvent.click(governanceButton(view.container, '[data-governance-policy-commit]'))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-governance-policy-error]')).toBeTruthy()
    })
    expect(face.pullProjection).not.toHaveBeenCalled()
  })
})
