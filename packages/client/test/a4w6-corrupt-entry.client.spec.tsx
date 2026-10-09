// @vitest-environment jsdom
/**
 * a4w6-corrupt-entry.client.spec.tsx — A4-W6 (client render layer): a
 * control-ledger entry the STRICT SERVER-SIDE reader refused (named by the
 * v9 corrupt-leg read) is rendered TRUTHFULLY and offers NO adjudication —
 * while normal pending entries are untouched.
 *
 * THE DEFECT (owner ruling 2026-10-09): a refused row is counted pending
 * by the old host fold and the Events surface rendered it with a clickable
 * DENY (Allow was already disabled for the `unsupported-subject` shape the
 * tolerant adapter happened to classify it into). Clicking it answers
 * `CONTROL_REQUEST_NOT_FOUND` — the refusal itself is the design, so the
 * clickable button was an invitation to a guaranteed error.
 *
 * THE RENDER RULE pinned here:
 *  - the join is by LEDGER SEQUENCE (the corrupt leg carries it; it may
 *    carry NO readable requestId — a requestId join would drop exactly the
 *    worst rows);
 *  - a corrupt entry STAYS VISIBLE with the honest marker (locale
 *    `view.corruption.entryCorrupt`: zh 损坏 · 不可裁决 / en
 *    "corrupt record — cannot be adjudicated" — deliberately NOT "失效",
 *    which would conflate abandonment / stale-denial);
 *  - BOTH the Allow and the Deny commands are DISABLED (the buttons stay,
 *    inert; the entry is never silently dropped);
 *  - the pre-existing `unsupported-subject` class gets the SAME Deny
 *    treatment WITHOUT any corruption read (the server refuses those rows
 *    too — so a pre-v9 host without the corrupt-leg read plane behaves
 *    consistently);
 *  - a corrupt row with an UNREADABLE requestId (no control chain at all —
 *    the adapter cannot even name it) is still marked, because the marking
 *    is the row-level sequence join, not the chain-level panel;
 *  - normal pending rows keep the pending badge, the live commands, and no
 *    marker (the negative control at every layer).
 *
 * Layer 1 mounts `TeamLedger` directly over the REAL adapter pipeline (the
 * pr56 spec's harness: wire rows → `adaptTeamLedger` → the section).
 * Layer 2 mounts `TeamView` with the v9 corrupt-leg face (a4w4's harness)
 * so the SEQUENCE set reaches the ledger through the production wiring —
 * the corrupt leg it answers carries `sequence` only, no requestId.
 *
 * W4's `planControlCorruptionRender` behaviour (bar / neutral notice) is
 * asserted only as NON-REGRESSION here; its semantics belong to W4.
 *
 * @module @dsh-agent-team/client/test/a4w6-corrupt-entry
 */
import { cleanup, render, waitFor } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TeamProjectionMirror } from '../src/state/team-session-resolution.js'
import type { TeamProjectionDto } from '../../contracts/src/index.js'
import type {
  RemoteLedgerEntryValue, RemoteResponse, RemoteSafeJsonValue,
  RemoteTeamResolveControlParams,
} from '../../remote/src/index.js'
import type { TeamLedgerState } from '../src/state/team-ledger-store.js'
import type { TeamUiLedgerModel, TeamUiSnapshot } from '../src/model/team-ui-snapshot.js'
import { adaptTeamLedger } from '../src/model/ledger-adapter.js'
import { TeamLedger, type TeamLedgerProps } from '../src/ui/TeamLedger.js'
import { TeamView, type TeamViewControlFace, type TeamViewProps } from '../src/ui/TeamView.js'
import { en, zh } from '../src/ui/locales.js'

const LEADER = 'team-leader'
const T = 1_700_000_000_000
const MARKER_ZH = '损坏 · 不可裁决'
const MARKER_EN = 'corrupt record — cannot be adjudicated'

afterEach(cleanup)

// ---------------------------------------------------------------------------
// Layer 1 — TeamLedger over the real adapter pipeline (pr56 harness).
// ---------------------------------------------------------------------------

