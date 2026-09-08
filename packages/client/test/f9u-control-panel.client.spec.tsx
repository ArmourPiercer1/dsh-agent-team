// @vitest-environment jsdom
/**
 * F9U (F3/F11/F9/T1.4 repair round r1, gate-review supplements) — the
 * pending control-request DETAIL panel (TeamLedger Events section):
 *
 *  - supplement 1 (UI §26.2): the detail fields — requester / request
 *    kind / requested operation / tool / reason / creation time /
 *    current status / requested authority — render for the pending
 *    control-request row; every field rides the durable facts (the
 *    paired control chain), and an absent leaf OMITS its field
 *    (fail-safe — never invented);
 *  - supplement 2 (UI §26.4): the external hard policy display — a
 *    control-decision row recorded as `deny` with the frozen
 *    `external-policy` reason renders the frozen two-line
 *    "Team decision: Allowed / Execution: Blocked by managed policy"
 *    block and NEVER the plain "denied" label (it must not read as an
 *    approval failure);
 *  - supplement 3 (the kind-aware affordance): the Allow / Deny
 *    commands render for a CLOSED kind whose closed role set includes
 *    the human, and NOT for a kind absent from the closed resolver-role
 *    map (fail-closed);
 *  - supplement 4 (served-version gating): the commands render ONLY in
 *    the 'enabled' mode (the view's v4 probe proved the served host
 *    serves v4); in 'read-only' (a pre-v4 served build) the detail
 *    panel stays with the read-only note and no commands; in the
 *    absent / unresolved mode the commands fail closed.
 *
 * The F9 command surface (face + pending + durable requestId +
 * sibling-of-row structure + the command flight state machine) is
 * covered by `f9-resolve-control-ui.client.spec.tsx`; this spec is the
 * supplement layer on top of it.
 */
import { cleanup, render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { LedgerCategory } from '../../contracts/src/index.js'
import type { RemoteLedgerEntryValue, RemoteResponse } from '../../remote/src/index.js'
import type { TeamLedgerState } from '../src/state/team-ledger-store.js'
import type {
  TeamUiControlChain, TeamUiLedgerModel, TeamUiLedgerRow, TeamUiMemberInstance, TeamUiSnapshot,
} from '../src/model/team-ui-snapshot.js'
import { formatTeamClock } from '../src/model/team-timeline-model.js'
import { TeamLedger, type TeamLedgerProps } from '../src/ui/TeamLedger.js'
import { en, zh } from '../src/ui/locales.js'

const LEADER = 'team-leader'
const T = 1_700_000_000_000

const iso = (ms: number): string => new Date(ms).toISOString()

afterEach(cleanup)
beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn()
})
afterEach(() => {
  delete (Element.prototype as { setPointerCapture?: unknown }).setPointerCapture
})

/** One UI ledger row (the adapter's face; the ONE boundary cast). */
function uiEntry(
  sequence: number,
  factType: string,
  createdAt: number,
  payload: Record<string, unknown>,
  category?: LedgerCategory,
): TeamUiLedgerRow {
  return {
    sequence,
    factType,
    ...(category === undefined ? {} : { category }),
    rootSessionId: LEADER,
    operationId: null,
    createdAt: iso(createdAt),
    payload,
  } as unknown as TeamUiLedgerRow
}

const MEMBERS: readonly TeamUiMemberInstance[] = [
  { instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: null } as unknown as TeamUiMemberInstance,
  { instanceId: 'mate', templateId: 'tpl-mate', label: 'Mate', childSessionId: 'team-member' } as unknown as TeamUiMemberInstance,
]

function snapshot(overrides: Partial<TeamUiSnapshot> = {}): TeamUiSnapshot {
  return {
    teamSessionId: LEADER,
    generation: 1,
    templates: [
      { kind: 'leader', templateId: 'tpl-lead', displayName: 'Lead', contextPolicy: 'persistent' },
      { kind: 'member', templateId: 'tpl-mate', displayName: 'Mate', contextPolicy: 'persistent' },
    ],
    members: MEMBERS,
    ...overrides,
  } as unknown as TeamUiSnapshot
}

function ledgerModel(
  entries: readonly TeamUiLedgerRow[],
  overrides: Partial<TeamUiLedgerModel> = {},
): TeamUiLedgerModel {
  return {
    completeness: 'partial',
    entries,
    controls: [],
    messages: [],
    intervals: [],
    progress: [],
    pendingControlByInstance: {},
    ...overrides,
  } as unknown as TeamUiLedgerModel
}

