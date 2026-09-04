// @vitest-environment jsdom
/**
 * The New Team panel handoff flows (P9-T8, S5-D; UI doc §32, Gate
 * P9-G5; plan §10.5): the §32.2 prefill (default workspace = the source
 * session's workspace, only when the native feed carries it and the user
 * has not picked one), the §32.3 one-shot `handoff.prepare` preview
 * (a READ — its typed failure renders verbatim and NEVER blocks the
 * create, because the `handoff.create` fresh-op path snapshots the
 * source itself), and the §32.4 decision triad over the frozen
 * `handoff.create` command flow.
 *
 * G5 discipline on the handoff create (a command flow): NO optimistic
 * authority patch (the panel renders the stored state / typed error
 * verbatim), the typed Remote result preserved, and the projection pull
 * happens exactly once on success — cold-pulled by the NEW session's
 * TeamView mount effect after `openSession(rootSessionId)`; on failure
 * no session switch happens, so the pull count is zero (the panel face
 * carries no pullProjection seam by design, the same as T7 `team.create`).
 *
 * The §10.5 idempotency mapping (the frozen catalog has NO decision
 * method):
 * - `creation-failed` → RETRY re-invokes `handoff.create` with the SAME
 *   `(sourceSessionId, requestToken)` (the host re-drives ONLY the team
 *   creation idempotently);
 * - `awaiting-decision` → RETRY uses a FRESH request token (a same-token
 *   re-invocation is a pure replay of the stored failure; no team exists
 *   under the old token, so no double-creation risk);
 * - CONTINUE-WITHOUT-HANDOFF is a client-local EXPLICIT user decision →
 *   the standard non-handoff create sequence (native root + `team.create`),
 *   a new team WITHOUT handoff provenance;
 * - CANCEL is client-local (NO remote call) and terminal within the panel
 *   run: every later create click runs the standard path (the checkbox is
 *   disabled after it, so a plain create click must not silently re-open
 *   the handoff attempt).
 *
 * The draft is parent-held (the harness mirrors TeamView, UI §5.3).
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  RemoteCatalogGetParams, RemoteHandoffCreateParams, RemoteHandoffPrepareParams,
  RemoteIntentProbeParams, RemoteResponse, RemoteSafeJsonValue, RemoteTeamCreateParams,
} from '../../remote/src/index.js'
import type {
  TeamIntentDraft, TeamPresetRow, TeamWorkspaceOption,
} from '../src/model/team-intent-model.js'
import { emptyTeamIntentDraft } from '../src/model/team-intent-model.js'
import { TeamCreationPanel, type TeamCreationHandoffSource } from '../src/ui/TeamCreationPanel.js'
import { en } from '../src/ui/locales.js'

const BP = 'bp-1'
const SOURCE_SESSION = 'A'

/** The frozen catalog wire payload (one blueprint, two revisions). */
const CATALOG_DATA = { blueprints: [{ blueprintId: BP, revisions: [1, 2] }] }

/** The frozen catalog detail wire payload. */
const DETAIL_DATA = {
  blueprint: {
    blueprintId: BP,
    revision: 2,
    displayName: 'Atlas',
    description: 'Atlas blueprint',
    metadata: { source: 'builtin' },
    members: [{ templateId: 'tpl-lead' }, { templateId: 'tpl-mate' }],
  },
}

/** An OPEN probe verdict (the create gate enables). */
const OPEN_DATA = {
  compatibility: {
    status: 'OPEN',
    requirements: [{ outcome: 'PASS', requirementId: 'req-1', unavailableSubjects: [], detail: 'ok', complete: false }],
  },
}

const PRESETS: readonly TeamPresetRow[] = [
  { id: 'team', name: 'Team runtime', isDefault: false },
  { id: 'solo', name: 'Solo', isDefault: true },
]

const WORKSPACE: readonly TeamWorkspaceOption[] = [
  { id: 'wsp-1', title: 'Workspace one', path: 'C:\\work\\one' },
]

/** The preselected blueprint draft (the probe fires on mount). */
const BP_DRAFT: TeamIntentDraft = { ...emptyTeamIntentDraft, blueprintId: BP, revision: 2, presetId: 'team' }