const snapshot = {
  teamSessionId: LEADER,
  generation: 1,
  templates: [
    { kind: 'leader', templateId: 'tpl-lead', displayName: 'Lead', contextPolicy: 'persistent' },
    { kind: 'member', templateId: 'tpl-mate', displayName: 'Mate', contextPolicy: 'persistent' },
  ],
  members: [
    { instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: null },
    { instanceId: 'mate', templateId: 'tpl-mate', label: 'Mate', childSessionId: 'team-member' },
  ],
} as unknown as TeamUiSnapshot

function stateFor(model: TeamUiLedgerModel): TeamLedgerState {
  const entriesBySequence = new Map(model.entries.map(row => [row.sequence, row]))
  const last = model.entries[model.entries.length - 1]
  return {
    teamSessionId: LEADER,
    entriesBySequence: entriesBySequence as unknown as ReadonlyMap<number, RemoteLedgerEntryValue>,
    orderedSequences: model.entries.map(row => row.sequence),
    total: model.entries.length,
    completeThrough: last?.sequence ?? 0,
    loading: false,
  } as unknown as TeamLedgerState
}

function pipeline(entries: readonly RemoteLedgerEntryValue[]): TeamUiLedgerModel {
  return adaptTeamLedger(entries, true)
}

function wireEntry(
  sequence: number,
  payload: Record<string, unknown>,
  factType = 'control-request-recorded',
): RemoteLedgerEntryValue {
  return {
    schemaVersion: 2,
    sequence,
    rootSessionId: LEADER,
    factType,
    payload,
    operationId: null,
    createdAt: new Date(T).toISOString(),
  } as unknown as RemoteLedgerEntryValue
}

function renderLedger(
  model: TeamUiLedgerModel,
  overrides: Partial<TeamLedgerProps> = {},
): RenderResult {
  const props: TeamLedgerProps = {
    snapshot,
    ledger: model,
    ledgerState: stateFor(model),
    onRetry: vi.fn(() => Promise.resolve()),
    onSelectSession: vi.fn(),
    onResolveControl: vi.fn(
      () => Promise.resolve({ ok: true, value: { data: {}, provenance: {} } } as unknown as RemoteResponse),
    ),
    controlSurfaceMode: 'enabled',
    t: makeTranslate(zh),
    ...overrides,
  }
  return render(<TeamLedger {...props} />)
}

const panelOf = (view: RenderResult, requestId: string): HTMLElement | null =>
  view.container.querySelector(`[data-ledger-resolve-bar][data-request-id="${requestId}"]`)

const detailField = (panel: HTMLElement | null, name: string): HTMLElement | null =>
  panel?.querySelector(`[data-control-detail-${name}]`) ?? null

/** The control-request ROW buttons in render order. */
const rowButtons = (view: RenderResult): HTMLElement[] =>
  Array.from(view.container.querySelectorAll('[data-ledger-row][data-ledger-kind="control-request"]'))

/** One governable-shape pending row (the corrupt READ, not the client,
 *  is what marks it — the payload itself is complete). */
function pendingPayload(requestId: string): Record<string, unknown> {
  return {
    requestId,
    kind: 'user-approval',
    targetInstanceId: 'mate',
    actionName: 'write-file',
    correlation: `corr-${requestId}`,
    summary: `summary ${requestId}`,
  }
}

