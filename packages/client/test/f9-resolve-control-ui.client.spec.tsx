// @vitest-environment jsdom
/**
 * F9 (F3/F11/F9/T1.4 repair round r1) — the minimal pending-request
 * command surface (F9U-T1 / F9U-T2): the Allow / Deny command bar under
 * a PENDING control-request ledger row.
 *
 * Coverage (the frozen UI contract):
 *  - the bar renders ONLY when the `onResolveControl` face is present AND
 *    the row is a `control-request` that is pending AND carries a durable
 *    `requestId` (absent face → no commands, the legacy surface unchanged;
 *    non-pending / non-control / id-less rows → no bar);
 *  - the bar is a SIBLING of the row `<button>` (nested buttons are
 *    invalid HTML);
 *  - Allow / Deny call the face with the EXACT
 *    `(teamSessionId, requestId, decision)` — no identity field is
 *    client-supplied (the host derives the human principal — INV-9.3);
 *  - busy: both buttons disable while the command flight is open + the
 *    busy note renders;
 *  - a typed error (the frozen control vocabulary) renders the typed
 *    error note with `data-resolve-error-code` + the message title, and
 *    the row stays pending (the catch-up re-pull is triggered — the
 *    decision fact may have settled the request durably, e.g. the
 *    stale / external-policy close);
 *  - a transport rejection (the ONLY rejection kind) renders the loss
 *    note (`transport-loss` code) and the row stays pending;
 *  - a success clears the per-request state and triggers the re-pull;
 *  - the per-request state is ISOLATED by requestId (two pending rows:
 *    one flight never disables the other's bar);
 *  - the en / zh dictionary pairing for the four labels.
 */
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { LedgerCategory } from '../../contracts/src/index.js'
import type { RemoteLedgerEntryValue, RemoteResponse } from '../../remote/src/index.js'
import {
  REMOTE_CONTRACT_VERSION_V4,
  buildRemoteError,
  buildRemoteSuccess,
} from '../../remote/src/index.js'
import type { TeamLedgerState } from '../src/state/team-ledger-store.js'
import type {
  TeamUiLedgerModel, TeamUiLedgerRow, TeamUiMemberInstance, TeamUiSnapshot,
} from '../src/model/team-ui-snapshot.js'
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