/** The handoff source (UI §32.2: A is the source session, never converted). */
const SOURCE: TeamCreationHandoffSource = { sourceSessionId: SOURCE_SESSION, sourceWorkspaceId: 'wsp-1' }

/** The `handoff.prepare` one-shot summary value (the wire nests it under `summary`). */
const PREPARE_DATA = {
  sourceSessionId: SOURCE_SESSION,
  summary: {
    title: 'Session A one-shot summary',
    bullets: ['Decision: use the shared workspace', 'Open loop: verify the handoff replay'],
  },
}

/** A completed `handoff.create` state (invariant 9: same id, Root = TeamSession). */
const COMPLETED_DATA = {
  state: { kind: 'completed', replayed: false, team: { teamSessionId: 'root-team-1', rootSessionId: 'root-team-1' } },
}

const COMPLETED_WITHOUT_DATA = {
  state: { kind: 'completed-without-handoff', replayed: true, team: { teamSessionId: 'root-team-2', rootSessionId: 'root-team-2' } },
}

/** An awaiting-decision state (no host options → the full triad fallback). */
const AWAITING_DATA = {
  state: {
    kind: 'awaiting-decision',
    replayed: false,
    failure: { code: 'HANDOFF_SUMMARIZER_BUDGET', message: 'summarizer budget exhausted' },
  },
}

/** An awaiting-decision state narrowed by the host to RETRY only. */
const AWAITING_NARROWED_DATA = {
  state: {
    kind: 'awaiting-decision',
    replayed: false,
    failure: { code: 'HANDOFF_SUMMARIZER_BUDGET', message: 'summarizer budget exhausted' },
    options: ['retry'],
  },
}

