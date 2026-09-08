// @vitest-environment jsdom
/**
 * F9U (F3/F11/F9/T1.4 repair round r1, gate-review supplement 4) — the
 * TeamView's SERVED-VERSION probe and its gating of the control command
 * surface:
 *
 *  - the probe fires at most once per team session, ONLY when the
 *    control face is present AND a pending control request is loaded —
 *    and it calls `team.resolveControl` with the CLOSED side-effect-free
 *    params (the durable team session id + the empty `requestId` +
 *    `decision: 'allow'`: the v4 host fails the closed 1..255 token rule
 *    before any port work, the pre-v4 host never knows the method);
 *  - the typed probe outcomes gate the Events section's command
 *    surface: `malformed-params` (the v4 method was reached) → 'enabled'
 *    (the Allow / Deny commands go live); `unknown-method` (the pre-v4
 *    closed catalog) → 'read-only' (the detail panel stays, the commands
 *    do not, the localized read-only note explains why); a transport
 *    rejection (the ONLY rejection kind) → UNRESOLVED (fail-closed: no
 *    command affordance) and the probe re-runs on the next publish;
 *  - a team switch re-probes for the new team (the mode is per-team);
 *  - no face / no pending control → NO probe (zero remote calls).
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { buildRemoteError } from '../../remote/src/index.js'
import type {
  RemoteLedgerEntryValue, RemoteResponse, RemoteSafeJsonValue,
} from '../../remote/src/index.js'
import type { TeamProjectionMirror } from '../src/state/team-session-resolution.js'
import type { TeamLedgerState } from '../src/state/team-ledger-store.js'
import type { TeamProjectionDto } from '../../contracts/src/index.js'
import type { TeamPresetRow } from '../src/model/team-intent-model.js'
import type {
  RemoteCatalogGetParams,
} from '../../remote/src/index.js'
import {
  TeamView,
  type TeamViewCreationFace,
  type TeamViewControlFace,
  type TeamViewProps,
} from '../src/ui/TeamView.js'
import { zh } from '../src/ui/locales.js'

afterEach(cleanup)

const LEADER = 'team-leader'
const LEADER2 = 'team-leader-2'
const MEMBER = 'team-member'

const T = 1_700_000_000_000
const iso = (ms: number): string => new Date(ms).toISOString()

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

/** The v4 host's typed probe answer (the closed token rule fails FIRST — no port work). */
const V4_PROBE_ANSWER: RemoteResponse = buildRemoteError(
  'malformed-params',
  "method 'team.resolveControl' param field 'requestId' must be a string of 1..255 characters",
  {
    method: 'team.resolveControl',
    endpoint: 'team.resolveControl',
    contractVersion: 4,
    requestToken: null,
  },
  { field: 'requestId', reason: 'invalid-value' },
)

/** The pre-v4 build's typed probe answer (the v4-only method is not in its closed catalog). */
const V3_PROBE_ANSWER: RemoteResponse = buildRemoteError(
  'unknown-method',
  "endpoint 'team.resolveControl' is not a method of the closed Remote contract catalog",
  {
    method: 'team.resolveControl',
    endpoint: 'team.resolveControl',
    contractVersion: 3,
    requestToken: null,
  },
  { reason: 'unknown-endpoint' },
)

/** A happy-path creation face (the S5-A zero-state entry; unused by the team fixtures). */
function makeCreationFace(): TeamViewCreationFace {
  return {
    listCatalog: vi.fn(() => Promise.resolve(
      okResponse({ blueprints: [] }, 'catalog.list'),
    )),
    getCatalog: vi.fn((params: RemoteCatalogGetParams) => Promise.resolve(
      okResponse({ blueprint: { blueprintId: params.blueprintId, revision: 1 } }, 'catalog.get'),
    )),
    probeCompatibility: vi.fn(() => Promise.resolve(
      okResponse({ compatibility: { status: 'OPEN', requirements: [] } }, 'intent.probe'),
    )),
    teamCreateV2: vi.fn(() => Promise.resolve(okResponse({ path: 'root', durable: true, bind: {} }, 'team.create'))),
    teamAdmitInitialWorkV2: vi.fn(() => Promise.resolve(okResponse({ workOutcome: 'delivered' }, 'team.admitInitialWork'))),
    openCreatedSession: vi.fn(async () => undefined),
    listAgentPresets: vi.fn(() => Promise.resolve([] satisfies readonly TeamPresetRow[])),
  }
}