describe('A4-W6 layer 1 — the corrupt entry renders truthfully and offers nothing', () => {
  it('a corrupt-named pending chain: marker badge, corrupt render-mode, BOTH commands disabled, entry visible', () => {
    const model = pipeline([wireEntry(11, pendingPayload('r-w6-chain'))])
    const view = renderLedger(model, { corruptControlSequences: new Set([11]) })
    // The row stays visible and its badge is the HONEST marker, not the
    // waiting badge.
    expect(rowButtons(view)).toHaveLength(1)
    const badge = view.container.querySelector('[data-ledger-state][data-corrupt-record="true"]')
    expect(badge?.textContent).toBe(MARKER_ZH)
    expect(view.container.querySelector('[data-pending="true"]')).toBeNull()
    // The panel: corrupt render mode + the truthful status.
    const panel = panelOf(view, 'r-w6-chain')
    if (panel === null) throw new Error('the corrupt entry panel did not materialize')
    expect(panel.getAttribute('data-corrupt-record')).toBe('true')
    const mode = detailField(panel, 'render-mode')
    expect(mode?.getAttribute('data-render-mode')).toBe('corrupt-record')
    expect(mode?.textContent).toContain(MARKER_ZH)
    expect(detailField(panel, 'status')?.textContent).toContain(MARKER_ZH)
    // BOTH commands render and are DISABLED (visible inert, never a
    // silent drop of the entry).
    const allow = panel.querySelector('[data-ledger-resolve-allow]') as HTMLButtonElement | null
    const deny = panel.querySelector('[data-ledger-resolve-deny]') as HTMLButtonElement | null
    expect(allow?.disabled).toBe(true)
    expect(allow?.getAttribute('data-allow-blocked')).toBe('true')
    expect(deny?.disabled).toBe(true)
    expect(deny?.getAttribute('data-deny-blocked')).toBe('true')
  })

  it('the join is by SEQUENCE, not requestId: identical rows, only the named sequence is marked', () => {
    const model = pipeline([
      wireEntry(21, pendingPayload('r-w6-twin-a')),
      wireEntry(22, pendingPayload('r-w6-twin-b')),
    ])
    const view = renderLedger(model, { corruptControlSequences: new Set([22]) })
    const marked = view.container.querySelectorAll('[data-ledger-state][data-corrupt-record="true"]')
    expect(marked).toHaveLength(1)
    // The marked row is the SECOND one (sequence 22 — the only difference
    // between the twins), and its panel (not the first one's) is blocked.
    expect(rowButtons(view)[1]?.querySelector('[data-ledger-state][data-corrupt-record]')).not.toBeNull()
    expect(rowButtons(view)[0]?.querySelector('[data-ledger-state][data-corrupt-record]')).toBeNull()
    expect(panelOf(view, 'r-w6-twin-b')?.getAttribute('data-corrupt-record')).toBe('true')
    expect(panelOf(view, 'r-w6-twin-a')?.getAttribute('data-corrupt-record')).toBeNull()
  })

  it('a corrupt row with an UNREADABLE requestId is still marked (no chain, no panel, row-level sequence join)', () => {
    // No requestId at all: the tolerant adapter cannot build a chain, the
    // row renders as a bare control-request fact — yet the corrupt-leg
    // read names its sequence.
    const model = pipeline([wireEntry(31, {
      kind: 'user-approval',
      targetInstanceId: 'mate',
      actionName: 'write-file',
      correlation: 'corr-31',
    })])
    const view = renderLedger(model, { corruptControlSequences: new Set([31]) })
    expect(rowButtons(view)).toHaveLength(1)
    const badge = view.container.querySelector('[data-ledger-state][data-corrupt-record="true"]')
    expect(badge?.textContent).toBe(MARKER_ZH)
    // No chain → no panel → no buttons AT ALL (trivially non-clickable);
    // the entry is visible with the marker.
    expect(view.container.querySelector('[data-ledger-resolve-bar]')).toBeNull()
  })

  it('normal pending rows are untouched: waiting badge, no marker, BOTH commands live', () => {
    const model = pipeline([
      wireEntry(41, pendingPayload('r-w6-normal')),
      wireEntry(42, pendingPayload('r-w6-bad')),
    ])
    const view = renderLedger(model, { corruptControlSequences: new Set([42]) })
    const normal = rowButtons(view)[0] as HTMLElement
    expect(normal.querySelector('[data-pending="true"]')?.textContent).toBe('等待裁决')
    expect(normal.querySelector('[data-corrupt-record]')).toBeNull()
    const panel = panelOf(view, 'r-w6-normal')
    if (panel === null) throw new Error('the normal panel did not materialize')
    expect(panel.getAttribute('data-corrupt-record')).toBeNull()
    const allow = panel.querySelector('[data-ledger-resolve-allow]') as HTMLButtonElement | null
    const deny = panel.querySelector('[data-ledger-resolve-deny]') as HTMLButtonElement | null
    expect(allow?.disabled).toBe(false)
    expect(deny?.disabled).toBe(false)
    // The negative control on the negative control: the corrupt row IS
    // marked in the same frame.
    expect(panelOf(view, 'r-w6-bad')?.getAttribute('data-corrupt-record')).toBe('true')
  })

  it('without the corrupt-leg read (pre-v9 host / read failed), nothing is marked — but unsupported-subject Deny is STILL disabled', () => {
    // The owner ruling: the Deny disability comes from NON-GOVERNABILITY,
    // not from the corruption read. `unsupported-subject` is established
    // by the adapter alone, so a host without the v9 read plane behaves
    // consistently.
    const model = pipeline([wireEntry(51, {
      requestId: 'r-w6-unsup',
      kind: 'user-approval',
      actionName: 'delegate',
      correlation: 'c-unsup',
      subject: { kind: 'template', templateId: 'tpl-mate', instanceId: 'ghost' },
    })])
    const view = renderLedger(model)
    expect(view.container.querySelector('[data-corrupt-record]')).toBeNull()
    const panel = panelOf(view, 'r-w6-unsup')
    if (panel === null) throw new Error('the unsupported panel did not materialize')
    const allow = panel.querySelector('[data-ledger-resolve-allow]') as HTMLButtonElement | null
    const deny = panel.querySelector('[data-ledger-resolve-deny]') as HTMLButtonElement | null
    expect(allow?.disabled).toBe(true)
    expect(deny?.disabled).toBe(true)
    expect(deny?.getAttribute('data-deny-blocked')).toBe('true')
    // Not corrupt: the render mode stays the adapter's own class.
    expect(detailField(panel, 'render-mode')?.getAttribute('data-render-mode'))
      .toBe('unsupported-subject')
  })

  it('the marker copy follows the dictionary (en)', () => {
    const model = pipeline([wireEntry(61, pendingPayload('r-w6-en'))])
    const view = renderLedger(model, {
      corruptControlSequences: new Set([61]),
      t: makeTranslate(en),
    })
    expect(view.container.querySelector('[data-ledger-state][data-corrupt-record="true"]')?.textContent)
      .toBe(MARKER_EN)
    expect(detailField(panelOf(view, 'r-w6-en'), 'render-mode')?.textContent).toContain(MARKER_EN)
  })
})

