// @vitest-environment jsdom
/**
 * The global New Team entry (R118, frozen UI design §3.1 MUST): the
 * session-independent creation entry fixed at `sidebar.footer.action`.
 *
 * Coverage: the trigger row in both sidebar states (wide = visible label,
 * rail = icon-only + tooltip label; the accessible name is `New Team` in
 * both), the Team-owned creation overlay — opening it creates NO session
 * (§3.1), the panel is the T7 surface (no handoff block: no handoff face
 * or source is wired), the fresh empty draft per open, and close timings
 * (cancel button, backdrop click; a successful create closes the overlay
 * BEFORE the native session switch, then navigates to the new root). R121:
 * the fresh draft is prefilled with the workspace containing the current
 * session (no current session -> the Default workspace is preserved).
 */
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  RemoteCatalogGetParams, RemoteIntentProbeParams, RemoteResponse, RemoteSafeJsonValue, RemoteTeamCreateParams,
} from '../../remote/src/index.js'
import type { TeamPresetRow } from '../src/model/team-intent-model.js'
import { NewTeamEntry, type NewTeamEntryProps } from '../src/ui/NewTeamEntry.js'
import { zh } from '../src/ui/locales.js'

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

/** The creation face (every member a spy; the defaults are the happy path). */
interface EntryFace {
  listCatalog: () => Promise<RemoteResponse>
  getCatalog: (params: RemoteCatalogGetParams) => Promise<RemoteResponse>
  probeCompatibility: (params: RemoteIntentProbeParams) => Promise<RemoteResponse>
  teamCreate: (params: RemoteTeamCreateParams) => Promise<RemoteResponse>
  createRootSession: (opts?: { readonly workspaceId?: string }) => Promise<string>
  listAgentPresets: () => Promise<readonly TeamPresetRow[]>
  openSession: (sessionId: string) => void
  currentSessionId: () => string | null
}

function makeFace(overrides: Partial<EntryFace> = {}): EntryFace {
  return {
    listCatalog: vi.fn(() => Promise.resolve(okResponse(CATALOG_DATA, 'catalog.list'))),
    getCatalog: vi.fn(() => Promise.resolve(okResponse(DETAIL_DATA, 'catalog.get'))),
    probeCompatibility: vi.fn(() => Promise.resolve(okResponse(OPEN_DATA, 'intent.probe'))),
    teamCreate: vi.fn(() => Promise.resolve(okResponse({ teamSessionId: 'ts-1' }, 'team.create'))),
    createRootSession: vi.fn(() => Promise.resolve('root-1')),
    listAgentPresets: vi.fn(() => Promise.resolve([
      { id: 'team', name: 'Team', isDefault: false },
    ] satisfies readonly TeamPresetRow[])),
    openSession: vi.fn(),
    currentSessionId: () => null,
    ...overrides,
  }
}

/** One raw workspace feed row (the upstream `WorkspaceView` leaf fields). */
interface WorkspaceItem {
  readonly workspaceId: string
  readonly sessionIds: readonly string[]
  readonly path: string
  readonly title: string
  readonly createdAt: string
  readonly updatedAt: string
}

/** A `useWorkspaces` stub answering the component's `s => s.items` selector. */
function workspacesHook(items: readonly WorkspaceItem[]): NewTeamEntryProps['useWorkspaces'] {
  const state = { items }
  return ((selector: (s: typeof state) => unknown) =>
    selector(state)) as NewTeamEntryProps['useWorkspaces']
}

/**
 * The stub props (the owner `wide` flag + the injected face + the locale
 * seat). Empty workspace feed by default (the pre-R121 stub behavior: the
 * panel's workspace select stays unrendered).
 */
