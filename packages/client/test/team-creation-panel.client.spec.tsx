// @vitest-environment jsdom
/**
 * The New Team creation panel (P9-T7, S5-A; UI doc §3–§9, Gate P9-G5):
 * the catalog picker with per-row display names (the frozen `catalog.list`
 * / `catalog.get`), the revision select, the native workspace picker
 * (hidden on an empty feed), the runtime AgentPreset select (UI §7: the
 * `team` row preselected, free switching re-runs the probe), the
 * initial-work draft, and the live `intent.probe` compatibility block —
 * PASS ✓ Ready, WARNING list + explicit (never default-checked)
 * acknowledgement, FATAL ✕ with the §7.4 complete-persona remedy and NO
 * Continue-anyway.
 *
 * Create sequence coverage (UI §4.3 canonical order, locked T7; D-3
 * revision): minted root id (`session-<uuid>`, no native pre-create) →
 * frozen `team.create` (the host mints the session + starts the leader)
 * → `openCreatedSession(rootId)`; a typed `team.create` failure keeps the
 * verbatim error + the retained-root note + a retry that reuses the SAME
 * minted id (G5: no optimistic authority patch anywhere, the rendered
 * state stays projection-driven); a failed creation-path open surfaces
 * the local `native-error` marker with the retained root (D-3).
 *
 * The draft is parent-held here (the harness mirrors TeamView, which owns
 * the draft in view state so it persists within the page run, UI §5.3).
 * The panel never mutates the draft in place: every control goes through
 * `onDraftChange`.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  RemoteCatalogGetParams, RemoteIntentProbeParams, RemoteResponse, RemoteSafeJsonValue, RemoteTeamCreateParams,
} from '../../remote/src/index.js'
import type {
  TeamIntentDraft, TeamPresetRow, TeamWorkspaceOption,
} from '../src/model/team-intent-model.js'
import { emptyTeamIntentDraft } from '../src/model/team-intent-model.js'
import { TeamCreationPanel } from '../src/ui/TeamCreationPanel.js'
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
    members: [{ templateId: 'tpl-lead' }, { templateId: 'tpl-mate' }],
  },
}

/** An OPEN probe verdict (PASS rows are skipped by the parser). */
const OPEN_DATA = {
  compatibility: {
    status: 'OPEN',
    requirements: [{ outcome: 'PASS', requirementId: 'req-1', unavailableSubjects: [], detail: 'ok', complete: false }],
  },
}

/** A BLOCKED_WARNING verdict (the §9.2 warning list + local ack gate). */
const WARNING_DATA = {
  compatibility: {
    status: 'BLOCKED_WARNING',
    requirements: [
      {
        outcome: 'WARNING', requirementId: 'req-gpu', unavailableSubjects: ['env-gpu'],
        detail: 'GPU pool unavailable', complete: false,
      },
    ],
  },
}

/** The §7.4 complete-persona preset conflict (FATAL + the frozen reason code). */
const FATAL_PERSONA_DATA = {
  compatibility: {
    status: 'BLOCKED_FATAL',
    requirements: [
      {
        outcome: 'FATAL', requirementId: 'req-persona', unavailableSubjects: [],
        detail: 'preset owns a complete system persona', complete: true,
        reasonCode: 'TEAM_PERSONA_COMPLETE_PRESET_CONFLICT',
      },
    ],
  },
}

const PRESETS: readonly TeamPresetRow[] = [
  { id: 'team', name: 'Team 运行时', isDefault: false },
  { id: 'solo', name: 'Solo', isDefault: true },
]

const WORKSPACE: readonly TeamWorkspaceOption[] = [
  { id: 'wsp-1', title: '工作区一', path: 'C:\\work\\one' },
]

/** The preselected blueprint draft (the probe fires on mount). */
const BP_DRAFT: TeamIntentDraft = { ...emptyTeamIntentDraft, blueprintId: BP, revision: 2, presetId: 'team' }

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

/** The creation face (every member a spy; the defaults are the happy path). */
interface PanelFace {
  listCatalog: () => Promise<RemoteResponse>
  getCatalog: (params: RemoteCatalogGetParams) => Promise<RemoteResponse>
  probeCompatibility: (params: RemoteIntentProbeParams) => Promise<RemoteResponse>
  teamCreate: (params: RemoteTeamCreateParams) => Promise<RemoteResponse>
  listAgentPresets: () => Promise<readonly TeamPresetRow[]>
}