/** A creation-failed state (RETRY only, the SAME token re-drives creation). */
const CREATED_FAILED_DATA = {
  state: {
    kind: 'creation-failed',
    replayed: false,
    failure: { code: 'TEAM_CREATE_FAILED', message: 'blueprint revision unavailable' },
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

/** One typed failure envelope (the closed code + wire message kept verbatim). */
function errorResponse(code: string, message: string, method: string): RemoteResponse {
  return {
    ok: false,
    error: {
      code, message,
      details: { method, endpoint: method, contractVersion: 1, requestToken: null },
    },
  }
}

/** A controllable promise (the mid-flight create assertions). */
function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** The panel face + the frozen handoff face (every member a spy). */
interface PanelFace {
  listCatalog: () => Promise<RemoteResponse>
  getCatalog: (params: RemoteCatalogGetParams) => Promise<RemoteResponse>
  probeCompatibility: (params: RemoteIntentProbeParams) => Promise<RemoteResponse>
  teamCreate: (params: RemoteTeamCreateParams) => Promise<RemoteResponse>
  createRootSession: (opts?: { readonly workspaceId?: string }) => Promise<string>
  listAgentPresets: () => Promise<readonly TeamPresetRow[]>
  prepare: (params: RemoteHandoffPrepareParams) => Promise<RemoteResponse>
  create: (params: RemoteHandoffCreateParams) => Promise<RemoteResponse>
}

function makeFace(overrides: Partial<PanelFace> = {}): PanelFace {
  return {
    listCatalog: vi.fn(() => Promise.resolve(okResponse(CATALOG_DATA, 'catalog.list'))),
    getCatalog: vi.fn(() => Promise.resolve(okResponse(DETAIL_DATA, 'catalog.get'))),
    probeCompatibility: vi.fn(() => Promise.resolve(okResponse(OPEN_DATA, 'intent.probe'))),
    teamCreate: vi.fn(() => Promise.resolve(okResponse({ teamSessionId: 'root-1' }, 'team.create'))),
    createRootSession: vi.fn(() => Promise.resolve('root-1')),
    listAgentPresets: vi.fn(() => Promise.resolve(PRESETS)),
    prepare: vi.fn(() => Promise.resolve(okResponse(PREPARE_DATA, 'handoff.prepare'))),
    create: vi.fn(() => Promise.resolve(okResponse(COMPLETED_DATA, 'handoff.create'))),
    ...overrides,
  }
}

/**
 * The harness mirrors TeamView's ownership of the draft (UI §5.3) and adds
 * the T8 optional handoff seam: absent (or the face absent) → the panel
 * renders exactly as T7.
 */
function PanelHarness(props: {
  readonly face: PanelFace
  readonly openSession?: ((sessionId: string) => void) | undefined
  readonly workspaces?: readonly TeamWorkspaceOption[]
  readonly initialDraft?: TeamIntentDraft
  readonly handoffSource?: TeamCreationHandoffSource
  readonly handoffFace?: PanelFace
  readonly draftSpy?: ((draft: TeamIntentDraft) => void) | undefined
}) {
  const [draft, setDraft] = useState<TeamIntentDraft>(props.initialDraft ?? emptyTeamIntentDraft)
  const onDraftChange = (next: TeamIntentDraft): void => {
    setDraft(next)
    props.draftSpy?.(next)
  }
  return (
    <TeamCreationPanel
      listCatalog={props.face.listCatalog}
      getCatalog={props.face.getCatalog}
      probeCompatibility={props.face.probeCompatibility}
      teamCreate={props.face.teamCreate}
      createRootSession={props.face.createRootSession}
      listAgentPresets={props.face.listAgentPresets}
      openSession={props.openSession ?? (() => undefined)}
      workspaces={props.workspaces ?? []}
      handoffSource={props.handoffSource}
      handoffFace={props.handoffFace}
      draft={draft}
      onDraftChange={onDraftChange}
      onCancel={() => undefined}
      t={makeTranslate(en)}
    />
  )
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

function handoffCheckbox(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>('[data-intent-handoff-checkbox]')
  if (el === null) throw new Error('the handoff checkbox did not render')
  return el
}

/** Wait for the create gate (the OPEN probe verdict has landed). */
async function waitForGate(view: { container: HTMLElement }): Promise<void> {
  await vi.waitFor(() => {
    expect(createButton(view.container).disabled).toBe(false)
  })
}

afterEach(cleanup)

describe('TeamCreationPanel (handoff, S5-D)', () => {
  it('renders the handoff block only when both the face and the source are present, enabled by default (UI §32.2)', () => {
    const face = makeFace()
    // Absent source → no block (the T7 rendering, byte-identical).
    const viewA = render(<PanelHarness face={face} handoffFace={face} />)
    expect(viewA.container.querySelector('[data-intent-handoff]')).toBeNull()
    viewA.unmount()
    // Absent face → no block either.
    const viewB = render(<PanelHarness face={face} handoffSource={SOURCE} />)
    expect(viewB.container.querySelector('[data-intent-handoff]')).toBeNull()
    viewB.unmount()
    // Both present → the block with the §32.2 source label, checked by default.
    const view = render(<PanelHarness face={face} handoffSource={SOURCE} handoffFace={face} />)
    const block = view.container.querySelector('[data-intent-handoff]')
    if (block === null) throw new Error('the handoff block did not render')
    expect(block.textContent).toContain('Context handoff')
    expect(block.textContent).toContain(`Source: "${SOURCE_SESSION}"`)
    expect(handoffCheckbox(view.container).checked).toBe(true)
  })

  it('prefills the default workspace from the source session workspace when the feed carries it (UI §32.2)', async () => {
    const face = makeFace()
    const view = render(
      <PanelHarness face={face} workspaces={WORKSPACE} handoffSource={SOURCE} handoffFace={face} />,
    )
    await vi.waitFor(() => {
      expect(workspaceSelect(view.container).value).toBe('wsp-1')
    })
  })

  it('does not prefill when the feed lacks the workspace or the draft already picked one (UI §32.2)', () => {
    const face = makeFace()
    // Feed lacks the source workspace → no prefill.
    const other: readonly TeamWorkspaceOption[] = [{ id: 'wsp-9', title: 'Other', path: 'C:\\work\\nine' }]
    const viewA = render(
      <PanelHarness face={face} workspaces={other} handoffSource={SOURCE} handoffFace={face} />,
    )
    expect(workspaceSelect(viewA.container).value).toBe('')
    viewA.unmount()
    // The draft already carries a workspace → the prefill is a no-op (never overrides).
    const spy = vi.fn()
    const viewB = render(
      <PanelHarness
        face={face}
        workspaces={WORKSPACE}
        handoffSource={SOURCE}
        handoffFace={face}
        initialDraft={{ ...emptyTeamIntentDraft, workspaceId: 'wsp-1' }}
        draftSpy={spy}
      />,
    )
    expect(workspaceSelect(viewB.container).value).toBe('wsp-1')
    expect(spy).not.toHaveBeenCalled()
  })

  it('enabling the handoff runs the one-shot prepare read and shows the summary preview (UI §32.3)', async () => {
    const face = makeFace()
    const view = render(<PanelHarness face={face} handoffSource={SOURCE} handoffFace={face} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-handoff-ready]')).toBeTruthy()
    })
    expect(face.prepare).toHaveBeenCalledTimes(1)
    expect(face.prepare).toHaveBeenCalledWith({ sourceSessionId: SOURCE_SESSION } satisfies RemoteHandoffPrepareParams)
    const ready = view.container.querySelector('[data-intent-handoff-ready]')
    if (ready === null) throw new Error('the ready block did not render')
    expect(ready.textContent).toContain('Summary ready')
    const preview = view.container.querySelector<HTMLButtonElement>('[data-intent-handoff-preview]')
    if (preview === null) throw new Error('the preview button did not render')
    fireEvent.click(preview)
    const body = view.container.querySelector('[data-intent-handoff-preview-body]')
    if (body === null) throw new Error('the preview body did not render')
    expect(body.textContent).toContain('Session A one-shot summary')
    const bullets = [...body.querySelectorAll('[data-intent-handoff-summary-bullets] li')].map(li => li.textContent)
    expect(bullets).toEqual(['Decision: use the shared workspace', 'Open loop: verify the handoff replay'])
  })

  it('unchecking cancels the pending preview and re-checking re-runs the one-shot read (UI §32.3)', async () => {
    const face = makeFace()
    const view = render(<PanelHarness face={face} handoffSource={SOURCE} handoffFace={face} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-handoff-ready]')).toBeTruthy()
    })
    expect(face.prepare).toHaveBeenCalledTimes(1)
    // Click, not change: React maps a checkbox's onChange to the CLICK
    // event only (react-dom ChangeEventPlugin `shouldUseClickEvent`) — a
    // dispatched `change` never reaches the handler, so a
    // `fireEvent.change` here can never uncheck a controlled checkbox.
    // (Latent spec bug: this suite never ran green before the S9 client
    // vitest infra overhaul.)
    fireEvent.click(handoffCheckbox(view.container))
    expect(view.container.querySelector('[data-intent-handoff-ready]')).toBeNull()
    expect(face.prepare).toHaveBeenCalledTimes(1)
    // Re-check via click as well (jsdom activation flips the DOM checked,
    // React's click path sees the value change and re-fires the read).
    fireEvent.click(handoffCheckbox(view.container))
    await vi.waitFor(() => {
      expect(face.prepare).toHaveBeenCalledTimes(2)
    })
    expect(face.prepare).toHaveBeenLastCalledWith({ sourceSessionId: SOURCE_SESSION } satisfies RemoteHandoffPrepareParams)
  })

  it('a prepare typed failure renders verbatim and NEVER blocks the create (UI §32.3/§32.4)', async () => {
    const face = makeFace({
      prepare: vi.fn(() => Promise.resolve(
        errorResponse('HANDOFF_SOURCE_SURFACE_UNAVAILABLE', 'source surface unavailable', 'handoff.prepare'),
      )),
    })
    const view = render(
      <PanelHarness face={face} handoffSource={SOURCE} handoffFace={face} initialDraft={BP_DRAFT} />,
    )
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-handoff-prepare-error]')).toBeTruthy()
    })
    expect(view.container.querySelector('[data-intent-handoff-prepare-error]')?.textContent)
      .toBe('Error: HANDOFF_SOURCE_SURFACE_UNAVAILABLE: source surface unavailable')
    expect(view.container.querySelector('[data-intent-handoff-ready]')).toBeNull()
    // The create gate is unaffected: the preview is a read-only convenience,
    // the handoff.create fresh-op path snapshots the source itself.
    await waitForGate(view)
    expect(handoffCheckbox(view.container).checked).toBe(true)
  })

  it('the handoff create runs the frozen face with a fresh token and NO native root (G5: no optimistic patch, no cold root)', async () => {
    const created = deferred<RemoteResponse>()
    const face = makeFace({ create: vi.fn(() => created.promise) })
    const openSession = vi.fn()
    const view = render(
      <PanelHarness face={face} openSession={openSession} handoffSource={SOURCE} handoffFace={face} initialDraft={BP_DRAFT} />,
    )
    await waitForGate(view)
    fireEvent.click(createButton(view.container))
    expect(face.create).toHaveBeenCalledTimes(1)
    expect(face.create).toHaveBeenCalledWith({
      sourceSessionId: SOURCE_SESSION,
      requestToken: 'handoff-create-1',
    } satisfies RemoteHandoffCreateParams)
    expect(face.createRootSession).not.toHaveBeenCalled()
    expect(face.teamCreate).not.toHaveBeenCalled()
    expect(openSession).not.toHaveBeenCalled()
    // Busy: the create button disables mid-flight.
    expect(createButton(view.container).disabled).toBe(true)
    created.resolve(okResponse(COMPLETED_DATA, 'handoff.create'))
    await act(async () => {})
    expect(createButton(view.container).disabled).toBe(false)
    expect(openSession).toHaveBeenCalledTimes(1)
    expect(openSession).toHaveBeenCalledWith('root-team-1')
  })

  it('a completed-without-handoff state opens the Root as well (invariant 9: same id)', async () => {
    const face = makeFace({
      create: vi.fn(() => Promise.resolve(okResponse(COMPLETED_WITHOUT_DATA, 'handoff.create'))),
    })
    const openSession = vi.fn()
    const view = render(
      <PanelHarness face={face} openSession={openSession} handoffSource={SOURCE} handoffFace={face} initialDraft={BP_DRAFT} />,
    )
    await waitForGate(view)
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(openSession).toHaveBeenCalledTimes(1)
    })
    expect(openSession).toHaveBeenCalledWith('root-team-2')
  })

  it('an awaiting-decision state renders the full triad (host options absent) and Retry re-invokes with a FRESH token (plan §10.5)', async () => {
    const second = deferred<RemoteResponse>()
    let calls = 0
    const face = makeFace({
      create: vi.fn(() => {
        calls += 1
        if (calls === 1) return Promise.resolve(okResponse(AWAITING_DATA, 'handoff.create'))
        return second.promise
      }),
    })
    const openSession = vi.fn()
    const view = render(
      <PanelHarness face={face} openSession={openSession} handoffSource={SOURCE} handoffFace={face} initialDraft={BP_DRAFT} />,
    )
    await waitForGate(view)
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-handoff-failed]')).toBeTruthy()
    })
    const failed = view.container.querySelector<HTMLElement>('[data-intent-handoff-failed]')
    if (failed === null) throw new Error('the failed block did not render')
    expect(failed.dataset.intentHandoffFailedCode).toBe('HANDOFF_SUMMARIZER_BUDGET')
    expect(failed.dataset.intentHandoffFailedToken).toBe('handoff-create-1')
    expect(failed.textContent).toContain('Context handoff failed: HANDOFF_SUMMARIZER_BUDGET: summarizer budget exhausted')
    expect(view.container.querySelector('[data-intent-handoff-retry]')).toBeTruthy()
    expect(view.container.querySelector('[data-intent-handoff-continue]')).toBeTruthy()
    expect(view.container.querySelector('[data-intent-handoff-cancel]')).toBeTruthy()
    // Retry: a FRESH token (a same-token re-invocation would only replay the stored failure).
    fireEvent.click(view.container.querySelector('[data-intent-handoff-retry]')!)
    expect(face.create).toHaveBeenCalledTimes(2)
    expect(face.create).toHaveBeenLastCalledWith({
      sourceSessionId: SOURCE_SESSION,
      requestToken: 'handoff-create-2',
    } satisfies RemoteHandoffCreateParams)
    second.resolve(okResponse({ state: { kind: 'canceled', replayed: true } }, 'handoff.create'))
    await act(async () => {})
    // The terminal canceled state: no triad, no openSession.
    expect(view.container.querySelector('[data-intent-handoff-failed]')).toBeNull()
    expect(openSession).not.toHaveBeenCalled()
  })

  it('an awaiting-decision state narrowed by the host renders only the host options', async () => {
    const face = makeFace({
      create: vi.fn(() => Promise.resolve(okResponse(AWAITING_NARROWED_DATA, 'handoff.create'))),
    })
    const view = render(
      <PanelHarness face={face} handoffSource={SOURCE} handoffFace={face} initialDraft={BP_DRAFT} />,
    )
    await waitForGate(view)
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-handoff-failed]')).toBeTruthy()
    })
    expect(view.container.querySelector('[data-intent-handoff-retry]')).toBeTruthy()
    expect(view.container.querySelector('[data-intent-handoff-continue]')).toBeNull()
    expect(view.container.querySelector('[data-intent-handoff-cancel]')).toBeNull()
  })

  it('Continue without handoff is the client-local explicit decision: the standard create path, no handoff re-drive (UI §32.4)', async () => {
    const face = makeFace({
      create: vi.fn(() => Promise.resolve(okResponse(AWAITING_DATA, 'handoff.create'))),
    })
    const openSession = vi.fn()
    const view = render(
      <PanelHarness
        face={face}
        openSession={openSession}
        workspaces={WORKSPACE}
        handoffSource={SOURCE}
        handoffFace={face}
        initialDraft={{ ...BP_DRAFT, workspaceId: 'wsp-1' }}
      />,
    )
    await waitForGate(view)
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-handoff-continue]')).toBeTruthy()
    })
    fireEvent.click(view.container.querySelector('[data-intent-handoff-continue]')!)
    expect(face.create).toHaveBeenCalledTimes(1)
    expect(face.createRootSession).toHaveBeenCalledTimes(1)
    expect(face.createRootSession).toHaveBeenCalledWith({ workspaceId: 'wsp-1' })
    // The standard sequence settles across awaits (native root →
    // team.create → open the root); flush the microtask chain before
    // asserting its later legs.
    await vi.waitFor(() => {
      expect(face.teamCreate).toHaveBeenCalledTimes(1)
    })
    await vi.waitFor(() => {
      expect(openSession).toHaveBeenCalledTimes(1)
    })
    expect(openSession).toHaveBeenCalledWith('root-1')
    // The decision is client-local state: the checkbox is now unchecked.
    expect(handoffCheckbox(view.container).checked).toBe(false)
  })

  it('Cancel discards the attempt client-locally (NO remote call) and is terminal: later creates run the standard path (plan §10.5)', async () => {
    const face = makeFace({
      create: vi.fn(() => Promise.resolve(okResponse(AWAITING_DATA, 'handoff.create'))),
    })
    const openSession = vi.fn()
    const view = render(
      <PanelHarness face={face} openSession={openSession} handoffSource={SOURCE} handoffFace={face} initialDraft={BP_DRAFT} />,
    )
    await waitForGate(view)
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-handoff-cancel]')).toBeTruthy()
    })
    fireEvent.click(view.container.querySelector('[data-intent-handoff-cancel]')!)
    // Client-local: no remote call of any kind.
    expect(face.create).toHaveBeenCalledTimes(1)
    expect(face.createRootSession).not.toHaveBeenCalled()
    expect(face.teamCreate).not.toHaveBeenCalled()
    expect(openSession).not.toHaveBeenCalled()
    expect(view.container.querySelector('[data-intent-handoff-canceled]')?.textContent).toBe('Handoff canceled')
    expect(view.container.querySelector('[data-intent-handoff-failed]')).toBeNull()
    // Terminal: a later create click must not silently re-open the handoff.
    fireEvent.click(createButton(view.container))
    expect(face.create).toHaveBeenCalledTimes(1)
    expect(face.createRootSession).toHaveBeenCalledTimes(1)
    // The later create settles across awaits (root → team.create → open);
    // flush the microtask chain before asserting its later legs.
    await vi.waitFor(() => {
      expect(face.teamCreate).toHaveBeenCalledTimes(1)
    })
    await vi.waitFor(() => {
      expect(openSession).toHaveBeenCalledTimes(1)
    })
    expect(openSession).toHaveBeenCalledWith('root-1')
  })

  it('a creation-failed state renders RETRY only and the Retry re-invokes with the SAME token (plan §10.5)', async () => {
    const face = makeFace({
      create: vi.fn(() => Promise.resolve(okResponse(CREATED_FAILED_DATA, 'handoff.create'))),
    })
    const view = render(
      <PanelHarness face={face} handoffSource={SOURCE} handoffFace={face} initialDraft={BP_DRAFT} />,
    )
    await waitForGate(view)
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-handoff-failed]')).toBeTruthy()
    })
    const failed = view.container.querySelector<HTMLElement>('[data-intent-handoff-failed]')
    if (failed === null) throw new Error('the failed block did not render')
    expect(failed.dataset.intentHandoffFailedCode).toBe('TEAM_CREATE_FAILED')
    expect(failed.dataset.intentHandoffFailedToken).toBe('handoff-create-1')
    expect(failed.textContent).toContain('Context handoff failed: TEAM_CREATE_FAILED: blueprint revision unavailable')
    expect(view.container.querySelector('[data-intent-handoff-retry]')).toBeTruthy()
    expect(view.container.querySelector('[data-intent-handoff-continue]')).toBeNull()
    expect(view.container.querySelector('[data-intent-handoff-cancel]')).toBeNull()
    // Retry: the SAME (sourceSessionId, requestToken) — the host re-drives ONLY creation.
    fireEvent.click(view.container.querySelector('[data-intent-handoff-retry]')!)
    expect(face.create).toHaveBeenCalledTimes(2)
    expect(face.create).toHaveBeenLastCalledWith({
      sourceSessionId: SOURCE_SESSION,
      requestToken: 'handoff-create-1',
    } satisfies RemoteHandoffCreateParams)
  })

  it('a typed handoff.create response failure (ok:false, no stored state) renders the full triad with a fresh-token Retry', async () => {
    const face = makeFace({
      create: vi.fn(() => Promise.resolve(
        errorResponse('HANDOFF_CREATE_REJECTED', 'source session archived', 'handoff.create'),
      )),
    })
    const openSession = vi.fn()
    const view = render(
      <PanelHarness face={face} openSession={openSession} handoffSource={SOURCE} handoffFace={face} initialDraft={BP_DRAFT} />,
    )
    await waitForGate(view)
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-handoff-failed]')).toBeTruthy()
    })
    const failed = view.container.querySelector<HTMLElement>('[data-intent-handoff-failed]')
    if (failed === null) throw new Error('the failed block did not render')
    expect(failed.dataset.intentHandoffFailedCode).toBe('HANDOFF_CREATE_REJECTED')
    expect(failed.dataset.intentHandoffFailedToken).toBe('handoff-create-1')
    expect(failed.textContent).toContain('Context handoff failed: HANDOFF_CREATE_REJECTED: source session archived')
    expect(view.container.querySelector('[data-intent-handoff-retry]')).toBeTruthy()
    expect(view.container.querySelector('[data-intent-handoff-continue]')).toBeTruthy()
    expect(view.container.querySelector('[data-intent-handoff-cancel]')).toBeTruthy()
    expect(openSession).not.toHaveBeenCalled()
    // No operation exists under the used token → the retry mints a fresh one.
    fireEvent.click(view.container.querySelector('[data-intent-handoff-retry]')!)
    expect(face.create).toHaveBeenCalledTimes(2)
    expect(face.create).toHaveBeenLastCalledWith({
      sourceSessionId: SOURCE_SESSION,
      requestToken: 'handoff-create-2',
    } satisfies RemoteHandoffCreateParams)
  })

  it('a handoff.create transport loss (the only rejection kind) records the local native-error marker, no optimistic state', async () => {
    const face = makeFace({ create: vi.fn(() => Promise.reject(new Error('channel lost'))) })
    const openSession = vi.fn()
    const view = render(
      <PanelHarness face={face} openSession={openSession} handoffSource={SOURCE} handoffFace={face} initialDraft={BP_DRAFT} />,
    )
    await waitForGate(view)
    fireEvent.click(createButton(view.container))
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-handoff-failed]')).toBeTruthy()
    })
    const failed = view.container.querySelector<HTMLElement>('[data-intent-handoff-failed]')
    if (failed === null) throw new Error('the failed block did not render')
    expect(failed.dataset.intentHandoffFailedCode).toBe('native-error')
    expect(failed.textContent).toContain('Context handoff failed: native-error: channel lost')
    expect(view.container.querySelector('[data-intent-handoff-retry]')).toBeTruthy()
    expect(openSession).not.toHaveBeenCalled()
  })
})