// ---------------------------------------------------------------------------
// Layer 2 — TeamView wiring: the SEQUENCE set reaches the ledger from the
// v9 corrupt-leg read (a4w4 harness; the answered leg carries SEQUENCE
// ONLY — no requestId — which is exactly what the join must survive).
// ---------------------------------------------------------------------------

function okResponse(data: unknown, method: string): RemoteResponse {
  return {
    ok: true,
    value: {
      data: data as RemoteSafeJsonValue,
      provenance: {
        origin: 'team-remote', method, endpoint: method, contractVersion: 9,
        requestToken: null, projectionGeneration: null, effectSequence: null,
      },
    },
  }
}

function frame(): TeamProjectionDto {
  return {
    schemaVersion: 1,
    teamSessionId: LEADER,
    blueprint: { blueprintId: 'bp-1', revision: 1, contentHash: 'h-1' },
    generation: 1,
    generatedAt: '2026-08-29T00:00:00.000Z',
    root: { teamSessionId: LEADER, createdAt: '2026-08-29T00:00:00.000Z', policyState: 'open' },
    templates: [],
    members: [],
    ledger: { latestSequence: 0, totalEntries: 0, byCategory: {}, pendingControlCount: 0 },
  } as unknown as TeamProjectionDto
}

function ledgerState(entries: readonly RemoteLedgerEntryValue[]): TeamLedgerState {
  const entriesBySequence = new Map<number, RemoteLedgerEntryValue>()
  for (const item of entries) entriesBySequence.set(item.sequence, item)
  const last = entries[entries.length - 1]
  return {
    teamSessionId: LEADER,
    entriesBySequence,
    orderedSequences: entries.map(item => item.sequence),
    total: entries.length,
    completeThrough: last === undefined ? 0 : last.sequence,
    loading: false,
  }
}