function makeFace(overrides: Partial<PanelFace> = {}): PanelFace {
  return {
    listCatalog: vi.fn(() => Promise.resolve(okResponse(CATALOG_DATA, 'catalog.list'))),
    getCatalog: vi.fn(() => Promise.resolve(okResponse(DETAIL_DATA, 'catalog.get'))),
    probeCompatibility: vi.fn(() => Promise.resolve(okResponse(OPEN_DATA, 'intent.probe'))),
    teamCreate: vi.fn(() => Promise.resolve(okResponse({ teamSessionId: 'root-1' }, 'team.create'))),
    listAgentPresets: vi.fn(() => Promise.resolve(PRESETS)),
    ...overrides,
  }
}

/**
 * The harness mirrors TeamView's ownership of the draft (UI §5.3: the draft
 * is page-run UI state only — never authority) so the panel stays
 * controlled exactly as in the view.
 */
function PanelHarness(props: {
  readonly face: PanelFace
  readonly openCreatedSession?: ((sessionId: string) => Promise<void>) | undefined
  readonly workspaces?: readonly TeamWorkspaceOption[]
  readonly initialDraft?: TeamIntentDraft
  readonly onCancel?: (() => void) | undefined
  readonly onDraftChangeSpy?: ((draft: TeamIntentDraft) => void) | undefined
}) {
  const [draft, setDraft] = useState<TeamIntentDraft>(props.initialDraft ?? emptyTeamIntentDraft)
  return (
    <TeamCreationPanel
      listCatalog={props.face.listCatalog}
      getCatalog={props.face.getCatalog}
      probeCompatibility={props.face.probeCompatibility}
      teamCreate={props.face.teamCreate}
      listAgentPresets={props.face.listAgentPresets}
      openCreatedSession={props.openCreatedSession ?? (async () => undefined)}
      workspaces={props.workspaces ?? []}
      draft={draft}
      onDraftChange={(next) => {
        props.onDraftChangeSpy?.(next)
        setDraft(next)
      }}
      onCancel={props.onCancel ?? (() => undefined)}
      t={makeTranslate(zh)}
    />
  )
}

function blueprintSelect(container: HTMLElement): HTMLSelectElement {
  const el = container.querySelector<HTMLSelectElement>('[data-intent-blueprint]')
  if (el === null) throw new Error('the blueprint select did not render')
  return el
}

function revisionSelect(container: HTMLElement): HTMLSelectElement {
  const el = container.querySelector<HTMLSelectElement>('[data-intent-revision]')
  if (el === null) throw new Error('the revision select did not render')
  return el
}

function presetSelect(container: HTMLElement): HTMLSelectElement {
  const el = container.querySelector<HTMLSelectElement>('[data-intent-preset]')
  if (el === null) throw new Error('the preset select did not render')
  return el
}

function ackCheckbox(container: HTMLElement): HTMLInputElement | null {
  return container.querySelector<HTMLInputElement>('[data-intent-ack] input[type="checkbox"]')
}

function createButton(container: HTMLElement): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>('[data-intent-create]')
  if (el === null) throw new Error('the create button did not render')
  return el
}

afterEach(cleanup)