/** One published store state over the loaded facts (known complete by default). */
function state(entries: readonly TeamUiLedgerRow[], overrides: Partial<TeamLedgerState> = {}): TeamLedgerState {
  const entriesBySequence = new Map(entries.map(item => [item.sequence, item]))
  const last = entries[entries.length - 1]
  return {
    teamSessionId: LEADER,
    entriesBySequence: entriesBySequence as unknown as ReadonlyMap<number, RemoteLedgerEntryValue>,
    orderedSequences: entries.map(item => item.sequence),
    total: last === undefined ? 0 : entries.length,
    completeThrough: last?.sequence ?? 0,
    loading: false,
    ...overrides,
  } as unknown as TeamLedgerState
}

/**
 * The full §26.2 fact set: the pending control-request entry + its
 * paired chain (every detail leaf present).
 */
const FULL_PAYLOAD = {
  requestId: 'r1',
  kind: 'user-approval',
  requester: { kind: 'instance', instanceId: 'mate' },
  targetInstanceId: 'mate',
  actionName: 'write_file',
  toolName: 'file',
  summary: 'needs write access to the workspace',
}

const FULL_ENTRY = uiEntry(1, 'control-request-recorded', T, FULL_PAYLOAD, 'control')

const FULL_CHAIN: TeamUiControlChain = {
  requestId: 'r1',
  requestSequence: 1,
  targetInstanceId: 'mate',
  actionName: 'write_file',
  kind: 'user-approval',
  toolName: 'file',
  summary: 'needs write access to the workspace',
  requesterId: 'mate',
  requesterRefKind: 'instance',
  requestedAt: iso(T),
  pending: true,
}

function renderLedger(overrides: Partial<TeamLedgerProps> = {}): { view: RenderResult; props: TeamLedgerProps } {
  const props: TeamLedgerProps = {
    snapshot: snapshot(),
    ledger: ledgerModel([FULL_ENTRY], { controls: [FULL_CHAIN] }),
    ledgerState: state([FULL_ENTRY]),
    onRetry: vi.fn(() => Promise.resolve()),
    onSelectSession: vi.fn(),
    onResolveControl: vi.fn(
      () => Promise.resolve({ ok: true, value: { data: {}, provenance: {} } } as unknown as RemoteResponse),
    ),
    // The v4 proof is the DEFAULT here (the supplements under test); the
    // gating tests override it explicitly.
    controlSurfaceMode: 'enabled',
    t: makeTranslate(zh),
    ...overrides,
  }
  const view = render(<TeamLedger {...props} />)
  return { view, props }
}

const panelOf = (view: RenderResult, requestId: string): HTMLElement | null =>
  view.container.querySelector(`[data-ledger-resolve-bar][data-request-id="${requestId}"]`)

const detailField = (panel: HTMLElement | null, name: string): HTMLElement | null =>
  panel?.querySelector(`[data-control-detail-${name}]`) ?? null