function entryProps(
  wide: boolean,
  face: EntryFace,
  workspaceItems: readonly WorkspaceItem[] = [],
): NewTeamEntryProps {
  return {
    wide,
    useSessions: () => { throw new Error('unused') },
    useSessionPendingInteraction: (() => undefined) as NewTeamEntryProps['useSessionPendingInteraction'],
    useWorkspaces: workspaceItems.length > 0
      ? workspacesHook(workspaceItems)
      : (() => undefined) as NewTeamEntryProps['useWorkspaces'],
    listCatalog: face.listCatalog,
    getCatalog: face.getCatalog,
    probeCompatibility: face.probeCompatibility,
    teamCreate: face.teamCreate,
    createRootSession: face.createRootSession,
    listAgentPresets: face.listAgentPresets,
    openSession: face.openSession,
    currentSessionId: face.currentSessionId,
    t: makeTranslate(zh),
  }
}

function entryButton(container: HTMLElement): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>('[data-new-team-entry]')
  if (el === null) throw new Error('the New Team entry did not render')
  return el
}

function blueprintSelect(container: HTMLElement): HTMLSelectElement {
  const el = container.querySelector<HTMLSelectElement>('[data-intent-blueprint]')
  if (el === null) throw new Error('the blueprint select did not render')
  return el
}

function createButton(container: HTMLElement): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>('[data-intent-create]')
  if (el === null) throw new Error('the create button did not render')
  return el
}

function workspaceSelect(container: HTMLElement): HTMLSelectElement {
  const el = container.querySelector<HTMLSelectElement>('[data-intent-workspace]')
  if (el === null) throw new Error('the workspace select did not render')
  return el
}

afterEach(cleanup)