function snapshot(
  teamSessionId: string = LEADER,
  overrides: Partial<TeamUiSnapshot> = {},
): TeamUiSnapshot {
  return {
    teamSessionId,
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
function state(
  entries: readonly TeamUiLedgerRow[],
  overrides: Partial<TeamLedgerState> = {},
): TeamLedgerState {
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

function renderLedger(overrides: Partial<TeamLedgerProps> = {}): { view: RenderResult; props: TeamLedgerProps } {
  const props: TeamLedgerProps = {
    snapshot: snapshot(),
    ledger: ledgerModel([]),
    ledgerState: state([]),
    onRetry: vi.fn(() => Promise.resolve()),
    onSelectSession: vi.fn(),
    // F9U — the v4 proof (served-version gating): the command tests
    // assume the served host serves v4; the gating itself is covered by
    // the F9U supplement spec.
    controlSurfaceMode: 'enabled',
    t: makeTranslate(zh),
    ...overrides,
  }
  const view = render(<TeamLedger {...props} />)
  return { view, props }
}

/** A pending control-request row (requestId 'r1', target 'mate'). */
const CONTROL_ENTRY = uiEntry(
  1,
  'control-request-recorded',
  T,
  { requestId: 'r1', kind: 'user-approval', targetInstanceId: 'mate', actionName: 'write_file' },
  'control',
)

/** The control chain that marks the row pending (joined by requestId). */
const controlModel = (extra: readonly TeamUiLedgerRow[] = []) =>
  ledgerModel([CONTROL_ENTRY, ...extra], {
    controls: [{
      requestId: 'r1', requestSequence: 1, targetInstanceId: 'mate', actionName: 'write_file',
      kind: 'user-approval',
      requestedAt: iso(T), pending: true,
    }],
  })

const resolveBarOf = (view: RenderResult, requestId: string): HTMLElement | null =>
  view.container.querySelector(`[data-ledger-resolve-bar][data-request-id="${requestId}"]`)

const allowButtonOf = (view: RenderResult, requestId: string): HTMLButtonElement | null =>
  resolveBarOf(view, requestId)?.querySelector<HTMLButtonElement>('[data-ledger-resolve-allow]') ?? null

const denyButtonOf = (view: RenderResult, requestId: string): HTMLButtonElement | null =>
  resolveBarOf(view, requestId)?.querySelector<HTMLButtonElement>('[data-ledger-resolve-deny]') ?? null

/** A success envelope for a resolve (the closed decision record). */
const successEnvelope = (): RemoteResponse =>
  buildRemoteSuccess(
    {
      decision: {
        requestId: 'r1',
        decision: 'allow',
        decider: { kind: 'human', humanId: LEADER },
        scope: { rootSessionId: LEADER },
        requestSequence: 1,
        decisionSequence: 2,
        createdAt: '2026-08-29T00:00:09.000Z',
      },
    },
    {
      method: 'team.resolveControl',
      endpoint: 'team.resolveControl',
      contractVersion: REMOTE_CONTRACT_VERSION_V4,
      requestToken: null,
    },
  )

/** A typed control error envelope (the frozen control vocabulary). */
const typedErrorEnvelope = (): RemoteResponse =>
  buildRemoteError(
    'CONTROL_REQUEST_DECIDED',
    'already decided',
    {
      method: 'team.resolveControl',
      endpoint: 'team.resolveControl',
      contractVersion: REMOTE_CONTRACT_VERSION_V4,
      requestToken: null,
    },
    { reason: 'domain-error' },
  )

describe('F9 (UI command surface): the pending-request Allow / Deny bar', () => {
  it('renders the bar ONLY on the pending control-request row with a requestId (sibling of the row button, never nested)', () => {
    const messageEntry = uiEntry(
      2,
      'team-message-delivered',
      T + 1000,
      { recipientInstanceId: 'mate', subject: 'go' },
      'message',
    )
    const decidedEntry = uiEntry(
      3,
      'control-decision-recorded',
      T + 2000,
      { requestId: 'r9', decision: 'allow', scope: { targetInstanceId: 'mate' } },
      'control',
    )
    const entries = [CONTROL_ENTRY, messageEntry, decidedEntry]
    const { view } = renderLedger({
      ledger: ledgerModel(entries, {
        controls: [{
          requestId: 'r1', requestSequence: 1, targetInstanceId: 'mate', actionName: 'write_file',
          kind: 'user-approval',
          requestedAt: iso(T), pending: true,
        }],
      }),
      ledgerState: state(entries),
      onResolveControl: vi.fn(() => Promise.resolve(successEnvelope())),
    })
    const bars = view.container.querySelectorAll('[data-ledger-resolve-bar]')
    expect(bars.length).toBe(1)
    const bar = resolveBarOf(view, 'r1')
    if (bar === null) throw new Error('the resolve bar did not render')
    expect(bar.getAttribute('data-request-id')).toBe('r1')
    // The bar is a SIBLING of the row button (nested buttons are invalid).
    expect(bar.closest('button')).toBeNull()
    expect(bar.previousElementSibling?.hasAttribute('data-ledger-row')).toBe(true)
    expect(allowButtonOf(view, 'r1')?.disabled).toBe(false)
    expect(denyButtonOf(view, 'r1')?.disabled).toBe(false)
    // The zh labels.
    expect(allowButtonOf(view, 'r1')?.textContent).toBe('允许')
    expect(denyButtonOf(view, 'r1')?.textContent).toBe('拒绝')
  })

  it('stays INERT without the face: no commands render (the legacy surface is unchanged)', () => {
    const entries = [CONTROL_ENTRY]
    const { view } = renderLedger({
      ledger: controlModel(),
      ledgerState: state(entries),
    })
    expect(view.container.querySelectorAll('[data-ledger-resolve-bar]')).toHaveLength(0)
    // The row itself still renders (the legacy pending badge is intact).
    const row = view.container.querySelector('[data-ledger-kind="control-request"]')
    expect(row).not.toBeNull()
    expect(row?.querySelector('[data-ledger-state]')?.getAttribute('data-pending')).toBe('true')
  })

  it('renders NO bar for a non-pending control request and for a request without a durable id', () => {
    // (a) The same fact, but the joined chain reports the request DECIDED.
    const decidedState = renderLedger({
      ledger: ledgerModel([CONTROL_ENTRY], {
        controls: [{
          requestId: 'r1', requestSequence: 1, targetInstanceId: 'mate', actionName: 'write_file',
          requestedAt: iso(T), pending: false,
        }],
      }),
      ledgerState: state([CONTROL_ENTRY]),
      onResolveControl: vi.fn(() => Promise.resolve(successEnvelope())),
    })
    expect(decidedState.view.container.querySelectorAll('[data-ledger-resolve-bar]')).toHaveLength(0)

    // (b) A control request fact WITHOUT a requestId in the payload.
    const noIdEntry = uiEntry(
      1,
      'control-request-recorded',
      T,
      { targetInstanceId: 'mate', actionName: 'write_file' },
      'control',
    )
    const noIdState = renderLedger({
      ledger: ledgerModel([noIdEntry], {
        controls: [{
          requestId: 'r1', requestSequence: 1, targetInstanceId: 'mate', actionName: 'write_file',
          requestedAt: iso(T), pending: true,
        }],
      }),
      ledgerState: state([noIdEntry]),
      onResolveControl: vi.fn(() => Promise.resolve(successEnvelope())),
    })
    expect(noIdState.view.container.querySelectorAll('[data-ledger-resolve-bar]')).toHaveLength(0)
  })

  it('Allow calls the face with the EXACT (teamSessionId, requestId, decision) and disables both buttons while the flight is open', async () => {
    const entries = [CONTROL_ENTRY]
    let resolveFlight: ((response: RemoteResponse) => void) | undefined
    const onResolveControl = vi.fn(
      () =>
        new Promise<RemoteResponse>((resolve) => {
          resolveFlight = resolve
        }),
    )
    const { view, props } = renderLedger({
      ledger: controlModel(),
      ledgerState: state(entries),
      onResolveControl,
    })
    const allow = allowButtonOf(view, 'r1')
    if (allow === null) throw new Error('the allow button did not render')
    fireEvent.click(allow)
    expect(onResolveControl).toHaveBeenCalledTimes(1)
    expect(onResolveControl).toHaveBeenCalledWith(LEADER, 'r1', 'allow')
    // Busy: both buttons disabled + the busy note (zh).
    expect(allowButtonOf(view, 'r1')?.disabled).toBe(true)
    expect(denyButtonOf(view, 'r1')?.disabled).toBe(true)
    expect(view.container.querySelector('[data-ledger-resolve-busy]')?.textContent).toBe('裁决中…')
    expect(view.container.querySelector('[data-ledger-resolve-error]')).toBeNull()
    // No re-pull while the flight is open.
    expect(props.onRetry).toHaveBeenCalledTimes(0)
    // Resolve the flight: the state clears + the catch-up re-pull fires.
    resolveFlight?.(successEnvelope())
    await waitFor(() => {
      expect(view.container.querySelector('[data-ledger-resolve-busy]')).toBeNull()
    })
    expect(view.container.querySelector('[data-ledger-resolve-error]')).toBeNull()
    expect(allowButtonOf(view, 'r1')?.disabled).toBe(false)
    expect(props.onRetry).toHaveBeenCalledTimes(1)
  })

  it('Deny calls the face with decision "deny" and the same flight discipline', async () => {
    const entries = [CONTROL_ENTRY]
    let resolveFlight: ((response: RemoteResponse) => void) | undefined
    const onResolveControl = vi.fn(
      () =>
        new Promise<RemoteResponse>((resolve) => {
          resolveFlight = resolve
        }),
    )
    const { view } = renderLedger({
      ledger: controlModel(),
      ledgerState: state(entries),
      onResolveControl,
    })
    const deny = denyButtonOf(view, 'r1')
    if (deny === null) throw new Error('the deny button did not render')
    fireEvent.click(deny)
    expect(onResolveControl).toHaveBeenCalledWith(LEADER, 'r1', 'deny')
    resolveFlight?.(successEnvelope())
    await waitFor(() => {
      expect(view.container.querySelector('[data-ledger-resolve-busy]')).toBeNull()
    })
    expect(view.container.querySelector('[data-ledger-resolve-error]')).toBeNull()
  })

  it('renders the TYPED error note with data-resolve-error-code + the message title, and triggers the catch-up re-pull', async () => {
    const entries = [CONTROL_ENTRY]
    const onResolveControl = vi.fn(async () => typedErrorEnvelope())
    const { view, props } = renderLedger({
      ledger: controlModel(),
      ledgerState: state(entries),
      onResolveControl,
    })
    const allow = allowButtonOf(view, 'r1')
    if (allow === null) throw new Error('the allow button did not render')
    fireEvent.click(allow)
    await waitFor(() => {
      expect(resolveBarOf(view, 'r1')?.querySelector('[data-ledger-resolve-error]')).not.toBeNull()
    })
    const note = view.container.querySelector('[data-ledger-resolve-error]')
    expect(note?.getAttribute('data-resolve-error-code')).toBe('CONTROL_REQUEST_DECIDED')
    expect(note?.getAttribute('title')).toBe('already decided')
    expect(note?.textContent).toBe('裁决失败（CONTROL_REQUEST_DECIDED）：already decided')
    // The row stays PENDING (the command was not durably applied) — and
    // the catch-up re-pull fires (a durable close may have settled it).
    const row = view.container.querySelector('[data-ledger-kind="control-request"]')
    expect(row?.querySelector('[data-ledger-state]')?.getAttribute('data-pending')).toBe('true')
    expect(props.onRetry).toHaveBeenCalledTimes(1)
    // The buttons re-enable (the flight is closed) — the human may retry.
    expect(allowButtonOf(view, 'r1')?.disabled).toBe(false)
    expect(denyButtonOf(view, 'r1')?.disabled).toBe(false)
  })

  it('renders the transport-loss note (the ONLY rejection kind) and keeps the row pending', async () => {
    const entries = [CONTROL_ENTRY]
    const onResolveControl = vi.fn(async () => {
      throw new Error('boom: the channel was lost')
    })
    const { view } = renderLedger({
      ledger: controlModel(),
      ledgerState: state(entries),
      onResolveControl,
    })
    const allow = allowButtonOf(view, 'r1')
    if (allow === null) throw new Error('the allow button did not render')
    fireEvent.click(allow)
    await waitFor(() => {
      expect(resolveBarOf(view, 'r1')?.querySelector('[data-ledger-resolve-error]')).not.toBeNull()
    })
    const note = view.container.querySelector('[data-ledger-resolve-error]')
    expect(note?.getAttribute('data-resolve-error-code')).toBe('transport-loss')
    expect(note?.textContent).toBe('裁决失败（transport-loss）：boom: the channel was lost')
    const row = view.container.querySelector('[data-ledger-kind="control-request"]')
    expect(row?.querySelector('[data-ledger-state]')?.getAttribute('data-pending')).toBe('true')
  })

  it('isolates the per-request state by requestId (two pending rows: one flight never disables the other bar)', async () => {
    const secondEntry = uiEntry(
      2,
      'control-request-recorded',
      T + 1000,
      { requestId: 'r2', targetInstanceId: 'lead', actionName: 'send_message' },
      'control',
    )
    const entries = [CONTROL_ENTRY, secondEntry]
    let resolveR2: ((response: RemoteResponse) => void) | undefined
    const onResolveControl = vi.fn((teamSessionId: string, requestId: string) => {
      if (requestId !== 'r2') return Promise.resolve(successEnvelope())
      return new Promise<RemoteResponse>((resolve) => {
        resolveR2 = resolve
      })
    })
    const { view } = renderLedger({
      ledger: ledgerModel(entries, {
        controls: [
          {
            requestId: 'r1', requestSequence: 1, targetInstanceId: 'mate', actionName: 'write_file',
            kind: 'user-approval',
            requestedAt: iso(T), pending: true,
          },
          {
            requestId: 'r2', requestSequence: 2, targetInstanceId: 'lead', actionName: 'send_message',
            kind: 'user-approval',
            requestedAt: iso(T + 1000), pending: true,
          },
        ],
      }),
      ledgerState: state(entries),
      onResolveControl,
    })
    expect(view.container.querySelectorAll('[data-ledger-resolve-bar]')).toHaveLength(2)
    const denyR2 = denyButtonOf(view, 'r2')
    if (denyR2 === null) throw new Error('the r2 deny button did not render')
    fireEvent.click(denyR2)
    expect(onResolveControl).toHaveBeenCalledWith(LEADER, 'r2', 'deny')
    // r2 is busy; r1 is untouched.
    expect(denyButtonOf(view, 'r2')?.disabled).toBe(true)
    expect(view.container.querySelector('[data-ledger-resolve-busy]')?.textContent).toBe('裁决中…')
    expect(allowButtonOf(view, 'r1')?.disabled).toBe(false)
    expect(denyButtonOf(view, 'r1')?.disabled).toBe(false)
    // Close the r2 flight: r2 clears, r1 still has no state.
    resolveR2?.(successEnvelope())
    await waitFor(() => {
      expect(view.container.querySelector('[data-ledger-resolve-busy]')).toBeNull()
    })
    expect(allowButtonOf(view, 'r1')?.disabled).toBe(false)
    expect(allowButtonOf(view, 'r2')?.disabled).toBe(false)
  })

  it('keeps the en dictionary pairing for the command surface', async () => {
    const entries = [CONTROL_ENTRY]
    const onResolveControl = vi.fn(async () => typedErrorEnvelope())
    const { view } = renderLedger({
      ledger: controlModel(),
      ledgerState: state(entries),
      onResolveControl,
      t: makeTranslate(en),
    })
    const allow = allowButtonOf(view, 'r1')
    if (allow === null) throw new Error('the allow button did not render')
    expect(allow.textContent).toBe('Allow')
    expect(denyButtonOf(view, 'r1')?.textContent).toBe('Deny')
    fireEvent.click(allow)
    await waitFor(() => {
      expect(resolveBarOf(view, 'r1')?.querySelector('[data-ledger-resolve-error]')).not.toBeNull()
    })
    expect(view.container.querySelector('[data-ledger-resolve-error]')?.textContent).toBe(
      'Resolve failed (CONTROL_REQUEST_DECIDED): already decided',
    )
  })
})