describe('F9U supplement 1 (UI §26.2) — the control-request detail fields', () => {
  it('renders every §26.2 field from the durable facts (the paired chain)', () => {
    const { view } = renderLedger()
    const panel = panelOf(view, 'r1')
    if (panel === null) throw new Error('the control panel did not render')
    // requester: the instance ref resolves through the snapshot members.
    expect(detailField(panel, 'requester')?.textContent).toBe('请求方Mate')
    // kind / action / tool / reason: the chain leaves verbatim.
    expect(detailField(panel, 'kind')?.textContent).toBe('请求类型user-approval')
    expect(detailField(panel, 'action')?.textContent).toBe('请求操作write_file')
    expect(detailField(panel, 'tool')?.textContent).toBe('工具file')
    expect(detailField(panel, 'reason')?.textContent).toBe('原因needs write access to the workspace')
    // creation time: the row's durable fact time (the page clock).
    expect(detailField(panel, 'time')?.textContent).toBe(`创建时间${formatTeamClock(T)}`)
    // current status: the pending state label.
    expect(detailField(panel, 'status')?.textContent).toBe('当前状态等待裁决')
    // requested authority: the closed role set for the closed kind.
    expect(detailField(panel, 'authority')?.textContent).toBe('请求权限human')
  })

  it('renders the requester as the fixed human label for a human ref (and the closed role pair for leader-approval)', () => {
    const humanPayload = {
      ...FULL_PAYLOAD,
      kind: 'leader-approval',
      requester: { kind: 'human', humanId: 'op-1' },
    }
    const entry = uiEntry(1, 'control-request-recorded', T, humanPayload, 'control')
    const chain: TeamUiControlChain = {
      ...FULL_CHAIN,
      kind: 'leader-approval',
      requesterId: 'op-1',
      requesterRefKind: 'human',
    }
    const { view } = renderLedger({
      ledger: ledgerModel([entry], { controls: [chain] }),
      ledgerState: state([entry]),
    })
    const panel = panelOf(view, 'r1')
    if (panel === null) throw new Error('the control panel did not render')
    expect(detailField(panel, 'requester')?.textContent).toBe('请求方人工')
    // the closed role set names BOTH resolvers for leader-approval.
    expect(detailField(panel, 'authority')?.textContent).toBe('请求权限leader / human')
  })

  it('OMITS every field whose durable leaf is absent (fail-safe — never invented; time + status always stay)', () => {
    const barePayload = { requestId: 'r2', targetInstanceId: 'mate', actionName: 'send_message' }
    const entry = uiEntry(1, 'control-request-recorded', T + 500, barePayload, 'control')
    const chain: TeamUiControlChain = {
      requestId: 'r2',
      requestSequence: 1,
      targetInstanceId: 'mate',
      actionName: 'send_message',
      requestedAt: iso(T + 500),
      pending: true,
    }
    const { view } = renderLedger({
      ledger: ledgerModel([entry], { controls: [chain] }),
      ledgerState: state([entry]),
    })
    const panel = panelOf(view, 'r2')
    if (panel === null) throw new Error('the control panel did not render')
    expect(detailField(panel, 'requester')).toBeNull()
    expect(detailField(panel, 'kind')).toBeNull()
    expect(detailField(panel, 'tool')).toBeNull()
    expect(detailField(panel, 'reason')).toBeNull()
    expect(detailField(panel, 'authority')).toBeNull()
    // the row-derived leaves stay (the row always carries action + time).
    expect(detailField(panel, 'action')?.textContent).toBe('请求操作send_message')
    expect(detailField(panel, 'time')?.textContent).toBe(`创建时间${formatTeamClock(T + 500)}`)
    expect(detailField(panel, 'status')?.textContent).toBe('当前状态等待裁决')
  })

  it('falls back to the RAW id for a requester instance the snapshot does not name (never blank)', () => {
    const orphanPayload = {
      ...FULL_PAYLOAD,
      requestId: 'r3',
      requester: { kind: 'instance', instanceId: 'ghost' },
      targetInstanceId: 'ghost',
    }
    const entry = uiEntry(1, 'control-request-recorded', T, orphanPayload, 'control')
    const chain: TeamUiControlChain = {
      ...FULL_CHAIN,
      requestId: 'r3',
      targetInstanceId: 'ghost',
      requesterId: 'ghost',
      requesterRefKind: 'instance',
    }
    const { view } = renderLedger({
      ledger: ledgerModel([entry], { controls: [chain] }),
      ledgerState: state([entry]),
    })
    const panel = panelOf(view, 'r3')
    if (panel === null) throw new Error('the control panel did not render')
    expect(detailField(panel, 'requester')?.textContent).toBe('请求方ghost')
  })
})