function viewProps(control: TeamViewControlFace): TeamViewProps {
  const mirror = { [LEADER]: frame() } as unknown as TeamProjectionMirror
  const entries = [
    wireEntry(71, pendingPayload('r-e2e-normal')),
    wireEntry(72, pendingPayload('r-e2e-corrupt')),
  ]
  return {
    sessionId: LEADER as TeamViewProps['sessionId'],
    useSession: (() => undefined) as TeamViewProps['useSession'],
    useProjection: () => undefined,
    useInput: () => { throw new Error('unused') },
    inputActions: { setDraft: () => {}, submit: () => {} } as unknown as TeamViewProps['inputActions'],
    useSessions: () => { throw new Error('unused') },
    useSessionStatus: (() => undefined) as TeamViewProps['useSessionStatus'],
    useSessionRetainInfo: (() => undefined) as TeamViewProps['useSessionRetainInfo'],
    useWorkspaces: (() => undefined) as TeamViewProps['useWorkspaces'],
    usePanelInfo: (sel) => sel({ activePanelId: null }),
    useProjectionMirror: selector => selector(mirror),
    useTeamLedgers: selector => selector({ [LEADER]: ledgerState(entries) }),
    useProjectionStates: selector => selector({}),
    useSessionReadStates: selector => selector({}),
    ensureProjection: vi.fn(() => Promise.resolve()),
    pullProjection: vi.fn(() => Promise.resolve({ status: 'duplicate', receivedGeneration: 1 } as const)),
    refreshTeamLedger: vi.fn(() => Promise.resolve()),
    openSession: vi.fn(),
    t: makeTranslate(zh),
    viewRequest: null,
    openView: () => {},
    completeViewRequest: () => {},
    inspectCall: undefined,
    useConversation: (() => undefined) as TeamViewProps['useConversation'],
    useChat: (() => undefined) as TeamViewProps['useChat'],
    control,
  }
}

/** v9 face whose corrupt-leg answer names sequence 72 — WITHOUT a
 *  requestId (the wire row for a leg whose id is damaged). */
function corrupt72Face(): TeamViewControlFace {
  return {
    resolveControl: (params: RemoteTeamResolveControlParams) =>
      Promise.resolve(okResponse({ control: { requestId: params.requestId } }, 'team.resolveControl')),
    listCorruptControlLegs: () => Promise.resolve(okResponse({
      corruption: {
        teamSessionId: LEADER,
        corruptCount: 1,
        truncated: false,
        legs: [{ sequence: 72, disclosesMember: false }],
      },
    }, 'team.listCorruptControlLegs')),
  }
}

describe('A4-W6 layer 2 — the sequence set reaches the ledger through the production wiring', () => {
  it('TeamView joins the v9 corrupt-leg (sequence-only) onto the row at that sequence; W4 bar intact', async () => {
    const view = render(<TeamView {...viewProps(corrupt72Face())} />)
    // The W4 bar (non-regression: the read plane itself is unchanged).
    await waitFor(() => {
      expect(view.container.querySelector('[data-team-control-corruption]')).not.toBeNull()
    })
    // The entry-level marking: exactly one corrupt marker, on the row of
    // sequence 72 (payload twin of the normal row — only the sequence
    // distinguishes them; the answered leg named NO requestId at all).
    await waitFor(() => {
      const marked = view.container.querySelectorAll('[data-ledger-state][data-corrupt-record="true"]')
      expect(marked).toHaveLength(1)
    })
    const rows = rowButtons(view)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.querySelector('[data-pending="true"]')).not.toBeNull()
    expect(rows[1]?.querySelector('[data-corrupt-record="true"]')).not.toBeNull()
    // No enabled resolve command may target the corrupt entry.
    const corruptPanel = panelOf(view, 'r-e2e-corrupt')
    if (corruptPanel !== null) {
      const live = corruptPanel.querySelectorAll('button:not([disabled])')
      expect(live).toHaveLength(0)
    }
  })
})