describe('TeamCreationPanel', () => {
  it('loads the catalog rows with the per-row display names and preselects the team preset (S0 seam, UI §6/§7.2)', async () => {
    const face = makeFace()
    const view = render(<PanelHarness face={face} />)
    await vi.waitFor(() => {
      expect(blueprintSelect(view.container).disabled).toBe(false)
    })
    const options = [...blueprintSelect(view.container).querySelectorAll('option')]
      .filter(option => option.value !== '')
    expect(options.map(option => option.textContent)).toEqual(['Atlas (rev 2)'])
    // The §7.2 default: the `team` row wins (not the isDefault flag).
    expect(presetSelect(view.container).value).toBe('team')
    expect(presetSelect(view.container).disabled).toBe(false)
  })

  it('shows the verbatim catalog failure note and keeps the picker disabled (loud, never silent)', async () => {
    const face = makeFace({
      listCatalog: vi.fn(() => Promise.resolve(errorResponse('CATALOG_UNAVAILABLE', 'catalog store down', 'catalog.list'))),
    })
    const view = render(<PanelHarness face={face} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-catalog-error]')).toBeTruthy()
    })
    expect(view.container.querySelector('[data-intent-catalog-error]')?.textContent)
      .toBe('蓝图目录加载失败：CATALOG_UNAVAILABLE: catalog store down')
    expect(blueprintSelect(view.container).disabled).toBe(true)
  })

  it('selecting a blueprint loads the detail block and fires the persona-fact probe (S5-A, UI §6/§7)', async () => {
    const face = makeFace()
    const view = render(<PanelHarness face={face} />)
    await vi.waitFor(() => {
      expect(blueprintSelect(view.container).disabled).toBe(false)
      expect(presetSelect(view.container).disabled).toBe(false)
    })
    fireEvent.change(blueprintSelect(view.container), { target: { value: BP } })
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-detail]')).toBeTruthy()
    })
    expect(view.container.querySelector('[data-intent-detail-name]')?.textContent).toBe('Atlas')
    expect(view.container.querySelector('[data-intent-detail-source]')?.textContent).toBe('builtin')
    expect(view.container.querySelector('[data-intent-detail-description]')?.textContent).toBe('Atlas blueprint')
    expect(view.container.querySelector('[data-intent-detail-templates]')?.textContent).toBe('2')
    // The revision select defaults to the latest.
    const revisions = [...revisionSelect(view.container).querySelectorAll('option')].map(option => option.value)
    expect(revisions).toEqual(['1', '2'])
    expect(revisionSelect(view.container).value).toBe('2')
    // Exactly one probe: the selected preset travels ONLY as the persona
    // environment fact (the only frozen environment channel).
    expect(face.probeCompatibility).toHaveBeenCalledTimes(1)
    expect(face.probeCompatibility).toHaveBeenCalledWith({
      blueprintId: BP,
      blueprintRevision: 2,
      environmentFacts: [{ domain: 'persona', subject: 'team', available: true, generation: 0 }],
    })
    await vi.waitFor(() => {
      expect(view.container.querySelector<HTMLElement>('[data-intent-compatibility]')?.dataset.intentStatus).toBe('OPEN')
    })
    expect(view.container.querySelector('[data-intent-compatibility]')?.textContent).toContain('✓ 就绪')
  })

  it('an OPEN verdict enables Create with the work-aware label (UI §9)', async () => {
    const face = makeFace()
    const view = render(<PanelHarness face={face} initialDraft={BP_DRAFT} />)
    const button = createButton(view.container)
    await vi.waitFor(() => {
      expect(button.disabled).toBe(false)
    })
    expect(button.textContent).toBe('创建团队')
    const work = view.container.querySelector<HTMLTextAreaElement>('[data-intent-initial-work]')
    if (work === null) throw new Error('the initial-work textarea did not render')
    fireEvent.change(work, { target: { value: '  调研 X ' } })
    expect(createButton(view.container).textContent).toBe('创建并发送')
  })

  it('a BLOCKED_WARNING verdict lists the warnings and gates Create behind the explicit ack (UI §9.2)', async () => {
    const face = makeFace({
      probeCompatibility: vi.fn(() => Promise.resolve(okResponse(WARNING_DATA, 'intent.probe'))),
    })
    const view = render(<PanelHarness face={face} initialDraft={BP_DRAFT} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-warning]')).toBeTruthy()
    })
    const row = view.container.querySelector('[data-intent-warning]')
    expect(row).toBeTruthy()
    expect(row!.querySelectorAll('span').length).toBe(3)
    expect(row!.textContent).toContain('需求 req-gpu')
    expect(row!.textContent).toContain('不可用: env-gpu')
    expect(row!.textContent).toContain('GPU pool unavailable')
    const button = createButton(view.container)
    expect(button.disabled).toBe(true)
    expect(button.textContent).toBe('确认警告并创建')
    const box = ackCheckbox(view.container)
    expect(box).not.toBeNull()
    expect(box!.checked).toBe(false)
    fireEvent.click(box!)
    expect(createButton(view.container).disabled).toBe(false)
  })

  it('a new probe verdict resets the local ack (the frozen engine drift semantics, UI §9.2)', async () => {
    const face = makeFace({
      probeCompatibility: vi.fn(() => Promise.resolve(okResponse(WARNING_DATA, 'intent.probe'))),
    })
    const view = render(<PanelHarness face={face} initialDraft={BP_DRAFT} />)
    await vi.waitFor(() => {
      expect(ackCheckbox(view.container)).not.toBeNull()
    })
    fireEvent.click(ackCheckbox(view.container)!)
    expect(createButton(view.container).disabled).toBe(false)
    // A revision change re-runs the probe; the new verdict binds a new
    // mismatch set → the ack must land unchecked again.
    fireEvent.change(revisionSelect(view.container), { target: { value: '1' } })
    await vi.waitFor(() => {
      const box = ackCheckbox(view.container)
      expect(box).not.toBeNull()
      expect(box!.checked).toBe(false)
    })
    expect(createButton(view.container).disabled).toBe(true)
  })

  it('a complete-persona preset FATAL disables Create with the §7.4 remedy and no Continue-anyway', async () => {
    const face = makeFace({
      probeCompatibility: vi.fn(() => Promise.resolve(okResponse(FATAL_PERSONA_DATA, 'intent.probe'))),
    })
    const view = render(<PanelHarness face={face} initialDraft={BP_DRAFT} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-fatal]')).toBeTruthy()
    })
    expect(view.container.querySelector('[data-intent-fatal]')?.textContent)
      .toContain('✕ 团队无法创建')
    expect(view.container.querySelector('[data-intent-fatal]')?.textContent)
      .toContain('需求 req-persona — preset owns a complete system persona')
    expect(view.container.querySelector('[data-intent-fatal]')?.textContent)
      .toBe('✕ 团队无法创建需求 req-persona — preset owns a complete system persona该运行时预设拥有完整的系统人格，无法承载此团队蓝图的 Leader/Member 身份（不改变 DSH 核心语义）。')
    expect(ackCheckbox(view.container)).toBeNull()
    expect(view.container.querySelector('[data-intent-retry]')).toBeNull()
    expect(createButton(view.container).disabled).toBe(true)
  })

  it('switching the runtime preset re-runs the probe with the new persona fact (UI §7.3)', async () => {
    const face = makeFace()
    const view = render(<PanelHarness face={face} initialDraft={BP_DRAFT} />)
    const button = createButton(view.container)
    await vi.waitFor(() => {
      expect(button.disabled).toBe(false)
    })
    fireEvent.change(presetSelect(view.container), { target: { value: 'solo' } })
    await vi.waitFor(() => {
      expect(face.probeCompatibility).toHaveBeenLastCalledWith({
        blueprintId: BP,
        blueprintRevision: 2,
        environmentFacts: [{ domain: 'persona', subject: 'solo', available: true, generation: 0 }],
      })
    })
    // The OPEN verdict still lands: Create stays enabled.
    await vi.waitFor(() => {
      expect(createButton(view.container).disabled).toBe(false)
    })
  })

  it('create happy path: minted root id → frozen team.create → open the Root (UI §4.3 order; D-3)', async () => {
    const created = deferred<RemoteResponse>()
    const teamCreateMock = vi.fn(
      (_params: RemoteTeamCreateParams): Promise<RemoteResponse> => created.promise,
    )
    const face = makeFace({ teamCreate: teamCreateMock })
    const openCreatedSession = vi.fn(async () => undefined)
    const view = render(
      <PanelHarness
        face={face}
        openCreatedSession={openCreatedSession}
        workspaces={WORKSPACE}
        initialDraft={{ ...BP_DRAFT, workspaceId: 'wsp-1', initialWork: ' 调研 ' }}
      />,
    )
    const button = createButton(view.container)
    await vi.waitFor(() => {
      expect(button.disabled).toBe(false)
    })
    fireEvent.click(button)
    // CREATING: the label flips and the cluster disables.
    expect(createButton(view.container).textContent).toBe('正在创建…')
    expect(createButton(view.container).disabled).toBe(true)
    // D-3: the id is minted client-side (the `session-` shape) — no native
    // pre-creation anywhere; the host mints the session under this id.
    await vi.waitFor(() => {
      expect(face.teamCreate).toHaveBeenCalledTimes(1)
    })
    const createParams = teamCreateMock.mock.calls[0]![0]!
    expect(typeof createParams.rootSessionId).toBe('string')
    expect(createParams.rootSessionId.startsWith('session-')).toBe(true)
    await act(async () => {
      created.resolve(okResponse({ teamSessionId: 'root-1' }, 'team.create'))
    })
    expect(createParams.blueprintId).toBe(BP)
    expect(createParams.blueprintRevision).toBe(2)
    expect(createParams.initialWork).toEqual({ prompt: '调研' })
    await vi.waitFor(() => {
      expect(openCreatedSession).toHaveBeenCalledTimes(1)
    })
    expect(openCreatedSession).toHaveBeenCalledWith(createParams.rootSessionId)
  })

  it('a typed team.create failure keeps the verbatim error, the retained-root note, and a root-reusing retry (G5)', async () => {
    const teamCreateMock = vi.fn(
      (_params: RemoteTeamCreateParams): Promise<RemoteResponse> =>
        Promise.resolve(errorResponse('ADMISSION_REJECTED', 'prompt too long', 'team.create')),
    )
    const face = makeFace({ teamCreate: teamCreateMock })
    const openCreatedSession = vi.fn(async () => undefined)
    const view = render(<PanelHarness face={face} openCreatedSession={openCreatedSession} initialDraft={BP_DRAFT} />)
    const button = createButton(view.container)
    await vi.waitFor(() => {
      expect(button.disabled).toBe(false)
    })
    fireEvent.click(button)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-create-error]')).toBeTruthy()
    })
    // The typed Remote result, verbatim (no optimistic authority patch).
    expect(view.container.querySelector('[data-intent-create-error]')?.textContent)
      .toBe('创建失败：ADMISSION_REJECTED: prompt too longRoot 会话 ID 已保留；团队创建失败，可重试（重试复用同一 ID）。')
    expect(openCreatedSession).not.toHaveBeenCalled()
    const retry = view.container.querySelector<HTMLButtonElement>('[data-intent-retry]')
    expect(retry).not.toBeNull()
    fireEvent.click(retry!)
    await vi.waitFor(() => {
      expect(face.teamCreate).toHaveBeenCalledTimes(2)
    })
    // RETRY re-runs team.create on the SAME retained minted root (the host
    // re-drives the leader start on the cold path).
    expect(face.teamCreate).toHaveBeenLastCalledWith(expect.objectContaining({
      rootSessionId: teamCreateMock.mock.calls[0]![0]!.rootSessionId,
      blueprintId: BP,
      blueprintRevision: 2,
    }))
  })

  it('a failed creation-path open surfaces the native-error marker with the retained root (D-3)', async () => {
    const teamCreateMock = vi.fn(
      (_params: RemoteTeamCreateParams): Promise<RemoteResponse> =>
        Promise.resolve(okResponse({ teamSessionId: 'root-1' }, 'team.create')),
    )
    const face = makeFace({ teamCreate: teamCreateMock })
    const openCreatedSession = vi.fn(async () => {
      throw new Error('sessions.select: unknown session session-x')
    })
    const view = render(<PanelHarness face={face} openCreatedSession={openCreatedSession} initialDraft={BP_DRAFT} />)
    const button = createButton(view.container)
    await vi.waitFor(() => {
      expect(button.disabled).toBe(false)
    })
    fireEvent.click(button)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-create-error]')).toBeTruthy()
    })
    // The verbatim open failure under the local marker code; the minted
    // root is retained (the team is durable host-side) so RETRY is offered
    // and reuses the SAME id.
    expect(view.container.querySelector('[data-intent-create-error]')?.textContent)
      .toBe('创建失败：native-error: sessions.select: unknown session session-xRoot 会话 ID 已保留；团队创建失败，可重试（重试复用同一 ID）。')
    const retry = view.container.querySelector<HTMLButtonElement>('[data-intent-retry]')
    expect(retry).not.toBeNull()
    fireEvent.click(retry!)
    await vi.waitFor(() => {
      expect(face.teamCreate).toHaveBeenCalledTimes(2)
    })
    expect(face.teamCreate).toHaveBeenLastCalledWith(expect.objectContaining({
      rootSessionId: teamCreateMock.mock.calls[0]![0]!.rootSessionId,
    }))
  })

  it('the workspace picker renders only when the native feed has rows (UI §8)', async () => {
    const face = makeFace()
    const empty = render(<PanelHarness face={face} />)
    expect(empty.container.querySelector('[data-intent-workspace]')).toBeNull()
    empty.unmount()

    const view = render(<PanelHarness face={face} workspaces={WORKSPACE} />)
    const select = view.container.querySelector<HTMLSelectElement>('[data-intent-workspace]')
    expect(select).not.toBeNull()
    const labels = [...select!.querySelectorAll('option')].map(option => option.textContent)
    expect(labels).toEqual(['默认工作区', '工作区一'])
  })

  it('a loud unknown probe verdict disables Create (never a silent ready)', async () => {
    const face = makeFace({
      probeCompatibility: vi.fn(() => Promise.resolve(errorResponse('INTERNAL', 'boom', 'intent.probe'))),
    })
    const view = render(<PanelHarness face={face} initialDraft={BP_DRAFT} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector<HTMLElement>('[data-intent-compatibility]')?.dataset.intentStatus).toBe('unknown')
    })
    expect(view.container.querySelector('[data-intent-compatibility]')?.textContent)
      .toContain('兼容性结果无法识别：INTERNAL: boom')
    expect(createButton(view.container).disabled).toBe(true)
  })

  it('create-cancel: closing the panel mutates nothing (no team.create, draft intact)', async () => {
    const face = makeFace()
    const onCancel = vi.fn(() => undefined)
    const draftChanges: TeamIntentDraft[] = []
    const view = render(
      <PanelHarness
        face={face}
        initialDraft={{ ...BP_DRAFT, initialWork: 'check in with the team' }}
        onCancel={onCancel}
        onDraftChangeSpy={(next) => {
          draftChanges.push(next)
        }}
      />,
    )
    await vi.waitFor(() => {
      expect(blueprintSelect(view.container).disabled).toBe(false)
    })
    const cancel = view.container.querySelector<HTMLElement>('[data-intent-cancel]')
    expect(cancel).not.toBeNull()
    await act(async () => {
      fireEvent.click(cancel!)
    })
    // The seam fired exactly once…
    expect(onCancel).toHaveBeenCalledTimes(1)
    // …and nothing on the backend moved (no creation attempt of any kind).
    expect(face.teamCreate).toHaveBeenCalledTimes(0)
    expect(view.container.querySelector('[data-intent-create-error]')).toBeNull()
    // …and the parent-held draft never changed (the panel routes every
    // control through onDraftChange; cancel is not one of them).
    expect(draftChanges).toEqual([])
    expect(blueprintSelect(view.container).value).toBe(BP)
    expect(view.container.querySelector<HTMLTextAreaElement>('[data-intent-initial-work]')?.value)
      .toBe('check in with the team')
  })

  it('R119: a non-empty catalog with no explicit pick keeps a LOUD unselected state (the disabled placeholder owns the empty value; the probe never fires; an explicit pick flips to the live path)', async () => {
    const face = makeFace()
    const view = render(<PanelHarness face={face} />)
    await vi.waitFor(() => {
      expect(blueprintSelect(view.container).disabled).toBe(false)
    })
    // The controlled value '' is OWNED by the explicit placeholder (R119):
    // the browser can no longer silently display the first row as if it
    // were selected while draft.blueprintId is still null.
    const select = blueprintSelect(view.container)
    expect(select.value).toBe('')
    const options = [...select.querySelectorAll('option')]
    const placeholder = options.find(option => option.value === '')
    expect(placeholder).not.toBeNull()
    expect(placeholder!.textContent).toBe('选择蓝图…')
    expect(placeholder!.disabled).toBe(true)
    // The unselected state is loud on every channel: the compat block
    // declares `none`, the probe never ran, and the create gate stays
    // closed (no silent half-ready surface).
    expect(view.container.querySelector('[data-intent-compatibility]')?.getAttribute('data-intent-status'))
      .toBe('none')
    expect(face.probeCompatibility).toHaveBeenCalledTimes(0)
    expect(createButton(view.container).disabled).toBe(true)
    // …and an explicit pick flips the surface to the live probe path
    // (probe fires, verdict OPEN, gate opens).
    await act(async () => {
      fireEvent.change(select, { target: { value: BP } })
    })
    await vi.waitFor(() => {
      expect(createButton(view.container).disabled).toBe(false)
    })
    expect(view.container.querySelector('[data-intent-compatibility]')?.getAttribute('data-intent-status'))
      .toBe('OPEN')
    expect(face.probeCompatibility).toHaveBeenCalledTimes(1)
  })
})