/** One wire member DTO row (plain object; `childSessionId` null = the leader). */
function wireMember(
  instanceId: string,
  childSessionId: string | null,
  lifecycle: 'CREATED' | 'RUNNING' | 'SETTLED' | 'ARCHIVED' | 'DISPOSED' = 'CREATED',
): Record<string, unknown> {
  return {
    instanceId,
    templateId: instanceId === 'lead' ? 'tpl-lead' : 'tpl-mate',
    label: instanceId,
    ...(childSessionId === null ? {} : { childSessionId }),
    workspace: 'wsp',
    createdAt: '2026-08-29T00:00:00.000Z',
    lifecycle,
    contextPolicy: 'persistent',
    effectiveConfig: { model: 'm', workspace: 'wsp', permissions: {}, autonomy: 'full' },
    liveActivity: null,
  }
}

const TEMPLATES: readonly Record<string, unknown>[] = [
  { kind: 'leader', templateId: 'tpl-lead', displayName: 'Lead', contextPolicy: 'persistent' },
  { kind: 'member', templateId: 'tpl-mate', displayName: 'Mate', contextPolicy: 'persistent' },
]

/** One minimal projection frame for the named team root. */
function frame(teamSessionId: string): TeamProjectionDto {
  return {
    schemaVersion: 1,
    teamSessionId,
    blueprint: { blueprintId: 'bp-1', revision: 1, contentHash: 'h-1' },
    generation: 1,
    generatedAt: '2026-08-29T00:00:00.000Z',
    root: { teamSessionId, createdAt: '2026-08-29T00:00:00.000Z', policyState: 'open' },
    templates: TEMPLATES,
    members: [wireMember('lead', null), wireMember('mate', MEMBER, 'RUNNING')],
    ledger: { latestSequence: 1, totalEntries: 1, byCategory: { control: 1 }, pendingControlCount: 1 },
  } as unknown as TeamProjectionDto
}

function mirrorOf(...frames: Array<[string, TeamProjectionDto]>): TeamProjectionMirror {
  const plain: Record<string, TeamProjectionDto> = {}
  for (const [key, value] of frames) plain[key] = value
  return plain as unknown as TeamProjectionMirror
}

/** The ONE pending control-request entry for the named team root. */
function pendingControlEntry(rootSessionId: string): RemoteLedgerEntryValue {
  return {
    schemaVersion: 1,
    sequence: 1,
    rootSessionId,
    factType: 'control-request-recorded',
    operationId: null,
    createdAt: iso(T),
    payload: {
      requestId: 'r1',
      kind: 'user-approval',
      requester: { kind: 'instance', instanceId: 'mate' },
      targetInstanceId: 'mate',
      actionName: 'write_file',
      toolName: 'file',
      summary: 'needs write access',
    },
  } as unknown as RemoteLedgerEntryValue
}

/** One published ledger-store state over the named team's loaded facts (known complete). */
function ledgerState(rootSessionId: string, entries: readonly RemoteLedgerEntryValue[]): TeamLedgerState {
  const entriesBySequence = new Map<number, RemoteLedgerEntryValue>()
  for (const item of entries) entriesBySequence.set(item.sequence, item)
  const last = entries[entries.length - 1]
  return {
    teamSessionId: rootSessionId,
    entriesBySequence,
    orderedSequences: entries.map(item => item.sequence),
    total: entries.length,
    completeThrough: last === undefined ? 0 : last.sequence,
    loading: false,
  }
}

const bar = (view: ReturnType<typeof render>): HTMLElement | null =>
  view.container.querySelector('[data-ledger-resolve-bar]')

/**
 * The projection-only view props + the injected faces: the two
 * ObservableSnapshot hooks and the cold-pull / ledger-refresh /
 * navigation callbacks (the same fixture shape as
 * `team-view.client.spec.tsx`).
 */