describe('F9U supplement 2 (UI §26.4) — the external hard policy display', () => {
  /** One `control-decision-recorded` row: the closed `deny` + `external-policy` combination. */
  const externalPolicyEntry = (sequence: number): TeamUiLedgerRow =>
    uiEntry(
      sequence,
      'control-decision-recorded',
      T + 9000,
      {
        requestId: 'r7',
        decision: 'deny',
        reason: 'external-policy',
        scope: { targetInstanceId: 'mate', actionName: 'write_file', requestSequence: 1 },
      },
      'control',
    )

  it('renders the frozen two-line display (zh) — never the plain denied label', () => {
    const entries = [externalPolicyEntry(1)]
    const { view } = renderLedger({
      ledger: ledgerModel(entries),
      ledgerState: state(entries),
    })
    const badge = view.container.querySelector('[data-external-policy="true"]')
    expect(badge).not.toBeNull()
    if (badge === null) throw new Error('the external-policy badge did not render')
    // The two frozen lines, in order.
    const lines = badge.querySelectorAll('[data-external-policy-team-decision], [data-external-policy-execution]')
    expect(lines.length).toBe(2)
    expect(lines[0]?.textContent).toBe('团队裁决：已允许')
    expect(lines[1]?.textContent).toBe('执行：被托管策略阻止')
    // It must NOT read as an approval failure (no plain denied label).
    expect(badge.textContent).not.toContain('拒绝')
    // The underlying decision value stays exposed for diagnostics.
    expect(badge.getAttribute('data-decision')).toBe('deny')
  })

  it('renders the FROZEN en strings verbatim (UI §26.4)', () => {
    const entries = [externalPolicyEntry(1)]
    const { view } = renderLedger({
      ledger: ledgerModel(entries),
      ledgerState: state(entries),
      t: makeTranslate(en),
    })
    const badge = view.container.querySelector('[data-external-policy="true"]')
    expect(badge).not.toBeNull()
    if (badge === null) throw new Error('the external-policy badge did not render')
    expect(badge.querySelector('[data-external-policy-team-decision]')?.textContent).toBe('Team decision: Allowed')
    expect(badge.querySelector('[data-external-policy-execution]')?.textContent).toBe('Execution: Blocked by managed policy')
  })

  it('keeps the plain decision label for an ORDINARY deny (a different reason; no §26.4 block)', () => {
    const entries = [
      uiEntry(
        1,
        'control-decision-recorded',
        T + 9000,
        {
          requestId: 'r8',
          decision: 'deny',
          note: 'operator declined',
          scope: { targetInstanceId: 'mate', actionName: 'write_file', requestSequence: 1 },
        },
        'control',
      ),
    ]
    const { view } = renderLedger({
      ledger: ledgerModel(entries),
      ledgerState: state(entries),
    })
    expect(view.container.querySelector('[data-external-policy="true"]')).toBeNull()
    const badge = view.container.querySelector('[data-ledger-state][data-decision="deny"]')
    expect(badge?.textContent).toContain('拒绝')
  })
})

describe('F9U supplement 3 — the kind-aware affordance (the closed human resolver-role map)', () => {
  it('renders the commands for every CLOSED kind (the role set includes human)', () => {
    for (const kind of ['user-approval', 'leader-approval', 'envelope-mutation'] as const) {
      const payload = { ...FULL_PAYLOAD, kind }
      const entry = uiEntry(1, 'control-request-recorded', T, payload, 'control')
      const chain: TeamUiControlChain = { ...FULL_CHAIN, kind }
      const { view } = renderLedger({
        ledger: ledgerModel([entry], { controls: [chain] }),
        ledgerState: state([entry]),
      })
      const panel = panelOf(view, 'r1')
      expect(panel?.querySelector('[data-ledger-resolve-allow]')).not.toBeNull()
      expect(panel?.querySelector('[data-ledger-resolve-deny]')).not.toBeNull()
    }
  })

  it('HIDES the commands for a kind ABSENT from the closed map (fail-closed: the panel stays, the affordance does not)', () => {
    const payload = { ...FULL_PAYLOAD, kind: 'future-kind' }
    const entry = uiEntry(1, 'control-request-recorded', T, payload, 'control')
    const chain: TeamUiControlChain = { ...FULL_CHAIN, kind: 'future-kind' }
    const { view } = renderLedger({
      ledger: ledgerModel([entry], { controls: [chain] }),
      ledgerState: state([entry]),
    })
    const panel = panelOf(view, 'r1')
    // the detail panel still renders (the operator still sees the state)…
    if (panel === null) throw new Error('the control panel did not render')
    expect(detailField(panel, 'kind')?.textContent).toBe('请求类型future-kind')
    // …but the closed map grants no human resolution → no commands, no
    // authority (an unknown kind never shows an invented role set).
    expect(panel.querySelector('[data-ledger-resolve-allow]')).toBeNull()
    expect(panel.querySelector('[data-ledger-resolve-deny]')).toBeNull()
    expect(detailField(panel, 'authority')).toBeNull()
  })

  it('HIDES the commands when the chain carries NO kind at all (absent kind fails closed too)', () => {
    const barePayload = { requestId: 'r4', targetInstanceId: 'mate', actionName: 'write_file' }
    const entry = uiEntry(1, 'control-request-recorded', T, barePayload, 'control')
    const chain: TeamUiControlChain = {
      requestId: 'r4',
      requestSequence: 1,
      targetInstanceId: 'mate',
      actionName: 'write_file',
      requestedAt: iso(T),
      pending: true,
    }
    const { view } = renderLedger({
      ledger: ledgerModel([entry], { controls: [chain] }),
      ledgerState: state([entry]),
    })
    const panel = panelOf(view, 'r4')
    if (panel === null) throw new Error('the control panel did not render')
    expect(panel.querySelector('[data-ledger-resolve-allow]')).toBeNull()
    expect(panel.querySelector('[data-ledger-resolve-deny]')).toBeNull()
  })
})

