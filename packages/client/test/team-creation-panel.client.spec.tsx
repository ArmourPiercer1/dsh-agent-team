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
 * Create sequence coverage (UI §4.3 canonical order, locked T7): native
 * `createRootSession` (carrying the workspace) → frozen `team.create` →
 * `openSession(rootId)`; a typed `team.create` failure keeps the verbatim
 * error + the retained-root note + a retry that reuses the SAME root (no
 * second native create — G5: no optimistic authority patch anywhere, the
 * rendered state stays projection-driven); a native failure surfaces the
 * local `native-error` marker without a retry.
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
  createRootSession: (opts?: { readonly workspaceId?: string }) => Promise<string>
  listAgentPresets: () => Promise<readonly TeamPresetRow[]>
}

function makeFace(overrides: Partial<PanelFace> = {}): PanelFace {
  return {
    listCatalog: vi.fn(() => Promise.resolve(okResponse(CATALOG_DATA, 'catalog.list'))),
    getCatalog: vi.fn(() => Promise.resolve(okResponse(DETAIL_DATA, 'catalog.get'))),
    probeCompatibility: vi.fn(() => Promise.resolve(okResponse(OPEN_DATA, 'intent.probe'))),
    teamCreate: vi.fn(() => Promise.resolve(okResponse({ teamSessionId: 'root-1' }, 'team.create'))),
    createRootSession: vi.fn(() => Promise.resolve('root-1')),
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
  readonly openSession?: ((sessionId: string) => void) | undefined
  readonly workspaces?: readonly TeamWorkspaceOption[]
  readonly initialDraft?: TeamIntentDraft
}) {
  const [draft, setDraft] = useState<TeamIntentDraft>(props.initialDraft ?? emptyTeamIntentDraft)
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
      draft={draft}
      onDraftChange={setDraft}
      onCancel={() => undefined}
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

  it('create happy path: native root → frozen team.create → open the Root (UI §4.3 order)', async () => {
    const root = deferred<string>()
    const created = deferred<RemoteResponse>()
    const face = makeFace({
      createRootSession: vi.fn(() => root.promise),
      teamCreate: vi.fn(() => created.promise),
    })
    const openSession = vi.fn()
    const view = render(
      <PanelHarness
        face={face}
        openSession={openSession}
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
    expect(face.createRootSession).toHaveBeenCalledTimes(1)
    expect(face.createRootSession).toHaveBeenCalledWith({ workspaceId: 'wsp-1' })
    await act(async () => {
      root.resolve('root-1')
    })
    await act(async () => {
      created.resolve(okResponse({ teamSessionId: 'root-1' }, 'team.create'))
    })
    expect(face.teamCreate).toHaveBeenCalledTimes(1)
    expect(face.teamCreate).toHaveBeenCalledWith({
      rootSessionId: 'root-1',
      blueprintId: BP,
      blueprintRevision: 2,
      initialWork: { prompt: '调研' },
    })
    expect(openSession).toHaveBeenCalledTimes(1)
    expect(openSession).toHaveBeenCalledWith('root-1')
  })

  it('a typed team.create failure keeps the verbatim error, the retained-root note, and a root-reusing retry (G5)', async () => {
    const root = deferred<string>()
    const face = makeFace({
      createRootSession: vi.fn(() => root.promise),
      teamCreate: vi.fn(() => Promise.resolve(errorResponse('ADMISSION_REJECTED', 'prompt too long', 'team.create'))),
    })
    const openSession = vi.fn()
    const view = render(<PanelHarness face={face} openSession={openSession} initialDraft={BP_DRAFT} />)
    const button = createButton(view.container)
    await vi.waitFor(() => {
      expect(button.disabled).toBe(false)
    })
    fireEvent.click(button)
    await act(async () => {
      root.resolve('root-1')
    })
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-create-error]')).toBeTruthy()
    })
    // The typed Remote result, verbatim (no optimistic authority patch).
    expect(view.container.querySelector('[data-intent-create-error]')?.textContent)
      .toBe('创建失败：ADMISSION_REJECTED: prompt too longRoot 会话已创建；团队创建失败，可重试（会话保留）。')
    expect(openSession).not.toHaveBeenCalled()
    const retry = view.container.querySelector<HTMLButtonElement>('[data-intent-retry]')
    expect(retry).not.toBeNull()
    fireEvent.click(retry!)
    await vi.waitFor(() => {
      expect(face.teamCreate).toHaveBeenCalledTimes(2)
    })
    // RETRY re-runs team.create on the SAME retained root — no second native create.
    expect(face.teamCreate).toHaveBeenLastCalledWith({
      rootSessionId: 'root-1',
      blueprintId: BP,
      blueprintRevision: 2,
    })
    expect(face.createRootSession).toHaveBeenCalledTimes(1)
  })

  it('a native root failure surfaces the local native-error marker without a retry (no root was retained)', async () => {
    const face = makeFace({
      createRootSession: vi.fn(() => Promise.reject(new Error('native boom'))),
    })
    const openSession = vi.fn()
    const view = render(<PanelHarness face={face} openSession={openSession} initialDraft={BP_DRAFT} />)
    const button = createButton(view.container)
    await vi.waitFor(() => {
      expect(button.disabled).toBe(false)
    })
    fireEvent.click(button)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-intent-create-error]')).toBeTruthy()
    })
    expect(view.container.querySelector('[data-intent-create-error]')?.textContent)
      .toBe('创建失败：native-error: native boom')
    expect(view.container.querySelector('[data-intent-retry]')).toBeNull()
    expect(face.teamCreate).not.toHaveBeenCalled()
    expect(openSession).not.toHaveBeenCalled()
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
})