function viewProps(
  projectionMirror: TeamProjectionMirror,
  sessionId: string,
  teamLedgers: Readonly<Record<string, TeamLedgerState>>,
  control: TeamViewControlFace | undefined,
): TeamViewProps {
  const base: TeamViewProps = {
    sessionId: sessionId as TeamViewProps['sessionId'],
    useSession: (() => undefined) as TeamViewProps['useSession'],
    useProjection: () => undefined,
    useInput: () => { throw new Error('unused') },
    inputActions: { setDraft: () => {}, submit: () => {} } as unknown as TeamViewProps['inputActions'],
    useSessions: () => { throw new Error('unused') },
    useWorkspaces: (() => undefined) as TeamViewProps['useWorkspaces'],
    useProjectionMirror: selector => selector(projectionMirror),
    useTeamLedgers: selector => selector(teamLedgers),
    ensureProjection: vi.fn(() => Promise.resolve()),
    pullProjection: vi.fn(() => Promise.resolve()),
    refreshTeamLedger: vi.fn(() => Promise.resolve()),
    openSession: vi.fn(),
    t: makeTranslate(zh),
    viewRequest: null,
    openView: () => {},
    completeViewRequest: () => {},
    useConversation: (() => undefined) as TeamViewProps['useConversation'],
    useChat: (() => undefined) as TeamViewProps['useChat'],
    useSessionPendingInteraction: (() => undefined) as TeamViewProps['useSessionPendingInteraction'],
    creation: makeCreationFace(),
    ...(control === undefined ? {} : { control }),
  }
  return base
}