describe('F9U supplement 4 — the served-version gate (v3 read-only / v4 enabled)', () => {
  it('enables the commands in the "enabled" mode (the probe proved the served host serves v4)', () => {
    const { view } = renderLedger()
    const panel = panelOf(view, 'r1')
    if (panel === null) throw new Error('the control panel did not render')
    expect(panel.getAttribute('data-control-surface')).toBe('enabled')
    expect(panel.querySelector('[data-ledger-resolve-allow]')).not.toBeNull()
    expect(panel.querySelector('[data-ledger-resolve-deny]')).not.toBeNull()
    // no read-only note in the enabled mode.
    expect(panel.querySelector('[data-control-surface-read-only]')).toBeNull()
  })

  it('keeps the detail panel but HIDES the commands in the "read-only" mode (the pre-v4 served build)', () => {
    const { view } = renderLedger({ controlSurfaceMode: 'read-only' })
    const panel = panelOf(view, 'r1')
    if (panel === null) throw new Error('the control panel did not render')
    expect(panel.getAttribute('data-control-surface')).toBe('read-only')
    // the detail fields stay visible (the pending state is still shown)…
    expect(detailField(panel, 'requester')?.textContent).toBe('请求方Mate')
    expect(detailField(panel, 'status')?.textContent).toBe('当前状态等待裁决')
    // …but the commands do NOT (the v3 surface is read-only)…
    expect(panel.querySelector('[data-ledger-resolve-allow]')).toBeNull()
    expect(panel.querySelector('[data-ledger-resolve-deny]')).toBeNull()
    // …and the read-only note explains why.
    expect(panel.querySelector('[data-control-surface-read-only]')?.textContent)
      .toBe('当前宿主未提供 v4 人工控制裁决，此面板为只读。')
  })

  it('FAILS CLOSED in the absent / unresolved mode (no v4 proof yet: panel yes, commands no, no note)', () => {
    const { view } = renderLedger({ controlSurfaceMode: undefined })
    const panel = panelOf(view, 'r1')
    if (panel === null) throw new Error('the control panel did not render')
    expect(panel.getAttribute('data-control-surface')).toBe('unresolved')
    expect(detailField(panel, 'requester')?.textContent).toBe('请求方Mate')
    expect(panel.querySelector('[data-ledger-resolve-allow]')).toBeNull()
    expect(panel.querySelector('[data-ledger-resolve-deny]')).toBeNull()
    expect(panel.querySelector('[data-control-surface-read-only]')).toBeNull()
  })

  it('gates the commands in the EN dictionary too (the read-only note is localized, the frozen §26.4 strings untouched)', () => {
    const entries = [
      FULL_ENTRY,
      uiEntry(
        2,
        'control-decision-recorded',
        T + 9000,
        {
          requestId: 'r9',
          decision: 'deny',
          reason: 'external-policy',
          scope: { targetInstanceId: 'mate', actionName: 'write_file', requestSequence: 2 },
        },
        'control',
      ),
    ]
    const { view } = renderLedger({
      ledger: ledgerModel(entries, { controls: [FULL_CHAIN] }),
      ledgerState: state(entries),
      controlSurfaceMode: 'read-only',
      t: makeTranslate(en),
    })
    const panel = panelOf(view, 'r1')
    if (panel === null) throw new Error('the control panel did not render')
    expect(panel.querySelector('[data-control-surface-read-only]')?.textContent)
      .toBe('The served host does not serve the v4 human control resolution; this panel is read-only.')
    expect(detailField(panel, 'status')?.textContent).toBe('Current statusPending decision')
    // the §26.4 block coexists (the decided row's badge), verbatim.
    const badge = view.container.querySelector('[data-external-policy="true"]')
    expect(badge?.querySelector('[data-external-policy-team-decision]')?.textContent).toBe('Team decision: Allowed')
  })
})

describe('F9U — the legacy invariants stay (no face → no panel at all)', () => {
  it('renders NO panel without the onResolveControl face (the legacy surface is unchanged)', () => {
    const { view } = renderLedger({ onResolveControl: undefined })
    expect(view.container.querySelector('[data-ledger-resolve-bar]')).toBeNull()
    expect(view.container.querySelector('[data-control-detail]')).toBeNull()
    // the row itself still renders (the legacy row is untouched).
    expect(view.container.querySelector('[data-ledger-row]')).not.toBeNull()
  })
})