describe('NewTeamEntry (sidebar.footer.action)', () => {
  it('renders the visible label wide and the icon-only rail with the accessible name (UI §3.1)', () => {
    const wide = render(<NewTeamEntry {...entryProps(true, makeFace())} />)
    const wideButton = entryButton(wide.container)
    expect(wideButton.getAttribute('aria-label')).toBe('新建团队')
    expect(wideButton.textContent).toContain('新建团队')
    expect(wide.container.querySelector('[data-new-team-overlay]')).toBeNull()

    const rail = render(<NewTeamEntry {...entryProps(false, makeFace())} />)
    const railButton = entryButton(rail.container)
    expect(railButton.getAttribute('aria-label')).toBe('新建团队')
    // Rail state: icon-only — no visible text label.
    expect(railButton.textContent ?? '').toBe('')
  })

  it('opens the Team-owned overlay on click: the T7 surface, no handoff block, loud unselected placeholder, create closed (UI §3.1/§4.1)', async () => {
    const face = makeFace()
    const view = render(<NewTeamEntry {...entryProps(true, face)} />)
    expect(view.container.querySelector('[data-new-team-overlay]')).toBeNull()
    fireEvent.click(entryButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-new-team-overlay]')).not.toBeNull()
    })
    const panel = view.container.querySelector('[data-team-creation-panel]')
    expect(panel).not.toBeNull()
    // The panel is the T7 surface: no handoff face/source is wired, so the
    // handoff block is absent entirely.
    expect(view.container.querySelector('[data-intent-handoff]')).toBeNull()
    // §3.1: opening the overlay created NO session.
    expect(face.createRootSession).toHaveBeenCalledTimes(0)
    expect(face.openSession).toHaveBeenCalledTimes(0)
    // The catalog lands: the loud unselected placeholder owns the empty
    // value and the create gate stays closed (R119 regression surface).
    await vi.waitFor(() => {
      expect(blueprintSelect(view.container).disabled).toBe(false)
    })
    expect(blueprintSelect(view.container).value).toBe('')
    expect(blueprintSelect(view.container).querySelector('option[value=""]')?.textContent).toBe('选择蓝图…')
    expect(createButton(view.container).disabled).toBe(true)
  })

  it('closes the overlay on the cancel button and on a backdrop click (the dialog stop propagates)', async () => {
    const face = makeFace()
    const view = render(<NewTeamEntry {...entryProps(true, face)} />)
    fireEvent.click(entryButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-new-team-overlay]')).not.toBeNull()
    })
    await vi.waitFor(() => {
      expect(blueprintSelect(view.container).disabled).toBe(false)
    })
    const cancel = view.container.querySelector<HTMLElement>('[data-intent-cancel]')
    if (cancel === null) throw new Error('the panel cancel button did not render')
    fireEvent.click(cancel)
    expect(view.container.querySelector('[data-new-team-overlay]')).toBeNull()

    // Reopen, then close through the backdrop itself (the dialog surface
    // swallows its own clicks — only the backdrop click closes).
    fireEvent.click(entryButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-new-team-overlay]')).not.toBeNull()
    })
    const dialog = view.container.querySelector<HTMLElement>('[role="dialog"]')
    if (dialog === null) throw new Error('the overlay dialog did not render')
    fireEvent.click(dialog)
    expect(view.container.querySelector('[data-new-team-overlay]')).not.toBeNull()
    fireEvent.click(view.container.querySelector('[data-new-team-overlay]')!)
    expect(view.container.querySelector('[data-new-team-overlay]')).toBeNull()
  })

  it('a successful create closes the overlay BEFORE switching to the freshly opened root (UI §4.3 canonical order)', async () => {
    const face = makeFace()
    const view = render(<NewTeamEntry {...entryProps(true, face)} />)
    fireEvent.click(entryButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-team-creation-panel]')).not.toBeNull()
    })
    await vi.waitFor(() => {
      expect(blueprintSelect(view.container).disabled).toBe(false)
    })
    // The explicit pick (the placeholder owns the empty value).
    fireEvent.change(blueprintSelect(view.container), { target: { value: BP } })
    await vi.waitFor(() => {
      expect(createButton(view.container).disabled).toBe(false)
    })
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(face.openSession).toHaveBeenCalledTimes(1)
    })
    // The canonical order: native root first, then the frozen create, then
    // the switch to the SAME root — and the overlay is already closed by
    // the time the switch lands.
    expect(face.createRootSession).toHaveBeenCalledTimes(1)
    expect(face.teamCreate).toHaveBeenCalledTimes(1)
    expect(face.openSession).toHaveBeenCalledWith('root-1')
    expect(view.container.querySelector('[data-new-team-overlay]')).toBeNull()
  })

  it('prefills the fresh draft with the current session\'s workspace (R121: no Default-workspace orphaning)', async () => {
    const face = makeFace({ currentSessionId: () => 'sess-1' })
    const view = render(
      <NewTeamEntry
        {...entryProps(true, face, [
          { workspaceId: 'ws-1', sessionIds: ['sess-1'], path: 'C:/ws1', title: 'Ws One', createdAt: 'x', updatedAt: 'y' },
        ])}
      />,
    )
    fireEvent.click(entryButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-team-creation-panel]')).not.toBeNull()
    })
    // The fresh draft is prefilled: the workspace containing the current
    // session owns the select value (the user can still change it in the
    // panel, or clear it back to Default).
    expect(workspaceSelect(view.container).value).toBe('ws-1')
    // The create gate is unchanged: an explicit blueprint pick is still
    // required (the placeholder owns the empty value).
    await vi.waitFor(() => {
      expect(blueprintSelect(view.container).disabled).toBe(false)
    })
    expect(blueprintSelect(view.container).value).toBe('')
    expect(createButton(view.container).disabled).toBe(true)
  })

  it('keeps the Default workspace (empty select value) when no session is selected (R121 no-prefill)', async () => {
    const face = makeFace() // currentSessionId: () => null (the face default)
    const view = render(
      <NewTeamEntry
        {...entryProps(true, face, [
          { workspaceId: 'ws-1', sessionIds: ['sess-1'], path: 'C:/ws1', title: 'Ws One', createdAt: 'x', updatedAt: 'y' },
        ])}
      />,
    )
    fireEvent.click(entryButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-team-creation-panel]')).not.toBeNull()
    })
    // No current selection -> the workspaceId stays null (UI §8: the
    // Default workspace semantics are preserved).
    expect(workspaceSelect(view.container).value).toBe('')
    expect(createButton(view.container).disabled).toBe(true)
  })
})