describe('F9U supplement 4 — the TeamView served-version probe', () => {
  it('probes the served host with the CLOSED side-effect-free params and enables the commands when v4 serves', async () => {
    const resolveControl = vi.fn(async () => V4_PROBE_ANSWER)
    const control: TeamViewControlFace = { resolveControl }
    const view = render(
      <TeamView
        {...viewProps(
          mirrorOf([LEADER, frame(LEADER)]),
          LEADER,
          { [LEADER]: ledgerState(LEADER, [pendingControlEntry(LEADER)]) },
          control,
        )}
      />,
    )
    await vi.waitFor(() => {
      expect(bar(view)?.getAttribute('data-control-surface')).toBe('enabled')
    })
    // The probe fired EXACTLY ONCE (one-shot per team session) with the
    // closed params: the durable team session id, the empty requestId
    // (the 1..255 token rule fails before any port work), decision
    // 'allow' (never observed on the wire as a real flight).
    expect(resolveControl).toHaveBeenCalledTimes(1)
    expect(resolveControl).toHaveBeenCalledWith({
      teamSessionId: LEADER,
      requestId: '',
      decision: 'allow',
    })
    // The commands went live (the closed kind grants the human).
    expect(bar(view)?.querySelector('[data-ledger-resolve-allow]')).not.toBeNull()
    expect(bar(view)?.querySelector('[data-ledger-resolve-deny]')).not.toBeNull()
    expect(bar(view)?.querySelector('[data-control-surface-read-only]')).toBeNull()
  })

  it('keeps the panel but HIDES the commands + shows the read-only note when the served build is pre-v4 (unknown-method)', async () => {
    const resolveControl = vi.fn(async () => V3_PROBE_ANSWER)
    const view = render(
      <TeamView
        {...viewProps(
          mirrorOf([LEADER, frame(LEADER)]),
          LEADER,
          { [LEADER]: ledgerState(LEADER, [pendingControlEntry(LEADER)]) },
          { resolveControl },
        )}
      />,
    )
    await vi.waitFor(() => {
      expect(bar(view)?.getAttribute('data-control-surface')).toBe('read-only')
    })
    expect(resolveControl).toHaveBeenCalledTimes(1)
    // The detail panel stays visible (the pending state is shown)…
    const panel = bar(view)
    if (panel === null) throw new Error('the control panel did not render')
    expect(panel.querySelector('[data-control-detail-requester]')).not.toBeNull()
    expect(panel.querySelector('[data-control-detail-status]')).not.toBeNull()
    // …the commands do NOT (the v3 surface is read-only)…
    expect(panel.querySelector('[data-ledger-resolve-allow]')).toBeNull()
    expect(panel.querySelector('[data-ledger-resolve-deny]')).toBeNull()
    // …and the localized read-only note explains why.
    expect(panel.querySelector('[data-control-surface-read-only]')?.textContent)
      .toBe('当前宿主未提供 v4 人工控制裁决，此面板为只读。')
  })

  it('FAILS CLOSED on a transport rejection (unresolved mode: panel yes, commands no) and RE-PROBES on the next publish', async () => {
    // Phase 1: the channel loss (the ONLY rejection kind) leaves the
    // mode unresolved — no command affordance, no read-only note.
    const resolveControlLost = vi.fn(async (): Promise<RemoteResponse> => {
      throw new Error('boom: the channel was lost')
    })
    const view = render(
      <TeamView
        {...viewProps(
          mirrorOf([LEADER, frame(LEADER)]),
          LEADER,
          { [LEADER]: ledgerState(LEADER, [pendingControlEntry(LEADER)]) },
          { resolveControl: resolveControlLost },
        )}
      />,
    )
    await vi.waitFor(() => {
      expect(bar(view)?.getAttribute('data-control-surface')).toBe('unresolved')
    })
    expect(resolveControlLost).toHaveBeenCalledTimes(1)
    const panel = bar(view)
    if (panel === null) throw new Error('the control panel did not render')
    expect(panel.querySelector('[data-ledger-resolve-allow]')).toBeNull()
    expect(panel.querySelector('[data-control-surface-read-only]')).toBeNull()

    // Phase 2: the next publish re-runs the probe (the ledger store
    // re-published the same facts under a fresh state identity) — this
    // time the channel answers: v4 serves.
    const resolveControlV4 = vi.fn(async () => V4_PROBE_ANSWER)
    view.rerender(
      <TeamView
        {...viewProps(
          mirrorOf([LEADER, frame(LEADER)]),
          LEADER,
          { [LEADER]: ledgerState(LEADER, [pendingControlEntry(LEADER)]) },
          { resolveControl: resolveControlV4 },
        )}
      />,
    )
    await vi.waitFor(() => {
      expect(bar(view)?.getAttribute('data-control-surface')).toBe('enabled')
    })
    expect(resolveControlV4).toHaveBeenCalledTimes(1)
    expect(bar(view)?.querySelector('[data-ledger-resolve-allow]')).not.toBeNull()
  })

  it('re-probes for the NEW team on a team switch (the mode is per-team, never cross-applied)', async () => {
    const resolveControl = vi.fn(async (params: { teamSessionId: string }) =>
      params.teamSessionId === LEADER ? V4_PROBE_ANSWER : V3_PROBE_ANSWER)
    const ledgers: Readonly<Record<string, TeamLedgerState>> = {
      [LEADER]: ledgerState(LEADER, [pendingControlEntry(LEADER)]),
      [LEADER2]: ledgerState(LEADER2, [pendingControlEntry(LEADER2)]),
    }
    const view = render(
      <TeamView
        {...viewProps(
          mirrorOf([LEADER, frame(LEADER)], [LEADER2, frame(LEADER2)]),
          LEADER,
          ledgers,
          { resolveControl },
        )}
      />,
    )
    await vi.waitFor(() => {
      expect(bar(view)?.getAttribute('data-control-surface')).toBe('enabled')
    })
    expect(resolveControl).toHaveBeenCalledTimes(1)

    // Switch to the second team (its root is the pre-v4 build): a NEW
    // probe fires for LEADER2, and the surface goes read-only.
    view.rerender(
      <TeamView
        {...viewProps(
          mirrorOf([LEADER, frame(LEADER)], [LEADER2, frame(LEADER2)]),
          LEADER2,
          ledgers,
          { resolveControl },
        )}
      />,
    )
    await vi.waitFor(() => {
      expect(bar(view)?.getAttribute('data-control-surface')).toBe('read-only')
    })
    expect(resolveControl).toHaveBeenCalledTimes(2)
    expect(resolveControl).toHaveBeenLastCalledWith({
      teamSessionId: LEADER2,
      requestId: '',
      decision: 'allow',
    })
    expect(bar(view)?.querySelector('[data-ledger-resolve-allow]')).toBeNull()
  })

  it('probes NOTHING without the control face (the legacy surface is unchanged)', async () => {
    const view = render(
      <TeamView
        {...viewProps(
          mirrorOf([LEADER, frame(LEADER)]),
          LEADER,
          { [LEADER]: ledgerState(LEADER, [pendingControlEntry(LEADER)]) },
          undefined,
        )}
      />,
    )
    // Give any (wrong) probe a tick to fire.
    await new Promise(resolve => {
      setTimeout(resolve, 20)
    })
    // No face → no panel at all (the F9 invariant) and no remote calls.
    expect(bar(view)).toBeNull()
  })

  it('probes NOTHING when no pending control is loaded (the probe rides the pending state)', async () => {
    const resolveControl = vi.fn(async () => V4_PROBE_ANSWER)
    const view = render(
      <TeamView
        {...viewProps(
          mirrorOf([LEADER, frame(LEADER)]),
          LEADER,
          { [LEADER]: ledgerState(LEADER, []) },
          { resolveControl },
        )}
      />,
    )
    await new Promise(resolve => {
      setTimeout(resolve, 20)
    })
    expect(resolveControl).toHaveBeenCalledTimes(0)
    expect(bar(view)).toBeNull()
  })
})
